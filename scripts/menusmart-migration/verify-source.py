"""Compare public MenuSmart tables using GET only. Never opens analytics pages."""
import json, sys, pathlib, urllib.request, hashlib, datetime

snapshot = pathlib.Path(sys.argv[1])
config = pathlib.Path(sys.argv[2])
env = {}
for line in config.read_text().splitlines():
    if '=' in line and not line.startswith('#'):
        key, value = line.split('=', 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
base = env['VITE_SUPABASE_URL'].rstrip('/')
key = env['VITE_SUPABASE_PUBLISHABLE_KEY']
manifest = json.loads((snapshot / 'manifest.json').read_text())
results = []
def canonical(rows):
    return json.dumps(sorted(rows, key=lambda r: json.dumps(r, sort_keys=True)), sort_keys=True, ensure_ascii=False, separators=(',', ':'))
for table in manifest['tables']:
    rows = []
    for offset in range(0, 100000, 1000):
        req = urllib.request.Request(f'{base}/rest/v1/{table}?select=*&limit=1000&offset={offset}', headers={'apikey': key, 'Authorization': 'Bearer ' + key}, method='GET')
        with urllib.request.urlopen(req, timeout=30) as response:
            batch = json.load(response)
        rows.extend(batch)
        if len(batch) < 1000:
            break
    original = json.loads((snapshot / (table + '.json')).read_text())
    unchanged = canonical(rows) == canonical(original)
    results.append({'table': table, 'count': len(rows), 'unchanged': unchanged, 'sha256': hashlib.sha256(canonical(rows).encode()).hexdigest()})
result = {'method': 'GET only', 'verifiedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'tables': results, 'unchanged': all(r['unchanged'] for r in results)}
(snapshot / 'source-verification.json').write_text(json.dumps(result, indent=2))
(snapshot / 'source-verification.json').chmod(0o600)
print(json.dumps(result))
sys.exit(0 if result['unchanged'] else 2)
