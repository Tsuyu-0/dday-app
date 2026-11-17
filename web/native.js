/* 안드로이드 앱(캡파시터)으로 열렸을 때만: 홈 화면 위젯 · 알림 */
(function () {
  "use strict";
  var C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  document.body.classList.add("native");
  // 플러그인 연결: 캡파시터 코어(capacitor.js)의 registerPlugin → 없으면 Plugins에서 바로
  var REG = (window.capacitorExports && window.capacitorExports.registerPlugin) || (C.registerPlugin && C.registerPlugin.bind(C)) || function (n) { return (C.Plugins || {})[n]; };
  window.ddPlugin = REG;
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
  function ovData(S, t, first) {
    if (!t) return null;
    var Z = window.Zones, out = [], clean = function (x) { if (!x) return ""; var p = Z && Z.parseLine ? Z.parseLine(x, "speech") : { text: x }; return String(p.text || "").split("//")[0].trim(); };
    (t.lines || []).forEach(function (x) { out.push(clean(x)); });
    Object.keys(t.zones || {}).forEach(function (k) { ((t.zones[k] || {}).lines || []).forEach(function (x) { out.push(clean(x)); }); });
    (t.idleLines || []).forEach(function (x) { out.push(clean(x)); });
    var greet = "";
    if (first && first.n) { var a = first.a, n = first.n; var al = (a.lines || []).filter(Boolean); greet = n.days === 0 && al.length ? clean(al[0]) : AN.defaultLine(S, a, n); out.push(AN.defaultLine(S, a, n)); }
    var st = S.settings || {};
    return { name: t.nick || t.name || "", lines: out.filter(Boolean).slice(0, 80), greet: greet,
      voice: !st.mute && t.babble && t.babble !== "none" ? t.babble : "", pitch: t.babblePitch || 0, speed: t.babbleSpeed || 1, vol: typeof st.voiceVol === "number" ? st.voiceVol : 0.6 };
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
    if (cfg.annivNotify !== false) AN.upcoming(S).forEach(function (x) {
      if (!x.n || x.n.days < 0 || x.n.days > 60) return;
      var at = new Date(x.n.date); at.setHours(9, 0, 0, 0); if (at <= now) return;
      var a = x.a, name = AN.whoName(S, a.who);
      list.push({ id: hashId("a" + a.id + ymd(x.n.date)), title: (name ? name + " · " : "") + a.title, body: "오늘이에요! " + (x.n.label && x.n.label !== a.title ? x.n.label : ""), schedule: { at: at, allowWhileIdle: true } });
    });
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
    var who = first && tok(S, AN.starOf(S, first.a)) || tok(S, (S.settings || {}).main) || (S.tokens || [])[0];
    var line = first ? AN.defaultLine(S, first.a, first.n) : "";
    var cl = cardList(S);
    var data = { items: its, since: sinceList(S), line: line, name: who && who.name || "", ov: ovData(S, who, first), cards: cl.map(function (c) { return c.meta; }) };
    var key = JSON.stringify([data, who && who.id, who && (who.img && who.img.src || "").length, who && Object.keys(who.parts || {}).length, cl.map(function (c) { return c.imgKey; })]);
    if (key !== last) {
      last = key;
      Promise.all([charImage(who), Promise.all(cl.map(cardImage))]).then(function (r) {
        return Widget.save({ data: JSON.stringify(data), image: r[0] || "", cardImgs: JSON.stringify(r[1]) });
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
  api.setState = function (s) { setState(s); clearTimeout(t); t = setTimeout(function () { refresh(s); }, 1500); };
  api.getState = function () { return getState().then(function (s) { setTimeout(function () { refresh(s); }, 1200); return s; }); };
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") api.getState && getState().then(function (s) { refresh(s); }); });
})();
