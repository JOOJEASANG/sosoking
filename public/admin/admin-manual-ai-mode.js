// admin.js의 기존 설정 저장 구조는 유지하되, 예약/자동 생성처럼 오해할 수 있는 UI를
// 관리자 수동 생성 도구로 명확히 정규화한다. dailyAiEnabled는 항상 false로 저장된다.
const MANUAL_GENERATE_LABEL = 'AI 샘플 사건 수동 생성';
const MANUAL_GENERATE_TITLE = '현재 설정으로 관리자용 공개 샘플 사건을 1건 생성합니다.';
const MODEL_OPTIONS = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash · 권장 (균형)' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite · 빠름 / 비용 절약' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro · 품질 / 추론 우선' }
];

function setTextIfChanged(element, text) {
  if (element && element.textContent !== text) element.textContent = text;
}

function appendModelOption(select, value, label) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  select.appendChild(option);
}

function normalizeModelSelector(root) {
  const modelControl = root.querySelector('#model');
  if (!modelControl) return;

  const group = modelControl.closest('.form-group');
  setTextIfChanged(group?.querySelector('.form-label'), 'AI 모델 선택');

  if (modelControl instanceof HTMLInputElement) {
    const currentModel = modelControl.value.trim() || MODEL_OPTIONS[0].value;
    const knownModels = new Set(MODEL_OPTIONS.map(option => option.value));
    const select = document.createElement('select');
    select.id = 'model';
    select.className = modelControl.className || 'form-input';
    select.dataset.aiModelSelector = 'true';
    select.setAttribute('aria-label', 'AI 모델 선택');

    if (currentModel && !knownModels.has(currentModel)) {
      appendModelOption(select, currentModel, `현재 저장된 모델 · ${currentModel}`);
    }
    MODEL_OPTIONS.forEach(option => appendModelOption(select, option.value, option.label));
    select.value = currentModel;
    modelControl.replaceWith(select);
  }

  const normalizedControl = root.querySelector('#model');
  const normalizedGroup = normalizedControl?.closest('.form-group') || group;
  if (normalizedGroup && !normalizedGroup.querySelector('[data-ai-model-guide]')) {
    normalizedGroup.insertAdjacentHTML('beforeend', `
      <div data-ai-model-guide style="margin-top:7px;font-size:11px;line-height:1.65;color:var(--cream-dim);">
        <strong style="color:var(--gold);">Flash</strong>는 기본 권장, <strong style="color:var(--gold);">Flash-Lite</strong>는 속도·비용 우선,
        <strong style="color:var(--gold);">Pro</strong>는 판결문 품질·추론 우선입니다. 저장 후 다음 수동 AI 샘플 생성부터 적용되며,
        선택 모델 호출이 실패하면 서버의 기본 모델 순서로 자동 재시도합니다.
      </div>`);
  }
}

function applyManualAiMode() {
  const root = document.getElementById('admin-content');
  if (!root) return;

  normalizeModelSelector(root);

  const dailyToggle = root.querySelector('#dailyOn');
  if (dailyToggle instanceof HTMLInputElement) {
    const toggleLabel = dailyToggle.closest('label');
    const aiCard = dailyToggle.closest('.card');

    dailyToggle.checked = false;
    dailyToggle.disabled = true;

    const heading = aiCard?.querySelector('div');
    if (heading?.textContent.includes('AI 자동 사건 생성')) {
      setTextIfChanged(heading, '🤖 관리자 수동 AI 샘플 사건 생성');
    }

    aiCard?.querySelectorAll('.form-label').forEach(label => {
      if (label.textContent.trim() === '자동 생성 주제 힌트') {
        setTextIfChanged(label, '생성 주제 힌트');
      }
    });

    if (aiCard && !aiCard.querySelector('[data-manual-ai-note]')) {
      aiCard.insertAdjacentHTML('afterbegin', `
        <div data-manual-ai-note class="card" style="margin:0 0 14px;padding:12px 14px;background:rgba(201,168,76,.08);border-color:rgba(201,168,76,.28);font-size:12px;line-height:1.7;color:var(--cream-dim);">
          <strong style="color:var(--gold);">자동 예약 없음</strong><br>
          아래 설정은 관리자가 생성 버튼을 직접 눌렀을 때만 사용됩니다. 공개 전에 서버의 개인정보·고위험 콘텐츠 안전검사를 통과해야 합니다.
        </div>`);
    }

    toggleLabel?.remove();
  }

  const generateButton = root.querySelector('#generate-daily-now');
  if (generateButton) {
    // MutationObserver가 이 변경을 다시 감지하므로 같은 텍스트를 반복해서 쓰지 않는다.
    setTextIfChanged(generateButton, MANUAL_GENERATE_LABEL);
    if (generateButton.getAttribute('title') !== MANUAL_GENERATE_TITLE) {
      generateButton.setAttribute('title', MANUAL_GENERATE_TITLE);
    }
  }

  root.querySelectorAll('.disclaimer').forEach(disclaimer => {
    if (!disclaimer.textContent.includes('자동 생성 결과')) return;
    setTextIfChanged(
      disclaimer,
      '이 기능은 예약 실행되지 않습니다. 관리자가 버튼을 누른 경우에만 AI 샘플 사건을 생성하며, 생성 결과는 저장·공개 전에 개인정보 및 고위험 표현 안전검사를 거칩니다.'
    );
  });

  root.querySelectorAll('.admin-grid > div').forEach(card => {
    const label = card.lastElementChild;
    if (label?.textContent.trim() !== 'AI 자동 생성') return;
    setTextIfChanged(label, 'AI 수동 생성');
    setTextIfChanged(card.firstElementChild, '관리자 버튼');
  });

  root.querySelectorAll('strong').forEach(label => {
    if (label.textContent.trim() !== 'AI 자동 사건') return;
    setTextIfChanged(label, 'AI 샘플 사건');
    const statusText = label.nextSibling;
    if (statusText?.nodeType === Node.TEXT_NODE) {
      const nextText = ': 자동 예약 없음 · 관리자 버튼으로만 생성';
      if (statusText.textContent !== nextText) statusText.textContent = nextText;
    }
  });
}

function startManualAiMode() {
  const host = document.getElementById('admin-app');
  if (!host) return;

  let scheduled = false;
  const scheduleApply = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      applyManualAiMode();
    });
  };

  applyManualAiMode();
  const observer = new MutationObserver(scheduleApply);
  observer.observe(host, { childList: true, subtree: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startManualAiMode, { once: true });
else startManualAiMode();
