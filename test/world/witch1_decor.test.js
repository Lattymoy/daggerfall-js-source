// WITCH1 (2026-10-20, the owner: "We should decorate each town with its own lore appropriate decorations"; bible/06-Systems/
// Witches-Festival.md): THE TOWNS DRESSED (src/world/witchesDecor.js) - each people's kit, the pieces at a tavern's door
// and a temple's, the Wyrd Sister beside the tavern, a house's step, every home's offering spot kept clear - and the build
// that logs them with the block's own flats (src/scenes/pixelBuild.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  WITCH_KITS, WITCH_SPOTS, WYRD_SISTER_FLAT, witchCulture, witchesDressing, witchesDressingBreathing, dryGround, doorFront, offeringSpot, witchStepSide, colliderBlocked,
} from '../../src/world/witchesDecor.js';
import { FESTIVAL_ARCHIVE, FESTIVAL_ART } from '../../src/world/festivalArt.js';
import { footShare } from '../../src/world/propBodies.js';
import { CLIMATES } from '../../src/formats/mapsTables.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';

const IN = Date.UTC(2026, 9, 25), OUT = Date.UTC(2026, 10, 9);
/** A building facing +z, its door's middle at (x, z) - the door 1.2 m wide and 2.4 high, its box behind it. */
const frame = (x, z, type) => ({ at: [x, 0, z - 5], box: [x - 5, 0, z - 10, x + 5, 6, z], rects: [], type, faction: 0, door: { a: [x - 0.6, 0, z], b: [x + 0.6, 2.4, z] } });
const TAVERN = 101, TEMPLE = 102;
const town = (extra = {}) => new Map([[TAVERN, frame(0, 0, BUILDING_TYPES.Tavern)], [TEMPLE, frame(40, 0, BUILDING_TYPES.Temple)], ...Object.entries(extra).map(([k, v]) => [Number(k), v])]);
const pic = (f) => `${f.archive}.${f.record}`;
/** Whether a ray asked is a spot looked down on (straight down) - else it runs across from the door. */
const down = (a, b) => a[0] === b[0] && a[2] === b[2];

test('WITCH1 THE KITS: each people\'s pieces, by the town\'s climate and its region\'s people', () => {
  assert.equal(witchCulture(CLIMATES.HauntedWoodlands, 0), 'haunted');
  assert.equal(witchCulture(CLIMATES.Mountain, 0), 'highland');
  assert.equal(witchCulture(CLIMATES.MountainWoods, 1), 'highland');
  assert.equal(witchCulture(CLIMATES.Swamp, 0), 'fen');
  assert.equal(witchCulture(CLIMATES.Rainforest, 17), 'fen', 'a Breton region\'s rainforest');
  assert.equal(witchCulture(CLIMATES.Subtropical, 1), 'redguard', 'Hammerfell\'s jungle coast is Hammerfell\'s - Sentinel\'s own (AUDIT WITCH1 F-M3)');
  assert.equal(witchCulture(CLIMATES.Rainforest, 0), 'redguard');
  assert.equal(witchCulture(CLIMATES.Desert, 0), 'redguard');
  assert.equal(witchCulture(CLIMATES.Desert2, 0), 'redguard');
  assert.equal(witchCulture(CLIMATES.Woodlands, 17), 'breton', 'a Breton region\'s woods (Daggerfall\'s own)');
  assert.equal(witchCulture(CLIMATES.Woodlands, 0), 'redguard', 'a Redguard region\'s (the Alik\'r)');
  assert.equal(witchCulture(null, null), 'breton');
  const T = `${FESTIVAL_ARCHIVE}.${FESTIVAL_ART.turnip}`, E = `${FESTIVAL_ARCHIVE}.${FESTIVAL_ART.effigy}`, W = `${FESTIVAL_ARCHIVE}.${FESTIVAL_ART.wardStaff}`;
  const kit = (k) => ({ door: pic(k.door), temple: pic(k.temple), show: k.show.map(pic), step: k.step.map(([p, n]) => `${pic(p)}@${n}`) });
  assert.deepEqual(kit(WITCH_KITS.breton), { door: T, temple: '210.21', show: [E, T, T], step: [`${T}@0.32`, '210.2@0.08'] });
  assert.deepEqual(kit(WITCH_KITS.redguard), { door: '210.21', temple: '210.20', show: ['210.0', '210.2', '210.2'], step: ['210.21@0.3'] });
  assert.deepEqual(kit(WITCH_KITS.highland), { door: '210.20', temple: '210.20', show: ['210.1', E, '100.9'], step: ['100.24@0.28', `${T}@0.1`] });
  assert.deepEqual(kit(WITCH_KITS.fen), { door: W, temple: '210.21', show: ['210.0', W, W], step: [`${W}@0.3`, '210.2@0.08'] });
  assert.deepEqual(kit(WITCH_KITS.haunted), { door: '210.2', temple: '210.21', show: [E, '100.17', '100.24'], step: [`${T}@0.3`, '100.23@0.15', '100.18@0.08'] });
  assert.deepEqual(WYRD_SISTER_FLAT, { archive: 179, record: 2 });
});

test('WITCH1 A DOOR\'S FRONT: its middle, its face out of the building, the wall\'s way, its half width', () => {
  const f = doorFront(frame(0, 0, BUILDING_TYPES.Tavern));
  assert.deepEqual(f.c, [0, 0]);
  assert.deepEqual(f.out, [0, 1]);
  assert.equal(f.half, 0.6);
  assert.equal(f.foot, 0);
  assert.deepEqual(f.spot(0, 2), [0, 2]);
  assert.equal(Math.abs(f.spot(1, 0)[0]), 1, 'along the wall');
  assert.equal(doorFront({ box: [0, 0, 0, 1, 1, 1] }), null, 'no door, no front');
});

test('WITCH1 A DOOR ON ITS BOX\'S MIDDLE LINE faces where its own normal says - never where its vertices happen to run; the build keeps the normal beside the door (AUDIT WITCH1 D1: one door in seven faced into its building)', () => {
  // a building whose door stands at its box's middle (Daggerfall's House2, model 214): the box's middle says nothing
  const mid = { at: [0, 0, 0], box: [-5, 0, -7, 5, 6, 7], rects: [], type: 17, faction: 0, door: { a: [0.6, 0, 0], b: [-0.6, 2.4, 0] } };
  assert.deepEqual(doorFront({ ...mid, normal: [0, 0, 1] }).out, [0, 1]);
  assert.deepEqual(doorFront({ ...mid, normal: [0, 0, -1] }).out, [0, -1]);
  const pb = readFileSync(new URL('../../src/scenes/pixelBuild.js', import.meta.url), 'utf8');
  assert.match(pb, /if \(hf && !hf\.door\) \{ hf\.door = doorCornersOf\(cpu\.doors\[0\], local\); hf\.normal = doorNormalOf\(cpu\.doors\[0\], local\); \}/, 'the first door\'s corners and its normal, together');
});

test('WITCH1 THE TOWN DRESSED: closed outside the festival\'s days; open, a pair at each door, the Sister on one side of the tavern and the show on the other', () => {
  assert.equal(witchesDressing({ frames: town(), taverns: [TAVERN], nowMs: OUT }), null);
  assert.equal(witchesDressing({ frames: new Map(), taverns: [TAVERN], nowMs: IN }), null);
  const d = witchesDressing({ frames: town(), taverns: [TAVERN], temples: [TEMPLE], mapId: 7, floorY: 3, nowMs: IN });
  assert.equal(d.sisters.length, 1);
  const [s] = d.sisters;
  assert.deepEqual([s.archive, s.record, s.factionID, s.witch.key, s.y], [179, 2, 0, TAVERN, 3]);
  assert.equal(Math.abs(s.x), 0.6 + WITCH_SPOTS.sisterAlong);
  assert.equal(s.z, WITCH_SPOTS.sisterOut);
  const near = d.flats.filter((f) => Math.abs(f.c[0]) < 20);
  const turnip = `${FESTIVAL_ARCHIVE}.${FESTIVAL_ART.turnip}`;
  assert.equal(near.filter((f) => pic(f) === turnip && f.c[2] === WITCH_SPOTS.pairOut).length, 2, 'a turnip each side of the door');
  const show = near.filter((f) => f.c[2] !== WITCH_SPOTS.pairOut);
  assert.deepEqual(show.map(pic).sort(), [`${FESTIVAL_ARCHIVE}.${FESTIVAL_ART.effigy}`, turnip, turnip].sort());
  assert.ok(show.every((f) => Math.sign(f.c[0]) === -Math.sign(s.x)), 'the show stands on the side the Sister does not');
  assert.ok(d.flats.every((f) => f.c[1] === 3), 'on the street');
  const temple = d.flats.filter((f) => f.c[0] > 20);
  assert.deepEqual(temple.map(pic), ['210.21', '210.21']);
  // the same town dressed the same way on every machine
  assert.deepEqual(witchesDressing({ frames: town(), taverns: [TAVERN], temples: [TEMPLE], mapId: 7, floorY: 3, nowMs: IN }), d);
});

test('WITCH1 A SPOT IS TAKEN ONLY WHERE IT IS CLEAR: a wall between it and the door, or a flat a pace from it, and it is not', () => {
  const walled = witchesDressing({ frames: town(), taverns: [TAVERN], temples: [TEMPLE], nowMs: IN, blocked: () => true });
  assert.deepEqual([walled.flats.length, walled.sisters.length], [0, 0]);
  const open = witchesDressing({ frames: town(), taverns: [TAVERN], mapId: 7, nowMs: IN });
  const side = Math.sign(open.sisters[0].x);
  // a flat where she would stand: she stands on the other side, the show where she stood
  const moved = witchesDressing({ frames: town(), taverns: [TAVERN], mapId: 7, nowMs: IN, taken: [[open.sisters[0].x, 0, open.sisters[0].z]] });
  assert.equal(Math.sign(moved.sisters[0].x), -side);
  // the rays asked run from before the door at its foot to the spot's far edge, at a body's heights - and each spot is
  // looked down on, from downFrom to the lip over the street
  const asked = [];
  witchesDressing({ frames: town(), taverns: [TAVERN], nowMs: IN, floorY: 1, blocked: (a, b) => { asked.push([a, b]); return false; } });
  const across = asked.filter(([a, b]) => !down(a, b)), looks = asked.filter(([a, b]) => down(a, b));
  assert.ok(across.length > 0 && looks.length === across.length, 'two rays across a spot, two looks down on it');
  assert.ok(across.every(([a]) => a[2] === WITCH_SPOTS.rayFrom && a[0] === 0), 'from the door\'s front');
  assert.deepEqual([...new Set(across.map(([a]) => Math.round((a[1] - 1) * 1000) / 1000))].sort(), [...WITCH_SPOTS.rayHeights].sort());
  assert.ok(looks.every(([a, b]) => a[1] === 1 + WITCH_SPOTS.downFrom && b[1] === 1 + WITCH_SPOTS.lip), 'down to the lip over the street');
});

test('WITCH1 A SPOT ON A PLINTH OR A STEP IS NOT TAKEN: what stands under it above the street, lower than the rays across, refuses it - looked down on at its middle and at its edge nearest the door (AUDIT WITCH1 G1: a turnip lantern half sunk in a Daggerfall house\'s base)', () => {
  // a house's plinth along its wall, 0.3 m high and 0.7 m deep: under every ray across, over a near spot's foot
  const PLINTH = { z: 0.7, top: 0.3 };
  const under = (a, b, z) => down(a, b) && z < PLINTH.z && b[1] < PLINTH.top && a[1] > PLINTH.top;
  const plinth = (a, b) => under(a, b, a[2]);
  const houses = {};
  for (let k = 1; k <= 40; k++) houses[1000 + k] = frame(100 + k * 20, 0, BUILDING_TYPES.House1);
  const open = witchesDressing({ frames: town(houses), taverns: [TAVERN], mapId: 9, nowMs: IN });
  const on = witchesDressing({ frames: town(houses), taverns: [TAVERN], mapId: 9, nowMs: IN, blocked: plinth });
  const steps = (d) => d.flats.filter((f) => f.c[0] > 100);
  assert.ok(steps(open).length > 5, 'the street stands step pieces');
  assert.deepEqual(steps(on), [], 'none on the plinth - a step\'s piece stands 0.45 m out, on it');
  for (const [k, c] of on.homes) assert.deepEqual([c[0], c[2]], offeringSpot(houses[k], 9, k, true), 'the offering out before the door, off it');
  assert.ok(on.flats.filter((f) => f.c[0] < 30).every((f) => f.c[2] >= PLINTH.z), 'the tavern\'s pieces stand off it');
  // a foot whose middle is off a narrower plinth (0.45 m deep - the near spot's middle 0.55 m out) but whose edge nearest
  // the door is on it is refused too
  const edge = (a, b) => down(a, b) && a[2] < 0.45 && b[1] < PLINTH.top && a[1] > PLINTH.top;
  const near = offeringSpot(frame(0, 0, BUILDING_TYPES.House2), 9, 5);
  assert.ok(near[1] > 0.45, 'its middle is off it');
  const half = witchesDressing({ frames: new Map([[5, frame(0, 0, BUILDING_TYPES.House2)]]), mapId: 9, nowMs: IN, blocked: edge });
  assert.deepEqual([half.homes.get(5)[0], half.homes.get(5)[2]], offeringSpot(frame(0, 0, BUILDING_TYPES.House2), 9, 5, true), 'its edge is on it: the spot moves out');
  // the street itself, at its own height, refuses nothing: a look stops at the lip
  const street = witchesDressing({ frames: town(houses), taverns: [TAVERN], mapId: 9, floorY: 2, nowMs: IN, blocked: (a, b) => down(a, b) && b[1] < 2 });
  assert.deepEqual(street, witchesDressing({ frames: town(houses), taverns: [TAVERN], mapId: 9, floorY: 2, nowMs: IN }));
});

test('WITCH1 A HOME\'S OFFERING SPOT kept clear before a step is stood; the step\'s piece on the other side, chosen by its town and its key', () => {
  const houses = {};
  for (let k = 1; k <= 40; k++) houses[1000 + k] = frame(100 + k * 20, 0, BUILDING_TYPES.House1);
  const d = witchesDressing({ frames: town(houses), taverns: [TAVERN], mapId: 9, floorY: 0, nowMs: IN });
  assert.equal(d.homes.size, 40, 'every house a spot');
  assert.equal(d.homes.has(TAVERN), false, 'a tavern is no home');
  for (const [k, c] of d.homes) {
    const f = houses[k];
    assert.deepEqual([c[0], c[2]], offeringSpot(f, 9, k));
    // facing +z the wall runs along -x, so the far side of the step's (-stepSide along it) lies at +stepSide in x
    assert.equal(Math.sign(c[0] - (f.door.a[0] + 0.6)), witchStepSide(9, k));
  }
  const steps = d.flats.filter((f) => f.c[0] > 100);
  assert.ok(steps.length > 5 && steps.length < 25, `some houses stand a step piece (${steps.length} of 40)`);
  for (const f of steps) {
    const k = [...d.homes.keys()].find((key) => Math.abs(houses[key].door.a[0] + 0.6 - f.c[0]) < 2);
    const spot = d.homes.get(k);
    assert.notEqual(Math.sign(spot[0] - (houses[k].door.a[0] + 0.6)), Math.sign(f.c[0] - (houses[k].door.a[0] + 0.6)), 'the offering and the step on either side');
  }
  // a house whose near side is walled keeps its spot out before the door
  const far = witchesDressing({ frames: new Map([[5, frame(0, 0, BUILDING_TYPES.House2)]]), mapId: 9, nowMs: IN, blocked: (a, b) => !down(a, b) && b[2] < WITCH_SPOTS.offeringFarOut - 0.2 });
  assert.deepEqual([far.homes.get(5)[0], far.homes.get(5)[2]], offeringSpot(frame(0, 0, BUILDING_TYPES.House2), 9, 5, true));
});

test('WITCH1 the build\'s ray: one translation array of its own, the pixel placed in the scene, a hit short of the spot is a wall', () => {
  const calls = [];
  const state = { pixelTranslation: (x, y, out) => { calls.push(out); out[0] = 100; out[1] = 0; out[2] = 200; return out; } };
  const collider = { raycast: (o, d, l) => { calls.push(['ray', o, d, l]); return o[0] === 100 ? l / 2 : Infinity; } };
  const blocked = colliderBlocked(collider, state, 3, 4);
  assert.equal(blocked([0, 1, 0], [0, 1, 2]), true);
  assert.equal(blocked([0, 1, 0], [0, 1, 0]), false, 'no length, no wall');
  assert.equal(calls[0], calls[2], 'the one array, read again');
  assert.deepEqual(calls[1].slice(1), [[100, 1, 200], [0, 0, 1], 2]);
});

test('WITCH1 THE BUILD LOGS THEM WITH THE BLOCK\'S OWN: after the collider holds the pixel\'s walls, before the flats are grouped; a Wyrd Sister marked; the homes\' spots on the entry', () => {
  const src = readFileSync(new URL('../../src/scenes/pixelBuild.js', import.meta.url), 'utf8');
  const settle = src.indexOf('    collider.settle(key);'), dress = src.indexOf('const witchDress = '), group = src.indexOf('const { groups, wild: wildFlats, places } = groupFlats(flatLog');
  assert.ok(settle > 0 && dress > settle && group > dress, 'settled, dressed, grouped');
  assert.match(src, /for \(const f of witchDress\?\.flats \?\? \[\]\) \{\n\s+addFlat\(f\.archive, f\.record, \.\.\.f\.c\);/);
  assert.match(src, /if \(isHearthFlat\(LIGHTS_ARCHIVE, f\.record\)\) pixelHearths\.push/);
  assert.match(src, /pixelNpcFlats\.push\(\.\.\.\(witchDress\?\.sisters \?\? \[\]\)\);/);
  assert.match(src, /host: null, witch: flat\.witch \?\? null, \.\.\.\(flat\.witch \? \{ _mwLook: null \} : \{\}\) \}\);/, 'her own picture under the Morrowind people (AUDIT WITCH1 D6)');
  assert.match(src, /witchHomes: witchDress\?\.homes \?\? null, witchFloor,/);
  assert.match(src, /blocked: colliderBlocked\(collider, host\.state, px, py\), ground: dryGround\(locBlocks, locOrigin\),/);
  assert.match(src, /const witchDress = witchFloor != null && locBlocks \? await witchesDressingBreathing\(\{/, 'a city\'s rays breathe (PERF7, AUDIT WITCH1 D3)');
  assert.match(src, /\}, \(\) => breather\.breathe\(\)\) : null;/);
});

test('WITCH1 THE GROUND A PIECE STANDS ON: inside the location\'s blocks and off its water (the family DFU\'s people never walk) - a dock or a puddle stood on; the build asks it (AUDIT WITCH1 D7)', () => {
  const tiles = (rec) => Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => ({ textureRecord: rec })));
  const wet = tiles(2);
  wet[3][15].textureRecord = 0;   // the RMB's row 15 is the block's first 6.4 m of z
  const blocks = [{ x: 0, y: 0, dfBlock: { rmbBlock: { fldHeader: { groundData: { groundTiles: wet } } } } }];
  const g = dryGround(blocks, [100, 0, 200]);
  assert.equal(g(100 + 1, 200 + 1), true);
  assert.equal(g(100 + 3 * 6.4 + 1, 200 + 1), false, 'open water');
  assert.equal(g(100 + 3 * 6.4 + 1, 200 + 7), true, 'the next tile north');
  assert.equal(g(50, 200), false, 'outside the blocks');
  wet[5][15].textureRecord = 5;   // a shore - the water family's, as DFU's people never walk it
  assert.equal(g(100 + 5 * 6.4 + 1, 200 + 1), false, 'a shore');
  wet[6][15].textureRecord = 8;   // a dock's (SHALLOW_WHOLE) - walked on, stood on
  assert.equal(g(100 + 6 * 6.4 + 1, 200 + 1), true, 'a dock');
  const d = witchesDressing({ frames: town(), taverns: [TAVERN], nowMs: IN, ground: () => false });
  assert.deepEqual([d.flats.length, d.sisters.length, d.homes.size], [0, 0, 0], 'nothing stood where there is no ground');
});

test('WITCH1 A PAINTED STAND-IN\'S FOOT IS ITS OWN PICTURE\'S: no index to read, its alpha read instead - a 2 px ward-staff stands a post\'s body, not its whole picture\'s cover (propBodies.js footShare, AUDIT WITCH1 D7)', () => {
  const w = 20, h = 60, rgba = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (const x of [9, 10]) rgba[(y * w + x) * 4 + 3] = 255;
  const t = { getDFBitmap: () => ({ width: w, height: h, data: null, rgba }) };
  assert.equal(footShare(t, 3, { w: 0.6, h: 1.8 }), 2 / w);
  assert.equal(footShare({ getDFBitmap: () => ({ width: w, height: h, data: null, rgba: null }) }, 3, { w: 0.6, h: 1.8 }) > 2 / w, true, 'no picture at all: cover\'s share, as before');
});

test('WITCH1 THE DRESSING BREATHES: the same town as the whole run, a breath between its buildings (PERF7 - AUDIT WITCH1 D3)', async () => {
  const houses = Object.fromEntries([1, 2, 3].map((i) => [500 + i, frame(-40 * i, 0, BUILDING_TYPES.House1)]));
  const at = { frames: town(houses), taverns: [TAVERN], temples: [TEMPLE], mapId: 9, floorY: 0, nowMs: IN };
  let breaths = 0;
  const breathed = await witchesDressingBreathing(at, async () => { breaths++; });
  assert.deepEqual(breathed, witchesDressing(at));
  assert.ok(breaths >= 2 + 3, `a breath a building at least (${breaths})`);
  assert.equal(await witchesDressingBreathing({ ...at, nowMs: OUT }, async () => { breaths++; }), null);
});
