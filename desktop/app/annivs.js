/* 기념일 계산: 메인(노드)과 관리 창이 같이 씀 */
(function(root){
"use strict";
var A={};
A.REPEAT=[["yearly","매년"],["d100","100일마다"],["once","한 번만"]];
A.PRESETS=["생일","처음 만난 날","사귄 날","결혼기념일","첫 등장","데뷔일","약혼한 날"];
function ymd(d){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
A.ymd=ymd;
function day0(d){ return new Date(d.getFullYear(),d.getMonth(),d.getDate()); }
var DAY=86400000;
function diff(a,b){ return Math.round((day0(b)-day0(a))/DAY); }
function mkDate(y,m,d){ var last=new Date(y,m,0).getDate(); return new Date(y,m-1,Math.min(d,last)); }
/* 생일은 프로필에서 자동으로 */
A.all=function(S){
  var list=(S.annivs||[]).slice();
  (S.tokens||[]).forEach(function(t){ if(t.birthday&&t.birthday.m&&t.birthday.d) list.push({id:"bd-"+t.id,title:"생일",who:{type:"token",id:t.id},m:t.birthday.m,d:t.birthday.d,y:null,repeat:"yearly",lines:t.birthdayLines||[],auto:true,pin:!!t.birthdayPin}); });
  return list;
};
/* 다음 날짜 · 남은 날 · 이름표 */
A.next=function(a,now){
  now=day0(now||new Date());
  if(!a||!a.m||!a.d) return null;
  if(a.repeat==="d100"&&a.y){
    var st=mkDate(a.y,a.m,a.d), cnt=diff(st,now)+1; /* 시작한 날이 1일 */
    if(cnt<1){ return {date:st,days:diff(now,st),label:"1일",n:1}; }
    var n=Math.ceil(cnt/100)*100; var dt=new Date(st.getTime()+(n-1)*DAY);
    return {date:dt,days:diff(now,dt),label:n+"일",n:n,count:cnt};
  }
  if(a.repeat==="once"&&a.y){
    var od=mkDate(a.y,a.m,a.d); return {date:od,days:diff(now,od),label:a.title,past:diff(now,od)<0};
  }
  var y=now.getFullYear(), dt2=mkDate(y,a.m,a.d); if(diff(now,dt2)<0) dt2=mkDate(y+1,a.m,a.d);
  var yrs=a.y?dt2.getFullYear()-a.y:null;
  var label=a.title==="생일"?(yrs!=null&&yrs>0?a.title:"생일"):(yrs!=null&&yrs>0?yrs+"주년":a.title);
  return {date:dt2,days:diff(now,dt2),label:label,years:yrs};
};
A.since=function(a,now){ if(!a||!a.y) return null; var st=mkDate(a.y,a.m,a.d); return diff(st,now||new Date())+1; };
A.isSince=function(a){ return a.count!=="dday"&&!!a.y&&a.repeat!=="once"; };
A.bigCount=function(a,n,now){ if(A.isSince(a)){ var s=A.since(a,now); return s>0?s+"일":"D-"+(1-s); } return A.ddayText(n); };
A.ddayText=function(n){ if(!n) return ""; if(n.days===0) return "D-DAY"; return n.days>0?"D-"+n.days:"D+"+(-n.days); };
A.whoName=function(S,who){
  if(!who) return ""; if(who.type==="name") return who.name||""; if(who.type==="pair"){ var p=(S.pairs||[]).filter(function(x){return x.id===who.id})[0]; return p?(p.name||"이름 없는 페어"):"(사라진 페어)"; }
  var t=(S.tokens||[]).filter(function(x){return x.id===who.id})[0]; return t?(t.nick||t.name||"이름 없음"):"(사라진 캐릭터)";
};
/* 그 기념일에 나올 캐릭터 */
A.starOf=function(S,a){
  if(!a||!a.who) return null;
  if(a.who.type==="token") return a.who.id;
  var p=(S.pairs||[]).filter(function(x){return x.id===a.who.id})[0]; if(!p||!p.tokenIds.length) return null;
  return a.star&&p.tokenIds.indexOf(a.star)>=0?a.star:p.tokenIds[0];
};
A.involves=function(S,a,tid){ if(!a.who) return false; if(a.who.type==="token") return a.who.id===tid; var p=(S.pairs||[]).filter(function(x){return x.id===a.who.id})[0]; return !!(p&&p.tokenIds.indexOf(tid)>=0); };
/* 다가오는 순서 */
A.upcoming=function(S,now){
  return A.all(S).map(function(a){ return {a:a,n:A.next(a,now)}; }).filter(function(x){ return x.n; }).sort(function(x,y){
    var px=x.n.days<0?1:0, py=y.n.days<0?1:0; if(px!==py) return px-py; return px?(y.n.days-x.n.days):(x.n.days-y.n.days); });
};
/* 일정 */
A.CATS=[["trpg","TRPG","#7c6cf0"],["deadline","마감","#ef5b5b"],["meet","약속","#2bb3a3"],["fan","덕질","#f08bb4"],["etc","기타","#8a96a8"]];
A.catOf=function(k){ for(var i=0;i<A.CATS.length;i++) if(A.CATS[i][0]===k) return A.CATS[i]; return A.CATS[A.CATS.length-1]; };
A.parseYmd=function(s){ var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||""); return m?new Date(+m[1],+m[2]-1,+m[3]):null; };
A.eventDays=function(e,now){ var d=A.parseYmd(e.date); return d?diff(now||new Date(),d):null; };
A.events=function(S,now){ return (S.events||[]).map(function(e){ return {e:e,days:A.eventDays(e,now)}; }).filter(function(x){ return x.days!=null; }).sort(function(x,y){ if(x.days!==y.days) return x.days-y.days; return (x.e.time||"99").localeCompare(y.e.time||"99"); }); };
A.on=function(S,ymdStr){ /* 그날 있는 기념일·일정 */
  var d=A.parseYmd(ymdStr); if(!d) return {annivs:[],events:[]};
  var an=A.all(S).filter(function(a){ var n=A.next(a,d); return n&&n.days===0; });
  var ev=(S.events||[]).filter(function(e){ return e.date===ymdStr; }).sort(function(x,y){ return (x.time||"99").localeCompare(y.time||"99"); });
  return {annivs:an,events:ev};
};
/* 지금 바탕화면에 누가 나올지 */
A.pick=function(S,now){
  var c=S.settings||{}, toks=S.tokens||[]; if(!toks.length) return null;
  var has=function(id){ return toks.some(function(t){return t.id===id}); };
  if(c.annivSwap!==false){
    var lead=typeof c.annivLead==="number"?c.annivLead:0;
    var hits=A.upcoming(S,now).filter(function(x){ return x.n.days>=0&&x.n.days<=lead&&has(A.starOf(S,x.a)); });
    if(hits.length){ var h=hits[0]; return {id:A.starOf(S,h.a),anniv:h.a,n:h.n,reason:"anniv"}; }
    var today=ymd(now||new Date()), ev=(S.events||[]).filter(function(e){ return e.date===today&&e.star&&has(e.star); })[0];
    if(ev) return {id:ev.star,event:ev,reason:"event"};
  }
  var main=has(c.main)?c.main:toks[0].id;
  return {id:main,reason:"main"};
};
A.defaultLine=function(S,a,n){ var who=A.whoName(S,a.who); if(n.days===0) return "오늘은 "+(a.who&&a.who.type==="pair"?"우리 ":"")+(n.label===a.title?a.title:a.title+" "+n.label)+"이야!"; return a.title+"까지 "+n.days+"일 남았어"; };
/* 미리 알려주기: 기념일마다 "며칠 전부터" (기본 7일, 0이면 안 알려줌) */
A.TELL=[[0,"안 알려줘요"],[1,"하루 전"],[3,"3일 전"],[7,"일주일 전"],[14,"2주 전"],[30,"한 달 전"]];
A.tellOf=function(a){ return typeof a.tell==="number"?a.tell:7; };
A.soonLine=function(S,a,n){ var c=String(a.tellLine||"").trim();
  if(c) return c.replace(/\{n\}|\{N\}|\{일\}/g,String(n.days)).replace(/\{제목\}|\{title\}/g,a.title);
  var us=a.who&&a.who.type==="pair"?"우리 ":"";
  return n.days===1?"내일이 "+us+a.title+"이야!":us+a.title+"까지 "+n.days+"일 남았어!"; };
/* 이 캐릭터가 알려줄 기념일. shown: 지금 화면에 나와 있는 캐릭터 id들 (페어 기념일은 한 명만 말해요) */
A.tellFor=function(S,tid,shown){ return A.upcoming(S).filter(function(x){ var a=x.a, d=x.n.days; if(!(d>0&&d<=A.tellOf(a))||!A.involves(S,a,tid)) return false;
    if(a.who.type!=="pair"||!shown) return true; var st=A.starOf(S,a); if(shown.indexOf(st)>=0) return st===tid;
    var first=shown.filter(function(id){ return A.involves(S,a,id); })[0]; return first===tid; }); };
if(typeof module!=="undefined"&&module.exports) module.exports=A; else root.Annivs=A;
})(this);
