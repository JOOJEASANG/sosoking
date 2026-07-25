# 소소킹 V2 재구성 준비 저장소

기존 소소킹 커뮤니티 코드는 전체 백업한 뒤, 새 서비스 기획을 위해 이 브랜치를 최소 골격으로 정리했습니다.

## 브랜치

- 기존 서비스 전체 백업: `backup/community-v1-20260726`
- 새 기획 및 개발: `rebuild/sosoking-v2`
- 현재 운영 기준 브랜치: `main` (아직 변경하지 않음)

## 현재 남겨둔 항목

- Firebase 프로젝트 연결 설정
- Firestore 보안 규칙과 기존 인덱스
- Storage 보안 규칙
- Firebase Hosting 최소 설정
- 새 기획 전 임시 화면

## 제거한 항목

- 기존 `public` 프런트엔드 전체
- 기존 Cloud Functions 소스 전체
- 기존 GitHub Actions 자동 배포
- 기존 검사 도구와 패키지 설정
- 기존 안정화·보정·레거시 문서

## 주의

이 브랜치에서 기존 소스를 다시 찾지 말고 백업 브랜치를 확인합니다. 기존 Firebase에 이미 배포된 Hosting과 Cloud Functions는 저장소 파일을 삭제하는 것만으로 자동 삭제되지 않습니다. 새 기획이 확정되기 전에는 `main` 병합이나 Firebase 배포를 하지 않습니다.
