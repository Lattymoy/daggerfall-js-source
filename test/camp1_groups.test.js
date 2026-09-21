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
import { areEnemiesNearby, RESTING_DISTANCE, MIN_WILDERNESS_SPAWN_DISTANCE } from '../src/systems/encounters.js';   // CAMP1-REST: the interrupt, its reach, and the band the classic roll mints inside it
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
// campmates. Two triggers exist in the module: a guaranteed group every
// 15 REAL minutes of play, and a 15% roll each new map pixel entered.
// Online, exactly one of the players within 100m rolls (a deterministic
// lowest-id pick).
//
// CAMP-NOTIMER (2026-09-19, Lost's package): world.js, the real
// streaming open world, WIRES UP ONLY THE SECOND. A camp or a pack must
// be a consequence of the player stepping onto new ground, never a
// background timer dropping one on a player standing still.
// exterior.js - the fixed single-location preview host, with no chunk
// streaming to hang a roll off - still wires up the timer, unchanged.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const rollsOf = (list) => { let i = 0; return () => list[i++ % list.length]; };
// THEMED GROUPS: rollGroupComposition now draws its SEED member FIRST
// (chooseRandomEnemy, two rolls - the level band, then the pick) and only then
// the kind and the size, because every other member is drawn from the seed's
// own faction. A cycling rollsOf() cannot say that legibly, so the composition
// cases below script their rolls in order and let a trailing value feed the
// remaining member draws. SEED is a pair that lands on a real, non-solitary
// Woodlands type at level 5, so the seed is taken on its first attempt.
const scripted = (list, tail = 0.5) => { let i = 0; return () => (i < list.length ? list[i++] : tail); };
const SEED = [0.3, 0.2];
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
  const hit = rollCampEncounter({ ...WILD, gameMinutes: t }, scripted([...SEED, 0.1, 0.99]));
  assert.ok(hit, 'an open window IS a group - no chance roll on the timer path (Mac: "every 15 minutes it should happen guaranteed")');
  assert.equal(hit.kind, 'camp', 'kind roll under 0.5: a camp');
  assert.equal(hit.mobileTypes.length, CAMP_SIZE[1], 'size roll 0.99: the top of the camp band');
  assert.ok(hit.mobileTypes.every((m) => Number.isInteger(m) && m >= 0), 'every member is a real mobile id off the climate\'s table');
  assert.deepEqual([hit.spacing, hit.alertRadius, hit.minDistance, hit.maxDistance], [CAMP_SPACING, CAMP_ALERT_RADIUS, MIN_CAMP_SPAWN_DISTANCE, MAX_CAMP_SPAWN_DISTANCE]);
  const pack = rollCampEncounter({ ...WILD, gameMinutes: t }, scripted([...SEED, 0.9, 0.0]));
  assert.equal(pack.kind, 'pack');
  assert.equal(pack.mobileTypes.length, PACK_SIZE[0], 'size roll 0: the bottom of the pack band');
  assert.deepEqual([pack.spacing, pack.alertRadius], [PACK_SPACING, PACK_ALERT_RADIUS]);
  assert.ok(PACK_SPACING > CAMP_SPACING && CAMP_ALERT_RADIUS === CAMP_SPACING * 3 && PACK_ALERT_RADIUS === PACK_SPACING * 2, 'a camp is tight (three spacings of shout), a pack is loose (two)');
  assert.equal(rollCampEncounter({ ...WILD, gameMinutes: t, climateIndex: 9999 }, scripted([...SEED, 0.1, 0.5])), null, 'an unknown climate has no table: nothing to spawn - the seed roll itself comes back empty');
});

test('CAMP1: the chunk-load roll - the same gate and composition, no time gate at all, and its own 15% chance', () => {
  assert.equal(CAMP_CHANCE_ON_CHUNK_LOAD, 0.15);
  assert.equal(rollCampChanceOnChunkLoad(0.149), true);
  assert.equal(rollCampChanceOnChunkLoad(0.15), false);
  assert.equal(rollCampEncounterOnChunkLoad({ ...WILD, gameMinutes: 181 }, rollsOf([0.2])), null, 'roll 0.2: no group this pixel');
  const hit = rollCampEncounterOnChunkLoad({ ...WILD, gameMinutes: 181 }, scripted([0.1, ...SEED, 0.1, 0.5]));   // the 15% chance roll first, then the seed, then kind and size
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
  // CAMP-NOTIMER (2026-09-19, Lost's package): THE TIMER ARM IS GONE
  // FROM world.js. It fired a GUARANTEED group every 15 real minutes of
  // play even while the player stood still; a camp or a pack must be a
  // consequence of walking onto new ground, so the chunk-load roll is
  // now that host's only trigger. exterior.js is the fixed
  // single-location preview host with no chunk streaming to hang a roll
  // off, so its timer arm stands unchanged - which is why the two hosts
  // no longer share this pin.
  {
    const i = w.indexOf('function runEncounterTick(');
    const fn = w.slice(i, w.indexOf('\n  }\n', i));
    assert.doesNotMatch(fn, /getPref\('wildernessCamps'\)/, 'world.js: no camp gate left in the per-minute tick');
    assert.doesNotMatch(fn, /const campHit = rollCampEncounter\(/, 'world.js: no live timer roll left in the per-minute tick');
  }
  assert.doesNotMatch(w, /import \{ rollCampEncounter,/, 'world.js: the unused timer entry point is dropped from the import');
  assert.match(w, /import \{ rollCampEncounterOnChunkLoad, amGroupRollOwner \} from '\.\.\/systems\/campEncounters\.js';/, 'world.js: only the chunk-load twin and the ownership guard are imported now');
  for (const [name, h] of [['exterior.js', e]]) {
    const i = h.indexOf('function runEncounterTick(');
    const fn = h.slice(i, h.indexOf('\n  }\n', i));
    assert.ok(fn.indexOf('_standEncounterFoe(hit, playerFeet)') < fn.indexOf("getPref('wildernessCamps') !== false"), `${name}: the group roll sits AFTER the single roll's break, so the two never both fire on one minute`);
    assert.match(fn, /const campHit = rollCampEncounter\(\{\s*\n\s*gameMinutes: _lastEncMinutes \+ l \+ 1, inside: _m !== 'exterior',\s*\n\s*inLocationRect: _musicInLocationRect\(\),/, `${name}: the same minute, the same rect`);
    assert.match(fn, /preventEnemySpawns: playerEntity\.preventEnemySpawns,/, `${name}: and the suppression flag`);
    assert.match(fn, /if \(campHit\) \{ _standCampEncounter\(campHit, playerFeet\); break; \}/, `${name}: a hit stands and ends the minute`);
  }
  for (const [name, h] of [['world.js', w], ['exterior.js', e]]) {
    const si = h.indexOf('const _standCampEncounter = (hit, feet) => {');
    const stand = h.slice(si, h.indexOf('\n  };', si));
    assert.match(stand, /anchor = placeFoeFreely\(anchorEnv, \{ minDistance: hit\.minDistance, maxDistance: hit\.maxDistance, lineOfSightCheck: true \}\);/, `${name}: the anchor is placed as a single encounter is - the group's band, out of view`);
    assert.match(stand, /playerFeet: \[anchorFeet\[0\], anchorFeet\[1\] \+ 0\.9, anchorFeet\[2\]\],\s*\n\s*playerYawRad: Math\.random\(\) \* Math\.PI \* 2,\s*\n\s*fovDegrees: 0,/, `${name}: each member's env is centred on the ANCHOR, any bearing`);
    assert.match(stand, /spot = placeFoeFreely\(memberEnv, \{ minDistance: 1, maxDistance: hit\.spacing, lineOfSightCheck: false \}\);/, `${name}: within the group's spacing, no player-relative view test`);
    assert.match(stand, /if \(!spot\) continue;/, `${name}: a member with no ground is skipped, not the group`);
    assert.match(stand, /\.then\(\(f\) => \{\s*\n\s*if \(f\) \{\s*\n\s*f\.campId = campId; f\.campAlertRadius = hit\.alertRadius;/, `${name}: the stood foe carries its group and its shout radius`);
    // CAMP2: a themed group is grouped by FACTION (mobileFactions.js), which can
    // still straddle several combat Teams - so without an exemption,
    // EnemyInfighting (on by default) has campmates fighting each other on sight
    // instead of the player. Active-Arcs.md refused the hand-off's version of
    // this, which set `suppressInfighting` on the entity: that flag skips the
    // infighting arm entirely and drops to the one below it, where a campmate
    // stops targeting EVERY non-player candidate - the player's own summoned
    // ally included - and it outlives the campId that justified it across a
    // quickload. The exemption is the CAMP's, and this pins that it stays so.
    assert.match(stand, /if \(f\.entity\) f\.entity\.campId = campId;/, `${name}: a campmate is exempt from its CAMPMATES`);
    assert.doesNotMatch(stand, /suppressInfighting/, `${name}: and not from every other foe in the world`);
    assert.match(stand, /yaw: Math\.atan2\(anchorFeet\[0\] - spot\.x, anchorFeet\[2\] - spot\.z\),/, `${name}: members face the camp, not the player`);
  }
  // CAMP1-REST re-aimed exterior.js's; world.js's timer roll is gone entirely (CAMP-NOTIMER, above)
  assert.match(e, /if \(!isResting && getPref\('wildernessCamps'\) !== false\) \{\s*\n\s*const campHit = rollCampEncounter\(/, 'exterior.js: no peers on this route, no guard - the rest gate stands alone');
  // CAMP-REST (2026-09-19, Dudey: "the camp enemies should just not appear when resting"): the CHUNK-LOAD twin takes
  // a rest gate too now. The old note said a resting player crosses no pixel, so a gate was a law with no case - but
  // the rule the player asked for is unconditional, and the gate costs one flag read.
  assert.ok(/!playerEntity\.isResting/.test(w.slice(w.indexOf('stream: entered ${r.current.x}'), w.indexOf('\n    pump();', w.indexOf('stream: entered ${r.current.x}')))), 'the chunk-load roll stands down while resting');
  assert.match(e, /const _standCampEncounter = \(hit, feet\) => \{\s*\n\s*if \(!walkMode\) return;/, 'exterior.js: the fly camera has no capsule to place around');
  // the chunk-load twin, on the stream's own "entered" event, outdoors only
  const ci = w.indexOf('stream: entered ${r.current.x}');
  const chunk = w.slice(ci, w.indexOf('\n    pump();', ci));
  assert.match(chunk, /if \(\(modes\?\.mode \?\? 'exterior'\) === 'exterior' && !playerEntity\.isResting && getPref\('wildernessCamps'\) !== false && amGroupRollOwner\(online\?\.id \?\? null, player\.feetAt\(\), peersNear\(\)\)\) \{/, 'outdoors, not resting, switched on, and mine to roll');
  assert.match(chunk, /const chunkCampHit = rollCampEncounterOnChunkLoad\(\{\s*\n\s*inside: false, inLocationRect: _musicInLocationRect\(\),\s*\n\s*climateIndex: maps\.getClimateIndex\(r\.current\.x, r\.current\.y\),/, 'the entered pixel\'s own climate');
  assert.match(chunk, /if \(chunkCampHit\) _standCampEncounter\(chunkCampHit, player\.feetAt\(\)\);/);
  // the shout across the camp
  const ef = read('src/scenes/exteriorFoes.js');
  assert.match(ef, /targeting: \(ai, pf, cdt\) => \{\s*\n\s*const hadTarget = !!ai\.target;[\s\S]*?const result = runTargetMachine\(f, \[\.\.\.senses\.candidates\(\), PLAYER_TARGET, \.\.\.peerCandidates\(\)\], pf, cdt, \{/, 'the machine runs as it did, with the before-state remembered');
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

// CAMP1-REST (2026-09-18, Mac's wilderness-resting hand-off): the group roll stands down while the tick is
// servicing a rest. THE MECHANISM IS SIGHT FIRST, DISTANCE SECOND - the hand-off's own note read it as a pure
// distance law and that is not what encounters.js does. areEnemiesNearby's resting arm reports a foe that has SEEN
// the player at ANY range, and only falls back to the 12-unit proximity test for a foe that has not. A lone
// wanderer is minted facing the player ("LookAt player") and trips the sight arm on its first senses tick, which
// is how a rest has always been interruptible and is what the dungeon's own rest roll leans on. A group is minted
// facing its ANCHOR, out at 14..26 and so past the fallback, and the world is NOT frozen while a rest runs
// (WINFOE1 drives the foe pool on the frame's own dt under a window) - so most groups do wake the sleeper, and it
// is the group whose members happen to face away that lands in silence and is standing there on waking. Mac's
// call is that groups are a walking-around feature rather than that they should be yawed at a sleeper.
test('CAMP1 by source: the group roll is skipped while resting - camps/packs only fire while wandering, never mid-rest', () => {
  // CAMP-NOTIMER: world.js has no timer arm left to gate - its ONLY camp
  // trigger is the chunk-load roll, whose own rest gate is pinned below.
  // exterior.js keeps the timer, so it keeps the gate.
  for (const host of ['src/scenes/exterior.js']) {
    const h = read(host);
    const i = h.indexOf('function runEncounterTick(');
    assert.match(h.slice(i, i + 200), /function runEncounterTick\(playerFeet, simMinutesEnd = null, isResting = false\) \{/, `${host}: the tick knows whether it's servicing a rest`);
    const fn = h.slice(i, h.indexOf('\n  }\n', i));
    assert.match(fn, /if \(!isResting && getPref\('wildernessCamps'\)/, `${host}: the camp/pack roll is gated off during rest`);
    assert.match(h, /advanceMinutes: \(n, sharedEnd\) => \{ playerTicker\.advance\(n\); runEncounterTick\([^)]*, sharedEnd, true\); \}/, `${host}: the rest deps flag every tick they drive as a rest`);
    // `encounterTick` takes no flag - and it is NOT only the walking tick, which is worth saying plainly because
    // the hand-off's note assumed it was: worldModes' INTERIOR rest deps drive it too
    // (`advanceMinutes: (n) => { interiorTicker.advance(n); host.encounterTick?.(); }`). That rest needs no flag
    // because a roll from inside a building cannot reach a group at all - campGateOk refuses `inside` outright -
    // so the gate holds there by construction rather than by the flag, and both halves are pinned here.
    assert.match(h, /encounterTick: \(\) => runEncounterTick\([^,)]*\),/, `${host}: the frame's own tick passes no third argument - isResting defaults to false`);
  }
  // the interior rest that reaches encounterTick unflagged, and the one line that makes it harmless
  assert.match(read('src/scenes/worldModes.js'), /advanceMinutes: \(n\) => \{ interiorTicker\.advance\(n\); host\.encounterTick\?\.\(\); \},/, 'the interior rest drives the host tick with no flag...');
  assert.match(read('src/systems/campEncounters.js'), /const campGateOk = \(ctx\) => !\(ctx\.inside \|\| ctx\.inLocationRect \|\| ctx\.preventEnemySpawns\);/, '...and a roll from inside can never reach a group anyway');
});

// CAMP1-REST, THE LAW UNDER THE GATE. The source pins above say the roll stands down under a rest; this one says
// WHAT a rest can actually see, so the gate cannot be deleted as "belt and braces" by a reader who never met the
// bug - and so that nobody re-derives the hand-off's own reading of it, which was that camps outrun the interrupt
// on DISTANCE alone. They do not. The interrupt is sight first:
//
//     SEEN me          -> reported at ANY range        (a foe minted "LookAt player" trips this at once)
//     not seen, <= 12  -> reported if it would spawn   (RESTING_DISTANCE, the fallback)
//     not seen,  > 12  -> dropped before anything else (the whole camp band, 14..26, lives here)
//
// So a lone wanderer wakes the sleeper because it is minted FACING them, not because of where it stands (its own
// band, 10..20, is mostly outside the fallback too). A camp is minted facing its ANCHOR and out past the
// fallback, so the one group that lands in silence is the one whose members happen to face away - and the world
// is not frozen meanwhile, which is why most groups do wake the sleeper and only the quiet ones read as a bug.
// If someone moves the bands so they overlap, or yaws members at the player, this reddens and the gate can be
// reconsidered on purpose rather than by accident.
test('CAMP1-REST: the rest interrupt is SIGHT first - a seen foe reports at any range, an unseen one only inside 12, and the whole camp band lies outside that; the two spawners differ in FACING, which is what a group can lose', () => {
  assert.ok(MIN_CAMP_SPAWN_DISTANCE > RESTING_DISTANCE,
    `a camp's NEAREST member (${MIN_CAMP_SPAWN_DISTANCE}) is already outside the fallback's reach (${RESTING_DISTANCE})`);
  assert.ok(MAX_CAMP_SPAWN_DISTANCE >= MIN_CAMP_SPAWN_DISTANCE, 'and the band only runs outward from there');
  assert.ok(MIN_WILDERNESS_SPAWN_DISTANCE < RESTING_DISTANCE,
    `a lone wanderer's band starts inside it (${MIN_WILDERNESS_SPAWN_DISTANCE}) - but that is not why it wakes the player`);
  // THE DIFFERENCE THAT ACTUALLY DECIDES IT, by source: the lone arm yaws its foe at the PLAYER, the group arm
  // yaws each member at the ANCHOR. That is the line a future "fix" would touch instead of this gate.
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const h = read(host);
    assert.match(h, /yaw: Math\.atan2\(feet\[0\] - spot\.x, feet\[2\] - spot\.z\),   \/\/ LookAt player/, `${host}: the lone wanderer faces the player`);
    assert.match(h, /yaw: Math\.atan2\(anchorFeet\[0\] - spot\.x, anchorFeet\[2\] - spot\.z\),/, `${host}: a campmate faces the camp`);
  }

  // the interrupt on the shape the spawner mints: a member just stood has detected nothing, seen nothing, and
  // carries no wouldBeSpawned mark (enemyMotor sets it false at construction and recomputes it on its own update)
  const foe = (dist, over = {}) => ({ dead: false, ai: { detected: false, inSight: false, isHostile: true, _distLocal: dist, ...over } });
  const camp = [foe(MIN_CAMP_SPAWN_DISTANCE), foe(MAX_CAMP_SPAWN_DISTANCE), foe((MIN_CAMP_SPAWN_DISTANCE + MAX_CAMP_SPAWN_DISTANCE) / 2)];
  assert.equal(areEnemiesNearby(camp, { resting: true }), false,
    'THE BUG: a whole camp rolled under a rest is invisible to the interrupt - it arrived in silence and was standing there on waking');
  // ...and stays invisible even once its members ARE marked, because the mark only counts inside the reach
  assert.equal(areEnemiesNearby(camp.map((f) => foe(f.ai._distLocal, { wouldBeSpawned: true })), { resting: true }), false,
    'the mark does not help at camp distance: the resting arm drops it before the mark is ever read');

  // the contrast that makes the gate the right fix rather than a blanket "rests are never interrupted"
  assert.equal(areEnemiesNearby([foe(MIN_WILDERNESS_SPAWN_DISTANCE, { wouldBeSpawned: true })], { resting: true }), true,
    'the classic wandering monster is minted inside the reach and still wakes the player - the lone roll is left alone');
  assert.equal(areEnemiesNearby([foe(MAX_CAMP_SPAWN_DISTANCE, { detected: true, inSight: true })], { resting: true }), true,
    'and a foe that HAS seen the player wakes them at any distance');
});

// CAMP-REST (2026-09-19): time skips that are not the rest window must not be replayed as walking time. The exhaustion
// collapse, a camp meal and a forage/hunt search advance the clock without touching the encounter cursor, so the next
// frame's catch-up rolled them with isResting=false and the timer's 180-minute boundary fired a guaranteed group.
test('CAMP-REST by source: every time skip is spent through the tick as a rest, and a campmate does not notice a sleeping player', () => {
  const w = read('src/scenes/world.js'), e = read('src/scenes/exterior.js'), ef = read('src/scenes/exteriorFoes.js');
  assert.match(w, /playerTicker\.advance\(60\);\s*\n[^\n]*\n[^\n]*\n\s*runEncounterTick\(walkMode && playerSpawned \? player\.pos : cam\.pos, null, true\);/, 'world.js: the collapse hour is spent as a rest');
  assert.equal((w.match(/advanceMinutes: \(n\) => \{ playerTicker\.advance\(n\); runEncounterTick\(walkMode && playerSpawned \? player\.pos : cam\.pos, null, true\); \}/g) ?? []).length, 2, 'world.js: the camp meal and the forage/hunt search');
  assert.match(e, /playerTicker\.advance\(60\);[^\n]*\n\s*runEncounterTick\(walkMode \? player\.pos : cam\.pos, null, true\);/, 'exterior.js: the collapse hour');
  assert.match(e, /advanceMinutes: \(n\) => \{ playerTicker\.advance\(n\); runEncounterTick\(walkMode \? player\.pos : cam\.pos, null, true\); \}/, 'exterior.js: the camp meal');
  assert.match(ef, /const campAsleep = f\.campId != null && !!senses\.playerEntity\?\.isResting && !isLocalPlayerTarget\(ai\.target\);/, 'a campmate, not already on the player, while the player rests');
  assert.match(ef, /noTargetMode: campAsleep,/, 'the target machine leaves the player off its list for it');
});
