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
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
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
  '친구가 내 치킨을 허락도 없이 먹었는데 맛없다고 했음. 유죄?',
  '카톡 읽씹 3일째인데 갑자기 "ㅋ" 하나 보냄. 이게 맞나요?',
  '3년 사귄 연인이 생일 선물로 양말 줌. 이건 고의인가요?',
  '회의 때 내 아이디어 발표했더니 팀장이 "나도 그 생각 했었는데" 라고 함',
  '샤워하고 나왔더니 자리 뺏김. 1분도 안 됐는데 이게 정당한가요?',
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

export function renderAiJudge() {
  setMeta('판결소');
  const el = document.getElementById('page-content');
  if (!auth.currentUser) { navigate('/login'); return; }

  el.innerHTML = `
    <div class="ai-king-page">
      <div class="ai-king-header">
        <button class="btn btn--ghost btn--sm" id="btn-back" style="margin-bottom:12px">← 뒤로</button>
        <div class="ai-king-header__title">⚖️ 판결소</div>
        <div class="ai-king-header__sub">억울한 상황을 적으면 최대 3인의 캐릭터가 각자 판결합니다</div>
      </div>
      <div class="ai-king-form">
        <label class="ai-king-form__label">판결 받을 상황을 적어주세요 *</label>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
          ${EXAMPLES.map((ex, i) => `<button class="ai-example-chip" data-ex="${i}" type="button">${ex.slice(0, 20)}...</button>`).join('')}
        </div>
        <textarea id="situation-input" class="ai-king-form__textarea" maxlength="500"
          placeholder="예) 친구가 내 치킨을 허락도 없이 먹었는데 맛없다고 했습니다. 이건 무죄인가요 유죄인가요?&#10;&#10;억울한 상황을 최대한 자세히 적을수록 더 재밌는 판결이 나옵니다 ㅋㅋ"></textarea>
        <div class="ai-king-form__charcount"><span id="situation-count">0</span>/500</div>

        ${charSectionHtml('judge', '판사 선택')}

        <label class="ai-king-form__label" style="margin-top:20px">📷 증거 사진 첨부 (선택)</label>
        <div class="ai-king-img-upload" id="judge-img-area">
          <input type="file" id="judge-img-input" accept="image/*" style="display:none">
          <div class="ai-king-img-upload__label">📎 클릭하여 증거 사진 추가<br><small>카톡 캡처, 현장 사진 등 — 사진이 있으면 판결이 더 생생해요</small></div>
          <img id="judge-img-preview" class="ai-king-img-upload__preview" alt="">
          <div id="judge-img-remove" class="ai-king-img-upload__remove">✕ 사진 제거</div>
        </div>

        <button id="btn-judge-submit" class="btn btn--primary btn--full" style="margin-top:20px;font-size:16px;font-weight:800">⚖️ 3인 판결 받기</button>
        <div style="font-size:11px;color:var(--color-text-muted);text-align:center;margin-top:8px">하루 ${parseInt(sessionStorage.getItem('sosoking:aiDailyLimit') || '3')}번 무료 · 소진 시 하루 1회 사다리게임 보너스</div>
      </div>
    </div>`;

  document.getElementById('btn-back')?.addEventListener('click', () => navigate('/ai-king'));

  const textarea = document.getElementById('situation-input');
  const count = document.getElementById('situation-count');
  textarea.addEventListener('input', () => { count.textContent = textarea.value.length; });

  // 배틀 페이지에서 이슈 주제를 갖고 올 경우 자동 채우기
  const qParams = new URLSearchParams(window.location.hash.slice(1).split('?')[1] || '');
  const prefill = qParams.get('topic');
  if (prefill) {
    textarea.value = `[오늘의 정치 배틀 이슈] "${decodeURIComponent(prefill)}" — 이 사건의 잘잘못을 판결해주세요!`;
    count.textContent = textarea.value.length;
    textarea.focus();
  }

  el.querySelectorAll('.ai-example-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      textarea.value = EXAMPLES[Number(chip.dataset.ex)];
      count.textContent = textarea.value.length;
      textarea.focus();
    });
  });

  const selectedChars = new Set();
  bindCharSection('judge', selectedChars);

  let imageBase64 = null;
  const imgArea = document.getElementById('judge-img-area');
  const imgInput = document.getElementById('judge-img-input');
  const imgPreview = document.getElementById('judge-img-preview');
  const imgRemove = document.getElementById('judge-img-remove');
  imgArea.addEventListener('click', (e) => { if (e.target !== imgRemove) imgInput.click(); });
  imgInput.addEventListener('change', async () => {
    const file = imgInput.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.warn('이미지 파일만 첨부할 수 있어요'); imgInput.value = ''; return; }
    const b64 = await resizeImageToBase64(file);
    if (!b64) { toast.warn('이미지를 불러올 수 없어요. 다른 사진을 써주세요'); imgInput.value = ''; return; }
    imageBase64 = b64;
    imgPreview.src = `data:image/jpeg;base64,${imageBase64}`;
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

  document.getElementById('btn-judge-submit')?.addEventListener('click', async () => {
    const situation = textarea.value.trim();
    if (!situation || situation.length < 5) { toast.warn('상황을 5자 이상 적어주세요'); return; }

    const characterIds = fill3(selectedChars);
    const charLabel = CHARS.filter(c => characterIds.includes(c.id)).map(c => c.label.split(' ').slice(1).join(' ')).join(' · ');
    el.innerHTML = `<div class="ai-king-page"><div class="ai-king-loading"><div class="spinner spinner--lg"></div><div class="ai-king-loading__text">⚖️ 판사들이 심의 중입니다...</div><div class="ai-king-loading__sub">${charLabel} 출동 완료 🔍</div></div></div>`;

    try {
      const fn = httpsCallable(functions, 'aiJudge');
      const result = await fn({ situation, imageBase64, characterIds });
      navigate(`/detail/${result.data.postId}`);
    } catch (e) {
      if (isQuotaError(e)) {
        showAiLadderBonus({ feature: 'judge', featureLabel: '판결소', onReplay: renderAiJudge });
        return;
      }
      toast.error(e?.message || '판결에 실패했어요');
      renderAiJudge();
    }
  });
}
