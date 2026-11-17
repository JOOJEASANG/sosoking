import test from 'node:test';
import assert from 'node:assert/strict';
import {validateEvent,parseNameList,sumEvent,groupExpected,feeItemsFor,htmlEscape,createCsv} from '../public/js/event-core.js';

test('count, name, and detailed attendance modes still work',()=>{
 const a=validateEvent({title:'행사',groups:['A','B'],mode:'count',fee:20000});
 assert.equal(a.fields.length,0);assert.equal(a.groups.length,2);assert.equal(a.feeItems[0].amount,20000);
 const b=validateEvent({title:'행사',groups:['A'],mode:'custom',fields:['phone','role'],required:['role']});
 assert.equal(b.fields.length,3);assert.equal(b.fields[2].required,true);
 const c=validateEvent({title:'행사',groups:['A'],mode:'names'});
 assert.equal(c.fields.length,1);
});
test('event title/group validation',()=>{
 for(const v of [{title:'',groups:['A']},{title:'T',groups:[]},{title:'T',groups:['A','A']}])
  assert.throws(()=>validateEvent(v));
});
test('old single fee events preserve past sum semantics',()=>{
 const e={fee:20000};
 const r=sumEvent(e,[{count:2,paid:10000,submitted:true},{count:3,paid:0,submitted:false}]);
 assert.deepEqual(r,{people:5,paid:10000,submitted:1,expected:100000,unpaid:90000,groups:2});
 assert.equal(feeItemsFor(e)[0].id,'legacy');
});
test('custom name and option field builder',()=>{
 const e=validateEvent({
  title:'임원수련회',groups:['A'],mode:'custom',
  fields:['role','gender'],required:['role'],
  customFields:[
   {label:'식사 종류',type:'select',options:'일반, 채식, 도시락',required:true},
   {label:'교회 이름',type:'text',required:false}
  ]
 });
 assert.equal(e.fields.length,5);
 assert.deepEqual(e.fields.map(f=>f.key),['name','role','gender','custom_1','custom_2']);
 assert.deepEqual(e.fields[3].options,['일반','채식','도시락']);
 assert.equal(e.fields[3].required,true);
 assert.equal(e.fields[4].type,'text');
});
test('custom fields reject duplicate labels, missing options, excessive counts',()=>{
 const base={title:'행사',groups:['A'],mode:'custom'};
 assert.throws(()=>validateEvent({...base,customFields:[{label:'직책',type:'text'}],fields:['role']}),/중복/);
 assert.throws(()=>validateEvent({...base,customFields:[{label:'식단',type:'select',options:'채식'}]}),/2~15/);
 assert.throws(()=>validateEvent({...base,customFields:Array.from({length:13},(_,i)=>({label:'항목'+i}))}),/최대/);
});
test('multiple fee items are generated with unique stable keys',()=>{
 const e=validateEvent({
  title:'행사',groups:['A'],mode:'custom',
  feeItems:[{label:'일반 등록비',amount:'20000'},{label:'식비',amount:'5000'},{label:'무료',amount:0}]
 });
 assert.deepEqual(e.feeItems.map(f=>f.id),['fee_1','fee_2','fee_3']);
 assert.deepEqual(e.feeItems.map(f=>f.amount),[20000,5000,0]);
 assert.equal(e.fee,0);
});
test('fee items reject duplicate labels, negative price, too many items',()=>{
 const b={title:'행사',groups:['A'],mode:'count'};
 assert.throws(()=>validateEvent({...b,feeItems:[{label:'일반',amount:1000},{label:'일반',amount:2000}]}),/중복/);
 assert.throws(()=>validateEvent({...b,feeItems:[{label:'일반',amount:-1}]}),/금액/);
 assert.throws(()=>validateEvent({...b,feeItems:Array.from({length:13},(_,i)=>({label:'비용'+i,amount:1000}))}),/최대/);
});
test('count-based registration sums per-fee quantities, including overlapping extras',()=>{
 const e=validateEvent({title:'행사',groups:['A'],mode:'count',feeItems:[
  {label:'성인 등록비',amount:20000},{label:'식비',amount:5000}
 ]});
 const a={count:5,paid:20000,submitted:true,feeQuantities:{fee_1:3,fee_2:4}};
 const b={count:2,paid:0,submitted:true,feeQuantities:{fee_1:2,fee_2:0}};
 assert.equal(groupExpected(e,a),80000);
 assert.equal(groupExpected(e,b),40000);
 const s=sumEvent(e,[a,b]);
 assert.equal(s.expected,120000);assert.equal(s.people,7);assert.equal(s.unpaid,100000);
});
test('detailed registration sums fees by each attendee',()=>{
 const e=validateEvent({title:'행사',groups:['A'],mode:'custom',feeItems:[
  {label:'성인',amount:20000},{label:'식사 추가',amount:5000}
 ]});
 const g={count:3,attendees:[
  {name:'김',feeIds:['fee_1','fee_2']},
  {name:'이',feeIds:['fee_1']},
  {name:'박',feeIds:[]}
 ],paid:15000,submitted:true};
 assert.equal(groupExpected(e,g),45000);
 assert.equal(sumEvent(e,[g]).unpaid,30000);
 const csv=createCsv(e,[g]);
 assert.match(csv,/성인 적용 인원/);
 assert.match(csv,/식사 추가 적용 인원/);
 assert.match(csv,/25000/);
});
test('name list strips numbered lines',()=>assert.deepEqual(
 parseNameList('1. 김철수\n2) 이영희\n\n- 박영수').map(n=>n.name),['김철수','이영희','박영수']
));
test('safe escaping in HTML and exported CSV formula-like values',()=>{
 assert.equal(htmlEscape('<script>'),'&lt;script&gt;');
 const csv=createCsv({title:'행사',mode:'names',fields:[{key:'name',label:'이름'}]},
 [{name:'A',count:1,paid:0,attendees:[{name:'=HYPERLINK(1)'}]}]);
 assert.match(csv,/"'=HYPERLINK\(1\)"/);
});
