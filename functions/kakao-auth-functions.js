'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const https = require('https');

if (!getApps().length) initializeApp();
const adminAuth = getAuth();
const db = getFirestore();

const KAKAO_JS_APP_KEY = '377995fee0850a5de4167641d343be0e';
const ALLOWED_REDIRECT_URIS = new Set([
  'https://sosoking.co.kr',
  'https://sosoking.co.kr/',
]);
const HTTP_TIMEOUT_MS = 10000;

function normalizeRedirectUri(value) {
  const redirectUri = String(value || '').trim();
  if (!ALLOWED_REDIRECT_URIS.has(redirectUri)) {
    throw new HttpsError('invalid-argument', '허용되지 않은 카카오 redirectUri입니다.');
  }
  return redirectUri;
}

function normalizeAuthorizationCode(value) {
  const code = String(value || '').trim();
  if (!code || code.length > 2048 || /[\r\n]/.test(code)) {
    throw new HttpsError('invalid-argument', '카카오 인증 코드가 올바르지 않습니다.');
  }
  return code;
}

function requestJson(options, body = '') {
  return new Promise((resolve, reject) => {
    const request = https.request(options, response => {
      let data = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        data += chunk;
        if (data.length > 1024 * 1024) request.destroy(new Error('response-too-large'));
      });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`upstream-status-${response.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error('invalid-upstream-json'));
        }
      });
    });
    request.setTimeout(HTTP_TIMEOUT_MS, () => request.destroy(new Error('upstream-timeout')));
    request.on('error', reject);
    if (body) request.write(body);
    request.end();
  });
}

async function exchangeKakaoCode(code, redirectUri) {
  const safeRedirectUri = normalizeRedirectUri(redirectUri);
  const safeCode = normalizeAuthorizationCode(code);
  const body = [
    'grant_type=authorization_code',
    `client_id=${encodeURIComponent(KAKAO_JS_APP_KEY)}`,
    `redirect_uri=${encodeURIComponent(safeRedirectUri)}`,
    `code=${encodeURIComponent(safeCode)}`,
  ].join('&');
  const data = await requestJson({
    hostname: 'kauth.kakao.com',
    path: '/oauth/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);
  const accessToken = String(data.access_token || '').trim();
  if (accessToken.length < 10) throw new Error('missing-access-token');
  return accessToken;
}

async function fetchKakaoUser(accessToken) {
  const data = await requestJson({
    hostname: 'kapi.kakao.com',
    path: '/v2/user/me',
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
  });
  if (!data.id) throw new Error('missing-kakao-user-id');
  return data;
}

async function provisionKakaoProfile(uid, profileData) {
  const userRef = db.doc(`users/${uid}`);
  await db.runTransaction(async transaction => {
    const userSnap = await transaction.get(userRef);
    const existing = userSnap.exists ? userSnap.data() || {} : {};
    let nickname = existing.nickname || null;

    if (!nickname) {
      const base = String(profileData.displayName || '')
        .replace(/[^가-힣a-zA-Z0-9_]/g, '')
        .slice(0, 12);
      const candidates = [];
      if (base.length >= 2) candidates.push(base);
      const suffixBase = (base || '카카오').slice(0, 8);
      for (let index = 0; index < 5; index += 1) {
        candidates.push(`${suffixBase}${String(profileData.kakaoId).slice(-4)}${index || ''}`.slice(0, 12));
      }

      for (const candidate of [...new Set(candidates)]) {
        if (candidate.length < 2) continue;
        const nicknameRef = db.doc(`nicknames/${candidate}`);
        const nicknameSnap = await transaction.get(nicknameRef);
        if (!nicknameSnap.exists || nicknameSnap.data()?.uid === uid) {
          nickname = candidate;
          transaction.set(nicknameRef, {
            uid,
            userId: uid,
            createdAt: nicknameSnap.exists ? nicknameSnap.data()?.createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
          break;
        }
      }
    }

    transaction.set(userRef, {
      displayName: profileData.displayName,
      photoURL: profileData.photoURL,
      ...(profileData.email ? { email: profileData.email } : {}),
      ...(nickname ? { nickname } : {}),
      provider: 'kakao',
      kakaoId: profileData.kakaoId,
      createdAt: userSnap.exists ? existing.createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

exports.kakaoLogin = onCall({
  region: 'asia-northeast3',
  timeoutSeconds: 30,
  memory: '256MiB',
}, async request => {
  const code = normalizeAuthorizationCode(request.data?.code);
  const redirectUri = normalizeRedirectUri(request.data?.redirectUri);

  let accessToken;
  try {
    accessToken = await exchangeKakaoCode(code, redirectUri);
  } catch (error) {
    console.error('[kakaoLogin] code exchange error:', error.message);
    throw new HttpsError('unauthenticated', '카카오 인증 코드 교환에 실패했습니다. 다시 시도해주세요.');
  }

  let kakaoUser;
  try {
    kakaoUser = await fetchKakaoUser(accessToken);
  } catch (error) {
    console.error('[kakaoLogin] user API error:', error.message);
    throw new HttpsError('unauthenticated', '카카오 사용자 인증에 실패했습니다. 다시 시도해주세요.');
  }

  const kakaoId = String(kakaoUser.id);
  const uid = `kakao_${kakaoId}`;
  const kakaoAccount = kakaoUser.kakao_account || {};
  const profile = kakaoAccount.profile || {};
  const displayName = String(profile.nickname || `카카오${kakaoId.slice(-4)}`).slice(0, 50);
  const photoURL = profile.profile_image_url ? String(profile.profile_image_url).slice(0, 500) : null;
  const email = kakaoAccount.email ? String(kakaoAccount.email).slice(0, 200) : null;

  try {
    await provisionKakaoProfile(uid, { kakaoId, displayName, photoURL, email });
  } catch (error) {
    console.error('[kakaoLogin] profile provisioning error:', error.message);
    throw new HttpsError('internal', '카카오 계정 정보를 준비하지 못했습니다. 잠시 후 다시 시도해주세요.');
  }

  try {
    const customToken = await adminAuth.createCustomToken(uid, {
      provider: 'kakao',
      kakaoId,
    });
    return { customToken, displayName, photoURL };
  } catch (error) {
    console.error('[kakaoLogin] custom token error:', error.message, error.code);
    throw new HttpsError('internal', '로그인 토큰을 발급하지 못했습니다. 잠시 후 다시 시도해주세요.');
  }
});

module.exports._test = {
  normalizeRedirectUri,
  normalizeAuthorizationCode,
};
