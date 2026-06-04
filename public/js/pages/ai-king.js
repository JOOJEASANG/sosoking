import { navigate } from '../router.js';
import { auth } from '../firebase.js';
import { functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';

const OFFICES = [
  { id: 'judge',   emoji: '⚖️', name: '판결소', path: '/ai-judge',   desc: '억울한 상황 입력 → 3인이 각자의 세계관으로 판결', color: '#6C5CE7', feature: 'judge' },
  { id: 'create',  emoji: '✨', name: '창작소', path: '/ai-translate', desc: '번역하기 + 이름짓기 — 3인이 전혀 다른 결과 출력', color: '#00B894', feature: 'translate' },
  { id: 'match',   emoji: '💘', name: '궁합소', path: '/ai-match',    desc: '뭐든 두 가지 → 3인이 각자 궁합 점수+분석', color: '#E84393', feature: 'match' },
  { id: 'consult', emoji: '💬', name: '상담소', path: '/ai-consult',  desc: '고민 털어놓기 → 3인의 황당하지만 맞는 조언', color: '#F39C12', feature: 'consult' },
];

const CHARS = [
  { emoji: '🎒', name: '사춘기 중딩', quote: '"어른들 왜 이리 복잡하게 삶ㅋ 팩폭 드림"' },
  { emoji: '🙏', name: '사이비 교주', quote: '"모든 건 계시입니다. 다음 모임은 토요일"' },
  { emoji: '🔮', name: '예언가',      quote: '"서쪽을 조심하라... 운명이 그러하니라"' },
  { emoji: '🤩', name: '주접러',      quote: '"미쳤다 실화임?? 소름ㄷㄷ 어떡해ㅠㅠ"' },
  { emoji: '👀', name: '참견러',      quote: '"아 그거 내가 다 알아. 옆집도 그랬어"' },
  { emoji: '👴', name: '꼰대',        quote: '"내가 말이야~ 우리 때는 이런 거 없었어"' },
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
    <div class="onboard">

      <!-- ① 히어로 -->
      <div class="onboard-hero">
        <div class="onboard-hero__eyebrow">✨ AI 창작 놀이터</div>
        <div class="onboard-hero__title">소소킹</div>
        <div class="onboard-hero__desc">6인의 개성 넘치는 캐릭터가<br>판결·번역·궁합·상담을 해드립니다</div>
        <div class="onboard-hero__badges">
          <span class="ai-king-points-badge">🪙 ${userPoints.toLocaleString()}p</span>
          ${usage.extraUses > 0 ? `<span class="ai-king-points-badge ai-king-points-badge--extra">⚡ 추가권 ${usage.extraUses}회</span>` : ''}
          <a href="#/points-shop" class="ai-king-points-shop-link">상점 →</a>
        </div>
      </div>

      <!-- ② 캐릭터 소개 -->
      <div class="onboard-section">
        <div class="onboard-section__label">👥 오늘의 응답단 6인 — 3명이 랜덤 출동</div>
        <div class="onboard-chars-grid">
          ${CHARS.map(c => `
            <div class="onboard-char-card">
              <span class="onboard-char-card__emoji">${c.emoji}</span>
              <span class="onboard-char-card__name">${c.name}</span>
              <span class="onboard-char-card__quote">${escHtml(c.quote)}</span>
            </div>`).join('')}
        </div>
      </div>

      <!-- ③ 사용 방법 -->
      <div class="onboard-how">
        <div class="onboard-how__step">
          <div class="onboard-how__num">1</div>
          <div class="onboard-how__label">소(所)<br>선택</div>
        </div>
        <div class="onboard-how__arrow">→</div>
        <div class="onboard-how__step">
          <div class="onboard-how__num">2</div>
          <div class="onboard-how__label">상황·고민<br>입력</div>
        </div>
        <div class="onboard-how__arrow">→</div>
        <div class="onboard-how__step">
          <div class="onboard-how__num">3</div>
          <div class="onboard-how__label">캐릭터<br>선택 (선택)</div>
        </div>
        <div class="onboard-how__arrow">→</div>
        <div class="onboard-how__step">
          <div class="onboard-how__num">4</div>
          <div class="onboard-how__label">3인<br>결과 확인</div>
        </div>
      </div>

      <!-- ④ 4소 선택 -->
      <div class="onboard-section">
        <div class="onboard-section__label">🚪 어디 입장할까요?</div>
        <div class="soso-offices">
          ${OFFICES.map(o => {
            const used = o.feature === 'create' ? (usage['translate'] || 0) : (usage[o.feature] || 0);
            const warn = used >= lim;
            return `
              <a class="soso-office" href="#${o.path}" data-path="${o.path}" style="--office-color:${o.color}">
                <div class="soso-office__head">
                  <span class="soso-office__emoji">${o.emoji}</span>
                  <span class="soso-office__badge${warn ? ' soso-office__badge--warn' : ''}">${used}/${lim}</span>
                </div>
                <div class="soso-office__name">${o.name}</div>
                <div class="soso-office__desc">${escHtml(o.desc)}</div>
                <div class="soso-office__cta">입장하기 →</div>
              </a>`;
          }).join('')}
        </div>
      </div>

      <!-- ⑤ 안내 -->
      <div class="onboard-footer">
        각 소(所)마다 하루 ${lim}회 무료<br>
        소진 시 사다리게임으로 추가 기회 · 포인트로 구매도 가능
      </div>

    </div>`;

  el.querySelectorAll('.soso-office[data-path]').forEach(card => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(card.dataset.path);
    });
  });
}
