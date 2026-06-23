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
  { icon: '⚖️', title: '판결소', desc: '성향이 다른 판사 3명이 같은 사건을 각자 판결합니다.', path: '/playground/judge', bg: '#fff0ec' },
  { icon: '✨', title: '창작소', desc: '문장을 성향별 말투로 바꾸고 찰떡 이름도 지어줍니다.', path: '/playground/create', bg: '#fff8dd' },
  { icon: '🫂', title: '상담소', desc: '공감부터 현실 조언까지 세 가지 관점을 들어보세요.', path: '/playground/consult', bg: '#eef7ff' },
  { icon: '💬', title: '토론실', desc: '자료실과 분리된 독립 찬반 토론 공간입니다.', path: '/debates', bg: '#effbf6' },
];

function call(name, payload = {}) {
  return httpsCallable(functions, name)(payload)
    .then(response => response.data || {})
    .catch(error => ({ ok: false, error }));
}

function voteRow(label, count, total) {
  const percent = total > 0 ? Math.round((count / total) * 100) : 50;
  return `<div class="king-vote-preview__row"><span>${escHtml(label)}</span><div class="king-vote-preview__bar"><span style="width:${percent}%"></span></div><b>${percent}%</b></div>`;
}

function debateCard(debate) {
  return `<button class="king-material-card" data-debate-id="${escHtml(debate.id)}"><div class="king-material-card__meta"><span>${escHtml(debate.category || '생활토론')}</span><span>투표 ${Number(debate.totalVotes || 0)}</span><span>댓글 ${Number(debate.commentCount || 0)}</span></div><h3>${escHtml(debate.title || '오늘의 토론')}</h3><p>${escHtml(debate.summary || '')}</p></button>`;
}

function todayMaterialSection(material) {
  if (!material) return '';
  return `<section class="king-section"><div class="king-section__head"><div><div class="king-section__eyebrow">TODAY'S MATERIAL</div><h2 class="king-section__title">오늘의 생활자료</h2><p class="king-section__desc">AI가 하루 한 번 정리하는 생활정보입니다.</p></div><button class="king-ghost" data-go="/materials">자료실 전체</button></div><div class="king-today-card"><div><div class="king-section__eyebrow">${escHtml(material.category || '생활정보')}</div><h3>${escHtml(material.title)}</h3><p>${escHtml(material.summary || '')}</p><div class="king-inline-actions"><button class="king-primary" data-material-id="${escHtml(material.id)}">자료 읽기</button></div></div><div class="king-vote-preview"><div style="padding:18px;border:1px solid var(--king-line);border-radius:18px;background:var(--king-card)"><b style="display:block;color:var(--king-ink);margin-bottom:8px">${material.aiGenerated ? 'AI 일일자료' : '관리자 등록 자료'}</b><span style="color:var(--king-muted);font-size:12px;line-height:1.65">자료실은 정보 열람 중심이며, 찬반 참여는 별도 토론실에서 진행합니다.</span></div></div></div></section>`;
}

function todayDebateSection(debate) {
  if (!debate) return '';
  return `<section class="king-section"><div class="king-section__head"><div><div class="king-section__eyebrow">TODAY'S DEBATE</div><h2 class="king-section__title">오늘의 독립 토론</h2><p class="king-section__desc">AI가 하루 한 번 만드는 별도 찬반 주제입니다.</p></div><button class="king-ghost" data-go="/debates">토론실 전체</button></div><div class="king-today-card"><div><div class="king-section__eyebrow">${escHtml(debate.category || '생활토론')}</div><h3>${escHtml(debate.title)}</h3><p>${escHtml(debate.summary || '')}</p><div class="king-inline-actions"><button class="king-primary" data-debate-id="${escHtml(debate.id)}">투표하고 의견 보기</button></div></div><div class="king-vote-preview">${voteRow(debate.agreeTitle || '찬성', Number(debate.agreeCount || 0), Number(debate.totalVotes || 0))}${voteRow(debate.disagreeTitle || '반대', Number(debate.disagreeCount || 0), Number(debate.totalVotes || 0))}</div></div></section>`;
}

export async function renderHome() {
  setMeta('소소킹 — 성향이 다른 AI와 노는 놀이터', 'AI 판결·창작·상담과 매일 생성되는 생활자료·독립 토론을 즐기는 참여형 놀이터');
  const element = document.getElementById('page-content');
  if (!element) return;
  element.innerHTML = '<div class="king-home"><div class="skeleton" style="height:350px;border-radius:30px"></div></div>';

  const [materialResult, todayDebateResult, debateListResult, usageResult] = await Promise.all([
    call('getTodayMaterials'),
    call('getTodayDebate'),
    call('getDebates', { limit: 6, order: 'comments' }),
    call('getKingPlaygroundUsage'),
  ]);

  const material = Array.isArray(materialResult.materials) ? materialResult.materials[0] || null : null;
  const todayDebate = todayDebateResult.debate || (Array.isArray(todayDebateResult.debates) ? todayDebateResult.debates[0] || null : null);
  const debates = Array.isArray(debateListResult.debates) ? debateListResult.debates : [];
  const nickname = appState.nickname || appState.user?.displayName || '소소러';
  const used = Number(usageResult.usage?.judge || 0);
  const limit = Number(usageResult.dailyLimit || 3);
  const usagePercent = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));

  element.innerHTML = `<div class="king-home page-enter"><section class="king-hero"><div class="king-hero__content"><div class="king-kicker">🤖 성향별 AI 판결 놀이터</div><h1>${escHtml(nickname)}님,<br><em>누구 관점으로 판결받을까요?</em></h1><p class="king-hero__desc">감성형은 마음을 보고, 원칙형은 책임을 따지고, 냉혈형은 손익만 계산합니다. AI 놀이터와 매일 새로 생성되는 자료·토론을 함께 이용해보세요.</p><div class="king-hero__actions"><button class="king-primary" data-go="/playground/judge">⚖️ 성향별 판결받기</button><button class="king-secondary" data-go="/today">📅 오늘의 콘텐츠</button></div><div class="king-usage"><span>오늘 판결 ${used}/${limit}</span><div class="king-usage__bar"><span style="width:${usagePercent}%"></span></div><span>${appState.user ? '로그인 이용 중' : '로그인 후 이용 가능'}</span></div></div><div class="king-hero__visual" aria-hidden="true"><div class="king-orbit"><div class="king-orbit__core">⚖️</div>${CHARACTERS.map(character => `<div class="king-orbit__char" style="--char-accent:${character.accent};--char-soft:${character.soft}">${character.emoji}</div>`).join('')}</div></div></section><section class="king-section"><div class="king-section__head"><div><div class="king-section__eyebrow">AI PLAYGROUND</div><h2 class="king-section__title">하고 싶은 AI 놀이를 바로 골라보세요</h2><p class="king-section__desc">판결·창작·상담과 독립 토론실로 연결됩니다.</p></div></div><div class="king-feature-grid">${FEATURES.map(feature => `<button class="king-feature" data-go="${feature.path}" style="--feature-bg:${feature.bg}"><span class="king-feature__arrow">↗</span><span class="king-feature__icon">${feature.icon}</span><div class="king-feature__title">${feature.title}</div><div class="king-feature__desc">${feature.desc}</div></button>`).join('')}</div></section><section class="king-section"><div class="king-section__head"><div><div class="king-section__eyebrow">JUDGMENT PERSONAS</div><h2 class="king-section__title">판단 기준이 완전히 다른 6가지 성향</h2><p class="king-section__desc">어떤 기준으로 보느냐에 따라 달라지는 결론을 비교합니다.</p></div><button class="king-ghost" data-go="/playground/judge">판사 선택하기</button></div><div class="king-character-strip">${CHARACTERS.map(character => `<button class="king-character-mini" data-go="/playground/judge" style="--char-accent:${character.accent};--char-soft:${character.soft}"><div class="king-character-mini__emoji">${character.emoji}</div><div class="king-character-mini__copy"><div class="king-character-mini__name">${character.name}</div><div class="king-character-mini__desc">${character.desc}</div></div></button>`).join('')}</div></section>${todayMaterialSection(material)}${todayDebateSection(todayDebate)}<section class="king-section"><div class="king-section__head"><div><div class="king-section__eyebrow">ACTIVE DEBATES</div><h2 class="king-section__title">사람들이 이야기 중인 토론</h2></div><button class="king-ghost" data-go="/debates">토론실</button></div><div class="king-material-grid">${debates.length ? debates.map(debateCard).join('') : '<div class="king-empty">토론 주제를 준비하고 있습니다.</div>'}</div></section></div>`;

  element.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.go)));
  element.querySelectorAll('[data-material-id]').forEach(button => button.addEventListener('click', () => navigate(`/material/${button.dataset.materialId}`)));
  element.querySelectorAll('[data-debate-id]').forEach(button => button.addEventListener('click', () => navigate(`/debate/${button.dataset.debateId}`)));
}
