/* 숨은 창에서 도는 앱의 중심 (예전 Electron main.js를 옮긴 것)
   상태 저장 · 바탕화면 캐릭터 창 · 관리 창 · 트레이 · 알림 · 새 버전 확인 */
(function () {
  "use strict";
  window.addEventListener("error", function (e) { try { window.__TAURI__.core.invoke("log", { msg: (e.message || "") + " @" + (e.filename || "").split("/").pop() + ":" + e.lineno }); } catch (x) {} });
  window.addEventListener("unhandledrejection", function (e) { try { window.__TAURI__.core.invoke("log", { msg: "promise: " + (e.reason && (e.reason.message || e.reason)) }); } catch (x) {} });
  var T = window.__TAURI__, A = window.Annivs;
  var invoke = T.core.invoke, emit = T.event.emit, listen = T.event.listen;
  var WW = T.webviewWindow.WebviewWindow;
  var DPI = T.dpi || T.window, LPos = DPI.LogicalPosition, LSize = DPI.LogicalSize;

  var S = null, SEED = null, manager = null, tray = null, quitting = false, updInfo = null, monitors = [];
  var seedCopy = function () { return JSON.parse(JSON.stringify(SEED)); };

  /* ---------- 그림 주소: 저장은 file:///, 화면에는 asset 주소 ---------- */
  var ASSET_RE = /^(?:https?:\/\/asset\.localhost|asset:\/\/localhost)\//;
  function fileToView(u) { try { return T.core.convertFileSrc(decodeURIComponent(u.slice(8))); } catch (e) { return u; } }
  function viewToFile(u) {
    try { var p = decodeURIComponent(u.replace(ASSET_RE, "")); return "file:///" + encodeURI(p.replace(/\\/g, "/")); } catch (e) { return u; }
  }
  function toView(str) { return str.replace(/file:\/\/\/[^"\\]+/g, fileToView); }
  function toStore(str) { return str.replace(/(?:https?:\/\/asset\.localhost|asset:\/\/localhost)\/[^"\\]+/g, viewToFile); }
  function viewState() { return JSON.parse(toView(JSON.stringify(S))); }

  /* ---------- 창들과 주고받기 ---------- */
  function sendTo(label, type, data) { emit("to-" + label, { type: type, data: data }); }
  var handlers = {};
  listen("to-core", function (e) {
    var p = e.payload || {}, h = handlers[p.type]; if (!h) return;
    Promise.resolve().then(function () { return h.apply(null, (p.args || []).concat([p.from])); })
      .then(function (r) { if (p.id) emit("reply", { to: p.from, id: p.id, result: r === undefined ? null : r }); })
      .catch(function (err) { T.core.invoke("log", { msg: String([p.type, err].join(" ")) }).catch(function(){}); if (p.id) emit("reply", { to: p.from, id: p.id, result: null }); });
  });

  /* ---------- 저장 ---------- */
  function addSamples(s) {
    if (!(s.tokens || []).some(function (t) { return t.id === "t-bald"; })) return;
    var d = function (n) { var x = new Date(); x.setDate(x.getDate() + n); return x; };
    var ymd = function (x) { return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
    var meet = d(12), hund = d(-79), who = { type: "token", id: "t-bald" };
    s.annivs = (s.annivs || []).concat([
      { id: "a-smp1", sample: true, title: "처음 만난 날", who: who, y: meet.getFullYear() - 1, m: meet.getMonth() + 1, d: meet.getDate(), repeat: "yearly", count: "since", lines: ["우리 처음 만난 날이야! 기억하지?"], pin: true },
      { id: "a-smp2", sample: true, title: "함께한 날", who: who, y: hund.getFullYear(), m: hund.getMonth() + 1, d: hund.getDate(), repeat: "d100", count: "dday", lines: [] },
    ]);
    s.events = (s.events || []).concat([
      { id: "e-smp1", sample: true, title: "다이어리 꾸미기", date: ymd(d(2)), time: "", cat: "fan", who: who, memo: "이번 달 달력에 스티커 붙이기", remind: "morning" },
      { id: "e-smp2", sample: true, title: "TRPG 세션 1회차", date: ymd(d(6)), time: "20:00", cat: "trpg", who: who, memo: "캐릭터 시트 챙기기", remind: "hour" },
    ]);
  }
  function migrate() {
    var st = S.settings = S.settings || {};
    delete S.placeholderParts;
    // 그림 한 장 캐릭터는 반응 하나로
    (S.tokens || []).forEach(function (t) { if (t.kind === "img" && !(t.zones && t.zones.all)) { var z = t.zones || {}, f = z.face || {}, lines = [].concat((z.head || {}).lines || [], f.lines || [], (z.body || {}).lines || []);
      t.zones = Object.assign({}, z, { all: { motion: f.motion || "squash", fx: f.fx || "heart", sound: f.sound || "pop", bubble: f.bubble || "speech", lines: lines } }); } });
    S.tokens = S.tokens || []; S.pairs = S.pairs || []; S.annivs = S.annivs || []; S.events = S.events || []; S.diary = S.diary || {}; S.notes = S.notes || {};
    S.settings = st = Object.assign({ pinned: true, launchAtLogin: true, clickThrough: true, annivSwap: true, annivLead: 0 }, st);
    var M3 = { tok: "kalimba", pop: "xylo", bubble: "music", squeak: "sparkle", chime: "glass", pen: "pencil", page: "harp", stamp: "key", sticker: "wrap", bell: "glass" };
    if (!st.soundV4) { st.soundV4 = st.bubbleV2 = st.bubbleV3 = true; S.tokens.forEach(function (t) { Object.values(t.zones || {}).forEach(function (z) { if (!z) return; if (M3[z.sound]) z.sound = M3[z.sound]; if (z.bubble === "sign") z.bubble = "speech"; }); }); }
    if (!st.babbleSeed) { st.babbleSeed = true; S.tokens.forEach(function (t) { if (t.babble == null) t.babble = t.id === "t-bald" ? "round" : "mid"; }); }
    if (!st.voiceV2) { st.voiceV2 = true; S.tokens.forEach(function (t) { if (!t.babble || t.babble === "none") t.babble = "mid"; if (!t.voice || t.voice === "mix") t.voice = "none"; }); }
    if (!st.voiceV3) { st.voiceV3 = true; S.tokens.forEach(function (t) { if (t.voice === "none") t.voice = "mix"; }); }
    if (!st.main && S.tokens.length) st.main = S.tokens[0].id;
  }
  function loadState() {
    return Promise.all([fetch("seed.json").then(function (r) { return r.json(); }), invoke("read_state")]).then(function (r) {
      SEED = r[0];
      try { S = r[1] ? JSON.parse(r[1]) : null; } catch (e) { S = null; }
      if (!S) { S = seedCopy(); S.settings = Object.assign({}, S.settings, { main: "t-bald" }); addSamples(S); }
      migrate();
    });
  }
  var saveT = null;
  function persist(now) {
    clearTimeout(saveT);
    var w = function () { return invoke("write_state", { text: JSON.stringify(S) }).catch(function () {}); };
    if (now) return w(); saveT = setTimeout(w, 400);
  }
  function tok(id) { return S.tokens.filter(function (t) { return t.id === id; })[0]; }
  function pushToManager() { if (manager) sendTo("manager", "state", viewState()); }

  /* ---------- 화면 (모니터) ---------- */
  function refreshMonitors() {
    return T.window.availableMonitors().then(function (ms) {
      monitors = (ms || []).map(function (m) {
        var k = m.scaleFactor || 1, wa = m.workArea || { position: m.position, size: { width: m.size.width, height: m.size.height - 48 * k } };
        return { x: wa.position.x / k, y: wa.position.y / k, width: wa.size.width / k, height: wa.size.height / k, primary: false, k: k, name: m.name };
      });
      return T.window.primaryMonitor().then(function (p) { monitors.forEach(function (m) { if (p && m.name === p.name) m.primary = true; }); if (monitors.length && !monitors.some(function (m) { return m.primary; })) monitors[0].primary = true; });
    }).catch(function () { monitors = [{ x: 0, y: 0, width: 1920, height: 1032, primary: true, k: 1 }]; });
  }
  function primary() { return monitors.filter(function (m) { return m.primary; })[0] || monitors[0] || { x: 0, y: 0, width: 1920, height: 1032, k: 1 }; }
  function displayFor(b) {
    var cx = b.x + b.width / 2, cy = b.y + b.height / 2, best = null, bd = 1e12;
    monitors.forEach(function (m) { var dx = Math.max(m.x - cx, 0, cx - (m.x + m.width)), dy = Math.max(m.y - cy, 0, cy - (m.y + m.height)), d = dx * dx + dy * dy; if (d < bd) { bd = d; best = m; } });
    return best || primary();
  }
  function onScreen(b) {
    if (!b || b.x == null) return null;
    return monitors.some(function (a) { return b.x < a.x + a.width - 40 && b.x + b.width > a.x + 40 && b.y >= a.y - 10 && b.y < a.y + a.height - 40; }) ? b : null;
  }
  function boundsOf(w) {
    return Promise.all([w.outerPosition(), w.outerSize(), w.scaleFactor()]).then(function (r) { var k = r[2] || 1; return { x: Math.round(r[0].x / k), y: Math.round(r[0].y / k), width: Math.round(r[1].width / k), height: Math.round(r[1].height / k) }; });
  }
  function setBounds(w, b) { return Promise.all([w.setSize(new LSize(b.width, b.height)), w.setPosition(new LPos(b.x, b.y))]); }

  /* ---------- 바탕화면 캐릭터 (한 명, 페어를 같이 띄우면 두 명) ---------- */
  var PAD_X = 100, PAD_TOP = 190, lastDay = "";
  var LABELS = ["pet", "pet2", "pet3", "pet4", "pet5"], FOOT = { pet: "foot", pet2: "foot2", pet3: "foot3", pet4: "foot4", pet5: "foot5" };
  var P = {}; LABELS.forEach(function (l) { P[l] = { win: null, pick: null, size: null, opening: false }; });
  var pet = null; // 첫 번째 창 (알림 말풍선용)
  function petBounds(t) {
    var size = (t.desk && t.desk.size) || 160, up = Math.max(0, ((t.bubblePos && t.bubblePos.y) || 0) / 100 * size);
    return { width: size + PAD_X * 2, height: Math.round(size + PAD_TOP + 8 + up), size: size };
  }
  function defaultPos(t) { var wa = primary(), b = petBounds(t); return { x: wa.x + wa.width - b.width - 30, y: wa.y + wa.height - b.height - 10 }; }
  function keepOnScreen(x, y, w, h) {
    var d = displayFor({ x: x, y: y, width: w, height: h });
    return { x: Math.min(Math.max(x, d.x - w + 60), d.x + d.width - 60), y: Math.min(Math.max(y, d.y - PAD_TOP), d.y + d.height - h + 10) };
  }
  function boundsAtFoot(t, label) {
    var b = petBounds(t), f = S.settings[FOOT[label]], x, y;
    var li = LABELS.indexOf(label);
    if (li > 0 && !(f && typeof f.x === "number")) {
      // 두 번째부터는 앞 사람 왼쪽 옆에 나란히
      var prev = LABELS[li - 1], tp = P[prev].pick && tok(P[prev].pick.id), bp = tp ? petBounds(tp) : b;
      var fp = S.settings[FOOT[prev]], base = tp ? (fp && typeof fp.x === "number" ? fp : null) : null;
      if (!base) { var bb = tp ? boundsAtFoot(tp, prev) : null; base = bb ? { x: bb.x + bb.width / 2, y: bb.y + bb.height } : { x: defaultPos(t).x + b.width / 2, y: defaultPos(t).y + b.height }; }
      f = { x: base.x - (bp.size + b.size) / 2 - 16, y: base.y };
    }
    if (f && typeof f.x === "number") { x = Math.round(f.x - b.width / 2); y = Math.round(f.y - b.height); }
    else { var p = defaultPos(t); x = p.x; y = p.y; }
    var k = keepOnScreen(x, y, b.width, b.height);
    return { x: Math.round(k.x), y: Math.round(k.y), width: b.width, height: b.height };
  }
  function saveFoot(label) { var w = P[label] && P[label].win; if (!w) return; boundsOf(w).then(function (b) { S.settings[FOOT[label]] = { x: b.x + b.width / 2, y: b.y + b.height }; persist(); }); }
  function petData(label) {
    var pick = P[label] && P[label].pick;
    if (!pick) return null;
    var t = tok(pick.id); if (!t) return null;
    var st = S.settings, extra = { clickThrough: st.clickThrough !== false, mute: !!st.mute, volume: typeof st.volume === "number" ? st.volume : 0.5, voiceVol: typeof st.voiceVol === "number" ? st.voiceVol : 0.6, day: A.ymd(new Date()), duo: !!(P.pet.pick && P.pet2.pick) };
    if (pick.anniv) { var a = pick.anniv, n = pick.n; extra.anniv = { id: a.id, title: a.title, label: n.label, days: n.days, lines: (a.lines || []).filter(Boolean), def: A.defaultLine(S, a, n) }; }
    if (pick.event) extra.event = { id: pick.event.id, title: pick.event.title, time: pick.event.time || "" };
    extra.today = label === "pet" ? A.on(S, A.ymd(new Date())).events.map(function (e) { return { title: e.title, time: e.time || "" }; }) : [];
    extra.soon = A.upcoming(S).filter(function (x) { return x.n.days > 0 && x.n.days <= 14 && A.involves(S, x.a, t.id); }).slice(0, 3).map(function (x) { return { title: x.a.title, days: x.n.days }; });
    return JSON.parse(toView(JSON.stringify(Object.assign({}, t, { _cfg: extra }))));
  }
  function openPet(label, t) {
    var o = P[label]; if (o.opening) return; o.opening = true;
    var b = boundsAtFoot(t, label); o.size = b;
    var w = o.win = new WW(label, {
      url: "pet.html", x: b.x, y: b.y, width: b.width, height: b.height, transparent: true, decorations: false, resizable: false, maximizable: false, minimizable: false,
      skipTaskbar: true, shadow: false, alwaysOnTop: S.settings.pinned !== false, focus: false, visible: true, title: "기념일 D-day 캐릭터",
    });
    if (label === "pet") pet = w;
    w.once("tauri://created", function () { o.opening = false; });
    w.once("tauri://error", function (e) { T.core.invoke("log", { msg: "pet error " + JSON.stringify(e) }).catch(function () {}); o.opening = false; o.win = null; if (label === "pet") pet = null; });
    w.once("tauri://destroyed", function () { if (o.win === w) o.win = null; if (pet === w) pet = null; });
  }
  function closePet(label) { var o = P[label]; if (o.win) { o.win.destroy().catch(function () {}); o.win = null; } if (label === "pet") pet = null; o.size = null; }
  /* 같이 띄우는 페어 (2명 이상 묶인 페어만) */
  function duoPair() {
    var id = S.settings.duo; if (!id) return null;
    var p = (S.pairs || []).filter(function (x) { return x.id === id; })[0]; if (!p) return null;
    var ids = (p.tokenIds || []).filter(function (x) { return tok(x); }).slice(0, 5);
    return ids.length >= 2 ? { p: p, ids: ids } : null;
  }
  function picks() {
    var out = LABELS.map(function () { return null; });
    if (S.settings.allHidden) return out;
    var one = A.pick(S); if (!one) return out;
    var d = duoPair(); out[0] = one; if (!d) return out;
    var list;
    if (d.ids.indexOf(one.id) >= 0) list = [one].concat(d.ids.filter(function (x) { return x !== one.id; }).map(function (x) { return { id: x, reason: "duo" }; }));
    else if (one.reason === "main") list = d.ids.map(function (x) { return { id: x, reason: "duo" }; });
    else return out;
    list.forEach(function (x, i) { out[i] = x; });
    return out;
  }
  function syncPets() {
    var pk = picks();
    LABELS.forEach(function (label, i) {
      var o = P[label]; o.pick = pk[i];
      var t = o.pick && tok(o.pick.id);
      if (!t) { closePet(label); return; }
      if (!o.win) openPet(label, t);
      else {
        var b = petBounds(t);
        if (!o.size || o.size.width !== b.width || o.size.height !== b.height) {
          boundsOf(o.win).then(function (cur) { var fx = cur.x + cur.width / 2, fy = cur.y + cur.height; o.size = { width: b.width, height: b.height }; setBounds(o.win, { x: Math.round(fx - b.width / 2), y: Math.round(fy - b.height), width: b.width, height: b.height }); });
        }
        sendTo(label, "pet:token", petData(label));
      }
    });
    updateTray();
  }
  setInterval(function () { if (!S) return; var d = A.ymd(new Date()); if (d !== lastDay) { lastDay = d; syncPets(); pushToManager(); } }, 30000);

  /* ---------- 둘이 나누는 대화 ---------- */
  var DEF_DIALOGS = [[[0, "오늘 뭐 했어?"], [1, "너 기다렸지!"]], [[0, "배고프지 않아?"], [1, "방금 그 말 기다렸어"]], [[1, "나 오늘 좀 멋있지?"], [0, "...응, 쪼끔"]], [[0, "{B}!"], [1, "왜~"], [0, "그냥 불러 봤어"]], [[1, "졸려..."], [0, "조금만 더 버티자"]], [[0, "여기 화면 넓다"], [1, "같이 있으니까 좁은데?"]], [[0, "두근두근", "sfx"], [1, "무슨 소리야?"], [0, "아, 아무것도 아니야!"]], [[1, "우리 산책 갈래?"], [0, "바탕화면 밖으로는 못 나가잖아"], [1, "그럼 여기서 한 바퀴!"]], [[0, "오늘 날씨 어때?"], [1, "너랑 있어서 맑음"]], [[1, "쾅!", "sfx"], [0, "깜짝이야!", "shout"], [1, "헤헤 놀랐지"]], [[0, "일 열심히 하네"], [1, "우리도 응원하자"], [0, "화이팅!"]], [[1, "심심해~"], [0, "그럼 나랑 놀자"]]];
  function nameOf(id) { var t = tok(id); return t ? (t.nick || t.name || "") : ""; }
  var PREFIX = { sfx: "*", shout: "!", thought: "(" };
  function line(w, t, sty, nA, nB, m) { t = String(t || "").replace(/\{A\}/g, nA).replace(/\{B\}/g, nB).trim(); if (!t) return null; return { w: w || 0, t: PREFIX[sty] ? PREFIX[sty] + t + (sty === "thought" ? ")" : "") : t, m: m || "" }; }
  /* 예전 글자 방식(이름: 대사) */
  function parseTalks(text, ids, nA, nB) {
    var names = ids.map(function (id) { var t = tok(id) || {}; return [t.nick || "", t.name || ""]; });
    return String(text || "").replace(/\r/g, "").split(/\n\s*\n/).map(function (block) {
      var next = 0;
      return block.split("\n").map(function (ln) {
        ln = ln.trim(); if (!ln) return null;
        var m = /^([^:：]{1,16})[:：]\s*(.*)$/.exec(ln), w = null, txt = ln;
        if (m) { var k = m[1].trim(); if (/^(\{A\}|A|1)$/i.test(k) || names[0].indexOf(k) >= 0) w = 0; else if (/^(\{B\}|B|2)$/i.test(k) || names[1].indexOf(k) >= 0) w = 1; if (w != null) txt = m[2]; }
        if (w == null) w = next; next = 1 - w;
        return line(w, txt, "", nA, nB);
      }).filter(Boolean);
    }).filter(function (c) { return c.length; });
  }
  function talksFor(d) {
    var nA = nameOf(d.ids[0]), nB = nameOf(d.ids[1]), list;
    var conv = function (c) { return c.map(function (l) { return Array.isArray(l) ? line(l[0], l[1], l[2], nA, nB) : line(l.w, l.t, l.s, nA, nB, l.m); }).filter(function (l) { return l && l.w < d.ids.length; }); };
    if (Array.isArray(d.p.dialogs) && d.p.dialogs.length) list = d.p.dialogs.map(conv);
    else if (d.p.talks && d.p.talks.trim()) list = parseTalks(d.p.talks, d.ids, nA, nB);
    else list = DEF_DIALOGS.map(conv);
    list = list.filter(function (c) { return c.length; });
    var base = list.length;
    try {
      A.upcoming(S).filter(function (x) { return x.n.days >= 0 && x.n.days <= 14 && x.a.who && x.a.who.type === "pair" && x.a.who.id === d.p.id; }).slice(0, 1).forEach(function (x) {
        var tt = x.n.label && x.n.label !== x.a.title ? x.a.title + " " + x.n.label : x.a.title;
        var c = x.n.days === 0 ? [{ w: 0, t: "오늘 " + tt + "이야!" }, { w: 1, t: "알아, 기억하고 있었어" }] : [{ w: 0, t: tt + "까지 " + x.n.days + "일 남았대" }, { w: 1, t: "벌써? 뭐 준비하지..." }];
        list.push(c, c);
      });
    } catch (e) {}
    list.base = base;
    return list;
  }
  var talking = false, lastTalk = -1, talkGen = 0, waitLine = {};
  handlers["pet:lineDone"] = function (g, k) { var f = waitLine[g + "|" + k]; if (f) f(); };
  /* 지금 떠 있는 친구들: 캐릭터 id → 창 이름 */
  function shown() { var m = {}; LABELS.forEach(function (l) { if (P[l].win && P[l].pick) m[P[l].pick.id] = l; }); return m; }
  function posAll() {
    var m = shown(), ls = Object.keys(m).map(function (id) { return m[id]; });
    return Promise.all(ls.map(function (l) { return boundsOf(P[l].win).then(function (b) { return [l, b.x + b.width / 2]; }).catch(function () { return [l, 0]; }); })).then(function (r) { var o = {}; r.forEach(function (x) { o[x[0]] = x[1]; }); return o; });
  }
  /* 다가가기: 말하는 친구 창을 옆 친구 쪽으로 살짝 갔다가 돌아와요 */
  function approach(label, toward) {
    var w = P[label].win; if (!w) return;
    boundsOf(w).then(function (b) {
      var x0 = b.x, dist = 26 * (toward >= 0 ? 1 : -1), t0 = Date.now();
      var iv = setInterval(function () {
        var t = (Date.now() - t0) / 700; if (t >= 1) { clearInterval(iv); w.setPosition(new LPos(x0, b.y)).catch(function () {}); return; }
        var e = Math.sin(t * Math.PI); w.setPosition(new LPos(Math.round(x0 + dist * e), b.y)).catch(function () {});
      }, 30);
    });
  }
  function playTalk(only) {
    var d = duoPair(), lab = shown();
    if (!d || Object.keys(lab).length < 2) return false;
    if (talking && only == null) return false;
    var list = talksFor(d).map(function (c) { return c.filter(function (l) { return lab[d.ids[l.w]]; }); }).filter(function (c) { return c.length; });
    var base = list.length; if (!list.length) return false;
    var i = Math.floor(Math.random() * list.length); if (list.length > 1 && i === lastTalk) i = (i + 1) % list.length;
    if (only != null && only < base) i = only; lastTalk = i;
    talkGen++; var gen = talkGen;
    var conv = list[i];
    talking = true;
    posAll().then(function (px) {
      var step = function (k) {
        if (gen !== talkGen) return;
        if (k >= conv.length) { talking = false; Object.keys(px).forEach(function (l) { sendTo(l, "pet:act", { lean: 0 }); }); return; }
        var ln = conv[k], label = lab[d.ids[ln.w]], ms = Math.min(4200, Math.max(1700, 900 + ln.t.length * 90));
        if (!label || !P[label].win) { step(k + 1); return; }
        // 듣는 친구들은 말하는 쪽으로 몸을 살짝 기울여요
        Object.keys(px).forEach(function (l) { if (l !== label) sendTo(l, "pet:act", { lean: px[label] > px[l] ? 1 : -1, hold: ms + 600 }); });
        var others = Object.keys(px).filter(function (l) { return l !== label; }), near = others.sort(function (p1, p2) { return Math.abs(px[p1] - px[label]) - Math.abs(px[p2] - px[label]); })[0];
        var mo = ln.m === "approach" ? "hop" : ln.m;
        // 다음 줄은 말한 친구 창이 "다 말했어"라고 알려 줄 때 넘어가요 (숨은 창 타이머는 윈도우에서 느려질 수 있어서)
        var moved = false, go = function () { if (moved) return; moved = true; delete waitLine[gen + "|" + k]; step(k + 1); };
        waitLine[gen + "|" + k] = go;
        sendTo(label, "pet:line", { text: ln.t, ms: ms, quiet: d.p.duoVoice === false, motion: mo, g: gen, k: k, ap: ln.m === "approach" && near ? (px[near] - px[label] >= 0 ? 1 : -1) : 0 });
        setTimeout(go, ms + 4000);
      };
      step(0);
    });
    return true;
  }
  // 가끔 저절로 (평균 2~3분에 한 번)
  setInterval(function () { var d = S && duoPair(); if (d && !S.settings.allHidden && d.p.duoAuto !== false && Math.random() < 0.12) playTalk(); }, 20000);
  /* 누르면 · 쓰다듬으면 옆 친구들도 반응 */
  function friendsReact(from, kind) {
    var d = duoPair(), lab = shown(); if (!d || Object.keys(lab).length < 2) return;
    posAll().then(function (px) {
      Object.keys(px).forEach(function (l) {
        if (l === from || Math.random() > (kind === "pet" ? 0.6 : 0.35)) return;
        var dir = px[from] > px[l] ? 1 : -1;
        setTimeout(function () {
          sendTo(l, "pet:act", kind === "pet" ? { lean: dir, hold: 1800, motion: Math.random() < .5 ? "shy" : "surprise", fx: Math.random() < .5 ? "sweat" : "q", side: dir } : { lean: dir, hold: 1500, motion: "hop", fx: "heart", side: dir });
        }, 250 + Math.random() * 400);
      });
    });
  }
  handlers["pet:tap"] = function (from) { var d = duoPair(); if (!d) return; friendsReact(from || "pet", "tap"); if (d.p.duoAuto !== false && Math.random() < 0.3) setTimeout(playTalk, 1700); };
  handlers["pet:petted"] = function (from) { if (duoPair()) friendsReact(from || "pet", "pet"); };

  handlers["pet:token"] = function (from) { return petData(from || "pet"); };
  handlers["pet:dragend"] = function (from) { saveFoot(from || "pet"); };
  handlers["pet:open"] = function (v) { showManager().then(function () { setTimeout(function () { sendTo("manager", "nav", v); }, 350); }); };
  handlers["pet:menu"] = function (from) {
    var label = from || "pet", o = P[label]; if (!o || !o.win || !o.pick) return; var t = tok(o.pick.id); if (!t) return;
    t.desk = Object.assign({ size: 160 }, t.desk || {});
    var size = t.desk.size || 160, d = duoPair();
    var redo = function () { persist(); syncPets(); pushToManager(); };
    var M = T.menu.Menu, items = [
      { text: (t.nick || t.name) + " 쓰다듬기", action: function () { sendTo(label, "pet:poke"); } },
    ];
    if (d && Object.keys(shown()).length > 1) items.push({ text: "같이 이야기하기", action: function () { playTalk(); } });
    items.push(
      { text: "관리 창에서 고치기", action: function () { showManager().then(function () { setTimeout(function () { sendTo("manager", "edit", t.id); }, 300); }); } },
      { text: label !== "pet" ? "같이 나온 친구 바꾸기 (페어 화면에서)" : "다른 캐릭터로 바꾸기", items: label !== "pet" ? [{ text: "페어 화면 열기", action: function () { showManager().then(function () { setTimeout(function () { sendTo("manager", "nav", "pair"); }, 300); }); } }] : S.tokens.map(function (x) { return { text: (x.nick || x.name || "이름 없음") + (x.id === S.settings.main ? "  (기본)" : ""), checked: x.id === o.pick.id, action: function () { S.settings.main = x.id; redo(); } }; }) }
    );
    if (o.pick.anniv) items.push({ text: "오늘: " + o.pick.anniv.title + " (" + A.ddayText(o.pick.n) + ")", enabled: false });
    if (o.pick.event) items.push({ text: "오늘 일정: " + o.pick.event.title + (o.pick.event.time ? " " + o.pick.event.time : ""), enabled: false });
    items.push(
      { item: "Separator" },
      { text: "크기", items: [[120, "120px"], [160, "160px (기본)"], [240, "240px"], [320, "320px"]].map(function (x) { return { text: x[1], checked: size === x[0], action: function () { t.desk.size = x[0]; redo(); } }; }) },
      { text: label !== "pet" ? "옆자리로 돌려보내기" : "오른쪽 아래로 돌려보내기", action: function () { S.settings[FOOT[label]] = null; if (label === "pet") LABELS.forEach(function (l) { if (l !== "pet") S.settings[FOOT[l]] = null; }); LABELS.forEach(function (l) { var oo = P[l], tt = oo.pick && tok(oo.pick.id); if (oo.win && tt && (l === label || label === "pet")) setBounds(oo.win, boundsAtFoot(tt, l)).then(function () { saveFoot(l); }); }); } },
      { text: "위치 잠금", checked: !!t.desk.lock, action: function () { t.desk.lock = !t.desk.lock; redo(); } },
      { text: "좌우 반전", checked: !!t.desk.flip, action: function () { t.desk.flip = !t.desk.flip; redo(); } }
    );
    if (d) items.push({ text: "페어 같이 띄우기 끄기", action: function () { S.settings.duo = ""; redo(); } });
    items.push(
      { item: "Separator" },
      { text: "관리 창 열기", action: function () { showManager(); } },
      { text: "잠깐 숨기기", action: function () { S.settings.allHidden = true; redo(); } },
      { text: "종료", action: quit }
    );
    return M.new({ items: items }).then(function (m) { return m.popup(undefined, o.win); });
  };

  /* ---------- 그림 · 소리 파일 ---------- */
  function saveBlob(kind, dataUrl, re, extOf) {
    var m = re.exec(dataUrl || ""); if (!m) return Promise.resolve(null);
    return invoke("save_blob", { kind: kind, b64: m[2], ext: extOf(m[1]) }).then(function (p) { return p ? T.core.convertFileSrc(p.replace(/\\/g, "/")) : null; });
  }
  handlers["img:save"] = function (d) { return saveBlob("images", d, /^data:image\/(png|jpeg|webp|gif);base64,(.+)$/, function (x) { return x === "jpeg" ? "jpg" : x; }); };
  handlers["snd:save"] = function (d) { return saveBlob("sounds", d, /^data:audio\/([a-z0-9.+-]+);base64,(.+)$/, function (x) { return ({ mpeg: "mp3", mp3: "mp3", wav: "wav", "x-wav": "wav", ogg: "ogg", webm: "webm", mp4: "m4a", "x-m4a": "m4a", aac: "aac" })[x] || "bin"; }); };
  var MIME = { png: "image/png", jpg: "image/jpeg", webp: "image/webp", gif: "image/gif", mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", m4a: "audio/mp4", webm: "audio/webm", aac: "audio/aac" };
  function inlineFiles(text) {
    var re = /(?:file:\/\/\/|https?:\/\/asset\.localhost\/|asset:\/\/localhost\/)[^"\\]+?\.(png|jpg|webp|gif|mp3|wav|ogg|m4a|webm|aac)/g, found = {}, m;
    while ((m = re.exec(text))) found[m[0]] = m[1];
    var keys = Object.keys(found);
    return Promise.all(keys.map(function (u) {
      var p = u.indexOf("file:///") === 0 ? decodeURIComponent(u.slice(8)) : decodeURIComponent(u.replace(ASSET_RE, ""));
      return invoke("read_b64", { path: p }).then(function (b) { return b ? "data:" + MIME[found[u]] + ";base64," + b : u; }).catch(function () { return u; });
    })).then(function (vals) { keys.forEach(function (k, i) { text = text.split(k).join(vals[i]); }); return text; });
  }
  handlers["file:save"] = function (name, text) {
    var share = /\.dday$/.test(name), chr = /\.ddchar$/.test(name);
    var f = share ? ["일정 공유 파일", "dday"] : chr ? ["캐릭터 파일", "ddchar"] : ["JSON", "json"];
    var ready = /dday-backup/.test(name) || share || chr ? inlineFiles(text) : Promise.resolve(toStore(text));
    return ready.then(function (t) { return invoke("save_file", { name: name, filter: f[0], ext: f[1], text: t }); });
  };

  /* ---------- 새 버전 확인 ---------- */
  var myBuild = 0;
  fetch("build.json").then(function (r) { return r.json(); }).then(function (d) { myBuild = d.build || 0; }).catch(function () {});
  function checkUpdate() {
    var cur = myBuild;
    return fetch("https://api.github.com/repos/Tsuyu-0/dday-app/releases/latest", { headers: { Accept: "application/vnd.github+json" } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        var m = /(\d+)$/.exec(d.tag_name || ""), latest = m ? +m[1] : 0, asset = (d.assets || []).filter(function (a) { return (/Mac/i.test(navigator.platform || navigator.userAgent) ? /\.dmg$/ : /Setup\.exe$/).test(a.name); })[0];
        updInfo = { newer: !!cur && latest > cur, ver: (d.tag_name || "").replace(/^v/, ""), cur: cur ? "1.0." + cur : "", url: (asset && asset.browser_download_url) || d.html_url, page: d.html_url };
      }).catch(function () { updInfo = { err: true, cur: cur ? "1.0." + cur : "" }; })
      .then(function () { if (updInfo.newer) { sendTo("manager", "update", updInfo); S.settings.updSeen = updInfo.ver; updateTray(); } return updInfo; });
  }
  handlers["upd:check"] = checkUpdate;
  handlers["open:url"] = function (u) { return invoke("open_url", { url: String(u) }); };

  /* ---------- 알림 ---------- */
  function notify(title, body, line) {
    invoke("notify", { title: title, body: body }).catch(function () {});
    if (pet && line) sendTo("pet", "pet:say", typeof line === "object" ? line : { line: line, view: "events" });
  }
  function eventTime(e) { var d = A.parseYmd(e.date); if (!d) return null; var hm = (e.time || "09:00").split(":").map(Number); d.setHours(hm[0] || 0, hm[1] || 0, 0, 0); return d; }
  function checkReminders() {
    if (!S) return; var now = new Date(), done = S.settings.notified || (S.settings.notified = {}), changed = false;
    (S.events || []).forEach(function (e) {
      if (!e.remind || e.remind === "none") return; var t = eventTime(e); if (!t) return;
      var at = new Date(t); if (e.remind === "hour") at.setHours(at.getHours() - 1); else if (e.remind === "day") at.setDate(at.getDate() - 1); else if (e.remind === "morning") at.setHours(9, 0, 0, 0);
      var key = e.id + "|" + e.remind + "|" + e.date + "|" + (e.time || "");
      if (now >= at && now - at < 12 * 3600e3 && !done[key]) { done[key] = Date.now(); changed = true;
        var when = e.remind === "day" ? "내일" : e.remind === "hour" ? "1시간 뒤" : "오늘";
        notify(e.title, when + (e.time ? " " + e.time : "") + " · " + A.catOf(e.cat)[1], { line: when + " " + e.title + " 일정이 있어요. 확인해 볼까요?", view: "events" }); }
    });
    if (S.settings.annivNotify !== false && now.getHours() >= 9) {
      A.upcoming(S, now).filter(function (x) { return x.n.days === 0; }).forEach(function (x) { var key = "a|" + x.a.id + "|" + A.ymd(now);
        if (!done[key]) { done[key] = Date.now(); changed = true; notify(A.whoName(S, x.a.who) + " · " + x.a.title, "오늘이에요! " + (x.n.label !== x.a.title ? x.n.label : ""), null); } });
    }
    var cut = Date.now() - 40 * 864e5; for (var k in done) if (done[k] < cut) { delete done[k]; changed = true; }
    if (changed) persist();
  }
  setInterval(checkReminders, 30000);

  /* ---------- 관리 창 ---------- */
  var miniMode = false, keepT = null;
  function showManager() {
    if (manager) { return manager.unminimize().catch(function () {}).then(function () { return manager.show(); }).then(function () { return manager.setFocus(); }).catch(function () {}); }
    return new Promise(function (res) {
      var mb = onScreen(S.settings.mb) || { width: 1060, height: 740 };
      var opt = { url: "manager.html", title: "기념일 D-day", width: mb.width, height: mb.height, minWidth: 260, minHeight: 240, decorations: false, visible: true, focus: true };
      if (mb.x != null) { opt.x = mb.x; opt.y = mb.y; } else opt.center = true;
      manager = new WW("manager", opt);
      miniMode = mb.width < 560;
      manager.once("tauri://created", function () {
        applyTheme();
        if (miniMode) manager.setMaximizable(false).catch(function () {});
        var keep = function () {
          clearTimeout(keepT);
          keepT = setTimeout(function () {
            Promise.all([manager.isMaximized(), manager.isMinimized(), boundsOf(manager)]).then(function (r) {
              if (r[0] && miniMode) { manager.unmaximize(); return; }
              if (!r[0] && !r[1]) { miniMode = r[2].width < 560; manager.setMaximizable(!miniMode).catch(function () {}); S.settings.mb = r[2]; persist(); }
            }).catch(function () {});
          }, 250);
        };
        manager.onResized(keep); manager.onMoved(keep);
        res();
      });
      manager.once("tauri://error", function (e) { T.core.invoke("log", { msg: String(["manager", e].join(" ")) }).catch(function(){}); manager = null; res(); });
      manager.once("tauri://destroyed", function () { manager = null; });
    });
  }
  handlers["state:get"] = function () { return viewState(); };
  handlers["state:set"] = function (s) {
    s = JSON.parse(toStore(JSON.stringify(s)));
    var ss = s.settings || {};
    S = Object.assign({}, S, s, { settings: Object.assign({}, S.settings, typeof ss.launchAtLogin === "boolean" ? { launchAtLogin: ss.launchAtLogin } : {}) });
    persist(); syncPets(); applyLogin(); updateTray(); checkReminders();
  };
  handlers["settings:set"] = function (k, v) {
    if (k === "pinned") return setPinned(v);
    S.settings[k] = v; persist();
    if (k === "talkNow") { playTalk(v && typeof v === "object" && typeof v.i === "number" ? v.i : null); return; }
    if (["allHidden", "clickThrough", "mute", "volume", "voiceVol", "main", "annivSwap", "annivLead", "duo"].indexOf(k) >= 0) syncPets();
    if (k === "annivNotify") checkReminders();
    if (k === "launchAtLogin") applyLogin();
    if (k === "theme") applyTheme();
    updateTray();
  };
  handlers["win"] = function (a) {
    if (!manager) return;
    if (a === "min") return manager.minimize();
    if (a === "max") return manager.toggleMaximize();
    if (a === "close") return manager.hide();
    if (a === "compact") {
      return boundsOf(manager).then(function (b) {
        if (b.width >= 560) S.settings.mbFull = b;
        return manager.unmaximize().catch(function () {}).then(function () {
          miniMode = true; manager.setMaximizable(false).catch(function () {});
          manager.setAlwaysOnTop(!!S.settings.miniPin);
          return setBounds(manager, { x: b.x + b.width - 340, y: b.y, width: 340, height: 470 });
        });
      }).then(function () { persist(); });
    }
    if (a === "expand") {
      manager.setAlwaysOnTop(false); miniMode = false; manager.setMaximizable(true).catch(function () {});
      var f = onScreen(S.settings.mbFull) || { width: 1060, height: 740 };
      if (f.x == null) return manager.setSize(new LSize(f.width, f.height)).then(function () { return manager.center(); });
      return setBounds(manager, f);
    }
    if (a === "pin") { S.settings.miniPin = !S.settings.miniPin; persist(); return boundsOf(manager).then(function (b) { return manager.setAlwaysOnTop(S.settings.miniPin && b.width < 560); }); }
  };
  handlers["app:version"] = function () { return T.app.getVersion(); };
  handlers["folder:open"] = function () { return invoke("open_folder"); };
  function applyTheme() {
    var v = S.settings.theme;
    if (manager) manager.setTheme(v === "light" || v === "dark" ? v : null).catch(function () {});
  }
  function applyLogin() { invoke("set_autostart", { on: S.settings.launchAtLogin !== false }).catch(function () {}); }

  /* ---------- 트레이 ---------- */
  function setPinned(v) {
    S.settings.pinned = !!v; persist(); pushToManager();
    LABELS.forEach(function (l) { if (P[l].win) P[l].win.setAlwaysOnTop(!!v).catch(function () {}); });
    updateTray();
  }
  function quit() { quitting = true; persist(true).then(function () { invoke("quit_app"); }); }
  var trayT = null;
  function updateTray() { clearTimeout(trayT); trayT = setTimeout(buildTray, 120); }
  function buildTray() {
    if (!tray) return;
    try {
      var up = A.upcoming(S).filter(function (x) { return x.n.days >= 0; })[0];
      tray.setTooltip("기념일 D-day" + (up ? " · " + A.whoName(S, up.a.who) + " " + up.a.title + " " + A.ddayText(up.n) : ""));
    } catch (e) {}
    var redo = function () { persist(); syncPets(); pushToManager(); };
    var items = [];
    if (updInfo && updInfo.newer) items.push({ text: "✦ 새 버전 " + updInfo.ver + " 받기", action: function () { invoke("open_url", { url: updInfo.url }); } }, { item: "Separator" });
    items.push(
      { text: "관리 창 열기", action: function () { showManager(); } },
      { text: S.settings.allHidden ? "캐릭터 다시 꺼내기" : "잠깐 다 숨기기", action: function () { S.settings.allHidden = !S.settings.allHidden; redo(); } },
      { text: "다른 창보다 위에", checked: S.settings.pinned !== false, action: function () { setPinned(!(S.settings.pinned !== false)); } },
      { item: "Separator" },
      { text: "컴퓨터 켜면 같이 시작", checked: S.settings.launchAtLogin !== false, action: function () { S.settings.launchAtLogin = !(S.settings.launchAtLogin !== false); persist(); applyLogin(); updateTray(); pushToManager(); } },
      { item: "Separator" },
      { text: "종료", action: quit }
    );
    T.menu.Menu.new({ items: items }).then(function (m) { return tray.setMenu(m); }).catch(function (e) { T.core.invoke("log", { msg: String([e].join(" ")) }).catch(function(){}); });
  }
  function makeTray() {
    return T.app.defaultWindowIcon().then(function (icon) {
      return T.tray.TrayIcon.new({
        id: "main", icon: icon, tooltip: "기념일 D-day", menuOnLeftClick: false, showMenuOnLeftClick: false,
        action: function (e) {
          if (e.type !== "Click" || e.button !== "Left" || e.buttonState !== "Up") return;
          if (S.settings.allHidden) { S.settings.allHidden = false; persist(); syncPets(); pushToManager(); } else showManager();
        },
      });
    }).then(function (t) { tray = t; buildTray(); }).catch(function (e) { T.core.invoke("log", { msg: String(["tray", e].join(" ")) }).catch(function(){}); });
  }

  listen("second-instance", function () { showManager(); });
  listen("quitting", function () { quitting = true; persist(true); });

  /* ---------- 시작 ---------- */
  Promise.all([loadState(), refreshMonitors()]).then(function () {
    lastDay = A.ymd(new Date());
    persist();
    applyLogin();
    return makeTray();
  }).then(function () {
    syncPets();
    return invoke("started_hidden");
  }).then(function (hidden) {
    if (!hidden) showManager();
    setTimeout(checkUpdate, 15000); setInterval(checkUpdate, 12 * 3600e3);
    setTimeout(checkReminders, 4000);
    setInterval(refreshMonitors, 60000);
  }).catch(function (e) { T.core.invoke("log", { msg: String(["start", e].join(" ")) }).catch(function(){}); showManager(); });
})();
