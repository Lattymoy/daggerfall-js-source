// SILVER-FINDS (2026-10-05, Mac: "Silver should be more accessible in more forms of interactions like foraging and
// different activities, also needs to be sometimes lootable"): THE SERVICE'S HALF - a counted harvest finds silver now
// and then (the service's own dice, inside the harvest's batch, by its row alone), and a loot find the device rolled is
// struck by the service's dice under its own day (`/v1/marks/find`). Both bounded, not witnessed: the day is what a lying
// client is paid. Driven through the real Worker over node:sqlite with every migration applied (test/accountDb.mjs).
// bible/06-Systems/Professions-Arc.md 10.5 (SILVER-FINDS).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService, T0 } from './accountDb.mjs';
import { herbPatches, nodeKey } from '../src/net/nodeLaw.js';
import { HARVESTS_PER_DAY } from '../src/net/professionLaw.js';
import { sharedClassicMinutes } from '../src/net/wire.js';
import {
  MARKS_FAUCETS, MARKS_KINDS, MARKS_MAX, MARKS_COMBAT, MARKS_OPS_MAX, utcDay, gatherFindOf, FIND_KINDS, findChanceOf, lootFindOf,
} from '../src/net/marksLaw.js';
import { ROUTES } from '../server-account/src/service.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DAY = 86_400;
const WOODS = 231, ANTICLERE = 21;
const hourAt = (s) => Math.floor((((Math.floor(sharedClassicMinutes(s * 1000)) % 1440) + 1440) % 1440) / 60);
/** Noon on the shared clock in T0's UTC day - a harvest's hour, with the day's room either side. */
const NOON = (() => {
  for (let s = utcDay(T0) * DAY + 3600; s < utcDay(T0) * DAY + 3 * 7200; s += 30) if (hourAt(s) === 12 && hourAt(s - 60) === 12 && hourAt(s + 60) === 12) return s;
  throw new Error('no noon');
})();
const realNow = Date.now;
Date.now = () => NOON * 1000;
test.after(() => { Date.now = realNow; });
const TODAY = utcDay(NOON);

/** THE SERVICE'S DICE STEERED: the i-th four-byte draw (a unit's - unitRoll.js dice) is `seq[i]`'s byte, every draw past
 *  the list `rest`'s; the ids and the session secrets keep the real CSPRNG. Answers `fn`'s answer and the draws taken. */
const realRandom = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
async function steered(seq, rest, fn) {
  let n = 0;
  globalThis.crypto.getRandomValues = (arr) => {
    if (arr.byteLength !== 4) return realRandom(arr);
    new Uint8Array(arr.buffer, arr.byteOffset, 4).fill(n < seq.length ? seq[n] : rest);
    n++;
    return arr;
  };
  try { return { r: await fn(), draws: n }; } finally { globalThis.crypto.getRandomValues = realRandom; }
}
/** A byte that steers a unit to about `u` (0 to 0.996). */
const unit = (u) => Math.floor(u * 256);

let _rid = 0;
const rid = (tag = 'find') => `${tag}-${String(++_rid).padStart(6, '0')}`;
/** The common herb patches of T0's day, west to east (a harvest's node each, one apiece). */
const PATCHES = (() => {
  const out = [];
  for (let x = 300; x < 900 && out.length < 40; x++) for (const p of herbPatches({ x, y: 200, day: TODAY, climate: WOODS, confirmed: false })) if (p.tier === 1) out.push({ x, y: 200, ...p });
  return out;
})();

async function stand(extra = {}) {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', ...extra });
  const raw = s.env.DB._raw;
  let patch = 0;
  /** A harvest of the next common herb patch - `rid` its request id (a fresh one by default). */
  const harvest = (who, { id = rid('harv'), p = PATCHES[patch++] } = {}) => s.call('/v1/prof/harvest', {
    character: who.character, node: nodeKey({ kind: 'herb', x: p.x, y: p.y, day: TODAY, slot: p.slot }), kind: 'herbs',
    climate: WOODS, region: ANTICLERE, act: { clean: false, bruised: false }, at: NOON - 2, rid: id,
  }, who.secret);
  const find = (who, kind = 'corpse', id = rid()) => s.call('/v1/marks/find', { kind, rid: id }, who.secret);
  const lines = (kind) => raw.prepare('SELECT amount, rid, day, dst_id FROM marks_ledger WHERE kind = ? ORDER BY seq').all(kind).map((l) => ({ ...l, amount: Number(l.amount) }));
  const balance = (who) => Number(raw.prepare('SELECT balance FROM marks WHERE account = ?').get(who.id)?.balance ?? 0);
  /** A faucet's line struck by hand today (the ledger's triggers move the balance as a strike's would). */
  const seed = (who, kind, amount, tag = rid('seed')) => raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES ('mint', NULL, 'account', ?, ?, ?, ?, ?, ?, NULL, ?)`).run(who.id, kind, amount, TODAY, NOON, who.id, `${kind}:${tag}`);
  return { ...s, raw, harvest, find, lines, balance, seed };
}

// ─── THE LAW ─────────────────────────────────────────────────────────

test('SILVER-FINDS the law: a harvest finds 2-5 one time in ten, 30 a day; a loot find 1-4, 20 a day, a body one in twenty, a treasure pile 12 in a hundred, a search\'s find 15; both mints, apart from the combat cap (mutants: each bound; the chance\'s edge; the range\'s ends; a kind unknown)', () => {
  assert.deepEqual(MARKS_FAUCETS.gather, { chance: 0.1, amount: [2, 5], perDay: 30 });
  assert.deepEqual(MARKS_FAUCETS.find, { chance: { corpse: 0.05, pile: 0.12, search: 0.15 }, amount: [1, 4], perDay: 20 });
  assert.deepEqual([MARKS_KINDS.gather, MARKS_KINDS.find], ['mint', 'mint']);
  assert.deepEqual(MARKS_COMBAT.kinds, ['gate', 'raid', 'serpent'], 'a find is no combat strike');
  // the harvest's: the chance roll's edge, then the amount's whole range off its roll
  assert.deepEqual([gatherFindOf(0.0999, 0), gatherFindOf(0.1, 0), gatherFindOf(0.5, 0)], [2, 0, 0]);
  assert.deepEqual([0, 0.2499, 0.25, 0.5, 0.75, 0.9999].map((u) => gatherFindOf(0, u)), [2, 2, 3, 4, 5, 5]);
  // the loot's: the kinds, their chances, the amount's range
  assert.deepEqual(FIND_KINDS, ['corpse', 'pile', 'search']);
  assert.deepEqual([...FIND_KINDS, 'gather', 'droppedLoot', undefined].map(findChanceOf), [0.05, 0.12, 0.15, 0, 0, 0]);
  assert.deepEqual([0, 0.2499, 0.25, 0.5, 0.75, 0.9999].map(lootFindOf), [1, 1, 2, 3, 4, 4]);
});

// ─── A HARVEST'S FIND ────────────────────────────────────────────────

test('SILVER-FINDS a harvest\'s find: the service\'s dice - its last two draws, after every other - find silver in a counted harvest; struck in its batch under `gather:<rid>`, said as the answer\'s `marks`; none found, no `marks` (mutants: the dice\'s amount unread; the find said as none; the line\'s id)', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  // the draws a harvest takes, counted: every unit 0 - the chance's roll under a tenth, the amount's its least
  const low = await steered([], 0, () => s.harvest(mac));
  assert.equal(low.r.status, 200, JSON.stringify(low.r.body));
  assert.deepEqual(low.r.body.marks, { struck: 2, balance: 2, today: { found: 2, max: 30 } });
  const id = rid('harv');
  // the same path again: every draw 0 but the last, the amount's - its most
  const top = await steered([...Array(low.draws - 1).fill(0), 255], 0, () => s.harvest(mac, { id }));
  assert.equal(top.draws, low.draws, 'the same path takes the same draws');
  assert.deepEqual(top.r.body.marks, { struck: 5, balance: 7, today: { found: 7, max: 30 } }, 'the amount is the service\'s dice');
  assert.deepEqual(s.lines('gather').slice(1).map((l) => [l.amount, l.rid, l.day]), [[5, `gather:${id}`, TODAY]]);
  // the chance's roll the second to last: over a tenth, no find - the harvest counted, its answer without `marks`
  const none = await steered([...Array(low.draws - 2).fill(0), unit(0.11), 0], 0, () => s.harvest(mac));
  assert.equal(none.r.body.qty, 1, 'the harvest counted');
  assert.equal('marks' in none.r.body, false, 'no find, no word of one');
  assert.equal(s.lines('gather').length, 2);
  assert.equal(s.balance(mac), 7);
});

test('SILVER-FINDS a harvest asked twice: the same request answers its find again - one line, one balance, and so after the switch shut (AUDIT 28 M2); a harvest the day refused finds nothing (the find is struck by the harvest\'s own row alone) (mutants: the repeat unsaid; the switch before the line; the row\'s guard)', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const id = rid('harv');
  const p = PATCHES[0];
  const first = await steered([], 0, () => s.harvest(mac, { id, p }));
  const again = await steered([], 0, () => s.harvest(mac, { id, p }));
  assert.equal(again.r.body.repeat, true);
  assert.deepEqual(again.r.body.marks, first.r.body.marks, 'the find answered again');
  assert.deepEqual([s.lines('gather').length, s.balance(mac)], [1, 2]);
  // AUDIT 28 M2's law: the switch shut since - the harvest asked again is told the find it made, never "none"
  s.env.MARKS_OPEN = 'off';
  const shut = await steered([], 0, () => s.harvest(mac, { id, p }));
  assert.deepEqual([shut.r.body.repeat, shut.r.body.marks], [true, first.r.body.marks], 'a find made, answered whatever the switch says now');
  s.env.MARKS_OPEN = 'on';
  // the character's day of harvests spent: the next is refused before its row - and its find with it
  const stmt = s.raw.prepare(`INSERT INTO node_harvests (day, node, kind, player, char_id, profession, material, qty, xp, at, rid, n)
    VALUES (?, ?, 'herbs', ?, ?, 'herbalism', 'p1:18', 1, 1, ?, ?, ?)`);
  for (let i = 1; i < HARVESTS_PER_DAY; i++) stmt.run(TODAY, `herb:filler:${i}`, mac.id, mac.character, NOON, `fill-${i}`, `n${i}`);
  const refused = await steered([], 0, () => s.harvest(mac, { p: PATCHES[1] }));
  assert.equal(refused.r.body.error, 'prof-cap');
  assert.deepEqual([s.lines('gather').length, s.balance(mac)], [1, 2], 'no row, no find');
});

test('SILVER-FINDS a harvest\'s day: 30 an account a UTC day, the day\'s last find what is left of it - then none, and the answer says none; a loot find\'s day and the combat cap apart (mutants: the cap unread; the last find whole; the days shared)', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.seed(mac, 'gather', 29);
  s.seed(mac, 'find', 20);
  s.seed(mac, 'gate', 150);
  const last = await steered([], 0, () => s.harvest(mac));
  assert.deepEqual(last.r.body.marks, { struck: 1, balance: 200, today: { found: 30, max: 30 } }, 'the day\'s last: 1 of the 2 found');
  const met = await steered([], 0, () => s.harvest(mac));
  assert.equal(met.r.body.qty, 1, 'counted');
  assert.equal('marks' in met.r.body, false, 'the day met: no find said');
  assert.equal(s.lines('gather').length, 2);
  // the next UTC day is a new day
  const tomorrow = NOON + DAY;
  Date.now = () => tomorrow * 1000;
  try {
    const ann = await s.registered('Ann');
    s.raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid) VALUES ('mint', NULL, 'account', ?, 'gather', 29, ?, ?, ?, NULL, 'gather:yesterday')`).run(ann.id, TODAY, NOON, ann.id);
    const b = await s.call('/v1/marks/balance', {}, ann.secret);
    assert.equal(b.body.today.gathered, 0, 'yesterday\'s gathering is not today\'s');
  } finally { Date.now = () => NOON * 1000; }
});

test('SILVER-FINDS a harvest where silver is not this account\'s: the switch shut, the harvest counted and no find struck - the dice found one all the same (mutants: the switch unread)', async () => {
  const s = await stand({ MARKS_OPEN: 'off' });
  const mac = await s.registered('Mac');
  const r = await steered([], 0, () => s.harvest(mac));
  assert.equal(r.r.body.qty, 1);
  assert.equal('marks' in r.r.body, false);
  assert.equal(s.lines('gather').length, 0);
});

// ─── A LOOT FIND ─────────────────────────────────────────────────────

test('SILVER-FINDS the loot find: `/v1/marks/find` strikes what the service\'s dice say (1 to 4) to the account under `find`, the request\'s own id; answers the strike, the balance and the day; asked twice, the line it made (mutants: the amount\'s roll; the repeat a second line)', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const one = await steered([], 0, () => s.find(mac, 'corpse', 'find-low-001'));
  assert.equal(one.r.status, 200, JSON.stringify(one.r.body));
  assert.deepEqual(one.r.body, { ok: true, struck: 1, balance: 1, today: { found: 1, max: 20 } });
  const top = await steered([], 255, () => s.find(mac, 'pile'));
  assert.deepEqual([top.r.body.struck, top.r.body.balance], [4, 5]);
  const mid = await steered([], unit(0.5), () => s.find(mac, 'search'));
  assert.deepEqual([mid.r.body.struck, mid.r.body.today], [3, { found: 8, max: 20 }]);
  const again = await steered([], 255, () => s.find(mac, 'corpse', 'find-low-001'));
  assert.deepEqual(again.r.body, { ok: true, repeat: true, struck: 1, balance: 8, today: { found: 8, max: 20 } }, 'the line it made, never a second');
  assert.deepEqual(s.lines('find').map((l) => [l.amount, l.day, l.dst_id]), [[1, TODAY, mac.id], [4, TODAY, mac.id], [3, TODAY, mac.id]]);
  assert.equal(s.lines('find')[0].rid, 'find-low-001', 'the request\'s own id - a client\'s, so a lost answer asked again is the line it made');
  assert.equal(s.balance(mac), 8);
});

test('SILVER-FINDS the loot find\'s day: 20 an account a UTC day, the day\'s last find what is left - then struck 0 with `cap`; a purse at its most struck 0 with `full`; the gathering\'s and the combat\'s days apart (mutants: the cap; the last find whole; the why)', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.seed(mac, 'find', 18);
  s.seed(mac, 'gather', 30);
  s.seed(mac, 'raid', 150);
  const last = await steered([], 255, () => s.find(mac));
  assert.deepEqual(last.r.body, { ok: true, struck: 2, balance: 200, today: { found: 20, max: 20 } }, 'the 4 found, cut to the 2 left');
  const met = await steered([], 255, () => s.find(mac));
  assert.deepEqual(met.r.body, { ok: true, struck: 0, balance: 200, today: { found: 20, max: 20 }, why: 'cap' });
  const ann = await s.registered('Ann');
  s.seed(ann, 'test', MARKS_MAX);
  const full = await steered([], 0, () => s.find(ann));
  assert.deepEqual(full.r.body, { ok: true, struck: 0, balance: MARKS_MAX, today: { found: 0, max: 20 }, why: 'full' });
  assert.equal(s.lines('find').length, 2);
});

test('SILVER-FINDS the loot find\'s doors: a guest holds none; a request id the service cannot read, or one another act took, is refused; a kind of none is `bad-find`; the switch shut is `marks-closed` - but a find already made is answered before it (AUDIT 28 M2) (mutants: the guest struck; the rid unread; the kind unread; the switch before the line)', async () => {
  const s = await stand();
  const g = await s.guest();
  assert.deepEqual([(await s.find(g)).status, (await s.find(g)).body], [403, { error: 'marks-need-account' }]);
  const mac = await s.registered('Mac');
  assert.deepEqual((await s.find(mac, 'corpse', 'short')).body, { error: 'marks-rid' });
  assert.deepEqual((await s.find(mac, 'corpse', null)).body, { error: 'marks-rid' });
  s.raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid) VALUES ('mint', NULL, 'account', ?, 'test', 5, ?, ?, ?, NULL, 'taken-by-another')`).run(mac.id, TODAY, NOON, mac.id);
  assert.deepEqual((await s.find(mac, 'corpse', 'taken-by-another')).body, { error: 'marks-rid' }, 'an id another act took');
  const bad = await s.find(mac, 'droppedLoot');
  assert.deepEqual([bad.status, bad.body], [400, { error: 'bad-find' }]);
  assert.deepEqual((await s.find(mac, 'gather')).body, { error: 'bad-find' }, 'a harvest\'s find is the harvest\'s own');
  const made = await steered([], 0, () => s.find(mac, 'corpse', 'made-before-shut'));
  assert.equal(made.r.body.struck, 1);
  s.env.MARKS_OPEN = 'off';
  assert.deepEqual((await s.find(mac)).body, { error: 'marks-closed' });
  const kept = await s.find(mac, 'corpse', 'made-before-shut');
  assert.deepEqual([kept.body.repeat, kept.body.struck], [true, 1], 'the line it made, answered whatever the switch says now');
  assert.equal(s.lines('find').length, 1);
});

test('SILVER-FINDS the loot find\'s hour: each find is one of the Marks acts an hour (MARKS_OPS_MAX, shared with the Bank and the guild moves) - past them `marks-rate`, and nothing struck (mutants: the rate unasked)', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  for (let i = 0; i < MARKS_OPS_MAX; i++) assert.equal((await s.find(mac)).status, 200, `find ${i}`);
  const over = await s.find(mac);
  assert.deepEqual([over.status, over.body], [429, { error: 'marks-rate' }]);
});

test('SILVER-FINDS the card: an account\'s balance says the day\'s finds - gathered against 30, found against 20 (mutants: the counts swapped; a max unsaid)', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.seed(mac, 'gather', 7);
  s.seed(mac, 'find', 3);
  s.seed(mac, 'find', 2);
  const b = await s.call('/v1/marks/balance', {}, mac.secret);
  assert.deepEqual(b.body.today, { gate: 0, combat: 0, combatMax: 150, exchanged: 0, exchangeMax: 300, gathered: 7, gatherMax: 30, found: 5, findMax: 20 });
});

test('SILVER-FINDS the deploy: the route is served and listed; the service answers it through the Marks door; the law says why both are bounded, not witnessed (mutants: the route unlisted)', () => {
  assert.ok(ROUTES.has('/v1/marks/find'));
  assert.match(src('server-account/src/index.js'), /'\/v1\/marks\/find': \(\) => findMarks\(ctx, who\.player, env, body\),/);
  assert.match(src('src/net/marksLaw.js'), /TWO FAUCETS ARE BOUNDED, NOT\n\/\/ WITNESSED/);
  assert.match(src('server-account/src/professions.js'), /\.\.\.\(find \? \[find\] : \[\]\),   \/\/ SILVER-FINDS: the find, last/);
});
