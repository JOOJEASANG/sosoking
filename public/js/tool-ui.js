// Browser-only helpers. Sensitive content is transferred within the current tab, never via URL.
export function downloadCsv(filename,csv){
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
 const url=URL.createObjectURL(blob);
 const link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function writeTransfer(key,payload){
 try{sessionStorage.setItem('sosoking-transfer-'+key,JSON.stringify({created:Date.now(),payload}));return true;}
 catch{return false;}
}
export function peekTransfer(key){
 try{
  const text=sessionStorage.getItem('sosoking-transfer-'+key);
  if(!text)return null;
  const data=JSON.parse(text);
  if(!data||Date.now()-data.created>=20*60*1000){sessionStorage.removeItem('sosoking-transfer-'+key);return null;}
  return data.payload;
 }catch{return null;}
}
export function readTransfer(key){
 try{
  const name='sosoking-transfer-'+key,text=sessionStorage.getItem(name);
  if(!text)return null;sessionStorage.removeItem(name);
  const saved=JSON.parse(text);
  return saved&&Date.now()-saved.created<20*60*1000?saved.payload:null;
 }catch{return null;}
}
export function toast(message,kind='info'){
 let el=document.getElementById('toolToast');
 if(!el){el=document.createElement('div');el.id='toolToast';el.className='tool-toast';el.setAttribute('role','status');el.setAttribute('aria-live','polite');document.body.append(el);}
 el.textContent=message;el.dataset.kind=kind;el.hidden=false;
}
