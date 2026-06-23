/* home.js — 소소킹 AI 놀이터 홈 */
import { functions } from '../firebase.js';
import { appState } from '../state.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from '../router.js';

const CHARACTERS = [
  ['🎒', '사춘기 중딩'],
  ['🙏', '사이비 교주'],
  ['🔮', '예언가'],
  ['🤩', '주접러'],
  ['👀', '참견러'],
  ['👴', '꼰대'],
];

const FEATURES = [
  { icon: '⚖️', title: '판결소', desc: '억울한 상황을 적으면 캐릭터 판사 3명이 각자 판결합니다.', path: '/playground/judge', bg: '#fff0ec' },
  { icon: '✨', title: '창작소', desc: '평범한 문장을 캐릭터 말투로 바꾸고 찰떡 이름도 지어줍니다.', path: '/playground/create', bg: '#fff8dd' },
  { icon: '🫂', title: '상담소', desc: '뻔한 위로 대신 캐릭터마다 완전히 다른 조언을 들어보세요.', path: '/playground/consult', bg: '#eef7ff' },
  { icon: '💬', title: '토론방', desc: '오늘의 생활 논쟁에 투표하고 다른 사람 의견을 확인합니다.', path: '/today', bg: '#effbf6' },
];

function call(name, payload = {}) {
  return httpsCallable(functions, name)(payload)
    .then(response => response.data || {})
    .catch(error => ({ ok: false, error }));
}

function materialCard(material) {
  return `<button class="king-material-card" data-material-id="${escHtml(material.id)}">
    <div class="king-material-card__meta">
      <span>${escHtml(material.category || '생활논쟁')}</span>
      <span>투표 ${Number(material.totalVotes || 0)}</span>
      <span>댓글 ${Number(material.commentCount || 0)}</span>
    </div>
    <h3>${escHtml(material.title || '소소자료')}</h3>
    <p>${escHtml(material.summary || '')}</p>
  </button>`;
}

function voteRow(label, count, total) {
  const percent = total > 0 ? Math.round((count / total) * 100) : 50;
  return `<div class="king-vote-preview__row"><span>${escHtml(label)}</span><div class="king-vote-preview__bar"><span style="width:${percent}%"></span></div><b>${percent}%</b></div>`;
}

export async function renderHome() {
  setMeta('소소킹 — AI와 노는 소소한 놀이터', '생활 고민을 AI 캐릭터가 판결하고, 바꿔 말하고, 상담하고, 함께 토론하는 참여형 커뮤니티');

  const element = document.getElementById('page-content');
  if (!element) return;
  element.innerHTML = '<div class="king-home"><div class="skeleton" style="height:350px;border-radius:30px"></div></div>';

  const [todayResult, debateResult, usageResult] = await Promise.all([
    call('getTodayMaterials'),
    call('getDebateSummary', { limit: 6 }),
    call('getKingPlaygroundUsage'),
  ]);

  const todayItems = Array.isArray(todayResult.materials) ? todayResult.materials : [];
  const debateItems = Array.isArray(debateResult.materials) ? debateResult.materials : [];
  const featured = todayItems[0] || debateItems[0] || null;
  const nickname = appState.nickname || appState.user?.displayName || '소소러';
  const used = Number(usageResult.usage?.judge || 0);
  const limit = Number(usageResult.dailyLimit || 3);
  const usagePercent = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));

  element.innerHTML = `<div class="king-home page-enter">
    <section class="king-hero">
      <div class="king-hero__content">
        <div class="king-kicker">🤖 AI 캐릭터 놀이터</div>
        <h1>${escHtml(nickname)}님,<br><em>오늘은 뭐가 억울해요?</em></h1>
        <p class="king-hero__desc">판결·말투변환·작명·상담·생활토론을 한곳에서 즐겨보세요. 정답을 주는 딱딱한 정보사이트가 아니라, 내 이야기를 꺼내면 캐릭터들이 반응하는 참여형 놀이터입니다.</p>
        <div class="king-hero__actions">
          <button class="king-primary" data-go="/playground/judge">⚖️ 지금 판결받기</button>
          <button class="king-secondary" data-go="/playground">AI킹 전체보기</button>
        </div>
        <div class="king-usage"><span>오늘 판결 ${used}/${limit}</span><div class="king-usage__bar"><span style="width:${usagePercent}%"></span></div><span>${appState.user ? '로그인 이용 중' : '로그인 후 이용 가능'}</span></div>
      </div>
      <div class="king-hero__visual" aria-hidden="true">
        <div class="king-orbit"><div class="king-orbit__core">🤖</div>${CHARACTERS.map(([emoji]) => `<div class="king-orbit__char">${emoji}</div>`).join('')}</div>
      </div>
    </section>

    <section class="king-section">
      <div class="king-section__head"><div><div class="king-section__eyebrow">KING PLAYGROUND</div><h2 class="king-section__title">어디에서 놀아볼까요?</h2><p class="king-section__desc">입력하면 바로 결과가 나오는 네 가지 핵심 공간입니다.</p></div></div>
      <div class="king-feature-grid">${FEATURES.map(feature => `<button class="king-feature" data-go="${feature.path}" style="--feature-bg:${feature.bg}"><span class="king-feature__arrow">↗</span><span class="king-feature__icon">${feature.icon}</span><div class="king-feature__title">${feature.title}</div><div class="king-feature__desc">${feature.desc}</div></button>`).join('')}</div>
    </section>

    <section class="king-section">
      <div class="king-section__head"><div><div class="king-section__eyebrow">CHARACTER CREW</div><h2 class="king-section__title">말 한마디도 평범하지 않은 6인방</h2></div></div>
      <div class="king-character-strip">${CHARACTERS.map(([emoji, name]) => `<div class="king-character-mini"><div class="king-character-mini__emoji">${emoji}</div><div class="king-character-mini__name">${name}</div></div>`).join('')}</div>
    </section>

    ${featured ? `<section class="king-section">
      <div class="king-section__head"><div><div class="king-section__eyebrow">TODAY'S DEBATE</div><h2 class="king-section__title">오늘의 논쟁 한판</h2></div><button class="king-ghost" data-go="/today">전체 보기</button></div>
      <div class="king-today-card">
        <div><div class="king-section__eyebrow">${escHtml(featured.category || '생활논쟁')}</div><h3>${escHtml(featured.title)}</h3><p>${escHtml(featured.summary || '')}</p><div class="king-inline-actions"><button class="king-primary" data-material-id="${escHtml(featured.id)}">투표하고 의견 보기</button></div></div>
        <div class="king-vote-preview">${voteRow(featured.agreeTitle || '찬성', Number(featured.agreeCount || 0), Number(featured.totalVotes || 0))}${voteRow(featured.disagreeTitle || '반대', Number(featured.disagreeCount || 0), Number(featured.totalVotes || 0))}</div>
      </div>
    </section>` : ''}

    <section class="king-section">
      <div class="king-section__head"><div><div class="king-section__eyebrow">HOT STORIES</div><h2 class="king-section__title">사람들이 이야기 중인 주제</h2></div><button class="king-ghost" data-go="/materials">자료실</button></div>
      <div class="king-material-grid">${debateItems.length ? debateItems.slice(0, 6).map(materialCard).join('') : '<div class="king-empty">토론 자료를 준비하고 있습니다.</div>'}</div>
    </section>
  </div>`;

  element.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.go)));
  element.querySelectorAll('[data-material-id]').forEach(button => button.addEventListener('click', () => navigate(`/material/${button.dataset.materialId}`)));
}
