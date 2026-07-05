/* ai-character-panel-ui.js
   상세페이지 AI 캐릭터 사회자/토론/드립 패널 표시 및 누락/구버전 패널 보정
 */
import { auth, db, functions } from './firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { getDetailId } from './multi-detail/utils.js';

const RUNTIME_ID = `ai-panel-${Date.now()}-${Math.random().toString(16).slice(2)}`;
if (!window.__sosoAiCharacterPanelUiRuntime) window.__sosoAiCharacterPanelUiRuntime = RUNTIME_ID;

const callGenerateCharacterPanel = httpsCallable(functions, 'generateCharacterPanel');
const STYLE_ID = 'soso-ai-character-panel-style';
const generating = new Set();

const CHARACTER_META = {
  jujup: { id: 'jujup', name: '주접러', emoji: '😍', role: '호들갑 칭찬러' },
  rebel: { id: 'rebel', name: '반항아', emoji: '😤', role: '삐딱한 반대충' },
  bothsides: { id: 'bothsides', name: '갈팡러', emoji: '🤔', role: '양쪽 다 맞는 중립러' },
  fact: { id: 'fact', name: '팩폭러', emoji: '🧊', role: '핵심 요약러' },
  madcap: { id: 'madcap', name: '광기러', emoji: '🤪', role: '이상한 상상러' },
  conspiracy: { id: 'conspiracy', name: '음모론자', emoji: '👁️', role: '과몰입 추리러' },
  ajae: { id: 'ajae', name: '아재봇', emoji: '🧓', role: '썰렁 개그 담당' },
  overreact: { id: 'overreact', name: '과몰입러', emoji: '🎭', role: '대서사 담당' },
};
const CHARACTER_IDS = ['jujup', 'rebel', 'bothsides', 'fact', 'madcap', 'conspiracy', 'ajae', 'overreact'];
const DRIP_IDS = ['jujup', 'madcap', 'ajae', 'overreact'];

function isPrimaryRuntime() {
  return window.__sosoAiCharacterPanelUiRuntime === RUNTIME_ID;
}

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function clean(value, max = 120) {
  return String(value || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function isVotePost(post = {}) {
  return post.subtype === 'vote' || post.feedType === 'vote' || post.modules?.vote?.enabled === true || post.type === 'vote' || post.type === 'balance';
}

function isDripPost(post = {}) {
  return post.subtype === 'drip' || post.feedType === 'drip' || post.modules?.drip?.enabled === true || post.type === 'drip';
}

function isAiPanelPost(post = {}) {
  return post.type === 'multi' && (isVotePost(post) || isDripPost(post));
}

function voteOptions(post = {}, panel = {}) {
  const moduleOptions = post.modules?.vote?.options;
  const panelTargets = Array.isArray(panel.characters) ? panel.characters.map(ch => ch?.targetOption).filter(Boolean) : [];
  const source = Array.isArray(moduleOptions) && moduleOptions.length ? moduleOptions : [];
  const labels = source.map(item => clean(item?.text || item, 80)).filter(Boolean);
  if (labels.length >= 2) return labels.slice(0, 2);
  const uniqueTargets = [...new Set(panelTargets.map(v => clean(v, 80)).filter(Boolean))];
  if (uniqueTargets.length >= 2) return uniqueTargets.slice(0, 2);
  return ['왼쪽 선택지', '오른쪽 선택지'];
}

function hashSeed(value) {
  let hash = 2166136261;
  const text = String(value || 'sosoking');
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededShuffle(list, seed) {
  const arr = list.slice();
  let state = hashSeed(seed) || 1;
  for (let i = arr.length - 1; i > 0; i -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildTeamDraft(post = {}, options = []) {
  const seed = [post.id, post.title, post.desc, options.join('|')].map(v => clean(v, 160)).join('::');
  const shuffled = seededShuffle(CHARACTER_IDS, seed);
  return { left: shuffled.slice(0, 4), right: shuffled.slice(4, 8) };
}

function fallbackLines(id, team, target, opponent, replyTo) {
  const side = team === 'left' ? '왼쪽팀' : '오른쪽팀';
  const lines = {
    jujup: [`${target} 쪽은 그냥 지나가면 예의가 아닙니다.`, `${replyTo} 말도 이해하지만 이건 박수가 먼저 나오는 선택입니다.`, `${side} 입장에서는 ${target}가 댓글창을 더 살립니다.`],
    rebel: [`저는 ${target} 쪽입니다. 다들 ${opponent}로 쉽게 가려는 게 더 수상합니다.`, `처음 기준을 잘못 잡으면 계속 끌려갑니다.`, `${replyTo}가 분위기를 말해도 저는 후회를 먼저 봅니다.`],
    bothsides: [`저는 ${target} 쪽인데 말하면서도 ${opponent}가 계속 고개를 듭니다.`, `${replyTo} 말도 맞습니다. 그런데 ${target}에는 생활의 맛이 있습니다.`, `둘 다 들으니까 더 모르겠지만 오늘은 흔들리면서 ${target}입니다.`],
    fact: [`감정 빼고 보면 ${target} 쪽 기준이 더 선명합니다.`, `${replyTo} 말처럼 재미도 중요하지만 손해가 덜 남는 쪽을 봐야 합니다.`, `핵심은 지금의 기분이 아니라 나중의 후회입니다.`],
    madcap: [`${target}로 가는 순간 장르가 바뀝니다.`, `${replyTo}는 현실을 봤지만 저는 세계관을 봤습니다.`, `이건 평범한 VS가 아니라 현실이 버튼을 잘못 누른 포털입니다.`],
    conspiracy: [`저는 ${target} 뒤의 생활 패턴을 봤습니다. 이건 우연이 아닙니다.`, `${opponent}가 너무 그럴듯해 보이는 순간이 오히려 함정입니다.`, `${replyTo}가 세계관을 봤다면 저는 작전을 봤습니다.`],
    ajae: [`저는 ${target}에 한 표 올립니다. 표가 아니라 표정 관리입니다.`, `${opponent}도 좋지만 너무 뜨거우면 국밥도 식습니다.`, `${replyTo}가 크게 갔으니 저는 짧게 갑니다. ${target}입니다.`],
    overreact: [`이건 단순히 ${target}를 고르는 장면이 아닙니다. 주인공이 결심하는 컷입니다.`, `${replyTo} 말까지 들어오니까 이 토론은 이미 클라이맥스입니다.`, `${opponent}는 조연이고 ${target}는 음악 깔리는 선택지입니다.`],
  };
  const punchline = {
    jujup: `${target}는 선택이 아니라 축제입니다.`,
    rebel: `저는 일단 ${target}. 반대부터 해야 토론소가 열립니다.`,
    bothsides: `제 결론은 ${target}입니다. 물론 3초 뒤에 바뀔 수 있습니다.`,
    fact: `정리하면 ${target}. 이건 후회 관리입니다.`,
    madcap: `${target} 누르는 순간 현실이 오늘 업데이트를 잘못 눌렀습니다.`,
    conspiracy: `${target}는 선택지가 아닙니다. 생활 질서 회복 작전입니다.`,
    ajae: `${target}로 가야 합니다. 선택은 짧고 후회는 깁니다.`,
    overreact: `${target}. 이 장면은 엔딩 크레딧 올라갈 때 박수 나옵니다.`,
  };
  return { lines: lines[id] || lines.jujup, punchline: punchline[id] || punchline.jujup };
}

function buildVoteCharacters(post, panel = {}) {
  const options = voteOptions(post, panel);
  const draft = buildTeamDraft(post, options);
  const make = (id, team, index) => {
    const target = team === 'left' ? options[0] : options[1];
    const opponent = team === 'left' ? options[1] : options[0];
    const other = team === 'left' ? draft.right : draft.left;
    const replyTo = CHARACTER_META[other[index % other.length]]?.name || '';
    const tone = fallbackLines(id, team, target, opponent, replyTo);
    const meta = CHARACTER_META[id];
    return { ...meta, team, targetOption: target, replyTo, stance: `${target} 편 · ${meta.role}`, lines: tone.lines, punchline: tone.punchline };
  };
  return [...draft.left.map((id, i) => make(id, 'left', i)), ...draft.right.map((id, i) => make(id, 'right', i))];
}

function buildDripCharacters(post = {}) {
  const topic = clean(post.title || post.modules?.drip?.prompt || post.desc || '이 상황', 80);
  const lines = {
    jujup: { replyTo: '', stance: '소재 띄우기', lines: [`${topic}, 이건 그냥 지나가면 드립 예의가 아닙니다.`, '제목부터 이미 댓글창 입장권입니다.', '한 줄만 잘 붙이면 저장감입니다.'], punchline: '이 상황은 그냥 지나가면 예의가 아닙니다.' },
    madcap: { replyTo: '주접러', stance: '세계관 확장', lines: ['이건 현실이 잠깐 서버 오류 낸 장면입니다.', '주접러가 박수 치는 사이 저는 세계관 설정집을 열었습니다.', `${topic}은 상황이 아니라 다음 시즌 예고편에 가깝습니다.`], punchline: '현실이 오늘 업데이트를 잘못 눌렀습니다.' },
    ajae: { replyTo: '광기러', stance: '짧은 말장난', lines: ['드립은 짧아야 제맛입니다. 길면 국밥도 식습니다.', '광기러님 세계관은 큰데 저는 한 숟갈만 얹겠습니다.', '이 소재는 웃기려고 한 게 아니라 웃기게 태어났습니다.'], punchline: '이건 드립이 아니라 드립커피처럼 천천히 내려온 웃음입니다.' },
    overreact: { replyTo: '아재봇', stance: '영화처럼 키움', lines: ['이건 그냥 상황이 아니라 3부작의 시작입니다.', '아재봇이 분위기를 얼렸고 이제 제가 배경음악을 깔겠습니다.', '지금은 웃지만 2화부터 장르가 바뀔 수 있습니다.'], punchline: '이 장면, 엔딩 크레딧 올라갈 때 박수 나옵니다.' },
  };
  return DRIP_IDS.map(id => ({ ...CHARACTER_META[id], team: 'drip', targetOption: '', ...lines[id] }));
}

function buildFallbackPanel(post = {}) {
  const vote = isVotePost(post);
  const characters = vote ? buildVoteCharacters(post, {}) : buildDripCharacters(post);
  const title = clean(post.title || post.desc || '오늘의 주제', 100);
  return {
    enabled: true,
    status: 'client-fallback',
    kind: vote ? 'vote' : 'drip',
    headline: vote ? '운영봇이 4대4 토론소를 열었습니다' : '운영봇이 드립소를 열었습니다',
    imageRead: '',
    host: {
      id: 'opsbot',
      name: '운영봇',
      emoji: '🤖',
      role: '사회자',
      opening: vote ? `오늘 안건은 “${title}”입니다. 캐릭터 8명이 4대4로 나눠 먼저 붙어봅니다.` : `오늘 드립 소재는 “${title}”입니다. 캐릭터들이 먼저 한 줄씩 받아칩니다.`,
      summary: vote ? '왼쪽/오른쪽 입장이 갈릴 수 있는 주제입니다.' : '짧게 받을수록 더 웃긴 소재입니다.',
      question: vote ? '투표하고 내 의견도 남겨보세요.' : '더 웃긴 한 줄 드립을 남겨보세요.',
    },
    characters,
    bestLines: vote ? ['이건 기분 문제가 아니라 후회 관리입니다.', '선택지가 아니라 생활 질서 회복 작전입니다.'] : ['현실이 오늘 업데이트를 잘못 눌렀습니다.', '이 상황은 그냥 지나가면 예의가 아닙니다.'],
    commentPrompt: vote ? '어느 팀 말이 더 설득됐는지 댓글로 이어주세요.' : '더 웃긴 드립을 아래에 바로 남겨주세요.',
  };
}

function normalizePanelForDisplay(panel, post) {
  const normalized = { ...(panel || {}) };
  normalized.kind = normalized.kind || (isVotePost(post) ? 'vote' : 'drip');
  const chars = Array.isArray(normalized.characters) ? normalized.characters : [];
  if (normalized.kind === 'vote') {
    const uniqueIds = new Set(chars.map(ch => ch?.id || ch?.name).filter(Boolean));
    const hasFullTeams = chars.length >= 8 && uniqueIds.size >= 8 && chars.filter(ch => ch.team === 'left').length === 4 && chars.filter(ch => ch.team === 'right').length === 4;
    if (!hasFullTeams) {
      normalized.characters = buildVoteCharacters(post, normalized);
      normalized.headline = normalized.headline || '운영봇이 랜덤 4대4 토론소를 열었습니다';
      normalized.commentPrompt = normalized.commentPrompt || '투표하고 어느 팀 말이 더 웃겼는지도 댓글로 남겨주세요.';
      normalized._displayUpgraded = true;
    }
  } else if (chars.length < 4) {
    normalized.characters = buildDripCharacters(post);
    normalized.headline = normalized.headline || '운영봇이 드립소를 열었습니다';
    normalized.commentPrompt = normalized.commentPrompt || '더 웃긴 드립을 아래에 바로 남겨주세요.';
    normalized._displayUpgraded = true;
  }
  return normalized;
}

function teamLabel(ch, panel) {
  if (panel.kind !== 'vote') return '';
  if (ch.team === 'left') return ch.targetOption ? `왼쪽팀 · ${ch.targetOption}` : '왼쪽팀';
  if (ch.team === 'right') return ch.targetOption ? `오른쪽팀 · ${ch.targetOption}` : '오른쪽팀';
  return ch.targetOption || '';
}

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .ai-character-panel{display:block!important;visibility:visible!important;opacity:1!important;margin:18px 0;border-radius:26px;border:1px solid rgba(255,107,74,.18);background:linear-gradient(135deg,rgba(255,255,255,.98),rgba(248,250,252,.94));box-shadow:0 16px 38px rgba(15,23,42,.065);overflow:hidden}
    .ai-character-panel__head{padding:18px;border-bottom:1px solid rgba(148,163,184,.16)}
    .ai-character-panel__badge{display:inline-flex;align-items:center;height:28px;padding:0 11px;border-radius:999px;background:rgba(255,107,74,.11);color:#ef4b2f;font-size:11px;font-weight:950}
    .ai-character-panel__title{margin-top:10px;font-size:clamp(19px,4vw,24px);font-weight:950;line-height:1.25;letter-spacing:-.055em;color:var(--color-text-primary)}
    .ai-host-card{margin:14px 18px;padding:16px;border-radius:22px;background:rgba(17,24,39,.94);color:#fff;box-shadow:0 14px 28px rgba(17,24,39,.17)}
    .ai-host-card__top,.ai-character-card__top{display:flex;align-items:center;gap:10px}.ai-host-card__avatar,.ai-character-card__avatar{width:38px;height:38px;display:inline-flex;align-items:center;justify-content:center;border-radius:14px;background:rgba(255,255,255,.13);font-size:22px;flex-shrink:0}.ai-host-card__name,.ai-character-card__name{font-size:14px;font-weight:950;letter-spacing:-.03em}.ai-host-card__role,.ai-character-card__role{margin-top:2px;font-size:11px;font-weight:800;opacity:.72}.ai-host-card__text{margin-top:12px;font-size:14px;font-weight:750;line-height:1.6;letter-spacing:-.03em}.ai-host-card__question{margin-top:10px;padding:11px 12px;border-radius:16px;background:rgba(255,255,255,.10);font-size:13px;font-weight:900;line-height:1.5}
    .ai-character-panel__image-read{margin:0 18px 12px;padding:13px 14px;border-radius:18px;background:rgba(255,107,74,.075);border:1px solid rgba(255,107,74,.14);color:var(--color-text-muted);font-size:13px;font-weight:750;line-height:1.55}
    .ai-character-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;padding:0 18px 16px}.ai-character-card{padding:14px;border-radius:20px;background:var(--color-surface);border:1px solid rgba(148,163,184,.16);box-shadow:0 8px 20px rgba(15,23,42,.045)}.ai-character-card--left{border-color:rgba(59,130,246,.24);background:linear-gradient(180deg,rgba(59,130,246,.055),var(--color-surface))}.ai-character-card--right{border-color:rgba(255,107,74,.26);background:linear-gradient(180deg,rgba(255,107,74,.065),var(--color-surface))}.ai-character-card__avatar{background:rgba(255,107,74,.10)}.ai-character-card--left .ai-character-card__avatar{background:rgba(59,130,246,.12)}
    .ai-character-card__team{display:inline-flex;margin-top:10px;min-height:24px;align-items:center;padding:0 9px;border-radius:999px;background:rgba(15,23,42,.055);color:var(--color-text-muted);font-size:11px;font-weight:950}.ai-character-card--left .ai-character-card__team{background:rgba(59,130,246,.12);color:#2563eb}.ai-character-card--right .ai-character-card__team{background:rgba(255,107,74,.13);color:#ef4b2f}.ai-character-card__reply{margin-top:8px;color:var(--color-text-muted);font-size:11px;font-weight:850}.ai-character-card__stance{margin:11px 0 8px;color:#ef4b2f;font-size:12px;font-weight:950}.ai-character-card--left .ai-character-card__stance{color:#2563eb}.ai-character-card__line{margin:6px 0 0;color:var(--color-text-primary);font-size:13px;font-weight:760;line-height:1.55;letter-spacing:-.025em}.ai-character-card__punch{margin-top:10px;padding:10px 11px;border-radius:14px;background:rgba(255,107,74,.09);color:var(--color-text-primary);font-size:13px;font-weight:950;line-height:1.45}.ai-character-card--left .ai-character-card__punch{background:rgba(59,130,246,.09)}
    .ai-character-panel__best{margin:0 18px 16px;padding:14px;border-radius:20px;background:rgba(15,23,42,.035);border:1px solid rgba(148,163,184,.14)}.ai-character-panel__best-title{font-size:12px;font-weight:950;color:var(--color-text-muted);margin-bottom:8px}.ai-character-panel__best-list{display:flex;gap:7px;flex-wrap:wrap}.ai-character-panel__best-list span{display:inline-flex;padding:7px 10px;border-radius:999px;background:#fff;border:1px solid rgba(148,163,184,.18);color:var(--color-text-primary);font-size:12px;font-weight:850}.ai-character-panel__footer{padding:14px 18px 18px;border-top:1px solid rgba(148,163,184,.14);color:var(--color-text-muted);font-size:13px;font-weight:850;line-height:1.5}.ai-character-panel--loading{padding:18px;color:var(--color-text-muted);font-size:13px;font-weight:850}
    @media(max-width:1100px){.ai-character-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:820px){.ai-character-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function renderPanel(panel) {
  const host = panel.host || {};
  const characters = Array.isArray(panel.characters) ? panel.characters : [];
  const bestLines = Array.isArray(panel.bestLines) ? panel.bestLines : [];
  const badge = panel.kind === 'vote' ? 'AI 캐릭터 4대4 토론' : 'AI 캐릭터 드립 참여';
  return `
    <section class="ai-character-panel" data-ai-character-panel-root="1">
      <div class="ai-character-panel__head"><div class="ai-character-panel__badge">${badge}</div><div class="ai-character-panel__title">${esc(panel.headline || 'AI 캐릭터가 먼저 열어본 판')}</div></div>
      <div class="ai-host-card"><div class="ai-host-card__top"><div class="ai-host-card__avatar">${esc(host.emoji || '🤖')}</div><div><div class="ai-host-card__name">${esc(host.name || '운영봇')}</div><div class="ai-host-card__role">${esc(host.role || '사회자')}</div></div></div><div class="ai-host-card__text">${esc(host.opening || '').replace(/\n/g, '<br>')}</div>${host.summary ? `<div class="ai-host-card__text">${esc(host.summary).replace(/\n/g, '<br>')}</div>` : ''}${host.question ? `<div class="ai-host-card__question">${esc(host.question)}</div>` : ''}</div>
      ${panel.imageRead ? `<div class="ai-character-panel__image-read">📷 이미지 포인트: ${esc(panel.imageRead)}</div>` : ''}
      ${characters.length ? `<div class="ai-character-grid">${characters.map(ch => {
        const team = teamLabel(ch, panel);
        const teamClass = panel.kind === 'vote' && (ch.team === 'left' || ch.team === 'right') ? ` ai-character-card--${ch.team}` : '';
        return `<article class="ai-character-card${teamClass}"><div class="ai-character-card__top"><div class="ai-character-card__avatar">${esc(ch.emoji || '💬')}</div><div><div class="ai-character-card__name">${esc(ch.name || 'AI 캐릭터')}</div><div class="ai-character-card__role">${esc(ch.role || '')}</div></div></div>${team ? `<div class="ai-character-card__team">${esc(team)}</div>` : ''}${ch.replyTo ? `<div class="ai-character-card__reply">↳ ${esc(ch.replyTo)} 말에 받아치기</div>` : ''}${ch.stance ? `<div class="ai-character-card__stance">${esc(ch.stance)}</div>` : ''}${(Array.isArray(ch.lines) ? ch.lines : []).map(line => `<p class="ai-character-card__line">${esc(line)}</p>`).join('')}${ch.punchline ? `<div class="ai-character-card__punch">“${esc(ch.punchline)}”</div>` : ''}</article>`;
      }).join('')}</div>` : ''}
      ${bestLines.length ? `<div class="ai-character-panel__best"><div class="ai-character-panel__best-title">바로 써먹기 좋은 한 줄</div><div class="ai-character-panel__best-list">${bestLines.map(line => `<span>${esc(line)}</span>`).join('')}</div></div>` : ''}
      ${panel.commentPrompt ? `<div class="ai-character-panel__footer">${esc(panel.commentPrompt)}</div>` : ''}
    </section>`;
}

function renderLoading() {
  return `<section class="ai-character-panel ai-character-panel--loading" data-ai-character-panel-root="1">🤖 운영봇이 제목·내용·이미지를 읽고 캐릭터 판을 여는 중입니다...</section>`;
}

function dedupePanels(root = document) {
  const panels = [...root.querySelectorAll('[data-ai-character-panel-root]')];
  panels.slice(1).forEach(el => el.remove());
}

async function maybeGenerate(postId, post, mountAfter) {
  if (generating.has(postId)) return;
  if (!auth.currentUser || auth.currentUser.uid !== post.authorId) return;
  generating.add(postId);
  const existing = document.querySelector('[data-ai-character-panel-root]');
  if (!existing) mountAfter.insertAdjacentHTML('afterend', renderLoading());
  dedupePanels(document);
  try {
    await callGenerateCharacterPanel({ postId });
    const snap = await getDoc(doc(db, 'feeds', postId));
    const next = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    const panelRoot = document.querySelector('[data-ai-character-panel-root]');
    if (panelRoot && next?.aiCharacterPanel?.enabled) panelRoot.outerHTML = renderPanel(normalizePanelForDisplay(next.aiCharacterPanel, next));
    else if (panelRoot?.classList.contains('ai-character-panel--loading')) panelRoot.outerHTML = renderPanel(buildFallbackPanel(post));
  } catch (error) {
    console.warn('[ai-character-panel-ui] generation failed', error);
    const panelRoot = document.querySelector('[data-ai-character-panel-root]');
    if (panelRoot?.classList.contains('ai-character-panel--loading')) panelRoot.outerHTML = renderPanel(buildFallbackPanel(post));
    else if (!panelRoot && mountAfter) mountAfter.insertAdjacentHTML('afterend', renderPanel(buildFallbackPanel(post)));
  } finally {
    generating.delete(postId);
    dedupePanels(document);
  }
}

async function enhance() {
  if (!isPrimaryRuntime()) return;
  injectStyle();
  const postId = getDetailId();
  if (!postId) return;
  const root = document.getElementById('page-content');
  if (!root) return;
  dedupePanels(root);
  if (root.querySelector('[data-ai-character-panel-root]')) return;
  const body = root.querySelector('.detail-body');
  if (!body) return;

  try {
    const snap = await getDoc(doc(db, 'feeds', postId));
    if (!snap.exists()) return;
    const post = { id: snap.id, ...snap.data() };
    if (post.aiCharacterPanel?.enabled) {
      body.insertAdjacentHTML('afterend', renderPanel(normalizePanelForDisplay(post.aiCharacterPanel, post)));
      dedupePanels(root);
      return;
    }
    if (isAiPanelPost(post)) {
      body.insertAdjacentHTML('afterend', renderPanel(buildFallbackPanel(post)));
      dedupePanels(root);
      await maybeGenerate(postId, post, body);
    }
  } catch (error) {
    console.warn('[ai-character-panel-ui] render failed', error);
  }
}

let timer = null;
function schedule() {
  if (!isPrimaryRuntime()) return;
  clearTimeout(timer);
  timer = setTimeout(enhance, 260);
}

function boot() {
  if (!isPrimaryRuntime()) return;
  window.addEventListener('hashchange', schedule);
  window.addEventListener('sosoking:extensions-ready', schedule);
  document.addEventListener('DOMContentLoaded', schedule);
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  schedule();
}

boot();
