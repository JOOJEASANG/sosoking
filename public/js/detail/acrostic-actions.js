import { auth, db } from '../firebase.js';
import { navigate } from '../router.js';
import { doc, updateDoc, increment, deleteField } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export function adjustAcrosticCount(btn, delta) {
  if (!btn) return;
  const strong = btn.querySelector('strong');
  if (strong) {
    const next = Math.max(0, parseInt(strong.textContent || '0', 10) + delta);
    if (next === 0) strong.remove();
    else strong.textContent = next;
  } else if (delta > 0) {
    btn.insertAdjacentHTML('beforeend', ` <strong>1</strong>`);
  }
}

export async function toggleAcrosticReaction(postId, acrosticId, key, currentKey) {
  const uid = auth.currentUser.uid;
  const ref = doc(db, 'feeds', postId, 'acrostics', acrosticId);

  if (currentKey === key) {
    await updateDoc(ref, {
      [`reactions.${key}`]: increment(-1),
      [`reactedWith.${uid}`]: deleteField(),
    });
    return 'removed';
  }

  if (currentKey) {
    await updateDoc(ref, {
      [`reactions.${currentKey}`]: increment(-1),
      [`reactions.${key}`]: increment(1),
      [`reactedWith.${uid}`]: key,
    });
    return 'switched';
  }

  await updateDoc(ref, {
    [`reactions.${key}`]: increment(1),
    [`reactedWith.${uid}`]: key,
  });
  return 'added';
}

export function bindAcrosticLikes(postId, root = document) {
  root.querySelectorAll('[data-acrostic-reaction]').forEach(btn => {
    if (btn.dataset.acrosticReady === '1') return;
    btn.dataset.acrosticReady = '1';
    btn.addEventListener('click', async () => {
      if (!auth.currentUser) {
        navigate('/login');
        return;
      }
      if (btn._pending) return;

      const key = btn.dataset.acrosticReaction;
      const acrosticId = btn.dataset.acrosticId;
      const card = btn.closest('[data-acrostic-id]');
      const activeBtn = card?.querySelector('[data-acrostic-reaction].active');
      const currentKey = activeBtn?.dataset.acrosticReaction ?? null;

      btn._pending = true;
      try {
        if (currentKey === key) {
          btn.classList.remove('active');
          adjustAcrosticCount(btn, -1);
        } else if (currentKey) {
          activeBtn.classList.remove('active');
          adjustAcrosticCount(activeBtn, -1);
          btn.classList.add('active');
          adjustAcrosticCount(btn, 1);
        } else {
          btn.classList.add('active');
          adjustAcrosticCount(btn, 1);
        }
        await toggleAcrosticReaction(postId, acrosticId, key, currentKey);
      } catch {
        // UI is optimistic; detailed failure is non-critical.
      }
      btn._pending = false;
    });
  });
}
