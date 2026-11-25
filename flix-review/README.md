# 영상 수집 및 검토 운영
- 자동 수집은 6시간 간격의 GitHub Actions 예약 작업입니다. 실제 수집은 YouTube Data API v3를 활성화하고 저장소 Actions secret YOUTUBE_API_KEY를 설정한 이후에만 동작합니다. 키가 없으면 안전하게 건너뜁니다.
- sources.json에 검색어, 원 제작자 채널 ID, 재생목록 ID를 관리합니다. 공식 API에서 공개, 한국 지역 재생 가능, 임베드 허용, 연령 제한 없는 후보를 수집합니다. 실제 재생 가능 여부, AI 생성 여부, 한국어 음성 및 제작자 권리는 사람이 확인해야 합니다.
- Actions의 flix-review artifact에서 candidates.json 및 health.json을 내려받습니다. 데이터는 7일 후 만료됩니다. 이미 등록한 영상은 후보에서 제외하고 상태만 점검합니다. 자동 삭제/공개는 하지 않습니다.
- approvals.example.json을 복사하여 실제 후보 ID, 작품·회차·장르·언어·검토자 등을 입력하고 승인할 항목만 approved:true로 바꿉니다. node scripts/flix-catalog-review.mjs approvals.json 실행 시 flix-review/approved-catalog.json 생성. 원본 catalog는 수정하지 않습니다. 검토 후 기존 public/flix/catalog.json과 diff를 확인하고 PR로 등록합니다.
- 기존 사이트는 archive/pre-flix-2026-11-26에 보존. Firestore 데이터와 규칙은 변경하지 않습니다. 관리자 웹 화면 및 대규모 자동 분류는 아직 별도 단계입니다.
