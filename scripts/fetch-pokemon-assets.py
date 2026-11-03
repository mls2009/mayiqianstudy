"""Fetch official PokeAPI artwork and convert the matching game cries to MP3.
Usage: python3 scripts/fetch-pokemon-assets.py --cries /tmp/pokemon-full-source/cries/cries-main/cries/pokemon/latest
Re-running resumes existing valid files. Every result, including fallbacks, is recorded.
"""
import argparse
import concurrent.futures
import json
from pathlib import Path
import subprocess
import tempfile
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/'


def valid_image(file):
    try:
        with Image.open(file) as image:
            image.verify()
        return True
    except (OSError, ValueError):
        return False


def fetch(p, cries):
    pid = p['id']
    art = ROOT / 'assets/pokemon' / f'{pid}.png'
    sound = ROOT / 'assets/pokemon-cries' / f'{pid}.mp3'
    result = {'id': pid, 'image': False, 'cry': False, 'crySourceId': pid}
    if not valid_image(art):
        for relative in [f'other/official-artwork/{pid}.png', f'other/home/{pid}.png', f'{pid}.png', f'versions/generation-ix/scarlet-violet/{pid}.webp']:
            url = SPRITES + relative
            with tempfile.NamedTemporaryFile(suffix='.png') as temp:
                download = subprocess.run(['curl', '-fLsS', '--retry', '1', '--max-time', '30', url, '-o', temp.name], capture_output=True)
                if download.returncode == 0 and valid_image(temp.name):
                    with Image.open(temp.name) as image:
                        image.convert('RGBA').save(art, format='PNG')
                    result['imageSource'] = url
                    break
    result['image'] = valid_image(art)
    if not sound.exists():
        source = cries / f'{pid}.ogg'
        if source.exists():
            temp = sound.with_suffix('.part.mp3')
            run = subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(source), '-af', 'loudnorm=I=-18:TP=-1.5:LRA=7', '-codec:a', 'libmp3lame', '-b:a', '96k', str(temp)], capture_output=True)
            if run.returncode == 0:
                temp.replace(sound)
    if sound.exists():
        probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', str(sound)], capture_output=True, text=True)
        if probe.returncode == 0:
            result['duration'] = float(probe.stdout.strip())
            result['cry'] = result['duration'] > 0
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cries', type=Path, required=True)
    args = parser.parse_args()
    data = json.loads(subprocess.check_output(['node', '-e', "process.stdout.write(JSON.stringify(require('./pokemon-full-data.js')))"], cwd=ROOT))
    report_path = ROOT / 'assets/pokemon-assets-audit.json'
    previous = json.loads(report_path.read_text()) if report_path.exists() else {'entries': []}
    by_id = {p['id']: p for p in previous['entries']}
    (ROOT / 'assets/pokemon').mkdir(exist_ok=True)
    (ROOT / 'assets/pokemon-cries').mkdir(exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        jobs = {pool.submit(fetch, p, args.cries): p['id'] for p in data}
        for index, job in enumerate(concurrent.futures.as_completed(jobs), 1):
            result = job.result()
            # Preserve download provenance across resumed audits.
            result = {**by_id.get(result['id'], {}), **result}
            by_id[result['id']] = result
            if index % 50 == 0 or index == len(data):
                report = {'total': len(data), 'checked': index, 'entries': sorted(by_id.values(), key=lambda p: p['id'])}
                report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
                print(f"checked {index}/{len(data)}; images {sum(p['image'] for p in by_id.values())}; cries {sum(p['cry'] for p in by_id.values())}", flush=True)
    missing = [p['id'] for p in by_id.values() if not p['image'] or not p['cry']]
    print('missing resources:', missing, flush=True)
    raise SystemExit(1 if missing else 0)
