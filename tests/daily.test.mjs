import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DEFAULT_ITEMS,CATEGORIES,validateItem,normalizeAnswer,localDateKey,shiftDay,dayProgress,emptyJournal,cleanJournal,normalizeShoppingDetail,shoppingDescription,SHOPPING_CATEGORIES,calculateStreak,monthSummary} from '../public/js/daily-core.js';

test('default daily check covers routine meals, shopping, relationships and playful counts',()=>{
 assert.ok(DEFAULT_ITEMS.length>=8);
 for(const id of ['d_toilet','d_poop','d_fart','d_meal','d_shopping','d_met'])assert.ok(DEFAULT_ITEMS.some(x=>x.id===id),id);
});
test('local date keys handle month boundaries and leap years',()=>{
 assert.equal(localDateKey(new Date(2026,10,19,12)),'2026-11-19');
 assert.equal(shiftDay('2026-12-31',1),'2027-01-01');
 assert.equal(shiftDay('2028-02-28',1),'2028-02-29');
 assert.equal(shiftDay('2026-02-29',0),null);
});
test('custom item validates question kinds, categories and choices',()=>{
 assert.deepEqual(validateItem({title:'   오늘   외출 했어? ',kind:'check',category:'일상'}),{title:'오늘 외출 했어?',kind:'check',category:'일상',options:[]});
 assert.deepEqual(validateItem({title:'오늘 뭐 먹었지?',kind:'choice',category:'먹거리',options:['집밥','배달']} ).options,['집밥','배달']);
 assert.throws(()=>validateItem({title:'방',kind:'count',category:'일상'}));
 assert.throws(()=>validateItem({title:'밥',kind:'choice',category:'먹거리',options:['집밥','집밥']}));
 assert.throws(()=>validateItem({title:'안전한가?',kind:'unknown',category:'일상'}));
});
test('answers support yes/no, count zero and known choices only',()=>{
 assert.equal(normalizeAnswer({kind:'check'},false),false);
 assert.equal(normalizeAnswer({kind:'count'},0),0);
 assert.equal(normalizeAnswer({kind:'count'},-1),null);
 assert.equal(normalizeAnswer({kind:'count'},1000),null);
 assert.equal(normalizeAnswer({kind:'choice',options:['집밥','배달']},'배달'),'배달');
 assert.equal(normalizeAnswer({kind:'choice',options:['집밥']},'비공개'),null);
});
test('progress and streak count valid daily check dates',()=>{
 const data={'2026-11-16':{d_poop:0},'2026-11-17':{d_poop:1},'2026-11-18':{d_laugh:true}};
 assert.equal(calculateStreak(data,'2026-11-19'),3);
 assert.deepEqual(dayProgress([{id:'d_poop'},{id:'d_laugh'}],data['2026-11-16']),{recorded:1,total:2,percent:50});
 assert.deepEqual(monthSummary(data,'2026-11'),{activeDays:3,checks:3});
});
test('backup validation filters malformed items and values',()=>{
 const raw={version:1,days:{'2026-11-19':{d_poop:0,d_meal:'택시',d_laugh:false},'invalid':{d_poop:1}},customItems:[{id:'l_123456789ab',title:'새로운 습관?',kind:'check',category:'일상',options:[]}],sharedItems:[{id:'s_curated_fridge',title:'냉장고를 열었어?',kind:'check',category:'재미',options:[]}],selectedSharedIds:['s_curated_fridge'],hiddenDefaultIds:['d_fart'],hiddenItemIds:['s_curated_fridge']};
 const safe=cleanJournal(raw);
 assert.equal(safe.days['2026-11-19'].d_poop,0);
 assert.equal(safe.days['2026-11-19'].d_laugh,false);
 assert.ok(!('d_meal' in safe.days['2026-11-19']));
 assert.ok(!('invalid' in safe.days));
 assert.equal(safe.hiddenItemIds[0],'s_curated_fridge');
 assert.equal(safe.sharedItems.length,1);
 assert.deepEqual(cleanJournal(emptyJournal()),emptyJournal());
});
test('shopping can be detailed with multiple categories or a free-text note',()=>{
 assert.ok(SHOPPING_CATEGORIES.includes('식료품'));
 assert.ok(SHOPPING_CATEGORIES.includes('의류·패션'));
 assert.deepEqual(normalizeShoppingDetail({types:['식료품','식료품','임의값','의류·패션'],note:'마트에서 우유'}),{types:['식료품','의류·패션'],note:'마트에서 우유'});
 assert.equal(shoppingDescription({types:['생활용품'],note:'세제'}),'생활용품 · 세제');
 assert.equal(shoppingDescription({types:[],note:'  책  '}),'책');
 assert.equal(normalizeShoppingDetail({types:[],note:'a'.repeat(220)}).note.length,120);
});
test('older journal backups remain readable and shopping details roundtrip safely',()=>{
 const old={version:1,days:{'2026-11-20':{d_shopping:true},'2026-11-19':{d_shopping:false}},customItems:[],sharedItems:[],selectedSharedIds:[],hiddenDefaultIds:[],hiddenItemIds:[]};
 const legacy=cleanJournal(old);
 assert.deepEqual(legacy.details,{});
 legacy.details['2026-11-20']={d_shopping:{types:['식료품','생활용품'],note:'간식'}};
 legacy.details['2026-11-19']={d_shopping:{types:['의류·패션'],note:'저장되지 않아야 함'}};
 legacy.details['invalid']={d_shopping:{types:['식료품'],note:'불량 날짜'}};
 const restored=cleanJournal(JSON.parse(JSON.stringify(legacy)));
 assert.deepEqual(restored.details,{'2026-11-20':{d_shopping:{types:['식료품','생활용품'],note:'간식'}}});
 assert.equal(restored.days['2026-11-19'].d_shopping,false);
 assert.equal(restored.days['2026-11-20'].d_shopping,true);
 assert.deepEqual(cleanJournal(restored),restored);
});
test('shopping details do not enter shared item definitions',()=>{
 const raw={version:1,days:{'2026-11-20':{d_shopping:true}},details:{'2026-11-20':{d_shopping:{types:['선택되지 않은 항목','식료품'],note:'직접 입력'}}}};
 const cleaned=cleanJournal(raw);
 assert.deepEqual(cleaned.details['2026-11-20'].d_shopping,{types:['식료품'],note:'직접 입력'});
 assert.ok(!JSON.stringify(cleaned.sharedItems).includes('직접 입력'));
});
test('daily check remains available as an independent program',()=>{
 const html=fs.readFileSync('public/daily.html','utf8');
 for(const marker of ['data-screen="today"','data-screen="explore"','data-screen="history"','data-screen="settings"','id="createDialog"','id="dayPicker"','id="dailyGrid"','id="recordedOnly"','id="goToday"'])assert.ok(html.includes(marker),marker);
 const rules=fs.readFileSync('firestore.rules','utf8');
 assert.match(rules,/match \/publicItems\/\{itemId\}/);
 assert.match(rules,/getAfter\(limitPath\(request.auth.uid\)\)/);
 assert.match(rules,/match \/itemReports\/\{reportId\}/);
 assert.match(rules,/allow read, write: if false/);
});

test('life portal links to each implemented program and keeps existing daily functionality',()=>{
 const home=fs.readFileSync('public/index.html','utf8'),catalog=fs.readFileSync('public/tools.html','utf8');
 for(const name of ['old-phone','event','ferry','orders','community','my']){
  assert.ok((home+catalog).includes('/'+name+'.html'),name+' is linked');
  assert.ok(fs.existsSync('public/'+name+'.html'),name+' page exists');
 }
 assert.ok(!home.includes('/loans.html')&&!home.includes('/daily.html'),'retired tools not on home');
 assert.ok(catalog.includes('id="toolSearch"'));
 assert.ok(home.includes('class="portal-links"'));
 const rules=fs.readFileSync('firestore.rules','utf8');
 assert.match(rules,/match \/lifePosts\/\{id\}/);
 assert.match(rules,/request.resource.data.state=='pending'/);
 assert.match(rules,/match \/lifePolls\/\{id\}/);
 assert.match(rules,/match \/votes\/\{uid\}/);
});
