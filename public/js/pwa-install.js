// One branded PWA install experience on the homepage and every utility page.
(() => {
  const buttons = [...document.querySelectorAll('[data-install-app]')];
  let deferredPrompt = null;
  const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const dialog = document.createElement('dialog');
  dialog.className = 'install-dialog';
  dialog.setAttribute('aria-labelledby', 'installDialogTitle');
  dialog.innerHTML = `
    <div class="install-dialog-inner">
      <button type="button" class="install-dialog-close" aria-label="닫기">×</button>
      <img src="/icons/sosoking.svg" class="install-dialog-logo" alt="">
      <h2 id="installDialogTitle">소소킹 앱 설치</h2>
      <p class="install-dialog-intro">소소킹을 휴대전화 홈 화면에 추가하면 별도 주소 입력 없이 바로 열 수 있습니다.</p>
      <div id="installHelp" class="install-dialog-help"></div>
      <button type="button" class="btn primary install-dialog-done">확인</button>
    </div>`;
  document.body.append(dialog);
  const close = () => { if (dialog.open) dialog.close(); else dialog.removeAttribute('open'); };
  dialog.querySelector('.install-dialog-close').addEventListener('click', close);
  dialog.querySelector('.install-dialog-done').addEventListener('click', close);
  dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
  const escape = text => { const e = document.createElement('span'); e.textContent = text; return e.innerHTML; };
  function openGuide() {
    const ua = navigator.userAgent || '';
    const ios = /iPad|iPhone|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const android = /Android/i.test(ua);
    const embedded = /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\//i.test(ua);
    const help = dialog.querySelector('#installHelp');
    let items, heading;
    if (ios) {
      heading = '아이폰 / 아이패드';
      items = [
        'Safari에서 소소킹 사이트를 열어주세요.',
        '하단 또는 상단의 공유 버튼(□↑)을 누르세요.',
        '“홈 화면에 추가”를 선택하고, “웹 앱으로 열기”가 보이면 켜주세요.',
        '오른쪽 위 “추가”를 누르면 소소킹 아이콘이 생깁니다.'
      ];
    } else if (android) {
      heading = '안드로이드';
      items = [
        'Chrome 또는 삼성 인터넷에서 소소킹 사이트를 열어주세요.',
        '브라우저 메뉴(⋮ 또는 ≡)를 열어주세요.',
        '“앱 설치” 또는 “홈 화면에 추가”를 선택하고 설치를 확인하세요.'
      ];
    } else {
      heading = 'PC / 기타 브라우저';
      items = [
        'Chrome 또는 Edge에서 소소킹 사이트를 열어주세요.',
        '주소창의 앱 설치 아이콘을 누르거나 브라우저 메뉴에서 “설치”를 선택하세요.',
        '설치 기능이 보이지 않으면 브라우저가 지원하는지 확인해 주세요.'
      ];
    }
    help.innerHTML = `<strong>${escape(heading)} 설치 방법</strong>${embedded ? '<p class="install-embedded">카카오톡 등 앱 내부 브라우저에서는 설치 메뉴가 표시되지 않을 수 있습니다. 먼저 브라우저에서 열어주세요.</p>' : ''}<ol>${items.map(i=>`<li>${escape(i)}</li>`).join('')}</ol><p class="install-dialog-note">웹사이트는 설치 없이도 계속 사용할 수 있습니다. 오프라인에서는 행사 등록·명단 관리가 작동하지 않습니다.</p>`;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }
  function updateInstalled() {
    if (!installed()) return;
    for (const button of buttons) {
      button.disabled = true;
      button.classList.add('installed');
      button.textContent = '설치됨';
      button.setAttribute('aria-label', '소소킹 앱이 설치되어 있습니다');
    }
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    for (const button of buttons) {
      button.disabled = true;
      button.classList.add('installed');
      button.textContent = '설치 완료';
    }
  });
  buttons.forEach(button => button.addEventListener('click', async () => {
    if (installed()) { updateInstalled(); return; }
    if (deferredPrompt) {
      const prompt = deferredPrompt;
      deferredPrompt = null;
      try { await prompt.prompt(); await prompt.userChoice; }
      catch (error) { console.warn('PWA installation prompt unavailable',error); openGuide(); }
    } else if (typeof navigator.install === 'function') {
      try { await navigator.install(); }
      catch (error) { console.warn('PWA install API unavailable',error); openGuide(); }
    } else openGuide();
  }));
  updateInstalled();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', {scope:'/'}).catch(err => {
        console.warn('SOSOKING offline shell registration failed',err);
      });
    });
  }
})();
