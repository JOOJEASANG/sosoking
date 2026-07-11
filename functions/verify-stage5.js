const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const index = read('public/index.html');
const ui = read('public/js/community-ui.js');
const integration = read('public/js/community-integration.js');
const css = read('public/css/community.css');
const actions = read('functions/community-actions.js');
const bootstrap = read('functions/bootstrap.js');
const rules = read('firestore.rules');
const indexes = JSON.parse(read('firestore.indexes.json'));

const checks = [
  [index.includes('/css/community.css?v=20260711-stage5'), 'Community stylesheet is not loaded'],
  [index.includes('/js/community-integration.js?v=20260711-stage5'), 'Community integration is not loaded'],
  [ui.includes("where('isPublic', '==', true)") && ui.includes("orderBy('createdAt', 'desc')"), 'Public board query is incomplete'],
  [ui.includes('이번 주 소소킹') && ui.includes('reactionCount'), 'Weekly Sosoking selection is missing'],
  [ui.includes('toggleReaction') && ui.includes('addCourtComment') && ui.includes('reportPublicCase'), 'Community callables are not connected'],
  [ui.includes('판결 동의') && ui.includes('배심원 의견'), 'Reaction and comment interface is incomplete'],
  [integration.includes("link.href = '#/board'") && integration.includes('renderBoard'), 'Public board route and navigation are missing'],
  [integration.includes('renderCommunity') && integration.includes('.result-shell'), 'Judgment community panel integration is missing'],
  [integration.includes('existingPanel') && integration.includes('replace = false'), 'Community render loop protection is missing'],
  [actions.includes('exports.toggleReaction') && actions.includes('exports.addCourtComment'), 'Reaction and comment functions are missing'],
  [actions.includes('exports.deleteCourtComment') && actions.includes('exports.reportPublicCase'), 'Comment deletion and reporting are missing'],
  [actions.includes('COMMENT_COOLDOWN_MS') && actions.includes('REACTION_TYPES'), 'Community abuse controls are missing'],
  [actions.includes('reactionCount: total') && actions.includes('commentCount: nextCount'), 'Board counters are not synchronized'],
  [bootstrap.includes("require('./community-actions')"), 'Community functions are not exported'],
  [rules.includes('function publicResult(caseId)') && rules.includes('match /result_reactions/{caseId}'), 'Public reaction read rules are missing'],
  [rules.includes('request.auth.uid == userId && publicResult(caseId)'), 'User vote privacy rule is missing'],
  [rules.includes('match /court_comments/{caseId}/items/{commentId}') && rules.includes('allow create, update, delete: if false'), 'Comment read/write security is incomplete'],
  [css.includes('.weekly-king') && css.includes('.community-panel') && css.includes('.reaction-button.selected'), 'Community styling is incomplete'],
  [indexes.indexes.some(index => index.collectionGroup === 'results' && index.fields.some(field => field.fieldPath === 'isPublic') && index.fields.some(field => field.fieldPath === 'createdAt')), 'Public result date index is missing'],
];

const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) {
  failed.forEach(message => console.error(`Stage 5 verification failed: ${message}`));
  process.exit(1);
}
console.log('Verified Stage 5 public board, weekly Sosoking, reactions, comments, reports and security rules.');
