import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const files=['scripts','tests'].flatMap(dir=>readdirSync(dir).filter(name=>name.endsWith('.test.mjs')&&name!=='flix-admin-rules.test.mjs').map(name=>dir+'/'+name)).sort();
const result=spawnSync(process.execPath,['--test',...files],{stdio:'inherit'});
process.exitCode=result.status??1;
