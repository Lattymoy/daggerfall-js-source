// FIELD BUGS 2026-10-26 ANY-GOODS (#bug-reports, "Crafting writs not accepting": "I brewed the 7 heal true potions
// myself and its showing like I haven't made any"; the owner: "Crafting writs should work with even store bought
// ingredients. I hate this"; bible/01-Overview/bugs/Field-Bugs-2026-10-26.md) - a crafting writ is filled by what the
// character MADE, whatever it was made of: a brew that spent loose units (looted, or bought with gold at a shop - a
// station's put-in from the pack, AUDIT BAG-CRAFT A1) counts as any other (craftWrits.js brewedLeftSql no longer asks
// migration 0145's `witnessed`), and a dish or kit made of them fills one (pieceOkSql: a piece walled by its goods,
// `products.loose` 1). A piece BOUGHT back with gold on the market (`bought_with` 'gold', `loose` 0) still fills none.
// Driven through the real Worker over node:sqlite with every migration applied (test/accountDb.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from '../accountDb.mjs';
import { recipeById } from '../../src/net/recipeLaw.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { layRecord } from '../realmSeat.mjs';
import { craftWritOf, writPotionKey, craftShortText } from '../../src/net/craftWritLaw.js';
import { GROUP_TEMPLATE_INDICES } from '../../src/systems/item/itemTemplatesData.js';

const DAY = 86_400;
let _now = utcDay(T0) * DAY + 43_200;
const realNow = Date.now;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = () => `ag-${String(++_rid).padStart(8, '0')}`;
const HEALING = ['p1:16', 'reagent:troll-blood', 'reagent:elixir-vitae', 'metal:mercury'];
const BOTTLE = GROUP_TEMPLATE_INDICES.UselessItems1[1];
const bottles = (product, n) => ({ group: 'UselessItems1', templateIndex: BOTTLE, potionRecipeKey: writPotionKey(product), stackCount: n, value: 50 });
const dish = (pv) => ({ group: 'UselessItems2', templateIndex: 685, provenance: pv, recipe: 'stew:north', name: 'Hunter\'s Stew' });

async function stand() {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const give = (who, m, origin, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = prof_stores.qty + excluded.qty`).run(who.id, who.character, m, origin, qty);
  const balance = (who) => Number(raw.prepare('SELECT balance FROM marks WHERE account = ?').get(who.id)?.balance ?? 0);
  const record = (who) => JSON.parse(new TextDecoder().decode(s.env.SAVES._map.get(raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(who.character).obj)));
  const pack = (who, items) => layRecord(s.env, who.character, { ...record(who), items });
  const board = async (who) => {
    const r = await s.call('/v1/writs/list', { character: who.character, region: 17 }, who.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body.crafts;
  };
  const aim = (who, slot, product) => {
    const w = craftWritOf(product);
    const day = utcDay(_now);
    raw.prepare('UPDATE craft_writs SET product = ?, tier = ?, faction = ?, qty = ?, pay = ?, xp = ?, renown = ?, track = ? WHERE player = ? AND slot = ? AND day = ?')
      .run(w.product, w.tier, w.faction, w.qty, w.pay, w.xp, w.renown, w.track, who.id, slot, day);
    return { ...w, id: raw.prepare('SELECT id FROM craft_writs WHERE player = ? AND slot = ? AND day = ?').get(who.id, slot, day).id };
  };
  /** a brew whose every ingredient is the pack's - loose units, as a station's put-in leaves a looted or gold-bought herb */
  const brewLoose = async (who, potion, keys) => {
    for (const k of keys) give(who, k, 'loose', 1);
    const r = await s.call('/v1/prof/brew', { character: who.character, potion, keys, rid: rid() }, who.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body;
  };
  /** a dish cooked wholly of loose goods */
  const cookLoose = async (who, recipe) => {
    for (const { key, n } of recipeById(recipe).inputs) give(who, key, 'loose', n);
    const r = await s.call('/v1/prof/craft', { character: who.character, recipe, clean: false, name: who.handle, rid: rid() }, who.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body.pieces.map((p) => p.provenance);
  };
  const deliver = (who, id, extra = {}) => s.call('/v1/writs/craft', { character: who.character, id, rid: rid(), realm: who.at(), ...extra }, who.secret);
  return { ...s, raw, give, balance, record, pack, board, aim, brewLoose, cookLoose, deliver };
}

test('ANY-GOODS service: a potion writ filled wholly by brews of the pack\'s goods (every ingredient loose - looted, or bought with gold at a shop): the card counts them, the bottles leave the record and the pay is struck (mutants: the witness asked again)', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  await s.board(mac);
  const w = s.aim(mac, 0, 'potion:healing');
  assert.equal(w.qty, 4);
  await s.brewLoose(mac, 'healing', HEALING);
  await s.brewLoose(mac, 'healing', HEALING);
  assert.deepEqual(s.raw.prepare('SELECT witnessed FROM prof_brews WHERE char_id = ?').all(mac.character).map((r) => r.witnessed), [0, 0], 'neither brew a witness, as the record keeps it');
  assert.equal((await s.board(mac)).writs[0].brewed, 4, 'the card counts both');
  s.pack(mac, [bottles('potion:healing', 4)]);
  const ok = await s.deliver(mac, w.id);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.deepEqual([ok.body.pay, ok.body.writ.state, s.balance(mac), s.record(mac).items], [w.pay, 'mine', w.pay, []]);
});

test('ANY-GOODS service: a dish writ filled by stews cooked of the pack\'s goods (walled to gold by its goods - `loose` 1): the board names them and the fill takes them; a stew BOUGHT back with gold on the market (`loose` 0) is neither named nor taken (mutants: the goods\' wall refused again; every gold wall lifted)', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  await s.board(mac);
  const w = s.aim(mac, 1, 'dish:stew');
  assert.equal(w.qty, 3);
  const pvs = [...await s.cookLoose(mac, 'stew:north'), ...await s.cookLoose(mac, 'stew:north'), ...await s.cookLoose(mac, 'stew:north')];
  assert.deepEqual(pvs.map((pv) => ((r) => [r.bought_with, r.loose])(s.raw.prepare('SELECT bought_with, loose FROM products WHERE provenance = ?').get(pv))),
    [['gold', 1], ['gold', 1], ['gold', 1]], 'each walled to gold by its goods');
  assert.deepEqual((await s.board(mac)).writs[1].pieces, [...pvs].reverse(), 'all three named, newest first');
  // one bought back with gold on the market: a gold purchase's wall (market.js buyWithGold writes `loose` 0)
  s.raw.prepare('UPDATE products SET loose = 0 WHERE provenance = ?').run(pvs[0]);
  assert.deepEqual((await s.board(mac)).writs[1].pieces, [pvs[2], pvs[1]], 'the gold purchase is not named');
  s.pack(mac, pvs.map(dish));
  assert.deepEqual((await s.deliver(mac, w.id, { pieces: pvs })).body, { error: 'craft-pieces' }, 'nor taken');
  s.raw.prepare('UPDATE products SET loose = 1 WHERE provenance = ?').run(pvs[0]);
  const ok = await s.deliver(mac, w.id, { pieces: pvs });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.deepEqual([ok.body.pay, s.balance(mac), s.record(mac).items], [w.pay, w.pay, []]);
});

test('ANY-GOODS words: a potion writ short of brews asks a brew at an alchemy station - a potion maker anywhere else is the client\'s mix, which the service never sees (mutants: the station unsaid)', () => {
  const w = { product: 'potion:healTrue', kind: 'potion', qty: 3 };
  assert.equal(craftShortText(w, { pack: 7, made: 0 }), 'Brew 3 more yourself at an alchemy station - found or bought bottles do not count');
  assert.equal(craftShortText(w, { pack: 2, made: 3 }), 'Carry 1 more of these bottles in your pack');
});
