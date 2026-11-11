"""Application lifecycle core checks; no native host bridge or speed source is implied."""
from pathlib import Path
import shutil,subprocess,unittest
class AppRuntime(unittest.TestCase):
 def test_owned_resources_input_and_speed_validity(self):
  node=shutil.which('node')
  if not node:self.skipTest('Node.js unavailable')
  r=subprocess.run([node,str(Path(__file__).with_suffix('.cjs'))],capture_output=True,text=True,timeout=15)
  self.assertEqual(r.returncode,0,r.stdout+r.stderr)
  self.assertIn('"lifecycle_groups_passed":8',r.stdout)
if __name__=='__main__':unittest.main()
