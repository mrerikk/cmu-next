"""Portable transactions against synthetic regular-file firmware copies only."""
from pathlib import Path
import hashlib, os, shutil, stat, subprocess, sys, tempfile, unittest
ROOT=Path(__file__).resolve().parents[1]
def sha(data):return hashlib.sha256(data).hexdigest()
def snapshot(root):
 result={}
 for p in sorted(root.rglob('*')):
  s=p.lstat();name=p.relative_to(root).as_posix()
  if stat.S_ISREG(s.st_mode):result[name]=(p.read_bytes(),stat.S_IMODE(s.st_mode),s.st_uid,s.st_gid,s.st_mtime_ns)
  elif stat.S_ISDIR(s.st_mode):result[name]=('directory',stat.S_IMODE(s.st_mode))
  else:result[name]=('special',s.st_mode)
 return result
class EngineTransactions(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.build=tempfile.TemporaryDirectory(prefix='cmu-engine-tools-')
  cls.io=Path(cls.build.name)/'cmu-io'
  subprocess.run(['cc','-std=c99','-Wall','-Wextra','-Werror','-pedantic',str(ROOT/'src/engine/cmu-io.c'),'-o',str(cls.io)],check=True)
 @classmethod
 def tearDownClass(cls):cls.build.cleanup()
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory(prefix='cmu-engine-copy-');self.base=Path(self.temp.name)
  self.source=self.base/'source';(self.source/'jci/gui').mkdir(parents=True)
  (self.source/'jci/version.ini').write_bytes(b'synthetic-test-firmware\n')
  p=self.source/'jci/gui/screen.js';p.write_bytes(b'original screen\n');p.chmod(0o644);os.utime(p,ns=(1600000000000000000,1600000000000000000))
  self.original=snapshot(self.source);self.lab=self.base/'lab'
  subprocess.run([sys.executable,str(ROOT/'src/engine/init-lab.py'),'--source',str(self.source),'--lab',str(self.lab)],check=True,stdout=subprocess.DEVNULL)
  self.baseline=snapshot(self.lab/'rootfs');self.module=self.base/'module';(self.module/'payload').mkdir(parents=True)
  (self.module/'payload/screen.js').write_bytes(b'updated screen\n');(self.module/'payload/app.js').write_bytes(b'new app\n')
  self.table='\n'.join(['cmu-module-v2','engine 0.2','id synthetic-theme','version 1.0','firmware '+sha(b'synthetic-test-firmware\n'),'file jci/gui/screen.js '+sha(b'original screen\n')+' '+sha(b'updated screen\n')+' payload/screen.js 0644','file jci/gui/apps/demo/app.js absent '+sha(b'new app\n')+' payload/app.js 0755'])+'\n'
  (self.module/'module.tsv').write_text(self.table)
 def tearDown(self):
  self.assertEqual(snapshot(self.source),self.original,'source changed')
  self.temp.cleanup()
 def run_engine(self,action,arg=None,fault=None):
  env=os.environ.copy();env.pop('CMU_IO_LOCK_FD',None);env.pop('CMU_DEVICE_LAB_FAULT',None)
  if fault:env['CMU_DEVICE_LAB_FAULT']=fault
  return subprocess.run(['/bin/sh',str(ROOT/'src/engine/engine.sh'),str(self.io),str(self.lab),action,str(arg or self.module)],capture_output=True,text=True,env=env,timeout=20)
 def ok(self,action,arg=None,fault=None):
  r=self.run_engine(action,arg,fault);self.assertEqual(r.returncode,0,r.stdout+r.stderr);return r
 def test_plan_apply_idempotence_and_exact_rollback(self):
  self.ok('plan');self.assertEqual(snapshot(self.lab/'rootfs'),self.baseline)
  self.ok('apply');self.assertEqual((self.lab/'rootfs/jci/gui/screen.js').read_bytes(),b'updated screen\n')
  self.assertEqual(stat.S_IMODE((self.lab/'rootfs/jci/gui/apps/demo/app.js').stat().st_mode),0o755)
  again=self.ok('apply');self.assertIn('already-installed t000001',again.stdout)
  self.ok('restore','t000001');self.assertEqual(snapshot(self.lab/'rootfs'),self.baseline)
  self.assertIn('already-restored',self.ok('restore','t000001').stdout)
 def test_interrupted_install_recovers_every_publication_boundary(self):
  for fault in ['prepared','before-publish:1','after-publish:1','before-publish:2','after-publish:2']:
   with self.subTest(fault=fault):
    r=self.run_engine('apply',fault=fault);self.assertNotEqual(r.returncode,0)
    transactions=sorted((self.lab/'native-state/transactions').glob('t*'));tx=transactions[-1].name
    blocked=self.run_engine('apply');self.assertNotEqual(blocked.returncode,0);self.assertIn('recovery required',blocked.stderr)
    self.ok('recover',tx);self.assertEqual(snapshot(self.lab/'rootfs'),self.baseline)
 def test_interrupted_preparation_is_unpublished_and_retryable(self):
  for fault in ['preparing','staged-payload:1','staged-payload:2','staged-prepared']:
   with self.subTest(fault=fault):
    self.assertNotEqual(self.run_engine('apply',fault=fault).returncode,0)
    self.assertEqual(snapshot(self.lab/'rootfs'),self.baseline)
    self.assertEqual(self.ok('status').stdout.strip(),'')
    self.assertFalse(list((self.lab/'native-state/transactions').glob('t*')))
  staging=list((self.lab/'native-state/transactions').glob('.staging-*'))
  self.assertEqual(len(staging),4)
  installed=self.ok('apply');self.assertIn('installed t000005',installed.stdout)
  self.ok('restore','t000005');self.assertEqual(snapshot(self.lab/'rootfs'),self.baseline)
  self.assertEqual(len(list((self.lab/'native-state/transactions').glob('.staging-*'))),4)
 def test_interrupted_rollback_is_resumable(self):
  for fault in ['after-restore:2','before-restore:1','after-restore:1']:
   with self.subTest(fault=fault):
    self.ok('apply');tx=sorted((self.lab/'native-state/transactions').glob('t*'))[-1].name
    self.assertNotEqual(self.run_engine('restore',tx,fault).returncode,0)
    self.ok('recover',tx);self.assertEqual(snapshot(self.lab/'rootfs'),self.baseline)
 def test_external_change_blocks_restore_without_partial_write(self):
  self.ok('apply');(self.lab/'rootfs/jci/gui/screen.js').write_bytes(b'external edit\n');before=snapshot(self.lab/'rootfs')
  r=self.run_engine('restore','t000001');self.assertNotEqual(r.returncode,0);self.assertIn('external change',r.stderr)
  self.assertEqual(snapshot(self.lab/'rootfs'),before)
 def test_corrupt_backup_blocks_restore_without_partial_write(self):
  self.ok('apply');(self.lab/'native-state/transactions/t000001/backup-1').write_bytes(b'corrupt\n');before=snapshot(self.lab/'rootfs')
  r=self.run_engine('restore','t000001');self.assertNotEqual(r.returncode,0);self.assertIn('damaged backup',r.stderr)
  self.assertEqual(snapshot(self.lab/'rootfs'),before)
 def test_payload_tamper_blocks_before_transaction(self):
  (self.module/'payload/app.js').write_bytes(b'tampered\n');self.assertNotEqual(self.run_engine('apply').returncode,0)
  self.assertEqual(snapshot(self.lab/'rootfs'),self.baseline);self.assertFalse(list((self.lab/'native-state/transactions').iterdir()))
 def test_symlink_target_blocks_without_touching_outside_file(self):
  target=self.base/'outside';target.write_bytes(b'outside\n');p=self.lab/'rootfs/jci/gui/screen.js';p.unlink();p.symlink_to(target)
  self.assertNotEqual(self.run_engine('apply').returncode,0);self.assertEqual(target.read_bytes(),b'outside\n')
if __name__=='__main__':unittest.main()
