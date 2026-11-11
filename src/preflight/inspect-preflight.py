"""Inspect a read-only preflight report; never executes report text or authorizes installation."""
from pathlib import Path,PurePosixPath
import argparse,json,re,stat

def unescape(s):
 return re.sub(r'\\(040|011|012|134)',lambda m:chr(int(m[1],8)),s)

def parse_mountinfo(lines):
 rows=[];ids=set()
 for line in lines:
  a,b=line.split(' - ');left=a.split();right=b.split()
  if len(left)<6 or len(right)!=3:raise ValueError('invalid mount fields')
  ident=int(left[0]);int(left[1])
  if ident in ids or not re.fullmatch(r'\d+:\d+',left[2]):raise ValueError('duplicate mount or device format')
  ids.add(ident);root=unescape(left[3]);path=unescape(left[4])
  for p in [root,path]:
   if not validpath(p):raise ValueError('invalid mount path')
  opts=left[5].split(',');superopts=right[2].split(',')
  if len({'ro','rw'}&set(opts))!=1 or len({'ro','rw'}&set(superopts))!=1:raise ValueError('ambiguous mount mode')
  rows.append({'id':ident,'parent':int(left[1]),'device':left[2],'root':root,'path':path,'filesystem':right[0],'source':unescape(right[1]),'read_only':'ro' in opts or 'ro' in superopts,'options':opts,'super_options':superopts})
 if not rows:raise ValueError('missing mount topology')
 return rows

def validpath(p):
 return p.startswith('/') and (p=='/' or (not p.endswith('/') and '//' not in p)) and not any(c in ('.','..') for c in p.split('/')) and not any(ord(c)<32 for c in p)

def mount_at(rows,p):
 matching=[m for m in rows if m['path']=='/' or p==m['path'] or p.startswith(m['path'].rstrip('/')+'/')]
 if not matching:raise ValueError('missing backing mount: '+p)
 length=max(len(m['path']) for m in matching);best=[m for m in matching if len(m['path'])==length]
 if len(best)!=1:raise ValueError('ambiguous stacked backing mount: '+p)
 return dict(best[0])

def inspect(text,expected):
 errors=[];values={};sections={};spaces={};current=None;space=None;top=[]
 names=[a+'-'+b for a in ('mountinfo','targets','storage') for b in ('before','after')]
 storage_paths={'/jci/gui','/data','/data_persist','/resources','/tmp'}
 required={'cmu-live-preflight':'0.2','execution-context':'cmu-native','internal-writes':'none','storage-write-test':'not-performed','live-installation':'disabled','module-version':'0.8','module-files':'82','boot-input-files':'2','boot-modifications':'none','effective-uid':'0','native-helper-sha256':expected['io-sha'],'module-manifest-sha256':expected['manifest-sha'],'target-hashes-and-metadata-stable':'yes','storage-resolution-stable':'yes','mountinfo-stable':'yes','preflight-complete':'yes','worker-exit':'0'}
 if len(text.encode())>2*1024*1024:raise ValueError('report too large')
 for line in text.splitlines():
  if line.startswith('stop:') or line.startswith('starter-error='):errors.append('producer stopped')
  if line.endswith('-begin') and line[:-6] in names:
   n=line[:-6]
   if current or space or n in sections:errors.append('duplicate or nested section')
   current=n;sections.setdefault(n,[]);continue
  if line.endswith('-end') and line[:-4] in names:
   if current!=line[:-4]:errors.append('section end mismatch')
   current=None;continue
  if line.startswith('space-begin='):
   p=line.split('=',1)[1]
   if current or space or p in spaces or p not in storage_paths:errors.append('duplicate or invalid space section')
   space=p;spaces.setdefault(p,[]);continue
  if line.startswith('space-end='):
   if space!=line.split('=',1)[1]:errors.append('space end mismatch')
   space=None;continue
  if current:sections[current].append(line);continue
  if space:spaces[space].append(line);continue
  top.append(line)
  if '=' in line:
   k,v=line.split('=',1)
   if k in values:errors.append('duplicate top-level field '+k)
   values[k]=v
 if current or space:errors.append('unclosed section')
 for k,v in required.items():
  if values.get(k)!=v:errors.append('missing or incorrect '+k)
 if values.get('temporary-backing-filesystem') not in ('tmpfs','ramfs'):errors.append('non-memory work')
 if not re.search(r'^kernel:\nLinux\b[^\n]*\b3\.0\.35\b[^\n]*\barmv7l\b','\n'.join(top),re.M):errors.append('native kernel context missing')
 for n in names:
  if not sections.get(n):errors.append('missing section '+n)
 for kind in ['mountinfo','targets','storage']:
  if sections.get(kind+'-before')!=sections.get(kind+'-after'):errors.append('changed '+kind)
 targets={};storages={};candidates=[];target_mounts={}
 try:
  rows=parse_mountinfo(sections.get('mountinfo-before',[]))
  for line in sections.get('targets-before',[]):
   parts=line.split('|')
   if len(parts)!=8 or parts[0]!='target':raise ValueError('invalid target record')
   _,logical,state,real,anchor,digest,meta,ameta=parts
   if logical in targets or logical not in expected['target_expectations']:raise ValueError('duplicate/unknown target')
   want=expected['target_expectations'][logical]
   if real!=logical or not validpath(anchor) or not real.startswith(anchor.rstrip('/')+'/') or not anchor.startswith('/jci'):raise ValueError('unexpected canonical target or anchor')
   if not re.fullmatch(r'[0-7]{3,4} \d+ \d+ \d+ \d+',ameta):raise ValueError('invalid anchor metadata')
   if want=='absent':
    if (state,digest,meta)!=('absent','absent','absent'):raise ValueError('target already exists')
   elif state!='file' or digest!=want or not re.fullmatch(r'[0-7]{4} \d+ \d+ -?\d+ \d+ \d+',meta):raise ValueError('source hash or metadata mismatch')
   mount=mount_at(rows,real);parent_mount=mount_at(rows,anchor)
   if mount['id']!=parent_mount['id']:raise ValueError('target and parent mount differ')
   if mount['filesystem'] in ('tmpfs','ramfs'):raise ValueError('target unexpectedly memory backed')
   targets[logical]={'canonical':real,'anchor':anchor,'state':state,'sha256':digest,'metadata':meta,'anchor_metadata':ameta,'mount_id':mount['id']}
   target_mounts[str(mount['id'])]=mount
  if set(targets)!=set(expected['target_expectations']):raise ValueError('target coverage incomplete')
  for line in sections.get('storage-before',[]):
   parts=line.split('|')
   if len(parts)!=5 or parts[0]!='storage':raise ValueError('invalid storage record')
   _,logical,real,meta,namespace=parts
   if logical not in storage_paths or logical in storages or not validpath(real):raise ValueError('unknown/duplicate storage or canonical path')
   if not re.fullmatch(r'[0-7]{3,4} \d+ \d+ \d+ \d+',meta) or namespace not in ('absent','directory','symlink','other'):raise ValueError('invalid storage metadata')
   mount=mount_at(rows,real)
   data=spaces.get(logical,[])
   if not data or not data[0].startswith('Filesystem'):raise ValueError('missing space header')
   fields=' '.join(data[1:]).split()
   if len(fields)!=6 or any(not v.isdigit() for v in fields[1:4]) or not re.fullmatch(r'\d+%',fields[4]):raise ValueError('ambiguous space data')
   total,used,available=map(int,fields[1:4]);dfmount=unescape(fields[5]);dfsource=unescape(fields[0])
   if dfmount!=mount['path'] or (dfsource!=mount['source'] and not (dfsource=='rootfs' and mount['path']=='/')):raise ValueError('space and mount identity disagree')
   if min(total,used,available)<0 or total<max(used,available):raise ValueError('invalid space values')
   storages[logical]={'canonical':real,'metadata':meta,'cmu_next_namespace':namespace,'mount':mount,'available_kib':available}
   # Observation only: a candidate is not a writable/journal-tested/boot-tested destination.
   if logical in ('/data','/data_persist') and mount['filesystem']=='relfs' and not mount['read_only'] and mount['source'].startswith('/dev/') and available>=8192 and namespace=='absent' and real in ('/tmp/mnt/data','/tmp/mnt/data_persist') and mount['path']==real and mount['root']=='/' and str(mount['id']) not in target_mounts:
    candidates.append({'logical':logical,'canonical':real,'mount_id':mount['id'],'source':mount['source'],'available_kib':available,'storage_write_metadata_fsync_test':'not performed'})
  if set(storages)!=storage_paths or set(spaces)!=storage_paths:raise ValueError('storage coverage incomplete')
  if storages['/tmp']['mount']['filesystem'] not in ('tmpfs','ramfs'):raise ValueError('resolved /tmp is not memory')
  if storages['/jci/gui']['canonical']!='/jci/gui':raise ValueError('unexpected GUI canonical path')
 except (ValueError,IndexError) as e:errors.append(str(e))
 ok=not errors
 return {'read_only_preflight_report_consistent':ok,'errors':errors,'target_count':len(targets),'target_mounts':target_mounts,'resolved_storage':storages,'persistent_candidates_for_next_bounded_test':candidates if ok else [],'live_installation_ready':False,'live_writes_enabled':False,'next_step':'bounded persistent journal and backup test in an exclusively created project directory; then live wrapper and visual/equipment checks' if ok else 'resolve report failures before proceeding','boot_inputs':{p:targets.get('/'+p) for p in expected['boot_inputs']},'native_boot_trace_verified':False,'scope':'reported observation only; no persistent write/fsync/metadata recovery, reboot, visual or equipment proof; original state must be rechecked immediately before any installation'}

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('report');p.add_argument('--expected',default=str(Path(__file__).with_name('values.json')));a=p.parse_args();report=Path(a.report)
 if report.is_symlink() or not stat.S_ISREG(report.stat().st_mode) or report.stat().st_size>2*1024*1024:p.error('expected regular report up to 2 MiB')
 r=inspect(report.read_text(),json.loads(Path(a.expected).read_text()));print(json.dumps(r,ensure_ascii=False,indent=2));return 0 if r['read_only_preflight_report_consistent'] else 2
if __name__=='__main__':raise SystemExit(main())
