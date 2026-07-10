const { getFirestore } = require('firebase-admin/firestore');

const db = getFirestore();

function cleanEmail(value) {
  return String(value || '').trim().toLowerCase();
}

async function isAdminAuth(auth) {
  if (!auth?.uid) return false;

  const uidSnap = await db.doc(`admins/${auth.uid}`).get();
  if (uidSnap.exists) return true;

  const email = cleanEmail(auth.token?.email);
  const emailVerified = auth.token?.email_verified === true;
  if (!email || !emailVerified) return false;

  const emailSnap = await db.doc(`admins/${email}`).get();
  return emailSnap.exists;
}

async function loadSettings() {
  const [publicSnap, privateSnap] = await Promise.all([
    db.doc('site_settings/config').get().catch(() => null),
    db.doc('admin_settings/config').get().catch(() => null),
  ]);

  return {
    ...(publicSnap?.exists ? publicSnap.data() : {}),
    ...(privateSnap?.exists ? privateSnap.data() : {}),
  };
}

module.exports = { isAdminAuth, loadSettings };
