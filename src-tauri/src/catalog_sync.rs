//! Read-only shared catalogue from the project's public GitHub branch.
//! This module never modifies the player profile, the legacy roster, or backups.
use serde_json::{json, Value};
use std::{collections::HashSet, fs::{self, File}, io::Write, path::{Path,PathBuf}, time::Duration};
use uuid::Uuid;

pub const CATALOG_URL: &str = "https://raw.githubusercontent.com/MrDustyBowl/NTE-Tracker/main/catalog/catalog.v2.json";
const BUNDLED: &str = include_str!("../../catalog/catalog.v2.json");
const MAX_BYTES: usize = 8 * 1024 * 1024;
const CACHE_FILE: &str = "catalog.v2.json";

type Result<T> = std::result::Result<T, String>;
fn field<'a>(v: &'a Value, name: &str) -> Result<&'a str> {
    let s = v.get(name).and_then(Value::as_str).ok_or_else(|| format!("Missing text field {name}"))?;
    if s.trim().is_empty() || s.len() > 1000 { return Err(format!("Invalid {name}")); }
    Ok(s)
}
fn identifier(v: &Value, name: &str) -> Result<String> {
    let id = field(v,name)?;
    if id.len() > 160 || !id.chars().all(|c| c.is_ascii_alphanumeric() || ":_-".contains(c)) {
        return Err(format!("Invalid identifier: {id}"));
    }
    Ok(id.to_owned())
}
fn array<'a>(v: &'a Value, name: &str, max: usize) -> Result<&'a Vec<Value>> {
    let arr = v.get(name).and_then(Value::as_array).ok_or_else(||format!("Missing array {name}"))?;
    if arr.len() > max {return Err(format!("Too many {name} entries"));}
    Ok(arr)
}
fn entries(v: &Value, name: &str, max: usize) -> Result<HashSet<String>> {
    let mut ids = HashSet::new();
    for e in array(v,name,max)? {
        if !e.is_object() || !ids.insert(identifier(e,"id")?) {return Err(format!("Duplicate or invalid entry in {name}"));}
        field(e,"name")?;
    }
    Ok(ids)
}
fn nullable_bool(v: &Value, k: &str) -> Result<()> {
    if let Some(x) = v.get(k) {if !(x.is_null() || x.is_boolean()) {return Err(format!("Invalid {k}"));}}
    Ok(())
}
fn optional_nonneg_int(v: &Value, k: &str) -> Result<()> {
    if let Some(x)=v.get(k) {if !(x.is_null() || x.as_u64().is_some()) {return Err(format!("Invalid {k}"));}}
    Ok(())
}
fn nullable_text(v: &Value,k: &str) -> Result<()> {
    if let Some(x)=v.get(k) {if !(x.is_null() || x.as_str().is_some_and(|s|s.len() <= 1000)) {return Err(format!("Invalid {k}"));}}
    Ok(())
}
fn validate(input: &[u8]) -> Result<Value> {
    if input.len() > MAX_BYTES {return Err("Catalogue is too large".into())}
    let c: Value = serde_json::from_slice(input).map_err(|e| format!("Invalid catalogue JSON: {e}"))?;
    if c.get("schemaVersion").and_then(Value::as_u64) != Some(2) {return Err("Unsupported catalogue schema".into())}
    if revision(&c)? == 0 {return Err("Invalid catalogue revision".into())}
    field(&c,"contentVersion")?;
    let characters = entries(&c,"characters",10000)?;
    let arcs = entries(&c,"arcs",30000)?;
    let items = entries(&c,"items",40000)?;
    let _achievements=entries(&c,"achievements",30000)?;
    if characters.is_empty() || arcs.is_empty() {return Err("Missing core catalogue entries".into())}
    for ch in array(&c,"characters",10000)? {
        if !["A","S"].contains(&field(ch,"rank")?) {return Err("Invalid character rank".into())}
        if ch.get("max_level").and_then(Value::as_u64) != Some(80) {return Err("Invalid character level cap".into())}
        for name in ["basic_attack_max","redirect_skill_max","ultimate_skill_max","support_skill_max"] {
            if ch.get(name).and_then(Value::as_u64) != Some(10) {return Err(format!("Invalid {name}"))}
        }
        for name in ["life_skill_1_max","life_skill_2_max"] {optional_nonneg_int(ch,name)?;}
        nullable_text(ch,"small_portrait")?;nullable_text(ch,"portrait")?;
        nullable_text(ch,"element")?;nullable_text(ch,"arc_compatibility")?;
        if let Some(skills)=ch.get("skill_names").filter(|x|!x.is_null()) { let obj=skills.as_object().ok_or("Invalid skill labels")?;for(key,label) in obj {if !["basic_attack","redirect_skill","ultimate_skill","support_skill","passive_1","passive_2","life_skill_1","life_skill_2"].contains(&key.as_str())||label.as_str().is_none_or(|s|s.trim().is_empty()||s.len()>220){return Err("Invalid skill label".into())}} }
    }
    for arc in array(&c,"arcs",30000)? {
        if arc.get("max_level").and_then(Value::as_u64)!=Some(80) || arc.get("max_tier").and_then(Value::as_u64)!=Some(5) {return Err("Invalid Arc cap".into())}
        if let Some(r)=arc.get("rarity").filter(|r|!r.is_null()) {
            if !["gold","purple","blue"].contains(&r.as_str().unwrap_or("")) {return Err("Invalid Arc rarity".into())}
        }
    }
    for item in array(&c,"items",40000)? {
        if !["gold","purple","blue","green"].contains(&field(item,"rarity")?) {return Err("Missing or invalid item rarity".into())}
        nullable_text(item,"icon")?;
    }
    let mut bonds=HashSet::new();
    for bond in array(&c,"character_bonds",10000)? {
        let id=identifier(bond,"character_id")?;
        if !characters.contains(&id) || !bonds.insert(id) {return Err("Unknown or duplicate character bond".into())}
        nullable_bool(bond,"dateable")?;nullable_bool(bond,"has_interactions")?;
        if let Some(gift)=bond.get("favorite_gift_id").filter(|x|!x.is_null()) {
            let gift=gift.as_str().ok_or("Invalid favourite gift")?;
            if !items.contains(gift) {return Err("Unknown favourite gift item".into())}
        }
    }
    let mut sources=HashSet::new();
    for source in array(&c,"item_sources",50000)? {
        let id=identifier(source,"id")?;
        if !sources.insert(id) {return Err("Duplicate item source".into())}
        if !items.contains(&identifier(source,"item_id")?) {return Err("Unknown item in source".into())}
        if !["mob_drop","stage","shop","quest","crafting","event","reward","other"].contains(&field(source,"source_type")?) {return Err("Invalid source type".into())}
        field(source,"source_name")?;
        optional_nonneg_int(source,"price")?;
        nullable_text(source,"stage")?;nullable_text(source,"location")?;
    }
    Ok(c)
}
fn revision(c:&Value) -> Result<u64> {c.get("catalogRevision").and_then(Value::as_u64).ok_or_else(||"Missing catalogue revision".into())}
fn cache_path(root:&Path)->PathBuf {root.join("catalog-cache").join(CACHE_FILE)}
fn bundled()->Result<Value>{validate(BUNDLED.as_bytes())}
fn cache(root:&Path)->Option<Value>{
    let current=cache_path(root);
    // Recover the previous valid cache if a process crashed during an atomic replacement.
    for path in [current.clone(),current.with_extension("previous")] {
        if let Ok(bytes)=fs::read(path) {if let Ok(c)=validate(&bytes) {return Some(c)}}
    }
    None
}
pub fn load(root:&Path)->Result<Value>{
    let base=bundled()?;
    let base_revision=revision(&base)?;
    let active=match cache(root){Some(c) if revision(&c)? > base_revision => c,_=>base};
    let source = if revision(&active)? > base_revision {"cache"} else {"bundled"};
    Ok(json!({"catalog":active,"source":source,"updated":false,"catalogUrl":CATALOG_URL}))
}
fn no_removals(old:&Value,new:&Value)->Result<()> {
    for table in ["characters","arcs","items","achievements"] {
        let old_ids=entries(old,table,40000)?;
        let next_ids=entries(new,table,40000)?;
        if !old_ids.is_subset(&next_ids) {return Err(format!("Catalogue update would remove {table}. Archive entries rather than delete permanent IDs."))}
    }
    Ok(())
}
fn install(root:&Path,bytes:&[u8])->Result<()> {
    let dest=cache_path(root);
    let folder=dest.parent().ok_or("Missing cache parent")?;
    fs::create_dir_all(folder).map_err(|e|e.to_string())?;
    let temp=folder.join(format!("catalog-{}.pending",Uuid::new_v4()));
    let mut file=File::create(&temp).map_err(|e|e.to_string())?;
    if let Err(e)=file.write_all(bytes).and_then(|_|file.sync_all()) {let _=fs::remove_file(&temp);return Err(e.to_string())}
    drop(file);
    let previous=dest.with_extension("previous");
    // Keep a recoverable previous cache during the replacement on Windows too.
    if previous.exists() {fs::remove_file(&previous).map_err(|e|e.to_string())?;}
    if dest.exists() {fs::rename(&dest,&previous).map_err(|e|e.to_string())?;}
    if let Err(e)=fs::rename(&temp,&dest) {
        if previous.exists() {let _=fs::rename(&previous,&dest);}
        let _=fs::remove_file(&temp);
        return Err(format!("Could not install catalogue: {e}"));
    }
    // Keep backup at .previous for crash recovery.
    Ok(())
}
/// Called on startup and via the manual check button. A network failure is never
/// allowed to erase the cache, bundled catalogue or player SQLite data.
pub async fn sync(root:&Path)->Result<Value>{
    let existing=load(root)?;
    let current=&existing["catalog"];
    let client=reqwest::Client::builder().timeout(Duration::from_secs(15)).redirect(reqwest::redirect::Policy::none()).build().map_err(|e|e.to_string())?;
    let mut resp=client.get(CATALOG_URL).send().await.map_err(|e|format!("Catalogue server unavailable: {e}"))?;
    if resp.status()!=reqwest::StatusCode::OK {return Err(format!("Catalogue server returned HTTP {}",resp.status()))}
    if resp.content_length().is_some_and(|n| n > MAX_BYTES as u64) {return Err("Catalogue exceeds download size limit".into())}
    let mut bytes=Vec::new();
    while let Some(chunk)=resp.chunk().await.map_err(|e|e.to_string())? {
        if bytes.len()+chunk.len()>MAX_BYTES {return Err("Catalogue download exceeds size limit".into())}
        bytes.extend_from_slice(&chunk);
    }
    let next=validate(&bytes)?;
    let old_rev=revision(current)?;
    let new_rev=revision(&next)?;
    if new_rev <= old_rev {return Ok(json!({"catalog":current,"source":existing["source"],"updated":false,"catalogUrl":CATALOG_URL}));}
    no_removals(current,&next)?;
    install(root,&bytes)?;
    Ok(json!({"catalog":next,"source":"cache","updated":true,"catalogUrl":CATALOG_URL}))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn embedded_catalogue_valid(){ assert!(revision(&bundled().unwrap()).unwrap() >= 1); }
    #[test] fn rejects_bad_rarity(){let mut c=bundled().unwrap();c["items"]=json!([{"id":"item:test","name":"Test","rarity":"orange"}]);assert!(validate(&serde_json::to_vec(&c).unwrap()).is_err());}
    #[test] fn forbids_catalog_removals(){let c=bundled().unwrap();let mut next=c.clone();next["arcs"].as_array_mut().unwrap().clear();assert!(no_removals(&c,&next).is_err());}
    #[test] fn cache_is_separate_from_player_data(){
        let path=std::env::temp_dir().join(format!("nte-v2-test-{}",Uuid::new_v4()));
        fs::create_dir_all(&path).unwrap();
        let player=path.join("nte.sqlite3");
        fs::write(&player,b"DO NOT CHANGE PLAYER DATA").unwrap();
        let old=bundled().unwrap();
        let mut new=old.clone();
        new["catalogRevision"]=json!(revision(&old).unwrap()+1);
        install(&path,&serde_json::to_vec(&new).unwrap()).unwrap();
        assert_eq!(load(&path).unwrap()["catalog"]["catalogRevision"],new["catalogRevision"]);
        assert_eq!(fs::read(&player).unwrap(),b"DO NOT CHANGE PLAYER DATA");
        fs::remove_dir_all(&path).unwrap();
    }
    #[test] fn damaged_cache_falls_back_to_embedded(){
        let path=std::env::temp_dir().join(format!("nte-v2-corrupt-{}",Uuid::new_v4()));
        fs::create_dir_all(path.join("catalog-cache")).unwrap();
        fs::write(cache_path(&path),b"broken JSON").unwrap();
        assert_eq!(load(&path).unwrap()["catalog"]["catalogRevision"],bundled().unwrap()["catalogRevision"]);
        fs::remove_dir_all(path).unwrap();
    }
}
