import assert from 'node:assert/strict';
import {test} from 'node:test';
import {planRoute} from '../../../src/systems/travel/travelRoute.js';
test('normal default world-sized bounded search must retry a reachable full-map route without the expansion cap',()=>{
 const W=1000,H=500;
 // 250 dry horizontal corridors joined alternately at each end. All coordinates and defaults are ordinary.
 // Reachability is constructive: walk each dry even row and cross the single dry cell in each odd row.
 const isWater=(x,y)=>x<0||x>=W||y<0||y>=H||((y%2===1)&&x!==((Math.floor(y/2)%2===0)?W-1:0));
 const from={x:0,y:0},to={x:999,y:498};
 const normal=planRoute(from,to,{isWater});
 const unlimitedFinal=planRoute(from,to,{isWater,margins:[1000]});
 assert.ok(unlimitedFinal,'whole-map-only control finds constructive dry path');
 for(let i=1;i<unlimitedFinal.pixels.length;i++){const a=unlimitedFinal.pixels[i-1],b=unlimitedFinal.pixels[i];assert.equal(isWater(b.x,b.y),false);assert.ok(Math.abs(b.x-a.x)<=1&&Math.abs(b.y-a.y)<=1);if(a.x!==b.x&&a.y!==b.y)assert.equal(isWater(b.x,a.y)&&isWater(a.x,b.y),false);}
 console.log(JSON.stringify({width:W,height:H,normalRouteFound:!!normal,wholeMapOnlyRouteFound:!!unlimitedFinal,controlSteps:unlimitedFinal.pixels.length-1,controlCost:unlimitedFinal.cost}));
 assert.ok(normal,'default margins must not skip unlimited full-map retry after a capped identical box');
});


test('a clipped full-world box still routes with a small caller budget; a smaller box keeps its budget', () => {
 const from = { x: 1, y: 1 }, to = { x: 6, y: 6 };
 const opts = { width: 8, height: 8, maxExpansions: 1 };
 assert.equal(planRoute(from, to, { ...opts, margins: [0] }), null);
 const route = planRoute(from, to, { ...opts, margins: [1] });
 assert.ok(route);
 assert.deepEqual(route.pixels[0], from);
 assert.deepEqual(route.pixels.at(-1), to);
 assert.ok(Math.abs(route.cost - 5 * Math.SQRT2 * 3.5) < 1e-9);
});

test('uncapped full-world search still refuses disconnected dry destinations and preserves boat crossings', () => {
 const from = { x: 0, y: 2 }, to = { x: 7, y: 2 };
 const opts = { width: 8, height: 5, maxExpansions: 1, isWater: (x) => x === 3 || x === 4 };
 assert.equal(planRoute(from, to, opts), null);
 const route = planRoute(from, to, { ...opts, sea: { start: 'land', again: true } });
 assert.ok(route);
 assert.deepEqual(route.pixels[0], from);
 assert.deepEqual(route.pixels.at(-1), to);
 assert.ok(route.kinds.includes('embark'));
 assert.ok(route.kinds.includes('landfall'));
});
