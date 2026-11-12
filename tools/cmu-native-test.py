"""Owner-invoked manager smoke test through a previously trusted SSH connection.

Default: read-only health inspection. --exercise-ram-copy permits a fresh-session
checkpoint/install/rollback/restore/report sequence on the marked manager copy.
No password storage, live firmware targets, crash injection or automatic retries.
"""
from pathlib import Path
import argparse, contextlib, http.client, importlib.util, json, os, re, socket, subprocess, tempfile, time
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('cmu_ssh',ROOT/'tools/cmu-ssh.py')
ssh=importlib.util.module_from_spec(spec);spec.loader.exec_module(ssh)

SESSION_SCRIPT=r'''set -eu
PATH=/bin:/sbin:/usr/bin:/usr/sbin
export PATH
[ "$(id -u)" = 0 ] || exit 2
control=/tmp/cmu-next-control
[ ! -L "$control" ] && [ -d "$control" ] || exit 2
[ "$(stat -c '%a %u' "$control")" = '700 0' ] || exit 2
plain(){ [ ! -L "$1" ] && [ -f "$1" ] && [ "$(stat -c '%h %u' "$1")" = '1 0' ]; }
plain "$control/marker" && [ "$(cat "$control/marker")" = cmu-manager-control-034 ] || exit 2
plain "$control/work-path.txt" || exit 2
work=$(cat "$control/work-path.txt")
case "$work" in *[!a-zA-Z0-9_./-]*) exit 2;; esac
[ "${work%/*}" = /tmp ] || exit 2
case "${work##*/}" in cmu-manager.*) ;; *) exit 2;; esac
[ ! -L "$work" ] && [ -d "$work" ] && [ "$(CDPATH= cd -P "$work" && pwd)" = "$work" ] || exit 2
[ "$(stat -c '%a %u' "$work")" = '700 0' ] || exit 2
awk '$2=="/tmp"{n++;fs=$3}END{exit n!=1||(fs!="tmpfs"&&fs!="ramfs")}' /proc/mounts || exit 2
plain "$work/marker" && [ "$(cat "$work/marker")" = cmu-manager-ram-01 ] || exit 2
plain "$work/bootstrap-version" && [ "$(cat "$work/bootstrap-version")" = cmu-manager-bootstrap-034 ] || exit 2
[ ! -L "$work/lab" ] && [ ! -L "$work/lab/rootfs" ] && [ -d "$work/lab/rootfs" ] || exit 2
plain "$work/lab/native-lab.txt" && [ "$(cat "$work/lab/native-lab.txt")" = cmu-native-lab-02 ] || exit 2
plain "$work/auth" && [ "$(stat -c '%a' "$work/auth")" = 600 ] || exit 2
# Sensitive stdout is captured only in laptop memory, never copied into reports.
cat "$work/auth"
printf '\n'
'''

class Refused(RuntimeError): pass

class Api:
 def __init__(self,port,token):
  if not isinstance(port,int) or not 1024<=port<=65535 or not re.fullmatch('[a-f0-9]{64}',token):raise Refused('invalid local connection')
  self.port=port;self.token=token;self.sequence=0
 def rpc(self,op,item='-',key=None):
  if op not in ['status','catalog','installed','history','nonce','job','backup','install','rollback','restore','report']:raise Refused('operation not allowed')
  if not re.fullmatch('[a-z0-9-]{1,64}',item):raise Refused('invalid item')
  if key is not None and not re.fullmatch('[a-f0-9]{32}',key):raise Refused('invalid request key')
  self.sequence+=1;rid='native'+str(self.sequence)
  query='token='+self.token+'&op='+op+'&id='+item+'&rid='+rid
  if key:query+='&key='+key
  c=http.client.HTTPConnection('127.0.0.1',self.port,timeout=8)
  try:
   c.request('GET','/api.js?'+query);r=c.getresponse();body=r.read(131073)
   if r.status!=200 or len(body)>131072:raise Refused('manager HTTP response refused')
   prefix=b'window.__cmuManagerReply('
   if not body.startswith(prefix) or not body.endswith(b');\n'):raise Refused('manager response framing refused')
   value=json.loads(body[len(prefix):-3])
   if not isinstance(value,dict) or value.get('request')!=rid or value.get('ok') is not True:raise Refused('manager refused request')
   return value
  except (OSError,http.client.HTTPException,ValueError):
   # In particular, never repeat a mutation after losing its acknowledgement.
   raise Refused('transport or response failure; action may have been accepted; inspect manager before continuing') from None
  finally:c.close()

def require(condition,message):
 if not condition:raise Refused(message)

def exercise(api,package,progress=None,min_seconds=780,job_timeout=120):
 require(bool(re.fullmatch('[a-z0-9-]{1,64}',package)),'invalid package')
 record={'context':'manager-ram-copy-smoke-test','native_hardware_validated':False,'steps':[]}
 def mark(name):
  record['steps'].append(name)
  if progress:progress(dict(record))
 status=api.rpc('status')['data']
 require(status.get('mode')=='ram-lab' and status.get('live_installation_ready') is False,'RAM-only manager required')
 require(status.get('accepting_actions') is True and isinstance(status.get('session_seconds_remaining'),int) and status['session_seconds_remaining']>=min_seconds,'fresh action window required')
 require(status.get('busy') is False and status.get('recovery_required') is False and status.get('backup_available') is False,'fresh idle session without checkpoint required')
 require(not api.rpc('history')['data']['jobs'] and not api.rpc('installed')['data']['items'],'existing work must be reviewed manually')
 require(any(x.get('id')==package for x in api.rpc('catalog')['data']['items']),'selected package not present')
 mark('fresh-ram-session-verified')
 def success(op,item='-'):
  key=api.rpc('nonce')['data']['key'];reply=api.rpc(op,item,key)
  receipt=reply['submission'];require(receipt.get('duplicate') is False,'unexpected previous request')
  sequence=receipt['job']['sequence'];require(type(sequence) is int and 1<=sequence<=999999,'invalid job receipt')
  job='j%06d'%sequence;deadline=time.monotonic()+job_timeout
  while time.monotonic()<deadline:
   state=api.rpc('job',job)['data']['job'];phase=state['phase']
   if phase in ['failed','interrupted']:raise Refused('job failed or interrupted; inspect journal; no automatic recovery attempted')
   if phase=='succeeded':mark(op+'-succeeded');return job,key
   time.sleep(0.1)
  raise Refused('job timeout; accepted work may still be running; inspect before continuing')
 success('backup');job,key=success('install',package)
 duplicate=api.rpc('install',package,key)['submission']
 require(duplicate.get('duplicate') is True and 'j%06d'%duplicate['job']['sequence']==job,'duplicate receipt mismatch')
 mark('duplicate-install-returned-same-job')
 installed=api.rpc('installed')['data']['items']
 require(len(installed)==1 and installed[0].get('name')==package and bool(re.fullmatch('t[0-9]{6}',installed[0].get('id',''))),'unexpected installed transaction')
 success('rollback',installed[0]['id'])
 require(not api.rpc('installed')['data']['items'],'rollback left installed transaction')
 success('restore');success('report')
 final=api.rpc('status')['data']
 require(final.get('busy') is False and final.get('recovery_required') is False,'final session needs review')
 mark('complete-no-live-firmware-write-requested')
 return record

def remote(state,script):
 result=subprocess.run(ssh.command(state,'probe'),input=script,text=True,capture_output=True,timeout=60)
 require(result.returncode==0,'SSH command failed; inspect device-side startup/check output separately')
 return result.stdout

@contextlib.contextmanager
def tunnel(state):
 with socket.socket() as sock:
  sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 with tempfile.TemporaryFile() as log:
  process=subprocess.Popen(ssh.command(state,'tunnel',port),stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=log)
  try:yield port,process
  finally:
   if process.poll() is None:
    process.terminate()
    try:process.wait(timeout=3)
    except subprocess.TimeoutExpired:process.kill();process.wait()

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--state',default='build/ssh/roadster');parser.add_argument('--partition',choices=['sda1','sdb1','sdc1','sdd1'],default='sda1')
 parser.add_argument('--start-manager',action='store_true');parser.add_argument('--exercise-ram-copy',action='store_true')
 parser.add_argument('--package',default='connect2-layout');parser.add_argument('--out',required=True)
 args=parser.parse_args();out=Path(args.out).absolute()
 # Exclusive private output; a failed/ambiguous run must not overwrite prior evidence.
 try:fd=os.open(out,os.O_CREAT|os.O_EXCL|os.O_WRONLY|os.O_NOFOLLOW,0o600)
 except OSError:
  print('Cannot create a new private summary. Choose an existing parent directory and unused filename.');return 2
 record={'context':'pending-native-ssh-run','steps':[],'complete':False}
 def save(value):
  record.update(value);os.lseek(fd,0,os.SEEK_SET);os.ftruncate(fd,0);os.write(fd,(json.dumps(record,indent=2)+'\n').encode());os.fsync(fd)
 try:
  save(record);state,_=ssh.load_state(args.state)
  if args.start_manager:remote(state,ssh.remote_script('start-manager',args.partition))
  token=remote(state,SESSION_SCRIPT).strip();require(bool(re.fullmatch('[a-f0-9]{64}',token)),'session descriptor refused')
  with tunnel(state) as (port,child):
   api=Api(port,token);deadline=time.monotonic()+10
   while True:
    require(child.poll() is None,'SSH forwarding client exited')
    try:status=api.rpc('status')['data'];break
    except Refused:
     if time.monotonic()>=deadline:raise
     time.sleep(0.1)
   require(status.get('mode')=='ram-lab' and status.get('live_installation_ready') is False,'RAM-only service required')
   save({'context':'native-ssh-transport','steps':['authenticated-ram-service-health-observed']})
   if args.exercise_ram_copy:save(exercise(api,args.package,save))
   save({'complete':True,'native_hardware_validated':False})
  print('Manager check completed; private summary: '+str(out));return 0
 except (Refused,OSError,subprocess.TimeoutExpired,KeyError,TypeError,ValueError) as error:
  reason=str(error) if isinstance(error,Refused) else 'connection, output or response schema failure'
  save({'complete':False,'failure':reason})
  print('Stopped. Private summary retained; do not repeat an uncertain action automatically.');return 2
 finally:os.close(fd)
if __name__=='__main__':raise SystemExit(main())
