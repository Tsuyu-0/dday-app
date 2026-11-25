/* 안드로이드 앱(캡파시터)으로 열렸을 때만: 홈 화면 위젯 · 알림 */
(function () {
  "use strict";
  var C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  document.body.classList.add("native");
  // 플러그인 연결: 캡파시터 코어(capacitor.js)의 registerPlugin → 없으면 Plugins에서 바로
  var REG = (window.capacitorExports && window.capacitorExports.registerPlugin) || (C.registerPlugin && C.registerPlugin.bind(C)) || function (n) { return (C.Plugins || {})[n]; };
  window.ddPlugin = REG;
  /* 파일 불러오기: 웹뷰 기본 창은 .ddchar · .ddtalk · 백업 파일을 흐리게 막아 버려서, 모든 파일을 고를 수 있는 안드로이드 창으로 열어요 */
  document.addEventListener("click", function (e) {
    var inp = e.target;
    if (!inp || !inp.matches || !inp.matches('input[type="file"]')) return;
    if (/image/i.test(inp.getAttribute("accept") || "")) return; // 그림 고르기는 그대로
    e.preventDefault(); e.stopPropagation();
    REG("DdayWidget").openDoc().then(function (r) {
      if (!r || !r.ok) return;
      try {
        var dt = new DataTransfer(); dt.items.add(new File([r.text || ""], r.name || "file.json", { type: "application/json" }));
        inp.files = dt.files; inp.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (er) { if (window.toast) toast("파일을 불러오지 못했어요"); }
    }).catch(function () { if (window.toast) toast("파일을 불러오지 못했어요"); });
  }, true);
  var AN = null, Widget = REG("DdayWidget"), LN = REG("LocalNotifications");
  var last = null, t = null, asked = false;

  function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function tok(S, id) { return (S.tokens || []).filter(function (x) { return x.id === id; })[0]; }

  /* 위젯에 보낼 다음 날짜들 (기념일은 그다음 번까지 넣어 둬서 오래 안 열어도 이어져요) */
  function items(S) {
    var out = [];
    AN.upcoming(S).forEach(function (x) {
      if (!x.n || x.n.days < 0) return;
      var a = x.a, name = AN.whoName(S, a.who), title = (name ? name + "의 " : "") + a.title;
      out.push({ t: title + (x.n.label && x.n.label !== a.title ? " " + x.n.label : ""), d: ymd(x.n.date), k: "a" });
      var n2 = AN.next(a, addDays(x.n.date, 1));
      if (n2 && n2.date) out.push({ t: title + (n2.label && n2.label !== a.title ? " " + n2.label : ""), d: ymd(n2.date), k: "a" });
    });
    AN.events(S).forEach(function (x) { if (x.days >= 0 && x.days <= 90) out.push({ t: x.e.title, d: x.e.date, k: "e", tm: x.e.time || "" }); });
    out.sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
    return out.slice(0, 40);
  }

  /* 함께한 지 N일째 위젯용: 시작 날짜가 있는 기념일 (고정한 것 먼저) */
  function sinceList(S) {
    var out = [];
    AN.upcoming(S).forEach(function (x) {
      var a = x.a; if (!AN.isSince(a)) return;
      var name = AN.whoName(S, a.who);
      out.push({ t: (name ? name + " · " : "") + a.title, s: a.y + "-" + String(a.m).padStart(2, "0") + "-" + String(a.d).padStart(2, "0"), p: a.pin ? 1 : 0 });
    });
    out.sort(function (a, b) { return b.p - a.p; });
    return out.slice(0, 6);
  }

  /* 사진 카드 위젯: 기념일 카드(카드 이미지 · 강조 먼저) 최대 4장 */
  var WD = ["일", "월", "화", "수", "목", "금", "토"];
  function cardList(S) {
    var list = AN.upcoming(S).filter(function (x) { return x.n && x.n.days >= 0; });
    list.sort(function (p, q) { return (q.a.pin ? 1 : 0) - (p.a.pin ? 1 : 0); });
    return list.slice(0, 4).map(function (x) {
      var a = x.a, n = x.n, sid = AN.starOf(S, a), t = tok(S, sid), since = AN.isSince(a);
      var date = a.y ? a.y + "." + String(a.m).padStart(2, "0") + "." + String(a.d).padStart(2, "0") + "(" + WD[new Date(a.y, a.m - 1, a.d).getDay()] + ")" : String(a.m).padStart(2, "0") + "." + String(a.d).padStart(2, "0");
      var name = AN.whoName(S, a.who);
      return {
        meta: { t: a.title, who: name, date: date, mode: since ? "since" : "dday", s: since ? a.y + "-" + String(a.m).padStart(2, "0") + "-" + String(a.d).padStart(2, "0") : "", d: ymd(n.date), label: n.label && n.label !== a.title ? n.label : "", pin: !!a.pin, color: (t && t.color) || "#4f7cff", img: !!a.img, icon: iconOf(a), bg: hashN(a.id || a.title, 6) },
        a: a, t: t, imgKey: (a.img || "").length + ":" + (t ? t.id : ""),
      };
    });
  }
  function iconOf(a) {
    if (a.icon) return a.icon; var t = (a.title || "") + " ";
    return /생일|탄신/.test(t) ? "cake" : /결혼|웨딩|약혼|프러포즈|청혼/.test(t) ? "ring" : /우정|친구/.test(t) ? "clover" : /데뷔|첫/.test(t) ? "star" : /이별|헤어/.test(t) ? "broken" : "heart";
  }
  function hashN(s, n) { var h = 0; s = String(s || ""); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) % n; }
  /* 카드 이미지: 넣어 둔 사진은 작게 줄여서, 없으면 그 캐릭터 그림 */
  function cardImage(c) {
    if (c.a.img) return loadImg(c.a.img).then(function (im) {
      if (!im) return "";
      var W = 640, k = Math.min(1, W / im.width), cv = document.createElement("canvas"); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
      cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height); return cv.toDataURL("image/jpeg", 0.86);
    }).catch(function () { return ""; });
    return charImage(c.t).then(function (p) { return p || ""; }).catch(function () { return ""; });
  }

  /* 폰 화면 위 캐릭터가 할 말: 그 캐릭터의 대사 + 다가오는 기념일 */
  var STYLE_MARK = { thought: "\u00A7t\u00A7", shout: "\u00A7s\u00A7", imagine: "\u00A7i\u00A7", memo: "\u00A7m\u00A7", sfx: "\u00A7x\u00A7", help: "\u00A7m\u00A7" };
  function ovData(S, t, first, shownIds) {
    if (!t) return null;
    var Z = window.Zones, out = [], clean = function (x, def) { if (!x) return "";
      /* "//" 는 말풍선 나누기: 조각마다 정리해서 "//" 로 다시 이어 보내요 (폰에서 차례로 보여 줘요).
         말풍선 모양은 조각 앞에 표시를 붙여 보내요: §t§ 생각 · §s§ 놀람 · §i§ 상상 · §m§ 포스트잇 · §x§ 효과음 */
      return String(x).split("//").map(function (seg) { var p = Z && Z.parseLine ? Z.parseLine(seg, def || "speech") : { text: seg }; var tx = String(p.text || "").trim(); return tx ? (STYLE_MARK[p.style] || "") + tx : ""; }).filter(Boolean).join("//"); };
    var zdef = function (k) { try { return (Z && Z.get ? Z.get(t, k).bubble : "") || "speech"; } catch (e) { return "speech"; } };
    (t.lines || []).forEach(function (x) { out.push(clean(x)); });
    Object.keys(t.zones || {}).forEach(function (k) { ((t.zones[k] || {}).lines || []).forEach(function (x) { out.push(clean(x, zdef(k))); }); });
    (t.idleLines || []).forEach(function (x) { out.push(clean(x, "thought")); });
    var greet = "";
    if (first && first.n && first.n.days === 0) { var a = first.a, n = first.n; var al = (a.lines || []).filter(Boolean); greet = al.length ? clean(al[0]) : AN.defaultLine(S, a, n); out.push(AN.defaultLine(S, a, n)); }
    /* 미리 알려주기: 정한 날부터 "며칠 남았어"로 먼저 인사하고, 가끔 혼잣말로도 말해요 */
    var soon = AN.tellFor ? AN.tellFor(S, t.id, shownIds || [t.id]) : [];
    soon.slice(0, 3).forEach(function (x, i) { var l = AN.soonLine(S, x.a, x.n); if (!greet && i === 0) greet = l; out.push(l); out.push(l); });
    var st = S.settings || {};
    return { name: t.nick || t.name || "", lines: out.filter(Boolean).slice(0, 80), greet: greet,
      voice: !st.mute && t.babble && t.babble !== "none" ? t.babble : "", pitch: t.babblePitch || 0, speed: t.babbleSpeed || 1, vol: typeof st.voiceVol === "number" ? st.voiceVol : 0.6,
      pet: (t.petLines || []).map(function (x) { return String(x || "").trim(); }).filter(Boolean), petOff: !!t.petOff, petShape: t.petShape || "heart", petColor: t.petColor || "", bump: (t.bumpLines || []).map(function (x) { return String(x || "").trim(); }).filter(Boolean), quietSilent: !!st.ovQuietSilent, wander: !!(t.desk && t.desk.wander), fall: !(t.desk && t.desk.noFall), wspeed: (t.desk && t.desk.wanderSpeed) || 1,
      idle: (t.idleLines || []).map(function (x) { return clean(x, "thought"); }).filter(Boolean).slice(0, 60), idleVoice: !!t.idleVoice,
      zl: (function () { var o = {}; Object.keys(t.zones || {}).forEach(function (k) { var a = ((t.zones[k] || {}).lines || []).map(function (x) { return clean(x, zdef(k)); }).filter(Boolean); if (a.length) o[k] = a; }); return o; })() };
  }

  /* ---- 페어 같이 띄우기 (PC와 같은 규칙: [페어 → 같이 띄우기]를 켠 페어, 앞의 5명까지) ---- */
  function duoPair(S) {
    var id = (S.settings || {}).duo; if (!id) return null;
    var p = (S.pairs || []).filter(function (x) { return x.id === id; })[0]; if (!p) return null;
    var ids = (p.tokenIds || []).filter(function (x) { return tok(S, x); }).slice(0, 5);
    return ids.length >= 2 ? { p: p, ids: ids } : null;
  }
  var DEF_DIALOGS = [[[0, "오늘 뭐 했어?"], [1, "너 기다렸지!"]], [[0, "배고프지 않아?"], [1, "방금 그 말 기다렸어"]], [[1, "나 오늘 좀 멋있지?"], [0, "...응, 쪼끔"]], [[0, "{B}!"], [1, "왜~"], [0, "그냥 불러 봤어"]], [[1, "졸려..."], [0, "조금만 더 버티자"]]];
  function nameOfTok(S, id) { var t = tok(S, id); return t ? (t.nick || t.name || "") : ""; }
  /* 폰에서 주고받을 대화: [{w: 몇 번째 사람, t: 대사, m: 몸짓}] 목록 */
  function duoTalks(S, d) {
    var nA = nameOfTok(S, d.ids[0]), nB = nameOfTok(S, d.ids[1]);
    var one = function (w, t, sty, m) { t = String(t || "").replace(/\{A\}/g, nA).replace(/\{B\}/g, nB).trim(); if (!t || (w || 0) >= d.ids.length) return null; t = (STYLE_MARK[sty] || "") + t; return { w: w || 0, t: t, m: m || "" }; };
    var conv = function (c) { return c.map(function (l) { if (Array.isArray(l)) return one(l[0], l[1], l[2]); var w = l.id ? d.ids.indexOf(l.id) : (l.w || 0); return w < 0 ? null : one(w, l.t, l.s, l.m); }).filter(Boolean); };
    var src = Array.isArray(d.p.dialogs) && d.p.dialogs.length ? d.p.dialogs : DEF_DIALOGS;
    var list = src.map(conv).filter(function (c) { return c.length; }), base = list.length;
    try {
      AN.upcoming(S).filter(function (x) { return x.n.days >= 0 && x.n.days <= 14 && x.a.who && x.a.who.type === "pair" && x.a.who.id === d.p.id; }).slice(0, 1).forEach(function (x) {
        var tt = x.n.label && x.n.label !== x.a.title ? x.a.title + " " + x.n.label : x.a.title;
        var c = x.n.days === 0 ? [{ w: 0, t: "오늘 " + tt + "이야!" }, { w: 1, t: "알아, 기억하고 있었어" }] : [{ w: 0, t: tt + "까지 " + x.n.days + "일 남았대" }, { w: 1, t: "벌써? 뭐 준비하지..." }];
        list.push(c, c);
      });
    } catch (e) {}
    return { list: list.slice(0, 60), base: base };
  }
  /* 누른 부위를 알 수 있는 50×50 지도 */
  function zmapOf(t) {
    if (!(window.Zones && t && Zones.build)) return Promise.resolve("");
    return Zones.build(t).then(function (m) { if (!m) return ""; var N = 200, Q = 50, out = ""; for (var y = 0; y < Q; y++) for (var x = 0; x < Q; x++) { var best = 0; for (var yy = 0; yy < 4 && !best; yy++) for (var xx = 0; xx < 4 && !best; xx++) best = m[(y * 4 + yy) * N + x * 4 + xx] || 0; out += String(best); } return out; }).catch(function () { return ""; });
  }

  /* 위젯에 들어갈 캐릭터 그림: 파츠를 순서대로 겹쳐 한 장으로 */
  function loadImg(src) { return new Promise(function (res) { if (!src) return res(null); var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = src; }); }
  function charImage(t) {
    if (!t) return Promise.resolve(null);
    var p = t.parts || {}, srcs = (t.kind === "img" || !p.head1) ? [t.img && t.img.src] : ["back", "tail", "foot", "body", "hand", "head1", "ear"].map(function (k) { return p[k] && p[k].src; });
    return Promise.all(srcs.map(loadImg)).then(function (ims) {
      ims = ims.filter(Boolean); if (!ims.length) return null;
      var N = 256, c = document.createElement("canvas"); c.width = c.height = N; var g = c.getContext("2d");
      var w0 = ims[0].naturalWidth, h0 = ims[0].naturalHeight, k = Math.min(N / w0, N / h0), w = w0 * k, h = h0 * k;
      ims.forEach(function (im) { g.drawImage(im, (N - w) / 2, (N - h) / 2, w, h); });
      try { return c.toDataURL("image/png"); } catch (e) { return null; }
    });
  }

  /* 알림: 앞으로 60일 안의 일정 알림 · 기념일 아침 9시 */
  function hashId(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) % 2000000000 + 1; }
  function notifs(S) { AN = window.Annivs;
    var now = new Date(), until = addDays(now, 60), list = [], cfg = S.settings || {};
    (S.events || []).forEach(function (e) {
      if (!e.remind || e.remind === "none" || !e.date) return;
      var p = e.date.split("-"), tm = (e.time || "09:00").split(":"), at = new Date(+p[0], +p[1] - 1, +p[2], +tm[0] || 0, +tm[1] || 0);
      var when = "오늘";
      if (e.remind === "hour") { at.setHours(at.getHours() - 1); when = "1시간 뒤"; }
      else if (e.remind === "day") { at.setDate(at.getDate() - 1); when = "내일"; }
      else if (e.remind === "morning") at.setHours(9, 0, 0, 0);
      if (at > now && at < until) list.push({ id: hashId("e" + e.id + e.remind + e.date + (e.time || "")), title: e.title, body: when + (e.time ? " " + e.time : "") + " 일정이 있어요", schedule: { at: at, allowWhileIdle: true } });
    });
    /* 기념일 알림: 3일 전부터 하루 한 번(아침 9시) + 당일. 기념일마다 [미리 알려주기]를 더 짧게(하루 전·끄기) 해 두면 그만큼만 */
    if (cfg.annivNotify !== false) AN.upcoming(S).forEach(function (x) {
      if (!x.n || x.n.days < 0 || x.n.days > 60) return;
      var a = x.a, name = AN.whoName(S, a.who), title = (name ? name + " · " : "") + a.title;
      var before = Math.min(3, AN.tellOf ? AN.tellOf(a) : 3);
      for (var k = before; k >= 0; k--) {
        var at = new Date(x.n.date); at.setDate(at.getDate() - k); at.setHours(9, 0, 0, 0); if (at <= now) continue;
        var body = k === 0 ? "오늘이에요! " + (x.n.label && x.n.label !== a.title ? x.n.label : "")
          : (AN.soonLine ? AN.soonLine(S, a, { days: k }) : a.title + "까지 " + k + "일 남았어요");
        list.push({ id: hashId("a" + a.id + ymd(x.n.date) + "-" + k), title: title, body: body, schedule: { at: at, allowWhileIdle: true } });
      }
    });
    list.sort(function (p, q) { return p.schedule.at - q.schedule.at; });
    return list.slice(0, 60);
  }
  function schedule(S) {
    var list = notifs(S);
    var go = function () {
      return LN.getPending().then(function (r) { var p = (r && r.notifications) || []; return p.length ? LN.cancel({ notifications: p.map(function (n) { return { id: n.id }; }) }) : null; })
        .catch(function () {}).then(function () { return list.length ? LN.schedule({ notifications: list }) : null; }).catch(function () {});
    };
    if (asked) return go();
    asked = true;
    return LN.checkPermissions().then(function (p) { return p.display === "granted" ? p : LN.requestPermissions(); }).then(go).catch(function () {});
  }

  function refresh(S) {
    AN = window.Annivs; if (!S || !AN) return;
    var its = items(S), first = AN.upcoming(S).filter(function (x) { return x.n && x.n.days >= 0; })[0];
    /* 폰 화면 위 캐릭터 · 위젯: 대표 캐릭터가 먼저. 기념일 당일에만 그 기념일의 캐릭터가 나와요 (PC와 같게) */
    var today = first && first.n && first.n.days === 0 ? tok(S, AN.starOf(S, first.a)) : null;
    var who = today || tok(S, (S.settings || {}).main) || (first && tok(S, AN.starOf(S, first.a))) || (S.tokens || [])[0];
    var line = first ? AN.defaultLine(S, first.a, first.n) : "";
    var cl = cardList(S);
    /* 페어 같이 띄우기: 대표(또는 오늘의) 캐릭터가 그 페어에 있거나, 대표 캐릭터가 나오는 날이면 페어가 나란히 나와요 */
    var d = duoPair(S), mem = [who];
    if (d && who && (d.ids.indexOf(who.id) >= 0 || !today)) mem = d.ids.map(function (id) { return tok(S, id); });
    var shownIds = mem.filter(Boolean).map(function (t) { return t.id; });
    var ov = ovData(S, mem[0], first, shownIds);
    if (ov && mem.length > 1) {
      ov.members = mem.map(function (t) { var o = ovData(S, t, null, shownIds); o.id = t.id; return o; });
      var tk = duoTalks(S, d); ov.dialogs = tk.list; ov.dialogBase = tk.base;
      ov.duoAuto = d.p.duoAuto !== false; ov.duoVoice = d.p.duoVoice !== false; ov.meet = d.p.meet !== false;
      /* 첫째 사람 인사: 기념일·며칠 남았어 인사는 그대로 */
      ov.members[0].greet = ov.greet;
    }
    var data = { items: its, since: sinceList(S), line: line, name: who && who.name || "", ov: ov, cards: cl.map(function (c) { return c.meta; }) };
    var key = JSON.stringify([data, mem.map(function (t) { return t ? [t.id, (t.img && t.img.src || "").length, Object.keys(t.parts || {}).map(function (k) { return k + ((t.parts[k] && t.parts[k].src) || "").length; }).join(",")] : null; }), cl.map(function (c) { return c.imgKey; })]);
    if (key !== last) {
      last = key;
      var multi = mem.length > 1;
      Promise.all([charImage(who), Promise.all(cl.map(cardImage)), Promise.all(mem.map(zmapOf)), multi ? Promise.all(mem.map(function (t) { return charImage(t).then(function (x) { return x || ""; }); })) : Promise.resolve(null)]).then(function (r) {
        if (data.ov) { data.ov.zmap = r[2][0] || ""; if (data.ov.members) data.ov.members.forEach(function (m, i) { m.zmap = r[2][i] || ""; }); }
        var arg = { data: JSON.stringify(data), image: r[0] || "", cardImgs: JSON.stringify(r[1]) };
        if (r[3]) arg.ovImgs = JSON.stringify(r[3]);
        return Widget.save(arg);
      }).catch(function () {});
    }
    schedule(S);
  }

  /* 폰 화면 위 캐릭터 켜고 끄기 (설정 화면에서 써요) */
  window.ddOverlay = {
    status: function () { return Widget.overlayStatus().catch(function () { return { granted: false, running: false }; }); },
    permission: function () { return Widget.overlayPermission(); },
    start: function () { last = null; getState().then(function (s) { refresh(s); }); return Widget.overlayStart(); },
    stop: function () { return Widget.overlayStop(); }
  };

  /* 새 버전 확인: 앱에 들어 있는 build.json 번호 ↔ GitHub 최신 릴리스 */
  var myBuild = 0;
  fetch("build.json").then(function (r) { return r.json(); }).then(function (d) { myBuild = d.build || 0; window.ddBuild = myBuild; }).catch(function () {});
  function checkUpdate() {
    return fetch("https://api.github.com/repos/Tsuyu-0/dday-app/releases/latest", { headers: { Accept: "application/vnd.github+json" } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        var m = /(\d+)$/.exec(d.tag_name || ""), latest = m ? +m[1] : 0, a = (d.assets || []).filter(function (x) { return /\.apk$/.test(x.name); })[0];
        return { newer: !!myBuild && latest > myBuild, ver: (d.tag_name || "").replace(/^v/, ""), cur: myBuild ? "1.0." + myBuild : "", url: (a && a.browser_download_url) || d.html_url };
      }).catch(function () { return { err: true, cur: myBuild ? "1.0." + myBuild : "" }; });
  }
  window.ddCheckUpdate = checkUpdate;
  window.api.openUrl = function (u) { location.href = u; }; // 앱 밖 주소는 휴대폰 브라우저로 열려요
  setTimeout(function () {
    var last = +(localStorage.getItem("dd-upd-at") || 0);
    if (Date.now() - last < 20 * 3600e3) { try { var c = JSON.parse(localStorage.getItem("dd-upd") || "null"); if (c && c.newer && myBuild && +(c.ver.split(".").pop()) > myBuild && window.ddShowUpdate) window.ddShowUpdate(c); } catch (e) {} return; }
    checkUpdate().then(function (i) { localStorage.setItem("dd-upd-at", String(Date.now())); localStorage.setItem("dd-upd", JSON.stringify(i)); if (i && i.newer && window.ddShowUpdate) window.ddShowUpdate(i); });
  }, 5000);

  var api = window.api, setState = api.setState, getState = api.getState;
  var lastS = null, setSettings = api.setSettings;
  api.setState = function (s) { lastS = s; setState(s); clearTimeout(t); t = setTimeout(function () { refresh(s); }, 1500); };
  api.getState = function () { return getState().then(function (s) { lastS = s; setTimeout(function () { refresh(s); }, 1200); return s; }); };
  /* 설정(대표 캐릭터·돌아다니기 등)만 바꿔도 폰 위 캐릭터 · 위젯에 바로 반영돼요 */
  api.setSettings = function (k, v) { setSettings(k, v);
    /* [들어 보기]: 방금 고친 대화가 폰 위 캐릭터에 먼저 넘어간 뒤 시작해요 */
    if (k === "talkNow") { var ti = v && typeof v === "object" && typeof v.i === "number" ? v.i : -1; clearTimeout(t); if (lastS) refresh(lastS); setTimeout(function () { Widget.overlayTalk({ i: ti }).catch(function () {}); }, 1600); return; } if (!lastS) return; lastS.settings = lastS.settings || {}; lastS.settings[k] = v; clearTimeout(t); t = setTimeout(function () { refresh(lastS); }, 600); };
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") api.getState && getState().then(function (s) { refresh(s); }); });
})();
