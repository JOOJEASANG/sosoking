/* party-badge.js — 정당 뱃지 렌더링 유틸리티 */
import { appState } from '../state.js';

export const PARTY_COLORS = {
  national: { emoji: '🎙️', name: '국민안정당', color: '#8B7355', bg: '#f5f0eb' },
  truth:    { emoji: '📺', name: '진실방송당', color: '#6C5CE7', bg: '#f0eeff' },
  youth:    { emoji: '📱', name: '청년혁명당', color: '#E84393', bg: '#fde8f3' },
  center:   { emoji: '📊', name: '중도민주당', color: '#00CEC9', bg: '#e0faf9' },
  future:   { emoji: '🤝', name: '함께미래당', color: '#FDCB6E', bg: '#fef9e7' },
  rights:   { emoji: '🔍', name: '알권리당',   color: '#00B894', bg: '#e0f7f2' },
  justice:  { emoji: '⚖️', name: '법치정의당', color: '#2D3436', bg: '#f0f0f0' },
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
