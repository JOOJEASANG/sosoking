// post-image-edit-actions.js
//
// 사진 수정은 현재 전체 수정 화면(/write?edit=게시글ID)에서 처리합니다.
// 예전 별도 사진 수정 모달은 같은 이미지 필드를 동시에 수정하고 location.reload()를 호출해
// 수정 화면/상세 화면 상태와 충돌할 수 있어 호환 셸로만 유지합니다.

function removeLegacyImageEditButton() {
  document.getElementById('btn-owner-image-edit')?.remove();
}

window.addEventListener('hashchange', () => setTimeout(removeLegacyImageEditButton, 120));
new MutationObserver(() => {
  clearTimeout(removeLegacyImageEditButton.timer);
  removeLegacyImageEditButton.timer = setTimeout(removeLegacyImageEditButton, 120);
}).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(removeLegacyImageEditButton, 800);
