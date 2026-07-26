import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("AI endpoint wiring is consistent", async () => {
  const [client, firebase, server] = await Promise.all([
    read("public/court-app.js"),
    read("firebase.json"),
    read("functions/index.js")
  ]);
  assert.match(client, /\/api\/generate-case/);
  assert.match(firebase, /"source"\s*:\s*"\/api\/generate-case"/);
  assert.match(firebase, /"functionId"\s*:\s*"generateCourtCase"/);
  assert.match(server, /exports\.generateCourtCase/);
});

test("API key remains server-side", async () => {
  const [client, server] = await Promise.all([read("public/court-app.js"), read("functions/index.js")]);
  assert.doesNotMatch(client, /OPENAI_API_KEY|sk-[A-Za-z0-9]/);
  assert.match(server, /defineSecret\("OPENAI_API_KEY"\)/);
  assert.match(server, /store: false/);
});

test("safety and moderation layers exist", async () => {
  const [client, server] = await Promise.all([read("public/court-app.js"), read("functions/index.js")]);
  assert.match(client, /privatePatterns/);
  assert.match(server, /omni-moderation-latest/);
  assert.match(server, /auditCourtCase/);
  assert.match(server, /PRIVATE_PATTERNS/);
  assert.match(server, /BLOCKED_TERMS/);
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
