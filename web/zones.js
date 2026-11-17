/* 부위별 반응: 펫 창과 관리 창이 같이 씀 */
(function(g){
"use strict";
var Z={};
Z.ZALL=["all","캐릭터","#4f7cff","캐릭터를"];
Z.ZONES=[["head","머리","#5b9dff","머리를"],["face","얼굴","#ff6fa3","얼굴을"],["body","몸통","#3fc58a","몸통을"],["hand","팔","#f5a524","팔을"],["foot","다리","#9b7bff","다리를"],["ear","귀","#17b8c4","귀를"],["tail","꼬리","#ff7a45","꼬리를"]];
Z.MOTIONS=[["nod","끄덕"],["tilt","까딱까딱"],["hop","통통"],["bounce","통통통"],["jump","펄쩍"],["shake","도리도리"],["squash","찌그러짐"],["wobble","흔들"],["dance","씰룩씰룩"],["spin","빙글"],["shy","움찔"],["surprise","깜짝"],["none","가만히"]];
Z.MDUR={tilt:1250,bounce:1000,dance:1100,spin:800,jump:750,shy:800,surprise:700};
Z.FX=[["none","없음"],["heart","하트"],["hearts","하트 뿅뿅"],["star","별"],["sparkle","반짝"],["flower","꽃"],["note","음표"],["excl","느낌표"],["q","물음표"],["sweat","땀"],["tear","눈물"],["zzz","쿨쿨"],["anger","화남"]];
Z.FACES=[["head1","평소"],["head2","얼굴 2"],["head3","얼굴 3"],["head4","얼굴 4"]];
Z.SOUNDS=[["none","없음"],["click","딸깍"],["key","키보드"],["wrap","뽁뽁이"],["pencil","연필"],["page","책장"],["kalimba","칼림바"],["xylo","실로폰"],["glass","유리 딩"],["harp","하프"],["music","오르골"],["sparkle","별가루"],["custom","내 소리"]];
Z.SOUND_OLD={tok:"click",pop:"wrap",bubble:"music",squeak:"sparkle",chime:"glass",pen:"pencil",stamp:"key",sticker:"wrap",bell:"glass"};
Z.BUBBLES=[["speech","말풍선"],["memo","포스트잇"],["shout","놀람"],["thought","생각"],["imagine","상상"],["sfx","효과음 글씨"]];
Z.DEFAULT={head:{motion:"nod",fx:"heart",face:"head2",sound:"click",bubble:"speech"},face:{motion:"squash",fx:"sweat",face:"head2",sound:"wrap",bubble:"speech"},body:{motion:"hop",fx:"star",face:"head1",sound:"key",bubble:"speech"},hand:{motion:"wobble",fx:"sparkle",face:"head2",sound:"pencil",bubble:"speech"},foot:{motion:"hop",fx:"note",face:"head1",sound:"page",bubble:"speech"},ear:{motion:"none",fx:"anger",face:"head2",sound:"wrap",bubble:"shout"},tail:{motion:"none",fx:"heart",face:"head2",sound:"kalimba",bubble:"speech"},all:{motion:"squash",fx:"heart",face:"head1",sound:"click",bubble:"speech"}};
Z.get=function(t,k){ var z=(t.zones&&t.zones[k])||{}; var d=Z.DEFAULT[k]; var snd=z.sound||d.sound, ssrc=z.soundSrc||null; if(t.voice&&t.voice!=="mix"){ snd=t.voice; ssrc=t.voiceSrc||null; } snd=Z.SOUND_OLD[snd]||snd; if(snd==="custom"&&!ssrc) snd="none"; return {motion:z.motion||d.motion,fx:z.fx||d.fx,face:z.face||d.face,sound:snd,soundSrc:ssrc,bubble:(z.bubble==="sign"?"speech":z.bubble)||d.bubble,lines:Array.isArray(z.lines)?z.lines:[]}; };
Z.set=function(t,k,key,val){ t.zones=t.zones||{}; t.zones[k]=Object.assign({},Z.get(t,k),t.zones[k]||{}); t.zones[k][key]=val; };
Z.isCk=function(t){ return !!(t&&t.kind==="clicker"&&t.parts&&t.parts.head1&&t.parts.head1.src); };
Z.faceSrc=function(t,k){ var p=t.parts||{}; return p[k]&&p[k].src; };

var esc=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
/* 토큰 그림 (모든 얼굴을 겹쳐 두고 data-face로 바꿈) */
Z.PARTS=[["back","뒷머리"],["ear","귀"],["hand","팔·손"],["foot","다리·발"],["tail","꼬리"]];
Z.ckHTML=function(t){
  var p=t.parts, m=t.motion||{}, bm=(m.breathe===false?0:(m.breathMs||3400)), ba=((m.breathAmp==null?12:m.breathAmp)/8).toFixed(2), off=bm?"":' style="animation:none"';
  var pv=t.pivot||{}, org=function(k){ return pv[k]?"transform-origin:"+esc(pv[k])+";":""; };
  var L=function(k,cls){ var st=(bm?"":"animation:none;")+org(k); return p[k]&&p[k].src?'<img class="'+cls+' p-'+k+'" src="'+esc(p[k].src)+'" alt="" draggable="false"'+(st?' style="'+st+'"':"")+'>':""; };
  var faces=Z.FACES.map(function(f){ var s=Z.faceSrc(t,f[0]); return s?'<img class="fc f-'+f[0]+'" src="'+esc(s)+'" alt="" draggable="false">':""; }).join("");
  var ear=p.ear&&p.ear.src?'<img class="p-ear" src="'+esc(p.ear.src)+'" alt="" draggable="false"'+(org("ear")?' style="'+org("ear")+'"':"")+'>':"";
  var back=p.back&&p.back.src?'<img class="bk p-back" src="'+esc(p.back.src)+'" alt="" draggable="false"'+off+'>':"";
  return '<div class="ck" style="--bm:'+bm+'ms;--ba:'+ba+'%'+(pv.neck?';--nk:'+esc(pv.neck):'')+'">'+back+L("tail","bo")+L("foot","bo")+L("body","bo")+L("hand","bo")+'<div class="hd"'+off+'><div class="hm">'+faces+ear+"</div></div></div>";
};

/* 눌린 곳 지도 (200×200, 0 없음 1 머리 2 얼굴 3 몸) */
var N=200;
function load(src){ return new Promise(function(res){ if(!src) return res(null); var i=new Image(); i.onload=function(){res(i)}; i.onerror=function(){res(null)}; i.src=src; }); }
function alpha(im){
  if(!im) return null;
  var c=document.createElement("canvas"); c.width=c.height=N; var x=c.getContext("2d");
  var k=Math.min(N/im.naturalWidth,N/im.naturalHeight), w=im.naturalWidth*k, h=im.naturalHeight*k; x.drawImage(im,(N-w)/2,(N-h)/2,w,h);
  var d; try{ d=x.getImageData(0,0,N,N).data; }catch(e){ return null; }
  var a=new Uint8Array(N*N); for(var i=0;i<N*N;i++) a[i]=d[i*4+3]>16?1:0; return a;
}
function bbox(a){ var t=N,b=-1; for(var y=0;y<N;y++) for(var x=0;x<N;x++) if(a[y*N+x]){ if(y<t) t=y; if(y>b) b=y; break; } return b<0?null:{t:t,b:b}; }
/* 직접 칠한 부위 지도 (96×96) */
var PM=96;
Z.PM=PM;
Z.decodeMap=function(s){ try{ var bin=atob(s), a=new Uint8Array(bin.length); for(var i=0;i<bin.length;i++) a[i]=bin.charCodeAt(i); return a.length===PM*PM?a:null; }catch(e){ return null; } };
Z.encodeMap=function(a){ var s=""; for(var i=0;i<a.length;i++) s+=String.fromCharCode(a[i]); return btoa(s); };
Z.alphaMask=function(t){ var srcs=Z.isCk(t)?[t.parts.body&&t.parts.body.src,t.parts.head1.src]:[t.img&&t.img.src];
  return Promise.all(srcs.map(load)).then(function(ims){ var A=new Uint8Array(N*N); ims.forEach(function(im){ var a=alpha(im); if(a) for(var i=0;i<N*N;i++) if(a[i]) A[i]=1; }); return A; }); };
Z.autoMap=function(t){ var tt=Object.assign({},t); delete tt.zoneMap; return Z.build(tt).then(function(m){ var o=new Uint8Array(PM*PM); if(!m) return o; for(var y=0;y<PM;y++) for(var x=0;x<PM;x++) o[y*PM+x]=m[Math.floor((y+.5)*N/PM)*N+Math.floor((x+.5)*N/PM)]; return o; }); };
Z.build=function(t){
  if(t.zoneMap){ var pm=Z.decodeMap(t.zoneMap); if(pm) return Z.alphaMask(t).then(function(A){ var map=new Uint8Array(N*N); for(var y=0;y<N;y++) for(var x=0;x<N;x++){ var i=y*N+x; if(A[i]) map[i]=pm[Math.floor(y*PM/N)*PM+Math.floor(x*PM/N)]||3; } return map; }); }
  var split=typeof t.zoneSplit==="number"?t.zoneSplit:.5;
  if(Z.isCk(t)){
    var P=t.parts, ks=["head1","body","ear","hand","foot","tail","back"];
    return Promise.all(ks.map(function(k){ return load(P[k]&&P[k].src); })).then(function(r){
      var H=alpha(r[0]), B=alpha(r[1]), E=alpha(r[2]), HA=alpha(r[3]), F=alpha(r[4]), T=alpha(r[5]), BK=alpha(r[6]), map=new Uint8Array(N*N); if(!H) return null;
      var bb=bbox(H)||{t:0,b:N}, sy=bb.t+(bb.b-bb.t)*split;
      for(var y=0;y<N;y++) for(var x=0;x<N;x++){ var i=y*N+x;
        if(E&&E[i]) map[i]=6; else if(H[i]) map[i]=y<sy?1:2; else if(HA&&HA[i]) map[i]=4; else if(F&&F[i]) map[i]=5; else if(B&&B[i]) map[i]=3; else if(T&&T[i]) map[i]=7; else if(BK&&BK[i]) map[i]=1; }
      return map;
    });
  }
  var src=t.img&&t.img.src; if(!src) return Promise.resolve(null);
  return load(src).then(function(im){
    var A=alpha(im); if(!A) return null; var bb=bbox(A)||{t:0,b:N}, h=bb.b-bb.t;
    var r1=typeof t.zoneSplit==="number"?t.zoneSplit:.3, r2=typeof t.zoneSplit2==="number"?t.zoneSplit2:.6; if(r2<r1+.05) r2=Math.min(.98,r1+.05);
    var s1=bb.t+h*r1, s2=bb.t+h*r2, map=new Uint8Array(N*N);
    for(var y=0;y<N;y++) for(var x=0;x<N;x++){ var i=y*N+x; if(A[i]) map[i]=y<s1?1:y<s2?2:3; }
    return map;
  });
};
var KEYS=[null,"head","face","body","hand","foot","ear","tail","all"];
Z.KEYS=KEYS;
Z.zonesFor=function(t){ if(!Z.isCk(t)) return ["head","face","body"]; var p=t.parts||{}, L=["head","face","body"]; [["hand","hand"],["foot","foot"],["ear","ear"],["tail","tail"]].forEach(function(x){ if(p[x[0]]&&p[x[0]].src) L.push(x[1]); }); return L; };
Z.present=function(map){ var seen={}; if(map) for(var i=0;i<map.length;i++) if(map[i]) seen[map[i]]=1; return KEYS.filter(function(k,i){ return k&&seen[i]; }); };
/* fx,fy: 0~1 */
Z.at=function(map,fx,fy){
  if(!map) return fx>=0&&fy>=0&&fx<=1&&fy<=1?"face":null;
  var x=Math.round(fx*(N-1)), y=Math.round(fy*(N-1));
  for(var r=0;r<=4;r+=2) for(var dy=-r;dy<=r;dy+=2) for(var dx=-r;dx<=r;dx+=2){ var xx=x+dx, yy=y+dy; if(xx<0||yy<0||xx>=N||yy>=N) continue; var v=map[yy*N+xx]; if(v) return KEYS[v]; }
  return null;
};
Z.paint=function(map,canvas){
  canvas.width=canvas.height=N; var x=canvas.getContext("2d"), img=x.createImageData(N,N);
  var col=[null].concat(Z.ZONES.map(function(zz){ var n=parseInt(zz[2].slice(1),16); return [n>>16&255,n>>8&255,n&255]; }));
  if(map) for(var i=0;i<N*N;i++){ var c=col[map[i]]; if(!c) continue; img.data[i*4]=c[0]; img.data[i*4+1]=c[1]; img.data[i*4+2]=c[2]; img.data[i*4+3]=120; }
  x.putImageData(img,0,0);
};

/* 이펙트 */
var SVG={
  heart:'<svg viewBox="0 0 24 24"><path d="M12 21s-7.4-4.5-9.5-9.1C1 8.4 3.1 5 6.6 5c2 0 3.5 1.1 5.4 3 1.9-1.9 3.4-3 5.4-3 3.5 0 5.6 3.4 4.1 6.9C19.4 16.5 12 21 12 21z" fill="#ff6b8a"/></svg>',
  star:'<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" fill="#ffc53d"/></svg>',
  sparkle:'<svg viewBox="0 0 24 24"><path d="M12 1c.8 5.6 3.4 8.2 9 9-5.6.8-8.2 3.4-9 9-.8-5.6-3.4-8.2-9-9 5.6-.8 8.2-3.4 9-9z" fill="#7cc8ff"/></svg>',
  sweat:'<svg viewBox="0 0 24 24"><path d="M12 2.5S5.5 10.4 5.5 15a6.5 6.5 0 0013 0C18.5 10.4 12 2.5 12 2.5z" fill="#6fb4ff"/><ellipse cx="9.6" cy="14.6" rx="1.4" ry="2.4" fill="#fff" opacity=".7"/></svg>',
  note:'<svg viewBox="0 0 24 24"><path d="M9 18.5a3 3 0 11-2-2.8V4l12-2v13.5a3 3 0 11-2-2.8V5.4L9 6.8z" fill="#a98bff"/></svg>',
  q:'<svg viewBox="0 0 24 24"><text x="12" y="19" text-anchor="middle" font-size="20" font-weight="800" font-family="sans-serif" fill="#ffb03a" stroke="#fff" stroke-width="1.2" paint-order="stroke">?</text></svg>',
  flower:'<svg viewBox="0 0 24 24"><g fill="#ffb3d0"><circle cx="12" cy="6.5" r="3.6"/><circle cx="17.4" cy="10.4" r="3.6"/><circle cx="15.4" cy="16.6" r="3.6"/><circle cx="8.6" cy="16.6" r="3.6"/><circle cx="6.6" cy="10.4" r="3.6"/></g><circle cx="12" cy="12" r="2.8" fill="#ffd45c"/></svg>',
  excl:'<svg viewBox="0 0 24 24"><text x="12" y="20" text-anchor="middle" font-size="21" font-weight="900" font-family="sans-serif" fill="#ff6b6b" stroke="#fff" stroke-width="1.4" paint-order="stroke">!</text></svg>',
  tear:'<svg viewBox="0 0 24 24"><path d="M12 3s-5 6.2-5 10a5 5 0 0010 0c0-3.8-5-10-5-10z" fill="#9fd0ff"/><ellipse cx="10.3" cy="12.8" rx="1.1" ry="1.9" fill="#fff" opacity=".8"/></svg>',
  zzz:'<svg viewBox="0 0 24 24"><text x="4" y="21" font-size="12" font-weight="900" font-family="sans-serif" fill="#8a9bff" stroke="#fff" stroke-width="1" paint-order="stroke">Z</text><text x="11" y="13" font-size="9" font-weight="900" font-family="sans-serif" fill="#8a9bff" stroke="#fff" stroke-width="1" paint-order="stroke">z</text><text x="17" y="7" font-size="7" font-weight="900" font-family="sans-serif" fill="#8a9bff" stroke="#fff" stroke-width="1" paint-order="stroke">z</text></svg>',
  anger:'<svg viewBox="0 0 24 24"><path d="M9 3v4.5C9 8.3 8.3 9 7.5 9H3M15 3v4.5c0 .8.7 1.5 1.5 1.5H21M9 21v-4.5c0-.8-.7-1.5-1.5-1.5H3M15 21v-4.5c0-.8.7-1.5 1.5-1.5H21" stroke="#ff4d4f" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>'
};
Z.fxSVG=SVG;
Z.spawn=function(host,x,y,kind,size){
  if(kind==="hearts"){ Z.hearts(host,x,y,size,5); return; }
  if(!kind||kind==="none"||!SVG[kind]) return;
  Array.prototype.forEach.call(host.querySelectorAll(":scope > .fxp"),function(e){ e.remove(); });
  var s=Math.max(18,Math.round((size||160)*.16));
  var el=document.createElement("div"); el.className="fxp"; el.innerHTML=SVG[kind];
  el.style.cssText="left:"+(x-s/2)+"px;top:"+(y-s/2)+"px;width:"+s+"px;height:"+s+"px;--r:"+((Math.random()*2-1)*14).toFixed(0)+"deg";
  host.appendChild(el); setTimeout(function(){ el.remove(); },800);
};
/* 하트 뾰뾰뾰뿅: 작은 하트가 여러 개 흩어지며 올라가요 (쓰다듬기 · 하트 뿅뿅) */
Z.hearts=function(host,x,y,size,n){
  var s0=Math.max(12,Math.round((size||160)*.1)), cols=["#ff7fa8","#ffb3d0","#ff5c8a","#ffc6dc"];
  for(var i=0;i<(n||1);i++) (function(i){ setTimeout(function(){
    var s=Math.round(s0*(.7+Math.random()*.6)), el=document.createElement("div"); el.className="fxh";
    el.innerHTML='<svg viewBox="0 0 24 24"><path d="M12 21s-8.5-5.3-8.5-11.4A4.4 4.4 0 0112 7.5a4.4 4.4 0 018.5 2.1C20.5 15.7 12 21 12 21z" fill="'+cols[Math.floor(Math.random()*cols.length)]+'" stroke="#fff" stroke-width="1.6"/></svg>';
    el.style.cssText="left:"+(x-s/2+(Math.random()-.5)*s*1.6)+"px;top:"+(y-s/2+(Math.random()-.5)*s*.6)+"px;width:"+s+"px;height:"+s+"px;--dx:"+((Math.random()-.5)*s*2.4).toFixed(0)+"px;--r:"+((Math.random()*2-1)*22).toFixed(0)+"deg";
    host.appendChild(el); setTimeout(function(){ el.remove(); },1100);
  },i*90); })(i);
};
/* 부위 대사 + 공통 대사를 함께 섞어서 */
function mixLines(zl,cl){ zl=(zl||[]).filter(Boolean); cl=(cl||[]).filter(function(s){ return s&&zl.indexOf(s)<0; });
  return zl.concat(cl); }
/* 반응 하나: 표정·움직임 적용, 고를 대사 목록 돌려줌 */
Z.react=function(stage,t,zone){
  var z=Z.get(t,zone||"face");
  var face=z.face; if(face!=="head1"&&!Z.faceSrc(t,face)) face=Z.faceSrc(t,"head2")?"head2":"head1";
  stage.setAttribute("data-face",face); stage.removeAttribute("data-zone"); void stage.offsetWidth; stage.setAttribute("data-zone",zone||"face");
  Z.MOTIONS.forEach(function(m){ stage.classList.remove("m-"+m[0]); });
  void stage.offsetWidth;
  if(z.motion!=="none") stage.classList.add("m-"+z.motion);
  clearTimeout(stage._zt); stage._zt=setTimeout(function(){ stage.removeAttribute("data-face"); stage.removeAttribute("data-zone"); Z.MOTIONS.forEach(function(m){ stage.classList.remove("m-"+m[0]); }); },(Z.MDUR&&Z.MDUR[z.motion])||700);
  return {zone:zone,fx:t.fxOff?"none":z.fx,sound:z.sound,soundSrc:z.soundSrc,bubble:z.bubble,lines:mixLines(z.lines,t.lines)};
};
/* 몸짓만 (상호작용용) */
Z.move=function(stage,motion){
  if(!motion||motion==="none") return;
  Z.MOTIONS.forEach(function(m){ stage.classList.remove("m-"+m[0]); }); void stage.offsetWidth; stage.classList.add("m-"+motion);
  clearTimeout(stage._mt); stage._mt=setTimeout(function(){ stage.classList.remove("m-"+motion); },(Z.MDUR&&Z.MDUR[motion])||700);
};
/* 말풍선 (웹툰 느낌) */
Z.parseLine=function(s,def){
  s=String(s==null?"":s).trim();
  if(s.charAt(0)==="!") return {style:"shout",text:s.slice(1).trim()};
  if(s.charAt(0)==="~") return {style:"imagine",text:s.slice(1).trim()};
  if(s.charAt(0)==="*") return {style:"sfx",text:s.slice(1).trim()};
  if(s.charAt(0)==="("){ var t=s.slice(1); if(t.slice(-1)===")") t=t.slice(0,-1); return {style:"thought",text:t.trim()}; }
  return {style:(def&&def!=="sign")?def:"speech",text:s,auto:true};
};
Z.composeLine=function(style,text){ text=String(text==null?"":text).trim(); if(style==="shout") return "!"+text; if(style==="imagine") return "~"+text; if(style==="thought") return "("+text+")"; if(style==="sfx") return "*"+text; return text; };
var SVGNS="http://www.w3.org/2000/svg";
function f1(n){ return Math.round(n*10)/10; }
var BID=0;
function cloudD(cx,cy,rx,ry,n,bulge){ var pts=[],i; for(i=0;i<n;i++){ var a=-Math.PI/2+i*2*Math.PI/n; pts.push([cx+Math.cos(a)*rx,cy+Math.sin(a)*ry]); }
  var d="M"+f1(pts[0][0])+","+f1(pts[0][1]); for(i=0;i<n;i++){ var p=pts[i],q=pts[(i+1)%n],r=Math.hypot(q[0]-p[0],q[1]-p[1])*bulge; d+=" A"+f1(r)+","+f1(r)+" 0 0 1 "+f1(q[0])+","+f1(q[1]); } return d+" Z"; }
function burstD(cx,cy,rx,ry,n,o,inn){ var d=""; for(var i=0;i<n*2;i++){ var a=-Math.PI/2+i*Math.PI/n,k=i%2?inn:o; d+=(i?" L":"M")+f1(cx+Math.cos(a)*rx*k)+","+f1(cy+Math.sin(a)*ry*k); } return d+" Z"; }
function rrD(w,h,r){ return "M"+r+",0 H"+f1(w-r)+" Q"+w+",0 "+w+","+r+" V"+f1(h-r)+" Q"+w+","+h+" "+f1(w-r)+","+h+" H"+r+" Q0,"+h+" 0,"+f1(h-r)+" V"+r+" Q0,0 "+r+",0 Z"; }
/* 기본·생각: 테두리 없이 그림자 / 놀람: 먹선 가시 / 상상: 동글 점선 타원 */
function bubbleSVG(style,w,h){
  var id="bs"+(++BID), cx=w/2;
  var defs='<defs><filter id="'+id+'" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#14223a" flood-opacity=".2"/></filter></defs>', sh=' filter="url(#'+id+')"';
  if(style==="shout") return defs+'<g class="soft"'+sh+'><path d="'+burstD(cx,h/2,w/2+18,h/2+16,13,1.08,.86)+'"/></g>';
  if(style==="thought") return defs+'<g class="soft"'+sh+'><path d="'+rrD(w,h,Math.min(h/2,18))+'"/><circle cx="'+f1(cx-6)+'" cy="'+f1(h+8)+'" r="4.6"/><circle cx="'+f1(cx-13)+'" cy="'+f1(h+16)+'" r="3.2"/><circle cx="'+f1(cx-18)+'" cy="'+f1(h+23)+'" r="2"/></g>';
  if(style==="imagine") return defs+'<path class="dot"'+sh+' d="'+rrD(w,h,Math.min(h/2,14))+'"/>';
  if(style==="memo") return defs+'<g><rect class="paper"'+sh+' x="0" y="0" width="'+w+'" height="'+h+'" rx="2"/><path class="fold" d="M'+f1(w-14)+','+h+' L'+w+','+f1(h-14)+' L'+w+','+h+' Z"/><rect class="tape" x="'+f1(cx-24)+'" y="-8" width="48" height="15" rx="1.5" transform="rotate(-4 '+f1(cx)+' 0)"/></g>';
  if(style==="help") return defs+'<g><rect class="paper"'+sh+' x="0" y="0" width="'+w+'" height="'+h+'" rx="2"/><path class="fold" d="M'+f1(w-16)+','+h+' L'+w+','+f1(h-16)+' L'+w+','+h+' Z"/><rect class="tape" x="'+f1(cx-26)+'" y="-9" width="52" height="16" rx="1.5" transform="rotate(3 '+f1(cx)+' 0)"/></g>';
  return defs+'<g class="soft"'+sh+'><path d="'+rrD(w,h,Math.min(h/2,18))+'"/><path d="M'+f1(cx-9)+','+f1(h-2)+' L'+f1(cx-2)+','+f1(h+10)+' Q'+f1(cx)+','+f1(h+12)+' '+f1(cx+2)+','+f1(h+10)+' L'+f1(cx+9)+','+f1(h-2)+' Z"/></g>';
}
Z.bubble=function(host,text,style,pos,idle){
  style=style||"speech";
  var el=document.createElement("div"); el.className="bub bb-"+style+(idle?" idle":"");
  var sp=document.createElement("span"); sp.className="bt"; sp.textContent=text; el.appendChild(sp);
  /* 효과음 글씨: 풍선 없이 만화 효과음처럼 글자가 하나씩 튀어나와 위로 떠올라요 */
  if(style==="sfx"){
    var SC=["#ff5c8a","#ff8a3d","#4f7cff","#9b6bff","#22b07d","#ffb020"];
    el.style.setProperty("--sfx",SC[Math.floor(Math.random()*SC.length)]); el.style.setProperty("--rot",(Math.random()*14-7).toFixed(1)+"deg");
    sp.textContent=""; Array.from(String(text)).forEach(function(ch,i){ var c=document.createElement("span"); c.className="ch"; c.textContent=ch; c.style.setProperty("--i",i); c.style.setProperty("--wob",((i%2?1:-1)*(2+Math.random()*4)).toFixed(1)+"deg"); sp.appendChild(c); });
    if(pos&&pos.bottom!=null) el.style.bottom=(pos.bottom-14)+"px"; if(pos&&pos.top!=null) el.style.top=pos.top+"px";
    if(pos&&pos.maxWidth) sp.style.maxWidth=pos.maxWidth+"px";
    host.appendChild(el);
    if(pos&&(pos.dx||pos.clamp)){ var hw0=host.clientWidth, w0=el.offsetWidth, cx0=hw0/2+(pos.dx||0); if(pos.clamp) cx0=Math.max(w0/2+6,Math.min(hw0-w0/2-6,cx0)); el.style.left=cx0+"px"; }
    return el;
  }
  if(style==="memo"||style==="help"){ var MC=["#fff3b0","#ffd9e4","#d6f2e4","#dce8ff"]; el.style.setProperty("--memo",MC[Math.floor(Math.random()*MC.length)]); el.style.setProperty("--rot",(Math.random()*6-3).toFixed(1)+"deg"); }
  if(style==="help"&&pos&&pos.buttons&&pos.buttons.length){ var bw=document.createElement("span"); bw.className="hbtns";
    pos.buttons.forEach(function(b){ var x=document.createElement("button"); x.textContent=b[0]; x.addEventListener("click",function(ev){ ev.stopPropagation(); el.remove(); if(pos.onAct) pos.onAct(b[1]); }); bw.appendChild(x); }); el.appendChild(bw); }
  if(pos&&pos.bottom!=null) el.style.bottom=pos.bottom+"px"; if(pos&&pos.top!=null) el.style.top=pos.top+"px";
  if(pos&&pos.maxWidth) sp.style.maxWidth=pos.maxWidth+"px";
  host.appendChild(el);
  var w=el.offsetWidth, h=el.offsetHeight, M=44;
  if(pos&&pos.fitTop!=null&&pos.bottom!=null&&el.offsetTop<pos.fitTop){ el.style.bottom=Math.max(2,pos.bottom-(pos.fitTop-el.offsetTop))+"px"; }
  if(pos&&(pos.dx||pos.clamp)){ var hw=host.clientWidth, cx=hw/2+(pos.dx||0);
    if(pos.clamp) cx=Math.max(w/2+6,Math.min(hw-w/2-6,cx)); el.style.left=cx+"px"; }
  var svg=document.createElementNS(SVGNS,"svg"); svg.setAttribute("class","bbg"); svg.setAttribute("width",w+M*2); svg.setAttribute("height",h+M*2); svg.setAttribute("viewBox",(-M)+" "+(-M)+" "+(w+M*2)+" "+(h+M*2));
  svg.style.left=(-M)+"px"; svg.style.top=(-M)+"px";
  svg.innerHTML=bubbleSVG(style,w,h);
  el.insertBefore(svg,sp);
  if(pos&&pos.voice&&style!=="help") Z.typeOut(sp,text,pos.voice.type,pos.voice.vol*((style==="thought"||style==="imagine")?.45:1),style,pos.voice);
  return el;
};
/* 말풍선 자리: 그림 맨 위 + 캐릭터별로 옮긴 만큼 */
Z._top={};
function topKey(t){ var p=t.parts||{}, s=Z.isCk(t)?Object.keys(p).map(function(k){ return k+(p[k]&&p[k].src?p[k].src.length:0); }).join(","):(t.img&&t.img.src?t.img.src.length:0); return t.id+"|"+s; }
Z.topFrac=function(t){
  var key=topKey(t); if(Z._top[key]!=null) return Promise.resolve(Z._top[key]);
  var srcs=Z.isCk(t)?Object.keys(t.parts||{}).filter(function(k){ return !/^head[234]$/.test(k)&&t.parts[k]&&t.parts[k].src; }).map(function(k){ return t.parts[k].src; }):[t.img&&t.img.src];
  return Promise.all(srcs.map(load)).then(function(ims){ var top=1; ims.forEach(function(im){ var a=alpha(im), b=a&&bbox(a); if(b) top=Math.min(top,b.t/N); }); if(top>=1) top=0; Z._top[key]=top; return top; });
};
Z.bubPos=function(t,size){ var bp=t.bubblePos||{}, top=Z._top[topKey(t)]; if(top==null) top=0;
  return { fromTop:top*size, dy:(bp.y||0)/100*size, dx:(bp.x||0)/100*size }; };
/* 대사 한 줄(// 로 나눈 것까지) 차례로 */
Z.say=function(host,line,def,pos,ms,idle){
  clearTimeout(host._sayT); Array.prototype.forEach.call(host.querySelectorAll(":scope > .bub"),function(x){x.remove()});
  if(!line) return;
  var parts=String(line).split("//").map(function(s){return s.trim()}).filter(Boolean), k=0;
  (function next(){
    Array.prototype.forEach.call(host.querySelectorAll(":scope > .bub"),function(x){x.remove()});
    if(k>=parts.length) return;
    var p=Z.parseLine(parts[k++],def); if(!p.text){ next(); return; }
    var dur=Math.max(ms||1500,800+p.text.length*95), bel=Z.bubble(host,p.text,p.style,pos,idle);
    if(p.style==="sfx"&&bel) bel.style.setProperty("--sfxms",(dur/1000+.1).toFixed(2)+"s");
    // 말이 길어서 창 위로 넘치면 글자를 조금씩 줄여서 다 보이게
    if(bel&&pos&&pos.clamp&&p.style!=="sfx"){ var bt=bel.querySelector(".bt"), fs=bt?parseFloat(getComputedStyle(bt).fontSize):0, guard=0;
      while(bt&&bel.getBoundingClientRect().top<2&&fs>10&&guard++<8){ fs-=1; bt.style.fontSize=fs+"px"; bt.style.lineHeight="1.35"; } }
    host._sayT=setTimeout(next,dur);
  })();
};

/* 소리: 파일 없이 바로 만들어요 */
var AC=null; Z._resetAC=function(){ AC=null; };
function ac(){ if(!AC){ try{ AC=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return null; } } if(AC.state==="suspended") AC.resume(); return AC; }
function tone(c,out,type,f0,f1,t0,dur,peak){
  var o=c.createOscillator(), g=c.createGain(); o.type=type;
  o.frequency.setValueAtTime(f0,t0); if(f1) o.frequency.exponentialRampToValueAtTime(f1,t0+dur*.8);
  g.gain.setValueAtTime(0.0001,t0); g.gain.exponentialRampToValueAtTime(peak,t0+.006); g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
  o.connect(g); g.connect(out); o.start(t0); o.stop(t0+dur+.02);
}
var NB=null;
function noise(c){ if(NB&&NB.sampleRate===c.sampleRate) return NB; var n=c.sampleRate*1, b=c.createBuffer(1,n,c.sampleRate), d=b.getChannelData(0); for(var i=0;i<n;i++) d[i]=Math.random()*2-1; NB=b; return b; }
function nz(c,out,t0,dur,peak,type,f0,f1,q){
  var s=c.createBufferSource(); s.buffer=noise(c); var f=c.createBiquadFilter(); f.type=type||"bandpass"; f.Q.value=q||1;
  f.frequency.setValueAtTime(f0,t0); if(f1) f.frequency.exponentialRampToValueAtTime(f1,t0+dur);
  var g=c.createGain(); g.gain.setValueAtTime(0.0001,t0); g.gain.exponentialRampToValueAtTime(peak,t0+Math.min(.02,dur*.3)); g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
  s.connect(f); f.connect(g); g.connect(out); s.start(t0,Math.random()*.5); s.stop(t0+dur+.02);
}
function bellNote(c,out,f,t0,dur,peak){ tone(c,out,"sine",f,0,t0,dur,peak); tone(c,out,"sine",f*3.01,0,t0,dur*.35,peak*.22); tone(c,out,"sine",f*5.2,0,t0,dur*.15,peak*.08); }
var MB=[1046.5,1318.5,1568,2093,1975.5,1568,1318.5,1174.7,1318.5,1568,1760,1568], mbi=0;
var AUD={};
Z.sound=function(kind,vol,src){
  if(!kind||kind==="none") return;
  var v=vol==null?.5:vol; if(v<=0) return;
  if(kind==="custom"){ if(!src) return; try{ var a=AUD[src]||(AUD[src]=new Audio(src)); var p=a.cloneNode(); p.volume=Math.min(1,v); p.play().catch(function(){}); }catch(e){} return; }
  var c=ac(); if(!c) return;
  var out=c.createGain(); out.gain.value=v*.9; out.connect(c.destination);
  var t=c.currentTime+.005, j=1+(Math.random()*.08-.04);
  var PENTA=[1046.5,1174.7,1318.5,1568,1760,2093];
  var pk=function(a){ return a[Math.floor(Math.random()*a.length)]; };
  if(kind==="click"){ nz(c,out,t,.012,.6,"highpass",3500,0,.7); tone(c,out,"triangle",2900*j,0,t,.012,.12); nz(c,out,t+.075,.01,.32,"highpass",3000,0,.7); }
  else if(kind==="key"){ nz(c,out,t,.018,.7,"bandpass",2600*j,0,1.2); tone(c,out,"sine",190*j,120,t,.05,.45); nz(c,out,t+.085,.014,.3,"bandpass",2000*j,0,1.2); tone(c,out,"sine",160*j,0,t+.085,.03,.15); }
  else if(kind==="wrap"){ var np=Math.random()<.35?2:1; for(var w=0;w<np;w++){ var tw=t+w*.07; nz(c,out,tw,.035,.85,"bandpass",(1100+Math.random()*500),0,2.2); tone(c,out,"sine",900*j,260,tw,.025,.25); } }
  else if(kind==="pencil"){ for(var s2=0;s2<2;s2++){ var ts=t+s2*.11; nz(c,out,ts,.09,.32,"bandpass",3800*j,4600,1.6); nz(c,out,ts,.09,.12,"highpass",6000,0,.6); } }
  else if(kind==="page"){ nz(c,out,t,.3,.45,"bandpass",600*j,2600*j,.8); nz(c,out,t+.05,.22,.15,"highpass",3000,0,.5); nz(c,out,t+.24,.06,.25,"lowpass",1200,0,.7); }
  else if(kind==="kalimba"){ var f=pk([784,880,1046.5,1174.7,1318.5]); tone(c,out,"sine",f,0,t,.7,.42); tone(c,out,"triangle",f*2,0,t,.12,.08); tone(c,out,"sine",f*5.4,0,t,.06,.04); }
  else if(kind==="xylo"){ var f2=pk(PENTA); tone(c,out,"triangle",f2,0,t,.32,.42); tone(c,out,"sine",f2*4,0,t,.05,.08); }
  else if(kind==="glass"){ var f3=pk([1568,1760,2093]); tone(c,out,"sine",f3,0,t,1.4,.26); tone(c,out,"sine",f3*2.76,0,t,.6,.06); tone(c,out,"sine",f3*1.5,0,t+.01,.9,.05); }
  else if(kind==="harp"){ var base=pk([523.3,587.3,659.3]); [1,1.25,1.5,2].forEach(function(r,i){ tone(c,out,"triangle",base*r,0,t+i*.045,.55,.2); tone(c,out,"sine",base*r*2,0,t+i*.045,.25,.05); }); }
  else if(kind==="music"){ bellNote(c,out,MB[mbi%MB.length],t,.9,.34); mbi++; }
  else if(kind==="sparkle"){ var ns=[2637,2349,2093,1760,1568]; for(var q=0;q<5;q++) tone(c,out,"sine",ns[q]*(1+Math.random()*.01),0,t+q*.05,.35,.12*(1-q*.12)); }
  else if(kind==="fanfare"){ [1046.5,1318.5,1568,2093].forEach(function(f,i){ bellNote(c,out,f,t+i*.13,1.0,.3); }); }
  else if(kind==="bell"){ bellNote(c,out,2093*j,t,1.3,.3); }
  else if(Z.SOUND_OLD[kind]) Z.sound(Z.SOUND_OLD[kind],vol);
};
/* 웅얼 말소리 (동물 마을 같은 말투) */
Z.VOICES=[["none","없음"],["high","높은 톤"],["mid","중간 톤"],["low","낮은 톤"],["whisper","속삭임"],["round","통통"],["mono","단조 삑"],["robot","로봇"],["beep","삐빅"],["chip","8비트"],["radio","무전기"],["deep","낮은 기계음"],["typer","타자기"]];
var VF=[[800,1200],[600,1800],[800,1300],[600,1800],[600,1000],[500,1900],[600,1100],[500,1900],[450,800],[750,1150],[600,1700],[450,1700],[450,850],[350,800],[550,1000],[450,1700],[300,1900],[350,850],[350,1300],[330,1800],[300,2200]];
var VP={high:{b:440,k:1.15,o:"triangle",g:.62},mid:{b:300,k:1,o:"square",g:.42},low:{b:185,k:.9,o:"square",g:.4},whisper:{b:250,k:1,o:"sine",g:.17,soft:true},round:{b:350,k:1.05,o:"triangle",g:.7},
  /* 기계음: 글자마다 같은 높이로 또각또각 (모음 색은 안 섞어요) */
  mono:{mech:1,b:520,o:"square",g:.13,d:.038,mono:1},
  robot:{mech:1,b:150,o:"square",g:.08,d:.07,mono:1,ring:68,lp:2400},
  beep:{mech:1,b:880,o:"sine",g:.17,d:.05,alt:1},
  chip:{mech:1,b:440,o:"pulse",g:.55,d:.045,arp:1},
  radio:{mech:1,b:230,o:"sawtooth",g:.6,d:.065,band:1500,crackle:1},
  deep:{mech:1,b:92,o:"sawtooth",g:.14,d:.085,mono:1,lp:700},
  typer:{mech:1,b:1800,o:"click",g:.8,d:.03,mono:1}};
var PULSE=null;
function pulseWave(c){ if(PULSE&&PULSE.ctx===c) return PULSE.w; var n=32, re=new Float32Array(n), im=new Float32Array(n); for(var i=1;i<n;i++) im[i]=2/(i*Math.PI)*Math.sin(i*Math.PI*.125); var w=c.createPeriodicWave(re,im); PULSE={ctx:c,w:w}; return w; }
function mechBlip(c,out,f0,t0,dur,vp,loud){
  var env=c.createGain(), head=env, pk=vp.g*(loud?1.3:1);
  if(vp.o==="click"){ // 타자기: 짧은 딸깍 + 아주 작은 쇳소리
    var s=c.createBufferSource(); s.buffer=noise(c); var hp=c.createBiquadFilter(); hp.type="bandpass"; hp.frequency.value=f0*(.9+Math.random()*.25); hp.Q.value=1.2; s.connect(hp); hp.connect(env);
    var tk=c.createOscillator(), tg=c.createGain(); tk.type="triangle"; tk.frequency.value=f0*.5; tg.gain.value=.25; tk.connect(tg); tg.connect(env); tk.start(t0); tk.stop(t0+dur);
    env.gain.setValueAtTime(pk,t0); env.gain.exponentialRampToValueAtTime(0.0001,t0+dur); env.connect(out); s.start(t0,Math.random()*.5); s.stop(t0+dur+.01); return; }
  var o=c.createOscillator(); if(vp.o==="pulse") o.setPeriodicWave(pulseWave(c)); else o.type=vp.o; o.frequency.setValueAtTime(f0,t0);
  var node=o;
  if(vp.lp){ var lp=c.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=vp.lp; lp.Q.value=4; node.connect(lp); node=lp; }
  if(vp.band){ var bp=c.createBiquadFilter(); bp.type="bandpass"; bp.frequency.value=vp.band; bp.Q.value=1.6; var ws=c.createWaveShaper(), cv=new Float32Array(256); for(var i=0;i<256;i++){ var x=i/128-1; cv[i]=Math.tanh(x*3); } ws.curve=cv; node.connect(ws); ws.connect(bp); node=bp; pk*=1.5; }
  if(vp.ring){ var rg=c.createGain(); rg.gain.value=0; var lfo=c.createOscillator(); lfo.frequency.value=vp.ring; lfo.type="square"; lfo.connect(rg.gain); node.connect(rg); node=rg; lfo.start(t0); lfo.stop(t0+dur+.02); pk*=1.4; }
  node.connect(env);
  if(vp.crackle){ var ns=c.createBufferSource(); ns.buffer=noise(c); var nf=c.createBiquadFilter(); nf.type="bandpass"; nf.frequency.value=2500; nf.Q.value=.7; var ng=c.createGain(); ng.gain.value=.12; ns.connect(nf); nf.connect(ng); ng.connect(env); ns.start(t0,Math.random()*.5); ns.stop(t0+dur+.01); }
  env.gain.setValueAtTime(0.0001,t0); env.gain.exponentialRampToValueAtTime(pk,t0+.004); env.gain.setValueAtTime(pk,t0+dur*.7); env.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
  env.connect(out); o.start(t0); o.stop(t0+dur+.02);
}
function hsh(s){ var h=2166136261; for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function sylInfo(ch){ var c=ch.charCodeAt(0);
  if(c>=0xAC00&&c<=0xD7A3){ var o=c-0xAC00, jung=Math.floor((o%588)/28), jong=o%28; return {f:VF[jung],jong:jong>0}; }
  var m={a:0,e:5,i:20,o:8,u:13}; var l=ch.toLowerCase(); if(m[l]!=null) return {f:VF[m[l]],jong:false};
  if(/[a-z0-9ㄱ-ㅎㅏ-ㅣ]/i.test(ch)) return {f:[500,1500],jong:false}; return null; }
function blip(c,out,info,f0,t0,dur,vp,loud){
  var F1=info.f[0]*vp.k, F2=info.f[1]*vp.k, src, env=c.createGain(), mix=c.createGain();
  var tail=null;
  if(vp.o==="noise"){ src=c.createBufferSource(); src.buffer=noise(c);
    // 속삭임: 날카로운 고음을 깎아 부드러운 숨소리로
    var hp=c.createBiquadFilter(); hp.type="highpass"; hp.frequency.value=350; var lp=c.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=2800; lp.Q.value=.3;
    src.connect(hp); hp.connect(lp); tail=lp;
    var hum=c.createOscillator(), hg=c.createGain(); hum.type="sine"; hum.frequency.setValueAtTime(f0||240,t0); hg.gain.value=.05; hum.connect(hg); hg.connect(mix); hum.start(t0); hum.stop(t0+dur+.03); }
  else { src=c.createOscillator(); src.type=vp.o; src.frequency.setValueAtTime(f0,t0); if(vp===VP.round) src.frequency.linearRampToValueAtTime(f0*1.18,t0+dur); else src.frequency.linearRampToValueAtTime(f0*.96,t0+dur); }
  if(vp.soft){ // 속삭임: 부드러운 사인 + 아주 작은 낮은 숨결 (쇳소리 없이)
    var bs=c.createBufferSource(); bs.buffer=noise(c); var blp=c.createBiquadFilter(); blp.type="lowpass"; blp.frequency.value=1400; blp.Q.value=.2; var bg=c.createGain(); bg.gain.value=.05;
    bs.connect(blp); blp.connect(bg); bg.connect(mix); bs.start(t0,Math.random()*.5); bs.stop(t0+dur+.03);
    var smooth=c.createBiquadFilter(); smooth.type="lowpass"; smooth.frequency.value=1600; src.connect(smooth); tail=smooth; }
  [[F1,4,1],[F2,5,.6]].forEach(function(fm){ var b=c.createBiquadFilter(); b.type="bandpass"; b.frequency.value=fm[0]; b.Q.value=(vp.o==="noise"||vp.soft)?2:fm[1]; var g=c.createGain(); g.gain.value=fm[2]; (tail||src).connect(b); b.connect(g); g.connect(mix); });
  if(tail){ var air=c.createGain(); air.gain.value=.12; tail.connect(air); air.connect(mix); }
  if(vp.o!=="noise"){ var dry=c.createGain(); dry.gain.value=vp.soft?.55:vp.o==="triangle"?.35:.12; (tail||src).connect(dry); dry.connect(mix); }
  var pk=vp.g*(loud?1.35:1);
  env.gain.setValueAtTime(0.0001,t0); env.gain.exponentialRampToValueAtTime(pk,t0+((vp.o==="noise"||vp.soft)?.022:.008)); env.gain.setValueAtTime(pk,t0+dur*.55); env.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
  mix.connect(env); env.connect(out); if(src.start){ src.start(t0,vp.o==="noise"?Math.random()*.5:0); src.stop(t0+dur+.02); }
}
/* 글자를 하나씩 보여 주며 말소리 */
Z.typeOut=function(sp,text,voice,vol,style,opt){
  opt=opt||{}; var pitch=opt.pitch||0, spd=opt.speed||1;
  var chars=Array.from(text), vp=VP[voice], c=(vp&&vol>0)?ac():null, out=null;
  if(c){ out=c.createGain(); out.gain.value=Math.min(1,vol)*.55; out.connect(c.destination); }
  var q=/\?\s*$/.test(text), ex=/!\s*$/.test(text)||style==="shout", seed=hsh(text), n=chars.length, k=0, sylN=0, total=chars.filter(function(ch){return sylInfo(ch)}).length;
  function esc2(s){ return s.replace(/[&<>]/g,function(m){return {"&":"&amp;","<":"&lt;",">":"&gt;"}[m]}); }
  function paint(){ sp.innerHTML=esc2(chars.slice(0,k).join(""))+'<span class="tw">'+esc2(chars.slice(k).join(""))+"</span>"; }
  paint();
  setTimeout(function step0(){ step(); },opt.delay||0);
  function step(){
    if((!opt.free&&!sp.isConnected)||k>=n){ sp.textContent=text; return; }
    var ch=chars[k++]; paint(); var wait=44/spd;
    var info=sylInfo(ch);
    if(info&&c&&vp){ var SC=[0,2,4,5,7,9,7,4], semi=SC[((seed>>>(sylN%24))+sylN*3)&7]-3, pos=total>1?sylN/(total-1):0; semi+=-1.5*pos; if(q&&sylN>=total-2) semi+=sylN===total-1?7:4; if(ex) semi+=2;
      if(vp.mech){ if(vp.mono) semi=(q&&sylN===total-1)?4:0; else if(vp.alt) semi=sylN%2?7:0; else if(vp.arp) semi=[0,4,7,12][sylN%4]+(q&&sylN===total-1?5:0); if(ex) semi+=2; }
      var f0=vp.b*Math.pow(2,(semi+pitch)/12)*(1+(Math.random()-.5)*(vp.mech?0:.02)), dur=(vp.mech?vp.d:(info.jong?.07:.055))/Math.sqrt(spd);
      if(vp.mech) mechBlip(c,out,f0,c.currentTime+.004,dur,vp,ex); else blip(c,out,info,f0,c.currentTime+.004,dur,vp,ex); sylN++; }
    if(/[.,!?…~]/.test(ch)) wait=150/spd; else if(ch===" ") wait=24/spd;
    setTimeout(step,wait);
  }
};
/* 가만히 있을 때 고개 까딱 */
Z.idleTilt=function(stage){ if(stage.getAttribute("data-face")||stage.className.indexOf("m-")>=0) return; stage.classList.add("m-tilt"); setTimeout(function(){ stage.classList.remove("m-tilt"); },1250); };
g.Zones=Z;
})(window);
