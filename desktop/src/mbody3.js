
var Z=window.Zones, AN=window.Annivs;
function pickNow(){ return AN.pick(S); }
/* ---------- 저장 (고치면 바로) ---------- */
var saveH=null;
function saveSoon(now){ clearTimeout(saveH); var go=function(){ S.savedAt=Date.now(); api.setState(S); }; if(now) go(); else saveH=setTimeout(go,350); }
function setCfg(k,v){ S.settings=S.settings||{}; S.settings[k]=v; api.setSettings(k,v); }

/* ---------- 부품 ---------- */
var CHECK='<svg viewBox="0 0 12 12"><path d="M2.5 6.2l2.3 2.3 4.7-5"/></svg>';
var X='<svg viewBox="0 0 14 14"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7"/></svg>';
function tile(id,on,title,sub){ return '<button class="tile'+(on?" on":"")+'" data-tile="'+id+'"><span class="ck2">'+CHECK+'</span><span><b>'+title+"</b>"+(sub?"<small>"+sub+"</small>":"")+"</span></button>"; }
function tokInner(t){ return isCk(t)?Z.ckHTML(t):(t.img&&t.img.src?'<img class="one" src="'+esc(t.img.src)+'" alt="">':'<span class="ph">'+initial(t)+"</span>"); }
function tokPreview(t){ var bg=hasPic(t)?"transparent":esc(t.color||"#8a8a90"); return '<div class="tok'+(t.pixel?" px":"")+'" data-tok="'+t.id+'"><div class="stage" style="background:'+bg+'">'+tokInner(t)+"</div></div>"; }
function ask(q,ok){ return new Promise(function(res){ var w=document.createElement("div"); w.className="veil"; w.innerHTML='<div class="dlg"><p>'+esc(q)+'</p><div class="btns"><button class="btn" data-a="0">취소</button><button class="btn pri" data-a="1">'+esc(ok||"확인")+"</button></div></div>"; w.addEventListener("click",function(e){ var b=e.target.closest("[data-a]"); if(!b&&e.target!==w) return; w.remove(); res(!!(b&&b.dataset.a==="1")); }); document.body.appendChild(w); }); }
var toastH; function toast(m){ $$(".toast").forEach(function(x){x.remove()}); var t=document.createElement("div"); t.className="toast"; t.textContent=m; document.body.appendChild(t); clearTimeout(toastH); toastH=setTimeout(function(){t.remove()},2400); }
function jo(w,a,b){ var s=String(w||""), c=s.charCodeAt(s.length-1); if(c<0xAC00||c>0xD7A3) return s+a; var f=(c-0xAC00)%28; if(a==="으로") return s+(f===0||f===8?"로":"으로"); return s+(f?a:b); }
function fillRange(r){ var p=(r.value-r.min)/(r.max-r.min)*100; r.style.setProperty("--p",p+"%"); }
function range(a,b){ var r=[]; for(var i=a;i<=b;i++) r.push(i); return r; }
function lum(hex){ var h=(hex||"").replace("#",""); if(h.length!==6) return .5; var n=parseInt(h,16); return (0.299*(n>>16&255)+0.587*(n>>8&255)+0.114*(n&255))/255; }
function mix(hex,to,k){ var n=parseInt(hex.slice(1),16), r=n>>16&255, g=n>>8&255, b=n&255, T=to==="w"?255:0; var f=function(v){ return Math.round(v+(T-v)*k).toString(16).padStart(2,"0"); }; return "#"+f(r)+f(g)+f(b); }
var DARK=window.matchMedia("(prefers-color-scheme: dark)");
var ACC_T=null;
function setAccent(t){ ACC_T=t; var ac=(S.settings||{}).accent||"#4f7cff"; var c=ac==="char"?(t&&t.color&&/^#[0-9a-f]{6}$/i.test(t.color)?t.color:"#4f7cff"):ac, L=lum(c);
  if(DARK.matches){ if(L<.42) c=mix(c,"w",Math.min(.6,(.42-L)*1.6+.15)); } else { if(L>.72) c=mix(c,"k",Math.min(.55,(L-.72)*1.8+.15)); }
  document.documentElement.style.setProperty("--acc",c); document.documentElement.style.setProperty("--accs",tint(c,DARK.matches?.22:.13)); }
DARK.addEventListener("change",function(){ setAccent(ACC_T); });
function pokeAt(tokEl,t,zone,px,py){
  var st=$(".stage",tokEl)||tokEl, r=Z.react(st,t,zone), sz=st.offsetWidth;
  if(px==null){ px=sz/2; py=sz*.3; }
  Z.spawn(st,px,py,r.fx,sz);
  var c=S.settings||{}; if(!c.mute) Z.sound(r.sound,typeof c.volume==="number"?c.volume:.5,r.soundSrc);
  say(tokEl,pickLine(t,r.lines,"p"+zone),false,t,r.bubble);
  return r;
}

/* ---------- 사이드바 ---------- */
function nextFor(tid){ return AN.upcoming(S).filter(function(x){ return x.n.days>=0&&AN.involves(S,x.a,tid); })[0]; }
function renderSide(){
  var pk=pickNow();
  $("#clist").innerHTML=S.tokens.map(function(t){
    var live=pk&&pk.id===t.id&&!(S.settings||{}).allHidden;
    return '<button class="cav'+(VIEW==="char"&&t.id===SEL?" on":"")+'" data-sel="'+t.id+'" data-tip="'+esc((t.nick||t.name||"이름 없음")+(live?" · 바탕화면":""))+'"><span class="in2" style="background:'+(hasPic(t)?tint(t.color,.22):esc(t.color||"#8a8a90"))+'">'+tokPreview(t)+"</span>"+(live?'<span class="live"></span>':"")+"</button>";
  }).join("");
  $$(".rbtn[data-nav]").forEach(function(b){ b.classList.toggle("on",b.dataset.nav===VIEW); });
}

/* ---------- 캐릭터 화면 ---------- */
var SUBS=[["basic","프로필"],["talk","성격 · 대사"],["anniv","기념일"],["art","그림"]];
function addChooser(){
  var w=document.createElement("div"); w.className="veil";
  w.innerHTML='<div class="dlg"><h3>캐릭터 추가</h3><div class="addch"><button class="addopt" data-c="new"><b>새로 만들기</b><small>이름 · 생일 · 그림을 직접 넣어요</small></button>'+
    '<label class="addopt"><input type="file" id="charimp2" accept=".ddchar,.json,application/json" hidden><b>캐릭터 파일 불러오기</b><small>내보낸 .ddchar 파일을 넣어요 (그림 · 성격 · 대사까지)</small></label></div>'+
    '<div class="btns" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-c="x">닫기</button></div></div>';
  document.body.appendChild(w);
  w.addEventListener("click",function(e){ if(e.target===w){ w.remove(); return; } var b=e.target.closest("[data-c]"); if(!b) return; w.remove(); if(b.dataset.c==="new") newToken(); });
  w.addEventListener("change",function(e){ if(e.target.id!=="charimp2") return; var f=e.target.files[0]; if(!f) return; var fr=new FileReader(); fr.onload=function(){ w.remove(); importChar(String(fr.result)); }; fr.readAsText(f); });
}
function newToken(){ var t={id:uid("t"),kind:"img",name:"",nick:"",nameEn:"",color:"#5b6b80",img:null,parts:{},lines:[],idleLines:[],motion:{breathe:true},zones:{},birthday:null,desk:{size:160},babble:"mid",voice:"mix"}; S.tokens.push(t); if(!S.settings.main){ S.settings.main=t.id; setCfg("main",t.id); } SEL=t.id; VIEW="char"; SUB="art"; saveSoon(true); render(); setTimeout(function(){ var n=$(".nm-in"); if(n) n.focus(); },50); }
function charView(){
  var t=tokById(SEL); if(!t) return '<div class="wrap"><div class="h1">캐릭터</div><p class="lead">왼쪽 아래 [＋ 캐릭터 추가]로 첫 캐릭터를 만들어 주세요.</p><div class="empty">아직 아무도 없어요.<br><button class="btn pri" data-act="new" style="margin-top:12px">＋ 캐릭터 추가</button></div></div>';
  var pk=pickNow(), isNow=pk&&pk.id===t.id, isMain=(S.settings||{}).main===t.id||(!tokById((S.settings||{}).main)&&S.tokens[0].id===t.id);
  var pill=isNow?'<button class="pill live" data-act="poke"><span class="d"></span>지금 바탕화면에 있어요</button>':isMain?'<button class="pill" disabled><span class="d"></span>기본 캐릭터</button>':'<button class="pill" data-act="main"><span class="d"></span>기본 캐릭터로 정하기</button>';
  var why=isNow&&pk.anniv?"오늘은 "+esc(jo(pk.anniv.title+(pk.n.label!==pk.anniv.title?" "+pk.n.label:""),"이라서","라서"))+" 나와 있어요.":(!isNow&&isMain&&pk&&pk.anniv?"오늘은 "+esc(AN.whoName(S,pk.anniv.who))+"의 "+esc(jo(pk.anniv.title,"이라","라"))+" 잠깐 자리를 비켜 줬어요.":"그림을 직접 눌러 봐도 돼요.");
  var hero='<div class="hero"><div class="zstage'+(SUB==="art"&&SHOWZ?" show":"")+'" id="zst" style="background:'+tint(t.color,.12)+'">'+tokPreview(t)+'<canvas class="zov" id="zov"></canvas></div>'+
    '<div class="hero-t"><input class="nm-in" data-f="nick" value="'+esc(t.nick)+'" placeholder="부를 이름 (애칭)"><input class="sub-in" data-f="name" value="'+esc(t.name)+'" placeholder="전체 이름">'+
    '<div class="hero-b">'+pill+'<button class="pill" data-act="poke">말 걸어 보기</button></div>'+
    '<div class="zlabel" id="zlab">'+why+'</div></div></div>';
  var subs='<div class="subs">'+SUBS.map(function(s){ return '<button data-sub="'+s[0]+'"'+(SUB===s[0]?' class="on"':"")+">"+s[1]+"</button>"; }).join("")+"</div>";
  if(SUB==="react"||SUB==="lines") SUB="talk";
  var body=SUB==="basic"?basicSub(t):SUB==="anniv"?annivSub(t):SUB==="art"?artSub(t):talkSub(t);
  return '<div class="wrap">'+hero+subs+body+"</div>";
}
function bubBox(t){
  var bp=t.bubblePos||{}, by=bp.y||0, bx=bp.x||0;
  return '<div class="box"><div class="box-t">말풍선 위치<button class="btn" data-act="bubtest" style="margin-left:auto;height:30px;font-size:12px">해 보기</button></div>'+
    '<div class="lbl">위 · 아래</div><div class="slide"><input type="range" id="b-y" min="-60" max="40" value="'+by+'"><span class="val" id="b-y-v">'+bubLbl(by,"위","아래")+'</span></div>'+
    '<div class="lbl">왼쪽 · 오른쪽</div><div class="slide"><input type="range" id="b-x" min="-45" max="45" value="'+bx+'"><span class="val" id="b-x-v">'+bubLbl(bx,"오른쪽","왼쪽")+'</span></div>'+
    '<p class="note" style="margin-top:10px">기본은 그림 맨 위에 맞춰 떠요. 그림 위쪽이 비어 있거나 머리 위가 너무 높으면 여기서 옮겨 주세요.'+(by||bx?' <button class="lnk" data-act="bubreset">처음대로</button>':'')+'</p></div>';
}
function basicSub(t){
  var d=t.desk||{}, size=d.size||160, m=t.motion||{}, bd=t.birthday||{};
  return '<div class="box"><div class="box-t">프로필</div><div class="grid2">'+
    '<label class="fld">영문 이름<input class="in" data-f="nameEn" value="'+esc(t.nameEn||"")+'" placeholder="없어도 돼요"></label>'+
    '<label class="fld">대표색<span style="display:flex;gap:8px"><input type="color" data-f="color" value="'+esc(t.color||"#5b6b80")+'"><input class="in" data-f="colorTxt" value="'+esc(t.color||"")+'" style="font-family:ui-monospace,monospace;font-size:13px"></span></label>'+
    '<label class="fld">생일 (월)<select class="in" data-f="bm"><option value="">-</option>'+range(1,12).map(function(n){return "<option"+(bd.m===n?" selected":"")+">"+n+"</option>"}).join("")+'</select></label>'+
    '<label class="fld">생일 (일)<select class="in" data-f="bd"><option value="">-</option>'+range(1,31).map(function(n){return "<option"+(bd.d===n?" selected":"")+">"+n+"</option>"}).join("")+"</select></label></div></div>"+
    '<div class="box"><div class="box-t">바탕화면에서</div>'+
    '<div class="lbl">크기</div><div class="slide"><input type="range" id="o-size" min="80" max="400" step="10" value="'+size+'"><span class="val" id="o-size-v">'+size+'px</span></div>'+
    '<div class="marks"><button data-size="80">80</button><button data-size="160">기본 160</button><button data-size="240">240</button><button data-size="320">320</button><button data-size="400">400</button></div>'+
    '<div class="lbl">움직임과 위치</div><div class="tiles">'+
    tile("o-flip",d.flip,"좌우 반전","거울에 비친 것처럼 반대쪽을 봐요")+
    tile("o-lock",d.lock,"위치 잠금","눌러도 끌려가지 않아요")+
    tile("o-br",m.breathe!==false,"숨쉬기 모션","가만히 있어도 살짝살짝 움직여요")+
    tile("o-tilt",!!m.idleTilt,"가끔 고개 까딱","가만히 있다가 고개를 좌우로 까딱까딱해요")+
    tile("o-shadow",!d.noShadow,"발밑 그림자","캐릭터 밑에 동그란 그림자를 깔아요")+
    "</div></div>"+bubBox(t)+
    '<div class="box"><div class="box-t">내보내기<small>그림 · 성격 · 말소리 · 대사까지 파일 하나로</small></div><p class="note" style="margin-bottom:10px">다른 컴퓨터나 폰(웹앱)으로 옮기거나 친구에게 줄 때 써요. 받은 쪽은 [설정 → 캐릭터 불러오기]로 넣어요. 기념일은 생일만 함께 가요.</p><div class="btns"><button class="btn" data-act="charexp">캐릭터 파일 만들기</button></div></div>'+
    '<div class="btns" style="justify-content:flex-end"><button class="btn ghost danger" data-act="del">이 캐릭터 지우기</button></div>';
}
function zoneBox(t){
  var ck=t.kind!=="img", split=typeof t.zoneSplit==="number"?t.zoneSplit:(ck?.5:.3), split2=typeof t.zoneSplit2==="number"?t.zoneSplit2:.6;
  var legend=Z.zonesFor(t).map(function(k){ var zz=zoneInfo(k); return '<span><i style="background:'+zz[2]+'"></i>'+esc(zz[1]||zz[3]||k)+"</span>"; }).join("");
  return '<div class="box"><div class="box-t">누르는 곳 나누기<small>움직이면 옆 그림 색이 바로 바뀌어요</small></div><div class="zbx"><div class="zstage zst2 show" style="background:'+tint(t.color,.12)+'">'+tokPreview(t)+'<canvas class="zov" id="zov2"></canvas></div><div class="zbx-r">'+
    '<div class="zleg">'+legend+'</div><p class="note" style="margin:2px 0 6px">'+(ck?'머리 그림 안에서 위쪽은 <b>머리</b>, 아래쪽은 <b>얼굴</b>로 나눠요. 팔 · 다리 같은 파츠는 그림 모양대로 따로 잡혀요.':'그림을 위에서부터 <b>머리 → 얼굴 → 몸</b> 세 칸으로 나눠요.')+' 분홍색(얼굴) 칸이 얼굴을 딱 덮도록 맞춰 주세요.</p>'+
    '<div class="lbl">얼굴이 시작되는 곳 <span style="font-weight:400">· 이마</span></div><div class="slide"><input type="range" id="z-split" min="5" max="90" value="'+Math.round(split*100)+'"><span class="val" id="z-split-v">'+Math.round(split*100)+'%</span></div>'+
    (ck?"":'<div class="lbl">얼굴이 끝나는 곳 <span style="font-weight:400">· 턱</span></div><div class="slide"><input type="range" id="z-split2" min="10" max="95" value="'+Math.round(split2*100)+'"><span class="val" id="z-split2-v">'+Math.round(split2*100)+'%</span></div>')+"</div></div></div>";
}
function artSub(t){
  var slots=t.kind==="img"
    ? '<div class="slots" style="grid-template-columns:minmax(0,180px)"><label class="slot'+(t.img&&t.img.src?"":" plus")+'">'+(t.img&&t.img.src?'<img src="'+esc(t.img.src)+'">':"")+'<em>그림</em><input type="file" accept="image/*" data-part="img"></label></div>'
    : '<div class="lbl" style="margin-top:0">얼굴 · 몸통</div><div class="slots">'+[["head1","머리 (기본 얼굴)"],["head2","얼굴 2"],["head3","얼굴 3"],["head4","얼굴 4"],["body","몸통"]].map(slotHTML).join("")+"</div>"+
      '<div class="lbl">나눠진 파츠 <span style="font-weight:400">· 넣으면 그 부위를 눌렀을 때 따로 반응해요 (선택)</span></div><div class="slots" style="grid-template-columns:repeat(5,minmax(0,1fr))">'+Z.PARTS.map(function(p){ return slotHTML([p[0],p[1]]); }).join("")+"</div>";
  function slotHTML(p){ var src=t.parts&&t.parts[p[0]]&&t.parts[p[0]].src; return '<label class="slot'+(src?"":" plus")+'">'+(src?'<img src="'+esc(src)+'">':"")+"<em>"+p[1]+'</em><input type="file" accept="image/*" data-part="'+p[0]+'">'+(src&&["back","ear","hand","foot","tail","head2","head3","head4"].indexOf(p[0])>=0?'<button class="slot-x" data-partdel="'+p[0]+'" title="빼기">×</button>':"")+'</label>'; }
  return '<div class="box"><div class="box-t">그림 방식</div><div class="tiles" style="grid-template-columns:1fr 1fr">'+
    tile("k-clicker",t.kind!=="img","얼굴 + 몸 따로","얼굴을 여러 장 넣고 부위마다 다른 표정을 써요")+
    tile("k-img",t.kind==="img","그림 한 장","PNG 한 장으로 간단하게 써요")+"</div></div>"+
    '<div class="box"><div class="box-t">그림 넣기<small>같은 크기 캔버스, 배경 투명 PNG</small></div>'+slots+
    (t.kind!=="img"?'<p class="note" style="margin-top:10px">모든 파츠는 같은 크기 캔버스에 제자리에 그린 투명 PNG로 넣어 주세요. 겹치는 순서: 뒷머리 → 꼬리 → 다리 → 몸통 → 팔 → 머리(얼굴) → 귀. 머리 칸에는 얼굴 + 눈 + 앞머리를 합친 그림을 넣어요.</p>':"")+"</div>"+zoneBox(t);
}
var SHOWZ=false;
function zoneInfo(k){ if(k==="all") return Z.ZALL; for(var i=0;i<Z.ZONES.length;i++) if(Z.ZONES[i][0]===k) return Z.ZONES[i]; return Z.ZALL; }
function reactSub(t){
  var ck=isCk(t), split=typeof t.zoneSplit==="number"?t.zoneSplit:(ck?.5:.3), split2=typeof t.zoneSplit2==="number"?t.zoneSplit2:.6;
  function zoneCard(zz){
    var k=zz[0], z=Z.get(t,k);
    return '<div class="box"><div class="box-t"><span class="zdot" style="background:'+zz[2]+'"></span>'+zz[3]+' 누르면<button class="btn" data-ztest="'+k+'" style="margin-left:auto;height:30px;font-size:12px">해 보기</button></div>'+
      '<div class="lbl">몸짓</div><div class="chips">'+Z.MOTIONS.map(function(mo){ return '<button data-zm="'+k+'|'+mo[0]+'"'+(z.motion===mo[0]?' class="on"':"")+">"+mo[1]+"</button>"; }).join("")+"</div>"+
      '<div class="lbl">튀어나오는 것</div><div class="chips">'+Z.FX.map(function(fx){ return '<button data-zx="'+k+'|'+fx[0]+'"'+(z.fx===fx[0]?' class="on"':"")+">"+(Z.fxSVG[fx[0]]||"")+fx[1]+"</button>"; }).join("")+"</div>"+
      '<div class="lbl">소리</div><div class="chips">'+Z.SOUNDS.map(function(so){ if(so[0]==="custom") return '<label class="chipf'+(z.sound==="custom"?" on":"")+'" title="mp3 · wav · ogg (3MB까지)"><input type="file" accept="audio/*" data-zsf="'+k+'" hidden>♪ '+(z.sound==="custom"?"내 소리 바꾸기":"내 소리 넣기")+"</label>"; return '<button data-zs="'+k+'|'+so[0]+'"'+(z.sound===so[0]?' class="on"':"")+">"+(so[0]==="none"?"":'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 6v4h2.5L9 13V3L5.5 6z" fill="currentColor" stroke="none"/><path d="M11 5.5c1 .8 1 4.2 0 5"/></svg>')+so[1]+"</button>"; }).join("")+"</div>"+
      '<div class="lbl">말풍선</div><div class="chips">'+Z.BUBBLES.map(function(bb){ return '<button data-zb="'+k+'|'+bb[0]+'"'+(z.bubble===bb[0]?' class="on"':"")+'><svg viewBox="0 0 20 16" style="width:18px;height:15px">'+BUBICON[bb[0]]+"</svg>"+bb[1]+"</button>"; }).join("")+"</div>"+
      (isCk(t)?'<div class="lbl">표정</div><div class="chips">'+Z.FACES.map(function(f){ var has=f[0]==="head1"||!!Z.faceSrc(t,f[0]); return '<button data-zf="'+k+'|'+f[0]+'"'+(z.face===f[0]?' class="on"':"")+(has?"":" disabled")+">"+(f[0]==="head1"?"기본":f[1])+"</button>"; }).join("")+"</div>":"")+
      '<div class="lbl">대사</div><div class="btns"><span class="note" style="flex:1">'+(z.lines.length?z.lines.length+"개 · “"+esc(z.lines[0]).slice(0,24)+"”":"아직 없어요 · 비어 있으면 공통 대사를 써요")+'</span><button class="btn" data-golines="'+k+'">대사 쓰기</button></div></div>';
  }
  var h='';
  if(ck) h+='<div class="box"><div class="box-t">부위<small>위 그림의 색이 부위예요</small></div><div class="chips" style="margin-bottom:12px"><button data-act="zshow"'+(SHOWZ?' class="on"':"")+'>부위 색 보기</button></div>'+
    '<div class="lbl">얼굴이 시작되는 곳 (이마)</div><div class="slide"><input type="range" id="z-split" min="5" max="90" value="'+Math.round(split*100)+'"><span class="val" id="z-split-v">'+Math.round(split*100)+'%</span></div>'+
    '<p class="note" style="margin-top:10px">[그림] 탭에서 팔 · 다리 · 귀 · 꼬리 · 뒷머리를 따로 넣으면 그 부위가 생기고, 누르면 그 파츠만 움직여요.</p></div>';
  else h+='<div class="box"><div class="box-t">부위<small>위 그림의 색이 부위예요</small></div><div class="chips" style="margin-bottom:12px"><button data-act="zshow"'+(SHOWZ?' class="on"':"")+'>부위 색 보기</button></div>'+
    '<div class="lbl">얼굴이 시작되는 곳 (이마)</div><div class="slide"><input type="range" id="z-split" min="5" max="90" value="'+Math.round(split*100)+'"><span class="val" id="z-split-v">'+Math.round(split*100)+'%</span></div>'+
    '<div class="lbl">얼굴이 끝나는 곳 (턱)</div><div class="slide"><input type="range" id="z-split2" min="10" max="95" value="'+Math.round(split2*100)+'"><span class="val" id="z-split2-v">'+Math.round(split2*100)+'%</span></div>'+
    '<p class="note" style="margin-top:10px">그림 한 장은 머리 · 얼굴 · 몸 세 부위로 나눠요. 귀 · 손 · 발 · 꼬리까지 따로 반응하게 하려면 [그림] 탭에서 \'얼굴 + 몸 따로\'로 파츠를 나눠 넣어 주세요.</p></div>';
  h+=Z.zonesFor(t).map(function(k){ return zoneCard(zoneInfo(k)); }).join("");
  return h;
}
var ZMAP=null;
var PERSONAS=[["sweet","다정","잘 웃고 하트를 날려요","hop","heart","speech"],["chic","시크","살짝 끄덕이고 말수가 적어요","nod","none","speech"],["shy","수줍음","움찔하고 땀을 흘려요","squash","sweat","thought"],
  ["bright","발랄","통통 튀고 별이 반짝여요","hop","star","shout"],["dreamy","몽글","고개를 까딱이며 노래해요","tilt","note","imagine"],["tsun","츤츤","도리도리하고 버럭해요","shake","anger","shout"]];
var LGSEL=null;
var UPD=null;
window.ddShowUpdate=function(info){ UPD=info; if(info&&info.newer) render(); };
/* 폰(안드로이드) 화면 위에 캐릭터 띄우기 */
function ovBox(){
  if(!window.ddOverlay) return "";
  return '<div class="box"><div class="box-t">폰 화면에 캐릭터 띄우기</div><p class="note" style="margin-bottom:10px">다른 앱을 쓰는 중에도 캐릭터가 화면 위에 떠 있어요. 끌어서 옮기고, 누르면 말풍선으로 한마디 해요. 길게 누르면 [앱 열기 · 숨기기]가 나와요. 나와 있는 동안 알림창에 작은 알림이 하나 있어요.</p><div class="btns" id="ovbtns"><span class="note">확인하는 중…</span></div><p class="note" style="margin-top:8px">캐릭터가 저절로 사라지면 휴대폰 설정 → 애플리케이션 → 기념일 D-day → 배터리를 <b>제한 없음</b>으로 바꿔 주세요.</p></div>';
}
/* 안드로이드 사진 카드 위젯 꾸미기 */
var WSTYLES=[["photo","사진 카드","사진 위에 하얀 글씨"],["polaroid","폴라로이드","하얀 테두리 · 마스킹테이프"],["sticker","다꾸 스티커","파스텔 땡땡이 · 동그란 사진"],["minimal","미니멀","하얀 카드 · 큰 숫자"],["night","밤하늘","어두운 바탕 · 반짝이는 숫자"]];
function wsBox(){
  if(!window.ddOverlay) return "";
  var cur=(S.settings||{}).widgetStyle||"photo";
  return '<div class="box"><div class="box-t">위젯 꾸미기</div><p class="note" style="margin-bottom:10px">홈 화면의 <b>사진 카드 · 사진 카드 4장</b> 위젯 모양이에요. 카드 사진은 기념일마다 [카드 이미지]로 넣을 수 있고, 없으면 그 캐릭터 그림이 들어가요.</p><div class="wsg">'+
    WSTYLES.map(function(w){ return '<button class="ws ws-'+w[0]+(cur===w[0]?" on":"")+'" data-wstyle="'+w[0]+'"><span class="ws-pv"><i></i><b>D-7</b></span><span class="ws-n">'+w[1]+'</span><small>'+w[2]+"</small></button>"; }).join("")+"</div></div>";
}
function ovSync(){
  if(!window.ddOverlay) return; window.ddOverlay.status().then(function(st){ var el=$("#ovbtns"); if(!el) return;
    if(!st.granted) el.innerHTML='<span class="note" style="flex:1">먼저 이 앱에 <b>다른 앱 위에 표시</b>를 허용해 주세요. 허용하고 돌아오면 켤 수 있어요.</span><button class="btn pri" data-act="ovperm">허용하러 가기</button>';
    else el.innerHTML=st.running?'<span class="note" style="flex:1">지금 화면에 나와 있어요</span><button class="btn" data-act="ovoff">숨기기</button>':'<span class="note" style="flex:1">권한이 허용되어 있어요</span><button class="btn pri" data-act="ovon">화면에 띄우기</button>'; }); }
document.addEventListener("visibilitychange",function(){ if(document.visibilityState==="visible"&&VIEW==="set") setTimeout(ovSync,300); });
function updBox(){
  var has=!!(api.checkUpdate||window.ddCheckUpdate);
  if(!has) return "";
  var st=UPD?(UPD.err?'<span class="note">확인하지 못했어요</span>':UPD.newer?'<b style="color:var(--acc)">새 버전 '+esc(UPD.ver)+'이 나왔어요</b>':'<span class="note">지금 최신 버전이에요 ('+esc(UPD.cur||"")+')</span>'):'<span class="note">'+(window.ddBuild?"지금 버전 1.0."+window.ddBuild:"")+'</span>';
  return '<div class="box updbox"><div class="box-t">업데이트<small>하루에 한 번 알아서 확인해요</small></div><div class="btns" style="align-items:center">'+st+'<span style="flex:1"></span>'+(UPD&&UPD.newer?'<button class="btn pri" data-act="updget">새 버전 받기</button>':"")+'<button class="btn" data-act="updcheck">지금 확인</button></div></div>';
}
function updBanner(){ if(!UPD||!UPD.newer) return ""; return '<div class="updban"><span>✦ 새 버전 <b>'+esc(UPD.ver)+'</b>이 나왔어요'+(UPD.note?" · "+esc(UPD.note):"")+'</span><button class="btn pri" data-act="updget">받기</button></div>'; }
function ptLbl(v){ return v===0?"기본":(v>0?"높게 +"+v:"낮게 "+v); }
function spLbl(v){ return v<.9?"느릿느릿":v>1.2?"빠르게":"보통"; }
function bbSample(t){ var tk=$("#zst .tok"); if(!tk||!t.babble||t.babble==="none") return; var SAMP=["안녕! 오늘 뭐 해?","나 불렀어? 무슨 일이야!","…그래, 알겠어.","기념일까지 사흘 남았어!"]; say(tk,pickLine(t,(t.lines&&t.lines.length?t.lines:SAMP),"bb")||SAMP[0],false,t,"speech"); }
var PFIELDS=["motion","fx","bubble","face"];
/* 성격을 처음 고를 때 원래 반응을 기억해 두고, 다시 누르면 그대로 되돌려요 */
function clearPersona(t){
  var snap=t.prePersona; delete t.persona; delete t.prePersona; if(!snap) return;
  Object.keys(snap).forEach(function(k){ PFIELDS.forEach(function(f){ if(snap[k][f]!==undefined) Z.set(t,k,f,snap[k][f]); }); });
}
function applyPersona(t,pid){
  var P=PERSONAS.filter(function(x){return x[0]===pid})[0]; if(!P) return;
  if(!t.persona&&!t.prePersona){ var snap={}; Z.zonesFor(t).forEach(function(k){ var z=Z.get(t,k)||{}; snap[k]={}; PFIELDS.forEach(function(f){ if(z[f]!=null) snap[k][f]=z[f]; }); }); t.prePersona=snap; }
  t.persona=pid; var has2=!!Z.faceSrc(t,"head2");
  Z.zonesFor(t).forEach(function(k){ var part=["hand","foot","ear","tail"].indexOf(k)>=0;
    Z.set(t,k,"motion",part?"none":P[3]); Z.set(t,k,"fx",P[4]); Z.set(t,k,"bubble",(k==="ear"&&pid!=="dreamy")?"shout":P[5]); Z.set(t,k,"face",(has2&&(k==="head"||k==="face"||k==="all"))?"head2":"head1"); });
}
function talkSub(t){
  var groups=lineGroups(t); if(!LGSEL||!groups.some(function(g){return g[0]===LGSEL})) LGSEL=groups[0][0];
  var voice=t.voice||"mix", cur=groups.filter(function(g){return g[0]===LGSEL})[0], arr=getLines(t,LGSEL), def=lineDef(t,LGSEL);
  var pcards='<div class="pgrid">'+PERSONAS.map(function(P){ return '<button class="pcard'+(t.persona===P[0]?" on":"")+'" data-persona="'+P[0]+'"><span class="pic">'+(P[4]!=="none"?(Z.fxSVG[P[4]]||""):'<svg viewBox="0 0 24 24"><path d="M6 12h12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>')+'</span><b>'+P[1]+"</b><small>"+P[2]+"</small></button>"; }).join("")+"</div>";
  var vchips='<div class="chips"><button data-voice="mix"'+(voice==="mix"?' class="on"':"")+'>부위마다 다르게</button>'+Z.SOUNDS.filter(function(x){return x[0]!=="custom"}).map(function(so){ return '<button data-voice="'+so[0]+'"'+(voice===so[0]?' class="on"':"")+">"+so[1]+"</button>"; }).join("")+
    '<label class="chipf'+(voice==="custom"?" on":"")+'"><input type="file" accept="audio/*" data-voicef="1" hidden>♪ '+(voice==="custom"?"내 소리 바꾸기":"내 소리 넣기")+"</label></div>";
  var tabs='<div class="lgtabs">'+groups.map(function(g){ var n=getLines(t,g[0]).length; return '<button data-lgsel="'+g[0]+'"'+(g[0]===LGSEL?' class="on"':"")+">"+(g[2]?'<i style="background:'+g[2]+'"></i>':"")+esc(g[1].replace(" 눌렀을 때","").replace(/[을를]$/,""))+(n?"<em>"+n+"</em>":"")+"</button>"; }).join("")+"</div>";
  var rows=arr.map(function(s2,i){ var p=Z.parseLine(s2,def); return '<div class="ln"><button class="bstyle'+(p.auto?"":" set")+'" data-lnb="'+LGSEL+'|'+i+'" title="말풍선 모양: '+BUB_NAME[p.style]+(p.auto?" (기본)":"")+'"><svg viewBox="0 0 20 16">'+(BUBICON[p.style]||BUBICON.speech)+'</svg></button><input class="in" data-ln="'+LGSEL+'|'+i+'" value="'+esc(p.text)+'" placeholder="대사를 적어 주세요"><button class="ib" data-lndel="'+LGSEL+'|'+i+'" title="지우기">'+X+"</button></div>"; }).join("");
  return '<div class="box"><div class="box-t">성격<small>고르면 누를 때의 몸짓 · 효과 · 말풍선이 한 번에 정해져요</small></div>'+pcards+'</div>'+
    '<div class="box"><div class="box-t">말소리<small>말할 때 글자마다 웅얼웅얼 · 같은 대사는 늘 같은 말투로</small></div>'+(function(){ var mi=Z.VOICES.map(function(v){return v[0]}).indexOf("mono"), ch=function(a){ return '<div class="chips">'+a.map(function(v){ return '<button data-babble="'+v[0]+'"'+((t.babble||"none")===v[0]?' class="on"':"")+">"+v[1]+"</button>"; }).join("")+"</div>"; };
      return mi<0?ch(Z.VOICES):'<div class="lbl" style="margin-top:0">목소리</div>'+ch(Z.VOICES.slice(0,mi))+'<div class="lbl">기계음 <span class="note" style="font-weight:400">글자마다 삑삑 · 또각또각</span></div>'+ch(Z.VOICES.slice(mi)); })()+
      ((t.babble&&t.babble!=="none")?'<div class="lbl">톤 높낮이</div><div class="slide"><input type="range" id="bb-p" min="-12" max="12" value="'+(t.babblePitch||0)+'"><span class="val" id="bb-p-v">'+ptLbl(t.babblePitch||0)+'</span></div>'+
      '<div class="lbl">말 빠르기</div><div class="slide"><input type="range" id="bb-s" min="60" max="170" step="5" value="'+Math.round((t.babbleSpeed||1)*100)+'"><span class="val" id="bb-s-v">'+spLbl(t.babbleSpeed||1)+'</span></div>'+
      '<div class="tiles" style="margin-top:12px;grid-template-columns:1fr">'+tile("o-idlev",!!t.idleVoice,"가만히 있을 때도 말소리 내기","꺼 두면 혼잣말은 글자만 조용히 떠요. 누르거나 알림이 올 때만 소리가 나요")+'</div>':"")+'</div>'+
    '<div class="box"><div class="box-t">누를 때 소리</div>'+vchips+'</div>'+
    '<div class="box"><div class="box-t">누를 때 효과 · 쓰다듬기</div><div class="tiles" style="grid-template-columns:1fr">'+tile("o-fx",!t.fxOff,"누르면 효과 띄우기","하트 · 별 같은 아이콘이 뿅 튀어나와요. 부위마다 모양은 [반응] 탭에서 골라요")+tile("o-pet",!t.petOff,"쓰다듬기 반응","그림 위에서 마우스를 좌우로 슥슥 문지르면 하트가 뿅뿅 올라오고 좋아해요")+'</div>'+
      (t.petOff?"":'<label class="fld" style="margin-top:12px">쓰다듬은 뒤 할 말 <span class="note" style="font-weight:400">· 한 줄에 하나, 비워 두면 기본 대사</span><textarea class="in" id="pet-lines" rows="3" placeholder="헤헤, 좋다~&#10;간지러워!">'+esc((t.petLines||[]).join("\n"))+'</textarea></label>')+'</div>'+
    '<div class="box" id="lg-'+LGSEL+'"><div class="box-t">대사<button class="btn" data-act="poke" style="margin-left:auto;height:30px;font-size:12px">말 걸어 보기</button></div>'+tabs+
    '<p class="note" style="margin:10px 0 8px">'+esc(cur[3]||(cur[1]+" 하는 말이에요."))+' 한 칸에 한 마디. 가운데 <b>//</b> 를 넣으면 두 번에 나눠 말해요.</p>'+
    '<div class="lines">'+rows+'<button class="addln" data-lnadd="'+LGSEL+'">＋ 한 마디 더</button></div></div>';
}
function bubLbl(v,pos,neg){ return v===0?"그대로":(v>0?pos:neg)+" "+Math.abs(v)+"%"; }
var BUBICON={sign:'<rect x="2.5" y="1.5" width="15" height="8.5" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M10 10v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  memo:'<rect x="3" y="2.5" width="14" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="7" y="1" width="6" height="3" fill="currentColor" opacity=".55"/>',
  speech:'<path d="M4 2h12a3 3 0 013 3v4a3 3 0 01-3 3H9l-4 3v-3H4a3 3 0 01-3-3V5a3 3 0 013-3z" fill="none" stroke="currentColor" stroke-width="1.4"/>',
  shout:'<path d="M10 .8l1.6 2.6 3-1.2-.4 3.1 3.1.9-2.3 2.1 2.3 2.2-3.1.6.6 3.1-3-1.1-1.8 2.6-1.6-2.7-3 1 .5-3.1-3.1-.8 2.4-2.1-2.2-2.3 3.1-.7-.5-3.1 3 1.3z" fill="currentColor" opacity=".85"/>',
  thought:'<rect x="1.4" y="1.6" width="17.2" height="9.6" rx="4.8" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8.6" cy="13" r="1.3" fill="currentColor"/><circle cx="6.4" cy="15" r=".8" fill="currentColor"/>',
  sfx:'<text x="10" y="13" text-anchor="middle" font-size="13" font-weight="900" fill="currentColor" font-family="DDSfx,sans-serif" transform="rotate(-8 10 9)">쾅</text>',
  imagine:'<rect x="1.4" y="2.2" width="17.2" height="11.6" rx="3.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray=".1 2.6" stroke-linecap="round"/>'};
function drawZones(){ var t=tokById(SEL), cv=$("#zov"), cv2=$("#zov2"); if(!t||(!cv&&!cv2)) return; Z.build(t).then(function(map){ ZMAP=map; if(cv&&$("#zov")===cv) Z.paint(map,cv); if(cv2&&$("#zov2")===cv2) Z.paint(map,cv2); }); }
function lineGroups(t){ var L=Z.zonesFor(t||{}).map(function(k){ var zz=zoneInfo(k); return [k,(k==="all"?"눌렀을 때":zz[3]+" 눌렀을 때"),zz[2]]; });
  return L.concat([["any","공통 대사","","어느 부위를 눌러도 부위 대사와 섞여서 나와요"],["idle","혼잣말","","가만히 두면 가끔 혼자 말해요"]]); }
function getLines(t,g){ if(g==="any") return t.lines||(t.lines=[]); if(g==="idle") return t.idleLines||(t.idleLines=[]); t.zones=t.zones||{}; t.zones[g]=t.zones[g]||{}; return t.zones[g].lines||(t.zones[g].lines=[]); }
function lineDef(t,g){ if(g==="idle") return "thought"; if(g==="any") return "speech"; return Z.get(t,g).bubble||"speech"; }
var BUB_NAME={speech:"말풍선",memo:"포스트잇",shout:"놀람",thought:"생각",imagine:"상상",sfx:"효과음 글씨"};
function linesSub(t){
  return '<p class="note" style="margin-bottom:12px">한 칸에 대사 하나예요. 왼쪽 말풍선 버튼을 누르면 그 줄만 모양이 바뀌어요. 중간에 <b>//</b> 를 넣으면 두 번에 나눠 말해요.</p>'+
    lineGroups(t).map(function(g){
      var arr=getLines(t,g[0]), def=lineDef(t,g[0]);
      return '<div class="box" id="lg-'+g[0]+'"><div class="box-t">'+(g[2]?'<span class="zdot" style="background:'+g[2]+'"></span>':"")+g[1]+"<small>"+(g[3]?g[3]+" · ":"")+"기본 모양 "+BUB_NAME[def]+" · "+arr.length+'개</small></div><div class="lines">'+
        arr.map(function(s,i){ var p=Z.parseLine(s,def); return '<div class="ln"><button class="bstyle'+(p.auto?"":" set")+'" data-lnb="'+g[0]+'|'+i+'" title="말풍선 모양: '+BUB_NAME[p.style]+(p.auto?" (기본)":"")+'"><svg viewBox="0 0 20 16">'+BUBICON[p.style]+'</svg></button><input class="in" data-ln="'+g[0]+'|'+i+'" value="'+esc(p.text)+'" placeholder="대사를 적어 주세요"><button class="ib" data-lndel="'+g[0]+'|'+i+'" title="지우기">'+X+"</button></div>"; }).join("")+
        '<button class="addln" data-lnadd="'+g[0]+'">＋ 한 줄 더</button></div></div>';
    }).join("");
}

/* ---------- 기념일 ---------- */
var MON=["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
function repName(a){ return a.repeat==="d100"?"100일마다":a.repeat==="once"?"한 번만":"매년"; }
function whoAv(a){
  var sid=AN.starOf(S,a), t=tokById(sid); if(!t) return '<span class="av" style="background:var(--soft)"></span>';
  return '<span class="av" style="background:'+tint(t.color,.2)+'">'+tokPreview(t)+"</span>";
}
function annRow(x){
  var a=x.a, n=x.n, d=n.date, cls=n.days===0?" today":n.days<0?" past":"";
  var meta=esc(AN.whoName(S,a.who))+" · "+repName(a)+(a.y&&a.repeat!=="d100"?" · "+a.y+"년부터":"")+(a.repeat==="d100"&&a.y?" · "+a.y+"."+a.m+"."+a.d+" 시작":"");
  return '<button class="ann'+cls+'" data-ann="'+esc(a.id)+'"><span class="dt"><small>'+MON[d.getMonth()]+"</small><b>"+d.getDate()+"</b></span>"+whoAv(a)+'<span class="mid"><b>'+esc(a.title)+(a.auto?'<span class="tag">프로필</span>':"")+(a.sample?'<span class="tag">예시</span>':"")+"</b><small>"+meta+'</small></span><span class="dd"><b>'+AN.ddayText(n)+"</b><small>"+esc(n.label===a.title?"":n.label)+"</small></span></button>";
}
function annList(list){
  if(!list.length) return '<div class="empty">아직 기념일이 없어요.<br>생일은 캐릭터 [기본] 탭에서, 나머지는 아래 버튼으로 넣어요.</div>';
  var today=list.filter(function(x){return x.n.days===0}), soon=list.filter(function(x){return x.n.days>0}), past=list.filter(function(x){return x.n.days<0});
  return (today.length?'<div class="sec-t">오늘</div>'+today.map(annRow).join(""):"")+(soon.length?'<div class="sec-t">다가오는 날</div>'+soon.map(annRow).join(""):"")+(past.length?'<div class="sec-t">지나간 날</div>'+past.map(annRow).join(""):"");
}
function annivSub(t){
  var list=AN.upcoming(S).filter(function(x){ return AN.involves(S,x.a,t.id); });
  return '<p class="note" style="margin-bottom:12px">이 캐릭터의 기념일이 되면 바탕화면 캐릭터가 저절로 '+esc(jo(t.nick||t.name||"이 캐릭터","으로"))+' 바뀌어요. 페어 기념일도 여기 함께 보여요.</p>'+annList(list)+
    '<div class="btns" style="margin-top:6px"><button class="btn pri" data-act="annadd" data-who="token:'+t.id+'">＋ 기념일 추가</button></div>';
}
var ANNMODE="card";
var ANICON={"heart": ["하트", "<path d=\"M12 21S3 15.4 3 9.2A4.7 4.7 0 0 1 12 7a4.7 4.7 0 0 1 9 2.2C21 15.4 12 21 12 21z\" fill=\"#FF8FB4\"/>"], "hearts": ["두 하트", "<path d=\"M9 19.5S2.5 15.4 2.5 10.6A3.4 3.4 0 0 1 9 9a3.4 3.4 0 0 1 6.5 1.6C15.5 15.4 9 19.5 9 19.5z\" fill=\"#FF8FB4\"/><path d=\"M16.8 14.8s-5-3.1-5-6.6a2.6 2.6 0 0 1 5-1.2 2.6 2.6 0 0 1 5 1.2c0 3.5-5 6.6-5 6.6z\" fill=\"#FFC2D6\"/>"], "broken": ["엇갈린 마음", "<path d=\"M11.2 20.4C7.6 18 3 14.2 3 9.2A4.7 4.7 0 0 1 11.3 6.5l-1.5 4 2.3 2.2-1.6 3.6z\" fill=\"#B9A3FF\"/><path d=\"M13 6.4A4.7 4.7 0 0 1 21 9.2c0 5-4.6 8.8-8.2 11.2l1.5-3.9-2.2-2.3 1.7-3.4z\" fill=\"#B9A3FF\"/>"], "star": ["별", "<path d=\"M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z\" fill=\"#FFC93C\"/>"], "moon": ["달", "<path d=\"M15.8 3.2a8.8 8.8 0 1 0 5.4 13.3A7.2 7.2 0 0 1 15.8 3.2z\" fill=\"#FFD86B\"/>"], "flower": ["꽃", "<g fill=\"#FFA6C9\"><circle cx=\"12\" cy=\"6.4\" r=\"3.6\"/><circle cx=\"17.6\" cy=\"10.4\" r=\"3.6\"/><circle cx=\"15.5\" cy=\"16.9\" r=\"3.6\"/><circle cx=\"8.5\" cy=\"16.9\" r=\"3.6\"/><circle cx=\"6.4\" cy=\"10.4\" r=\"3.6\"/></g><circle cx=\"12\" cy=\"12.1\" r=\"2.9\" fill=\"#FFD45C\"/>"], "clover": ["클로버 · 우정", "<path d=\"M11.4 12.6h1.3c.4 3.2 1.4 5.8 3.2 7.9l-1 .8c-1.9-2.2-3-5.1-3.5-8.7z\" fill=\"#58B97A\"/><g transform=\"rotate(0 12 11.8)\"><path d=\"M12 11.8C9.8 10.3 7.6 8.9 7.6 6.8a2.2 2.2 0 0 1 4.4-.7 2.2 2.2 0 0 1 4.4.7c0 2.1-2.2 3.5-4.4 5z\" fill=\"#6CCB8B\"/></g><g transform=\"rotate(120 12 11.8)\"><path d=\"M12 11.8C9.8 10.3 7.6 8.9 7.6 6.8a2.2 2.2 0 0 1 4.4-.7 2.2 2.2 0 0 1 4.4.7c0 2.1-2.2 3.5-4.4 5z\" fill=\"#6CCB8B\"/></g><g transform=\"rotate(240 12 11.8)\"><path d=\"M12 11.8C9.8 10.3 7.6 8.9 7.6 6.8a2.2 2.2 0 0 1 4.4-.7 2.2 2.2 0 0 1 4.4.7c0 2.1-2.2 3.5-4.4 5z\" fill=\"#6CCB8B\"/></g>"], "crown": ["왕관", "<path d=\"M3.5 17.2L2.6 7.3l5 3.8L12 4.4l4.4 6.7 5-3.8-.9 9.9z\" fill=\"#FFC23C\"/><rect x=\"3.5\" y=\"18\" width=\"17\" height=\"2.6\" rx=\"1\" fill=\"#F2A72C\"/>"], "ring": ["반지 · 약속", "<circle cx=\"12\" cy=\"14.6\" r=\"5.6\" fill=\"none\" stroke=\"#F2B93B\" stroke-width=\"2.4\"/><path d=\"M9 5.6L12 9.2l3-3.6-1.3-2h-3.4z\" fill=\"#8FD3FF\"/>"], "cake": ["케이크 · 생일", "<rect x=\"4\" y=\"12\" width=\"16\" height=\"8.6\" rx=\"2\" fill=\"#FFC2D6\"/><path d=\"M4 13.4c1.6 1.4 3.2 1.4 4.8 0s3.2-1.4 4.8 0 3.2 1.4 4.8 0c.6-.5 1.1-.7 1.6-.7V12H4z\" fill=\"#FF8FB4\"/><rect x=\"11\" y=\"7.6\" width=\"2\" height=\"4.4\" rx=\".6\" fill=\"#8FD3FF\"/><path d=\"M12 3.2c1.2 1.4 1.2 2.8 0 3.6-1.2-.8-1.2-2.2 0-3.6z\" fill=\"#FFA94D\"/>"], "ribbon": ["리본", "<path d=\"M12 11L4.6 7.2v8z\" fill=\"#FF8FB4\"/><path d=\"M12 11l7.4-3.8v8z\" fill=\"#FF8FB4\"/><path d=\"M10.5 12.4L8 19.8l2.3-1 1.7 1.7z\" fill=\"#FFB3CC\"/><path d=\"M13.5 12.4l2.5 7.4-2.3-1-1.7 1.7z\" fill=\"#FFB3CC\"/><circle cx=\"12\" cy=\"11\" r=\"2.2\" fill=\"#FF6F9E\"/>"], "paw": ["발바닥", "<g fill=\"#F7B38C\"><ellipse cx=\"12\" cy=\"16\" rx=\"4.8\" ry=\"4\"/><ellipse cx=\"5.9\" cy=\"10.6\" rx=\"2\" ry=\"2.5\"/><ellipse cx=\"9.7\" cy=\"6.7\" rx=\"2\" ry=\"2.6\"/><ellipse cx=\"14.3\" cy=\"6.7\" rx=\"2\" ry=\"2.6\"/><ellipse cx=\"18.1\" cy=\"10.6\" rx=\"2\" ry=\"2.5\"/></g>"], "flame": ["불꽃 · 라이벌", "<path d=\"M12 21.2c-4.1 0-6.8-2.8-6.8-6.4 0-4.3 3.6-6.2 3.6-10.6 2.7 1.4 4.4 3.7 4.6 6.3.9-.6 1.5-1.9 1.6-3.1 2.2 1.8 3.8 4.6 3.8 7.4 0 3.6-2.7 6.4-6.8 6.4z\" fill=\"#FF8A5B\"/><path d=\"M12 21c-1.9 0-3.1-1.2-3.1-3 0-2.1 1.8-2.9 2.3-5 1.9 1.1 3.9 2.7 3.9 5 0 1.8-1.2 3-3.1 3z\" fill=\"#FFC94D\"/>"], "swords": ["검 · 맞수", "<path d=\"M4 3.4h1.6l9.8 9.8-1.6 1.6L4 5z\" fill=\"#A9B6C8\"/><path d=\"M20 3.4h-1.6l-9.8 9.8 1.6 1.6L20 5z\" fill=\"#BFCAD8\"/><path d=\"M5.2 14.6l4.2 4.2-1.2 1.2-4.2-4.2zM18.8 14.6l-4.2 4.2 1.2 1.2 4.2-4.2z\" fill=\"#C99A5E\"/><path d=\"M3 19.6l2.2-2.2 1.4 1.4L4.4 21zM21 19.6l-2.2-2.2-1.4 1.4 2.2 2.2z\" fill=\"#B0844C\"/>"], "butterfly": ["나비", "<path d=\"M11.6 11.6C9.2 5.6 3.4 4.2 3.2 7.6c-.2 2.9 2.5 4.4 5.2 4.7-2.7.8-4.3 2.6-3.2 4.8 1.3 2.5 5 .8 6.4-4.4z\" fill=\"#8DB8FF\"/><path d=\"M12.4 11.6c2.4-6 8.2-7.4 8.4-4 .2 2.9-2.5 4.4-5.2 4.7 2.7.8 4.3 2.6 3.2 4.8-1.3 2.5-5 .8-6.4-4.4z\" fill=\"#A9C9FF\"/><rect x=\"11.3\" y=\"8.2\" width=\"1.4\" height=\"9.6\" rx=\".7\" fill=\"#7C8FB0\"/>"], "note": ["음표", "<path d=\"M8.6 6.4l10.4-2.6v11.8h-1.8V7.5L10.4 9.2v8.6H8.6z\" fill=\"#A88BFF\"/><ellipse cx=\"7.2\" cy=\"17.8\" rx=\"2.8\" ry=\"2.2\" fill=\"#A88BFF\"/><ellipse cx=\"16\" cy=\"15.7\" rx=\"2.8\" ry=\"2.2\" fill=\"#A88BFF\"/>"], "cup": ["커피 · 일상", "<path d=\"M4.6 9.4h11.6v6.4a4.2 4.2 0 0 1-4.2 4.2H8.8a4.2 4.2 0 0 1-4.2-4.2z\" fill=\"#E9B98A\"/><path d=\"M16.2 10.8h1.4a2.6 2.6 0 0 1 0 5.2h-1.4v-1.6h1.4a1 1 0 0 0 0-2h-1.4z\" fill=\"#E9B98A\"/><rect x=\"7.6\" y=\"3.4\" width=\"1.5\" height=\"4\" rx=\".75\" fill=\"#D7DCE4\"/><rect x=\"11.4\" y=\"3.4\" width=\"1.5\" height=\"4\" rx=\".75\" fill=\"#D7DCE4\"/>"], "sparkle": ["반짝", "<path d=\"M11 2.6l1.9 5.6 5.5 1.8-5.5 1.9L11 17.5l-1.9-5.6L3.6 10l5.5-1.8z\" fill=\"#FFC93C\"/><path d=\"M18 14.2l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z\" fill=\"#FF9EC0\"/>"], "calendar": ["달력", "<rect x=\"3.6\" y=\"5\" width=\"16.8\" height=\"15.4\" rx=\"3.2\" fill=\"#FFE1E6\"/><path d=\"M3.6 8.2A3.2 3.2 0 0 1 6.8 5h10.4a3.2 3.2 0 0 1 3.2 3.2V10H3.6z\" fill=\"#FF6F86\"/><rect x=\"7.2\" y=\"3.2\" width=\"1.8\" height=\"3.6\" rx=\".9\" fill=\"#E0566E\"/><rect x=\"15\" y=\"3.2\" width=\"1.8\" height=\"3.6\" rx=\".9\" fill=\"#E0566E\"/><path d=\"M8.6 14.6l2.2 2.2 4.6-4.6\" fill=\"none\" stroke=\"#FF6F86\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>"]};
function iconKey(a){ if(a&&a.icon&&ANICON[a.icon]) return a.icon; var t=((a&&a.title)||"")+" "; return /생일|탄신/.test(t)?"cake":/결혼|웨딩|약혼|프러포즈|청혼/.test(t)?"ring":/우정|친구/.test(t)?"clover":/데뷔|첫/.test(t)?"star":/이별|헤어/.test(t)?"broken":"heart"; }
function iconSvg(k,cls){ var v=ANICON[k]||ANICON.heart; return '<svg class="'+(cls||"aic")+'" viewBox="0 0 24 24" aria-hidden="true">'+v[1]+"</svg>"; }
function annCard(x){
  var a=x.a, n=x.n, sid=AN.starOf(S,a), t=tokById(sid), d=a.y?a.y+"."+String(a.m).padStart(2,"0")+"."+String(a.d).padStart(2,"0"):String(a.m).padStart(2,"0")+"."+String(a.d).padStart(2,"0");
  var bg=a.img?'background-image:url(\''+esc(a.img)+'\')':'background:linear-gradient(150deg,'+tint(t?t.color:"#4f7cff",.35)+','+tint(t?t.color:"#4f7cff",.12)+')';
  var big=AN.bigCount(a,n), sub=AN.isSince(a)?"다음 "+(n.label!==a.title?n.label:a.title)+" "+AN.ddayText(n):(n.label!==a.title?n.label:"");
  return '<button class="acard'+(a.img?" img":"")+(n.days===0?" today":"")+(a.pin?" pin":"")+'" data-ann="'+esc(a.id)+'" style="'+bg+'">'+(!a.img&&t?'<span class="acard-tok">'+tokPreview(t)+"</span>":"")+
    '<span class="acard-t"><span class="hrt">'+iconSvg(iconKey(a))+'</span><span><b>'+esc(AN.whoName(S,a.who))+" "+esc(a.title)+"</b><small>"+d+(a.auto?" · 프로필":"")+'</small></span></span><span class="acard-n"><b>'+esc(big)+"</b>"+(sub?"<small>"+esc(sub)+"</small>":"")+"</span></button>";
}
function annivView(){
  var list=AN.upcoming(S), pk=pickNow();
  var ban=pk&&pk.anniv?'<div class="banner"><span>🎉</span><span>오늘은 <b>'+esc(AN.whoName(S,pk.anniv.who))+" "+esc(pk.anniv.title)+'</b>! 바탕화면에는 '+esc(jo((tokById(pk.id)||{}).nick||"","이","가"))+" 나와 있어요.</span></div>":"";
  var tg='<div class="vtog"><button data-annmode="card"'+(ANNMODE==="card"?' class="on"':"")+' title="카드로 보기"><svg viewBox="0 0 16 16"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg></button><button data-annmode="list"'+(ANNMODE==="list"?' class="on"':"")+' title="목록으로 보기"><svg viewBox="0 0 16 16"><path d="M3 4h10M3 8h10M3 12h10"/></svg></button></div>';
  var cards=list.filter(function(x){ return x.n.days>=0; });
  var body=!list.length?annList(list):ANNMODE==="card"?'<div class="agrid">'+cards.map(annCard).join("")+"</div>"+(cards.length<list.length?'<p class="note" style="margin-top:10px">지나간 한 번짜리 기념일 '+(list.length-cards.length)+'개는 목록 보기에서 볼 수 있어요.</p>':""):annList(list);
  return '<div class="wrap wide"><div style="display:flex;align-items:flex-end;gap:12px"><div style="flex:1"><div class="h1">기념일</div><p class="lead">기념일마다 그림을 넣어 카드로 꾸밀 수 있어요. 그날이 되면 바탕화면 캐릭터가 주인공으로 바뀌어요.</p></div>'+tg+"</div>"+ban+body+
    '<div class="btns" style="margin-top:12px"><button class="btn pri" data-act="annadd">＋ 기념일 추가</button></div></div>';
}
function annDialog(a,presetWho,presetDate){
  var isNew=!a; a=a?JSON.parse(JSON.stringify(a)):{id:uid("a"),title:"",who:null,y:null,m:(presetDate||{}).m||new Date().getMonth()+1,d:(presetDate||{}).d||new Date().getDate(),repeat:"yearly",lines:[],star:null};
  if(!a.who&&presetWho){ var pw=presetWho.split(":"); a.who={type:pw[0],id:pw[1]}; }
  if(!a.who&&S.tokens.length) a.who={type:"token",id:(VIEW==="char"&&SEL)||S.tokens[0].id};
  if(!S.tokens.length){ toast("먼저 캐릭터를 한 명 만들어 주세요"); return; }
  var w=document.createElement("div"); w.className="veil";
  function whoOpts(){ var v=a.who?a.who.type+":"+a.who.id:"";
    return '<optgroup label="캐릭터">'+S.tokens.map(function(t){ var k="token:"+t.id; return '<option value="'+k+'"'+(k===v?" selected":"")+">"+esc(t.nick||t.name||"이름 없음")+"</option>"; }).join("")+"</optgroup>"+
      (S.pairs.length?'<optgroup label="페어">'+S.pairs.map(function(p){ var k="pair:"+p.id; return '<option value="'+k+'"'+(k===v?" selected":"")+">"+esc(p.name||"이름 없는 페어")+"</option>"; }).join("")+"</optgroup>":""); }
  function starRow(){ if(!a.who||a.who.type!=="pair") return ""; var p=S.pairs.filter(function(x){return x.id===a.who.id})[0]; if(!p||!p.tokenIds.length) return ""; var cur=AN.starOf(S,a);
    return '<label class="fld">그날 바탕화면에 나올 캐릭터<select class="in" id="ad-star">'+p.tokenIds.map(function(id){ var t=tokById(id); return t?'<option value="'+id+'"'+(id===cur?" selected":"")+">"+esc(t.nick||t.name)+"</option>":""; }).join("")+"</select></label>"; }
  function draw(){
    w.innerHTML='<div class="dlg wide"><h3>'+(isNew?"기념일 추가":"기념일 고치기")+'</h3>'+
      '<label class="fld">이름<input class="in" id="ad-title" value="'+esc(a.title)+'" placeholder="예: 처음 만난 날"></label>'+
      '<div class="chips" style="margin:-4px 0 12px">'+AN.PRESETS.map(function(p){ return '<button data-pre="'+esc(p)+'"'+(a.title===p?' class="on"':"")+">"+esc(p)+"</button>"; }).join("")+"</div>"+
      '<div class="fld">아이콘 <span style="font-weight:400" class="note">카드 · 위젯 왼쪽 위에 붙어요</span><div class="icpick">'+Object.keys(ANICON).map(function(k){ return '<button data-aicon="'+k+'"'+(iconKey(a)===k?' class="on"':"")+' title="'+esc(ANICON[k][0])+'">'+iconSvg(k)+"</button>"; }).join("")+"</div></div>"+
      '<label class="fld">누구의 기념일<select class="in" id="ad-who">'+whoOpts()+"</select></label>"+starRow()+
      '<div class="fld">날짜<div class="row3"><input class="in" id="ad-y" type="number" min="1" max="9999" value="'+(a.y||"")+'" placeholder="연도 (몰라도 돼요)"><select class="in" id="ad-m">'+range(1,12).map(function(n){return "<option"+(a.m===n?" selected":"")+">"+n+"</option>"}).join("")+'</select><select class="in" id="ad-d">'+range(1,31).map(function(n){return "<option"+(a.d===n?" selected":"")+">"+n+"</option>"}).join("")+"</select></div></div>"+
      '<div class="fld">반복<div class="chips">'+AN.REPEAT.map(function(r){ return '<button data-rep="'+r[0]+'"'+(a.repeat===r[0]?' class="on"':"")+">"+r[1]+"</button>"; }).join("")+'</div><span class="note" style="font-weight:400">'+(a.repeat==="d100"?"시작한 날을 1일로 세서 100일, 200일 … 마다 와요. 연도가 꼭 있어야 해요.":a.repeat==="once"?"그날 하루만이에요. 연도가 꼭 있어야 해요.":"해마다 같은 날 와요. 연도를 넣으면 몇 주년인지도 세 줘요.")+"</span></div>"+
      '<div class="fld">카드 이미지<div class="btns">'+(a.img?'<span class="annthumb" style="background-image:url(\''+esc(a.img)+'\')"></span>':"")+'<label class="btn">'+(a.img?"바꾸기":"이미지 넣기")+'<input type="file" accept="image/*" id="ad-img"></label>'+(a.img?'<button class="btn ghost" data-x="noimg">빼기</button>':"")+'</div></div>'+
      '<div class="fld">카드에 크게 보일 숫자<div class="chips"><button data-cnt="since"'+(a.count!=="dday"?' class="on"':"")+'>그날부터 계속 세기 (N일째)</button><button data-cnt="dday"'+(a.count==="dday"?' class="on"':"")+'>다음 기념일까지 (D-day)</button></div>'+(a.count!=="dday"&&!a.y?'<span class="note" style="font-weight:400;color:#e5484d">N일째를 세려면 연도가 있어야 해요</span>':"")+'</div>'+
      '<div class="fld"><button class="star-t'+(a.pin?" on":"")+'" data-apin="1">'+(a.pin?"★ 강조하는 기념일":"☆ 강조하기")+'</button></div>'+
      '<label class="fld">그날 할 대사 <span style="font-weight:400">· 한 줄에 하나, 비워 두면 알아서 축하해요</span><textarea class="in" id="ad-lines" placeholder="오늘 무슨 날인지 알지?">'+esc((a.lines||[]).join("\n"))+"</textarea></label>"+
      '<div class="btns" style="justify-content:space-between;margin-top:6px">'+(isNew?"<span></span>":'<button class="btn ghost danger" data-x="del">지우기</button>')+'<span class="btns"><button class="btn" data-x="no">취소</button><button class="btn pri" data-x="ok">저장</button></span></div></div>';
  }
  function grab(){ a.title=$("#ad-title",w).value.trim(); var v=$("#ad-who",w).value.split(":"); a.who={type:v[0],id:v[1]}; var st=$("#ad-star",w); a.star=st?st.value:null;
    var y=parseInt($("#ad-y",w).value,10); a.y=y>0?y:null; a.m=+$("#ad-m",w).value; a.d=+$("#ad-d",w).value; a.lines=$("#ad-lines",w).value.split("\n").map(function(s){return s.trim()}).filter(Boolean); }
  draw(); document.body.appendChild(w); setTimeout(function(){ var ti=$("#ad-title",w); if(ti&&!a.title) ti.focus(); },30);
  w.addEventListener("change",function(e){ if(e.target.id==="ad-who"){ grab(); a.star=null; draw(); }
    if(e.target.id==="ad-img"&&e.target.files[0]){ grab(); saveFileImg(e.target.files[0],1400).then(function(u){ if(u){ a.img=u; draw(); } else toast("그림을 못 읽었어요"); }); } });
  w.addEventListener("click",function(e){
    if(e.target===w){ w.remove(); return; }
    var pr=e.target.closest("[data-pre]"); if(pr){ grab(); a.title=pr.dataset.pre; draw(); return; }
    var aic=e.target.closest("[data-aicon]"); if(aic){ grab(); a.icon=aic.dataset.aicon; draw(); return; }
    var rp=e.target.closest("[data-rep]"); if(rp){ grab(); a.repeat=rp.dataset.rep; draw(); return; }
    if(e.target.closest("[data-apin]")){ grab(); a.pin=!a.pin; draw(); return; }
    var cn=e.target.closest("[data-cnt]"); if(cn){ grab(); a.count=cn.dataset.cnt; draw(); return; }
    if(e.target.closest("[data-x=noimg]")){ grab(); a.img=null; draw(); return; }
    var x=e.target.closest("[data-x]"); if(!x) return;
    if(x.dataset.x==="no"){ w.remove(); return; }
    if(x.dataset.x==="del"){ ask("이 기념일을 지울까요?","지우기").then(function(ok){ if(!ok) return; S.annivs=S.annivs.filter(function(z){return z.id!==a.id}); w.remove(); saveSoon(true); render(); toast("지웠어요"); }); return; }
    if(x.dataset.x==="ok"){ grab();
      if(!a.title){ toast("기념일 이름을 적어 주세요"); return; }
      if(!a.who||!a.who.id){ toast("누구의 기념일인지 골라 주세요"); return; }
      if((a.repeat==="d100"||a.repeat==="once")&&!a.y){ toast("이 반복 방식은 연도가 있어야 해요"); return; }
      S.annivs=S.annivs||[]; var i=S.annivs.findIndex(function(z){return z.id===a.id}); if(i>=0) S.annivs[i]=a; else S.annivs.push(a);
      w.remove(); saveSoon(true); render(); var n=AN.next(a); toast(n?a.title+" · "+AN.ddayText(n):"저장했어요"); }
  });
}

/* ---------- 페어 / 설정 ---------- */
var DUO_DEF=[[[0,"오늘 뭐 했어?"],[1,"너 기다렸지!"]],[[0,"배고프지 않아?"],[1,"방금 그 말 기다렸어"]],[[1,"나 오늘 좀 멋있지?"],[0,"...응, 쪼끔"]],[[0,"{B}!"],[1,"왜~"],[0,"그냥 불러 봤어"]],[[1,"졸려..."],[0,"조금만 더 버티자"]],[[0,"여기 화면 넓다"],[1,"같이 있으니까 좁은데?"]],[[0,"두근두근","sfx"],[1,"무슨 소리야?"],[0,"아, 아무것도 아니야!"]],[[1,"우리 산책 갈래?"],[0,"바탕화면 밖으로는 못 나가잖아"],[1,"그럼 여기서 한 바퀴!"]],[[0,"오늘 날씨 어때?"],[1,"너랑 있어서 맑음"]],[[1,"쾅!","sfx"],[0,"깜짝이야!","shout"],[1,"헤헤 놀랐지"]],[[0,"일 열심히 하네"],[1,"우리도 응원하자"],[0,"화이팅!"]],[[1,"심심해~"],[0,"그럼 나랑 놀자"]]];
var DLG_STY=[["","말풍선"],["sfx","효과음"],["shout","놀람"],["thought","생각"]];
function defDialogs(){ return DUO_DEF.map(function(c){ return c.map(function(l){ return {w:l[0],t:l[1],s:l[2]||""}; }); }); }
/* 예전 글자 방식(이름: 대사)으로 적어 둔 대화 → 칸 방식으로 옮겨요 */
function talksToDialogs(p,ids){
  var nm=ids.map(function(id){ var t=tokById(id)||{}; return [t.nick||"",t.name||""]; });
  return String(p.talks||"").replace(/\r/g,"").split(/\n\s*\n/).map(function(bk){ var next=0;
    return bk.split("\n").map(function(ln){ ln=ln.trim(); if(!ln) return null;
      var m=/^([^:：]{1,16})[:：]\s*(.*)$/.exec(ln), w=null, txt=ln;
      if(m){ var k=m[1].trim(); if(/^(\{A\}|A|1)$/i.test(k)||nm[0].indexOf(k)>=0) w=0; else if(/^(\{B\}|B|2)$/i.test(k)||(nm[1]&&nm[1].indexOf(k)>=0)) w=1; if(w!=null) txt=m[2]; }
      if(w==null) w=next; next=1-w; var st=""; var pl=Z.parseLine(txt,"speech"); if(!pl.auto){ st=pl.style; txt=pl.text; }
      return {w:w,t:txt,s:st}; }).filter(Boolean); }).filter(function(c){return c.length});
}
function pairDialogs(p,ids){ if(!p.dialogs&&p.talks&&p.talks.trim()){ p.dialogs=talksToDialogs(p,ids); delete p.talks; } return p.dialogs||null; }
var WCOL=[["#9fb4ff","#eef3ff"],["#ffb3cb","#fff0f5"],["#9ee0b6","#eefbf2"],["#ffd28a","#fff7e8"],["#c6b2ff","#f4efff"]];
var DLG_MO=[["","몸짓 없음"],["hop","통통"],["nod","끄덕"],["jump","펄쩍"],["dance","씰룩"],["shy","움찔"],["surprise","깜짝"],["spin","빙글"],["approach","다가가기"]];
function dialogBox(p,ids,duoOn){
  var D=pairDialogs(p,ids)||[], live=window.__TAURI__&&duoOn, n=Math.max(2,ids.length);
  var who=function(w){ var t=tokById(ids[w]); return '<span class="av">'+(t?tokPreview(t):"")+'</span><span class="wn">'+esc(t?(t.nick||t.name||""):"?")+"</span>"; };
  var h='<div class="lbl" style="margin-top:4px">같이 나누는 대화 <span class="note" style="font-weight:400">'+(D.length?D.length+"개 · 가끔 그중 하나를 골라 주고받아요":"아직 없어서 기본 대화 "+DUO_DEF.length+"개를 써요")+"</span></div>";
  h+='<div class="dlgs">'+D.map(function(c,i){
    return '<div class="dlg2" data-dlg="'+i+'"><div class="dlg2-h"><b>대화 '+(i+1)+"</b>"+(live?'<button class="lk" data-act="dlgplay" data-i="'+i+'">▶ 들어 보기</button>':"")+'<button class="ib" data-act="dlgdel" data-i="'+i+'" title="이 대화 지우기">'+X+"</button></div>"+
      c.map(function(l,j){ var w=(l.w||0)%n, sty=DLG_STY.filter(function(x){return x[0]===(l.s||"")})[0]||DLG_STY[0], mo=DLG_MO.filter(function(x){return x[0]===(l.m||"")})[0]||DLG_MO[0], cl=WCOL[w%5];
        return '<div class="dl-row"><button class="dl-who" style="border-color:'+cl[0]+';background:'+cl[1]+'" data-act="dlwho" data-i="'+i+'" data-j="'+j+'" title="누르면 말하는 사람이 바뀌어요">'+who(w)+'</button><input class="in dl-t" data-dl="'+i+"|"+j+'" value="'+esc(l.t)+'" placeholder="대사"><button class="dl-sty s-'+(l.s||"speech")+'" data-act="dlsty" data-i="'+i+'" data-j="'+j+'" title="누르면 말풍선 모양이 바뀌어요">'+sty[1]+'</button><button class="dl-sty dl-mo'+(l.m?" on":"")+'" data-act="dlmo" data-i="'+i+'" data-j="'+j+'" title="누르면 몸짓이 바뀌어요">'+mo[1]+'</button><button class="ib" data-act="dldel" data-i="'+i+'" data-j="'+j+'" title="이 줄 지우기">'+X+"</button></div>"; }).join("")+
      '<button class="dl-add" data-act="dladd" data-i="'+i+'">＋ 한 마디</button></div>';
  }).join("")+"</div>";
  h+='<div class="chips" style="margin:2px 0 8px"><button data-act="dlauto"'+(p.duoAuto!==false?' class="on"':"")+'>저절로 대화하기 '+(p.duoAuto!==false?"켬":"끔")+'</button><button data-act="dlvoice"'+(p.duoVoice!==false?' class="on"':"")+'>대화할 때 말소리 '+(p.duoVoice!==false?"켬":"끔")+'</button></div>';
  h+='<div class="btns"><button class="btn" data-act="dlgadd">＋ 대화 추가</button>'+(D.length?"":'<button class="btn" data-act="dlgdef">기본 대화 불러와서 고치기</button>')+(live?'<button class="btn" data-act="ptalk">아무 대화나 들어 보기</button>':"")+"</div>";
  h+='<p class="note">말하는 사람 칩을 누르면 다음 사람으로 바뀌어요. 모양 버튼은 말풍선 · 효과음 · 놀람 · 생각, 몸짓 버튼은 통통 · 끄덕 · 펄쩍 · 다가가기 같은 움직임이에요. 말하는 동안 다른 친구들은 말하는 쪽으로 몸을 기울여요. 대사 안의 {A} {B}는 첫째 · 둘째 사람 이름으로 바뀌어요.</p>';
  return h;
}
function pairView(){
  var h='<div class="wrap"><div class="h1">페어</div><p class="lead">함께 묶어 둔 캐릭터들이에요. 기념일을 붙일 때 페어 단위로 고를 수 있어요.</p>';
  if(!S.pairs.length&&S.tokens.length>=2) h+='<div class="empty">아직 묶은 페어가 없어요.</div>';
  h+=S.pairs.map(function(p){
    var mem=p.tokenIds.filter(function(id){return tokById(id)}), five=mem.slice(0,5), duoOn=S.settings.duo===p.id, nm=function(id){ var t=tokById(id); return t?(t.nick||t.name||""):""; }, names=five.map(nm).join(" · ");
    var duo=window.__TAURI__?'<div class="duo"><div class="duo-h"><b>바탕화면에 같이 띄우기</b><span class="note">'+(five.length<2?"캐릭터를 두 명 이상 고르면 켤 수 있어요":duoOn?"지금 "+esc(names)+" 나와 있어요":"켜면 바탕화면에 "+five.length+"명이 나란히 나와서 가끔 서로 이야기해요")+(mem.length>5?" (앞의 5명까지)":"")+'</span><button class="btn'+(duoOn?"":" pri")+'" data-act="pduo"'+(five.length<2?" disabled":"")+'>'+(duoOn?"끄기":"같이 띄우기")+'</button></div>':'<div class="duo"><div class="duo-h"><b>같이 나누는 대화</b><span class="note">PC 앱에서 페어를 바탕화면에 같이 띄우면 이 대화를 주고받아요</span></div>';
    duo+=dialogBox(p,five,duoOn)+'</div>';
    return '<div class="box" data-pair="'+p.id+'"><div class="box-t"><input class="in" data-pf="name" value="'+esc(p.name)+'" placeholder="페어 이름" style="font-weight:700;max-width:280px"><button class="ib" data-act="pdel" title="풀기" style="margin-left:auto">'+X+'</button></div><div class="mem">'+S.tokens.map(function(t){ return '<button data-mem="'+t.id+'"'+(p.tokenIds.indexOf(t.id)>=0?' class="on"':"")+'><span class="av" style="background:'+tint(t.color,.2)+'">'+tokPreview(t)+"</span>"+esc(t.nick||t.name)+"</button>"; }).join("")+"</div>"+duo+"</div>";
  }).join("");
  if(S.tokens.length<2) return h+'<div class="box"><p class="note">페어를 묶으려면 캐릭터가 두 명 이상 있어야 해요. 지금은 '+S.tokens.length+'명이에요.</p><div class="btns" style="margin-top:10px"><button class="btn pri" data-act="new">＋ 캐릭터 추가</button></div></div></div>';
  return h+'<button class="btn" data-act="pnew">＋ 새 페어 묶기</button></div>';
}

function setView(){
  var c=S.settings||{}, th=c.theme||"system";
  return '<div class="wrap"><div class="h1">설정</div><p class="lead">프로그램 전체에 적용돼요.</p>'+
    '<div class="box"><div class="box-t">화면 색</div><div class="chips">'+[["system","윈도우 설정 따라가기"],["light","밝게"],["dark","어둡게"]].map(function(o){ return '<button data-theme="'+o[0]+'"'+(th===o[0]?' class="on"':"")+">"+o[1]+"</button>"; }).join("")+"</div>"+
    '<div class="lbl">스타일</div><div class="chips">'+[["clean","깔끔하게"],["otaku","다꾸 스타일"]].map(function(o){ var lk=c.look==="otaku"?"otaku":"clean"; return '<button data-look="'+o[0]+'"'+(lk===o[0]?' class="on"':"")+">"+o[1]+"</button>"; }).join("")+"</div>"+
    '<div class="lbl">테마 컬러</div><div class="sws">'+[["#4f7cff","블루"],["#7c6cf0","라벤더"],["#2bb3a3","민트"],["#3aa0d8","하늘"],["#f06292","핑크"],["#ff7a59","코랄"],["#e0a020","머스터드"],["#5b6b80","그레이"]].map(function(o){ var ac=c.accent||"#4f7cff"; return '<span class="sw2'+(ac===o[0]?" on":"")+'" data-accent="'+o[0]+'" title="'+o[1]+'" style="background:'+o[0]+'"></span>'; }).join("")+'<label class="btn" style="height:34px">직접 고르기<input type="color" id="s-acc-custom" value="'+(/^#/.test(c.accent||"")?c.accent:"#4f7cff")+'" style="position:absolute;inset:0;opacity:0;cursor:pointer"></label><button class="btn'+(c.accent==="char"?" on":"")+'" data-accent="char" style="height:34px">캐릭터 대표색 따라가기</button></div></div>'+
    '<div class="box"><div class="box-t">기념일</div><div class="tiles" style="margin-bottom:12px">'+tile("s-swap",c.annivSwap!==false,"기념일엔 주인공으로","그날의 캐릭터가 바탕화면에 대신 나와요")+tile("s-notify",c.annivNotify!==false,"기념일 아침 알림","당일 아침 9시에 윈도우 알림을 띄워요")+'</div><div class="lbl">언제부터 바꿀까요</div><div class="chips">'+[[0,"당일만"],[1,"하루 전부터"],[3,"3일 전부터"],[7,"일주일 전부터"]].map(function(o){ var cur=typeof c.annivLead==="number"?c.annivLead:0; return '<button data-lead="'+o[0]+'"'+(cur===o[0]?' class="on"':"")+">"+o[1]+"</button>"; }).join("")+"</div></div>"+
    '<div class="box"><div class="box-t">바탕화면 캐릭터</div><div class="tiles">'+
    tile("s-pin",c.pinned!==false,"다른 창보다 위에","창을 열어도 캐릭터가 덮이지 않아요")+
    tile("s-through",c.clickThrough!==false,"그림 밖은 통과","캐릭터 주변을 눌러도 뒤의 창이 눌려요")+
    tile("s-hide",!!c.allHidden,"잠깐 다 숨기기","트레이 아이콘을 누르면 돌아와요")+
    tile("s-login",c.launchAtLogin!==false,"컴퓨터 켜면 같이 시작","관리 창 없이 캐릭터만 떠요")+"</div></div>"+
    '<div class="box"><div class="box-t">소리</div><div class="tiles" style="margin-bottom:12px">'+tile("s-mute",!!c.mute,"무음 모드","캐릭터를 눌러도 조용해요")+'</div><div class="lbl">누를 때 소리 크기</div><div class="slide"><input type="range" id="s-vol" min="0" max="100" value="'+Math.round((typeof c.volume==="number"?c.volume:.5)*100)+'"><span class="val" id="s-vol-v">'+Math.round((typeof c.volume==="number"?c.volume:.5)*100)+'%</span></div><div class="lbl">말소리 크기</div><div class="slide"><input type="range" id="s-vvol" min="0" max="100" value="'+Math.round((typeof c.voiceVol==="number"?c.voiceVol:.6)*100)+'"><span class="val" id="s-vvol-v">'+Math.round((typeof c.voiceVol==="number"?c.voiceVol:.6)*100)+'%</span></div><p class="note" style="margin-top:8px">어떤 소리가 날지는 캐릭터마다 [성격 · 대사]에서 골라요.</p></div>'+
    ovBox()+updBox()+
    '<div class="box"><div class="box-t">데이터</div><div class="btns"><button class="btn" data-act="backup">백업 파일 만들기</button><label class="btn">백업에서 되돌리기<input type="file" id="rf" accept=".json,application/json"></label><button class="btn" data-act="charexpall">캐릭터 전부 내보내기</button><label class="btn">캐릭터 불러오기<input type="file" id="charimp" accept=".ddchar,.json,application/json"></label><button class="btn ghost" data-act="folder">저장 폴더 열기</button></div></div>'+
    '<p class="note" style="text-align:center;margin-top:18px">기념일 D-day <span id="ver2"></span> · 만든 사람 빵살 · 나만 쓰는 테스트 버전</p></div>';
}


/* ===================== 홈 · 달력 · 일정 ===================== */
var WD=["일","월","화","수","목","금","토"];
function ymdOf(d){ return AN.ymd(d); }
function fmtDay(s){ var d=AN.parseYmd(s); if(!d) return s; return (d.getMonth()+1)+"월 "+d.getDate()+"일 ("+WD[d.getDay()]+")"; }
function ddText(n){ return n===0?"오늘":n>0?"D-"+n:"D+"+(-n); }
function shrinkMax(src,max,type){
  return loadImg(src).then(function(im){
    var w=im.naturalWidth||max, h=im.naturalHeight||max, k=Math.min(1,max/Math.max(w,h));
    var c=document.createElement("canvas"); c.width=Math.max(1,Math.round(w*k)); c.height=Math.max(1,Math.round(h*k));
    c.getContext("2d").drawImage(im,0,0,c.width,c.height);
    return c.toDataURL(type||"image/webp",.88);
  });
}
function saveFileImg(file,max){ return fileToURL(file).then(function(u){ return shrinkMax(u,max); }).then(function(d){ return api.saveImage(d); }); }
function avOf(tid,size){ var t=tokById(tid); if(!t) return ""; return '<span class="av" style="background:'+tint(t.color,.2)+'">'+tokPreview(t)+"</span>"; }
function evRow(e,days){
  var c=AN.catOf(e.cat), who=e.who?AN.whoName(S,e.who):"", star=e.star||(e.who&&e.who.type==="token"?e.who.id:null);
  var meta=[fmtDay(e.date)+(e.time?" "+e.time:""), c[1]].concat(who?[who]:[]).concat(e.from?["받음: "+e.from]:[]).concat(e.sample?["예시"]:[]).join(" · ");
  return '<button class="item'+(days===0?" now":"")+(e.pin?" pin":"")+'" data-ev="'+esc(e.id)+'"><span class="bar" style="background:'+c[2]+'"></span>'+(star?avOf(star):"")+'<span class="mid"><b>'+esc(e.title)+"</b><small>"+esc(meta)+'</small></span><span class="dd">'+ddText(days)+"</span></button>";
}
function anItem(x){
  var a=x.a, n=x.n, sid=AN.starOf(S,a);
  return '<button class="item'+(n.days===0?" now":"")+(a.pin?" pin":"")+'" data-ann="'+esc(a.id)+'"><span class="bar" style="background:#ff6fa3"></span>'+(sid?avOf(sid):"")+'<span class="mid"><b>'+esc(AN.whoName(S,a.who))+" · "+esc(a.title)+(n.label!==a.title?" "+esc(n.label):"")+"</b><small>"+fmtDay(ymdOf(n.date))+" · "+repName(a)+'</small></span><span class="dd">'+AN.ddayText(n).replace("D-DAY","오늘")+"</span></button>";
}

/* ---------- 홈 ---------- */
function hasSamples(){ return (S.annivs||[]).some(function(a){return a.sample}) || (S.events||[]).some(function(e){return e.sample}); }
function isSampleOnly(){ return !(S.tokens||[]).some(function(t){ return ["t-nia2","t-bald"].indexOf(t.id)<0; }); }
function onboardBox(){
  return '<div class="box onb"><div class="box-t"><span class="en">START</span>내 캐릭터부터 넣어 볼까요?<small><button class="lnk" data-act="ob-skip">나중에</button></small></div>'+
    '<p class="note" style="margin:-4px 0 12px">이름이랑 생일만 넣어도 생일이 기념일로 들어가요. 그날이 되면 그 캐릭터가 바탕화면에 나와서 축하해 줘요.</p>'+
    '<div class="onb-f"><label class="fld">이름<input class="in" id="ob-name" placeholder="예: 하루"></label>'+
    '<label class="fld">생일<span style="display:flex;gap:6px"><select class="in" id="ob-m"><option value="">월</option>'+range(1,12).map(function(n){return "<option>"+n+"</option>"}).join("")+'</select><select class="in" id="ob-d"><option value="">일</option>'+range(1,31).map(function(n){return "<option>"+n+"</option>"}).join("")+'</select></span></label>'+
    '<label class="fld">그림 (선택)<span class="obpic"><input type="file" accept="image/*" id="ob-img"><span id="ob-imgname">배경 투명 PNG 한 장</span></span></label></div>'+
    '<div class="btns" style="margin-top:4px;justify-content:space-between">'+(hasSamples()?'<button class="lnk" data-act="smp-del">예시 기념일 · 일정 지우기</button>':"<span></span>")+'<button class="btn pri" data-act="ob-go">만들기</button></div></div>';
}
function homeView(){
  var now=new Date(), today=ymdOf(now), on=AN.on(S,today);
  var ups=AN.upcoming(S).filter(function(x){ return x.n.days>=0; }), nx=ups[0];
  var hero;
  if(nx){ var a=nx.a, n=nx.n, sid=AN.starOf(S,a), ht=tokById(sid)||tokById((S.settings||{}).main)||S.tokens[0], isToday=n.days===0;
    var title=AN.whoName(S,a.who)+"의 "+a.title+(n.label!==a.title?" "+n.label:"");
    var line=isToday?(a.lines&&a.lines.length?a.lines[0]:AN.defaultLine(S,a,n)):AN.defaultLine(S,a,n);
    hero='<div class="nexthero'+(isToday?" today":"")+'" style="--hc:'+esc((ht&&ht.color)||"#4f7cff")+'">'+
      (ht?'<div class="nh-pv zstage" id="zst" data-tid="'+ht.id+'" style="background:'+tint(ht.color,.16)+'">'+tokPreview(ht)+'</div>':"")+
      '<div class="nh-t"><span class="nh-k">'+(isToday?"오늘이에요!":"다음 기념일")+'</span><b class="nh-title">'+esc(title)+'</b>'+
      '<span class="nh-dd">'+esc(AN.ddayText(n))+'</span><span class="nh-date">'+fmtDay(ymdOf(n.date))+" · "+repName(a)+(AN.isSince(a)&&AN.since(a)>0?" · 오늘로 "+AN.since(a)+"일째":"")+'</span>'+
      '<span class="nh-q">“'+esc(line)+'”</span>'+
      '<span class="btns" style="margin-top:12px">'+(ht?'<button class="btn" data-act="hpoke" data-tid="'+ht.id+'">말 걸어 보기</button>':"")+'<button class="btn ghost" data-ann="'+esc(a.id)+'">기념일 열기</button></span></div></div>';
  } else hero='<div class="nexthero empty"><div class="nh-t"><span class="nh-k">다음 기념일</span><b class="nh-title">아직 기념일이 없어요</b><span class="nh-date">캐릭터 생일을 넣거나, 처음 만난 날 같은 기념일을 추가해 보세요.</span><span class="btns" style="margin-top:12px"><button class="btn pri" data-act="annadd">＋ 기념일</button></span></div></div>';
  var cards=ups.slice(1,7);
  var todayEv=on.events.map(function(e){ return evRow(e,0); }).join("");
  var soonEv=AN.events(S).filter(function(x){ return x.days>0&&x.days<=21; }).slice(0,6).map(function(x){ return evRow(x.e,x.days); }).join("");
  return '<div class="wrap wide">'+updBanner()+'<div class="today-h"><span class="big">'+(now.getMonth()+1)+"월 "+now.getDate()+'일</span><span class="wd">'+WD[now.getDay()]+'요일</span></div>'+
    (!(S.settings||{}).onboardDone&&isSampleOnly()?onboardBox():"")+
    '<div class="home"><div>'+hero+
    (cards.length?'<div class="sec-t" style="margin-top:18px">그다음 기념일</div><div class="agrid sm">'+cards.map(annCard).join("")+"</div>":"")+
    '</div><div>'+
    '<div class="box"><div class="box-t"><span class="en">TODAY</span>오늘 일정</div>'+(todayEv||'<p class="note">오늘은 일정이 없어요.</p>')+"</div>"+
    (soonEv?'<div class="box"><div class="box-t">곧 있을 일정<small>3주 안</small></div>'+soonEv+"</div>":"")+
    '<div class="box"><div class="box-t"><span class="en">ADD</span>빠르게 넣기</div><div class="quick"><button data-act="annadd">＋ 기념일</button><button data-act="evadd">＋ 일정</button></div></div>'+
    '<div class="box"><div class="box-t">'+(now.getMonth()+1)+'월<small><button class="btn ghost" data-nav-go="cal" style="height:24px;padding:0 6px;font-size:12px">달력 열기 →</button></small></div>'+miniCal(now)+"</div></div></div></div>";
}
function miniCal(now){
  var y=now.getFullYear(), m=now.getMonth(), first=new Date(y,m,1), start=new Date(y,m,1-first.getDay()), h=WD.map(function(w){return '<span class="wd">'+w+"</span>"}).join("");
  for(var i=0;i<42;i++){ var d=new Date(start.getFullYear(),start.getMonth(),start.getDate()+i); if(i>=35&&d.getMonth()!==m) break; var k=ymdOf(d), on=AN.on(S,k), has=on.annivs.length||on.events.length;
    h+='<span class="'+(d.getMonth()!==m?"o ":"")+(k===ymdOf(now)?"t ":"")+(has?"has":"")+'">'+d.getDate()+"</span>"; }
  return '<div class="minical">'+h+"</div>";
}

/* ---------- 다이어리 달력 (0.5) ---------- */
var CALM=null, DECO=false, SELSTK=null, DAYSEL=null;
function curYM(){ if(!CALM){ var n=new Date(); CALM=n.getFullYear()+"-"+String(n.getMonth()+1).padStart(2,"0"); } return CALM; }
function monthData(ym){ S.diary=S.diary||{}; return S.diary[ym]||(S.diary[ym]={bg:null,bgOp:1,cellOp:.82,stickers:[]}); }
var ICO={prev:'<svg viewBox="0 0 16 16"><path d="M10 3L5 8l5 5"/></svg>',next:'<svg viewBox="0 0 16 16"><path d="M6 3l5 5-5 5"/></svg>',deco:'<svg viewBox="0 0 16 16"><path d="M3 13l1-3.2 7-7 2.2 2.2-7 7z"/><path d="M9.6 4.2l2.2 2.2"/></svg>'};
function calView(){
  var ym=curYM(), Y=+ym.slice(0,4), M=+ym.slice(5,7)-1, md=(S.diary||{})[ym]||{bg:null,bgOp:1,cellOp:.82,stickers:[]};
  var first=new Date(Y,M,1), today=ymdOf(new Date()), cells="";
  if(!DAYSEL||DAYSEL.slice(0,7)!==ym) DAYSEL=today.slice(0,7)===ym?today:ym+"-01";
  var EN=["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];
  var rows=Math.ceil((first.getDay()+new Date(Y,M+1,0).getDate())/7);
  var cellOp=md.bg?(md.cellOp==null?.82:md.cellOp):0;
  for(var i=0;i<rows*7;i++){
    var d=new Date(Y,M,1-first.getDay()+i), k=ymdOf(d), on=AN.on(S,k), chips=[];
    on.annivs.forEach(function(a){ chips.push('<span class="ev2" style="--c:#ff5c93"'+(a.auto?"":' draggable="true" data-drag="a:'+esc(a.id)+'"')+'><i></i><span style="overflow:hidden;text-overflow:ellipsis">'+esc(AN.whoName(S,a.who))+" "+esc(a.title)+"</span></span>"); });
    on.events.forEach(function(e){ chips.push('<span class="ev2" style="--c:'+AN.catOf(e.cat)[2]+'" draggable="true" data-drag="e:'+esc(e.id)+'"><i></i><span style="overflow:hidden;text-overflow:ellipsis">'+(e.time?e.time+" ":"")+esc(e.title)+"</span></span>"); });
    var more=chips.length>2?'<span class="ev2 more">+'+(chips.length-2)+"</span>":"";
    cells+='<div class="dc'+(d.getMonth()!==M?" out":"")+(k===today?" today":"")+(k===DAYSEL?" sel":"")+(d.getDay()===0?" sun":d.getDay()===6?" sat":"")+'" data-day="'+k+'"><span class="n">'+d.getDate()+"</span>"+chips.slice(0,2).join("")+more+((S.notes||{})[k]?'<span class="memo2" title="메모"></span>':"")+"</div>";
  }
  var stk=(md.stickers||[]).slice().sort(function(a,b){return (a.z||0)-(b.z||0)}).map(stkHTML).join("");
  var bar=DECO?'<div class="decobar2"><label class="btn">배경 이미지<input type="file" accept="image/*" id="d-bg"></label>'+(md.bg?'<button class="btn ghost" data-act="d-bgdel">빼기</button><span class="mini">진하기<input type="range" id="d-bgop" min="15" max="100" value="'+Math.round((md.bgOp==null?1:md.bgOp)*100)+'"></span><span class="mini">칸<input type="range" id="d-cellop" min="0" max="100" value="'+Math.round((md.cellOp==null?.82:md.cellOp)*100)+'"></span>':"")+'<span class="sep"></span><label class="btn">＋ 스티커<input type="file" accept="image/*" multiple id="d-stk"></label><button class="btn" data-act="d-txt">＋ 글씨</button>'+
    (SELSTK?'<span class="sep"></span><button class="btn ghost" data-act="d-up">앞으로</button><button class="btn ghost" data-act="d-down">뒤로</button>'+(stkById(SELSTK)&&stkById(SELSTK).type==="text"?'<button class="btn ghost" data-act="d-edit">고치기</button>':"")+'<button class="btn ghost danger" data-act="d-del">지우기</button>':"")+"</div>":"";
  var paper='<div class="paper'+(DECO?" deco":"")+'" id="diary" style="--bgop:'+(md.bgOp==null?1:md.bgOp)+";--cellop:"+cellOp+'"><span class="tape"></span><span class="tape r"></span>'+(md.bg?'<div class="d-bg" style="background-image:url(\''+esc(md.bg)+'\')"></div>':"")+
    '<div class="ph-top"><span class="mon"><b>'+(M+1)+'</b><span>'+EN[M]+'</span><i>'+Y+'</i></span><span style="flex:1"></span><button class="pill2" data-act="m-today">오늘</button><button class="rnd" data-act="m-prev" title="이전 달">'+ICO.prev+'</button><button class="rnd" data-act="m-next" title="다음 달">'+ICO.next+'</button><button class="rnd'+(DECO?" on":"")+'" data-act="deco" title="'+(DECO?"꾸미기 끝":"이 달 꾸미기")+'">'+ICO.deco+"</button></div>"+
    '<div class="g7">'+WD.map(function(w,i){return '<span class="wdh'+(i===0?" sun":i===6?" sat":"")+'">'+["SUN","MON","TUE","WED","THU","FRI","SAT"][i]+"</span>"}).join("")+cells+'</div><div class="d-stk" id="dstk">'+stk+"</div></div>";
  return '<div class="calwrap"><div>'+bar+paper+(DECO?'<p class="note" style="margin-top:10px">끌어서 옮기기 · 오른쪽 아래 점 크기 · 위쪽 점 회전. 달마다 따로 꾸며져요.</p>':"")+"</div>"+agendaHTML(DAYSEL)+"</div>";
}
function agendaHTML(k){
  var d=AN.parseYmd(k), on=AN.on(S,k);
  var an=AN.all(S).map(function(a){ return {a:a,n:AN.next(a,d)}; }).filter(function(x){ return x.n&&x.n.days===0; });
  var rows=an.map(function(x){ var sid=AN.starOf(S,x.a); return '<button class="item" data-ann="'+esc(x.a.id)+'"><span class="bar" style="background:#ff5c93"></span>'+(sid?avOf(sid):"")+'<span class="mid"><b>'+esc(AN.whoName(S,x.a.who))+" · "+esc(x.a.title)+(x.n.label!==x.a.title?" "+esc(x.n.label):"")+"</b><small>"+repName(x.a)+"</small></span></button>"; }).join("")+
    on.events.map(function(e){ var c=AN.catOf(e.cat), star=e.star||(e.who&&e.who.type==="token"?e.who.id:null); return '<button class="item" data-ev="'+esc(e.id)+'"><span class="bar" style="background:'+c[2]+'"></span>'+(star?avOf(star):"")+'<span class="mid"><b>'+esc(e.title)+"</b><small>"+(e.time?e.time+" · ":"")+c[1]+"</small></span></button>"; }).join("");
  var dd=AN.eventDays({date:k});
  return '<aside class="agenda"><div class="box"><span class="tape r"></span><div class="dt2">'+(dd===0?"오늘":ddText(dd))+" · "+WD[d.getDay()]+'요일</div><div class="dt1">'+(d.getMonth()+1)+"월 "+d.getDate()+"일</div>"+(rows||'<div class="emp">아직 아무 일도 없어요.</div>')+
    '<div class="agbtn"><button data-act="ag-ev">＋ 일정</button><button data-act="ag-an">＋ 기념일</button></div><textarea class="in" id="ag-memo" placeholder="이날의 메모, 일기, 감상…">'+esc((S.notes||{})[k]||"")+"</textarea></div></aside>";
}
function stkById(id){ var md=monthData(curYM()); return (md.stickers||[]).filter(function(s){return s.id===id})[0]; }
function stkHTML(s){
  var st='left:'+(s.x*100)+'%;top:'+(s.y*100)+'%;width:'+(s.w*100)+'%;transform:translate(-50%,-50%) rotate('+(s.rot||0)+'deg);z-index:'+(s.z||1);
  var inner=s.type==="text"?'<span class="tx" style="color:'+esc(s.color||"#18202b")+';background:'+esc(s.bg||"transparent")+';font-size:calc('+(s.w*100)+'cqw / '+Math.max(1.6,(s.text||"").split("\n").reduce(function(m,l){ var n=0; for(var i=0;i<l.length;i++) n+=/[\u3131-\uD79D]/.test(l[i])?1:.62; return Math.max(m,n)},1)+.9)+')">'+esc(s.text)+"</span>":'<img src="'+esc(s.src)+'" alt="">';
  return '<div class="stk'+(DECO&&SELSTK===s.id?" sel":"")+'" data-stk="'+s.id+'" style="'+st+'">'+inner+'<span class="h rs" data-h="rs"></span><span class="h rt" data-h="rt"></span></div>';
}
/* 스티커 끌기 */
var DRAG=null;
app.addEventListener("pointerdown",function(e){
  if(!DECO) return; var el=e.target.closest(".stk"); var dia=$("#diary");
  if(!el){ if(e.target.closest("#diary")&&SELSTK){ SELSTK=null; render(); } return; }
  e.preventDefault(); var s=stkById(el.dataset.stk); if(!s) return;
  if(SELSTK!==s.id){ SELSTK=s.id; $$(".stk").forEach(function(x){ x.classList.toggle("sel",x===el); }); renderDecoBar(); }
  var r=dia.getBoundingClientRect(), h=e.target.dataset.h||"mv";
  DRAG={el:el,s:s,mode:h,r:r,sx:e.clientX,sy:e.clientY,x0:s.x,y0:s.y,w0:s.w,rot0:s.rot||0}; el.setPointerCapture(e.pointerId);
});
app.addEventListener("pointermove",function(e){
  if(!DRAG) return; var d=DRAG, s=d.s, r=d.r;
  if(d.mode==="mv"){ s.x=Math.min(1.05,Math.max(-.05,d.x0+(e.clientX-d.sx)/r.width)); s.y=Math.min(1.05,Math.max(-.05,d.y0+(e.clientY-d.sy)/r.height)); }
  if(d.mode==="rs"){ var cx=r.left+s.x*r.width, cy=r.top+s.y*r.height, d0=Math.hypot(d.sx-cx,d.sy-cy), d1=Math.hypot(e.clientX-cx,e.clientY-cy); s.w=Math.min(1.2,Math.max(.03,d.w0*d1/Math.max(8,d0))); }
  if(d.mode==="rt"){ var cx2=r.left+s.x*r.width, cy2=r.top+s.y*r.height; s.rot=Math.round(Math.atan2(e.clientY-cy2,e.clientX-cx2)*180/Math.PI+90); if(Math.abs(s.rot%90)<4) s.rot=Math.round(s.rot/90)*90; }
  var tmp=document.createElement("div"); tmp.innerHTML=stkHTML(s); var n=tmp.firstChild; n.classList.add("sel"); d.el.replaceWith(n); d.el=n; try{ n.setPointerCapture(e.pointerId); }catch(x){}
});
app.addEventListener("pointerup",function(){ if(!DRAG) return; DRAG=null; saveSoon(); });
function renderDecoBar(){ var st=app.scrollTop; app.innerHTML=calView(); app.scrollTop=st; }
function addTextSticker(s){
  var COL=["#18202b","#ffffff","#e5484d","#4f7cff","#2bb3a3","#f08bb4","#ffb020"];
  var BG=[["transparent","없음"],["#fff8b8","노란 테이프"],["#ffe1ec","분홍 테이프"],["#e3ecff","파란 테이프"],["#18202b","검정"]];
  var isNew=!s; s=s||{id:uid("s"),type:"text",text:"",color:"#18202b",bg:"transparent",x:.5,y:.5,w:.22,rot:-4,z:Date.now()%100000};
  var w=document.createElement("div"); w.className="veil";
  w.innerHTML='<div class="dlg wide"><h3>'+(isNew?"글씨 스티커":"글씨 고치기")+'</h3><label class="fld">글씨<textarea class="in" id="ts-t" placeholder="예: TRPG 데이!">'+esc(s.text)+'</textarea></label><div class="fld">글자 색<div class="sws">'+COL.map(function(c){ return '<span class="sw2'+(s.color===c?" on":"")+'" data-tc="'+c+'" style="background:'+c+'"></span>'; }).join("")+'</div></div><div class="fld">바탕<div class="chips">'+BG.map(function(b){ return '<button data-tb="'+b[0]+'"'+(s.bg===b[0]?' class="on"':"")+">"+b[1]+"</button>"; }).join("")+'</div></div><div class="btns" style="justify-content:flex-end"><button class="btn" data-x="no">취소</button><button class="btn pri" data-x="ok">'+(isNew?"붙이기":"저장")+"</button></div></div>";
  document.body.appendChild(w); setTimeout(function(){ $("#ts-t",w).focus(); },30);
  w.addEventListener("click",function(e){
    if(e.target===w){ w.remove(); return; }
    var tc=e.target.closest("[data-tc]"); if(tc){ s.color=tc.dataset.tc; $$("[data-tc]",w).forEach(function(x){x.classList.toggle("on",x===tc)}); return; }
    var tb=e.target.closest("[data-tb]"); if(tb){ s.bg=tb.dataset.tb; $$("[data-tb]",w).forEach(function(x){x.classList.toggle("on",x===tb)}); return; }
    var x=e.target.closest("[data-x]"); if(!x) return; if(x.dataset.x==="no"){ w.remove(); return; }
    s.text=$("#ts-t",w).value.trim(); if(!s.text){ toast("글씨를 적어 주세요"); return; }
    var md=monthData(curYM()); if(isNew) md.stickers.push(s); SELSTK=s.id; w.remove(); saveSoon(true); render();
  });
}

/* ---------- 일정 끌어서 옮기기 ---------- */
app.addEventListener("dragstart",function(e){ var d=e.target.closest&&e.target.closest("[data-drag]"); if(!d||DECO) return; e.dataTransfer.setData("text/plain",d.dataset.drag); e.dataTransfer.effectAllowed="move"; d.classList.add("dragging"); });
app.addEventListener("dragend",function(e){ $$(".dragging,.drop").forEach(function(x){ x.classList.remove("dragging","drop"); }); });
app.addEventListener("dragover",function(e){ var c=e.target.closest&&e.target.closest(".dc"); if(!c) return; e.preventDefault(); e.dataTransfer.dropEffect="move"; $$(".dc.drop").forEach(function(x){ if(x!==c) x.classList.remove("drop"); }); c.classList.add("drop"); });
app.addEventListener("drop",function(e){
  var c=e.target.closest&&e.target.closest(".dc"); if(!c) return; e.preventDefault();
  var key=e.dataTransfer.getData("text/plain"), k=c.dataset.day; if(!key||!k) return;
  var id=key.slice(2), d=AN.parseYmd(k);
  if(key[0]==="e"){ var ev=(S.events||[]).filter(function(z){return z.id===id})[0]; if(!ev||ev.date===k) return; ev.date=k; toast(ev.title+" → "+fmtDay(k)); }
  else { var an=(S.annivs||[]).filter(function(z){return z.id===id})[0]; if(!an) return; if(an.repeat==="once"&&an.y) an.y=d.getFullYear(); an.m=d.getMonth()+1; an.d=d.getDate(); toast(an.title+" → "+(an.m)+"월 "+an.d+"일"); }
  DAYSEL=k; saveSoon(true); render();
});

/* ---------- 하루 보기 ---------- */
function dayDialog(k){
  var w=document.createElement("div"); w.className="veil";
  function draw(){ var on=AN.on(S,k), d=AN.parseYmd(k);
    var an=AN.all(S).map(function(a){ return {a:a,n:AN.next(a,d)}; }).filter(function(x){ return x.n&&x.n.days===0; });
    w.innerHTML='<div class="dlg wide daydlg"><h3>'+fmtDay(k)+'</h3>'+
      '<div class="sec-t">기념일</div>'+(an.length?an.map(function(x){ return '<button class="item" data-ann="'+esc(x.a.id)+'"><span class="bar" style="background:#ff6fa3"></span>'+(AN.starOf(S,x.a)?avOf(AN.starOf(S,x.a)):"")+'<span class="mid"><b>'+esc(AN.whoName(S,x.a.who))+" · "+esc(x.a.title)+(x.n.label!==x.a.title?" "+esc(x.n.label):"")+"</b><small>"+repName(x.a)+"</small></span></button>"; }).join(""):'<p class="note">없어요</p>')+
      '<div class="sec-t">일정</div>'+(on.events.length?on.events.map(function(e){ return evRow(e,AN.eventDays(e)); }).join(""):'<p class="note">없어요</p>')+
      '<div class="btns" style="margin:8px 0 4px"><button class="btn" data-x="ev">＋ 일정</button><button class="btn" data-x="an">＋ 기념일</button></div>'+
      '<div class="sec-t">메모</div><textarea class="in" id="dd-memo" placeholder="이날의 메모, 일기, 감상…">'+esc((S.notes||{})[k]||"")+'</textarea>'+
      '<div class="btns" style="justify-content:flex-end;margin-top:12px"><button class="btn pri" data-x="close">닫기</button></div></div>';
  }
  draw(); document.body.appendChild(w);
  w.addEventListener("input",function(e){ if(e.target.id==="dd-memo"){ S.notes=S.notes||{}; var v=e.target.value; if(v.trim()) S.notes[k]=v; else delete S.notes[k]; saveSoon(); } });
  w.addEventListener("click",function(e){
    if(e.target===w){ w.remove(); render(); return; }
    var an=e.target.closest("[data-ann]"); if(an){ w.remove(); openAnn(an.dataset.ann); return; }
    var ev=e.target.closest("[data-ev]"); if(ev){ w.remove(); evDialog((S.events||[]).filter(function(z){return z.id===ev.dataset.ev})[0]); return; }
    var x=e.target.closest("[data-x]"); if(!x) return;
    if(x.dataset.x==="close"){ w.remove(); render(); }
    if(x.dataset.x==="ev"){ w.remove(); evDialog(null,{date:k}); }
    if(x.dataset.x==="an"){ var dd=AN.parseYmd(k); w.remove(); annDialog(null,null,{m:dd.getMonth()+1,d:dd.getDate()}); }
  });
}
function openAnn(id0){ if(id0.indexOf("bd-")===0){ SEL=id0.slice(3); VIEW="char"; SUB="basic"; render(); toast("생일은 프로필에서 고쳐요"); return; } annDialog((S.annivs||[]).filter(function(z){return z.id===id0})[0]); }

/* ---------- 일정 ---------- */
var EVF="all";
function eventsView(){
  var list=AN.events(S).filter(function(x){ return EVF==="all"||x.e.cat===EVF; });
  var today=list.filter(function(x){return x.days===0}), soon=list.filter(function(x){return x.days>0}), past=list.filter(function(x){return x.days<0&&x.days>=-60}).reverse();
  var filt='<div class="cats" style="margin-bottom:14px"><button data-evf="all"'+(EVF==="all"?' class="on"':"")+'>전체</button>'+AN.CATS.map(function(c){ return '<button data-evf="'+c[0]+'"'+(EVF===c[0]?' class="on"':"")+'><i style="background:'+c[2]+'"></i>'+c[1]+"</button>"; }).join("")+"</div>";
  var body=(today.length?'<div class="sec-t">오늘</div>'+today.map(function(x){return evRow(x.e,x.days)}).join(""):"")+(soon.length?'<div class="sec-t">다가오는 일정</div>'+soon.map(function(x){return evRow(x.e,x.days)}).join(""):"")+(past.length?'<div class="sec-t">지난 일정 (60일)</div>'+past.map(function(x){return evRow(x.e,x.days)}).join(""):"");
  return '<div class="wrap"><div class="h1">일정</div><p class="lead">TRPG 세션, 마감, 약속, 덕질 이벤트처럼 날짜가 정해진 일을 적어 둬요. 알림을 켜면 그때 바탕화면 캐릭터가 알려 줘요.</p>'+filt+(body||'<div class="empty">아직 일정이 없어요.</div>')+'<div class="btns" style="margin-top:8px"><button class="btn pri" data-act="evadd">＋ 일정 추가</button><span style="flex:1"></span><button class="btn" data-act="evshare">일정 보내기</button><button class="btn" data-act="evrecv">공유받기</button></div></div>';
}
function evDialog(e,preset){
  var isNew=!e; e=e?JSON.parse(JSON.stringify(e)):Object.assign({id:uid("e"),title:"",date:ymdOf(new Date()),time:"",cat:"trpg",who:null,star:null,memo:"",remind:"morning"},preset||{});
  var w=document.createElement("div"); w.className="veil";
  var REM=[["none","알림 없음"],["morning","당일 아침 9시"],["hour","1시간 전"],["day","하루 전"]];
  function whoOpts(){ var v=e.who?e.who.type+":"+e.who.id:""; return '<option value="">없음</option><optgroup label="캐릭터">'+S.tokens.map(function(t){ var k="token:"+t.id; return '<option value="'+k+'"'+(k===v?" selected":"")+">"+esc(t.nick||t.name||"이름 없음")+"</option>"; }).join("")+"</optgroup>"+(S.pairs.length?'<optgroup label="페어">'+S.pairs.map(function(p){ var k="pair:"+p.id; return '<option value="'+k+'"'+(k===v?" selected":"")+">"+esc(p.name||"이름 없는 페어")+"</option>"; }).join("")+"</optgroup>":""); }
  function starOpts(){ if(!e.who) return ""; var ids=e.who.type==="token"?[e.who.id]:((S.pairs.filter(function(p){return p.id===e.who.id})[0]||{}).tokenIds||[]); if(!ids.length) return "";
    var cur=e.star&&ids.indexOf(e.star)>=0?e.star:null;
    return '<label class="fld">그날 바탕화면<select class="in" id="ed-star"><option value="">바꾸지 않기</option>'+ids.map(function(id){ var t=tokById(id); return t?'<option value="'+id+'"'+(id===cur?" selected":"")+">"+esc(t.nick||t.name)+" 꺼내기</option>":""; }).join("")+"</select></label>"; }
  function draw(){
    w.innerHTML='<div class="dlg wide"><h3>'+(isNew?"일정 추가":"일정 고치기")+'</h3>'+
      '<label class="fld">무슨 일정<input class="in" id="ed-t" value="'+esc(e.title)+'" placeholder="예: 〈심해의 등대〉 3회차 세션"></label>'+
      '<div class="fld">종류<div class="cats">'+AN.CATS.map(function(c){ return '<button data-cat="'+c[0]+'"'+(e.cat===c[0]?' class="on"':"")+'><i style="background:'+c[2]+'"></i>'+c[1]+"</button>"; }).join("")+"</div></div>"+
      '<div class="row2"><label class="fld">날짜<input class="in" type="date" id="ed-d" value="'+esc(e.date)+'"></label><label class="fld">시간 (없어도 돼요)<input class="in" type="time" id="ed-time" value="'+esc(e.time||"")+'"></label></div>'+
      '<div class="row2"><label class="fld">함께하는 캐릭터<select class="in" id="ed-who">'+whoOpts()+"</select></label>"+(starOpts()||"<span></span>")+"</div>"+
      '<div class="fld">알림<div class="chips">'+REM.map(function(r){ return '<button data-rem="'+r[0]+'"'+(e.remind===r[0]?' class="on"':"")+">"+r[1]+"</button>"; }).join("")+'</div><span class="note" style="font-weight:400">윈도우 알림이 뜨고 바탕화면 캐릭터가 말해 줘요. 프로그램이 켜져 있어야 해요.</span></div>'+
      '<div class="fld">이미지 <span style="font-weight:400">· 작게 보기 타일에 보여요</span><div class="btns">'+(e.img?'<span class="annthumb" style="background-image:url(\''+esc(e.img)+'\')"></span>':"")+'<label class="btn">'+(e.img?"바꾸기":"이미지 넣기")+'<input type="file" accept="image/*" id="ed-img"></label>'+(e.img?'<button class="btn ghost" data-x="noimg">빼기</button>':"")+'</div></div>'+
      '<div class="fld"><button class="star-t'+(e.pin?" on":"")+'" data-epin="1">'+(e.pin?"★ 강조하는 일정":"☆ 강조하기")+'</button></div>'+
      '<label class="fld">메모<textarea class="in" id="ed-m" placeholder="준비물, 장소, 링크…">'+esc(e.memo||"")+"</textarea></label>"+
      '<div class="btns" style="justify-content:space-between;margin-top:6px">'+(isNew?"<span></span>":'<button class="btn ghost danger" data-x="del">지우기</button>')+'<span class="btns"><button class="btn" data-x="no">취소</button><button class="btn pri" data-x="ok">저장</button></span></div></div>';
  }
  function grab(){ e.title=$("#ed-t",w).value.trim(); e.date=$("#ed-d",w).value; e.time=$("#ed-time",w).value||""; var v=$("#ed-who",w).value; e.who=v?{type:v.split(":")[0],id:v.split(":")[1]}:null; var st=$("#ed-star",w); e.star=st&&st.value?st.value:null; e.memo=$("#ed-m",w).value; }
  draw(); document.body.appendChild(w); setTimeout(function(){ if(!e.title) $("#ed-t",w).focus(); },30);
  w.addEventListener("change",function(ev){ if(ev.target.id==="ed-who"){ grab(); e.star=null; draw(); }
    if(ev.target.id==="ed-img"&&ev.target.files[0]){ grab(); saveFileImg(ev.target.files[0],1000).then(function(u){ if(u){ e.img=u; draw(); } else toast("그림을 못 읽었어요"); }); } });
  w.addEventListener("click",function(ev){
    if(ev.target===w){ w.remove(); return; }
    var c=ev.target.closest("[data-cat]"); if(c){ grab(); e.cat=c.dataset.cat; draw(); return; }
    var r=ev.target.closest("[data-rem]"); if(r){ grab(); e.remind=r.dataset.rem; draw(); return; }
    if(ev.target.closest("[data-epin]")){ grab(); e.pin=!e.pin; draw(); return; }
    if(ev.target.closest("[data-x=noimg]")){ grab(); e.img=null; draw(); return; }
    var x=ev.target.closest("[data-x]"); if(!x) return;
    if(x.dataset.x==="no"){ w.remove(); return; }
    if(x.dataset.x==="del"){ ask("이 일정을 지울까요?","지우기").then(function(ok){ if(!ok) return; S.events=S.events.filter(function(z){return z.id!==e.id}); w.remove(); saveSoon(true); render(); toast("지웠어요"); }); return; }
    grab(); if(!e.title){ toast("일정 이름을 적어 주세요"); return; } if(!AN.parseYmd(e.date)){ toast("날짜를 골라 주세요"); return; }
    S.events=S.events||[]; var i=S.events.findIndex(function(z){return z.id===e.id}); if(i>=0) S.events[i]=e; else S.events.push(e);
    w.remove(); saveSoon(true); render(); toast(e.title+" · "+ddText(AN.eventDays(e)));
  });
}

/* ---------- 작게: D-day 위젯 ---------- */
function upcomingAll(){
  var L=[];
  AN.upcoming(S).forEach(function(x){ var a=x.a, n=x.n; if(n.days<0) return;
    var d=a.y?a.y+"."+String(a.m).padStart(2,"0")+"."+String(a.d).padStart(2,"0"):String(a.m).padStart(2,"0")+"."+String(a.d).padStart(2,"0");
    L.push({days:n.days,title:AN.whoName(S,a.who)+" "+a.title,sub:d,big:AN.bigCount(a,n),color:"#ff5c93",pin:!!a.pin,img:a.img||null,star:AN.starOf(S,a),ann:a.id,today:n.days===0}); });
  AN.events(S).forEach(function(x){ if(x.days<0) return; var e=x.e, c=AN.catOf(e.cat);
    L.push({days:x.days,title:e.title,sub:fmtDay(e.date)+(e.time?" "+e.time:""),big:x.days===0?"D-DAY":"D-"+x.days,color:c[2],time:e.time||"",pin:!!e.pin,img:e.img||null,star:e.star||(e.who&&e.who.type==="token"?e.who.id:null),ev:e.id,today:x.days===0}); });
  return L.sort(function(a,b){ return a.days-b.days||(a.time||"").localeCompare(b.time||""); });
}
function miniTile(x){
  var t=x.star&&tokById(x.star), key=x.ev?'data-ev="'+esc(x.ev)+'"':'data-ann="'+esc(x.ann)+'"';
  var bg=x.img?'background-image:url(\''+esc(x.img)+'\')':'background:linear-gradient(140deg,'+tint(t?t.color:x.color,.38)+','+tint(t?t.color:x.color,.14)+')';
  return '<div class="mtile'+(x.img?" img":"")+(x.pin?" pin":"")+(x.today?" today":"")+'" style="'+bg+'"><button class="mt-hit" '+key+'></button>'+(!x.img&&t?'<span class="mt-tok">'+tokPreview(t)+"</span>":"")+
    '<span class="mt-top"><span class="mt-h" style="color:'+(x.ev?x.color:"#ff8fb8")+'">'+(x.ev?"●":"♥")+'</span><span class="mt-tx"><b>'+esc(x.title)+"</b><small>"+esc(x.sub)+'</small></span></span><span class="mt-n">'+esc(x.big)+'</span><button class="mt-st" data-pin="'+(x.ev?"e:"+esc(x.ev):"a:"+esc(x.ann))+'" title="강조">'+(x.pin?"★":"☆")+"</button></div>";
}
function renderMini(){
  var L=upcomingAll().slice(0,24), h="";
  if(!L.length) h='<div class="memo" style="padding:24px 12px;text-align:center;color:var(--sub);font-size:12.5px">다가오는 일정이 없어요</div>';
  else h='<div class="mgrid">'+L.map(miniTile).join("")+"</div>";
  h+='<div class="mfoot"><button data-mexp="1">전체 화면</button><button data-madd="1">＋ 일정</button></div>';
  var ts=(S.settings||{}).miniTile||"m";
  $("#minibody").innerHTML=h; $("#minibody").setAttribute("data-ts",ts);
  $("#pinbtn").classList.toggle("on",!!(S.settings||{}).miniPin);
  var tb=$("#tsbtn"); if(tb) tb.textContent={s:"S",m:"M",l:"L"}[ts];
}
function togglePin(key){
  var k=key.slice(2);
  if(key[0]==="e"){ var e=(S.events||[]).filter(function(z){return z.id===k})[0]; if(e) e.pin=!e.pin; }
  else if(k.indexOf("bd-")===0){ var t=tokById(k.slice(3)); if(t) t.birthdayPin=!t.birthdayPin; }
  else { var a=(S.annivs||[]).filter(function(z){return z.id===k})[0]; if(a) a.pin=!a.pin; }
  saveSoon(true); render();
}
var COMPACT=false;
function checkCompact(){ var c=window.innerWidth<560; if(c!==COMPACT){ COMPACT=c; document.body.classList.toggle("compact",c); render(); } }
window.addEventListener("resize",checkCompact);
$("#mini").addEventListener("click",function(e){
  var tsb=e.target.closest("#tsbtn"); if(tsb){ var ord=["s","m","l"], cur0=(S.settings||{}).miniTile||"m"; setCfg("miniTile",ord[(ord.indexOf(cur0)+1)%3]); renderMini(); return; }
  var wb=e.target.closest("[data-win]"); if(wb){ api.win(wb.dataset.win); if(wb.dataset.win==="pin"){ S.settings.miniPin=!S.settings.miniPin; renderMini(); } return; }
  if(e.target.closest("[data-mexp]")){ api.win("expand"); return; }
  if(e.target.closest("[data-madd]")){ evDialog(null); return; }
  var pn=e.target.closest("[data-pin]"); if(pn){ togglePin(pn.dataset.pin); return; }
  var ev=e.target.closest("[data-ev]"); if(ev){ evDialog((S.events||[]).filter(function(z){return z.id===ev.dataset.ev})[0]); return; }
  var an=e.target.closest("[data-ann]"); if(an){ if(an.dataset.ann.indexOf("bd-")===0){ toast("생일은 캐릭터 정보에서 고쳐요 (크게 보기)"); } else annDialog((S.annivs||[]).filter(function(z){return z.id===an.dataset.ann})[0]); }
});

/* ---------- 그리기 ---------- */
function render(){
  document.body.classList.toggle("otaku",(S.settings||{}).look==="otaku");
  if(S.tokens.length&&!tokById(SEL)) SEL=S.tokens[0].id;
  if(COMPACT){ renderMini(); return; }
  var t=tokById(SEL); setAccent(VIEW==="char"?t:null);
  renderSide();
  var st=app.scrollTop;
  app.innerHTML=VIEW==="home"?homeView():VIEW==="cal"?calView():VIEW==="events"?eventsView():VIEW==="char"?charView():VIEW==="pair"?pairView():VIEW==="anniv"?annivView():setView();
  app.scrollTop=st;
  $("#crumb").textContent=VIEW==="char"?(t?"캐릭터 · "+(t.nick||t.name||"이름 없음"):"캐릭터"):({home:"홈",cal:"다이어리 달력",events:"일정",pair:"페어",anniv:"기념일",set:"설정"})[VIEW]||"";
  if(VIEW==="char"&&t) drawZones();
  if(VIEW==="home"&&t) ZMAP=null;
  if(VIEW==="set") ovSync();
  $$('input[type=range]').forEach(fillRange);
  api.version().then(function(v){ $("#ver").textContent="v"+v; var v2=$("#ver2"); if(v2) v2.textContent="v"+v; });
}

/* ---------- 이벤트 ---------- */
document.querySelector(".rail").addEventListener("click",function(e){
  var s=e.target.closest("[data-sel]"); if(s){ if(SEL!==s.dataset.sel||VIEW!=="char") app.scrollTop=0; SEL=s.dataset.sel; VIEW="char"; render(); return; }
  var n=e.target.closest("[data-nav]"); if(n){ VIEW=n.dataset.nav; DECO=false; SELSTK=null; app.scrollTop=0; render(); return; }
  var a=e.target.closest("[data-act=new]"); if(a) addChooser();
});
document.querySelector(".tb").addEventListener("click",function(e){ var b=e.target.closest("[data-win]"); if(b) api.win(b.dataset.win); });
function cur(){ return tokById(SEL); }
function setSize(n,soft){ var t=cur(); n=Math.max(80,Math.min(400,Math.round(n/10)*10||160)); t.desk=Object.assign({},t.desk,{size:n}); var v=$("#o-size-v"); if(v) v.textContent=n+"px"; var r=$("#o-size"); if(r) r.value=n; saveSoon(!soft); }
function zk(el,attr){ return el.getAttribute(attr).split("|"); }
function toggleTile(id){
  var t=cur(), c=S.settings||{};
  if(id.indexOf("o-")===0&&t){ t.desk=Object.assign({size:160},t.desk||{}); t.motion=t.motion||{};
    if(id==="o-shadow") t.desk.noShadow=!t.desk.noShadow; if(id==="o-flip") t.desk.flip=!t.desk.flip; if(id==="o-lock") t.desk.lock=!t.desk.lock; if(id==="o-br") t.motion.breathe=t.motion.breathe===false; if(id==="o-idlev") t.idleVoice=!t.idleVoice; if(id==="o-fx") t.fxOff=!t.fxOff; if(id==="o-pet") t.petOff=!t.petOff; if(id==="o-tilt"){ t.motion.idleTilt=!t.motion.idleTilt; if(t.motion.idleTilt){ var st0=$("#zst .stage"); if(st0) Z.idleTilt(st0); } } saveSoon(true); render(); return; }
  if(id==="k-clicker"||id==="k-img"){ t.kind=id==="k-img"?"img":"clicker"; saveSoon(true); render(); return; }
  if(id==="s-pin") setCfg("pinned",c.pinned===false);
  if(id==="s-through") setCfg("clickThrough",c.clickThrough===false);
  if(id==="s-hide") setCfg("allHidden",!c.allHidden);
  if(id==="s-login") setCfg("launchAtLogin",c.launchAtLogin===false);
  if(id==="s-mute") setCfg("mute",!c.mute);
  if(id==="s-swap") setCfg("annivSwap",c.annivSwap===false);
  if(id==="s-notify") setCfg("annivNotify",c.annivNotify===false);
  render();
}
app.addEventListener("click",function(e){
  var t=cur();
  var zst=e.target.closest("#zst"); if(zst&&zst.dataset.tid){ var tz=tokById(zst.dataset.tid), tkz=$(".tok",zst); if(tz&&tkz){ var zz2=Z.zonesFor(tz); pokeAt(tkz,tz,zz2[Math.floor(Math.random()*zz2.length)]); } return; }
  if(zst&&t){ var tk=$(".tok",zst), stg=$(".stage",tk), r=stg.getBoundingClientRect(), inner=$(".ck,.one",stg)||stg, ir=inner.getBoundingClientRect();
    var zone=Z.at(ZMAP,(e.clientX-ir.left)/ir.width,(e.clientY-ir.top)/ir.height), lab=$("#zlab");
    if(!zone){ if(lab) lab.textContent="그림 바깥이에요. 캐릭터 위를 눌러 주세요."; return; }
    pokeAt(tk,t,zone,e.clientX-r.left,e.clientY-r.top);
    var zz=Z.ZONES.filter(function(x){return x[0]===zone})[0]; if(lab) lab.innerHTML='<span class="zdot" style="background:'+zz[2]+';margin-right:6px;vertical-align:-1px"></span>'+zz[3]+" 눌렀어요"; return; }
  var pd=e.target.closest("[data-partdel]"); if(pd&&t){ e.preventDefault(); delete t.parts[pd.dataset.partdel]; saveSoon(true); render(); return; }
  var tl=e.target.closest("[data-tile]"); if(tl){ toggleTile(tl.dataset.tile); return; }
  var sb=e.target.closest("[data-sub]"); if(sb){ SUB=sb.dataset.sub; render(); return; }
  var zt=e.target.closest("[data-ztest]"); if(zt&&t){ var tk2=$("#zst .tok"); if(tk2){ pokeAt(tk2,t,zt.dataset.ztest); app.scrollTo({top:0,behavior:"smooth"}); } return; }
  var zm=e.target.closest("[data-zm]"); if(zm){ var a1=zk(zm,"data-zm"); Z.set(t,a1[0],"motion",a1[1]); saveSoon(); render(); return; }
  var zx=e.target.closest("[data-zx]"); if(zx){ var a2=zk(zx,"data-zx"); Z.set(t,a2[0],"fx",a2[1]); saveSoon(); render(); return; }
  var ps=e.target.closest("[data-persona]"); if(ps&&t){ if(t.persona===ps.dataset.persona){ clearPersona(t); toast("성격 고정을 풀었어요 · 원래 반응으로 돌아가요"); } else applyPersona(t,ps.dataset.persona); saveSoon(true); render(); var tkp=$("#zst .tok"); if(tkp){ var zz=Z.zonesFor(t); pokeAt(tkp,t,zz[0]); } return; }
  var vc=e.target.closest("[data-voice]"); if(vc&&t){ t.voice=vc.dataset.voice; saveSoon(true); render(); var cv=S.settings||{}; if(t.voice!=="mix") Z.sound(t.voice,typeof cv.volume==="number"?cv.volume:.5); return; }
  var bb=e.target.closest("[data-babble]"); if(bb&&t){ t.babble=bb.dataset.babble; saveSoon(true); render(); var tkb2=$("#zst .tok"); if(tkb2&&t.babble!=="none"){ var SAMP=["안녕! 오늘 뭐 해?","나 불렀어? 무슨 일이야!","…그래, 알겠어.","기념일까지 사흘 남았어!"]; say(tkb2,pickLine(t,(t.lines&&t.lines.length?t.lines:SAMP),"bb")||SAMP[0],false,t,"speech"); } return; }
  var lg=e.target.closest("[data-lgsel]"); if(lg){ LGSEL=lg.dataset.lgsel; render(); return; }
  var zs=e.target.closest("[data-zs]"); if(zs){ var a5=zk(zs,"data-zs"); Z.set(t,a5[0],"sound",a5[1]); var cc=S.settings||{}; Z.sound(a5[1],typeof cc.volume==="number"?cc.volume:.5); saveSoon(); render(); return; }
  var zb=e.target.closest("[data-zb]"); if(zb){ var a6=zk(zb,"data-zb"); Z.set(t,a6[0],"bubble",a6[1]); saveSoon(); render(); var tk4=$("#zst .tok"); if(tk4) say(tk4,Z.composeLine(a6[1],"이런 말풍선이야"),false,t,a6[1]); return; }
  var zf=e.target.closest("[data-zf]"); if(zf&&!zf.disabled){ var a3=zk(zf,"data-zf"); Z.set(t,a3[0],"face",a3[1]); saveSoon(); render(); return; }
  var gl=e.target.closest("[data-golines]"); if(gl){ SUB="talk"; LGSEL=gl.dataset.golines; render(); return; }
  var la=e.target.closest("[data-lnadd]"); if(la){ var g=la.dataset.lnadd; getLines(t,g).push(""); saveSoon(); render(); var ins=$$('#lg-'+g+' [data-ln]'); if(ins.length) ins[ins.length-1].focus(); return; }
  var lb=e.target.closest("[data-lnb]"); if(lb){ var a7=zk(lb,"data-lnb"), arr7=getLines(t,a7[0]), def7=lineDef(t,a7[0]), p7=Z.parseLine(arr7[+a7[1]],def7);
    var order=["auto","shout","thought","imagine","sfx","speech"], curS=p7.auto?"auto":p7.style, nx=order[(order.indexOf(curS)+1)%order.length]; if(nx===def7&&nx!=="auto") nx=order[(order.indexOf(nx)+1)%order.length];
    arr7[+a7[1]]=nx==="auto"?p7.text:Z.composeLine(nx,p7.text); saveSoon(); render(); var tk5=$("#zst .tok"); if(tk5&&p7.text) say(tk5,arr7[+a7[1]],false,t,def7); return; }
  var ld=e.target.closest("[data-lndel]"); if(ld){ var a4=zk(ld,"data-lndel"); getLines(t,a4[0]).splice(+a4[1],1); saveSoon(); render(); return; }
  var an=e.target.closest("[data-ann]"); if(an){ openAnn(an.dataset.ann); return; }
  var evb=e.target.closest("[data-ev]"); if(evb){ evDialog((S.events||[]).filter(function(z){return z.id===evb.dataset.ev})[0]); return; }
  var dy=e.target.closest("[data-day]"); if(dy&&!DECO){ DAYSEL=dy.dataset.day; render(); return; }
  var ng=e.target.closest("[data-nav-go]"); if(ng){ VIEW=ng.dataset.navGo; app.scrollTop=0; render(); return; }
  var sg=e.target.closest("[data-sel-go]"); if(sg){ SEL=sg.dataset.selGo; VIEW="char"; SUB="basic"; app.scrollTop=0; render(); return; }
  var ef=e.target.closest("[data-evf]"); if(ef){ EVF=ef.dataset.evf; render(); return; }
  var am=e.target.closest("[data-annmode]"); if(am){ ANNMODE=am.dataset.annmode; render(); return; }
  var lk=e.target.closest("[data-look]"); if(lk){ setCfg("look",lk.dataset.look); render(); return; }
  var acc=e.target.closest("[data-accent]"); if(acc){ setCfg("accent",acc.dataset.accent); render(); return; }
  var ld2=e.target.closest("[data-lead]"); if(ld2){ setCfg("annivLead",+ld2.dataset.lead); render(); return; }
  var wsb=e.target.closest("[data-wstyle]"); if(wsb){ setCfg("widgetStyle",wsb.dataset.wstyle); saveSoon(true); render(); toast("위젯 모양을 바꿨어요 · 홈 화면에서 확인해 보세요"); return; }
  var th=e.target.closest("[data-theme]"); if(th){ setCfg("theme",th.dataset.theme); render(); return; }
  var sz=e.target.closest("[data-size]"); if(sz){ setSize(+sz.dataset.size); return; }
  var mm=e.target.closest("[data-mem]"); if(mm){ var p=pairOf(mm), id=mm.dataset.mem, i=p.tokenIds.indexOf(id); if(i>=0) p.tokenIds.splice(i,1); else p.tokenIds.push(id); mm.classList.toggle("on"); saveSoon(); if(S.settings.duo===p.id||p.tokenIds.length<=3) render(); return; }
  var b=e.target.closest("[data-act]"); if(!b) return; var a=b.dataset.act;
  if(a==="new") addChooser();
  if(a==="main"&&t){ setCfg("main",t.id); render(); var pk2=pickNow(); toast(pk2&&pk2.anniv&&pk2.id!==t.id?"기본 캐릭터로 정했어요 · 오늘 기념일이 끝나면 나와요":"기본 캐릭터로 정했어요"); }
  if(a==="annadd") annDialog(null,b.dataset.who);
  if(a==="evadd") evDialog(null);
  if(a==="hpoke"){ var ht2=tokById(b.dataset.tid), tkh=$("#zst .tok"); if(ht2&&tkh){ var zh=Z.zonesFor(ht2); pokeAt(tkh,ht2,zh[0]); } return; }
  if(a==="smp-del"){ S.annivs=(S.annivs||[]).filter(function(x){return !x.sample}); S.events=(S.events||[]).filter(function(x){return !x.sample}); saveSoon(true); render(); toast("예시를 지웠어요"); return; }
  if(a==="ob-skip"){ setCfg("onboardDone",true); render(); return; }
  if(a==="ob-go"){ var nm=($("#ob-name").value||"").trim(); if(!nm){ toast("이름을 넣어 주세요"); $("#ob-name").focus(); return; }
    var bm=+$("#ob-m").value||null, bd=+$("#ob-d").value||null, f=$("#ob-img").files[0];
    var mk=function(src){ var tn={id:uid("t"),kind:"img",name:nm,nick:nm,nameEn:"",color:"#6b86c9",img:src?{src:src}:null,parts:{},lines:["안녕!","불렀어?"],idleLines:["…심심해."],motion:{breathe:true,idleTilt:true},zones:{},birthday:(bm&&bd)?{m:bm,d:bd}:null,desk:{size:180},babble:"mid",voice:"mix"};
      applyPersona(tn,"sweet"); S.tokens.push(tn); S.settings.main=tn.id; setCfg("main",tn.id); setCfg("onboardDone",true); saveSoon(true); SEL=tn.id; VIEW="char"; SUB="basic"; render(); toast(nm+" 캐릭터를 만들었어요. 이제 바탕화면에 나와요"); };
    if(f){ var fr=new FileReader(); fr.onload=function(){ api.saveImage(fr.result).then(function(u){ mk(u||fr.result); }); }; fr.readAsDataURL(f); } else mk(null);
    return; }
  if(a==="evshare") shareDialog();
  if(a==="evrecv") recvDialog();
  if(a==="ag-ev") evDialog(null,{date:DAYSEL});
  if(a==="ag-an"){ var dd0=AN.parseYmd(DAYSEL); annDialog(null,null,{m:dd0.getMonth()+1,d:dd0.getDate()}); }
  if(a==="m-prev"||a==="m-next"){ var ym=curYM(), dd=new Date(+ym.slice(0,4),+ym.slice(5,7)-1+(a==="m-prev"?-1:1),1); CALM=dd.getFullYear()+"-"+String(dd.getMonth()+1).padStart(2,"0"); SELSTK=null; render(); }
  if(a==="m-today"){ CALM=null; DAYSEL=null; render(); }
  if(a==="deco"){ DECO=!DECO; SELSTK=null; render(); }
  if(a==="d-bgdel"){ monthData(curYM()).bg=null; saveSoon(true); render(); }
  if(a==="d-txt") addTextSticker(null);
  if(a==="d-edit"){ var s0=stkById(SELSTK); if(s0) addTextSticker(s0); }
  if(a==="d-del"){ var md=monthData(curYM()); md.stickers=md.stickers.filter(function(s){return s.id!==SELSTK}); SELSTK=null; saveSoon(true); render(); }
  if(a==="d-up"||a==="d-down"){ var s1=stkById(SELSTK); if(s1){ var zs=monthData(curYM()).stickers.map(function(s){return s.z||0}); s1.z=a==="d-up"?Math.max.apply(null,zs)+1:Math.min.apply(null,zs)-1; saveSoon(true); render(); } }
  if(a==="poke"&&t){ var tk3=$("#zst .tok"), zs=Z.zonesFor(t); if(tk3) pokeAt(tk3,t,zs[Math.floor(Math.random()*zs.length)]); }
  if(a==="bubtest"&&t){ var tkb=$("#zst .tok"); if(tkb) say(tkb,pickLine(t,t.lines||[],"bt")||"여기쯤 떠요",false,t,"speech"); return; }
  if(a==="bubreset"&&t){ delete t.bubblePos; saveSoon(true); render(); return; }
  if(a==="zshow"){ SHOWZ=!SHOWZ; b.classList.toggle("on",SHOWZ); var zs=$("#zst"); if(zs) zs.classList.toggle("show",SHOWZ); }
  if(a==="del") ask("'"+(t.nick||t.name||"이 캐릭터")+"'를 지울까요? 되돌릴 수 없어요.","지우기").then(function(ok){ if(!ok) return; var id=SEL; S.tokens=S.tokens.filter(function(z){return z.id!==id}); S.pairs.forEach(function(p){p.tokenIds=p.tokenIds.filter(function(z){return z!==id})}); S.annivs=(S.annivs||[]).filter(function(z){ return !(z.who&&z.who.type==="token"&&z.who.id===id); }); (S.events||[]).forEach(function(z){ if(z.who&&z.who.type==="token"&&z.who.id===id) z.who=null; if(z.star===id) z.star=null; }); if(S.settings.main===id){ S.settings.main=null; setCfg("main",null); } SEL=null; SUB="basic"; saveSoon(true); render(); toast("지웠어요"); });
  if(a==="pduo"){ var pd=pairOf(b); setCfg("duo",S.settings.duo===pd.id?"":pd.id); saveSoon(true); render(); toast(S.settings.duo?"바탕화면에 둘이 같이 나와요":"한 명만 나와요"); return; }
  if(a==="dlauto"||a==="dlvoice"){ var pz=pairOf(b), kz=a==="dlauto"?"duoAuto":"duoVoice"; pz[kz]=pz[kz]===false; saveSoon(true); render(); toast(a==="dlauto"?(pz.duoAuto?"가끔 저절로 대화해요":"저절로 대화하지 않아요 · 우클릭 [둘이 이야기하기]로는 할 수 있어요"):(pz.duoVoice?"대화할 때 말소리가 나요":"대화는 소리 없이 말풍선만 떠요")); return; }
  if(/^(dlgadd|dlgdel|dlgdef|dladd|dldel|dlwho|dlsty|dlmo|dlgplay)$/.test(a)){ var pq=pairOf(b), ids2=pq.tokenIds.filter(function(id){return tokById(id)}).slice(0,5), D2=pairDialogs(pq,ids2)||[], i2=+b.dataset.i, j2=+b.dataset.j, c2=D2[i2];
    if(a==="dlgplay"){ saveSoon(true); setTimeout(function(){ setCfg("talkNow",{i:i2,at:Date.now()}); },300); return; }
    if(a==="dlgadd") D2.push([{w:0,t:"",s:""},{w:1,t:"",s:""}]);
    if(a==="dlgdef") D2=defDialogs();
    if(a==="dlgdel") D2.splice(i2,1);
    if(a==="dladd"&&c2){ var lw=c2.length?c2[c2.length-1].w||0:-1; c2.push({w:(lw+1)%Math.max(2,ids2.length),t:"",s:""}); }
    if(a==="dldel"&&c2){ c2.splice(j2,1); if(!c2.length) D2.splice(i2,1); }
    if(a==="dlwho"&&c2&&c2[j2]) c2[j2].w=((c2[j2].w||0)+1)%Math.max(2,ids2.length);
    if(a==="dlmo"&&c2&&c2[j2]){ var km=DLG_MO.map(function(x){return x[0]}); c2[j2].m=km[(km.indexOf(c2[j2].m||"")+1)%km.length]; }
    if(a==="dlsty"&&c2&&c2[j2]){ var ks=DLG_STY.map(function(x){return x[0]}); c2[j2].s=ks[(ks.indexOf(c2[j2].s||"")+1)%ks.length]; }
    pq.dialogs=D2; delete pq.talks; saveSoon(true); render();
    if(a==="dladd"||a==="dlgadd"){ var ii=a==="dlgadd"?D2.length-1:i2, rows=$$('[data-pair="'+pq.id+'"] [data-dlg="'+ii+'"] .dl-t'), tgt=a==="dlgadd"?rows[0]:rows[rows.length-1]; if(tgt) tgt.focus(); }
    return; }
  if(a==="ptalk"){ saveSoon(true); setTimeout(function(){ setCfg("talkNow",Date.now()); },300); return; }
  if(a==="pnew"){ S.pairs.push({id:uid("p"),name:"",tokenIds:[]}); saveSoon(true); render(); }
  if(a==="pdel"){ var p2=pairOf(b); ask("이 페어를 풀까요? 캐릭터는 그대로 남아요.","풀기").then(function(ok){ if(!ok) return; S.pairs=S.pairs.filter(function(z){return z!==p2}); S.annivs=(S.annivs||[]).filter(function(z){ return !(z.who&&z.who.type==="pair"&&z.who.id===p2.id); }); saveSoon(true); render(); }); }
  if(a==="charexpall"){ if(!S.tokens.length){ toast("내보낼 캐릭터가 없어요"); return; } var all=S.tokens.map(function(x){ var c=JSON.parse(JSON.stringify(x)); delete c._cfg; return c; });
    api.saveFile("캐릭터-전체-"+new Date().toISOString().slice(0,10)+".ddchar",JSON.stringify({format:"dday-chars",v:1,saved:new Date().toISOString(),tokens:all})).then(function(ok){ if(ok) toast("캐릭터 "+all.length+"명을 파일 하나로 만들었어요"); }); return; }
  if(a==="ovperm"){ window.ddOverlay.permission(); return; }
  if(a==="ovon"){ window.ddOverlay.start().then(function(r){ if(r&&r.ok===false){ toast("먼저 권한을 허용해 주세요"); } else toast("화면에 캐릭터를 띄웠어요. 홈으로 나가서 확인해 보세요"); setTimeout(ovSync,500); }); return; }
  if(a==="ovoff"){ window.ddOverlay.stop().then(function(){ toast("캐릭터를 숨겼어요"); setTimeout(ovSync,300); }); return; }
  if(a==="updcheck"){ var chk=api.checkUpdate||window.ddCheckUpdate; if(!chk){ toast("이 화면에서는 늘 최신이에요"); return; } b.disabled=true; b.textContent="확인하는 중…";
    chk().then(function(info){ UPD=info||{err:true}; render(); if(info&&info.newer) toast("새 버전 "+info.ver+"이 나왔어요"); else if(info&&!info.err) toast("지금 최신 버전이에요"); else toast("확인하지 못했어요 · 인터넷 연결을 봐 주세요"); }); return; }
  if(a==="updget"&&UPD&&UPD.url){ (api.openUrl?api.openUrl(UPD.url):window.open(UPD.url,"_blank")); return; }
  if(a==="charexp"&&t){ var tc=JSON.parse(JSON.stringify(t)); delete tc._cfg; var fn=(t.nick||t.name||"캐릭터").replace(/[\\/:*?"<>|]/g,"_")+".ddchar";
    api.saveFile(fn,JSON.stringify({format:"dday-char",v:1,saved:new Date().toISOString(),token:tc})).then(function(ok){ if(ok) toast("캐릭터 파일을 만들었어요"); }); return; }
  if(a==="backup"){ var txt=JSON.stringify({format:"oca-dday-backup",v:1,saved:new Date().toISOString(),tokens:S.tokens,pairs:S.pairs,annivs:S.annivs||[],events:S.events||[],diary:S.diary||{},notes:S.notes||{}}); api.saveFile("dday-backup-"+new Date().toISOString().slice(0,10)+".json",txt).then(function(ok){ if(ok) toast("백업 파일을 만들었어요"); }); }
  if(a==="folder") api.openFolder();
});
function pairOf(el){ var id=el.closest("[data-pair]").dataset.pair; return S.pairs.filter(function(p){return p.id===id})[0]; }
app.addEventListener("input",function(e){
  var el=e.target, t=cur(); if(el.type==="range") fillRange(el);
  if(el.dataset.pf){ pairOf(el)[el.dataset.pf]=el.value; saveSoon(); return; }
  if(el.dataset.dl){ var pd2=pairOf(el), ij=el.dataset.dl.split("|"), ln2=pd2.dialogs&&pd2.dialogs[+ij[0]]&&pd2.dialogs[+ij[0]][+ij[1]]; if(ln2){ ln2.t=el.value; saveSoon(); } return; }
  if(el.id==="ag-memo"){ S.notes=S.notes||{}; if(el.value.trim()) S.notes[DAYSEL]=el.value; else delete S.notes[DAYSEL]; saveSoon(); var c0=$('.dc[data-day="'+DAYSEL+'"]'); if(c0){ var mm=$(".memo2",c0); if(el.value.trim()&&!mm){ c0.insertAdjacentHTML("beforeend",'<span class="memo2"></span>'); } if(!el.value.trim()&&mm) mm.remove(); } return; }
  if(el.dataset.ln){ var a=el.dataset.ln.split("|"), arr=getLines(t,a[0]), p0=Z.parseLine(arr[+a[1]],lineDef(t,a[0])); arr[+a[1]]=p0.auto?el.value:Z.composeLine(p0.style,el.value); saveSoon(); return; }
  if(el.id==="b-y"||el.id==="b-x"){ t.bubblePos=t.bubblePos||{}; var bv=+el.value; t.bubblePos[el.id==="b-y"?"y":"x"]=bv; $("#"+el.id+"-v").textContent=el.id==="b-y"?bubLbl(bv,"위","아래"):bubLbl(bv,"오른쪽","왼쪽"); saveSoon(); clearTimeout(window._bubT); window._bubT=setTimeout(function(){ var tk=$("#zst .tok"); if(tk) say(tk,"여기쯤 떠요",false,t,"speech"); },120); return; }
  if(el.id==="bb-p"||el.id==="bb-s"){ if(el.id==="bb-p"){ t.babblePitch=+el.value; $("#bb-p-v").textContent=ptLbl(t.babblePitch); } else { t.babbleSpeed=(+el.value)/100; $("#bb-s-v").textContent=spLbl(t.babbleSpeed); } saveSoon(); clearTimeout(window._bbT); window._bbT=setTimeout(function(){ bbSample(t); },250); return; }
  if(el.id==="pet-lines"&&t){ t.petLines=el.value.split("\n").map(function(x){return x.trim()}).filter(Boolean); saveSoon(); return; }
  if(el.id==="z-split"){ t.zoneSplit=(+el.value)/100; $("#z-split-v").textContent=el.value+"%"; drawZones(); saveSoon(); return; }
  if(el.id==="z-split2"){ t.zoneSplit2=(+el.value)/100; $("#z-split2-v").textContent=el.value+"%"; drawZones(); saveSoon(); return; }
  if(el.id==="o-size"){ setSize(+el.value,true); return; }
  if(el.id==="d-bgop"){ var md2=monthData(curYM()); md2.bgOp=(+el.value)/100; $("#diary").style.setProperty("--bgop",md2.bgOp); return; }
  if(el.id==="d-cellop"){ var md3=monthData(curYM()); md3.cellOp=(+el.value)/100; $("#diary").style.setProperty("--cellop",md3.cellOp); return; }
  if(el.id==="s-vvol"){ S.settings.voiceVol=(+el.value)/100; $("#s-vvol-v").textContent=el.value+"%"; clearTimeout(window._vvT); window._vvT=setTimeout(function(){ setCfg("voiceVol",S.settings.voiceVol); var tt=tokById((S.settings||{}).main)||S.tokens[0]; if(tt&&tt.babble&&tt.babble!=="none") Zones.typeOut(document.createElement("span"),"안녕, 이 정도 크기야!",tt.babble,S.settings.voiceVol,"speech",{pitch:tt.babblePitch||0,speed:tt.babbleSpeed||1,free:true}); },200); return; }
  if(el.id==="s-vol"){ $("#s-vol-v").textContent=el.value+"%"; S.settings.volume=(+el.value)/100; return; }
  if(!el.dataset.f||!t) return; var f=el.dataset.f;
  if(f==="name"||f==="nick"||f==="nameEn") t[f]=el.value.trim();
  if(f==="color"){ t.color=el.value; var tx=$('[data-f="colorTxt"]'); if(tx) tx.value=el.value; setAccent(t); }
  if(f==="colorTxt"&&/^#[0-9a-f]{6}$/i.test(el.value.trim())){ t.color=el.value.trim(); $('[data-f="color"]').value=t.color; setAccent(t); }
  saveSoon();
  if(f==="nick"||f==="name"){ renderSide(); $("#crumb").textContent="캐릭터 · "+(t.nick||t.name||"이름 없음"); }
});
app.addEventListener("focusout",function(e){ var el=e.target; if(!el.dataset||!el.dataset.ln) return; setTimeout(function(){ if(document.activeElement&&document.activeElement.dataset&&document.activeElement.dataset.ln) return; var t=cur(); if(!t) return; var changed=false; lineGroups(t).forEach(function(g){ var arr=getLines(t,g[0]); for(var i=arr.length-1;i>=0;i--) if(!String(arr[i]).trim()){ arr.splice(i,1); changed=true; } }); if(changed){ saveSoon(); render(); } },150); });
app.addEventListener("change",function(e){
  var el=e.target, t=cur();
  if(el.id==="o-size"){ setSize(+el.value); return; }
  if(el.id==="b-y"||el.id==="b-x"){ saveSoon(true); return; }
  if(el.id==="bb-p"||el.id==="bb-s"){ saveSoon(true); return; }
  if(el.id==="z-split"||el.id==="z-split2"){ saveSoon(true); return; }
  if(el.id==="d-bg"&&el.files[0]){ toast("배경을 넣는 중…"); saveFileImg(el.files[0],1800).then(function(u){ if(!u){ toast("그림을 못 읽었어요"); return; } monthData(curYM()).bg=u; saveSoon(true); render(); }); el.value=""; return; }
  if(el.id==="d-stk"&&el.files.length){ var fs=Array.prototype.slice.call(el.files), md=monthData(curYM()), n0=md.stickers.length;
    Promise.all(fs.map(function(f){ return saveFileImg(f,700); })).then(function(us){ us.forEach(function(u,i){ if(u) md.stickers.push({id:uid("s"),type:"img",src:u,x:.3+((n0+i)%5)*.1,y:.35+((n0+i)%3)*.12,w:.16,rot:0,z:n0+i+1}); }); SELSTK=md.stickers.length?md.stickers[md.stickers.length-1].id:null; saveSoon(true); render(); });
    el.value=""; return; }
  if(el.id==="d-bgop"||el.id==="d-cellop"){ saveSoon(true); return; }
  if(el.id==="s-acc-custom"){ setCfg("accent",el.value); render(); return; }
  if(el.id==="s-vol"){ setCfg("volume",(+el.value)/100); Z.sound("pen",(+el.value)/100); return; }
  if(el.dataset&&(el.dataset.f==="bm"||el.dataset.f==="bd")){ var m=+$('[data-f="bm"]').value, d=+$('[data-f="bd"]').value; t.birthday=m&&d?{m:m,d:d}:null; saveSoon(); return; }
  if(el.dataset&&el.dataset.f==="color"){ saveSoon(true); renderSide(); return; }
  if(el.dataset&&el.dataset.part&&el.files[0]){ var k=el.dataset.part; fileToURL(el.files[0]).then(storeImg).then(function(img){ if(k==="img") t.img=img; else { t.parts=t.parts||{}; t.parts[k]=img; } saveSoon(true); render(); }).catch(function(){ toast("그림을 못 읽었어요"); }); }
  if(el.id==="rf"&&el.files[0]){ var r=new FileReader(); r.onload=function(){ var d2; try{ d2=JSON.parse(r.result); if(d2.format!=="oca-dday-backup") throw 0; }catch(x){ toast("백업 파일이 아니에요"); return; } ask("지금 내용을 백업 내용으로 바꿀까요?","바꾸기").then(function(ok){ if(!ok) return; S.tokens=d2.tokens||[]; S.pairs=d2.pairs||[]; S.annivs=d2.annivs||[]; S.events=d2.events||[]; S.diary=d2.diary||{}; S.notes=d2.notes||{}; SEL=null; saveSoon(true); render(); toast("백업으로 되돌렸어요"); }); }; r.readAsText(el.files[0]); el.value=""; }
});
document.addEventListener("keydown",function(e){ if(e.key==="Escape") $$(".veil").forEach(function(x){x.remove()}); });

/* ---------- 시작 ---------- */
api.getState().then(function(d){ COMPACT=window.innerWidth<560; document.body.classList.toggle("compact",COMPACT); S=d; S.tokens=S.tokens||[]; S.pairs=S.pairs||[]; S.annivs=S.annivs||[]; S.events=S.events||[]; S.diary=S.diary||{}; S.notes=S.notes||{}; S.settings=S.settings||{}; render(); });
api.onState(function(d){ d.annivs=d.annivs||[]; d.events=d.events||[]; d.diary=d.diary||{}; d.notes=d.notes||{}; var focus=document.activeElement&&/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName); S=d; if(!focus) render(); else renderSide(); });
api.onEdit(function(id){ VIEW="char"; SUB="basic"; SEL=id; app.scrollTop=0; render(); });

/* ---------- 떠 있는 이름표 (아이콘에 마우스를 올리면) ---------- */
(function(){
  var tip=document.createElement("div"); tip.className="ftip"; document.body.appendChild(tip); var cur=null, tm=null;
  function hide(){ clearTimeout(tm); cur=null; tip.classList.remove("on"); }
  document.addEventListener("mouseover",function(e){
    var el=e.target.closest&&e.target.closest("[data-tip]"); if(el===cur) return; hide(); if(!el) return; cur=el;
    tm=setTimeout(function(){ if(cur!==el||!document.body.contains(el)) return;
      tip.textContent=el.getAttribute("data-tip"); var r=el.getBoundingClientRect(), w=tip.offsetWidth, h=tip.offsetHeight, x, y;
      if(el.closest(".rail")){ x=r.right+8; y=r.top+r.height/2-h/2; }
      else if(el.closest(".tb,.mtb")){ x=r.right-w; y=r.bottom+6; }
      else { x=r.left+r.width/2-w/2; y=r.top-h-6; if(y<4) y=r.bottom+6; }
      x=Math.max(4,Math.min(window.innerWidth-w-4,x)); y=Math.max(4,Math.min(window.innerHeight-h-4,y));
      tip.style.transform="translate("+Math.round(x)+"px,"+Math.round(y)+"px)"; tip.classList.add("on"); },220);
  });
  document.addEventListener("mousedown",hide); window.addEventListener("blur",hide); document.addEventListener("scroll",hide,true);
})();

/* ---------- 일정 공유 (코드 / 파일) ---------- */
function b64u(bytes){ var s=""; for(var i=0;i<bytes.length;i+=8192) s+=String.fromCharCode.apply(null,bytes.subarray(i,i+8192)); return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,""); }
function unb64u(s){ s=s.replace(/-/g,"+").replace(/_/g,"/"); while(s.length%4) s+="="; var b=atob(s), a=new Uint8Array(b.length); for(var i=0;i<b.length;i++) a[i]=b.charCodeAt(i); return a; }
function pipe(bytes,stream){ return new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer().then(function(b){ return new Uint8Array(b); }); }
function shareEncode(obj){ return pipe(new TextEncoder().encode(JSON.stringify(obj)),new CompressionStream("deflate-raw")).then(function(b){ return "DDAY1."+b64u(b); }); }
function shareDecode(text){
  text=String(text||"").trim(); if(!text) return Promise.reject(new Error("비어 있어요"));
  if(text[0]==="{"){ try{ return Promise.resolve(JSON.parse(text)); }catch(e){ return Promise.reject(e); } }
  var m=text.match(/DDAY1\.([A-Za-z0-9_-]+)/); if(!m) return Promise.reject(new Error("코드가 아니에요"));
  return pipe(unb64u(m[1]),new DecompressionStream("deflate-raw")).then(function(b){ return JSON.parse(new TextDecoder().decode(b)); });
}
function sharePack(list,withImg){
  var nm=((S.settings||{}).shareName||"").trim();
  return {k:"dday-share",v:1,from:nm,at:Date.now(),events:list.map(function(e){ var o={sid:e.sid||e.id,title:e.title,date:e.date,time:e.time||"",cat:e.cat,memo:e.memo||""};
    var w=e.who?AN.whoName(S,e.who):""; if(w) o.who=w; if(withImg&&e.img) o.img=e.img; return o; })};
}
function shareDialog(){
  var all=AN.events(S).filter(function(x){ return x.days>=-60; }), sel={};
  all.forEach(function(x){ if(x.days>=0) sel[x.e.id]=1; });
  var w=document.createElement("div"); w.className="veil";
  function draw(){
    var n=Object.keys(sel).length;
    w.innerHTML='<div class="dlg wide"><h3>일정 보내기</h3><p class="note" style="margin:-4px 0 12px">고른 일정을 코드나 파일로 만들어요. 받는 사람이 [일정 → 공유받기]에 넣으면 똑같이 들어가요. 고친 뒤 다시 보내면 받은 쪽 일정도 새 내용으로 바뀌어요.</p>'+
      '<label class="fld">보내는 사람 이름 (선택)<input class="in" id="sh-nm" value="'+esc((S.settings||{}).shareName||"")+'" placeholder="예: 빵살"></label>'+
      '<div class="shl">'+(all.length?all.map(function(x){ var e=x.e, c=AN.catOf(e.cat); return '<label class="shr"><input type="checkbox" data-shk="'+esc(e.id)+'"'+(sel[e.id]?" checked":"")+'><i style="background:'+c[2]+'"></i><b>'+esc(e.title||"(제목 없음)")+'</b><small>'+esc(fmtDay(e.date)+(e.time?" "+e.time:""))+" · "+ddText(x.days)+"</small></label>"; }).join(""):'<p class="note">보낼 일정이 없어요.</p>')+'</div>'+
      '<p class="note" style="margin-top:8px">코드는 글자만 담겨요. 일정에 넣은 이미지까지 보내려면 파일로 저장해 주세요.</p>'+
      '<div class="btns"><button class="btn" data-a="x">닫기</button><span style="flex:1"></span><button class="btn" data-a="file"'+(n?"":" disabled")+'>파일로 저장</button><button class="btn pri" data-a="code"'+(n?"":" disabled")+'>코드 복사 ('+n+')</button></div></div>';
  }
  function chosen(){ return (S.events||[]).filter(function(e){ return sel[e.id]; }); }
  draw(); document.body.appendChild(w);
  w.addEventListener("change",function(e){ var k=e.target.getAttribute("data-shk"); if(k){ if(e.target.checked) sel[k]=1; else delete sel[k]; var nm=$("#sh-nm",w).value; draw(); $("#sh-nm",w).value=nm; } });
  w.addEventListener("input",function(e){ if(e.target.id==="sh-nm"){ S.settings.shareName=e.target.value; saveSoon(); } });
  w.addEventListener("click",function(e){
    if(e.target===w){ w.remove(); return; }
    var b=e.target.closest("[data-a]"); if(!b) return; var a=b.dataset.a;
    if(a==="x"){ w.remove(); return; }
    if(a==="code") shareEncode(sharePack(chosen(),false)).then(function(code){ return navigator.clipboard.writeText(code).then(function(){ toast("코드를 복사했어요 · 메신저에 붙여 넣어 보내 주세요"); w.remove(); }); }).catch(function(){ toast("복사하지 못했어요"); });
    if(a==="file"){ var d=new Date(), nm="일정공유-"+d.getFullYear()+String(d.getMonth()+1).padStart(2,"0")+String(d.getDate()).padStart(2,"0")+".dday";
      api.saveFile(nm,JSON.stringify(sharePack(chosen(),true))).then(function(ok){ if(ok){ toast("파일로 저장했어요"); w.remove(); } }); }
  });
}
function recvDialog(){
  var w=document.createElement("div"), data=null, pick={}; w.className="veil";
  function findSame(o){ return (S.events||[]).filter(function(e){ return e.sid===o.sid||e.id===o.sid; })[0]; }
  function status(o){ var e=findSame(o); if(!e) return "new"; return (e.title===o.title&&e.date===o.date&&(e.time||"")===(o.time||"")&&(e.memo||"")===(o.memo||"")&&e.cat===o.cat)?"same":"upd"; }
  function draw(){
    var body;
    if(!data) body='<p class="note" style="margin:-4px 0 12px">받은 코드(DDAY1.로 시작)를 붙여 넣거나, 받은 .dday 파일을 열어 주세요.</p><textarea class="in" id="rc-t" style="height:96px;font-family:monospace;font-size:11.5px" placeholder="DDAY1.…"></textarea>'+
      '<div class="btns"><button class="btn" data-a="x">닫기</button><span style="flex:1"></span><label class="btn">파일 열기<input type="file" accept=".dday,.json,.txt" id="rc-f" hidden></label><button class="btn pri" data-a="read">읽기</button></div>';
    else { var L=data.events||[], n=Object.keys(pick).length, LB={new:"새 일정",upd:"바뀜",same:"이미 있음"};
      body='<p class="note" style="margin:-4px 0 12px">'+(data.from?esc(data.from)+"님이 보낸 ":"")+"일정 "+L.length+'개예요. 이미 받은 일정은 새 내용으로 바뀌어요.</p><div class="shl">'+L.map(function(o,i){ var st=status(o), c=AN.catOf(o.cat); return '<label class="shr"><input type="checkbox" data-rk="'+i+'"'+(pick[i]?" checked":"")+'><i style="background:'+c[2]+'"></i><b>'+esc(o.title||"(제목 없음)")+'</b><small>'+esc(fmtDay(o.date)+(o.time?" "+o.time:""))+'</small><span class="st st-'+st+'">'+LB[st]+"</span></label>"; }).join("")+"</div>"+
      '<div class="btns"><button class="btn" data-a="back">다른 코드</button><span style="flex:1"></span><button class="btn pri" data-a="add"'+(n?"":" disabled")+'>넣기 ('+n+')</button></div>'; }
    w.innerHTML='<div class="dlg wide"><h3>일정 공유받기</h3>'+body+"</div>";
  }
  function load(text){ shareDecode(text).then(function(d){ if(!d||d.k!=="dday-share"||!Array.isArray(d.events)) throw new Error("x"); data=d; pick={}; d.events.forEach(function(o,i){ if(status(o)!=="same") pick[i]=1; }); draw(); }).catch(function(){ toast("일정 공유 코드가 아닌 것 같아요"); }); }
  draw(); document.body.appendChild(w);
  w.addEventListener("change",function(e){
    if(e.target.id==="rc-f"&&e.target.files[0]){ var fr=new FileReader(); fr.onload=function(){ load(fr.result); }; fr.readAsText(e.target.files[0]); return; }
    var k=e.target.getAttribute("data-rk"); if(k!=null){ if(e.target.checked) pick[k]=1; else delete pick[k]; draw(); }
  });
  w.addEventListener("click",function(e){
    if(e.target===w){ w.remove(); return; }
    var b=e.target.closest("[data-a]"); if(!b) return; var a=b.dataset.a;
    if(a==="x"){ w.remove(); return; }
    if(a==="back"){ data=null; draw(); return; }
    if(a==="read"){ load($("#rc-t",w).value); return; }
    if(a==="add"){ b.disabled=true; S.events=S.events||[]; var L=data.events, n=0;
      Promise.all(Object.keys(pick).map(function(i){ var o=L[+i]; if(!o||!o.date) return null;
        var imgP=(o.img&&/^data:image\//.test(o.img))?api.saveImage(o.img).catch(function(){ return null; }):Promise.resolve(null);
        return imgP.then(function(img){ var e=findSame(o), fresh=!e;
          if(fresh){ e={id:uid("e"),remind:"morning",who:null,star:null,pin:false}; S.events.push(e); }
          e.sid=o.sid; e.title=o.title||""; e.date=o.date; e.time=o.time||""; e.cat=o.cat||"etc"; e.memo=o.memo||""; if(data.from) e.from=data.from;
          if(o.who&&(fresh||!e.who||e.who.type==="name")) e.who={type:"name",name:o.who};
          if(img) e.img=img; n++; }); })).then(function(){ saveSoon(true); render(); toast("일정 "+n+"개를 넣었어요"); w.remove(); });
    }
  });
}
/* 내 소리 파일 */
document.addEventListener("change",function(e){
  var k=e.target.getAttribute&&(e.target.getAttribute("data-zsf")||(e.target.getAttribute("data-voicef")?"__voice":null)); if(!k) return; var f=e.target.files&&e.target.files[0]; if(!f) return;
  if(f.size>3*1024*1024){ toast("3MB보다 작은 소리 파일로 넣어 주세요"); return; }
  var t=tokById(SEL); if(!t) return; var fr=new FileReader();
  fr.onload=function(){ var d=String(fr.result).replace(/^data:[^;]*;/,function(h){ return /audio\//.test(h)?h:"data:audio/"+((f.name.split(".").pop()||"mpeg").toLowerCase().replace("mp3","mpeg"))+";"; });
    api.saveSound(d).then(function(url){ if(!url){ toast("이 파일은 넣을 수 없어요"); return; } if(k==="__voice"){ t.voice="custom"; t.voiceSrc=url; } else { Z.set(t,k,"sound","custom"); t.zones[k].soundSrc=url; } saveSoon(true); render(); var c=S.settings||{}; Z.sound("custom",typeof c.volume==="number"?c.volume:.5,url); toast("소리를 넣었어요"); }); };
  fr.readAsDataURL(f);
});
if(api.onUpdate) api.onUpdate(function(info){ window.ddShowUpdate(info); });
api.onNav(function(v){ if(COMPACT) api.win("expand"); VIEW=v||"home"; render(); });
document.addEventListener("change",function(e){ if(e.target.id==="ob-img"){ var f=e.target.files[0], el=$("#ob-imgname"); if(el) el.textContent=f?f.name:"배경 투명 PNG 한 장"; } });
/* 캐릭터 불러오기 */
function importChar(text){
  var d; try{ d=JSON.parse(text); }catch(e){ toast("캐릭터 파일이 아니에요"); return; }
  var list=d&&d.format==="dday-chars"&&Array.isArray(d.tokens)?d.tokens:(d&&d.format==="dday-char"&&d.token?[d.token]:null);
  if(!list||!list.length){ toast("캐릭터 파일이 아니에요"); return; }
  var jobs=[], added=[];
  function img(o,k){ if(o&&typeof o[k]==="string"&&/^data:image\//.test(o[k])) jobs.push(api.saveImage(o[k]).then(function(u){ if(u) o[k]=u; })); }
  function snd(o,k){ if(o&&typeof o[k]==="string"&&/^data:audio\//.test(o[k])) jobs.push(api.saveSound(o[k]).then(function(u){ if(u) o[k]=u; })); }
  list.forEach(function(t){ if(!t||typeof t!=="object") return; t.id=uid("t"); delete t._cfg;
    img(t.img,"src"); Object.keys(t.parts||{}).forEach(function(k){ img(t.parts[k],"src"); });
    snd(t,"voiceSrc"); Object.keys(t.zones||{}).forEach(function(k){ snd(t.zones[k],"soundSrc"); }); added.push(t); });
  Promise.all(jobs).then(function(){ added.forEach(function(t){ S.tokens.push(t); }); saveSoon(true); SEL=added[0].id; VIEW="char"; SUB="basic"; render();
    toast(added.length>1?"캐릭터 "+added.length+"명을 불러왔어요":(added[0].nick||added[0].name||"캐릭터")+" 캐릭터를 불러왔어요"); });
}
document.addEventListener("change",function(e){ if(e.target.id!=="charimp") return; var f=e.target.files[0]; if(!f) return; var fr=new FileReader(); fr.onload=function(){ importChar(String(fr.result)); }; fr.readAsText(f); e.target.value=""; });
})();
