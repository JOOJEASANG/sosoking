import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,play,options,tide,route,points,winners,retire,finishAutoTurn} from '../public/js/rules.js';

const members=Array.from({length:4},(_,seat)=>({id:String(seat),seat,name:'선장'+seat}));
const game=n=>newGame(members.slice(0,n||2));
function sail(g,dice,choice='a'){
  g.phase='choose';g.dice=dice;play(g,g.players[g.active].id,{type:'sail',choice},()=>0);
}
test('물때와 양방향 순환, 모든 선장의 시작 조건',()=>{
  const g=game(4);
  assert.deepEqual(g.players.map(p=>[p.pos,p.stars,p.stamps,p.express,p.destination]),Array(4).fill([0,0,8,2,3]));
  assert.deepEqual(Array.from({length:8},(_,i)=>tide(i+1)),[1,1,-1,-1,1,1,-1,-1]);
  assert.deepEqual(route(1,3,-1),[0,15,14]);assert.deepEqual(route(15,2,1),[0,1]);
});
test('겹친 눈과 특급권, 목적지를 지나서도 배달',()=>{
  const g=game();
  play(g,'0',{type:'roll'},()=>.2);assert.deepEqual(g.dice,[2,2]);
  assert.deepEqual(options(g).map(o=>o.id),['a','express']);
  play(g,'0',{type:'sail',choice:'express'},()=>0);
  assert.equal(g.players[0].pos,4);assert.equal(g.players[0].delivered,1);assert.equal(g.players[0].express,1);
  assert.equal(g.players[0].stars,4);assert.equal(g.players[0].stamps,14);assert.notEqual(g.players[0].destination,3);
  assert.equal(g.active,1);g.phase='choose';g.dice=[1,2];g.players[1].express=0;
  assert.throws(()=>play(g,'1',{type:'sail',choice:'express'}));
});
test('건설·증축과 이용료, 부족한 우표는 보유량까지만 지불',()=>{
  const g=game();sail(g,[1,2]);assert.equal(g.offer,'build');play(g,'0',{type:'build'});
  assert.deepEqual(g.offices[1],{owner:'0',level:1});assert.equal(g.players[0].stamps,4);
  sail(g,[1,4]);assert.equal(g.players[1].stamps,7);assert.equal(g.players[0].stamps,5);
  g.players[0].pos=0;sail(g,[1,1]);assert.equal(g.offer,'upgrade');play(g,'0',{type:'build'});assert.equal(g.offices[1].level,2);
  g.players[1].pos=0;g.players[1].stamps=1;sail(g,[1,2]);assert.equal(g.players[1].stamps,0);assert.equal(g.players[0].stamps,3);assert.equal(g.players[1].out,false);
});
test('2~4인 모두 정확히 여덟 번 플레이하고 공동 우승도 인정',()=>{
  for(const n of [2,3,4]){
    const g=game(n),counts=Array(n).fill(0);
    for(let i=0;i<n*8;i++){assert.notEqual(g.phase,'finished');counts[g.active]++;finishAutoTurn(g,()=>.56);}
    assert.equal(g.phase,'finished');assert.equal(g.round,8);assert.deepEqual(counts,Array(n).fill(8));
    for(const p of g.players){p.stars=7;p.stamps=5;assert.equal(points(p),8);}
    assert.equal(winners(g).length,n);
  }
});
test('하선한 선장을 건너뛰고 마지막 선장이 우승',()=>{
  const g=game(3);g.offices[5]={owner:'0',level:2};retire(g,'0');
  assert.equal(g.active,1);assert.deepEqual(g.offices,{});retire(g,'2');assert.equal(g.phase,'finished');assert.deepEqual(winners(g),['1']);
});
