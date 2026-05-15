import { auth, db, storage, functions } from '../firebase.js';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { getDownloadURL, ref, uploadBytesResumable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-storage.js';

export const FALLBACK_FEED_ITEMS = [];

const BADGE_BY_TYPE = {
  '사진/짤':'📸',
  '짧은 글':'✍️',
  '질문':'❓',
  '사진 제목학원':'📸',
  '미친작명소':'📸',
  '댓글 배틀':'🔥',
  '웃참 챌린지':'🤣',
  '밸런스게임':'⚖️',
  '민심 투표':'🗳️',
  '선택지 배틀':'🥊',
  '소소토론':'💬',
  '생각 갈림':'🤔',
  '소소한 논쟁':'🤔',
  '생활 매너':'🍽️',
  '퀴즈':'🧠',
  '정답 퀴즈':'✅',
  '센스 퀴즈':'🧩',
  '심리 테스트':'🔮',
  'AI놀이':'🤖',
  'AI 역할극':'🎙️',
  '상상 이어쓰기':'🧩',
  '릴레이소설':'📚',
  '막장드라마':'💥',
  '역할극방':'🎭',
  '영상 리액션':'🎬',
  '이미지 링크':'🖼️',
  '정보공유':'🔗',
  '꿀팁 링크':'💡',
  '사이트 추천':'🛠️'
};

function clean(value, max = 500) { return String(value || '').replace(/[<>]/g, '').replace(/\s{2,}/g, ' ').trim().slice(0, max); }
function normalizeType(value) { const type = clean(value || '짧은 글', 30); return type === '사진 제목학원' ? '미친작명소' : type; }
function safeVoteKey(option) { return clean(option, 40).replace(/[.~*/\[\]]/g, '_') || 'option'; }
function extFromFile(file) { const name = String(file?.name || 'image').toLowerCase(); const ext = name.split('.').pop(); return ['jpg','jpeg','png','gif','webp'].includes(ext) ? ext : 'jpg'; }
function buildVoteMap(options = [], source = {}) { const map = {}; options.forEach(option => { const key = safeVoteKey(option); map[option] = Number(source[option] ?? source[key] ?? 0); }); return map; }
function cleanUrl(value, max = 700) {
  const raw = String(value || '').trim().slice(0, max);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return '';
    return url.toString();
  } catch { return ''; }
}
function isImageUrl(url) { return /\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(String(url || '')); }
function youtubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return clean(u.pathname.replace(/^\//, ''), 20);
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname.startsWith('/shorts/')) return clean(u.pathname.split('/')[2] || '', 20);
      return clean(u.searchParams.get('v') || '', 20);
    }
  } catch {}
  return '';
}
async function getAuthorName(user) {
  if (!user) return '익명 소소러';
  if (user.isAnonymous) return '익명 소소러';
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists() && snap.data().nickname) return clean(snap.data().nickname, 40);
  } catch {}
  return clean(user.displayName || user.email || '소소킹 유저', 40);
}
function normalizeMedia(data = {}) {
  const linkUrl = cleanUrl(data.linkUrl || data.mediaUrl || '', 700);
  const yt = youtubeId(linkUrl);
  const mediaType = clean(data.mediaType || (yt ? 'youtube' : linkUrl ? (isImageUrl(linkUrl) ? 'image_link' : 'link') : (data.imageUrl ? 'upload' : 'none')), 30);
  let host = '';
  if (linkUrl) {
    try { host = new URL(linkUrl).hostname.replace(/^www\./, ''); } catch {}
  }
  return {
    mediaType,
    linkUrl,
    linkTitle: clean(data.linkTitle || '', 120),
    linkSummary: clean(data.linkSummary || '', 260),
    linkSource: clean(data.linkSource || host, 80),
    embedUrl: yt ? `https://www.youtube-nocookie.com/embed/${yt}` : '',
    thumbnailUrl: yt ? `https://img.youtube.com/vi/${yt}/hqdefault.jpg` : cleanUrl(data.thumbnailUrl || '', 700)
  };
}

async function callFeedFunction(name, data) {
  const fn = httpsCallable(functions, name);
  const result = await fn(data);
  return result.data || {};
}

export async function uploadFeedImage(file, onProgress = () => {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인 후 이미지를 올릴 수 있습니다.');
  if (!file) return '';
  if (!String(file.type || '').startsWith('image/')) throw new Error('이미지 파일만 업로드할 수 있습니다.');
  if (file.size > 5 * 1024 * 1024) throw new Error('이미지는 5MB 이하만 업로드할 수 있습니다.');
  const path = `soso-feed/${user.uid}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extFromFile(file)}`;
  const storageRef = ref(storage, path);
  const task = uploadBytesResumable(storageRef, file, { contentType: file.type });
  await new Promise((resolve, reject) => task.on('state_changed', snap => onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)), reject, resolve));
  return getDownloadURL(task.snapshot.ref);
}

function normalizePost(id, data = {}) {
  const type = normalizeType(data.type || '짧은 글');
  const options = Array.isArray(data.options) ? data.options.map(v => clean(v, 40)).filter(Boolean).slice(0, 4) : [];
  const tags = Array.isArray(data.tags) ? data.tags.map(v => clean(v, 18).replace(/^#/, '')).filter(Boolean).slice(0, 6) : [];
  const finalOptions = options.length ? options : ['공감한다','조금 애매하다','반대한다','댓글로 말한다'];
  const media = normalizeMedia(data);
  return {
    id, type, badge: data.badge || BADGE_BY_TYPE[type] || '✨',
    title: clean(data.title || '제목 없는 소소피드', 90),
    summary: clean(data.summary || data.content || '', 220),
    content: clean(data.content || data.summary || '', 1200),
    question: clean(data.question || '사람들은 어떻게 생각할까요?', 90),
    options: finalOptions, votes: buildVoteMap(finalOptions, data.votes || {}),
    stats:{ views:Number(data.views || 0), likes:Number(data.likes || 0), comments:Number(data.comments || 0), votes:Number(data.voteTotal || 0) },
    topComment: clean(data.topComment || '아직 인기 한 줄이 없습니다.', 120),
    tags: tags.length ? tags : ['소소피드'],
    imageUrl: cleanUrl(data.imageUrl || (media.mediaType === 'image_link' ? media.linkUrl : ''), 700),
    ...media,
    authorId: data.authorId || null,
    authorName: clean(data.authorName || '익명 소소러', 40),
    status: data.status || 'published', source: data.source || 'user', createdAtMs:Number(data.createdAtMs || Date.now())
  };
}
function normalizeComment(id, data = {}) { return { id, text: clean(data.text || '', 300), authorName: clean(data.authorName || '익명 소소러', 40), authorId: data.authorId || null, likes: Number(data.likes || 0), reactions: data.reactions || {}, createdAtMs: Number(data.createdAtMs || Date.now()) }; }

export async function getFeedPosts({ topOnly = false, pageSize = 20 } = {}) {
  try {
    const base = collection(db, 'soso_feed_posts');
    const q = topOnly ? query(base, where('status', '==', 'published'), orderBy('views', 'desc'), limit(pageSize)) : query(base, where('status', '==', 'published'), orderBy('createdAtMs', 'desc'), limit(pageSize));
    const snap = await getDocs(q);
    return snap.docs.map(d => normalizePost(d.id, d.data()));
  } catch (error) { console.warn('소소피드 불러오기 실패:', error.code || error.message); return []; }
}
export async function getFeedPost(postId) { const snap = await getDoc(doc(db, 'soso_feed_posts', postId)); if (!snap.exists()) throw new Error('게시글을 찾을 수 없습니다.'); const post = normalizePost(snap.id, snap.data()); if (post.status !== 'published') throw new Error('공개되지 않은 게시글입니다.'); return post; }
export async function increaseFeedView(postId) { if (!postId) return; try { await callFeedFunction('registerFeedView', { postId }); } catch (error) { console.warn('조회수 증가 실패:', error.code || error.message); } }
export async function likeFeedPost(postId) { if (!postId) return { fallback: true }; await callFeedFunction('likeFeedPost', { postId }); return { ok: true }; }
export async function getMyFeedVote(postId) { const user = auth.currentUser; if (!user || !postId) return null; try { const snap = await getDoc(doc(db, 'soso_feed_posts', postId, 'voters', user.uid)); return snap.exists() ? snap.data().option || null : null; } catch { return null; } }
export async function voteFeedOption(postId, option) { const data = await callFeedFunction('voteFeedOption', { postId, option }); return { ok: true, option: data.option || option }; }
export async function getFeedComments(postId, pageSize = 30) { if (!postId) return []; try { const q = query(collection(db, 'soso_feed_posts', postId, 'comments'), orderBy('createdAtMs', 'desc'), limit(pageSize)); const snap = await getDocs(q); return snap.docs.map(d => normalizeComment(d.id, d.data())).sort((a, b) => Number(b.likes || 0) - Number(a.likes || 0) || Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0)); } catch (error) { console.warn('댓글 불러오기 실패:', error.code || error.message); return []; } }
export async function addFeedComment(postId, text) { const data = await callFeedFunction('addFeedComment', { postId, text }); return normalizeComment(data.comment?.id || '', data.comment || {}); }
export async function createFeedReport({ postId, commentId = '', reason = '기타', detail = '' } = {}) { const user = auth.currentUser; if (!user) throw new Error('로그인 후 신고할 수 있습니다.'); const cleanPostId = clean(postId, 120); if (!cleanPostId) throw new Error('게시글을 찾을 수 없습니다.'); const payload = { category: commentId ? 'soso_feed_comment' : 'soso_feed_post', content: clean(detail || reason, 500), reason: clean(reason, 60), targetType: commentId ? 'comment' : 'post', targetId: clean(commentId || cleanPostId, 160), postId: cleanPostId, reporterId: user.uid, status: 'open', createdAt: serverTimestamp(), createdAtMs: Date.now() }; await addDoc(collection(db, 'reports'), payload); return { ok: true }; }

export async function createFeedPost(input = {}) {
  const user = auth.currentUser; if (!user) throw new Error('로그인 후 글을 올릴 수 있습니다.');
  const type = normalizeType(input.type || '짧은 글'), title = clean(input.title, 90), content = clean(input.content, 1200), question = clean(input.question, 90);
  const options = (Array.isArray(input.options) ? input.options : []).map(v => clean(v, 40)).filter(Boolean).slice(0, 4);
  const tags = (Array.isArray(input.tags) ? input.tags : []).map(v => clean(v, 18).replace(/^#/, '')).filter(Boolean).slice(0, 6);
  if (title.length < 4) throw new Error('제목을 4자 이상 입력해주세요.'); if (content.length < 5) throw new Error('본문 또는 상황 설명을 5자 이상 입력해주세요.');
  const finalOptions = options.length >= 2 ? options : ['공감한다','애매하다','반대한다','댓글로 말한다'];
  const linkUrl = cleanUrl(input.linkUrl || '', 700);
  const yt = youtubeId(linkUrl);
  const mediaType = clean(input.mediaType || (yt ? 'youtube' : linkUrl ? (isImageUrl(linkUrl) ? 'image_link' : 'link') : (input.imageUrl ? 'upload' : 'none')), 30);
  const host = linkUrl ? (() => { try { return new URL(linkUrl).hostname.replace(/^www\./, ''); } catch { return ''; } })() : '';
  const authorName = await getAuthorName(user);
  const payload = {
    type, badge: BADGE_BY_TYPE[type] || '✨', title, content, summary: clean(content, 180), question: question || '사람들은 어떻게 생각할까요?',
    options: finalOptions, votes: Object.fromEntries(finalOptions.map(o => [safeVoteKey(o), 0])), voteTotal: 0,
    tags: tags.length ? tags : ['소소피드'], views:0, likes:0, comments:0, status:'published', source: user.isAnonymous ? 'anonymous_user' : 'user',
    authorId:user.uid, authorName,
    imageUrl: cleanUrl(input.imageUrl || (mediaType === 'image_link' ? linkUrl : ''), 700), mediaType, linkUrl,
    linkTitle: clean(input.linkTitle || '', 120), linkSummary: clean(input.linkSummary || '', 260), linkSource: clean(input.linkSource || host, 80),
    embedUrl: yt ? `https://www.youtube-nocookie.com/embed/${yt}` : '', thumbnailUrl: yt ? `https://img.youtube.com/vi/${yt}/hqdefault.jpg` : cleanUrl(input.thumbnailUrl || '', 700),
    topComment:'', createdAt: serverTimestamp(), createdAtMs: Date.now(), updatedAt: serverTimestamp()
  };
  const ref = await addDoc(collection(db, 'soso_feed_posts'), payload);
  return { id: ref.id, ...normalizePost(ref.id, payload) };
}