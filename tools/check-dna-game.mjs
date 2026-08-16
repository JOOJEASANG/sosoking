import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const read = file => fs.readFileSync(file, 'utf8');
const require = createRequire(import.meta.url);
const profile = await import('../public/game/dna-profile.js');
const core = require('../functions/dna-director-core.js');
const dnaGame = read('public/game/dna/dna.js');
const dnaPage = read('public/game/dna/index.html');
const director = read('functions/dna-director.js');
const functionMain = read('functions/main.js');
const packageJson = JSON.parse(read('functions/package.json'));

for (const file of [
  'public/game/dna-profile.js', 'public/game/dna/dna.js',
  'functions/dna-director-core.js', 'functions/dna-director.js'
]) {
  const syntax = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr || `${file} syntax failed`);
}

assert.deepEqual(profile.normalizeDna({ bold: 3.9, safe: -2, unique: '4', reader: 'bad', samples: 7 }), {
  bold: 3, safe: 0, unique: 4, reader: 0, samples: 7
});
assert.deepEqual(profile.addDna({ bold: 2, unique: 1 }, { bold: 3, reader: 2, samples: 1 }), {
  bold: 5, safe: 0, unique: 1, reader: 2, samples: 1
});
assert.equal(profile.dominantTrait({ bold: 8, safe: 1 }, 'u1'), 'bold');
assert.equal(profile.counterTrait({ bold: 8, safe: 1 }, 'u1'), 'safe');
assert.equal(profile.dnaTotal({ bold: 2, safe: 3, unique: 4, reader: 1 }), 10);
for (const seed of ['u1', 'friend-2', '한글닉네임', '']) {
  assert.equal(profile.dominantTrait({}, seed), core.dominantTrait({}, seed), `client/server tie must match for ${seed}`);
}

const fallbackA = core.fallbackPack('ABC234');
const fallbackB = core.fallbackPack('ABC234');
assert.deepEqual(fallbackA, fallbackB, 'fallback pack must be deterministic per room');
assert.equal(fallbackA.roundTitles.length, 3);
assert.equal(fallbackA.taunts.length, 3);
const sanitized = core.sanitizePack({
  bossName: '<script>나쁜왕</script>', bossEmoji: '💀', intro: 'x'.repeat(300),
  roundTitles: ['하나'], taunts: ['도발'], victory: '', defeat: ''
}, fallbackA);
assert.ok(!sanitized.bossName.includes('<'));
assert.ok(sanitized.intro.length <= 140);
assert.equal(sanitized.roundTitles.length, 3);
assert.equal(sanitized.bossEmoji, fallbackA.bossEmoji);

const prompt = core.buildPrompt(core.playerProfiles([
  { uid: 'u1', nickname: '친구', dna: { bold: 5, samples: 3 } },
  { uid: 'u2', nickname: '왕', dna: { reader: 7, samples: 4 } }
]));
assert.match(prompt, /게임 안 선택 수치만/);
assert.match(prompt, /새로운 규칙이나 숫자를 만들지 말고/);
assert.match(prompt, /돌진형/);
assert.match(prompt, /독심형/);

for (const required of [
  'SCAN_ROUNDS = 3', 'BATTLE_RULES', "'dna-scan'", "'dna-battle'",
  'counterTrait(me?.dna', 'addDna(player.dna', '방 전체 기준 AI 1회 호출',
  '대화·사진·개인정보는 보내지 않습니다.', 'AI가 응답하지 않아도', 'aiMode'
]) assert.ok(dnaGame.includes(required), `DNA game missing: ${required}`);
assert.match(dnaPage, /소소킹 DNA: 습관파괴왕/);
assert.match(dnaPage, /친구들의 버릇이 다음 규칙이 된다/);

for (const required of [
  "MODEL = process.env.DNA_AI_MODEL || 'gemini-2.5-flash-lite'", 'enforceActionRateLimit',
  'dailyLimit: 12', 'minInstances: 0', 'maxInstances: 2', "data.aiStatus === 'generating'", 'responseMimeType:',
  "responseMimeType: 'application/json'", 'responseSchema: responseSchema()',
  'maxOutputTokens: 520', 'AbortSignal.timeout(9000)', "mode = 'fallback'"
]) assert.ok(director.includes(required), `DNA director missing: ${required}`);
assert.match(functionMain, /require\('\.\/dna-director'\)/);
assert.equal(packageJson.dependencies['google-auth-library'], '^9.15.1');

console.log('DNA game validation passed: cumulative traits, deterministic mechanics, one-call AI director, structured output, sanitization, and no-cost fallback are wired.');
