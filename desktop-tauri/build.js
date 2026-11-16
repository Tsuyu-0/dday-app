// PC(Tauri)용 화면 파일 모으기: desktop/app(공통 화면) + web(Tauri 전용) → dist
const fs = require("fs"), path = require("path");
const APP = path.join(__dirname, "..", "desktop", "app"), SRC = path.join(__dirname, "..", "desktop", "src"), DIST = path.join(__dirname, "dist");
fs.rmSync(DIST, { recursive: true, force: true }); fs.mkdirSync(DIST, { recursive: true });
// 관리 창 스크립트는 조각을 이어 붙여 만들어요 (Electron 빌드와 같은 방식)
fs.writeFileSync(path.join(APP, "manager.js"), ["mhead3.js", "helpers2.js", "mbody3.js"].map((f) => fs.readFileSync(path.join(SRC, f), "utf8")).join(""));
for (const f of ["manager.js", "pet.js", "zones.js", "zones.css", "style.css", "annivs.js", "seed.json", "icon.png"]) fs.copyFileSync(path.join(APP, f), path.join(DIST, f));
fs.cpSync(path.join(APP, "fonts"), path.join(DIST, "fonts"), { recursive: true });
if (fs.existsSync(path.join(APP, "build.json"))) fs.copyFileSync(path.join(APP, "build.json"), path.join(DIST, "build.json"));
else fs.writeFileSync(path.join(DIST, "build.json"), JSON.stringify({ build: 0 }));
for (const f of fs.readdirSync(path.join(__dirname, "web"))) fs.copyFileSync(path.join(__dirname, "web", f), path.join(DIST, f));
for (const f of ["manager.html", "pet.html"]) {
  let h = fs.readFileSync(path.join(APP, f), "utf8");
  h = h.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, ""); // Tauri가 직접 관리
  h = h.replace('<script src="zones.js"></script>', '<script src="tauriapi.js"></script><script src="zones.js"></script>');
  if (!h.includes("tauriapi.js")) throw new Error("tauriapi 못 넣음: " + f);
  fs.writeFileSync(path.join(DIST, f), h);
}
console.log("dist ok", fs.readdirSync(DIST).join(" "));
