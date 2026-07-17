const crypto = require('node:crypto');
const { HttpsError } = require('firebase-functions/v2/https');

const DOCUMENT_ID_RE = /^[A-Za-z0-9_-]{1,180}$/;
const PHONE_RE = /(?:^|\D)(?:01[016789]|0\d{1,2})[-.\s]?\d{3,4}[-.\s]?\d{4}(?:$|\D)/;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const RRN_RE = /(?:^|\D)\d{6}[-\s]?\d{7}(?:$|\D)/;
const ACCOUNT_RE = /(?:계좌번호|은행계좌|입금계좌|카드번호|카톡아이디|카카오톡\s*ID|텔레그램\s*ID|인스타그램\s*ID)/i;
const ADDRESS_RE = /(?:서울|부산|대구|인천|광주|대전|울산|세종|제주|경기|강원|충북|충남|전북|전남|경북|경남|[가-힣]{2,}(?:시|군|구))\s+[가-힣0-9]{1,20}(?:읍|면|동|리|로|길)(?:\s*\d{1,4}(?:-\d{1,4})?)?/;
const NAMED_PLACE_RE = /[가-힣A-Za-z0-9]{2,30}(?:초등학교|중학교|고등학교|대학교|유치원|학원|병원|아파트)/;
const EXPLICIT_NAME_RE = /(?:실명|본명|이름|담임|선생님|학생|직원|상사|동료|사장님)\s*(?:은|는|이|가|:)?\s*[가-힣]{2,4}/;

function cleanText(value, maxLength = 5000) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function requireVerifiedUser(request, message = '로그인 후 이용할 수 있습니다.') {
  if (!request?.auth?.uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const provider = request.auth.token?.firebase?.sign_in_provider || '';
  if (provider === 'anonymous') throw new HttpsError('unauthenticated', message);
  if (provider === 'password' && request.auth.token?.email_verified !== true) {
    throw new HttpsError('failed-precondition', '이메일 인증을 완료한 뒤 이용해주세요.');
  }
  return request.auth.uid;
}

function validDocumentId(value, label = '문서 ID') {
  const id = String(value || '').trim();
  if (!DOCUMENT_ID_RE.test(id)) throw new HttpsError('invalid-argument', `${label} 형식이 올바르지 않습니다.`);
  return id;
}

function sensitiveContentReasons(value) {
  const text = cleanText(value, 12000);
  const reasons = [];
  if (PHONE_RE.test(text)) reasons.push('전화번호');
  if (EMAIL_RE.test(text)) reasons.push('이메일');
  if (RRN_RE.test(text)) reasons.push('주민등록번호');
  if (ACCOUNT_RE.test(text)) reasons.push('계좌·SNS 식별정보');
  if (ADDRESS_RE.test(text)) reasons.push('상세 주소');
  if (NAMED_PLACE_RE.test(text)) reasons.push('학교·병원·아파트 등 특정 장소');
  if (EXPLICIT_NAME_RE.test(text)) reasons.push('실명으로 보이는 정보');
  return [...new Set(reasons)];
}

function assertNoSensitiveContent(value, messagePrefix = '개인정보 또는 특정 가능한 정보') {
  const reasons = sensitiveContentReasons(value);
  if (reasons.length) {
    throw new HttpsError('failed-precondition', `${messagePrefix}(${reasons.join(', ')})가 포함되어 있습니다.`);
  }
}

function publicAuthorId(uid, scope = 'global') {
  const safeScope = cleanText(scope, 180) || 'global';
  return crypto
    .createHash('sha256')
    .update(`sosoking-public-author:${safeScope}:${uid}`)
    .digest('hex')
    .slice(0, 20);
}

function firebaseStorageObjectPath(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  let url;
  try {
    url = new URL(raw);
  } catch {
    return '';
  }
  if (url.protocol !== 'https:') return '';

  if (url.hostname === 'firebasestorage.googleapis.com') {
    const marker = '/o/';
    const index = url.pathname.indexOf(marker);
    if (index < 0) return '';
    try {
      return decodeURIComponent(url.pathname.slice(index + marker.length));
    } catch {
      return '';
    }
  }

  if (url.hostname === 'storage.googleapis.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    return parts.length >= 2 ? parts.slice(1).join('/') : '';
  }

  return '';
}

function validatedProfilePhotoUrl(value, uid) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const objectPath = firebaseStorageObjectPath(raw);
  const expectedPath = `profile-photos/${uid}/avatar.jpg`;
  if (objectPath !== expectedPath) {
    throw new HttpsError('invalid-argument', '프로필 사진은 본인 전용 Firebase Storage 경로만 사용할 수 있습니다.');
  }
  return raw.slice(0, 1000);
}

module.exports = {
  cleanText,
  requireVerifiedUser,
  validDocumentId,
  sensitiveContentReasons,
  assertNoSensitiveContent,
  publicAuthorId,
  validatedProfilePhotoUrl,
};