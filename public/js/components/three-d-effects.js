let styleInjected = false;
let raf = null;
let observer = null;

const SUPPORTED_HASHES = ['#/town', '#/case-quest', '#/debate/'];

function isSupportedRoute() {
  const hash = String(location.hash || '#/');
  return SUPPORTED_HASHES.some(h => hash.startsWith(h));
}

function boot3DEffects() {
  injectStyle();
  apply3DEffects();
  window.addEventListener('hashchange', () => setTimeout(apply3DEffects, 80));
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('deviceorientation', onTilt, { passive: true });

  if (!observer) {
    observer = new MutationObserver(() => {
      clearTimeout(window.__sosoking3dTimer);
      window.__sosoking3dTimer = setTimeout(apply3DEffects, 80);
    });
    observer.observe(document.getElementById('page-content') || document.body, { childList: true, subtree: true });
  }
}

function apply3DEffects() {
  document.body.classList.toggle('sosoking-3d-route', isSupportedRoute());
  if (!isSupportedRoute()) return;
  enhanceTown();
  enhanceQuest();
  enhanceCourtroom();
  addSceneParticles();
}

function enhanceTown() {
  const map = document.querySelector('.town-map');
  if (!map || map.dataset.threeD === '1') return;
  map.dataset.threeD = '1';
  map.classList.add('soso-3d-scene', 'town-3d-scene');
  map.insertAdjacentHTML('beforeend', `
    <div class="soso-depth-grid"></div>
    <div class="soso-3d-streetlight light-left"><span></span></div>
    <div class="soso-3d-streetlight light-right"><span></span></div>
    <div class="soso-floating-sign">CASE QUEST</div>
  `);
  map.querySelectorAll('.town-building').forEach((el, i) => {
    el.classList.add('soso-3d-card', `depth-${(i % 3) + 1}`);
    if (!el.querySelector('.building-side')) el.insertAdjacentHTML('beforeend', '<i class="building-side"></i><i class="building-shadow"></i>');
  });
  map.querySelectorAll('.town-character').forEach(el => el.classList.add('soso-3d-character'));
}

function enhanceQuest() {
  const stage = document.querySelector('.quest-stage');
  if (!stage || stage.dataset.threeD === '1') return;
  stage.dataset.threeD = '1';
  stage.classList.add('soso-3d-scene', 'quest-3d-scene');
  stage.insertAdjacentHTML('beforeend', `
    <div class="soso-depth-grid"></div>
    <div class="soso-evidence-orbit"><span>📱</span><span>🧾</span><span>⏰</span><span>🍗</span></div>
  `);
  stage.querySelectorAll('.quest-building, .quest-node').forEach(el => el.classList.add('soso-3d-card'));
  stage.querySelectorAll('.quest-npc, .quest-player').forEach(el => el.classList.add('soso-3d-character'));
}

function enhanceCourtroom() {
  const stage = document.querySelector('.vc-stage');
  if (!stage || stage.dataset.threeD === '1') return;
  stage.dataset.threeD = '1';
  stage.classList.add('courtroom-3d-stage');
  const room = stage.querySelector('.vc-courtroom');
  if (room && room.dataset.threeD !== '1') {
    room.dataset.threeD = '1';
    room.classList.add('soso-3d-scene', 'courtroom-3d-scene');
    room.insertAdjacentHTML('beforeend', `
      <div class="soso-depth-grid court-grid"></div>
      <div class="court-3d-light left"></div>
      <div class="court-3d-light right"></div>
    `);
  }
  stage.querySelectorAll('.vc-judge-bench,.vc-witness-stand,.vc-character,.vc-gallery').forEach(el => el.classList.add('soso-3d-card'));
  stage.querySelectorAll('.vc-avatar').forEach(el => el.classList.add('soso-3d-character'));
}

function addSceneParticles() {
  const host = document.querySelector('.town-map, .quest-stage, .vc-stage');
  if (!host || host.querySelector('.soso-3d-particles')) return;
  const layer = document.createElement('div');
  layer.className = 'soso-3d-particles';
  layer.innerHTML = Array.from({ length: 14 }).map((_, i) => `<i style="--i:${i};--x:${(i * 19) % 100};--d:${4 + (i % 5)}s"></i>`).join('');
  host.appendChild(layer);
}

function onPointerMove(e) {
  if (!isSupportedRoute()) return;
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    const x = (e.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2;
    const y = (e.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2;
    setTilt(x * 5, y * -4);
  });
}

function onTilt(e) {
  if (!isSupportedRoute()) return;
  const beta = Math.max(-8, Math.min(8, (e.beta || 0) / 6));
  const gamma = Math.max(-8, Math.min(8, (e.gamma || 0) / 6));
  setTilt(gamma, beta * -1);
}

function setTilt(rx, ry) {
  document.documentElement.style.setProperty('--soso-tilt-x', `${rx.toFixed(2)}deg`);
  document.documentElement.style.setProperty('--soso-tilt-y', `${ry.toFixed(2)}deg`);
  document.documentElement.style.setProperty('--soso-shift-x', `${(rx * 1.4).toFixed(2)}px`);
  document.documentElement.style.setProperty('--soso-shift-y', `${(ry * -1.2).toFixed(2)}px`);
}

function injectStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement('style');
  style.id = 'sosoking-three-d-effects-style';
  style.textContent = `
    :root { --soso-tilt-x: 0deg; --soso-tilt-y: 0deg; --soso-shift-x: 0px; --soso-shift-y: 0px; }
    body.sosoking-3d-route .soso-3d-scene { transform-style: preserve-3d; perspective: 950px; }
    body.sosoking-3d-route .town-3d-scene,
    body.sosoking-3d-route .quest-3d-scene,
    body.sosoking-3d-route .courtroom-3d-scene { transform: rotateX(var(--soso-tilt-y)) rotateY(var(--soso-tilt-x)); transition: transform .12s ease-out; will-change: transform; }
    .soso-depth-grid { position:absolute; inset:auto -18% -8px -18%; height:48%; z-index:1; pointer-events:none; background: linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px); background-size:32px 32px; transform: rotateX(68deg) translateZ(-50px); transform-origin:bottom center; opacity:.45; mask-image:linear-gradient(to top, black, transparent); }
    .court-grid { height:62%; opacity:.26; background-size:26px 26px; }
    .soso-3d-card { transform-style: preserve-3d; will-change: transform, filter; transition: transform .22s ease, filter .22s ease, box-shadow .22s ease; }
    .soso-3d-card:hover { transform: translateY(-6px) translateZ(32px) rotateX(2deg) rotateY(-3deg) !important; filter:brightness(1.08); }
    .depth-1 { transform: translateZ(18px); } .depth-2 { transform: translateZ(36px); } .depth-3 { transform: translateZ(54px); }
    .building-side { position:absolute; right:-12px; top:16px; bottom:8px; width:12px; border-radius:0 12px 8px 0; background:linear-gradient(180deg, rgba(0,0,0,.25), rgba(0,0,0,.48)); transform:skewY(-24deg); transform-origin:left top; pointer-events:none; }
    .building-shadow { position:absolute; left:10%; right:4%; bottom:-16px; height:18px; border-radius:50%; background:rgba(0,0,0,.28); filter:blur(8px); transform:rotateX(70deg) translateZ(-22px); pointer-events:none; }
    .soso-3d-character .char-body, .soso-3d-character.npc-body, .soso-3d-character span { filter: drop-shadow(0 14px 12px rgba(0,0,0,.32)); }
    .soso-3d-character { transform: translateZ(68px); }
    .soso-3d-streetlight { position:absolute; bottom:118px; width:16px; height:118px; z-index:4; background:linear-gradient(180deg,#5b4a2a,#1d1d1d); border-radius:999px; transform:translateZ(70px); box-shadow:0 10px 22px rgba(0,0,0,.28); }
    .soso-3d-streetlight:before { content:''; position:absolute; left:50%; top:-18px; transform:translateX(-50%); width:42px; height:24px; border-radius:24px 24px 8px 8px; background:linear-gradient(180deg,#f4d47a,#8d6a25); }
    .soso-3d-streetlight span { position:absolute; left:50%; top:-4px; transform:translateX(-50%); width:96px; height:96px; border-radius:50%; background:radial-gradient(circle, rgba(255,219,118,.32), transparent 65%); animation:sosoLamp 2.4s ease-in-out infinite alternate; }
    .soso-3d-streetlight.light-left { left:34%; } .soso-3d-streetlight.light-right { right:30%; }
    .soso-floating-sign { position:absolute; left:50%; top:118px; z-index:6; transform:translateX(-50%) translateZ(90px) rotateX(4deg); padding:8px 18px; border-radius:999px; border:1.5px solid rgba(201,168,76,.42); background:rgba(0,0,0,.32); color:var(--gold); font-size:11px; font-weight:900; letter-spacing:.14em; box-shadow:0 10px 26px rgba(0,0,0,.24); animation:sosoFloatSign 2.8s ease-in-out infinite alternate; }
    .soso-evidence-orbit { position:absolute; left:50%; top:50%; width:210px; height:210px; transform:translate(-50%,-50%) translateZ(80px); z-index:4; pointer-events:none; animation:sosoOrbit 10s linear infinite; opacity:.72; }
    .soso-evidence-orbit span { position:absolute; width:38px; height:38px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.24); border:1px solid rgba(201,168,76,.28); font-size:22px; box-shadow:0 8px 18px rgba(0,0,0,.22); }
    .soso-evidence-orbit span:nth-child(1){left:50%;top:0}.soso-evidence-orbit span:nth-child(2){right:0;top:50%}.soso-evidence-orbit span:nth-child(3){left:50%;bottom:0}.soso-evidence-orbit span:nth-child(4){left:0;top:50%}
    .courtroom-3d-stage { transform-style:preserve-3d; perspective:1100px; }
    .court-3d-light { position:absolute; top:-30px; width:170px; height:210px; z-index:4; pointer-events:none; background:radial-gradient(ellipse at 50% 0%, rgba(255,230,155,.28), transparent 66%); mix-blend-mode:screen; animation:sosoCourtLight 3s ease-in-out infinite alternate; }
    .court-3d-light.left { left:16%; transform:rotate(18deg) translateZ(80px); }
    .court-3d-light.right { right:16%; transform:rotate(-18deg) translateZ(80px); animation-delay:.7s; }
    .soso-3d-particles { position:absolute; inset:0; z-index:9; pointer-events:none; overflow:hidden; }
    .soso-3d-particles i { position:absolute; left:calc(var(--x) * 1%); bottom:-12px; width:4px; height:4px; border-radius:50%; background:rgba(201,168,76,.5); box-shadow:0 0 10px rgba(201,168,76,.55); animation:sosoParticle var(--d) linear infinite; animation-delay:calc(var(--i) * -.37s); opacity:.65; }
    body.sosoking-3d-route .town-speech,
    body.sosoking-3d-route .quest-card,
    body.sosoking-3d-route .vc-dialogue-panel { transform: translate3d(var(--soso-shift-x), var(--soso-shift-y), 90px); transition: transform .12s ease-out; }
    @keyframes sosoLamp { from { opacity:.55; transform:translateX(-50%) scale(.88); } to { opacity:1; transform:translateX(-50%) scale(1.12); } }
    @keyframes sosoFloatSign { from { transform:translateX(-50%) translateZ(90px) translateY(0); } to { transform:translateX(-50%) translateZ(90px) translateY(-8px); } }
    @keyframes sosoOrbit { to { transform:translate(-50%,-50%) translateZ(80px) rotate(360deg); } }
    @keyframes sosoCourtLight { from { opacity:.42; } to { opacity:1; } }
    @keyframes sosoParticle { from { transform:translateY(0) translateZ(20px); opacity:0; } 12% { opacity:.8; } to { transform:translateY(-115%) translateZ(120px); opacity:0; } }
    @media (prefers-reduced-motion: reduce) { .town-3d-scene,.quest-3d-scene,.courtroom-3d-scene,.soso-3d-card,.soso-evidence-orbit,.soso-3d-particles i { animation:none !important; transition:none !important; transform:none !important; } }
    @media (max-width:520px) { .soso-floating-sign { top:112px; font-size:10px; } .soso-3d-streetlight { height:88px; bottom:118px; } .soso-3d-streetlight.light-left { left:33%; } .soso-3d-streetlight.light-right { right:28%; } .soso-evidence-orbit { width:160px; height:160px; opacity:.48; } }
  `;
  document.head.appendChild(style);
}

boot3DEffects();
