import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("investigation v3 endpoint wiring is consistent", async () => {
  const [client, firebase, entry, server] = await Promise.all([
    read("public/court-v3.js"),
    read("firebase.json"),
    read("functions/index.js"),
    read("functions/gemini-court-investigation.js")
  ]);
  assert.match(client, /\/api\/generate-case/);
  assert.match(client, /X-Sosoking-Client"\s*:\s*"court-v3/);
  assert.match(firebase, /"source"\s*:\s*"\/api\/generate-case"/);
  assert.match(firebase, /"functionId"\s*:\s*"generateCourtCase"/);
  assert.match(firebase, /"runtime"\s*:\s*"nodejs22"/);
  assert.match(entry, /gemini-court-investigation/);
  assert.match(entry, /generateCourtCaseV3/);
  assert.match(server, /exports\.generateCourtCase/);
});

test("Gemini key remains server-side", async () => {
  const [client, server, workflow] = await Promise.all([
    read("public/court-v3.js"),
    read("functions/gemini-court-investigation.js"),
    read(".github/workflows/firebase-deploy.yml")
  ]);
  assert.doesNotMatch(client, /GEMINI_API_KEY|AIza[0-9A-Za-z_-]{20,}/);
  assert.match(server, /defineSecret\("GEMINI_API_KEY"\)/);
  assert.match(server, /@google\/genai/);
  assert.doesNotMatch(server, /api\.openai\.com|OPENAI_API_KEY|x-sosoking-debug|preview-eval/);
  assert.match(workflow, /secrets\.GEMINI_API_KEY/);
});

test("expanded investigation schema and quality controls exist", async () => {
  const server = await read("functions/gemini-court-investigation.js");
  for (const key of ["taskForceUnits", "dispatchLog", "surveillance", "forensicReports", "search", "briefing"]) {
    assert.match(server, new RegExp(key));
  }
  assert.match(server, /HarmCategory/);
  assert.match(server, /auditCourtCase/);
  assert.match(server, /PERSON_WITH_TITLE/);
  assert.match(server, /REAL_LEGAL_TERMS/);
  assert.match(server, /심문 답변자 역할/);
  assert.match(server, /thinkingBudget:\s*0/);
  assert.match(server, /maxOutputTokens:\s*7500/);
  assert.match(server, /국가과잉수사연구소/);
  assert.match(server, /잠복근무/);
});

test("frontend provides seven detailed interactive stages", async () => {
  const [index, client, css, icons, loading, loadingCss] = await Promise.all([
    read("public/index.html"),
    read("public/court-v3.js"),
    read("public/investigation.css"),
    read("public/investigation-icons.svg"),
    read("public/loading-operation.js"),
    read("public/loading-operation.css")
  ]);
  assert.match(index, /court-v3\.js/);
  assert.match(index, /investigation\.css/);
  assert.match(index, /loading-operation\.js/);
  assert.match(index, /loading-operation\.css/);
  assert.match(client, /사건 접수/);
  assert.match(client, /초동 출동/);
  assert.match(client, /잠복 수사/);
  assert.match(client, /과잉 감식/);
  assert.match(client, /피의자 신문/);
  assert.match(client, /공개 브리핑/);
  assert.match(client, /최종 판결/);
  assert.match(client, /data-evidence/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /\.evidence-envelope/);
  assert.match(icons, /id="binoculars"/);
  assert.match(icons, /id="flask"/);
  assert.match(loading, /초동출동팀 18명 호출/);
  assert.match(loading, /국가과잉수사연구소 감식 의뢰/);
  assert.match(loadingCss, /\.operation-loading/);
});

test("share card excludes the user's original incident", async () => {
  const client = await read("public/court-v3.js");
  const shareFunction = client.slice(client.indexOf("async function createShareCard"), client.indexOf("function shareStatus"));
  assert.match(shareFunction, /p\.title/);
  assert.match(shareFunction, /v\.sentence/);
  assert.doesNotMatch(shareFunction, /state\.data\.incident|incidentInput/);
  assert.match(client, /navigator\.canShare/);
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
