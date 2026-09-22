// G7 - DAEDRA SUMMONING, the last of the twenty guild services whose
// destination was null, and the only one that is a CALENDAR: fifteen
// of the sixteen princes answer on exactly one day of the year, and on
// any other day the temple tells you to come back.
//
// Three summoners select three different ways, and they are separate
// branches rather than variations:
//   - the GLENMORIL witches always summon Hircine, on any day (DFU's
//     own comment calls this "reversed from classic: this is
//     intentional", so the port keeps DFU and records the divergence);
//   - any OTHER coven summons a random prince, once per day and
//     remembered - and the roll EXCLUDES index 0, so a coven can never
//     draw Hircine;
//   - everyone else summons whoever's day it is, and nobody on the
//     other 349.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DAEDRA, HIRCINE_INDEX, SHEOGORATH_INDEX, GLENMORIL_WITCHES, WITCHES_COVEN_TYPE,
  WITCHES_GUILD_GROUP, SUMMON_TEXT, DAEDRIC_FOES,
  summoningCost, summoningChance, daedraForSummoner, weatherBonus, attemptSummoning,
  summonMacroValues,
} from '../src/systems/daedraSummoning.js';
import { expandRowValues } from '../src/systems/quest/questMacros.js';   // DAEDRA1: the walk the boxes go through
import { FACTION_FLAGS } from '../src/systems/factionRep.js';
import { serviceDestination } from '../src/systems/guildServiceFlow.js';
import { goldAmount, totalGoldAmount, deductGold } from '../src/systems/court.js';   // DAEDRA2: the two quantities and the payment that knows the difference
import { LETTER_OF_CREDIT_TEMPLATE } from '../src/systems/inventory.js';   // ...and what paper is, from its own home

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const code = (p) => readFileSync(join(SRC, p), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split('\n').map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');

/** A generator that walks a fixed sequence, then holds the last value -
 *  the summoning rolls twice (Sheogorath, then the summon). */
const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

test('G7: sixteen princes, and the array ORDER is load-bearing twice', () => {
  assert.equal(DAEDRA.length, 16);
  assert.equal(DAEDRA[HIRCINE_INDEX].name, 'Hircine', 'index 0 is Glenmoril\'s, and excluded from the coven roll');
  assert.equal(DAEDRA[SHEOGORATH_INDEX].name, 'Sheogorath', 'index 8 is the gatecrasher');
  // every prince has a distinct faction and a distinct day
  assert.equal(new Set(DAEDRA.map((d) => d.factionId)).size, 16);
  assert.equal(new Set(DAEDRA.map((d) => d.dayOfYear)).size, 16);
  for (const d of DAEDRA) {
    assert.ok(d.dayOfYear >= 1 && d.dayOfYear <= 360, `${d.name}'s day is in the year`);
    assert.match(d.video, /\.FLC$/, 'the summoning video name rides along for the window that will play it');
    assert.ok(d.quest.length === 8, `${d.name}'s quest name is a classic 8-char id`);
  }
  // the five with a weather condition, and no others
  assert.deepEqual(DAEDRA.filter((d) => d.bonusCond).map((d) => d.name),
    ['Sanguine', 'Peryite', 'Sheogorath', 'Boethiah', 'Nocturnal']);
});

test('G7: the calendar - one prince a day, nobody on the rest', () => {
  assert.equal(daedraForSummoner({ dayOfYear: 13 })?.name, 'Meridia');
  assert.equal(daedraForSummoner({ dayOfYear: 1 })?.name, 'Clavicus Vile');
  assert.equal(daedraForSummoner({ dayOfYear: 350 })?.name, 'Molag Bal');
  assert.equal(daedraForSummoner({ dayOfYear: 14 }), null, 'and on an ordinary day, nobody');
  // sixteen days in the year answer; the other 344 do not
  let answering = 0;
  for (let d = 1; d <= 360; d++) if (daedraForSummoner({ dayOfYear: d })) answering++;
  assert.equal(answering, 16);
});

test('G7: Glenmoril always answers Hircine, and is tested BEFORE the coven branch', () => {
  // The ID test precedes the type test, so Glenmoril's witches never
  // reach the random draw even though they ARE a coven.
  for (const day of [1, 14, 155, 359]) {
    assert.equal(daedraForSummoner({
      factionId: GLENMORIL_WITCHES, factionType: WITCHES_COVEN_TYPE, dayOfYear: day,
    }), DAEDRA[HIRCINE_INDEX], `Hircine on day ${day}`);
  }
});

test('G7: a coven rolls once a day, remembers it, and can never draw Hircine', () => {
  const state = {};
  const first = daedraForSummoner({ factionType: WITCHES_COVEN_TYPE, dayOfYear: 100, state, rolls: () => 0 });
  assert.equal(state.daedraSummonDay, 100);
  assert.ok(state.daedraSummonIndex >= 1, 'Range(1, length) - index 0 is excluded');
  // the same day answers the same prince even with a different roll
  const again = daedraForSummoner({ factionType: WITCHES_COVEN_TYPE, dayOfYear: 100, state, rolls: () => 0.99 });
  assert.equal(again, first, 'the day\'s prince is remembered, not re-rolled');
  // a new day re-rolls
  daedraForSummoner({ factionType: WITCHES_COVEN_TYPE, dayOfYear: 101, state, rolls: () => 0.99 });
  assert.equal(state.daedraSummonDay, 101);

  // ...and across the whole roll space, never Hircine
  for (let i = 0; i < 200; i++) {
    const s = {};
    const d = daedraForSummoner({ factionType: WITCHES_COVEN_TYPE, dayOfYear: i, state: s, rolls: () => i / 200 });
    assert.notEqual(d, DAEDRA[HIRCINE_INDEX], 'a coven cannot summon Hircine - he is Glenmoril\'s');
  }
});

test('G7: the cost is the SUMMONER\'s reputation, inverted', () => {
  // 200000 - rep*1000. The most expensive service in the game by two
  // orders of magnitude, and meant to be.
  assert.equal(summoningCost(0), 200000);
  assert.equal(summoningCost(100), 100000, 'even a beloved temple charges six figures');
  assert.equal(summoningCost(-100), 300000, 'and one that hates you charges more');
});

test('G7: the 30% weather bonus reads backwards, and is right', () => {
  // `None` means ALWAYS, so the eleven princes with no condition are
  // never penalised. The five WITH one are the only ones the sky can
  // cost - by not being their weather.
  assert.equal(weatherBonus(DAEDRA[11], {}), 30, 'Meridia has no condition, so she always has the bonus');
  const sanguine = DAEDRA.find((d) => d.name === 'Sanguine');
  assert.equal(weatherBonus(sanguine, {}), 0, 'Sanguine in the dry gets nothing');
  assert.equal(weatherBonus(sanguine, { raining: true }), 30);
  assert.equal(weatherBonus(sanguine, { storming: true }), 0, 'a storm is not rain');
  const sheo = DAEDRA[SHEOGORATH_INDEX];
  assert.equal(weatherBonus(sheo, { storming: true }), 30);
  assert.equal(weatherBonus(sheo, { raining: true }), 0, 'and rain is not a storm');
  // the chance itself
  assert.equal(summoningChance(0, 30), 60);
  assert.equal(summoningChance(50, 0), 80);
});

test('G7: the four outcomes, and the gold that is spent before the roll', () => {
  const meridia = DAEDRA[11];
  const go = (o) => attemptSummoning({ daedra: meridia, ...o });

  // too poor - and DFU SAYS the number, so the player need not guess
  const poor = go({ gold: 100 });
  assert.equal(poor.kind, 'poor');
  assert.equal(poor.cost, 200000);

  // no hijack (roll 100 > 5), then a low summoning roll against 60
  const ok = go({ gold: 1e6, rolls: seq(0.99, 0) });
  assert.equal(ok.kind, 'quest');
  assert.equal(ok.daedra, meridia);
  assert.equal(ok.quest, meridia.quest);
  assert.equal(ok.flag, FACTION_FLAGS.Summoned);

  // a high roll misses - and the cost is still reported, because the
  // caller has already been told to spend it
  const missed = go({ gold: 1e6, rolls: seq(0.99, 0.99) });
  assert.equal(missed.kind, 'failed');
  assert.equal(missed.cost, 200000);
  assert.equal(missed.spawnFoes, false, 'a TEMPLE failure just disappoints you');

  // ...but a coven sets daedra on you for wasting its time
  const coven = go({ gold: 1e6, summonerGuildGroup: WITCHES_GUILD_GROUP, rolls: seq(0.99, 0.99) });
  assert.equal(coven.spawnFoes, true);
  assert.equal(DAEDRIC_FOES.length, 5, 'Range(0, 5) over five entries - every one reachable');

  // a prince you have met before greets you instead of offering work
  const before = go({ gold: 1e6, rolls: seq(0.99, 0), hasSummoned: () => true });
  assert.equal(before.kind, 'greeting');
  assert.equal(before.textId, SUMMON_TEXT.before);
});

test('G7: Sheogorath gatecrashes, and the chance rolled is HIS', () => {
  const meridia = DAEDRA[11];
  const sheo = DAEDRA[SHEOGORATH_INDEX];
  // roll 1 <= 5 hijacks in fair weather
  const hijacked = attemptSummoning({ daedra: meridia, gold: 1e6, rolls: seq(0, 0) });
  assert.equal(hijacked.daedra, sheo, 'you paid for Meridia and got the Mad One');
  // 15% while storming - a roll of 10 hijacks in a storm and does not otherwise
  const inStorm = attemptSummoning({ daedra: meridia, gold: 1e6, storming: true, rolls: seq(0.09, 0) });
  assert.equal(inStorm.daedra, sheo, '15% in a storm');
  const inCalm = attemptSummoning({ daedra: meridia, gold: 1e6, rolls: seq(0.09, 0) });
  assert.equal(inCalm.daedra, meridia, '...and 5% otherwise, so the same roll misses');
  // and the bonus applied is Sheogorath's own condition, not Meridia's
  assert.equal(weatherBonus(sheo, { storming: true }), 30);
  assert.equal(weatherBonus(sheo, {}), 0);
});

test('G7: the last null destination is gone, and the host goes through the law', () => {
  assert.equal(serviceDestination('DaedraSummoning'), 'guildServiceDaedraSummoning');
  const modes = code('scenes/worldModes.js');
  assert.match(modes, /daedraForSummoner\(\{/, 'the host asks who answers');
  assert.match(modes, /attemptSummoning\(\{/, 'and rolls through the law');
  assert.match(modes, /setFlag\(store, r\.daedra\.factionId, r\.flag\)/,
    'a first summoning is RECORDED, or the prince offers the same quest for ever');
  assert.match(modes, /deductGold\(playerEntity, r\.cost\)/, 'and the gold goes before the outcome');
  // FACTION_FLAGS.Summoned has existed since the faction slice with no
  // writer at all - this is the writer.
  assert.equal(FACTION_FLAGS.Summoned, 0x40);
});

test('DAEDRA1: the summoning box says a date, a prince and a name - not %dat, %dae and %pcn', () => {
  // Dracula/Valentin on Discord (2026-09-21): "daedra summoning is
  // fucked", with a screenshot of record 481 reading
  //   "Today is %dat, the day of summoning for %dae. Do you, %pcn,
  //    wish to risk you life and very soul by summoning %dae into our
  //    mundane world?"
  //
  // Three symbols, two sources. %dae is THIS FLOW's - which prince
  // answers is decided by the day and the coven's roll and by nothing
  // else - and %dat/%pcn are MacroHelper's global rows, which the
  // shared context answers for every other box in the port.
  const record = [
    { text: 'Today is %dat, the day of summoning', center: true },
    { text: 'for %dae. Do you, %pcn, wish', center: true },
    { text: 'to risk you life and very soul by summoning', center: true },
    { text: '%dae into our mundane world?', center: true },
  ];
  const ctx = { hooks: { playerName: () => 'Seanobi', nowSeconds: () => 60 * 60 * 24 * 30 } };
  const out = expandRowValues(record, summonMacroValues(DAEDRA[SHEOGORATH_INDEX]), ctx);
  const text = out.map((r) => r.text).join(' ');
  assert.doesNotMatch(text, /%\w+/, 'not one symbol survives the walk');
  assert.equal((text.match(/Sheogorath/g) ?? []).length, 2, 'BOTH %dae land - the record names the prince twice');
  assert.match(text, /Seanobi/, '%pcn is the player, off the shared context');
  assert.match(text, /Sun's Dawn/, "%dat is the game's own date, off the same context");
  assert.equal(out[0].center, true, 'and a row keeps its shape');

  // THE CONTEXT ALONE IS ENOUGH TO WALK, which is the seam the bug sat
  // in: the coven handed rows over with no values of its own, and the
  // walk used to refuse to run without a value map.
  const noValues = expandRowValues([{ text: 'Do you, %pcn, wish', center: true }], null, ctx);
  assert.equal(noValues[0].text, 'Do you, Seanobi, wish');

  // A MISSING SOURCE LEAVES ITS TOKEN VERBATIM rather than printing a
  // hole - MacroHelper's own null posture, and what the "not a
  // summoning day" record (which names no prince) rides on.
  assert.equal(expandRowValues([{ text: '%dae' }], summonMacroValues(null), ctx)[0].text, '%dae');
  assert.equal(summonMacroValues(null).dae, null);
  assert.equal(summonMacroValues(DAEDRA[HIRCINE_INDEX]).dae, 'Hircine');

  // and nothing at all is still not a throw
  assert.deepEqual(expandRowValues(null, null, null), null);
  assert.deepEqual(expandRowValues(record, null, null), record, 'no values and no context: the rows as they were');
});

test('DAEDRA1: every box the coven and the summoning show goes THROUGH the walk', () => {
  const modes = code('scenes/worldModes.js');
  // the coven's own rows provider - its prompts and its quest offers
  // DAEDRA1b: off the RAW reader, and once - the composition pin below
  // owns the rest of this law
  // MACRO-ONE: the context is the WORLD'S now (setMacroWorld), which a
  // null hands over - the machine's own posed as a quest and could throw
  assert.match(modes, /const rows = \(id\) => expandRowValues\(rawRows\(id\), null, null\);/,
    'the coven expands every record it shows');
  // the flow's own, with the prince riding it
  assert.match(modes, /const say = \(id, d = daedra\) => expandRowValues\(rows\?\.\(id\) \?\? \[\], summonMacroValues\(d\), null\);/,
    'and the summoning adds %dae to it');
  // ONE READ PER BOX: these records carry random variants, so a
  // `say(id).length ? say(id) : fallback` would roll twice
  assert.doesNotMatch(modes, /say\([^)]*\)\.length \? say\(/, 'no box reads its record twice');
  for (const site of [/box\(SUMMON_TEXT\.notToday, null,/, /box\(SUMMON_TEXT\.areYouSure, daedra,/,
    /box\(SUMMON_TEXT\.failed, r\.daedra,/, /box\(r\.textId, r\.daedra,/]) {
    assert.match(modes, site, `a summoning box still goes through the walk: ${site}`);
  }
  // the PRINCE WHO ANSWERED names the greeting and the offer, not the
  // one the day named - Sheogorath hijacks 5% of summonings
  assert.match(modes, /offerBoxes\(offered, \(id\) => say\(id, r\.daedra\)\)/,
    "the prince's own offer is expanded too, and by the prince who came");
  assert.doesNotMatch(modes, /rows\?\.\(SUMMON_TEXT/, 'no raw row left in the flow');
});

test('DAEDRA1b: a record is expanded ONCE, where it is shown - a second walk over a sentinel is what put "Peryite[srcDataUnknown]" on screen', () => {
  // Dracula/Valentin, on the DAEDRA1 build: the box now reads "Today is
  // Tirdas the 24th of Rain's Hand" and "Do you, Valentin" - %dat and
  // %pcn landed - but %dae came out as "Peryite[srcDataUnknown]".
  //
  // DAEDRA1 wrapped the coven's provider AND had the summoning flow
  // wrap it again, so a record went through TWO walks:
  //   walk 1 (the provider): context, but no %dae -> getMacroValue ends
  //          its ladder at `symbolStr + '[srcDataUnknown]'`, so the text
  //          now reads `%dae[srcDataUnknown]`
  //   walk 2 (the flow): supplies dae, matches the `%dae` INSIDE that
  //          string, and leaves the marker standing.
  // Neither walk is wrong on its own. Composing them is.
  const ctx = { hooks: { playerName: () => 'Valentin', nowSeconds: () => 60 * 60 * 24 * 115 } };
  const record = [{ text: 'the day of summoning for %dae. Do you, %pcn, wish', center: true }];
  const values = summonMacroValues(DAEDRA.find((d) => d.name === 'Peryite'));

  // THE SHAPE THAT SHIPPED, driven so it cannot come back unnoticed
  const twice = expandRowValues(expandRowValues(record, null, ctx), values, ctx);
  assert.match(twice[0].text, /Peryite\[srcDataUnknown\]/, 'two walks reproduce the screenshot exactly');

  // THE LAW: one walk, from the raw record, with everything known
  const once = expandRowValues(record, values, ctx);
  assert.equal(once[0].text, 'the day of summoning for Peryite. Do you, Valentin, wish');
  assert.doesNotMatch(once[0].text, /\[(srcDataUnknown|nullMCP|undefined|unhandled)\]/,
    'no sentinel reaches the screen');

  // AND WHY THE FIRST WALK CANNOT SIMPLY BE TAUGHT TO LEAVE IT ALONE: a
  // context that cannot answer a symbol MARKS it, which is DFU's own
  // ladder and right for a final pass. The fix is composition, not the
  // ladder - so this pin states the marking as intended behaviour.
  assert.match(expandRowValues([{ text: '%dae' }], null, ctx)[0].text, /^%dae\[srcDataUnknown\]$/,
    'a context-only walk marks an unanswerable symbol - that is the ladder, and it stays');
});

test('DAEDRA1b: the coven keeps a RAW reader, and hands THAT to the summoning flow', () => {
  const modes = code('scenes/worldModes.js');
  assert.match(modes, /const rawRows = \(id\) => townTalk\?\.lines\?\.\(id\) \?\? \[\];/,
    'the raw reader exists');
  assert.match(modes, /const rows = \(id\) => expandRowValues\(rawRows\(id\), null, null\);/,
    "the window's own boxes expand once, off the raw reader");
  assert.match(modes, /openServiceFlow\('guildServiceDaedraSummoning', \{\s*guild: null, memberships: \[\], store, rows: rawRows,/,
    'and the flow is handed the RAW reader, not the expanded one - the whole of this fix');
});

test('DAEDRA2: a letter of credit pays for a summoning - the gate is what the payment can spend', () => {
  // Opus, reading DFU against the port before the merge: the flow gated
  // on `goldAmount` (coins) and paid with `deductGold` (coins AND
  // letters). DFU tests PlayerEntity.GetGoldAmount() and pays with
  // DeductGoldAmount(), and both of those know about paper - so a
  // character holding a letter big enough was turned away as too poor
  // from a bill the very next line could have settled.
  //
  // A summoning is the worst place for it: `summoningCost` is 200,000
  // at reputation zero, which is far past what anyone carries in coin.
  // At that price the gate is ALWAYS the letter, so the whole service
  // was unreachable for the players it was priced for.
  const cost = summoningCost(0);
  assert.equal(cost, 200000, 'the price the gate has to admit');

  // the two quantities, as court.js draws the line
  const withLetter = { goldPieces: 10, items: [{ templateIndex: LETTER_OF_CREDIT_TEMPLATE, value: 250000 }] };
  assert.equal(goldAmount(withLetter), 10, 'coins alone');
  assert.equal(totalGoldAmount(withLetter), 250010, 'coins and paper - DFU GetGoldAmount');

  // THE GATE. Driven through attemptSummoning itself, because that is
  // the function the host hands its number to.
  const daedra = DAEDRA[HIRCINE_INDEX];
  const args = { daedra, summonerRep: 0, daedraRep: () => 0, hasSummoned: () => false, rolls: () => 0 };
  assert.equal(attemptSummoning({ ...args, gold: goldAmount(withLetter) }).kind, 'poor',
    'coins alone turn this character away - the bug, stated');
  assert.notEqual(attemptSummoning({ ...args, gold: totalGoldAmount(withLetter) }).kind, 'poor',
    'and their letter gets them through, which is what DFU does');

  // AND THE PAYMENT REALLY TAKES IT, so the gate is not admitting a
  // bill that cannot be settled - the other half of the mismatch.
  const payer = { goldPieces: 10, items: [{ templateIndex: LETTER_OF_CREDIT_TEMPLATE, value: 250000 }] };
  deductGold(payer, cost);
  // DFU's DeductGoldAmount does NOT break the purse open first: when the
  // coins cannot cover the bill it spends LETTERS for the whole of it,
  // whole ones and then part of the last (PlayerEntity.cs:1331-1341).
  // So the ten coins are still there and the letter carries all 200,000
  // - which is worth pinning precisely, because the obvious guess
  // (purse first, paper for the shortfall) is wrong and this pin caught
  // it being written down that way.
  assert.equal(payer.goldPieces, 10, 'the purse is NOT broken into for a bill the paper can carry');
  assert.equal(payer.items[0].value, 50000, 'the letter carries the whole price - 250000 - 200000');
  assert.equal(totalGoldAmount(payer), 50010, 'and the wealth left is what the gate would see next time');
});

test('DAEDRA2: every gate whose payment spends letters is asked the same question', () => {
  // The mismatch is a CLASS, not a line: AUDIT 26 F103-F105/F178 named
  // it in banking ("the gate and the payment disagreed with each
  // other") and three more seams in this host still had it - the
  // summoning, the shop shelf's buy, and the repair counter. Each pays
  // with `deductGold`; each now gates on `totalGoldAmount`.
  //
  // Pinned as a RULE over the source rather than three times over, so a
  // fourth seam written tomorrow is caught by the same line: no gate
  // may compare a coins-only purse against a price it then pays with
  // deductGold.
  const modes = code('scenes/worldModes.js');
  assert.doesNotMatch(modes, /goldAmount\(playerEntity\) < price/,
    'no price is gated on coins alone');
  for (const site of [/gold: totalGoldAmount\(playerEntity\)/, /if \(totalGoldAmount\(playerEntity\) < price\) return null;/,
    /if \(totalGoldAmount\(playerEntity\) < price\) \{/]) {
    assert.match(modes, site, `the gate takes GetGoldAmount: ${site}`);
  }
});
