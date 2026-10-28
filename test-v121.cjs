// Regression checks for v1.2.1 UI. Run: node test-v121.cjs
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const seed=JSON.parse(fs.readFileSync(__dirname+'/src-tauri/seed.json','utf8'));
const cloned=x=>JSON.parse(JSON.stringify(x));
let db=cloned(seed),saved=0, pictureCount=0, formFields={};
const target=db.characters.find(c=>c.name==='Zankou');target.rank='S';target.gift={...(target.gift||{}),name:'Sample gift',price:900,affection:400,rarity:'purple'};
const a=db.characters.find(c=>c.name==='Adler');a.rank='A';
const ar=db.arcs[0];ar.rarity='green';
const fields=new Map(),listeners={};
function elem(k){if(!fields.has(k))fields.set(k,{innerHTML:'',textContent:'',value:'',hidden:false,style:{},dataset:{},checked:false,classList:{toggle(){},add(){},remove(){}},setAttribute(){},addEventListener(type,fn){listeners[k+'::'+type]=fn},focus(){},showModal(){this.open=true},close(){this.open=false},querySelector(x){return elem('sub'+x)},lastChild:{textContent:''}});return fields.get(k)}
const code=fs.readFileSync(__dirname+'/src/main.js','utf8').replace(/^import .*?;\s*$/gm,'');
const mock={console,crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,
 ZANKOU_ART:'zankou-art.webp',ZANKOU_AVATAR:'zankou-avatar.webp',
 bundledArtworkFor:()=>null,remoteArtworkFor:()=>({url:'https://images.example/a.png'}),HTMLImageElement:class {},
 document:{querySelector:elem,querySelectorAll(){return []},addEventListener(n,fn){listeners['doc::'+n]=fn}},
 window:{scrollTo(){}},alert(x){throw Error(x)},confirm:()=>true,
 FormData:class {get(k){return Object.hasOwn(formFields,k)?formFields[k]:null}},
 nativeSave:async()=>null,open:async()=>null,
 async invoke(cmd,args){if(cmd==='load_state')return cloned(db);if(cmd==='save_state'){saved++;db=cloned(args.data);return true;}
  if(cmd==='save_portrait'){pictureCount++;return `img-test-${pictureCount}.png`;}if(cmd==='read_portrait')return 'data:image/png;base64,aW1n';
  if(cmd==='get_data_directory')return 'TEST';throw Error('unmocked command '+cmd)}
};
vm.createContext(mock);vm.runInContext(code,mock);
const settle=()=>new Promise(r=>setTimeout(r,25));
function tab(name){listeners['doc::click']({target:{closest(selector){return selector==='[data-tab]'?{dataset:{tab:name}}:null;}}});}
async function click(action,kind,id){return listeners['doc::click']({target:{closest(sel){return sel==='[data-action]'?{dataset:{action,kind,id}}:null;}}});}
(async()=>{
 await settle();tab('characters');let html=elem('#content').innerHTML;
 assert(!html.includes('value="selected"'),'Removed Selected sort option');
 assert(html.includes('<option value="name" selected>A–Z</option>'),'Default A-Z sort');
 assert(html.includes('rank-s'),'S-rank border present in roster');assert(html.includes('rank-a'),'A-rank border present in roster');
 assert(html.includes('rank-s')&&html.includes('Zankou'),'rank reflected in hero');
 tab('bonds');html=elem('#content').innerHTML;
 assert(html.includes('bond-portrait-panel'),'Bond profile has big portrait');
 assert(html.includes('bond-card-content'),'Bond information shown on right');
 assert(html.includes('item-icon-frame rarity-purple'),'Purple item icon background');
 assert(!html.includes('Affection value')&&!html.includes('Gift value'),'Affection value no longer shown');
 assert(html.includes('Price'),'Gift price remains visible');
 tab('arcs');html=elem('#content').innerHTML;
 assert(html.includes('rarity-green'),'Arc item gradient available');
 await click('edit','bonds',target.id);
 assert(elem('#form-fields').innerHTML.includes('giftIconFile'),'Gift icon upload available');
 assert(elem('#form-fields').innerHTML.includes('giftRarity'),'Gift rarity editor available');
 assert(!elem('#form-fields').innerHTML.includes('Affection Value'),'Affection Value field removed');
 const pngBytes=Uint8Array.from([137,80,78,71,13,10,26,10]);
 formFields={bond:'8',giftName:'Sample gift',giftPrice:'900',giftRarity:'gold',giftIconFile:{size:pngBytes.length,arrayBuffer:async()=>pngBytes.buffer},giftStore:'Store',giftLocation:'Area',dateable:'No',interactions:'Done',notes:''};
 const form=elem('#editor-form');form.dataset.kind='bonds';
 await listeners['#editor-form::submit']({preventDefault(){},currentTarget:form});await settle();
 const updated=db.characters.find(c=>c.id===target.id);
 assert.equal(updated.gift.rarity,'gold');assert.equal(updated.gift.icon,'img-test-1.png');assert.equal(updated.gift.affection,400,'Imported affection value preserved for old backups');
 assert.equal(updated.bond,8);assert(saved>0);
 tab('bonds');html=elem('#content').innerHTML;
 assert(html.includes('item-icon-frame rarity-gold'),'Edited gift renders with gold gradient');
 assert(html.includes('data:image/png;base64,aW1n'),'Uploaded gift icon is rendered');
 await click('edit','characters',target.id);
 assert(elem('#form-fields').innerHTML.includes('Character Rank'),'Character rank editor available');
 console.log('PASS: A-Z sort, rank outlines, 30/70 Bond cards, rarity gradients, icon upload/persistence, legacy affection value preserved.');
})().catch(err=>{console.error(err);process.exitCode=1});
