# NTE Tracker v1.2.1 — Bond layouts and item rarity

**Corrected Bond ID-card layout — final v1.2.1 patch.** This supersedes the previous v1.2.1 ZIP; do not apply both.

**Patch for the already-installed GitHub repository `MrDustyBowl/NTE-Tracker` (v1.2.0).** The release is **not published or installed** by opening this ZIP. Its files are intended for your repository, not a new app or database.

## Changes

- Character list: removed confusing "Selected" sorting. Default is **A–Z**, optional **Level ↓** remains. Selecting a character still opens its profile.
- Characters: optional **S-Rank** (gold outline), **A-Rank** (purple outline) or **Unspecified**. No rank is invented for the 24 existing characters; set it in **Edit Profile / Photo**.
- Bond & Gifts: **2 centered landscape ID cards per row on desktop** (rather than a single full-width panel). Each card keeps **30% portrait on the left / 70% data on the right**, with the same custom or source image as Characters. The last card remains centered if a filter returns an odd number of results. On narrower windows, the layout switches to one card per row.
- Bond & Gifts: **Affection Value / Gift Value** removed from the display and editor. **Price remains available.** Existing imported affection-value data is deliberately preserved internally for backups and compatibility.
- Preferred Gifts: optional image upload through **Edit Bond & Gift** (PNG/JPG/WebP, max 5 MB), with a decorative placeholder before you collect icons. Optional rarity: **Gold, Purple, Blue, Green**, or unspecified.
- Arcs: same optional rarity color for their item tile, configured through **Edit Arc**.
- All rarity colors use the same game-style gradient: dark at top, saturated color along the bottom edge.
- Backup ZIP and restore now include **gift icons** in addition to character portraits. The persistent SQLite database stores image references. No proprietary game art is newly bundled.
- New CSV exports omit affection value, include optional rarity/rank; old CSV with a Value column can still be imported. Existing gift icons are preserved when importing records.

## Before publishing

1. Use **Data & Tools → Backup ZIP** from your installed v1.2.0 application and keep it outside the GitHub project folder.
2. Open **GitHub Desktop → Repository → Show in Explorer**.
3. Extract the patch ZIP and copy **its contents** to that repo folder, accepting overwrites. **Do not delete** `.git`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, your assets, or your image folders. The patch deliberately contains **no Tauri config or private keys**.
4. Open PowerShell in the repository directory and execute:

   ```powershell
   node scripts/prepare-v1.2.1.cjs
   node test-ui.cjs
   node test-v121.cjs
   node test-updater.cjs
   ```

5. Verify `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `package.json` now say **1.2.1** and the public signing key is still present in `tauri.conf.json`.
6. In GitHub Desktop, commit and push the changed files. **Never commit** `.key`, passwords, local SQLite databases, ZIP backups or exported screenshots that include private identifiers.
7. Verify **Actions → Publish signed update** runs successfully and **Releases → v1.2.1** contains a signed NSIS installer, `.sig` and `latest.json`.
8. Then in your installed app use **Check Updates**. Verify progress is preserved and that you can upload a gift icon, close the app, reopen it, and create/restore a ZIP backup including that icon.

**The updated Rust backend and UI tests run with fake SQLite commands here, not a native Windows compile.** The GitHub Windows build and a real icon backup/restore on your PC are still the final checks.

## Portraits and rarity placeholders

Your portraits and icons are **not** overwritten or shipped in this patch. In the preview only, example character ranks and item rarity colors are assigned to make the gradients visible — these example values do not touch the application data or the `seed.json` in your GitHub project. In the real app, rank/rarity are empty until you set them.

## Rollback

If the GitHub build fails, keep the currently installed app; do not uninstall it. You can always restore from the pre-update ZIP. The app identifier and data directory remain the same.
