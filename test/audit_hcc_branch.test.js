// AUDIT HCC - THE BRANCH AUDIT (2026-09-23, Mac: "Let's do an audit on everything before we merge. This needs to be
// perfect"). Five lenses over the whole branch; the findings in Horse Cart and Cargo's own machine and its hosts,
// pinned here BY EXECUTION where the seam is a function and by source where it is a call in a frame. (The park lane's
// and the riders' findings are pinned in test/hcc_park.test.js.) `06-Systems/Horse-Cart-And-Cargo.md` AUDIT BRANCH.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeWorld, WX0 } from './hccWorld.mjs';
import { WAGON_MODE, HORSE_MODE, TRANSPORT } from '../src/systems/horseCartLaw.js';
import { createHorseCartPool } from '../src/scenes/horseCartPool.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('AUDIT BRANCH IL1 [IL_9b1a-IL_9b3e]: a building entered with the wagon keeps the HORSE\'s own mode - a horse waiting down the road is not teleported to the door; by cart the team goes in hitched (mutant: the port\'s old ternary)', () => {
  const { rt, w, step, state } = makeWorld();
  step();
  const s = state();
  s.HorseMode = HORSE_MODE.LooseStationary; s.HorseWorldX = WX0 + 4000; s.HorseWorldZ = s.WorldZ ?? 200000; s.HorseHeadingX = 0; s.HorseHeadingZ = 1;
  step();
  assert.equal(state().Mode, WAGON_MODE.WithPlayer);
  rt.handlePreTransition({ type: 'ToBuildingInterior', door: [w.pos[0], 0, w.pos[2] + 2] });
  w.inside = true; w.building = true;
  rt.handleSuccessfulInteriorTransition({ type: 'ToBuildingInterior', buildingKey: 7 });
  assert.equal(state().Mode, WAGON_MODE.Deployed, 'the wagon parked at the door');
  assert.equal(state().HorseMode, HORSE_MODE.LooseStationary, 'the horse still waits where it waited');
  assert.equal(state().HorseWorldX, WX0 + 4000, 'and where');
  // by cart: the team goes in hitched
  const b = makeWorld();
  b.step(); b.rt.tryUseTransport(TRANSPORT.Cart); b.step(); b.walk(10);
  b.rt.handlePreTransition({ type: 'ToBuildingInterior', door: [b.w.pos[0], 0, b.w.pos[2] + 2] });
  b.w.mode = TRANSPORT.Foot; b.w.inside = true; b.w.building = true;
  b.rt.handleSuccessfulInteriorTransition({ type: 'ToBuildingInterior', buildingKey: 7 });
  assert.equal(b.state().HorseMode, HORSE_MODE.HitchedToWagon);
});

test('AUDIT BRANCH IL2 [SeedTrail IL_5968-IL_59e7]: a jump re-seeds the trail AND forgets the old ground - the wagon is hidden until it grounds again, and a dismount parks it behind the player, never back at the old place (mutant: the pose\'s last valid ground kept)', () => {
  const { rt, w, step, walk, state, scene } = makeWorld();
  step(); rt.tryUseTransport(TRANSPORT.Cart); step(); walk(20);
  assert.equal(rt.view().moving.pose.active, true);
  w.noGround = true; w.pos[0] += 200; step(3);
  assert.equal(rt.view().moving.pose.active, false, 'no ground under the new place: hidden, as the mod\'s SetActive(false)');
  w.mode = TRANSPORT.Foot; step();
  const parked = scene(state().WorldX, state().WorldZ);
  assert.ok(Math.abs(parked[0] - w.pos[0]) < 1 && parked[2] < w.pos[2], `parked behind the player, not 200 m back: ${parked}`);
});

test('AUDIT BRANCH IL3 [IL_51ef-IL_51f9]: a following team whose horse jumped re-seeds its path FROM THE WAGON - the wagon stands between the horse and where it was, 2.5 m off (mutant: && for ||)', () => {
  const { rt, w, step, walk } = makeWorld();
  step(); rt.tryUseTransport(TRANSPORT.Cart); step(); walk(10);
  w.mode = TRANSPORT.Foot; step(3);
  w.activateMode = 'dialogue'; w.pos[2] += 6; step(3);
  rt.handleStationaryHorseActivation(2);
  assert.equal(rt.view().teamFollowing, true);
  walk(15); step(60);
  const horse = rt.view().horse.position;
  horse[0] += 100;   // the horse re-grounded far off (the follower's 20 m re-ground, a stuck recovery)
  step(1);
  const h = rt.view().horse.position, p = rt.view().moving.pose.position;
  assert.ok(h[0] - p[0] > 2 && h[0] - p[0] < 3, `the wagon toward where it was: horse ${h}, wagon ${p}`);
});

test('AUDIT BRANCH IL4: MY runtime runs on Unity\'s Time.deltaTime - zero while the game is paused, scaled with the world - and the peers\' teams ease on real time (mutants: the runtime handed the real dt)', () => {
  const got = [];
  const pool = createHorseCartPool({ renderer: null, meshes: null, collider: () => null });
  pool.attach({ view: () => ({ state: { Mode: 0 }, moving: null, deployed: null, horse: null }), lateUpdate: (dt) => got.push(dt), horseTargetLabel: '' });
  pool.frame(0.1, [0, 0, 0], 0);
  pool.frame(0.1, [0, 0, 0], 0.4);
  assert.deepEqual(got, [0, 0.4]);
  pool.frame(0.1, [0, 0, 0]);
  assert.equal(got.at(-1), 0.1, 'a host with no game clock gives the one it has');
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(rd(f), /hcc\.frame\(dt, cam\.pos, gamePaused\(\) \? 0 : dt \* (?:worldTimeScale|hccTimeScale)\(\)\);/, f);
  }
});

test('AUDIT BRANCH H1: the parked wagon\'s box stands again only when its matrix moved (compared number by number, never a string built every frame)', () => {
  const src = rd('src/scenes/horseCartPool.js');
  assert.doesNotMatch(src, /toFixed\(3\)\)\.join/);
  assert.match(src, /if \(m \? sameMatrix\(m, prevKey\) : prevKey === null\) return prevKey;/);
  assert.match(src, /const sameMatrix = \(a, b\) => \{[^\n]*Math\.abs\(a\[i\] - b\[i\]\) >= 5e-4/, 'a millimetre, the old key\'s own precision');
});

test('AUDIT BRANCH H2/H3/H4 by source: the wagon\'s inventory goes through the host\'s own door (a transformed lycanthrope refused, the selection taken with the refusal); a journey that threw still runs OnPostFastTravel; the switch and the rider\'s set read as one key each, not the mod\'s whole settings every frame', () => {
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = rd(f);
    // DISC10-E L3 re-aim: the lycanthrope's refusal moved INTO the inventory door (ui/inventoryDoor.js, where DFU's
    // window says it - DaggerfallInventoryWindow.cs:583-587), which answers null; the host still takes the wagon
    // selection with any open that mounted nothing, refused or art-less
    assert.match(s, /openInventoryWithWagon: \(\) => \{\s*const w = inventoryDoorReady\(\) \? makeInventoryWindow\(\) : null;[^\n]*\n\s*if \(w\) townTalk\.showOverlay\(w\);\s*else hccRuntime\.consumeWagonSelectionRequest\(\);/, f);
    assert.match(s, /const hccOn = \(\) => \{ try \{ return modSetting\(HCC_VENDOR, 'Enabled'\) !== false; \} catch \{ return false; \} \};/, f);
  }
  const w = rd('src/scenes/world.js');
  assert.match(w, /let hccPostDue = true;/);
  assert.match(w, /hccPostDue = false; hccRuntimeOn\(\)\?\.handlePostFastTravel\(\);/);
  assert.match(w, /\} finally \{\n\s+if \(hccPostDue\) hccRuntimeOn\(\)\?\.handlePostFastTravel\(\);[^\n]*\n\s+_traveling = false;/);
  assert.match(w, /try \{ await _teleportToPixel\(land\.x, land\.y, null, \{ reposition: REPOSITION\.RandomStartMarker \}\); \}\s*finally \{ hccRuntimeOn\(\)\?\.handlePostFastTravel\(\); \}/);
});
