/**
 * Safe, repeatable v2 version preparation for an existing signed Tauri repo.
 * Deliberately PRESERVES the user's updater public key and app identifier.
 */
const fs=require('node:fs');
const path=require('node:path');
function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8'))}
function writeJson(p,value){fs.writeFileSync(p,JSON.stringify(value,null,2)+'\n')}
const version='2.1.0';
const packagePath='package.json',tauriPath='src-tauri/tauri.conf.json',cargoPath='src-tauri/Cargo.toml';
if (!fs.existsSync('catalog/catalog.v2.json'))throw Error('Missing global catalog/catalog.v2.json');
const app=readJson(tauriPath);
if(app.identifier!=='com.ntetracker.desktop')throw Error('Refusing to change a different application identifier');
if(app.plugins?.updater?.pubkey?.includes('REPLACE_WITH_')){
  console.warn('WARNING: Your existing Tauri updater public key is still a placeholder. Signed Windows builds will require its configuration.');
}
app.version=version;
const pkg=readJson(packagePath);pkg.version=version;
pkg.scripts={...pkg.scripts,'test:catalog':'node test-catalog-v2.cjs'};
const cargo=fs.readFileSync(cargoPath,'utf8');
let next=cargo.replace(/^(version\s*=\s*)"[^"]+"/m,`$1"${version}"`);
if(next===cargo && !cargo.includes(`version = "${version}"`))throw Error('Cannot locate Cargo package version');
if(!/^reqwest\s*=/m.test(next)){
 next+='\n# HTTPS-only read-only public catalogue synchronization\nreqwest = { version = "0.12", default-features = false, features = ["json", "rustls-tls"] }\n';
}
writeJson(packagePath,pkg);writeJson(tauriPath,app);fs.writeFileSync(cargoPath,next);
// Obsolete duplicate from the earlier prototype. Keep one authoritative catalogue.
if (fs.existsSync('src/data/catalog.v2.json'))fs.rmSync('src/data/catalog.v2.json');
console.log(`NTE Tracker ${version} manifests prepared. App identifier and updater public key preserved.`);
