import { navigate } from '../router.js';
import { auth } from '../firebase.js';
import { functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';

const OFFICES = [
  { id: 'judge',   emoji: '⚖️', name: '판결소', path: '/ai-judge',   desc: '억울한 상황 제출 → 5인 캐릭터 중 최대 3명이 판결', color: '#6C5CE7', feature: 'judge' },
  { id: 'create',  emoji: '✨', name: '창작소', path: '/ai-translate', desc: '번역하기 + 이름짓기 — 두 가지를 한 곳에서', color: '#00B894', feature: 'translate' },
  { id: 'match',   emoji: '💘', name: '궁합소', path: '/ai-match',    desc: '뭐든 두 가지 → AI가 궁합 점수+분석 즉시 출력', color: '#E84393', feature: 'match' },
  { id: 'consult', emoji: '💬', name: '상담소', path: '/ai-consult',  desc: '고민 털어놓기 → 황당하지만 맞는 조언 보장', color: '#F39C12', feature: 'consult' },
];

const CHARS = [
  { id: 'kimdonmu', emoji: '🇰🇵', name: '김동무',  desc: '혁명재판소 판사' },
  { id: 'tanaka',   emoji: '🇯🇵', name: '다나카씨', desc: '만사 사죄 전문가' },
  { id: 'marcel',   emoji: '🇫🇷', name: '마르셀',  desc: '실존주의 철학자' },
  { id: 'ipanseo',  emoji: '📜',  name: '이판서',  desc: '조선시대 성리학자' },
  { id: 'dmitri',   emoji: '🇷🇺', name: '드미트리', desc: '이진법 인생관' },
];

export async function renderAiKing() {
  setMeta('소소킹 — 4소(所)');
  const el = document.getElementById('page-content');

  let usage = { judge: 0, translate: 0, match: 0, naming: 0, consult: 0, extraUses: 0, dailyFreeLimit: 3 };
  let userPoints = 0;
  if (auth.currentUser) {
    try {
      const [usageRes, userSnap] = await Promise.all([
        httpsCallable(functions, 'getAiKingUsage')(),
        import('../firebase.js').then(({ db }) =>
          import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js').then(({ doc, getDoc }) =>
            getDoc(doc(db, 'users', auth.currentUser.uid))
          )
        ),
      ]);
      usage = usageRes.data || usage;
      userPoints = userSnap.data()?.points || 0;
      try { sessionStorage.setItem('sosoking:aiDailyLimit', String(usage.dailyFreeLimit || 3)); } catch {}
    } catch {}
  }

  const lim = usage.dailyFreeLimit || 3;

  el.innerHTML = `
    <div class="soso-hub">
      <div class="soso-hub__header">
        <div class="soso-hub__title">소소킹 4소(所)</div>
        <div class="soso-hub__sub">AI가 판결하고 · 창작하고 · 궁합 보고 · 상담하는 놀이터</div>
        <div class="soso-hub__points-row">
          <span class="ai-king-points-badge">🪙 ${userPoints.toLocaleString()}p</span>
          ${usage.extraUses > 0 ? `<span class="ai-king-points-badge ai-king-points-badge--extra">⚡ 추가권 ${usage.extraUses}회</span>` : ''}
          <a href="#/points-shop" class="ai-king-points-shop-link">상점 →</a>
        </div>
      </div>

      <div class="soso-chars">
        <div class="soso-chars__title">5인 캐릭터</div>
        <div class="soso-chars__grid">
          ${CHARS.map(c => `
            <div class="soso-char-chip">
              <span class="soso-char-chip__emoji">${c.emoji}</span>
              <span class="soso-char-chip__name">${c.name}</span>
              <span class="soso-char-chip__desc">${c.desc}</span>
            </div>`).join('')}
        </div>
      </div>

      <div class="soso-offices">
        ${OFFICES.map(o => {
          const used = o.feature === 'create' ? (usage['translate'] || 0) : (usage[o.feature] || 0);
          const warn = used >= lim;
          return `
            <a class="soso-office" href="#${o.path}" data-path="${o.path}" style="--office-color:${o.color}">
              <div class="soso-office__head">
                <span class="soso-office__emoji">${o.emoji}</span>
                <div>
                  <div class="soso-office__name">${o.name}</div>
                  <span class="soso-office__badge${warn ? ' soso-office__badge--warn' : ''}">${used}/${lim}</span>
                </div>
              </div>
              <div class="soso-office__desc">${escHtml(o.desc)}</div>
              <div class="soso-office__cta">입장하기 →</div>
            </a>`;
        }).join('')}
      </div>

      <div style="text-align:center;font-size:11px;color:var(--color-text-muted);margin-top:8px">
        각 소(所)마다 하루 ${lim}회 무료 · 소진 시 사다리게임으로 추가 기회
      </div>
    </div>`;

  el.querySelectorAll('.soso-office[data-path]').forEach(card => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(card.dataset.path);
    });
  });
}
