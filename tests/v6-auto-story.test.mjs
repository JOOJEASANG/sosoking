import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("V6 is a read-only automatic case story", async () => {
  const [index, client, css] = await Promise.all([
    read("public/index.html"),
    read("public/auto-story-v6.js"),
    read("public/auto-story-v6.css")
  ]);
  assert.match(index, /auto-story-v6\.css/);
  assert.match(index, /auto-story-v6\.js/);
  for (const stage of ["stage-intake", "stage-initial", "stage-over", "stage-interrogation", "stage-referral", "stage-settlement", "stage-trial", "stage-judgment"]) {
    assert.match(index, new RegExp(stage));
  }
  assert.doesNotMatch(index, /data-room=|data-verdict=|data-disguise=|data-court-evidence=/);
  assert.doesNotMatch(client, /data-room|data-verdict|data-disguise|data-court-evidence/);
  assert.match(client, /X-Sosoking-Client": "court-v6/);
  assert.match(css, /story-rail/);
  assert.match(css, /settlement-flow/);
  assert.match(css, /judgment-box/);
});

test("V6 server schema includes the full real-world procedure", async () => {
  const [entry, server] = await Promise.all([
    read("functions/index.js"),
    read("functions/gemini-auto-case-story.js")
  ]);
  assert.match(entry, /generateCourtCaseV6/);
  for (const stage of ["intake", "initialInvestigation", "overInvestigation", "interrogation", "referral", "settlement", "trial", "judgment"]) {
    assert.match(server, new RegExp(stage));
  }
  assert.match(server, /합의·조정/);
  assert.match(server, /송치와 가상 기소/);
  assert.match(server, /evidenceArguments/);
  assert.match(server, /witnessExamination/);
  assert.match(server, /fallbackCase/);
  assert.match(server, /anchorCase/);
  assert.match(server, /thinkingBudget: 0/);
});

test("V6 keeps API keys server-side and protects input", async () => {
  const [client, server] = await Promise.all([
    read("public/auto-story-v6.js"),
    read("functions/gemini-auto-case-story.js")
  ]);
  assert.doesNotMatch(client, /GEMINI_API_KEY|AIza[0-9A-Za-z_-]{20,}/);
  assert.match(server, /defineSecret\("GEMINI_API_KEY"\)/);
  assert.match(server, /PRIVATE_PATTERNS/);
  assert.match(server, /BLOCKED/);
  assert.match(server, /court-v6/);
});

test("V6 fallback remains grounded in the original incident", async () => {
  const [client, server] = await Promise.all([
    read("public/auto-story-v6.js"),
    read("functions/gemini-auto-case-story.js")
  ]);
  assert.match(client, /localFallback\(incident\)/);
  assert.match(client, /originalIncident: incident/);
  assert.match(server, /result\.originalIncident = incident/);
  assert.match(server, /result\.intake\.complaint = incident/);
  assert.match(server, /result\.judgment\.order = ensureAnchor/);
});
