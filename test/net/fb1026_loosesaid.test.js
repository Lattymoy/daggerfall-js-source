// FIELD BUGS 2026-10-26 LOOSE-SAID (#bug-reports, "Crafting writs not accepting": "I brewed the 7 heal true potions
// myself and its showing like I haven't made any"; "I've had the same issues with potions and cooking dishes";
// bible/01-Overview/bugs/Field-Bugs-2026-10-26.md) - a crafting writ's card says WHY what the character made does not
// count: a brew that spent loose units (looted, or bought with gold - alchemy.js `witnessed`) and a piece made of them
// (`bought_with` 'gold') fill no writ (Professions-Arc.md 49.2, WITNESSED WHOLE), and the card said "0 brewed by you"
// over a brew that had paid its XP. The board reads them (craftWrits.js craftWritView: `looseBrewed`, `loosePieces`), the
// host counts them (craftWritHost.js held), the card says them (craftWritLaw.js craftShortText). Driven through the real
// Worker over node:sqlite with every migration applied (test/accountDb.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from '../accountDb.mjs';
import { recipeById } from '../../src/net/recipeLaw.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { craftWritOf, writPotionKey, craftShortText } from '../../src/net/craftWritLaw.js';
import { createCraftWritHost } from '../../src/scenes/craftWritHost.js';
import { GROUP_TEMPLATE_INDICES } from '../../src/systems/item/itemTemplatesData.js';

const DAY = 86_400;
let _now = utcDay(T0) * DAY + 43_200;
const realNow = Date.now;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = () => `ls-${String(++_rid).padStart(8, '0')}`;
const HEALING = ['p1:16', 'reagent:troll-blood', 'reagent:elixir-vitae', 'metal:mercury'];

async function stand() {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const give = (who, m, origin, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = prof_stores.qty + excluded.qty`).run(who.id, who.character, m, origin, qty);
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
  };
  const brew = async (who, potion, keys) => {
    for (const k of keys) give(who, k, 'own', 1);
    const r = await s.call('/v1/prof/brew', { character: who.character, potion, keys, rid: rid() }, who.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body;
  };
  const cook = async (who, recipe) => {
    for (const { key, n } of recipeById(recipe).inputs) give(who, key, 'own', n);
    const r = await s.call('/v1/prof/craft', { character: who.character, recipe, clean: false, name: who.handle, rid: rid() }, who.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body.pieces.map((p) => p.provenance);
  };
  return { ...s, raw, give, board, aim, brew, cook };
}

test('LOOSE-SAID service: a potion writ\'s card reads the brews of it made TODAY of loose units (`looseBrewed`) beside the witnessed ones (`brewed`) - never a witnessed brew, another potion\'s, another character\'s, nor yesterday\'s (mutants: the witness clause; the day; the potion)', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  await s.board(mac);
  // yesterday's loose brew (its row moved back a day): the card says today's alone
  s.give(mac, 'p1:16', 'loose', 1);
  await s.brew(mac, 'healing', HEALING);
  s.raw.prepare('UPDATE prof_brews SET at = at - ? WHERE char_id = ?').run(DAY, mac.character);
  s.aim(mac, 0, 'potion:healing');
  assert.deepEqual(((w) => [w.brewed, w.looseBrewed])((await s.board(mac)).writs[0]), [0, 0], 'yesterday\'s loose brew is not today\'s');
  // two of today's three Healing brews spent a loose Red Berries: four potions no witness, two witnessed
  s.give(mac, 'p1:16', 'loose', 2);
  for (let i = 0; i < 3; i++) await s.brew(mac, 'healing', HEALING);
  // a loose brew of another potion, and another character's loose Healing: neither is this writ's
  await s.brew(mac, 'stamina', (() => { s.give(mac, 'p2:27', 'loose', 1); return ['p2:27', 'p2:30', 'reagent:pure-water']; })());
  const ann = await s.seated('Ann');
  s.give(ann, 'p1:16', 'loose', 1);
  await s.brew(ann, 'healing', HEALING);
  const w = (await s.board(mac)).writs[0];
  assert.deepEqual([w.product, w.brewed, w.looseBrewed], ['potion:healing', 2, 4]);
});

test('LOOSE-SAID service: a dish writ\'s card names the pieces of the character\'s make walled to gold (made of loose goods - `loosePieces`), newest first, and never among the pieces that fill it; one on the market is neither (mutants: the gold wall; the listing)', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  await s.board(mac);
  s.aim(mac, 1, 'dish:stew');
  const own = await s.cook(mac, 'stew:north');
  s.give(mac, 'food:meat', 'loose', 3);
  const walled = [...await s.cook(mac, 'stew:north'), ...await s.cook(mac, 'stew:south')];
  s.give(mac, 'food:egg', 'loose', 1);
  await s.cook(mac, 'supper:north');   // another dish's - not this writ's
  assert.deepEqual(walled.map((pv) => s.raw.prepare('SELECT bought_with FROM products WHERE provenance = ?').get(pv).bought_with), ['gold', 'gold'],
    'the first spent two loose meats, the second the third (a station spends loose units first)');
  const w = (await s.board(mac)).writs[1];
  assert.deepEqual([w.pieces, w.loosePieces], [own, [...walled].reverse()]);
  s.raw.prepare('UPDATE products SET listed = 1 WHERE provenance = ?').run(walled[1]);
  assert.deepEqual((await s.board(mac)).writs[1].loosePieces, [walled[0]], 'one on the market is not in the pack');
});

const BOTTLE = GROUP_TEMPLATE_INDICES.UselessItems1[1];
const bottle = (n) => ({ group: 'UselessItems1', templateIndex: BOTTLE, potionRecipeKey: writPotionKey('potion:healTrue'), stackCount: n, value: 100 });
const HEAL_TRUE = { id: 'k:20383:r0123456789abcdef0123:0', product: 'potion:healTrue', kind: 'potion', tier: 3, faction: 22, qty: 3, pay: 76, xp: 152, renown: 114, track: 'provisioning', expiresAt: 20384 * 86400, state: 'open' };
const dish = (pv) => ({ group: 'UselessItems2', templateIndex: 685, provenance: pv, recipe: 'stew:north', name: 'Hunter\'s Stew' });
const PV = ['P000000000000000000001', 'P000000000000000000002', 'P000000000000000000003'];
const STEW = { id: 'k:20383:r0123456789abcdef0123:1', product: 'dish:stew', kind: 'dish', tier: 1, faction: 40, qty: 3, pay: 20, xp: 40, renown: 30, track: 'provisioning', expiresAt: 20384 * 86400, state: 'open' };

test('LOOSE-SAID client: the host counts what never counts - a potion writ\'s loose brews as the service read them, a dish writ\'s walled pieces that the pack holds - and the card says why Deliver waits: the report\'s own card, "0 brewed by you, 7 in your pack", says its loose brews; with none, a brew is asked at an alchemy station (mutants: the loose count unread; the pack unread; the loose words; the station)', () => {
  const player = { items: [bottle(7), dish(PV[0]), dish(PV[1]), { name: 'Torch' }] };
  const host = createCraftWritHost({ player: () => player, session: () => null, checkpoint: () => {}, saved: () => {}, book: () => null });
  const report = { ...HEAL_TRUE, brewed: 0, looseBrewed: 6 };
  assert.deepEqual(host.held(report), { pack: 7, made: 0, loose: 6, ready: false });
  assert.equal(craftShortText(report, host.held(report)),
    '6 potions you brewed today were made with looted or gold-bought ingredients, which never count - brew 3 more from ingredients you gathered or bought from the Apothecaries');
  assert.equal(craftShortText(report, { pack: 7, made: 2, loose: 1 }),
    'A potion you brewed today was made with looted or gold-bought ingredients, which never count - brew 1 more from ingredients you gathered or bought from the Apothecaries');
  assert.equal(craftShortText(report, { pack: 7, made: 0, loose: 0 }), 'Brew 3 more yourself at an alchemy station - found or bought bottles do not count');
  assert.equal(craftShortText(report, { pack: 2, made: 3, loose: 6 }), 'Carry 1 more of these bottles in your pack', 'the brews cover it: the loose ones are no matter');
  // a dish writ: two walled stews in the pack, a third walled one eaten (its row outlives it), one of its own
  const stew = { ...STEW, pieces: [PV[2]], loosePieces: ['P000000000000000000009', PV[1], PV[0]] };
  assert.deepEqual(host.held(stew), { pack: 2, made: 0, loose: 2, ready: false });
  assert.equal(craftShortText(stew, host.held(stew)),
    '2 pieces in your pack were made with looted or gold-bought goods, which never count - make 3 more from goods you gathered or bought with silver');
  assert.equal(craftShortText(stew, { pack: 3, made: 1, loose: 1 }),
    'One piece in your pack was made with looted or gold-bought goods, which never count - make 2 more from goods you gathered or bought with silver');
  assert.equal(craftShortText(stew, { pack: 3, made: 1, loose: 0 }), 'Make 2 more yourself - pieces you bought or sold do not count');
  assert.deepEqual(host.held({ ...stew, loosePieces: undefined }), { pack: 2, made: 0, loose: 0, ready: false }, 'an older service says none');
});
