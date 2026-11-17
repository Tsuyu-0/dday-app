// Model the canvas security boundary; this is not a native WebView2 test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const cp = require('node:child_process');

function harness(source) {
  const loads = [];
  class Image {
    set src(src) {
      this.url = src;
      this.naturalWidth = this.naturalHeight = 200;
      this.readable = !/^(https?:|asset:)/.test(src) || this.crossOrigin === 'anonymous';
      loads.push({src, cors: this.crossOrigin});
      queueMicrotask(() => this.onload());
    }
  }
  const document = {createElement() {
    let im;
    return {getContext() {return {
      drawImage(image) {im = image;},
      getImageData() {
        if (!im.readable) throw new Error('SecurityError: tainted canvas');
        const data = new Uint8ClampedArray(200 * 200 * 4);
        const key = im.url.split('/').pop();
        const box = {head1:[80,20,120,80],body:[80,80,120,140],hand:[60,90,80,130],foot:[80,140,120,180]}[key];
        if (box) for(let y=box[1];y<box[3];y++) for(let x=box[0];x<box[2];x++) data[(y*200+x)*4+3]=255;
        return {data};
      }
    };}};
  }};
  const context = {window:{}, Image, document, Uint8Array, setTimeout, clearTimeout};
  vm.runInNewContext(source, context);
  return {Z:context.window.Zones, loads};
}
function token(prefix) {
  return {kind:'clicker',parts:Object.fromEntries(['head1','body','hand','foot'].map(k=>[k,{src:prefix+k}]))};
}
(async()=>{
  const root=path.resolve(__dirname,'..');
  const original=cp.execFileSync('git',['show','v1.0.51:desktop/app/zones.js'],{cwd:root,encoding:'utf8'});
  const before=harness(original);
  assert.equal(await before.Z.build(token('http://asset.localhost/')),null);
  assert.equal(before.Z.at(null,.35,.55),'face');
  console.log('PASS: v1.0.51 reproduces null map and face fallback under canvas security model');
  for(const file of ['desktop/app/zones.js','web/zones.js']) {
    for(const prefix of ['http://asset.localhost/','https://asset.localhost/','asset://localhost/','data:image/mock/','file:///images/']) {
      const {Z,loads}=harness(fs.readFileSync(path.join(root,file),'utf8'));
      const map=await Z.build(token(prefix));
      assert.ok(map);
      assert.equal(Z.at(map,70/199,110/199),'hand');
      assert.equal(Z.at(map,100/199,160/199),'foot');
      assert.equal(Z.at(map,100/199,110/199),'body');
      assert.equal(Z.at(map,100/199,30/199),'head');
      assert.equal(Z.at(map,100/199,65/199),'face');
      for(const load of loads) assert.equal(load.cors,/^(https?:|asset:)/.test(prefix)?'anonymous':undefined);
      console.log('PASS:',file,prefix);
    }
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
