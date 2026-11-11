"""Reconstruct only the omitted OEM-derived index, using an owner-supplied original."""
from pathlib import Path
import argparse,hashlib,shutil
root=Path(__file__).resolve().parents[1]
sha=lambda b:hashlib.sha256(b).hexdigest()
def materialize(index,out):
 original=Path(index).read_bytes()
 if sha(original)!='b0e116b941f29078ced19b864a1b888cf76d8bc3e4974af081efca4693e5c420':raise ValueError('unexpected original index.html; expected 74.00.324A EU')
 addition=(root/'src/visual/index-bootstrap.html').read_bytes();needle=b'    </body>'
 if original.count(needle)!=1:raise ValueError('ambiguous insertion point')
 patched=original.replace(needle,addition+needle)
 if sha(patched)!='2912d866db80fbd4f9546f811b27b0acc78935ff38519849c35f6b386efc8ae5':raise ValueError('reconstructed index digest mismatch')
 out=Path(out)
 if out.exists():raise ValueError('output directory must not exist')
 shutil.copytree(root/'src/visual/module',out);(out/'payload/index.html').write_bytes(patched)
 entries=0
 for line in (out/'module.tsv').read_text().splitlines():
  if line.startswith('file '):
   fields=line.split();payload=out/fields[4]
   if sha(payload.read_bytes())!=fields[3]:raise ValueError('payload mismatch: '+fields[4])
   entries+=1
 if entries!=82:raise ValueError('expected 82 module targets')
 return out
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--firmware-index',required=True);parser.add_argument('--out',required=True);args=parser.parse_args()
 result=materialize(args.firmware_index,args.out);print('Reconstructed 82-target module:',result)
