import { JOKES } from './jokes.js?v=20260731-dripso-1';
import { initAuth, auth, db, functions } from '/js/firebase.js?v=20260729-auth-session-1';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';

const TYPE_META = {
  daily: { label: '오늘의 한줄', icon: '💬', description: '한 줄이면 충분한 오늘의 생각과 드립' },
  naming: { label: '이름짓기', icon: '🏷️', description: '물건, 모임, 반려식물까지 기막힌 이름 모집' },
  situation: { label: '상황드립', icon: '🎭', description: '주어진 상황을 가장 웃기게 마무리하기' }
};
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SOURCE_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_UPLOAD_IMAGE_BYTES = 700 * 1024;
const MAX_IMAGE_EDGE = 1280;

const createTopic = httpsCallable(functions, 'createDripsoTopic');
const addComment = httpsCallable(functions, 'addDripsoComment');
const toggleLike = httpsCallable(functions, 'toggleDripsoCommentLike');

const app = document.getElementById('dripso-app');
const nav = document.querySelector('.dripso-bottom-nav');
const topicDialog = document.getElementById('topic-dialog');
const topicForm = document.getElementById('topic-form');
const topicType = document.getElementById('topic-type');
const topicTitle = document.getElementById('topic-title');
const topicPrompt = document.getElementById('topic-prompt');
const topicImage = document.getElementById('topic-image');
const topicImagePreview = document.getElementById('topic-image-preview');
const topicImagePreviewImg = document.getElementById('topic-image-preview-img');
const topicImageStatus = document.getElementById('topic-image-status');
const removeTopicImageButton = document.getElementById('remove-topic-image');
const topicSubmit = document.getElementById('topic-submit');
const openTopicDialogButton = document.getElementById('open-topic-dialog');
const closeTopicDialogButton = document.getElementById('close-topic-dialog');
const accountLink = document.getElementById('account-link');
const toast = document.getElementById('toast');

let topicsCache = null;
let toastTimer = 0;
let profileNickname = '';
let selectedImageDataUrl = '';
let imageSelectionVersion = 0;
let imageProcessing = false;
let topicSubmitting = false;

function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== '') node.textContent = text;
  return node;
}

function timestampMs(value) {
  if (value?.toMillis) return value.toMillis();
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value) {
  const millis = timestampMs(value);
  if (!millis) return '방금 전';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(millis));
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = window.setTimeout(() => { toast.hidden = true; }, 2200);
}

function errorMessage(error, fallback) {
  const raw = String(error?.message || '');
  return raw.replace(/^FirebaseError:\s*/i, '').replace(/^functions\/[a-z-]+:\s*/i, '') || fallback;
}

function isAccountUser() {
  return !!auth.currentUser && !auth.currentUser.isAnonymous;
}

function currentRoute() {
  const hash = location.hash || '#/';
  const value = hash.replace(/^#\/?/, '');
  const [name = '', id = ''] = value.split('/');
  if (name === 'topic' && id) return { name: 'topic', id };
  if (['daily', 'naming', 'situation', 'popular'].includes(name)) return { name };
  return { name: 'home' };
}

function setActiveNav(name) {
  nav.querySelectorAll('[data-nav]').forEach(link => {
    link.classList.toggle('active', link.dataset.nav === name);
  });
}

function renderLoading() {
  app.replaceChildren(element('section', 'loading-card', '드립을 불러오는 중입니다.'));
}

function renderError(message) {
  app.replaceChildren(element('section', 'error-card', message));
}

function dailyJoke() {
  const key = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
  let seed = 0;
  for (const char of key) seed += char.charCodeAt(0);
  return JOKES[seed % JOKES.length];
}

async function loadTopics(force = false) {
  if (topicsCache && !force) return topicsCache;
  const snapshot = await getDocs(query(
    collection(db, 'dripso_topics'),
    where('status', '==', 'visible'),
    limit(100)
  ));
  topicsCache = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
  return topicsCache;
}

function sortedLatest(items) {
  return [...items].sort((a, b) => timestampMs(b.createdAt) - timestampMs(a.createdAt));
}

function sortedPopular(items) {
  return [...items].sort((a, b) =>
    Number(b.topLikeCount || 0) - Number(a.topLikeCount || 0)
    || Number(b.commentCount || 0) - Number(a.commentCount || 0)
    || timestampMs(b.updatedAt) - timestampMs(a.updatedAt)
  );
}

function safeTopicImageUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    return parsed.protocol === 'https:' && parsed.hostname === 'firebasestorage.googleapis.com'
      ? parsed.href
      : '';
  } catch {
    return '';
  }
}

function topicImageElement(topic, className) {
  const imageUrl = safeTopicImageUrl(topic.imageUrl);
  if (!imageUrl) return null;
  const image = element('img', className);
  image.src = imageUrl;
  image.alt = `${String(topic.title || '드립 주제')} 첨부 이미지`;
  image.loading = 'lazy';
  image.decoding = 'async';
  return image;
}

function topicCard(topic) {
  const meta = TYPE_META[topic.type] || TYPE_META.daily;
  const card = element('a', 'topic-card');
  card.href = `#/topic/${encodeURIComponent(topic.id)}`;

  const top = element('div', 'topic-meta');
  const badge = element('span', `type-badge ${topic.type || ''}`, `${meta.icon} ${meta.label}`);
  const date = element('span', '', formatDate(topic.createdAt));
  top.append(badge, date);

  const title = element('h3', '', String(topic.title || '제목 없는 주제'));
  const prompt = element('p', '', String(topic.prompt || ''));
  const stats = element('div', 'topic-stats');
  stats.append(
    element('span', '', `💬 ${Math.max(0, Number(topic.commentCount) || 0)}`),
    element('span', '', `❤️ ${Math.max(0, Number(topic.topLikeCount) || 0)}`),
    element('span', '', `by ${String(topic.nickname || '익명 드리퍼')}`)
  );
  card.append(top);
  const image = topicImageElement(topic, 'topic-card-image');
  if (image) card.append(image);
  card.append(title, prompt, stats);
  return card;
}

function topicListSection(items, emptyText) {
  if (!items.length) return element('div', 'empty-card', emptyText);
  const list = element('div', 'topic-list');
  list.replaceChildren(...items.map(topicCard));
  return list;
}

function menuTile(type) {
  const meta = TYPE_META[type];
  const tile = element('a', 'menu-tile');
  tile.href = `#/${type}`;
  tile.append(
    element('span', 'menu-icon', meta.icon),
    (() => {
      const copy = element('span');
      copy.append(element('strong', '', meta.label), element('small', '', meta.description));
      return copy;
    })()
  );
  return tile;
}

async function renderHome() {
  setActiveNav('home');
  const topics = sortedLatest(await loadTopics());
  const hero = element('section', 'hero-card');
  hero.append(
    element('p', 'eyebrow', 'DRIP COMMUNITY'),
    element('h1', '', '주제를 던지면 모두가 한마디씩 보탭니다'),
    element('p', '', '댓글 드립에 좋아요를 누르면 가장 반응이 좋은 한마디가 위로 올라옵니다.')
  );
  const daily = element('div', 'daily-line-card');
  daily.append(element('span', '', '오늘의 기본 한 줄'), element('p', '', dailyJoke().text));
  hero.append(daily);

  const menu = element('section', 'menu-grid');
  menu.append(menuTile('daily'), menuTile('naming'), menuTile('situation'));

  const latest = element('section', 'section-block');
  const heading = element('div', 'section-heading');
  const headingCopy = element('div');
  headingCopy.append(element('p', 'section-kicker', 'NEW TOPICS'), element('h2', '', '새로 열린 드립판'));
  const write = element('button', 'write-button', '주제 등록');
  write.type = 'button';
  write.dataset.openDialog = 'daily';
  heading.append(headingCopy, write);
  latest.append(heading, topicListSection(topics.slice(0, 8), '아직 등록된 주제가 없습니다. 첫 드립판을 열어주세요.'));

  app.replaceChildren(hero, menu, latest);
}

async function renderCategory(type) {
  setActiveNav(type);
  const meta = TYPE_META[type];
  const topics = sortedLatest((await loadTopics()).filter(topic => topic.type === type));
  const header = element('section', 'page-heading');
  const copy = element('div', 'page-heading-copy');
  copy.append(element('p', 'section-kicker', `${meta.icon} DRIP MENU`), element('h1', '', meta.label), element('p', '', meta.description));
  const write = element('button', 'write-button', '＋ 주제 등록');
  write.type = 'button';
  write.dataset.openDialog = type;
  header.append(copy, write);

  const section = element('section', 'section-block');
  section.append(topicListSection(topics, `${meta.label} 주제가 아직 없습니다.`));
  app.replaceChildren(header, section);
}

async function renderPopular() {
  setActiveNav('popular');
  const topics = sortedPopular(await loadTopics());
  const header = element('section', 'page-heading');
  const copy = element('div', 'page-heading-copy');
  copy.append(element('p', 'section-kicker', '🔥 BEST DRIP'), element('h1', '', '인기 드립판'), element('p', '', '좋아요가 많이 쌓인 댓글을 가진 주제부터 보여줍니다.'));
  header.append(copy);
  const section = element('section', 'section-block');
  section.append(topicListSection(topics, '아직 인기 순위를 만들 댓글이 없습니다.'));
  app.replaceChildren(header, section);
}

function commentCard(topicId, comment, index) {
  const card = element('article', `comment-card${index < 3 ? ' best' : ''}`);
  const meta = element('div', 'comment-meta');
  const rank = element('span', index < 3 ? 'best-rank' : '', index < 3 ? `BEST ${index + 1}` : `#${index + 1}`);
  const author = element('span', '', `${String(comment.nickname || '익명 드리퍼')} · ${formatDate(comment.createdAt)}`);
  meta.append(rank, author);
  const text = element('p', 'comment-text', String(comment.text || ''));
  const like = element('button', 'like-button', `❤️ 좋아요 ${Math.max(0, Number(comment.likeCount) || 0)}`);
  like.type = 'button';
  like.dataset.like = comment.id;
  like.dataset.topic = topicId;
  card.append(meta, text, like);
  return card;
}

async function loadComments(topicId) {
  const snapshot = await getDocs(query(
    collection(db, `dripso_topics/${topicId}/comments`),
    where('status', '==', 'visible'),
    limit(100)
  ));
  return snapshot.docs
    .map(item => ({ id: item.id, ...item.data() }))
    .sort((a, b) => Number(b.likeCount || 0) - Number(a.likeCount || 0)
      || timestampMs(a.createdAt) - timestampMs(b.createdAt));
}

function commentComposer(topicId) {
  if (!isAccountUser()) {
    const notice = element('div', 'login-notice');
    notice.append('댓글 드립과 좋아요는 로그인 후 참여할 수 있습니다. ', (() => {
      const link = element('a', '', '로그인하기');
      link.href = '/#/auth';
      return link;
    })());
    return notice;
  }
  const form = element('form', 'comment-form');
  form.dataset.commentForm = topicId;
  const area = element('textarea');
  area.name = 'text';
  area.maxLength = 300;
  area.required = true;
  area.placeholder = '이 주제에 가장 잘 어울리는 한마디를 남겨주세요.';
  const footer = element('div', 'comment-form-footer');
  footer.append(element('small', '', `${profileNickname || '로그인 사용자'}로 등록됩니다.`));
  const submit = element('button', 'comment-submit', '드립 달기');
  submit.type = 'submit';
  footer.append(submit);
  form.append(area, footer);
  return form;
}

async function renderTopic(topicId) {
  renderLoading();
  const topicSnap = await getDoc(doc(db, 'dripso_topics', topicId));
  if (!topicSnap.exists() || topicSnap.data()?.status !== 'visible') {
    renderError('삭제되었거나 찾을 수 없는 주제입니다.');
    return;
  }
  const topic = { id: topicSnap.id, ...topicSnap.data() };
  setActiveNav(topic.type || 'home');
  const comments = await loadComments(topicId);
  const meta = TYPE_META[topic.type] || TYPE_META.daily;

  const detail = element('section', 'topic-detail');
  const back = element('a', 'back-button', `← ${meta.label}로 돌아가기`);
  back.href = `#/${topic.type || ''}`;
  const badge = element('span', `type-badge ${topic.type || ''}`, `${meta.icon} ${meta.label}`);
  detail.append(back, badge, element('h1', '', String(topic.title || '드립 주제')));
  const image = topicImageElement(topic, 'topic-detail-image');
  if (image) detail.append(image);
  detail.append(
    element('p', 'topic-prompt', String(topic.prompt || '')),
    element('p', 'topic-author', `주제 등록: ${String(topic.nickname || '익명 드리퍼')} · 댓글 ${comments.length}개`),
    commentComposer(topicId)
  );

  const section = element('section', 'section-block');
  const heading = element('div', 'section-heading');
  const headingCopy = element('div');
  headingCopy.append(element('p', 'section-kicker', 'LIKE RANKING'), element('h2', '', '댓글 드립 순위'));
  heading.append(headingCopy, element('span', '', `${comments.length}개`));
  section.append(heading);
  if (comments.length) {
    const list = element('div', 'comment-list');
    list.replaceChildren(...comments.map((comment, index) => commentCard(topicId, comment, index)));
    section.append(list);
  } else {
    section.append(element('div', 'empty-card', '아직 댓글 드립이 없습니다. 첫 한마디를 남겨주세요.'));
  }
  app.replaceChildren(detail, section);
}

function preferredDialogType() {
  const route = currentRoute();
  return TYPE_META[route.name] ? route.name : 'daily';
}

function syncTopicSubmitState() {
  topicSubmit.disabled = imageProcessing || topicSubmitting;
  topicSubmit.textContent = imageProcessing
    ? '사진 처리 중…'
    : (topicSubmitting ? '등록 중…' : '주제 등록하기');
}

function setImageStatus(message = '', isError = false) {
  topicImageStatus.textContent = message;
  topicImageStatus.classList.toggle('error', isError);
}

function clearSelectedImage() {
  imageSelectionVersion += 1;
  selectedImageDataUrl = '';
  topicImage.value = '';
  topicImagePreviewImg.removeAttribute('src');
  topicImagePreview.hidden = true;
  imageProcessing = false;
  setImageStatus('');
  syncTopicSubmitState();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('사진 파일을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('지원하지 않거나 손상된 사진입니다.'));
    image.src = dataUrl;
  });
}

function canvasToJpegBlob(canvas, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
}

async function blobToDataUrl(blob) {
  return readFileAsDataUrl(blob);
}

async function compressTopicImage(file) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error('JPG, PNG, WEBP 사진만 첨부할 수 있습니다.');
  }
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error('원본 사진은 12MB 이하만 첨부할 수 있습니다.');
  }

  const originalUrl = await readFileAsDataUrl(file);
  const source = await loadImage(originalUrl);
  const sourceWidth = Math.max(1, Number(source.naturalWidth) || 1);
  const sourceHeight = Math.max(1, Number(source.naturalHeight) || 1);
  let scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(sourceWidth, sourceHeight));

  for (let sizeAttempt = 0; sizeAttempt < 4; sizeAttempt += 1) {
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('이 기기에서 사진을 처리할 수 없습니다.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(source, 0, 0, width, height);

    for (const quality of [0.84, 0.74, 0.64, 0.54]) {
      const blob = await canvasToJpegBlob(canvas, quality);
      if (blob && blob.size <= MAX_UPLOAD_IMAGE_BYTES) return blob;
    }
    scale *= 0.78;
  }
  throw new Error('사진 용량을 줄이지 못했습니다. 다른 사진을 선택해 주세요.');
}

async function handleTopicImageSelection() {
  const file = topicImage.files?.[0];
  const version = ++imageSelectionVersion;
  selectedImageDataUrl = '';
  topicImagePreview.hidden = true;
  topicImagePreviewImg.removeAttribute('src');
  if (!file) {
    setImageStatus('');
    return;
  }

  imageProcessing = true;
  setImageStatus('사진을 게시용 크기로 줄이는 중입니다.');
  syncTopicSubmitState();
  try {
    const blob = await compressTopicImage(file);
    const dataUrl = await blobToDataUrl(blob);
    if (version !== imageSelectionVersion) return;
    selectedImageDataUrl = dataUrl;
    topicImagePreviewImg.src = dataUrl;
    topicImagePreview.hidden = false;
    const sizeKb = Math.max(1, Math.round(blob.size / 1024));
    setImageStatus(`사진 준비 완료 · 약 ${sizeKb}KB`);
  } catch (error) {
    if (version !== imageSelectionVersion) return;
    selectedImageDataUrl = '';
    topicImage.value = '';
    setImageStatus(errorMessage(error, '사진을 처리하지 못했습니다.'), true);
    showToast(errorMessage(error, '사진을 처리하지 못했습니다.'));
  } finally {
    if (version === imageSelectionVersion) {
      imageProcessing = false;
      syncTopicSubmitState();
    }
  }
}

function openDialog(type = preferredDialogType()) {
  if (!isAccountUser()) {
    showToast('판결소 계정으로 로그인한 뒤 주제를 등록할 수 있습니다.');
    return;
  }
  topicType.value = TYPE_META[type] ? type : 'daily';
  topicDialog.showModal();
  window.setTimeout(() => topicTitle.focus(), 20);
}

async function renderRoute() {
  const route = currentRoute();
  renderLoading();
  try {
    if (route.name === 'home') await renderHome();
    else if (route.name === 'popular') await renderPopular();
    else if (route.name === 'topic') await renderTopic(route.id);
    else await renderCategory(route.name);
    app.focus({ preventScroll: true });
  } catch (error) {
    console.error('Dripso render failed:', error);
    renderError(errorMessage(error, '드립소 내용을 불러오지 못했습니다.'));
  }
}

app.addEventListener('click', async event => {
  const dialogButton = event.target.closest('[data-open-dialog]');
  if (dialogButton) {
    openDialog(dialogButton.dataset.openDialog);
    return;
  }
  const likeButton = event.target.closest('[data-like][data-topic]');
  if (!likeButton) return;
  if (!isAccountUser()) {
    showToast('로그인 후 좋아요를 누를 수 있습니다.');
    return;
  }
  likeButton.disabled = true;
  try {
    const response = await toggleLike({
      topicId: likeButton.dataset.topic,
      commentId: likeButton.dataset.like
    });
    const liked = response.data?.liked === true;
    const count = Math.max(0, Number(response.data?.likeCount) || 0);
    likeButton.classList.toggle('active', liked);
    likeButton.textContent = `❤️ 좋아요 ${count}`;
    topicsCache = null;
  } catch (error) {
    showToast(errorMessage(error, '좋아요 처리에 실패했습니다.'));
  } finally {
    likeButton.disabled = false;
  }
});

app.addEventListener('submit', async event => {
  const form = event.target.closest('[data-comment-form]');
  if (!form) return;
  event.preventDefault();
  const area = form.querySelector('textarea[name="text"]');
  const submit = form.querySelector('button[type="submit"]');
  const text = String(area?.value || '').trim();
  if (text.length < 2) {
    showToast('드립을 2자 이상 입력해 주세요.');
    return;
  }
  submit.disabled = true;
  try {
    await addComment({ topicId: form.dataset.commentForm, text });
    topicsCache = null;
    showToast('드립이 등록됐습니다.');
    await renderTopic(form.dataset.commentForm);
  } catch (error) {
    showToast(errorMessage(error, '댓글 등록에 실패했습니다.'));
  } finally {
    submit.disabled = false;
  }
});

topicForm.addEventListener('submit', async event => {
  event.preventDefault();
  const title = topicTitle.value.trim();
  const prompt = topicPrompt.value.trim();
  if (title.length < 2 || prompt.length < 4) {
    showToast('제목과 설명을 조금 더 입력해 주세요.');
    return;
  }
  if (imageProcessing) {
    showToast('사진 처리가 끝날 때까지 잠시 기다려 주세요.');
    return;
  }
  topicSubmitting = true;
  syncTopicSubmitState();
  try {
    const response = await createTopic({
      type: topicType.value,
      title,
      prompt,
      imageDataUrl: selectedImageDataUrl
    });
    const topicId = String(response.data?.topicId || '');
    topicsCache = null;
    topicForm.reset();
    clearSelectedImage();
    topicDialog.close();
    showToast('새 드립판을 열었습니다.');
    location.hash = `#/topic/${topicId}`;
  } catch (error) {
    showToast(errorMessage(error, '주제 등록에 실패했습니다.'));
  } finally {
    topicSubmitting = false;
    syncTopicSubmitState();
  }
});

topicImage.addEventListener('change', () => void handleTopicImageSelection());
removeTopicImageButton.addEventListener('click', clearSelectedImage);
openTopicDialogButton.addEventListener('click', () => openDialog());
closeTopicDialogButton.addEventListener('click', () => topicDialog.close());
topicDialog.addEventListener('click', event => {
  if (event.target === topicDialog) topicDialog.close();
});
window.addEventListener('hashchange', () => void renderRoute());

onAuthStateChanged(auth, async user => {
  if (user && !user.isAnonymous) {
    const profile = await getDoc(doc(db, 'users', user.uid)).catch(() => null);
    profileNickname = profile?.exists() ? String(profile.data().nickname || '').slice(0, 20) : '';
    accountLink.textContent = profileNickname || user.displayName || '내 계정';
    accountLink.href = '/#/my-cases';
  } else {
    profileNickname = '';
    accountLink.textContent = '로그인';
    accountLink.href = '/#/auth';
  }
});

syncTopicSubmitState();
await initAuth().catch(error => console.warn('Dripso auth init failed:', error));
await renderRoute();
