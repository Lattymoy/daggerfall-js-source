// PROF4 (2026-09-28, Mac: "Continue") - LOGGING, CARPENTRY AND THE FURNITURE AS THE SERVICE KEEPS THEM: a tree's harvest
// (the law's tree, its logs, its Resin and a Clean Cut's Heartwood, the Wood-Axe's report bounded, Logging's XP); the
// forge's burns and the workbench's saws (a unit's yield and the choices that raise it, no XP); the workbench's crafts
// (Carpentry's rank, XP and limit, a Joiner's half the planks, a Heartwood for a plank and its step, a Master Joiner's
// mark, arrows at no quality, the Ram Kit refused); the furnisher's Linen; and a crafted table set down in a home with
// the mark the service's own row gives it. Driven through the real Worker over node:sqlite with every migration applied
// (test/accountDb.mjs). bible/06-Systems/Professions-Arc.md 25.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from './accountDb.mjs';
import { trees, tree, nodeKey, TREE_YIELD } from '../src/net/nodeLaw.js';
import { xpForRank, harvestXp, cutsMax, STOCK_MAX } from '../src/net/professionLaw.js';
import { recipeById, FIRST_CRAFT_XP, PROVENANCE_RE, RAM_KIT_RANK } from '../src/net/recipeLaw.js';
import { readProductRecord } from '../src/net/productRecord.js';
import { sharedClassicMinutes } from '../src/net/wire.js';
import { utcDay } from '../src/net/marksLaw.js';

const DAY = 86_400;
const WOODS = 231, RAINFOREST = 227, GLENUMBRA = 59;
const hourAt = (s) => Math.floor((((Math.floor(sharedClassicMinutes(s * 1000)) % 1440) + 1440) % 1440) / 60);
function secondAt(from, want) {
  for (let s = from; s < from + 2 * 7200; s += 30) if (hourAt(s) === want && hourAt(s - 60) === want && hourAt(s + 60) === want) return s;
  throw new Error('no such hour');
}
const NOON = secondAt(utcDay(T0) * DAY + 3600, 12);
let _now = NOON;
const realNow = Date.now;
const clock = (s) => { _now = s; Date.now = () => _now * 1000; };
test.after(() => { Date.now = realNow; });
clock(NOON);
let _rid = 0;
const rid = () => `wood-${String(++_rid).padStart(6, '0')}`;
const today = () => utcDay(_now);
const realRandom = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
/** The service's dice steered: every four-byte draw all `b` while `fn` runs; ids and nonces stay the CSPRNG's. */
async function steered(b, fn) {
  globalThis.crypto.getRandomValues = (arr) => (arr.byteLength === 4 ? (new Uint8Array(arr.buffer, arr.byteOffset, 4).fill(b), arr) : realRandom(arr));
  try { return await fn(); } finally { globalThis.crypto.getRandomValues = realRandom; }
}

async function stand(extra = {}) {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', DEVELOPER_HANDLES: 'Mac', ...extra });
  const raw = s.env.DB._raw;
  const stores = (who, m) => raw.prepare('SELECT origin, qty FROM prof_stores WHERE player = ? AND char_id = ? AND material = ? ORDER BY origin').all(who.id, who.character, m).map((r) => [r.origin, Number(r.qty)]);
  const give = (who, m, origin, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(who.id, who.character, m, origin, qty);
  const xpOf = (who, prof) => Number(raw.prepare('SELECT xp FROM prof_tracks WHERE player = ? AND char_id = ? AND profession = ?').get(who.id, who.character, prof)?.xp ?? 0);
  const setXp = (who, xp, prof, { spec50 = null, spec100 = null } = {}) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, spec100, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp, spec50 = excluded.spec50, spec100 = excluded.spec100`)
    .run(who.id, who.character, prof, xp, spec50, spec100, _now);
  /** A pixel confirmed: three accounts a week registered agreeing on its ground (SEAT0 3.2). */
  const confirm = async (x, y, climate, region) => {
    for (const h of ['WitA', 'WitB', 'WitC']) {
      const w = (await s.registered(`${h}${x}`));
      raw.prepare("INSERT OR IGNORE INTO world_witness (kind, key, account, report, region, at) VALUES ('pixel', ?, ?, ?, ?, ?)").run(`${x},${y}`, w.id, `${climate},${region}`, region, _now - 9 * DAY);
    }
  };
  const balance = (who) => Number(raw.prepare('SELECT balance FROM marks WHERE account = ?').get(who.id)?.balance ?? 0);
  const fund = (who, marks) => raw.prepare('INSERT INTO marks (account, balance) VALUES (?, ?) ON CONFLICT (account) DO UPDATE SET balance = excluded.balance').run(who.id, marks);
  return { ...s, raw, stores, give, xpOf, setXp, confirm, balance, fund };
}
/** The first tree of a pixel's day that `pred` takes, on distinct pixels from `from`. */
function treeAt(climate, region, pred, { confirmed = false, from = 300 } = {}) {
  for (let x = from; x < from + 600; x++) {
    const t = trees({ x, y: 210, day: today(), climate, confirmed }).find(pred);
    if (t) return { x, y: 210, climate, region, ...t, key: nodeKey({ kind: 'tree', x, y: 210, day: today(), slot: t.slot }) };
  }
  throw new Error('no such tree');
}
/** PINE-SHARE: a Woodlands pixel stands Pine beside its Oak now - the Oak these pins mean, asked by name. */
const OAK = (q) => q.material === 'log:oak';
const chop = (who, n, extra = {}) => ({
  character: who.character, node: n.key, kind: 'logs', climate: n.climate, region: n.region, act: { cuts: 0, clean: false },
  at: _now - 2, rid: rid(), ...extra,
});
const craft = (who, recipe, extra = {}) => ({ character: who.character, recipe, clean: false, name: 'Silverthorn', rid: rid(), ...extra });

// ─── A TREE ──────────────────────────────────────────────────────────

test('PROF4 service: a tree felled - the law\'s wood\'s logs into the Stores, own; Logging XP 15 x tier; Resin one tree in four; asked again one; a tree once a day; logs, never herbs; felled by night too (ANY-HOUR)', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, xpForRank(10), 'logging');
  const t = treeAt(WOODS, GLENUMBRA, OAK);
  assert.deepEqual([t.material, t.tier], ['log:oak', 2], 'an unconfirmed Woodlands pixel: tiers 1-2 - its Oak');
  const body = chop(mac, t);
  const r = await steered(0x00, () => s.call('/v1/prof/harvest', body, mac.secret));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.material, r.body.qty, r.body.kind, r.body.xp], ['log:oak', TREE_YIELD[0], 'logs', harvestXp(2, 10, false)], 'the dice at their foot: two logs');
  assert.deepEqual([r.body.extra, r.body.extraStore], ['wood:resin', { material: 'wood:resin', own: 1, bought: 0 }], 'a unit under a quarter: Resin');
  assert.equal(r.body.gem, undefined, 'no Heartwood on ground nobody confirmed');
  assert.deepEqual(s.stores(mac, 'log:oak'), [['own', 2]]);
  assert.equal(s.xpOf(mac, 'logging'), xpForRank(10) + harvestXp(2, 10, false));
  const again = await s.call('/v1/prof/harvest', body, mac.secret);
  assert.deepEqual([again.body.repeat, again.body.qty, again.body.extra], [true, 2, 'wood:resin']);
  assert.deepEqual(s.stores(mac, 'log:oak'), [['own', 2]], 'once');
  assert.deepEqual((await s.call('/v1/prof/harvest', chop(mac, t), mac.secret)).body, { error: 'node-taken' });
  const t2 = treeAt(WOODS, GLENUMBRA, OAK, { from: t.x + 1 });
  const top = await steered(0xff, () => s.call('/v1/prof/harvest', chop(mac, t2), mac.secret));
  assert.deepEqual([top.body.qty, top.body.extra], [TREE_YIELD[1], undefined], 'the top: four logs, no Resin');
  const t3 = treeAt(WOODS, GLENUMBRA, OAK, { from: t2.x + 1 });
  assert.deepEqual((await s.call('/v1/prof/harvest', chop(mac, t3, { kind: 'herbs' }), mac.secret)).body, { error: 'prof-kind' });
  // PIN MOVED (ANY-HOUR, 2026-10-01, Mac: "Remove the time limit for professions. Should be available at any time"):
  // 02:00 refused a tree (`prof-night`, "the wilderness keeps Foraging's day"); now it is felled as at noon
  const t4 = treeAt(WOODS, GLENUMBRA, OAK, { from: t3.x + 1 });
  clock(secondAt(today() * DAY + 60, 2));
  const dark = await s.call('/v1/prof/harvest', chop(mac, t4, { at: _now - 2 }), mac.secret);
  assert.equal(dark.status, 200, JSON.stringify(dark.body));
  assert.deepEqual([dark.body.material, dark.body.kind], ['log:oak', 'logs'], 'felled by night');
  clock(NOON);
  s.setXp(mac, xpForRank(9), 'logging');
  assert.deepEqual((await s.call('/v1/prof/harvest', chop(mac, t3), mac.secret)).body, { error: 'prof-rank' }, 'Oak asks Logging 10');
});

test('PROF4 service: the Wood-Axe\'s report bounded - the Clean Cuts at most the finish\'s, a clean act only with every chop clean (+50% XP); a Clean Cut\'s Heartwood on confirmed ground (a Forester\'s twice as likely), never with no cut; the rare wood one in twenty there, and none on a pixel nobody vouched for', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, xpForRank(99), 'logging');
  const most = cutsMax(2);
  let t = treeAt(WOODS, GLENUMBRA, OAK);
  const lied = await steered(0xff, () => s.call('/v1/prof/harvest', chop(mac, t, { act: { cuts: 99, clean: true } }), mac.secret));
  assert.equal(lied.body.xp, harvestXp(2, 99, true), 'ninety-nine cuts are the finish\'s, and clean');
  t = treeAt(WOODS, GLENUMBRA, OAK, { from: t.x + 1 });
  const half = await steered(0xff, () => s.call('/v1/prof/harvest', chop(mac, t, { act: { cuts: most - 1, clean: true } }), mac.secret));
  assert.equal(half.body.xp, harvestXp(2, 99, false), 'a chop not clean is no clean act, whatever the report says');
  // confirmed ground: a Clean Cut's Heartwood (2%); 0x08 is 3.1% - past a woodcutter's chance, inside a Forester's
  const c = treeAt(WOODS, GLENUMBRA, OAK, { from: 500 });
  await s.confirm(c.x, c.y, WOODS, GLENUMBRA);
  const cc = tree({ x: c.x, y: c.y, day: today(), slot: c.slot, climate: WOODS, confirmed: true });
  const onConfirmed = { ...c, ...cc, key: nodeKey({ kind: 'tree', x: c.x, y: c.y, day: today(), slot: c.slot }) };
  const low = await steered(0x00, () => s.call('/v1/prof/harvest', chop(mac, onConfirmed, { act: { cuts: 1, clean: false } }), mac.secret));
  assert.equal(low.body.gem, 'wood:heartwood', 'a Clean Cut on witnessed ground');
  assert.deepEqual(s.stores(mac, 'wood:heartwood'), [['own', 1]]);
  const d = treeAt(WOODS, GLENUMBRA, OAK, { from: c.x + 1 });
  await s.confirm(d.x, d.y, WOODS, GLENUMBRA);
  const dd = { ...d, ...tree({ x: d.x, y: d.y, day: today(), slot: d.slot, climate: WOODS, confirmed: true }) };
  const none = await steered(0x00, () => s.call('/v1/prof/harvest', chop(mac, dd, { act: { cuts: 0 } }), mac.secret));
  assert.equal(none.body.gem, undefined, 'no cut, no Heartwood');
  const e = treeAt(WOODS, GLENUMBRA, OAK, { from: d.x + 1 });
  await s.confirm(e.x, e.y, WOODS, GLENUMBRA);
  const ee = { ...e, ...tree({ x: e.x, y: e.y, day: today(), slot: e.slot, climate: WOODS, confirmed: true }) };
  const plain = await steered(0x08, () => s.call('/v1/prof/harvest', chop(mac, ee, { act: { cuts: 1 } }), mac.secret));
  assert.equal(plain.body.gem, undefined, '3.1% misses a woodcutter\'s 2%');
  s.setXp(mac, xpForRank(99), 'logging', { spec50: 'forester' });
  const f = treeAt(WOODS, GLENUMBRA, OAK, { from: e.x + 1 });
  await s.confirm(f.x, f.y, WOODS, GLENUMBRA);
  const ff = { ...f, ...tree({ x: f.x, y: f.y, day: today(), slot: f.slot, climate: WOODS, confirmed: true }) };
  const forester = await steered(0x08, () => s.call('/v1/prof/harvest', chop(mac, ff, { act: { cuts: 1 } }), mac.secret));
  assert.equal(forester.body.gem, 'wood:heartwood', '...and takes a Forester\'s 4%');
  // the rare wood: on a confirmed Rainforest pixel one tree in twenty is Ironwood; unconfirmed, the Rainforest stands none
  assert.ok(trees({ x: 400, y: 210, day: today(), climate: RAINFOREST, confirmed: false }).every((q) => q.material === 'log:pine'), 'Teak and Mahogany are past tier 2 - only PINE-SHARE\'s Pine');
  let rare = null;
  for (let x = 300; x < 2000 && !rare; x++) {
    const hit = trees({ x, y: 210, day: today(), climate: RAINFOREST, confirmed: true }).find((q) => q.rare);
    if (hit) rare = { x, y: 210, climate: RAINFOREST, region: GLENUMBRA, ...hit, key: nodeKey({ kind: 'tree', x, y: 210, day: today(), slot: hit.slot }) };
  }
  assert.ok(rare, 'a rare tree somewhere');
  await s.confirm(rare.x, rare.y, RAINFOREST, GLENUMBRA);
  const iron = await s.call('/v1/prof/harvest', chop(mac, rare), mac.secret);
  assert.deepEqual([iron.body.material, iron.body.xp], ['log:ironwood', harvestXp(6, 99, false)]);
});

// ─── THE FORGE'S BURNS, THE WORKBENCH'S SAWS ─────────────────────────

test('PROF4 service: a log burnt to a Charcoal at the forge (a Charcoal Burner\'s two) and sawn to two planks at the workbench (a Timberwright\'s three) - no XP; bought logs make bought wood; asked twice one', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.give(mac, 'log:oak', 'own', 10);
  const burn = await s.call('/v1/prof/smelt', { character: mac.character, recipe: 'burn:oak', count: 3, rid: rid() }, mac.secret);
  assert.equal(burn.status, 200, JSON.stringify(burn.body));
  assert.deepEqual([burn.body.own, burn.body.bought, burn.body.xp, burn.body.track.profession], [3, 0, 0, 'logging']);
  assert.deepEqual(s.stores(mac, 'wood:charcoal'), [['own', 3]]);
  const sawBody = { character: mac.character, recipe: 'saw:oak', count: 3, rid: rid() };
  const saw = await s.call('/v1/prof/smelt', sawBody, mac.secret);
  assert.deepEqual([saw.body.own, saw.body.xp], [6, 0], 'a log saws to two');
  assert.deepEqual(s.stores(mac, 'plank:oak'), [['own', 6]]);
  assert.deepEqual(s.stores(mac, 'log:oak'), [['own', 4]]);
  assert.deepEqual((await s.call('/v1/prof/smelt', sawBody, mac.secret)).body.repeat, true);
  assert.deepEqual(s.stores(mac, 'plank:oak'), [['own', 6]], 'once');
  assert.equal(s.xpOf(mac, 'logging') + s.xpOf(mac, 'smithing') + s.xpOf(mac, 'building'), 0, 'a log\'s XP was its fall\'s');   // PIN MOVED (CRAFT3): Carpentry's XP is the Building track's row
  s.setXp(mac, xpForRank(100), 'logging', { spec100: 'charcoal-burner' });
  const burner = await s.call('/v1/prof/smelt', { character: mac.character, recipe: 'burn:oak', count: 1, rid: rid() }, mac.secret);
  assert.equal(burner.body.own, 2, 'a Charcoal Burner\'s two');
  s.setXp(mac, xpForRank(100), 'logging', { spec100: 'timberwright' });
  const wright = await s.call('/v1/prof/smelt', { character: mac.character, recipe: 'saw:oak', count: 1, rid: rid() }, mac.secret);
  assert.equal(wright.body.own, 3, 'a Timberwright\'s three');
  s.give(mac, 'log:pine', 'bought', 2);
  const bought = await s.call('/v1/prof/smelt', { character: mac.character, recipe: 'saw:pine', count: 2, rid: rid() }, mac.secret);
  assert.deepEqual([bought.body.own, bought.body.bought], [0, 6], 'bought logs, bought planks - a Timberwright\'s');
  assert.deepEqual((await s.call('/v1/prof/smelt', { character: mac.character, recipe: 'saw:oak', count: 99, rid: rid() }, mac.secret)).body, { error: 'stores-short' });
});

// ─── THE WORKBENCH ───────────────────────────────────────────────────

test('PROF4 service: a Small Oak Table made - three Oak Planks spent, the piece written (DFU\'s 225) with its record, Carpentry XP 20 x 2 and the first craft\'s 500; a Joiner\'s half the planks; a Heartwood for a plank and a step (one with nothing else); a Master Joiner\'s mark on every piece', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  // PIN MOVED (CRAFT3): a workbench's work reads and raises the Building track (Carpentry's craft) - every track seeded here is 'building', and the track answered names it
  s.setXp(mac, xpForRank(10), 'building');
  s.give(mac, 'plank:oak', 'own', 3);
  const r = await steered(0x00, () => s.call('/v1/prof/craft', craft(mac, 'table-small:oak'), mac.secret));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.quality, r.body.xp, r.body.first, r.body.marked, r.body.track.profession], [0, 20 * 2 + FIRST_CRAFT_XP, true, false, 'building'], 'margin 0, the roll\'s foot: Crude');   // PIN MOVED (CRAFT3): the track answered is the craft's, Building
  assert.deepEqual(s.stores(mac, 'plank:oak'), []);
  assert.equal(s.xpOf(mac, 'building'), xpForRank(10) + 540);   // PIN MOVED (CRAFT3): credited to the Building row
  const [{ provenance, record }] = r.body.pieces;
  assert.match(provenance, PROVENANCE_RE);
  const row = s.raw.prepare('SELECT * FROM products WHERE provenance = ?').get(provenance);
  assert.deepEqual([row.template, row.material, row.recipe, row.marked], [225, 0, 'table-small:oak', 0]);
  assert.equal(readProductRecord(record).r, 'table-small:oak');
  // a Joiner: half the planks, rounded up
  s.setXp(mac, xpForRank(50), 'building', { spec50: 'joiner' });
  s.give(mac, 'plank:oak', 'own', 3);
  await s.call('/v1/prof/craft', craft(mac, 'table-small:oak'), mac.secret);
  assert.deepEqual(s.stores(mac, 'plank:oak'), [['own', 1]], 'two of three spent');
  // a Heartwood for a plank: one step, and spent in the plank's place
  s.setXp(mac, xpForRank(10), 'building');
  s.give(mac, 'plank:oak', 'own', 2);
  s.give(mac, 'wood:heartwood', 'own', 1);
  const h = await steered(0x00, () => s.call('/v1/prof/craft', craft(mac, 'table-small:oak', { heartwood: true }), mac.secret));
  assert.deepEqual([h.body.quality, h.body.heartwood], [1, true], 'Crude, and a step: Standard');
  assert.deepEqual([s.stores(mac, 'plank:oak'), s.stores(mac, 'wood:heartwood')], [[], []]);
  const noWood = await s.call('/v1/prof/craft', craft(mac, 'table-small:oak', { heartwood: true }), mac.secret);
  assert.deepEqual(noWood.body, { error: 'stores-short' });
  // a Master Joiner: the mark at any quality
  s.setXp(mac, xpForRank(100), 'building', { spec100: 'master-joiner' });
  s.give(mac, 'plank:oak', 'own', 2);
  const mj = await s.call('/v1/prof/craft', craft(mac, 'chair:oak'), mac.secret);
  assert.deepEqual([mj.body.marked, mj.body.maker], [true, 'Silverthorn']);
  assert.equal(s.raw.prepare('SELECT marked FROM products WHERE provenance = ?').get(mj.body.pieces[0].provenance).marked, 1);
  // a smith's plank too: a Warforged ingot and a Heartwood are one step between them
  s.setXp(mac, xpForRank(70), 'smithing');
  for (const inp of recipeById('warhammer:warforged').inputs) s.give(mac, inp.key, 'own', inp.n);
  s.give(mac, 'wood:heartwood', 'own', 1);
  const both = await steered(0x00, () => s.call('/v1/prof/craft', craft(mac, 'warhammer:warforged', { heartwood: true }), mac.secret));
  assert.equal(both.body.quality, 1, 'one step, not two');
});

test('PROF4 service: arrows are twenty at no quality (their record -1), one piece; the Ram Kit is refused - it waits for the sieges; Carpentry\'s rank; the bed\'s Linen from the furnisher for Marks, a `stock` line', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.give(mac, 'plank:pine', 'own', 1); s.give(mac, 'ingot:iron', 'own', 1); s.give(mac, 'p1:8', 'own', 4);
  const a = await s.call('/v1/prof/craft', craft(mac, 'arrows:north'), mac.secret);
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.deepEqual([a.body.quality, a.body.count, a.body.pieces.length, readProductRecord(a.body.pieces[0].record).q], [-1, 1, 1, -1]);
  assert.deepEqual(s.stores(mac, 'p1:8'), []);
  assert.deepEqual((await s.call('/v1/prof/craft', craft(mac, 'arrows:south'), mac.secret)).body.error, 'stores-short', 'the southern Twigs are another material');
  s.setXp(mac, xpForRank(RAM_KIT_RANK), 'building');   // PIN MOVED (CRAFT3): Carpentry's rank is the Building track's
  assert.deepEqual((await s.call('/v1/prof/craft', craft(mac, 'ramkit:oak'), mac.secret)).body, { error: 'stores-short' });   // SEAT2b part two (PIN MOVED): made now - refused for its inputs alone
  s.setXp(mac, 0, 'building');   // PIN MOVED (CRAFT3): the Building track
  s.give(mac, 'plank:oak', 'own', 3);
  assert.deepEqual((await s.call('/v1/prof/craft', craft(mac, 'table-small:oak'), mac.secret)).body, { error: 'prof-rank' }, 'Oak asks Carpentry 10');
  // the furnisher's stock: Linen at two Marks, bought
  s.fund(mac, 100);
  const buy = await s.call('/v1/prof/stock', { character: mac.character, material: 'cloth:linen', qty: 2, rid: rid() }, mac.secret);
  assert.equal(buy.status, 200, JSON.stringify(buy.body));
  assert.deepEqual([buy.body.marks, s.balance(mac), s.stores(mac, 'cloth:linen')], [4, 96, [['bought', 2]]]);
  assert.equal(s.raw.prepare("SELECT who FROM marks_ledger WHERE actor = ? AND kind = 'stock'").get(mac.id).who, 'cloth:linen');
  assert.equal((await s.call('/v1/prof/stock', { character: mac.character, material: 'cloth:linen', qty: STOCK_MAX + 1, rid: rid() }, mac.secret)).body.error, 'bad-qty');
  s.give(mac, 'plank:pine', 'own', 8);
  const bed = await s.call('/v1/prof/craft', craft(mac, 'bed-plain-single:pine'), mac.secret);
  assert.equal(bed.status, 200, JSON.stringify(bed.body));
  assert.deepEqual([s.stores(mac, 'cloth:linen'), s.stores(mac, 'plank:pine')], [[], []]);
  assert.equal((await s.call('/v1/stores/withdraw', { character: mac.character, material: 'cloth:linen', qty: 1, rid: rid() }, mac.secret)).body.error, 'stores-short', 'PROF7 moved it: Linen withdraws now (668) - there is none left');
  const w = await s.call('/v1/stores/withdraw', { character: mac.character, material: 'log:oak', qty: 1, rid: rid() }, mac.secret);
  assert.equal(w.body.error, 'stores-short', 'a log is withdrawable - there are none');
});

// ─── THE FURNITURE, SET DOWN ─────────────────────────────────────────

const HOME = { mapId: 1291010263, buildingKey: 0x10203 };
const home = () => ({ ...HOME, region: 17, price: 42000 });   // MERGE 2: claimed by a realm character (s.seatHome, AUDIT REALM2 S2)
const piece = (item, extra = {}) => ({ id: 'tb1', model: 41000, flat: null, pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0, item, ...extra });

test('PROF4 service: a crafted table set down in a home - its provenance kept where the service\'s own row says it is this account\'s and this template\'s, its maker\'s mark written from that row (a Masterwork\'s, a Master Joiner\'s) and never from what the client sent; another\'s id, or a forged one, stands the plain piece', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const ann = await s.registered('Ann');
  const house = await s.seatHome(mac, home());
  assert.equal(house.status, 200);
  // PIN MOVED (CRAFT3): a workbench's work reads the Building track (Carpentry's craft) - every track seeded here is 'building'
  s.setXp(mac, xpForRank(100), 'building', { spec100: 'master-joiner' });
  s.give(mac, 'plank:oak', 'own', 3);
  const made = await s.call('/v1/prof/craft', craft(mac, 'table-small:oak'), mac.secret);
  const pv = made.body.pieces[0].provenance;
  const at = (extra) => ({ ...HOME, character: house.character, ...extra });
  const r = await s.call('/v1/homes/decor/place', at({ piece: piece({ t: 225, g: 8, pv, mk: 'Somebody Else' }) }), mac.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.piece.item.pv, r.body.piece.item.mk], [pv, 'Silverthorn'], 'the row\'s mark, not the client\'s');
  const read = await s.call('/v1/homes/decor', HOME, ann.secret);
  assert.equal(read.body.pieces.find((p) => p.id === 'tb1').item.mk, 'Silverthorn', 'a visitor reads the mark');
  // an unmarked piece: its id kept, no mark
  s.setXp(mac, xpForRank(10), 'building');
  s.give(mac, 'plank:oak', 'own', 3);
  const plainMade = await steered(0x00, () => s.call('/v1/prof/craft', craft(mac, 'table-small:oak'), mac.secret));
  const pv2 = plainMade.body.pieces[0].provenance;
  const r2 = await s.call('/v1/homes/decor/place', at({ piece: piece({ t: 225, g: 8, pv: pv2, mk: 'Silverthorn' }, { id: 'tb2' }) }), mac.secret);
  assert.deepEqual([r2.body.piece.item.pv, r2.body.piece.item.mk], [pv2, undefined], 'a Crude table carries no mark');
  // another's id: dropped - and a forged one, and one of another template
  s.setXp(ann, xpForRank(100), 'building', { spec100: 'master-joiner' });
  s.give(ann, 'plank:oak', 'own', 3);
  const annMade = await s.call('/v1/prof/craft', craft(ann, 'table-small:oak', { name: 'Ann' }), ann.secret);
  const theirs = await s.call('/v1/homes/decor/place', at({ piece: piece({ t: 225, g: 8, pv: annMade.body.pieces[0].provenance, mk: 'Ann' }, { id: 'tb3' }) }), mac.secret);
  assert.deepEqual([theirs.status, theirs.body.piece.item.pv, theirs.body.piece.item.mk], [200, undefined, undefined], 'Ann\'s table is not Mac\'s to mark');
  const forged = await s.call('/v1/homes/decor/place', at({ piece: piece({ t: 225, g: 8, pv: '00000000deadbeef', mk: 'Silverthorn' }, { id: 'tb4' }) }), mac.secret);
  assert.deepEqual([forged.body.piece.item.pv, forged.body.piece.item.mk], [undefined, undefined]);
  // AUDIT 30 S6: a piece of its own, standing nowhere - the first table stands at tb1, and one id stands once
  s.setXp(mac, xpForRank(100), 'building', { spec100: 'master-joiner' });
  s.give(mac, 'plank:oak', 'own', 3);
  const pv3 = (await s.call('/v1/prof/craft', craft(mac, 'table-small:oak'), mac.secret)).body.pieces[0].provenance;
  const other = await s.call('/v1/homes/decor/place', at({ piece: piece({ t: 221, g: 8, pv: pv3, mk: 'Silverthorn' }, { id: 'tb5' }) }), mac.secret);
  assert.deepEqual([other.body.piece.item.pv, other.body.piece.item.mk], [undefined, undefined], 'a Large table is not the Small one\'s id');
  const again = await s.call('/v1/homes/decor/place', at({ piece: piece({ t: 225, g: 8, pv, mk: 'Somebody Else' }) }), mac.secret);
  assert.deepEqual([again.status, again.body.repeat], [200, true], 'the same set-down sent again is answered as it stood');
});
