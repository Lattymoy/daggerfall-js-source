// FIELD BUGS 2026-10-20h - REMAINS-GOLD and REMAINS-TAKE, the Discord's "the PvP remains and gold pile"
// (bible/01-Overview/bugs/Field-Bugs-2026-10-20h.md).
//
// A death in the open zone drops a tenth of the purse and the cart's coin (FOE-KEEPS, 2026-10-24: it was half) as ONE gold
// pile in the fallen's remains
// (systems/wild/wildDropLaw.js takeWildGold), and every player's game stands the remains as a ground pile through
// net/wild/wildRemains.js:
//   - REMAINS-GOLD: the book minted every record through the stranger's projection (loot.js validLootList), whose stack
//     bound is the wire's 65,535 - a gold pile past it never stood for anyone, and the gold lay in the room for nobody.
//   - REMAINS-TAKE: a take of part of the gold - all a pack has room for (DaggerfallInventoryWindow.cs:1414-1422, the
//     how-many popup of DaggerfallInventoryWindow.cs:1510-1559) - came off the taker's pile twice: the room's `got`
//     ended the take and its `rm`, heard after it, was subtracted again. And a room word heard between the window's take
//     and the frame set the piece's count over a take nothing had asked yet - the taker kept coin the room still held.
//
// Every piece is the game's own: the fallen as the game dresses her (startingGear.js), her record as the save writes it
// (save.js snapshotPlayer), the fall as the relay signs one (wildReceipt.js), the drop as the real account service takes it
// (/v1/wild/fall), the remains as the real relay room keeps them; each player's book over the street's real pool
// (scenes/droppedLoot.js), the game's mint, and the window's own take (itemTransfer.js planTake/applyTransfer, as the
// enhanced pack's take() calls them) through the encumbrance gate (combat/formulas.js entityMaxEncumbrance).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { layRecord, realmAt } from '../realmSeat.mjs';
import { seeded } from '../honestItems.mjs';
import { fakeRooms } from '../fakeRoom.mjs';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { applyRarity } from '../../src/systems/loot/lootRarity.js';
import { assignStartingGear } from '../../src/systems/startingGear.js';
import { snapshotPlayer } from '../../src/systems/save/save.js';
import { stampItemIds } from '../../src/systems/item/itemIds.js';
import { wildTakeTook, wildChunks } from '../../src/systems/wild/wildDeath.js';
import { validLootList } from '../../src/systems/loot/loot.js';
import '../../src/systems/item/itemLaw.js';   // the item law registers itself with the wire, as the game's boot does
import { addItem, stacksWith, isGoldPieces, addGoldPieces } from '../../src/systems/inventory.js';
import { planTake, applyTransfer } from '../../src/systems/item/itemTransfer.js';
import { entityMaxEncumbrance } from '../../src/combat/formulas.js';
import { ENCHANTMENT_TYPES, computeEnchantmentMods } from '../../src/systems/enchantments.js';
import { computeEntityMods } from '../../src/systems/entityMods.js';
import { ITEM_GROUPS } from '../../src/characters/equipRules.js';
import { createDroppedLoot } from '../../src/scenes/droppedLoot.js';
import { createWildRemains } from '../../src/net/wild/wildRemains.js';
import { remainsWords } from '../../src/net/wild/wildLaw.js';
import { mintWildReceipt } from '../../src/net/wild/wildReceipt.js';
import { WILD_TEXT } from '../../src/systems/wild/wildZone.js';
import { validWildData, validWildOut, worldRoom, PIXEL_UNITS, WILD_ITEMS_MAX, WILD_DATA_MAX } from '../../src/net/wire.js';
import { SIEGE_UNITS_PER_M } from '../../src/net/siege/siegeRef.js';

const { subtle } = globalThis.crypto;
const PX = 400, PY = 120, CELL = worldRoom(PX, PY);
const BASE = { x: PX * PIXEL_UNITS + 16384, z: (499 - PY) * PIXEL_UNITS + 16384 };
const M = SIEGE_UNITS_PER_M;
const P = (x) => ({ x: BASE.x + x * M, y: 0, z: BASE.z, yaw: 0, pitch: 0 });
const RID = '0a1b2c3d4e5f';
const CLAYMORE = 122, IRON = 0, LONGSWORD = 121, STEEL = 3;
const quiet = async (fn) => { const w = console.warn, i = console.info; console.warn = () => {}; console.info = () => {}; try { return await fn(); } finally { console.warn = w; console.info = i; } };

/** A street's dropped-loot pool, the street's own producer (a renderer that draws nothing). */
const streetPool = () => createDroppedLoot({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {} },
  getTexture: async () => ({ getSize: () => ({ width: 32, height: 32 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 64, getFrameCount: () => 1 }),
  uploadRecordFrame: () => {},
});

/**
 * THE FALL: Riadne falls in the zone at Borin's hand with `purse` gold and the starting kit's 100; the relay signs it
 * (no worn piece picked), the service takes her drop off her record, her game takes out exactly that and lays the
 * remains in the cell. Borin and Cyrus (a stranger) stand in the cell too. Each plays the remains through their own book.
 */
async function fall(purse) {
  const world = fakeRooms();
  const r = world.room(CELL);
  const kp = await r.signer();   // the room verifies the service's orders with the key that signs its tokens
  const svc = await standService({ IDENTITY_PRIVATE_KEY: Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64') });
  const ria = await svc.seated('Riadne', { renown: 12 }), bo = await svc.registered('Borin'), cy = await svc.registered('Cyrus');
  const e = { name: 'Riadne', gender: 'female', level: 9, items: [], wagonItems: [], goldPieces: purse };
  assignStartingGear(e, { classIndex: 16, rolls: seeded(3) });   // the Warrior's kit
  e.items.push(applyRarity(createWeapon(LONGSWORD, STEEL, seeded(7)), 'magic', seeded(8)));
  stampItemIds(e);
  layRecord(svc.env, ria.character, JSON.parse(JSON.stringify(snapshotPlayer(e))));
  const rc = await mintWildReceipt({ f: ria.id, c: ria.character, k: bo.id, r: RID, w: -1 }, svc.gatePriv, { subtle, nowS: Math.floor(Date.now() / 1000) });
  const res = await svc.call('/v1/wild/fall', { receipt: rc, realm: realmAt(svc.env, ria.character), room: CELL }, ria.secret);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const d = res.body;
  wildTakeTook(e, d.took, d.gold, () => {});
  const fa = r.connect(); await r.hello(fa, 'peer-0001', P(-1), { tokenSub: ria.id, rc: 1, ci: ria.character });
  const kb = r.connect(); await r.hello(kb, 'peer-0002', P(1), { tokenSub: bo.id });
  const cs = r.connect(); await r.hello(cs, 'peer-0003', P(3), { tokenSub: cy.id });
  const room = WILD_DATA_MAX - JSON.stringify({ k: 'fall', r: d.r, p: [0, 0, 0], items: [], last: 0, o: d.order }).length - 16;
  const chunks = wildChunks(d.items, WILD_ITEMS_MAX, room);
  for (let k = 0; k < chunks.length; k++) {
    await r.raw(fa, JSON.stringify({ t: 'wild', data: validWildData({ k: 'fall', r: d.r, p: [BASE.x, 0, BASE.z], items: chunks[k], last: k === chunks.length - 1 ? 1 : 0, o: d.order }) }));
  }
  assert.equal(r.store.get(`wild:${d.r}`)?.ok, true, 'the remains vouched for');
  return { r, d, svc, ria, bo, cy, fa, kb, cs };
}

/**
 * A PLAYER'S SIDE: their book (net/wild/wildRemains.js) over the street's pool, wired as the world host wires it - the
 * game's mint, coin to the purse and back out of it, the pack's add and stack rule. Their frames to the room wait in a
 * queue until `flush` (the socket's order); `hear` reads what the room said to them since the last hear.
 */
function player(z, ws, entity, acct, ownerSub = null) {
  const pool = streetPool();
  const out = [], said = [];
  const book = createWildRemains({
    send: (x) => { const v = validWildData(x); if (v) out.push(v); return !!v; },
    pool: () => pool, toScene: (p) => [p[0] / M, p[1], p[2] / M], mine: (rec) => !!ownerSub && rec.os === ownerSub,
    pack: () => (entity.items ??= []), mint: (list) => validLootList(list),
    addItem: (list, item) => (isGoldPieces(item) ? addGoldPieces(entity, item.stackCount ?? 1) : addItem(list, item)),
    unpurse: (n) => { const h = entity.goldPieces ?? 0; const t = Math.min(h, n); entity.goldPieces = h - t; return t; },
    stacksWith: (a, b) => stacksWith(a, b), say: (l) => said.push(l), nameOf: (it) => it.name, me: () => acct,
  });
  book.setRooms([CELL]);
  book.setPool(pool);
  let read = 0;
  const hear = () => { for (; read < ws.sent.length; read++) { const o = validWildOut(ws.sent[read]); if (o) book.onWord(o, CELL); } };
  const flush = async () => { while (out.length) await z.r.raw(ws, JSON.stringify({ t: 'wild', data: out.shift() })); };
  const pile = () => pool._piles.find((p) => p.owner === 'wild' && p.items.length && !p.dead) ?? null;
  const coin = () => pile()?.items.find(isGoldPieces)?.stackCount ?? 0;
  return { book, pool, entity, said, hear, flush, pile, coin };
}

/** THE WINDOW'S TAKE of `item` off `pile` - the enhanced pack's take(): the plan through the encumbrance gate, the
 *  amount the how-many popup defaults to (what fits) or one the player types under it, the move. */
function windowTake(who, pile, item, typed = null) {
  const plan = planTake(item, { bag: who.entity.items, entity: who.entity, mode: 'remove' });
  assert.ok(plan.ok, 'the gate lets it through');
  const amount = typed ?? plan.amount;
  assert.ok(amount <= plan.amount);
  applyTransfer(item, { ...plan, amount }, pile.items, who.entity.items, { entity: who.entity, toPlayer: true });
  return amount;
}

/** The coin the room's record of the remains still holds. */
const roomCoin = (z) => (z.r.store.get(`wild:${z.d.r}`)?.items ?? []).find((it) => it && isGoldPieces(it))?.stackCount ?? 0;
/** A taker whose pack is `claymores` iron claymores (7.5 kg each) and a purse of `purse` - the gate reads both. */
const taker = (name, strength, purse, claymores = 0) => ({ name, stats: { strength }, activeEffects: [], goldPieces: purse, items: Array.from({ length: claymores }, (_, k) => createWeapon(CLAYMORE, IRON, seeded(20 + k))) });

test('REMAINS-GOLD: a death\'s gold past the wire\'s 65,535 stands in the remains - for its killer, a stranger and the fallen herself - and its taker\'s grant is the whole count (mutants: the coin through the stranger\'s projection; its bound the wire\'s; the grant through it)', () => quiet(async () => {
  const z = await fall(700_400);   // PIN MOVED (FOE-KEEPS, bible/11-Multiplayer/Wild-Zone.md section 4): the purse ten times the pile, a tenth its share - it was 140,000, half
  assert.deepEqual(z.d.gold, { purse: 70_050, cart: 0 }, 'a tenth of her purse, one pile');
  // Borin: strength at its most and a ring of Increased Weight Allowance (the half) - 225 kg, room for the whole pile
  const ring = { name: 'Ring', templateIndex: 135, group: ITEM_GROUPS.Jewellery, currentCondition: 100, maxCondition: 100, equipSlot: 9, enchantments: [{ type: ENCHANTMENT_TYPES.IncreasedWeightAllowance, param: 1 }] };
  const borin = { name: 'Borin', isPlayer: true, stats: { strength: 100 }, activeEffects: [], goldPieces: 100, items: [ring] };
  computeEnchantmentMods(borin, {});
  computeEntityMods(borin);
  assert.equal(entityMaxEncumbrance(borin), 225);
  const B = player(z, z.kb, borin, z.bo.id);
  const C = player(z, z.cs, taker('Cyrus', 50, 100), z.cy.id);
  const R = player(z, z.fa, { name: 'Riadne', items: [], goldPieces: 0 }, z.ria.id, z.ria.id);
  for (const p of [B, C, R]) p.hear();
  assert.deepEqual([B.coin(), C.coin(), R.coin()], [70_050, 70_050, 70_050], 'the gold pile stands for all three');
  assert.equal(R.pile().label, WILD_TEXT.mine, 'and hers is named hers');
  // Borin takes it whole: the window puts it in his purse, his book lifts it back out and asks; the room grants it
  const pile = B.pile();
  assert.equal(windowTake(B, pile, pile.items.find(isGoldPieces)), 70_050);
  B.book.tick();
  assert.equal(borin.goldPieces, 100, 'out of the purse until the room gives it');
  await B.flush();
  for (const p of [B, C, R]) p.hear();
  assert.deepEqual([borin.goldPieces, roomCoin(z), C.coin(), R.coin()], [70_150, 0, 0, 0], 'the whole count his, and gone from the remains for everyone');
  assert.ok(B.said.includes('You take Gold Pieces.'));
}));

test('REMAINS-TAKE: a take of part of the gold pile - all a pack has room for - leaves the pile at what the room holds, and the rest taken later is taken once (mutant: a take\'s answer never ends it)', () => quiet(async () => {
  const z = await fall(100_400);   // PIN MOVED (FOE-KEEPS): a tenth - it was 20,000, half
  assert.deepEqual(z.d.gold, { purse: 10_050, cart: 0 });
  // Borin: 75 kg; a purse of 4,000 (10 kg) and eight iron claymores (60 kg) - room for 2,000 coins
  const B = player(z, z.kb, taker('Borin', 50, 4_000, 8), z.bo.id);
  const C = player(z, z.cs, taker('Cyrus', 50, 100), z.cy.id);
  for (const p of [B, C]) p.hear();
  const pile = B.pile();
  assert.equal(windowTake(B, pile, pile.items.find(isGoldPieces)), 2_000, 'the how-many popup\'s default: what fits');
  B.book.tick();
  await B.flush();
  for (const p of [B, C]) p.hear();
  assert.deepEqual([B.coin(), C.coin(), roomCoin(z), B.pile() === pile, B.entity.goldPieces], [8_050, 8_050, 8_050, true, 6_000],
    'his pile shows what the room holds - the same pile, under the window that took from it');
  // he leaves the claymores and takes the rest he sees - before the fix 6,050, and the gold left his pile with 2,000 of it
  // still in the room (the stranger's pile showed them); now the 8,050 the room holds, once
  B.entity.items.length = 0;
  assert.equal(windowTake(B, pile, pile.items.find(isGoldPieces)), 8_050);
  B.book.tick();
  await B.flush();
  for (const p of [B, C]) p.hear();
  for (const p of [B, C]) p.book.tick();   // and the next frame
  assert.deepEqual([B.pile()?.items.find(isGoldPieces) ?? null, C.coin(), roomCoin(z), B.entity.goldPieces], [null, 0, 0, 14_050], 'all of her 10,050 his, and no gold left on either pile or in the room');
}));

test('REMAINS-TAKE: a stranger\'s take heard between the window\'s take and the frame never writes over it - no coin is made, and every pile shows the room\'s (mutants: the window\'s take unasked before the word; the ask not counted in flight; the pile shown without it; the old skip of every word while a take of mine is in flight)', () => quiet(async () => {
  const z = await fall(100_400);   // PIN MOVED (FOE-KEEPS): her 10,050, a tenth
  const B = player(z, z.kb, taker('Borin', 50, 4_000, 8), z.bo.id);
  const C = player(z, z.cs, taker('Cyrus', 50, 100), z.cy.id);
  for (const p of [B, C]) p.hear();
  // Borin's window takes 2,000 - and before his frame looks, Cyrus's take of 1,000 (typed in the how-many popup) reaches
  // the room first, and its word reaches Borin
  const bp = B.pile();
  windowTake(B, bp, bp.items.find(isGoldPieces));
  const cp = C.pile();
  windowTake(C, cp, cp.items.find(isGoldPieces), 1_000);
  C.book.tick();
  await C.flush();
  B.hear();
  assert.equal(B.coin(), 7_050, 'the room\'s 9,050 less his 2,000 in flight');
  await B.flush();
  for (const p of [B, C]) { p.hear(); p.book.tick(); }
  assert.deepEqual([roomCoin(z), B.entity.goldPieces - 4_000, C.entity.goldPieces - 100, B.coin(), C.coin()], [7_050, 2_000, 1_000, 7_050, 7_050],
    'her 10,050 is the room\'s 7,050, his 2,000 and the stranger\'s 1,000 - none made');
}));

test('REMAINS-TAKE: the remains said again under a take - a socket\'s hello - stand the pile without the take and lose none of it (mutants: the take unasked before the pile goes; the new pile shown with it; the ask not counted in flight)', () => quiet(async () => {
  const z = await fall(100_400);   // PIN MOVED (FOE-KEEPS): her 10,050, a tenth
  const B = player(z, z.kb, taker('Borin', 50, 4_000, 8), z.bo.id);
  B.hear();
  const bp = B.pile();
  windowTake(B, bp, bp.items.find(isGoldPieces));
  // before his frame looks, the room says its remains again - the words its hello says (wildLaw.js remainsWords)
  for (const w of remainsWords(z.r.store.get(`wild:${z.d.r}`), Date.now())) B.book.onWord(validWildOut(w), CELL);
  assert.equal(B.coin(), 8_050, 'the pile stood again without his 2,000 in flight');
  await B.flush();
  B.hear();
  B.book.tick();
  assert.deepEqual([roomCoin(z), B.entity.goldPieces - 4_000, B.coin()], [8_050, 2_000, 8_050], 'her 10,050 is the room\'s 8,050 and his 2,000');
}));
