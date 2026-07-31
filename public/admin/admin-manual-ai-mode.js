function applyManualAiMode() {
  const root = document.getElementById('admin-content');
  if (!root) return;

  const dailyToggle = root.querySelector('#dailyOn');
  if (dailyToggle) {
    dailyToggle.checked = false;
    dailyToggle.disabled = true;
    const toggleLabel = dailyToggle.closest('label');
    if (toggleLabel) {
      toggleLabel.hidden = true;
      toggleLabel.setAttribute('aria-hidden', 'true');
    }

    const aiCard = dailyToggle.closest('.card');
    const heading = aiCard?.querySelector('div');
    if (heading?.textContent.includes('AI 자동 사건 생성')) {
      heading.textContent = '🤖 관리자 수동 AI 사건 생성';
    }

    aiCard?.querySelectorAll('.form-label').forEach(label => {
      if (label.textContent.trim() === '자동 생성 주제 힌트') {
        label.textContent = '생성 주제 힌트';
      }
    });

    const disclaimer = root.querySelector('.disclaimer');
    if (disclaimer?.textContent.includes('자동 생성 결과')) {
      disclaimer.textContent = '관리자가 생성 버튼을 누른 경우에만 AI 사건이 생성됩니다. 생성 결과는 저장 전에 개인정보·고위험 표현 검사를 통과해야 공개됩니다.';
    }
  }

  root.querySelectorAll('.admin-grid > div').forEach(card => {
    const label = card.lastElementChild;
    if (label?.textContent.trim() !== 'AI 자동 생성') return;
    label.textContent = 'AI 수동 생성';
    if (card.firstElementChild) card.firstElementChild.textContent = '관리자 버튼';
  });

  root.querySelectorAll('strong').forEach(label => {
    if (label.textContent.trim() !== 'AI 자동 사건') return;
    label.textContent = 'AI 사건 생성';
    const statusText = label.nextSibling;
    if (statusText?.nodeType === Node.TEXT_NODE) {
      statusText.textContent = ': 자동 예약 없음 · 관리자 버튼으로만 생성';
    }
  });
}

function startManualAiMode() {
  const host = document.getElementById('admin-app');
  if (!host) return;
  applyManualAiMode();
  const observer = new MutationObserver(() => queueMicrotask(applyManualAiMode));
  observer.observe(host, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startManualAiMode, { once: true });
} else {
  startManualAiMode();
}
