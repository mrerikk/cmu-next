"""Prepare an isolated OpenSSH connection for owner-authorized CMU testing.

No passwords, private keys, server configuration or legacy SSH algorithms are installed.
"""
from pathlib import Path
import argparse, hashlib, ipaddress, json, os, re, shlex, stat, subprocess, sys
ROOT=Path(__file__).resolve().parents[1]

def target(host,user,port):
 if not isinstance(host,str) or not host or len(host)>253 or any(c in host for c in '\r\n\t %/\\[]'):raise ValueError('invalid host')
 try:ipaddress.ip_address(host)
 except ValueError:
  if not re.fullmatch(r'[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?',host) or '..' in host:raise ValueError('invalid host')
 if not re.fullmatch(r'[a-z_][a-z0-9_-]{0,31}',user):raise ValueError('invalid SSH login')
 if not isinstance(port,int) or not 1<=port<=65535:raise ValueError('invalid SSH port')
 return {'host':host,'user':user,'port':port}

def private_dir(path):
 if path.is_symlink():raise ValueError('symlink directory refused')
 path.mkdir(parents=True,mode=0o700,exist_ok=True)
 s=path.lstat()
 if not stat.S_ISDIR(s.st_mode) or s.st_uid!=os.getuid() or stat.S_IMODE(s.st_mode)!=0o700:raise ValueError('private directory ownership/mode refused')

def private_file(path):
 s=path.lstat()
 if not stat.S_ISREG(s.st_mode) or s.st_nlink!=1 or s.st_uid!=os.getuid() or stat.S_IMODE(s.st_mode)!=0o600:raise ValueError('private file ownership/mode refused')

def write_new_or_same(path,data,keep=False):
 if path.exists() or path.is_symlink():
  private_file(path)
  if not keep and path.read_text()!=data:raise ValueError('existing connection differs; choose another state directory')
  return
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 with os.fdopen(fd,'w') as f:f.write(data)

def quoted(path):
 value=str(path)
 if any(c in value for c in '\r\n\0%'):raise ValueError('unsupported SSH config path')
 return '"'+value.replace('\\','\\\\').replace('"','\\"')+'"'

def runtime_path(t):
 name=hashlib.sha256(json.dumps(t,sort_keys=True).encode()).hexdigest()[:24]
 return Path('/tmp').resolve()/('cmu-next-ssh-'+str(os.getuid()))/name

def config_text(state,t):
 return '\n'.join(['Host cmu-test','  HostName '+t['host'],'  User '+t['user'],'  Port '+str(t['port']),
  '  UserKnownHostsFile '+quoted(state/'known_hosts'),'  StrictHostKeyChecking ask',
  '  ControlMaster auto','  ControlPersist 600','  ControlPath '+quoted(runtime_path(t)),
  '  ConnectTimeout 8','  ServerAliveInterval 10','  ServerAliveCountMax 2',
  '  ForwardAgent no','  ForwardX11 no','  PermitLocalCommand no','  ExitOnForwardFailure yes',''])

def prepare(state,host,user,port):
 t=target(host,user,port);state=Path(state).absolute()
 if state.is_symlink():raise ValueError('symlink state directory refused')
 state=state.resolve();private_dir(state);private_dir(runtime_path(t).parent)
 write_new_or_same(state/'target.json',json.dumps(t,sort_keys=True,indent=2)+'\n')
 write_new_or_same(state/'known_hosts','',keep=True)
 write_new_or_same(state/'config',config_text(state,t))
 return state

def load_state(state):
 state=Path(state).absolute()
 if state.is_symlink():raise ValueError('symlink state directory refused')
 state=state.resolve();private_dir(state)
 for name in ['target.json','config','known_hosts']:private_file(state/name)
 raw=json.loads((state/'target.json').read_text())
 if set(raw)!={'host','user','port'}:raise ValueError('unexpected connection fields')
 t=target(**raw);private_dir(runtime_path(t).parent)
 if (state/'config').read_text()!=config_text(state,t):raise ValueError('connection config differs from generated settings')
 return state,t

def command(state,action,local_port=19970):
 args=['ssh','-F',str(state/'config')]
 if action=='connect':return args+['-T','cmu-test','true']
 args+=['-o','BatchMode=yes','-o','StrictHostKeyChecking=yes']
 if action=='tunnel':
  if not 1024<=local_port<=65535:raise ValueError('invalid local port')
  return args+['-N','-L','127.0.0.1:'+str(local_port)+':127.0.0.1:9970','cmu-test']
 if action=='disconnect':return args+['-O','exit','cmu-test']
 if action in ['probe','diagnose','check','start-manager']:return args+['-T','cmu-test','sh -s']
 raise ValueError('unknown connection action')

def remote_script(action,partition='sda1'):
 if not re.fullmatch(r'sd[a-d]1',partition):raise ValueError('invalid USB partition')
 if action=='probe':return (ROOT/'src/ssh/probe.sh').read_text()
 if action=='diagnose':return (ROOT/'src/diagnostics/diagnose.sh').read_text()
 if action=='start-manager':return 'set -eu\n[ "$(id -u)" = 0 ] || exit 2\np=/tmp/mnt/'+partition+'/cmu-manager/start.sh\n[ -f "$p" ] && [ ! -L "$p" ] || exit 2\nexec sh "$p"\n'
 if action=='check':return 'set -eu\np=/tmp/mnt/'+partition+'/cmu-manager/check.sh\n[ -f "$p" ] && [ ! -L "$p" ] || exit 2\nexec sh "$p"\n'
 raise ValueError('no remote script for this action')

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--state',default='build/ssh/roadster')
 sub=p.add_subparsers(dest='action',required=True);init=sub.add_parser('prepare');init.add_argument('--host',required=True);init.add_argument('--user',required=True);init.add_argument('--port',type=int,required=True)
 for name in ['connect','probe','diagnose','check','start-manager','tunnel','disconnect']:
  a=sub.add_parser(name)
  if name=='tunnel':a.add_argument('--local-port',type=int,default=19970)
  if name in ['check','start-manager']:a.add_argument('--partition',choices=['sda1','sdb1','sdc1','sdd1'],default='sda1')
 args=p.parse_args()
 try:
  if args.action=='prepare':
   state=prepare(args.state,args.host,args.user,args.port)
   print('Prepared local connection only; no CMU connection attempted.')
   print('First login in your own terminal (verify the CMU host-key fingerprint):')
   print(shlex.join(command(state,'connect')));return 0
  state,_=load_state(args.state);cmd=command(state,args.action,getattr(args,'local_port',19970))
  if args.action in ['probe','diagnose','check','start-manager']:
   result=subprocess.run(cmd,input=remote_script(args.action,getattr(args,'partition','sda1')),text=True,timeout=45)
  else:
   if args.action=='tunnel':print('Local tunnel: 127.0.0.1:'+str(args.local_port)+' -> CMU 127.0.0.1:9970; Ctrl-C closes this tunnel.',flush=True)
   result=subprocess.run(cmd)
  return result.returncode
 except (ValueError,OSError,subprocess.TimeoutExpired,json.JSONDecodeError) as e:
  print('SSH connection: '+str(e),file=sys.stderr);return 2
if __name__=='__main__':sys.exit(main())
