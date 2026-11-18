// Pure, local-only utilities shared by roster, chat and order tools.
export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const digits=value=>String(value??'').replace(/[^0-9]/g,'');
export function normalizePhone(value){
 const v=digits(value);
 if(v.startsWith('010')&&v.length===11)return v.replace(/^(010)(\d{4})(\d{4})$/,'$1-$2-$3');
 if(v.startsWith('01')&&v.length>=10&&v.length<=11)return v;
 return String(value??'').trim().slice(0,40);
}
export const won=value=>Math.max(0,Number(value)||0).toLocaleString('ko-KR')+'원';
export const csvCell=value=>{
 const text=String(value??'');
 return '"'+(/^\s*[=+\-@\t\r]/.test(text)?"'":'')+text.replaceAll('"','""')+'"';
};
export const csvText=rows=>'\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
export function parseSeparated(text,delimiter=','){
 let row=[],rows=[],value='',quotes=false;
 const input=String(text??'').replace(/^\ufeff/,'');
 for(let i=0;i<input.length;i++){
  const c=input[i];
  if(c==='"'){
   if(quotes&&input[i+1]==='"'){value+='"';i++;}
   else quotes=!quotes;
  }else if(c===delimiter&&!quotes){row.push(value);value='';}
  else if((c==='\r'||c==='\n')&&!quotes){
   if(c==='\r'&&input[i+1]==='\n')i++;
   row.push(value);value='';
   if(row.some(x=>x.trim()))rows.push(row);
   row=[];
  }else value+=c;
 }
 if(value!==''||row.length){row.push(value);if(row.some(x=>x.trim()))rows.push(row);}
 return rows;
}
const knownHeaders={name:['이름','성명','성함','참가자','신청자','name'],phone:['전화번호','휴대폰','연락처','핸드폰','phone','mobile'],role:['직책','직급','역할','직위','role'],group:['소속','단체','팀','조직','group','affiliation']};
function headerKey(value){
 const cleaned=String(value).trim().toLowerCase().replace(/[\s*()[\]_-]/g,'');
 for(const [key,aliases] of Object.entries(knownHeaders))if(aliases.some(alias=>alias.replace(/[\s_-]/g,'').toLowerCase()===cleaned))return key;
 return '';
}
export function parseRoster(text){
 const input=String(text??'').trim();
 if(!input)return [];
 const rows=parseSeparated(input,input.split(/\r?\n/,1)[0].includes('\t')?'\t':',');
 if(rows.length>0&&rows[0].length>1){
  const headerKeys=rows[0].map(headerKey);
  const withHeader=headerKeys.includes('name');
  if(withHeader){
   return rows.slice(1).filter(c=>c.some(x=>x.trim())).slice(0,2000).map(c=>{
    const row={name:'',phone:'',role:'',group:''};
    c.forEach((part,i)=>{const key=headerKeys[i];if(key)row[key]=String(part).trim().slice(0,100);});
    row.phone=normalizePhone(row.phone);return row;
   }).filter(x=>x.name);
  }
  if(rows[0].some(c=>/\d{9,11}/.test(digits(c)))||rows[0].length>=3){
   return rows.slice(0,2000).map(c=>({
    name:String(c[0]||'').trim().slice(0,60),
    phone:normalizePhone(c[1]||''),
    role:String(c[2]||'').trim().slice(0,80),
    group:String(c[3]||'').trim().slice(0,80)
   })).filter(x=>x.name);
  }
 }
 return input.split(/\r?\n/).slice(0,2000).map(raw=>{
  let line=raw.trim().replace(/^\s*(?:\d+[.)]\s*|[•*-]\s*)/,'');
  const phoneMatch=line.match(/(?:01[016789][\s-]?\d{3,4}[\s-]?\d{4}|010\d{8})/);
  const phone=phoneMatch?normalizePhone(phoneMatch[0]):'';
  if(phoneMatch)line=line.replace(phoneMatch[0],' ');
  const parts=line.split(/\s+/).filter(Boolean);
  return {name:(parts.shift()||'').slice(0,60),phone,role:parts.join(' ').slice(0,80),group:''};
 }).filter(r=>r.name);
}
export function rosterKey(record){
 const name=String(record.name||'').replace(/\s/g,'').toLowerCase();
 const phone=digits(record.phone||'');
 return phone.length>=10?name+'|'+phone:name+'|'+String(record.role||'').trim().toLowerCase()+'|'+String(record.group||'').trim().toLowerCase();
}
export function findRosterDuplicates(records){
 const seen=new Map(),unique=[],duplicateIndices=[];
 records.forEach((row,index)=>{
  const key=rosterKey(row);
  if(seen.has(key))duplicateIndices.push(index);
  else{seen.set(key,index);unique.push(row);}
 });
 return {unique,duplicateIndices};
}
export function rosterCSV(records){
 return csvText([['이름','전화번호','직책','소속'],...records.map(r=>[r.name,r.phone,r.role,r.group])]);
}
const qRegex=/(\d{1,5})\s*(개|명|장|벌|박스|세트|권|인분|병)?\s*$/;
export function parseChatOrders(raw){
 const output=[];
 const text=String(raw??'').replace(/\r\n/g,'\n');
 const lines=text.split('\n').slice(0,1000);
 for(const full of lines){
  let line=full.trim();if(!line)continue;
  // KakaoTalk export: [speaker] [오후 2:30] message
  let speaker='';
  const kakao=line.match(/^\[([^\]]{1,60})\]\s*\[[^\]]+\]\s*(.*)$/);
  if(kakao){speaker=kakao[1].trim();line=kakao[2].trim();}
  else{
   const colon=line.match(/^([^:\s]{1,30})\s*:\s*(.+)$/);
   if(colon){speaker=colon[1];line=colon[2].trim();}
  }
  for(const segment of line.split(/[,，;；]\s*/).map(s=>s.trim()).filter(Boolean)){
   const match=segment.match(qRegex);
   if(!match){
    // Keep ambiguous rows available for manual correction, not silently discarded.
    if(/\d/.test(segment))output.push({name:speaker,item:segment,quantity:1,needsReview:true,source:full.slice(0,250)});
    continue;
   }
   const qty=Number(match[1]);
   if(!Number.isInteger(qty)||qty<1||qty>10000)continue;
   let rest=segment.slice(0,match.index).trim().replace(/^[•\-\d.)\s]+/,'');
   const chunks=rest.split(/\s+/).filter(Boolean);
   let name=speaker,item=rest;
   // Common copied-list pattern: "김철수 도시락 2개"
   if(!speaker&&chunks.length>=2&&/^[가-힣]{2,5}$/.test(chunks[0])){name=chunks[0];item=chunks.slice(1).join(' ');}
   else if(!speaker&&chunks.length===1&&/^[가-힣]{2,5}$/.test(chunks[0])){name=chunks[0];item='';}
   else if(!speaker&&chunks.length>=2){name=chunks[0];item=chunks.slice(1).join(' ');}
   if(!item&&speaker&&chunks.length) item=rest;
   output.push({name:String(name).slice(0,60),item:String(item).slice(0,80),quantity:qty,needsReview:!name||!item,source:full.slice(0,250)});
  }
 }
 return output.slice(0,1000);
}
export function orderSummary(orders,products=[]){
 const map=new Map(products.map(p=>[String(p.name).trim(),Math.max(0,Number(p.price)||0)]));
 const totals=new Map();
 let amount=0;
 for(const o of orders){
  const name=String(o.item||'').trim(),qty=Math.max(0,Number(o.quantity)||0),price=map.get(name)||0;
  if(!name||!qty)continue;
  if(!totals.has(name))totals.set(name,{item:name,quantity:0,amount:0,price});
  const t=totals.get(name);t.quantity+=qty;t.amount+=price*qty;amount+=price*qty;
 }
 return {items:[...totals.values()],total:amount,people:new Set(orders.map(o=>String(o.name||'').trim()).filter(Boolean)).size};
}
export function ordersCSV(orders,products=[]){
 const price=new Map(products.map(p=>[String(p.name),Number(p.price)||0]));
 return csvText([['주문자','상품명','수량','단가','금액'],...orders.map(o=>[o.name,o.item,o.quantity,price.get(o.item)||0,Math.max(0,Number(o.quantity)||0)*(price.get(o.item)||0)])]);
}
