// PEER-HULL-RANGE (2026-10-11) - ANOTHER'S SHIP FAR OFF STANDS NO HULL HERE. Every peer in the room says their sea in
// their word, so a client held every player's ships wherever they sailed, and Come Sail Away's pool walked and baked
// each one every frame - 30-40 hulls, most of them 80-700 km off, a third of the main thread (scenes/naval/navalHost.js
// PEER_HULL_NEAR_M). Her record is kept as ever; only her hull waits for the eye to come near. The sea of
// test/navalSea.mjs, on foot at the origin.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sea } from '../../navalSea.mjs';
import { PEER_HULL_NEAR_M, PEER_HULL_FAR_M } from '../../../src/scenes/naval/navalHost.js';
import { navalWireRecord } from '../../../src/systems/naval/navalWire.js';

const said = (n, pos, seed) => navalWireRecord({ ships: [{ n, classId: 'merchantGalleon', variant: 0, pos, yaw: 0, speed: 0, sails: 1, hull: 1, sail: 1, crew: 1, state: 'afloat', heel: 0, seed, fire: false }] }).s[0];
const word = (...ships) => ({ s: ships, v: [], b: [] });
const standAt = (h, x, z) => { h.view.feet = [x, 0, z]; h.view.look = { origin: [x, 5, z], dir: [1, -0.05, 0] }; };

test('PEER-HULL-RANGE another\'s ship within PEER_HULL_NEAR_M of the eye stands her hull, one 100 km off her record alone (none in the pool); the eye come near, her hull is built; gone past PEER_HULL_FAR_M, it goes back to the pool and her record stays; between the two it stays as it is (mutants: no range, no letting go, the far edge the near one)', async () => {
  assert.ok(PEER_HULL_FAR_M > PEER_HULL_NEAR_M, 'a gap between building and letting go');
  const h = await sea({ hull: null });
  standAt(h, 0, 0);
  const far = [90000, 0, -50000];
  h.host.applyWord('z', word(said(1, [PEER_HULL_NEAR_M - 500, 0, 0], 11), said(2, far, 12)), (p) => p);
  h.run(1);
  const near = h.host._sea.get('z:1'), off = h.host._sea.get('z:2');
  assert.ok(near?.boat, 'the near one built');
  assert.ok(off, 'the far one kept');
  assert.equal(off.boat, null, 'her hull waits');
  assert.deepEqual(h.pool.seaBoats, [near.boat], 'the pool walks the near one alone');
  // the eye comes to her
  standAt(h, far[0] - (PEER_HULL_NEAR_M - 200), far[2]);
  h.run(1);
  assert.ok(off.boat, 'built as she comes within reach');
  assert.equal(near.boat, null, 'the first one, now 90 km off, gave hers back');
  assert.deepEqual(h.pool.seaBoats, [off.boat]);
  // between the two edges: as it stands
  standAt(h, far[0] - (PEER_HULL_NEAR_M + PEER_HULL_FAR_M) / 2, far[2]);
  h.run(1);
  assert.ok(off.boat, 'kept between the edges');
  // past the far edge: back to the pool, her record still mine to hold
  standAt(h, far[0] - PEER_HULL_FAR_M - 200, far[2]);
  h.run(1);
  assert.equal(off.boat, null, 'let go past PEER_HULL_FAR_M');
  assert.ok(h.host._sea.get('z:2'), 'her record stays');
  assert.deepEqual(h.pool.seaBoats, []);
});

// AUDIT PEER-HULL-RANGE (2026-10-11, Mac: "Audit it. Ensure it doesnt kill fidelity") - THE PICTURE UNMOVED. The first
// cut's edges (3,000 / 3,500 m) stood INSIDE the fog: the enhanced lane's linear fog ends at 2400 x Land View / 3 - 4,000 m
// at its default 5, 4,800 m at 6 (world/weather.js scaleFogForDistance) - so a ship came into being 75% fogged and went
// out at 87%. And a hull built AGAIN wore her first hull's past rather than her record: her sails by height, colours and
// wake were remembered on her record against the hull given back, so she came back under full canvas, a struck ship
// flying her colours, a ship under way with no wake - at full strength in one frame, and her fires hung where she was.
import { readFileSync } from 'node:fs';
import { FOG_SETTINGS, scaleFogForDistance } from '../../../src/world/weather.js';
import { LAND_VIEW_MAX } from '../../../src/world/landView.js';
import { fogSettingsFromPresets } from '../../../src/systems/dynamicSkies/dynamicSkies.js';

/** What a fog row lets through of a surface `d` away (1 clear, 0 the fog's colour) - the renderer's three modes. */
const seenThrough = (f, d) => (f.mode === 'linear' ? Math.max(0, Math.min(1, (f.end - d) / Math.max(1e-6, f.end - f.start)))
  : f.mode === 'exp' ? Math.exp(-f.density * d) : f.mode === 'exp2' ? Math.exp(-((f.density * d) ** 2)) : 1);

test('AUDIT PEER-HULL-RANGE a hull is built and given back only where every lane\'s fog has closed: past the enhanced lane\'s linear fog at its widest Land View, past each of DFU\'s rows and past each of Dynamic Skies\' presets at their lightest density (mutant: the first cut\'s 3,000 m)', () => {
  const dfu = Object.entries(FOG_SETTINGS).filter(([k]) => k !== 'interior' && k !== 'dungeon').map(([k, f]) => [`DFU ${k}`, scaleFogForDistance(f, LAND_VIEW_MAX)]);
  const names = ['FogSunny', 'FogOvercast', 'FogRainy', 'FogSnowy', 'FogHeavyFog'];
  const json = Object.fromEntries(names.map((n) => [n, readFileSync(new URL(`../../../vendor/dynamic-skies/FogSettings/${n}.json`, import.meta.url), 'utf8')]));
  const ds = Object.entries(fogSettingsFromPresets(json, 1)).map(([k, f]) => [`Dynamic Skies ${k}`, f]);
  assert.equal(scaleFogForDistance(FOG_SETTINGS.sunny, LAND_VIEW_MAX).end, 4800, 'the widest linear fog this port draws');
  for (const [name, f] of [...dfu, ...ds]) assert.ok(seenThrough(f, PEER_HULL_NEAR_M) < 0.01, `${name}: ${seenThrough(f, PEER_HULL_NEAR_M).toFixed(3)} seen at the near edge`);
});

test('AUDIT PEER-HULL-RANGE a hull built again wears her record, not her last hull\'s: she fades in (SHIP-FADE), her canvas by her sail share, a struck ship\'s colours down, a ship under way her wake; her fires out of sight while she stands no hull and on her again when she does (mutants: each of the four kept)', async () => {
  const h = await sea({ hull: null });
  h.deps.flame = () => ({ shown: null, move() {}, retire() {}, show(v) { this.shown = v; } });
  const ship = (o) => navalWireRecord({ ships: [{ classId: 'merchantGalleon', variant: 0, yaw: 0, speed: 0, sails: 1, hull: 1, sail: 1, crew: 1, state: 'afloat', heel: 0, fire: false, ...o }] }).s[0];
  const w = word(ship({ n: 1, pos: [500, 0, 0], seed: 3, speed: 5, sail: 0.3, fire: true }), ship({ n: 2, pos: [-500, 0, 0], seed: 4, state: 'struck' }));
  const step = (s) => { h.host.applyWord('z', w, (p) => p); h.run(s); };
  const canvas = (b) => b.Sails.filter((n) => n.activeSelf).length;
  standAt(h, 0, 0);
  step(6);
  const run = h.host._sea.get('z:1'), struck = h.host._sea.get('z:2');
  const was = { canvas: canvas(run.boat) };
  assert.ok(was.canvas < run.boat.Sails.length, 'her torn canvas shown short');
  assert.equal(run.boat.WakeEmitter.isEmitting, true, 'under way, her wake');
  assert.equal(struck.boat.FlagEmitter.isEmitting, false, 'struck, her colours down');
  assert.ok(run.fires.every((f) => f.handle.shown === true), 'her fires on her');
  // the eye goes away past the far edge: both hulls given back, her fires out of sight
  standAt(h, PEER_HULL_FAR_M + 1000, 0);
  step(1);
  assert.equal(run.boat, null);
  assert.equal(struck.boat, null);
  assert.ok(run.fires.every((f) => f.handle.shown === false), 'no fire hung over the sea where she was');
  // and comes back: built again, each as her record says
  standAt(h, 0, 0);
  step(0.2);   // one build a frame (buildOne)
  assert.ok(run.boat && struck.boat, 'both built again');
  assert.ok(run.boat.fade < 0.5, `she fades in (SHIP-FADE) rather than standing whole in a frame: ${run.boat.fade}`);
  step(6);
  assert.equal(canvas(run.boat), was.canvas, 'her canvas by her sail share on the hull she stands now');
  assert.equal(run.boat.WakeEmitter.isEmitting, true, 'her wake on the hull she stands now');
  assert.equal(struck.boat.FlagEmitter.isEmitting, false, 'a struck ship\'s colours down on the hull she stands now');
  assert.ok(run.fires.every((f) => f.handle.shown === true), 'her fires on her again');
  assert.equal(run.boat.fade, 1);
});
