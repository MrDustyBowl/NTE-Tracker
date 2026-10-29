import bundledCatalog from '../catalog/catalog.v2.json';
import {invoke} from '@tauri-apps/api/core';
import {SKILLS,defaultProgress,acquiredDefaults,parseInteger,interactionStatus,catalogItem,sourcesFor,verifyCatalog} from './catalog-rules.js';

// Tauri owns the remote catalogue and a validated offline cache. Only player progress enters SQLite.
let catalog=bundledCatalog;
const GROUPS=['characters','arcs','items','achievements'];
const LABELS={overview:'Overview',characters:'Characters',arcs:'Arcs',items:'Items',achievements:'Achievements'};
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons=import.meta.glob('./assets/roster-icons/*.{png,jpg,webp}',{eager:true,query:'?url',import:'default'});
const iconsMap=new Map(Object.entries(icons).map(([k,v])=>[k.split('/').at(-1).split('.')[0],v]));
let profile={characters:{},arcs:{},bonds:{},items:{},achievements:{}};
let tab='overview',filter='all',query='',editing=null,chain=Promise.resolve(),lastSaveOk=true;
let selectedCharId=null;
let bondMap=new Map(catalog.character_bonds.map(b=>[b.character_id,b]));
let charMap=new Map(catalog.characters.map(c=>[c.id,c]));
let checkingCatalog=false;
// Assets sync independently from global game data and personal SQLite progress.
let cachedImages=new Map(),availableImageKeys=new Set(),loadingImageKeys=new Set();
let checkingImages=false,assetRevision=0,assetRedrawTimer=null;
function artStatus(message,state='ok'){const node=$('#assets-status');if(node){node.textContent=message;node.dataset.state=state;}}
function scheduleArtRedraw(){if(assetRedrawTimer)return;assetRedrawTimer=setTimeout(()=>{assetRedrawTimer=null;render()},100);}
function requestImage(key){
  if(!availableImageKeys.has(key)||cachedImages.has(key)||loadingImageKeys.has(key))return;
  loadingImageKeys.add(key);
  invoke('read_cached_asset',{key}).then(value=>{
    if(typeof value==='string'&&value.startsWith('data:image/png;base64,')){
      cachedImages.set(key,value);scheduleArtRedraw();
    }
  }).catch(()=>{availableImageKeys.delete(key)}).finally(()=>loadingImageKeys.delete(key));
}
async function loadAssetIndex(){
  const result=await invoke('load_asset_library');
  const revision=Number(result.revision)||0;
  if(revision!==assetRevision)cachedImages.clear();
  assetRevision=revision;
  availableImageKeys=new Set(result.keys||[]);
  artStatus(revision?`Images r${revision} · ${availableImageKeys.size} cached · Offline ready`:'Images · Bundled fallback ready');
  scheduleArtRedraw();
}
async function refreshAssets(manual=false){
  if(checkingImages)return;
  checkingImages=true;
  const btn=$('#assets-check');if(btn)btn.disabled=true;
  artStatus('Checking images on GitHub…','checking');
  try{
    const outcome=await invoke('sync_asset_library');
    await loadAssetIndex();
    if(manual)toast(outcome.updated?`Image library updated to r${outcome.revision}`:outcome.downloaded?`${outcome.downloaded} image(s) repaired`:'Image library is already up to date.');
  }catch(e){
    artStatus(`Images r${assetRevision} · Offline fallback`,'offline');
    if(manual)toast(`Image check failed: ${String(e)}`);
  }finally{checkingImages=false;if(btn)btn.disabled=false;}
}

function catalogMessage(message, state=''){
  const el=$('#catalog-status');if(el){el.textContent=message;el.dataset.state=state;}
}
function setCatalog(next,source,updated=false){
  verifyCatalog(next);
  // Profiles are never cleared or rewritten on a catalogue replacement.
  catalog=next;
  bondMap=new Map(catalog.character_bonds.map(b=>[b.character_id,b]));
  charMap=new Map(catalog.characters.map(c=>[c.id,c]));
  catalogMessage(`Database r${catalog.catalogRevision} · ${source==='cache'?'Local cache':'Bundled backup'} · Offline ready`,'ok');
  if(updated)toast(`Shared database updated to revision ${catalog.catalogRevision}. Your progress is untouched.`);
  render();
}
async function refreshCatalog(manual=false){
  if(checkingCatalog)return;
  checkingCatalog=true;const button=$('#catalog-check');button.disabled=true;
  catalogMessage('Checking central database on GitHub…','checking');
  try{
    const result=await invoke('sync_game_catalog');
    setCatalog(result.catalog,result.source,result.updated);
    if(manual&&!result.updated)toast('Database is already up to date.');
  }catch(e){
    catalogMessage(`Database r${catalog.catalogRevision} · Offline mode (sync unavailable)`,'offline');
    if(manual)toast(`Database check failed: ${String(e)}`);
  }finally{checkingCatalog=false;button.disabled=false;}
}

function user(kind,id){return {...defaultProgress(kind),...profile[kind]?.[id]};}
function owned(kind,item){const p=user(kind,item.id);return kind==='achievements'?p.status==='done':kind==='items'?p.quantity>0:kind==='bonds'?p.bond_level>0:!!p.owned;}
function icon(c){
  const key=`avatar:${c.id}`;
  requestImage(key);
  const filename=c.small_portrait?.replace(/\.[^.]+$/,'')||c.id.slice(5);
  const fix=filename==='akane-rin'?'akane':filename;
  return cachedImages.get(key)||iconsMap.get(fix)||null;
}
function bigArt(c){const key=`portrait:${c.id}`;requestImage(key);return cachedImages.get(key)||icon(c);}
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
function renderCharacterWorkspace(){
  const roster=catalog.characters.filter(c=>!query || `${c.name} ${c.element||''}`.toLowerCase().includes(query.toLowerCase())).slice().sort((a,b)=>a.name.localeCompare(b.name));
  const acquired=roster.filter(c=>user('characters',c.id).owned),missing=roster.filter(c=>!user('characters',c.id).owned);
  const allOwned=catalog.characters.filter(c=>user('characters',c.id).owned);
  if(!selectedCharId||!charMap.has(selectedCharId)||!user('characters',selectedCharId).owned)selectedCharId=allOwned[0]?.id||null;
  const selected=selectedCharId?charMap.get(selectedCharId):null;
  const entry=c=>`<button type="button" class="cc-item ${selectedCharId===c.id?'selected':''}" data-action="select-char" data-id="${esc(c.id)}" title="${esc(c.name)}">${smallArt(c)}<span>${esc(c.name)}</span><b>${user('characters',c.id).owned?'›':'+'}</b></button>`;
  const panel=(title,contents)=>`<section class="cc-panel"><h3>${title}</h3>${contents}</section>`;
  function bar(kind,c,p,key,name,min,max){
    const val=p[key]??min;
    return `<label class="cc-progress"><span>${esc(name)} <strong>${val} / ${max}</strong></span><input type="range" min="${min}" max="${max}" step="1" value="${val}" data-progress-kind="${kind}" data-progress-field="${key}" data-id="${esc(c.id)}"></label>`;
  }
  function detail(c){
    const p=user('characters',c.id),b=user('bonds',c.id),info=bondMap.get(c.id)||{};
    const skills=[['basic_attack_level','Basic Attack','basic_attack_max','basic_attack'],['redirect_skill_level','Redirect Skill','redirect_skill_max','redirect_skill'],['ultimate_skill_level','Ultimate Skill','ultimate_skill_max','ultimate_skill'],['support_skill_level','Support Skill','support_skill_max','support_skill']];
    const art=bigArt(c),aw=p.awakening_level??0;
    const skillPanel=panel("COMBAT SKILLS",skills.map(([field,label,cap,key])=>bar('characters',c,p,field,c.skill_names?.[key]?`${label} · ${c.skill_names[key]}`:label,1,c[cap])).join('')+`<h4>PASSIVES</h4>`+[1,2].map(i=>`<label class="cc-check"><span>${esc(c.skill_names?.[`passive_${i}`]||`Passive ${i}`)}</span><input type="checkbox" data-progress-kind="characters" data-progress-field="passive_${i}_unlocked" data-id="${esc(c.id)}" ${p[`passive_${i}_unlocked`]?'checked':''}></label>`).join(''));
    const lifePanel=panel("LIFE SKILLS",[1,2].map(i=>{
      const max=c[`life_skill_${i}_max`],key=`life_skill_${i}_level`,name=c.skill_names?.[`life_skill_${i}`]||`Life Skill ${i}`;
      if(i===2&&c.life_skill_2_verified===true&&max===null)return '<p class="cc-note">No second Life Skill.</p>';
      if(max===null||max===undefined)return `<label class="cc-progress"><span>${esc(name)} <small>Max unverified</small></span><input class="cc-number" type="number" min="0" step="1" value="${esc(p[key]??'')}" placeholder="—" data-progress-kind="characters" data-progress-field="${key}" data-id="${esc(c.id)}"></label>`;
      return bar('characters',c,p,key,name,0,max);
    }).join(''));
    const gift=catalogItem(info.favorite_gift_id,catalog.items),sources=gift?sourcesFor(gift.id,catalog.item_sources):[];
    const interaction=interactionStatus(info.has_interactions,b.bond_level,b.interactions_completed);
    const bondPanel=panel("BOND",bar('bonds',c,b,'bond_level','Bond Level',0,10)+`<div class="cc-gift"><small>FAVORITE GIFT</small><b>${esc(gift?.name||'Not yet catalogued')}</b><small>${esc(sources.map(x=>x.source_name).join(' / '))}</small></div><p class="cc-note">Dateable: ${info.dateable===null?'Not verified':info.dateable?'Yes':'No'} · Interactions: ${esc(statusNames[interaction])}</p>`+(info.has_interactions===true?`<label class="cc-check"><span>Interactions completed</span><input type="checkbox" data-progress-kind="bonds" data-progress-field="interactions_completed" data-id="${esc(c.id)}" ${b.interactions_completed?'checked':''} ${b.bond_level<6?'disabled':''}></label>`:''));
    const awakenPanel=panel("AWAKENINGS",`<div class="cc-awaken-pips">${Array.from({length:6},(_,i)=>`<span class="${i<aw?'active':''}">A${i+1}</span>`).join('')}</div>`+bar('characters',c,p,'awakening_level','Awakening',0,6));
    return `<div class="cc-detail"><header class="cc-hero ${c.rank==='S'?'gold':'purple'}"><div class="cc-hero-image">${art?`<img src="${esc(art)}" alt="">`:'✦'}</div><div><small>CHARACTER PROFILE · ${esc(c.element||'Element unverified')}</small><h2>${esc(c.name)}</h2><p>${esc(c.rank)}-RANK · Awakening A${aw}/6</p>${bar('characters',c,p,'level','Character Level',1,80)}</div><button class="cc-remove" data-action="unown-char" data-id="${esc(c.id)}">Remove from collection</button></header><div class="cc-grid">${lifePanel}${skillPanel}${bondPanel}${awakenPanel}</div></div>`;
  }
  $('#list-heading').textContent='CHARACTER COLLECTION';
  $('#list-description').textContent='Select a character to manage their Skills, Bond and Awakening.';
  $('#count-line').textContent=`${allOwned.length} collected / ${catalog.characters.length}`;
  $('#content').innerHTML=`<div class="cc-layout"><div class="cc-center">${selected?detail(selected):'<div class="cc-empty"><h2>Your collection starts here</h2><p>Select a character from Not Collected to add them.</p></div>'}</div><aside class="cc-sidebar"><header><b>ROSTER</b><span>${allOwned.length}/${catalog.characters.length}</span></header><div class="cc-scroll"><div class="cc-group"><h3>COLLECTED (${acquired.length})</h3>${acquired.map(entry).join('')||'<p class="cc-note">No characters yet.</p>'}</div><div class="cc-group"><h3>NOT COLLECTED (${missing.length})</h3>${missing.map(entry).join('')||'<p class="cc-note">Collection complete!</p>'}</div></div></aside></div>`;
}
function renderOverview(){const charCount=catalog.characters.length,arcCount=catalog.arcs.length;$('#count-line').textContent=`Catalog ${catalog.contentVersion} · Player progression stays in SQLite`;
 $('#list-heading').textContent='THE SHARED CATALOGUE';$('#list-description').textContent='Game data is global. Collection progress is yours.';
 $('#content').innerHTML=`<div class="v2-feature"><h2>YOUR WORLD. YOUR PROGRESSION.</h2><p>Every known character and Arc is in the app. Mark what you own, track upgrades and Bond, and keep your personal records separate from catalogue updates.</p><div class="v2-info-row"><span>${charCount} Characters</span><span>${arcCount} Arcs</span><span>Independent SQLite profile</span></div></div><div class="v2-shortcuts">${['characters','arcs','items','achievements'].map(k=>`<button data-action="tab" data-target="${k}"><b>${LABELS[k]}</b><small>Open catalogue</small> →</button>`).join('')}</div><div class="v2-caution">DEVELOPMENT FOUNDATION — names and IDs are seeded; unknown Arc rarities, Bond facts, life skill caps, and the complete item/achievement catalogues still require verification. Do not publish this as the complete v2.0.</div>`;}
function render(){counts();$('#page-title').textContent=LABELS[tab];$('#page-subtitle').textContent=tab==='overview'?'Shared game data · Personal progress':tab==='bonds'?'Gift data comes from the shared item catalogue':`Choose what you own, then track upgrades. `;
 $('#toolbar').classList.toggle('hidden',tab==='overview');$('#v2-filters').hidden=tab==='characters';$('#v2-filters').querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===filter));
 if(tab==='overview'){renderOverview();return;}
 if(tab==='characters'){renderCharacterWorkspace();return;}
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
function wire(){
 $('#catalog-check').addEventListener('click',()=>refreshCatalog(true));
  $('#assets-check').addEventListener('click',()=>refreshAssets(true));
 document.querySelectorAll('[data-tab]').forEach(el=>el.addEventListener('click',()=>changeTab(el.dataset.tab)));
 $('#v2-filters').addEventListener('click',ev=>{const b=ev.target.closest('[data-filter]');if(b){filter=b.dataset.filter;render()}});
 $('#search').addEventListener('input',ev=>{query=ev.target.value;render()});
 $('#editor-form').addEventListener('submit',commitEditor);
 $('#form-fields').addEventListener('input',ev=>{if(!editing||editing.kind!=='bonds'||ev.target.name!=='bond_level')return;const check=$('#form-fields input[name=interactions_completed]');if(check)check.disabled=bondMap.get(editing.id)?.has_interactions!==true||Number(ev.target.value)<6});
 document.addEventListener('click',async ev=>{const el=ev.target.closest('[data-action]');if(!el)return;const {action,kind,id,target}=el.dataset;
  if(action==='tab')changeTab(target);else if(action==='select-char'){selectedCharId=id;const p=user('characters',id);if(!p.owned)await save('characters',id,acquiredDefaults('characters',p));else render()}
  else if(action==='unown-char'){const p=user('characters',id);p.owned=false;await save('characters',id,p)}
  else if(action==='toggle'){const r=user(kind,id);await save(kind,id,acquiredDefaults(kind,r))}
  else if(action==='edit')openEditor(kind,id);
  else if(action==='close-modal')$('#editor-dialog').close();
  else if(action==='backup-zip')await backup();else if(action==='restore-zip')await restore();
  else if(action==='show-data-directory'){alert(await invoke('get_data_directory'))}
  // Global catalogue editing is intentionally not exposed in the player UI.
 });
 document.addEventListener('change',async ev=>{const el=ev.target;
  if(el.dataset.progressKind){const k=el.dataset.progressKind,id=el.dataset.id,key=el.dataset.progressField,c=charMap.get(id);if(!c)return;const p=user(k,id);try{if(el.type==='checkbox')p[key]=!!el.checked;else if(el.value==='')p[key]=null;else{const max=k==='bonds'?10:key==='level'?80:key==='awakening_level'?6:key.startsWith('life_skill')?c[key.replace('_level','_max')]:10;p[key]=parseInteger(el.value,key==='level'||key==='basic_attack_level'||key==='redirect_skill_level'||key==='ultimate_skill_level'||key==='support_skill_level'?1:0,max??null,false)}if(key==='interactions_completed' && user('bonds',id).bond_level<6)return;await save(k,id,p)}catch(e){alert('Invalid value: '+String(e));render()}return;}

  if(el.dataset.action==='quantity'){try{const p=user('items',el.dataset.id);p.quantity=parseInteger(el.value,0,null,false);await save('items',el.dataset.id,p)}catch(e){alert(e.message);render()}}
  if(el.dataset.action==='achievement-status'){const p=user('achievements',el.dataset.id);p.status=el.value;await save('achievements',el.dataset.id,p)}
 });
}
try {verifyCatalog(catalog)}catch(e){$('#content').textContent='Invalid game catalogue: '+e.message;throw e}
wire();
Promise.all([invoke('load_user_profile'),invoke('load_game_catalog')]).then(([data,result])=>{
  profile={...profile,...data};
  setCatalog(result.catalog,result.source);
  safeStatus('✓ Progress saved in SQLite');
  // Non-blocking startup check; network failures never prevent offline use.
  void refreshCatalog(false);
  void loadAssetIndex().then(()=>refreshAssets(false)).catch(()=>artStatus('Images · Bundled fallback ready','offline'));
}).catch(err=>{
  $('#content').textContent='Unable to initialize local database: '+String(err);
  safeStatus('DATABASE ERROR');
});
