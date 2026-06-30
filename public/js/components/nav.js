export function renderNav() {
  document.getElementById('bottom-nav')?.remove();

  const hash = location.hash || '#/';
  const isHome = hash === '#/' || hash === '#' || hash === '';
  const isSubmit = hash.startsWith('#/submit');
  const isMy = hash.startsWith('#/my-cases');

  const nav = document.createElement('nav');
  nav.id = 'bottom-nav';
  nav.innerHTML = `
    <a href="#/" class="nav-item${isHome ? ' active' : ''}">
      <span class="nav-icon">🏠</span>
      <span class="nav-label">홈</span>
    </a>
    <a href="#/submit" class="nav-item nav-cta${isSubmit ? ' active' : ''}">
      <span class="nav-icon">⚖️</span>
      <span class="nav-label">접수하기</span>
    </a>
    <a href="#/my-cases" class="nav-item${isMy ? ' active' : ''}">
      <span class="nav-icon">📋</span>
      <span class="nav-label">내 사건</span>
    </a>
  `;
  document.body.appendChild(nav);
}
