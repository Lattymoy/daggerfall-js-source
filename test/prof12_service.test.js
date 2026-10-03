// PROF12 (2026-10-02) - ALCHEMY AND THE ENCHANTING LAYER AS THE SERVICE KEEPS THEM: the brewing act (/v1/prof/brew) -
// DFU's own recipe law on the Stores' cauldron (POTION_RECIPES and its hash, imported), the ingredients out (bought first),
// the potions a rank brews, Potent rolled (the rank's chance, an unbruised herb's +5, a Distiller's, a Master Alchemist's
// +40%), Alchemy's XP and its first time's 500 (none for a cauldron wholly of the Apothecaries' goods); the herbs picked
// unbruised counted at the harvest and spent by a brew; the Apothecaries' counter; a Transmuter's transmutations at the
// station (the smelt's route); Disenchanting (/v1/prof/disenchant) - a crafted piece into Arcane Essence by its record's
// points, its origin, Enchanting's XP, the piece gone. Driven through the real Worker over node:sqlite with every
// migration applied (test/accountDb.mjs). bible/06-Systems/Professions-Arc.md 3.3, 4.3, 4.5, 9.3, 37.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from './accountDb.mjs';
import { xpForRank } from '../src/net/professionLaw.js';
import { FIRST_CRAFT_XP, recipeById } from '../src/net/recipeLaw.js';
import { herbPatches, nodeKey } from '../src/net/nodeLaw.js';
import { utcDay } from '../src/net/marksLaw.js';
import { ACCOUNT_VERSION } from '../server-account/src/service.js';
import { seatRealm, layRecord } from './realmSeat.mjs';   // AUDIT PROF-541 B2: a realm character's record
import { potionKeyFromCauldron } from '../src/systems/potionRecipes.js';
import { keyTemplate } from '../src/net/alchemyLaw.js';

const DAY = 86_400;
let _now = utcDay(T0) * DAY + 43_200;
const realNow = Date.now;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = () => `brew-${String(++_rid).padStart(6, '0')}`;
const realRandom = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
/** The service's dice steered: every four-byte draw (a unit's - professions.js dice) all `b` while `fn` runs. */
async function steered(b, fn) {
  globalThis.crypto.getRandomValues = (arr) => (arr.byteLength === 4 ? (new Uint8Array(arr.buffer, arr.byteOffset, 4).fill(b), arr) : realRandom(arr));
  try { return await fn(); } finally { globalThis.crypto.getRandomValues = realRandom; }
}
const HEALING = ['p1:16', 'reagent:troll-blood', 'reagent:elixir-vitae', 'metal:mercury'];

async function stand() {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const stores = (who, m) => raw.prepare('SELECT origin, qty FROM prof_stores WHERE player = ? AND char_id = ? AND material = ? AND qty > 0 ORDER BY origin').all(who.id, who.character, m).map((r) => [r.origin, Number(r.qty)]);
  const give = (who, m, origin, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(who.id, who.character, m, origin, qty);
  const xpOf = (who, prof) => Number(raw.prepare('SELECT xp FROM prof_tracks WHERE player = ? AND char_id = ? AND profession = ?').get(who.id, who.character, prof)?.xp ?? 0);
  const setXp = (who, prof, xp, { spec50 = null, spec100 = null } = {}) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, spec100, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp, spec50 = excluded.spec50, spec100 = excluded.spec100`)
    .run(who.id, who.character, prof, xp, spec50, spec100, _now);
  const brew = (who, potion, keys, extra = {}) => s.call('/v1/prof/brew', { character: who.character, potion, keys, rid: rid(), ...extra }, who.secret);
  /** a cauldron's goods given, each its own (or `origin`'s) one */
  const cauldron = (who, keys, origin = 'own') => { for (const k of keys) give(who, k, origin, 1 + (raw.prepare("SELECT qty FROM prof_stores WHERE player = ? AND char_id = ? AND material = ? AND origin = ?").get(who.id, who.character, k, origin)?.qty ?? 0)); };
  const unbruised = (who, m) => Number(raw.prepare('SELECT qty FROM prof_unbruised WHERE player = ? AND char_id = ? AND material = ?').get(who.id, who.character, m)?.qty ?? 0);
  const fund = (who, marks) => raw.prepare('INSERT INTO marks (account, balance) VALUES (?, ?) ON CONFLICT (account) DO UPDATE SET balance = excluded.balance').run(who.id, marks);
  const balance = (who) => Number(raw.prepare('SELECT balance FROM marks WHERE account = ?').get(who.id)?.balance ?? 0);
  const product = (p) => raw.prepare('SELECT * FROM products WHERE provenance = ?').get(p) ?? null;
  /** a piece made through the real craft route */
  const craft = async (who, recipe) => {
    for (const { key, n } of recipeById(recipe).inputs) give(who, key, 'own', n + (raw.prepare("SELECT qty FROM prof_stores WHERE player = ? AND char_id = ? AND material = ? AND origin = 'own'").get(who.id, who.character, key)?.qty ?? 0));
    const r = await s.call('/v1/prof/craft', { character: who.character, recipe, clean: false, name: 'Silverthorn', rid: rid() }, who.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body.pieces[0].provenance;
  };
  const disenchant = (who, provenance, id = rid()) => s.call('/v1/prof/disenchant', { character: who.character, provenance, rid: id }, who.secret);
  return { ...s, raw, stores, give, xpOf, setXp, brew, cauldron, unbruised, fund, balance, product, craft, disenchant };
}

// ─── THE BREW (9.3) ──────────────────────────────────────────────────

test('PROF12 service: a Healing brewed at rank 0 - DFU\'s own recipe law on the Stores\' cauldron (any order), its four out (bought first), one potion, never Potent at Novice; 20 XP and the first time\'s 500, credited; asked twice one, nothing moved; the next no 500; short; another cauldron, another size or a key no Stores hold refused (bad-brew), nothing spent', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.cauldron(mac, HEALING, 'own');
  s.cauldron(mac, HEALING, 'own');
  s.give(mac, 'p1:16', 'bought', 1);
  const ask = { character: mac.character, potion: 'healing', keys: HEALING, rid: rid() };
  const r = await steered(0x00, () => s.call('/v1/prof/brew', ask, mac.secret));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.potion, r.body.count, r.body.potent, r.body.unbruised, r.body.steps, r.body.first, r.body.xp], ['healing', 1, 0, 0, 0, true, 20 + FIRST_CRAFT_XP], 'Novice: one potion, the lowest roll never Potent');
  assert.deepEqual([r.body.track.profession, r.body.track.xp, s.xpOf(mac, 'alchemy')], ['alchemy', 520, 520]);
  assert.deepEqual(r.body.keys, HEALING);
  assert.deepEqual([s.stores(mac, 'p1:16'), s.stores(mac, 'metal:mercury')], [[['own', 2]], [['own', 1]]], 'the bought Red Berries spent first');
  assert.deepEqual(r.body.stores.map((st) => st.material).sort(), [...HEALING].sort());
  s.env.PROFESSIONS_OPEN = 'off';
  const again = await s.call('/v1/prof/brew', ask, mac.secret);
  assert.deepEqual([again.body.repeat, again.body.xp, again.body.count], [true, 520, 1], 'asked twice: the row\'s answer - looked for before the switch (AUDIT 28 M2\'s rule)');
  assert.deepEqual((await s.brew(mac, 'healing', HEALING)).body, { error: 'prof-closed' }, 'a new brew under a shut switch');
  s.env.PROFESSIONS_OPEN = 'on';
  assert.deepEqual([s.stores(mac, 'metal:mercury'), s.xpOf(mac, 'alchemy')], [[['own', 1]], 520], 'nothing moved twice');
  const shuffled = await s.brew(mac, 'healing', [HEALING[3], HEALING[1], HEALING[0], HEALING[2]]);
  assert.deepEqual([shuffled.status, shuffled.body.first, shuffled.body.xp], [200, false, 20], 'DFU sorts the cauldron: any order; the second no 500');
  assert.deepEqual((await s.brew(mac, 'healing', HEALING)).body, { error: 'stores-short' }, 'the Red Berries\' own one left, the Troll\'s Blood none');
  s.cauldron(mac, HEALING, 'own');
  for (const keys of [['p1:9', ...HEALING.slice(1)], HEALING.slice(1), [...HEALING, 'metal:mercury'], ['metal:nope', ...HEALING.slice(1)], 'p1:16']) {
    const bad = await s.brew(mac, 'healing', keys);
    assert.deepEqual([bad.status, bad.body], [400, { error: 'bad-brew' }], JSON.stringify(keys));
  }
  assert.deepEqual((await s.brew(mac, 'elixir', HEALING)).body, { error: 'bad-recipe' });
  assert.deepEqual([s.stores(mac, 'metal:mercury'), s.raw.prepare('SELECT COUNT(*) AS n FROM prof_brews').get().n], [[['own', 1]], 2], 'refused before anything moved');
  // GOLD-MARKET: what gold bought takes no station
  s.give(mac, 'p1:16', 'own', 0);
  s.raw.prepare("DELETE FROM prof_stores WHERE player = ? AND material = 'p1:16'").run(mac.id);
  s.give(mac, 'p1:16', 'gold', 1);
  assert.deepEqual((await s.brew(mac, 'healing', HEALING)).body, { error: 'stores-gold' });
  assert.match(ACCOUNT_VERSION, /^acct71$/   /* PIN MOVED (AUDIT PROF-541, the arena merge's acct71): the live version */);
});

test('PROF12 service: the alchemist\'s ladder asked (Invisibility at 70, refused below, nothing spent); a brew\'s potions - 2 at Journeyman, a Brewer\'s 3, 3 at Master; Potent at Expert\'s 10% (the roll under it Potent, at it plain), a Distiller\'s +10 at 50, a Master Alchemist\'s +40% share; no 500 for a cauldron wholly of the Apothecaries\' goods', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const INVIS = ['gem:diamond', 'reagent:ectoplasm', 'reagent:rain-water', 'reagent:nectar'];
  s.cauldron(mac, INVIS);
  s.setXp(mac, 'alchemy', xpForRank(69));
  assert.deepEqual((await s.brew(mac, 'invisibility', INVIS)).body, { error: 'prof-rank' });
  assert.deepEqual(s.stores(mac, 'gem:diamond'), [['own', 1]], 'refused before anything moved');
  s.setXp(mac, 'alchemy', xpForRank(70));
  const inv = await steered(0xff, () => s.brew(mac, 'invisibility', INVIS));
  assert.deepEqual([inv.status, inv.body.count, inv.body.potent, inv.body.xp], [200, 2, 0, 120 + FIRST_CRAFT_XP], 'tier 6: 120, and two potions past Journeyman');
  const plain = async (spec50 = null, spec100 = null, rank = 50) => {
    s.setXp(mac, 'alchemy', xpForRank(rank), { spec50, spec100 });
    s.cauldron(mac, HEALING);
    return s.brew(mac, 'healing', HEALING);
  };
  assert.equal((await steered(0xff, () => plain())).body.count, 2, 'Journeyman: two');
  assert.equal((await steered(0xff, () => plain('brewer'))).body.count, 3, 'a Brewer: three at Journeyman');
  assert.equal((await steered(0xff, () => plain(null, null, 100))).body.count, 3, 'a Master: three');
  assert.equal((await steered(0x00, () => plain(null, null, 74))).body.potent, 0, 'below Expert: no chance at all');
  assert.equal((await steered(0x19, () => plain(null, null, 75))).body.potent, 25, 'Expert\'s 10: a roll of 9.8 Potent');
  assert.equal((await steered(0x1a, () => plain(null, null, 75))).body.potent, 0, 'a roll of 10.2 plain');
  assert.equal((await steered(0x19, () => plain('distiller', null, 50))).body.potent, 25, 'a Distiller\'s 10 at Journeyman');
  assert.equal((await steered(0x19, () => plain(null, null, 50))).body.potent, 0, 'a Journeyman who is none: no chance');
  assert.equal((await steered(0x34, () => plain(null, null, 100))).body.potent, 0, 'Master\'s 20: a roll of 20.3 plain');
  assert.equal((await steered(0x32, () => plain(null, null, 100))).body.potent, 25, 'a roll of 19.5 Potent - at +25%');
  assert.equal((await steered(0x00, () => plain(null, 'master-alchemist', 100))).body.potent, 40, 'a Master Alchemist\'s +40%');
  const LEVIT = ['reagent:ectoplasm', 'reagent:pure-water', 'reagent:nectar'];
  s.setXp(mac, 'alchemy', xpForRank(40));
  s.cauldron(mac, LEVIT, 'bought');
  const lev = await s.brew(mac, 'levitation', LEVIT);
  assert.deepEqual([lev.status, lev.body.first, lev.body.xp], [200, false, 80], 'the counter\'s goods alone: tier 4\'s 80 and no 500 (AUDIT 32 S1\'s law) - and not called the first (AUDIT PROF-541 B6: as smeltAtForge\'s)');
  assert.equal(s.raw.prepare("SELECT first FROM prof_brews WHERE potion = 'levitation'").get().first, 0, 'nor stored so');
  // AUDIT PROF-541 R2-S1: the counter's goods alone brew ONE, whatever the rank or the Brewer - the Apothecaries' silver is
  // no gold past the Bank; a cauldron with a gathered herb still the rank's
  s.setXp(mac, 'alchemy', xpForRank(100), { spec50: 'brewer' });
  s.cauldron(mac, LEVIT, 'bought');
  const lev3 = await s.brew(mac, 'levitation', LEVIT);
  assert.deepEqual([lev3.status, lev3.body.count], [200, 1], 'a Master Brewer: one Levitation');
  const WATER = ['reagent:rain-water', 'reagent:elixir-vitae', 'reagent:ivory'];
  s.cauldron(mac, WATER, 'bought');
  const wb = await s.brew(mac, 'waterBreathing', WATER);
  assert.deepEqual([wb.status, wb.body.count], [200, 1], 'nor three Water Breathing');
  assert.equal((await steered(0xff, () => plain('brewer', null, 100))).body.count, 3, 'a Healing: the Master\'s three still');
});

// ─── THE UNBRUISED HERB (4.3, 5.2) ───────────────────────────────────

/** The first Swamp patch of tier 2 (its Bamboo - T0's day is winter) along a row from `from`. */
function bambooPatch(from = 300) {
  for (let x = from; x < 700; x++) {
    const p = herbPatches({ x, y: 200, day: utcDay(_now), climate: 228, confirmed: false }).find((q) => q.tier === 2);
    if (p) return { x, y: 200, climate: 228, ...p };
  }
  throw new Error('no patch');
}
const pick = (s, who, p, act) => s.call('/v1/prof/harvest', {
  character: who.character, node: nodeKey({ kind: 'herb', x: p.x, y: p.y, day: utcDay(_now), slot: p.slot }), kind: 'herbs',
  climate: p.climate, region: 21, act, at: _now - 2, rid: rid(),
}, who.secret);

test('PROF12 service: an herb picked unbruised is counted beside the Stores (a bruised one is not); a Free Action brewed of a BOUGHT Bamboo reckons none, of its own unbruised Bamboo one - +5% Potent, the roll of 13 Potent at Expert\'s 10 - and the count spent with it', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, 'herbalism', xpForRank(10));
  const p = bambooPatch();
  const clean = await pick(s, mac, p, { clean: true, bruised: false });
  assert.equal(clean.status, 200, JSON.stringify(clean.body));
  const got = clean.body.qty ?? s.stores(mac, 'p2:28')[0][1];
  assert.equal(s.unbruised(mac, 'p2:28'), got, 'the herb\'s units, counted unbruised');
  const bruised = await pick(s, mac, bambooPatch(p.x + 1), { clean: false, bruised: true });
  assert.equal(bruised.status, 200, JSON.stringify(bruised.body));
  assert.equal(s.unbruised(mac, 'p2:28'), got, 'a bruised herb is not');
  const FREE = ['p1:8', 'p2:28', 'part:venom', 'reagent:ichor'];
  s.setXp(mac, 'alchemy', xpForRank(75));
  s.give(mac, 'p2:28', 'bought', 1);
  s.cauldron(mac, ['p1:8', 'part:venom', 'reagent:ichor']);
  const boughtBrew = await steered(0x22, () => s.brew(mac, 'freeAction', FREE));
  assert.deepEqual([boughtBrew.status, boughtBrew.body.unbruised, boughtBrew.body.potent], [200, 0, 0], 'the bought Bamboo spent first: nobody\'s steady hand');
  assert.equal(s.unbruised(mac, 'p2:28'), got, 'nothing reckoned, nothing spent');
  s.cauldron(mac, ['p1:8', 'part:venom', 'reagent:ichor']);
  const own = await steered(0x22, () => s.brew(mac, 'freeAction', FREE));
  assert.deepEqual([own.status, own.body.unbruised, own.body.potent], [200, 1, 25], 'its own unbruised Bamboo: 10 + 5 - the roll of 13.3 Potent');
  assert.equal(s.unbruised(mac, 'p2:28'), got - 1, 'the count spent with it');
});

// ─── THE APOTHECARIES' COUNTER (4.5) AND THE TRANSMUTER (3.3) ────────

test('PROF12 service: the Apothecaries\' counter sells its sixteen into the Stores, bought, for silver burnt (Ichor 4 a measure, Unicorn Horn 40); a Transmuter\'s two Tin and a Mercury make one Copper at the station (AUDIT PROF12 E3; bought in, bought out; no XP) - refused to all others (403, nothing spent)', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.fund(mac, 100);
  const ichor = await s.call('/v1/prof/stock', { character: mac.character, material: 'reagent:ichor', qty: 3, rid: rid() }, mac.secret);
  assert.equal(ichor.status, 200, JSON.stringify(ichor.body));
  assert.deepEqual([ichor.body.marks, ichor.body.balance, s.stores(mac, 'reagent:ichor')], [12, 88, [['bought', 3]]]);
  const horn = await s.call('/v1/prof/stock', { character: mac.character, material: 'reagent:unicorn-horn', qty: 2, rid: rid() }, mac.secret);
  assert.deepEqual([horn.status, horn.body.marks, s.balance(mac)], [200, 80, 8]);
  const smelt = (count = 1) => s.call('/v1/prof/smelt', { character: mac.character, recipe: 'transmute:tin', count, rid: rid() }, mac.secret);
  s.give(mac, 'metal:tin', 'own', 4);
  s.give(mac, 'metal:mercury', 'own', 2);
  s.setXp(mac, 'alchemy', xpForRank(100), { spec100: 'master-alchemist' });
  const no = await smelt();
  assert.deepEqual([no.status, no.body], [403, { error: 'prof-transmuter' }]);
  assert.deepEqual([s.stores(mac, 'metal:tin'), s.stores(mac, 'metal:mercury')], [[['own', 4]], [['own', 2]]], 'nothing spent');
  s.setXp(mac, 'alchemy', xpForRank(100), { spec100: 'transmuter' });
  const yes = await smelt();
  assert.equal(yes.status, 200, JSON.stringify(yes.body));
  assert.deepEqual([yes.body.own, yes.body.bought, yes.body.xp, yes.body.track], [1, 0, 0, null]);
  assert.deepEqual([s.stores(mac, 'metal:tin'), s.stores(mac, 'metal:mercury'), s.stores(mac, 'metal:copper')], [[['own', 2]], [['own', 1]], [['own', 1]]], 'two Tin and a Mercury: one Copper');
  s.give(mac, 'metal:mercury', 'bought', 1);
  const b = await smelt();
  assert.deepEqual([b.body.own, b.body.bought, s.stores(mac, 'metal:copper')], [0, 1, [['bought', 1], ['own', 1]]], 'a bought Mercury: a bought Copper');
  assert.deepEqual((await smelt()).body, { error: 'stores-short' });
});

// ─── DISENCHANTING (9.3) ─────────────────────────────────────────────

test('PROF12 service: a Gold Ruby Ring disenchanted - its record\'s 2,160 points 21 Arcane Essence, own (its maker\'s, never sold), Enchanting XP 5 x 3 x 21 (the ring\'s tier - AUDIT PROF12 E2); the piece\'s row gone; asked twice one; asked again under a new id, no piece; a Disenchanter\'s twice and the same 5 x 3 x 21 at 50', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, 'jewelcrafting', xpForRank(25));
  const pv = await s.craft(mac, 'ring:gold:ruby');
  const id = rid();
  const r = await s.disenchant(mac, pv, id);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.provenance, r.body.recipe, r.body.points, r.body.essence, r.body.origin, r.body.xp], [pv, 'ring:gold:ruby', 2160, 21, 'own', 315]);
  assert.deepEqual([r.body.track.profession, r.body.track.xp, r.body.store], ['enchanting', 315, { material: 'essence:arcane', own: 21, bought: 0 }]);
  assert.equal(s.product(pv), null, 'the piece is gone');
  const again = await s.disenchant(mac, pv, id);
  assert.deepEqual([again.body.repeat, again.body.essence, s.stores(mac, 'essence:arcane'), s.xpOf(mac, 'enchanting')], [true, 21, [['own', 21]], 315]);
  const gone = await s.disenchant(mac, pv);
  assert.deepEqual([gone.status, gone.body], [404, { error: 'prof-no-piece', why: 'disenchanted' }], 'AUDIT PROF-541 B2: this account\'s disenchant took it - a save that kept it lets it go');
  const ann = await s.registered('Ann');
  assert.deepEqual((await s.disenchant(ann, pv)).body, { error: 'prof-no-piece' }, 'another account is told nothing of it');
  s.setXp(mac, 'enchanting', xpForRank(50), { spec50: 'disenchanter' });
  const pv2 = await s.craft(mac, 'ring:gold:ruby');
  const d = await s.disenchant(mac, pv2);
  assert.deepEqual([d.body.essence, d.body.xp, s.stores(mac, 'essence:arcane')], [42, 315, [['own', 63]]], 'a Disenchanter\'s two an Essence; XP on the one, the piece\'s tier');
  // a Gemcutter's gemmed ring carries its hand's points (+30%: 2,340) into the disenchant, from the service's own row
  s.setXp(mac, 'jewelcrafting', xpForRank(50), { spec50: 'gemcutter' });
  const cut = await s.craft(mac, 'ring:gold:ruby');
  s.setXp(mac, 'enchanting', 0);
  const g = await s.disenchant(mac, cut);
  assert.deepEqual([g.body.points, g.body.essence], [2340, 23], 'the jeweller\'s hand read off the piece');
  // ONE disenchant a piece, whatever came before it: the row's provenance is UNIQUE
  assert.throws(() => s.raw.prepare(`INSERT INTO prof_disenchants (player, rid, char_id, provenance, recipe, points, essence, origin, xp, at, n)
    VALUES (?, 'again-000001', ?, ?, 'ring:gold:ruby', 2160, 21, 'own', 0, 1, 'x')`).run(mac.id, mac.character, pv), /UNIQUE/);
});

test('PROF12 service: what may not be disenchanted - another\'s piece (403), a listed one (409), a piece too thin for an Essence - a dish (409), arrows (409, AUDIT PROF-541 R2-S6), a bad id (400) - nothing moved; a piece bought for silver gives bought Essence, one bought with gold gold\'s', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const ann = await s.registered('Ann');
  s.setXp(mac, 'jewelcrafting', xpForRank(25));
  const mine = await s.craft(mac, 'ring:gold:ruby');
  const hers = await s.disenchant(ann, mine);
  assert.deepEqual([hers.status, hers.body], [403, { error: 'prof-not-yours' }]);
  s.raw.prepare('UPDATE products SET listed = 1 WHERE provenance = ?').run(mine);
  const listed = await s.disenchant(mac, mine);
  assert.deepEqual([listed.status, listed.body], [409, { error: 'prof-piece-busy' }]);
  assert.notEqual(s.product(mine), null, 'still there');
  s.raw.prepare('UPDATE products SET listed = 0 WHERE provenance = ?').run(mine);
  const stew = await s.craft(mac, 'stew:north');
  const dish = await s.disenchant(mac, stew);
  assert.deepEqual([dish.status, dish.body], [409, { error: 'prof-no-essence' }]);
  // AUDIT PROF-541 R2-S6: arrows - a quiver's stack with no provenance in the pack, which the market lists not - make no Essence
  const quiver = await s.craft(mac, 'arrows:north');
  const arrows = await s.disenchant(mac, quiver);
  assert.deepEqual([arrows.status, arrows.body], [409, { error: 'prof-no-essence' }], 'arrows: 150 points, refused all the same');
  assert.notEqual(s.product(quiver), null, 'the arrows\' row kept');
  assert.deepEqual((await s.disenchant(mac, 'not-a-piece')).body, { error: 'bad-piece' });
  assert.deepEqual([s.stores(mac, 'essence:arcane'), s.xpOf(mac, 'enchanting')], [[], 0], 'nothing moved');
  s.raw.prepare("UPDATE products SET bought_with = 'marks' WHERE provenance = ?").run(mine);
  assert.equal((await s.disenchant(mac, mine)).body.origin, 'bought');
  const theirs = await s.craft(mac, 'ring:gold:ruby');
  s.raw.prepare("UPDATE products SET char_id = 'char-another' WHERE provenance = ?").run(theirs);
  assert.equal((await s.disenchant(mac, theirs)).body.origin, 'bought', 'another character\'s make, never sold: bought - own is the maker\'s alone');
  const other = await s.craft(mac, 'ring:gold:ruby');
  s.raw.prepare("UPDATE products SET bought_with = 'gold' WHERE provenance = ?").run(other);
  assert.equal((await s.disenchant(mac, other)).body.origin, 'gold');
  assert.deepEqual(s.stores(mac, 'essence:arcane'), [['bought', 42], ['gold', 21]]);
});

// ─── AUDIT PROF12 (2026-10-03): E1, E2, A1 ───────────────────────────

const DF = 17;
const HUBS = { [DF]: [207, 212] };

test('AUDIT PROF12 E1 service: Arcane Essence never leaves the Stores for the pack - the withdrawal refused (409 prof-no-pack-form) whatever its origin, nothing moved; a reagent of the same family still withdraws', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.give(mac, 'essence:arcane', 'own', 18);
  s.give(mac, 'essence:arcane', 'bought', 2);
  for (const qty of [1, 18, 20]) {
    const w = await s.call('/v1/stores/withdraw', { character: mac.character, material: 'essence:arcane', qty, rid: rid() }, mac.secret);
    assert.deepEqual([w.status, w.body], [409, { error: 'prof-no-pack-form' }], `${qty}`);
  }
  assert.deepEqual(s.stores(mac, 'essence:arcane'), [['bought', 2], ['own', 18]], 'nothing moved');
  s.give(mac, 'reagent:ichor', 'bought', 2);
  const ok = await s.call('/v1/stores/withdraw', { character: mac.character, material: 'reagent:ichor', qty: 2, rid: rid() }, mac.secret);
  assert.deepEqual([ok.status, ok.body.qty, s.stores(mac, 'reagent:ichor')], [200, 2, []], 'the Apothecaries\' goods are DFU\'s own ingredients, and go');
});

test('AUDIT PROF12 E2 service: a disenchant\'s Enchanting XP is the PIECE\'s tier - a Silver Ring\'s tier 1, quartered at Enchanting 40 (the rank\'s own tier 4 was four times it); Linen Plain Robes, made wholly of the counter\'s goods, give their Essence and no XP', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, 'enchanting', xpForRank(39));
  const a = await s.disenchant(mac, await s.craft(mac, 'ring:silver'));
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.ok(a.body.essence > 0);
  assert.equal(a.body.xp, 5 * 1 * a.body.essence, 'rank 39 works tier 3: tier 1 is not more than two below');
  s.setXp(mac, 'enchanting', xpForRank(40));
  const b = await s.disenchant(mac, await s.craft(mac, 'ring:silver'));
  assert.deepEqual([b.body.essence, b.body.xp], [a.body.essence, Math.floor((5 * 1 * a.body.essence) / 4)], 'rank 40 works tier 4: a tier-1 piece quartered');
  s.setXp(mac, 'enchanting', 0);
  const robes = await s.disenchant(mac, await s.craft(mac, 'garment-163:linen'));
  assert.equal(robes.status, 200, JSON.stringify(robes.body));
  assert.deepEqual([robes.body.essence, robes.body.xp, s.xpOf(mac, 'enchanting')], [7, 0, 0], 'the counter\'s Linen buys Essence, never Enchanting');
  assert.deepEqual(s.stores(mac, 'essence:arcane'), [['own', 2 * a.body.essence + 7]]);
});

test('AUDIT PROF12 A1 service: the unbruised count never outlives its herbs - a withdrawal to the pack, a dish\'s craft and a market listing each clamp it to the own units left, so a later bruised herb is never reckoned unbruised; a brew still reckons and spends its own', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const setUnbruised = (m, q) => s.raw.prepare('INSERT INTO prof_unbruised (player, char_id, material, qty) VALUES (?, ?, ?, ?) ON CONFLICT (player, char_id, material) DO UPDATE SET qty = excluded.qty').run(mac.id, mac.character, m, q);
  // the audit's probe: one herb picked unbruised, withdrawn - then a bruised one brewed
  s.give(mac, 'p1:16', 'own', 1); setUnbruised('p1:16', 1);
  const w = await s.call('/v1/stores/withdraw', { character: mac.character, material: 'p1:16', qty: 1, rid: rid() }, mac.secret);
  assert.equal(w.status, 200, JSON.stringify(w.body));
  assert.equal(s.unbruised(mac, 'p1:16'), 0, 'the withdrawal took the count with the herb');
  s.cauldron(mac, HEALING, 'own');
  const b = await s.brew(mac, 'healing', HEALING);
  assert.deepEqual([b.status, b.body.unbruised], [200, 0], 'a bruised herb is not reckoned unbruised');
  // a dish's craft (spendStatements): two unbruised Root Bulbs, one cooked - one left, and its count
  s.give(mac, 'p1:13', 'own', 1); setUnbruised('p1:13', 2);
  await s.craft(mac, 'stew:north');   // gives one more Root Bulb and cooks one
  assert.deepEqual([s.stores(mac, 'p1:13'), s.unbruised(mac, 'p1:13')], [[['own', 1]], 1]);
  // a market listing of own herbs
  s.fund(mac, 100);
  s.give(mac, 'p1:9', 'own', 3); setUnbruised('p1:9', 3);
  const l = await s.call('/v1/market/list', { character: mac.character, region: DF, kind: 'material', material: 'p1:9', units: 2, price: 5, hubs: HUBS, rid: rid() }, mac.secret);
  assert.equal(l.status, 200, JSON.stringify(l.body));
  assert.deepEqual([s.stores(mac, 'p1:9'), s.unbruised(mac, 'p1:9')], [[['own', 1]], 1], 'listed: two gone, one unbruised left');
  // a brew of two own unbruised: it reckons one, spends one, and the count is the other's
  s.give(mac, 'p1:16', 'own', 2); setUnbruised('p1:16', 2);
  for (const k of HEALING.slice(1)) s.give(mac, k, 'own', 1);
  const c = await s.brew(mac, 'healing', HEALING);
  assert.deepEqual([c.status, c.body.unbruised, s.unbruised(mac, 'p1:16'), s.stores(mac, 'p1:16')], [200, 1, 1, [['own', 1]]], 'reckoned before the spends: the count is the herb still held');
});

// ─── AUDIT PROF-541 (2026-10-03): B1, B2, B3, B5, B6, B7 ─────────────

test('AUDIT PROF-541 B1/B3 service: a cauldron whose templates only COLLIDE with a recipe\'s hash is refused (Purification of Jade for its Diamond - bad-brew, nothing spent); a Cure of DFU\'s default magnitude is never Potent at the roll that makes a Purification Potent', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, 'alchemy', xpForRank(100));
  const JADE = ['gem:jade', 'p1:9', 'p1:17', 'p2:27', 'reagent:werewolf-blood', 'reagent:rain-water', 'reagent:elixir-vitae', 'reagent:nectar'];
  const PURE = ['gem:diamond', 'p2:31', 'reagent:ectoplasm', 'reagent:mummy-wrappings', 'part:tooth', 'reagent:rain-water', 'reagent:elixir-vitae', 'reagent:nectar'];
  assert.equal(potionKeyFromCauldron(JADE.map(keyTemplate)), potionKeyFromCauldron(PURE.map(keyTemplate)), 'DFU\'s hash: the same key');
  s.cauldron(mac, JADE);
  const bad = await s.brew(mac, 'purification', JADE);
  assert.deepEqual([bad.status, bad.body], [400, { error: 'bad-brew' }]);
  assert.deepEqual([s.stores(mac, 'gem:jade'), s.raw.prepare('SELECT COUNT(*) AS n FROM prof_brews').get().n], [[['own', 1]], 0], 'nothing spent');
  s.cauldron(mac, PURE);
  const pure = await steered(0x00, () => s.brew(mac, 'purification', PURE));
  assert.deepEqual([pure.status, pure.body.potent], [200, 25], 'the Master\'s 20: the lowest roll Potent');
  const CURE = ['p2:31', 'part:tooth', 'reagent:elixir-vitae'];
  s.cauldron(mac, CURE);
  const cure = await steered(0x00, () => s.brew(mac, 'cureDisease', CURE));
  assert.deepEqual([cure.status, cure.body.potent, cure.body.count], [200, 0, 3], 'an instant cure: never Potent');
});

test('AUDIT PROF-541 B2 service: a realm character\'s piece leaves its RECORD with the disenchant - `realm` asked first (realm-needed without it), refused where the record does not hold it loose (traded away, worn: prof-piece-gone, nothing moved), taken out of the record at the next sequence in the disenchant\'s own batch; a stale record refused `seq` with the service\'s own; and a deleted realm character\'s unbruised count goes with it (B5)', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, 'jewelcrafting', xpForRank(25));
  const pv = await s.craft(mac, 'ring:gold:ruby');
  const worn = await s.craft(mac, 'ring:gold:ruby');
  const away = await s.craft(mac, 'ring:gold:ruby');
  const ring = (p, extra = {}) => ({ group: 'Jewellery', templateIndex: 135, provenance: p, recipe: 'ring:gold:ruby', name: 'Gold Ruby Ring', ...extra });
  const R = await seatRealm(s.env, mac.secret, 'Mac', { name: 'Mac', level: 9, goldPieces: 100, items: [ring(pv), { templateIndex: 1, name: 'Torch' }, ring(worn, { equipSlot: 3 })], lightSourceIndex: 1 });
  const rmac = { ...mac, character: R.id };
  const ask = (p, extra = {}) => s.call('/v1/prof/disenchant', { character: R.id, provenance: p, rid: rid(), ...extra }, mac.secret);
  const record = () => JSON.parse(new TextDecoder().decode(s.env.SAVES._map.get(s.raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(R.id).obj)));
  assert.deepEqual(Object.values(await ask(pv)), [400, { error: 'realm-needed' }]);
  for (const p of [away, worn]) {
    const no = await ask(p, { realm: R.at() });
    assert.deepEqual([no.status, no.body], [409, { error: 'prof-piece-gone' }], p === away ? 'sold to a shop, traded away: the record holds it no more' : 'worn');
    assert.notEqual(s.product(p), null, 'the piece\'s row stands');
  }
  s.raw.prepare('UPDATE products SET listed = 1 WHERE provenance = ?').run(pv);
  const busy = await ask(pv, { realm: R.at() });
  assert.deepEqual([busy.status, busy.body, R.at().seq, record().items.length], [409, { error: 'prof-piece-busy' }, 1, 3], 'no disenchant, no piece out of the record: its step rolled back with it');
  s.raw.prepare('UPDATE products SET listed = 0 WHERE provenance = ?').run(pv);
  const was = R.at();
  assert.deepEqual([was.seq, s.stores(rmac, 'essence:arcane')], [1, []], 'nothing moved');
  const ok = await ask(pv, { realm: was });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.deepEqual([ok.body.essence, ok.body.origin, ok.body.realm, R.at().seq, s.product(pv)], [21, 'bought', { seq: 2 }, 2, null], 'its row gone, its record one on - the Essence bought: another character made it');
  const rec = record();
  assert.deepEqual([rec.items.map((it) => it.provenance ?? it.name), rec.lightSourceIndex], [['Torch', worn], 0], 'out of the record - the lit Torch followed to where it stands');
  assert.deepEqual(s.stores(rmac, 'essence:arcane'), [['bought', 21]]);
  const stale = await ask(away, { realm: was });
  assert.deepEqual([stale.status, stale.body], [409, { error: 'seq', seq: 2 }], 'the record asked first: the service\'s own sequence');
  // B5: the character deleted - its unbruised count with its Stores
  s.raw.prepare('INSERT INTO prof_unbruised (player, char_id, material, qty) VALUES (?, ?, ?, ?)').run(mac.id, R.id, 'p1:16', 2);
  const del = await s.call('/v1/realm/delete', { id: R.id }, mac.secret);
  assert.equal(del.status, 200, JSON.stringify(del.body));
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM prof_unbruised WHERE char_id = ?').get(R.id).n, 0);
});

test('AUDIT PROF-541 B2 service: a crafted piece set down in a home stands with its provenance only while its row still bears it out - a disenchant landing between the read and the placement refuses it (bad-decor), nothing stands', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const HOME = { mapId: 1291010263, buildingKey: 0x10203 };
  const house = await s.seatHome(mac, { ...HOME, region: 17, price: 42000 });
  assert.equal(house.status, 200, JSON.stringify(house.body));
  s.setXp(mac, 'jewelcrafting', xpForRank(25));
  const pv = await s.craft(mac, 'ring:gold:ruby');
  const piece = (id, p) => ({ id, model: null, flat: [254, 1], pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0, item: { t: 135, g: 4, pv: p } });
  const pv2 = await s.craft(mac, 'ring:gold:ruby');
  const fine = await s.call('/v1/homes/decor/place', { ...HOME, character: house.character, piece: piece('rg2', pv2) }, mac.secret);
  assert.deepEqual([fine.status, fine.body.piece?.item?.pv], [200, pv2], 'no race: it stands, its provenance kept');
  const real = s.env.DB.prepare.bind(s.env.DB);
  s.env.DB.prepare = (sql) => { if (/INSERT OR IGNORE INTO home_decor/.test(sql)) s.raw.prepare('DELETE FROM products WHERE provenance = ?').run(pv); return real(sql); };
  try {
    const r = await s.call('/v1/homes/decor/place', { ...HOME, character: house.character, piece: piece('rg1', pv) }, mac.secret);
    assert.deepEqual([r.status, r.body], [400, { error: 'bad-decor' }]);
  } finally { s.env.DB.prepare = real; }
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM home_decor WHERE id = 'rg1'").get().n, 0, 'nothing stands');
});

test('AUDIT PROF-541 B7 service: a piece made of BOUGHT goods is bought - Linen Plain Robes of the counter\'s Linen recorded bought with Drakes (products.bought_with), so its disenchant\'s Essence is bought, never own (GOLD-MARKET\'s wall); one bought unit among own ones makes it so; robes of own Linen stay own', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const robes = async (own, bought) => {
    s.raw.prepare("DELETE FROM prof_stores WHERE player = ? AND material = 'cloth:linen'").run(mac.id);
    if (own) s.give(mac, 'cloth:linen', 'own', own);
    if (bought) s.give(mac, 'cloth:linen', 'bought', bought);
    const r = await s.call('/v1/prof/craft', { character: mac.character, recipe: 'garment-163:linen', clean: false, name: 'Mac', rid: rid() }, mac.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body.pieces[0].provenance;
  };
  const counter = await robes(0, 3);
  assert.equal(s.product(counter).bought_with, 'marks', 'the counter\'s Linen, bought with Drakes');
  const d = await s.disenchant(mac, counter);
  assert.deepEqual([d.status, d.body.origin, s.stores(mac, 'essence:arcane')], [200, 'bought', [['bought', 7]]], 'bought Essence - it lists for gold no more');
  const mixed = await robes(2, 1);
  assert.equal(s.product(mixed).bought_with, 'marks', 'one bought unit, spent first');
  const own = await robes(3, 0);
  assert.equal(s.product(own).bought_with, null);
  assert.equal((await s.disenchant(mac, own)).body.origin, 'own');
});
