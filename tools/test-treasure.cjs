const assert=require('node:assert/strict');
const {makeBoard,answerMatches,blankState}=require('../functions/treasure');
const board=makeBoard();
assert.equal(board.length,12);
assert.equal(board.filter(x=>x.kind==='treasure').length,6);
assert.equal(new Set(board.map(x=>x.id)).size,12);
assert.ok(board.every(x=>!Object.hasOwn(x,'answers')),'Answer keys should never appear in public boards');
assert.ok(board.every(x=>x.kind!=='treasure'||(x.question&&x.hint&&x.points>0)));
for(const [id,answer] of Object.entries({moon:'달',north:'북쪽',time:'60',rainbow:'7',forest:'나무',ice:'얼음',sun:'태양',star:'별',water:'물',river:'바다',map:'지도',key:'열쇠'})){
 assert.equal(answerMatches(id,answer),true,id+' answer');
 assert.equal(answerMatches(id,'틀린답'),false,id+' rejects incorrect answer');
}
assert.equal(answerMatches('nonexistent','달'),false);
assert.equal(blankState().status,'waiting');
assert.equal(blankState().rankings.length,0);
console.log('TREASURE UNIT PASS: 12 map locations, 6 hidden puzzles, server-only answers, answer verification.');
