// FIELD BUGS 2026-10-16b STALL-SHAPE (Discord, 2026-10-15 9:59 PM: "market stalls all shifted into the ground/walls",
// "at least the lawn decoration owns" - a stall's awning low over the street, a stall-keeper standing inside it; a red
// awning against a wall, its counter half buried).
//
// TEMPLE-STEPS (FIELD BUGS 2026-10-15f) stood the RMB Resource Pack's stalls at their prefabs' 0.75 about Unity's own
// origin - the box right, the shape inside it the port's guess: a counter 0.75 m high at the front's foot (the author's
// goods 0.3 m over it), the awning's low edge at 1.84 m, and a bench 0.53 m high where the stall-keeper stands; the
// pack's second stall (53113 on, no counter) given the counter all the same, over the goods its author laid on the
// ground. And a yard's saved stall or boulder is a record of where its model's origin stands, worked out against the
// stand-in as it stood: TEMPLE-STEPS' new origins moved every one - the stalls 2 m back into the walls their owners stood
// them against, a quarter smaller, the boulders two to eight times bigger.
//
// The stand-in is now the pack's stall, measured off its FBX (world/townStandIns.js RMBRP_STALL_FRAME), its second
// mesh its own; a yard's saved pieces are re-seated by the account service's migration 0121 (tools/yardReseat.mjs).
// No game data here: the packs' records are carried whole in the vendored packs; the yards are the real service's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import zlib from 'node:zlib';

import { ROW_CODECS } from '../../src/formats/worldData/worldDataPack.js';
import { blockFromJson } from '../../src/formats/worldData/worldDataReplacement.js';
import { layoutRmbBlock } from '../../src/world/rmbLayout.js';
import { collectMiscFlats } from '../../src/world/rmbFlats.js';
import { isNpcFlat } from '../../src/world/npcFlatArchives.js';
import {
  RMBRP_PIECES, RMBRP_STALLS, RMBRP_STALL_SCALE, RMBRP_STALL_FRAME, RMBRP_STALL_OPEN_FIRST, RMBRP_STALL_OPEN_SHIFT, RMBRP_ROCKS, RMBRP_ROCK_SCALE,
} from '../../src/world/townStandIns.js';
import { localAabb, transformedAabb } from '../../src/render/frustum.js';
import { decorMatrix } from '../../src/scenes/decor/decorRoom.js';
import { createDecorPlacer, DECOR_WALL_CLIP } from '../../src/systems/decor/decorPlacer.js';
import { DECOR_SCALE_MIN } from '../../src/net/decorLaw.js';
import { placedSolid, depthInside, TOUCH_M } from '../../tools/townSolidsSweep.mjs';
import {
  reseatSql, reseatPlace, reseatMove, reseatRestored, YARD_RESEATS, YARD_RESEAT_AT, YARD_RESEAT_FILE, YARD_RESEAT_MARK, STALL_BOX_WD3, STALL_BOX_NOW, OPEN_STALL_BOX_NOW,
  COUNTER_STALLS, OPEN_STALLS, ROCK_BOX_WD3, ROCK_BOX_NOW, ROCK_K, STALL_K,
} from '../../tools/yardReseat.mjs';
import { standService, T0 } from '../accountDb.mjs';

const S = RMBRP_STALL_SCALE;
const near = (a, b, e = 1e-4) => Math.abs(a - b) <= e;
const reseatMoveDy = (r, place) => reseatMove(r, place.scale, place.rot[0]).d[1];
const verts = (m) => { const P = []; for (let i = 0; i < m.positions.length; i += 3) P.push([m.positions[i], m.positions[i + 1], m.positions[i + 2]]); return P; };
const tris = (m) => { const P = verts(m), T = []; for (let t = 0; t < m.indices.length; t += 3) T.push([P[m.indices[t]], P[m.indices[t + 1]], P[m.indices[t + 2]]]); return T; };
const ID = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const inside2 = ([x0, x1], [z0, z1], x, z) => x >= x0 - 1e-6 && x <= x1 + 1e-6 && z >= z0 - 1e-6 && z <= z1 + 1e-6;
/** The highest face of the mesh over (x, z) at or under `y`, or -Infinity. */
function faceUnder(T, x, z, y) {
  let best = -Infinity;
  for (const [a, b, c] of T) {
    const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(d) < 1e-12) continue;
    const l1 = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d, l2 = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d, l3 = 1 - l1 - l2;
    if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) continue;
    const h = l1 * a[1] + l2 * b[1] + l3 * c[1];
    if (h <= y + 1e-6 && h > best) best = h;
  }
  return best;
}

// ---- the stand-in ---------------------------------------------------------------------------------------------------
test('STALL-SHAPE: the stand-in is the pack\'s stall, measured off its FBX - posts 0.375 m square, a beam and a lintel, the awning between their tops, its counter\'s top 1.04 m over the origin, the front\'s headroom 2.17 m, nothing low but the posts and the counter (no bench); the second mesh (53113 on) the same frame shifted, no counter', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(RMBRP_STALL_FRAME)), {
    back: [-2.75, -2.382], front: [-0.257, 0.118], sides: [[-2.48, -2.105], [2.02, 2.4]], tops: [4.4, 3.638],
    beam: [3.76, 4.138], lintel: [3.01, 3.388], valance: 0.5, counter: { x: [-1.07, 0.4], z: [-1.792, 1.708], top: 1.388 },
  });
  assert.equal(RMBRP_STALL_OPEN_FIRST, 53113);
  assert.deepEqual([...RMBRP_STALL_OPEN_SHIFT], [-0.2, 0.206, 0.066]);
  const F = RMBRP_STALL_FRAME;
  for (const [id] of Object.entries(RMBRP_STALLS)) {
    const open = Number(id) >= RMBRP_STALL_OPEN_FIRST, [dx, dy, dz] = open ? RMBRP_STALL_OPEN_SHIFT : [0, 0, 0];
    const mesh = RMBRP_PIECES[id](), P = verts(mesh), T = tris(mesh);
    const posts = [F.back, F.front].flatMap((x) => F.sides.map((z) => [x.map((v) => (v + dx) * S), z.map((v) => (v + dz) * S)]));
    const counter = [F.counter.x.map((v) => v * S), F.counter.z.map((v) => v * S)];
    // nothing under 1.5 m but a post's or the counter's
    for (const [x, y, z] of P) {
      if (y >= 1.5) continue;
      assert.ok(posts.some(([px, pz]) => inside2(px, pz, x, z)) || (!open && inside2(counter[0], counter[1], x, z)), `${id}: (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}) - a post's or the counter's (no bench)`);
    }
    // every post stands on the origin
    for (const [px, pz] of posts) assert.ok(near(Math.min(...P.filter(([x, , z]) => inside2(px, pz, x, z)).map((p) => p[1])), 0, 1e-6), `${id}: the post at ${px} on the origin`);
    assert.ok(near(Math.min(...P.map((p) => p[1])), 0, 1e-6), `${id}: on the origin`);
    // the counter's top (where the author lays the goods), or none
    const top = faceUnder(T, -0.25, 0, 2);
    assert.ok(open ? top === -Infinity : near(top, 1.388 * S, 1e-5), `${id}: the counter's top ${top}`);
    // the lowest thing over the stall's head - the lintel's fringe at the front
    const over = Math.min(...P.map((p) => p[1]).filter((y) => y > 1.5));
    assert.ok(near(over, (3.388 - 0.5 + dy) * S, 1e-5), `${id}: the front's headroom ${over}`);
    // the awning: from the beam's top down to the lintel's
    assert.ok(near(Math.max(...P.filter(([x]) => near(x, (F.back[1] + dx) * S, 1e-5)).map((p) => p[1])), (F.tops[0] + dy) * S, 1e-5), `${id}: the back posts' tops`);
    const box = localAabb(mesh.positions);
    assert.deepEqual([...box].map((v) => +v.toFixed(4)), [...(open ? OPEN_STALL_BOX_NOW : STALL_BOX_NOW)], `${id}: its box`);
  }
  assert.ok(near(1.388 * S, 1.041, 1e-9) && near((3.388 - 0.5) * S, 2.166, 1e-9));
});

// ---- the author's own stalls ----------------------------------------------------------------------------------------
const packs = Object.fromEntries(['beautiful-villages', 'beautiful-cities'].map((v) => [v, JSON.parse(zlib.gunzipSync(readFileSync(new URL(`../../vendor/${v}/WorldDataPack/${v}.pack.json.gz`, import.meta.url))).toString('utf8'))]));
const Pj = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
function whole(pack, name, key) {
  const nodes = (pack._nodes ??= pack.nodes.map(Pj));
  const expand = (v) => {
    if (Array.isArray(v)) return v.map(expand);
    if (!v || typeof v !== 'object') return v;
    const keys = Object.keys(v);
    assert.ok(!keys.includes('$c') && !keys.includes('$o'), `${name}: a record carried whole, not read from the player's BLOCKS.BSA`);
    if (v.$n !== undefined) return expand(nodes[v.$n]);
    const k = keys.find((kk) => ROW_CODECS[kk]);
    if (k) return v[k].map((row) => (Array.isArray(row) || typeof row === 'number' ? ROW_CODECS[k](row) : expand(row)));
    return Object.fromEntries(keys.map((kk) => [kk, expand(v[kk])]));
  };
  for (let n = `${name}.json`; n;) {
    const [, base, ops] = Pj(pack.files[n]);
    const op = ops.find((o) => o[0] === 's' && o[1].join('.') === `RmbBlock.${key}`);
    if (op) return expand(op[2]).filter(Boolean);
    n = base[0] === 'f' ? base[1] : null;
  }
  return [];
}
/** Every stall the two packs lay, with the author's flats in its own frame. */
function laidStalls() {
  const out = [];
  for (const pack of Object.values(packs)) {
    for (const f of Object.keys(pack.files)) {
      if (!f.endsWith('.RMB.json')) continue;
      const name = f.slice(0, -5), misc = whole(pack, name, 'Misc3dObjectRecords');
      if (!misc.some((r) => RMBRP_STALLS[r.ModelIdNum])) continue;
      const blk = blockFromJson({ Name: name, RmbBlock: { FldHeader: {}, SubRecords: [], Misc3dObjectRecords: misc, MiscFlatObjectRecords: whole(pack, name, 'MiscFlatObjectRecords') } }, 9300);
      const flats = collectMiscFlats(blk).filter((fl) => !fl.editor);
      for (const s of layoutRmbBlock(blk).models.filter((m) => RMBRP_STALLS[m.modelIdNum])) {
        const M = s.matrix, o = [M[12], M[13], M[14]];
        const local = (p) => { const d = [p[0] - o[0], p[1] - o[1], p[2] - o[2]]; return [d[0] * M[0] + d[1] * M[1] + d[2] * M[2], d[1], d[0] * M[8] + d[1] * M[9] + d[2] * M[10]]; };
        out.push({ block: name, id: s.modelIdNum, flats: flats.map((fl) => ({ archive: fl.archive, record: fl.record, npc: isNpcFlat(fl.archive), at: local([fl.x, fl.y, fl.z]) })) });
      }
    }
  }
  return out;
}
/** The tallest stall-keeper the author stood at a stall (357.1, RESIAS02's 53101 - read off the player's TEXTURE.357). */
const KEEPER_M = 2.25;

test('STALL-SHAPE: the author\'s own stalls - 32 in Beautiful Villages\' four markets: 126 of the goods laid at them rest on a counter\'s top (two lamps of 211.11 hang 0.21 m over it, as over the pack\'s own), none stands inside the stand-in, those of the second mesh lie on the ground under it, and no stall-keeper\'s 2.25 m meets any of it', () => {
  const stalls = laidStalls();
  assert.equal(stalls.length, 32);
  assert.equal(stalls.filter((s) => s.id >= RMBRP_STALL_OPEN_FIRST).length, 15, 'the second mesh\'s');
  let resting = 0, hanging = 0, ground = 0, keepers = 0;
  for (const s of stalls) {
    const mesh = RMBRP_PIECES[s.id](), solid = placedSolid(mesh, ID), T = tris(mesh), { lo, hi } = solid;
    for (const { archive, record, npc, at: [x, y, z] } of s.flats) {
      if (x < lo[0] || x > hi[0] || z < lo[2] || z > hi[2]) continue;
      const where = `${s.block} ${s.id} ${archive}.${record} at (${x.toFixed(2)}, ${y.toFixed(3)}, ${z.toFixed(2)})`;
      if (npc) {
        keepers++;
        for (let h = 0.1; h <= KEEPER_M + 1e-9; h += 0.05) assert.equal(depthInside(solid, [x, y + h, z]), 0, `${where}: the keeper clear at ${h.toFixed(2)} m`);
        assert.ok(faceUnder(T, x, z, y + KEEPER_M) <= y + 0.1, `${where}: nothing over the keeper under ${KEEPER_M} m`);
        continue;
      }
      assert.equal(depthInside(solid, [x, y + 0.02, z]), 0, `${where}: never inside the stand-in`);
      const under = faceUnder(T, x, z, y + TOUCH_M);
      if (under === -Infinity) { ground++; continue; }
      if (y - under <= TOUCH_M) { resting++; continue; }
      assert.ok(archive === 211 && record === 11 && near(y - under, 0.209, 0.001), `${where}: ${(y - under).toFixed(3)} m over the stand-in`);
      hanging++;
    }
  }
  assert.deepEqual({ resting, hanging, ground, keepers }, { resting: 126, hanging: 2, ground: 57, keepers: 27 });
});

// ---- a yard's saved pieces --------------------------------------------------------------------------------------------
const SQL = readFileSync(new URL(`../../${YARD_RESEAT_FILE}`, import.meta.url), 'utf8');
const nowBox = (model) => localAabb(RMBRP_PIECES[model]().positions);
const wasBox = (model, before) => (RMBRP_STALLS[model] ? (before ? STALL_BOX_WD3 : STALL_BOX_NOW) : before ? ROCK_BOX_WD3[model] : nowBox(model));
const ORIGIN = [0, 0, 0];
const worldBox = (box, piece) => transformedAabb(box, decorMatrix(piece, ORIGIN));
const middle = (b) => [(b[0] + b[3]) / 2, b[1], (b[2] + b[5]) / 2];

test('STALL-SHAPE: the migration is tools/yardReseat.mjs\' own; the boxes it re-seats to are the live stand-ins\' (a stand-in whose box moves fails here until its saved pieces are re-seated); and its arithmetic is the tool\'s law, turn for turn', async () => {
  assert.equal(SQL, reseatSql(), 'node tools/yardReseat.mjs --write');
  assert.deepEqual(COUNTER_STALLS.concat(OPEN_STALLS).sort(), Object.keys(RMBRP_STALLS).map(Number).sort());
  for (const id of COUNTER_STALLS) assert.deepEqual([...nowBox(id)].map((v) => +v.toFixed(6)), [...STALL_BOX_NOW], `${id}`);
  for (const id of OPEN_STALLS) assert.deepEqual([...nowBox(id)].map((v) => +v.toFixed(6)), [...OPEN_STALL_BOX_NOW], `${id}`);
  assert.equal(STALL_K, RMBRP_STALL_SCALE);
  assert.deepEqual(Object.keys(ROCK_BOX_NOW), Object.keys(RMBRP_ROCKS));
  assert.deepEqual({ ...ROCK_K }, { ...RMBRP_ROCK_SCALE });
  for (const id of Object.keys(RMBRP_ROCKS)) assert.deepEqual([...nowBox(id)].map((v) => +v.toFixed(6)), ROCK_BOX_NOW[id], `${id}`);
  // the statement over a table of every re-seat at every kind of turn and scale, against the tool's own law
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE home_decor (id TEXT, model INTEGER, place TEXT, placed_at INTEGER, yard INTEGER)');
  const rows = [];
  YARD_RESEATS.forEach((r, i) => {
    for (const [yaw, scale] of [[0, 1], [180, 3], [-180, 0.25], [37.5, 4], [-91.3, 1.7], [-15, 2]]) {
      const place = { pos: [((i * 7) % 30) - 15 + 0.125, (i % 4) * 0.75, 12.5 - ((i * 5) % 25)], rot: [yaw, 0, 0], scale, light: null, storage: false, paid: 90 };
      const id = `r${rows.length}`;
      db.prepare('INSERT INTO home_decor VALUES (?, ?, ?, ?, 1)').run(id, r.model, JSON.stringify(place), r.before ? YARD_RESEAT_AT - 1 : YARD_RESEAT_AT);
      rows.push({ id, place, r });
    }
  });
  db.exec(SQL);
  for (const { id, place, r } of rows) {
    const got = JSON.parse(db.prepare('SELECT place FROM home_decor WHERE id = ?').get(id).place), want = reseatPlace(place, r);
    assert.ok(got.pos.every((v, k) => near(v, want.pos[k], 0.0011)) && near(got.scale, want.scale, 1e-9) && got.reseat === YARD_RESEAT_MARK, `${r.model} ${r.before} ${JSON.stringify(place)}: ${JSON.stringify(got)} for ${JSON.stringify(want)}`);
  }
  // STALL-SHAPE's audit: a piece low in its yard is held at the yard's bound going down as well as across - decorPlaceOf
  // drops a place past it on any axis, so a rock of 4 grown to 4 at -47.5 m (its foot 1.24 m lower now) stands at -48
  const sink = YARD_RESEATS.find((r) => r.model === 53035 && r.before);
  const deep = { pos: [0, -47.5, 0], rot: [0, 0, 0], scale: 4, light: null, storage: false, paid: 90 };
  db.prepare('INSERT INTO home_decor VALUES (?, ?, ?, ?, 1)').run('deep', 53035, JSON.stringify(deep), YARD_RESEAT_AT - 1);
  db.exec(SQL);
  assert.ok(near(deep.pos[1] + reseatMoveDy(sink, deep), -48.74, 0.005), 'unheld, it would stand past the bound');
  assert.deepEqual([JSON.parse(db.prepare('SELECT place FROM home_decor WHERE id = ?').get('deep').place).pos[1], reseatPlace(deep, sink).pos[1]], [-48, -48]);
});

/** A home with a yard full of pieces the real placer made against the stand-ins of their day, placed through the real
 *  route - and, beside them, what no re-seat may touch. */
async function furnished(t) {
  let clock = T0;
  t.mock.method(Date, 'now', () => clock * 1000);
  const svc = await standService();
  const owner = await svc.registered('Ysolde');
  const o = await svc.seatHome(owner, { mapId: 7, buildingKey: 300, region: 17, price: 5000 });
  const raw = svc.env.DB._raw;
  const at = () => ({ id: o.character, ...raw.prepare('SELECT lease, seq FROM realm_characters WHERE id = ?').get(o.character) });
  const placed = [];
  /** The placer's piece for a surface `hit` (its `normal`), turned `turns` steps and grown `grows` steps, by the box of its day. */
  const place = async (id, model, { hit, normal = [0, 1, 0], turns = 0, grows = 0, before = true, yard = true }) => {
    const placer = createDecorPlacer({ model, key: `m${model}` }, { radius: 2, box: wasBox(model, before) });
    for (let i = 0; i < Math.abs(turns); i++) placer.turn(Math.sign(turns) * 15);
    for (let i = 0; i < Math.abs(grows); i++) placer.rescale(grows > 0);
    const piece = placer.pieceAt(hit, ORIGIN, id, normal);
    assert.ok(piece, id);
    const res = await svc.call('/v1/homes/decor/place', { mapId: 7, buildingKey: 300, character: o.character, realm: at(), piece, ...(yard ? { yard: true } : {}) }, owner.secret);
    assert.equal(res.status, 200, `${id}: ${JSON.stringify(res.body)}`);
    raw.prepare('UPDATE home_decor SET placed_at = ? WHERE id = ?').run(before ? YARD_RESEAT_AT - 3600 : YARD_RESEAT_AT + 60, id);
    placed.push({ id, model, before, piece });
    return piece;
  };
  await place('counter', 53100, { hit: [6, 0, 5] });
  await place('walled', 53104, { hit: [-4, 1, 8], normal: [1, 0, 0] });                 // stood against a wall at x = -4, its back to it
  await place('turned', 53108, { hit: [3, 0, -9], turns: 3, grows: 2 });
  await place('open', 53118, { hit: [12, 0, 2], turns: -5, grows: 1 });
  await place('openWall', 53121, { hit: [2, 1, -12], normal: [0, 0, 1], turns: -6 });  // against a wall at z = -12, its back to it
  await place('pebble', 53030, { hit: [9, 0, 9] });                                     // a rock of 8: under the law's least scale now
  await place('stone', 53023, { hit: [-8, 0, -3], turns: 2 });                          // a rock of 2
  await place('crag', 53086, { hit: [15, 0, -6], turns: -4, grows: 7 });                // a rock of 4, grown
  await place('since', 53103, { hit: [-10, 0, 12], before: false });                    // TEMPLE-STEPS' counter stall: as it stands
  await place('sinceOpen', 53124, { hit: [-14, 0, 2], turns: 4, before: false });       // TEMPLE-STEPS' open stall: 0.26 m back
  await place('stool', 41000, { hit: [4, 0, -2] });                                     // no stand-in's
  await place('indoors', 53100, { hit: [1, 0, 1], yard: false });                       // a room's (no catalogue offers it one)
  raw.prepare("INSERT INTO home_decor (map_id, building_key, id, model, flat_archive, flat_record, place, placed_at, item, paid, yard) VALUES (7, 300, 'junk', 53100, NULL, NULL, 'not json', 1, NULL, 0, 1)").run();
  const rows = () => Object.fromEntries(raw.prepare('SELECT id, place FROM home_decor').all().map((r) => [r.id, r.place]));
  /** The town's yards as the service answers them - a minute on each time, past the answer it keeps (YARDS_KEPT_S), as
   *  the isolates a deploy stands up answer the first time they are asked. */
  const yards = async () => {
    clock += 60;
    return Object.fromEntries((await svc.call('/v1/homes/yards', { mapId: 7 })).body.yards.flatMap((y) => y.pieces).map((p) => [p.id, p]));
  };
  return { raw, placed, rows, yards };
}

test('STALL-SHAPE: migration 0121 puts a yard\'s saved stalls and boulders back where their owners put them - over the real service\'s rows, placed by the real placer against the stand-ins of their day: the box\'s middle and its foot where they stood, a stall its old size, a boulder its old size (or the law\'s least), a stall stood against a wall clear of it again; TEMPLE-STEPS\' own pieces as they stand (its second stall 0.26 m back), a room\'s, another model\'s and a broken row never asked, and a second run moves nothing', async (t) => {
  const { raw, placed, rows, yards } = await furnished(t);
  const was = await yards();
  // the bug, on the real rows: TEMPLE-STEPS' stall stands its back 2 m into the wall its owner stood it against
  const into = (p, wall, axis) => {
    const M = decorMatrix(p, ORIGIN);
    return Math.max(...verts(RMBRP_PIECES[p.model]()).map(([x, y, z]) => wall - (M[axis] * x + M[4 + axis] * y + M[8 + axis] * z + M[12 + axis])));
  };
  assert.ok(into(was.walled, -4, 0) > 1.5 && into(was.openWall, -12, 2) > 1.5, `before: ${into(was.walled, -4, 0).toFixed(2)} m and ${into(was.openWall, -12, 2).toFixed(2)} m into the walls`);
  const untouched = rows();
  raw.exec(SQL);
  const now = await yards(), after = rows();
  let reseated = 0;
  for (const { id, model, before, piece } of placed) {
    const p = now[id] ?? null;
    if (id === 'indoors') { assert.equal(p, null, 'a room\'s is no yard\'s'); assert.equal(after[id], untouched[id], 'never asked'); continue; }
    assert.ok(p, `${id} still served`);
    const moved = before || OPEN_STALLS.includes(model);
    if (!RMBRP_STALLS[model] && !RMBRP_ROCKS[model] || !moved) { assert.equal(after[id], untouched[id], `${id} never asked`); continue; }
    const old = worldBox(wasBox(model, before), piece), stands = worldBox(nowBox(model), p);
    const [mo, ms] = [middle(old), middle(stands)];
    assert.ok(near(mo[0], ms[0], 0.003) && near(mo[2], ms[2], 0.003) && near(mo[1], ms[1], 0.003), `${id}: its middle and foot ${ms.map((v) => v.toFixed(3))} where they stood ${mo.map((v) => v.toFixed(3))}`);
    const k = RMBRP_STALLS[model] ? (before ? STALL_K : 1) : RMBRP_ROCK_SCALE[model];
    assert.ok(near(p.scale, Math.max(DECOR_SCALE_MIN, Math.round((piece.scale / k) * 1000) / 1000), 1e-9), `${id}: scale ${p.scale}`);
    if (RMBRP_STALLS[model]) assert.ok(near(stands[4] - stands[1], old[4] - old[1], (OPEN_STALLS.includes(model) ? 0.155 : 0.001) * p.scale + 0.002), `${id}: its height ${stands[4] - stands[1]} as it was ${old[4] - old[1]}`);
    assert.equal(JSON.parse(after[id]).reseat, YARD_RESEAT_MARK);
    reseated++;
  }
  assert.equal(reseated, 9, 'the eight from before and TEMPLE-STEPS\' open stall');
  assert.equal(now.pebble.scale, DECOR_SCALE_MIN, 'a rock of 8 placed at 1 stands at the law\'s least');
  assert.ok(near(now.stone.scale, 0.5, 1e-9) && near(worldBox(nowBox(53023), now.stone)[4] - worldBox(nowBox(53023), now.stone)[1], ROCK_BOX_WD3[53023][4] - ROCK_BOX_WD3[53023][1], 0.02), 'a rock of 2 its old height');
  assert.ok(into(now.walled, -4, 0) <= DECOR_WALL_CLIP && into(now.openWall, -12, 2) <= DECOR_WALL_CLIP, `after: within the wall clip (${into(now.walled, -4, 0).toFixed(3)}, ${into(now.openWall, -12, 2).toFixed(3)})`);
  assert.equal(after.junk, 'not json');
  raw.exec(SQL);
  assert.deepEqual(rows(), after, 'a second run moves nothing');
});

test('STALL-SHAPE AUDIT: a yard\'s piece brought back by the realm restore (tools/realmRestore.mjs, from a snapshot taken before 0121 ran) stands as 0121 leaves its neighbours - a WD3 stall or boulder re-seated by the same law, never a marked one twice, never a room\'s or another model\'s; one placed since by TEMPLE-STEPS\' open stall is written as held and said to the operator (mutants: the restore writes the snapshot\'s place, a marked place moved again)', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const { planRestore } = await import('../../tools/realmRestore.mjs');
  const MIGRATIONS = readdirSync(new URL('../../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
  const schema = () => { const d = new DatabaseSync(':memory:'); for (const f of MIGRATIONS) d.exec(readFileSync(new URL(`../../server-account/migrations/${f}`, import.meta.url), 'utf8')); return d; };
  const then = schema(), now = schema();
  for (const d of [then, now]) d.prepare("INSERT INTO players (id, guest_name, created_at, last_seen) VALUES ('gary', 'A Guest', 1, 1)").run();
  const house = (d) => d.prepare("INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at) VALUES (4242, 1, 'gary', 'gary-o', 'Owner', 17, 'private', 40000, 1)").run();
  house(then);
  now.prepare("INSERT INTO realm_census (player, char_id, spent) VALUES ('gary', 'gary-o', 1)").run();
  const place = (x, yaw, scale, extra = {}) => JSON.stringify({ pos: [x, 0.5, -3.25], rot: [yaw, 0, 0], scale, light: null, storage: false, paid: 90, ...extra });
  const pieces = [
    ['stall', 53104, place(4, 30, 1.2), YARD_RESEAT_AT - 3600, 1],
    ['rock', 53037, place(-6, -75, 2.5), YARD_RESEAT_AT - 3600, 1],
    ['marked', 53100, place(1, 0, 1, { reseat: YARD_RESEAT_MARK }), YARD_RESEAT_AT - 3600, 1],
    ['room', 53100, place(2, 0, 1), YARD_RESEAT_AT - 3600, 0],
    ['stool', 41000, place(3, 0, 1), YARD_RESEAT_AT - 3600, 1],
    ['since', 53118, place(5, 45, 1), YARD_RESEAT_AT + 60, 1],
  ];
  for (const [id, model, pl, at, yard] of pieces) then.prepare('INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at, paid, yard) VALUES (4242, 1, ?, ?, ?, ?, 0, ?)').run(id, model, pl, at, yard);
  // what 0121 leaves, the same rows in place: the law the restore must land on
  const left = schema();
  left.prepare("INSERT INTO players (id, guest_name, created_at, last_seen) VALUES ('gary', 'A Guest', 1, 1)").run();
  house(left);
  for (const [id, model, pl, at, yard] of pieces) left.prepare("INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at, paid, yard) VALUES (4242, 1, ?, ?, ?, ?, 0, ?)").run(id, model, pl, at, yard);
  left.exec(SQL);
  const plan = planRestore({ then, now });
  now.exec(plan.sql);
  const back = Object.fromEntries(now.prepare('SELECT id, place FROM home_decor').all().map((r) => [r.id, JSON.parse(r.place)]));
  const want = Object.fromEntries(left.prepare('SELECT id, place FROM home_decor').all().map((r) => [r.id, JSON.parse(r.place)]));
  for (const id of ['stall', 'rock']) {
    assert.equal(back[id].reseat, YARD_RESEAT_MARK, `${id} re-seated`);
    assert.ok(back[id].pos.every((v, k) => near(v, want[id].pos[k], 0.0011)) && back[id].scale === want[id].scale, `${id}: ${JSON.stringify(back[id])} as 0121 left it ${JSON.stringify(want[id])}`);
  }
  for (const [id, , pl] of pieces.filter(([id]) => ['marked', 'room', 'stool', 'since'].includes(id))) assert.deepEqual(back[id], JSON.parse(pl), `${id}: the snapshot's place`);
  assert.deepEqual(plan.notes.map((n) => /yard piece (\w+)/.exec(n)?.[1]), ['since'], 'the one the restore cannot know, said');
  assert.deepEqual(reseatRestored({ yard: 1, model: 53104, place: 'not json', placed_at: 1 }).reseated, false, 'a place that is not JSON is passed over');
});
