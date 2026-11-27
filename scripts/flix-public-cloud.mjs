import {getFirestore,doc,getDocFromServer} from 'firebase/firestore';
import {firebaseApp} from './flix-firebase-client.mjs';
import {validateCatalog} from './flix-catalog-validation.mjs';
import {cachedRead,CATALOG_CACHE,RECOMMENDATIONS_CACHE,CATALOG_TTL,RECOMMENDATIONS_TTL} from '../public/flix/data-cache.js';

export function readPublicCatalog({force=false}={}) {
  return cachedRead(CATALOG_CACHE,async()=>{
    const db=getFirestore(await firebaseApp()),snap=await getDocFromServer(doc(db,'flixPublic','catalog'));
    return snap.exists()?JSON.parse(snap.data().json):null;
  },{ttl:CATALOG_TTL,force,validate:value=>value===null?null:validateCatalog(value)});
}

export function readRecommendations({force=false}={}) {
  return cachedRead(RECOMMENDATIONS_CACHE,async()=>{
    const db=getFirestore(await firebaseApp()),snap=await getDocFromServer(doc(db,'flixPublic','recommendations'));
    if(!snap.exists())return null;
    const d=snap.data();if(d.version!=='editorial-watch-v2')return null;
    return {ranked:d.ranked,popular:d.popular,monthlyPopular:d.monthlyPopular,newWorks:d.newWorks};
  },{ttl:RECOMMENDATIONS_TTL,force,validate:d=>{
    if(d===null)return null;if(!d||typeof d!=='object')throw Error('Invalid recommendations');
    const ids=(key,max)=>(Array.isArray(d[key])?d[key]:[]).filter(x=>typeof x==='string'&&/^[a-z0-9][a-z0-9-]{0,79}$/.test(x)).slice(0,max);
    return {ranked:ids('ranked',100),popular:ids('popular',10),popularSource:'watch',monthlyPopular:ids('monthlyPopular',10),newWorks:ids('newWorks',10)};
  }});
}
