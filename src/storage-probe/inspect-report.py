"""Inspect bounded probe reports as data; no commands, mount changes or installation authorization."""
from pathlib import Path
import argparse,json,hashlib,re,stat
IO_SHA='0a8f84c774eaae6572f99df49252a10a9ca64910162ef6d4fae414a17e486086'
UUID=re.compile(r'[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}')
def plan_values(raw):
 lines=raw.decode('ascii').splitlines()
 if len(lines)!=5 or lines[0]!='cmu-storage-plan-v1' or lines[3]!='filesystem relfs':raise ValueError('plan shape')
 canonical=lines[1].removeprefix('canonical ');source=lines[2].removeprefix('source ')
 if (canonical,source) not in [('/tmp/mnt/data_persist','/dev/mmcblk0p2'),('/tmp/mnt/data','/dev/ffx01p4')]:raise ValueError('plan storage')
 if not re.fullmatch(r'preflight-sha256 [a-f0-9]{64}',lines[4]):raise ValueError('preflight identity')
 return {'plan-sha256':hashlib.sha256(raw).hexdigest(),'storage-canonical':canonical,'storage-source':source}
def inspect(text,plan,operation,token=None):
 if len(text.encode())>256*1024:raise ValueError('report too large')
 errors=[];values={}
 for line in text.splitlines():
  if line.startswith('stop:') or line.startswith('error:'):errors.append('producer stopped')
  if '=' in line:
   k,v=line.split('=',1)
   if k in values:errors.append('duplicate field '+k)
   values[k]=v
 required={'cmu-storage-probe':'0.1','execution-context':'cmu-native','oem-writes':'none','mount-changes':'none','live-installation':'disabled','effective-uid':'0','native-helper-sha256':IO_SHA,'file-data-limit-bytes':'65536','operation':operation,'read-only-sources-stable':'yes','storage-identity-stable':'yes','fsync-data-and-directory':'completed','operation-complete':'yes','worker-exit':'0',**plan}
 phase={'prepare':'published','resume':'recovered','cleanup':'removed'}
 if operation not in phase:raise ValueError('operation')
 required['probe-phase']=phase[operation]
 if operation=='prepare':required['next-operation']='resume'
 if operation=='resume':required.update({'next-operation':'cleanup','payload-content-and-metadata-restored':'yes'})
 if operation=='cleanup':required['probe-directory-removed']='yes'
 for k,v in required.items():
  if values.get(k)!=v:errors.append('missing or incorrect '+k)
 if not re.search(r'^kernel:\nLinux\b[^\n]*\b3\.0\.35\b[^\n]*\barmv7l\b',text,re.M):errors.append('native kernel context missing')
 actual=values.get('probe-token','')
 if not re.fullmatch('[a-f0-9]{32}',actual) or token is not None and actual!=token:errors.append('probe token')
 prepared=values.get('prepared-boot-id','');observed=values.get('observed-boot-id','')
 if not UUID.fullmatch(prepared) or not UUID.fullmatch(observed):errors.append('boot identity')
 boundary=prepared!=observed
 if values.get('boot-boundary-observed')!=('yes' if boundary else 'no'):errors.append('boot boundary contradiction')
 if operation=='prepare' and boundary:errors.append('prepare cannot cross boot identity')
 return {'probe_operation_report_consistent':not errors,'errors':errors,'operation':operation,'token':actual,'prepared_boot_id':prepared,'observed_boot_id':observed,'reported_kernel_boot_boundary':boundary and not errors,'live_installation_ready':False,'physical_power_loss_verified':False}
def inspect_chain(prepare,resume,cleanup,rawplan):
 plan=plan_values(rawplan);a=inspect(prepare,plan,'prepare');b=inspect(resume,plan,'resume',a['token']);c=inspect(cleanup,plan,'cleanup',a['token']);errors=[]
 for r in [a,b,c]:errors += [r['operation']+': '+e for e in r['errors']]
 if a['prepared_boot_id']!=b['prepared_boot_id'] or a['prepared_boot_id']!=c['prepared_boot_id']:errors.append('mixed prepared boot identities')
 return {'storage_probe_chain_report_consistent':not errors,'errors':errors,'operations':[a,b,c],'kernel_boot_boundary_reported':b['reported_kernel_boot_boundary'] and not errors,'live_installation_ready':False,'physical_power_loss_verified':False,'scope':'consistency of reported bounded capability test; no actual native execution inferred from host fixtures; no OEM publication, startup or equipment proof'}
def read(path,maximum):
 p=Path(path)
 if p.is_symlink() or not stat.S_ISREG(p.stat().st_mode) or p.stat().st_size>maximum:raise ValueError('regular bounded input required')
 return p.read_bytes()
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('plan');p.add_argument('prepare_report');p.add_argument('resume_report');p.add_argument('cleanup_report');a=p.parse_args()
 try:r=inspect_chain(*[read(f,256*1024).decode('utf-8') for f in [a.prepare_report,a.resume_report,a.cleanup_report]],read(a.plan,1024));print(json.dumps(r,ensure_ascii=False,indent=2));raise SystemExit(0 if r['storage_probe_chain_report_consistent'] else 2)
 except (OSError,ValueError,UnicodeError) as e:p.exit(2,str(e)+'\n')
