'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { CHARACTERS, CHAR_LIST } = require('./king-character-catalog');
const { AI_RUNTIME_SECRETS, readRuntimeConfig, callAI, callAndParse } = require('./ai-runtime-provider');

if (!getApps().length) initializeApp();

const db = getFirestore();
const REGION = 'asia-northeast3';
const DEFAULT_DAILY_LIMIT = 3;

function todayKst() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function monthKst() {
  return todayKst().slice(0, 7);
}

function requireUser(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요해요.');
  return uid;
}

function cleanText(value, maxLength) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, maxLength);
}

function getCharacter(id) {
  const charId = cleanText(id, 40);
  const character = CHARACTERS[charId];
  if (!character) throw new HttpsError('invalid-argument', 'AI 캐릭터 선택이 올바르지 않아요.');
  return { id: charId, ...character };
}

function getCharacters(ids, expectedCount = 3) {
  const unique = [...new Set(Array.isArray(ids) ? ids.map(id => cleanText(id, 40)) : [])]
    .filter(id => CHARACTERS[id]);
  if (unique.length !== expectedCount) {
    throw new HttpsError('invalid-argument', `AI 캐릭터를 정확히 ${expectedCount}명 선택해주세요.`);
  }
  return unique.map(getCharacter);
}

async function consumeUsage(uid, feature) {
  const config = await readRuntimeConfig();
  const dailyLimit = Number(config.dailyFreeLimit || DEFAULT_DAILY_LIMIT);
  const monthlyCap = Math.max(0, Number(config.monthlyCap || 0));
  if (!config.enabled) {
    return { allowed: false, reason: 'disabled', dailyLimit, monthlyCap, monthlyUsed: 0, usedExtra: false };
  }

  const date = todayKst();
  const month = monthKst();
  const usageRef = db.doc(`ai_king_usage/${uid}_${date}_${feature}`);
  const monthlyRef = db.doc(`ai_king_usage/${uid}_${month}_monthly`);
  const userRef = db.doc(`users/${uid}`);

  return db.runTransaction(async transaction => {
    const [usageSnap, monthlySnap, userSnap] = await Promise.all([
      transaction.get(usageRef),
      transaction.get(monthlyRef),
      transaction.get(userRef),
    ]);
    const count = Number(usageSnap.exists ? usageSnap.data()?.count || 0 : 0);
    const monthlyUsed = Number(monthlySnap.exists ? monthlySnap.data()?.count || 0 : 0);

    if (monthlyCap > 0 && monthlyUsed >= monthlyCap) {
      return { allowed: false, reason: 'monthly', dailyLimit, monthlyCap, monthlyUsed, usedExtra: false };
    }

    const monthlyWrite = {
      userId: uid,
      type: 'monthly',
      month,
      count: monthlyUsed + 1,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (count < dailyLimit) {
      transaction.set(usageRef, {
        userId: uid,
        feature,
        date,
        count: count + 1,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      transaction.set(monthlyRef, monthlyWrite, { merge: true });
      return { allowed: true, reason: null, usedExtra: false, dailyLimit, monthlyCap, monthlyUsed: monthlyUsed + 1 };
    }

    const extra = Number(userSnap.exists ? userSnap.data()?.extraAiUses || 0 : 0);
    if (extra > 0) {
      transaction.set(userRef, {
        extraAiUses: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      transaction.set(monthlyRef, monthlyWrite, { merge: true });
      return { allowed: true, reason: null, usedExtra: true, dailyLimit, monthlyCap, monthlyUsed: monthlyUsed + 1 };
    }

    return { allowed: false, reason: 'daily', usedExtra: false, dailyLimit, monthlyCap, monthlyUsed };
  });
}

async function refundUsage(uid, feature, usage) {
  if (!usage?.allowed) return;
  try {
    const usageRef = db.doc(`ai_king_usage/${uid}_${todayKst()}_${feature}`);
    const monthlyRef = db.doc(`ai_king_usage/${uid}_${monthKst()}_monthly`);
    const userRef = db.doc(`users/${uid}`);

    await db.runTransaction(async transaction => {
      const [dailySnap, monthlySnap] = await Promise.all([
        transaction.get(usageRef),
        transaction.get(monthlyRef),
      ]);
      const dailyCount = Number(dailySnap.exists ? dailySnap.data()?.count || 0 : 0);
      const monthlyCount = Number(monthlySnap.exists ? monthlySnap.data()?.count || 0 : 0);

      if (!usage.usedExtra && dailyCount > 0) {
        transaction.set(usageRef, {
          count: dailyCount - 1,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      if (monthlyCount > 0) {
        transaction.set(monthlyRef, {
          count: monthlyCount - 1,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      if (usage.usedExtra) {
        transaction.set(userRef, {
          extraAiUses: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    });
  } catch (error) {
    console.error('[king-playground] usage refund failed:', error.message);
  }
}

function assertUsageAllowed(usage, label) {
  if (usage.allowed) return;
  if (usage.reason === 'disabled') throw new HttpsError('failed-precondition', 'AI 기능이 현재 일시 중지되어 있어요.');
  if (usage.reason === 'monthly') throw new HttpsError('resource-exhausted', '이번 달 AI 이용 한도에 도달했어요.');
  throw new HttpsError('resource-exhausted', `오늘 ${label}은 하루 ${usage.dailyLimit}번까지 가능해요.`);
}

function judgeSystem(characters) {
  const descriptions = characters
    .map(character => `【${character.name} / id:${character.id}】\n${character.role_judge}`)
    .join('\n\n');
  const shape = characters
    .map(character => `{"id":"${character.id}","verdict":"상황을 직접 언급한 캐릭터 판결"}`)
    .join(',');
  return `당신은 소소킹의 AI 캐릭터 판사단이다.\n각 판사는 사용자의 상황 속 인물과 행동을 직접 언급하고 자기 말투로 독립적인 판결을 한다.\n실제 법률 자문이나 사실 확정처럼 표현하지 않고 재미와 참고 목적임을 지킨다.\n\n${descriptions}\n\n반드시 아래 JSON만 출력한다.\n{"verdicts":[${shape}]}`;
}

function translateSystem(character) {
  return `당신은 ${character.name} 캐릭터로 문장을 바꾸는 AI다.\n\n${character.role_translate}\n\n원문의 핵심 의미는 유지한다. 결과 문장만 출력하고 설명이나 제목은 붙이지 마라.`;
}

function namingSystem(character) {
  return `당신은 ${character.name} 캐릭터로 대상에 찰떡같은 이름을 붙이는 AI다.\n\n${character.role_name}\n\n서로 겹치지 않는 이름 5개를 만들고 반드시 아래 JSON만 출력하라.\n{"names":[{"name":"이름","reason":"이유"}]}`;
}

function consultSystem(characters) {
  const descriptions = characters
    .map(character => `【${character.name} / id:${character.id}】\n${character.role_consult}`)
    .join('\n\n');
  const shape = characters
    .map(character => `{"charId":"${character.id}","advice":"구체적인 조언"}`)
    .join(',');

  return `당신은 서로 성격이 완전히 다른 캐릭터 상담단이다.\n사용자의 구체적인 상황과 감정을 직접 언급하고, 뻔한 위로 대신 각 캐릭터다운 조언을 한다.\n\n${descriptions}\n\n반드시 아래 JSON만 출력하라.\n{"advices":[${shape}]}`;
}

const aiJudge = onCall({
  region: REGION,
  timeoutSeconds: 60,
  memory: '512MiB',
  secrets: AI_RUNTIME_SECRETS,
}, async request => {
  const uid = requireUser(request);
  const situation = cleanText(request.data?.situation, 500);
  const characters = getCharacters(request.data?.characterIds, 3);
  if (situation.length < 5) throw new HttpsError('invalid-argument', '상황을 5자 이상 적어주세요.');

  const usage = await consumeUsage(uid, 'judge');
  assertUsageAllowed(usage, '판결');

  try {
    const { parsed } = await callAndParse(
      maxTokens => callAI(
        judgeSystem(characters),
        `다음 상황을 판결하라:\n\n${situation}`,
        maxTokens,
        0.95,
        true,
      ),
      2400,
    );
    const byId = new Map((Array.isArray(parsed.verdicts) ? parsed.verdicts : [])
      .map(item => [cleanText(item?.id, 40), cleanText(item?.verdict, 1500)]));
    const verdicts = characters.map(character => ({
      charId: character.id,
      charName: character.name,
      verdict: byId.get(character.id) || character.fallback_judge || '잠시 후 다시 시도해주세요.',
    }));
    return { ok: true, postId: null, privateResult: true, verdicts };
  } catch (error) {
    await refundUsage(uid, 'judge', usage);
    if (error instanceof HttpsError) throw error;
    console.error('[aiJudge]', error);
    throw new HttpsError('internal', 'AI 판결에 실패했어요. 사용 횟수는 복구했습니다.');
  }
});

const aiTranslateV2 = onCall({
  region: REGION,
  timeoutSeconds: 60,
  memory: '512MiB',
  secrets: AI_RUNTIME_SECRETS,
}, async request => {
  const uid = requireUser(request);
  const text = cleanText(request.data?.text, 1200);
  const character = getCharacter(request.data?.characterId);
  if (text.length < 2) throw new HttpsError('invalid-argument', '바꿀 문장을 2자 이상 입력해주세요.');

  const usage = await consumeUsage(uid, 'translate');
  assertUsageAllowed(usage, '말투 변환');

  try {
    const result = await callAI(
      translateSystem(character),
      `다음 문장을 캐릭터 말투로 바꿔라:\n\n${text}`,
      900,
      0.9,
      false,
    );
    return {
      ok: true,
      characterId: character.id,
      characterName: character.name,
      result: cleanText(result, 3000),
    };
  } catch (error) {
    await refundUsage(uid, 'translate', usage);
    if (error instanceof HttpsError) throw error;
    console.error('[aiTranslateV2]', error);
    throw new HttpsError('internal', '캐릭터 번역에 실패했어요. 사용 횟수는 복구했습니다.');
  }
});

const aiNameV2 = onCall({
  region: REGION,
  timeoutSeconds: 60,
  memory: '512MiB',
  secrets: AI_RUNTIME_SECRETS,
}, async request => {
  const uid = requireUser(request);
  const subject = cleanText(request.data?.subject, 800);
  const character = getCharacter(request.data?.characterId);
  if (subject.length < 2) throw new HttpsError('invalid-argument', '이름을 지을 대상을 2자 이상 설명해주세요.');

  const usage = await consumeUsage(uid, 'name');
  assertUsageAllowed(usage, '작명');

  try {
    const { parsed } = await callAndParse(
      maxTokens => callAI(
        namingSystem(character),
        `다음 대상의 특징을 살린 이름을 지어라:\n\n${subject}`,
        maxTokens,
        0.95,
        true,
      ),
      1500,
    );
    const names = (Array.isArray(parsed.names) ? parsed.names : [])
      .slice(0, 5)
      .map(item => ({
        name: cleanText(item?.name, 80),
        reason: cleanText(item?.reason, 500),
      }))
      .filter(item => item.name);
    if (!names.length) throw new Error('empty names');
    return { ok: true, characterId: character.id, characterName: character.name, names };
  } catch (error) {
    await refundUsage(uid, 'name', usage);
    if (error instanceof HttpsError) throw error;
    console.error('[aiNameV2]', error);
    throw new HttpsError('internal', '작명에 실패했어요. 사용 횟수는 복구했습니다.');
  }
});

const aiConsultV2 = onCall({
  region: REGION,
  timeoutSeconds: 60,
  memory: '512MiB',
  secrets: AI_RUNTIME_SECRETS,
}, async request => {
  const uid = requireUser(request);
  const concern = cleanText(request.data?.concern, 1400);
  const characters = getCharacters(request.data?.characterIds, 3);
  if (concern.length < 5) throw new HttpsError('invalid-argument', '고민이나 상황을 5자 이상 적어주세요.');

  const usage = await consumeUsage(uid, 'consult');
  assertUsageAllowed(usage, '상담');

  try {
    const { parsed } = await callAndParse(
      maxTokens => callAI(
        consultSystem(characters),
        `다음 고민에 답하라:\n\n${concern}`,
        maxTokens,
        0.9,
        true,
      ),
      2200,
    );
    const byId = new Map((Array.isArray(parsed.advices) ? parsed.advices : [])
      .map(item => [String(item?.charId || ''), cleanText(item?.advice, 1200)]));
    const advices = characters.map(character => ({
      charId: character.id,
      charName: character.name,
      advice: byId.get(character.id) || '잠시 후 다시 이야기해 주세요.',
    }));
    return { ok: true, advices };
  } catch (error) {
    await refundUsage(uid, 'consult', usage);
    if (error instanceof HttpsError) throw error;
    console.error('[aiConsultV2]', error);
    throw new HttpsError('internal', '캐릭터 상담에 실패했어요. 사용 횟수는 복구했습니다.');
  }
});

const getKingPlaygroundUsage = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const config = await readRuntimeConfig();
  const dailyLimit = Number(config.dailyFreeLimit || DEFAULT_DAILY_LIMIT);
  const monthlyCap = Math.max(0, Number(config.monthlyCap || 0));
  const uid = request.auth?.uid;
  if (!uid) return { ok: true, enabled: config.enabled, dailyLimit, monthlyCap, monthlyUsed: 0, usage: {} };

  const date = todayKst();
  const features = ['judge', 'translate', 'name', 'consult'];
  const [monthlySnap, ...snapshots] = await Promise.all([
    db.doc(`ai_king_usage/${uid}_${monthKst()}_monthly`).get(),
    ...features.map(feature => db.doc(`ai_king_usage/${uid}_${date}_${feature}`).get()),
  ]);
  const usage = Object.fromEntries(features.map((feature, index) => [
    feature,
    Number(snapshots[index].exists ? snapshots[index].data()?.count || 0 : 0),
  ]));
  return {
    ok: true,
    enabled: config.enabled,
    dailyLimit,
    monthlyCap,
    monthlyUsed: Number(monthlySnap.exists ? monthlySnap.data()?.count || 0 : 0),
    usage,
  };
});

module.exports = {
  aiJudge,
  aiTranslateV2,
  aiNameV2,
  aiConsultV2,
  getKingPlaygroundUsage,
  getAiKingUsage: getKingPlaygroundUsage,
  CHARACTER_IDS: CHAR_LIST.map(item => item.id),
  _test: { todayKst, monthKst, assertUsageAllowed },
};
