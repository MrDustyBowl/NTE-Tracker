// Runs with Node alone. Mocks native Tauri commands and DOM to smoke-test frontend logic.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync(__dirname+'/src/main.js','utf8').replace(/^import .*?;\s*$/gm,'');
const seed=JSON.parse(fs.readFileSync(__dirname+'/src-tauri/seed.json','utf8'));
const clone=x=>JSON.parse(JSON.stringify(x));
let db=clone(seed),writes=0;
const fakePicture={size:8,async arrayBuffer(){return Uint8Array.from([137,80,78,71,13,10,26,10]).buffer}};
let fakeFields={name:'New Character',level:'1',bond:'0',awakening:'0',portraitFile:fakePicture,notes:'Brand new release'};
const elements=new Map(),listeners={};
function el(s){if(!elements.has(s))elements.set(s,{innerHTML:'',textContent:'',value:'',hidden:false,style:{},dataset:{},classList:{toggle(){},add(){},remove(){}},setAttribute(){},addEventListener(n,cb){listeners[s+'::'+n]=cb},focus(){},showModal(){this.open=true},close(){this.open=false},querySelector(a){return el('sub'+a)},lastChild:{textContent:''}});return elements.get(s)}
const context={console,setTimeout,clearTimeout,crypto:require('crypto').webcrypto,
 FormData:class {get(k){return Object.hasOwn(fakeFields,k)?fakeFields[k]:null}},
 document:{querySelector:el,querySelectorAll(){return []},addEventListener(n,cb){listeners['doc::'+n]=cb}},
 window:{scrollTo(){}},confirm:()=>true,alert:err=>{throw Error(err)},
 async invoke(cmd,args){if(cmd==='load_state')return clone(db);if(cmd==='save_state'){db=clone(args.data);writes++;return;} if(cmd==='save_portrait')return 'img-a1b2.png';if(cmd==='read_portrait')return 'data:image/png;base64,abc';if(cmd==='get_data_directory')return 'C:\\app';throw Error('Missing command mock '+cmd);},
 nativeSave:async()=>null,open:async()=>null};
vm.createContext(context);vm.runInContext(code,context);
async function settle(){await new Promise(r=>setTimeout(r,20));}
function tab(name){listeners['doc::click']({target:{closest(sel){return sel==='[data-tab]'?{dataset:{tab:name},setAttribute(){},classList:{toggle(){}}}:null}}})}
function action(dataset){return listeners['doc::click']({target:{closest(sel){return sel==='[data-action]'?{dataset}:null}}})}
(async()=>{
await settle();
assert(el('#metrics').innerHTML.includes('24'),'seed loaded');
tab('characters');assert((el('#content').innerHTML.match(/entity-card/g)||[]).length===24);
tab('arcs');assert(el('#content').innerHTML.includes('Us.'));
tab('achievements');assert(el('#content').innerHTML.includes('Eternal Home'));
tab('bonds');assert(el('#content').innerHTML.includes('Golden Moon'));
const sakiri=db.characters.find(c=>c.name==='Sakiri');
await action({action:'step',kind:'bonds',id:sakiri.id,field:'bond',delta:'1'});
await settle();
assert(db.characters.find(c=>c.id===sakiri.id).bond===sakiri.bond+1,'SQLite save invoked');
assert(writes>0,'writes occurred');
await action({action:'delete',kind:'arcs',id:db.arcs[0].id});await settle();
assert(db.arcs.length===50,'deleting Arc saved');
tab('characters');await action({action:'add'});
const form=el('#editor-form');form.dataset.kind='characters';
await listeners['#editor-form::submit']({preventDefault(){},currentTarget:form});
await settle();
assert(db.characters.some(c=>c.name==='New Character'&&c.portrait==='img-a1b2.png'),'new character and picture saved');
tab('achievements');await action({action:'delete',kind:'achievements',id:db.achievements[0].id});await settle();
assert(db.achievements.length===9,'achievement deleted');
tab('achievements');assert(el('#content').innerHTML.includes('achievement'));
console.log('PASS: initialized 24 characters, 51 arcs, 10 achievements; rendered views; persisted Bond change; added Character + portrait; deleted Arc and Achievement via mock SQLite');
})().catch(e=>{console.error(e);process.exitCode=1});
