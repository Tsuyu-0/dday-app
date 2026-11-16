const { app, BrowserWindow, ipcMain, Tray, Menu, screen, nativeImage, dialog, shell, nativeTheme, Notification } = require("electron");
const crypto = require("crypto");
const { pathToFileURL, fileURLToPath } = require("url");
const path = require("path");
const fs = require("fs");

if (!app.requestSingleInstanceLock({ version: app.getVersion(), exec: process.execPath })) { app.quit(); return; }

let S = null, statePath = "", manager = null, tray = null, quitting = false;
const PREFS = () => ({ preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true, autoplayPolicy: "no-user-gesture-required" });
function guard(w) {
  w.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: "deny" }; });
  w.webContents.on("will-navigate", (e, url) => { if (!url.startsWith("file:")) { e.preventDefault(); shell.openExternal(url); } });
}
function onScreen(b) {
  if (!b) return null;
  return screen.getAllDisplays().some((d) => { const a = d.workArea; return b.x < a.x + a.width - 40 && b.x + b.width > a.x + 40 && b.y >= a.y - 10 && b.y < a.y + a.height - 40; }) ? b : null;
}

/* ---------- 저장 ---------- */
/* 처음 설치했을 때만: 민둥이 예시 기념일·일정 (오늘 기준 날짜로) */
function addSamples(s) {
  if (!(s.tokens || []).some((t) => t.id === "t-bald")) return;
  const d = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x; };
  const ymd = (x) => x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
  const meet = d(12), hund = d(-79), who = { type: "token", id: "t-bald" };
  s.annivs = (s.annivs || []).concat([
    { id: "a-smp1", sample: true, title: "처음 만난 날", who, y: meet.getFullYear() - 1, m: meet.getMonth() + 1, d: meet.getDate(), repeat: "yearly", count: "since", lines: ["우리 처음 만난 날이야! 기억하지?"], pin: true },
    { id: "a-smp2", sample: true, title: "함께한 날", who, y: hund.getFullYear(), m: hund.getMonth() + 1, d: hund.getDate(), repeat: "d100", count: "dday", lines: [] },
  ]);
  s.events = (s.events || []).concat([
    { id: "e-smp1", sample: true, title: "다이어리 꾸미기", date: ymd(d(2)), time: "", cat: "fan", who, memo: "이번 달 달력에 스티커 붙이기", remind: "morning" },
    { id: "e-smp2", sample: true, title: "TRPG 세션 1회차", date: ymd(d(6)), time: "20:00", cat: "trpg", who, memo: "캐릭터 시트 챙기기", remind: "hour" },
  ]);
}
function loadState() {
  statePath = path.join(app.getPath("userData"), "state.json");
  try { S = JSON.parse(fs.readFileSync(statePath, "utf8")); }
  catch (e) { S = JSON.parse(fs.readFileSync(path.join(__dirname, "seed.json"), "utf8")); addSamples(S); }
  // 0.1 예시 캐릭터 → 0.2 부위별 반응 채우기
  try {
    const seed = JSON.parse(fs.readFileSync(path.join(__dirname, "seed.json"), "utf8"));
    (S.tokens || []).forEach((t) => { const s0 = seed.tokens.find((x) => x.id === t.id); if (!s0 || t.zones) return;
      t.zones = s0.zones; t.parts = Object.assign({}, s0.parts, t.parts || {}); });
  } catch (e) {}
  // 예전 예시(다른 프로그램 기본 그림) → 직접 그린 임시 그림, 예시 캐릭터 니아 추가
  try {
    const seed = JSON.parse(fs.readFileSync(path.join(__dirname, "seed.json"), "utf8")), OLD = {"len": 11583, "mid": "jV5BlQKooODGKzKwQlzoiQU57GpSwxuCisHxbDHGZXJ84dlsXyTWZt4A6QcDFvTWZmDzw2CFMSx9Sn5+"};
    (S.tokens || []).forEach((t) => { const h = t.parts && t.parts.head1 && t.parts.head1.src;
      if (h && h.length === OLD.len && h.slice(3000, 3080) === OLD.mid) t.parts = Object.assign({}, seed.placeholderParts); });
    S.settings = S.settings || {};
    if (!S.settings.niaAdded) { S.settings.niaAdded = true; if (!(S.tokens || []).some((t) => t.id === "t-nia")) { S.tokens = S.tokens || []; const r0 = seed.tokens.find((x) => x.id === "t-nia"); if (r0) { S.tokens.unshift(r0); S.settings.main = "t-nia"; } } }
  } catch (e) {}
  delete S.placeholderParts;
  // 0.9.2: 파츠로 나눈 니아 추가
  try { if (!S.settings.nia2Added) { S.settings.nia2Added = true; const sd = JSON.parse(fs.readFileSync(path.join(__dirname, "seed.json"), "utf8")); const r = sd.tokens.find((x) => x.id === "t-nia2"); if (r && !(S.tokens || []).some((t) => t.id === "t-nia2")) { S.tokens = S.tokens || []; S.tokens.splice(1, 0, r); } } } catch (e) {}
  // 0.9.4: 니아(파츠)를 원본 그림에서 다시 나눔 (비율 그대로)
  try { if (!S.settings.nia2v2) { S.settings.nia2v2 = true; const sd = JSON.parse(fs.readFileSync(path.join(__dirname, "seed.json"), "utf8")); const r = sd.tokens.find((x) => x.id === "t-nia2");
    (S.tokens || []).forEach((t) => { if (t.id === "t-nia2" && r) { t.parts = JSON.parse(JSON.stringify(r.parts)); t.pivot = r.pivot; Object.values(t.zones || {}).forEach((z) => { if (z && /^head[234]$/.test(z.face || "")) z.face = "head1"; }); } }); } } catch (e) {}
  // 0.9.6: 니아(파츠) 고개 축
  (S.tokens || []).forEach((t) => { if (t.id === "t-nia2" && t.pivot && !t.pivot.neck) t.pivot.neck = "50% 63%"; });
  // 0.9.7: 민머리 파츠 샘플 추가
  try { if (!S.settings.baldAdded) { S.settings.baldAdded = true; const sd = JSON.parse(fs.readFileSync(path.join(__dirname, "seed.json"), "utf8")); const r = sd.tokens.find((x) => x.id === "t-bald"); if (r && !(S.tokens || []).some((t) => t.id === "t-bald")) { S.tokens = S.tokens || []; S.tokens.push(r); } } } catch (e) {}
  // 0.9.9: 민머리 샘플 두상 키움 (하관은 그대로)
  try { if (!S.settings.baldV4) { S.settings.baldV4 = true; const sd = JSON.parse(fs.readFileSync(path.join(__dirname, "seed.json"), "utf8")); const r = sd.tokens.find((x) => x.id === "t-bald");
    (S.tokens || []).forEach((t) => { if (t.id === "t-bald" && r) { t.parts = JSON.parse(JSON.stringify(r.parts)); t.pivot = r.pivot; t.zoneSplit = r.zoneSplit; } }); } } catch (e) {}
  // 0.9.1: 파츠 예시 캐릭터 루미 추가
  try { if (!S.settings.rumiAdded) { S.settings.rumiAdded = true; const sd = JSON.parse(fs.readFileSync(path.join(__dirname, "seed.json"), "utf8")); const r = sd.tokens.find((x) => x.id === "t-rumi"); if (r && !(S.tokens || []).some((t) => t.id === "t-rumi")) { S.tokens = S.tokens || []; S.tokens.push(r); } } } catch (e) {}
  // 0.9: 그림 한 장 캐릭터는 반응 하나로 합치기
  (S.tokens || []).forEach((t) => { if (t.kind === "img" && !(t.zones && t.zones.all)) { const z = t.zones || {}, f = z.face || {}, lines = [].concat((z.head || {}).lines || [], f.lines || [], (z.body || {}).lines || []);
    t.zones = Object.assign({}, z, { all: { motion: f.motion || "squash", fx: f.fx || "heart", sound: f.sound || "pop", bubble: f.bubble || "speech", lines } }); } });
  // 0.5: 예시 니아 → 도트 버전
  try {
    const seed2 = JSON.parse(fs.readFileSync(path.join(__dirname, "seed.json"), "utf8")), OLDN = {"len": 52443, "mid": "+XUn4jB3zJPCBsPxKQofzIihCJ+e4R+xb14bRQGdi6g5Jy/8loQgJm3Uqd+RPT//sgHYu6yueQsPksYR"};
    (S.tokens || []).forEach((t) => { const h = t.img && t.img.src; if (t.id === "t-nia" && h && h.length === OLDN.len && h.slice(2000, 2080) === OLDN.mid) { const r0 = seed2.tokens.find((x) => x.id === "t-nia"); if (r0) { t.img = Object.assign({}, r0.img); t.pixel = true; } } });
  } catch (e) {}
  S.tokens = S.tokens || []; S.pairs = S.pairs || []; S.annivs = S.annivs || []; S.events = S.events || []; S.diary = S.diary || {}; S.notes = S.notes || {}; S.settings = Object.assign({ pinned: true, launchAtLogin: true, clickThrough: true, annivSwap: true, annivLead: 0 }, S.settings || {});
  // 0.10: 예시 캐릭터 정리 — 손본 니아(파츠)만 남김
  if (!S.settings.samplesCleaned) {
    S.settings.samplesCleaned = true; S.settings.niaAdded = S.settings.rumiAdded = S.settings.baldAdded = S.settings.nia2Added = true;
    const gone = ["t-nia", "t-rumi", "t-bald"];
    S.tokens = S.tokens.filter((t) => !gone.includes(t.id));
    S.pairs.forEach((p) => { p.tokenIds = (p.tokenIds || []).filter((id) => !gone.includes(id)); });
    if (!S.tokens.some((t) => t.id === S.settings.main)) S.settings.main = (S.tokens.find((t) => t.id === "t-nia2") || S.tokens[0] || {}).id || null;
  }
  // 0.10.1: 민둥이(민머리 샘플)는 다시 넣고, 멜리사·델로아 정리
  if (!S.settings.cleaned2) {
    S.settings.cleaned2 = true;
    try { const sd = JSON.parse(fs.readFileSync(path.join(__dirname, "seed.json"), "utf8")), r = sd.tokens.find((x) => x.id === "t-bald");
      const cur = S.tokens.find((t) => t.id === "t-bald");
      if (cur) { cur.name = cur.nick = "민둥이"; } else if (r) S.tokens.push(r); } catch (e) {}
    const isMelDel = (t) => ["t-melissa", "t-deloa"].includes(t.id) || /멜리사|델로아/.test((t.name || "") + (t.nick || ""));
    const gone = S.tokens.filter(isMelDel).map((t) => t.id);
    if (gone.length) {
      S.tokens = S.tokens.filter((t) => !gone.includes(t.id));
      S.pairs.forEach((p) => { p.tokenIds = (p.tokenIds || []).filter((id) => !gone.includes(id)); });
      const goneP = S.pairs.filter((p) => !(p.tokenIds || []).length).map((p) => p.id);
      S.pairs = S.pairs.filter((p) => !goneP.includes(p.id));
      const dead = (w) => w && ((w.type === "token" && gone.includes(w.id)) || (w.type === "pair" && goneP.includes(w.id)));
      S.annivs = S.annivs.filter((a) => !dead(a.who));
      S.events.forEach((e) => { if (dead(e.who)) e.who = null; if (e.star && gone.includes(e.star)) e.star = null; });
    }
    if (!S.tokens.some((t) => t.id === S.settings.main)) S.settings.main = (S.tokens.find((t) => t.id === "t-nia2") || S.tokens[0] || {}).id || null;
    setTimeout(() => persist(true), 0);
  }
  // 0.11: 소리·말풍선 새로 (팻말이 기본)
  if (!S.settings.bubbleV2) { S.settings.bubbleV2 = true; const MAP = { tok: "pen", pop: "stamp", bubble: "music", squeak: "sticker", chime: "bell" };
    S.tokens.forEach((t) => Object.values(t.zones || {}).forEach((z) => { if (!z) return; if (!z.bubble || z.bubble === "speech") z.bubble = "sign"; if (MAP[z.sound]) z.sound = MAP[z.sound]; })); }
  // 0.12: 팻말 없앰 → 말풍선이 기본, 소리 새로
  if (!S.settings.bubbleV3) { S.settings.bubbleV3 = true; const MAP = { tok: "kalimba", pop: "xylo", bubble: "music", squeak: "sparkle", chime: "glass", pen: "kalimba", page: "harp", stamp: "xylo", sticker: "sparkle", bell: "glass" };
    S.tokens.forEach((t) => Object.values(t.zones || {}).forEach((z) => { if (!z) return; if (z.bubble === "sign") z.bubble = "speech"; if (MAP[z.sound]) z.sound = MAP[z.sound]; })); }
  // 0.13: 옛 소리 이름 정리
  if (!S.settings.soundV4) { S.settings.soundV4 = true; const MAP = { pen: "pencil", stamp: "key", sticker: "wrap", bell: "glass" };
    S.tokens.forEach((t) => Object.values(t.zones || {}).forEach((z) => { if (z && MAP[z.sound]) z.sound = MAP[z.sound]; if (z && z.bubble === "sign") z.bubble = "speech"; })); }
  // 0.15: 웅얼 말소리 기본값
  if (!S.settings.babbleSeed) { S.settings.babbleSeed = true; S.tokens.forEach((t) => { if (t.babble == null) t.babble = t.id === "t-nia2" ? "low" : t.id === "t-bald" ? "round" : "mid"; }); }
  // 0.16: 누를 때는 딸깍 대신 말소리
  if (!S.settings.voiceV2) { S.settings.voiceV2 = true; S.tokens.forEach((t) => { if (!t.babble || t.babble === "none") t.babble = "mid"; if (!t.voice || t.voice === "mix") t.voice = "none"; }); }
  // 0.17: 누를 때 소리와 말소리를 따로
  if (!S.settings.voiceV3) { S.settings.voiceV3 = true; S.tokens.forEach((t) => { if (t.voice === "none") t.voice = "mix"; }); }
  // 0.2 → 0.3: 여러 명 → 기본 캐릭터 한 명
  if (!S.settings.main && S.tokens.length) {
    const shown = S.tokens.find((t) => t.desk && t.desk.show) || S.tokens[0];
    S.settings.main = shown.id;
    if (shown.desk && typeof shown.desk.x === "number") { const sz = shown.desk.size || 160; S.settings.foot = { x: shown.desk.x + (sz + 140) / 2, y: shown.desk.y + sz + 82 }; }
  }
}
let saveT = null;
function persist(now) {
  clearTimeout(saveT);
  const w = () => { try { fs.writeFileSync(statePath + ".tmp", JSON.stringify(S)); fs.renameSync(statePath + ".tmp", statePath); } catch (e) { console.error(e); } };
  if (now) w(); else saveT = setTimeout(w, 400);
}
const tok = (id) => S.tokens.find((t) => t.id === id);
function pushToManager() { if (manager && !manager.isDestroyed()) manager.webContents.send("state", S); }

/* ---------- 펫 창 (바탕화면에는 한 명만) ---------- */
const A = require("./annivs.js");
const PAD_X = 84, PAD_TOP = 112; // 말풍선 자리
let pet = null, petPick = null, lastDay = "";
function petBounds(t) {
  const size = (t.desk && t.desk.size) || 160;
  const up = Math.max(0, ((t.bubblePos && t.bubblePos.y) || 0) / 100 * size); // 말풍선을 위로 올린 만큼 창도 키움
  return { width: size + PAD_X * 2, height: Math.round(size + PAD_TOP + 8 + up), size };
}
function defaultPos(t) {
  const wa = screen.getPrimaryDisplay().workArea, b = petBounds(t);
  return { x: wa.x + wa.width - b.width - 30, y: wa.y + wa.height - b.height - 10 };
}
function keepOnScreen(x, y, w, h) {
  const d = screen.getDisplayMatching({ x, y, width: w, height: h }).workArea;
  return { x: Math.min(Math.max(x, d.x - w + 60), d.x + d.width - 60), y: Math.min(Math.max(y, d.y - PAD_TOP), d.y + d.height - h + 10) };
}
/* 발(아래 가운데) 자리를 기준으로 저장 → 캐릭터가 바뀌어도 같은 자리에 섬 */
function boundsAtFoot(t) {
  const b = petBounds(t), f = S.settings.foot;
  let x, y;
  if (f && typeof f.x === "number") { x = Math.round(f.x - b.width / 2); y = Math.round(f.y - b.height); }
  else { const p = defaultPos(t); x = p.x; y = p.y; }
  const k = keepOnScreen(x, y, b.width, b.height);
  return { x: Math.round(k.x), y: Math.round(k.y), width: b.width, height: b.height };
}
function saveFoot() { if (!pet) return; const b = pet.getBounds(); S.settings.foot = { x: b.x + b.width / 2, y: b.y + b.height }; persist(); }
function petData() {
  if (!petPick) return null;
  const t = tok(petPick.id); if (!t) return null;
  const extra = { clickThrough: S.settings.clickThrough !== false, mute: !!S.settings.mute, volume: typeof S.settings.volume === "number" ? S.settings.volume : 0.5, voiceVol: typeof S.settings.voiceVol === "number" ? S.settings.voiceVol : 0.6, day: A.ymd(new Date()) };
  if (petPick.anniv) {
    const a = petPick.anniv, n = petPick.n;
    extra.anniv = { id: a.id, title: a.title, label: n.label, days: n.days, lines: (a.lines || []).filter(Boolean), def: A.defaultLine(S, a, n) };
  }
  if (petPick.event) extra.event = { id: petPick.event.id, title: petPick.event.title, time: petPick.event.time || "" };
  extra.today = A.on(S, A.ymd(new Date())).events.map((e) => ({ title: e.title, time: e.time || "" }));
  // 이 캐릭터의 다가오는 기념일 (혼잣말용)
  extra.soon = A.upcoming(S).filter((x) => x.n.days > 0 && x.n.days <= 14 && A.involves(S, x.a, t.id)).slice(0, 3).map((x) => ({ title: x.a.title, days: x.n.days }));
  return Object.assign({}, t, { _cfg: extra });
}
function openPet(t) {
  const b = boundsAtFoot(t);
  pet = new BrowserWindow({
    ...b, transparent: true, frame: false, resizable: false, maximizable: false, minimizable: false, fullscreenable: false,
    skipTaskbar: true, hasShadow: false, alwaysOnTop: S.settings.pinned !== false, focusable: false, show: false, backgroundColor: "#00000000",
    webPreferences: PREFS(),
  });
  guard(pet);
  if (S.settings.pinned !== false) pet.setAlwaysOnTop(true, "floating");
  pet.setIgnoreMouseEvents(true, { forward: true });
  pet.loadFile(path.join(__dirname, "pet.html"));
  pet.once("ready-to-show", () => pet && pet.showInactive());
  pet.on("closed", () => { pet = null; });
}
function syncPets() {
  petPick = S.settings.allHidden ? null : A.pick(S);
  const t = petPick && tok(petPick.id);
  if (!t) { if (pet) { pet.destroy(); pet = null; } updateTray(); return; }
  if (!pet) openPet(t);
  else {
    const cur = pet.getBounds(), b = petBounds(t);
    if (cur.width !== b.width || cur.height !== b.height) {
      const fx = cur.x + cur.width / 2, fy = cur.y + cur.height;
      pet.setBounds({ x: Math.round(fx - b.width / 2), y: Math.round(fy - b.height), width: b.width, height: b.height });
    }
    pet.webContents.send("pet:token", petData());
  }
  updateTray();
}
/* 날짜가 바뀌면 다시 고르기 */
setInterval(() => { if (!S) return; const d = A.ymd(new Date()); if (d !== lastDay) { lastDay = d; syncPets(); pushToManager(); } }, 30000);

ipcMain.handle("pet:token", () => petData());
ipcMain.on("pet:ignore", (_e, v) => { if (pet && !pet.dragging) pet.setIgnoreMouseEvents(!!v, { forward: true }); });
ipcMain.on("pet:dragstart", () => { if (!pet) return; pet.dragging = true; pet.dragFrom = pet.getPosition(); pet.setIgnoreMouseEvents(false); });
ipcMain.on("pet:drag", (_e, dx, dy) => { if (!pet || !pet.dragging) return; pet.setPosition(Math.round(pet.dragFrom[0] + dx), Math.round(pet.dragFrom[1] + dy)); });
ipcMain.on("pet:dragend", () => { if (!pet) return; pet.dragging = false; saveFoot(); });
ipcMain.on("pet:menu", () => {
  if (!pet || !petPick) return; const t = tok(petPick.id); if (!t) return;
  t.desk = Object.assign({ size: 160 }, t.desk || {});
  const size = t.desk.size || 160;
  const setSize = (n) => { t.desk.size = n; persist(); syncPets(); pushToManager(); };
  const others = S.tokens.map((x) => ({ label: (x.nick || x.name || "이름 없음") + (x.id === S.settings.main ? "  (기본)" : ""), type: "radio", checked: x.id === petPick.id,
    click: () => { S.settings.main = x.id; persist(); syncPets(); pushToManager(); } }));
  const items = [
    { label: (t.nick || t.name) + " 쓰다듬기", click: () => pet.webContents.send("pet:poke") },
    { label: "관리 창에서 고치기", click: () => { showManager(); setTimeout(() => manager.webContents.send("edit", t.id), 300); } },
    { label: "다른 캐릭터로 바꾸기", submenu: others },
  ];
  if (petPick.anniv) items.push({ label: "오늘: " + petPick.anniv.title + " (" + A.ddayText(petPick.n) + ")", enabled: false });
  if (petPick.event) items.push({ label: "오늘 일정: " + petPick.event.title + (petPick.event.time ? " " + petPick.event.time : ""), enabled: false });
  items.push(
    { type: "separator" },
    { label: "크기", submenu: [[120, "120px"], [160, "160px (기본)"], [240, "240px"], [320, "320px"]].map(([n, l]) => ({ label: l, type: "radio", checked: size === n, click: () => setSize(n) })) },
    { label: "오른쪽 아래로 돌려보내기", click: () => { S.settings.foot = null; const b = boundsAtFoot(t); pet.setBounds(b); saveFoot(); } },
    { label: "위치 잠금", type: "checkbox", checked: !!t.desk.lock, click: (i) => { t.desk.lock = i.checked; persist(); syncPets(); pushToManager(); } },
    { label: "좌우 반전", type: "checkbox", checked: !!t.desk.flip, click: (i) => { t.desk.flip = i.checked; persist(); syncPets(); pushToManager(); } },
    { type: "separator" },
    { label: "관리 창 열기", click: showManager },
    { label: "잠깐 숨기기", click: () => { S.settings.allHidden = true; persist(); syncPets(); pushToManager(); } },
    { label: "종료", click: () => { quitting = true; app.quit(); } },
  );
  Menu.buildFromTemplate(items).popup({ window: pet });
});

/* ---------- 그림 파일 (달력 배경·스티커) ---------- */
function imgDir() { const d = path.join(app.getPath("userData"), "images"); fs.mkdirSync(d, { recursive: true }); return d; }
/* ---------- 새 버전 확인 (GitHub Releases) ---------- */
const REPO_API = "https://api.github.com/repos/Tsuyu-0/dday-app/releases/latest";
let updInfo = null;
function myBuild() { try { return JSON.parse(fs.readFileSync(path.join(__dirname, "build.json"), "utf8")).build || 0; } catch (e) { return 0; } }
async function checkUpdate() {
  const cur = myBuild();
  try {
    const r = await fetch(REPO_API, { headers: { Accept: "application/vnd.github+json" } });
    if (!r.ok) throw new Error(r.status);
    const d = await r.json(), m = /(\d+)$/.exec(d.tag_name || ""), latest = m ? +m[1] : 0;
    const asset = (d.assets || []).find((a) => /Windows\.zip$/.test(a.name));
    updInfo = { newer: !!cur && latest > cur, ver: (d.tag_name || "").replace(/^v/, ""), cur: cur ? "1.0." + cur : "", url: (asset && asset.browser_download_url) || d.html_url, page: d.html_url };
  } catch (e) { updInfo = { err: true, cur: cur ? "1.0." + cur : "" }; }
  if (updInfo.newer && manager && !manager.isDestroyed()) manager.webContents.send("update", updInfo);
  if (updInfo.newer) { S.settings.updSeen = updInfo.ver; updateTray(); }
  return updInfo;
}
ipcMain.handle("upd:check", () => checkUpdate());
ipcMain.on("open:url", (_e, u) => { if (/^https:\/\/github\.com\/Tsuyu-0\//.test(String(u))) shell.openExternal(u); });
ipcMain.handle("snd:save", (_e, dataUrl) => {
  const m = /^data:audio\/([a-z0-9.+-]+);base64,(.+)$/.exec(dataUrl || ""); if (!m) return null;
  const buf = Buffer.from(m[2], "base64"); if (buf.length > 3 * 1024 * 1024) return null;
  const ext = ({ mpeg: "mp3", mp3: "mp3", wav: "wav", "x-wav": "wav", ogg: "ogg", webm: "webm", mp4: "m4a", "x-m4a": "m4a", aac: "aac" })[m[1]] || "bin";
  const dir = path.join(app.getPath("userData"), "sounds"); fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, crypto.createHash("sha1").update(buf).digest("hex").slice(0, 20) + "." + ext);
  if (!fs.existsSync(file)) fs.writeFileSync(file, buf);
  return pathToFileURL(file).href;
});
ipcMain.on("pet:open", (_e, v) => { showManager(); setTimeout(() => { if (manager && !manager.isDestroyed()) manager.webContents.send("nav", v); }, 350); });
ipcMain.handle("img:save", (_e, dataUrl) => {
  const m = /^data:image\/(png|jpeg|webp|gif);base64,(.+)$/.exec(dataUrl || ""); if (!m) return null;
  const buf = Buffer.from(m[2], "base64"), ext = m[1] === "jpeg" ? "jpg" : m[1];
  const name = crypto.createHash("sha1").update(buf).digest("hex").slice(0, 20) + "." + ext, file = path.join(imgDir(), name);
  if (!fs.existsSync(file)) fs.writeFileSync(file, buf);
  return pathToFileURL(file).href;
});
function inlineImages(text) {
  const sndDir = path.join(app.getPath("userData"), "sounds"), AT = { mp3: "mpeg", wav: "wav", ogg: "ogg", m4a: "mp4", webm: "webm", aac: "aac" };
  return text.replace(/file:\/\/\/[^"\\]+?\.(png|jpg|webp|gif|mp3|wav|ogg|m4a|webm|aac)/g, (u, ext) => {
    try { const p = fileURLToPath(u);
      if (AT[ext]) { if (!p.startsWith(sndDir)) return u; return "data:audio/" + AT[ext] + ";base64," + fs.readFileSync(p).toString("base64"); }
      if (!p.startsWith(imgDir())) return u; return "data:image/" + (ext === "jpg" ? "jpeg" : ext) + ";base64," + fs.readFileSync(p).toString("base64"); } catch (e) { return u; }
  });
}

/* ---------- 알림 (일정·기념일) ---------- */
function notify(title, body, line) {
  try { if (Notification.isSupported()) new Notification({ title, body, icon: path.join(__dirname, "icon.png"), silent: false }).show(); } catch (e) {}
  if (pet && line) pet.webContents.send("pet:say", typeof line === "object" ? line : { line, view: "events" });
}
function eventTime(e) { const d = A.parseYmd(e.date); if (!d) return null; const [hh, mm] = (e.time || "09:00").split(":").map(Number); d.setHours(hh || 0, mm || 0, 0, 0); return d; }
function checkReminders() {
  if (!S) return; const now = new Date(), done = S.settings.notified || (S.settings.notified = {}); let changed = false;
  (S.events || []).forEach((e) => {
    if (!e.remind || e.remind === "none") return; const t = eventTime(e); if (!t) return;
    const at = new Date(t); if (e.remind === "hour") at.setHours(at.getHours() - 1); else if (e.remind === "day") at.setDate(at.getDate() - 1); else if (e.remind === "morning") at.setHours(9, 0, 0, 0);
    const key = e.id + "|" + e.remind + "|" + e.date + "|" + (e.time || "");
    if (now >= at && now - at < 12 * 3600e3 && !done[key]) { done[key] = Date.now(); changed = true;
      const when = e.remind === "day" ? "내일" : e.remind === "hour" ? "1시간 뒤" : "오늘";
      notify(e.title, when + (e.time ? " " + e.time : "") + " · " + A.catOf(e.cat)[1], { line: when + " " + e.title + " 일정이 있어요. 확인해 볼까요?", view: "events" }); }
  });
  if (S.settings.annivNotify !== false && now.getHours() >= 9) {
    A.upcoming(S, now).filter((x) => x.n.days === 0).forEach((x) => { const key = "a|" + x.a.id + "|" + A.ymd(now);
      if (!done[key]) { done[key] = Date.now(); changed = true; notify(A.whoName(S, x.a.who) + " · " + x.a.title, "오늘이에요! " + (x.n.label !== x.a.title ? x.n.label : ""), null); } });
  }
  const cut = Date.now() - 40 * 864e5; for (const k in done) if (done[k] < cut) { delete done[k]; changed = true; }
  if (changed) persist();
}
setInterval(checkReminders, 30000);

/* ---------- 관리 창 ---------- */
let miniMode = false;
function showManager() {
  if (manager && !manager.isDestroyed()) { if (manager.isMinimized()) manager.restore(); manager.show(); manager.focus(); return; }
  const mb = onScreen(S.settings.mb) || { width: 1060, height: 740 };
  manager = new BrowserWindow({
    ...mb, minWidth: 260, minHeight: 240, title: "기념일 D-day", frame: false, autoHideMenuBar: true, backgroundColor: nativeTheme.shouldUseDarkColors ? "#14181d" : "#f6f8fb",
    icon: path.join(__dirname, "icon.png"),
    webPreferences: PREFS(),
  });
  manager.setMenu(null); guard(manager);
  manager.webContents.on("did-finish-load", () => { if (updInfo && updInfo.newer) manager.webContents.send("update", updInfo); });
  // 위젯(작은 창)일 때는 두 번 누르거나 화면 위로 끌어도 커지지 않게
  miniMode = mb.width < 560; if (miniMode) manager.setMaximizable(false);
  manager.on("maximize", () => { if (miniMode) manager.unmaximize(); });
  manager.on("resize", () => { if (!manager.isMaximized()) { miniMode = manager.getBounds().width < 560; manager.setMaximizable(!miniMode); } });
  const keep = () => { if (!manager.isMaximized() && !manager.isMinimized()) { S.settings.mb = manager.getBounds(); persist(); } };
  manager.on("resize", keep); manager.on("move", keep);
  manager.loadFile(path.join(__dirname, "manager.html"));
  manager.on("close", (e) => { if (!quitting) { e.preventDefault(); manager.hide(); } });
}
ipcMain.handle("state:get", () => S);
ipcMain.on("state:set", (_e, s) => {
  const ss = s.settings || {};
  S = Object.assign({}, S, s, { settings: Object.assign({}, S.settings, typeof ss.launchAtLogin === "boolean" ? { launchAtLogin: ss.launchAtLogin } : {}) });
  persist(); syncPets(); applyLogin(); updateTray(); checkReminders();
});
ipcMain.on("settings:set", (_e, k, v) => {
  if (k === "pinned") return setPinned(v);
  S.settings[k] = v; persist();
  if (["allHidden", "clickThrough", "mute", "volume", "voiceVol", "main", "annivSwap", "annivLead"].includes(k)) syncPets();
  if (k === "annivNotify") checkReminders();
  if (k === "launchAtLogin") applyLogin();
  if (k === "theme") applyTheme();
  updateTray();
});
ipcMain.on("win", (_e, a) => {
  if (!manager) return;
  if (a === "min") manager.minimize();
  if (a === "max") manager.isMaximized() ? manager.unmaximize() : manager.maximize();
  if (a === "close") manager.close();
  if (a === "compact") {
    const b = manager.getBounds(); if (b.width >= 560) S.settings.mbFull = b;
    if (manager.isMaximized()) manager.unmaximize();
    manager.setBounds({ x: b.x + b.width - 340, y: b.y, width: 340, height: 470 });
    manager.setAlwaysOnTop(!!S.settings.miniPin); miniMode = true; manager.setMaximizable(false); persist();
  }
  if (a === "expand") {
    manager.setAlwaysOnTop(false); miniMode = false; manager.setMaximizable(true);
    const f = onScreen(S.settings.mbFull) || { width: 1060, height: 740 };
    if (f.x == null) { manager.setSize(f.width, f.height); manager.center(); } else manager.setBounds(f);
  }
  if (a === "pin") { S.settings.miniPin = !S.settings.miniPin; manager.setAlwaysOnTop(S.settings.miniPin && manager.getBounds().width < 560); persist(); }
});
ipcMain.handle("app:version", () => app.getVersion());
ipcMain.on("folder:open", () => shell.openPath(app.getPath("userData")));
ipcMain.handle("file:save", async (_e, name, text) => {
  const share = /\.dday$/.test(name), chr = /\.ddchar$/.test(name);
  const r = await dialog.showSaveDialog(manager, { defaultPath: name, filters: [share ? { name: "일정 공유 파일", extensions: ["dday"] } : chr ? { name: "캐릭터 파일", extensions: ["ddchar"] } : { name: "JSON", extensions: ["json"] }] });
  if (r.canceled || !r.filePath) return false;
  fs.writeFileSync(r.filePath, /dday-backup/.test(name) || share || chr ? inlineImages(text) : text, "utf8"); return true;
});
function applyTheme() {
  const v = S.settings.theme; nativeTheme.themeSource = v === "light" || v === "dark" ? v : "system";
  if (manager && !manager.isDestroyed()) manager.setBackgroundColor(nativeTheme.shouldUseDarkColors ? "#14181d" : "#f6f8fb");
}
function applyLogin() {
  try { app.setLoginItemSettings({ openAtLogin: S.settings.launchAtLogin !== false, args: ["--hidden"] }); } catch (e) {}
}

/* ---------- 트레이 ---------- */
function setPinned(v) {
  S.settings.pinned = !!v; persist(); pushToManager();
  if (pet) { if (v) pet.setAlwaysOnTop(true, "floating"); else pet.setAlwaysOnTop(false); }
  updateTray();
}
function updateTray() {
  if (!tray) return;
  try {
    const up = A.upcoming(S).filter((x) => x.n.days >= 0)[0];
    tray.setToolTip("기념일 D-day" + (up ? " · " + A.whoName(S, up.a.who) + " " + up.a.title + " " + A.ddayText(up.n) : ""));
  } catch (e) {}
  tray.setContextMenu(Menu.buildFromTemplate([
    ...(updInfo && updInfo.newer ? [{ label: "✦ 새 버전 " + updInfo.ver + " 받기", click: () => shell.openExternal(updInfo.url) }, { type: "separator" }] : []),
    { label: "관리 창 열기", click: showManager },
    { label: S.settings.allHidden ? "캐릭터 다시 꺼내기" : "잠깐 다 숨기기", click: () => { S.settings.allHidden = !S.settings.allHidden; persist(); syncPets(); pushToManager(); } },
    { label: "다른 창보다 위에", type: "checkbox", checked: S.settings.pinned !== false, click: (i) => setPinned(i.checked) },
    { type: "separator" },
    { label: "컴퓨터 켜면 같이 시작", type: "checkbox", checked: S.settings.launchAtLogin !== false, click: (i) => { S.settings.launchAtLogin = i.checked; persist(); applyLogin(); updateTray(); pushToManager(); } },
    { type: "separator" },
    { label: "종료", click: () => { quitting = true; app.quit(); } },
  ]));
}

app.on("second-instance", (_e, _argv, _cwd, data) => {
  // 새 버전을 켰는데 예전 버전이 트레이에 떠 있으면: 예전 것은 끄고 새 버전으로 다시 켬
  const newer = (a, b) => { const x = String(a || "0").split(".").map(Number), y = String(b || "0").split(".").map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
  if (data && data.version && data.exec && newer(data.version, app.getVersion())) { persist(true); quitting = true; app.relaunch({ execPath: data.exec, args: [] }); app.exit(0); return; }
  showManager();
});
app.whenReady().then(() => {
  if (process.platform === "win32") app.setAppUserModelId("oc.atelier.dday");
  loadState();
  applyTheme();
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, "icon.png")).resize({ width: 16, height: 16 }));
  tray.setToolTip("기념일 D-day");
  tray.on("click", () => { if (S.settings.allHidden) { S.settings.allHidden = false; persist(); syncPets(); pushToManager(); } else showManager(); });
  updateTray();
  applyLogin();
  syncPets();
  let atLogin = process.argv.includes("--hidden");
  try { atLogin = atLogin || app.getLoginItemSettings().wasOpenedAtLogin; } catch (e) {}
  if (!atLogin) showManager();
  setTimeout(checkUpdate, 15000); setInterval(checkUpdate, 12 * 3600e3);
  setTimeout(checkReminders, 4000);
});
app.on("before-quit", () => { quitting = true; persist(true); });
app.on("window-all-closed", (e) => { /* 트레이에 남아 있기 */ });
