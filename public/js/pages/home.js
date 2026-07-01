import { db } from '../firebase.js?v=20260630-3';
import { collection, query, where, orderBy, limit, getDocs, getCountFromServer } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { escapeHtml, compactText } from '../utils/sanitize.js?v=20260630-3';

const EXAMPLES = [
  { title: '모기 수면방해 사건', sentence: '제보자는 오늘 낮잠 20분을 긴급 보장받는다.', judgeType: '드립형', breakingNews: '속보: 정체불명의 야간 비행체가 침실 평온을 흔들었습니다.', funScoreAvg: 9.4, funScoreCount: 12 },
  { title: '엘리베이터 앞문닫힘 사건', sentence: '제보자는 다음 엘리베이터 탑승 시 마음속 박수를 1회 받는다.', judgeType: '과몰입형', breakingNews: '긴급: 시민 1명이 문앞 0.7초 차이로 이동권을 놓쳤습니다.', funScoreAvg: 8.8, funScoreCount: 7 },
  { title: '마지막 만두 사건', sentence: '마지막 만두는 발견자와 목격자가 반으로 나눈다.', judgeType: '논리집착형', breakingNews: '속보: 마지막 만두를 둘러싼 미세한 눈치싸움이 발생했습니다.', funScoreAvg: 8.5, funScoreCount: 5 }
];
const JUDGE_ICON = { '엄벌주의형':'🚨','감성형':'🥹','현실주의형':'🧊','과몰입형':'🔥','피곤형':'😴','논리집착형':'🧮','드립형':'🎭' };
const JUDGES = [
  { name: '엄벌주의형', icon: '🚨', desc: '먼지급 사안도 긴급안건' },
  { name: '감성형', icon: '🥹', desc: '서운함에 과하게 공감' },
  { name: '현실주의형', icon: '🧊', desc: '팩트로 조용히 정리' },
  { name: '과몰입형', icon: '🔥', desc: '사소함을 국가 의제로 확대' },
  { name: '피곤형', icon: '😴', desc: '귀찮지만 결정은 냄' },
  { name: '논리집착형', icon: '🧮', desc: '하찮음을 수치화' },
  { name: '드립형', icon: '🎭', desc: '정색하고 웃김' }
];
const TW_CASES = ['오늘 모기 때문에 잠을 못 잠','엘리베이터가 내 앞에서 닫힘','치약이 양치 중에 끝남','커피 마시려는데 얼음이 없음','라면은 스프 먼저인가 면 먼저인가','리모컨은 잡은 사람이 임자인가','마지막 만두는 먼저 본 사람이 먹어도 되는가'];
let _twTimer = null;
let _feedAll = [];

export async function renderHome(container) {
  if (_twTimer !== null) clearTimeout(_twTimer);
  container.innerHTML = `
    <div style="padding-bottom:60px;">
      <section class="hero-section">
        <img src="/app-icon.svg?v=20260702-10" alt="소소킹 로고" style="width:92px;height:92px;margin-bottom:14px;display:block;margin-left:auto;margin-right:auto;animation:wiggle 3.5s ease-in-out infinite;" />
        <div class="hero-badge">🚨 소소긴급위원회 · 한 줄 소소사건 자동 처리</div>
        <h1 class="hero-h1">별일 아닌데<br><span style="font-size:0.58em;color:var(--gold);font-style:italic;">왜 이렇게 중대하죠?</span></h1>
        <p class="hero-sub">모기, 라면, 엘리베이터, 리모컨까지<br><strong>긴급속보와 위원회 결정문으로</strong> 과하게 처리합니다.<br><span style="font-size:11px;opacity:0.5;">짧을수록 좋고, 하찮을수록 더 웃깁니다.</span></p>
        <div class="hero-tw">📡 현재 긴급처리 대기중: <strong id="tw-text"></strong><span class="cursor-blink" style="color:var(--gold);">|</span></div>
        <a href="#/submit" class="hero-cta hero-cta-pulse">🚨 한 줄 소소사건 접수하기</a>
        <div class="hero-disclaimer">무료 · 과장됨 · 웃김점수 · 실제효력 없음</div>
        <div class="stats-row">
          <div class="stat-item"><div class="stat-num" id="stat-count">847+</div><div class="stat-label">소소사건<br><span style="font-size:9px;opacity:0.7;">처리됨</span></div></div>
          <div class="stat-item"><div class="stat-num">1~10</div><div class="stat-label">웃김점수<br><span style="font-size:9px;opacity:0.7;">랭킹 반영</span></div></div>
          <div class="stat-item"><div class="stat-num">0%</div><div class="stat-label">현실효력<br><span style="font-size:9px;opacity:0.7;">대신 웃김</span></div></div>
        </div>
      </section>
      <div class="container" style="margin-top:30px;"><div class="court-shell" style="padding:18px;"><div class="court-kicker">ONE-LINE RULE</div><div class="court-title" style="font-size:21px;">무조건 한 줄, 무조건 별거 아닌 것</div><div class="court-desc" style="margin-top:6px;">설명이 길어질수록 평범해집니다. 모기, 엘리베이터, 치약, 라면처럼 아무도 회의하지 않을 일을 회의하는 게 핵심입니다.</div><div class="court-ledger"><div><strong>1줄</strong><span>입력</span></div><div><strong>6단계</strong><span>속보 처리</span></div><div><strong>10점</strong><span>웃김 평가</span></div></div></div></div>
      <div class="container" style="margin-top:44px;"><div style="font-size:13px;color:var(--cream-dim);margin-bottom:4px;">🎲 누가 처리하느냐에 따라 말도 안 되게 달라집니다</div><div style="font-family:var(--font-serif);font-size:20px;font-weight:700;margin-bottom:4px;">7명의 AI 위원 + 랜덤 긴급배정</div><div class="section-sub">속보는 진지하게, 결론은 하찮게</div><div class="judge-lineup"><div class="judge-card" onclick="location.hash='#/submit'"><div class="judge-card-icon">🎲</div><div class="judge-card-name">운명에 맡기기</div><div class="judge-card-desc" style="color:var(--gold);">위원회가 알아서 정색</div></div>${JUDGES.map(j => `<div class="judge-card" onclick="location.hash='#/submit'"><div class="judge-card-icon">${j.icon}</div><div class="judge-card-name">${escapeHtml(j.name)}</div><div class="judge-card-desc">${escapeHtml(j.desc)}</div></div>`).join('')}</div></div>
      <div class="container" style="margin-top:44px;"><div style="font-size:13px;color:var(--cream-dim);margin-bottom:4px;">😂 유저들이 평가한 공개 기록</div><div style="font-family:var(--font-serif);font-size:20px;font-weight:700;margin-bottom:12px;">웃김점수 후보</div><div style="position:relative;margin-bottom:12px;"><input type="text" id="feed-search" class="form-input" placeholder="🔍 소소사건명으로 검색..." style="font-size:14px;padding-left:14px;"></div><div id="feed-container" style="display:flex;flex-direction:column;gap:10px;">${EXAMPLES.map(c => _caseCard(null, c)).join('')}</div></div>
      <div class="container" style="margin-top:44px;"><div style="font-size:13px;color:var(--cream-dim);margin-bottom:4px;">🎬 작을수록 크게 터집니다</div><div style="font-family:var(--font-serif);font-size:20px;font-weight:700;margin-bottom:20px;">긴급 처리 순서</div><div style="display:flex;flex-direction:column;gap:16px;">${[['01','긴급속보 🚨','한 줄 소소사건을 뉴스특보처럼 크게 터뜨립니다.'],['02','현장 브리핑 🎙️','제보자의 미세한 억울함을 과장 보도합니다.'],['03','핵심 쟁점 🧩','별것 아닌 기준을 괜히 엄중한 안건으로 만듭니다.'],['04','위원회 결정 📋','소소긴급위원회가 정색하고 결론을 냅니다.'],['05','웃김점수 😂','유저들이 1~10점으로 평가해 소소킹 후보를 정합니다.']].map(([num, title, desc]) => `<div class="how-step"><div class="how-step-num" style="min-width:40px;height:40px;font-size:13px;">${num}</div><div><div style="font-weight:700;font-size:15px;margin-bottom:3px;">${escapeHtml(title)}</div><div style="font-size:13px;color:var(--cream-dim);">${escapeHtml(desc)}</div></div></div>`).join('')}</div></div>
      <div class="container" style="margin-top:20px;"><div class="disclaimer"><strong>⚠️ 오락 서비스 안내</strong><br>소소킹은 실제 기관이 아닌 AI 기반 오락형 서비스입니다. 결과에는 어떠한 현실 효력도 없습니다.</div></div>
      <section class="cta-section" style="margin-top:48px;"><div style="font-size:48px;margin-bottom:12px;animation:wiggle 1.5s infinite;">📡</div><h2>사소할수록 속보감입니다</h2><p>모기, 라면, 만두, 리모컨까지<br>한 줄로 접수하고 웃김점수를 받아보세요.</p><a href="#/submit" class="hero-cta hero-cta-pulse" style="font-size:16px;">🚨 지금 바로 긴급접수</a></section>
    </div>`;
  _startTypewriter();
  _loadCount();
  _loadPublicFeed();
}
function _fmtDate(ts) { if (!ts) return ''; const d = ts.toDate ? ts.toDate() : new Date(ts); return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function _scoreLabel(r) { return Number(r.funScoreCount || 0) ? `${Number(r.funScoreAvg || 0).toFixed(1)}점 · ${Number(r.funScoreCount || 0)}명` : '평가 대기'; }
function _applySearch() { const q = (document.getElementById('feed-search')?.value || '').trim(); const feedEl = document.getElementById('feed-container'); if (!feedEl) return; const filtered = q ? _feedAll.filter(([, r]) => (r.caseTitle || '').includes(q)) : _feedAll; feedEl.innerHTML = filtered.length ? filtered.map(([id, r]) => _caseCard(id, r)).join('') : `<div style="text-align:center;padding:36px 0;color:var(--cream-dim);font-size:14px;">🔍 "${escapeHtml(q)}"에 대한 소소사건 기록이 없습니다</div>`; }
function _caseCard(id, r) { const icon = JUDGE_ICON[r.judgeType] || '📡'; const href = id ? `onclick="location.hash='#/result/${encodeURIComponent(id)}'"` : `onclick="location.hash='#/submit'"`; const linkLabel = id ? '결정문 보기 →' : '나도 접수하기 →'; const dateStr = _fmtDate(r.createdAt); const summary = r.breakingNews || r.sentence || r.desc || ''; return `<div class="card example-card" ${href} style="padding:18px 20px;"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;"><div class="case-title" style="flex:1;">${escapeHtml(r.caseTitle || r.title || '제목 없음')}</div>${dateStr ? `<div style="font-size:11px;color:var(--cream-dim);white-space:nowrap;margin-top:2px;">${escapeHtml(dateStr)}</div>` : ''}</div><div style="font-size:13px;color:var(--cream-dim);margin-top:6px;line-height:1.6;">${escapeHtml(compactText(summary, 80))}</div><div class="case-meta" style="margin-top:10px;justify-content:space-between;"><span>${icon} ${escapeHtml(r.judgeType || '?')} 위원 · 😂 ${escapeHtml(_scoreLabel(r))}</span><span style="color:var(--gold);font-size:12px;">${linkLabel}</span></div></div>`; }
function _startTypewriter() { const el = document.getElementById('tw-text'); if (!el) return; let caseIdx = 0; let charIdx = 0; let deleting = false; function tick() { const current = TW_CASES[caseIdx]; if (!deleting) { charIdx++; el.textContent = current.substring(0, charIdx); if (charIdx >= current.length) { _twTimer = setTimeout(() => { deleting = true; _twTimer = setTimeout(tick, 40); }, 1800); return; } _twTimer = setTimeout(tick, 65); } else { charIdx--; el.textContent = current.substring(0, charIdx); if (charIdx <= 0) { deleting = false; caseIdx = (caseIdx + 1) % TW_CASES.length; _twTimer = setTimeout(tick, 80); return; } _twTimer = setTimeout(tick, 35); } } _twTimer = setTimeout(tick, 80); }
async function _loadCount() { try { const snap = await getCountFromServer(query(collection(db, 'cases'), where('status', '==', 'completed'))); const count = snap.data().count; const el = document.getElementById('stat-count'); if (el && count > 0) el.textContent = count.toLocaleString('ko-KR') + '건'; } catch { const el = document.getElementById('stat-count'); if (el) el.textContent = '847+'; } }
async function _loadPublicFeed() { try { const snap = await getDocs(query(collection(db, 'results'), where('isPublic', '==', true), orderBy('createdAt', 'desc'), limit(20))); if (snap.empty) return; _feedAll = snap.docs.map(d => [d.id, d.data()]); const feedEl = document.getElementById('feed-container'); if (!feedEl) return; const ranked = [..._feedAll].sort((a, b) => (Number(b[1].funScoreAvg || 0) * 100 + Number(b[1].funScoreCount || 0)) - (Number(a[1].funScoreAvg || 0) * 100 + Number(a[1].funScoreCount || 0))); feedEl.innerHTML = ranked.map(([id, r]) => _caseCard(id, r)).join(''); const searchEl = document.getElementById('feed-search'); if (searchEl) searchEl.addEventListener('input', _applySearch); } catch {} }
