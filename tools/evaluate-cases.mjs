import { readFile } from "node:fs/promises";
import process from "node:process";

const baseUrl = (process.env.COURT_BASE_URL || process.argv[2] || "").replace(/\/$/, "");
const offset = Math.max(0, Math.min(19, Number(process.env.COURT_EVAL_OFFSET || 0)));
const limit = Math.max(1, Math.min(20 - offset, Number(process.env.COURT_EVAL_LIMIT || 20)));
if (!baseUrl) {
  console.error("COURT_BASE_URL 또는 첫 번째 인자로 Firebase 미리보기 주소를 지정하세요.");
  process.exit(1);
}

const corpus = JSON.parse(await readFile(new URL("../tests/case-corpus.json", import.meta.url), "utf8"));

function normalized(value) {
  return String(value || "").replace(/[\s.,!?"'“”‘’()[\]{}:;·-]/g, "").toLowerCase();
}

function duplicate(items) {
  const values = items.map(normalized);
  return values.some((value) => !value) || new Set(values).size !== values.length;
}

function inspect(data) {
  const issues = [];
  if (!String(data?.title || "").endsWith("사건")) issues.push("사건명");
  const exactCounts = {
    taskForceUnits: 4,
    dispatchLog: 4,
    forensicReports: 3,
    evidence: 4,
    questions: 3,
    verdicts: 3,
    judgeTypes: 3
  };
  for (const [key, count] of Object.entries(exactCounts)) {
    if (!Array.isArray(data?.[key]) || data[key].length !== count) issues.push(`${key}:${count}개아님`);
  }
  for (const key of ["surveillance", "search", "briefing"]) {
    if (!data?.[key] || typeof data[key] !== "object") issues.push(`${key}:누락`);
  }
  if (Array.isArray(data?.evidence) && duplicate(data.evidence.map((item) => item?.title))) issues.push("증거중복");
  if (Array.isArray(data?.forensicReports) && duplicate(data.forensicReports.map((item) => item?.sample))) issues.push("감식중복");
  if (Array.isArray(data?.questions) && duplicate(data.questions.map((item) => item?.question))) issues.push("심문중복");
  if (Array.isArray(data?.verdicts)) {
    if (duplicate(data.verdicts.map((item) => item?.title))) issues.push("판결중복");
    if (duplicate(data.verdicts.map((item) => item?.afterStory))) issues.push("후일담중복");
  }
  return issues;
}

const selected = corpus.slice(offset, offset + limit);
const rows = [];
for (const [index, item] of selected.entries()) {
  const started = performance.now();
  try {
    const response = await fetch(`${baseUrl}/api/generate-case`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sosoking-Client": "court-v3"
      },
      body: JSON.stringify(item)
    });
    const body = await response.json().catch(() => ({}));
    const latencyMs = Math.round(performance.now() - started);
    const issues = response.ok && body.case ? inspect(body.case) : [body?.error || `HTTP ${response.status}`];
    rows.push({
      no: offset + index + 1,
      ok: issues.length === 0,
      latencyMs,
      title: body.case?.title || "-",
      operation: body.case?.operationName || "-",
      issues: issues.join(", ") || "-"
    });
  } catch (error) {
    rows.push({
      no: offset + index + 1,
      ok: false,
      latencyMs: Math.round(performance.now() - started),
      title: "-",
      operation: "-",
      issues: error.message
    });
  }
}

console.table(rows);
const passed = rows.filter((row) => row.ok).length;
const average = Math.round(rows.reduce((sum, row) => sum + row.latencyMs, 0) / rows.length);
console.log(`\n평가 범위 ${offset + 1}~${offset + rows.length} · 통과 ${passed}/${rows.length} · 평균 응답 ${average}ms`);
process.exitCode = passed === rows.length ? 0 : 1;
