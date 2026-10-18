// SHIP-LIVERY, CABIN-LOOK and DECK-PROPS (2026-10-17, the owner: "Letting players customize the exterior and interior
// textures of the ship. Allowing prop placement on the ship itself and inside if not already enabled."; bible/03-World/
// Naval-Refit.md SHIP-LIVERY, DECK-PROPS).
//
// A ship's paint (systems/naval/shipLivery.js), her port-built pictures repainted by their families (world/ships/
// shipLiveryArt.js), the paint shop and the remap a boat is drawn by (scenes/comeSailAway/shipLiveryPaint.js, the real
// pool's draw over the vendored hulls); her cabin stained (scenes/cabinLook.js, the room's restyle); her deck's fittings
// (systems/naval/deckFittings.js), stood in her own tree (scenes/comeSailAway/deckFittingsHost.js - over the real pool,
// drawn, collided); the plan of her deck (ui/deckPlanWindow.js); the ledger, the boats' word and the peers.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  SHIP_PAINTS, PAINT_MAX, LIVERY_PARTS, LIVERY_ARCHIVE, STAIN_STRENGTH, liveryPartsOf, liveryOf, liveryCode, liveryOfCode, paintFamilies, tintPicture, stainPicture, meanLum, lumOf,
} from '../../../src/systems/naval/shipLivery.js';
import { liveryArtOf, LIVERY_ART, shadeCloth } from '../../../src/world/ships/shipLiveryArt.js';
import { GALLEON_ARCHIVE, TEX as GTEX, C } from '../../../src/world/ships/galleonArt.js';
import { CARRACK_ARCHIVE, TEX as CTEX } from '../../../src/world/ships/carrackArt.js';
import { LARGE_BOAT_ARCHIVE, TEX as LTEX } from '../../../src/world/ships/largeBoatArt.js';
import { createLiveryPaint, PLANK_ARCHIVE, CLASSIC_SAIL } from '../../../src/scenes/comeSailAway/shipLiveryPaint.js';
import { createComeSailAwayPool } from '../../../src/scenes/comeSailAway/comeSailAwayPool.js';
import { createFleetHost } from '../../../src/scenes/fleetHost.js';
import { createDeckPlanDoor } from '../../../src/scenes/deckPlanDoor.js';
import { drawFleetPage, resetFleetPage } from '../../../src/ui/fleetPage.js';
import { setHoldingsProvider, _setHoldingsIconForTests } from '../../../src/ui/holdingsPages.js';
import { scene, terrain } from '../../csaScene.mjs';
import { Boat } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { PrefabNode } from '../../../src/world/prefabNode.js';
import { colliderPoses } from '../../../src/world/prefabColliders.js';
import { cabinRestyle, CABIN_ARCHIVE, CABIN_STAIN } from '../../../src/scenes/cabinLook.js';
import {
  DECK_FITTINGS, DECK_FITTINGS_MAX, FITTING_GAP, FITTING_REACH, YAW_STEPS, fittingsOf, fittingsCode, fittingsOfCode, fittingsKey, isFitting, fittingKind, yawDegrees,
} from '../../../src/systems/naval/deckFittings.js';
import { standFittings, fitBoats, DECK_FITTINGS_NODE } from '../../../src/scenes/comeSailAway/deckFittingsHost.js';
import { mountDeckPlanWindow, placeRefusal, fittingName } from '../../../src/ui/deckPlanWindow.js';
import { paintSvg, paintName } from '../../../src/ui/fleetPage.js';
import { csaWireRecord, validCsaRecord, csaRecordKey } from '../../../src/systems/comeSailAway/comeSailAwayWire.js';
import {
  restoreFleetSaveData, fleetSaveData, fleetShip, setShipLivery, setShipCabin, setShipFittings, _resetFleetForTests, titleDeed, titleOf, fleetBook, knowShip, shipLabel,
} from '../../../src/systems/fleet.js';
import { mintDeed, mintBoatItem } from '../../../src/systems/comeSailAway/comeSailAwayItems.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const pic = (w, h, fill) => { const data = new Uint8Array(w * h * 4); for (let i = 0; i < w * h; i++) { const c = fill(i); data.set([c[0], c[1], c[2], c[3] ?? 255], i * 4); } return { width: w, height: h, data }; };
const px = (p, i) => [...p.data.slice(i * 4, i * 4 + 4)];
const tick = () => new Promise((r) => setTimeout(r, 0));

// ── the law ──────────────────────────────────────────────────────────────────────────────────────────────────────────

test('SHIP-LIVERY the law: fourteen paints and none; the port-built hulls take strake, accent and sail, the galley stain and sail, the rowboat stain; a livery through its door - a part the hull does not take none, a field that is no paint refusing the whole, none at all null; one number on the word, four nibbles (mutants: the parts, the door, the code)', () => {
  assert.equal(SHIP_PAINTS[0], null);
  assert.equal(PAINT_MAX, 14);
  assert.deepEqual(SHIP_PAINTS.slice(1).map((p) => p.id), ['oxblood', 'crimson', 'black', 'navy', 'bay', 'teal', 'sea', 'forest', 'ochre', 'gold', 'white', 'grey', 'purple', 'tan']);
  assert.deepEqual([0, 1, 2, 3, 4, 9].map(liveryPartsOf), [['stain'], ['strake', 'accent', 'sail'], ['strake', 'accent', 'sail'], ['stain', 'sail'], ['strake', 'accent', 'sail'], []]);
  assert.deepEqual(LIVERY_PARTS, ['strake', 'accent', 'sail', 'stain']);
  assert.deepEqual(liveryOf({ strake: 4, sail: 3 }), { strake: 4, accent: 0, sail: 3, stain: 0 });
  assert.deepEqual(liveryOf({ strake: 4, stain: 2 }, 2), { strake: 4, accent: 0, sail: 0, stain: 0 }, 'a galleon takes no stain');
  assert.equal(liveryOf({ stain: 2 }, 2), null, 'nothing she takes - as built');
  assert.equal(liveryOf({ strake: 15 }), null, 'no such paint');
  assert.equal(liveryOf({ strake: 4, sail: 15 }), null, 'one field no paint refuses the whole');
  assert.equal(liveryOf({ strake: 1.5 }), null);
  assert.equal(liveryOf({ strake: 0 }), null);
  assert.equal(liveryOf('red'), null);
  const l = { strake: 4, accent: 11, sail: 3, stain: 14 };
  assert.equal(liveryCode(l), 4 | (11 << 4) | (3 << 8) | (14 << 12));
  assert.deepEqual(liveryOfCode(liveryCode(l)), l);
  assert.deepEqual([liveryCode(null), liveryOfCode(0), liveryOfCode(-3), liveryOfCode((1 << 16) | 4), liveryOfCode(15)], [0, null, null, null, null], 'a nibble past the last paint refused');
});

test('SHIP-LIVERY the painter: a texel of a family\'s takes its paint at its own lightness against the family\'s base - every other texel as built, clear ones untouched; a tint lays a paint over a whole picture at its strength, its grain kept (mutants: the nearest, the shade, the strength)', () => {
  const palette = [C.oak, C.oxblood, C.gilt, C.tar];
  const src = pic(4, 1, (i) => [C.oxblood, [146, 50, 38], C.oak, [...C.oxblood, 0]][i]);
  const { picture, changed } = paintFamilies(src, palette, [{ members: [C.oxblood, C.oxbloodLit], base: C.oxblood, paint: [32, 44, 80] }]);
  assert.equal(changed, true);
  assert.deepEqual(px(picture, 0), [32, 44, 80, 255], 'the base takes the paint as it is');
  const k = lumOf([146, 50, 38]) / lumOf(C.oxblood);
  assert.deepEqual(px(picture, 1), [Math.round(32 * k), Math.round(44 * k), Math.round(80 * k), 255], 'her light, shaded lighter');
  assert.deepEqual(px(picture, 2), [...C.oak, 255], 'her oak as built');
  assert.deepEqual(px(picture, 3), [...C.oxblood, 0], 'a clear texel untouched, whatever its colour');
  assert.deepEqual(px(src, 0), [...C.oxblood, 255], 'the source untouched');
  assert.equal(paintFamilies(src, palette, [{ members: [C.oxblood], base: C.oxblood, paint: null }]).changed, false);
  const wood = pic(2, 1, (i) => [[100, 80, 60], [50, 40, 30]][i]);
  const t = tintPicture(wood, [120, 0, 0], 0.5);
  const mean = meanLum(wood);
  assert.equal(t.data[0], Math.round(100 * 0.5 + Math.round(120 * lumOf([100, 80, 60]) / mean) * 0.5));
  assert.equal(tintPicture(wood, [250, 0, 0], 1).data[0], 255, 'a paint shaded past white held at white');
  assert.ok(t.data[0] > t.data[4], 'the grain kept: the light plank lighter');
  assert.equal(STAIN_STRENGTH, 0.62);
  assert.deepEqual(stainPicture(wood, [120, 0, 0]).data, tintPicture(wood, [120, 0, 0], STAIN_STRENGTH).data, 'a stain the tint at its strength');
});

test('SHIP-LIVERY a port ship repainted: her painted pictures alone - sides, castles, galleries, lids, trim, gilt - never her deck, spars or iron; her canvas whole in the sail\'s paint, seams and dirt kept; a gallery\'s record with its glass and night twin; every port ship\'s strake (mutants: the records, the cloth, the glass)', () => {
  const lv = { strake: 4, accent: 11, sail: 3, stain: 0 };
  const g = liveryArtOf(GALLEON_ARCHIVE, lv);
  const recs = g.map((r) => r.record);
  for (const no of [GTEX.deck, GTEX.spar, GTEX.iron, GTEX.rope, GTEX.hullBottom, GTEX.beams]) assert.ok(!recs.includes(no), `record ${no} as built`);
  for (const yes of [GTEX.hullSide0, GTEX.castle0, GTEX.sternWindows0, GTEX.canvas, GTEX.gilt]) assert.ok(recs.includes(yes), `record ${yes} painted`);
  const gallery = g.find((r) => r.record === GTEX.sternWindows0);
  assert.ok(gallery.glow && gallery.night === GTEX.sternWindows0 + 100, 'her glass and her night twin');
  const sail = g.find((r) => r.record === GTEX.canvas);
  const built = new Map(LIVERY_ART[GALLEON_ARCHIVE].art()).get(GTEX.canvas);
  assert.deepEqual(sail.picture.data, shadeCloth(built, SHIP_PAINTS[3].rgb).data);
  for (let i = 0; i < sail.picture.data.length; i += 4) assert.ok(sail.picture.data[i] < 60, 'black sails, every texel');
  assert.deepEqual(px(shadeCloth(pic(1, 1, () => C.canvas), [10, 20, 30]), 0), [10, 20, 30, 255], 'the cloth itself the paint as it is');
  assert.ok(!liveryArtOf(GALLEON_ARCHIVE, { strake: 4, accent: 0, sail: 0, stain: 0 }).some((r) => r.record === GTEX.gilt), 'a picture the paint does not change is not made again');
  assert.deepEqual(liveryArtOf(GALLEON_ARCHIVE, { strake: 0, accent: 0, sail: 0, stain: 2 }), [], 'a stain is no port ship\'s');
  assert.deepEqual(liveryArtOf(12345, lv), []);
  for (const [a, T] of [[CARRACK_ARCHIVE, CTEX], [LARGE_BOAT_ARCHIVE, LTEX]]) {
    const strake = liveryArtOf(a, { strake: 1, accent: 0, sail: 0, stain: 0 }).map((r) => r.record);
    assert.ok([T.hullSide0, T.hullSide1, T.hullSide2, T.hullSide3, T.hullSide4].some((r) => strake.includes(r)), `${a}: her side's strake repainted`);
    assert.ok(strake.includes(T.lid), `${a}: her lids`);
    for (const no of [T.deck, T.spar, T.iron]) assert.ok(!strake.includes(no), `${a}: record ${no} as built`);
    assert.ok(liveryArtOf(a, { strake: 0, accent: 1, sail: 0, stain: 0 }).some((r) => r.record === T.gilt), `${a}: her gilt the accent's`);
  }
});

// ── the paint shop and the pool ──────────────────────────────────────────────────────────────────────────────────────

/** A renderer that keeps what it is handed. */
function recordingRenderer() {
  const r = { up: new Map(), emis: new Map(), draws: [] };
  return Object.assign(r, {
    uploadTexture: (a, rec, c, opts) => r.up.set(`${a}_${rec}`, opts), uploadEmissionTexture: (a, rec) => r.emis.set(`${a}_${rec}`, true),
    createMesh: (model) => ({ model, buffers: [{}, {}], bounds: [0, 0, 0, 0], subMeshes: model.subMeshes.map((s) => ({ ...s })) }),
    drawMesh: (gpu, m, remap) => r.draws.push(remap), updateMeshVertices() {}, createBillboardBatch: (archive, record, size, centers, opts) => ({ archive, record, size, centers, opts }),
    destroyBillboardBatch() {}, destroyMesh() {},
  });
}
/** A pipeline of the player's classic art: every record a 4 x 4 plank, its palette grey ramps. */
function classicPipeline(models = new Map()) {
  const bitmap = { width: 4, height: 4, data: new Uint8Array(16).fill(9) };
  const file = { recordCount: 3, getDFBitmap: () => bitmap, getSize: () => ({ width: 4, height: 4 }), getScale: () => ({ width: 0, height: 0 }) };
  const sails = { ...file, recordCount: 8 };   // the sails' file holds their record (CLASSIC_SAIL, 7)
  return {
    getTexture: async (a) => (a === CLASSIC_SAIL[0] ? sails : file), uploadRecord() {}, getGpuMesh: async (id) => ({ classic: id }), cpuModels: models,
    palette: { getRed: (i) => i * 10, getGreen: (i) => i * 8, getBlue: (i) => i * 6 },
  };
}

test('SHIP-LIVERY the paint shop: a boat drawn as built while her paint is made, then by a remap of her paint\'s records over the host\'s - a port ship\'s gallery by day its glass cut, at night whole and glowing; a classic hull\'s planks stained and its sails tinted; one remap a pair (mutants: the remap, the night, the join, the stain)', async () => {
  const renderer = recordingRenderer();
  const shop = createLiveryPaint({ renderer, pipeline: classicPipeline(), portArchiveOf: (h) => (h === 2 ? GALLEON_ARCHIVE : null), log: { warn() {} } });
  const code = liveryCode({ strake: 4, accent: 11, sail: 3 });
  assert.equal(shop.remapOf(2, 0, false, null), null, 'as built');
  assert.equal(shop.remapOf(2, code, false, null), null, 'while it is made');
  await tick(); await tick();
  const day = shop.remapOf(2, code, false, null), night = shop.remapOf(2, code, true, null);
  const gallery = `${GALLEON_ARCHIVE}_${GTEX.sternWindows0}`;
  assert.ok(day.get(gallery).startsWith(`${LIVERY_ARCHIVE}_`));
  assert.notEqual(day.get(gallery), night.get(gallery), 'a gallery by day and by night');
  assert.equal(renderer.up.get(day.get(gallery))?.cutout, true, 'by day its glass cut');
  assert.equal(renderer.emis.has(night.get(gallery)), true, 'at night its glow');
  assert.equal(day.get(`${GALLEON_ARCHIVE}_${GTEX.hullSide0}`), night.get(`${GALLEON_ARCHIVE}_${GTEX.hullSide0}`));
  assert.equal(day.has(`${GALLEON_ARCHIVE}_${GTEX.deck}`), false);
  const host = new Map([['1_1', '2_2'], [gallery, `${GALLEON_ARCHIVE}_${GTEX.sternWindows0 + 100}`]]);
  const joined = shop.remapOf(2, code, false, host);
  assert.equal(joined.get('1_1'), '2_2');
  assert.equal(joined.get(gallery), day.get(gallery), 'her paint over the host\'s - her own night twin hers');
  assert.equal(shop.remapOf(2, code, false, host), joined, 'one remap a pair');
  const galley = liveryCode({ stain: 3, sail: 7 });
  shop.remapOf(3, galley, false, null); await tick(); await tick(); await tick();
  const g = shop.remapOf(3, galley, false, null);
  assert.deepEqual([...g.keys()].sort(), [`${PLANK_ARCHIVE}_0`, `${PLANK_ARCHIVE}_1`, `${PLANK_ARCHIVE}_2`, `${CLASSIC_SAIL[0]}_${CLASSIC_SAIL[1]}`].sort());
});

const fileFetch = async (url) => {
  const bytes = readFileSync(fileURLToPath(url));
  return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
};
/** The fittings' models, each a box a metre wide, 0.6 deep and 0.8 tall standing on its own floor at 0.2, its middle off its
 *  origin (0.2 along x, 0.05 along z). */
const BOX = new Float32Array([-0.3, 0.2, -0.25, 0.7, 1.0, 0.35, 0.7, 0.2, 0.35]);
const fittingModels = () => new Map(DECK_FITTINGS.map(([m]) => [m, { positions: BOX, indices: new Uint16Array([0, 1, 2]) }]));

test('SHIP-LIVERY and DECK-PROPS over the real pool: my boat drawn by her paint (my ledger\'s), a peer\'s by her owner\'s word, a sea ship as built; her fittings stood in her tree under her MeshObject - each a classic model on her deck, its foot on the deck and its middle over its place, turned, a MeshRenderer and a MeshCollider over it - fitted again when they change, the node gone with the last (mutants: mine and a peer\'s, the fitting-out, the stand)', async () => {
  const renderer = recordingRenderer();
  const pipeline = classicPipeline(fittingModels());
  let mine = { strake: 4 }, fits = [];
  const pool = createComeSailAwayPool({ renderer, pipeline, fetchFn: fileFetch, log: { warn() {} }, liveryOf: () => mine, fittingsOf: () => fits });
  assert.equal(await pool.preload(), true);
  const boat = pool.spawnNow(Object.assign(new Boat(2, 0), { uid: 7 }), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });
  pool.draw(renderer);
  await tick(); await tick();
  renderer.draws.length = 0;
  pool.draw(renderer);
  const painted = (r) => !!r?.get?.(`${GALLEON_ARCHIVE}_${GTEX.hullSide0}`)?.startsWith(`${LIVERY_ARCHIVE}_`);
  const hers = renderer.draws.filter(painted).length;
  assert.ok(hers > 0, 'her paint');
  const sea = pool.spawnSeaNow(Object.assign(new Boat(2, 0), { uid: 7 }));
  renderer.draws.length = 0;
  pool.draw(renderer);
  assert.equal(renderer.draws.filter(painted).length, hers, 'a sea ship as built, whatever her number');
  pool.remove(sea);
  mine = null;
  renderer.draws.length = 0;
  pool.draw(renderer);
  assert.ok(renderer.draws.every((r) => !r?.has?.(`${GALLEON_ARCHIVE}_${GTEX.hullSide0}`)), 'stripped: as built');
  const peer = pool.spawnPeerNow(Object.assign(new Boat(2, 0), { uid: 7, livery: liveryCode({ strake: 4 }) }));
  renderer.draws.length = 0;
  pool.draw(renderer);
  assert.ok(renderer.draws.some((r) => r?.get?.(`${GALLEON_ARCHIVE}_${GTEX.hullSide0}`)), 'a peer\'s by her word, whatever her number is in my ledger');
  const own = pool.spawnSeaNow(Object.assign(new Boat(2, 0), { livery: liveryCode({ strake: 4 }) }));   // SEA-COLOURS: her own, the naval host's (seaColours.js)
  renderer.draws.length = 0;
  pool.draw(renderer);
  assert.ok(renderer.draws.some((r) => r?.get?.(`${GALLEON_ARCHIVE}_${GTEX.hullSide0}`)), 'a sea ship in her own colours');
  pool.remove(own);
  // DECK-PROPS
  const deck = pool.deckOf(2);
  let spot = null;
  for (let z = -2; z <= 2 && !spot; z += 0.5) for (let x = -1; x <= 1 && !spot; x += 0.5) if (deck.walkable(x, z)) spot = [x, z];
  assert.ok(spot, 'a spot of her open deck');
  fits = fittingsOf([{ m: 41812, x: spot[0], z: spot[1], yaw: 4 }]);
  pool.frame(0.1, {});
  const node = boat.MeshObject.children.find((c) => c.name === DECK_FITTINGS_NODE);
  assert.ok(node, 'her fittings\' node, under her MeshObject');
  const fit = node.children[0];
  assert.deepEqual(fit.localPosition, [spot[0], deck.heightAt(spot[0], spot[1]), spot[1]]);
  const q = fit.localRotation;
  assert.ok(Math.abs(q[1] - Math.sin(Math.PI / 4)) < 1e-6, 'a quarter turn');
  const mesh = fit.children[0];
  assert.deepEqual(mesh.localPosition.map((v) => Math.round(v * 1e6) / 1e6 || 0), [-0.2, -0.2, -0.05], 'its foot on her deck, its middle over its place');
  assert.equal(mesh.getComponent('MeshRenderer').classicModel, 41812);
  assert.ok(colliderPoses(boat.GameObject).some((c) => c.collider.classicModel === 41812), 'in her colliders');
  assert.equal(peer.MeshObject.children.some((c) => c.name === DECK_FITTINGS_NODE), false, 'a peer\'s by her word, not my ledger');
  peer.fittings = fittingsOf([{ m: 41815, x: spot[0], z: spot[1] }]);
  pool.frame(0.1, {});
  assert.deepEqual(peer.MeshObject.children.find((c) => c.name === DECK_FITTINGS_NODE)?.children.map((c) => c.name), ['Fitting-41815'], 'a peer\'s fittings by her word');
  pool.frame(0.1, {});
  assert.equal(boat.MeshObject.children.filter((c) => c.name === DECK_FITTINGS_NODE).length, 1, 'stood once while they stand');
  fits = [];
  pool.frame(0.1, {});
  assert.equal(boat.MeshObject.children.some((c) => c.name === DECK_FITTINGS_NODE), false, 'the last taken up: the node gone');
  pool.destroyAll();
});

test('DECK-PROPS standing: a fitting whose model is not loaded waits - its model asked, the boat fitted again once it is; one whose place is no deck of hers stands nowhere for good; her node made again whole, one under her MeshObject; a boat fitted by her list\'s key is let be; one whose deck is not baked waits; a boat never fitted with none to fit is let be; while one waits her tree is made again only as one more loads (mutants: the wait, the deck, the key, the node, the stage)', () => {
  assert.equal(standFittings({ hull: 2, MeshObject: null }, [{ m: 41812, x: 0, z: 0, yaw: 0 }], { ctx: {}, deck: null }), false, 'no frame of hers');
  const frame = new PrefabNode('MeshObject');
  const boat = { hull: 2, MeshObject: frame };
  const loaded = new Set([41812]);
  const ctx = { modelBounds: (m) => (loaded.has(m) ? { min: [-0.5, 0.1, -0.25], max: [0.9, 1.1, 0.45] } : null) };
  const deck = { heightAt: (x) => (x > 5 ? NaN : 1.5) };
  const asked = [];
  const o = { ctx, deckOf: () => deck, load: (m) => asked.push(m) };
  const list = fittingsOf([{ m: 41812, x: 0, z: 0 }, { m: 41813, x: 3, z: 0, yaw: 8 }, { m: 41815, x: 9, z: 0 }]);
  const node = () => frame.children.filter((c) => c.name === DECK_FITTINGS_NODE);
  fitBoats([boat], () => list, o);
  assert.deepEqual(asked, [41812, 41813, 41815], 'PIN MOVED (AUDIT 2): every fitting\'s model asked, loaded or not - the ask pins it (the pool asks a model once)');
  assert.equal(boat._fitted, undefined, 'not fitted while one loads');
  assert.deepEqual(node()[0].children.map((c) => c.name), ['Fitting-41812'], 'the loaded one stands meanwhile');
  const waiting = node()[0];
  for (let i = 0; i < 3; i++) fitBoats([boat], () => list, o);
  assert.equal(node()[0], waiting, 'AUDIT 2026-10-17: nothing more loaded - her tree not made again, frame on frame');
  loaded.add(41813); loaded.add(41815);
  fitBoats([boat], () => list, o);
  assert.equal(node().length, 1, 'her node made again whole, never twice');
  assert.deepEqual(node()[0].children.map((c) => c.name), ['Fitting-41812', 'Fitting-41813'], 'the one off her deck stands nowhere');
  assert.deepEqual(node()[0].children[1].localPosition, [3, 1.5, 0], 'on her deck under its place');
  assert.deepEqual(node()[0].children[1].children[0].localPosition.map((v) => Math.round(v * 1e6) / 1e6 || 0), [-0.2, -0.1, -0.1], 'its foot on the deck, its middle over its place');
  assert.equal(boat._fitted, fittingsKey(list), 'fitted: the one off her deck stands nowhere for good');
  const stood = node()[0];
  fitBoats([boat], () => fittingsOf(list), o);
  assert.equal(node()[0], stood, 'a boat fitted by her list\'s key let be');
  loaded.delete(41813);
  fitBoats([boat], () => fittingsOf(list), o);
  assert.equal(node()[0], stood, 'fitted, let be - a model\'s bounds let go since or not (its mesh stands)');
  loaded.add(41813);
  const moved = fittingsOf([{ m: 41812, x: 1, z: 0 }]);
  fitBoats([boat], () => moved, { ...o, deckOf: () => null });
  assert.equal(node()[0], stood, 'her deck not baked yet: the next frame');
  fitBoats([boat], () => moved, o);
  assert.deepEqual([node().length, node()[0].children.length, boat._fitted], [1, 1, fittingsKey(moved)]);
  fitBoats([boat], () => [], { ...o, deckOf: () => assert.fail('her deck is not baked to clear it') });
  assert.deepEqual([node().length, boat._fitted], [0, ''], 'the last taken up: the node gone');
  const bare = { hull: 2, MeshObject: new PrefabNode('MeshObject') };
  fitBoats([bare], () => [], { ...o, deckOf: () => assert.fail('no deck asked for none') });
  assert.deepEqual([bare._fitted, bare.MeshObject.children.length], ['', 0], 'never fitted, none to fit');
});

// ── the law of fittings ──────────────────────────────────────────────────────────────────────────────────────────────

test('DECK-PROPS the law: Daggerfall\'s stores and sea chests; through the door only known models at finite places within reach, none nearer another than the gap, at most twenty-four, a turn of sixteen; four numbers each on the word, a list it refuses none (mutants: the door\'s every guard, the code)', () => {
  assert.equal(DECK_FITTINGS.length, 23);
  assert.deepEqual([fittingKind(41815), fittingKind(41812), fittingKind(41003), isFitting(41834), isFitting(41835)], ['crate', 'chest', null, true, false]);
  assert.deepEqual([DECK_FITTINGS_MAX, FITTING_GAP, FITTING_REACH, YAW_STEPS], [24, 0.6, 40, 16]);
  assert.equal(yawDegrees(4), 90);
  assert.deepEqual(fittingsOf([{ m: 41815, x: 1.234, z: -2.06, yaw: 17 }]), [{ m: 41815, x: 1.2, z: -2.1, yaw: 1 }], 'to the decimetre, its turn wrapped');
  assert.deepEqual(fittingsOf([{ m: 41003, x: 0, z: 0 }, { m: 41815, x: NaN, z: 0 }, { m: 41815, x: 50, z: 0 }, null, 'x']), []);
  assert.deepEqual(fittingsOf([{ m: 41815, x: 0, z: 0 }, { m: 41816, x: 0.3, z: 0 }, { m: 41816, x: 0.7, z: 0 }]).map((f) => f.x), [0, 0.7], 'the gap');
  assert.equal(fittingsOf(Array.from({ length: 40 }, (_, i) => ({ m: 41815, x: i - 20, z: 0 }))).length, DECK_FITTINGS_MAX);
  assert.deepEqual(fittingsOf(null), []);
  const list = [{ m: 41812, x: 1.5, z: -3, yaw: 5 }, { m: 41834, x: -2, z: 4.4, yaw: 0 }];
  const code = fittingsCode(list);
  assert.deepEqual(code, [21, 15, -30, 5, 19, -20, 44, 0]);
  assert.deepEqual(fittingsOfCode(code), list);
  assert.deepEqual([fittingsOfCode([1, 2, 3, 4, 5]), fittingsOfCode([1, 15.5, 0, 0]), fittingsOfCode('x'), fittingsOfCode(Array(DECK_FITTINGS_MAX * 4 + 4).fill(0))], [[], [], [], []]);
  assert.deepEqual(fittingsOfCode([99, 0, 0, 0]), [], 'no such fitting');
});

// ── the ledger, the word ─────────────────────────────────────────────────────────────────────────────────────────────

test('SHIP-LIVERY and DECK-PROPS in the ledger: her paint (the parts her hull takes), her cabin\'s stain and her fittings set, refused where they are no such thing, kept in the save and read back through their doors; an older save\'s ship as built (mutants: each setter\'s door, the save, the restore)', () => {
  _resetFleetForTests();
  titleDeed(mintDeed(2, 0, 11, 1));
  titleDeed(mintDeed(0, 0, 12, 1));
  assert.equal(setShipLivery(11, { strake: 4, stain: 3 }), true);
  assert.deepEqual(fleetShip(11).livery, { strake: 4, accent: 0, sail: 0, stain: 0 });
  assert.equal(setShipLivery(11, { strake: 40 }), false);
  assert.deepEqual(fleetShip(11).livery, { strake: 4, accent: 0, sail: 0, stain: 0 }, 'a refused paint leaves hers');
  assert.equal(setShipLivery(11, 'red'), false);
  assert.equal(setShipLivery(12, { stain: 3 }), true);
  assert.equal(setShipLivery(99, { strake: 1 }), false);
  assert.equal(setShipCabin(11, 9), true);
  assert.deepEqual([setShipCabin(11, 15), setShipCabin(11, 1.5), fleetShip(11).cabin], [false, false, 9]);
  assert.equal(setShipFittings(11, [{ m: 41812, x: 1, z: 2, yaw: 3 }, { m: 1, x: 0, z: 0 }]), true);
  assert.deepEqual(fleetShip(11).deck, [{ m: 41812, x: 1, z: 2, yaw: 3 }]);
  assert.equal(setShipFittings(11, 'x'), false);
  const save = JSON.parse(JSON.stringify(fleetSaveData()));
  const s11 = save.ships.find((s) => s.uid === 11);
  assert.deepEqual([s11.livery, s11.cabin, s11.deck], [{ strake: 4, accent: 0, sail: 0, stain: 0 }, 9, [{ m: 41812, x: 1, z: 2, yaw: 3 }]]);
  assert.equal(save.ships.find((s) => s.uid === 12).cabin, undefined, 'none kept for none');
  _resetFleetForTests();
  restoreFleetSaveData({ v: 1, ships: [...save.ships.map((s) => (s.uid === 12 ? { ...s, livery: { strake: 99 }, cabin: 77, deck: 'x' } : s))] });
  assert.deepEqual([fleetShip(11).livery.strake, fleetShip(11).cabin, fleetShip(11).deck.length], [4, 9, 1]);
  assert.deepEqual([fleetShip(12).livery, fleetShip(12).cabin, fleetShip(12).deck], [null, 0, []], 'a hand-made record put right');
  _resetFleetForTests();
});

/** The Fleet over the real runtime (test/systems/naval/shipcolours.test.js's): a ship of mine stood at the yard. */
function fleetWorld() {
  _resetFleetForTests();
  const s = scene({ terrains: [terrain(10, 20)] });
  let uid = 7100;
  const pack = [];
  s.deps.items = { create: (t) => mintBoatItem(t, ++uid), addToPlayer: (it) => pack.push(it), player: () => pack, titles: () => fleetBook(), retitle: (boat) => !!boat };
  s.deps.isPortTown = () => true;
  const ship = (u, hull) => { titleDeed(mintDeed(hull, 0, u, 1000)); return s.rt.SummonBoat(u, titleOf(u), fleetBook(), [100, 34, 200], [0, 0, 1], s.terrains[0]); };
  return { s, ship };
}

test('SHIP-LIVERY, CABIN-LOOK and DECK-PROPS on the Fleet: each card says the parts her hull takes, her paint, her cabin\'s stain (none without a cabin) and her fittings; Paint paints her and stains her cabin wherever she lies - refused whole where either is no paint, her word said again - and strips her; Deck fits her out through the door and opens the plan of her deck; the page\'s Paint panel chooses each part her hull takes and her cabin\'s wood, and paints her through the act (mutants: the rows, the acts, the whole refusal, the panel, the Deck button)', () => {
  _setHoldingsIconForTests(() => ({ src: 'data:x', w: 30, h: 30 }));
  globalThis.document = undefined;
  const { s, ship } = fleetWorld();
  let changed = 0;
  const opened = [];
  const host = createFleetHost({
    csa: () => s.rt, naval: () => null, pack: () => [], gold: () => 0, pay: () => {}, accounts: () => [], regionName: () => '',
    where: () => ({ inside: false, pixel: { X: 10, Y: 20 }, feet: [100, 34, 200] }), nearPort: () => true, nearestPort: () => null, terrainAt: () => s.terrains[0],
    changed: () => { changed++; }, openHold: () => true, openDeck: (u) => { opened.push(u); return true; },
  });
  ship(41, 2); knowShip(42, 0, 0, 1); titleDeed(mintDeed(0, 0, 42, 1)); knowShip(43, 1, 0, 1); titleDeed(mintDeed(1, 0, 43, 1));
  const rows = () => host.model().ships.map((r) => [r.uid, r.paints, r.livery, r.cabin, r.fittings]).sort((a, b) => a[0] - b[0]);
  assert.deepEqual(rows(), [[41, ['strake', 'accent', 'sail'], null, 0, 0], [42, ['stain'], null, null, 0], [43, ['strake', 'accent', 'sail'], null, null, 0]]);
  let r = host.act(41, 'livery', { strake: 4, sail: 3, stain: 2, cabin: 9 });
  assert.deepEqual([r.ok, r.text, changed], [true, 'Ship painted. Other players will see it.', 1]);
  assert.deepEqual([fleetShip(41).livery, fleetShip(41).cabin], [{ strake: 4, accent: 0, sail: 3, stain: 0 }, 9], 'the parts her hull takes; her cabin stained');
  for (const bad of [{ strake: 40 }, { strake: 5, cabin: 99 }, { strake: 5, cabin: 1.5 }, 'red']) {
    r = host.act(41, 'livery', bad);
    assert.deepEqual([r.ok, r.text], [false, 'Unknown paint.'], JSON.stringify(bad));
  }
  assert.deepEqual([fleetShip(41).livery.strake, fleetShip(41).cabin, changed], [4, 9, 1], 'a paint refused leaves her whole as she was, her word unsaid');
  assert.equal(host.act(42, 'livery', { stain: 3, cabin: 5 }).ok, true);
  assert.deepEqual([fleetShip(42).livery, fleetShip(42).cabin], [{ strake: 0, accent: 0, sail: 0, stain: 3 }, 0], 'no cabin of hers: none stained');
  assert.equal(host.act(43, 'livery', { strake: 1, cabin: 99 }).ok, true, 'no cabin of hers: her cabin\'s paint not asked');
  r = host.act(41, 'livery', null);
  assert.deepEqual([r.ok, r.text, fleetShip(41).livery, fleetShip(41).cabin], [true, 'Paint removed. The ship is back to its original look.', null, 0]);
  r = host.act(41, 'deck', [{ m: 41812, x: 1, z: 2 }, { m: 41815, x: 0, z: 0 }]);
  assert.deepEqual([r.ok, r.text, fleetShip(41).deck.length], [true, 'Deck layout saved: 2 fittings.', 2]);
  assert.equal(changed, 5, 'her word said again');
  assert.deepEqual([host.act(41, 'deck', 'x').ok, fleetShip(41).deck.length, changed], [false, 2, 5], 'a thing that is no list refused, her deck as it was');
  assert.deepEqual([host.act(41, 'deck', []).text, fleetShip(41).deck.length], ['Deck cleared.', 0]);
  host.act(41, 'deck', [{ m: 41812, x: 1, z: 2 }]);
  assert.equal(rows()[0][4], 1);
  r = host.act(41, 'deckPlan');
  assert.deepEqual([r.ok, typeof r.door, opened], [true, 'function', []], 'the plan of her deck a door, once the journal is closed');
  r.door();
  assert.deepEqual(opened, [41], 'the plan of her deck');
  // the page
  const el = (tag, cls, text) => {
    const n = { tag, children: [], attrs: {}, title: '', className: cls ?? '', innerHTML: '', style: { setProperty() {} }, _t: text == null ? '' : String(text), setAttribute(k, v) { n.attrs[k] = v; }, append(...c) { n.children.push(...c); } };
    Object.defineProperty(n, 'textContent', { get: () => n._t + n.children.map((c) => c.textContent ?? '').join(''), set: (v) => { n._t = String(v); } });
    return n;
  };
  const all = (root, pred) => { const out = []; const walk = (x) => { for (const c of x.children ?? []) { if (pred(c)) out.push(c); walk(c); } }; walk(root); return out; };
  const press = (root, label) => all(root, (c) => c.tag === 'button' && c.textContent === label);
  setHoldingsProvider({ fleet: { model: () => host.model(), offer: (u) => host.offer(u), act: (u, v, a) => host.act(u, v, a) } });
  resetFleetPage();
  const draw = () => { const d = el('div', 'px-qdetail'); drawFleetPage(d, () => {}, { el, divider: (t) => el('h4', null, t), meter: () => el('div'), door: (fn) => fn() }); return d; };
  let d = draw();
  assert.equal(press(d, 'Paint').length, 3, 'every hull that takes a paint');
  assert.deepEqual([press(d, 'Deck (1)').length, press(d, 'Deck').length], [1, 2], 'her Deck, and how many stand on it');
  opened.length = 0;
  press(d, 'Deck (1)')[0].onclick();
  assert.deepEqual(opened, [41]);
  const cardOf = (root, uid) => { const label = host.model().ships.find((x) => x.uid === uid).label; return all(root, (c) => c.className === 'hld-row' && all(c, (x) => x.className === 'hld-name' && x.textContent === label).length)[0]; };
  press(cardOf(d, 41), 'Paint')[0].onclick();
  d = draw();
  const groups = all(d, (c) => c.attrs?.role === 'radiogroup').map((g) => g.attrs['aria-label']);
  assert.deepEqual(groups, ['Hull strakes', 'Trim and gilding', 'Sails', 'Cabin wood'], 'the parts her hull takes, and her cabin');
  const swatch = (group, name) => all(all(d, (c) => c.attrs?.role === 'radiogroup' && c.attrs['aria-label'] === group)[0], (c) => c.attrs?.['aria-label'] === name)[0];
  swatch('Hull strakes', 'Navy').onclick();
  d = draw();
  swatch('Cabin wood', 'Tan').onclick();
  d = draw();
  assert.ok(all(d, (c) => c.className === 'hld-flag')[0].innerHTML.includes('#202c50'), 'her picture in the paint chosen');
  press(d, 'Apply paint')[0].onclick();
  assert.deepEqual([fleetShip(41).livery, fleetShip(41).cabin], [{ strake: 4, accent: 0, sail: 0, stain: 0 }, 14], 'painted through the act');
  d = draw();
  press(cardOf(d, 41), 'Paint')[0].onclick();
  d = draw();
  press(d, 'Remove paint')[0].onclick();
  assert.deepEqual([fleetShip(41).livery, fleetShip(41).cabin], [null, 0]);
  setHoldingsProvider(null);
  resetFleetPage();
  _resetFleetForTests();
});

test('DECK-PROPS the plan\'s door: her hull\'s deck from the pool, each fitting\'s model asked (AUDIT 2: loaded or not - the ask pins it), the plan made over the sea\'s window door and shown - her name, her fittings on it, each one\'s box its model\'s, kept through the Fleet\'s act; a ship of none, or whose deck is not baked, says so (mutants: the deck, the save, the footprint)', () => {
  _resetFleetForTests();
  titleDeed(mintDeed(2, 0, 51, 1));
  setShipFittings(51, [{ m: 41812, x: 1, z: 1 }]);
  const said = [], shown = [], asked = [], acts = [];
  let made = null;
  const models = new Map([[41812, { positions: BOX }]]);
  const deck = { count: 10, cell: 0.5, minX: -2, minZ: -4, nx: 8, nz: 16, y: new Float32Array(128), walkable: () => true };
  const door = createDeckPlanDoor({
    pool: { deckOf: (hull) => (hull === 2 ? deck : hull === 1 ? { ...deck, count: 0 } : null) }, pipeline: { cpuModels: models, getGpuMesh: (m) => { asked.push(m); return Promise.resolve(null); } },
    act: (uid, verb, arg) => { acts.push([uid, verb, arg]); return { ok: true, text: 'kept' }; }, show: (w) => shown.push(w), say: (l) => said.push(l),
    overlay: (d) => { made = d; return { done: false }; },
  });
  assert.equal(door(99), false);
  assert.deepEqual(said, ['The deck isn\'t loaded yet. Place the ship in the world first.']);
  titleDeed(mintDeed(1, 0, 52, 1));
  assert.deepEqual([door(52), said.length, made], [false, 2, null], 'no open deck of hers known');
  assert.equal(door(51), true);
  assert.equal(shown.length, 1, 'shown');
  assert.deepEqual([made.name, made.deck, made.fittings], [shipLabel(fleetShip(51)), deck, [{ m: 41812, x: 1, z: 1, yaw: 0 }]]);
  assert.deepEqual(made.footprint(41812).map((v) => Math.round(v * 1e6) / 1e6), [1, 0.6], 'its box its model\'s');
  assert.equal(made.footprint(41815), null, 'one loading: none yet');
  assert.equal(asked.length, DECK_FITTINGS.length, 'PIN MOVED (AUDIT 2): each fitting\'s model asked, the loaded one too - the ask pins it');
  assert.ok(asked.includes(41812), 'the loaded one asked too - pinned');
  assert.deepEqual([made.save([{ m: 41815, x: 0, z: 0, yaw: 2 }]), acts], [{ ok: true, text: 'kept' }, [[51, 'deck', [{ m: 41815, x: 0, z: 0, yaw: 2 }]]]], 'kept through the Fleet\'s act');
  _resetFleetForTests();
});

test('SHIP-LIVERY and DECK-PROPS on the boats\' word: `l` a number a boat and `d` her fittings\' numbers, each only while one is painted or fitted; read through their doors, a bad one as built and bare, never the boats dropped; the record\'s key moves with them (mutants: the keys, the readers, the key)', () => {
  const at = (extra = {}) => ({ hull: 2, variant: 0, position: [1, 2, 3], rotation: [0, 0, 0, 1], sails: 0, helm: false, light: false, ...extra });
  const plain = csaWireRecord([at()]);
  assert.equal(plain.l, undefined);
  assert.equal(plain.d, undefined);
  const rec = csaWireRecord([at({ livery: { strake: 4 }, fittings: [{ m: 41812, x: 1, z: 2, yaw: 3 }] }), at()]);
  assert.deepEqual(rec.l, [4, 0]);
  assert.deepEqual(rec.d, [[21, 10, 20, 3], []]);
  const read = validCsaRecord(rec);
  assert.deepEqual(read.boats[0].livery, { strake: 4, accent: 0, sail: 0, stain: 0 });
  assert.deepEqual(read.boats[0].fittings, [{ m: 41812, x: 1, z: 2, yaw: 3 }]);
  assert.equal(read.boats[1].livery, undefined);
  assert.equal(read.boats[1].fittings, undefined);
  const bad = validCsaRecord({ ...rec, l: ['x', 1 << 20], d: [[1, 2], 'y'] });
  assert.equal(bad.boats.length, 2, 'never the boats dropped');
  assert.deepEqual([bad.boats[0].livery, bad.boats[0].fittings, bad.boats[1].fittings], [undefined, undefined, undefined]);
  assert.notEqual(csaRecordKey(rec), csaRecordKey(plain));
  assert.notEqual(csaRecordKey(csaWireRecord([at({ livery: { strake: 5 } })])), csaRecordKey(csaWireRecord([at({ livery: { strake: 4 } })])));
  assert.notEqual(csaRecordKey(csaWireRecord([at({ fittings: [{ m: 41812, x: 1, z: 2, yaw: 4 }] })])), csaRecordKey(csaWireRecord([at({ fittings: [{ m: 41812, x: 1, z: 2, yaw: 3 }] })])));
  const peers = rd('src/scenes/comeSailAway/comeSailAwayPeers.js');
  assert.match(peers, /s\.boat\.livery = liveryCode\(w\.livery\);/);
  assert.match(peers, /s\.boat\.fittings = w\.fittings \?\? \[\];/);
  const world = rd('src/scenes/world.js');
  assert.match(world, /livery: b\.uid \? fleetShip\(b\.uid\)\?\.livery \?\? null : null, fittings: b\.uid \? fleetShip\(b\.uid\)\?\.deck \?\? \[\] : \[\],/);
  assert.match(world, /liveryOf: \(boat\) => \(boat\.uid \? fleetShip\(boat\.uid\)\?\.livery \?\? null : null\), fittingsOf: \(boat\) => \(boat\.uid \? fleetShip\(boat\.uid\)\?\.deck \?\? \[\] : \[\]\),/);   // PIN MOVED (SHIP-PLAQUE: the pool's `plaqueOf` follows)
});

// ── her cabin ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('CABIN-LOOK her cabin stained: none as built; each picture her room wears (its climate\'s key) stained and set in the room\'s remap in its place, once each - glass left as built; the room\'s build asks it before its batch, the cabin\'s visit hands it her record\'s stain (mutants: the stain, the glass, the remap, the wiring)', async () => {
  assert.equal(cabinRestyle(0), null);
  const restyle = cabinRestyle(2);
  const renderer = recordingRenderer();
  renderer.windowMasks = new Set(['9_2']);
  const texRemap = new Map([['5_1', '305_1']]);
  const lists = [[{ textureArchive: 5, textureRecord: 1 }, { textureArchive: 9, textureRecord: 2 }], [{ textureArchive: 5, textureRecord: 1 }, { textureArchive: 7, textureRecord: 2 }]];
  const p = classicPipeline();
  const read = [];
  await restyle(texRemap, lists, { renderer, getTexture: (a) => { read.push(a); return p.getTexture(a); }, palette: p.palette });
  assert.deepEqual(read, [305, 7], 'the picture the climate gives her room read, never her glass');
  assert.ok(texRemap.get('5_1').startsWith(`${CABIN_ARCHIVE}_`), 'the climate\'s picture stained in its place');
  assert.ok(texRemap.get('7_2').startsWith(`${CABIN_ARCHIVE}_`));
  assert.equal(texRemap.has('9_2'), false, 'her glass as built');
  assert.equal(renderer.up.size, 2);
  assert.equal(CABIN_STAIN, 0.55);
  assert.match(rd('src/scenes/interiorContext.js'), /if \(typeof opts\.restyle === 'function'\) await opts\.restyle\(texRemap, \[\.\.\.pending\.keys\(\)\]\.map\(\(id\) => cpuModels\.get\(id\)\?\.subMeshes \?\? \[\]\), \{ renderer, getTexture, palette \}\);/);
  const ic = rd('src/scenes/interiorContext.js');
  assert.ok(ic.indexOf('await opts.restyle(') < ic.indexOf('const drawList = [];'), 'before the room\'s batch is made');
  assert.match(rd('src/scenes/sailingCabin.js'), /sailingCabin: cabin, restyle: cabinRestyle\(guest \? 0 : fleetShip\(cabin\.uid\)\?\.cabin \?\? 0\) \};/);   // PIN MOVED (AUDIT 2: another's cabin as built)
  assert.match(rd('src/scenes/worldModes.js'), /restyle: hit\.restyle \?\? null,/);
});

// ── the plan of her deck, the paint's picture ────────────────────────────────────────────────────────────────────────

/** A document enough for the plan: elements that keep children, classes and handlers; a canvas that draws nothing but
 *  keeps its turns (`turns`), `w` by `h` on the page. */
function fakeDoc({ w = 400, h = 400 } = {}) {
  const turns = [];
  const mk = (tag) => {
    const kids = [], classes = new Set();
    const e = {
      tagName: tag.toUpperCase(), children: kids, style: {}, attrs: {}, dataset: {}, textContent: '', title: '', disabled: false, handlers: {},
      classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), toggle: (c, on) => { if (on ?? !classes.has(c)) classes.add(c); else classes.delete(c); }, contains: (c) => classes.has(c) },
      set className(v) { classes.clear(); for (const c of String(v).split(/\s+/).filter(Boolean)) classes.add(c); }, get className() { return [...classes].join(' '); },
      append: (...n) => kids.push(...n), appendChild: (n) => kids.push(n), replaceChildren: (...n) => { kids.length = 0; kids.push(...n); }, remove() { e.removed = true; },
      setAttribute: (k, v) => { e.attrs[k] = v; }, focus() {}, addEventListener: (t, fn) => { e.handlers[t] = fn; }, setPointerCapture() {},
      getBoundingClientRect: () => ({ left: 0, top: 0, right: w, bottom: h, width: w, height: h }), clientWidth: w, clientHeight: h,
      getContext: () => new Proxy({}, { get: (_t, k) => (k === 'measureText' ? (s) => ({ width: String(s).length * 7 }) : k === 'rotate' ? (a) => turns.push(a) : () => {}), set: () => true }),
    };
    return e;
  };
  return { createElement: mk, getElementById: () => null, head: mk('head'), documentElement: { dataset: {} }, turns };
}

test('DECK-PROPS the plan of her deck: a click sets the fitting chosen where it is deck and room; refused off her deck, too near another, or past the most; a click on one takes it up - turned (Q, E), taken away (Delete); Save layout hands the ledger the list through the door (mutants: the refusals, the turn, the save)', () => {
  const doc = fakeDoc();
  const saved = { add: globalThis.addEventListener, rem: globalThis.removeEventListener, si: globalThis.setInterval, ci: globalThis.clearInterval };
  globalThis.addEventListener = () => {}; globalThis.removeEventListener = () => {}; globalThis.setInterval = () => 1; globalThis.clearInterval = () => {};
  try {
    const deck = { cell: 0.5, minX: -2, minZ: -4, nx: 8, nz: 16, y: new Float32Array(128).fill(3), walkable: (x, z) => Math.abs(x) < 2 && Math.abs(z) < 4 };
    assert.equal(placeRefusal(deck, [5, 0], []), 'That spot isn\'t on the open deck.');
    assert.equal(placeRefusal(deck, [0, 0], [{ x: 0.3, z: 0 }]), 'Too close to another fitting.');
    assert.equal(placeRefusal(deck, [0, 0], [{ x: 1, z: 0 }]), null);
    let kept = null;
    const host = doc.createElement('div');
    const w = mountDeckPlanWindow(host, { name: 'Gull', deck, fittings: [{ m: 41812, x: 1, z: 1, yaw: 0 }], save: (list) => { kept = list; return { ok: true, text: 'ok' }; }, doc });
    w.choose(41820);
    w.clickAt(0, -2);
    assert.deepEqual(w.model().list.map((f) => [f.m, f.x, f.z]), [[41812, 1, 1], [41820, 0, -2]]);
    w.clickAt(5, 0);
    assert.equal(w.model().list.length, 2, 'off her deck: refused');
    w.key('e'); w.key('e'); w.key('q');
    assert.equal(w.model().list[1].yaw, 1);
    w.clickAt(1, 1);
    assert.equal(w.model().picked, 0, 'taken up');
    w.key('Delete');
    assert.deepEqual(w.model().list.map((f) => f.m), [41820]);
    w.keep();
    assert.deepEqual(kept, [{ m: 41820, x: 0, z: -2, yaw: 1 }]);
    // a second plan: a turn wraps round, her deck holds the most and no more, a save refused keeps the plan up and says why
    let exits = 0;
    const w2 = mountDeckPlanWindow(host, { name: 'Gull', deck, fittings: [], save: () => ({ ok: false, text: 'No.' }), onExit: () => { exits++; }, doc });
    w2.clickAt(-1.5, -3.5);
    w2.key('q');
    assert.equal(w2.model().list[0].yaw, YAW_STEPS - 1, 'a turn wraps round');
    for (let k = 0; k < 11; k++) for (let i = 0; i < 5; i++) w2.clickAt(-1.5 + i * 0.7, -3.5 + k * 0.7);
    assert.equal(w2.model().list.length, DECK_FITTINGS_MAX, 'the most and no more');
    w2.keep();
    assert.equal(exits, 0, 'a save refused: the plan stays up');
    w2.key('Escape');
    assert.equal(exits, 1);
    // the plan as she is seen from above: a turn clockwise (a step turns her front from her bow to starboard, as
    // quatAngleAxis about up turns +z to +x); her bow up in a tall plan, laid bow to the right in a wide one - a click
    // set where it falls either way
    for (const [size, laid, extra] of [[{ w: 400, h: 400 }, false, 0], [{ w: 1000, h: 300 }, true, Math.PI / 2]]) {
      const d = fakeDoc(size);
      const w3 = mountDeckPlanWindow(d.createElement('div'), { name: 'Gull', deck, fittings: [{ m: 41812, x: 1, z: 1, yaw: 4 }], save: () => ({ ok: true }), doc: d });
      assert.equal(w3.model().laid, laid);
      assert.ok(d.turns.length && d.turns.every((a) => Math.abs(a - (Math.PI / 2 + extra)) < 1e-9), `a quarter turn clockwise${laid ? ', and the quarter she is laid' : ''}`);
      w3.choose(41820);
      w3.clickAt(-1.5, 3);
      assert.deepEqual(w3.model().list.map((f) => [f.m, f.x, f.z]), [[41812, 1, 1], [41820, -1.5, 3]], 'set where it falls');
      w3.clickAt(1, 1);
      assert.equal(w3.model().picked, 0, 'a click on one takes it up');
      w3.key('Escape');
    }
  } finally {
    globalThis.addEventListener = saved.add; globalThis.removeEventListener = saved.rem; globalThis.setInterval = saved.si; globalThis.clearInterval = saved.ci;
  }
  assert.equal(fittingName(41812), 'Chest 2');
  assert.equal(fittingName(41816), 'Crate 2');
});

test('SHIP-LIVERY the paint\'s picture and words: a hull in her strake, her trim and her sail - her own colours where none is chosen, a stained hull\'s wood stained, a rowboat no sail; each paint named, none "As built" (mutants: each colour read)', () => {
  const hex = (rgb) => `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  const svg = paintSvg(2, { strake: 4, accent: 11, sail: 3 });
  for (const i of [4, 11, 3]) assert.ok(svg.includes(hex(SHIP_PAINTS[i].rgb)), SHIP_PAINTS[i].id);
  assert.ok(paintSvg(2, null).includes(hex(C.oxblood)), 'her own strake as built');
  assert.ok(!paintSvg(0, { stain: 3 }).includes('<path d="M78 14'), 'a rowboat carries no sail');
  assert.notEqual(paintSvg(3, { stain: 3 }), paintSvg(3, null), 'a stain colours her wood');
  assert.deepEqual([paintName(0), paintName(4), paintName(11)], ['As built', 'Navy', 'White lead']);
});
