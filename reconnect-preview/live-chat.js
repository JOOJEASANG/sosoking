import {initializeApp} from 'firebase/app';
import {getAuth,onAuthStateChanged,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,updateProfile} from 'firebase/auth';
import {getFirestore,collection,doc,addDoc,setDoc,getDoc,deleteDoc,updateDoc,onSnapshot,query,orderBy,limit,serverTimestamp,Timestamp} from 'firebase/firestore';
import {firebaseConfig} from './firebase-config.js';
const $=id=>document.getElementById(id);
const state={auth:null,db:null,user:null,roomId:null,unsubRooms:null,unsubMessages:null,unsubStories:null,rooms:[],lastInvite:null};
function status(message,error=false){$('live-status').textContent=message;$('live-status').style.color=error?'#9e3c36':'#356c5d';}
function button(text,fn){const b=document.createElement('button');b.className='btn alt';b.type='button';b.textContent=text;b.addEventListener('click',fn);return b;}
function errorText(error){const code=error?.code||'';const map={'auth/email-already-in-use':'이미 등록된 이메일입니다.','auth/invalid-email':'올바른 이메일을 입력하세요.','auth/weak-password':'비밀번호는 6자 이상이어야 합니다.','auth/invalid-credential':'이메일이나 비밀번호를 확인하세요.','permission-denied':'권한이 없습니다. Firebase 보안 규칙 및 초대 상태를 확인하세요.','auth/operation-not-allowed':'Firebase 콘솔에서 이메일/비밀번호 로그인을 활성화하세요.'};return map[code]||('작업 실패: '+(code||'연결 상태를 확인하세요.'));}
async function profile(){const name=$('live-nick').value.trim();if(name && name.length<=30 && state.user && state.user.displayName!==name){await updateProfile(state.user,{displayName:name});}}
async function userAction(type){try{const email=$('live-email').value.trim(),pw=$('live-password').value;if(!email||pw.length<6){status('이메일과 6자 이상 비밀번호를 입력하세요.',true);return;}const cred=type==='join'?await createUserWithEmailAndPassword(state.auth,email,pw):await signInWithEmailAndPassword(state.auth,email,pw);state.user=cred.user;await profile();$('live-password').value='';status('로그인했습니다.');}catch(e){status(errorText(e),true);}}
function showRooms(){const holder=$('room-list');holder.replaceChildren();if(!state.rooms.length){holder.textContent='참가한 방이 없습니다. 먼저 추억방을 만들어 보세요.';return;}for(const room of state.rooms){const row=document.createElement('div');row.className='entry';const text=document.createElement('span');text.textContent=(room.title||'추억방')+(room.closed?' (종료됨)':'');row.append(text,button('입장',()=>openRoom(room.id)));holder.appendChild(row);}}
async function openRoom(id){if(state.unsubMessages)state.unsubMessages();if(state.unsubStories)state.unsubStories();state.roomId=id;const match=state.rooms.find(x=>x.id===id);$('room-title').textContent=(match?.title||'추억방')+' · 실시간 채팅';$('room-controls').hidden=false;const screen=$('live-screen');screen.replaceChildren();$('make-invite').disabled=Boolean(match?.closed);
$('live-chat-input').disabled=Boolean(match?.closed);
$('story-form').querySelector('button').disabled=Boolean(match?.closed);
$('close-room').hidden=false;
if(match){$('close-room').hidden=match.ownerUid!==state.user?.uid || Boolean(match.closed);}
status(match?.closed?'이 방은 운영이 종료되어 메시지를 보낼 수 없습니다.':'방에 입장했습니다.');state.unsubMessages=onSnapshot(query(collection(state.db,'rooms',id,'messages'),orderBy('createdAt','desc'),limit(60)),snapshot=>{screen.replaceChildren();for(const snap of snapshot.docs.slice().reverse()){const m=snap.data();const line=document.createElement('div');line.className='chat';const time=m.createdAt?.toDate?.()?.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})||'';line.textContent='['+String(m.displayName||'친구').slice(0,30)+'] '+String(m.text||'').slice(0,600)+'  '+time;screen.appendChild(line);}screen.scrollTop=screen.scrollHeight;},e=>status(errorText(e),true));
state.unsubStories=onSnapshot(query(collection(state.db,'rooms',id,'stories'),orderBy('createdAt','desc'),limit(40)),snapshot=>{
 const holder=$('story-list');holder.replaceChildren();
 if(snapshot.empty){holder.textContent='아직 작성된 추억이 없습니다.';return;}
 for(const entry of snapshot.docs){
  const story=entry.data(),card=document.createElement('article');card.className='story-card';
  const header=document.createElement('strong');header.textContent=(story.year?story.year+'년 · ':'')+String(story.title||'').slice(0,80);
  const meta=document.createElement('small');meta.textContent='작성: '+String(story.displayName||'친구').slice(0,30);
  const body=document.createElement('p');body.textContent=String(story.body||'').slice(0,1200);
  card.append(header,document.createElement('br'),meta,body);
  if(story.uid===state.user?.uid || match?.ownerUid===state.user?.uid){
    card.append(button('글 삭제',async()=>{
      if(!confirm('이 추억 글을 삭제하시겠습니까?'))return;
      try{await deleteDoc(doc(state.db,'rooms',id,'stories',entry.id));}catch(e){status(errorText(e),true);}
    }));
  }
  holder.appendChild(card);
 }
},e=>status(errorText(e),true));
}
function roomsSubscribe(uid){if(state.unsubRooms)state.unsubRooms();state.unsubRooms=onSnapshot(collection(state.db,'users',uid,'rooms'),snapshot=>{state.rooms=snapshot.docs.map(d=>({id:d.id,...d.data()}));showRooms();},e=>status(errorText(e),true));}
async function createRoom(){try{if(!state.user)throw Error('로그인 필요');const title=$('new-room-title').value.trim().slice(0,60);if(!title){status('방 이름을 입력하세요.',true);return;}const room=await addDoc(collection(state.db,'rooms'),{ownerUid:state.user.uid,title,closed:false,createdAt:serverTimestamp()});await setDoc(doc(state.db,'rooms',room.id,'members',state.user.uid),{uid:state.user.uid,joinedAt:serverTimestamp(),inviteToken:'owner'});await setDoc(doc(state.db,'users',state.user.uid,'rooms',room.id),{title,ownerUid:state.user.uid,closed:false,joinedAt:serverTimestamp()});$('new-room-title').value='';await openRoom(room.id);status('추억방을 만들었습니다. 초대 링크를 전달해 보세요.');}catch(e){status(errorText(e),true);}}
async function makeInvite(){try{const id=state.roomId;if(!id){status('먼저 방을 선택하세요.',true);return;}const room=await getDoc(doc(state.db,'rooms',id));if(room.data()?.ownerUid!==state.user.uid){status('초대 링크는 방장만 만들 수 있습니다.',true);return;}const token=crypto.randomUUID();await setDoc(doc(state.db,'invites',token),{roomId:id,ownerUid:state.user.uid,title:room.data().title,createdAt:serverTimestamp(),expiresAt:Timestamp.fromMillis(Date.now()+7*86400000)});state.lastInvite=token;const url=location.origin+location.pathname+'#invite='+encodeURIComponent(token);$('invite-output').value=url;try{await navigator.clipboard.writeText(url);status('초대 링크를 만들고 복사했습니다.');}catch{status('초대 링크를 만들었습니다. 아래 링크를 복사하세요.');}}catch(e){status(errorText(e),true);}}
async function joinInvite(){try{const v=$('invite-input').value.trim();const token=(v.match(/(?:#invite=|^)([a-f0-9-]{36})/i)||[])[1];if(!token){status('올바른 초대 링크 또는 코드가 아닙니다.',true);return;}if(!state.user){status('초대방 입장은 먼저 회원가입 또는 로그인이 필요합니다.',true);return;}const invitation=await getDoc(doc(state.db,'invites',token));if(!invitation.exists()){status('존재하지 않거나 만료된 초대 링크입니다.',true);return;}const {roomId,title}=invitation.data();await setDoc(doc(state.db,'rooms',roomId,'members',state.user.uid),{uid:state.user.uid,inviteToken:token,joinedAt:serverTimestamp()});await setDoc(doc(state.db,'users',state.user.uid,'rooms',roomId),{title,ownerUid:invitation.data().ownerUid,closed:false,joinedAt:serverTimestamp()});status('초대방에 참가했습니다.');await openRoom(roomId);history.replaceState(null,'',location.pathname+'#room');}catch(e){status(errorText(e),true);}}
async function sendMessage(e){e.preventDefault();const input=$('live-chat-input'),text=input.value.trim();if(!state.user||!state.roomId||!text)return;if(text.length>600){status('한 메시지는 600자 이하로 작성하세요.',true);return;}try{await addDoc(collection(state.db,'rooms',state.roomId,'messages'),{uid:state.user.uid,displayName:String(state.user.displayName||state.user.email?.split('@')[0]||'친구').slice(0,30),text,createdAt:serverTimestamp()});input.value='';}catch(e){status(errorText(e),true);}}
async function leaveRoom(){if(!state.user||!state.roomId)return;if(!confirm('이 추억방에서 나가시겠습니까?'))return;try{const id=state.roomId;const r=await getDoc(doc(state.db,'rooms',id));if(r.data()?.ownerUid===state.user.uid){status('방장은 나갈 수 없습니다. 방 정리 기능은 정식 운영 전에 추가됩니다.',true);return;}await deleteDoc(doc(state.db,'rooms',id,'members',state.user.uid));await deleteDoc(doc(state.db,'users',state.user.uid,'rooms',id));state.unsubMessages?.();state.unsubStories?.();state.roomId=null;$('room-controls').hidden=true;status('방에서 나왔습니다.');}catch(e){status(errorText(e),true);}}

async function postStory(e){
 e.preventDefault();
 if(!state.user || !state.roomId){status('방을 먼저 선택하세요.',true);return;}
 const title=$('story-title').value.trim(),body=$('story-body').value.trim(),year=$('story-year').value.trim();
 if(!title || !body || title.length>80 || body.length>1200 || (year && !/^[0-9]{4}$/.test(year))){status('제목, 내용 또는 연도를 확인하세요.',true);return;}
 try{
  await addDoc(collection(state.db,'rooms',state.roomId,'stories'),{
   uid:state.user.uid,displayName:String(state.user.displayName||state.user.email?.split('@')[0]||'친구').slice(0,30),
   year,title,body,createdAt:serverTimestamp()
  });
  $('story-title').value='';$('story-body').value='';$('story-year').value='';
  status('추억 글을 저장했습니다.');
 }catch(e){status(errorText(e),true);}
}

async function revokeInvite(){
 if(!state.user||!state.lastInvite){status('현재 화면에서 생성한 초대 링크가 없습니다.',true);return;}
 try{await deleteDoc(doc(state.db,'invites',state.lastInvite));state.lastInvite=null;$('invite-output').value='';status('이 화면에서 마지막으로 만든 초대 링크를 무효화했습니다. 다른 링크는 별도 관리가 필요합니다.');}
 catch(e){status(errorText(e),true);}
}
async function closeRoom(){
 if(!state.user||!state.roomId||!confirm('이 방을 종료하시겠습니까? 기존 메시지는 서버에 남지만 새 메시지와 신규 초대는 차단됩니다.'))return;
 try{
  const id=state.roomId,room=await getDoc(doc(state.db,'rooms',id));
  if(room.data()?.ownerUid!==state.user.uid){status('방장만 종료할 수 있습니다.',true);return;}
  await updateDoc(doc(state.db,'rooms',id),{closed:true,closedAt:serverTimestamp()});
  await updateDoc(doc(state.db,'users',state.user.uid,'rooms',id),{closed:true});
  $('make-invite').disabled=true;$('live-chat-input').disabled=true;$('story-form').querySelector('button').disabled=true;$('close-room').hidden=true;
  status('방을 종료했습니다. 기존 자료는 서버에서 자동 삭제되지 않습니다.');
 }catch(e){status(errorText(e),true);}
}

$('live-register').onclick=()=>userAction('join');$('live-login').onclick=()=>userAction('login');
$('live-logout').onclick=()=>signOut(state.auth);
$('create-room').onclick=createRoom;$('make-invite').onclick=makeInvite;$('join-invite').onclick=joinInvite;
$('live-chat-form').onsubmit=sendMessage;$('story-form').onsubmit=postStory;$('leave-room').onclick=leaveRoom;$('revoke-invite').onclick=revokeInvite;$('close-room').onclick=closeRoom;
const valid=Boolean(firebaseConfig.apiKey&&firebaseConfig.projectId&&firebaseConfig.authDomain&&!firebaseConfig.apiKey.startsWith('REPLACE'));
if(!valid){$('live-auth').hidden=true;status('실시간 채팅은 아직 설정 전입니다. Firebase 연결 정보와 보안 규칙을 적용하면 활성화됩니다.');}
else{try{const app=initializeApp(firebaseConfig);state.auth=getAuth(app);state.db=getFirestore(app);onAuthStateChanged(state.auth,user=>{state.user=user;const yes=Boolean(user);$('live-auth').hidden=yes;$('live-members').hidden=!yes;$('live-user').textContent=yes?'접속: '+(user.displayName||user.email):'';if(state.unsubRooms){state.unsubRooms();state.unsubRooms=null;}if(state.unsubMessages){state.unsubMessages();state.unsubMessages=null;}if(state.unsubStories){state.unsubStories();state.unsubStories=null;}state.roomId=null;state.lastInvite=null;$('room-controls').hidden=true;state.rooms=[];showRooms();if(yes){roomsSubscribe(user.uid);status('추억방을 만들거나 초대 코드로 참가할 수 있습니다.');if(location.hash.startsWith('#invite=')){$('invite-input').value=location.href;joinInvite();}}else{status('추억방을 이용하려면 로그인하세요.');}},e=>status(errorText(e),true));}catch(e){status('Firebase 초기화 실패: '+e.message,true);}}
