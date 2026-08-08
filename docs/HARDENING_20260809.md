# 2026-08-09 운영 하드닝

이번 점검에서는 저장소 전체 구조를 유지하면서 운영 중 발생할 수 있는 경쟁조건과 보안 회귀를 집중 보완했습니다.

## 적용한 보호

- 신고로 숨겨진 판결은 작성자가 직접 다시 공개할 수 없습니다.
- 관리자만 숨김 판결을 복구할 수 있고, 재공개 시 숨김 상태 표식을 함께 정리합니다.
- 사건 삭제 중에는 공개 상태 변경, 투표, 댓글, 항소를 차단합니다.
- 투표와 댓글은 결과 문서를 같은 Firestore 트랜잭션에서 다시 읽어 삭제와 동시에 실행돼도 문서를 되살리지 못하게 합니다.
- 항소 결과 저장도 사건과 결과 문서가 모두 존재하고 삭제 중이 아닌지 다시 확인합니다.
- 공개 사건 원문 조회에는 App Check 훅, 인스턴스 상한, 세션별 호출 제한, sanitized 공개 결과 검증을 적용합니다.
- 배포된 Firebase Functions가 소스와 정확히 일치하지 않으면 배포 검증을 실패시킵니다.
- Pull Request 단계에서도 전체 `npm test`가 실행되도록 별도 검증 workflow를 추가했습니다.
- 서비스계정 JSON과 로컬 환경 파일 패턴을 Git에서 추가 제외했습니다.

## 자동 검증

- `tools/check-lifecycle-hardening.mjs`
- `functions/check-lifecycle-guards.js`

두 검사는 기존 `npm test` 체인에 포함됩니다.

## 외부 설정

App Check 사이트 키는 Firebase Console에서 생성·등록해야 하는 공개 사이트 키이므로 저장소에서 임의 생성하지 않습니다. 운영에서 App Check를 강제하려면 다음을 완료해야 합니다.

1. Firebase Console에서 웹 App Check 등록
2. `public/js/firebase-config.js`의 `appCheckSiteKey` 설정
3. 허용 도메인 확인
4. GitHub Actions 변수 `ENFORCE_APP_CHECK=true` 적용
5. 배포 후 정상 웹 요청과 차단 요청 확인

키가 비어 있는데 강제 변수를 켜면 배포 검증이 실패하도록 기존 보호를 유지합니다.
