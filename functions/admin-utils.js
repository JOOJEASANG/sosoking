const { getFirestore } = require('firebase-admin/firestore');

const db = getFirestore();
const FALLBACK_ADMIN_EMAILS = ['sosoday1976@gmail.com'];

function cleanEmail(value) {
  return String(value || '').trim().toLowerCase();
}

async function isAdminAuth(auth) {
  if (!auth?.uid) return false;

  const uidSnap = await db.doc(`admins/${auth.uid}`).get();
  if (uidSnap.exists) return true;

  const email = cleanEmail(auth.token?.email);
  if (!email) return false;
  if (FALLBACK_ADMIN_EMAILS.includes(email)) return true;

  const emailSnap = await db.doc(`admins/${email}`).get();
  return emailSnap.exists;
}

module.exports = { isAdminAuth };
