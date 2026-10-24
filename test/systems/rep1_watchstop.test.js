// REP1 (2026-09-29, the reputation overhaul) - THE WATCH STOPS A KNOWN CRIMINAL IT SEES. Mac: "So I want to talk about
// overhauling the reputation system. Something just much better and not as punishing, but still punishing." - and, of the
// options put to him for low standing in town, "Challenged on sight".
//
// DFU rolled a 5% Criminal Conspiracy every game minute for a legal standing under -10 (PlayerEntity.cs:498-511), no guard
// needed anywhere near: in a town the watch about every hundred real seconds at the 12x clock. The roll is retired; a
// guard with a clear line to a known criminal stops them - pay, come quietly, or refuse - once in two game hours per
// region, never inside a day's grace after the law is answered.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  knownCriminal, challengeDue, noteChallenge, grantGrace, challengeFine, banish,
  KNOWN_CRIMINAL_BELOW, CHALLENGE_COOLDOWN_MINUTES, CHALLENGE_GRACE_MINUTES,
} from '../../src/systems/standing.js';
import { createStandingWatch, STANDING_LOOK_MS } from '../../src/scenes/standingHost.js';
import { createCityGuards } from '../../src/scenes/cityGuards.js';
import { CRIMES } from '../../src/systems/court.js';
import { createRegionConditions } from '../../src/systems/region/regionConditions.js';
import { hostText } from '../hostText.mjs';   // HOST-SPLIT 2 (AUDIT, the second read): its negatives read the host whole

const src = (p) => hostText(p);
const player = (legal = -20, gold = 5000) => ({ legalRep: { 3: legal }, goldPieces: gold, items: [], health: 50, regionConditions: createRegionConditions() });

test('REP1: who the watch knows, and when it may stop them - under -10 or banished; two game hours between stops; a day\'s grace once the law is answered (mutants: DFU\'s line moved; no cooldown; no grace)', () => {
  assert.equal(KNOWN_CRIMINAL_BELOW, -10);
  assert.equal(knownCriminal(player(-10), 3), false, 'at -10: undependable, not known');
  assert.equal(knownCriminal(player(-11), 3), true, 'a scoundrel is known');
  const b = player(5);
  banish(b, 3, 0);
  assert.equal(knownCriminal(b, 3, { ownNow: 10, worldNow: 10 }), true, 'a banishment standing is known whatever the number');
  const p = player(-20);
  assert.equal(challengeDue(p, 3, { ownNow: 1000 }), true);
  noteChallenge(p, 3, 1000);
  assert.equal(challengeDue(p, 3, { ownNow: 1000 + CHALLENGE_COOLDOWN_MINUTES - 1 }), false, 'inside the two hours');
  assert.equal(challengeDue(p, 3, { ownNow: 1000 + CHALLENGE_COOLDOWN_MINUTES }), true);
  assert.equal(challengeDue(p, 4, { ownNow: 1001 }), false, 'another region has its own book (and no bad name)');
  grantGrace(p, 3, 2000);
  assert.equal(challengeDue(p, 3, { ownNow: 2000 + CHALLENGE_GRACE_MINUTES - 1 }), false, 'the grace');
  assert.equal(challengeDue(p, 3, { ownNow: 2000 + CHALLENGE_GRACE_MINUTES }), true);
});

test('REP1: the fine on the spot is the court\'s own Conspiracy penalty in coin - 520 at -11, 720 at -50, 1000 at -100 - and double for a banished face (mutants: the table\'s sign; the banished double)', () => {
  assert.deepEqual([-11, -50, -100].map((v) => challengeFine(player(v), 3)), [520, 720, 1000]);
  const b = player(-50);
  banish(b, 3, 0);
  assert.equal(challengeFine(b, 3, { worldNow: 5 }), 1440);
});

/** The stop over its seams: a guard who sees (or not), a recording overlay, the arrest flow's two doors. */
function watchRig({ legal = -20, gold = 5000, sees = true } = {}) {
  const p = player(legal, gold);
  const t = { ms: 0, own: 5000, world: 5000 };
  const shown = [], said = [], calls = { surrender: 0, crime: 0, look: 0 };
  let blocked = false, onStreet = true, inCourt = false;
  const watch = createStandingWatch({
    playerEntity: p,
    townTalk: { showOverlay: (w) => shown.push(w), say: (l) => said.push(l) },
    arrestFlow: { inCourt: () => inCourt, surrenderToChallenge: () => { calls.surrender++; return true; } },
    cityGuards: { guardSeesPlayer: () => { calls.look++; return sees ? { guard: true } : null; } },
    guardPool: () => [], playerFeet: () => [0, 0, 0], regionIndex: () => 3, regionName: () => 'Daggerfall',
    ownNow: () => t.own, worldNow: () => t.world,
    crimeResponse: () => { calls.crime++; },
    onStreet: () => onStreet, blocked: () => blocked, clock: () => t.ms,
  });
  const look = () => { t.ms += STANDING_LOOK_MS; return watch.frame(); };
  return { p, t, watch, shown, said, calls, look, set: (o) => { if ('blocked' in o) blocked = o.blocked; if ('onStreet' in o) onStreet = o.onStreet; if ('inCourt' in o) inCourt = o.inCourt; } };
}

test('REP1: a guard who sees a known criminal stops them - once a second at most, only when one sees; the box names the region and the fine; the watch waits two hours before the next stop (mutants: the stop without a seeing guard; the look every frame)', () => {
  const blind = watchRig({ sees: false });
  assert.equal(blind.look(), false, 'nobody sees: no stop, however bad the name');
  assert.equal(blind.shown.length, 0);
  blind.watch.frame();
  blind.watch.frame();
  assert.equal(blind.calls.look, 1, 'the street is looked over once a second, not every frame');
  const r = watchRig();
  assert.equal(r.look(), true);
  const box = r.shown[0];
  assert.deepEqual(box.lines, ['Halt! The watch of Daggerfall knows your face.', 'Pay a fine of 600 gold, or come with me.']);   // the rig stands at -20
  assert.deepEqual(box.options.map((o) => o.code), ['KeyP', 'KeyS', 'KeyR']);
  assert.equal(r.watch.frame(), false, 'the same second: no second look');
  box.input('KeyP');
  assert.deepEqual([r.p.goldPieces, r.said.at(-1)], [5000 - 600, 'You pay the watch 600 gold.']);
  r.t.own += 60;
  assert.equal(r.look(), false, 'a paid fine: a day\'s grace');
  r.t.own += CHALLENGE_GRACE_MINUTES;
  assert.equal(r.look(), true, 'the grace run out, the two hours long past: the next stop');
});

test('REP1: come quietly is the arrest flow\'s door; refuse is a Conspiracy held and the watch called; a purse short of the fine is not offered it (mutants: refuse without the crime; the pay offered unaffordable)', () => {
  const q = watchRig();
  q.look();
  q.shown[0].input('KeyS');
  assert.equal(q.calls.surrender, 1);
  const r = watchRig();
  r.look();
  r.shown[0].input('KeyR');
  assert.deepEqual([r.p.crimeCommitted, r.calls.crime], [CRIMES.Criminal_Conspiracy, 1]);
  const poor = watchRig({ gold: 10 });
  poor.look();
  assert.deepEqual(poor.shown[0].options.map((o) => o.code), ['KeyS', 'KeyR']);
  assert.equal(poor.shown[0].lines[1], 'You will come with me.');
  const banished = watchRig({ legal: 0 });
  banish(banished.p, 3, banished.t.world);
  banished.look();
  assert.equal(banished.shown[0].lines[0], 'Halt! You are banished from Daggerfall.');
});

test('REP1: never under another window, off the street, in a trial, on a crime already held, dead, or in a beast\'s form (mutants: each gate dropped)', () => {
  const cases = [
    ['blocked', (r) => r.set({ blocked: true })],
    ['off the street', (r) => r.set({ onStreet: false })],
    ['in court', (r) => r.set({ inCourt: true })],
    ['a crime held', (r) => { r.p.crimeCommitted = CRIMES.Theft; }],
    ['arrested', (r) => { r.p.arrested = true; }],
    ['dead', (r) => { r.p.health = 0; }],
    // DFU's SuppressCrime: a transformed lycanthrope is nobody's face (lycanthropy.js racialSuppressCrime)
    ['a beast', (r) => { r.p.activeEffects = [{ kind: 'racialOverride', racial: 'lycanthropy', isTransformed: true }]; }],
  ];
  for (const [why, arm] of cases) {
    const r = watchRig();
    arm(r);
    assert.equal(r.look(), false, why);
    assert.equal(r.calls.look, 0, `${why}: no guard is even asked`);
  }
});

test('REP1: the guard\'s eye - a GUARD, in range, facing, the line CLEAR; a civilian, a wall, a back turned, a far guard see nothing (mutants: a civilian counted; the wall ignored)', () => {
  let wall = Infinity;
  const g = createCityGuards({
    renderer: { createBillboardBatch: () => ({}), textures: new Map(), destroyBillboardBatch: () => {} },
    collider: { heightAt: () => 0, raycast: () => wall, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
    fetchBytes: async () => { throw new Error('no art'); }, getTexture: async () => null, uploadRecordFrame: () => {},
    currentMinute: () => 0, playerEntity: { health: 50 }, audio: null, onPlayerHurt: () => {}, rand: () => 0.5,
  });
  const facing = (x, z) => Math.atan2(-x, -z);   // a yaw looking back at the origin
  const guard = { pos: [0, 0, 20], fwdYaw: facing(0, 20), guard: true };
  assert.equal(g.guardSeesPlayer({ playerFeet: [0, 0, 0], pool: [{ ...guard, guard: false }] }), null, 'a civilian is not the watch');
  assert.equal(g.guardSeesPlayer({ playerFeet: [0, 0, 0], pool: [guard] }), guard);
  assert.equal(g.guardSeesPlayer({ playerFeet: [0, 0, 0], pool: [{ ...guard, fwdYaw: facing(0, 20) + Math.PI }] }), null, 'his back turned');
  assert.equal(g.guardSeesPlayer({ playerFeet: [0, 0, 0], pool: [{ ...guard, pos: [0, 0, 90], fwdYaw: facing(0, 90) }] }), null, 'past 77.5');
  wall = 5;
  assert.equal(g.guardSeesPlayer({ playerFeet: [0, 0, 0], pool: [guard] }), null, 'a wall between');
});

test('REP1: the hosts - the per-minute levy is gone from both, the stop is built beside the arrest flow and looked for in the exterior frame (mutant: the levy put back)', () => {
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = src(host);
    assert.doesNotMatch(s, /passiveGuardSpawns\(/, `${host}: no passive levy`);
    assert.match(s, /const standingWatch = createStandingWatch\(\{/);
    assert.match(s, /\n\s*standingWatch\.frame\(\);/);
    assert.match(s, /installLegalNotices\(\{ playerEntity, say: /);
  }
  assert.match(hostText('src/scenes/world.js'), /blocked: \(\) => townTalk\.overlayActive \|\| !!modes\?\.overlayHeld \|\| !!travelView\?\.active \|\| !!raidDefendingHere\(\)/,
    'a raid on the town holds the stop');
});
