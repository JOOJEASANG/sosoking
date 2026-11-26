import {initializeApp,getApps} from 'firebase/app';
import {getAuth,setPersistence,browserLocalPersistence,signInAnonymously} from 'firebase/auth';
import {getFirestore,doc,runTransaction,serverTimestamp} from 'firebase/firestore';
import {firebaseApp} from './flix-firebase-client.mjs';
import {submissionVideoId} from '../public/flix/intake-core.js';
import {dayOf} from './flix-stats-core.mjs';
export async function submitWork(input,kind){const videoId=submissionVideoId(input);if(!['suggestion','creator'].includes(kind))throw Error('신청 유형 확인 필요');const base=await firebaseApp(),app=getApps().find(a=>a.name==='sosoking-intake')||initializeApp(base.options,'sosoking-intake'),auth=getAuth(app);await setPersistence(auth,browserLocalPersistence);await auth.authStateReady();const user=auth.currentUser?.isAnonymous?auth.currentUser:(await signInAnonymously(auth)).user;const db=getFirestore(app),day=dayOf(),ref=doc(db,'flixSubmissions',user.uid+'_'+day);await runTransaction(db,async tx=>{if((await tx.get(ref)).exists())throw Error('하루에 한 번만 신청할 수 있습니다.');tx.set(ref,{uid:user.uid,day,kind,videoId,status:'pending',createdAt:serverTimestamp()})});return true}
