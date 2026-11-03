import {firebaseConfig} from './firebase-config.js';
const status=document.getElementById('live-status');
const auth=document.getElementById('live-auth');
const active=['apiKey','authDomain','projectId','appId'].every(key=>{
  const value=firebaseConfig[key];
  return typeof value==='string' && value.length>6 && !value.startsWith('REPLACE');
});
if(active){
  import('./live-chat.js').catch(()=>{
    auth.hidden=true;
    status.textContent='추억방 서버 연결에 실패했습니다. 번호 변환과 주소록은 정상적으로 이용할 수 있습니다.';
  });
}else{
  auth.hidden=true;
  status.textContent='추억방의 회원가입·실시간 채팅은 준비 중입니다. 번호 변환, 연락처 정리, 안부 문자, 추억방 체험은 지금 바로 무료로 이용할 수 있습니다.';
}
