// TIME-DILATION (2026-10-17, the owner: "fix a pre existing issue where AI can actually use the overworld as time
// dilation"; bible/03-World/Naval-Refit.md TIME-DILATION) - the sea fight is stepped on the world's clock, and the
// Overworld's journeys and keys run that clock at x5 to x100: the ships of the sea, and theirs alone of the AI (land
// foes keep their own pace, TO1's departure), fired and sailed at that rate on a traveller who could not fire back. Held:
// the journey's clock at x1 inside a hostile ship's hold (travelThreat.js foeRate, the threats' `holds`); the Overworld
// brought down, never raised and refused over one (the view's danger); and online a sea a peer shares at real time
// (systems/naval/seaClock.js) - my clock never the AI's against another player. tools/mutants/timedilation.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { threatCap, foeRate, foePaced, JOURNEY_FOE_PACE } from '../../../src/systems/travel/travelThreat.js';
import { setTravelPace, _resetTravelPace } from '../../../src/systems/travel/travelPace.js';
import { sharedSea, seaSeconds } from '../../../src/systems/naval/seaClock.js';
import { HOSTILE_NEAR_M } from '../../../src/scenes/naval/navalHost.js';
import { NAVAL_SHARE_RADIUS } from '../../../src/systems/naval/navalWire.js';
import { _setTimeScaleForTest } from '../../../src/systems/timeScale.js';
import { sea } from '../../navalSea.mjs';
import { hostText } from '../../hostText.mjs';

test('TIME-DILATION the law: inside a threat\'s hold the clock is x1 whatever the foe dial says (x60 too) - outside it the near-enemy pace as before; held whether the traveller moves or stands; a threat with no hold (a land foe, a band) holds nothing (mutants: the hold, its ring, the floor)', () => {
  _resetTravelPace();
  const ship = (d) => ({ dx: d, dz: 0, reach: HOSTILE_NEAR_M, holds: HOSTILE_NEAR_M });
  const inside = threatCap({ threats: [ship(400)], heading: { x: 1, z: 0 }, speedMps: 4 });
  assert.equal(inside.held, true, 'within her ring');
  assert.equal(foeRate(inside, 60), 1, 'x1 - never the near-enemy pace');
  assert.equal(foePaced(inside.cap, 60), JOURNEY_FOE_PACE, 'the floor the sea fight ran under');
  setTravelPace('foe', 60);
  assert.equal(foeRate(inside, 60), 1, 'the dial at x60: still x1');
  _resetTravelPace();
  const outside = threatCap({ threats: [ship(HOSTILE_NEAR_M + 400)], heading: { x: 1, z: 0 }, speedMps: 4 });
  assert.equal(outside.held, false);
  assert.equal(foeRate(outside, 60), foePaced(outside.cap, 60), 'outside her ring: the cap and its floor, unchanged');
  assert.equal(threatCap({ threats: [ship(400)], speedMps: 0 }).held, true, 'a traveller standing is held too');
  assert.equal(threatCap({ threats: [{ dx: 10, dz: 0, reach: 60 }], speedMps: 4 }).held, false, 'a land foe holds no ring');
  assert.equal(foeRate(threatCap({ threats: [{ dx: 10, dz: 0, reach: 60 }], heading: { x: 1, z: 0 }, speedMps: 4 }), 60), JOURNEY_FOE_PACE, 'a camp beside me: the near-enemy pace still');
  assert.equal(threatCap({ threats: [], speedMps: 4 }).held, false);
  assert.equal(foeRate(null, 30), foePaced(Infinity, 30), 'no word: the ask under the floor');
});

test('TIME-DILATION the sea\'s threats: each hostile ship afloat says her hold, HOSTILE_NEAR_M - a pirate engaging me at 160 m holds the journey at x1 through the governor\'s law; the world host passes her hold on, reads the law on both its fast travels, and brings the Overworld down, never raises it and refuses it over a hostile ship (mutants: the tag, the wiring)', async () => {
  const s = await sea({ hull: 2, settings: { ShipsAtSea: 'off', Boarders: false } });
  s.run(1);
  s.host.spawnShip('pirateBrig', { range: 160, bearing: Math.PI / 2, temper: 'bold' });
  s.run(2);
  const threats = s.host.threats();
  assert.ok(threats.length >= 1, 'she is a threat');
  assert.ok(threats.every((t) => t.holds === HOSTILE_NEAR_M), 'each her hold');
  const fx = s.view.feet;
  const cap = threatCap({ threats: threats.map((t) => ({ dx: t.pos[0] - fx[0], dz: t.pos[2] - fx[2], reach: t.reach, holds: t.holds, ...(t.chasing ? { chasing: true, mps: t.mps } : {}) })), heading: { x: 0, z: 1 }, speedMps: 4 });
  assert.equal(foeRate(cap, 60), 1, 'the journey at x1 alongside her');
  const W = hostText('src/scenes/world.js');
  assert.match(W, /for \(const t of naval\?\.threats\(\) \?\? \[\]\) out\.push\(\{ dx: t\.pos\[0\] - fx\[0\], dz: t\.pos\[2\] - fx\[2\], reach: t\.reach, holds: t\.holds,/);
  assert.match(W, /const rate = csaHoldsTimeScale\(\) \? null : \(foes\.strangerRate \? Math\.min\(foeRate\(foes, travelAsked\), foes\.strangerRate\) : foeRate\(foes, travelAsked\)\);/);
  assert.match(W, /const foeCap = foes\.strangerRate \? Math\.min\(foeRate\(foes, want\), foes\.strangerRate\) : foeRate\(foes, want\);/);
  assert.equal((W.match(/foePaced\(/g) ?? []).length, 0, 'no journey under the bare floor');
  assert.match(W, /danger: \(\) => duelEnemyNear\(\) \|\| \(!playerEntity\.staffHidden && areEnemiesNearby\(wildSeen\(exteriorFoePool\(\)\)\)\) \|\| navalHostileNear\(\),/);
  // PIN MOVED (OW-RISE): the rise counts the foes the view's danger does - WILD-ALERT's wildSeen (test/systems/travel/ow_rise.test.js)
  assert.match(W, /duelEnemyNear\(\) \|\| areEnemiesNearby\(wildSeen\(exteriorFoePool\(\)\)\) \|\| navalHostileNear\(\) \|\| !travelViewAllowed\(\)\.ok\) return;/);
  assert.match(W, /if \(duelEnemyNear\(\) \|\| areEnemiesNearby\(exteriorFoePool\(\)\) \|\| navalHostileNear\(\)\) \{ tvSay\(TRAVEL_VIEW_TEXT\.enemies\); return false; \}/);
});

test('TIME-DILATION the shared sea: a peer within NAVAL_SHARE_RADIUS shares my sea, and it sails at real time whatever my clock - alone (offline, or the peer past the radius) it keeps the world\'s, as AUDIT NAV1 laid down; the seconds never negative (mutants: the share, the radius, the real time, the wiring)', async () => {
  assert.equal(sharedSea([{ feet: [100, 0, 0] }], [0, 0, 0], NAVAL_SHARE_RADIUS), true);
  assert.equal(sharedSea([{ feet: [NAVAL_SHARE_RADIUS + 5, 0, 0] }], [0, 0, 0], NAVAL_SHARE_RADIUS), false);
  assert.equal(sharedSea([{ feet: [0, 900, 10] }], [0, 0, 0], 50), true, 'on the water\'s plane - a height is no distance');
  assert.equal(sharedSea([{}], [0, 0, 0], 50), false, 'a peer with no feet said');
  assert.equal(sharedSea(null, [0, 0, 0], 50), false);
  assert.deepEqual([seaSeconds(3, 30, true), seaSeconds(3, 30, false), seaSeconds(3, 1, true), seaSeconds(-1, 30, false)], [0.1, 3, 3, 0]);
  // the real host: a ship of the sea sailing on, my clock at x30 - with a peer near she sails a real second's way a frame
  const sail = async (peerAt, scale) => {
    const s = await sea({ hull: 2, seed: 9, settings: { ShipsAtSea: 'off', Boarders: false }, online: { id: () => 'a-player', peers: () => [{ id: 'b-player', feet: peerAt }], sendHit: () => true } });
    s.run(1);
    const id = s.host.spawnShip('merchantCoaster', { range: 400, bearing: 0, yaw: Math.PI / 2 });
    s.run(1);
    const e = s.host._sea.get(id);
    const from = [...e.ship.pos];
    _setTimeScaleForTest(scale);
    try { for (let i = 0; i < 30; i++) s.host.frame((1 / 30) * scale); } finally { _setTimeScaleForTest(1); }
    return Math.hypot(e.ship.pos[0] - from[0], e.ship.pos[2] - from[2]);
  };
  const real = await sail([50, 0, 0], 1), sharedFast = await sail([50, 0, 0], 30), alone = await sail([NAVAL_SHARE_RADIUS * 3, 0, 0], 30);
  assert.ok(real > 0.5, `she sails (${real.toFixed(2)} m)`);
  assert.ok(Math.abs(sharedFast - real) < real * 0.25, `shared: a real second's way at x30 (${sharedFast.toFixed(2)} m against ${real.toFixed(2)})`);
  assert.ok(alone > real * 5, `alone: the world's thirty seconds (${alone.toFixed(2)} m)`);
  assert.match(hostText('src/scenes/naval/navalHost.js'), /const total = paused \? 0 : Math\.min\(seaSeconds\(dt, timeScale\(\), sharedSea\(deps\.online\?\.peers\?\.\(\), deps\.feet\(\), NAVAL_SHARE_RADIUS\)\), FRAME_STEP_S \* FRAME_STEPS_MAX\);/);
});
