import catalog from './data/catalog.v2.json';
import {invoke} from '@tauri-apps/api/core';
import {SKILLS,defaultProgress,acquiredDefaults,parseInteger,interactionStatus,catalogItem,sourcesFor,verifyCatalog} from './catalog-rules.js';

// The catalog ships with the app. Only profile records are written to SQLite.
const GROUPS=['characters','arcs','bonds','items','achievements'];
const LABELS={overview:'Overview',characters:'Characters',arcs:'Arcs',bonds:'Bond & Gifts',items:'Items',achievements:'Achievements'};
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons=import.meta.glob('./assets/roster-icons/*.{png,jpg,webp}',{eager:true,query:'?url',import:'default'});
const iconsMap=new Map(Object.entries(icons).map(([k,v])=>[k.split('/').at(-1).split('.')[0],v]));
let profile={characters:{},arcs:{},bonds:{},items:{},achievements:{}};
let tab='overview',filter='all',query='',editing=null,chain=Promise.resolve(),lastSaveOk=true;
const bondMap=new Map(catalog.character_bonds.map(b=>[b.character_id,b]));
const charMap=new Map(catalog.characters.map(c=>[c.id,c]));
function user(kind,id){return {...defaultProgress(kind),...profile[kind]?.[id]};}
function owned(kind,item){const p=user(kind,item.id);return kind==='achievements'?p.status==='done':kind==='items'?p.quantity>0:kind==='bonds'?p.bond_level>0:!!p.owned;}
function icon(c){const filename=c.small_portrait?.replace(/\.[^.]+$/,'')||c.id.slice(5);const fix=filename==='akane-rin'?'akane':filename;return iconsMap.get(fix)||null;}
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('visible'),3500)}
function safeStatus(text){const el=$('.save-state');if(el)el.textContent=text}
async function save(kind,id,data){profile[kind][id]=data;safeStatus('Saving to SQLite…');lastSaveOk=true;chain=chain.then(()=>invoke('save_user_progress',{kind,id,progress:data})).then(()=>{safeStatus('✓ Progress saved');return true}).catch(e=>{lastSaveOk=false;safeStatus('SAVE FAILED');alert('Could not save progress: '+String(e));return false});render();return chain;}
window.nteBeforeUpdate=async()=>{await chain;return lastSaveOk};
const statusNames={not_available:'Not Available',not_verified:'Not Verified',locked:'Locked',unlocked:'Unlocked',done:'Done'};
function bondStatus(c){const info=bondMap.get(c.id);const p=user('bonds',c.id);return interactionStatus(info?.has_interactions,p.bond_level,p.interactions_completed)}
function pill(label,css=''){return `<span class="v2-state ${css}">${esc(label)}</span>`}
function smallArt(c){const src=icon(c);return `<div class="v2-art ${c.rank==='A'?'rank-a':''}">${src?`<img src="${esc(src)}" alt="${esc(c.name)}">`:`<span aria-hidden="true">${esc(c.name.substring(0,2))}</span>`}</div>`}
function itemArt(item){const rarity=item.rarity||'unverified';return `<span class="v2-art square item-${esc(rarity)}" title="${esc(rarity)}"><span aria-hidden="true">◈</span></span>`}
function counts(){for(const k of GROUPS){const node=$('#nav-'+k);if(!node)continue;const arr=k==='bonds'?catalog.characters:catalog[k];node.textContent=`${arr.filter(c=>owned(k,c)).length}/${arr.length}`;}
 const shown=['characters','arcs','items','achievements'];$('#metrics').innerHTML=shown.map(k=>{const arr=catalog[k],n=arr.filter(c=>owned(k,c)).length;return `<div class="metric"><div class="metric-label">${LABELS[k].toUpperCase()}</div><div class="metric-value">${n}<span class="v2-total"> / ${arr.length}</span></div><div class="metric-meter"><span style="width:${arr.length?n*100/arr.length:0}%"></span></div><div class="metric-note">${k==='achievements'?'Completed':'Collected'} · Shared catalogue</div></div>`}).join('')}
function list(kind){const all=kind==='bonds'?catalog.characters:catalog[kind];return all.filter(c=>{
  if(query&&!`${c.name} ${c.category||''} ${c.rarity||''}`.toLowerCase().includes(query.toLowerCase()))return false;
  if(filter==='all')return true;
  const isOwned=owned(kind,c);
  if(filter==='owned')return isOwned;
  if(filter==='missing')return !isOwned;
  if(filter==='inprogress')return kind==='achievements'?user('achievements',c.id).status==='progress':false;
  return true;
})}
function entityChar(c){const r=user('characters',c.id),b=user('bonds',c.id);return `<article class="v2-entity ${r.owned?'active':''}">${smallArt(c)}<div class="v2-core"><div class="v2-name">${esc(c.name)} <span class="v2-rank">${c.rank}-RANK</span></div><div class="v2-sub">${r.owned?`Lv. ${r.level??'—'} / 80 · Awakening ${r.awakening_level??'—'} / 6 · Bond ${b.bond_level}/10`:'Not in your collection'}</div>${pill(r.owned?'OWNED':'NOT OWNED',r.owned?'owned':'')}</div><div class="v2-controls"><button data-action="toggle" data-kind="characters" data-id="${esc(c.id)}" class="v2-ownership ${r.owned?'active':''}">${r.owned?'✓ Owned':'+ Mark Owned'}</button><button class="btn ghost small" data-action="edit" data-kind="characters" data-id="${esc(c.id)}">Progress</button></div></article>`}
function entityArc(a){const r=user('arcs',a.id);return `<article class="v2-entity ${r.owned?'active':''}">${itemArt(a)}<div class="v2-core"><div class="v2-name">${esc(a.name)}</div><div class="v2-sub">${a.rarity?`${esc(a.rarity)} rarity · `:'Rarity pending verification · '}${r.owned?`Level ${r.level??'—'}/80 · Tier ${r.tier??'—'}/5`:'Not yet obtained'}</div>${pill(r.owned?'OWNED':'NOT OWNED',r.owned?'owned':'')}</div><div class="v2-controls"><button data-action="toggle" data-kind="arcs" data-id="${esc(a.id)}" class="v2-ownership ${r.owned?'active':''}">${r.owned?'✓ Owned':'+ Mark Owned'}</button><button class="btn ghost small" data-action="edit" data-kind="arcs" data-id="${esc(a.id)}">Progress</button></div></article>`}
function entityItem(i){const p=user('items',i.id),sources=sourcesFor(i.id,catalog.item_sources);return `<article class="v2-entity">${itemArt(i)}<div class="v2-core"><div class="v2-name">${esc(i.name)}</div><div class="v2-sub">${esc(i.category)} · ${esc(i.rarity)} · ${sources.length} known source(s)</div>${pill(p.quantity>0?'IN INVENTORY':'NOT OWNED',p.quantity>0?'owned':'')}</div><div class="v2-controls"><label>Quantity <input class="v2-quantity" aria-label="${esc(i.name)} quantity" data-action="quantity" data-id="${esc(i.id)}" type="number" min="0" step="1" value="${p.quantity||0}"></label><button class="btn ghost small" data-action="edit" data-kind="items" data-id="${esc(i.id)}">Sources / Notes</button></div></article>`}
function entityAchievement(a){const r=user('achievements',a.id);return `<article class="v2-entity"><div class="v2-art square">★</div><div class="v2-core"><div class="v2-name">${esc(a.name)}</div><div class="v2-sub">${esc(a.category||'Achievement')} · ${esc(a.description||'')}</div>${pill(r.status==='done'?'COMPLETED':r.status==='progress'?'IN PROGRESS':'NOT STARTED',r.status)}</div><div class="v2-controls"><select aria-label="${esc(a.name)} status" data-action="achievement-status" data-id="${esc(a.id)}"><option value="todo" ${r.status==='todo'?'selected':''}>Not Started</option><option value="progress" ${r.status==='progress'?'selected':''}>In Progress</option><option value="done" ${r.status==='done'?'selected':''}>Completed</option></select><button class="btn ghost small" data-action="edit" data-kind="achievements" data-id="${esc(a.id)}">Notes</button></div></article>`}
function entityBond(c){const b=user('bonds',c.id),info=bondMap.get(c.id)||{},gift=catalogItem(info.favorite_gift_id,catalog.items),s=gift?sourcesFor(gift.id,catalog.item_sources):[];const st=bondStatus(c);const art=icon(c);const giftInfo=gift?`<b>${esc(gift.name)}</b><small>${s.length?esc(s.map(v=>v.source_name+(v.stage?' · '+v.stage:'')).join('; ')):'Source not catalogued'}</small>`:'<span class="v2-sub">Favourite gift not catalogued</span>';return `<article class="v2-bond"><div class="v2-bond-art ${c.rank==='A'?'rank-a':'rank-s'}">${art?`<img src="${esc(art)}" alt="">`:esc(c.name.substring(0,2))}</div><div class="v2-bond-body"><h3>${esc(c.name)}</h3><p>Bond <b>${b.bond_level}/10</b> · <span>${esc(statusNames[st])}</span></p><p class="v2-bond-gift">${giftInfo}</p><p>Dateable: ${info.dateable===null?'Not Verified':info.dateable?'Yes':'No'}</p><button class="btn ghost small" data-action="edit" data-kind="bonds" data-id="${esc(c.id)}">Bond Progress</button></div></article>`}
function renderOverview(){const charCount=catalog.characters.length,arcCount=catalog.arcs.length;$('#count-line').textContent=`Catalog ${catalog.contentVersion} · Player progression stays in SQLite`;
 $('#list-heading').textContent='THE SHARED CATALOGUE';$('#list-description').textContent='Game data is global. Collection progress is yours.';
 $('#content').innerHTML=`<div class="v2-feature"><h2>YOUR WORLD. YOUR PROGRESSION.</h2><p>Every known character and Arc is in the app. Mark what you own, track upgrades and Bond, and keep your personal records separate from catalogue updates.</p><div class="v2-info-row"><span>${charCount} Characters</span><span>${arcCount} Arcs</span><span>Independent SQLite profile</span></div></div><div class="v2-shortcuts">${['characters','arcs','bonds','items'].map(k=>`<button data-action="tab" data-target="${k}"><b>${LABELS[k]}</b><small>Open catalogue</small> →</button>`).join('')}</div><div class="v2-caution">DEVELOPMENT FOUNDATION — names and IDs are seeded; unknown Arc rarities, Bond facts, life skill caps, and the complete item/achievement catalogues still require verification. Do not publish this as the complete v2.0.</div>`;}
function render(){counts();$('#page-title').textContent=LABELS[tab];$('#page-subtitle').textContent=tab==='overview'?'Shared game data · Personal progress':tab==='bonds'?'Gift data comes from the shared item catalogue':`Choose what you own, then track upgrades. `;
 $('#toolbar').classList.toggle('hidden',tab==='overview');$('#v2-filters').querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===filter));
 if(tab==='overview'){renderOverview();return;}
 const arr=list(tab);$('#list-heading').textContent=tab==='characters'?'CHARACTER DATABASE':tab==='arcs'?'ARC COLLECTION':tab==='bonds'?'BOND RECORDS':tab==='items'?'ITEMS & SOURCES':'ACHIEVEMENTS';$('#list-description').textContent=tab==='items'?'A source may be a drop, stage, shop, quest or event.':'Global entries are never created or deleted by the player.';$('#count-line').textContent=`${arr.length} shown · ${tab==='bonds'?catalog.characters.length:catalog[tab].length} total`;if(tab==='bonds'){$('#content').innerHTML=`<div class="v2-bond-grid">${arr.map(entityBond).join('')}</div>`;return;}
 const warnings=tab==='items'&&!catalog.items.length?'Item content and sources will be added after verification.':'',warning2=tab==='achievements'&&!catalog.achievements.length?'Achievement catalogue will be populated in a later stage.':'';
 $('#content').innerHTML=(warnings||warning2?`<div class="v2-caution">${esc(warnings||warning2)}</div>`:'')+`<div class="v2-list">${arr.map(x=>tab==='characters'?entityChar(x):tab==='arcs'?entityArc(x):tab==='items'?entityItem(x):entityAchievement(x)).join('')}</div>`;
}
function changeTab(k){tab=k;query='';filter='all';$('#search').value='';document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===k));render()}
function field(k,label,value,min,max,info=''){const maxAttr=max===null||max===undefined?'':` max="${max}"`;return `<label class="v2-field">${esc(label)} <input name="${esc(k)}" type="number" min="${min}"${maxAttr} step="1" value="${esc(value??'')}">${info?`<small>${esc(info)}</small>`:''}</label>`;}
function check(k,label,value){return `<label class="v2-field"><span><input type="checkbox" name="${esc(k)}" ${value?'checked':''}> ${esc(label)}</span></label>`}
function notes(k,label,value){return `<label class="v2-field full">${esc(label)}<textarea name="${esc(k)}" rows="2">${esc(value||'')}</textarea></label>`}
function progressField(k,label,value,min,max,unknown=false){return field(k,label,value,min,max,unknown?'Maximum not yet verified':'')}
function openEditor(kind,id){const c=kind==='bonds'?charMap.get(id):catalog[kind].find(x=>x.id===id);if(!c)return;editing={kind,id};$('#dialog-title').textContent=`${c.name} — ${LABELS[kind]}`;
 const p=user(kind,id);let h='';if(kind==='characters'){
   h=check('owned','Owned',p.owned)+field('level','Character Level',p.level,1,80)+field('awakening_level','Awakening',p.awakening_level,0,6);
   h+=SKILLS.map(([k,label,max])=>field(k,label,p[k],1,c[max])).join('');
   h+=check('passive_1_unlocked','Passive 1 unlocked',p.passive_1_unlocked)+check('passive_2_unlocked','Passive 2 unlocked',p.passive_2_unlocked);
   h+=progressField('life_skill_1_level','Life Skill 1',p.life_skill_1_level,0,c.life_skill_1_max,c.life_skill_1_max==null);
   if(c.life_skill_2_verified && c.life_skill_2_max===null)h+='<div class="v2-field">Life Skill 2 · not present</div>';
   else h+=progressField('life_skill_2_level','Life Skill 2',p.life_skill_2_level,0,c.life_skill_2_max,c.life_skill_2_max==null);
   h+=notes('notes','Notes',p.notes);
 }else if(kind==='arcs'){
   h=check('owned','Owned',p.owned)+field('level','Level',p.level,1,80)+field('tier','Tier',p.tier,1,5)+notes('notes','Notes',p.notes);
 }else if(kind==='bonds'){
   const info=bondMap.get(id),gift=catalogItem(info?.favorite_gift_id,catalog.items);const status=bondStatus(c);
   h=field('bond_level','Bond Level',p.bond_level,0,10)+`<div class="v2-field full"><strong>Interactions: ${esc(statusNames[status])}</strong><small>Automatically unlock at Bond Level 6 if this character has interactions. Global interaction data is currently pending verification.</small></div>`;
   h+=`<label class="v2-field"><span><input type="checkbox" name="interactions_completed" ${p.interactions_completed?'checked':''} ${info?.has_interactions!==true||p.bond_level<6?'disabled':''}> Interactions completed</span></label>`;
   h+=`<div class="v2-field full">Favourite Gift: ${esc(gift?.name||'Unknown / not yet catalogued')}</div>`;
 }else if(kind==='items'){
   h=field('quantity','Quantity',p.quantity,0,null)+notes('notes','Notes',p.notes);
   const sources=sourcesFor(id,catalog.item_sources);h+=`<div class="v2-field full"><b>Where to farm</b><p>${sources.length?sources.map(s=>esc(s.source_name)+(s.stage?' — '+esc(s.stage):'')+(s.price!==null&&s.price!==undefined?' · '+s.price:'')).join(' · '):'No verified sources yet.'}</p></div>`;
 }else h=field('current','Progress',p.current,0,null)+notes('observation','Observation',p.observation);
 $('#form-fields').innerHTML=h;$('#editor-dialog').showModal();
}
async function commitEditor(event){event.preventDefault();if(!editing)return;const {kind,id}=editing,c=kind==='bonds'?charMap.get(id):catalog[kind].find(x=>x.id===id),p=user(kind,id);const fd=new FormData(event.target);
 try{
  if(kind==='characters'){
   p.owned=fd.has('owned');p.level=parseInteger(fd.get('level'),1,80);p.awakening_level=parseInteger(fd.get('awakening_level'),0,6);
   for(const [key,,max] of SKILLS)p[key]=parseInteger(fd.get(key),1,c[max]);
   p.passive_1_unlocked=fd.has('passive_1_unlocked');p.passive_2_unlocked=fd.has('passive_2_unlocked');
   p.life_skill_1_level=parseInteger(fd.get('life_skill_1_level'),0,c.life_skill_1_max);
   if(!(c.life_skill_2_verified&&c.life_skill_2_max===null))p.life_skill_2_level=parseInteger(fd.get('life_skill_2_level'),0,c.life_skill_2_max);
   p.notes=String(fd.get('notes')||'');
  }else if(kind==='arcs'){
   p.owned=fd.has('owned');p.level=parseInteger(fd.get('level'),1,80);p.tier=parseInteger(fd.get('tier'),1,5);p.notes=String(fd.get('notes')||'');
  }else if(kind==='bonds'){
   p.bond_level=parseInteger(fd.get('bond_level'),0,10,false);if(bondMap.get(id)?.has_interactions===true && p.bond_level>=6)p.interactions_completed=fd.has('interactions_completed');
  }else if(kind==='items'){
   p.quantity=parseInteger(fd.get('quantity'),0,null,false);p.notes=String(fd.get('notes')||'');
  }else{
   p.current=parseInteger(fd.get('current'),0);p.observation=String(fd.get('observation')||'');
  }
 }catch(e){alert('Invalid progress: '+e.message);return;}
 $('#editor-dialog').close();editing=null;await save(kind,id,p);
}
async function backup(){if((await chain)===false || !lastSaveOk)return alert('Saving failed; cannot back up.');const {save:pick}=await import('@tauri-apps/plugin-dialog');const path=await pick({title:'Back up all NTE Tracker data',defaultPath:'nte-tracker-profile-'+new Date().toISOString().slice(0,10)+'.zip',filters:[{name:'ZIP archive',extensions:['zip']}]});if(path)try{await invoke('backup_zip',{path});toast('Backup saved: old data + v2 profile')}catch(e){alert('Backup failed: '+e)}}
async function restore(){if(!confirm('Restore backup? A safety backup will be created first.'))return;const {open:pick}=await import('@tauri-apps/plugin-dialog');const path=await pick({title:'Restore NTE Tracker ZIP',filters:[{name:'ZIP archive',extensions:['zip']}]});if(!path)return;try{if(!lastSaveOk || await chain===false)return alert('Resolve save error before restore');await invoke('restore_zip',{path});profile={characters:{},arcs:{},bonds:{},items:{},achievements:{},...await invoke('load_user_profile')};render();toast('Restore complete')}catch(e){alert('Restore failed: '+e)}}
function wire(){document.querySelectorAll('[data-tab]').forEach(el=>el.addEventListener('click',()=>changeTab(el.dataset.tab)));
 $('#v2-filters').addEventListener('click',ev=>{const b=ev.target.closest('[data-filter]');if(b){filter=b.dataset.filter;render()}});
 $('#search').addEventListener('input',ev=>{query=ev.target.value;render()});
 $('#editor-form').addEventListener('submit',commitEditor);
 $('#form-fields').addEventListener('input',ev=>{if(!editing||editing.kind!=='bonds'||ev.target.name!=='bond_level')return;const check=$('#form-fields input[name=interactions_completed]');if(check)check.disabled=bondMap.get(editing.id)?.has_interactions!==true||Number(ev.target.value)<6});
 document.addEventListener('click',async ev=>{const el=ev.target.closest('[data-action]');if(!el)return;const {action,kind,id,target}=el.dataset;
  if(action==='tab')changeTab(target);else if(action==='toggle'){const r=user(kind,id);await save(kind,id,acquiredDefaults(kind,r))}
  else if(action==='edit')openEditor(kind,id);
  else if(action==='close-modal')$('#editor-dialog').close();
  else if(action==='backup-zip')await backup();else if(action==='restore-zip')await restore();
  else if(action==='show-data-directory'){alert(await invoke('get_data_directory'))}
  else if(action==='import'||action==='clear'||action==='add'||action==='reset-excel')toast('Shared catalogue items are managed through app releases, not the player.');
  else if(action==='export-csv'||action==='export-json')toast('Use ZIP Backup for your complete player profile.');
 });
 document.addEventListener('change',async ev=>{const el=ev.target;
  if(el.dataset.action==='quantity'){try{const p=user('items',el.dataset.id);p.quantity=parseInteger(el.value,0,null,false);await save('items',el.dataset.id,p)}catch(e){alert(e.message);render()}}
  if(el.dataset.action==='achievement-status'){const p=user('achievements',el.dataset.id);p.status=el.value;await save('achievements',el.dataset.id,p)}
 });
}
try {verifyCatalog(catalog)}catch(e){$('#content').textContent='Invalid game catalogue: '+e.message;throw e}
wire();
invoke('load_user_profile').then(data=>{profile={...profile,...data};render();safeStatus('✓ Progress saved in SQLite')}).catch(err=>{$('#content').textContent='Unable to open SQLite profile: '+String(err);safeStatus('DATABASE ERROR')});
