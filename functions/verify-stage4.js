const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const index = read('public/index.html');
const integration = read('public/js/my-cases-integration.js');
const ui = read('public/js/my-cases-ui.js');
const css = read('public/css/my-cases.css');
const actions = read('functions/user-case-actions.js');
const bootstrap = read('functions/bootstrap.js');
const indexes = JSON.parse(read('firestore.indexes.json'));
const checks = [
  [index.includes('/js/my-cases-integration.js?v=20260711-stage4'), 'My cases integration is not loaded'],
  [index.includes('/css/my-cases.css?v=20260711-stage4'), 'My cases stylesheet is not loaded'],
  [integration.includes('location.hash') && integration.includes('#/my-cases'), 'My cases route integration is missing'],
  [integration.includes('refresh') && integration.includes('bindMyCasesActions'), 'My cases loading and actions are incomplete'],
  [ui.includes("where('userId', '==', userId)") && ui.includes("orderBy('createdAt', 'desc')"), 'Owner case query is incomplete'],
  [ui.includes('updateCaseVisibility') && ui.includes('deleteMyCase'), 'Visibility and deletion callables are not connected'],
  [ui.includes('판결 보기') && ui.includes('AI 재판 시작'), 'Case status actions are incomplete'],
  [actions.includes('exports.updateCaseVisibility') && actions.includes('exports.deleteMyCase'), 'Server case actions are missing'],
  [actions.includes('caseSnap.data().userId !== auth.uid'), 'Server ownership verification is missing'],
  [actions.includes('transaction.update(resultRef') && actions.includes('batch.delete(resultRef)'), 'Result visibility and deletion are not synchronized'],
  [actions.includes('db.recursiveDelete(reactionRef)') && actions.includes('db.recursiveDelete(commentRef)'), 'Community subcollections are not deleted with the case'],
  [actions.includes("collection('reports').where('caseId', '==', caseId)") && actions.includes('deleteReportsForCase'), 'Case reports are not deleted with the case'],
  [actions.includes('batch.delete(publicResultRef)'), 'Public projection is not deleted with the case'],
  [bootstrap.includes("require('./main')") && bootstrap.includes("require('./user-case-actions')"), 'Function bootstrap is incomplete'],
  [css.includes('.case-item') && css.includes('.case-status.complete') && css.includes('.empty-cases'), 'My cases styling is incomplete'],
  [indexes.indexes.some(index => index.collectionGroup === 'cases' && index.fields.some(field => field.fieldPath === 'userId') && index.fields.some(field => field.fieldPath === 'createdAt')), 'Cases owner/date index is missing'],
];
const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) { failed.forEach(message => console.error(`Stage 4 verification failed: ${message}`)); process.exit(1); }
console.log('Verified Stage 4 case list, visibility controls, ownership checks and complete community cleanup on deletion.');
