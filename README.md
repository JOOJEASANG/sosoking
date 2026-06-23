# 소소킹

생활 고민을 AI 캐릭터와 판결하고, 문장을 바꾸고, 이름을 짓고, 상담하고, 토론하는 Firebase 기반 웹앱입니다.

## 핵심 기능

- 판결소: 선택한 캐릭터 판사 3명의 판결
- 창작소: 캐릭터 말투 변환과 작명
- 상담소: 캐릭터 상담사 3명의 조언
- 자료실·토론방: 생활 논쟁 자료, 투표, 댓글
- 내정보: 개인 AI 결과 다시 보기, 복사, 공유, 삭제

AI 결과는 자동으로 공개 게시되지 않습니다. 사용자 전용 영역에 최근 50개까지만 저장되며 개별 삭제 또는 회원 탈퇴 시 삭제됩니다.

## 운영 구조

- Functions 진입점은 `functions/functions-main-v2.js` 하나만 사용합니다.
- AI 캐릭터 정의는 `king-character-catalog.js`, AI 실행은 `ai-runtime-provider.js`, 자동 검토는 `moderation-functions.js`로 분리되어 있습니다.
- 과거 통합 AI 엔진과 호환용 진입점은 운영 코드에서 삭제했습니다.
- AI 인증 정보는 관리형 비밀 저장소를 통해서만 Functions에 연결됩니다.
- 자동 검토는 관리자 확인을 돕는 위험 신호와 우선순위만 기록하며 게시물을 자동 삭제하지 않습니다.

## 검사

```bash
npm ci
cd functions && npm ci && cd ..
npm run check
```

검사 범위:

- Functions export와 Hosting rewrite
- JavaScript 문법과 로컬 파일 참조
- AI 놀이터 기능 연결
- 자료 ID·날짜·투표·댓글 정책 단위 테스트
- 백엔드 보안 계약과 최종 배포 표면
- Hosting·Backend의 main 브랜치 배포 제한
- Storage Rules와 배포 명령 정합성
- 이용약관과 개인정보처리방침 정합성
- 제거된 정치게임·구형 AI 기능 재노출 방지

Pull Request에서는 Firebase Hosting 미리보기 배포 후 Chromium으로 PC와 모바일 주요 화면을 검사하고 캡처를 보관합니다.

## 운영 배포

- Hosting과 Backend는 서비스 계정으로 인증합니다.
- 운영 배포는 `main` 브랜치에서만 실행합니다.
- Backend는 Firestore Rules·Indexes, Storage Rules, Functions 순서로 배포합니다.
- 상세 점검과 복구 절차는 `docs/PRODUCTION_RELEASE.md`를 따릅니다.
