// A3: scene ambience - the AmbientEffectsPlayer port (clip tables,
// preset mapping, wait rolls, loops, the exclusive channel, water).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AMBIENT_SOUNDS, AMBIENT_RAIN_LOOP, AMBIENT_CRICKETS_LOOP,
  WATER_GENTLE, AMBIENT_WATER_BUBBLES,
  DUNGEON_AMBIENT_WAITS, EXTERIOR_AMBIENT_WAITS,
  CEMETERY_AMBIENT_SOUNDS, CEMETERY_AMBIENT_WAITS,
  presetForExterior, AmbientEffects,
} from '../src/systems/ambientEffects.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const stubEngine = () => {
  const rec = { plays3d: [], plays: [], loops: [] };
  rec.engine = {
    play3d: (index, pos, vol, opts) => { rec.plays3d.push({ index, pos, opts }); return 2.0; },   // 2s clips
    playOneShot: (index) => { rec.plays.push(index); return 2.0; },
    loop: (index) => {
      const h = { index, stopped: false, stop() { this.stopped = true; } };
      rec.loops.push(h);
      return h;
    },
  };
  return rec;
};

test('ambient: the clip tables + scene wait windows pinned', () => {
  // The 14 dungeon one-shots, SoundClips 63..76 in enum order
  assert.deepEqual([...AMBIENT_SOUNDS.dungeon], [63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76]);
  assert.deepEqual([...AMBIENT_SOUNDS.storm], [348, 349, 350]);
  assert.deepEqual([...AMBIENT_SOUNDS.sunnyDay], [437, 438]);
  assert.equal(AMBIENT_RAIN_LOOP, 389);
  assert.equal(AMBIENT_CRICKETS_LOOP, 6);
  assert.equal(WATER_GENTLE, 439);
  assert.equal(AMBIENT_WATER_BUBBLES, 114);
  // The SERIALIZED scene components override the script's 4/35
  assert.deepEqual({ ...DUNGEON_AMBIENT_WAITS }, { minWait: 5, maxWait: 28 });
  assert.deepEqual({ ...EXTERIOR_AMBIENT_WAITS }, { minWait: 5, maxWait: 25 });
});

test('ambient: WeatherManager.SetAmbientEffects mapping - rain diverts, the rest folds to day/night', () => {
  assert.equal(presetForExterior('rain', false), 'rain');
  assert.equal(presetForExterior('thunder', true), 'storm');
  assert.equal(presetForExterior('sunny', false), 'sunnyDay');
  assert.equal(presetForExterior('sunny', true), 'clearNight');
  for (const w of ['cloudy', 'overcast', 'fog', 'snow']) {
    assert.equal(presetForExterior(w, false), 'sunnyDay');
    assert.equal(presetForExterior(w, true), 'clearNight');
  }
});

test('ambient: one-shots fire after the Next(min,max) wait, somewhere around the player', () => {
  const rec = stubEngine();
  // wait rolls 0,0 (the constructor AND setPreset each re-roll) ->
  // wait 5; then pick 0 -> clip 63; sphere rolls (z .5, theta 0,
  // dist roll 0 -> 10)
  const a = new AmbientEffects({ minWait: 5, maxWait: 28 }, rec.engine, seq(0, 0, 0, 0.5, 0, 0));
  a.setPreset('dungeon');
  a.update(4.9, { playerPos: [100, 20, 100] });
  assert.equal(rec.plays3d.length, 0);   // still waiting
  a.update(0.2, { playerPos: [100, 20, 100] });
  assert.equal(rec.plays3d.length, 1);
  const p = rec.plays3d[0];
  assert.equal(p.index, 63);
  assert.deepEqual(p.opts, { refDistance: 13, maxDistance: 13 * 8 });   // min 13, max min*8
  const d = Math.hypot(p.pos[0] - 100, p.pos[1] - 20, p.pos[2] - 100);
  assert.ok(d >= 10 - 1e-6 && d <= 20 + 1e-6, `distance ${d} outside 10..20`);
  // doNotPlayInCastle: the next effect is silent in a castle block
  const b = new AmbientEffects({ minWait: 5, maxWait: 28 }, rec.engine, seq(0, 0));
  b.setPreset('dungeon');
  b.update(5.1, { playerPos: [0, 0, 0], inCastle: true });
  assert.equal(rec.plays3d.length, 1);
});

test('ambient: the exclusive channel - a playing clip skips the next effect until it ends', () => {
  const rec = stubEngine();
  const a = new AmbientEffects({ minWait: 1, maxWait: 2 }, rec.engine, seq(0, 0, 0.5, 0, 0));   // every wait rolls 1s; 2s clips
  a.setPreset('dungeon');
  a.update(1.1, { playerPos: [0, 0, 0] });
  assert.equal(rec.plays3d.length, 1);   // busy for 2s now
  a.update(1.1, { playerPos: [0, 0, 0] });
  assert.equal(rec.plays3d.length, 1);   // skipped - channel busy (0.9s left)
  a.update(1.1, { playerPos: [0, 0, 0] });
  assert.equal(rec.plays3d.length, 2);   // freed - plays again
});

test('ambient: preset loops - rain/storm start the rain loop, clearNight crickets, switches stop them', () => {
  const rec = stubEngine();
  const a = new AmbientEffects({ minWait: 5, maxWait: 25 }, rec.engine, seq(0));
  a.setPreset('rain');
  a.update(0.01, {});
  assert.equal(rec.loops.length, 1);
  assert.equal(rec.loops[0].index, 389);
  a.setPreset('storm');                       // switch stops, storm restarts rain
  assert.ok(rec.loops[0].stopped);
  a.update(0.01, { playerPos: [0, 0, 0] });
  assert.equal(rec.loops.length, 2);
  assert.equal(rec.loops[1].index, 389);
  a.setPreset('clearNight');
  assert.ok(rec.loops[1].stopped);
  a.update(0.01, {});
  assert.equal(rec.loops[2].index, 6);        // crickets
  a.dispose();
  assert.ok(rec.loops[2].stopped);
});

test('ambient: storm one-shots land on the horizon ring; water rides the classic cadence', () => {
  const rec = stubEngine();
  // storm: wait rolls 0,0 -> 5s; pick 0.99 -> ThunderRoll 350; the
  // horizon angle roll follows
  const a = new AmbientEffects({ minWait: 5, maxWait: 25 }, rec.engine, seq(0, 0, 0.99, 0.25));
  a.setPreset('storm');
  a.update(5.1, { playerPos: [50, 10, 50] });
  const shot = rec.plays3d[0];
  assert.equal(shot.index, 350);
  assert.equal(shot.opts.refDistance, 3000);
  // unit offset: |xz| = 0.94, y = +0.34 (20deg above the horizon)
  const dx = shot.pos[0] - 50, dy = shot.pos[1] - 10, dz = shot.pos[2] - 50;
  assert.ok(Math.abs(Math.hypot(dx, dz) - 0.94) < 1e-6);
  assert.ok(Math.abs(dy - 0.34) < 1e-6);
  // Water (dungeon): classicRand < 50 -> WaterGentle at the surface
  // beside the player (min 8); submerged + rand < 100 -> bubbles flat
  const rec2 = stubEngine();
  const w = new AmbientEffects({ minWait: 500, maxWait: 501 }, rec2.engine, seq(0, 0.5, 0.5), seq(10, 60));
  w.setPreset('dungeon');
  w.update(0.07, { playerPos: [10, 5, 10], waterSurfaceY: 6, submerged: true });   // one classic tick
  assert.equal(rec2.plays3d.length, 1);
  assert.equal(rec2.plays3d[0].index, 439);
  assert.equal(rec2.plays3d[0].pos[1], 6);          // AT the water surface
  assert.equal(rec2.plays3d[0].opts.refDistance, 8);
  assert.equal(rec2.plays.length, 0);               // bubbles skipped: the channel is busy with WaterGentle
  // A dry block plays nothing
  const rec3 = stubEngine();
  const w2 = new AmbientEffects({ minWait: 500, maxWait: 501 }, rec3.engine, seq(0), seq(10, 10));
  w2.setPreset('dungeon');
  w2.update(0.07, { playerPos: [0, 0, 0], waterSurfaceY: null, submerged: false });
  assert.equal(rec3.plays3d.length, 0);
});

// AUDIT 26 (parity F088): the exterior ambient player is a CHILD of the
// scene's Exterior object, so it is switched OFF on the way indoors.
test('ambient: going inside DEACTIVATES the exterior player - the rain loop stops and Update stops running', () => {
  const rec = stubEngine();
  const a = new AmbientEffects(EXTERIOR_AMBIENT_WAITS, rec.engine, () => 0.999);
  a.setPreset('rain');
  a.update(0.1, { playerPos: [0, 0, 0] });
  assert.equal(rec.loops.length, 1);
  assert.equal(rec.loops[0].index, AMBIENT_RAIN_LOOP);
  assert.equal(rec.loops[0].stopped, false);
  // EnableInteriorParent/EnableDungeonParent -> DisableAllParents ->
  // ExteriorParent.SetActive(false) (PlayerEnterExit.cs:1048), which
  // stops the object's AudioSources and fires OnDisable (:96-100).
  a.setActive(false);
  assert.equal(rec.loops[0].stopped, true, 'the outdoor rain goes silent indoors');
  // an inactive GameObject's Update does not run: no loop restarts,
  // no one-shots, and the counters do not advance
  a.update(1000, { playerPos: [0, 0, 0] });
  assert.equal(rec.loops.length, 1, 'no loop restarts while the object is inactive');
  assert.equal(rec.plays3d.length, 0);
  // WeatherManager.Update returns while inside, so Presets is FROZEN,
  // not cleared - the preset is not what goes quiet, the object is
  assert.equal(a.preset, 'rain');
  // EnableExteriorParent (:1056-1071) turns it back on and Update's
  // lazy branch restarts the loop the frozen preset still names
  a.setActive(true);
  a.update(0.1, { playerPos: [0, 0, 0] });
  assert.equal(rec.loops.length, 2, 'the loop restarts on the way back out');
  assert.equal(rec.loops[1].index, AMBIENT_RAIN_LOOP);
  // the crickets loop takes the same round trip
  const n = stubEngine();
  const b = new AmbientEffects(EXTERIOR_AMBIENT_WAITS, n.engine, () => 0.999);
  b.setPreset('clearNight');
  b.update(0.1, {});
  assert.equal(n.loops[0].index, AMBIENT_CRICKETS_LOOP);
  b.setActive(false);
  assert.equal(n.loops[0].stopped, true);
  // setActive is idempotent - a second transition does not double-stop
  b.setActive(false);
  assert.equal(n.loops.length, 1);
});

// AUDIT 26 (parity F089): the cemetery layer - a second channel on its
// own 1/80-second clock, armed by OnEnterLocationRect.
test('ambient: the cemetery layer - three clips, Next(1,80), armed only in a Graveyard rect from outside', () => {
  assert.deepEqual([...CEMETERY_AMBIENT_SOUNDS], [113, 14, 14]);   // Howl, BirdCall, BirdCall
  assert.deepEqual({ ...CEMETERY_AMBIENT_WAITS }, { minWait: 1, maxWait: 80 });
  const rec = stubEngine();
  // draw 1: the MAIN wait, 5 + floor(.999*20) = 24, so it never fires
  // below. draw 2: the cemetery wait, 1 + floor(0*79) = 1.
  const rng = seq(0.999, 0, 0, 0.5, 0, 0, 0.999);
  const a = new AmbientEffects(EXTERIOR_AMBIENT_WAITS, rec.engine, rng);
  assert.equal(a.isCemeteryNearby, false);
  a.onEnterLocationRect(LOCATION_TYPES.Graveyard, { inside: false });
  assert.equal(a.isCemeteryNearby, true);
  a.update(0.5, { playerPos: [10, 2, 10] });
  assert.equal(rec.plays3d.length, 0, 'still inside the 1-second window');
  a.update(0.6, { playerPos: [10, 2, 10] });
  assert.equal(rec.plays3d.length, 1);
  // draw 3 (0) picks index 0 = AmbientDistantHowl; PlaySomewhereAround
  // min distance is 13, the same as the ordinary one-shots
  assert.equal(rec.plays3d[0].index, 113);
  assert.equal(rec.plays3d[0].opts.refDistance, 13);
});

test('ambient: the cemetery arm is cleared first, needs OUTSIDE, and the tick re-checks IsPlayerInside', () => {
  const mk = () => new AmbientEffects(EXTERIOR_AMBIENT_WAITS, stubEngine().engine, () => 0);
  // OnEnterLocationRect clears the flag before testing, so a non-
  // graveyard rect disarms a graveyard the player just left
  const a = mk();
  a.onEnterLocationRect(LOCATION_TYPES.Graveyard, { inside: false });
  a.onEnterLocationRect(LOCATION_TYPES.TownCity, { inside: false });
  assert.equal(a.isCemeteryNearby, false);
  // entering the rect while already INSIDE arms nothing
  const b = mk();
  b.onEnterLocationRect(LOCATION_TYPES.Graveyard, { inside: true });
  assert.equal(b.isCemeteryNearby, false);
  // OnExitLocationRect clears it
  const c = mk();
  c.onEnterLocationRect(LOCATION_TYPES.Graveyard, { inside: false });
  c.onExitLocationRect();
  assert.equal(c.isCemeteryNearby, false);
  // and the tick's own `!IsPlayerInside` guard holds the counter even
  // while the flag is armed - the guard the dungeon instance rides
  const rec = stubEngine();
  const d = new AmbientEffects(EXTERIOR_AMBIENT_WAITS, rec.engine, seq(0.999, 0, 0, 0, 0, 0));
  d.onEnterLocationRect(LOCATION_TYPES.Graveyard, { inside: false });
  d.update(20, { playerPos: [0, 0, 0], inside: true });
  assert.equal(rec.plays3d.length, 0, 'a graveyard heard from indoors is silent');
  d.update(2, { playerPos: [0, 0, 0], inside: false });
  assert.equal(rec.plays3d.length, 1);
});
