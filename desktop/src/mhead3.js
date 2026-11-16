(function(){
"use strict";
var $=function(s,r){return (r||document).querySelector(s)}, $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var esc=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
var uid=function(p){return (p||"t")+Date.now().toString(36)+Math.random().toString(36).slice(2,6)};
var api=window.api, S={v:1,tokens:[],pairs:[],settings:{}}, app=$("#app");
var VIEW="home", SUB="basic", SEL=null;
