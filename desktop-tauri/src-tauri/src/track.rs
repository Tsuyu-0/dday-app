// 작업 기록: 사용자가 고른 프로그램을 앞에 띄워 놓고 쓰는 동안만 시간을 재요.
// 마우스 · 키보드 입력이 5초 동안 없으면 멈추고(그 구간은 끝), 다시 만지면 새 구간이 시작돼요.
// 숨은 창의 타이머는 윈도우가 느리게 돌려서, 재는 일은 여기(따로 도는 스레드)에서 해요.
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};

const IDLE_MS: u64 = 5000;

struct St { data: Value, path: PathBuf, cur: Option<(String, u64)>, seen: Vec<String>, dirty: bool, flushed: Instant }
static ST: Mutex<Option<St>> = Mutex::new(None);

fn today() -> String { chrono::Local::now().format("%Y-%m-%d").to_string() }
fn now_s() -> u64 { std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0) }

fn norm(mut v: Value) -> Value {
    if !v.is_object() { v = json!({}); }
    for k in ["apps", "log"] { if !v[k].is_array() { v[k] = json!([]); } }
    for k in ["days", "got"] { if !v[k].is_object() { v[k] = json!({}); } }
    v
}

fn flush(st: &mut St) {
    let tmp = st.path.with_extension("json.tmp");
    if fs::write(&tmp, st.data.to_string()).is_ok() { let _ = fs::rename(&tmp, &st.path); }
    st.dirty = false; st.flushed = Instant::now();
}

fn end_session(st: &mut St) {
    if let Some((exe, len)) = st.cur.take() {
        let d = today();
        let day = &mut st.data["days"][&d][&exe];
        day["s"] = json!(day["s"].as_u64().unwrap_or(0) + 1);
        if let Some(log) = st.data["log"].as_array_mut() {
            log.push(json!([d, exe, now_s().saturating_sub(len), len]));
            let n = log.len(); if n > 8000 { log.drain(0..n - 8000); }
        }
        st.dirty = true;
        flush(st);
    }
}

pub fn start(dir: PathBuf) {
    let path = dir.join("track.json");
    let data = norm(fs::read_to_string(&path).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or(json!({})));
    *ST.lock().unwrap() = Some(St { data, path, cur: None, seen: vec![], dirty: false, flushed: Instant::now() });
    let mut tick: u64 = 0;
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(1));
        tick += 1;
        // 가볍게: 자리를 비웠거나(입력 5초 없음) 잴 프로그램이 없으면 맨 앞 프로그램을 자주 묻지 않아요 (맥은 묻는 데 품이 들어서)
        let idle = fg::idle_ms();
        let (has_apps, live) = match ST.lock() { Ok(g) => g.as_ref().map(|s| (s.data["apps"].as_array().map(|a| !a.is_empty()).unwrap_or(false), s.cur.is_some())).unwrap_or((false, false)), Err(_) => continue };
        let app = if idle >= IDLE_MS { None } else if has_apps || tick % 5 == 0 { fg::front() } else { None };
        if !has_apps && app.is_none() && !live { continue; }
        let mut g = match ST.lock() { Ok(g) => g, Err(_) => continue };
        let st = match g.as_mut() { Some(s) => s, None => continue };
        if let Some(a) = &app {
            let low = a.to_lowercase();
            if !low.contains("anniversary") && !a.contains("기념일") {
                st.seen.retain(|x| x.to_lowercase() != low); st.seen.insert(0, a.clone()); st.seen.truncate(12);
            }
        }
        // 고른 프로그램인지 (대소문자 무시) → 목록에 적힌 이름으로 기록
        let tracked: Option<String> = app.as_ref().and_then(|a| {
            let low = a.to_lowercase();
            st.data["apps"].as_array().and_then(|l| l.iter().filter_map(|x| x["exe"].as_str()).find(|e| e.to_lowercase() == low).map(|e| e.to_string()))
        });
        let active = tracked.is_some() && idle < IDLE_MS;
        if active {
            let exe = tracked.unwrap();
            if st.cur.as_ref().map(|c| c.0 != exe).unwrap_or(false) { end_session(st); }
            let len = st.cur.as_ref().map(|c| c.1).unwrap_or(0) + 1;
            st.cur = Some((exe.clone(), len));
            let d = today();
            let day = &mut st.data["days"][&d][&exe];
            day["t"] = json!(day["t"].as_u64().unwrap_or(0) + 1);
            if day["best"].as_u64().unwrap_or(0) < len { day["best"] = json!(len); }
            st.dirty = true;
        } else if st.cur.is_some() { end_session(st); }
        if st.dirty && st.flushed.elapsed() > Duration::from_secs(30) { flush(st); }
    });
}

/// 화면에 보여 줄 기록 전체 + 지금 이어지는 구간 + 최근에 쓴 프로그램
pub fn get() -> Value {
    let g = ST.lock().unwrap();
    match g.as_ref() {
        Some(st) => {
            let mut v = st.data.clone();
            v["live"] = match &st.cur { Some((e, l)) => json!({ "exe": e, "len": l }), None => Value::Null };
            v["seen"] = json!(st.seen);
            v["today"] = json!(today());
            v
        }
        None => json!({}),
    }
}

/// 잴 프로그램 목록 · 받은 보상 표시 바꾸기
pub fn set(key: String, val: Value) -> bool {
    let mut g = ST.lock().unwrap();
    let st = match g.as_mut() { Some(s) => s, None => return false };
    if key != "apps" && key != "got" { return false; }
    st.data[key.as_str()] = val;
    st.data = norm(st.data.take());
    flush(st);
    true
}

/// 지금 켜져 있는(창이 보이는) 프로그램 목록: [{exe, name}] — 프로그램 고르기 창에서 써요
pub fn running() -> Value {
    let mut out: Vec<Value> = vec![]; let mut seen: Vec<String> = vec![];
    for (exe, name) in fg::running() {
        let low = exe.to_lowercase();
        if seen.contains(&low) || low.contains("anniversary") || exe.contains("기념일") { continue; }
        seen.push(low); out.push(json!({ "exe": exe, "name": name }));
    }
    json!(out)
}
/// 지금 맨 앞 프로그램 (몇 초 뒤 잡기)
pub fn front_now() -> Value { match fg::front() { Some(e) => json!(e), None => Value::Null } }

pub fn save_now() { if let Ok(mut g) = ST.lock() { if let Some(st) = g.as_mut() { end_session(st); flush(st); } } }

#[cfg(windows)]
mod fg {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::SystemInformation::GetTickCount;
    use windows_sys::Win32::System::Threading::{OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION};
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
    use windows_sys::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};
    pub fn idle_ms() -> u64 {
        unsafe {
            let mut li = LASTINPUTINFO { cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32, dwTime: 0 };
            if GetLastInputInfo(&mut li) == 0 { return 0; }
            GetTickCount().wrapping_sub(li.dwTime) as u64
        }
    }
    use windows_sys::Win32::Foundation::{HWND, LPARAM, BOOL};
    use windows_sys::Win32::UI::WindowsAndMessaging::{EnumWindows, IsWindowVisible, GetWindow, GetWindowLongW, GetWindowTextLengthW, GW_OWNER, GWL_EXSTYLE, WS_EX_TOOLWINDOW};
    use windows_sys::Win32::Storage::FileSystem::{GetFileVersionInfoSizeW, GetFileVersionInfoW, VerQueryValueW};

    unsafe fn path_of(h: HWND) -> Option<String> {
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(h, &mut pid);
        if pid == 0 { return None; }
        let ph = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if ph.is_null() { return None; }
        let mut buf = [0u16; 1024];
        let mut len = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(ph, 0, buf.as_mut_ptr(), &mut len);
        CloseHandle(ph);
        if ok == 0 { return None; }
        Some(String::from_utf16_lossy(&buf[..len as usize]))
    }
    fn exe_of(path: &str) -> Option<String> { path.rsplit('\\').next().map(|s| s.to_string()).filter(|s| !s.is_empty()) }

    /// 지금 앞에 떠 있는 프로그램의 실행 파일 이름 (예: CLIPStudioPaint.exe)
    pub fn front() -> Option<String> {
        unsafe {
            let h = GetForegroundWindow();
            if h.is_null() { return None; }
            path_of(h).and_then(|p| exe_of(&p))
        }
    }

    /// 실행 파일에 적힌 이름 (예: "CLIP STUDIO PAINT")
    fn desc_of(path: &str) -> Option<String> {
        unsafe {
            let w: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
            let mut hnd = 0u32;
            let size = GetFileVersionInfoSizeW(w.as_ptr(), &mut hnd);
            if size == 0 { return None; }
            let mut buf = vec![0u8; size as usize];
            if GetFileVersionInfoW(w.as_ptr(), 0, size, buf.as_mut_ptr() as *mut _) == 0 { return None; }
            let q = |key: &str| -> Option<String> {
                let k: Vec<u16> = key.encode_utf16().chain(std::iter::once(0)).collect();
                let mut p: *mut core::ffi::c_void = std::ptr::null_mut(); let mut l = 0u32;
                if VerQueryValueW(buf.as_ptr() as *const _, k.as_ptr(), &mut p, &mut l) == 0 || p.is_null() || l == 0 { return None; }
                let sl = std::slice::from_raw_parts(p as *const u16, l as usize);
                let s = String::from_utf16_lossy(sl).trim_end_matches('\0').trim().to_string();
                if s.is_empty() { None } else { Some(s) }
            };
            let mut keys: Vec<String> = vec![];
            let tk: Vec<u16> = "\\VarFileInfo\\Translation".encode_utf16().chain(std::iter::once(0)).collect();
            let mut p: *mut core::ffi::c_void = std::ptr::null_mut(); let mut l = 0u32;
            if VerQueryValueW(buf.as_ptr() as *const _, tk.as_ptr(), &mut p, &mut l) != 0 && !p.is_null() && l >= 4 {
                let t = std::slice::from_raw_parts(p as *const u16, 2);
                keys.push(format!("\\StringFileInfo\\{:04x}{:04x}\\FileDescription", t[0], t[1]));
            }
            keys.push("\\StringFileInfo\\040904b0\\FileDescription".into());
            keys.push("\\StringFileInfo\\041204b0\\FileDescription".into());
            for k in keys { if let Some(s) = q(&k) { return Some(s); } }
            None
        }
    }

    unsafe extern "system" fn collect(h: HWND, lp: LPARAM) -> BOOL { let v = &mut *(lp as *mut Vec<HWND>); v.push(h); 1 }

    /// 창이 보이는 프로그램들: (실행 파일, 보기 좋은 이름)
    pub fn running() -> Vec<(String, String)> {
        let mut out = vec![];
        unsafe {
            let mut hs: Vec<HWND> = vec![];
            EnumWindows(Some(collect), &mut hs as *mut Vec<HWND> as LPARAM);
            for h in hs {
                if IsWindowVisible(h) == 0 || !GetWindow(h, GW_OWNER).is_null() || GetWindowTextLengthW(h) == 0 { continue; }
                if (GetWindowLongW(h, GWL_EXSTYLE) as u32) & WS_EX_TOOLWINDOW != 0 { continue; }
                let path = match path_of(h) { Some(p) => p, None => continue };
                let exe = match exe_of(&path) { Some(e) => e, None => continue };
                let low = exe.to_lowercase();
                if ["explorer.exe", "applicationframehost.exe", "textinputhost.exe", "shellexperiencehost.exe", "searchhost.exe", "startmenuexperiencehost.exe", "lockapp.exe"].contains(&low.as_str()) { continue; }
                let name = desc_of(&path).unwrap_or_else(|| exe.trim_end_matches(".exe").trim_end_matches(".EXE").to_string());
                out.push((exe, name));
            }
        }
        out
    }
}

#[cfg(target_os = "macos")]
mod fg {
    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" { fn CGEventSourceSecondsSinceLastEventType(state: i32, ty: u32) -> f64; }
    pub fn idle_ms() -> u64 { unsafe { (CGEventSourceSecondsSinceLastEventType(1, u32::MAX).max(0.0) * 1000.0) as u64 } }
    /// 맨 앞 앱 이름 (예: Clip Studio Paint)
    pub fn front() -> Option<String> {
        let o = std::process::Command::new("lsappinfo").arg("front").output().ok()?;
        let asn = String::from_utf8_lossy(&o.stdout).trim().to_string();
        if asn.is_empty() { return None; }
        let o = std::process::Command::new("lsappinfo").args(["info", "-only", "name", &asn]).output().ok()?;
        let s = String::from_utf8_lossy(&o.stdout).to_string();
        let parts: Vec<&str> = s.split('"').collect();
        if parts.len() >= 4 { Some(parts[parts.len() - 2].to_string()).filter(|x| !x.is_empty()) } else { None }
    }
    /// 화면에 보이는 앱들 (Dock에 나오는 앱)
    pub fn running() -> Vec<(String, String)> {
        let o = match std::process::Command::new("lsappinfo").arg("visibleProcessList").output() { Ok(o) => o, Err(_) => return vec![] };
        let s = String::from_utf8_lossy(&o.stdout).to_string();
        s.split('"').enumerate().filter(|(i, _)| i % 2 == 1).map(|(_, x)| x.trim().to_string()).filter(|x| !x.is_empty() && x != "Finder").map(|x| (x.clone(), x)).collect()
    }
}

#[cfg(not(any(windows, target_os = "macos")))]
mod fg {
    pub fn idle_ms() -> u64 { 0 }
    pub fn front() -> Option<String> { std::env::var("DDAY_FAKE_FRONT").ok() }
    pub fn running() -> Vec<(String, String)> { vec![("CLIPStudioPaint.exe".into(), "CLIP STUDIO PAINT".into()), ("Photoshop.exe".into(), "Adobe Photoshop 2025".into()), ("chrome.exe".into(), "Google Chrome".into())] }
}
