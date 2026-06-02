import { navigate } from '../router.js';
import { auth, functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { toast } from '../components/toast.js';
import { setMeta } from '../utils/seo.js';
import { isQuotaError, showAiLadderBonus } from '../ai-ladder-bonus.js';

function resizeImageToBase64(file, maxPx = 512) {
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

function makeImgUpload(prefix, label) {
  return `
    <div>
      <label class="ai-king-form__label">${label}</label>
      <input id="${prefix}-text" class="form-input" type="text" maxlength="100" placeholder="이름이나 설명을 적어주세요">
      <div class="ai-king-img-upload" id="${prefix}-img-area" style="margin-top:8px">
        <input type="file" id="${prefix}-img-input" accept="image/*" style="display:none">
        <div class="ai-king-img-upload__label" style="font-size:12px">📷 사진 (선택)</div>
        <img id="${prefix}-img-preview" class="ai-king-img-upload__preview" alt="">
        <div id="${prefix}-img-remove" class="ai-king-img-upload__remove">✕</div>
      </div>
    </div>`;
}

function setupImgUpload(prefix, store) {
  const area = document.getElementById(`${prefix}-img-area`);
  const input = document.getElementById(`${prefix}-img-input`);
  const preview = document.getElementById(`${prefix}-img-preview`);
  const remove = document.getElementById(`${prefix}-img-remove`);
  area.addEventListener('click', (e) => { if (e.target !== remove) input.click(); });
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    store.base64 = await resizeImageToBase64(file);
    preview.src = `data:image/jpeg;base64,${store.base64}`;
    preview.style.display = 'block';
    remove.style.display = 'block';
    area.querySelector('.ai-king-img-upload__label').style.display = 'none';
  });
  remove.addEventListener('click', () => {
    store.base64 = null;
    preview.style.display = 'none';
    remove.style.display = 'none';
    input.value = '';
    area.querySelector('.ai-king-img-upload__label').style.display = '';
  });
}

export function renderAiMatch() {
  setMeta('AI궁합');
  const el = document.getElementById('page-content');
  if (!auth.currentUser) { navigate('/login'); return; }

  el.innerHTML = `
    <div class="ai-king-page">
      <div class="ai-king-header">
        <button class="btn btn--ghost btn--sm" id="btn-back" style="margin-bottom:12px">← 뒤로</button>
        <div class="ai-king-header__title">💘 AI궁합</div>
        <div class="ai-king-header__sub">두 가지를 입력하면 AI가 궁합을 봐드립니다<br>사람, 음식, 물건, 동물 뭐든 OK</div>
      </div>
      <div class="ai-king-form">
        <div style="font-size:12px;color:var(--color-text-muted);margin-bottom:14px;text-align:center">
          사람, 음식, 동물, 물건, 개념 — 뭐든 두 가지를 골라보세요<br>
          <span style="color:var(--color-primary);font-weight:700">예) 나 + 우리팀장 / 치킨 + 피자 / MBTI I형 + E형</span>
        </div>
        <div class="ai-match-grid">${makeImgUpload('item-a', '첫 번째')}${makeImgUpload('item-b', '두 번째')}</div>
        <div class="ai-match-vs" style="margin:14px 0">💘 VS 💘</div>
        <button id="btn-match-submit" class="btn btn--primary btn--full" style="font-size:16px;font-weight:800">💘 궁합 보기</button>
        <div style="font-size:11px;color:var(--color-text-muted);text-align:center;margin-top:8px">하루 3번 무료 · 소진 시 하루 1회 사다리게임 보너스</div>
      </div>
    </div>`;

  document.getElementById('btn-back')?.addEventListener('click', () => navigate('/ai-king'));
  const imgA = { base64: null };
  const imgB = { base64: null };
  setupImgUpload('item-a', imgA);
  setupImgUpload('item-b', imgB);

  document.getElementById('btn-match-submit')?.addEventListener('click', async () => {
    const itemA = document.getElementById('item-a-text')?.value.trim();
    const itemB = document.getElementById('item-b-text')?.value.trim();
    if (!itemA || !itemB) { toast.warn('두 가지를 모두 입력해주세요'); return; }
    const btn = document.getElementById('btn-match-submit');
    btn.disabled = true;
    btn.textContent = '궁합 보는 중...';
    el.innerHTML = `<div class="ai-king-page"><div class="ai-king-loading"><div class="spinner spinner--lg"></div><div class="ai-king-loading__text">💘 AI 점쟁이가 궁합을 보는 중...</div><div class="ai-king-loading__sub">"${itemA}" 와 "${itemB}"...</div></div></div>`;
    try {
      const fn = httpsCallable(functions, 'aiMatch');
      const result = await fn({ itemA, itemB, imageA: imgA.base64, imageB: imgB.base64 });
      navigate(`/detail/${result.data.postId}`);
    } catch (e) {
      if (isQuotaError(e)) {
        showAiLadderBonus({ feature: 'match', featureLabel: 'AI궁합', onReplay: renderAiMatch });
        return;
      }
      toast.error(e?.message || '궁합 보기에 실패했어요');
      renderAiMatch();
    }
  });
}
