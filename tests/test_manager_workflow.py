"""Real HTTP/journal/engine workflow on a synthetic copy, with explicit host-only device fixtures."""
from pathlib import Path
import importlib.util
import hashlib, http.client, json, os, shutil, signal, socket, subprocess, sys, tempfile, time, unittest
ROOT=Path(__file__).resolve().parents[1]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def files(root):
 return {str(p.relative_to(root)):(p.read_bytes(),p.stat().st_mode&0o777,p.stat().st_uid,p.stat().st_gid,p.stat().st_mtime_ns) for p in root.rglob('*') if p.is_file()}
class ManagerWorkflow(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  subprocess.run([sys.executable,str(ROOT/'tools/build-manager.py'),'--host'],check=True,stdout=subprocess.DEVNULL)
 def setUp(self):
  self.work=Path(tempfile.mkdtemp(prefix='cmu-manager.',dir=Path('/tmp').resolve()));self.work.chmod(0o700);self.pid=None
  (self.work/'marker').write_text('cmu-manager-ram-01\n');self.lab=self.work/'lab';(self.lab/'native-state/transactions').mkdir(parents=True)
  (self.lab/'native-lab.txt').write_text('cmu-native-lab-02\n');self.root=self.lab/'rootfs';(self.root/'jci/gui/common/images').mkdir(parents=True);(self.root/'jci/gui/common/css').mkdir()
  for rel,data in [('jci/version.ini',b'synthetic firmware\n'),('jci/gui/index.html',b'synthetic index\n'),('jci/gui/common/images/background.png',b'synthetic background\n'),('jci/gui/common/css/common.css',b'synthetic css\n')]:
   p=self.root/rel;p.write_bytes(data);p.chmod(0o644);os.utime(p,ns=(1600000000000000000,1600000000000000000))
  self.original=files(self.root);self.pack=self.work/'usb/sda1/cmu-manager';self.module=self.pack/'packages/synthetic-theme/module';(self.module/'payload').mkdir(parents=True)
  (self.module/'payload/index.html').write_bytes(b'synthetic replacement\n');(self.module/'payload/app.js').write_bytes(b'synthetic new app\n')
  (self.module/'module.tsv').write_text('cmu-module-v2\nengine 0.2\nid synthetic-theme\nversion 1.0\nfirmware '+sha(self.root/'jci/version.ini')+'\nfile jci/gui/index.html '+sha(self.root/'jci/gui/index.html')+' '+sha(self.module/'payload/index.html')+' payload/index.html 0644\nfile jci/gui/apps/synthetic/app.js absent '+sha(self.module/'payload/app.js')+' payload/app.js 0644\n')
  (self.module.parent/'package.tsv').write_text('cmu-package-v1\nname Synthetic theme\nversion 1.0\nkind theme\n')
  for name in ['cmu-manager','cmu-jobs','cmu-io']:shutil.copy2(ROOT/'build/host'/name,self.work/name)
  shutil.copy2(ROOT/'src/engine/engine.sh',self.work/'engine.sh')
  # Only device observations/export mount preparation are substituted. Real dispatcher,
  # HTTP service, journal, transaction coordinator and native file I/O run unchanged.
  (self.work/'mounts').write_text('none / tmpfs rw 0 0\n');(self.work/'uptime').write_text('123.45 99.00\n')
  (self.work/'preflight.sh').write_text('#!/bin/sh\necho execution-context=synthetic-host-fixture\necho live-installation-ready=no\n')
  (self.work/'preflight-module.tsv').write_text('synthetic-host-preflight-manifest\n')
  (self.work/'prepare-usb.sh').write_text('#!/bin/sh\n[ "$1" = "'+str(self.pack.parent)+'" ] || exit 2\necho USB_PREPARE=host-fixture\n')
  (self.work/'startup.txt').write_text('execution-context=synthetic-host-fixture\n')
  dispatch=(ROOT/'src/manager/dispatch.sh').read_text().replace('/proc/mounts',str(self.work/'mounts')).replace('/proc/uptime',str(self.work/'uptime')).replace('/tmp/mnt/sd[a-d]1',str(self.work)+'/usb/sd[a-d]1').replace('@@preflight-sha@@',sha(self.work/'preflight.sh')).replace('@@manifest-sha@@',sha(self.work/'preflight-module.tsv'))
  dispatch=dispatch.replace('work=$1;packages=$2;action=$3;item=$4','work=$1;packages=$2;action=$3;item=$4\nif [ -f "$work/fault" ];then CMU_DEVICE_LAB_FAULT=$(cat "$work/fault");export CMU_DEVICE_LAB_FAULT;fi')
  (self.work/'dispatch.sh').write_text(dispatch)
  with socket.socket() as sock:sock.bind(('127.0.0.1',0));self.port=sock.getsockname()[1]
  with (self.work/'service.log').open('ab') as log:
   subprocess.run([str(self.work/'cmu-manager'),'--launch',str(self.work),str(self.pack),str(self.port),'30'],check=True,stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True)
  until=time.monotonic()+5
  while time.monotonic()<until:
   if (self.work/'client.js').exists():
    self.pid=int((self.work/'service.pid').read_text());self.token=(self.work/'auth').read_text();break
   time.sleep(0.02)
  self.assertIsNotNone(self.pid,'service did not publish readiness')
 def tearDown(self):
  if self.pid:
   try:os.kill(self.pid,signal.SIGTERM)
   except ProcessLookupError:pass
  # Only runners belonging to this private synthetic workspace are terminated.
  for p in (self.work/'jobs').glob('j*/runner.pid'):
   try:os.killpg(int(p.read_text()),signal.SIGTERM)
   except ProcessLookupError:pass
  time.sleep(0.1);shutil.rmtree(self.work)
 def rpc(self,op,item='-',key=None,token=None):
  query='token='+(self.token if token is None else token)+'&op='+op+'&id='+item+'&rid=test'
  if key:query+='&key='+key
  c=http.client.HTTPConnection('127.0.0.1',self.port,timeout=5)
  try:
   c.request('GET','/api.js?'+query);r=c.getresponse();body=r.read().decode()
   if r.status!=200:return {'http_status':r.status}
   self.assertTrue(body.startswith('window.__cmuManagerReply('));return json.loads(body[len('window.__cmuManagerReply('):-3])
  finally:c.close()
 def submit(self,op,item='-',key=None):
  key=key or self.rpc('nonce')['data']['key'];r=self.rpc(op,item,key);self.assertTrue(r['ok'],r)
  return 'j%06d'%r['submission']['job']['sequence'],key,r['submission']['duplicate']
 def wait_job(self,job):
  until=time.monotonic()+12
  while time.monotonic()<until:
   r=self.rpc('job',job);self.assertTrue(r['ok'],r);data=r['data']['job'];data['log']=r['data']['log']
   if data['phase'] in ['succeeded','failed','interrupted']:return data
   time.sleep(0.025)
  self.fail('job did not finish')
 def success(self,op,item='-'):
  job,key,_=self.submit(op,item);result=self.wait_job(job);self.assertEqual(result['phase'],'succeeded',result);return job,key,result
 def test_backup_install_duplicate_rollback_restore_and_report(self):
  self.assertEqual(self.rpc('catalog')['data']['items'][0]['id'],'synthetic-theme')
  self.success('backup');self.assertTrue((self.work/'checkpoint/complete').exists())
  job,key,_=self.success('install','synthetic-theme')
  duplicate=self.rpc('install','synthetic-theme',key)['submission'];self.assertTrue(duplicate['duplicate']);self.assertEqual('j%06d'%duplicate['job']['sequence'],job)
  self.assertEqual(self.rpc('installed')['data']['items'][0]['id'],'t000001')
  self.assertEqual((self.root/'jci/gui/index.html').read_bytes(),b'synthetic replacement\n')
  self.success('rollback','t000001');self.assertEqual(files(self.root),self.original)
  self.success('restore');self.assertEqual(files(self.root),self.original)
  self.success('report');dest=self.pack.parent/'cmu-manager-report-1';self.assertTrue((dest/'report.txt').exists());self.assertTrue((dest/'preflight.txt').exists())
  report=(dest/'report.txt').read_text();self.assertIn('report-collected=yes',report);self.assertIn('manager-version=0.3.4',report);self.assertIn('execution-context=synthetic-host-fixture',report)
  self.assertNotIn(self.token,report);self.assertIn(sha(dest/'preflight.txt'),report)
 def test_native_controller_exercises_real_http_copy_and_preserves_original_files(self):
  spec=importlib.util.spec_from_file_location('native_test',ROOT/'tools/cmu-native-test.py');driver=importlib.util.module_from_spec(spec);spec.loader.exec_module(driver)
  api=driver.Api(self.port,self.token);report=driver.exercise(api,'synthetic-theme',min_seconds=0,job_timeout=12)
  self.assertIn('complete-no-live-firmware-write-requested',report['steps']);self.assertNotIn(self.token,json.dumps(report))
  self.assertEqual(files(self.root),self.original)
  with self.assertRaises(driver.Refused):driver.exercise(api,'synthetic-theme',min_seconds=0)
 def test_failed_install_requires_recovery_then_restores_originals(self):
  (self.work/'fault').write_text('after-publish:1')
  job,key,_=self.submit('install','synthetic-theme');result=self.wait_job(job)
  self.assertEqual(result['phase'],'failed',result)
  self.assertEqual((self.root/'jci/gui/index.html').read_bytes(),b'synthetic replacement\n')
  self.assertTrue(self.rpc('status')['data']['recovery_required'])
  nonce=self.rpc('nonce')['data']['key'];self.assertFalse(self.rpc('backup',key=nonce)['ok'])
  (self.work/'fault').unlink();self.success('recover')
  self.assertFalse(self.rpc('status')['data']['recovery_required']);self.assertEqual(files(self.root),self.original)
 def test_interrupted_preparation_recovers_without_incomplete_transaction(self):
  (self.work/'fault').write_text('preparing')
  job,key,_=self.submit('install','synthetic-theme');self.assertEqual(self.wait_job(job)['phase'],'failed')
  self.assertEqual(files(self.root),self.original)
  (self.work/'fault').unlink();self.success('recover')
  self.assertFalse(self.rpc('status')['data']['recovery_required'])
  self.success('install','synthetic-theme')
 def test_service_restart_preserves_request_identity_and_transaction(self):
  job,key,_=self.success('install','synthetic-theme');oldpid=self.pid;token=self.token
  os.kill(oldpid,signal.SIGTERM)
  until=time.monotonic()+5
  while time.monotonic()<until:
   try:self.rpc('status')
   except (OSError,http.client.HTTPException):break
   time.sleep(0.025)
  with (self.work/'service.log').open('ab') as log:
   subprocess.run([str(self.work/'cmu-manager'),'--launch',str(self.work),str(self.pack),str(self.port),'30'],check=True,stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True)
  until=time.monotonic()+5
  while time.monotonic()<until:
   pid=int((self.work/'service.pid').read_text())
   if pid!=oldpid and f'process:{pid}' in (self.work/'client.js').read_text():self.pid=pid;break
   time.sleep(0.025)
  self.assertNotEqual(self.pid,oldpid);self.assertEqual((self.work/'auth').read_text(),token)
  duplicate=self.rpc('install','synthetic-theme',key)['submission']
  self.assertTrue(duplicate['duplicate']);self.assertEqual('j%06d'%duplicate['job']['sequence'],job)
  self.assertEqual(len(list((self.lab/'native-state/transactions').glob('t*'))),1)
  self.assertEqual(len(self.rpc('history')['data']['jobs']),1)
 def test_invalid_token_and_conflicting_request_key_cannot_mutate(self):
  self.assertEqual(self.rpc('backup',key='1'*32,token='0'*64),{'http_status':403})
  self.assertFalse((self.work/'checkpoint').exists());job,key,_=self.success('backup')
  self.assertFalse(self.rpc('install','synthetic-theme',key)['ok']);self.assertEqual(files(self.root),self.original)
if __name__=='__main__':unittest.main()
