use base64::{engine::general_purpose::STANDARD, Engine as _};
use chrono::Local;
use rusqlite::{params, Connection};
use serde_json::{json, Value};
use std::{collections::HashSet, fs::{self, File}, io::{Read, Write}, path::{Path, PathBuf}};
use tauri::Manager;
use uuid::Uuid;
use zip::{write::FileOptions, ZipArchive, ZipWriter};

#[derive(Clone)]
struct AppPaths { root: PathBuf }
impl AppPaths {
    fn db(&self) -> PathBuf { self.root.join("nte.sqlite3") }
    fn portraits(&self) -> PathBuf { self.root.join("portraits") }
    fn backups(&self) -> PathBuf { self.root.join("backups") }
}

type CmdResult<T> = Result<T, String>;
const KINDS: [&str; 3] = ["characters", "arcs", "achievements"];
const MAX_IMAGE_BYTES: usize = 5 * 1024 * 1024;
const MAX_IMPORT_BYTES: u64 = 256 * 1024 * 1024;

fn open_db(paths: &AppPaths) -> CmdResult<Connection> {
    let db = Connection::open(paths.db()).map_err(|e| e.to_string())?;
    db.busy_timeout(std::time::Duration::from_secs(5)).map_err(|e| e.to_string())?;
    db.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
        CREATE TABLE IF NOT EXISTS items (kind TEXT NOT NULL, id TEXT NOT NULL, data_json TEXT NOT NULL,
        PRIMARY KEY (kind, id));
        CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);")
        .map_err(|e| e.to_string())?;
    let seeded: i64 = db.query_row("SELECT COUNT(*) FROM meta WHERE key='seeded'", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    if seeded == 0 {
        let seed: Value = serde_json::from_str(include_str!("../seed.json")).map_err(|e| e.to_string())?;
        write_db(&db, &seed)?;
        db.execute("INSERT INTO meta(key, value) VALUES ('seeded', '1')", []).map_err(|e| e.to_string())?;
    }
    Ok(db)
}

fn validate_state(data: &Value) -> CmdResult<()> {
    for kind in KINDS {
        let arr = data.get(kind).and_then(Value::as_array).ok_or(format!("Missing {kind} array"))?;
        if arr.len() > 100_000 { return Err(format!("Too many {kind} entries")); }
        let mut ids = HashSet::new();
        for entry in arr {
            let id = entry.get("id").and_then(Value::as_str).ok_or("Entry missing id")?;
            let name = entry.get("name").and_then(Value::as_str).ok_or("Entry missing name")?;
            if id.is_empty() || id.len() > 120 || name.trim().is_empty() || name.len() > 500 {
                return Err(format!("Invalid {kind} entry"));
            }
            if !ids.insert(id) { return Err(format!("Duplicate id in {kind}: {id}")); }
            if let Some(file) = entry.get("portrait").and_then(Value::as_str) {
                if !file.is_empty() && !valid_portrait_file(file) { return Err("Unsafe portrait filename".into()); }
            }
        }
    }
    Ok(())
}

fn read_db(db: &Connection) -> CmdResult<Value> {
    let mut result = json!({"characters": [], "arcs": [], "achievements": []});
    let mut stmt = db.prepare("SELECT kind, data_json FROM items ORDER BY rowid").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
        .map_err(|e| e.to_string())?;
    for row in rows {
        let (kind, raw) = row.map_err(|e| e.to_string())?;
        let value: Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
        if let Some(list) = result.get_mut(&kind).and_then(Value::as_array_mut) { list.push(value); }
    }
    Ok(result)
}

fn write_db(db: &Connection, data: &Value) -> CmdResult<()> {
    validate_state(data)?;
    // One atomic SQLite transaction: a crash cannot leave a partially saved roster.
    db.execute_batch("BEGIN IMMEDIATE TRANSACTION").map_err(|e| e.to_string())?;
    let outcome: CmdResult<()> = (|| {
        db.execute("DELETE FROM items", []).map_err(|e| e.to_string())?;
        let mut stmt = db.prepare("INSERT INTO items(kind, id, data_json) VALUES (?1, ?2, ?3)")
            .map_err(|e| e.to_string())?;
        for kind in KINDS {
            for entry in data[kind].as_array().ok_or("Missing array")? {
                let id = entry["id"].as_str().ok_or("Missing id")?;
                let body = serde_json::to_string(entry).map_err(|e| e.to_string())?;
                stmt.execute(params![kind, id, body]).map_err(|e| e.to_string())?;
            }
        }
        Ok(())
    })();
    match outcome {
        Ok(()) => db.execute_batch("COMMIT").map_err(|e| e.to_string()),
        Err(e) => { let _ = db.execute_batch("ROLLBACK"); Err(e) }
    }
}

fn valid_portrait_file(file: &str) -> bool {
    // No separators, paths, or arbitrary file extensions from imported JSON.
    file.len() <= 100 && file.starts_with("img-") &&
        file.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.' || c == '_') &&
        [".png", ".jpg", ".webp"].iter().any(|ext| file.ends_with(ext))
}
fn image_extension(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") { Some("png") }
    else if bytes.starts_with(b"\xff\xd8\xff") { Some("jpg") }
    else if bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" { Some("webp") }
    else { None }
}
fn mime(file: &str) -> &'static str {
    if file.ends_with(".png") { "image/png" } else if file.ends_with(".webp") { "image/webp" } else { "image/jpeg" }
}

fn create_archive(paths: &AppPaths, dest: &Path) -> CmdResult<()> {
    let db = open_db(paths)?;
    let state = read_db(&db)?;
    let file = File::create(dest).map_err(|e| e.to_string())?;
    let mut zip = ZipWriter::new(file);
    let opts = FileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    zip.start_file("data.json", opts).map_err(|e| e.to_string())?;
    zip.write_all(serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?.as_bytes())
        .map_err(|e| e.to_string())?;
    let mut included = HashSet::new();
    for kind in ["characters", "arcs"] {
        for item in state[kind].as_array().ok_or("Invalid state")? {
            if let Some(name) = item.get("portrait").and_then(Value::as_str) {
                if valid_portrait_file(name) && included.insert(name.to_owned()) {
                    let p = paths.portraits().join(name);
                    if !p.is_file() { return Err(format!("Missing portrait file: {name}")); }
                    zip.start_file(format!("portraits/{name}"), opts).map_err(|e| e.to_string())?;
                    zip.write_all(&fs::read(p).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
                }
            }
        }
    }
    zip.finish().map_err(|e| e.to_string())?;
    Ok(())
}

fn ensure_daily_backup(paths: &AppPaths) -> CmdResult<()> {
    fs::create_dir_all(paths.backups()).map_err(|e| e.to_string())?;
    let path = paths.backups().join(format!("daily-{}.zip", Local::now().format("%Y-%m-%d")));
    if !path.exists() {
        let temp = paths.backups().join("daily-in-progress.zip");
        create_archive(paths, &temp)?;
        fs::rename(&temp, &path).map_err(|e| e.to_string())?;
    }
    // Keep a rolling two-week history of daily archives.
    let mut daily: Vec<_> = fs::read_dir(paths.backups()).map_err(|e| e.to_string())?
        .filter_map(Result::ok).map(|e| e.path())
        .filter(|p| p.file_name().and_then(|s| s.to_str()).unwrap_or("").starts_with("daily-"))
        .collect();
    daily.sort();
    for old in daily.iter().take(daily.len().saturating_sub(14)) { let _ = fs::remove_file(old); }
    Ok(())
}
fn create_named_safety_backup(paths: &AppPaths, prefix: &str) -> CmdResult<()> {
    let dest = paths.backups().join(format!("{}-{}-{}.zip", prefix,
        Local::now().format("%Y%m%d-%H%M%S"), Uuid::new_v4()));
    create_archive(paths, &dest)
}

fn create_safety_backup(paths: &AppPaths) -> CmdResult<()> {
    create_named_safety_backup(paths, "pre-restore")
}

/// Block the update when the safety archive cannot be written.
#[tauri::command]
fn backup_before_update(paths: tauri::State<'_, AppPaths>) -> CmdResult<()> {
    create_named_safety_backup(&paths, "pre-update")
}

#[tauri::command]
fn load_state(paths: tauri::State<'_, AppPaths>) -> CmdResult<Value> { read_db(&open_db(&paths)?) }

#[tauri::command]
fn save_state(paths: tauri::State<'_, AppPaths>, data: Value) -> CmdResult<()> {
    let db = open_db(&paths)?;
    write_db(&db, &data)
}

#[tauri::command]
fn restore_json(paths: tauri::State<'_, AppPaths>, data: Value) -> CmdResult<()> {
    validate_state(&data)?;
    for kind in ["characters", "arcs"] {
        for entry in data[kind].as_array().ok_or("Invalid JSON backup")? {
            if let Some(file) = entry.get("portrait").and_then(Value::as_str) {
                if !paths.portraits().join(file).is_file() {
                    return Err(format!("Missing portrait {file}. Use a ZIP backup when moving between computers."));
                }
            }
        }
    }
    create_safety_backup(&paths)?;
    write_db(&open_db(&paths)?, &data)
}

#[tauri::command]
fn reset_to_excel(paths: tauri::State<'_, AppPaths>) -> CmdResult<Value> {
    create_safety_backup(&paths)?;
    let seed: Value = serde_json::from_str(include_str!("../seed.json")).map_err(|e| e.to_string())?;
    write_db(&open_db(&paths)?, &seed)?;
    Ok(seed)
}

#[tauri::command]
fn save_portrait(paths: tauri::State<'_, AppPaths>, bytes: Vec<u8>) -> CmdResult<String> {
    if bytes.is_empty() || bytes.len() > MAX_IMAGE_BYTES { return Err("Image must be under 5 MB".into()); }
    let ext = image_extension(&bytes).ok_or("Only valid PNG, JPG and WebP images are supported")?;
    let file = format!("img-{}.{}", Uuid::new_v4(), ext);
    fs::write(paths.portraits().join(&file), bytes).map_err(|e| e.to_string())?;
    Ok(file)
}

#[tauri::command]
fn read_portrait(paths: tauri::State<'_, AppPaths>, file_name: String) -> CmdResult<String> {
    if !valid_portrait_file(&file_name) { return Err("Invalid image filename".into()); }
    let bytes = fs::read(paths.portraits().join(&file_name)).map_err(|e| e.to_string())?;
    if bytes.len() > MAX_IMAGE_BYTES { return Err("Image too large".into()); }
    Ok(format!("data:{};base64,{}", mime(&file_name), STANDARD.encode(bytes)))
}

#[tauri::command]
fn backup_zip(paths: tauri::State<'_, AppPaths>, path: String) -> CmdResult<()> {
    let out = PathBuf::from(path);
    if !out.is_absolute() || out.extension().and_then(|x| x.to_str()) != Some("zip") {
        return Err("Choose an absolute .zip destination".into());
    }
    // Build in a temp filename then rename to avoid half-written backups.
    let temp = out.with_extension("zip.incomplete");
    if let Err(e) = create_archive(&paths, &temp) { let _ = fs::remove_file(&temp); return Err(e); }
    if out.exists() {
        // Preserve the previous export until its replacement has been moved into place.
        let previous = out.with_extension(format!("zip.previous-{}", Uuid::new_v4()));
        fs::rename(&out, &previous).map_err(|e| e.to_string())?;
        if let Err(e) = fs::rename(&temp, &out) {
            let _ = fs::rename(&previous, &out);
            return Err(e.to_string());
        }
        let _ = fs::remove_file(previous);
    } else {
        fs::rename(&temp, &out).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn restore_zip(paths: tauri::State<'_, AppPaths>, path: String) -> CmdResult<Value> {
    let source = File::open(&path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(source).map_err(|e| e.to_string())?;
    if archive.len() > 3000 { return Err("Backup contains too many files".into()); }
    let mut parsed: Option<Value> = None;
    let mut portraits: Vec<(String, Vec<u8>)> = Vec::new();
    let mut total: u64 = 0;
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = entry.name().to_owned();
        total = total.saturating_add(entry.size());
        if total > MAX_IMPORT_BYTES { return Err("Backup exceeds 256 MB uncompressed".into()); }
        if name == "data.json" {
            let mut contents = String::new();
            entry.read_to_string(&mut contents).map_err(|e| e.to_string())?;
            let data: Value = serde_json::from_str(&contents).map_err(|e| e.to_string())?;
            validate_state(&data)?;
            parsed = Some(data);
        } else if let Some(file_name) = name.strip_prefix("portraits/") {
            if !valid_portrait_file(file_name) { return Err("Unsafe portrait name in backup".into()); }
            if entry.size() > MAX_IMAGE_BYTES as u64 { return Err("Oversized portrait in backup".into()); }
            let mut bytes = Vec::new();
            entry.read_to_end(&mut bytes).map_err(|e| e.to_string())?;
            let ext = image_extension(&bytes).ok_or("Invalid image in backup")?;
            if !file_name.ends_with(&format!(".{ext}")) { return Err("Portrait extension mismatch".into()); }
            portraits.push((file_name.to_string(), bytes));
        } else { return Err(format!("Unexpected file in archive: {name}")); }
    }
    let data = parsed.ok_or("Backup is missing data.json")?;
    // Validate all linked portraits before changing the database.
    let imported: HashSet<&str> = portraits.iter().map(|(n, _)| n.as_str()).collect();
    for kind in ["characters", "arcs"] {
        for entry in data[kind].as_array().ok_or("Invalid state")? {
            if let Some(file) = entry.get("portrait").and_then(Value::as_str) {
                if !imported.contains(file) && !paths.portraits().join(file).exists() {
                    return Err(format!("Backup is missing the linked portrait: {file}"));
                }
            }
        }
    }
    create_safety_backup(&paths)?;
    for (name, bytes) in portraits {
        fs::write(paths.portraits().join(name), bytes).map_err(|e| e.to_string())?;
    }
    write_db(&open_db(&paths)?, &data)?;
    Ok(data)
}

#[tauri::command]
fn get_data_directory(paths: tauri::State<'_, AppPaths>) -> String {
    paths.root.to_string_lossy().to_string()
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let root = app.path().app_data_dir()?;
            fs::create_dir_all(root.join("portraits"))?;
            fs::create_dir_all(root.join("backups"))?;
            let paths = AppPaths { root };
            open_db(&paths).map_err(std::io::Error::other)?;
            if let Err(error) = ensure_daily_backup(&paths) {
                // A missing image or full backup disk must not lock the user out of the app.
                eprintln!("Automatic backup warning: {error}");
            }
            app.manage(paths);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_state, save_state, reset_to_excel, restore_json, save_portrait, read_portrait,
            backup_zip, restore_zip, get_data_directory, backup_before_update
        ])
        .run(tauri::generate_context!())
        .expect("NTE Tracker startup failed");
}
