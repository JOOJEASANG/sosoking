import fs from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const projectId = 'sosoking-rules-test';
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const separator = emulatorHost.lastIndexOf(':');
const host = emulatorHost.slice(0, separator);
const port = Number(emulatorHost.slice(separator + 1));
const rules = fs.readFileSync('firestore.rules', 'utf8');
const testEnv = await initializeTestEnvironment({ projectId, firestore: { host, port, rules } });

const user = testEnv.authenticatedContext('daily-user', { email: 'daily@example.com', email_verified: true }).firestore();
const admin = testEnv.authenticatedContext('daily-admin', { email: 'daily-admin@example.com', email_verified: true }).firestore();
const guest = testEnv.unauthenticatedContext().firestore();

try {
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'admins/daily-admin'), { role: 'admin' }),
      setDoc(doc(db, 'daily_court_catalog/case-1'), { title: '정답 포함 판례', correctChoiceId: 'a', active: true }),
      setDoc(doc(db, 'daily_court_config/catalog'), { orderedCaseIds: ['case-1', 'case-2', 'case-3'], size: 3, dailyCaseCount: 3 }),
      setDoc(doc(db, 'daily_court_days/2026-07-29'), { caseIds: ['case-1', 'case-2', 'case-3'], dailyCaseCount: 3 }),
      setDoc(doc(db, 'daily_court_days/2026-07-29/cases/case-1'), { totalVotes: 1, counts: { a: 1 } }),
      setDoc(doc(db, 'daily_court_days/2026-07-29/votes/daily-user'), { played: 3, correct: 2, score: 240, completed: true }),
      setDoc(doc(db, 'daily_court_days/2026-07-29/votes/daily-user/cases/case-1'), { selectedChoiceId: 'a', correct: true, score: 100 }),
      setDoc(doc(db, 'daily_court_weeks/2026-07-27'), { weekKey: '2026-07-27' }),
      setDoc(doc(db, 'daily_court_weeks/2026-07-27/users/daily-user'), { played: 3, correct: 2, score: 240 }),
      setDoc(doc(db, 'daily_court_players/daily-user'), { totalPlayed: 3, totalCorrect: 2, totalScore: 240 })
    ]);
  });

  for (const path of [
    'daily_court_catalog/case-1',
    'daily_court_config/catalog',
    'daily_court_days/2026-07-29',
    'daily_court_days/2026-07-29/cases/case-1',
    'daily_court_days/2026-07-29/votes/daily-user',
    'daily_court_days/2026-07-29/votes/daily-user/cases/case-1',
    'daily_court_weeks/2026-07-27',
    'daily_court_weeks/2026-07-27/users/daily-user',
    'daily_court_players/daily-user'
  ]) {
    await assertFails(getDoc(doc(user, path)));
    await assertFails(getDoc(doc(guest, path)));
    await assertSucceeds(getDoc(doc(admin, path)));
  }

  await assertFails(setDoc(doc(user, 'daily_court_days/2026-07-30'), { score: 999 }));
  await assertFails(setDoc(doc(user, 'daily_court_weeks/2026-07-27/users/daily-user'), { score: 999 }));
  await assertFails(updateDoc(doc(admin, 'daily_court_catalog/case-1'), { correctChoiceId: 'b' }));

  console.log('Daily court Firestore rules passed: three-case answers, votes, daily totals, weekly rankings, and player records are server-only.');
} finally {
  await testEnv.cleanup();
}
