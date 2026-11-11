# Building sources

Python 3, a C99 compiler and Node.js (for JavaScript syntax checks) are sufficient for host checks. Building the recorded ARM target additionally requires **Zig 0.15.2** supplied by the developer. Toolchains are not downloaded automatically.

```sh
python3 tools/check-repository.py
python3 tools/build-manager.py --host
```

Host binaries land in `build/host`. They are intended for development, not for copying to the CMU.

## Temporary visual packages

The large generated scripts are losslessly compacted into templates and shared assets in Git. Rebuild the selected milestone:

```sh
python3 tools/build-retrofit.py --version 0.8 --out dist/retrofit-0.8
```

The builder validates the original runtime SHA-256 and writes `usb/js/run.js` plus the MP3 loaders. Copy the contents of `usb` to a flash drive for a temporary visual test. This is the 10-minute overlay; it is separate from the manager loader. Other preserved choices are 0.6.2, 0.7 and 0.7.1.

## OEM index reconstruction

The OEM index.html is deliberately absent from Git. Supply the exact original from a locally owned 74.00.324A EU firmware extraction:

```sh
python3 tools/materialize-module.py --firmware-index /path/to/index.html --out build/visual-module
```

The script requires the recorded original digest, inserts only the project bootstrap, verifies the resulting digest and all 82 module payloads, and writes into a new directory. It never edits the input. Its output includes an OEM-derived file and remains ignored by Git.

## Historical manager candidate

Manager 0.3.2 has a known startup failure and is preserved for engineering work, not recommended as a stable installer. To reconstruct its complete USB candidate locally:

```sh
python3 tools/build-manager.py --arm --zig /path/to/zig --firmware-index /path/to/index.html
```

This builds three ARM tools, regenerates their pins, reconstructs the module from the supplied OEM index, and creates `build/arm/usb`. The output directory must not already exist. Retain required musl/Zig notices if distributing linked binaries. The build does not prove the candidate works on the CMU.

## Firmware-copy research

`src/engine/init-lab.py --source <local-rootfs> --lab <new-directory>` creates a marked independent copy from separately provided regular files. No firmware fixture is shipped. Historical fixture-dependent test scripts and private host paths are not a portable test suite and are not advertised as such.
