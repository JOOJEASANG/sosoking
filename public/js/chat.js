import {parseChatOrders,csvText} from './tool-core.js';
import {downloadCsv,writeTransfer,toast} from './tool-ui.js';
const $=id=>document.getElementById(id);
let rows=[];
function valid(row){return !!row.name.trim()&&!!row.item.trim()&&Number.isInteger(Number(row.quantity))&&Number(row.quantity)>0&&Number(row.quantity)<=10000;}
function stats(){
 const errors=rows.filter(r=>!valid(r)).length;
 $('chatStats').innerHTML='<div><span>추출한 주문</span><strong>'+rows.length+'건</strong></div><div><span>확인 필요</span><strong>'+errors+'건</strong></div>';
}
function render(){
 $('chatResult').hidden=!rows.length;$('chatEmpty').hidden=!!rows.length;
 stats();
 const tbody=$('chatTable').tBodies[0];tbody.replaceChildren();
 rows.forEach((row,i)=>{
  const tr=document.createElement('tr');if(!valid(row))tr.className='needs-review';
  const status=document.createElement('td');status.className='review-state';status.textContent=valid(row)?'확인':'수정 필요';tr.append(status);
  for(const [key,label] of [['name','주문자'],['item','상품·항목'],['quantity','수량']]){
   const td=document.createElement('td'),inp=document.createElement('input');inp.className='cell-input';inp.setAttribute('aria-label',(i+1)+'번 '+label);
   inp.type=key==='quantity'?'number':'text';inp.value=row[key]??'';if(key==='quantity'){inp.min='1';inp.max='10000';inp.step='1';inp.inputMode='numeric';}
   else inp.maxLength=80;
   inp.addEventListener('input',()=>{row[key]=key==='quantity'?inp.value:inp.value.slice(0,80);tr.classList.toggle('needs-review',!valid(row));status.textContent=valid(row)?'확인':'수정 필요';stats();});
   td.append(inp);tr.append(td);
  }
  const delTd=document.createElement('td');const btn=document.createElement('button');btn.className='table-delete';btn.type='button';btn.textContent='삭제';btn.setAttribute('aria-label',(i+1)+'번 삭제');btn.onclick=()=>{rows.splice(i,1);render();};delTd.append(btn);tr.append(delTd);tbody.append(tr);
 });
}
function parse(){
 const text=$('chatText').value;
 if(!text.trim()){toast('정리할 카톡 내용을 붙여 넣어 주세요.','error');return;}
 rows=parseChatOrders(text).map(r=>({...r}));
 if(!rows.length){toast('주문자·항목·수량을 인식하지 못했습니다. 문장 형식을 확인해 주세요.','error');render();return;}
 render();toast(rows.length+'건을 추출했습니다. 표에서 내용을 확인해 주세요.');
}
$('chatParse').onclick=parse;
$('chatExample').onclick=()=>{$('chatText').value='김철수 일반 도시락 2개\n이영희 일반 도시락 1개\n박민수 티셔츠 XL 2장\n홍길동: 특식 도시락 3개';parse();};
$('chatClear').onclick=()=>{$('chatText').value='';rows=[];render();toast('입력값을 초기화했습니다.');};
$('chatCsv').onclick=()=>{
 if(!rows.length){toast('다운로드할 내용이 없습니다.','error');return;}
 downloadCsv('소소킹-카톡정리.csv',csvText([['주문자','항목','수량','확인 상태'],...rows.map(r=>[r.name,r.item,r.quantity,valid(r)?'확인':'수정 필요'])]));
};
function ready(){if(!rows.length){toast('정리한 내용이 없습니다.','error');return false;}
if(rows.some(r=>!valid(r))){toast('주문자·상품·수량이 비어 있는 행을 먼저 수정해 주세요.','error');return false;}
return true;}
$('chatToOrders').onclick=()=>{
 if(!ready())return;
 if(!writeTransfer('chat-orders',{orders:rows.map(({name,item,quantity})=>({name,item,quantity:Number(quantity)}))})){toast('브라우저의 임시 전달 기능을 사용할 수 없습니다.','error');return;}
 location.href='/orders.html';
};
$('chatToRoster').onclick=()=>{
 if(!ready())return;
 if(!writeTransfer('chat-roster',{names:rows.map(r=>r.name)})){toast('브라우저의 임시 전달 기능을 사용할 수 없습니다.','error');return;}
 location.href='/roster.html';
};
