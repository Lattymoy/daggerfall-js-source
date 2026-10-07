// LIVED1 (2026-09-29, Mac, sharing the Discord - Dracula/Valentin: "my money, my guild and i cant even travel at day
// anymore"; Subdon: "since we cant just import/export characters anymore, how we getting lycanthropy now? becuse we
// need to wait 72 hours but the in game clock aint moving"): "Makes a good point. We need a better system for time
// online instead of a band aid fix. Something detailed and that really makes sense".
//
// TWO CLOCKS (bible/06-Systems/Lived-Time.md). The WORLD's is WORLD5's shared clock, unchanged: the sky, the calendar
// and everything every player shares read it, and nobody moves it. The CHARACTER's (worldTick.js ownMinutes) is the
// world's offline - one variable, DFU byte for byte - and online it runs WITH the world while they play, AHEAD of it by
// every RaiseTime (a rest, a journey, training, a sentence), and STANDS while they are away or dead. The body, its magic,
// its needs, its contracts and its standing read the character's; the sun, the moons and the calendar the world's.
//
// Driven through the real modules: the ticker (shared.js createPlayerTicker), the tick, the save's one door, the
// tavern window. The superseded pins are re-aimed in their own files; this file holds the design's own claims - the
// clock, Subdon's incubation, the vampire's sky, the five seams the patches disagreed at, and the words.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createPlayerTicker } from '../src/scenes/shared.js';
import {
  setSharedClock, setWorldMinutes, worldMinutes, ownMinutes, setOwnMinutes, advanceOwnMinutes, sharedClockOn,
  alignEntityClocks, skipDeadMinutes, resetMagicRoundMarker, ownTimeLeftText, worldNightfallText, MINUTES_PER_DAY,
  hearSharedClock,
} from '../src/systems/worldTick.js';
import { createInfection, INFECTION } from '../src/systems/infection.js';
import { startDisease, DISEASES } from '../src/systems/diseases.js';
import { createVampirismCurse, VAMPIRE_STAT_MOD } from '../src/systems/vampirism.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { NORMALIZE_INTERVAL_MINUTES } from '../src/systems/court.js';
import { TavernWindow, TAVERN_RECTS, TAVERN_PANEL_X, TAVERN_PANEL_Y } from '../src/ui/tavernWindow.js';
import { ROOM_FREE_HEARTS_DAY, HEARTS_DAY } from '../src/systems/tavern.js';
import { RACES } from '../src/systems/races.js';

afterEach(() => { setSharedClock(null); });

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const H = 60, D = MINUTES_PER_DAY;
const player = (extra = {}) => ({
  isPlayer: true, name: 'P', raceId: RACES.Breton, level: 5, health: 60, maxHealth: 60, magicka: 10, maxMagicka: 10, fatigue: 6000,
  stats: { strength: 50, endurance: 50, willpower: 50, agility: 50, luck: 50, intelligence: 50, personality: 50, speed: 50 },
  skills: 30, skillUses: [], items: [], career: {}, activeEffects: [], ...extra,
});

/** One lane: offline the port's one clock at `own`; online a shared clock at `world` the test moves, and the
 *  character's own clock at `own` (as a load restores it). The ticker is the hosts' own. */
function lane(online, { own, world = own, entity = player() } = {}) {
  const t = { clock: world };
  if (online) {
    setSharedClock(() => t.clock);
    setOwnMinutes(own);
  } else {
    setSharedClock(null);
    setWorldMinutes(own);
  }
  entity.lastGameMinutes = own;
  if (online) alignEntityClocks(entity, t.clock);
  resetMagicRoundMarker(own);
  return { e: entity, t, ticker: createPlayerTicker(entity) };
}

test('LIVED1: offline the character\'s clock IS the world\'s - one variable, so nothing offline reads differently', () => {
  setSharedClock(null);
  setWorldMinutes(1000);
  assert.equal(sharedClockOn(), false);
  assert.equal(ownMinutes(), 1000);
  assert.equal(advanceOwnMinutes(60), 1060, 'a RaiseTime moves the one clock');
  assert.equal(worldMinutes(), 1060);
  setOwnMinutes(500);
  assert.equal(worldMinutes(), 500, 'and a load restores it');
  assert.equal(ownTimeLeftText(900), null, 'DFU says its dates offline');
  assert.equal(worldNightfallText(), null);
});

test('LIVED1: online the character\'s clock runs WITH the world while they play, AHEAD of it by every RaiseTime, and an absence is not lived - and the world\'s clock moves for nobody', () => {
  const { e, t, ticker } = lane(true, { own: 8000, world: 20000 });
  t.clock += 5;
  ticker.tick(1 / 60);
  assert.equal(ownMinutes(), 8005, 'five of the world\'s minutes, played, are five of the character\'s');
  ticker.advance(2 * H);   // a two-hour rest
  assert.equal(ownMinutes(), 8125, 'the rest is the character\'s own time');
  assert.equal(worldMinutes(), 20005, 'the world did not wait, and did not move');
  setWorldMinutes(0);
  assert.equal(worldMinutes(), 20005, 'WORLD5 stands: nobody sets the world\'s clock');
  // away: the player logs off, the world runs a day, and they come back (the load's arrival re-anchors the reading)
  t.clock += D;
  alignEntityClocks(e, t.clock);
  ticker.tick(1 / 60);
  assert.equal(ownMinutes(), 8125, 'the day away is not the character\'s - nothing aged');
  t.clock += 3;
  ticker.tick(1 / 60);
  assert.equal(ownMinutes(), 8128, 'and the first minutes back are lived as ever');
  assert.equal(e.lastGameMinutes, 8128, 'the day marker is on the character\'s clock');
});

test('LIVED1: a character with no clock of their own yet (born online, no save to restore one) starts it at the world\'s reading - the first tick lives the world\'s minutes once', () => {
  let clock = 5000;
  setSharedClock(() => clock);
  const e = player();
  alignEntityClocks(e, clock);   // the arrival, with nothing to restore
  assert.equal(ownMinutes(), 5000, 'until their first tick the character\'s clock reads the world\'s');
  clock += 10;
  createPlayerTicker(e).tick(1 / 60);
  assert.equal(ownMinutes(), 5010, 'ten of the world\'s minutes, lived once');
  clock += 2;
  createPlayerTicker(e).tick(1 / 60);
  assert.equal(ownMinutes(), 5012, 'and their own from there');
});

test('LIVED1 (Subdon): an infection counts the days the CHARACTER lives - rests included - so the werewolf dreams and turns online on the offline days, while the world\'s clock stands', () => {
  const start = 300 * D + 12 * H, day0 = Math.floor(start / D);
  const turnedAfter = (online) => {
    const { e, t, ticker } = lane(online, { own: start, world: 900 * D + 3 * H });
    const infection = createInfection(INFECTION.Werewolf, { day: day0 });
    e.activeEffects.push(infection);
    const seen = { dream: null, turn: null };
    for (let h = 1; h <= 5 * 24 && seen.turn == null; h++) {
      ticker.advance(H);   // an hour's rest
      if (seen.dream == null && infection.dreamPlayed) seen.dream = h;
      if (seen.turn == null && e.racialOverride?.racial === 'lycanthropy') seen.turn = h;
    }
    if (online) assert.equal(worldMinutes(), t.clock, 'online the world\'s clock stood through every rested hour');
    // seam 4: the turn landed mid-rest, and the curse it minted is on the character's clock - no marker of it ahead
    assert.ok(Number.isFinite(e.racialOverride?.lastKilledInnocent), 'the curse minted its satiation clock');
    for (const k of ['lastKilledInnocent', 'lastCastMorphSelf', 'lastUrgeNotify']) {
      const v = e.racialOverride?.[k];
      if (Number.isFinite(v)) assert.ok(v <= ownMinutes(), `the curse's ${k} (${v}) sits on the character's clock (${ownMinutes()})`);
    }
    return seen;
  };
  const off = turnedAfter(false);
  assert.deepEqual(off, { dream: 12, turn: 84 }, 'the control: offline the dream at the first midnight, the turn at the fourth (DFU\'s daysPast > 0 and > 3)');
  assert.deepEqual(turnedAfter(true), off, 'online: the same rested hours, the same dream and the same turn');
});

test('LIVED1: the vampire\'s DAY is the world\'s sky and their THIRST is their own - a vampire whose rests ran their clock to noon is still at night\'s +20 under a night sky, and hungry by their own day', () => {
  const worldNight = 400 * D + 23 * H;
  const own = worldNight + 13 * H;   // rested thirteen hours ahead of the world: noon on their clock
  const e = player();
  const { t, ticker } = lane(true, { own, world: worldNight, entity: e });
  const curse = createVampirismCurse(e, 0, { now: own - D - 60 });   // fed a day and an hour ago, on their clock
  t.clock += 1;
  ticker.tick(1 / 60);
  assert.equal(curse.statMods.strength, VAMPIRE_STAT_MOD, 'the sky is the world\'s: night, +20');
  assert.equal(curse.satiated, false, 'the thirst is the character\'s: more than a day since they fed, by their own clock');
  assert.ok(worldMinutes() - (own - D - 60) <= D, 'where the world\'s clock alone would have called them fed');
});

test('LIVED1 (seam 1): a rest across midnight rolls a disease\'s day ONCE - the character\'s clock never runs behind itself, so no round reads a day in the past and gives it back', () => {
  const own = 50 * D + 20 * H;
  const { e, t, ticker } = lane(true, { own, world: 700 * D + 10 * H });
  const entry = startDisease(e, DISEASES.CalironsCurse, Math.floor(own / D), () => 0.5);
  const left0 = entry.daysOfSymptomsLeft;
  ticker.advance(8 * H);   // the night, across the character's midnight
  assert.equal(entry.daysOfSymptomsLeft, left0 - 1, 'the midnight the night crossed is one day');
  for (let i = 0; i < 6; i++) { t.clock += 5; ticker.tick(1 / 60); }
  assert.equal(entry.daysOfSymptomsLeft, left0 - 1, 'the world\'s minutes after it give nothing back and roll nothing again');
  assert.equal(entry.lastDay, Math.floor(ownMinutes() / D));
});

test('LIVED1 (seam 2): a load straight after an online rest keeps the needs - their record is on the character\'s clock, never ahead of it, so nothing reads as a meal in the future and resets for free', () => {
  const own = 80 * D + 8 * H, world = 30 * D;   // their nights ran their clock well ahead of the world's
  const save = (survival) => {
    lane(true, { own, world });
    const snap = JSON.parse(JSON.stringify(snapshotPlayer(player({ survival }), { classicMinutes: Math.floor(ownMinutes()) })));
    assert.equal(snap.worldMinutes, world, 'the online save carries the world\'s minute it left at');
    return snap;
  };
  const record = () => ({ lastAte: own - 5 * H, thirst: 40, wet: 0, sleepDebt: 1, awakeSince: own - 30, exposure: 0, fed: 0, drunk: 0, rotMinutes: 0, rotDays: 0, stiffUntil: 0, lastMinute: own });
  const snap = save(record());
  const back = player();
  restorePlayer(back, snap);
  assert.equal(ownMinutes(), own, 'the character\'s clock restored as it stood');
  assert.deepEqual([back.survival.lastAte, back.survival.thirst, back.survival.awakeSince], [own - 5 * H, 40, own - 30], 'the thirst and the hunger stand');
  // SURV7's kindness stands: a break longer than the world's day comes back fed, watered and rested
  const later = save(record());
  setSharedClock(() => world + 2 * D);
  const rested = player();
  restorePlayer(rested, later);
  assert.equal(rested.survival.thirst, 40, 'AUDIT LIVED1b P4: the break is measured on the relay\'s clock, once it is heard');
  hearSharedClock();
  assert.equal(rested.survival.thirst, 0, 'two world days away: fresh');
});

test('LIVED1 (seam 3): a rest in a rented room spends the room - the landlord reads the clock the rest moves, so the room ends with the night that ran it out', () => {
  const own = 90 * D + 23 * H;
  const { e, t, ticker } = lane(true, { own, world: 800 * D + 9 * H });
  e.rentedRooms = [{ mapId: 1, buildingKey: 2, allocatedBedIndex: 0, expiryMinutes: own + 30 }];
  ticker.advance(20);
  assert.equal(e.rentedRooms.length, 1, 'twenty minutes in: the room is theirs');
  ticker.advance(2 * H);
  assert.equal(e.rentedRooms.length, 0, 'the night ran past the room\'s end and the midnight the landlord sweeps at (PlayerEntity.cs:449)');
  assert.equal(worldMinutes(), t.clock, 'with the world\'s clock where it stood');
});

test('LIVED1 (seam 5): a conjured item runs out in a long rest online, as a spell does - its hour is on the character\'s clock', () => {
  const own = 20 * D + 10 * H;
  const { e } = lane(true, { own, world: 5 * D });
  e.items.push({ name: 'Conjured Dagger', timeForItemToDisappear: own + 3 * H });
  e.lastGameMinutes = own;
  createPlayerTicker(e).advance(8 * H);
  assert.equal(e.items.length, 0, 'gone by morning');
});

test('LIVED1: arrival and death move NOTHING of the character\'s - the clock that stood needs nothing carried; the world\'s reading alone re-anchors, and an absence pays TM-1\'s recovery over the world\'s minutes', () => {
  const N = NORMALIZE_INTERVAL_MINUTES;
  // the save's door: the character left the world at N - 5 and comes back at 3N + 10 (three boundaries of the world's)
  const own = 2 * N + 100;   // [own, now) would cross one boundary; the world's [left, now) crosses three
  lane(true, { own, world: N - 5 });
  // REP4 (the reputation overhaul): PIN MOVED - the recovery is weekly now, so the name starts deep enough (-100) for the
  // WORLD's span (thirty-three weeks) and the character's own (sixteen) to read differently, as DFU's 3 and 1 boundaries did
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(player({ legalRep: [-100], rentedRooms: [{ expiryMinutes: own + 600 }] }), { classicMinutes: own })));
  setSharedClock(() => 3 * N + 10);
  const back = player();
  restorePlayer(back, snap);
  assert.equal(ownMinutes(), own, 'their clock is where they left it');
  assert.equal(back.rentedRooms[0].expiryMinutes, own + 600, 'the room keeps its ten hours');
  assert.equal(back.legalRep[0], -100, 'AUDIT LIVED1b P4: the absence waits for the relay\'s clock');
  hearSharedClock();
  assert.equal(back.legalRep[0], -67, 'the absence\'s one arm, measured on the WORLD\'s minutes: thirty-three of its weeks, thirty-three points back');
  // death: the corpse lies an hour under the screen; the rise moves nothing of theirs
  const { e, t } = lane(true, { own: 5000, world: 9000 });
  e.survival = { lastMinute: 5000, lastAte: 4900, awakeSince: 4000 };
  e.health = 0;
  t.clock += H;
  skipDeadMinutes(e, t.clock);
  assert.deepEqual([ownMinutes(), e.lastGameMinutes, e.survival.lastMinute], [5000, 5000, 5000], 'the dead live no minute');
  e.health = 30;
  t.clock += 2;
  createPlayerTicker(e).tick(1 / 60);
  assert.equal(ownMinutes(), 5002, 'the first tick up lives two minutes, not the hour on the screen');
});

test('LIVED1 words: a deadline on the character\'s clock is said in their time and in play; a refusal of the sun says when the WORLD\'s night falls, in real minutes', () => {
  setSharedClock(() => 700 * D + 12 * H);   // the world's noon
  setOwnMinutes(100 * D);
  assert.equal(ownTimeLeftText(100 * D + 7 * D), '7 days of your time (14h of play)', 'a week\'s room: fourteen hours of play at the most');
  assert.equal(ownTimeLeftText(100 * D + 3 * D + 5 * H), '3 days 5 hours of your time (6h 25m of play)');
  assert.equal(worldNightfallText(), 'The sun is the world\'s - night falls in about 30 minutes.', 'six game hours to dusk are thirty real minutes');
  setSharedClock(() => 700 * D + 17 * H + 59);
  assert.equal(worldNightfallText(), 'The sun is the world\'s - night falls in about 1 minute.');
  setSharedClock(() => 700 * D + 20 * H);
  assert.equal(worldNightfallText(), null, 'at night there is nothing to wait for');
  const w = rd('src/scenes/world.js');
  assert.match(w, /function withNightfall\(text\) \{ const nf = worldNightfallText\(\); return nf \? `\$\{text\} \$\{nf\}` : text; \}/, 'the host\'s one composer');
  assert.equal((w.match(/withNightfall\(/g) ?? []).length, 2, 'PARTY-TRAVEL\'s one, to the chat');   // PIN MOVED (HOOD-CAREER): the party's two sun rungs are one read (careerFastTravelBlock ?? racialFastTravelBlock), said once
  assert.equal((w.match(/sayWithNightfall\(/g) ?? []).length, 5, 'and the map door\'s two rungs, as two HUD rows (AUDIT LIVED1 M) - and the driver\'s map\'s two online (AUDIT IT1 W2, PIN MOVED)');
});

test('LIVED1: the tavern\'s calendar is the WORLD\'s - a Heart\'s Day room is free by the world\'s date, whatever day the character\'s own clock reads', () => {
  const own = 200 * D + 10 * H;                       // the character's day 201
  const worldEve = (HEARTS_DAY - 1) * D + 15 * H;     // the world's day 46: a night's rental is free (CalculateRoomCost)
  const rows = (id) => [{ text: `#${id}`, center: true }];
  const offer = (worldNow) => {
    const w = new TavernWindow({
      entity: { name: 'Rin', health: 20, maxHealth: 50, rentedRooms: [], goldPieces: 5000, items: [], stats: { personality: 50 } },
      rows, now: () => own, mapId: () => 7, buildingKey: () => 42, buildingName: () => 'The Dancing Dagger', quality: () => 10, bedCount: () => 4,
      freeRooms: () => false, skills: () => ({ mercantile: 50, personality: 50 }), heal() {}, onTalk() {}, onClose() {}, rolls: () => 0.5,
      ...(worldNow ? { worldNow } : {}),
    });
    const [x, y, rw, rh] = TAVERN_RECTS.room;
    w.click(TAVERN_PANEL_X + x + rw / 2, TAVERN_PANEL_Y + y + rh / 2);
    for (let i = 0; i < 12; i++) w.flow.input('backspace');
    w.flow.input('char:1');
    w.flow.input('Enter');
    return w.flow.top.rows.map((r) => r.text);
  };
  assert.deepEqual(offer(() => worldEve), [ROOM_FREE_HEARTS_DAY], 'the world\'s Heart\'s Day');
  assert.notDeepEqual(offer(null), [ROOM_FREE_HEARTS_DAY], 'the character\'s own day 201 is no holiday - with no world clock handed, the one clock decides');
  const modes = rd('src/scenes/worldModes.js');
  assert.match(modes, /worldNow: \(\) => Math\.floor\(skyMinutes\(\)\),/, 'the host hands the world\'s clock for the calendar');   // TIME1: the world's calendar is the SKY's
  assert.match(modes, /ownTimeOf: \(m\) => ownTimeLeftText\(m\),/, 'and the character\'s for the room\'s time');
});

test('LIVED1 by source: every RaiseTime online is the character\'s - the ticker\'s advance, the journey, the sentence, the cures, a quest\'s RaiseTime and the turn\'s fortnight - and the sky reads stay the world\'s', () => {
  const shared = rd('src/scenes/shared.js'), w = rd('src/scenes/world.js'), arrest = rd('src/scenes/arrestFlow.js'), tick = rd('src/systems/worldTick.js');
  assert.match(shared, /advance\(minutes\) \{\s*if \(!\(minutes > 0\)\) return null;\s*(?:\/\/[^\n]*\n\s*)*if \(sharedClockOn\(\)\) \{ if \(tickInFlight\(\)\) \{ advanceOwnMinutes\(minutes\); _raiseWaiting = true; return null; \} return this\.tick\(0, undefined, 0, minutes\); \}/, 'the ticker\'s advance: the same tick, on the character\'s clock (AUDIT LIVED1 J: a bare move from inside a tick - AUDIT LIVED1b K1: walked the moment the window in hand is done)');
  assert.match(shared, /raiseTime: \(seconds\) => \{ setSyntheticTimeIncrease\(true\); return advanceOwnMinutes\(seconds \/ 60\); \}/, 'the vampire\'s fortnight');
  assert.match(w, /setSyntheticTimeIncrease\(true\); playerTicker\.advance\(computed\.minutes\);/, 'the journey, in both lanes');
  assert.match(arrest, /advanceDays = \(days\) => advanceOwnMinutes\(days \* MINUTES_PER_DAY\),/, 'the sentence');
  // AUDIT LIVED1b T5: the cures and a quest's RaiseTime, which this title named and the body did not assert
  assert.match(w, /cureVampirism\(playerEntity, \{ advanceMinutes: \(m\) => advanceOwnMinutes\(m\) \}\)/, 'the vampirism cure\'s minute');
  assert.match(w, /cureLycanthropy\(playerEntity, \{\n\s*nowMinutes: Math\.floor\(ownMinutes\(\)\),\n\s*advanceMinutes: \(m\) => advanceOwnMinutes\(m\),/, 'the lycanthropy cure\'s stamp and minute');
  assert.match(w, /raiseTime: \(seconds\) => advanceOwnMinutes\(seconds \/ 60\),/, 'a quest\'s RaiseTime');
  // the tick's two windows: the broker, the loop and the needs on the character's; the sky on the world's
  assert.match(tick, /_ownMinutes = classicMinutes \+ \(worldTo - worldFrom\) \+ \(raiseMinutes > 0 \? raiseMinutes : 0\);/);
  assert.match(tick, /const magicRoundWindow = claimMagicRounds\(classicMinutes, next\);/);
  assert.match(tick, /skyMinutes: _sharedClock \? skyMinutes\(\) : null/, 'the rounds\' sky is the world\'s reading');   // TIME1: the sky's own clock, not the event window's end
  assert.match(tick, /evolveClimateWeathers\(_sharedClock \? Math\.floor\(worldTo\) : nowMinutes\);/, 'the sky\'s hours are the world\'s');
  for (const host of ['src/systems/encounters.js', 'src/systems/campEncounters.js']) {
    assert.match(rd(host), /Number\.isFinite\(ctx\.skyMinutes\) \? ctx\.skyMinutes : ctx\.gameMinutes/, `${host}: the spawn table's night or day is the sky's`);
  }
});
