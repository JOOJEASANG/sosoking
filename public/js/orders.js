import {orderSummary,ordersCSV,escapeHtml,won} from './tool-core.js';
import {downloadCsv,readTransfer,toast} from './tool-ui.js';
const $=id=>document.getElementById(id);
let products=[{name:'',price:0}],orders=[{name:'',item:'',quantity:1}];
const validProducts=()=>products.filter(p=>p.name.trim()&&Number.isFinite(Number(p.price))&&Number(p.price)>=0);
const validOrders=()=>orders.filter(o=>o.name.trim()&&o.item.trim()&&Number.isInteger(Number(o.quantity))&&Number(o.quantity)>0).map(o=>({...o,quantity:Number(o.quantity)}));
function cell(content,label){
 const c=document.createElement('label');c.className='stack-sm';c.innerHTML='<span class="label">'+label+'</span>'+content;return c;
}
function inputRow(parent,values,index,isProduct){
 const box=document.createElement('div');box.className='work-item-row';
 const form=document.createElement('div');form.className='work-item-fields';
 const columns=isProduct?[
  ['name','상품명','text','예: 도시락'],
  ['price','단가 (원)','number','예: 8000']
 ]:[
  ['name','주문자','text','예: 김철수'],
  ['item','상품명','text','예: 도시락'],
  ['quantity','수량','number','1']
 ];
 for(const [key,label,type,hint] of columns){
  const field=cell('<input class="input" type="'+type+'" placeholder="'+hint+'">',label);
  const inp=field.querySelector('input');inp.value=values[key]??'';
  inp.maxLength=80;
  if(type==='number'){inp.inputMode='numeric';inp.min=isProduct?'0':'1';inp.step='1';}
  inp.setAttribute('aria-label',label);
  inp.addEventListener('input',()=>{
   values[key]=type==='number'?inp.value:inp.value.slice(0,80);
   update();
  });
  form.append(field);
 }
 const del=document.createElement('button');del.type='button';del.className='table-delete';del.textContent='삭제';del.setAttribute('aria-label',(isProduct?'상품':'주문')+(index+1)+'번 삭제');
 del.onclick=()=>{(isProduct?products:orders).splice(index,1);render();};
 box.append(form,del);parent.append(box);
}
function render(){
 $('productList').replaceChildren();$('orderList').replaceChildren();
 products.forEach((p,i)=>inputRow($('productList'),p,i,true));
 orders.forEach((p,i)=>inputRow($('orderList'),p,i,false));
 update();
}
function update(){
 const list=validOrders(),goods=validProducts(),summary=orderSummary(list,goods);
 const totalCount=list.reduce((a,o)=>a+o.quantity,0);
 $('orderStats').innerHTML='<div><span>주문 건수</span><strong>'+list.length+'건</strong></div><div><span>총 주문 수량</span><strong>'+totalCount+'개</strong></div><div><span>주문자</span><strong>'+summary.people+'명</strong></div>';
 const body=$('orderSummaryBody');body.replaceChildren();
 if(!summary.items.length){
  const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=4;td.textContent='주문자를 입력하면 이곳에 상품별 합계가 표시됩니다.';td.className='empty-table-cell';tr.append(td);body.append(tr);
 }
 for(const item of summary.items){
  const tr=document.createElement('tr');
  for(const val of [item.item,item.quantity,won(item.price),won(item.amount)]){
   const td=document.createElement('td');td.textContent=val;tr.append(td);
  }
  body.append(tr);
 }
 $('orderTotal').textContent=won(summary.total);
 const unknown=summary.items.some(row=>!goods.some(p=>p.name.trim()===row.item));
 $('unmatchedWarning').hidden=!unknown;
}
$('addProduct').onclick=()=>{if(products.length>=40){toast('한 번에 상품을 최대 40개까지 관리할 수 있습니다.','error');return;}products.push({name:'',price:0});render();};
$('addOrder').onclick=()=>{if(orders.length>=500){toast('한 번에 주문을 최대 500건까지 관리할 수 있습니다.','error');return;}orders.push({name:'',item:'',quantity:1});render();};
$('orderExample').onclick=()=>{
 products=[{name:'일반 도시락',price:8000},{name:'특식 도시락',price:12000},{name:'티셔츠 XL',price:15000}];
 orders=[{name:'김철수',item:'일반 도시락',quantity:2},{name:'이영희',item:'특식 도시락',quantity:1},{name:'박민수',item:'티셔츠 XL',quantity:3}];render();
};
$('orderReset').onclick=()=>{
 if(!confirm('작성한 상품과 주문 내용을 모두 지울까요? 이 정보는 서버에 저장되지 않았습니다.'))return;
 products=[{name:'',price:0}];orders=[{name:'',item:'',quantity:1}];render();
};
$('downloadOrders').onclick=()=>{
 const list=validOrders();
 if(!list.length){toast('저장할 주문이 없습니다.','error');return;}
 downloadCsv('소소킹-주문모아.csv',ordersCSV(list,validProducts()));toast('CSV 파일을 저장했습니다.');
};
const importData=readTransfer('chat-orders');
if(importData&&Array.isArray(importData.orders)){
 const valid=importData.orders.slice(0,500).filter(o=>typeof o?.name==='string'&&typeof o?.item==='string'&&Number.isInteger(Number(o?.quantity))&&Number(o.quantity)>0);
 if(valid.length){
  orders=valid.map(o=>({name:o.name.slice(0,60),item:o.item.slice(0,80),quantity:Number(o.quantity)}));
  const names=[...new Set(orders.map(o=>o.item))].slice(0,40);
  products=names.map(name=>({name,price:0}));
  toast(valid.length+'건을 가져왔습니다. 상품 단가를 입력하면 금액이 계산됩니다.');
 }
}
render();
