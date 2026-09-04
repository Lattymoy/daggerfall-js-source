// SD1 - THE LOOSE FOE STANDS WHERE DFU STANDS IT (2026-08-29).
//
// SoulBound's break release and the Sanguine Rose's Daedroth are the
// two enchantments that put a foe in the world. Both dropped it at the
// player's feet plus a fixed (+2, +1, 0) - inside the player in a
// corridor, inside the wall against one - and EC1 had just made them
// refuse underground rather than stand it in the streaming world the
// player was not in.
//
// The law they needed was ALREADY IN THE TREE. B1 ported
// FoeSpawner.PlaceFoeFreely for the quest foe arm, raycast ring and
// all, and this slice began by writing a second copy of it before
// finding the first. One home; SD1 routes the enchantment arms through
// the same function tryPlaceFoe uses.
//
// What was genuinely missing is DFU's OTHER rotation arm. PlaceFoeFreely
// (:141-155) has two: LineOfSightCheck true tries to spawn just outside
// the player's field of view, false takes any bearing in the circle
// ("Don't care about player's field of view (e.g. at rest)"). Only the
// first was ported - and SoulBound passes FALSE (SoulBound.cs:100), so
// a released soul is allowed to appear in front of you, which is the
// whole character of the effect.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { placeFoeFreely, PLACE_FOE_DEFAULTS } from '../src/systems/quest/sceneMount.js';
import { placeFoeEnv } from '../src/scenes/questFoeHost.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(HERE, '..', rel), 'utf8');

/** An open room: nothing to hit sideways, a floor 2 below, no capsules.
 *  `rolls` is a scripted sequence so each arm's draws are exact. */
function openRoom(seq) {
  let i = 0;
  const collider = {
    raycastHit: (o, d) => (d[1] === -1
      ? { dist: 2, key: null, normal: [0, 1, 0] }
      : { dist: Infinity, key: null, normal: null }),
    sphereOverlaps: () => false,
  };
  return placeFoeEnv({
    collider, playerFeet: [0, 0.9, 0], playerYawRad: 0, fovDegrees: 60,
    rolls: () => seq[i++ % seq.length],
  });
}
/** The bearing a spot was placed on, in degrees off the player's yaw. */
const bearingDeg = (spot) => ((Math.atan2(spot.x, spot.z) * 180 / Math.PI) + 360) % 360;

/** How far off the player's own facing a spot sits, 0..180. */
const offAxisDeg = (spot) => Math.min(bearingDeg(spot), 360 - bearingDeg(spot));

test('SD1: with the LOS check the foe lands just OUTSIDE the view cone, either side', () => {
  // draws: the 0..4 jitter, then the side coin, then the open-area distance.
  // The coin is `> 0.5 ? -angle : +angle`, so the HIGH roll is the minus side.
  const minus = placeFoeFreely(openRoom([0, 1, 0.5]), { minDistance: 4, maxDistance: 20 });
  const plus = placeFoeFreely(openRoom([0, 0, 0.5]), { minDistance: 4, maxDistance: 20 });
  assert.equal(Math.round(bearingDeg(minus)), 300, 'fov 60 + 0 jitter, coin > 0.5 = the MINUS side');
  assert.equal(Math.round(bearingDeg(plus)), 60, 'and a low coin is the same angle mirrored');
  // never inside the cone: the off-axis angle is at least the half-FOV either way
  for (const s of [minus, plus]) {
    assert.ok(offAxisDeg(s) >= 30, `a spawn at ${offAxisDeg(s)} degrees would be inside a 60-degree view`);
  }
});

test('SD1: the jitter widens the angle, and only OUTWARDS (Random(0, 4))', () => {
  // it is added to directionAngle BEFORE the sign, so it pushes further
  // from the player's facing on whichever side the coin picked - never
  // back toward the cone.
  for (const coin of [1, 0]) {
    const near = placeFoeFreely(openRoom([0, coin, 0.5]), { minDistance: 4, maxDistance: 20 });
    const far = placeFoeFreely(openRoom([1, coin, 0.5]), { minDistance: 4, maxDistance: 20 });
    assert.equal(Math.round(offAxisDeg(far) - offAxisDeg(near)), 4,
      `a full roll adds the whole 4 degrees, away from the view (coin ${coin})`);
  }
});

test('SD1: lineOfSightCheck FALSE takes any bearing in the circle - the arm SoulBound passes', () => {
  // one draw for the bearing, then the distance - NOT the jitter/coin pair
  const ahead = placeFoeFreely(openRoom([0, 0.5]), { minDistance: 4, maxDistance: 20, lineOfSightCheck: false });
  assert.equal(Math.round(bearingDeg(ahead)), 0,
    'a zero roll puts the released soul DEAD AHEAD - the LOS arm can never do this');
  const quarter = placeFoeFreely(openRoom([0.25, 0.5]), { minDistance: 4, maxDistance: 20, lineOfSightCheck: false });
  assert.equal(Math.round(bearingDeg(quarter)), 90, 'and the roll spans the full 360');
  // and the distance draw is the NEXT roll, not a third one - the arm
  // consumes one fewer than the LOS arm, which is how the sequences differ
  assert.equal(Math.round(Math.hypot(quarter.x, quarter.z)), 12, '4 + 0.5 * (20 - 4)');
});

test('SD1: the open-area distance rides the caller\'s band, not the signature default', () => {
  // CreateFoeSpawner's fields are min 4 / max 20 (GameObjectHelper.cs
  // :1314); placeFoeFreely's own signature says 5. The enchantment
  // callers get the spawner's, so the band has to be passed.
  const own = placeFoeFreely(openRoom([0, 0.5]), { lineOfSightCheck: false });
  const spawner = placeFoeFreely(openRoom([0, 0.5]), { minDistance: 4, maxDistance: 20, lineOfSightCheck: false });
  assert.equal(Math.round(Math.hypot(own.x, own.z)), 13, 'the default band is 5..20');
  assert.equal(Math.round(Math.hypot(spawner.x, spawner.z)), 12, 'the spawner band is 4..20');
  assert.equal(PLACE_FOE_DEFAULTS.minDistance, 5, 'and the table still records the function\'s own');
});

test('SD1: both arms still land on the floor, and still refuse an occupied spot', () => {
  // the arms differ in BEARING only - every later refusal is shared.
  const spot = placeFoeFreely(openRoom([0, 0.5]), { lineOfSightCheck: false });
  assert.equal(spot.y, 0.9 - 2 + PLACE_FOE_DEFAULTS.separationDistance,
    'floor 2 below the cast origin, then DFU\'s separation above it');
  const packed = placeFoeEnv({
    collider: {
      raycastHit: (o, d) => (d[1] === -1 ? { dist: 2, key: null, normal: [0, 1, 0] } : { dist: Infinity, key: null, normal: null }),
      sphereOverlaps: () => true,   // something is already standing there
    },
    playerFeet: [0, 0.9, 0], playerYawRad: 0, fovDegrees: 60, rolls: () => 0.5,
  });
  assert.equal(placeFoeFreely(packed, { lineOfSightCheck: false }), null, 'refused, and the caller retries');
  assert.equal(placeFoeFreely(packed), null, 'the LOS arm refuses the same spot for the same reason');
});

test('SD1: the dungeon has a BEHAVIOUR-FREE spawn door, and the quest one is built on it', () => {
  const dc = read('src/scenes/dungeonContext.js');
  assert.match(dc, /async function spawnLooseFoe\(mobileType, position, \{ gender = null, yawRad = null, allied = false \} = \{\}\)/);
  // MT-ii: BOTH per-instance fields turn, and the frozen basics row does not
  assert.match(dc, /if \(allied && f\.entity\) \{ f\.entity\.team = 'PlayerAlly'; f\.entity\.mobileTeam = 'PlayerAlly'; \}/);
  // and spawnQuestFoe is the same door plus the binding - not a second copy
  assert.match(dc, /const f = await spawnLooseFoe\(mobileType, position, \{ gender, yawRad \}\);[\s\S]*?bindQuestFoeHost\(f, behaviour, questPoolOps\);/);
  assert.match(dc, /\n    spawnLooseFoe,/, 'the ctx hands it out');
});

test('SD1: the two enchant arms differ exactly as their DFU callers differ', () => {
  // WAVE D: the two arms are in the SHARED ctx body, so the difference
  // between them is stated once for every host that mounts it.
  const he = read('src/scenes/hostEnchant.js');
  assert.match(he, /spawnFoe: \(mobileType\) => \{ standFoe\?\.\(mobileType, \{ lineOfSightCheck: false \}\); \}/,
    'SoulBound.cs:100 passes false');
  assert.match(he, /spawnAlliedFoe: \(mobileType\) => \{ standFoe\?\.\(mobileType, \{ allied: true \}\); \}/,
    'SanguineRoseEffect.cs:56 takes the default true, and allied');
  // the fixed offset both used is gone
  const world = read('src/scenes/world.js');
  assert.equal(/spawnFoe\(mobileType, \[pf\[0\] \+ 2, pf\[1\] \+ 1, pf\[2\]\]/.test(world), false);
});

test('SD1: the stander uses the ONE placement law, the live world, and the live pool', () => {
  // WAVE D: the placement itself is scenes/hostEnchant.js's, so the
  // dungeon host stands its released souls through the same law rather
  // than a copy of it. What stays in each host is the two terms only
  // that host can answer - which collider, and which pool door.
  const he = read('src/scenes/hostEnchant.js');
  const body = he.slice(he.indexOf('export function standLooseFoe'));
  assert.match(body, /playerFeet: \[feet\[0\], feet\[1\] \+ 0\.9, feet\[2\]\],/, 'the cast origin is the controller centre, as tryPlaceFoe has it');
  assert.match(body, /isOccupied: entityOccupancy\(\(f\) => f\.ai\?\.feet, \(\) => foes, feet\)/,
    'the occupancy term reads the pool it was handed, so a dungeon foe blocks a dungeon spawn');
  assert.match(body, /spot = placeFoeFreely\(env, \{ minDistance: 4, maxDistance: 20, lineOfSightCheck \}\);/);
  // FinalizeFoe's fork, and the LookAt
  assert.match(body, /const fly = \(ENEMY_BASICS\[mobileType\]\?\.behaviour \?\? 'General'\) === 'Flying';/);
  assert.match(body, /const pos = \[spot\.x, fly \? spot\.y \+ 1\.5 : spot\.y, spot\.z\];/);
  assert.match(body, /const yaw = Math\.atan2\(feet\[0\] - spot\.x, feet\[2\] - spot\.z\);/);
  // and the retry is BOUNDED - DFU leaves a MonoBehaviour running free
  assert.match(he, /export const LOOSE_FOE_PLACE_ATTEMPTS = 12;/);
  assert.match(body, /for \(let i = 0; i < LOOSE_FOE_PLACE_ATTEMPTS && !spot; i\+\+\)/);

  // the world host: the two terms it owns, and the interior refusal
  const world = read('src/scenes/world.js');
  const wb = world.slice(world.indexOf('const _standLooseFoe ='), world.indexOf('const _standLooseFoe =') + 2400);
  assert.match(wb, /collider: d \? d\.collider : collider,/, 'a dungeon is raycast against the DUNGEON\'s geometry');
  assert.match(wb, /fovDegrees: fieldOfView\(\) \* 180 \/ Math\.PI,/, 'fieldOfView() answers RADIANS - the raw value places every foe inside the cone');
  assert.match(wb, /foes: enchantFoes\(\),/, 'EC1\'s live pool');
  // ROAD-G G1: the interior no longer refuses - it has a pool, and the
  // arm routes to the host that owns it before the two-mode gate.
  assert.match(wb, /if \(mode === 'interior'\) return modes\?\.insideStandLooseFoe\?\.\(mobileType, opts\) \?\? null;/,
    'a building stands its foe through worldModes\' own pool');
  assert.match(wb, /if \(mode !== 'exterior' && mode !== 'dungeon'\) return null;/,
    'and a mode with NO pool at all still refuses');
  // the dungeon host: its own collider, its own motor yaw, its own door
  const dc = read('src/scenes/dungeonContext.js');
  const db = dc.slice(dc.indexOf('standLooseFoe: (mobileType, o = {}) => standLooseFoe({'), );
  assert.match(db.slice(0, 700), /yawRad: _motorYaw,/);
  assert.match(db.slice(0, 700), /spawn: \(mt, pos, so\) => spawnLooseFoe\(mt, pos, \{ yawRad: so\.yawRad, allied: so\.allied \}\),/);
});

test('SD1: EC1\'s refusal flag is retired, and nothing still claims the door is missing', () => {
  const world = read('src/scenes/world.js').replace(/"[^"]*"/g, '""');
  assert.equal(/FLAGGED: the dungeon spawner is spawnQuestFoe/.test(world), false);
  assert.equal(/are refused rather\n\s*\/\/ than misrouted/.test(world), false);
  // the whole tree, not just the line the slice was looking at
  for (const f of ['src/scenes/world.js', 'src/scenes/dungeonContext.js', 'src/scenes/exteriorFoes.js']) {
    assert.equal(/behaviour-free door split out of it/.test(read(f).replace(/"[^"]*"/g, '""')), false, `${f} still defers`);
  }
});
