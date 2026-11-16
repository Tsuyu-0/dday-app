/* 웹앱 화면 손질: 좁은 화면에서는 캐릭터 목록을 위쪽 줄로, 오프라인 저장(서비스 워커) */
(function () {
  "use strict";
  var bar = document.createElement("div"); bar.className = "cbar";
  var pane = document.querySelector(".pane"), main = document.getElementById("app");
  pane.insertBefore(bar, main);
  var clist = document.getElementById("clist"), add = document.querySelector(".rbtn.add"), rail = document.querySelector(".rail"), anchor = document.querySelector(".rfill");
  function place() {
    var narrow = window.innerWidth < 760;
    if (narrow && clist.parentNode !== bar) { bar.appendChild(clist); bar.appendChild(add); }
    if (!narrow && clist.parentNode === bar) { rail.insertBefore(clist, anchor); rail.insertBefore(add, anchor); }
    document.body.classList.toggle("narrow", narrow);
  }
  place(); window.addEventListener("resize", place);
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(function () {});
})();
