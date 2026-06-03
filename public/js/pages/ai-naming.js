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

export function renderAiNaming() {
  setMeta('AI작명소');
  const el = document.getElementById('page-content');
  if (!auth.currentUser) { navigate('/login'); return; }

  el.innerHTML = `
    <div class="ai-king-page">
      <div class="ai-king-header">
        <button class="btn btn--ghost btn--sm" id="btn-back" style="margin-bottom:12px">← 뒤로</button>
        <div class="ai-king-header__title">🎭 AI작명소</div>
        <div class="ai-king-header__sub">사람, 음식, 동물, 물건 뭐든 — 설명하면 찰떡 이름 5개를 지어드립니다</div>
      </div>
      <div class="ai-king-form">
        <label class="ai-king-form__label">📷 사진 첨부 (선택)</label>
        <div class="ai-king-img-upload" id="naming-img-area">
          <input type="file" id="naming-img-input" accept="image/*" style="display:none">
          <div class="ai-king-img-upload__label">📷 사진 첨부 시 AI가 직접 보고 이름을 지어줘요<br><small>얼굴, 물건, 음식, 반려동물 사진 모두 인식 가능</small></div>
          <img id="naming-img-preview" class="ai-king-img-upload__preview" alt="">
          <div id="naming-img-remove" class="ai-king-img-upload__remove">✕ 사진 제거</div>
        </div>
        <label class="ai-king-form__label" id="naming-desc-label" style="margin-top:20px">이름 지을 대상 설명 *</label>
        <textarea id="naming-input" class="ai-king-form__textarea" maxlength="300" placeholder="예) 항상 회의 때 졸면서 딴소리하는 우리 팀장님&#10;예) 오늘 처음 만든 닭볶음탕인데 매운 듯 안 매운 듯 애매한 맛&#10;예) 뭘 물어봐도 글쎄요만 하는 친구&#10;(사진 첨부 시 설명 없이도 가능해요)"></textarea>
        <div class="ai-king-form__charcount"><span id="naming-count">0</span>/300</div>
        <button id="btn-naming-submit" class="btn btn--primary btn--full" style="margin-top:20px;font-size:16px;font-weight:800">🎭 이름 지어주기</button>
        <div style="font-size:11px;color:var(--color-text-muted);text-align:center;margin-top:8px">하루 ${parseInt(sessionStorage.getItem('sosoking:aiDailyLimit') || '3')}번 무료 · 소진 시 하루 1회 사다리게임 보너스</div>
      </div>
    </div>`;

  document.getElementById('btn-back')?.addEventListener('click', () => navigate('/ai-king'));
  const textarea = document.getElementById('naming-input');
  textarea.addEventListener('input', () => { document.getElementById('naming-count').textContent = textarea.value.length; });

  let imageBase64 = null;
  const imgArea = document.getElementById('naming-img-area');
  const imgInput = document.getElementById('naming-img-input');
  const imgPreview = document.getElementById('naming-img-preview');
  const imgRemove = document.getElementById('naming-img-remove');
  const descLabel = document.getElementById('naming-desc-label');
  function updateDescLabel() { descLabel.textContent = imageBase64 ? '이름 지을 대상 설명 (선택)' : '이름 지을 대상 설명 *'; }
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
    updateDescLabel();
  });
  imgRemove.addEventListener('click', () => {
    imageBase64 = null;
    imgPreview.style.display = 'none';
    imgRemove.style.display = 'none';
    imgInput.value = '';
    imgArea.querySelector('.ai-king-img-upload__label').style.display = '';
    updateDescLabel();
  });

  document.getElementById('btn-naming-submit')?.addEventListener('click', async () => {
    const description = textarea.value.trim();
    if (!description && !imageBase64) { toast.warn('설명을 입력하거나 사진을 첨부해주세요'); return; }
    const btn = document.getElementById('btn-naming-submit');
    btn.disabled = true;
    btn.textContent = '이름 짓는 중...';
    el.innerHTML = `<div class="ai-king-page"><div class="ai-king-loading"><div class="spinner spinner--lg"></div><div class="ai-king-loading__text">🎭 AI 작명가가 고민 중...</div><div class="ai-king-loading__sub">세상에서 제일 웃긴 이름을 생각하는 중 💭</div></div></div>`;
    try {
      const fn = httpsCallable(functions, 'aiNaming');
      const result = await fn({ description, imageBase64 });
      navigate(`/detail/${result.data.postId}`);
    } catch (e) {
      if (isQuotaError(e)) {
        showAiLadderBonus({ feature: 'naming', featureLabel: 'AI작명소', onReplay: renderAiNaming });
        return;
      }
      toast.error(e?.message || '작명에 실패했어요');
      renderAiNaming();
    }
  });
}
