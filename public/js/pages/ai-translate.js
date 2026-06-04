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

const CHARS = [
  { id: 'kimdonmu', label: '🇰🇵 김동무',  sub: '혁명 문체' },
  { id: 'tanaka',   label: '🇯🇵 다나카씨', sub: '사죄 문체' },
  { id: 'marcel',   label: '🇫🇷 마르셀',  sub: '철학 문체' },
  { id: 'ipanseo',  label: '📜 이판서',   sub: '고전 문체' },
  { id: 'dmitri',   label: '🇷🇺 드미트리', sub: '극단 문체' },
];

function setupImgUpload(prefix, onDone) {
  const area = document.getElementById(`${prefix}-img-area`);
  const input = document.getElementById(`${prefix}-img-input`);
  const preview = document.getElementById(`${prefix}-img-preview`);
  const remove = document.getElementById(`${prefix}-img-remove`);
  if (!area) return;

  area.addEventListener('click', (e) => { if (e.target !== remove) input.click(); });
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.warn('이미지 파일만 첨부할 수 있어요'); input.value = ''; return; }
    const b64 = await resizeImageToBase64(file);
    if (!b64) { toast.warn('이미지를 불러올 수 없어요'); input.value = ''; return; }
    onDone(b64);
    preview.src = `data:image/jpeg;base64,${b64}`;
    preview.style.display = 'block';
    remove.style.display = 'block';
    area.querySelector('.ai-king-img-upload__label').style.display = 'none';
  });
  remove.addEventListener('click', () => {
    onDone(null);
    preview.style.display = 'none';
    remove.style.display = 'none';
    input.value = '';
    area.querySelector('.ai-king-img-upload__label').style.display = '';
  });
}

function charGridHtml(prefix) {
  return `<div class="ai-char-grid" id="${prefix}-char-grid">
    ${CHARS.map(c => `<button class="ai-char-btn" data-id="${c.id}" type="button">
      <span style="font-size:20px">${c.label.split(' ')[0]}</span>
      <span style="font-size:11px;font-weight:700">${c.label.split(' ').slice(1).join(' ')}</span>
      <span style="font-size:10px;color:var(--color-text-muted)">${c.sub}</span>
    </button>`).join('')}
  </div>
  <div id="${prefix}-char-hint" style="font-size:11px;color:var(--color-text-muted);margin-top:6px">🎲 선택 없이 제출하면 랜덤 3인 출동!</div>`;
}

function imgUploadHtml(prefix, hint) {
  return `<div class="ai-king-img-upload" id="${prefix}-img-area">
    <input type="file" id="${prefix}-img-input" accept="image/*" style="display:none">
    <div class="ai-king-img-upload__label">📎 클릭하여 사진 추가<br><small>${hint}</small></div>
    <img id="${prefix}-img-preview" class="ai-king-img-upload__preview" alt="">
    <div id="${prefix}-img-remove" class="ai-king-img-upload__remove">✕ 사진 제거</div>
  </div>`;
}

export function renderAiTranslate(initialTab = 'translate') {
  setMeta('창작소');
  const el = document.getElementById('page-content');
  if (!auth.currentUser) { navigate('/login'); return; }

  let activeTab = initialTab;
  const translateChars = new Set();
  const namingChars = new Set();
  let translateImg = null;
  let namingImg = null;

  const lim = parseInt(sessionStorage.getItem('sosoking:aiDailyLimit') || '3');

  function bindCharMultiSelect(prefix, selectedSet) {
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
        const hint = document.getElementById(`${prefix}-char-hint`);
        hint.textContent = selectedSet.size === 0
          ? '🎲 선택 없이 제출하면 랜덤 3인 출동!'
          : `✅ ${selectedSet.size}명 선택됨${selectedSet.size < 3 ? ` · ${3 - selectedSet.size}명 더 선택 가능` : ' · 제출 준비 완료!'}`;
      });
    });
  }

  function render() {
    el.innerHTML = `
      <div class="ai-king-page">
        <div class="ai-king-header">
          <button class="btn btn--ghost btn--sm" id="btn-back" style="margin-bottom:12px">← 뒤로</button>
          <div class="ai-king-header__title">✨ 창작소</div>
          <div class="ai-king-header__sub">캐릭터가 번역하고, 이름 짓고, 온갖 창작을 해드립니다</div>
        </div>

        <div class="ai-create-tabs">
          <button class="ai-create-tab${activeTab === 'translate' ? ' active' : ''}" data-tab="translate">🌍 번역하기</button>
          <button class="ai-create-tab${activeTab === 'naming' ? ' active' : ''}" data-tab="naming">🎭 이름짓기</button>
        </div>

        <div class="ai-king-form">
          ${activeTab === 'translate' ? `
            <label class="ai-king-form__label">캐릭터 선택 <span style="font-weight:400;font-size:12px;color:var(--color-text-muted)">(최대 3명 · 미선택 시 랜덤 3명)</span></label>
            ${charGridHtml('tl')}

            <label class="ai-king-form__label" style="margin-top:20px">번역할 텍스트 <span style="font-size:11px;color:var(--color-text-muted);font-weight:400">(이미지만 올려도 됩니다)</span></label>
            <textarea id="translate-input" class="ai-king-form__textarea" maxlength="500"
              placeholder="번역할 텍스트를 입력하세요.&#10;예) 오늘 밥 먹었어? 나 배고파 죽겠어.&#10;예) 카톡 읽씹했는데 갑자기 연락이 왔어.&#10;&#10;텍스트 없이 이미지만 올려도 됩니다 📷"></textarea>
            <div class="ai-king-form__charcount"><span id="translate-count">0</span>/500</div>

            <label class="ai-king-form__label" style="margin-top:16px">📷 이미지 첨부 (이미지만도 OK)</label>
            ${imgUploadHtml('tl', '사진 속 텍스트나 상황도 번역해요 · 이미지만 올려도 동작해요')}

            <button id="btn-translate-submit" class="btn btn--primary btn--full" style="margin-top:20px;font-size:16px;font-weight:800">🌍 번역하기</button>
          ` : `
            <label class="ai-king-form__label">캐릭터 선택 <span style="font-weight:400;font-size:12px;color:var(--color-text-muted)">(최대 3명 · 미선택 시 랜덤 3명)</span></label>
            ${charGridHtml('nm')}

            <label class="ai-king-form__label" style="margin-top:20px">이름 지을 대상 설명</label>
            <textarea id="naming-input" class="ai-king-form__textarea" maxlength="300"
              placeholder="예) 회의 때마다 화장실 가는 팀장님&#10;예) 매운 듯 안 매운 듯 애매한 떡볶이&#10;사진만 올려도 됩니다"></textarea>
            <div class="ai-king-form__charcount"><span id="naming-count">0</span>/300</div>

            <label class="ai-king-form__label" style="margin-top:16px">📷 사진 첨부 (선택)</label>
            ${imgUploadHtml('nm', '사진이 있으면 외모·분위기 기반 이름도 나와요')}

            <button id="btn-naming-submit" class="btn btn--primary btn--full" style="margin-top:20px;font-size:16px;font-weight:800">🎭 이름짓기</button>
          `}
          <div style="font-size:11px;color:var(--color-text-muted);text-align:center;margin-top:8px">하루 ${lim}번 무료 · 소진 시 하루 1회 사다리게임 보너스</div>
        </div>
      </div>`;

    document.getElementById('btn-back')?.addEventListener('click', () => navigate('/ai-king'));

    el.querySelectorAll('.ai-create-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        activeTab = tab.dataset.tab;
        render();
      });
    });

    if (activeTab === 'translate') {
      const textarea = document.getElementById('translate-input');
      textarea.addEventListener('input', () => { document.getElementById('translate-count').textContent = textarea.value.length; });

      bindCharMultiSelect('tl', translateChars);
      setupImgUpload('tl', (b64) => { translateImg = b64; });

      document.getElementById('btn-translate-submit')?.addEventListener('click', async () => {
        const text = textarea.value.trim();
        if (!text && !translateImg) { toast.warn('텍스트를 입력하거나 이미지를 첨부해주세요'); return; }
        const charIds = [...translateChars];
        const charLabel = charIds.length
          ? CHARS.filter(c => charIds.includes(c.id)).map(c => c.label).join(' · ')
          : '랜덤 3인';
        el.innerHTML = `<div class="ai-king-page"><div class="ai-king-loading"><div class="spinner spinner--lg"></div><div class="ai-king-loading__text">✨ 번역 중...</div><div class="ai-king-loading__sub">${charLabel} 출동 완료 ✅</div></div></div>`;
        try {
          const fn = httpsCallable(functions, 'aiTranslate');
          const result = await fn({ text, characterIds: charIds, imageBase64: translateImg });
          navigate(`/detail/${result.data.postId}`);
        } catch (e) {
          if (isQuotaError(e)) {
            showAiLadderBonus({ feature: 'translate', featureLabel: '창작소', onReplay: renderAiTranslate });
            return;
          }
          toast.error(e?.message || '번역에 실패했어요');
          renderAiTranslate('translate');
        }
      });

    } else {
      const textarea = document.getElementById('naming-input');
      textarea.addEventListener('input', () => { document.getElementById('naming-count').textContent = textarea.value.length; });

      bindCharMultiSelect('nm', namingChars);
      setupImgUpload('nm', (b64) => { namingImg = b64; });

      document.getElementById('btn-naming-submit')?.addEventListener('click', async () => {
        const description = textarea.value.trim();
        if (!description && !namingImg) { toast.warn('설명을 입력하거나 사진을 첨부해주세요'); return; }
        const charIds = [...namingChars];
        const charLabel = charIds.length
          ? CHARS.filter(c => charIds.includes(c.id)).map(c => c.label).join(' · ')
          : '랜덤 3인';
        el.innerHTML = `<div class="ai-king-page"><div class="ai-king-loading"><div class="spinner spinner--lg"></div><div class="ai-king-loading__text">🎭 작명 중...</div><div class="ai-king-loading__sub">${charLabel} 작명가 긴급 투입 완료 ✅</div></div></div>`;
        try {
          const fn = httpsCallable(functions, 'aiNaming');
          const result = await fn({ description, imageBase64: namingImg, characterIds: charIds });
          navigate(`/detail/${result.data.postId}`);
        } catch (e) {
          if (isQuotaError(e)) {
            showAiLadderBonus({ feature: 'translate', featureLabel: '창작소', onReplay: () => renderAiTranslate('naming') });
            return;
          }
          toast.error(e?.message || '작명에 실패했어요');
          renderAiTranslate('naming');
        }
      });
    }
  }

  render();
}
