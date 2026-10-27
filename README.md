# NTE Tracker v1.1 — Signed automatic updates (Tauri 2 / Windows)

NTE Tracker keeps all characters, Arcs, Bond & Gifts and achievements from the v1.0 desktop app, with **signed updates from GitHub Releases**. Normal tracking still works offline, without a GitHub account or data uploads.

## What changes in v1.1

- **Check Updates** button and automatic update check on startup.
- Shows new version, release notes, download percentage, **Update Now** and **Later**.
- Verifies downloaded installer with a permanent **Tauri public signing key**.
- Before installing, waits for ongoing SQLite writes and **creates a pre-update ZIP backup** with portraits; failure blocks the update.
- Downloads/installs the signed Windows NSIS installer; restarts app after successful install.
- Builds a public GitHub Release with installer, signatures and `latest.json` through **Publish signed update** GitHub Actions workflow.
- Preserves original Tauri identifier `com.ntetracker.desktop`, SQLite storage, imported Excel seed and image directory.

**IMPORTANT:** This project contains a `REPLACE_WITH_YOUR_TAURI_PUBLIC_KEY` placeholder. It **cannot be built into a working updater until you complete the ONE-TIME signing setup below**. The signing secret is never included in this ZIP. Do **not** upload any private `.key` file to GitHub or send it to anyone.

## One-time configuration for the owner

Your existing GitHub repository is `MrDustyBowl/NTE-Tracker` and the endpoint is already configured as:

`https://github.com/MrDustyBowl/NTE-Tracker/releases/latest/download/latest.json`

The Releases must remain publicly accessible for the app to download updates without logging in. Your screenshot showed this repo as **Public**, so you can use it directly. If you change the repository name/visibility, update the endpoint and publishing approach accordingly.

### 1. Generate your signing identity on your own PC

You only need **Node.js 22+** and PowerShell. Rust isn't needed just to create the key.

1. Extract the entire v1.1 source project ZIP into a folder on your Windows PC.
2. Install Node.js 22+ from https://nodejs.org/ if needed. Restart PowerShell after installing.
3. Open PowerShell *in that extracted folder*, then run:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\setup-updater.ps1
   ```

4. Follow the Tauri CLI prompt to generate an updater key and **save the passphrase** you choose.
5. The script writes the **public** key into `src-tauri/tauri.conf.json`. The **private** key is stored outside the project at `%USERPROFILE%\nte-tracker-signing\nte-updater.key`.

**Back up your private key and its passphrase securely somewhere other than your PC. If the private key is lost, existing installs cannot verify updates signed with a different key. Do not regenerate or rotate it casually.**

### 2. Set TWO GitHub repository secrets

Go to **GitHub → your NTE-Tracker repository → Settings → Secrets and variables → Actions → New repository secret**.

| Secret name | Value |
| --- | --- |
| `TAURI_SIGNING_PRIVATE_KEY` | **Entire content** of `%USERPROFILE%\nte-tracker-signing\nte-updater.key` (including any newlines). |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | The password you entered when you generated the key. |

The private key and its password should **never** be committed into your source code or GitHub releases. Do not send me either value. For the secret value, open the private key file in Notepad locally and copy its text into GitHub Secrets — **NOT into a repository file**.

### 3. Upload the updated source files to your existing repo

**Recommended for Windows:** install [GitHub Desktop](https://desktop.github.com/), clone `MrDustyBowl/NTE-Tracker`, copy all the files and folders from the extracted v1.1 project into the local repository (replace old files), and make sure you copy **the edited** `src-tauri/tauri.conf.json` containing your public key. Commit and **Push origin** in GitHub Desktop.

This preserves hidden `.github/workflows/` files too, instead of depending on Firefox to upload them. The `src-tauri/seed.json` import data is unchanged.

If you upload by browser instead, preserve directories exactly (`src/`, `src-tauri/`, `scripts/`, `.github/workflows/`) and replace matching files; there is **no separate outer** `NTE-Tracker-Tauri-v1.1/` folder in the repository root.

### 4. Publish and install v1.1 ONCE

1. After you **Push origin** with the v1.1 public key configuration, GitHub automatically runs **Actions → Publish signed update**. This signs the installer, creates release `v1.1.0` and uploads `latest.json` plus the NSIS `.exe` and signature. You can also trigger **Run workflow** manually if necessary.
2. Wait for a **green Success**. Open **Releases** on the repository and confirm `v1.1.0` has `latest.json` and a Windows setup `.exe`.
3. **Make a manual Backup ZIP from your existing v1.0 app**, saved outside the tracker data folder.
4. Download the **v1.1.0 setup `.exe`** from the GitHub Release and install it once. Keep the same Windows user account and application identifier; do not uninstall with an option to remove user data.
5. Open NTE Tracker v1.1 and use **Check Updates**. It should show *Up to date — v1.1.0*.

**v1.0 cannot auto-upgrade to v1.1**: the currently installed version has no updater plugin. This is the **one necessary manual upgrade**.

### 5. Next versions: no manual reinstallation

When we add features, I will supply changed source files:

1. Update files in GitHub Desktop and run, for example, `node scripts/bump-version.cjs 1.2.0` before committing. Push to `main`.
2. GitHub Actions automatically checks the new version, signs and publishes `v1.2.0`. If a release for the same version already exists, it skips publishing rather than replacing the signed release.
3. On your PC, start NTE Tracker. It will offer v1.2.0 automatically; click **Update Now**. The program saves a pre-update ZIP, verifies the signed installer, installs and restarts.

The **Publish signed update** workflow runs on every `main` push, but only actually builds and publishes when you've **bumped the app version** (e.g., 1.1.0 → 1.2.0). The separate **Build Windows installer** workflow remains manually triggerable for debugging. Be deliberate when bumping the version: pushing that change is approval to publish the new version.

## Data protection and details

- User data lives under Tauri's application data directory, **not** in the installer, GitHub source files or web server.
- A fresh installation seeds Excel data only if the SQLite database has never been populated; upgrading **does not** overwrite the existing collection.
- Automatic daily ZIP snapshots remain; a **pre-update-YYYYMMDD-HHMMSS-UUID.zip** is added for each install attempt. ZIP includes referenced portraits.
- App may check GitHub on startup; **tracking does not depend on internet connectivity**. Checks are silent if offline; manual checks show the error.
- This only checks on **startup or when you press Check Updates**, not continuously in the background.
- The SQLite and image backups reside on the same disk unless you manually export to another drive/cloud folder. Back up externally too.
- Code signing with a Windows publisher certificate (for SmartScreen reputation) is **different** from the mandatory Tauri updater signature. The updater key doesn't eliminate SmartScreen warnings on the initial installer.
- Your GitHub repository is **public**. The `seed.json` sample roster/progress is part of published source code, so don't commit any private character/achievement activity you would prefer to keep private. Later local SQLite changes are **not uploaded** by this updater.

## Developer validation

- `node test-ui.cjs` — v1.0 interface and data store smoke test.
- `node test-updater.cjs` — update UI, progress, backup failure, save failure, restart smoke test.
- `node scripts/validate-updater-config.cjs` — verifies the public key has been configured, versions match and endpoint is correct. Fails until signing setup is complete.
- `npm install && npm run tauri build` — actual native build (on Windows, with `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` environment variables).

**Build verification caveat:** JavaScript and HTML smoke tests can run without Rust, but the Windows native build, signing and live GitHub Release updater will still need to be validated on GitHub Actions and your PC. Source ZIP is not a compiled installer.

Official reference: https://v2.tauri.app/plugin/updater/ and https://github.com/tauri-apps/tauri-action .
