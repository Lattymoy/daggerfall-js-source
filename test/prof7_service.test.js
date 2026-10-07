// PROF7 (2026-09-29, Mac: "Do it") - HUNTING, THE SKINNING KNIFE AND OUTFITTING AS THE SERVICE KEEPS THEM: a body's
// harvest (`body:<day>:<id>`, the foe the client names - Hunting bounded, not witnessed: no ground, no hours, the
// account's day of 3 hides of tiers 5-6 decided in the harvest's own INSERT (CAP-OFF: its 30 of any tier gone); the knife's report bounded - a clean
// pelt x1.5, a torn one its part lost; the DFU part one body in four; the butchery beside it, a Butcher's two); the
// loom's cures (a Tanner's at 50) and its weave; Outfitting's crafts and a garment's dye, signed into its record and
// carried by the market's pieces; and the day's harvests rebuilt over rows that stood before. Driven through the real
// Worker over node:sqlite with every migration applied (test/accountDb.mjs). bible/06-Systems/Professions-Arc.md 29.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from './accountDb.mjs';
import { bodyKey } from '../src/net/nodeLaw.js';
import { xpForRank, harvestXp, HIGH_HIDES_PER_DAY } from '../src/net/professionLaw.js';
import { craftXp } from '../src/net/recipeLaw.js';
import { readProductRecord, verifyProductRecord } from '../src/net/productRecord.js';
import { sharedClassicMinutes } from '../src/net/wire.js';
import { utcDay } from '../src/net/marksLaw.js';

const DAY = 86_400;
const DF = 17;
const HUBS = { [DF]: [207, 212], 23: [590, 166] };
const MOB = { Rat: 0, GrizzlyBear: 4, Spider: 6, Orc: 7, Slaughterfish: 11, Harpy: 13, Dragonling: 34 };
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
const rid = () => `hunt-${String(++_rid).padStart(6, '0')}`;
const today = () => utcDay(_now);
let _body = 0;
/** A body the client stamped at its kill: today's, a fresh id. */
const bodyOf = (day = today()) => bodyKey({ day, id: (++_body).toString(16).padStart(12, '0') });
const realRandom = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
/** The service's dice steered: every four-byte draw all `b` while `fn` runs; ids and nonces stay the CSPRNG's. */
async function steered(b, fn) {
  globalThis.crypto.getRandomValues = (arr) => (arr.byteLength === 4 ? (new Uint8Array(arr.buffer, arr.byteOffset, 4).fill(b), arr) : realRandom(arr));
  try { return await fn(); } finally { globalThis.crypto.getRandomValues = realRandom; }
}

async function stand(extra = {}) {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on', DEVELOPER_HANDLES: 'Mac', ...extra });
  const raw = s.env.DB._raw;
  const stores = (who, m) => raw.prepare('SELECT origin, qty FROM prof_stores WHERE player = ? AND char_id = ? AND material = ? ORDER BY origin').all(who.id, who.character, m).map((r) => [r.origin, Number(r.qty)]);
  const give = (who, m, origin, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(who.id, who.character, m, origin, qty);
  const xpOf = (who, prof) => Number(raw.prepare('SELECT xp FROM prof_tracks WHERE player = ? AND char_id = ? AND profession = ?').get(who.id, who.character, prof)?.xp ?? 0);
  const setXp = (who, xp, prof, { spec50 = null, spec100 = null } = {}) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, spec100, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp, spec50 = excluded.spec50, spec100 = excluded.spec100`)
    .run(who.id, who.character, prof, xp, spec50, spec100, _now);
  /** A day's hides already taken by `who`'s character `char`, `n` of them at `tier` - rows as a harvest writes them. */
  const hunted = (who, n, tier = 1, char = who.character) => {
    const ins = raw.prepare(`INSERT INTO node_harvests (day, node, kind, player, char_id, profession, material, qty, xp, gem, at, rid, n, deep_unconfirmed, extra, tier, extra_qty)
      VALUES (?, ?, 'hide', ?, ?, 'hunting', 'hide:rat', 1, 0, NULL, ?, ?, 'n', 0, NULL, ?, 1)`);
    for (let i = 0; i < n; i++) ins.run(today(), bodyOf(), who.id, char, _now, `seed${tier}x${String(++_rid).padStart(6, '0')}`, tier);
  };
  const rows = (who) => Number(raw.prepare('SELECT COUNT(*) AS n FROM node_harvests WHERE player = ?').get(who.id).n);
  const fund = (who, marks) => raw.prepare('INSERT INTO marks (account, balance) VALUES (?, ?) ON CONFLICT (account) DO UPDATE SET balance = excluded.balance').run(who.id, marks);
  return { ...s, raw, stores, give, xpOf, setXp, hunted, rows, fund };
}
const skin = (who, foe, extra = {}) => ({
  character: who.character, node: bodyOf(), kind: 'hide', foe, act: { clean: false, torn: false }, at: _now - 2, rid: rid(), ...extra,
});
const craft = (who, recipe, extra = {}) => ({ character: who.character, recipe, clean: false, name: 'Silverthorn', rid: rid(), ...extra });

// ─── A BODY ──────────────────────────────────────────────────────────

test('PROF7 service: a body skinned - the hide of the foe the client names into the Stores, own; Hunting XP by its tier; the DFU part one body in four and the butchery beside it; asked again one; a body once; no ground asked, and no hours kept', async () => {
  clock(secondAt(utcDay(T0) * DAY + 3600, 23));   // the night: Hunting keeps no hours (PROF0 6; FORAGE0 14.3)
  try {
    const s = await stand();
    const mac = await s.registered('Mac');
    s.setXp(mac, xpForRank(10), 'hunting');
    const body = skin(mac, MOB.GrizzlyBear);
    const r = await steered(0, () => s.call('/v1/prof/harvest', body, mac.secret));
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual([r.body.node, r.body.kind, r.body.material, r.body.qty, r.body.xp], [body.node, 'hide', 'hide:bear', 1, harvestXp(2, 10, false)]);
    assert.deepEqual([r.body.gem, r.body.extra, r.body.extraQty], ['part:tooth', 'food:meat', 1], 'the dice at their lowest: the Big Tooth, and the Raw Meat');
    assert.deepEqual([r.body.store, r.body.gemStore, r.body.extraStore], [
      { material: 'hide:bear', own: 1, bought: 0 }, { material: 'part:tooth', own: 1, bought: 0 }, { material: 'food:meat', own: 1, bought: 0 },
    ]);
    assert.deepEqual([r.body.track.profession, r.body.hunt], ['hunting', { hides: 1, high: 0 }]);
    assert.deepEqual([s.stores(mac, 'hide:bear'), s.stores(mac, 'part:tooth'), s.stores(mac, 'food:meat')], [[['own', 1]], [['own', 1]], [['own', 1]]]);
    assert.equal(s.xpOf(mac, 'hunting'), xpForRank(10) + harvestXp(2, 10, false));
    const again = await s.call('/v1/prof/harvest', body, mac.secret);
    assert.deepEqual([again.status, again.body.repeat, s.stores(mac, 'hide:bear')], [200, true, [['own', 1]]], 'asked twice, one');
    assert.deepEqual((await s.call('/v1/prof/harvest', { ...body, rid: rid() }, mac.secret)).body, { error: 'node-taken' }, 'a body skinned once');
    // the part is one body in four - the dice at their highest find none; the butchery is every body's
    const hi = await steered(255, () => s.call('/v1/prof/harvest', skin(mac, MOB.GrizzlyBear), mac.secret));
    assert.deepEqual([hi.body.gem ?? null, hi.body.extra, hi.body.qty], [null, 'food:meat', 1]);
    // what is refused: no foe a knife skins, the wrong kind, a body not today's, one no rank reaches, a key misspelt
    assert.deepEqual((await s.call('/v1/prof/harvest', skin(mac, MOB.Orc), mac.secret)).body, { error: 'prof-foe' });
    assert.deepEqual((await s.call('/v1/prof/harvest', skin(mac, undefined), mac.secret)).body, { error: 'prof-foe' });
    assert.deepEqual((await s.call('/v1/prof/harvest', skin(mac, MOB.GrizzlyBear, { kind: 'ore' }), mac.secret)).body, { error: 'prof-kind' });
    assert.deepEqual((await s.call('/v1/prof/harvest', skin(mac, MOB.GrizzlyBear, { node: bodyOf(today() - 1) }), mac.secret)).body, { error: 'prof-day' });
    assert.deepEqual((await s.call('/v1/prof/harvest', skin(mac, MOB.Dragonling), mac.secret)).body, { error: 'prof-rank' }, 'a Dragonling is tier 6');
    for (const node of [`body:${today()}:ABCDEF012345`, `body:${today()}:0123`, `body:0${today()}:0123456789ab`]) {
      assert.deepEqual((await s.call('/v1/prof/harvest', skin(mac, MOB.GrizzlyBear, { node }), mac.secret)).body, { error: 'bad-node' }, node);
    }
    assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM world_witness").get().n, 0, 'a body writes no witness');
  } finally { clock(NOON); }
});

test('PROF7 service: the knife\'s report, bounded - a clean pelt x1.5, its fraction the dice\'s; a torn pelt loses its part; a report claiming both is neither; a Butcher\'s butchery two, a Slaughterfish\'s Raw Fish, a Harpy\'s none', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, xpForRank(55), 'hunting', { spec100: null });
  const clean = await steered(0, () => s.call('/v1/prof/harvest', skin(mac, MOB.Rat, { act: { clean: true } }), mac.secret));
  assert.deepEqual([clean.body.qty, clean.body.xp], [2, harvestXp(1, 55, true)], 'x1.5, and the half a unit the dice\'s');
  const clean2 = await steered(255, () => s.call('/v1/prof/harvest', skin(mac, MOB.Rat, { act: { clean: true } }), mac.secret));
  assert.equal(clean2.body.qty, 1);
  const torn = await steered(0, () => s.call('/v1/prof/harvest', skin(mac, MOB.GrizzlyBear, { act: { torn: true } }), mac.secret));
  assert.deepEqual([torn.body.qty, torn.body.gem ?? null, torn.body.extra], [1, null, 'food:meat'], 'torn: the part lost, the butchery kept');
  const both = await steered(0, () => s.call('/v1/prof/harvest', skin(mac, MOB.GrizzlyBear, { act: { clean: true, torn: true } }), mac.secret));
  assert.deepEqual([both.body.qty, both.body.gem, both.body.xp], [1, 'part:tooth', harvestXp(2, 55, false)], 'neither clean nor torn');
  const fish = await s.call('/v1/prof/harvest', skin(mac, MOB.Slaughterfish), mac.secret);
  assert.deepEqual([fish.body.material, fish.body.extra], ['hide:slaughterfish', 'food:fish']);
  const harpy = await s.call('/v1/prof/harvest', skin(mac, MOB.Harpy), mac.secret);
  assert.deepEqual([harpy.status, harpy.body.material, harpy.body.extra ?? null], [200, 'hide:harpy', null], 'C&C gives a Harpy\'s body no meat');
  s.setXp(mac, xpForRank(100), 'hunting', { spec100: 'butcher' });
  const meat = s.stores(mac, 'food:meat')[0][1];
  const b = await s.call('/v1/prof/harvest', skin(mac, MOB.GrizzlyBear), mac.secret);
  assert.deepEqual([b.body.extra, b.body.extraQty, b.body.extraStore.own], ['food:meat', 2, meat + 2], 'a Butcher\'s two');
});

// ─── HUNTING'S DAY (PROF0 6) ─────────────────────────────────────────

test('PROF7 service: Hunting\'s day is the account\'s - 3 hides of tiers 5-6 across its characters, decided in the harvest\'s own INSERT (a refusal writes no row and moves nothing); CAP-OFF: the hides past thirty credited; the state says the day and its bound', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, xpForRank(100), 'hunting');
  // the high hides: three of tiers 5-6 taken on another character of the account
  s.hunted(mac, HIGH_HIDES_PER_DAY, 5, 'char-mac-alt');
  const before = s.rows(mac);
  assert.deepEqual((await s.call('/v1/prof/harvest', skin(mac, MOB.Harpy), mac.secret)).body, { error: 'prof-hunt-high' });
  assert.deepEqual([s.rows(mac), s.stores(mac, 'hide:harpy')], [before, []], 'nothing written, nothing stored');
  const rat = await s.call('/v1/prof/harvest', skin(mac, MOB.Rat), mac.secret);
  assert.deepEqual([rat.status, rat.body.hunt], [200, { hides: HIGH_HIDES_PER_DAY + 1, high: HIGH_HIDES_PER_DAY }], 'a low hide still');
  // PIN MOVED (CAP-OFF, 2026-10-07 - Mac: "Remove the cap on life skills"): the day held thirty hides - a thirty-first was
  // `prof-hunt-cap`, refused in the INSERT. Now a hide below the rare is counted, not bounded
  s.hunted(mac, 30 - HIGH_HIDES_PER_DAY - 2, 1, 'char-mac-alt');
  const last = await s.call('/v1/prof/harvest', skin(mac, MOB.Rat), mac.secret);
  assert.deepEqual([last.status, last.body.hunt.hides], [200, 30]);
  const n = s.rows(mac);
  const past = await s.call('/v1/prof/harvest', skin(mac, MOB.Rat), mac.secret);
  assert.deepEqual([past.status, past.body.hunt.hides], [200, 31], JSON.stringify(past.body));
  assert.equal(s.rows(mac), n + 1, 'the thirty-first written');
  const st = (await s.call('/v1/prof/state', { character: mac.character }, mac.secret)).body;
  assert.deepEqual([st.hunt, st.caps.hides, st.caps.highHides], [{ hides: 31, high: HIGH_HIDES_PER_DAY }, undefined, 3]);
  // another account's day is its own - and its rare hides are counted as the service writes them (the tier kept)
  const ann = await s.registered('Ann');
  s.setXp(ann, xpForRank(100), 'hunting');
  for (let i = 0; i < HIGH_HIDES_PER_DAY; i++) assert.equal((await s.call('/v1/prof/harvest', skin(ann, i ? MOB.Harpy : MOB.Dragonling), ann.secret)).status, 200);
  const fourth = await s.call('/v1/prof/harvest', skin(ann, MOB.Harpy), ann.secret);
  assert.deepEqual([fourth.status, fourth.body], [409, { error: 'prof-hunt-high' }]);
  const rat2 = await s.call('/v1/prof/harvest', skin(ann, MOB.Rat), ann.secret);
  assert.deepEqual([rat2.status, rat2.body.hunt], [200, { hides: HIGH_HIDES_PER_DAY + 1, high: HIGH_HIDES_PER_DAY }]);
});

// ─── THE LOOM'S WORK (PROF0 4.4, 4.5) ────────────────────────────────

test('PROF7 service: the tanning rack cures two hides to a leather (a Tanner\'s two, a choice at 50) and the loom weaves three Spider Silk to a Silk Bolt - no XP; the Stores short refused', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.give(mac, 'hide:bear', 'own', 4);
  const cure = await s.call('/v1/prof/smelt', { character: mac.character, recipe: 'cure:bear', count: 2, rid: rid() }, mac.secret);
  assert.equal(cure.status, 200, JSON.stringify(cure.body));
  assert.deepEqual([cure.body.own, cure.body.xp, s.stores(mac, 'leather:cured'), s.stores(mac, 'hide:bear')], [2, 0, [['own', 2]], []]);
  s.setXp(mac, xpForRank(50), 'hunting', { spec50: 'tanner' });
  s.give(mac, 'hide:scorpion', 'own', 2);
  const tan = await s.call('/v1/prof/smelt', { character: mac.character, recipe: 'cure:scorpion', count: 1, rid: rid() }, mac.secret);
  assert.deepEqual([tan.body.own, s.stores(mac, 'leather:hardened')], [2, [['own', 2]]], 'a Tanner\'s 1:1');
  assert.equal(s.xpOf(mac, 'hunting'), xpForRank(50), 'a hide\'s XP was its skinning\'s');
  s.give(mac, 'hide:spider', 'own', 3);
  const weave = await s.call('/v1/prof/smelt', { character: mac.character, recipe: 'weave:silk', count: 1, rid: rid() }, mac.secret);
  assert.deepEqual([weave.body.own, s.stores(mac, 'cloth:silk'), s.xpOf(mac, 'outfitting')], [1, [['own', 1]], 0]);
  assert.deepEqual((await s.call('/v1/prof/smelt', { character: mac.character, recipe: 'weave:silk', count: 1, rid: rid() }, mac.secret)).body, { error: 'stores-short' });
  assert.deepEqual((await s.call('/v1/prof/smelt', { character: mac.character, recipe: 'cure:spider', count: 1, rid: rid() }, mac.secret)).body, { error: 'bad-recipe' }, 'Spider Silk is woven, never cured');
});

// ─── OUTFITTING AND A GARMENT'S DYE (PROF0 9.3) ──────────────────────

test('PROF7 service: a garment sewn in the dye the crafter chose - signed into its record (`u`), kept on the craft and the piece, answered; a dye asked of anything else or past the ten refused (AUDIT 32 L3: DFU\'s unchangeable shirts take one); Outfitting\'s rank and XP; boots a bolt and a Cured Leather', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.give(mac, 'cloth:linen', 'own', 10);
  s.give(mac, 'leather:cured', 'own', 10);
  const ask = craft(mac, 'garment-141:linen', { dye: 3 });
  const g = await s.call('/v1/prof/craft', ask, mac.secret);
  assert.equal(g.status, 200, JSON.stringify(g.body));
  // AUDIT 32 S1 (Mac: "Whatever you think is best"): Straps are wholly the Weavers' Linen - the craft's XP, its first
  // recorded, and no first-craft bonus (a boot's Cured Leather keeps it, test/audit32_service.test.js)
  assert.deepEqual([g.body.dye, g.body.xp, g.body.first, g.body.track.profession], [3, craftXp(1, 0, false), true, 'outfitting']);
  assert.equal(g.body.xp, 20);
  const v = await verifyProductRecord(g.body.pieces[0].record, s.identityPublic, { subtle: globalThis.crypto.subtle });
  assert.deepEqual([v.ok, v.claims?.u, v.claims?.r], [true, 3, 'garment-141:linen'], 'the dye signed into the record');
  assert.deepEqual([s.raw.prepare('SELECT dye FROM prof_crafts WHERE rid = ?').get(ask.rid).dye,
    s.raw.prepare('SELECT dye FROM products WHERE provenance = ?').get(g.body.pieces[0].provenance).dye], [3, 3]);
  const again = await s.call('/v1/prof/craft', ask, mac.secret);
  assert.deepEqual([again.body.repeat, again.body.dye], [true, 3], 'asked twice, the dye answered from the row');
  assert.deepEqual(s.stores(mac, 'cloth:linen'), [['own', 9]], 'Straps: a small garment, one bolt');
  const plain = await s.call('/v1/prof/craft', craft(mac, 'garment-165:linen'), mac.secret);
  assert.deepEqual([plain.status, plain.body.dye], [200, null], 'undyed');
  assert.equal(readProductRecord(plain.body.pieces[0].record).u, undefined, 'no dye, no claim');
  for (const [recipe, dye] of [['leather-helm:cured', 3], ['rug-237:wool', 2], ['garment-141:linen', 10], ['garment-141:linen', -1], ['garment-141:linen', '3']]) {
    assert.deepEqual((await s.call('/v1/prof/craft', craft(mac, recipe, { dye }), mac.secret)).body, { error: 'prof-dye' }, `${recipe} ${dye}`);
  }
  assert.deepEqual((await s.call('/v1/prof/craft', craft(mac, 'garment-141:silk'), mac.secret)).body, { error: 'prof-rank' }, 'Silk is tier 4');
  const boots = await s.call('/v1/prof/craft', craft(mac, 'garment-149:linen'), mac.secret);
  assert.equal(boots.status, 200, JSON.stringify(boots.body));
  assert.deepEqual([s.stores(mac, 'cloth:linen'), s.stores(mac, 'leather:cured')], [[['own', 6]], [['own', 9]]]);
  s.setXp(mac, xpForRank(55), 'outfitting');
  assert.deepEqual((await s.call('/v1/prof/craft', craft(mac, 'leather-cuirass:hardened'), mac.secret)).body, { error: 'stores-short' }, 'six Hardened Leather');
  s.give(mac, 'leather:hardened', 'own', 6);
  const cuirass = await s.call('/v1/prof/craft', craft(mac, 'leather-cuirass:hardened'), mac.secret);
  assert.deepEqual([cuirass.status, s.stores(mac, 'leather:hardened')], [200, []]);
});

test('PROF7 service: the market carries a garment\'s dye - a dyed shirt listed is read with its colour', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.give(mac, 'cloth:linen', 'own', 2);
  const g = await s.call('/v1/prof/craft', craft(mac, 'garment-165:linen', { dye: 8 }), mac.secret);
  assert.equal(g.status, 200, JSON.stringify(g.body));
  const provenance = g.body.pieces[0].provenance;
  s.fund(mac, 100);   // the listing's fee
  const l = await s.call('/v1/market/list', { character: mac.character, region: DF, kind: 'piece', provenance, wear: 1000, price: 5, hubs: HUBS, rid: rid() }, mac.secret);
  assert.equal(l.status, 200, JSON.stringify(l.body));
  const mine = await s.call('/v1/market/read', { character: mac.character, region: DF, view: 'mine', hubs: HUBS }, mac.secret);
  const row = mine.body.rows.find((x) => x.piece?.provenance === provenance);
  assert.deepEqual([row?.piece?.dye, row?.piece?.recipe], [8, 'garment-165:linen']);
  const crafted = await s.call('/v1/market/read', { character: mac.character, region: DF, view: 'crafted', hubs: HUBS }, mac.secret);
  assert.equal(crafted.body.rows.find((x) => x.piece?.provenance === provenance)?.piece?.dye, 8);
});

// ─── THE MIGRATION (0036) ────────────────────────────────────────────

test('PROF7 service: the day\'s harvests rebuilt for a body\'s hide keep every row that stood - its tier 0, its second find one - and a craft and a piece before it undyed (0036_hunting.sql over PROF4\'s tables)', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const { readdirSync, readFileSync } = await import('node:fs');
  const dir = new URL('../server-account/migrations/', import.meta.url);
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    if (f === '0036_hunting.sql') {
      db.exec(`INSERT INTO players (id, handle, handle_lc, guest_name, created_at, last_seen) VALUES ('p1', 'Ann', 'ann', 'A b', 1, 1)`);
      db.exec(`INSERT INTO node_harvests (day, node, kind, player, char_id, profession, material, qty, xp, gem, at, rid, n, deep_unconfirmed, extra)
        VALUES (20000, 'tree:1:2:20000:0', 'logs', 'p1', 'c1', 'logging', 'log:oak', 3, 30, NULL, 5, 'rid00001', 'n1', 0, 'wood:resin')`);
      db.exec(`INSERT INTO products (provenance, owner, char_id, maker, recipe, template, material, quality, seed, record, made_at)
        VALUES ('0123456789abcdef', 'p1', 'c1', NULL, 'table-small:oak', 226, 0, 1, 7, 'p1.x.', 5)`);
    }
    db.exec(readFileSync(new URL(f, dir), 'utf8'));
  }
  assert.deepEqual({ ...db.prepare('SELECT node, extra, tier, extra_qty FROM node_harvests').get() }, { node: 'tree:1:2:20000:0', extra: 'wood:resin', tier: 0, extra_qty: 1 });
  db.exec(`INSERT INTO node_harvests (day, node, kind, player, char_id, profession, material, qty, xp, gem, at, rid, n, deep_unconfirmed, extra, tier, extra_qty)
    VALUES (20000, 'body:20000:0123456789ab', 'hide', 'p1', 'c1', 'hunting', 'hide:bear', 1, 30, NULL, 5, 'rid00002', 'n2', 0, 'food:meat', 2, 2)`);
  // PROF8 (0042_fishing.sql) took `fish` since: a kind no profession gathers is still refused
  assert.throws(() => db.exec(`INSERT INTO node_harvests (day, node, kind, player, char_id, profession, material, qty, xp, at, rid, n) VALUES (1, 'x', 'net', 'p1', 'c1', 'fishing', 'm', 1, 0, 1, 'rid00003', 'n')`), /CHECK/);
  assert.throws(() => db.exec(`UPDATE node_harvests SET tier = 8 WHERE rid = 'rid00002'`), /CHECK/);
  assert.throws(() => db.exec(`UPDATE node_harvests SET extra_qty = 0 WHERE rid = 'rid00002'`), /CHECK/);
  assert.deepEqual(db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'node_harvests' AND name LIKE 'idx_%' ORDER BY name").all().map((r) => r.name),
    ['idx_node_harvests_account', 'idx_node_harvests_carry_day', 'idx_node_harvests_char_day', 'idx_node_harvests_day', 'idx_node_harvests_today']);   // SCALE1 (0043_scale_indexes.sql): and the sweep's day; PIN MOVED (AUDIT2 BAG1 S1, 0076_materials_bag.sql): and the carried rows' own sweep; PIN MOVED (STORM-SHED, 0085_storm_shed.sql): and the character's day, covering
  assert.equal(db.prepare('SELECT dye FROM products').get().dye, null, 'a piece before it undyed');
  db.exec(`UPDATE products SET dye = 9`);
  assert.throws(() => db.exec(`UPDATE products SET dye = 10`), /CHECK/, 'a dye is one of the ten');
  assert.deepEqual(db.prepare("SELECT name FROM pragma_table_info('prof_crafts') WHERE name = 'dye'").all().map((r) => r.name), ['dye']);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});
