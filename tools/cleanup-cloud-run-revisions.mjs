// Deletes old Cloud Run revisions after deployment to reduce Secret Manager
// active-version storage costs. Each old revision keeps a pinned reference to
// the secret version it was deployed with; clearing them trims that billing.
// Keeps the newest KEEP_REVISIONS revisions per service; skips any that are
// still serving traffic (Cloud Run returns 409 for those).

import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const KEEP_REVISIONS = 2;
const PROJECT = 'sosoking-481e6';
const REGION = 'asia-northeast3';
const SA_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!SA_PATH) {
  console.warn('GOOGLE_APPLICATION_CREDENTIALS not set — skipping Cloud Run revision cleanup.');
  process.exit(0);
}

async function getAccessToken() {
  const sa = JSON.parse(readFileSync(SA_PATH, 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    sub: sa.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/cloud-platform'
  })).toString('base64url');
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  const sig = signer.sign(sa.private_key, 'base64url');
  const jwt = `${header}.${claim}.${sig}`;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Token exchange failed ${resp.status}: ${text.slice(0, 200)}`);
  }
  const { access_token } = await resp.json();
  return access_token;
}

const BASE = `https://run.googleapis.com/v2/projects/${PROJECT}/locations/${REGION}`;

async function apiGet(token, url) {
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const text = await resp.text();
  if (!resp.ok) {
    const err = new Error(`GET ${url}: ${resp.status}`);
    err.status = resp.status;
    err.body = text;
    throw err;
  }
  return JSON.parse(text);
}

async function tryDeleteRevision(token, revisionResourceName) {
  const url = `https://run.googleapis.com/v2/${revisionResourceName}`;
  const resp = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  return resp.status;
}

async function run() {
  const token = await getAccessToken();

  let services;
  try {
    const result = await apiGet(token, `${BASE}/services?pageSize=200`);
    services = result.services || [];
  } catch (err) {
    if (err.status === 403) {
      console.warn('Cloud Run cleanup skipped: service account lacks run.services.list permission.');
      return;
    }
    throw err;
  }

  console.log(`Found ${services.length} Cloud Run services. Cleaning up old revisions (keeping latest ${KEEP_REVISIONS})...`);
  let totalDeleted = 0;
  let totalSkipped = 0;

  for (const svc of services) {
    const svcShortName = svc.name.split('/').pop();

    let revisions;
    try {
      const result = await apiGet(token, `${BASE}/services/${svcShortName}/revisions?pageSize=100`);
      revisions = result.revisions || [];
    } catch (err) {
      console.warn(`  ${svcShortName}: could not list revisions (${err.status || err.message}) — skipping`);
      continue;
    }

    revisions.sort((a, b) => new Date(b.createTime) - new Date(a.createTime));
    const toDelete = revisions.slice(KEEP_REVISIONS);
    if (!toDelete.length) continue;

    process.stdout.write(`  ${svcShortName}: ${revisions.length} revisions, deleting ${toDelete.length}... `);

    let svcDeleted = 0;
    let svcSkipped = 0;
    for (const rev of toDelete) {
      const status = await tryDeleteRevision(token, rev.name);
      if (status === 200 || status === 202 || status === 204) {
        svcDeleted++;
        totalDeleted++;
      } else if (status === 409) {
        svcSkipped++;
        totalSkipped++;
      } else if (status === 403) {
        console.warn(`\n  Cloud Run cleanup skipped: service account lacks run.revisions.delete permission.`);
        return;
      } else if (status !== 404) {
        console.warn(`\n  Unexpected status ${status} deleting ${rev.name.split('/').pop()} — skipping`);
        svcSkipped++;
        totalSkipped++;
      }
    }
    console.log(`deleted=${svcDeleted} skipped=${svcSkipped}`);
  }

  console.log(`Cloud Run revision cleanup complete: deleted=${totalDeleted} skipped=${totalSkipped}`);
}

run().catch(err => {
  console.error('Cloud Run revision cleanup failed:', err.message);
  process.exit(1);
});
