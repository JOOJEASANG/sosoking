# 배포 체크리스트

- Core PR 검증 작업 통과 확인
- Functions → Firestore Rules → Hosting 순서 배포 확인
- Storage Rules 수동 배포
- 이메일 인증 메일 수신 시험
- 비인증 이메일 계정의 AI 호출 차단 시험
- 사건 공개 시 개인정보 재검사 시험
- 동일 사건 판결·항소 동시 호출 시험
- 프로필 사진이 `profile-photos/{uid}/avatar.jpg`에 저장되는지 확인
- Firebase App Check와 비용 예산 알림은 콘솔에서 별도 설정
