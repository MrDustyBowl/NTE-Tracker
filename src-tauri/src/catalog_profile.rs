use rusqlite::{params, Connection};
use serde_json::{json, Value};

pub fn initialize(conn: &Connection) -> Result<(), String> {
    conn.execute_batch("CREATE TABLE IF NOT EXISTS catalog_progress (
        kind TEXT NOT NULL,
        catalog_id TEXT NOT NULL,
        data_json TEXT NOT NULL,
        PRIMARY KEY(kind, catalog_id)
    );").map_err(|e| e.to_string())
}

const KINDS: [&str; 5] = ["characters", "arcs", "achievements", "items", "bonds"];
fn valid_kind(kind: &str) -> bool { KINDS.contains(&kind) }
fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 160 && id.chars().all(|c| c.is_ascii_alphanumeric() || ":-_".contains(c))
}
fn valid_value(v: &Value) -> bool {
    v.is_object() && serde_json::to_vec(v).map(|a| a.len() <= 32768).unwrap_or(false)
}

pub fn read(conn: &Connection) -> Result<Value, String> {
    initialize(conn)?;
    let mut profile = json!({"characters":{},"arcs":{},"achievements":{},"items":{},"bonds":{}});
    let mut stmt = conn.prepare("SELECT kind, catalog_id, data_json FROM catalog_progress ORDER BY kind, catalog_id")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |r| Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?,r.get::<_,String>(2)?)))
        .map_err(|e| e.to_string())?;
    for row in rows {
        let (kind, id, raw) = row.map_err(|e| e.to_string())?;
        if !valid_kind(&kind) || !valid_id(&id) { return Err("Invalid stored progress key".into()) }
        let v: Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
        if !valid_value(&v) { return Err("Invalid saved progress record".into()) }
        profile[kind.as_str()][id.as_str()] = v;
    }
    Ok(profile)
}

pub fn save_one(conn: &Connection, kind: &str, id: &str, progress: &Value) -> Result<(), String> {
    initialize(conn)?;
    if !valid_kind(kind) || !valid_id(id) || !valid_value(progress) {
        return Err("Invalid progress record".into());
    }
    let raw = serde_json::to_string(progress).map_err(|e|e.to_string())?;
    conn.execute("INSERT INTO catalog_progress (kind, catalog_id, data_json) VALUES (?1,?2,?3)
        ON CONFLICT(kind, catalog_id) DO UPDATE SET data_json=excluded.data_json",
        params![kind,id,raw]).map_err(|e|e.to_string())?;
    Ok(())
}

pub fn validate_profile(value: &Value) -> Result<(), String> {
    let map = value.as_object().ok_or("Profile must be an object")?;
    if map.keys().any(|k| !valid_kind(k)) { return Err("Unknown progress category".into()) }
    for kind in KINDS {
        let Some(records) = value.get(kind) else { continue };
        let group = records.as_object().ok_or("Progress group must be an object")?;
        if group.len() > 100000 { return Err("Too many records".into()) }
        for (id, record) in group {
            if !valid_id(id) || !valid_value(record) { return Err(format!("Invalid {kind} / {id}")) }
        }
    }
    Ok(())
}

pub fn replace(conn: &Connection, value: &Value) -> Result<(), String> {
    validate_profile(value)?;
    initialize(conn)?;
    conn.execute_batch("BEGIN IMMEDIATE TRANSACTION").map_err(|e|e.to_string())?;
    let result: Result<(),String> = (|| {
        conn.execute("DELETE FROM catalog_progress", []).map_err(|e|e.to_string())?;
        for kind in KINDS {
            if let Some(group) = value.get(kind).and_then(Value::as_object) {
                for (id, record) in group {
                    save_one(conn, kind, id, record)?;
                }
            }
        }
        Ok(())
    })();
    match result {
        Ok(()) => conn.execute_batch("COMMIT").map_err(|e|e.to_string()),
        Err(err) => { let _ = conn.execute_batch("ROLLBACK"); Err(err) }
    }
}
