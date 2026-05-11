import { db, functions, trackEvent } from '../firebase.js';
import { collection, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';
import { showToast } from '../components/toast.js';

const EVIDENCES = [
  { id: 'chat', icon: '📱', name: '카톡 캡처', desc: '말투와 답장 시간을 확인할 수 있음' },
  { id: 'receipt', icon: '🧾', name: '영수증', desc: '누가 얼마를 냈는지 확인할 수 있음' },
  { id: 'time', icon: '⏰', name: '약속 시간 캡처', desc: '도착 시간과 지각 여부를 확인할 수 있음' },
  { id: 'food', icon: '🍗', name: '남은 음식 사진', desc: '마지막 한 조각의 행방을 확인할 수 있음' },
  { id: 'bottle', icon: '🥤', name: '빈 음료수 병', desc: '누가 마셨는지 의심되는 증거' },
  { id: 'notice', icon: '📢', name: '단톡방 공지', desc: '공지 확인 여부를 다툴 수 있음' },
];

export async function renderCaseQuest(container) {
  injectQuestStyle();
  let categories = ['카톡', '연애', '음식', '정산', '직장', '생활', '친구', '가족', '이웃', '취미', '기타'];
  try {
    const snap = await getDocs(query(collection(db, 'categories'), orderBy('name', 'asc')));
    const loaded = snap.docs.map(d => d.data().name).filter(Boolean);
    if (loaded.length) categories = Array.from(new Set([...loaded, ...categories]));
  } catch {}

  const prefill = readPrefillCase();
  const state = {
    step: prefill ? 1 : 0,
    title: prefill?.title || '',
    situation: prefill?.summary || '',
    plaintiff: prefill?.plaintiffPosition || '',
    defendant: prefill?.defendantPosition || '',
    category: prefill?.category || categories[0] || '생활',
    evidence: '',
    fromOfficialPack: Boolean(prefill),
  };

  container.innerHTML = `
    <div class="quest-page">
      <div class="quest-header">
        <a href="#/topics" class="quest-back">‹</a>
        <div>
          <div class="quest-kicker">CASE QUEST · 사건 해결 모드</div>
          <div class="quest-title">🕵️ 생활사건 접수 퀘스트</div>
        </div>
        <button class="quest-skip" onclick="location.hash='#/submit-topic'">일반접수</button>
      </div>
      <div class="quest-shell">
        <section class="quest-stage" id="quest-stage"></section>
        <section class="quest-card" id="quest-card"></section>
      </div>
    </div>
  `;

  const render = () => {
    renderStage(container, state);
    renderCard(container, state, categories, render);
  };
  render();
  if (prefill) showToast('공식 사건팩 내용이 퀘스트에 채워졌습니다', 'success');
}

function readPrefillCase() {
  try {
    const raw = sessionStorage.getItem('sosoking_prefill_case');
    if (!raw) return null;
    sessionStorage.removeItem('sosoking_prefill_case');
    const data = JSON.parse(raw);
    if (!data?.title || !data?.summary) return null;
    return data;
  } catch { return null; }
}

function renderStage(container, state) {
  const stage = container.querySelector('#quest-stage');
  const places = [
    ['🚓', '소소 경찰서', '사건 상황을 접수합니다'],
    ['📚', '법률사무소', '양쪽 사정을 정리합니다'],
    ['🧾', '증거 보관함', '재미용 증거를 선택합니다'],
    ['📝', '사건접수처', '생활법정에 제출합니다'],
  ];
  stage.innerHTML = `
    <div class="quest-light"></div>
    <div class="quest-progress">
      ${places.map((p, i) => `<div class="quest-node ${i < state.step ? 'done' : i === state.step ? 'active' : ''}"><span>${p[0]}</span><strong>${p[1]}</strong></div>`).join('')}
    </div>
    <div class="quest-building-wrap">
      <div class="quest-building">
        <div class="quest-building-icon">${places[state.step]?.[0] || '⚖️'}</div>
        <div class="quest-building-name">${places[state.step]?.[1] || '생활법정'}</div>
        <div class="quest-building-sub">${places[state.step]?.[2] || '판결을 준비합니다'}</div>
        <div class="quest-building-door"></div>
      </div>
      <div class="quest-npc">
        <div class="npc-shadow"></div>
        <div class="npc-body">${state.step === 0 ? '👮' : state.step === 1 ? '👩‍💼' : state.step === 2 ? '🧑‍🔬' : '🧑‍⚖️'}</div>
        <div class="npc-label">${state.step === 0 ? '접수 경찰' : state.step === 1 ? '상담원' : state.step === 2 ? '증거 담당' : '법정 서기'}</div>
      </div>
      <div class="quest-player">
        <div class="npc-shadow"></div>
        <div class="npc-body">🧑‍💼</div>
        <div class="npc-label">나</div>
      </div>
    </div>
  `;
}

function renderCard(container, state, categories, rerender) {
  const card = container.querySelector('#quest-card');
  if (state.step === 0) {
    card.innerHTML = `
      <div class="quest-dialog"><strong>👮 접수 경찰</strong><span>무슨 일이 있었나요? 누가 이겼는지 말하기 전에, 먼저 사건 상황부터 정리합시다.</span></div>
      <label>사건명</label>
      <input id="q-title" maxlength="30" placeholder="예: 치킨 마지막 조각 사건" value="${escAttr(state.title)}">
      <label>사건 발생 상황</label>
      <textarea id="q-situation" maxlength="80" placeholder="예: 마지막 치킨 조각을 말없이 먹어서 분위기가 어색해졌습니다">${escHtml(state.situation)}</textarea>
      <label>사건 분류</label>
      <select id="q-category">${categories.map(c => `<option value="${escAttr(c)}" ${state.category === c ? 'selected' : ''}>${escHtml(c)}</option>`).join('')}</select>
      <button class="quest-main-btn" id="q-next">다음: 법률사무소 가기 →</button>
    `;
    bindInputs(card, state);
    card.querySelector('#q-next').onclick = () => {
      bindInputs(card, state);
      if (!state.title.trim() || !state.situation.trim()) return showToast('사건명과 발생 상황을 먼저 적어주세요', 'info');
      state.step = 1; rerender();
    };
    return;
  }

  if (state.step === 1) {
    card.innerHTML = `
      ${state.fromOfficialPack ? '<div class="official-prefill-note">🎮 공식 사건팩에서 선택한 사건입니다. 그대로 진행하거나 내용을 살짝 고쳐도 됩니다.</div>' : ''}
      <div class="quest-dialog"><strong>👩‍💼 상담원</strong><span>토론처럼 싸우지 말고, 양쪽이 왜 그렇게 생각하는지 사건 기록으로 남겨봅시다.</span></div>
      <div class="quest-case-mini">
        <strong>${escHtml(state.title)}</strong>
        <span>${escHtml(state.situation)}</span>
      </div>
      <label>문제 제기 내용</label>
      <textarea id="q-plaintiff" maxlength="100" placeholder="예: 마지막 조각은 물어보고 먹었어야 합니다">${escHtml(state.plaintiff)}</textarea>
      <label>상대측 설명</label>
      <textarea id="q-defendant" maxlength="100" placeholder="예: 아무도 안 먹길래 먹어도 되는 줄 알았습니다">${escHtml(state.defendant)}</textarea>
      <div class="quest-two-btns"><button class="quest-sub-btn" id="q-prev">← 경찰서</button><button class="quest-main-btn" id="q-next">다음: 증거 선택 →</button></div>
    `;
    bindInputs(card, state);
    card.querySelector('#q-prev').onclick = () => { bindInputs(card, state); state.step = 0; rerender(); };
    card.querySelector('#q-next').onclick = () => {
      bindInputs(card, state);
      if (!state.plaintiff.trim() || !state.defendant.trim()) return showToast('양쪽 사정을 모두 적어주세요', 'info');
      state.step = 2; rerender();
    };
    return;
  }

  if (state.step === 2) {
    card.innerHTML = `
      <div class="quest-dialog"><strong>🧑‍🔬 증거 담당</strong><span>진짜 증거가 아니라 재미용 증거 아이템입니다. 판결문에 재밌게 반영될 수 있어요.</span></div>
      <div class="evidence-grid">
        ${EVIDENCES.map(e => `<button class="evidence-card ${state.evidence === e.id ? 'active' : ''}" data-evidence="${e.id}"><span>${e.icon}</span><strong>${e.name}</strong><small>${e.desc}</small></button>`).join('')}
      </div>
      <div class="quest-two-btns"><button class="quest-sub-btn" id="q-prev">← 법률사무소</button><button class="quest-main-btn" id="q-next">다음: 접수처 제출 →</button></div>
    `;
    card.querySelectorAll('.evidence-card').forEach(btn => btn.onclick = () => { state.evidence = btn.dataset.evidence; rerender(); });
    card.querySelector('#q-prev').onclick = () => { state.step = 1; rerender(); };
    card.querySelector('#q-next').onclick = () => { state.step = 3; rerender(); };
    return;
  }

  const evidence = EVIDENCES.find(e => e.id === state.evidence);
  card.innerHTML = `
    <div class="quest-dialog"><strong>🧑‍⚖️ 법정 서기</strong><span>사건 기록이 준비됐습니다. 접수하면 사건 게시판에 공개되고 바로 생활법정에 입장할 수 있습니다.</span></div>
    <div class="case-file-preview">
      <div class="preview-kicker">사건 접수서 미리보기</div>
      <h2>${escHtml(state.title)}</h2>
      <p>${escHtml(state.situation)}</p>
      <div><b>문제 제기</b><span>${escHtml(state.plaintiff)}</span></div>
      <div><b>상대측 설명</b><span>${escHtml(state.defendant)}</span></div>
      <div><b>증거 아이템</b><span>${evidence ? `${evidence.icon} ${evidence.name}` : '선택 안 함'}</span></div>
    </div>
    <div class="quest-two-btns"><button class="quest-sub-btn" id="q-prev">← 증거 다시 선택</button><button class="quest-main-btn" id="q-submit">⚖️ 생활법정에 접수</button></div>
  `;
  card.querySelector('#q-prev').onclick = () => { state.step = 2; rerender(); };
  card.querySelector('#q-submit').onclick = async () => {
    const btn = card.querySelector('#q-submit');
    btn.disabled = true;
    btn.textContent = '접수 중...';
    try {
      const submitTopicFn = httpsCallable(functions, 'submitTopic');
      const evidenceText = evidence ? ` 증거 아이템: ${evidence.name}.` : '';
      const result = await submitTopicFn({
        title: state.title.trim(),
        summary: `${state.situation.trim()}${evidenceText}`.slice(0, 60),
        plaintiffPosition: state.plaintiff.trim(),
        defendantPosition: state.defendant.trim(),
        category: state.category,
      });
      trackEvent('case_quest_submit', { category: state.category, evidence: state.evidence || 'none', from_official_pack: state.fromOfficialPack });
      const topicId = result.data?.topicId;
      showToast('사건 접수 완료! 생활법정 대기실로 이동합니다', 'success');
      setTimeout(() => { location.hash = topicId ? `#/topic/${topicId}` : '#/topics'; }, 450);
    } catch (err) {
      showToast(err.message || '접수 실패', 'error');
      btn.disabled = false;
      btn.textContent = '⚖️ 생활법정에 접수';
    }
  };
}

function bindInputs(card, state) {
  const title = card.querySelector('#q-title');
  const situation = card.querySelector('#q-situation');
  const category = card.querySelector('#q-category');
  const plaintiff = card.querySelector('#q-plaintiff');
  const defendant = card.querySelector('#q-defendant');
  if (title) state.title = title.value;
  if (situation) state.situation = situation.value;
  if (category) state.category = category.value;
  if (plaintiff) state.plaintiff = plaintiff.value;
  if (defendant) state.defendant = defendant.value;
}

function injectQuestStyle() {
  if (document.getElementById('case-quest-style')) return;
  const style = document.createElement('style');
  style.id = 'case-quest-style';
  style.textContent = `
    .quest-page { min-height:100vh; background:radial-gradient(ellipse at 50% 0%, rgba(201,168,76,.14), transparent 50%), var(--navy); color:var(--cream); padding-bottom:80px; }
    .quest-header { position:sticky; top:0; z-index:50; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 18px; background:rgba(13,17,23,.94); border-bottom:1px solid rgba(201,168,76,.18); backdrop-filter:blur(12px); }
    [data-theme="light"] .quest-header { background:rgba(255,248,242,.96); }
    .quest-back { font-size:30px; color:var(--cream-dim); text-decoration:none; line-height:1; }
    .quest-kicker { font-size:9px; font-weight:900; color:var(--gold); letter-spacing:.14em; text-align:center; }
    .quest-title { font-family:var(--font-serif); font-size:17px; font-weight:900; color:var(--cream); }
    .quest-skip { border:1px solid rgba(201,168,76,.32); background:rgba(201,168,76,.08); color:var(--gold); border-radius:999px; padding:8px 11px; font-size:12px; font-weight:900; cursor:pointer; }
    .quest-shell { width:min(760px, calc(100% - 28px)); margin:16px auto 0; display:grid; gap:14px; }
    .quest-stage { position:relative; overflow:hidden; min-height:310px; border-radius:24px; border:1.5px solid rgba(201,168,76,.34); background:linear-gradient(180deg,#16263b 0%,#243f52 50%,#26301f 51%,#171f16 100%); box-shadow:0 18px 44px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.06); }
    [data-theme="light"] .quest-stage { background:linear-gradient(180deg,#cce8ff 0%,#eaf6ff 50%,#91b27a 51%,#d9c8a7 100%); box-shadow:0 12px 30px rgba(154,112,24,.14); }
    .quest-light { position:absolute; left:50%; top:-130px; width:420px; height:280px; transform:translateX(-50%); background:radial-gradient(circle, rgba(255,232,179,.36), transparent 68%); animation:questGlow 4s ease-in-out infinite alternate; }
    .quest-progress { position:absolute; left:12px; right:12px; top:12px; display:grid; grid-template-columns:repeat(4,1fr); gap:6px; z-index:5; }
    .quest-node { padding:8px 4px; border-radius:12px; background:rgba(0,0,0,.18); border:1px solid rgba(201,168,76,.16); text-align:center; opacity:.68; }
    [data-theme="light"] .quest-node { background:rgba(255,255,255,.68); }
    .quest-node span { display:block; font-size:20px; } .quest-node strong { display:block; font-size:9px; color:var(--cream-dim); margin-top:2px; }
    .quest-node.active, .quest-node.done { opacity:1; border-color:rgba(201,168,76,.42); background:rgba(201,168,76,.12); }
    .quest-node.active strong, .quest-node.done strong { color:var(--gold); }
    .quest-building-wrap { position:absolute; left:0; right:0; bottom:0; top:78px; }
    .quest-building { position:absolute; left:50%; bottom:42px; transform:translateX(-50%); width:190px; height:170px; border-radius:22px 22px 6px 6px; border:1.5px solid rgba(201,168,76,.32); background:linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.035)); text-align:center; padding-top:18px; box-shadow:0 14px 34px rgba(0,0,0,.28); }
    [data-theme="light"] .quest-building { background:rgba(255,255,255,.82); }
    .quest-building:before { content:''; position:absolute; left:24px; right:24px; top:-28px; height:46px; clip-path:polygon(50% 0,100% 100%,0 100%); background:linear-gradient(180deg,rgba(201,168,76,.78),rgba(103,64,34,.92)); }
    .quest-building-icon { position:relative; z-index:2; font-size:38px; margin-bottom:8px; }
    .quest-building-name { font-size:16px; font-weight:900; color:var(--gold); }
    .quest-building-sub { margin-top:4px; font-size:11px; color:var(--cream-dim); }
    .quest-building-door { width:54px; height:54px; margin:14px auto 0; border-radius:12px 12px 0 0; background:linear-gradient(180deg,#694126,#2f1d13); border:1px solid rgba(255,231,178,.2); }
    .quest-npc, .quest-player { position:absolute; bottom:42px; width:64px; text-align:center; z-index:6; }
    .quest-npc { left:22%; } .quest-player { right:22%; }
    .npc-body { font-size:38px; line-height:1; animation:questBob .85s ease-in-out infinite alternate; }
    .npc-label { display:inline-flex; margin-top:3px; padding:2px 7px; border-radius:999px; background:rgba(0,0,0,.24); color:var(--cream); font-size:10px; font-weight:900; }
    .npc-shadow { position:absolute; left:50%; bottom:18px; transform:translateX(-50%); width:30px; height:8px; border-radius:50%; background:rgba(0,0,0,.25); filter:blur(2px); }
    .quest-card { border-radius:22px; border:1.5px solid rgba(201,168,76,.26); background:linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.02)); padding:16px; box-shadow:0 12px 32px rgba(0,0,0,.22); }
    [data-theme="light"] .quest-card { background:rgba(255,255,255,.84); box-shadow:0 8px 24px rgba(154,112,24,.1); }
    .official-prefill-note { margin-bottom:12px; padding:10px 12px; border-radius:14px; border:1.5px solid rgba(201,168,76,.26); background:rgba(201,168,76,.1); color:var(--gold); font-size:12px; font-weight:900; line-height:1.55; }
    .quest-case-mini { margin-bottom:13px; padding:13px 14px; border-radius:16px; border:1px solid rgba(255,255,255,.08); background:rgba(0,0,0,.14); }
    [data-theme="light"] .quest-case-mini { background:rgba(154,112,24,.06); border-color:rgba(154,112,24,.12); }
    .quest-case-mini strong { display:block; color:var(--gold); font-family:var(--font-serif); font-size:17px; margin-bottom:4px; }
    .quest-case-mini span { display:block; color:var(--cream-dim); font-size:13px; line-height:1.6; }
    .quest-dialog { display:flex; gap:10px; flex-direction:column; padding:13px 14px; border-radius:16px; border:1px solid rgba(201,168,76,.2); background:rgba(201,168,76,.08); margin-bottom:15px; }
    .quest-dialog strong { color:var(--gold); font-size:13px; } .quest-dialog span { color:var(--cream-dim); font-size:13px; line-height:1.65; }
    .quest-card label { display:block; margin:14px 0 7px; font-size:12px; font-weight:900; color:var(--gold); letter-spacing:.04em; }
    .quest-card input, .quest-card textarea, .quest-card select { width:100%; border:1.5px solid rgba(201,168,76,.2); border-radius:14px; padding:13px 14px; background:rgba(255,255,255,.05); color:var(--cream); font-family:var(--font-sans); outline:none; }
    [data-theme="light"] .quest-card input, [data-theme="light"] .quest-card textarea, [data-theme="light"] .quest-card select { background:rgba(255,255,255,.88); }
    .quest-card textarea { min-height:88px; resize:vertical; }
    .quest-main-btn, .quest-sub-btn { border:none; border-radius:15px; padding:15px 12px; font-size:14px; font-weight:900; cursor:pointer; margin-top:16px; }
    .quest-main-btn { width:100%; background:linear-gradient(135deg,var(--gold),var(--gold-light)); color:#0d1117; }
    .quest-sub-btn { background:rgba(255,255,255,.06); color:var(--cream); border:1px solid rgba(201,168,76,.24); }
    .quest-two-btns { display:grid; grid-template-columns:.8fr 1.2fr; gap:10px; }
    .evidence-grid { display:grid; grid-template-columns:1fr 1fr; gap:9px; }
    .evidence-card { position:relative; border:1.5px solid rgba(201,168,76,.2); border-radius:16px; padding:13px 9px; background:rgba(255,255,255,.04); color:var(--cream); text-align:center; cursor:pointer; }
    [data-theme="light"] .evidence-card { background:rgba(255,255,255,.76); }
    .evidence-card.active { border-color:var(--gold); background:rgba(201,168,76,.12); box-shadow:0 0 0 3px rgba(201,168,76,.12); }
    .evidence-card span { display:block; font-size:28px; margin-bottom:5px; } .evidence-card strong { display:block; font-size:12px; color:var(--gold); } .evidence-card small { display:block; margin-top:3px; color:var(--cream-dim); font-size:10px; line-height:1.4; }
    .case-file-preview { border-radius:18px; border:1.5px solid rgba(201,168,76,.24); background:rgba(0,0,0,.12); padding:15px; }
    [data-theme="light"] .case-file-preview { background:rgba(255,255,255,.62); }
    .preview-kicker { font-size:10px; font-weight:900; letter-spacing:.1em; color:var(--gold); margin-bottom:6px; }
    .case-file-preview h2 { margin:0 0 8px; font-family:var(--font-serif); color:var(--cream); font-size:20px; }
    .case-file-preview p { margin:0 0 12px; color:var(--cream-dim); line-height:1.6; font-size:13px; }
    .case-file-preview div:not(.preview-kicker) { margin-top:9px; } .case-file-preview b { display:block; color:var(--gold); font-size:11px; margin-bottom:3px; } .case-file-preview span { display:block; color:var(--cream); font-size:13px; line-height:1.55; }
    @keyframes questGlow { from { opacity:.5; transform:translateX(-50%) scale(.95); } to { opacity:1; transform:translateX(-50%) scale(1.05); } }
    @keyframes questBob { from { transform:translateY(0); } to { transform:translateY(-6px); } }
    @media (max-width:520px) { .quest-stage { min-height:292px; } .quest-node strong { display:none; } .quest-node { padding:7px 2px; } .quest-building { width:154px; height:150px; bottom:36px; } .quest-building-icon { font-size:32px; } .quest-building-name { font-size:14px; } .quest-npc { left:8%; bottom:34px; } .quest-player { right:8%; bottom:34px; } .npc-body { font-size:32px; } .evidence-grid { grid-template-columns:1fr; } .quest-two-btns { grid-template-columns:1fr; } }
  `;
  document.head.appendChild(style);
}

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;'); }
function escAttr(s) { return escHtml(s); }
