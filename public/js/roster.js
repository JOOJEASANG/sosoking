import {parseRoster,findRosterDuplicates,rosterCSV,escapeHtml} from './tool-core.js';
import {downloadCsv,readTransfer,writeTransfer,toast} from './tool-ui.js';
const $=id=>document.getElementById(id);
const fields=['name','phone','role','group'];
let rows=[],lastDuplicates=0;
const eventId=new URLSearchParams(location.search).get('returnEvent')||'';
const groupId=new URLSearchParams(location.search).get('group')||'';
const safeId=/^[a-zA-Z0-9_-]{8,50}$/;
const validTarget=safeId.test(eventId)&&safeId.test(groupId);
function stats(){
 $('rosterStats').innerHTML='<div><span>정리된 명단</span><strong>'+rows.length+'명</strong></div><div><span>확인된 중복</span><strong>'+lastDuplicates+'건</strong></div>';
}
function render(){
 $('rosterEmpty').hidden=true;$('rosterResult').hidden=false;
 $('rosterHandoff').hidden=!validTarget;
 stats();
 const body=$('rosterTable').tBodies[0];body.replaceChildren();
 rows.forEach((row,i)=>{
  const tr=document.createElement('tr');
  let td=document.createElement('td');td.textContent=i+1;tr.append(td);
  for(const field of fields){
   td=document.createElement('td');
   const input=document.createElement('input');input.className='cell-input';
   input.value=row[field]||'';input.dataset.field=field;input.setAttribute('aria-label',i+1+'번 '+({name:'이름',phone:'전화번호',role:'직책',group:'소속'}[field]));
   input.maxLength=field==='name'?60:100;
   input.addEventListener('input',()=>{row[field]=input.value.trim();});
   td.append(input);tr.append(td);
  }
  td=document.createElement('td');
  const btn=document.createElement('button');btn.type='button';btn.className='table-delete';btn.setAttribute('aria-label',i+1+'번 삭제');btn.textContent='삭제';
  btn.onclick=()=>{rows.splice(i,1);render();};td.append(btn);tr.append(td);body.append(tr);
 });
}
function parse(){
 const text=$('rosterText').value;
 if(!text.trim()){toast('명단을 붙여 넣어 주세요.','error');return;}
 const extracted=parseRoster(text);
 if(!extracted.length){toast('이름을 인식하지 못했습니다. 줄바꿈이나 표 형식을 확인해 주세요.','error');return;}
 const duplicates=findRosterDuplicates(extracted);
 lastDuplicates=duplicates.duplicateIndices.length;
 rows=($('rosterRemoveDuplicates').checked?duplicates.unique:extracted).map(row=>({...row}));
 render();toast(rows.length+'명의 명단을 정리했습니다.');
}
$('rosterParse').onclick=parse;
$('rosterExample').onclick=()=>{
 $('rosterText').value='이름,전화번호,직책,소속\n김철수,010-1234-5678,총무,천안팀\n이영희,010-5555-3333,부회장,서울팀\n김철수,010-1234-5678,총무,천안팀\n박민수,010-9876-4321,회원,천안팀';
 parse();
};
$('rosterClear').onclick=()=>{
 $('rosterText').value='';rows=[];lastDuplicates=0;$('rosterResult').hidden=true;$('rosterEmpty').hidden=false;$('rosterFile').value='';toast('화면을 초기화했습니다.');
};
$('rosterFile').onchange=async event=>{
 const file=event.target.files?.[0];if(!file)return;
 if(file.size>2*1024*1024){toast('2MB 이하의 CSV·TXT 파일만 사용할 수 있습니다.','error');return;}
 const ext=file.name.toLowerCase().split('.').pop();
 if(!['csv','tsv','txt'].includes(ext)){toast('CSV, TSV, TXT 파일만 열 수 있습니다.','error');return;}
 try{
  const buffer=await file.arrayBuffer();let content=new TextDecoder('utf-8',{fatal:false}).decode(buffer);
  if(content.includes('\ufffd'))content=new TextDecoder('euc-kr',{fatal:false}).decode(buffer);
  $('rosterText').value=content;parse();
 }catch{toast('파일을 읽지 못했습니다.','error');}
};
$('rosterSort').onclick=()=>{rows.sort((a,b)=>a.name.localeCompare(b.name,'ko'));render();};
$('rosterCsv').onclick=()=>downloadCsv('소소킹-정리명단.csv',rosterCSV(rows));
$('rosterCopy').onclick=async()=>{
 try{await navigator.clipboard.writeText(rows.map(r=>r.name).filter(Boolean).join('\n'));toast('이름을 복사했습니다.');}
 catch{toast('복사를 허용하지 않는 브라우저입니다. CSV로 저장해 주세요.','error');}
};
$('rosterTransfer').onclick=()=>{
 if(!validTarget){toast('모임집계에서 명단정리 버튼으로 들어와 주세요.','error');return;}
 if(!rows.length){toast('보낼 명단이 없습니다.','error');return;}
 if(!writeTransfer('event-roster',{eventId,groupId,rows})){toast('현재 브라우저는 임시 전달을 지원하지 않습니다. CSV로 저장해 주세요.','error');return;}
 location.href='/event.html?id='+encodeURIComponent(eventId);
};
const imported=readTransfer('chat-roster');
if(imported&&Array.isArray(imported.names)){
 $('rosterText').value=imported.names.filter(x=>typeof x==='string').slice(0,1000).join('\n');
 if($('rosterText').value)parse();
}
if(validTarget)$('rosterHandoff').hidden=false;
