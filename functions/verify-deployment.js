const EXPECTED_ENGINE = 'role-based-trial-v10';
const EXPECTED_REVISION = 'role-trial-v10-final';
const DEFAULT_ATTEMPTS = 18;
const DEFAULT_DELAY_MS = 10000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchHealth(endpoint) {
  const separator = endpoint.includes('?') ? '&' : '?';
  const response = await fetch(`${endpoint}${separator}check=${Date.now()}`, {
    cache: 'no-store',
    headers: { 'cache-control': 'no-cache' },
  });
  if (!response.ok) throw new Error(`${endpoint} returned HTTP ${response.status}`);
  return response.json();
}

async function verifyEndpoint(endpoint, attempts, delayMs) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const health = await fetchHealth(endpoint);
      if (health?.status !== 'ok') throw new Error(`status=${health?.status || 'missing'}`);
      if (health?.judgmentEngine !== EXPECTED_ENGINE) {
        throw new Error(`judgmentEngine=${health?.judgmentEngine || 'missing'}`);
      }
      if (health?.deploymentRevision !== EXPECTED_REVISION) {
        throw new Error(`deploymentRevision=${health?.deploymentRevision || 'missing'}`);
      }
      console.log(`Verified ${endpoint}: ${EXPECTED_ENGINE} / ${EXPECTED_REVISION}`);
      return;
    } catch (error) {
      lastError = error;
      console.log(`Deployment check ${attempt}/${attempts} failed for ${endpoint}: ${error.message}`);
      if (attempt < attempts) await sleep(delayMs);
    }
  }
  throw new Error(`Deployment verification failed for ${endpoint}: ${lastError?.message || 'unknown error'}`);
}

async function main() {
  const endpoints = process.argv.slice(2).filter(Boolean);
  if (!endpoints.length) throw new Error('At least one health endpoint is required.');
  const attempts = Math.max(1, Number(process.env.VERIFY_ATTEMPTS || DEFAULT_ATTEMPTS));
  const delayMs = Math.max(0, Number(process.env.VERIFY_DELAY_MS || DEFAULT_DELAY_MS));
  for (const endpoint of endpoints) await verifyEndpoint(endpoint, attempts, delayMs);
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
