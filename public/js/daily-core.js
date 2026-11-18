export const CATEGORIES=['일상','먹거리','사람','재미','기타'];
export const KINDS=['check','count','choice'];
export const DEFAULT_ITEMS=[
{id:'d_toilet',title:'오늘 화장실은 몇 번 갔어?',kind:'count',category:'일상',icon:'🚻'},
{id:'d_poop',title:'똥은 몇 번 쌌어?',kind:'count',category:'재미',icon:'💩'},
{id:'d_fart',title:'방귀는 몇 번 뀌었어?',kind:'count',category:'재미',icon:'💨'},
{id:'d_meal',title:'오늘 뭐 먹었어?',kind:'choice',category:'먹거리',options:['집밥','외식','배달','간편식','굶었어'],icon:'🍚'},
{id:'d_coffee',title:'커피는 몇 잔 마셨어?',kind:'count',category:'먹거리',icon:'☕'},
{id:'d_shopping',title:'오늘 쇼핑했어?',kind:'check',category:'일상',icon:'🛍️'},
{id:'d_met',title:'오늘 누군가를 만났어?',kind:'check',category:'사람',icon:'🤝'},
{id:'d_laugh',title:'오늘 크게 웃었어?',kind:'check',category:'재미',icon:'😆'},
{id:'d_walk',title:'오늘 산책했어?',kind:'check',category:'일상',icon:'🚶'}
];
export function localDateKey(date=new Date()){
 const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0');
 return String(y)+'-'+m+'-'+d;
}
export function shiftDay(day,delta){
 const [y,m,d]=String(day).split('-').map(Number);
 if(!Number.isInteger(y)||!Number.isInteger(m)||!Number.isInteger(d))return null;
 const value=new Date(y,m-1,d,12);
 if(value.getFullYear()!==y||value.getMonth()!==m-1||value.getDate()!==d)return null;
 value.setDate(value.getDate()+delta);
 return localDateKey(value);
}
export const compareDays=(a,b)=>String(a).localeCompare(String(b));
export const dayLabel=(key)=>{const [y,m,d]=key.split('-').map(Number);return String(m)+'월 '+d+'일'};
export const onlyText=(s,n=60)=>String(s??'').trim().replace(/\s+/g,' ').slice(0,n);
export function validateItem(raw){
 const title=onlyText(raw?.title,61);
 const kind=String(raw?.kind||'');
 const category=String(raw?.category||'');
 const options=kind==='choice'?(Array.isArray(raw?.options)?raw.options:[]).map(x=>onlyText(x,25)):[];
 if(title.length<2||title.length>60)throw Error('항목 이름은 2~60자로 입력해 주세요.');
 if(!KINDS.includes(kind))throw Error('체크 방식을 선택해 주세요.');
 if(!CATEGORIES.includes(category))throw Error('카테고리를 선택해 주세요.');
 if(kind==='choice'){
  if(options.length<2||options.length>5||options.some(x=>x.length<1)||new Set(options).size!==options.length)
   throw Error('선택지는 서로 다른 2~5개 항목으로 입력해 주세요.');
 }
 return {title,kind,category,options};
}
export function normalizeAnswer(item,value){
 if(value===undefined||value===null)return null;
 if(item.kind==='check')return typeof value==='boolean'?value:null;
 if(item.kind==='count'){
  const n=Number(value);
  return Number.isInteger(n)&&n>=0&&n<=999?n:null;
 }
 if(item.kind==='choice')return Array.isArray(item.options)&&item.options.includes(String(value))?String(value):null;
 return null;
}
export function emptyJournal(){return {version:1,days:{},customItems:[],sharedItems:[],selectedSharedIds:[],hiddenDefaultIds:[],hiddenItemIds:[]}}
export function cleanJournal(raw){
 if(!raw||typeof raw!=='object')throw Error('올바르지 않은 백업 파일입니다.');
 const out=emptyJournal();
 out.customItems=(Array.isArray(raw.customItems)?raw.customItems:[]).slice(0,80).flatMap(x=>{
  try{
   const item=validateItem(x);
   return [{...item,id:/^l_[a-zA-Z0-9-]{10,75}$/.test(String(x.id))?x.id:'l_'+crypto.randomUUID(),icon:'✦'}];
  }catch{return [];}
 });
 out.sharedItems=(Array.isArray(raw.sharedItems)?raw.sharedItems:[]).slice(0,150).flatMap(x=>{
  try{
   const item=validateItem(x);
   if(!/^s_[a-zA-Z0-9-]{8,110}$/.test(String(x.id)))return [];
   return [{...item,id:x.id,icon:'✦'}];
  }catch{return [];}
 });
 out.selectedSharedIds=[...new Set((Array.isArray(raw.selectedSharedIds)?raw.selectedSharedIds:[]).filter(x=>typeof x==='string'&&/^s_[a-zA-Z0-9-]{8,110}$/.test(x)))].slice(0,150);
 out.hiddenItemIds=[...new Set((Array.isArray(raw.hiddenItemIds)?raw.hiddenItemIds:[]).filter(x=>typeof x==='string'&&x.length<120))].slice(0,200);
 out.hiddenDefaultIds=[...new Set((Array.isArray(raw.hiddenDefaultIds)?raw.hiddenDefaultIds:[]).filter(x=>DEFAULT_ITEMS.some(item=>item.id===x)))];
 if(raw.days&&typeof raw.days==='object'){
  const entries=Object.entries(raw.days).slice(-1000);
  const map=new Map([...DEFAULT_ITEMS,...out.customItems,...out.sharedItems].map(item=>[item.id,item]));
  for(const [day,values] of entries){
   if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||shiftDay(day,0)!==day||!values||typeof values!=='object')continue;
   const good={};
   for(const [id,value] of Object.entries(values).slice(0,300)){
    const item=map.get(id);
    if(!item){
     if(out.selectedSharedIds.includes(id)&&(typeof value==='boolean'||(typeof value==='number'&&value>=0&&value<=999)||typeof value==='string'&&value.length<=25))good[id]=value;
     continue;
    }
    const valid=normalizeAnswer(item,value);
    if(valid!==null)good[id]=valid;
   }
   if(Object.keys(good).length)out.days[day]=good;
  }
 }
 return out;
}
export function dayProgress(items,answers={}){
 const recorded=items.filter(item=>Object.prototype.hasOwnProperty.call(answers,item.id)).length;
 return {recorded,total:items.length,percent:items.length?Math.round(100*recorded/items.length):0};
}
export function calculateStreak(days,today=localDateKey()){
 let target=Object.keys(days[today]||{}).length?today:shiftDay(today,-1),streak=0;
 while(target&&Object.keys(days[target]||{}).length>0&&streak<1000){streak++;target=shiftDay(target,-1);}
 return streak;
}
export function monthSummary(days,month){
 const entries=Object.entries(days).filter(([day])=>day.startsWith(month+'-')&&Object.keys(days[day]||{}).length);
 return {activeDays:entries.length,checks:entries.reduce((n,[,values])=>n+Object.keys(values).length,0)};
}
export function orderedEntries(days){return Object.entries(days).filter(([,a])=>Object.keys(a).length).sort(([a],[b])=>b.localeCompare(a))}
