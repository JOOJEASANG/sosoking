const PC_HOME_SIDEBAR_ALIGN_STYLE_ID = 'sosoking-pc-home-sidebar-align-patch';

function injectPcHomeSidebarAlignStyle() {
  if (document.getElementById(PC_HOME_SIDEBAR_ALIGN_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PC_HOME_SIDEBAR_ALIGN_STYLE_ID;
  style.textContent = `
    @media (min-width: 901px) {
      html body.soso-mode-pc.soso-route-home .pc-home-like-shot .dash-shell {
        align-items: start !important;
      }

      html body.soso-mode-pc.soso-route-home .pc-home-like-shot .dash-main,
      html body.soso-mode-pc.soso-route-home .pc-home-like-shot .dash-sidebar {
        margin-top: 0 !important;
        padding-top: 0 !important;
        align-self: start !important;
      }

      html body.soso-mode-pc.soso-route-home .pc-home-like-shot .dash-sidebar {
        position: sticky !important;
        top: 96px !important;
        transform: none !important;
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 14px !important;
      }

      html body.soso-mode-pc.soso-route-home .pc-home-like-shot .dash-sidebar > .dash-side-card:first-child,
      html body.soso-mode-pc.soso-route-home .pc-home-like-shot .dash-sidebar > .popular {
        margin-top: 0 !important;
      }

      html body.soso-mode-pc.soso-route-home .pc-home-like-shot .dash-hero,
      html body.soso-mode-pc.soso-route-home .pc-home-like-shot .dash-sidebar > .dash-side-card:first-child {
        border-top-left-radius: 34px !important;
        border-top-right-radius: 34px !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function patchPcHomeSidebarAlign() {
  injectPcHomeSidebarAlignStyle();
  const isPcHome = window.matchMedia('(min-width: 901px)').matches && (location.hash === '' || location.hash === '#' || location.hash === '#/');
  document.body.classList.toggle('soso-pc-home-sidebar-aligned', Boolean(isPcHome && document.querySelector('.pc-home-like-shot .dash-sidebar')));
}

let scheduled = false;
function schedulePatch() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    patchPcHomeSidebarAlign();
  });
}

new MutationObserver(schedulePatch).observe(document.getElementById('page-content') || document.body, { childList: true, subtree: true });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedulePatch);
else schedulePatch();
window.addEventListener('hashchange', () => setTimeout(schedulePatch, 40));
window.addEventListener('resize', () => setTimeout(schedulePatch, 80));
setTimeout(schedulePatch, 0);
setTimeout(schedulePatch, 300);
setTimeout(schedulePatch, 1000);
