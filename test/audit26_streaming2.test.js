// AUDIT 26 - wave hosts-streaming-2. The streaming host's seams: the
// exhaustion collapse's enemy test, the travel popup's ship, the
// static-NPC greeting's macro pass, %di's local compass - and F030's
// levitate input, fixed in the previous wave and never pinned.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { areEnemiesNearby } from '../src/systems/encounters.js';
import { exhaustionOutcome, EXHAUSTED_SAFE_TEXT_ID, EXHAUSTED_ENEMIES_TEXT_ID } from '../src/systems/rest.js';
import { calculateTripCost } from '../src/systems/travel.js';
import { ownsShip, SHIP_TYPES } from '../src/systems/banking.js';
import { freeShipTravel } from '../src/systems/guildServices.js';
import { orderOf } from '../src/systems/guildVariants.js';
import { joinedGuildOfGroup } from '../src/systems/guilds.js';
import { GUILD_GROUPS } from '../src/formats/factionFile.js';
import { buildingCompassDirection, DIRECTION_HINTS } from '../src/systems/talk.js';
import { expandRandomTextRecord } from '../src/systems/talkMacros.js';
import { AnswerPipeline, TALK_STRINGS } from '../src/systems/answerPipeline.js';
import { PlayerMotor, LEVITATE_MOVE_SPEED } from '../src/player/motor.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');
const approx = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

// The port's AI shape for AreEnemiesNearby.
const foe = ({ detected = false, inSight = false, wouldBeSpawned = false, dist = 500 } = {}) =>
  ({ dead: false, ai: { detected, inSight, wouldBeSpawned, _dist: dist } });

// ---------------------------------------------------------------
// F059 - CollapseFromExhaustion asks AreEnemiesNearby, not "is any
// guard alive". PlayerEntity.cs:2397 `bool enemiesNearby =
// GameManager.Instance.AreEnemiesNearby();` - the STRICT variant (no
// resting narrowing), over EVERY active enemy behaviour, and
// :2426/:2440-2441 pick the rest hour or SetHealth(0) off it.
// ---------------------------------------------------------------

test('audit26 F059: the exhaustion collapse rides AreEnemiesNearby over EVERY foe pool', () => {
  const entity = { level: 1, health: 20, maxHealth: 40, maxMagicka: 40, stats: { endurance: 50 }, career: {} };

  // One unaware guard, spawned across town, no sight, outside the
  // classic spawn band: AreEnemiesNearby says NO, so DFU grants the
  // hour of rest. `activeCount() > 0` said yes and killed the player.
  const townWatch = [foe({ dist: 900 })];
  assert.equal(areEnemiesNearby(townWatch), false);
  const safe = exhaustionOutcome({ enemiesNearby: areEnemiesNearby(townWatch), swimming: false, entity, day: true, inside: false });
  assert.equal(safe.kind, 'rest');
  assert.equal(safe.textId, EXHAUSTED_SAFE_TEXT_ID);

  // One encounter wolf that has SEEN the player: AreEnemiesNearby says
  // yes and the collapse is fatal - the arm the guard-only read could
  // never reach, because encounter foes were not consulted at all.
  const encounter = [foe({ detected: true, inSight: true, dist: 900 })];
  assert.equal(areEnemiesNearby(encounter), true);
  const fatal = exhaustionOutcome({ enemiesNearby: areEnemiesNearby(encounter), swimming: false, entity, day: true, inside: false });
  assert.equal(fatal.kind, 'death');
  assert.equal(fatal.textId, EXHAUSTED_ENEMIES_TEXT_ID);

  // and the STRICT variant is the right one: a foe inside the classic
  // spawn band that has not seen you still counts (only the RESTING
  // variant skips it), which is why the collapse must not pass
  // { resting: true }.
  const lurking = [foe({ wouldBeSpawned: true, dist: 13 })];
  assert.equal(areEnemiesNearby(lurking), true);
  assert.equal(areEnemiesNearby(lurking, { resting: true }), false);
});

test('audit26 F059: every host feeds its foe POOLS into the collapse', () => {
  // world.js carries both exterior pools - the watch AND the encounter
  // foes, the same pair its rest deps ask.
  assert.match(src('src/scenes/world.js'),
    /enemiesNearby: areEnemiesNearby\(\[\.\.\.\(cityGuards\?\.guards \?\? \[\]\), \.\.\.\(exteriorFoes\?\.foes \?\? \[\]\)\]\)/);
  // exterior.js has one pool (no encounter spawner in that host).
  assert.match(src('src/scenes/exterior.js'),
    /enemiesNearby: areEnemiesNearby\(cityGuards\?\.guards \?\? \[\]\)/);
  // the dungeon host asks the same ONE home rather than a second copy
  // of the law inline.
  assert.match(src('src/scenes/dungeonContext.js'), /const enemiesNearby = areEnemiesNearby\(foes\);/);
  // and no host smuggles the coarse "is any guard alive" read back in.
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeonContext.js', 'src/scenes/worldModes.js']) {
    assert.doesNotMatch(src(f), /enemiesNearby: \(cityGuards\?\.activeCount/, f);
  }
});

// ---------------------------------------------------------------
// F192 - DaggerfallTravelPopUp.cs:219:
//   hasShip = DaggerfallBankManager.OwnsShip || GuildManager.FreeShipTravel();
// The port shipped both halves and passed the literal `false`.
// ---------------------------------------------------------------

/** The host's own hasShip closure, lifted out of world.js and run
 *  against the real laws - so this pin dies the moment the seam goes
 *  back to a literal. */
function hostHasShip(playerEntity) {
  const s = src('src/scenes/world.js');
  const i = s.indexOf('hasShip: () => {');
  assert.ok(i > 0, 'buildTravelMapWindow computes hasShip');
  const end = s.indexOf('\n      },', i);
  assert.ok(end > i, 'the hasShip closure is a block');
  const body = s.slice(i + 'hasShip: '.length, end + '\n      }'.length);
  const make = new Function('ownsShip', 'joinedGuildOfGroup', 'GUILD_GROUPS', 'orderOf', 'freeShipTravel', 'playerEntity', `return (${body});`);
  return make(ownsShip, joinedGuildOfGroup, GUILD_GROUPS, orderOf, freeShipTravel, playerEntity)();
}

const knight = (rank) => ({ guildMemberships: { [GUILD_GROUPS.KnightlyOrder]: { guild: 'Order:Rose', rank, lastRankChange: 0 } } });

test('audit26 F192: the travel popup asks OwnsShip || FreeShipTravel', () => {
  assert.equal(hostHasShip({}), false, 'no ship, no order');
  assert.equal(hostHasShip({ ownedShip: SHIP_TYPES.Small }), true, 'DaggerfallBankManager.OwnsShip');
  // KnightlyOrder.FreeShipTravel (KnightlyOrder.cs:167-170) is rank 6,
  // and it is the ONLY override of Guild's base false.
  assert.equal(hostHasShip(knight(5)), false);
  assert.equal(hostHasShip(knight(6)), true);
  assert.equal(hostHasShip({ guildMemberships: { [GUILD_GROUPS.FightersGuild]: { guild: 'FightersGuild', rank: 9 } } }), false,
    'no other guild grants free ship travel');
  // the fixed literal is gone
  assert.doesNotMatch(src('src/scenes/world.js'), /hasShip: false/);
});

test('audit26 F192: and a ship is what stops the 25-gold-per-24-pixels ocean charge', () => {
  // travel.js:86 - `if (oceanPixels > 0 && !hasShip && travelShip)`
  assert.equal(calculateTripCost(1000, 30, { travelShip: true, hasShip: false }).totalCost, 25 * (Math.trunc(30 / 24) + 1));
  assert.equal(calculateTripCost(1000, 30, { travelShip: true, hasShip: true }).totalCost, 0);
});

// ---------------------------------------------------------------
// F095 - TalkToNpc (TalkManager.cs:2649) expands the GREETING through
// ExpandRandomTextRecord (:3580-3587): one random variant, the full
// macro pass, TokensToString(false). The static-NPC session was given
// a line join instead, so every %-code in a greeting printed raw.
// ---------------------------------------------------------------

test('audit26 F095: ExpandRandomTextRecord expands macros where a line join cannot', () => {
  const ctx = {
    randomTokens: () => [{ text: 'Greetings, %fn.' }],
    fullName: () => 'Ariel Direnni',
  };
  assert.equal(expandRandomTextRecord(7206, ctx), 'Greetings, Ariel Direnni.');
  // the shape the port had: a join leaves the macro on screen
  const joined = [{ text: 'Greetings, %fn.' }].map((r) => r.text ?? r).join(' ');
  assert.equal(joined, 'Greetings, %fn.');
  // TokensToString(false): an empty token contributes NOTHING, where a
  // join inserts a space
  assert.equal(expandRandomTextRecord(7206, { randomTokens: () => [{ text: 'a' }, { text: '' }, { text: 'b' }] }), 'ab');
});

test('audit26 F095: the NPC session gets the SAME expander the answer pipeline does', () => {
  const s = src('src/scenes/world.js');
  const macroWired = [...s.matchAll(/expandRandomTextRecord: \(id\) => expandTalkRecord\(id, talkMcp\(\)\)/g)];
  assert.equal(macroWired.length, 2, 'the NPC session and the answer pipeline both hold the macro-aware expander');
  // the session's own construction carries it (not just the pipeline's)
  const i = s.indexOf('const npcSession = new NPCSession({');
  const j = s.indexOf('\n  });', i);
  assert.ok(i > 0 && j > i);
  assert.match(s.slice(i, j), /expandRandomTextRecord: \(id\) => expandTalkRecord\(id, talkMcp\(\)\)/);
});

// ---------------------------------------------------------------
// F092 - GetKeySubjectLocationCompassDirection (TalkManager.cs
// :1189-1201) ends in GetBuildingCompassDirection (:1203-1236). The
// seam was declared and never wired, so every directional where-is
// answer expanded %di to '...never mind...'.
// ---------------------------------------------------------------

const DIRECTORY = [
  { buildingKey: 1, position: [100, 0, 0] },     // due east of the origin
  { buildingKey: 2, position: [0, 0, 100] },     // due north
  { buildingKey: 3, position: [-70, 0, -70] },   // southwest
];

test('audit26 F092: GetBuildingCompassDirection, both arms', () => {
  const outside = (key, playerPos) => buildingCompassDirection({ listBuildings: DIRECTORY, playerPos }, key);
  assert.equal(outside(1, [0, 0, 0]), DIRECTION_HINTS.east);
  assert.equal(outside(2, [0, 0, 0]), DIRECTION_HINTS.north);
  assert.equal(outside(3, [0, 0, 0]), DIRECTION_HINTS.southwest);
  // the vector is target - player, so moving the player flips it
  assert.equal(outside(1, [200, 0, 0]), DIRECTION_HINTS.west);
  // C#'s zero vector: 0/0 is NaN, every band fails, the chain falls to
  // its else - '...never mind...', not a confident direction
  assert.equal(outside(1, [100, 0, 0]), DIRECTION_HINTS.resolvingError);

  // INSIDE: the player IS the current building's position, and the
  // building you stand in answers "this place" (:1231-1232)
  const inside = (key, currentBuildingKey) => buildingCompassDirection(
    { listBuildings: DIRECTORY, playerPos: [999, 0, 999], isPlayerInside: true, currentBuildingKey }, key);
  assert.equal(inside(1, 1), DIRECTION_HINTS.thisPlace);
  assert.equal(inside(1, 2), DIRECTION_HINTS.southeast, 'from the north building to the east one');
  assert.equal(inside(2, 3), DIRECTION_HINTS.north);

  // the port's one JS-shaped guard: no location frame at all
  assert.equal(buildingCompassDirection({ listBuildings: DIRECTORY, playerPos: null }, 1), DIRECTION_HINTS.resolvingError);
});

test('audit26 F092: with the seam wired, %di answers a direction instead of the resolving error', () => {
  const localizedText = (key) => TALK_STRINGS[key] ?? '';   // the host's own wiring
  const wired = new AnswerPipeline({
    localizedText,
    buildingCompassDirection: (key) => buildingCompassDirection({ listBuildings: DIRECTORY, playerPos: [0, 0, 0] }, key),
  });
  wired.currentKeySubjectBuildingKey = 1;
  assert.equal(wired.getKeySubjectLocationCompassDirection(), DIRECTION_HINTS.east);
  // the unwired pipeline is what the port shipped: every answer
  // '...never mind...'
  const bare = new AnswerPipeline({ localizedText });
  bare.currentKeySubjectBuildingKey = 1;
  assert.equal(bare.getKeySubjectLocationCompassDirection(), DIRECTION_HINTS.resolvingError);
});

test('audit26 F092: the host mounts the compass on BOTH consumers, over one frame', () => {
  const s = src('src/scenes/world.js');
  // one closure, the directory and the player in the same LOCATION frame
  assert.match(s, /const talkBuildingCompassDirection = \(buildingKey\) => buildingCompassDirection\(\{/);
  assert.match(s, /listBuildings: townTalk\.directory,/);
  assert.match(s, /playerPos: _talkPlayerPos\(\),/);
  // both consumers: the answer pipeline (%di) and questWorld (quest %di)
  const mounts = [...s.matchAll(/buildingCompassDirection: \(buildingKey\) => talkBuildingCompassDirection\(buildingKey\)/g)];
  assert.equal(mounts.length, 2, 'the pipeline and the quest world both hold it');
  // the topics closure and the compass read the SAME position
  assert.match(s, /playerPos: \(\) => _talkPlayerPos\(\),/);
});

// ---------------------------------------------------------------
// F030 (fixed in the previous wave, pinned here) - LevitateMotor.
// Update (LevitateMotor.cs:68-91) reads Jump/FloatUp for up and
// Crouch/FloatDown for down, and AddMovement takes the movement from
// playerCamera.transform.TransformDirection - the camera LOOK, pitch
// included. Every host must hand the motor both.
// ---------------------------------------------------------------

const DT = 1 / 60;
/** A collider that records the requested delta and moves the point. */
const recorder = () => {
  const moves = [];
  return {
    moves,
    move(pos, dx, dy, dz) { pos[0] += dx; pos[1] += dy; pos[2] += dz; moves.push([dx, dy, dz]); return { grounded: false }; },
  };
};

test('audit26 F030: a levitating player GAINS height on FloatUp, and the path follows pitch', () => {
  const rec = recorder();
  const p = new PlayerMotor(rec);
  p.spawn(0, 0, 0);
  p.levitating = true;

  // Vector3.up on Jump/FloatUp (:82-83), at levitateMoveSpeed 4.0
  const y0 = p.pos[1];
  p.update(DT, { forward: 0, strafe: 0, run: false, jump: false, up: true, down: false }, 0, 0);
  assert.ok(p.pos[1] > y0, 'FloatUp gains height');
  approx(rec.moves[0][1], LEVITATE_MOVE_SPEED * DT);
  assert.equal(p.velY, 0, 'no gravity on the levitate path');

  // Vector3.down on Crouch/FloatDown (:84-85)
  const y1 = p.pos[1];
  p.update(DT, { forward: 0, strafe: 0, run: false, jump: false, up: false, down: true }, 0, 0);
  assert.ok(p.pos[1] < y1, 'FloatDown loses height');
  approx(rec.moves[1][1], -LEVITATE_MOVE_SPEED * DT);

  // C#'s ladder is else-if, so up WINS when both are held
  p.update(DT, { forward: 0, strafe: 0, run: false, jump: false, up: true, down: true }, 0, 0);
  approx(rec.moves[2][1], LEVITATE_MOVE_SPEED * DT);

  // TransformDirection: the forward axis is the LOOK, so pitch tilts
  // the whole path - my = sin(pitch), the horizontal keeps cos(pitch)
  for (const pitch of [-Math.PI / 6, Math.PI / 4, -Math.PI / 2]) {
    const r2 = recorder();
    const q = new PlayerMotor(r2);
    q.spawn(0, 0, 0);
    q.levitating = true;
    q.update(DT, { forward: 1, strafe: 0, run: false, jump: false, up: false, down: false }, 0, pitch);
    approx(r2.moves[0][1], Math.sin(pitch) * LEVITATE_MOVE_SPEED * DT, 1e-9);
    approx(Math.hypot(r2.moves[0][0], r2.moves[0][2]), Math.abs(Math.cos(pitch)) * LEVITATE_MOVE_SPEED * DT, 1e-9);
  }

  // level flight is level: pitch 0 moves no y at all
  const r3 = recorder();
  const q = new PlayerMotor(r3);
  q.spawn(0, 0, 0);
  q.levitating = true;
  q.update(DT, { forward: 1, strafe: 0, run: false, jump: false, up: false, down: false }, 0, 0);
  approx(r3.moves[0][1], 0, 1e-9);
});

test('audit26 F030: no host drops the up/down keys or the pitch argument', () => {
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js', 'src/scenes/worldModes.js']) {
    const s = src(f);
    const starts = [...s.matchAll(/player\.update\(dt,/g)].map((m) => m.index);
    assert.ok(starts.length > 0, `${f} drives the motor`);
    for (const i of starts) {
      const tail = s.indexOf('}, cam.', i);
      assert.ok(tail > i, `${f}: the motor call closes`);
      assert.match(s.slice(tail, tail + 32), /^\}, cam\.yaw, cam\.pitch\);/,
        `${f} passes the camera LOOK, pitch included`);
      const body = s.slice(i, tail);
      assert.match(body, /up: jumpHeld \|\| held\(keys, 'FloatUp'\)/, `${f} reads Jump/FloatUp for up`);
      assert.match(body, /down: held\(keys, 'FloatDown'\)/, `${f} reads FloatDown for down`);
    }
  }
});
