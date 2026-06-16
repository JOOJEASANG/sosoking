import { functions } from './firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { toast } from './components/toast.js';

const SECTION_ID = 'admin-history-battle-tools';

function todayKst() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function adminContent() {
  return document.getElementById('admin-content');
}

function isFeatureTabVisible(root) {
  if (!root || !location.hash.startsWith('#/admin')) return false;
  return !!root.querySelector('#btn-save-site-features') || root.textContent.includes('게임 기능 ON/OFF');
}

function readInputs(section) {
  const date = section.querySelector('#history-battle-date')?.value || todayKst();
  const rawDay = Number(section.querySelector('#history-battle-day')?.value || 0);
  const day = rawDay >= 1 && rawDay <= 30 ? rawDay : null;
  const force = !!section.querySelector('#history-battle-force')?.checked;
  return { date, day, force };
}

function setResult(section, html, color = 'var(--color-text-muted)') {
  const result = section.querySelector('#history-battle-result');
  if (!result) return;
  result.style.color = color;
  result.innerHTML = html;
}

async function generateBattle(section, useTodayOnly = false) {
  const input = readInputs(section);
  const payload = useTodayOnly ? { date: todayKst(), force: input.force } : input;
  const btn = useTodayOnly ? section.querySelector('#btn-history-battle-today') : section.querySelector('#btn-history-battle-generate');
  btn.disabled = true;
  btn.textContent = '생성 중...';
  setResult(section, '역사 배틀 생성 중입니다. AI 호출이 들어가면 시간이 조금 걸릴 수 있습니다.');

  try {
    const call = httpsCallable(functions, 'adminGenerateBattle');
    const { data } = await call(payload);
    if (data.skipped) {
      setResult(section, `이미 생성된 배틀이 있습니다. <a href="#/battle" style="font-weight:900;color:#2563eb">배틀 열기</a><br><span style="font-size:11px">강제 재생성을 체크하면 덮어쓸 수 있습니다.</span>`, '#2563eb');
      toast.info('이미 생성된 배틀이 있어요');
      return;
    }
    const dayText = data.eventDay ? `Day ${String(data.eventDay).padStart(3, '0')} · ` : '';
    setResult(section, `✅ ${dayText}${esc(data.topic || '역사 배틀')} 생성 완료 · <a href="#/battle" style="font-weight:900;color:#15803d">배틀 확인</a>`, '#15803d');
    toast.success('역사 배틀을 생성했어요');
  } catch (error) {
    setResult(section, '❌ ' + esc(error?.message || '생성 실패'), '#dc2626');
    toast.error(error?.message || '역사 배틀 생성 실패');
  } finally {
    btn.disabled = false;
    btn.textContent = useTodayOnly ? '오늘 배틀 생성' : '선택 조건으로 생성';
  }
}

async function resetBattle(section) {
  const { date } = readInputs(section);
  const btn = section.querySelector('#btn-history-battle-reset');
  btn.disabled = true;
  btn.textContent = '초기화 중...';
  setResult(section, `${esc(date)} 배틀과 댓글을 초기화하는 중입니다.`);

  try {
    const call = httpsCallable(functions, 'adminResetBattleData');
    const { data } = await call({ date });
    setResult(section, `🧹 초기화 완료 · 삭제 댓글 ${Number(data.deletedComments || 0).toLocaleString()}개<br><span style="font-size:11px">이제 선택 조건으로 다시 생성할 수 있습니다.</span>`, '#7c3aed');
    toast.success('배틀 데이터를 초기화했어요');
  } catch (error) {
    setResult(section, '❌ ' + esc(error?.message || '초기화 실패'), '#dc2626');
    toast.error(error?.message || '배틀 초기화 실패');
  } finally {
    btn.disabled = false;
    btn.textContent = '선택 날짜 배틀 초기화';
  }
}

async function resetAndGenerate(section) {
  const { date, day } = readInputs(section);
  const btn = section.querySelector('#btn-history-battle-reset-generate');
  btn.disabled = true;
  btn.textContent = '재생성 중...';
  setResult(section, `${esc(date)} 배틀 초기화 후 다시 생성합니다.`);

  try {
    const resetCall = httpsCallable(functions, 'adminResetBattleData');
    await resetCall({ date });
    const genCall = httpsCallable(functions, 'adminGenerateBattle');
    const { data } = await genCall({ date, day, force: true });
    const dayText = data.eventDay ? `Day ${String(data.eventDay).padStart(3, '0')} · ` : '';
    setResult(section, `✅ 초기화 후 재생성 완료 · ${dayText}${esc(data.topic || '역사 배틀')}<br><a href="#/battle" style="font-weight:900;color:#15803d">배틀 확인</a>`, '#15803d');
    toast.success('배틀을 재생성했어요');
  } catch (error) {
    setResult(section, '❌ ' + esc(error?.message || '재생성 실패'), '#dc2626');
    toast.error(error?.message || '배틀 재생성 실패');
  } finally {
    btn.disabled = false;
    btn.textContent = '초기화 후 재생성';
  }
}

function injectBattleTools() {
  const root = adminContent();
  if (!isFeatureTabVisible(root)) return;
  if (document.getElementById(SECTION_ID)) return;

  const section = document.createElement('div');
  section.id = SECTION_ID;
  section.className = 'admin-section';
  section.style.marginTop = '16px';
  section.innerHTML = `
    <div class="card">
      <div class="card__body">
        <div style="font-size:15px;font-weight:900;margin-bottom:4px;color:#2563eb">⚔️ 새공화국 역사 배틀 운영</div>
        <div style="font-size:12px;color:var(--color-text-muted);line-height:1.55;margin-bottom:14px">
          매일 자정 생성되는 정당 대항전을 역사 이슈 기반으로 수동 생성하거나 초기화합니다.<br>
          배틀은 <b>국민질서당·시민개혁당·국민통합당</b> 3당과 6명 캐릭터 발언으로 구성됩니다.
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:12px">
          <label style="font-size:12px;font-weight:800">생성 날짜
            <input id="history-battle-date" type="date" class="form-input" value="${todayKst()}" style="margin-top:5px">
          </label>
          <label style="font-size:12px;font-weight:800">Day 번호
            <input id="history-battle-day" type="number" min="1" max="30" class="form-input" placeholder="1~30" style="margin-top:5px">
          </label>
          <label style="font-size:12px;font-weight:800;display:flex;align-items:flex-end;gap:8px;padding-bottom:8px">
            <input id="history-battle-force" type="checkbox" style="width:18px;height:18px"> 강제 재생성
          </label>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">
          <button class="btn btn--primary btn--sm" id="btn-history-battle-generate">선택 조건으로 생성</button>
          <button class="btn btn--sm" id="btn-history-battle-today" style="background:#2563eb;color:#fff;border-color:transparent">오늘 배틀 생성</button>
          <button class="btn btn--ghost btn--sm" id="btn-history-battle-reset">선택 날짜 배틀 초기화</button>
          <button class="btn btn--ghost btn--sm" id="btn-history-battle-reset-generate">초기화 후 재생성</button>
          <a class="btn btn--ghost btn--sm" href="#/battle">배틀 화면 열기</a>
        </div>
        <div id="history-battle-result" style="font-size:12px;color:var(--color-text-muted)">Day 번호를 비우면 날짜 기준으로 자동 선택됩니다. 기존 배틀이 있으면 강제 재생성을 체크하세요.</div>
      </div>
    </div>`;

  const historyTools = root.querySelector('#admin-history-issue-tools');
  if (historyTools) historyTools.insertAdjacentElement('afterend', section);
  else {
    const seed = root.querySelector('#btn-seed-world')?.closest('.admin-section');
    if (seed) seed.insertAdjacentElement('afterend', section);
    else root.appendChild(section);
  }

  section.querySelector('#btn-history-battle-generate')?.addEventListener('click', () => generateBattle(section, false));
  section.querySelector('#btn-history-battle-today')?.addEventListener('click', () => generateBattle(section, true));
  section.querySelector('#btn-history-battle-reset')?.addEventListener('click', () => resetBattle(section));
  section.querySelector('#btn-history-battle-reset-generate')?.addEventListener('click', () => resetAndGenerate(section));
}

let observer = null;
function startObserver() {
  if (observer) return;
  observer = new MutationObserver(() => injectBattleTools());
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('hashchange', () => setTimeout(injectBattleTools, 80));
  setTimeout(injectBattleTools, 200);
}

startObserver();
