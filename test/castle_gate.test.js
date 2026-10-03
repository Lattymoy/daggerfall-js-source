// CASTLE-GATE (2026-10-02, Mac: "lets finish the build work"): A CROWN'S FIELD AND BANNERS AT ITS CASTLE'S ENTRANCE IN
// THE CITY (bible/11-Multiplayer/Seats-Arc.md 3.4 anchor 4, 6.2, 7.6). The city's host finds the castle's door - the
// lowest of the pixel's dungeon-entrance doors (systems/siegeField.js castleEntranceOf; DFU lands a player leaving the
// castle at its lowest, player/enterExit.js dungeonEntranceLanding) - and hands it, at a crown alone, to the battlefield
// (siegeFieldOf's `castle`: the Throne, the Gatehouse, the defenders' camp, the Palace square and the Royal Tourney's ring)
// and to the seat's banners (seatBannerAnchors' `castle`: two more flanking it, after the palace's two).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { castleEntranceOf, doorFace, siegeFieldOf, royalRingWire, siegeWorldPoint, SIEGE_FIELD } from '../src/systems/siegeField.js';
import { hallBannerAnchors, doorNormalOf } from '../src/scenes/hallBanners.js';
import { seatBannerAnchors } from '../src/scenes/seatBanners.js';
import { SEAT_BANNERS_MAX } from '../src/net/townSeatLaw.js';

const door = (a, b, box) => ({ door: { a, b }, box });
const near = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-9;
const nearN = (p, q) => p.length === q.length && p.every((c, i) => Math.abs(c - q[i]) < 1e-9);

test('CASTLE-GATE castleEntranceOf: the LOWEST of the dungeon-entrance doors, the first on a tie, a fresh box; a door with no corners or no box passed over; none, null (mutants: the highest; the last on a tie; the box shared)', () => {
  const box = [60, 0, -20, 100, 30, 20];
  const upper = door([60, 12, -1], [60, 15, 1], box);
  const lower = door([60, 0, -1], [60, 3, 1], box);
  const twin = door([70, 0, -1], [70, 3, 1], box);
  const got = castleEntranceOf([upper, lower, twin]);
  assert.deepEqual(got.door, lower.door, 'the lowest - the one DFU lands a leaving player at');
  assert.notEqual(got.box, box, 'its own copy of the box');
  assert.deepEqual(got.box, box);
  assert.deepEqual(castleEntranceOf([twin, lower]).door, twin.door, 'a tie keeps the records\' first');
  assert.equal(castleEntranceOf([{ door: null, box }, { door: lower.door, box: [1, 2] }]), null);
  assert.equal(castleEntranceOf([]), null);
  assert.equal(castleEntranceOf(null), null);
});

test('CASTLE-GATE the crown\'s field before the castle the town stands: the Throne, the defenders\' camp and the Palace square before the entrance castleEntranceOf found, and the Royal Tourney\'s ring with them; a palace seat\'s field untouched (mutants: the castle unpassed; the ring at the palace)', () => {
  const frames = new Map([['palace', door([-1, 0, 0], [1, 0, 0], [-10, 0, -20, 10, 10, 0])]]);
  const castle = castleEntranceOf([door([60, 9, -1], [60, 12, 1], [60, 0, -20, 100, 30, 20]), door([60, 0, -1], [60, 3, 1], [60, 0, -20, 100, 30, 20])]);
  const base = { frames, palaceKeys: ['palace'], gates: [{ box: [-1, 0, 299, 1, 6, 301] }], centre: [0, 100] };
  const crown = siegeFieldOf({ ...base, tier: 'crown', castle });
  assert.ok(near(crown.throne, [60 - SIEGE_FIELD.thronePaceM, 0]), `the Throne (and the Gatehouse on it) at the castle: ${crown.throne}`);
  assert.ok(near(crown.camps.defend, [60 - SIEGE_FIELD.defendCampM, 0]));
  assert.ok(near(crown.banners[3], [60 - SIEGE_FIELD.squareM, 0]));
  assert.deepEqual(royalRingWire(10, 20, crown), [siegeWorldPoint(10, 20, [60 - SIEGE_FIELD.squareM, 0])], 'the Tourney\'s ring in the castle\'s square');
  const palace = siegeFieldOf({ ...base, tier: 'palace', castle: null });
  assert.ok(near(palace.throne, [0, SIEGE_FIELD.thronePaceM]));
});

test('CASTLE-GATE the crown\'s two banners flank its castle\'s entrance, after the palace\'s two and before the gates and boards; with no castle the town hangs what it did (mutants: the castle\'s pair dropped; hung last)', () => {
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const frames = new Map([['p', { box: [-5, 0, -5, 5, 8, 5], door: { a: [-1, 0, 5], b: [1, 0, 5] } }]]);
  const castle = { box: [60, 0, -20, 100, 30, 20], door: { a: [60, 0, -1], b: [60, 6, 1] } };
  const gates = Array(10).fill({ local: I, box: [-2, 0, -0.5, 2, 6, 0.5] });
  const without = seatBannerAnchors({ frames, palaceKeys: ['p'], gates, centre: [0, 20] });
  const withCastle = seatBannerAnchors({ frames, palaceKeys: ['p'], castle, gates, centre: [0, 20] });
  assert.equal(withCastle.length, SEAT_BANNERS_MAX);
  assert.deepEqual(withCastle.slice(0, 2), without.slice(0, 2), 'the palace\'s two first');
  for (const a of withCastle.slice(2, 4)) assert.ok(a.top[0] < 60 && a.top[0] > 59, `a castle banner beside its door: ${a.top}`);
  assert.deepEqual(seatBannerAnchors({ frames, palaceKeys: ['p'], castle: null, gates, centre: [0, 20] }), without);
});

test('CASTLE-GATE wired in the city\'s host: a town with a dungeon gathers its dungeon-entrance doors with their models\' boxes and their outward normals, and a crown hands the entrance to its banners and its field alike; a palace seat hands none (mutants: the doors ungathered; the normal ungathered; the tier\'s gate; one call unhanded)', () => {
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /if \(dfLocation\.hasDungeon\) for \(const d of cpu\.doors\) if \(d\.type === DOOR_TYPE\.DUNGEON_ENTRANCE\) pixelDungeonDoors\.push\(\{ door: doorCornersOf\(d, local\), box, normal: doorNormalOf\(d, local\), arena: b\.blockName === ARENA_BLOCK \}\);/);   // AUDIT PRE-MERGE 1003 W7: the arena's stair marked
  assert.match(w, /const castleGate = seatTier === 'crown' \? castleEntranceOf\(pixelDungeonDoors\) : null;/);
  assert.match(w, /seatBannerAnchors\(\{\n\s*frames: pixelHomeFrames, palaceKeys: seatPalaceKeys, castle: castleGate,/);
  assert.match(w, /tier: seatTier, castle: castleGate,\n\s*\}\) : null;/);
});

test('CASTLE-GATE AUDIT G1: the castle\'s entrance faces along its door record\'s OUTWARD NORMAL - a U-shaped castle\'s forecourt or a recessed gate, whose box middle stands outside the door, faces out, not into the keep; a frame with no normal, or one that does not lean along the face, falls back to the box middle (mutants: the normal ignored; its sign reversed; any lean taken; the normal not carried; the banners\' face off the box alone)', () => {
  const span = { a: [-2, 0, 0], b: [2, 5, 0] };
  const uBox = [-20, 0, -10, 20, 25, 30];   // the keep behind z = 0, the forecourt's walls out to z = +30
  const recessed = [-4, 0, -1, 4, 8, 3];      // the gate's frame stands 3 m proud of the door, its wall 1 m behind
  for (const box of [uBox, recessed]) {
    const f = doorFace({ door: span, box, normal: [0, 0, 1] });
    assert.ok(nearN(f.out, [0, 1]), `out along the normal: ${f.out}`);
    assert.ok(nearN(doorFace({ door: span, box }).out, [0, -1]), 'no normal: away from the box middle, as before');
  }
  assert.ok(nearN(doorFace({ door: span, box: [-20, 0, -30, 20, 25, 10], normal: [0, 0.2, -0.98] }).out, [0, -1]), 'a normal pointing -z faces -z, whatever the box says');
  assert.ok(nearN(doorFace({ door: span, box: uBox, normal: [0, 1, 0] }).out, [0, -1]), 'a normal straight up says nothing of the face: the box middle');
  assert.ok(nearN(doorFace({ door: span, box: uBox, normal: [0.9, 0, 0.3] }).out, [0, -1]), 'a normal leaning along the span, not the face: the box middle');
  // the field and the banners stand out before the gate, the frame castleEntranceOf hands carrying the normal
  const castle = castleEntranceOf([{ door: span, box: uBox, normal: [0, 0, 1] }]);
  assert.deepEqual(castle.normal, [0, 0, 1]);
  const field = siegeFieldOf({ tier: 'crown', castle, centre: [0, 200] });
  assert.ok(near(field.throne, [0, SIEGE_FIELD.thronePaceM]) && near(field.camps.defend, [0, SIEGE_FIELD.defendCampM]) && near(field.banners[3], [0, SIEGE_FIELD.squareM]), `the Throne, the camp, the square out before the gate: ${field.throne}`);
  const pair = hallBannerAnchors(castle);
  for (const a of pair) assert.ok(a.out[2] > 0.99 && a.top[2] > 0, `a castle banner hangs out of the gate: ${a.out} ${a.top}`);
  for (const a of hallBannerAnchors({ door: span, box: uBox })) assert.ok(a.out[2] < -0.99, 'a palace\'s or a hall\'s frame (no normal): the box middle, as it was');
  const seat = seatBannerAnchors({ castle });
  assert.ok(seat.length === 2 && seat.every((a) => a.out[2] > 0.99), 'the seat\'s castle pair hangs out of the gate');
});

test('CASTLE-GATE AUDIT G1: doorNormalOf - the door record\'s model-space normal through the model matrix\'s rotation alone (never its translation), unit length; none without a normal or a matrix (mutants: translated; unnormalised)', () => {
  // a quarter turn about y (model +z to pixel +x), doubled in scale, stood 500 m off
  const M = [0, 0, -2, 0, 0, 2, 0, 0, 2, 0, 0, 0, 500, 10, -300, 1];
  assert.ok(nearN(doorNormalOf({ normal: { x: 0, y: 0, z: 1 } }, M), [1, 0, 0]), String(doorNormalOf({ normal: { x: 0, y: 0, z: 1 } }, M)));
  assert.ok(nearN(doorNormalOf({ normal: { x: 0.6, y: 0, z: 0.8 } }, M), [0.8, 0, -0.6]));
  assert.equal(doorNormalOf({}, M), null);
  assert.equal(doorNormalOf({ normal: { x: 0, y: 0, z: 1 } }, null), null);
  assert.equal(doorNormalOf({ normal: { x: 0, y: 0, z: 0 } }, M), null);
});

test('CASTLE-GATE AUDIT G2: the lowest entrance by its door\'s CENTRE, as DFU\'s landing measures it (enterExit.js doorWorldPosition) - a tall gate whose foot is lower loses to a postern whose middle is (mutant: the lower corner)', () => {
  const box = [-20, 0, -10, 20, 25, 30];
  const gate = { door: { a: [-3, 0, 0], b: [3, 6, 0] }, box, normal: [0, 0, 1] };        // foot 0, centre 3
  const postern = { door: { a: [15, 0.2, 5], b: [16, 2.2, 5] }, box, normal: [0, 0, 1] };  // foot 0.2, centre 1.2
  assert.deepEqual(castleEntranceOf([gate, postern]).door, postern.door);
  assert.deepEqual(castleEntranceOf([postern, gate]).door, postern.door);
});

test('CASTLE-GATE AUDIT G3: a door no face can be taken from (narrower than a man) is passed over for the town\'s next - the crown\'s field and banners still stand at its castle; none faceable, none (mutant: the unfaceable door taken)', () => {
  const box = [-20, 0, -10, 20, 25, 30];
  const narrow = { door: { a: [5, 0, 0], b: [5.2, 2, 0] }, box, normal: [0, 0, 1] };   // 0.2 m: the lowest, but no face
  const gate = { door: { a: [-3, 0.5, 0], b: [3, 6, 0] }, box, normal: [0, 0, 1] };
  const castle = castleEntranceOf([narrow, gate]);
  assert.deepEqual(castle.door, gate.door);
  const frames = new Map([['p', { door: { a: [100, 0, 100], b: [102, 2, 100] }, box: [95, 0, 90, 105, 10, 100] }]]);
  const field = siegeFieldOf({ frames, palaceKeys: ['p'], tier: 'crown', castle, centre: [0, 200] });
  assert.ok(near(field.throne, [0, SIEGE_FIELD.thronePaceM]), `the Throne at the castle, not the palace: ${field.throne}`);
  assert.equal(seatBannerAnchors({ castle }).length, 2);
  assert.equal(castleEntranceOf([narrow]), null);
});
