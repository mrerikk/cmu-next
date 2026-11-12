# Project-authored MP3 loaders 1.0.0

These are ID3/HTML injection proof-of-concept entry files for an owner-authorized Mazda Connect 1 CMU. They are not ordinary music tracks. Their title field requests local `js/run.js` from the selected USB partition; no network URL is embedded. Do not play them on someone else's device without authorization.

The audio carrier was synthesized from five seconds of zero-valued 16-bit PCM at 8 kHz, mono, then encoded at 8 kbps. No legacy MP3 recording or tail metadata was used. `assets/audio/provenance.json` records input, encoder and output digests.

The project's own generator is `tools/build-loaders.py`. It builds the four ID3v2.3 wrappers and validates their fixed USB paths. The invocation of an existing CMU API is retained; this project does not claim to have invented or removed the underlying firmware vulnerability.

- `01_sda1.mp3`: USB partition sda1
- `02_sdb1.mp3`: USB partition sdb1
- `03_sdc1.mp3`: USB partition sdc1
- `04_sdd1.mp3`: USB partition sdd1

The carrier and wrapper container passed host structural checks and independent decoding. **These new loader bytes have not been tested on the actual CMU.** The previous legacy loaders working in a vehicle does not establish this new version's compatibility.

Project-authored loader code and assets use GNU GPL v3 or later (GPL-3.0-or-later). LAME/lameenc is a separately licensed build tool, is not copied into USB packages, and is not relicensed by this project.
