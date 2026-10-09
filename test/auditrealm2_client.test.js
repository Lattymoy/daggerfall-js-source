// AUDIT REALM2 (2026-09-28): THE REALM'S CLIENT, AUDITED - C1-C8 and M3-M5 (bible/06-Systems/Realm-Arc.md sections 1-2:
// a realm character's truth is the account service's; the tab joins under a lease and checkpoints at seq + 1, every two
// real minutes, before any hand-over and on exit, and no local slot ever holds it).
//   C1 - a town's thanks (RAID4b's own pool) were cleared by a slot's save alone, which a realm character never writes:
//        every join handed them back into the pack.
//   C2 - the page's leave went in `beforeunload`, before the unload guard's "Leave site?" was answered: a Stay played on
//        in a session already left (every checkpoint refused, F9 still saying "Saved to the realm.").
//   C3 - Come Sail Away's record rode a save only with the mod on at boot; online the switch is the player's, and an off
//        boot's first checkpoint dropped every boat and its cargo for good.
//   C4 - every checkpoint was answered with the drain's LAST put: one that landed (its spoils banked) was told it failed
//        when the one behind it did, and the spoils were handed again at the next boot.
//   C5 - the tile rides an HTTP header, and a class name past U+00FF made fetch throw: 'offline' at every checkpoint.
//   C6 - a home's sale gave the owner's things back AFTER the act's closing checkpoint: a tab lost stranded them.
//   C7 - the pause menu's Exit checkpointed straight past P0.5's gate, mid-duel at the duel's 1 health.
//   C8 - a refusal no retry clears ('too-large') was kept and sent again at every checkpoint, the host never told.
//   M3 - the Small ship a crewed boat lends survived a boot with the mod off, and a bank bought it for 85,000.
//   M4 - the developer console (Come Sail Away's giveboat and placeboat among its verbs) stood on an online page.
//   M5 - realmCheckpoint said true for a save its composer refused, and the quiet checkpoint said "You cannot save now."
// Real modules throughout - realmSaves.js over the REAL account Worker and migrations (test/realm2.test.js's device),
// spoilsPool.js, raidSpoils.js, modSaveData.js, comeSailAway.js, banking.js, sceneCache.js, onlineHomes.js,
// unloadGuard.js, consoleCommands.js, onlineCheckpoint.js - and the hosts' own statements sliced out of world.js,
// dungeonContext.js and worldModes.js (test/audit0928_merge.test.js's harness) and mounted over them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import * as acorn from 'acorn';
import worker from '../server-account/src/index.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { SESSION_KEY } from '../src/net/accountClient.js';
import {
  realmIo, realmCreate, realmPut, realmJoin, realmFetch, realmList, openRealmBoot, createRealmSession, realmSummaryOf,
  realmGoldAct, realmTradeEscrow, realmRefusalText, REALM_SAVED_TEXT, realmSaveWithHeld,
} from '../src/systems/realmSaves.js';
import * as realmSaves from '../src/systems/realmSaves.js';
import { createSpoilsPool, spoilsStore, recoverSpoils, SPOILS_STORE_KEY } from '../src/scenes/spoilsPool.js';
import { raidSpoilsList, raidSpoilsDay, RAID_SPOILS_KEYS, RAID_SPOILS_TEXT, RAID_SPOILS_RECORDS_MAX } from '../src/systems/raidSpoils.js';
import { registerModSaveData, modSaveRecords, restoreModSaveRecords, newGameModSaveRecords, _resetModSaveData } from '../src/systems/modSaveData.js';
import { COME_SAIL_AWAY_VENDOR, TEMPORARY_SHIP_SCENES } from '../src/systems/comeSailAway.js';
import * as comeSailAway from '../src/systems/comeSailAway.js';
import { assignShipToPlayer, sellShip, ownsShip, SHIP_TYPES } from '../src/systems/banking.js';
import { createSceneCache, addPermanentScene, removePermanentScene, containsPermanentScene, takeSceneOwn } from '../src/systems/sceneCache.js';
import { sellOnlineHome, HOME_SALE_OUT } from '../src/systems/onlineHomes.js';
import { armUnloadGuard, releaseUnloadGuard } from '../src/systems/unloadGuard.js';
import { installConsoleProbe, registerCommand } from '../src/systems/consoleCommands.js';
import { checkpointAllowed } from '../src/systems/onlineCheckpoint.js';
import { r2, freshSave, layRecord } from './realmSeat.mjs';   // AUDIT REALM2 S1: a realm character's first save is a new one's
import { ACCEPTED } from '../src/net/legalLaw.js';   // TERMS1: a request that makes an account carries the versions ticked

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// ── the account service, real, on node:sqlite (test/realm2.test.js's device) ─────────────────────────────────────────
const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of MIGRATIONS) db.exec(src(`server-account/migrations/${f}`));
  return {
    _raw: db,
    prepare(sql) {
      const stmt = db.prepare(sql);
      const writes = /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(sql);
      let args = [];
      const api = {
        bind(...a) { args = a; return api; },
        async first() { return stmt.get(...args) ?? null; },
        async all() { return { results: stmt.all(...args) }; },
        async run() { const r = stmt.run(...args); return { meta: { changes: Number(r.changes) } }; },
        _result() { const results = stmt.all(...args); return { results, meta: { changes: writes ? Number(db.prepare('SELECT changes() AS c').get().c) : 0 } }; },
      };
      return api;
    },
    async batch(list) {
      db.exec('BEGIN');
      try { const out = list.map((st) => st._result()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}
function fakeStorage() {
  const m = new Map();
  return { _map: m, get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => m.delete(k) };
}
/** A signed-in guest on a device, the Worker behind its fetch - through a real Request, so a header a browser refuses is
 *  refused here too. `door.plan` is a queue of per-request modes ('ok', 'offline', 'lose-answer', 'rate' - the account's
 *  request rate, as the Worker answers it before any route); empty is 'ok'. */
async function device() {
  _resetKeyForTests();
  const env = { DB: d1(), SAVES: r2(), ACCOUNT_VERSION: 'test1' };
  const g = await (await worker.fetch(new Request('https://accounts.invalid/v1/auth/guest', { method: 'POST', body: JSON.stringify(ACCEPTED) }), env)).json();
  const storage = fakeStorage();
  storage.setItem(SESSION_KEY, JSON.stringify({ id: g.id, secret: g.secret }));
  const door = { plan: [], log: [], tiles: [] };
  const fetch = async (url, init) => {
    const mode = door.plan.length ? door.plan.shift() : 'ok';
    door.log.push(`${init?.method ?? 'GET'} ${new URL(url).pathname}${init?.keepalive ? ' keepalive' : ''}`);
    if (init?.headers?.['x-realm-summary'] != null) door.tiles.push(init.headers['x-realm-summary']);
    if (mode === 'offline') throw new TypeError('network');
    if (mode === 'rate') return new Response(JSON.stringify({ error: 'rate' }), { status: 429, headers: { 'content-type': 'application/json' } });
    const res = await worker.fetch(new Request(url, init), env);
    if (mode === 'lose-answer') throw new TypeError('the answer was lost');
    return res;
  };
  return { env, g, storage, door, io: realmIo({ fetch, storage }) };
}
/** A realm character saved at 1, joined as a boot joins it: its session and the service's row. */
async function joined(dev, save = { v: 1, name: 'Nystul', goldPieces: 100 }, onLost = () => {}) {
  const made = (await realmCreate(dev.io, 'Nystul')).data;
  // AUDIT REALM2 S1: the first save a new character's (the service reads it); the record the pin counts from laid over it
  assert.equal((await realmPut(dev.io, made.id, { lease: made.lease, seq: 1 }, JSON.stringify(freshSave({ name: 'Nystul' })))).ok, true);
  layRecord(dev.env, made.id, save);
  const boot = await openRealmBoot({ io: dev.io, id: made.id });
  const session = createRealmSession({ io: dev.io, id: made.id, lease: boot.lease, seq: boot.seq, onLost });
  const row = () => dev.env.DB._raw.prepare('SELECT seq, lease FROM realm_characters WHERE id = ?').get(made.id);
  return { id: made.id, session, row, text: async () => (await realmFetch(dev.io, made.id)).text };
}
const settle = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 0)); };

// ── the hosts' own statements (test/audit0928_merge.test.js's harness) ──────────────────────────────────────────────
function sliced(rel) {
  const S = src(rel);
  const AST = acorn.parse(S, { ecmaVersion: 'latest', sourceType: 'module' });
  const all = (pred, from = AST) => {
    const hits = [];
    (function walk(n) {
      if (!n || typeof n.type !== 'string') return;
      if (pred(n)) hits.push(n);
      for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
    })(from);
    return hits;
  };
  const text = (n) => S.slice(n.start, n.end);
  const one = (hits, what) => { assert.equal(hits.length, 1, `${rel}: ${what} (${hits.length} found)`); return text(hits[0]); };
  /** A function declaration, by name. */
  const fn = (name) => one(all((n) => n.type === 'FunctionDeclaration' && n.id?.name === name), `function ${name}`);
  /** A variable declaration, by the name it declares. */
  const decl = (name) => one(all((n) => n.type === 'VariableDeclaration' && n.declarations.some((d) => d.id?.name === name)), `the declaration of ${name}`);
  /** The one statement straight in `host`'s body (a function declaration) whose text holds `has`. */
  const top = (host, has) => {
    const h = all((n) => n.type === 'FunctionDeclaration' && n.id?.name === host);
    assert.equal(h.length, 1, `${rel}: function ${host}`);
    return one(h[0].body.body.filter((st) => text(st).includes(has)), `${host}'s statement holding ${has}`);
  };
  return { S, fn, decl, top };
}
const scoped = (state) => new Proxy(state, {
  has: (t, k) => k !== '__s',
  get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])),
  set: (t, k, v) => { t[k] = v; return true; },
});
// eslint-disable-next-line no-new-func
const mount = (body, state) => new Function('__s', `with (__s) { ${body} }`)(scoped(state));

const W = sliced('src/scenes/world.js');
const WORLD = 'bootWorld';

// ═══ C1 ══════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** One boot of the world host's spoils half: its two pools (a gate's, a town's), the realm hooks and the realm's save
 *  sink - world.js's own statements - over one device's storage, the crash's door asked for both as it stands up. */
function spoilsBoot(disk, R, checkpoint) {
  const pack = { gold: 0, items: [] };
  const takeSpoil = (p) => { if (p.kind === 'gold') pack.gold += p.gold; else pack.items.push(p.item); };
  let sink = null;
  const host = mount(`
    const _realmSaveHooks = { held: () => null, landed: () => {} };
    ${W.top(WORLD, 'if (realmSession) setRealmSaveSink(')}
    const spoilsPool = createSpoilsPool({ ray: () => null, now: () => 1, take: takeSpoil, store: _spoilsStore, who: () => characterIdOf(playerEntity) });
    const raidSpoils = createSpoilsPool({ ray: () => null, now: () => 1, take: takeSpoil, store: _spoilsStore, who: () => characterIdOf(playerEntity), keys: RAID_SPOILS_KEYS, recordsMax: RAID_SPOILS_RECORDS_MAX });
    ${W.top(WORLD, '_realmSaveHooks.held = ')}
    ${W.top(WORLD, '_realmSaveHooks.landed = ')}
    return { spoilsPool, raidSpoils };
  `, {
    realmSession: { checkpoint },
    setRealmSaveSink: (f) => { sink = f; },
    characterIdOf: () => R, realmSummaryOf: () => null, realmSaveWithHeld, playerEntity: {},
    createSpoilsPool, RAID_SPOILS_KEYS, RAID_SPOILS_RECORDS_MAX, takeSpoil, _spoilsStore: spoilsStore(disk), console: { warn() {} },
  });
  const store = spoilsStore(disk);
  const back = {
    gate: recoverSpoils(store, takeSpoil, { who: R, saves: [], onHanded: (rec) => host.spoilsPool.adopt(rec) }),
    raid: recoverSpoils(store, takeSpoil, { who: R, saves: [], onHanded: (rec) => host.raidSpoils.adopt(rec), key: RAID_SPOILS_KEYS.store }),
  };
  return { ...host, back, pack, save: (snap) => sink(snap) };
}

test('AUDIT REALM2 C1: a realm checkpoint that lands clears a town\'s thanks as it clears a gate\'s spoils - the realm hooks hold both pools, so the next join hands neither back (mutants: the raid pool unheld, its record never cleared)', async () => {
  const disk = fakeStorage();
  const R = 'r' + 'ab'.repeat(10);
  const one = spoilsBoot(disk, R, async () => ({ ok: true, seq: 2 }));
  assert.deepEqual(one.back, { gate: 0, raid: 0 }, 'a first boot: nothing on the device');
  // a town defended (world.js grantRaidSpoils) and a boss's spoils outside a court (grantSpoilsOutside)
  assert.equal(one.raidSpoils.grant({ day: raidSpoilsDay('k:1:40:7'), acct: 'acct-a', roll: () => raidSpoilsList(0xC0FFEE, 30, 2), text: RAID_SPOILS_TEXT.granted, owner: R }), true);
  assert.equal(one.spoilsPool.grant({ day: 700, seed: 99, level: 30, acct: 'acct-a' }), true);
  assert.ok(one.pack.items.length > 0 && one.pack.gold > 0, 'both in the pack');
  assert.equal(JSON.parse(disk.getItem(RAID_SPOILS_KEYS.store)).length, 1, 'the thanks kept on the device until a save holds them');
  one.save({ v: 1 });   // the two-minute checkpoint, composed holding both
  await settle();
  assert.equal(disk.getItem(SPOILS_STORE_KEY), null, 'the gate\'s record cleared (REALM P1.3)');
  assert.equal(disk.getItem(RAID_SPOILS_KEYS.store), null, 'and the town\'s - the realm checkpoint holds them too');
  const two = spoilsBoot(disk, R, async () => ({ ok: true, seq: 3 }));
  assert.deepEqual(two.back, { gate: 0, raid: 0 }, 'Exit, Play again: nothing handed back - the realm\'s record already holds them');
  assert.deepEqual([two.pack.gold, two.pack.items.length], [0, 0]);
  // a checkpoint that never lands clears nothing: the thanks come back at the next boot, as a crash's do
  const three = spoilsBoot(disk, R, async () => ({ ok: false, error: 'offline' }));
  three.raidSpoils.grant({ day: raidSpoilsDay('k:2:41:8'), acct: 'acct-a', roll: () => raidSpoilsList(0xBEEF, 30, 1), text: RAID_SPOILS_TEXT.granted, owner: R });
  three.save({ v: 1 });
  await settle();
  assert.equal(JSON.parse(disk.getItem(RAID_SPOILS_KEYS.store)).length, 1, 'unlanded: kept');
  assert.ok(spoilsBoot(disk, R, async () => ({ ok: true })).back.raid > 0, 'and handed at the next boot');
});

// ═══ C2 ══════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('AUDIT REALM2 C2: a page kept in the back-forward cache joins again when it is shown - onto the record it left, at its own sequence; a record another moved meanwhile ends the session rather than be written over (mutants: no rejoin, the sequence unasked)', async () => {
  const dev = await device();
  const lost = [];
  const c = await joined(dev, { v: 1, name: 'Nystul' }, (why) => lost.push(why));
  assert.deepEqual(await c.session.checkpoint('{"v":2}'), { ok: true, seq: 2 });
  assert.equal(typeof c.session.rejoin, 'function', 'a session can join again');
  assert.deepEqual(await c.session.rejoin(), { ok: false, error: 'joined' }, 'a session still playing has nothing to rejoin');
  await c.session.leave({ keepalive: true });   // pagehide, the page put in the cache
  assert.equal(c.row().lease, null, 'the lease given up');
  assert.deepEqual(await c.session.rejoin(), { ok: true, seq: 2 }, 'shown again: joined at the sequence it left');
  assert.equal(c.session.lost, null);
  assert.match(c.row().lease, /^[0-9a-f]{32}$/, 'a new lease');
  assert.deepEqual(await c.session.checkpoint('{"v":3}'), { ok: true, seq: 3 }, 'and its checkpoints land again');
  assert.equal(await c.text(), '{"v":3}');
  // put away again - and meanwhile another tab joined the character and saved it
  await c.session.leave({ keepalive: true });
  const other = (await realmJoin(dev.io, c.id)).data;
  assert.equal((await realmPut(dev.io, c.id, { lease: other.lease, seq: 4 }, '{"v":"theirs"}')).ok, true);
  assert.deepEqual(await c.session.rejoin(), { ok: false, error: 'seq' }, 'the record moved without this tab: never written over');
  assert.deepEqual(lost, ['seq'], 'the session ends, told once - to the door, where a join reads the record');
  assert.deepEqual(await c.session.checkpoint('{"v":"mine"}'), { ok: false, error: 'seq' });
  assert.equal(await c.text(), '{"v":"theirs"}');
});

test('AUDIT REALM2 C2 in the host: beforeunload gives no lease up (the unload guard asks first, and a Stay plays on in a live session); the page\'s going (pagehide) leaves with keepalive, and a page the cache kept joins again when shown (mutants: the leave back in beforeunload, no pagehide, no pageshow)', async () => {
  const dev = await device();
  const lost = [];
  const c = await joined(dev, { v: 1, name: 'Nystul' }, (why) => lost.push(why));
  const win = new EventTarget();
  win.document = new EventTarget();
  const ev = (type, extra = {}) => Object.assign(new Event(type, { cancelable: true }), extra);
  releaseUnloadGuard();
  armUnloadGuard(() => true, win);   // world.js armUnloadGuard(() => playerSpawned), armed before the handler
  const written = [];
  // FIELD BUGS 29h (BOOT-HIDE): the exit save named at the checkpoint, handed to the page with the checkpoint's doors
  mount(`${W.top(WORLD, 'const exitAutosave = () => {')}\n${W.top(WORLD, "addEventListener('beforeunload'")}`, {
    addEventListener: (t, f) => win.addEventListener(t, f), online: {}, playerSpawned: true, seatOut: () => false, duelLeaveNow: () => {},
    realmSession: c.session, modes: { quickSaveNow: (n) => written.push(n), deathUp: () => false }, worldQuickSave: null,
    exitAutosaveNames: () => ['QuickSave'], playerEntity: {}, townTalk: { overlay: null }, DeathScreen: class {},
  });
  let exitHook = null;
  const realmHooks = {
    realmSession: c.session, setBeforeTitleExit: (f) => { exitHook = f; }, whenPageHides: realmSaves.whenPageHides, whenPageGoes: realmSaves.whenPageGoes,
    globalThis: win, online: null, onlineCheckpoint: () => false, realmCheckpoint: () => false, duelLeaveNow: () => {}, REALM_EXIT_WAIT_MS: 10,
  };
  mount(W.top(WORLD, 'whenPageGoes('), realmHooks);   // the page's going: the lease, at the checkpoint
  mount(W.top(WORLD, 'setBeforeTitleExit('), realmHooks);   // the title exit and the page put away: the checkpoint's doors (BOOT-HIDE)
  assert.equal(typeof exitHook, 'function');
  const before = dev.door.log.length;
  const unload = ev('beforeunload');
  win.dispatchEvent(unload);
  await settle();
  assert.equal(unload.defaultPrevented, true, 'the guard asks "Leave site?" - and the player presses Stay');
  assert.deepEqual([c.session.lost, dev.door.log.slice(before), written], [null, [], []], 'nothing left, nothing sent, no slot written');
  assert.deepEqual(await c.session.checkpoint('{"v":"after the stay"}'), { ok: true, seq: 2 }, 'the checkpoints after the Stay land');
  win.dispatchEvent(ev('pagehide', { persisted: true }));   // the page goes - into the back-forward cache
  await settle();
  assert.equal(c.session.lost, 'left');
  assert.ok(dev.door.log.at(-1).endsWith('/v1/realm/leave keepalive'), `the leave, with keepalive (${dev.door.log.at(-1)})`);
  assert.equal(c.row().lease, null);
  win.dispatchEvent(ev('pageshow', { persisted: false }));   // an ordinary show is no return
  await settle();
  assert.equal(c.session.lost, 'left');
  win.dispatchEvent(ev('pageshow', { persisted: true }));   // Back: the cache's page shown again
  await settle();
  assert.equal(c.session.lost, null, 'joined again');
  assert.deepEqual(await c.session.checkpoint('{"v":"back"}'), { ok: true, seq: 3 });
  assert.deepEqual(lost, []);
  releaseUnloadGuard();
});

/** A composer's realm arm (world.js worldQuickSave, dungeonContext.js quickSave) - its own two lines. */
function realmArm(rel) {
  const S = src(rel);
  const at = S.indexOf('const into = sink ?? realmSaveSink();');
  assert.ok(at > 0, `${rel}: the realm arm`);
  const end = S.indexOf('\n', S.indexOf('\n', at) + 1);
  return S.slice(at, end);
}

test('AUDIT REALM2 C2: F9 says what the realm answered - "Saved to the realm." only for a checkpoint that landed; one refused says so and why, in both composers; a quiet checkpoint says nothing either way (mutant: the word said before the answer)', async () => {
  for (const [rel, hud] of [['src/scenes/world.js', 'townTalk'], ['src/scenes/dungeonContext.js', 'hudText']]) {
    const said = [];
    const arm = mount(`return (snap, sink, quiet) => { ${realmArm(rel)}\nreturn 'slot'; };`, {
      realmSaveSink: () => null, REALM_SAVED_TEXT, sayRealmSave: realmSaves.sayRealmSave,
      [hud]: { say: (t) => said.push(t), add: (t) => said.push(t) },
    });
    assert.equal(arm({ v: 1 }, () => Promise.resolve({ ok: false, error: 'left' }), false), true, `${rel}: handed to the realm, no slot`);
    await settle();
    assert.deepEqual(said, ['Not saved to the realm. You left the realm.'], `${rel}: a refused save says so`);
    said.length = 0;
    arm({ v: 1 }, () => Promise.resolve({ ok: false, error: 'offline' }), false);
    await settle();
    assert.deepEqual(said, [`Not saved to the realm. ${realmRefusalText('offline')}`], `${rel}: and why`);
    said.length = 0;
    arm({ v: 1 }, () => Promise.resolve({ ok: true, seq: 9 }), false);
    await settle();
    assert.deepEqual(said, [REALM_SAVED_TEXT], `${rel}: a landed one is saved`);
    said.length = 0;
    arm({ v: 1 }, () => Promise.resolve({ ok: false, error: 'offline' }), true);
    arm({ v: 1 }, () => Promise.resolve({ ok: true, seq: 9 }), true);
    await settle();
    assert.deepEqual(said, [], `${rel}: a quiet checkpoint says nothing`);
  }
  // the realm's sink answers the checkpoint's outcome - what the composers wait on
  const dev = await device();
  const c = await joined(dev);
  let sink = null;
  mount(`const _realmSaveHooks = { held: () => null, landed: () => {} };\n${W.top(WORLD, 'if (realmSession) setRealmSaveSink(')}`, {
    realmSession: c.session, setRealmSaveSink: (f) => { sink = f; }, characterIdOf: () => c.id, realmSummaryOf, realmSaveWithHeld, playerEntity: { level: 2 },
  });
  assert.deepEqual(await sink({ v: 2 }), { ok: true, seq: 2 });
  await c.session.leave();
  assert.deepEqual(await sink({ v: 3 }), { ok: false, error: 'left' });
});

// ═══ C3 and M3 ═══════════════════════════════════════════════════════════════════════════════════════════════════════

/** A boat's record as the runtime writes it (comeSailAway.js getSaveData): one crewed hull with a hold, and a packed
 *  cargo; `helm` a record taken at its helm with the Small ship lent. */
const csaRecord = (helm = false) => ({
  worldCompensation: { x: 0, y: 0, z: 0 },
  placedBoats: [{ UID: 101, Hull: 2, Variant: 0, MapPixel: { X: 200, Y: 300 }, Position: { x: 1, y: 34, z: 2 }, Direction: { x: 0, y: 0, z: 1 },
    Items: [{ templateIndex: 120, material: 9, name: 'Daedric Katana' }, { templateIndex: 104, name: 'Ebony Dagger' }], lights: false, inside: false }],
  placedMapMarkers: [], currentBoat: helm ? 0 : -1, TemporaryShip: helm, sailPosition: 0,
  moveVectorCurrent: { x: 0, y: 0, z: 0 }, moveVectorTarget: { x: 0, y: 0, z: 0 }, windVector: { x: 0, y: 0, z: 1 },
  packedCargoes: { 77: [{ templateIndex: 511, name: 'Ruby' }] },
});

/** world.js's Come Sail Away registration - its own statement - for a boot with the mod on (`runtime`) or off (null). */
function csaBoot(runtime, playerEntity) {
  _resetModSaveData();
  registerModSaveData('sigil-broker-stand-in', { newSaveData: () => ({}), getSaveData: () => ({ offers: 6 }), restoreSaveData: () => {} });
  const cache = createSceneCache();
  playerEntity.sceneCache = cache;
  mount(W.top(WORLD, 'registerModSaveData(COME_SAIL_AWAY_VENDOR'), {
    csaRuntime: runtime, registerModSaveData, COME_SAIL_AWAY_VENDOR, comeSailAwayCarrier: comeSailAway.comeSailAwayCarrier,
    playerEntity, assignShipToPlayer, SHIP_TYPES, removePermanentScene, _sceneCache: () => cache,
    shipPermanentScenes: (s) => { for (const n of TEMPORARY_SHIP_SCENES) if (s === SHIP_TYPES.Small) addPermanentScene(cache, n); },
    // the mod-on arm's own calls, answered and ignored
    csa: { preload() {}, models: null }, registerCommand() {}, CSA_CONSOLE: comeSailAway.CONSOLE, registerItemUseHandler() {}, csaOn: () => true,
    playerTicker: { subscribe() {} }, csaCall: (f) => f(), WEATHER_TYPES: [],
  });
  return cache;
}

test('AUDIT REALM2 C3: with Come Sail Away off its record is carried whole - the boats, their holds and the packed cargoes ride every save, the realm\'s checkpoint too, and the mod back on finds them; a new character carries none; the mod on registers its runtime as before (mutant: the carrier unregistered)', async () => {
  const pe = { ownedShip: SHIP_TYPES.None };
  csaBoot(null, pe);
  restoreModSaveRecords({ [COME_SAIL_AWAY_VENDOR]: csaRecord() });   // the load's mod loop (world.js worldQuickLoad)
  assert.deepEqual(modSaveRecords()[COME_SAIL_AWAY_VENDOR], csaRecord(), 'the save writes the record it loaded');
  // ...through the realm: the two-minute checkpoint of an off boot, then a boot with the mod on
  const dev = await device();
  const c = await joined(dev, { v: 1, name: 'Nystul', modData: { [COME_SAIL_AWAY_VENDOR]: csaRecord() } });
  const boot = await openRealmBoot({ io: dev.io, id: c.id });
  const s = createRealmSession({ io: dev.io, id: c.id, lease: boot.lease, seq: boot.seq });
  csaBoot(null, pe);
  restoreModSaveRecords(boot.snap.modData);
  assert.equal((await s.checkpoint(JSON.stringify({ v: 1, name: 'Nystul', modData: modSaveRecords() }))).ok, true);
  const kept = JSON.parse(await c.text()).modData[COME_SAIL_AWAY_VENDOR];
  assert.deepEqual([kept?.placedBoats?.length, kept?.placedBoats?.[0]?.Items?.length, kept?.packedCargoes?.[77]?.length], [1, 2, 1], 'the realm\'s record keeps the boat, its hold and the packed cargo');
  let restored = null;
  const runtime = { newSaveData: () => ({ placedBoats: [] }), getSaveData: () => restored, restoreSaveData: (d) => { restored = d; } };
  csaBoot(runtime, pe);
  restoreModSaveRecords(JSON.parse(await c.text()).modData);
  assert.deepEqual(restored, csaRecord(), 'the mod back on: its boats');
  assert.equal(modSaveRecords()[COME_SAIL_AWAY_VENDOR], restored, 'the runtime is the mod\'s record with it on');
  // a new game with the mod off: nothing carried into the next character
  csaBoot(null, pe);
  restoreModSaveRecords({ [COME_SAIL_AWAY_VENDOR]: csaRecord() });
  newGameModSaveRecords();
  assert.equal(modSaveRecords()[COME_SAIL_AWAY_VENDOR] ?? null, null, 'a new character carries no boat');
  restoreModSaveRecords({});   // a save that never had the mod
  assert.equal(JSON.stringify(modSaveRecords()).includes(COME_SAIL_AWAY_VENDOR), false, 'and writes none');
  _resetModSaveData();
});

test('AUDIT REALM2 M3: a record taken at a crewed helm lent the Small ship - with the mod off at the next boot the ship is taken back as the record loads (ReturnTemporaryShip\'s steps), before a bank can buy it for 85,000, and the helm is let go in the record (mutants: the ship kept, the helm kept)', () => {
  const pe = { ownedShip: SHIP_TYPES.None };
  const cache = csaBoot(null, pe);
  assignShipToPlayer(pe, SHIP_TYPES.Small, { addPermanentScene: () => { for (const n of TEMPORARY_SHIP_SCENES) addPermanentScene(cache, n); } });   // the save's character, as StartSailing lent it
  assert.equal(ownsShip(pe), true, 'the premise: the loaded character holds the lent ship');
  restoreModSaveRecords({ [COME_SAIL_AWAY_VENDOR]: csaRecord(true) });
  assert.equal(pe.ownedShip, SHIP_TYPES.None, 'taken back as the record loads');
  assert.equal(TEMPORARY_SHIP_SCENES.some((n) => containsPermanentScene(cache, n)), false, 'its scenes dropped, as StopSailing drops them');
  const accounts = Array.from({ length: 62 }, () => ({ accountGold: 0 }));
  assert.deepEqual(sellShip(accounts, 17, pe), { kind: 'none' }, 'no ship to sell');
  assert.equal(accounts[17].accountGold, 0);
  const rec = modSaveRecords()[COME_SAIL_AWAY_VENDOR];
  assert.deepEqual([rec.TemporaryShip, rec.currentBoat, rec.placedBoats.length, rec.placedBoats[0].Items.length], [false, -1, 1, 2], 'the helm let go in the record; the boats kept');
  // a ship of one's own is never taken: a record with no lent ship leaves the character's ship alone
  const own = { ownedShip: SHIP_TYPES.None };
  csaBoot(null, own);
  assignShipToPlayer(own, SHIP_TYPES.Large);
  restoreModSaveRecords({ [COME_SAIL_AWAY_VENDOR]: csaRecord(false) });
  assert.equal(own.ownedShip, SHIP_TYPES.Large, 'the bought ship stays');
  _resetModSaveData();
});

// ═══ C4 ══════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('AUDIT REALM2 C4: each checkpoint is answered by the put that carried its save - one that landed is told so though the one behind it fails; one replaced before it left is answered by the newer one\'s put (mutant: the landed one told the next one\'s failure)', async () => {
  const dev = await device();
  const c = await joined(dev);
  dev.door.plan = ['ok', 'offline'];
  const a = c.session.checkpoint('{"a":1}');
  const b = c.session.checkpoint('{"b":1}');
  assert.deepEqual(await a, { ok: true, seq: 2 }, 'A landed - and says so');
  assert.deepEqual(await b, { ok: false, error: 'offline' }, 'B, behind it, did not');
  assert.equal(c.session.waiting, true, 'B waits for the next checkpoint');
  assert.equal(await c.text(), '{"a":1}');
  // replaced before it left: answered with the newer one's put
  const p = c.session.checkpoint('{"p":1}');
  const q = c.session.checkpoint('{"q":1}');
  const r = c.session.checkpoint('{"r":1}');
  assert.deepEqual(await p, { ok: true, seq: 3 });
  assert.deepEqual([await q, await r], [{ ok: true, seq: 4 }, { ok: true, seq: 4 }], '"q" never left: "r" carried it');
  assert.equal(await c.text(), '{"r":1}');
  // one asked the moment another is answered (its caller's own next step) is sent and answered too - never left waiting
  // on a drain that has already ended
  assert.deepEqual(await c.session.checkpoint('{"f":1}').then(() => c.session.checkpoint('{"g":1}')), { ok: true, seq: 6 });
  // lost mid-drain: the save that waited never left, and says so
  const d = c.session.checkpoint('{"d":1}');
  const e = c.session.checkpoint('{"e":1}');
  c.session.abandon('unknown');
  assert.deepEqual([await d, await e], [{ ok: true, seq: 7 }, { ok: false, error: 'unknown' }]);
});

test('AUDIT REALM2 C4 in the host: the gate\'s spoils a landed checkpoint held are cleared though the checkpoint behind it fails - the next join hands none back', async () => {
  const dev = await device();
  const c = await joined(dev);
  const disk = fakeStorage();
  const one = spoilsBoot(disk, c.id, (text, summary) => c.session.checkpoint(text, summary));
  one.spoilsPool.grant({ day: 700, seed: 99, level: 8, acct: 'acct-a' });
  dev.door.plan = ['ok', 'offline'];
  one.save({ v: 1, gold: one.pack.gold });   // A: the periodic checkpoint, holding the spoils
  one.save({ v: 1, gold: one.pack.gold });   // B: queued behind it (a hidden page, a second F9) - never gets out
  await settle();
  assert.equal(c.session.seq, 2, 'A landed');
  assert.equal(disk.getItem(SPOILS_STORE_KEY), null, 'and its spoils are the realm\'s: their device record cleared');
  assert.equal(spoilsBoot(disk, c.id, async () => ({ ok: true })).back.gate, 0, 'nothing handed again at the next join');
});

// ═══ C5 ══════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('AUDIT REALM2 C5: a tile\'s class name past Latin-1 rides the checkpoint\'s header as JSON escapes - it lands, and the service reads the same name back (mutant: the header raw)', async () => {
  const dev = await device();
  const names = ['Łowca', 'Маг', 'Blade ⚔', 'Mage’s Aide', 'Dragon 🐉', 'Épéiste', 'Spell\\u0041sword "x"'];
  for (const className of names) {
    const made = (await realmCreate(dev.io, 'Nystul')).data;
    // INT2 (PIN MOVED): the tile's level the save's own (a birth's, 1 - the judge holds a summary claiming another), and the
    // answer saying the hold
    const summary = realmSummaryOf({ level: 1, career: { name: className }, race: 'Breton', gender: 'female', faceIndex: 1 });
    const put = await realmPut(dev.io, made.id, { lease: made.lease, seq: 1, summary }, JSON.stringify(freshSave({ v: 1 })));   // world.js realmBirth's (AUDIT REALM2 S1: a new character's)
    assert.deepEqual(put, { ok: true, data: { ok: true, seq: 1, tradeHeld: null } }, `${className}: the birth's put lands`);
    const row = (await realmList(dev.io)).characters.find((ch) => ch.id === made.id);
    assert.equal(row.summary.className, className, `${className}: the service reads the name back`);
    const boot = await openRealmBoot({ io: dev.io, id: made.id });
    const s = createRealmSession({ io: dev.io, id: made.id, lease: boot.lease, seq: boot.seq });
    assert.deepEqual(await s.checkpoint('{"v":2}', summary), { ok: true, seq: 2 }, `${className}: and every checkpoint after`);
    await s.leave();
    await realmSaves.realmDelete(dev.io, made.id);
  }
  assert.equal(dev.door.tiles.length, names.length * 2, 'every put carried its tile');
  for (const t of dev.door.tiles) assert.match(t, /^[\x20-\x7e]*$/, `the header is ASCII, whatever the name (${t})`);
  assert.deepEqual(JSON.parse(dev.door.tiles[0]).className, names[0], 'and JSON reads it back');
});

// ═══ C6 ══════════════════════════════════════════════════════════════════════════════════════════════════════════════

const M = sliced('src/scenes/worldModes.js');

test('AUDIT REALM2 C6: a realm home\'s sale gives the owner\'s own things back to the pack inside the act - the act\'s closing checkpoint holds them, and the scene let go; a refused sale moves nothing (mutant: the things back after the act)', async () => {
  const run = async (answer) => {
    const cache = createSceneCache();
    cache.scenes.set('Home', { decorOwn: { a: { name: 'Ebony Mail' }, b: { name: 'Daedric Katana' } } });
    addPermanentScene(cache, 'Home');
    const state = { pack: ['Wabbajack'], bank: 0 };
    const checkpoints = [];
    const snap = () => ({ pack: [...state.pack], own: Object.keys(cache.scenes.get('Home')?.decorOwn ?? {}), kept: containsPermanentScene(cache, 'Home'), bank: state.bank });
    const session = { transact: async (call) => call({ id: 'r' + 'a'.repeat(20), lease: 'l'.repeat(32), seq: 5 }), abandon() {} };
    const said = [];
    const sellHomeAt = mount(`${M.fn('sellHomeAt')}\nreturn sellHomeAt;`, {
      host: { onlineHomes: { release: async () => answer }, realmAct: (o) => realmGoldAct({ session, checkpoint: () => { checkpoints.push(snap()); }, wait: async () => {}, ...o }) },
      sellOnlineHome, HOME_SALE_OUT, homeTownOf: () => 1, homeAccount: () => ({ get accountGold() { return state.bank; }, set accountGold(v) { state.bank = v; } }),
      townTalk: { say: (t) => said.push(t) }, accountRefusalText: (e) => `refused: ${e}`, takeSceneOwn, sceneCache: () => cache, homeSceneName: () => 'Home',
      decorPackGive: (it) => state.pack.push(it.name), removePermanentScene, homeSoldLine: (r, d) => `sold ${r + (d ?? 0)}`, ownBackLines: (own) => `${own.length} back`, decorOwnBackLine: () => '',
    });
    await sellHomeAt({ buildingKey: 7, regionIndex: 3 });
    return { checkpoints, now: snap(), said };
  };
  const sold = await run({ ok: true, price: 40_000, refund: 34_000, decorBack: 0, data: { realm: { seq: 6 } } });
  assert.equal(sold.checkpoints.length, 2, 'the purse before, the outcome after');
  assert.deepEqual(sold.checkpoints.at(-1), { pack: ['Wabbajack', 'Ebony Mail', 'Daedric Katana'], own: [], kept: false, bank: 34_000 }, 'the closing checkpoint holds the things in the pack, the refund and the scene let go');
  assert.deepEqual(sold.now, sold.checkpoints.at(-1), 'nothing moves after it');
  assert.deepEqual(sold.said, ['sold 34000 2 back']);
  const refused = await run({ ok: false, error: 'no-home' });
  assert.deepEqual(refused.now, { pack: ['Wabbajack'], own: ['a', 'b'], kept: true, bank: 0 }, 'a refused sale: the house and its things as they were');
  assert.deepEqual(refused.said, ['refused: no-home']);
});

// ═══ C7 ══════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('AUDIT REALM2 C7: the pause menu\'s Exit ends a duel first and passes P0.5\'s gate - the last checkpoint is the healed character, never the duel\'s 1 health or the opponent\'s spells, and none out of the seat (mutants: realmCheckpoint straight, no duelLeaveNow)', async () => {
  const run = async ({ seatOut = false } = {}) => {
    const log = [];
    const playerEntity = { health: 1, maxHealth: 80, fatigue: 3, magicka: 2, maxMagicka: 40, activeEffects: [{ bundleDuel: true, name: 'Opponent\'s Poison' }, { name: 'Mine' }] };
    const duelMgr = { duel: { live: true }, reset() { log.push('duel ended'); this.duel = null; } };
    const state = {
      playerEntity, duelMgr, log, checkpointAllowed, online: {}, playerSpawned: true, seatOut: () => seatOut, performance: { now: () => 1 },
      ownWalkWaiting: () => false,   // AUDIT LIVED1b S1: no raise waiting
      stampItemIds: () => 0,   // INT4 (PIN MOVED): a checkpoint stamps the valuable pieces' ids first - a name the fragment now reads
      townTalk: { overlay: null, say: () => {} }, DeathScreen: class {}, QUICK_SAVE_NAME: 'QuickSave', exitAutosaveNames: () => [], worldQuickSave: null,
      modes: { deathUp: () => false, quickSaveNow: () => { log.push({ health: playerEntity.health, effects: playerEntity.activeEffects.map((a) => a.name) }); return true; } },
      maxFatigue: () => 50, surfacePlayer: () => {}, console: { error() {} },
      realmSession: { lost: null, leave: async () => { log.push('leave'); return { ok: true }; } },
      whenPageHides: () => {}, whenPageGoes: () => {}, globalThis: new EventTarget(), REALM_EXIT_WAIT_MS: 10,
    };
    let hook = null;
    state.setBeforeTitleExit = (f) => { hook = f; };
    mount(`
      let _checkpointAt = -Infinity;
      ${W.decl('duelHeal')}
      ${W.decl('duelLeaveNow')}
      ${W.decl('onlineCheckpoint')}
      ${W.fn('realmCheckpoint')}
      ${W.top(WORLD, 'setBeforeTitleExit(')}
    `, state);
    await hook();
    return log;
  };
  assert.deepEqual(await run(), ['duel ended', { health: 80, effects: ['Mine'] }, 'leave'], 'the duel ends and heals, then the checkpoint, then the leave');
  assert.deepEqual(await run({ seatOut: true }), ['duel ended', 'leave'], 'out of the seat: no checkpoint (P0.5), the leave still goes');
});

// ═══ C8 ══════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('AUDIT REALM2 C8: a checkpoint the service refuses for good (the save too big) ends the session with the reason, once, and sends nothing more; a refusal that may clear (the service\'s storage away, the request rate, no answer) keeps the save for the next (mutant: every refusal retried)', async () => {
  const dev = await device();
  const lost = [];
  const c = await joined(dev, { v: 1 }, (why) => lost.push(why));
  // transient: the service's storage away (503), the account's rate (429), no answer - kept, retried, the session stands
  const saves = dev.env.SAVES;
  dev.env.SAVES = null;
  assert.deepEqual(await c.session.checkpoint('{"v":"a"}'), { ok: false, error: 'no-storage' });
  dev.env.SAVES = saves;
  dev.door.plan = ['rate'];
  assert.deepEqual(await c.session.checkpoint('{"v":"b"}'), { ok: false, error: 'rate' });
  dev.door.plan = ['offline'];
  assert.deepEqual(await c.session.checkpoint('{"v":"c"}'), { ok: false, error: 'offline' });
  assert.deepEqual([c.session.lost, c.session.waiting, lost], [null, true, []], 'the session stands, the save waiting');
  assert.deepEqual(await c.session.checkpoint('{"v":"d"}'), { ok: true, seq: 2 }, 'and the next lands');
  // for good: past the service's 4 MB
  const big = JSON.stringify({ v: 1, automap: 'x'.repeat(4 * 1024 * 1024 + 10) });
  assert.deepEqual(await c.session.checkpoint(big), { ok: false, error: 'too-large' });
  assert.deepEqual([c.session.lost, lost], ['too-large', ['too-large']], 'the session ends, the host told once');
  const before = dev.door.log.length;
  assert.deepEqual(await c.session.checkpoint(big), { ok: false, error: 'too-large' });
  assert.equal(dev.door.log.length, before, 'nothing sent again');
  assert.deepEqual(lost, ['too-large']);
  assert.match(realmRefusalText('too-large'), /realm/, 'the door says it in the realm\'s words');
  assert.equal(await c.text(), '{"v":"d"}', 'the realm keeps the last save it took');
});

// ═══ M4 ══════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('AUDIT REALM2 M4: the developer console is never installed on an online page - Come Sail Away\'s giveboat and placeboat, and every other verb, stay offline (REALM P0.1\'s law for ?shot); offline the door stands as E3 made it (mutant: the console online)', () => {
  let ran = 0;
  registerCommand('auditrealm2_mint', 'd', 'u', () => { ran++; return 'minted'; });
  for (const [search, has] of [['online=1&load=1&realm=r0123456789abcdef0123', false], ['online=1&realmnew=1', false], ['load=1', true], ['', true]]) {
    const target = {};
    mount(W.top(WORLD, 'installConsoleProbe()'), { params: new URLSearchParams(search), installConsoleProbe: () => installConsoleProbe(target) });
    assert.equal(typeof target.__console === 'function', has, `?${search}: the console ${has ? 'stands' : 'is refused'}`);
    if (has) assert.equal(target.__console('auditrealm2_mint'), 'minted');
  }
  assert.equal(ran, 2);
});

// ═══ M5 ══════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('AUDIT REALM2 M5: realmCheckpoint answers what its composer did - a save the composer refused (the Ocean Holes descent, the court) is no checkpoint, so a trade\'s hold never begins over the older record; and the quiet checkpoint says nothing of the refusal (mutants: true regardless, the refusal said when quiet)', () => {
  const said = [];
  let answer = false;
  const realmCheckpoint = mount(`${W.fn('realmCheckpoint')}\nreturn realmCheckpoint;`, {
    realmSession: { lost: null }, townTalk: { overlay: null }, DeathScreen: class {}, playerEntity: { health: 10 }, QUICK_SAVE_NAME: 'QuickSave',
    modes: { deathUp: () => false, quickSaveNow: () => answer }, worldQuickSave: null,
    stampItemIds: () => 0,   // INT4 (PIN MOVED): a checkpoint stamps the valuable pieces' ids first - a name the fragment now reads
  });
  assert.equal(realmCheckpoint(), false, 'the composer refused: no checkpoint');
  const session = { transact: () => new Promise(() => {}), abandon() {} };
  assert.equal(realmTradeEscrow({ session, checkpoint: () => realmCheckpoint(), wait: async () => {}, now: () => 0 }).hold(), null, 'so no trade\'s hold begins');
  answer = true;
  assert.equal(realmCheckpoint(), true, 'composed: a checkpoint');
  // the world composer's own refusal, mid-descent: said to F9, never to the quiet checkpoint
  const worldQuickSave = mount(`${W.fn('worldQuickSave')}\nreturn worldQuickSave;`, { ohAbyss: { entering: true }, townTalk: { say: (t) => said.push(t) }, QUICK_SAVE_NAME: 'QuickSave' });
  assert.equal(worldQuickSave('QuickSave', { quiet: true }), false);
  assert.deepEqual(said, [], 'the two-minute checkpoint says nothing');
  assert.equal(worldQuickSave('QuickSave'), false);
  assert.deepEqual(said, ['You cannot save now.'], 'F9 is told');
});
