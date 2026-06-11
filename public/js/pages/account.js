import { auth, db, signOut, functions } from '../firebase.js';
import {
  collection, query, where, orderBy, limit, getDocs, getCountFromServer,
  doc, getDoc, updateDoc, writeBatch, deleteDoc, serverTimestamp, setDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
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
import { renderSidebar } from '../components/sidebar.js';
import { renderBottomNav } from '../components/bottom-nav.js';
import { normalizeNicknameIcon } from '../utils/nickname-icon.js';

function renderAccountAvatar(user, nickname) {
  const icon = normalizeNicknameIcon(appState.nicknameIcon);
  if (icon?.type === 'image') {
    return `<img class="account-avatar__img" src="${escHtml(icon.url)}" alt="" aria-hidden="true">`;
  }
  if (icon?.type === 'emoji') {
    return `<span class="account-avatar__emoji" aria-hidden="true">${escHtml(icon.value)}</span>`;
  }
  if (user.photoURL) {
    return `<img class="account-avatar__img" src="${escHtml(user.photoURL)}" alt="" aria-hidden="true">`;
  }
  return escHtml((nickname || '나')[0]);
}

function tabButton(activeTab, key, icon, label, extra = '') {
  const active = activeTab === key;
  return `
    <button class="account-tab ${active ? 'active' : ''}" data-tab="${key}" aria-label="${label}" title="${label}">
      <span class="account-tab__icon">${icon}</span>
      <span class="account-tab__label">${label}</span>
      ${extra}
    </button>`;
}

export async function renderAccount() {
  setMeta('내 정보');
  const el   = document.getElementById('page-content');
  const user = appState.user;

  if (!user) {
    if (appState.loading) {
      el.innerHTML = `<div class="loading-center"><div class="spinner spinner--lg"></div></div>`;
      return;
    }
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">👤</div>
        <div class="empty-state__title">로그인이 필요해요</div>
        <button class="btn btn--primary" style="margin-top:16px" onclick="navigate('/login?return=/account')">로그인하기</button>
      </div>`;
    return;
  }

  el.innerHTML = `<div class="loading-center"><div class="spinner spinner--lg"></div></div>`;

  const [{ count: postCount, posts: myPosts }, userSnap, adminSnap] = await Promise.all([
    fetchMyPosts(user.uid),
    getDoc(doc(db, 'users', user.uid)).catch(() => null),
    getDoc(doc(db, 'admins', user.uid)).catch(() => null),
  ]);

  const isAdmin = adminSnap?.exists() === true;

  const userData = userSnap?.exists() ? userSnap.data() : {};
  const title    = computeTitle(postCount);
  const streak   = appState.streak || userData.streak || 0;
  const nickname = appState.nickname || user.displayName || user.email?.split('@')[0] || '익명';

  if (userSnap?.exists()) {
    updateDoc(doc(db, 'users', user.uid), { title }).catch(() => {});
    appState.userTitle = title;
  }

  const activeTab = new URLSearchParams(window.location.hash.split('?')[1] || '').get('tab') || 'posts';

  el.innerHTML = `
    <div class="account-page-wrap">
      <div class="card account-profile-card">
        <div class="account-header">
          <div class="avatar account-avatar ${normalizeNicknameIcon(appState.nicknameIcon) || user.photoURL ? 'avatar--nickname-icon' : ''}" style="width:72px;height:72px;font-size:24px;font-weight:800">
            ${renderAccountAvatar(user, nickname)}
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
        <div class="card__footer account-profile-actions">
          ${isAdmin ? `<button class="btn btn--primary btn--sm" onclick="navigate('/admin')">⚙️ 관리자</button>` : ''}
          ${(!window.matchMedia('(display-mode: standalone)').matches && !navigator.standalone) && (appState.installPrompt || /iPhone|iPad|iPod/.test(navigator.userAgent)) ? `<button class="btn btn--ghost btn--sm" id="btn-pwa-install">📲 앱 설치</button>` : ''}
          <button class="btn btn--ghost btn--sm" id="btn-logout">로그아웃</button>
        </div>
      </div>

      <div class="account-tabs" aria-label="내 정보 메뉴">
        ${tabButton(activeTab, 'posts', '📝', `내 글 ${postCount ? postCount : ''}`)}
        ${tabButton(activeTab, 'scraps', '🔖', '스크랩')}
        ${tabButton(activeTab, 'party', '🏛️', '정당')}
        ${tabButton(activeTab, 'stats', '📊', '통계')}
        ${tabButton(activeTab, 'follows', '👥', '팔로우')}
        ${tabButton(activeTab, 'notifications', '🔔', '알림', appState.unreadNotifications > 0 ? `<span class="notif-badge-sm account-tab__badge">${appState.unreadNotifications}</span>` : '')}
        ${tabButton(activeTab, 'settings', '⚙️', '설정')}
      </div>
      <div id="account-tab-content"></div>
    </div>`;

  document.getElementById('btn-pwa-install')?.addEventListener('click', async () => {
    const prompt = appState.installPrompt;
    if (prompt) {
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') {
        appState.installPrompt = null;
        document.getElementById('btn-pwa-install')?.remove();
      }
    } else {
      alert('Safari 하단 공유 버튼(⬆)을 탭한 뒤 "홈 화면에 추가"를 선택하세요.');
    }
  });

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
           <div class="empty-state__title">아직 올린 글이 없어요</div>
           <div class="empty-state__desc">피드에 첫 글을 올려보세요.</div>
           <button class="btn btn--primary" style="margin-top:16px" onclick="navigate('/write')">+ 글쓰기</button></div>`;

    } else if (tab === 'scraps') {
      const scrapSnap = await getDocs(
        query(collection(db, 'users', user.uid, 'scraps'), orderBy('scrappedAt', 'desc'))
      ).catch(() => null);
      const ids = scrapSnap?.docs.map(d => d.id) || [];
      const posts = ids.length
        ? (await Promise.all(ids.map(id => getDoc(doc(db, 'feeds', id)))))
            .filter(s => s.exists()).map(s => ({ id: s.id, ...s.data() })).filter(p => !p.hidden)
        : [];

      const wrapScrap = (post) => `
        <div class="scrap-item" id="acct-scrap-${post.id}">
          <button class="scrap-delete-btn" onclick="window.__acctScrapDelete('${post.id}')" title="스크랩 삭제">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            삭제
          </button>
          ${renderFeedCard(post)}
        </div>`;

      content.innerHTML = posts.length
        ? `<div style="display:flex;justify-content:flex-end;margin-bottom:8px">
             <button class="btn btn--ghost btn--sm" id="btn-acct-scrap-all" style="color:var(--color-danger)">전체 삭제</button>
           </div>
           ${posts.map(p => wrapScrap(p)).join('')}`
        : `<div class="empty-state"><div class="empty-state__icon">🔖</div>
           <div class="empty-state__title">아직 스크랩한 글이 없어요</div>
           <div class="empty-state__desc">재밌는 글 발견하면 🔖 꾹 눌러두세요!</div></div>`;

      window.__acctScrapDelete = async (postId) => {
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'scraps', postId));
          document.getElementById(`acct-scrap-${postId}`)?.remove();
          if (!document.querySelectorAll('.scrap-item').length) {
            content.innerHTML = `<div class="empty-state"><div class="empty-state__icon">🔖</div>
              <div class="empty-state__title">스크랩이 모두 비워졌어요</div></div>`;
          }
          toast.success('스크랩을 삭제했어요');
        } catch { toast.error('삭제에 실패했어요'); }
      };

      document.getElementById('btn-acct-scrap-all')?.addEventListener('click', async () => {
        if (!confirm('스크랩한 글을 전부 삭제할까요?')) return;
        try {
          const allSnap = await getDocs(collection(db, 'users', user.uid, 'scraps'));
          if (!allSnap.empty) {
            const batch = writeBatch(db);
            allSnap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
          }
          content.innerHTML = `<div class="empty-state"><div class="empty-state__icon">🔖</div>
            <div class="empty-state__title">스크랩한 글이 없어요</div></div>`;
          toast.success('전체 스크랩을 삭제했어요');
        } catch { toast.error('삭제에 실패했어요'); }
      });

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
        batch.commit().then(() => { appState.unreadNotifications = 0; renderSidebar(); renderBottomNav(); }).catch(() => {});
      }

      content.innerHTML = notifs.length
        ? `<div class="notif-list">${notifs.map(n => renderNotifItem(n)).join('')}</div>`
        : `<div class="empty-state"><div class="empty-state__icon">🔔</div>
           <div class="empty-state__title">아직 알림이 없어요</div>
           <div class="empty-state__desc">글을 올리면 반응이 오기 시작해요.</div></div>`;

    } else if (tab === 'party') {
      await renderPartyTab(content, user.uid);

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
      const tab = btn.dataset.tab;
      const nextHash = `#/account?tab=${tab}`;
      if (window.location.hash !== nextHash) history.replaceState(null, '', nextHash);
      renderTab(tab);
    });
  });

  renderTab(activeTab);
}

/* ── 설정 탭 ── */
function renderSettingsTab(content, user, userData, nickname) {
  const isGoogle = user.providerData?.some(p => p.providerId === 'google.com');
  const isEmail  = user.providerData?.some(p => p.providerId === 'password');
  const isKakao  = !isGoogle && !isEmail;
  // 카카오 커스텀 토큰 사용자는 Firebase Auth에 email이 없어 Firestore에서 보완
  const displayEmail = user.email || userData?.email || '';

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
          이메일: <strong>${escHtml(displayEmail || '—')}</strong>
        </div>
        <div style="font-size:13px;color:var(--color-text-secondary)">
          로그인 방식: <strong>${isGoogle ? '구글 소셜 로그인' : isKakao ? '카카오 소셜 로그인' : '이메일/비밀번호'}</strong>
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
  setupWithdrawal(user, isGoogle, isKakao, nickname);
}

function setupNicknameEdit(user, currentNickname) {
  const input    = document.getElementById('new-nickname');
  const feedback = document.getElementById('nickname-feedback');
  const saveBtn  = document.getElementById('btn-save-nickname');

  const NICK_RE = /^[가-힣a-zA-Z0-9_]{2,12}$/;

  let nickCheckTimer = null;
  input?.addEventListener('input', () => {
    const v = input.value.trim();
    feedback.textContent = '';
    clearTimeout(nickCheckTimer);
    if (!v) return;
    if (!NICK_RE.test(v)) {
      feedback.style.color = 'var(--color-danger)';
      feedback.textContent = '2~12자, 한글·영문·숫자·_ 만 가능해요';
      return;
    }
    if (v === currentNickname) {
      feedback.style.color = 'var(--color-text-muted)';
      feedback.textContent = '현재 닉네임이에요';
      return;
    }
    feedback.style.color = 'var(--color-text-muted)';
    feedback.textContent = '확인 중...';
    nickCheckTimer = setTimeout(async () => {
      try {
        const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const snap = await getDoc(doc(db, 'nicknames', v));
        if (input.value.trim() !== v) return; // 입력값 바뀌었으면 무시
        if (snap.exists() && snap.data()?.uid !== user.uid) {
          feedback.style.color = 'var(--color-danger)';
          feedback.textContent = '이미 사용 중인 닉네임이에요';
        } else {
          feedback.style.color = 'var(--color-success)';
          feedback.textContent = '사용 가능한 닉네임이에요 ✓';
        }
      } catch {
        feedback.style.color = 'var(--color-text-muted)';
        feedback.textContent = '올바른 형식이에요';
      }
    }, 500);
  });

  saveBtn?.addEventListener('click', async () => {
    const newNick = input?.value.trim();
    if (!newNick) { toast.error('닉네임을 입력해주세요'); return; }
    if (!NICK_RE.test(newNick)) { toast.error('닉네임 형식이 맞지 않아요'); return; }
    if (newNick === currentNickname) { toast.info('현재 닉네임과 같아요'); return; }

    saveBtn.disabled = true;
    saveBtn.textContent = '저장 중...';
    try {
      // 닉네임 변경은 서버 트랜잭션(updateNickname)으로 처리한다.
      // 클라이언트에서 users.nickname을 직접 수정하면 보안 규칙에 막힌다.
      const { getFunctions, httpsCallable } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js');
      const { getApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
      const fns = getFunctions(getApp(), 'asia-northeast3');
      await httpsCallable(fns, 'updateNickname')({ nickname: newNick });

      await updateProfile(user, { displayName: newNick }).catch(() => {});

      if (appState.user) appState.user.displayName = newNick;
      appState.nickname = newNick;
      renderSidebar();
      renderBottomNav();

      feedback.style.color = 'var(--color-success)';
      feedback.textContent = '저장됐어요!';
      toast.success('닉네임이 변경됐어요');
    } catch (e) {
      console.error(e);
      toast.error(e?.message || '저장에 실패했어요. 다시 시도해주세요');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '저장하기';
    }
  });
}

function setupWithdrawal(user, isGoogle, isKakao, nickname) {
  // 실제 탈퇴 처리는 account-secure-actions.js(capture 단계)가 가로챔.
  // 보안 모듈 미로드 시 fallback으로만 동작.
  document.getElementById('btn-withdraw')?.addEventListener('click', async () => {
    const confirmed = window.confirm('정말 탈퇴하시겠어요?\n\n계정이 삭제되며 복구할 수 없어요.');
    if (!confirmed) return;

    const btn = document.getElementById('btn-withdraw');
    if (btn) { btn.disabled = true; btn.textContent = '처리 중...'; }

    try {
      const { getFunctions, httpsCallable } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js');
      const { getApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
      const fns = getFunctions(getApp(), 'asia-northeast3');
      await httpsCallable(fns, 'deleteMyAccount')({});
      await signOut(auth).catch(() => {});
      toast.success('탈퇴가 완료됐어요. 이용해주셔서 감사합니다');
      navigate('/');
    } catch (e) {
      console.error('[탈퇴]', e);
      if (btn) { btn.disabled = false; btn.textContent = '회원 탈퇴'; }
      toast.error((e?.message || '탈퇴 처리 중 오류가 발생했어요') + (e?.code ? ` (${e.code})` : ''));
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

function getPostTypeBucket(p) {
  if (p.type === 'multi' || p.type === 'general') {
    if (p.preset) return p.preset;
    if (p.modules?.vote) return 'vote';
    if (p.modules?.naming) return 'naming';
    if (p.modules?.drip) return 'drip';
    if (p.modules?.quiz) return 'quiz';
    return 'general';
  }
  const t = p.type || 'general';
  if (t === 'vote' || t === 'balance' || t === 'judgment' || t === 'debate') return 'vote';
  if (t === 'naming') return 'naming';
  if (t === 'quiz') return 'quiz';
  if (t === 'drip' || t === 'cbattle') return 'drip';
  return 'general';
}

/* ── 통계 탭 ── */
async function renderStatsTab(content, uid) {
  try {
    const postsSnap = await getDocs(
      query(collection(db, 'feeds'), where('authorId', '==', uid), orderBy('createdAt', 'desc'), limit(100))
    );
    const posts = postsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.hidden);

    const typeCounts = { general: 0, vote: 0, naming: 0, drip: 0, quiz: 0 };
    let totalReactions = 0, totalComments = 0, bestPost = null, bestScore = -1;
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    let weekPosts = 0;

    for (const p of posts) {
      const bucket = getPostTypeBucket(p);
      typeCounts[bucket] = (typeCounts[bucket] || 0) + 1;
      totalReactions += p.reactions?.total || 0;
      totalComments += p.commentCount || 0;
      const score = (p.reactions?.total || 0) * 2 + (p.commentCount || 0) * 3;
      if (score > bestScore) { bestScore = score; bestPost = p; }
      const d = p.createdAt?.toDate?.();
      if (d && d >= weekAgo) weekPosts++;
    }

    const typeMeta = [
      { key: 'general', label: '📝 일반글', color: 'var(--color-primary)' },
      { key: 'vote', label: '🗳️ 투표·판정', color: 'var(--color-golra)' },
      { key: 'naming', label: '😜 작명소', color: 'var(--color-usgyo)' },
      { key: 'drip', label: '🤣 드립', color: '#FF9B21' },
      { key: 'quiz', label: '🧠 퀴즈', color: 'var(--color-success)' },
    ];
    const total = posts.length || 1;

    content.innerHTML = `
      <div class="stats-page">
        <div class="stats-grid">
          <div class="stats-card"><div class="stats-card__num">${posts.length}</div><div class="stats-card__label">총 게시물</div></div>
          <div class="stats-card"><div class="stats-card__num" style="color:var(--color-primary)">${totalReactions}</div><div class="stats-card__label">받은 반응</div></div>
          <div class="stats-card"><div class="stats-card__num" style="color:var(--color-malhe)">${totalComments}</div><div class="stats-card__label">달린 댓글</div></div>
          <div class="stats-card"><div class="stats-card__num" style="color:var(--color-success)">${weekPosts}</div><div class="stats-card__label">이번 주 활동</div></div>
        </div>

        <div class="card" style="margin-top:16px">
          <div class="card__body">
            <div style="font-size:14px;font-weight:800;margin-bottom:14px">📂 피드 활동</div>
            ${typeMeta.map(c => `
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
                <div style="width:92px;font-size:12px;font-weight:700">${c.label}</div>
                <div style="flex:1;background:var(--color-surface-2);border-radius:4px;height:10px;overflow:hidden">
                  <div style="height:100%;background:${c.color};width:${Math.round((typeCounts[c.key]||0)/total*100)}%;transition:width 0.5s"></div>
                </div>
                <div style="width:40px;text-align:right;font-size:12px;font-weight:700;color:${c.color}">${typeCounts[c.key]||0}개</div>
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
  const user = auth.currentUser;
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
    toast.success(`${targetName}님을 팔로우했어요`);
  } catch { toast.error('팔로우에 실패했어요'); }
}

const PARTY_COLORS_ACCT = {
  national: { emoji: '🎙️', name: '국민안정당', color: '#8B7355' },
  truth:    { emoji: '📺', name: '진실방송당', color: '#6C5CE7' },
  youth:    { emoji: '📱', name: '청년혁명당', color: '#E84393' },
  center:   { emoji: '📊', name: '중도민주당', color: '#00CEC9' },
  future:   { emoji: '🤝', name: '함께미래당', color: '#FDCB6E' },
  rights:   { emoji: '🔍', name: '알권리당',   color: '#00B894' },
  justice:  { emoji: '⚖️', name: '법치정의당', color: '#2D3436' },
};

function fmtPower(n) {
  n = Number(n || 0);
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '만';
  if (n >= 1000)  return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

async function renderPartyTab(content, uid) {
  content.innerHTML = `<div class="loading-center"><div class="spinner"></div></div>`;
  try {
    const call = httpsCallable(functions, 'getPoliticsOverview');
    const { data } = await call();
    const me = data?.me || null;
    const parties = data?.parties || [];
    const myParty = me?.partyId ? parties.find(p => p.id === me.partyId) : null;
    const partyMeta = me?.partyId ? PARTY_COLORS_ACCT[me.partyId] : null;

    const isLeader = myParty?.leader?.uid === uid;

    let rankHtml = '';
    if (myParty) {
      try {
        const callMembers = httpsCallable(functions, 'getPartyMembers');
        const { data: mbData } = await callMembers({ partyId: me.partyId });
        const members = mbData?.members || [];
        const myRank = members.findIndex(m => m.uid === uid || m.nickname === (appState.nickname)) + 1;
        if (myRank > 0) {
          rankHtml = `<span class="acct-party-rank">당내 ${myRank}위</span>`;
        }
      } catch {}
    }

    if (me?.partyId && partyMeta) {
      content.innerHTML = `
        <div class="acct-party-card" style="--party-c:${partyMeta.color}">
          <div class="acct-party-card__top">
            <span class="acct-party-card__emoji">${partyMeta.emoji}</span>
            <div class="acct-party-card__info">
              <div class="acct-party-card__name">
                ${isLeader ? '<span class="acct-party-leader-crown">👑 당대표</span>' : ''}
                ${escHtml(partyMeta.name)}
              </div>
              <div class="acct-party-card__power">정치력 ${fmtPower(me.power)}P ${rankHtml}</div>
            </div>
          </div>
          ${myParty ? `<div class="acct-party-card__stats">
            <span>👥 당원 ${myParty.memberCount}명</span>
            <span>⚡ 당 총 정치력 ${fmtPower(myParty.totalPower)}</span>
            <span>📊 전체 ${myParty.rank}위 정당</span>
          </div>` : ''}
          <div class="acct-party-card__actions">
            <button class="btn btn--primary btn--sm" onclick="navigate('/parties')">정당 페이지 →</button>
            <button class="btn btn--ghost btn--sm" onclick="navigate('/ranking')">랭킹 보기</button>
          </div>
        </div>

        <div class="acct-party-tip">
          <b>정치력</b>을 쌓으면 당내 순위가 올라가고, 1위가 되면 <b>당대표</b>가 됩니다.<br>
          당대표는 매주 대통령 선거에 자동 출마합니다!
        </div>

        <div style="margin-top:16px">
          <div class="section-title" style="font-size:14px;margin-bottom:10px">📊 전체 정당 순위</div>
          <div class="acct-party-standings">
            ${parties.map((p, i) => `
              <div class="acct-party-row${p.id === me.partyId ? ' acct-party-row--mine' : ''}" style="--party-c:${PARTY_COLORS_ACCT[p.id]?.color || '#ccc'}">
                <span class="acct-party-row__rank">${i + 1}</span>
                <span class="acct-party-row__emoji">${p.emoji}</span>
                <span class="acct-party-row__name">${escHtml(p.name)}</span>
                <span class="acct-party-row__power">${fmtPower(p.totalPower)}P</span>
              </div>`).join('')}
          </div>
        </div>`;
    } else {
      content.innerHTML = `
        <div class="acct-party-empty">
          <div class="acct-party-empty__icon">🏛️</div>
          <div class="acct-party-empty__title">아직 정당에 가입하지 않았어요</div>
          <p class="acct-party-empty__desc">정당에 입당하면 정치력을 쌓고 당대표, 대통령 후보가 될 수 있어요!</p>
          <div style="display:flex;gap:8px;justify-content:center;margin-top:12px">
            <button class="btn btn--primary" onclick="navigate('/parties')">🏛️ 정당 보러 가기</button>
            <button class="btn btn--ghost" onclick="navigate('/ranking')">🏆 랭킹 보기</button>
          </div>
        </div>`;
    }
  } catch (e) {
    console.error('[party tab]', e);
    content.innerHTML = `<div class="empty-state"><div class="empty-state__icon">⚠️</div><div class="empty-state__title">정당 정보를 불러오지 못했어요</div></div>`;
  }
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
      posts: postsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.hidden),
    };
  } catch { return { count: 0, posts: [] }; }
}
