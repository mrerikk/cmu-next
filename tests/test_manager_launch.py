"""Real-process launch regression checks; no firmware or vehicle actions."""
from pathlib import Path
import os, re, shutil, signal, socket, subprocess, sys, tempfile, time, unittest
ROOT=Path(__file__).resolve().parents[1]

class ManagerLaunchTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  subprocess.run([sys.executable,str(ROOT/'tools/build-manager.py'),'--host'],check=True,stdout=subprocess.DEVNULL)
 def setUp(self):
  self.work=Path(tempfile.mkdtemp(prefix='cmu-manager.',dir=Path('/tmp').resolve()))
  self.work.chmod(0o700);(self.work/'marker').write_text('cmu-manager-ram-01\n')
  shutil.copy2(ROOT/'build/host/cmu-jobs',self.work/'cmu-jobs');self.service=None;self.terminal=None
  sock=socket.socket();sock.bind(('127.0.0.1',0));self.port=sock.getsockname()[1];sock.close()
 def tearDown(self):
  if self.service:
   try:os.kill(self.service,signal.SIGTERM)
   except ProcessLookupError:pass
  if self.terminal:
   try:os.killpg(self.terminal.pid,signal.SIGTERM)
   except ProcessLookupError:pass
   self.terminal.wait(timeout=5)
  time.sleep(0.1)
  shutil.rmtree(self.work)
 def command(self):return [str(ROOT/'build/host/cmu-manager'),'--launch',str(self.work),str(self.work),str(self.port),'30']
 def ready(self):
  until=time.monotonic()+5
  while time.monotonic()<until:
   try:
    text=(self.work/'client.js').read_text();pid=int((self.work/'service.pid').read_text())
    self.service=pid
    if f'process:{pid}' in text:
     check=subprocess.run([str(ROOT/'build/host/cmu-manager'),'--check',str(self.work),str(self.port)],capture_output=True)
     if check.returncode==0:return pid
   except (FileNotFoundError,ValueError):pass
   time.sleep(0.025)
  self.fail('readiness not published: '+(self.work/'service.log').read_text())
 def launch(self,**kwargs):
  with (self.work/'service.log').open('ab') as log:
   proc=subprocess.Popen(self.command(),stdin=subprocess.DEVNULL,stdout=log,stderr=log,**kwargs)
   self.assertEqual(proc.wait(timeout=3),0)
  return proc
 def test_process_group_leader_launch(self):
  launcher=self.launch(preexec_fn=os.setpgrp);pid=self.ready()
  self.assertNotEqual(pid,launcher.pid);self.assertEqual(os.getsid(pid),pid);self.assertEqual(os.getpgid(pid),pid)
 def test_session_leader_launch(self):
  launcher=self.launch(start_new_session=True);pid=self.ready()
  self.assertNotEqual(pid,launcher.pid);self.assertEqual(os.getsid(pid),pid)
 def test_terminal_group_exit_preserves_authenticated_service(self):
  script='import subprocess,time; subprocess.run('+repr(self.command())+',check=True); time.sleep(30)'
  with (self.work/'service.log').open('ab') as log:
   self.terminal=subprocess.Popen([sys.executable,'-c',script],start_new_session=True,stdin=subprocess.DEVNULL,stdout=log,stderr=log)
  pid=self.ready();os.killpg(self.terminal.pid,signal.SIGTERM);self.terminal.wait(timeout=3)
  os.kill(pid,0)
  check=subprocess.run([str(ROOT/'build/host/cmu-manager'),'--check',str(self.work),str(self.port)],capture_output=True)
  self.assertEqual(check.returncode,0,check.stderr)
 def test_session_bootstrap_publishes_child_and_can_resume(self):
  shutil.copy2(ROOT/'build/host/cmu-io',self.work/'cmu-io')
  shutil.copy2(ROOT/'build/host/cmu-manager',self.work/'cmu-manager')
  (self.work/'bootstrap-version').write_text('cmu-manager-bootstrap-034\n')
  (self.work/'package-path').write_text(str(self.work)+'\n')
  control=self.work/'control'
  session=self.work/'session.sh'
  session.write_text((ROOT/'src/manager/session.sh').read_text().replace('9970',str(self.port)))
  cmd=[str(self.work/'cmu-io'),'lock-run',str(self.work/'bootstrap.lock'),'/bin/sh',str(session),str(self.work),str(self.work),str(control)]
  result=subprocess.run(cmd,capture_output=True,text=True,timeout=15,start_new_session=True)
  self.assertEqual(result.returncode,0,result.stdout+result.stderr)
  pid=self.ready();self.assertIn('manager ready',result.stdout)
  self.assertIn(f'process:{pid}',(control/'client.js').read_text())
  again=subprocess.run(cmd,capture_output=True,text=True,timeout=15,start_new_session=True)
  self.assertEqual(again.returncode,0,again.stdout+again.stderr)
  self.assertEqual(int((self.work/'service.pid').read_text()),pid)
 def test_symlink_pid_is_refused_without_touching_target(self):
  target=self.work/'target';target.write_text('keep\n');(self.work/'service.pid').symlink_to(target)
  self.launch()
  # The lifecycle log names the real child even when readiness is refused.
  until=time.monotonic()+3
  while time.monotonic()<until:
   text=(self.work/'service.log').read_text();m=re.search(r'event=starting pid=(\d+)',text)
   if m:
    self.service=int(m.group(1))
    break
   time.sleep(0.025)
  self.assertIsNotNone(self.service)
  time.sleep(0.1)
  self.assertFalse((self.work/'client.js').exists());self.assertEqual(target.read_text(),'keep\n')

if __name__=='__main__':unittest.main()
