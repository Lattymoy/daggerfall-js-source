// AUDIT PISTOLET (bible/01-Overview/audits/Audit-Pistolet.md): THE PAIR'S LAW AS IT PLAYS - the off hand's shot through
// the impact a shot lands on (combat/arrowFlight.js playerArrowHitFoe) and the duel's roll, each gun hand's own reload
// through every way a pair breaks and forms, and a technique the lead's alone. Ported from the audit's lane A proofs,
// each of which was red on the branch it read.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPistolet } from '../../src/systems/pistolet.js';
import { createThunderlock } from '../../src/systems/thunderlock.js';
import { PlayerWeapon } from '../../src/combat/playerWeapon.js';
import { playerArrowHitFoe } from '../../src/combat/arrowFlight.js';
import { offHandDamage, DUAL, HANDS_MODE } from '../../src/combat/twoHands/handsLaw.js';
import { resolveDuelStrike, duelStandIn } from '../../src/combat/duelCombat.js';
import { PISTOLET_SPAN } from '../../src/characters/thunderlockIds.js';

function pairWeapon(right, left) {
  const pw = new PlayerWeapon();
  pw.currentRightHandWeapon = right; pw.currentLeftHandWeapon = left; pw.usingRightHand = true;
  pw.applyWeapon();
  return pw;
}
const runFor = (pw, s, each = null) => { for (let t = 0; t < s; t += 1 / 60) { each?.(); pw.update(1 / 60); } };
const runUntilIdle = (pw) => { let n = 0; while (pw.machine.state !== 'Idle' && n++ < 600) pw.update(1 / 60); };

// a foe that cannot dodge and a level-1 shooter - the audit39 shot fixtures (test/scenes/audit39_worldmodes.test.js)
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
const shotFoe = () => ({
  entity: {
    minMetalToHit: -1, armorValues: [0, 0, 0, 0, 0, 0, 0], items: [],
    basics: { bloodIndex: 2 }, isClass: false, careerIndex: 0, skills: 0,
    maxHealth: 300, health: 300, stats: { strength: 50, agility: 50, luck: 50 },
  },
  ai: { feet: [0, 0, 0], yaw: 0 },
});
const SHOOTER = () => ({ isPlayer: true, level: 1, skills: 30, skillUses: [], stats: { strength: 50, agility: 50, luck: 50 } });
const STRUCK = () => seq(0, 0.99, 0.05, 0.999, 0.99);   // struck, no crit, hit, the span's top, no backstab
const landed = (weapon, playerWeapon, rolls = STRUCK()) => playerArrowHitFoe(
  { weapon, fromPlayer: true, summoned: false, pos: [0, 1, 0], dir: [0, 0, 1] }, shotFoe(),
  { playerEntity: SHOOTER(), playerWeapon, playerFeet: [0, 0, 5], dealDamage: () => {}, say: () => {}, rolls });

test('A1: a pair\'s OFF-hand shot lands DUAL\'s share, read at impact off the gun it left; the lead\'s and a lone gun\'s land whole (mutants: the shot whole; the duel melee alone; the lead read as the off)', () => {
  const R = createPistolet(), L = createPistolet();
  const pw = pairWeapon(R, L);
  assert.equal(pw.handsMode, HANDS_MODE.Dual);
  assert.equal(pw.isOffHandItem(L), true, 'the left of a right-led pair is the off hand\'s');
  assert.equal(pw.isOffHandItem(R), false, 'the lead\'s is not');
  assert.equal(pairWeapon(R, null).isOffHandItem(R), false, 'a lone gun has no off hand');
  assert.equal(pw.isOffHandItem(null), false);
  // the strike is long over when the shot lands - the machine idle, offStrike false - and the gun still says whose it was
  runUntilIdle(pw);
  assert.equal(pw.offStrike, false);
  const lead = landed(R, pw), off = landed(L, pw), lone = landed(createPistolet(), pairWeapon(createPistolet(), null));
  assert.ok(lead > 0 && lead === lone, `the lead's shot lands whole (${lead}, a lone gun's ${lone})`);
  assert.equal(off, offHandDamage(lead), `the off hand's lands DUAL.OFF_DAMAGE of it (${off})`);
  // a left-led pair: the right is the off hand's
  const lpw = pairWeapon(R, L); lpw.usingRightHand = false; lpw.applyWeapon();
  assert.equal(lpw.isOffHandItem(R), true);
  assert.equal(lpw.isOffHandItem(L), false);
});

test('A1b: and between players - the duel\'s roll takes `off` for a shot as for a swing', () => {
  const a = { lv: 1, r: 0, st: [50, 50, 50, 50, 50, 50, 50, 50], sk: [30, 0, 0, 0], cf: [0, 0, 0], h: [100, 100] };
  const roll = (by, off) => resolveDuelStrike({ by, a, w: { t: 562, m: 4, c: 100 }, sw: 'StrikeDown', ...(off ? { off: true } : {}) }, duelStandIn(), { rolls: STRUCK() }).dmg;
  assert.ok(roll('arrow', false) > 0);
  assert.equal(roll('arrow', true), offHandDamage(roll('arrow', false)), 'an off-hand shot at a player is the off hand\'s');
});

test('A3: breaking a pair for a frame (a light lit) keeps each hand\'s reload - the late hand waits out its own (mutants: the reset on a break; the lone gun ungated)', () => {
  const pw = pairWeapon(createPistolet(), createPistolet());
  assert.ok(pw._attack('StrikeDown')); assert.equal(pw.strike.hand, 'R');
  runUntilIdle(pw);
  runFor(pw, 1.0);
  assert.ok(pw._attack('StrikeDown')); assert.equal(pw.strike.hand, 'L');
  runUntilIdle(pw);
  const leftLoaded = pw.handReloadUntil('L');
  pw.leftBusy = true; pw.applyWeapon(); pw.update(1 / 60);
  pw.leftBusy = false; pw.applyWeapon();
  assert.ok(pw.gunPair, 'the pair is back');
  while (pw.machine.now < pw.handReloadUntil('R') || !pw._attack('StrikeDown')) pw.update(1 / 60);
  assert.equal(pw.strike.hand, 'R');
  runUntilIdle(pw);
  const t = pw.machine.now, fired = pw._attack('StrikeDown');
  assert.ok(!(fired && pw.strike.hand === 'L' && t < leftLoaded - 1e-9), `the left fired ${(leftLoaded - t).toFixed(2)}s before its reload ended`);
});

test('A3b: one pistol of a pair unequipped mid-reload - the one left keeps ITS reload, not the other\'s', () => {
  const R = createPistolet(), L = createPistolet();
  const pw = pairWeapon(R, L);
  assert.ok(pw._attack('StrikeDown')); runUntilIdle(pw);
  runFor(pw, 1.0);
  assert.ok(pw._attack('StrikeDown')); assert.equal(pw.strike.hand, 'L'); runUntilIdle(pw);
  const leftLoaded = pw.handReloadUntil('L');
  pw.updateHands(null, L); pw.applyWeapon();
  assert.equal(pw.toggleHand({ bowSwitching: false }), 'Using weapon in left hand.');
  assert.equal(pw.gunPair, false);
  pw.update(1 / 60);
  assert.ok(pw.machine.now < leftLoaded, 'still inside the left\'s reload');
  assert.equal(pw._attack('StrikeDown'), false, 'the lone left waits for its own reload');
  while (pw.machine.now < leftLoaded) pw.update(1 / 60);
  pw.update(1 / 60);
  assert.ok(pw._attack('StrikeDown'), 'and fires once it is loaded');
});

test('A3c: a second pistol drawn beside one reloading is loaded, and fires', () => {
  const R = createPistolet(), L = createPistolet();
  const pw = pairWeapon(R, null);
  assert.ok(pw._attack('StrikeDown')); runUntilIdle(pw);
  pw.updateHands(R, L); pw.applyWeapon();
  assert.ok(pw.gunPair);
  pw.update(1 / 60);
  assert.ok(pw.handLoaded('L') && !pw.handLoaded('R'));
  assert.ok(pw._attack('StrikeDown') && pw.strike.hand === 'L', 'the loaded pistol fires');
});

test('A6: a technique is the LEAD hand\'s - with the lead reloading it waits, never thrown by the off hand (mutants: the fallback for a technique)', () => {
  const pw = pairWeapon(createPistolet(), createPistolet());
  assert.ok(pw._attack('StrikeDown')); assert.equal(pw.strike.hand, 'R');
  runUntilIdle(pw);
  assert.equal(pw.techniqueStrike('StrikeDown'), false, 'the lead reloading: no technique');
  assert.ok(pw._attack('StrikeDown') && pw.strike.hand === 'L', 'a plain pull still falls to the loaded off hand');
});

test('A4: THE RECORD\'S BALANCE, MEASURED IN THE GAME - shots a minute through the machine, damage through the impact a shot lands on: a pair under x1.25 the Thunderlock (bible/05-Combat/Dwarven-Pistolet.md "The balance")', () => {
  // AUDIT PISTOL-PORT A7: through the game's own doors - the trigger pulled every frame (each gun's machine decides what
  // fires: a pair's second pistol leaves mid-shot) and the HITS the hosts are handed counted, never the pulls
  const count = (pw, seconds) => { let n = 0; for (let t = 0; t < seconds; t += 1 / 60) { pw._attack('StrikeDown'); n += pw.update(1 / 60).filter((e) => e === 'hit').length; } return n; };
  const pairShots = count(pairWeapon(createPistolet(), createPistolet()), 60);
  const oneShots = count(pairWeapon(createPistolet(), null), 60);
  const rifleShots = count(pairWeapon(createThunderlock(), null), 60);
  assert.equal(oneShots, 32); assert.equal(pairShots, 64); assert.equal(rifleShots, 28);
  // the share an off-hand shot lands, measured through playerArrowHitFoe on the span's top
  const R = createPistolet(), L = createPistolet(), pw = pairWeapon(R, L);
  const share = landed(L, pw) / landed(R, pw);
  assert.ok(Math.abs(share - DUAL.OFF_DAMAGE) < 0.1, `the off hand's share ${share.toFixed(2)}`);
  const mean = (PISTOLET_SPAN.min + PISTOLET_SPAN.max) / 2;
  const pairDps = (pairShots / 2) * mean * (1 + share) / 60, oneDps = oneShots * mean / 60, rifleDps = rifleShots * 16.5 / 60;
  assert.ok(pairDps < rifleDps * 1.25 && pairDps > rifleDps, `a pair ${pairDps.toFixed(1)}/s against the Thunderlock's ${rifleDps.toFixed(1)}/s`);
  assert.ok(oneDps < rifleDps, `one Pistolet ${oneDps.toFixed(1)}/s`);
});
