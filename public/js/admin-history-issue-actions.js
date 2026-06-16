import { functions } from './firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { toast } from './components/toast.js';

const SECTION_ID = 'admin-history-issue-tools';

function todayKst() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function esc(value) {
  return String(value || '').replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
}

function adminContent() {
  return document.getElementById('admin-content');
}

function isFeatureTabVisible(root) {
  if (!root || !location.hash.startsWith('#/admin')) return false;
  return !!root.querySelector('#btn-save-site-features') || root.textContent.includes('게임 기능 ON/OFF');
}

function readInputs(section) {
  const date = section.querySelector('#history-issue-date')?.value || todayKst();
  const rawDay = Number(section.querySelector('#history-issue-day')?.value || 0);
  const day = rawDay >= 1 && rawDay <= 30 ? rawDay : null;
  const force = !!section.querySelector('#history-issue-force')?.checked;
  return { date, day, force };
}

function renderPreview(event, cached, date) {
  if (!event) return '<div style="font-size:12px;color:var(--color-text-muted)">미리보기 데이터가 없습니다.</div>';
  const stances = event.stances || {};
  const cachedHtml = cached?.postId
    ? `<div style="margin-top:10px;padding:8px 10px;border-radius:10px;background:rgba(22,163,74,.08);font-size:12px;color:#15803d">이미 생성됨: <a href="#/detail/${esc(cached.postId)}" style="font-weight:800;color:#15803d">${esc(cached.postId)}</a></div>`
    : `<div style="margin-top:10px;padding:8px 10px;border-radius:10px;background:rgba(59,130,246,.08);font-size:12px;color:#2563eb">${esc(date)} 날짜에는 아직 생성 기록이 없습니다.</div>`;
  return `
    <div style="padding:12px;border:1px solid var(--color-border);border-radius:12px;background:var(--color-surface-1)">
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">
        <span class="tag">Day ${String(event.day || 1).padStart(3, '0')}</span>
        <span class="tag">${esc(event.era)}</span>
        <span class="tag">${esc(event.motifYear)}년 모티브</span>
      </div>
      <div style="font-size:15px;font-weight:900;margin-bottom:5px">📜 ${esc(event.parodyTitle)}</div>
      <div style="font-size:12px;color:var(--color-text-muted);line-height:1.55;margin-bottom:8px">${esc(event.issueSummary)}</div>
      <div style="font-size:12px;margin-bottom:8px"><b>실제 흐름 모티브</b> · ${esc(event.motif)}</div>
      <div style="font-size:12px;margin-bottom:8px"><b>쟁점</b> · ${esc(event.question)}</div>
      <div style="display:grid;gap:5px;font-size:12px;line-height:1.5">
        <div>🛡️ <b>국민질서당</b> · ${esc(stances.national)}</div>
        <div>🕯️ <b>시민개혁당</b> · ${esc(stances.youth)}</div>
        <div>⚖️ <b>국민통합당</b> · ${esc(stances.center)}</div>
      </div>
      ${cachedHtml}
    </div>`;
}

function setResult(section, html, color = 'var(--color-text-muted)') {
  const result = section.querySelector('#history-issue-result');
  if (!result) return;
  result.style.color = color;
  result.innerHTML = html;
}

async function previewIssue(section) {
  const { date, day } = readInputs(section);
  const btn = section.querySelector('#btn-history-preview');
  btn.disabled = true;
  btn.textContent = '불러오는 중...';
  setResult(section, '미리보기 불러오는 중...');
  try {
    const call = httpsCallable(functions, 'previewHistoryIssue');
    const { data } = await call({ date, day });
    setResult(section, renderPreview(data.event, data.cached, data.date));
  } catch (error) {
    setResult(section, '❌ ' + esc(error?.message || '미리보기 실패'), '#dc2626');
  } finally {
    btn.disabled = false;
    btn.textContent = '미리보기';
  }
}

async function generateIssue(section, useTodayOnly = false) {
  const input = readInputs(section);
  const payload = useTodayOnly ? { date: todayKst(), force: input.force } : input;
  const btn = useTodayOnly ? section.querySelector('#btn-history-generate-today') : section.querySelector('#btn-history-generate');
  btn.disabled = true;
  btn.textContent = '생성 중...';
  setResult(section, '역사 이슈 생성 중입니다. AI 설정에 따라 시간이 걸릴 수 있습니다.');
  try {
    const call = httpsCallable(functions, 'triggerParodyIssues');
    const { data } = await call(payload);
    if (data.skipped) {
      setResult(section, `이미 생성된 이슈가 있습니다. <a href="#/detail/${esc(data.postId)}" style="font-weight:900">글 열기</a>`, '#2563eb');
      toast.info('이미 생성된 역사 이슈가 있어요');
    } else {
      setResult(section, `✅ 생성 완료: <a href="#/detail/${esc(data.postId)}" style="font-weight:900;color:#15803d">${esc(data.postId)}</a>`, '#15803d');
      toast.success('역사 이슈를 생성했어요');
    }
  } catch (error) {
    setResult(section, '❌ ' + esc(error?.message || '생성 실패'), '#dc2626');
    toast.error(error?.message || '역사 이슈 생성 실패');
  } finally {
    btn.disabled = false;
    btn.textContent = useTodayOnly ? '오늘 이슈 생성' : '선택 조건으로 생성';
  }
}

function injectHistoryTools() {
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
        <div style="font-size:15px;font-weight:900;margin-bottom:4px;color:#7c3aed">📜 새공화국 역사 이슈 운영</div>
        <div style="font-size:12px;color:var(--color-text-muted);line-height:1.55;margin-bottom:14px">
          매일 오전 8시에 자동 생성되는 역사 풍자 이슈를 미리 확인하거나 수동 생성합니다.<br>
          생성된 글은 시민광장에 <b>citizen_speech</b> 글로 올라가며, 검색어 <b>역사·현대사·연도·Day 번호</b>로 찾을 수 있습니다.
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:12px">
          <label style="font-size:12px;font-weight:800">생성 날짜
            <input id="history-issue-date" type="date" class="form-input" value="${todayKst()}" style="margin-top:5px">
          </label>
          <label style="font-size:12px;font-weight:800">Day 번호
            <input id="history-issue-day" type="number" min="1" max="30" class="form-input" placeholder="1~30" style="margin-top:5px">
          </label>
          <label style="font-size:12px;font-weight:800;display:flex;align-items:flex-end;gap:8px;padding-bottom:8px">
            <input id="history-issue-force" type="checkbox" style="width:18px;height:18px"> 강제 재생성
          </label>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">
          <button class="btn btn--ghost btn--sm" id="btn-history-preview">미리보기</button>
          <button class="btn btn--primary btn--sm" id="btn-history-generate">선택 조건으로 생성</button>
          <button class="btn btn--sm" id="btn-history-generate-today" style="background:#7c3aed;color:#fff;border-color:transparent">오늘 이슈 생성</button>
          <a class="btn btn--ghost btn--sm" href="#/feed?q=역사">역사 이슈 검색 열기</a>
        </div>
        <div id="history-issue-result" style="font-size:12px;color:var(--color-text-muted)">Day 번호를 비우면 날짜 기준으로 자동 선택됩니다.</div>
      </div>
    </div>`;

  const seed = root.querySelector('#btn-seed-world')?.closest('.admin-section');
  if (seed) seed.insertAdjacentElement('afterend', section);
  else root.appendChild(section);

  section.querySelector('#btn-history-preview')?.addEventListener('click', () => previewIssue(section));
  section.querySelector('#btn-history-generate')?.addEventListener('click', () => generateIssue(section, false));
  section.querySelector('#btn-history-generate-today')?.addEventListener('click', () => generateIssue(section, true));
}

let observer = null;
function startObserver() {
  if (observer) return;
  observer = new MutationObserver(() => injectHistoryTools());
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('hashchange', () => setTimeout(injectHistoryTools, 80));
  setTimeout(injectHistoryTools, 200);
}

startObserver();
