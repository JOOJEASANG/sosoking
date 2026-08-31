import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';

export const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const ACTIVITY_STORAGE_KEY = 'sosoking:auth-activity:v1';
const ACTIVITY_WRITE_THROTTLE_MS = 5000;
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel', 'scroll'];

function readActivity(uid) {
  try {
    const raw = localStorage.getItem(ACTIVITY_STORAGE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    if (parsed?.uid !== uid) return 0;
    const at = Number(parsed?.at || 0);
    return Number.isFinite(at) ? at : 0;
  } catch {
    return 0;
  }
}

function writeActivity(uid, at = Date.now()) {
  try {
    localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify({ uid, at }));
  } catch {
    // localStorage가 차단된 환경에서도 현재 탭 타이머는 계속 동작한다.
  }
}

function clearActivity(uid) {
  try {
    const raw = localStorage.getItem(ACTIVITY_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed?.uid === uid) localStorage.removeItem(ACTIVITY_STORAGE_KEY);
  } catch {
    // 저장소 정리는 최선 노력으로 처리한다.
  }
}

export function startIdleSessionTimeout({
  auth,
  timeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
  onTimeout
}) {
  if (!auth || typeof onTimeout !== 'function') throw new Error('Idle session timeout requires auth and onTimeout');

  let timer = null;
  let activeUid = '';
  let lastLocalActivityAt = 0;
  let timingOut = false;
  let stopped = false;

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const schedule = () => {
    clearTimer();
    if (stopped || timingOut) return;
    const user = auth.currentUser;
    if (!user || user.isAnonymous || !activeUid || user.uid !== activeUid) return;

    const sharedActivityAt = readActivity(activeUid);
    const lastActivityAt = Math.max(lastLocalActivityAt, sharedActivityAt || 0);
    const remaining = timeoutMs - (Date.now() - lastActivityAt);
    timer = setTimeout(checkTimeout, Math.max(250, remaining));
  };

  const timeoutCurrentUser = async user => {
    if (timingOut || stopped || !user || user.isAnonymous) return;
    timingOut = true;
    clearTimer();
    clearActivity(user.uid);
    try {
      await onTimeout(user);
    } catch (error) {
      console.error('idle session logout failed:', error);
    } finally {
      timingOut = false;
    }
  };

  function checkTimeout() {
    if (stopped || timingOut) return;
    const user = auth.currentUser;
    if (!user || user.isAnonymous || !activeUid || user.uid !== activeUid) {
      clearTimer();
      return;
    }

    const sharedActivityAt = readActivity(activeUid);
    const lastActivityAt = Math.max(lastLocalActivityAt, sharedActivityAt || 0);
    if (Date.now() - lastActivityAt >= timeoutMs) {
      void timeoutCurrentUser(user);
      return;
    }
    schedule();
  }

  const recordActivity = () => {
    const user = auth.currentUser;
    if (!user || user.isAnonymous || !activeUid || user.uid !== activeUid || timingOut) return;
    const now = Date.now();
    lastLocalActivityAt = now;
    if (now - Number(recordActivity.lastWrittenAt || 0) >= ACTIVITY_WRITE_THROTTLE_MS) {
      recordActivity.lastWrittenAt = now;
      writeActivity(activeUid, now);
    }
    schedule();
  };
  recordActivity.lastWrittenAt = 0;

  const handleStorage = event => {
    if (event.key !== ACTIVITY_STORAGE_KEY || !activeUid) return;
    schedule();
  };

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') checkTimeout();
  };

  ACTIVITY_EVENTS.forEach(eventName => window.addEventListener(eventName, recordActivity, { passive: true }));
  window.addEventListener('storage', handleStorage);
  document.addEventListener('visibilitychange', handleVisibility);

  const unsubscribeAuth = onAuthStateChanged(auth, user => {
    clearTimer();
    timingOut = false;
    if (!user || user.isAnonymous) {
      activeUid = '';
      lastLocalActivityAt = 0;
      return;
    }

    activeUid = user.uid;
    const now = Date.now();
    lastLocalActivityAt = now;
    recordActivity.lastWrittenAt = now;
    writeActivity(activeUid, now);
    schedule();
  });

  return () => {
    stopped = true;
    clearTimer();
    unsubscribeAuth();
    ACTIVITY_EVENTS.forEach(eventName => window.removeEventListener(eventName, recordActivity));
    window.removeEventListener('storage', handleStorage);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}
