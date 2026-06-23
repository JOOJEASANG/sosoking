/* sidebar.js — 소소킹 데스크톱 사이드바 */
import { auth, signOut } from '../firebase.js';
import { appState } from '../state.js';
import { navigate } from '../router.js';
import { escHtml } from '../utils/helpers.js';

function svgIcon(path, strokeWidth = '1.8') {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="${strokeWidth}" aria-hidden="true">${path}</svg>`;
}
function iconHome(){return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M3 11.5 12 4l9 7.5M5.5 10v10h13V10M9.5 20v-6h5v6"/>');}
function iconAccount(){return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>');}
function iconAdmin(){return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M19.4 15a8 8 0 0 0 .1-1 8 8 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7.7 7.7 0 0 0-1.7-1L15 5.5h-4L10.7 8a7.7 7.7 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a8 8 0 0 0-.1 1 8 8 0 0 0 .1 1l-2 1.5 2 3.5 2.4-1a7.7 7.7 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7.7 7.7 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5Z"/>');}
function iconSun(){return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.41-1.41M4.93 19.07l1.41-1.41m0-11.32L4.93 4.93m14.14 14.14-1.41-1.41"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/>');}
function iconMoon(){return svgIcon('<path stroke-linecap="round" stroke-linejoin="round" d="M21 15.5A8.5 8.5 0 0 1 8.5 3 8.5 8.5 0 1 0 21 15.5Z"/>');}
function isDark(){return document.documentElement.getAttribute('data-theme')==='dark';}
function isNavActive(navPath,currentPath){if(navPath==='/playground')return currentPath.startsWith('/playground');if(navPath==='/materials')return currentPath==='/materials'||currentPath.startsWith('/material/');if(navPath==='/debates')return currentPath==='/debates'||currentPath.startsWith('/debate/');return currentPath===navPath;}
function renderNavItem(item,currentPath){const active=isNavActive(item.path,currentPath);const cls=['sidebar__nav-item',active?'active':'',item.isAdmin?'sidebar__nav-item--admin':''].filter(Boolean).join(' ');return `<a href="#${item.path}" class="${cls}" aria-current="${active?'page':'false'}" data-nav="${item.path}">${item.icon}<span>${item.label}</span></a>`;}

export function renderSidebar(){
  const element=document.getElementById('site-sidebar');
  if(!element)return;
  const user=appState.user;
  const isAdmin=appState.isAdmin;
  const path=window.location.hash.slice(1).split('?')[0]||'/';
  const dark=isDark();
  const mainNav=[
    {label:'홈',path:'/',icon:iconHome()},
    {label:'🤖 AI 놀이터',path:'/playground',icon:''},
    {label:'📅 오늘의 콘텐츠',path:'/today',icon:''},
    {label:'📚 소소자료실',path:'/materials',icon:''},
    {label:'💬 소소토론실',path:'/debates',icon:''},
  ];
  const personalNav=user?[{label:'내정보',path:'/account',icon:iconAccount()}]:[];
  const adminNav=isAdmin?[{label:'관리 패널',path:'/admin',icon:iconAdmin(),isAdmin:true}]:[];
  const nickname=appState.nickname||user?.displayName||user?.email?.split('@')[0]||'사용자';
  const avatarInner=user?.photoURL?`<img src="${escHtml(user.photoURL)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`:escHtml((nickname||'나')[0]);
  const userSection=user?`<div class="sidebar__user-wrap"><div class="sidebar__user"><div class="sidebar__user-avatar" id="sb-avatar" role="button" tabindex="0" aria-label="내 정보">${avatarInner}</div><div class="sidebar__user-info"><div class="sidebar__user-name" id="sb-username">${escHtml(nickname)}</div>${isAdmin?'<div class="sidebar__user-role">🔑 관리자</div>':''}</div></div><button class="sidebar__logout-btn" id="sb-logout-btn" aria-label="로그아웃"><span>로그아웃</span></button></div>`:`<a href="#/login" class="sidebar__login-btn">로그인 / 가입</a>`;
  element.innerHTML=`<div class="sidebar__logo"><a href="#/" class="sidebar__brand" aria-label="소소킹 홈" data-nav="/"><img src="/logo.svg" alt="" width="28" height="28"><span class="sidebar__brand-name">소소킹</span></a></div><nav class="sidebar__nav" aria-label="주 내비게이션">${mainNav.map(item=>renderNavItem(item,path)).join('')}${personalNav.length?`<div class="sidebar__nav-divider"></div>${personalNav.map(item=>renderNavItem(item,path)).join('')}`:''}${adminNav.length?`<div class="sidebar__nav-divider"></div><div class="sidebar__nav-section-label">관리</div>${adminNav.map(item=>renderNavItem(item,path)).join('')}`:''}</nav><div class="sidebar__write"><button class="sidebar__write-btn" id="sb-main-btn" aria-label="AI 판결 시작"><span style="font-size:18px">⚖️</span><span>AI 판결 시작</span></button></div><div class="sidebar__bottom">${userSection}<div class="sidebar__footer-utils"><button class="sidebar__util-btn" id="sb-theme-btn" aria-label="${dark?'라이트 모드로 전환':'다크 모드로 전환'}">${dark?iconSun():iconMoon()}<span>${dark?'라이트 모드':'다크 모드'}</span></button></div></div>`;
  element.querySelectorAll('[data-nav]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();navigate(link.dataset.nav);}));
  document.getElementById('sb-main-btn')?.addEventListener('click',()=>navigate('/playground/judge'));
  document.getElementById('sb-avatar')?.addEventListener('click',()=>navigate('/account'));
  document.getElementById('sb-username')?.addEventListener('click',()=>navigate('/account'));
  document.getElementById('sb-logout-btn')?.addEventListener('click',async()=>{await signOut(auth);navigate('/');});
  document.getElementById('sb-theme-btn')?.addEventListener('click',()=>{const next=isDark()?'light':'dark';document.documentElement.setAttribute('data-theme',next);localStorage.setItem('theme',next);window.dispatchEvent(new CustomEvent('themechange',{detail:{theme:next}}));renderSidebar();});
}

window.addEventListener('hashchange',()=>{
  const element=document.getElementById('site-sidebar');
  if(!element)return;
  const path=window.location.hash.slice(1).split('?')[0]||'/';
  element.querySelectorAll('[data-nav]').forEach(link=>{const active=isNavActive(link.dataset.nav,path);link.classList.toggle('active',active);link.setAttribute('aria-current',active?'page':'false');});
});
