import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync('index.html','utf8');
const a=html.indexOf('function convert(v){'),b=html.indexOf('let selected=',a);
assert.ok(a>=0 && b>a);
const digits = v => String(v||'').replace(/[^0-9]/g,'');
const fn=runInNewContext(html.slice(a,b)+';convert',{digits});
const cases=[
['016-234-1234','010-3234-1234'],['016-567-1234','010-2567-1234'],
['016-9200-1234','010-7200-1234'],['016-9500-1234','010-9500-1234'],
['019-234-1234','010-2234-1234'],['019-567-1234','010-5567-1234'],
['019-9000-1234','010-8000-1234'],['019-9500-1234','010-7500-1234'],
['011-234-1234','010-5234-1234'],['011-1700-1234','010-7100-1234'],
['011-9000-1234','010-9000-1234'],['011-9500-1234','010-8500-1234'],
['017-234-1234','010-6234-1234'],['018-567-1234','010-6567-1234']
];
for(const [oldValue,newValue] of cases)assert.equal(fn(oldValue).result,newValue,oldValue);
for(const value of ['abc','019-123-1234'])assert.equal(fn(value).result,'');
console.log('01X conversion: 16 cases passed');
