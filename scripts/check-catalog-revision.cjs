/** Block accidental changes to a published catalogue without increasing its revision.
 * Run in CI with git fetch-depth 0; no remote catalogue network request needed. */
const fs=require('node:fs');
const cp=require('node:child_process');
const path='catalog/catalog.v2.json';
const local=JSON.parse(fs.readFileSync(path,'utf8'));
let before;
try{before=JSON.parse(cp.execFileSync('git',['show',`origin/main:${path}`],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));}
catch{console.log('No catalogue on origin/main yet. First publication is allowed.');process.exit(0)}
if(local.schemaVersion!==before.schemaVersion)throw Error('Catalogue schema version changed: requires a compatible app release');
if(JSON.stringify(local)!==JSON.stringify(before) && local.catalogRevision<=before.catalogRevision)
 throw Error(`Catalogue data changed without increasing catalogRevision above ${before.catalogRevision}.`);
const ids=table=>new Set(table.map(x=>x.id));
for(const table of ['characters','arcs','items','achievements']){
 const current=ids(local[table]),prior=ids(before[table]);
 for(const id of prior)if(!current.has(id))throw Error(`Stable ID removed from ${table}: ${id}`);
}
console.log(`Catalog revision ${before.catalogRevision} -> ${local.catalogRevision} validated`);
