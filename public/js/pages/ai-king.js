import { navigate } from '../router.js';
import { auth } from '../firebase.js';
import { functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';

const OFFICES = [
  { id: 'judge', emoji: '⚖️', name: '판결소', path: '/ai-judge', desc: '억울한 상황 입력 → 3인이 각자의 세계관으로 판결', color: '#6C5CE7', feature: 'judge' },
];

const CHARS = [
  { emoji: '🎙️', name: '3선 의원',        quote: '"제가 30년 정치 생활을 돌이켜보면..."',        title: '국민안정당 원내대표' },
  { emoji: '📺', name: '정치 유튜버',      quote: '"구독자 여러분~ 오늘 단독 입수했는데요~"',     title: '진실방송당 대표 (구독자 120만)' },
  { emoji: '📱', name: 'MZ 운동가',        quote: '"이게 공정함인가요? 우리 세대는 바꿀 거예요"', title: '청년혁명당 청년위원장' },
  { emoji: '📊', name: '여론조사 전문가',  quote: '"통계적으로 분석해보면 ±3.1%p..."',           title: '중도민주당 정책자문위원' },
  { emoji: '🤝', name: '당 대변인',        quote: '"우리 당의 공식 입장을 말씀드리겠습니다"',     title: '함께미래당 공식 대변인' },
  { emoji: '🔍', name: '탐사 기자',        quote: '"제가 내부 제보를 받았는데요. 내일 단독 보도"', title: '알권리당 언론인 출신' },
  { emoji: '⚖️', name: '검사 출신 변호사', quote: '"위법 소지 있습니다."',                       title: '법치정의당 법률위원장' },
];

export async function renderAiKing() {
  setMeta('소소킹 — AI킹');
  const el = document.getElementById('page-content');

  let usage = { judge: 0, extraUses: 0, dailyFreeLimit: 3 };
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
        <div class="onboard-hero__eyebrow">🏛️ 소소한 정치 게임</div>
        <div class="onboard-hero__title">AI킹</div>
        <div class="onboard-hero__desc">7인 정치 AI가 소소한 일상을<br>진지한 정치 드라마로 만들어 드립니다</div>
        <div class="onboard-hero__badges">
          <a href="#/points-shop" class="ai-king-points-badge" style="text-decoration:none">🪙 ${userPoints.toLocaleString()}p</a>
          ${usage.extraUses > 0 ? `<span class="ai-king-points-badge ai-king-points-badge--extra">⚡ 추가권 ${usage.extraUses}회</span>` : ''}
        </div>
      </div>

      <!-- ② 캐릭터 소개 -->
      <div class="onboard-section">
        <div class="onboard-section__label">🏛️ 7인 정치 AI — 판결소에서 3인 랜덤 출동, 왕좌전쟁은 7인 전원 참전</div>
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

      <!-- ④ 소(所) 선택 -->
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
        소진 시 사다리게임으로 추가 기회
      </div>

    </div>`;

  el.querySelectorAll('.soso-office[data-path]').forEach(card => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(card.dataset.path);
    });
  });
}
