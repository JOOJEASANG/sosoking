import { navigate } from '../router.js';
import { auth } from '../firebase.js';
import { functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';

const FEATURES = [
  {
    id: 'judge',
    emoji: '⚖️',
    name: '미친판사',
    path: '/ai-judge',
    desc: '억울한 상황을 적으면 7명의 이상한 판사가 각자 판결을 내립니다. 법관, 꼰대, 외계인, 돌아이...',
  },
  {
    id: 'translate',
    emoji: '🌍',
    name: '미친번역사',
    path: '/ai-translate',
    desc: '텍스트를 북한말, 부산 사투리, 조선시대, 급식체 등으로 변환해드립니다. 이미지 속 텍스트도 가능!',
  },
  {
    id: 'match',
    emoji: '💘',
    name: 'AI궁합',
    path: '/ai-match',
    desc: '두 가지를 입력하면 AI가 궁합을 봐드립니다. 사람도 음식도 물건도 뭐든 OK.',
  },
];

export async function renderAiKing() {
  setMeta('AI킹 놀이터');
  const el = document.getElementById('page-content');

  let usage = { judge: 0, translate: 0, match: 0 };
  if (auth.currentUser) {
    try {
      const fn = httpsCallable(functions, 'getAiKingUsage');
      const r = await fn();
      usage = r.data || usage;
    } catch {}
  }

  el.innerHTML = `
    <div class="ai-king-page">
      <div class="ai-king-header">
        <div class="ai-king-header__title">🤖 AI킹 놀이터</div>
        <div class="ai-king-header__sub">AI가 판결하고, 번역하고, 궁합을 봅니다</div>
        <div class="ai-king-usage">
          ${FEATURES.map(f => {
            const used = usage[f.id] || 0;
            const warn = used >= 3;
            return `<span class="ai-king-usage__badge${warn ? ' ai-king-usage__badge--warn' : ''}">${f.emoji} ${used}/3</span>`;
          }).join('')}
        </div>
      </div>
      <div class="ai-king-cards">
        ${FEATURES.map(f => `
          <a class="ai-king-card" href="#${f.path}" data-path="${f.path}">
            <div class="ai-king-card__emoji">${f.emoji}</div>
            <div class="ai-king-card__name">${f.name}</div>
            <div class="ai-king-card__desc">${escHtml(f.desc)}</div>
            <div class="ai-king-card__limit">하루 3회 무료</div>
          </a>`).join('')}
      </div>
    </div>`;

  el.querySelectorAll('.ai-king-card[data-path]').forEach(card => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(card.dataset.path);
    });
  });
}
