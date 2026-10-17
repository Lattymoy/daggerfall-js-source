// FIELD BUGS 2026-09-29 (the sea) #5 - "Add a ship combat test menu option" (the Discord, through Mac). The Test Room
// had a door for a ride and a loot ladder, and none for the sea fight: a tester had to buy a deed, find a port, launch,
// sail out and wait on the encounter director to meet a pirate. The sea battle is a spawn, as the ride is - the
// baseline preset put at the helm of an armed Small Ship on the open Bay south of Daggerfall (FIELD-CSA2's pixel) and a
// pirate brig launched on open water off her bow - through the same `test:<id>` door, its two switches turned on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TEST_SEA, TEST_SEA_TEXT, TEST_RIDE, TEST_LOOT, TEST_PRESETS, testEntryById, testPresetById, testStartsOutdoors, enableTestSea } from '../../src/systems/testRoom.js';
import { modSetting, setModSetting, _resetModSettings } from '../../src/systems/modSettings.js';
import { getPref, setPref, _resetForTests as _resetPrefs } from '../../src/systems/uiPrefs.js';
import { classById, batteriesOf } from '../../src/systems/naval/navalShips.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const WORLD = read('src/scenes/world.js');

test('FIELD BUGS 2026-09-29 (the sea) #5: THE SEA BATTLE\'S DOOR - one entry through the one door (the baseline preset, sea true), a spawn outdoors as the ride is (never the classic start\'s dungeon), its card in the pane, its two switches turned on at the door; her hull armed on both sides and her foe a real class (mutants: the entry unresolved, the route\'s list without it, a switch unturned)', () => {
  assert.equal(TEST_SEA.id, 'sea');
  assert.deepEqual(testEntryById('sea'), { preset: testPresetById('nord-warrior'), ride: false, sea: true });
  assert.ok(testPresetById(TEST_SEA.preset), 'a real preset');
  assert.ok(TEST_SEA.label && TEST_SEA.blurb, 'the card has words');
  // the route (main.js): the ride and the sea start outdoors; every character, the loot ladder and a stray id do not
  assert.equal(testStartsOutdoors(TEST_RIDE.id), true);
  assert.equal(testStartsOutdoors(TEST_SEA.id), true);
  for (const id of [...TEST_PRESETS.map((p) => p.id), TEST_LOOT.id, 'no-such', null, undefined]) assert.equal(testStartsOutdoors(id), false, `${id}: the classic start`);
  // the fight she is put in: armed broadsides, a pirate that exists
  assert.ok(batteriesOf(TEST_SEA.hull).some((b) => b.side === 'port') && batteriesOf(TEST_SEA.hull).some((b) => b.side === 'starboard'), 'guns on both sides');
  assert.equal(classById(TEST_SEA.foe)?.faction, 'pirate');
  // FIELD-CSA2 proved this pixel floats a Small Ship on the retail data (the open Bay south of Daggerfall's harbour)
  assert.deepEqual({ ...TEST_SEA.pixel }, { x: 209, y: 216 });
  assert.ok(read('test/systems/comeSailAway/field_csa2.test.js').includes('the open Bay south of Daggerfall (209, 216)'), 'the proof on the retail data');
  // the switches: Come Sail Away and Naval Combat, both off, turned on by the door
  _resetModSettings(); _resetPrefs();
  setModSetting('come-sail-away', 'Enabled', false);
  setPref('naval', false);
  enableTestSea();
  assert.equal(modSetting('come-sail-away', 'Enabled'), true, 'Come Sail Away on');
  assert.equal(getPref('naval'), true, 'Naval Combat on');
  _resetModSettings(); _resetPrefs();
  // the pane's card, the same `test:<id>` family
  assert.match(read('src/ui/enhanced/enhancedMenu.js'), /TEST_SEA\.label[\s\S]*?onAction\(`test:\$\{TEST_SEA\.id\}`\)/, 'the pane\'s card');
});

/** world.js's seaTest, lifted whole with its two lets, over a scope of stubs; `console` shadowed for its warn. */
function mountSeaTest(scope) {
  const from = WORLD.indexOf('  let seaTestWanted = false, seaTestStage = 0;');
  const to = WORLD.indexOf('  const rideOut = () => {');
  assert.ok(from > 0 && to > from, 'the sea test before the ride');
  const names = Object.keys(scope);
  // eslint-disable-next-line no-new-func
  return new Function(...names, `${WORLD.slice(from, to)}\nreturn { run: seaTest, want: () => { seaTestWanted = true; }, wanted: () => seaTestWanted, stage: () => seaTestStage };`)(...Object.values(scope));
}

/** A scope as the world stands it: the Bay not yet reached, her hulls loaded, nothing sailed. */
function seaScope(over = {}) {
  const log = { said: [], teleports: [], placed: [], sailed: [], spawned: [], asked: [], warns: [] };
  let arrive = null, fail = null;
  const boat = { GameObject: { worldMatrix: () => null } };
  const s = {
    log,
    boat,
    arrive: () => arrive(),
    fail: (e) => fail(e),
    landAlong: () => Infinity,   // the two stubs a test turns mid-run (the lifted body holds the scope's own)
    isWater: (x, z, hull) => { log.asked.push([x, z, hull]); return true; },
    scope: {
      navalOn: () => true,
      townTalk: { say: (t) => log.said.push(t) },
      TEST_SEA, TEST_SEA_TEXT,
      _teleportToPixel: (x, y) => { log.teleports.push([x, y]); return new Promise((res, rej) => { arrive = res; fail = rej; }); },
      csa: { ready: () => true },
      player: { pos: [409.6, -3, 409.6] },
      tvSeaY: () => 34,
      tvSeaLandAlong: (...a) => s.landAlong(...a),
      csaCall: (fn) => fn(),
      csaRuntime: {
        sailing: false,
        isSailing() { return this.sailing; },
        state: { CurrentBoat: null },
        PlaceBoat: (at, bow, hull, variant, terrain) => { log.placed.push({ at, bow, hull, variant, terrain }); return boat; },
        StartSailing: (b) => { log.sailed.push(b); },
      },
      csaTerrainOf: (p) => ({ terrainOf: p }),
      csaPixelAt: (x, z) => ({ x, z }),
      naval: { spawnShip: (cls, o) => { log.spawned.push({ cls, ...o }); return 'me:1'; } },
      navalIsWater: (...a) => s.isWater(...a),
      console: { warn: (...a) => log.warns.push(a) },
      ...over,
    },
  };
  return s;
}
const flush = () => new Promise((r) => setImmediate(r));

test('FIELD BUGS 2026-09-29 (the sea) #5: THE SEA BATTLE STANDS A STAGE A FRAME - the Bay reached (the teleport\'s own build awaited), her hull put on the water where the player stands at the sea\'s height, her bow along the way with the most sea before land, her helm taken; only at her helm a pirate brig launched off her bow on open water, facing her, and the fight said begun; then the want is spent (mutants: the stages merged, the bow unchosen, the pirate before the helm, the open-water test unasked)', async () => {
  const s = seaScope();
  const t = mountSeaTest(s.scope);
  t.want();
  t.run();
  assert.deepEqual(s.log.teleports, [[209, 216]], 'to the open Bay');
  assert.equal(t.stage(), 1);
  t.run(); t.run();
  assert.equal(s.log.teleports.length, 1, 'once');
  assert.equal(s.log.placed.length, 0, 'nothing put on the water before the Bay stands');
  s.scope.csaRuntime.sailing = true;   // a helm held already (another boat's): the Bay first all the same
  s.scope.csaRuntime.state.CurrentBoat = s.boat;
  s.boat.GameObject.worldMatrix = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  t.run();
  assert.equal(s.log.spawned.length, 0, 'no pirate before the Bay stands, whatever helm is held');
  s.scope.csaRuntime.sailing = false;
  s.scope.csaRuntime.state.CurrentBoat = null;
  s.arrive(); await flush();
  assert.equal(t.stage(), 2);
  s.scope.csa.ready = () => false;
  t.run();
  assert.equal(s.log.placed.length, 0, 'her hulls still loading: waits');
  s.scope.csa.ready = () => true;
  // land close every way but one: south-west (the fifth of eight) is open sea
  s.landAlong = (p, dx, dz) => (Math.abs(dx + Math.SQRT1_2) < 1e-9 && Math.abs(dz + Math.SQRT1_2) < 1e-9 ? Infinity : 40);
  t.run();
  assert.equal(s.log.placed.length, 1);
  const [put] = s.log.placed;
  assert.deepEqual(put.at, [409.6, 34, 409.6], 'where the player stands, at the sea\'s height');
  assert.ok(Math.abs(put.bow[0] + Math.SQRT1_2) < 1e-9 && put.bow[1] === 0 && Math.abs(put.bow[2] + Math.SQRT1_2) < 1e-9, `her bow to the open sea (${put.bow})`);
  assert.equal(put.hull, TEST_SEA.hull);
  assert.equal(put.variant, 0);
  assert.deepEqual(put.terrain, { terrainOf: { x: 409.6, z: 409.6 } }, 'the terrain of the pixel she floats in');
  assert.deepEqual(s.log.sailed, [s.boat], 'her helm taken');
  assert.equal(t.stage(), 3);
  // not yet at her helm (the runtime's own frame seats the player): no pirate
  t.run();
  assert.equal(s.log.spawned.length, 0, 'the pirate waits for the helm');
  assert.equal(t.wanted(), true);
  // at her helm, her heading 30 degrees; the first bearing off her bow is shoal, the second open
  const h = Math.PI / 6;
  const m = new Float32Array(16); m[8] = Math.sin(h); m[10] = Math.cos(h);
  s.boat.GameObject.worldMatrix = () => m;
  s.scope.csaRuntime.sailing = true;
  s.scope.csaRuntime.state.CurrentBoat = s.boat;
  s.scope.player.pos = [400, 35, 402];
  let asks = 0;
  s.isWater = (x, z, hull) => { s.log.asked.push([x, z, hull]); return ++asks >= 2; };
  t.run();
  assert.equal(s.log.asked.length, 2);
  for (const [k, off] of [[0, 0.6], [1, -0.6]]) {
    const b = h + off, [x, z, hull] = s.log.asked[k];
    assert.ok(Math.abs(x - (400 + Math.sin(b) * TEST_SEA.range)) < 1e-3 && Math.abs(z - (402 + Math.cos(b) * TEST_SEA.range)) < 1e-3, `bearing ${off}: asked at the range off her bow`);
    assert.equal(hull, TEST_SEA.hull, 'deep enough for her hull');
  }
  assert.equal(s.log.spawned.length, 1);
  assert.equal(s.log.spawned[0].cls, 'pirateBrig');
  assert.equal(s.log.spawned[0].range, TEST_SEA.range);
  assert.ok(Math.abs(s.log.spawned[0].bearing - (h - 0.6)) < 1e-6, 'on the open bearing');
  assert.equal(s.log.spawned[0].yaw, undefined, 'the host\'s own facing - bearing + PI, standing in on her');
  assert.deepEqual(s.log.said, [TEST_SEA_TEXT.begun]);
  assert.equal(t.wanted(), false, 'spent');
});

test('FIELD BUGS 2026-09-29 (the sea) #5: A DOOR THAT FINDS NO FIGHT SAYS SO and leaves the player standing - Naval Combat off (Come Sail Away\'s boats unbuilt), her hull refused by the runtime, the Bay never reached, no open water off her bow; never a half-made fight (mutants: the refusal unsaid, a pirate launched onto land)', async () => {
  // no sea fight to stand
  let s = seaScope({ navalOn: () => false });
  let t = mountSeaTest(s.scope);
  t.want(); t.run();
  assert.deepEqual(s.log.said, [TEST_SEA_TEXT.refused]);
  assert.equal(s.log.teleports.length, 0, 'the player left where they stand');
  assert.equal(t.wanted(), false);
  // her hull refused
  s = seaScope();
  s.scope.csaRuntime.PlaceBoat = () => null;
  t = mountSeaTest(s.scope);
  t.want(); t.run(); s.arrive(); await flush(); t.run();
  assert.deepEqual(s.log.said, [TEST_SEA_TEXT.refused]);
  assert.equal(s.log.sailed.length, 0, 'no helm taken of nothing');
  assert.equal(t.wanted(), false);
  // the Bay never reached
  s = seaScope();
  t = mountSeaTest(s.scope);
  t.want(); t.run(); s.fail(new Error('build')); await flush();
  assert.equal(t.wanted(), false);
  assert.equal(s.log.warns.length, 1, 'said in the console');
  // nowhere open for her
  s = seaScope();
  s.isWater = () => false;
  t = mountSeaTest(s.scope);
  t.want(); t.run(); s.arrive(); await flush(); t.run();
  s.boat.GameObject.worldMatrix = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  s.scope.csaRuntime.sailing = true;
  s.scope.csaRuntime.state.CurrentBoat = s.boat;
  t.run();
  assert.equal(s.log.spawned.length, 0, 'no pirate launched onto land');
  assert.deepEqual(s.log.said, [TEST_SEA_TEXT.noRoom]);
  assert.equal(t.wanted(), false);
});

test('FIELD BUGS 2026-09-29 (the sea) #5: the world\'s wiring - the switches turned on before Come Sail Away\'s latch reads its own at this load; the want armed with the character\'s boot; fired from the frame loop\'s spawn gate beside the ride\'s, never before the first stand', () => {
  const on = WORLD.indexOf('if (testEntry?.sea) enableTestSea();');
  const latch = WORLD.indexOf("const _csaOnAtLoad = latchModLoaded('come-sail-away'");
  assert.ok(on > 0 && latch > on, 'on before the latch');
  assert.ok(WORLD.indexOf('const navalOn = () =>') > latch, 'and Naval Combat\'s switch is read live');
  assert.match(WORLD, /if \(testEntry\.sea\) seaTestWanted = true;/);
  assert.match(WORLD, /if \(rideOutWanted && playerSpawned\) rideOut\(\);[^\n]*\n\s+if \(seaTestWanted && playerSpawned\) seaTest\(\);/, 'the same gate, beside the ride\'s');
  assert.ok(WORLD.indexOf('if (seaTestWanted && playerSpawned) seaTest();') > WORLD.indexOf('const seaTest = () => {'), 'defined at the boot, fired from the loop');
});
