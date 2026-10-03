// AUDIT LIVED1 (2026-09-29, Mac: "Lets do an audit on this") - the six lanes' findings over LIVED1's frozen tree
// (1e12a3e6), each reproduced before it was fixed, pinned here by a test that FAILS on the unfixed tree for the
// finding's reason, and mutation-proven (tools/mutants/auditlived1.json). The record: bible/01-Overview/Audit-Lived1.md.
// Lanes: K the clock core, R every reader's clock, S the save and the lifecycle, P party, sharing and exploits,
// U the words and the UI, T the record, the pins and the mutants. A finding more than one lane found carries every ID.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createPlayerTicker } from '../src/scenes/shared.js';
import {
  setSharedClock, worldMinutes, ownMinutes, setOwnMinutes, alignEntityClocks, skipDeadMinutes, resetMagicRoundMarker,
  runMagicRoundsFor, claimMagicRounds, advanceOwnMinutes, tickInFlight, ownTimeLeftText, ownTimeLeftShort, playerWeaponHitEntity, MINUTES_PER_DAY,
} from '../src/systems/worldTick.js';
import { MERCHANTS_FACTION_ID } from '../src/systems/guilds.js';
import { FACTION_TYPES } from '../src/formats/factionFile.js';
import { createRegionConditions } from '../src/systems/regionConditions.js';
import { setSharedWeather, resetWeatherSim, rollClimateWeathersForDay, weatherForClimate, ZONE_CLIMATES, setWeatherMapLaw } from '../src/systems/weatherSim.js';
import { createLycanthropyCurse, liveLycanthropy } from '../src/systems/lycanthropy.js';
import { LYCANTHROPY_TYPES } from '../src/systems/infection.js';
import { createVampirismCurse } from '../src/systems/vampirism.js';
import { isFullMoonFromMinutes } from '../src/systems/gameDate.js';
import { SPECIAL_ABILITY_BITS } from '../src/systems/specialAdvantages.js';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { TrainPc } from '../src/systems/quest/actions.js';
import { Clock } from '../src/systems/quest/clock.js';
import { SKILLS } from '../src/systems/skills.js';
import { snapshotPlayer, restorePlayer, clampMarkersAheadOf } from '../src/systems/save.js';
import { offlineCopyOf, onlineCopyOf, QUEST_WORLD_SECOND_KEYS, QUEST_OWN_SECOND_KEYS } from '../src/systems/offlineCopy.js';
import { startDisease, DISEASES } from '../src/systems/diseases.js';
import { NORMALIZE_INTERVAL_MINUTES } from '../src/systems/court.js';
import { bankingStatusRows } from '../src/systems/banking.js';
import { repairReadyLine } from '../src/ui/enhancedTrade.js';
import { restClockLine } from '../src/ui/restWindow.js';
import { TavernWindow, TAVERN_RECTS, TAVERN_PANEL_X, TAVERN_PANEL_Y, OWN_TIME_ROOM, OWN_TIME_ROOM_NOTE } from '../src/ui/tavernWindow.js';
import { RACES } from '../src/systems/races.js';

afterEach(() => { setSharedClock(null); resetWeatherSim(); setWeatherMapLaw(false); setSharedWeather(false); });

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const D = MINUTES_PER_DAY, H = 60;
const quiet = () => ({ hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say() {} });
/** A faction store with the Merchants and four provinces, as the day block's world half and the power walks read it. */
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
/** Online: the world's clock at `world`, the character's at `own`, the arrival made. */
function online({ own, world, entity = player() }) {
  const t = { clock: world };
  setSharedClock(() => t.clock);
  setOwnMinutes(own);
  entity.lastGameMinutes = Math.floor(own);
  alignEntityClocks(entity, t.clock);
  resetMagicRoundMarker(Math.floor(own));
  return { e: entity, t, ticker: createPlayerTicker(entity) };
}
const P7 = 10080 * 150;   // a 7-day faction-power minute (and a midnight) on either clock

test('AUDIT LIVED1 T1: the WORLD\'s half walks the world\'s minutes alone - a rest across the character\'s own power minute and midnight moves no faction power and rolls no zone; a world power minute crossed in play walks the powers once', () => {
  resetWeatherSim(); setWeatherMapLaw(false); setSharedWeather(true);
  const world = P7 + 3 * D + 600;   // the world three days past the boundary, its own day far from a midnight
  const { e, ticker } = online({ own: P7 - 60, world });
  rollClimateWeathersForDay(Math.floor(world));
  const zones = ZONE_CLIMATES.map((z) => weatherForClimate(z));
  const before = powers(e);
  ticker.advance(2 * H);   // a two-hour rest across the character's own power minute and midnight
  assert.equal(Math.floor(ownMinutes()), P7 + 60);
  assert.equal(powers(e), before, 'the powers are the world\'s, and the world did not move');
  assert.deepEqual(ZONE_CLIMATES.map((z) => weatherForClimate(z)), zones, 'the six zones are the world\'s day\'s, and the world\'s day did not change');
  // the world's own boundary, crossed in play, walks them - once
  const cross = (steps) => {
    const o = online({ own: 90 * D, world: steps[0] });
    for (const c of steps) { o.t.clock = c; o.ticker.tick(1 / 60); }
    return powers(o.e);
  };
  const clean = cross([P7 - 2, P7 + 1.5, P7 + 2, P7 + 3]);
  assert.notEqual(clean, before, 'the world\'s power minute walked the powers');
  // AUDIT LIVED1 I (K1): a reading that steps back across it (a machine's clock set back, a relay correction) walks
  // them no second time - the world's arms keep their own high-water mark
  assert.equal(cross([P7 - 2, P7 + 1.5, P7 - 0.5, P7 + 2, P7 + 3]), clean, 'the stepped-back reading walks the boundary once');
});

test('AUDIT LIVED1 T2: a death across the world\'s power minute walks it at the rise - once, as a lived crossing does - and a second rise walks nothing', () => {
  const lived = online({ own: 90 * D, world: P7 - 5 });
  lived.ticker.tick(1 / 60);
  lived.t.clock = P7 + 5; lived.ticker.tick(1 / 60);
  const walked = powers(lived.e);
  setSharedClock(null);
  const { e, t, ticker } = online({ own: 90 * D, world: P7 - 5 });
  ticker.tick(1 / 60);
  const before = powers(e);
  e.health = 0; t.clock = P7 + 5;   // the world runs on under the death screen
  assert.equal(skipDeadMinutes(e, t.clock), true);
  assert.notEqual(powers(e), before, 'the rise walked the world\'s half of the dead span');
  assert.equal(powers(e), walked, '...as a crossing in play walks it');
  skipDeadMinutes(e, t.clock);
  assert.equal(powers(e), walked, 'and a second rise walks nothing');
  // AUDIT LIVED1 I: a correction that lowers the reading (the relay's offset, alignEntityClocks) walks nothing again
  alignEntityClocks(e, P7 - 3);
  skipDeadMinutes(e, t.clock);
  assert.equal(powers(e), walked, 'the world\'s arms keep their high-water mark across a correction and a rise');
  assert.equal(Math.floor(ownMinutes()), 90 * D, 'the character\'s clock stood through it all');
});

test('AUDIT LIVED1 T5 + A (K2/S1/R3): the moon and the sun a round reads are the WORLD\'s - on the tick\'s path and the dungeon rest arm\'s', () => {
  let ownFull = null, worldNot = null, worldFull = null, ownNot = null;
  for (let d = 400; d < 800 && ownFull == null; d++) if (isFullMoonFromMinutes(d * D + 2 * H)) ownFull = d * D + H;
  for (let d = 900; d < 1300 && worldNot == null; d++) if (!isFullMoonFromMinutes(d * D + 12 * H) && !isFullMoonFromMinutes(d * D + 20 * H)) worldNot = d * D + 12 * H;
  // TIME2: online the full moon forces its NIGHT - from the dusk of a full-moon date - so the world's full moon is read
  // at 20:00 of that date (its 01:00 belongs to the night before it, which is no full moon)
  for (let d = 900; d < 1300 && worldFull == null; d++) if (isFullMoonFromMinutes(d * D + 2 * H)) worldFull = d * D + 20 * H;
  for (let d = 400; d < 800 && ownNot == null; d++) if (!isFullMoonFromMinutes(d * D + H) && !isFullMoonFromMinutes(d * D + 2 * H)) ownNot = d * D + H;
  const wolf = (own, world) => {
    const o = online({ own, world, entity: player({ factionRep: null }) });
    const lyc = createLycanthropyCurse(o.e, LYCANTHROPY_TYPES.Werewolf, { now: own - 60 });
    if (lyc && !o.e.activeEffects.includes(lyc)) o.e.activeEffects.push(lyc);
    o.e.racialOverride = liveLycanthropy(o.e);
    return o;
  };
  const tickPath = (own, world) => { const o = wolf(own, world); o.t.clock += 10; o.ticker.tick(1 / 60); return !!liveLycanthropy(o.e)?.isTransformed; };
  assert.equal(tickPath(ownFull, worldNot), false, 'the character\'s own full moon forces no change under the world\'s sky');
  assert.equal(tickPath(ownNot, worldFull), true, 'the world\'s full moon does (TIME2: up, in its night)');
  // the dungeon's rest arm runs its rounds itself (dungeonContext.js _restAdvance): the same law through its call
  const dungeonArm = (own, world) => {
    const o = wolf(own, world);
    const end = ownMinutes() + 10, start = Math.floor(end) - 10;
    advanceOwnMinutes(10);
    const w = claimMagicRounds(start, end);
    runMagicRoundsFor(o.e, w.from, w.to, { sinks: quiet(), say: () => {}, skyMinutes: Math.floor(worldMinutes()) });
    return !!liveLycanthropy(o.e)?.isTransformed;
  };
  assert.equal(dungeonArm(ownFull, worldNot), false, 'the dungeon rest arm, handed the world\'s sky');
  assert.match(rd('src/scenes/dungeonContext.js'), /runMagicRoundsFor\(playerEntity, _w\.from, _w\.to, \{ sinks: playerSinks, say: \(msg\) => hudText\.add\(msg\), skyMinutes: sharedClockOn\(\) \? Math\.floor\(skyMinutes\(\)\) : null \}\);/, 'and the arm (TIME1: the sky\'s own clock) hands it');
  // the sun-damaged career's light
  const burn = (own, world) => {
    const o = online({ own, world, entity: player({ factionRep: null, career: { abilityFlagsAndSpellPointsBitfield: SPECIAL_ABILITY_BITS.sunDamage } }) });
    o.t.clock += 16; o.ticker.tick(1 / 60);
    return o.e.health < 60;
  };
  assert.equal(burn(500 * D, 900 * D + 12 * H), true, 'the world\'s noon burns, whatever the character\'s hour');
  assert.equal(burn(500 * D + 12 * H, 900 * D), false, 'the world\'s midnight does not, whatever the character\'s hour');
});

test('AUDIT LIVED1 B (P1/S2/R1) + D (R2/P5): a quest\'s disease and a quest\'s training are stamped on the CHARACTER\'s clock', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /makePcDiseased: \(diseaseType\) => \{ startDisease\(playerEntity, diseaseType, Math\.floor\(ownMinutes\(\) \/ 1440\)\); surfacePlayer\(\); \},/, 'the disease\'s day is the character\'s');
  assert.match(w, /ownMinutes: \(\) => ownMinutes\(\),   \/\/ AUDIT LIVED1 D/, 'the host hands the quests the character\'s clock');
  for (const [own, world] of [[700000 + 600, 700000 + 84 * D + 600], [700000 + 3 * D + 600, 700000 + 600]]) {
    const { e } = online({ own, world, entity: player({ health: 200, maxHealth: 200, factionRep: null }) });
    const machine = new QuestMachine({ nowSeconds: () => worldMinutes() * 60, raiseTime: (s) => advanceOwnMinutes(s / 60), playerEntity: e, ownMinutes: () => ownMinutes() });
    const act = new TrainPc({ hooks: machine._buildHooks(), showMessagePopup() {}, rolls: () => 0.5 });
    act.skill = SKILLS.Archery;
    act.update(null);
    assert.equal(e.timeOfLastSkillTraining, Math.floor(own), `TrainPc stamps the character's minute (own ${own}, world ${world})`);
    assert.equal(Math.floor(ownMinutes()), Math.floor(own) + 180, '...and its three hours are theirs');
  }
});

test('AUDIT LIVED1 C (R4/P4): the temple\'s free and half-price cure days are the WORLD\'s calendar; training\'s cooldown stays the character\'s', () => {
  const m = rd('src/scenes/worldModes.js');
  const cure = m.slice(m.indexOf('flow = buildCureDiseaseFlow('), m.indexOf('flow = buildCureDiseaseFlow(') + 700);
  assert.match(cure, /rows, now: \(\) => skyMinutes\(\), onClose/, 'the cure flow reads the world\'s holiday');   // TIME1: the sky's calendar
  assert.match(m, /const now = \(\) => interiorTicker\.ownMinutes;   \/\/ already CLASSIC minutes/, 'the service flows\' own clock (training) stays the character\'s');
});

test('AUDIT LIVED1 E (S3/R5, S5/U4) + G (R6): the doors between the lanes rebase the WORLD\'s stamps onto the clock they will be read on', () => {
  const own = 50 * D, world = 230 * D, delta = own - world;
  const clock = new Clock({ nowSeconds: () => world * 60 });
  Object.assign(clock, { clockEnabled: true, startingTimeInSeconds: 3 * D * 60, remainingTimeInSeconds: 3 * D * 60 });
  clock._lastWorldTimeSample = world * 60;
  const snap = {
    classicMinutes: own, worldMinutes: world,
    quest: { quests: [{ questStartTime: world * 60 - 600, questTombstoneTime: 0, resources: [{ clock: clock.getSaveData() }], actions: [{ actionSpecific: { lastSpawnTime: 0, lastTimePlayed: world * 60 - 30 } }] }] },
    talk: { listRumorMill: [{ timeLimit: world + 1000 }, { timeLimit: 0 }] },
    spawns: [['k', world - 100, world - 50], ['j', world - 10]],
    world: { camps: [{ litUntil: world + 480, placedAt: world - 5 }] },
  };
  const off = offlineCopyOf(snap);
  assert.equal(off.worldMinutes, undefined, 'the offline copy says nothing of the world it leaves - every card reads the one clock');
  const q = off.quest.quests[0];
  assert.deepEqual([q.questStartTime, q.questTombstoneTime, q.resources[0].clock.lastWorldTimeSample, q.actions[0].actionSpecific.lastSpawnTime, q.actions[0].actionSpecific.lastTimePlayed],
    [(world + delta) * 60 - 600, 0, own * 60, 0, (world + delta) * 60 - 30], 'the quest\'s world seconds, by the distance - a zero stays "never"');
  assert.deepEqual(off.talk.listRumorMill.map((r) => r.timeLimit), [own + 1000, 0]);
  assert.deepEqual(off.spawns, [['k', own - 100, own - 50], ['j', own - 10]]);
  assert.deepEqual([off.world.camps[0].litUntil, off.world.camps[0].placedAt], [own + 480, own - 5]);
  assert.equal(snap.worldMinutes, world, 'the realm\'s save itself is untouched');
  // TIME3: a guard's arrival is a countdown's stamp - the character's clock since TIME3, the world's in an envelope from before it
  assert.ok(QUEST_OWN_SECOND_KEYS.includes('guardAnchor') && !QUEST_WORLD_SECOND_KEYS.includes('guardAnchor'));
  // end to end: the quest's three days stay three days on the offline clock
  const offClock = new Clock({ nowSeconds: () => own * 60 });
  offClock.restoreSaveData(off.quest.quests[0].resources[0].clock);
  offClock.tick({ nowSeconds: () => (own + 60) * 60, questClockStepMax: () => Infinity });
  assert.equal(offClock.remainingTimeInSeconds, (3 * D - 60) * 60, 'an hour offline is an hour off the clock - not the half year between the clocks');
  // BRING ONLINE, the mirror: the offline stamps onto the world's clock, and the join says it left the world just now
  const worldNow = 400 * D + 17;
  const on = onlineCopyOf({ classicMinutes: own, spawns: [['k', own - 100]], world: { camps: [{ litUntil: own + 480 }] } }, worldNow);
  assert.equal(on.worldMinutes, Math.floor(worldNow));
  assert.deepEqual([on.spawns[0][1], on.world.camps[0].litUntil], [Math.floor(worldNow) - 100, Math.floor(worldNow) + 480]);
  // ...so the first join pays no absence the character never had (TM-1's recovery, SURV7's fresh start)
  const N = NORMALIZE_INTERVAL_MINUTES;
  const offlineSave = { classicMinutes: 2 * N + 100, legalRep: { 0: -15 }, items: [], stats: {} };
  const joined = onlineCopyOf(JSON.parse(JSON.stringify(snapshotPlayer({ ...player({ factionRep: null }), legalRep: [-15] }, { classicMinutes: offlineSave.classicMinutes }))), 5 * N + 100);
  setSharedClock(() => 5 * N + 130);
  const back = player({ factionRep: null });
  restorePlayer(back, joined);
  assert.equal(back.legalRep[0], -15, 'three of the world\'s boundaries lay between the calendars, and none of them was an absence');
  const m = rd('src/ui/enhancedMenu.js');
  assert.match(m, /snap = offlineCopyOf\(snap\);/, 'Copy to offline goes through the door');
  assert.match(m, /const copy = onlineCopyOf\(snap, sharedClassicMinutes\(Date\.now\(\)\)\);/, 'and so does Bring online');
  assert.equal((m.match(/const date = Number\.isFinite\(snap\.classicMinutes\) \? dateFromClassicMinutes\(snap\.classicMinutes\) : null;/g) ?? []).length, 2, 'both cards read the one clock the slot loads at (E: S5/U4)');
});

test('AUDIT LIVED1 F (K3/S4): a save from before LIVED1 whose disease day sat ahead of its clock is brought back to it - no day given back and rolled again', () => {
  const own = 700 * D + 600;
  const live = player({ factionRep: null });
  const entry = startDisease(live, DISEASES.CalironsCurse, 701, () => 0.5);   // the RESTX2 rest crossed a simulated midnight
  const left0 = entry.daysOfSymptomsLeft;
  setSharedClock(() => own);
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(live, { classicMinutes: own })));
  delete snap.worldMinutes;   // written before LIVED1
  setSharedClock(null);
  const t = { clock: own + 5 };
  setSharedClock(() => t.clock);
  const back = player({ factionRep: null });
  restorePlayer(back, snap);
  const d = back.activeEffects.find((a) => a.kind === 'disease');
  assert.equal(d.lastDay, 700, 'the day ahead of the clock is brought back to it');
  resetMagicRoundMarker(own);
  const ticker = createPlayerTicker(back);
  t.clock += 5; ticker.tick(1 / 60);
  assert.equal(d.daysOfSymptomsLeft, left0, 'no day given back');
  assert.equal(clampMarkersAheadOf({ activeEffects: [{ kind: 'poison', lastMinute: 100 }, { racial: 'lycanthropy', lastUrgeNotify: 90 }] }, 80), 2, 'a poison\'s minute and a curse\'s too');
});

test('AUDIT LIVED1 H (P2): the party mirror\'s night carries the follower\'s encounter marker with it - the first frame up rolls no night as walking minutes', () => {
  // AUDIT LIVED1b P1: the marker now rides the loop itself - the mirror walks each sub-tick through it, the wanderers left out
  assert.match(rd('src/scenes/world.js'), /advanceMinutes: \(n\) => \{ playerTicker\.advance\(n\); runEncounterTick\(walkMode && playerSpawned \? player\.pos : cam\.pos, true, \{ spawns: false \}\); \},/);
});

test('AUDIT LIVED1 J (K6): an hour raised from INSIDE a tick is a bare move of the character\'s clock - no nested tick runs its rounds ahead of the window in hand', () => {
  const { e, t } = online({ own: 300 * D, world: 900 * D });
  let ticks = 0, inside = null;
  let ticker = null;
  ticker = createPlayerTicker(e, { onExhausted: () => { inside = tickInFlight(); ticker.advance(H); } });
  ticker.subscribe(() => { ticks++; });
  e.fatigue = 1;   // the minute's drain empties it inside the tick
  t.clock += 1;
  ticker.tick(1 / 60);
  assert.equal(inside, true, 'the collapse fired inside the tick');
  // AUDIT LIVED1b K1: ...and its walk is the ticker's catch-up the moment the window in hand is done - a second tick,
  // AFTER the first (never inside it), in the same frame, so no save can come between the raise and its walk
  assert.equal(ticks, 2, 'the window in hand, then the raise\'s own walk - no tick inside a tick');
  assert.equal(e.lastGameMinutes, Math.floor(ownMinutes()), 'the hour walked this frame');
  assert.equal(Math.floor(ownMinutes()), 300 * D + 1 + H, 'and the hour is the character\'s');
  assert.equal(tickInFlight(), false);
});

test('AUDIT LIVED1 L/P/Q (K5, U5, U6/R7): a due-by says the time left in words that fit - "due now" at or past it, the short form where the classic labels have no room for the play', () => {
  setSharedClock(() => 900 * D);
  setOwnMinutes(100 * D);
  assert.equal(ownTimeLeftShort(100 * D + 359 * D + 22 * H), '359 days');
  assert.equal(ownTimeLeftShort(100 * D + 5 * H + 10), '5 hours');
  assert.equal(ownTimeLeftShort(100 * D + 20), '20 minutes');
  assert.equal(ownTimeLeftShort(100 * D), 'now');
  assert.equal(ownTimeLeftText(100 * D + 7 * D), '7 days of your time (14h of play)', 'the long form stands');
  const rows = bankingStatusRows([{ accountGold: 5, loanTotal: 100, loanDueDate: 100 * D + 360 * D, hasDefaulted: false }], { regionName: () => 'Daggerfall', dueText: (m) => `in ${ownTimeLeftShort(m)}` });
  assert.equal(rows[2].cells[3].text, 'in 360 days', 'the sheet\'s due column takes the host\'s words');
  setSharedClock(null);
  assert.equal(ownTimeLeftShort(900), null, 'offline DFU says its dates');
  const m = rd('src/scenes/worldModes.js');
  assert.match(m, /if \(left === 'now'\) return short \? 'now' : 'due now';/);   // AUDIT LIVED1b U3: the parchment paints "Loan due by:" itself
  assert.match(m, /const own = short \? \(left && `\$\{left\} of your time`\) : ownTimeLeftText\(minutes\);/);
  assert.match(rd('src/ui/bankWindow.js'), /loanBy: this\.hooks\.dueDateText\?\.\(loanDueDate\(a, r\), \{ short: true \}\) \?\? '',/);
  assert.match(rd('src/ui/charsheet.js'), /dueText: loanDueShort \}\),/);
});

test('AUDIT LIVED1 M/N/O/S (U1, U2, U3, U8): the words fit their screens - the nightfall on its own HUD row, the tavern\'s own-time offer in two rows, the default skin\'s rest card says the clock line, and a loiter waits', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /function sayWithNightfall\(text\) \{ townTalk\.say\(text\); const nf = worldNightfallText\(\); if \(nf\) townTalk\.say\(nf\); \}/);
  assert.equal((w.match(/sayWithNightfall\(sunlightTravelText\(\)\);|sayWithNightfall\(ftb\.text\);/g) ?? []).length, 2, 'both map-door rungs');
  // the classic tavern: two rows, split at the play's bracket
  const own = 200 * D + 10 * H;
  const tav = new TavernWindow({
    entity: { name: 'Rin', health: 20, maxHealth: 50, rentedRooms: [], goldPieces: 5000, items: [], stats: { personality: 50 } },
    rows: (id) => [{ text: `#${id}`, center: true }], now: () => own, mapId: () => 7, buildingKey: () => 42, buildingName: () => 'The Dancing Dagger', quality: () => 10, bedCount: () => 4,
    freeRooms: () => false, skills: () => ({ mercantile: 50, personality: 50 }), heal() {}, onTalk() {}, onClose() {}, rolls: () => 0.5,
    ownTimeOf: () => '2 days 20 hours of your time (5h 43m of play)',
  });
  const [x, y, rw, rh] = TAVERN_RECTS.room;
  tav.click(TAVERN_PANEL_X + x + rw / 2, TAVERN_PANEL_Y + y + rh / 2);
  for (let i = 0; i < 12; i++) tav.flow.input('backspace');
  tav.flow.input('char:3'); tav.flow.input('Enter');
  assert.deepEqual(tav.flow.top.rows.slice(1).map((r) => r.text), [`${OWN_TIME_ROOM} 2 days 20 hours of your time`, `(5h 43m of play)${OWN_TIME_ROOM_NOTE}`]);
  assert.equal(restClockLine(900 * D + 15 * H + 5, { loiter: true }), 'World time 15:05 - you wait on your own clock');
  assert.equal(restClockLine(900 * D + 15 * H + 5), 'World time 15:05 - you rest on your own clock');
  const er = rd('src/ui/enhancedRest.js');
  assert.match(er, /_restingRefs\.clockLine\.textContent = Number\.isFinite\(wm\) \? restClockLine\(wm, \{ loiter: overlay\.mode === 'loiter' \}\) : '';/);
  assert.match(rd('src/ui/restWindow.js'), /lines\.push\(restClockLine\(st\.worldMinutes, \{ loiter: this\.mode === 'loiter' \}\)\);/);
});

test('AUDIT LIVED1 T3/T4/T6/T7/T8 + V: by source, every host read LIVED1 re-pointed stands on its clock - the save\'s clock, the journey\'s days, the personal reads, the sky and calendar feeds', () => {
  const w = rd('src/scenes/world.js'), m = rd('src/scenes/worldModes.js'), dc = rd('src/scenes/dungeonContext.js'), sh = rd('src/scenes/shared.js');
  // T3: the save's clock is the character's, in both composers
  assert.match(w, /classicMinutes: Math\.floor\(playerTicker\.ownMinutes\),   \/\/ LIVED1: the save's clock is the character's own/);
  // T4: the journey's advance is unguarded - online too
  const at = w.indexOf('setSyntheticTimeIncrease(true); playerTicker.advance(computed.minutes);');
  assert.ok(at > 0, 'the journey advances the traveller\'s clock');
  const before = w.slice(w.lastIndexOf('\n', w.lastIndexOf('\n', at) - 1), at).split('\n').filter((l) => l.trim() && !l.trim().startsWith('//'));
  assert.ok(!/sharedClockOn/.test(before.join('\n')) && !/sharedClockOn/.test(w.slice(at, w.indexOf('\n', at))), 'no lane guard stands over it');
  // T6 / T8: the personal reads
  const personal = [
    [w, /now: \(\) => playerTicker\.ownMinutes,   \/\/ V2a: MorphSelf's once-a-day clock/, 'MorphSelf'],
    [w, /setCrimeGuildClock\(\(\) => Math\.floor\(playerTicker\.ownMinutes\)\);/, 'the letters'],
    [w, /const rb = racialRestBlock\(playerEntity, Math\.floor\(ownMinutes\(\)\)\);/, 'the vampire\'s rest gate'],
    [w, /cureVampirism\(playerEntity, \{ advanceMinutes: \(m\) => advanceOwnMinutes\(m\) \}\)/, 'the cure\'s minute (AUDIT LIVED1b D3)'],
    [w, /!!q\?\.questSuccess, dateFromClassicMinutes\(playerTicker\.ownMinutes\), _questStore\(\)\);/, 'a quest\'s join date'],
    [w, /drinkAtSource\(playerEntity, Math\.floor\(ownMinutes\(\)\)\)\.text/, 'a drink at a source'],
    [m, /const rb = racialRestBlock\(playerEntity, Math\.floor\(interiorTicker\.ownMinutes\)\);   \/\/ V2b/, 'the interior vampire rest gate'],
    [m, /const ownDate = \(\) => dateFromClassicMinutes\(interiorTicker\.ownMinutes\);/, 'the rank wait and join'],
    [m, /level: \(\) => playerEntity\.level \?\? 1,\s*\n\s*now: \(\) => Math\.floor\(ownMinutes\(\)\),/, 'the bank\'s loan stamp'],
    [m, /nowMinutes: Math\.floor\(ownMinutes\(\)\),\s*\n\s*rounds: rounds \?\? 0,/, 'a conjured item\'s hour'],
    [m, /deductGold\(playerEntity, price\);\s*\n\s*const now = Math\.floor\(ownMinutes\(\)\);/, 'the smith\'s booking (MAC-BUG3\'s intent)'],
    [m, /playerEntity\.rentedRooms \?\? \[\], Math\.floor\(ownMinutes\(\)\), sceneCache\(\)\);/, 'the rest\'s own door of the landlord'],
    [m, /nowMinutes: Math\.floor\(ownMinutes\(\)\),\s*\n\s*\/\/ Interior\.FindMarkers/, 'the rest place\'s rented hours'],
    [sh, /nowMinutes: \(\) => Math\.floor\(ownMinutes\(\)\),\s*\n\s*playVideo\(name, onClose\) \{/, 'the satiation stamp at the turn (DISC10 V9\'s intent)'],
    [dc, /nowMinute: \(\) => Math\.floor\(ownMinutes\(\)\),   \/\/ AUDIT 21 F2: the one clock; LIVED1: a meal, a dose/, 'the dungeon\'s meals and doses'],
  ];
  for (const [src, re, what] of personal) assert.match(src, re, `${what} reads the character's clock`);
  // T7: the sky's and the calendar's feeds
  assert.match(w, /skyMinutes: sharedClockOn\(\) \? Math\.floor\(skyMinutes\(\)\) : null/, 'the encounter roll\'s table reads the world\'s hour');   // TIME1: the sky's own clock
  assert.match(rd('src/ui/enhancedTavern.js'), /date: \{ dayOfYear: dayOfYearFromMinutes\(deps\.worldNow\?\.\(\) \?\? now\) \}/, 'the enhanced tavern\'s Heart\'s Day');
  const tw = rd('src/ui/tavernWindow.js');
  assert.match(tw, /hour: Math\.trunc\(\(\(\(h\.worldNow\?\.\(\) \?\? now\) % 1440\) \+ 1440\) % 1440 \/ 60\)/, 'the kitchen\'s hours');
  assert.match(tw, /gameMinutes: h\.worldNow\?\.\(\) \?\? now \}\);/, 'the meal\'s holiday');
  assert.match(dc, /const wm = skyMinutes\(\)/, 'the dungeon\'s air');   // TIME1: the sky's
  // V (P6): a foe's poison off the wire resumes at this host's now
  assert.match(dc, /\.\.\.\(wire && Number\.isFinite\(a\.lastMinute\) \? \{ lastMinute: Math\.floor\(ownMinutes\(\)\) \} : \{\}\)/);
});

test('AUDIT LIVED1 T6: the feeding stamp\'s default is the character\'s clock, and the smith\'s ready line says their time', () => {
  const { e } = online({ own: 300 * D + 90, world: 900 * D, entity: player({ factionRep: null }) });
  const v = createVampirismCurse(e, 0, { now: 0 });
  playerWeaponHitEntity(e, { isPlayer: false, health: 10, maxHealth: 10, activeEffects: [] });
  assert.equal(v.lastTimeFed, 300 * D + 90, 'a landed blow feeds the vampire on their own clock');
  assert.equal(repairReadyLine({ doneAt: 300 * D + 90 + 3 * D }), 'Ready in 3 days of your time (6h of play).');
});
