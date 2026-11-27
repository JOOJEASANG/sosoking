// Keep the ten-minute queue check small. Full reports contain hundreds of video records.
export function shouldReadScan(state,signal,policy,now=Date.now(),force=false,hasKey=false){
 if(force||!state||state.pendingCatalogChange===true||state.policyVersion!==policy||state.signalRevision!==(signal?.revision||0)||state.state==='conflict'||(hasKey&&state.state==='api-key-missing'))return true;
 const checked=state.checkedAt?.toMillis?.();if(!Number.isFinite(checked)||checked>now)return true;
 if(state.state==='partial'&&state.retryAfter?.toMillis)return now>=state.retryAfter.toMillis();
 return now-checked>=21600000;
}

export function compactScan(report,signalRevision=0){
 const result={signalRevision};
 for(const key of ['pendingCatalogChange','policyVersion','state','checkedAt','generalAt','healthAt','retryAfter','tracked','added','autoWorks','ageHidden','candidateCount','searchQuota'])if(report[key]!==undefined)result[key]=report[key];
 try{result.trackingSuggestions=JSON.parse(report.trackSuggestions||'[]').length;}catch{result.trackingSuggestions=0;}
 return result;
}

export const scanFailed=state=>['partial','api-key-missing','conflict'].includes(state?.state);
