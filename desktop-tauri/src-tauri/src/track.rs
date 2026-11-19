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
    std::thread::spawn(|| loop {
        std::thread::sleep(Duration::from_secs(1));
        let app = fg::front();
        let idle = fg::idle_ms();
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
    /// 지금 앞에 떠 있는 프로그램의 실행 파일 이름 (예: CLIPStudioPaint.exe)
    pub fn front() -> Option<String> {
        unsafe {
            let h = GetForegroundWindow();
            if h.is_null() { return None; }
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
            let path = String::from_utf16_lossy(&buf[..len as usize]);
            path.rsplit('\\').next().map(|s| s.to_string()).filter(|s| !s.is_empty())
        }
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
}

#[cfg(not(any(windows, target_os = "macos")))]
mod fg {
    pub fn idle_ms() -> u64 { 0 }
    pub fn front() -> Option<String> { std::env::var("DDAY_FAKE_FRONT").ok() }
}
