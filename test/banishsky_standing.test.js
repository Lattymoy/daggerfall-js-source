// BANISH-SKY (2026-10-07, bible/06-Systems/Online-Waits.md WAIT4; Mac: "Take care of this", over the sweep of the waits
// still long online): A BANISHMENT'S THIRTY DAYS ARE THE CALENDAR'S THE PLAYER SEES. REP3 counted them on the world's
// event clock - sixty real hours - when the event clock was the calendar every menu showed; TIME1 then gave the menus the
// sky's calendar, a day every real hour since SKY-SLOW, and a player told "banished for 28 more days" watched twenty-eight
// days pass on it and was banished as long again. Online the term is thirty sky days, stamped (as every term) in the event
// clock's minutes, its days said in the sky's and its length in real time; offline DFU's one clock, REP3's term whole.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  banish, isBanished, banishmentLeft, banishmentDaysLeft, banishmentTermMinutes, BANISHMENT_MINUTES, PARDON_BASE_PRICE,
  setBanishmentCalendar,
} from '../src/systems/standing.js';
import { createRegionConditions } from '../src/systems/regionConditions.js';
import { setSharedClock, skyPerWorldMinute, worldSpanRealWords } from '../src/systems/worldTick.js';
import { sharedClassicMinutes, wallMsForClassicMinutes } from '../src/net/wire.js';
import { skyClassicMinutes, wallMsForSkyMinutes } from '../src/net/skyLaw.js';
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

test('BANISH-SKY: offline the term is REP3\'s thirty days of the one clock - nothing installed, the rate is one', () => {
  assert.equal(skyPerWorldMinute(), 1);
  assert.equal(banishmentTermMinutes(), BANISHMENT_MINUTES);
  assert.equal(BANISHMENT_MINUTES, 30 * 1440);
  const p = citizen();
  banish(p, 4, 1000);
  assert.equal(p.regionConditions[4].banishedUntil, 1000 + 30 * 1440);
  assert.equal(banishmentDaysLeft(p, 4, 1000), 30);
  assert.equal(worldSpanRealWords(30 * 1440), null, 'offline the days are DFU\'s own words');
  // a rate that is no rate (a sky not yet readable) is the one clock, never an endless or a negative term
  for (const bad of [0, -2, NaN, Infinity]) {
    setBanishmentCalendar(() => bad);
    assert.equal(banishmentTermMinutes(), BANISHMENT_MINUTES, `a rate of ${bad}`);
  }
  setBanishmentCalendar(null);
});

test('BANISH-SKY: online the term is thirty days of the sky - two sky minutes a world minute since SKY-SLOW, so fifteen days of the event clock, thirty real hours; stamped on the event clock, and lifted as the thirtieth day of the calendar passes', () => {
  const { at, world } = online();
  assert.equal(skyPerWorldMinute(), 2, 'a sky day is half an event day');
  assert.equal(banishmentTermMinutes(), 15 * 1440);
  const p = citizen();
  banish(p, 4, world());
  const stamped = p.regionConditions[4].banishedUntil;
  assert.equal(stamped, world() + 15 * 1440, 'the stamp is the event clock\'s minute - TIME\'s rule, no stamp on the sky');
  assert.equal(banishmentDaysLeft(p, 4, world()), 30, 'and the priest says thirty days');
  assert.equal(worldSpanRealWords(banishmentLeft(p, 4, world())), 'about 30 hours');
  const sky0 = skyClassicMinutes(at.t);
  at.t += 29 * HOUR;
  assert.ok(Math.abs(skyClassicMinutes(at.t) - sky0 - 29 * 1440) < 1e-6, 'twenty-nine days on the calendar the player sees');
  assert.equal(isBanished(p, 4, world()), true);
  assert.equal(banishmentDaysLeft(p, 4, world()), 1, 'one day left - as the calendar says');
  at.t += HOUR;
  assert.equal(isBanished(p, 4, world()), false, 'the thirtieth day passed on the calendar, and the banishment with it');
});

test('BANISH-SKY: the term not known yet (AUDIT REP F2: the relay unheard - no stamp) takes the same thirty sky days at its first trusted read', () => {
  const { world } = online();
  const p = citizen();
  banish(p, 4, NaN);
  assert.equal(p.regionConditions[4].banishedUntil, null);
  assert.ok(Number.isNaN(banishmentDaysLeft(p, 4, NaN)), 'not known: no days said');
  assert.equal(isBanished(p, 4, world()), true);
  assert.equal(p.regionConditions[4].banishedUntil, world() + 15 * 1440);
  setSharedClock(null);
  const q = citizen();
  banish(q, 4, 500);
  assert.equal(q.regionConditions[4].banishedUntil, 500 + 30 * 1440, 'the clock gone, the one clock\'s thirty days again');
});

test('BANISH-SKY: the temple says the calendar\'s days and, online, what they are in real time; the Standing page the same', () => {
  const { world } = online();
  const p = citizen();
  banish(p, 4, world());
  const rowsOf = (win) => win.boxes[0].rows.map((r) => r.text);
  const on = buildDonationFlow(p, null, 29, { rows: () => [], onClose: () => {}, regionIndex: 4, regionName: 'Wayrest', ownNow: () => 0, worldNow: world, worldWords: worldSpanRealWords });
  assert.deepEqual(rowsOf(on), ['You are banished from Wayrest for 30 more days.', '(about 30 hours)', `For ${PARDON_BASE_PRICE} gold the temple will plead for your pardon. Will you pay?`]);
  const [row] = lawRows(p, world());
  const note = row.note;
  assert.equal(note, `banished, 30 days left, about 30 hours (a pardon: ${PARDON_BASE_PRICE} gold)`);
  setSharedClock(null);
  const q = citizen();
  banish(q, 4, 1000);
  const off = buildDonationFlow(q, null, 29, { rows: () => [], onClose: () => {}, regionIndex: 4, regionName: 'Wayrest', ownNow: () => 0, worldNow: () => 1000, worldWords: worldSpanRealWords });
  assert.deepEqual(rowsOf(off), ['You are banished from Wayrest for 30 more days.', `For ${PARDON_BASE_PRICE} gold the temple will plead for your pardon. Will you pay?`], 'offline: no real time');
  assert.equal(lawRows(q, 1000)[0].note, `banished, 30 days left (a pardon: ${PARDON_BASE_PRICE} gold)`);
});

test('BANISH-SKY: the real-time words - minutes under two hours, hours from there, never rounded down; nothing for nothing', () => {
  online();
  assert.equal(worldSpanRealWords(12), 'about 1 minute');
  assert.equal(worldSpanRealWords(12 * 119), 'about 119 minutes');
  assert.equal(worldSpanRealWords(12 * 120), 'about 2 hours');
  assert.equal(worldSpanRealWords(12 * 121), 'about 3 hours');
  assert.equal(worldSpanRealWords(0), null);
  assert.equal(worldSpanRealWords(NaN), null);
});
