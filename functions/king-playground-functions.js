'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { sharedAi } = require('./ai-king-functions');
const { AI_RUNTIME_SECRETS, callAI, callAndParse } = require('./ai-runtime-provider');

if (!getApps().length) initializeApp();

const db = getFirestore();
const REGION = 'asia-northeast3';
const DAILY_LIMIT = 3;
const { CHARACTERS, CHAR_LIST } = sharedAi;

function todayKst() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
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
  const date = todayKst();
  const usageRef = db.doc(`ai_king_usage/${uid}_${date}_${feature}`);
  const userRef = db.doc(`users/${uid}`);

  return db.runTransaction(async transaction => {
    const [usageSnap, userSnap] = await Promise.all([
      transaction.get(usageRef),
      transaction.get(userRef),
    ]);
    const count = Number(usageSnap.exists ? usageSnap.data()?.count || 0 : 0);

    if (count < DAILY_LIMIT) {
      transaction.set(usageRef, {
        userId: uid,
        feature,
        date,
        count: count + 1,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return { allowed: true, usedExtra: false, limit: DAILY_LIMIT };
    }

    const extra = Number(userSnap.exists ? userSnap.data()?.extraAiUses || 0 : 0);
    if (extra > 0) {
      transaction.set(userRef, {
        extraAiUses: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return { allowed: true, usedExtra: true, limit: DAILY_LIMIT };
    }

    return { allowed: false, usedExtra: false, limit: DAILY_LIMIT };
  });
}

async function refundUsage(uid, feature, usedExtra) {
  try {
    if (usedExtra) {
      await db.doc(`users/${uid}`).set({
        extraAiUses: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return;
    }

    const usageRef = db.doc(`ai_king_usage/${uid}_${todayKst()}_${feature}`);
    await db.runTransaction(async transaction => {
      const snap = await transaction.get(usageRef);
      const count = Number(snap.exists ? snap.data()?.count || 0 : 0);
      if (count > 0) {
        transaction.set(usageRef, {
          count: count - 1,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    });
  } catch (error) {
    console.error('[king-playground] usage refund failed:', error.message);
  }
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
  if (!usage.allowed) throw new HttpsError('resource-exhausted', `오늘 번역은 하루 ${usage.limit}번까지 가능해요.`);

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
    await refundUsage(uid, 'translate', usage.usedExtra);
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
  if (!usage.allowed) throw new HttpsError('resource-exhausted', `오늘 작명은 하루 ${usage.limit}번까지 가능해요.`);

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
    await refundUsage(uid, 'name', usage.usedExtra);
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
  if (!usage.allowed) throw new HttpsError('resource-exhausted', `오늘 상담은 하루 ${usage.limit}번까지 가능해요.`);

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
    await refundUsage(uid, 'consult', usage.usedExtra);
    if (error instanceof HttpsError) throw error;
    console.error('[aiConsultV2]', error);
    throw new HttpsError('internal', '캐릭터 상담에 실패했어요. 사용 횟수는 복구했습니다.');
  }
});

const getKingPlaygroundUsage = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = request.auth?.uid;
  if (!uid) return { ok: true, dailyLimit: DAILY_LIMIT, usage: {} };
  const date = todayKst();
  const features = ['judge', 'translate', 'name', 'consult'];
  const snapshots = await Promise.all(features.map(feature => db.doc(`ai_king_usage/${uid}_${date}_${feature}`).get()));
  const usage = Object.fromEntries(features.map((feature, index) => [
    feature,
    Number(snapshots[index].exists ? snapshots[index].data()?.count || 0 : 0),
  ]));
  return { ok: true, dailyLimit: DAILY_LIMIT, usage };
});

module.exports = {
  aiTranslateV2,
  aiNameV2,
  aiConsultV2,
  getKingPlaygroundUsage,
  CHARACTER_IDS: CHAR_LIST.map(item => item.id),
};
