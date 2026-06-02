import { functions } from './firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { toast } from './components/toast.js';

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function prizeLabel(prize) {
  if (prize === 'extra_use') return 'AI 추가 이용권 1회';
  if (prize === 'points') return '포인트 보너스';
  return '꽝 없는 사다리';
}

export function isQuotaError(error) {
  const code = String(error?.code || '');
  const msg = String(error?.message || error || '');
  return code.includes('resource-exhausted') || msg.includes('resource-exhausted') || msg.includes('하루') || msg.includes('횟수');
}

export function showAiLadderBonus({ feature, featureLabel, onReplay } = {}) {
  const el = document.getElementById('page-content');
  if (!el) return;
  const label = featureLabel || 'AI';
  el.innerHTML = `
    <div class="ai-king-page">
      <div class="ai-king-header">
        <button class="btn btn--ghost btn--sm" id="ladder-back" style="margin-bottom:12px">← 돌아가기</button>
        <div class="ai-king-header__title">🪜 사다리게임 보너스</div>
        <div class="ai-king-header__sub">오늘 ${esc(label)} 무료 횟수를 모두 사용했어요.<br>하루 1번 사다리게임으로 추가 이용권 1회를 받을 수 있습니다.</div>
      </div>
      <div class="ai-king-form">
        <div class="ladder-bonus-box" style="border:1px solid var(--color-border);border-radius:18px;padding:18px;background:var(--color-surface);text-align:center">
          <div style="font-size:38px;margin-bottom:8px">🪜</div>
          <div style="font-size:18px;font-weight:900;color:var(--color-text-primary);margin-bottom:6px">오늘의 마지막 기회</div>
          <div style="font-size:13px;color:var(--color-text-secondary);line-height:1.7;margin-bottom:16px">
            버튼을 누르면 사다리게임이 실행되고, 성공 시 AI 추가 이용권 1회가 지급됩니다.<br>
            지급된 이용권은 네 가지 AI킹 어디서든 1회 사용할 수 있습니다.
          </div>
          <div id="ladder-preview" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0">
            ${['A','B','C','D'].map(v => `<button class="btn btn--ghost ladder-lane" type="button" data-lane="${v}">${v}</button>`).join('')}
          </div>
          <button class="btn btn--primary btn--full" id="ladder-play">🪜 사다리게임 시작</button>
          <div id="ladder-result" style="font-size:13px;color:var(--color-text-secondary);min-height:22px;margin-top:12px"></div>
        </div>
      </div>
    </div>`;

  document.getElementById('ladder-back')?.addEventListener('click', () => {
    if (typeof onReplay === 'function') onReplay();
  });

  let selectedLane = 'A';
  document.querySelectorAll('.ladder-lane').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedLane = btn.dataset.lane || 'A';
      document.querySelectorAll('.ladder-lane').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  document.querySelector('.ladder-lane')?.classList.add('active');

  document.getElementById('ladder-play')?.addEventListener('click', async () => {
    const playBtn = document.getElementById('ladder-play');
    const resultEl = document.getElementById('ladder-result');
    playBtn.disabled = true;
    playBtn.textContent = '사다리 타는 중...';
    if (resultEl) resultEl.textContent = `${selectedLane}번 사다리를 타고 내려가는 중...`;
    try {
      const fn = httpsCallable(functions, 'playAiLadderBonus');
      const { data } = await fn({ feature, lane: selectedLane });
      if (data?.success) {
        if (resultEl) resultEl.innerHTML = `<strong style="color:var(--color-success)">${esc(prizeLabel(data.prize))} 지급 완료!</strong>`;
        toast.success('AI 추가 이용권 1회가 지급됐어요');
        playBtn.textContent = '다시 AI 사용하기';
        playBtn.disabled = false;
        playBtn.onclick = () => { if (typeof onReplay === 'function') onReplay(); };
      } else {
        throw new Error('사다리게임 결과를 확인할 수 없어요');
      }
    } catch (error) {
      const msg = String(error?.message || error || '사다리게임을 실행할 수 없어요');
      if (resultEl) resultEl.textContent = msg;
      toast.error(msg.includes('already') || msg.includes('이미') ? '오늘 사다리게임은 이미 사용했어요' : msg);
      playBtn.disabled = false;
      playBtn.textContent = '🪜 사다리게임 시작';
    }
  });
}
