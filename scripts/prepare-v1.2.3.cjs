// Run from your NTE Tracker GitHub checkout root, before committing/pushing.
// Does not change signing keys, app identifier or database.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const f = {
  config: path.join(root, 'src-tauri', 'tauri.conf.json'),
  pkg: path.join(root, 'package.json'),
  cargo: path.join(root, 'src-tauri', 'Cargo.toml'),
  lock: path.join(root, 'package-lock.json'),
};
for (const file of [f.config,f.pkg,f.cargo]) {
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}. Run from repository root.`);
}
const config=JSON.parse(fs.readFileSync(f.config,'utf8'));
const pkg=JSON.parse(fs.readFileSync(f.pkg,'utf8'));
const cargo=fs.readFileSync(f.cargo,'utf8');
if (config.identifier !== 'com.ntetracker.desktop') throw new Error('App identifier unexpected; aborting to protect data.');
if (!config.plugins?.updater?.pubkey || config.plugins.updater.pubkey === 'REPLACE_WITH_YOUR_TAURI_PUBLIC_KEY') {
  throw new Error('Public signing key missing; refusing to prepare release.');
}
if (!['1.2.2','1.2.3'].includes(String(config.version))) {
  throw new Error(`Expected v1.2.2 or v1.2.3; got ${config.version}. No changes made.`);
}
if (!/^version\s*=\s*"[^"]+"/m.test(cargo)) throw new Error('Cargo package version not found.');
let lock=null;
if (fs.existsSync(f.lock)) {
  lock=JSON.parse(fs.readFileSync(f.lock,'utf8'));
  lock.version='1.2.3';
  if(lock.packages?.[''])lock.packages[''].version='1.2.3';
}
config.version='1.2.3';
pkg.version='1.2.3';
const newCargo=cargo.replace(/^version\s*=\s*"[^"]+"/m, 'version = "1.2.3"');
fs.writeFileSync(f.config,JSON.stringify(config,null,2)+'\n');
fs.writeFileSync(f.pkg,JSON.stringify(pkg,null,2)+'\n');
fs.writeFileSync(f.cargo,newCargo);
if(lock)fs.writeFileSync(f.lock,JSON.stringify(lock,null,2)+'\n');
console.log('Prepared NTE Tracker v1.2.3.');
console.log('Updater public key and app identifier preserved.');
console.log('Next: Commit to main -> Push origin.');
