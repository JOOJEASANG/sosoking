export const allowedFields=[
 {key:'name',label:'이름',type:'text'},
 {key:'phone',label:'전화번호',type:'text'},
 {key:'role',label:'직책',type:'text'},
 {key:'gender',label:'성별',type:'select',options:['남성','여성','미응답']},
 {key:'affiliation',label:'세부 소속',type:'text'},
 {key:'meal',label:'식사 여부',type:'select',options:['식사','미식사']},
 {key:'vehicle',label:'차량번호',type:'text'}
];
export const htmlEscape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const parseNameList=raw=>String(raw??'').split(/\r?\n/).map(s=>s.trim().replace(/^\s*(?:\d+[.)]\s*|[-•]\s*)/,'')).filter(Boolean).map(name=>({name:name.slice(0,60)}));
export const normalizePhone=x=>String(x??'').replace(/[^0-9]/g,'').slice(0,11);
const cappedMoney=n=>{
 const amount=Number(n);
 if(!Number.isInteger(amount)||amount<0||amount>100000000)throw Error('금액은 0원 이상 1억 원 이하의 정수로 입력해 주세요.');
 return amount;
};
export function feeItemsFor(event){
 if(Array.isArray(event?.feeItems)){
  return event.feeItems.filter(item=>item&&typeof item.id==='string'&&typeof item.label==='string'&&Number.isFinite(Number(item.amount)))
   .map(item=>({id:item.id,label:item.label,amount:Math.max(0,Math.trunc(Number(item.amount)))}));
 }
 const amount=Math.max(0,Number(event?.fee)||0);
 return amount?[{id:'legacy',label:'참가비',amount}]:[];
}
export function groupExpected(event,g){
 const fees=feeItemsFor(event);
 if(!fees.length)return 0;
 // Preserve established records created before the multiple-fee feature.
 if(!Array.isArray(event?.feeItems))return Math.max(0,Number(g.count)||0)*fees[0].amount;
 if(event.mode==='custom'){
  return (g.attendees||[]).reduce((total,person)=>{
   const chosen=Array.isArray(person.feeIds)?person.feeIds:[];
   return total+fees.reduce((sum,item)=>sum+(chosen.includes(item.id)?item.amount:0),0);
  },0);
 }
 const quantities=(g.feeQuantities&&typeof g.feeQuantities==='object')?g.feeQuantities:null;
 return fees.reduce((sum,item,index)=>{
  const quantity=quantities?Math.max(0,Math.min(Number(g.count)||0,Math.trunc(Number(quantities[item.id])||0))):index===0?(Number(g.count)||0):0;
  return sum+quantity*item.amount;
 },0);
}
export const sumEvent=(event,groups)=>{
 const totals=groups.reduce((a,g)=>{
  a.people+=Number(g.count)||0;
  a.paid+=Number(g.paid)||0;
  a.expected+=groupExpected(event,g);
  if(g.submitted)a.submitted++;
  return a;
 },{people:0,paid:0,expected:0,submitted:0});
 return {...totals,unpaid:Math.max(0,totals.expected-totals.paid),groups:groups.length};
};
function normalizeCustomFields(raw,existing){
 if(!Array.isArray(raw))return [];
 if(raw.length>12)throw Error('직접 추가하는 항목은 최대 12개까지 등록할 수 있습니다.');
 const custom=[];
 const labels=new Set(existing.map(f=>f.label.toLowerCase()));
 for(let i=0;i<raw.length;i++){
  const item=raw[i]||{},label=String(item.label||'').trim();
  if(!label||label.length>30)throw Error('추가 항목의 이름을 1~30자로 입력해 주세요.');
  if(labels.has(label.toLowerCase()))throw Error('입력 항목 이름이 중복되었습니다: '+label);
  labels.add(label.toLowerCase());
  const type=item.type==='select'?'select':'text';
  let options=[];
  if(type==='select'){
   options=(Array.isArray(item.options)?item.options:String(item.options||'').split(/[,\n]/)).map(s=>String(s).trim()).filter(Boolean);
   if(options.length<2||options.length>15)throw Error(label+': 선택 옵션을 2~15개 입력해 주세요.');
   if(options.some(s=>s.length>40)||new Set(options).size!==options.length)throw Error(label+': 선택 옵션이 중복되었거나 40자를 초과했습니다.');
  }
  custom.push({key:'custom_'+(i+1),label,type,options,required:!!item.required});
 }
 return custom;
}
function normalizeFees(raw){
 if(!Array.isArray(raw))throw Error('참가비 설정을 확인해 주세요.');
 if(raw.length>12)throw Error('참가비 항목은 최대 12개까지 등록할 수 있습니다.');
 const labels=new Set();
 return raw.map((item,i)=>{
  const label=String(item?.label||'').trim();
  if(!label||label.length>40)throw Error('참가비 항목 이름을 1~40자로 입력해 주세요.');
  if(labels.has(label.toLowerCase()))throw Error('참가비 항목 이름이 중복되었습니다: '+label);
  labels.add(label.toLowerCase());
  return {id:'fee_'+(i+1),label,amount:cappedMoney(item?.amount)};
 });
}
export function validateEvent(input){
 const title=String(input.title||'').trim().slice(0,100);
 const groups=(input.groups||[]).map(s=>String(s).trim().slice(0,60)).filter(Boolean);
 if(!title)throw Error('행사명을 입력해 주세요.');
 if(!groups.length)throw Error('단체 또는 팀을 한 개 이상 입력해 주세요.');
 if(groups.length>80)throw Error('단체는 한 행사에 최대 80개까지 등록할 수 있습니다.');
 if(new Set(groups).size!==groups.length)throw Error('단체 이름이 중복되었습니다.');
 const mode=['count','names','custom'].includes(input.mode)?input.mode:'count';
 const fields=mode==='custom'?
  [{key:'name',label:'이름',type:'text',required:true},...allowedFields.filter(x=>x.key!=='name'&&input.fields?.includes(x.key))
    .map(x=>({...x,required:!!input.required?.includes(x.key)}))]:
  mode==='names'?[{key:'name',label:'이름',type:'text',required:true}]:[];
 if(mode==='custom')fields.push(...normalizeCustomFields(input.customFields||[],fields));
 if(fields.length>20)throw Error('상세명단 항목은 이름을 포함해 최대 20개입니다.');
 const feeItems=Array.isArray(input.feeItems)?normalizeFees(input.feeItems):
  Number(input.fee)>0?[{id:'fee_1',label:'참가비',amount:cappedMoney(Number(input.fee))}]:[];
 return {title,groups,mode,fields,fee:0,feeItems,date:String(input.date||'').slice(0,10)};
}
export function csvSafe(value){const s=String(value??'');return '"'+(/^[\s]*[=+@-]/.test(s)?"'":'')+s.replaceAll('"','""')+'"';}
export function createCsv(event,groups){
 const fields=event.fields||[],fees=feeItemsFor(event);
 const rows=[['행사명','소속 단체','인원','예상 참가비','입금확인액',...fields.map(f=>f.label),...fees.map(f=>f.label+' 적용 인원'),'참가자 선택 참가비','참가자 비용 합계']];
 for(const g of groups){
  if(event.mode==='count'){
   const qty=g.feeQuantities||{};
   rows.push([event.title,g.name,g.count,groupExpected(event,g),g.paid,...fields.map(()=>''),...fees.map((f,i)=>qty[f.id]??(i===0?g.count:0)),'','']);
  }else if(event.mode==='names'){
   const qty=g.feeQuantities||{};
   (g.attendees||[]).forEach((p,i)=>rows.push([event.title,g.name,1,i===0?groupExpected(event,g):'',i===0?g.paid:'',...fields.map(f=>p[f.key]||''),...fees.map((f,j)=>i===0?(qty[f.id]??(j===0?g.count:0)):'') ,'','']));
   if(!(g.attendees||[]).length)rows.push([event.title,g.name,0,groupExpected(event,g),g.paid,...fields.map(()=>''),...fees.map(f=>qty[f.id]||0),'','']);
  }else{
   (g.attendees||[]).forEach((p,i)=>{
    const selected=fees.filter(f=>Array.isArray(p.feeIds)?p.feeIds.includes(f.id):!Array.isArray(event.feeItems)&&f.id==='legacy');
    rows.push([event.title,g.name,1,i===0?groupExpected(event,g):'',i===0?g.paid:'',...fields.map(f=>p[f.key]||''),...fees.map(f=>selected.some(a=>a.id===f.id)?1:0),selected.map(f=>f.label).join(' / '),selected.reduce((s,f)=>s+f.amount,0)]);
   });
   if(!(g.attendees||[]).length)rows.push([event.title,g.name,0,groupExpected(event,g),g.paid,...fields.map(()=>''),...fees.map(()=>0),'','']);
  }
 }
 return '\ufeff'+rows.map(r=>r.map(csvSafe).join(',')).join('\r\n');
}
export const goodName=s=>String(s||'').trim().length>=1&&String(s||'').trim().length<=60;
