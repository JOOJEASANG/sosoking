# 소소킹 — 개발 메모

## 정책·안내 문서 동기화 (중요)

이용자에게 보이는 기능을 추가·변경·삭제할 때 — 특히 **새 서비스, 새 데이터 수집, 공개/검색 노출 방식, 좋아요·참여 기능, 익명/회원 정책** — 아래 문서를 **반드시 함께 검토·수정**한다.

- `public/js/pages/guide.js` — 이용 안내(사용법·FAQ)
- `public/js/pages/policy.js` — 이용약관 / 개인정보처리방침 / AI 서비스 안내(`DEFAULT_POLICIES`)
  - 실질적 변경 시 `POLICY_EFFECTIVE_DATE`(시행일)도 갱신한다.

강제 장치: `tools/check-brand-policy-copy.mjs`가 핵심 공개 문구(예: `미친 상담소`·`미친 번역소`·`기본 공개`·`좋아요`)를 요구한다. 기능을 바꾸면서 문서를 갱신하지 않으면 `npm run check`가 실패하도록, 문구가 바뀔 때 이 검사도 같이 업데이트한다.

법적 성격의 약관·개인정보 문구는 사실관계(수집 항목·공개 범위·외부 전송)를 정확히 반영하되, 최종 문안은 운영자/법률 검토를 권장한다.

## 캐시 버전 체인 (필수)

파일 내용을 바꾸면 `?v=` 캐시 버전을 올리고, 아래를 모두 동기화한다.
- 모듈: 해당 `.js` 참조 위치(`public/js/app.js`, `public/sw.js`)와 버전을 하드코딩한 `tools/check-*.mjs`
- 앱 체인: `public/index.html`의 `app.js?v=`, `public/sw.js`의 `CACHE_NAME`(`sosoking-app-v{app version}`), `public/deploy-version.txt`
- 확인: `npm run check` 전체 통과

## 검증

- `npm run check` — 정적 검사 전체(정책 문구·캐시 동기화·SEO·보안 등)
