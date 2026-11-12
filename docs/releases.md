# Releases and downloads

Use [GitHub Releases](https://github.com/mrerikk/cmu-next/releases) for versioned downloads. Each meaningful component version gets its own release, changes, validation status, installation scope and SHA-256 checksums. Versions identify components, not an interchangeable whole-car firmware.

## Choosing a download

- Retrofit USB packages are temporary visual experiments. Use the package for the intended version and read its instructions before copying its contents to a USB drive.
- Loader packages provide the project-authored MP3 entry files; they do not by themselves start a privileged backend.
- Manager and SSH development candidates remain prereleases until their documented native checks pass. Host tests do not establish vehicle compatibility.
- Public source archives exclude OEM firmware and the private OEM index used in local test bundles.

Testing targets a Mazda Roadster ND 2016, Japanese market, with CMU 74.00.324A EU. Other Connect 1 vehicles have not been tested. A prerelease label is deliberate and does not mean an installer is ready for every car.

## Publication policy

Release notes state the component version, concrete changes, known limitations, test evidence, source and download contents. Assets include checksums; subsequent fixes get a new version instead of silently replacing a published package.

Historical milestones are republished on the actual reissue date, with their original version and historical status explicit. Original Git history and publication dates are retained. GPL reissues carry the grant effective 2026-11-12 and replace the superseded legacy MP3 carrier with the project-authored loader. This does not establish rights to OEM or other third-party material.

The original snapshot and loader releases are historical records. Prefer the explicitly named GPL reissues and current release notes over superseded attachments.
