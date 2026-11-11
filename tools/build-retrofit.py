"""Rebuild a historical generated runtime from compact source and shared assets."""
from pathlib import Path
import argparse,hashlib,json,base64,shutil
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--version',choices=['0.6.2','0.7','0.7.1','0.8'],default='0.8');parser.add_argument('--out',required=True);args=parser.parse_args()
source=root/'history/retrofit'/args.version;run=(source/'runtime.template.js').read_text()
for name,info in json.loads((source/'embedded-assets.json').read_text()).items():
 b=(root/'history/retrofit/assets'/name).read_bytes()
 if hashlib.sha256(b).hexdigest()!=info['sha256'] or len(b)!=info['bytes']:raise ValueError('asset mismatch: '+name)
 mime='font/ttf' if name.endswith('.ttf') else 'image/png';uri='data:'+mime+';base64,'+base64.b64encode(b).decode('ascii');run=run.replace('assets/'+name,uri)
expected=(source/'runtime.sha256').read_text().strip()
if hashlib.sha256(run.encode()).hexdigest()!=expected:raise ValueError('runtime reconstruction digest mismatch')
out=Path(args.out)
if out.exists():raise ValueError('output directory must not exist')
(out/'usb/js').mkdir(parents=True);(out/'usb/js/run.js').write_text(run);shutil.copytree(root/'src/loaders',out/'usb/mp3')
print('Reconstructed temporary retrofit',args.version,'at',out)
