import {execFileSync} from 'node:child_process';
const legacy=new Set('submitCase generateTrial generateDailyAiNow checkNickname setNickname setProfilePhoto voteResult voteOwnVerdict addCourtComment addDiscussionComment setResultVisibility getPublicCaseOriginal setAdminResultVisibility submitReport moderateReport syncPublicStats syncPublicStatsNow publicResultPage publicSitemap publicTagPage publicAdvicePage publicTranslatePage resolveCaseAlias migrateLegacyCaseIds requestAppeal deleteOwnCourtPost deleteCourtPost deleteUserProfile castDebateVote generateAdvice generateTranslation toggleLike addComment getMyResults autoAdjustLimits'.split(' '));
const payload=JSON.parse(execFileSync('firebase',['functions:list','--project','sosoking-481e6','--json'],{encoding:'utf8',maxBuffer:5e6}));
const rows=Array.isArray(payload)?payload:Array.isArray(payload.result)?payload.result:payload.functions;
if(!Array.isArray(rows))throw new Error('Cannot parse deployed function inventory; cleanup stopped.');
const names=rows.map(r=>String(r.id||r.name||r.functionId||'').split('/').pop()).filter(n=>legacy.has(n));
for(let i=0;i<names.length;i+=8)execFileSync('firebase',['functions:delete',...names.slice(i,i+8),'--project','sosoking-481e6','--force','--non-interactive'],{stdio:'inherit'});
console.log(`Retired ${names.length} known old endpoints. No account or historical document was deleted.`);
