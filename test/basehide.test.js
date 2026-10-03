// BASE-HIDE (2026-09-26, Mac: "Remove bought houses decor - the base game decor isnt easy to decorate around when u
// want more in depth house"): what Daggerfall furnished a room with - its prop models and its flats - the room's owner
// may TAKE OUT and put back, free. A furnishable room (an online home, anyone's; the player's house or ship) stands its
// own furniture piece by piece so one piece can go (scenes/decorBase.js); the list of what is out is the save's offline
// and the account service's online (migration 0015), and a sale brings the furniture back. The law, the room's pool,
// the service over the real Worker and node:sqlite, the scene cache, the tool, the panel's "Built in" view, and the
// build's and the host's wiring by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../server-account/src/index.js';
import { ROUTES } from '../server-account/src/service.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { DECOR_BASE_KEY_RE, DECOR_HIDDEN_CAP, decorBaseModelKey, decorBaseFlatKey, decorBaseWhat, decorHiddenOf } from '../src/net/decorLaw.js';
import { createBaseRoom, baseBucketOf } from '../src/scenes/decorBase.js';
import { createSceneCache, cacheScene, restoreCachedScene, clearSceneHidden, interiorSceneName } from '../src/systems/sceneCache.js';
import { accountDecor, SESSION_KEY } from '../src/net/accountClient.js';
import { createDecorPanel, decorBaseSub, DECOR_HOLDS_LINE, DECOR_BASE_EMPTY } from '../src/ui/decorPanel.js';
import { toolRig, settle, all, one, fakeDoc, fakeWin } from './decorFakes.mjs';
import { ACCEPTED } from '../src/net/legalLaw.js';   // TERMS1: a request that makes an account carries the versions ticked

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('BASE-HIDE the law: a built-in piece is named by the layout - `m<placement>:<model>`, `f<flat>:<archive>.<record>`, every number canonical; a room\'s list is refused whole, never half kept - a name the law does not take, a name twice, or more than the cap', () => {
  assert.equal(decorBaseModelKey(12, 41000), 'm12:41000');
  assert.equal(decorBaseFlatKey(3, 210, 4), 'f3:210.4');
  // WD3: a mod's flat archive is five digits - DET's food in a Beautiful Village's kitchen, the town mods' table clutter
  for (const k of ['m0:41000', 'm9999:999999', 'f0:210.0', 'f12:204.511', 'f12:10021.5', 'f3:56790.24', 'f9999:99999.999']) assert.match(k, DECOR_BASE_KEY_RE, k);
  for (const k of ['m01:41000', 'm1:041000', 'm1:1000000', 'm10000:1', 'f1:210', 'f1:210.04', 'f1:100000.1', 'f1:010021.1', 'x1:2', 'm1:2 ', 'f-1:210.1', '', 'int:3']) {
    assert.doesNotMatch(k, DECOR_BASE_KEY_RE, JSON.stringify(k));
  }
  assert.deepEqual(decorBaseWhat('m12:41000'), { model: 41000 });
  assert.deepEqual(decorBaseWhat('f3:210.4'), { flat: [210, 4] });
  assert.equal(decorBaseWhat('m1:2:3'), null);
  assert.deepEqual(decorHiddenOf(['f3:210.4', 'm12:41000']), ['f3:210.4', 'm12:41000'], 'in order');
  assert.deepEqual(decorHiddenOf([]), []);
  assert.equal(decorHiddenOf(['m12:41000', 'm12:41000']), null, 'none twice');
  assert.equal(decorHiddenOf(['m12:41000', 'chair']), null, 'refused whole');
  assert.equal(decorHiddenOf('m12:41000'), null);
  assert.equal(decorHiddenOf(Array.from({ length: DECOR_HIDDEN_CAP + 1 }, (_, i) => `m${i}:1`)), null, 'the cap');
  const widest = Array.from({ length: DECOR_HIDDEN_CAP }, (_, i) => `f${9999 - i}:99999.999`);   // WD3: five digits of archive
  assert.ok(JSON.stringify({ mapId: 1291010263, buildingKey: 0x10203, character: 'char-aldric-the-long', keys: decorHiddenOf(widest) }).length < 4096, 'a whole list at its widest is one write under the service\'s body cap');
});

/** A furnishable room's own pieces, over the room's own lists. */
function baseRoom() {
  const drawList = [], batches = [], lights = [], buckets = new Map();
  const collider = { addMesh: (k, pos, idx, m) => buckets.set(k, [pos, idx, m]), removeBucket: (k) => buckets.delete(k) };
  const base = createBaseRoom({ drawList, batches: () => batches, lights: () => lights, collider });
  const cpu = { positions: new Float32Array(9), indices: new Uint16Array([0, 1, 2]) };
  const add = (key, model, furniture = null) => {
    const draw = { mesh: model, key: `int:${key}` };
    drawList.push(draw);
    collider.addMesh(baseBucketOf(key), cpu.positions, cpu.indices, 'M');
    base.addModel(key, { model, draw, cpu, matrix: 'M', at: [1, 0, 1] });
    if (furniture) base.furnish(key, furniture);
    return draw;
  };
  const flat = (key, fl, withLight = false) => {
    const batch = { flat: fl };
    const light = withLight ? { x: 0, y: 1, z: 0 } : null;
    batches.push(batch);
    if (light) lights.push(light);
    base.addFlat(key, { flat: fl, batch, light, at: [0, 0, 0] });
    return { batch, light };
  };
  return { base, drawList, batches, lights, buckets, add, flat };
}

test('BASE-HIDE the room\'s own pieces: one taken out goes whole - its draw, its collider, its light, its batch, and a cupboard\'s place among the targets - and comes back whole; one that holds anything stays; the list names every piece out, and a name the room lacks is kept, unread', () => {
  const r = baseRoom();
  const chest = { items: [] };
  const table = r.add('m0:41100', 41100);
  r.add('m1:41032', 41032, chest);
  const candle = r.flat('f0:210.3', [210, 3], true);
  r.flat('f1:204.2', [204, 2]);
  assert.equal(r.base.hide('m0:41100'), true);
  assert.equal(r.drawList.includes(table), false, 'no draw');
  assert.equal(r.buckets.has(baseBucketOf('m0:41100')), false, 'nothing to walk into');
  assert.equal(r.base.hide('m0:41100'), false, 'not twice');
  assert.equal(r.base.hide('f0:210.3'), true);
  assert.equal(r.batches.includes(candle.batch), false, 'no picture');
  assert.equal(r.lights.includes(candle.light), false, 'and no light');
  assert.deepEqual(r.base.hidden(), ['f0:210.3', 'm0:41100']);
  assert.deepEqual(r.base.outBatches(), [candle.batch], 'the teardown frees what is out of the room\'s list');
  chest.items.push({ name: 'Ruby' });
  assert.equal(r.base.hide('m1:41032'), false, 'a chest holding a ruby stays');
  assert.equal(r.base.list().find((p) => p.key === 'm1:41032').holds, true);
  chest.items.length = 0;
  assert.equal(r.base.hide('m1:41032'), true, 'emptied, it goes');
  assert.equal(chest.hidden, true, 'and the host\'s target list skips it');
  assert.equal(r.base.show('m0:41100'), true);
  assert.ok(r.drawList.includes(table), 'drawn again');
  assert.deepEqual(r.buckets.get(baseBucketOf('m0:41100')), [r.buckets.get(baseBucketOf('m0:41100'))[0], new Uint16Array([0, 1, 2]), 'M'], 'standing in the collider again, where it stood');
  assert.equal(r.base.show('m0:41100'), false, 'not twice');
  assert.equal(r.base.hide('m7:1'), false, 'no such piece');
  // the list as the save or the service keeps it
  assert.equal(r.base.setHidden(['m0:41100', 'm88:41000', 'nonsense', 'm0:41100']), true);
  assert.deepEqual(r.base.list().map((p) => [p.key, p.hidden]), [['m0:41100', true], ['m1:41032', false], ['f0:210.3', false], ['f1:204.2', false]], 'every named piece out, every other back');
  assert.ok(r.batches.includes(candle.batch) && r.lights.includes(candle.light), 'the candle back, and its light');
  assert.equal(chest.hidden, false);
  assert.deepEqual(r.base.hidden(), ['m0:41100', 'm88:41000'], 'a name this room lacks is kept for the next write, and nonsense is no name');
  assert.equal(r.base.setHidden('m1:41032'), false, 'anything but a list changes nothing');
  assert.deepEqual(r.base.hidden(), ['m0:41100', 'm88:41000']);
});

const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of MIGRATIONS) db.exec(src(`server-account/migrations/${f}`));
  return {
    _raw: db,   // AUDIT REALM2 S2: a house from before the realm is laid in by hand
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
  const kp = await globalThis.crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await globalThis.crypto.subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const env = { DB: d1(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*' };
  const call = async (path, body, bearer = null) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) }, body: JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const registered = async (handle) => {
    const guest = (await call('/v1/auth/guest', { ...ACCEPTED })).body;
    assert.equal((await call('/v1/auth/register', { secret: guest.secret, handle, password: 'a good long one', ...ACCEPTED })).status, 200);
    return guest.secret;
  };
  /** AUDIT REALM2 S2: a house from before the realm, the account `handle`'s `character`'s - a claim is a realm
   *  character's now; clearing its room is still its owner's character's, whichever it is. */
  const oldHome = (handle, character) => env.DB._raw.prepare("INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at) VALUES (?, ?, (SELECT id FROM players WHERE handle = ?), ?, ?, 17, 'private', 42000, 1)")
    .run(HOME.mapId, HOME.buildingKey, handle, character, handle);
  return { call, registered, oldHome };
}
const HOME = { mapId: 1291010263, buildingKey: 0x10203 };

test('BASE-HIDE the service: a home\'s list of what is out is read with its pieces by every session; written WHOLE by the owner\'s character alone; refused whole when the law would; and the home released takes it (mutants: a stranger\'s write kept, a bad list kept, the list unread, the cascade dropped)', async () => {
  const { call, registered, oldHome } = await stand();
  assert.ok(ROUTES.has('/v1/homes/decor/hidden'), 'the route is the service\'s');
  const aldric = await registered('Aldric');
  const mara = await registered('Mara');
  oldHome('Aldric', 'char-aldric');
  assert.deepEqual((await call('/v1/homes/decor', HOME, mara)).body.hidden, [], 'nothing out yet');
  const at = (keys, character = 'char-aldric') => ({ ...HOME, character, keys });
  const w = await call('/v1/homes/decor/hidden', at(['m12:41000', 'f3:210.4']), aldric);
  assert.deepEqual([w.status, w.body], [200, { ok: true, hidden: ['f3:210.4', 'm12:41000'] }]);
  assert.deepEqual((await call('/v1/homes/decor', HOME, mara)).body.hidden, ['f3:210.4', 'm12:41000'], 'every visitor walks into the room its owner cleared');
  const stranger = await call('/v1/homes/decor/hidden', at([]), mara);
  assert.deepEqual([stranger.status, stranger.body.error], [404, 'no-home'], 'another player clears nothing');
  assert.equal((await call('/v1/homes/decor/hidden', at([], 'char-mara'), mara)).body.error, 'no-home');
  assert.equal((await call('/v1/homes/decor/hidden', at([], 'char-second'), aldric)).body.error, 'no-home', 'nor the owner\'s other character');
  const bad = await call('/v1/homes/decor/hidden', at(['m12:41000', 'a chair']), aldric);
  assert.deepEqual([bad.status, bad.body.error], [400, 'bad-decor']);
  assert.deepEqual((await call('/v1/homes/decor', HOME, mara)).body.hidden, ['f3:210.4', 'm12:41000'], 'and a refused list changed nothing');
  assert.deepEqual((await call('/v1/homes/decor/hidden', at(['m5:41001']), aldric)).body.hidden, ['m5:41001'], 'written whole: the list replaced');
  assert.deepEqual((await call('/v1/homes/decor/hidden', at([]), aldric)).body.hidden, [], 'everything put back');
  await call('/v1/homes/decor/hidden', at(['m5:41001']), aldric);
  assert.equal((await call('/v1/homes/release', HOME, aldric)).status, 200);
  oldHome('Mara', 'char-mara');
  assert.deepEqual((await call('/v1/homes/decor', HOME, mara)).body.hidden, [], 'the next owner walks into the room as Daggerfall furnished it');
  // the client's door: the whole list, the owner's character
  const posts = [];
  const session = new Map([[SESSION_KEY, JSON.stringify({ secret: 'sek', id: 'p' })]]);
  const door = accountDecor({ fetch: async (u, i) => { posts.push([u, i]); return { ok: true, status: 200, json: async () => ({ ok: true }) }; }, storage: { getItem: (k) => session.get(k) ?? null } });
  await door.hidden({ ...HOME, character: 'char-me', keys: ['m1:2'], extra: 'dropped' });
  assert.equal(new URL(posts[0][0]).pathname, '/v1/homes/decor/hidden');
  assert.equal(posts[0][1].headers.authorization, 'Bearer sek', 'the one session, as every write');
  assert.deepEqual(JSON.parse(posts[0][1].body), { ...HOME, character: 'char-me', keys: ['m1:2'] }, 'only what the service reads');
  const mig = src('server-account/migrations/0015_home_hidden.sql');
  assert.match(mig, /FOREIGN KEY \(map_id, building_key\) REFERENCES homes\(map_id, building_key\) ON DELETE CASCADE/);
});

test('BASE-HIDE the save: an offline room\'s list rides its scene, and a sale brings the furniture back for its next owner', () => {
  const c = createSceneCache();
  const s = interiorSceneName(7, 9);
  cacheScene(c, s, { hiddenBase: ['m1:41000', 5, 'f2:210.3'] });
  assert.deepEqual(c.scenes.get(s).hiddenBase, ['m1:41000', 'f2:210.3'], 'a name is a string');
  assert.equal(clearSceneHidden(c, s), 2);
  assert.deepEqual(restoreCachedScene(c, s).hiddenBase, []);
  assert.equal(clearSceneHidden(c, interiorSceneName(1, 1)), 0, 'a room never cached has nothing out');
});

test('BASE-HIDE the tool: the house stands the change at once and says it; an online home writes the room\'s whole list first and stands it once the service has it - a refusal, or a visit that ended, stands nothing; a piece that holds anything never goes; free (mutants: the write skipped, the refusal stood, the holder taken out)', async () => {
  const r = baseRoom();
  const chest = { items: [{ name: 'Ruby' }] };
  r.add('m0:41100', 41100);
  r.add('m1:41032', 41032, chest);
  r.flat('f0:210.3', [210, 3], true);
  const house = toolRig({ base: r.base });
  assert.equal(await house.tool.setBase(['m0:41100'], true), true);
  assert.deepEqual(r.base.hidden(), ['m0:41100']);
  assert.match(house.said.at(-1), /taken out\.$/);
  assert.equal(await house.tool.setBase(['m1:41032'], true), false, 'the chest holds a ruby');
  assert.equal(await house.tool.setBase(['m0:41100'], true), false, 'already out');
  assert.deepEqual(house.w.paid, [], 'free');
  assert.equal(await house.tool.setBase(['m0:41100', 'f0:210.3'], false), true, 'the one out comes back; the one in is left be');
  assert.deepEqual(r.base.hidden(), []);
  // an online home: the service first, the whole list
  const writes = [];
  let answer = { ok: true };
  const homeDecor = { hidden: async (b) => { writes.push(b); return answer; } };
  const home = toolRig({ room: { kind: 'home', where: 'Your home', mapId: 5, buildingKey: 6 }, homeDecor, base: r.base });
  r.base.setHidden(['m88:1']);   // a name this layout lacks, kept
  assert.equal(await home.tool.setBase(['f0:210.3'], true), true);
  assert.deepEqual(writes.at(-1), { mapId: 5, buildingKey: 6, character: 'char-me', keys: ['f0:210.3', 'm88:1'] }, 'the room\'s whole list, the kept name among it');
  assert.deepEqual(r.base.hidden(), ['f0:210.3', 'm88:1']);
  answer = { ok: false, error: 'no-home' };
  assert.equal(await home.tool.setBase(['m0:41100'], true), false);
  assert.deepEqual(r.base.hidden(), ['f0:210.3', 'm88:1'], 'refused: the room stands as it was');
  assert.equal(home.said.at(-1), 'refused: no-home');
  answer = { ok: true };
  const slow = { hidden: async () => { home2.setVisit(2); return { ok: true }; } };
  const home2 = toolRig({ room: { kind: 'home', where: 'Your home', mapId: 5, buildingKey: 6 }, homeDecor: slow, base: r.base });
  assert.equal(await home2.tool.setBase(['m0:41100'], true), false, 'the room left before the answer');
  assert.equal(r.base.list().find((p) => p.key === 'm0:41100').hidden, false);
  const none = toolRig({ base: null });
  assert.equal(await none.tool.setBase(['m0:41100'], true), false, 'no furnishable room, nothing to take out');
});

test('BASE-HIDE the panel: "Built in" lists the room\'s own furniture nearest first, each in the room or out and how far; a piece chosen goes out or comes back; the room\'s two buttons take all out (never a holder) and put all back; a holder says why (mutants: the holder\'s button live, the all-out taking a holder, the tab uncounted)', () => {
  const doc = fakeDoc();
  const calls = [];
  const panel = createDecorPanel({ doc, win: fakeWin(), onPlace() {}, onBase: (keys, out) => calls.push([keys, out]), thumbOf: async () => null });
  const base = [
    { key: 'm0:41100', shape: 'm41100', name: 'Table', kind: 'furniture', model: 41100, flat: null, hidden: false, holds: false, dist: 1.4 },
    { key: 'm1:41032', shape: 'm41032', name: 'Chest', kind: 'storage', model: 41032, flat: null, hidden: false, holds: true, dist: 2.6 },
    { key: 'f0:210.3', shape: 'f210.3', name: 'Candle', kind: 'light', model: null, flat: [210, 3], hidden: true, holds: false, dist: 3.2 },
  ];
  const view = (over = {}) => ({ where: 'Your house', entries: [], progress: 1, ready: true, gold: 0, count: 0, cap: 200, placed: [], own: [], base, ...over });
  panel.open(view());
  const root = panel.root;
  const tab = all(root, 'dfdecor-chip').find((c) => c.textContent === 'Built in (3)');
  assert.ok(tab, 'the fourth tab, counted');
  tab.fire('click');
  const rowsNow = () => all(root, 'dfdecor-row');
  assert.deepEqual(rowsNow().map((r) => r.dataset.key), ['m0:41100', 'm1:41032', 'f0:210.3'], 'as the tool hands them - nearest first');
  assert.equal(decorBaseSub(base[0]), 'In the room - 1 m away');
  assert.equal(decorBaseSub(base[2]), 'Taken out - 3 m away');
  const btn = (label) => all(root, 'dfdecor-btn').find((b) => b.textContent === label);
  rowsNow()[0].fire('click');
  assert.equal(btn('Take out').disabled, false);
  btn('Take out').fire('click');
  assert.deepEqual(calls.at(-1), [['m0:41100'], true]);
  rowsNow()[1].fire('click');
  assert.equal(all(root, 'dfdecor-btn').find((b) => b.textContent === 'Take out').disabled, true, 'a chest holding things stays');
  assert.equal(one(root, 'dfdecor-pick-why').textContent, DECOR_HOLDS_LINE);
  rowsNow()[2].fire('click');
  btn('Put back').fire('click');
  assert.deepEqual(calls.at(-1), [['f0:210.3'], false]);
  btn('Take all out').fire('click');
  assert.deepEqual(calls.at(-1), [['m0:41100'], true], 'all out: never the one out already, never a holder');
  btn('Put all back').fire('click');
  assert.deepEqual(calls.at(-1), [['f0:210.3'], false]);
  panel.update(view({ base: [] }));
  assert.equal(one(root, 'dfdecor-empty').textContent, DECOR_BASE_EMPTY, 'a room with nothing of its own');
});

test('BASE-HIDE by source: the build stands a furnishable room\'s props and flats one by one - never the ladder or the machinery, never the merge, each its own bucket, batch and light - and frees what is out; the host builds it so for an online home, a house or a ship, skips a piece out among its targets, keeps the list in the scene (an online home\'s the service\'s), stands the service\'s list and brings it back at a sale', () => {
  const c = src('src/scenes/interiorContext.js');
  assert.match(c, /const base = opts\.baseEditable \? createBaseRoom\(\{ drawList, batches: \(\) => billboardBatches, lights: \(\) => lights, collider \}\) : null;/);
  assert.match(c, /const baseKey = base && p\.objectType === PROP_MODEL_TYPE && p\.modelIdNum !== LADDER_MODEL_ID && p\.modelIdNum !== MACHINERY_MODEL_ID\s*\n\s*\? decorBaseModelKey\(pi, p\.modelIdNum\) : null;/, 'furniture, not the building\'s workings');
  assert.match(c, /if \(!baseKey && cpu\.normals && cpu\.uvs\) \{ staticBuilder\.add\(/, 'never the merge');
  assert.match(c, /collider\.addMesh\(baseKey \? baseBucketOf\(baseKey\) : 'interior', cpu\.positions, cpu\.indices, matrix\);/, 'its own bucket');
  assert.match(c, /if \(baseKey\) base\.furnish\(baseKey, containers\[had\[0\]\] \?\? shelves\[had\[1\]\] \?\? beds\[had\[2\]\] \?\? null\);/, 'a cupboard, a shelf or a bed');
  assert.match(c, /const batch = renderer\.createBillboardBatch\(flat\.archive, flat\.record, billboardSize\(t, flat\.record\), \[at\]\);/, 'a flat alone in its batch');
  assert.match(c, /const own = lightsOf\(\[bf\.flat\]\);[\s\S]{0,200}base\.addFlat\(decorBaseFlatKey\(bf\.fi, bf\.flat\.archive, bf\.flat\.record\), \{ flat: \[bf\.flat\.archive, bf\.flat\.record\], batch: bf\.batch, light: own\[0\] \?\? null, at: bf\.at \}\);/, 'and its own light');
  assert.match(c, /for \(const b of base\?\.outBatches\(\) \?\? \[\]\) renderer\.destroyBatch\(b\);/, 'the teardown frees what is out');
  const m = src('src/scenes/worldModes.js');
  assert.match(m, /const baseEditable = !!home \|\| houseOwned \|\| \(building\?\.buildingType === BUILDING_TYPES\.Ship && ownsShip\(playerEntity\)\);/);
  assert.match(m, /houseOwned, peopleVisible, baseEditable,/);
  for (const [list, v] of [['containers', 'c'], ['shelves', 's']]) assert.match(m, new RegExp(`interiorCtx\\.${list}\\.forEach\\(\\(${v}, i\\) => \\{\\s*if \\(${v}\\.hidden\\) return;`), `${list}: a piece out is no target`);
  assert.match(m, /interiorCtx\.beds\?\.forEach\(\(bd, i\) => \{[^\n]*\n\s*if \(bd\.hidden\) return;/);
  assert.match(m, /const hiddenBase = interiorHome \|\| _seatHallVisit \? \[\.\.\._keptHidden\] : \(ctx\.base\?\.hidden\(\) \?\? \[\]\);/, 'the scene keeps the list - an online home\'s save record as it came');   // PIN MOVED (SEAT-HALL): the palace's hall shares the line   // PIN MOVED (AUDIT SEATS-3): the visit's latch (C2)
  assert.match(m, /if \(interiorHome \|\| _seatHallVisit\) _keptHidden = \[\.\.\.\(data\.hiddenBase \?\? \[\]\)\]; else interiorCtx\.base\?\.setHidden\(data\.hiddenBase \?\? \[\]\);/);   // PIN MOVED (SEAT-HALL): the palace's hall shares the line   // PIN MOVED (AUDIT SEATS-3): the visit's latch (C2)
  assert.match(m, /interiorCtx\?\.base\?\.setHidden\(Array\.isArray\(r\.data\.hidden\) \? r\.data\.hidden : \[\]\);/, 'the room its owner cleared, for everyone');
  assert.match(m, /function decorSold\(sceneName, region\) \{\s*clearSceneHidden\(sceneCache\(\), sceneName\);/, 'a sale brings it back');
  assert.match(m, /base: \(\) => interiorCtx\?\.base \?\? null,/, 'the tool\'s door');
});
