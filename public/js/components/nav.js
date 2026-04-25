import { toggleTheme, getTheme } from './theme.js';

export function renderNav() {
  document.getElementById('bottom-nav')?.remove();

  const hash = location.hash || '#/';
  const isHome = hash === '#/' || hash === '#' || hash === '';
  const isTopics = hash.startsWith('#/topics') || hash.startsWith('#/topic/');
  const isSubmit = hash === '#/submit-topic';
  const isMy = hash === '#/my-history';
  const isDark = getTheme() !== 'light';

  const nav = document.createElement('nav');
  nav.id = 'bottom-nav';
  nav.innerHTML = `
    <a href="#/" class="nav-item${isHome ? ' active' : ''}">
      <span class="nav-icon">🏠</span>
      <span class="nav-label">홈</span>
    </a>
    <a href="#/topics" class="nav-item${isTopics ? ' active' : ''}">
      <span class="nav-icon">⚖️</span>
      <span class="nav-label">사건 목록</span>
    </a>
    <a href="#/submit-topic" class="nav-item nav-cta${isSubmit ? ' active' : ''}">
      <span class="nav-icon">✏️</span>
      <span class="nav-label">주제 등록</span>
    </a>
    <a href="#/my-history" class="nav-item${isMy ? ' active' : ''}">
      <span class="nav-icon">📋</span>
      <span class="nav-label">내 기록</span>
    </a>
    <button class="nav-item nav-theme-btn" id="nav-theme-toggle" type="button">
      <span class="nav-icon">${isDark ? '☀️' : '🌙'}</span>
      <span class="nav-label">${isDark ? '라이트' : '다크'}</span>
    </button>
  `;
  document.body.appendChild(nav);

  document.getElementById('nav-theme-toggle').addEventListener('click', () => {
    toggleTheme();
    renderNav();
  });
}
