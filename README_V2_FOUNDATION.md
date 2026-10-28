# NTE Tracker 2.0 — Architecture foundation (staging only)

**DO NOT publish this development package as an official v2.0 release yet.** The catalogue is incomplete, and the Rust/Windows build and true backup migration have not been exercised on an installed Windows machine.

## What this package implements

- Versioned, read-only `src/data/catalog.v2.json` containing records with stable IDs.
- A separate SQLite `catalog_progress` table; `(kind, catalog_id)` is the primary key. Old `items`/`data.json` v1 records are preserved, not imported into the new profile.
- Character ownership and upgrade progress: level 1–80; Basic, Redirect, Ultimate, Support 1–10; two unlocked-passive booleans; Life Skill 1/2 minimum 0 and configurable per character maximum; Awakening 0–6.
- Bond progress: level 0–10, interactions completed flag. Status is derived from global `has_interactions` and Bond level (Not Available, Not Verified, Locked below 6, Unlocked from 6, Done when manually checked). Favourite gift references an item ID; item name/rarity/price/sources are not duplicated.
- Arc progression: `owned`, `level` 1–80, `tier` 1–5. **No copy count.** Arc rarity, when verified, is gold/purple/blue.
- Item catalogue schema: stable ID, name, category, **required rarity** (gold/purple/blue/green), optional icon. Missing/broken images use fallback artwork.
- Item sources: one or more records per item, with `item_id`, `source_type`, `source_name`, optional `stage`, `location`, and `price`. This is the acquisition system for mobs, farming stages, shops, quests and events.
- Older SQLite data and custom portraits remain on disk; ZIP backups include the old data plus `profile-v2.json`.

## Catalogue completeness — important

Only 24 character names/ranks and 51 Arc names from the previously supplied `Units.xlsx` are seeded as **catalogue skeletons**.

- Characters' unknown life-skill maxima, dateability, gift IDs and interaction presence are `null` / not verified. `life_skill_2_verified=false` distinguishes a not-yet-studied skill from a character confirmed to have no second Life Skill.
- Arc rarities are presently `null` because the supplied workbook does not establish them; **all official Arc records must have a verified gold, purple or blue rarity before public release**.
- Items and achievements are presently empty, pending their complete curated catalogues. No item with an invented price or drop source has been added.
- The catalogue is not a complete verified game dataset; do not claim that it is.

## Importing new data (catalog editors)

Edit `src/data/catalog.v2.json` in development, then run `node test-catalog-v2.cjs`. Item sources are separate records, e.g.:

```json
{
  "id": "source:example-farming-stage",
  "item_id": "item:example-material",
  "source_type": "stage",
  "source_name": "Example stage (illustrative)",
  "stage": "4",
  "location": null,
  "price": null
}
```

**Do not ship the illustrative example.** Source IDs, character IDs and Arc IDs must never be renamed after publication; only their display names and details may change.

`src/catalog-rules.js` owns the allowed ranges and Bond logic; `test-catalog-v2.cjs` tests those rules and verifies IDs and cross references.

## How to test without touching the installed app

- Open the standalone `NTE_Tracker_v2_Characters_Arcs_Items_Preview.html` browser demo. Its demo progress is in memory only.
- Run `node test-catalog-v2.cjs` and `node --check src/catalog-main.js` in the project root.
- For a native build, start from the user's *current* v1.2.3 repository, copy these staging files into a **new branch** (`v2-development`), and use the existing Tauri build machinery only after verifying Rust compilation and backups on a test copy of the data folder.
- Keep `src-tauri/tauri.conf.json`, package version, app identifier, signing key and working updater settings **from the user's existing repo**. This staging pack intentionally does not include a replacement for those files.

## Safety and data continuity

No script in this package deletes the old SQLite `items` table or replaces your v1 backup. Fresh v2 players have empty profiles. In a later release, a separate migration/import tool could read old v1 data without mutating it, but by current request, no automatic import is performed.

The user's signed update workflow is **not changed by this staging pack**. An opt-in branch CI workflow has been included (`validate-catalog.yml`) to run catalogue checks before release. Release versioning, test-gating and real Windows update validation must be finalized before public publication.
