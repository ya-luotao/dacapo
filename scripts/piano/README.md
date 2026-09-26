# The built-in piano's samples

`public/piano/` holds the samples the built-in piano plays (`src/output/piano.ts`), and
`src/output/pianoTable.ts` their table. Both are made by `build.ts` from the **Salamander Grand
Piano V3** by Alexander Holm (a Yamaha C5; Creative Commons Attribution 3.0), in the FreePats
edition of 2020-06-02. The credit and the licence are in `THIRD_PARTY_NOTICES.md` and on the About
page; the texts ship in `public/licenses/salamander/`.

## Making them

1. Download `SalamanderGrandPiano-SFZ+FLAC-V3+20200602.tar.gz` (742 MB) from
   <https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html> and extract it. Its SHA-256 is
   `b7760e168494cf095344e217b0af013fc449ad033abbbdf1c65211cf11dc038b`; the script checks the
   retuned SFZ inside it.
2. Install [ffmpeg](https://ffmpeg.org) with libmp3lame (`brew install ffmpeg`).
3. From the repository root:

   ```sh
   node --experimental-strip-types scripts/piano/build.ts <SalamanderGrandPiano-SFZ+FLAC-V3+20200602>
   ```

The script takes velocity layers 4, 9 and 13 of 16 (they stand for velocities 40, 68 and 100: the
soft accompaniment, the demo's 72 and the computer keyboard's 96 each have one near them), every
minor third from A0 to C8 as recorded. Each sample is trimmed to 1 ms before its first sound above
−66 dBFS, cut to a length that falls from 8 s at A0 to 2.5 s at C8, faded out over its last third
(at most 2 s) and encoded as VBR MP3 (`-q:a 5`, stereo, 48 kHz): 90 files, about 3.8 MB. The
tuning of each key comes from the retuned SFZ (in cents, applied as the sample plays), so the
recordings themselves are not resampled.

The files are not re-encoded unless the choices above change; if they do, commit the new files
and table together, and update the numbers in `docs/PIECES.md`.
