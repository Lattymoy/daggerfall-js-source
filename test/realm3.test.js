// REALM P1.3-P1.5 (2026-09-28, Mac: "A true separation while allowing people to still play offline"; decisions 1-3;
// bible/06-Systems/Realm-Arc.md): THE DOOR, THE BOOT AND CUSTOMS.
//   P1.3 - the Online door lists the realm's characters; its Play boots ?online&load&realm=<id>, and the boot joins the
//          character and reads its save from the service - never a local slot. Every save of a realm character is the
//          service's checkpoint (the composers' sink), a lost lease takes the player to the door with the reason, and a
//          character born online is made at the service after chargen and booted from it.
//   P1.4 - "Copy to offline" writes the realm's save as a NEW offline character; nothing played on it comes back.
//   P1.5 - customs brings an offline character in once: loans settled, liquid wealth capped at the level's allowance
//          (OPEN), on a copy; the service carries its Renown, homes and guild to the realm's id.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../server-account/src/index.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { SESSION_KEY } from '../src/net/accountClient.js';
import {
  realmIo, realmCreate, realmPut, realmCustoms, realmFetch, openRealmBoot, realmSummaryOf, realmRowAsSave, realmBootSearch,
  realmRefusalText, setRealmNotice, takeRealmNotice, REALM_NOTICE_KEY, REALM_ID_SHAPE, REALM_SAVED_TEXT, REALM_OFFLINE_TEXT,
} from '../src/systems/realmSaves.js';
import { applyCustoms, liquidWealthOf, customsAllowance, customsLines, CUSTOMS_WEALTH_BASE, CUSTOMS_WEALTH_PER_LEVEL } from '../src/systems/realmCustoms.js';
import { createBankAccounts } from '../src/systems/banking.js';
import { BOOT_DOOR_KEYS } from '../src/systems/onlineLane.js';
import { LETTER_OF_CREDIT_TEMPLATE, goldStack } from '../src/systems/inventory.js';
import { ACCEPTED } from '../src/net/legalLaw.js';   // TERMS1: a request that makes an account carries the versions ticked

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
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
    // D1's batch is one transaction (test/realm4.test.js's face): all of it, or none - AUDIT REALM's delete and customs ride one
    async batch(list) {
      db.exec('BEGIN');
      try { const out = list.map((st) => st._result()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}
function r2() {
  const m = new Map();
  return {
    async put(key, body) { m.set(key, new Uint8Array(body instanceof ArrayBuffer ? body : new TextEncoder().encode(String(body)))); return { key }; },
    async get(key) { const v = m.get(key); return v === undefined ? null : { key, size: v.byteLength, body: v }; },
    async delete(key) { m.delete(key); },
  };
}
function fakeStorage() {
  const m = new Map();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => m.delete(k) };
}
async function device() {
  _resetKeyForTests();
  const env = { DB: d1(), SAVES: r2(), ACCOUNT_VERSION: 'test1' };
  const g = await (await worker.fetch(new Request('https://accounts.invalid/v1/auth/guest', { method: 'POST', body: JSON.stringify(ACCEPTED) }), env)).json();
  const storage = fakeStorage();
  storage.setItem(SESSION_KEY, JSON.stringify({ id: g.id, secret: g.secret }));
  return { env, g, io: realmIo({ fetch: (u, i) => worker.fetch(new Request(u, i), env), storage }) };
}
const letter = (value) => ({ group: 'MiscItems', templateIndex: LETTER_OF_CREDIT_TEMPLATE, value });

test('REALM P1.5: customs settles every loan - the Empire keeps none for a newcomer - then caps what is left at the level\'s allowance: the fullest account first, the wagon, the letters, the purse', () => {
  assert.equal(customsAllowance(10), CUSTOMS_WEALTH_BASE + 10 * CUSTOMS_WEALTH_PER_LEVEL);
  assert.equal(customsAllowance(0), CUSTOMS_WEALTH_BASE + CUSTOMS_WEALTH_PER_LEVEL, 'level one at the least');
  const bank = createBankAccounts();
  Object.assign(bank[3], { loanTotal: 11_000, accountGold: 1_000, loanDueDate: 5_000 });
  Object.assign(bank[7], { accountGold: 40_000 });
  Object.assign(bank[9], { accountGold: 500_000 });
  const snap = { level: 1, classicMinutes: 100, goldPieces: 5_000, items: [letter(20_000), { group: 'Weapons', templateIndex: 120 }], wagonItems: [goldStack(3_000)], bankAccounts: bank };
  assert.equal(liquidWealthOf(snap), 5_000 + 20_000 + 3_000 + 541_000);
  const r = applyCustoms(snap);
  assert.deepEqual([r.called, r.paid, r.owed], [11_000, 11_000, 0], 'the loan paid: its own account, then the others');
  assert.deepEqual([bank[3].loanTotal, bank[3].accountGold], [0, 0]);
  assert.equal(r.wealth, 569_000 - 11_000, 'measured after the loans');
  assert.equal(r.allowance, 30_000);
  assert.equal(liquidWealthOf(snap), 30_000, 'what is left is the allowance');
  assert.deepEqual([bank[7].accountGold, bank[9].accountGold], [2_000, 0], 'the fullest account first - region 9\'s 500,000, then 28,000 of region 7\'s 30,000 (the loan took 10,000 of its 40,000) ...');
  assert.equal(r.taken, 528_000);
  assert.deepEqual([snap.wagonItems.length, snap.items.length, snap.goldPieces], [1, 2, 5_000], '... and the wagon, the letter and the purse untouched, the allowance reached in the bank');
  assert.ok(customsLines(r).some((l) => /528000 stays behind/.test(l)));
  // a thin one: the letters and the purse too, emptied letters gone from the pack
  const thin = { level: 1, goldPieces: 25_000, items: [letter(20_000)], wagonItems: [goldStack(10_000)], bankAccounts: createBankAccounts() };
  applyCustoms(thin);
  assert.deepEqual([thin.wagonItems.length, thin.items.map((it) => it.value), thin.goldPieces], [0, [5_000], 25_000], 'the wagon\'s gold, then the letter, spent before the purse');
  const bare = { level: 1, goldPieces: 30_000, items: [letter(10_000)], wagonItems: [], bankAccounts: createBankAccounts() };
  applyCustoms(bare);
  assert.deepEqual([bare.items.length, bare.goldPieces], [0, 30_000], 'a letter spent whole leaves the pack');
  const purse = { level: 1, goldPieces: 50_000, items: [], wagonItems: [], bankAccounts: createBankAccounts() };
  applyCustoms(purse);
  assert.equal(purse.goldPieces, 30_000, 'and the purse last');
  // a debt it cannot pay stays owed, due now
  const owing = { level: 1, classicMinutes: 777, goldPieces: 100, items: [], wagonItems: [], bankAccounts: createBankAccounts() };
  Object.assign(owing.bankAccounts[5], { loanTotal: 5_000, loanDueDate: 900_000 });
  const o = applyCustoms(owing);
  assert.deepEqual([o.paid, o.owed, owing.bankAccounts[5].loanTotal, owing.bankAccounts[5].loanDueDate, owing.goldPieces], [100, 4_900, 4_900, 777, 0]);
  assert.match(customsLines(o)[0], /4900 could not be paid and falls due/);
  assert.deepEqual(customsLines({ called: 0, owed: 0, taken: 0 }), ['Customs found nothing to settle.']);
});

test('REALM P1.3: the tile a checkpoint carries and the tile the door draws - the save\'s own fields, "Playing now", no local key', () => {
  assert.deepEqual(realmSummaryOf({ level: 9, career: { name: 'Nightblade' }, race: 'Dark Elf', gender: 'female', faceIndex: 4 }),
    { level: 9, className: 'Nightblade', race: 'Dark Elf', gender: 'female', face: 4 });
  assert.deepEqual(realmSummaryOf({}), { level: null, className: null, race: null, gender: 'male', face: null });
  const row = { id: 'r' + 'a'.repeat(20), name: 'Nystul', summary: { level: 3, className: 'Mage', race: 'Breton', gender: 'male', face: 2 }, playing: true, bytes: 9, customs: true, updatedAt: 1 };
  const save = realmRowAsSave(row, { dateText: () => 'a day' });
  assert.deepEqual([save.realmId, save.name, save.career, save.level, save.faceIndex, save.when, save.saveName, save.unfinished, 'key' in save], [row.id, 'Nystul', 'Mage', 3, 2, 'Playing now', 'Brought in', false, false]);
  assert.equal(realmRowAsSave({ ...row, playing: false, customs: false, bytes: 0 }, { dateText: () => 'a day' }).when, 'a day');
  assert.equal(realmRowAsSave({ ...row, bytes: 0 }).unfinished, true, 'a character never saved');
});

test('REALM P1.3: the boot\'s join reads the save from the service - the realm\'s id on it, the lease and the sequence beside it; a character never saved, one not the account\'s and one of no realm shape are refused', async () => {
  const { io } = await device();
  const never = (await realmCreate(io, 'Unsaved')).data;
  assert.deepEqual(await openRealmBoot({ io, id: never.id }), { ok: false, error: 'no-data' }, 'never saved');
  const made = (await realmCreate(io, 'Nystul')).data;
  await realmPut(io, made.id, { lease: made.lease, seq: 1 }, JSON.stringify({ v: 1, name: 'Nystul', level: 1, characterId: 'c0ffee00-offline' }));   // AUDIT REALM2 S1: a new character's first save
  const boot = await openRealmBoot({ io, id: made.id });
  assert.equal(boot.ok, true);
  assert.deepEqual([boot.snap.name, boot.snap.characterId, boot.seq], ['Nystul', made.id, 1], 'the realm\'s id on the save, whatever it named');
  assert.match(boot.lease, /^[0-9a-f]{32}$/);
  assert.notEqual(boot.lease, made.lease, 'a new lease - the boot took the character');
  assert.deepEqual(await openRealmBoot({ io, id: 'r' + '0'.repeat(20) }), { ok: false, error: 'no-realm-character' });
  assert.deepEqual(await openRealmBoot({ io, id: 'c0ffee00' }), { ok: false, error: 'no-realm-character' }, 'never asked');
  assert.deepEqual(await openRealmBoot({ io: null, id: made.id }), { ok: false, error: 'signed-out' });
  assert.match(made.id, REALM_ID_SHAPE);
});

test('REALM P1.5 end to end: customs on a copy, the realm character made once from an offline one that played online, its first save the copy - and the boot reads it back with the realm\'s id and its Renown carried', async () => {
  const { env, g, io } = await device();
  const origin = 'c0ffee00-1111-2222-3333-444455556666';
  const bank = createBankAccounts();
  Object.assign(bank[2], { accountGold: 900_000 });
  const local = { v: 1, name: 'Nystul', level: 2, characterId: origin, goldPieces: 1_000, items: [], wagonItems: [], bankAccounts: bank };
  const copy = JSON.parse(JSON.stringify(local));
  applyCustoms(copy);
  assert.equal((await realmCustoms(io, origin, copy.name, realmSummaryOf(copy))).error, 'customs-never-online');
  env.DB._raw.prepare('INSERT INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(g.id, origin, 'Nystul', 1_234, 1, 1);
  env.DB._raw.prepare('INSERT INTO realm_census (player, char_id) VALUES (?, ?)').run(g.id, origin);   // played online before the realm (migration 0020's census)
  const made = await realmCustoms(io, origin, copy.name, realmSummaryOf(copy));
  assert.equal(made.ok, true);
  copy.characterId = made.data.id;
  assert.equal((await realmPut(io, made.data.id, { lease: made.data.lease, seq: 1, summary: realmSummaryOf(copy) }, JSON.stringify(copy))).ok, true);
  const boot = await openRealmBoot({ io, id: made.data.id });
  assert.equal(liquidWealthOf(boot.snap), customsAllowance(2), 'the capped copy is the realm\'s');
  assert.equal(local.bankAccounts[2].accountGold, 900_000, 'the offline character is untouched');
  assert.equal(env.DB._raw.prepare('SELECT xp FROM renown_tracks WHERE char_id = ?').get(made.data.id).xp, 1_234, 'its Renown came in');
  assert.equal((await realmCustoms(io, origin, 'Again')).error, 'customs-already');
  // P1.4: and back out again as a NEW offline character - the realm's save, a new id (the door's copyToOffline)
  const got = await realmFetch(io, made.data.id);
  assert.equal(JSON.parse(got.text).characterId, made.data.id);
  const door = src('src/ui/enhancedMenu.js');
  assert.match(door, /snap\.characterId = mintCharacterId\(\);\s*\n\s*const r = saveSlot\(snap\.name \|\| row\.name, 'Copied from the realm', snap, \{ storage: appStorage\(\) \}\);/);
});

test('REALM P1.3: a notice crosses the reload once; the boot\'s address carries the online lane, the load door, the id, the classic start and the world host\'s door alone; every word has its sentence', () => {
  const s = fakeStorage();
  setRealmNotice(s, 'Why you are back');
  assert.equal(s.getItem(REALM_NOTICE_KEY), 'Why you are back');
  assert.equal(takeRealmNotice(s), 'Why you are back');
  assert.equal(takeRealmNotice(s), null, 'once');
  assert.equal(takeRealmNotice(null), null);
  const q = new URLSearchParams(realmBootSearch('?online=1&loadkey=4&test=x&classic=1&keep=1', 'r' + 'b'.repeat(20), BOOT_DOOR_KEYS));
  // REALM-BIRTH (FIELD BUGS 2026-09-30, PIN MOVED): the address is the Online door's Play - its classic start set again, and
  // `world`, the scene door main.js boots the world host on; without one a born character's reload was the front door's
  assert.deepEqual(Object.fromEntries(q), { keep: '1', online: '1', load: '1', realm: 'r' + 'b'.repeat(20), classic: '1', world: '1' }, 'no stale door key rides in');
  assert.ok(BOOT_DOOR_KEYS.includes('realm') && BOOT_DOOR_KEYS.includes('realmnew'));
  for (const w of ['signed-out', 'no-data', 'lease', 'no-realm-character', 'customs-never-online', 'customs-already', 'customs-load-once', 'test-room', 'no-room', 'left']) {
    assert.ok(realmRefusalText(w) && realmRefusalText(w) !== realmRefusalText('utterly-unknown'), w);
  }
  assert.equal(REALM_SAVED_TEXT, 'Saved to the realm.');
  assert.match(REALM_OFFLINE_TEXT, /plays offline/);
});

test('REALM P1.3 by source: the boot joins before any save is read, never a slot; a save of a realm character is the service\'s checkpoint in every composer; the exits leave; a born character is made, saved at 1 and booted from the realm', () => {
  const w = src('src/scenes/world.js');
  const boot = w.indexOf('export async function bootWorld(');
  const join = w.indexOf("const realmBoot = params.has('online') && params.has('realm') && params.has('load') ? await openRealmBoot({ io: realmIoNow(), id: params.get('realm') }) : null;");
  assert.ok(join > boot && join < w.indexOf('const bootLoadPick'), 'joined before the load door\'s pick');
  assert.match(w, /if \(realmBoot && !realmBoot\.ok\) \{ setRealmNotice\(globalThis\.sessionStorage, realmRefusalText\(realmBoot\.error\)\); exitToTitleMenu\(\); return; \}/);
  assert.match(w, /const realmRefused = params\.has\('online'\) && !realmBoot && !realmNew;\s*\n\s*if \(realmRefused\) \{ params\.delete\('online'\); publishBootParams\(params\); \}/, 'no realm character, no online');
  assert.match(w, /: realmBoot \? \{ realm: true \}   \/\/ REALM P1\.3: the service's save, never a slot/);
  assert.match(w, /const bootSnap = \(\) => \(bootSnapRead === undefined \? [^\n]*\n\s*if \(realmBoot\) \{ bootSnapRead = realmBoot\.snap; realmBoot\.snap = null; \}/, 'the realm\'s save is the boot\'s one parse (AUDIT MW-EARLY F3) - and the join\'s answer lets it go, so the door\'s release is the last hold');
  assert.match(w, /const onlineOn = params\.has\('online'\) && !realmNew;/, 'a character being born joins no relay');
  assert.match(w, /if \(realmSession\) setRealmSaveSink\(\(snap\) => \{[\s\S]{0,160}?realmSession\.checkpoint\(realmSaveWithHeld\(snap, holding\), realmSummaryOf\(playerEntity\)\)/, 'every save of a realm character is its checkpoint (and, landed, it clears the spoils it held - below; AUDIT RESCUE-SAVE A1: the save names them, so the next join adopts rather than hands them)');
  assert.match(w, /if \(realmSession\) return realmCheckpoint\((?:\{ sink \})?\);/, 'the periodic checkpoint is the realm\'s, once');   // AUDIT PRE-MERGE 1003 O10: the caller's sink handed through (onlineCheckpointLanded)
  assert.match(w, /if \(realmSession\) return;   \/\/ the realm's: no slot/, 'the page going writes no local slot');
  // AUDIT REALM2 C2: the leave as the page GOES (pagehide), never before the unload guard is answered; C7: the Exit's
  // last checkpoint behind a duel's end and P0.5's gate (test/auditrealm2_client.test.js mounts both)
  assert.match(w, /whenPageGoes\(globalThis, \(\) => \{ realmSession\.leave\(\{ keepalive: true \}\); \}, \(\) => \{ realmSession\.rejoin\(\); \}\);/, 'the page going leaves; shown again, it joins again');
  assert.match(w, /setBeforeTitleExit\(async \(\) => \{ if \(!realmSession\.lost\) \{ try \{ duelLeaveNow\(\); \} catch \{ \/\* no duel was built: nothing to end \*\/ \} onlineCheckpoint\(\); await Promise\.race\(\[realmSession\.leave\(\), new Promise\(\(r\) => \{ setTimeout\(r, REALM_EXIT_WAIT_MS\); \}\)\]\); \} \}\);/, 'the last checkpoint and the leave, five seconds at most');
  assert.match(w, /function realmLost\(why\) \{\s*\n\s*setRealmNotice\(globalThis\.sessionStorage, realmRefusalText\(why\)\);\s*\n\s*exitToTitleMenu\(\);/);
  assert.match(w, /if \(realmNew\) realmBirth\(\)/, 'born after chargen');
  const birth = w.slice(w.indexOf('async function realmBirth()'));
  const order = ['realmCreate(io,', 'playerEntity.characterId = made.data.id;', 'realmPut(io, made.data.id, { lease: made.data.lease, seq: 1,', 'location.replace(`${location.pathname}${realmBootSearch(location.search, made.data.id, BOOT_DOOR_KEYS)}`);'].map((t) => birth.indexOf(t));
  assert.ok(order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1])), 'made, the realm\'s id, saved at 1, then booted from the realm');
  for (const f of ['src/scenes/world.js', 'src/scenes/dungeonContext.js']) {
    assert.match(src(f), /const into = sink \?\? realmSaveSink\(\);[^\n]*\n\s*if \(into\) \{ const said = into\(snap\); if \(!quiet\) sayRealmSave\(said, [^\n]*\); return true; \}[^\n]*\n\s*const r = saveSlot\(/, `${f}: a realm character's save never reaches a slot (AUDIT REALM2 C2: its word the realm's answer)`);
  }
  const shared = src('src/scenes/shared.js');
  assert.match(shared, /export function exitToTitleMenu\(\) \{\n\s+claimFrame\(\);[^\n]*\n\s*\/\/[^\n]*\n\s*if \(_beforeTitleExit\) \{ const f = _beforeTitleExit; _beforeTitleExit = null; Promise\.resolve\(\)\.then\(f\)\.catch\(\(\) => \{\}\)\.finally\(\(\) => exitToTitleMenu\(\)\); return; \}/, 'the last checkpoint once, then the door');
  const main = src('src/main.js');
  assert.match(main, /const realmId = choice === 'online' \? takePickedRealmId\(\) : null;\s*\n\s*if \(realmId\) params\.set\('realm', realmId\);\s*\n\s*else params\.delete\('realm'\);\s*\n\s*if \(choice === 'online-new'\) params\.set\('realmnew', '1'\);\s*\n\s*else params\.delete\('realmnew'\);/);
  const menu = src('src/ui/enhancedMenu.js');
  assert.match(menu, /\{ label: save\.unfinished \? 'Never saved' : 'Play', primary: true, disabled: realmBusy \|\| save\.unfinished, onClick: \(\) => \{ _pickedRealmId = row\.id; onAction\('online'\); \} \}/);
  assert.match(menu, /\{ label: 'New online character', primary: !realmRows\.length, disabled: realmBusy \|\| realmRows\.length >= realmMax, onClick: \(\) => onAction\('online-new'\) \}/);
  assert.match(menu, /label: 'Delete character', disabled: realmBusy, onClick: \(\) => ask\(/, 'a delete asks first');
  const bring = menu.slice(menu.indexOf('function bringOnline(save)'));   // AUDIT LIVED1 G: the copy goes through the door between the lanes (systems/offlineCopy.js)
  const steps = ['const copy = onlineCopyOf(snap, sharedClassicMinutes(Date.now()));', 'applyCustoms(copy);', 'await realmCustoms(io, snap.characterId,', 'copy.characterId = made.data.id;', 'await realmPut(io, made.data.id, { lease: made.data.lease, seq: 1,'].map((t) => bring.indexOf(t));
  assert.ok(steps.every((at, i) => at > 0 && (i === 0 || at > steps[i - 1])), 'customs on a copy, made once, the realm\'s id, saved at 1');
  assert.match(bring, /if \(snap\.testRoom === true\) return \{ ok: false, error: 'test-room' \};/);
});

test('REALM P1.3: a page put away checkpoints the realm character - the realm\'s own hook, never the world host\'s frame loop (AUDIT WORLD7/8)', async () => {
  const { whenPageHides } = await import('../src/systems/realmSaves.js');
  const listeners = [];
  const doc = { visibilityState: 'visible', addEventListener: (type, fn) => listeners.push([type, fn]) };
  let fired = 0;
  whenPageHides(doc, () => { fired++; });
  assert.deepEqual(listeners.map(([t]) => t), ['visibilitychange']);
  listeners[0][1]();
  assert.equal(fired, 0, 'shown: nothing');
  doc.visibilityState = 'hidden';
  listeners[0][1]();
  assert.equal(fired, 1, 'hidden: once');
  whenPageHides(null, () => {});   // no document: nothing, no throw
  assert.match(src('src/scenes/world.js'), /whenPageHides\(globalThis\.document, \(\) => \{ if \(online\) onlineCheckpoint\(\); \}\);/);
});

test('REALM P1.3: a realm checkpoint that lands clears the gate\'s spoils it was composed holding - and only those; one that never lands clears none (without it every boot handed the same spoils back)', { timeout: 60_000 }, async () => {
  const { createSpoilsPool, SPOILS_STORE_KEY, recoverSpoils } = await import('../src/scenes/spoilsPool.js');
  const mem = new Map();
  const store = { get: (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null), set: (k, v) => mem.set(k, JSON.stringify(v)), remove: (k) => mem.delete(k) };
  const floor = (from, dir, len) => { if (dir[1] >= 0) return null; const t = from[1] / -dir[1]; return t <= len ? { dist: t, normal: [0, 1, 0] } : null; };
  const pack = [];
  const pool = createSpoilsPool({ ray: floor, now: () => 1000, take: (x) => pack.push(x), store, who: () => 'r' + 'a'.repeat(20), wall: () => 1_700_000_000_000 });
  const who = 'r' + 'a'.repeat(20);
  assert.equal(pool.grant({ day: 700, seed: 99, level: 8, acct: 'acct-a' }), true);
  const composed = pool.heldIds(who);   // a checkpoint composed now holds these
  assert.equal(composed.length, 1);
  assert.equal(pool.grant({ day: 701, seed: 7, level: 8, acct: 'acct-a' }), true);   // more spoils come in before it lands
  assert.equal(store.get(SPOILS_STORE_KEY).length, 2);
  assert.equal(pool.saved(who, composed), 1, 'it lands: the record it held goes');
  assert.equal(store.get(SPOILS_STORE_KEY).length, 1, 'the one that came after waits for a checkpoint that holds it');
  assert.equal(pool.saved(who, []), 0, 'a checkpoint holding none clears none');
  // and at the next boot, what no landed checkpoint held is handed over; what one held is not
  const again = [];
  assert.ok(recoverSpoils(store, (x) => again.push(x), { who, saves: [] }) > 0);
  assert.equal(again.length, pack.length - again.length, 'only the second grant\'s pieces come back');
  // the world host wires it: the sink captures what the pool holds and tells it when the checkpoint lands
  const w = src('src/scenes/world.js');
  assert.match(w, /const holding = _realmSaveHooks\.held\(who\);\s*\n\s*return realmSession\.checkpoint\(realmSaveWithHeld\(snap, holding\), realmSummaryOf\(playerEntity\)\)\.then\(\(r\) => \{ if \(r\?\.ok && holding\?\.length\) _realmSaveHooks\.landed\(who, holding\); return r; \}\)/);
  assert.match(w, /_realmSaveHooks\.landed = \(who, ids\) => \{ try \{ spoilsPool\?\.saved\(who, ids\); \}/);   // AUDIT REALM2 C1: and the raid pool's beside it (test/auditrealm2_client.test.js)
});
