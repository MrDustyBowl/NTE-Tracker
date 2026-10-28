// NTE Tracker v1.2.3 — no dependencies required: node test-v123.cjs
'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const path=require('node:path');
const names=['Adler','Akane','Aurelia','Baicang','Blackbird','Chaos','Chiz','Daffodill',
  'Edgar','Fadia','Haniel','Hathor','Hotori','Iroi','Jiuyuan','Lacrimosa','Linko','Mint',
  'Nanally','Sakiri','Shinku','Skia','Zankou','Zero'];
const aRank=new Set(['Mint','Skia','Edgar','Adler','Aurelia','Haniel']);
const expectedIcons={'Mint':'AVA_MINT','Nanally':'AVA_NANALLY','Sakiri':'AVA_SAKIRI',
  'Shinku':'AVA_SHINKU','Skia':'AVA_SKIA','Daffodill':'AVA_DAFFODILL'};
const source=fs.readFileSync('src/main.js','utf8');
const code=source.replace(/^import .*?;\s*$/gm,'');
const styles=fs.readFileSync('src/style.css','utf8');
assert(styles.includes('border-radius: 50%') && styles.includes('padding-box') && styles.includes('border-box'),'Circular gradient border missing');
for(const name of Object.keys(expectedIcons)){
  const file='src/assets/roster-icons/'+name.toLowerCase()+'.png';
  assert(fs.existsSync(file), 'Missing '+file);
  const png=fs.readFileSync(file);
  assert.equal(png.readUInt32BE(16),166,'Unexpected icon width: '+name);
  assert.equal(png.readUInt32BE(20),166,'Unexpected icon height: '+name);
}
const initial={characters:names.map((name,i)=>({id:'id-'+i,name,level:80,bond:0,awakening:0,skills:{},gift:null})),arcs:[],achievements:[]};
const clone=v=>JSON.parse(JSON.stringify(v));
let db=clone(initial),saves=0;
const elements=new Map(); const events={};
function element(sel){
 if(!elements.has(sel))elements.set(sel,{innerHTML:'',value:'',hidden:false,textContent:'',dataset:{},style:{},lastChild:{textContent:''},
  classList:{add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(kind,cb){events[sel+'::'+kind]=cb},showModal(){},close(){},focus(){},querySelector(q){return element(sel+' '+q)}});
 return elements.get(sel);
}
const mocks={console,setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto,
  document:{querySelector:element,querySelectorAll(){return []},addEventListener(kind,cb){events['doc::'+kind]=cb}},
  window:{scrollTo(){}},alert(x){throw Error(x)},confirm:()=>true,
  nativeSave:async()=>null,open:async()=>null,
  bundledArtworkFor:()=>null,remoteArtworkFor:()=>null,
  ZANKOU_ART:'reference:zankou-art',ZANKOU_AVATAR:'reference:zankou-avatar',
  async invoke(cmd,{data}={}){
    if(cmd==='load_state')return clone(db);
    if(cmd==='save_state'){saves++;db=clone(data);return true;}
    throw Error('Unexpected Tauri command '+cmd);
  }
};
for(const [,symbol] of source.matchAll(/^import (AVA_\w+) from/mg)) mocks[symbol]='asset://'+symbol;
vm.createContext(mocks);
vm.runInContext(code,mocks);
(async()=>{
  await new Promise(resolve=>setTimeout(resolve,80));
  assert(saves>0,'Ranks were not persisted in SQLite mock');
  assert.equal(db.characters.length,24);
  for(const c of db.characters)assert.equal(c.rank,aRank.has(c.name)?'A':'S','Wrong rank: '+c.name);
  // Display every icon in the roster and verify direct image-to-character mapping.
  events['doc::click']({target:{closest(selector){return selector==='[data-tab]'?{dataset:{tab:'characters'}}:null;}}});
  const html=element('#content').innerHTML;
  for(const [name,symbol] of Object.entries(expectedIcons)){
    const expected=`src="asset://${symbol}" alt="${name} small icon"`;
    assert(html.includes(expected),'Wrong/missing portrait for '+name+'; expected '+symbol);
  }
  assert(html.includes('rank-a')&&html.includes('rank-s'),'Rank classes absent from roster');
  assert(html.includes('Daffodill'),'Daffodill missing from roster');
  console.log('PASS v1.2.3: 24 persisted character ranks, six corrected icons (including Daffodill), circular rarity borders.');
})().catch(err=>{console.error(err);process.exitCode=1});
