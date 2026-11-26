// Catalog fingerprints are local editorial playback entries, not YouTube metrics.
export const fingerprint=e=>String(e.videoId)+':'+(e.start||0)+':'+(e.end||'');
const validWorkId=x=>typeof x==='string'&&/^[a-z0-9][a-z0-9-]{0,79}$/.test(x);
export function pushBaseline(items,saved){const result=Object.create(null),selected=new Set(saved);for(const w of items){if(Object.keys(result).length>=20)break;if(!w.hidden&&validWorkId(w.id)&&selected.has(w.id)&&w.episodes?.length)result[w.id]=fingerprint(w.episodes.at(-1))}return result}
export function pushChanges(items,seen){const next=Object.create(null);let count=0;for(const w of items){if(w.hidden||!validWorkId(w.id)||!Object.hasOwn(seen||{},w.id)||typeof seen[w.id]!=='string'||!w.episodes?.length||Object.keys(next).length>=20)continue;const i=w.episodes.findIndex(e=>fingerprint(e)===seen[w.id]);if(i>=0)count+=w.episodes.length-1-i;next[w.id]=fingerprint(w.episodes.at(-1))}return {next,count}}
