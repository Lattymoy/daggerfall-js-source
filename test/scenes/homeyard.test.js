// HOME-YARD (2026-09-30, asked: "allowing for prop placement on the outside within the limits of their house"). PIECES
// OUTSIDE A HOME, ON ITS OWN LOT. The law (net/decorLaw.js decorYardPieceOf - a catalogue piece, holding nothing,
// giving no light, within the yard's bound); the lot (scenes/homeYards.js - the footprint and its margin, never the
// house nor another building's ground, its edge marked); the service through the real Worker (a yard's pieces and a
// room's counted apart, the room's list its own, the town's yards read together); the town's yards stood in their
// pixels and stood again when the world recentres; the decorator outside - the owner's lot found under their feet, a
// piece off it refused, the service asked with `yard`; the world host by source. `06-Systems/Online-Arc.md` HOME-YARD.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DECOR_YARD_CAP, DECOR_YARD_POS_MAX, decorYardPlaceOf, decorYardPieceOf, DECOR_CAP } from '../../src/net/decorLaw.js';
import {
  yardLot, yardWhyNot, yardHolds, yardLotQuads, createHomeYards, YARD_MARGIN, YARD_OFF_LOT, YARD_IN_HOUSE, YARD_ON_OTHER, YARD_DRAW_M,
} from '../../src/scenes/homeYards.js';
import { standService, T0 } from '../accountDb.mjs';
import { decorWhyNot } from '../../src/ui/decorPanel.js';
import { toolRig, fakeDoc, fakeWin, fakeBlocks, rmb, TOWN, settle } from '../decorFakes.mjs';
import { DECOR_LOT_MARKS } from '../../src/scenes/decor/decorTool.js';   // FB1001 ROAD-LOT (PIN MOVED): the lot's edge is marked in as many bands as it has sides
import { hostText } from '../hostText.mjs';   // HOST-SPLIT 2: the world host whole

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const piece = (over = {}) => ({ id: 'yard1', model: 41000, flat: null, pos: [8, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 120, ...over });

test('HOME-YARD the law: a yard\'s piece is a catalogue piece within the yard\'s bound that holds nothing, serves no craft and gives no light; one\'s own item stands in no yard; the caps (mutants: storage outside; a light outside; the bound; one\'s own item)', () => {
  assert.deepEqual([DECOR_YARD_CAP, DECOR_YARD_POS_MAX], [60, 48]);
  assert.ok(decorYardPieceOf(piece()));
  assert.equal(decorYardPieceOf(piece({ storage: true })), null, 'nothing held outside');
  assert.equal(decorYardPieceOf(piece({ light: { color: [1, 1, 1], range: 5, intensity: 1 } })), null, 'no light outside');
  assert.equal(decorYardPieceOf(piece({ station: 'forge' })), null);
  assert.equal(decorYardPieceOf(piece({ pos: [DECOR_YARD_POS_MAX + 1, 0, 0] })), null, 'within the yard\'s bound');
  assert.equal(decorYardPieceOf(piece({ model: null, flat: [204, 1], paid: 0, item: { t: 1 } })), null, 'one\'s own item stands in no yard');
  assert.ok(decorYardPlaceOf({ pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 20 }));
});

test('HOME-YARD the lot: the house\'s footprint and YARD_MARGIN round it, from the building\'s own place; a piece off it, in the house (on its roof too) or on another building\'s ground refused; the owner stands on it (or near it); its edge four upright bands on the ground (mutants: the margin; the house let in; another building\'s ground let in; the bands\' height)', () => {
  const origin = [100, 5, 200];
  const lot = yardLot(origin, [96, 5, 197, 104, 11, 203]);
  assert.deepEqual(lot.house, [-4, -3, 4, 3]);
  assert.deepEqual(lot.lot, [-4 - YARD_MARGIN, -3 - YARD_MARGIN, 4 + YARD_MARGIN, 3 + YARD_MARGIN]);
  assert.equal(lot.y, 0);
  assert.equal(yardWhyNot([6, 0, 0], lot), null, 'in the yard');
  assert.equal(yardWhyNot([11, 0, 0], lot), YARD_OFF_LOT);
  assert.equal(yardWhyNot([0, 6, 0], lot), YARD_IN_HOUSE, 'on its roof is in its footprint');
  assert.equal(yardWhyNot([7, 0, -8], lot, [[5, -9, 9, -6]]), YARD_ON_OTHER);
  assert.equal(yardWhyNot(null, lot), YARD_OFF_LOT);
  // AUDIT: a full yard is said to be a yard's, never "this room"
  assert.equal(decorWhyNot({ price: 10, ready: true, gold: 100, count: DECOR_YARD_CAP, cap: DECOR_YARD_CAP, yard: true }), `Your yard already holds ${DECOR_YARD_CAP} pieces.`);
  assert.equal(decorWhyNot({ price: 10, ready: true, gold: 100, count: 3, cap: 3 }), 'This room already holds 3 pieces.');
  // AUDIT: the ground a piece covers, not its middle alone - a long piece whose middle stands in the yard but whose end
  // is in the house, past the lot's edge or on a neighbour's ground
  const long = [[-1.5, -0.2], [1.5, -0.2], [1.5, 0.2], [-1.5, 0.2]];
  assert.equal(yardWhyNot([6, 0, 0], lot, [], long), null, 'all of it in the yard');
  assert.equal(yardWhyNot([9.5, 0, 0], lot, [], long), YARD_OFF_LOT, 'its end past the edge');
  assert.equal(yardWhyNot([5.2, 0, 0], lot, [], long), YARD_IN_HOUSE, 'its end through the wall');
  assert.equal(yardWhyNot([7, 0, -5], lot, [[5, -9, 9, -6]], [[0, -1.2], [0, 1.2]]), YARD_ON_OTHER, 'its end on a neighbour\'s ground');
  assert.equal(yardLot(origin, [0, 0, 0, 0, 0, 0]), null, 'no footprint, no lot');
  assert.equal(yardHolds(lot, origin, [109, 5, 200]), true);
  assert.equal(yardHolds(lot, origin, [111, 5, 200]), false);
  assert.equal(yardHolds(lot, origin, [111, 5, 200], 2), true, 'near enough to open it');
  const q = yardLotQuads(lot, origin);
  assert.equal(q.length, 4);
  assert.deepEqual(q[0].pos, [100, 5.5, 191], 'the south edge, standing on the ground');
  assert.equal(q[0].stretch * q[0].size, 20, 'the whole edge');
  assert.deepEqual(q[1].right, [0, 0, 1]);
});

test('HOME-YARD the service: a yard\'s piece placed with `yard`, under its own cap and law - the room\'s list never shows it and the room\'s cap never counts it; the town\'s yards read by anyone, each home\'s by its key; a yard piece moved stays a yard\'s; storage outside refused (mutants: the flag unread; one cap for both; the room listing the yard; the move unguarded)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService();
  const owner = await svc.registered('Olga');
  const o = await svc.seatHome(owner, { mapId: 7, buildingKey: 300, region: 17, price: 5000 });
  const at = () => ({ id: o.character, ...svc.env.DB._raw.prepare('SELECT lease, seq FROM realm_characters WHERE id = ?').get(o.character) });
  const place = (body) => svc.call('/v1/homes/decor/place', { mapId: 7, buildingKey: 300, character: o.character, realm: at(), ...body }, owner.secret);
  const y = await place({ piece: piece(), yard: true });
  assert.equal(y.status, 200, JSON.stringify(y.body));
  const inside = await place({ piece: piece({ id: 'room1' }) });
  assert.equal(inside.status, 200);
  assert.equal((await place({ piece: piece({ id: 'yard2', storage: true }), yard: true })).body.error, 'bad-decor', 'nothing held outside');
  const room = await svc.call('/v1/homes/decor', { mapId: 7, buildingKey: 300 }, owner.secret);
  assert.deepEqual(room.body.pieces.map((p) => p.id), ['room1'], 'the room\'s own list');
  const g = await svc.guest();
  const yards = await svc.call('/v1/homes/yards', { mapId: 7 }, g.secret);
  assert.equal(yards.status, 200);
  assert.deepEqual(yards.body.yards.map((x) => [x.buildingKey, x.pieces.map((p) => p.id)]), [[300, ['yard1']]], 'the town\'s yards, a guest too');
  const moved = await svc.call('/v1/homes/decor/move', { mapId: 7, buildingKey: 300, character: o.character, id: 'yard1', place: { pos: [9, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: true, paid: 120 } }, owner.secret);
  assert.equal(moved.body.error, 'bad-decor', 'a yard piece stays a yard\'s');
  // the caps apart: the yard's full at its own cap, the room's still open
  const raw = svc.env.DB._raw;
  const ins = raw.prepare('INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at, paid, yard) VALUES (7, 300, ?, 41000, ?, ?, 0, 1)');
  for (let i = 0; i < DECOR_YARD_CAP - 1; i++) ins.run(`y${i}`, JSON.stringify({ pos: [8, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0 }), T0);
  const full = await place({ piece: piece({ id: 'yardX' }), yard: true });
  assert.equal(full.body.error, 'yard-cap', 'the yard\'s own cap, in its own words');
  const roomStill = await place({ piece: piece({ id: 'room2' }) });
  assert.equal(roomStill.status, 200, 'the room\'s cap never counts the yard');
  assert.ok(DECOR_CAP > DECOR_YARD_CAP);
});

/** A fake world: one town pixel at 0,0 translated `t`, a home (key 300) whose frame stands at 10, 0, 10 with a footprint
 *  8 by 6, and a neighbour (key 301) east of it. */
function world({ own = true, pieces = [piece()] } = {}) {
  const t = [0, 0, 0];
  const homeFrames = new Map([[300, { at: [10, 0, 10], box: [6, 0, 7, 14, 6, 13] }], [301, { at: [30, 0, 10], box: [26, 0, 7, 34, 6, 13] }]]);
  const built = new Map([['0,0', { px: 0, py: 0, homeTown: 7, homeFrames, homeRegion: 17 }]]);
  const buckets = [];
  const puts = [];
  const writes = [];
  const api = {
    yards: async () => ({ ok: true, data: { yards: [{ buildingKey: 300, pieces }] } }),
    place: async (b) => { writes.push(['place', b]); return { ok: true, data: { piece: b.piece } }; },
    move: async (b) => { writes.push(['move', b]); return { ok: true, data: {} }; },
    remove: async (b) => { writes.push(['remove', b]); return { ok: true, data: {} }; },
  };
  const homes = { homeAt: (m, k) => (k === 300 ? { owner: 'Olga', own, look: null } : k === 301 ? { owner: 'Tomas', own: false } : null) };
  const feet = { at: [18, 0, 10] };
  const collider = {
    addMesh: (k, pos, idx, m) => buckets.push([k, m[12], m[14]]), removeBucket: () => {},
    surfaceHit: (o, d) => { const dist = d[1] < 0 ? o[1] / -d[1] : Infinity; return { dist, normal: [0, 1, 0] }; },
  };
  const renderer = { drawMesh: (g, m) => puts.push(m[12]), createBillboardBatch: () => ({}), destroyBillboardBatch() {} };
  const gold = { n: 5000 };
  const doc = fakeDoc();
  const yards = createHomeYards({
    api, homes, built: () => built, translation: () => t, feet: () => feet.at, outside: () => true, eye: () => [feet.at[0], 1.6, feet.at[2]],
    collider: () => collider, meshes: { getGpuMesh: async (id) => id, cpuModels: new Map([[41000, { positions: new Float32Array([-0.5, 0, -0.5, 0.5, 1, 0.5]), indices: new Uint32Array([0, 1, 0]) }]]) },
    renderer, getTexture: async () => ({ recordCount: 1 }), uploadRecord() {},
    scanDeps: () => ({ blocks: fakeBlocks([{ type: TOWN, block: rmb([41000]) }]), isTownBlock: (x) => x === TOWN, modelRadius: () => 0.8, flatRadius: async () => 0.2 }),
    character: () => 'r0123456789abcdef0123', realm: () => null,
    wallet: () => ({ get gold() { return gold.n; }, pay: (n) => { gold.n -= n; }, credit: (n) => { gold.n += n; } }), regionOf: () => 17,
    doc, win: fakeWin(), canvas: null, touch: false, actionOf: () => null, locked: () => true, cursorOff() {}, stick: () => null,
    say() {}, refusal: (w) => w, openSlot() {}, now: () => 0,
  });
  return { yards, built, t, buckets, puts, writes, feet, homeFrames, api, doc, gold };
}
const cam = { pos: [18, 1.6, 10], yaw: Math.PI, pitch: -0.6 };

test('HOME-YARD a yard stood again under the open decorator (its pixel built anew - a painted home leaving the merge, a season) puts the decorator away with it, and the yard it opens on next is the one standing, never the one taken down (mutant: the dead yard held)', async () => {
  const w = world({ pieces: [piece({ id: 'old1', pos: [7, 0, 0] }), piece({ id: 'old2', pos: [-7, 0, 0] })] });
  for (let i = 0; i < 3; i++) { w.yards.frame({ dt: 1, cam, overlayUp: false }); await settle(); await settle(); }
  const before = w.yards.here().yard;
  assert.equal(before.pool.list().length, 2);
  assert.equal(w.yards.tool().openPanel(), true);
  const frame = w.built.get('0,0');
  w.built.clear();   // torn down while the panel is up...
  w.yards.frame({ dt: 1, cam, overlayUp: true }); await settle();
  assert.equal(w.yards.here(), null, 'no yard to write into: the decorator put away');
  assert.equal(w.yards.tool().panelOpen(), false);
  w.built.set('0,0', { ...frame });   // ...and stood again
  for (let i = 0; i < 3; i++) { w.yards.frame({ dt: 1, cam, overlayUp: false }); await settle(); await settle(); }
  assert.equal(w.yards.here().yard, w.yards.yards()[0], 'the owner\'s yard is the one standing');
  assert.notEqual(w.yards.here().yard, before, 'never the one taken down');
  assert.equal(w.yards.here().yard.pool.list().length, 2, 'all of it, as the town holds it');
});


test('HOME-YARD the town\'s yards stand in their pixels: each home\'s pieces read with the town and stood where its frame stands (the building\'s own place, in the scene), drawn, and stood again where they stand when the world recentres; a pixel gone takes its yards down (mutants: the frame\'s place; the recentre ignored; a yard kept past its pixel)', async () => {
  const w = world({ own: false });
  w.yards.frame({ dt: 1, cam, overlayUp: false });
  await settle(); await settle();
  w.yards.frame({ dt: 1, cam, overlayUp: false });
  await settle(); await settle();
  const ys = w.yards.yards();
  assert.equal(ys.length, 1, 'the one home with pieces');
  assert.deepEqual(w.buckets.at(-1), ['decor:yard1', 18, 12], 'at its frame (10, 0, 10) and its place (8, 0, 2)');
  w.yards.draw();
  assert.ok(w.puts.includes(18), 'drawn in the world\'s pass');
  // AUDIT: a yard far from the eye is not drawn at all
  const at = w.feet.at;
  w.feet.at = [at[0] + YARD_DRAW_M + 50, 0, at[2]];
  w.yards.frame({ dt: 0.016, cam, overlayUp: false });
  w.puts.length = 0;
  w.yards.draw();
  assert.equal(w.puts.includes(18), false, 'beyond YARD_DRAW_M');
  w.feet.at = at;
  w.yards.frame({ dt: 0.016, cam, overlayUp: false });
  w.t[0] = -100;   // the world recentres
  w.yards.frame({ dt: 0.016, cam, overlayUp: false });   // AUDIT: the very frame it does - never half a second in the old place
  await settle(); await settle();
  assert.deepEqual(w.buckets.at(-1), ['decor:yard1', -82, 12], 'stood again where it stands');
  w.built.clear();
  w.yards.frame({ dt: 1, cam, overlayUp: false });
  assert.equal(w.yards.yards().length, 0, 'down with its pixel');
});

test('HOME-YARD the decorator outside: the owner\'s own lot found under their feet (never another\'s, never off it); the panel is a yard\'s - no doors in its catalogue; a piece off the lot is refused and said, in the yard it is placed with `yard` on the service, paid, and stands (mutants: another\'s lot; the lot unread; the flag unsent; the door in the yard)', async () => {
  const w = world({ own: true, pieces: [] });
  w.yards.frame({ dt: 1, cam, overlayUp: false });
  await settle(); await settle();
  w.yards.frame({ dt: 1, cam, overlayUp: false });
  const here = w.yards.here();
  assert.ok(here, 'the owner stands on their lot');
  assert.equal(here.yard.bk, 300);
  assert.deepEqual(here.others, [[16, -3, 24, 3]], 'the neighbour\'s ground, in the lot\'s frame');
  const tool = w.yards.tool();
  assert.equal(tool.openPanel(), true);
  for (let i = 0; i < 8; i++) { w.yards.frame({ dt: 0.1, cam, overlayUp: true }); await settle(); }
  // the chair, placed from the yard: the eye looks down and south, onto the yard east of the house
  const panelOf = () => w.doc.body.children.find((c) => c.className === 'dfdecor');
  const walk = (n, f) => { f(n); for (const k of n.children ?? []) walk(k, f); };
  walk(panelOf(), (n) => { if (n.dataset?.key === 'm41000') n.fire('click'); });
  walk(panelOf(), (n) => { if (n.tag === 'button' && n.textContent === 'Place') n.fire('click'); });
  for (let i = 0; i < 6 && !tool.ghost(); i++) { w.yards.frame({ dt: 0.1, cam, overlayUp: false }); await settle(); }
  const ghost = tool.ghost();
  assert.ok(ghost, 'the ghost stands in the yard');
  assert.equal(tool.why(), null, 'on the lot: nothing stands in its way');
  assert.equal(await tool.commit(), true, 'placed');
  const sent = w.writes.find((x) => x[0] === 'place')[1];
  assert.equal(sent.yard, true, 'the service asked with `yard`');
  assert.deepEqual([sent.mapId, sent.buildingKey], [7, 300]);
  assert.equal(w.gold.n, 5000 - ghost.paid, 'paid');
  assert.equal(here.yard.pool.list().length, 1, 'and it stands in the yard');
  // off the lot: the ghost's reason is the lot's
  const off = { ...piece(), pos: [30, 0, 0] };
  assert.equal(yardWhyNot(off.pos, here.yard.lot, here.others), YARD_OFF_LOT);
  const rig = toolRig({ room: { kind: 'home', yard: true, where: 'Your yard', mapId: 7, buildingKey: 300 }, placeOk: (p) => yardWhyNot(p.pos, here.yard.lot, here.others), lot: () => yardLotQuads(here.yard.lot, [10, 0, 10]), yardCap: DECOR_YARD_CAP, doors: [0] });
  rig.frame();
  rig.tool.openPanel();
  for (let i = 0; i < 6; i++) { rig.frame({ overlayUp: true }); await settle(); }
  const panel = rig.doc.body.children.find((c) => c.className === 'dfdecor');
  const rowKeys = [];
  (function walk(n) { if (String(n.className).split(/\s+/).includes('dfdecor-row')) rowKeys.push(n.dataset.key); for (const k of n.children ?? []) walk(k); })(panel);
  assert.equal(rowKeys.includes('m9000'), false, 'no door in a yard');
  assert.ok(rowKeys.includes('m41000'));
  (function walk(n) { if (n.dataset?.key === 'm41000') n.fire('click'); for (const k of n.children ?? []) walk(k); })(panel);
  (function walk(n) { if (n.tag === 'button' && n.textContent === 'Place') n.fire('click'); for (const k of n.children ?? []) walk(k); })(panel);
  rig.frame(); await settle(); rig.frame();
  // the rig's eye meets a surface 2 m ahead of (10, 1.6, 10), facing +z: in the house's footprint here
  assert.equal(rig.tool.why(), YARD_IN_HOUSE, 'refused where it cannot stand');
  assert.equal(await rig.tool.commit(), false);
  assert.ok(rig.decals.some((d) => d.cap === DECOR_LOT_MARKS && d.writes.length), 'the lot\'s edge marked');   // FB1001 ROAD-LOT: PIN MOVED - four sides, and the road's
});

test('HOME-YARD the world host by source: each building\'s own place and footprint recorded at the build, the yards made online alone, brought in line every frame (stood down indoors), their models, flats and lot marks in the world\'s passes, the free eye and the stick the decorator\'s while it flies, and the service\'s writes carry `yard` (mutants: the frame unrecorded; the pass unwired; the flag lost)', () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /const at = Array\.isArray\(placed\.recordAt\) \? \[locLocal\[0\] \+ b\.originX \+ placed\.recordAt\[0\]/);
  assert.match(w, /homeFrames: pixelHomeFrames, homeRegion: dfLocation\?\.regionIndex \?\? 0,/);
  assert.match(w, /const yards = homeDecor && onlineHomes \? createHomeYards\(\{/);
  const frameFn = w.indexOf('  function frame(now) {');
  const modal = w.indexOf('    if (modes.frame(dt, now)) {', frameFn);
  const yardsAt = w.indexOf('    yards?.frame({ dt, cam, overlayUp: !!townTalk.overlayActive });', frameFn);
  assert.ok(frameFn > 0 && yardsAt > frameFn && yardsAt < modal, 'in the frame, above the modal return: stood down indoors');
  assert.match(w, /yards\?\.draw\(renderer\);/);
  assert.match(w, /if \(yards\) for \(const b of yards\.batches\(\)\)/);
  assert.match(w, /yards\?\.drawDecals\(renderer\);/);
  assert.match(w, /seaReach: csaHelm \? csaSeaReach\(csaHelm\) : 0,[^\n]*\n\s*\}\);\n\s*if \(yards\?\.flying\(\)\) \{ const c = \{ pos: mwv0\.eye \}; yards\.cameraOverride\(c\); mwv0\.eye = c\.pos; \}/, 'the frame\'s own eye, before any reader of it');
  assert.match(w, /if \(yards\?\.flying\(\)\) mv\.analog = null;/);
  // AUDIT: a finger under the yard's flight neither presses nor swings
  assert.match(w, /if \(modes\?\.decorFlying\?\.\(\) \|\| yards\?\.flying\(\)\) return;/);
  assert.match(w, /if \(yards\?\.flying\(\)\) \{ swipeHeld = false; return; \}/);
  const y = src('src/scenes/homeYards.js');
  assert.match(y, /place: \(a\) => deps\.api\.place\(\{ \.\.\.a, yard: true \}\),/);
  assert.match(src('src/world/rmbLayout.js'), /recordAt: \[subRecordMatrix\[12\], subRecordMatrix\[13\], subRecordMatrix\[14\]\],/);
  assert.match(src('src/net/accountClient.js'), /yards: \(mapId\) => waited\('\/v1\/homes\/yards', \{ mapId \}\),/);
});
