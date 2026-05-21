// multi-write-stability-fix.js
//
// 현재 글쓰기 UI는 여러 모듈 체크박스 방식이 아니라 글쓰기 형식 하나를 고르는 구조입니다.
// 이 레거시 보정은 hidden input을 체크박스처럼 토글할 수 있어 오작동 위험이 있으므로 비활성화합니다.

console.info('[multi-write-stability-fix] disabled: multi-write.js owns current writer UI');
