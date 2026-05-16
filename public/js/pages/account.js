import { auth, db, signOut } from '../firebase.js';
import {
  collection, query, where, orderBy, limit, getDocs, getCountFromServer,
  doc, getDoc, updateDoc, writeBatch, deleteDoc, serverTimestamp, setDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  updateProfile, deleteUser, EmailAuthProvider, reauthenticateWithCredential,
  GoogleAuthProvider, reauthenticateWithPopup,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { navigate } from '../router.js';
import { toast } from '../components/toast.js';
import { escHtml, formatTime, computeTitle } from '../utils/helpers.js';
import { renderFeedCard } from '../components/feed-card.js';
import { appState } from '../state.js';
import { setMeta } from '../utils/seo.js';

export async function renderAccount() {
  setMeta('내 계정');
  const el   = document.getElementById('page-content');
  const user = appState.user;

  if (!user) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">👤</div>
        <div class="empty-state__title">로그인이 필요해요</div>
        <button class="btn btn--primary" style="margin-top:16px" onclick="navigate('/login')">로그인하기</button>
      </div>`;
    return;
  }

  el.innerHTML = `<div class="loading-center"><div class="spinner spinner--lg"></div></div>`;

  const [{ count: postCount, posts: myPosts }, userSnap] = await Promise.all([
    fetchMyPosts(user.uid),
    getDoc(doc(db, 'users', user.uid)).catch(() => null),
  ]);

  const userData = userSnap?.exists() ? userSnap.data() : {};
  const title    = computeTitle(postCount);
  const streak   = appState.streak || userData.streak || 0;
  const nickname = user.displayName || user.email?.split('@')[0] || '익명';

  if (userSnap?.exists()) {
    updateDoc(doc(db, 'users', user.uid), { title }).catch(() => {});
    appState.userTitle = title;
  }

  const activeTab = new URLSearchParams(window.location.hash.split('?')[1] || '').get('tab') || 'posts';

  el.innerHTML = `
    <div style="max-width:720px;margin:0 auto">
      <div class="card" style="margin-bottom:16px">
        <div class="account-header">
          <div class="avatar" style="width:72px;height:72px;font-size:24px;font-weight:800">
            ${user.photoURL
              ? `<img src="${user.photoURL}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
              : (nickname[0] || '나')}
          </div>
          <div class="account-nickname">${escHtml(nickname)}</div>
          <div class="account-level">
            <span class="title-badge">${title}</span>
            ${streak > 0 ? `<span class="streak-pill" style="margin-left:6px">🔥 ${streak}일 연속</span>` : ''}
          </div>
          <div class="account-stats">
            <div class="account-stat">
              <div class="account-stat__num">${postCount}</div>
              <div class="account-stat__label">작성한 글</div>
            </div>
            <div class="account-stat">
              <div class="account-stat__num">${appState.unreadNotifications || 0}</div>
              <div class="account-stat__label">새 알림</div>
            </div>
          </div>
        </div>
        <div class="card__footer" style="display:flex;gap:8px">
          ${appState.isAdmin ? `<button class="btn btn--primary btn--sm" onclick="navigate('/admin')">⚙️ 관리자 페이지</button>` : ''}
          <button class="btn btn--ghost btn--sm" id="btn-logout">로그아웃</button>
        </div>
      </div>

      <div class="account-tabs">
        <button class="account-tab ${activeTab === 'posts' ? 'active' : ''}" data-tab="posts">📝 내 글 (${postCount})</button>
        <button class="account-tab ${activeTab === 'scraps' ? 'active' : ''}" data-tab="scraps">🔖 스크랩</button>
        <button class="account-tab ${activeTab === 'stats' ? 'active' : ''}" data-tab="stats">📊 통계</button>
        <button class="account-tab ${activeTab === 'follows' ? 'active' : ''}" data-tab="follows">👥 팔로우</button>
        <button class="account-tab ${activeTab === 'notifications' ? 'active' : ''}" data-tab="notifications">
          🔔 알림${appState.unreadNotifications > 0 ? ` <span class="notif-badge-sm">${appState.unreadNotifications}</span>` : ''}
        </button>
        <button class="account-tab ${activeTab === 'settings' ? 'active' : ''}" data-tab="settings">⚙️ 설정</button>
      </div>
      <div id="account-tab-content"></div>
    </div>`;

  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await signOut(auth);
    toast.success('로그아웃됐어요');
    navigate('/');
  });

  const renderTab = async (tab) => {
    const content = document.getElementById('account-tab-content');
    if (!content) return;
    content.innerHTML = `<div class="loading-center"><div class="spinner"></div></div>`;

    if (tab === 'posts') {
      content.innerHTML = myPosts.length
        ? myPosts.map(p => renderFeedCard(p)).join('')
        : `<div class="empty-state"><div class="empty-state__icon">✏️</div>
           <div class="empty-state__title">아직 쓴 글이 없어요</div>
           <button class="btn btn--primary" style="margin-top:16px" onclick="navigate('/write')">첫 글 쓰기</button></div>`;

    } else if (tab === 'scraps') {
      const scrapSnap = await getDocs(
        query(collection(db, 'users', user.uid, 'scraps'), orderBy('scrappedAt', 'desc'))
      ).catch(() => null);
      const ids = scrapSnap?.docs.map(d => d.id) || [];
      const posts = ids.length
        ? (await Promise.all(ids.map(id => getDoc(doc(db, 'feeds', id)))))
            .filter(s => s.exists()).map(s => ({ id: s.id, ...s.data() })).filter(p => !p.hidden)
        : [];
      content.innerHTML = posts.length
        ? posts.map(p => renderFeedCard(p)).join('')
        : `<div class="empty-state"><div class="empty-state__icon">🔖</div>
           <div class="empty-state__title">스크랩한 글이 없어요</div>
           <div class="empty-state__desc">마음에 드는 글에 🔖를 눌러보세요!</div></div>`;

    } else if (tab === 'notifications') {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(50),
      );
      const notifSnap = await getDocs(q).catch(() => null);
      const notifs = notifSnap?.docs.map(d => ({ id: d.id, ...d.data() })) || [];

      const unread = notifSnap?.docs.filter(d => !d.data().read) || [];
      if (unread.length) {
        const batch = writeBatch(db);
        unread.forEach(d => batch.update(d.ref, { read: true }));
        batch.commit().then(() => { appState.unreadNotifications = 0; }).catch(() => {});
      }

      content.innerHTML = notifs.length
        ? `<div class="notif-list">${notifs.map(n => renderNotifItem(n)).join('')}</div>`
        : `<div class="empty-state"><div class="empty-state__icon">🔔</div>
           <div class="empty-state__title">새 알림이 없어요</div></div>`;

    } else if (tab === 'stats') {
      await renderStatsTab(content, user.uid);

    } else if (tab === 'follows') {
      await renderFollowsTab(content, user.uid);

    } else if (tab === 'settings') {
      renderSettingsTab(content, user, userData, nickname);
    }
  };

  document.querySelectorAll('.account-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.account-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTab(btn.dataset.tab);
    });
  });

  renderTab(activeTab);
}

/* ── 설정 탭 ── */
function renderSettingsTab(content, user, userData, nickname) {
  const isGoogle = user.providerData?.some(p => p.providerId === 'google.com');

  content.innerHTML = `
    <div class="card" style="margin-bottom:12px">
      <div class="card__body--lg">
        <div class="section-title" style="font-size:15px;margin-bottom:16px">👤 닉네임 변경</div>
        <div class="form-group">
          <label class="form-label">새 닉네임 <span class="required">*</span></label>
          <input id="new-nickname" class="form-input" type="text"
            value="${escHtml(nickname)}"
            placeholder="2~12자, 한글/영문/숫자/_"
            maxlength="12">
          <div class="form-hint">2~12자, 한글·영문·숫자·_(밑줄)만 사용 가능해요</div>
          <div id="nickname-feedback" style="font-size:12px;margin-top:6px;min-height:18px"></div>
        </div>
        <button class="btn btn--primary btn--sm" id="btn-save-nickname">저장하기</button>
      </div>
    </div>

    <div class="card" style="margin-bottom:12px">
      <div class="card__body--lg">
        <div class="section-title" style="font-size:15px;margin-bottom:8px">🔐 계정 정보</div>
        <div style="font-size:13px;color:var(--color-text-secondary);margin-bottom:4px">
          이메일: <strong>${escHtml(user.email || '—')}</strong>
        </div>
        <div style="font-size:13px;color:var(--color-text-secondary)">
          로그인 방식: <strong>${isGoogle ? '구글 소셜 로그인' : '이메일/비밀번호'}</strong>
        </div>
      </div>
    </div>

    <div class="card" style="border-color:var(--color-danger);opacity:0.9">
      <div class="card__body--lg">
        <div class="section-title" style="font-size:15px;color:var(--color-danger);margin-bottom:8px">⚠️ 회원 탈퇴</div>
        <p style="font-size:13px;color:var(--color-text-secondary);margin-bottom:16px;line-height:1.6">
          탈퇴 시 계정이 삭제되며 <strong>복구할 수 없어요.</strong><br>
          작성한 글·댓글은 즉시 삭제되지 않을 수 있어요.
        </p>
        <button class="btn btn--danger btn--sm" id="btn-withdraw">회원 탈퇴</button>
      </div>
    </div>`;

  setupNicknameEdit(user, nickname);
  setupWithdrawal(user, isGoogle);
}

function setupNicknameEdit(user, currentNickname) {
  const input    = document.getElementById('new-nickname');
  const feedback = document.getElementById('nickname-feedback');
  const saveBtn  = document.getElementById('btn-save-nickname');

  const NICK_RE = /^[가-힣a-zA-Z0-9_]{2,12}$/;

  input?.addEventListener('input', () => {
    const v = input.value.trim();
    if (!v) { feedback.textContent = ''; return; }
    if (!NICK_RE.test(v)) {
      feedback.style.color = 'var(--color-danger)';
      feedback.textContent = '2~12자, 한글·영문·숫자·_ 만 가능해요';
    } else {
      feedback.style.color = 'var(--color-success)';
      feedback.textContent = '사용 가능한 형식이에요';
    }
  });

  saveBtn?.addEventListener('click', async () => {
    const newNick = input?.value.trim();
    if (!newNick) { toast.error('닉네임을 입력해주세요'); return; }
    if (!NICK_RE.test(newNick)) { toast.error('닉네임 형식이 맞지 않아요'); return; }
    if (newNick === currentNickname) { toast.info('현재 닉네임과 같아요'); return; }

    saveBtn.disabled = true;
    saveBtn.textContent = '저장 중...';
    try {
      // 닉네임 중복 확인
      const nickDoc = await getDoc(doc(db, 'nicknames', newNick));
      if (nickDoc.exists() && nickDoc.data().uid !== user.uid) {
        toast.error('이미 사용 중인 닉네임이에요');
        return;
      }

      const batch = writeBatch(db);
      // 새 닉네임 등록
      batch.set(doc(db, 'nicknames', newNick), { uid: user.uid, createdAt: serverTimestamp() });
      // 기존 닉네임 삭제 (있을 경우)
      if (currentNickname && currentNickname !== newNick) {
        batch.delete(doc(db, 'nicknames', currentNickname));
      }
      // users 문서 업데이트
      batch.update(doc(db, 'users', user.uid), { nickname: newNick, updatedAt: serverTimestamp() });
      await batch.commit();

      // Firebase Auth displayName 업데이트
      await updateProfile(user, { displayName: newNick });

      feedback.style.color = 'var(--color-success)';
      feedback.textContent = '저장됐어요!';
      toast.success('닉네임이 변경됐어요');
    } catch (e) {
      console.error(e);
      toast.error('저장에 실패했어요. 다시 시도해주세요');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '저장하기';
    }
  });
}

function setupWithdrawal(user, isGoogle) {
  document.getElementById('btn-withdraw')?.addEventListener('click', async () => {
    const confirmed = window.confirm(
      '정말 탈퇴하시겠어요?\n\n계정이 삭제되며 복구할 수 없어요.'
    );
    if (!confirmed) return;

    try {
      // 재인증 필요 (Firebase 보안 정책)
      if (isGoogle) {
        const provider = new GoogleAuthProvider();
        await reauthenticateWithPopup(user, provider);
      } else {
        const password = window.prompt('보안을 위해 비밀번호를 입력해주세요:');
        if (!password) return;
        const credential = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(user, credential);
      }

      // Firestore 사용자 데이터 삭제
      await Promise.allSettled([
        deleteDoc(doc(db, 'users', user.uid)),
        deleteDoc(doc(db, 'nicknames', user.displayName || '')),
      ]);

      await deleteUser(user);
      toast.success('탈퇴가 완료됐어요. 이용해주셔서 감사합니다');
      navigate('/');
    } catch (e) {
      if (e.code === 'auth/wrong-password') {
        toast.error('비밀번호가 틀렸어요');
      } else if (e.code === 'auth/popup-closed-by-user') {
        // 사용자가 취소
      } else {
        console.error(e);
        toast.error('탈퇴 처리 중 오류가 발생했어요');
      }
    }
  });
}

function renderNotifItem(n) {
  const timeStr = formatTime(n.createdAt?.toDate?.() || n.createdAt);
  const icon = n.type === 'comment' ? '💬' : '❤️';
  return `
    <div class="notif-item ${n.read ? '' : 'notif-item--unread'}" onclick="navigate('/detail/${n.postId}')">
      <span class="notif-item__icon">${icon}</span>
      <div class="notif-item__body">
        <div class="notif-item__text">
          <strong>${escHtml(n.actorName || '익명')}</strong>님이
          <strong>${escHtml(n.postTitle || '내 글')}</strong>에 ${n.type === 'comment' ? '댓글을 달았어요' : '반응했어요'}
        </div>
        <div class="notif-item__time">${timeStr}</div>
      </div>
    </div>`;
}

/* ── 통계 탭 ── */
async function renderStatsTab(content, uid) {
  try {
    const postsSnap = await getDocs(
      query(collection(db, 'feeds'), where('authorId', '==', uid), orderBy('createdAt', 'desc'), limit(100))
    );
    const posts = postsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const catCounts = { golra: 0, usgyo: 0, malhe: 0 };
    let totalReactions = 0, totalComments = 0, bestPost = null, bestScore = -1;
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    let weekPosts = 0;

    for (const p of posts) {
      catCounts[p.cat] = (catCounts[p.cat] || 0) + 1;
      totalReactions += p.reactions?.total || 0;
      totalComments += p.commentCount || 0;
      const score = (p.reactions?.total || 0) * 2 + (p.commentCount || 0) * 3;
      if (score > bestScore) { bestScore = score; bestPost = p; }
      const d = p.createdAt?.toDate?.();
      if (d && d >= weekAgo) weekPosts++;
    }

    const catMeta = [
      { key: 'golra', label: '🎯 골라봐', color: 'var(--color-golra)' },
      { key: 'usgyo', label: '😂 웃겨봐', color: 'var(--color-usgyo)' },
      { key: 'malhe', label: '🎮 도전봐', color: 'var(--color-malhe)' },
    ];
    const total = posts.length || 1;

    content.innerHTML = `
      <div class="stats-page">
        <div class="stats-grid">
          <div class="stats-card">
            <div class="stats-card__num">${posts.length}</div>
            <div class="stats-card__label">총 게시물</div>
          </div>
          <div class="stats-card">
            <div class="stats-card__num" style="color:var(--color-primary)">${totalReactions}</div>
            <div class="stats-card__label">받은 반응</div>
          </div>
          <div class="stats-card">
            <div class="stats-card__num" style="color:var(--color-malhe)">${totalComments}</div>
            <div class="stats-card__label">달린 댓글</div>
          </div>
          <div class="stats-card">
            <div class="stats-card__num" style="color:var(--color-success)">${weekPosts}</div>
            <div class="stats-card__label">이번 주 활동</div>
          </div>
        </div>

        <div class="card" style="margin-top:16px">
          <div class="card__body">
            <div style="font-size:14px;font-weight:800;margin-bottom:14px">📂 카테고리별 활동</div>
            ${catMeta.map(c => `
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
                <div style="width:72px;font-size:12px;font-weight:700">${c.label}</div>
                <div style="flex:1;background:var(--color-surface-2);border-radius:4px;height:10px;overflow:hidden">
                  <div style="height:100%;background:${c.color};width:${Math.round((catCounts[c.key]||0)/total*100)}%;transition:width 0.5s"></div>
                </div>
                <div style="width:40px;text-align:right;font-size:12px;font-weight:700;color:${c.color}">${catCounts[c.key]||0}개</div>
              </div>`).join('')}
          </div>
        </div>

        ${bestPost ? `
          <div class="card" style="margin-top:12px;border:1.5px solid var(--color-primary)">
            <div class="card__body">
              <div style="font-size:13px;font-weight:800;margin-bottom:8px;color:var(--color-primary)">🏆 내 최고 인기 글</div>
              <div style="font-size:15px;font-weight:700;margin-bottom:6px;cursor:pointer;color:var(--color-text-primary)" onclick="navigate('/detail/${bestPost.id}')">
                ${escHtml(bestPost.title || '제목 없음')}
              </div>
              <div style="font-size:12px;color:var(--color-text-muted)">
                ❤️ 반응 ${bestPost.reactions?.total || 0}개 &nbsp;·&nbsp; 💬 댓글 ${bestPost.commentCount || 0}개
              </div>
            </div>
          </div>` : ''}
      </div>`;
  } catch {
    content.innerHTML = `<div class="empty-state"><div class="empty-state__icon">📊</div><div class="empty-state__title">통계를 불러올 수 없어요</div></div>`;
  }
}

/* ── 팔로우 탭 ── */
async function renderFollowsTab(content, uid) {
  const [followingSnap, followersSnap] = await Promise.all([
    getDocs(query(collection(db, 'follows'), where('followerId', '==', uid), orderBy('createdAt', 'desc'), limit(50))).catch(() => null),
    getDocs(query(collection(db, 'follows'), where('followedId', '==', uid), orderBy('createdAt', 'desc'), limit(50))).catch(() => null),
  ]);

  const following = followingSnap?.docs.map(d => ({ id: d.id, ...d.data() })) || [];
  const followers = followersSnap?.docs.map(d => ({ id: d.id, ...d.data() })) || [];

  const renderList = (list, isFollowing) => list.length
    ? list.map(f => `
        <div class="follow-item">
          <div class="follow-item__avatar">${(isFollowing ? f.followedName : f.followerName)?.[0] || '?'}</div>
          <div class="follow-item__name">${escHtml(isFollowing ? f.followedName : f.followerName || '알 수 없음')}</div>
          ${isFollowing ? `<button class="btn btn--ghost btn--sm follow-unfollow-btn" data-follow-id="${f.id}" data-followed-id="${f.followedId}">언팔로우</button>` : ''}
        </div>`).join('')
    : `<div style="padding:24px;text-align:center;font-size:13px;color:var(--color-text-muted)">${isFollowing ? '팔로우하는 사람이 없어요' : '팔로워가 없어요'}</div>`;

  content.innerHTML = `
    <div class="follows-page">
      <div class="follows-section">
        <div class="follows-section__title">팔로잉 <span class="follows-count">${following.length}</span></div>
        <div class="follows-list">${renderList(following, true)}</div>
      </div>
      <div class="follows-section">
        <div class="follows-section__title">팔로워 <span class="follows-count">${followers.length}</span></div>
        <div class="follows-list">${renderList(followers, false)}</div>
      </div>
    </div>`;

  content.querySelectorAll('.follow-unfollow-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await deleteDoc(doc(db, 'follows', btn.dataset.followId));
        btn.closest('.follow-item')?.remove();
        toast.success('언팔로우했어요');
      } catch { toast.error('잠시 후 다시 시도해주세요'); }
    });
  });
}

export async function followUser(targetUid, targetName) {
  const { auth: fbAuth, db: fbDb } = await import('../firebase.js');
  const user = fbAuth.currentUser;
  if (!user) { toast.error('로그인이 필요해요'); return; }
  if (user.uid === targetUid) { toast.error('자신은 팔로우할 수 없어요'); return; }
  const followId = `${user.uid}_${targetUid}`;
  try {
    await setDoc(doc(db, 'follows', followId), {
      followerId: user.uid,
      followerName: user.displayName || '익명',
      followedId: targetUid,
      followedName: targetName || '익명',
      createdAt: serverTimestamp(),
    });
    toast.success(`${targetName}님을 팔로우했어요 👋`);
  } catch { toast.error('팔로우에 실패했어요'); }
}

async function fetchMyPosts(uid) {
  try {
    const base = query(collection(db, 'feeds'), where('authorId', '==', uid));
    const [countSnap, postsSnap] = await Promise.all([
      getCountFromServer(base),
      getDocs(query(base, orderBy('createdAt', 'desc'), limit(30))),
    ]);
    return {
      count: countSnap.data().count,
      posts: postsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    };
  } catch { return { count: 0, posts: [] }; }
}
