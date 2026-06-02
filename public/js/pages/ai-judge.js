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

export function renderAiJudge() {
  setMeta('미친판사');
  const el = document.getElementById('page-content');
  if (!auth.currentUser) { navigate('/login'); return; }

  const EXAMPLES = [
    '친구가 내 치킨을 허락도 없이 먹었는데 맛없다고 했음. 유죄?',
    '카톡 읽씹 3일째인데 갑자기 "ㅋ" 하나 보냄. 이게 맞나요?',
    '3년 사귄 연인이 생일 선물로 양말 줌. 이건 고의인가요?',
    '회의 때 내 아이디어 발표했더니 팀장이 "나도 그 생각 했었는데" 라고 함',
    '샤워하고 나왔더니 자리 뺏김. 1분도 안 됐는데 이게 정당한가요?',
  ];

  el.innerHTML = `
    <div class="ai-king-page">
      <div class="ai-king-header">
        <button class="btn btn--ghost btn--sm" id="btn-back" style="margin-bottom:12px">← 뒤로</button>
        <div class="ai-king-header__title">⚖️ 미친판사</div>
        <div class="ai-king-header__sub">억울한 상황을 적으면 7명의 판사가 각자 판결합니다<br><small style="color:var(--color-text-muted)">⚖️ 엄근진 법관 · 😭 감성 판사 · 👴 꼰대 판사 · 🔬 과학자 · 🤔 철학자 · 👽 외계인 · 🤪 돌아이</small></div>
      </div>
      <div class="ai-king-form">
        <label class="ai-king-form__label">판결 받을 상황을 적어주세요 *</label>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
          ${EXAMPLES.map((ex, i) => `<button class="ai-example-chip" data-ex="${i}" type="button">${ex.slice(0, 20)}...</button>`).join('')}
        </div>
        <textarea id="situation-input" class="ai-king-form__textarea" maxlength="500"
          placeholder="예) 친구가 내 치킨을 허락도 없이 먹었는데 맛없다고 했습니다. 이건 무죄인가요 유죄인가요?&#10;&#10;억울한 상황을 최대한 자세히 적을수록 더 재밌는 판결이 나옵니다 ㅋㅋ"></textarea>
        <div class="ai-king-form__charcount"><span id="situation-count">0</span>/500</div>

        <label class="ai-king-form__label" style="margin-top:16px">📷 증거 사진 첨부 (선택)</label>
        <div class="ai-king-img-upload" id="judge-img-area">
          <input type="file" id="judge-img-input" accept="image/*" style="display:none">
          <div class="ai-king-img-upload__label">📎 클릭하여 증거 사진 추가<br><small>카톡 캡처, 현장 사진 등 — 사진이 있으면 판결이 더 생생해요</small></div>
          <img id="judge-img-preview" class="ai-king-img-upload__preview" alt="">
          <div id="judge-img-remove" class="ai-king-img-upload__remove">✕ 사진 제거</div>
        </div>

        <button id="btn-judge-submit" class="btn btn--primary btn--full" style="margin-top:20px;font-size:16px;font-weight:800">⚖️ 판결 받기</button>
        <div style="font-size:11px;color:var(--color-text-muted);text-align:center;margin-top:8px">하루 3번 무료 · 소진 시 하루 1회 사다리게임 보너스</div>
      </div>
    </div>`;

  document.getElementById('btn-back')?.addEventListener('click', () => navigate('/ai-king'));

  const textarea = document.getElementById('situation-input');
  const count = document.getElementById('situation-count');
  textarea.addEventListener('input', () => { count.textContent = textarea.value.length; });

  el.querySelectorAll('.ai-example-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      textarea.value = EXAMPLES[Number(chip.dataset.ex)];
      count.textContent = textarea.value.length;
      textarea.focus();
    });
  });

  let imageBase64 = null;
  const imgArea = document.getElementById('judge-img-area');
  const imgInput = document.getElementById('judge-img-input');
  const imgPreview = document.getElementById('judge-img-preview');
  const imgRemove = document.getElementById('judge-img-remove');

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

  document.getElementById('btn-judge-submit')?.addEventListener('click', async () => {
    const situation = textarea.value.trim();
    if (!situation || situation.length < 5) { toast.warn('상황을 5자 이상 적어주세요'); return; }

    const btn = document.getElementById('btn-judge-submit');
    btn.disabled = true;
    btn.textContent = '판사들 소환 중...';

    el.innerHTML = `<div class="ai-king-page"><div class="ai-king-loading"><div class="spinner spinner--lg"></div><div class="ai-king-loading__text">⚖️ 7명의 판사가 심의 중입니다...</div><div class="ai-king-loading__sub">엄근진 법관이 판례를 뒤지는 중 🔍</div></div></div>`;

    try {
      const fn = httpsCallable(functions, 'aiJudge');
      const result = await fn({ situation, imageBase64 });
      navigate(`/detail/${result.data.postId}`);
    } catch (e) {
      if (isQuotaError(e)) {
        showAiLadderBonus({ feature: 'judge', featureLabel: '미친판사', onReplay: renderAiJudge });
        return;
      }
      toast.error(e?.message || '판결에 실패했어요');
      renderAiJudge();
    }
  });
}
