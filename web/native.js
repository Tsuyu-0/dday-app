/* 안드로이드 앱(캡파시터)으로 열렸을 때만: 홈 화면 위젯 · 알림 */
(function () {
  "use strict";
  var C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  document.body.classList.add("native");
  var AN = null, Widget = C.registerPlugin("DdayWidget"), LN = C.registerPlugin("LocalNotifications");
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
    var data = { items: its, since: sinceList(S), line: line, name: who && who.name || "" };
    var key = JSON.stringify([data, who && who.id, who && (who.img && who.img.src || "").length, who && Object.keys(who.parts || {}).length]);
    if (key !== last) {
      last = key;
      charImage(who).then(function (png) { return Widget.save({ data: JSON.stringify(data), image: png || "" }); }).catch(function () {});
    }
    schedule(S);
  }

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
