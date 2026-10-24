// CROWN2 (2026-10-01, Mac: "Finish the seats"; "Continue"; "Hurry up"): FEALTY AND PACTS' LAW - who may swear to whom,
// a vassal's tribute, its liege's half-reach on its defence, a break's Standing, Conscription sparing a vassal, a Pact's
// Season, the pledges either bars, the red line and the Chronicle's words (bible/11-Multiplayer/Seats-Arc.md 7.8).
// Pure: src/net/townSeatLaw.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FEALTY, fealtyKingdom, fealtyTribute, SEASON_WEEKS, pactUntil, pledgeBarred, pactBrokenText, SEAT_RED_S, FEALTY_WHY, STANDING_CHANGES,
  seatDefence, standingWeek, turningPlan, conscriptionDue, chronicleLine, KINGDOM_REACH, MARCH_REACH, SIEGE_PAIR_WEEKS, fealtyReckoning,
} from '../../src/net/townSeatLaw.js';

const crown = (region) => ({ tier: 'crown', region });
const palace = (region) => ({ tier: 'palace', region });

test('CROWN2 WHO MAY SWEAR (7.8): a palace of the crown\'s kingdom or a March it claims, to that crown\'s holder; never a Free Land\'s, another kingdom\'s, a crown holder, a guild with no crown as liege (mutants: the kingdom; the March; the crown vassal; the free land)', () => {
  assert.equal(fealtyKingdom([palace(34)], [crown(23)]), 'wayrest', 'Alcaire to Wayrest');
  assert.equal(fealtyKingdom([palace(21)], [crown(23)]), 'wayrest', 'Anticlere, a March Wayrest claims');
  assert.equal(fealtyKingdom([palace(21)], [crown(20)]), null, 'Anticlere is no March of Sentinel\'s');
  assert.equal(fealtyKingdom([palace(58)], [crown(23)]), null, 'Tulune is Daggerfall\'s');
  assert.equal(fealtyKingdom([palace(26)], [crown(23), crown(17), crown(20)]), null, 'a Free Land');
  assert.equal(fealtyKingdom([palace(34), crown(17)], [crown(23)]), null, 'a crown holder swears to none');
  assert.equal(fealtyKingdom([palace(34)], [palace(23)]), null, 'a liege holds a crown');
  assert.equal(fealtyKingdom([palace(58), palace(34)], [crown(17), crown(23)]), 'daggerfall', 'two crowns: the first that fits');
  assert.equal(fealtyKingdom([palace(34)], [crown(17), crown(23)]), 'wayrest', 'two crowns: the second, where the first does not');
  assert.equal(fealtyKingdom(null, null), null);
});

test('CROWN2 THE NUMBERS (Appendix: "5% / half / 10 Standing"): the tribute rounded down; the liege\'s half-reach on the vassal\'s own influence in its defence, added after the multipliers; the break\'s row; a Pact to the Season\'s end (mutants: each number; the share; the rounding; the Season)', () => {
  assert.deepEqual({ ...FEALTY }, { tribute: 0.05, reachShare: 0.5, breakStanding: -10 });
  assert.equal(STANDING_CHANGES.fealtyBroken, -10);
  assert.deepEqual([fealtyTribute(20000), fealtyTribute(19), fealtyTribute(39), fealtyTribute(-5), fealtyTribute(undefined)], [1000, 0, 1, 0, 0]);
  const own = { influence: 2000, legacy: 300 };
  assert.equal(seatDefence(own, 50, 0, false, KINGDOM_REACH) - seatDefence(own, 50, 0, false), 250, 'half a quarter on 2,000');
  assert.equal(seatDefence(own, 50, 0, false, MARCH_REACH) - seatDefence(own, 50, 0, false), 125, 'half an eighth at a March');
  assert.equal(seatDefence({ influence: 1001, legacy: 0 }, 50, 0, false, KINGDOM_REACH) - seatDefence({ influence: 1001, legacy: 0 }, 50, 0, false), 125, 'rounded down');
  assert.equal(seatDefence(own, 50, 1, true, KINGDOM_REACH) - seatDefence(own, 50, 1, true), 250, 'never multiplied by the Overreach cut or the held bonus');
  assert.equal(seatDefence(own, 50, 0, false, -1), seatDefence(own, 50, 0, false), 'never less');
  assert.deepEqual([SEASON_WEEKS, SIEGE_PAIR_WEEKS], [8, 8], 'one Season\'s length');
  assert.deepEqual([pactUntil(0), pactUntil(7), pactUntil(8), pactUntil(13), pactUntil(-3)], [8, 8, 16, 16, 8]);
});

test('CROWN2 THE TURNING\'S PLAN: a vassal holder\'s defence carries its liege\'s half-reach, so a challenger who would have had a Right is turned back; a breaker\'s week of Standing carries -10 (mutants: the reach in the plan; the break in the plan)', () => {
  const seat = (liegeReach) => ({
    key: 3034, tier: 'palace', holder: { guild: 'v', standing: 50, tithe: 6, liegeReach },
    guilds: [{ guild: 'v', influence: 5600, legacy: 0, pledgedAt: 0 }, { guild: 'c', influence: 6200, legacy: 0, pledgedAt: 1 }],
  });
  const plan = (r) => turningPlan({ week: 3, seats: [seat(r)], treasuries: new Map([['v', 1e6], ['c', 1e6]]) });
  const own = { influence: 5600, legacy: 0 };
  assert.ok(seatDefence(own, 50, 0, false) < 6200 && seatDefence(own, 50, 0, false, KINGDOM_REACH) > 6200, 'the reach decides it');
  assert.deepEqual(plan(0).rights.map((r) => r.guild), ['c'], 'without a liege: a Right');
  assert.deepEqual(plan(KINGDOM_REACH).rights, [], 'with its liege\'s half-reach: none');
  const base = { tier: 'palace', standing: 50, tithe: 6 };
  assert.equal(standingWeek({ ...base, brokeFealty: true }).standing, standingWeek(base).standing - 10);
  assert.deepEqual(standingWeek({ ...base, brokeFealty: true }).changes.at(-1), ['fealtyBroken', -10]);
  const p = (b) => turningPlan({ week: 3, seats: [{ key: 1, tier: 'palace', holder: { guild: 'v', standing: 50, tithe: 6, brokeFealty: b }, guilds: [{ guild: 'v', influence: 10, legacy: 0, pledgedAt: 0 }] }], treasuries: new Map([['v', 1e6]]) }).standings[0].standing;
  assert.equal(p(true), p(false) - 10);
});

test('CROWN2 CONSCRIPTION SPARES A VASSAL (7.6: "never a vassal\'s"); the pledges fealty and Pacts bar; the red line; the Chronicle\'s words; the refusals in words (mutants: the vassals; each bar; the text)', () => {
  const holds = [{ key: 23, guild: 'crown', tier: 'crown', region: 23 }, { key: 34, guild: 'v', tier: 'palace', region: 34 }, { key: 40, guild: 'o', tier: 'palace', region: 40 }];
  const tithes = new Map([['v', 10000], ['o', 10000]]);
  assert.deepEqual(conscriptionDue({ kingdom: 'wayrest', crownGuild: 'crown', holds, tithes }).map((d) => d.guild), ['o', 'v']);
  assert.deepEqual(conscriptionDue({ kingdom: 'wayrest', crownGuild: 'crown', holds, tithes, vassals: new Set(['v']) }).map((d) => d.guild), ['o']);
  const bans = { liege: 'L', vassals: ['V1', 'V2'], pacts: ['P'] };
  assert.deepEqual(['L', 'V2', 'P', 'X', null, 'me'].map((h) => pledgeBarred('me', h, bans)), ['fealty-pledge', 'fealty-pledge', 'pact-pledge', null, null, null]);
  assert.equal(pledgeBarred('me', 'L'), null, 'no bans, none barred');
  assert.equal(pactBrokenText({ name: 'Daggers', tag: 'DG' }, { name: 'The Oath', tag: 'OA' }), 'Daggers <DG> has broken its Pact of non-aggression with the Oath <OA>.');
  assert.equal(SEAT_RED_S, 86400);
  const seat = { key: 3034, name: 'Alcaire Keep', tier: 'palace', region: 34 };
  const sh = { name: 'The Silver Hand', tag: 'SH' }, oa = { name: 'The Oath', tag: 'OA' };
  assert.equal(chronicleLine({ kind: 'fealty-sworn', week: 5, data: { vassal: sh, liege: oa } }, seat), 'In week 5, the Silver Hand <SH> swore fealty to the Oath <OA>.');
  assert.equal(chronicleLine({ kind: 'fealty-broken', week: 6, data: { vassal: sh, liege: oa, breaker: oa } }, seat), 'In week 6, the Oath <OA> broke the fealty between the Silver Hand <SH> and the Oath <OA>.');
  assert.equal(chronicleLine({ kind: 'fealty-tribute', week: 6, data: { vassal: sh, liege: oa, marks: 1000 } }, seat), 'In week 6, the Silver Hand <SH> paid 1,000 silver in fealty to the Oath <OA>.');   // PIN MOVED (AUDIT-SEATS L7): Drakes; SILVER: silver; AUDIT GUILD3 W5: in fealty - "Tribute" is the seat's
  assert.equal(chronicleLine({ kind: 'fealty-lapsed', week: 7, data: { vassal: sh, liege: oa } }, seat), 'In week 7, the fealty between the Silver Hand <SH> and the Oath <OA> lapsed.');
  assert.deepEqual(Object.keys(FEALTY_WHY), ['fealty-unfit', 'fealty-none', 'fealty-sworn', 'fealty-pledged', 'fealty-pledge', 'pact-none', 'pact-signed', 'pact-self', 'pact-pledged', 'pact-pledge', 'guild-unknown']);
});

test('CROWN2 THE TURNING\'S FEALTIES: each pair over the Charters as they stand - fitting or lapsed, broken by whom; the breakers; a vassal\'s liege\'s reach at each seat it holds (a quarter in the kingdom, an eighth at a March), none for a fealty breaking or lapsed, none for another guild (mutants: the fit; the break; the reach; the liege)', () => {
  const charters = [
    { guild: 'L', tier: 'crown', region: 23 }, { guild: 'V', tier: 'palace', region: 34 }, { guild: 'V', tier: 'palace', region: 21 },
    { guild: 'B', tier: 'palace', region: 40 }, { guild: 'X', tier: 'palace', region: 58 },
  ];
  const rows = [
    { vassal: 'V', liege: 'L', state: 'sworn', broken_by: null },
    { vassal: 'B', liege: 'L', state: 'breaking', broken_by: 'L' },
    { vassal: 'X', liege: 'L', state: 'sworn', broken_by: null },
  ];
  const r = fealtyReckoning(rows, charters);
  assert.deepEqual(r.fealties, [
    { vassal: 'V', liege: 'L', broken: null, fits: true },
    { vassal: 'B', liege: 'L', broken: 'L', fits: true },
    { vassal: 'X', liege: 'L', broken: null, fits: false },
  ]);
  assert.deepEqual([...r.breakers], ['L']);
  assert.equal(r.liegeReach('V', { tier: 'palace', region: 34 }), KINGDOM_REACH, 'Alcaire, Wayrest\'s');
  assert.equal(r.liegeReach('V', { tier: 'palace', region: 21 }), MARCH_REACH, 'Anticlere, a March Wayrest claims');
  assert.equal(r.liegeReach('B', { tier: 'palace', region: 40 }), 0, 'breaking: none');
  assert.equal(r.liegeReach('X', { tier: 'palace', region: 58 }), 0, 'lapsed: none');
  assert.equal(r.liegeReach('L', { tier: 'crown', region: 23 }), 0, 'the liege itself: none');
  assert.deepEqual(fealtyReckoning(null, null).fealties, []);
});
