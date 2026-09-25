// DECOR1 (2026-09-25, Mac: "building our own unique version instead of porting" Kaedius's Decorator; decor "Gold per
// placement"; asked, the catalogue "Everything Daggerfall furnishes", priced "By size", opened from "A UI element that
// can be clicked to open the decorate panel. Allows free cam mode for placement and an intuitive scrolling menu with
// filters", and "kept in the save" offline): A PIECE OF DECOR. The law both ends read (net/decorLaw.js), the account
// service's store of an online home's pieces driven through the real Worker over node:sqlite with every migration
// applied (server-account/src/decor.js), the client's door to it, and the deploy's wiring; DECOR1c: the pieces standing
// in a room (scenes/decorRoom.js), the scene that keeps them, and the host that stands them (worldModes.js).
// `06-Systems/Online-Arc.md` DECOR1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../server-account/src/index.js';
import { ROUTES, OPEN_ROUTES } from '../server-account/src/service.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { placeDecor } from '../server-account/src/decor.js';
import {
  DECOR_CAP, DECOR_POS_MAX, DECOR_SCALE_MIN, DECOR_SCALE_MAX, DECOR_PRICE_MIN, DECOR_PRICE_MAX, DECOR_OPS_MAX,
  decorWhatOf, decorLightOf, decorPlaceOf, decorPieceOf, decorPrice, decorRefund, decorRescale, mintDecorId, decorSaleBack,
} from '../src/net/decorLaw.js';
import { accountDecor, REFUSALS, SESSION_KEY } from '../src/net/accountClient.js';
import { collectDecor, decorCatalogue, filterDecor, decorSize, decorKey, modelKind, flatKind, DECOR_KINDS } from '../src/systems/decorCatalogue.js';
import { createDecorRoom, decorMatrix, decorKeyOf, decorIdOfKey, decorLightLift, DECOR_REACH } from '../src/scenes/decorRoom.js';
import { trs } from '../src/world/mat4.js';
import { localAabb, transformedAabb } from '../src/render/frustum.js';
import { RAY_DISTANCE, DEFAULT_ACTIVATION_DISTANCE } from '../src/player/activate.js';
import { billboardSize } from '../src/world/rmbFlats.js';
import { FlatAnimator } from '../src/render/flatAnimation.js';
import { collectInteriorLights } from '../src/world/interiorLights.js';
import { createSceneCache, cacheScene, restoreCachedScene, snapshotSceneCache, restoreSceneCache } from '../src/systems/sceneCache.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of MIGRATIONS) db.exec(src(`server-account/migrations/${f}`));
  return {
    _raw: db,
    prepare(sql) {
      const stmt = db.prepare(sql);
      let args = [];
      const api = {
        bind(...a) { args = a; return api; },
        async first() { return stmt.get(...args) ?? null; },
        async all() { return { results: stmt.all(...args) }; },
        async run() { const r = stmt.run(...args); return { meta: { changes: Number(r.changes) } }; },
        _rows() { return stmt.all(...args); },
      };
      return api;
    },
    async batch(list) {
      db.exec('BEGIN');
      try { const out = list.map((st) => ({ results: st._rows() })); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}
async function stand() {
  _resetKeyForTests();
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const env = { DB: d1(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*' };
  const call = async (method, path, body, bearer = null) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const registered = async (handle) => {
    const guest = (await call('POST', '/v1/auth/guest', {})).body;
    const reg = await call('POST', '/v1/auth/register', { secret: guest.secret, handle, password: 'a good long one' });
    assert.equal(reg.status, 200, `${handle} registers`);
    return guest.secret;
  };
  return { env, call, registered };
}
const T0 = 1_800_000_000;
const HOME = { mapId: 1291010263, buildingKey: 0x10203 };
const home = (extra = {}) => ({ ...HOME, region: 17, character: 'char-aldric', price: 42000, ...extra });
const piece = (extra = {}) => ({ id: 'p1', model: 41000, flat: null, pos: [1.5, 0, -2.25], rot: [90, 0, 0], scale: 1, light: null, storage: false, paid: 180, ...extra });

test('DECOR1 the law: a piece is WHAT it is (one model, or one flat\'s archive and record, never both) and WHERE it stands (a position within the bounds of the building\'s origin, a turn within a half-circle each way, a scale a quarter to four times, an optional light, whether it holds things, what it cost), rounded as stored; priced by its scaled size between twenty and four hundred gold, half back when removed, a rescale paying the difference or giving half of it back; the cap and the hour\'s writes (mutants: both at once, a bound, the rounding, the price\'s floor and ceiling, the half, the rescale\'s refund)', () => {
  assert.equal(DECOR_CAP, 200);
  assert.equal(DECOR_OPS_MAX, 600);
  assert.deepEqual(decorWhatOf({ model: 41000 }), { model: 41000, flat: null });
  assert.deepEqual(decorWhatOf({ flat: [205, 3] }), { model: null, flat: [205, 3] });
  for (const bad of [{ model: 41000, flat: [205, 3] }, {}, { model: 0 }, { model: 1_000_000 }, { model: 1.5 }, { flat: [1000, 0] }, { flat: [205, 512] }, { flat: [205] }, { flat: [-1, 0] }]) {
    assert.equal(decorWhatOf(bad), null, JSON.stringify(bad));
  }
  const pl = decorPlaceOf({ pos: [1.23456, -0.0004, DECOR_POS_MAX], rot: [179.96, -90.04, 0], scale: 1.23456, light: null, storage: true, paid: 55 });
  assert.deepEqual(pl, { pos: [1.235, -0, 256], rot: [180, -90, 0], scale: 1.235, light: null, storage: true, paid: 55 });
  assert.deepEqual(decorPlaceOf({ pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, paid: 0 }), { pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0 }, 'no light, holds nothing, by default');
  const good = { pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 20 };
  for (const [k, v] of [['pos', [0, 0, DECOR_POS_MAX + 0.1]], ['pos', [0, 0]], ['pos', [0, NaN, 0]], ['rot', [181, 0, 0]], ['scale', DECOR_SCALE_MIN - 0.01], ['scale', DECOR_SCALE_MAX + 0.01], ['storage', 1], ['paid', DECOR_PRICE_MAX + 1], ['paid', -1], ['paid', 2.5], ['light', { color: [1, 1, 1], range: 0.5, intensity: 1 }], ['light', 'bright']]) {
    assert.equal(decorPlaceOf({ ...good, [k]: v }), null, `${k} ${JSON.stringify(v)}`);
  }
  assert.deepEqual(decorLightOf({ color: [1, 0.66666, 0.2], range: 8.123, intensity: 1.5 }), { color: [1, 0.667, 0.2], range: 8.12, intensity: 1.5 });
  assert.equal(decorLightOf({ color: [1, 1, 2], range: 8, intensity: 1 }), null);
  assert.equal(decorLightOf({ color: [1, 1, 1], range: 8, intensity: 0 }), null, 'a light that gives none is no light');
  assert.deepEqual(decorPieceOf(piece()), piece());
  assert.equal(decorPieceOf(piece({ id: 'has space' })), null);
  assert.equal(decorPieceOf(piece({ id: '' })), null);
  assert.equal(decorPieceOf(piece({ model: 41000, flat: [205, 1] })), null);
  // the price: by size
  assert.equal(decorPrice(1.2), 180, 'a metre-and-a-bit piece');
  assert.equal(decorPrice(1.2, 2), 360, 'its scale counts');
  assert.equal(decorPrice(0.05), DECOR_PRICE_MIN, 'the floor');
  assert.equal(decorPrice(9), DECOR_PRICE_MAX, 'the ceiling');
  assert.deepEqual([decorPrice(0), decorPrice(NaN), decorPrice(1, 0)], [0, 0, 0], 'no size, no price');
  assert.deepEqual([decorRefund(180), decorRefund(181), decorRefund(0), decorRefund(-5)], [90, 90, 0, 0]);
  assert.deepEqual(decorRescale(1.2, 180, 2), { pay: 180, refund: 0, paid: 360 }, 'grown: the difference paid');
  assert.deepEqual(decorRescale(1.2, 360, 1), { pay: 0, refund: 90, paid: 180 }, 'shrunk: half the difference back');
  assert.deepEqual(decorRescale(1.2, 180, 1), { pay: 0, refund: 0, paid: 180 });
  let i = 0;
  const id = mintDecorId(() => [0, 0.5, 0.9999][i++ % 3]);
  assert.match(id, /^[0-9a-z]{12}$/);
  assert.equal(id.slice(0, 3), '0iz', 'floor(rand x 36) in base 36');
});

test('DECOR1 the service: a home\'s pieces are any session\'s to read (a guest\'s too), nobody\'s without one; placing is the owner\'s CHARACTER\'s alone - a guest is refused, another player and the owner\'s other character find no home; a placement lands, one sent again is answered as the placement, another piece under its id is refused; a move changes where it stands and never what it is; a removal answers the piece as it stood; the cap; the hour\'s writes; the home released, its pieces go with it (mutants: the read closed to guests, a stranger placing, a stranger naming the owner\'s character, the owner\'s other character placing, a move turning one piece into another, a removal of another\'s, the cap unread, the repeat refused, the cascade)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { env, call, registered } = await stand();
  for (const r of ['/v1/homes/decor', '/v1/homes/decor/place', '/v1/homes/decor/move', '/v1/homes/decor/remove']) {
    assert.ok(ROUTES.has(r) && !OPEN_ROUTES.has(r), `${r} behind a session`);
  }
  assert.equal((await call('POST', '/v1/homes/decor', HOME)).status, 401, 'a stranger reads nothing');
  const guest = (await call('POST', '/v1/auth/guest', {})).body.secret;
  const empty = await call('POST', '/v1/homes/decor', HOME, guest);
  assert.deepEqual([empty.status, empty.body], [200, { ...HOME, pieces: [] }], 'a guest reads a room');
  const g = await call('POST', '/v1/homes/decor/place', { ...HOME, character: 'char-guest', piece: piece() }, guest);
  assert.deepEqual([g.status, g.body.error], [403, 'homes-need-account']);
  assert.deepEqual(await placeDecor({ db: env.DB, nowS: T0 }, { id: 'g1', handle: null, guest_name: 'Quiet Fox' }, { ...HOME, character: 'char-guest', piece: piece() }), { error: 'homes-need-account' }, 'and the function asks again');
  const aldric = await registered('Aldric');
  const mara = await registered('Mara');
  assert.equal((await call('POST', '/v1/homes/claim', home(), aldric)).status, 200);
  const at = (extra = {}) => ({ ...HOME, character: 'char-aldric', ...extra });
  // placing
  const noHome = await call('POST', '/v1/homes/decor/place', { ...HOME, character: 'char-mara', piece: piece() }, mara);
  assert.deepEqual([noHome.status, noHome.body.error], [404, 'no-home'], 'another player\'s home is no home to place in');
  // a character id is the client's own word - another player can NAME the owner's; the account is the service's
  const named = await call('POST', '/v1/homes/decor/place', at({ piece: piece() }), mara);
  assert.deepEqual([named.status, named.body.error], [404, 'no-home'], 'another player naming the owner\'s character owns nothing');
  const otherChar = await call('POST', '/v1/homes/decor/place', at({ character: 'char-second', piece: piece() }), aldric);
  assert.deepEqual([otherChar.status, otherChar.body.error], [404, 'no-home'], 'the owner\'s OTHER character does not own it');
  const p1 = await call('POST', '/v1/homes/decor/place', at({ piece: piece() }), aldric);
  assert.deepEqual([p1.status, p1.body], [200, { ok: true, piece: piece() }]);
  const again = await call('POST', '/v1/homes/decor/place', at({ piece: piece() }), aldric);
  assert.deepEqual([again.status, again.body.repeat], [200, true], 'a placement sent again after a lost answer is answered as the placement');
  const taken = await call('POST', '/v1/homes/decor/place', at({ piece: piece({ model: 41001 }) }), aldric);
  assert.deepEqual([taken.status, taken.body.error], [409, 'decor-taken']);
  const flat = piece({ id: 'p2', model: null, flat: [210, 4], pos: [0, 1, 0], light: { color: [1, 0.8, 0.5], range: 6, intensity: 1 }, paid: 40 });
  assert.equal((await call('POST', '/v1/homes/decor/place', at({ piece: flat }), aldric)).status, 200);
  assert.deepEqual((await call('POST', '/v1/homes/decor/place', at({ piece: { ...piece({ id: 'p3' }), pos: [0, 0, 999] } }), aldric)).body.error, 'bad-decor');
  // everyone reads the room
  const asMara = (await call('POST', '/v1/homes/decor', HOME, mara)).body.pieces;
  assert.deepEqual(asMara, [piece(), flat], 'the room is the same room to every visitor, oldest first');
  // moving: where it stands, never what it is
  const moved = await call('POST', '/v1/homes/decor/move', at({ id: 'p1', place: { ...piece({ pos: [3, 0, 3], rot: [0, 0, 0], storage: true }), model: 99999, flat: [216, 1] } }), aldric);
  assert.deepEqual(moved.body, { ok: true, piece: piece({ pos: [3, 0, 3], rot: [0, 0, 0], storage: true }) }, 'the model is its own column - a move cannot turn a bed into a statue');
  const strangerMove = await call('POST', '/v1/homes/decor/move', { ...HOME, character: 'char-mara', id: 'p1', place: piece() }, mara);
  assert.deepEqual([strangerMove.status, strangerMove.body.error], [404, 'no-decor']);
  assert.equal((await call('POST', '/v1/homes/decor/move', at({ id: 'p1', place: piece() }), mara)).body.error, 'no-decor', 'nor by naming the owner\'s character');
  assert.equal((await call('POST', '/v1/homes/decor/move', at({ id: 'nope', place: piece() }), aldric)).body.error, 'no-decor');
  assert.equal((await call('POST', '/v1/homes/decor/move', at({ id: 'p1', place: { ...piece(), scale: 9 } }), aldric)).body.error, 'bad-decor');
  // removing
  const strangerRemove = await call('POST', '/v1/homes/decor/remove', { ...HOME, character: 'char-mara', id: 'p1' }, mara);
  assert.deepEqual([strangerRemove.status, strangerRemove.body.error], [404, 'no-decor']);
  assert.equal((await call('POST', '/v1/homes/decor/remove', at({ id: 'p1' }), mara)).body.error, 'no-decor', 'nor by naming the owner\'s character');
  const removed = await call('POST', '/v1/homes/decor/remove', at({ id: 'p2' }), aldric);
  assert.deepEqual(removed.body, { ok: true, piece: flat }, 'the piece as it stood - its cost among it');
  assert.equal((await call('POST', '/v1/homes/decor/remove', at({ id: 'p2' }), aldric)).body.error, 'no-decor', 'gone');
  // the cap
  const db = env.DB._raw;
  const ins = db.prepare('INSERT INTO home_decor (map_id, building_key, id, model, flat_archive, flat_record, place, placed_at) VALUES (?, ?, ?, 41000, NULL, NULL, ?, ?)');
  for (let k = 0; k < DECOR_CAP - 1; k++) ins.run(HOME.mapId, HOME.buildingKey, `f${k}`, JSON.stringify({ pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 20 }), T0 + 1);
  const full = await call('POST', '/v1/homes/decor/place', at({ piece: piece({ id: 'last' }) }), aldric);
  assert.deepEqual([full.status, full.body.error], [409, 'decor-cap']);
  assert.equal((await call('POST', '/v1/homes/decor', HOME, mara)).body.pieces.length, DECOR_CAP, 'and the room reads whole');
  // the hour's writes
  db.prepare('INSERT OR REPLACE INTO rate_limits (key, window_start, count) VALUES (?, ?, ?)').run(`decor:${db.prepare("SELECT id FROM players WHERE handle = 'Aldric'").get().id}`, Math.floor(T0 / 3600) * 3600, DECOR_OPS_MAX);
  const rated = await call('POST', '/v1/homes/decor/move', at({ id: 'p1', place: piece() }), aldric);
  assert.deepEqual([rated.status, rated.body.error], [429, 'decor-rate']);
  // the home released takes its pieces
  assert.equal((await call('POST', '/v1/homes/release', HOME, aldric)).status, 200);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM home_decor').get().n, 0, 'CASCADE - the next owner walks into an empty house');
});

test('DECOR1e a home sold takes its placed pieces, and its release answers how many and half of what each cost - truncated a piece at a time, as removing each would give (the law\'s decorSaleBack, the client\'s own sum for a house or a ship), read in the same batch as the going; another player\'s release takes and answers nothing; a record that is not JSON is no piece; a home with none answers none (mutants: the half of the sum, the bad record counted, the sum read after the going)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { env, call, registered } = await stand();
  const aldric = await registered('Aldric');
  const mara = await registered('Mara');
  assert.equal((await call('POST', '/v1/homes/claim', home(), aldric)).status, 200);
  const at = (extra = {}) => ({ ...HOME, character: 'char-aldric', ...extra });
  const pieces = [piece({ id: 'a1', paid: 181 }), piece({ id: 'a2', paid: 41 }), piece({ id: 'a3', paid: 21 })];
  for (const p of pieces) assert.equal((await call('POST', '/v1/homes/decor/place', at({ piece: p }), aldric)).status, 200);
  const db = env.DB._raw;
  db.prepare('INSERT INTO home_decor (map_id, building_key, id, model, flat_archive, flat_record, place, placed_at) VALUES (?, ?, ?, 41000, NULL, NULL, ?, ?)')
    .run(HOME.mapId, HOME.buildingKey, 'broken', 'not json', T0);
  const stranger = await call('POST', '/v1/homes/release', HOME, mara);
  assert.deepEqual([stranger.status, stranger.body], [404, { error: 'no-home' }], 'another player\'s release answers no sum');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM home_decor').get().n, 4, 'and takes nothing');
  const sold = await call('POST', '/v1/homes/release', HOME, aldric);
  assert.deepEqual(sold.body, { ok: true, price: 42000, decorCount: 3, decorBack: 90 + 20 + 10 }, 'each half truncated - never the half of the sum (121)');
  assert.equal(sold.body.decorBack, decorSaleBack(pieces), 'the service\'s sum is the law\'s');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM home_decor').get().n, 0, 'and they went with it');
  assert.equal((await call('POST', '/v1/homes/claim', home(), aldric)).status, 200);
  assert.deepEqual((await call('POST', '/v1/homes/release', HOME, aldric)).body, { ok: true, price: 42000, decorCount: 0, decorBack: 0 }, 'none placed, none back');
});

test('DECOR2a an own item\'s piece in an online home: the service keeps WHICH item it is - the game\'s own numbers, beside what the piece is - read back by every visitor and never rewritten by a move; an own piece that says it cost gold or holds things is refused at the placing and at a move (the move leaves it as it stood), as is a bad descriptor or one on a model; a release counts it and owes nothing for it (mutants: the descriptor dropped, a move rewriting it, a cost or a hold moved onto it)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { env, call, registered } = await stand();
  const aldric = await registered('Aldric');
  const mara = await registered('Mara');
  assert.equal((await call('POST', '/v1/homes/claim', home(), aldric)).status, 200);
  const at = (extra = {}) => ({ ...HOME, character: 'char-aldric', ...extra });
  const statue = piece({ id: 'o1', model: null, flat: [202, 5], item: { t: 265, g: 10, m: null, v: null, a: null, p: null }, paid: 0 });
  const r1 = await call('POST', '/v1/homes/decor/place', at({ piece: statue }), aldric);
  assert.deepEqual([r1.status, r1.body], [200, { ok: true, piece: statue }]);
  assert.deepEqual((await call('POST', '/v1/homes/decor', HOME, mara)).body.pieces, [statue], 'every visitor reads which item it is');
  const moved = await call('POST', '/v1/homes/decor/move', at({ id: 'o1', place: { ...statue, pos: [2, 0, 2], item: { t: 0, g: 14 } } }), aldric);
  assert.deepEqual(moved.body, { ok: true, piece: { ...statue, pos: [2, 0, 2] } }, 'where it stands moves; which item it is never does');
  const costly = await call('POST', '/v1/homes/decor/move', at({ id: 'o1', place: { ...statue, paid: 40 } }), aldric);
  assert.deepEqual([costly.status, costly.body.error], [400, 'bad-decor'], 'an own piece never comes to cost gold');
  const holding = await call('POST', '/v1/homes/decor/move', at({ id: 'o1', place: { ...statue, storage: true } }), aldric);
  assert.deepEqual([holding.status, holding.body.error], [400, 'bad-decor'], 'nor to hold things');
  assert.deepEqual((await call('POST', '/v1/homes/decor', HOME, mara)).body.pieces, [{ ...statue, pos: [2, 0, 2] }], 'and stands as it stood');
  assert.equal((await call('POST', '/v1/homes/decor/move', at({ id: 'nope', place: { ...statue, paid: 40 } }), aldric)).body.error, 'no-decor');
  const bad = [
    piece({ id: 'o2', model: null, flat: [202, 5], item: { t: 265 }, paid: 40 }),
    piece({ id: 'o3', model: null, flat: [202, 5], item: { t: -1 }, paid: 0 }),
    piece({ id: 'o4', item: { t: 265 }, paid: 0 }),
  ];
  for (const b of bad) assert.equal((await call('POST', '/v1/homes/decor/place', at({ piece: b }), aldric)).body.error, 'bad-decor', b.id);
  assert.equal((await call('POST', '/v1/homes/decor/place', at({ piece: piece({ id: 'c1', paid: 181 }) }), aldric)).status, 200);
  const sold = await call('POST', '/v1/homes/release', HOME, aldric);
  assert.deepEqual(sold.body, { ok: true, price: 42000, decorCount: 2, decorBack: 90 }, 'the own piece counted, and nothing owed for it');
  assert.equal(env.DB._raw.prepare('SELECT COUNT(*) AS n FROM home_decor').get().n, 0);
});

test('DECOR2b a piece of furniture in an online home: the service keeps a model with the furniture\'s own numbers - read back by every visitor, never rewritten by a move - and refuses any other own item on a model (mutants: the model refused, a statue let onto one)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { call, registered } = await stand();
  const aldric = await registered('Aldric');
  const mara = await registered('Mara');
  assert.equal((await call('POST', '/v1/homes/claim', home(), aldric)).status, 200);
  const at = (extra = {}) => ({ ...HOME, character: 'char-aldric', ...extra });
  const bed = piece({ id: 'b1', model: 41001, flat: null, item: { t: 219, g: 8, m: null, v: null, a: null, p: null }, paid: 0 });
  const r = await call('POST', '/v1/homes/decor/place', at({ piece: bed }), aldric);
  assert.deepEqual([r.status, r.body], [200, { ok: true, piece: bed }]);
  assert.deepEqual((await call('POST', '/v1/homes/decor', HOME, mara)).body.pieces, [bed], 'every visitor reads which piece of furniture it is');
  const moved = await call('POST', '/v1/homes/decor/move', at({ id: 'b1', place: { ...bed, pos: [2, 0, 2], rot: [45, 0, 0], item: { t: 217, g: 8 } } }), aldric);
  assert.deepEqual(moved.body, { ok: true, piece: { ...bed, pos: [2, 0, 2], rot: [45, 0, 0] } }, 'moved, it is the same bed');
  const statue = piece({ id: 's1', model: 41001, flat: null, item: { t: 265, g: 10 }, paid: 0 });
  assert.equal((await call('POST', '/v1/homes/decor/place', at({ piece: statue }), aldric)).body.error, 'bad-decor', 'a statue is never a model');
});

test('DECOR2c a mount in an online home: the service keeps a weapon or shield hung as its own pack picture - the port\'s own archives past 511 among them - with its spin, read by every visitor; a picture past the law\'s bound is refused (mutants: the bound kept at 511)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { call, registered } = await stand();
  const aldric = await registered('Aldric');
  const mara = await registered('Mara');
  assert.equal((await call('POST', '/v1/homes/claim', home(), aldric)).status, 200);
  const at = (extra = {}) => ({ ...HOME, character: 'char-aldric', ...extra });
  const axe = piece({ id: 'w1', model: null, flat: [513, 2], item: { t: 513, g: 3, m: null, v: null, a: null, p: null }, rot: [180, 0, 15], paid: 0 });
  const r = await call('POST', '/v1/homes/decor/place', at({ piece: axe }), aldric);
  assert.deepEqual([r.status, r.body], [200, { ok: true, piece: axe }]);
  assert.deepEqual((await call('POST', '/v1/homes/decor', HOME, mara)).body.pieces, [axe], 'every visitor reads it hung');
  const past = piece({ id: 'w2', model: null, flat: [1000, 0], item: { t: 120, g: 3, m: null, v: null, a: null, p: null }, paid: 0 });
  assert.equal((await call('POST', '/v1/homes/decor/place', at({ piece: past }), aldric)).body.error, 'bad-decor');
});

test('DECOR1 the client\'s door: every call rides the one session as a Bearer header to its route, and no session is a word, not a throw; every refusal the service can say has a sentence; the deploy bundles the law and its smoke reads a room and refuses a guest (mutants: a route misspelt, the secret in the body)', async () => {
  const seen = [];
  const fetch = async (url, init) => { seen.push({ url, init }); return { ok: true, status: 200, json: async () => ({ ok: true }) }; };
  const storage = new Map([[SESSION_KEY, JSON.stringify({ secret: 'sek', id: 'p' })]]);
  const store = { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k) };
  const api = accountDecor({ fetch, storage: store });
  await api.list(7, 9);
  await api.place({ mapId: 7, buildingKey: 9, character: 'char-a', piece: piece(), extra: 'dropped' });
  await api.move({ mapId: 7, buildingKey: 9, character: 'char-a', id: 'p1', place: { pos: [0, 0, 0] } });
  await api.remove({ mapId: 7, buildingKey: 9, character: 'char-a', id: 'p1' });
  assert.deepEqual(seen.map((s) => new URL(s.url).pathname), ['/v1/homes/decor', '/v1/homes/decor/place', '/v1/homes/decor/move', '/v1/homes/decor/remove']);
  for (const s of seen) {
    assert.equal(s.init.headers.authorization, 'Bearer sek');
    assert.equal(JSON.parse(s.init.body).secret, undefined, 'the credential rides the header alone');
  }
  assert.deepEqual(JSON.parse(seen[1].init.body), { mapId: 7, buildingKey: 9, character: 'char-a', piece: piece() }, 'a placement names only what the service reads');
  assert.deepEqual(JSON.parse(seen[3].init.body), { mapId: 7, buildingKey: 9, character: 'char-a', id: 'p1' });
  const none = accountDecor({ fetch, storage: { getItem: () => null } });
  assert.deepEqual(await none.list(7, 9), { ok: false, error: 'no-session' });
  for (const w of ['decor-cap', 'decor-taken', 'decor-rate', 'no-decor', 'bad-decor', 'no-home', 'homes-need-account', 'home-character', 'bad-home']) {
    assert.equal(typeof REFUSALS[w], 'string', `${w} has its sentence`);
  }
  assert.match(REFUSALS['decor-cap'], /at most 200 pieces/);
  const wf = src('.github/workflows/account-deploy.yml');
  assert.match(wf, /- "src\/net\/decorLaw\.js"/);
  assert.match(wf, /\$base\/v1\/homes\/decor"/);
  assert.match(wf, /grep -q '"homes-need-account"' \/tmp\/place\.json/);
});

test('DECOR1 the catalogue - "Everything Daggerfall furnishes": every interior PROP model and flat Daggerfall lays out in its town blocks, counted, the editor\'s markers, the ladder and non-props left out; kinds by the game\'s own sets (beds, shop shelves, house containers, the flat archives), names the game\'s where it has them (containers, beds, the lights of TEXTURE.210) and otherwise the kind numbered in id order; a container holds things and a light carries Daggerfall\'s own light by default; the panel\'s filters - kinds, words, size, holds-things, gives-light - and its sorts (mutants: a marker kept, the ladder kept, a non-prop kept, the count, a container not storage, the light\'s default lost, the numbering, a filter unread)', () => {
  const room = (models, flats) => ({ interior: {
    block3dObjectRecords: models.map(([modelIdNum, objectType = 3]) => ({ modelIdNum, objectType })),
    blockFlatObjectRecords: flats.map(([textureArchive, textureRecord]) => ({ textureArchive, textureRecord })),
  } });
  const blocks = [
    { rmbBlock: { subRecords: [room([[41000], [41811], [41811], [41003], [40000, 2], [41409]], [[210, 3], [199, 1], [205, 7], [205, 2]])] } },
    { rmbBlock: { subRecords: [room([[41811], [41120], [41121]], [[210, 99], [300, 0]])] } },
    { rdbBlock: {} },
  ];
  const c = collectDecor(blocks);
  assert.deepEqual([...c.keys()].sort(), ['f205.2', 'f205.7', 'f210.3', 'f210.99', 'f300.0', 'm41000', 'm41003', 'm41120', 'm41121', 'm41811']);
  assert.equal(c.get('m41811').count, 3, 'how often Daggerfall places it');
  assert.equal(c.has('f199.1'), false, 'the editor\'s markers are no decor');
  assert.equal(c.has('m41409'), false, 'the ladder is not climbable where it is placed');
  assert.equal(c.has('m40000'), false, 'only a PROP is furniture');
  assert.deepEqual([modelKind(41000), modelKind(41811), modelKind(41120)], ['bed', 'storage', 'furniture']);
  assert.deepEqual([flatKind(210), flatKind(205), flatKind(300)], ['light', 'boxes', 'decor']);
  assert.deepEqual([decorKey({ model: 41000, flat: null }), decorKey({ model: null, flat: [210, 4] })], ['m41000', 'f210.4']);
  const cat = decorCatalogue(c);
  const by = Object.fromEntries(cat.map((e) => [e.key, e]));
  assert.equal(by.m41811.name, 'Chest');
  assert.equal(by.m41003.name, 'Wardrobe');
  assert.equal(by.m41000.name, 'Bed');
  assert.deepEqual([by.m41120.name, by.m41121.name], ['Furniture 1', 'Furniture 2'], 'a shared name numbered in id order');
  assert.equal(by['f210.3'].name, 'Candle');
  assert.equal(by['f210.99'].name, 'Light', 'a light the table does not name');
  assert.deepEqual([by['f205.2'].name, by['f205.7'].name], ['Box 1', 'Box 2']);
  assert.equal(by['f300.0'].kind, 'decor');
  assert.deepEqual([by.m41811.storage, by.m41120.storage], [true, false], 'a house container holds things by default');
  assert.ok(by['f210.3'].light && by['f210.3'].light.range >= 1, 'a light carries Daggerfall\'s own light');
  assert.equal(by.m41000.light, null);
  assert.deepEqual(cat.map((e) => e.kind).filter((k, i, a) => a.indexOf(k) === i), ['bed', 'storage', 'furniture', 'light', 'boxes', 'decor'], 'ordered by kind');
  assert.ok(cat.findIndex((e) => e.key === 'm41811') < cat.findIndex((e) => e.key === 'm41003'), 'most common first within a kind');
  assert.ok(Object.isFrozen(cat[0]));
  // the panel's filters
  const radius = { m41000: 1.3, m41811: 0.6, m41003: 1.1, m41120: 0.4 };
  const radiusOf = (e) => radius[e.key] ?? null;
  const keys = (list) => list.map((e) => e.key);
  assert.deepEqual(keys(filterDecor(cat, { kinds: ['storage'] })), ['m41811', 'm41003']);
  assert.deepEqual(keys(filterDecor(cat, { kinds: ['bed', 'light'] })), ['m41000', 'f210.3', 'f210.99']);
  assert.deepEqual(keys(filterDecor(cat, { text: 'CHEST' })), ['m41811']);
  assert.deepEqual(keys(filterDecor(cat, { text: 'lights candle' })), ['f210.3'], 'every word, in the name or the kind');
  assert.deepEqual(keys(filterDecor(cat, { size: 'large', radiusOf })), ['m41000']);
  assert.deepEqual(keys(filterDecor(cat, { size: 'small', radiusOf })), ['m41120']);
  assert.deepEqual(keys(filterDecor(cat, { storage: true })), ['m41811', 'm41003']);
  assert.deepEqual(keys(filterDecor(cat, { light: true })), ['f210.3', 'f210.99']);
  assert.deepEqual(keys(filterDecor(cat, { kinds: ['storage', 'bed', 'furniture'], sort: 'price', radiusOf })).slice(0, 4), ['m41120', 'm41811', 'm41003', 'm41000'], 'cheapest first');
  assert.equal(keys(filterDecor(cat, { sort: 'price', radiusOf })).at(-1) !== 'm41120', true, 'an unmeasured piece sorts last by price');
  assert.deepEqual(keys(filterDecor(cat, { kinds: ['storage'], sort: 'name' })), ['m41811', 'm41003']);
  assert.deepEqual([decorSize(0.2), decorSize(0.5), decorSize(1.25), decorSize(null)], ['small', 'medium', 'large', null]);
  assert.equal(Object.keys(DECOR_KINDS).length, 12);
});

// DECOR1c: a room's pool over fakes of the host's own seams - the pipeline's meshes and textures, the renderer, the room's
// collider, light list and flat animator - so what the pool does with each is read back exactly.
function decorRoomRig({ origin = [100, 10, -50] } = {}) {
  const log = [];
  const buckets = new Map();
  const adds = [];   // every addMesh, by key - the real collider APPENDS to a bucket it already holds
  const lights = [{ x: 0, y: 3, z: 0, range: 5, intensity: 1, color: [1, 1, 1] }];   // the room's own lamp
  const anims = new FlatAnimator();
  const uploads = [];
  const CUBE = { positions: new Float32Array([-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 1, 0.5, -0.5, 1, 0.5]), indices: new Uint32Array([0, 1, 2, 0, 2, 3]) };
  const tex = { recordCount: 30, getSize: () => ({ width: 16, height: 32 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: (r) => (r === 4 ? 3 : 1) };
  const pool = createDecorRoom({
    meshes: { getGpuMesh: async (id) => ({ gpu: id }), cpuModels: new Map([[41000, CUBE]]) },
    renderer: {
      createBillboardBatch: (archive, record, size, centers) => { log.push(['batch', archive, record]); return { archive, record, size, centers, frame: null }; },
      destroyBillboardBatch: (b) => { b.destroyed = true; },
      drawMesh: (gpu, m, remap) => log.push(['draw', gpu, m, remap]),
    },
    getTexture: async (a) => (a === 210 || a === 205 ? tex : null),
    uploadRecord: (a, r) => uploads.push(`${a}_${r}`),
    uploadRecordFrame: (a, r, f) => uploads.push(`${a}_${r}#${f}`),
    flatAnims: () => anims,
    collider: () => ({ addMesh: (k, _p, _i, m) => { adds.push(k); buckets.set(k, m); }, removeBucket: (k) => buckets.delete(k) }),
    origin: () => origin,
    roomLights: () => lights,
  });
  return { pool, log, buckets, adds, lights, anims, uploads, tex, CUBE };
}
const settle = () => new Promise((r) => setTimeout(r, 0));

test('DECOR1c the room\'s placed pieces: a model stands on the building\'s origin plus its place, turned [yaw, pitch, roll], in its own collider bucket keyed as its eye target (`decor:<id>`, the collider\'s surface deciding) at the room\'s own reach, drawn in the room\'s climate; a flat is uploaded, sized and animated as the room\'s own flats are, stands on its base, answers the ray by its box alone; a lit piece\'s light joins the room\'s own list where the room\'s light of that record hangs; a move or a removal takes the old bucket, batch, animation and light with it, and a piece gone while it loaded never stands; what a storage piece holds is a live list, written to the scene as copies of the non-empty; the save\'s own record for a room standing another\'s is kept unstood; the room\'s teardown forgets all of it (mutants: the turn misread, a moved bucket left, a stale load standing, the light left burning, the flame at the floor, a flat sunk to its middle, a flat unanimated, an animation outliving its batch, the items shared, empty lists written, the teardown keeping the items or the kept record, the reach lost, a flat target solid)', async () => {
  const { pool, log, buckets, adds, lights, anims, uploads, tex, CUBE } = decorRoomRig();
  assert.equal(DECOR_REACH, DEFAULT_ACTIVATION_DISTANCE, 'the room\'s own furniture\'s reach');
  assert.equal(decorKeyOf('abc'), 'decor:abc');
  assert.deepEqual([decorIdOfKey('decor:abc'), decorIdOfKey('container:3'), decorIdOfKey(null)], ['abc', null, null]);
  // a model
  const chair = piece();   // 41000 at [1.5, 0, -2.25], turned 90 degrees
  const at = trs(101.5, 10, -52.25, 0, 90, 0, 1, 1, 1);
  assert.deepEqual([...decorMatrix(chair, [100, 10, -50])], [...at], 'yaw is the first of the three');
  pool.put(chair);
  assert.equal(buckets.size, 0, 'not yet loaded');
  await settle();
  assert.deepEqual([...buckets.get('decor:p1')], [...at], 'its own bucket, keyed as its target is');
  const box = transformedAabb(localAabb(CUBE.positions), at);
  assert.deepEqual(pool.targets(), [{ key: 'decor:p1', aabb: { min: [box[0], box[1], box[2]], max: [box[3], box[4], box[5]] }, distance: RAY_DISTANCE, reach: DECOR_REACH, meshCollider: true }]);
  assert.equal(pool.draw(undefined, 'remap'), 1);
  assert.deepEqual(log.at(-1), ['draw', { gpu: 41000 }, at, 'remap'], 'drawn in the room\'s own climate');
  // a lit, animated flat, twice its size
  const lamp = piece({ id: 'p2', model: null, flat: [210, 4], pos: [0, 1, 0], scale: 2, light: { color: [1, 0.8, 0.5], range: 6, intensity: 1 } });
  pool.put(lamp);
  assert.equal(lights.length, 1, 'a flat\'s light waits for its size');
  await settle();
  const size = billboardSize(tex, 4);
  const [batch] = pool.batches();
  assert.deepEqual([batch.archive, batch.record, batch.size, batch.centers], [210, 4, { w: size.w * 2, h: size.h * 2 }, [[100, 11, -50]]],
    'sized as the room\'s flats are, scaled, and standing on its BASE - the renderer bottom-anchors every batch');
  assert.ok(['210_4', '210_4#0', '210_4#1', '210_4#2'].every((k) => uploads.includes(k)), 'uploaded as the room\'s flats are, every frame of an animated one');
  assert.deepEqual(anims.entries.map((e) => e.batch), [batch], 'and its flame moves as the room\'s own do (FA1)');
  const [own] = collectInteriorLights([{ archive: 210, record: 4, x: 0, y: 0, z: 0 }], () => ({ w: size.w * 2, h: size.h * 2 }));
  assert.deepEqual(lights[1], { x: 100, y: 11 + own.y, z: -50, range: 6, intensity: 1, color: [1, 0.8, 0.5], decor: 'p2' },
    'its light joins the room\'s own list - where the room\'s light of that record hangs, the piece\'s own colour and reach');
  assert.ok(own.y > 0 && pool.lights()[0] === lights[1], 'above the floor, and the very object in the room\'s list');
  assert.deepEqual(pool.targets().find((t) => t.key === 'decor:p2'),
    { key: 'decor:p2', aabb: { min: [100 - size.w, 11, -50 - size.w], max: [100 + size.w, 11 + size.h * 2, -50 + size.w] }, distance: RAY_DISTANCE, reach: DECOR_REACH, noSurface: true },
    'a flat has no collider: its box answers the ray alone');
  assert.equal(decorLightLift(chair, null), 0, 'a model\'s light hangs at its origin');
  assert.equal(decorLightLift(lamp, null), null, 'a flat\'s waits for its size');
  assert.equal(decorLightLift(piece({ model: null, flat: [205, 1] }), { w: 1, h: 3 }), 1.5, 'any other flat\'s at its middle');
  // moved: the old goes at once, the new stands where it was moved
  pool.put({ ...lamp, pos: [2, 1, 0] });
  assert.ok(batch.destroyed, 'the old batch goes');
  assert.equal(anims.entries.some((e) => e.batch === batch), false, 'its animation with it');
  assert.equal(lights.length, 1, 'and its light, until the new one stands');
  await settle();
  assert.deepEqual([lights.length, lights[1].x], [2, 102]);
  pool.put({ ...chair, pos: [0, 0, 0] });
  assert.equal(buckets.has('decor:p1'), false, 'a moved model\'s old bucket goes at once');
  await settle();
  assert.equal(buckets.get('decor:p1')[12], 100, 'the new one where it was moved');
  // a model's light is at once; a piece gone while it loaded never stands
  pool.put(piece({ id: 'p5', light: { color: [1, 1, 1], range: 4, intensity: 2 } }));
  assert.deepEqual(lights.at(-1), { x: 101.5, y: 10, z: -52.25, range: 4, intensity: 2, color: [1, 1, 1], decor: 'p5' });
  const stool = piece({ id: 'p3' });
  pool.put(stool);
  assert.equal(pool.remove('p3'), stool, 'a removal answers the piece as it stood');
  pool.put(piece({ id: 'p6', model: null, flat: [999, 0], light: { color: [1, 1, 1], range: 4, intensity: 2 } }));
  await settle();
  assert.equal(buckets.has('decor:p3'), false, 'a piece removed while its model loaded never stands a collider');
  // moved while it loaded: only the move stands (the collider would take both sets of triangles into one bucket)
  pool.put(piece({ id: 'p7' }));
  pool.put(piece({ id: 'p7', pos: [4, 0, 4] }));
  const batchesMade = log.filter((e) => e[0] === 'batch').length;
  pool.put(piece({ id: 'p8', model: null, flat: [205, 1] }));
  pool.remove('p8');
  await settle();
  assert.deepEqual([adds.filter((k) => k === 'decor:p7').length, buckets.get('decor:p7')[12]], [1, 104], 'one bucket, where it was moved to');
  assert.equal(log.filter((e) => e[0] === 'batch').length, batchesMade, 'a flat removed while it loaded never makes a batch');
  pool.remove('p7');
  assert.equal(pool.targets().some((t) => t.key === 'decor:p6') || lights.some((l) => l.decor === 'p6'), false, 'a flat the archive lacks stands nothing and lights nothing');
  const movedLamp = pool.pieceOf('p2');
  assert.deepEqual([movedLamp.pos, pool.remove('p2'), pool.pieceOf('p2')], [[2, 1, 0], movedLamp, null], 'gone');
  assert.equal(lights.some((l) => l.decor === 'p2'), false, 'removed, its light leaves the room\'s list');
  // what a storage piece holds
  const chest = pool.itemsOf('p1');
  chest.push({ name: 'Silver', value: 5 });
  assert.equal(pool.itemsOf('p1'), chest, 'the live list the inventory window binds to');
  assert.deepEqual([pool.holdsAny('p1'), pool.holdsAny('p9')], [true, false]);
  pool.itemsOf('p9');   // opened, left empty
  const snap = pool.itemsSnapshot();
  assert.deepEqual(snap, { p1: [{ name: 'Silver', value: 5 }] }, 'the scene keeps only what holds something');
  snap.p1[0].value = 99;
  assert.equal(chest[0].value, 5, 'as copies - the scene cannot reach into the chest');
  pool.setItems({ p4: [{ name: 'Gold' }], bad: 'x' });
  assert.deepEqual(pool.itemsSnapshot(), { p4: [{ name: 'Gold' }] }, 'restored from the scene, a malformed list read as none');
  pool.setItems(undefined);
  assert.deepEqual(pool.itemsSnapshot(), {}, 'a scene written before DECOR1 holds nothing');
  // the save's own record for a room standing another's
  pool.keep([lamp]);
  assert.deepEqual([pool.kept(), pool.pieceOf('p2')], [[lamp], null], 'kept, never stood');
  // the teardown
  pool.setItems({ p1: [{ name: 'Silver' }] });
  pool.destroyAll();
  assert.deepEqual([pool.size(), buckets.size, lights.length], [0, 0, 1], 'every piece, bucket and light gone - the room\'s own lamp alone');
  assert.deepEqual([pool.itemsSnapshot(), pool.kept()], [{}, []], 'what they held and the kept record forgotten - the scene already wrote them');
  pool.set([chair, lamp]);
  pool.set([lamp]);
  await settle();
  assert.deepEqual([pool.list(), buckets.size, pool.batches().length], [[lamp], 0, 1], 'a set replaces every piece');
});

test('DECOR1c the scene keeps a room\'s pieces and what they hold: detached from the caller at the store, through the save and back; a scene written before DECOR1 reads as a room with nothing placed (mutants: the items dropped, a shallow copy)', () => {
  const c = createSceneCache();
  const lamp = () => piece({ id: 'p2', model: null, flat: [210, 4], light: { color: [1, 0.8, 0.5], range: 6, intensity: 1 } });
  const entry = { decor: [piece(), lamp()], decorItems: { p1: [{ name: 'Silver', value: 5 }] } };
  cacheScene(c, 'House', entry);
  entry.decor[0].pos[0] = 99; entry.decor[0].rot[0] = 1; entry.decor[1].flat[1] = 0; entry.decor[1].light.color[0] = 0; entry.decorItems.p1[0].value = 0;
  const back = createSceneCache();
  restoreSceneCache(back, JSON.parse(JSON.stringify(snapshotSceneCache(c))));
  const got = restoreCachedScene(back, 'House');
  assert.deepEqual([got.decor, got.decorItems], [[piece(), lamp()], { p1: [{ name: 'Silver', value: 5 }] }], 'the caller\'s later changes never reach the store');
  cacheScene(c, 'Old', { lootContainers: [] });
  const old = restoreCachedScene(c, 'Old');
  assert.deepEqual([old.decor, old.decorItems], [[], {}]);
});

test('DECOR1c the room\'s host (worldModes.js): one pool on the room\'s own collider, origin, light list and animator, emptied at all three teardowns; the save writes the offline house\'s and ship\'s pieces and never an online home\'s (the save\'s own record kept through it), and what the pieces hold either way; the restore stands the save\'s, or keeps them where an online home stands; an online home\'s come from the service after the restore, once a visit, and a late answer stands none; drawn, targeted, pressed; a storage piece opens for the room\'s owner alone - the online home\'s, else the house\'s or ship\'s - and is named; world.js builds the service\'s door online alone (mutants: the kept record wiped, a late answer standing, a visitor opening a piece)', () => {
  const m = src('src/scenes/worldModes.js');
  const w = src('src/scenes/world.js');
  assert.match(m, /const interiorDecor = createDecorRoom\(\{\n    meshes: \{ getGpuMesh, cpuModels \}, renderer, getTexture, uploadRecord, uploadRecordFrame, flatAnims: \(\) => interiorCtx\?\.flatAnims \?\? null,\n    collider: \(\) => interiorCtx\?\.collider \?\? null, origin: \(\) => buildingOrigin\(\), roomLights: \(\) => interiorCtx\?\.lights \?\? null,\n  \}\);/);
  assert.equal([...m.matchAll(/interiorDecor\.destroyAll\(\); _decorVisit\+\+;/g)].length, 3, 'the entry sweep, the exit and the quest-teleport / load arm');
  assert.match(m, /const decor = interiorHome \? interiorDecor\.kept\(\) : interiorDecor\.list\(\);\n    const decorItems = interiorDecor\.itemsSnapshot\(\);/);
  assert.match(m, /const placed = \(data\.decor \?\? \[\]\)\.map\(decorPieceOf\)\.filter\(Boolean\);\n    if \(interiorHome\) interiorDecor\.keep\(placed\); else interiorDecor\.set\(placed\);\n    interiorDecor\.setItems\(data\.decorItems\);/);
  assert.match(m, /mountQuestResources\(\);\n      loadHomeDecor\(\);/);
  assert.ok(m.indexOf('loadHomeDecor();   // DECOR1c') > m.indexOf('restoreInteriorScene();\n      // AUDIT 63 F22'), 'after the restore, which latched the home and kept the save\'s record');
  assert.match(m, /const visit = _decorVisit;\n    Promise\.resolve\(host\.homeDecor\.list\(homeTownOf\(b\), b\.buildingKey\)\)\.then\(\(r\) => \{\n      if \(visit !== _decorVisit \|\| interiorBuilding !== b\) return;\n      if \(!r\?\.ok \|\| !Array\.isArray\(r\.data\?\.pieces\)\) return;\n      const pieces = r\.data\.pieces\.map\(decorPieceOf\)\.filter\(Boolean\);\n      interiorDecor\.set\(pieces\);/);   // DECOR2a: the pieces kept for the strays' reckoning
  assert.match(m, /interiorArrows\.draw\(renderer, interiorCtx\.texRemap\);\n    interiorDecor\.draw\(renderer, interiorCtx\.texRemap\);/);
  assert.match(m, /const _decorFlats = \[\.\.\.interiorDecor\.batches\(\), \.\.\.decorTool\.batches\(\)\];[^\n]*\n      if \(_decorFlats\.length\) renderer\.drawBillboards\(_decorFlats, camRight, UP_Y\);/);
  assert.match(m, /targets\.push\(\.\.\.interiorDecor\.targets\(\)\);/);
  assert.match(m, /if \(key\.startsWith\('decor:'\)\) \{ activateDecor\(decorIdOfKey\(key\)\); return true; \}/);
  assert.match(m, /function decorOwnerHere\(\) \{\n    if \(interiorHome\) return interiorHome\.own;\n    const b = interiorBuilding;\n    if \(!b\) return false;\n    if \(b\.buildingType === BUILDING_TYPES\.Ship\) return ownsShip\(playerEntity\);\n    return isHouseOwned\(playerEntity\.houses \?\? \[\], b\.regionIndex \?\? 0, b\.buildingKey \?\? 0\);\n  \}/);
  assert.match(m, /if \(!piece\?\.storage\) return;\n    if \(!decorOwnerHere\(\)\) \{\n      if \(interiorHome\) say\(homeBelongsLine\(interiorHome\)\);\n      return;\n    \}\n    const win = interiorInventory\(\{ loot: \{ items: \(\) => interiorDecor\.itemsOf\(id\) \} \}\);/);
  assert.match(m, /const t = decorNames\.get\(decorKey\(piece\)\) \?\? \(piece\.storage && piece\.model != null \? houseContainerName\(piece\.model\) : null\);/);
  assert.match(w, /const homeDecor = params\.has\('online'\) \? accountDecor\(\{ fetch: \(u, i\) => globalThis\.fetch\(u, i\), storage: appStorage\(\) \}\) : null;/);
  assert.match(w, /\n    homeDecor,   \/\/ DECOR1c/);
});

