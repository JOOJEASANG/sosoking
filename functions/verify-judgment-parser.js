const assert = require('node:assert/strict');
const { parseJudgmentScript, scriptFingerprint } = require('./judgment-parser');

const sample = `## ⚖️ 사건번호 및 사건명
2026고단1234 마지막 푸딩 사건

## 1. 사건의 경위 (비극의 서막)
원고가 아껴 둔 푸딩을 피고가 먹었다.

## 2. 치열한 수사 과정 (국가적 역량 총동원)
수사팀은 냉장고 문이 열린 시점을 조사하였다.

## 3. 검사의 공소사실 (정의의 단죄)
검사는 마지막 한입 보전의무 위반이라고 주장하였다.

## 4. 변호인의 최후변론 (궤변의 극치)
변호인은 피고가 마지막 푸딩인지 몰랐다고 주장하였다.

## 👨‍⚖️ 판사의 최종 판결 (주문)
재판부는 원고의 억울함을 인정한다.

[주문]
1. 피고는 푸딩 두 개를 배상하라.
2. 피고는 냉장고 마지막 음식에 손대기 전 허가를 구하라.
3. 소송 비용은 피고가 커피 기프티콘으로 부담하라.

푸딩은 작았지만 판결은 작지 않았다.`;

const parsed = parseJudgmentScript(sample);
assert.ok(parsed, 'sample judgment must parse');
assert.match(parsed.facts, /푸딩/);
assert.match(parsed.investigation, /냉장고/);
assert.match(parsed.plaintiff, /보전의무/);
assert.match(parsed.defendant, /몰랐다고/);
assert.match(parsed.opinion, /인정/);
assert.equal(parsed.orders.length, 3);
assert.equal(parsed.primarySentence, '피고는 푸딩 두 개를 배상하라.');
assert.equal(parsed.closingComment, '푸딩은 작았지만 판결은 작지 않았다.');
assert.equal(parsed.quickVerdict, '원고 마음속 일부 승소');
assert.match(parsed.sentence, /^1\./);
assert.match(parsed.sentence, /\n2\./);
assert.match(parsed.sentence, /\n3\./);
assert.equal(scriptFingerprint(sample), scriptFingerprint(sample));
assert.equal(parseJudgmentScript('불완전한 판결문'), null);

console.log('Verified final judgment parser.');
