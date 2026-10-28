import ZANKOU_ART from './assets/zankou-reference.webp';
import ZANKOU_AVATAR from './assets/zankou-avatar.webp';
import { bundledArtworkFor, remoteArtworkFor } from './roster-art.js';
import { invoke } from '@tauri-apps/api/core';
import { save as nativeSave, open } from '@tauri-apps/plugin-dialog';

import AVA_LACRIMOSA from './assets/roster-icons/lacrimosa.png';
import AVA_JIUYUAN from './assets/roster-icons/jiuyuan.png';
import AVA_IROI from './assets/roster-icons/iroi.png';
import AVA_HOTORI from './assets/roster-icons/hotori.png';
import AVA_HATHOR from './assets/roster-icons/hathor.png';
import AVA_HANIEL from './assets/roster-icons/haniel.png';
import AVA_CHAOS from './assets/roster-icons/chaos.png';
import AVA_BLACKBIRD from './assets/roster-icons/blackbird.png';
import AVA_BAICANG from './assets/roster-icons/baicang.png';
import AVA_AURELIA from './assets/roster-icons/aurelia.png';
import AVA_AKANE from './assets/roster-icons/akane.png';
import AVA_ADLER from './assets/roster-icons/adler.png';
import AVA_FADIA from './assets/roster-icons/fadia.png';
import AVA_EDGAR from './assets/roster-icons/edgar.png';
import AVA_DAFFODILL from './assets/roster-icons/daffodill.png';
import AVA_CHIZ from './assets/roster-icons/chiz.png';
import AVA_ZERO from './assets/roster-icons/zero.png';
import AVA_ZANKOU from './assets/roster-icons/zankou.png';
import AVA_LINKO from './assets/roster-icons/linko.png';
import AVA_SAKIRI from './assets/roster-icons/sakiri.png';
import AVA_SKIA from './assets/roster-icons/skia.png';
import AVA_MINT from './assets/roster-icons/mint.png';
import AVA_NANALLY from './assets/roster-icons/nanally.png';
'use strict';
(() => {
const SKILLS=[['basic','Basic Attack'],['redirect','Redirect Skill'],['ultimate','Ultimate Skill'],['support','Support Skill'],['esper','Esper Cycle Upgrade'],['passive','Combat Passive'],['life1','Life Skill 1'],['life2','Life Skill 2']];
const TITLES={overview:['Overview','Your progression, all in one place.','Your current snapshot','Everything imported from the workbook, with live statistics.'],characters:['Characters','Track levels, every skill, Bond and Awakening.','Character roster','Every skill can be edited separately. Unknown values stay blank.'],arcs:['Arcs','Level and Tier tracking for your entire collection.','Arc collection','Quick-adjust any Level or Tier, and link Arcs to characters if you wish.'],bonds:['Bond & Gifts','Affection levels, favorite gifts, stores and interaction details.','Bond & Gifts','One shared Bond level per character, synced with the Characters section.'],achievements:['Achievements','Categories, rarity, notes and achievement progress.','Achievement tracker','Affection milestones can follow the matching character’s Bond automatically.']};
const $=s=>document.querySelector(s);
const clone=o=>JSON.parse(JSON.stringify(o));
const blank=()=>({characters:[],arcs:[],achievements:[]});
function normalizeStore(o){let t=blank();for(let k of Object.keys(t))t[k]=Array.isArray(o?.[k])?o[k].filter(x=>x&&typeof x==='object'):[];for(let c of t.characters){c.skills=c.skills||{};c.gift=c.gift||null;if(c.bond===undefined)c.bond=null;}return t}

let state=blank(),tab='overview',editId=null,filters={search:'',category:'all',status:'all',sort:'name'},toastTimer;
let selectedCharacterId=null,characterRosterFilter='all',characterRosterSort='name';
function uid(){return typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'item-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)}
function n(v){if(v===null||v===undefined||v==='')return null;let k=Number(String(v).replace(',','.'));return Number.isFinite(k)?Math.max(0,Math.floor(k)):null}
function disp(v){return v===null||v===undefined||v===''?'—':String(v)}
function safe(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
let saveQueue=Promise.resolve(),saveNumber=0;
const PORTRAITS=new Map();

const SMALL_AVATARS=new Map([
  ['lacrimosa',AVA_LACRIMOSA],['jiuyuan',AVA_JIUYUAN],['iroi',AVA_IROI],['hotori',AVA_HOTORI],
  ['hathor',AVA_HATHOR],['haniel',AVA_HANIEL],['chaos',AVA_CHAOS],['blackbird',AVA_BLACKBIRD],
  ['baicang',AVA_BAICANG],['aurelia',AVA_AURELIA],['akane',AVA_AKANE],['adler',AVA_ADLER],
  ['fadia',AVA_FADIA],['edgar',AVA_EDGAR],['daffodill',AVA_DAFFODILL],['chiz',AVA_CHIZ],
  ['zero',AVA_ZERO],['zankou',AVA_ZANKOU],['linko',AVA_LINKO],['sakiri',AVA_SAKIRI],
  ['skia',AVA_SKIA],['mint',AVA_MINT],['nanally',AVA_NANALLY]
]);
function save(){
  const snapshot=clone(state),number=++saveNumber;
  $('.save-state').lastChild.textContent=' Saving to SQLite...';
  // Serialize writes, so rapid +/- clicks can never save out of order.
  saveQueue=saveQueue.then(()=>invoke('save_state',{data:snapshot})).then(()=>{
    if(number===saveNumber)$('.save-state').lastChild.textContent=' Saved in SQLite';
    return true;
  }).catch(err=>{console.error(err);$('.save-state').lastChild.textContent=' SAVE FAILED — back up now';toast('SAVE FAILED: '+String(err));return false});
  return saveQueue;
}
async function hydratePortraits(){
  PORTRAITS.clear();
  const names=[...new Set([...state.characters,...state.arcs].flatMap(x=>[x.portrait,x.gift?.icon]).filter(Boolean))];
  await Promise.all(names.map(async name=>{
    try{PORTRAITS.set(name,await invoke('read_portrait',{fileName:name}));}catch(err){console.warn('Portrait not available',name,err)}
  }));
}
async function bootstrap(){
  try{state=normalizeStore(await invoke('load_state'));await hydratePortraits();setupTab('overview');}
  catch(err){console.error(err);$('#content').textContent='Unable to load SQLite data: '+String(err);alert('Unable to load the database: '+String(err));}
}
async function backupZip(){
  if((await saveQueue)===false)return toast('Cannot back up until saving works.');
  const path=await nativeSave({title:'Save complete NTE Tracker backup',defaultPath:'NTE-Tracker-'+new Date().toISOString().slice(0,10)+'.zip',filters:[{name:'ZIP backup',extensions:['zip']}]});
  if(!path)return;
  try{await invoke('backup_zip',{path});toast('Full backup saved, including portraits.');}catch(err){alert('Backup failed: '+String(err));}
}
async function restoreZip(){
  if(!confirm('Restore ZIP backup? This replaces your active records. The app will create a safety backup first.'))return;
  if((await saveQueue)===false)return toast('Resolve the saving error before restoring.');
  const path=await open({title:'Open NTE Tracker ZIP backup',multiple:false,filters:[{name:'ZIP backup',extensions:['zip']}]});
  if(!path)return;
  try{state=normalizeStore(await invoke('restore_zip',{path}));await hydratePortraits();setupTab('overview');toast('Backup restored successfully.');}
  catch(err){alert('Could not restore backup: '+String(err));}
}

function toast(s){let el=$('#toast');el.textContent=s;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),2900)}
function normalizedName(s){return String(s||'').toLowerCase().replaceAll('ll','l').replace(/[^a-z0-9]/g,'')}
// Ranks are opt-in: the old workbook does not specify S/A rank or item rarity.
function rankClass(rank){return String(rank||'').toUpperCase()==='S'?'rank-s':String(rank||'').toUpperCase()==='A'?'rank-a':'rank-unset'}
function rarityClass(rarity){let k=String(rarity||'').toLowerCase();return ['gold','purple','blue','green'].includes(k)?'rarity-'+k:'rarity-unset'}
function giftIcon(g){const custom=g?.icon&&PORTRAITS.get(g.icon);return custom?`<img src="${safe(custom)}" alt="Favorite gift icon">`:'<span class="gift-symbol" aria-hidden="true">✧</span>';}

function bondAchievement(a){if(!a.autoBond)return null;let m=String(a.description||'').match(/^Reach (.+?) Affection Lvl (\d+)\.?$/i);if(!m)return null;let c=state.characters.find(x=>normalizedName(x.name)===normalizedName(m[1]));return c&&c.bond!==null&&c.bond!==undefined?{current:n(c.bond),target:Number(m[2]),character:c.name}:null}
function achData(a){const linked=bondAchievement(a),current=linked?linked.current:n(a.current),target=linked?linked.target:n(a.target);let complete=!!a.completed||(target!==null&&target>0&&current!==null&&current>=target);let percent=target!==null&&target>0&&current!==null?Math.min(100,Math.round(current/target*100)):(complete?100:null);return {current,target,complete,percent,linked}}
function metric(title,value,note,symbol,percent=null){return `<div class="metric"><div class="metric-label"><span class="sym">${symbol}</span> ${safe(title)}</div><div class="metric-value">${safe(value)}</div><div class="metric-note">${safe(note)}</div>${percent!==null?`<div class="metric-meter"><span style="width:${Math.max(0,Math.min(100,percent))}%"></span></div>`:''}</div>`}
function renderMetrics(){let cs=state.characters,ar=state.arcs,ach=state.achievements,done=ach.filter(a=>achData(a).complete).length,b=cs.filter(c=>c.bond!==null).length;
let maxChars=cs.filter(c=>c.level>=80).length;let maxArcs=ar.filter(a=>a.tier>=5).length;
$('#metrics').innerHTML=[metric('Characters',cs.length,`${maxChars} at Level 80+`,'♟'),metric('Arcs',ar.length,`${maxArcs} at Tier 5+`,'◇'),metric('Bond records',b,`${cs.filter(c=>c.bond>=10&&c.bond!==null).length} at Bond Level 10+`,'♡'),metric('Achievements',`${done} / ${ach.length}`,ach.length?`${Math.round(done/ach.length*100)}% completed`:'No entries','★',ach.length?done/ach.length*100:0)].join('');
$('#nav-characters').textContent=cs.length;$('#nav-arcs').textContent=ar.length;$('#nav-bonds').textContent=b;$('#nav-achievements').textContent=ach.length;
}
function setupTab(t){tab=t;document.querySelector('.app').dataset.view=t;filters={search:'',category:'all',status:'all',sort:'name'};$('#search').value='';for(let b of document.querySelectorAll('[data-tab]')){b.classList.toggle('active',b.dataset.tab===t);b.setAttribute('aria-current',b.dataset.tab===t?'page':'false')}
let ti=TITLES[t];$('#page-title').textContent=ti[0];$('#page-subtitle').textContent=ti[1];$('#list-heading').textContent=ti[2];$('#list-description').textContent=ti[3];$('#toolbar').classList.toggle('hidden',t==='overview'||t==='characters');$('#csv-main').classList.toggle('hidden',t==='overview');$('#add-main').classList.toggle('hidden',t==='overview'||t==='bonds'||t==='characters');$('#add-main').textContent=t==='characters'?'＋ New Character':t==='arcs'?'＋ New Arc':'＋ New Achievement';
$('#category-filter').hidden=t!=='achievements';$('#status-filter').hidden=t!=='achievements';$('#status-filter').value='all';let opts=t==='characters'?[['name','Name A–Z'],['level','Highest level'],['bond','Highest Bond'],['awakening','Highest Awakening']]:t==='arcs'?[['name','Name A–Z'],['tier','Highest Tier'],['level','Highest Level']]:t==='bonds'?[['name','Name A–Z'],['bond','Highest Bond'],['store','Store']]:[['name','Name A–Z'],['category','Category'],['progress','Highest progress'],['rarity','Rarity']];$('#sort').innerHTML=opts.map(([k,v])=>`<option value="${k}">${v}</option>`).join('');$('#search').placeholder=t==='characters'?'Search characters...':t==='arcs'?'Search Arcs...':t==='bonds'?'Search character, gift, store, area...':'Search achievements...';render()}
function setupCategories(){let v=[...new Set(state.achievements.map(a=>a.category||'Uncategorized'))].sort();if(filters.category!=='all'&&!v.includes(filters.category))filters.category='all';$('#category-filter').innerHTML='<option value="all">All categories</option>'+v.map(x=>`<option value="${safe(x)}" ${filters.category===x?'selected':''}>${safe(x)}</option>`).join('')}
function render(){renderMetrics();if(tab==='overview'){renderOverview();return}if(tab==='achievements')setupCategories();let list=(tab==='bonds'?state.characters:state[tab]).slice(),q=filters.search.toLowerCase();if(q)list=list.filter(x=>{let h=tab==='characters'?[x.name,x.notes]:tab==='arcs'?[x.name,x.owner,x.notes]:tab==='bonds'?[x.name,x.gift?.name,x.gift?.store,x.gift?.location,x.gift?.interactions]:[x.name,x.category,x.description,x.rarity,x.observation];return h.join(' ').toLowerCase().includes(q)});
if(tab==='achievements'){if(filters.category!=='all')list=list.filter(a=>(a.category||'Uncategorized')===filters.category);if(filters.status==='done')list=list.filter(a=>achData(a).complete);if(filters.status==='todo')list=list.filter(a=>!achData(a).complete)}
let key=filters.sort;list.sort((a,b)=>{let av=key==='progress'?achData(a).percent:key==='store'?a.gift?.store:key==='price'?a.gift?.price:a[key];let bv=key==='progress'?achData(b).percent:key==='store'?b.gift?.store:key==='price'?b.gift?.price:b[key];if(['level','tier','awakening','bond','price','progress'].includes(key))return (bv??-1)-(av??-1)||String(a.name).localeCompare(String(b.name),'en');return String(av??'').localeCompare(String(bv??''),'en')||String(a.name).localeCompare(String(b.name),'en')});
const total=tab==='bonds'?state.characters.length:state[tab].length;$('#count-line').textContent=`${list.length} shown · ${total} total`;const oldRosterScroll=$('#roster-rows')?.scrollTop??null;
$('#content').innerHTML=tab==='characters'?renderCharacterWorkspace():list.length?(tab==='arcs'?`<div class="cards">${list.map(arcCard).join('')}</div>`:tab==='bonds'?`<div class="bond-grid">${list.map(bondCard).join('')}</div>`:`<div class="ach-list">${list.map(achievementCard).join('')}</div>`):emptyState(total>0);if(tab==='characters'&&oldRosterScroll!==null&&$('#roster-rows'))$('#roster-rows').scrollTop=oldRosterScroll;}
function renderOverview(){let incomplete=state.characters.filter(c=>c.bond!==null&&c.bond<10).sort((a,b)=>b.bond-a.bond).slice(0,7),unknown=state.characters.filter(c=>c.bond===null),done=state.achievements.filter(a=>achData(a).complete).length;
const entries=state.achievements.map(a=>({a,d:achData(a)})).filter(x=>!x.d.complete&&x.d.percent!==null).sort((a,b)=>b.d.percent-a.d.percent).slice(0,6),tier5=state.arcs.filter(a=>a.tier>=5).length,level80=state.arcs.filter(a=>a.level>=80).length;
$('#count-line').textContent='Original workbook: Sheet 1 (Characters + Arcs) • Sheet 2 (Bond & Gifts) • Sheet 3 (Achievements)';
$('#content').innerHTML=`<div class="overview-banner"><div class="overview-label">YOUR TRACKING SPACE</div><h2>All your progress. One dashboard.</h2><p>Imported from your Excel workbook. Update an entry anywhere and the statistics refresh automatically. Empty fields from the workbook are intentionally kept unknown.</p><div class="banner-actions"><button class="btn primary small" data-action="goto" data-target="characters">Explore Characters →</button><button class="btn small" data-action="goto" data-target="bonds">View Bond & Gifts →</button></div></div>
<div class="overview-panels"><div class="dashboard-panel"><div class="panel-top"><h3>Bond levels to finish</h3><span>${incomplete.length} highlighted</span></div>${incomplete.length?incomplete.map(c=>`<div class="dash-progress"><div class="dash-line"><span>${safe(c.name)}</span><b>${disp(c.bond)} / 10</b></div><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100,c.bond/10*100)}%"></div></div></div>`).join(''):'<p class="panel-muted">No unfinished tracked Bonds.</p>'}${unknown.length?`<p class="panel-muted">${unknown.length} characters have no Bond level recorded yet.</p>`:''}<button class="text-btn panel-link" data-action="goto" data-target="bonds">Manage Bonds ↗</button></div>
<div class="dashboard-panel"><div class="panel-top"><h3>Achievement progress</h3><span>${done} completed</span></div>${entries.length?entries.map(({a,d})=>`<div class="dash-progress"><div class="dash-line"><span title="${safe(a.name)}">${safe(a.name)}</span><b>${d.percent}%</b></div><div class="progress-track"><div class="progress-fill" style="width:${d.percent}%"></div></div></div>`).join(''):'<p class="panel-muted">No active progress data available.</p>'}<button class="text-btn panel-link" data-action="goto" data-target="achievements">Open Achievements ↗</button></div>
<div class="dashboard-panel"><div class="panel-top"><h3>Arc collection</h3><span>${state.arcs.length} tracked</span></div><div class="overview-mini-grid"><div><strong>${tier5}</strong><small>Tier 5+</small></div><div><strong>${level80}</strong><small>Level 80+</small></div></div><p class="panel-muted">Arc names, Levels and Tiers are imported from Sheet 1; associated characters are left blank until you set them.</p><button class="text-btn panel-link" data-action="goto" data-target="arcs">Manage Arcs ↗</button></div></div>`;
}
function actionBtn(id,kind){return `<div class="mini-actions"><button class="icon-btn" data-action="edit" data-kind="${kind}" data-id="${safe(id)}" title="Edit" aria-label="Edit">✎</button><button class="icon-btn" data-action="delete" data-kind="${kind}" data-id="${safe(id)}" title="Delete" aria-label="Delete">✕</button></div>`}
function stepper(kind,id,field,value){return `<span class="stepper"><button data-action="step" data-kind="${kind}" data-id="${safe(id)}" data-field="${safe(field)}" data-delta="-1" aria-label="Decrease ${safe(field)}" ${n(value)===null?'disabled':''}>−</button><span>${safe(disp(value))}</span><button data-action="step" data-kind="${kind}" data-id="${safe(id)}" data-field="${safe(field)}" data-delta="1" aria-label="Increase ${safe(field)}">+</button></span>`}
function characterCard(c){let avatar=c.portrait&&PORTRAITS.get(c.portrait)?`<img src="${safe(PORTRAITS.get(c.portrait))}" alt="">`:'♟';let skills=SKILLS.map(([k,name])=>`<div class="skill-item"><span class="skill-label" title="${safe(name)}">${safe(name)}</span>${k==='life2'&&(c.skills?.life2===null||c.skills?.life2===undefined)?'<span class="empty-life">Optional · unset</span>':stepper('characters',c.id,'skills.'+k,c.skills?.[k])}</div>`).join('');return `<article class="entity-card"><div class="card-top"><div class="entity-id"><div class="avatar large">${avatar}</div><div><div class="entity-name">${safe(c.name)}</div><div class="entity-type">CHARACTER</div></div></div>${actionBtn(c.id,'characters')}</div><div class="pill-row"><span class="pill teal">Level <strong>${safe(disp(c.level))}</strong></span><span class="pill">Bond <strong>${safe(disp(c.bond))}</strong></span><span class="pill lilac">Awakening <strong>${safe(disp(c.awakening))}</strong></span></div><div class="skill-heading">SKILLS · CLICK + / − TO ADJUST</div><div class="skill-grid">${skills}</div>${c.gift?.name?`<button class="gift-shortcut" data-action="goto" data-target="bonds" data-search="${safe(c.name)}">♡ Preferred gift: ${safe(c.gift.name)} ↗</button>`:''}</article>`}

// v1.2 — NTE-inspired three-column character command center.
function charImage(c,kind='portrait'){
  const small=kind==='avatar'?SMALL_AVATARS.get(normalizedName(c.name)):null;
  if(small)return `<img class="small-avatar-art" src="${safe(small)}" alt="${safe(c.name)} small icon" loading="lazy">`;
  const custom=c.portrait&&PORTRAITS.get(c.portrait);
  if(custom)return `<img src="${safe(custom)}" alt="${safe(c.name)} portrait">`;
  const bundled=bundledArtworkFor(c.name);
  if(bundled)return `<img src="${safe(bundled)}" alt="${safe(c.name)} character artwork" loading="lazy">`;
  // Keep the existing reference crop for Zankou, including offline operation.
  if(normalizedName(c.name)==='zankou')return `<img src="${kind==='avatar'?ZANKOU_AVATAR:ZANKOU_ART}" alt="Zankou (reference screenshot)">`;
  const art=remoteArtworkFor(c.name);
  if(art?.url){
    const source=kind==='avatar'?(art.fallback||art.url):art.url;
    const fallback=kind==='avatar'?art.url:(art.fallback||'');
    return `<img class="remote-art" src="${safe(source)}" alt="${safe(c.name)} character artwork" loading="lazy" data-portrait-name="${safe(c.name)}" data-portrait-fallback="${safe(fallback)}" data-portrait-attempt="0">`;
  }
  return `<span class="portrait-placeholder" aria-hidden="true">${safe(c.name.slice(0,2).toUpperCase())}</span>`;
}
function visibleRoster(){
  let list=state.characters.filter(c=>String(c.name||'').toLowerCase().includes(filters.search.toLowerCase()));
  if(characterRosterFilter==='max-level')list=list.filter(c=>(c.level??0)>=80);
  else if(characterRosterFilter==='needs-work')list=list.filter(c=>c.level===null||c.level===undefined||c.level<80);
  return list.sort((a,b)=>characterRosterSort==='level'?((b.level??-1)-(a.level??-1)||a.name.localeCompare(b.name,'en')):a.name.localeCompare(b.name,'en'));
}
function rosterRows(list){return list.map(c=>`<button type="button" class="roster-row ${rankClass(c.rank)} ${c.id===selectedCharacterId?'selected':''}" data-action="select-character" data-id="${safe(c.id)}" aria-pressed="${c.id===selectedCharacterId}">
  <span class="roster-avatar">${charImage(c,'avatar')}</span><span class="roster-data"><b>${safe(c.name)}</b><small>LV. ${safe(disp(c.level))} <i>✦</i> Bond ${safe(disp(c.bond))}</small></span><span class="roster-chevron">›</span></button>`).join('')||'<div class="roster-empty">No matching characters.</div>'}
function renderRosterOnly(){
  const list=visibleRoster();
  const rows=$('#roster-rows');if(!rows)return;
  rows.innerHTML=rosterRows(list);
  const count=$('#roster-count');if(count)count.textContent=`${list.length} / ${state.characters.length}`;
  // Keep focus and text cursor when searching. Only the matching roster changes.
}
function charSkill(c,key,label,icon){const value=c.skills?.[key];return `<div class="nte-skill">
  <span class="skill-disc">${icon}</span><div class="skill-meta"><b>${safe(label)}</b><small>LVL ${safe(disp(value))}${value===null||value===undefined?' · Not set':''}</small></div>
  ${stepper('characters',c.id,'skills.'+key,value)}</div>`}
function renderCharacterWorkspace(){
  if(!selectedCharacterId||!state.characters.some(c=>c.id===selectedCharacterId))selectedCharacterId=state.characters.find(c=>normalizedName(c.name)==='zankou')?.id||state.characters[0]?.id||null;
  let roster=visibleRoster();
  const c=state.characters.find(x=>x.id===selectedCharacterId);
  $('#count-line').textContent=`${state.characters.length} characters registered // Select a character to inspect their progress`;
  if(!c)return `<div class="empty-state"><div class="empty-icon">✦</div><h3>Your character archive is empty</h3><p>Add your first character to start tracking.</p><button class="btn primary" data-action="add" data-kind="characters">+ Add Character</button></div>`;
  const linked=state.arcs.filter(a=>normalizedName(a.owner)===normalizedName(c.name));
  const g=c.gift||{};
  const avatar=charImage(c,'portrait');
  const level=Math.max(0,Math.min(100,(c.level??0)/80*100));
  const awk=Math.max(0,Math.min(6,c.awakening??0));
  const stars=Array.from({length:6},(_,i)=>`<span class="awakening-star ${i<awk?'lit':''}">✦</span>`).join('');
  return `<div class="character-workspace">
  <aside class="roster-panel nte-panel">
    <div class="ribbon-header"><span class="ribbon-kicker">/// UNIT ARCHIVE</span><strong>CHARACTERS</strong><span class="ribbon-decoration">NTE</span></div>
    <div class="roster-control"><label class="roster-search">⌕ <input id="roster-search" type="search" autocomplete="off" placeholder="Search characters..." value="${safe(filters.search)}"></label><select id="roster-sort" aria-label="Sort characters"><option value="name" ${characterRosterSort==='name'?'selected':''}>A–Z</option><option value="level" ${characterRosterSort==='level'?'selected':''}>Level ↓</option></select></div>
    <div class="roster-pills"><button data-action="char-filter" data-value="all" class="${characterRosterFilter==='all'?'active':''}">All</button><button data-action="char-filter" data-value="max-level" class="${characterRosterFilter==='max-level'?'active':''}">Lv. 80+</button><button data-action="char-filter" data-value="needs-work" class="${characterRosterFilter==='needs-work'?'active':''}">Below 80</button></div>
    <div class="roster-index">UNIT ROSTER <span id="roster-count">${roster.length} / ${state.characters.length}</span></div>
    <div class="roster-rows" id="roster-rows">${rosterRows(roster)}</div>
    <button type="button" class="add-roster" data-action="add" data-kind="characters">＋ ADD CHARACTER</button>
  </aside>
  <section class="profile-center">
    <article class="hero-card nte-panel ${rankClass(c.rank)}">
      <div class="hero-background-mark">NEVERNESS</div><div class="hero-diagonal">EVERNESS // UNIT PROFILE</div>
      <div class="hero-portrait ${!c.portrait&&(bundledArtworkFor(c.name)||remoteArtworkFor(c.name))?'catalog-portrait':''} ${c.portrait?'custom':''} ${normalizedName(c.name)==='zankou'&&!c.portrait?'reference-portrait':''}">${avatar}</div>
      <div class="hero-identity"><div class="hero-overline">CHARACTER DATABASE <span>/// ${safe(String(state.characters.indexOf(c)+1).padStart(3,'0'))}</span></div><h2>${safe(c.name)}</h2>${['S','A'].includes(c.rank)?`<span class="char-rank-label ${rankClass(c.rank)}">${safe(c.rank)}-RANK</span>`:''}<div class="hero-level"><b>LVL <span>${safe(disp(c.level))}</span></b><span class="level-slash">/ 80</span></div><div class="hero-progress"><span style="width:${level}%"></span></div><div class="hero-star-row">${stars}</div><div class="hero-buttons"><button class="btn primary small" data-action="edit" data-kind="characters" data-id="${safe(c.id)}">✎ EDIT PROFILE / PHOTO</button><button class="btn ghost small" data-action="delete" data-kind="characters" data-id="${safe(c.id)}">✕ Delete</button></div></div>
      <div class="hero-bottom-strip"><span>PERSONAL TRACKER</span><span>LOCAL DATABASE <i>●</i> SYNCED</span></div>
    </article>
    <article class="ability-panel nte-panel">
      <div class="panel-sticker"><span>01 / COMBAT</span><h3>ESPER ABILITY</h3><span class="sticker-check">✦ TRACK SKILLS</span></div>
      <div class="ability-grid">${charSkill(c,'basic','Basic Attack','⚔')}${charSkill(c,'redirect','Redirect Skill','➠')}${charSkill(c,'ultimate','Ultimate Skill','✹')}${charSkill(c,'support','Support Skill','✧')}${charSkill(c,'esper','Esper Cycle Upgrade','◎')}${charSkill(c,'passive','Combat Passive','◈')}</div>
      <div class="life-header"><span class="life-sticker">LIFE SKILLS</span><span class="life-note">SIDE PROGRESSION //</span></div>
      <div class="ability-grid life-grid">${charSkill(c,'life1','Life Skill 1','✿')}${c.skills?.life2===null||c.skills?.life2===undefined?`<div class="nte-skill optional"><span class="skill-disc">⊘</span><div class="skill-meta"><b>Life Skill 2</b><small>Optional / not assigned</small></div><button data-action="edit" data-kind="characters" data-id="${safe(c.id)}" class="btn ghost small">Set up</button></div>`:charSkill(c,'life2','Life Skill 2','✿')}</div>
    </article>
  </section>
  <aside class="inspector-column">
    <article class="inspector-card nte-panel"><div class="inspector-title"><span>◈</span><h3>CHARACTER STATUS</h3><small>01</small></div>
      <div class="stat-strip"><div>LEVEL</div><strong>${safe(disp(c.level))}<span> / 80</span></strong></div>
      <div class="inspector-meter"><span style="width:${level}%"></span></div>
      <div class="stat-strip"><div>AWAKENING</div><strong>Lv. ${safe(disp(c.awakening))}</strong></div>
      <div class="awakening-chain">${Array.from({length:6},(_,i)=>`<span class="awaken-dot ${i<awk?'active':''}">${i<awk?'✦':i+1}</span>`).join('')}</div>
      <div class="stat-adjust"><span>Adjust Awakening</span>${stepper('characters',c.id,'awakening',c.awakening)}</div>
    </article>
    <article class="inspector-card nte-panel"><div class="inspector-title"><span>♡</span><h3>BOND &amp; GIFTS</h3><small>02</small></div>
      <div class="bond-hero-number"><span>AFFECTION LEVEL</span><b>${safe(disp(c.bond))}</b>${stepper('bonds',c.id,'bond',c.bond)}</div>
      <div class="pink-divider"></div><div class="inspector-gift-preview"><span class="item-icon-frame ${rarityClass(g.rarity)}">${giftIcon(g)}</span><div class="gift-info"><span>FAVORITE GIFT</span><strong>${safe(g.name||'Not specified')}</strong><small>Price: ${safe(disp(g.price))}</small></div></div>
      <button type="button" class="inspector-link" data-action="edit" data-kind="bonds" data-id="${safe(c.id)}">EDIT AFFECTION DETAILS ↗</button>
    </article>
    <article class="inspector-card nte-panel"><div class="inspector-title"><span>▣</span><h3>LINKED ARCS</h3><small>03</small></div>
      ${linked.length?linked.slice(0,4).map(a=>`<div class="linked-arc"><span class="arc-orbit">◇</span><div><b>${safe(a.name)}</b><small>LV. ${safe(disp(a.level))} / TIER ${safe(disp(a.tier))}</small></div></div>`).join(''):'<p class="inspector-empty">No Arcs linked to this character yet.</p>'}
      <button type="button" class="inspector-link" data-action="goto" data-target="arcs">OPEN ARC COLLECTION ↗</button>
    </article>
    ${c.notes?`<div class="character-notes"><span>/// PERSONAL NOTES</span><p>${safe(c.notes)}</p></div>`:''}
  </aside>
</div>`;
}
function arcCard(a){return `<article class="entity-card arc-card"><div class="card-top"><div class="entity-id"><div class="avatar arc-avatar item-icon-frame ${rarityClass(a.rarity)}">◇</div><div><div class="entity-name">${safe(a.name)}</div><div class="entity-type">ARC ${a.rarity?`/ ${safe(a.rarity.toUpperCase())}`:''}</div></div></div>${actionBtn(a.id,'arcs')}</div><div class="arc-stats"><div class="arc-stat"><div class="arc-stat-name">Level</div><div class="arc-stat-bottom"><div class="arc-stat-value">${safe(disp(a.level))}</div>${stepper('arcs',a.id,'level',a.level)}</div></div><div class="arc-stat"><div class="arc-stat-name">Tier</div><div class="arc-stat-bottom"><div class="arc-stat-value">${safe(disp(a.tier))}</div>${stepper('arcs',a.id,'tier',a.tier)}</div></div></div>${a.owner?`<div class="arc-owner">Linked Character: <strong>${safe(a.owner)}</strong></div>`:''}</article>`}
function bondCard(c){
 const g=c.gift||{};
 const rank=rankClass(c.rank),rarity=rarityClass(g.rarity);
 return `<article class="bond-card nte-panel ${rank}">
   <div class="bond-portrait-panel ${rank}">
     <div class="bond-portrait-image ${!c.portrait&&(bundledArtworkFor(c.name)||remoteArtworkFor(c.name))?'catalog-portrait':''}">${charImage(c,'portrait')}</div>
     <div class="bond-portrait-caption"><span>/// UNIT FILE</span><strong>${safe(c.name)}</strong>${c.rank?`<span class="bond-rank-label">${safe(c.rank)}-RANK</span>`:''}</div>
   </div>
   <div class="bond-card-main">
     <div class="bond-card-header"><div><span class="bond-overline">AFFECTION / PERSONAL RECORD</span><h3>${safe(c.name)}</h3></div><button class="btn small" data-action="edit" data-kind="bonds" data-id="${safe(c.id)}">✎ Edit Bond &amp; Gift</button></div>
     <div class="bond-status-row"><div><span>Bond Level</span><strong>${safe(disp(c.bond))}<small> / 10</small></strong></div>${stepper('bonds',c.id,'bond',c.bond)}</div>
     <div class="bond-progress" aria-label="Bond progress"><span style="width:${c.bond===null?0:Math.min(100,c.bond*10)}%"></span></div>
     <div class="bond-card-content">
       <div class="bond-preferred-item"><span class="item-icon-frame ${rarity}">${giftIcon(g)}</span><div class="bond-item-copy"><small>FAVORITE GIFT</small><b>${safe(g.name||'Not specified')}</b><span>Price <strong>${safe(disp(g.price))}</strong></span>${g.rarity?`<em>${safe(g.rarity)} rarity</em>`:''}</div></div>
       <div class="bond-details"><div><small>Store</small><b>${safe(disp(g.store))}</b></div><div><small>Location</small><b>${safe(disp(g.location))}</b></div><div><small>Dateable?</small><b>${safe(disp(g.dateable))}</b></div><div><small>Interactions</small><b>${safe(disp(g.interactions))}</b></div></div>
     </div>
     ${c.notes?`<p class="bond-note">${safe(c.notes)}</p>`:''}
     ${g.sourceName&&g.sourceName!==c.name?`<div class="bond-footnote">Workbook alias: ${safe(g.sourceName)}</div>`:''}
   </div>
 </article>`;
}
function achievementCard(a){let d=achData(a),percent=d.percent;return `<article class="achievement ${d.complete?'done':''}"><div><div class="ach-head"><h3>${safe(a.name)}</h3><span class="ach-category">${safe(a.category||'Uncategorized')}</span>${a.rarity?`<span class="ach-rarity">${safe(a.rarity)}</span>`:''}</div>${a.description?`<p class="ach-desc">${safe(a.description)}</p>`:''}${a.observation?`<p class="ach-obs"><b>Observation:</b> ${safe(a.observation)}</p>`:''}${d.linked?`<span class="auto-pill">↻ Auto-tracked from ${safe(d.linked.character)}'s Bond</span>`:''}</div><div class="achievement-progress"><div class="ach-progress-label"><span>PROGRESS</span><strong>${safe(disp(d.current))} / ${safe(disp(d.target))} · ${d.complete?'Completed':percent===null?'Not tracked':percent+'%'}</strong></div><div class="progress-track"><div class="progress-fill" style="width:${d.complete?100:percent||0}%"></div></div><div class="ach-progress-actions">${d.linked?'<span class="panel-muted">Bond-linked</span>':stepper('achievements',a.id,'current',a.current)}<label class="complete-checkbox"><input type="checkbox" data-action="complete" data-id="${safe(a.id)}" ${d.complete?'checked':''}> Completed</label></div></div><div class="ach-actions">${actionBtn(a.id,'achievements')}</div></article>`}
function emptyState(filtered){return `<div class="empty-state"><div class="empty-icon">⌕</div><h3>${filtered?'No matching entries':'Nothing here yet'}</h3><p>${filtered?'Try another search or reset your filters.':'Add your first entry to start tracking.'}</p>${filtered?'<button class="btn" data-action="reset-filters">Reset filters</button>':tab==='bonds'?'<button class="btn primary" data-action="goto" data-target="characters">Add a Character</button>':'<button class="btn primary" data-action="add">＋ Add an entry</button>'}</div>`}
function fInput(name,label,value=null,opts={}){let type=opts.type||'text';return `<div class="field ${opts.wide?'wide':''}"><label for="f-${name}">${safe(label)}${opts.required?' *':''}</label><input id="f-${name}" name="${name}" type="${type}" ${type==='number'?'min="0" step="1"':''} value="${safe(value??'')}" ${opts.required?'required':''} ${opts.list?`list="${opts.list}"`:''} placeholder="${safe(opts.placeholder||'')}"></div>`}
function fArea(name,label,value=''){return `<div class="field wide"><label for="f-${name}">${safe(label)}</label><textarea id="f-${name}" name="${name}" rows="3">${safe(value??'')}</textarea></div>`}
function fSelect(name,label,value,choices){return `<div class="field"><label for="f-${name}">${safe(label)}</label><select name="${name}" id="f-${name}">${choices.map(([v,l])=>`<option value="${safe(v)}" ${String(value??'')===String(v)?'selected':''}>${safe(l)}</option>`).join('')}</select></div>`}
function openEditor(kind=tab,item=null){if(!['characters','arcs','bonds','achievements'].includes(kind))return;editId=item?.id||null;let isEdit=!!item;$('#dialog-title').textContent=`${isEdit?'Edit':'New'} ${kind==='bonds'?'Bond & Gift':kind==='characters'?'Character':kind==='arcs'?'Arc':'Achievement'}`;const el=$('#form-fields');$('#editor-form').dataset.kind=kind;
if(kind==='characters'){let sk=item?.skills||{};el.innerHTML=fInput('name','Character name',item?.name,{wide:true,required:true})+fInput('level','Level',item?.level,{type:'number'})+fInput('bond','Bond Level',item?.bond,{type:'number'})+fInput('awakening','Awakening',item?.awakening,{type:'number'})+fSelect('rank','Character Rank',item?.rank,[['','Unspecified'],['S','S-Rank · Gold border'],['A','A-Rank · Purple border']])+'<div class="form-divider">Skills (blank = unknown)</div>'+SKILLS.filter(([k])=>k!=='life2').map(([k,label])=>fInput('skill_'+k,label,sk[k],{type:'number'})).join('')+`<div class="field wide"><label class="checkline"><input type="checkbox" id="life2-toggle" ${sk.life2!==null&&sk.life2!==undefined?'checked':''}> This character has a second Life Skill</label></div><div id="life2-field" class="${sk.life2!==null&&sk.life2!==undefined?'':'hidden'}">${fInput('skill_life2','Life Skill 2',sk.life2,{type:'number'})}</div>`+`<div class="field wide"><label for="f-portraitFile">Character portrait (PNG, JPG or WebP · maximum 5 MB)</label><input id="f-portraitFile" name="portraitFile" type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"></div>${item?.portrait?'<div class="field wide"><label class="checkline"><input type="checkbox" name="removePortrait"> Remove the current portrait</label></div>':''}`+fArea('notes','Personal notes',item?.notes);
el.querySelector('#life2-toggle').addEventListener('change',e=>el.querySelector('#life2-field').classList.toggle('hidden',!e.target.checked));
}else if(kind==='arcs'){el.innerHTML=fInput('name','Arc name',item?.name,{wide:true,required:true})+fInput('level','Level',item?.level,{type:'number'})+fInput('tier','Tier',item?.tier,{type:'number'})+fSelect('rarity','Item Rarity (optional)',item?.rarity,[['','Unspecified'],['gold','Gold'],['purple','Purple'],['blue','Blue'],['green','Green']])+fInput('owner','Linked Character (optional)',item?.owner,{wide:true,list:'character-suggestions'})+fArea('notes','Notes',item?.notes);
}else if(kind==='bonds'){if(!item)return;let g=item.gift||{};el.innerHTML=`<div class="form-divider">${safe(item.name)} · Affection</div>`+fInput('bond','Bond Level',item.bond,{type:'number'})+'<div class="form-divider">Preferred gift & other details</div>'+fInput('giftName','Item / Preferred Gift',g.name,{wide:true}) +fInput('giftPrice','Price',g.price,{type:'number'})+fSelect('giftRarity','Item Rarity / Background',g.rarity,[['','Unspecified'],['gold','Gold'],['purple','Purple'],['blue','Blue'],['green','Green']])+`<div class="field wide"><label for="f-giftIconFile">Gift icon (PNG, JPG or WebP · max 5 MB)</label><input id="f-giftIconFile" name="giftIconFile" type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"></div>${g.icon?'<div class="field wide"><label class="checkline"><input type="checkbox" name="removeGiftIcon"> Remove current gift icon</label></div>':''}`+fInput('giftStore','Store',g.store)+fInput('giftLocation','Location',g.location)+fSelect('dateable','Dateable?',g.dateable,[['','Unknown / Not specified'],['Yes','Yes'],['No','No']])+fInput('interactions','Interactions',g.interactions,{list:'interaction-options'})+fArea('notes','Other notes',item.notes)+`<datalist id="interaction-options"><option value="Done"><option value="Locked"><option value="In progress"></datalist>`;
}else{el.innerHTML=fInput('category','Category',item?.category,{required:true})+fInput('name','Achievement Name',item?.name,{wide:true,required:true})+fArea('description','Description',item?.description)+fInput('rarity','Rarity',item?.rarity,{list:'rarity-suggestions',placeholder:'Leave blank if unknown'})+'<div class="form-divider">Progress (blank = unknown)</div>'+fInput('current','Current progress',item?.current,{type:'number'})+fInput('target','Target',item?.target,{type:'number'})+fArea('observation','Observation / Notes',item?.observation)+`<div class="field wide"><label class="checkline"><input type="checkbox" name="autoBond" ${item?.autoBond?'checked':''}> Auto-track this affection milestone using Bond Level, if the description matches</label></div><div class="field wide"><label class="checkline"><input name="completed" type="checkbox" ${item?.completed?'checked':''}> Mark as completed manually</label></div>`}
$('#character-suggestions').innerHTML=state.characters.map(c=>`<option value="${safe(c.name)}"></option>`).join('');$('#editor-dialog').showModal();setTimeout(()=>el.querySelector('[name="name"], [name="bond"]')?.focus(),40)}
async function handleForm(ev){ev.preventDefault();let kind=ev.currentTarget.dataset.kind,fd=new FormData(ev.currentTarget),prev=editId?(kind==='bonds'?state.characters:state[kind]).find(x=>x.id===editId):null;
if(kind==='bonds'){if(!prev)return;let g={...(prev.gift||{})};g.name=String(fd.get('giftName')||'').trim()||null;g.price=n(fd.get('giftPrice'));g.rarity=String(fd.get('giftRarity')||'').trim()||null;g.icon=fd.get('removeGiftIcon')==='on'?null:(g.icon||null);
  const picture=fd.get('giftIconFile');
  if(picture&&picture.size){
    if(picture.size>5*1024*1024){toast('Gift icon must be smaller than 5 MB.');return;}
    try{const bytes=Array.from(new Uint8Array(await picture.arrayBuffer()));g.icon=await invoke('save_portrait',{bytes});PORTRAITS.set(g.icon,await invoke('read_portrait',{fileName:g.icon}));}
    catch(err){alert('Could not save gift icon: '+String(err));return;}
  }
  // Preserve the previously imported affection value for lossless backup compatibility; it is no longer displayed or edited.
  g.store=String(fd.get('giftStore')||'').trim()||null;g.location=String(fd.get('giftLocation')||'').trim()||null;g.dateable=String(fd.get('dateable')||'')||null;g.interactions=String(fd.get('interactions')||'').trim()||null;
  prev.bond=n(fd.get('bond'));prev.gift=g;prev.notes=String(fd.get('notes')||'').trim();
}else{let name=String(fd.get('name')||'').trim();if(!name){toast('A name is required.');return}let row={id:prev?.id||uid(),name};if(kind==='characters'){row.level=n(fd.get('level'));row.bond=n(fd.get('bond'));row.awakening=n(fd.get('awakening'));row.rank=String(fd.get('rank')||'').toUpperCase()||null;row.gift=prev?.gift||null;row.portrait=fd.get('removePortrait')==='on'?null:(prev?.portrait||null);
  const picture=fd.get('portraitFile');
  if(picture&&picture.size){
    if(picture.size>5*1024*1024){toast('Portrait must be smaller than 5 MB.');return;}
    try{
      const bytes=Array.from(new Uint8Array(await picture.arrayBuffer()));
      row.portrait=await invoke('save_portrait',{bytes});
      PORTRAITS.set(row.portrait,await invoke('read_portrait',{fileName:row.portrait}));
    }catch(err){alert('Could not save portrait: '+String(err));return;}
  }
  row.notes=String(fd.get('notes')||'').trim();row.skills={};for(let [key] of SKILLS)row.skills[key]=key==='life2'&&!$('#life2-toggle').checked?null:n(fd.get('skill_'+key));
}else if(kind==='arcs'){row.level=n(fd.get('level'));row.tier=n(fd.get('tier'));row.rarity=String(fd.get('rarity')||'')||null;row.owner=String(fd.get('owner')||'').trim()||null;row.notes=String(fd.get('notes')||'').trim();
}else{row.category=String(fd.get('category')||'').trim();row.description=String(fd.get('description')||'').trim();row.rarity=String(fd.get('rarity')||'').trim()||null;row.current=n(fd.get('current'));row.target=n(fd.get('target'));row.observation=String(fd.get('observation')||'').trim()||null;row.autoBond=fd.get('autoBond')==='on';row.completed=fd.get('completed')==='on';}
if(prev)Object.assign(prev,row);else state[kind].push(row);if(kind==='characters')selectedCharacterId=row.id;}if(!await save())return;$('#editor-dialog').close();render();toast(prev?'Changes saved.':'Entry added.')}
function changeStep(kind,id,field,delta){let x=(kind==='bonds'?state.characters:state[kind])?.find(e=>e.id===id);if(!x)return;let target=x,key=field;if(field.startsWith('skills.')){target=x.skills||{};key=field.slice(7)}let before=n(target[key]);if(before===null&&delta<0)return;target[key]=Math.max(0,(before??0)+delta);if(kind==='achievements'&&field==='current'&&x.completed&&x.target!==null&&target[key]<x.target)x.completed=false;save();render()}
function removeItem(kind,id){if(kind==='bonds'){toast('Edit the Bond details from this section.');return}let x=state[kind]?.find(v=>v.id===id);if(!x)return;if(!confirm(`Delete “${x.name}”? You can only recover it from a backup.`))return;state[kind]=state[kind].filter(v=>v.id!==id);save();render();toast('Entry deleted.')}
function download(text,file,mime){let blob=new Blob([text],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=file;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
function backup(){download(JSON.stringify({app:'NTE Tracker',version:2,exportedAt:new Date().toISOString(),...state},null,2),'NTE-Tracker-backup-'+new Date().toISOString().slice(0,10)+'.json','application/json;charset=utf-8');toast('Full JSON backup downloaded.')}
const COLS={characters:['Name','Level','Bond','Awakening','Rank',...SKILLS.map(([,l])=>l),'Notes'],arcs:['Name','Level','Tier','Rarity','Associated Character','Notes'],bonds:['Character','Bond Level','Item','Price','Rarity','Store','Location','Dateable?','Interactions','Notes'],achievements:['Category','Name','Description','Rarity','Current','Target','Observation','Completed','Auto Bond']};
function csvCell(x){let s=String(x??'');if(/^[=+@\-\t\r]/.test(s)&&!/^-[0-9.]+$/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'}
function csvRows(kind){return (kind==='bonds'?state.characters:state[kind]).map(x=>kind==='characters'?[x.name,x.level,x.bond,x.awakening,x.rank,...SKILLS.map(([k])=>x.skills?.[k]),x.notes]:kind==='arcs'?[x.name,x.level,x.tier,x.rarity,x.owner,x.notes]:kind==='bonds'?[x.name,x.bond,x.gift?.name,x.gift?.price,x.gift?.rarity,x.gift?.store,x.gift?.location,x.gift?.dateable,x.gift?.interactions,x.notes]:[x.category,x.name,x.description,x.rarity,x.current,x.target,x.observation,x.completed?'yes':'no',x.autoBond?'yes':'no'])}
function exportCsv(){if(!COLS[tab])return;download('\ufeff'+[COLS[tab],...csvRows(tab)].map(r=>r.map(csvCell).join(';')).join('\r\n'),'NTE-Tracker-'+tab+'.csv','text/csv;charset=utf-8');toast('CSV exported.')}
function parseCsv(s){s=s.replace(/^\ufeff/,'');let first=s.split(/\r?\n/,1)[0],sep=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',',rows=[],row=[],field='',quoted=false;for(let i=0;i<s.length;i++){let c=s[i];if(quoted){if(c==='"'&&s[i+1]==='"'){field+='"';i++}else if(c==='"')quoted=false;else field+=c}else if(c==='"')quoted=true;else if(c===sep){row.push(field);field=''}else if(c==='\n'||c==='\r'){if(c==='\r'&&s[i+1]==='\n')i++;row.push(field);if(row.some(x=>x!==''))rows.push(row);row=[];field=''}else field+=c}row.push(field);if(row.some(x=>x!==''))rows.push(row);return rows}
function importCsv(text){let rows=parseCsv(text);if(rows.length<2)throw Error('CSV has no data rows.');let headers=rows.shift().map(x=>x.toLowerCase().trim());let kind=headers.includes('bond level')&&headers.includes('item')?'bonds':headers.includes('category')&&headers.includes('observation')?'achievements':headers.includes('basic attack')?'characters':headers.includes('associated character')&&headers.includes('tier')?'arcs':null;if(!kind)throw Error('Unrecognized columns. Import a CSV exported by this tracker.');let get=(r,name)=>r[headers.indexOf(name.toLowerCase())]??'';
let updated=0;for(let r of rows){let name=String(get(r,kind==='bonds'?'Character':'Name')).trim();if(!name)continue;let list=kind==='bonds'?state.characters:state[kind],v=list.find(x=>normalizedName(x.name)===normalizedName(name)&&(kind!=='achievements'||x.category===get(r,'Category')));if(kind==='bonds'){if(!v)continue;v.bond=n(get(r,'Bond Level'));v.gift={...(v.gift||{}),name:get(r,'Item')||null,price:n(get(r,'Price')),rarity:get(r,'Rarity')||v.gift?.rarity||null,affection:headers.includes('value')?n(get(r,'Value')):v.gift?.affection,store:get(r,'Store')||null,location:get(r,'Location')||null,dateable:get(r,'Dateable?')||null,interactions:get(r,'Interactions')||null};v.notes=get(r,'Notes');}
else if(kind==='characters'){let obj={name,level:n(get(r,'Level')),bond:n(get(r,'Bond')),awakening:n(get(r,'Awakening')),rank:get(r,'Rank')||v?.rank||null,skills:{},notes:get(r,'Notes')};for(let [key,label] of SKILLS)obj.skills[key]=n(get(r,label));if(v)Object.assign(v,obj);else state.characters.push({id:uid(),gift:null,...obj})}
else if(kind==='arcs'){let obj={name,level:n(get(r,'Level')),tier:n(get(r,'Tier')),rarity:get(r,'Rarity')||v?.rarity||null,owner:get(r,'Associated Character')||null,notes:get(r,'Notes')};if(v)Object.assign(v,obj);else state.arcs.push({id:uid(),...obj})}
else{let obj={name,category:get(r,'Category'),description:get(r,'Description'),rarity:get(r,'Rarity')||null,current:n(get(r,'Current')),target:n(get(r,'Target')),observation:get(r,'Observation')||null,completed:/^(yes|true|1)$/i.test(get(r,'Completed')),autoBond:/^(yes|true|1)$/i.test(get(r,'Auto Bond'))};if(v)Object.assign(v,obj);else state.achievements.push({id:uid(),...obj})}updated++}
if(!updated)throw Error('No matching entries could be imported.');save();setupTab(kind);toast(`${updated} records imported from CSV.`)}
function handleImport(ev){let file=ev.target.files?.[0];ev.target.value='';if(!file)return;file.text().then(async s=>{try{if(file.name.toLowerCase().endsWith('.json')){let obj=JSON.parse(s);if(!Array.isArray(obj.characters)||!Array.isArray(obj.arcs)||!Array.isArray(obj.achievements))throw Error('Not an NTE Tracker JSON backup.');if(!confirm('Replace all current entries with this JSON backup?'))return;if((await saveQueue)===false)throw Error('Previous changes could not be saved.');let next=normalizeStore(obj);await invoke('restore_json',{data:next});state=next;await hydratePortraits();setupTab(tab);toast('JSON backup restored; safety ZIP was created.')}else if(file.name.toLowerCase().endsWith('.csv')){if(!confirm('Import CSV entries? Existing records with matching names will be updated.'))return;importCsv(s)}else throw Error('Please choose a .json or .csv file.')}catch(err){alert('Could not import file: '+err.message)}}).catch(err=>alert('Could not read file: '+err.message))}
document.addEventListener('click',async e=>{let nav=e.target.closest('[data-tab]');if(nav){setupTab(nav.dataset.tab);return}let el=e.target.closest('[data-action]');if(!el)return;let action=el.dataset.action,kind=el.dataset.kind||tab,id=el.dataset.id;
if(action==='select-character'){selectedCharacterId=id;render();}
else if(action==='char-filter'){characterRosterFilter=el.dataset.value||'all';render();}
else if(action==='goto'){setupTab(el.dataset.target);if(el.dataset.search){$('#search').value=el.dataset.search;filters.search=el.dataset.search;render()}window.scrollTo({top:0,behavior:'smooth'})}
else if(action==='add')openEditor(el.dataset.kind||tab);else if(action==='edit')openEditor(kind,(kind==='bonds'?state.characters:state[kind])?.find(x=>x.id===id));else if(action==='delete')removeItem(kind,id);else if(action==='step')changeStep(kind,id,el.dataset.field,Number(el.dataset.delta));else if(action==='close-modal')$('#editor-dialog').close();else if(action==='export-json')backup();else if(action==='backup-zip')await backupZip();else if(action==='restore-zip')await restoreZip();else if(action==='show-data-directory'){alert('Your permanent data folder:\n'+await invoke('get_data_directory')+'\n\nSQLite database: nte.sqlite3\nPortraits: portraits/\nAutomatic archives: backups/');}else if(action==='export-csv')exportCsv();else if(action==='import')$('#file-input').click();else if(action==='reset-filters'){filters={search:'',category:'all',status:'all',sort:'name'};$('#search').value='';$('#status-filter').value='all';$('#sort').value='name';render()}
else if(action==='reset-excel'){if(confirm('Restore the original Excel snapshot? This REPLACES your current changes. Download a JSON backup first.')){if((await saveQueue)===false)return;try{state=normalizeStore(await invoke('reset_to_excel'));await hydratePortraits();setupTab('overview');toast('Original Excel data restored.');}catch(err){alert('Reset failed: '+String(err));}}}
else if(action==='clear'){if(confirm('Clear ALL local entries? Back up your data first.')&&confirm('This removes all records from SQLite. A daily backup may still exist. Continue?')){state=blank();save();setupTab('overview');toast('Local entries cleared.')}}});
document.addEventListener('change',e=>{if(e.target.id==='roster-sort'){characterRosterSort=e.target.value;render();return}if(e.target.dataset.action==='complete'){let a=state.achievements.find(x=>x.id===e.target.dataset.id);if(!a)return;if(a.autoBond&&bondAchievement(a)&&!e.target.checked){a.autoBond=false;a.completed=false;}else a.completed=e.target.checked;save();render()}});
document.addEventListener('input',e=>{if(e.target.id==='roster-search'){filters.search=e.target.value.trim();renderRosterOnly();}});
$('#editor-form').addEventListener('submit',handleForm);$('#file-input').addEventListener('change',handleImport);$('#search').addEventListener('input',e=>{filters.search=e.target.value.trim();render()});$('#sort').addEventListener('change',e=>{filters.sort=e.target.value;render()});$('#category-filter').addEventListener('change',e=>{filters.category=e.target.value;render()});$('#status-filter').addEventListener('change',e=>{filters.status=e.target.value;render()});
// If a character-art host is unavailable, try the alternate source then use initials.
// This does not affect the database or any user-uploaded portrait.
document.addEventListener('error',e=>{
  const img=e.target;
  if(!(img instanceof HTMLImageElement)||!img.classList.contains('remote-art'))return;
  const fallback=img.dataset.portraitFallback||'';
  if(img.dataset.portraitAttempt==='0'&&fallback&&fallback!==img.src){
    img.dataset.portraitAttempt='1';img.src=fallback;return;
  }
  const initial=document.createElement('span');initial.className='portrait-placeholder';initial.setAttribute('aria-hidden','true');
  initial.textContent=(img.dataset.portraitName||'??').slice(0,2).toUpperCase();img.replaceWith(initial);
},true);
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!$('#editor-dialog').open){e.preventDefault();(tab==='characters'?$('#roster-search'):$('#search'))?.focus()}});
// The updater waits for the SQLite write queue before creating a pre-update ZIP.
window.nteBeforeUpdate = async () => (await saveQueue) !== false;
bootstrap();
})();