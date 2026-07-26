import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("AI endpoint wiring is consistent", async () => {
  const [client, firebase, entry, server] = await Promise.all([
    read("public/court-app.js"),
    read("firebase.json"),
    read("functions/index.js"),
    read("functions/gemini-court-v2.js")
  ]);
  assert.match(client, /\/api\/generate-case/);
  assert.match(firebase, /"source"\s*:\s*"\/api\/generate-case"/);
  assert.match(firebase, /"functionId"\s*:\s*"generateCourtCase"/);
  assert.match(firebase, /"runtime"\s*:\s*"nodejs22"/);
  assert.match(entry, /gemini-court-v2/);
  assert.match(server, /exports\.generateCourtCase/);
});

test("Gemini key remains server-side", async () => {
  const [client, server, workflow] = await Promise.all([
    read("public/court-app.js"),
    read("functions/gemini-court-v2.js"),
    read(".github/workflows/firebase-deploy.yml")
  ]);
  assert.doesNotMatch(client, /GEMINI_API_KEY|AIza[0-9A-Za-z_-]{20,}/);
  assert.match(server, /defineSecret\("GEMINI_API_KEY"\)/);
  assert.match(server, /@google\/genai/);
  assert.doesNotMatch(server, /api\.openai\.com|OPENAI_API_KEY/);
  assert.match(workflow, /secrets\.GEMINI_API_KEY/);
  assert.match(workflow, /functions:secrets:set GEMINI_API_KEY/);
});

test("Gemini Type schema and safety layers exist", async () => {
  const [client, server] = await Promise.all([
    read("public/court-app.js"),
    read("functions/gemini-court-v2.js")
  ]);
  assert.match(client, /privatePatterns/);
  assert.match(server, /HarmCategory/);
  assert.match(server, /HarmBlockThreshold/);
  assert.match(server, /auditCourtCase/);
  assert.match(server, /PRIVATE_PATTERNS/);
  assert.match(server, /BLOCKED_TERMS/);
  assert.match(server, /responseMimeType:\s*"application\/json"/);
  assert.match(server, /responseSchema:\s*buildResponseSchema\(Type\)/);
  assert.match(server, /Type\.OBJECT/);
  assert.match(server, /Type\.ARRAY/);
  assert.match(server, /Type\.STRING/);
});

test("share card excludes the original incident", async () => {
  const client = await read("public/court-app.js");
  const shareFunction = client.slice(client.indexOf("async function createShareCardBlob"), client.indexOf("function setShareStatus"));
  assert.match(shareFunction, /p\.title/);
  assert.match(shareFunction, /verdict\[0\]/);
  assert.doesNotMatch(shareFunction, /state\.data\.incident/);
  assert.match(client, /결과 카드 저장/);
  assert.match(client, /판결 공유/);
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

test("frontend loads the current runtime and share styles", async () => {
  const index = await read("public/index.html");
  assert.match(index, /court-app\.js/);
  assert.match(index, /ai\.css/);
  assert.doesNotMatch(index, /src=["']\.\/app\.js["']/);
});
