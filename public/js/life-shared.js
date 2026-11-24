import {initializeApp} from 'firebase/app';
import {getAuth,signInAnonymously} from 'firebase/auth';
import {getFirestore} from 'firebase/firestore';
import {csvText} from './life-core.js';
export const $=s=>document.querySelector(s);
export const page=document.body.dataset.page,qs=new URLSearchParams(location.search);
export const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n};
export const btn=(text,fn,cls='secondary')=>{const n=node('button',text,cls);n.type='button';n.addEventListener('click',fn);return n};
export const link=(text,href,cls)=>{const n=node('a',text,cls);n.href=href;return n};
export function read(key,fallback=[]){try{const raw=localStorage.getItem('sosoking-life-'+key);return raw===null?fallback:JSON.parse(raw)}catch{return fallback}}
export function save(key,val){try{localStorage.setItem('sosoking-life-'+key,JSON.stringify(val));return true}catch{alert('기기 저장에 실패했습니다.');return false}}
export const list=key=>{const x=read(key);return Array.isArray(x)?x:[]};
export function empty(el,text){el.replaceChildren(node('p',text,'empty'))}
export const dateText=t=>t?.toDate?.().toLocaleDateString('ko-KR')||'';
export const timeText=t=>t?.toDate?.().toLocaleString('ko-KR')||'';
let conn,signing;
export async function db(){if(!conn)conn=(async()=>{const resp=await fetch('/__/firebase/init.json');if(!resp.ok)throw Error('설정 연결 실패');const app=initializeApp(await resp.json());return {store:getFirestore(app),auth:getAuth(app)}})().catch(e=>{conn=null;throw e});return conn}
export async function user(){const c=await db();await c.auth.authStateReady();if(!c.auth.currentUser){if(!signing)signing=signInAnonymously(c.auth).finally(()=>{signing=null});await signing}return {...c,uid:c.auth.currentUser.uid}}
export async function copy(text){if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(text);return true}catch{}}prompt('아래 내용을 복사하세요.',text);return false}
export async function share(title,url){if(navigator.share){try{await navigator.share({title,url});return}catch(e){if(e.name==='AbortError')return}}await copy(url)}
export function download(filename,data,type='text/plain;charset=utf-8'){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([data],{type}));a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export function csv(filename,rows){download(filename,csvText(rows),'text/csv;charset=utf-8')}
export function metric(label,value){const el=node('div',undefined,'metric');el.append(node('small',label),node('strong',value));return el}
export function actionRow(...children){const d=node('div',undefined,'actions');d.append(...children);return d}
export function errText(e){const code=e?.code||'';if(code.includes('permission-denied'))return '접근 권한이 없거나 등록 제한에 해당합니다.';if(code.includes('unavailable')||code.includes('network'))return '연결이 원활하지 않습니다. 인터넷 연결을 확인하세요.';return e?.message||'처리하지 못했습니다.'}
