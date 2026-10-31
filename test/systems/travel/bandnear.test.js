// BAND-NEAR (FIELD FEEDBACK 2026-10-31, Discord #feature-feedback, a player: "Overworld packs ambushing you spawn way too
// far away, it's tedious especially when traveling a lot."): a band that catches the traveller with the view down stands
// at BAND_STAND_M, now inside its own members' 60 m sight - so it sees them and comes at once - and still past DFU's own
// 10-20 m wilderness ring. The camps keep CAMP-FAR's 100-150 m.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BAND_STAND_M, BAND_STAND_MIN_M, BAND_CONTACT_M } from '../../../src/systems/travel/travelBands.js';
import { CAMP_SIGHT_RADIUS, PACK_SPACING, MIN_CAMP_SPAWN_DISTANCE, MAX_CAMP_SPAWN_DISTANCE } from '../../../src/systems/campEncounters.js';
import { SPAWNER_ARMS } from '../../../src/systems/encounters.js';
import { NATIVE_PER_M } from '../../../src/systems/travel/travelDungeons.js';
import { hostText } from '../../hostText.mjs';

test('BAND-NEAR BN1: THE STAND-OFF - 45 m, so every member of a band stood there stands inside its own sight, and none inside DFU\'s wilderness ring; the 18 m floor never binds it; the camps keep CAMP-FAR\'s 100-150 m (mutants: back to 140, inside the ring)', () => {
  assert.equal(BAND_STAND_M, 45);
  // the anchor stands PACK_SPACING about the band's distance (world.js bandStand), each member PACK_SPACING about the anchor
  assert.ok(BAND_STAND_M + 2 * PACK_SPACING <= CAMP_SIGHT_RADIUS, `the farthest member (${BAND_STAND_M + 2 * PACK_SPACING} m) sees the traveller (${CAMP_SIGHT_RADIUS} m)`);
  assert.ok(BAND_STAND_M - 2 * PACK_SPACING > SPAWNER_ARMS.wilderness.maxDistance, `the nearest member (${BAND_STAND_M - 2 * PACK_SPACING} m) past DFU's ${SPAWNER_ARMS.wilderness.minDistance}-${SPAWNER_ARMS.wilderness.maxDistance} m ring`);
  assert.ok(BAND_STAND_M - PACK_SPACING > BAND_STAND_MIN_M, 'the floor is a floor, not the stand');
  assert.ok(BAND_STAND_M > BAND_CONTACT_M, 'with the view down a band stands farther than the Overworld\'s own contact');
  assert.deepEqual([MIN_CAMP_SPAWN_DISTANCE, MAX_CAMP_SPAWN_DISTANCE], [100, 150], 'NOT CHANGED: a camp is still come across (CAMP-FAR)');
});

test('BAND-NEAR BN2 host run: WITH THE VIEW DOWN A CHASE STOPS THE JOURNEY AT THE STAND-OFF AND STANDS THERE - lifted bandFrame and bandStand: a band 300 m back closes to BAND_STAND_M, the journey is asked then (not at 140 m), and the anchor stands a pack\'s spacing about it (mutants: the view up\'s ring, the old distance)', () => {
  const w = hostText('src/scenes/world.js');
  const cut = (name) => {   // a one-line function first (bandRoom), else to its closing brace (tv7_bands.test.js liftBands)
    const m = new RegExp(`\\n  function ${name}\\([^)]*\\) \\{[^\\n]*\\}\\n`).exec(w) ?? new RegExp(`\\n  function ${name}\\([^)]*\\) \\{\\n[\\s\\S]*?\\n  \\}\\n`).exec(w);
    assert.ok(m, name);
    return m[0];
  };
  const run = async () => {
    const law = await import('../../../src/systems/travel/travelBands.js');
    const at = { met: [], stood: [] };
    const c = { band: { id: 'b1.1.5' }, pos: { x: 0, z: 300 * NATIVE_PER_M }, gainAt: 0, best: 300, dist: 300, tries: 0, retryAt: 0 };
    const d = {
      _bandChase: new Map([['b1.1.5', c]]), _bandSpent: new Set(), _bandSpentAt: [], _bandPeer: new Map(),
      worldMoveBusy: () => false, travelView: { active: false }, isEnhanced: () => true, modes: { mode: 'exterior', deathUp: () => false },
      walkMode: true, playerSpawned: true, getPref: () => true, gamePaused: () => false,
      playerEntity: { health: 50, preventEnemySpawns: false }, player: { isPlayerSwimming: false, feetAt: () => [0, 0, 0] },
      _inAnyLocationRect: () => false, bandNowMs: () => 1_000_000, state: { worldCoords: () => ({ x: 0, z: 0 }) },
      travelViewBands: () => [], tvBandSeen: { night: false }, worldTimeScale: () => 1, bandPlace: (b) => b.at,
      bandMake: () => ({ mobileTypes: [1, 2] }), bandPeerChase: () => null, playerAfloat: () => false, owSaySpent: () => {},
      journeyMet: () => { at.met.push(c.dist); return null; }, wildBands: { step: () => ({ alerted: false }) }, wildStealth: () => 50,
      wildFoes: { alert: () => {} }, exteriorFoes: { noticedPlayer: () => {}, encounterRoom: () => Infinity },
      cam: { yaw: Math.PI / 4 }, fieldOfView: () => 0.5,   // AUDIT FB1031 B1 (PIN MOVED): a view turned off its bearing
      _standCampEncounter: (hit) => { at.stood.push([hit.minDistance, hit.maxDistance]); return { foes: Promise.resolve([]) }; },
    };
    const f = new Function('d', 'law', 'PACK_SPACING', `const { ${Object.keys(d).join(', ')} } = d;
      const { bandChaseStep, bandSight, bandStandBearing, BAND_CONTACT_M, BAND_STAND_M, BAND_STAND_MIN_M, BAND_STAND_TRIES, BAND_STAND_RETRY_MS, BANDS_WIRE_MAX } = law;
      const NATIVE_PER_M = ${NATIVE_PER_M}, PACK_ALERT_RADIUS = PACK_SPACING * 2; let _bandClock = 0;
      const campMembers = (t) => t, bandYaw = () => 0, bandSpend = (id) => _bandSpent.add(id), bandDrop = () => {}, performance = { now: () => 0 };
      ${cut('bandRoom')} ${cut('bandStand')} ${cut('bandFrame')} return bandFrame;`)(d, law, PACK_SPACING);
    for (let t = 1000; d._bandChase.size && t < 1000 + 600000; t += 100) f(t, 0.1);
    return at;
  };
  return run().then(({ met, stood }) => {
    assert.equal(met.length, 1, 'the journey asked once');
    assert.ok(Math.abs(met[0] - BAND_STAND_M) < 1e-6, `asked at the stand-off (${met[0].toFixed(2)} m), not at 140 m`);
    assert.deepEqual(stood, [[BAND_STAND_M - PACK_SPACING, BAND_STAND_M + PACK_SPACING]], 'the anchor a pack\'s spacing about it');
  });
});
