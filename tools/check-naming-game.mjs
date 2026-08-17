import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  activePlayers,
  annotateEntries,
  cleanName,
  cleanTopic,
  evaluateTurn,
  isDuplicateName,
  normalizeName,
  orderedPlayers
} from '../public/game/naming/naming-core.js';

const source = fs.readFileSync('public/game/naming/naming.js', 'utf8');
const page = fs.readFileSync('public/game/naming/index.html', 'utf8');
const rules = fs.readFileSync('firestore.rules', 'utf8');

assert.equal(cleanTopic('  새   카페 이름  '), '새 카페 이름');
assert.equal(cleanTopic('가'.repeat(60)).length, 40);
assert.equal(cleanName('  소소  킹  '), '소소 킹');
assert.equal(cleanName('나'.repeat(40)).length, 24);
assert.equal(normalizeName('소소-킹!'), normalizeName(' 소소 킹 '));
assert.equal(normalizeName('ＡＢＣ'), 'abc');

const roster = Array.from({ length: 120 }, (_, index) => ({
  uid: `p${String(index).padStart(3, '0')}`,
  nickname: `참가자${index + 1}`,
  score: 0,
  eliminated: false,
  joinOrder: index + 1
})).reverse();
assert.equal(orderedPlayers(roster)[0].uid, 'p000');
assert.equal(activePlayers(roster).length, 120, 'unlimited lobby simulation lost players');

const entries = [
  { id: 'A', turn: 1, uid: 'p000', kind: 'name', text: '달빛 정거장', normalized: '달빛정거장' },
  { id: 'B', turn: 2, uid: 'p001', kind: 'name', text: '달빛-정거장', normalized: '달빛정거장' },
  { id: 'C', turn: 3, uid: 'p002', kind: 'forfeit', text: '', normalized: '' }
];
const annotated = annotateEntries(entries);
assert.equal(annotated[0].accepted, true);
assert.equal(annotated[1].duplicate, true);
assert.equal(isDuplicateName(entries.slice(0, 1), '달빛 정거장!'), true);

const accepted = evaluateTurn({
  players: orderedPlayers(roster).slice(0, 3),
  entries: [],
  currentUid: 'p000',
  kind: 'name',
  text: '새 이름'
});
assert.equal(accepted.accepted, true);
assert.equal(accepted.nextUid, 'p001');
assert.equal(accepted.activeCount, 3);

const duplicate = evaluateTurn({
  players: orderedPlayers(roster).slice(0, 3),
  entries: [{ id: 'A', turn: 1, uid: 'p000', kind: 'name', text: '새 이름' }],
  currentUid: 'p001',
  kind: 'name',
  text: '새-이름'
});
assert.equal(duplicate.duplicate, true);
assert.equal(duplicate.eliminated, true);
assert.equal(duplicate.nextUid, 'p002');

const lastTwo = [
  { uid: 'p000', joinOrder: 1, eliminated: false },
  { uid: 'p001', joinOrder: 2, eliminated: false }
];
const finish = evaluateTurn({ players: lastTwo, currentUid: 'p001', kind: 'forfeit' });
assert.equal(finish.finished, true);
assert.equal(finish.winnerUid, 'p000');

for (const required of [
  "const GAME_TYPE = 'naming-survival'",
  'const TURN_SECONDS = 30',
  "collection(db, 'game_rooms', roomId, 'naming_sessions', sessionId, 'entries')",
  "kind: 'forfeit'",
  "kind: 'timeout'",
  'runTransaction',
  'maxPlayers: 0',
  '이전 세션의 작명 기록은 삭제하지 않습니다.'
]) assert.ok(source.includes(required), `Naming source missing: ${required}`);

for (const required of ['작명톡 생존전', '인원 제한 없이', '작명 기록']) {
  assert.ok(page.includes(required), `Naming page missing: ${required}`);
}
for (const required of [
  "data.type == 'naming-survival'",
  'match /naming_sessions/{sessionId}',
  'entryId == gameRoomDoc(roomId).data.turnToken',
  'allow update, delete: if false'
]) assert.ok(rules.includes(required), `Naming rules missing: ${required}`);
assert.ok(!fs.existsSync('public/game/alibi/index.html'));
assert.ok(!fs.existsSync('public/game/alibi/alibi.js'));

console.log('Naming survival validation passed: 120-player order, duplicate normalization, turn rotation, elimination, immutable session records, and Alibi removal are consistent.');
