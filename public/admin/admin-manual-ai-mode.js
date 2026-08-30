// admin.js의 기존 설정 저장 구조는 유지하되, 예약/자동 생성처럼 오해할 수 있는 UI를
// 관리자 수동 생성 도구로 명확히 정규화한다. dailyAiEnabled는 항상 false로 저장된다.
function applyManualAiMode() {
  const root = document.getElementById('admin-content');
  if (!root) return;

  const dailyToggle = root.querySelector('#dailyOn');
  if (dailyToggle instanceof HTMLInputElement) {
    dailyToggle.checked = false;
    dailyToggle.disabled = true;
    dailyToggle.closest('label')?.remove();

    const aiCard = dailyToggle.closest('.card');
    const heading = aiCard?.querySelector('div');
    if (heading?.textContent.includes('AI 자동 사건 생성')) heading.textContent = '🤖 관리자 수동 AI 샘플 사건 생성';
    aiCard?.querySelectorAll('.form-label').forEach(label => {
      if (label.textContent.trim() === '자동 생성 주제 힌트') label.textContent = '생성 주제 힌트';
    });

    if (aiCard && !aiCard.querySelector('[data-manual-ai-note]')) {
      aiCard.insertAdjacentHTML('afterbegin', `
        <div data-manual-ai-note class="card" style="margin:0 0 14px;padding:12px 14px;background:rgba(201,168,76,.08);border-color:rgba(201,168,76,.28);font-size:12px;line-height:1.7;color:var(--cream-dim);">
          <strong style="color:var(--gold);">자동 예약 없음</strong><br>
          아래 설정은 관리자가 생성 버튼을 직접 눌렀을 때만 사용됩니다. 공개 전에 서버의 개인정보·고위험 콘텐츠 안전검사를 통과해야 합니다.
        </div>`);
    }
  }

  const generateButton = root.querySelector('#generate-daily-now');
  if (generateButton) {
    generateButton.textContent = 'AI 샘플 사건 수동 생성';
    generateButton.setAttribute('title', '현재 설정으로 관리자용 공개 샘플 사건을 1건 생성합니다.');
  }

  root.querySelectorAll('.disclaimer').forEach(disclaimer => {
    if (!disclaimer.textContent.includes('자동 생성 결과')) return;
    disclaimer.textContent = '이 기능은 예약 실행되지 않습니다. 관리자가 버튼을 누른 경우에만 AI 샘플 사건을 생성하며, 생성 결과는 저장·공개 전에 개인정보 및 고위험 표현 안전검사를 거칩니다.';
  });

  root.querySelectorAll('.admin-grid > div').forEach(card => {
    const label = card.lastElementChild;
    if (label?.textContent.trim() !== 'AI 자동 생성') return;
    label.textContent = 'AI 수동 생성';
    if (card.firstElementChild) card.firstElementChild.textContent = '관리자 버튼';
  });

  root.querySelectorAll('strong').forEach(label => {
    if (label.textContent.trim() !== 'AI 자동 사건') return;
    label.textContent = 'AI 샘플 사건';
    const statusText = label.nextSibling;
    if (statusText?.nodeType === Node.TEXT_NODE) statusText.textContent = ': 자동 예약 없음 · 관리자 버튼으로만 생성';
  });
}

function startManualAiMode() {
  const host = document.getElementById('admin-app');
  if (!host) return;
  applyManualAiMode();
  const observer = new MutationObserver(() => queueMicrotask(applyManualAiMode));
  observer.observe(host, { childList: true, subtree: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startManualAiMode, { once: true });
else startManualAiMode();
