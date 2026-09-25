// DECOR1 (2026-09-25, Mac: "building our own unique version instead of porting" Kaedius's Decorator; decor "Gold per
// placement"; asked, the catalogue "Everything Daggerfall furnishes", priced "By size", opened from "A UI element that
// can be clicked to open the decorate panel. Allows free cam mode for placement and an intuitive scrolling menu with
// filters", and "kept in the save" offline): A PIECE OF DECOR. The law both ends read (net/decorLaw.js), the account
// service's store of an online home's pieces driven through the real Worker over node:sqlite with every migration
// applied (server-account/src/decor.js), the client's door to it, and the deploy's wiring. `06-Systems/Online-Arc.md`
// DECOR1.
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
  decorWhatOf, decorLightOf, decorPlaceOf, decorPieceOf, decorPrice, decorRefund, decorRescale, mintDecorId,
} from '../src/net/decorLaw.js';
import { accountDecor, REFUSALS, SESSION_KEY } from '../src/net/accountClient.js';
import { collectDecor, decorCatalogue, filterDecor, decorSize, decorKey, modelKind, flatKind, DECOR_KINDS } from '../src/systems/decorCatalogue.js';

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
  for (const bad of [{ model: 41000, flat: [205, 3] }, {}, { model: 0 }, { model: 1_000_000 }, { model: 1.5 }, { flat: [512, 0] }, { flat: [205, 512] }, { flat: [205] }, { flat: [-1, 0] }]) {
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

test('DECOR1 the service: a home\'s pieces are any session\'s to read (a guest\'s too), nobody\'s without one; placing is the owner\'s CHARACTER\'s alone - a guest is refused, another player and the owner\'s other character find no home; a placement lands, one sent again is answered as the placement, another piece under its id is refused; a move changes where it stands and never what it is; a removal answers the piece as it stood; the cap; the hour\'s writes; the home released, its pieces go with it (mutants: the read closed to guests, a stranger placing, the owner\'s other character placing, a move turning one piece into another, a removal of another\'s, the cap unread, the repeat refused, the cascade)', async (t) => {
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
  assert.equal((await call('POST', '/v1/homes/decor/move', at({ id: 'nope', place: piece() }), aldric)).body.error, 'no-decor');
  assert.equal((await call('POST', '/v1/homes/decor/move', at({ id: 'p1', place: { ...piece(), scale: 9 } }), aldric)).body.error, 'bad-decor');
  // removing
  const strangerRemove = await call('POST', '/v1/homes/decor/remove', { ...HOME, character: 'char-mara', id: 'p1' }, mara);
  assert.deepEqual([strangerRemove.status, strangerRemove.body.error], [404, 'no-decor']);
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
