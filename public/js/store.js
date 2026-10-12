const KEY='sosoking.play.v2';
const fresh=()=>({version:2,runs:{},drafts:{},sound:false});
export let persistent=true;
const valid=r=>r&&typeof r.id==='string'&&/^[a-z0-9-]{3,80}$/.test(r.id)&&Number.isInteger(r.version)&&r.version>=1&&r.version<=100&&Number.isInteger(r.stars)&&r.stars>=0&&r.stars<=3&&Number.isFinite(r.metric)&&r.metric>=0&&Number.isInteger(r.attempts)&&r.attempts>=0&&typeof r.lastPlayed==='string'&&!Number.isNaN(Date.parse(r.lastPlayed))&&typeof r.title==='string'&&['route','pace','robot'].includes(r.type);
let state=fresh();
try{const raw=JSON.parse(localStorage.getItem(KEY)||'null');if(raw&&raw.version===2&&raw.runs&&typeof raw.runs==='object'&&!Array.isArray(raw.runs))state={...fresh(),...raw};}catch{persistent=false;}
state.runs=Object.fromEntries(Object.entries(state.runs).filter(([key,r])=>valid(r)&&key===`${r.id}@${r.version}`));
if(!state.drafts||typeof state.drafts!=='object'||Array.isArray(state.drafts))state.drafts={};
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{persistent=false;}}
export const keyFor=g=>`${g.id}@${g.version||1}`;
export function runs(){return state.runs;}
export function getRun(g){return state.runs[keyFor(g)]||null;}
export function record(g,r,assisted){const key=keyFor(g),old=state.runs[key];const best=!old||r.stars>old.stars||(r.stars===old.stars&&r.metric<old.metric);state.runs[key]={...(best?{stars:r.stars,score:r.score,metric:r.metric,assisted:!!assisted}:old),id:g.id,version:g.version||1,title:g.title,type:g.type,attempts:(old?.attempts||0)+1,lastPlayed:new Date().toISOString(),completed:!!(old?.completed||r.complete)};save();return best;}
export function draft(g,value){state.drafts||={};if(value===undefined)return state.drafts[keyFor(g)];state.drafts[keyFor(g)]=value;save();}
export function sound(value){if(value!==undefined){state.sound=value;save();}return state.sound;}
export function clear(){state=fresh();save();}
export function merge(r){if(!valid(r))return;const key=`${r.id}@${r.version||1}`,old=state.runs[key];if(!old||r.stars>old.stars||(r.stars===old.stars&&r.metric<old.metric))state.runs[key]={...r,attempts:Math.max(old?.attempts||0,r.attempts||0)};save();}
