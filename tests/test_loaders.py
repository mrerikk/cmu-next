"""Host tests of the new loader container; these do not execute CMU payloads."""
from pathlib import Path
import importlib.util,tempfile,unittest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('loaders',ROOT/'tools/build-loaders.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Loaders(unittest.TestCase):
 def setUp(self):self.audio=m.load_audio()
 def test_all_four_paths_and_audio(self):
  for n,drive in enumerate('abcd',1):
   data=(ROOT/'src/loaders'/f'{n:02d}_sd{drive}1.mp3').read_bytes();frames=m.check_loader(data,drive,self.audio,n)
   self.assertEqual(frames['TPE1'],'cmu-next');self.assertIn('../../../mnt/sd'+drive+'1/js/run.js',frames['TIT2']);self.assertNotIn('http',frames['TIT2'])
 def test_deterministic_from_committed_own_carrier(self):
  with tempfile.TemporaryDirectory() as raw:
   first=Path(raw)/'first';second=Path(raw)/'second';m.write_bundle(first);m.write_bundle(second)
   self.assertEqual({p.name:p.read_bytes() for p in first.iterdir()},{p.name:p.read_bytes() for p in second.iterdir()})
 def test_drive_restriction(self):
  for value in ['','e','aa','../../','http://example.com']:
   with self.assertRaises(ValueError):m.title_for(value)
 def test_truncated_stream_is_refused(self):
  with self.assertRaises(ValueError):m.audio_info(self.audio[:-1])
 def test_changed_local_path_is_refused(self):
  data=(ROOT/'src/loaders/01_sda1.mp3').read_bytes().replace(b'sda1/js/run.js',b'sdz1/js/run.js')
  with self.assertRaises(ValueError):m.check_loader(data,'a',self.audio,1)
 def test_foreign_audio_tail_is_refused(self):
  data=(ROOT/'src/loaders/01_sda1.mp3').read_bytes()+b'TAGforeign-audio'
  with self.assertRaises(ValueError):m.check_loader(data,'a',self.audio,1)
 def test_invalid_id3_size_is_refused(self):
  data=bytearray((ROOT/'src/loaders/01_sda1.mp3').read_bytes());data[6]=128
  with self.assertRaises(ValueError):m.check_loader(bytes(data),'a',self.audio,1)
 def test_existing_output_is_not_overwritten(self):
  with tempfile.TemporaryDirectory() as raw:
   keep=Path(raw)/'keep';keep.write_text('unchanged')
   with self.assertRaises(ValueError):m.write_bundle(Path(raw))
   self.assertEqual(keep.read_text(),'unchanged')
if __name__=='__main__':unittest.main()
