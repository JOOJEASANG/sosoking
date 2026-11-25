# 소소킹플릭스 1차 개발
기존 서비스와 Firebase 데이터는 변경하지 않았다. 신규 시청 화면은 public/flix/에 격리되어 있으며 기존 빌드로 /flix/에 복사된다. 기존 루트 및 배포 변경은 별도 검증 후 진행한다.
- 초기 데이터: 소통남의 서초동 24시 원본 통합본 1개, 공개 설명의 8개 챕터. 원본 https://www.youtube.com/watch?v=gW58QTOplF0 . 외부 임베드 성공 여부는 실제 브라우저에서 확인해야 한다.
- 로컬 시청 기록/찜/다음 회차/정렬/장르 검색, 공식 IFrame 플레이어. 로그인/광고/영상 다운로드 없음. 자동 재생은 브라우저 제한 적용. 
- 수집: YouTube Data API v3를 활성화하고 API 제한을 적용한 키를 환경변수 YOUTUBE_API_KEY에 넣은 뒤 node scripts/flix-collect.mjs 실행. 인자로 검색어 또는 playlist:재생목록ID를 전달할 수 있다. 결과 flix-review/candidates.json은 검토용이며 자동 공개하지 않는다. 주기 실행, 관리자 승인 화면, 공개 카탈로그 업데이트 및 기존 사이트 루트 전환은 미구현. API 데이터는 정책에 맞게 갱신/삭제 필요. API 키를 채팅, 코드, 공개 저장소에 올리지 않는다.
- 현재 Firebase Hosting 기본 Referrer-Policy가 no-referrer이므로 최종 전환 시 strict-origin-when-cross-origin으로 변경하고 YouTube 오류 153을 실제 테스트해야 한다. 기존 서비스 워커가 신규 경로에 영향을 주는지 확인 필요.
