import { navigate } from '../router.js';
import { auth, functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { toast } from '../components/toast.js';
import { setMeta } from '../utils/seo.js';

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
  { id: 'north', label: '🇰🇵 북한말' },
  { id: 'busan', label: '🌊 부산 사투리' },
  { id: 'jolla', label: '🌾 전라도 사투리' },
  { id: 'chungcheong', label: '🐢 충청도 사투리' },
  { id: 'joseon', label: '📜 조선시대' },
  { id: 'boomer', label: '👔 꼰대체' },
  { id: 'teen', label: '🎮 급식체' },
];

export function renderAiTranslate() {
  setMeta('미친번역사');
  const el = document.getElementById('page-content');
  if (!auth.currentUser) { navigate('/login'); return; }

  let selectedStyle = 'north';

  el.innerHTML = `
    <div class="ai-king-page">
      <div class="ai-king-header">
        <button class="btn btn--ghost btn--sm" id="btn-back" style="margin-bottom:12px">← 뒤로</button>
        <div class="ai-king-header__title">🌍 미친번역사</div>
        <div class="ai-king-header__sub">어떤 텍스트든 원하는 말투로 번역해드립니다</div>
      </div>
      <div class="ai-king-form">
        <label class="ai-king-form__label">번역 스타일 선택 *</label>
        <div class="ai-style-grid">
          ${STYLES.map(s => `
            <button class="ai-style-btn${s.id === selectedStyle ? ' active' : ''}" data-style="${s.id}">${s.label}</button>
          `).join('')}
        </div>

        <label class="ai-king-form__label" style="margin-top:20px">번역할 텍스트 *</label>
        <textarea id="translate-input" class="ai-king-form__textarea" maxlength="500"
          placeholder="번역할 텍스트를 입력하세요. 뭐든 됩니다!&#10;예) 오늘 밥 먹었어? 나 배고파 죽겠어."></textarea>
        <div class="ai-king-form__charcount"><span id="translate-count">0</span>/500</div>

        <label class="ai-king-form__label" style="margin-top:16px">📷 이미지 첨부 (선택)</label>
        <div class="ai-king-img-upload" id="translate-img-area">
          <input type="file" id="translate-img-input" accept="image/*" style="display:none">
          <div class="ai-king-img-upload__label">📎 클릭하여 이미지 추가<br><small>사진 속 텍스트는 물론 이미지 상황 자체도 번역해요</small></div>
          <img id="translate-img-preview" class="ai-king-img-upload__preview" alt="">
          <div id="translate-img-remove" class="ai-king-img-upload__remove">✕ 사진 제거</div>
        </div>

        <button id="btn-translate-submit" class="btn btn--primary btn--full" style="margin-top:20px;font-size:16px;font-weight:800">
          🌍 번역하기
        </button>
        <div style="font-size:11px;color:var(--color-text-muted);text-align:center;margin-top:8px">하루 3번 무료</div>
      </div>
    </div>`;

  document.getElementById('btn-back')?.addEventListener('click', () => navigate('/ai-king'));

  const textarea = document.getElementById('translate-input');
  textarea.addEventListener('input', () => {
    document.getElementById('translate-count').textContent = textarea.value.length;
  });

  el.querySelectorAll('.ai-style-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedStyle = btn.dataset.style;
      el.querySelectorAll('.ai-style-btn').forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  let imageBase64 = null;
  const imgArea = document.getElementById('translate-img-area');
  const imgInput = document.getElementById('translate-img-input');
  const imgPreview = document.getElementById('translate-img-preview');
  const imgRemove = document.getElementById('translate-img-remove');

  imgArea.addEventListener('click', (e) => { if (e.target !== imgRemove) imgInput.click(); });
  imgInput.addEventListener('change', async () => {
    const file = imgInput.files[0];
    if (!file) return;
    imageBase64 = await resizeImageToBase64(file);
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

    el.innerHTML = `
      <div class="ai-king-page">
        <div class="ai-king-loading">
          <div class="spinner spinner--lg"></div>
          <div class="ai-king-loading__text">🌍 번역사가 열심히 번역 중...</div>
          <div class="ai-king-loading__sub">${styleName} 전문 번역사 투입 완료 ✅</div>
        </div>
      </div>`;

    try {
      const fn = httpsCallable(functions, 'aiTranslate');
      const result = await fn({ text, style: selectedStyle, imageBase64 });
      navigate(`/detail/${result.data.postId}`);
    } catch (e) {
      const msg = e?.message || '번역에 실패했어요';
      toast.error(msg.includes('resource-exhausted') ? '오늘 번역 횟수를 모두 사용했어요 (하루 3회)' : msg);
      renderAiTranslate();
    }
  });
}
