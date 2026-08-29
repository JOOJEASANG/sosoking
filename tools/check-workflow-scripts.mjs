// 워크플로와 package.json이 존재하지 않는 스크립트를 부르지 않는지 검사한다.
//
// hosting-only-deploy.yml이 오래전에 사라진 check-dripso-*.mjs 두 개를 계속
// 부르고 있었다. 배포가 MODULE_NOT_FOUND로 죽기 전까지 아무도 몰랐다.
// 참조와 실제 파일이 어긋나는 것을 CI에서 먼저 잡는다.

import fs from 'node:fs';
import path from 'node:path';

const errors = [];
const workflowDir = '.github/workflows';

function referencedScripts(text) {
  return [...text.matchAll(/node\s+(tools\/[\w./-]+\.mjs|functions\/[\w./-]+\.js)/g)].map(match => match[1]);
}

for (const file of fs.readdirSync(workflowDir).filter(name => name.endsWith('.yml'))) {
  const full = path.join(workflowDir, file);
  for (const script of referencedScripts(fs.readFileSync(full, 'utf8'))) {
    if (!fs.existsSync(script)) {
      errors.push(`${full}: 존재하지 않는 스크립트를 실행합니다 — ${script}`);
    }
  }
}

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
for (const [name, command] of Object.entries(pkg.scripts || {})) {
  for (const script of referencedScripts(command)) {
    if (!fs.existsSync(script)) {
      errors.push(`package.json scripts.${name}: 존재하지 않는 스크립트를 실행합니다 — ${script}`);
    }
  }
}

if (errors.length > 0) {
  console.error('워크플로 스크립트 참조 검사 실패:');
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

console.log('워크플로 스크립트 참조 검사 통과: 모든 참조가 실제 파일과 일치합니다.');
