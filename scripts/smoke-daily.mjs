import fs from 'node:fs';
import {createSign,randomBytes} from 'node:crypto';
// Creates only synthetic public check items, then removes them with service-account credentials.
const project='sosoking-481e6',root='https://firestore.googleapis.com/v1/projects/'+project+'/databases/(default)/documents';
const configRes=await fetch('https://'+project+'.web.app/__/firebase/init.json');
if(!configRes.ok)throw Error('Firebase initialization config unavailable');
const config=await configRes.json();
if(!config.apiKey||config.projectId!==project)throw Error('Unexpected Firebase configuration');
const creds=JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS,'utf8'));
const base64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const unsigned=base64({alg:'RS256',typ:'JWT'})+'.'+base64({iss:creds.client_email,scope:'https://www.googleapis.com/auth/datastore',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
const signer=createSign('RSA-SHA256');signer.update(unsigned);signer.end();
const jwt=unsigned+'.'+signer.sign(creds.private_key,'base64url');
const tokenRes=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt})});
if(!tokenRes.ok)throw Error('Service account OAuth unavailable');
const adminToken=(await tokenRes.json()).access_token;
if(!adminToken)throw Error('Missing Admin OAuth token');
async function anonymous(){
 const response=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key='+encodeURIComponent(config.apiKey),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({returnSecureToken:true})});
 const data=await response.json();
 if(!response.ok||!data.idToken||!data.localId)throw Error('Anonymous authentication unavailable');
 return data;
}
const [owner,other]=await Promise.all([anonymous(),anonymous()]);
const id='s_'+randomBytes(16).toString('hex'),id2='s_'+randomBytes(16).toString('hex');
const itemName='projects/'+project+'/databases/(default)/documents/publicItems/'+id;
const secondName='projects/'+project+'/databases/(default)/documents/publicItems/'+id2;
const quotaName='projects/'+project+'/databases/(default)/documents/contributorLimits/'+owner.localId;
const reportName='projects/'+project+'/databases/(default)/documents/itemReports/'+id+'_'+other.localId;
const st=x=>({stringValue:String(x)});
const emptyArray={arrayValue:{values:[]}};
const stamp=fieldPath=>({fieldPath,setToServerValue:'REQUEST_TIME'});
const writeItem=(name)=>({update:{name,fields:{title:st('자동 검사 전용 체크 항목'),kind:st('count'),category:st('재미'),options:emptyArray,creatorUid:st(owner.localId)}},updateTransforms:[stamp('createdAt')]});
const writeQuota=(name,item)=>({update:{name,fields:{lastItemId:st(item)}},updateTransforms:[stamp('lastSubmittedAt')]});
async function request(url,token,{method='GET',body,expect=200}={}){
 const res=await fetch(url,{method,headers:{...(token?{authorization:'Bearer '+token}:{}),'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
 if(res.status!==expect)throw Error('HTTP '+res.status+' instead of '+expect+' for '+method+' '+url.split('/').slice(-2).join('/')+': '+(await res.text()).slice(0,250));
 return res;
}
const commit=(token,writes,expect=200)=>request(root+':commit',token,{method:'POST',body:{writes},expect});
try{
 await request(root+'/events/oldTestShouldNotBeReadable',owner.idToken,{expect:403});
 await commit(owner.idToken,[writeItem(itemName)],403);
 await commit(owner.idToken,[writeItem(itemName),writeQuota(quotaName,id)]);
 const publicRead=await request(root+'/publicItems/'+id,null);
 const publicData=await publicRead.json();
 if(publicData.fields.title.stringValue!=='자동 검사 전용 체크 항목')throw Error('Public item mismatch');
 await commit(owner.idToken,[writeItem(secondName),writeQuota(quotaName,id2)],403);
 const reportFields={itemId:st(id),reporterUid:st(other.localId),reason:st('spam')};
 await commit(other.idToken,[{update:{name:reportName,fields:reportFields},updateTransforms:[stamp('createdAt')]}]);
 await request(root+'/itemReports/'+id+'_'+other.localId,owner.idToken,{expect:403});
 console.log('PASS: old data blocked; shared item needs quota; public question readable; 24h duplicate blocked; reports private.');
}finally{
 for(const name of [reportName,secondName,itemName,quotaName]){
  try{
   const response=await fetch('https://firestore.googleapis.com/v1/'+name,{method:'DELETE',headers:{authorization:'Bearer '+adminToken}});
   if(response.status!==200&&response.status!==404)console.error('Synthetic cleanup failed (HTTP '+response.status+') for '+name.split('/').slice(-2).join('/'));
  }catch(err){console.error('Synthetic cleanup connection failed',String(err));}
 }
}
