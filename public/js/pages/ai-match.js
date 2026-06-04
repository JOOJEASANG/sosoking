import { navigate } from '../router.js';
import { auth, functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { toast } from '../components/toast.js';
import { setMeta } from '../utils/seo.js';
import { isQuotaError, showAiLadderBonus } from '../ai-ladder-bonus.js';

function esc(v) {
  return String(v || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function makeImgUpload(prefix, label) {
  return `
    <div>
      <label class="ai-king-form__label">${label}</label>
      <input id="${prefix}-text" class="form-input" type="text" maxlength="100" placeholder="이름이나 설명을 적어주세요">
      <div class="match-img-box" id="${prefix}-box">
        <input type="file" id="${prefix}-file" accept="image/*" style="display:none">
        <div class="match-img-placeholder" id="${prefix}-ph">
          <span class="match-img-placeholder__icon">📷</span>
          <span class="match-img-placeholder__label">사진 추가 (선택)</span>
        </div>
        <img id="${prefix}-img" class="match-img-draggable" alt="" draggable="false">
        <button type="button" class="match-img-remove" id="${prefix}-rm">✕</button>
      </div>
      <div class="match-img-hint" id="${prefix}-hint">✋ 드래그로 위치 조정</div>
    </div>`;
}

function capturePositioned(store) {
  if (!store.hasImage || !store.imgEl) return null;
  const OUT = 512;
  const canvas = document.createElement('canvas');
  canvas.width = OUT;
  canvas.height = OUT;
  const ctx = canvas.getContext('2d');
  const s = OUT / store.boxSize;
  const drawX = (store.boxSize - store.dw) / 2 + store.ox;
  const drawY = (store.boxSize - store.dh) / 2 + store.oy;
  ctx.drawImage(store.imgEl, drawX * s, drawY * s, store.dw * s, store.dh * s);
  return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
}

function setupImgUpload(prefix, store) {
  const box  = document.getElementById(`${prefix}-box`);
  const file = document.getElementById(`${prefix}-file`);
  const ph   = document.getElementById(`${prefix}-ph`);
  const img  = document.getElementById(`${prefix}-img`);
  const rm   = document.getElementById(`${prefix}-rm`);
  const hint = document.getElementById(`${prefix}-hint`);

  Object.assign(store, { hasImage: false, imgEl: null, dw: 0, dh: 0, ox: 0, oy: 0, boxSize: 140, blobUrl: null });

  function applyOffset(ox, oy) {
    const hx = Math.max(0, (store.dw - store.boxSize) / 2);
    const hy = Math.max(0, (store.dh - store.boxSize) / 2);
    store.ox = Math.max(-hx, Math.min(hx, ox));
    store.oy = Math.max(-hy, Math.min(hy, oy));
    img.style.transform = `translate(calc(-50% + ${store.ox}px), calc(-50% + ${store.oy}px))`;
  }

  function showImage(imgEl, blobUrl) {
    store.boxSize = box.offsetWidth || 140;
    const scale = Math.max(store.boxSize / imgEl.naturalWidth, store.boxSize / imgEl.naturalHeight);
    store.imgEl  = imgEl;
    store.dw     = Math.round(imgEl.naturalWidth  * scale);
    store.dh     = Math.round(imgEl.naturalHeight * scale);
    store.ox = 0; store.oy = 0;
    if (store.blobUrl) URL.revokeObjectURL(store.blobUrl);
    store.blobUrl = blobUrl;
    store.hasImage = true;

    img.src = blobUrl;
    img.style.width  = store.dw + 'px';
    img.style.height = store.dh + 'px';
    img.style.display = 'block';
    img.style.transform = 'translate(-50%, -50%)';

    ph.style.display   = 'none';
    rm.style.display   = 'flex';
    hint.style.display = 'block';
    box.classList.add('match-img-box--has-image');
  }

  function clearImage() {
    store.hasImage = false;
    store.imgEl = null;
    store.ox = 0; store.oy = 0;
    if (store.blobUrl) { URL.revokeObjectURL(store.blobUrl); store.blobUrl = null; }
    img.style.display = 'none';
    rm.style.display  = 'none';
    hint.style.display = 'none';
    ph.style.display  = 'flex';
    box.classList.remove('match-img-box--has-image');
    file.value = '';
  }

  box.addEventListener('click', (e) => {
    if (e.target === rm) return;
    if (!store.hasImage) file.click();
  });

  file.addEventListener('change', () => {
    const f = file.files[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { toast.warn('이미지 파일만 첨부할 수 있어요'); file.value = ''; return; }
    const url = URL.createObjectURL(f);
    const el  = new Image();
    el.onload  = () => showImage(el, url);
    el.onerror = () => { URL.revokeObjectURL(url); toast.warn('이미지를 불러올 수 없어요. 다른 사진을 써주세요'); file.value = ''; };
    el.src = url;
  });

  rm.addEventListener('click', (e) => { e.stopPropagation(); clearImage(); });

  let dragging = false, px = 0, py = 0;

  box.addEventListener('mousedown', (e) => {
    if (!store.hasImage || e.target === rm) return;
    dragging = true;
    px = e.clientX; py = e.clientY;
    box.style.cursor = 'grabbing';
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    applyOffset(store.ox + e.clientX - px, store.oy + e.clientY - py);
    px = e.clientX; py = e.clientY;
  });
  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    if (store.hasImage) box.style.cursor = 'grab';
  });

  box.addEventListener('touchstart', (e) => {
    if (!store.hasImage || e.target === rm) return;
    dragging = true;
    px = e.touches[0].clientX; py = e.touches[0].clientY;
    e.preventDefault();
  }, { passive: false });
  box.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    applyOffset(store.ox + e.touches[0].clientX - px, store.oy + e.touches[0].clientY - py);
    px = e.touches[0].clientX; py = e.touches[0].clientY;
    e.preventDefault();
  }, { passive: false });
  box.addEventListener('touchend',   () => { dragging = false; });
  box.addEventListener('touchcancel', () => { dragging = false; });
}

const CHARS = [
  { id: 'kimdonmu', label: '🇰🇵 김동무',  sub: '혁명적 궁합' },
  { id: 'tanaka',   label: '🇯🇵 다나카씨', sub: '사죄하며 점봐' },
  { id: 'marcel',   label: '🇫🇷 마르셀',  sub: '철학적 분석' },
  { id: 'ipanseo',  label: '📜 이판서',   sub: '사주 풀이' },
  { id: 'dmitri',   label: '🇷🇺 드미트리', sub: '흑백 판정' },
];

function charSectionHtml(prefix, titleLabel) {
  return `
    <div class="ai-char-header">
      <label class="ai-king-form__label" style="margin-bottom:0">${titleLabel} <span style="font-weight:400;font-size:11px;color:var(--color-text-muted)">(최대 3명)</span></label>
      <button class="ai-char-random-btn" id="${prefix}-random-btn" type="button">🎲 랜덤 3인</button>
    </div>
    <div class="ai-char-grid" id="${prefix}-char-grid">
      ${CHARS.map(c => `<button class="ai-char-btn" data-id="${c.id}" type="button">
        <span class="ai-char-btn__emoji">${c.label.split(' ')[0]}</span>
        <span class="ai-char-btn__name">${c.label.split(' ').slice(1).join(' ')}</span>
        <span class="ai-char-btn__sub">${c.sub}</span>
      </button>`).join('')}
    </div>
    <div class="ai-char-hint" id="${prefix}-char-hint">미선택 시 자동으로 랜덤 3인이 출동합니다</div>`;
}

function fill3(selectedSet) {
  if (selectedSet.size >= 3) return [...selectedSet].slice(0, 3);
  const rest = CHARS.map(c => c.id).filter(id => !selectedSet.has(id)).sort(() => Math.random() - 0.5);
  return [...selectedSet, ...rest].slice(0, 3);
}

function bindCharSection(prefix, selectedSet) {
  document.querySelectorAll(`#${prefix}-char-grid .ai-char-btn`).forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      if (selectedSet.has(id)) {
        selectedSet.delete(id);
        btn.classList.remove('active');
      } else {
        if (selectedSet.size >= 3) { toast.warn('최대 3명까지 선택할 수 있어요'); return; }
        selectedSet.add(id);
        btn.classList.add('active');
      }
      updateHint(prefix, selectedSet);
    });
  });

  document.getElementById(`${prefix}-random-btn`)?.addEventListener('click', () => {
    selectedSet.clear();
    document.querySelectorAll(`#${prefix}-char-grid .ai-char-btn`).forEach(b => b.classList.remove('active'));
    const picked = CHARS.map(c => c.id).sort(() => Math.random() - 0.5).slice(0, 3);
    picked.forEach(id => {
      selectedSet.add(id);
      document.querySelector(`#${prefix}-char-grid .ai-char-btn[data-id="${id}"]`)?.classList.add('active');
    });
    updateHint(prefix, selectedSet);
  });
}

function updateHint(prefix, selectedSet) {
  const hint = document.getElementById(`${prefix}-char-hint`);
  if (!hint) return;
  if (selectedSet.size === 0) { hint.textContent = '미선택 시 자동으로 랜덤 3인이 출동합니다'; return; }
  const names = CHARS.filter(c => selectedSet.has(c.id)).map(c => c.label.split(' ').slice(1).join(' ')).join(' · ');
  hint.textContent = selectedSet.size < 3
    ? `✅ ${names} 선택 · ${3 - selectedSet.size}명 더 추가하거나 그냥 제출하세요`
    : `✅ ${names} — 준비 완료!`;
}

export function renderAiMatch() {
  setMeta('궁합소');
  const el = document.getElementById('page-content');
  if (!auth.currentUser) { navigate('/login'); return; }

  const selectedChars = new Set();

  el.innerHTML = `
    <div class="ai-king-page">
      <div class="ai-king-header">
        <button class="btn btn--ghost btn--sm" id="btn-back" style="margin-bottom:12px">← 뒤로</button>
        <div class="ai-king-header__title">💘 궁합소</div>
        <div class="ai-king-header__sub">두 가지를 입력하면 캐릭터가 궁합을 봐드립니다<br>사람, 음식, 물건, 동물 뭐든 OK</div>
      </div>
      <div class="ai-king-form">
        ${charSectionHtml('match', '점쟁이 선택')}
        <div style="font-size:12px;color:var(--color-text-muted);margin:14px 0;text-align:center">
          사람, 음식, 동물, 물건, 개념 — 뭐든 두 가지를 골라보세요<br>
          <span style="color:var(--color-primary);font-weight:700">예) 나 + 우리팀장 / 치킨 + 피자 / MBTI I형 + E형</span>
        </div>
        <div class="ai-match-grid">${makeImgUpload('item-a', '첫 번째')}${makeImgUpload('item-b', '두 번째')}</div>
        <div class="ai-match-vs" style="margin:14px 0">💘 VS 💘</div>
        <button id="btn-match-submit" class="btn btn--primary btn--full" style="font-size:16px;font-weight:800">💘 3인 궁합 보기</button>
        <div style="font-size:11px;color:var(--color-text-muted);text-align:center;margin-top:8px">하루 ${parseInt(sessionStorage.getItem('sosoking:aiDailyLimit') || '3')}번 무료 · 소진 시 하루 1회 사다리게임 보너스</div>
      </div>
    </div>`;

  document.getElementById('btn-back')?.addEventListener('click', () => navigate('/ai-king'));

  bindCharSection('match', selectedChars);

  const imgA = {};
  const imgB = {};
  setupImgUpload('item-a', imgA);
  setupImgUpload('item-b', imgB);

  document.getElementById('btn-match-submit')?.addEventListener('click', async () => {
    const itemA = document.getElementById('item-a-text')?.value.trim();
    const itemB = document.getElementById('item-b-text')?.value.trim();
    if (!itemA || !itemB) { toast.warn('두 가지를 모두 입력해주세요'); return; }
    const characterIds = fill3(selectedChars);
    const charLabel = CHARS.filter(c => characterIds.includes(c.id)).map(c => c.label.split(' ').slice(1).join(' ')).join(' · ');
    const base64A = capturePositioned(imgA);
    const base64B = capturePositioned(imgB);
    el.innerHTML = `<div class="ai-king-page"><div class="ai-king-loading"><div class="spinner spinner--lg"></div><div class="ai-king-loading__text">💘 3인 궁합 분석 중...</div><div class="ai-king-loading__sub">${charLabel} 출동 완료 ✅<br>"${esc(itemA)}" + "${esc(itemB)}"</div></div></div>`;
    try {
      const fn = httpsCallable(functions, 'aiMatch');
      const result = await fn({ itemA, itemB, imageA: base64A, imageB: base64B, characterIds });
      navigate(`/detail/${result.data.postId}`);
    } catch (e) {
      if (isQuotaError(e)) {
        showAiLadderBonus({ feature: 'match', featureLabel: '궁합소', onReplay: renderAiMatch });
        return;
      }
      toast.error(e?.message || '궁합 보기에 실패했어요');
      renderAiMatch();
    }
  });
}
