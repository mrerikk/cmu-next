# Version history and publication policy

This repository imports real source milestones rather than inventing a historical Git timeline. Tags identify the imported component snapshots; they do not imply that every component was tested on hardware.

| Line | Versions preserved | Status |
| --- | --- | --- |
| Own MP3 loader | 1.0.0 | Own generated carrier and wrappers; new CMU run pending. Supersedes legacy-carrier packages. |
| Manager | 0.1, engineering 0.2 / 0.2.1, 0.3, 0.3.1, 0.3.2 | Historical candidates. 0.3.1 and 0.3.2 have reported hardware startup failures. |
| SSH test transport | 0.1 / 0.1.1 | Connection preparation, read-only observations and loopback forwarding; offline checks pass, native connection pending. |
| Manager candidates | 0.3.3 / 0.3.4 | 0.3.3 fixes forked launch; 0.3.4 adds staged transaction publication and versioned reports. Both require native validation; use fresh versioned RAM sessions. |
| Retrofit | 0.6.2, 0.7, 0.7.1, 0.8 | Significant visual milestones. 0.6.2 preserves the accepted selection treatment; 0.8 adds equipment-driven categories. |
| Engine check | 0.2 | A consistent vehicle report exists for RAM-copy engine operations; raw report is private. |
| Preflight | 0.2 | Integrated into manager 0.3.1 onward; actual native preflight success remains pending. |
| Diagnostics | Initial startup collector | Handles failure before control publication. Seven host collector checks; native result pending. |
| Engineering foundations | Installer lab, journal lab, storage probe, boot hook | Development material with limited scope; not independent production car installers. |

Earlier blue/white skin drafts, duplicate USB packagings, replaced cosmetic iterations, extracted firmware, downloaded reference screenshots, private reports, toolchain caches and unrelated Mazda artwork/3D-print projects are not imported. The meaningful accepted selection baseline 0.6.2 is preserved; newer snapshots already contain that treatment.

Generated data-URI retrofit scripts are stored as compact templates with shared binary assets. `tools/build-retrofit.py` reconstructs the exact runtime bytes and validates the original digest. Source-import archives are explicitly distinct from untouched local legacy ZIPs. Historical build scripts that depended on private OEM fixtures are not advertised as portable tests.
