// 홈에 '미친 소소킹 유니버스' 진입 블록(세 개의 문)을 주입하는 가드.
// home.js를 수정하지 않으려고(캐시 버전 연쇄 회피) 기존 *-guard.js 패턴을 따른다.
const ENTRY_ID = 'sosoking-rooms-entry';

function isHomeRoute() {
  const hash = location.hash || '';
  if (hash && hash !== '#' && hash !== '#/') return false;
  const path = location.pathname.replace(/\/$/, '') || '/';
  return path === '/';
}

function door({ href, emoji, title, desc, accent }) {
  const link = document.createElement('a');
  link.href = href;
  link.setAttribute('aria-label', `${title} 바로가기`);
  link.style.cssText = `flex:1;min-width:150px;display:flex;gap:11px;align-items:center;padding:14px 15px;border-radius:14px;text-decoration:none;color:inherit;background:rgba(255,255,255,.04);border:1px solid var(--border);border-left:4px solid ${accent};transition:transform .14s;`;
  link.addEventListener('mouseenter', () => { link.style.transform = 'translateY(-2px)'; });
  link.addEventListener('mouseleave', () => { link.style.transform = 'none'; });

  const mark = document.createElement('span');
  mark.setAttribute('aria-hidden', 'true');
  mark.textContent = emoji;
  mark.style.cssText = 'flex-shrink:0;font-size:26px;line-height:1;';

  const copy = document.createElement('span');
  copy.style.cssText = 'min-width:0;';
  const t = document.createElement('span');
  t.textContent = title;
  t.style.cssText = 'display:block;font-family:var(--font-serif);font-size:16px;font-weight:900;';
  const d = document.createElement('span');
  d.textContent = desc;
  d.style.cssText = 'display:block;font-size:11.5px;color:var(--cream-dim);margin-top:2px;line-height:1.4;';
  copy.append(t, d);
  link.append(mark, copy);
  return link;
}

function buildRooms() {
  const section = document.createElement('section');
  section.id = ENTRY_ID;
  section.style.cssText = 'margin:22px 16px 0;padding:16px;border-radius:16px;background:linear-gradient(135deg,rgba(201,168,76,.14),rgba(201,168,76,.04));border:1px solid var(--border);box-shadow:var(--shadow);';

  const eyebrow = document.createElement('div');
  eyebrow.textContent = "JUST FOR FUN · 오늘 뭐부터?";
  eyebrow.style.cssText = 'font-size:10px;letter-spacing:.14em;color:var(--gold);font-weight:800;margin-bottom:11px;';

  const doors = document.createElement('div');
  doors.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;';
  doors.append(
    door({ href: '#/clinic',    emoji: '🔮', title: '미친 상담소', desc: '고민 한 줄 → 병맛 처방',   accent: '#ff4d3d' }),
    door({ href: '#/translate', emoji: '💥', title: '미친 번역소', desc: '12가지 병맛 번역기',       accent: '#e07b00' }),
    door({ href: '#/debate',    emoji: '⚖️', title: '오늘의 토론', desc: '오늘 딜레마에 한 표',     accent: 'var(--gold)' })
  );

  section.append(eyebrow, doors);
  return section;
}

function normalizeHome() {
  if (!isHomeRoute()) {
    document.getElementById(ENTRY_ID)?.remove();
    return;
  }
  const content = document.getElementById('page-content');
  if (!content) return;
  const hero = content.querySelector('.hero-section');
  if (!hero) {
    document.getElementById(ENTRY_ID)?.remove();
    return;
  }
  if (document.getElementById(ENTRY_ID)) return;

  const rooms = buildRooms();
  const anchor = content.querySelector('#court-entrance');
  if (anchor && anchor.parentElement) anchor.parentElement.insertBefore(rooms, anchor);
  else hero.insertAdjacentElement('afterend', rooms);
}

let scheduled = false;
function schedule() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => { scheduled = false; normalizeHome(); });
}

const observer = new MutationObserver(schedule);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('hashchange', schedule);
window.addEventListener('pageshow', schedule);
normalizeHome();
