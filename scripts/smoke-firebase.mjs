import {randomBytes} from 'node:crypto';
// Smoke test against published Firebase Auth & Firestore, with synthetic data only.
const project='sosoking-481e6';
const init=await fetch(`https://${project}.web.app/__/firebase/init.json`);
if(!init.ok)throw Error('Public Firebase config unavailable');
const cfg=await init.json();if(!cfg.apiKey||cfg.projectId!==project)throw Error('Firebase config mismatch');
const authUrl=`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(cfg.apiKey)}`;
async function anon(){const r=await fetch(authUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({returnSecureToken:true})});const d=await r.json();if(!r.ok||!d.idToken||!d.localId)throw Error('Anonymous auth unavailable: '+String(d.error?.message||r.status));return d;}
const [admin,member,stranger]=await Promise.all([anon(),anon(),anon()]);
const root=`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
const eventId='sktest'+Date.now()+randomBytes(4).toString('hex'),groupId='testgroup'+randomBytes(5).toString('hex');
const eventPath=`${root}/events/${eventId}`,groupPath=`${eventPath}/groups/${groupId}`,memberPath=`${eventPath}/members/${member.localId}`;
const stringValue=s=>({stringValue:s}),intValue=n=>({integerValue:String(n)}),stamp=()=>({timestampValue:new Date().toISOString()});
const arrays=rows=>({arrayValue:{values:rows}});
function map(fields){return {mapValue:{fields}};}
async function fire(url,token,{method='GET',fields=null,expect=200}={}){
 const r=await fetch(url,{method,headers:{Authorization:'Bearer '+token,'content-type':'application/json'},body:fields?JSON.stringify({fields}):undefined});
 if(r.status!==expect){const body=await r.text();throw Error(`Firestore ${method} ${url.split('/').slice(-2).join('/')} expected ${expect} got ${r.status}: ${body.slice(0,350)}`);}
 return r;
}
let eventCreated=false,groupCreated=false,memberCreated=false;
try{
 const e={title:stringValue('SOSOKING permission-smoke'),date:stringValue(''),fee:intValue(0),feeItems:arrays([map({id:stringValue('fee_1'),label:stringValue('일반 등록비'),amount:intValue(20000)})]),mode:stringValue('count'),fields:arrays([]),groups:arrays([map({id:stringValue(groupId),name:stringValue('테스트 단체')})]),ownerUid:stringValue(admin.localId),status:stringValue('open'),createdAt:stamp()};
 await fire(`${root}/events?documentId=${eventId}`,admin.idToken,{method:'POST',fields:e});eventCreated=true;
 const g={name:stringValue('테스트 단체'),count:intValue(0),attendees:arrays([]),feeQuantities:map({}),paid:intValue(0),submitted:{booleanValue:false},updatedAt:stamp()};
 await fire(`${eventPath}/groups?documentId=${groupId}`,admin.idToken,{method:'POST',fields:g});groupCreated=true;
 await fire(groupPath,stranger.idToken,{expect:403});
 const m={name:stringValue('테스트담당자'),groupId:stringValue(groupId),status:stringValue('pending'),requestedAt:stamp()};
 await fire(memberPath,member.idToken,{method:'PATCH',fields:m});memberCreated=true;
 await fire(groupPath,member.idToken,{expect:403});
 await fire(`${memberPath}?updateMask.fieldPaths=status&updateMask.fieldPaths=reviewedAt`,admin.idToken,{method:'PATCH',fields:{status:stringValue('approved'),reviewedAt:stamp()}});
 await fire(groupPath,member.idToken,{expect:200});
 await fire(groupPath,stranger.idToken,{expect:403});
 await fire(`${groupPath}?updateMask.fieldPaths=count&updateMask.fieldPaths=feeQuantities&updateMask.fieldPaths=submitted&updateMask.fieldPaths=updatedAt`,member.idToken,{method:'PATCH',fields:{count:intValue(1),feeQuantities:map({fee_1:intValue(1)}),submitted:{booleanValue:true},updatedAt:stamp()}});
 const updated=await fire(groupPath,admin.idToken,{expect:200});
 const saved=await updated.json();
 if(saved.fields?.feeQuantities?.mapValue?.fields?.fee_1?.integerValue!=='1')throw Error('Saved fee quantity mismatch');
 console.log('PASS: owner creates configurable fees, nonmember access blocked, approved member can update own group fee quantities.');
}finally{
 for(const [url,created] of [[memberPath,memberCreated],[groupPath,groupCreated],[eventPath,eventCreated]]){
  if(created)try{await fire(url,admin.idToken,{method:'DELETE',expect:200});}catch(err){console.error('Synthetic test cleanup:',err.message);}
 }
}
