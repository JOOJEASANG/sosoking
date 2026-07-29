'use strict';

const assert = require('node:assert/strict');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

if (!getApps().length) initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'sosoking-rules-test' });

const db = getFirestore();
const {
  extractCaseId,
  loadPublicResult,
  listPublicResultEntries,
  renderStructuredDocument,
  renderPublicResultHtml,
  renderSitemapXml,
  publicResultUrl
} = require('./public-seo');

const PUBLIC_ID = 'seo_public_case_20260729';
const PRIVATE_ID = 'seo_private_case_20260729';

async function cleanup() {
  await Promise.all([
    db.doc(`results/${PUBLIC_ID}`).delete().catch(() => null),
    db.doc(`results/${PRIVATE_ID}`).delete().catch(() => null)
  ]);
}

async function run() {
  await cleanup();
  const now = Timestamp.fromDate(new Date('2026-07-29T05:40:00.000Z'));

  await Promise.all([
    db.doc(`results/${PUBLIC_ID}`).set({
      isPublic: true,
      userId: 'must-never-be-rendered',
      caseTitle: '냉장고 마지막 푸딩 실종 사건',
      caseDescription: '가족이 남겨 둔 마지막 푸딩을 허락 없이 먹어 억울함이 발생했다.',
      docketNumber: '소소260729-생활판결-1234',
      judgeType: '논리집착형',
      judgeIcon: '🧮',
      grievanceIndex: 8,
      reception: '접수취지\n마지막 푸딩이 사라진 경위를 접수한다.\n\n사건개요\n냉장고에서 마지막 푸딩이 사라졌다.',
      investigation: '**확인 정황**\n냉장고 빈칸과 숟가락이 정황으로 확인된다.\n\n주요 증거:\n1. 내용물이 없는 푸딩 용기\n2. 싱크대의 작은 숟가락\n\n진술 검토\n피고는 유통기한 임박을 주장한다.\n\n조사관 의견\n피고의 설명만으로는 섭취 경위가 충분히 소명되지 않는다.',
      plaintiffArg: '청구취지\n원고는 푸딩 보충과 정식 사과를 요구한다.',
      defendantArg: '답변취지\n피고는 유통기한 임박을 주장한다.',
      verdict: '주문\n1. 피고는 동일 제품 두 개를 보충한다.\n2. 피고는 냉장고 메모 규칙을 준수한다.\n\n판단이유\n빈 용기와 숟가락이 피고 주장보다 설득력이 높다.',
      createdAt: now,
      updatedAt: now
    }),
    db.doc(`results/${PRIVATE_ID}`).set({
      isPublic: false,
      caseTitle: '비공개 사건',
      caseDescription: '검색엔진에 절대 노출되면 안 되는 내용',
      createdAt: now,
      updatedAt: now
    })
  ]);

  assert.equal(
    extractCaseId({ originalUrl: `/result/${PUBLIC_ID}?utm_source=test` }),
    PUBLIC_ID,
    'clean public result path should resolve its case ID'
  );
  assert.equal(extractCaseId({ originalUrl: '/result/not%2Fsafe' }), '', 'encoded slash must be rejected');

  const structured = renderStructuredDocument(
    '**확인 정황**\n빈 용기가 발견되었다.\n\n주요 증거:\n1. 빈 용기\n2. 숟가락',
    'investigation'
  );
  assert.match(structured, /class="document-subheading"[^>]*>확인 정황<\/h3>/);
  assert.match(structured, /class="document-subheading"[^>]*>주요 증거<\/h3>/);
  assert.match(structured, /class="document-order"/);
  assert.doesNotMatch(structured, /\*\*/);

  const publicResult = await loadPublicResult(PUBLIC_ID);
  const privateResult = await loadPublicResult(PRIVATE_ID);
  assert.ok(publicResult, 'public result should be loadable');
  assert.equal(privateResult, null, 'private result must not be loadable');

  const html = renderPublicResultHtml(publicResult);
  assert.match(html, /냉장고 마지막 푸딩 실종 사건 \| 소소킹 판결소/);
  assert.match(html, /가족이 남겨 둔 마지막 푸딩/);
  assert.match(html, /피고는 동일 제품 두 개를 보충/);
  assert.match(html, /class="document-subheading"[^>]*>확인 정황<\/h3>/);
  assert.match(html, /class="document-subheading"[^>]*>주요 증거<\/h3>/);
  assert.match(html, /class="document-order"/);
  assert.match(html, /document-subheading::before/);
  assert.match(html, new RegExp(`<link rel="canonical" href="${publicResultUrl(PUBLIC_ID)}">`));
  assert.match(html, /<meta name="robots" content="index,follow/);
  assert.match(html, /<script type="application\/ld\+json">/);
  assert.doesNotMatch(html, /must-never-be-rendered/);
  assert.doesNotMatch(html, /userId/);

  const entries = await listPublicResultEntries();
  assert.ok(entries.some(entry => entry.caseId === PUBLIC_ID), 'dynamic sitemap should include public results');
  assert.ok(!entries.some(entry => entry.caseId === PRIVATE_ID), 'dynamic sitemap must exclude private results');

  const sitemap = renderSitemapXml(entries);
  assert.match(sitemap, new RegExp(`<loc>${publicResultUrl(PUBLIC_ID)}</loc>`));
  assert.doesNotMatch(sitemap, new RegExp(PRIVATE_ID));
  assert.doesNotMatch(sitemap, /#\/result\//);

  await cleanup();
  console.log('Public SEO emulator validation passed: public-only loading, structured result headings, metadata, content rendering, and sitemap filtering.');
}

run().catch(async error => {
  console.error(error);
  await cleanup();
  process.exit(1);
});