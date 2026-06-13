/* party-badge.js — 정당 뱃지 렌더링 유틸리티 */
import { appState } from '../state.js';

export const PARTY_COLORS = {
  national: { emoji: '🎙️', name: '국민안정당', color: '#8B7355', bg: '#f5f0eb' },
  youth:    { emoji: '📱', name: '청년혁명당', color: '#E84393', bg: '#fde8f3' },
  center:   { emoji: '📊', name: '중도민주당', color: '#00CEC9', bg: '#e0faf9' },
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
