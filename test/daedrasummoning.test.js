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
  assert.match(modes, /const rows = \(id\) => expandRowValues\(townTalk\?\.lines\?\.\(id\) \?\? \[\], null, questBridge\?\.machine\.macroContext\(\) \?\? null\)/,
    'the coven expands every record it shows');
  // the flow's own, with the prince riding it
  assert.match(modes, /const say = \(id, d = daedra\) => expandRowValues\(rows\?\.\(id\) \?\? \[\], summonMacroValues\(d\), questBridge\?\.machine\.macroContext\(\) \?\? null\)/,
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
