import { getApp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import { getAuth, signOut } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  query,
  orderBy,
  limit,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { escapeHtml, escapeAttr, compactText } from '../js/utils/sanitize.js?v=20260630-3';

const app = getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, 'asia-northeast3');

const callables = {
  setVisibility: httpsCallable(functions, 'setAdminResultVisibility'),
  deletePost: httpsCallable(functions, 'deleteCourtPost'),
  deleteUserProfile: httpsCallable(functions, 'deleteUserProfile'),
  generateDaily: httpsCallable(functions, 'generateDailyAiNow'),
  syncStats: httpsCallable(functions, 'syncPublicStatsNow')
};

const TABS = [
  ['overview', '대시보드'],
  ['records', '사건·판결기록'],
  ['users', '회원'],
  ['ai', 'AI 관리'],
  ['usage', '사용량'],
  ['site', '사이트 설정'],
  ['biz', '사업자'],
  ['policy', '정책']
];

let currentTab = 'overview';
let currentUser = null;
let tabRenderVersion = 0;

function root() {
  return document.getElementById('admin-content');
}

function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const item = document.createElement('div');
  item.className = `toast ${type}`;
  item.textContent = message;
  container.appendChild(item);
  setTimeout(() => item.remove(), 3200);
}

function errorMessage(error, fallback = '요청 처리에 실패했습니다.') {
  return String(error?.message || fallback)
    .replace(/^FirebaseError:\s*/, '')
    .replace(/^functions\//, '')
    .slice(0, 240);
}

function fmtDate(value) {
  if (!value) return '-';
  const date = value.toDate ? value.toDate() : new Date(value);
  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function money(value) {
  return `${Math.round(Number(value || 0)).toLocaleString('ko-KR')}원`;
}

function num(value) {
  return Number(value || 0).toLocaleString('ko-KR');
}

function setBusy(button, busyText) {
  const oldText = button.textContent;
  button.disabled = true;
  button.textContent = busyText;
  return () => {
    button.disabled = false;
    button.textContent = oldText;
  };
}

function mini(label, value, sub = '') {
  return `<div style="text-align:center;padding:15px 8px;background:rgba(255,255,255,.035);border:1px solid var(--border);border-radius:12px;">
    <div style="font-size:18px;font-weight:900;color:var(--cream);">${escapeHtml(String(value))}</div>
    ${sub ? `<div style="font-size:10px;color:var(--gold);margin-top:2px;">${escapeHtml(String(sub))}</div>` : ''}
    <div style="font-size:10px;color:var(--cream-dim);margin-top:3px;">${escapeHtml(label)}</div>
  </div>`;
}

function tableWrap(headers, rows) {
  return `<div style="overflow-x:auto;"><table class="admin-table"><thead><tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${headers.length}" style="text-align:center;padding:32px;color:var(--cream-dim);">데이터 없음</td></tr>`}</tbody></table></div>`;
}

function simpleList(title, rows) {
  return `<div class="card"><div style="font-weight:800;color:var(--gold);margin-bottom:10px;">${escapeHtml(title)}</div>${rows.map(([a, b, c]) => `<div style="padding:8px 0;border-top:1px solid var(--border);font-size:12px;"><div style="font-weight:700;">${escapeHtml(a || '-')}</div><div style="color:var(--cream-dim);margin-top:2px;">${escapeHtml(b || '-')} · ${escapeHtml(c || '-')}</div></div>`).join('') || '<div style="color:var(--cream-dim);font-size:12px;">데이터 없음</div>'}</div>`;
}

function renderDashboard() {
  const container = root();
  if (!container || !currentUser) return;
  container.innerHTML = `
    <div>
      <div class="admin-header">
        <span class="logo">⚖️ 관리자 대시보드</span>
        <div style="display:flex;gap:10px;align-items:center;">
          <a href="/#/" style="font-size:12px;color:var(--cream-dim);text-decoration:none;">사이트 보기</a>
          <button type="button" id="admin-logout" style="background:none;border:none;color:var(--cream-dim);font-size:12px;cursor:pointer;">로그아웃</button>
        </div>
      </div>
      <div class="admin-shell">
        <div style="font-size:12px;color:var(--cream-dim);">관리자: ${escapeHtml(currentUser.email || currentUser.uid || '-')}</div>
        <div class="admin-nav">${TABS.map(([id, label]) => `<button type="button" class="admin-tab${currentTab === id ? ' active' : ''}" data-admin-tab="${escapeAttr(id)}">${escapeHtml(label)}</button>`).join('')}</div>
        <div id="tab-content"></div>
      </div>
    </div>`;

  container.querySelector('#admin-logout')?.addEventListener('click', () => signOut(auth));
  container.querySelectorAll('[data-admin-tab]').forEach(button => {
    button.addEventListener('click', () => {
      currentTab = button.dataset.adminTab || 'overview';
      renderDashboard();
    });
  });
  void loadTab(currentTab);
}

async function loadTab(tab) {
  const version = ++tabRenderVersion;
  const target = document.getElementById('tab-content');
  if (!target) return;
  target.innerHTML = '<div class="loading-dots" style="padding:40px 0;"><span></span><span></span><span></span></div>';

  try {
    if (tab === 'overview') await tabOverview(target);
    else if (tab === 'records') await tabRecords(target);
    else if (tab === 'users') await tabUsers(target);
    else if (tab === 'ai') await tabAi(target);
    else if (tab === 'usage') await tabUsage(target);
    else if (tab === 'site') await tabSite(target);
    else if (tab === 'biz') await tabBiz(target);
    else if (tab === 'policy') await tabPolicy(target);
  } catch (error) {
    console.error('admin tab load failed:', { tab, error });
    if (version !== tabRenderVersion || !target.isConnected) return;
    target.innerHTML = `<div class="card" style="color:var(--cream-dim);font-size:13px;">불러오기 실패<br><span style="font-size:11px;color:var(--red);">${escapeHtml(errorMessage(error))}</span></div>`;
  }
}

async function tabOverview(target) {
  const [cases, results, users, settingsSnap] = await Promise.all([
    getDocs(query(collection(db, 'cases'), orderBy('createdAt', 'desc'), limit(80))),
    getDocs(query(collection(db, 'results'), orderBy('createdAt', 'desc'), limit(80))),
    getDocs(query(collection(db, 'users'), orderBy('updatedAt', 'desc'), limit(80))),
    getDoc(doc(db, 'site_settings', 'config'))
  ]);
  const settings = settingsSnap.exists() ? settingsSnap.data() : {};
  const completed = cases.docs.filter(document => document.data().status === 'completed').length;
  const publicResults = results.docs.filter(document => document.data().isPublic === true);
  const daily = results.docs.filter(document => document.data().source === 'daily_ai').length;

  target.innerHTML = `
    <div class="admin-grid">
      ${mini('최근 사건', `${cases.size}건`, `${completed}건 완료`)}
      ${mini('공개 판결기록', `${publicResults.length}건`, `AI 자동 ${daily}건`)}
      ${mini('회원', `${users.size}명`)}
      ${mini('AI 자동 생성', settings.dailyAiEnabled === false ? '꺼짐' : '켜짐')}
    </div>
    <div class="card" style="font-size:13px;color:var(--cream-dim);line-height:1.8;margin-bottom:16px;">
      <strong style="color:var(--gold);">AI 자동 사건</strong>: ${settings.dailyAiEnabled === false ? '꺼짐' : '켜짐'} · 매일 오전 9시 기준 생성<br>
      <strong style="color:var(--gold);">접수 제한</strong>: 일 ${settings.dailyLimit || 3}건 · 쿨다운 ${settings.cooldownSec || 45}초
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
        <button type="button" class="admin-btn gold" id="sync-public-stats">공개 통계 지금 갱신</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;">
      <div>${simpleList('최근 사건', cases.docs.slice(0, 6).map(document => [document.data().caseTitle, document.data().status, fmtDate(document.data().createdAt)]))}</div>
      <div>${simpleList('최근 공개 판결기록', publicResults.slice(0, 6).map(document => [document.data().caseTitle, document.data().source === 'daily_ai' ? 'AI 자동' : '사용자', fmtDate(document.data().createdAt)]))}</div>
    </div>`;

  target.querySelector('#sync-public-stats')?.addEventListener('click', async event => {
    const restore = setBusy(event.currentTarget, '갱신 중...');
    try {
      const response = await callables.syncStats({});
      toast(`통계 갱신 완료 · 완료 사건 ${num(response.data?.completedCases)}건`, 'success');
    } catch (error) {
      toast(errorMessage(error, '통계 갱신에 실패했습니다.'), 'error');
    } finally {
      restore();
    }
  });
}

async function tabRecords(target) {
  const [caseSnap, resultSnap] = await Promise.all([
    getDocs(query(collection(db, 'cases'), orderBy('createdAt', 'desc'), limit(100))),
    getDocs(query(collection(db, 'results'), orderBy('createdAt', 'desc'), limit(120)))
  ]);
  const results = new Map(resultSnap.docs.map(document => [document.id, document.data()]));
  const rows = caseSnap.docs.map(document => {
    const caseData = document.data();
    const resultData = results.get(document.id) || {};
    const isPublic = resultData.isPublic === true;
    const source = resultData.source === 'daily_ai' || caseData.source === 'daily_ai' ? 'AI 자동' : '사용자';
    return `<tr>
      <td><b>${escapeHtml(caseData.caseTitle || resultData.caseTitle || '-')}</b><div style="font-size:11px;color:var(--cream-dim);">${escapeHtml(caseData.nickname || resultData.nickname || '익명')} · ${escapeHtml(fmtDate(caseData.createdAt || resultData.createdAt))}</div></td>
      <td>${escapeHtml(compactText(caseData.caseDescription || resultData.caseDescription || resultData.sentence || '', 86))}</td>
      <td>${escapeHtml(caseData.status || resultData.courtStage || '-')}<div style="font-size:10px;color:var(--cream-dim);margin-top:3px;">${escapeHtml(source)} · ${escapeHtml(resultData.judgeType || caseData.judgeType || '-')}</div></td>
      <td>${isPublic ? '공개' : '비공개'}</td>
      <td><div class="admin-actions">
        <a class="admin-btn gold" href="/#/result/${encodeURIComponent(document.id)}" style="text-decoration:none;">보기</a>
        <button type="button" class="admin-btn" data-record-action="visibility" data-case-id="${escapeAttr(document.id)}" data-next-public="${isPublic ? 'false' : 'true'}">${isPublic ? '비공개' : '공개'}</button>
        <button type="button" class="admin-btn red" data-record-action="delete" data-case-id="${escapeAttr(document.id)}">삭제</button>
      </div></td>
    </tr>`;
  });

  target.innerHTML = `<div class="card" style="font-size:12px;color:var(--cream-dim);line-height:1.7;margin-bottom:12px;">공개 상태와 삭제는 관리자 서버 함수에서 권한·안전성·연관 데이터를 확인한 뒤 처리합니다.</div>${tableWrap(['사건·판결기록', '내용', '상태', '공개', '관리'], rows)}`;

  target.querySelectorAll('[data-record-action]').forEach(button => {
    button.addEventListener('click', async () => {
      const caseId = button.dataset.caseId || '';
      if (!caseId) return;
      const action = button.dataset.recordAction;
      if (action === 'visibility') {
        const isPublic = button.dataset.nextPublic === 'true';
        if (isPublic && !confirm('판결문 전체를 안전검사한 뒤 공개합니다. 계속할까요?')) return;
        const restore = setBusy(button, '처리 중...');
        try {
          await callables.setVisibility({ caseId, isPublic });
          toast(isPublic ? '공개 상태로 변경했습니다.' : '비공개 상태로 변경했습니다.', 'success');
          await loadTab('records');
        } catch (error) {
          toast(errorMessage(error, '공개 상태를 변경하지 못했습니다.'), 'error');
          restore();
        }
      } else if (action === 'delete') {
        if (!confirm('사건, 판결, 투표, 댓글, 신고와 주소 별칭을 함께 삭제할까요?')) return;
        const restore = setBusy(button, '삭제 중...');
        try {
          const response = await callables.deletePost({ caseId });
          toast(`삭제 완료 · ${num(response.data?.deleted)}개 문서`, 'success');
          await loadTab('records');
        } catch (error) {
          toast(errorMessage(error, '삭제하지 못했습니다.'), 'error');
          restore();
        }
      }
    });
  });
}

async function tabUsers(target) {
  const snap = await getDocs(query(collection(db, 'users'), orderBy('updatedAt', 'desc'), limit(100)));
  target.innerHTML = `<div class="card" style="font-size:12px;color:var(--cream-dim);line-height:1.7;margin-bottom:12px;">프로필 삭제 시 해당 사용자가 소유한 닉네임 예약도 서버 트랜잭션으로 함께 해제됩니다. Firebase Authentication 계정 자체는 삭제되지 않습니다.</div>${tableWrap(['닉네임', '이메일', '가입방식', '관리'], snap.docs.map(document => {
    const user = document.data();
    return `<tr><td><b>${escapeHtml(user.nickname || '-')}</b><div style="font-size:10px;color:var(--cream-dim);">${escapeHtml(document.id)}</div></td><td>${escapeHtml(user.email || '-')}</td><td>${escapeHtml(user.provider || '-')}</td><td><button type="button" class="admin-btn red" data-delete-user="${escapeAttr(document.id)}">프로필 삭제</button></td></tr>`;
  }))}`;

  target.querySelectorAll('[data-delete-user]').forEach(button => {
    button.addEventListener('click', async () => {
      const userId = button.dataset.deleteUser || '';
      if (!userId || !confirm('프로필과 본인 소유 닉네임 예약을 삭제할까요?')) return;
      const restore = setBusy(button, '삭제 중...');
      try {
        const response = await callables.deleteUserProfile({ userId });
        toast(response.data?.nicknameReleased ? '프로필과 닉네임 예약을 삭제했습니다.' : '프로필을 삭제했습니다.', 'success');
        await loadTab('users');
      } catch (error) {
        toast(errorMessage(error, '프로필을 삭제하지 못했습니다.'), 'error');
        restore();
      }
    });
  });
}

async function tabAi(target) {
  const snap = await getDoc(doc(db, 'site_settings', 'config'));
  const data = snap.exists() ? snap.data() : {};
  const defaultPrompt = '공개 판결기록에 적합한 안전한 일상 소재를 사용하고, 사건접수·조사·원고·피고·판결 문서가 자연스럽게 이어지도록 작성한다.';
  target.innerHTML = `
    <form id="ai-form">
      <div class="card" style="margin-bottom:16px;">
        <div style="font-weight:900;color:var(--gold);margin-bottom:12px;">🤖 AI 자동 사건 생성</div>
        <label style="display:flex;align-items:center;gap:8px;margin-bottom:14px;font-size:14px;"><input type="checkbox" id="dailyOn" ${data.dailyAiEnabled === false ? '' : 'checked'}> 매일 자동 사건 생성 켜기</label>
        <div class="form-group"><label class="form-label">자동 생성 주제 힌트</label><textarea id="dailyHints" class="form-textarea" style="min-height:90px;" placeholder="예: 회사 간식, 가족 리모컨, 친구 약속">${escapeHtml(data.dailyAiTopicHints || '')}</textarea></div>
        <div class="form-group"><label class="form-label">AI 추가 지시문</label><textarea id="dailyPrompt" class="form-textarea" style="min-height:150px;">${escapeHtml(data.dailyAiPrompt || defaultPrompt)}</textarea></div>
        <div class="form-group"><label class="form-label">Gemini 모델명</label><input type="text" id="model" class="form-input" value="${escapeAttr(data.geminiModel || 'gemini-2.5-flash')}"></div>
      </div>
      <div class="card" style="margin-bottom:16px;">
        <div style="font-weight:900;color:var(--gold);margin-bottom:12px;">🚫 AI 안전 관리</div>
        <div class="form-group"><label class="form-label">금칙어</label><textarea id="banned" class="form-textarea" style="min-height:90px;">${escapeHtml((data.bannedWords || []).join(', '))}</textarea></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button type="submit" class="btn btn-primary" style="flex:1;min-width:180px;">AI 설정 저장</button>
        <button type="button" class="btn btn-secondary" id="generate-daily-now" style="flex:1;min-width:180px;">오늘의 AI 사건 지금 생성</button>
      </div>
    </form>
    <div class="disclaimer" style="margin-top:16px;font-size:12px;">자동 생성 결과는 저장 전에 개인정보·고위험 표현 검사를 통과해야 공개됩니다.</div>`;

  target.querySelector('#ai-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.submitter;
    const restore = button ? setBusy(button, '저장 중...') : () => {};
    try {
      await setDoc(doc(db, 'site_settings', 'config'), {
        dailyAiEnabled: target.querySelector('#dailyOn').checked,
        dailyAiTopicHints: target.querySelector('#dailyHints').value.trim(),
        dailyAiPrompt: target.querySelector('#dailyPrompt').value.trim(),
        geminiModel: target.querySelector('#model').value.trim() || 'gemini-2.5-flash',
        bannedWords: target.querySelector('#banned').value.split(',').map(value => value.trim()).filter(Boolean),
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast('AI 설정을 저장했습니다.', 'success');
    } catch (error) {
      toast(errorMessage(error, 'AI 설정 저장에 실패했습니다.'), 'error');
    } finally {
      restore();
    }
  });

  target.querySelector('#generate-daily-now')?.addEventListener('click', async event => {
    if (!confirm('현재 설정으로 오늘의 AI 사건을 생성하거나 다시 생성할까요?')) return;
    const restore = setBusy(event.currentTarget, '생성 중...');
    try {
      const response = await callables.generateDaily({});
      toast(`생성 완료 · ${response.data?.caseId || '오늘의 사건'}`, 'success');
    } catch (error) {
      toast(errorMessage(error, '오늘의 AI 사건 생성에 실패했습니다.'), 'error');
    } finally {
      restore();
    }
  });
}

async function tabUsage(target) {
  const settingsSnap = await getDoc(doc(db, 'site_settings', 'config'));
  const settings = settingsSnap.exists() ? settingsSnap.data() : {};
  const inputPrice = Number(settings.geminiInputPricePerM ?? 0.075);
  const outputPrice = Number(settings.geminiOutputPricePerM ?? 0.30);
  const krw = Number(settings.krwUsdRate ?? 1400);
  const monthlyBudgetKrw = Number(settings.monthlyBudgetKrw ?? 50000);
  const days = [];
  for (let index = 0; index < 60; index += 1) {
    const date = new Date();
    date.setDate(date.getDate() - index);
    days.push(new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date));
  }
  const snaps = await Promise.all(days.map(date => getDoc(doc(db, 'usage_stats', `daily_${date}`))));
  const rows = days.map((date, index) => {
    const data = snaps[index].exists() ? snaps[index].data() : {};
    const costUsd = Number(data.geminiInputTokens || 0) / 1e6 * inputPrice
      + Number(data.geminiOutputTokens || 0) / 1e6 * outputPrice;
    return {
      date,
      cases: data.caseCount || 0,
      requests: data.geminiRequests || 0,
      successful: data.geminiSuccessfulResponses || 0,
      input: data.geminiInputTokens || 0,
      output: data.geminiOutputTokens || 0,
      writes: data.firestoreWrites || 0,
      reads: data.firestoreReads || 0,
      invocations: data.functionInvocations || 0,
      costKrw: Math.round(costUsd * krw)
    };
  });
  const total = rows.reduce((acc, row) => ({
    cases: acc.cases + row.cases,
    requests: acc.requests + row.requests,
    successful: acc.successful + row.successful,
    input: acc.input + row.input,
    output: acc.output + row.output,
    costKrw: acc.costKrw + row.costKrw
  }), { cases: 0, requests: 0, successful: 0, input: 0, output: 0, costKrw: 0 });

  target.innerHTML = `<div class="admin-grid">
    ${mini('60일 사건', `${total.cases}건`)}
    ${mini('Gemini 시도/성공', `${total.requests} / ${total.successful}`)}
    ${mini('토큰 입/출', `${num(total.input)} / ${num(total.output)}`)}
    ${mini('예상 AI 비용', money(total.costKrw), monthlyBudgetKrw ? `${(total.costKrw / monthlyBudgetKrw * 100).toFixed(1)}%` : '')}
  </div>${tableWrap(['날짜', '사건', 'Gemini 시도/성공', '토큰', 'Firestore', 'Functions', '예상비용'], rows.filter(row => row.cases || row.requests).slice(0, 40).map(row => `<tr><td>${row.date}</td><td>${row.cases}</td><td>${row.requests} / ${row.successful}</td><td>${num(row.input)} / ${num(row.output)}</td><td>R ${num(row.reads)} / W ${num(row.writes)}</td><td>${row.invocations}</td><td>${money(row.costKrw)}</td></tr>`))}`;
}

async function tabSite(target) {
  const snap = await getDoc(doc(db, 'site_settings', 'config'));
  const data = snap.exists() ? snap.data() : {};
  target.innerHTML = `
    <form id="site-form">
      <div class="form-group"><label class="form-label">일일 접수 한도</label><input type="number" id="dl" class="form-input" value="${escapeAttr(data.dailyLimit || 3)}" min="1" max="20"></div>
      <div class="form-group"><label class="form-label">재접수 대기시간(초)</label><input type="number" id="cd" class="form-input" value="${escapeAttr(data.cooldownSec || 45)}" min="0" max="300"></div>
      <div class="form-group"><label class="form-label">전체 Gemini 일일 요청 한도</label><input type="number" id="gdl" class="form-input" value="${escapeAttr(data.globalAiDailyLimit ?? 100)}" min="1" max="10000"></div>
      <div class="form-group"><label class="form-label">계정당 Gemini 일일 요청 한도</label><input type="number" id="udl" class="form-input" value="${escapeAttr(data.userAiDailyLimit ?? 12)}" min="1" max="100"></div>
      <div class="form-group"><label class="form-label">Gemini 입력 단가 ($/1M 토큰)</label><input type="number" step="0.001" id="gip" class="form-input" value="${escapeAttr(data.geminiInputPricePerM ?? 0.075)}"></div>
      <div class="form-group"><label class="form-label">Gemini 출력 단가 ($/1M 토큰)</label><input type="number" step="0.001" id="gop" class="form-input" value="${escapeAttr(data.geminiOutputPricePerM ?? 0.30)}"></div>
      <div class="form-group"><label class="form-label">원-달러 환율</label><input type="number" id="krw" class="form-input" value="${escapeAttr(data.krwUsdRate ?? 1400)}"></div>
      <div class="form-group"><label class="form-label">월 예산 기준(원)</label><input type="number" id="budget" class="form-input" value="${escapeAttr(data.monthlyBudgetKrw ?? 50000)}"></div>
      <button type="submit" class="btn btn-primary">사이트 설정 저장</button>
    </form>`;

  target.querySelector('#site-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const restore = setBusy(event.submitter, '저장 중...');
    const dailyLimit = Number.parseInt(target.querySelector('#dl').value, 10);
    const cooldownSec = Number.parseInt(target.querySelector('#cd').value, 10);
    try {
      await Promise.all([
        setDoc(doc(db, 'site_settings', 'config'), {
          dailyLimit,
          cooldownSec,
          globalAiDailyLimit: Number.parseInt(target.querySelector('#gdl').value, 10),
          userAiDailyLimit: Number.parseInt(target.querySelector('#udl').value, 10),
          geminiInputPricePerM: Number.parseFloat(target.querySelector('#gip').value),
          geminiOutputPricePerM: Number.parseFloat(target.querySelector('#gop').value),
          krwUsdRate: Number.parseFloat(target.querySelector('#krw').value),
          monthlyBudgetKrw: Number.parseFloat(target.querySelector('#budget').value),
          updatedAt: serverTimestamp()
        }, { merge: true }),
        setDoc(doc(db, 'site_public', 'config'), {
          dailyLimit,
          cooldownSec,
          updatedAt: serverTimestamp()
        }, { merge: true })
      ]);
      toast('사이트 설정을 저장했습니다.', 'success');
    } catch (error) {
      toast(errorMessage(error, '사이트 설정 저장에 실패했습니다.'), 'error');
    } finally {
      restore();
    }
  });
}

async function tabBiz(target) {
  const snap = await getDoc(doc(db, 'site_settings', 'config'));
  const business = snap.exists() ? (snap.data().businessInfo || {}) : {};
  const fields = [
    ['companyName', '사업자명'],
    ['ceoName', '대표자명'],
    ['businessNumber', '사업자등록번호'],
    ['contact', '연락처'],
    ['email', '이메일'],
    ['address', '주소']
  ];
  target.innerHTML = `<form id="biz-form">${fields.map(([key, label]) => `<div class="form-group"><label class="form-label">${escapeHtml(label)}</label><input type="text" id="b_${escapeAttr(key)}" class="form-input" value="${escapeAttr(business[key] || '')}"></div>`).join('')}<button type="submit" class="btn btn-primary">저장</button></form>`;

  target.querySelector('#biz-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const restore = setBusy(event.submitter, '저장 중...');
    const businessInfo = {};
    fields.forEach(([key]) => {
      businessInfo[key] = target.querySelector(`#b_${key}`).value.trim();
    });
    try {
      await Promise.all([
        setDoc(doc(db, 'site_settings', 'config'), { businessInfo, updatedAt: serverTimestamp() }, { merge: true }),
        setDoc(doc(db, 'site_public', 'config'), { businessInfo, updatedAt: serverTimestamp() }, { merge: true })
      ]);
      toast('사업자 정보를 저장했습니다.', 'success');
    } catch (error) {
      toast(errorMessage(error, '사업자 정보 저장에 실패했습니다.'), 'error');
    } finally {
      restore();
    }
  });
}

async function tabPolicy(target) {
  const types = [
    ['terms', '이용약관'],
    ['privacy', '개인정보처리방침'],
    ['ai_disclaimer', 'AI 서비스 안내']
  ];
  const snaps = await Promise.all(types.map(([type]) => getDoc(doc(db, 'policy_docs', type))));
  const values = new Map(types.map(([type], index) => [type, snaps[index].exists() ? String(snaps[index].data().content || '') : '']));
  let active = 'terms';

  const render = () => {
    const label = types.find(([type]) => type === active)?.[1] || active;
    target.innerHTML = `
      <div class="card" style="font-size:12px;color:var(--cream-dim);line-height:1.7;margin-bottom:12px;">저장된 정책 문서가 없으면 이용자 화면의 최신 기본 고지가 사용됩니다.</div>
      <div style="display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap;">${types.map(([type, typeLabel]) => `<button type="button" class="admin-tab${active === type ? ' active' : ''}" data-policy-type="${escapeAttr(type)}">${escapeHtml(typeLabel)}</button>`).join('')}</div>
      <form id="policy-form">
        <div class="form-group"><label class="form-label">${escapeHtml(label)}</label><textarea id="policy-content" class="form-textarea" style="min-height:420px;" placeholder="비어 있으면 기본 고지를 사용합니다.">${escapeHtml(values.get(active) || '')}</textarea></div>
        <button type="submit" class="btn btn-primary">저장</button>
      </form>`;

    target.querySelectorAll('[data-policy-type]').forEach(button => {
      button.addEventListener('click', () => {
        active = button.dataset.policyType || 'terms';
        render();
      });
    });
    target.querySelector('#policy-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      const restore = setBusy(event.submitter, '저장 중...');
      const content = target.querySelector('#policy-content').value;
      try {
        await setDoc(doc(db, 'policy_docs', active), {
          content,
          updatedAt: serverTimestamp()
        }, { merge: true });
        values.set(active, content);
        toast('정책 문서를 저장했습니다.', 'success');
      } catch (error) {
        toast(errorMessage(error, '정책 저장에 실패했습니다.'), 'error');
      } finally {
        restore();
      }
    });
  };

  render();
}

export function mountAdminDashboard(user) {
  if (!user || user.isAnonymous) throw new Error('Verified administrator user is required');
  currentUser = user;
  currentTab = 'overview';
  renderDashboard();
}
