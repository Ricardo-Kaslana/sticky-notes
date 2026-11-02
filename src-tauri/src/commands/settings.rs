use super::atomic_write;
use crate::models::{
    Settings, COLOR_KEYS, NOTE_ZOOM_MAX, NOTE_ZOOM_MIN, SORT_BY_KEYS, SORT_DIR_KEYS,
};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_autostart::ManagerExt;

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.join("settings.json"))
        .map_err(|e| format!("failed to resolve app data dir: {}", e))
}

/// Cached read: settings are consulted on every main-window close, so the
/// parsed value lives in AppState and disk is only touched once. A corrupt
/// settings.json falls back to defaults (the broken file is kept as .bak)
/// instead of wedging the settings dialog forever.
pub(crate) fn load_settings(app: &AppHandle) -> Result<Settings, String> {
    let state = app.state::<crate::AppState>();
    if let Some(s) = state.settings.lock().unwrap().as_ref() {
        return Ok(s.clone());
    }
    let path = settings_path(app)?;
    let settings = if path.exists() {
        let parsed = fs::read_to_string(&path)
            .map_err(|e| e.to_string())
            .and_then(|c| serde_json::from_str::<Settings>(&c).map_err(|e| e.to_string()));
        match parsed {
            Ok(s) => s,
            Err(e) => {
                log::warn!(
                    "[settings] settings.json unreadable ({}); using defaults, keeping .bak",
                    e
                );
                let _ = fs::rename(&path, path.with_extension("json.bak"));
                Settings::default()
            }
        }
    } else {
        Settings::default()
    };
    *state.settings.lock().unwrap() = Some(settings.clone());
    Ok(settings)
}

/// Sync the OS autostart entry with the setting. Failures are logged, not
/// fatal — the rest of the settings still apply.
pub(crate) fn apply_autostart(app: &AppHandle, want: bool) {
    let autolaunch = app.autolaunch();
    let enabled = autolaunch.is_enabled().unwrap_or(false);
    let result = if want && !enabled {
        autolaunch.enable()
    } else if !want && enabled {
        autolaunch.disable()
    } else {
        Ok(())
    };
    if let Err(e) = result {
        log::warn!("[settings] failed to update autostart: {}", e);
    }
}

#[tauri::command]
pub async fn read_settings(app: AppHandle) -> Result<Settings, String> {
    load_settings(&app)
}

#[tauri::command]
pub async fn write_settings(app: AppHandle, mut settings: Settings) -> Result<(), String> {
    if !COLOR_KEYS.contains(&settings.default_color.as_str()) {
        return Err(format!("invalid default color: {}", settings.default_color));
    }
    // 0 would turn the frontend auto-save debounce into a busy loop.
    settings.auto_save_interval_ms = settings.auto_save_interval_ms.clamp(500, 3_600_000);
    if !SORT_BY_KEYS.contains(&settings.sort_by.as_str()) {
        return Err(format!("invalid sort key: {}", settings.sort_by));
    }
    if !SORT_DIR_KEYS.contains(&settings.sort_dir.as_str()) {
        return Err(format!("invalid sort direction: {}", settings.sort_dir));
    }
    // Reject NaN before clamping: `f64::clamp` propagates NaN, and a NaN
    // would then fail (or silently null) in serde_json on the way out.
    if !settings.note_zoom.is_finite() {
        return Err(format!("invalid note zoom: {}", settings.note_zoom));
    }
    settings.note_zoom = settings.note_zoom.clamp(NOTE_ZOOM_MIN, NOTE_ZOOM_MAX);
    let path = settings_path(&app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    atomic_write(&path, json.as_bytes())?;
    *app.state::<crate::AppState>().settings.lock().unwrap() = Some(settings.clone());
    apply_autostart(&app, settings.launch_on_startup);
    // Already-open note windows pick up the new auto-save interval here.
    let _ = app.emit("settings-changed", &settings);
    Ok(())
}
