export function applySubmitPrivacyDefaults(container) {
  const checkbox = container.querySelector('#is-public');
  if (!checkbox || checkbox.dataset.privacyDefaultApplied === '1') return;
  checkbox.dataset.privacyDefaultApplied = '1';

  if (!checkbox.dataset.userTouched) checkbox.checked = false;
  checkbox.addEventListener('change', () => { checkbox.dataset.userTouched = '1'; });

  const labelText = checkbox.closest('label')?.querySelector('span');
  if (labelText) {
    labelText.innerHTML = `<b style="color:var(--gold);">판결문 생성 후 공개 선택</b><br><span style="color:var(--cream-dim);">기본값은 비공개입니다. 공개하면 닉네임과 판결문이 황당판결 기록에 표시됩니다. 원본 첨부 이미지는 작성자에게만 표시됩니다.</span>`;
  }

  const disclaimer = container.querySelector('.disclaimer');
  if (disclaimer && !disclaimer.textContent.includes('기본 비공개')) {
    disclaimer.innerHTML += '<br>· 판결문은 <strong>기본 비공개</strong>이며, 결과 화면에서 공개로 전환할 수 있습니다.';
  }
}
