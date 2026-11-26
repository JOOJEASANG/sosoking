import {getMessaging} from 'firebase-admin/messaging';
import {pushChanges} from '../public/flix/push-core.js';
import {dayOf} from './flix-stats-core.mjs';
// On a catalog revision, at most 100 private subscriptions per worker run, cursor resumes later.
export async function dispatchPush(db,items,revision){if(process.env.FLIX_PUSH_ENABLED!=='true')return;
const stateRef=db.doc('flixAutomation/pushState'),prior=(await stateRef.get()).data()||{},version=String(revision);
if(prior.version===version&&prior.done===true)return;
let q=db.collection('flixPushSubscriptions').orderBy('__name__').limit(100);if(prior.version===version&&prior.cursor)q=q.startAfter(prior.cursor);const snap=await q.get();let sent=0,failed=0;
for(const d of snap.docs){const x=d.data();if(!Number.isInteger(x.day)||x.day<dayOf()-34||typeof x.token!=='string'||x.token.length<20||x.token.length>4096)continue;const {next,count}=pushChanges(items,x.seen);if(!count){if(JSON.stringify(next)!==JSON.stringify(x.seen||{}))await db.runTransaction(async tx=>{const s=await tx.get(d.ref);if(s.exists&&s.data().updatedAt?.isEqual(x.updatedAt))tx.update(d.ref,{seen:next})});continue}
try{await getMessaging().send({token:x.token,data:{kind:'sosoking-new-episodes',count:String(Math.min(count,999))},webpush:{headers:{TTL:'3600',Urgency:'normal'}}});sent++;await db.runTransaction(async tx=>{const s=await tx.get(d.ref);if(s.exists&&s.data().updatedAt?.isEqual(x.updatedAt))tx.update(d.ref,{seen:next})})}catch(e){failed++;if(['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(e.code))await db.runTransaction(async tx=>{const s=await tx.get(d.ref);if(s.exists&&s.data().updatedAt?.isEqual(x.updatedAt))tx.delete(d.ref)})}}
await stateRef.set({version,cursor:snap.docs.at(-1)?.id||'',done:snap.size<100});console.log('Push delivery batch:',JSON.stringify({checked:snap.size,sent,failed}));}
