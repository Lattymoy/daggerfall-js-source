// CRAFT-PROCS (FIELD BUGS 2026-10-13e, a player, "Boar": "New affixes on crafted items - Added potency and cast speed,
// cast cost affixes are not rolling on crafted jewelry").
//
// Every line that DOES something - LOOT4's proc kinds: a jewel's focus ("cast cost"), castSpeed, potency and wellspring; a
// weapon's elemental, leech, slayer, castSpeed and potency; armour's thorns - is kept out of the ladder's own draw and
// added only by a door's LAST PASS (lootRarity.js lastPass -> rollProcLine), which every loot door takes. The craft's mint
// (smithItems.js mintPiece) rolled its quality's Magic or Rare (applyRarity) and never the pass, so a Superior or a
// Masterwork could never carry one - and a jewel's whole pool of them is the four the report names. The mint takes the
// pass now, on the same seeded stream, at the mint version its record names (`v`, stamped by the service at the craft):
// a record made before mints as it always did wherever it is minted again - the market's piece, the temper's re-sign.
//
// Driven through the real mint and its Reforge, the real Worker over node:sqlite (the craft's record, the temper's re-sign,
// the market's piece - test/accountDb.mjs), and the real item law.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from '../accountDb.mjs';
import { recordOf, layRecord } from '../realmSeat.mjs';   // INT19: a crafted piece in its seller's realm record
import { xpForRank } from '../../src/net/professionLaw.js';
import { courierFee, courierSeconds, roadPixels } from '../../src/net/marketLaw.js';
import { RECIPES, recipeById, QUALITY_EFFECTS } from '../../src/net/recipeLaw.js';
import { mintProductRecord, readProductRecord, productRecordValid, mintVersionOf, MINT_VERSION, MINT_V_LAST_PASS } from '../../src/net/productRecord.js';
import { mintPiece, mintPieces, temperItem, reforgeItem, asMinted } from '../../src/systems/smithItems.js';
import { AFFIX_IDS, AFFIX_KINDS, AFFIX_RANGES, PROC_PER_MILLE, LOOT_RARITY_KEY, affixesWorth, applyRarity, lastPass, reforgeableLines } from '../../src/systems/loot/lootRarity.js';
import { weaponOfMaterial } from '../../src/combat/enemyEquipment.js';
import { seededRng } from '../../src/systems/wind/wind.js';
import { itemFindings } from '../../src/systems/item/itemLaw.js';
import { setPref, getPref } from '../../src/systems/uiPrefs.js';

const PROV = '0123456789abcdef';
const isProc = (a) => !!AFFIX_KINDS[a?.id]?.proc;
const procsOf = (it) => (it.affixes ?? []).filter(isProc);
const numbersOf = (it) => (it.affixes ?? []).filter((a) => !isProc(a));
/** The proc kinds a group's pieces may carry - the ladder's own table. */
const procKinds = (group) => AFFIX_IDS.filter((id) => AFFIX_KINDS[id].proc && AFFIX_KINDS[id].groups.includes(group));
/** A seed per draw, spread over the 32 bits (the service's are). */
const seedOf = (i) => (Math.imul(i + 1, 2654435761) >>> 0);
const TIERS = Object.freeze({ 3: 'magic', 4: 'rare' });
const recipesOf = (...kinds) => RECIPES.filter((r) => kinds.includes(r.kind));
const mint = (r, quality, seed, version) => mintPiece({ recipe: r.id, quality, seed, maker: 'Silverthorn', version }, PROV);

test('CRAFT-PROCS: the report\'s jewel - a Superior and a Masterwork take the last pass: one line at most, of the jewel\'s four kinds, at the loot door\'s rate for its tier, every kind seen; the rest of the piece the old law\'s and its worth more by the line\'s', () => {
  assert.deepEqual(procKinds('Jewellery'), ['focus', 'castSpeed', 'potency', 'wellspring'], 'cast cost, cast speed, potency - and the caster\'s leech');
  // every jewel the ladder rolls - a Wand is none of its (lootRarity.js rarityEligible; RARITY-WEAR's wands)
  const jewels = recipesOf('jewel').filter((r) => mint(r, 3, 1, 0).rarity === 'magic');
  assert.ok(jewels.length >= 100);
  const N = 2400;
  for (const q of [3, 4]) {
    const tier = TIERS[q];
    assert.equal(QUALITY_EFFECTS[q].rarity, tier);
    let carried = 0;
    const kinds = new Map();
    const carriersByCount = new Map();
    for (let i = 0; i < N; i++) {
      const r = jewels[i % jewels.length];
      const seed = seedOf(i + q * 100_000);
      const now = mint(r, q, seed, MINT_VERSION);
      const was = mint(r, q, seed, 0);
      assert.equal(now.rarity, tier);
      assert.equal(procsOf(was).length, 0, 'the old law: no line that does something');
      const procs = procsOf(now);
      assert.ok(procs.length <= 1, `${r.id} ${seed}: one line at most`);
      // the piece is the old law's, the line appended after its numbers and its worth with it - nothing else moved
      assert.deepEqual(numbersOf(now), was.affixes, `${r.id} ${seed}: its numbers`);
      assert.deepEqual({ ...now, affixes: was.affixes, value: was.value }, was, `${r.id} ${seed}: its name, flavour, condition, weight, mark`);
      assert.equal(now.value, was.value + affixesWorth(procs), `${r.id} ${seed}: its worth more by the line's`);
      if (!procs.length) continue;
      const [line] = procs;
      assert.equal(now.affixes.at(-1), line, 'appended after its numbers');
      assert.ok(procKinds('Jewellery').includes(line.id), `${line.id} is a jewel's`);
      const [lo, hi] = AFFIX_RANGES[line.id][tier];
      assert.ok(line.value >= lo && line.value <= hi, `${line.id} ${line.value}: its tier's band`);
      carried++;
      kinds.set(line.id, (kinds.get(line.id) ?? 0) + 1);
      carriersByCount.set(numbersOf(now).length, (carriersByCount.get(numbersOf(now).length) ?? 0) + 1);
    }
    const rate = carried / N;
    const want = PROC_PER_MILLE[tier] / 1000;
    assert.ok(Math.abs(rate - want) < 0.03, `${tier}: ${rate} of the pieces carry a line - the loot door's ${want}`);
    assert.deepEqual([...kinds.keys()].sort(), [...procKinds('Jewellery')].sort(), `${tier}: every kind seen (${JSON.stringify([...kinds])})`);
    // ON THE SAME STREAM: the pass draws on after the roll, so its chance is no echo of the roll's first draws - a piece
    // carrying a line has each count of numbers its tier rolls (a fresh stream's first draw under the chance is always
    // the count's low half: every carrier one number, or three)
    const counts = q === 3 ? [1, 2] : [3, 4];
    for (const n of counts) assert.ok((carriersByCount.get(n) ?? 0) > carried * 0.3, `${tier}: carriers with ${n} numbers: ${carriersByCount.get(n) ?? 0} of ${carried}`);
  }
});

test('CRAFT-PROCS: a crafted weapon takes a weapon\'s kinds and armour thorns - each the loot door\'s law on the one stream (applyRarity, then lastPass); a garment nothing; the same seed the same piece, and the Loot Rarity switch never asked', () => {
  assert.deepEqual(procKinds('Weapons'), ['elemental', 'leech', 'slayer', 'castSpeed', 'potency']);
  assert.deepEqual(procKinds('Armor'), ['thorns']);
  const weapons = recipesOf('weapon', 'staff', 'bow');
  const seen = new Set();
  let carried = 0;
  for (let i = 0; i < 900; i++) {
    const r = weapons[i % weapons.length];
    const q = 3 + (i % 2);
    const seed = seedOf(i + 7_000);
    const now = mint(r, q, seed, MINT_VERSION);
    // the loot door's law, step by step on one stream: the tier's roll, then the door's last pass
    const rolls = seededRng(seed >>> 0);
    const door = weaponOfMaterial(r.templateIndex, r.material);
    applyRarity(door, TIERS[q], rolls);
    lastPass([door], rolls);
    assert.deepEqual(now.affixes, door.affixes, `${r.id} q${q} ${seed}: the door's lines`);
    for (const a of procsOf(now)) { seen.add(a.id); carried++; }
    assert.deepEqual(mint(r, q, seed, MINT_VERSION), now, 'the same seed, the same piece');
  }
  assert.deepEqual([...seen].sort(), [...procKinds('Weapons')].sort(), 'every weapon kind seen');
  assert.ok(carried > 900 * 0.2, `${carried} weapons of 900 carry a line`);
  const armour = recipesOf('plate', 'shield', 'chain', 'leather');
  let thorns = 0;
  for (let i = 0; i < 300; i++) {
    const it = mint(armour[i % armour.length], 3 + (i % 2), seedOf(i + 9_000), MINT_VERSION);
    for (const a of procsOf(it)) { assert.equal(a.id, 'thorns'); thorns++; }
  }
  assert.ok(thorns > 300 * 0.2, `${thorns} pieces of armour of 300 carry thorns`);
  // a garment: its group carries no such kind - the pass's chance draws, and nothing follows it
  for (const [i, r] of recipesOf('garment').slice(0, 60).entries()) {
    for (const q of [3, 4]) assert.deepEqual(mint(r, q, seedOf(i), MINT_VERSION), mint(r, q, seedOf(i), 0), `${r.id} q${q}`);
  }
  // THE SWITCH: the piece is its record's on every client - Loot Rarity off mints it the same (the line sleeps in its
  // reader, systems/loot/lootPowers.js), as the quality's roll always was
  const had = getPref(LOOT_RARITY_KEY);
  const ring = recipeById('ring:silver:ruby');
  const ones = [];
  for (let i = 0; i < 400 && ones.length < 6; i++) { const it = mint(ring, 3, seedOf(i), MINT_VERSION); if (procsOf(it).length) ones.push([seedOf(i), it]); }
  assert.equal(ones.length, 6, 'six rings with a line');
  try {
    setPref(LOOT_RARITY_KEY, false);
    for (const [seed, it] of ones) assert.deepEqual(mint(ring, 3, seed, MINT_VERSION), it, 'switched off, the same piece and its line');
  } finally { setPref(LOOT_RARITY_KEY, had); }
});

test('CRAFT-PROCS: the record says the law - the service stamps the mint version at the craft and the answer\'s pieces mint at it (a Superior\'s and a Masterwork\'s cast lines through the real Worker); a version the record does not know is refused; a record made before is version 0', async () => {
  assert.deepEqual([MINT_VERSION, MINT_V_LAST_PASS], [1, 1]);
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const mac = await s.seated('Mac');
  const r = recipeById('ring:silver:ruby');
  raw.prepare('INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, \'smithing\', ?, 1)').run(mac.id, mac.character, xpForRank(100));
  for (const { key, n } of r.inputs) raw.prepare('INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, \'own\', ?)').run(mac.id, mac.character, key, n * 100);
  const realRandom = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  /** The service's dice steered: every four-byte draw all `b` (the quality's roll and the seed). */
  const steered = async (b, fn) => {
    globalThis.crypto.getRandomValues = (arr) => (arr.byteLength === 4 ? (new Uint8Array(arr.buffer, arr.byteOffset, 4).fill(b), arr) : realRandom(arr));
    try { return await fn(); } finally { globalThis.crypto.getRandomValues = realRandom; }
  };
  const lined = { 3: [], 4: [] };
  let n = 0;
  for (let b = 0x60; b < 0x100; b += 4) {
    const res = await steered(b, () => s.call('/v1/prof/craft', { character: mac.character, recipe: r.id, clean: false, name: 'Silverthorn', rid: `craftprocs-${String(++n).padStart(6, '0')}` }, mac.secret));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const [{ record, provenance }] = res.body.pieces;
    assert.equal(readProductRecord(record).v, MINT_VERSION, 'stamped at the craft');
    assert.equal(mintVersionOf(record), MINT_VERSION);
    const [piece] = mintPieces(res.body);
    assert.deepEqual(piece, mintPiece({ ...res.body, version: MINT_VERSION }, provenance), 'minted at its record\'s version');
    if (res.body.quality >= 3 && procsOf(piece).length) {
      lined[res.body.quality].push(procsOf(piece)[0].id);
      assert.equal(procsOf(mintPiece({ ...res.body, version: 0 }, provenance)).length, 0, 'the old law drew none');
    }
  }
  assert.ok(lined[3].length && lined[4].length, `a crafted Superior ring and a Masterwork carry a line: ${JSON.stringify(lined)}`);
  for (const id of [...lined[3], ...lined[4]]) assert.ok(procKinds('Jewellery').includes(id));
  // the claim: a version the law knows, or none
  const claims = { p: PROV, s: mac.id, h: mac.character, r: r.id, q: 3, m: 'Mac', c: 9, i: 1 };
  assert.equal(productRecordValid(claims), true, 'none - a record made before');
  for (const v of [1, 2]) assert.equal(productRecordValid({ ...claims, v }), true, `v ${v}`);
  for (const v of [0, -1, 1.5, '1', null, true]) assert.equal(productRecordValid({ ...claims, v }), false, `v ${JSON.stringify(v)}`);
  const old = await mintProductRecord(claims, null, { subtle: globalThis.crypto.subtle, nowS: 1 });
  const now = await mintProductRecord({ ...claims, v: MINT_VERSION }, null, { subtle: globalThis.crypto.subtle, nowS: 1 });
  assert.deepEqual([readProductRecord(old).v, mintVersionOf(old), readProductRecord(now).v, mintVersionOf(now), mintVersionOf(null), mintVersionOf('p1.x')], [undefined, 0, 1, 1, 0, 0]);
  assert.deepEqual(mintPieces({ recipe: r.id, quality: 3, seed: 9, maker: 'Mac', pieces: [{ provenance: PROV, record: old }, { provenance: 'fedcba9876543210', record: now }] }),
    [mintPiece({ recipe: r.id, quality: 3, seed: 9, maker: 'Mac' }, PROV), mintPiece({ recipe: r.id, quality: 3, seed: 9, maker: 'Mac', version: 1 }, 'fedcba9876543210')], 'each piece at its own record\'s version');
});

test('CRAFT-PROCS: a piece made before is minted again as it was, and a new one with its line - the market\'s piece (read, bought, cancelled) and the temper\'s re-signed record, through the real Worker', async () => {
  let _now = T0;
  const realNow = Date.now;
  Date.now = () => _now * 1000;
  try {
    const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
    const raw = s.env.DB._raw;
    const mac = await s.seated('Mac');
    const ann = await s.seated('Ann');
    const sword = recipeById('longsword:steel');
    // a seed whose Superior takes a line under the pass - the one a record made before must never grow
    let seed = 0;
    while (seed < 400 && !procsOf(mint(sword, 3, seed, MINT_VERSION)).length) seed++;
    assert.ok(seed < 400, 'a Superior longsword with a line');
    const subtle = globalThis.crypto.subtle;
    const madeAt = async (who, provenance, quality, v) => {
      const record = await mintProductRecord({ p: provenance, s: who.id, h: who.character, r: sword.id, q: quality, m: 'Silverthorn', c: seed, v }, null, { subtle, nowS: 1 });
      raw.prepare(`INSERT INTO products (provenance, owner, char_id, maker, recipe, template, material, quality, seed, record, made_at)
        VALUES (?, ?, ?, 'Silverthorn', ?, ?, ?, ?, ?, ?, 1)`).run(provenance, who.id, who.character, sword.id, sword.templateIndex, sword.material, quality, seed, record);
      const minted = mintPiece({ recipe: sword.id, quality, seed, maker: 'Silverthorn', version: mintVersionOf(record) }, provenance);
      // PIN MOVED (INT19, Integrity-Arc section 7): the pack's piece is its record's too - a listing takes it out of there
      const save = recordOf(s.env, who.character);
      layRecord(s.env, who.character, { ...save, items: [...(save.items ?? []), JSON.parse(JSON.stringify(minted))] });
      return minted;
    };
    const OLD = 'a0a0a0a0a0a0a0a0', NEW = 'b1b1b1b1b1b1b1b1';
    const before = await madeAt(mac, OLD, 3, null);
    const after = await madeAt(mac, NEW, 3, MINT_VERSION);
    assert.equal(procsOf(before).length, 0);
    assert.equal(procsOf(after).length, 1, 'the new law\'s line');
    raw.prepare('INSERT INTO marks (account, balance) VALUES (?, 5000), (?, 5000)').run(mac.id, ann.id);
    const DF = 17, HUBS = { [DF]: [207, 212] };
    let n = 0;
    const rid = () => `craftprocs-m-${String(++n).padStart(6, '0')}`;
    const list = (provenance) => s.call('/v1/market/list', { character: mac.character, region: DF, kind: 'piece', provenance, wear: 1000, price: 500, hubs: HUBS, rid: rid() }, mac.secret);
    const [lo, ln] = [await list(OLD), await list(NEW)];
    assert.deepEqual([lo.status, ln.status], [200, 200], JSON.stringify([lo.body, ln.body]));
    // the boards' piece, as a buyer reads it, and the seller's own
    const view = new Map((await s.call('/v1/market/read', { character: ann.character, region: DF, view: 'crafted', hubs: HUBS }, ann.secret)).body.rows.map((x) => [x.piece.provenance, x.piece]));
    assert.deepEqual([view.get(OLD).version, view.get(NEW).version], [undefined, MINT_VERSION], 'the crafted view');
    const mine = new Map((await s.call('/v1/market/read', { character: mac.character, region: DF, view: 'mine', hubs: HUBS }, mac.secret)).body.rows.map((x) => [x.piece.provenance, x.piece]));
    assert.deepEqual([mine.get(OLD).version, mine.get(NEW).version], [undefined, MINT_VERSION], 'the seller\'s view');
    // bought: the buyer's pack mints it from the piece (scenes/world.js marketMint)
    const bought = await s.call('/v1/market/buy', { character: ann.character, region: DF, listing: ln.body.listing.id, max: 500, hubs: HUBS, rid: rid() }, ann.secret);
    assert.equal(bought.status, 200, JSON.stringify(bought.body));
    assert.deepEqual(mintPiece(bought.body.piece, bought.body.piece.provenance), after, 'the new piece arrives with its line');
    // cancelled: the seller's piece comes back as it was - PIN MOVED (INT19): as the very record that left, collected into
    // the seller's record, never minted again at the pack
    const back = await s.call('/v1/market/cancel', { character: mac.character, listing: lo.body.listing.id, rid: rid() }, mac.secret);
    assert.equal(back.status, 200, JSON.stringify(back.body));
    assert.equal(back.body.piece, undefined);
    const home = await s.call('/v1/market/collect', { character: mac.character, delivery: back.body.delivery.id, rid: rid(), realm: mac.at() }, mac.secret);
    assert.equal(home.status, 200, JSON.stringify(home.body));
    assert.deepEqual(home.body.item, JSON.parse(JSON.stringify(before)), 'the piece made before comes back byte for byte');
    // every other read a piece is shown in: an auction (the boards', the seller's, the bidder's) and a courier's load on
    // the road, collected
    const AUC = 'e4e4e4e4e4e4e4e4', ROADED = 'f5f5f5f5f5f5f5f5';
    await madeAt(mac, AUC, 4, MINT_VERSION);   // an auction is a Masterwork's
    await madeAt(mac, ROADED, 3, MINT_VERSION);
    const auc = await s.call('/v1/market/auction', { character: mac.character, region: DF, provenance: AUC, wear: 1000, opening: 100, hubs: HUBS, rid: rid() }, mac.secret);
    assert.equal(auc.status, 200, JSON.stringify(auc.body));
    assert.equal(auc.body.auction.piece.version, MINT_VERSION, 'the auction\'s answer');
    const bid = await s.call('/v1/market/bid', { character: ann.character, region: DF, auction: auc.body.auction.id, amount: 100, hubs: HUBS, rid: rid() }, ann.secret);
    assert.equal(bid.status, 200, JSON.stringify(bid.body));
    const boards = (await s.call('/v1/market/read', { character: ann.character, region: DF, view: 'auctions', hubs: HUBS }, ann.secret)).body.rows;
    assert.deepEqual(boards.map((a) => [a.piece.provenance, a.piece.version]), [[AUC, MINT_VERSION]], 'the auctions view');
    const macMine = (await s.call('/v1/market/read', { character: mac.character, region: DF, view: 'mine', hubs: HUBS }, mac.secret)).body;
    assert.deepEqual(macMine.auctions.map((a) => [a.piece.provenance, a.piece.version]), [[AUC, MINT_VERSION]], 'the seller\'s auctions');
    const WR = 23, BOTH = { ...HUBS, [WR]: [590, 166] };
    const lr = await list(ROADED);
    assert.equal(lr.status, 200, JSON.stringify(lr.body));
    const fee = courierFee(1, roadPixels({ x: 207, y: 212 }, { x: 590, y: 166 }));
    const far = await s.call('/v1/market/buy', { character: ann.character, region: WR, listing: lr.body.listing.id, max: 500 + fee, hubs: BOTH, rid: rid() }, ann.secret);
    assert.equal(far.status, 200, JSON.stringify(far.body));
    const annMine = (await s.call('/v1/market/read', { character: ann.character, region: WR, view: 'mine', hubs: BOTH }, ann.secret)).body;
    assert.deepEqual(annMine.bids.map((b) => [b.piece.provenance, b.piece.version]), [[AUC, MINT_VERSION]], 'the bidder\'s bids');
    assert.deepEqual(annMine.road.filter((x) => x.kind === 'piece').map((x) => [x.piece.provenance, x.piece.version]), [[ROADED, MINT_VERSION]], 'on the road');
    _now += courierSeconds(roadPixels({ x: 207, y: 212 }, { x: 590, y: 166 }));
    const got = await s.call('/v1/market/collect', { character: ann.character, delivery: far.body.delivery.id, rid: rid() }, ann.secret);
    assert.equal(got.status, 200, JSON.stringify(got.body));
    assert.deepEqual(mintPiece(got.body.piece, got.body.piece.provenance), { ...mint(sword, 3, seed, MINT_VERSION), provenance: ROADED }, 'collected with its line');
    // THE TEMPER: a Fine piece raised to Superior, its record re-signed with the craft's version kept
    raw.prepare('INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, \'smithing\', ?, 1)').run(mac.id, mac.character, xpForRank(10));
    raw.prepare('INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, \'ingot:steel\', \'own\', 4)').run(mac.id, mac.character);
    const FINE_OLD = 'c2c2c2c2c2c2c2c2', FINE_NEW = 'd3d3d3d3d3d3d3d3';
    for (const [provenance, v, want] of [[FINE_OLD, null, 0], [FINE_NEW, MINT_VERSION, MINT_VERSION]]) {
      const piece = await madeAt(mac, provenance, 2, v);
      assert.equal(asMinted(piece), true);
      const t = await s.call('/v1/prof/temper', { character: mac.character, recipe: sword.id, quality: 2, provenance, rid: rid() }, mac.secret);
      assert.equal(t.status, 200, JSON.stringify(t.body));
      assert.equal(readProductRecord(t.body.record).v, v ?? undefined, 'the re-sign keeps the craft\'s version');
      assert.equal(temperItem(piece, t.body), true);
      const fresh = mintPiece({ recipe: sword.id, quality: 3, seed, maker: 'Silverthorn', version: want }, provenance);
      assert.deepEqual([piece.quality, piece.rarity, piece.affixes, piece.name, piece.value], [3, 'magic', fresh.affixes, fresh.name, fresh.value]);
      assert.equal(procsOf(piece).length, want ? 1 : 0, want ? 'tempered under the new law: its Superior\'s line' : 'made before: tempered as it always was');
      assert.equal(asMinted(piece), true, 'still as its record mints - it lists');
    }
  } finally { Date.now = realNow; }
});

test('CRAFT-PROCS: the item law finds nothing on a piece the new law mints, and the Reforge keeps the line - a number reforged leaves it, the line reforged stays a jewel\'s kind', () => {
  const rolled = RECIPES.filter((r) => ['weapon', 'staff', 'bow', 'plate', 'shield', 'chain', 'leather', 'jewel', 'garment'].includes(r.kind));
  let lines = 0;
  for (const [i, r] of rolled.entries()) {
    for (const q of [3, 4]) {
      for (const k of [0, 1]) {
        const it = mintPiece({ recipe: r.id, quality: q, seed: seedOf(i * 4 + q * 2 + k), maker: k ? 'Silverthorn' : null, marked: false, hand: null, version: MINT_VERSION }, PROV);
        lines += procsOf(it).length;
        assert.deepEqual(itemFindings(it), [], `${r.id} q${q}: ${JSON.stringify(it).slice(0, 300)}`);
      }
    }
  }
  assert.ok(lines > 300, `${lines} pieces with a line judged`);
  // the Reforge with Essence (smithItems.js reforgeItem - the Loot arc's own Reforge, on the piece)
  const ring = recipeById('ring:silver:ruby');
  let checked = 0;
  for (let i = 0; i < 400 && checked < 40; i++) {
    for (const q of [3, 4]) {
      const base = mint(ring, q, seedOf(i), MINT_VERSION);
      if (!procsOf(base).length) continue;
      const at = base.affixes.findIndex(isProc);
      const number = reforgeableLines(base).find((x) => x !== at);
      const a = structuredClone(base);
      assert.ok(reforgeItem(a, number, 1000 + i), 'a number reforged');
      assert.deepEqual([procsOf(a), a.affixes[at]], [procsOf(base), base.affixes[at]], 'the line stands where it stood');
      assert.equal(isProc(a.affixes[number]), false, 'and the number stays a number');
      const b = structuredClone(base);
      assert.ok(reforgeItem(b, at, 2000 + i), 'the line reforged');
      assert.equal(procsOf(b).length, 1);
      assert.ok(procKinds('Jewellery').includes(b.affixes[at].id), `${b.affixes[at].id}: still one of the jewel's four`);
      assert.deepEqual(itemFindings(a), []);
      assert.deepEqual(itemFindings(b), []);
      checked++;
    }
  }
  assert.ok(checked >= 40, `${checked} rings with a line reforged both ways`);
});
