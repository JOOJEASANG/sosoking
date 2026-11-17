export const allowedFields=[
 {key:'name',label:'이름'},{key:'phone',label:'전화번호'},{key:'role',label:'직책'},{key:'gender',label:'성별'},{key:'affiliation',label:'세부 소속'},{key:'meal',label:'식사 여부'},{key:'vehicle',label:'차량번호'}
];
export const htmlEscape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const parseNameList=raw=>String(raw??'').split(/\r?\n/).map(s=>s.trim().replace(/^\s*(?:\d+[.)]\s*|[-•]\s*)/,'')).filter(Boolean).map(name=>({name:name.slice(0,60)}));
export const sumEvent=(event,groups)=>{
 const amount=Math.max(0,Number(event?.fee)||0);
 const totals=groups.reduce((a,g)=>{a.people+=Number(g.count)||0;a.paid+=Number(g.paid)||0;if(g.submitted)a.submitted++;return a;},{people:0,paid:0,submitted:0});
 return {...totals,expected:totals.people*amount,unpaid:Math.max(0,totals.people*amount-totals.paid),groups:groups.length};
};
export const normalizePhone=x=>String(x??'').replace(/[^0-9]/g,'').slice(0,11);
export function validateEvent(input){
 const title=String(input.title||'').trim().slice(0,100);
 const groups=(input.groups||[]).map(s=>String(s).trim().slice(0,60)).filter(Boolean);
 if(!title)throw Error('행사명을 입력해 주세요.');
 if(!groups.length)throw Error('단체 또는 팀을 한 개 이상 입력해 주세요.');
 if(groups.length>80)throw Error('단체는 한 행사에 최대 80개까지 등록할 수 있습니다.');
 if(new Set(groups).size!==groups.length)throw Error('단체 이름이 중복되었습니다.');
 const mode=['count','names','custom'].includes(input.mode)?input.mode:'count';
 const fields=mode==='custom'?[{key:'name',label:'이름',required:true},...allowedFields.filter(x=>x.key!=='name'&&input.fields?.includes(x.key)).map(x=>({...x,required:!!input.required?.includes(x.key)}))]:mode==='names'?[{key:'name',label:'이름',required:true}]:[];
 return {title,groups,mode,fields,fee:Math.max(0,Math.min(100000000,Math.trunc(Number(input.fee)||0))),date:String(input.date||'').slice(0,10)};
}
export function csvSafe(value){const s=String(value??'');return '"'+(/^[\s]*[=+@-]/.test(s)?"'":'')+s.replaceAll('"','""')+'"';}
export function createCsv(event,groups){
 const fields=event.fields||[];
 const rows=[['행사명','소속 단체','인원','입금확인액',...fields.map(f=>f.label)]];
 for(const g of groups){
  if(event.mode==='count')rows.push([event.title,g.name,g.count,g.paid]);
  else (g.attendees||[]).forEach((p,i)=>rows.push([event.title,g.name,1,i===0?g.paid:'',...fields.map(f=>p[f.key]||'')]));
 }
 return '\ufeff'+rows.map(r=>r.map(csvSafe).join(',')).join('\r\n');
}
export const goodName=s=>String(s||'').trim().length>=1&&String(s||'').trim().length<=60;
