export function renderTown(container) {
  injectTownStyle();

  container.innerHTML = `
    <div class="town-page">
      <div class="town-header">
        <a href="#/" class="town-back">‹</a>
        <div>
          <div class="town-kicker">SOSOKING TOWN · 생활법정 거리</div>
          <div class="town-title">🏙️ 소소킹 가상거리</div>
        </div>
        <button class="town-help" onclick="location.hash='#/guide'">안내</button>
      </div>

      <main class="town-map">
        <div class="town-sky-glow"></div>
        <div class="town-cloud cloud-a">☁️</div>
        <div class="town-cloud cloud-b">☁️</div>

        <section class="town-board">
          <div class="town-board-title">오늘의 동선</div>
          <div class="town-board-row"><span>1</span> 경찰서에서 사건 상황 정리</div>
          <div class="town-board-row"><span>2</span> 법률사무소에서 입장 정리</div>
          <div class="town-board-row"><span>3</span> 사건접수처에서 생활 사건 등록</div>
          <div class="town-board-row"><span>4</span> 법원에서 재판 시작</div>
        </section>

        <button class="town-building police" data-target="#/submit-topic" data-speech="경찰서에서는 사건 상황을 신고서처럼 정리합니다.">
          <div class="building-roof">🚓</div>
          <div class="building-name">소소 경찰서</div>
          <div class="building-sub">사건 상황 정리</div>
          <div class="building-door"></div>
        </button>

        <button class="town-building law-office" data-target="#/submit-topic" data-speech="법률사무소에서는 원고와 피고의 입장을 깔끔하게 나눕니다.">
          <div class="building-roof">📚</div>
          <div class="building-name">법률사무소</div>
          <div class="building-sub">원고·피고 입장 정리</div>
          <div class="building-door"></div>
        </button>

        <button class="town-building filing" data-target="#/submit-topic" data-speech="사건접수처에서 생활 속 억울함을 사건으로 등록합니다.">
          <div class="building-roof">📝</div>
          <div class="building-name">사건접수처</div>
          <div class="building-sub">생활 사건 등록</div>
          <div class="building-door"></div>
        </button>

        <button class="town-building courthouse" data-target="#/topics" data-speech="법원에서는 접수된 사건을 골라 원고와 피고로 재판을 시작합니다.">
          <div class="building-roof">⚖️</div>
          <div class="building-name">소소킹 생활법정</div>
          <div class="building-sub">대법정 입장</div>
          <div class="building-door double"></div>
        </button>

        <div class="town-road"></div>
        <div class="town-crosswalk"></div>
        <div class="town-car car-a">🚕</div>
        <div class="town-car car-b">🚙</div>

        <div class="town-character hero-char">
          <div class="char-shadow"></div>
          <div class="char-body">🧑‍💼</div>
          <div class="char-name">나</div>
        </div>
        <div class="town-character npc-a"><div class="char-shadow"></div><div class="char-body">👮</div><div class="char-name">경찰</div></div>
        <div class="town-character npc-b"><div class="char-shadow"></div><div class="char-body">👩‍💼</div><div class="char-name">상담원</div></div>
        <div class="town-character npc-c"><div class="char-shadow"></div><div class="char-body">🧑‍⚖️</div><div class="char-name">서기</div></div>

        <div class="town-speech" id="town-speech">
          <strong>가이드</strong>
          <span>건물을 눌러 이동하세요. 지금은 2D 가상거리 베타입니다.</span>
        </div>
      </main>

      <section class="town-action-panel">
        <button onclick="location.hash='#/submit-topic'">📝 바로 사건 접수</button>
        <button onclick="location.hash='#/topics'">⚖️ 바로 법정 입장</button>
      </section>
    </div>
  `;

  const speech = container.querySelector('#town-speech');
  container.querySelectorAll('.town-building').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.dataset.speech || '이동합니다.';
      speech.innerHTML = `<strong>${btn.querySelector('.building-name')?.textContent || '안내'}</strong><span>${text}</span>`;
      btn.classList.add('visited');
      moveHeroTo(btn);
      window.setTimeout(() => { location.hash = btn.dataset.target; }, 620);
    });
  });
}

function moveHeroTo(btn) {
  const hero = document.querySelector('.hero-char');
  const map = document.querySelector('.town-map');
  if (!hero || !map || !btn) return;
  const mapRect = map.getBoundingClientRect();
  const rect = btn.getBoundingClientRect();
  const leftPct = ((rect.left + rect.width / 2 - mapRect.left) / mapRect.width) * 100;
  const topPct = ((rect.top + rect.height - 6 - mapRect.top) / mapRect.height) * 100;
  hero.style.left = `${Math.max(8, Math.min(86, leftPct))}%`;
  hero.style.top = `${Math.max(32, Math.min(74, topPct))}%`;
  hero.classList.add('walking');
  setTimeout(() => hero.classList.remove('walking'), 520);
}

function injectTownStyle() {
  if (document.getElementById('town-style')) return;
  const style = document.createElement('style');
  style.id = 'town-style';
  style.textContent = `
    .town-page { min-height:100vh; background:linear-gradient(180deg,#0b1424,#0d1117 72%); color:var(--cream); padding-bottom:80px; }
    [data-theme="light"] .town-page { background:linear-gradient(180deg,#f8e8d4,#fff8f2 72%); }
    .town-header { position:sticky; top:0; z-index:40; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 18px; background:rgba(13,17,23,.94); border-bottom:1px solid rgba(201,168,76,.18); backdrop-filter:blur(12px); }
    [data-theme="light"] .town-header { background:rgba(255,248,242,.96); }
    .town-back { font-size:30px; line-height:1; color:var(--cream-dim); text-decoration:none; }
    .town-kicker { font-size:9px; font-weight:900; letter-spacing:.14em; color:var(--gold); text-align:center; }
    .town-title { font-family:var(--font-serif); font-size:17px; font-weight:900; color:var(--cream); }
    .town-help { border:1px solid rgba(201,168,76,.32); background:rgba(201,168,76,.08); color:var(--gold); border-radius:999px; padding:8px 11px; font-size:12px; font-weight:900; }
    .town-map { position:relative; margin:16px auto 12px; width:min(760px, calc(100% - 28px)); height:620px; overflow:hidden; border:1.5px solid rgba(201,168,76,.36); border-radius:26px; background:linear-gradient(180deg,#132641 0%,#203b52 46%,#2c4731 47%,#17251b 100%); box-shadow:0 22px 58px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.07); }
    [data-theme="light"] .town-map { background:linear-gradient(180deg,#a7d5ff 0%,#d6efff 46%,#78a76e 47%,#d6c19f 100%); box-shadow:0 16px 38px rgba(154,112,24,.14); }
    .town-sky-glow { position:absolute; left:50%; top:-130px; transform:translateX(-50%); width:420px; height:300px; background:radial-gradient(circle,rgba(255,235,180,.42),transparent 66%); animation:townGlow 4s ease-in-out infinite alternate; }
    .town-cloud { position:absolute; color:rgba(255,255,255,.72); font-size:38px; animation:cloudMove 11s linear infinite alternate; }
    .cloud-a { left:8%; top:32px; } .cloud-b { right:12%; top:74px; animation-duration:13s; }
    .town-board { position:absolute; left:18px; top:18px; width:205px; z-index:4; padding:13px 14px; border-radius:16px; border:1px solid rgba(201,168,76,.28); background:rgba(0,0,0,.22); box-shadow:0 10px 28px rgba(0,0,0,.2); }
    [data-theme="light"] .town-board { background:rgba(255,255,255,.78); }
    .town-board-title { font-size:12px; font-weight:900; color:var(--gold); margin-bottom:8px; }
    .town-board-row { display:flex; align-items:center; gap:7px; font-size:11px; color:var(--cream-dim); line-height:1.45; margin-top:5px; }
    .town-board-row span { width:17px; height:17px; flex-shrink:0; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; background:rgba(201,168,76,.16); color:var(--gold); font-size:10px; font-weight:900; }
    .town-building { position:absolute; z-index:3; border:none; cursor:pointer; text-align:center; color:var(--cream); border-radius:18px 18px 7px 7px; padding:12px 8px 0; background:linear-gradient(180deg,rgba(255,255,255,.13),rgba(255,255,255,.04)); border:1.5px solid rgba(201,168,76,.22); box-shadow:0 12px 30px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.08); transition:transform .18s ease, border-color .18s ease, filter .18s ease; }
    [data-theme="light"] .town-building { background:rgba(255,255,255,.82); box-shadow:0 8px 22px rgba(154,112,24,.16); }
    .town-building:hover, .town-building.visited { transform:translateY(-4px); border-color:var(--gold); filter:brightness(1.08); }
    .building-roof { font-size:30px; line-height:1; margin-bottom:6px; }
    .building-name { font-size:13px; font-weight:900; color:var(--cream); }
    .building-sub { margin-top:3px; font-size:10px; color:var(--cream-dim); line-height:1.35; }
    .building-door { width:34px; height:42px; margin:12px auto 0; border-radius:9px 9px 0 0; background:linear-gradient(180deg,#5d3721,#2f1d13); border:1px solid rgba(255,231,178,.2); }
    .building-door.double { width:48px; background:linear-gradient(90deg,#5d3721 0 48%,#2f1d13 49% 51%,#5d3721 52%); }
    .police { left:34px; top:185px; width:126px; height:150px; }
    .law-office { right:34px; top:178px; width:142px; height:158px; }
    .filing { left:52px; bottom:128px; width:134px; height:150px; }
    .courthouse { right:46px; bottom:118px; width:158px; height:170px; background:linear-gradient(180deg,rgba(201,168,76,.18),rgba(255,255,255,.04)); }
    .courthouse:before { content:''; position:absolute; left:12px; right:12px; top:-22px; height:35px; clip-path:polygon(50% 0,100% 100%,0 100%); background:linear-gradient(180deg,rgba(201,168,76,.75),rgba(103,64,34,.92)); }
    .town-road { position:absolute; left:-10%; right:-10%; bottom:218px; height:112px; background:linear-gradient(180deg,#2c3038,#191c22); transform:rotate(-8deg); border-top:2px solid rgba(255,255,255,.12); border-bottom:2px solid rgba(255,255,255,.1); z-index:1; }
    .town-road:after { content:''; position:absolute; left:0; right:0; top:50%; height:4px; background:repeating-linear-gradient(90deg, rgba(255,255,255,.65) 0 32px, transparent 32px 58px); opacity:.65; }
    .town-crosswalk { position:absolute; left:48%; top:350px; width:86px; height:52px; transform:rotate(-8deg); z-index:2; background:repeating-linear-gradient(90deg, rgba(255,255,255,.72) 0 8px, transparent 8px 16px); opacity:.72; }
    .town-car { position:absolute; z-index:2; font-size:30px; filter:drop-shadow(0 6px 12px rgba(0,0,0,.3)); animation:carDrive 7s linear infinite; }
    .car-a { left:-20%; top:335px; } .car-b { right:-20%; top:383px; animation-direction:reverse; animation-duration:9s; }
    .town-character { position:absolute; z-index:5; width:56px; text-align:center; transition:left .5s ease, top .5s ease; }
    .char-body { font-size:34px; line-height:1; animation:charBob .85s ease-in-out infinite alternate; }
    .char-name { margin-top:2px; display:inline-flex; padding:2px 7px; border-radius:999px; background:rgba(0,0,0,.22); color:var(--cream); font-size:10px; font-weight:900; }
    .char-shadow { position:absolute; left:50%; bottom:16px; transform:translateX(-50%); width:28px; height:8px; border-radius:50%; background:rgba(0,0,0,.25); filter:blur(2px); }
    .hero-char { left:47%; top:66%; }
    .hero-char.walking .char-body { animation:walkBounce .18s ease-in-out infinite alternate; }
    .npc-a { left:22%; top:50%; } .npc-b { right:22%; top:49%; } .npc-c { left:51%; top:43%; }
    .town-speech { position:absolute; left:50%; bottom:20px; transform:translateX(-50%); z-index:7; width:calc(100% - 34px); max-width:510px; padding:13px 15px; border-radius:18px; border:1.5px solid rgba(201,168,76,.28); background:rgba(0,0,0,.32); backdrop-filter:blur(10px); box-shadow:0 10px 28px rgba(0,0,0,.24); }
    [data-theme="light"] .town-speech { background:rgba(255,255,255,.82); }
    .town-speech strong { display:block; font-size:12px; color:var(--gold); margin-bottom:4px; }
    .town-speech span { display:block; font-size:13px; color:var(--cream); line-height:1.55; }
    .town-action-panel { width:min(760px, calc(100% - 28px)); margin:0 auto; display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .town-action-panel button { border:none; border-radius:15px; padding:15px 12px; font-size:14px; font-weight:900; cursor:pointer; }
    .town-action-panel button:first-child { background:rgba(255,255,255,.06); color:var(--cream); border:1px solid rgba(201,168,76,.24); }
    .town-action-panel button:last-child { background:linear-gradient(135deg,var(--gold),var(--gold-light)); color:#0d1117; }
    @keyframes townGlow { from { opacity:.5; transform:translateX(-50%) scale(.95); } to { opacity:1; transform:translateX(-50%) scale(1.05); } }
    @keyframes cloudMove { from { transform:translateX(-12px); } to { transform:translateX(18px); } }
    @keyframes charBob { from { transform:translateY(0); } to { transform:translateY(-5px); } }
    @keyframes walkBounce { from { transform:translateY(0) rotate(-4deg); } to { transform:translateY(-8px) rotate(4deg); } }
    @keyframes carDrive { from { transform:translateX(0); } to { transform:translateX(140vw); } }
    @media (max-width:520px) { .town-map { height:585px; border-radius:22px; } .town-board { left:12px; top:12px; width:178px; padding:11px; } .town-board-row { font-size:10px; } .police { left:14px; top:174px; width:108px; height:136px; } .law-office { right:14px; top:170px; width:118px; height:140px; } .filing { left:18px; bottom:122px; width:112px; height:136px; } .courthouse { right:18px; bottom:116px; width:128px; height:150px; } .building-name { font-size:12px; } .building-sub { display:none; } .town-road { bottom:214px; height:100px; } .town-crosswalk { top:337px; } .npc-a { left:24%; top:51%; } .npc-b { right:24%; top:50%; } .npc-c { left:50%; top:44%; } .town-action-panel { grid-template-columns:1fr; } }
  `;
  document.head.appendChild(style);
}
