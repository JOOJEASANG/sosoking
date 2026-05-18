import { navigate } from './router.js';
import { toast } from './components/toast.js';

function getParams() {
  const hash = window.location.hash || '';
  const query = hash.includes('?') ? hash.split('?')[1] : '';
  return new URLSearchParams(query);
}

function isAcrosticRoute() {
  return (window.location.hash || '').startsWith('#/write') && getParams().get('type') === 'acrostic';
}

function hasMissionKeyword() {
  const keyword = (getParams().get('keyword') || '').trim();
  const len = [...keyword].length;
  return len >= 3 && len <= 6;
}

function guardAcrosticRoute() {
  if (!isAcrosticRoute()) return;
  if (hasMissionKeyword()) return;
  toast.warn('행시는 미션에서만 참여할 수 있어요');
  navigate('/mission');
}

window.addEventListener('hashchange', () => setTimeout(guardAcrosticRoute, 80));
setTimeout(guardAcrosticRoute, 200);
