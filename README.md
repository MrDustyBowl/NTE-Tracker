# NTE Tracker — Tauri 2 Desktop (Windows)

Local-first progress tracker for **Neverness to Everness**, migrated from `Units.xlsx` and the previous HTML tracker.

## What works

- **Characters** — add, edit, delete; level, awakening, bond, 8 individual skills, notes; upload a PNG/JPEG/WebP portrait (up to 5 MB).
- **Arcs** — add, edit, delete; level, tier, and linked character.
- **Bond & Gifts** — update affection, preferred gift, value, price, store, location, dateable status and interactions.
- **Achievements** — add, edit, delete; category, name, description, rarity, progress, observations, completion; auto-link existing affection milestones to Bond levels.
- Search, sorting, statistics, JSON import/export, CSV import/export.
- **SQLite** is the authoritative storage: `nte.sqlite3` in the OS-managed application data directory, independent of the `.exe`.
- **Portrait files** are stored separately in `portraits/`, and referenced by filename in SQLite.
- **ZIP backup / restore** includes the complete data snapshot and referenced portraits. The app makes a safety snapshot before ZIP restore and before restoring the Excel seed.
- **Automatic daily backups:** on launch, `backups/daily-YYYY-MM-DD.zip`, with the 14 most recent daily snapshots retained. Backups are on the same disk unless you export a ZIP elsewhere.

## First run and migration

The original workbook's **24 characters, 51 Arcs and 10 achievements** are stored in `src-tauri/seed.json` and populated into SQLite **only on the first run**. The source seed is not subsequently used as an active datastore.

If you modified the earlier `.html` version in Firefox, open that version **in the same browser/profile**, choose **Backup JSON**, and save the downloaded `.json`. Then open the desktop app, choose **Import JSON / CSV**, and select that file. Confirm the replacement. Your edits are saved in SQLite. The old Firefox `localStorage` is not automatically accessible to Tauri.

To move your tracker to another PC, use **Backup ZIP** and then **Restore ZIP** on the destination machine. The ZIP includes profile images, while **Export JSON** is mainly for compatibility with previous tracker versions and does **not** include picture bytes.

## Build a Windows installer (recommended)

### Option A — on Windows

1. Install **Node.js 22+**, **Rust via rustup**, and **Visual Studio 2022 Build Tools with Desktop development with C++**. Ensure **WebView2** is available (normally present on modern Windows 10/11).
2. Unzip this project somewhere writable on your PC.
3. Double-click `build-windows.bat` (or run the commands below in PowerShell).
4. Find the generated **NSIS installer `.exe`** under `src-tauri/target/release/bundle/nsis/`.

```powershell
npm install
npm run tauri build
```

For live development:

```powershell
npm install
npm run tauri dev
```

The first compilation can take longer while Rust downloads and compiles dependencies.

### Option B — GitHub Actions (without installing Rust locally)

1. Create a **private** GitHub repository and upload the contents of this project folder (including `.github/workflows/build-windows.yml`).
2. In GitHub, open **Actions → Build Windows installer → Run workflow**.
3. When the job succeeds, download the **NTE-Tracker-Windows-Installer** artifact from the completed workflow run.
4. Unzip the artifact and run its `.exe` installer on Windows.

GitHub Actions builds on an actual Windows runner. No GitHub account or cloud server is needed **to use the installed tracker**.

## Where is my data?

Inside the app, click **Show data folder** near the bottom. The path is determined by Tauri from your Windows account; do not edit `nte.sqlite3` while the app is open.

- `nte.sqlite3`: editable persistent records, managed transactionally by SQLite.
- `portraits/`: your uploaded portrait images.
- `backups/`: automatic daily archives and pre-restore safeguards.

**Keep ZIP backups on another drive or cloud storage**, too. Daily backups on the same drive cannot protect against drive failure. A backup is only as good as your ability to restore it; occasionally test a spare copy.

## Known limitations / next steps

- This release delivers **source code** and build automation. No Windows `.exe` was produced or tested in this Linux environment without a Rust/Cargo build toolchain.
- This version preserves your existing HTML dashboard layout rather than creating a new custom one.
- No built-in auto-update yet. Rebuilding/replacing the application does not remove the app-data directory, but always export a ZIP before an upgrade.
- Deleting an entry removes it from the live tracker. Recovery requires ZIP backups (there is not yet a Recycle Bin).
- Stored JSON is not encrypted. Anyone with access to your Windows profile/app-data files could read the tracker.
- Automatic backup warnings are written to the runtime log; the app remains usable if automatic backup fails. Use the Backup ZIP button to verify that exporting succeeds.

## Project structure

- `src/main.js`: UI logic and Tauri invocations
- `src/style.css`, `index.html`: existing tracker design, now served by Vite
- `src-tauri/src/lib.rs`: SQLite operations, portrait storage, ZIP backup/restore, first-run seed
- `src-tauri/seed.json`: once-only Excel snapshot
- `.github/workflows/build-windows.yml`: automated Windows installer compilation
- `test-ui.cjs`: dependency-free UI logic smoke test

`node test-ui.cjs` verifies the imported roster is rendered, Bond writes persist through the mocked native command, and deletion updates the mocked database.

## Data ownership and privacy

All normal operation is offline. No sign-in, database server, telemetry, or third-party API is used. The GitHub build workflow is optional. Uploaded portrait pictures stay in the application's local data directory.
