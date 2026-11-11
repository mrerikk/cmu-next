"""Generate a bounded storage probe plan from preflight 0.2 observations; never installs."""
from pathlib import Path
import importlib.util,json,hashlib,argparse,stat
here=Path(__file__).resolve().parent
preflight=here/'dependencies/preflight' if (here/'dependencies/preflight').is_dir() else here.parent/'preflight'
def create(report,output,logical='/data_persist'):
 report=Path(report);output=Path(output)
 if report.is_symlink() or not stat.S_ISREG(report.stat().st_mode) or report.stat().st_size>2*1024*1024:raise ValueError('regular preflight report up to 2 MiB required')
 spec=importlib.util.spec_from_file_location('preflight_probe',preflight/'inspect-report.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
 expected=json.loads((preflight/'values.json').read_text());raw=report.read_bytes();analysis=m.inspect(raw.decode('utf-8'),expected)
 if not analysis['read_only_preflight_report_consistent']:raise ValueError('preflight report failed: '+', '.join(analysis['errors']))
 candidates=[c for c in analysis['persistent_candidates_for_next_bounded_test'] if c['logical']==logical]
 if len(candidates)!=1:raise ValueError('requested storage is not an eligible observed candidate')
 c=candidates[0]
 if (c['canonical'],c['source']) not in [('/tmp/mnt/data_persist','/dev/mmcblk0p2'),('/tmp/mnt/data','/dev/ffx01p4')]:raise ValueError('unsupported physical store')
 report_sha=hashlib.sha256(raw).hexdigest()
 plan=('cmu-storage-plan-v1\ncanonical '+c['canonical']+'\nsource '+c['source']+'\nfilesystem relfs\npreflight-sha256 '+report_sha+'\n').encode()
 output.mkdir(mode=0o700)
 (output/'plan.tsv').write_bytes(plan)
 (output/'analysis.json').write_text(json.dumps({'source_report_sha256':report_sha,'plan_sha256':hashlib.sha256(plan).hexdigest(),'storage':c,'boot_inputs':analysis['boot_inputs'],'scope':'observation-based plan for an exclusively created small probe directory; worker must revalidate mount/source/hash guards at runtime','actual_storage_write_proven':False,'live_installation_ready':False},ensure_ascii=False,indent=2)+'\n')
 return output/'plan.tsv'
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('report');p.add_argument('new_output_directory');p.add_argument('--storage',choices=['/data','/data_persist'],default='/data_persist');a=p.parse_args()
 try:print(create(a.report,a.new_output_directory,a.storage))
 except (ValueError,OSError,UnicodeError) as e:p.exit(2,str(e)+'\n')
