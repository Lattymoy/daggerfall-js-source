// THE PRISON SEQUENCE AND THE JAIL-SKIP TRIO (Road to 1:1, a3).
//
// DaggerfallCourtWindow.cs's serving-time half and ReleaseFromPrison's
// five lines. The port ended at the sentence: state 3's InPrison and
// prison screen were absent, the day skip happened at the moment of the
// verdict instead of at the END of a 0.3-second-per-day countdown, and
// ReleaseFromPrison's PreventEnemySpawns, ClearEnemies and
// PositionPlayerAtLocationEntrance were three FLAGGED lines with no
// port at all.
//
// The laws pinned here:
//   - StreamingWorld.PositionPlayerToLocation (:1470-1593) - the random
//     side, the facing, the extra distance, the nearest start marker.
//   - DaggerfallCourtWindow.UpdatePrisonScreen (:465-480) - decrement
//     FIRST, and the clock moves only on the zero.
//   - ReleaseFromPrison (:482-491) and the ONE arm (the guild rescue)
//     that does not reposition.
//   - PlayerEntity.PreventEnemySpawns (:482, :560, :524-525).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  positionPlayerToLocation, locationStartMarkers, entranceOptionsForLocationType,
  EXTRA_DISTANCE, LOCATION_SIDES, EDITOR_FLATS_ARCHIVE, START_MARKER_RECORD,
  LOCATION_TYPE_TOWN_CITY, LOCATION_TYPE_HOME_YOUR_SHIPS,
} from '../src/world/locationEntrance.js';
import { RMB_SIDE } from '../src/world/locationLayout.js';
import {
  PrisonScreenWindow, PRISON_UPDATE_INTERVAL, PRISON_UPDATE_INTERVAL_FAST,
  DAYS_UNTIL_FREEDOM, daysUntilFreedomText, DAYS_LABEL_COLOR, DAYS_LABEL_SHADOW,
  DAYS_LABEL_POS, PRISON_IMG, COURT_IMG,
} from '../src/ui/prisonScreen.js';
import { createArrestFlow, RELEASE_MINUTES } from '../src/scenes/arrestFlow.js';
import { CRIMES } from '../src/systems/court.js';
import { FACTION_TYPES, SOCIAL_GROUPS, GUILD_GROUPS } from '../src/formats/factionFile.js';
import { intermittentEnemySpawn } from '../src/systems/encounters.js';
import { CLIMATES } from '../src/formats/mapsFile.js';
import { maxFatigue } from '../src/systems/statMods.js';
import { worldMinutes, setWorldMinutes } from '../src/systems/worldTick.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(HERE, '..', rel), 'utf8');

// ---------------------------------------------------------------
// StreamingWorld.PositionPlayerToLocation - the RandomStartMarker arm
// ---------------------------------------------------------------

test('entrance: one of four sides, EXTRA_DISTANCE outside it, facing back in', () => {
  // :1528-1530 - "Extra distance places player a little bit outside
  // location area", RMBSide * 0.1.
  assert.equal(EXTRA_DISTANCE, RMB_SIDE * 0.1);
  // A 2x2 location on a zero origin: half extents are one block each.
  const half = RMB_SIDE;
  const at = (r) => positionPlayerToLocation({ mapWidth: 2, mapHeight: 2, roll: () => r });
  // Random.Range(0, 4) - the four cases in DFU's own switch order
  // (:1539-1564), each with its SetFacing degrees.
  const north = at(0.0);
  assert.deepEqual(north.pos, [half, 0, half + (half + EXTRA_DISTANCE)]);
  assert.equal(north.yaw, Math.PI, 'north stands at +Z and faces 180 - back at the town');
  const south = at(0.25);
  assert.deepEqual(south.pos, [half, 0, half - (half + EXTRA_DISTANCE)]);
  assert.equal(south.yaw, 0);
  const east = at(0.5);
  assert.deepEqual(east.pos, [half + (half + EXTRA_DISTANCE), 0, half]);
  assert.equal(east.yaw, (270 * Math.PI) / 180);
  const west = at(0.75);
  assert.deepEqual(west.pos, [half - (half + EXTRA_DISTANCE), 0, half]);
  assert.equal(west.yaw, (90 * Math.PI) / 180);
  assert.deepEqual(LOCATION_SIDES.map((s) => s.facing), [180, 0, 270, 90]);
  // the ORIGIN offsets every one of them (:1523-1526)
  const off = positionPlayerToLocation({ mapWidth: 2, mapHeight: 2, origin: [100, 5, 200], roll: () => 0 });
  assert.deepEqual(off.pos, [100 + half, 5, 200 + half + (half + EXTRA_DISTANCE)]);
});

test('entrance: useNearestStartMarker moves to the CLOSEST marker, and only when asked', () => {
  // :1568-1588 - the distance is measured from the outside point, in
  // three dimensions, and the marker wins.
  const markers = [[0, 0, 0], [200, 0, 220]];
  const opts = { mapWidth: 2, mapHeight: 2, startMarkers: markers, roll: () => 0 };   // north
  const plain = positionPlayerToLocation(opts);
  assert.equal(plain.usedStartMarker, false, 'a hamlet is not snapped to a marker');
  assert.deepEqual(plain.pos, [RMB_SIDE, 0, RMB_SIDE * 2 + EXTRA_DISTANCE]);
  const snapped = positionPlayerToLocation({ ...opts, useNearestStartMarker: true });
  assert.equal(snapped.usedStartMarker, true);
  assert.deepEqual(snapped.pos, [200, 0, 220], 'the northern marker, not the origin one');
  assert.equal(snapped.yaw, plain.yaw, 'the facing is the SIDE\'s, kept across the snap');
  // "if (closestMarker != -1)" - a location with no markers keeps the
  // outside point even when the type asks for one (:1583-1588).
  const none = positionPlayerToLocation({ ...opts, startMarkers: [], useNearestStartMarker: true });
  assert.deepEqual(none.pos, plain.pos);
  assert.equal(none.usedStartMarker, false);
});

test('entrance: the two booleans come off the LOCATION TYPE (:1462-1464)', () => {
  assert.deepEqual(entranceOptionsForLocationType(LOCATION_TYPE_TOWN_CITY),
    { useNearestStartMarker: true, grounded: true });
  assert.deepEqual(entranceOptionsForLocationType(LOCATION_TYPE_HOME_YOUR_SHIPS),
    { useNearestStartMarker: true, grounded: false }, 'the ship is the one that is NOT grounded');
  // a hamlet (1) is neither
  assert.deepEqual(entranceOptionsForLocationType(1),
    { useNearestStartMarker: false, grounded: true });
});

test('entrance: the markers are archive 199 record 10, in the LOCATION frame', () => {
  // DaggerfallLocation.EnumerateStartMarkers (:289-301) over
  // MaterialReader.GetEditorFlatType's record 10 (:1000-1001).
  assert.equal(EDITOR_FLATS_ARCHIVE, 199);
  assert.equal(START_MARKER_RECORD, 10);
  const blocks = [
    { originX: 0, originZ: 0, flats: [{ archive: 199, record: 8, x: 1, y: 0, z: 1 }] },      // Enter, not Start
    { originX: RMB_SIDE, originZ: 0, flats: [
      { archive: 199, record: 10, x: 5, y: 2, z: 7 },
      { archive: 210, record: 10, x: 9, y: 0, z: 9 },                                        // a LIGHT, not a marker
    ] },
  ];
  assert.deepEqual(locationStartMarkers(blocks), [[RMB_SIDE + 5, 2, 7]],
    'the block origin is added, and only the 199/10 flat counts');
  assert.deepEqual(locationStartMarkers(null), []);
});

// ---------------------------------------------------------------
// The prison screen - SwitchToPrisonScreen + UpdatePrisonScreen
// ---------------------------------------------------------------

test('prison screen: the label is the Internal_Strings row, and the panel is PRIS00I0', () => {
  assert.equal(PRISON_IMG, 'PRIS00I0.IMG');   // nativeImgName2 (:32)
  assert.equal(COURT_IMG, 'CORT01I0.IMG');    // nativeImgName  (:31)
  assert.equal(DAYS_UNTIL_FREEDOM, '%d days until freedom.');   // Internal_Strings.csv:108
  assert.equal(daysUntilFreedomText(7), '7 days until freedom.');
  assert.equal(daysUntilFreedomText(3, () => 'freedom in %d'), 'freedom in 3',
    'a host TextManager answer wins over the shipped row');
  assert.equal(daysUntilFreedomText(3, () => ''), '3 days until freedom.',
    'and an EMPTY answer falls back rather than showing nothing');
  // DaggerfallUI.cs:72-73, and the label anchor at :91.
  assert.deepEqual(DAYS_LABEL_COLOR.map((c) => Math.round(c * 255)), [232, 196, 76, 255]);
  assert.deepEqual(DAYS_LABEL_SHADOW.map((c) => Math.round(c * 255)), [48, 36, 20, 255]);
  assert.deepEqual(DAYS_LABEL_POS, [156, 165]);
});

test('prison screen: one day per 0.3s, decrement FIRST, and the clock moves only on zero', () => {
  // prisonUpdateInterval (:55) and the "Not in classic" accelerator (:302).
  assert.equal(PRISON_UPDATE_INTERVAL, 0.3);
  assert.equal(PRISON_UPDATE_INTERVAL_FAST, 0.001);
  const ends = [];
  const w = new PrisonScreenWindow({ daysInPrison: 3, onEndPrisonTime: (d) => ends.push(d) });
  // SwitchToPrisonScreen (:522-523) writes the FULL sentence before a
  // single tick has run - the first number the player reads is 3.
  assert.equal(w.label, '3 days until freedom.');
  assert.equal(w.daysInPrisonLeft, 3);
  w.tick(0.29);
  assert.equal(w.daysInPrisonLeft, 3, 'below the interval nothing happens');
  w.tick(0.01);
  assert.equal(w.label, '2 days until freedom.', 'UpdatePrisonScreen decrements THEN labels');
  assert.deepEqual(ends, [], 'and the clock has not moved');
  w.tick(PRISON_UPDATE_INTERVAL);
  assert.equal(w.daysInPrisonLeft, 1);
  assert.deepEqual(ends, []);
  assert.equal(w.done, false, 'AllowCancel is false - the window stands until the term does');
  w.tick(PRISON_UPDATE_INTERVAL);
  assert.equal(w.daysInPrisonLeft, 0);
  assert.equal(w.label, '0 days until freedom.');
  assert.deepEqual(ends, [3], 'ONE raise, of the WHOLE sentence (:475), at the end of the count');
  assert.equal(w.done, true, 'and only then does state 100 reach ReleaseFromPrison');
  // a finished window does not keep counting
  w.tick(10);
  assert.deepEqual(ends, [3]);
  assert.equal(w.daysInPrisonLeft, 0);
});

test('prison screen: a long frame ticks ONE day, and no key cuts the sentence short', () => {
  // DFU re-stamps prisonUpdateTimer on each fire and returns, so a
  // stalled frame does not fast-forward the term (:306-315).
  const w = new PrisonScreenWindow({ daysInPrison: 10 });
  w.tick(5);
  assert.equal(w.daysInPrisonLeft, 9, 'five seconds of frame is still one day');
  // AllowCancel = false (:97)
  for (const key of ['Escape', 'Enter', 'KeyE', 'confirm', 'back']) w.input(key);
  assert.equal(w.done, false);
  assert.equal(w.daysInPrisonLeft, 9);
  // the accelerator is a DEP, not a default (:301-304, "Not in classic")
  const fast = new PrisonScreenWindow({ daysInPrison: 10, speedUp: () => true });
  fast.tick(PRISON_UPDATE_INTERVAL_FAST);
  assert.equal(fast.daysInPrisonLeft, 9);
});

// ---------------------------------------------------------------
// The flow: state 3 -> the countdown -> ReleaseFromPrison
// ---------------------------------------------------------------

function mkTalk() {
  const slot = { win: null, onClosed: null };
  return {
    slot,
    texts: () => null,
    showOverlay(win, onClosed = null) { slot.win = win; slot.onClosed = onClosed; },
    /** what townTalk.frame does when a window reports done */
    close() { const cb = slot.onClosed; slot.win = null; slot.onClosed = null; cb?.(); },
  };
}

/** A defendant with NO gold, so every unit of the penalty becomes
 *  prison days whatever the coin flips do (startCourt's :169-174). */
function mkConvict() {
  return {
    name: 'Mack', health: 1, maxHealth: 40, fatigue: 0, maxFatigue: 100,
    magicka: 0, maxMagicka: 20, endurance: 50, strength: 50, willpower: 50,
    stats: { endurance: 50, strength: 50, willpower: 50, personality: 50 },
    crimeCommitted: CRIMES.Murder, legalRep: { 17: 0 }, items: [], skills: 30,
    haveShownSurrenderDialogue: true, arrested: false,
  };
}

/** ROAD-Ar R17. The People faction of region 17, the one record
 *  GetPeopleOfCurrentRegion looks for (type 15 / Commoners /
 *  GeneralPopulace). A root with no children, allies or enemies, so
 *  ChangeReputation's propagate walk lands the whole amount on it and
 *  nowhere else - which keeps this pin off the FACTION.TXT data files
 *  that gate court.test.js's own faction arm. */
const PEOPLE_ID = 900;
const mkPeopleStore = () => ({
  dict: new Map([[PEOPLE_ID, {
    id: PEOPLE_ID, name: 'People of Region 17', parent: 0, children: null,
    type: FACTION_TYPES.People, sgroup: SOCIAL_GROUPS.Commoners,
    ggroup: GUILD_GROUPS.GeneralPopulace, region: 17, rep: 0,
  }]]),
});

function driveToSentence(over = {}, playerOver = {}) {
  const townTalk = mkTalk();
  const player = Object.assign(mkConvict(), playerOver);
  const log = { days: [], minutes: [], cleared: 0, repositioned: 0 };
  const flow = createArrestFlow({
    townTalk, playerEntity: player, regionIndex: 17,
    advanceDays: (d) => log.days.push(d),
    advanceMinutes: (m) => log.minutes.push(m),
    guildRankOf: () => null,           // no rescue on this path
    clearEnemies: () => { log.cleared++; },
    positionPlayerAtLocationEntrance: () => { log.repositioned++; },
    ...over,
  });
  flow.startCourtFlow();
  // ROAD-Ar R17: the reputation as the VERDICT finds it. State 3's
  // credit is a delta on top of the arrest's own debit, so only the
  // change across this one keypress is the law being pinned.
  const before = {
    legal: player.legalRep?.[17] ?? 0,
    people: player.factionRep?.dict.get(PEOPLE_ID)?.rep ?? 0,
  };
  townTalk.slot.win.input('KeyG');    // Guilty - halve, pay, serve
  return { townTalk, player, log, flow, before };
}

test('flow: the guilty verdict opens the PRISON SCREEN and moves nothing yet', () => {
  const { townTalk, player, log, before } = driveToSentence({}, { factionRep: mkPeopleStore() });
  const win = townTalk.slot.win;
  assert.ok(win instanceof PrisonScreenWindow, 'state 3 switches the panel, it does not print a line');
  assert.ok(win.daysInPrison > 0);
  // state 3 (:254-262) is InPrison + the screen + the reputation, and
  // that is ALL of it.
  assert.equal(player.inPrison, true);
  assert.deepEqual(log.days, [], 'the days have not passed - the countdown has not run');
  assert.deepEqual(log.minutes, [], 'nor has the release');
  assert.equal(log.cleared, 0);
  assert.equal(log.repositioned, 0);
  assert.equal(player.health, 1, 'and the surrender\'s 1 HP stands until the term ends');
  // ROAD-Ar R17: ...and the REPUTATION half of that sentence, which the
  // comment above named and nothing asserted - deleting
  // raiseRepForSentence from arrestFlow's prison arm left the whole
  // suite green. RaiseReputationForDoingSentence (PlayerEntity.cs:
  // 2301-2311) off halfOfLegalRepPlayerLostFromCrime (:2342 -
  // reputationLossPerCrime[crime] / 2). Murder is crime 5,
  // reputationLossPerCrime[5] = 0x14 = 20, so half = 10: the DFU
  // LITERALS, not court.js's own table.
  assert.equal(player.crimeCommitted, CRIMES.Murder, 'the convict\'s crime, unchanged by the verdict');
  assert.equal(player.legalRep[17] - before.legal, 9, ':2304 - LegalRep += half - 1');
  assert.equal(player.factionRep.dict.get(PEOPLE_ID).rep - before.people, 4,
    ':2310 - the region People faction by (half - 1) / 2, truncating');
});

test('flow: the countdown\'s ZERO raises the clock behind BOTH prevent flags, then releases', () => {
  const { townTalk, player, log } = driveToSentence();
  const win = townTalk.slot.win;
  const days = win.daysInPrison;
  for (let i = 0; i < days; i++) win.tick(PRISON_UPDATE_INTERVAL);
  // UpdatePrisonScreen's zero arm (:471-479), in ITS order.
  assert.equal(player.preventEnemySpawns, true, ':473 - the catch-up spawn loop is shielded');
  assert.equal(player.preventNormalizingReputations, true, ':474');
  assert.deepEqual(log.days, [days], 'ONE RaiseTime, the whole sentence (:475)');
  assert.equal(player.inPrison, false, ':477');
  assert.equal(player.health, player.maxHealth, ':478 - the refill lands at the END of the term');
  assert.equal(player.fatigue, maxFatigue(player), 'a FULL refill - fatigue and magicka too');
  assert.equal(player.magicka, player.maxMagicka);
  assert.equal(win.done, true);
  // and only the window CLOSING runs ReleaseFromPrison (:482-491)
  assert.deepEqual(log.minutes, [], 'the four hours are the release\'s, not the countdown\'s');
  townTalk.close();
  assert.deepEqual(log.minutes, [RELEASE_MINUTES], ':485 - RaiseTime(240 * 60)');
  assert.equal(player.crimeCommitted, 0, ':486');
  assert.equal(log.repositioned, 1, ':488 - repositionPlayer was set at :260');
  assert.equal(log.cleared, 1, ':489 - ClearEnemies');
  assert.equal(player.arrested, false);
  assert.equal(player.preventEnemySpawns, true, ':484 sets it again on the way out');
});

test('flow: the GUILD RESCUE is the one exit that does not reposition', () => {
  // :191-194 goes straight to state 100 without ever setting
  // repositionPlayer, so ReleaseFromPrison's `if (repositionPlayer)`
  // is false - the rescued member walks out where they stood. The
  // sweep and the clock still run.
  const townTalk = mkTalk();
  const player = mkConvict();
  const log = { minutes: [], cleared: 0, repositioned: 0 };
  const flow = createArrestFlow({
    townTalk, playerEntity: player, regionIndex: 17,
    advanceMinutes: (m) => log.minutes.push(m),
    guildRankOf: (id) => (id === 108 ? 19 : null),   // The Dark Brotherhood, on a murder
    rolls: () => 0,
    clearEnemies: () => { log.cleared++; },
    positionPlayerAtLocationEntrance: () => { log.repositioned++; },
  });
  flow.startCourtFlow();
  assert.equal(log.repositioned, 0, 'no reposition - the ONE arm without it');
  assert.equal(log.cleared, 1, 'but ClearEnemies still runs');
  assert.deepEqual(log.minutes, [RELEASE_MINUTES]);
  assert.equal(player.crimeCommitted, 0);
  assert.equal(player.health, player.maxHealth, ':213 - FillVitalSigns BEFORE the release');
});

test('flow: the ACQUITTAL repositions too - state 6 sets the flag (:292-296)', () => {
  const townTalk = mkTalk();
  const player = mkConvict();
  player.stats.personality = 100;
  player.skills = 100;
  const log = { minutes: [], cleared: 0, repositioned: 0 };
  const flow = createArrestFlow({
    townTalk, playerEntity: player, regionIndex: 17,
    advanceMinutes: (m) => log.minutes.push(m),
    guildRankOf: () => null,
    clearEnemies: () => { log.cleared++; },
    positionPlayerAtLocationEntrance: () => { log.repositioned++; },
  });
  flow.startCourtFlow();
  townTalk.slot.win.input('KeyN');       // Not guilty
  townTalk.slot.win.input('KeyD');       // Debate - chance is clamped at 95, rolls default
  // whichever way the roll fell, the exit repositions: 'free' goes
  // through state 6 and the guilty verdict through state 2/3.
  if (townTalk.slot.win instanceof PrisonScreenWindow) {
    const w = townTalk.slot.win;
    for (let i = 0; i < w.daysInPrison; i++) w.tick(PRISON_UPDATE_INTERVAL);
    townTalk.close();
  } else if (log.repositioned === 0) {
    townTalk.close();                    // the 8055 box, whose close runs the verdict
    if (townTalk.slot.win instanceof PrisonScreenWindow) {
      const w = townTalk.slot.win;
      for (let i = 0; i < w.daysInPrison; i++) w.tick(PRISON_UPDATE_INTERVAL);
      townTalk.close();
    }
  }
  assert.equal(log.repositioned, 1, 'every non-rescue exit is put down at the entrance');
  assert.equal(log.cleared, 1);
});

test('flow: the world clock really moves - the DEFAULT advanceDays is the one clock', () => {
  // The flow defaults advanceDays/advanceMinutes to worldTick's own
  // clock (AUDIT 21 F8), so a host that wires neither still serves the
  // sentence. Drive it with no hooks at all.
  const before = worldMinutes();
  try {
    const townTalk = mkTalk();
    const player = mkConvict();
    const flow = createArrestFlow({ townTalk, playerEntity: player, regionIndex: 17, guildRankOf: () => null });
    flow.startCourtFlow();
    townTalk.slot.win.input('KeyG');
    const w = townTalk.slot.win;
    const days = w.daysInPrison;
    assert.equal(worldMinutes(), before, 'the verdict alone costs no time');
    for (let i = 0; i < days; i++) w.tick(PRISON_UPDATE_INTERVAL);
    townTalk.close();
    assert.equal(worldMinutes(), before + days * 1440 + RELEASE_MINUTES,
      'the sentence AND the release\'s four hours');
  } finally {
    setWorldMinutes(before);
  }
});

// ---------------------------------------------------------------
// PreventEnemySpawns - the flag with a reader at last
// ---------------------------------------------------------------

test('encounters: PreventEnemySpawns refuses the spawn roll outright (:560)', () => {
  // A minute the cadence WOULD open on, in a wilderness pixel at night.
  const ctx = { gameMinutes: 1440, inside: false, inLocationRect: false, climateIndex: CLIMATES.Woodlands, playerLevel: 1 };
  const hit = intermittentEnemySpawn({ ...ctx }, () => 0);
  assert.ok(hit, 'the control case spawns');
  assert.equal(intermittentEnemySpawn({ ...ctx, preventEnemySpawns: true }, () => 0), null,
    'and the flag refuses before a single die is thrown');
});

test('host: the world catch-up loop is inside the flag and clears it at the tail', () => {
  // PlayerEntity.Update:479-525. The whole loop - the spawn roll AND
  // the passive guard rolls with it - sits inside `if
  // (!preventEnemySpawns)`, lastGameMinutes advances OUTSIDE it, and
  // the flag is cleared at the tail of the same update. It is cleared
  // HERE and not in worldTick because this function is the loop that
  // reads it; a clear in the frame's earlier update would race it.
  const world = read('src/scenes/world.js');
  assert.match(world, /const span = playerEntity\.preventEnemySpawns \? 0 : Math\.min\(now - _lastEncMinutes, 1440\);/,
    'the guard wraps the loop by emptying its span');
  assert.match(world, /_lastEncMinutes = now;\s*\n\s*\/\/ :524-525[^\n]*\n\s*if \(playerEntity\.preventEnemySpawns\) playerEntity\.preventEnemySpawns = false;/,
    'the anchor advances first, then the flag clears - DFU\'s own order');
  // and the court's own two writers reach it
  const arrest = read('src/scenes/arrestFlow.js');
  assert.match(arrest, /playerEntity\.preventEnemySpawns = true;\s*\n\s*playerEntity\.preventNormalizingReputations = true;\s*\n\s*advanceDays\(days\);/,
    ':473-475 - both flags, then the one RaiseTime');
  assert.match(arrest, /playerEntity\.preventEnemySpawns = true;\s*\n\s*advanceMinutes\(RELEASE_MINUTES\);/,
    ':484-485 - the release raises the clock behind the flag too');
});

test('host: ReleaseFromPrison\'s last two lines are wired to the world', () => {
  const world = read('src/scenes/world.js');
  // the seams the flow asks for
  assert.match(world, /clearEnemies: \(\) => \{ for \(const f of \[\.\.\.exteriorFoes\.foes\]\) \{ if \(!f\.dead\) exteriorFoes\.removeFoe\(f\); \} \}/,
    'GameManager.ClearEnemies over the encounter pool');
  assert.match(world, /positionPlayerAtLocationEntrance: \(\) => positionPlayerAtLocationEntrance\(\)/);
  // PositionPlayerAtLocationEntrance (:452-463): the HasLocation guard,
  // the same-pixel teleport, and RandomStartMarker's law.
  assert.match(world, /if \(!dfLoc\?\.exterior\?\.exteriorData\) return;\s*\/\/ HasLocation false/,
    'no location on the pixel means no teleport at all');
  assert.match(world, /_teleportToPixel\(px\.x, px\.y, local, \{ grounded: opts\.grounded \}\)/,
    'TeleportToCoordinates to the SAME map pixel');
  assert.match(world, /positionPlayerToLocation\(\{/, 'through the ported law, not a host guess');
  assert.match(world, /preloadPrisonScreenArt\(/, 'and PRIS00I0 warms at boot like every other window');
  // the FLAGGED trio is GONE from the flow - retiring a flag deletes
  // the sentence that named it.
  const arrest = read('src/scenes/arrestFlow.js');
  assert.ok(!/FLAGGED, still owed to their own slices/.test(arrest),
    'the FLAGGED list at clearArrest is closed');
});

test('host: InPrison is a real flag, so the sunlight read stops being a constant', () => {
  // PlayerEnterExit.cs:371 - `IsDay && !IsPlayerInside &&
  // !PlayerEntity.InPrison`. passiveSpecials has carried the seam
  // since V2c; worldModes left it absent with a note that the port
  // "serves a sentence as a clock move, never as a live scene the sun
  // could reach into". It is a live screen now.
  const wm = read('src/scenes/worldModes.js');
  assert.match(wm, /inPrison: \(\) => !!playerEntity\.inPrison,/);
  assert.ok(!/inPrison stays absent/.test(wm), 'and the note that said otherwise is gone');
  // the flow raises and lowers it: state 3 (:256) and OnPop (:438).
  const arrest = read('src/scenes/arrestFlow.js');
  assert.match(arrest, /playerEntity\.inPrison = true;/);
  assert.match(arrest, /playerEntity\.inPrison = false;\s*\/\/ OnPop/);
});
