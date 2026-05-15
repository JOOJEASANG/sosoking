import { db, auth } from '../firebase.js';
import {
  doc, getDoc, collection, query, orderBy, getDocs,
  addDoc, updateDoc, increment, serverTimestamp, arrayUnion
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from '../router.js';
import { toast } from '../components/toast.js';
import { renderReactionBar, initReactionBar } from '../components/reaction-bar.js';

const TYPE_LABELS = {
  balance:'밸런스게임', vote:'민심투표', battle:'선택지배틀', ox:'OX퀴즈', quiz:'내맘대로퀴즈',
  naming:'미친작명소', acrostic:'삼행시짓기', cbattle:'댓글배틀', laugh:'웃참챌린지', drip:'한줄드립',
  howto:'나만의노하우', story:'경험담', fail:'실패담', concern:'고민/질문', relay:'막장릴레이',
};
const CAT_CLASS = { golra: 'golra', usgyo: 'usgyo', malhe: 'malhe' };

export async function renderDetail(id) {
  const el = document.getElementById('page-content');
  el.innerHTML = `<div class="loading-center"><div class="spinner spinner--lg"></div></div>`;

  try {
    const snap = await getDoc(doc(db, 'feeds', id));
    if (!snap.exists()) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">😢</div><div class="empty-state__title">글을 찾을 수 없어요</div></div>`;
      return;
    }
    const post = { id: snap.id, ...snap.data() };
    await updateDoc(doc(db, 'feeds', id), { viewCount: increment(1) }).catch(() => {});
    const [comments, acrostics] = await Promise.all([
      fetchComments(id),
      post.type === 'acrostic' ? fetchAcrostics(id) : Promise.resolve([]),
    ]);
    renderDetailPage(el, post, comments, acrostics);
  } catch (e) {
    console.error(e);
    el.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">불러오기에 실패했어요</div></div>`;
  }
}

function renderDetailPage(el, post, comments, acrostics) {
  const typeLabel = TYPE_LABELS[post.type] || post.type;
  const catClass  = CAT_CLASS[post.cat] || 'malhe';
  const timeStr   = formatTime(post.createdAt?.toDate?.() || post.createdAt);

  el.innerHTML = `
    <div style="max-width:720px;margin:0 auto">
      <button class="btn btn--ghost btn--sm" onclick="history.back()" style="margin-bottom:16px">← 뒤로</button>
      <div class="card">
        <div class="detail-header">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span class="feed-card__type-badge feed-card__type-badge--${catClass}">${typeLabel}</span>
            ${post.tags?.map(t => `<span class="tag">#${escHtml(t)}</span>`).join('') || ''}
          </div>
          <h1 class="detail-title">${escHtml(post.title || '')}</h1>
          <div class="detail-meta">
            <span>${escHtml(post.authorName || '익명')}</span>
            <span>${timeStr}</span>
            <span>조회 ${post.viewCount || 0}</span>
          </div>
        </div>

        ${post.images?.length ? renderImageSection(post.images) : ''}

        <div class="detail-body">
          ${post.desc ? `<p>${escHtml(post.desc).replace(/\n/g,'<br>')}</p>` : ''}
          ${renderTypeBody(post)}
        </div>

        <div style="padding:0 20px 16px">
          ${renderReactionBar(post)}
        </div>

        <div class="divider" style="margin:0"></div>

        ${renderInteractive(post)}

        ${post.type === 'acrostic' ? renderAcrosticSection(acrostics, post.id) : ''}

        <div class="comment-section">
          <div class="comment-section__title">댓글 ${comments.length}</div>
          <div class="comment-write-box" id="comment-write">
            <textarea id="comment-input" placeholder="${auth.currentUser ? '댓글을 입력하세요' : '로그인 후 댓글 작성 가능'}"></textarea>
            <button class="btn btn--primary btn--sm" style="align-self:flex-end" id="btn-comment">등록</button>
          </div>
          <div id="comment-list">
            ${comments.length
              ? comments.map(c => renderComment(c)).join('')
              : '<div style="text-align:center;padding:24px;font-size:13px;color:var(--color-text-muted)">첫 댓글을 남겨보세요!</div>'}
          </div>
        </div>
      </div>
    </div>`;

  setupDetailEvents(post, el);
  setupAcrosticLikes(post.id);
}

function renderImageSection(images) {
  if (images.length === 1) {
    return `<img src="${images[0]}" alt="" style="width:100%;max-height:480px;object-fit:cover">`;
  }
  const cls = images.length >= 3 ? 'feed-card__images--3' : 'feed-card__images--2';
  return `
    <div class="feed-card__images ${cls}" style="margin:0">
      ${images.slice(0,3).map(src => `<img class="feed-card__img" src="${src}" alt="" loading="lazy">`).join('')}
    </div>`;
}

function renderTypeBody(post) {
  switch (post.type) {
    case 'balance':
    case 'vote':
    case 'battle':
    case 'concern':
      if (!post.options?.length) return '';
      return `<div id="vote-area" class="quiz-options" style="margin-top:16px">${renderVoteOptions(post)}</div>`;

    case 'ox':
      return `
        <div class="quiz-box" id="quiz-area">
          <div class="quiz-ox">
            <button class="quiz-ox-btn quiz-ox-btn--o" data-answer="O">⭕ O</button>
            <button class="quiz-ox-btn quiz-ox-btn--x" data-answer="X">❌ X</button>
          </div>
          <div id="quiz-result" style="display:none" class="quiz-result">
            <div class="quiz-result__icon"></div>
            <div class="quiz-result__text"></div>
            <div class="quiz-result__explanation" style="margin-top:8px;font-size:13px;color:var(--color-text-secondary)"></div>
          </div>
        </div>`;

    case 'quiz':
      if (post.quizMode === 'short') {
        return `
          <div class="quiz-box" id="quiz-area">
            <div style="display:flex;gap:8px">
              <input id="quiz-short-input" class="form-input" placeholder="답을 입력하세요" style="flex:1">
              <button class="btn btn--primary" id="btn-quiz-submit">확인</button>
            </div>
            <div id="quiz-result" style="display:none" class="quiz-result">
              <div class="quiz-result__icon"></div>
              <div class="quiz-result__text"></div>
              <div class="quiz-result__explanation" style="margin-top:8px;font-size:13px;color:var(--color-text-secondary)"></div>
            </div>
          </div>`;
      }
      if (!post.options?.length) return '';
      return `
        <div class="quiz-box quiz-options" id="quiz-area">
          ${post.options.map((opt, i) => `
            <button class="vote-option" data-quiz-idx="${i}" style="text-align:left">
              <div class="vote-option__content"><span>${i+1}. ${escHtml(opt)}</span></div>
            </button>`).join('')}
          <div id="quiz-result" style="display:none" class="quiz-result">
            <div class="quiz-result__icon"></div>
            <div class="quiz-result__text"></div>
            <div class="quiz-result__explanation" style="margin-top:8px;font-size:13px;color:var(--color-text-secondary)"></div>
          </div>
        </div>`;

    case 'howto':
      return `
        ${post.summary ? `<div style="padding:12px 16px;background:var(--color-primary-bg);border-radius:10px;font-weight:700;color:var(--color-primary);margin-bottom:12px">💡 ${escHtml(post.summary)}</div>` : ''}
        ${post.materials ? `<div style="font-size:13px;margin-bottom:8px"><strong>준비물:</strong> ${escHtml(post.materials)}</div>` : ''}
        ${post.steps?.length ? `
          <div class="howto-steps-display">
            <div class="howto-steps-display__title">단계별 순서</div>
            ${post.steps.map((step, i) => `
              <div class="howto-step-display">
                <div class="howto-step-display__num">${i + 1}</div>
                <div class="howto-step-display__text">${escHtml(step).replace(/\n/g,'<br>')}</div>
              </div>`).join('')}
          </div>` : ''}
        ${post.caution ? `<div style="font-size:13px;color:var(--color-warning);padding:10px 12px;background:#FFFBEB;border-radius:8px;margin-top:8px">⚠️ ${escHtml(post.caution)}</div>` : ''}`;

    case 'fail':
      return `
        ${post.lesson ? `<div style="padding:12px 16px;background:#EDFAF4;border-radius:10px;font-size:13px;margin-top:8px"><strong>알게 된 점:</strong> ${escHtml(post.lesson)}</div>` : ''}
        ${post.redo   ? `<div style="padding:12px 16px;background:#EEF4FF;border-radius:10px;font-size:13px;margin-top:8px"><strong>다시 한다면:</strong> ${escHtml(post.redo)}</div>` : ''}`;

    case 'relay':
      return post.startSentence
        ? `<div style="padding:16px;background:var(--color-primary-bg);border-left:4px solid var(--color-primary);border-radius:4px;font-weight:600;margin-top:8px">"${escHtml(post.startSentence)}"</div>`
        : '';

    case 'acrostic':
      return post.keyword
        ? `<div style="padding:16px;background:#F3F4F6;border-radius:10px;margin-top:8px">
            <div style="font-size:12px;font-weight:700;color:var(--color-text-muted);margin-bottom:8px">제시어: ${escHtml(post.keyword)}</div>
            ${[...post.keyword].map(ch => `
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                <span style="width:28px;height:28px;background:var(--color-primary);color:#fff;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;flex-shrink:0">${ch}</span>
                <span style="font-size:13px;color:var(--color-text-muted)">:  삼행시로 참여해보세요</span>
              </div>`).join('')}
          </div>`
        : '';

    default: return '';
  }
}

function renderVoteOptions(post) {
  return (post.options || []).map((opt, i) => {
    const votes = typeof opt === 'object' ? (opt.votes || 0) : 0;
    const text  = typeof opt === 'object' ? opt.text : opt;
    const total = post.options.reduce((s, o) => s + (typeof o === 'object' ? (o.votes||0) : 0), 0);
    const pct   = total ? Math.round(votes / total * 100) : 0;
    return `
      <div class="vote-option" data-vote-idx="${i}">
        <div class="vote-option__bar vote-option__bar--selected" style="width:${pct}%"></div>
        <div class="vote-option__content">
          <span>${escHtml(text)}</span>
          <span class="vote-option__pct">${pct}%</span>
        </div>
      </div>`;
  }).join('');
}

function renderInteractive(post) {
  if (post.type === 'acrostic' && post.keyword) {
    const chars = [...post.keyword];
    return `
      <div style="padding:20px">
        <div style="font-size:14px;font-weight:700;margin-bottom:12px">✍️ 삼행시 참여하기</div>
        <div id="acrostic-submit-lines">
          ${chars.map((ch, i) => `
            <div class="acrostic-line" style="margin-bottom:8px">
              <span class="acrostic-char">${ch}</span>
              <input class="form-input acrostic-submit-input" placeholder="${ch}(으)로 시작하는 한 줄" data-idx="${i}">
            </div>`).join('')}
        </div>
        <button class="btn btn--primary btn--sm" id="btn-acrostic-submit" style="margin-top:8px">삼행시 올리기</button>
      </div>`;
  }
  return '';
}

function renderAcrosticSection(acrostics, postId) {
  return `
    <div class="acrostic-section">
      <div class="acrostic-section__title">✍️ 삼행시 ${acrostics.length}개</div>
      <div id="acrostic-list">
        ${acrostics.length
          ? acrostics.map(a => renderAcrosticCard(a, postId)).join('')
          : '<div class="acrostic-empty">첫 삼행시를 올려보세요!</div>'}
      </div>
    </div>`;
}

function renderAcrosticCard(entry, postId) {
  const timeStr = formatTime(entry.createdAt?.toDate?.() || entry.createdAt);
  const lines = entry.lines || [];
  const likeCount = entry.reactions?.like || 0;
  const linesHtml = lines.length
    ? lines.map(l => `
        <div class="acrostic-card__line">
          <span class="acrostic-card__char">${escHtml(l.char)}</span>
          <span class="acrostic-card__text">${escHtml(l.line)}</span>
        </div>`).join('')
    : `<div style="font-size:13px;color:var(--color-text-secondary)">${escHtml(entry.text || '').replace(/\n/g,'<br>')}</div>`;

  return `
    <div class="acrostic-card" data-acrostic-id="${entry.id}">
      <div class="acrostic-card__header">
        <div class="avatar avatar--sm">${(entry.authorName || '?')[0]}</div>
        <div>
          <div class="acrostic-card__name">${escHtml(entry.authorName || '익명')}</div>
          <div class="acrostic-card__time">${timeStr}</div>
        </div>
      </div>
      <div class="acrostic-card__lines">${linesHtml}</div>
      <div class="acrostic-card__footer">
        <button class="reaction-btn reaction-btn--sm" data-acrostic-like="${entry.id}" data-post-id="${postId}">
          👍${likeCount > 0 ? ` <strong>${likeCount}</strong>` : ''}
        </button>
      </div>
    </div>`;
}

function renderComment(c) {
  const timeStr = formatTime(c.createdAt?.toDate?.() || c.createdAt);
  return `
    <div class="comment-item">
      <div class="avatar avatar--sm">${(c.authorName||'?')[0]}</div>
      <div class="comment-item__body">
        <div class="comment-item__author">${escHtml(c.authorName || '익명')}</div>
        <div class="comment-item__text">${escHtml(c.text).replace(/\n/g,'<br>')}</div>
        <div class="comment-item__meta"><span>${timeStr}</span></div>
      </div>
    </div>`;
}

function setupDetailEvents(post, el) {
  // 댓글 등록
  document.getElementById('btn-comment')?.addEventListener('click', async () => {
    if (!auth.currentUser) { navigate('/login'); return; }
    const input = document.getElementById('comment-input');
    const text = input?.value.trim();
    if (!text) { toast.warn('댓글을 입력해주세요'); return; }
    try {
      await addDoc(collection(db, 'feeds', post.id, 'comments'), {
        text,
        authorId:   auth.currentUser.uid,
        authorName: auth.currentUser.displayName || '익명',
        createdAt:  serverTimestamp(),
      });
      await updateDoc(doc(db, 'feeds', post.id), { commentCount: increment(1) });
      input.value = '';
      toast.success('댓글을 남겼어요!');
      const comments = await fetchComments(post.id);
      const listEl = document.getElementById('comment-list');
      if (listEl) listEl.innerHTML = comments.map(c => renderComment(c)).join('');
    } catch (e) { toast.error('댓글 등록에 실패했어요'); }
  });

  // 투표 버튼
  document.querySelectorAll('[data-vote-idx]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!auth.currentUser) { navigate('/login'); return; }
      const idx = parseInt(btn.dataset.voteIdx);
      btn.disabled = true;
      try {
        const postRef  = doc(db, 'feeds', post.id);
        const snapshot = await getDoc(postRef);
        const data     = snapshot.data();

        if ((data.votedBy || []).includes(auth.currentUser.uid)) {
          toast.warn('이미 투표했어요'); btn.disabled = false; return;
        }

        const options = (data.options || []).map((opt, i) =>
          i === idx ? { ...opt, votes: (opt.votes || 0) + 1 } : opt
        );
        await updateDoc(postRef, { options, votedBy: arrayUnion(auth.currentUser.uid) });

        toast.success('투표했어요!');
        const voteArea = document.getElementById('vote-area');
        if (voteArea) voteArea.innerHTML = renderVoteOptions({ ...post, options });
      } catch { toast.error('투표에 실패했어요'); btn.disabled = false; }
    });
  });

  // OX 퀴즈 — 정답은 secret 서브컬렉션에서 확인
  document.querySelectorAll('[data-answer]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!auth.currentUser) { navigate('/login'); return; }
      const selected = btn.dataset.answer;
      document.querySelectorAll('[data-answer]').forEach(b => b.disabled = true);
      try {
        const secretSnap = await getDoc(doc(db, 'feeds', post.id, 'secret', 'answer'));
        const secret = secretSnap.exists() ? secretSnap.data() : null;
        const correct = secret ? (secret.answer === selected) : (post.answer === selected);
        showQuizResult(correct, secret?.explanation || post.explanation || '');
      } catch {
        const correct = post.answer === selected;
        showQuizResult(correct, post.explanation || '');
      }
    });
  });

  // 객관식 퀴즈 — 정답은 secret 서브컬렉션에서 확인
  document.querySelectorAll('[data-quiz-idx]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!auth.currentUser) { navigate('/login'); return; }
      const idx = parseInt(btn.dataset.quizIdx);
      document.querySelectorAll('[data-quiz-idx]').forEach(b => b.disabled = true);
      try {
        const secretSnap = await getDoc(doc(db, 'feeds', post.id, 'secret', 'answer'));
        const secret = secretSnap.exists() ? secretSnap.data() : null;
        const correct = secret ? (secret.answerIdx === idx) : (post.answerIdx === idx);
        showQuizResult(correct, secret?.explanation || post.explanation || '');
      } catch {
        showQuizResult(post.answerIdx === idx, post.explanation || '');
      }
    });
  });

  // 주관식 퀴즈 — 정답은 secret 서브컬렉션에서 확인
  document.getElementById('btn-quiz-submit')?.addEventListener('click', async () => {
    if (!auth.currentUser) { navigate('/login'); return; }
    const input = document.getElementById('quiz-short-input');
    const answer = input?.value.trim();
    if (!answer) return;
    if (input) input.disabled = true;
    document.getElementById('btn-quiz-submit')?.setAttribute('disabled', 'true');
    try {
      const secretSnap = await getDoc(doc(db, 'feeds', post.id, 'secret', 'answer'));
      const secret = secretSnap.exists() ? secretSnap.data() : null;
      const correct = secret ? (secret.answer === answer) : (post.answer === answer);
      showQuizResult(correct, secret?.explanation || post.explanation || '');
    } catch {
      showQuizResult(post.answer === answer, post.explanation || '');
    }
  });

  // 삼행시 참여 제출 → acrostics 서브컬렉션
  document.getElementById('btn-acrostic-submit')?.addEventListener('click', async () => {
    if (!auth.currentUser) { navigate('/login'); return; }
    const inputs = document.querySelectorAll('.acrostic-submit-input');
    const lines = [...inputs].map(i => i.value.trim());
    if (lines.some(l => !l)) { toast.warn('모든 줄을 입력해주세요'); return; }
    const structured = [...post.keyword].map((ch, i) => ({ char: ch, line: lines[i] }));
    const text = structured.map(l => `${l.char}: ${l.line}`).join('\n');
    try {
      await addDoc(collection(db, 'feeds', post.id, 'acrostics'), {
        text,
        lines: structured,
        authorId:   auth.currentUser.uid,
        authorName: auth.currentUser.displayName || '익명',
        reactions:  { like: 0 },
        createdAt:  serverTimestamp(),
      });
      await updateDoc(doc(db, 'feeds', post.id), { acrosticCount: increment(1) });
      inputs.forEach(i => i.value = '');
      toast.success('삼행시를 올렸어요! 🎉');
      const acrostics = await fetchAcrostics(post.id);
      const listEl = document.getElementById('acrostic-list');
      if (listEl) {
        listEl.innerHTML = acrostics.length
          ? acrostics.map(a => renderAcrosticCard(a, post.id)).join('')
          : '<div class="acrostic-empty">첫 삼행시를 올려보세요!</div>';
        setupAcrosticLikes(post.id);
      }
    } catch { toast.error('올리기에 실패했어요'); }
  });

  // 반응 바
  initReactionBar(post.id);
}

function showQuizResult(correct, explanation) {
  const resultEl = document.getElementById('quiz-result');
  if (!resultEl) return;
  resultEl.style.display = '';
  resultEl.className = `quiz-result quiz-result--${correct ? 'correct' : 'wrong'}`;
  const iconEl = resultEl.querySelector('.quiz-result__icon');
  const textEl = resultEl.querySelector('.quiz-result__text');
  const exEl   = resultEl.querySelector('.quiz-result__explanation');
  if (iconEl) iconEl.textContent = correct ? '⭕' : '❌';
  if (textEl) textEl.textContent = correct ? '정답이에요!' : '오답이에요!';
  if (exEl)   exEl.textContent   = explanation ? `💡 ${explanation}` : '';
}

function setupAcrosticLikes(postId) {
  document.querySelectorAll('[data-acrostic-like]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!auth.currentUser) { navigate('/login'); return; }
      if (btn.disabled) return;
      const acrosticId = btn.dataset.acrosticLike;
      btn.disabled = true;
      try {
        await updateDoc(doc(db, 'feeds', postId, 'acrostics', acrosticId), {
          'reactions.like': increment(1),
        });
        const strong = btn.querySelector('strong');
        const prev = strong ? parseInt(strong.textContent) : 0;
        if (strong) strong.textContent = prev + 1;
        else btn.insertAdjacentHTML('beforeend', ` <strong>1</strong>`);
        btn.disabled = false;
      } catch { btn.disabled = false; }
    });
  });
}

async function fetchComments(postId) {
  try {
    const q = query(collection(db, 'feeds', postId, 'comments'), orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}

async function fetchAcrostics(postId) {
  try {
    const q = query(collection(db, 'feeds', postId, 'acrostics'), orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatTime(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)    return '방금 전';
  if (diff < 3600)  return `${Math.floor(diff/60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff/3600)}시간 전`;
  return `${Math.floor(diff/86400)}일 전`;
}
