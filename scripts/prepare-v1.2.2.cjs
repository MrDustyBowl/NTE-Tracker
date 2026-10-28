// Prepare NTE Tracker v1.2.2 from the repository root.
// Keep the existing app identifier, updater public key, and persistent data location intact.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const files = {
  config: path.join(root, 'src-tauri', 'tauri.conf.json'),
  pkg: path.join(root, 'package.json'),
  cargo: path.join(root, 'src-tauri', 'Cargo.toml'),
  lock: path.join(root, 'package-lock.json'),
};
for (const file of [files.config, files.pkg, files.cargo]) {
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}. Run this script at the repository root.`);
}

const config = JSON.parse(fs.readFileSync(files.config, 'utf8'));
const pkg = JSON.parse(fs.readFileSync(files.pkg, 'utf8'));
const cargo = fs.readFileSync(files.cargo, 'utf8');
const current = String(config.version ?? '');
if (config.identifier !== 'com.ntetracker.desktop') {
  throw new Error(`Unexpected app identifier '${config.identifier}'. Aborting to protect SQLite data.`);
}
if (!config.plugins?.updater?.pubkey || config.plugins.updater.pubkey === 'REPLACE_WITH_YOUR_TAURI_PUBLIC_KEY') {
  throw new Error('Updater public key is missing. Aborting without changing any files.');
}
if (current !== '1.2.1' && current !== '1.2.2') {
  throw new Error(`Expected app version 1.2.1 or 1.2.2, found '${current}'. No files changed.`);
}
if (!/^version\s*=\s*"[^"]+"/m.test(cargo)) {
  throw new Error('Cargo.toml package version not found. No files changed.');
}
const version = '1.2.2';
let lock = null;
if (fs.existsSync(files.lock)) {
  lock = JSON.parse(fs.readFileSync(files.lock, 'utf8'));
  lock.version = version;
  if (lock.packages?.['']) lock.packages[''].version = version;
}

config.version = version;
pkg.version = version;
const nextCargo = cargo.replace(/^version\s*=\s*"[^"]+"/m, `version = "${version}"`);

// Only version fields are changed; do not overwrite the updater signing configuration.
fs.writeFileSync(files.config, JSON.stringify(config, null, 2) + '\n');
fs.writeFileSync(files.pkg, JSON.stringify(pkg, null, 2) + '\n');
fs.writeFileSync(files.cargo, nextCargo);
if (lock) fs.writeFileSync(files.lock, JSON.stringify(lock, null, 2) + '\n');
console.log(`Prepared NTE Tracker v${version}.`);
console.log('Updater public key and app identifier preserved.');
console.log('Next: Commit to main, then Push origin using GitHub Desktop.');
