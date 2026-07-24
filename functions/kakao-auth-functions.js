'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const https = require('https');

if (!getApps().length) initializeApp();
const auth = getAuth();
const db = getFirestore();
const REGION = 'asia-northeast3';
const KAKAO_APP_KEY = '377995fee0850a5de4167641d343be0e';
const REDIRECTS = new Set(['https://sosoking.co.kr', 'https://www.sosoking.co.kr']);

function requestJson(options, body = '') {
  return new Promise((resolve, reject) => {
    const req = https.request(options, response => {
      let data = '';
      response.on('data', chunk => { data += chunk; });
      response.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (response.statusCode >= 200 && response.statusCode < 300) resolve(json);
          else reject(new Error(`Kakao API ${response.statusCode}`));
        } catch (error) { reject(error); }
      });
    });
    req.setTimeout(10000, () => req.destroy(new Error('Kakao API timeout')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function cleanNickname(value) {
  return String(value || '').replace(/[^가-힣a-zA-Z0-9_]/g, '').slice(0, 12);
}

function candidate(base, attempt) {
  if (attempt === 0) return cleanNickname(base) || '카카오회원';
  const suffix = String(1000 + Math.floor(Math.random() * 9000));
  return cleanNickname((cleanNickname(base) || '카카오회원').slice(0, 12 - suffix.length) + suffix);
}

async function exchangeCode(code, redirectUri) {
  const redirect = String(redirectUri || '').trim().replace(/\/$/, '');
  if (!REDIRECTS.has(redirect)) throw new HttpsError('invalid-argument', '허용되지 않은 로그인 주소입니다.');
  const body = new URLSearchParams({ grant_type: 'authorization_code', client_id: KAKAO_APP_KEY, redirect_uri: redirect, code }).toString();
  const result = await requestJson({
    hostname: 'kauth.kakao.com', path: '/oauth/token', method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8', 'Content-Length': Buffer.byteLength(body) },
  }, body);
  if (!result.access_token) throw new HttpsError('unauthenticated', '카카오 인증 코드 교환에 실패했습니다.');
  return result.access_token;
}

async function fetchKakaoUser(accessToken) {
  const result = await requestJson({
    hostname: 'kapi.kakao.com', path: '/v2/user/me', method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!result.id) throw new HttpsError('unauthenticated', '카카오 사용자 정보를 확인하지 못했습니다.');
  return result;
}

async function saveProfile(uid, profile) {
  const userRef = db.doc(`users/${uid}`);
  const existing = await userRef.get();
  if (existing.exists && existing.data()?.nickname) {
    await userRef.set({
      displayName: profile.displayName,
      photoURL: profile.photoURL,
      ...(profile.email ? { email: profile.email } : {}),
      provider: 'kakao', kakaoId: profile.kakaoId,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return existing.data().nickname;
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const nickname = candidate(profile.displayName, attempt);
    try {
      await db.runTransaction(async tx => {
        const nicknameRef = db.doc(`nicknames/${nickname}`);
        const [userSnap, nicknameSnap] = await Promise.all([tx.get(userRef), tx.get(nicknameRef)]);
        if (nicknameSnap.exists && nicknameSnap.data()?.uid !== uid) throw new HttpsError('already-exists', '닉네임 중복');
        tx.set(nicknameRef, { uid, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        tx.set(userRef, {
          nickname,
          displayName: profile.displayName,
          photoURL: profile.photoURL,
          ...(profile.email ? { email: profile.email } : {}),
          provider: 'kakao', kakaoId: profile.kakaoId,
          updatedAt: FieldValue.serverTimestamp(),
          ...(userSnap.exists ? {} : { createdAt: FieldValue.serverTimestamp(), points: 0, totalPoints: 0, postCount: 0 }),
        }, { merge: true });
      });
      return nickname;
    } catch (error) {
      if (String(error.code || '').includes('already-exists')) continue;
      throw error;
    }
  }
  throw new HttpsError('resource-exhausted', '사용 가능한 닉네임을 만들지 못했습니다.');
}

const kakaoLogin = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  let accessToken = String(request.data?.accessToken || '');
  if (!accessToken && request.data?.code) accessToken = await exchangeCode(String(request.data.code), request.data.redirectUri);
  if (accessToken.length < 10) throw new HttpsError('invalid-argument', '카카오 인증 정보가 필요합니다.');

  let user;
  try {
    user = await fetchKakaoUser(accessToken);
  } catch (error) {
    console.error('[kakaoLogin]', error);
    throw error instanceof HttpsError ? error : new HttpsError('unauthenticated', '카카오 인증에 실패했습니다.');
  }

  const kakaoId = String(user.id);
  const uid = `kakao_${kakaoId}`;
  const account = user.kakao_account || {};
  const profile = account.profile || {};
  const displayName = String(profile.nickname || `카카오${kakaoId.slice(-4)}`).slice(0, 80);
  const photoURL = String(profile.profile_image_url || '').slice(0, 500);
  const email = String(account.email || '').slice(0, 180);
  const nickname = await saveProfile(uid, { kakaoId, displayName, photoURL, email });
  const customToken = await auth.createCustomToken(uid, { provider: 'kakao', kakaoId });
  return { customToken, displayName, photoURL, nickname };
});

module.exports = { kakaoLogin };
