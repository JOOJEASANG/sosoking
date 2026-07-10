# 소소킹 황당재판소

일상 속 소소한 억울함을 접수하면 AI가 **사건수사 → 생활증거 감식 → 원고·피고 주장 → 법정공방 → 황당판결**까지 진행하는 Firebase 기반 오락 서비스입니다.

실제 법률 상담이나 분쟁 해결 서비스가 아니며, 핵심 재미는 **사소한 사실을 끝까지 크게 키우는 정색한 과몰입 재판**입니다.

---

## 서비스 기준

### 핵심 콘셉트

- 판결문 한 장만 생성하지 않고 사건의 시작부터 최종 선고까지 한 편의 재판 경험으로 구성합니다.
- 사람 간 갈등뿐 아니라 모기, 리모컨, 마지막 만두처럼 사소한 대상도 피고가 될 수 있습니다.
- 입력이 하찮을수록 수사와 재판은 더 엄숙하고 구체적으로 진행합니다.
- 원고측 핵심 주장과 피고측 핵심 반박을 먼저 짧게 제시하고, 검사와 변호인이 이를 긴 변론으로 확대합니다.
- 결론은 공감 가능하며 실제로 해볼 수 있는 사건 맞춤형 황당 처분 3개로 마무리합니다.
- 긴급특보·상황실·통제선 표현은 사건을 크게 부풀리는 장치이며 정체성의 중심은 수사·공방·판결입니다.

### 다루지 않는 방향

- 실제 법률 서비스처럼 보이는 구성
- 정치·혐오·성적 내용·실제 범죄·개인정보 중심 콘텐츠
- 학교폭력·가정폭력·직장 내 괴롭힘·의료·정신건강·안전 문제를 오락처럼 소비하는 구성
- 특정인을 공격하거나 망신주기 위한 콘텐츠
- 욕설·비하·자극적인 표현에 의존하는 개그

---

## 사용자 흐름

1. **사건 접수** — 사건명, 사건 내용, 억울함 정도, 희망 처분과 재판부 성향을 입력합니다.
2. **초동수사** — AI가 사건 속 물건·행동·시간·사후 태도를 찾아 경위를 복원합니다.
3. **생활증거 감식** — 사소한 정황을 증거물처럼 지정하고 지나치게 정밀하게 분석합니다.
4. **원고·피고 주장** — 원고측 핵심 주장과 피고측 핵심 반박을 짧게 생성합니다.
5. **법정공방** — 검사와 변호인이 양측 논리를 장엄한 변론으로 확대합니다.
6. **재판부 심리** — AI 재판부가 사건과 양측 논리를 검토합니다.
7. **최종 판결** — 긴급특보, 판단과 황당 처분 3개가 하나의 판결 기록으로 저장됩니다.
8. **공개 선택** — 판결은 기본 비공개이며 작성자가 결과 화면에서 공개할 수 있습니다.
9. **방청객 참여** — 공개 판결에는 반응 투표와 방청석 댓글을 남길 수 있습니다.

기존 `judgmentScript` 문서는 호환 모드로 전문을 그대로 표시하며 기존 데이터를 다시 쓰지 않습니다.

---

## 판결 V2 데이터 구조

새 판결은 `results/{caseId}`에 한 번 저장하며 `judgment` 객체가 판결 내용의 유일한 정본입니다.

```text
results/{caseId}
├─ schemaVersion: 2
├─ resultVersion: judgment-v2
├─ caseTitle / headline / docketNumber / judgeType
├─ userId / ownerId / isPublic
├─ judgment
│  ├─ headline
│  ├─ incidentLevel
│  ├─ breakingNews
│  ├─ emergencyBriefing
│  ├─ impactAssessment
│  ├─ summary
│  ├─ facts
│  ├─ investigation
│  ├─ plaintiffClaim
│  ├─ defendantClaim
│  ├─ prosecution
│  ├─ defense
│  ├─ opinion
│  ├─ orders[]
│  ├─ closingComment
│  └─ legalNotice
├─ reactionTotal / reactionCounts / commentCount
└─ createdAt / updatedAt
```

`plaintiffClaim`과 `defendantClaim`은 새 판결에 추가되는 선택 필드이므로 기존 V2 판결도 그대로 유효합니다.

새 판결에는 `expandedCase`, `reception`, `courtOpinion`, `verdict`, `sentence`, `judgmentScript` 같은 중복 본문 필드를 저장하지 않습니다.

- Gemini에는 JSON 객체만 요청합니다.
- 사건 고유성, 양측 주장, 과몰입 장치와 주문 품질 검사를 통과하지 못하면 한 번 재작성합니다.
- AI 응답이 계속 기준을 충족하지 못하면 동일한 V2 구조의 사건 맞춤형 로컬 판결을 사용합니다.
- 사용자 판결과 오늘의 AI 판결이 같은 스키마를 사용합니다.
- 항소심과 운영 복구 작업은 V2 필드를 우선 읽고 기존 문서는 호환 처리합니다.

---

## 화면 구성

- **홈** — 서비스의 전체 재판 흐름, 담당 재판부, 공개 재판기록
- **사건 접수** — 사건 내용, 재판부 성향, 공개 여부와 선택적 이미지
- **재판 진행** — 사건 접수부터 수사·양측 주장·심리·선고까지 7단계 진행 화면
- **판결 결과** — 긴급특보, 원문 사건, 원고·피고 핵심 주장, 상세 변론, 판단과 주문
- **공개 재판기록** — 최신·인기·웃겼다 기준 정렬과 방청객 참여
- **이용안내·정책** — 서비스 흐름, 금지 콘텐츠, 이용약관, 개인정보처리방침과 AI 안내

---

## 디자인 시스템

다크·라이트 모드의 배경, 표면, 글자, 테두리, 로고 프레임, 폼과 재판 화면 스타일은 `public/css/site-system.css`에서 통합 관리합니다.

기존에 누적됐던 라이트 모드 보정 CSS 파일은 제거했으며, 새 화면은 공통 `--ui-*` 색상 변수를 사용합니다.

주요 파일:

- `public/css/main.css` — 기본 레이아웃과 컴포넌트
- `public/css/site-system.css` — 다크·라이트 통합 색상 및 화면별 디자인
- `public/js/components/theme.js` — 테마 선택과 브라우저 `color-scheme` 동기화

---

## 방청객 반응

공개 판결에는 다음 다섯 반응 중 하나를 선택할 수 있습니다.

- ⚖️ 원고 편
- 🛡️ 피고 편
- 🤝 쌍방과실
- 😳 판사님 과합니다
- 😂 웃겼다

게시판 정렬 기준:

- **최신** — 최근 선고 순
- **인기** — 투표와 댓글 참여도 기준
- **명판결** — `웃겼다` 반응 기준

---

## 프로젝트 구조

- `public/` — Firebase Hosting 정적 프론트엔드
- `public/js/pages/` — 홈, 접수, 재판, 결과, 게시판, 정책, 내 사건
- `public/js/data/default-policy-docs.js` — 기본 이용약관·개인정보·AI 안내·이용안내
- `public/css/site-system.css` — 다크·라이트 통합 디자인 시스템
- `public/admin/` — 관리자 페이지
- `functions/judgment-v2.js` — 판결 V2 정규화·검증 계약
- `functions/judgment-story-*.js` — 사건 분석, 프롬프트, 로컬 판결과 품질 검사
- `functions/generate-trial-v2.js` — 사용자 판결 V2 생성
- `functions/daily.js` — 오늘의 AI 판결 V2 생성
- `firestore.rules` — Firestore 접근 제어
- `firestore.indexes.json` — Firestore 복합 인덱스
- `storage.rules` — 사건 이미지와 프로필 사진 접근 제어
- `.github/workflows/firebase-deploy.yml` — Functions·Firestore·Hosting 자동배포
- `.github/workflows/firebase-storage-rules.yml` — Storage Rules 수동배포

---

## 주요 백엔드 기능

- `submitCase` — 사건 접수, 일일 한도·쿨다운·금칙어 검사
- `suggestCaseTitle` — 사건명 추천
- `generateTrial` — 수사·양측 주장·판결 V2 생성
- `createDailyAiCase` / `generateDailyAiNow` — 오늘의 AI V2 판결 생성
- `voteResult` — 공개 판결 반응 투표
- `addCourtComment` — 방청석 댓글
- `requestAppeal` — 항소심 생성
- `deleteMyCase` — 사용자 본인 사건 전체 정리
- `deleteCourtPost` / `deleteUserProfile` — 관리자 정리 기능
- `recoverStaleTrials` / `repairSocialCounters` — 운영 데이터 복구

Functions는 하드코딩된 이름 목록이 아니라 `functions/main.js`의 현재 export 전체를 기준으로 배포합니다. 소스에서 제거된 Function은 다음 Core 배포에서 운영 환경에서도 폐기됩니다.

---

## 보안과 공개 기본값

- Firebase Auth 사용자를 기준으로 접근 권한을 판단합니다.
- 사건 생성과 삭제는 Callable Function으로 처리합니다.
- 중요 데이터 쓰기·삭제 경로는 서버 전용입니다.
- 민감한 AI 설정은 관리자 전용 `site_settings`에 저장합니다.
- 사용자 화면에 필요한 설정만 `public_settings`로 분리합니다.
- 사용자 입력과 AI 결과는 화면 출력 전에 escape 처리합니다.
- 사건과 판결은 기본 비공개이며 작성자가 공개를 선택한 기록만 게시판에 표시합니다.
- Storage의 사건 이미지는 사건 소유자만 읽을 수 있고 클라이언트 직접 쓰기는 차단합니다.

---

## 관리자 설정

관리자 페이지에서 관리하는 항목:

- 일일 사건 접수 한도와 쿨다운
- 금칙어
- AI 모델·프롬프트
- AI 자동 생성 설정
- 사용량·비용 계산 기준
- 사업자 정보와 정책 문서
- 사건·판결·회원 데이터 정리
- 운영 데이터 복구 작업

관리자 로그인 후 공개 가능한 설정은 `public_settings/config`으로 동기화됩니다.

---

## 로컬 검증

```bash
npm install --prefix functions --no-audit --no-fund
npm run lint --prefix functions
```

검증 범위:

- Functions와 브라우저 JavaScript 문법
- 판결 V2 정규화·필수 필드·주문 구조
- 긴급특보, 원고·피고 핵심 주장과 사건 고유성
- 사용자·오늘의 AI·항소심·복구·게시판의 V2 연결
- 기존 `judgmentScript` 표시 호환
- 중복 파일 제거와 통합 테마 참조
- 홈·이용안내·정책의 서비스 콘셉트 일치
- Firestore 보안 계약과 공개 설정 접근 경로
- 소스 기준 Functions 전체 배포 계약
- Firebase Core와 Storage 배포 분리

---

## 배포

Functions·Firestore·Hosting은 `main` 푸시 시 자동 배포합니다.

Firebase Storage Rules는 별도 IAM 권한이 필요하므로 전용 수동 워크플로로 배포합니다. 서비스 계정 권한, 실행 순서와 403 오류 해결 방법은 [배포 운영서](docs/DEPLOYMENT.md)를 기준으로 합니다.

필수 운영 값:

- Firebase 프로젝트: `sosoking-481e6`
- GitHub Secret: `FIREBASE_SERVICE_ACCOUNT_SOSOKING_481E6`
- Firebase Functions Secret: `GEMINI_API_KEY`
- Functions 런타임: Node.js 20

서비스 계정 JSON과 Gemini API 키를 저장소 파일에 커밋하지 않습니다.
