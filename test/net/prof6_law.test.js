// PROF6 (2026-09-29, Mac: "continue") - THE WRITS' LAW BESIDE THE COURT'S (src/net/writLaw.js, guildLaw.js, boardLaw.js,
// marksLaw.js): a guild writ's seven days, twenty a guild, 1 to 5,000 units of what the market takes, its pay each 1 to
// 1.5 x the value rounded down; the Officers' budget 0 to the cap; the seat week from the first Turning; the guild
// Stores' 50,000; a commission's pay, its listable recipes, its least quality where one is taken, the piece that answers
// it; the ranks' new powers, the note's fourth button, the ledger's six kinds each a move.
// bible/06-Systems/Professions-Arc.md 7, 11, 28.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  WRIT_S, GUILD_WRITS_MAX, WRIT_UNITS_MAX, WRIT_PAY_PCT, WRIT_BUDGET_MAX, WRIT_POSTS_MAX, WRIT_OPS_MAX, GUILD_STORES_MAX, COMMISSIONS_MAX,
  COMMISSIONS_FOR_MAX, SEAT_WEEK_S, SEAT_WEEK_ZERO_S, WRIT_POWERS, writMay, writMaterialOk, writUnitsOk, writPayMax, writPayOk, writBudgetOk, seatWeek,
  seatWeekStart, guildMoveOk, commissionPayOk, commissionable, commissionTakesQuality, commissionQualityOk, commissionFilledBy,
} from '../../src/net/writLaw.js';
import { MARKS_MAX, MARKS_KINDS } from '../../src/net/marksLaw.js';
import { STORES_MAX } from '../../src/net/professionLaw.js';
import { material } from '../../src/net/nodeLaw.js';
import { UNYIELDED } from '../../src/net/marketLaw.js';
import { GUILD_POWERS } from '../../src/net/guild/guildLaw.js';
import { NOTE_BUTTONS, NOTE_BUTTON_LABEL } from '../../src/net/boardLaw.js';
import { MASTERWORK } from '../../src/net/recipeLaw.js';

test('PROF6 law: a guild writ stands seven days, twenty a guild; 1 to 5,000 units of a material the market takes; pay each a whole Mark to 1.5 x its value, rounded down; the Officers\' budget 0 to the cap', () => {
  assert.deepEqual([WRIT_S, GUILD_WRITS_MAX, WRIT_UNITS_MAX, WRIT_PAY_PCT, WRIT_BUDGET_MAX, WRIT_POSTS_MAX, WRIT_OPS_MAX, GUILD_STORES_MAX],
    [7 * 86_400, 20, STORES_MAX, 150, MARKS_MAX, 20, 120, 50_000]);
  assert.equal(writMaterialOk('log:oak'), true);
  assert.equal(writMaterialOk('ore:mithril'), true);
  for (const k of UNYIELDED) assert.equal(writMaterialOk(k), false, `${k}: nothing yields it`);
  assert.equal(writMaterialOk('no-such'), false);
  assert.equal(writMaterialOk(5), false);
  for (const [n, ok] of [[1, true], [5_000, true], [0, false], [5_001, false], [2.5, false], ['9', false]]) assert.equal(writUnitsOk(n), ok, String(n));
  // tier 1 (value 1) pays 1; oak (tier 2, value 2) 3; mithril ore (value 9) 13 - never the half Mark past it
  assert.deepEqual([writPayMax('metal:iron'), writPayMax('log:oak'), writPayMax('ore:mithril'), writPayMax('no-such')], [1, 3, 13, 0]);
  for (const k of ['metal:iron', 'log:oak', 'ore:mithril']) assert.ok(writPayMax(k) * 100 <= material(k).value * 150 && (writPayMax(k) + 1) * 100 > material(k).value * 150, k);
  assert.deepEqual([writPayOk('log:oak', 3), writPayOk('log:oak', 4), writPayOk('log:oak', 0), writPayOk('log:oak', 2.5), writPayOk('no-such', 1)], [true, false, false, false, false]);
  assert.deepEqual([writBudgetOk(0), writBudgetOk(MARKS_MAX), writBudgetOk(-1), writBudgetOk(MARKS_MAX + 1), writBudgetOk(1.5)], [true, true, false, false, false]);
});

test('PROF6 law: the seat week runs Sunday 18:00 UTC to Sunday 18:00, week 0 the first Turning (2026-09-20); the guild Stores move 1 to a character\'s 5,000', () => {
  assert.equal(SEAT_WEEK_S, 7 * 86_400);
  assert.equal(SEAT_WEEK_ZERO_S, Date.UTC(2026, 8, 20, 18) / 1000);
  assert.equal(new Date(SEAT_WEEK_ZERO_S * 1000).getUTCDay(), 0, 'a Sunday');
  assert.deepEqual([seatWeek(SEAT_WEEK_ZERO_S), seatWeek(SEAT_WEEK_ZERO_S - 1), seatWeek(SEAT_WEEK_ZERO_S + SEAT_WEEK_S - 1), seatWeek(SEAT_WEEK_ZERO_S + SEAT_WEEK_S)], [0, -1, 0, 1]);
  assert.equal(seatWeekStart(3), SEAT_WEEK_ZERO_S + 3 * SEAT_WEEK_S);
  for (const w of [-2, 0, 5, 40]) assert.equal(seatWeek(seatWeekStart(w)), w);
  for (const [n, ok] of [[1, true], [STORES_MAX, true], [0, false], [STORES_MAX + 1, false], [1.5, false]]) assert.equal(guildMoveOk(n), ok, String(n));
});

test('PROF6 law: a commission - pay 1 to 1,000,000; a listable piece, never arrows or a siege work; its least quality Crude to Masterwork where the recipe takes one, none for a kit; answered by the recipe at least at the quality', () => {
  assert.deepEqual([COMMISSIONS_MAX, COMMISSIONS_FOR_MAX], [5, 20]);
  assert.deepEqual([commissionPayOk(1), commissionPayOk(1_000_000), commissionPayOk(0), commissionPayOk(1_000_001)], [true, true, false, false]);
  assert.deepEqual(['longsword:mithril', 'table-small:oak', 'kit:iron', 'arrows:north', 'ramkit:oak', 'no-such'].map(commissionable), [true, true, true, false, false, false]);
  assert.deepEqual([commissionTakesQuality('longsword:mithril'), commissionTakesQuality('kit:iron'), commissionTakesQuality('no-such')], [true, false, false]);
  assert.deepEqual([0, MASTERWORK, -1, 5, 2.5, null].map((q) => commissionQualityOk('longsword:mithril', q)), [true, true, false, false, false, false]);
  assert.deepEqual([null, 0, 1].map((q) => commissionQualityOk('kit:iron', q)), [true, false, false], 'a kit asks no quality');
  const c = { recipe: 'longsword:mithril', quality: 2 };
  assert.deepEqual([
    commissionFilledBy(c, { recipe: 'longsword:mithril', quality: 2 }), commissionFilledBy(c, { recipe: 'longsword:mithril', quality: 4 }),
    commissionFilledBy(c, { recipe: 'longsword:mithril', quality: 1 }), commissionFilledBy(c, { recipe: 'longsword:steel', quality: 4 }),
    commissionFilledBy(c, null), commissionFilledBy({ recipe: 'kit:iron', quality: null }, { recipe: 'kit:iron', quality: -1 }),
  ], [true, true, false, false, false, true]);
});

test('PROF6 law: the Guildmaster and Officers post writs and withdraw the guild Stores, the Guildmaster alone sets the budget, any member deposits; the note\'s fourth button; the ledger\'s six kinds each a move', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(WRIT_POWERS).map(([k, v]) => [k, [...v]])), { postWrit: [0, 1], writBudget: [0], storesWithdraw: [0, 1] });
  assert.deepEqual([0, 1, 2, 3].map((r) => writMay(r, 'postWrit')), [true, true, false, false]);
  assert.deepEqual([0, 1, 2, 3].map((r) => writMay(r, 'storesWithdraw')), [true, true, false, false]);
  assert.deepEqual([writMay(0, 'nonsense'), [0, 1, 2, 3].every((r) => GUILD_POWERS.deposit.includes(r))], [false, true], 'any member deposits - GUILD1\'s own');
  assert.equal('postWrit' in GUILD_POWERS, false, 'the relay\'s guildLaw.js unmoved (SLAM13)');
  assert.deepEqual(NOTE_BUTTONS, ['party', 'guild', 'duel', 'commission']);
  assert.equal(NOTE_BUTTON_LABEL.commission, 'Commission a piece');
  const kinds = ['writ-escrow', 'writ-pay', 'writ-return', 'commission-escrow', 'commission-pay', 'commission-return'];
  assert.deepEqual(kinds.map((k) => MARKS_KINDS[k]), kinds.map(() => 'move'), 'no Mark made or burnt by a writ of a guild\'s or a commission');
});
