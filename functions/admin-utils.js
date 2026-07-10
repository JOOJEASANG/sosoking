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

module.exports = { isAdminAuth };
