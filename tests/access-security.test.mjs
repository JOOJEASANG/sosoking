import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('모임집계 name is consistent across program list and event page',()=>{
 for(const path of ['public/index.html','public/event.html','public/old-phone.html']){
  const html=fs.readFileSync(path,'utf8');
  assert.ok(html.includes('모임집계'),path);
 }
});
test('organizer and participant instructions are distinct',()=>{
 const app=fs.readFileSync('public/js/event.js','utf8');
 assert.match(app,/행사 총괄자/);
 assert.match(app,/단체 담당자/);
 assert.match(app,/승인 완료 · 접속 비밀번호 입력/);
 assert.match(app,/비밀번호 다시 만들기/);
});
test('password proof is enforced inside Firestore rule, never only in the UI',()=>{
 const rules=fs.readFileSync('firestore.rules','utf8');
 assert.match(rules,/function verifiedAccess\(eventId\)/);
 assert.match(rules,/function validProof\(\)/);
 assert.match(rules,/member\(eventId\).status == 'approved'/);
 assert.match(rules,/request.resource.data.hash ==/);
 assert.match(rules,/get\(\/databases\/\$\(database\)\/documents\/events\/\$\(eventId\)\/private\/accessPassword\).data.hash/);
 assert.match(rules,/verifiedAccess\(eventId\)/);
 assert.match(rules,/request.resource.data.version == get\(eventPath\(eventId\)\).data.passwordVersion/);
});
