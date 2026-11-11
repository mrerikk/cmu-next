"""Build native tools; optionally assemble the 0.3.3 USB candidate."""
from pathlib import Path
import argparse,subprocess,hashlib,json,shutil,importlib.util
root=Path(__file__).resolve().parents[1];source=root/'src/manager';engine=root/'src/engine'
parser=argparse.ArgumentParser(description=__doc__);target=parser.add_mutually_exclusive_group(required=True);target.add_argument('--host',action='store_true');target.add_argument('--arm',action='store_true');parser.add_argument('--zig');parser.add_argument('--firmware-index');args=parser.parse_args()
out=root/'build'/('arm' if args.arm else 'host');out.mkdir(parents=True,exist_ok=True)
if args.arm and not args.zig:parser.error('--arm requires --zig pointing to Zig 0.15.2')
if args.arm and subprocess.check_output([args.zig,'version'],text=True).strip()!='0.15.2':parser.error('Zig 0.15.2 is required for the recorded target')
compiler=([args.zig,'cc','-target','arm-linux.3.0.35-musleabi','-mcpu=arm1176jz_s','-D_FILE_OFFSET_BITS=64','-static'] if args.arm else ['cc'])
for src,name in [(source/'server.c','cmu-manager'),(source/'jobs.c','cmu-jobs'),(engine/'cmu-io.c','cmu-io')]:
 subprocess.run(compiler+['-std=c99','-Wall','-Wextra','-Werror','-pedantic','-Os',str(src),'-o',str(out/name)],check=True)
(out/'run.js').write_text((source/'ui.js').read_text().replace("'@@css@@'",json.dumps((source/'ui.css').read_text(),ensure_ascii=False)))
if args.firmware_index:
 if not args.arm:parser.error('USB assembly requires --arm; host binaries must not be copied to a CMU')
 usb=out/'usb'
 if usb.exists():raise ValueError('USB output exists; move it aside before building another candidate')
 package=usb/'cmu-manager';package.mkdir(parents=True)
 spec=importlib.util.spec_from_file_location('visual',root/'tools/materialize-module.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
 m.materialize(args.firmware_index,package/'packages/connect2-layout/module')
 (package/'packages/connect2-layout/package.tsv').write_text('cmu-package-v1\nname Connect 2 — оформление\nversion 0.8\nkind theme\n')
 pins=json.loads((source/'pins.json').read_text());sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
 for name in ['cmu-manager','cmu-jobs','cmu-io']:shutil.copyfile(out/name,package/name);(package/name).chmod(0o700)
 for name,origin in [('engine.sh',engine/'engine.sh'),('prepare-usb.sh',source/'prepare-usb.sh'),('session.sh',source/'session.sh'),('preflight.sh',source/'preflight.sh'),('preflight-module.tsv',source/'preflight-module.tsv')]:shutil.copyfile(origin,package/name)
 pins.update({'io-sha':sha(package/'cmu-io'),'io-md5':hashlib.md5((package/'cmu-io').read_bytes()).hexdigest(),'server-sha':sha(package/'cmu-manager'),'jobs-sha':sha(package/'cmu-jobs'),'engine-sha':sha(package/'engine.sh'),'session-sha':sha(package/'session.sh'),'prepare-sha':sha(package/'prepare-usb.sh'),'preflight-sha':sha(package/'preflight.sh')})
 def fill(text):
  for key,value in pins.items():
   if isinstance(value,str):text=text.replace('@@'+key+'@@',value)
  if '@@' in text:raise ValueError('unresolved build placeholder')
  return text
 (package/'dispatch.sh').write_text(fill((source/'dispatch.sh').read_text()));pins['dispatch-sha']=sha(package/'dispatch.sh')
 (package/'check.sh').write_text(fill((source/'check.sh').read_text()));pins['check-sha']=sha(package/'check.sh')
 (package/'start.sh').write_text(fill((source/'start.sh').read_text()))
 (usb/'js').mkdir();shutil.copyfile(out/'run.js',usb/'js/run.js');(usb/'mp3').mkdir();[shutil.copyfile(p,usb/'mp3'/p.name) for p in sorted((root/'src/loaders').glob('*.mp3'))]
 shutil.copyfile(root/'src/diagnostics/diagnose.sh',package/'diagnose.sh')
 (out/'build-pins.json').write_text(json.dumps(pins,indent=2)+'\n')
 print('Built manager 0.3.3 candidate; native CMU validation pending:',usb)
else:print('Built tools and UI at',out,'; no firmware or vehicle state accessed')
