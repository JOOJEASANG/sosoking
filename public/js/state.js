/* state.js — 앱 전역 상태 (순환 import 방지용 단일 모듈) */
export const appState = {
  user: null,
  loading: true,
  isAdmin: false,
  unreadNotifications: 0,
  streak: 0,
  userTitle: '',
  installPrompt: null,
};
