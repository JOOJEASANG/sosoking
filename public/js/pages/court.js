import { functions, trackEvent } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { showToast } from '../components/toast.js';

const JUDGE_DEFS = {
  '엄벌주의형': { icon: '👨‍⚖️', color: '#c0392b', desc: '사소해도 중범죄 수준으로' },
  '감성형':     { icon: '🥹',    color: '#8e44ad', desc: '눈물 흘리며 공감 위주 판정' },
  '현실주의형': { icon: '🤦',    color: '#7f8c8d', desc: '"그래서 어쩌라고요" 현실 직격' },
  '과몰입형':   { icon: '🔥',    color: '#e67e22', desc: '역사에 남을 대형 이슈 취급' },
  '피곤형':     { icon: '😴',    color: '#95a5a6', desc: '빨리 끝내고 싶은 번아웃 심판' },
  '논리집착형': { icon: '🧮',    color: '#2980b9', desc: '모든 걸 수치화하는 논리 괴물' },
  '드립형':     { icon: '🎭',    color: '#27ae60', desc: '진지한 척 드립 치는 유머 심판' },
};

export function renderCourt(container) {
  container.innerHTML = `
    <div>
      <div class="page-header">
        <a href="#/" class="back-btn">‹</a>
        <span class="logo">🏛️ 법정놀이</span>
      </div>
      <div class="container" style="padding-top:20px;padding-bottom:80px;">
        <div class="submit-topic-tip" style="margin-bottom:24px;">
          🏛️ 억울한 일을 <strong>원고</strong>로 제출하면 AI가 <strong>피고 반론</strong>을 만들고,<br>
          <strong>랜덤 판사</strong>가 웃기게 판결해드립니다!
        </div>

        <form id="court-form">
          <div class="form-group">
            <label class="form-label">원고 주장 <span style="color:var(--red)">*</span></label>
            <textarea id="plaintiff-input" class="form-input" rows="4"
              maxlength="300"
              placeholder="예: 저 오늘 친구랑 밥 먹다가 갑자기 더치페이 하자고 했어요. 처음엔 제가 산다고 했는데 나중에 말 바꿨습니다. 완전 억울합니다."
              style="resize:none;min-height:100px;"></textarea>
            <div class="char-counter"><span id="c-plaintiff">0</span>/300</div>
          </div>

          <div class="form-group">
            <label class="form-label">판사 선택</label>
            <div id="judge-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
              <button type="button" class="judge-pick-btn active" data-judge="">
                <span style="font-size:20px;">🎲</span>
                <div style="font-size:12px;font-weight:700;color:var(--gold);">랜덤 판사</div>
                <div style="font-size:10px;color:var(--cream-dim);">매번 다른 판사</div>
              </button>
              ${Object.entries(JUDGE_DEFS).map(([name, j]) => `
                <button type="button" class="judge-pick-btn" data-judge="${name}">
                  <span style="font-size:20px;">${j.icon}</span>
                  <div style="font-size:12px;font-weight:700;color:${j.color};">${name}</div>
                  <div style="font-size:10px;color:var(--cream-dim);">${j.desc}</div>
                </button>`).join('')}
            </div>
          </div>

          <button type="submit" class="btn btn-primary" id="court-submit-btn" style="margin-top:8px;">
            🏛️ 판결 요청하기
          </button>
        </form>

        <div id="court-result" style="display:none;margin-top:32px;"></div>
      </div>
    </div>
  `;

  document.getElementById('plaintiff-input')?.addEventListener('input', function () {
    document.getElementById('c-plaintiff').textContent = this.value.length;
  });

  document.getElementById('judge-grid')?.addEventListener('click', e => {
    const btn = e.target.closest('.judge-pick-btn');
    if (!btn) return;
    document.querySelectorAll('.judge-pick-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });

  document.getElementById('court-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const plaintiff = document.getElementById('plaintiff-input').value.trim();
    if (plaintiff.length < 10) { showToast('원고 주장을 10자 이상 입력해주세요', 'error'); return; }

    const judgeType = document.querySelector('.judge-pick-btn.active')?.dataset.judge || '';
    const btn = document.getElementById('court-submit-btn');
    btn.disabled = true;
    btn.textContent = '⚖️ 판사가 검토 중...';

    const resultEl = document.getElementById('court-result');
    resultEl.style.display = 'block';
    resultEl.innerHTML = `
      <div style="text-align:center;padding:40px 20px;">
        <div style="font-size:48px;margin-bottom:16px;animation:waitingPulse 1.5s ease-in-out infinite;">⚖️</div>
        <div style="font-size:16px;font-weight:700;color:var(--cream);margin-bottom:6px;">판사가 검토 중입니다...</div>
        <div class="loading-dots" style="padding:16px 0;"><span></span><span></span><span></span></div>
        <p style="font-size:13px;color:var(--cream-dim);">피고측 반론을 준비하고 있어요</p>
      </div>`;
    resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
      const judgeCourt = httpsCallable(functions, 'judgeCourt');
      const res = await judgeCourt({ plaintiffStatement: plaintiff, ...(judgeType && { judgeType }) });
      const data = res.data;
      trackEvent('court_judge', { judge_type: data.judgeType, winner: data.verdict.winner });
      showCourtResult(resultEl, plaintiff, data, container);
    } catch (err) {
      resultEl.style.display = 'none';
      showToast(err.message || '판결 요청 실패', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '🏛️ 판결 요청하기';
    }
  });
}

function showCourtResult(el, plaintiffStatement, data, container) {
  const judge = JUDGE_DEFS[data.judgeType] || { icon: '⚖️', color: 'var(--gold)', desc: '' };
  const v = data.verdict;
  const pScore = v.scores?.plaintiff ?? 50;
  const dScore = v.scores?.defendant ?? 50;
  const isDraw = v.winner === 'draw';
  const pWin = v.winner === 'plaintiff';
  const winnerLabel = isDraw ? '🤝 무승부' : pWin ? '🔴 원고 승소!' : '🔵 피고 승소!';
  const winnerColor = isDraw ? 'var(--gold)' : pWin ? '#e74c3c' : '#3498db';

  el.innerHTML = `
    <div style="animation:fadeUp 0.4s both;">
      <!-- 사건번호 -->
      <div style="text-align:center;font-size:11px;color:var(--cream-dim);margin-bottom:16px;letter-spacing:.05em;">${data.caseNumber}</div>

      <!-- 판사 등장 -->
      <div style="text-align:center;padding:20px 16px;border-radius:14px;background:rgba(255,255,255,0.03);border:1px solid var(--border);margin-bottom:16px;">
        <div style="font-size:10px;color:var(--cream-dim);letter-spacing:.1em;margin-bottom:8px;">이번 사건 담당 판사</div>
        <div style="font-size:44px;margin-bottom:6px;">${judge.icon}</div>
        <div style="font-size:16px;font-weight:700;color:${judge.color};margin-bottom:3px;">${data.judgeType} 판사</div>
        <div style="font-size:11px;color:var(--cream-dim);">${judge.desc}</div>
      </div>

      <!-- 원고 주장 -->
      <div style="margin-bottom:12px;">
        <div style="font-size:11px;font-weight:700;color:#e74c3c;margin-bottom:6px;">🔴 원고 주장</div>
        <div style="padding:12px 14px;border-radius:10px;background:rgba(231,76,60,0.06);border:1px solid rgba(231,76,60,0.2);font-size:13px;color:var(--cream);line-height:1.7;">${escHtml(plaintiffStatement)}</div>
      </div>

      <!-- 피고 반론 -->
      <div style="margin-bottom:20px;">
        <div style="font-size:11px;font-weight:700;color:#3498db;margin-bottom:6px;">🔵 피고 반론 (AI 생성)</div>
        <div style="padding:12px 14px;border-radius:10px;background:rgba(52,152,219,0.06);border:1px solid rgba(52,152,219,0.2);font-size:13px;color:var(--cream);line-height:1.7;">${escHtml(data.defendantRebuttal)}</div>
      </div>

      <!-- 판결 -->
      <div style="border:2px solid ${winnerColor};border-radius:14px;overflow:hidden;margin-bottom:16px;">
        <div style="background:${isDraw ? 'rgba(201,168,76,0.1)' : pWin ? 'rgba(231,76,60,0.1)' : 'rgba(52,152,219,0.1)'};padding:16px;text-align:center;border-bottom:1px solid var(--border);">
          <div style="font-size:11px;color:var(--cream-dim);margin-bottom:6px;">🏛️ 최종 판결</div>
          <div style="font-size:22px;font-weight:900;color:${winnerColor};">${winnerLabel}</div>
        </div>
        <div style="padding:14px 16px;">
          <!-- 점수 바 -->
          <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:5px;">
            <span style="color:#e74c3c;">🔴 원고 ${pScore}점</span>
            <span style="color:#3498db;">🔵 피고 ${dScore}점</span>
          </div>
          <div style="height:10px;border-radius:5px;overflow:hidden;display:flex;background:rgba(255,255,255,0.06);margin-bottom:14px;">
            <div style="width:${pScore}%;background:linear-gradient(90deg,#e74c3c,#ff6b6b);border-radius:5px 0 0 5px;"></div>
            <div style="width:${dScore}%;background:linear-gradient(90deg,#3498db,#5dade2);border-radius:0 5px 5px 0;"></div>
          </div>
          <!-- 판정 이유 -->
          <div style="font-size:12px;color:var(--cream-dim);margin-bottom:4px;font-weight:700;">📝 판정 이유</div>
          <div style="font-size:13px;color:var(--cream);line-height:1.8;white-space:pre-line;">${escHtml(v.reason)}</div>
        </div>
      </div>

      <!-- 미션 -->
      ${v.mission ? `
      <div style="padding:14px 16px;border-radius:12px;background:rgba(201,168,76,0.06);border:1px solid rgba(201,168,76,0.25);margin-bottom:20px;">
        <div style="font-size:11px;color:var(--gold);font-weight:700;margin-bottom:6px;">🎯 판사 미션</div>
        <div style="font-size:14px;color:var(--cream);line-height:1.7;">${escHtml(v.mission)}</div>
      </div>` : ''}

      <!-- 액션 버튼 -->
      <button id="share-court-btn" class="btn btn-secondary" style="margin-bottom:10px;">📋 결과 공유하기</button>
      <button id="retry-court-btn" class="btn btn-ghost">🔄 다른 억울한 일 제출하기</button>
    </div>
  `;

  document.getElementById('share-court-btn')?.addEventListener('click', async () => {
    const winnerTxt = isDraw ? '무승부' : pWin ? '원고 승소' : '피고 승소';
    const text = `🏛️ 소소킹 법정놀이 판결 결과\n\n${data.caseNumber}\n담당: ${data.judgeType} 판사\n\n🔴 원고: "${plaintiffStatement.slice(0, 50)}${plaintiffStatement.length > 50 ? '...' : ''}"\n\n⚖️ 판결: ${winnerTxt} (${pScore}:${dScore})\n\n나도 판결받기 → ${location.origin}/#/court`;
    try {
      await navigator.clipboard.writeText(text);
      showToast('복사됐어요! 카톡에 붙여넣기 하세요 💬', 'success');
    } catch {
      showToast('복사 실패', 'error');
    }
  });

  document.getElementById('retry-court-btn')?.addEventListener('click', () => {
    renderCourt(container);
    window.scrollTo(0, 0);
  });
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
