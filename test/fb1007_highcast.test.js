// FIELD BUGS 2026-10-07 HIGH-CAST (the Discord: "fishing popup shows up wayy too early" - the high ground under
// Daggerfall, "miles above the water", reading "Open Water / Fishing 4 / Cast the net"; and, under it, "I couldn't get it
// off my screen when on my ship. very annoying").
//
// SHORE-CAST (test/fb1005_shorecast.test.js) asks whether the cast's point is over water the feet would swim in - the
// tile's coverage, read in the ground's PLANE. The net's law (foragingLaw.js netHasWater) holds over a whole pixel of the
// Ocean's region, so from a cliff's edge the point 3 m along the look is over the sea at any height, and on a deck at sea
// it is over the sea wherever the look falls - the deck, the mast, the crew. The cast's point must now stand at the
// water's level: no more than CAST_OVER_WATER_M over the surface under it (`host.waterY`).
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { fishKind, castAt, castOverWater, CAST_OVER_WATER_M, CAST_RISE_M } from '../src/scenes/fishHost.js';
import { setForagingHost } from '../src/systems/foragingInstall.js';
import { EYE_HEIGHT, SWIM_EYE_HEIGHT } from '../src/player/motor.js';
import { SCALED_OCEAN_ELEVATION, STREAMING_TERRAIN_SCALE } from '../src/world/terrainSampler.js';
import { DW_OCEAN_LOCAL_Y } from '../src/world/deepWatersPixel.js';
import { WATER_LEVEL } from '../src/systems/comeSailAway.js';
import { MEASURED as CARRACK } from '../src/world/carrackModel.js';
import { MEASURED as GALLEON } from '../src/world/galleonModel.js';
import { MEASURED as LARGE_BOAT } from '../src/world/largeBoatModel.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const NET = { items: [{ templateIndex: 1603, currentCondition: 50 }] };
/** The sea's top in a pixel's frame - the ground's clamp at OceanElevation, Deep Waters' sea and Come Sail Away's
 *  WaterLevel are one height (34 m), where every boat's root rides. */
const SEA = SCALED_OCEAN_ELEVATION * STREAMING_TERRAIN_SCALE;
const look = (pitchDeg) => { const p = (pitchDeg * Math.PI) / 180; return [0, Math.sin(p), Math.cos(p)]; };

/** Fishing's kind at sea: the Ocean's region (the net's law holds), the point along the look over the sea (SHORE-CAST
 *  says wet) - the angler's eye `eyeOver` metres over the sea's top, looking `pitch` degrees. */
function atSea(eyeOver, pitch, { waterY = () => SEA, waterAt = () => true } = {}) {
  const w = { inside: false, insideDungeon: false, insideCastle: false, locationType: 0xffff, inLocationRect: false, hour: 12, climate: 231, region: 31, enemiesNear: false, carriedWeight: 0, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' };
  const prev = setForagingHost({ world: () => w, entity: () => null });
  const book = { state: { open: true, hauls: 0, caps: { stores: 5000 } }, taken: () => false, counting: () => false, held: () => 0 };
  const eye = { pos: [0, SEA + eyeOver, 0], dir: look(pitch) };
  const host = { pixel: () => ({ x: 208, y: 230 }), ground: () => ({ climate: 231, region: 31 }), eye: () => eye, feet: () => [0, SEA + eyeOver - EYE_HEIGHT, 0], hour: () => 12, storm: () => false, climateAt: () => 231, trophy: () => true, day: () => 20733, rand: () => 0.5, busy: () => false, waterAt, waterY };
  return { k: fishKind({ book, host }), eye, done: () => setForagingHost(prev) };
}
const casts = (eyeOver, pitch, o) => { const s = atSea(eyeOver, pitch, o); try { return s.k.looseNodesOf({ entity: NET, dungeon: false }).length; } finally { s.done(); } };

test('HIGH-CAST: the report - a cliff over the sea, the net\'s law holding and the point along the look over the water: no Open Water at any look; at the water\'s edge a level look still casts', () => {
  for (const pitch of [-89, -60, -30, 0, 30]) assert.equal(casts(30 + EYE_HEIGHT, pitch), 0, `30 m up the cliff, looking ${pitch} degrees`);
  for (const pitch of [-89, -45, 0]) assert.equal(casts(10 + EYE_HEIGHT, pitch), 0, `a 10 m bank, looking ${pitch} degrees`);
  for (const pitch of [-30, 0, 15]) assert.equal(casts(EYE_HEIGHT, pitch), 1, `stood at the water's edge, looking ${pitch} degrees`);
  for (const pitch of [-45, 0, 45]) assert.equal(casts(SWIM_EYE_HEIGHT - 0.5, pitch), 1, `swimming, looking ${pitch} degrees`);
});

test('HIGH-CAST: on a ship\'s deck the cast is the water under the look - a look down over the side casts from every deck the port sails, a level look from a high deck does not (the deck, the mast, the crew were "Open Water")', () => {
  assert.equal(WATER_LEVEL, 34, 'Come Sail Away floats every boat at its WaterLevel');
  assert.ok(Math.abs(SEA - WATER_LEVEL) < 1e-5 && Math.abs(DW_OCEAN_LOCAL_Y - WATER_LEVEL) < 1e-5, 'the ground\'s sea, Deep Waters\' and the boats\' are one height');
  const decks = { carrack: CARRACK.mainDeckY, galleon: GALLEON.mainDeckY, 'large boat': LARGE_BOAT.deckY };
  for (const [ship, deck] of Object.entries(decks)) {
    assert.equal(casts(deck + EYE_HEIGHT, -90), 1, `the ${ship}'s deck, looking straight down over the side`);
  }
  for (const ship of ['carrack', 'galleon']) {
    for (const pitch of [0, 20, -20]) assert.equal(casts(decks[ship] + EYE_HEIGHT, pitch), 0, `the ${ship}'s deck, looking ${pitch} degrees`);
  }
  // the large boat's deck is a pier's height: a level look out over the water casts from it, as from the shore
  assert.equal(casts(LARGE_BOAT.deckY + EYE_HEIGHT, 0), 1);
  // the bound, from the highest deck: the lowest cast her eye can stand, and half a metre of swell over it
  const lowest = castAt({ pos: [0, SEA + CARRACK.mainDeckY + EYE_HEIGHT, 0], dir: look(-90) })[1] - SEA;
  assert.ok(Math.abs(lowest - (CARRACK.mainDeckY + EYE_HEIGHT - CAST_RISE_M)) < 1e-9);
  assert.ok(lowest < CAST_OVER_WATER_M && CAST_OVER_WATER_M - lowest <= 0.5, `the carrack's lowest cast ${lowest} m over the sea, against ${CAST_OVER_WATER_M}`);
});

test('HIGH-CAST: the law at its edge, and unknown is not refused - a surface off the built ground (null) or not finite stands the cast', () => {
  assert.equal(castOverWater([0, SEA + CAST_OVER_WATER_M, 0], SEA), false, 'at the bound: cast');
  assert.equal(castOverWater([0, SEA + CAST_OVER_WATER_M + 0.01, 0], SEA), true, 'a centimetre over it: not');
  assert.equal(castOverWater([0, SEA - 20, 0], SEA), false, 'under the surface (a diver): cast');
  assert.equal(castOverWater([0, 1e3, 0], null), false);
  assert.equal(castOverWater([0, 1e3, 0], -Infinity), false);
  assert.equal(casts(30, 0, { waterY: () => null }), 1, 'a deck over a pixel still streaming fishes (SHORE-CAST\'s unknown)');
  // the surface is asked at the cast's own point, not the angler's: the ground under the cliff's foot is the sea's, the
  // cliff's top is not
  const asked = [];
  casts(30, 0, { waterY: (p) => { asked.push([...p]); return SEA; } });
  assert.deepEqual(asked[0], castAt({ pos: [0, SEA + 30, 0], dir: look(0) }));
});

test('HIGH-CAST: a cast already thrown is not lost when the look rises off the water - but a net still wound is not yet cast', () => {
  let surface = SEA;
  const s = atSea(EYE_HEIGHT, 0, { waterY: () => surface });
  try {
    const [n] = s.k.looseNodesOf({ entity: NET, dungeon: false });
    const plan = s.k.plan(n, { rank: () => 4, entity: NET });
    const started = s.k.start(n, plan, { entity: NET, rank: () => 4, specs: () => ({}), keyLabel: () => 'E' });
    assert.ok(started.act, 'the cast is made');
    surface = SEA - 20;   // the cast's point 20 m over the water now (the look raised high)
    assert.deepEqual(s.k.looseNodesOf({ entity: NET, dungeon: false }), [], 'wound: no target - it would be thrown up there');
    surface = SEA;
    started.act.tick(0.1, { held: false });   // E let go: thrown
    assert.equal(started.act.state.phase, 'fly');
    surface = SEA - 20;
    assert.equal(s.k.looseNodesOf({ entity: NET, dungeon: false }).length, 1, 'the thrown cast keeps its node');
    started.act.cancel();
    assert.deepEqual(s.k.looseNodesOf({ entity: NET, dungeon: false }), [], 'once it is done the high look stands no new one');
  } finally { s.done(); }
});

test('HIGH-CAST: the world host answers the surface under the cast - the ground the water lies on, or the sea\'s top over a carved seabed (by source: the host is not importable)', () => {
  const world = src('src/scenes/world.js');
  assert.match(world, /waterY: \(pos\) => \{ const g = heightAt\(pos\[0\], pos\[2\]\); return Number\.isFinite\(g\) \? Math\.max\(g, \(deepWaters\?\.oceanLocalY \?\? SCALED_OCEAN_ELEVATION \* STREAMING_TERRAIN_SCALE\) \+ state\.pixelTranslation\(state\.current\.x, state\.current\.y, _fishSeaT\)\[1\]\) : null; \},/);
  assert.match(src('src/scenes/fishHost.js'), /if \(!acting && host\.waterY && castOverWater\(castAt\(host\.eye\(\)\), host\.waterY\(castAt\(host\.eye\(\)\)\)\)\) return \[\];/);
});
