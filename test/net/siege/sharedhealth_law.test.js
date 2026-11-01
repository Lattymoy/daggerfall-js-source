// SHARED-HEALTH (2026-10-26; bible/06-Systems/Integrity-Arc.md section 5, "Decisions (2026-10-26, SHARED-HEALTH)") -
// ONE HEALTH POOL UNDER THE REFEREE: the referee's law (net/siege/refereeHealthShare.js) and the client's mirror
// (net/siege/refereeHealthMirror.js) driven together over the real referee (net/siege/siegeRef.js), through the races a
// relay and a client meet: a blow before the first report, a foe's blow while a player's is in flight, a heal mid-PvP,
// many round trips over an integer health.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIEGE_HIT, SIEGE_UNITS_PER_M, newFighter, refereeBlow, siegeRise } from '../../../src/net/siege/siegeRef.js';
import { HEALTH_SHARE_WHOLE, PVP_HEAL_BLOCK_MS, PVP_HEAL, PVP_HEALTH_MAX, PVP_RESTORATION_MAX, pvpHealShare, setPoolMax, healRoom, takeHealthReport, poolWord, poolUnheard, resetHealthShare, noteRefereeChange } from '../../../src/net/siege/refereeHealthShare.js';
import { WILD_REF } from '../../../src/net/wild/wildRef.js';
import { validVitIn, VIT_RESTORATION_MAX } from '../../../src/net/wire.js';
import { createRefereeHealthMirror, HEALTH_REPORT_MS } from '../../../src/net/siege/refereeHealthMirror.js';

const fist = { w: -1, m: 0 };
const at = (m) => ({ x: m * SIEGE_UNITS_PER_M, y: 0, z: 0 });

/** A relay's fighter and a client with its mirror, the wire between them in our hands. */
function rig({ health, maxHealth, lv = 1, t0 = 1_000_000 }) {
  const clock = { now: t0 };
  const client = { health, maxHealth };
  const outbox = [];
  const mirror = createRefereeHealthMirror({
    read: () => client,
    write: (h) => { client.health = h; },
    send: (r) => { outbox.push(r); return true; },
    now: () => clock.now,
  });
  const fighter = newFighter(lv, clock.now);
  const striker = newFighter(50, clock.now);
  /** A player's blow the referee lands, and its word - held back as a word in flight, or told at once. */
  const blow = (d) => {
    striker.rate = 10;
    striker.harm = [];
    const res = refereeBlow(striker, fighter, { from: at(0), at: at(2), held: fist, d, r: SIEGE_HIT.Melee }, clock.now);
    return { res, word: poolWord(fighter) };
  };
  const tell = (word) => { if (word) mirror.onWord(word); };
  /** The client's frame, then every report it sent taken by the referee and its count told back. */
  const roundTrip = (active = true, healsBlocked = false) => {
    mirror.frame(active);
    while (outbox.length) {
      const r = outbox.shift();
      if (takeHealthReport(fighter, { report: r.n, share: r.s, seen: r.seen }, clock.now, { healsBlocked })) tell(poolWord(fighter));
    }
  };
  const later = (ms = HEALTH_REPORT_MS) => { clock.now += ms; };
  return { clock, client, mirror, fighter, outbox, blow, tell, roundTrip, later };
}

/** The client's health as the share of the count, in health. */
const expectedHealth = (fighter, maxHealth) => (fighter.hp / fighter.max) * maxHealth;

test('SHARED-HEALTH: the no-heal window after a player\'s blow is the zone\'s old mend window', () => {
  assert.equal(PVP_HEAL_BLOCK_MS, WILD_REF.mendMs);
});

test('SHARED-HEALTH: a fresh pool is told to nobody until a report anchors it - its whole count would heal the client to full (mutant: poolWord ignores heard)', () => {
  const r = rig({ health: 30, maxHealth: 60 });
  assert.ok(poolUnheard(r.fighter));
  const { word } = r.blow(10);
  assert.equal(word, null, 'an unheard pool says nothing');
  assert.equal(r.client.health, 30, 'and the client keeps its own health');
});

test('SHARED-HEALTH: A BLOW BEFORE THE FIRST REPORT still lands - the report anchors the pool at the client\'s share, less what the referee dealt since (mutant: the log unread)', () => {
  const r = rig({ health: 30, maxHealth: 60 });   // half its health
  r.blow(30);   // the pool was whole: 302 - 30
  r.mirror.ask();
  r.roundTrip();
  assert.equal(r.fighter.hp, 151 - 30, 'half of 302, less the blow');
  assert.equal(r.client.health, Math.round(expectedHealth(r.fighter, 60)));
  assert.ok(r.client.health < 30, 'the blow reached the client\'s own health');
});

test('SHARED-HEALTH: A FOE\'S BLOW WHILE A PLAYER\'S IS IN FLIGHT - both land, at the relay and on the client (mutants: the unseen change dropped; the mirror forgetting what its health did since the included report)', () => {
  const r = rig({ health: 60, maxHealth: 60 });
  r.mirror.ask();
  r.roundTrip();
  assert.equal(r.fighter.hp, 302);
  // a player's blow lands at the relay; its word is still on the wire
  const { word } = r.blow(30);
  // the client takes a foe's blow of 6 (a tenth of its health) and reports before it hears the player's
  r.client.health -= 6;
  r.later();
  r.mirror.frame(true);
  const report = r.outbox.shift();
  // the player's word arrives first: the foe's blow, reported but not yet taken, is not undone
  r.tell(word);
  assert.equal(r.client.health, Math.round(60 * (272 / 302) - 6), 'the player\'s blow and the foe\'s together');
  // the report is taken: the referee counts the foe's blow on top of the player's it had dealt
  assert.ok(takeHealthReport(r.fighter, { report: report.n, share: report.s, seen: report.seen }, r.clock.now));
  assert.equal(r.fighter.hp, Math.round(302 * 0.9 - 30), 'a tenth for the foe, 30 for the player');
  r.tell(poolWord(r.fighter));
  assert.ok(Math.abs(r.client.health - expectedHealth(r.fighter, 60)) <= 0.5, 'the client and the count agree');
});

test('PVP-HEAL: A FIGHT\'S HEALS ARE CAPPED - within PVP_HEAL_BLOCK_MS of a player\'s blow every heal together restores at most a quarter of the whole per 15 s, the client pulled back to the count past it; past the fight a heal is taken whole; a relay foe\'s blow opens no fight; a siege refuses every heal by report (mutants: the window unread; the cap unread; the fight opened by a foe; the siege\'s block unread)', () => {
  const r = rig({ health: 60, maxHealth: 60 });
  r.mirror.ask();
  r.roundTrip();
  r.blow(60); r.blow(60); r.blow(60);   // 302 - 180 = 122
  r.tell(poolWord(r.fighter));
  assert.equal(r.fighter.hp, 122);
  r.client.health = 60;   // a potion mid-fight
  r.later();
  r.roundTrip();
  assert.equal(r.fighter.hp, 122 + Math.floor(302 * PVP_HEAL.base), 'a quarter of the whole, no more');
  const capped = r.client.health;
  assert.ok(capped < 60, 'and the client is pulled back to the count');
  r.client.health = 60;   // a second potion in the same 15 s
  r.later();
  r.roundTrip();
  assert.equal(r.fighter.hp, 197, 'the window is spent');
  r.later(PVP_HEAL.windowMs);
  r.client.health = 60;   // the next window, still in the fight
  r.roundTrip();
  assert.equal(r.fighter.hp, 272, 'a new window, a new quarter');
  r.later(PVP_HEAL_BLOCK_MS);
  r.client.health = 60;   // a potion once the fight is over
  r.roundTrip();
  assert.equal(r.fighter.hp, 302, 'taken whole');
  assert.equal(r.client.health, 60);
  // a relay foe's blow (a siege's guard) is no player's: a heal after it is taken whole, past the fight's cap
  r.fighter.hp -= 200;
  noteRefereeChange(r.fighter, -200, r.clock.now);
  r.tell(poolWord(r.fighter));
  r.client.health = 60;
  r.later();
  r.roundTrip();
  assert.equal(r.fighter.hp, 302, 'a guard\'s blow opens no fight');
  // a siege: no heal by report for its whole length, however long since a blow
  r.fighter.hp -= 50;
  noteRefereeChange(r.fighter, -50, r.clock.now);
  r.tell(poolWord(r.fighter));
  r.client.health = 60;
  r.later(10 * PVP_HEAL_BLOCK_MS);
  r.roundTrip(true, true);
  assert.equal(r.fighter.hp, 252, 'a siege heals nobody by report');
});

test('PVP-HEAL: Restoration lifts the window from 25% to 35% - one point a 20 past 100 (mutants: the step unread; the top unread)', () => {
  assert.equal(pvpHealShare(0), 0.25);
  assert.equal(pvpHealShare(100), 0.25);
  assert.equal(pvpHealShare(119), 0.25);
  assert.equal(pvpHealShare(120), 0.26);
  assert.equal(pvpHealShare(300), 0.35);
  assert.equal(pvpHealShare(900), 0.35);
  const f = newFighter(1, 1000);
  f.hp = 100;
  noteRefereeChange(f, -202, 1000, true);
  assert.equal(healRoom(f, 1001), Math.floor(302 * 0.25));
  assert.equal(healRoom(f, 1001, 300), Math.floor(302 * 0.35), 'a healer\'s better Restoration counts');
  assert.equal(healRoom(f, 1000 + PVP_HEAL_BLOCK_MS), Infinity, 'out of the fight, no cap');
});

test('PVP-HEALTH: the wire takes a report\'s maximum and Restoration, within bounds, and the mirror sends both (mutants: the fields dropped; the bound unpinned)', () => {
  assert.equal(VIT_RESTORATION_MAX, PVP_RESTORATION_MAX);
  assert.deepEqual(validVitIn({ n: 1, s: 5000, seen: [], x: 1300, r: 250 }), { report: 1, share: 5000, seen: [], max: 1300, resto: 250 });
  assert.equal(validVitIn({ n: 1, s: 5000, seen: [], x: 0 }), null);
  assert.equal(validVitIn({ n: 1, s: 5000, seen: [], r: VIT_RESTORATION_MAX + 1 }), null);
  const sent = [];
  const client = { health: 650, maxHealth: 1300 };
  const m = createRefereeHealthMirror({ read: () => client, write: () => {}, send: (r) => { sent.push(r); return true; }, now: () => 1e6, restoration: () => 180 });
  m.frame(true);
  assert.deepEqual([sent[0].x, sent[0].r], [1300, 180]);
});

test('PVP-HEALTH: a report\'s real maximum is the pool\'s whole (PVP_HEALTH_MAX at most), the count at the same share; in a fight a rising whole adds no health (mutants: the maximum unread; the bound dropped; the rise healing)', () => {
  const f = newFighter(1, 0);
  assert.ok(takeHealthReport(f, { report: 1, share: HEALTH_SHARE_WHOLE / 2, seen: [], max: 1300, resto: 250 }, 0));
  assert.equal(f.max, 1300);
  assert.equal(f.hp, 650);
  assert.equal(f.share.resto, 250);
  takeHealthReport(f, { report: 2, share: HEALTH_SHARE_WHOLE, seen: [], max: 99_999 }, 0);
  assert.equal(f.max, PVP_HEALTH_MAX);
  noteRefereeChange(f, 0, 10, true);   // a player's blow: the fight is on
  takeHealthReport(f, { report: 3, share: HEALTH_SHARE_WHOLE, seen: [], max: 2 }, 20);
  assert.equal(f.max, 2);
  assert.equal(f.hp, 2);
  takeHealthReport(f, { report: 4, share: HEALTH_SHARE_WHOLE, seen: [], max: 1300 }, 30);
  assert.equal(f.max, 1300);
  assert.equal(f.hp, 2 + Math.floor(1300 * pvpHealShare(250)), 'dropping and lifting the maximum heals no more than the window');
});

test('PVP-HEALTH: setPoolMax holds its own bound, 1..PVP_HEALTH_MAX, whatever its caller capped (mutant: the bound dropped)', () => {
  const f = newFighter(1, 0);
  setPoolMax(f, 99_999, 0);
  assert.equal(f.max, PVP_HEALTH_MAX);
  setPoolMax(f, 0, 0);
  assert.equal(f.max, 1);
});

test('SHARED-HEALTH: a REPORTED LOSS is taken at once and never fells - the client\'s own death is its own word; a fallen fighter takes no report (mutants: the floor dropped; the fall reported into)', () => {
  const r = rig({ health: 60, maxHealth: 60 });
  r.mirror.ask();
  r.roundTrip();
  r.client.health = 0;
  r.later();
  r.roundTrip();
  assert.equal(r.fighter.hp, 1, 'a report of none leaves the count at 1, standing');
  assert.equal(r.fighter.down, false);
  r.fighter.down = true;
  assert.equal(takeHealthReport(r.fighter, { report: 99, share: HEALTH_SHARE_WHOLE, seen: [] }, r.clock.now), false);
});

test('SHARED-HEALTH: A RESET (a rise, a return after long away) waits for a report again and forgets what came before - the report anchors it at the client\'s share (mutant: the reset keeping the log)', () => {
  const r = rig({ health: 60, maxHealth: 60 });
  r.mirror.ask();
  r.roundTrip();
  r.blow(100);   // its word never reached the client before the reset
  r.fighter.hp = r.fighter.max;
  resetHealthShare(r.fighter, r.clock.now);
  assert.ok(poolUnheard(r.fighter));
  r.client.health = 45;   // what the client stands at now
  r.mirror.ask();
  r.later();
  r.roundTrip();
  assert.equal(r.fighter.hp, Math.round(302 * 0.75), 'its own share, the blow before the reset not counted again');
});

test('SHARED-HEALTH: A SIEGE\'S RISE heals the player\'s own health whole - the rise is the referee\'s change, told like a blow', () => {
  const r = rig({ health: 60, maxHealth: 60 });
  r.mirror.ask();
  r.roundTrip();
  r.fighter.hp = 20;
  r.blow(30);
  assert.equal(r.fighter.down, true);
  r.tell(poolWord(r.fighter));
  assert.equal(r.client.health, 1, 'a fall leaves the client at the breath of life - never a death');
  r.fighter.upAt = r.clock.now;
  assert.ok(siegeRise(r.fighter, r.clock.now));
  r.tell(poolWord(r.fighter));
  assert.equal(r.client.health, 60);
});

test('SHARED-HEALTH: A LONG FIGHT over an integer health - a hundred blows and reports never wear the count down past the blows (mutant: the mirror reporting its rounded health)', () => {
  const r = rig({ health: 67, maxHealth: 67, lv: 1 });
  r.mirror.ask();
  r.roundTrip();
  let dealt = 0;
  for (let i = 0; i < 100; i++) {
    const { res, word } = r.blow(i % 3 === 0 ? 2 : 1);
    dealt += res.dealt;
    r.tell(word);
    r.later();
    r.roundTrip();
  }
  assert.equal(r.fighter.hp, 302 - dealt, 'the count is the blows alone');
  assert.ok(Math.abs(r.client.health - expectedHealth(r.fighter, 67)) <= 0.5);
});

test('SHARED-HEALTH: the mirror reports only when its share moved, at most every HEALTH_REPORT_MS, and only while a fight may hold it - an ask is answered regardless (mutants: the throttle dropped; the active gate dropped)', () => {
  const r = rig({ health: 60, maxHealth: 60 });
  r.mirror.frame(false);
  assert.equal(r.outbox.length, 0, 'no fight, no report');
  r.mirror.ask();
  r.mirror.frame(false);
  assert.equal(r.outbox.length, 1, 'an ask is answered');
  r.outbox.length = 0;
  r.client.health = 50;
  r.mirror.frame(true);
  assert.equal(r.outbox.length, 0, 'not inside the throttle');
  r.later();
  r.mirror.frame(true);
  assert.equal(r.outbox.length, 1);
  assert.equal(r.outbox[0].s, Math.round((50 / 60) * HEALTH_SHARE_WHOLE));
  r.outbox.length = 0;
  r.later();
  r.mirror.frame(true);
  assert.equal(r.outbox.length, 0, 'nothing moved, nothing said');
});
