// AUDIT TESA II Z4 and Z8 (2026-10-25, lane Z; bible/11-Multiplayer/Wild-Zone.md section 25): CYRODIIL'S ZONE, WHOLE AND
// ONE. Z4: what the zone encloses is the zone's (systems/wild/wildZone.js fillEnclosed) - the painting's Lake Rumare and
// the Niben were holes, so their shores were the zone's edge (the Imperial City stood in The Borderlands) and their water
// a way out of the travel law and the fights. Z8: online, the zone is the traced picture's alone (systems/wild/
// cyrodiilZone.js cyrodiilMask) - an untraced client cut the authored rings' zone, 56% of the two shapes' union apart.
import '../../modsOff.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildWildMask, fillEnclosed, wildInside, wildRingAt, wildRingName, wildJourney, ringOfCell, isWildRegion, wildMask, setWildMask } from '../../../src/systems/wild/wildZone.js';
import { wildRingAtPlace } from '../../../src/systems/wild/etherWild.js';
import { mapPixelToLongitudeLatitude } from '../../../src/formats/mapsFile.js';
import { CYRODIIL_REGION } from '../../../src/formats/mapsTables.js';
import { cyrodiilMask } from '../../../src/systems/wild/cyrodiilZone.js';
import { setTamrielTrace, fitBayToPicture } from '../../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit } from '../../../src/world/tamriel/tamrielFrame.js';
import { traceTamrielPicture, paletteReader } from '../../../src/ui/tamrielTrace.js';
import { CAPITALS, capitalPixel } from '../../../src/world/tamrielCapitals.js';
import { theatreAt } from '../../../src/world/worldWide/worldGrid.js';

const ARENA2 = process.env.ARENA2_PATH;
const HAVE_ARENA2 = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'MAP.PAL', 'WOODS.WLD', 'MAPS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));
const realSkip = HAVE_ARENA2 ? false : 'ARENA2_PATH not set (sh tools/fetch-data.sh)';
const online = (on) => { if (on) globalThis.location = /** @type {any} */ ({ search: '?online' }); else delete globalThis.location; };
afterEach(() => { online(false); setTamrielTrace(null); setTamrielFit(null); setWildMask(null); });

/** The player's own trace and fit, as scenes/world.js makes them (test/ui/tamriel4.test.js's reading). */
async function installPlayersPicture() {
  const { ImgFile } = await import('../../../src/formats/imgFile.js');
  const { DFPalette } = await import('../../../src/formats/dfPalette.js');
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const { MapsFile } = await import('../../../src/formats/mapsFile.js');
  const { isWaterPixel } = await import('../../../src/ui/overworldModel.js');
  const f = (n) => new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), n)));
  const pic = new ImgFile(); pic.load(f('TMAP00I0.IMG'), 'TMAP00I0.IMG');
  const pal = new DFPalette(); pal.load(f('MAP.PAL'), 'MAP.PAL');
  const pk = new ImgFile(); pk.load(f('TAMRIEL2.IMG'), 'TAMRIEL2.IMG');
  const trace = traceTamrielPicture(pk.getDFBitmap(), pic.getDFBitmap(), paletteReader(pal));
  const woods = new WoodsFile(); woods.load(f('WOODS.WLD'));
  const maps = new MapsFile(); maps.load(f('MAPS.BSA'), f('CLIMATE.PAK'), f('POLITIC.PAK'));
  const fit = /** @type {any} */ (fitBayToPicture({ bayLand: (x, y) => !isWaterPixel(maps.getClimateIndex(x, y), woods.getHeightMapValue(x, y)), trace }));
  setTamrielTrace(trace);
  setTamrielFit({ ox: fit.ox * fit.ppu, oy: fit.oy * fit.ppu, ppu: fit.ppu });
}

test('AUDIT TESA II Z4 WHAT A ZONE ENCLOSES IS THE ZONE\'S: a ring with a lake in it - the lake inside, its depth the ring\'s, the heart in the middle; a bay open to the edge stays out; a corner is no way out (the outside reaches through a side alone) (mutants: the fill unasked; the corners a way out; the fill\'s last step unwritten)', () => {
  // a 21 x 21 zone, a 9 x 9 lake in its middle and a bay cut in from the west edge
  const zone = (x, y) => x >= 1 && x <= 19 && y >= 1 && y <= 19 && !(x >= 6 && x <= 14 && y >= 6 && y <= 14) && !(y === 3 && x <= 8);
  const m = buildWildMask({ width: 21, height: 21, inZone: zone, nearPx: 1 });
  assert.equal(wildInside(m, 10, 10), true, 'the lake is the zone\'s');
  assert.equal(ringOfCell(m, 10, 10), 4, 'and its middle the heart: the depth runs from the outer side alone');
  assert.equal(m.depth[10 * 21 + 10] > m.depth[10 * 21 + 3], true);
  assert.equal(wildInside(m, 4, 3), false, 'a bay open to the edge is the outside');
  assert.equal(wildInside(m, 0, 0), false);
  // a ring whose one corner cell is missing: its inside meets the outside at a corner alone - still enclosed
  const ring = new Uint8Array(81);
  for (let y = 1; y <= 7; y++) for (let x = 1; x <= 7; x++) ring[y * 9 + x] = x === 1 || x === 7 || y === 1 || y === 7 ? 1 : 0;
  ring[7 * 9 + 7] = 0;
  fillEnclosed(ring, 9, 9);
  assert.equal(ring[6 * 9 + 6], 1, 'a corner is no way out');
  assert.equal(ring[7 * 9 + 7], 0, 'the missing corner itself is the outside\'s');
  assert.equal(ring[4 * 9 + 4], 1);
});

test('AUDIT TESA II Z4 ON THE PLAYER\'S OWN PICTURE: the Imperial City, on Lake Rumare\'s isle, stands in The Heart; the lake is the zone\'s, so a fast journey from it out of Cyrodiil, or into it from the Bay, crosses the line and is refused; no cell the zone encloses is left outside it', { skip: realSkip }, async () => {
  await installPlayersPicture();
  const m = cyrodiilMask();
  assert.ok(m, 'offline, the zone');
  const ic = /** @type {any} */ (capitalPixel(CAPITALS[0]));
  assert.deepEqual(ic, { px: 2069, py: 658 }, 'IC-RING\'s pixel on the freeware\'s fit');
  assert.equal(wildRingAt(ic.px, ic.py, m), 4, `the Imperial City in ${wildRingName(wildRingAt(ic.px, ic.py, m))}`);
  const lake = { x: 2062, y: 618 }, daggerfall = { x: 207, y: 213 };
  assert.equal(theatreAt(lake.x, lake.y), -1, 'Lake Rumare: water, no province\'s land');
  assert.equal(wildInside(m, lake.x, lake.y), true, 'but the zone\'s');
  assert.equal(wildJourney({ from: lake, to: daggerfall, mask: m, gold: 1e9 }).ok, false, 'no fast travel out of Cyrodiil from its lake');
  assert.equal(wildJourney({ from: daggerfall, to: lake, mask: m, gold: 1e9 }).ok, false, 'nor in, to an anchor set on it');
  const copy = m.inside.slice();
  fillEnclosed(copy, m.width, m.height);
  assert.deepEqual(copy, m.inside, 'nothing enclosed left out');
});

test('AUDIT TESA II Z8 ONLINE, NO TRACE NO ZONE: on an online page the zone is the traced picture\'s alone - none before the trace lands and none where it never does (the referee then keeps that client out of every fight); offline the authored rings stand in as before (mutants: the online gate unread; the trace unasked)', { skip: realSkip }, async () => {
  assert.ok(cyrodiilMask(), 'offline, untraced: the authored shape (the maps\' paint, the pins)');
  online(true);
  assert.equal(cyrodiilMask(), null, 'online, untraced: no zone');
  await installPlayersPicture();
  const m = cyrodiilMask();
  assert.ok(m && wildInside(m, 2069, 658), 'online, the trace landed: the zone, the trace\'s');
  online(false);
  assert.equal(cyrodiilMask(), m, 'the same zone offline once the trace stands');
  online(true);
  setTamrielTrace(null);
  assert.equal(cyrodiilMask(), null, 'and none again when it goes');
});

test('AUDIT TESA II Z8 IN THE DUNGEON HOST: NO MASK IS NO ZONE - scenes/dungeonContext.js\'s two lines run as they stand: a Cyrodiil dungeon on an untraced online client is no zone\'s (the mountains\' fallback stood it the heart\'s - four times its foes, twice its loot, its door open); with the trace landed and no mask registered yet it reads the zone\'s own mask, by its own ring; a registered mask first; outside the mask and offline none (mutants: the fallback back; the zone\'s own mask unasked; the registered mask unasked)', { skip: realSkip }, async () => {
  const src = readFileSync(new URL('../../../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
  const at = src.indexOf('  const _wildRingRaw = '), end = src.indexOf('\n', src.indexOf('  const _wildDungeon = ', at)) + 1;
  assert.ok(at > 0 && end > at, 'the two lines are in the host');
  const body = src.slice(at, end);
  const run = (dfLocation, page) => new Function('S', `with (S) { ${body}\n return { ring: _wildRingRaw, wild: _wildDungeon }; }`)({ dfLocation, isOnlinePage: () => page, isWildRegion, wildMask, cyrodiilMask, wildRingAtPlace });
  const place = (px, py) => { const ll = mapPixelToLongitudeLatitude(px, py); return { regionIndex: CYRODIIL_REGION, mapTableData: { longitude: ll.x, latitude: ll.y } }; };
  const heart = place(2069, 658), border = place(1540, 2000);
  online(true);
  assert.deepEqual(run(heart, true), { ring: 0, wild: false }, 'untraced online: no zone, no zone\'s dungeon');
  await installPlayersPicture();
  assert.deepEqual(run(heart, true), { ring: 4, wild: true }, 'the trace landed, none registered yet: the zone\'s own mask, its own ring (The Heart)');
  const fake = buildWildMask({ width: 10, height: 10, ox: 2060, oy: 650, inZone: () => true });
  setWildMask(fake);
  assert.equal(run(heart, true).ring, wildRingAt(2069, 658, fake), 'a registered mask first');
  setWildMask(null);
  assert.deepEqual(run(border, true), { ring: 0, wild: false }, 'a dungeon of region 70 the mask does not hold: none');
  assert.deepEqual(run(heart, false), { ring: 0, wild: false }, 'offline: none');
});
