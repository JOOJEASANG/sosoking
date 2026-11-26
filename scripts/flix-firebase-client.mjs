import {initializeApp,getApps} from 'firebase/app';
let pending;
export async function firebaseApp(){if(!pending)pending=(async()=>{const response=await fetch('/__/firebase/init.json',{cache:'no-store'});if(!response.ok)throw Error('Firebase 웹 설정을 불러오지 못했습니다.');const config=await response.json();if(config.projectId!=='sosoking-481e6'||!config.apiKey||!config.appId)throw Error('소소킹 Firebase 웹 설정 확인 필요');return getApps().find(a=>a.name==='sosoking-flix')||initializeApp(config,'sosoking-flix')})().catch(e=>{pending=null;throw e});return pending}
