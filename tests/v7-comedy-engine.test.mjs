import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("V7 keeps the automatic read-only story flow", async () => {
  const [index, client, baseCss, comedyCss] = await Promise.all([
    read("public/index.html"),
    read("public/auto-story-v7.js"),
    read("public/auto-story-v6.css"),
    read("public/comedy-v7.css")
  ]);
  assert.match(index, /auto-story-v7\.js/);
  assert.match(index, /comedy-v7\.css/);
  assert.doesNotMatch(index, /auto-story-v6\.js/);
  for (const stage of ["stage-intake", "stage-initial", "stage-over", "stage-interrogation", "stage-referral", "stage-settlement", "stage-trial", "stage-judgment"]) {
    assert.match(index, new RegExp(stage));
  }
  assert.doesNotMatch(index, /data-room=|data-verdict=|data-disguise=|data-court-evidence=/);
  assert.doesNotMatch(client, /data-room|data-verdict|data-disguise|data-court-evidence/);
  assert.match(client, /X-Sosoking-Client": "court-v7/);
  assert.match(baseCss, /story-rail/);
  assert.match(comedyCss, /comic-dna/);
  assert.match(comedyCss, /stage-punchline/);
});

test("V7.1 generates a comedy profile, eight beats, and a final callback", async () => {
  const [entry, server, client] = await Promise.all([
    read("functions/index.js"),
    read("functions/gemini-comedy-case-v7b.js"),
    read("public/auto-story-v7.js")
  ]);
  assert.match(entry, /gemini-comedy-case-v7b/);
  assert.match(entry, /generateCourtCaseV7/);
  for (const field of ["centralMisread", "runningGag", "escalationRule", "finalCallback", "comicProfile", "comicBeats"]) {
    assert.match(server, new RegExp(field));
    assert.match(client, new RegExp(field));
  }
  for (const beat of ["intake", "initialInvestigation", "overInvestigation", "interrogation", "referral", "settlement", "trial", "judgment"]) {
    assert.match(server, new RegExp(beat));
  }
  assert.match(server, /new Set\(Object\.values/);
  assert.match(server, /normalizeCase/);
  assert.match(client, /기록관 주석/);
  assert.match(client, /처음의 반복 개그가 돌아온 긴급속보/);
});

test("V7.1 prioritizes the real subject over locations and mixed secondary items", async () => {
  const server = await read("functions/gemini-comedy-case-v7b.js");
  assert.match(server, /const duration = incident\.match/);
  assert.match(server, /const missingObject = incident\.match\(\/리모컨/);
  assert.match(server, /if \(timeCase\)/);
  assert.match(server, /if \(missingCase\)/);
  assert.match(server, /if \(foodCase\)/);
  assert.ok(server.indexOf("if (timeCase)") < server.indexOf("if (foodCase)"));
  assert.match(server, /category: "time"/);
  assert.match(server, /primary: missingObject/);
  assert.match(server, /particle\(profile\.runningGag/);
});

test("V7.1 replaces repetitive stock jokes without discarding an otherwise valid Gemini story", async () => {
  const server = await read("functions/gemini-comedy-case-v7b.js");
  for (const phrase of ["마이크 7개", "3.7cm", "관심 없던 참고인", "사건은 작지만"]) {
    assert.match(server, new RegExp(phrase));
  }
  assert.match(server, /STALE_PHRASES/);
  assert.match(server, /replaceStale/);
  assert.match(server, /deepClean/);
  assert.match(server, /auditStructure/);
  assert.doesNotMatch(server, /접수 소재 연결/);
});

test("V7.1 protects input, keeps the API key server-side, and reports safe fallback diagnostics", async () => {
  const [client, server] = await Promise.all([
    read("public/auto-story-v7.js"),
    read("functions/gemini-comedy-case-v7b.js")
  ]);
  assert.doesNotMatch(client, /GEMINI_API_KEY|AIza[0-9A-Za-z_-]{20,}/);
  assert.match(server, /defineSecret\("GEMINI_API_KEY"\)/);
  assert.match(server, /PRIVATE_PATTERNS/);
  assert.match(server, /BLOCKED/);
  assert.match(server, /court-v7/);
  assert.match(server, /grounded-comedy-fallback/);
  assert.match(server, /fallbackReason/);
  assert.match(server, /replace\(\/AIza/);
});
