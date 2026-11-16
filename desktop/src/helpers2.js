/* ---------- 이미지 ---------- */
function loadImg(src){return new Promise(function(res,rej){var i=new Image(); i.onload=function(){res(i)}; i.onerror=rej; i.src=src;})}
function fileToURL(f){return new Promise(function(res,rej){var r=new FileReader(); r.onload=function(){res(r.result)}; r.onerror=rej; r.readAsDataURL(f)})}
/* 긴 변 640px로 줄이고 투명 배경 유지 */
function shrink(src){
  return loadImg(src).then(function(im){
    var w=im.naturalWidth||640, h=im.naturalHeight||640, k=Math.min(1,640/Math.max(w,h));
    var c=document.createElement("canvas"); c.width=Math.max(1,Math.round(w*k)); c.height=Math.max(1,Math.round(h*k));
    c.getContext("2d").drawImage(im,0,0,c.width,c.height);
    return new Promise(function(res){
      c.toBlob(function(b){ if(b&&b.type==="image/webp") return res(b); c.toBlob(function(b2){res(b2)},"image/png"); },"image/webp",.86);
    });
  });
}
/* 줄인 그림을 저장소에 올리고, 안 되면 data URL로 */
function storeImg(src){
  return shrink(src).then(function(blob){ if(!blob) throw 0; return fileToURL(blob).then(function(u){return {src:u}}); });
}

function tokById(id){ for(var i=0;i<S.tokens.length;i++) if(S.tokens[i].id===id) return S.tokens[i]; return null; }
function initial(t){ return esc(((t.nick||t.name||"?").trim()[0]||"?")); }
function tint(hex,a){ var h=(hex||"#1d1e1f").replace("#",""); if(h.length===3) h=h.split("").map(function(x){return x+x}).join(""); var n=parseInt(h,16)||0; return "rgba("+(n>>16&255)+","+(n>>8&255)+","+(n&255)+","+a+")"; }
function deskOn(t){ return !!(t.desk&&t.desk.show); }
function isCk(t){ return Zones.isCk(t); }
function hasPic(t){ return isCk(t)||(t.img&&t.img.src); }
var lastLine={}, orderIdx={}, bubT={};
function pickLine(t,list,key){
  if(!list||!list.length) return null;
  var m=t.motion||{};
  if(m.inOrder){ var i=(orderIdx[key]||0)%list.length; orderIdx[key]=i+1; return list[i]; }
  var i2=Math.floor(Math.random()*list.length);
  if(m.noRepeat!==false&&list.length>1&&i2===lastLine[key]) i2=(i2+1+Math.floor(Math.random()*(list.length-1)))%list.length;
  lastLine[key]=i2; return list[i2];
}
function say(card,line,idle,t,def){
  var stage=$(".stage",card)||card;
  var go=function(){ var sz=stage.offsetHeight, bp=t?Zones.bubPos(t,sz):{fromTop:0,dy:0,dx:0};
    Zones.say(stage,line,def||(idle?"thought":"speech"),{bottom:sz-bp.fromTop+6+bp.dy,dx:bp.dx*(t&&t.desk&&t.desk.flip?-1:1),clamp:true,fitTop:16,maxWidth:Math.max(120,stage.offsetWidth-16),voice:(t&&t.babble&&t.babble!=="none"&&!((S.settings||{}).mute))?{type:t.babble,vol:typeof (S.settings||{}).voiceVol==="number"?S.settings.voiceVol:.6,pitch:t.babblePitch||0,speed:t.babbleSpeed||1,delay:idle?0:170}:null},((t&&t.motion)||{}).bubbleMs||1500,idle); };
  if(t) Zones.topFrac(t).then(go); else go();
}
