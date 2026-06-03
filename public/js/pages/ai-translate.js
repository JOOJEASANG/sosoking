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

const STYLES = [
  { id: 'gyeongsang',  label: '🔥 경상도 사투리' },
  { id: 'jolla',       label: '🌾 전라도 사투리' },
  { id: 'chungcheong', label: '🐢 충청도 사투리' },
  { id: 'yeonbyeon',   label: '🗺️ 연변 사투리' },
];

export function renderAiTranslate() {
  setMeta('사투리번역사');
  const el = document.getElementById('page-content');
  if (!auth.currentUser) { navigate('/login'); return; }
  let selectedStyle = 'gyeongsang';

  el.innerHTML = `
    <div class="ai-king-page">
      <div class="ai-king-header">
        <button class="btn btn--ghost btn--sm" id="btn-back" style="margin-bottom:12px">← 뒤로</button>
        <div class="ai-king-header__title">🌍 사투리번역사</div>
        <div class="ai-king-header__sub">어떤 텍스트든 진짜 사투리로 번역해드립니다</div>
      </div>
      <div class="ai-king-form">
        <label class="ai-king-form__label">사투리 선택 *</label>
        <div class="ai-style-grid">${STYLES.map(s => `<button class="ai-style-btn${s.id === selectedStyle ? ' active' : ''}" data-style="${s.id}">${s.label}</button>`).join('')}</div>
        <label class="ai-king-form__label" style="margin-top:20px">번역할 텍스트 *</label>
        <textarea id="translate-input" class="ai-king-form__textarea" maxlength="500" placeholder="번역할 텍스트를 입력하세요.&#10;예) 오늘 밥 먹었어? 나 배고파 죽겠어.&#10;예) 회의 언제 끝나요? 할 일이 산더미예요."></textarea>
        <div class="ai-king-form__charcount"><span id="translate-count">0</span>/500</div>
        <label class="ai-king-form__label" style="margin-top:16px">📷 이미지 첨부 (선택)</label>
        <div class="ai-king-img-upload" id="translate-img-area">
          <input type="file" id="translate-img-input" accept="image/*" style="display:none">
          <div class="ai-king-img-upload__label">📎 클릭하여 이미지 추가<br><small>사진 속 텍스트나 상황도 함께 번역해요</small></div>
          <img id="translate-img-preview" class="ai-king-img-upload__preview" alt="">
          <div id="translate-img-remove" class="ai-king-img-upload__remove">✕ 사진 제거</div>
        </div>
        <button id="btn-translate-submit" class="btn btn--primary btn--full" style="margin-top:20px;font-size:16px;font-weight:800">🌍 사투리로 번역하기</button>
        <div style="font-size:11px;color:var(--color-text-muted);text-align:center;margin-top:8px">하루 ${parseInt(sessionStorage.getItem('sosoking:aiDailyLimit') || '3')}번 무료 · 소진 시 하루 1회 사다리게임 보너스</div>
      </div>
    </div>`;

  document.getElementById('btn-back')?.addEventListener('click', () => navigate('/ai-king'));
  const textarea = document.getElementById('translate-input');
  textarea.addEventListener('input', () => { document.getElementById('translate-count').textContent = textarea.value.length; });
  el.querySelectorAll('.ai-style-btn').forEach(btn => btn.addEventListener('click', () => {
    selectedStyle = btn.dataset.style;
    el.querySelectorAll('.ai-style-btn').forEach(b => b.classList.toggle('active', b === btn));
  }));

  let imageBase64 = null;
  const imgArea = document.getElementById('translate-img-area');
  const imgInput = document.getElementById('translate-img-input');
  const imgPreview = document.getElementById('translate-img-preview');
  const imgRemove = document.getElementById('translate-img-remove');
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

  document.getElementById('btn-translate-submit')?.addEventListener('click', async () => {
    const text = textarea.value.trim();
    if (!text || text.length < 2) { toast.warn('번역할 텍스트를 입력해주세요'); return; }
    const btn = document.getElementById('btn-translate-submit');
    btn.disabled = true;
    const styleName = STYLES.find(s => s.id === selectedStyle)?.label || '';
    btn.textContent = `${styleName}로 번역 중...`;
    el.innerHTML = `<div class="ai-king-page"><div class="ai-king-loading"><div class="spinner spinner--lg"></div><div class="ai-king-loading__text">🌍 사투리 번역 중...</div><div class="ai-king-loading__sub">${styleName} 전문 번역사 투입 완료 ✅</div></div></div>`;
    try {
      const fn = httpsCallable(functions, 'aiTranslate');
      const result = await fn({ text, style: selectedStyle, imageBase64 });
      navigate(`/detail/${result.data.postId}`);
    } catch (e) {
      if (isQuotaError(e)) {
        showAiLadderBonus({ feature: 'translate', featureLabel: '사투리번역사', onReplay: renderAiTranslate });
        return;
      }
      toast.error(e?.message || '번역에 실패했어요');
      renderAiTranslate();
    }
  });
}
