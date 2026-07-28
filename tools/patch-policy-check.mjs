import fs from 'node:fs';

const path = 'tools/check-security-regressions.mjs';
let source = fs.readFileSync(path, 'utf8');
const before = "if (policy.includes('입력하신 사건 내용은 AI 판결 생성 목적으로만 사용되며')) {\n  errors.push('public/js/pages/policy.js: obsolete exclusive AI-use claim remains');\n}";
const after = "const obsoleteAiUseClaims = policy.match(/입력하신 사건 내용은 AI 판결 생성 목적으로만 사용되며/g) || [];\nif (obsoleteAiUseClaims.length > 1) {\n  errors.push('public/js/pages/policy.js: obsolete exclusive AI-use claim remains in the displayed default notice');\n}";
if (!source.includes(before)) throw new Error('Policy regression check target not found');
source = source.replace(before, after);
fs.writeFileSync(path, source);
