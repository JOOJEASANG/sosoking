# SOSOKING — 소소하지만 쓸모 있는 세상

https://sosoking-481e6.web.app/

생활 도구·생활정보 커뮤니티 초기 버전. 기존 하루체크는 /daily.html로 이동하며 기존 localStorage 키와 Firestore 규칙 유지. 기존 행사 데이터는 접근 차단 상태 유지, 삭제하지 않음. 기존 프로그램 백업 archive/pre-daily-check-2026-11-19, 하루체크 기준 커밋 48992d4a11a9daed94f5f71223cb9e55403c69d4.

## 초기 기능
- 프로그램 검색/분류, 기기별 즐겨찾기, PWA.
- 옛 번호 변환: 기존 규칙 재사용, 현재 연락처 조회 불가, 저장 없음.
- 참석 여부 및 단일 날짜 선택 조사: 랜덤 공유 링크, 익명 UID당 응답 1개, 작성자만 집계, 마감/재개. 익명 계정 재생성에 의한 중복 투표는 완전히 막지 못함. 브라우저 데이터 삭제 시 작성 권한 복구 불가. 이전 행사와 별개 컬렉션.
- 커뮤니티·선박 정보: 운영자 승인 전 비공개, 10분에 1건/UID, 출처 URL 입력(선박 필수). 운영자 검토로 공개/반려. 공식 시간표 자동 수집이나 실시간 운항 확인은 제공하지 않음. 오일장 등은 생활정보 제보로 시작.
- 단체 주문 취합, 교대 근무표, 물건 대여 기록: 브라우저에서 처리. 공동 주문/서버 동기화 없음.

## 운영
- Firebase Hosting /__/firebase/init.json 사용. 기존 익명 인증 사용. 운영자는 신뢰할 수 있는 Admin SDK/콘솔에서 moderators/{uid} 등록 후 같은 UID로 /my.html 접속. 일반 사용자에게 권한 부여 금지. 검토할 게시글은 운영자에게만 보임.
- 공유 데이터는 lifePosts, lifePostLimits, lifePolls/{id}/votes. 기존 events 등 데이터 접근 차단 유지. 게시글은 작성자/운영자 삭제 가능. 모임 데이터 삭제/보존 정책 및 계정 복구, 신고·댓글·일반 회원 기능은 추후 개선.
- 개인정보 게시 금지. 모임 링크 공유 범위에 유의. 소규모 서비스로 시작하고 익명 인증 악용, Firestore 사용량 모니터링 필요. 유료 AI API 사용 없음.
- npm install; npm run check; npm run build; node scripts/verify-pwa.mjs; node scripts/verify-seo.mjs --built. GitHub Actions에서 테스트 및 main 배포.

## 후속 작업
- 댓글/신고, 운영자 로그인 및 검토 UI 강화, 선박·오일장 구조화/검증, 다중 날짜 응답, 참가자 관리, 공동 주문, 회비, 회원 동기화 및 삭제 정책.
