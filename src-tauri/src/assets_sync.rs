//! Own-GitHub image library. No dependence on external asset repositories at runtime.
//! Download-only into a separate, content-addressed cache; never touches player SQLite.
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{collections::HashSet, fs::{self, File}, io::Write, path::{Path, PathBuf}, time::Duration};
use uuid::Uuid;

const MANIFEST_URL: &str = "https://raw.githubusercontent.com/MrDustyBowl/NTE-Tracker/main/assets/manifest.v1.json";
const ASSET_ORIGIN: &str = "https://raw.githubusercontent.com/MrDustyBowl/NTE-Tracker/main/";
const MAX_MANIFEST: usize = 256 * 1024;
const MAX_IMAGE: usize = 5 * 1024 * 1024;
const MAX_ASSETS: usize = 512;

type Result<T> = std::result::Result<T,String>;

#[derive(Clone)]
struct Asset { key: String, path: String, sha256: String, width: u32, height: u32 }

fn hash(bytes: &[u8]) -> String { format!("{:x}", Sha256::digest(bytes)) }

fn safe_path(path: &str) -> bool {
    if path.len()>190 || !path.ends_with(".png") {return false}
    let approved = ["src/assets/characters/avatars/","assets/characters/avatars/",
        "assets/characters/portraits/","assets/characters/skills/",
        "assets/arcs/","assets/items/","assets/elements/"];
    if !approved.iter().any(|prefix|path.starts_with(prefix)) {return false}
    path.split('/').all(|part| !part.is_empty() && part!="." && part!=".." &&
        part.chars().all(|c|c.is_ascii_alphanumeric() || "_-.".contains(c)))
}

fn safe_key(key:&str) -> bool {
    if key.len()>130 || !key.chars().all(|c|c.is_ascii_alphanumeric() || ":_-".contains(c)) {return false}
    let parts:Vec<&str> = key.split(':').collect();
    match parts.as_slice() {
        ["avatar"|"portrait","char",slug] => !slug.is_empty(),
        ["skill","char",slug,skill] => !slug.is_empty() && !skill.is_empty(),
        ["arc",slug] | ["item",slug] | ["element",slug] => !slug.is_empty(),
        _=>false
    }
}

fn parse_manifest(bytes:&[u8])->Result<(u64,Vec<Asset>)> {
    if bytes.len()>MAX_MANIFEST {return Err("Asset manifest exceeds maximum size".into())}
    let m:Value=serde_json::from_slice(bytes).map_err(|e|format!("Invalid image manifest: {e}"))?;
    if m["schemaVersion"].as_u64()!=Some(1) {return Err("Unsupported asset manifest schema".into())}
    let rev=m["revision"].as_u64().filter(|v|*v>0).ok_or("Invalid asset revision")?;
    let rows=m["assets"].as_array().ok_or("Missing asset list")?;
    if rows.len()>MAX_ASSETS {return Err("Too many assets".into())}
    let(mut keys,mut paths)=(HashSet::new(),HashSet::new());
    let mut assets=Vec::with_capacity(rows.len());
    for a in rows {
        let get=|name:&str| -> Result<&str> {
            a[name].as_str().ok_or_else(||format!("Missing {name} in asset manifest"))
        };
        let key=get("key")?;
        let path=get("path")?;
        let sha=get("sha256")?;
        let width=a["width"].as_u64().ok_or("Missing image width")?;
        let height=a["height"].as_u64().ok_or("Missing image height")?;
        if !safe_key(key)||!safe_path(path) {return Err("Invalid asset key or path".into())}
        let match_type=match key.split(':').next().unwrap_or("") {
            "avatar"=>path.starts_with("src/assets/characters/avatars/")||path.starts_with("assets/characters/avatars/"),
            "portrait"=>path.starts_with("assets/characters/portraits/"),
            "skill"=>path.starts_with("assets/characters/skills/"),
            "arc"=>path.starts_with("assets/arcs/"),
            "item"=>path.starts_with("assets/items/"),
            "element"=>path.starts_with("assets/elements/"),
            _=>false
        };
        if !match_type {return Err("Asset type does not match storage path".into())}
        if sha.len()!=64 || !sha.bytes().all(|b|b.is_ascii_hexdigit()&& !b.is_ascii_uppercase()) {
            return Err("Invalid asset SHA-256".into())
        }
        if !(1..=4096).contains(&width)||!(1..=4096).contains(&height) {
            return Err("Unreasonable image dimensions".into())
        }
        if !keys.insert(key.to_owned())||!paths.insert(path.to_owned()) {
            return Err("Duplicate image key or path".into())
        }
        assets.push(Asset{key:key.into(),path:path.into(),sha256:sha.into(),width:width as u32,height:height as u32});
    }
    Ok((rev,assets))
}

fn png_valid(bytes:&[u8],asset:&Asset)->bool {
    if bytes.len()<33 || bytes.len()>MAX_IMAGE {return false}
    if &bytes[..8]!=b"\x89PNG\r\n\x1a\n" || &bytes[12..16]!=b"IHDR" {return false}
    let w=u32::from_be_bytes(bytes[16..20].try_into().unwrap());
    let h=u32::from_be_bytes(bytes[20..24].try_into().unwrap());
    w==asset.width && h==asset.height && matches!(bytes[25], 2 | 3 | 6)
}
fn cache_dir(root:&Path)->PathBuf {root.join("asset-cache")}
fn manifest_file(root:&Path)->PathBuf {cache_dir(root).join("manifest.v1.json")}
fn image_file(root:&Path,asset:&Asset)->PathBuf {cache_dir(root).join("objects").join(format!("{}.png",asset.sha256))}
fn verified_image(root:&Path,asset:&Asset)->Option<Vec<u8>> {
    let bytes=fs::read(image_file(root,asset)).ok()?;
    if png_valid(&bytes,asset)&&hash(&bytes)==asset.sha256 {Some(bytes)} else {None}
}
fn installed(root:&Path)->Result<Option<(u64,Vec<Asset>)>> {
    let bytes=match fs::read(manifest_file(root)){Ok(v)=>v,Err(_)=>return Ok(None)};
    parse_manifest(&bytes).map(Some).or(Ok(None))
}
fn write_atomic(dest:&Path,bytes:&[u8])->Result<()> {
    let parent=dest.parent().ok_or("No asset cache parent")?;
    fs::create_dir_all(parent).map_err(|e|e.to_string())?;
    let temp=parent.join(format!(".{}-{}.pending",Uuid::new_v4(),std::process::id()));
    let mut file=File::create(&temp).map_err(|e|e.to_string())?;
    if let Err(e)=file.write_all(bytes).and_then(|_|file.sync_all()) {
        let _=fs::remove_file(&temp);return Err(e.to_string())
    }
    drop(file);
    if let Err(e)=fs::rename(&temp,dest){
        // On Windows, rename cannot replace an existing destination.
        if dest.exists() {
            fs::remove_file(dest).map_err(|err|format!("Cannot update image cache: {err}"))?;
            if let Err(retry)=fs::rename(&temp,dest){let _=fs::remove_file(&temp);return Err(retry.to_string())}
        } else {let _=fs::remove_file(&temp);return Err(e.to_string())}
    }
    Ok(())
}
pub fn library(root:&Path)->Result<Value>{
    let Some((revision,assets))=installed(root)? else {
        return Ok(json!({"revision":0,"keys":[],"source":"bundled"}))
    };
    let keys:Vec<&str>=assets.iter().filter(|a|verified_image(root,a).is_some()).map(|a|a.key.as_str()).collect();
    Ok(json!({"revision":revision,"keys":keys,"source":"cache"}))
}
pub fn read_image(root:&Path,key:&str)->Result<String>{
    if !safe_key(key) {return Err("Invalid image key".into())}
    let (_,assets)=installed(root)?.ok_or("No downloaded image library")?;
    let entry=assets.iter().find(|a|a.key==key).ok_or("Image is not in the library manifest")?;
    let bytes=verified_image(root,entry).ok_or("Image cache is missing or corrupt")?;
    Ok(format!("data:image/png;base64,{}",STANDARD.encode(bytes)))
}
async fn fetch_limited(client:&reqwest::Client,url:&str,limit:usize)->Result<Vec<u8>> {
    let mut r=client.get(url).send().await.map_err(|e|format!("Image server unreachable: {e}"))?;
    if !r.status().is_success() {return Err(format!("Image server HTTP {}",r.status()))}
    if r.content_length().is_some_and(|n|n>limit as u64){return Err("Asset exceeds maximum download size".into())}
    let mut b=Vec::new();
    while let Some(chunk)=r.chunk().await.map_err(|e|e.to_string())? {
        if b.len().saturating_add(chunk.len())>limit {return Err("Asset download exceeds limit".into())}
        b.extend_from_slice(&chunk);
    }
    Ok(b)
}
pub async fn sync(root:&Path)->Result<Value>{
    let client=reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::none())
        .build().map_err(|e|e.to_string())?;
    let bytes=fetch_limited(&client,MANIFEST_URL,MAX_MANIFEST).await?;
    let (revision,assets)=parse_manifest(&bytes)?;
    let old=installed(root)?;
    if old.as_ref().is_some_and(|(rev,_)|*rev>revision) {
        return Err("Image manifest rollback rejected".into())
    }
    if old.as_ref().is_some_and(|(rev,_)|*rev==revision) {
        let existing=fs::read(manifest_file(root)).map_err(|e|e.to_string())?;
        if existing!=bytes {return Err("Image manifest changed without increasing revision".into())}
    }
    let mut downloaded=0;
    for a in &assets {
        if verified_image(root,a).is_some(){continue}
        let url=format!("{ASSET_ORIGIN}{}",a.path);
        let png=fetch_limited(&client,&url,MAX_IMAGE).await?;
        if !png_valid(&png,a) || hash(&png)!=a.sha256 {
            return Err(format!("Rejected invalid image: {}",a.key))
        }
        write_atomic(&image_file(root,a),&png)?;
        downloaded+=1;
    }
    let updated=old.as_ref().is_none_or(|(rev,_)|*rev<revision);
    if updated {write_atomic(&manifest_file(root),&bytes)?;}
    Ok(json!({"revision":revision,"updated":updated,"downloaded":downloaded,"available":assets.len()}))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn sample()->String{r#"{"schemaVersion":1,"revision":1,"assets":[{"key":"avatar:char:linko","path":"src/assets/characters/avatars/linko.png","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","width":192,"height":192}]}"#.into()}
    #[test] fn rejects_traversal_and_external_urls(){
        assert!(!safe_path("../evil.png"));assert!(!safe_path("https://external/x.png"));
        assert!(!safe_path("assets/characters/avatars/../evil.png"));
        assert!(!safe_key("avatar:char:../../../bad"));assert!(!safe_key("avatar:char:bad.png"));
    }
    #[test] fn accepts_owned_avatar_paths(){assert!(parse_manifest(sample().as_bytes()).is_ok());}
    #[test] fn rejects_bad_key_and_duplicate(){
        let s=sample().replace("avatar:char:linko","avatar:char:../bad");
        assert!(parse_manifest(s.as_bytes()).is_err());
        let mut v:Value=serde_json::from_str(&sample()).unwrap();
        let same=v["assets"][0].clone();v["assets"].as_array_mut().unwrap().push(same);
        assert!(parse_manifest(v.to_string().as_bytes()).is_err());
    }
    #[test] fn nonexistent_library_returns_safe_fallback(){
        let root=std::env::temp_dir().join(format!("nte-image-test-{}",Uuid::new_v4()));
        assert_eq!(library(&root).unwrap()["revision"],json!(0));
        assert!(read_image(&root,"avatar:char:linko").is_err());
    }
}
