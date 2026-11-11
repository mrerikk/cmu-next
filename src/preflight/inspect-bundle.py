"""Inspect the manager report/preflight pair as data; never executes it or permits installation."""
from pathlib import Path
import argparse,hashlib,json,importlib.util,os,re,stat
h=Path(__file__).resolve().parent

def read_regular(path,cap):
 fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
 try:
  before=os.fstat(fd)
  if not stat.S_ISREG(before.st_mode) or before.st_nlink!=1 or before.st_size<=0 or before.st_size>cap:raise ValueError('regular bounded report file required')
  chunks=[];size=0
  while True:
   chunk=os.read(fd,min(65536,cap+1-size))
   if not chunk:break
   chunks.append(chunk);size+=len(chunk)
   if size>cap:raise ValueError('report too large')
  after=os.fstat(fd);attrs=['st_dev','st_ino','st_mode','st_uid','st_gid','st_size','st_mtime_ns','st_nlink']
  if any(getattr(before,a)!=getattr(after,a) for a in attrs) or size!=before.st_size:raise ValueError('report changed while reading')
  return b''.join(chunks)
 finally:os.close(fd)

def inspect_directory(directory,collector_sha=None,expected=None):
 root=Path(directory);errors=[];preflight=None;pair_values={}
 if root.is_symlink() or not root.is_dir():raise ValueError('plain report directory required')
 contract=json.loads((h/'pair-values.json').read_text());collector_sha=collector_sha or contract['collector_sha256'];expected=expected or json.loads((h/'preflight-values.json').read_text())
 try:
  main=read_regular(root/'report.txt',16*1024*1024);attachment=read_regular(root/'preflight.txt',2*1024*1024)
  text=main.decode('utf-8');head=text.split('job-record-begin=',1)[0]
  names=['cmu-manager-report','mode','live-installation','preflight-attachment','preflight-report-sha256','preflight-worker-exit','preflight-collector-sha256']
  for name in names:
   values=re.findall(r'^'+re.escape(name)+r'=(.*)$',head,re.M)
   if len(values)!=1:errors.append('missing or duplicated '+name)
   else:pair_values[name]=values[0]
  required={'cmu-manager-report':'0.3.1','mode':'ram-lab','live-installation':'disabled','preflight-attachment':'preflight.txt','preflight-collector-sha256':collector_sha}
  for name,value in required.items():
   if pair_values.get(name)!=value:errors.append('incorrect '+name)
  if pair_values.get('preflight-report-sha256')!=hashlib.sha256(attachment).hexdigest():errors.append('preflight attachment hash mismatch')
  if not text.endswith('report-collected=yes\n'):errors.append('manager report incomplete')
  if not re.fullmatch(r'\d{1,3}',pair_values.get('preflight-worker-exit','')) or int(pair_values.get('preflight-worker-exit','999'))>255:errors.append('preflight exit code')
  decoded=attachment.decode('utf-8');codes=re.findall(r'^worker-exit=(\d+)$',decoded,re.M)
  if codes!=[pair_values.get('preflight-worker-exit')]:errors.append('preflight exit code mismatch')
  spec=importlib.util.spec_from_file_location('manager_preflight',h/'inspect-preflight.py');parser=importlib.util.module_from_spec(spec);spec.loader.exec_module(parser);preflight=parser.inspect(decoded,expected)
 except (OSError,UnicodeError,ValueError) as e:errors.append(str(e))
 pair_ok=not errors;preflight_ok=pair_ok and bool(preflight and preflight['read_only_preflight_report_consistent'])
 return {'manager_report_pair_consistent':pair_ok,'errors':errors,'read_only_preflight_report_consistent':preflight_ok,'preflight_errors':preflight['errors'] if preflight else ['preflight not inspected'],'persistent_candidates_for_next_bounded_test':preflight['persistent_candidates_for_next_bounded_test'] if preflight_ok else [],'live_installation_ready':False,'persistent_storage_write_or_fsync_proven':False,'scope':'paired report consistency and read-only observations only; no persistent installation, reboot, rendering or equipment proof'}
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('report_directory');a=p.parse_args()
 try:r=inspect_directory(a.report_directory);print(json.dumps(r,ensure_ascii=False,indent=2));raise SystemExit(0 if r['read_only_preflight_report_consistent'] else 2)
 except (OSError,ValueError) as e:p.exit(2,str(e)+'\n')
