import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  rollCampEncounter, rollCampEncounterOnChunkLoad, amGroupRollOwner, campWindowOpen, rollCampKind, rollCampChance,
  rollCampChanceOnChunkLoad, CAMP_WINDOW_MINUTES, CAMP_WINDOW_REAL_MINUTES, CAMP_SIZE, PACK_SIZE, CAMP_SPACING,
  PACK_SPACING, CAMP_ALERT_RADIUS, PACK_ALERT_RADIUS, MIN_CAMP_SPAWN_DISTANCE, MAX_CAMP_SPAWN_DISTANCE,
  CAMP_CHANCE, CAMP_CHANCE_ON_CHUNK_LOAD, GROUP_ROLL_RADIUS,
} from '../src/systems/campEncounters.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';
import { CLIMATES } from '../src/formats/mapsFile.js';
import { FEATURES } from '../src/systems/features.js';

// ═══ CAMP1: WILDERNESS CAMPS AND PACKS ═════════════════════════════
//
// Mac, 2026-09-17 ("daggerfalljsWildlifeSpawnsRespawn"): a rare group
// encounter outdoors - a settled camp or a pack crossing your path -
// on top of classic Daggerfall's one-at-a-time wandering monster. An
// ORIGINAL addition, not a DFU system: it reuses the encounter tables
// (chooseRandomEnemy) and the cadence loop (runEncounterTick), and
// adds one behaviour, a member that notices the player wakes its
// campmates. Two triggers: a guaranteed group every 15 REAL minutes of
// play, and a 15% roll each new map pixel entered. Online, exactly one
// of the players within 100m rolls (a deterministic lowest-id pick).

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const rollsOf = (list) => { let i = 0; return () => list[i++ % list.length]; };
const WILD = { inside: false, inLocationRect: false, preventEnemySpawns: false, climateIndex: CLIMATES.Woodlands, playerLevel: 5 };

test('CAMP1: the window is 15 REAL minutes of play, stated in game minutes through the one clock rate, and opens on exactly those minutes', () => {
  assert.equal(CAMP_WINDOW_REAL_MINUTES, 15);
  assert.equal(CAMP_WINDOW_MINUTES, 15 * 60 * CLASSIC_MINUTES_PER_SECOND);
  assert.equal(CAMP_WINDOW_MINUTES, 180, 'TimeScale 12: 180 game minutes');
  assert.equal(campWindowOpen(0), true);
  assert.equal(campWindowOpen(179), false);
  assert.equal(campWindowOpen(180), true);
  assert.equal(campWindowOpen(360.9), true, 'floored - the loop hands whole minutes anyway');
  assert.equal(campWindowOpen(181), false);
});

test('CAMP1: the timer roll - gated on the wilderness (not inside, not the town rect, not while spawns are prevented), then the window, then GUARANTEED', () => {
  const t = 360;   // an open window, by day
  assert.equal(rollCampEncounter({ ...WILD, gameMinutes: t, inside: true }, rollsOf([0.1])), null, 'indoors: nothing');
  assert.equal(rollCampEncounter({ ...WILD, gameMinutes: t, inLocationRect: true }, rollsOf([0.1])), null, 'the widened town rect: nothing, day or night');
  assert.equal(rollCampEncounter({ ...WILD, gameMinutes: t + 720, inLocationRect: true }, rollsOf([0.1])), null);
  assert.equal(rollCampEncounter({ ...WILD, gameMinutes: t, preventEnemySpawns: true }, rollsOf([0.1])), null, 'a clock jump\'s minutes roll nothing');
  assert.equal(rollCampEncounter({ ...WILD, gameMinutes: t + 1 }, rollsOf([0.1])), null, 'the window is closed on every other minute');
  const hit = rollCampEncounter({ ...WILD, gameMinutes: t }, rollsOf([0.1, 0.99, 0.5]));
  assert.ok(hit, 'an open window IS a group - no chance roll on the timer path (Mac: "every 15 minutes it should happen guaranteed")');
  assert.equal(hit.kind, 'camp', 'kind roll under 0.5: a camp');
  assert.equal(hit.mobileTypes.length, CAMP_SIZE[1], 'size roll 0.99: the top of the camp band');
  assert.ok(hit.mobileTypes.every((m) => Number.isInteger(m) && m >= 0), 'every member is a real mobile id off the climate\'s table');
  assert.deepEqual([hit.spacing, hit.alertRadius, hit.minDistance, hit.maxDistance], [CAMP_SPACING, CAMP_ALERT_RADIUS, MIN_CAMP_SPAWN_DISTANCE, MAX_CAMP_SPAWN_DISTANCE]);
  const pack = rollCampEncounter({ ...WILD, gameMinutes: t }, rollsOf([0.9, 0.0, 0.5]));
  assert.equal(pack.kind, 'pack');
  assert.equal(pack.mobileTypes.length, PACK_SIZE[0], 'size roll 0: the bottom of the pack band');
  assert.deepEqual([pack.spacing, pack.alertRadius], [PACK_SPACING, PACK_ALERT_RADIUS]);
  assert.ok(PACK_SPACING > CAMP_SPACING && CAMP_ALERT_RADIUS === CAMP_SPACING * 3 && PACK_ALERT_RADIUS === PACK_SPACING * 2, 'a camp is tight (three spacings of shout), a pack is loose (two)');
  assert.equal(rollCampEncounter({ ...WILD, gameMinutes: t, climateIndex: 9999 }, rollsOf([0.1, 0.5, 0.5])), null, 'an unknown climate has no table: nothing to spawn');
});

test('CAMP1: the chunk-load roll - the same gate and composition, no time gate at all, and its own 15% chance', () => {
  assert.equal(CAMP_CHANCE_ON_CHUNK_LOAD, 0.15);
  assert.equal(rollCampChanceOnChunkLoad(0.149), true);
  assert.equal(rollCampChanceOnChunkLoad(0.15), false);
  assert.equal(rollCampEncounterOnChunkLoad({ ...WILD, gameMinutes: 181 }, rollsOf([0.2])), null, 'roll 0.2: no group this pixel');
  const hit = rollCampEncounterOnChunkLoad({ ...WILD, gameMinutes: 181 }, rollsOf([0.1, 0.1, 0.5, 0.5]));
  assert.ok(hit && hit.kind === 'camp', 'roll 0.1 on a CLOSED minute: a group - the pixel crossing is the cadence');
  assert.equal(rollCampEncounterOnChunkLoad({ ...WILD, gameMinutes: 181, inLocationRect: true }, rollsOf([0.1])), null, 'the town gate holds here too');
  // the timer's own 5% is kept for a lower-than-guaranteed rate later, and is not consulted by the timer path
  assert.equal(CAMP_CHANCE, 0.05);
  assert.equal(rollCampChance(0.049), true); assert.equal(rollCampChance(0.05), false);
  assert.equal(rollCampKind(0.499), 'camp'); assert.equal(rollCampKind(0.5), 'pack');
});

test('CAMP1: group ownership online - the one lowest id among the players within 100m rolls; offline, or alone, always this player', () => {
  assert.equal(GROUP_ROLL_RADIUS, 100);
  assert.equal(amGroupRollOwner(null, [0, 0, 0], [{ id: 'a', feet: [1, 0, 1] }]), true, 'offline (no id): mine');
  assert.equal(amGroupRollOwner('m', [0, 0, 0], null), true, 'no roster: mine');
  assert.equal(amGroupRollOwner('m', [0, 0, 0], []), true);
  assert.equal(amGroupRollOwner('m', [0, 0, 0], [{ id: 'a', feet: [10, 0, 10] }]), false, '"a" sorts under "m" and stands 14m off: theirs');
  assert.equal(amGroupRollOwner('m', [0, 0, 0], [{ id: 'a', feet: [101, 0, 0] }]), true, '...but 101m off is outside the ring: mine');
  assert.equal(amGroupRollOwner('m', [0, 0, 0], [{ id: 'a', feet: [100, 0, 0] }]), false, 'exactly on the ring is in it');
  assert.equal(amGroupRollOwner('m', [0, 0, 0], [{ id: 'z', feet: [1, 0, 1] }, { id: 'n', feet: [2, 0, 2] }]), true, 'everyone near sorts above me: mine');
  assert.equal(amGroupRollOwner('m', [0, 0, 0], [{ id: 'm', feet: [1, 0, 1] }, { id: null, feet: [1, 0, 1] }, { id: 'a' }]), true, 'my own row, a null id and a row with no feet are skipped');
  assert.equal(amGroupRollOwner(5, [0, 0, 0], [{ id: 10, feet: [1, 0, 1] }]), false, 'ids compare as STRINGS - "10" < "5" - so every client agrees whatever type its ids are');
  assert.equal(amGroupRollOwner('m', [0, 0, 0], [{ id: 'a', feet: [10, 50, 10] }]), false, 'the ring is horizontal: height does not count');
});

test('CAMP1 by source: both exterior hosts roll it after the single roll comes back empty, stand an anchor then the members around it, the world host under the group-ownership guard and on every pixel entered; a member that notices the player wakes its campmates; the feature row', () => {
  const w = read('src/scenes/world.js');
  const e = read('src/scenes/exterior.js');
  for (const [name, h] of [['world.js', w], ['exterior.js', e]]) {
    const i = h.indexOf('function runEncounterTick(');
    const fn = h.slice(i, h.indexOf('\n  }\n', i));
    assert.ok(fn.indexOf('_standEncounterFoe(hit, playerFeet)') < fn.indexOf("getPref('wildernessCamps') !== false"), `${name}: the group roll sits AFTER the single roll's break, so the two never both fire on one minute`);
    assert.match(fn, /const campHit = rollCampEncounter\(\{\s*\n\s*gameMinutes: _lastEncMinutes \+ l \+ 1, inside: _m !== 'exterior',\s*\n\s*inLocationRect: _musicInLocationRect\(\),/, `${name}: the same minute, the same rect`);
    assert.match(fn, /preventEnemySpawns: playerEntity\.preventEnemySpawns,/, `${name}: and the suppression flag`);
    assert.match(fn, /if \(campHit\) \{ _standCampEncounter\(campHit, playerFeet\); break; \}/, `${name}: a hit stands and ends the minute`);
    const si = h.indexOf('const _standCampEncounter = (hit, feet) => {');
    const stand = h.slice(si, h.indexOf('\n  };', si));
    assert.match(stand, /anchor = placeFoeFreely\(anchorEnv, \{ minDistance: hit\.minDistance, maxDistance: hit\.maxDistance, lineOfSightCheck: true \}\);/, `${name}: the anchor is placed as a single encounter is - the group's band, out of view`);
    assert.match(stand, /playerFeet: \[anchorFeet\[0\], anchorFeet\[1\] \+ 0\.9, anchorFeet\[2\]\],\s*\n\s*playerYawRad: Math\.random\(\) \* Math\.PI \* 2,\s*\n\s*fovDegrees: 0,/, `${name}: each member's env is centred on the ANCHOR, any bearing`);
    assert.match(stand, /spot = placeFoeFreely\(memberEnv, \{ minDistance: 1, maxDistance: hit\.spacing, lineOfSightCheck: false \}\);/, `${name}: within the group's spacing, no player-relative view test`);
    assert.match(stand, /if \(!spot\) continue;/, `${name}: a member with no ground is skipped, not the group`);
    assert.match(stand, /\.then\(\(f\) => \{ if \(f\) \{ f\.campId = campId; f\.campAlertRadius = hit\.alertRadius; \} \}\)/, `${name}: the stood foe carries its group and its shout radius`);
    assert.match(stand, /yaw: Math\.atan2\(anchorFeet\[0\] - spot\.x, anchorFeet\[2\] - spot\.z\),/, `${name}: members face the camp, not the player`);
  }
  assert.match(w, /if \(getPref\('wildernessCamps'\) !== false && amGroupRollOwner\(online\?\.id \?\? null, playerFeet, peersNear\(\)\)\) \{\s*\n\s*const campHit = rollCampEncounter\(/, 'world.js: the timer roll is gated on group ownership');
  assert.match(e, /if \(getPref\('wildernessCamps'\) !== false\) \{\s*\n\s*const campHit = rollCampEncounter\(/, 'exterior.js: no peers on this route, no guard');
  assert.match(e, /const _standCampEncounter = \(hit, feet\) => \{\s*\n\s*if \(!walkMode\) return;/, 'exterior.js: the fly camera has no capsule to place around');
  // the chunk-load twin, on the stream's own "entered" event, outdoors only
  const ci = w.indexOf('stream: entered ${r.current.x}');
  const chunk = w.slice(ci, w.indexOf('\n    pump();', ci));
  assert.match(chunk, /if \(\(modes\?\.mode \?\? 'exterior'\) === 'exterior' && getPref\('wildernessCamps'\) !== false && amGroupRollOwner\(online\?\.id \?\? null, player\.feetAt\(\), peersNear\(\)\)\) \{/, 'outdoors, switched on, and mine to roll');
  assert.match(chunk, /const chunkCampHit = rollCampEncounterOnChunkLoad\(\{\s*\n\s*inside: false, inLocationRect: _musicInLocationRect\(\),\s*\n\s*climateIndex: maps\.getClimateIndex\(r\.current\.x, r\.current\.y\),/, 'the entered pixel\'s own climate');
  assert.match(chunk, /if \(chunkCampHit\) _standCampEncounter\(chunkCampHit, player\.feetAt\(\)\);/);
  // the shout across the camp
  const ef = read('src/scenes/exteriorFoes.js');
  assert.match(ef, /targeting: \(ai, pf, cdt\) => \{\s*\n\s*const hadTarget = !!ai\.target;\s*\n\s*const result = runTargetMachine\(f, \[\.\.\.senses\.candidates\(\), PLAYER_TARGET, \.\.\.peerCandidates\(\)\], pf, cdt, \{/, 'the machine runs as it did, with the before-state remembered');
  assert.match(ef, /if \(!hadTarget && ai\.target && f\.campId != null\) wakeCampmates\(f\);\s*\n\s*return result;/, 'a member that JUST noticed someone, and only a group member, wakes the rest');
  const wi = ef.indexOf('function wakeCampmates(f) {');
  const wake = ef.slice(wi, ef.indexOf('\n  }\n', wi));
  assert.match(wake, /const r2 = \(f\.campAlertRadius \?\? 0\) \*\* 2;\s*\n\s*if \(!feet \|\| !r2\) return;/, 'no radius, no shout');
  assert.match(wake, /if \(g === f \|\| g\.dead \|\| g\.campId !== f\.campId \|\| g\.ai\?\.target\) continue;/, 'the same camp, alive, and not already on someone');
  assert.match(wake, /if \(dx \* dx \+ dz \* dz > r2\) continue;\s*\n\s*g\.ai\.target = f\.ai\.target;/, 'within the shout: handed the SAME target - a peer the member saw is a peer the camp hunts');
  // the switch
  const row = FEATURES.find((f) => f.id === 'wilderness-camps');
  assert.ok(row, 'the enhanced pane carries the row');
  assert.deepEqual([row.group, row.title, [...row.kinds], row.control.key, row.control.initial, row.control.online], ['world', 'Wilderness camps & packs', ['enhanced'], 'wildernessCamps', true, 'player']);
  assert.match(read('src/systems/campEncounters.js'), /^\/\/ This is an ORIGINAL addition, not a Daggerfall Unity or classic/m, 'the module says what it is');
});
