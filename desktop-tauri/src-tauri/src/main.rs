// 기념일 D-day (PC) — 무거운 크롬 대신 윈도우에 들어 있는 WebView2로 돌아가요.
// 화면과 거의 모든 동작은 web/core.js(숨은 창)에 있고, 여기는 파일 · 창 닫기 · 플러그인만 맡아요.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::Engine;
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Emitter;
use tauri_plugin_autostart::ManagerExt as _;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;

static QUITTING: AtomicBool = AtomicBool::new(false);

/// 예전(Electron) 버전과 같은 데이터 폴더를 써요 → 옮길 필요 없이 그대로 이어져요.
fn data_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    let base = if cfg!(target_os = "macos") {
        PathBuf::from(&home).join("Library").join("Application Support") // 맥: 응용 프로그램 지원 폴더
    } else {
        std::env::var("APPDATA").map(PathBuf::from).unwrap_or_else(|_| PathBuf::from(&home).join(".local").join("share"))
    };
    let d = base.join("기념일 D-day");
    let _ = fs::create_dir_all(&d);
    d
}

fn inside_data(p: &str) -> Option<PathBuf> {
    let p = PathBuf::from(p.replace('/', std::path::MAIN_SEPARATOR_STR));
    let root = data_dir();
    let c = p.canonicalize().ok()?;
    let r = root.canonicalize().ok()?;
    if c.starts_with(&r) { Some(c) } else { None }
}

#[tauri::command]
fn log(msg: String) { eprintln!("[web] {}", msg); }

#[tauri::command]
fn data_path() -> String { data_dir().to_string_lossy().to_string() }

#[tauri::command]
fn read_state() -> Option<String> { fs::read_to_string(data_dir().join("state.json")).ok() }

#[tauri::command]
fn write_state(text: String) -> bool {
    let d = data_dir();
    let tmp = d.join("state.json.tmp");
    fs::write(&tmp, text).is_ok() && fs::rename(&tmp, d.join("state.json")).is_ok()
}

/// 그림 · 소리 저장: 내용 해시를 이름으로 (같은 파일은 한 번만)
#[tauri::command]
fn save_blob(kind: String, b64: String, ext: String) -> Option<String> {
    if kind != "images" && kind != "sounds" { return None; }
    if !ext.chars().all(|c| c.is_ascii_alphanumeric()) || ext.len() > 5 { return None; }
    let buf = base64::engine::general_purpose::STANDARD.decode(b64.as_bytes()).ok()?;
    if kind == "sounds" && buf.len() > 3 * 1024 * 1024 { return None; }
    let dir = data_dir().join(&kind);
    fs::create_dir_all(&dir).ok()?;
    let h = sha1_smol::Sha1::from(&buf).digest().to_string();
    let file = dir.join(format!("{}.{}", &h[..20], ext));
    if !file.exists() { fs::write(&file, &buf).ok()?; }
    Some(file.to_string_lossy().to_string())
}

/// 내보내기 때 그림을 파일 안에 넣으려고 읽어요 (데이터 폴더 안만)
#[tauri::command]
fn read_b64(path: String) -> Option<String> {
    let p = inside_data(&path)?;
    let buf = fs::read(p).ok()?;
    Some(base64::engine::general_purpose::STANDARD.encode(buf))
}

#[tauri::command]
async fn save_file(app: tauri::AppHandle, name: String, filter: String, ext: String, text: String) -> bool {
    let picked = app.dialog().file().set_file_name(&name).add_filter(&filter, &[ext.as_str()]).blocking_save_file();
    match picked.and_then(|p| p.into_path().ok()) {
        Some(p) => fs::write(p, text).is_ok(),
        None => false,
    }
}

#[tauri::command]
fn open_folder(app: tauri::AppHandle) { let _ = app.opener().open_path(data_dir().to_string_lossy().to_string(), None::<&str>); }

#[tauri::command]
fn open_url(app: tauri::AppHandle, url: String) {
    if url.starts_with("https://github.com/Tsuyu-0/") { let _ = app.opener().open_url(url, None::<&str>); }
}

#[tauri::command]
fn notify(app: tauri::AppHandle, title: String, body: String) { let _ = app.notification().builder().title(title).body(body).show(); }

#[tauri::command]
fn set_autostart(app: tauri::AppHandle, on: bool) {
    let a = app.autolaunch();
    let _ = if on { a.enable() } else { a.disable() };
}

#[tauri::command]
fn started_hidden() -> bool { std::env::args().any(|a| a == "--hidden") }

#[tauri::command]
fn quit_app(app: tauri::AppHandle) { QUITTING.store(true, Ordering::SeqCst); let _ = app.emit("quitting", ()); std::thread::sleep(std::time::Duration::from_millis(300)); app.exit(0); }

/* 돌아다니기: 창을 Rust 쪽에서 촘촘하게(약 120번/초) 옮겨야 덜 끊겨요. 창마다 번호를 올려서 새 걸음이 오면 이전 걸음은 멈춰요 */
static WALK_GEN: std::sync::Mutex<Option<std::collections::HashMap<String, u64>>> = std::sync::Mutex::new(None);
fn walk_gen(label: &str, bump: bool) -> u64 {
    let mut g = WALK_GEN.lock().unwrap();
    let m = g.get_or_insert_with(std::collections::HashMap::new);
    let e = m.entry(label.to_string()).or_insert(0);
    if bump { *e += 1; }
    *e
}
#[tauri::command]
fn walk_move(window: tauri::WebviewWindow, from_x: f64, to_x: f64, y: i32, ms: u64) {
    let label = window.label().to_string();
    let me = walk_gen(&label, true);
    std::thread::spawn(move || {
        let t0 = std::time::Instant::now();
        let total = std::time::Duration::from_millis(ms.max(1));
        loop {
            if walk_gen(&label, false) != me { return; }
            let k = (t0.elapsed().as_secs_f64() / total.as_secs_f64()).min(1.0);
            let x = from_x + (to_x - from_x) * k;
            let _ = window.set_position(tauri::PhysicalPosition::new(x.round() as i32, y));
            if k >= 1.0 { return; }
            std::thread::sleep(std::time::Duration::from_millis(8));
        }
    });
}
#[tauri::command]
fn walk_stop(window: tauri::WebviewWindow) { walk_gen(window.label(), true); }

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| { let _ = app.emit_to("core", "second-instance", ()); }))
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--hidden"])))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![log, data_path, read_state, write_state, save_blob, read_b64, save_file, open_folder, open_url, notify, set_autostart, started_hidden, quit_app, walk_move, walk_stop])
        .on_window_event(|w, e| {
            // 관리 창 X → 끄지 않고 숨겨서 트레이에 남아요
            if let tauri::WindowEvent::CloseRequested { api, .. } = e {
                if w.label() == "manager" && !QUITTING.load(Ordering::SeqCst) { api.prevent_close(); let _ = w.hide(); }
                if w.label() == "core" && !QUITTING.load(Ordering::SeqCst) { api.prevent_close(); }
            }
        })
        .run(tauri::generate_context!())
        .expect("실행하지 못했어요");
}
