/** Game rules shared by UI and tests. No mutable user state or storage here. */
export const SKILLS = [
  ['basic_attack_level','Basic Attack','basic_attack_max'],
  ['redirect_skill_level','Redirect Skill','redirect_skill_max'],
  ['ultimate_skill_level','Ultimate Skill','ultimate_skill_max'],
  ['support_skill_level','Support Skill','support_skill_max'],
];
export const RARITIES = { characters:['A','S'], arcs:['gold','purple','blue'], items:['gold','purple','blue','green'] };
export const SOURCE_TYPES = ['mob_drop','stage','shop','quest','crafting','event','reward','other'];
export function defaultProgress(kind){
  if(kind==='characters')return {owned:false,level:null,basic_attack_level:null,redirect_skill_level:null,ultimate_skill_level:null,support_skill_level:null,passive_1_unlocked:false,passive_2_unlocked:false,life_skill_1_level:null,life_skill_2_level:null,awakening_level:null,notes:''};
  if(kind==='arcs')return {owned:false,level:null,tier:null,notes:''};
  if(kind==='bonds')return {bond_level:0,interactions_completed:false};
  if(kind==='achievements')return {status:'todo',current:0,observation:''};
  if(kind==='items')return {quantity:0,notes:''};
  throw Error('Unknown kind '+kind);
}
export function acquiredDefaults(kind,r){
  if(kind==='characters' && !r.owned)return {...r,owned:true,level:r.level??1,basic_attack_level:r.basic_attack_level??1,redirect_skill_level:r.redirect_skill_level??1,ultimate_skill_level:r.ultimate_skill_level??1,support_skill_level:r.support_skill_level??1,life_skill_1_level:r.life_skill_1_level??0,awakening_level:r.awakening_level??0};
  if(kind==='arcs' && !r.owned)return {...r,owned:true,level:r.level??1,tier:r.tier??1};
  return {...r,owned:!r.owned};
}
export function parseInteger(value,min,max=null,nullable=true){
  if(value===null||value===undefined||value===''){if(nullable)return null;throw Error('Number required');}
  const n=Number(value);
  if(!Number.isInteger(n) || n<min || (max!==null && n>max))throw Error(`Expected integer between ${min} and ${max??'unverified maximum'}`);
  return n;
}
export function interactionStatus(hasInteractions,bondLevel,completed){
  if(hasInteractions===false)return 'not_available';
  if(hasInteractions!==true)return 'not_verified';
  if(bondLevel<6)return 'locked';
  return completed?'done':'unlocked';
}
export function catalogItem(id,items){return items.find(x=>x.id===id)||null;}
export function sourcesFor(id,sources){return sources.filter(x=>x.item_id===id);}
export function verifyCatalog(catalog){
  if(catalog.schemaVersion!==2 || !Number.isSafeInteger(catalog.catalogRevision) || catalog.catalogRevision<1)throw Error('Invalid catalog version');
  const check=(x)=>{if(!Array.isArray(x))throw Error('Missing list');const ids=new Set();for(const r of x){if(!r.id||ids.has(r.id))throw Error('Missing or duplicate ID '+r.id);ids.add(r.id)}return ids};
  const chars=check(catalog.characters),arcs=check(catalog.arcs),items=check(catalog.items),ach=check(catalog.achievements);
  for(const c of catalog.characters){if(!RARITIES.characters.includes(c.rank))throw Error('Character rank invalid: '+c.id);if(c.max_level!==80||SKILLS.some(([,,max])=>c[max]!==10))throw Error('Character caps invalid: '+c.id);if(c.skill_names!=null){if(typeof c.skill_names!=='object'||Array.isArray(c.skill_names))throw Error('Invalid skill names: '+c.id);for(const [key,value] of Object.entries(c.skill_names)){if(!['basic_attack','redirect_skill','ultimate_skill','support_skill','passive_1','passive_2','life_skill_1','life_skill_2'].includes(key)||typeof value!=='string'||!value.trim()||value.length>220)throw Error('Invalid skill label: '+c.id+' '+key)}}}
  for(const a of catalog.arcs){if(a.max_level!==80||a.max_tier!==5)throw Error('Arc caps invalid: '+a.id);if(a.rarity!==null && !RARITIES.arcs.includes(a.rarity))throw Error('Arc rarity invalid: '+a.id)}
  for(const i of catalog.items){if(!RARITIES.items.includes(i.rarity))throw Error('Required item rarity missing or invalid: '+i.id)}
  for(const b of catalog.character_bonds){if(!chars.has(b.character_id))throw Error('Missing bond character '+b.character_id);if(b.favorite_gift_id!==null && !items.has(b.favorite_gift_id))throw Error('Missing gift item '+b.favorite_gift_id);for(const v of [b.dateable,b.has_interactions])if(v!==null&&typeof v!=='boolean')throw Error('Bond boolean invalid')}
  const bondIDs=new Set();for(const b of catalog.character_bonds){if(bondIDs.has(b.character_id))throw Error('Duplicate bond ' + b.character_id);bondIDs.add(b.character_id)}
  const sources=check(catalog.item_sources);for(const s of catalog.item_sources){if(!items.has(s.item_id))throw Error('Orphan item source '+s.id);if(!SOURCE_TYPES.includes(s.source_type))throw Error('Invalid source type '+s.id);if(!s.source_name)throw Error('Missing source name '+s.id);if(s.price!==null&&s.price!==undefined&&(typeof s.price!=='number'||s.price<0))throw Error('Invalid price '+s.id)}
  return {characters:chars.size,arcs:arcs.size,items:items.size,achievements:ach.size,sources:sources.size};
}
