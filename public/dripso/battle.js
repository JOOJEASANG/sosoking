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

const MODE_META = Object.freeze({
  blank: {
    label: '빈칸채우기', icon: '🧩', short: '문장은 준비됐습니다. 마지막 한 방만 넣으세요.',
    example: '회의가 길어지는 이유는 ______ 때문이다.',
    titlePlaceholder: '예: 회의가 길어지는 진짜 이유',
    promptPlaceholder: '예: 회의가 길어지는 이유는 ______ 때문이다.'
  },
  naming: {
    label: '이름붙이기', icon: '🏷️', short: '별명·필살기·제품명·영화 제목을 붙입니다.',
    example: '퇴근 직전에 일을 주는 기술의 이름은?',
    titlePlaceholder: '예: 부장님의 퇴근 방해 기술',
    promptPlaceholder: '예: 퇴근 직전에 일을 주는 기술의 이름을 지어주세요.'
  },
  comeback: {
    label: '받아치기', icon: '↩️', short: '상대의 한마디에 짧고 강하게 답합니다.',
    example: '“이거 금방 끝나.” 가장 적절한 대답은?',
    titlePlaceholder: '예: 금방 끝난다는 말에 받아치기',
    promptPlaceholder: '예: 상대가 “이거 금방 끝나”라고 말했다. 가장 웃긴 답은?'
  },
  wrong: {
    label: '오답제출', icon: '❌', short: '정답 대신 가장 웃긴 오답을 제출합니다.',
    example: '회사에서 가장 중요한 자원은?',
    titlePlaceholder: '예: 회사의 가장 중요한 자원',
    promptPlaceholder: '예: 회사에서 가장 중요한 자원은 무엇일까요? 정답 말고 오답만.'
  },
  headline: {
    label: '뉴스제목', icon: '📰', short: '평범한 사건을 속보와 기사 제목으로 만듭니다.',
    example: '냉장고 케이크 실종 사건을 속보로 쓴다면?',
    titlePlaceholder: '예: 냉장고 케이크 실종 속보',
    promptPlaceholder: '예: 가족이 냉장고 케이크를 다 먹은 상황의 뉴스 제목을 지어주세요.'
  },
  excuse: {
    label: '변명대회', icon: '🥸', short: '황당하지만 순간 납득되는 변명을 만듭니다.',
    example: '약속에 한 시간 늦은 이유는?',
    titlePlaceholder: '예: 지각 한 시간 변명대회',
    promptPlaceholder: '예: 약속에 한 시간 늦었습니다. 가장 황당하지만 그럴듯한 변명은?'
  },
  manual: {
    label: '사용설명서', icon: '📘', short: '사람과 상황을 제품 설명서처럼 표현합니다.',
    example: '부장님 사용 시 주의사항은?',
    titlePlaceholder: '예: 부장님 사용설명서',
    promptPlaceholder: '예: 부장님 사용 시 주의사항을 한 줄로 작성해주세요.'
  }
});

const MODE_ORDER = Object.keys(MODE_META);
const MODE_MARKER = /^\[\[dripso-mode:([a-z-]+)\]\]\s*/i;
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
const battleMode = document.getElementById('battle-mode');
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
  toast.textContent = String(message || '');
  toast.hidden = false;
  toastTimer = window.setTimeout(() => { toast.hidden = true; }, 2300);
}

function errorMessage(error, fallback) {
  const raw = String(error?.message || '');
  return raw.replace(/^FirebaseError:\s*/i, '').replace(/^functions\/[a-z-]+:\s*/i, '') || fallback;
}

function isAccountUser() {
  return Boolean(auth.currentUser && !auth.currentUser.isAnonymous);
}

function currentRoute() {
  const value = (location.hash || '#/').replace(/^#\/?/, '');
  const [name = '', id = ''] = value.split('/');
  if (name === 'topic' && id) {
    try { return { name: 'topic', id: decodeURIComponent(id) }; }
    catch { return { name: 'home' }; }
  }
  if (name === 'mode' && MODE_META[id]) return { name: 'mode', mode: id };
  if (['browse', 'popular', 'hall', 'create'].includes(name)) return { name };
  return { name: 'home' };
}

function setActiveNav(name) {
  const active = name === 'mode' ? 'browse' : name;
  nav.querySelectorAll('[data-nav]').forEach(link => {
    link.classList.toggle('active', link.dataset.nav === active);
  });
}

function renderLoading() {
  app.replaceChildren(element('section', 'loading-card', '드립 배틀을 불러오는 중입니다.'));
}

function renderError(message) {
  app.replaceChildren(element('section', 'error-card', message));
}

function encodedPrompt(mode, prompt) {
  return `[[dripso-mode:${mode}]] ${String(prompt || '').trim()}`;
}

function parsedTopic(topic) {
  const rawPrompt = String(topic?.prompt || '');
  const match = rawPrompt.match(MODE_MARKER);
  let mode = match && MODE_META[match[1]] ? match[1] : '';
  if (!mode && topic?.type === 'naming') mode = 'naming';
  if (!mode && topic?.type === 'situation') mode = 'comeback';
  if (!mode) return null;
  return {
    ...topic,
    mode,
    displayPrompt: rawPrompt.replace(MODE_MARKER, '').trim()
  };
}

async function loadTopics(force = false) {
  if (topicsCache && !force) return topicsCache;
  const snapshot = await getDocs(query(
    collection(db, 'dripso_topics'),
    where('status', '==', 'visible'),
    limit(200)
  ));
  topicsCache = snapshot.docs
    .map(item => parsedTopic({ id: item.id, ...item.data() }))
    .filter(Boolean);
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
  image.alt = `${String(topic.title || '드립 배틀')} 첨부 이미지`;
  image.loading = 'lazy';
  image.decoding = 'async';
  return image;
}

function modeBadge(mode) {
  const meta = MODE_META[mode] || MODE_META.blank;
  return element('span', `type-badge battle-${mode}`, `${meta.icon} ${meta.label}`);
}

function topicCard(topic, rank = 0) {
  const meta = MODE_META[topic.mode] || MODE_META.blank;
  const card = element('a', 'topic-card battle-topic-card');
  card.href = `#/topic/${encodeURIComponent(topic.id)}`;

  const top = element('div', 'topic-meta');
  top.append(modeBadge(topic.mode), element('span', '', formatDate(topic.createdAt)));
  card.append(top);

  const image = topicImageElement(topic, 'topic-card-image');
  if (image) card.append(image);

  if (rank > 0) card.append(element('span', 'hall-rank', `명예 ${rank}위`));
  card.append(
    element('h3', '', String(topic.title || `${meta.label} 배틀`)),
    element('p', '', String(topic.displayPrompt || ''))
  );

  const stats = element('div', 'topic-stats');
  stats.append(
    element('span', '', `출전 ${Math.max(0, Number(topic.commentCount) || 0)}`),
    element('span', '', `최고 ❤️ ${Math.max(0, Number(topic.topLikeCount) || 0)}`),
    element('span', '', `판주 ${String(topic.nickname || '익명 드리퍼')}`)
  );
  card.append(stats);
  return card;
}

function topicListSection(items, emptyText, ranked = false) {
  if (!items.length) return element('div', 'empty-card', emptyText);
  const list = element('div', 'topic-list');
  list.replaceChildren(...items.map((topic, index) => topicCard(topic, ranked ? index + 1 : 0)));
  return list;
}

function modeTile(mode) {
  const meta = MODE_META[mode];
  const tile = element('a', `battle-mode-tile mode-${mode}`);
  tile.href = `#/mode/${mode}`;
  tile.append(
    element('span', 'battle-mode-icon', meta.icon),
    element('strong', '', meta.label),
    element('small', '', meta.short),
    element('em', '', meta.example)
  );
  return tile;
}

function sectionHeading(kicker, title, actionText = '', actionMode = '') {
  const heading = element('div', 'section-heading');
  const copy = element('div');
  copy.append(element('p', 'section-kicker', kicker), element('h2', '', title));
  heading.append(copy);
  if (actionText) {
    const action = element('button', 'write-button', actionText);
    action.type = 'button';
    action.dataset.openDialog = actionMode || 'blank';
    heading.append(action);
  }
  return heading;
}

async function renderHome() {
  setActiveNav('home');
  const topics = sortedLatest(await loadTopics());

  const hero = element('section', 'hero-card battle-hero');
  hero.append(
    element('p', 'eyebrow', '10-SECOND COMEDY BATTLE'),
    element('h1', '', '문장은 드립소가 준비합니다. 마지막 한 방만 넣으세요.'),
    element('p', '', '빈칸·이름·오답처럼 누구나 10초 안에 출전할 수 있는 일곱 가지 드립 배틀입니다.')
  );
  const heroActions = element('div', 'battle-hero-actions');
  const browse = element('a', 'submit-button battle-hero-link', '열린 배틀 찾기');
  browse.href = '#/browse';
  const create = element('button', 'write-button', '새 배틀 열기');
  create.type = 'button';
  create.dataset.openDialog = 'blank';
  heroActions.append(browse, create);
  hero.append(heroActions);

  const modes = element('section', 'section-block');
  modes.append(sectionHeading('7 BATTLE MODES', '골라서 바로 출전'));
  const grid = element('div', 'battle-mode-grid');
  grid.replaceChildren(...MODE_ORDER.map(modeTile));
  modes.append(grid);

  const latest = element('section', 'section-block');
  latest.append(
    sectionHeading('NEW BATTLES', '새로 열린 드립판', '배틀 열기', 'blank'),
    topicListSection(topics.slice(0, 10), '아직 열린 배틀이 없습니다. 첫 번째 판을 열어주세요.')
  );

  app.replaceChildren(hero, modes, latest);
}

function filterBar(activeMode = '') {
  const bar = element('nav', 'battle-filter-bar');
  const all = element('a', activeMode ? '' : 'active', '전체');
  all.href = '#/browse';
  bar.append(all);
  for (const mode of MODE_ORDER) {
    const meta = MODE_META[mode];
    const link = element('a', activeMode === mode ? 'active' : '', `${meta.icon} ${meta.label}`);
    link.href = `#/mode/${mode}`;
    bar.append(link);
  }
  return bar;
}

async function renderBrowse(activeMode = '') {
  setActiveNav(activeMode ? 'mode' : 'browse');
  const topics = sortedLatest(await loadTopics())
    .filter(topic => !activeMode || topic.mode === activeMode);
  const meta = activeMode ? MODE_META[activeMode] : null;

  const header = element('section', 'page-heading battle-page-heading');
  const copy = element('div', 'page-heading-copy');
  copy.append(
    element('p', 'section-kicker', meta ? `${meta.icon} BATTLE MODE` : 'ALL BATTLES'),
    element('h1', '', meta ? meta.label : '배틀찾기'),
    element('p', '', meta ? meta.short : '일곱 가지 방식 중 마음에 드는 판을 골라 한마디를 남겨보세요.')
  );
  const write = element('button', 'write-button', '＋ 배틀 열기');
  write.type = 'button';
  write.dataset.openDialog = activeMode || 'blank';
  header.append(copy, write);

  const section = element('section', 'section-block');
  section.append(filterBar(activeMode), topicListSection(topics, '이 방식으로 열린 배틀이 아직 없습니다.'));
  app.replaceChildren(header, section);
}

async function renderPopular() {
  setActiveNav('popular');
  const topics = sortedPopular(await loadTopics());
  const header = element('section', 'page-heading');
  const copy = element('div', 'page-heading-copy');
  copy.append(
    element('p', 'section-kicker', '🔥 CROWD FAVORITES'),
    element('h1', '', '지금 터지는 배틀'),
    element('p', '', '최고 반응과 출전자 수가 높은 배틀부터 보여줍니다.')
  );
  header.append(copy);
  const section = element('section', 'section-block');
  section.append(topicListSection(topics, '아직 순위를 만들 출전작이 없습니다.'));
  app.replaceChildren(header, section);
}

async function renderHall() {
  setActiveNav('hall');
  const topics = sortedPopular(await loadTopics()).filter(topic => Number(topic.topLikeCount || 0) > 0).slice(0, 20);
  const header = element('section', 'page-heading hall-heading');
  const copy = element('div', 'page-heading-copy');
  copy.append(
    element('p', 'section-kicker', '🏆 HALL OF DRIP'),
    element('h1', '', '명예의전당'),
    element('p', '', '현재는 역대 최고 댓글 반응을 기준으로 기록합니다. 토너먼트가 도입되면 우승 전적으로 전환됩니다.')
  );
  header.append(copy);
  const section = element('section', 'section-block');
  section.append(topicListSection(topics, '아직 명예의전당에 입성한 배틀이 없습니다.', true));
  app.replaceChildren(header, section);
}

function commentCard(topicId, comment, index) {
  const card = element('article', `comment-card${index < 3 ? ' best' : ''}`);
  card.dataset.commentId = comment.id;
  const meta = element('div', 'comment-meta');
  meta.append(
    element('span', index < 3 ? 'best-rank' : '', index < 3 ? `BEST ${index + 1}` : `#${index + 1}`),
    element('span', '', `${String(comment.nickname || '익명 드리퍼')} · ${formatDate(comment.createdAt)}`)
  );
  const like = element('button', 'like-button', `❤️ 반응 ${Math.max(0, Number(comment.likeCount) || 0)}`);
  like.type = 'button';
  like.dataset.like = comment.id;
  like.dataset.topic = topicId;
  card.append(meta, element('p', 'comment-text', String(comment.text || '')), like);
  return card;
}

async function loadComments(topicId) {
  const snapshot = await getDocs(query(
    collection(db, `dripso_topics/${topicId}/comments`),
    where('status', '==', 'visible'),
    limit(200)
  ));
  return snapshot.docs
    .map(item => ({ id: item.id, ...item.data() }))
    .sort((a, b) => Number(b.likeCount || 0) - Number(a.likeCount || 0)
      || timestampMs(a.createdAt) - timestampMs(b.createdAt));
}

function commentComposer(topicId, mode) {
  if (!isAccountUser()) {
    const notice = element('div', 'login-notice');
    notice.append('출전과 반응은 로그인 후 가능합니다. ');
    const link = element('a', '', '로그인하기');
    link.href = '/#/auth';
    notice.append(link);
    return notice;
  }
  const form = element('form', 'comment-form');
  form.dataset.commentForm = topicId;
  const area = element('textarea');
  area.name = 'text';
  area.maxLength = mode === 'naming' ? 80 : 180;
  area.required = true;
  area.rows = 2;
  area.placeholder = mode === 'naming'
    ? '이름만 짧고 강하게 입력해 주세요.'
    : '설명보다 한 방이 좋습니다. 짧게 입력해 주세요.';
  const footer = element('div', 'comment-form-footer');
  footer.append(element('small', '', `${profileNickname || '로그인 사용자'}로 출전합니다.`));
  const submit = element('button', 'comment-submit', '이 한마디로 출전');
  submit.type = 'submit';
  footer.append(submit);
  form.append(area, footer);
  return form;
}

async function renderTopic(topicId) {
  renderLoading();
  const topicSnap = await getDoc(doc(db, 'dripso_topics', topicId));
  const parsed = topicSnap.exists() ? parsedTopic({ id: topicSnap.id, ...topicSnap.data() }) : null;
  if (!parsed || topicSnap.data()?.status !== 'visible') {
    renderError('삭제되었거나 현재 드립배틀에서 볼 수 없는 주제입니다.');
    return;
  }
  const topic = parsed;
  setActiveNav('browse');
  const comments = await loadComments(topicId);
  const meta = MODE_META[topic.mode];

  const detail = element('section', 'topic-detail battle-topic-detail');
  const back = element('a', 'back-button', `← ${meta.label} 배틀로 돌아가기`);
  back.href = `#/mode/${topic.mode}`;
  detail.append(back, modeBadge(topic.mode), element('h1', '', String(topic.title || `${meta.label} 배틀`)));
  const image = topicImageElement(topic, 'topic-detail-image');
  if (image) detail.append(image);
  detail.append(
    element('p', 'topic-prompt battle-prompt', String(topic.displayPrompt || '')),
    element('div', 'battle-rule-note', `규칙: ${meta.short}`),
    element('p', 'topic-author', `판주 ${String(topic.nickname || '익명 드리퍼')} · 출전 ${comments.length}명`),
    commentComposer(topicId, topic.mode)
  );

  const section = element('section', 'section-block');
  const heading = sectionHeading('CROWD RANKING', '현재 반응 순위');
  heading.append(element('span', '', `${comments.length}개`));
  section.append(heading);
  if (comments.length) {
    const list = element('div', 'comment-list');
    list.replaceChildren(...comments.map((comment, index) => commentCard(topicId, comment, index)));
    section.append(list);
  } else {
    section.append(element('div', 'empty-card', '아직 출전작이 없습니다. 첫 한마디를 남겨주세요.'));
  }
  app.replaceChildren(detail, section);
}

function applyModeForm(mode) {
  const selected = MODE_META[mode] ? mode : 'blank';
  battleMode.value = selected;
  const meta = MODE_META[selected];
  topicTitle.placeholder = meta.titlePlaceholder;
  topicPrompt.placeholder = meta.promptPlaceholder;
}

function syncTopicSubmitState() {
  topicSubmit.disabled = imageProcessing || topicSubmitting;
  topicSubmit.textContent = imageProcessing
    ? '사진 처리 중…'
    : (topicSubmitting ? '배틀 여는 중…' : '배틀 열기');
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

async function compressTopicImage(file) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error('JPG, PNG, WEBP 사진만 첨부할 수 있습니다.');
  if (file.size > MAX_SOURCE_IMAGE_BYTES) throw new Error('원본 사진은 12MB 이하만 첨부할 수 있습니다.');
  const source = await loadImage(await readFileAsDataUrl(file));
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
    const dataUrl = await readFileAsDataUrl(blob);
    if (version !== imageSelectionVersion) return;
    selectedImageDataUrl = dataUrl;
    topicImagePreviewImg.src = dataUrl;
    topicImagePreview.hidden = false;
    setImageStatus(`사진 준비 완료 · 약 ${Math.max(1, Math.round(blob.size / 1024))}KB`);
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

function openDialog(mode = 'blank') {
  if (!isAccountUser()) {
    showToast('판결소 계정으로 로그인한 뒤 배틀을 열 수 있습니다.');
    return;
  }
  applyModeForm(mode);
  topicDialog.showModal();
  window.setTimeout(() => topicTitle.focus(), 20);
}

async function renderRoute() {
  const route = currentRoute();
  renderLoading();
  try {
    if (route.name === 'home') await renderHome();
    else if (route.name === 'browse') await renderBrowse();
    else if (route.name === 'mode') await renderBrowse(route.mode);
    else if (route.name === 'popular') await renderPopular();
    else if (route.name === 'hall') await renderHall();
    else if (route.name === 'topic') await renderTopic(route.id);
    else if (route.name === 'create') {
      await renderBrowse();
      openDialog('blank');
    }
    app.focus({ preventScroll: true });
  } catch (error) {
    console.error('Dripso battle render failed:', error);
    renderError(errorMessage(error, '드립 배틀을 불러오지 못했습니다.'));
  }
}

app.addEventListener('click', async event => {
  const dialogButton = event.target.closest('[data-open-dialog]');
  if (dialogButton) {
    openDialog(dialogButton.dataset.openDialog || 'blank');
    return;
  }
  const likeButton = event.target.closest('[data-like][data-topic]');
  if (!likeButton) return;
  if (!isAccountUser()) {
    showToast('로그인 후 반응을 남길 수 있습니다.');
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
    likeButton.textContent = `❤️ 반응 ${count}`;
    topicsCache = null;
  } catch (error) {
    showToast(errorMessage(error, '반응 처리에 실패했습니다.'));
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
    showToast('출전작을 2자 이상 입력해 주세요.');
    return;
  }
  submit.disabled = true;
  try {
    await addComment({ topicId: form.dataset.commentForm, text });
    topicsCache = null;
    showToast('출전 완료. 현재 순위에 반영했습니다.');
    await renderTopic(form.dataset.commentForm);
  } catch (error) {
    showToast(errorMessage(error, '출전에 실패했습니다.'));
  } finally {
    submit.disabled = false;
  }
});

topicForm.addEventListener('submit', async event => {
  event.preventDefault();
  const mode = MODE_META[battleMode.value] ? battleMode.value : 'blank';
  const title = topicTitle.value.trim();
  const prompt = topicPrompt.value.trim();
  if (title.length < 2 || prompt.length < 4) {
    showToast('제목과 문제를 조금 더 입력해 주세요.');
    return;
  }
  if (imageProcessing) {
    showToast('사진 처리가 끝난 뒤 등록해 주세요.');
    return;
  }
  topicSubmitting = true;
  syncTopicSubmitState();
  try {
    const response = await createTopic({
      type: mode === 'naming' ? 'naming' : 'situation',
      title,
      prompt: encodedPrompt(mode, prompt),
      imageDataUrl: selectedImageDataUrl
    });
    const topicId = String(response.data?.topicId || '');
    topicsCache = null;
    topicForm.reset();
    applyModeForm('blank');
    clearSelectedImage();
    topicDialog.close();
    showToast('새 드립 배틀을 열었습니다.');
    location.hash = `#/topic/${topicId}`;
  } catch (error) {
    showToast(errorMessage(error, '배틀 등록에 실패했습니다.'));
  } finally {
    topicSubmitting = false;
    syncTopicSubmitState();
  }
});

battleMode.addEventListener('change', () => applyModeForm(battleMode.value));
topicImage.addEventListener('change', () => void handleTopicImageSelection());
removeTopicImageButton.addEventListener('click', clearSelectedImage);
openTopicDialogButton.addEventListener('click', () => openDialog('blank'));
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

applyModeForm('blank');
syncTopicSubmitState();
await initAuth().catch(error => console.warn('Dripso auth init failed:', error));
await renderRoute();
