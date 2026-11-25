# 영상 수집 및 검토 운영
- 자동 수집은 6시간 간격의 GitHub Actions 예약 작업입니다. 실제 수집은 YouTube Data API v3를 활성화하고 저장소 Actions secret YOUTUBE_API_KEY를 설정한 이후에만 동작합니다. 키가 없으면 안전하게 건너뜁니다.
- sources.json에 검색어, 원 제작자 채널 ID, 재생목록 ID를 관리합니다. 공식 API에서 공개, 한국 지역 재생 가능, 임베드 허용, 연령 제한 없는 후보를 수집합니다. 실제 재생 가능 여부, AI 생성 여부, 한국어 음성 및 제작자 권리는 사람이 확인해야 합니다.
- Actions의 flix-review artifact에서 candidates.json 및 health.json을 내려받습니다. 데이터는 7일 후 만료됩니다. 이미 등록한 영상은 후보에서 제외하고 상태만 점검합니다. 자동 삭제/공개는 하지 않습니다.
- approvals.example.json을 복사하여 실제 후보 ID, 작품·회차·장르·언어·검토자 등을 입력하고 승인할 항목만 approved:true로 바꿉니다. node scripts/flix-catalog-review.mjs approvals.json 실행 시 flix-review/approved-catalog.json 생성. 원본 catalog는 수정하지 않습니다. 검토 후 기존 public/flix/catalog.json과 diff를 확인하고 PR로 등록합니다.
- 기존 사이트는 archive/pre-flix-2026-11-26에 보존. Firestore 데이터와 규칙은 변경하지 않습니다. 관리자 웹 화면 및 대규모 자동 분류는 아직 별도 단계입니다.

## 로컬 관리자 화면
저장소를 내려받고 루트에서 `node scripts/flix-admin.mjs` 실행 후 http://127.0.0.1:8765 접속. 카탈로그와 수집 결과 JSON을 불러와 작품·회차 편집, 삭제, 후보 승인 및 검증된 JSON 내보내기를 수행합니다. 저장소 권한이 있는 운영자가 PR로 공개합니다. 로컬 전용이며 공개 호스팅이나 Firebase 인증/규칙을 변경하지 않습니다.

## 직접 링크 등록
로컬 관리자 실행 시 현재 카탈로그 자동 불러오기. 유튜브 URL 또는 여러 URL 붙여넣기, 재생목록 및 채널 조회, 중복 표시, API 확인 결과, 새 작품/기존 작품 회차 추가, 검토 확인, 편집 및 검증 후 JSON 내보내기. 로컬 서버의 환경변수 YOUTUBE_API_KEY를 설정하면 공식 API 정보를 채웁니다. 키 미설정 시 개별 링크에서 영상 ID만 추출하며 메타데이터 및 재생 여부 수동 검토가 필요합니다. 재생목록/채널은 키 필요. 채널·재생목록 수집 설정 초안도 내보낼 수 있습니다. 공개 사이트에는 관리 기능을 배치하지 않습니다.
GitHub 로그인 후 Actions > AI영상 링크 등록 및 검토 > Run workflow에서 서버 측 secret으로 조회 가능. approved는 검토 후 공개용 카탈로그 초안을 생성하는 옵션이며 자동 공개는 하지 않습니다. 결과 artifact의 approved-catalog.json을 검토하여 PR로 등록합니다. 공개 사이트 관리자 로그인/직접 저장은 별도 인증·권한 설정 필요.
