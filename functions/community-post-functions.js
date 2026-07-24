'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';
const PRESETS = new Set(['judgment', 'consult', 'vote', 'drip']);
const DRIP_REACTIONS = new Set(['like', 'funny', 'fire']);

function cleanId(value, max = 180) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, max);
}
function cleanText(value, max = 1000) {
  return String(value || '').replace(/[<>]/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim().slice(0, max);
}
function todayKST() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function requireRegisteredUser(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  if (request.auth?.token?.firebase?.sign_in_provider === 'anonymous') throw new HttpsError('permission-denied', '정식 회원 로그인 후 사용할 수 있습니다.');
  return uid;
}
async function reserveDailyQuota(uid, action, limit) {
  const day = todayKST();
  const ref = db.doc(`rate_limits/${action}_${day}_${cleanId(uid, 128)}`);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const count = Number(snap.exists ? snap.data()?.count || 0 : 0);
    if (count >= limit) throw new HttpsError('resource-exhausted', '오늘 이용 가능한 횟수를 초과했습니다.');
    tx.set(ref, { uid, action, day, count: FieldValue.increment(1), limit, updatedAt: FieldValue.serverTimestamp(), updatedAtMs: Date.now() }, { merge: true });
  });
}
function presetOf(value) {
  const preset = String(value || '').trim();
  if (!PRESETS.has(preset)) throw new HttpsError('invalid-argument', '지원하지 않는 커뮤니티 유형입니다.');
  return preset;
}
function cleanTags(value) {
  return (Array.isArray(value) ? value : []).map(tag => cleanText(tag, 20).replace(/^#/, '')).filter(Boolean).filter((tag, i, list) => list.indexOf(tag) === i).slice(0, 8);
}
function cleanImages(value) {
  return (Array.isArray(value) ? value : []).map(raw => {
    try {
      const url = new URL(String(raw || '').trim());
      if (url.protocol !== 'https:' || url.hostname !== 'firebasestorage.googleapis.com') return '';
      if (!url.pathname.includes('/b/sosoking-481e6.firebasestorage.app/o/')) return '';
      return url.toString().slice(0, 1200);
    } catch { return ''; }
  }).filter(Boolean).slice(0, 20);
}
async function userPayload(uid, token = {}) {
  const snap = await db.doc(`users/${uid}`).get().catch(() => null);
  const data = snap?.exists ? snap.data() || {} : {};
  return {
    authorId: uid,
    authorName: cleanText(data.nickname || data.displayName || token.name || token.email?.split('@')[0] || '회원', 40) || '회원',
    authorPhoto: cleanText(data.photoURL || token.picture || '', 500),
    authorEmail: cleanText(data.email || token.email || '', 180),
  };
}
function buildModules(preset, desc, input = {}) {
  const modules = { comments: { enabled: true } };
  if (preset === 'judgment') modules.vote = { enabled: true, voteMode: 'judgment', question: desc, options: ['글쓴이가 예민함', '상대가 선 넘음', '둘 다 문제 있음'].map(text => ({ text, votes: 0 })) };
  if (preset === 'vote') modules.vote = { enabled: true, voteMode: 'pros_cons', question: desc, options: ['찬성', '반대'].map(text => ({ text, votes: 0 })) };
  if (preset === 'consult') {
    const topic = ['daily', 'people', 'work', 'money', 'vent'].includes(input.topic) ? input.topic : 'daily';
    const style = ['empathy', 'realistic', 'choice', 'soft', 'funny'].includes(input.style) ? input.style : 'realistic';
    modules.consult = {
      enabled: true, topic, style, question: desc,
      topicLabel: ({ daily: '일상', people: '관계', work: '직장/학교', money: '소비/선택', vent: '하소연' })[topic],
      styleLabel: ({ empathy: '공감', realistic: '현실조언', choice: '선택도움', soft: '순한맛', funny: '웃긴해결' })[style],
    };
  }
  if (preset === 'drip') modules.drip = { enabled: true, prompt: desc, maxLength: 50, responseLabel: '한 줄 드립' };
  return modules;
}
function typeLabel(preset) { return ({ judgment: '판결', consult: '상담', vote: '토론', drip: '드립' })[preset]; }
function feedType(preset) { return preset === 'drip' ? 'drip' : preset === 'consult' ? 'consult' : 'vote'; }
function awardRef(uid, action, key) { return db.doc(`point_awards/${cleanId(`${uid}_${action}_${key}`, 900)}`); }
function addAwardWrites(tx, { uid, action, points, label, postId = '', itemId = '', key }) {
  const userRef = db.doc(`users/${uid}`);
  tx.create(awardRef(uid, action, key), { uid, action, points, postId, itemId, createdAt: FieldValue.serverTimestamp(), createdAtMs: Date.now() });
  tx.set(userRef, {
    points: FieldValue.increment(points), totalPoints: FieldValue.increment(points),
    [`pointStats.${action}`]: FieldValue.increment(points), [`pointDaily.${todayKST()}`]: FieldValue.increment(points),
    lastPointAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  tx.create(userRef.collection('point_logs').doc(), { action, label, points, meta: { postId, itemId }, createdAt: FieldValue.serverTimestamp(), createdAtMs: Date.now() });
}
function addNotification(tx, uid, data) {
  if (!uid || String(uid).startsWith('deleted_')) return;
  tx.create(db.collection('notifications').doc(), {
    uid, type: cleanText(data.type, 40), title: cleanText(data.title, 80), body: cleanText(data.body, 180),
    postId: cleanId(data.postId), itemId: cleanId(data.itemId), actorId: cleanId(data.actorId, 128), actorName: cleanText(data.actorName || '회원', 40),
    points: Number(data.points || 0), read: false, createdAt: FieldValue.serverTimestamp(), createdAtMs: Date.now(),
  });
}

const createCommunityPost = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const uid = requireRegisteredUser(request);
  await reserveDailyQuota(uid, 'community_post', 10);
  const input = request.data || {};
  const preset = presetOf(input.preset);
  const title = cleanText(input.title, 100);
  const desc = cleanText(input.desc, 2000) || title;
  if (!title) throw new HttpsError('invalid-argument', '제목을 입력해주세요.');
  if (preset === 'consult' && !cleanText(input.desc, 2000)) throw new HttpsError('invalid-argument', '상담 내용을 입력해주세요.');
  const user = await userPayload(uid, request.auth?.token || {});
  const ref = db.collection('feeds').doc();
  const post = {
    type: 'multi', cat: 'community', subtype: preset, feedType: feedType(preset), typeLabel: typeLabel(preset),
    title, desc, tags: cleanTags(input.tags), images: cleanImages(input.images), modules: buildModules(preset, desc, input),
    ...user, reactions: { total: 0, like: 0, funny: 0, fire: 0, skull: 0 }, commentCount: 0, viewCount: 0, pointsScore: 0,
    hidden: false, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  };
  await db.runTransaction(async tx => {
    const awardSnap = await tx.get(awardRef(uid, 'post_create', ref.id));
    if (awardSnap.exists) throw new HttpsError('already-exists', '이미 처리된 글입니다.');
    tx.create(ref, post);
    addAwardWrites(tx, { uid, action: 'post_create', points: 10, label: '커뮤니티 글 작성', postId: ref.id, key: ref.id });
  });
  return { ok: true, postId: ref.id, awarded: true, points: 10 };
});

const updateCommunityPost = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const uid = requireRegisteredUser(request);
  const postId = cleanId(request.data?.postId);
  if (!postId) throw new HttpsError('invalid-argument', '게시글 정보가 없습니다.');
  const ref = db.doc(`feeds/${postId}`);
  const [snap, adminSnap] = await Promise.all([ref.get(), db.doc(`admins/${uid}`).get().catch(() => null)]);
  if (!snap.exists) throw new HttpsError('not-found', '게시글을 찾을 수 없습니다.');
  const post = snap.data() || {};
  if (post.authorId !== uid && !adminSnap?.exists) throw new HttpsError('permission-denied', '작성자만 수정할 수 있습니다.');
  if (post.hidden === true) throw new HttpsError('failed-precondition', '숨김 처리된 글은 수정할 수 없습니다.');
  const title = cleanText(request.data?.title, 100);
  const desc = cleanText(request.data?.desc, 2000) || title;
  if (!title) throw new HttpsError('invalid-argument', '제목을 입력해주세요.');
  const patch = { title, desc, tags: cleanTags(request.data?.tags), images: cleanImages(request.data?.images), updatedAt: FieldValue.serverTimestamp() };
  const preset = presetOf(post.subtype || 'judgment');
  if (preset === 'judgment' || preset === 'vote') patch['modules.vote.question'] = desc;
  if (preset === 'consult') patch['modules.consult.question'] = desc;
  if (preset === 'drip') patch['modules.drip.prompt'] = desc;
  await ref.update(patch);
  return { ok: true, postId };
});

const castCommunityVote = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireRegisteredUser(request);
  const postId = cleanId(request.data?.postId);
  const optionIdx = Number(request.data?.optionIdx);
  if (!postId || !Number.isInteger(optionIdx) || optionIdx < 0 || optionIdx > 5) throw new HttpsError('invalid-argument', '투표 정보가 올바르지 않습니다.');
  const postRef = db.doc(`feeds/${postId}`);
  const voteRef = postRef.collection('votes').doc(uid);
  let updatedPost;
  await db.runTransaction(async tx => {
    const [postSnap, voteSnap] = await Promise.all([tx.get(postRef), tx.get(voteRef)]);
    if (!postSnap.exists) throw new HttpsError('not-found', '게시글을 찾을 수 없습니다.');
    const post = postSnap.data() || {};
    if (post.hidden === true || post.type !== 'multi' || post.modules?.vote?.enabled !== true) throw new HttpsError('failed-precondition', '투표할 수 없는 게시글입니다.');
    if (voteSnap.exists) throw new HttpsError('already-exists', '이미 투표했습니다.');
    const options = (Array.isArray(post.modules.vote.options) ? post.modules.vote.options : []).map(option => ({ ...option }));
    if (!options[optionIdx]) throw new HttpsError('invalid-argument', '선택지를 찾을 수 없습니다.');
    options[optionIdx].votes = Number(options[optionIdx].votes || 0) + 1;
    const vote = { ...post.modules.vote, options };
    tx.update(postRef, { 'modules.vote': vote, updatedAt: FieldValue.serverTimestamp() });
    tx.create(voteRef, { uid, optionIdx, createdAt: FieldValue.serverTimestamp(), createdAtMs: Date.now() });
    updatedPost = { ...post, id: postId, modules: { ...(post.modules || {}), vote } };
  });
  return { ok: true, post: updatedPost };
});

async function loadDrip(postId) {
  const id = cleanId(postId);
  if (!id) throw new HttpsError('invalid-argument', '게시글 정보가 없습니다.');
  const ref = db.doc(`feeds/${id}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', '게시글을 찾을 수 없습니다.');
  const post = snap.data() || {};
  if (post.hidden === true || post.type !== 'multi' || post.modules?.drip?.enabled !== true) throw new HttpsError('failed-precondition', '드립 참여가 가능한 게시글이 아닙니다.');
  return { ref, postId: id };
}

const addDripParticipation = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireRegisteredUser(request);
  await reserveDailyQuota(uid, 'drip_participation', 40);
  const { ref: postRef, postId } = await loadDrip(request.data?.postId);
  const text = cleanText(request.data?.text, 50);
  if (!text) throw new HttpsError('invalid-argument', '드립 내용을 입력해주세요.');
  const user = await userPayload(uid, request.auth?.token || {});
  const itemRef = postRef.collection('multi_drip').doc();
  await db.runTransaction(async tx => {
    const awardSnap = await tx.get(awardRef(uid, 'participation_create', itemRef.id));
    if (awardSnap.exists) throw new HttpsError('already-exists', '이미 처리된 참여입니다.');
    tx.create(itemRef, { text, ...user, reactions: { like: 0, funny: 0, fire: 0 }, replyCount: 0, createdAt: FieldValue.serverTimestamp(), createdAtMs: Date.now() });
    addAwardWrites(tx, { uid, action: 'participation_create', points: 3, label: '드립 참여', postId, itemId: itemRef.id, key: itemRef.id });
  });
  return { ok: true, itemId: itemRef.id, awarded: true, points: 3 };
});

const addDripReply = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireRegisteredUser(request);
  const { ref: postRef, postId } = await loadDrip(request.data?.postId);
  const itemId = cleanId(request.data?.itemId);
  const text = cleanText(request.data?.text, 500);
  if (!itemId || !text) throw new HttpsError('invalid-argument', '답글 정보가 올바르지 않습니다.');
  const itemRef = postRef.collection('multi_drip').doc(itemId);
  const replyRef = itemRef.collection('replies').doc();
  const user = await userPayload(uid, request.auth?.token || {});
  await db.runTransaction(async tx => {
    const [itemSnap, awardSnap] = await Promise.all([tx.get(itemRef), tx.get(awardRef(uid, 'reply_create', replyRef.id))]);
    if (!itemSnap.exists) throw new HttpsError('not-found', '드립을 찾을 수 없습니다.');
    if (awardSnap.exists) throw new HttpsError('already-exists', '이미 처리된 답글입니다.');
    const item = itemSnap.data() || {};
    tx.create(replyRef, { text, ...user, createdAt: FieldValue.serverTimestamp(), createdAtMs: Date.now() });
    tx.update(itemRef, { replyCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
    addAwardWrites(tx, { uid, action: 'reply_create', points: 2, label: '드립 답글 작성', postId, itemId, key: replyRef.id });
    if (item.authorId && item.authorId !== uid) addNotification(tx, item.authorId, { type: 'drip_reply', title: '내 드립에 답글이 달렸어요', body: `${user.authorName}: ${text.slice(0, 50)}`, postId, itemId, actorId: uid, actorName: user.authorName });
  });
  return { ok: true, awarded: true, points: 2 };
});

const reactDripItem = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireRegisteredUser(request);
  const { postId } = await loadDrip(request.data?.postId);
  const itemId = cleanId(request.data?.itemId);
  const reaction = String(request.data?.reaction || '').trim();
  if (!itemId || !DRIP_REACTIONS.has(reaction)) throw new HttpsError('invalid-argument', '반응 정보가 올바르지 않습니다.');
  const itemRef = db.doc(`feeds/${postId}/multi_drip/${itemId}`);
  const markerRef = itemRef.collection('reactions_by_user').doc(uid);
  let added = false;
  let awarded = false;
  await db.runTransaction(async tx => {
    const [itemSnap, markerSnap] = await Promise.all([tx.get(itemRef), tx.get(markerRef)]);
    if (!itemSnap.exists) throw new HttpsError('not-found', '드립을 찾을 수 없습니다.');
    const item = itemSnap.data() || {};
    if (item.authorId === uid) throw new HttpsError('failed-precondition', '본인 글에는 반응할 수 없습니다.');
    if (markerSnap.exists) return;
    let awardSnap = null;
    const key = `${itemId}_${uid}`;
    if (item.authorId) awardSnap = await tx.get(awardRef(item.authorId, 'reaction_received', key));
    added = true;
    tx.create(markerRef, { uid, reaction, createdAt: FieldValue.serverTimestamp(), createdAtMs: Date.now() });
    tx.update(itemRef, { [`reactions.${reaction}`]: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
    if (item.authorId && !awardSnap?.exists) {
      awarded = true;
      addAwardWrites(tx, { uid: item.authorId, action: 'reaction_received', points: 1, label: '드립 반응 받음', postId, itemId, key });
    }
    if (item.authorId) addNotification(tx, item.authorId, { type: 'drip_reaction', title: '내 드립에 반응이 달렸어요', body: '새 반응이 등록됐어요.', postId, itemId, actorId: uid, actorName: '회원', points: awarded ? 1 : 0 });
  });
  return { ok: true, reactionAdded: added, awarded, points: awarded ? 1 : 0 };
});

module.exports = { createCommunityPost, updateCommunityPost, castCommunityVote, addDripParticipation, addDripReply, reactDripItem };
