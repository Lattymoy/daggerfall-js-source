// BANISH-SKY (2026-10-07, bible/06-Systems/Online-Waits.md WAIT4; Mac: "Take care of this", over the sweep of the waits
// still long online): A BANISHMENT'S THIRTY DAYS ARE THE CALENDAR'S THE PLAYER SEES. REP3 counted them on the world's
// event clock - sixty real hours - when the event clock was the calendar every menu showed; TIME1 then gave the menus the
// sky's calendar, a day every real hour since SKY-SLOW, and a player told "banished for 28 more days" watched twenty-eight
// days pass on it and was banished as long again. Online the term is thirty sky days, stamped (as every term) in the event
// clock's minutes and measured with the sky's own law (AUDIT WAITS B4: exact across a change of the sky's rate), its days
// said in the sky's and its length in real time; the doors between the lanes carry the days the player was told (AUDIT
// WAITS B1); offline DFU's one clock, REP3's term whole.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  banish, isBanished, banishmentLeft, banishmentDaysLeft, banishmentEnd, BANISHMENT_MINUTES, PARDON_BASE_PRICE,
} from '../src/systems/standing.js';
import { createRegionConditions, snapshotRegionConditions } from '../src/systems/regionConditions.js';
import { setSharedClock, worldSpanRealWords } from '../src/systems/worldTick.js';
import { sharedClassicMinutes, wallMsForClassicMinutes } from '../src/net/wire.js';
import { skyClassicMinutes, wallMsForSkyMinutes, SKY_SEGMENTS } from '../src/net/skyLaw.js';
import { offlineCopyOf, onlineCopyOf } from '../src/systems/offlineCopy.js';
import { buildDonationFlow } from '../src/ui/guildServiceWindows.js';
import { lawRows } from '../src/ui/enhancedMenu.js';

afterEach(() => { setSharedClock(null); });

const HOUR = 3_600_000;
const citizen = () => ({ legalRep: { 4: -20 }, goldPieces: 1e6, items: [], regionConditions: createRegionConditions() });
/** The online world's clocks at a mutable instant: the event clock and the real sky (TimeScale 24 since 2026-10-03). */
const online = (t0 = Date.UTC(2026, 9, 7, 12, 0, 0)) => {
  const at = { t: t0 };
  setSharedClock(() => sharedClassicMinutes(at.t), (m) => wallMsForClassicMinutes(m), { sky: () => skyClassicMinutes(at.t), skyWall: (m) => wallMsForSkyMinutes(m) });
  return { at, world: () => sharedClassicMinutes(at.t) };
};
const temple = (p, world) => buildDonationFlow(p, null, 29, { rows: () => [], onClose: () => {}, regionIndex: 4, regionName: 'Wayrest', ownNow: () => 0, worldNow: world, worldWords: worldSpanRealWords });
const rowsOf = (win) => win.boxes[0].rows.map((r) => r.text);

test('BANISH-SKY: offline the term is REP3\'s thirty days of the one clock; a shared clock with no sky installed is one clock too', () => {
  assert.equal(BANISHMENT_MINUTES, 30 * 1440);
  assert.equal(banishmentEnd(1000), 1000 + 30 * 1440);
  const p = citizen();
  banish(p, 4, 1000);
  assert.equal(p.regionConditions[4].banishedUntil, 1000 + 30 * 1440);
  assert.equal(banishmentDaysLeft(p, 4, 1000), 30);
  assert.equal(worldSpanRealWords(30 * 1440), null, 'offline the days are DFU\'s own words');
  const late = Math.floor(sharedClassicMinutes(Date.UTC(2026, 9, 7, 12, 0, 0)));   // a minute the sky's law reads otherwise
  assert.equal(banishmentEnd(late), late + 30 * 1440, 'whatever minute the one clock reads - no sky\'s law read offline');
  setSharedClock(() => 5000);   // AUDIT REP F2's bare source: no sky beside it
  assert.equal(banishmentEnd(5000), 5000 + 30 * 1440);
});

test('BANISH-SKY: online the term is thirty days of the sky - fifteen days of the event clock, thirty real hours; stamped on the event clock, and lifted as the thirtieth day of the calendar passes', () => {
  const { at, world } = online();
  const p = citizen();
  banish(p, 4, world());
  const stamped = p.regionConditions[4].banishedUntil;
  assert.ok(Math.abs(stamped - (world() + 15 * 1440)) < 1e-6, 'the stamp is the event clock\'s minute - TIME\'s rule, no stamp on the sky');
  assert.equal(banishmentDaysLeft(p, 4, world()), 30, 'and the priest says thirty days, not thirty-one for the float');
  assert.equal(worldSpanRealWords(banishmentLeft(p, 4, world())), 'about 30 real hours');
  const sky0 = skyClassicMinutes(at.t);
  at.t += 29 * HOUR;
  assert.ok(Math.abs(skyClassicMinutes(at.t) - sky0 - 29 * 1440) < 1e-6, 'twenty-nine days on the calendar the player sees');
  assert.equal(isBanished(p, 4, world()), true);
  assert.equal(banishmentDaysLeft(p, 4, world()), 1, 'one day left - as the calendar says');
  at.t += HOUR + 1000;
  assert.equal(isBanished(p, 4, world()), false, 'the thirtieth day passed on the calendar, and the banishment with it');
  assert.equal(banishmentDaysLeft(p, 4, world()), 0, 'and none left');
});

test('BANISH-SKY (AUDIT WAITS B4): the term is measured across the sky\'s own law, not its rate at the stamp - a banishment begun an hour before the sky took its TimeScale 24 ends when the sky reads thirty days on, though the first hour ran at the old rate', () => {
  const sw = SKY_SEGMENTS[0].fromMs;
  const { at, world } = online(sw - HOUR);
  const p = citizen();
  banish(p, 4, world());
  const sky0 = skyClassicMinutes(at.t);
  assert.equal(banishmentDaysLeft(p, 4, world()), 30);
  const lift = wallMsForSkyMinutes(sky0 + 30 * 1440);
  assert.ok(lift - at.t > 30 * HOUR && lift - at.t < 31 * HOUR, 'thirty calendar days: the first hour of them at the old rate (a twelfth of a day an hour, not a twenty-fourth)');
  at.t = lift - 1000;
  assert.equal(isBanished(p, 4, world()), true, 'a second before the calendar\'s thirtieth day ends');
  at.t = lift + 1000;
  assert.equal(isBanished(p, 4, world()), false, 'and lifted with it');
});

test('BANISH-SKY: the days are rounded up and the real time never down - the last hour of a banishment is still a day and its last millisecond too, a minute and a fraction is two minutes (AUDIT WAITS B2)', () => {
  const { at, world } = online();
  const p = citizen();
  banish(p, 4, world());
  at.t += 29 * HOUR + 30 * 60_000;
  assert.equal(banishmentDaysLeft(p, 4, world()), 1, 'half an hour (half a calendar day) left: one more day, not none');
  assert.equal(worldSpanRealWords(banishmentLeft(p, 4, world())), 'about 30 real minutes');
  at.t = wallMsForClassicMinutes(p.regionConditions[4].banishedUntil) - 1;
  assert.equal(isBanished(p, 4, world()), true);
  assert.equal(banishmentDaysLeft(p, 4, world()), 1, 'its last millisecond is still a day - never "banished for 0 more days"');
  // the two laws' round trip lands a hair over thirty days at some instants (this one): still thirty, never thirty-one
  const { world: later } = online(Date.UTC(2026, 9, 7, 19, 10, 44));
  const q = citizen();
  banish(q, 4, later());
  assert.equal(banishmentDaysLeft(q, 4, later()), 30);
  assert.equal(worldSpanRealWords(12), 'about 1 real minute');
  assert.equal(worldSpanRealWords(13), 'about 2 real minutes', 'a minute and a fraction');
  assert.equal(worldSpanRealWords(12 * 119), 'about 119 real minutes');
  assert.equal(worldSpanRealWords(12 * 120), 'about 2 real hours');
  assert.equal(worldSpanRealWords(12 * 121), 'about 3 real hours');
  assert.equal(worldSpanRealWords(0), null);
  assert.equal(worldSpanRealWords(NaN), null);
});

test('BANISH-SKY: a term not known at the arrest (AUDIT REP F2: the relay unheard - no stamp) takes the same thirty sky days at its first trusted read', () => {
  const { world } = online();
  const p = citizen();
  banish(p, 4, NaN);
  assert.equal(p.regionConditions[4].banishedUntil, null);
  assert.ok(Number.isNaN(banishmentDaysLeft(p, 4, NaN)), 'not known: no days said');
  assert.equal(isBanished(p, 4, world()), true);
  assert.ok(Math.abs(p.regionConditions[4].banishedUntil - (world() + 15 * 1440)) < 1e-6);
  setSharedClock(null);
  const q = citizen();
  banish(q, 4, 500);
  assert.equal(q.regionConditions[4].banishedUntil, 500 + 30 * 1440, 'the clock gone, the one clock\'s thirty days again');
});

test('BANISH-SKY: the temple says the calendar\'s days and, online, what they are in real time; the Standing page the same; offline neither says real time', () => {
  const { world } = online();
  const p = citizen();
  banish(p, 4, world());
  assert.deepEqual(rowsOf(temple(p, world)), ['You are banished from Wayrest for 30 more days.', '(about 30 real hours)', `For ${PARDON_BASE_PRICE} gold the temple will plead for your pardon. Will you pay?`]);
  assert.equal(lawRows(p, world())[0].note, `banished, 30 days left, about 30 real hours (a pardon: ${PARDON_BASE_PRICE} gold)`);
  setSharedClock(null);
  const q = citizen();
  banish(q, 4, 1000);
  assert.deepEqual(rowsOf(temple(q, () => 1000)), ['You are banished from Wayrest for 30 more days.', `For ${PARDON_BASE_PRICE} gold the temple will plead for your pardon. Will you pay?`], 'offline: no real time');
  assert.equal(lawRows(q, 1000)[0].note, `banished, 30 days left (a pardon: ${PARDON_BASE_PRICE} gold)`);
  // AUDIT WAITS B3: and the host hands the temple its words - the one wire from the clock to the priest
  const wm = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
  assert.ok(wm.includes("worldNow: () => trustedWorldMinutes(),   // AUDIT REP F2: the pardon's term on the relay's calendar\n        worldWords: worldSpanRealWords,"),
    'the temple\'s flow takes worldSpanRealWords from the host');
});

test('BANISH-SKY (AUDIT WAITS B1): the doors between the lanes carry the days the player was told - an online banishment goes offline with its sky days left as days of the one clock, an offline one comes online with its days left as the sky\'s; an unstamped term stays unstamped', () => {
  const t = Date.UTC(2026, 9, 7, 12, 0, 0);
  const W = Math.floor(sharedClassicMinutes(t));
  const p = citizen();
  online(t);
  banish(p, 4, W);
  setSharedClock(null);
  const own = W - 200 * 1440;   // a character two hundred days behind the world
  const onlineSave = { classicMinutes: own, worldMinutes: W, regionConditions: snapshotRegionConditions(p.regionConditions) };
  const off = offlineCopyOf(onlineSave);
  assert.ok(Math.abs(off.regionConditions[4].b - (own + 30 * 1440)) < 1e-6, 'thirty days of the one clock offline - it read 215 before the door moved it');
  // and the other way: twenty days left offline come online as twenty of the sky's
  const offlineSave = { classicMinutes: 1_000_000, regionConditions: [...snapshotRegionConditions(createRegionConditions())] };
  offlineSave.regionConditions[4] = { ...offlineSave.regionConditions[4], s: 1, b: 1_000_000 + 20 * 1440 };
  const on = onlineCopyOf(offlineSave, W);
  const back = skyClassicMinutes(wallMsForClassicMinutes(on.regionConditions[4].b)) - skyClassicMinutes(wallMsForClassicMinutes(W));
  assert.ok(Math.abs(back - 20 * 1440) < 1e-6, 'twenty sky days on from the world\'s minute - it was lifted at the first read before');
  // an unstamped term (AUDIT REP F2) crosses unstamped
  const bare = { classicMinutes: own, worldMinutes: W, regionConditions: [{ v: [], f: '', g: '', p: 0, s: 1, t: 0 }] };
  assert.equal('b' in offlineCopyOf(bare).regionConditions[0], false);
});
