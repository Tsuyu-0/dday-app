/* 웹앱용 api — 데스크톱 앱의 preload 대신. 모든 데이터는 이 기기 브라우저(IndexedDB)에만 저장돼요. */
(function () {
  "use strict";
  var DB = "dday-web", STORE = "kv", KEY = "state";
  var cur = null, saveT = null;
  function idb() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(STORE); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    });
  }
  function get() { return idb().then(function (db) { return new Promise(function (res) { var q = db.transaction(STORE).objectStore(STORE).get(KEY); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { res(null); }; }); }); }
  function put(v) { return idb().then(function (db) { return new Promise(function (res) { var tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).put(v, KEY); tx.oncomplete = function () { res(true); }; tx.onerror = function () { res(false); }; }); }); }
  function saveSoon() { clearTimeout(saveT); saveT = setTimeout(function () { if (cur) put(JSON.parse(JSON.stringify(cur))); }, 250); }

  /* 처음 열었을 때만: 민둥이 예시 기념일 · 일정 */
  function addSamples(s) {
    if (!(s.tokens || []).some(function (t) { return t.id === "t-bald"; })) return;
    function d(n) { var x = new Date(); x.setDate(x.getDate() + n); return x; }
    function ymd(x) { return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); }
    var meet = d(12), hund = d(-79), who = { type: "token", id: "t-bald" };
    s.annivs = (s.annivs || []).concat([
      { id: "a-smp1", sample: true, title: "처음 만난 날", who: who, y: meet.getFullYear() - 1, m: meet.getMonth() + 1, d: meet.getDate(), repeat: "yearly", count: "since", lines: ["우리 처음 만난 날이야! 기억하지?"], pin: true },
      { id: "a-smp2", sample: true, title: "함께한 날", who: who, y: hund.getFullYear(), m: hund.getMonth() + 1, d: hund.getDate(), repeat: "d100", count: "dday", lines: [] }
    ]);
    s.events = (s.events || []).concat([
      { id: "e-smp1", sample: true, title: "다이어리 꾸미기", date: ymd(d(2)), time: "", cat: "fan", who: who, memo: "이번 달 달력에 스티커 붙이기", remind: "morning" },
      { id: "e-smp2", sample: true, title: "TRPG 세션 1회차", date: ymd(d(6)), time: "20:00", cat: "trpg", who: who, memo: "캐릭터 시트 챙기기", remind: "hour" }
    ]);
  }
  function fresh() {
    return fetch("seed.json").then(function (r) { return r.json(); }).then(function (s) {
      s.tokens = (s.tokens || []).filter(function (t) { return t.id === "t-bald"; });
      s.settings = Object.assign({}, s.settings || {}, { main: "t-bald" });
      addSamples(s); return s;
    });
  }
  function norm(s) {
    s.tokens = s.tokens || []; s.pairs = s.pairs || []; s.annivs = s.annivs || []; s.events = s.events || []; s.diary = s.diary || {}; s.notes = s.notes || {};
    s.settings = Object.assign({ annivSwap: true, annivLead: 0, volume: .5, voiceVol: .6 }, s.settings || {});
    return s;
  }
  var noop = function () {};
  window.api = {
    getState: function () { return get().then(function (s) { return s || fresh(); }).then(function (s) { cur = norm(s); saveSoon(); return cur; }); },
    setState: function (s) { cur = s; saveSoon(); },
    onState: noop, onEdit: noop, onNav: noop, onPetToken: noop, onPetSay: noop, onPetPoke: noop,
    setSettings: function (k, v) { if (cur) { cur.settings = cur.settings || {}; cur.settings[k] = v; saveSoon(); } },
    win: noop, openFolder: noop, petOpen: noop, petIgnore: noop, petDragStart: noop, petDrag: noop, petDragEnd: noop, petMenu: noop,
    petToken: function () { return Promise.resolve(null); },
    version: function () { return Promise.resolve("웹 1.0"); },
    saveImage: function (d) { return Promise.resolve(d); },
    saveSound: function (d) { return Promise.resolve(d); },
    saveFile: function (name, text) {
      var C = window.Capacitor;
      if (C && C.isNativePlatform && C.isNativePlatform()) {
        var FS = C.registerPlugin("Filesystem"), SH = C.registerPlugin("Share");
        return FS.writeFile({ path: name, data: text, directory: "CACHE", encoding: "utf8" })
          .then(function (r) { return SH.share({ title: name, files: [r.uri], dialogTitle: "파일 보내기 · 저장" }); })
          .then(function () { return true; }).catch(function () { return false; });
      }
      try {
        var blob = new Blob([text], { type: "application/json" }), a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        return Promise.resolve(true);
      } catch (e) { return Promise.resolve(false); }
    }
  };
  window.addEventListener("pagehide", function () { if (cur) put(JSON.parse(JSON.stringify(cur))); });
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden" && cur) put(JSON.parse(JSON.stringify(cur))); });
})();
