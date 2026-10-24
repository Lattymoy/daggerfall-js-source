// FB1020c OAR-RUNG (the field, 2026-10-20: "ships drift off if you fast travel without full sails") - THE AUTORUN TAKES
// THE OARS FROM THE KEPT RUNG (systems/comeSailAway/comeSailAway.js updateSailing).
//
// The Overworld's crossing (OWS2, 2026-09-28: scenes/world.js tvSeaSail, systems/seaHelm.js) sails a boat through the
// helm's keys alone - the rudder held, the sail key's edge, and the autorun for her oars. HELM-LADDER (2026-10-04) made
// the oars a KEPT RUNG (`oarThrottle`: backing water, at rest, pulling ahead), reset only by a press, a sail raised or
// the helm taken or left - and the crossing's hand never knew it. A journey begun at a helm left on her oars ("without
// full sails": W once, or S from her last sail) kept the rung through the journey and past its end: the hand let go,
// the sails came down, and she rowed on unsteered (a Large Galley at her crew's 7.8 m/s, 931 m in two minutes). A helm
// left backing water reversed the hand's rudder (backing, the helm answers the other way) while the autorun rowed her
// ahead, so no journey arrived at all. Driven here on the mod's own runtime and the real hand (test/csaCrossing.mjs,
// the crossing's scene moved out of ows2_crossing.test.js and given the helm's presses and the journey's end).
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sea, sailTo } from '../../csaCrossing.mjs';

const W = 'MoveForwards', S = 'MoveBackwards';
/** The rungs a player may leave her helm on before the journey sets out. */
const RUNGS = Object.freeze({
  rest: [],
  oars: [W],   // "Oars: pulling ahead."
  allSail: [W, W, W, W],   // the oars, then her sails: "All sail is set."
  struck: [W, W, W, W, S],   // her last sail taken in by S - onto her oars, pulling ahead (HELM-LADDER's ladderDown)
  backing: [S],   // "Oars: backing water."
});

test('FB1020c OAR-RUNG: a Large Galley sent on a journey from any rung of her helm arrives, and once the hand lets go she comes to rest - her oars never pull on unsteered; the rung she was left on is gone (mutants: the autorun leaves the rung; the rung set again)', () => {
  for (const [rung, presses] of Object.entries(RUNGS)) {
    for (const windDeg of [90, 180]) {
      const r = sailTo(3, windDeg, 0, { presses });
      assert.ok(r, `${rung}, the wind toward ${windDeg}: the galley arrives`);
      assert.equal(r.rung, 0, `${rung}: the hand's oars took the rung - none left at the journey's end`);
      const after = r.letGo(120);
      assert.ok(after.way < 0.05, `${rung}, the wind toward ${windDeg}: at rest two minutes after the hand let go (her way ${after.way.toFixed(2)} m/s; the bug rowed on at 7.8)`);
      assert.ok(after.run < 400, `${rung}: she only coasts to a stop (${after.run.toFixed(0)} m; the bug made 931 m)`);
      assert.equal(after.rung, 0);
    }
  }
});

test('FB1020c OAR-RUNG: a helm left BACKING WATER no longer turns the hand\'s rudder about - the Large Boat, the Small Ship and the Large Galley each reach a mark astern from it, as from every other rung (mutant: the autorun leaves the rung)', () => {
  for (const hull of [1, 2, 3]) {
    const times = Object.fromEntries(Object.entries(RUNGS).map(([rung, presses]) => [rung, sailTo(hull, 90, 180, { presses })?.t ?? null]));
    assert.ok(times.backing != null, `hull ${hull}: from backing water the journey arrives (it never did)`);
    for (const [rung, t] of Object.entries(times)) assert.ok(t != null && Math.abs(t - times.rest) <= 2, `hull ${hull}, ${rung}: arrives as from rest (${t} s against ${times.rest} s)`);
  }
});

test('FB1020c OAR-RUNG: the player\'s own autorun at a helm takes the oars the same way - a kept rung is let go while it pulls, and with it let go she rests; with no autorun the rung is the helm\'s as HELM-LADDER keeps it (mutants: the autorun leaves the rung; every frame ships the rung)', () => {
  const s = sea();
  const boat = s.rt.PlaceBoat([0, 34, 0], [0, 0, 1], 3, 0, null);
  s.rt.StartSailing(boat);
  const frame = () => { s.rt.endOfFrame(); s.rt.fixedUpdate(); s.rt.update(); s.rt.lateUpdate(); };
  const press = (k) => { s.started.add(k); frame(); s.started.clear(); };
  press(W);
  assert.equal(s.rt.state.oarThrottle, 1, 'pulling ahead, the rung kept');
  for (let i = 0; i < 40; i++) frame();
  assert.equal(s.rt.state.oarThrottle, 1, 'no key held, no autorun: the rung stays (HELM-LADDER)');
  assert.ok(s.rt.state.MoveVectorCurrent[2] > 1, 'and she rows on it');
  s.input.toggleAutorun = true;
  frame();
  assert.equal(s.rt.state.oarThrottle, 0, 'the autorun pulls: the rung let go');
  for (let i = 0; i < 8; i++) frame();
  assert.ok(s.rt.state.MoveVectorCurrent[2] > 1, 'rowing ahead on the autorun');
  s.input.toggleAutorun = false;
  for (let i = 0; i < 480; i++) frame();   // two minutes: her crew's way coasted off
  assert.equal(s.rt.state.oarThrottle, 0);
  assert.ok(Math.hypot(...s.rt.state.MoveVectorCurrent) < 0.05, 'the autorun let go: she rests, no rung left to pull');
});

test('FB1020c OAR-RUNG by source: the shift is the stroke\'s own, ahead of where the oars are read, in createComeSailAwayRuntime (no host grew: the crossing in world.js is untouched)', () => {
  const src = readFileSync(new URL('../../../src/systems/comeSailAway/comeSailAway.js', import.meta.url), 'utf8');
  const shift = src.indexOf('      if (deps.input?.toggleAutorun) state.oarThrottle = 0;');
  const stroke = src.indexOf('      if ((state.oarThrottle > 0 || deps.input?.toggleAutorun) && IsNodeOnWater(boat, 0)) num3 = 1;');
  assert.ok(shift > 0 && stroke > shift, 'the autorun lets the rung go before the stroke reads it');
  assert.equal(src.split('if (deps.input?.toggleAutorun) state.oarThrottle = 0;').length, 2, 'one home');
});
