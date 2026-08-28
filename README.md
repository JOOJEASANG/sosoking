# sosoking

Firebase 프로젝트 `sosoking-481e6` 위에서 새로 시작하는 프로젝트입니다.
이전 파티게임 앱 코드는 모두 비웠고, 배포 파이프라인과 설정만 남겼습니다.

## 구조

| 경로 | 역할 |
| --- | --- |
| `public/` | Firebase Hosting 정적 파일. 현재는 자리표시 페이지만 있습니다. |
| `functions/` | Cloud Functions. 배포 대상 함수는 아직 없습니다. |
| `firestore.rules` | Firestore 보안 규칙. 기본값은 전체 차단입니다. |
| `firestore.indexes.json` | Firestore 색인 정의. 비어 있습니다. |
| `tools/check-site.mjs` | Hosting 산출물과 규칙에 대한 최소 검증 스크립트. |

## 개발

```bash
npm ci
npm run check
```

로컬에서 미리보기:

```bash
npx firebase-tools serve --only hosting
```

## 배포

| 워크플로 | 트리거 | 하는 일 |
| --- | --- | --- |
| `validate-pr.yml` | `main` 대상 PR | `npm test` 실행 |
| `firebase-deploy.yml` | `main` 푸시 / 수동 | 검증 후 Firestore 규칙·색인과 Hosting 배포 |
| `hosting-only-deploy.yml` | 수동 | Hosting만 배포 |
| `verify-live-hosting.yml` | 배포 성공 후 | 운영 도메인이 정상 응답하는지 확인 |

배포에는 저장소 시크릿 `FIREBASE_SERVICE_ACCOUNT_SOSOKING_481E6`가 필요합니다.

## 새 앱을 붙일 때 확인할 것

- `firestore.rules`는 전체 차단 상태입니다. 사용할 컬렉션마다 규칙을 명시적으로 추가하세요.
- `public/robots.txt`가 전체 크롤링을 막고 있습니다. 실제 서비스를 공개할 때 해제하세요.
- Cloud Functions를 추가하면 `functions/main.js`에서 export 하고,
  `firebase-deploy.yml`에 Functions 배포 단계를 다시 넣으세요.
- `public/index.html`의 `noindex` 메타 태그도 공개 시점에 제거해야 합니다.
