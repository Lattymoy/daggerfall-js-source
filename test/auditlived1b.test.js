// AUDIT LIVED1b (2026-09-29, Mac: "Lets do a comprehensive audit on this") - the second audit of LIVED1 (your own time
// online) and of the first audit's fixes: eleven lanes over the frozen tree 322b1735 (bible/01-Overview/Audit-Lived1b.md).
// Each test pins one fix, driving the real modules the way the lane that found it reproduced it; each fix is also
// mutation-proven (tools/mutants/auditlived1b.json).
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPlayerTicker } from '../src/scenes/shared.js';
import {
  setSharedClock, setWorldMinutes, worldMinutes, skyMinutes, ownMinutes, setOwnMinutes, advanceOwnMinutes, sharedClockOn,
  alignEntityClocks, skipDeadMinutes, resetMagicRoundMarker, ownTimeLeftText, MINUTES_PER_DAY, tickInFlight,
  worldArmsPieces, hearSharedClock, sharedClockHeard, payAbsenceWhenHeard, worldMinutesToSave, ownWalkWaiting,
  normalizeAcross, NORMALIZE_ACROSS_MAX,
} from '../src/systems/worldTick.js';
import * as WT from '../src/systems/worldTick.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { offlineCopyOf, onlineCopyOf, saneSaveClock, SAVE_CLOCK_MAX, RAID_RECORD_VENDOR } from '../src/systems/offlineCopy.js';
import { checkpointAllowed } from '../src/systems/onlineCheckpoint.js';
import { createQuestBridge, QUEST_CTX_CONTRACT } from '../src/scenes/questBridge.js';
import { TrainPc } from '../src/systems/quest/actions.js';
import { SKILLS } from '../src/systems/skills.js';
import { dayShelf, createStockedDate, needsRestock } from '../src/systems/shopStock.js';
import { dateFromClassicMinutes } from '../src/systems/gameDate.js';
import { NORMALIZE_INTERVAL_MINUTES, CRIMES, legalRepOf, setCrimeCommitted } from '../src/systems/court.js';
import { startPoison, POISONS } from '../src/systems/poisons.js';
import { exhaustionOutcome } from '../src/systems/rest.js';
import { maxFatigue } from '../src/systems/statMods.js';
import { intermittentEnemySpawn, passiveGuardSpawns } from '../src/systems/encounters.js';
import { partyExtraFoes } from '../src/systems/partyScale.js';
import { SOLITARY_TYPES } from '../src/characters/mobileFactions.js';
import { RAIDING_PARTIES_VENDOR, newRaidSaveData } from '../src/systems/raidingParties.js';
import { ONLINE_TRAVEL_ROWS, ONLINE_TRAVEL_LINE } from '../src/ui/travelPopUp.js';
import { repairRowText } from '../src/ui/enhancedTrade.js';
import { OWN_TIME_ROOM_NOTE } from '../src/ui/tavernWindow.js';
import { RACES } from '../src/systems/races.js';
import { MERCHANTS_FACTION_ID } from '../src/systems/guilds.js';
import { FACTION_TYPES } from '../src/formats/factionFile.js';
import { createRegionConditions } from '../src/systems/regionConditions.js';

afterEach(() => { setSharedClock(null); });

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const H = 60, D = MINUTES_PER_DAY, N = NORMALIZE_INTERVAL_MINUTES;
const player = (extra = {}) => ({
  isPlayer: true, name: 'P', raceId: RACES.Breton, level: 5, health: 60, maxHealth: 60, magicka: 10, maxMagicka: 10, fatigue: 6000,
  stats: { strength: 50, endurance: 50, willpower: 50, agility: 50, luck: 50, intelligence: 50, personality: 50, speed: 50 },
  skills: 30, skillUses: [], items: [], career: {}, activeEffects: [], ...extra,
});
/** Online: the world's clock at `world` (t.clock, moved by the test), the character's own at `own`, the arrival made. */
function online({ own, world, entity = player(), tickerOpts } = {}) {
  const t = { clock: world };
  setSharedClock(() => t.clock);
  setOwnMinutes(own);
  entity.lastGameMinutes = Math.floor(own);
  alignEntityClocks(entity, t.clock);
  resetMagicRoundMarker(Math.floor(own));
  return { e: entity, t, ticker: createPlayerTicker(entity, tickerOpts) };
}
function offline({ own, entity = player(), tickerOpts } = {}) {
  setSharedClock(null);
  setWorldMinutes(own);
  entity.lastGameMinutes = Math.floor(own);
  resetMagicRoundMarker(Math.floor(own));
  return { e: entity, ticker: createPlayerTicker(entity, tickerOpts) };
}
const seeded = (seed) => { let s = seed; return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; };

test('AUDIT LIVED1b K1 (K2): a collapse fired from inside a round walks its hour at once, under its own box - a Somnalius dose collapses as often online as offline (DFU\'s popup guard), and no save can come between the hour and its walk', () => {
  const realRandom = Math.random;
  const dose = (lane, seed) => {
    Math.random = seeded(seed);
    let L = null, ticker = null, latch = false, boxUp = false, boxes = 0;
    // the hosts' handler: world.js onExhaustedExterior's shape - the latch, and (online) DFU's box guard
    const onExhausted = () => {
      if (latch || (sharedClockOn() && boxUp)) return;
      latch = true;
      try {
        const out = exhaustionOutcome({ enemiesNearby: false, swimming: false, entity: L.e, day: true, inside: false });
        boxes++; boxUp = true; ticker.advance(60);
        L.e.health = Math.min(L.e.maxHealth, L.e.health + out.health);
        L.e.fatigue = Math.min(maxFatigue(L.e), (L.e.fatigue ?? 0) + out.fatigue);
      } finally { latch = false; }
    };
    const own0 = 700 * D + 10 * H;
    const e = player({ health: 10, maxHealth: 200 });
    L = lane === 'online' ? online({ own: own0, world: 900 * D + 3 * H, entity: e, tickerOpts: { onExhausted } }) : offline({ own: own0, entity: e, tickerOpts: { onExhausted } });
    ticker = L.ticker;
    const p = startPoison(e, POISONS.Somnalius, own0, Math.random);
    p.minutesToStart = 1;
    e.fatigue = 100;
    for (let i = 0; i < 400; i++) {
      boxUp = false;   // the box is dismissed before the next frame's tick (the tick is held while it stands)
      if (L.t) L.t.clock += 0.5; else setWorldMinutes(worldMinutes());
      ticker.tick(2.5);
      if (lane === 'online') assert.equal(ownWalkWaiting(e), false, 'every frame ends with its raises walked');
    }
    return boxes;
  };
  try {
    for (const seed of [1, 7, 42]) {
      const off = dose('offline', seed), on = dose('online', seed);
      assert.equal(on, off, `seed ${seed}: the dose collapses ${off} times offline and as often online`);
    }
  } finally { Math.random = realRandom; }
  // the hour is walked inside the one tick() call - after the window in hand, never inside it
  const { e, t } = online({ own: 300 * D, world: 900 * D });
  let ticker = null, inside = null, ticks = 0;
  ticker = createPlayerTicker(e, { onExhausted: () => { inside = tickInFlight(); ticker.advance(H); } });
  ticker.subscribe(() => { ticks++; });
  e.fatigue = 1;
  t.clock += 1;
  ticker.tick(1 / 60);
  assert.equal(inside, true);
  assert.equal(ticks, 2, 'the window in hand, then the hour\'s own walk');
  assert.equal(e.lastGameMinutes, Math.floor(ownMinutes()), 'walked this frame');
  // the hosts' guard, where the handler lives
  assert.match(rd('src/scenes/world.js'), /function onExhaustedExterior\(\) \{\s*if \(_inExhaustion \|\| \(sharedClockOn\(\) && exhaustedShowing\(\)\)\) return;/);
  assert.match(rd('src/scenes/world.js'), /_exhaustedBox = new ActionTextBox\(lines\);\s*townTalk\.pushOverlay\(_exhaustedBox\);/);
  assert.match(rd('src/scenes/worldModes.js'), /function onExhaustedInterior\(\) \{\s*if \(_inExhaustion \|\| \(sharedClockOn\(\) && exhaustedShowing\(\)\)\) return;/);
  assert.match(rd('src/scenes/worldModes.js'), /_exhaustedBox = new ActionTextBox\([^\n]*\);\s*mountInterior\(_exhaustedBox\);/);
  assert.match(rd('src/scenes/world.js'), /const exhaustedShowing = \(\) => !!_exhaustedBox && !_exhaustedBox\.done && townTalk\.containsOverlay\(_exhaustedBox\);/, 'the box, while it stands');
  assert.match(rd('src/scenes/worldModes.js'), /const exhaustedShowing = \(\) => !!_exhaustedBox && !_exhaustedBox\.done && interiorWindows\.containsWindow\(_exhaustedBox\);/);
});

test('AUDIT LIVED1b S1 (F2, K2): an online checkpoint waits while a raise waits for its walk - the load would re-anchor every marker to the moved clock and the span would never be walked', () => {
  const { e, t, ticker } = online({ own: 500 * D, world: 900 * D });
  assert.equal(ownWalkWaiting(e), false, 'a character whose clock was walked');
  advanceOwnMinutes(3 * D);   // a sentence, the fortnight, a cure's minute, TrainPc's hours: the bare move
  assert.equal(ownWalkWaiting(e), true, 'the span waits for the next unpaused tick');
  assert.equal(checkpointAllowed({ online: true, spawned: true, walkWaiting: ownWalkWaiting(e) }), false, 'no checkpoint under it');
  t.clock += 0.01;
  ticker.tick(1 / 60);
  assert.equal(ownWalkWaiting(e), false, 'walked');
  assert.equal(checkpointAllowed({ online: true, spawned: true, walkWaiting: ownWalkWaiting(e) }), true);
  setSharedClock(null);
  setWorldMinutes(1000);
  e.lastGameMinutes = 500;
  assert.equal(ownWalkWaiting(e), false, 'offline, never: the host saves on its own, as before');
  assert.match(rd('src/scenes/world.js'), /checkpointAllowed\(\{ online: !!online, spawned: playerSpawned, seatOut: seatOut\(\), duel: !!duelMgr\?\.duel, walkWaiting: ownWalkWaiting\(playerEntity\) \}\)/, 'the host asks');
});

test('AUDIT LIVED1b P3 (A4, K3): the world\'s arms walk what no walk covered - a fast machine clock at the boot, a correction forward then back: every lived world minute once, none twice', () => {
  // the spans themselves
  setSharedClock(() => 0);
  assert.deepEqual(worldArmsPieces(100, 200), [[100, 200]]);
  assert.deepEqual(worldArmsPieces(200, 250), [[200, 250]], 'the next frame');
  assert.deepEqual(worldArmsPieces(180, 260), [[250, 260]], 'a step back walks nothing twice (I\'s law)');
  assert.deepEqual(worldArmsPieces(400, 410), [[400, 410]], 'a correction forward skips its gap');
  assert.deepEqual(worldArmsPieces(300, 405), [[300, 400]], 'and one back into the gap walks it, up to what was walked');
  assert.deepEqual(worldArmsPieces(405, 420), [[410, 420]]);
  assert.deepEqual(worldArmsPieces(50, 60), [[50, 60]], 'below every span');
  assert.deepEqual(worldArmsPieces(10, 10), []);
  setSharedClock(null);
  // the boot (lane P's pC): a machine 10 real minutes fast (120 game minutes) loads and walks its first frames ahead of
  // the world; the welcome steps the reading back; the true 7-day faction-power minute (also a midnight) then falls in
  // play - and is walked, fast clock or not
  const P7 = 10080 * 150;
  const factions = () => {
    const d = new Map();
    const f = (o) => ({ id: 1, parent: 0, type: FACTION_TYPES.Group, power: 50, rulerPowerBonus: 0, rep: 0, ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0, children: null, region: -1, ...o });
    d.set(MERCHANTS_FACTION_ID, f({ id: MERCHANTS_FACTION_ID, power: 60 }));
    for (let r = 0; r < 4; r++) d.set(9000 + r, f({ id: 9000 + r, type: FACTION_TYPES.Province, region: r, power: 40 + r * 5 }));
    d.set(9100, f({ id: 9100, power: 55 }));
    return { dict: d };
  };
  const powers = (e) => [...e.factionRep.dict.values()].map((f) => `${f.id}:${f.power}`).join(' ');
  const powersMovedAtP7 = (machineFast) => {
    setSharedClock(() => P7 - 3000);
    setOwnMinutes(90 * D + 600);
    const snap = JSON.parse(JSON.stringify(snapshotPlayer(player({ factionRep: null }), { classicMinutes: 90 * D + 600 })));
    const t = { trueNow: P7 - 60, offset: machineFast ? 120 : 0 };
    setSharedClock(() => t.trueNow + t.offset);
    const e = player({ factionRep: factions(), regionConditions: createRegionConditions() });
    restorePlayer(e, snap);
    e.factionRep = factions();
    const ticker = createPlayerTicker(e);
    const frame = (realSec) => { t.trueNow += realSec / 5; ticker.tick(realSec); };
    frame(1); frame(1);                                            // before the socket's welcome
    t.offset = 0;
    alignEntityClocks(e, worldMinutes());                          // the welcome (world.js onlineArrival)
    const before = powers(e);
    for (let m = 0; m < 130; m++) frame(5);                        // across the true P7
    setSharedClock(null);
    return powers(e) !== before;
  };
  assert.equal(powersMovedAtP7(false), true, 'an honest clock walks the power minute');
  assert.equal(powersMovedAtP7(true), true, 'a fast one too - the minutes it walked ahead were not the ones it lived after the welcome');
  // and through the real tick: the zones after the true midnight are the new day's, fast clock or not
  assert.match(rd('src/systems/worldTick.js'), /for \(const \[s, e\] of worldPieces\) runDayChange\(\{ entity, lastMinutes: s, nowMinutes: e, rolls, say, arms: DAY_ARMS\.world \}\);\s*\n\s*rollWorldZonesAcross\(worldFrom, worldTo\);/);
});

test('AUDIT LIVED1b K3: the six zones are the world\'s day\'s - rolled on every midnight the reading crosses, walked or not', async () => {
  const W = await import('../src/systems/weatherSim.js');
  const zones = () => W.ZONE_CLIMATES.map((z) => W.weatherForClimate(z)).join(',');
  W.resetWeatherSim(); W.setWeatherMapLaw(false); W.setSharedWeather(true); W.setWeatherEvolution(false);
  try {
    const M = 900 * D;
    W.rollClimateWeathersForDay(M + 1); const after = zones();
    W.rollClimateWeathersForDay(M - 1); const before = zones();
    const t = { clock: M - 30 };
    setSharedClock(() => t.clock);
    const e = player({ lastGameMinutes: 90 * D });
    setOwnMinutes(90 * D);
    alignEntityClocks(e, t.clock);
    const ticker = createPlayerTicker(e);
    t.clock = M + 10; ticker.tick(1);                 // the midnight, walked
    assert.equal(zones(), after, 'the new day\'s sky');
    t.clock = M - 5;                                 // a correction back across it: the arrival re-rolls the day before
    alignEntityClocks(e, t.clock); W.rollClimateWeathersForDay(t.clock);
    assert.equal(zones(), before);
    t.clock = M + 20; ticker.tick(1);                 // the midnight again - walked once already, and the sky is still the day's
    assert.equal(zones(), after, 'the day\'s sky again, though the arms walked nothing twice');
  } finally { W.resetWeatherSim(); setSharedClock(null); }
});

test('AUDIT LIVED1b P4: the absence is measured on the relay\'s clock - a machine clock set months fast at the boot buys no recovery; the absence is paid on the corrected clock when it is heard, and a save until then keeps the minute the character left at', () => {
  const left = 5 * N + 100;
  setSharedClock(() => left);
  setOwnMinutes(90 * D);
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(player({ legalRep: [-80] }), { classicMinutes: 90 * D })));
  assert.equal(snap.worldMinutes, left);
  // the boot: the true world one 112-day boundary on (N), this machine eleven months fast (three more)
  const t = { trueNow: left + N, offset: 3 * N };
  setSharedClock(() => t.trueNow + t.offset);
  const e = player();
  restorePlayer(e, snap);
  assert.equal(sharedClockHeard(), false);
  assert.equal(e.legalRep[0], -80, 'nothing paid on this machine\'s clock');
  assert.equal(worldMinutesToSave(), left, 'a checkpoint now keeps the minute the character left at');
  assert.equal(snapshotPlayer(e, { classicMinutes: Math.floor(ownMinutes()) }).worldMinutes, left, '...the composer\'s stamp');
  t.offset = 0;   // the welcome: the relay's offset
  hearSharedClock();
  // REP4 (the reputation overhaul): PIN MOVED - the recovery is weekly, so the true 112 days away are sixteen points
  // (DFU's one boundary: -79); a machine clock months fast still buys nothing
  assert.equal(e.legalRep[0], -64, 'the true span\'s sixteen weeks, paid on the relay\'s clock');
  assert.equal(worldMinutesToSave(), Math.floor(worldMinutes()), 'and the save stamps the world\'s now');
  hearSharedClock();
  assert.equal(e.legalRep[0], -64, 'once');
  let paid = 0;
  payAbsenceWhenHeard(left, () => { paid++; });
  assert.equal(paid, 1, 'a load after the welcome pays at once');
  assert.match(rd('src/scenes/world.js'), /online\.onClock = \(offsetMs\) => \{[^\n]*onlineArrival\(\); hearSharedClock\(\); \};/, 'the host hears it');
});

test('AUDIT LIVED1b P2: a copy Bring online made joins fresh - its stamp is this machine\'s clock at the click, and an OS clock set a year back there buys no pardon', () => {
  const own = 400 * D, world = 5500 * D;
  setSharedClock(null);
  const offlineSave = { v: 1, classicMinutes: own, legalRep: [-80] };
  const copy = onlineCopyOf(offlineSave, world - 365 * 12 * D);   // the menu's reading, a year back
  assert.equal(copy.joinFresh, true);
  setSharedClock(() => world);
  const e = player();
  restorePlayer(e, { ...JSON.parse(JSON.stringify(snapshotPlayer(player({ legalRep: [-80] }), { classicMinutes: own }))), worldMinutes: copy.worldMinutes, joinFresh: true });
  hearSharedClock();
  assert.equal(e.legalRep[0], -80, 'no absence paid for a character that was never away');
  assert.equal(offlineCopyOf(copy).joinFresh, undefined, 'the flag is the first join\'s alone - the offline door drops it');
});

test('AUDIT LIVED1b F1: an online load re-anchors at the world\'s reading itself, not its whole minute - the first frame bills the play, not the absence\'s last minute', () => {
  setSharedClock(() => 1000);
  setOwnMinutes(432000);
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(player(), { classicMinutes: 432000 })));
  const t = { clock: 1303860.95 };
  setSharedClock(() => t.clock);
  const e = player();
  restorePlayer(e, snap);
  const ticker = createPlayerTicker(e);
  t.clock += 0.01;
  ticker.tick(0.05);
  assert.ok(Math.abs(ownMinutes() - 432000.01) < 1e-6, `lived ${ownMinutes() - 432000} for 0.01 of play`);
});

test('AUDIT LIVED1b S5: the online load restores the character\'s clock before the held enchantments recast - their reroll stamp is on the character\'s clock', () => {
  const src = rd('src/systems/save.js');
  const set = src.indexOf('if (sharedClockOn()) setOwnMinutes(Math.floor(snap.classicMinutes));');
  const recast = src.indexOf('restartHeldEnchantments(entity);');
  assert.ok(set > 0 && recast > 0 && set < recast, 'the clock first, then the recast');
});

test('AUDIT LIVED1b F3 (S4): a tampered clock neither freezes nor resets a load - it is none, and the clock that stands is taken', () => {
  for (const bad of ['600000', -1, NaN, Infinity, 1e308, 2 ** 53, null, undefined, [], {}]) assert.equal(saneSaveClock(bad), null, String(bad));
  assert.equal(saneSaveClock(0), 0);
  assert.equal(saneSaveClock(SAVE_CLOCK_MAX - 1), SAVE_CLOCK_MAX - 1);
  assert.equal(saneSaveClock(SAVE_CLOCK_MAX), null);
  for (const bad of [1e17, -5, 'abc', null]) {
    setSharedClock(() => 800000);
    setOwnMinutes(700000);
    const snap = JSON.parse(JSON.stringify(snapshotPlayer(player(), { classicMinutes: 700000 })));
    snap.classicMinutes = bad;
    const e = player();
    const t0 = Date.now();
    restorePlayer(e, snap);
    createPlayerTicker(e).tick(1);
    assert.ok(Date.now() - t0 < 2000, 'returned');
    assert.equal(Math.floor(ownMinutes()), 800000, `${bad}: the world's minute, as a save from before LIVED1`);
    assert.equal(e.lastGameMinutes, 800000);
  }
  // the backstops
  const e = player({ legalRep: [-100] });
  const t1 = Date.now();
  normalizeAcross(e, -1e300, 1000);
  assert.ok(Date.now() - t1 < 1000, 'a capped walk');
  assert.equal(NORMALIZE_ACROSS_MAX, 200);
  assert.equal(e.legalRep[0], 0, 'and everything a walk can change changed');
  assert.equal(resetMagicRoundMarker('abc'), null, 'no NaN marker');
  setSharedClock(() => 1000);
  setOwnMinutes(900);
  assert.equal(advanceOwnMinutes(Infinity), 900, 'no Infinity clock');
});

test('AUDIT LIVED1b D1 (A1, O6): the quest bridge hands the machine the character\'s clock - TrainPc stamps it, as the guild\'s gate reads it', () => {
  assert.ok(QUEST_CTX_CONTRACT.includes('ownMinutes'));
  setSharedClock(() => 821560);
  setOwnMinutes(700600);
  const e = { isPlayer: true, level: 5, fatigue: 6000, skillUses: [], stats: {}, skills: 30 };
  const ctx = { data: { readListTable: () => null, getQuestSourceLines: () => null }, playerEntity: e, classicSeconds: () => worldMinutes() * 60, raiseTime: (sec) => advanceOwnMinutes(sec / 60), ownMinutes: () => ownMinutes() };
  const bridge = createQuestBridge(ctx, { label: 'auditlived1b' });
  const hooks = bridge.machine._buildHooks();
  assert.equal(hooks.ownMinutes(), 700600, 'the member reaches the machine');
  const act = new TrainPc({ hooks, showMessagePopup() {}, rolls: () => 0.5 });
  act.skill = SKILLS.Archery;
  act.update(null);
  assert.equal(e.timeOfLastSkillTraining, 700600, 'TrainPc stamps the character\'s minute - the guild\'s twelve-hour gate reads it');
  assert.match(rd('src/scenes/exterior.js'), /ownMinutes: \(\) => ownMinutes\(\),   \/\/ AUDIT LIVED1b D1/);
});

test('AUDIT LIVED1b R1 (A2, O3, S3): Copy to offline leaves the world\'s raid schedule behind - the offline game rolls its own from its first frame', () => {
  assert.equal(RAID_RECORD_VENDOR, RAIDING_PARTIES_VENDOR, 'one vendor name');
  const env = { v: 1, classicMinutes: 550 * D, worldMinutes: 700 * D, modData: { [RAIDING_PARTIES_VENDOR]: { lastSelectedDay: 700, raids: [{ startDay: 700 }] }, other: { keep: 1 } } };
  const copy = offlineCopyOf(env);
  assert.equal(copy.modData[RAIDING_PARTIES_VENDOR], undefined, 'the load hands the mod its NewSaveData');
  assert.deepEqual(newRaidSaveData(), { lastSelectedDay: -1, raids: [] });
  assert.deepEqual(copy.modData.other, { keep: 1 });
  const offlineEnv = { v: 1, classicMinutes: 550 * D, modData: { [RAIDING_PARTIES_VENDOR]: { lastSelectedDay: 550, raids: [] } } };
  assert.equal(offlineCopyOf(offlineEnv).modData[RAIDING_PARTIES_VENDOR].lastSelectedDay, 550, 'an offline envelope\'s is its own');
});

test('AUDIT LIVED1b R3 (O2): a journal step\'s date crosses both doors with its quest - %qdt stays two days after the start', () => {
  const env = { v: 1, classicMinutes: 911 * D, worldMinutes: 1063 * D, quest: { quests: [{ questStartTime: 1063 * D * 60, activeLogMessages: [{ stepID: 1, time: 1065 * D * 60 }, { stepID: 2, time: 0 }] }] } };
  const off = offlineCopyOf(env).quest.quests[0];
  assert.equal(off.activeLogMessages[0].time - off.questStartTime, 2 * D * 60, 'two days apart, as online');
  assert.equal(off.activeLogMessages[1].time, 0, 'a zero stays');
  const on = onlineCopyOf({ v: 1, classicMinutes: 911 * D, quest: { quests: [off] } }, 563 * D).quest.quests[0];
  assert.equal(on.activeLogMessages[0].time - on.questStartTime, 2 * D * 60);
  assert.equal(on.questStartTime, 563 * D * 60, 'the quest on the world\'s clock, and its step with it');
});

test('AUDIT LIVED1b D2 (R2, O4, S3): a cached building\'s stock days cross both doors by whole days - a shelf stocked today is stocked today on the new calendar, and restocks tomorrow', () => {
  const stock = (m) => createStockedDate(dateFromClassicMinutes(m));
  const own = 550 * D + 1400, world = 700 * D + 60;   // 23:20 on the character's day, 01:00 on the world's: whole days, not the minutes' round
  const env = { v: 1, classicMinutes: own, worldMinutes: world, sceneCache: { scenes: [{ sceneName: 'shop', lootContainers: [{ stockedDate: stock(world), openedOn: stock(world) }, { stockedDate: 0, openedOn: 0 }, { stockedDate: 1 }] }] } };
  const [shelf, never, owned] = offlineCopyOf(env).sceneCache.scenes[0].lootContainers;
  assert.equal(shelf.stockedDate, stock(own), 'today on the copy\'s calendar');
  assert.equal(shelf.openedOn, stock(own), 'the searched lid with it');
  assert.equal(needsRestock(shelf, stock(own)), false);
  assert.equal(needsRestock(shelf, stock(own + D)), true, 'and tomorrow it restocks');
  assert.deepEqual([never.stockedDate, owned.stockedDate], [0, 1], '"never stocked" and an owned house\'s latch stay');
  // across a year's end, and back online
  const late = 404 * 360 * D + 359 * D;   // the calendar's last day of a year
  const env2 = { v: 1, classicMinutes: late, sceneCache: { scenes: [{ lootContainers: [{ stockedDate: stock(late) }] }] } };
  const on = onlineCopyOf(env2, late + 2 * D);
  assert.equal(on.sceneCache.scenes[0].lootContainers[0].stockedDate, stock(late + 2 * D), 'two days on, over the year\'s turn');
});

test('AUDIT LIVED1b A3: a backward step of the world\'s clock re-rolls no raid day and restocks no bought-out guild shelf online; offline nothing reads differently', async () => {
  const had = globalThis.location;
  try {
    globalThis.location = { search: '?online' };
    const store = {};
    let mints = 0;
    const open = (m) => dayShelf(store, 'BuyPotions', m, () => { mints++; return ['a', 'b', 'c', 'd', 'e']; });
    const today = 950 * D + 30;
    open(today).items.length = 0;   // all bought
    open(949 * D + 1400);            // a step back across the midnight
    dayShelf(store, 'BuyMagic', 949 * D + 1400, () => ['m']);   // another service opened in the stepped-back day: its sweep keeps today's
    assert.equal(open(today + 1).items.length, 0, 'what was bought stays gone');
    assert.equal(mints, 1, 'no shelf minted over it');
    globalThis.location = { search: '' };
    const s2 = {};
    const open2 = (m) => dayShelf(s2, 'BuyPotions', m, () => ['a']);
    open2(today).items.length = 0;
    open2(949 * D + 1400);
    assert.equal(open2(today + 1).items.length, 1, 'offline: DFU\'s re-mint, as before');
  } finally { globalThis.location = had; }
  // the raids (lane A's a3b): a town cleansed, a step back across the world's midnight and forward again - the same raid
  // stands cleansed, and its reputation is paid once
  const RP = await import('../src/systems/raidingParties.js');
  const { renownFoeStruck } = await import('../src/net/renownTracker.js');
  const { setModSetting, _resetModSettings } = await import('../src/systems/modSettings.js');
  const { LOCATION_TYPES } = await import('../src/formats/mapsFile.js');
  _resetModSettings(); setModSetting(RP.RAIDING_PARTIES_VENDOR, 'Enabled', true);
  try {
    const names = Array(8).fill('Graveyard'); names[7] = 'Gothway Garden';
    const table = [...Array(7).fill({ locationType: LOCATION_TYPES.Graveyard }), { locationType: LOCATION_TYPES.TownCity, longitude: 200 * 128, latitude: (499 - 100) * 128 }];
    const maps = { regionCount: 62, getRegion: (r) => (r === 3 ? { mapNames: names, mapTable: table } : null) };
    const picker = Uint8Array.from([128 + 3]);
    let day = 900;
    for (; day < 5000; day++) { const rs = RP.raidsForDay(day, RP.raidRegions(maps, picker)); if (rs.length && rs[0].startMinute <= day * D + 25) break; }
    const pl = { legalRep: {} }, store = { dict: new Map() }, mine = [], said = [];
    RP._resetRaidingParties();
    RP.setRaidingPartiesHost({
      random: () => 0.5, regionIndex: () => 3, regionName: (r) => `Region${r}`, townHere: () => null, playerPixel: () => ({ x: 200, y: 100 }),
      maps: () => maps, picker: () => picker, say: (l) => said.push(l), selfId: () => 'me', wallNow: () => 0, peersInTown: () => [],
      ownRaidFoes: () => mine.filter((f) => !f.dead), reputation: () => ({ player: pl, store }),
    });
    const t = { clock: day * D + 30 };
    setSharedClock(() => t.clock);
    const fight = () => {
      RP.raidFrame(0.1);
      const r = RP.raidState().raids[0];
      if (r.cleansed) return r;
      const foes = Array.from({ length: r.attackAmount }, (_, i) => ({ raidKey: RP.raidKey(r), dead: false, corpse: false, entity: { health: 10 }, ai: { feet: [i, 0, 0] } }));
      mine.push(...foes);
      renownFoeStruck(foes[0]);
      RP.raidFrame(0.1);
      for (const f of foes) { f.dead = true; f.corpse = true; f.entity.health = 0; }
      RP.raidFrame(0.1);
      return r;
    };
    fight();
    assert.equal(pl.legalRep[3], 5, 'the cleanse pays');
    t.clock = day * D - 15; RP.raidFrame(0.1);   // the welcome lowers the reading across the midnight
    t.clock = day * D + 31;
    const r = fight();
    assert.equal(r.cleansed, true, 'the town stands cleansed');
    assert.equal(pl.legalRep[3], 5, 'and is paid once');
    assert.equal(said.filter((l) => /under attack/.test(l)).length, 1, 'announced once');
    // RAID2 stands: a save's record from a day the world has not reached is rolled afresh at its first check
    RP.restoreRaidSaveData({ lastSelectedDay: day + 40, raids: [] });
    RP.raidFrame(0.1);
    assert.equal(RP.raidState().lastSelectedDay, day, 'the world\'s day, not the save\'s');
  } finally { _resetModSettings(); RP._resetRaidingParties(); setSharedClock(null); }
});

test('AUDIT LIVED1b P1: a party mirror\'s night walks the follower\'s own watch - a hated member is watched as asleep alone - and rolls no wanderer (the rester\'s roll is the party\'s)', () => {
  const src = rd('src/scenes/world.js');
  const extract = (head) => {
    const at = src.indexOf(head);
    assert.ok(at >= 0, head);
    let depth = 0;
    for (let j = at + head.length - 1; j < src.length; j++) {   // the head ends with the body's own brace
      if (src[j] === '{') depth++;
      else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(at, j + 1); }
    }
    throw new Error('unbalanced');
  };
  const fnText = extract('function runEncounterTick(playerFeet, isResting = false, { spawns = true } = {}) {');
  const MIRROR = 'advanceMinutes: (n) => { playerTicker.advance(n); runEncounterTick(walkMode && playerSpawned ? player.pos : cam.pos, true, { spawns: false }); },';
  const SOLO = 'advanceMinutes: (n) => { playerTicker.advance(n); runEncounterTick(walkMode && playerSpawned ? player.pos : cam.pos, true); },';
  assert.ok(src.includes(MIRROR), 'the mirror hook');
  assert.ok(src.includes(SOLO), 'the solo rest hook');
  const realRandom = Math.random;
  const night = (kind, seed) => {
    Math.random = seeded(seed);
    const e = player({ factionRep: null, legalRep: [] }); e.legalRep[17] = -20;
    const { ticker } = online({ own: 90 * D + 20 * H, world: 800 * D + 13 * H, entity: e });
    const counts = { spawnAsks: 0, watch: 0 };
    const names = ['playerTicker', 'playerEntity', 'amGroupRollOwner', 'online', 'player', 'partyNear', 'modes', 'walkMode', 'playerSpawned',
      'intermittentEnemySpawn', 'sharedClockOn', 'worldMinutes', 'skyMinutes', '_musicInLocationRect', 'maps', 'playerTravelPixel', 'SOLITARY_TYPES',   // TIME1: the roll's sky
      'partyExtraFoes', 'partySize', '_standEncounterFoe', '_questRegionIndex', 'passiveGuardSpawns', 'legalRepOf', 'setCrimeCommitted', 'CRIMES',
      '_witnessResponse', 'cityGuards', '_guardPool', 'cam', 'effectiveLevel',
      'revenantPresence', 'takeRevenantNotice', 'revenantToReturn', 'exteriorFoes', 'townTalk', 'revenantSay'];   // REVENANT: none here   // SOFTCAP2: the mentor's level the loop's roll reads
    const body = `let _lastEncMinutes = null;\n${fnText}\nconst mirrorHook = { ${MIRROR} };\nconst soloHook = { ${SOLO} };\n`
      + 'return { run: runEncounterTick, mirror: mirrorHook.advanceMinutes, solo: soloHook.advanceMinutes };';
    const h = new Function(...names, body)(ticker, e, () => true, { id: 'me' }, { pos: [0, 0, 0], feetAt: () => [0, 0, 0], isPlayerSwimming: false }, () => [], { mode: 'exterior' }, true, true,
      (a) => { counts.spawnAsks++; return intermittentEnemySpawn(a); }, sharedClockOn, worldMinutes, skyMinutes, () => true, { getClimateIndex: () => 231 }, () => ({ x: 100, y: 100 }), SOLITARY_TYPES,
      partyExtraFoes, () => 2, () => {}, () => 17, passiveGuardSpawns, legalRepOf, setCrimeCommitted, CRIMES,
      () => { counts.watch++; }, { makeNpcGuardsIntoEnemies: () => Promise.resolve() }, () => [], { pos: [0, 0, 0] }, (x) => x?.level ?? 1,
      () => false, () => null, () => null, { foes: [] }, { say() {} }, () => false);
    h.run([0, 0, 0]);
    e.isResting = true;
    for (let k = 0; k < 48; k++) (kind === 'solo' ? h.solo : h.mirror)(10);
    e.isResting = false;
    const nightAsks = counts.spawnAsks;
    h.run([0, 0, 0]);
    setSharedClock(null);
    return { ...counts, spawnAsks: nightAsks, burst: counts.spawnAsks - nightAsks };
  };
  try {
    let watched = 0, asks = 0, burst = 0;
    for (let r = 0; r < 20; r++) { const o = night('mirror', 1000 + r); if (o.watch > 0) watched++; asks += o.spawnAsks; burst += o.burst; }
    // REP1 (the reputation overhaul, "Challenged on sight"): PIN MOVED - the minute loop rolls no conspiracy any more, so
    // a hated member's night is not watched, mirrored or alone (the watch stops a known criminal a guard SEES, on the
    // street - scenes/standingHost.js); the night's other two laws stand, the burst now read off the loop's own asks
    assert.equal(watched, 0, 'no night of a hated member draws the old levy');
    assert.equal(asks, 0, 'and no wanderer is asked for');
    assert.equal(burst, 0, 'nor is the night walked again on the first frame up (AUDIT LIVED1 H)');
    const solo = night('solo', 1000);
    assert.ok(solo.spawnAsks > 0, 'a solo rest still asks');
  } finally { Math.random = realRandom; }
});

test('AUDIT LIVED1b R4: a character born online takes the skill check\'s stamp at the character\'s own clock, as DFU\'s AssignCharacter does at Now', () => {
  assert.match(rd('src/scenes/world.js'), /finishChargen\(playerEntity, r, sbi\);\s*(?:\/\/[^\n]*\n\s*)*if \(sharedClockOn\(\)\) playerEntity\.lastSkillCheckTime = Math\.floor\(ownMinutes\(\)\);/);
});

test('AUDIT LIVED1b U1-U8, D3: the words - two rows on the classic panel, one rounding per job, the parchment\'s own "due by", the offline card as it was, the play never rounded down, logging off', () => {
  assert.deepEqual([...ONLINE_TRAVEL_ROWS], ['Online: the days pass on your own clock.', 'You arrive in the world\'s present.'], 'U1');
  assert.equal(ONLINE_TRAVEL_ROWS.join(' '), ONLINE_TRAVEL_LINE);
  setSharedClock(() => 900 * D);
  setOwnMinutes(100 * D);
  const own = ownMinutes();
  assert.equal(repairRowText({ done: false, doneAt: own + D + 1, minutesLeft: D + 1, estimate: false }), 'Ready in 1 day', 'U2: the row floors as the detail does');
  assert.equal(repairRowText({ done: false, doneAt: own + 1439, minutesLeft: 1439, estimate: true }), 'About 23 hours');
  assert.equal(repairRowText({ done: true, doneAt: own - 1, minutesLeft: 0, estimate: false }), 'Ready');
  assert.equal(ownTimeLeftText(own + 34561), '24 days of your time (49 hours of play)', 'U5: the most it can take, never rounded down');
  setSharedClock(null);
  assert.equal(repairRowText({ done: false, doneAt: 1441, minutesLeft: 1441, estimate: false }), 'Ready in 2 days', 'offline, DFU\'s ceiling');
  assert.match(rd('src/scenes/worldModes.js'), /if \(left === 'now'\) return short \? 'now' : 'due now';/, 'U3');
  assert.match(rd('src/ui/enhancedPorts.js'), /\[empire \? 'Loan due' : 'Loan due by', L\.loanByFull \?\? L\.loanBy\]/, 'U4');
  assert.equal(WT.realTimeText, undefined, 'U6');
  assert.equal(WT.sharedRealTimeText, undefined);
  assert.match(rd('src/ui/enhancedRest.js'), /const clockLine = el\('p', 'clock-line'\);/, 'U7');
  for (const s of ['src/ui/enhancedPlusStyle.js', 'src/ui/enhancedStyle.js']) assert.match(rd(s), /\.rest-shell \.clock-line:empty \{ display: none; \}/, s);
  assert.equal(OWN_TIME_ROOM_NOTE, ' - a rest spends it, logging off does not.', 'U8');
  assert.match(rd('src/scenes/world.js'), /LIVED1: the cure's minute is the character's own time/, 'D3');
});
