import { db, auth } from '../firebase.js';
import {
  doc, getDoc, collection, query, orderBy, getDocs,
  addDoc, updateDoc, deleteDoc, increment, serverTimestamp, arrayUnion, arrayRemove, deleteField,
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

const ACROSTIC_REACTIONS = [
  { key: 'like',  emoji: '👍' },
  { key: 'funny', emoji: '😂' },
  { key: 'fire',  emoji: '🔥' },
];

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
            <button id="btn-report" style="margin-left:auto;font-size:11px;color:var(--color-text-muted);background:none;border:1px solid var(--color-border);border-radius:var(--radius-pill);padding:3px 10px;cursor:pointer;transition:all 0.15s" title="신고하기">🚨 신고</button>
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

        ${renderCommentSection(post, comments)}
      </div>
    </div>`;

  setupDetailEvents(post, el);
  setupAcrosticLikes(post.id);
}

function renderImageSection(images) {
  if (!images?.length) return '';
  const dataAttr = encodeURIComponent(JSON.stringify(images));
  const visible  = images.slice(0, 4);
  const extra    = images.length > 4 ? images.length - 4 : 0;
  const cols     = Math.min(images.length, 4);
  return `
    <div class="detail-gallery detail-gallery--${cols}" data-images="${dataAttr}">
      ${visible.map((src, i) => `
        <div class="detail-gallery__thumb" data-gallery-idx="${i}">
          <img src="${src}" alt="" loading="lazy">
          ${i === 3 && extra > 0 ? `<div class="detail-gallery__more">+${extra}</div>` : ''}
        </div>`).join('')}
    </div>`;
}

function renderTypeBody(post) {
  switch (post.type) {
    case 'balance':
    case 'vote':
    case 'concern':
      if (!post.options?.length) return '';
      return `<div id="vote-area" class="quiz-options" style="margin-top:16px">${renderVoteOptions(post)}</div>`;

    case 'battle':
      return renderBattleVs(post);

    case 'story':
      return post.feeling
        ? `<div style="padding:12px 16px;background:#F0FDF4;border-left:3px solid #22C55E;border-radius:8px;font-size:13px;margin-top:8px"><strong>💚 느낀 점</strong><br>${escHtml(post.feeling).replace(/\n/g,'<br>')}</div>`
        : '';

    case 'laugh': {
      const diffMap = { easy:'😌 쉬움', normal:'😬 보통', hard:'😤 어려움', extreme:'💀 극한' };
      return post.difficulty
        ? `<div style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;background:#FEF3C7;border-radius:var(--radius-pill);font-size:13px;font-weight:700;margin-top:8px">웃참 난이도: ${diffMap[post.difficulty] || post.difficulty}</div>`
        : '';
    }

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
  const uid = auth.currentUser?.uid;
  const myReaction = uid ? (entry.reactedWith?.[uid] ?? null) : null;
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
        ${ACROSTIC_REACTIONS.map(r => {
          const cnt = entry.reactions?.[r.key] || 0;
          const active = myReaction === r.key ? 'active' : '';
          return `<button class="reaction-btn reaction-btn--sm ${active}" data-acrostic-id="${entry.id}" data-post-id="${postId}" data-acrostic-reaction="${r.key}">
            ${r.emoji}${cnt > 0 ? ` <strong>${cnt}</strong>` : ''}
          </button>`;
        }).join('')}
      </div>
    </div>`;
}

function renderComment(c) {
  const timeStr = formatTime(c.createdAt?.toDate?.() || c.createdAt);
  const isOwn   = auth.currentUser?.uid === c.authorId;
  return `
    <div class="comment-item" data-comment-id="${c.id}">
      <div class="avatar avatar--sm">${(c.authorName||'?')[0]}</div>
      <div class="comment-item__body">
        <div class="comment-item__author">${escHtml(c.authorName || '익명')}</div>
        <div class="comment-item__text">${escHtml(c.text).replace(/\n/g,'<br>')}</div>
        <div class="comment-item__meta">
          <span>${timeStr}</span>
          ${isOwn ? `<button class="comment-delete-btn" data-comment-id="${c.id}">삭제</button>` : ''}
        </div>
      </div>
    </div>`;
}

function setupDetailEvents(post, el) {
  // 신고 버튼
  document.getElementById('btn-report')?.addEventListener('click', async () => {
    if (!auth.currentUser) { navigate('/login'); return; }
    const reason = prompt('신고 사유를 입력해주세요 (스팸, 욕설, 허위정보 등)');
    if (!reason?.trim()) return;
    try {
      await addDoc(collection(db, 'reports'), {
        postId:       post.id,
        postTitle:    post.title || '',
        reason:       reason.trim(),
        reporterId:   auth.currentUser.uid,
        reporterName: auth.currentUser.displayName || '익명',
        resolved:     false,
        createdAt:    serverTimestamp(),
      });
      toast.success('신고가 접수됐어요. 검토 후 처리할게요.');
      document.getElementById('btn-report').textContent = '신고됨';
      document.getElementById('btn-report').disabled = true;
    } catch { toast.error('신고 접수에 실패했어요'); }
  });

  // cbattle 팀 선택
  let _cbattleSide = null;
  document.querySelectorAll('.cbattle-side-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _cbattleSide = btn.dataset.side;
      document.querySelectorAll('.cbattle-side-btn').forEach(b => b.classList.toggle('active', b === btn));
      const input = document.getElementById('comment-input');
      if (input) input.placeholder = `${_cbattleSide}팀으로 참여합니다`;
    });
  });

  // relay 글자수 카운터
  document.getElementById('comment-input')?.addEventListener('input', function () {
    const counter = document.getElementById('relay-char-count');
    if (counter) counter.textContent = `${this.value.length} / 150`;
  });

  // 댓글 등록
  document.getElementById('btn-comment')?.addEventListener('click', async () => {
    if (!auth.currentUser) { navigate('/login'); return; }
    const input = document.getElementById('comment-input');
    const text = input?.value.trim();
    if (!text) { toast.warn('댓글을 입력해주세요'); return; }
    if (post.type === 'relay' && text.length > 150) { toast.warn('150자 이하로 입력해주세요'); return; }
    if (post.type === 'cbattle' && !_cbattleSide) { toast.warn('팀을 먼저 선택해주세요'); return; }

    const commentData = {
      text,
      authorId:   auth.currentUser.uid,
      authorName: auth.currentUser.displayName || '익명',
      createdAt:  serverTimestamp(),
    };
    if (post.type === 'cbattle')                          commentData.side    = _cbattleSide;
    if (post.type === 'naming' || post.type === 'drip')   commentData.likes   = 0;
    if (post.type === 'naming' || post.type === 'drip')   commentData.likedBy = [];

    const successMsg = { relay:'이야기를 이어썼어요!', naming:'제목을 제안했어요!', drip:'드립을 올렸어요!' }[post.type] || '댓글을 남겼어요!';
    try {
      await addDoc(collection(db, 'feeds', post.id, 'comments'), commentData);
      await updateDoc(doc(db, 'feeds', post.id), { commentCount: increment(1) });
      input.value = '';
      const counter = document.getElementById('relay-char-count');
      if (counter) counter.textContent = '0 / 150';
      toast.success(successMsg);
      const comments = await fetchComments(post.id);
      refreshCommentList(post, comments);
    } catch { toast.error('등록에 실패했어요'); }
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
        if (voteArea) {
          const updated = { ...post, options };
          voteArea.outerHTML = post.type === 'battle'
            ? renderBattleVs(updated)
            : `<div id="vote-area" class="quiz-options" style="margin-top:16px">${renderVoteOptions(updated)}</div>`;
        }
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
        reactions:  { like: 0, funny: 0, fire: 0 },
        reactedWith: {},
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

  // 이미지 갤러리 클릭
  document.querySelectorAll('.detail-gallery__thumb').forEach(thumb => {
    thumb.addEventListener('click', () => {
      const grid   = thumb.closest('[data-images]');
      const images = JSON.parse(decodeURIComponent(grid.dataset.images));
      const idx    = parseInt(thumb.dataset.galleryIdx);
      openGallery(images, idx);
    });
  });

  // 댓글 삭제 (본인 댓글만)
  setupCommentDelete(post.id);

  // naming/drip 댓글 좋아요
  if (post.type === 'naming' || post.type === 'drip') setupCommentLikes(post.id);

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
  document.querySelectorAll('[data-acrostic-reaction]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!auth.currentUser) { navigate('/login'); return; }
      if (btn._pending) return;

      const uid        = auth.currentUser.uid;
      const key        = btn.dataset.acrosticReaction;
      const acrosticId = btn.dataset.acrosticId;
      const card       = btn.closest('[data-acrostic-id]');
      const activeBtn  = card?.querySelector('[data-acrostic-reaction].active');
      const currentKey = activeBtn?.dataset.acrosticReaction ?? null;

      btn._pending = true;
      const ref = doc(db, 'feeds', postId, 'acrostics', acrosticId);
      try {
        if (currentKey === key) {
          await updateDoc(ref, {
            [`reactions.${key}`]:  increment(-1),
            [`reactedWith.${uid}`]: deleteField(),
          });
          btn.classList.remove('active');
          adjustAcrosticCount(btn, -1);
        } else if (currentKey) {
          await updateDoc(ref, {
            [`reactions.${currentKey}`]: increment(-1),
            [`reactions.${key}`]:        increment(1),
            [`reactedWith.${uid}`]:      key,
          });
          activeBtn.classList.remove('active');
          adjustAcrosticCount(activeBtn, -1);
          btn.classList.add('active');
          adjustAcrosticCount(btn, 1);
        } else {
          await updateDoc(ref, {
            [`reactions.${key}`]:  increment(1),
            [`reactedWith.${uid}`]: key,
          });
          btn.classList.add('active');
          adjustAcrosticCount(btn, 1);
        }
      } catch { /* silent */ }
      btn._pending = false;
    });
  });
}

function adjustAcrosticCount(btn, delta) {
  if (!btn) return;
  const strong = btn.querySelector('strong');
  if (strong) {
    const next = Math.max(0, parseInt(strong.textContent || '0') + delta);
    if (next === 0) strong.remove();
    else strong.textContent = next;
  } else if (delta > 0) {
    btn.insertAdjacentHTML('beforeend', ` <strong>1</strong>`);
  }
}

function setupCommentDelete(postId) {
  document.querySelectorAll('.comment-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('댓글을 삭제할까요?')) return;
      const commentId = btn.dataset.commentId;
      try {
        await deleteDoc(doc(db, 'feeds', postId, 'comments', commentId));
        await updateDoc(doc(db, 'feeds', postId), { commentCount: increment(-1) });
        btn.closest('[data-comment-id]')?.remove();
        toast.success('댓글을 삭제했어요');
      } catch { toast.error('삭제에 실패했어요'); }
    });
  });
}

function openGallery(images, startIdx) {
  let cur = startIdx;
  const overlay = document.createElement('div');
  overlay.className = 'gallery-overlay';

  const render = () => {
    overlay.innerHTML = `
      <button class="gallery-close" aria-label="닫기">✕</button>
      <button class="gallery-nav gallery-nav--prev" ${cur === 0 ? 'style="visibility:hidden"' : ''}>‹</button>
      <div class="gallery-img-wrap">
        <img class="gallery-img" src="${images[cur]}" alt="">
      </div>
      <button class="gallery-nav gallery-nav--next" ${cur === images.length - 1 ? 'style="visibility:hidden"' : ''}>›</button>
      ${images.length > 1 ? `<div class="gallery-counter">${cur + 1} / ${images.length}</div>` : ''}`;

    overlay.querySelector('.gallery-close').onclick = close;
    const prev = overlay.querySelector('.gallery-nav--prev');
    const next = overlay.querySelector('.gallery-nav--next');
    if (prev) prev.onclick = (e) => { e.stopPropagation(); if (cur > 0) { cur--; render(); } };
    if (next) next.onclick = (e) => { e.stopPropagation(); if (cur < images.length - 1) { cur++; render(); } };
  };

  const close = () => {
    overlay.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft'  && cur > 0)                { cur--; render(); }
    if (e.key === 'ArrowRight' && cur < images.length - 1){ cur++; render(); }
  };

  render();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
}

function renderBattleVs(post) {
  if (!post.options?.length) return '';
  if (post.options.length !== 2) {
    return `<div id="vote-area" class="quiz-options" style="margin-top:16px">${renderVoteOptions(post)}</div>`;
  }
  const total = post.options.reduce((s, o) => s + ((typeof o === 'object' ? o.votes : 0) || 0), 0);
  const sides = post.options.map((o, i) => ({
    text:  typeof o === 'object' ? o.text : o,
    votes: typeof o === 'object' ? (o.votes || 0) : 0,
    pct:   total ? Math.round(((typeof o === 'object' ? o.votes : 0) || 0) / total * 100) : 0,
    i,
  }));
  return `
    <div class="battle-vs-area" id="vote-area">
      <button class="battle-side" data-vote-idx="0">
        <div class="battle-side__text">${escHtml(sides[0].text)}</div>
        <div class="battle-side__pct">${sides[0].pct}%</div>
        <div class="battle-side__votes">${sides[0].votes}표</div>
      </button>
      <div class="battle-vs-center"><span>⚔️</span><span class="battle-vs-label">VS</span></div>
      <button class="battle-side battle-side--b" data-vote-idx="1">
        <div class="battle-side__text">${escHtml(sides[1].text)}</div>
        <div class="battle-side__pct">${sides[1].pct}%</div>
        <div class="battle-side__votes">${sides[1].votes}표</div>
      </button>
    </div>`;
}

function renderCommentSection(post, comments) {
  const loggedIn = !!auth.currentUser;

  if (post.type === 'relay') {
    return `
      <div class="comment-section">
        <div class="comment-section__title">📖 릴레이 이야기</div>
        ${renderRelayStory(post.startSentence, comments)}
        <div class="comment-write-box" id="comment-write">
          <textarea id="comment-input" placeholder="${loggedIn ? '다음 이야기를 이어주세요 (최대 150자)' : '로그인 후 참여 가능'}" maxlength="150"></textarea>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
            <span id="relay-char-count" style="font-size:12px;color:var(--color-text-muted)">0 / 150</span>
            <button class="btn btn--primary btn--sm" id="btn-comment">이어쓰기</button>
          </div>
        </div>
      </div>`;
  }

  if (post.type === 'cbattle') {
    const aList = comments.filter(c => c.side === 'A');
    const bList = comments.filter(c => c.side === 'B');
    return `
      <div class="comment-section">
        <div class="comment-section__title">⚔️ 댓글 배틀 (${comments.length}개)</div>
        <div class="cbattle-side-select">
          <button class="cbattle-side-btn cbattle-side-btn--a" data-side="A">🔴 A팀</button>
          <button class="cbattle-side-btn cbattle-side-btn--b" data-side="B">🔵 B팀</button>
        </div>
        <div class="comment-write-box" id="comment-write">
          <textarea id="comment-input" placeholder="${loggedIn ? '팀을 선택 후 참여해보세요' : '로그인 후 참여 가능'}"></textarea>
          <button class="btn btn--primary btn--sm" style="align-self:flex-end" id="btn-comment">참여하기</button>
        </div>
        <div class="cbattle-columns">
          <div class="cbattle-col cbattle-col--a">
            <div class="cbattle-col__title">🔴 A팀 ${aList.length}</div>
            ${aList.length ? aList.map(c => renderCbattleComment(c)).join('') : '<div class="cbattle-col__empty">첫 번째로 참여!</div>'}
          </div>
          <div class="cbattle-col cbattle-col--b">
            <div class="cbattle-col__title">🔵 B팀 ${bList.length}</div>
            ${bList.length ? bList.map(c => renderCbattleComment(c)).join('') : '<div class="cbattle-col__empty">첫 번째로 참여!</div>'}
          </div>
        </div>
      </div>`;
  }

  if (post.type === 'naming' || post.type === 'drip') {
    const cfg = post.type === 'naming'
      ? { title: '✏️ 제목 제안', placeholder: '사진에 어울리는 제목을 제안해보세요!', btn: '제안하기' }
      : { title: '🎤 드립 올리기', placeholder: '한 줄 드립을 올려보세요!', btn: '올리기' };
    return `
      <div class="comment-section">
        <div class="comment-section__title">${cfg.title} (${comments.length}개)</div>
        <div class="comment-write-box" id="comment-write">
          <textarea id="comment-input" placeholder="${loggedIn ? cfg.placeholder : '로그인 후 참여 가능'}"></textarea>
          <button class="btn btn--primary btn--sm" style="align-self:flex-end" id="btn-comment">${cfg.btn}</button>
        </div>
        <div id="comment-list">
          ${comments.length
            ? comments.map(c => renderLikeableComment(c)).join('')
            : `<div style="text-align:center;padding:24px;font-size:13px;color:var(--color-text-muted)">첫 번째로 ${cfg.title.slice(2)} 보세요!</div>`}
        </div>
      </div>`;
  }

  return `
    <div class="comment-section">
      <div class="comment-section__title">댓글 ${comments.length}</div>
      <div class="comment-write-box" id="comment-write">
        <textarea id="comment-input" placeholder="${loggedIn ? '댓글을 입력하세요' : '로그인 후 댓글 작성 가능'}"></textarea>
        <button class="btn btn--primary btn--sm" style="align-self:flex-end" id="btn-comment">등록</button>
      </div>
      <div id="comment-list">
        ${comments.length
          ? comments.map(c => renderComment(c)).join('')
          : '<div style="text-align:center;padding:24px;font-size:13px;color:var(--color-text-muted)">첫 댓글을 남겨보세요!</div>'}
      </div>
    </div>`;
}

function renderRelayStory(startSentence, comments) {
  if (!startSentence && !comments.length) return '';
  return `
    <div class="relay-story">
      ${startSentence ? `
        <div class="relay-story__segment">
          <div class="relay-story__num">시작</div>
          <div class="relay-story__text">${escHtml(startSentence)}</div>
        </div>` : ''}
      ${comments.map((c, i) => `
        <div class="relay-story__segment">
          <div class="relay-story__num">${i + 1}</div>
          <div class="relay-story__body">
            <div class="relay-story__text">${escHtml(c.text).replace(/\n/g,'<br>')}</div>
            <div class="relay-story__author">${escHtml(c.authorName || '익명')}</div>
          </div>
        </div>`).join('')}
    </div>`;
}

function renderLikeableComment(c) {
  const timeStr = formatTime(c.createdAt?.toDate?.() || c.createdAt);
  const isOwn   = auth.currentUser?.uid === c.authorId;
  const likes   = c.likes || 0;
  const liked   = (c.likedBy || []).includes(auth.currentUser?.uid || '');
  return `
    <div class="likeable-comment" data-comment-id="${c.id}">
      <div class="likeable-comment__content">
        <span class="likeable-comment__text">${escHtml(c.text)}</span>
        <span class="likeable-comment__meta">${escHtml(c.authorName || '익명')} · ${timeStr}</span>
      </div>
      <div class="likeable-comment__actions">
        <button class="likeable-comment__like ${liked ? 'active' : ''}" data-comment-id="${c.id}">
          👍${likes > 0 ? ` <strong>${likes}</strong>` : ''}
        </button>
        ${isOwn ? `<button class="comment-delete-btn" data-comment-id="${c.id}">삭제</button>` : ''}
      </div>
    </div>`;
}

function renderCbattleComment(c) {
  const timeStr = formatTime(c.createdAt?.toDate?.() || c.createdAt);
  const isOwn   = auth.currentUser?.uid === c.authorId;
  return `
    <div class="cbattle-comment cbattle-comment--${(c.side || 'a').toLowerCase()}" data-comment-id="${c.id}">
      <div class="cbattle-comment__text">${escHtml(c.text).replace(/\n/g,'<br>')}</div>
      <div class="cbattle-comment__meta">
        <span>${escHtml(c.authorName || '익명')}</span>
        <span>${timeStr}</span>
        ${isOwn ? `<button class="comment-delete-btn" data-comment-id="${c.id}">삭제</button>` : ''}
      </div>
    </div>`;
}

function refreshCommentList(post, comments) {
  if (post.type === 'relay') {
    const storyEl = document.querySelector('.relay-story');
    const newHtml = renderRelayStory(post.startSentence, comments);
    if (storyEl) storyEl.outerHTML = newHtml;
    else {
      const section = document.querySelector('.comment-section');
      if (section) section.insertAdjacentHTML('afterbegin', newHtml);
    }
  } else if (post.type === 'cbattle') {
    const aList = comments.filter(c => c.side === 'A');
    const bList = comments.filter(c => c.side === 'B');
    const aCol  = document.querySelector('.cbattle-col--a');
    const bCol  = document.querySelector('.cbattle-col--b');
    if (aCol) aCol.innerHTML = `<div class="cbattle-col__title">🔴 A팀 ${aList.length}</div>${aList.length ? aList.map(c => renderCbattleComment(c)).join('') : '<div class="cbattle-col__empty">첫 번째로 참여!</div>'}`;
    if (bCol) bCol.innerHTML = `<div class="cbattle-col__title">🔵 B팀 ${bList.length}</div>${bList.length ? bList.map(c => renderCbattleComment(c)).join('') : '<div class="cbattle-col__empty">첫 번째로 참여!</div>'}`;
    setupCommentDelete(post.id);
  } else if (post.type === 'naming' || post.type === 'drip') {
    const listEl = document.getElementById('comment-list');
    if (listEl) {
      listEl.innerHTML = comments.length
        ? comments.map(c => renderLikeableComment(c)).join('')
        : '<div style="text-align:center;padding:24px;font-size:13px;color:var(--color-text-muted)">첫 번째로 참여해보세요!</div>';
      setupCommentDelete(post.id);
      setupCommentLikes(post.id);
    }
  } else {
    const listEl = document.getElementById('comment-list');
    if (listEl) {
      listEl.innerHTML = comments.length
        ? comments.map(c => renderComment(c)).join('')
        : '<div style="text-align:center;padding:24px;font-size:13px;color:var(--color-text-muted)">첫 댓글을 남겨보세요!</div>';
      setupCommentDelete(post.id);
    }
  }
}

function setupCommentLikes(postId) {
  document.querySelectorAll('.likeable-comment__like').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!auth.currentUser) { navigate('/login'); return; }
      if (btn._pending) return;
      btn._pending = true;
      const uid = auth.currentUser.uid;
      const commentId = btn.dataset.commentId;
      const ref = doc(db, 'feeds', postId, 'comments', commentId);
      try {
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        const liked = (snap.data().likedBy || []).includes(uid);
        if (liked) {
          await updateDoc(ref, { likes: increment(-1), likedBy: arrayRemove(uid) });
          btn.classList.remove('active');
          adjustAcrosticCount(btn, -1);
        } else {
          await updateDoc(ref, { likes: increment(1), likedBy: arrayUnion(uid) });
          btn.classList.add('active');
          adjustAcrosticCount(btn, 1);
        }
      } catch { /* silent */ }
      btn._pending = false;
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
