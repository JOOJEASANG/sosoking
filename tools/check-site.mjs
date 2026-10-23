import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=x=>readFileSync(x,'utf8');
const page=read('index.html'), app=read('src/app.js'),api=read('functions/main.js'),css=read('src/style.css'),firebase=JSON.parse(read('firebase.json'));
const ids=['raffle','poll','wheel','score','teams','timer','bracket'];
for(const id of ids){
 assert.ok(app.includes("id:'"+id+"'"),id+' card must exist');
 assert.ok(app.includes("case '"+id+"':"),id+' module UI must exist');
 assert.ok(api.includes("case '"+id+"."),id+' server action must exist');
}
assert.doesNotMatch(page,/OX\s*퀴즈/i,'OX quiz excluded');
assert.equal(new Set(ids).size,7);
assert.match(page,/소소킹 LIVE/);
assert.match(app,/QRCode\.toCanvas/);
assert.match(app,/encodeURIComponent\(id\)/);
assert.match(app,/data-form="create"/);
assert.match(app,/data-form="join"/);
assert.match(app,/'x-person-id':personId/);
assert.match(api,/crypto\.randomInt/);
assert.match(api,/timingSafeEqual/);
assert.match(api,/runTransaction/);
assert.ok(!api.includes('GEMINI_API_KEY'),'No AI runtime calls');
assert.ok(css.length>15000,'responsive UI styles present');
assert.equal(firebase.hosting.public,'dist');
assert.equal(firebase.hosting.rewrites[0].function.functionId,'sosokingEventApi');
console.log('SOSOKING LIVE PASS: seven modules, event QR, client roles, backend and responsive UI.');
