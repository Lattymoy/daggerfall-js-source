// RESCUE-SAVE (2026-09-30, the outage: SwordsmanEB lost progress; Mac: "Do it") - A SAVE THE SERVICE HAS NOT TAKEN IS
// KEPT ON THE DEVICE. A realm character's save lived in the playing session's memory until a put landed: a page closed,
// reloaded or exited while the service was away took everything since the last checkpoint that landed, and so did an
// ordinary close, whose checkpoint the page's going cuts off (or its keepalive leave lands first and it is refused).
// Now the newest save the session takes is written to the device (systems/realmSaves.js keepUnsent) with the sequence it
// follows - once its put goes unanswered past a grace, at once on a hidden page, or when a put is refused or unanswered -
// and dropped when a put lands with nothing newer behind it; a join whose record still stands at that sequence plays it
// (openRealmBoot `restored`), and a record that moved past it (another device, a trade, an act) drops it unread.
// AUDIT RESCUE-SAVE (2026-09-30, Mac: "Audit this"), its findings pinned below: A1 a kept save's spoils handed twice; A2
// a copy outliving its character; A3 a landed save's spoils handed again when its answer was lost (older than the copy,
// closed by A1's own law); A4 an older tab's copy over a newer tab's; A5 a device out of room dropping the copy it kept;
// A6 a save-sized write at every checkpoint; A7 copies no join can play; A8 the restore said after every close.
// Real modules throughout: realmSaves.js over the REAL account Worker and migrations (test/server/realm2.test.js's device), the
// spoils pools, and world.js's own statements mounted over them (test/systems/auditrealm2_client.test.js's harness).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import * as acorn from 'acorn';
import worker from '../../server-account/src/index.js';
import { _resetKeyForTests } from '../../server-account/src/signing.js';
import { REALM_MAX_BYTES } from '../../server-account/src/realm.js';
import { SESSION_KEY } from '../../src/net/accountClient.js';
import {
  realmIo, realmCreate, realmPut, realmFetch, realmLeave, realmDelete, realmList, openRealmBoot, createRealmSession,
  readUnsent, keepUnsent, forgetUnsent, claimUnsent, sweepUnsent, realmSaveWithHeld, packUnsent, unpackUnsent,
  REALM_UNSENT_PACK_OVER, REALM_UNSENT_PACKED,
  REALM_UNSENT_PREFIX, REALM_UNSENT_GRACE_MS, REALM_HELD_FIELD, REALM_RESTORED_TEXT,
  readStranded, realmStrandedText,
} from '../../src/systems/realmSaves.js';
import { offlineCopyOf } from '../../src/systems/offlineCopy.js';
import { REALM_TEXT_MAX_BYTES } from '../../src/net/realm/realmSaveCodec.js';
import { createSpoilsPool, spoilsStore, recoverSpoils, SPOILS_STORE_KEY, SPOILS_TEXT } from '../../src/scenes/spoilsPool.js';
import { raidSpoilsList, raidSpoilsDay, RAID_SPOILS_KEYS, RAID_SPOILS_TEXT, RAID_SPOILS_RECORDS_MAX } from '../../src/systems/raidSpoils.js';
import { r2, freshSave, layRecord } from '../realmSeat.mjs';
import { ACCEPTED } from '../../src/net/legalLaw.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

const MIGRATIONS = readdirSync(new URL('../../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
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
/** localStorage's shape, counting the copy's writes (A6). */
function fakeStorage() {
  const m = new Map();
  const s = { _map: m, writes: 0, get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), removeItem: (k) => m.delete(k) };
  s.setItem = (k, v) => { if (String(k).startsWith(REALM_UNSENT_PREFIX)) s.writes++; m.set(k, String(v)); };
  return s;
}
const unsentKeys = (storage) => [...storage._map.keys()].filter((k) => k.startsWith(REALM_UNSENT_PREFIX) && !k.endsWith('.lease'));
/** One account on the service, and its devices: each its own storage and its own door, the same Worker behind them.
 *  `door.plan` is a queue of modes for the save's PUTs - every other request passes (REALM-GZIP packs a put before it
 *  leaves, so a leave asked after it can reach the door first): 'ok'; 'offline' (the service away); 'hang' (a put the page never sees
 *  answered - its going cuts it off); 'lose-answer' (it lands, and its answer is lost); 'wait' (held until `door.open()`,
 *  then as 'ok'). Empty is 'ok'. */
async function account() {
  _resetKeyForTests();
  const env = { DB: d1(), SAVES: r2(), ACCOUNT_VERSION: 'test1' };
  const g = await (await worker.fetch(new Request('https://accounts.invalid/v1/auth/guest', { method: 'POST', body: JSON.stringify(ACCEPTED) }), env)).json();
  const device = (storage = fakeStorage()) => {
    storage.setItem(SESSION_KEY, JSON.stringify({ id: g.id, secret: g.secret }));
    let open = () => {};
    const gate = new Promise((r) => { open = r; });
    const door = { plan: [], puts: 0, open: () => open() };
    const fetch = async (url, init) => {
      if (init?.method === 'PUT') door.puts++;   // the puts that reached the door (two sessions' packings race to it)
      const mode = init?.method === 'PUT' && door.plan.length ? door.plan.shift() : 'ok';
      if (mode === 'wait') await gate;
      if (mode === 'offline') throw new TypeError('network');
      if (mode === 'hang') return new Promise(() => {});
      const res = await worker.fetch(new Request(url, init), env);
      if (mode === 'lose-answer') throw new TypeError('the answer was lost');
      return res;
    };
    return { storage, door, io: realmIo({ fetch, storage }) };
  };
  return { env, device };
}
/** The grace's clock, by hand: `fire()` runs what waited it out. */
function clock() {
  const due = new Set();
  return {
    later: (fn) => { const t = { fn }; due.add(t); return () => { due.delete(t); }; },
    fire() { const now = [...due]; due.clear(); for (const t of now) t.fn(); return now.length; },
    get waiting() { return due.size; },
  };
}
/** A session over a boot's join, the grace by hand and the page shown unless `hidden` says; `hide()` puts the page away
 *  (the session's own watch, AUDIT 2 B2). */
const sessionOf = (dev, id, boot, { hidden = () => false, onLost = () => {}, pack = undefined } = {}) => {
  const time = clock();
  const hides = [];
  const s = createRealmSession({ io: dev.io, id, lease: boot.lease, seq: boot.seq, gzip: boot.gzip === true, onLost, later: time.later, hidden, watchHidden: (fn) => { hides.push(fn); }, ...(pack ? { pack } : {}) });
  return Object.assign(s, { time, hide: () => { for (const fn of hides) fn(); } });
};
/** A realm character saved at 1 and joined as a boot joins it, on `dev`: its session, and the service's row and save. */
async function joined(acct, dev, save = { v: 1, name: 'SwordsmanEB', level: 12, goldPieces: 100 }, opts = {}) {
  const made = (await realmCreate(dev.io, 'SwordsmanEB')).data;
  assert.equal((await realmPut(dev.io, made.id, { lease: made.lease, seq: 1 }, JSON.stringify(freshSave({ name: 'SwordsmanEB' })))).ok, true);
  layRecord(acct.env, made.id, save);
  const boot = await openRealmBoot({ io: dev.io, id: made.id });
  const lost = [];
  const session = sessionOf(dev, made.id, boot, { ...opts, onLost: (why) => lost.push(why) });
  const row = () => acct.env.DB._raw.prepare('SELECT seq, lease FROM realm_characters WHERE id = ?').get(made.id);
  return { id: made.id, session, lost, row, served: async () => JSON.parse((await realmFetch(dev.io, made.id)).text) };
}
const save = (level, gold) => ({ v: 1, name: 'SwordsmanEB', level, goldPieces: gold });
const settle = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 0)); };
/** Until `ok()` holds - a put packed (REALM-GZIP) reaches the door a turn or more after it is asked. */
const until = async (ok) => { for (let i = 0; i < 500 && !ok(); i++) await new Promise((r) => setTimeout(r, 1)); assert.ok(ok(), 'waited too long'); };

// ═══ RESCUE-SAVE ═════════════════════════════════════════════════════════════════════════════════════════════════════

test('RESCUE-SAVE: THE OUTAGE - a save the service never took is kept on the device, and the next join plays it, says so and gives it to the service', async () => {
  const acct = await account();
  const dev = acct.device();
  const c = await joined(acct, dev);
  assert.deepEqual(await c.session.checkpoint(JSON.stringify(save(13, 500))), { ok: true, seq: 2 });
  assert.equal(readUnsent(dev.storage, c.id), null, 'landed: the device keeps no copy');
  // the service goes away: the newest save waits - in the page's memory, and on the device at once, marked
  dev.door.plan = ['offline'];
  assert.equal((await c.session.checkpoint(JSON.stringify(save(15, 9000)))).ok, false);
  assert.deepEqual({ ...readUnsent(dev.storage, c.id), at: null }, { seq: 2, text: JSON.stringify(save(15, 9000)), at: null, missed: true });
  // the page goes (the keepalive leave, as world.js whenPageGoes sends it) - before RESCUE-SAVE, levels 13-15 went with it
  await c.session.leave({ keepalive: true });
  assert.equal(c.row().lease, null, 'the lease given up');
  assert.equal((await c.served()).level, 13, 'the service never took the save');
  const boot = await openRealmBoot({ io: dev.io, id: c.id });
  assert.equal(boot.ok, true);
  assert.equal(boot.restored, true);
  assert.equal(boot.missed, true, 'a put refused or unanswered: the world says so (A8)');
  assert.equal(boot.gzip, true, 'REALM-GZIP: the restored save\'s checkpoints ride packed, as the join says - a long life\'s restore is never refused too-large');
  assert.equal(boot.seq, 2);
  assert.deepEqual(boot.snap, { ...save(15, 9000), characterId: c.id });
  assert.equal(c.row().lease, boot.lease, 'joined under a new lease');
  const s = sessionOf(dev, c.id, boot);
  assert.deepEqual(await s.checkpoint(JSON.stringify(boot.snap)), { ok: true, seq: 3 });
  assert.equal(readUnsent(dev.storage, c.id), null);
  assert.equal((await c.served()).level, 15, 'the service holds the rescued save');
  const again = await openRealmBoot({ io: dev.io, id: c.id });
  assert.equal(again.restored, undefined);
  assert.equal(again.snap.level, 15);
});

test('RESCUE-SAVE: THE ORDINARY CLOSE - the hidden page\'s checkpoint is cut off by its going: kept at once, and played at the next join without a word (A8)', async () => {
  const acct = await account();
  const dev = acct.device();
  let shown = true;
  const c = await joined(acct, dev, undefined, { hidden: () => !shown });
  // the tab is put away: world.js whenPageHides checkpoints the hidden page; its put leaves and never comes back
  shown = false;
  dev.door.plan = ['hang'];
  void c.session.checkpoint(JSON.stringify(save(14, 2000)));
  assert.deepEqual({ ...readUnsent(dev.storage, c.id), at: null }, { seq: 1, text: JSON.stringify(save(14, 2000)), at: null, missed: false }, 'on the device before the page can go');
  await c.session.leave({ keepalive: true });   // pagehide
  const boot = await openRealmBoot({ io: dev.io, id: c.id });
  assert.equal(boot.restored, true);
  assert.equal(boot.missed, false, 'nothing refused: the world says nothing');
  assert.equal(boot.snap.level, 14);
});

test('RESCUE-SAVE: THE ORDINARY CLOSE, the other order - the keepalive leave landed first and the page\'s checkpoint was refused `lease`: kept, and played', async () => {
  const acct = await account();
  const dev = acct.device();
  const c = await joined(acct, dev);
  assert.equal((await realmLeave(dev.io, c.id, c.row().lease, { keepalive: true })).ok, true);
  assert.deepEqual(await c.session.checkpoint(JSON.stringify(save(14, 2000))), { ok: false, error: 'lease' });
  assert.deepEqual(c.lost, ['lease']);
  assert.equal(readUnsent(dev.storage, c.id)?.seq, 1, 'kept: the record still stands where the save follows');
  const boot = await openRealmBoot({ io: dev.io, id: c.id });
  assert.equal(boot.restored, true);
  assert.equal(boot.snap.level, 14);
});

test('RESCUE-SAVE: A RECORD MOVED PAST THE COPY - another device played on and saved - never plays it: the service\'s save is played, and the copy whose put failed is set aside, said once (STRANDED)', async () => {
  const acct = await account();
  const dev = acct.device();
  const c = await joined(acct, dev);
  dev.door.plan = ['offline'];
  await c.session.checkpoint(JSON.stringify(save(20, 1)));
  assert.equal(readUnsent(dev.storage, c.id)?.seq, 1);
  const other = acct.device();
  const theirs = await openRealmBoot({ io: other.io, id: c.id });
  assert.equal(theirs.restored, undefined, 'the other device keeps no copy of this one\'s');
  assert.equal((await sessionOf(other, c.id, theirs).checkpoint(JSON.stringify(save(13, 777)))).ok, true);
  const boot = await openRealmBoot({ io: dev.io, id: c.id });
  assert.equal(boot.restored, undefined);
  assert.equal(boot.snap.level, 13);
  assert.equal(readUnsent(dev.storage, c.id), null, 'no longer the copy a join plays');
  // PIN MOVED (STRANDED, FIELD BUGS 2026-10-25 - guild standing and quests reset): it was deleted here, unread, with
  // everything played since the last save that landed. A copy whose put failed is set aside, and the world says so
  assert.equal(boot.stranded, true);
  assert.equal(readStranded(dev.storage, c.id)?.text, JSON.stringify(save(20, 1)), 'the copy, whole, under its own key');
  assert.equal(readStranded(dev.storage, c.id)?.seq, 1, 'with the sequence it followed');
  const again = await openRealmBoot({ io: dev.io, id: c.id });
  assert.equal(again.stranded, undefined, 'said once');
  assert.equal(again.snap.level, 13, 'never played');
  sweepUnsent(dev.storage, (await realmList(dev.io)).characters, null);
  assert.ok(readStranded(dev.storage, c.id), 'kept through a join and the door\'s sweep');
});

test('RESCUE-SAVE: a put that lands with a newer save waiting keeps that one, at the sequence the service now holds', async () => {
  const acct = await account();
  const dev = acct.device();
  const c = await joined(acct, dev);
  dev.door.plan = ['wait', 'offline'];
  const first = c.session.checkpoint(JSON.stringify(save(13, 1)));   // leaves, and the service is slow
  const second = c.session.checkpoint(JSON.stringify(save(14, 2)));   // waits behind it
  c.session.time.fire();   // the grace runs out: the newest on the device, following the record as it stands
  assert.deepEqual({ ...readUnsent(dev.storage, c.id), at: null }, { seq: 1, text: JSON.stringify(save(14, 2)), at: null, missed: false });
  dev.door.open();
  assert.deepEqual(await first, { ok: true, seq: 2 });
  assert.equal((await second).ok, false);
  assert.deepEqual({ ...readUnsent(dev.storage, c.id), at: null }, { seq: 2, text: JSON.stringify(save(14, 2)), at: null, missed: true }, 'the newer save, following the one that landed');
  await c.session.leave({ keepalive: true });
  const boot = await openRealmBoot({ io: dev.io, id: c.id });
  assert.equal(boot.restored, true);
  assert.equal(boot.snap.level, 14);
});

test('RESCUE-SAVE: a save held behind a trade or a gold act is never kept - its goods are in flight', async () => {
  const acct = await account();
  const dev = acct.device();
  const c = await joined(acct, dev);
  let release = () => {};
  const gate = new Promise((r) => { release = r; });
  const act = c.session.transact(async () => { await gate; return { ok: true }; });
  assert.deepEqual(await c.session.checkpoint(JSON.stringify(save(99, 99999))), { ok: false, error: 'held' });
  await c.session.leave({ keepalive: true }).catch(() => {});
  assert.equal(readUnsent(dev.storage, c.id), null, 'not by the grace, not by the leave');
  release();
  await act;
});

test('RESCUE-SAVE: a copy no join may play is dropped - the record moved (`seq`), or the service will never take it (`too-large`)', async () => {
  const acct = await account();
  const dev = acct.device();
  const c = await joined(acct, dev);
  dev.door.plan = ['offline'];
  await c.session.checkpoint(JSON.stringify(save(13, 1)));
  assert.ok(readUnsent(dev.storage, c.id));
  // the record moved by acts this tab never made - two on, so no lost answer of its own can explain it (AUDIT REALM L1-F2)
  acct.env.DB._raw.prepare('UPDATE realm_characters SET seq = seq + 2 WHERE id = ?').run(c.id);
  assert.equal((await c.session.checkpoint(JSON.stringify(save(14, 1)))).error, 'seq');
  assert.equal(readUnsent(dev.storage, c.id), null);
  const dev2 = acct.device();
  const d = await joined(acct, dev2);
  d.session.time.fire();
  // past the text's own bound (REALM-GZIP): no packing brings it under - the service will never take it
  assert.equal((await d.session.checkpoint('x'.repeat(REALM_TEXT_MAX_BYTES + 1))).error, 'too-large');
  assert.equal(readUnsent(dev2.storage, d.id), null);
  assert.equal(d.session.time.waiting, 0, 'and nothing waits to write it');
});

test('RESCUE-SAVE: the player\'s own delete drops the copy', async () => {
  const acct = await account();
  const dev = acct.device();
  const c = await joined(acct, dev);
  dev.door.plan = ['offline'];
  await c.session.checkpoint(JSON.stringify(save(13, 1)));
  assert.ok(readUnsent(dev.storage, c.id));
  await c.session.leave({ keepalive: true });
  assert.equal((await realmDelete(dev.io, c.id)).ok, true);
  assert.equal(readUnsent(dev.storage, c.id), null);
  assert.deepEqual([...dev.storage._map.keys()].filter((k) => k.startsWith(REALM_UNSENT_PREFIX)), [], 'the device\'s join of it too');
});

test('RESCUE-SAVE: the world host says it once the world stands - only for a copy a put missed (A8) - beside the realm\'s other boot words', () => {
  const w = src('src/scenes/world.js');
  const said = w.indexOf('if (realmBoot?.restored && realmBoot.missed) townTalk.say(REALM_RESTORED_TEXT);');
  assert.ok(said > 0, 'the host says the restore');
  const strandedSaid = w.indexOf('if (realmBoot?.stranded) townTalk.say(realmStrandedText());');
  assert.ok(strandedSaid > 0 && Math.abs(strandedSaid - said) < 400, 'STRANDED: and a copy set aside, beside it');
  assert.match(realmStrandedText(), /may hold progress/i, 'may: a put whose answer was lost may have landed');
  assert.ok(w.includes('if (realmSession) watchRealmUnsaved(realmSession, { say: (text) => townTalk.say(text) });'), 'SAVES-SAID: the host has the session\'s failing saves said (online/realmUnsavedNotice.js)');
  assert.ok(Math.abs(said - w.indexOf('if (realmRefused) townTalk.say(REALM_OFFLINE_TEXT);')) < 400, 'beside REALM P1.3\'s own boot word');
  assert.match(REALM_RESTORED_TEXT, /this device kept it/i);
});

// ═══ AUDIT RESCUE-SAVE (2026-09-30, Mac: "Audit this") ═══════════════════════════════════════════════════════════════

/** world.js's own statements, sliced (test/systems/auditrealm2_client.test.js's harness). */
function sliced(rel) {
  const S = src(rel);
  const AST = acorn.parse(S, { ecmaVersion: 'latest', sourceType: 'module' });
  const all = (pred) => {
    const hits = [];
    (function walk(n) {
      if (!n || typeof n.type !== 'string') return;
      if (pred(n)) hits.push(n);
      for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
    })(AST);
    return hits;
  };
  const text = (n) => S.slice(n.start, n.end);
  const one = (hits, what) => { assert.equal(hits.length, 1, `${rel}: ${what} (${hits.length} found)`); return text(hits[0]); };
  const decl = (name) => one(all((n) => n.type === 'VariableDeclaration' && n.declarations.some((d) => d.id?.name === name)), `the declaration of ${name}`);
  const top = (host, has) => {
    const h = all((n) => n.type === 'FunctionDeclaration' && n.id?.name === host);
    assert.equal(h.length, 1, `${rel}: function ${host}`);
    return one(h[0].body.body.filter((st) => text(st).includes(has)), `${host}'s statement holding ${has}`);
  };
  return { decl, top };
}
const scoped = (state) => new Proxy(state, {
  has: (t, k) => k !== '__s',
  get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])),
  set: (t, k, v) => { t[k] = v; return true; },
});
// eslint-disable-next-line no-new-func
const mount = (body, state) => new Function('__s', `with (__s) { ${body} }`)(scoped(state));
const W = sliced('src/scenes/world.js');

/** One boot of the world host's realm half over `dev`'s storage: the realm save sink, both spoils pools and their hooks,
 *  and the crash's door as the host's stand-up asks it - every one of them world.js's own statement. */
function hostBoot(dev, R, realmSession, realmBoot) {
  const pack = { gold: 0, items: [] };
  const takeSpoil = (p) => { if (p.kind === 'gold') pack.gold += p.gold; else pack.items.push(p.item); };
  let sink = null;
  const said = [];
  const host = mount(`
    const _realmSaveHooks = { held: () => null, landed: () => {} };
    ${W.top('bootWorld', 'if (realmSession) setRealmSaveSink(')}
    const spoilsPool = createSpoilsPool({ ray: () => null, now: () => 1, take: takeSpoil, store: _spoilsStore, who: () => characterIdOf(playerEntity) });
    const raidSpoils = createSpoilsPool({ ray: () => null, now: () => 1, take: takeSpoil, store: _spoilsStore, who: () => characterIdOf(playerEntity), keys: RAID_SPOILS_KEYS, recordsMax: RAID_SPOILS_RECORDS_MAX });
    ${W.top('bootWorld', '_realmSaveHooks.held = ')}
    ${W.top('bootWorld', '_realmSaveHooks.landed = ')}
    ${W.decl('_spoilsAskedFor')}
    ${W.decl('_spoilsInSave')}
    ${W.decl('spoilsRecoverFrame')}
    spoilsRecoverFrame();
    return { spoilsPool, raidSpoils };
  `, {
    realmSession, realmBoot, playerSpawned: true,
    setRealmSaveSink: (f) => { sink = f; },
    characterIdOf: () => R, realmSummaryOf: () => null, realmSaveWithHeld, playerEntity: {},
    createSpoilsPool, recoverSpoils, RAID_SPOILS_KEYS, RAID_SPOILS_RECORDS_MAX, SPOILS_TEXT, RAID_SPOILS_TEXT, takeSpoil,
    takeGateSpoil: takeSpoil,   // WB12c: the breach's own door - its book is test/systems/wb12c_burning_doors.test.js's
    _spoilsStore: spoilsStore(dev.storage), enumerateSaves: () => ({ info: new Map() }), setMidScreenText: (t) => said.push(t),
    console: { warn() {} },
  });
  return { ...host, pack, said, save: (snap) => sink(snap) };
}
/** A town defended and a boss's spoils, into the pack through the host's pools: what the pack gained. */
function spoiled(host, R) {
  assert.equal(host.raidSpoils.grant({ day: raidSpoilsDay('k:1:40:7'), acct: 'acct-a', roll: () => raidSpoilsList(0xC0FFEE, 30, 2), text: RAID_SPOILS_TEXT.granted, owner: R }), true);
  assert.equal(host.spoilsPool.grant({ day: 700, seed: 99, level: 30, acct: 'acct-a' }), true);
  const got = { gold: host.pack.gold, items: host.pack.items.length };
  assert.ok(got.gold > 0 && got.items > 0);
  return got;
}

test('AUDIT RESCUE-SAVE A1: a kept save names the spoils it was composed holding - the join plays it and the crash\'s door adopts their records, handing no piece twice; the save that lands clears them (mutants: the save names none, the door hands them anyway, the host never asks, the boot answers none)', async () => {
  const acct = await account();
  const dev = acct.device();
  const c = await joined(acct, dev);
  const one = hostBoot(dev, c.id, c.session, null);
  const got = spoiled(one, c.id);
  // the periodic checkpoint, composed holding both - and the service away
  dev.door.plan = ['offline'];
  one.save({ v: 1, name: 'SwordsmanEB', level: 12, pack: got });
  await settle();
  const kept = JSON.parse(readUnsent(dev.storage, c.id).text);
  assert.equal(kept[REALM_HELD_FIELD].length, 2, 'the save names both records its pack holds');
  assert.ok(dev.storage.getItem(SPOILS_STORE_KEY) && dev.storage.getItem(RAID_SPOILS_KEYS.store), 'and both stay on the device: unlanded');
  await c.session.leave({ keepalive: true });
  const boot = await openRealmBoot({ io: dev.io, id: c.id });
  assert.equal(boot.restored, true);
  assert.deepEqual(boot.held, kept[REALM_HELD_FIELD]);
  assert.equal(boot.snap[REALM_HELD_FIELD], undefined, 'taken out of the save the world loads');
  assert.deepEqual(boot.snap.pack, got, 'the kept save holds the spoils');
  const two = hostBoot(dev, c.id, sessionOf(dev, c.id, boot), boot);
  assert.deepEqual([two.pack.gold, two.pack.items.length], [0, 0], 'no piece handed twice');
  assert.deepEqual(two.said, [], 'and nothing said gathered');
  assert.deepEqual([...two.spoilsPool.heldIds(c.id), ...two.raidSpoils.heldIds(c.id)].sort(), [...boot.held].sort(), 'adopted: the next save holds them');
  two.save(boot.snap);
  await settle();
  assert.equal(dev.storage.getItem(SPOILS_STORE_KEY), null);
  assert.equal(dev.storage.getItem(RAID_SPOILS_KEYS.store), null);
  assert.equal(readUnsent(dev.storage, c.id), null);
});

test('AUDIT RESCUE-SAVE A3: a save that LANDED with its answer lost cleared no record - the service\'s save names them, and the next join adopts rather than hands them', async () => {
  const acct = await account();
  const dev = acct.device();
  const c = await joined(acct, dev);
  const one = hostBoot(dev, c.id, c.session, null);
  const got = spoiled(one, c.id);
  dev.door.plan = ['lose-answer'];
  one.save({ v: 1, name: 'SwordsmanEB', level: 12, pack: got });
  await settle();
  assert.equal(c.row().seq, 2, 'it landed');
  assert.ok(dev.storage.getItem(SPOILS_STORE_KEY), 'and nothing told the pool: its record stands');
  // the page goes before any later put resolves it (the copy is one behind the record, and is dropped at the join)
  await c.session.leave({ keepalive: true });
  const boot = await openRealmBoot({ io: dev.io, id: c.id });
  assert.equal(boot.restored, undefined, 'the service\'s save is played');
  assert.equal(boot.held.length, 2);
  const two = hostBoot(dev, c.id, sessionOf(dev, c.id, boot), boot);
  assert.deepEqual([two.pack.gold, two.pack.items.length], [0, 0], 'no piece handed twice');
});

test('AUDIT RESCUE-SAVE A1: a copy the join drops leaves its records to the crash\'s door, which hands them into the service\'s save - nothing lost', async () => {
  const acct = await account();
  const dev = acct.device();
  const c = await joined(acct, dev);
  const one = hostBoot(dev, c.id, c.session, null);
  one.spoilsPool.grant({ day: 701, seed: 7, level: 30, acct: 'acct-a' });
  const got = one.pack.items.length + one.pack.gold;
  dev.door.plan = ['offline'];
  one.save({ v: 1, name: 'SwordsmanEB', level: 12 });
  await settle();
  await c.session.leave({ keepalive: true });
  const other = acct.device();
  const theirs = await openRealmBoot({ io: other.io, id: c.id });
  assert.equal((await sessionOf(other, c.id, theirs).checkpoint(JSON.stringify(save(13, 5)))).ok, true);
  const boot = await openRealmBoot({ io: dev.io, id: c.id });
  assert.equal(boot.restored, undefined, 'the copy dropped');
  assert.deepEqual(boot.held, [], 'the service\'s save names none');
  const two = hostBoot(dev, c.id, sessionOf(dev, c.id, boot), boot);
  assert.equal(two.pack.items.length + two.pack.gold, got, 'the spoils handed into the service\'s save, once');
});

test('AUDIT RESCUE-SAVE A1: the records a save names are bounded, and never ride into an offline copy', () => {
  const text = realmSaveWithHeld({ v: 1 }, ['a', 7, null, 'x'.repeat(129), ...Array.from({ length: 80 }, (_, i) => `k${i}`)]);
  const held = JSON.parse(text)[REALM_HELD_FIELD];
  assert.equal(held.length, 64);
  assert.deepEqual([held[0], held[63]], ['k16', 'k79'], 'the NEWEST sixty-four - the device keeps the newest records (AUDIT 2 B4)');
  assert.ok(held.every((x) => typeof x === 'string' && x.length <= 128));
  assert.equal(realmSaveWithHeld({ v: 1 }, []), '{"v":1}', 'none: the save as it stands');
  assert.equal(realmSaveWithHeld({ v: 1 }, null), '{"v":1}');
  assert.equal(offlineCopyOf(JSON.parse(text))[REALM_HELD_FIELD], undefined, 'a new offline character holds none of the realm\'s records');
});

test('AUDIT RESCUE-SAVE A2: a character deleted from another device takes this device\'s copy with it at the next join', async () => {
  const acct = await account();
  const dev = acct.device();
  const c = await joined(acct, dev);
  dev.door.plan = ['offline'];
  await c.session.checkpoint(JSON.stringify(save(13, 1)));
  await c.session.leave({ keepalive: true });
  assert.ok(readUnsent(dev.storage, c.id));
  const other = acct.device();
  assert.equal((await realmDelete(other.io, c.id)).ok, true);
  assert.deepEqual(await openRealmBoot({ io: dev.io, id: c.id }), { ok: false, error: 'no-realm-character' });
  assert.deepEqual([...dev.storage._map.keys()].filter((k) => k.startsWith(REALM_UNSENT_PREFIX)), []);
});

test('AUDIT RESCUE-SAVE A4: two tabs of one character on one device - the tab it was taken from never writes its older save over the newer tab\'s copy; a page the back-forward cache kept joins again and writes as before', async () => {
  const acct = await account();
  const dev = acct.device();
  const a = await joined(acct, dev);
  // a second tab of the same browser joins the character (the Online door's Play): the device's last join is its
  const bBoot = await openRealmBoot({ io: dev.io, id: a.id });
  const b = sessionOf(dev, a.id, bBoot);
  dev.door.plan = ['offline'];
  await b.checkpoint(JSON.stringify(save(50, 50000)));
  assert.equal(JSON.parse(readUnsent(dev.storage, a.id).text).level, 50, 'the newer tab\'s copy');
  // the older tab has not heard yet: its checkpoint is refused `lease` - and its level-11 save stays off the device
  assert.deepEqual(await a.session.checkpoint(JSON.stringify(save(11, 1))), { ok: false, error: 'lease' });
  a.session.time.fire();
  assert.equal(JSON.parse(readUnsent(dev.storage, a.id).text).level, 50, 'never written over');
  await b.leave({ keepalive: true });
  assert.equal((await openRealmBoot({ io: dev.io, id: a.id })).snap.level, 50);
  // the back-forward cache: a page put away (its lease given up) and shown again joins anew - its copies still written
  const cBoot = await openRealmBoot({ io: dev.io, id: a.id });
  const cs = sessionOf(dev, a.id, cBoot);
  assert.equal((await cs.checkpoint(JSON.stringify(save(51, 1)))).ok, true);
  await cs.leave({ keepalive: true });
  assert.deepEqual(await cs.rejoin(), { ok: true, seq: cBoot.seq + 1 });
  dev.door.plan = ['offline'];
  await cs.checkpoint(JSON.stringify(save(52, 1)));
  assert.equal(JSON.parse(readUnsent(dev.storage, a.id).text).level, 52, 'the rejoined tab is the device\'s last join');
});

test('AUDIT RESCUE-SAVE A5: a device out of room keeps the copy it already kept, and never a text without its record', async () => {
  const acct = await account();
  const storage = fakeStorage();
  const dev = acct.device(storage);
  const c = await joined(acct, dev);
  dev.door.plan = ['offline'];
  await c.session.checkpoint(JSON.stringify(save(13, 1)));
  assert.equal(JSON.parse(readUnsent(storage, c.id).text).level, 13);
  // the save grows past the room: its text refused - the copy before it stands, record and all
  const set = storage.setItem;
  storage.setItem = (k, v) => { if (String(k) === `${REALM_UNSENT_PREFIX}${c.id}`) throw new Error('QuotaExceededError'); set(k, v); };
  dev.door.plan = ['offline'];
  await c.session.checkpoint(JSON.stringify(save(14, 2)));
  assert.equal(JSON.parse(readUnsent(storage, c.id).text).level, 13, 'the copy already kept: still newer than the service');
  // the text fits and its record does not: nothing half-kept
  storage.setItem = (k, v) => { if (String(k).endsWith('.at')) throw new Error('QuotaExceededError'); set(k, v); };
  dev.door.plan = ['offline'];
  await c.session.checkpoint(JSON.stringify(save(15, 3)));
  assert.deepEqual(unsentKeys(storage), []);
  storage.setItem = set;
  assert.equal(keepUnsent(storage, c.id, 0, '{}'), false, 'no sequence before the first save');
  assert.equal(keepUnsent(null, c.id, 3, '{}'), false);
  assert.equal(keepUnsent(storage, c.id, 3, ''), false);
  assert.equal(keepUnsent(storage, c.id, 3, '{"v":1}'), true);
  forgetUnsent(storage, c.id);
  assert.deepEqual(unsentKeys(storage), []);
});

test('AUDIT RESCUE-SAVE A6: a put that lands costs the device nothing; one unanswered past the grace is written then', async () => {
  const acct = await account();
  const dev = acct.device();
  const c = await joined(acct, dev);
  const before = dev.storage.writes;
  for (let i = 0; i < 5; i++) assert.equal((await c.session.checkpoint(JSON.stringify(save(13 + i, i)))).ok, true);
  assert.equal(dev.storage.writes, before, 'five checkpoints that landed: no save written to the device');
  assert.equal(c.session.time.waiting, 0, 'and nothing waits');
  // a put the service is slow to answer: written once the grace runs out, the put still out
  dev.door.plan = ['hang'];
  void c.session.checkpoint(JSON.stringify(save(30, 1)));
  assert.equal(readUnsent(dev.storage, c.id), null, 'not yet');
  assert.equal(c.session.time.fire(), 1);
  assert.deepEqual({ ...readUnsent(dev.storage, c.id), at: null }, { seq: 6, text: JSON.stringify(save(30, 1)), at: null, missed: false });
  // and the session's leave writes whatever still waits out its grace (a newer save queued behind the put still out),
  // before the lease goes
  void c.session.checkpoint(JSON.stringify(save(31, 1)));
  await c.session.leave({ keepalive: true });
  assert.equal(JSON.parse(readUnsent(dev.storage, c.id).text).level, 31);
  assert.equal(REALM_UNSENT_GRACE_MS, 1_500);
});

test('AUDIT RESCUE-SAVE A7: the Online door drops a copy of the account\'s own character that its record has moved past (one whose put failed is the join\'s - STRANDED), and keeps one it has not - and another account\'s', async () => {
  const acct = await account();
  const dev = acct.device();
  const c = await joined(acct, dev);
  dev.door.plan = ['offline'];
  await c.session.checkpoint(JSON.stringify(save(13, 1)));
  await c.session.leave({ keepalive: true });
  const stranger = 'r' + 'cd'.repeat(10);
  keepUnsent(dev.storage, stranger, 4, '{"v":1}');
  const rows = (await realmList(dev.io)).characters;
  assert.equal(sweepUnsent(dev.storage, rows), 0, 'the record still stands where the copy follows');
  assert.ok(readUnsent(dev.storage, c.id));
  // STRANDED: the sweep leaves a missed copy whatever its sequence, so the law is held on an ordinary close's copy too
  const missedCopy = readUnsent(dev.storage, c.id);
  keepUnsent(dev.storage, c.id, missedCopy.seq, missedCopy.text);
  assert.equal(sweepUnsent(dev.storage, rows), 0, 'an ordinary close\'s copy where the record stands is kept too');
  assert.equal(readUnsent(dev.storage, c.id)?.missed, false);
  keepUnsent(dev.storage, c.id, missedCopy.seq, missedCopy.text, { missed: true });
  const other = acct.device();
  const theirs = await openRealmBoot({ io: other.io, id: c.id });
  const os = sessionOf(other, c.id, theirs);
  await os.checkpoint(JSON.stringify(save(20, 1)));
  await os.leave({ keepalive: true });   // played there, and left (a row still playing is its tab's - AUDIT 2 B6)
  // PIN MOVED (STRANDED): this copy's put failed (offline), so the door leaves it for the join, which reads the realm's
  // save before it sets the copy aside or drops it
  assert.equal(sweepUnsent(dev.storage, (await realmList(dev.io)).characters), 0, 'a copy whose put failed is the join\'s');
  assert.equal(readUnsent(dev.storage, c.id)?.missed, true);
  // ...and a copy no put of which failed (an ordinary close, whose put usually landed) goes as before
  keepUnsent(dev.storage, c.id, 1, JSON.stringify(save(13, 1)));
  assert.equal(sweepUnsent(dev.storage, (await realmList(dev.io)).characters), 1);
  assert.equal(readUnsent(dev.storage, c.id), null);
  assert.ok(readUnsent(dev.storage, stranger), 'not listed: not the door\'s to drop');
  assert.match(src('src/ui/enhanced/enhancedMenu.js'), /realmRows = r\.ok \? r\.characters : \[\];\n\s*if \(r\.ok\) sweepUnsent\(appStorage\(\), r\.characters, storedSession\(appStorage\(\)\)\?\.id \?\? null\);/);
  claimUnsent(dev.storage, stranger, 'a'.repeat(32));
  assert.equal(keepUnsent(dev.storage, stranger, 4, '{"v":2}', { lease: 'b'.repeat(32) }), false, 'A4 by the letter: another lease writes nothing');
});

// ═══ AUDIT RESCUE-SAVE 2 (2026-09-30, Mac: "Audit this", again - over the merge with REALM-GZIP) ════════════════════════

test('AUDIT RESCUE-SAVE 2 B1: a tab the character was taken from never drops or marks the newer tab\'s copy - not by a refusal the route answers before the lease (too-large), not by its own lease refused', async () => {
  const acct = await account();
  const dev = acct.device();
  const a = await joined(acct, dev);
  const aLease = a.row().lease;
  const bBoot = await openRealmBoot({ io: dev.io, id: a.id });
  const b = sessionOf(dev, a.id, bBoot);
  dev.door.plan = ['hang'];
  const before = dev.door.puts;
  void b.checkpoint(JSON.stringify(save(50, 1)));
  await until(() => dev.door.puts > before);   // the newer tab's put took the hang - never the older tab's, packed faster
  b.time.fire();   // the newer tab's copy, its put still out - nothing missed
  const bCopy = { ...readUnsent(dev.storage, a.id), at: null };
  assert.deepEqual([JSON.parse(bCopy.text).level, bCopy.missed], [50, false]);
  // the older tab, not yet told: its own lease refused
  assert.deepEqual(await a.session.checkpoint(JSON.stringify(save(11, 1))), { ok: false, error: 'lease' });
  assert.deepEqual({ ...readUnsent(dev.storage, a.id), at: null }, bCopy, 'never marked missed by the tab that lost it');
  // another page of the older join, asking with a save past the request's bound: refused before the lease is read
  const stale = sessionOf(dev, a.id, { lease: aLease, seq: 1 });
  assert.equal((await stale.checkpoint('x'.repeat(REALM_MAX_BYTES + 1))).error, 'too-large');
  assert.deepEqual({ ...readUnsent(dev.storage, a.id), at: null }, bCopy, 'never dropped by it');
});

test('AUDIT RESCUE-SAVE 2 B2: the page put away writes the save that waits out its grace - even when its own checkpoint is refused (a duel, the death screen), and a phone never sends the pagehide', async () => {
  const acct = await account();
  const dev = acct.device();
  const c = await joined(acct, dev);
  dev.door.plan = ['hang'];
  void c.session.checkpoint(JSON.stringify(save(22, 1)));
  assert.equal(readUnsent(dev.storage, c.id), null, 'the grace not yet out');
  c.session.hide();   // no checkpoint of its own: world.js's refused one
  assert.equal(JSON.parse(readUnsent(dev.storage, c.id).text).level, 22);
  assert.equal(c.session.time.waiting, 0, 'and the grace stands down');
});

test('AUDIT RESCUE-SAVE 2 B3: a put that lands with a newer save waiting never relabels an older copy - one written before the grace let the newer out - over the save that landed', async () => {
  const acct = await account();
  const dev = acct.device();
  const c = await joined(acct, dev);
  dev.door.plan = ['offline'];
  await c.session.checkpoint(JSON.stringify(save(20, 1)));   // T0: refused, on the device at 1
  // the service back: T1 leaves and is slow, T2 waits behind it - both inside the grace, neither on the device yet
  dev.door.plan = ['wait', 'hang'];
  const t1 = c.session.checkpoint(JSON.stringify(save(21, 1)));
  void c.session.checkpoint(JSON.stringify(save(22, 1)));
  dev.door.open();
  assert.deepEqual(await t1, { ok: true, seq: 2 });
  // the tab crashes before the grace runs out: the device holds T2 at 2, never T0 relabelled 2
  assert.deepEqual([JSON.parse(readUnsent(dev.storage, c.id).text).level, readUnsent(dev.storage, c.id).seq], [22, 2]);
  const boot = await openRealmBoot({ io: dev.io, id: c.id });
  assert.equal(boot.snap.level, 22, 'the newest - never level 20 over the 21 the service took');
});

test('AUDIT RESCUE-SAVE 2 B3: a device with no room for the newer save plays the service\'s at the next join - never the older copy it kept, relabelled', async () => {
  const acct = await account();
  const storage = fakeStorage();
  const dev = acct.device(storage);
  const c = await joined(acct, dev);
  dev.door.plan = ['offline'];
  await c.session.checkpoint(JSON.stringify(save(20, 1)));   // T0 fits: on the device at 1
  const set = storage.setItem;
  storage.setItem = (k, v) => { if (String(k) === `${REALM_UNSENT_PREFIX}${c.id}` && String(v).includes('"pad"')) throw new Error('QuotaExceededError'); set(k, v); };
  const big = (level) => JSON.stringify({ ...save(level, 1), pad: 'x' });
  dev.door.plan = ['wait', 'hang'];
  const t1 = c.session.checkpoint(big(21));
  c.session.time.fire();   // T1's grace runs out and it will not fit: T0 stays
  void c.session.checkpoint(big(22));
  dev.door.open();
  assert.equal((await t1).ok, true);
  assert.equal(readUnsent(storage, c.id), null, 'T0 gone, T2 would not fit - nothing, never T0 at 2');
  const boot = await openRealmBoot({ io: dev.io, id: c.id });
  assert.equal(boot.restored, undefined);
  assert.equal(boot.snap.level, 21, 'the service\'s save');
});

test('AUDIT RESCUE-SAVE 2 B3: a put that landed with its answer lost, resynced or found at a rejoin, never relabels the older copy either', async () => {
  const acct = await account();
  // the resync: T1 landed unanswered, T2's put is told `seq` one on - adopted
  const dev = acct.device();
  const c = await joined(acct, dev);
  dev.door.plan = ['offline'];
  await c.session.checkpoint(JSON.stringify(save(20, 1)));   // T0 on the device at 1
  dev.door.plan = ['lose-answer'];
  await c.session.checkpoint(JSON.stringify(save(21, 1)));   // T1 landed at 2, its answer lost
  assert.equal(c.row().seq, 2);
  dev.door.plan = ['ok', 'hang'];   // T2 at 2: `seq`, adopted; T2 again at 3: out, never answered
  void c.session.checkpoint(JSON.stringify(save(22, 1)));
  await settle();
  assert.deepEqual([JSON.parse(readUnsent(dev.storage, c.id).text).level, readUnsent(dev.storage, c.id).seq], [22, 2]);
  assert.equal((await openRealmBoot({ io: dev.io, id: c.id })).snap.level, 22);
  // the rejoin: T1 landed unanswered and would not fit on the device (T0 kept, A5); the page went and came back from the
  // back-forward cache, joined one on - T0 is older than what landed, and never relabelled there
  const storage2 = fakeStorage();
  const dev2 = acct.device(storage2);
  const d = await joined(acct, dev2);
  dev2.door.plan = ['offline'];
  await d.session.checkpoint(JSON.stringify(save(30, 1)));   // T0 on the device at 1
  const set = storage2.setItem;
  storage2.setItem = (k, v) => { if (String(k) === `${REALM_UNSENT_PREFIX}${d.id}` && String(v).includes('"pad"')) throw new Error('QuotaExceededError'); set(k, v); };
  dev2.door.plan = ['lose-answer'];
  await d.session.checkpoint(JSON.stringify({ ...save(31, 1), pad: 'x' }));   // T1 at 2, unanswered, and no room for it
  assert.equal(JSON.parse(readUnsent(storage2, d.id).text).level, 30, 'T0 kept (A5)');
  await d.session.leave({ keepalive: true });
  assert.deepEqual(await d.session.rejoin(), { ok: true, seq: 2 });
  assert.equal(readUnsent(storage2, d.id), null, 'T0 gone, T1 would not fit - nothing, never T0 at 2');
  await d.session.leave({ keepalive: true });
  assert.equal((await openRealmBoot({ io: dev2.io, id: d.id })).snap.level, 31, 'the service\'s save');
});

test('AUDIT RESCUE-SAVE 2 B5/B6: the door drops the account\'s own copies of characters it no longer holds, leaves another account\'s, and leaves a character a tab is playing', async () => {
  const acct = await account();
  const dev = acct.device();
  const player = dev.io.player;
  assert.equal(typeof player, 'string');
  const gone = 'r' + 'ab'.repeat(10), theirs = 'r' + 'cd'.repeat(10);
  keepUnsent(dev.storage, gone, 3, '{"v":1}', { player });
  keepUnsent(dev.storage, theirs, 3, '{"v":1}', { player: 'another-account' });
  assert.equal(sweepUnsent(dev.storage, [], player), 1);
  assert.equal(readUnsent(dev.storage, gone), null, 'deleted elsewhere, never joined here again: gone');
  assert.ok(readUnsent(dev.storage, theirs), 'another account\'s: not this door\'s');
  // a row a tab is playing (its put may have landed unanswered): left to that tab
  const c = await joined(acct, dev);
  dev.door.plan = ['offline'];
  await c.session.checkpoint(JSON.stringify(save(13, 1)));
  const row = (await realmList(dev.io)).characters.find((r) => r.id === c.id);
  assert.equal(row.playing, true);
  assert.equal(sweepUnsent(dev.storage, [{ ...row, seq: row.seq + 1 }], player), 0);
  assert.ok(readUnsent(dev.storage, c.id));
});

test('AUDIT RESCUE-SAVE 2 B7: a join whose claim will not fit takes the older join\'s off - the check stands down, never guards the tab the character was taken from', () => {
  const storage = fakeStorage();
  const id = 'r' + 'ef'.repeat(10);
  claimUnsent(storage, id, 'a'.repeat(32));
  const set = storage.setItem;
  storage.setItem = (k, v) => { if (String(k).endsWith('.lease')) throw new Error('QuotaExceededError'); set(k, v); };
  claimUnsent(storage, id, 'b'.repeat(32));
  storage.setItem = set;
  assert.equal(storage.getItem(`${REALM_UNSENT_PREFIX}${id}.lease`), null);
  assert.equal(keepUnsent(storage, id, 2, '{"v":1}', { lease: 'b'.repeat(32) }), true, 'the newer join writes');
});

test('AUDIT RESCUE-SAVE 2 (REALM-GZIP): a save past the request\'s bound rides packed and lands - its copy dropped as any landed save\'s, never refused too-large', async () => {
  const acct = await account();
  const dev = acct.device();
  const c = await joined(acct, dev);
  const long = JSON.stringify({ ...save(40, 1), log: 'the long life '.repeat(400_000) });
  assert.ok(long.length > REALM_MAX_BYTES);
  assert.deepEqual(await c.session.checkpoint(long), { ok: true, seq: 2 });
  assert.equal(readUnsent(dev.storage, c.id), null);
  assert.equal((await c.served()).level, 40);
});

// ═══ RESCUE-PACK (2026-09-30, Mac: "Do it") ══════════════════════════════════════════════════════════════════════════
// A long life's copy rides packed: a save past REALM_UNSENT_PACK_OVER characters is kept gzipped (REALM-GZIP's codec)
// as base64 - a browser's storage takes what the plain text would not.

/** A long life's save: past the packing's threshold, and packing many times over. */
const longSave = (level) => JSON.stringify({ ...save(level, 1), journal: 'the long life of SwordsmanEB '.repeat(20_000) });
const rawCopy = (storage, id) => storage.getItem(`${REALM_UNSENT_PREFIX}${id}`);

test('RESCUE-PACK: a long life\'s save the service never took is kept packed - many times smaller - and the next join opens it, plays it and gives it to the service', async () => {
  const acct = await account();
  const dev = acct.device();
  const c = await joined(acct, dev);
  const text = longSave(33);
  assert.ok(text.length > REALM_UNSENT_PACK_OVER);
  dev.door.plan = ['offline'];
  await c.session.checkpoint(text);
  await settle();   // packed off the frame
  const kept = readUnsent(dev.storage, c.id);
  assert.equal(kept.text, null);
  assert.ok(kept.packed.startsWith(REALM_UNSENT_PACKED));
  assert.equal(rawCopy(dev.storage, c.id), kept.packed);
  assert.ok(kept.packed.length * 10 < text.length, `packed ${kept.packed.length} for ${text.length}`);
  assert.equal(await unpackUnsent(kept.packed), text, 'opens to the save, whole');
  await c.session.leave({ keepalive: true });
  const boot = await openRealmBoot({ io: dev.io, id: c.id });
  assert.equal(boot.restored, true);
  assert.equal(boot.snap.level, 33);
  assert.equal(boot.snap.journal.length, JSON.parse(text).journal.length);
  assert.equal((await sessionOf(dev, c.id, boot).checkpoint(realmSaveWithHeld(boot.snap, boot.held))).ok, true);
  assert.equal(readUnsent(dev.storage, c.id), null);
});

test('RESCUE-PACK: a device that will not hold a long life\'s text holds it packed; a page going away writes it as it stands when the device takes it, and packed when it does not', async () => {
  const acct = await account();
  const storage = fakeStorage();
  const set = storage.setItem;
  const room = { plain: false };
  storage.setItem = (k, v) => { if (!room.plain && String(v).length > REALM_UNSENT_PACK_OVER) throw new Error('QuotaExceededError'); set(k, v); };
  const dev = acct.device(storage);
  let shown = true;
  const c = await joined(acct, dev, undefined, { hidden: () => !shown });
  dev.door.plan = ['offline'];
  await c.session.checkpoint(longSave(34));
  await settle();
  assert.ok(readUnsent(storage, c.id).packed, 'the plain text would not fit; packed it does');
  // the page put away, the device taking the text as it stands: written at once, nothing waits
  shown = false;
  room.plain = true;
  dev.door.plan = ['hang'];
  void c.session.checkpoint(longSave(35));
  assert.equal(JSON.parse(readUnsent(storage, c.id).text).level, 35, 'as it stands, before the page can go');
  // and when the device will not take it as it stands, packed - the best a page going away can do
  room.plain = false;
  void c.session.checkpoint(longSave(36));
  await settle();
  assert.equal(JSON.parse(await unpackUnsent(readUnsent(storage, c.id).packed)).level, 36);
});

test('RESCUE-PACK: a packing that finishes after the copy moved on writes nothing - never a copy the landing dropped, never over a newer one', async () => {
  const acct = await account();
  const dev = acct.device();
  const outs = [];
  const pack = (text) => new Promise((resolve) => { outs.push(() => packUnsent(text).then(resolve)); });
  const c = await joined(acct, dev, undefined, { pack });
  dev.door.plan = ['offline'];
  await c.session.checkpoint(longSave(40));   // refused: its packing starts, and waits
  assert.equal(outs.length, 1);
  assert.deepEqual(await c.session.checkpoint(JSON.stringify(save(41, 1))), { ok: true, seq: 2 });   // lands: the copy is dropped
  await outs[0]();
  await settle();
  assert.equal(readUnsent(dev.storage, c.id), null, 'the late packing lands nowhere');
  // and never over the newest written anew: a long save refused, its packing out; the service back, a put lands with a
  // newer save waiting (AUDIT 2 B3's rebase writes the newest) - then the old packing finishes
  dev.door.plan = ['offline'];
  await c.session.checkpoint(longSave(42));
  assert.equal(outs.length, 2);
  dev.door.plan = ['wait', 'hang'];
  const t1 = c.session.checkpoint(JSON.stringify(save(43, 1)));
  void c.session.checkpoint(JSON.stringify(save(44, 1)));
  dev.door.open();
  assert.equal((await t1).ok, true);
  assert.equal(JSON.parse(readUnsent(dev.storage, c.id).text).level, 44, 'the newest, written anew');
  await outs[1]();
  await settle();
  assert.equal(JSON.parse(readUnsent(dev.storage, c.id).text).level, 44, 'never the older packing over it');
});

test('RESCUE-PACK: a packed copy that will not open is dropped at the join, and the service\'s save played', async () => {
  const acct = await account();
  const dev = acct.device();
  const c = await joined(acct, dev);
  await c.session.leave({ keepalive: true });
  assert.equal(await unpackUnsent('{"v":1}'), null, 'not packed');
  assert.equal(await unpackUnsent(`${REALM_UNSENT_PACKED}!!!`), null, 'not base64');
  assert.equal(await unpackUnsent(`${REALM_UNSENT_PACKED}${globalThis.btoa('not gzip at all, not at all')}`), null, 'not gzip');
  keepUnsent(dev.storage, c.id, c.row().seq, `${REALM_UNSENT_PACKED}${globalThis.btoa('garbage')}`);
  const boot = await openRealmBoot({ io: dev.io, id: c.id });
  assert.equal(boot.restored, undefined);
  assert.equal(boot.snap.level, 12, 'the service\'s');
  assert.equal(readUnsent(dev.storage, c.id), null);
});

// ═══ STRANDED (FIELD BUGS 2026-10-25: "Guild standing dropped from 100 brotherhood and mages 98 because i logged into ═
// the browser not exe"; "all quests are gone and standings reset") - bible/06-Systems/Realm-Arc.md SAVES-SAID ═════════

test('STRANDED: a copy whose put LANDED with its answer lost is the realm\'s save - dropped at the join, never set aside', async () => {
  const acct = await account();
  const dev = acct.device();
  const c = await joined(acct, dev);
  dev.door.plan = ['lose-answer'];
  await c.session.checkpoint(JSON.stringify(save(14, 5)));
  assert.equal(c.row().seq, 2, 'it landed');
  assert.equal(readUnsent(dev.storage, c.id)?.missed, true, 'and the session cannot know it');
  await c.session.leave({ keepalive: true });
  const boot = await openRealmBoot({ io: dev.io, id: c.id });
  assert.equal(boot.stranded, undefined);
  assert.equal(boot.snap.level, 14, 'the realm\'s save is the copy');
  assert.equal(readStranded(dev.storage, c.id), null);
  assert.equal(readUnsent(dev.storage, c.id), null);
});

test('STRANDED: the one way it is wrong, named - a put that landed unanswered, then a save from another device, sets the copy aside although the realm took it', async () => {
  const acct = await account();
  const dev = acct.device();
  const c = await joined(acct, dev);
  dev.door.plan = ['lose-answer'];
  await c.session.checkpoint(JSON.stringify(save(14, 5)));
  await c.session.leave({ keepalive: true });
  const other = acct.device();
  const theirs = await openRealmBoot({ io: other.io, id: c.id });
  assert.equal(theirs.snap.level, 14, 'the other device plays what landed');
  await sessionOf(other, c.id, theirs).checkpoint(JSON.stringify(save(15, 5)));
  const boot = await openRealmBoot({ io: dev.io, id: c.id });
  assert.equal(boot.stranded, true, 'the realm\'s save is no longer the copy - so the word says "may"');
  assert.equal(boot.snap.level, 15);
});

test('STRANDED: an ordinary close\'s copy (its put cut off, never refused) behind the record is dropped at the join - its put usually landed', async () => {
  const acct = await account();
  const dev = acct.device();
  let shown = true;
  const c = await joined(acct, dev, undefined, { hidden: () => !shown });
  shown = false;
  dev.door.plan = ['hang'];
  void c.session.checkpoint(JSON.stringify(save(14, 2000)));
  assert.equal(readUnsent(dev.storage, c.id)?.missed, false);
  await c.session.leave({ keepalive: true });
  const other = acct.device();
  const theirs = await openRealmBoot({ io: other.io, id: c.id });
  await sessionOf(other, c.id, theirs).checkpoint(JSON.stringify(save(13, 9)));
  const boot = await openRealmBoot({ io: dev.io, id: c.id });
  assert.equal(boot.stranded, undefined);
  assert.equal(readStranded(dev.storage, c.id), null);
  assert.equal(readUnsent(dev.storage, c.id), null);
});

test('STRANDED: a join that cannot read the realm\'s save keeps the copy behind the record for the next join, which sets it aside', async () => {
  const acct = await account();
  const dev = acct.device();
  const c = await joined(acct, dev);
  dev.door.plan = ['offline'];
  await c.session.checkpoint(JSON.stringify(save(20, 1)));
  await c.session.leave({ keepalive: true });
  const other = acct.device();
  const theirs = await openRealmBoot({ io: other.io, id: c.id });
  await sessionOf(other, c.id, theirs).checkpoint(JSON.stringify(save(13, 9)));
  const saves = acct.env.SAVES;
  acct.env.SAVES = null;   // the service's storage away: the save cannot be read
  const failed = await openRealmBoot({ io: dev.io, id: c.id });
  acct.env.SAVES = saves;
  assert.equal(failed.ok, false);
  assert.equal(readUnsent(dev.storage, c.id)?.missed, true, 'not dropped before the realm\'s save was read');
  const boot = await openRealmBoot({ io: dev.io, id: c.id });
  assert.equal(boot.stranded, true);
  assert.equal(readStranded(dev.storage, c.id)?.text, JSON.stringify(save(20, 1)));
});

test('STRANDED: a long life\'s packed copy is set aside packed, and opens to the save', async () => {
  const acct = await account();
  const dev = acct.device();
  const c = await joined(acct, dev);
  const text = longSave(33);
  dev.door.plan = ['offline'];
  await c.session.checkpoint(text);
  await settle();   // packed off the frame
  assert.ok(readUnsent(dev.storage, c.id)?.packed);
  await c.session.leave({ keepalive: true });
  const other = acct.device();
  const theirs = await openRealmBoot({ io: other.io, id: c.id });
  await sessionOf(other, c.id, theirs).checkpoint(JSON.stringify(save(13, 9)));
  const boot = await openRealmBoot({ io: dev.io, id: c.id });
  assert.equal(boot.stranded, true);
  const kept = readStranded(dev.storage, c.id);
  assert.equal(kept.text, null);
  assert.ok(kept.packed.startsWith(REALM_UNSENT_PACKED));
  assert.equal(await unpackUnsent(kept.packed), text);
});

test('STRANDED: the player\'s own delete takes the set-aside copy with the character', async () => {
  const acct = await account();
  const dev = acct.device();
  const c = await joined(acct, dev);
  dev.door.plan = ['offline'];
  await c.session.checkpoint(JSON.stringify(save(20, 1)));
  await c.session.leave({ keepalive: true });
  const other = acct.device();
  const theirs = await openRealmBoot({ io: other.io, id: c.id });
  const os = sessionOf(other, c.id, theirs);
  await os.checkpoint(JSON.stringify(save(13, 9)));
  await os.leave({ keepalive: true });
  assert.equal((await openRealmBoot({ io: dev.io, id: c.id })).stranded, true);
  assert.equal((await realmDelete(dev.io, c.id)).ok, true);
  assert.equal(readStranded(dev.storage, c.id), null);
});

test('STRANDED with SEAT-SAVES: a tab still playing when another device joined its character is refused `lease` at its next save - its copy kept, the session sent to the door, and its own device\'s next join sets the copy aside', async () => {
  const acct = await account();
  const dev = acct.device();
  const c = await joined(acct, dev);
  const other = acct.device();
  const theirs = await openRealmBoot({ io: other.io, id: c.id });   // the browser joins while the desktop app still plays
  const refused = await c.session.checkpoint(JSON.stringify(save(16, 3)));
  assert.equal(refused.ok, false);
  assert.deepEqual(c.lost, ['lease'], 'to the door');
  assert.deepEqual({ ...readUnsent(dev.storage, c.id), at: null }, { seq: 1, text: JSON.stringify(save(16, 3)), at: null, missed: true }, 'kept, marked');
  await sessionOf(other, c.id, theirs).checkpoint(JSON.stringify(save(13, 9)));
  const boot = await openRealmBoot({ io: dev.io, id: c.id });
  assert.equal(boot.snap.level, 13, 'the realm\'s save is played');
  assert.equal(boot.stranded, true);
  assert.equal(readStranded(dev.storage, c.id)?.text, JSON.stringify(save(16, 3)));
});
