import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function snapshotRows(snapshot) {
  return snapshot.docs.map(document => [document.id, document.data()]);
}

export async function loadSafePublicResults(db, options = {}) {
  const maxRows = Math.max(1, Math.min(100, Number(options.maxRows) || 40));
  const fallbackRows = Math.max(maxRows, Math.min(200, Number(options.fallbackRows) || 100));
  const safeFilters = [
    where('isPublic', '==', true),
    where('publicDataVersion', '==', 1)
  ];

  try {
    const snapshot = await getDocs(query(
      collection(db, 'results'),
      ...safeFilters,
      orderBy('createdAt', 'desc'),
      limit(maxRows)
    ));
    return snapshotRows(snapshot);
  } catch (error) {
    const code = String(error?.code || '').toLowerCase();
    if (!code.includes('failed-precondition')) throw error;

    console.warn('public result index is not ready; using client-side ordering');
    const snapshot = await getDocs(query(
      collection(db, 'results'),
      ...safeFilters,
      limit(fallbackRows)
    ));

    return snapshotRows(snapshot)
      .sort((a, b) => timestampMillis(b[1]?.createdAt) - timestampMillis(a[1]?.createdAt))
      .slice(0, maxRows);
  }
}
