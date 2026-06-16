/* party-badge.js — 정당 뱃지 렌더링 유틸리티 */
import { appState } from '../state.js';

export const PARTY_COLORS = {
  national: { emoji: '🛡️', name: '국민질서당', color: '#263B66', bg: '#e9eef8' },
  youth:    { emoji: '🕯️', name: '시민개혁당', color: '#B8323B', bg: '#fdecee' },
  center:   { emoji: '⚖️', name: '국민통합당', color: '#2F7D6E', bg: '#e6f3f0' },
};

export function renderPartyBadge(partyId) {
  const p = PARTY_COLORS[partyId];
  if (!p) return '';
  return `<span class="party-badge" style="--party-c:${p.color};--party-bg:${p.bg}" title="${p.name}">${p.emoji}</span>`;
}

export function renderPresidentCrown(uid) {
  if (!uid || !appState.presidentUid) return '';
  return uid === appState.presidentUid ? '<span class="president-crown" title="현직 대통령">👑</span>' : '';
}
