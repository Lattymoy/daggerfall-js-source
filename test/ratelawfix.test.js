// RATE-LAW-FIX (2026-10-05, bible/06-Systems/Travel-Options.md "RATE-LAW-FIX"): THE DEEP AUDIT'S THREE - a route's last
// stretch to a spot ran at its pixel's step's rate wherever the spot lay (the road's x100 off across a field to a camp),
// a route of no legs ran at x60 down a road, and each change of ground lifted the governor's hold for a frame. Driven
// through the real mod and panel; the host's ask lifted out of scenes/world.js and run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TravelControlUI } from '../src/ui/travelControlUI.js';
import { createTravelOptions, readTravelOptionsSettings } from '../src/systems/travelOptions.js';
import { mapPixelWorldOrigin } from '../src/systems/travelPaths.js';
import { TRAVEL_ROAD_RATE, TRAVEL_OPEN_RATE } from '../src/systems/timeScale.js';

const mid = (x, y) => { const o = mapPixelWorldOrigin(x, y); return { x: o.x + 16384, z: o.z + 16384 }; };
function rig() {
  const asked = [];
  const w = { pos: mid(500, 250), pixel: { x: 500, y: 250 }, road: false };
  const ui = new TravelControlUI({});
  const to = createTravelOptions({
    settings: { ...readTravelOptionsSettings(), avoidObstacles: false }, ui,
    pushWindow: (win) => win.show(), mapPixel: () => w.pixel, worldPos: () => w.pos,
    setTimeScale: (n) => asked.push(n), locationTileRect: () => null, onRoad: () => w.road,
    localizedLocationName: (sm) => sm?.name ?? '', locationWorldRect: () => null,
  });
  const frame = () => to.update({ topWindowIsTravelUI: true, isPlayerOnHUD: false });
  return { to, ui, asked, w, frame };
}

test('RATE-LAW-FIX a route\'s last stretch to a SPOT asks the host\'s lanes - x100 while it runs along a road, x60 off across the ground - its pixel\'s step says nothing of where the spot lies (mutant: the step\'s label read)', () => {
  const { to, asked, w, frame } = rig();
  const legs = [{ x: 501, y: 250, kind: 'road' }, { x: 502, y: 250, kind: 'road' }];
  const o = mapPixelWorldOrigin(502, 250);
  to.beginTravelAlongRoute({ legs, point: { pixel: { x: 502, y: 250 }, x: o.x + 3000, z: o.z + 29000 }, name: 'A camp' });   // a corner of the pixel, far off the road's lane
  assert.equal(asked.at(-1), TRAVEL_ROAD_RATE, 'the road\'s leg: its label');
  w.pixel = { x: 501, y: 250 }; w.pos = mid(501, 250);
  frame(); frame();
  assert.equal(to.route.i, 1, 'the last stretch, to the spot itself');
  assert.equal(asked.at(-1), TRAVEL_OPEN_RATE, 'off the road to the spot: x60, though its pixel\'s step is a road');
  w.road = true;
  frame();
  assert.equal(asked.at(-1), TRAVEL_ROAD_RATE, 'while it runs along a road: x100');
});

test('RATE-LAW-FIX a route of no legs is a straight walk - the host\'s lanes say its rate, x100 down a road, x60 across country (mutant: the empty route always the open ground\'s)', () => {
  const { to, asked, w, frame } = rig();
  w.road = true;
  to.beginTravelToPoint({ pixel: { x: 510, y: 250 }, ...mid(510, 250) });
  assert.equal(asked.at(-1), TRAVEL_ROAD_RATE, 'down a road: x100');
  w.road = false;
  frame();
  assert.equal(asked.at(-1), TRAVEL_OPEN_RATE, 'across country: x60');
});

test('RATE-LAW-FIX the host\'s ask never lifts a hold: a new ground\'s rate is recorded and the held clock kept for the governor to weigh; a lower ask is the clock\'s at once; unheld, the ask is the clock (mutants: the hold lifted, the lower ask held)', () => {
  const W = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  const m = /setTimeScale: (\(n\) => \{[^\n]*?\}),/.exec(W);
  assert.ok(m, 'the ask lifted');
  const d = { scale: 5, asked: 60 };
  const ask = new Function('d', `const worldTimeScale = () => d.scale, setWorldTimeScale = (n) => { d.scale = n; };
    let travelAsked; const sync = () => { travelAsked = d.asked; }; const f = ${m[1]};
    return (n) => { sync(); f(n); d.asked = travelAsked; };`)(d);
  ask(100);
  assert.deepEqual([d.scale, d.asked], [5, 100], 'held at x5 for an enemy: onto a road the clock stays held, the ask recorded');
  ask(1);
  assert.deepEqual([d.scale, d.asked], [1, 1], 'an interrupt\'s x1: at once');
  d.scale = 60; d.asked = 60;
  ask(100);
  assert.deepEqual([d.scale, d.asked], [100, 100], 'unheld: the road\'s rate at once');
});
