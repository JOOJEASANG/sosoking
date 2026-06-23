/* home.js — 소소킹 AI 놀이터 홈 */
import { functions } from '../firebase.js';
import { appState } from '../state.js';
import { setMeta } from '../utils/seo.js';
import { escHtml } from '../utils/helpers.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { navigate } from '../router.js';

const CHARACTERS = [
  { emoji: '💗', name: '감성형', desc: '상처와 관계', accent: '#e85b86', soft: '#fff0f5' },
  { emoji: '⚖️', name: '원칙형', desc: '약속과 책임', accent: '#5367c9', soft: '#eef1ff' },
  { emoji: '👴', name: '꼰대형', desc: '예의와 기본', accent: '#9a6846', soft: '#f8efe8' },
  { emoji: '🧊', name: '냉혈형', desc: '감정 OFF', accent: '#52758c', soft: '#eaf4f8' },
  { emoji: '🔥', name: '사이다형', desc: '직설과 통쾌함', accent: '#ef5a38', soft: '#fff0eb' },
  { emoji: '🧮', name: '현실형', desc: '시간·돈·증거', accent: '#398b70', soft: '#eaf8f2' },
];

const FEATURES = [
  { icon: '⚖️', title: '판결소', desc: '감성·원칙·냉혈 등 성향이 다른 판사 3명이 같은 사건을 각자 판결합니다.', path: '/playground/judge', bg: '#fff0ec' },
  { icon: '✨', title: '창작소', desc: '평범한 문장을 선택한 성향의 말투로 바꾸고 찰떡 이름도 지어줍니다.', path: '/playground/create', bg: '#fff8dd' },
  { icon: '🫂', title: '상담소', desc: '공감부터 현실 조언까지 서로 다른 세 가지 관점을 한 번에 들어보세요.', path: '/playground/consult', bg: '#eef7ff' },
  { icon: '💬', title: '토론방', desc: '오늘의 생활 논쟁에 투표하고 다른 사람의 의견과 경험을 확인합니다.', path: '/playground/lounge', bg: '#effbf6' },
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
  setMeta('소소킹 — 성향이 다른 AI와 노는 놀이터', '생활 고민을 감성형·원칙형·냉혈형 등 AI 캐릭터가 판결하고, 바꿔 말하고, 상담하고, 함께 토론하는 참여형 커뮤니티');

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
        <div class="king-kicker">🤖 성향별 AI 판결 놀이터</div>
        <h1>${escHtml(nickname)}님,<br><em>누구 관점으로 판결받을까요?</em></h1>
        <p class="king-hero__desc">감성형은 마음을 보고, 원칙형은 책임을 따지고, 냉혈형은 손익만 계산합니다. 같은 사연을 전혀 다른 관점으로 판결하고 창작·상담·토론까지 이어가세요.</p>
        <div class="king-hero__actions">
          <button class="king-primary" data-go="/playground/judge">⚖️ 성향별 판결받기</button>
          <button class="king-secondary" data-go="/playground/create">✨ 말투 바꿔보기</button>
        </div>
        <div class="king-usage"><span>오늘 판결 ${used}/${limit}</span><div class="king-usage__bar"><span style="width:${usagePercent}%"></span></div><span>${appState.user ? '로그인 이용 중' : '로그인 후 이용 가능'}</span></div>
      </div>
      <div class="king-hero__visual" aria-hidden="true">
        <div class="king-orbit"><div class="king-orbit__core">⚖️</div>${CHARACTERS.map(character => `<div class="king-orbit__char" style="--char-accent:${character.accent};--char-soft:${character.soft}">${character.emoji}</div>`).join('')}</div>
      </div>
    </section>

    <section class="king-section">
      <div class="king-section__head"><div><div class="king-section__eyebrow">AI PLAYGROUND</div><h2 class="king-section__title">하고 싶은 AI 놀이를 바로 골라보세요</h2><p class="king-section__desc">판결·창작·상담·토론이 각각 독립된 핵심 메뉴로 연결됩니다.</p></div></div>
      <div class="king-feature-grid">${FEATURES.map(feature => `<button class="king-feature" data-go="${feature.path}" style="--feature-bg:${feature.bg}"><span class="king-feature__arrow">↗</span><span class="king-feature__icon">${feature.icon}</span><div class="king-feature__title">${feature.title}</div><div class="king-feature__desc">${feature.desc}</div></button>`).join('')}</div>
    </section>

    <section class="king-section">
      <div class="king-section__head"><div><div class="king-section__eyebrow">JUDGMENT PERSONAS</div><h2 class="king-section__title">판단 기준이 완전히 다른 6가지 성향</h2><p class="king-section__desc">정답 하나를 강요하지 않고, 어떤 기준으로 보느냐에 따라 달라지는 결론을 비교합니다.</p></div><button class="king-ghost" data-go="/playground/judge">판사 선택하기</button></div>
      <div class="king-character-strip">${CHARACTERS.map(character => `<button class="king-character-mini" data-go="/playground/judge" style="--char-accent:${character.accent};--char-soft:${character.soft}"><div class="king-character-mini__emoji">${character.emoji}</div><div class="king-character-mini__copy"><div class="king-character-mini__name">${character.name}</div><div class="king-character-mini__desc">${character.desc}</div></div></button>`).join('')}</div>
    </section>

    ${featured ? `<section class="king-section">
      <div class="king-section__head"><div><div class="king-section__eyebrow">TODAY'S DEBATE</div><h2 class="king-section__title">오늘의 논쟁 한판</h2></div><button class="king-ghost" data-go="/playground/lounge">토론방 열기</button></div>
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
