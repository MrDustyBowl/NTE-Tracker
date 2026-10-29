# NTE Tracker 2.2 — Own-GitHub images without reinstall

The application uses **only images stored in this repository**. Third-party hosts
are NOT contacted at runtime for artwork.

- `assets/manifest.v1.json` is the publicly synced manifest (`revision` increases each change).
- `assets/character_image_manifest.json` is the original 24-avatar batch audit.
- Files are fetched from `raw.githubusercontent.com/MrDustyBowl/NTE-Tracker/main/`
  at the exact relative `path` listed in the manifest.
- Each PNG must match its declared `sha256`, `width`, and `height`.
- Cache lives in the application's private data folder under `asset-cache/`.
- Images are downloaded atomically and **personal SQLite data is never modified**.
- On startup images load from a verified local cache; embedded artwork remains fallback.
- The **Check Images** button refreshes image data without requiring any new installer.

To update an avatar: replace the PNG at its listed path, calculate its SHA-256,
update the matching `sha256` in `assets/manifest.v1.json`, increment the revision,
commit and push on `main`. GitHub Actions validates the whole manifest.

To add big portraits: place transparent PNG under `assets/characters/portraits/`,
create a manifest entry with `key: "portrait:char:adler"`, its local path, SHA-256,
dimensions, and increment revision. The hero image will then use the remote cached art
and revert to the built-in avatar if it is missing/offline.

Skill, Arc, item and element identifiers are reserved for later UI expansion. The
asset sync engine can already download them and verify them.
No asset update alone should publish a new Windows installer.

Note: The first activation of this feature is a one-time **2.2 app upgrade**.
Changes to images after that are separate from app updates.
