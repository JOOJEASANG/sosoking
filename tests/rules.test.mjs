import test from "node:test";
import assert from "node:assert/strict";
import {
 ROUTES,ROUTE_LENGTHS,routePosition,PATH_TILES,RUIN_TILES,
 canBuild,synergyCount,TOWERS,upgradePrice,sellValue,wavePlan,cardChoices,CARDS,
 defaultBoosts,applyCard,DIFFICULTIES
} from "../public/js/rules.js";

test("Two complete entry-to-core routes",()=>{
 assert.equal(ROUTES.length,2);
 for(let lane=0;lane<2;lane++){
  assert.ok(ROUTE_LENGTHS[lane]>=1400);
  assert.equal(routePosition(lane,0).x,-25);
  assert.equal(routePosition(lane,ROUTE_LENGTHS[lane]).x,1025);
  const middle=routePosition(lane,ROUTE_LENGTHS[lane]/2);
  assert.ok(Number.isFinite(middle.x)&&Number.isFinite(middle.y));
 }
});
test("Cannot build on roads, ruins, occupied spots or outside the board",()=>{
 assert.equal(canBuild(3,2),false);
 assert.equal(canBuild(1,4),false);
 assert.equal(canBuild(-1,1),false);
 assert.equal(canBuild(20,1),false);
 assert.equal(canBuild(1,1),true);
 assert.equal(canBuild(1,1,[{gx:1,gy:1}]),false);
 assert.ok(PATH_TILES.size>=45);
 assert.ok(RUIN_TILES.size>=10);
});
test("Wave spawns escalate and a boss arrives every 5 waves",()=>{
 assert.equal(wavePlan(1).spawns.length,10);
 assert.equal(wavePlan(5).boss,true);
 assert.equal(wavePlan(5).spawns.at(-1).type,"boss");
 assert.equal(wavePlan(6).boss,false);
 assert.ok(wavePlan(10).spawns.length>wavePlan(5).spawns.length);
 for(const e of wavePlan(12).spawns){
  assert.ok([0,1].includes(e.lane));
  assert.ok(e.at>=0);
 }
});
test("Upgrade economy and max level are bounded",()=>{
 for(const key of Object.keys(TOWERS)){
  assert.ok(upgradePrice(key,1)>0);
  assert.ok(upgradePrice(key,2)>upgradePrice(key,1));
  assert.equal(upgradePrice(key,4),null);
  assert.ok(sellValue(key,1)<TOWERS[key].cost);
 }
});
test("Draft choices are deterministic, distinct, and valid",()=>{
 const a=cardChoices(3),b=cardChoices(3);
 assert.deepEqual(a,b);
 assert.equal(new Set(a.map(c=>c.id)).size,3);
 for(const c of a)assert.ok(CARDS.includes(c));
});
test("All permanent upgrades have observable effects",()=>{
 const state={credits:100,lives:10,shield:0,boosts:defaultBoosts()};
 for(const card of CARDS)applyCard(state,card.id);
 assert.ok(state.credits>100);
 assert.ok(state.lives>10);
 assert.ok(state.shield>0);
 assert.ok(state.boosts.damage>1);
 assert.ok(state.boosts.speed>1);
 assert.ok(state.boosts.range>1);
 assert.ok(state.boosts.bounty>1);
 assert.ok(state.boosts.freeze>0);
 assert.ok(state.boosts.crit>0);
 assert.deepEqual(Object.keys(DIFFICULTIES),["easy","normal","hard"]);
});

test("Mixed tower adjacency rewards positioning, capped to 3 links",()=>{
 const p={x:100,y:100,type:"pulse"};
 const towers=[p,{x:150,y:100,type:"frost"},{x:100,y:150,type:"rail"},
   {x:150,y:150,type:"arc"},{x:300,y:100,type:"frost"},{x:115,y:100,type:"pulse"}];
 assert.equal(synergyCount(p,towers),3);
 assert.equal(synergyCount({x:900,y:400,type:"pulse"},towers),0);
});
