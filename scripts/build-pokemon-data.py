"""Build the complete local catalog from the CSVs backing PokeAPI v2.
Usage: python3 scripts/build-pokemon-data.py --source /tmp/pokemon-full-source
Missing source files are downloaded from the official repository and cached there.
"""
import argparse
import csv
import hashlib
import json
from pathlib import Path
import subprocess
from collections import defaultdict
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/'
TABLES = ['pokemon_species', 'pokemon_species_names', 'pokemon_species_flavor_text', 'pokemon',
          'pokemon_types', 'type_names', 'pokemon_evolution', 'evolution_triggers',
          'pokemon_forms', 'pokemon_form_names', 'item_names']


def build(folder):
    tables, provenance = {}, {}
    for name in TABLES:
        file = folder / (name + '.csv')
        if not file.exists():
            subprocess.run(['curl', '-fLsS', '--retry', '2', '--max-time', '60', SOURCE + file.name, '-o', str(file)], check=True)
        with file.open(newline='') as source:
            tables[name] = list(csv.DictReader(source))
        provenance[name] = {'url': SOURCE + file.name, 'rows': len(tables[name]), 'sha256': hashlib.sha256(file.read_bytes()).hexdigest()}
    species = {int(p['id']): p for p in tables['pokemon_species']}
    localized = {(int(p['pokemon_species_id']), int(p['local_language_id'])): p for p in tables['pokemon_species_names']}
    pokemon = tables['pokemon']
    defaults = {int(p['species_id']): int(p['id']) for p in pokemon if p['is_default'] == '1'}
    forms, form_names, descriptions, types, evolutions = (defaultdict(list) for _ in range(5))
    for f in tables['pokemon_forms']:
        forms[int(f['pokemon_id'])].append(f)
    for n in tables['pokemon_form_names']:
        form_names[(int(n['pokemon_form_id']), int(n['local_language_id']))] = n
    for f in tables['pokemon_species_flavor_text']:
        if f['language_id'] in ['12', '4', '9']:
            descriptions[int(f['species_id'])].append(f)
    type_names = {int(t['type_id']): t['name'] for t in tables['type_names'] if t['local_language_id'] == '12'}
    for t in tables['pokemon_types']:
        types[int(t['pokemon_id'])].append((int(t['slot']), type_names[int(t['type_id'])]))
    triggers = {int(t['id']): t['identifier'] for t in tables['evolution_triggers']}
    item_names = {int(t['item_id']): t['name'] for t in tables['item_names'] if t['local_language_id'] == '12'}
    for e in tables['pokemon_evolution']:
        values = {k: int(v) if v.lstrip('-').isdigit() else v for k, v in e.items() if v != ''}
        values['trigger'] = triggers[values['evolution_trigger_id']]
        for field in ['trigger_item_id', 'held_item_id']:
            if field in values:
                values[field.replace('_id', '_name')] = item_names.get(values[field], '')
        evolutions[int(e['evolved_species_id'])].append(values)
    form_labels = {'mega': '超级进化', 'mega-x': '超级进化X', 'mega-y': '超级进化Y',
                   'alola': '阿罗拉的样子', 'galar': '伽勒尔的样子', 'hisui': '洗翠的样子', 'paldea': '帕底亚的样子',
                   'gmax': '超极巨化', 'primal': '原始回归', 'origin': '起源形态', 'therian': '灵兽形态',
                   'incarnate': '化身形态', 'attack': '攻击形态', 'defense': '防御形态', 'speed': '速度形态',
                   'sky': '天空形态', 'land': '陆上形态', 'female': '雌性', 'male': '雄性'}

    def ancestry(sid):
        path = [sid]
        while species[path[-1]]['evolves_from_species_id']:
            parent = int(species[path[-1]]['evolves_from_species_id'])
            if parent in path:
                raise ValueError('Cyclic evolution chain ' + str(sid))
            path.append(parent)
        return path

    catalog = []
    for p in pokemon:
        pid, sid = int(p['id']), int(p['species_id'])
        s, name = species[sid], localized[(sid, 12)]
        english_name = localized[(sid, 9)]['name']
        variant = next((f for f in forms[pid] if f['is_default'] == '1'), forms[pid][0])
        fn = form_names.get((int(variant['id']), 12)) or form_names.get((int(variant['id']), 4))
        english_form = form_names.get((int(variant['id']), 9), {}).get('form_name', '')
        suffix = variant['form_identifier']
        form_label = (fn or {}).get('form_name') or form_labels.get(suffix) or english_form or suffix
        default = defaults[sid] == pid
        full_name = (fn or {}).get('pokemon_name') or (name['name'] + ('（' + form_label + '）' if not default and form_label else ''))
        flavor = min(descriptions[sid], key=lambda f: (['12', '4', '9'].index(f['language_id']), -int(f['version_id']))) if descriptions[sid] else None
        path = ancestry(sid)
        catalog.append({
            'id': pid, 'speciesId': sid, 'identifier': p['identifier'], 'name': full_name,
            'speciesName': name['name'], 'englishName': english_name, 'genus': name['genus'] or '源资料未提供分类',
            'description': ' '.join(flavor['flavor_text'].replace('\f', ' ').split()) if flavor and flavor['language_id'] in ['12', '4'] else name['name'] + '是' + '、'.join(t for _, t in sorted(types[pid])) + '属性的' + (name['genus'] or '宝可梦') + '。' + ('由' + localized[(int(s['evolves_from_species_id']), 12)]['name'] + '进化而来。' if s['evolves_from_species_id'] else '在物种进化链中属于初始阶段。') + ('这是它的' + form_label + '形态。' if not default else ''),
            'descriptionKind': 'flavor' if flavor and flavor['language_id'] in ['12', '4'] else 'summary',
            'originalFlavorText': ' '.join(flavor['flavor_text'].replace('\f', ' ').split()) if flavor else None,
            'descriptionLanguage': 'zh-Hant' if flavor and flavor['language_id'] == '4' else 'zh-Hans',
            'originalFlavorLanguage': {'12': 'zh-Hans', '4': 'zh-Hant', '9': 'en'}.get(flavor['language_id'], 'none') if flavor else 'none',
            'descriptionVersion': int(flavor['version_id']) if flavor else None,
            'heightM': int(p['height']) / 10, 'weightKg': int(p['weight']) / 10,
            'types': [t for _, t in sorted(types[pid])], 'generation': int(s['generation_id']),
            'isLegendary': s['is_legendary'] == '1', 'isMythical': s['is_mythical'] == '1',
            'isMega': any(f['is_mega'] == '1' for f in forms[pid]), 'stage': len(path) - 1,
            'evolvesFrom': defaults[int(s['evolves_from_species_id'])] if default and s['evolves_from_species_id'] else None,
            'evolvesTo': [defaults[int(q['id'])] for q in species.values() if default and q['evolves_from_species_id'] == str(sid)],
            'evolutionConditions': evolutions[sid] if default else [], 'familyRoot': defaults[path[-1]],
            'formOf': None if default else defaults[sid], 'formLabel': form_label,
            'forms': [int(q['id']) for q in pokemon if default and q['species_id'] == str(sid) and q['is_default'] != '1'],
            'formVariants': [{'id': int(f['id']), 'identifier': f['identifier'], 'label':
                             (form_names.get((int(f['id']), 12)) or form_names.get((int(f['id']), 9)) or {}).get('form_name') or f['form_identifier'],
                             'battleOnly': f['is_battle_only'] == '1'} for f in forms[pid]]
        })
    # Pokemon-species ancestry is insufficient for regional evolution. The form IDs
    # in pokemon_evolution identify the actual parent and child battle entries.
    by_id = {p['id']: p for p in catalog}
    form_pokemon = {int(f['id']): int(f['pokemon_id']) for f in tables['pokemon_forms']}
    for p in catalog:
        p['evolutionParents'], p['evolutionChildren'], p['evolutionRoutes'] = [], [], []
    for evolved_sid, conditions in evolutions.items():
        parent_sid = species[evolved_sid]['evolves_from_species_id']
        if not parent_sid:
            continue
        for condition in conditions:
            source = form_pokemon.get(condition.get('required_pokemon_form_id'), defaults[int(parent_sid)])
            target = form_pokemon.get(condition.get('evolved_pokemon_form_id'), defaults[evolved_sid])
            if target not in by_id[source]['evolutionChildren']:
                by_id[source]['evolutionChildren'].append(target)
                by_id[target]['evolutionParents'].append(source)
            by_id[target]['evolutionRoutes'].append({'from': source, 'condition': condition})
    for p in catalog:
        # For a DAG, one spanning-tree parent positions the node; the diagram also
        # draws every other real evolution and same-species relationship edge.
        p['graphParent'] = (p['evolutionParents'] or [p['formOf']])[0]
    target = ROOT / 'pokemon-full-data.js'
    target.write_text('/* Generated by scripts/build-pokemon-data.py from PokeAPI. Do not edit by hand. */\n(function(root){\nconst data=' +
                      json.dumps(catalog, ensure_ascii=False, separators=(',', ':')) +
                      ";\nroot.PokemonFullData=data;\nif(typeof module!=='undefined')module.exports=data;\n})(globalThis);\n")
    report = {'generatedAt': datetime.now(timezone.utc).isoformat(), 'source': 'PokeAPI/pokeapi data/v2/csv',
              'species': len(species), 'pokemon': len(catalog), 'cosmeticForms': sum(len(p['formVariants']) for p in catalog),
              'megaPokemon': sum(p['isMega'] for p in catalog),
              'missingChineseDescriptions': [p['id'] for p in catalog if p['descriptionKind'] == 'summary'],
              'tables': provenance}
    (ROOT / 'assets' / 'pokemon-data-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: (len(v) if k == 'missingChineseDescriptions' else v) for k, v in report.items() if k != 'tables'}, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    args = parser.parse_args()
    args.source.mkdir(parents=True, exist_ok=True)
    build(args.source)
