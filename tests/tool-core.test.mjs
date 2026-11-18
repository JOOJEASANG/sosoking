import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseSeparated,parseRoster,findRosterDuplicates,parseChatOrders,orderSummary,ordersCSV,rosterCSV,csvCell,normalizePhone} from '../public/js/tool-core.js';

test('CSV parsing preserves quoted comma and multiline values',()=>{
 assert.deepEqual(parseSeparated('이름,직책\n"김,철수","총무\n회계"'),[['이름','직책'],['김,철수','총무\n회계']]);
});
test('roster parses Korean Excel column headers and checks duplicates',()=>{
 const list=parseRoster('이름,전화번호,직책,소속\n김철수,01012345678,총무,천안\n이영희,01055553333,교사,서울\n김철수,010-1234-5678,총무,천안');
 assert.equal(list.length,3);
 assert.equal(list[0].phone,'010-1234-5678');
 const dupe=findRosterDuplicates(list);
 assert.equal(dupe.duplicateIndices.length,1);
 assert.deepEqual(dupe.unique.map(r=>r.name),['김철수','이영희']);
});
test('roster parses plain name list and phone list',()=>{
 const list=parseRoster('1. 김철수 010-1234-5678 총무\n2) 박민수 010-4567-9999');
 assert.equal(list.length,2);
 assert.equal(list[0].name,'김철수');
 assert.equal(list[0].role,'총무');
 assert.equal(list[1].phone,'010-4567-9999');
});
test('CSV export neutralizes spreadsheet formula injection',()=>{
 assert.match(rosterCSV([{name:'=HYPERLINK("bad")',phone:'',role:'',group:''}]),/"'=HYPERLINK\(""bad""\)"/);
 assert.equal(csvCell('-12'),'"\'-12"');
});
test('chat parser recognizes speaker metadata and order quantity',()=>{
 const parsed=parseChatOrders('김철수 도시락 2개\n홍길동: 도시락 3개\n[이영희] [오후 2:30] 티셔츠 XL 2장\n박민수 티셔츠 L 1장');
 assert.equal(parsed.length,4);
 assert.deepEqual(parsed.slice(0,3).map(x=>[x.name,x.item,x.quantity]),[['김철수','도시락',2],['홍길동','도시락',3],['이영희','티셔츠 XL',2]]);
 assert.equal(parsed[3].item,'티셔츠 L');
});
test('ambiguous chat message is marked for manual review',()=>{
 const data=parseChatOrders('이영희 1개');
 assert.equal(data.length,1);
 assert.equal(data[0].needsReview,true);
 assert.equal(data[0].item,'');
});
test('order aggregation calculates quantities and distinct people',()=>{
 const products=[{name:'도시락',price:8000},{name:'티셔츠',price:15000}];
 const orders=[{name:'김철수',item:'도시락',quantity:2},{name:'김철수',item:'티셔츠',quantity:1},{name:'이영희',item:'도시락',quantity:3}];
 const summary=orderSummary(orders,products);
 assert.equal(summary.total,55000);
 assert.equal(summary.people,2);
 assert.deepEqual(summary.items.map(v=>v.quantity),[5,1]);
 assert.match(ordersCSV(orders,products),/16000/);
});
test('new program pages and functions exist',()=>{
 for(const id of ['roster','orders','chat']){
  const page=fs.readFileSync('public/'+id+'.html','utf8');
  assert.ok(page.includes('src="/js/'+id+'.js"'));
  assert.ok(page.includes('data-install-app'));
  assert.ok(page.includes('rel="canonical"'));
 }
 const hub=fs.readFileSync('public/index.html','utf8');
 assert.equal((hub.match(/data-tool-card/g)||[]).length,5);
 assert.match(hub,/id="toolSearch"/);
 assert.match(hub,/data-filter="collab"/);
});
