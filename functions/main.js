const { initializeApp, getApps } = require('firebase-admin/app');

if (!getApps().length) {
  initializeApp();
}

Object.assign(exports, require('./daily'));
Object.assign(exports, require('./profile'));
Object.assign(exports, require('./social'));
Object.assign(exports, require('./submit-secure'));
Object.assign(exports, require('./title-suggestion'));
Object.assign(exports, require('./generate-trial-lite'));
Object.assign(exports, require('./admin-actions'));
Object.assign(exports, require('./repair'));

// 보안·운영 안정성 보강판을 마지막에 로드해 기존 동일 함수명을 덮어쓴다.
// 기존 파일은 보존하되 배포 시 아래 구현이 실제 callable function으로 노출된다.
Object.assign(exports, require('./security-patches'));
