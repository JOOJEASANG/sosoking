import { navigate } from '../router.js';
import { auth, functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { toast } from '../components/toast.js';
import { setMeta } from '../utils/seo.js';
import { isQuotaError, showAiLadderBonus } from '../ai-ladder-bonus.js';

function resizeImageToBase64(file, maxPx = 1024) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

const CHARS = [
  { id: 'jungding',  label: '🎒 사춘기 중딩', sub: '팩폭 직격' },
  { id: 'saibi',     label: '🙏 사이비 교주', sub: '포교·계시' },
  { id: 'prophet',   label: '🔮 예언가',      sub: '운명 예언' },
  { id: 'joojeob',   label: '🤩 주접러',      sub: '과잉 리액션' },
  { id: 'chamgyeon', label: '👀 참견러',      sub: '오지랖 만렙' },
  { id: 'kkondae',   label: '👴 꼰대',        sub: '우리때는~' },
];

const EXAMPLES = [
  '직장 동료가 내 아이디어를 자기 것처럼 발표했어요',
  '연락이 뜸한 친구에게 먼저 연락해야 할까요?',
  '회사 그만두고 싶은데 너무 겁이 나요',
  '다이어트 3일째인데 치킨이 먹고 싶어요',
  '팀장님이 회의때마다 내 말을 잘라요',
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

export function renderAiConsult() {
  setMeta('상담소');
  const el = document.getElementById('page-content');
  if (!auth.currentUser) { navigate('/login'); return; }

  let imageBase64 = null;

  el.innerHTML = `
    <div class="ai-king-page">
      <div class="ai-king-header">
        <button class="btn btn--ghost btn--sm" id="btn-back" style="margin-bottom:12px">← 뒤로</button>
        <div class="ai-king-header__title">💬 상담소</div>
        <div class="ai-king-header__sub">고민을 털어놓으면 황당하지만 의외로 맞는 조언을 드립니다</div>
      </div>
      <div class="ai-king-form">
        ${charSectionHtml('consult', '고민 상담사 선택')}

        <label class="ai-king-form__label" style="margin-top:20px">고민을 적어주세요 *</label>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
          ${EXAMPLES.map((ex, i) => `<button class="ai-example-chip" data-ex="${i}" type="button">${ex.slice(0, 18)}...</button>`).join('')}
        </div>
        <textarea id="concern-input" class="ai-king-form__textarea" maxlength="500"
          placeholder="예) 직장 동료가 내 아이디어를 자기 것처럼 발표했어요&#10;예) 연락이 뜸한 친구에게 먼저 연락해야 할까요?&#10;&#10;고민이 구체적일수록 더 웃기고 맞는 조언이 나옵니다"></textarea>
        <div class="ai-king-form__charcount"><span id="concern-count">0</span>/500</div>

        <label class="ai-king-form__label" style="margin-top:20px">📷 상황 사진 첨부 (선택)</label>
        <div class="ai-king-img-upload" id="consult-img-area">
          <input type="file" id="consult-img-input" accept="image/*" style="display:none">
          <div class="ai-king-img-upload__label">📎 카톡 캡처, 현장 사진 등<br><small>사진이 있으면 상황을 보고 더 정확하게 조언해줘요</small></div>
          <img id="consult-img-preview" class="ai-king-img-upload__preview" alt="">
          <div id="consult-img-remove" class="ai-king-img-upload__remove">✕ 사진 제거</div>
        </div>

        <button id="btn-consult-submit" class="btn btn--primary btn--full" style="margin-top:20px;font-size:16px;font-weight:800">💬 3인 상담받기</button>
        <div style="font-size:11px;color:var(--color-text-muted);text-align:center;margin-top:8px">하루 ${parseInt(sessionStorage.getItem('sosoking:aiDailyLimit') || '3')}번 무료 · 소진 시 하루 1회 사다리게임 보너스</div>
      </div>
    </div>`;

  document.getElementById('btn-back')?.addEventListener('click', () => navigate('/ai-king'));

  const textarea = document.getElementById('concern-input');
  const countEl = document.getElementById('concern-count');
  textarea.addEventListener('input', () => { countEl.textContent = textarea.value.length; });

  el.querySelectorAll('.ai-example-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      textarea.value = EXAMPLES[Number(chip.dataset.ex)];
      countEl.textContent = textarea.value.length;
      textarea.focus();
    });
  });

  const selectedChars = new Set();
  bindCharSection('consult', selectedChars);

  const imgArea = document.getElementById('consult-img-area');
  const imgInput = document.getElementById('consult-img-input');
  const imgPreview = document.getElementById('consult-img-preview');
  const imgRemove = document.getElementById('consult-img-remove');
  imgArea.addEventListener('click', (e) => { if (e.target !== imgRemove) imgInput.click(); });
  imgInput.addEventListener('change', async () => {
    const file = imgInput.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.warn('이미지 파일만 첨부할 수 있어요'); imgInput.value = ''; return; }
    const b64 = await resizeImageToBase64(file);
    if (!b64) { toast.warn('이미지를 불러올 수 없어요'); imgInput.value = ''; return; }
    imageBase64 = b64;
    imgPreview.src = `data:image/jpeg;base64,${b64}`;
    imgPreview.style.display = 'block';
    imgRemove.style.display = 'block';
    imgArea.querySelector('.ai-king-img-upload__label').style.display = 'none';
  });
  imgRemove.addEventListener('click', () => {
    imageBase64 = null;
    imgPreview.style.display = 'none';
    imgRemove.style.display = 'none';
    imgInput.value = '';
    imgArea.querySelector('.ai-king-img-upload__label').style.display = '';
  });

  document.getElementById('btn-consult-submit')?.addEventListener('click', async () => {
    const concern = textarea.value.trim();
    if (!concern || concern.length < 5) { toast.warn('고민을 5자 이상 적어주세요'); return; }

    const characterIds = fill3(selectedChars);
    const charLabel = CHARS.filter(c => characterIds.includes(c.id)).map(c => c.label.split(' ').slice(1).join(' ')).join(' · ');
    el.innerHTML = `<div class="ai-king-page"><div class="ai-king-loading"><div class="spinner spinner--lg"></div><div class="ai-king-loading__text">💬 3인 상담 진행 중...</div><div class="ai-king-loading__sub">${charLabel} 긴급 소환 완료 🧠</div></div></div>`;

    try {
      const fn = httpsCallable(functions, 'aiConsult');
      const result = await fn({ concern, selectedChars: characterIds, imageBase64 });
      navigate(`/detail/${result.data.postId}`);
    } catch (e) {
      if (isQuotaError(e)) {
        showAiLadderBonus({ feature: 'consult', featureLabel: '상담소', onReplay: renderAiConsult });
        return;
      }
      toast.error(e?.message || '상담에 실패했어요');
      renderAiConsult();
    }
  });
}
