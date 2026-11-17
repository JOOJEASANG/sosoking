import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const html=readFileSync(new URL("../public/index.html",import.meta.url),"utf8");
const js=readFileSync(new URL("../public/js/game.js",import.meta.url),"utf8");

test("All boot and gameplay element IDs are present or created by modal templates",()=>{
 const ids=[...js.matchAll(/\$\("([a-zA-Z][a-zA-Z0-9_-]*)"\)/g)].map(m=>m[1]);
 for(const id of new Set(ids)){
  assert.ok(html.includes('id="'+id+'"')||js.includes('id=\\"'+id+'\\"')||js.includes('id="'+id+'"'),
  'Missing DOM id: '+id);
 }
});

test("Actual game module boots, starts a run, builds a tower and begins wave",async()=>{
 const el=new Map(),handlers=new Map(),storage=new Map();
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 const classSet=()=>{const s=new Set();return {
  add:(x)=>s.add(x),remove:(x)=>s.delete(x),contains:(x)=>s.has(x),
  toggle:(x,on)=>{if(on===undefined? !s.has(x):on)s.add(x);else s.delete(x);}
 }};
 const makeEl=(id)=>{
  const ele={
   id,style:{},dataset:{},classList:classSet(),disabled:false,textContent:"",
   innerHTML:"",listeners:{},queryCache:new Map(),setAttribute(name,value){this[name]=value;},
   addEventListener(name,callback){this.listeners[name]=callback;},
   click(){this.listeners.click?.();},
   querySelectorAll(selector){
    const attr=selector.match(/^\[([^\]]+)\]$/)?.[1];
    if(!attr)return[];
    const old=this.queryCache.get(selector);
    if(old?.html===this.innerHTML)return old.list;
    const regex=new RegExp(attr+'="([^"]+)"','g');
    const list=[...this.innerHTML.matchAll(regex)].map(m=>{
     const o=makeEl("modal-"+m[1]);o.dataset[attr.replace("data-","")]=m[1];
     return o;
    });
    this.queryCache.set(selector,{html:this.innerHTML,list});return list;
   }
  };
  return ele;
 };
 for(const id of ids)el.set(id,makeEl(id));
 const gradients={addColorStop(){}};
 const ctx=new Proxy({createRadialGradient:()=>gradients}, {
  get(target,key){return key in target?target[key]:()=>{};},
  set(target,key,value){target[key]=value;return true;}
 });
 const canvas=el.get("battlefield");
 canvas.getContext=()=>ctx;
 canvas.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:600});
 const towerElements=["pulse","frost","rail","arc"].map(k=>{
  const b=makeEl("tower-"+k);b.dataset.tower=k;return b;
 });
 globalThis.document={
  getElementById:(id)=>el.get(id)||null,
  querySelectorAll:(selector)=>selector==="[data-tower]"?towerElements:[]
 };
 globalThis.window={addEventListener:(k,fn)=>handlers.set(k,fn)};
 globalThis.localStorage={getItem:(k)=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:(k)=>storage.delete(k)};
 let raf=null;
 globalThis.requestAnimationFrame=(fn)=>{raf=fn;};
 await import("../public/js/game.js?boot-test");
 assert.match(el.get("modalBody").innerHTML,/data-difficulty="normal"/);
 assert.ok(raf,"Render loop registered");
 const difficultyButtons=el.get("modalBody").querySelectorAll("[data-difficulty]");
 assert.equal(difficultyButtons.length,3);
 difficultyButtons.find(b=>b.dataset.difficulty==="normal").click();
 assert.equal(el.get("waveBtn").disabled,false);
 assert.equal(Number(el.get("creditsStat").textContent),370);
 towerElements[0].click();
 canvas.listeners.pointerdown({clientX:75,clientY:75});
 assert.equal(Number(el.get("creditsStat").textContent),280);
 el.get("waveBtn").click();
 assert.equal(el.get("waveBtn").disabled,true);
 assert.equal(el.get("battleStatus").textContent,"적군 접근 중");
 for(let i=1;i<=30;i++){
  const callback=raf;
  assert.ok(callback);
  callback(i*16);
 }
 assert.ok(el.get("battlefield"),"Render loop did not crash");
 el.get("pauseBtn").click();
 assert.equal(el.get("battleStatus").textContent,"일시정지");
 el.get("pauseBtn").click();
 assert.equal(el.get("battleStatus").textContent,"적군 접근 중");
});
