// AUDIT LIVED1b, lane T (bible/01-Overview/Audit-Lived1b.md, T1-T11) - the pins for the laws LIVED1 (1e12a3e6) and
// AUDIT LIVED1 (322b1735) wrote and nothing held: lane T wrote 237 new mutants over every line the two commits changed
// in src/, ran each against every test that imports, reads or (by coverage) executes the mutated text, and 53 survived.
// Each test below fails on the survivors its title names (tools/mutants/auditlived1b.json, the T records). Driven
// through the real modules where the module can be imported; the four hosts (world.js, exterior.js, worldModes.js,
// dungeonContext.js) and the DOM-mounted enhanced tavern and HUD cannot be, so their reads are pinned by source, as
// AUDIT LIVED1 T3-T8 pinned the first sixteen.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createPlayerTicker } from '../src/scenes/shared.js';
import {
  setSharedClock, ownMinutes, setOwnMinutes, alignEntityClocks, resetMagicRoundMarker,
  tickPlayerMinutes, playerWeaponHitEntity, playerWeaponKillReported, ownTimeLeftText, ownTimeLeftShort, worldNightfallText, MINUTES_PER_DAY,
  hearSharedClock, worldRegionPricesOn,
} from '../src/systems/worldTick.js';
import { MERCHANTS_FACTION_ID } from '../src/systems/guilds.js';
import { FACTION_TYPES } from '../src/formats/factionFile.js';
import { createRegionConditions, turnOnConditionFlag, conditionFlag, REGION_FLAGS } from '../src/systems/regionConditions.js';
import { createBankAccounts } from '../src/systems/banking.js';
import { NORMALIZE_INTERVAL_MINUTES } from '../src/systems/court.js';
import { createLycanthropyCurse, liveLycanthropy } from '../src/systems/lycanthropy.js';
import { LYCANTHROPY_TYPES } from '../src/systems/infection.js';
import { createVampirismCurse } from '../src/systems/vampirism.js';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { TrainPc } from '../src/systems/quest/actions.js';
import { SKILLS } from '../src/systems/skills.js';
import { RACES } from '../src/systems/races.js';
import { snapshotPlayer, restorePlayer, clampMarkersAheadOf } from '../src/systems/save.js';
import { setSharedWeather, resetWeatherSim, rollClimateWeathersForDay, weatherForClimate, ZONE_CLIMATES, setWeatherMapLaw } from '../src/systems/weatherSim.js';
import { BankWindow } from '../src/ui/bankWindow.js';
import { PORT_SPECS } from '../src/ui/enhancedPorts.js';
import { CharSheet, CHARSHEET_RECTS } from '../src/ui/charsheet.js';

afterEach(() => { setSharedClock(null); resetWeatherSim(); setWeatherMapLaw(false); setSharedWeather(false); });

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const D = MINUTES_PER_DAY, H = 60, N = NORMALIZE_INTERVAL_MINUTES;
const quiet = () => ({ hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say() {} });
function factions() {
  const d = new Map();
  const f = (o) => ({ id: 1, parent: 0, type: FACTION_TYPES.Group, power: 50, rulerPowerBonus: 0, rep: 0, ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0, children: null, region: -1, ...o });
  d.set(MERCHANTS_FACTION_ID, f({ id: MERCHANTS_FACTION_ID, power: 60 }));
  for (let r = 0; r < 4; r++) d.set(9000 + r, f({ id: 9000 + r, type: FACTION_TYPES.Province, region: r, power: 40 + r * 5 }));
  d.set(9100, f({ id: 9100, power: 55 }));
  return { dict: d };
}
const player = (extra = {}) => ({
  isPlayer: true, name: 'P', raceId: RACES.Breton, level: 5, health: 60, maxHealth: 60, magicka: 10, maxMagicka: 10, fatigue: 6000,
  stats: { strength: 50, endurance: 50, willpower: 50, agility: 50, luck: 50, intelligence: 50, personality: 50, speed: 50 },
  skills: 30, skillUses: [], items: [], career: {}, activeEffects: [], factionRep: factions(), regionConditions: createRegionConditions(), ...extra,
});
const powers = (e) => [...e.factionRep.dict.values()].map((f) => `${f.id}:${f.power}`).join(' ');
function online({ own, world, entity = player() }) {
  const t = { clock: world };
  setSharedClock(() => t.clock);
  setOwnMinutes(own);
  entity.lastGameMinutes = Math.floor(own);
  alignEntityClocks(entity, t.clock);
  resetMagicRoundMarker(Math.floor(own));
  return { e: entity, t, ticker: createPlayerTicker(entity) };
}
const P7 = 10080 * 150;   // a 7-day faction-power minute (and a midnight)
const C38 = 54720 * 20;   // a 38-day conditions minute (and a midnight) that is no 7-day minute
const needs = (at) => ({ lastAte: at - 5 * H, thirst: 40, wet: 0, sleepDebt: 1, awakeSince: at - 30, exposure: 0, fed: 0, drunk: 0, rotMinutes: 0, rotDays: 0, stiffUntil: 0, lastMinute: at });

test('AUDIT LIVED1b T3 (the world arms\' ends unfloored): a world power minute crossed in play at the wire\'s own FRACTIONAL readings walks the powers exactly once - as integer readings do', () => {
  const cross = (steps) => {
    const o = online({ own: 90 * D, world: steps[0] });
    for (const c of steps) { o.t.clock = c; o.ticker.tick(1 / 60); }
    return powers(o.e);
  };
  const before = powers(online({ own: 90 * D, world: P7 - 2 }).e);
  const integer = cross([P7 - 2, P7 + 1, P7 + 3]);
  assert.notEqual(integer, before, 'the control: the world\'s power minute walked the powers');
  // sharedClassicMinutes(Date.now()) is a fraction - a fifth of a game minute a real second
  assert.equal(cross([P7 - 2.3, P7 - 1.7, P7 - 0.4, P7 + 0.3, P7 + 0.9, P7 + 1.6, P7 + 2.2, P7 + 3.1]), integer, 'the same boundary, crossed at fractional readings, walked once');
});

test('AUDIT LIVED1b T1 (the tick\'s online answer the world\'s clock, the entry clock, or gone): online the tick answers the character\'s clock AS IT STANDS - an hour raised inside it (the dungeon\'s collapse, `classicMinutesRef.value += 60`) survives the dungeon\'s write-back', () => {
  const { e, t } = online({ own: 300 * D, world: 900 * D, entity: player({ factionRep: null }) });
  let fired = 0;
  const sinks = { ...quiet(), drainFatigue: () => { if (!fired++) setOwnMinutes(ownMinutes() + H); } };
  t.clock += 1;
  const r = tickPlayerMinutes({ entity: e, classicMinutes: ownMinutes(), dt: 1 / 60, sinks });
  assert.ok(fired > 0, 'the minute\'s drain ran inside the tick');
  assert.equal(r.classicMinutes, 300 * D + 1 + H, 'the answer carries the hour');
  setOwnMinutes(r.classicMinutes);   // dungeonContext.js: classicMinutesRef.value = _tick.classicMinutes
  assert.equal(ownMinutes(), 300 * D + 1 + H, 'and the write-back keeps it');
});

test('AUDIT LIVED1b T2 (the world day block walks all of it): the WORLD\'s midnight crossed in play sweeps no room and calls no loan of the character\'s - the landlord and the bank read their own clock', () => {
  const own = 90 * D + 10 * H, world = 700 * D + 23 * H + 59;
  const { e, t, ticker } = online({ own, world, entity: player({ factionRep: null }) });
  e.rentedRooms = [{ mapId: 1, buildingKey: 2, allocatedBedIndex: 0, expiryMinutes: own + 5 * H }];
  e.bankAccounts = createBankAccounts();
  Object.assign(e.bankAccounts[0], { loanTotal: 500, loanDueDate: own + 3 * D });
  t.clock += 2;
  ticker.tick(1 / 60);
  assert.equal(Math.floor(ownMinutes()), own + 2, 'two minutes of play');
  assert.equal(e.rentedRooms.length, 1, 'the room has five of the character\'s hours left');
  assert.deepEqual([e.bankAccounts[0].loanTotal, e.bankAccounts[0].hasDefaulted], [500, false], 'the loan is due in three of the character\'s days');
});

test('AUDIT LIVED1b T6 (the own day block walks the player\'s prices): a rest across the character\'s own midnight walks no price and no price flag - the prices are the world\'s (ECON1), walked on the world\'s day', () => {
  const { e, ticker } = online({ own: 300 * D + 23 * H, world: 900 * D + 12 * H });
  turnOnConditionFlag(e.regionConditions, 0, REGION_FLAGS.PricesHigh, () => 0.5);   // as the world's day left it
  const before = JSON.stringify([e.regionConditions.slice(0, 4), e.regionPrices ?? null]);
  ticker.advance(2 * H);
  assert.equal(Math.floor(ownMinutes()), 301 * D + H);
  assert.equal(JSON.stringify([e.regionConditions.slice(0, 4), e.regionPrices ?? null]), before);
});

test('AUDIT LIVED1b T6 (the conditions on every walk): a rest across the character\'s own 38-day minute moves no faction power and no regional condition - the conditions are the world\'s', () => {
  const { e, ticker } = online({ own: C38 - H, world: 900 * D + 600 });
  const before = [powers(e), JSON.stringify(e.regionConditions.slice(0, 4))];
  ticker.advance(2 * H);
  assert.equal(Math.floor(ownMinutes()), C38 + H);
  assert.deepEqual([powers(e), JSON.stringify(e.regionConditions.slice(0, 4))], before);
});

test('AUDIT LIVED1b T10 (the words unrounded, the nightfall floored): the words round the character\'s fractional clock to whole minutes, and the nightfall rounds its real minutes up', () => {
  setSharedClock(() => 700 * D + 12 * H + 1);   // the world's 12:01: 359 game minutes to dusk, 29.9 real
  setOwnMinutes(100 * D + 0.4);   // a played clock is a fraction
  assert.equal(ownTimeLeftText(100 * D + 20), '20 minutes of your time (2m of play)');
  assert.equal(ownTimeLeftShort(100 * D + 20), '20 minutes');
  assert.equal(worldNightfallText(), 'The sun is the world\'s - night falls in about 30 minutes.');
});

test('AUDIT LIVED1b T10 (the words\' unit boundaries): the words at their unit boundaries - whole hours floored, 48 hours of play said in hours, an hour of play as 1h, a day as 1 day and an hour as 1 hour', () => {
  setSharedClock(() => 700 * D);
  setOwnMinutes(100 * D);
  assert.equal(ownTimeLeftText(100 * D + 3 * D + 5 * H + 30), '3 days 5 hours of your time (6h 28m of play)');
  assert.equal(ownTimeLeftText(100 * D + 24 * D), '24 days of your time (48 hours of play)');
  assert.equal(ownTimeLeftText(100 * D + 12 * H), '12 hours of your time (1h of play)');
  assert.equal(ownTimeLeftShort(100 * D + D), '1 day');
  assert.equal(ownTimeLeftShort(100 * D + H), '1 hour');
});

test('AUDIT LIVED1b T9 (the kill report on the world\'s clock): a werewolf\'s reported kill of an innocent (exteriorFoes\' own call, no clock handed) holds the urge off from the CHARACTER\'s minute', () => {
  const { e } = online({ own: 300 * D + 90, world: 900 * D, entity: player({ factionRep: null }) });
  const lyc = createLycanthropyCurse(e, LYCANTHROPY_TYPES.Werewolf, { now: 0 });
  if (lyc && !e.activeEffects.includes(lyc)) e.activeEffects.push(lyc);
  e.racialOverride = liveLycanthropy(e);
  playerWeaponKillReported(e, { isCivilian: true });
  assert.equal(liveLycanthropy(e).lastKilledInnocent, 300 * D + 90);
});


test('AUDIT LIVED1b T11 (the feeding and TrainPc stamps unfloored): a stamp on the character\'s clock is a whole minute (DFU\'s uint) - the played clock is a fraction, the feeding and a quest\'s training stamp are not', () => {
  const { e } = online({ own: 300 * D + 90.4, world: 900 * D, entity: player({ factionRep: null }) });
  const v = createVampirismCurse(e, 0, { now: 0 });
  playerWeaponHitEntity(e, { isPlayer: false, health: 10, maxHealth: 10, activeEffects: [] });
  assert.equal(v.lastTimeFed, 300 * D + 90, 'a landed blow feeds on a whole minute');
  const machine = new QuestMachine({ nowSeconds: () => 900 * D * 60, raiseTime: () => {}, playerEntity: e, ownMinutes: () => ownMinutes() });
  const act = new TrainPc({ hooks: machine._buildHooks(), showMessagePopup() {}, rolls: () => 0.5 });
  act.skill = SKILLS.Archery;
  act.update(null);
  assert.equal(e.timeOfLastSkillTraining, 300 * D + 90, 'TrainPc stamps a whole minute');
});

test('AUDIT LIVED1b T7 (a legacy save left at the world\'s now): a save from before LIVED1 answers for both clocks - its absence runs from its own minute, so TM-1\'s recovery is paid and SURV7\'s fresh start given', () => {
  const own = 3 * N - D;   // a pre-LIVED1 save: its clock was the world's, and the world's 112-day minute 3N lies a day ahead
  setSharedClock(() => own);
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(player({ factionRep: null, legalRep: [-15], survival: needs(own) }), { classicMinutes: own })));
  delete snap.worldMinutes;   // written before LIVED1
  setSharedClock(() => own + 2 * D);   // two world days later
  const back = player({ factionRep: null });
  restorePlayer(back, snap);
  hearSharedClock();   // AUDIT LIVED1b P4: the absence is paid on the relay's clock
  assert.equal(ownMinutes(), own, 'the character\'s clock is the save\'s');
  assert.equal(back.legalRep[0], -14, 'the absence crossed the world\'s boundary: one point back');
  assert.equal(back.survival.thirst, 0, 'two days away: fed, watered and rested');
});

test('AUDIT LIVED1b T7 (the clamp\'s incubation, feeding and kill uncapped): the legacy clamp brings EVERY marker ahead back - an infection\'s incubation start, the vampire\'s feeding and the werewolf\'s kill', () => {
  const inf = { kind: 'disease', infection: true, startingDay: 3, lastDay: 3 };
  const curse = { racial: 'vampirism', lastTimeFed: 2000, lastKilledInnocent: 1990 };
  assert.equal(clampMarkersAheadOf({ activeEffects: [inf, curse] }, D + 5), 4);
  assert.deepEqual([inf.startingDay, inf.lastDay, curse.lastTimeFed, curse.lastKilledInnocent], [1, 1, D + 5, D + 5]);
});

test('AUDIT LIVED1b T2 (the world day block walks the character\'s half, or is gone): the WORLD\'s midnight crossed in play rolls the six zones from the shared day\'s seed - the day block\'s world half runs on the world\'s window', () => {
  resetWeatherSim(); setWeatherMapLaw(false); setSharedWeather(true);
  const zonesOf = (day) => { rollClimateWeathersForDay(day * D); return ZONE_CLIMATES.map((z) => weatherForClimate(z)); };
  let day = 700;
  while (JSON.stringify(zonesOf(day)) === JSON.stringify(zonesOf(day + 1))) day++;   // two days whose skies differ
  const want = zonesOf(day + 1);
  const { t, ticker } = online({ own: 90 * D + 10 * H, world: day * D + 23 * H + 59 });
  rollClimateWeathersForDay(day * D + 23 * H + 59);   // the arrival's roll of the world's day
  t.clock += 2;
  ticker.tick(1 / 60);
  assert.deepEqual(ZONE_CLIMATES.map((z) => weatherForClimate(z)), want, 'the new world day\'s sky');
});

test('AUDIT LIVED1b T2 (the world day block walks the character\'s half, or is gone): the WORLD\'s midnight crossed in play walks the world\'s price day - a region\'s PricesHigh the world\'s index no longer bears is lifted (the zones alone roll again since K3, so they cannot say it)', () => {
  let day = 700;
  while (!(worldRegionPricesOn(day + 1)[0] >= 500 && worldRegionPricesOn(day + 1)[0] <= 2000)) day++;   // a day the world's index is fair
  const { e, t, ticker } = online({ own: 90 * D + 10 * H, world: day * D + 23 * H + 57 });
  turnOnConditionFlag(e.regionConditions, 0, REGION_FLAGS.PricesHigh, () => 0.5);   // as a dear day left it
  t.clock += 1;
  ticker.tick(1 / 60);
  assert.equal(conditionFlag(e.regionConditions, 0, REGION_FLAGS.PricesHigh), true, 'the control: no midnight, the flag stands');
  t.clock += 3;
  ticker.tick(1 / 60);
  assert.equal(conditionFlag(e.regionConditions, 0, REGION_FLAGS.PricesHigh), false, 'the world\'s fair day lifts it');
});

test('AUDIT LIVED1b T8 (the enhanced bank and ports rows short, the sheet "in now"): a due-by\'s two faces - the classic parchment takes the short words, the enhanced bank row the whole ones (AUDIT LIVED1 P), and the sheet says a due loan is "due now" (L, Q)', () => {
  setSharedClock(() => 900 * D);
  setOwnMinutes(100 * D);
  const accts = createBankAccounts(2);
  Object.assign(accts[0], { loanTotal: 100, loanDueDate: 100 * D + 3 * D });
  const w = new BankWindow({ accounts: () => accts, regionIndex: () => 0, player: { gold: () => 0 }, dueDateText: (m, { short = false } = {}) => (short ? 'SHORT' : 'LONG') });
  const L = w.labels();
  assert.deepEqual([L.loanBy, L.loanByFull], ['SHORT', 'LONG']);
  const row = PORT_SPECS.bank.view(w).blocks[0].items.find((i) => /^Loan due/.test(i[0]));   // AUDIT LIVED1b U4: "Loan due by" offline
  assert.equal(row[1], 'LONG', 'the enhanced face has room for the play');
  Object.assign(accts[1], { loanTotal: 50, loanDueDate: 100 * D - 5 });   // already due on the character's clock
  const sheet = new CharSheet({ name: 'N', level: 1, race: 0, gender: 0, stats: {}, skills: {}, bankAccounts: accts }, {});
  const [gx, gy] = CHARSHEET_RECTS.gold;
  sheet.click(gx + 2, gy + 2);
  const cells = sheet.child.lines.flatMap((l) => (l.cells ?? []).map((c) => c.text));
  assert.ok(cells.includes('due now'), `the sheet says a due loan is due now (${JSON.stringify(cells)})`);
  assert.ok(cells.includes('in 3 days'), 'and one not yet due in the short form');
});

test('AUDIT LIVED1b T4, T5, T8 (23 host and UI reads, by source): every read LIVED1 re-pointed in the hosts and the DOM-mounted windows stands on its clock - the ones AUDIT LIVED1 T3-T8 did not pin', () => {
  const rows = [
    ["src/scenes/world.js", /currentMinute: \(\) => Math\.floor\(playerTicker\.ownMinutes\),   \/\/ AUDIT 23 \(hosts-3\): the poison clock/, "the player's poison clock (w-poison-clock-on-the-worlds)"],
    ["src/scenes/world.js", /_lastEncMinutes = Math\.floor\(playerTicker\.ownMinutes\);   \/\/ X-slice: PreventEnemySpawns parity - no spawn catch-up for the traveled window/, "the journey's encounter marker (w-journey-encounter-marker-on-the-worlds-clock, w-journey-encounter-marker-deleted)"],
    ["src/scenes/world.js", /cureLycanthropy\(playerEntity, \{\n\s*nowMinutes: Math\.floor\(ownMinutes\(\)\),\n\s*advanceMinutes: \(m\) => advanceOwnMinutes\(m\),/, "the lycanthropy cure's stamp and hour (w-cure-quest-stamp-on-the-worlds-clock, w-cure-quest-hour-not-spent)"],
    ["src/scenes/world.js", /racialOverrideBlocks: !!racialRestBlock\(playerEntity, Math\.floor\(ownMinutes\(\)\)\),/, "the party rest's vampire gate (w-party-rest-block-on-the-worlds-clock)"],
    ["src/scenes/exterior.js", /skyMinutes: sharedClockOn\(\) \? Math\.floor\(skyMinutes\(\)\) : null,   \/\/ LIVED1: online the minute/, "the spawn table's hour (ex-spawn-table-reads-the-characters-hour)"],   // TIME1: the sky's own clock; AUDIT TIME (second round): the lone roll's line, the camp roll beside it reads the same
    ["src/scenes/exterior.js", /drinkAtSource\(playerEntity, Math\.floor\(ownMinutes\(\)\)\)\.text\); return true; \};/, "a drink at a spring (ex-drink-on-the-worlds-clock)"],
    ["src/scenes/exterior.js", /const rb = racialRestBlock\(playerEntity, Math\.floor\(ownMinutes\(\)\)\);   \/\/ V2b/, "the vampire's rest gate (ex-rest-gate-on-the-worlds-clock)"],
    ["src/scenes/exterior.js", /now: \(\) => playerTicker\.ownMinutes,   \/\/ V2a: MorphSelf's once-a-day clock/, "MorphSelf (ex-morphself-on-the-worlds-clock)"],
    ["src/scenes/exterior.js", /day: Math\.floor\(playerTicker\.ownMinutes \/ MINUTES_PER_DAY\), regionIndex: dfLocation\.regionIndex \?\? -1,/, "the quest day (ex-quest-day-on-the-worlds-clock)"],
    ["src/scenes/exterior.js", /currentMinute: \(\) => Math\.floor\(playerTicker\.ownMinutes\),   \/\/ AUDIT 23 \(hosts-3\): a guard's poison anchors at NOW, not 0/, "a guard's poison clock (ex-guard-poison-clock-on-the-worlds)"],
    ["src/scenes/worldModes.js", /function showRepairList\(page, ctx\) \{\n    const now = Math\.floor\(ownMinutes\(\)\);/, "the smith's list (wm-repair-list-on-the-worlds-clock)"],
    ["src/scenes/worldModes.js", /function showRepairJobs\(ctx, page = 0\) \{\n    const now = Math\.floor\(ownMinutes\(\)\);/, "the smith's jobs (wm-repair-jobs-on-the-worlds-clock)"],
    ["src/scenes/worldModes.js", /function collectJob\(it, ctx\) \{\n    const now = Math\.floor\(ownMinutes\(\)\);/, "collecting a job (wm-repair-collect-on-the-worlds-clock)"],
    ["src/scenes/worldModes.js", /\} else \{\n      const now = Math\.floor\(ownMinutes\(\)\);\n      \/\/ DFU's commit pass/, "the repair commit (wm-repair-commit-on-the-worlds-clock)"],
    ["src/scenes/worldModes.js", /repairItems: \(\) => repairJobsAt\(playerEntity, b\.buildingKey \?\? 0, Math\.floor\(ownMinutes\(\)\)\),\n\s*nowMinutes: \(\) => Math\.floor\(ownMinutes\(\)\),/, "the enhanced smith (wm-enhanced-smith-jobs-on-the-worlds-clock, wm-enhanced-smith-now-on-the-worlds-clock)"],
    ["src/scenes/worldModes.js", /now: \(\) => Math\.floor\(ownMinutes\(\)\),\n\s*ownTimeOf: \(m\) => ownTimeLeftText\(m\),/, "the tavern's room clock (wm-tavern-room-on-the-worlds-clock)"],
    ["src/scenes/worldModes.js", /const m = joinGuild\(memberships, guild, Math\.floor\(ownMinutes\(\)\)\);/, "a guild join (wm-guild-join-on-the-worlds-clock)"],
    ["src/scenes/worldModes.js", /steps: \(\) => onPushEffects\(playerEntity, guild, memberships, store, ownDate\(\), \{/, "the rank steps (wm-guild-steps-on-the-worlds-date)"],
    ["src/scenes/dungeonContext.js", /get classicMinutes\(\) \{ return worldMinutes\(\); \},/, "the music's day (dc-music-day-on-the-characters-clock)"],
    ["src/ui/enhancedHud.js", /import \{ ownMinutes(?:, sharedClockOn)? \} from '\.\.\/systems\/worldTick\.js';[^\n]*\n[\s\S]*survivalHudChips\(vitals, Math\.floor\(ownMinutes\(\)\),/,"the needs strip reads the character's clock (ui-hud-needs-on-the-worlds-clock)"],
    ["src/ui/enhancedTavern.js", /const t = deps\.ownTimeOf\?\.\(expiry\);/, "the enhanced offer says the room in the character's time (ui-enhanced-tavern-no-own-time)"],
    ["src/ui/enhancedTavern.js", /gameMinutes: h\.worldNow\?\.\(\) \?\? now \}\);/, "the enhanced meal's holiday is the world's (ui-enhanced-tavern-meal-holiday-own)"],
    ["src/ui/enhancedTavern.js", /hour: Math\.trunc\(\(\(\(h\.worldNow\?\.\(\) \?\? now\) % 1440\) \+ 1440\) % 1440 \/ 60\) \}\);/, "the enhanced kitchen keeps the world's hours (ui-enhanced-tavern-kitchen-own)"],
  ];
  for (const [file, re, what] of rows) assert.match(rd(file), re, `${file}: ${what}`);
});

test('AUDIT LIVED1b (DISC10-E V9, its kill lost with WORLD5\'s shift): a hole in the effects list is no curse - liveLycanthropy steps over it, as liveVampirism does (AUDIT WORLD5); the arrival\'s shift LIVED1 retired was the only road that fed it one', () => {
  const curse = { kind: 'racialOverride', racial: 'lycanthropy' };
  assert.equal(liveLycanthropy({ activeEffects: [null, curse] }), curse, 'past the hole, the curse');
  assert.equal(liveLycanthropy({ activeEffects: [null, undefined] }), null, 'a list of holes holds no curse');
});
