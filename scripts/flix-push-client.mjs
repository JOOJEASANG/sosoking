import {initializeApp,getApps} from 'firebase/app';
import {getAuth,setPersistence,browserLocalPersistence,signInAnonymously} from 'firebase/auth';
import {getFirestore,doc,setDoc,deleteDoc,serverTimestamp} from 'firebase/firestore';
import {getMessaging,getToken,deleteToken,isSupported} from 'firebase/messaging';
import {firebaseApp} from './flix-firebase-client.mjs';
import {pushBaseline} from '../public/flix/push-core.js';
import {dayOf} from './flix-stats-core.mjs';
async function context(){if(!await isSupported())throw Error('이 브라우저는 웹 푸시를 지원하지 않습니다.');const base=await firebaseApp(),app=getApps().find(a=>a.name==='sosoking-push')||initializeApp(base.options,'sosoking-push'),auth=getAuth(app);await setPersistence(auth,browserLocalPersistence);await auth.authStateReady();const user=auth.currentUser?.isAnonymous?auth.currentUser:(await signInAnonymously(auth)).user;return {ref:doc(getFirestore(app),'flixPushSubscriptions',user.uid),messaging:getMessaging(app)}}
export async function subscribePush(items,saved,vapidKey){if(Notification.permission!=='granted')throw Error('알림 권한이 필요합니다.');const seen=pushBaseline(items,saved);if(!Object.keys(seen).length)throw Error('먼저 작품을 찜해주세요.');const {ref,messaging}=await context(),registration=await navigator.serviceWorker.ready,token=await getToken(messaging,{vapidKey,serviceWorkerRegistration:registration});if(!token)throw Error('알림 등록 실패');await setDoc(ref,{token,seen:{...seen},day:dayOf(),updatedAt:serverTimestamp()});return true}
export async function unsubscribePush(){const {ref,messaging}=await context();const result=await Promise.allSettled([deleteDoc(ref),deleteToken(messaging)]);if(result.every(x=>x.status==='rejected'))throw Error('해제하지 못했습니다. 브라우저 사이트 권한에서도 알림을 차단해주세요.');return result.every(x=>x.status==='fulfilled')}
