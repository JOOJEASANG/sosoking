export function renderNav() {
  document.getElementById('bottom-nav')?.remove();

  const hash = location.hash || '#/';
  const isHome = hash === '#/' || hash === '#' || hash === '';
  const isTopics = hash.startsWith('#/topics') || hash.startsWith('#/topic/');
  const isSubmit = hash === '#/submit-topic';
  const isMy = hash === '#/my-history';
  const curTheme = localStorage.getItem('theme') || 'light';

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
    <button class="nav-item nav-theme-btn" id="nav-theme-btn" aria-label="테마 변경">
      <span class="nav-icon" id="nav-theme-icon">${curTheme === 'dark' ? '🌙' : '☀️'}</span>
      <span class="nav-label">${curTheme === 'dark' ? '다크' : '라이트'}</span>
    </button>
  `;
  document.body.appendChild(nav);

  document.getElementById('nav-theme-btn').addEventListener('click', () => {
    const cur = localStorage.getItem('theme') || 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
    document.getElementById('nav-theme-icon').textContent = next === 'dark' ? '🌙' : '☀️';
    document.getElementById('nav-theme-btn').querySelector('.nav-label').textContent = next === 'dark' ? '다크' : '라이트';
  });
}
