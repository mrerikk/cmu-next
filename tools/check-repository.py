"""Check publication boundaries, source syntax and immutable asset identities."""
from pathlib import Path
import ast,hashlib,json,re,shutil,subprocess
root=Path(__file__).resolve().parents[1];files=[p for p in root.rglob('*') if p.is_file() and not any(x in p.relative_to(root).parts for x in ['.git','build','dist','__pycache__'])]
errors=[];shell=shutil.which('sh');node=shutil.which('node');js_count=0
for p in files:
 rel=p.relative_to(root)
 if str(rel)!=str(rel).lower():errors.append('uppercase project path: '+str(rel))
 if p.is_symlink():errors.append('symlink: '+str(rel))
 if p.suffix in ['.up','.img','.log','.pid'] or p.name in ['auth','client.js','report.txt','preflight.txt']:errors.append('private/generated artifact: '+str(rel))
 if p.name=='index.html':errors.append('OEM index must not be tracked')
 try:text=p.read_text()
 except UnicodeDecodeError:continue
 if re.search(r'/Users/[A-Za-z0-9_-]+/',text):errors.append('personal workstation path: '+str(rel))
 if re.search(r'(?:ghp_|github_pat_)[A-Za-z0-9_]{15,}',text):errors.append('possible GitHub credential: '+str(rel))
 if re.search(r"token:'[a-f0-9]{64}'",text):errors.append('literal connection token: '+str(rel))
 if p.suffix=='.py':
  try:ast.parse(text,filename=str(rel))
  except SyntaxError as e:errors.append(str(e))
 if p.suffix=='.sh':
  r=subprocess.run([shell,'-n',str(p)],capture_output=True,text=True)
  if r.returncode:errors.append(str(rel)+': '+r.stderr)
 if p.suffix in ['.js','.cjs'] and node:
  r=subprocess.run([node,'--check',str(p)],capture_output=True,text=True)
  if r.returncode:errors.append(str(rel)+': '+r.stderr)
  js_count+=1
module=root/'src/visual/module';count=0
for line in (module/'module.tsv').read_text().splitlines():
 if line.startswith('file '):
  fields=line.split();count+=1
  if fields[4]=='payload/index.html':continue
  p=module/fields[4]
  if not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=fields[3]:errors.append('module digest mismatch: '+fields[4])
if count!=82:errors.append('module target count differs from 82')
for p in (root/'history/retrofit').glob('*/embedded-assets.json'):
 for name,info in json.loads(p.read_text()).items():
  b=(root/'history/retrofit/assets'/name).read_bytes()
  if len(b)!=info['bytes'] or hashlib.sha256(b).hexdigest()!=info['sha256']:errors.append('historical asset mismatch: '+name)
if errors:raise SystemExit('\n'.join(errors))
print('PASS:',len(files),'files; publication boundaries, Python/shell syntax, 82 module targets and historical asset hashes')
print('JavaScript syntax:',str(js_count)+' files checked' if node else 'not checked (Node.js unavailable)')
print('No hardware compatibility or permanent-installation claim is made.')
