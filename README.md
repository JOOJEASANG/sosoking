# 소소킹

생활 고민을 개성 강한 AI 캐릭터들과 판결하고, 바꿔 말하고, 이름 짓고, 상담하고, 함께 토론하는 Firebase 기반 참여형 웹앱입니다.

## 핵심 공간

- 판결소: 상황을 입력하면 선택한 캐릭터 판사 3명이 각자 판결합니다.
- 창작소: 문장을 캐릭터 말투로 바꾸거나 대상에 맞는 이름을 만듭니다.
- 상담소: 캐릭터 상담사 3명이 서로 다른 관점으로 조언합니다.
- 토론방·자료실: 생활 논쟁 자료를 읽고 투표와 댓글에 참여합니다.
- 내정보: 개인 AI 결과를 다시 열고 복사·공유·삭제합니다.

AI 결과 기록은 사용자 전용 하위 컬렉션에 저장되며 최근 50개까지만 유지됩니다. 회원 탈퇴 시 개인 AI 결과도 함께 삭제됩니다.

## 개발 검사

```bash
npm ci
cd functions && npm ci && cd ..
npm run check
```

`npm run check`는 다음 항목을 검사합니다.

- Hosting rewrite와 Functions export 일치
- 정적 HTML의 로컬 CSS·JS·이미지 존재 여부
- JavaScript 문법과 동적 import 경로
- AI 놀이터 경로, 기능 호출, 결과 기록 계약
- 제거된 정치게임 UI와 Functions가 다시 노출되지 않는지 확인

Pull Request에서는 Firebase Hosting 미리보기 채널을 생성한 뒤 Chromium으로 PC와 모바일 화면을 검사합니다. 홈, 판결소, 창작소, 상담소, 토론방, 내정보 화면의 렌더링·가로 넘침·정적 파일 오류를 확인하고 화면 캡처를 Actions artifact로 보관합니다.

## 배포

운영 배포는 `main` 브랜치에서만 실행됩니다.

```bash
npm run deploy:hosting
npm run deploy:functions
npm run deploy:rules
npm run deploy:indexes
```

- Hosting과 Backend는 별도 GitHub Actions workflow로 배포됩니다.
- Functions는 Node.js 22 환경을 사용합니다.
- AI 비밀키는 Secret Manager와 GitHub Actions secret을 사용합니다.
- PR 브랜치는 운영 채널이 아니라 만료되는 미리보기 채널에만 배포됩니다.
