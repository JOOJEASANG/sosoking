const DELETE_TITLE = '⚠️ 모든 데이터 삭제 및 회원 탈퇴';
const DELETE_DESCRIPTION = 'Firebase 인증 계정, 프로필, 개인 AI 결과, 작성한 글·댓글, 투표·조회 기록, 스크랩·팔로우·알림, 신고·문의와 업로드 파일을 모두 영구 삭제합니다. 삭제 후에는 복구할 수 없습니다.';

function setText(element, text) {
  if (element && element.textContent !== text) element.textContent = text;
}

function updateAccountCopy(root = document) {
  const card = root.querySelector('.account-danger-card');
  if (!card) return;
  setText(card.querySelector('.account-danger-title'), DELETE_TITLE);
  setText(card.querySelector('p'), DELETE_DESCRIPTION);
  setText(card.querySelector('#btn-withdraw'), '모든 데이터 삭제 및 탈퇴');
}

function updatePrivacyCopy(root = document) {
  const legal = root.querySelector('.legal-page');
  if (!legal) return;

  legal.querySelectorAll('.legal-list li').forEach(item => {
    const text = item.textContent.trim();
    if (text.startsWith('공개 게시물과 댓글은')) {
      setText(item, '회원 탈퇴 시 공개 게시물과 댓글을 포함한 이용자 작성 데이터와 작성자 식별정보를 Firebase에서 삭제합니다.');
    } else if (text.startsWith('신고·분쟁 기록은')) {
      setText(item, '회원 탈퇴 시 이용자가 작성한 신고·문의 기록도 Firebase에서 삭제합니다. 관계 법령에 별도 보존 의무가 있는 자료만 법정 기간 동안 분리 보관할 수 있습니다.');
    } else if (text.startsWith('공개 게시물이나 댓글 삭제가 별도로 필요한 경우')) {
      setText(item, '회원 탈퇴를 실행하면 공개 게시물과 댓글을 포함한 이용자 소유 데이터가 함께 삭제됩니다.');
    }
  });

  legal.querySelectorAll('tbody tr').forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 2) return;
    const key = cells[0].textContent.trim();
    if (key === '공개 게시물·댓글') {
      setText(cells[1], '작성한 공개 게시물과 댓글, 답글 및 관련 하위 데이터를 Firebase에서 삭제합니다.');
    } else if (key === '신고·문의') {
      setText(cells[1], '이용자가 작성한 신고·문의 기록을 Firebase에서 삭제합니다. 법정 보존 의무가 있는 경우에만 별도 분리 보관합니다.');
    } else if (key === '토론 투표·조회 기록') {
      setText(cells[1], '이용자를 식별하는 개별 투표와 조회 기록을 Firebase에서 삭제합니다. 이미 공개된 비식별 집계 수치는 유지될 수 있습니다.');
    }
  });
}

function refreshCopy() {
  updateAccountCopy();
  updatePrivacyCopy();
}

const target = document.getElementById('page-content') || document.body;
new MutationObserver(refreshCopy).observe(target, { childList: true, subtree: true });
window.addEventListener('hashchange', refreshCopy);
refreshCopy();
