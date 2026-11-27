const $=id=>document.getElementById(id);
const account=$('memberAccount'),dialog=$('memberDialog'),login=$('memberGoogle'),logout=$('memberLogout'),status=$('memberStatus'),name=$('memberName'),label=$('memberLabel');
let profile=null,connection=null,pending=null,busy=false;
function photoUrl(value){try{const u=new URL(value);if(u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(u.hostname==='googleusercontent.com'||u.hostname.endsWith('.googleusercontent.com')||u.hostname==='ggpht.com'||u.hostname.endsWith('.ggpht.com')))return u.href}catch{}return ''}
function paintPhoto(img,fallback,url){img.hidden=true;img.removeAttribute('src');fallback.hidden=false;if(!url)return;img.onload=()=>{if(img.getAttribute('src')!==url)return;img.hidden=false;fallback.hidden=true};img.onerror=()=>{if(img.getAttribute('src')!==url)return;img.hidden=true;fallback.hidden=false};img.src=url}
function paint(){const text=profile?.name||'Google 회원';label.textContent=profile?text:'로그인';account.setAttribute('aria-label',profile?'내 계정 · '+text:'Google 로그인');name.textContent=profile?text:'Google 계정으로 시작하기';$('memberGuest').hidden=!!profile;$('memberSignedIn').hidden=!profile;login.disabled=busy||!connection;logout.disabled=busy||!connection;const url=photoUrl(profile?.photo);paintPhoto($('memberAvatar'),$('memberIcon'),url);paintPhoto($('memberLargeAvatar'),$('memberLargeIcon'),url)}
async function prepare(){if(connection)return connection;if(pending)return pending;status.textContent='Google 로그인 준비 중…';pending=import('/member-auth.js').then(m=>m.connectMember(value=>{profile=value;status.textContent='';paint()})).then(c=>{connection=c;status.textContent='';paint();return c}).catch(()=>{status.textContent='로그인 연결을 준비하지 못했습니다. 닫은 후 다시 열어주세요. 일반 시청은 계속 이용할 수 있습니다.';return null}).finally(()=>{pending=null});return pending}
function close(){if(dialog.open)dialog.close()}
account.onclick=()=>{if(!dialog.open)dialog.showModal();prepare()};
$('memberClose').onclick=close;
dialog.addEventListener('click',e=>{if(e.target===dialog)close()});
function errorMessage(e){switch(e?.code){case 'auth/popup-closed-by-user':return '로그인 창을 닫았습니다.';case 'auth/popup-blocked':return '팝업 차단을 해제한 뒤 다시 시도해주세요.';case 'auth/operation-not-allowed':return 'Google 로그인 설정이 아직 활성화되지 않았습니다.';case 'auth/unauthorized-domain':return '이 사이트의 로그인 도메인 설정을 확인해주세요.';default:return 'Google 로그인에 실패했습니다. 연결 상태를 확인하고 다시 시도해주세요.'}}
login.onclick=async()=>{if(!connection||busy)return;busy=true;paint();status.textContent='Google 로그인 중…';try{await connection.signIn();status.textContent=''}catch(e){status.textContent=errorMessage(e)}finally{busy=false;paint()}};
logout.onclick=async()=>{if(!connection||busy)return;busy=true;paint();try{await connection.signOut();profile=null;status.textContent='로그아웃했습니다.'}catch{status.textContent='로그아웃에 실패했습니다. 다시 시도해주세요.'}finally{busy=false;paint()}};
paint();prepare();
