import {initializeApp,getApps} from 'firebase/app';
import {getAuth,GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signOut,setPersistence,browserLocalPersistence} from 'firebase/auth';
import {firebaseApp} from './flix-firebase-client.mjs';
export async function connectMember(onChange){
 const base=await firebaseApp();
 // Keep optional member authentication independent of anonymous statistics,
 // submissions, notifications and the privileged administrator session.
 const app=getApps().find(a=>a.name==='sosoking-member')||initializeApp(base.options,'sosoking-member');
 const auth=getAuth(app);await setPersistence(auth,browserLocalPersistence);
 let epoch=0;
 onAuthStateChanged(auth,async user=>{
  const version=++epoch;
  if(!user||user.isAnonymous){onChange(null);return}
  try{
   const token=await user.getIdTokenResult(),google=user.providerData.find(p=>p.providerId==='google.com');
   if(version!==epoch)return;
   if(token.signInProvider!=='google.com'||!google){onChange(null);return}
   onChange({name:google.displayName||user.displayName||'Google 회원',photo:google.photoURL||user.photoURL||''});
  }catch{if(version===epoch)onChange(null)}
 },()=>onChange(null));
 return {async signIn(){const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});await signInWithPopup(auth,provider)},async signOut(){await signOut(auth)}};
}
