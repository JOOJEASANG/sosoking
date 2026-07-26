import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("V4 endpoint wiring remains server-side", async () => {
  const [client, relevance, firebase, entry, server] = await Promise.all([
    read("public/v4-runtime.js"),
    read("public/incident-relevance-v5.js"),
    read("firebase.json"),
    read("functions/index.js"),
    read("functions/gemini-court-investigation.js")
  ]);
  assert.match(client, /\/api\/generate-case/);
  assert.match(relevance, /\/api\/generate-case/);
  assert.doesNotMatch(client + relevance, /GEMINI_API_KEY|AIza[0-9A-Za-z_-]{20,}/);
  assert.match(firebase, /"functionId"\s*:\s*"generateCourtCase"/);
  assert.match(entry, /gemini-court-investigation/);
  assert.match(server, /defineSecret\("GEMINI_API_KEY"\)/);
  assert.match(server, /court-v4/);
});

test("V4 replaces linear next-button flow with six selectable rooms", async () => {
  const [index, client, css] = await Promise.all([
    read("public/index.html"),
    read("public/v4-runtime.js"),
    read("public/command-center-v4.css")
  ]);
  assert.match(index, /command-center-v4\.css/);
  assert.match(index, /incident-relevance-v5\.js/);
  assert.match(index, /v4-runtime\.js/);
  assert.ok(index.indexOf("incident-relevance-v5.js") < index.indexOf("v4-runtime.js"));
  assert.doesNotMatch(index, /court-v3\.js|next-button|stage-actions/);
  for (const room of ["field", "surveillance", "forensics", "interrogation", "briefing", "court"]) {
    assert.match(index, new RegExp(`data-room=["']${room}["']`));
    assert.match(client, new RegExp(`${room}`));
  }
  assert.match(client, /data-disguise/);
  assert.match(client, /data-evidence/);
  assert.match(client, /data-q/);
  assert.match(client, /data-tone/);
  assert.match(client, /data-court-evidence/);
  assert.match(client, /data-verdict/);
  assert.match(css, /grid-template-columns:260px minmax\(0,1fr\) 390px/);
  assert.match(css, /\.mobile-dock/);
  assert.match(css, /safe-area-inset-bottom/);
});

test("server enforces incident anchors across the whole investigation", async () => {
  const server = await read("functions/gemini-court-investigation.js");
  assert.match(server, /extractIncidentAnchors/);
  assert.match(server, /핵심 소재 단어\(철자 그대로 반복 사용\)/);
  assert.match(server, /접수 소재 사건명 미반영/);
  assert.match(server, /접수 소재 증거 연결 부족/);
  assert.match(server, /접수 소재 감식 연결 부족/);
  assert.match(server, /접수 소재 심문 연결 부족/);
  assert.match(server, /접수 소재 브리핑 미반영/);
  assert.match(server, /접수 소재 판결 연결 부족/);
  assert.match(server, /connectedItemCount\(data\.evidence, anchors\) < 2/);
  assert.match(server, /connectedItemCount\(data\.verdicts, anchors\) < 2/);
  assert.match(server, /version: "investigation-v5-relevance"/);
});

test("browser replaces unrelated or failed AI output with an incident-based case", async () => {
  const relevance = await read("public/incident-relevance-v5.js");
  assert.match(relevance, /function isRelevant/);
  assert.match(relevance, /function makeFallback/);
  assert.match(relevance, /hasAnchor\(courtCase\.title/);
  assert.match(relevance, /hasAnchor\(courtCase\.forensicReports/);
  assert.match(relevance, /hasAnchor\(courtCase\.verdicts/);
  assert.match(relevance, /\$\{primary\} 현장 상태/);
  assert.match(relevance, /\$\{primary\} 공개 복구형/);
  assert.match(relevance, /incident-fallback/);
  assert.match(relevance, /접수 내용 관련성이 낮은 AI 기록/);
});

test("V4 has comedy loading, fallback case and share support", async () => {
  const client = await read("public/v4-runtime.js");
  assert.match(client, /현장요원 14명 호출/);
  assert.match(client, /마이크 7개 설치/);
  assert.match(client, /function demo/);
  assert.match(client, /navigator\.share/);
  assert.doesNotMatch(client, /state\.incident[^\n]*navigator\.share/);
});

test("expanded investigation schema and safety controls remain", async () => {
  const server = await read("functions/gemini-court-investigation.js");
  for (const key of ["taskForceUnits", "dispatchLog", "surveillance", "forensicReports", "search", "briefing"]) {
    assert.match(server, new RegExp(key));
  }
  assert.match(server, /HarmCategory/);
  assert.match(server, /auditCourtCase/);
  assert.match(server, /thinkingBudget:\s*0/);
});

test("twenty-case evaluation corpus remains usable", async () => {
  const corpus = JSON.parse(await read("tests/case-corpus.json"));
  assert.equal(corpus.length, 20);
  const allowed = new Set(["official", "special", "national"]);
  for (const item of corpus) {
    assert.ok(item.incident.length >= 7 && item.incident.length <= 120);
    assert.ok(allowed.has(item.severity));
  }
});