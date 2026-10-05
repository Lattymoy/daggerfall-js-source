// AUDIT 625 (2026-10-05, Mac: "Lets do a comprehensive audit on this"), the SILVER lens: PR #625's SILVER-FINDS, audited
// - the client's half (the service's are test/silverfinds_service.test.js's AUDIT 625 S1 and S6).
// bible/01-Overview/Audit-625.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { setSilverFinder, silverFindAt, _resetSilverFindsForTests } from '../src/systems/silverFinds.js';
import { MARKS_RID_RE } from '../src/net/marksLaw.js';
import { accountMarks, SESSION_KEY, accountRefusalText } from '../src/net/accountClient.js';
import { createMarksBook, MARKS_TRIES, MARKS_OWED_KEY, FINDS_OWED_MAX } from '../src/net/marksBook.js';
import { openCorpseLoot, ARROW_TEMPLATE_INDEX, arrowsOnly } from '../src/scenes/corpseMarker.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DAY_MS = 86_400_000;
const T = 1_800_000_000_000;
const found = (struck, balance, n) => ({ ok: true, data: { ok: true, struck, balance, today: { found: n, max: 20 } } });
/** A book over a door that answers by the hand of `answer(kind, rid, account)`, the session the door holds `who.account`
 *  (the door refuses an ask for another account - AUDIT 625 S4's law, as the real one keeps it below). */
function bookOver(answer, { store = null, account = 'acct-1' } = {}) {
  const asks = [];
  const who = { account, at: T };
  const door = {
    account: () => who.account,
    find: async (kind, rid, as) => {
      if (as != null && as !== who.account) return { ok: false, error: 'no-session' };
      asks.push([kind, rid, who.account]);
      return answer(kind, rid, who.account);
    },
    balance: async () => ({ ok: true, data: { balance: 0, today: null } }),
  };
  const book = createMarksBook({ door, store, sleep: async () => {}, nowMs: () => who.at });
  return { book, asks, who };
}
const memStore = () => { const m = new Map(); return { get: (k) => m.get(k) ?? null, set: (k, v) => { if (v == null) m.delete(k); else m.set(k, JSON.parse(JSON.stringify(v))); }, m }; };

// ─── S3: AN OWED FIND IS NEVER DROPPED ───────────────────────────────

test('AUDIT 625 S3 (ASYNC NEVER DROPS): a find owed stays owed through every answer that says nothing about it - the switch shut, a guest, the session gone or refused - and is asked again, its own id, when silver is this account\'s again; only a refusal of the find itself lets it go (mutants: the closed dropped the rest; a session error dropped; the owed asked behind a closed switch)', async () => {
  // the audit's run: the network down (U1 owed, U2 owed unasked), then the switch shut, then open again
  const net = { state: 'down', n: 0 };
  const b = bookOver(() => (net.state === 'down' ? { ok: false, error: 'offline' } : net.state === 'shut' ? { ok: false, error: 'marks-closed' } : found(1, ++net.n, net.n)));
  await b.book.find('corpse');
  await b.book.find('pile');
  const [u1] = [b.asks[0][1]];
  net.state = 'shut';
  assert.deepEqual(await b.book.find('search'), [], 'the switch shut');
  assert.equal(b.book.state.open, false);
  assert.equal(b.asks.at(-1)[1], u1, 'the first owed was asked, and answered closed');
  const shutAsks = b.asks.length;
  assert.deepEqual(await b.book.find('corpse'), [], 'closed: nothing asked');
  assert.equal(b.asks.length, shutAsks);
  net.state = 'open';
  await b.book.refresh();
  const back = await b.book.find('pile');
  assert.deepEqual(back.map((f) => f.kind), ['corpse', 'pile', 'search', 'pile'], 'every find owed, in its order, then this one');
  assert.equal(b.asks.at(-4)[1], u1, 'with its own id');
  // the session gone, or the service refusing it: owed, and the rest owed unasked
  for (const error of ['no-session', 'auth', 'marks-need-account']) {
    let gone = true;
    const c = bookOver(() => (gone ? { ok: false, error } : found(1, 1, 1)));
    assert.deepEqual(await c.book.find('corpse'), [], error);
    gone = false;
    if (error === 'marks-need-account') await c.book.refresh();
    assert.deepEqual((await c.book.find('pile')).map((f) => f.kind), ['corpse', 'pile'], `${error}: the owed asked again`);
    assert.equal(c.asks[0][1], c.asks.at(-2)[1], 'its own id');
  }
  // a refusal of the find itself lets it go: a request id the service cannot read, a kind of none, its hour spent
  for (const error of ['marks-rid', 'bad-find', 'marks-rate']) {
    let first = true;
    const d = bookOver(() => (first ? ((first = false), { ok: false, error }) : found(1, 1, 1)));
    await d.book.find('corpse');
    assert.deepEqual((await d.book.find('pile')).map((f) => f.kind), ['pile'], `${error}: let go`);
  }
  // ...and its hour spent asks none behind it: the find answered so is let go, the rest wait owed for the next hour
  const hour = { state: 'down' };
  const e = bookOver(() => (hour.state === 'down' ? { ok: false, error: 'offline' } : hour.state === 'spent' ? { ok: false, error: 'marks-rate' } : found(1, 1, 1)));
  await e.book.find('corpse');
  await e.book.find('pile');
  hour.state = 'spent';
  const spentAt = e.asks.length;
  assert.deepEqual(await e.book.find('search'), []);
  assert.equal(e.asks.length, spentAt + 1, 'one ask - the first owed, refused; the rest unasked');
  hour.state = 'open';
  assert.deepEqual((await e.book.find('corpse')).map((f) => f.kind), ['pile', 'search', 'corpse'], 'the refused one let go, the rest asked in their order');
});

test('AUDIT 625 S3: the owed finds are KEPT in the book\'s store, as the Bank\'s kept sale is - a reload asks them again by their own ids; what the store holds is read under its law, FINDS_OWED_MAX at most; a store that refuses a write keeps them in memory (mutants: the owed unkept; the store\'s list believed whole)', async () => {
  const store = memStore();
  let down = true;
  const a = bookOver(() => (down ? { ok: false, error: 'offline' } : found(2, 2, 1)), { store });
  await a.book.find('corpse');
  const kept = store.get(MARKS_OWED_KEY);
  assert.equal(kept.length, 1);
  assert.deepEqual({ ...kept[0], rid: 'r' }, { rid: 'r', kind: 'corpse', account: 'acct-1' });
  assert.match(kept[0].rid, MARKS_RID_RE);
  down = false;
  const b = bookOver(() => found(2, 2, 1), { store });   // the next page's book, over the same store
  const out = await b.book.find('pile');
  assert.deepEqual(out.map((f) => f.kind), ['corpse', 'pile'], 'the find owed before the reload, asked first');
  assert.equal(b.asks[0][1], kept[0].rid, 'by its own id');
  assert.equal(store.get(MARKS_OWED_KEY), null, 'none owed now');
  // the store's word is read under its law: a stranger's shape, a kind of none, an id the service cannot read - none
  store.set(MARKS_OWED_KEY, [{ rid: 'short', kind: 'corpse', account: 'acct-1' }, { rid: kept[0].rid, kind: 'gather', account: 'acct-1' }, 7,
    ...Array.from({ length: FINDS_OWED_MAX + 4 }, (_, i) => ({ rid: `m${String(i).padStart(15, '0')}`, kind: 'pile', account: 'acct-1' }))]);
  const c = bookOver(() => found(1, 1, 1), { store });
  assert.equal((await c.book.find('search')).length, FINDS_OWED_MAX + 1, 'the bound, and this one');
  // a store that refuses keeps them in memory
  const refusing = { get: () => null, set: () => { throw new Error('quota'); } };
  let off = true;
  const d = bookOver(() => (off ? { ok: false, error: 'offline' } : found(1, 1, 1)), { store: refusing });
  await d.book.find('corpse');
  off = false;
  assert.deepEqual((await d.book.find('pile')).map((f) => f.kind), ['corpse', 'pile']);
});

// ─── S4: AN OWED FIND IS ITS OWN ACCOUNT'S ───────────────────────────

test('AUDIT 625 S4: a find is asked under the account that found it or not at all - the door reads the session once and sends ITS secret only when its account is the find\'s; another tab signed in between them is `no-session` and the find waits owed for its own (mutants: the account unchecked at the door; the find\'s account unhanded)', async () => {
  const sessions = { X: { id: 'X', secret: 'sx' }, Y: { id: 'Y', secret: 'sy' } };
  let signedIn = 'X';
  const storage = { getItem: (k) => (k === SESSION_KEY && signedIn ? JSON.stringify(sessions[signedIn]) : null), setItem() {}, removeItem() {} };
  const posts = [];
  const fetch = async (url, init) => { posts.push([url, init.headers.authorization, JSON.parse(init.body)]); return new Response(JSON.stringify({ ok: true, struck: 1, balance: 1, today: { found: 1, max: 20 } }), { status: 200, headers: { 'content-type': 'application/json' } }); };
  const door = accountMarks({ fetch, storage });
  signedIn = 'Y';
  assert.deepEqual(await door.find('corpse', 'm000000000000001', 'X'), { ok: false, error: 'no-session' }, 'X\'s find while Y is signed in');
  assert.equal(posts.length, 0, 'nothing posted under Y');
  signedIn = 'X';
  assert.equal((await door.find('corpse', 'm000000000000001', 'X')).ok, true);
  assert.deepEqual(posts.map(([u, a, b]) => [u.endsWith('/v1/marks/find'), a, b]), [[true, 'Bearer sx', { kind: 'corpse', rid: 'm000000000000001' }]]);
  // the book hands the find's account, so its owed ask is never another's
  let lost = true;
  const b = bookOver(() => (lost ? { ok: false, error: 'offline' } : found(1, 1, 1)), { account: 'X' });
  await b.book.find('corpse');
  lost = false;
  b.who.account = 'Y';
  assert.deepEqual((await b.book.find('pile')).map((f) => f.kind), ['pile'], 'Y asks its own alone');
  b.who.account = 'X';
  assert.deepEqual((await b.book.find('search')).map((f) => f.kind), ['corpse', 'search'], 'X\'s owed, under X');
  assert.deepEqual(b.asks.slice(MARKS_TRIES).map((a) => a[2]), ['Y', 'X', 'X']);
  assert.match(src('src/net/marksBook.js'), /door\.find\(f\.kind, f\.rid, f\.account\)/);
});

// ─── S1: AN ACCOUNT NOT YET A WEEK OLD ───────────────────────────────

test('AUDIT 625 S1 (the client\'s half): `marks-young` is the account\'s day - none of its finds owed (they are none of its own), none asked again until the UTC day turns; another account asks its own (mutants: the young find owed; asked again the same day)', async () => {
  let young = true;
  const b = bookOver(() => (young ? { ok: false, error: 'marks-young' } : found(1, 1, 1)));
  assert.deepEqual(await b.book.find('corpse'), []);
  assert.deepEqual(await b.book.find('pile'), [], 'the day: not asked');
  assert.equal(b.asks.length, 1);
  young = false;
  b.who.account = 'acct-2';
  assert.equal((await b.book.find('search')).length, 1, 'another account its own');
  b.who.account = 'acct-1';
  b.who.at = T + DAY_MS;
  assert.deepEqual((await b.book.find('pile')).map((f) => f.kind), ['pile'], 'the next day asked - the young find never owed');
  assert.equal(accountRefusalText('marks-young'), 'Silver turns up in finds and gathering once your account is a week old.', 'a word the service can say has its sentence');
});

// ─── S2, S5, S7, D6: WHERE A FIND IS ROLLED ──────────────────────────

test('AUDIT 625 D6: a body\'s find rolls only when its door OPENED it - a window that mounted, or the quick door\'s take - never on an open the pack refused (a werebeast\'s); and S7: a body of arrows alone rolls none, a peer\'s as my own, by the one law (mutants: the roll before the door\'s answer; the peer\'s arrows rolled)', () => {
  _resetSilverFindsForTests();
  const asked = [];
  setSilverFinder((k) => asked.push(k));
  const rnd = Math.random;
  Math.random = () => 0;
  try {
    const player = { items: [], goldPieces: 0 };
    const body = () => ({ corpse: true, corpseMarker: { archive: 400, record: 1, pos: [0, 0, 0] }, entity: { items: [{ name: 'Longsword', group: 'Weapons', templateIndex: 121 }] } });
    openCorpseLoot(body(), { playerEntity: player, openWindow: () => false });
    openCorpseLoot(body(), { playerEntity: player, openWindow: () => undefined });
    assert.deepEqual(asked, [], 'refused, or no word of an open: no roll');
    openCorpseLoot(body(), { playerEntity: player, openWindow: () => true });
    assert.deepEqual(asked, ['corpse'], 'opened: rolled');
  } finally { Math.random = rnd; _resetSilverFindsForTests(); }
  assert.equal(arrowsOnly([{ templateIndex: ARROW_TEMPLATE_INDEX, stackCount: 3 }]), true);
  assert.equal(arrowsOnly([{ templateIndex: ARROW_TEMPLATE_INDEX }, { templateIndex: 121 }]), false);
  assert.equal(arrowsOnly([]), false);
  const ef = src('src/scenes/exteriorFoes.js');
  assert.match(ef, /const arrows = arrowsOnly\(grant\);/);
  assert.match(ef, /if \(n > 0 && !arrows\) silverFindAt\('corpse', f\);/);
  assert.match(src('src/scenes/corpseMarker.js'), /if \(arrowsOnly\(items\)\) \{/);
  // the hosts' doors answer whether they opened: the quick take, or the window that mounted
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = src(f);
    assert.match(s, /took: showPickups \}\)\) return true;   \/\/ AUDIT QL-WEIGHT1/, `${f}: the quick take is an open`);
    assert.match(s, /if \(w\) townTalk\.showOverlay\(w\);   \/\/ DISC10-E L3: a refused pack is null\n\s+return !!w;   \/\/ AUDIT 625 D6/, `${f}: the window's own answer`);
  }
  const wm = src('src/scenes/worldModes.js');
  assert.match(wm, /took: showPickups \}\)\) return true;   \/\/ AUDIT QL-WEIGHT1: the window's own resolver; PICKUP-F/);
  assert.match(wm, /const w = interiorInventory\(\{ loot: pile \? \{ \.\.\.loot, pile \} : loot \}\);\n\s+mountInterior\(w\);\n\s+return !!w;   \/\/ AUDIT 625 D6/, 'a refused pack (null) answers no open');
});

test('AUDIT 625 S5 + D6: the dungeon rolls a body\'s or a pile\'s find by the ROOM\'S OWN NAME for it - the dungeon and its container (a body by its death too: a foe the hour raised and slew again is a body anew) - so leaving and coming back rolls nothing again, and the hour\'s restock is the same pile; and only once its door opened it (mutants: the object again; the death unread; the roll before the window\'s answer)', () => {
  const dc = src('src/scenes/dungeonContext.js');
  assert.match(dc, /function silverFindKey\(key, kind, i\) \{/);
  assert.match(dc, /return kind === 'corpse' \? `\$\{place\}:\$\{canon\}@\$\{foes\[i\]\?\._diedAt \?\? ''\}` : `\$\{place\}:\$\{canon\}`;/);
  assert.match(dc, /const place = !dfLocation\?\.spawned && Number\.isSafeInteger\(mapId\) \? `dun:\$\{mapId\}` : null;/);
  // the quick door's take, then the window's mount - each rolls after its own answer, never before
  const quick = dc.indexOf("if (!pileKeys && quickLootTake(key, { items: () => source }");
  const roll1 = dc.indexOf('if (_find) silverFindAt(_find.kind, _find.key);', quick);
  const mount = dc.indexOf('const _w = openInventory(source, onEmptied, { lootHooks, lootKey: _k });');
  const roll2 = dc.indexOf('if (_w && _find) silverFindAt(_find.kind, _find.key);', mount);
  assert.ok(quick > 0 && roll1 > quick && roll1 < mount, 'the quick take, then its roll');
  assert.ok(roll2 > mount, 'the window, then its roll');
  assert.equal(dc.includes("silverFindAt('corpse', foes[i])"), false, 'no find rolled by the object');
});

test('AUDIT 625 S2: an interior\'s TREASURE pile - a tavern\'s, a guild hall\'s, the scene\'s own container (`container: true`) - rolls its find at its door as the dungeon\'s pile does, by its own key, once it opened; a pile the player dropped never (mutants: the door unasked; a dropped pile asked; the roll before the open)', () => {
  const wm = src('src/scenes/worldModes.js');
  assert.match(wm, /const _find = pile\.container === true && pile\.items\.length\n\s+\? \(pile\.containerKey \? `int:\$\{homeTownOf\(interiorBuilding\)\}:\$\{interiorBuilding\?\.buildingKey \?\? ''\}:\$\{pile\.containerKey\}` : pile\) : null;/, 'by its town, its building and its marker - `treasure:<i>` alone is every tavern\'s');
  // the streaming host's own scene containers - World of Daggerfall's, Deep Waters' - unsaved, their objects their names
  const w = src('src/scenes/world.js');
  assert.match(w, /const _find = pile\?\.container === true && pile\.items\.length \? pile : null;/);
  assert.match(w, /if \(w\) townTalk\.showOverlay\(w\);   \/\/ DISC10-E L3: a refused pack is null\n\s+if \(w && _find\) silverFindAt\('pile', _find\);\n\s+\} else \{\n\s+if \(_find\) silverFindAt\('pile', _find\);\n\s+droppedLoot\.releaseEmptied\(\);/);
  assert.match(wm, /if \(!quickLootTake\(key, _hooks, playerEntity, \(l\) => say\(l\), \{ getQuest: \(uid\) => questBridge\?\.machine\.getQuest\(uid\) \?\? null, took: showPickups \}\)\) \{[^\n]*\n\s+const w = interiorInventory\(\{ loot: _hooks \}\);\n\s+mountInterior\(w\);\n\s+if \(w && _find\) silverFindAt\('pile', _find\);/);
  assert.match(wm, /\} else \{\n\s+if \(_find\) silverFindAt\('pile', _find\);/);
});
