import { db } from '../firebase.js';
import { collection, query, where, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const EXAMPLES = [
  { title: '라면 국물 무단 음용 사건', desc: '분명 내 라면인데 룸메이트가 국물만 다 마셨다.', index: 9, judge: '엄벌주의형' },
  { title: '충전기 독점 점거 사건', desc: '본인 폰은 완충됐는데 충전기를 계속 자기 방에 두었다.', index: 7, judge: '감성형' },
  { title: '카톡 읽씹 반복 사건', desc: '읽고 답장을 안 하길 반복. 총 17회.', index: 8, judge: '논리집착형' }
];

const JUDGE_ICON = {
  '엄벌주의형':'👨‍⚖️','감성형':'🥹','현실주의형':'🤦',
  '과몰입형':'🔥','선처형':'🤗','피곤형':'😴','논리집착형':'🧮','드립형':'🎭'
};

export async function renderHome(container) {
  container.innerHTML = `
    <div style="padding-bottom:60px;">
      <div style="background:linear-gradient(180deg,#161b2e 0%,#0d1117 100%);padding:60px 20px 44px;text-align:center;">
        <div style="font-size:12px;letter-spacing:.15em;color:var(--gold);margin-bottom:16px;font-weight:700;">⚖️ 소소킹 판결소</div>
        <h1 style="font-size:28px;line-height:1.35;margin-bottom:14px;">
          그 억울함,<br><span style="color:var(--gold);">법정에서 해결하세요.</span>
        </h1>
        <p style="color:var(--cream-dim);font-size:15px;line-height:1.75;margin-bottom:32px;max-width:320px;margin-left:auto;margin-right:auto;">
          사소한 일상의 억울함을 접수하면<br>AI 판사가 <strong style="color:var(--cream);">과하게 진지하게</strong> 판결해드립니다.
        </p>
        <div style="max-width:360px;margin:0 auto;">
          <a href="#/submit" class="btn btn-primary" style="font-size:16px;">🚨 지금 당장 억울함 호소하기</a>
        </div>
        <div style="margin-top:16px;font-size:12px;color:var(--cream-dim);">무료 · 익명 · 법적효력 없음(당연히)</div>
      </div>

      <div class="container" style="margin-top:36px;">
        <div style="font-size:11px;letter-spacing:.12em;color:var(--gold);font-weight:700;text-transform:uppercase;margin-bottom:14px;">최근 판결 사례</div>
        <div id="feed-container" style="display:flex;flex-direction:column;gap:10px;">
          ${EXAMPLES.map(c => `
            <div class="card example-card" onclick="location.hash='#/submit'">
              <div class="case-title">${c.title}</div>
              <div style="font-size:13px;color:var(--cream-dim);margin-top:3px;">${c.desc}</div>
              <div class="case-meta">
                <span>억울지수 ${c.index}/10</span>
                <span>${JUDGE_ICON[c.judge] || '⚖️'} ${c.judge} 판사</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="container" style="margin-top:28px;">
        <div class="disclaimer">
          <strong>⚠️ 오락 서비스 안내</strong><br>
          소소킹 판결소는 실제 법률 자문이 아닌 AI 기반 오락형 서비스입니다. 판결에는 어떠한 법적 효력도 없습니다.
        </div>
      </div>

      <div class="container" style="margin-top:36px;">
        <div style="font-size:11px;letter-spacing:.12em;color:var(--gold);font-weight:700;text-transform:uppercase;margin-bottom:14px;">이용 방법</div>
        <div style="display:flex;flex-direction:column;gap:14px;">
          ${[
            ['01','억울함 접수','사건명과 경위를 입력합니다'],
            ['02','AI 수사 개시','접수관·수사관이 사건을 검토합니다'],
            ['03','법정 공방','원고·피고 측 변호사가 맞붙습니다'],
            ['04','판사 등장','배정된 판사가 최종 판결을 내립니다']
          ].map(([num,title,desc]) => `
            <div class="how-step">
              <div class="how-step-num">${num}</div>
              <div>
                <div style="font-weight:700;font-size:14px;margin-bottom:2px;">${title}</div>
                <div style="font-size:13px;color:var(--cream-dim);">${desc}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  loadPublicFeed();
}

async function loadPublicFeed() {
  try {
    const snap = await getDocs(
      query(collection(db, 'results'), where('isPublic', '==', true), orderBy('createdAt', 'desc'), limit(5))
    );
    if (snap.empty) return;

    const feedEl = document.getElementById('feed-container');
    if (!feedEl) return;

    feedEl.innerHTML = snap.docs.map(d => {
      const r = d.data();
      const icon = JUDGE_ICON[r.judgeType] || '⚖️';
      return `
        <div class="card example-card" onclick="location.hash='#/result/${encodeURIComponent(d.id)}'">
          <div class="case-title">${r.caseTitle || '제목 없음'}</div>
          <div style="font-size:13px;color:var(--cream-dim);margin-top:3px;">${(r.sentence || '').substring(0, 60)}...</div>
          <div class="case-meta">
            <span>억울지수 ${r.grievanceIndex || '?'}/10</span>
            <span>${icon} ${r.judgeType || '?'} 판사</span>
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    // 공개 판결 없으면 예시 유지
  }
}
