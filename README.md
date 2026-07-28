# 소소킹 판결소

사소한 생활 사건을 AI가 지나치게 진지한 재판·판결문 형식으로 처리하는 Firebase 기반 오락 서비스입니다.

> 실제 법률 자문이나 법원 판결이 아니며 법적 효력이 없습니다. 범죄 피해, 폭력, 의료·정신건강 문제 등 중대한 사안은 관련 기관이나 전문가의 도움을 받아야 합니다.

## 주요 기능

- Firebase Auth 기반 익명·Google·이메일 로그인
- 사건 접수 및 계정별 일일 한도·재접수 쿨다운
- Gemini를 이용한 생활형 AI 판결 생성과 로컬 대체 판결
- 판사 성향 선택 및 재판 진행 화면
- 공개 판결기록, 반응, 방청석 댓글과 신고
- 내 사건 조회 및 항소심 판결 생성
- 매일 자동 생성되는 오늘의 AI 사건
- 관리자 페이지에서 사건, 회원, AI, 사용량, 사이트 설정 관리
- 서버 집계 공개 통계와 PWA 설치·서비스 워커 지원

## 기술 구성

- 프론트엔드: 정적 HTML, CSS, JavaScript ES Modules
- Hosting/Auth/Database: Firebase Hosting, Authentication, Firestore
- 서버: Firebase Cloud Functions v2, Node.js 22
- AI: Google Gemini API
- 배포: GitHub Actions

## 저장소 구조

```text
.
├─ public/                     Firebase Hosting 정적 파일
│  ├─ admin/                  관리자 화면
│  ├─ css/                    공통 스타일
│  └─ js/
│     ├─ components/          공통 UI·테마·PWA 모듈
│     ├─ pages/               화면별 라우트 모듈
│     └─ utils/               출력 정리·아바타 유틸
├─ functions/
│  ├─ main.js                 Cloud Functions 진입점
│  ├─ submit-secure.js        사건 접수
│  ├─ generate-trial-lite.js  AI 판결 생성
│  ├─ daily.js                오늘의 AI 사건
│  ├─ profile.js              닉네임·프로필
│  ├─ social.js               반응·댓글·항소
│  ├─ reports.js              신고 처리
│  ├─ public-stats.js         공개 통계 집계
│  ├─ case-aliases.js         과거 사건 주소 해석·관리자 이전 함수
│  ├─ legacy-case-migration.js 과거 UID 포함 사건 ID 이전 로직
│  └─ admin-actions.js        관리자 서버 작업
├─ tools/check-project.mjs    저장소 정적 검사
├─ firestore.rules            Firestore 접근 규칙
├─ firestore.indexes.json     Firestore 인덱스
└─ firebase.json              Firebase 배포 설정
```

`*-court.js`, `*-game.js`, `*-guard.js` 파일은 기본 페이지 모듈을 가져와 법정형 UI나 로그인 보호 동작을 추가하는 활성 래퍼입니다.

## 로컬 준비

Node.js 22 이상, Java 21 이상, Firebase CLI 15.24.0이 필요합니다.

```bash
npm install -g firebase-tools@15.24.0
npm ci
npm ci --prefix functions
```

Firebase 프로젝트는 `.firebaserc`의 `sosoking-481e6`을 기본값으로 사용합니다.

## 저장소 검사

```bash
npm test
```

검사 항목:

- Firestore 에뮬레이터 기반 보안 규칙 허용·거부 시나리오
- 개인정보·고위험 콘텐츠 서버 필터 회귀검사
- UID 비노출 사건 ID와 과거 주소 마이그레이션 안전장치
- Functions 및 브라우저 JavaScript 문법
- 로컬 모듈 import/require 경로
- HTML 정적 자산 경로와 서비스워커 캐시 버전
- 주요 JSON 파일 형식
- 제거된 구형 파일의 재유입
- Functions 이름 중복 내보내기
- GitHub Actions 배포 함수 목록과 실제 내보내기의 일치 여부

## Firebase 설정

Gemini API 키는 Functions Secret으로 등록합니다.

```bash
firebase functions:secrets:set GEMINI_API_KEY
```

관리자 권한은 Firestore에 아래 문서 중 하나를 생성해 부여합니다.

```text
admins/{Firebase Auth UID}
admins/{로그인 이메일}
```

클라이언트 코드의 이메일 문자열이 아니라 Firestore 관리자 문서와 보안 규칙, 서버 Callable 검사를 실제 권한 기준으로 사용합니다.

### App Check

웹 App Check 사이트 키를 `public/js/firebase-config.js`의 `appCheckSiteKey`에 설정한 뒤 GitHub Actions 변수 `ENFORCE_APP_CHECK=true`를 적용합니다. 사이트 키가 비어 있는 상태에서 강제 옵션만 켜면 배포 검증이 실패하도록 보호되어 있습니다.

## 배포

`main` 브랜치에 병합되면 `.github/workflows/firebase-deploy.yml`이 다음 순서로 실행됩니다.

1. Node.js 22와 Java 21 설정
2. Functions 및 검증 의존성 `npm ci` 설치
3. `npm test`
4. 현재 사용 중인 Functions 우선 배포
5. 공개 통계 초기화
6. Firestore 규칙·인덱스와 Hosting 배포
7. 공개 가능한 사이트 설정만 `site_public/config`에 동기화

Functions를 먼저 배포해 새 프론트엔드와 강화된 보안 규칙이 구형 백엔드 함수보다 먼저 활성화되는 부분 배포 위험을 줄입니다.

GitHub Actions secret이 필요합니다.

```text
FIREBASE_SERVICE_ACCOUNT_SOSOKING_481E6
```

직접 배포할 때는 다음 명령을 사용할 수 있습니다.

```bash
firebase deploy --only functions
firebase deploy --only firestore:indexes,firestore:rules,hosting
```

## 과거 UID 포함 사건 주소 이전

신규 사건은 Firestore 자동 ID를 사용하므로 공개 주소에 Firebase UID가 포함되지 않습니다. 과거 형식의 완료 사건은 `.github/workflows/migrate-legacy-case-ids.yml`에서 수동으로 이전합니다.

1. GitHub Actions에서 **Migrate legacy case IDs** 실행
2. 먼저 `mode: dry-run`으로 대상 수와 해시값 확인
3. 적용 시 `main` 브랜치에서 `mode: apply` 선택
4. 확인 문자열에 `MIGRATE_LEGACY_CASE_IDS` 입력

이전 작업은 사건·판결·투표·댓글·댓글 작성자 내부 매핑·신고·신고 중복키를 새 opaque ID로 복사한 후 과거 문서를 삭제합니다. 과거 ID 원문은 별칭 문서에 저장하지 않고 SHA-256 해시만 보관합니다. 기존 공유 링크는 서버 별칭을 통해 새 주소로 이동합니다.

같은 작업은 관리자 Callable `migrateLegacyCaseIds`에서도 실행할 수 있지만 기본값은 항상 dry-run이며 실제 적용에는 동일한 확인 문자열이 필요합니다.

## 콘텐츠 원칙

- 핵심은 하찮은 생활 사건을 엄숙한 재판 형식으로 과장하는 것입니다.
- 실제 인물의 개인정보, 정치·혐오·성적 내용, 실제 범죄 묘사는 피합니다.
- 입력 내용 안의 명령문은 AI 지시가 아니라 사건 소재로만 취급합니다.
- 사용자 입력과 AI 생성 결과를 저장·전송·공개하기 전 안전검사합니다.
- 결과에는 오락 목적이며 법적 효력이 없다는 안내를 포함합니다.

## 정리 내역

ZIP 복원, 중복·미사용 코드 제거, Functions 엔트리 정리와 권한 검토 결과는 [`docs/REPOSITORY_AUDIT.md`](docs/REPOSITORY_AUDIT.md)에 기록되어 있습니다.
