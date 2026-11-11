"""Host-only experiment: reversible, strictly scoped boot hook on a marked firmware copy.
This does not install a service, modify a car or prove native boot compatibility.
"""
from pathlib import Path
import argparse,contextlib,fcntl,hashlib,json,os,signal,stat,tempfile,xml.etree.ElementTree as ET

STAGE='jci/scripts/stage_usb.sh'
ORIGINAL_SHA='2ec71fc955d0107a6e90d1ab4e6f00c9438b56d3e621ef018d57c8ef07bfae7f'
CONFIG_SHA='fa3484d7c644393ab6cb083990e483201129a207e7755459296dde8ec82a4d84'
FIRMWARE_SHA='7613d9b53aaf53bbc54a996737d38efe72bdf589f5839bb0d29622d6668dc340'
IO_MD5='fa48afeebb0c7765f42235bcf85858d7'
IO_SHA='0a8f84c774eaae6572f99df49252a10a9ca64910162ef6d4fae414a17e486086'
sha=lambda data:hashlib.sha256(data).hexdigest()

def regular(p):
 s=p.lstat()
 if not stat.S_ISREG(s.st_mode):raise ValueError('expected plain file: '+str(p))
 return s

def walk(root,relative):
 if relative.startswith('/') or any(p in ('','.','..') for p in relative.split('/')):raise ValueError('invalid relative path')
 p=root
 for component in relative.split('/'):
  p=p/component
  if p.is_symlink():raise ValueError('symlink in scoped path')
 return p

def labroot(lab):
 lab=Path(lab)
 if lab.is_symlink():raise ValueError('symlink lab')
 lab=lab.resolve(strict=True)
 if lab==Path('/') or (lab/'rootfs').is_symlink():raise ValueError('live or symlink root refused')
 if (lab/'native-lab.txt').read_bytes()!=b'cmu-native-lab-02\n':raise ValueError('copy marker missing')
 root=lab/'rootfs'
 if not root.is_dir():raise ValueError('copy root missing')
 return lab,root

def metadata(p):
 s=regular(p);return {'mode':stat.S_IMODE(s.st_mode),'uid':s.st_uid,'gid':s.st_gid,'mtime_ns':s.st_mtime_ns,'size':s.st_size}

def syncdir(p):
 fd=os.open(p,os.O_RDONLY|getattr(os,'O_DIRECTORY',0)|os.O_NOFOLLOW)
 try:os.fsync(fd)
 finally:os.close(fd)

def write_new(p,data):
 fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 try:
  with os.fdopen(fd,'wb',closefd=False) as f:f.write(data);f.flush();os.fsync(f.fileno())
 finally:os.close(fd)
 syncdir(p.parent)

def atomic(p,data):
 temp=p.with_name(p.name+'.next')
 write_new(temp,data);os.replace(temp,p);syncdir(p.parent)

def phase(state,value):atomic(state/'phase',(value+'\n').encode())

def make_hook(original,entry_sha,io_md5=IO_MD5,io_sha=IO_SHA):
 if sha(original)!=ORIGINAL_SHA:raise ValueError('unexpected original boot script')
 if not len(entry_sha)==64 or any(c not in '0123456789abcdef' for c in entry_sha):raise ValueError('entry hash')
 block='''
# cmu-next boot hook v1 begin
# Optional background component; OEM startup must not wait for it.
if [ -f /data_persist/cmu-next/boot/enabled ] && [ ! -L /data_persist/cmu-next/boot/enabled ]; then
 (
  umask 077
  PATH=/bin:/sbin:/usr/bin:/usr/sbin
  export PATH
  persistent=/data_persist/cmu-next/boot
  [ ! -L "$persistent/cmu-io" ] && [ ! -L "$persistent/entry.sh" ] || exit 0
  work=$(mktemp -d /tmp/cmu-next-boot.XXXXXX) || exit 0
  exec > "$work/boot.log" 2>&1
  cp "$persistent/cmu-io" "$work/cmu-io" || exit 0
  [ "$(md5sum "$work/cmu-io" | awk '{print $1}')" = '@@io-md5@@' ] || exit 0
  chmod 700 "$work/cmu-io" || exit 0
  "$work/cmu-io" check "$work/cmu-io" '@@io-sha@@' > /dev/null || exit 0
  cp "$persistent/entry.sh" "$work/entry.sh" || exit 0
  "$work/cmu-io" check "$work/entry.sh" '@@entry-sha@@' > /dev/null || exit 0
  /bin/sh "$work/entry.sh" "$persistent" "$work"
 ) </dev/null >/dev/null 2>&1 &
fi
# cmu-next boot hook v1 end
'''
 return original+block.replace('@@io-md5@@',io_md5).replace('@@io-sha@@',io_sha).replace('@@entry-sha@@',entry_sha).encode()

def contract(root):
 version=walk(root,'jci/version.ini');config=walk(root,'jci/sm/sm.conf')
 if sha(version.read_bytes())!=FIRMWARE_SHA or sha(config.read_bytes())!=CONFIG_SHA:raise ValueError('firmware or startup config mismatch')
 doc=ET.fromstring(config.read_bytes())
 services=[s for s in doc.findall('.//service') if s.get('name')=='stage_usb']
 if len(services)!=1:raise ValueError('stage ambiguity')
 service=services[0]
 if service.get('path')!='/'+STAGE or service.get('exit_allowed')!='yes' or service.get('reset_board')!='no':raise ValueError('unexpected startup service contract')
 deps={d.get('value') for d in service.findall('dependency')}
 if deps!={'stage_3','jciUSBMGR','emmc_mount'}:raise ValueError('startup dependency contract changed')
 return {'stage':STAGE,'config_sha256':CONFIG_SHA,'dependencies':sorted(deps),'service_reset_board':'no','service_exit_allowed':'yes','execution':'inferred from inspected sm.conf; not a native boot trace'}

@contextlib.contextmanager
def locked(lab):
 state=lab/'native-state'
 if not state.is_dir() or state.is_symlink():raise ValueError('native state missing')
 fd=os.open(state/'lock',os.O_RDWR|os.O_CREAT|os.O_NOFOLLOW,0o600)
 try:
  fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB);yield
 finally:os.close(fd)

def fault(where):
 if os.environ.get('CMU_BOOT_LAB_FAULT')==where:os.kill(os.getpid(),signal.SIGKILL)

def read_record(state):
 for name in ['record.json','record.sha256','original','patched','phase']:regular(state/name)
 raw=(state/'record.json').read_bytes()
 if len(raw)>16384 or sha(raw)!=(state/'record.sha256').read_text().strip():raise ValueError('damaged boot journal')
 record=json.loads(raw)
 if record.get('scope')!=STAGE or record.get('before_sha')!=ORIGINAL_SHA:raise ValueError('journal scope')
 if sha((state/'original').read_bytes())!=ORIGINAL_SHA or sha((state/'patched').read_bytes())!=record['after_sha']:raise ValueError('journal payload checksum')
 return record

def publish(target,data,meta):
 temp=target.with_name('.cmu-next-boot-stage')
 write_new(temp,data)
 os.chown(temp,meta['uid'],meta['gid']);os.chmod(temp,meta['mode']);os.utime(temp,ns=(temp.stat().st_atime_ns,meta['mtime_ns']))
 fd=os.open(temp,os.O_RDONLY|os.O_NOFOLLOW)
 try:os.fsync(fd)
 finally:os.close(fd)
 expected={**meta,'size':len(data)}
 if metadata(temp)!=expected:raise ValueError('staged metadata mismatch')
 os.replace(temp,target);syncdir(target.parent)

def operate(lab,action,entry=None):
 lab,root=labroot(lab)
 with locked(lab):
  startup=contract(root);target=walk(root,STAGE);regular(target);state=lab/'boot-hook-state'
  if state.is_symlink():raise ValueError('symlink journal')
  if action in ('plan','apply'):
   if entry is None:raise ValueError('explicit entry candidate required')
   entry=Path(entry);regular(entry)
   # Exact original bytes come from the known firmware source, not a reconstructed newline assumption.
   if not state.exists():
    original=target.read_bytes()
    if sha(original)!=ORIGINAL_SHA:raise ValueError('boot target modified')
    payload=make_hook(original,sha(entry.read_bytes()))
    record={'scope':STAGE,'before_sha':ORIGINAL_SHA,'after_sha':sha(payload),'metadata':metadata(target),'entry_sha':sha(entry.read_bytes()),'startup_contract':startup}
    if action=='plan':return {'action':'patch-one-copy-file','path':STAGE,'source_prefix_unchanged':payload.startswith(original),'record':record,'live_installation_ready':False}
    state.mkdir(mode=0o700);syncdir(lab)
    write_new(state/'original',original);write_new(state/'patched',payload)
    raw=(json.dumps(record,sort_keys=True,indent=2)+'\n').encode();write_new(state/'record.json',raw);write_new(state/'record.sha256',(sha(raw)+'\n').encode());phase(state,'prepared')
   else:
    record=read_record(state)
    if record['entry_sha']!=sha(entry.read_bytes()):raise ValueError('different entry requires restoration first')
    current=sha(target.read_bytes());status=(state/'phase').read_text().strip()
    if status=='installed' and current==record['after_sha'] and metadata(target)=={**record['metadata'],'size':len((state/'patched').read_bytes())}:return {'result':'already-installed','live_installation_ready':False}
    raise ValueError('existing journal requires restore/recovery')
   if sha(target.read_bytes())!=record['before_sha'] or metadata(target)!=record['metadata']:raise ValueError('target changed before publish')
   publish(target,(state/'patched').read_bytes(),record['metadata']);fault('after-publish');phase(state,'installed')
   return {'result':'installed-on-copy','changed_files':[STAGE],'live_installation_ready':False}
  if action in ('restore','recover'):
   record=read_record(state);current=sha(target.read_bytes());status=(state/'phase').read_text().strip()
   if status not in ('prepared','installed','restoring','restored'):raise ValueError('unknown journal phase')
   if current not in (record['before_sha'],record['after_sha']):raise ValueError('foreign boot file preserved')
   expected={**record['metadata'],'size':len((state/('original' if current==record['before_sha'] else 'patched')).read_bytes())}
   if metadata(target)!=expected:raise ValueError('foreign boot metadata preserved')
   if status=='restored' and current==record['before_sha']:return {'result':'already-restored','live_installation_ready':False}
   phase(state,'restoring');publish(target,(state/'original').read_bytes(),record['metadata']);fault('after-restore');phase(state,'restored')
   return {'result':'restored-on-copy','live_installation_ready':False}
  raise ValueError('unknown action')

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('action',choices=['plan','apply','restore','recover']);p.add_argument('--lab',required=True);p.add_argument('--entry');a=p.parse_args()
 try:print(json.dumps(operate(a.lab,a.action,a.entry),ensure_ascii=False,indent=2));return 0
 except (ValueError,OSError,ET.ParseError) as e:print(json.dumps({'error':str(e),'live_installation_ready':False}));return 2
if __name__=='__main__':raise SystemExit(main())
