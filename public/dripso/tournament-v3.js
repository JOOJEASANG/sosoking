import { auth, db, functions } from '/js/firebase.js?v=20260729-auth-session-1';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';

const GAME_VERSION = 3;
const MODE_META = Object.freeze({
  blank: ['🧩', '빈칸채우기'], naming: ['🏷️', '이름붙이기'], comeback: ['↩️', '받아치기'],
  wrong: ['❌', '오답제출'], headline: ['📰', '뉴스제목'], excuse: ['🥸', '변명대회'], manual: ['📘', '사용설명서']
});
const MODE_MARKER = /^\[\[dripso-mode:[a-z-]+\]\]\s*/i;

const createTournament = httpsCallable(functions, 'createDripsoTournamentBattle');
const submitEntry = httpsCallable(functions, 'submitDripsoTournamentEntry');
const getView = httpsCallable(functions, 'getDripsoTournamentView');
const getMatchup = httpsCallable(functions, 'getDripsoTournamentMatchup');
const voteMatchup = httpsCallable(functions, 'voteDripsoTournamentMatchup');

const app = document.getElementById('dripso-app');
const form = document.getElementById('topic-form');
const dialog = document.getElementById('topic-dialog');
const toast = document.getElementById('toast');
let toastTimer = 0;
let scheduleTimer = 0;
let renderVersion = 0;
let topicsCache = null;
let topicsCacheAt = 0;

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== '') node.textContent = text;
  return node;
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = String(message || '');
  toast.hidden = false;
  toastTimer = window.setTimeout(() => { toast.hidden = true; }, 2400);
}

function errorText(error, fallback) {
  return String(error?.message || '')
    .replace(/^FirebaseError:\s*/i, '')
    .replace(/^functions\/[a-z-]+:\s*/i, '') || fallback;
}

function ms(value) {
  if (value?.toMillis) return value.toMillis();
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function remaining(deadline) {
  const value = Math.max(0, Number(deadline || 0) - Date.now());
  const minutes = Math.floor(value / 60000);
  const hours = Math.floor(minutes / 60);
  if (hours >= 24) return `${Math.floor(hours / 24)}일 ${hours % 24}시간`;
  if (hours > 0) return `${hours}시간 ${minutes % 60}분`;
  if (minutes > 0) return `${minutes}분`;
  return `${Math.max(0, Math.ceil(value / 1000))}초`;
}

function topicIdFromHash() {
  const match = (location.hash || '').match(/^#\/topic\/([^/?#]+)/);
  if (!match) return '';
  try { return decodeURIComponent(match[1]); }
  catch { return ''; }
}

function modeBadge(mode) {
  const [icon, label] = MODE_META[mode] || ['🎮', '드립배틀'];
  return el('span', `type-badge battle-${mode}`, `${icon} ${label}`);
}

function displayPrompt(topic) {
  return String(topic.prompt || '').replace(MODE_MARKER, '').trim();
}

function phaseOf(topic) {
  const now = Date.now();
  if (now < ms(topic.entryDeadline)) return 'recruiting';
  if (now < ms(topic.prelimDeadline)) return 'prelim';
  if (topic.tournamentRound === 'semifinal' && now < ms(topic.semifinalDeadline)) return 'semifinal';
  if (topic.tournamentRound === 'final' && now < ms(topic.finalDeadline)) return 'final';
  if (topic.tournamentRound === 'closed') return 'closed';
  return 'transition';
}

function phaseInfo(phase, view) {
  if (phase === 'recruiting') return ['🔒', '블라인드 출전', '다른 작품은 보이지 않으며 한 계정당 한 작품만 제출합니다.', view.entryDeadlineMs];
  if (phase === 'prelim') return ['⚔️', '익명 1대1 예선', '무작위 두 작품 중 더 웃긴 한쪽을 골라 파이널4 시드를 정합니다.', view.prelimDeadlineMs];
  if (phase === 'semifinal') return ['4️⃣', '파이널4 준결승', '예선 1위 대 4위, 2위 대 3위가 결승 진출을 놓고 맞붙습니다.', view.semifinalDeadlineMs];
  if (phase === 'final') return ['🏁', '최종 결승', '준결승 승자 두 작품 중 드립소 챔피언을 선택합니다.', view.finalDeadlineMs];
  if (phase === 'closed') return ['🏆', '우승 확정', '결승이 끝나 챔피언과 전체 순위가 공개됐습니다.', 0];
  return ['⏳', '대진 확정 중', '예선 점수를 집계해 파이널 토너먼트 대진을 만들고 있습니다.', 0];
}

function phasePanel(phase, view) {
  const [icon, title, description, deadline] = phaseInfo(phase, view);
  const panel = el('section', `battle-phase-panel tournament-phase ${phase}`);
  panel.append(el('span', 'battle-phase-icon', icon));
  const copy = el('div', 'battle-phase-copy');
  copy.append(el('strong', '', title), el('p', '', description));
  const stats = el('div', 'battle-phase-stats');
  stats.append(
    el('span', '', `출전자 ${Math.max(0, Number(view.entryCount) || 0)}명`),
    el('span', '', `예선 ${Math.max(0, Number(view.prelimVoteCount) || 0)}표`),
    el('span', '', `결선 ${Math.max(0, Number(view.tournamentVoteCount) || 0)}표`)
  );
  if (deadline) {
    const countdown = el('span', 'battle-live-countdown', remaining(deadline));
    countdown.dataset.tournamentDeadline = String(deadline);
    stats.append(countdown);
  }
  copy.append(stats);
  panel.append(copy);
  return panel;
}

function loginNotice(text) {
  const notice = el('div', 'login-notice');
  notice.append(`${text} `);
  const link = el('a', '', '로그인하기');
  link.href = '/#/auth';
  notice.append(link);
  return notice;
}

function ownEntry(entry) {
  if (!entry) return null;
  const card = el('article', 'comment-card own-battle-entry');
  const meta = el('div', 'comment-meta');
  meta.append(el('span', 'best-rank', '내 출전작'), el('span', '', '결승 종료 전까지 작성자 정보는 숨겨집니다.'));
  card.append(meta, el('p', 'comment-text', String(entry.text || '')));
  return card;
}

function entryComposer(topicId, mode, entry) {
  if (!auth.currentUser || auth.currentUser.isAnonymous) return loginNotice('블라인드 출전은 로그인 후 가능합니다.');
  const entryForm = el('form', 'comment-form tournament-entry-form');
  entryForm.dataset.tournamentEntry = topicId;
  const area = el('textarea');
  area.name = 'text';
  area.required = true;
  area.rows = 2;
  area.maxLength = mode === 'naming' ? 80 : 180;
  area.value = String(entry?.text || '');
  area.placeholder = mode === 'naming' ? '이름만 짧고 강하게 입력해 주세요.' : '설명보다 한 방이 좋습니다.';
  const footer = el('div', 'comment-form-footer');
  footer.append(el('small', '', entry ? '출전 마감 전까지 수정할 수 있습니다.' : '한 계정당 한 작품만 출전합니다.'));
  const button = el('button', 'comment-submit', entry ? '출전작 수정' : '블라인드 출전');
  button.type = 'submit';
  footer.append(button);
  entryForm.append(area, footer);
  return entryForm;
}

function resultCard(entry, index, winnerId) {
  const winner = entry.id === winnerId;
  const card = el('article', `comment-card game-result-card${winner ? ' battle-winner' : ''}`);
  card.dataset.commentId = entry.id;
  const meta = el('div', 'comment-meta');
  meta.append(el('span', winner ? 'best-rank' : '', winner ? '🏆 챔피언' : `${index + 1}위`), el('span', '', String(entry.nickname || '익명 드리퍼')));
  card.append(
    meta,
    el('p', 'comment-text', String(entry.text || '')),
    el('div', 'battle-result-score', `예선 선택 ${Math.max(0, Number(entry.prelimScore) || 0)}회 · 노출 ${Math.max(0, Number(entry.prelimDuels) || 0)}회`)
  );
  return card;
}

function bracket(view) {
  const matches = Array.isArray(view.matches) ? view.matches : [];
  if (!matches.length) return null;
  const section = el('section', 'tournament-bracket');
  section.append(el('p', 'section-kicker', 'FINAL FOUR BRACKET'), el('h2', '', '파이널 토너먼트 대진'));
  const grid = el('div', 'tournament-bracket-grid');
  for (const match of matches) {
    const card = el('article', `tournament-match ${match.round || ''} ${match.status || ''}`);
    card.append(el('strong', '', match.round === 'final' ? '최종 결승' : match.id === 'semi1' ? '준결승 1경기' : '준결승 2경기'));
    for (const side of ['left', 'right']) {
      const entry = match[side] || {};
      const row = el('div', `tournament-contender${match.winnerEntryId === entry.id ? ' winner' : ''}`);
      const seed = side === 'left' ? match.leftSeed : match.rightSeed;
      row.append(el('span', 'tournament-seed', seed ? `${seed}번` : '-'), el('p', '', String(entry.text || '대진 확정 중')));
      if (Number.isFinite(Number(match[`${side}Votes`]))) row.append(el('em', '', `${Number(match[`${side}Votes`])}표`));
      card.append(row);
    }
    grid.append(card);
  }
  section.append(grid);
  return section;
}

async function fillMatchup(topicId, host, version) {
  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    host.replaceChildren(loginNotice('익명 심사는 로그인 후 참여할 수 있습니다.'));
    return;
  }
  host.replaceChildren(el('div', 'loading-card compact', '다음 대결을 불러오는 중입니다.'));
  try {
    const response = await getMatchup({ topicId });
    if (version !== renderVersion || !host.isConnected) return;
    const data = response.data || {};
    if (data.completed) {
      const done = el('div', 'battle-vote-complete');
      done.append(el('span', '', '✅'), el('strong', '', '현재 가능한 심사를 완료했습니다.'), el('p', '', String(data.reason || '다른 배틀도 심사해 보세요.')));
      host.replaceChildren(done);
      return;
    }
    const duel = el('div', 'battle-duel tournament-duel');
    const heading = el('div', 'battle-duel-heading');
    heading.append(el('p', 'section-kicker', String(data.roundLabel || 'ANONYMOUS DUEL')), el('h2', '', '어느 쪽이 더 웃겼습니까?'));
    const choices = el('div', 'battle-duel-choices');
    for (const [letter, entry] of [['A', data.left], ['B', data.right]]) {
      const button = el('button', 'battle-duel-choice');
      button.type = 'button';
      button.dataset.tournamentVote = topicId;
      button.dataset.matchId = String(data.matchId || '');
      button.dataset.left = data.left.id;
      button.dataset.right = data.right.id;
      button.dataset.selected = entry.id;
      button.append(el('span', 'battle-duel-letter', letter), el('p', '', String(entry.text || '')));
      choices.append(button);
    }
    duel.append(heading, choices);
    host.replaceChildren(duel);
  } catch (error) {
    host.replaceChildren(el('div', 'error-card', errorText(error, '대결을 불러오지 못했습니다.')));
  }
}

async function renderTournamentTopic(topicId, topic) {
  const version = ++renderVersion;
  const response = await getView({ topicId });
  if (version !== renderVersion) return;
  const view = response.data || {};
  const phase = String(view.phase || phaseOf(topic));
  const mode = String(topic.mode || 'blank');
  const [icon, label] = MODE_META[mode] || ['🎮', '드립배틀'];
  const detail = el('section', 'topic-detail battle-topic-detail tournament-topic-detail');
  const back = el('a', 'back-button', `← ${label} 배틀로 돌아가기`);
  back.href = `#/mode/${mode}`;
  detail.append(back, modeBadge(mode), el('h1', '', String(topic.title || `${icon} ${label}`)));
  if (String(topic.imageUrl || '').startsWith('https://firebasestorage.googleapis.com/')) {
    const image = el('img', 'topic-detail-image');
    image.src = topic.imageUrl;
    image.alt = `${topic.title || label} 첨부 이미지`;
    detail.append(image);
  }
  detail.append(el('p', 'topic-prompt battle-prompt', displayPrompt(topic)), el('p', 'topic-author', `판주 ${String(topic.nickname || '익명 드리퍼')}`), phasePanel(phase, view));

  const sections = [];
  if (phase === 'recruiting') {
    detail.append(entryComposer(topicId, mode, view.ownEntry));
    const blind = el('section', 'section-block blind-entry-section');
    blind.append(el('p', 'section-kicker', 'BLIND ENTRY'), el('h2', '', '출전작은 결승 종료 뒤 공개됩니다.'));
    blind.append(ownEntry(view.ownEntry) || el('div', 'empty-card', '아직 출전하지 않았습니다.'));
    sections.push(blind);
  } else if (['prelim', 'semifinal', 'final'].includes(phase)) {
    const mine = ownEntry(view.ownEntry);
    if (mine) detail.append(mine);
    const bracketNode = bracket(view);
    if (bracketNode) sections.push(bracketNode);
    const voting = el('section', 'section-block battle-voting-section');
    const host = el('div', 'battle-matchup-host');
    voting.append(host);
    sections.push(voting);
    app.dataset.tournamentTopic = topicId;
    app.replaceChildren(detail, ...sections);
    await fillMatchup(topicId, host, version);
    startCountdown();
    return;
  } else if (phase === 'closed') {
    const entries = Array.isArray(view.entries) ? view.entries : [];
    const winner = view.winner || entries[0] || null;
    if (winner) {
      const showcase = el('section', 'battle-winner-showcase tournament-champion');
      showcase.append(el('span', 'battle-winner-crown', '🏆'), el('p', 'section-kicker', 'DRIPSO CHAMPION'), el('blockquote', '', `“${String(winner.text || '')}”`), el('strong', '', String(winner.nickname || '익명 드리퍼')));
      detail.append(showcase);
    }
    const bracketNode = bracket(view);
    if (bracketNode) sections.push(bracketNode);
    const ranking = el('section', 'section-block');
    ranking.append(el('p', 'section-kicker', 'FINAL RANKING'), el('h2', '', '토너먼트 최종 순위'));
    if (entries.length) {
      const list = el('div', 'comment-list');
      list.replaceChildren(...entries.map((entry, index) => resultCard(entry, index, winner?.id || '')));
      ranking.append(list);
    } else ranking.append(el('div', 'empty-card', '출전작이 없어 우승자를 정하지 못했습니다.'));
    sections.push(ranking);
  } else {
    const waiting = el('section', 'section-block');
    waiting.append(el('div', 'loading-card', '예선 결과로 파이널4 대진을 확정하고 있습니다.'));
    sections.push(waiting);
    window.setTimeout(schedule, 1200);
  }
  app.dataset.tournamentTopic = topicId;
  app.replaceChildren(detail, ...sections);
  startCountdown();
}

function startCountdown() {
  document.querySelectorAll('[data-tournament-deadline]').forEach(node => {
    const update = () => {
      const deadline = Number(node.dataset.tournamentDeadline) || 0;
      node.textContent = remaining(deadline);
      if (deadline && Date.now() >= deadline) schedule();
    };
    update();
    const timer = window.setInterval(() => {
      if (!node.isConnected) return window.clearInterval(timer);
      update();
    }, 1000);
  });
}

async function loadTournamentTopics(force = false) {
  if (!force && topicsCache && Date.now() - topicsCacheAt < 10000) return topicsCache;
  const snap = await getDocs(query(collection(db, 'dripso_topics'), where('status', '==', 'visible'), limit(200)));
  topicsCache = snap.docs.map(item => ({ id: item.id, ...item.data() })).filter(item => Number(item.gameVersion) === GAME_VERSION);
  topicsCacheAt = Date.now();
  return topicsCache;
}

function miniCard(topic) {
  const card = el('a', 'topic-card battle-topic-card tournament-mini-card');
  card.href = `#/topic/${encodeURIComponent(topic.id)}`;
  const top = el('div', 'topic-meta');
  top.append(modeBadge(topic.mode));
  const chip = el('span', `battle-status-chip ${phaseOf(topic)}`, phaseOf(topic) === 'recruiting' ? '출전 중' : phaseOf(topic) === 'prelim' ? '익명 예선' : phaseOf(topic) === 'semifinal' ? '파이널4' : phaseOf(topic) === 'final' ? '결승' : '종료');
  top.append(chip);
  card.append(top, el('h3', '', String(topic.title || '파이널4 배틀')), el('p', '', displayPrompt(topic)));
  const stats = el('div', 'topic-stats');
  stats.append(el('span', '', `출전 ${Number(topic.commentCount || 0)}`), el('span', '', `심사 ${Number(topic.pairVoteCount || 0)}`), el('span', '', `판주 ${String(topic.nickname || '익명 드리퍼')}`));
  card.append(stats);
  return card;
}

async function decorateLists() {
  const topics = await loadTournamentTopics();
  const map = new Map(topics.map(topic => [topic.id, topic]));
  app.querySelectorAll('a.topic-card[href*="#/topic/"]').forEach(card => {
    const id = decodeURIComponent((card.getAttribute('href').match(/#\/topic\/([^?#]+)/) || [])[1] || '');
    const topic = map.get(id);
    if (!topic) return;
    const chip = card.querySelector('.battle-status-chip');
    if (chip) {
      const phase = phaseOf(topic);
      chip.className = `battle-status-chip ${phase}`;
      chip.textContent = phase === 'recruiting' ? '출전 중' : phase === 'prelim' ? '익명 예선' : phase === 'semifinal' ? '파이널4' : phase === 'final' ? '최종 결승' : phase === 'closed' ? '챔피언 확정' : '대진 확정 중';
    }
  });

  const hash = location.hash || '#/';
  if (hash === '#/' || hash === '#' || hash === '') {
    if (!document.getElementById('tournament-v3-live')) {
      const active = topics.filter(topic => phaseOf(topic) !== 'closed').sort((a, b) => ms(b.createdAt) - ms(a.createdAt)).slice(0, 8);
      if (active.length) {
        const section = el('section', 'section-block tournament-live-section');
        section.id = 'tournament-v3-live';
        section.append(el('p', 'section-kicker', 'FINAL FOUR LIVE'), el('h2', '', '파이널 토너먼트 진행 중'));
        const list = el('div', 'topic-list');
        list.replaceChildren(...active.map(miniCard));
        section.append(list);
        app.querySelector('.battle-hero')?.insertAdjacentElement('afterend', section);
      }
    }
  }
  if (hash === '#/hall' && !document.getElementById('tournament-v3-hall')) {
    const closed = topics.filter(topic => phaseOf(topic) === 'closed' && topic.winnerText).slice(0, 20);
    if (closed.length) {
      const section = el('section', 'section-block tournament-hall-section');
      section.id = 'tournament-v3-hall';
      section.append(el('p', 'section-kicker', 'TOURNAMENT CHAMPIONS'), el('h2', '', '파이널4 챔피언'));
      const list = el('div', 'topic-list');
      list.replaceChildren(...closed.map(miniCard));
      section.append(list);
      app.append(section);
    }
  }
}

async function handleRoute() {
  const topicId = topicIdFromHash();
  if (!topicId) {
    delete app.dataset.tournamentTopic;
    await decorateLists().catch(() => {});
    return;
  }
  if (app.dataset.tournamentTopic === topicId && app.querySelector('.tournament-topic-detail')) return;
  const snap = await getDoc(doc(db, 'dripso_topics', topicId));
  if (!snap.exists || Number(snap.data()?.gameVersion) !== GAME_VERSION) return;
  await renderTournamentTopic(topicId, { id: snap.id, ...snap.data() });
}

function schedule() {
  window.clearTimeout(scheduleTimer);
  scheduleTimer = window.setTimeout(() => void handleRoute().catch(error => console.warn('Tournament UI failed:', error)), 90);
}

form?.addEventListener('submit', async event => {
  event.preventDefault();
  event.stopImmediatePropagation();
  const submit = form.querySelector('button[type="submit"]');
  const mode = String(document.getElementById('battle-mode')?.value || 'blank');
  const title = String(document.getElementById('topic-title')?.value || '').trim();
  const prompt = String(document.getElementById('topic-prompt')?.value || '').trim();
  if (title.length < 2 || prompt.length < 4) return showToast('제목과 문제를 조금 더 입력해 주세요.');
  submit.disabled = true;
  try {
    const preview = String(document.getElementById('topic-image-preview-img')?.src || '');
    const response = await createTournament({
      mode, title, prompt,
      entryMinutes: Number(document.getElementById('entry-duration')?.value || 180),
      prelimMinutes: Number(document.getElementById('voting-duration')?.value || 180),
      finalsMinutes: Number(document.getElementById('finals-duration')?.value || 60),
      imageDataUrl: preview.startsWith('data:image/jpeg;base64,') ? preview : ''
    });
    topicsCache = null;
    form.reset();
    dialog.close();
    showToast('파이널4 드립배틀을 열었습니다.');
    location.hash = `#/topic/${String(response.data?.topicId || '')}`;
  } catch (error) {
    showToast(errorText(error, '토너먼트 배틀을 열지 못했습니다.'));
  } finally {
    submit.disabled = false;
  }
}, true);

app.addEventListener('submit', async event => {
  const entryForm = event.target.closest('[data-tournament-entry]');
  if (!entryForm) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const button = entryForm.querySelector('button[type="submit"]');
  const text = String(entryForm.querySelector('textarea')?.value || '').trim();
  if (text.length < 2) return showToast('출전작을 2자 이상 입력해 주세요.');
  button.disabled = true;
  try {
    const response = await submitEntry({ topicId: entryForm.dataset.tournamentEntry, text });
    showToast(response.data?.updated ? '출전작을 수정했습니다.' : '블라인드 출전을 완료했습니다.');
    delete app.dataset.tournamentTopic;
    schedule();
  } catch (error) {
    showToast(errorText(error, '출전에 실패했습니다.'));
  } finally {
    button.disabled = false;
  }
}, true);

app.addEventListener('click', async event => {
  const button = event.target.closest('[data-tournament-vote]');
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const host = button.closest('.battle-matchup-host');
  host.querySelectorAll('[data-tournament-vote]').forEach(item => { item.disabled = true; });
  try {
    await voteMatchup({
      topicId: button.dataset.tournamentVote,
      matchId: button.dataset.matchId,
      leftEntryId: button.dataset.left,
      rightEntryId: button.dataset.right,
      selectedEntryId: button.dataset.selected
    });
    showToast('심사 결과를 반영했습니다.');
    await fillMatchup(button.dataset.tournamentVote, host, renderVersion);
  } catch (error) {
    showToast(errorText(error, '투표에 실패했습니다.'));
    host.querySelectorAll('[data-tournament-vote]').forEach(item => { item.disabled = false; });
  }
}, true);

window.addEventListener('hashchange', () => {
  delete app.dataset.tournamentTopic;
  schedule();
});
new MutationObserver(schedule).observe(app, { childList: true, subtree: true });
schedule();
