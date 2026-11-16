// PC(윈도우)용 묶기: src 조각 → app/manager.js, 그다음 electron-packager
const fs = require("fs"), path = require("path");
const src = ["mhead3.js", "helpers2.js", "mbody3.js"].map((f) => fs.readFileSync(path.join(__dirname, "src", f), "utf8")).join("");
fs.writeFileSync(path.join(__dirname, "app", "manager.js"), src);
const { packager } = require("@electron/packager");
packager({
  dir: __dirname, name: "AnniversaryDday", platform: "win32", arch: "x64", electronVersion: "38.8.6",
  asar: true, overwrite: true, out: path.join(__dirname, "out"), icon: path.join(__dirname, "icon.ico"),
  ignore: [/^\/out($|\/)/, /^\/src($|\/)/, /^\/node_modules($|\/)/, /^\/build\.js$/, /^\/icon\.ico$/],
}).then((dirs) => {
  const loc = path.join(dirs[0], "locales");
  for (const f of fs.readdirSync(loc)) if (!["ko.pak", "en-US.pak"].includes(f)) fs.unlinkSync(path.join(loc, f));
  console.log("ok", dirs[0]);
}).catch((e) => { console.error(e); process.exit(1); });
