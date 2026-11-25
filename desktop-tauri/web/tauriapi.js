/* 관리 창 · 캐릭터 창에서 쓰는 window.api (예전 Electron preload 자리) → 숨은 core 창과 이벤트로 주고받아요 */
(function () {
  "use strict";
  window.addEventListener("error", function (e) { try { window.__TAURI__.core.invoke("log", { msg: (e.message || "") + " @" + (e.filename || "").split("/").pop() + ":" + e.lineno }); } catch (x) {} });
  window.addEventListener("unhandledrejection", function (e) { try { window.__TAURI__.core.invoke("log", { msg: "promise: " + (e.reason && (e.reason.message || e.reason)) }); } catch (x) {} });
  var T = window.__TAURI__, win = T.webviewWindow.getCurrentWebviewWindow(), me = win.label;
  var DPI = T.dpi || T.window, LPos = DPI.LogicalPosition;
  var pend = {}, n = 0, subs = {};
  var ready = Promise.all([
    T.event.listen("reply", function (e) { var p = e.payload || {}; if (p.to !== me) return; var f = pend[p.id]; if (f) { delete pend[p.id]; f(p.result); } }),
    T.event.listen("to-" + me, function (e) { var p = e.payload || {}; (subs[p.type] || []).forEach(function (cb) { try { cb(p.data); } catch (err) { console.error(err); } }); }),
  ]);
  function call(type) {
    var args = [].slice.call(arguments, 1);
    return ready.then(function () { return new Promise(function (res) {
      var id = me + "-" + (++n) + "-" + Math.random().toString(36).slice(2, 7); pend[id] = res;
      T.event.emit("to-core", { from: me, id: id, type: type, args: args });
    }); });
  }
  function send(type) { var args = [].slice.call(arguments, 1); ready.then(function () { T.event.emit("to-core", { from: me, type: type, args: args }); }); }
  function on(type) { return function (cb) { (subs[type] = subs[type] || []).push(cb); }; }

  /* 캐릭터 창: 그림 위에 있을 때만 마우스를 받고, 나머지는 바탕화면으로 통과.
     통과 중에는 마우스 움직임이 안 들어와서 커서 위치를 조금씩 확인해 대신 알려 줘요. */
  var ignoring = null, pos = null, k = 1, dragFrom = null, posT = 0, walkUntil = 0, bnd = null, dragCur = null;
  /* 바닥: 작업 표시줄 위. 모니터 정보에 작업 영역이 없을 때(모니터 전체 크기만 올 때) 캐릭터가 작업 표시줄 뒤로 숨어 버려서,
     창이 있는 화면의 '쓸 수 있는 영역'(screen.avail*)으로 한 번 더 맞춰요 */
  function fixFloor() {
    if (!bnd) return;
    try { var sc = window.screen, wh = window.innerHeight; if (sc && sc.availHeight > 100) { var f = (sc.availTop || 0) + sc.availHeight - wh; if (Math.abs(f - bnd.y1) < 400) bnd.y1 = Math.min(bnd.y1, f); } } catch (e) {}
  }
  function moveClamp(x, y) { var hit = 0; if (bnd) { if (x < bnd.x0) { x = bnd.x0; hit = 1; } else if (x > bnd.x1) { x = bnd.x1; hit = 2; } if (y < bnd.y0) { y = bnd.y0; hit = hit || 3; } else if (y > bnd.y1) { y = bnd.y1; hit = hit || 4; } } dragCur = { x: x, y: y }; win.setPosition(new LPos(Math.round(x), Math.round(y))).catch(function () {}); return hit; }
  function refreshPos() { return Promise.all([win.outerPosition(), win.scaleFactor()]).then(function (r) { k = r[1] || 1; pos = { x: r[0].x, y: r[0].y }; posT = Date.now(); }).catch(function () {}); }
  function setIgnore(v) { v = !!v; if (v === ignoring) return; ignoring = v; win.setIgnoreCursorEvents(v).catch(function () {}); }
  function poll() {
    if (!/^pet/.test(me)) return;
    setTimeout(poll, ignoring ? 70 : 250);
    if (!ignoring || dragFrom) return;
    var p = Date.now() - posT > 1500 || Date.now() < walkUntil ? refreshPos() : Promise.resolve();
    p.then(function () { return T.window.cursorPosition(); }).then(function (c) {
      if (!pos || !c) return;
      var x = (c.x - pos.x) / k, y = (c.y - pos.y) / k;
      if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return;
      var el = document.elementFromPoint(x, y) || document.body;
      el.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: x, clientY: y, screenX: c.x / k, screenY: c.y / k }));
    }).catch(function () {});
  }
  if (/^pet/.test(me)) { refreshPos().then(function () { setIgnore(true); poll(); }); }

  /* 관리 창: 제목 줄을 잡고 끌면 창 이동, 두 번 누르면 크게 */
  if (me === "manager") {
    var NODRAG = ".wc,.tsb,button,input,select,textarea,a,[contenteditable],label";
    document.addEventListener("mousedown", function (e) {
      if (e.button !== 0) return; var t = e.target;
      if (!t.closest || !t.closest(".tb,.mtb") || t.closest(NODRAG)) return;
      if (e.detail === 2) { send("win", "max"); return; }
      win.startDragging().catch(function () {});
    });
  }

  window.api = {
    getState: function () { return call("state:get"); },
    setState: function (s) { send("state:set", s); },
    onState: on("state"),
    onEdit: on("edit"),
    setSettings: function (key, v) { send("settings:set", key, v); },
    win: function (a) { send("win", a); },
    version: function () { return call("app:version"); },
    trackGet: function () { return call("track:get"); },
    trackRunning: function () { return call("track:running"); },
    trackFront: function () { return call("track:front"); },
    trackSet: function (k, v) { return call("track:set", k, v); },
    onTrack: on("track"),
    openFolder: function () { send("folder:open"); },
    saveFile: function (name, text) { return call("file:save", name, text); },
    savePng: function (name, dataUrl) { return call("file:png", name, dataUrl); },
    petToken: function () { return call("pet:token"); },
    onPetToken: on("pet:token"),
    onPetSay: on("pet:say"),
    saveImage: function (d) { return call("img:save", d); },
    saveSound: function (d) { return call("snd:save", d); },
    checkUpdate: function () { return call("upd:check"); },
    onUpdate: on("update"),
    openUrl: function (u) { send("open:url", u); },
    petOpen: function (v) { send("pet:open", v); },
    onNav: on("nav"),
    onPetPoke: on("pet:poke"),
    onPetLine: on("pet:line"),
    onPetAct: on("pet:act"),
    petPetted: function () { send("pet:petted"); },
    petTapped: function () { send("pet:tap"); },
    petLineDone: function (g, k) { send("pet:lineDone", g, k); },
    /* 옆 친구 쪽으로 살짝 다가갔다 돌아오기 */
    nudge: function (dir) { Promise.all([win.outerPosition(), win.scaleFactor()]).then(function (r) { var x0 = r[0].x, y0 = r[0].y, dist = 26 * (r[1] || 1) * (dir >= 0 ? 1 : -1), t0 = Date.now(), PP = DPI.PhysicalPosition;
      (function f() { var t = (Date.now() - t0) / 700; if (t >= 1) { win.setPosition(new PP(x0, y0)).catch(function () {}); return; } win.setPosition(new PP(Math.round(x0 + dist * Math.sin(t * Math.PI)), y0)).catch(function () {}); setTimeout(f, 30); })(); }).catch(function () {}); },
    petIgnore: function (v) { if (!dragFrom) setIgnore(v); },
    petDragStart: function (inset) { inset = inset || 0; setIgnore(false); refreshPos().then(function () { dragFrom = { x: pos.x / k, y: pos.y / k }; dragCur = { x: dragFrom.x, y: dragFrom.y }; });
      window.api.walkInfo().then(function (I) { var s = I.sf || 1; bnd = { x0: I.ax / s - inset, x1: (I.ax + I.aw - I.w) / s + inset, y0: I.ay / s - I.h / s * .45, y1: (I.ay + I.ah - I.h) / s }; fixFloor(); }).catch(function () { bnd = null; }); },
    /* 끌기: 화면 밖으로는 못 나가요. 벽에 닿으면 어느 쪽인지 돌려줘요 (1 왼쪽 2 오른쪽 3 위 4 아래) */
    petDrag: function (dx, dy) { if (!dragFrom) return 0; return moveClamp(dragFrom.x + dx, dragFrom.y + dy); },
    petDragEnd: function () { dragFrom = null; refreshPos(); send("pet:dragend"); },
    /* 떨어지기: 놓은 자리에서 화면 아래(작업 표시줄 위)까지 툭. 떨어질 게 없으면 false */
    petFall: function (onStart, onLand) {
      if (!bnd || !dragCur) return false;
      var x = dragCur.x, y = dragCur.y, floor = bnd.y1, dist = floor - y, v = 0, last = performance.now();
      if (dist < 6) return false;
      dragFrom = { x: 0, y: 0 }; if (onStart) onStart(dist);
      (function f(now) {
        var dt = Math.min(32, now - last); last = now; v = Math.min(3.2, v + .0034 * dt); y += v * dt;
        if (y >= floor) { moveClamp(x, floor); dragFrom = null; refreshPos(); send("pet:dragend"); if (onLand) onLand(dist); return; }
        moveClamp(x, y); requestAnimationFrame(f);
      })(last);
      return true;
    },
    /* 던지기: 놓는 순간의 빠르기로 미끄러지다가 벽에 부딪히면 onHit(쪽) */
    petThrow: function (vx, vy, onHit, onEnd) {
      var cx = dragCur ? dragCur.x : pos.x / k, cy = dragCur ? dragCur.y : pos.y / k, t0 = performance.now(), last = t0, hits = 0;
      dragFrom = { x: 0, y: 0 };
      (function f(now) {
        var dt = Math.min(40, now - last); last = now; vx *= Math.pow(.992, dt); vy *= Math.pow(.992, dt);
        cx += vx * dt; cy += vy * dt; var h = moveClamp(cx, cy);
        if (h) { if (h <= 2) { vx = -vx * .35; } else { vy = -vy * .35; } cx = dragCur.x; cy = dragCur.y; if (hits++ < 2 && onHit) onHit(h); }
        if (Math.abs(vx) + Math.abs(vy) > .05 && now - t0 < 1500) requestAnimationFrame(f);
        else { dragFrom = null; refreshPos(); send("pet:dragend"); if (onEnd) onEnd(); }
      })(t0);
    },
    /* 돌아다니기: 창 위치 · 화면 작업 영역(작업 표시줄 뺀 곳)을 실제 픽셀로 */
    walkInfo: function () { return Promise.all([win.outerPosition(), win.outerSize(), win.scaleFactor(), T.window.currentMonitor()]).then(function (r) {
      var m = r[3] || {}, sk = m.scaleFactor || r[2] || 1, wa = m.workArea || { position: m.position || { x: 0, y: 0 }, size: m.size ? { width: m.size.width, height: m.size.height - 48 * sk } : { width: 1920, height: 1032 } };
      return { x: r[0].x, y: r[0].y, w: r[1].width, h: r[1].height, sf: r[2] || 1, ax: wa.position.x, aw: wa.size.width, ay: wa.position.y, ah: wa.size.height }; }); },
    walkMove: function (fromX, toX, y, ms) { walkUntil = Date.now() + ms + 300; return T.core.invoke("walk_move", { fromX: fromX, toX: toX, y: y, ms: Math.round(ms) }).catch(function () {}); },
    walkStop: function () { walkUntil = 0; refreshPos(); return T.core.invoke("walk_stop").catch(function () {}); },
    walkSetX: function (x, y) { var PP = DPI.PhysicalPosition; pos = { x: Math.round(x), y: y }; posT = Date.now(); return win.setPosition(new PP(Math.round(x), y)).catch(function () {}); },
    walkDone: function () { refreshPos(); send("pet:walked"); },
    walkFriends: function () { return call("pet:friends"); },
    petMenu: function () { send("pet:menu"); },
  };
})();
