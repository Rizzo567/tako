# Explicit release action. Credentials remain in process environment/private files.
from pathlib import Path
import re,json,urllib.request,shutil,subprocess,os,hashlib
private=Path.home()/'.config/tako-webapp/booking-release-20261020'
s=re.search(r'^SUPABASE_ACCESS_TOKEN\s*=\s*[\'\"]?([^\s\'\"]+)',(Path.home()/'.config/tako-webapp/supabase-management.env').read_text(),re.M).group(1)
base='https://api.supabase.com/v1/projects/tcfccmvpycivxuxkoqpw/functions/tako-operational-candidate'
with urllib.request.urlopen(urllib.request.Request(base,headers={'Authorization':'Bearer '+s})) as r:active=json.load(r)
expected=json.loads((private/'active.json').read_text())
assert active['version']==expected['version'] and active['ezbr_sha256']==expected['ezbr_sha256'],'Online bundle changed. Stop and refresh.'
candidate=(private/'booking-index.ts').read_bytes()
assert hashlib.sha256(candidate).hexdigest()=='df3a5252eb5355a117f6509872342f6969512edfb33c2815581a4dc01046169e'
dest=private/'deploy/supabase/functions/tako-operational-candidate';dest.mkdir(parents=True,exist_ok=True)
(dest/'index.ts').write_bytes(candidate);shutil.copy2(private/'magick-wasm-0.0.44.js',dest)
env=dict(os.environ,SUPABASE_ACCESS_TOKEN=s)
p=subprocess.run(['pnpm','dlx','supabase','functions','deploy','tako-operational-candidate','--project-ref','tcfccmvpycivxuxkoqpw','--no-verify-jwt'],cwd=private/'deploy',env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
(private/'deploy.log').write_bytes(p.stdout)
print('Operational deploy exit',p.returncode)
if p.returncode:raise SystemExit(p.returncode)
with urllib.request.urlopen(urllib.request.Request(base,headers={'Authorization':'Bearer '+s})) as r:after=json.load(r)
(private/'deployed.json').write_text(json.dumps(after));print('Active version',after['version'])
