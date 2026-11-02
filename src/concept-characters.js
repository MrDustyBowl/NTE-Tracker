/**
 * NTE Tracker — Neon dossier / character dashboard.
 * Presentation only: progression still goes through catalog-main's SQLite-backed save().
 * No fabricated game stats or remote image dependencies.
 */
const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ICONS={basic_attack:'⌁',redirect_skill:'✦',ultimate_skill:'✳',support_skill:'◇'};
const COMBAT=[
  ['basic_attack_level','basic_attack','Basic Attack',1,10],
  ['redirect_skill_level','redirect_skill','Redirect Skill',1,10],
  ['ultimate_skill_level','ultimate_skill','Ultimate Skill',1,10],
  ['support_skill_level','support_skill','Support Skill',1,10]
];
const STATUS={not_available:'No interactions',not_verified:'Not verified',locked:'Locked',unlocked:'Unlocked',done:'Completed'};
const txt=(v,missing='Not yet catalogued')=>v==null||v===''?missing:escapeHTML(v);
const safeArt=(src,name)=>src?'<img loading="lazy" src="'+escapeHTML(src)+'" alt="'+escapeHTML(name)+'">':'<span aria-hidden="true">✦</span>';
const level=(value,max)=>value==null?'— / '+max:value+' / '+max;
const pct=(value,max)=>Math.min(100,Math.max(0,100*(value??0)/max));
const slider=({kind='characters',c,key,label,value,min,max,disabled=false})=>'<label class="neo-slider-row"><span><b>'+escapeHTML(label)+'</b><em>'+level(value,max)+'</em></span><input type="range" min="'+min+'" max="'+max+'" step="1" value="'+(value??min)+'" data-id="'+escapeHTML(c.id)+'" data-progress-kind="'+kind+'" data-progress-field="'+key+'" '+(disabled?'disabled':'')+' aria-label="'+escapeHTML(label)+'"></label>';
const section=(title,body,small='')=>'<section class="neo-card"><header class="neo-card-head"><h3>'+title+'</h3>'+small+'</header>'+body+'</section>';

export function renderNeonCharacters({catalog,user,bondMap,selectedId,query='',listFilter='all',selectedSkill='redirect_skill',icon,bigArt}){
  const all=catalog.characters.slice().sort((a,b)=>a.name.localeCompare(b.name));
  const owned=all.filter(c=>user('characters',c.id).owned);
  const hasSearch=c=>!query||[c.name,c.element,c.rank].join(' ').toLowerCase().includes(query.toLowerCase());
  const filtered=all.filter(c=>hasSearch(c)&&(
      listFilter==='all'||listFilter==='owned'&&user('characters',c.id).owned||
      listFilter==='starred'&&user('characters',c.id).favorite));
  const yes=filtered.filter(c=>user('characters',c.id).owned);
  const no=filtered.filter(c=>!user('characters',c.id).owned);
  const chosen=all.find(c=>c.id===selectedId)||owned[0]||all[0];
  const profile=chosen?user('characters',chosen.id):null;
  const bonds=chosen?user('bonds',chosen.id):null;
  const bondInfo=chosen?bondMap.get(chosen.id)||{}:{};
  const awarded=owned.filter(c=>Number.isInteger(user('characters',c.id).team_slot)&&user('characters',c.id).team_slot>=1&&user('characters',c.id).team_slot<=4)
    .sort((a,b)=>user('characters',a.id).team_slot-user('characters',b.id).team_slot);
  const slots=[1,2,3,4].map(n=>awarded.find(c=>user('characters',c.id).team_slot===n));
  const title=(text)=>'<div class="neo-angled-title">'+text+'<span class="neo-slashes">///////</span></div>';
  const row=c=>{const p=user('characters',c.id),active=chosen?.id===c.id;return '<button type="button" class="neo-roster-item '+(active?'is-selected ':'')+(p.owned?'is-owned':'is-missing')+'" data-action="select-char" data-id="'+escapeHTML(c.id)+'" title="'+escapeHTML(c.name)+'"><span class="neo-list-icon '+(c.rank==='S'?'s':'a')+'">'+safeArt(icon(c),c.name)+'</span><span class="neo-row-main"><strong>'+escapeHTML(c.name)+'</strong><span>'+(p.owned?'LV. '+(p.level??'—')+' / 80':'+ Add to collection')+' <i>·</i> '+txt(c.element,'ELEMENT —')+'</span></span><span class="neo-row-star '+(p.favorite?'lit':'')+'" aria-hidden="true">'+(p.favorite?'★':'✧')+'</span></button>'};
  const roster='<aside class="neo-roster neo-frame">'+title('CHARACTERS')+'<div class="neo-roster-tools"><label class="neo-search"><span>⌕</span><input id="concept-search" type="search" autocomplete="off" placeholder="Search characters..." value="'+escapeHTML(query)+'" aria-label="Search characters"></label><div class="neo-filters" role="group" aria-label="Roster filters">'+['all','owned','starred'].map((x,i)=>'<button data-action="roster-filter" data-filter="'+x+'" class="'+(listFilter===x?'active':'')+'">'+['All','Owned','★ Starred'][i]+'</button>').join('')+'</div></div><div class="neo-roster-scroll"><div class="neo-list-group"><div class="neo-list-heading">COLLECTED <b>'+yes.length+'</b></div>'+ (yes.map(row).join('')||'<p class="neo-small-empty">Nothing collected yet.</p>')+'</div><div class="neo-list-group neo-missing-group"><div class="neo-list-heading">NOT COLLECTED <b>'+no.length+'</b></div>'+(no.map(row).join('')||'<p class="neo-small-empty">No matching characters.</p>')+'</div></div><footer class="neo-roster-footer"><span>'+owned.length+' / '+all.length+' OWNED</span><span>DATABASE r'+catalog.catalogRevision+'</span></footer></aside>';
  if(!chosen)return '<div class="neo-board">'+roster+'<section class="neo-core neo-frame">No characters in the catalogue yet.</section></div>';
  const p=profile,aw=p.awakening_level??0,bl=bonds.bond_level??0;
  const teamIcon=c=>c?'<button type="button" class="neo-team-slot filled" data-action="select-char" data-id="'+escapeHTML(c.id)+'" title="View '+escapeHTML(c.name)+'"><span>'+safeArt(icon(c),c.name)+'</span><small>'+escapeHTML(c.name)+'</small></button>':'<button type="button" class="neo-team-slot empty" data-action="equip-team" data-id="'+escapeHTML(chosen.id)+'" title="Assign selected character"><span>+</span><small>Empty slot</small></button>';
  const team=section('TEAM SETUP','<div class="neo-team-grid">'+slots.map(teamIcon).join('')+'</div><p class="neo-caption">Your local team slots · click an empty slot to add the selected character.</p>','<button class="neo-chip-action" data-action="'+(p.team_slot?'remove-team':'quick-equip')+'" data-id="'+escapeHTML(chosen.id)+'">'+(p.team_slot?'− Unequip':'↻ Equip selected')+'</button>');
  const awakening=section('RESONANCE CHAIN <span>/ AWAKENING</span>','<div class="neo-awaken-banner"><span>Awakening Lv. '+aw+'</span><b>'+(aw?'ACTIVATED':'NOT UNLOCKED')+'</b></div><div class="neo-resonance">'+Array.from({length:6},(_,i)=>'<button type="button" class="neo-res-node '+(i<aw?'lit':'')+'" data-action="set-awakening" data-id="'+escapeHTML(chosen.id)+'" data-value="'+(i+1)+'" title="Set awakening to '+(i+1)+'">✦<small>'+(i+1)+'</small></button>').join('')+'</div>'+slider({c:chosen,key:'awakening_level',label:'Awakening',value:aw,min:0,max:6,disabled:!p.owned})+'<p class="neo-caption">Click a node or adjust the slider. No resonance descriptions are invented.</p>');
  const giftId=bondInfo.favorite_gift_id;
  const gift=catalog.items.find(x=>x.id===giftId);
  const interactionStatus=bondInfo.has_interactions===false?'not_available':bondInfo.has_interactions!==true?'not_verified':bl<6?'locked':bonds.interactions_completed?'done':'unlocked';
  const bond=section('BOND <span>/ AFFINITY</span>','<div class="neo-bond-top"><strong>Bond Lv. '+bl+'</strong><em>'+bl+' / 10</em></div>'+slider({kind:'bonds',c:chosen,key:'bond_level',label:'Relationship progress',value:bl,min:0,max:10,disabled:!p.owned})+'<div class="neo-compact-info">FAVOURITE GIFT <b>'+txt(gift?.name)+'</b></div><div class="neo-compact-info">INTERACTIONS <b>'+STATUS[interactionStatus]+'</b></div>'+(bondInfo.has_interactions===true?'<label class="neo-toggle">Interactions completed <input type="checkbox" data-progress-kind="bonds" data-id="'+escapeHTML(chosen.id)+'" data-progress-field="interactions_completed" '+(bonds.interactions_completed?'checked':'')+' '+(!p.owned||bl<6?'disabled':'')+'></label>':''));
  const arcsOwned=catalog.arcs.filter(a=>user('arcs',a.id).owned).slice(0,2);
  const arcPanel=section('YOUR ARCS <span>/ LOADOUT</span>','<div class="neo-arc-list">'+(arcsOwned.length?arcsOwned.map(a=>'<div class="neo-arc-item"><span class="neo-arc-diamond '+escapeHTML(a.rarity||'')+'">◇</span><span><b>'+escapeHTML(a.name)+'</b><small>LV. '+(user('arcs',a.id).level??'—')+' · Tier '+(user('arcs',a.id).tier??'—')+'</small></span></div>').join(''):'<p class="neo-caption">Mark your Arcs as owned to see them here. Recommended builds will come with verified game data.</p>')+'</div>','<button class="neo-chip-action" data-action="tab" data-target="arcs">Manage</button>');
  const teamRight='<aside class="neo-right">'+team+awakening+bond+arcPanel+'</aside>';
  const cardPortrait=bigArt(chosen);
  const hero='<div class="neo-art-stage"><div class="neo-paper-label">NEVERNESS<span>TO EVERNESS</span></div><div class="neo-art-masthead">NTE</div><div class="neo-art-circle">'+safeArt(cardPortrait,chosen.name)+'</div><div class="neo-art-scrawl">'+escapeHTML(chosen.name)+'</div><div class="neo-art-sticker">✦ NEW ERA // TRACKER 2.3</div><div class="neo-art-bottom">ILLUSTRATION PENDING · LOCAL ASSETS</div></div>';
  const mainInfo='<div class="neo-hero-info"><div class="neo-meta-kicker"><span>CHARACTER FILE / '+escapeHTML(chosen.id.toUpperCase())+'</span><span>◆ '+escapeHTML(chosen.rank)+'-RANK</span></div><div class="neo-meta-name"><h1>'+escapeHTML(chosen.name)+'</h1><button type="button" aria-label="Toggle favourite" aria-pressed="'+!!p.favorite+'" class="neo-favorite '+(p.favorite?'on':'')+'" data-action="toggle-favorite" data-id="'+escapeHTML(chosen.id)+'">'+(p.favorite?'★':'☆')+'</button></div><div class="neo-meta-pill"><b>✧</b> '+txt(chosen.element,'Element unverified')+' <span>·</span> '+txt(chosen.arc_compatibility,'Arc type unknown')+'</div><div class="neo-stars">'+(chosen.rank==='S'?'✦ ✦ ✦ ✦ ✦':'✦ ✦ ✦ ✦')+'</div><div class="neo-hero-level"><span>Lv. <b>'+(p.level??'—')+'</b> / 80</span><div class="neo-hero-track"><span style="width:'+pct(p.level,80)+'%"></span></div></div><div class="neo-track-stats"><h3>TRACKED PROGRESS</h3><div class="neo-stat-grid"><div><small>AWAKENING</small><strong>A'+aw+' / 6</strong></div><div><small>BOND</small><strong>'+bl+' / 10</strong></div><div><small>COMBAT SKILLS</small><strong>'+COMBAT.filter(s=>p[s[0]]!=null).length+' / 4</strong></div><div><small>RANK</small><strong>'+escapeHTML(chosen.rank)+'</strong></div></div></div><div class="neo-hero-actions">'+(p.owned?'<button data-action="unown-char" data-id="'+escapeHTML(chosen.id)+'" class="neo-action-outline">Remove from collection</button>':'<button data-action="select-char" data-id="'+escapeHTML(chosen.id)+'" class="neo-action-primary">+ Add to collection</button>')+'<span>Progress saves automatically</span></div></div>';
  const skillTiles=COMBAT.map(([field,key,label])=>'<button type="button" class="neo-skill-tile '+(selectedSkill===key?'active':'')+'" data-action="select-skill" data-skill="'+key+'" title="Show '+label+'"><span class="neo-skill-ring">'+ICONS[key]+'</span><span>'+label+'</span><b>Lv. '+(p[field]??'—')+' / 10</b></button>').join('');
  const focused=COMBAT.find(s=>s[1]===selectedSkill)||COMBAT[1];
  const skillDetail='<div class="neo-skill-detail"><div class="neo-skill-symbol">'+ICONS[focused[1]]+'</div><div><small>SELECTED SKILL</small><strong>'+txt(chosen.skill_names?.[focused[1]],focused[2])+'</strong><p>Level '+(p[focused[0]]??'—')+' / 10 · Skill descriptions will appear once they are verified in the shared catalogue.</p></div></div>';
  const combat=COMBAT.map(([field,key,label,min,max])=>slider({c:chosen,key:field,label:chosen.skill_names?.[key]||label,value:p[field],min,max,disabled:!p.owned})).join('');
  const passives=[1,2].map(i=>'<label class="neo-toggle"><span>✦ '+txt(chosen.skill_names?.['passive_'+i],'Passive '+i)+'</span><input type="checkbox" data-id="'+escapeHTML(chosen.id)+'" data-progress-kind="characters" data-progress-field="passive_'+i+'_unlocked" '+(p['passive_'+i+'_unlocked']?'checked':'')+' '+(!p.owned?'disabled':'')+'></label>').join('');
  const life=[1,2].map(i=>{
    const max=chosen['life_skill_'+i+'_max'],key='life_skill_'+i+'_level',name=chosen.skill_names?.['life_skill_'+i]||'Life Skill '+i;
    if(i===2&&chosen.life_skill_2_verified===true&&max==null)return '';
    return max!=null?slider({c:chosen,key,label:name,value:p[key],min:0,max,disabled:!p.owned}):'<label class="neo-lifeskill-unknown"><span>'+escapeHTML(name)+'<small>MAX UNVERIFIED</small></span><input type="number" min="0" step="1" placeholder="—" value="'+(p[key]??'')+'" data-id="'+escapeHTML(chosen.id)+'" data-progress-kind="characters" data-progress-field="'+key+'" '+(!p.owned?'disabled':'')+'></label>';
  }).join('');
  const selectedPanel='<div class="neo-dossier"><div class="neo-dossier-tabs"><span class="active">✦ Skills</span><span>◈ Awakening</span><span>◇ Bond</span><span>▧ Materials: soon</span></div><div class="neo-skill-showcase">'+skillTiles+'</div>'+skillDetail+'<div class="neo-subgrid">'+section('SKILL LEVELS',combat+passives)+section('LIFE SKILLS',life||'<p class="neo-caption">No skill information yet.</p>')+'</div></div>';
  const center='<section class="neo-core"><div class="neo-hero neo-frame">'+hero+mainInfo+'</div>'+selectedPanel+'</section>';
  return '<div class="neo-board">'+roster+center+teamRight+'</div>';
}
