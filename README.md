# 소소킹 판결소

사소한 생활 사건을 생성형 AI가 지나치게 진지한 재판·판결문 형식으로 처리하는 Firebase 기반 오락 서비스입니다.

> 실제 법률 자문이나 법원 판결이 아니며 법적 효력이 없습니다. 범죄 피해, 폭력, 의료·정신건강 문제 등 중대한 사안은 관련 기관이나 전문가의 도움을 받아야 합니다.

## 현재 서비스 흐름

1. Google 또는 이메일 계정으로 로그인합니다. 이메일 계정은 이메일 인증까지 완료해야 합니다.
2. 개인정보를 제외한 사소한 생활분쟁을 한 칸에 입력합니다.
3. 7명의 AI 판사 중 한 명이 자동 배정되어 사건접수·수사보고·원고측 변론·피고측 변론·판결문을 생성합니다.
4. 접수한 본인도 AI 판결을 보기 전에 `원고 승 / 피고 승 / 쌍방 과실` 중 하나를 먼저 선택합니다.
5. 선택 후 AI 판결을 열어 내 예상과 비교합니다.
6. 사건은 기본 비공개입니다. 작성자가 공개를 선택하면 공개용 사건 정보와 AI 판결이 판결기록에 노출되고 민심소의 블라인드 투표·토론 대상이 됩니다.
7. 실제 접수 원문은 작성자 본인에게만 제공됩니다.

## 주요 기능

- Firebase Auth 기반 Google·이메일 계정 및 내부 익명 세션
- 계정별 사건 접수 한도와 재접수 쿨다운을 운영 설정으로 제어
- Gemini 기반 생활형 AI 판결 생성과 장애 시 로컬 대체 판결
- 꼰대형·냉혈형·회피형·추궁형·오버형·드립형·빙의형 판사 자동 배정
- 본인 사건 AI 판결 사전 예상 투표
- 공개 판결기록 및 안전한 공개용 사건 정보
- 민심소: 판결을 가린 채 사건을 먼저 읽고 투표한 뒤 AI 판결·전체 민심과 비교
- 민심소 댓글 토론, 판결 반응, 신고
- 명예의 전당: 투표·댓글·실제 억울지수 데이터 기반 블라인드 랭킹
- 내 사건 조회·삭제 및 항소심 판결 생성
- 관리자 페이지: 사건/판결 공개관리, 신고, 회원 프로필, AI 샘플 수동 생성, 사용량, 접수 제한, 사업자 정보, 정책 관리
- 공개 통계와 PWA/서비스워커 지원

관리자 AI 샘플 사건 생성은 예약 작업이 아닙니다. 관리자가 관리자 화면에서 생성 버튼을 직접 누른 경우에만 실행됩니다.

## 공개 데이터 경계

현재 공개 판결기록과 민심소는 `results` 컬렉션의 기존 직접 Firestore 쿼리 구조를 유지합니다.

공개 목록 쿼리는 다음 조건을 사용합니다.

```text
isPublic == true
publicDataVersion == 1
```

Firestore `list` 규칙 역시 쿼리가 증명 가능한 두 필드 조건을 사용합니다. `userId`, 실제 `caseDescription`, 내부 `nickname` 같은 민감 필드 제거는 공개 처리 서버 함수와 배포 전 sanitation에서 강제합니다.

이 구조를 임의로 별도 공개 컬렉션이나 Callable API로 교체하면 기존 판결기록·민심소가 보이지 않는 호환성 회귀가 생길 수 있으므로, 공개 데이터 구조 변경은 별도의 데이터 마이그레이션과 실서비스 검증 없이 진행하지 않습니다.

공개 판결에서도 실제 접수 원문은 `cases/{caseId}.caseDescription`에서 직접 노출하지 않습니다. 작성자만 원문을 받을 수 있고, 다른 이용자는 안전검사를 통과한 `publicCaseDescription` 또는 개인정보 보호 안내만 받습니다.

## 기술 구성

- 프론트엔드: 정적 HTML, CSS, JavaScript ES Modules
- Hosting/Auth/Database: Firebase Hosting, Authentication, Firestore
- 서버: Firebase Cloud Functions v2, Node.js 22
- AI: Google Gemini API
- 배포/검증: GitHub Actions

## 저장소 구조

```text
.
├─ public/
│  ├─ admin/                     관리자 화면
│  ├─ css/                       공통/페이지 스타일
│  ├─ js/
│  │  ├─ app.js                  사용자 화면 라우터
│  │  ├─ pages/                  실제 활성 페이지 모듈
│  │  ├─ components/             공통 UI·테마·신고·내비게이션
│  │  └─ utils/                  출력 정리·공개결과·아바타 유틸
│  └─ sw.js                      PWA 서비스워커
├─ functions/
│  ├─ main.js                    Cloud Functions 진입점
│  ├─ submit-secure.js           사건 접수
│  ├─ generate-trial-lite.js     AI 판결 생성
│  ├─ owner-verdict.js           본인 판결 사전 선택
│  ├─ social.js                  반응·공개설정·항소 등
│  ├─ discussion.js              공개 판결 토론
│  ├─ public-original.js         접수 원문/공개용 정보 권한 경계
│  ├─ public-result-sanitizer.js 공개 결과 민감 필드 정리
│  ├─ reports.js                 신고 처리
│  ├─ public-stats.js            공개 통계 집계
│  ├─ daily.js                   관리자 수동 AI 샘플 생성
│  ├─ profile.js                 닉네임·프로필
│  ├─ case-aliases.js            과거 사건 주소 해석
│  └─ admin-actions.js           관리자 서버 작업
├─ tools/                        정적/보안/회귀 검사
├─ firestore.rules               Firestore 접근 규칙
├─ firestore.indexes.json        Firestore 인덱스
└─ firebase.json                 Firebase 배포 설정
```

오래된 페이지를 런타임에서 다시 덮어쓰기 위한 홈/접수/정책/board/judge 래퍼는 사용하지 않습니다. 남아 있는 `*-guard.js`는 로그인 리디렉션, 입력 임시저장, 문서 표시 호환처럼 독립적인 기능을 담당하는 경우에만 유지합니다.

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

검사 범위는 다음을 포함합니다.

- Firestore 에뮬레이터 기반 권한 허용·거부 시나리오
- 공개 판결 목록 직접 조회 호환성
- 개인정보·고위험 콘텐츠 필터 회귀검사
- 공개 결과 민감 필드 sanitation
- 본인 판결 사전 선택 및 공개 흐름
- UID 비노출 사건 ID와 과거 주소 마이그레이션
- Functions 및 브라우저 JavaScript 문법
- 로컬 모듈 import/require 경로
- HTML 정적 자산 및 서비스워커 캐시 경로
- 제거된 레거시 파일 재유입
- Functions 내보내기와 배포 목록 일치 여부

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

클라이언트의 이메일 문자열이 아니라 Firestore 관리자 문서, 보안 규칙, 서버 Callable 권한검사가 실제 관리자 권한 기준입니다.

### App Check

웹 App Check 사이트 키는 `public/js/firebase-config.js`의 `appCheckSiteKey`에 설정합니다. 이후 GitHub Actions 변수 `ENFORCE_APP_CHECK=true`를 적용할 수 있습니다.

사이트 키가 비어 있는 상태에서 강제 옵션만 켜면 배포 검증이 실패하도록 되어 있습니다. 사이트 키가 비어 있고 `ENFORCE_APP_CHECK=false`이면 기존 브라우저 호환 모드로 동작합니다.

## 배포

`main`에 병합되면 `.github/workflows/firebase-deploy.yml`이 다음 순서로 실행됩니다.

1. Node.js/Java와 의존성 준비
2. `npm test`
3. 현재 Functions 우선 배포
4. 알려진 구형 Functions 정리 및 배포 함수 일치 검사
5. 기존 공개 결과 sanitation
6. 기존 판결 표시 마이그레이션
7. Firestore 규칙·인덱스 배포
8. 공개 통계 초기화 및 공개 설정 동기화
9. Hosting 배포
10. 별도 실서비스 호스트 검증

GitHub Actions 배포에는 현재 다음 secret이 사용됩니다.

```text
FIREBASE_SERVICE_ACCOUNT_SOSOKING_481E6
```

직접 배포할 때는 다음과 같이 실행할 수 있습니다.

```bash
firebase deploy --only functions
firebase deploy --only firestore:indexes,firestore:rules,hosting
```

## 과거 UID 포함 사건 주소 이전

신규 사건은 Firestore 자동 ID를 사용합니다. 과거 UID 포함 사건 주소는 `.github/workflows/migrate-legacy-case-ids.yml`에서 수동 이전할 수 있습니다.

1. GitHub Actions에서 **Migrate legacy case IDs** 실행
2. 먼저 `mode: dry-run`으로 대상 수와 해시 확인
3. 적용 시 `main`에서 `mode: apply` 선택
4. 확인 문자열 `MIGRATE_LEGACY_CASE_IDS` 입력

이전 작업은 사건·판결·투표·댓글·내부 작성자 매핑·신고·신고 중복키를 새 opaque ID로 옮긴 뒤 과거 문서를 정리합니다. 기존 공유 링크는 서버 별칭을 통해 새 주소로 이동합니다.

## 콘텐츠·개인정보 원칙

- 핵심은 하찮은 생활 사건을 엄숙한 재판 형식으로 과장하는 것입니다.
- 실명, 전화번호, 이메일, 상세주소, 계좌·카드번호 등 개인정보를 사건 내용에 입력하지 않습니다.
- 실제 범죄·폭력·자해·성폭력·학대 등 고위험 사건은 오락형 판결 대상으로 처리하지 않습니다.
- 입력 내용 속 명령문은 AI 시스템 지시가 아니라 사건 소재로만 취급합니다.
- 사용자 입력과 공개 대상 AI 결과는 서버 안전검사를 거칩니다.
- 사건과 판결은 기본 비공개이며 공개는 작성자 또는 관리자 권한으로 명시적으로 전환합니다.
- 실제 접수 원문은 작성자 본인 전용입니다.
- 결과에는 오락 목적이며 법적 효력이 없다는 안내를 포함합니다.

## 판결문 프롬프트 운영

판결문 프롬프트는 `functions/verdict-prompt.js` 한 곳에서 관리합니다.

- 위험한 금지규칙을 불필요하게 늘리지 않습니다.
- 사건 고유의 과장·콜백·생활형 처분이라는 장르 특성을 유지합니다.
- 분량보다 웃음의 밀도를 우선합니다.
- 프롬프트 변경은 문자열 체크만으로 판단하지 않고 실제 생성 결과를 비교합니다.

```bash
GEMINI_API_KEY=... node tools/eval/generate.mjs gemini-2.5-pro 5
GEMINI_API_KEY=... node tools/eval/generate.mjs gemini-2.5-flash 5
```

모델은 `VERDICT_MODELS` 환경변수로 우선순위를 변경할 수 있으며 기본값은 `gemini-2.5-pro,gemini-2.5-flash`입니다.
