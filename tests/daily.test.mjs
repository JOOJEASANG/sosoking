import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DEFAULT_ITEMS,CATEGORIES,validateItem,normalizeAnswer,localDateKey,shiftDay,dayProgress,emptyJournal,cleanJournal,calculateStreak,monthSummary} from '../public/js/daily-core.js';

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
test('daily check remains available on its own page after portal migration',()=>{
 const html=fs.readFileSync('public/daily.html','utf8');
 for(const marker of ['data-screen="today"','data-screen="explore"','data-screen="history"','data-screen="settings"','id="createDialog"','id="dayPicker"','id="dailyGrid"'])assert.ok(html.includes(marker),marker);
 const rules=fs.readFileSync('firestore.rules','utf8');
 assert.match(rules,/match \/publicItems\/\{itemId\}/);
 assert.match(rules,/getAfter\(limitPath\(request.auth.uid\)\)/);
 assert.match(rules,/match \/itemReports\/\{reportId\}/);
 assert.match(rules,/allow read, write: if false/);
});
