# 소소킹 판결소

일상 속 소소한 억울함과 황당한 사례를 접수하면 AI 재판부가 지나치게 진지한 판결을 내리는 Firebase 기반 오락형 서비스입니다.

실제 법률 상담이나 분쟁 해결 서비스가 아니며, 핵심 재미는 **사소한 사건 + 과한 재판 말투 + 실행 가능한 소소 형량**입니다.

---

## 서비스 기준

### 핵심 콘셉트

- 사람 간 갈등뿐 아니라 모기, 리모컨, 마지막 만두처럼 사소한 대상도 피고가 될 수 있습니다.
- 입력이 하찮을수록 판결은 더 엄숙하게 작성합니다.
- 결론은 가볍고 공감 가능하며 실제로 해볼 수 있는 소소한 처분으로 마무리합니다.
- 뉴스·위원회·상황실 표현은 보조 장치로만 사용하고 메인 정체성은 재판과 판결로 유지합니다.

### 다루지 않는 방향

- 실제 법률 서비스처럼 보이는 구성
- 정치·혐오·성적 내용·실제 범죄·개인정보 중심 콘텐츠
- 학교폭력·가정폭력·직장 내 괴롭힘·의료·정신건강 문제를 오락처럼 소비하는 구성
- 욕설·비하·자극적인 표현에 의존하는 개그

---

## 사용자 흐름

1. **사건 접수** — 사건명, 사건 내용, 판사 성향 등을 입력합니다.
2. **AI 재판 진행** — Gemini가 구조화된 판결 객체를 생성합니다.
3. **최종 판결** — 결과 화면이 저장된 판결 객체를 그대로 표시합니다.
4. **공개 판결기록** — 사용자가 선택한 판결만 공개합니다.
5. **방청객 참여** — 반응 투표와 방청석 댓글을 남깁니다.
6. **항소심** — 사건 소유자는 1심 주문과 판단을 기준으로 항소심을 신청할 수 있습니다.

기존 `judgmentScript` 문서는 호환 모드로 전문을 그대로 표시하며, 새 판결로 변환하거나 기존 데이터를 다시 쓰지 않습니다.

---

## 판결 V2 데이터 구조

새 판결은 `results/{caseId}`에 한 번 저장합니다. 판결 본문은 `judgment` 객체가 유일한 정본입니다.

```text
results/{caseId}
├─ schemaVersion: 2
├─ resultVersion: judgment-v2
├─ caseTitle / headline / docketNumber / judgeType
├─ userId / ownerId / isPublic
├─ judgment
│  ├─ headline
│  ├─ summary
│  ├─ facts
│  ├─ investigation
│  ├─ prosecution
│  ├─ defense
│  ├─ opinion
│  ├─ orders[]
│  ├─ closingComment
│  └─ legalNotice
├─ reactionTotal / reactionCounts / commentCount
└─ createdAt / updatedAt
```

새 판결에는 `expandedCase`, `reception`, `courtOpinion`, `verdict`, `sentence`, `judgmentScript` 같은 중복 본문 필드를 저장하지 않습니다.

- Gemini에는 JSON 객체만 요청합니다.
- AI 응답이 형식 검사를 통과하지 못하면 동일한 V2 구조의 로컬 판결을 사용합니다.
- 사용자 판결과 오늘의 AI 판결이 같은 스키마를 사용합니다.
- 항소심과 운영 복구 작업은 V2 필드를 우선 읽고 기존 문서는 호환 처리합니다.

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
- `public/admin/` — 관리자 페이지
- `functions/judgment-v2.js` — 판결 V2 정규화·검증 계약
- `functions/generate-trial-v2.js` — 사용자 판결 V2 생성
- `functions/daily.js` — 오늘의 AI 판결 V2 생성
- `functions/` — Firebase Cloud Functions와 Gemini 연동
- `firestore.rules` — Firestore 접근 제어
- `firestore.indexes.json` — Firestore 복합 인덱스
- `storage.rules` — 사건 이미지와 프로필 사진 접근 제어
- `.github/workflows/firebase-deploy.yml` — Functions·Firestore·Hosting 자동배포
- `.github/workflows/firebase-storage-rules.yml` — Storage Rules 수동배포

---

## 주요 백엔드 기능

- `submitCase` — 사건 접수, 일일 한도·쿨다운·금칙어 검사
- `suggestCaseTitle` — 사건명 추천
- `generateTrial` — V2 판결 객체 생성
- `createDailyAiCase` / `generateDailyAiNow` — 오늘의 AI V2 판결 생성
- `voteResult` — 공개 판결 반응 투표
- `addCourtComment` — 방청석 댓글
- `requestAppeal` — 항소심 생성
- `deleteMyCase` — 사용자 본인 사건 전체 정리
- `deleteCourtPost` / `deleteUserProfile` — 관리자 정리 기능
- `recoverStaleTrials` / `repairSocialCounters` — 운영 데이터 복구

Functions는 하드코딩된 이름 목록이 아니라 `functions/main.js`의 현재 export 전체를 기준으로 배포합니다. 소스에서 제거된 Function은 다음 Core 배포에서 운영 환경에서도 폐기됩니다.

---

## 보안 구조

- Firebase Auth 사용자를 기준으로 접근 권한을 판단합니다.
- 사건 생성과 삭제는 클라이언트 직접 쓰기가 아니라 Callable Function으로 처리합니다.
- `users`, `user_names`, `cases`, `results`의 중요 쓰기·삭제 경로는 서버 전용입니다.
- 이메일 문서 기반 관리자 권한은 이메일 인증 완료 계정만 인정합니다.
- 민감한 AI 설정은 관리자 전용 `site_settings`에 저장합니다.
- 사용자 화면에 필요한 값만 `public_settings`로 분리합니다.
- 사용자 입력과 AI 결과는 화면 출력 전에 escape 처리합니다.
- Storage의 사건 이미지는 사건 소유자만 읽을 수 있고 클라이언트 직접 쓰기는 차단합니다.

---

## 관리자 설정

관리자 권한은 Firestore의 `admins/{uid}` 또는 `admins/{email}` 문서로 판단합니다.

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
- 새 생성기의 중복 본문 필드 저장 금지
- 사용자·오늘의 AI·항소심·복구·게시판의 V2 연결
- 기존 `judgmentScript` 표시 호환
- Firestore 보안 계약과 공개 설정 접근 경로
- 소스 기준 Functions 전체 배포 계약
- Firebase Core와 Storage 배포 분리

---

## 배포

Functions·Firestore·Hosting은 `main` 푸시 시 자동 배포합니다.

Firebase Storage Rules는 별도 IAM 권한이 필요하므로 전용 수동 워크플로로 배포합니다. 서비스 계정 권한, 실행 순서, 403 오류 해결 방법은 [배포 운영서](docs/DEPLOYMENT.md)를 기준으로 합니다.

---

## 필수 운영 값

- Firebase 프로젝트: `sosoking-481e6`
- GitHub Secret: `FIREBASE_SERVICE_ACCOUNT_SOSOKING_481E6`
- Firebase Functions Secret: `GEMINI_API_KEY`
- Functions 런타임: Node.js 20

서비스 계정 JSON과 Gemini API 키를 저장소 파일에 커밋하지 않습니다.
