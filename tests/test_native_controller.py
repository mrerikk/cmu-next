"""Controller refusal and ambiguous-ack behavior; no SSH or device access."""
from pathlib import Path
import importlib.util, unittest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('native_controller',ROOT/'tools/cmu-native-test.py')
driver=importlib.util.module_from_spec(spec);spec.loader.exec_module(driver)
class Fixture:
 def __init__(self,changes=None,history=None):
  self.calls=[];self.history=history or []
  self.status={'mode':'ram-lab','live_installation_ready':False,'accepting_actions':True,'session_seconds_remaining':850,'busy':False,'recovery_required':False,'backup_available':False}
  self.status.update(changes or {})
 def rpc(self,op,item='-',key=None):
  self.calls.append(op)
  if op=='status':return {'data':self.status}
  if op=='history':return {'data':{'jobs':self.history}}
  if op=='installed':return {'data':{'items':[]}}
  if op=='catalog':return {'data':{'items':[{'id':'connect2-layout'}]}}
  if op=='nonce':return {'data':{'key':'a'*32}}
  if op=='backup':raise driver.Refused('simulated lost acknowledgement')
  raise AssertionError('unexpected operation: '+op)
class NativeController(unittest.TestCase):
 def test_live_or_unmarked_target_never_receives_a_mutation(self):
  for change in [{'mode':'live'},{'live_installation_ready':True},{'mode':None}]:
   api=Fixture(change)
   with self.assertRaises(driver.Refused):driver.exercise(api,'connect2-layout')
   self.assertEqual(api.calls,['status'])
 def test_busy_recovery_old_checkpoint_and_short_session_are_refused(self):
  for change in [{'busy':True},{'recovery_required':True},{'backup_available':True},{'session_seconds_remaining':599},{'accepting_actions':False}]:
   api=Fixture(change)
   with self.assertRaises(driver.Refused):driver.exercise(api,'connect2-layout')
   self.assertNotIn('nonce',api.calls)
 def test_previous_history_is_not_overwritten_or_automatically_recovered(self):
  api=Fixture(history=[{'sequence':1}])
  with self.assertRaises(driver.Refused):driver.exercise(api,'connect2-layout')
  self.assertNotIn('nonce',api.calls)
 def test_lost_acknowledgement_is_not_retried_or_followed_by_install(self):
  api=Fixture()
  with self.assertRaises(driver.Refused):driver.exercise(api,'connect2-layout')
  self.assertEqual(api.calls.count('backup'),1);self.assertEqual(api.calls[-1],'backup')
  self.assertNotIn('install',api.calls);self.assertNotIn('rollback',api.calls)
 def test_invalid_package_is_refused_before_connection(self):
  api=Fixture()
  with self.assertRaises(driver.Refused):driver.exercise(api,'../../jci')
  self.assertEqual(api.calls,[])
if __name__=='__main__':unittest.main()
