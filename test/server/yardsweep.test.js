// YARD-SWEEP (2026-10-11, the owner: "remove any decor items that currently go above the height limit"). YARD-HEIGHT
// refused a yard's piece placed or moved past DECOR_YARD_HIGH and left every one standing from before it where it stood;
// migration 0109 deletes them, the service's town read never serves one (server-account/src/decor.js yardsOf), and the
// client never stands one an older service still answers (scenes/homeYards.js ensure). A room's pieces are never asked.
// Each pin failed on the build before it. tools/mutants/yardsweep.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { DECOR_YARD_HIGH } from '../../src/net/decorLaw.js';
import { createHomeYards } from '../../src/scenes/homeYards.js';
import { standService, T0 } from '../accountDb.mjs';
import { fakeDoc, fakeWin, settle } from '../decorFakes.mjs';

const SWEEP = readFileSync(new URL('../../server-account/migrations/0109_yard_height_sweep.sql', import.meta.url), 'utf8');
const piece = (id, y) => ({ id, model: 41000, flat: null, pos: [8, y, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 120 });

/** A home with three yard pieces and a room's high shelf, one yard piece then raised past the bound by hand - a tower
 *  from before YARD-HEIGHT, which no route can write any more. */
async function towered(t) {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService();
  const owner = await svc.registered('Olga');
  const o = await svc.seatHome(owner, { mapId: 7, buildingKey: 300, region: 17, price: 5000 });
  const at = () => ({ id: o.character, ...svc.env.DB._raw.prepare('SELECT lease, seq FROM realm_characters WHERE id = ?').get(o.character) });
  const place = (p, yard) => svc.call('/v1/homes/decor/place', { mapId: 7, buildingKey: 300, character: o.character, realm: at(), piece: p, yard }, owner.secret);
  for (const [id, y] of [['low', 0], ['top', DECOR_YARD_HIGH], ['tower', 0]]) assert.equal((await place(piece(id, y), true)).status, 200, id);
  assert.equal((await place(piece('shelf', 9), false)).status, 200, 'a room\'s high shelf');
  const raw = svc.env.DB._raw;
  const row = raw.prepare('SELECT place FROM home_decor WHERE id = ?').get('tower');
  const pl = JSON.parse(row.place);
  pl.pos[1] = DECOR_YARD_HIGH + 5;
  raw.prepare('UPDATE home_decor SET place = ? WHERE id = ?').run(JSON.stringify(pl), 'tower');
  const yards = async () => (await svc.call('/v1/homes/yards', { mapId: 7 })).body.yards;
  const ids = () => raw.prepare('SELECT id FROM home_decor ORDER BY id').all().map((r) => r.id);
  return { svc, raw, yards, ids };
}

test('YARD-SWEEP the migration: every yard piece standing past DECOR_YARD_HIGH is deleted, one at the bound and below stands, a room\'s high piece is never asked, a malformed place never throws (mutants: the bound, the comparison, the room asked)', async (t) => {
  const { raw, ids } = await towered(t);
  raw.prepare("INSERT INTO home_decor (map_id, building_key, id, model, flat_archive, flat_record, place, placed_at, item, paid, yard) VALUES (7, 300, 'junk', 41000, NULL, NULL, 'not json', 1, NULL, 0, 1)").run();
  assert.deepEqual(ids(), ['junk', 'low', 'shelf', 'top', 'tower']);
  raw.exec(SWEEP);
  assert.deepEqual(ids(), ['junk', 'low', 'shelf', 'top'], 'the tower gone, the rest as they stood');
  raw.exec(SWEEP);
  assert.deepEqual(ids(), ['junk', 'low', 'shelf', 'top'], 'again: nothing more');
});

test('YARD-SWEEP the town read: a tower\'s piece standing in the database is never served; the rest of its yard is (mutants: the read unfiltered)', async (t) => {
  const { yards } = await towered(t);
  const got = await yards();
  assert.equal(got.length, 1);
  assert.deepEqual(got[0].pieces.map((p) => p.id), ['low', 'top']);
});

test('YARD-SWEEP the client: a tower\'s piece an older service still answers is never stood in the yard; the rest of the yard is (mutants: the client unfiltered)', async () => {
  const homeFrames = new Map([[300, { at: [10, 0, 10], box: [6, 0, 7, 14, 6, 13] }]]);
  const built = new Map([['0,0', { px: 0, py: 0, homeTown: 7, homeFrames, homeRegion: 17 }]]);
  const yards = createHomeYards({
    api: { yards: async () => ({ ok: true, data: { yards: [{ buildingKey: 300, pieces: [piece('low', 0), piece('top', DECOR_YARD_HIGH), piece('tower', DECOR_YARD_HIGH + 5)] }] } }) },
    homes: { homeAt: (m, k) => (k === 300 ? { owner: 'Tomas', own: false } : null) },
    built: () => built, translation: () => [0, 0, 0], feet: () => [18, 0, 10], outside: () => true, eye: () => [18, 1.6, 10],
    collider: () => ({ addMesh() {}, removeBucket() {}, surfaceHit: () => null }),
    meshes: { getGpuMesh: async (id) => id, cpuModels: new Map() }, renderer: { drawMesh() {}, createBillboardBatch: () => ({}), destroyBillboardBatch() {} },
    getTexture: async () => ({ recordCount: 6 }), uploadRecord() {},
    doc: fakeDoc(), win: fakeWin(), canvas: null, touch: false, actionOf: () => null, locked: () => true, cursorOff() {}, stick: () => null,
    say() {}, refusal: (w) => w, openSlot() {}, now: () => 0,
  });
  const cam = { pos: [18, 1.6, 10], yaw: 0, pitch: 0 };
  for (let i = 0; i < 4; i++) { yards.frame({ dt: 1, cam, overlayUp: false }); await settle(); await settle(); }
  const stood = yards.yards();
  assert.equal(stood.length, 1, 'the yard stands');
  assert.deepEqual(stood[0].pool.list().map((p) => p.id), ['low', 'top']);
  yards.destroy();
});
