import { functions } from '../firebase.js?v=20260630-3';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';

export async function loadSafePublicResults(_db, options = {}) {
  const maxRows = Math.max(1, Math.min(100, Number(options.maxRows) || 40));
  const response = await httpsCallable(functions, 'listPublicResults')({ maxRows });
  const rows = Array.isArray(response?.data?.rows) ? response.data.rows : [];

  return rows
    .filter(row => row && typeof row.id === 'string' && row.data && typeof row.data === 'object')
    .map(row => [row.id, row.data]);
}
