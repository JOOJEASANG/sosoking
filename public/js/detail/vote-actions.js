import { auth, db } from '../firebase.js';
import { toast } from '../components/toast.js';
import { doc, getDoc, updateDoc, arrayUnion } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { ensureAnonymousActor } from './action-utils.js';

function esc(value) {
  return String(value || '').replace(/[&<>"]/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  }[m]));
}

export function renderLegacyVoteOptions(post) {
  return (post.options || []).map((opt, i) => {
    const votes = typeof opt === 'object' ? (opt.votes || 0) : 0;
    const text = typeof opt === 'object' ? opt.text : opt;
    const total = post.options.reduce((sum, option) => sum + (typeof option === 'object' ? (option.votes || 0) : 0), 0);
    const pct = total ? Math.round(votes / total * 100) : 0;
    return `
      <div class="vote-option" data-vote-idx="${i}">
        <div class="vote-option__bar vote-option__bar--selected" style="width:${pct}%"></div>
        <div class="vote-option__content">
          <span>${esc(text)}</span>
          <span class="vote-option__pct">${pct}%</span>
        </div>
      </div>`;
  }).join('');
}

export function renderLegacyBattleVs(post) {
  if (!post.options?.length) return '';
  if (post.options.length !== 2) return `<div id="vote-area" class="quiz-options" style="margin-top:16px">${renderLegacyVoteOptions(post)}</div>`;
  const norm = option => typeof option === 'object' ? option : { text: option, votes: 0 };
  const sides = post.options.map(option => {
    const n = norm(option);
    return { text: n.text, votes: n.votes || 0 };
  });
  const total = sides.reduce((sum, option) => sum + option.votes, 0);
  sides.forEach(side => { side.pct = total ? Math.round(side.votes / total * 100) : 0; });
  return `
    <div class="battle-vs-area" id="vote-area">
      <button class="battle-side" data-vote-idx="0">
        <div class="battle-side__text">${esc(sides[0].text)}</div>
        <div class="battle-side__pct">${sides[0].pct}%</div>
        <div class="battle-side__votes">${sides[0].votes}표</div>
      </button>
      <div class="battle-vs-center"><span>⚔️</span><span class="battle-vs-label">VS</span></div>
      <button class="battle-side battle-side--b" data-vote-idx="1">
        <div class="battle-side__text">${esc(sides[1].text)}</div>
        <div class="battle-side__pct">${sides[1].pct}%</div>
        <div class="battle-side__votes">${sides[1].votes}표</div>
      </button>
    </div>`;
}

export async function voteLegacyPost(postId, idx) {
  if (!(await ensureAnonymousActor())) return null;
  const postRef = doc(db, 'feeds', postId);
  const snapshot = await getDoc(postRef);
  const data = snapshot.data() || {};
  if ((data.votedBy || []).includes(auth.currentUser.uid)) throw new Error('이미 투표했어요');
  const options = (data.options || []).map((opt, i) => (
    i === idx ? { ...opt, votes: (opt.votes || 0) + 1 } : opt
  ));
  await updateDoc(postRef, { options, votedBy: arrayUnion(auth.currentUser.uid) });
  return { ...data, id: postId, options };
}

export function showVoteToast(options, idx) {
  const myVotes = options?.[idx]?.votes || 1;
  const totalNew = (options || []).reduce((sum, option) => sum + (option.votes || 0), 0);
  const pct = totalNew ? Math.round(myVotes / totalNew * 100) : 100;
  const msg = pct <= 30 ? `소수파 ${pct}%! 독특한 취향이네요 😎`
    : pct >= 70 ? `역시 대세! ${pct}%가 같은 생각이에요 👑`
      : `팽팽해요! 지금 ${pct}% 선택 중 🔥`;
  toast.success(msg);
}
