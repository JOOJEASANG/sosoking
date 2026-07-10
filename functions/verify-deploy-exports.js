const fs = require('node:fs');
const path = require('node:path');

const workflowPath = path.resolve(__dirname, '../.github/workflows/firebase-deploy.yml');
const workflow = fs.readFileSync(workflowPath, 'utf8');
const deployed = new Set(
  [...workflow.matchAll(/functions:([A-Za-z0-9_]+)/g)].map(match => match[1])
);

const exported = Object.keys(require('./main.js'))
  .filter(name => typeof name === 'string' && name.length > 0)
  .sort();

const missing = exported.filter(name => !deployed.has(name));
const unknown = [...deployed].filter(name => !exported.includes(name)).sort();

if (missing.length || unknown.length) {
  if (missing.length) {
    console.error(`Functions exported but not deployed: ${missing.join(', ')}`);
  }
  if (unknown.length) {
    console.error(`Functions listed for deploy but not exported: ${unknown.join(', ')}`);
  }
  process.exit(1);
}

console.log(`Verified ${exported.length} exported Firebase Functions.`);
