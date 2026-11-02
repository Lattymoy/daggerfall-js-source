// CROWN1 part one (2026-10-01, Mac: "Finish the seats"; "Continue"; "Hurry up"): THE CROWN TIER'S LAW - kingdom reach,
// the Marches' share, the Free Lands' Watch, and the Conscription Edict (bible/11-Multiplayer/Seats-Arc.md 4.3, 4.4,
// 7.6). Pure: src/net/townSeatLaw.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  KINGDOM_REACH, MARCH_REACH, FREE_LAND_WATCH_BONUS, crownsHeld, seatReach, withReach, guildSeatInfluence, accountSeatInfluence,
  CONSCRIPTION, conscriptionDue, EDICTS, edictForTier, edictOk, standingWeek, STANDING_CHANGES, chronicleLine, edictLine, turningPlan,
  WATCH_INFLUENCE, ACCOUNT_SEAT_WEEK_CAP,
} from '../../src/net/townSeatLaw.js';

const palace = (region) => ({ tier: 'palace', region });

test('CROWN1 REACH (4.3): a crown\'s holder a quarter more at its kingdom\'s palace seats, a March\'s claiming crown an eighth (both crowns a quarter), never at a crown seat, a Free Land or another kingdom; the crowns read off the Charters (mutants: the kingdom; the march share; the both; the tier; the free land)', () => {
  assert.deepEqual([KINGDOM_REACH, MARCH_REACH, FREE_LAND_WATCH_BONUS], [0.25, 0.125, 0.1], 'Appendix: 25% / 12.5% / 10%');
  const df = crownsHeld([{ tier: 'crown', region: 17 }, { tier: 'palace', region: 21 }]);
  assert.deepEqual([...df], ['daggerfall'], 'a palace Charter is no crown');
  assert.equal(crownsHeld([{ tier: 'palace', region: 17 }]).size, 0, 'a palace in a crown\'s own region is no crown');
  assert.deepEqual([...crownsHeld([{ tier: 'crown', region: 23 }, { tier: 'crown', region: 17 }])].sort(), ['daggerfall', 'wayrest']);
  assert.equal(crownsHeld(null).size, 0);
  assert.equal(seatReach(palace(59), df), KINGDOM_REACH, 'Glenumbra Moors: Daggerfall\'s');
  assert.equal(seatReach(palace(34), df), 0, 'Alcaire: Wayrest\'s, not Daggerfall\'s');
  assert.equal(seatReach({ tier: 'crown', region: 17 }, df), 0, 'a crown seat is no kingdom\'s palace');
  assert.equal(seatReach(palace(21), df), MARCH_REACH, 'Anticlere: one claiming crown');
  assert.equal(seatReach(palace(21), new Set(['daggerfall', 'wayrest'])), 2 * MARCH_REACH, 'both claiming crowns: a quarter');
  assert.equal(seatReach(palace(22), df), 0, 'Lainlyn: Wayrest and Sentinel\'s, not Daggerfall\'s');
  assert.equal(seatReach(palace(26), new Set(['daggerfall', 'wayrest', 'sentinel'])), 0, 'Orsinium: no crown\'s');
  assert.equal(seatReach(palace(59), new Set()), 0, 'no crown, no reach');
  assert.equal(seatReach(null, df), 0);
});

test('CROWN1 THE WORKED EXAMPLE (4.4): 7,425 from the sources and 40 of Tribute at a March held by one claiming crown - 8,393, the reach on all but Tribute, rounded down; no reach changes nothing (mutants: the tribute raised; the rounding; the reach dropped)', () => {
  const st = { total: 7465, others: 7425, tribute: 40 };
  assert.deepEqual(withReach(st, MARCH_REACH), { total: 8393, others: 7425, tribute: 40, reach: MARCH_REACH });
  assert.deepEqual(withReach(st, 0), { ...st, reach: 0 });
  assert.equal(withReach({ total: 1003, others: 1003, tribute: 0 }, KINGDOM_REACH).total, 1253, '1,003 x 1.25 = 1,253.75, rounded down');
  // the Tribute's room is reckoned before reach (a fifth of the week, 250 on 1,000), and reach never raises it
  const full = guildSeatInfluence([1000], 100000);
  assert.deepEqual(full, { total: 1250, others: 1000, tribute: 250 });
  assert.deepEqual(withReach(full, KINGDOM_REACH), { total: 1500, others: 1000, tribute: 250, reach: KINGDOM_REACH });
});

test('CROWN1 THE FREE LANDS\' WATCH (4.3): every account\'s Watch there a tenth more, rounded down, before the account\'s cap; nothing else raised (mutants: the bonus; the source; the cap order)', () => {
  assert.equal(accountSeatInfluence({ watch: 300 }, FREE_LAND_WATCH_BONUS), Math.floor(300 * WATCH_INFLUENCE * 1.1));
  assert.equal(accountSeatInfluence({ watch: 7 }, FREE_LAND_WATCH_BONUS), Math.floor(7 * WATCH_INFLUENCE * 1.1 + 1e-9));
  assert.equal(accountSeatInfluence({ watch: 300 }), 300 * WATCH_INFLUENCE, 'elsewhere, none');
  assert.equal(accountSeatInfluence({ homeDays: 7 }, FREE_LAND_WATCH_BONUS), accountSeatInfluence({ homeDays: 7 }), 'the homes not raised');
  assert.equal(accountSeatInfluence({ watch: 100000 }, FREE_LAND_WATCH_BONUS), ACCOUNT_SEAT_WEEK_CAP, 'the account\'s cap still holds');
  assert.equal(accountSeatInfluence({ watch: 10 }, -1), 10 * WATCH_INFLUENCE, 'never less');
});

test('CROWN1 CONSCRIPTION IS A CROWN\'S (7.6): an Edict of its own, proclaimed at a crown seat alone, costing nothing, its words in the Seat tab (mutants: the tier gate; the crown flag)', () => {
  assert.deepEqual(Object.keys(EDICTS), ['market-day', 'open-gates', 'curfew', 'festival', 'levy', 'bounty', 'conscription', 'royal-tourney']);   // part two: and the Royal Tourney
  assert.equal(EDICTS.conscription.crown, true);
  assert.ok(edictOk('conscription'));
  assert.equal(edictForTier('conscription', 'crown'), true);
  assert.equal(edictForTier('conscription', 'palace'), false);
  assert.equal(edictForTier('festival', 'palace'), true, 'any tier\'s at a palace');
  assert.equal(edictForTier('festival', 'crown'), true);
  assert.equal(edictForTier('feast', 'crown'), false);
  assert.match(edictLine('conscription', 'crown'), /^Conscription: .*2%.*1%.*Standing -5/);
});

test('CROWN1 WHAT A CROWN CONSCRIPTS (7.6): every other guild\'s palace seats in the kingdom 2%, a claiming March 1%, its week of Tithe shared over its Charters; never the crown\'s own, a Free Land\'s, another kingdom\'s or a crown seat (mutants: the rates; the share; the march; the free land; the crown\'s own)', () => {
  assert.deepEqual({ ...CONSCRIPTION }, { kingdom: 0.02, march: 0.01, standing: -5 });
  const holds = [
    { key: 17, guild: 'crown', tier: 'crown', region: 17 },
    { key: 59, guild: 'crown', tier: 'palace', region: 59 },     // the crown's own palace: never
    { key: 58, guild: 'a', tier: 'palace', region: 58 },         // Tulune: Daggerfall's
    { key: 21, guild: 'a', tier: 'palace', region: 21 },         // Anticlere: a March Daggerfall claims
    { key: 34, guild: 'a', tier: 'palace', region: 34 },         // Alcaire: Wayrest's
    { key: 26, guild: 'b', tier: 'palace', region: 26 },         // Orsinium: a Free Land
    { key: 23, guild: 'c', tier: 'crown', region: 23 },          // Wayrest's crown
    { key: 60, guild: 'd', tier: 'palace', region: 60 },         // Ilessan Hills: Daggerfall's, no Tithe
  ];
  const tithes = new Map([['a', 30000], ['b', 50000], ['c', 90000], ['crown', 99999]]);
  const due = conscriptionDue({ kingdom: 'daggerfall', crownGuild: 'crown', holds, tithes });
  // a's 30,000 over its three Charters: 10,000 a seat; Tulune 2% (200) and Anticlere 1% (100)
  assert.deepEqual(due, [{ guild: 'a', keys: [21, 58], amount: 300 }, { guild: 'd', keys: [60], amount: 0 }]);
  const wayrest = conscriptionDue({ kingdom: 'wayrest', crownGuild: 'c', holds, tithes });
  assert.deepEqual(wayrest, [{ guild: 'a', keys: [21, 34], amount: 300 }], 'Alcaire 2%, Anticlere 1% to its other claiming crown too');
  assert.deepEqual(conscriptionDue({ kingdom: 'sentinel', crownGuild: null, holds, tithes }), [], 'nothing of Sentinel\'s held');
  assert.deepEqual(conscriptionDue({ kingdom: 'daggerfall', crownGuild: 'z', holds: [{ key: 17, guild: 'x', tier: 'crown', region: 17 }], tithes: new Map([['x', 9000]]) }), [],
    'a crown seat pays no Conscription');
  assert.deepEqual(conscriptionDue({ kingdom: 'daggerfall', crownGuild: 'crown', holds: [{ key: 58, guild: 'a', tier: 'palace', region: 58 }], tithes: new Map([['a', 149]]) }),
    [{ guild: 'a', keys: [58], amount: 2 }], 'rounded down');
  assert.deepEqual(conscriptionDue({ kingdom: 'daggerfall', crownGuild: 'crown', holds: [{ key: 58, guild: 'a', tier: 'palace', region: 58 }], tithes: null }),
    [{ guild: 'a', keys: [58], amount: 0 }]);
});

test('CROWN1 A CONSCRIPTED SEAT\'S STANDING (7.3, 7.6): -5 in its week\'s rows, the Turning\'s plan carrying it to a held seat that paid (mutants: the row; the plan\'s flag)', () => {
  assert.equal(STANDING_CHANGES.conscripted, -5);
  const base = { tier: 'palace', standing: 50, tithe: 6 };
  const plain = standingWeek(base), paid = standingWeek({ ...base, conscripted: true });
  assert.equal(paid.standing, plain.standing - 5);
  assert.deepEqual(paid.changes.at(-1), ['conscripted', -5]);
  const seat = (conscripted) => ({ key: 58, tier: 'palace', holder: { guild: 'a', standing: 50, tithe: 6, conscripted }, guilds: [{ guild: 'a', influence: 10, legacy: 0, pledgedAt: 0 }] });
  const plan = (c) => turningPlan({ week: 3, seats: [seat(c)], treasuries: new Map([['a', 100000]]) }).standings[0].standing;
  assert.equal(plan(true), plan(false) - 5);
});

test('CROWN1 THE CHRONICLE\'S CONSCRIPTION ROWS: at the crown, what it brought; at each seat that paid, what it paid and to whom (mutants: the kinds; the sums)', () => {
  const seat = { key: 17, name: 'Daggerfall', tier: 'crown', region: 17 };
  assert.equal(chronicleLine({ kind: 'conscription', week: 4, data: { guild: { name: 'The Silver Hand', tag: 'SH' }, from: { name: 'Oath', tag: 'OA' }, marks: 1200 } }, seat),
    'In week 4, the crown\'s Conscription brought the Silver Hand <SH> 1,200 silver of its kingdom\'s Tithe.');   // PIN MOVED (AUDIT-SEATS L7): Drakes, the players' word; SILVER: silver
  assert.equal(chronicleLine({ kind: 'conscripted', week: 4, data: { guild: { name: 'Oath', tag: 'OA' }, crown: { name: 'The Silver Hand', tag: 'SH' }, marks: 300 } }, { ...seat, name: 'Tulune', tier: 'palace' }),
    'In week 4, Oath <OA> paid 300 silver of its Tithe to the Silver Hand <SH>\'s Conscription.');
});
