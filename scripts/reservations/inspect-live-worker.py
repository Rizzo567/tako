from pathlib import Path
import re,urllib.request,json,email.parser,email.policy,hashlib
cfg={'oauth_token':re.search(r'oauth_token\s*=\s*"([^"]+)"',(Path.home()/'Library/Preferences/.wrangler/config/default.toml').read_text()).group(1)}
base='https://api.cloudflare.com/client/v4/accounts/6978af99fd8949fba8ddb1d721e2a351/workers/scripts/takomenu-web'
req=urllib.request.Request(base,headers={'Authorization':'Bearer '+cfg['oauth_token']})
with urllib.request.urlopen(req) as r: raw=r.read();ctype=r.headers.get('Content-Type')
p=Path.home()/'.config/tako-webapp/booking-release-20261020';p.mkdir(exist_ok=True)
(p/'worker-response.bin').write_bytes(raw)
m=email.parser.BytesParser(policy=email.policy.default).parsebytes(('Content-Type: '+ctype+'\r\n\r\n').encode()+raw)
for part in m.iter_parts():
 name=part.get_filename() or part.get_param('name',header='content-disposition');content=part.get_payload(decode=True)
 if name and name.endswith(('.js','.mjs')):
  (p/('live-'+Path(name).name)).write_bytes(content);print(name,hashlib.sha256(content).hexdigest(),len(content))
def get(url):
 with urllib.request.urlopen(urllib.request.Request(url,headers={'Authorization':'Bearer '+cfg['oauth_token']})) as r:return json.load(r)
settings=get(base+'/settings')['result']
routes=get('https://api.cloudflare.com/client/v4/zones/6fafed1a729e8979bc49e6a89f80eff4/workers/routes')['result']
settings_path=p/'worker-settings.json';settings_path.write_text(json.dumps(settings));settings_path.chmod(0o600)
selected=[{'pattern':r['pattern'],'zone_id':'6fafed1a729e8979bc49e6a89f80eff4'} for r in routes if r['script']=='takomenu-web']
print('bindings',[(b['type'],b['name']) for b in settings['bindings']]);print('routes',[r['pattern'] for r in selected])
config={'name':'takomenu-web','account_id':'6978af99fd8949fba8ddb1d721e2a351','main':str(p/'live-worker.js'),'compatibility_date':settings['compatibility_date'],'compatibility_flags':settings.get('compatibility_flags',[]),'assets':{'directory':str(Path.cwd()/'release/serverless/static'),'binding':'ASSETS','run_worker_first':True,'not_found_handling':'none','html_handling':'none'},'vars':{b['name']:b['text'] for b in settings['bindings'] if b['type']=='plain_text'},'routes':selected}
if not any(r['pattern']=='takoitalia.com/prenota/*' for r in selected):config['routes'].append({'pattern':'takoitalia.com/prenota/*','zone_id':'6fafed1a729e8979bc49e6a89f80eff4'})
(p/'wrangler-booking.json').write_text(json.dumps(config,indent=2));(p/'wrangler-booking.json').chmod(0o600)
