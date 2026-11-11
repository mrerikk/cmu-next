"""Build project-authored ID3 loaders around a locally synthesized silent stream.

SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
The generator never reads a legacy MP3, downloads a carrier, or runs its payload.
"""
from pathlib import Path
import argparse,base64,hashlib,importlib.metadata,json,struct
ROOT=Path(__file__).resolve().parents[1]
RATE=8000
SECONDS=5
DRIVES='abcd'
VERSION='1.0.0'

def digest(data):return hashlib.sha256(data).hexdigest()

def title_for(drive):
 if drive not in DRIVES or len(drive)!=1:raise ValueError('only USB partitions sda1 through sdd1 are supported')
 # Keep the existing CMU title-rendering entry point and local USB path.
 # This is an ID3/HTML injection PoC, not an ordinary music track.
 return '</span><iframe onload="utility.loadScript(\'../../../mnt/sd'+drive+'1/js/run.js\')"></iframe><span>'

def synchsafe(value):
 if not 0<=value<2**28:raise ValueError('ID3 tag length out of range')
 return bytes((value>>21&127,value>>14&127,value>>7&127,value&127))

def text_frame(name,value):
 if len(name)!=4 or not name.isascii() or not name.isalnum() or name.upper()!=name:raise ValueError('invalid ID3 frame name')
 body=b'\x00'+value.encode('ascii')
 return name.encode('ascii')+struct.pack('>I',len(body))+b'\x00\x00'+body

def audio_info(data):
 # This parser only accepts the fixed MPEG 2.5 Layer III mono profile generated below.
 pos=0;frames=0
 while pos<len(data):
  if pos+4>len(data):raise ValueError('truncated MPEG header')
  head=int.from_bytes(data[pos:pos+4],'big')
  if head>>21!=0x7ff or (head>>19&3)!=0 or (head>>17&3)!=1:raise ValueError('unexpected MPEG version/layer')
  if (head>>12&15)!=1 or (head>>10&3)!=2 or (head>>6&3)!=3:raise ValueError('expected 8 kbps, 8 kHz, mono')
  length=72+(head>>9&1)
  if pos+length>len(data):raise ValueError('truncated MPEG frame')
  pos+=length;frames+=1
 if frames<70:raise ValueError('silent stream is too short')
 return {'mpeg_version':'2.5','layer':3,'sample_rate_hz':RATE,'channels':1,'bitrate_kbps':8,'frames':frames,'decoded_frame_duration_seconds':round(frames*576/RATE,6),'sha256':digest(data),'bytes':len(data)}

def synthesize_audio():
 import lameenc
 if importlib.metadata.version('lameenc')!='1.9.0':raise ValueError('reproducible audio generation requires lameenc==1.9.0')
 # Signed 16-bit little-endian zero samples, authored here; no source recording.
 pcm=bytes(RATE*SECONDS*2)
 encoder=lameenc.Encoder();encoder.set_in_sample_rate(RATE);encoder.set_channels(1);encoder.set_bit_rate(8);encoder.set_quality(2);encoder.silence()
 audio=bytes(encoder.encode(pcm))+bytes(encoder.flush());audio_info(audio)
 return audio

def load_audio():
 folder=ROOT/'assets/audio';data=(folder/'silence.mp3').read_bytes();manifest=json.loads((folder/'provenance.json').read_text())
 if digest(data)!=manifest['audio']['sha256']:raise ValueError('project carrier digest mismatch')
 audio_info(data);return data

def loader(drive,audio,track):
 fields=[('TIT2',title_for(drive)),('TPE1','cmu-next'),('TALB','cmu-next own loader '+VERSION),('TRCK',str(track)),('TSSE','cmu-next ID3 generator '+VERSION),('TCOP','Copyright 2026 mrerikk and cmu-next contributors')]
 frames=b''.join(text_frame(k,v) for k,v in fields)
 return b'ID3\x03\x00\x00'+synchsafe(len(frames))+frames+audio

def check_loader(data,drive,audio,track):
 if data[:6]!=b'ID3\x03\x00\x00':raise ValueError('expected unflagged ID3v2.3')
 if any(n>127 for n in data[6:10]):raise ValueError('invalid ID3 synchsafe size')
 end=10+sum(v<<(7*(3-i)) for i,v in enumerate(data[6:10]));pos=10;fields={}
 while pos<end:
  if pos+10>end:raise ValueError('truncated ID3 frame')
  name=data[pos:pos+4].decode('ascii');length=int.from_bytes(data[pos+4:pos+8],'big');body=data[pos+10:pos+10+length]
  if name in fields or not body or body[0]!=0 or pos+10+length>end or data[pos+8:pos+10]!=b'\x00\x00':raise ValueError('invalid ID3 text frame')
  fields[name]=body[1:].decode('ascii');pos+=10+length
 if pos!=end or set(fields)!={'TIT2','TPE1','TALB','TRCK','TSSE','TCOP'}:raise ValueError('unexpected ID3 fields')
 if fields['TIT2']!=title_for(drive) or fields['TRCK']!=str(track):raise ValueError('unexpected payload or track')
 if data[end:]!=audio:raise ValueError('audio differs from project carrier')
 if b'Anar' in data or b'5 Seconds of Silence' in data or data[-128:-125]==b'TAG':raise ValueError('legacy metadata or ID3v1 tail detected')
 audio_info(data[end:]);return fields

def write_bundle(out,regenerate=False):
 out=Path(out)
 if out.exists():raise ValueError('output directory must not already exist')
 audio=synthesize_audio() if regenerate else load_audio();out.mkdir(parents=True)
 rows=[]
 for track,drive in enumerate(DRIVES,1):
  name=f'{track:02d}_sd{drive}1.mp3';data=loader(drive,audio,track);check_loader(data,drive,audio,track);(out/name).write_bytes(data)
  rows.append({'file':name,'usb_partition':'sd'+drive+'1','sha256':digest(data),'bytes':len(data)})
 manifest={'version':VERSION,'origin':'five seconds of project-authored zero PCM samples; no third-party recording','input_pcm':{'format':'s16le','sample_rate_hz':RATE,'channels':1,'sample_frames':RATE*SECONDS,'sha256':digest(bytes(RATE*SECONDS*2))},'encoder':{'package':'lameenc','version':'1.9.0','license':'LGPL-3.0-or-later','bundled_with_project':False},'audio':audio_info(audio),'loaders':rows,'entry_point':'ID3 title HTML rendering on owner-authorized Connect 1 CMU','network_downloads':False,'native_cmu_verified':False}
 (out/'silence.mp3').write_bytes(audio);(out/'provenance.json').write_text(json.dumps(manifest,indent=2)+'\n');return manifest

if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--out');parser.add_argument('--regenerate-audio',action='store_true');parser.add_argument('--check',action='store_true');args=parser.parse_args()
 if args.check:
  audio=load_audio();records=json.loads((ROOT/'assets/audio/provenance.json').read_text())['loaders']
  for track,drive in enumerate(DRIVES,1):
   name=f'{track:02d}_sd{drive}1.mp3';data=(ROOT/'src/loaders'/name).read_bytes();check_loader(data,drive,audio,track)
   if digest(data)!=next(x for x in records if x['file']==name)['sha256']:raise ValueError('loader digest mismatch')
  print('PASS: four project-authored ID3 loaders and silent carrier; CMU execution remains unverified')
 else:
  if not args.out:parser.error('--out is required unless --check is used')
  m=write_bundle(args.out,args.regenerate_audio);print(json.dumps(m,indent=2))
