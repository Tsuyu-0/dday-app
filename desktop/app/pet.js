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
  stage.innerHTML=(t.desk&&t.desk.noShadow?'':'<div class="shadow"></div>')+'<div id="inner" style="transform:'+flip+'">'+inner+"</div>";
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
/* 알겠어 · 보기를 누른 알림은 숫자가 바뀌기 전까지(하루) 다시 안 띄워요 */
function seenKey(k){ return "dd-seen|"+k; }
function isSeen(k){ try{ return !!(k&&localStorage.getItem(seenKey(k))); }catch(e){ return false; } }
function markSeen(k){ if(!k) return; try{ localStorage.setItem(seenKey(k),String(Date.now()));
  for(var i=localStorage.length-1;i>=0;i--){ var kk=localStorage.key(i); if(kk&&kk.indexOf("dd-seen|")===0&&Date.now()-(+localStorage.getItem(kk)||0)>40*864e5) localStorage.removeItem(kk); } }catch(e){} }
/* 기념일 미리 알려주기: 하루에 한 번, 캐릭터가 자기 말풍선으로 "며칠 남았어" (안 누르고 넘기면 25분 뒤 다시) */
function tellSoon(){
  if(!T){ setTimeout(tellSoon,3000); return; }
  var cfg=T._cfg||{}, x=(cfg.soon||[]).filter(function(y){ return !isSeen("s|"+(y.id||y.title)+"|"+y.days+"|"+(cfg.day||"")); })[0];
  if(!x) return; if(document.querySelector("body > .bub")||dragging){ clearTimeout(tellSoon._t); tellSoon._t=setTimeout(tellSoon,9000); return; }
  var key="s|"+(x.id||x.title)+"|"+x.days+"|"+(cfg.day||""), text=x.text||(x.title+"까지 "+x.days+"일 남았어!");
  clearTimeout(document.body._sayT);
  var sz=stage.offsetHeight, bp=Z.bubPos(T,sz), sty=(T.bubble&&T.bubble!=="sfx"&&T.bubble!=="help")?T.bubble:"speech";
  var el=Z.bubble(document.body,text,sty,{bottom:8+sz-bp.fromTop+18+bp.dy,dx:bp.dx*(T.desk&&T.desk.flip?-1:1),clamp:true,maxWidth:Math.max(160,window.innerWidth-50),
    buttons:[["기념일 보기","anniv"],["알겠어","ok"]],onAct:function(a){ markSeen(key); if(a!=="ok") api.petOpen(a); setOver(false); }});
  var vc=T.babble&&T.babble!=="none"&&!cfg.mute; if(vc&&Z.typeOut){ try{ Z.typeOut(el.querySelector(".bt"),text,T.babble,cfg.voiceVol==null?.6:cfg.voiceVol,sty,{pitch:T.babblePitch||0,speed:T.babbleSpeed||1}); }catch(e){} }
  try{ Z.move&&Z.move(stage,"hop"); }catch(e){}
  setTimeout(function(){ if(el.parentNode) el.remove(); },15000);
}
setTimeout(tellSoon,6000); setInterval(tellSoon,25*60000);
function helpSay(text,view,key){
  if(!T||!text) return;
  clearTimeout(document.body._sayT); Array.prototype.forEach.call(document.querySelectorAll("body > .bub"),function(x){x.remove()});
  var sz=stage.offsetHeight, bp=Z.bubPos(T,sz);
  var el=Z.bubble(document.body,text,"help",{bottom:8+sz-bp.fromTop+18+bp.dy,dx:bp.dx*(T.desk&&T.desk.flip?-1:1),clamp:true,maxWidth:Math.max(160,window.innerWidth-50),
    buttons:[[VIEW_LB[view]||"열어 보기",view||"home"],["알겠어","ok"]],onAct:function(a){ markSeen(key); if(a!=="ok") api.petOpen(a); setOver(false); }});
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
  if(a.days===0) say(pick(annivLines(),"a"),false); else setTimeout(tellSoon,600);
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
      (cfg.today||[]).forEach(function(x){ var k="t|"+x.title+"|"+(x.time||"")+"|"+(cfg.day||""); if(!isSeen(k)) pool.push([(x.time?"오늘 "+x.time+"에 ":"오늘 ")+x.title+" 일정이 있어요. 확인해 볼까요?",false,"events",k]); });
      if(pool.length){ var it=pool[Math.floor(Math.random()*pool.length)]; if(it[2]) helpSay(it[0],it[2],it[3]); else say(it[0],it[1]); }
    }
    idleLoop();
  },20000+Math.random()*40000);
}

/* ---------- 놓으면 아래로 툭 떨어지기 (캐릭터 설정에서 끌 수 있어요) ---------- */
function dropFall(first){
  var on=!(T&&T.desk&&T.desk.noFall)&&api.petFall;
  var ok=on&&api.petFall(function(dist){ if(dist>260){ var L=["으아아~","으앗, 떨어진다!","꺄아~"]; say("!"+L[Math.floor(Math.random()*L.length)],false); } },
    function(dist){ if(dist>260) Hang.bump(4,true); Hang.land(); });
  if(!ok&&!first) Hang.land();
  return !!ok;
}
/* ---------- 들어 올리면 대롱대롱 매달리고, 벽에 부딪히면 "아야!" ---------- */
var Hang=(function(){
  var on=false, ang=0, av=0, tgt=0, pts=[], raf=0, bumpT=0;
  function el(){ return document.getElementById("inner"); }
  function loop(){ var e=el(); if(!e){ raf=0; return; }
    /* 진자처럼: 손이 움직이는 반대쪽으로 흔들렸다가 돌아와요 */
    var now=performance.now(); pts=pts.filter(function(p){ return now-p[2]<90; });
    var vx=pts.length>1?(pts[pts.length-1][0]-pts[0][0])/Math.max(16,now-pts[0][2]):0;
    tgt=on?Math.max(-38,Math.min(38,-vx*26)):0;
    av+=(tgt-ang)*.09; av*=.86; ang+=av;
    e.style.rotate=ang.toFixed(2)+"deg";
    if(on||Math.abs(ang)>.15||Math.abs(av)>.05) raf=requestAnimationFrame(loop); else { e.style.rotate=""; raf=0; }
  }
  function kick(){ if(!raf) raf=requestAnimationFrame(loop); }
  return {
    start:function(){ on=true; pts=[]; var e=el(); if(e){ e.style.transformOrigin="50% 10%"; e.style.transition="translate .18s, scale .18s"; e.style.translate="0 -6px"; e.style.scale="0.96 1.05"; }
      stage.classList.add("m-hang"); W.quiet(4000); kick(); },
    move:function(x,y){ pts.push([x,y,performance.now()]); kick(); },
    release:function(){ var now=performance.now(), a=pts.filter(function(p){ return now-p[2]<80; }); on=false; kick();
      if(a.length<2) return [0,0]; var p0=a[0], p1=a[a.length-1], dt=Math.max(16,p1[2]-p0[2]), sf=window.devicePixelRatio||1; return [(p1[0]-p0[0])/dt,(p1[1]-p0[1])/dt]; },
    land:function(){ on=false; stage.classList.remove("m-hang"); var e=el(); if(e){ e.style.translate=""; e.style.scale=""; setTimeout(function(){ if(!on) e.style.transformOrigin=""; },600); }
      stage.style.transition="scale .12s"; stage.style.scale="1.08 .9"; setTimeout(function(){ stage.style.transition="scale .25s cubic-bezier(.3,1.8,.5,1)"; stage.style.scale=""; },120); kick(); },
    /* 벽에 쿵: 납작해졌다가 "아야!" (1 왼쪽 2 오른쪽 3 위 4 아래) */
    bump:function(side,hard){ var now=Date.now(); if(now-bumpT<1300) return; bumpT=now;
      av+=(side===1?14:side===2?-14:0)*(hard?1.6:1);
      var e=el(); if(e){ var sx=side<=2?"0.82 1.08":"1.12 0.84"; e.animate([{scale:"1 1"},{scale:sx},{scale:"1.04 .97"},{scale:"1 1"}],{duration:420,easing:"ease-out"}); }
      var sz=stage.offsetWidth; if(Z.spawn) try{ Z.spawn(stage,side===1?sz*.15:side===2?sz*.85:sz*.5,side===3?sz*.1:sz*.3,"star",sz); }catch(er){}
      var c=T&&T._cfg||{}; if(!c.mute) Z.sound("wrap",(c.volume==null?.5:c.volume)*.7);
      var L=(T&&T.bumpLines||[]).filter(Boolean); if(!L.length) L=["아야!","으앗!","아야야…","쿵! 아파~","벽이다…!"];
      say("!"+L[Math.floor(Math.random()*L.length)],false); }
  };
})();

/* 마우스: 그림 위에서만 잡히게 */
var over=false, down=null, dragging=false;
function through(){ return !(T&&T._cfg&&T._cfg.clickThrough===false); }
function setOver(v){ if(v===over) return; over=v; stage.classList.toggle("hand",v); api.petIgnore(!v); }
function hit(e){ return through()?!!zoneAt(e):true; }
window.addEventListener("mousemove",function(e){
  if(down){
    var dx=e.screenX-down.x, dy=e.screenY-down.y;
    if(!dragging&&!(T&&T.desk&&T.desk.lock)&&Math.abs(dx)+Math.abs(dy)>4){ dragging=true; api.petDragStart(Math.max(0,(window.innerWidth-stage.offsetWidth)/2-4)); Hang.start(); }
    if(dragging){ var hw=api.petDrag(dx,dy); Hang.move(e.screenX,e.screenY); if(hw) Hang.bump(hw); }
    return;
  }
  if(e.target.closest&&e.target.closest(".bb-help")){ if(!over){ over=true; api.petIgnore(false); } return; }
  setOver(hit(e));
  if(over) rubTrack(e);
});

/* 쓰다듬기: 그림 위에서 마우스를 좌우로 슥슥 문지르면 하트가 뿅뿅 */
var rub={x:null,dir:0,flips:[],last:0,on:false,endT:null,heartT:0};
function rubTrack(e){
  if(!T||T.petOff) return;
  var now=Date.now(), x=e.clientX;
  if(rub.x==null||now-rub.last>350){ rub.x=x; rub.dir=0; rub.flips=[]; rub.last=now; return; }
  var dx=x-rub.x; rub.last=now;
  if(Math.abs(dx)<3) return;
  var d=dx>0?1:-1;
  if(rub.dir&&d!==rub.dir) rub.flips.push(now);
  rub.dir=d; rub.x=x;
  rub.flips=rub.flips.filter(function(t){ return now-t<1000; });
  if(rub.flips.length>=3){ petting(e); }
}
function petting(e){
  var now=Date.now(), size=stage.offsetWidth, p=norm(e);
  if(!rub.on){ rub.on=true; stage.classList.add("m-pet"); var c=T._cfg||{}; if(!c.mute) Z.sound("sparkle",c.volume*.6); }
  if(now-rub.heartT>140){ rub.heartT=now; Z.hearts(stage,p[2],Math.min(p[3],size*.45),size,1,{color:T.petColor,shape:T.petShape}); }
  clearTimeout(rub.endT);
  rub.endT=setTimeout(function(){
    rub.on=false; stage.classList.remove("m-pet"); rub.flips=[];
    Z.hearts(stage,size/2,size*.3,size,4);
    var pl=(T.petLines||[]).filter(Boolean); if(!pl.length) pl=["헤헤, 좋다~","간지러워!","더 쓰다듬어 줘","기분 좋아…"];
    say(pick(pl,"pet"),false);
    if(api.petPetted) api.petPetted();
  },450);
}
window.addEventListener("mousedown",function(e){ if(e.target.closest&&e.target.closest(".bb-help")) return; if(e.button!==0||!over) return; down={x:e.screenX,y:e.screenY,e:e}; dragging=false; });
window.addEventListener("mouseup",function(e){
  if(e.button!==0||!down) return;
  if(dragging){ var v=Hang.release(); if(api.petThrow&&Math.hypot(v[0],v[1])>.55) api.petThrow(v[0],v[1],function(h){ Hang.bump(h,true); },function(){ dropFall(); }); else if(!dropFall(true)){ api.petDragEnd(); Hang.land(); } }
  else { var p=norm(e); react(zoneAt(e)||"face",p[2],p[3]); if(api.petTapped) api.petTapped(); }
  down=null; dragging=false; setOver(hit(e));
});
window.addEventListener("mouseleave",function(){ if(!down) setOver(false); });
window.addEventListener("contextmenu",function(e){ e.preventDefault(); if(over) api.petMenu(); });

api.onPetToken(render);
/* 같이 떠 있는 친구들과 상호작용: 몸짓 · 바라보기 */
if(api.onPetAct) api.onPetAct(function(d){
  if(!T||!d) return; var size=stage.offsetWidth; W.quiet(d.hold||1800); if(d.face) W.face(d.face,d.hold||1800);
  if(d.lean!=null){ stage.style.transformOrigin="50% 100%"; stage.style.transition="rotate .45s ease"; stage.style.rotate=(d.lean*5)+"deg"; clearTimeout(stage._faceT); if(d.lean) stage._faceT=setTimeout(function(){ stage.style.rotate="0deg"; },d.hold||5000); }
  if(d.motion) Z.move(stage,d.motion);
  if(d.fx) Z.spawn(stage,size*(d.side>0?.75:d.side<0?.25:.5),size*.28,d.fx,size);
});
api.onPetPoke(function(){ var zs=Z.zonesFor(T||{}); react(zs[Math.floor(Math.random()*zs.length)]); });
api.onPetSay(function(t){ if(!T) return; Z.react(stage,T,"head"); var c=T._cfg||{}; if(!c.mute) Z.sound("bell",c.volume); if(t&&typeof t==="object") helpSay(t.line,t.view); else helpSay(t,"events"); });
/* 페어로 같이 떠 있을 때: 옆 캐릭터와 주고받는 대사 */
if(api.onPetLine) api.onPetLine(function(d){ if(!T||!d) return; W.quiet((d.ms||2000)+2500); clearTimeout(document.body._sayT); Array.prototype.forEach.call(document.querySelectorAll("body > .bub"),function(x){x.remove()}); if(d.motion) Z.move(stage,d.motion); else Z.react(stage,T,"head"); say(d.text,false,"speech",d.ms,!!d.quiet); if(d.ap&&api.nudge) api.nudge(d.ap); if(d.g!=null&&api.petLineDone) setTimeout(function(){ api.petLineDone(d.g,d.k); },(d.ms||1700)+350); });
api.petToken().then(render);
idleLoop();
/* ---------- 돌아다니기 (시메지처럼 바탕화면 아래를 통통 튀며 걸어요) ---------- */
var W=(function(){
  var walking=false, abort=false, quietUntil=0, hover=false, faceT=0;
  stage.addEventListener("pointerenter",function(){ hover=true; abort=true; });
  stage.addEventListener("pointerleave",function(){ hover=false; });
  function on(){ return !!(T&&T.desk&&T.desk.wander&&api.walkInfo&&!(T._cfg&&T._cfg.allHidden)); }
  /* 걷는 쪽을 보게: 안쪽 그림만 좌우로 (원래 [좌우 뒤집기] 설정과 겹치면 서로 상쇄) */
  function look(dir){ /* 좌우 반전은 하지 않아요 — 옆으로 이동만 */ }
  function face(dir,ms){ clearTimeout(faceT); look(dir); faceT=setTimeout(function(){ if(!walking) look(0); },ms||1500); }
  function busy(){ return dragging||hover||Date.now()<quietUntil||document.querySelector("body > .bub"); }
  function tick(){
    setTimeout(tick,5000+Math.random()*9000);
    if(!on()||walking||busy()||Math.random()<.3) return;
    api.walkInfo().then(function(I){
      var sf=I.sf, min=I.ax, max=I.ax+I.aw-I.w, cur=I.x;
      var go=function(target){ target=Math.max(min,Math.min(max,target)); if(Math.abs(target-cur)<40*sf) return; walk(I,target); };
      if(Math.random()<.35&&api.walkFriends) return api.walkFriends().then(function(fr){
        fr=(fr||[]).sort(function(a,b){ return Math.abs(a.cx-cur-I.w/2)-Math.abs(b.cx-cur-I.w/2); });
        if(!fr.length) return go(cur+(Math.random()<.5?-1:1)*(150+Math.random()*370)*sf);
        var side=fr[0].cx>cur+I.w/2?-1:1; go(fr[0].cx-I.w/2+side*(I.w*.55+20*sf));
      });
      go(cur+(Math.random()<.5?-1:1)*(150+Math.random()*370)*sf);
    }).catch(function(){});
  }
  function walk(I,target){
    walking=true; abort=false; var dir=target>I.x?1:-1, spd=(T.desk.wanderSpeed||1), sf=I.sf;
    var hopLen=40*sf*spd, hopMs=430/Math.sqrt(spd), dist=Math.abs(target-I.x), hops=Math.max(1,Math.round(dist/hopLen)), total=hops*hopMs, t0=performance.now();
    clearTimeout(faceT); look(dir); stage.style.transition="none";
    if(api.walkMove) api.walkMove(I.x,target,I.y,total); else api.walkSetX(target,I.y);
    (function frame(){
      if(abort||dragging){ if(api.walkStop) api.walkStop(); end(); return; }
      var el=performance.now()-t0; if(el>=total){ end(); return; }
      var ph=(el%hopMs)/hopMs, up=Math.sin(ph*Math.PI), sq=ph<.1?.9+ph:(ph>.9?1-(ph-.9):1);
      stage.style.translate="0 "+(-up*12)+"px"; stage.style.scale=(2-sq)+" "+sq;
      requestAnimationFrame(frame);
    })();
    function end(){ walking=false; stage.style.translate=""; stage.style.scale=""; faceT=setTimeout(function(){ look(0); },1600); api.walkDone(); }
  }
  setTimeout(tick,4000);
  return { quiet:function(ms){ quietUntil=Math.max(quietUntil,Date.now()+ms); abort=true; }, face:face };
})();
})();
