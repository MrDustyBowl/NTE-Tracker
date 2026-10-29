/** CI: do not publish an incorrect or tampered owned image manifest. */
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
const manifest=JSON.parse(fs.readFileSync('assets/manifest.v1.json','utf8'));
if(manifest.schemaVersion!==1||!Number.isInteger(manifest.revision)||manifest.revision<1||!Array.isArray(manifest.assets)||manifest.assets.length>512)throw Error('Invalid image manifest header');
const seen=new Set();
for(const row of manifest.assets){
  const {key,path:p,sha256,width,height}=row;
  if(typeof key!=='string'||!key.match(/^(avatar|portrait):char:[a-z0-9_-]+$|^skill:char:[a-z0-9_-]+:[a-z0-9_-]+$|^(item|arc|element):[a-z0-9_-]+$/))throw Error('Invalid image key: '+key);
  if(typeof p!=='string'||!p.endsWith('.png')||p.includes('..')||!(/^(src\/assets\/characters\/avatars\/|assets\/(characters\/(avatars|portraits|skills)\/|arcs\/|items\/|elements\/))/.test(p)))throw Error('Invalid local image path: '+p);
  if(seen.has(key))throw Error('Duplicate image key: '+key);
  seen.add(key);
  const image=fs.readFileSync(path.join('.',p));
  if(image.length>5*1024*1024||image.length<33||image.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||image.toString('ascii',12,16)!=='IHDR')throw Error('Invalid PNG: '+p);
  if(image.readUInt32BE(16)!==width||image.readUInt32BE(20)!==height)throw Error('Wrong image size: '+p);
  if(crypto.createHash('sha256').update(image).digest('hex')!==sha256)throw Error('Checksum mismatch: '+p);
}
console.log('PASS: '+manifest.assets.length+' owned PNGs, hashes and dimensions checked; revision r'+manifest.revision);
