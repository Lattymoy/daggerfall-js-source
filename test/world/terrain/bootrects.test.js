// BOOT-RECTS (2026-10-20, the owner: "do your own performance pass ... go deep"; bible/07-Rendering/Performance-Priority.md
// BOOT-RECTS) - SetLocationTiles' rect for many locations in one walk (world/terrain/terrainTiles.js locationRectReader).
// The boot's two walks - the Eltheric isles' 7,538 templates and the Bay's coastal towns for Deep Waters - parsed a block
// again every time its name came round, because BlocksFile keeps one parsed block (autoDiscard). The walk keeps each
// block's ground tiles for itself. Held here: the reader's rect is SetLocationTiles' own for every location of a mixed
// walk, each block read once; a location a layout pin stands at, one the door cannot place and a door that cannot say all
// read through, so a pin's own answer is the one its rect is made of; `as` reads every template as its clone; the door's
// own `locationPinned`; and both walks wired to it. Measured over the real data (the record): every rect the same, with
// the town packs on the door and off, and with 3,367 towns pinned.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setLocationTiles, locationRectReader } from '../../../src/world/terrain/terrainTiles.js';
import { MapsFile } from '../../../src/formats/mapsFile.js';
import { setWorldDataDoor, worldDataDoor } from '../../../src/formats/worldData/worldDataDoor.js';
import { installWorldDataReplacement, setLayoutPinOracle, _resetWorldDataReplacement } from '../../../src/formats/worldData/worldDataReplacement.js';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const NAMES = ['RESIAM10.RMB', 'TVRNAS08.RMB', 'MAGEAA12.RMB', 'GENRAS00.RMB', 'TEMPAA00.RMB', 'CUSTAA05.RMB'];

/** A door that notes the town whose blocks are read (MapsFile.getRmbBlockName's ask) and says which towns a pin stands
 *  at; `pinnedNow` - whether the town being read is one (a pin's town reads its blocks apart: pinnedHere). */
function doorOf(pinned = [], { canSay = true } = {}) {
  const door = { noted: [], at: null, noteReadingLocation(r, l) { this.noted.push([r, l]); this.at = l * 100 + r; }, pinnedNow() { return pinned.includes(this.at); } };
  if (canSay) door.locationPinned = (r, l) => pinned.includes(l * 100 + r);
  return door;
}
/** A BLOCKS.BSA that parses afresh at every ask, as BlocksFile's one slot does across a walk - each block's paved patch
 *  (ground records under 56) its own, and another where the town being read is a pinned one; every read counted. */
function blocksOf(door = null) {
  const index = new Map(NAMES.map((n, i) => [n, i]));
  const reads = [];
  return {
    reads,
    checkName: (n) => (index.has(n) ? n : ''),
    getBlockIndex: (n) => index.get(n) ?? -1,
    getBlock: (i) => {
      reads.push(i);
      const s = door?.pinnedNow() ? 5 : 0;
      const groundTiles = Array.from({ length: 16 }, (_, x) => Array.from({ length: 16 }, (_, y) => ({ tileBitfield: (x * 7 + y + i) & 63, textureRecord: x >= (i + s) % 9 && y >= (i * 3 + s) % 7 ? 3 : 60 })));
      return { rmbBlock: { fldHeader: { groundData: { groundTiles } } } };
    },
  };
}
const town = (r, l, w, h, names, type = 2) => ({ regionIndex: r, locationIndex: l, exterior: { exteriorData: { width: w, height: h, blockNames: names } }, mapTableData: { locationType: type } });
/** A mixed walk: a city and its twin elsewhere, a village sharing a block with them, a 1 x 1 CUST place (its own corner),
 *  a grid naming a block BLOCKS.BSA does not hold. */
const WALK = [
  town(17, 40, 2, 2, [NAMES[0], NAMES[1], NAMES[2], NAMES[3]], 0),
  town(17, 41, 1, 2, [NAMES[1], NAMES[4]]),
  town(23, 7, 2, 2, [NAMES[0], NAMES[1], NAMES[2], NAMES[3]], 0),
  town(23, 8, 1, 1, [NAMES[5]]),
  town(5, 3, 2, 1, ['NOPEAA00.RMB', NAMES[4]]),
  town(5, 4, 1, 2, [NAMES[1], NAMES[4]]),
];
const direct = (maps, blocks, loc) => setLocationTiles(loc, maps, blocks, new Uint8Array(128 * 128));
const withDoor = (door, fn) => { const prev = worldDataDoor(); setWorldDataDoor(door); try { return fn(); } finally { setWorldDataDoor(prev); } };

test('BOOT-RECTS the reader answers SetLocationTiles\' own rect for every location of a mixed walk - a city and its twin, a village, a CUST corner, a block that does not resolve - each block read once; with no door the same (mutant: every block read again)', () => {
  const maps = new MapsFile();
  for (const door of [doorOf(), null]) withDoor(door, () => {
    const want = WALK.map((loc) => direct(maps, blocksOf(door), loc));
    if (door) door.noted.length = 0;
    const blocks = blocksOf(door);
    const rectOf = locationRectReader(maps, blocks);
    assert.deepEqual(WALK.map((loc) => rectOf(loc)), want, door ? 'with a door' : 'with none');
    assert.equal(blocks.reads.length, new Set(blocks.reads).size, 'each block read once in the walk');
    assert.deepEqual([...new Set(blocks.reads)].sort(), [0, 1, 2, 3, 4, 5], 'every block the walk names, read');
    if (door) assert.deepEqual(door.noted.map(([r, l]) => `${r}:${l}`), WALK.flatMap((l) => Array(l.exterior.exteriorData.width * l.exterior.exteriorData.height).fill(`${l.regionIndex}:${l.locationIndex}`)), 'each town noted for each of its cells, as SetLocationTiles notes it');
  });
});

test('BOOT-RECTS a town a layout pin stands at reads its blocks through, so its rect is the one its own blocks make; a door that cannot say, and a town it cannot place, read through too (mutants: the pin unasked; a door that cannot say taken as none; a place with no indices shared)', () => {
  const maps = new MapsFile();
  const pinnedKey = 41 * 100 + 17;
  const door = doorOf([pinnedKey]);
  withDoor(door, () => {
    const want = WALK.map((loc) => direct(maps, blocksOf(door), loc));
    const unpinned = withDoor(doorOf(), () => direct(maps, blocksOf(doorOf()), WALK[1]));
    assert.notDeepEqual(want[1], unpinned, 'the fixture: the pinned town\'s blocks answer apart');
    const blocks = blocksOf(door);
    const rectOf = locationRectReader(maps, blocks);
    assert.deepEqual(WALK.map((loc) => rectOf(loc)), want);
    assert.deepEqual(rectOf(WALK[1]), want[1], 'asked again after the others: its own still');
  });
  for (const [why, d, walk] of [['a door that cannot say', doorOf([], { canSay: false }), WALK], ['a town with no indices', doorOf(), WALK.map((l) => ({ ...l, locationIndex: undefined }))]]) withDoor(d, () => {
    const blocks = blocksOf(d);
    const rectOf = locationRectReader(maps, blocks);
    const got = walk.map((loc) => rectOf(loc));
    assert.deepEqual(got, walk.map((loc) => direct(maps, blocksOf(d), loc)), why);
    assert.equal(blocks.reads.length, walk.reduce((n, l) => n + l.exterior.exteriorData.blockNames.filter((b) => NAMES.includes(b)).length, 0), `${why}: every cell read through`);
  });
});

test('BOOT-RECTS `as` reads every location as its clone - the isles\' templates at their region and index, noted so, the rects SetLocationTiles makes of the clone (mutant: `as` dropped)', () => {
  const maps = new MapsFile();
  const door = doorOf();
  withDoor(door, () => {
    const as = { regionIndex: 61, locationIndex: -1000 };
    const want = WALK.map((loc) => direct(maps, blocksOf(door), { ...loc, ...as }));
    door.noted.length = 0;
    const rectOf = locationRectReader(maps, blocksOf(door), as);
    assert.deepEqual(WALK.map((loc) => rectOf(loc)), want);
    assert.ok(door.noted.length > 0 && door.noted.every(([r, l]) => r === 61 && l === -1000), 'every template read at the clone\'s place');
  });
});

test('BOOT-RECTS the door says a town is pinned where a pin turns a mod in or away there, and not where none stands or it is empty (mutant: any pin answered pinned)', () => {
  const prev = worldDataDoor();
  try {
    _resetWorldDataReplacement();
    installWorldDataReplacement();
    const pins = new Map([[40 * 100 + 17, { out: new Set(['beautiful-cities']), in: new Set() }], [41 * 100 + 17, { out: new Set(), in: new Set(['beautiful-villages']) }], [7 * 100 + 23, { out: new Set(), in: new Set() }]]);
    setLayoutPinOracle((k) => pins.get(k) ?? null);
    const d = worldDataDoor();
    assert.equal(d.locationPinned(17, 40), true, 'a mod turned away');
    assert.equal(d.locationPinned(17, 41), true, 'a mod turned in');
    assert.equal(d.locationPinned(23, 7), false, 'an empty pin');
    assert.equal(d.locationPinned(23, 8), false, 'none');
  } finally { setLayoutPinOracle(null); _resetWorldDataReplacement(); setWorldDataDoor(prev); }
});

test('BOOT-RECTS both of the boot\'s walks read through the reader - Deep Waters\' coastal towns and the isles\' templates as their clones (by source)', () => {
  const client = src('src/world/deepWater/deepWatersClient.js');
  assert.match(client, /const rectOf = locationRectReader\(maps, blocks\);/);
  assert.match(client, /const r = rectOf\(loc\);\n\s+rows\.push\(\[py \* 1000 \+ px, r\.xMin, r\.xMax, r\.yMin, r\.yMax\]\);/);
  assert.doesNotMatch(client, /setLocationTiles\(/, 'no walk of its own past the reader');
  assert.match(src('src/scenes/world.js'), /ether: etherSea \? etherPlaceRects\(_etherTemplates, locationRectReader\(maps, blocks, \{ regionIndex: ETHER_REGION, locationIndex: -1000 \}\)\) : null,/);
});
