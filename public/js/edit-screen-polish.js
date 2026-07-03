function currentTypeLabel() {
  const hint = document.querySelector('.post-edit-page .form-hint b');
  return hint?.textContent?.trim() || '';
}

function normalizeEditScreen() {
  const page = document.querySelector('.post-edit-page');
  if (!page) return;

  const label = currentTypeLabel();
  const moduleCard = page.querySelector('.edit-module-card');
  if (moduleCard) {
    const title = moduleCard.querySelector('[style*="font-size:14px"]');
    if (title) title.textContent = label ? `글쓰기 유형: ${label}` : '글쓰기 유형 설정';

    const hint = moduleCard.querySelector('.form-hint');
    if (hint) hint.textContent = '작성할 때 선택한 유형의 설정만 수정합니다. 다른 글쓰기 유형은 표시하지 않습니다.';

    moduleCard.querySelector('.feed-card__multi-chips')?.remove();
  }

  // 일반글/익명글/유튜브글은 참여형 설정 카드가 비어 보이면 숨김 처리합니다.
  if (moduleCard) {
    const editableGroups = moduleCard.querySelectorAll('.form-group').length;
    if (!editableGroups && !moduleCard.textContent.includes('유튜브')) moduleCard.style.display = 'none';
  }

  // 새 글쓰기 형식 선택 UI가 혹시 남아 있으면 수정 화면에서는 숨깁니다.
  page.querySelectorAll('.multi-preset-box, .multi-preset-list, [data-multi-preset], .write-template-card').forEach(el => {
    (el.closest('.multi-preset-box') || el).style.display = 'none';
  });
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(normalizeEditScreen, 100);
}

window.addEventListener('hashchange', schedule);
window.addEventListener('sosoking:render-write-edit', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 600);
