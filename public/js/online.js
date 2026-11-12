export const ROOM_ORIGIN = 'https://sosoking-tidepost-rooms.joojeasang.chatgpt.site';
const firebaseHost = ['sosoking-481e6.web.app','sosoking-481e6.firebaseapp.com'];
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const digits = size => Array.from(crypto.getRandomValues(new Uint8Array(size)));
export const token = () => digits(24).map(b=>b.toString(16).padStart(2,'0')).join('');
export const nonce = () => digits(12).map(b=>b.toString(16).padStart(2,'0')).join('');
export const newCode = () => digits(8).map(b=>alphabet[b%32]).join('');
export const cleanCode = s => String(s||'').toUpperCase().replace(/[\s-]/g,'');
export const isCode = s => /^[A-HJ-NP-Z2-9]{8}$/.test(s);
export const displayCode = s => s.slice(0,4)+'-'+s.slice(4);
export const inviteLink = code => new URL('#join='+code,location.origin+'/').href;
export async function request(input) {
  const host=firebaseHost.includes(location.hostname)?ROOM_ORIGIN:'';
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
  try {
    const r=await fetch(host+'/api/room',{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},
      body:JSON.stringify(input),credentials:'omit',cache:'no-store',signal:ctrl.signal});
    const data=await r.json();
    if(!r.ok) {const e=new Error(data.error||'항구에 연결할 수 없어요.');e.status=r.status;throw e;}
    return data;
  } catch(e) {
    if(e.status) throw e;
    throw new Error('항구에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.');
  } finally {clearTimeout(timer);}
}
export function getSaved(storage,key) {
  try {return JSON.parse(storage.getItem('tidepost.'+key));} catch {return null;}
}
export function save(storage,key,value) {
  try {if(value===null) storage.removeItem('tidepost.'+key);else storage.setItem('tidepost.'+key,JSON.stringify(value));} catch {}
}
