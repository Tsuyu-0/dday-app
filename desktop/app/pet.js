(function(){
"use strict";
var api=window.api, Z=window.Zones, stage=document.getElementById("stage"), T=null, MAP=null;
function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]}); }
var celebrated={};
function render(t){
  var prev=T; T=t; if(!t) return;
  var cfg=t._cfg||{};
  if(cfg.anniv&&cfg.anniv.days===0){ var key=cfg.day+"|"+cfg.anniv.id+"|"+t.id; if(!celebrated[key]){ celebrated[key]=1; setTimeout(celebrate,900); } }
  var size=(t.desk&&t.desk.size)||160; stage.style.width=stage.style.height=size+"px"; stage.classList.toggle("pxl",!!t.pixel);
  var flip=t.desk&&t.desk.flip?"scaleX(-1)":"none", inner;
  if(Z.isCk(t)) inner=Z.ckHTML(t);
  else if(t.img&&t.img.src) inner='<img class="one" src="'+esc(t.img.src)+'"'+(t.pixel?' style="image-rendering:pixelated"':"")+'>';
  else inner='<div class="one" style="display:flex;align-items:center;justify-content:center;border-radius:50%;background:'+esc(t.color||"#1d1e1f")+';color:#fff;font-weight:700;font-size:'+Math.round(size/3)+'px;inset:18%;width:auto;height:auto">'+esc((t.nick||t.name||"?")[0])+"</div>";
  stage.innerHTML='<div class="shadow"></div><div id="inner" style="transform:'+flip+'">'+inner+"</div>";
  MAP=null; Z.build(t).then(function(m){ MAP=m; }); Z.topFrac(t);
}
/* 마우스 위치 → 0~1 (뒤집기 반영) */
function norm(e){ var r=stage.getBoundingClientRect(), fx=(e.clientX-r.left)/r.width, fy=(e.clientY-r.top)/r.height; if(T&&T.desk&&T.desk.flip) fx=1-fx; return [fx,fy,e.clientX-r.left,e.clientY-r.top]; }
function zoneAt(e){ var p=norm(e); if(p[0]<0||p[1]<0||p[0]>1||p[1]>1) return null; return Z.at(MAP,p[0],p[1]); }

/* 대사 */
var last={}, bubT=null;
function pick(list,key){
  if(!list||!list.length) return null; var m=(T&&T.motion)||{};
  if(m.inOrder){ last[key]=((last[key]==null?-1:last[key])+1)%list.length; return list[last[key]]; }
  var i=Math.floor(Math.random()*list.length);
  if(m.noRepeat!==false&&list.length>1&&i===last[key]) i=(i+1+Math.floor(Math.random()*(list.length-1)))%list.length;
  last[key]=i; return list[i];
}
var defBub="speech";
/* 알려 주는 풍선: 버튼 달린 노란 풍선 */
var VIEW_LB={events:"일정 보기",anniv:"기념일 보기",home:"열어 보기"};
function helpSay(text,view){
  if(!T||!text) return;
  clearTimeout(document.body._sayT); Array.prototype.forEach.call(document.querySelectorAll("body > .bub"),function(x){x.remove()});
  var sz=stage.offsetHeight, bp=Z.bubPos(T,sz);
  var el=Z.bubble(document.body,text,"help",{bottom:8+sz-bp.fromTop+18+bp.dy,dx:bp.dx*(T.desk&&T.desk.flip?-1:1),clamp:true,maxWidth:Math.max(160,window.innerWidth-50),
    buttons:[[VIEW_LB[view]||"열어 보기",view||"home"],["알겠어","ok"]],onAct:function(a){ if(a!=="ok") api.petOpen(a); setOver(false); }});
  setTimeout(function(){ if(el.parentNode) el.remove(); },12000);
}
function say(line,idle,style,msOver,quiet){
  var ms=msOver||((T&&T.motion)||{}).bubbleMs||1500;
  var sz=stage.offsetHeight, bp=Z.bubPos(T,sz);
  var cf=T._cfg||{}, vc=(!quiet&&T.babble&&T.babble!=="none"&&!cf.mute&&(!idle||T.idleVoice))?{type:T.babble,vol:cf.voiceVol==null?.6:cf.voiceVol,pitch:T.babblePitch||0,speed:T.babbleSpeed||1,delay:idle?0:170}:null;
  Z.say(document.body,line,style||(idle?"thought":defBub),{bottom:8+sz-bp.fromTop+14+bp.dy,dx:bp.dx*(T.desk&&T.desk.flip?-1:1),clamp:true,maxWidth:Math.max(140,window.innerWidth-60),voice:vc},ms,idle);
}
function react(zone,px,py){
  if(!T) return;
  var r=Z.react(stage,T,zone), size=stage.offsetWidth, cfg=T._cfg||{}; defBub=r.bubble||"speech";
  if(!cfg.mute) Z.sound(r.sound,cfg.volume,r.soundSrc);
  if(px==null){ px=size/2; py=size*.3; }
  Z.spawn(stage,px,py,r.fx,size);
  var al=(T._cfg&&T._cfg.anniv&&T._cfg.anniv.days===0)?annivLines():[];
  if(al.length&&Math.random()<.35) say(pick(al,"a"),false); else say(pick(r.lines,"l-"+zone),false);
}
/* 기념일 당일 연출 */
function annivLines(){ var a=T&&T._cfg&&T._cfg.anniv; if(!a) return []; return a.lines&&a.lines.length?a.lines:[a.def]; }
function celebrate(){
  if(!T) return; var a=T._cfg&&T._cfg.anniv; if(!a) return;
  var size=stage.offsetWidth, kinds=["heart","star","sparkle","note"];
  Z.react(stage,T,"head");
  for(var i=0;i<4;i++) (function(i){ setTimeout(function(){ Z.spawn(stage,size*(.2+Math.random()*.6),size*(.15+Math.random()*.4),kinds[i%kinds.length],size); },i*220); })(i);
  var cfg=T._cfg||{}; if(!cfg.mute) Z.sound("fanfare",cfg.volume);
  say(a.days===0?pick(annivLines(),"a"):a.def,false);
}
/* 가만히 있을 때 고개 까딱 */
(function tiltLoop(){ setTimeout(function(){ if(T&&T.motion&&T.motion.idleTilt&&!down) Z.idleTilt(stage); tiltLoop(); },7000+Math.random()*9000); })();
function idleLoop(){
  setTimeout(function(){
    if(T&&!document.querySelector("body > .bub")){
      var cfg=T._cfg||{}, pool=[];
      (T.idleLines||[]).forEach(function(s){ pool.push([s,true]); });
      if(cfg.anniv&&cfg.anniv.days===0) annivLines().forEach(function(s){ pool.push([s,false]); pool.push([s,false]); });
      else if(cfg.anniv) pool.push([cfg.anniv.def,true]);
      (cfg.soon||[]).forEach(function(x){ pool.push([x.title+"까지 "+x.days+"일 남았어요.",true,"anniv"]); });
      (cfg.today||[]).forEach(function(x){ pool.push([(x.time?"오늘 "+x.time+"에 ":"오늘 ")+x.title+" 일정이 있어요. 확인해 볼까요?",false,"events"]); });
      if(pool.length){ var it=pool[Math.floor(Math.random()*pool.length)]; if(it[2]) helpSay(it[0],it[2]); else say(it[0],it[1]); }
    }
    idleLoop();
  },20000+Math.random()*40000);
}

/* 마우스: 그림 위에서만 잡히게 */
var over=false, down=null, dragging=false;
function through(){ return !(T&&T._cfg&&T._cfg.clickThrough===false); }
function setOver(v){ if(v===over) return; over=v; stage.classList.toggle("hand",v); api.petIgnore(!v); }
function hit(e){ return through()?!!zoneAt(e):true; }
window.addEventListener("mousemove",function(e){
  if(down){
    var dx=e.screenX-down.x, dy=e.screenY-down.y;
    if(!dragging&&!(T&&T.desk&&T.desk.lock)&&Math.abs(dx)+Math.abs(dy)>4){ dragging=true; api.petDragStart(); }
    if(dragging) api.petDrag(dx,dy);
    return;
  }
  if(e.target.closest&&e.target.closest(".bb-help")){ if(!over){ over=true; api.petIgnore(false); } return; }
  setOver(hit(e));
});
window.addEventListener("mousedown",function(e){ if(e.target.closest&&e.target.closest(".bb-help")) return; if(e.button!==0||!over) return; down={x:e.screenX,y:e.screenY,e:e}; dragging=false; });
window.addEventListener("mouseup",function(e){
  if(e.button!==0||!down) return;
  if(dragging) api.petDragEnd();
  else { var p=norm(e); react(zoneAt(e)||"face",p[2],p[3]); if(api.petTapped) api.petTapped(); }
  down=null; dragging=false; setOver(hit(e));
});
window.addEventListener("mouseleave",function(){ if(!down) setOver(false); });
window.addEventListener("contextmenu",function(e){ e.preventDefault(); if(over) api.petMenu(); });

api.onPetToken(render);
api.onPetPoke(function(){ var zs=Z.zonesFor(T||{}); react(zs[Math.floor(Math.random()*zs.length)]); });
api.onPetSay(function(t){ if(!T) return; Z.react(stage,T,"head"); var c=T._cfg||{}; if(!c.mute) Z.sound("bell",c.volume); if(t&&typeof t==="object") helpSay(t.line,t.view); else helpSay(t,"events"); });
/* 페어로 같이 떠 있을 때: 옆 캐릭터와 주고받는 대사 */
if(api.onPetLine) api.onPetLine(function(d){ if(!T||!d) return; clearTimeout(document.body._sayT); Array.prototype.forEach.call(document.querySelectorAll("body > .bub"),function(x){x.remove()}); Z.react(stage,T,"head"); say(d.text,false,"speech",d.ms,!!d.quiet); });
api.petToken().then(render);
idleLoop();
})();
