import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("AI endpoint wiring is consistent", async () => {
  const [client, firebase, entry, server] = await Promise.all([
    read("public/court-app.js"),
    read("firebase.json"),
    read("functions/index.js"),
    read("functions/gemini-court-runtime.js")
  ]);
  assert.match(client, /\/api\/generate-case/);
  assert.match(firebase, /"source"\s*:\s*"\/api\/generate-case"/);
  assert.match(firebase, /"functionId"\s*:\s*"generateCourtCase"/);
  assert.match(firebase, /"runtime"\s*:\s*"nodejs22"/);
  assert.match(entry, /gemini-court-runtime/);
  assert.match(server, /exports\.generateCourtCase/);
});

test("Gemini key remains server-side and preview diagnostics are absent", async () => {
  const [client, share, server, workflow] = await Promise.all([
    read("public/court-app.js"),
    read("public/share-polish.js"),
    read("functions/gemini-court-runtime.js"),
    read(".github/workflows/firebase-deploy.yml")
  ]);
  assert.doesNotMatch(`${client}\n${share}`, /GEMINI_API_KEY|AIza[0-9A-Za-z_-]{20,}/);
  assert.match(server, /defineSecret\("GEMINI_API_KEY"\)/);
  assert.match(server, /@google\/genai/);
  assert.doesNotMatch(server, /api\.openai\.com|OPENAI_API_KEY|x-sosoking-debug|preview-eval/);
  assert.match(workflow, /secrets\.GEMINI_API_KEY/);
  assert.match(workflow, /functions:secrets:set GEMINI_API_KEY/);
});

test("Gemini structured output, safety and no-thinking mode exist", async () => {
  const [client, server] = await Promise.all([
    read("public/court-app.js"),
    read("functions/gemini-court-runtime.js")
  ]);
  assert.match(client, /privatePatterns/);
  assert.match(server, /HarmCategory/);
  assert.match(server, /HarmBlockThreshold/);
  assert.match(server, /auditCourtCase/);
  assert.match(server, /PRIVATE_PATTERNS/);
  assert.match(server, /BLOCKED/);
  assert.match(server, /responseMimeType:\s*"application\/json"/);
  assert.match(server, /responseSchema:\s*buildResponseSchema\(Type\)/);
  assert.match(server, /Type\.OBJECT/);
  assert.match(server, /Type\.ARRAY/);
  assert.match(server, /Type\.STRING/);
  assert.match(server, /thinkingBudget:\s*0/);
  assert.match(server, /maxOutputTokens:\s*5000/);
  assert.match(server, /maxInstances:\s*5/);
});

test("share cards exclude the original incident and adapt to long text", async () => {
  const [client, enhanced] = await Promise.all([
    read("public/court-app.js"),
    read("public/share-polish.js")
  ]);
  const legacyShare = client.slice(client.indexOf("async function createShareCardBlob"), client.indexOf("function setShareStatus"));
  assert.doesNotMatch(legacyShare, /state\.data\.incident/);
  assert.doesNotMatch(enhanced, /incidentInput|state\.data\.incident/);
  assert.match(enhanced, /canvas\.height\s*=\s*Math\.max/);
  assert.match(enhanced, /lineBreaks/);
  assert.match(enhanced, /navigator\.canShare/);
  assert.match(client, /결과 카드 저장/);
  assert.match(client, /판결 공유/);
});

test("mobile layout includes safe areas, touch targets and sticky navigation", async () => {
  const [index, css] = await Promise.all([
    read("public/index.html"),
    read("public/polish.css")
  ]);
  assert.match(index, /viewport-fit=cover/);
  assert.match(index, /polish\.css/);
  assert.match(index, /share-polish\.js/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /touch-action:\s*manipulation/);
  assert.match(css, /\.stage-list\s*\{[\s\S]*position:\s*sticky/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
});

test("twenty-case evaluation corpus is safe and usable", async () => {
  const corpus = JSON.parse(await read("tests/case-corpus.json"));
  assert.equal(corpus.length, 20);
  const allowed = new Set(["official", "special", "national"]);
  for (const item of corpus) {
    assert.ok(item.incident.length >= 7 && item.incident.length <= 120);
    assert.ok(allowed.has(item.severity));
  }
});

test("frontend loads only the current runtime assets", async () => {
  const index = await read("public/index.html");
  assert.match(index, /court-app\.js/);
  assert.match(index, /visual\.js/);
  assert.match(index, /share-polish\.js/);
  assert.match(index, /ai\.css/);
  assert.match(index, /polish\.css/);
  assert.doesNotMatch(index, /src=["']\.\/app\.js["']/);
});