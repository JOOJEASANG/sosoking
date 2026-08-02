import { renderHome as renderBaseHome } from './home-seven-judges.js?v=20260730-home-layout-route-1';

function updateCommunityCourtCopy(container) {
  const courtDescription = container.querySelector('#court-entrance .court-desc');
  if (courtDescription) {
    courtDescription.textContent = '내 사건은 AI 판사에게 접수하고, 오늘의 공개 생활사건은 선택으로 직접 판결해보세요.';
  }

  const ledger = container.querySelectorAll('#court-entrance .court-ledger > div');
  if (ledger[2]) {
    const strong = ledger[2].querySelector('strong');
    const label = ledger[2].querySelector('span');
    if (strong) strong.textContent = '3판';
    if (label) label.textContent = '오늘의 선택재판';
  }

  container.querySelectorAll('*').forEach(element => {
    if (element.children.length) return;
    const copy = element.textContent?.trim() || '';
    if (copy === '내 억울함은 AI에게, 실제 판례는 내가 판결합니다.') {
      element.textContent = '내 이야기는 사건접수에, 다른 생활사건은 선택으로 판결합니다.';
    } else if (copy.includes('오늘의 실제 판례')) {
      element.textContent = copy.replace('오늘의 실제 판례', '오늘의 공개 생활사건');
    } else if (copy === '실제 판례') {
      element.textContent = '공개 생활사건';
    }
  });
}

export async function renderHome(container) {
  await renderBaseHome(container);
  updateCommunityCourtCopy(container);
}
