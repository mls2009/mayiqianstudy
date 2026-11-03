"""Copy the two named children's legacy records into their separate D1 databases.
The source database is read-only. Existing destination rows are never overwritten.
"""
import argparse
import json
import subprocess
import tempfile
import time
from pathlib import Path

ACCOUNTS = {'马亦谦': 'pokemon-ma-yi-qian', '马熠初': 'pokemon-ma-yi-chu'}


def query(db, sql, local=False):
    for attempt in range(3):
        run = subprocess.run(['wrangler', 'd1', 'execute', db, '--local' if local else '--remote', '--command', sql, '--json'], capture_output=True, text=True)
        if run.returncode == 0:
            return json.loads(run.stdout)[0]['results']
        if attempt == 2:
            raise RuntimeError('D1 query failed: ' + run.stderr[-500:])
        time.sleep(1)



def quote(value):
    if value is None:
        return 'NULL'
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--local-target', action='store_true', help='Copy the remote legacy data to the two local development stores instead')
    args=parser.parse_args()
    tables = {r['name'] for r in query('my-score-db', "SELECT name FROM sqlite_master WHERE type='table'")}
    for user, destination in ACCOUNTS.items():
        records = query('my-score-db', 'SELECT * FROM records WHERE user_id=' + quote(user))
        statements = ['INSERT OR IGNORE INTO users (id,name) VALUES (' + quote(user) + ',' + quote(user) + ');']
        for record in records:
            columns = ['id', 'user_id', 'behavior_name', 'score', 'timestamp', 'date', 'category', 'item_index']
            statements.append('INSERT OR IGNORE INTO records (' + ','.join(columns) + ') VALUES (' + ','.join(quote(record.get(c)) for c in columns) + ');')
        adventures = query('my-score-db', 'SELECT * FROM adventures WHERE user_id=' + quote(user)) if 'adventures' in tables else []
        for row in adventures:
            statements.append('INSERT OR IGNORE INTO adventures (user_id,state,version) VALUES (' + ','.join(quote(row[c]) for c in ['user_id', 'state', 'version']) + ');')
        with tempfile.TemporaryDirectory(prefix='pokemon-migration-') as folder:
            file = Path(folder) / 'migration.sql'
            file.write_text('\n'.join(statements))
            file.chmod(0o600)
            subprocess.run(['wrangler', 'd1', 'execute', destination, '--local' if args.local_target else '--remote', '--file', str(file), '--json'], capture_output=True, text=True, check=True)
        target = query(destination, 'SELECT id FROM records WHERE user_id=' + quote(user), args.local_target)
        assert {r['id'] for r in records}.issubset({r['id'] for r in target})
        others = query(destination, 'SELECT COUNT(*) AS count FROM records WHERE user_id!=' + quote(user), args.local_target)
        assert others[0]['count'] == 0
        print(json.dumps({'user': user, 'copiedRecords': len(records), 'adventures': len(adventures), 'verifiedDestinationRecords': len(target), 'crossAccountRecords': 0}, ensure_ascii=False), flush=True)
