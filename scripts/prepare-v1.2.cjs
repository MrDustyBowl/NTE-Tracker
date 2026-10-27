// Run from your existing GitHub repo root: node scripts/prepare-v1.2.cjs
// Intentionally preserves the installed Tauri updater's public key & identifier.
const fs=require('node:fs');
const path=require('node:path');
const root=process.cwd();
const configFile=path.join(root,'src-tauri','tauri.conf.json');
const packageFile=path.join(root,'package.json');
const cargoFile=path.join(root,'src-tauri','Cargo.toml');
for(const file of [configFile,packageFile,cargoFile])if(!fs.existsSync(file))throw Error(`Missing ${file}; please run from repository root.`);
const c=JSON.parse(fs.readFileSync(configFile,'utf8'));
const p=JSON.parse(fs.readFileSync(packageFile,'utf8'));
const rust=fs.readFileSync(cargoFile,'utf8');
if(c.identifier!=='com.ntetracker.desktop')throw Error(`Unexpected application identifier: ${c.identifier}; aborting so your data location remains stable.`);
const publicKey=c.plugins?.updater?.pubkey;
if(!publicKey||publicKey==='REPLACE_WITH_YOUR_TAURI_PUBLIC_KEY')throw Error('Signing public key is not configured in tauri.conf.json — stopping to protect the updater.');
if(!/^[\s\S]*^version\s*=\s*"[^"]+"/m.test(rust))throw Error('Cargo version missing');
if(!c.app?.security?.csp||typeof c.app.security.csp!=='string')throw Error('Unexpected CSP. Edit manually before release.');
const csp=c.app.security.csp;
// Add only the approved character-art image sources. No remote scripts or APIs.
const oldImage=csp.match(/(?:^|;)\s*img-src\s+([^;]+)/);
if(!oldImage)throw Error('CSP img-src directive missing');
const hosts=['https://www.ntegame.com','https://cdn.prydwen.gg'];
let imgDirective=oldImage[1].trim();
for(const host of hosts)if(!imgDirective.includes(host))imgDirective+=' '+host;
c.app.security.csp=csp.replace(oldImage[0],oldImage[0].replace(oldImage[1],imgDirective));
const ver='1.2.0';
c.version=ver;p.version=ver;
const newCargo=rust.replace(/^version\s*=\s*"[^"]+"/m,`version = "${ver}"`);
fs.writeFileSync(configFile,JSON.stringify(c,null,2)+'\n');
fs.writeFileSync(packageFile,JSON.stringify(p,null,2)+'\n');
fs.writeFileSync(cargoFile,newCargo);
console.log('Prepared NTE Tracker v'+ver+'.');
console.log('Updater public key and identifier preserved. Portrait sources allowed by CSP.');
console.log('IMPORTANT: do not commit any private key or local SQLite database.');
