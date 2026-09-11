import { renderFooter } from '../components/footer.js?v=20260729-brand-policy-1';

function serviceCard({ href, emoji, title, desc, accent }) {
  const a = document.createElement('a');
  a.href = href;
  a.setAttribute('aria-label', `${title} 바로가기`);
  a.style.cssText = `display:flex;gap:14px;align-items:center;padding:16px;border-radius:14px;text-decoration:none;color:inherit;background:var(--card-bg, rgba(255,255,255,.04));border:1px solid var(--border);border-left:4px solid ${accent};transition:transform .14s;`;
  a.addEventListener('mouseenter', () => { a.style.transform = 'translateY(-2px)'; });
  a.addEventListener('mouseleave', () => { a.style.transform = 'none'; });

  const mark = document.createElement('span');
  mark.setAttribute('aria-hidden', 'true');
  mark.textContent = emoji;
  mark.style.cssText = 'flex-shrink:0;font-size:28px;line-height:1;';

  const copy = document.createElement('span');
  copy.style.cssText = 'min-width:0;';

  const t = document.createElement('span');
  t.textContent = title;
  t.style.cssText = 'display:block;font-family:var(--font-serif);font-size:16px;font-weight:900;';

  const d = document.createElement('span');
  d.textContent = desc;
  d.style.cssText = 'display:block;font-size:12px;color:var(--cream-dim);margin-top:3px;line-height:1.4;';

  copy.append(t, d);
  a.append(mark, copy);
  return a;
}

export async function renderServices(container) {
  const header = document.createElement('div');
  header.className = 'page-header';
  header.innerHTML = '<span class="logo">✨ 서비스</span>';

  const wrap = document.createElement('div');
  wrap.className = 'container';
  wrap.style.cssText = 'padding-top:56px;padding-bottom:90px;';

  const grid = document.createElement('div');
  grid.style.cssText = 'display:flex;flex-direction:column;gap:12px;margin-top:8px;';

  const cards = [
    { href: '#/submit',         emoji: '⚖️', title: '판결소',          desc: 'AI 판사에게 생활 분쟁 접수',         accent: 'var(--gold)' },
    { href: '#/clinic',         emoji: '🔮', title: '미친 상담소',      desc: '고민 한 줄 → 병맛 처방',             accent: '#ff4d3d' },
    { href: '#/clinic-list',    emoji: '📋', title: '처방전 모음',      desc: '인기 처방전 구경·좋아요',             accent: '#ff4d3d' },
    { href: '#/translate',      emoji: '💥', title: '미친 번역소',      desc: '12가지 병맛 번역기',                 accent: '#e07b00' },
    { href: '#/translate-list', emoji: '📋', title: '번역 명작 모음',   desc: '인기 번역 구경·좋아요',               accent: '#e07b00' },
    { href: '#/debate',         emoji: '🌀', title: '오늘의 토론',      desc: '오늘의 딜레마에 한 표',              accent: '#7b68ee' },
    { href: '#/jury',           emoji: '🗳️', title: '민심소',           desc: '다른 사람의 사건을 블라인드 판정',    accent: '#3d8bff' },
    { href: '#/board',          emoji: '🏆', title: '명예의 전당',      desc: '공개 판결 명예 순위',                accent: '#c9a84c' },
  ];

  cards.forEach(c => grid.appendChild(serviceCard(c)));
  wrap.append(grid);
  container.append(header, wrap);
  renderFooter();
}
