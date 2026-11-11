"""Offline tests only: no network, CMU connection or SSH server changes."""
from pathlib import Path
import importlib.util, os, shutil, stat, subprocess, tempfile, unittest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('cmu_ssh',ROOT/'tools/cmu-ssh.py');ssh=importlib.util.module_from_spec(spec);spec.loader.exec_module(ssh)
class SshTransport(unittest.TestCase):
 def setUp(self):self.tmp=tempfile.TemporaryDirectory(prefix='cmu-ssh-test-');self.state=Path(self.tmp.name)/'connection'
 def tearDown(self):self.tmp.cleanup()
 def prepare(self):return ssh.prepare(self.state,'192.0.2.10','cmu',22)
 def test_private_config_is_idempotent_and_contains_no_password(self):
  state=self.prepare();self.assertEqual(self.prepare(),state);loaded,target=ssh.load_state(state)
  self.assertEqual(target,{'host':'192.0.2.10','user':'cmu','port':22});self.assertEqual(loaded,state);self.assertLess(len(os.fsencode(ssh.runtime_path(target))),100)
  self.assertEqual(stat.S_IMODE(state.stat().st_mode),0o700)
  for name in ['config','known_hosts','target.json']:self.assertEqual(stat.S_IMODE((state/name).stat().st_mode),0o600)
  text=(state/'config').read_text();self.assertIn('StrictHostKeyChecking ask',text);self.assertIn('ControlPersist 600',text);self.assertNotIn('Password ',text)
 def test_automation_enforces_known_host_and_noninteractive_authentication(self):
  cmd=ssh.command(self.prepare(),'probe');self.assertIn('BatchMode=yes',cmd);self.assertIn('StrictHostKeyChecking=yes',cmd);self.assertEqual(cmd[-2:],['cmu-test','sh -s'])
 def test_tunnel_binds_laptop_loopback_only(self):
  cmd=ssh.command(self.prepare(),'tunnel');self.assertIn('127.0.0.1:19970:127.0.0.1:9970',cmd);self.assertNotIn('-g',cmd)
  with self.assertRaises(ValueError):ssh.command(self.state,'tunnel',22)
 def test_input_cannot_inject_ssh_options_or_shell_commands(self):
  for host in ['-oProxyCommand=evil','host\nProxyCommand evil','host;evil','host%h','/tmp/socket']:
   with self.subTest(host=host),self.assertRaises(ValueError):ssh.target(host,'cmu',22)
  with self.assertRaises(ValueError):ssh.target('192.0.2.10','root\nProxyCommand evil',22)
  with self.assertRaises(ValueError):ssh.remote_script('check','sda1;evil')
 def test_changed_config_and_symlink_are_refused(self):
  state=self.prepare();(state/'config').write_text('Host *\n ProxyCommand evil\n')
  with self.assertRaises(ValueError):ssh.load_state(state)
  (state/'config').unlink();(state/'config').symlink_to(state/'target.json')
  with self.assertRaises(ValueError):ssh.load_state(state)
 def test_prepare_preserves_existing_known_host_and_refuses_target_change(self):
  state=self.prepare();(state/'known_hosts').write_text('stored-test-host-key\n');self.prepare()
  self.assertEqual((state/'known_hosts').read_text(),'stored-test-host-key\n')
  with self.assertRaises(ValueError):ssh.prepare(state,'192.0.2.11','cmu',22)
 def test_read_only_scripts_do_not_start_or_modify_services(self):
  probe=ssh.remote_script('probe');diagnose=ssh.remote_script('diagnose');check=ssh.remote_script('check','sdb1')
  self.assertIn('firmware-version-sha256',probe);self.assertIn('no files changed',diagnose);self.assertIn('/tmp/mnt/sdb1/cmu-manager/check.sh',check)
  for body in [probe,diagnose,check]:
   self.assertNotIn('start.sh',body);self.assertNotIn('authorized_keys',body);self.assertNotIn('remount',body)
 def test_installed_openssh_can_parse_generated_config_without_connecting(self):
  if not shutil.which('ssh'):self.skipTest('OpenSSH client unavailable')
  state=self.prepare();p=subprocess.run(['ssh','-G','-F',str(state/'config'),'cmu-test'],capture_output=True,text=True)
  self.assertEqual(p.returncode,0,p.stderr);self.assertIn('hostname 192.0.2.10',p.stdout);self.assertIn('user cmu',p.stdout)
  self.assertIn('forwardagent no',p.stdout)
if __name__=='__main__':unittest.main()
