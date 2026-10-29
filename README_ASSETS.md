# NTE Tracker / Assets — verified avatar batch 01

## Done
- Linko: replaced mistaken Skia icon with the exact PNG supplied by the project owner.
- Skia: retained the correct wolf icon, independently confirmed.
- All 24 avatars normalized to **192 × 192 PNG RGBA**, with original 23 avatar images preserved.
- A source-of-truth manifest with SHA-256 checksums and identification status included.

## Import to app
Merge the **src/** folder into the repo root: existing `src/assets/roster-icons/linko.png` must be overwritten.
This makes the corrected avatar visible in the current 2.1 UI on next installer build.
`src/assets/characters/avatars/*.png` are the standardized project-owned asset library.
The UI does not yet read these standardized files by default; leave current roster icons in place.
Commit and push to `main`; GitHub Actions CI will build an installer **artifact**, not publish a release.
To see the corrected Linko in the installed desktop app, install that new artifact (a JSON database check alone will not replace bundled PNGs).

## Next batch
Large portraits are **not** included: none has been visually confirmed in the project-owner set.
Keep remote candidates in staging until labels and transparency are checked.
The application must never depend on external URLs for permanent artwork.

## Audit
- Linko PNG source: user-uploaded 166 × 166 RGBA original included unchanged for existing app path.
- `skia.png` remains the known correct wolf portrait.
- Other 22 portraits are existing artwork, not newly verified against game art.
