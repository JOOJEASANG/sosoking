import test from 'node:test';
import assert from 'node:assert/strict';
import {countText,normalizeLineEndSpaces,dateSpan,percentValues,candidates,chooseRandom,paperSpec} from '../public/js/tool-core.js';
test('unicode length and utf8 bytes are distinct',()=>{
 const x=countText('가 나😀');
 assert.deepEqual(x,{all:4,withoutSpace:3,words:2,bytes:11});
 assert.deepEqual(countText(''),{all:0,withoutSpace:0,words:0,bytes:0});
});
test('line end whitespace is removed but indentation preserved',()=>{
 assert.equal(normalizeLineEndSpaces('  a  \n  b\t'),'  a\n  b');
});
test('date spans include leap day and reversed ranges',()=>{
 assert.deepEqual(dateSpan('2024-02-28','2024-03-01'),{difference:2,absolute:2,inclusive:3});
 assert.deepEqual(dateSpan('2026-11-03','2026-11-01'),{difference:-2,absolute:2,inclusive:3});
 assert.equal(dateSpan('2026-02-29','2026-03-01'),null);
});
test('percent, including zero',()=>{
 assert.deepEqual(percentValues('100000','10'),{part:10000,up:110000,down:90000});
 assert.deepEqual(percentValues('0','10'),{part:0,up:0,down:0});
 assert.equal(percentValues('','10'),null);
});
test('random candidates are unique and bounded',()=>{
 assert.deepEqual(candidates('가\n나\n가\n\n다',2),['가','나']);
 assert.equal(chooseRandom(['a','b','c'],0.6),'b');
 assert.equal(chooseRandom([],0.4),null);
});
test('paper dimensions distinguish JIS and ISO',()=>{
 assert.deepEqual(paperSpec('A4'),{width:210,height:297,pixelsWidth:2480,pixelsHeight:3508});
 assert.equal(paperSpec('B5-JIS').width,182);
 assert.equal(paperSpec('B5-ISO').width,176);
 assert.equal(paperSpec('unknown'),null);
})