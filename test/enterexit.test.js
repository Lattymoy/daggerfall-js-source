import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ENTER_DOOR_OFFSET, EXIT_DOOR_OFFSET, MARKER_UP_OFFSET, DUNGEON_EXIT_OFFSET,
  doorWorldPosition, doorWorldNormal, interiorLanding, exteriorLanding,
  dungeonEntranceLanding, climbLadder,
  floorLanding,
} from '../src/player/enterExit.js';
import { trs } from '../src/world/mat4.js';
import { Collider } from '../src/player/collider.js';

const approx = (a, b, eps = 1e-4) =>
  assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

test('enterExit: verbatim offsets', () => {
  approx(ENTER_DOOR_OFFSET, 0.35 + 0.4); // radius + 0.4
  approx(EXIT_DOOR_OFFSET, 0.35 * 3); // radius * 3
  approx(MARKER_UP_OFFSET, 1.8 * 0.6); // height * 0.6
});

test('enterExit: door transform under the placement matrix', () => {
  // Door centre/normal arrive PRE-scaled and Y-negated (meshReader
  // stores door verts in mesh convention); the world transform is the
  // placement matrix alone. Ry(90) carries local +x onto -z.
  const door = {
    matrix: trs(10, 0, 5, 0, 90, 0),
    centre: { x: 1, y: 2, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
    size: { x: 0.1, y: 2.2, z: 1 },
  };
  const p = doorWorldPosition(door);
  approx(p[1], 2);
  approx(Math.hypot(p[0] - 10, p[2] - 5), 1);
  approx(p[2] - 5, -1); // rotation direction pinned
  const n = doorWorldNormal(door);
  approx(Math.hypot(n[0], n[1], n[2]), 1);
  approx(n[1], 0);
  approx(Math.abs(n[0]), 1); // +z normal swings onto x under Ry(90)
});

test('enterExit: landings - marker snap, door offset, closest pick', () => {
  const I = trs(0, 0, 0, 0, 0, 0);
  const mkDoor = (x, z, nx, nz) => ({
    matrix: I,
    centre: { x, y: 0, z }, // mesh-convention units, identity placement
    normal: { x: nx, y: 0, z: nz },
    size: { x: 0.1, y: 2.2, z: 1 },
  });

  // Two interior doors; the enter marker sits near door B, so the
  // landing must use B even though the exterior door is nearer A.
  const doorA = mkDoor(0, 0, 0, 1);
  const doorB = mkDoor(10, 0, 1, 0);
  const landing = interiorLanding([1, 0, 0], [[9, 0, 0.5]], [doorA, doorB]);
  approx(landing[0], 10 + 1 * ENTER_DOOR_OFFSET);
  approx(landing[2], 0);

  // No doors: marker + up * 1.08.
  const fallback = interiorLanding([1, 0, 0], [[9, 0, 0.5]], []);
  approx(fallback[1], 0 + MARKER_UP_OFFSET);
  assert.equal(interiorLanding([0, 0, 0], [], []), null);

  // Exit: closest exterior sibling + normal * 1.05.
  const out = exteriorLanding([9.6, 0, 0.2], [doorA, doorB]);
  approx(out[0], 10 + EXIT_DOOR_OFFSET);
  approx(out[2], 0);
});

test('enterExit: dungeon exit landing - offset and lowest-door pick', () => {
  approx(DUNGEON_EXIT_OFFSET, 0.35 + 0.1);
  const I = trs(0, 0, 0, 0, 0, 0);
  const high = { matrix: trs(0, 5, 0, 0, 0, 0), centre: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 1 } };
  const low = { matrix: I, centre: { x: 10, y: 1, z: 0 }, normal: { x: 1, y: 0, z: 0 } };
  const landing = dungeonEntranceLanding([high, low]);
  approx(landing.pos[0], 10 + DUNGEON_EXIT_OFFSET);
  approx(landing.pos[1], 1);
  approx(landing.normal[0], 1);
  assert.equal(dungeonEntranceLanding([]), null);
});

test('enterExit: ladder climb - verbatim marker rules', () => {
  const M = { LADDER_BOTTOM: 21, LADDER_TOP: 22 };
  const markers = [
    { type: 21, x: 0, y: 0.5, z: 0 },
    { type: 22, x: 0, y: 4.2, z: 0 },
    { type: 22, x: 30, y: 9, z: 0 }, // a farther top must lose
  ];
  // Below the top -> teleports TO the top.
  assert.deepEqual(climbLadder([0.4, 1.0, 0], markers, M), [0, 4.2, 0]);
  // Above the bottom (standing at the top) -> teleports to the bottom.
  assert.deepEqual(climbLadder([0.2, 4.2, 0], markers, M), [0, 0.5, 0]);
  // No markers -> null.
  assert.equal(climbLadder([0, 1, 0], [], M), null);
});

test('floorLanding: FixStanding snap - a raised landing floors instantly', () => {
  // Raw landings sit at door-centre height / marker + 1.08; DFU ends
  // every transition with FixStanding's raycast snap. Gravity-flooring
  // instead was the visible "drop in" on building entry.
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const c = new Collider(() => -Infinity);
  c.addMesh('floor', new Float32Array([-5, 0.7, -5, 5, 0.7, -5, 5, 0.7, 5, -5, 0.7, 5]), new Uint32Array([0, 1, 2, 0, 2, 3]), I);
  const floored = floorLanding(c, [1, 1.9, 1]);      // 1.2 above the floor
  approx(floored[1], 0.7, 1e-3);
  assert.equal(floored[0], 1); assert.equal(floored[2], 1);
  const noHit = floorLanding(c, [20, 1.9, 20]);      // off the floor quad: unchanged, gravity fallback
  assert.deepEqual(noHit, [20, 1.9, 20]);
});

// ── THE EXTERIOR SIDE OF THE DOOR (2026-08-27, Mac: "when entering/
// exiting locations your character spawns in the air and drops") ──
//
// Both exterior exits are RepositionPlayer(Offset|DungeonEntrance) in
// DFU (StreamingWorld.cs:283-288): the door centre plus the normal is
// where the controller's CENTRE goes, never below terrain + height/2 +
// 0.15 (:1345-1351). The port's spawn is the FEET, and it was handed
// the centre - a body-half in the air, then a drop, at every door out.
import { repositionFeetY } from '../src/player/enterExit.js';
import { CAPSULE_HEIGHT } from '../src/player/motor.js';
import { readFileSync } from 'node:fs';
const src = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('repositionFeetY: RepositionPlayer\'s height law, in feet', () => {
  // A door centre 1.2u above flat terrain at 10: the centre is above the
  // floor minimum, so the centre stands and the feet are h/2 below it.
  assert.equal(repositionFeetY(10, 11.2), 11.2 - CAPSULE_HEIGHT / 2);
  assert.ok(Math.abs(repositionFeetY(10, 11.2) - 10.3) < 1e-9, 'feet 0.3 over the terrain, which gravity settles - not 1.2');
  // A door centre at or under the terrain (a sunken doorway): the floor
  // minimum wins - terrain + 0.15 in feet (terrain + h/2 + 0.15, centre).
  assert.equal(repositionFeetY(10, 9.5), 10.15);
  assert.equal(repositionFeetY(10, 10.9), 10.15, 'exactly at the minimum, not below it');
  // No terrain beneath (heightAt's -Infinity): the centre alone decides.
  assert.equal(repositionFeetY(-Infinity, 5), 5 - CAPSULE_HEIGHT / 2);
  assert.equal(repositionFeetY(undefined, 5), 5 - CAPSULE_HEIGHT / 2);
  // The constants are DFU's: half the standing height, plus 0.15.
  assert.equal(CAPSULE_HEIGHT, 1.8);
});

test('the exits and the arrivals stand the player, they do not drop them', () => {
  const wm = src('src/scenes/worldModes.js');
  // The building exit and the dungeon exit both go through the law,
  // with the terrain read off the collider they are about to stand on.
  assert.match(wm, /player\.spawn\(landing\[0\], repositionFeetY\(player\.collider\.heightAt\(landing\[0\], landing\[2\]\), landing\[1\]\), landing\[2\]\)/,
    'building exit: feet from the door centre');
  assert.match(wm, /player\.spawn\(landing\.pos\[0\], repositionFeetY\(player\.collider\.heightAt\(landing\.pos\[0\], landing\.pos\[2\]\), landing\.pos\[1\]\), landing\.pos\[2\]\)/,
    'dungeon exit: the same law');
  assert.doesNotMatch(wm, /player\.spawn\(landing\[0\], landing\[1\], landing\[2\]\)/, 'the raw centre spawn is gone');
  assert.doesNotMatch(wm, /player\.spawn\(landing\.pos\[0\], landing\.pos\[1\], landing\.pos\[2\]\)/);
  // The world host's arrivals: PositionPlayerToLocation ends in
  // FixStanding (StreamingWorld.cs:1597-1608), so the teleport and the
  // first drop-in snap to the built pixel instead of falling 2u.
  const w = src('src/scenes/world.js');
  // PIN MOVED (Road to 1:1, a3): the court's location-entrance arm is
  // the first caller to hand a landing that DOES want grounding -
  // RepositionPlayer's own `grounded` argument (StreamingWorld.cs:1587,
  // :1592), true for every location but HomeYourShips. The default is
  // unchanged, so the ship's remembered deck still lands as saved.
  //
  // PIN MOVED AGAIN (ship landing, 2026-09-03): the location arm runs
  // INSIDE the core now, after the destination pixel is built, so the
  // two terms are the resolved `local` (the location landing or the
  // caller's own) and the resolved `ground` (the LocationType's or the
  // caller's) rather than the raw arguments.
  assert.match(w, /const local = landing\?\.pos \?\? localPos;/, 'the location landing outranks the caller\'s');
  assert.match(w, /const ground = landing \? landing\.grounded : grounded;/, 'grounded off the LocationType when there is a landing');
  // TL1: the arrival looks further for its floor than a door step does.
  assert.match(w, /let pos = walkMode && \(!local \|\| ground\) \? floorLanding\(collider, raw, ARRIVAL_REACH, ARRIVAL_LIFT\) : raw;/, 'fast travel / teleport arrivals');   // TL2: `let`, so an obstructed marker can fall back
  assert.match(w, /const stand = floorLanding\(collider, \[cam\.pos\[0\], heightAt\(cam\.pos\[0\], cam\.pos\[2\]\) \+ 2, cam\.pos\[2\]\]\);/, 'the first drop-in');
  // And a saved position is restored as saved - a load or an anchor
  // recall keeps its own y (DFU restores the transform verbatim).
  assert.match(w, /const ly = \(w\.y \?\? 2\) \+ state\.compensation\[1\];/);
  // ROAD A10 MOVED THIS PIN: the anchor arrival folded into ONE helper
  // (anchorLanding) shared by the exterior, dungeon and interior recall
  // arms - the compensated-y law lives on its return now.
  assert.match(w, /return \[lx, \(a\.y \?\? 2\) \+ state\.compensation\[1\], lz\];/);
});

// ── TL1: THE ARRIVAL LOOKS FURTHER FOR ITS FLOOR ──────────────────
// Mac: "you don't remain on the ground after traveling, you spawn in
// the air and drop."
test('TL1: an arrival finds a floor far below OR far above its raw, where a door step would not', async () => {
  const { floorLanding } = await import('../src/player/enterExit.js');
  const plane = (floorY) => ({ raycast(o, d, max) { const t = (o[1] - floorY) / -d[1]; return t >= 0 && t <= max ? t : Infinity; } });
  // The door step's ten units: a floor thirty below is missed and the
  // raw stands - in the air - and a floor twenty ABOVE is missed too,
  // the ray starting inside the hill.
  assert.equal(floorLanding(plane(-30), [0, 2, 0])[1], 2, 'old reach: left in the air');
  assert.equal(floorLanding(plane(20), [0, 2, 0])[1], 2, 'old reach: left inside the hill');
  // The arrival's lift and reach find both.
  assert.equal(floorLanding(plane(-30), [0, 2, 0], 240, 40)[1], -30);
  assert.equal(floorLanding(plane(20), [0, 2, 0], 240, 40)[1], 20);
  // ...and a flat site lands exactly where it always did.
  assert.equal(floorLanding(plane(0), [0, 2, 0], 240, 40)[1], 0);
  const { readFileSync } = await import('node:fs');
  const world = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(world, /const ARRIVAL_LIFT = 40;\s*\n\s*const ARRIVAL_REACH = 240;/);
  assert.match(world, /floorLanding\(collider, raw, ARRIVAL_REACH, ARRIVAL_LIFT\)/, 'the arrival passes both');
  // Ordinary door steps keep their ten units - a step is not a fast travel.
  const ee = readFileSync(new URL('../src/player/enterExit.js', import.meta.url), 'utf8');
  assert.match(ee, /export function floorLanding\(collider, pos, maxDist = 10, extraHeight = 0\)/);
});

// ── TL2: A LANDING IN A BUILDING'S FOOTPRINT IS REFUSED ────────────
// Mac: "you can spawn inside the building geometry."
test('TL2: a marker whose floor is a roof falls back to the edge landing', async () => {
  const { readFileSync } = await import('node:fs');
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  // The floor the arrival ray found is checked against the flat: more
  // than OBSTRUCTED_ABOVE over it is a roof, and the landing is refused
  // for the edge landing, which stands outside the blocks by construction.
  assert.match(w, /const OBSTRUCTED_ABOVE = 3;/);
  assert.match(w, /if \(walkMode && landing && pos\[1\] - raw\[1\] > OBSTRUCTED_ABOVE\) \{\s*\n\s*const edge = locationLandingFor\(px, py, \{ noMarkers: true \}\);/);
  assert.match(w, /pos = floorLanding\(collider, eraw, ARRIVAL_REACH, ARRIVAL_LIFT\);/, 'and the edge is floored the same way');
  // noMarkers really removes the markers from the choice.
  assert.match(w, /const startMarkers = b\?\.locBlocks && !noMarkers/);
  // Only a MARKER landing is second-guessed: the edge landing and a
  // caller's explicit localPos stand where they were told.
  assert.match(w, /walkMode && landing && pos\[1\]/);
});
