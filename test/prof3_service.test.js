// PROF3 (2026-09-28, Mac: "Lets keep moving") - SMITHING AS THE SERVICE KEEPS IT: a craft at the anvil (the recipe law's
// inputs held and spent bought first, the rank the recipe asks, the quality the service rolls and the steps it lays on,
// the pieces written each with its provenance id and its signed record, the Smithing XP and the first craft's 500, asked
// twice one); the smith's stock (the fittings no profession yields yet, bought into the Stores for Marks); a
// Quartermaster's smelt. Driven through the real Worker over node:sqlite with every migration applied (test/
// accountDb.mjs). bible/06-Systems/Professions-Arc.md 24.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

import { standService, T0 } from './accountDb.mjs';
import { xpForRank, rankOfXp, STORES_MAX, STOCK_MAX, SMITH_STOCK } from '../src/net/professionLaw.js';
import { recipeById, FIRST_CRAFT_XP, PROVENANCE_RE } from '../src/net/recipeLaw.js';
import { verifyProductRecord, readProductRecord } from '../src/net/productRecord.js';

let _rid = 0;
const rid = () => `smith-${String(++_rid).padStart(6, '0')}`;
const realRandom = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
/** The service's dice steered: every four-byte draw (a unit's - unitRoll.js dice) all `b` while `fn` runs; the ids and
 *  nonces (eight bytes and more) stay the CSPRNG's, so every piece keeps its own. */
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
  const xpOf = (who, prof = 'smithing') => Number(raw.prepare('SELECT xp FROM prof_tracks WHERE player = ? AND char_id = ? AND profession = ?').get(who.id, who.character, prof)?.xp ?? 0);
  const setXp = (who, xp, prof = 'smithing', { spec50 = null, spec100 = null } = {}) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, spec100, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp, spec50 = excluded.spec50, spec100 = excluded.spec100`)
    .run(who.id, who.character, prof, xp, spec50, spec100, T0);
  const balance = (who) => Number(raw.prepare('SELECT balance FROM marks WHERE account = ?').get(who.id)?.balance ?? 0);
  /** A Mithril Longsword's inputs, own: 3 Mithril Ingots, a Copper, a Cured Leather. */
  const longswordInputs = (who, leather = 'own') => { give(who, 'ingot:mithril', 'own', 3); give(who, 'metal:copper', 'own', 1); give(who, 'leather:cured', leather, 1); };
  return { ...s, raw, stores, give, xpOf, setXp, balance, longswordInputs };
}
const craft = (who, recipe, extra = {}) => ({ character: who.character, recipe, clean: false, name: 'Silverthorn', rid: rid(), ...extra });

// ─── THE ANVIL ───────────────────────────────────────────────────────

test('PROF3 service: a Mithril Longsword made - the inputs spent, the piece written with its provenance id and a record the service signed, 20 x 5 XP and the first craft\'s 500; asked twice one; the second is no first', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, xpForRank(55));
  s.longswordInputs(mac);
  const body = craft(mac, 'longsword:mithril');
  const r = await s.call('/v1/prof/craft', body, mac.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.recipe, 'longsword:mithril');
  assert.ok(r.body.quality >= 0 && r.body.quality <= 4);
  assert.equal(r.body.pieces.length, 1);
  const [{ provenance, record }] = r.body.pieces;
  assert.match(provenance, PROVENANCE_RE);
  assert.deepEqual([r.body.xp, r.body.first, r.body.maker], [20 * 5 + FIRST_CRAFT_XP, true, 'Silverthorn']);
  assert.equal(s.xpOf(mac), xpForRank(55) + 600);
  for (const m of ['ingot:mithril', 'metal:copper', 'leather:cured']) assert.deepEqual(s.stores(mac, m), [], `${m} spent`);
  const v = await verifyProductRecord(record, s.identityPublic, { subtle: webcrypto.subtle });
  assert.equal(v.ok, true, v.why);
  assert.deepEqual([v.claims.p, v.claims.s, v.claims.h, v.claims.r, v.claims.q, v.claims.m, v.claims.c], [provenance, mac.id, mac.character, 'longsword:mithril', r.body.quality, 'Silverthorn', r.body.seed]);
  const row = s.raw.prepare('SELECT * FROM products WHERE provenance = ?').get(provenance);
  assert.deepEqual([row.owner, row.char_id, row.maker, row.recipe, row.template, row.material, row.quality, row.record], [mac.id, mac.character, 'Silverthorn', 'longsword:mithril', 120, 5, r.body.quality, record]);
  const again = await s.call('/v1/prof/craft', body, mac.secret);
  assert.deepEqual([again.body.repeat, again.body.pieces[0].provenance, again.body.pieces[0].record], [true, provenance, record]);
  assert.equal(s.xpOf(mac), xpForRank(55) + 600, 'once');
  s.longswordInputs(mac);
  const second = await s.call('/v1/prof/craft', craft(mac, 'longsword:mithril'), mac.secret);
  assert.deepEqual([second.body.first, second.body.xp], [false, 100]);
  assert.notEqual(second.body.pieces[0].provenance, provenance, 'every piece its own id');
});

test('PROF3 service: the quality is the service\'s roll on the margin, then a step each for a clean act, the family\'s specialisation and a Warforged ingot - nothing past Masterwork; a Masterwright\'s points', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const at = async (recipe, b, extra = {}) => {
    const r = recipeById(recipe);
    for (const inp of r.inputs) s.give(mac, inp.key, 'own', inp.n);
    const res = await steered(b, () => s.call('/v1/prof/craft', craft(mac, recipe, extra), mac.secret));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body.quality;
  };
  s.setXp(mac, xpForRank(55));   // margin 0 on Mithril: Crude 20, Standard 60, Fine 20
  assert.equal(await at('longsword:mithril', 0x00), 0, 'the roll\'s bottom: Crude');
  assert.equal(await at('longsword:mithril', 0x01), 0);
  assert.equal(await at('longsword:mithril', 0xff), 2, 'its top: Fine');
  assert.equal(await at('longsword:mithril', 0x00, { clean: true }), 1, 'a clean act: one step');
  assert.equal(await at('longsword:mithril', 0x00, { clean: 'yes' }), 0, 'only a clean act that says true');
  s.setXp(mac, xpForRank(55), 'smithing', { spec50: 'weaponsmith' });
  assert.equal(await at('longsword:mithril', 0x00, { clean: true }), 2, 'Weaponsmith: the weapons a step more');
  assert.equal(await at('cuirass:mithril', 0x00, { clean: true }), 1, '...and not the armour');
  s.setXp(mac, xpForRank(55), 'smithing', { spec50: 'armoursmith' });
  assert.equal(await at('chain-helm:steel', 0x00), 3, 'Armoursmith: the chain too - Steel\'s margin 45 bottoms at Fine, a step past it');
  assert.equal(await at('buckler:mithril', 0xff, { clean: true }), 4, 'Fine and two steps: Masterwork');
  s.setXp(mac, xpForRank(100), 'smithing', { spec50: 'weaponsmith' });
  assert.equal(await at('longsword:warforged', 0xff, { clean: true }), 4, 'margin 30\'s top and three steps: nothing past Masterwork');
  assert.equal(await at('longsword:warforged', 0x00), 3, 'margin 30 bottoms at Standard; the family and the Warforged ingot, two steps');
  s.setXp(mac, xpForRank(100), 'smithing', { spec100: 'masterwright' });
  // margin 10 on Daedric: Standard 50 Fine 40 Superior 10 Masterwork 0, a Masterwright's 5 off the Standard
  assert.equal(await at('dagger:daedric', 0xff), 4, 'the top 5 points are Masterwork\'s');
});

test('PROF3 service: a craft refused - the rank, the inputs (naming the short one), the recipe; a kit takes no quality, a Quartermaster\'s is two pieces; the crafter\'s limit; the switch shut, a craft made answered after', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, xpForRank(55) - 1);
  s.longswordInputs(mac);
  assert.deepEqual((await s.call('/v1/prof/craft', craft(mac, 'longsword:mithril'), mac.secret)).body, { error: 'prof-rank' });
  s.setXp(mac, xpForRank(55));
  s.give(mac, 'leather:cured', 'own', 0);
  s.raw.prepare('DELETE FROM prof_stores WHERE material = ?').run('leather:cured');
  assert.deepEqual((await s.call('/v1/prof/craft', craft(mac, 'longsword:mithril'), mac.secret)).body, { error: 'stores-short' });
  assert.deepEqual(s.stores(mac, 'ingot:mithril'), [['own', 3]], 'nothing spent');
  assert.deepEqual((await s.call('/v1/prof/craft', craft(mac, 'staff:mithril'), mac.secret)).body, { error: 'bad-recipe' }, 'the Staff is a carpenter\'s');
  // the Repair Kit: no quality, and two for a Quartermaster
  s.give(mac, 'ingot:iron', 'own', 2);
  s.give(mac, 'leather:cured', 'own', 2);
  const kit = await s.call('/v1/prof/craft', craft(mac, 'kit:iron'), mac.secret);
  assert.deepEqual([kit.body.quality, kit.body.pieces.length], [-1, 1]);
  s.setXp(mac, xpForRank(100), 'smithing', { spec100: 'quartermaster' });
  const two = await s.call('/v1/prof/craft', craft(mac, 'kit:iron'), mac.secret);
  assert.deepEqual([two.body.quality, two.body.count, two.body.pieces.length], [-1, 2, 2]);
  assert.notEqual(two.body.pieces[0].provenance, two.body.pieces[1].provenance);
  assert.deepEqual(s.stores(mac, 'ingot:iron'), [], 'two kits, one ingot');
  assert.equal(readProductRecord(two.body.pieces[1].record).q, -1);
  // the crafter's limit: two crafts past Journeyman hold Smithing at 50
  // PIN MOVED (CRAFT3): Alchemy and Cooking are one track (Provisioning) - the two crafts past Journeyman are Provisioning and Building, seeded under the craft's id
  s.setXp(mac, xpForRank(60), 'provisioning');
  s.setXp(mac, xpForRank(60), 'building');
  s.setXp(mac, xpForRank(51) - 50);
  s.give(mac, 'ingot:iron', 'own', 1);
  s.give(mac, 'metal:tin', 'own', 1);
  const held = await s.call('/v1/prof/craft', craft(mac, 'dagger:iron'), mac.secret);
  assert.equal(held.status, 200, JSON.stringify(held.body));
  assert.deepEqual([held.body.xp, s.xpOf(mac), rankOfXp(s.xpOf(mac))], [49, xpForRank(51) - 1, 50], 'the XP credited is what the track took');
  const body = craft(mac, 'dagger:iron');
  s.give(mac, 'ingot:iron', 'own', 1);
  s.give(mac, 'metal:tin', 'own', 1);
  await s.call('/v1/prof/craft', body, mac.secret);
  s.env.PROFESSIONS_OPEN = 'off';
  assert.equal((await s.call('/v1/prof/craft', body, mac.secret)).body.repeat, true);
  assert.equal((await s.call('/v1/prof/craft', { ...body, rid: rid() }, mac.secret)).body.error, 'prof-closed');
});

// ─── THE SMITH'S STOCK ───────────────────────────────────────────────

test('PROF3 service: the smith\'s stock - the fittings into the Stores as bought units for Marks burnt, one `stock` line naming the material; asked twice one; the Marks short, the Stores full, a material not the stock\'s; the Stores withdraw none of it', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  assert.deepEqual(SMITH_STOCK.map((x) => [x.key, x.marks]), [['leather:cured', 4], ['plank:oak', 4], ['plank:pine', 2], ['wood:charcoal', 2]]);
  s.seedMarks(mac, 100);
  const body = { character: mac.character, material: 'leather:cured', qty: 5, rid: rid() };
  const r = await s.call('/v1/prof/stock', body, mac.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.qty, r.body.marks, r.body.balance, r.body.store], [5, 20, 80, { material: 'leather:cured', own: 0, bought: 5 }]);
  assert.deepEqual(s.stores(mac, 'leather:cured'), [['bought', 5]]);
  const line = s.raw.prepare('SELECT * FROM marks_ledger WHERE actor = ? AND rid = ?').get(mac.id, `${body.rid}:stock`);   // AUDIT 30 S1: the stock's own line, off the rid's namespace
  assert.deepEqual([line.src_kind, line.dst_kind, line.kind, line.amount, line.who], ['account', 'burn', 'stock', 20, 'leather:cured']);
  const again = await s.call('/v1/prof/stock', body, mac.secret);
  assert.deepEqual([again.body.repeat, s.balance(mac), s.stores(mac, 'leather:cured')], [true, 80, [['bought', 5]]], 'once');
  assert.deepEqual((await s.call('/v1/prof/stock', { ...body, rid: rid(), qty: 21 }, mac.secret)).body, { error: 'marks-short' });
  assert.deepEqual((await s.call('/v1/prof/stock', { ...body, rid: rid(), qty: STOCK_MAX + 1 }, mac.secret)).body, { error: 'bad-qty' });
  assert.deepEqual((await s.call('/v1/prof/stock', { ...body, rid: rid(), material: 'ingot:iron' }, mac.secret)).body, { error: 'bad-material' });
  s.give(mac, 'plank:oak', 'own', STORES_MAX);
  assert.deepEqual((await s.call('/v1/prof/stock', { ...body, rid: rid(), material: 'plank:oak', qty: 1 }, mac.secret)).body, { error: 'stores-full' });
  assert.equal(s.balance(mac), 80, 'nothing burnt for a refusal');
  // PROF7 moved it: Cured Leather has its template (665) - the Stores give it to the pack, bought units first
  const out = (await s.call('/v1/stores/withdraw', { character: mac.character, material: 'leather:cured', qty: 1, rid: rid() }, mac.secret)).body;
  assert.deepEqual([out.ok, out.qty, out.store], [true, 1, { material: 'leather:cured', own: 0, bought: 4 }]);
  // bought, and spent first: a Longsword of it is made
  s.setXp(mac, xpForRank(55));
  s.give(mac, 'ingot:mithril', 'own', 3);
  s.give(mac, 'metal:copper', 'own', 1);
  const sword = await s.call('/v1/prof/craft', craft(mac, 'longsword:mithril'), mac.secret);
  assert.equal(sword.status, 200, JSON.stringify(sword.body));
  assert.deepEqual(s.stores(mac, 'leather:cured'), [['bought', 3]]);
  s.env.MARKS_OPEN = 'off';
  assert.deepEqual((await s.call('/v1/prof/stock', { ...body, rid: rid(), qty: 1 }, mac.secret)).body, { error: 'marks-closed' });
});

// ─── A QUARTERMASTER'S SMELT ─────────────────────────────────────────

test('PROF3 service: a Quartermaster\'s smelt yields two ingots a unit (PROF0 3.3; FOUND unbuilt at PROF2) - the room counted for both, the XP the smelt\'s; Brass is a metal, not an ingot', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, xpForRank(100), 'smithing', { spec100: 'quartermaster' });
  s.give(mac, 'metal:iron', 'own', 6);
  const r = await s.call('/v1/prof/smelt', { character: mac.character, recipe: 'ingot:iron', count: 3, rid: rid() }, mac.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.count, r.body.own + r.body.bought], [3, 6]);
  assert.deepEqual(s.stores(mac, 'ingot:iron'), [['own', 6]]);
  s.give(mac, 'metal:copper', 'own', 1);
  s.give(mac, 'metal:tin', 'own', 1);
  const brass = await s.call('/v1/prof/smelt', { character: mac.character, recipe: 'metal:brass', count: 1, rid: rid() }, mac.secret);
  assert.deepEqual(s.stores(mac, 'metal:brass'), [['own', 1]], JSON.stringify(brass.body));
  s.give(mac, 'metal:iron', 'own', 2);
  s.give(mac, 'ingot:iron', 'own', STORES_MAX - 1);
  assert.deepEqual((await s.call('/v1/prof/smelt', { character: mac.character, recipe: 'ingot:iron', count: 1, rid: rid() }, mac.secret)).body, { error: 'stores-full' }, 'room for one, the smelt makes two');
  s.setXp(mac, xpForRank(100));
  assert.equal((await s.call('/v1/prof/smelt', { character: mac.character, recipe: 'ingot:iron', count: 1, rid: rid() }, mac.secret)).status, 200, 'without the choice, one');
});
