const { getFirestore } = require('firebase-admin/firestore');

const db = getFirestore();
const BOOTSTRAP_OWNER = ['sosoday1976', 'gmail.com'].join('@');

function cleanEmail(value) {
  return String(value || '').trim().toLowerCase();
}

async function isAdminAuth(auth) {
  if (!auth?.uid) return false;

  const email = cleanEmail(auth.token?.email);
  if (email === BOOTSTRAP_OWNER) return true;

  const uidSnap = await db.doc(`admins/${auth.uid}`).get();
  if (uidSnap.exists) return true;

  if (!email) return false;
  const emailSnap = await db.doc(`admins/${email}`).get();
  return emailSnap.exists;
}

module.exports = { isAdminAuth };
