import {initializeApp,getApps} from 'firebase/app';
import {getAuth,signInAnonymously,setPersistence,browserLocalPersistence,signOut} from 'firebase/auth';
import {getFirestore,doc,runTransaction,serverTimestamp} from 'firebase/firestore';
import {firebaseApp} from './flix-firebase-client.mjs';
import {dayOf,samplePlayback,STATS_FLUSH_MS,statsPayload} from './flix-stats-core.mjs';

let instance=null;
const blank=()=>({active:0,watch:0,works:Object.create(null)});
export async function startViewerStats(state,allowed){
 if(instance)return;
 const control={cancelled:false,auth:null,timer:null,flushTimer:null,visibilityHandler:null,pageHide:null};instance=control;
 try{
  const base=await firebaseApp();if(control.cancelled||!allowed())return;
  const app=getApps().find(a=>a.name==='sosoking-viewer-stats')||initializeApp(base.options,'sosoking-viewer-stats');
  const auth=control.auth=getAuth(app);await setPersistence(auth,browserLocalPersistence);await auth.authStateReady();
  if(control.cancelled||!allowed())return;
  const user=auth.currentUser?.isAnonymous?auth.currentUser:(await signInAnonymously(auth)).user;
  if(control.cancelled||!allowed())return;
  const db=getFirestore(app),uid=user.uid,firstDay=dayOf(Date.parse(user.metadata.creationTime)||Date.now());
  let bucket=blank(),day=dayOf(),last=performance.now(),busy=false,lastAttempt=0;
  function tick(){
   const now=performance.now(),newDay=dayOf();
   if(newDay!==day){day=newDay;bucket=blank();last=now;return;}
   samplePlayback(bucket,(now-last)/1000,{...state(),visible:document.visibilityState==='visible'});last=now;
  }
  async function flush({initial=false,leaving=false}={}){
   if(control.cancelled||!allowed()||busy||(!leaving&&document.visibilityState!=='visible')||Date.now()-lastAttempt<60000)return;
   tick();const sent=bucket,{active,watch,works:top}=statsPayload(sent);
   if(!initial&&active<1)return;
   bucket=blank();const d=day;busy=true;lastAttempt=Date.now();
   const playing=!leaving&&state().playing===true;
   try{
    await runTransaction(db,async tx=>{
     if(control.cancelled||!allowed()||dayOf()!==d)throw Error('Cancelled or day changed');
     const ref=doc(db,'flixViewerDays',uid+'_'+d),snap=await tx.get(ref),old=snap.data();
     // Suppress near-simultaneous writes from another visible tab of the same browser.
     if(old?.updatedAt&&Date.now()-old.updatedAt.toMillis()<45000)return;
     const refs=top.map(([id])=>doc(db,'flixViewerWorkDays',uid+'_'+d+'_'+id));
     const prev=await Promise.all(refs.map(x=>tx.get(x)));
     if(control.cancelled||!allowed()||dayOf()!==d)throw Error('Consent withdrawn or day changed');
     tx.set(ref,{uid,day:d,firstDay:Math.min(d,old?.firstDay??firstDay),activeSeconds:Math.min(86400,(old?.activeSeconds||0)+active),watchSeconds:Math.min(86400,(old?.watchSeconds||0)+watch),playing,updatedAt:serverTimestamp()});
     for(let i=0;i<refs.length;i++){
      const [workId,seconds]=top[i],before=prev[i].data();
      tx.set(refs[i],{uid,day:d,workId,watchSeconds:Math.min(86400,(before?.watchSeconds||0)+seconds),updatedAt:serverTimestamp()});
     }
    });
   }catch{/* Best-effort metrics never block viewing or replay an uncertain write. */}
   finally{busy=false;}
  }
  control.visibilityHandler=()=>{if(document.visibilityState==='hidden')void flush({leaving:true});last=performance.now();};
  control.pageHide=()=>{void flush({leaving:true});};
  document.addEventListener('visibilitychange',control.visibilityHandler);
  window.addEventListener('pagehide',control.pageHide);
  control.timer=setInterval(tick,1000);
  control.flushTimer=setInterval(()=>flush(),STATS_FLUSH_MS);
  await flush({initial:true});
 }catch{if(instance===control)instance=null;}
}
export async function stopViewerStats(){
 const control=instance;instance=null;if(!control)return;
 control.cancelled=true;clearInterval(control.timer);clearInterval(control.flushTimer);
 if(control.visibilityHandler)document.removeEventListener('visibilitychange',control.visibilityHandler);
 if(control.pageHide)window.removeEventListener('pagehide',control.pageHide);
 try{if(control.auth)await signOut(control.auth);}catch{}
}
