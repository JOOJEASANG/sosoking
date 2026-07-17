const { getFirestore } = require('firebase-admin/firestore');

const db = getFirestore();

function cleanEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isVerifiedStaffLogin(auth) {
  if (!auth?.uid) return false;
  const provider = auth.token?.firebase?.sign_in_provider || '';
  if (provider === 'anonymous') return false;
  if (provider === 'password' && auth.token?.email_verified !== true) return false;
  return true;
}

async function isAdminAuth(auth) {
  if (!isVerifiedStaffLogin(auth)) return false;

  const uidSnapshot = await db.doc(`admins/${auth.uid}`).get();
  if (uidSnapshot.exists) return true;

  const email = cleanEmail(auth.token?.email);
  const emailVerified = auth.token?.email_verified === true;
  if (!email || !emailVerified) return false;

  const emailSnapshot = await db.doc(`admins/${email}`).get();
  return emailSnapshot.exists;
}

async function loadSettings() {
  const [publicSnapshot, privateSnapshot] = await Promise.all([
    db.doc('site_settings/config').get().catch(() => null),
    db.doc('admin_settings/config').get().catch(() => null),
  ]);

  return {
    ...(publicSnapshot?.exists ? publicSnapshot.data() : {}),
    ...(privateSnapshot?.exists ? privateSnapshot.data() : {}),
  };
}

module.exports = { isAdminAuth, loadSettings, isVerifiedStaffLogin };