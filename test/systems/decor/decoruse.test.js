// DECOR-USE (2026-10-24, Discord - "Make bed decor and firepit decor actually funtional": "the beds dont actually let you
// sleep in it and firepit doesnt actually let you cook on it"; "Cooking station is not an option in decorate") - WHAT A
// PLACED PIECE IS FOR: a placed bed is slept in, a placed fire one stands over is one of the room's hearths (it warms, a
// rest by it is a camp's, it is cooked on), and the cooking station makes any piece that fire. The law is
// systems/decor/decorUse.js; the room's half scenes/decor/decorRoom.js `hearths`; the host's worldModes.js activateDecor
// and its interior camps' `hearths`. Recorded in bible/06-Systems/Online-Arc.md DECOR-USE.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decorBed, decorHearth, useDecorPiece, COOKING_STATION } from '../../../src/systems/decor/decorUse.js';
import { DECOR_STATIONS, DECOR_STATION_FEES, DECOR_STATION_NAMES, decorPlaceOf } from '../../../src/net/decorLaw.js';
import { BED_MODELS } from '../../../src/systems/roleplayRealism/rrRealism.js';
import { HEARTH_RECORDS, hearthNear, hearthAabb } from '../../../src/systems/survival/hearth.js';
import { stationsOffered, decorStationWords } from '../../../src/ui/decorPanel.js';
import { createDecorRoom } from '../../../src/scenes/decor/decorRoom.js';
import { settle } from '../../decorFakes.mjs';
import { registerModelAlias, unregisterCustomModel } from '../../../src/world/customModels.js';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const piece = (over) => ({ id: 'p1', model: null, flat: null, pos: [2, 0, 3], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 120, ...over });

test('DECOR-USE the law: a placed piece that is one of Daggerfall\'s beds - a town mod\'s coloured one read as the classic bed it stands for - is a bed; one that holds things or serves a craft is not, nor any other model or a picture (mutants: the bed list unread; the mod\'s bed unread; a cupboard bed slept in)', () => {
  for (const m of BED_MODELS) assert.equal(decorBed(piece({ model: m })), true, `model ${m}`);
  registerModelAlias(42069, { model: 41000 });   // Beautiful Villages' blue bed, as world/townStandIns.js registers it
  try { assert.equal(decorBed(piece({ model: 42069 })), true, 'a town mod\'s coloured bed (customModels.js: read as 41000)'); } finally { unregisterCustomModel(42069); }
  assert.equal(decorBed(piece({ model: 42069 })), false, 'its mod off: no bed of Daggerfall\'s');
  assert.equal(decorBed(piece({ model: 41000, storage: true })), false, 'one that holds things opens as storage');
  assert.equal(decorBed(piece({ model: 41000, station: 'alchemy' })), false, 'one that serves a craft serves it');
  assert.equal(decorBed(piece({ model: 41003 })), false, 'another model');
  assert.equal(decorBed(piece({ flat: [210, 0] })), false, 'a picture');
  assert.equal(decorBed(null), false);
});

test('DECOR-USE the law: a placed fire one stands over (the world\'s own cooking fires: the lights archive\'s bowl of fire, camp flame and brazier) is a hearth, and so is any piece made the cooking station; a candle, a piece that holds things, or a fire serving another craft is not (mutants: the hearth flats unread; the cooking station unread; a storage fire cooked on; the fireplaces unread)', () => {
  for (const r of HEARTH_RECORDS) assert.equal(decorHearth(piece({ flat: [210, r] })), true, `TEXTURE.210 record ${r}`);
  assert.equal(decorHearth(piece({ flat: [210, 3] })), false, 'a candle is no cooking fire');
  assert.equal(decorHearth(piece({ flat: [209, 0] })), false, 'a book');
  assert.equal(decorHearth(piece({ model: 41120, station: COOKING_STATION })), true, 'a cooking station, whatever it is');
  assert.equal(decorHearth(piece({ flat: [210, 0], station: COOKING_STATION })), true);
  assert.equal(decorHearth(piece({ flat: [210, 0], storage: true })), false, 'holding things, it holds things');
  assert.equal(decorHearth(piece({ flat: [210, 20], station: 'alchemy' })), false, 'serving another craft, it serves that');
  assert.equal(decorHearth(piece({ model: 41000 })), false, 'a bed');
  for (const m of [41116, 41117]) assert.equal(decorHearth(piece({ model: m })), true, `AUDIT DECOR-USE D4: Daggerfall\'s fireplace ${m}`);
  assert.equal(decorHearth(piece({ model: 41116, storage: true })), false, 'a fireplace that holds things holds things');
  assert.equal(decorHearth(piece({ model: 41105 })), false, 'a bench');
});

test('DECOR-USE the cooking station: a tenth station, before the loom, at the crafts\' own licence (STATION-FEES: 50,000), named so; made on a piece the service\'s own law keeps it; offered online and offline, in a home, a caravan and a ship alike - Climates & Calories cooks offline (mutants: no cooking station; its licence cheap)', () => {
  assert.equal(COOKING_STATION, 'cooking');
  assert.ok(DECOR_STATIONS.includes(COOKING_STATION));
  assert.equal(DECOR_STATIONS.indexOf('cooking'), DECOR_STATIONS.indexOf('loom') - 1, 'before the loom, so the stations counted from the end stand');
  assert.equal(DECOR_STATION_FEES.cooking, 50_000);
  assert.equal(DECOR_STATION_NAMES.cooking, 'Cooking station');
  assert.deepEqual(decorStationWords(null, 'cooking'), { pick: 'Station: Cooking >', act: 'Make station - 50,000 gold', what: 'station:cooking' });
  assert.equal(decorPlaceOf({ pos: [1, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 120, station: 'cooking' })?.station, 'cooking', 'the service keeps it');
  assert.ok(stationsOffered().includes('cooking'), 'offered offline');
  assert.ok(stationsOffered(false).includes('cooking'), 'and in a caravan or a ship');
});

test('DECOR-USE the press: a hearth opens what a brazier opens (the camps\' `hearth:` press, in the interaction mode) where the braziers answer (AUDIT DECOR-USE D6: the camps\' `usable` - off, a placed fire answers no more than they do); the cooking station opens the Stores page on The Fire where there is one (D2), else what a brazier opens; a bed is slept in through the room\'s own beds\' door; any other piece is left to its station or its storage (mutants: the fire unpressed; the bed unpressed; the mode unread; the braziers\' gate unread; the Stores door unasked)', () => {
  const log = [];
  let usable = true, stores = false;
  const camps = { usable: () => usable, activate: (key, mode) => log.push(['fire', key, mode]) };
  const press = (p) => useDecorPiece(p, camps, () => 'steal', () => log.push(['bed']), () => { log.push(['stores?']); return stores; });
  assert.equal(press(piece({ flat: [210, 1] })), true);
  assert.equal(press(piece({ model: 41120, station: COOKING_STATION })), true, 'the Stores page not here: the fire\'s own');
  assert.equal(press(piece({ model: 41001 })), true);
  assert.equal(press(piece({ model: 41001, storage: true })), false, 'a bed that holds things opens as storage');
  assert.equal(press(piece({ model: 41120, station: 'forge' })), false, 'a forge is its station\'s');
  assert.deepEqual(log, [['fire', 'hearth:', 'steal'], ['stores?'], ['fire', 'hearth:', 'steal'], ['bed']]);
  log.length = 0;
  stores = true;
  assert.equal(press(piece({ model: 41120, station: COOKING_STATION })), true);
  assert.equal(press(piece({ flat: [210, 0] })), true);
  assert.deepEqual(log, [['stores?'], ['fire', 'hearth:', 'steal']], 'the station on The Fire; a placed fire as a brazier, never the Stores page');
  log.length = 0;
  usable = false;
  assert.equal(press(piece({ flat: [210, 0] })), true, 'still its press - nothing else of it answers');
  assert.deepEqual(log, [], 'Climates & Calories off and offline: no fire answers');
});

test('DECOR-USE the room: its placed fires are hearths by their flame - a picture\'s over its base, a model\'s at its box\'s middle - and no eye\'s box (AUDIT DECOR-USE D1: a square over a model\'s longer side stood through a wall and took a door\'s press; the piece\'s own target is the press); a candle beside it none, a piece not yet standing none, and one taken down gone (mutants: the room\'s fires unlisted; the flame on the floor; a model\'s box unread; the eye\'s box back)', async () => {
  const cpu = { positions: new Float32Array([-0.8, 0, -0.25, 0.8, 0, -0.25, 0.8, 2, 0.25, -0.8, 2, 0.25]), indices: new Uint16Array([0, 1, 2, 0, 2, 3]) };   // a fireplace's plan, 1.6 m by 0.5, 2 m tall
  const room = createDecorRoom({
    meshes: { getGpuMesh: async (id) => ({ gpu: `mesh${id}` }), cpuModels: new Map([[41116, cpu], [41120, cpu]]) },
    collider: () => ({ addMesh() {}, removeBucket() {} }), origin: () => [100, 10, 200],
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {}, drawMesh() {} },
    getTexture: async () => ({ recordCount: 30, getSize: () => ({ width: 20, height: 40 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1 }),
    uploadRecord() {},
  });
  room.put(piece({ id: 'fire', flat: [210, 0] }));
  room.put(piece({ id: 'candle', flat: [210, 3], pos: [5, 0, 5] }));
  room.put(piece({ id: 'hearth', model: 41116, pos: [-3, 0, 1] }));
  room.put(piece({ id: 'stove', model: 41120, pos: [6, 0, -2], station: COOKING_STATION }));
  room.put(piece({ id: 'bench', model: 41120, pos: [9, 0, 9] }));
  await settle(); await settle(); await settle();
  const list = room.hearths();
  assert.equal(list.length, 3, 'the fire, the fireplace and the cooking station - not the candle, nor a piece serving nothing');
  const [f, m, c] = list;
  assert.deepEqual([f.x, f.z], [102, 203], 'the picture where it was placed, from the room\'s origin');
  assert.ok(f.y > 10, 'its flame over its base');
  assert.deepEqual([m.x, m.y, m.z], [97, 11, 201], 'the fireplace at its box\'s middle');
  assert.deepEqual([c.x, c.y, c.z], [106, 11, 198]);
  for (const h of list) assert.equal(hearthAabb(h), null, 'no eye\'s box: the piece\'s own target is the press');
  assert.equal(hearthNear(list, [97, 10, 202], 4), true, 'a body by the fireplace is by a fire');
  room.remove('fire');
  room.remove('hearth');
  room.remove('stove');
  assert.deepEqual(room.hearths(), [], 'taken down, gone');
});

test('DECOR-USE the host: the interior\'s camps hear the room\'s placed fires beside its own, and a placed piece\'s own use is pressed before a station\'s craft - after a trader, whose press is anyone\'s (mutants: the host\'s fires unhanded; the use unwired)', () => {
  const wm = src('src/scenes/worldModes.js');
  assert.match(wm, /const interiorCamps = createCamps\(\{\n\s+entity: playerEntity,\n\s+hearths: \(\) => \[\.\.\.interiorHearths, \.\.\.interiorDecor\.hearths\(\)\],/);
  assert.match(wm, /if \(piece\?\.station === VENDOR_STATION\) \{ openHomeVendor\(piece, id\); return; \}[^\n]*\n\s+if \(useDecorPiece\(piece, interiorCamps, getInteractionMode, restFromInteriorBed, \(\) => forgeOffered\(\) && \(focusStoresStation\('fire'\), interiorKeyCtx\.togglePause\(\{ at: 'stores' \}\), true\)\)\) return;[^\n]*\n\s+if \(piece\?\.station\) \{ useDecorStation\(piece\); return; \}/);
  // AUDIT DECOR-USE D2: and The Fire is a station's head the press lands on
  assert.match(src('src/ui/professions/profPages.js'), /detail\.append\(stationHead\(divider, t\('prof\.page\.fire', 'The Fire'\), 'fire'\)\);/);
  assert.match(src('src/scenes/camps.js'), /\n\s+usable,[^\n]*\n\s+\};\n\}/, 'the camps say whether their fires answer');
});
