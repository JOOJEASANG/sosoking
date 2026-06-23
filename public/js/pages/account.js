import { auth, db, signOut, functions } from '../firebase.js';
import {
  collection, query, where, orderBy, limit, getDocs, getCountFromServer,
  doc, getDoc, writeBatch, deleteDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { updateProfile } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { navigate } from '../router.js';
import { toast } from '../components/toast.js';
import { escHtml, formatTime, computeTitle } from '../utils/helpers.js';
import { renderFeedCard } from '../components/feed-card.js';
import { appState } from '../state.js';
import { setMeta } from '../utils/seo.js';
import { renderSidebar } from '../components/sidebar.js';
import { renderBottomNav } from '../components/bottom-nav.js';
import { normalizeNicknameIcon } from '../utils/nickname-icon.js';

const MODE_META = {
  judge: { icon: '⚖️', label: '판결소' },
  create: { icon: '✨', label: '창작소' },
  consult: { icon: '🫂', label: '상담소' },
};

function call(name, payload = {}) {
  return httpsCallable(functions, name)(payload).then(response => response.data || {});
}

function renderAccountAvatar(user, nickname) {
  const icon = normalizeNicknameIcon(appState.nicknameIcon);
  if (icon?.type === 'image') return `<img class="account-avatar__img" src="${escHtml(icon.url)}" alt="" aria-hidden="true">`;
  if (icon?.type === 'emoji') return `<span class="account-avatar__emoji" aria-hidden="true">${escHtml(icon.value)}</span>`;
  if (user.photoURL) return `<img class="account-avatar__img" src="${escHtml(user.photoURL)}" alt="" aria-hidden="true">`;
  return escHtml((nickname || '나')[0]);
}

function tabButton(activeTab, key, icon, label, extra = '') {
  const active = activeTab === key;
  return `<button class="account-tab ${active ? 'active' : ''}" data-tab="${key}" aria-label="${label}" aria-current="${active ? 'page' : 'false'}"><span class="account-tab__icon">${icon}</span><span class="account-tab__label">${label}</span>${extra}</button>`;
}

async function fetchMyPosts(uid) {
  try {
    const base = query(collection(db, 'feeds'), where('authorId', '==', uid));
    const [countSnap, postsSnap] = await Promise.all([
      getCountFromServer(base),
      getDocs(query(collection(db, 'feeds'), where('authorId', '==', uid), orderBy('createdAt', 'desc'), limit(50))),
    ]);
    return {
      count: countSnap.data().count || 0,
      posts: postsSnap.docs.map(item => ({ id: item.id, ...item.data() })).filter(item => !item.hidden),
    };
  } catch (error) {
    console.warn('[account posts]', error);
    return { count: 0, posts: [] };
  }
}

async function fetchAiHistory(limitCount = 30) {
  try {
    const data = await call('getKingPlaygroundHistory', { limit: limitCount });
    return Array.isArray(data.results) ? data.results : [];
  } catch (error) {
    console.warn('[account AI history]', error);
    return [];
  }
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

function resultText(result) {
  const lines = [result.title, '', `입력: ${result.input}`, ''];
  (result.cards || []).forEach(card => lines.push(`[${card.name}]`, card.text, ''));
  lines.push(`소소킹 ${location.origin}/#/playground/${result.mode}`);
  return lines.join('\n').trim();
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const input = document.createElement('textarea');
  input.value = text;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  input.remove();
}

function renderAiHistory(results) {
  if (!results.length) {
    return `<div class="empty-state"><div class="empty-state__icon">🤖</div><div class="empty-state__title">아직 저장된 AI 결과가 없어요</div><div class="empty-state__desc">판결소·창작소·상담소에서 첫 결과를 만들어보세요.</div><button class="btn btn--primary" style="margin-top:16px" data-go="/playground">AI 놀이터 시작</button></div>`;
  }
  return `<div class="account-ai-list">${results.map(result => {
    const meta = MODE_META[result.mode] || { icon: '🤖', label: 'AI 결과' };
    return `<article class="account-ai-card" data-result-id="${escHtml(result.id)}"><details><summary><span class="account-ai-card__icon">${meta.icon}</span><span class="account-ai-card__summary"><b>${escHtml(result.title || meta.label)}</b><small>${escHtml(meta.label)} · ${escHtml(formatDate(result.createdAt))}</small></span><span class="account-ai-card__arrow">⌄</span></summary><div class="account-ai-card__body"><div class="account-ai-card__input"><b>입력 내용</b><p>${escHtml(result.input || '')}</p></div>${(result.cards || []).map(card => `<div class="account-ai-answer"><b>${escHtml(card.name || '캐릭터')}</b><p>${escHtml(card.text || '')}</p></div>`).join('')}<div class="account-ai-actions"><button class="btn btn--ghost btn--sm" data-ai-copy="${escHtml(result.id)}">복사</button><button class="btn btn--ghost btn--sm" data-ai-share="${escHtml(result.id)}">공유</button><button class="btn btn--ghost btn--sm account-ai-delete" data-ai-delete="${escHtml(result.id)}">삭제</button></div></div></details></article>`;
  }).join('')}</div>`;
}

function renderNotifItem(notification) {
  const time = formatTime(notification.createdAt?.toDate?.() || notification.createdAt);
  const isComment = notification.type === 'comment';
  const isReaction = notification.type === 'reaction' || notification.type === 'like';
  const icon = isComment ? '💬' : isReaction ? '❤️' : '🔔';
  const destination = notification.postId ? `/material/${notification.postId}` : '/account?tab=notifications';
  const text = notification.title || notification.body || (isComment ? '내 글에 댓글이 달렸어요.' : isReaction ? '내 글에 반응이 도착했어요.' : '새 알림이 도착했어요.');
  return `<button class="notif-item ${notification.read ? '' : 'notif-item--unread'}" data-go="${destination}"><span class="notif-item__icon">${icon}</span><span class="notif-item__body"><span class="notif-item__text">${escHtml(text)}</span><span class="notif-item__time">${escHtml(time)}</span></span></button>`;
}

export async function renderAccount() {
  setMeta('내 정보 | 소소킹', '내 AI 결과와 작성 글, 스크랩, 알림, 계정 설정을 관리합니다.');
  const element = document.getElementById('page-content');
  const user = appState.user;

  if (!user) {
    if (appState.loading) {
      element.innerHTML = `<div class="loading-center"><div class="spinner spinner--lg"></div></div>`;
      return;
    }
    element.innerHTML = `<div class="empty-state"><div class="empty-state__icon">👤</div><div class="empty-state__title">로그인이 필요해요</div><button class="btn btn--primary" style="margin-top:16px" onclick="navigate('/login?return=/account')">로그인하기</button></div>`;
    return;
  }

  element.innerHTML = `<div class="loading-center"><div class="spinner spinner--lg"></div></div>`;
  const [{ count: postCount, posts: myPosts }, userSnap, adminSnap, initialAiHistory] = await Promise.all([
    fetchMyPosts(user.uid),
    getDoc(doc(db, 'users', user.uid)).catch(() => null),
    getDoc(doc(db, 'admins', user.uid)).catch(() => null),
    fetchAiHistory(30),
  ]);

  const userData = userSnap?.exists() ? userSnap.data() : {};
  const isAdmin = adminSnap?.exists() === true;
  const nickname = appState.nickname || user.displayName || user.email?.split('@')[0] || '익명';
  const title = computeTitle(postCount);
  const requestedTab = new URLSearchParams(window.location.hash.split('?')[1] || '').get('tab') || 'ai';
  const activeTab = ['ai', 'posts', 'scraps', 'notifications', 'settings'].includes(requestedTab) ? requestedTab : 'ai';

  element.innerHTML = `<div class="account-page-wrap account-page-wrap--king"><div class="card account-profile-card"><div class="account-header"><div class="avatar account-avatar ${normalizeNicknameIcon(appState.nicknameIcon) || user.photoURL ? 'avatar--nickname-icon' : ''}" style="width:72px;height:72px;font-size:24px;font-weight:800">${renderAccountAvatar(user, nickname)}</div><div class="account-nickname">${escHtml(nickname)}</div><div class="account-level"><span class="title-badge">${escHtml(title)}</span></div><div class="account-stats"><div class="account-stat"><div class="account-stat__num">${initialAiHistory.length}</div><div class="account-stat__label">AI 결과</div></div><div class="account-stat"><div class="account-stat__num">${postCount}</div><div class="account-stat__label">작성한 글</div></div><div class="account-stat"><div class="account-stat__num">${appState.unreadNotifications || 0}</div><div class="account-stat__label">새 알림</div></div></div></div><div class="card__footer account-profile-actions">${isAdmin ? `<button class="btn btn--primary btn--sm" data-go="/admin">⚙️ 관리자</button>` : ''}<button class="btn btn--ghost btn--sm" id="btn-logout">로그아웃</button></div></div><div class="account-tabs" aria-label="내 정보 메뉴">${tabButton(activeTab, 'ai', '🤖', `AI 결과 ${initialAiHistory.length || ''}`)}${tabButton(activeTab, 'posts', '📝', `내 글 ${postCount || ''}`)}${tabButton(activeTab, 'scraps', '🔖', '스크랩')}${tabButton(activeTab, 'notifications', '🔔', '알림', appState.unreadNotifications > 0 ? `<span class="notif-badge-sm account-tab__badge">${appState.unreadNotifications}</span>` : '')}${tabButton(activeTab, 'settings', '⚙️', '설정')}</div><div id="account-tab-content"></div></div>`;

  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await signOut(auth);
    toast.success('로그아웃됐어요.');
    navigate('/');
  });

  const renderTab = async tab => {
    const content = document.getElementById('account-tab-content');
    if (!content) return;
    content.innerHTML = `<div class="loading-center"><div class="spinner"></div></div>`;

    if (tab === 'ai') {
      const results = tab === activeTab ? initialAiHistory : await fetchAiHistory(30);
      content.innerHTML = renderAiHistory(results);
      content.dataset.aiResults = JSON.stringify(results);
      bindAiHistoryActions(content, renderTab);
    } else if (tab === 'posts') {
      content.innerHTML = myPosts.length ? myPosts.map(post => renderFeedCard(post)).join('') : `<div class="empty-state"><div class="empty-state__icon">✏️</div><div class="empty-state__title">아직 올린 글이 없어요</div><div class="empty-state__desc">AI 판결 결과나 생활 논쟁에 의견을 남겨보세요.</div><button class="btn btn--primary" style="margin-top:16px" data-go="/playground">AI 놀이터 가기</button></div>`;
    } else if (tab === 'scraps') {
      await renderScrapsTab(content, user.uid);
    } else if (tab === 'notifications') {
      await renderNotificationsTab(content, user.uid);
    } else if (tab === 'settings') {
      renderSettingsTab(content, user, userData, nickname);
    }
    bindNavigation(content);
  };

  document.querySelectorAll('.account-tab').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.account-tab').forEach(item => {
        item.classList.toggle('active', item === button);
        item.setAttribute('aria-current', item === button ? 'page' : 'false');
      });
      const tab = button.dataset.tab;
      history.replaceState(null, '', `#/account?tab=${tab}`);
      renderTab(tab);
    });
  });

  bindNavigation(element);
  await renderTab(activeTab);
}

function bindNavigation(root) {
  root.querySelectorAll('[data-go]').forEach(button => {
    if (button.dataset.boundGo === '1') return;
    button.dataset.boundGo = '1';
    button.addEventListener('click', () => navigate(button.dataset.go));
  });
}

function getStoredResults(content) {
  try { return JSON.parse(content.dataset.aiResults || '[]'); }
  catch { return []; }
}

function bindAiHistoryActions(content, rerender) {
  content.querySelectorAll('[data-ai-copy]').forEach(button => button.addEventListener('click', async event => {
    event.preventDefault();
    const result = getStoredResults(content).find(item => item.id === button.dataset.aiCopy);
    if (!result) return;
    await copyText(resultText(result));
    toast.success('AI 결과를 복사했어요.');
  }));
  content.querySelectorAll('[data-ai-share]').forEach(button => button.addEventListener('click', async event => {
    event.preventDefault();
    const result = getStoredResults(content).find(item => item.id === button.dataset.aiShare);
    if (!result) return;
    const text = resultText(result);
    if (navigator.share) {
      try { await navigator.share({ title: result.title, text }); return; }
      catch (error) { if (error?.name === 'AbortError') return; }
    }
    await copyText(text);
    toast.success('공유할 내용을 복사했어요.');
  }));
  content.querySelectorAll('[data-ai-delete]').forEach(button => button.addEventListener('click', async event => {
    event.preventDefault();
    if (!confirm('이 AI 결과를 최근 기록에서 삭제할까요?')) return;
    button.disabled = true;
    try {
      await call('deleteKingPlaygroundResult', { resultId: button.dataset.aiDelete });
      toast.success('AI 결과를 삭제했어요.');
      await rerender('ai');
    } catch (error) {
      button.disabled = false;
      toast.error(error?.message || 'AI 결과를 삭제하지 못했습니다.');
    }
  }));
}

async function renderScrapsTab(content, uid) {
  const scrapSnap = await getDocs(query(collection(db, 'users', uid, 'scraps'), orderBy('scrappedAt', 'desc'))).catch(() => null);
  const ids = scrapSnap?.docs.map(item => item.id) || [];
  const posts = ids.length ? (await Promise.all(ids.map(id => getDoc(doc(db, 'feeds', id))))).filter(item => item.exists()).map(item => ({ id: item.id, ...item.data() })).filter(item => !item.hidden) : [];

  content.innerHTML = posts.length ? `<div class="account-scrap-actions"><button class="btn btn--ghost btn--sm" id="btn-acct-scrap-all">전체 삭제</button></div>${posts.map(post => `<div class="scrap-item" id="acct-scrap-${post.id}"><button class="scrap-delete-btn" data-scrap-delete="${post.id}">삭제</button>${renderFeedCard(post)}</div>`).join('')}` : `<div class="empty-state"><div class="empty-state__icon">🔖</div><div class="empty-state__title">아직 스크랩한 글이 없어요</div><div class="empty-state__desc">다시 보고 싶은 자료를 스크랩해두세요.</div></div>`;

  content.querySelectorAll('[data-scrap-delete]').forEach(button => button.addEventListener('click', async () => {
    try {
      await deleteDoc(doc(db, 'users', uid, 'scraps', button.dataset.scrapDelete));
      document.getElementById(`acct-scrap-${button.dataset.scrapDelete}`)?.remove();
      toast.success('스크랩을 삭제했어요.');
    } catch { toast.error('스크랩을 삭제하지 못했습니다.'); }
  }));

  document.getElementById('btn-acct-scrap-all')?.addEventListener('click', async () => {
    if (!confirm('스크랩을 전부 삭제할까요?')) return;
    try {
      const allSnap = await getDocs(collection(db, 'users', uid, 'scraps'));
      const batch = writeBatch(db);
      allSnap.docs.forEach(item => batch.delete(item.ref));
      await batch.commit();
      content.innerHTML = `<div class="empty-state"><div class="empty-state__icon">🔖</div><div class="empty-state__title">스크랩을 모두 비웠어요</div></div>`;
      toast.success('전체 스크랩을 삭제했어요.');
    } catch { toast.error('스크랩을 삭제하지 못했습니다.'); }
  });
}

async function renderNotificationsTab(content, uid) {
  const notificationsQuery = query(collection(db, 'notifications'), where('userId', '==', uid), orderBy('createdAt', 'desc'), limit(50));
  const snap = await getDocs(notificationsQuery).catch(() => null);
  const notifications = snap?.docs.map(item => ({ id: item.id, ...item.data() })) || [];
  const unread = snap?.docs.filter(item => !item.data().read) || [];
  if (unread.length) {
    const batch = writeBatch(db);
    unread.forEach(item => batch.update(item.ref, { read: true }));
    batch.commit().then(() => {
      appState.unreadNotifications = 0;
      renderSidebar();
      renderBottomNav();
    }).catch(() => {});
  }
  content.innerHTML = notifications.length ? `<div class="notif-list">${notifications.map(renderNotifItem).join('')}</div>` : `<div class="empty-state"><div class="empty-state__icon">🔔</div><div class="empty-state__title">아직 알림이 없어요</div><div class="empty-state__desc">활동을 시작하면 반응이 이곳에 표시됩니다.</div></div>`;
}

function renderSettingsTab(content, user, userData, nickname) {
  const isGoogle = user.providerData?.some(provider => provider.providerId === 'google.com');
  const isEmail = user.providerData?.some(provider => provider.providerId === 'password');
  const loginType = isGoogle ? '구글 소셜 로그인' : isEmail ? '이메일/비밀번호' : '카카오 소셜 로그인';
  const displayEmail = user.email || userData?.email || '';

  content.innerHTML = `<div class="card" style="margin-bottom:12px"><div class="card__body--lg"><div class="section-title" style="font-size:15px;margin-bottom:16px">👤 닉네임 변경</div><div class="form-group"><label class="form-label" for="new-nickname">새 닉네임</label><input id="new-nickname" class="form-input" type="text" value="${escHtml(nickname)}" placeholder="2~12자, 한글/영문/숫자/_" maxlength="12"><div class="form-hint">2~12자, 한글·영문·숫자·_(밑줄)만 사용할 수 있어요.</div><div id="nickname-feedback" class="account-form-feedback"></div></div><button class="btn btn--primary btn--sm" id="btn-save-nickname">저장하기</button></div></div><div class="card" style="margin-bottom:12px"><div class="card__body--lg"><div class="section-title" style="font-size:15px;margin-bottom:8px">🔐 계정 정보</div><div class="account-info-row"><span>이메일</span><strong>${escHtml(displayEmail || '—')}</strong></div><div class="account-info-row"><span>로그인 방식</span><strong>${escHtml(loginType)}</strong></div><div class="account-info-row"><span>AI 결과 보관</span><strong>본인 전용</strong></div></div></div><div class="card account-danger-card"><div class="card__body--lg"><div class="section-title account-danger-title">⚠️ 회원 탈퇴</div><p>탈퇴하면 계정과 개인 AI 결과가 삭제되며 복구할 수 없습니다. 작성한 공개 글과 댓글은 별도 정책에 따라 남을 수 있습니다.</p><button class="btn btn--danger btn--sm" id="btn-withdraw">회원 탈퇴</button></div></div>`;

  setupNicknameEdit(user, nickname);
  setupWithdrawal();
}

function setupNicknameEdit(user, currentNickname) {
  const input = document.getElementById('new-nickname');
  const feedback = document.getElementById('nickname-feedback');
  const saveButton = document.getElementById('btn-save-nickname');
  const pattern = /^[가-힣a-zA-Z0-9_]{2,12}$/;
  let timer = null;

  input?.addEventListener('input', () => {
    const value = input.value.trim();
    feedback.textContent = '';
    clearTimeout(timer);
    if (!value) return;
    if (!pattern.test(value)) {
      feedback.dataset.state = 'error';
      feedback.textContent = '2~12자, 한글·영문·숫자·_만 사용할 수 있어요.';
      return;
    }
    if (value === currentNickname) {
      feedback.dataset.state = 'normal';
      feedback.textContent = '현재 닉네임입니다.';
      return;
    }
    feedback.dataset.state = 'normal';
    feedback.textContent = '확인 중…';
    timer = setTimeout(async () => {
      const snap = await getDoc(doc(db, 'nicknames', value)).catch(() => null);
      if (input.value.trim() !== value) return;
      const used = snap?.exists() && snap.data()?.uid !== user.uid;
      feedback.dataset.state = used ? 'error' : 'success';
      feedback.textContent = used ? '이미 사용 중인 닉네임입니다.' : '사용 가능한 닉네임입니다.';
    }, 400);
  });

  saveButton?.addEventListener('click', async () => {
    const nickname = input?.value.trim();
    if (!pattern.test(nickname || '')) { toast.error('닉네임 형식을 확인해주세요.'); return; }
    if (nickname === currentNickname) { toast.info('현재 닉네임과 같습니다.'); return; }
    saveButton.disabled = true;
    saveButton.textContent = '저장 중…';
    try {
      await call('updateNickname', { nickname });
      await updateProfile(user, { displayName: nickname }).catch(() => {});
      appState.nickname = nickname;
      renderSidebar();
      renderBottomNav();
      feedback.dataset.state = 'success';
      feedback.textContent = '저장됐습니다.';
      toast.success('닉네임이 변경됐어요.');
    } catch (error) {
      toast.error(error?.message || '닉네임을 저장하지 못했습니다.');
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = '저장하기';
    }
  });
}

function setupWithdrawal() {
  document.getElementById('btn-withdraw')?.addEventListener('click', async () => {
    if (!confirm('정말 탈퇴하시겠어요?\n\n계정과 개인 AI 결과가 삭제되며 복구할 수 없습니다.')) return;
    const button = document.getElementById('btn-withdraw');
    button.disabled = true;
    button.textContent = '처리 중…';
    try {
      await call('deleteMyAccount');
      await signOut(auth).catch(() => {});
      toast.success('탈퇴가 완료됐어요.');
      navigate('/');
    } catch (error) {
      button.disabled = false;
      button.textContent = '회원 탈퇴';
      toast.error(error?.message || '탈퇴 처리 중 오류가 발생했습니다.');
    }
  });
}
