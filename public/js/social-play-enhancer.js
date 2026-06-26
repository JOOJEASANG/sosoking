import { db, auth } from './firebase.js';
import {
  collection, doc, getDoc, getDocs, query, orderBy,
  setDoc, updateDoc, increment, serverTimestamp, deleteField,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { navigate } from './router.js';
import { toast } from './components/toast.js';

const COMMENT_BATTLE_REACTIONS = [
  { key: 'funny', label: '웃김', emoji: '😂', weight: 3 },
  { key: 'king', label: '킹받음', emoji: '😤', weight: 3 },
  { key: 'agree', label: '공감', emoji: '👍', weight: 2 },
];
const RELAY_REACTIONS = [
  { key: 'makjang', label: '막장', emoji: '🔥', weight: 3 },
  { key: 'twist', label: '대반전', emoji: '😱', weight: 3 },
  { key: 'next', label: '다음편', emoji: '👉', weight: 2 },
];

let enhancing = false;
let lastKey = '';

function detailId() {
  const hash = window.location.hash.slice(1).split('?')[0] || '';
  const m = hash.match(/^\/detail\/([^/]+)$/);
  return m ? decodeURIComponent(m[1]) : '';
}

async function fetchComments(postId) {
  const q = query(collection(db, 'feeds', postId, 'comments'), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function fetchAttempts(postId) {
  try {
    const q = query(collection(db, 'feeds', postId, 'quiz_attempts'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}

function score(item, defs) {
  const reactions = item.reactions || {};
  return defs.reduce((sum, d) => sum + Number(reactions[d.key] || 0) * d.weight, 0);
}

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function cssOnce() {
  if (document.getElementById('social-play-enhancer-style')) return;
  const style = document.createElement('style');
  style.id = 'social-play-enhancer-style';
  style.textContent = `
    .spe-box{padding:18px 20px;border-top:1px solid var(--color-border)}
    .spe-highlight{padding:14px;border-radius:14px;background:linear-gradient(135deg,#fff7ed,#eef2ff);border:1px solid var(--color-border-light);margin-bottom:12px}
    .spe-kicker{font-size:12px;font-weight:900;color:#f97316;margin-bottom:5px}.spe-title{font-size:14px;font-weight:900}.spe-muted{font-size:12px;color:var(--color-text-muted)}
    .spe-reactions{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.spe-chip{border:1px solid var(--color-border);background:#fff;border-radius:999px;padding:6px 9px;font-size:12px;font-weight:800;cursor:pointer}.spe-chip.active{border-color:#f97316;background:#fff7ed;color:#ea580c}
    .spe-rank-card{padding:12px;border:1px solid var(--color-border-light);border-radius:14px;background:#fff;margin-bottom:9px}.spe-rank-head{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:6px}.spe-rank-medal{font-weight:900}.spe-rank-text{font-size:14px;line-height:1.5}
    .spe-grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.spe-stat{padding:11px;border-radius:12px;background:#f8fafc;text-align:center}.spe-stat strong{display:block;font-size:18px}.spe-stat span{font-size:12px;color:var(--color-text-muted)}
    @media(max-width:520px){.spe-grid3{grid-template-columns:1fr}.spe-box{padding:16px}}
  `;
  document.head.appendChild(style);
}

async function applyCommentBattle(postId, comments) {
  const section = document.querySelector('.comment-section');
  const columns = document.querySelector('.cbattle-columns');
  if (!section || !columns) return;
  const old = document.getElementById('spe-cbattle-rank');
  old?.remove();
  const sorted = [...comments].sort((a, b) => score(b, COMMENT_BATTLE_REACTIONS) - score(a, COMMENT_BATTLE_REACTIONS));
  const best = sorted[0];
  const html = `
    <div id="spe-cbattle-rank" class="spe-box">
      <div class="spe-title">💥 댓글배틀 랭킹</div>
      <div class="spe-muted" style="margin-top:3px">웃김·킹받음·공감 반응으로 승부가 정해져요.</div>
      ${best ? `<div class="spe-highlight" style="margin-top:12px"><div class="spe-kicker">👑 현재 1위 댓글</div><div style="font-size:16px;font-weight:900;line-height:1.45">${esc(best.text).replace(/\n/g,'<br>')}</div><div class="spe-muted" style="margin-top:6px">${esc(best.authorName || '익명')} · 점수 ${score(best, COMMENT_BATTLE_REACTIONS)}</div></div>` : ''}
      <div>${sorted.map((c, idx) => renderRankedComment(c, idx, COMMENT_BATTLE_REACTIONS, 'cbattle')).join('')}</div>
    </div>`;
  columns.insertAdjacentHTML('afterend', html);
  bindCommentReactionButtons(postId, 'cbattle', COMMENT_BATTLE_REACTIONS);
}

function renderRankedComment(c, idx, defs, mode) {
  const medal = ['🥇', '🥈', '🥉'][idx] || `${idx + 1}위`;
  const reactions = c.reactions || {};
  const my = auth.currentUser?.uid ? c.reactedWith?.[auth.currentUser.uid] : '';
  return `
    <div class="spe-rank-card" data-spe-comment="${c.id}">
      <div class="spe-rank-head"><span class="spe-rank-medal">${medal} ${esc(c.authorName || '익명')}</span><span class="spe-muted">점수 ${score(c, defs)}</span></div>
      <div class="spe-rank-text">${esc(c.text).replace(/\n/g,'<br>')}</div>
      <div class="spe-reactions">
        ${defs.map(r => `<button class="spe-chip ${my === r.key ? 'active' : ''}" data-spe-mode="${mode}" data-spe-comment-id="${c.id}" data-spe-reaction="${r.key}">${r.emoji} ${r.label}${reactions[r.key] ? ` ${reactions[r.key]}` : ''}</button>`).join('')}
      </div>
    </div>`;
}

async function applyRelay(postId, comments) {
  const section = document.querySelector('.comment-section');
  const story = document.querySelector('.relay-story');
  if (!section || !story) return;
  const old = document.getElementById('spe-relay-rank');
  old?.remove();
  const sorted = [...comments].sort((a, b) => score(b, RELAY_REACTIONS) - score(a, RELAY_REACTIONS));
  const best = sorted[0];
  const html = `
    <div id="spe-relay-rank" class="spe-box">
      <div class="spe-title">🎭 막장릴레이 반응판</div>
      <div class="spe-muted" style="margin-top:3px">각 장면에 막장·대반전·다음편 반응을 남길 수 있어요.</div>
      ${best ? `<div class="spe-highlight" style="margin-top:12px"><div class="spe-kicker">🔥 가장 뜨거운 장면</div><div style="font-size:15px;font-weight:900;line-height:1.5">${esc(best.text).replace(/\n/g,'<br>')}</div><div class="spe-muted" style="margin-top:6px">${esc(best.authorName || '익명')} · 점수 ${score(best, RELAY_REACTIONS)}</div></div>` : ''}
      <div>${comments.map((c, idx) => renderRelayScene(c, idx)).join('')}</div>
    </div>`;
  story.insertAdjacentHTML('afterend', html);
  bindCommentReactionButtons(postId, 'relay', RELAY_REACTIONS);
}

function renderRelayScene(c, idx) {
  const reactions = c.reactions || {};
  const my = auth.currentUser?.uid ? c.reactedWith?.[auth.currentUser.uid] : '';
  return `
    <div class="spe-rank-card" data-spe-comment="${c.id}">
      <div class="spe-rank-head"><span class="spe-rank-medal">${idx + 1}장면 · ${esc(c.authorName || '익명')}</span><span class="spe-muted">점수 ${score(c, RELAY_REACTIONS)}</span></div>
      <div class="spe-rank-text">${esc(c.text).replace(/\n/g,'<br>')}</div>
      <div class="spe-reactions">
        ${RELAY_REACTIONS.map(r => `<button class="spe-chip ${my === r.key ? 'active' : ''}" data-spe-mode="relay" data-spe-comment-id="${c.id}" data-spe-reaction="${r.key}">${r.emoji} ${r.label}${reactions[r.key] ? ` ${reactions[r.key]}` : ''}</button>`).join('')}
      </div>
    </div>`;
}

async function bindCommentReactionButtons(postId, mode, defs) {
  document.querySelectorAll(`[data-spe-mode="${mode}"]`).forEach(btn => {
    if (btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', async () => {
      if (!auth.currentUser) { navigate('/login'); return; }
      const uid = auth.currentUser.uid;
      const commentId = btn.dataset.speCommentId;
      const reaction = btn.dataset.speReaction;
      const ref = doc(db, 'feeds', postId, 'comments', commentId);
      btn.disabled = true;
      try {
        const snap = await getDoc(ref);
        const data = snap.exists() ? snap.data() : {};
        const old = data.reactedWith?.[uid] || '';
        if (old === reaction) {
          await updateDoc(ref, { [`reactions.${reaction}`]: increment(-1), [`reactedWith.${uid}`]: deleteField() });
        } else {
          const patch = { [`reactions.${reaction}`]: increment(1), [`reactedWith.${uid}`]: reaction };
          if (old) patch[`reactions.${old}`] = increment(-1);
          await updateDoc(ref, patch);
        }
        toast.success('반응을 남겼어요!');
        await refreshEnhancer(postId);
      } catch (e) {
        console.warn(e);
        toast.error('반응 등록에 실패했어요');
      } finally { btn.disabled = false; }
    });
  });
}

async function applyNamingBest(comments) {
  const list = document.getElementById('comment-list');
  if (!list) return;
  document.getElementById('spe-naming-best')?.remove();
  const sorted = [...comments].sort((a, b) => Number(b.likes || 0) - Number(a.likes || 0));
  const best = sorted[0];
  if (!best) return;
  list.insertAdjacentHTML('beforebegin', `
    <div id="spe-naming-best" class="spe-box" style="padding-top:0">
      <div class="spe-highlight"><div class="spe-kicker">👑 현재 베스트 제목</div><div style="font-size:19px;font-weight:950;line-height:1.35">${esc(best.text)}</div><div class="spe-muted" style="margin-top:6px">${esc(best.authorName || '익명')} · 좋아요 ${best.likes || 0}</div></div>
    </div>`);
}

async function applyQuiz(postId, post) {
  const quizArea = document.getElementById('quiz-area');
  const commentSection = document.querySelector('.comment-section');
  if (!quizArea || !commentSection) return;
  const attempts = await fetchAttempts(postId);
  document.getElementById('spe-quiz-box')?.remove();
  const total = attempts.length;
  const correct = attempts.filter(a => a.correct).length;
  const rate = total ? Math.round(correct / total * 100) : 0;
  const recentCorrect = attempts.filter(a => a.correct).slice(0, 4);
  commentSection.insertAdjacentHTML('beforebegin', `
    <div id="spe-quiz-box" class="spe-box">
      <div class="spe-title">🧠 퀴즈 도전 현황</div>
      <div class="spe-grid3" style="margin-top:10px">
        <div class="spe-stat"><strong>${total}</strong><span>도전자</span></div>
        <div class="spe-stat"><strong>${correct}</strong><span>정답</span></div>
        <div class="spe-stat"><strong>${rate}%</strong><span>정답률</span></div>
      </div>
      <div class="spe-highlight" style="margin-top:10px"><div class="spe-kicker">🏆 최근 정답자</div>${recentCorrect.length ? recentCorrect.map(a => `<span class="spe-chip" style="display:inline-block;margin:3px 4px 0 0">${esc(a.authorName || '익명')}</span>`).join('') : '<div class="spe-muted">아직 정답자가 없어요.</div>'}</div>
    </div>`);
  bindQuizRecording(postId, post);
}

function normalize(v) { return String(v || '').trim().replace(/\s+/g, '').toLowerCase(); }

async function getCorrectInfo(postId, fallbackPost) {
  try {
    const secret = await getDoc(doc(db, 'feeds', postId, 'secret', 'answer'));
    if (secret.exists()) return secret.data();
  } catch {}
  return fallbackPost || {};
}

function bindQuizRecording(postId, post) {
  document.querySelectorAll('[data-answer]').forEach(btn => bind(btn, async () => {
    const secret = await getCorrectInfo(postId, post);
    const selected = btn.dataset.answer;
    return { selected, correct: secret.answer === selected };
  }));
  document.querySelectorAll('[data-quiz-idx]').forEach(btn => bind(btn, async () => {
    const secret = await getCorrectInfo(postId, post);
    const selected = String(parseInt(btn.dataset.quizIdx));
    const correct = Number(secret.answerIdx) === Number(selected);
    return { selected, correct };
  }));
  const submit = document.getElementById('btn-quiz-submit');
  bind(submit, async () => {
    const answer = document.getElementById('quiz-short-input')?.value || '';
    const secret = await getCorrectInfo(postId, post);
    return { selected: answer, correct: normalize(secret.answer) === normalize(answer) };
  });

  function bind(el, fn) {
    if (!el || el.dataset.quizRecordBound === '1') return;
    el.dataset.quizRecordBound = '1';
    el.addEventListener('click', async () => {
      if (!auth.currentUser) return;
      try {
        const result = await fn();
        if (!result.selected) return;
        await setDoc(doc(db, 'feeds', postId, 'quiz_attempts', auth.currentUser.uid), {
          userId: auth.currentUser.uid,
          authorName: auth.currentUser.displayName || '익명',
          selected: String(result.selected).slice(0, 80),
          correct: !!result.correct,
          type: post.type,
          createdAt: serverTimestamp(),
          createdAtMs: Date.now(),
        }, { merge: true });
        setTimeout(() => refreshEnhancer(postId), 450);
      } catch (e) { console.warn('[소소킹] 퀴즈 기록 실패', e); }
    });
  }
}

async function refreshEnhancer(postId) {
  lastKey = '';
  await enhance();
}

async function enhance() {
  const postId = detailId();
  if (!postId || enhancing) return;
  const key = `${postId}:${document.querySelector('.detail-title')?.textContent || ''}:${document.querySelectorAll('[data-comment-id]').length}`;
  if (key === lastKey) return;
  enhancing = true;
  try {
    cssOnce();
    const postSnap = await getDoc(doc(db, 'feeds', postId));
    if (!postSnap.exists()) return;
    const post = { id: postId, ...postSnap.data() };
    const comments = await fetchComments(postId).catch(() => []);
    if (post.type === 'cbattle') await applyCommentBattle(postId, comments);
    if (post.type === 'relay') await applyRelay(postId, comments);
    if (post.type === 'naming') await applyNamingBest(comments);
    if (post.type === 'quiz' || post.type === 'ox') await applyQuiz(postId, post);
    lastKey = key;
  } finally {
    enhancing = false;
  }
}

function schedule() { setTimeout(enhance, 160); }
window.addEventListener('hashchange', () => { lastKey = ''; schedule(); });
new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
schedule();
