"""Run public settings-adapter fixtures without OEM firmware or browser dependencies."""
from pathlib import Path
import shutil, subprocess, unittest
class VisualCategories(unittest.TestCase):
 def test_synthetic_equipment_variants_and_native_delegation(self):
  node=shutil.which('node')
  if not node:self.skipTest('Node.js unavailable')
  result=subprocess.run([node,str(Path(__file__).with_name('test_settings_categories.cjs'))],capture_output=True,text=True,timeout=15)
  self.assertEqual(result.returncode,0,result.stdout+result.stderr)
  self.assertIn('"synthetic_groups_passed":8',result.stdout)
if __name__=='__main__':unittest.main()
