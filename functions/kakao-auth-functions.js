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

function exchangeKakaoCode(code, redirectUri) {
  return new Promise((resolve, reject) => {
    const body = [
      'grant_type=authorization_code',
      `client_id=${encodeURIComponent(KAKAO_JS_APP_KEY)}`,
      `redirect_uri=${encodeURIComponent(redirectUri)}`,
      `code=${encodeURIComponent(code)}`,
    ].join('&');
    const req = https.request({
      hostname: 'kauth.kakao.com',
      path: '/oauth/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.access_token) resolve(json.access_token);
          else reject(new Error('Kakao token exchange failed: ' + data));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function fetchKakaoUser(accessToken) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'kapi.kakao.com',
        path: '/v2/user/me',
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.id) resolve(data);
            else reject(new Error('Kakao API error: ' + body));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

exports.kakaoLogin = onCall({ region: 'asia-northeast3' }, async (request) => {
  let { accessToken, code, redirectUri } = request.data || {};

  if (!accessToken && code) {
    if (!redirectUri || typeof redirectUri !== 'string') {
      throw new HttpsError('invalid-argument', 'redirectUri가 필요해요');
    }
    try {
      accessToken = await exchangeKakaoCode(code, redirectUri);
    } catch (e) {
      console.error('[kakaoLogin] code exchange error:', e.message);
      throw new HttpsError('unauthenticated', '카카오 인증 코드 교환 실패: ' + e.message);
    }
  }

  if (!accessToken || typeof accessToken !== 'string' || accessToken.length < 10) {
    throw new HttpsError('invalid-argument', '카카오 액세스 토큰 또는 인증 코드가 필요해요');
  }

  let kakaoUser;
  try {
    kakaoUser = await fetchKakaoUser(accessToken);
  } catch (e) {
    console.error('[kakaoLogin] Kakao API error:', e.message);
    throw new HttpsError('unauthenticated', '카카오 인증에 실패했어요. 다시 시도해주세요.');
  }

  const kakaoId = String(kakaoUser.id);
  const uid = `kakao_${kakaoId}`;

  const kakaoAccount = kakaoUser.kakao_account || {};
  const profile = kakaoAccount.profile || {};
  const displayName = profile.nickname || `카카오${kakaoId.slice(-4)}`;
  const photoURL = profile.profile_image_url || null;
  const email = kakaoAccount.email || null;

  let customToken;
  try {
    customToken = await adminAuth.createCustomToken(uid, {
      provider: 'kakao',
      kakaoId,
    });
  } catch (e) {
    console.error('[kakaoLogin] createCustomToken error:', e.message);
    throw new HttpsError('internal', '로그인 처리에 실패했어요');
  }

  try {
    await db.doc(`users/${uid}`).set(
      {
        displayName,
        photoURL,
        ...(email ? { email } : {}),
        provider: 'kakao',
        kakaoId,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e) {
    console.warn('[kakaoLogin] Firestore update error (non-fatal):', e.message);
  }

  return { customToken, displayName, photoURL };
});
