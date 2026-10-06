// SILVER-FINDS (2026-10-05, Mac: "Silver should be more accessible in more forms of interactions like foraging and
// different activities, also needs to be sometimes lootable"): THE CLIENT'S HALF - the device rolls each container it
// opens once (systems/silverFinds.js), every host's loot door asks there, a find is asked of the account service
// through the marks book (each its own request id; one never answered is owed and asked again with it), and an answered
// find is a card or a line. bible/06-Systems/Professions-Arc.md 10.5 (SILVER-FINDS).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { setSilverFinder, silverFinderSet, silverFindAt, SILVER_FINDS_KEPT, _resetSilverFindsForTests } from '../src/systems/silverFinds.js';
import { findChanceOf, MARKS_FAUCETS, MARKS_RID_RE } from '../src/net/marksLaw.js';
import { accountMarks, REFUSALS, SESSION_KEY } from '../src/net/accountClient.js';
import { createMarksBook, MARKS_TEXT, MARKS_TRIES, FIND_WORDS, FINDS_OWED_MAX } from '../src/net/marksBook.js';
import { findHaul, harvestHauls, haulWords, FIND_SOURCE, FIND_BAR_TEXT, COMBAT_BAR_TEXT, claimHauls } from '../src/ui/haulCards.js';
import { openCorpseLoot, ARROW_TEMPLATE_INDEX } from '../src/scenes/corpseMarker.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DAY_MS = 86_400_000;
const T = 1_800_000_000_000;

// ─── THE ROLL ────────────────────────────────────────────────────────

test('SILVER-FINDS the roll: no finder, no find (offline, the bench); a container rolled ONCE a session - found or not - its kind\'s chance strictly under; a kind or a container of none rolls nothing and is not remembered (mutants: the finder unasked; the once; the edge; the kind unchecked)', () => {
  _resetSilverFindsForTests();
  const asked = [];
  const body = {};
  assert.equal(silverFindAt('corpse', body, () => 0), false, 'no finder: nothing');
  assert.equal(silverFinderSet(), false);
  setSilverFinder((kind) => asked.push(kind));
  assert.equal(silverFinderSet(), true);
  assert.equal(silverFindAt('corpse', body, () => 0), true, 'the body was never rolled while no finder stood');
  assert.equal(silverFindAt('corpse', body, () => 0), false, 'once a container');
  assert.deepEqual(asked, ['corpse']);
  // the edge: the chance itself is no find - and a miss is remembered as a find is
  const pile = [], chest = [];
  assert.equal(silverFindAt('pile', pile, () => findChanceOf('pile')), false);
  assert.equal(silverFindAt('pile', pile, () => 0), false, 'a miss is a roll made');
  assert.equal(silverFindAt('search', chest, () => findChanceOf('search') - 1e-9), true);
  assert.deepEqual(asked, ['corpse', 'search']);
  // no kind, no container: nothing rolled, nothing remembered
  const later = {};
  assert.equal(silverFindAt('gather', later, () => 0), false, 'a harvest\'s find is the service\'s own');
  assert.equal(silverFindAt('droppedLoot', later, () => 0), false);
  assert.equal(silverFindAt('corpse', later, () => 0), true, 'the kind refused it unremembered');
  for (const c of [null, undefined, 7, '']) assert.equal(silverFindAt('corpse', c, () => 0), false);
  setSilverFinder('not a function');
  assert.equal(silverFinderSet(), false, 'a finder that is no function is none');
  _resetSilverFindsForTests();
});

test('SILVER-FINDS the roll\'s memory: a key string is remembered beside an object; the oldest key let go past SILVER_FINDS_KEPT (it rolls again, as a lie would - the service\'s day bounds both); a finder that throws costs the roll, never the door (mutants: the bound; the keys forgotten; the throw)', () => {
  _resetSilverFindsForTests();
  let n = 0;
  setSilverFinder(() => { n++; });
  assert.equal(silverFindAt('pile', 'd17|loot:3', () => 0), true);
  assert.equal(silverFindAt('pile', 'd17|loot:3', () => 0), false, 'a key, once');
  for (let i = 0; i < SILVER_FINDS_KEPT - 1; i++) silverFindAt('pile', `k${i}`, () => 0.99);
  assert.equal(silverFindAt('pile', 'd17|loot:3', () => 0), false, 'still held at the bound');
  silverFindAt('pile', 'one-more', () => 0.99);
  assert.equal(silverFindAt('pile', 'd17|loot:3', () => 0), true, 'the oldest let go past it');
  assert.equal(SILVER_FINDS_KEPT, 4096);
  const warn = console.warn;
  const warned = [];
  console.warn = (...a) => warned.push(a.join(' '));
  try {
    setSilverFinder(() => { throw new Error('a host fault'); });
    assert.equal(silverFindAt('corpse', {}, () => 0), true, 'the find was rolled');
    assert.match(warned[0], /\[silver\] a find a host fault/);
  } finally { console.warn = warn; _resetSilverFindsForTests(); }
});

// ─── THE DOOR AND THE BOOK ───────────────────────────────────────────

test('SILVER-FINDS the door: a find posts its kind and its request id to /v1/marks/find behind the session; `bad-find` has its sentence (mutants: the route; the body)', async () => {
  const sent = [];
  const fetch = async (url, init) => { sent.push([new URL(url).pathname, JSON.parse(init.body), init.headers.authorization]); return new Response(JSON.stringify({ ok: true }), { status: 200 }); };
  const door = accountMarks({ fetch, storage: { getItem: (k) => (k === SESSION_KEY ? JSON.stringify({ secret: 'sek' }) : null) } });
  await door.find('corpse', 'r-00000001');
  assert.deepEqual(sent, [['/v1/marks/find', { kind: 'corpse', rid: 'r-00000001' }, 'Bearer sek']]);
  assert.equal(REFUSALS['bad-find'], 'That find could not be read.');
});

/** A marks book over a scripted door: `answers` per ask (a function of the ask, or a value), the account and the clock
 *  the test's. */
function bookOver(answers, { account = 'acct-1', at = T } = {}) {
  const asks = [];
  const who = { account, at };
  let k = 0;
  const door = {
    account: () => who.account,
    find: async (kind, rid) => { asks.push([kind, rid, who.account]); const a = answers[Math.min(k++, answers.length - 1)]; return typeof a === 'function' ? a(kind, rid) : a; },
  };
  const book = createMarksBook({ door, sleep: async () => {}, nowMs: () => who.at });
  return { book, asks, who };
}
const found = (struck, balance, n, extra = {}) => ({ ok: true, data: { ok: true, struck, balance, today: { found: n, max: 20 }, ...extra } });

test('SILVER-FINDS the book\'s find: one ask, its own request id; the find said in its kind\'s words with the balance, the balance and the day\'s count kept; none struck, no line (mutants: the words; the balance unkept; the count unkept; a line for none)', async () => {
  const { book, asks } = bookOver([found(3, 10, 3)]);
  const out = await book.find('corpse');
  assert.equal(asks.length, 1);
  assert.match(asks[0][1], MARKS_RID_RE, 'an id the service reads');
  assert.deepEqual(out, [{ kind: 'corpse', found: { ok: true, struck: 3, balance: 10, today: { found: 3, max: 20 } }, line: 'You find 3 silver on the body. You hold 10 silver.' }]);
  assert.deepEqual([book.state.balance, book.state.open, book.state.today], [10, true, { found: 3, findMax: 20 }]);
  assert.deepEqual(FIND_WORDS, { corpse: 'on the body', pile: 'among the treasure', search: 'tucked in with the find', gather: 'while gathering' });
  assert.equal(MARKS_TEXT.found(2, 5, 'pile'), 'You find 2 silver among the treasure. You hold 5 silver.');
  assert.equal(MARKS_TEXT.found(1, null, 'search'), 'You find 1 silver tucked in with the find.', 'no balance said, none made up');
  const none = bookOver([found(0, 10, 3, { why: 'full' })]);
  assert.deepEqual((await none.book.find('pile')).map((f) => f.line), [null]);
  const gather = bookOver([found(1, 1, 1)]);
  assert.deepEqual([await gather.book.find('gather'), gather.asks.length], [[], 0], 'a kind of none is never asked - a harvest\'s find is its harvest\'s');
  const out2 = bookOver([found(1, 1, 1)], { account: null });
  assert.deepEqual([await out2.book.find('corpse'), out2.asks.length], [[], 0], 'no session: nothing asked');
});

test('SILVER-FINDS the book\'s day: the service says the day\'s finds met - none asked again until the UTC day (the book\'s clock) turns; another account signed in asks its own (mutants: the met day unkept; the clock\'s day; one account\'s day every account\'s)', async () => {
  const b = bookOver([found(2, 22, 20), found(1, 1, 1), found(4, 26, 4)]);
  assert.equal((await b.book.find('corpse'))[0].line, 'You find 2 silver on the body. You hold 22 silver.', 'the day\'s last');
  assert.deepEqual(await b.book.find('corpse'), [], 'met: never asked');
  assert.equal(b.asks.length, 1);
  b.who.account = 'acct-2';
  assert.equal((await b.book.find('search')).length, 1, 'another account: its own day');
  b.who.account = 'acct-1';
  assert.deepEqual(await b.book.find('corpse'), [], 'the first account\'s day still met');
  b.who.at = T + DAY_MS;
  assert.equal((await b.book.find('pile')).length, 1, 'a new day: asked');
  assert.equal(b.asks.length, 3);
});

test('SILVER-FINDS the book\'s owed finds: an ask the network never answered is asked MARKS_TRIES times with its one id, then owed - asked again, the same id, before the next find of the same account; while the network stays down the rest are owed unasked (one find\'s tries, never twenty\'s); another account\'s owed wait for it; FINDS_OWED_MAX at most (mutants: a new id; the owed dropped; the owed asked while down; the owed asked under another account; the bound)', async () => {
  const net = { down: true, n: 0 };
  const b = bookOver([() => (net.down ? { ok: false, error: 'offline' } : found(1, ++net.n, net.n))]);
  assert.deepEqual(await b.book.find('corpse'), [], 'never answered');
  assert.equal(b.asks.length, MARKS_TRIES);
  assert.equal(new Set(b.asks.map((a) => a[1])).size, 1, 'one id, asked again');
  const first = b.asks[0][1];
  assert.deepEqual(await b.book.find('search'), [], 'still down');
  assert.equal(b.asks.length, 2 * MARKS_TRIES, 'the owed asked its tries, this one owed unasked');
  assert.equal(b.asks[MARKS_TRIES][1], first, 'the owed first, with its own id');
  net.down = false;
  const back = await b.book.find('pile');
  assert.deepEqual(back.map((f) => f.kind), ['corpse', 'search', 'pile'], 'the owed in their order, then this one');
  assert.deepEqual([b.asks[6][1], b.asks.length], [first, 9]);
  assert.equal(new Set(b.asks.map((a) => a[1])).size, 3, 'three finds, three ids');
  assert.deepEqual(await b.book.find('corpse').then((o) => o.length), 1, 'none owed now');
  // another account's owed finds wait for it
  const c = bookOver([() => (net.down ? { ok: false, error: 'offline' } : found(1, 1, 1))]);
  net.down = true;
  await c.book.find('search');
  net.down = false;
  c.who.account = 'acct-2';
  assert.deepEqual((await c.book.find('corpse')).map((f) => f.kind), ['corpse'], 'acct-2 asks its own alone');
  c.who.account = 'acct-1';
  assert.deepEqual((await c.book.find('pile')).map((f) => f.kind), ['search', 'pile'], 'acct-1\'s owed, asked under acct-1');
  assert.deepEqual(c.asks.slice(MARKS_TRIES).map((a) => a[2]), ['acct-2', 'acct-1', 'acct-1']);
  // the bound
  const d = bookOver([() => (net.down ? { ok: false, error: 'offline' } : found(1, 1, 1))]);
  net.down = true;
  for (let i = 0; i < FINDS_OWED_MAX + 3; i++) await d.book.find('corpse');
  assert.equal(d.asks.length, (FINDS_OWED_MAX + 3) * MARKS_TRIES, 'every find while down: one ask\'s tries');
  net.down = false;
  assert.equal((await d.book.find('pile')).length, FINDS_OWED_MAX + 1, 'the owed bounded, and this one');
  assert.equal(FINDS_OWED_MAX, 20);
});

test('SILVER-FINDS the book\'s refusals: silver not this account\'s (a guest, the switch shut) - the book reads it closed and asks no more; a refusal of this find (its hour) lets it go, never owed (mutants: the closed unread; a refusal owed)', async () => {
  for (const error of ['marks-need-account', 'marks-closed']) {
    const b = bookOver([{ ok: false, error }]);
    assert.deepEqual(await b.book.find('corpse'), []);
    assert.deepEqual([b.book.state.open, b.book.state.balance], [false, null]);
    assert.deepEqual(await b.book.find('corpse'), [], 'closed: never asked again');
    assert.equal(b.asks.length, 1, error);
  }
  const r = bookOver([{ ok: false, error: 'marks-rate' }, found(1, 1, 1)]);
  await r.book.find('corpse');
  assert.deepEqual((await r.book.find('pile')).map((f) => f.kind), ['pile'], 'the refused find is not owed');
  assert.equal(r.asks.length, 2);
  // PIN MOVED (AUDIT 625 S3): the hour's refusal has an arm of its own now (the rest wait owed for the next hour), so
  // the arm that lets a refused find go is held here by the refusals of the FIND ITSELF - an id the service cannot
  // read, a kind of none - which the hour's no longer reaches
  for (const error of ['marks-rid', 'bad-find']) {
    const x = bookOver([{ ok: false, error }, found(1, 1, 1)]);
    await x.book.find('corpse');
    assert.deepEqual((await x.book.find('pile')).map((f) => f.kind), ['pile'], `${error}: the refused find is not owed`);
    assert.equal(x.asks.length, 2, `${error}: nor asked again`);
  }
});

test('SILVER-FINDS a harvest\'s find, as the book says it: in gathering\'s words, its own day kept apart from the loot\'s; none for none (mutants: the words; the days crossed)', () => {
  const { book } = bookOver([]);
  assert.equal(book.findLine({ struck: 4, balance: 12, today: { found: 9, max: 30 } }, 'gather'), 'You find 4 silver while gathering. You hold 12 silver.');
  assert.deepEqual(book.state.today, { gathered: 9, gatherMax: 30 });
  assert.equal(book.state.balance, 12);
  assert.equal(book.findLine({ struck: 0, balance: 12 }, 'gather'), null);
  assert.equal(book.findLine(null), null);
  assert.equal(book.findLine({ struck: 2, balance: 14, today: { found: 2, max: 30 } }), 'You find 2 silver while gathering. You hold 14 silver.', 'gathering is the default');
});

// ─── THE CARDS ───────────────────────────────────────────────────────

test('SILVER-FINDS the cards: a find\'s silver - where it was found its source, its faucet\'s day its bar (the loot\'s 20, the gathering\'s 30); none for none; a combat strike\'s bar still the combat\'s (mutants: the source; the bar\'s words; the max; a card for none)', () => {
  const corpse = findHaul({ struck: 3, balance: 40, today: { found: 7, max: 20 } }, 'corpse');
  assert.deepEqual(haulWords(corpse), { head: '', plus: '+3', name: 'silver', sub: 'Found on the body', tag: '', end: '40', row: { text: 'Finds today', fill: 0.35, end: '7 / 20' }, lode: null });
  assert.equal(corpse.key, 'silver\u0002Found on the body', 'two finds on bodies, one card');
  const gather = findHaul({ struck: 5, balance: 45, today: { found: 15 } }, 'gather');
  assert.deepEqual(haulWords(gather).row, { text: 'Gathering finds today', fill: 0.5, end: `15 / ${MARKS_FAUCETS.gather.perDay}` }, 'the faucet\'s own day where none is said');
  assert.deepEqual(FIND_SOURCE, { corpse: 'Found on the body', pile: 'Found in the treasure', search: 'Found in the search', gather: 'Found while gathering' });
  assert.deepEqual(FIND_BAR_TEXT, { find: 'Finds today', gather: 'Gathering finds today' });
  assert.deepEqual([findHaul({ struck: 0, why: 'cap' }, 'pile'), findHaul(null, 'pile'), findHaul({ struck: 2 }, 'pile')?.earned], [null, null, undefined]);
  assert.equal(haulWords(claimHauls({ marks: { struck: 30, balance: 90, combat: { earned: 120, max: 150 } } }, 'raid')[0]).row.text, COMBAT_BAR_TEXT);
  assert.equal(COMBAT_BAR_TEXT, 'Combat today');
});

test('SILVER-FINDS a harvest\'s cards: its find a card of its own beside the goods\' - and a Motherlode\'s `marks` never one (its silver is its own card\'s) (mutants: the find unshown; the Motherlode\'s found twice)', () => {
  const d = { material: 'metal:iron', qty: 3, xp: 33, track: { profession: 'mining', xp: 100, rank: 4 }, store: { own: 3 }, marks: { struck: 2, balance: 9, today: { found: 2, max: 30 } } };
  const cards = harvestHauls(d);
  assert.deepEqual(cards.map((c) => [c.haul, c.count]), [['stores', 3], ['silver', 2]]);
  assert.equal(haulWords(cards[1]).sub, 'Found while gathering');
  assert.deepEqual(harvestHauls({ ...d, marks: undefined }).map((c) => c.haul), ['stores'], 'no find, no card');
  const lode = harvestHauls({ ...d, motherlode: true, node: 'mlode:1', marks: { struck: 10, balance: 19 } });
  assert.deepEqual([lode.length, lode[0].silver], [1, 10], 'the Motherlode\'s one card holds its silver');
});

// ─── THE DOORS ───────────────────────────────────────────────────────

test('SILVER-FINDS a body\'s door: a body opened with treasure in it rolls its silver once - the window, or the quick door the host takes through; an empty body, a body of arrows and a body with no door roll none (mutants: the roll unasked; asked before the prelude)', () => {
  _resetSilverFindsForTests();
  const asked = [];
  setSilverFinder((k) => asked.push(k));
  const rnd = Math.random;
  Math.random = () => 0;
  try {
    const player = { items: [], goldPieces: 0 };
    const body = { corpse: true, corpseMarker: { archive: 400, record: 1, pos: [0, 0, 0] }, entity: { items: [{ name: 'Longsword', group: 'Weapons', templateIndex: 121 }] } };
    // PIN MOVED (AUDIT 625 D6): a door that OPENED says so - `true` (test/audit625_silver.test.js: a refused one rolls none)
    openCorpseLoot(body, { playerEntity: player, openWindow: () => true });
    openCorpseLoot(body, { playerEntity: player, openWindow: () => true });
    assert.deepEqual(asked, ['corpse'], 'once a body');
    openCorpseLoot({ ...body, entity: { items: [] } }, { playerEntity: player, openWindow: () => true });
    openCorpseLoot({ ...body, entity: { items: [{ templateIndex: ARROW_TEMPLATE_INDEX, stackCount: 3 }] } }, { playerEntity: player, openWindow: () => true });
    const warn = console.warn;
    console.warn = () => {};
    try { openCorpseLoot({ ...body, entity: { items: [{ templateIndex: 121 }] } }, { playerEntity: player }); } finally { console.warn = warn; }
    assert.deepEqual(asked, ['corpse'], 'none of the three');
  } finally { Math.random = rnd; _resetSilverFindsForTests(); }
});

test('SILVER-FINDS every host\'s loot door asks (THE FOUR HOSTS): the dungeon\'s take - a body, a treasure pile, opened with something in it - and its search\'s find at its search; the street\'s bodies through the corpse door, a peer\'s at its grant; a headstone\'s find; the streaming host registers the finder online alone, a card where the feed stands and else the line (mutants: a door unasked; a dropped pile asked; the finder offline; the line lost to a card)', () => {
  const dc = src('src/scenes/dungeonContext.js');
  // PIN MOVED (AUDIT 625 S5 + D6): a body's and a pile's find named by the room's own name for it, before anything
  // moves, and rolled by the quick door's take and the window's mount each (test/audit625_silver.test.js)
  assert.match(dc, /const _find = source\.length && \(kind === 'corpse' \|\| kind === 'loot'\) \? \{ kind: kind === 'corpse' \? 'corpse' : 'pile', key: silverFindKey\(key, kind, i\) \} : null;/);
  assert.ok(dc.indexOf('const _find = source.length') > dc.indexOf('if (activeOverlay && !activeOverlay.done) return source.length;'), 'a window already standing is no open');
  assert.ok(dc.indexOf('const _find = source.length') < dc.indexOf('if (!pileKeys && quickLootTake(key, { items: () => source }'), 'named before the quick door and the window alike - before the take empties it');
  assert.match(dc, /onClose = \(\) => \{ if \(!_ctxDead && sb\.items\.length\) \{ silverFindAt\('search', find\); api\.takeLoot\(`srch:\$\{i\}`\); \} \};/);
  assert.match(src('src/scenes/corpseMarker.js'), /if \(openWindow\(corpseLootHooks\(entry\)\) === true\) silverFindAt\('corpse', entry\);\n  return items\.length;/);
  assert.match(src('src/scenes/exteriorFoes.js'), /if \(n > 0 && !arrows\) silverFindAt\('corpse', f\);/);
  const w = src('src/scenes/world.js');
  assert.match(w, /if \(!pile\) return;\n\s+silverFindAt\('search', items\);/);
  assert.match(w, /if \(marksBook\) \{\n\s+setSilverFinder\(\(kind\) => \{\n\s+marksBook\.find\(kind\)\.then\(\(finds\) => \{/);
  assert.match(w, /if \(!\(stands && showHaul\(\[findHaul\(f\.found, f\.kind\)\]\)\)\) chatNotice\(f\.line\);/);
  assert.match(w, /const stands = walkMode && !gamePaused\(\) && pointerSurfaces\.size === 0 && !travelView\?\.active;/);
  assert.match(w, /marks: marksBook,   \/\/ SILVER-FINDS: a harvest's find said, its balance kept/);
  assert.match(w, /nowMs: \(\) => Date\.now\(\) \+ _sharedOffsetMs \}\)   \/\/ SILVER-FINDS: the day's finds counted by the shared clock/);
  const g = src('src/scenes/gatherHost.js');
  assert.match(g, /const found = !d\.motherlode && d\.marks \? deps\.marks\?\.findLine\?\.\(d\.marks, 'gather'\) \?\? null : null;\n\s+if \(found && !hauled\) hud\.toast\(found\);/);
});

test('SILVER-FINDS the Bank\'s card: the day\'s finds beside the combat\'s - found in loot against 20, found gathering against 30; the combat row names the serpents (mutants: a count unsaid; the maxes)', () => {
  const p = src('src/ui/enhancedPorts.js');
  assert.match(p, /\['Found in loot today', `\$\{\(w\.hooks\.marks\.today\(\)\?\.found \?\? 0\)\} of \$\{w\.hooks\.marks\.today\(\)\?\.findMax \?\? MARKS_FAUCETS\.find\.perDay\}`\],/);
  assert.match(p, /\['Found gathering today', `\$\{\(w\.hooks\.marks\.today\(\)\?\.gathered \?\? 0\)\} of \$\{w\.hooks\.marks\.today\(\)\?\.gatherMax \?\? MARKS_FAUCETS\.gather\.perDay\}`\],/);
});
