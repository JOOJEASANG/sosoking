import { auth, db } from './firebase.js';
import { doc, getDoc, updateDoc, increment, addDoc, collection, serverTimestamp, getDocs, orderBy, query } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from './router.js';
import { toast } from './components/toast.js';
import { appState } from './state.js';

function esc(value) {
  return String(value || '').replace(/[&<>"]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[m]));
}

function getDetailId() {
  const match = (window.location.hash || '').match(/^#\/detail\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function timeText(value) {
  const date = value?.toDate?.() || value;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '방금';
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return '방금';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return date.toLocaleDateString('ko-KR');
}

function renderVoteModule(post) {
  const vote = post.modules?.vote;
  if (!vote?.enabled) return '';
  const votedBy = Array.isArray(vote.votedBy) ? vote.votedBy : [];
  const uid = auth.currentUser?.uid || '';
  const hasVoted = uid && votedBy.includes(uid);
  const total = (vote.options || []).reduce((s, o) => s + Number(o.votes || 0), 0);
  return `
    <div class="multi-detail-module" data-multi-module="vote">
      <div class="multi-detail-module__title">🗳️ ${esc(vote.question || '투표')}</div>
      <div class="multi-vote-options">
        ${(vote.options || []).map((opt, i) => {
          const votes = Number(opt.votes || 0);
          const pct = total ? Math.round(votes / total * 100) : 0;
          return `<button class="multi-vote-option" data-multi-vote-idx="${i}" ${hasVoted ? 'disabled' : ''}>
            <span class="multi-vote-option__bar" style="width:${pct}%"></span>
            <span class="multi-vote-option__text">${esc(opt.text)}</span>
            <span class="multi-vote-option__pct">${hasVoted || total ? `${pct}%` : '투표'}</span>
          </button>`;
        }).join('')}
      </div>
      ${hasVoted ? '<div class="multi-module-hint">이미 투표했어요.</div>' : ''}
    </div>`;
}

function renderNamingModule(post) {
  const naming = post.modules?.naming;
  if (!naming?.enabled) return '';
  const count = Number(naming.charCount || 0);
  const input = count > 0
    ? `<div class="multi-char-boxes">${Array.from({ length: count }, (_, i) => `<input class="multi-name-char" maxlength="2" data-idx="${i}">`).join('')}</div>`
    : `<input id="multi-naming-free" class="form-input" maxlength="30" placeholder="웃긴 이름을 입력하세요">`;
  return `
    <div class="multi-detail-module" data-multi-module="naming">
      <div class="multi-detail-module__title">😜 작명 참여</div>
      <div class="multi-module-hint">${count ? `${count}글자로 이름을 지어보세요.` : '자유롭게 이름을 지어보세요.'}</div>
      <div class="multi-submit-row">
        ${input}
        <button class="btn btn--primary btn--sm" id="multi-naming-submit">등록</button>
      </div>
      <div class="multi-participation-list" id="multi-naming-list"></div>
    </div>`;
}

function renderAcrosticModule(post) {
  const acrostic = post.modules?.acrostic;
  if (!acrostic?.enabled) return '';
  const keyword = String(acrostic.keyword || '');
  return `
    <div class="multi-detail-module" data-multi-module="acrostic">
      <div class="multi-detail-module__title">✍️ '${esc(keyword)}' 삼행시</div>
      <div id="multi-acrostic-lines">
        ${[...keyword].map((ch, i) => `
          <div class="multi-acrostic-line">
            <span>${esc(ch)}</span>
            <input class="form-input multi-acrostic-input" data-idx="${i}" maxlength="80" placeholder="${esc(ch)}(으)로 시작하는 한 줄">
          </div>`).join('')}
      </div>
      <button class="btn btn--primary btn--sm" id="multi-acrostic-submit">삼행시 올리기</button>
      <div class="multi-participation-list" id="multi-acrostic-list"></div>
    </div>`;
}

function renderRelayModule(post) {
  const relay = post.modules?.relay;
  if (!relay?.enabled) return '';
  return `
    <div class="multi-detail-module" data-multi-module="relay">
      <div class="multi-detail-module__title">🎭 릴레이 이어쓰기</div>
      <div class="multi-relay-start">${esc(relay.startSentence || '').replace(/\n/g, '<br>')}</div>
      <textarea id="multi-relay-input" class="form-textarea" rows="3" maxlength="150" placeholder="다음 이야기를 이어주세요"></textarea>
      <button class="btn btn--primary btn--sm" id="multi-relay-submit">이어쓰기</button>
      <div class="multi-participation-list" id="multi-relay-list"></div>
    </div>`;
}

function renderQuizModule(post) {
  const quiz = post.modules?.quiz;
  if (!quiz?.enabled) return '';
  return `
    <div class="multi-detail-module" data-multi-module="quiz">
      <div class="multi-detail-module__title">🧠 문제</div>
      <div class="multi-quiz-question">${esc(quiz.question || '')}</div>
      <div class="multi-submit-row">
        <input id="multi-quiz-answer" class="form-input" placeholder="정답 입력">
        <button class="btn btn--primary btn--sm" id="multi-quiz-submit">확인</button>
      </div>
      <div id="multi-quiz-result" class="multi-quiz-result" style="display:none"></div>
    </div>`;
}

function renderModules(post) {
  return `
    <div class="multi-detail-root" data-multi-modules-root="${post.id}">
      <div class="multi-detail-root__head">
        <div class="multi-detail-root__title">🧩 만능 놀이 기능</div>
        <div class="multi-detail-root__desc">켜진 기능만 아래에 표시됩니다.</div>
      </div>
      ${renderVoteModule(post)}
      ${renderNamingModule(post)}
      ${renderAcrosticModule(post)}
      ${renderRelayModule(post)}
      ${renderQuizModule(post)}
    </div>`;
}

async function fetchItems(postId, kind) {
  const snap = await getDocs(query(collection(db, 'feeds', postId, 'multi_' + kind), orderBy('createdAt', 'asc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function renderMultiReplyList(replies) {
  if (!replies.length) return `<div class="multi-empty">아직 답글이 없습니다.</div>`;
  return replies.map(r => `
    <div class="multi-reply-item">
      <div class="multi-reply-item__avatar">${esc((r.authorName || '?')[0])}</div>
      <div class="multi-reply-item__body">
        <div class="multi-reply-item__meta"><b>${esc(r.authorName || '익명')}</b><span>${timeText(r.createdAt)}</span></div>
        <div class="multi-reply-item__text">${esc(r.text || '').replace(/\n/g, '<br>')}</div>
      </div>
    </div>`).join('');
}

function renderItemList(items, kind) {
  if (!items.length) return `<div class="multi-empty">아직 참여글이 없습니다.</div>`;
  return items.map(item => {
    let body = '';
    const reactions = item.reactions || {};
    if (kind === 'acrostic' && Array.isArray(item.lines)) {
      body = item.lines.map(l => `<div class="multi-item-line"><b>${esc(l.char)}</b><span>${esc(l.line)}</span></div>`).join('');
    } else {
      body = `<div class="multi-item-text">${esc(item.text || '').replace(/\n/g, '<br>')}</div>`;
    }
    return `<div class="multi-participation-item" data-multi-kind="${kind}" data-multi-item-id="${item.id}">
      ${body}
      <div class="multi-item-meta">${esc(item.authorName || '익명')} · ${timeText(item.createdAt)}</div>
      <div class="multi-item-actions">
        <button type="button" data-multi-react="like">👍 <b>${Number(reactions.like || 0) || ''}</b></button>
        <button type="button" data-multi-react="funny">😂 <b>${Number(reactions.funny || 0) || ''}</b></button>
        <button type="button" data-multi-react="fire">🔥 <b>${Number(reactions.fire || 0) || ''}</b></button>
        <button type="button" data-multi-reply-toggle>답글 <b>${Number(item.replyCount || 0) || ''}</b></button>
      </div>
      <div class="multi-replies">
        <div class="multi-replies__list"></div>
        <div class="multi-replies__form">
          <input class="multi-replies__input" maxlength="300" placeholder="답글을 입력하세요">
          <button type="button" class="multi-replies__submit">등록</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

async function refreshList(postId, kind) {
  const map = { naming: 'multi-naming-list', acrostic: 'multi-acrostic-list', relay: 'multi-relay-list' };
  const el = document.getElementById(map[kind]);
  if (!el) return;
  el.innerHTML = `<div class="multi-empty">불러오는 중...</div>`;
  try {
    const items = await fetchItems(postId, kind);
    el.innerHTML = renderItemList(items, kind);
    bindMultiItemActions(postId, kind);
  } catch {
    el.innerHTML = `<div class="multi-empty">불러오지 못했어요.</div>`;
  }
}

async function addParticipation(postId, kind, data) {
  if (!auth.currentUser) { navigate('/login'); return; }
  await addDoc(collection(db, 'feeds', postId, 'multi_' + kind), {
    ...data,
    authorId: auth.currentUser.uid,
    authorName: appState.nickname || auth.currentUser.displayName || '익명',
    reactions: {},
    replyCount: 0,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'feeds', postId), { commentCount: increment(1) }).catch(() => {});
  toast.success('참여글을 올렸어요!');
  await refreshList(postId, kind);
}

function itemRef(postId, kind, itemId) {
  return doc(db, 'feeds', postId, 'multi_' + kind, itemId);
}

async function refreshReplies(postId, kind, itemId, box) {
  const list = box.querySelector('.multi-replies__list');
  if (!list) return;
  list.innerHTML = `<div class="multi-empty">불러오는 중...</div>`;
  try {
    const snap = await getDocs(query(collection(db, 'feeds', postId, 'multi_' + kind, itemId, 'replies'), orderBy('createdAt', 'asc')));
    list.innerHTML = renderMultiReplyList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch {
    list.innerHTML = `<div class="multi-empty">답글을 불러오지 못했어요.</div>`;
  }
}

function bindMultiItemActions(postId, kind) {
  document.querySelectorAll(`.multi-participation-item[data-multi-kind="${kind}"]`).forEach(item => {
    if (item.dataset.actionReady === '1') return;
    item.dataset.actionReady = '1';
    const itemId = item.dataset.multiItemId;

    item.querySelectorAll('[data-multi-react]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!auth.currentUser) { navigate('/login'); return; }
        const key = btn.dataset.multiReact;
        try {
          await updateDoc(itemRef(postId, kind, itemId), { [`reactions.${key}`]: increment(1) });
          const b = btn.querySelector('b');
          b.textContent = String((Number(b.textContent || 0) || 0) + 1);
        } catch (error) {
          console.error(error);
          toast.error('반응 등록에 실패했어요.');
        }
      });
    });

    const box = item.querySelector('.multi-replies');
    item.querySelector('[data-multi-reply-toggle]')?.addEventListener('click', async () => {
      const open = !box.classList.contains('open');
      box.classList.toggle('open', open);
      if (open) await refreshReplies(postId, kind, itemId, box);
      if (open) box.querySelector('.multi-replies__input')?.focus();
    });

    const send = async () => {
      if (!auth.currentUser) { navigate('/login'); return; }
      const input = box.querySelector('.multi-replies__input');
      const text = input.value.trim();
      if (!text) { toast.warn('답글을 입력해주세요'); return; }
      try {
        await addDoc(collection(db, 'feeds', postId, 'multi_' + kind, itemId, 'replies'), {
          text,
          authorId: auth.currentUser.uid,
          authorName: appState.nickname || auth.currentUser.displayName || '익명',
          createdAt: serverTimestamp(),
        });
        await updateDoc(itemRef(postId, kind, itemId), { replyCount: increment(1) }).catch(() => {});
        input.value = '';
        toast.success('답글을 남겼어요');
        await refreshReplies(postId, kind, itemId, box);
      } catch (error) {
        console.error(error);
        toast.error('답글 등록에 실패했어요.');
      }
    };
    item.querySelector('.multi-replies__submit')?.addEventListener('click', send);
    item.querySelector('.multi-replies__input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
  });
}

function setupEvents(post) {
  document.querySelectorAll('[data-multi-vote-idx]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!auth.currentUser) { navigate('/login'); return; }
      const idx = Number(btn.dataset.multiVoteIdx);
      const postRef = doc(db, 'feeds', post.id);
      try {
        const snap = await getDoc(postRef);
        const data = snap.data() || {};
        const vote = data.modules?.vote || {};
        const uid = auth.currentUser.uid;
        if ((vote.votedBy || []).includes(uid)) { toast.warn('이미 투표했어요'); return; }
        const options = (vote.options || []).map((opt, i) => i === idx ? { ...opt, votes: Number(opt.votes || 0) + 1 } : opt);
        await updateDoc(postRef, {
          'modules.vote.options': options,
          'modules.vote.votedBy': [...(vote.votedBy || []), uid],
        });
        toast.success('투표했어요!');
        const updated = { ...post, modules: { ...post.modules, vote: { ...vote, options, votedBy: [...(vote.votedBy || []), uid] } } };
        const voteModule = document.querySelector('[data-multi-module="vote"]');
        if (voteModule) {
          voteModule.outerHTML = renderVoteModule(updated);
        }
        setupEvents(updated);
      } catch (error) {
        console.error(error);
        toast.error('투표에 실패했어요.');
      }
    });
  });

  document.getElementById('multi-naming-submit')?.addEventListener('click', async () => {
    const free = document.getElementById('multi-naming-free');
    const chars = [...document.querySelectorAll('.multi-name-char')];
    const text = free ? free.value.trim() : chars.map(i => i.value.trim()).join('');
    if (!text) { toast.warn('이름을 입력해주세요'); return; }
    await addParticipation(post.id, 'naming', { text });
    if (free) free.value = ''; else chars.forEach(i => i.value = '');
  });

  document.getElementById('multi-acrostic-submit')?.addEventListener('click', async () => {
    const keyword = String(post.modules?.acrostic?.keyword || '');
    const values = [...document.querySelectorAll('.multi-acrostic-input')].map(i => i.value.trim());
    if (values.some(v => !v)) { toast.warn('모든 줄을 입력해주세요'); return; }
    const lines = [...keyword].map((ch, i) => ({ char: ch, line: values[i] }));
    await addParticipation(post.id, 'acrostic', { text: lines.map(l => `${l.char}: ${l.line}`).join('\n'), lines });
    document.querySelectorAll('.multi-acrostic-input').forEach(i => i.value = '');
  });

  document.getElementById('multi-relay-submit')?.addEventListener('click', async () => {
    const input = document.getElementById('multi-relay-input');
    const text = input?.value.trim() || '';
    if (!text) { toast.warn('이어쓸 내용을 입력해주세요'); return; }
    await addParticipation(post.id, 'relay', { text });
    input.value = '';
  });

  document.getElementById('multi-quiz-submit')?.addEventListener('click', () => {
    const answer = document.getElementById('multi-quiz-answer')?.value.trim() || '';
    const correct = String(post.modules?.quiz?.answer || '').trim();
    const result = document.getElementById('multi-quiz-result');
    if (!answer) { toast.warn('정답을 입력해주세요'); return; }
    const ok = answer.replace(/\s/g, '') === correct.replace(/\s/g, '');
    result.style.display = '';
    result.className = `multi-quiz-result ${ok ? 'is-correct' : 'is-wrong'}`;
    result.textContent = ok ? '⭕ 정답이에요!' : '❌ 아쉽지만 오답이에요!';
  });
}

async function enhanceMultiDetail() {
  const postId = getDetailId();
  if (!postId) return;
  const root = document.getElementById('page-content');
  if (!root || root.querySelector('[data-multi-modules-root]')) return;
  const badge = root.querySelector('.feed-card__type-badge');
  if (!badge) return;

  try {
    const snap = await getDoc(doc(db, 'feeds', postId));
    if (!snap.exists()) return;
    const post = { id: snap.id, ...snap.data() };
    if (post.type !== 'multi') return;

    badge.textContent = '🧩 만능 놀이글';
    const body = root.querySelector('.detail-body');
    if (!body) return;
    body.insertAdjacentHTML('afterend', renderModules(post));
    setupEvents(post);
    await Promise.all([
      refreshList(post.id, 'naming'),
      refreshList(post.id, 'acrostic'),
      refreshList(post.id, 'relay'),
    ]);
  } catch (error) {
    console.warn('[multi-detail] failed', error);
  }
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(enhanceMultiDetail, 220);
}

window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 700);
