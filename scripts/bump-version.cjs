// node scripts/bump-version.cjs 1.2.0
const fs = require('node:fs');
const ver = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(ver ?? '')) throw Error('Usage: node scripts/bump-version.cjs 1.2.0');
const f='src-tauri/tauri.conf.json',c=JSON.parse(fs.readFileSync(f));
const p=JSON.parse(fs.readFileSync('package.json'));
const cargoFile='src-tauri/Cargo.toml', cargo=fs.readFileSync(cargoFile,'utf8');
c.version=ver;p.version=ver;
fs.writeFileSync(f,JSON.stringify(c,null,2)+'\n');
fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');
fs.writeFileSync(cargoFile,cargo.replace(/^version = "[^"]+"/m,`version = "${ver}"`));
console.log('Version set to',ver,'— commit changes before publishing.');
