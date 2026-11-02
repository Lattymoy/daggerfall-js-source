// STALE-PARK (2026-10-22; bible/06-Systems/Horse-Cart-And-Cargo.md STALE-PARK): A DISMOUNT NEVER PARKS THE WAGON WHERE
// IT USED TO TRAIL. The runtime caches the trailing wagon's pose every frame it is drawn, and a dismount parks from that
// cache (CaptureBestAvailableDeploymentPose). The cache outlived the drawn wagon: through a stretch the host is not ready
// (a teleport, a fast travel) and while a driven wagon is not drawn (ShowTrailingWagon turned off mid-drive), and the
// next dismount parked the wagon where it last trailed - 303 m back in both pins below before the fix.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HCC_MOUNT_ACTION } from '../../../src/systems/horse/horseCart.js';
import { TRANSPORT, WAGON_MODE, HITCHED_HORSE_LOCAL_Z, WAGON_FOLLOW_DISTANCE } from '../../../src/systems/horse/horseCartLaw.js';
import { makeWorld, RATIO, WX0, WZ0 } from '../../hccWorld.mjs';

/** How far the parked wagon stands from the player, metres. */
const parkedFromPlayer = (w, st) => Math.hypot((st.WorldX - WX0) / RATIO - w.pos[0], (st.WorldZ - WZ0) / RATIO - w.pos[2]);
const farParkWarnings = (w) => w.log.filter((m) => /A dismount parked the wagon/.test(m));

/** A world whose player drives the cart 100 m. */
function driving() {
  const h = makeWorld();
  h.step();
  h.rt.tryUseTransport(TRANSPORT.Cart);
  h.step(3);
  h.walk(100);
  return h;
}

test('STALE-PARK: a dismount seen on the first ready frame after a not-ready stretch parks the wagon behind the player', () => {
  const { w, step, walk, state } = driving();
  w.ready = false;
  walk(300, 30);   // the host not ready (a teleport, a fast travel) while the player is carried on
  w.ready = true;
  w.mode = TRANSPORT.Foot;   // the dismount, observed on the first ready frame
  step(2);
  assert.equal(state().Mode, WAGON_MODE.Deployed);
  assert.ok(Math.abs(parkedFromPlayer(w, state()) - WAGON_FOLLOW_DISTANCE) < 1e-6, `the mod's fallback behind the player, not ${parkedFromPlayer(w, state()).toFixed(1)} m`);
});

test('STALE-PARK: a dismount after the trailing wagon was hidden mid-drive parks it behind the player', () => {
  const { rt, w, step, walk, state } = driving();
  w.settings.showTrailingWagon = false;
  rt.handleSettingsChanged();
  walk(300);
  w.mode = TRANSPORT.Foot;
  step(2);
  assert.equal(state().Mode, WAGON_MODE.Deployed);
  assert.ok(Math.abs(parkedFromPlayer(w, state()) - WAGON_FOLLOW_DISTANCE) < 1e-6, `the mod's fallback behind the player, not ${parkedFromPlayer(w, state()).toFixed(1)} m`);
});

test('STALE-PARK: the hotkey dismount still parks the wagon where its wheels stood, and says nothing', () => {
  const { w, step, state } = driving();
  w.keys.add(HCC_MOUNT_ACTION);   // the transport goes to Foot inside this frame, before the presentation step
  step();
  step();   // ObserveTransportMode parks from the pose the last drawn frame cached
  assert.equal(state().Mode, WAGON_MODE.Deployed);
  assert.ok(Math.abs(parkedFromPlayer(w, state()) - HITCHED_HORSE_LOCAL_Z) < 1e-6, `where the wheels stood, not ${parkedFromPlayer(w, state()).toFixed(1)} m`);
  assert.deepEqual(farParkWarnings(w), []);
});

test('STALE-PARK: a park past the jump distance is logged with its distance and where its pose came from', () => {
  const { w, step, state } = driving();
  w.keys.add(HCC_MOUNT_ACTION);
  step();   // the dismount pressed: the pose of the last drawn frame is kept for the next
  w.pos[2] += 300;   // the player moved on before the next frame observed the dismount
  step();
  assert.equal(state().Mode, WAGON_MODE.Deployed);
  const said = farParkWarnings(w);
  assert.equal(said.length, 1);
  assert.match(said[0], /parked the wagon 30\d\.\d m from the player, at the trailing pose cached \d+\.\d s earlier\./);
});
