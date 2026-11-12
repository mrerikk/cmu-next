"""Inspect real shell behavior on a firmware fixture; never start a host daemon."""
from pathlib import Path
import os, subprocess, tempfile, unittest
ROOT=Path(__file__).resolve().parents[1]
class SshService(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.fs=Path(self.tmp.name)
  (self.fs/'etc/ssh').mkdir(parents=True);(self.fs/'usr/sbin').mkdir(parents=True)
  self.config=self.fs/'etc/ssh/sshd_config'
  self.config.write_text('Port 36000\nPasswordAuthentication no\nPermitRootLogin yes\n')
  (self.fs/'etc/passwd').write_text('cmu:SECRET_HASH:0:0:cmu:/root:/bin/sh\n')
  daemon=self.fs/'usr/sbin/sshd';daemon.write_text('#!/bin/sh\necho unsafe-execution\nexit 99\n');daemon.chmod(0o755)
 def tearDown(self):self.tmp.cleanup()
 def run_service(self,mode='check'):
  return subprocess.run(['sh',str(ROOT/'src/ssh/start-ssh.sh'),mode,str(self.fs)],text=True,capture_output=True)
 def test_reports_stock_port_and_account_without_executing_daemon_or_disclosing_hash(self):
  before=self.config.read_bytes();p=self.run_service();self.assertEqual(p.returncode,0,p.stderr)
  self.assertIn('configured-port=36000',p.stdout);self.assertIn('root-login-name=cmu',p.stdout)
  self.assertIn('PasswordAuthentication no',p.stdout);self.assertNotIn('SECRET_HASH',p.stdout);self.assertNotIn('unsafe-execution',p.stdout)
  self.assertEqual(before,self.config.read_bytes())
 def test_inspection_accepts_nonexecutable_copied_binary(self):
  (self.fs/'usr/sbin/sshd').chmod(0o600);p=self.run_service();self.assertEqual(p.returncode,0,p.stderr)
  self.assertIn('configured-port=36000',p.stdout);self.assertNotEqual(self.run_service('start').returncode,0)
 def test_cannot_start_a_firmware_copy(self):
  p=self.run_service('start');self.assertNotEqual(p.returncode,0);self.assertNotIn('unsafe-execution',p.stdout)
 def test_missing_config_is_an_error_not_a_successful_enablement(self):
  self.config.unlink();p=self.run_service();self.assertNotEqual(p.returncode,0)
 def test_invalid_port_is_refused(self):
  self.config.write_text('Port bogus\n');self.assertNotEqual(self.run_service().returncode,0)
 def test_symlink_config_is_refused(self):
  self.config.unlink();self.config.symlink_to(self.fs/'etc/passwd');self.assertNotEqual(self.run_service().returncode,0)
 def test_no_port_uses_openssh_default(self):
  self.config.write_text('# Port 36000\n');p=self.run_service();self.assertEqual(p.returncode,0);self.assertIn('configured-port=22',p.stdout)
if __name__=='__main__':unittest.main()
