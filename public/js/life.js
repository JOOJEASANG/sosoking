import {collection,getDocs,query,where,limit} from 'firebase/firestore';
import {GoogleAuthProvider,linkWithPopup,signInWithPopup,signOut} from 'firebase/auth';
import {$,page,qs,node,btn,link,user,list,save,copy,empty,download,actionRow,dateText,errText} from './life-shared.js';
import {validId} from './life-core.js';
import {initPolls} from './life-polls.js';
import {initLocalOrders,initShift} from './life-local.js';
import {initBoard,recentPosts,loadMyContent,loadModeration,postUrl} from './life-board.js';
import {initLocalFerry} from './local-ferry.js';
import {initSettlement} from './life-settlement.js';
import {initFieldInfo} from './field-info.js';
import {initGroupPlan} from './group-plan.js';
import {initMemories} from './memories.js';
import {initElection} from './election.js';
const navName=page==='index.html'?(location.hash==='#programs'?'tools':'home'):(page==='ferry.html'||page==='info.html')?'info':page==='community.html'?'community':page==='my.html'?'my':page==='help.html'?'': 'tools';
function navSync(){let name=page==='index.html'?(location.hash==='#programs'?'tools':'home'):navName;document.querySelectorAll('[data-nav]').forEach(a=>{if(a.dataset.nav===name)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')})}navSync();addEventListener('hashchange',navSync);
const favoritesAllowed=new Set(['/old-phone.html','/event.html','/ferry.html','/orders.html','/community.html?category=생활정보','/info.html','/settlement.html','/group-plan.html','/memories.html','/election.html']);
function initHome(){let filter='';function apply(){const search=$('#toolSearch').value.trim().toLowerCase().split(/\s+/).filter(Boolean);let count=0;document.querySelectorAll('[data-tool]').forEach(n=>{const hay=n.dataset.tool.toLowerCase();n.hidden=!(n.dataset.tool.includes(filter)&&search.every(s=>hay.includes(s)))||(!search.length&&n.closest('#lifeInfo')!==null);if(!n.hidden)count++});$('#noTools').hidden=count>0;document.querySelectorAll('.catalog-group').forEach(g=>{g.hidden=![...g.querySelectorAll('[data-tool]')].some(t=>!t.hidden)})}$('#toolSearch').addEventListener('input',apply);document.querySelectorAll('[data-filter]').forEach(n=>n.addEventListener('click',()=>{filter=n.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('active',b===n);b.setAttribute('aria-pressed',String(b===n))});apply()}));document.querySelectorAll('[data-favorite]').forEach(n=>{const path=n.dataset.favorite;function sync(){const on=list('favorites').some(f=>f.path===path);n.textContent=on?'★':'☆';n.setAttribute('aria-pressed',String(on))}sync();n.addEventListener('click',()=>{let a=list('favorites');if(a.some(f=>f.path===path))a=a.filter(f=>f.path!==path);else a.push({path,title:n.closest('.tool').querySelector('h3').textContent});save('favorites',a);sync()})});$('#toolSearch').value=qs.get('q')||'';apply()}
function localList(target,items,make,placeholder){target.replaceChildren();for(const x of items){const d=make(x);if(d)target.append(d)}if(!target.children.length)empty(target,placeholder)}
async function initMy(){
 localList($('#favorites'),list('favorites').filter(x=>favoritesAllowed.has(x.path)),x=>{const d=node('div',undefined,'entry');d.append(link(x.path==='/memories.html'?'언제 했더라?':x.title,x.path),actionRow(btn('삭제',()=>{save('favorites',list('favorites').filter(a=>a.path!==x.path));d.remove()})));return d},'메인 화면의 별표를 눌러 자주 사용하는 프로그램을 추가하세요.');
 localList($('#savedPosts'),list('saved-posts').filter(x=>validId(x.id)),x=>{const d=node('div',undefined,'entry');d.append(link(x.title,postUrl(x)),actionRow(btn('저장 해제',()=>{save('saved-posts',list('saved-posts').filter(a=>a.id!==x.id));d.remove()})));return d},'저장한 생활정보가 없습니다.');
 $('#downloadLoans').addEventListener('click',()=>download('sosoking-loans-backup.json',JSON.stringify(list('loans'),null,2),'application/json;charset=utf-8'));
 try{const {store,auth,uid}=await user();const anon=auth.currentUser.isAnonymous;$('#accountStatus').textContent=anon?'현재 기기에 연결된 익명 계정 · 계정 연결로 관리 권한을 보존할 수 있습니다.':'연결된 계정으로 이용 중입니다.';$('#accountConnect').hidden=!anon;$('#accountSignIn').hidden=!anon;$('#accountSignOut').hidden=anon;
 const provider=new GoogleAuthProvider(),out=$('#accountMessage');
 $('#copyUid').addEventListener('click',async()=>{if(await copy(uid))out.textContent='현재 계정 ID가 복사되었습니다.'});
 $('#accountConnect').addEventListener('click',async()=>{try{await linkWithPopup(auth.currentUser,provider);location.reload()}catch(e){out.textContent='연결 실패: Google 인증이 활성화되어 있는지 확인하세요. '+errText(e)}});
 $('#accountSignIn').addEventListener('click',async()=>{if(!confirm('기존 계정으로 로그인하면 현재 익명 계정의 작성 권한이 합쳐지지 않습니다. 계속할까요?'))return;try{await signInWithPopup(auth,provider);location.reload()}catch(e){out.textContent='로그인 실패: '+errText(e)}});
 $('#accountSignOut').addEventListener('click',async()=>{if(confirm('로그아웃할까요?')){await signOut(auth);location.reload()}});
 try{const s=await getDocs(query(collection(store,'lifePolls'),where('owner','==',uid),limit(100)));const items=s.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));localList($('#myEvents'),items,p=>{const d=node('div',undefined,'entry'),done=p.closed||Boolean(p.deadline&&p.deadline.toMillis()<=Date.now());d.append(node('span',done?'마감':'진행 중','tag'+(done?' warn':'')),node('h3',p.title),node('p',(p.mode==='order'?'공동 주문':'모임 조사')+' · '+dateText(p.createdAt)),link('집계·관리 →',(p.mode==='order'?'/orders.html':'/event.html')+'?id='+p.id,'secondary'));return d},'아직 만든 모임이나 공동 주문이 없습니다.')}catch(e){const old=list('events').filter(x=>validId(x.id));localList($('#myEvents'),old,p=>{const d=node('div',undefined,'entry');d.append(link(p.title,(p.mode==='order'?'/orders.html':'/event.html')+'?id='+p.id));return d},'모임 목록을 불러오지 못했습니다.')}
 try{await loadMyContent(store,uid)}catch(e){empty($('#myPosts'),'작성한 글을 불러오지 못했습니다. '+errText(e))}
 try{await loadModeration(store,uid)}catch(e){out.textContent='운영자 권한 확인 실패'}
 }catch(e){$('#accountStatus').textContent='계정을 연결하지 못했습니다. 연결을 확인하세요.';empty($('#myEvents'),'서버 연결이 필요합니다.');empty($('#myPosts'),'서버 연결이 필요합니다.')}
}
if(page==='tools.html')initHome();
if(page==='community.html'||page==='ferry.html')initBoard();
if(page==='event.html'||page==='orders.html')initPolls();
if(page==='orders.html')initLocalOrders();
if(page==='shift.html')initShift();
if(page==='my.html')initMy();

if(page==='ferry.html')initLocalFerry();
if(page==='settlement.html')initSettlement();
if(page==='community.html'&&qs.get('search')){$('#postSearch').value=qs.get('search');$('#postSearch').dispatchEvent(new Event('input'));}

if(page==='info.html'){const k=$('#fieldKind');if(qs.get('kind')&&[...k.options].some(x=>x.value===qs.get('kind')))k.value=qs.get('kind');initFieldInfo();}

if(page==='group-plan.html')initGroupPlan();

if(page==='memories.html')initMemories();

if(page==='election.html')initElection();
