// CRAFT-WRITS (2026-10-22) - THE GUILDS' ASKS OF A CRAFTER, AS THE SERVICE KEEPS THEM: an account's three writs a UTC day
// posted on the first board read of any of its realm characters (/v1/writs/list's `crafts` - AUDIT CRAFT-WRITS E1), and a
// writ filled (/v1/writs/craft) by any of them - a potion writ by the filler's own WITNESSED brews (a cauldron of loose
// units is none) and the bottles out of its realm record, a dish or kit writ by pieces of its own unsold make, their rows
// gone; the pay struck as a `craft-writ` mint, the XP to the craft's track, the Renown to the character, the guild's
// standing on its Roll. Driven through the real Worker over node:sqlite with every migration applied (test/accountDb.mjs).
// bible/06-Systems/Professions-Arc.md section 49.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from '../accountDb.mjs';
import { xpForRank } from '../../src/net/professionLaw.js';
import { recipeById } from '../../src/net/recipeLaw.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { renownRate } from '../../src/net/renown.js';
import { layRecord, seatRealm } from '../realmSeat.mjs';
import { craftWritsFor, craftWritOf, writPotionKey, CRAFT_WRITS_PER_DAY } from '../../src/net/craftWritLaw.js';
import { GROUP_TEMPLATE_INDICES } from '../../src/systems/item/itemTemplatesData.js';
import { HALL_WRIT_REP } from '../../src/net/npcChapterLaw.js';
import { DIVINES, GUILD_FACTION_IDS } from '../../src/systems/guild/guildFactions.js';
import { deliverCraftWrit, sweepCraftWrits } from '../../server-account/src/craftWrits.js';
import { progressSpentOf } from '../../server-account/src/progress.js';
import { xpForRank as rankXp, JOURNEYMAN_RANK } from '../../src/net/professionLaw.js';

const DAY = 86_400;
let _now = utcDay(T0) * DAY + 43_200;
const realNow = Date.now;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = () => `cw-${String(++_rid).padStart(8, '0')}`;
const HEALING = ['p1:16', 'reagent:troll-blood', 'reagent:elixir-vitae', 'metal:mercury'];
const BOTTLE = GROUP_TEMPLATE_INDICES.UselessItems1[1];
const bottles = (product, n, extra = {}) => ({ group: 'UselessItems1', templateIndex: BOTTLE, potionRecipeKey: writPotionKey(product), stackCount: n, value: 50, ...extra });

async function stand(env = {}) {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on', CHAPTERS_OPEN: 'on', ...env });
  const raw = s.env.DB._raw;
  const give = (who, m, origin, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = prof_stores.qty + excluded.qty`).run(who.id, who.character, m, origin, qty);
  const xpOf = (who, prof) => Number(raw.prepare('SELECT xp FROM prof_tracks WHERE player = ? AND char_id = ? AND profession = ?').get(who.id, who.character, prof)?.xp ?? 0);
  const setXp = (who, prof, xp) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp`).run(who.id, who.character, prof, xp, _now);
  const balance = (who) => Number(raw.prepare('SELECT balance FROM marks WHERE account = ?').get(who.id)?.balance ?? 0);
  const record = (who) => JSON.parse(new TextDecoder().decode(s.env.SAVES._map.get(raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(who.character).obj)));
  /** the pack the record holds, laid over its save (the client's checkpoint after its brews and crafts) */
  const pack = (who, items) => layRecord(s.env, who.character, { ...record(who), items });
  const board = async (who) => {
    const r = await s.call('/v1/writs/list', { character: who.character, region: 17 }, who.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body.crafts;
  };
  /** a writ of the account's day turned to `product` (its count, pay, XP and Renown the law's) - the day's dice are the law's own pin */
  const aim = (who, slot, product, qty = undefined) => {
    const w = craftWritOf(product, qty);
    const day = utcDay(_now);
    raw.prepare('UPDATE craft_writs SET product = ?, tier = ?, faction = ?, qty = ?, pay = ?, xp = ?, renown = ?, track = ? WHERE player = ? AND slot = ? AND day = ?')
      .run(w.product, w.tier, w.faction, w.qty, w.pay, w.xp, w.renown, w.track, who.id, slot, day);
    return { ...w, id: raw.prepare('SELECT id FROM craft_writs WHERE player = ? AND slot = ? AND day = ?').get(who.id, slot, day).id };
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
  const deliver = (who, id, extra = {}) => s.call('/v1/writs/craft', { character: who.character, id, rid: rid(), realm: who.at(), ...extra }, who.secret);
  return { ...s, raw, give, xpOf, setXp, balance, record, pack, board, aim, brew, cook, deliver };
}

// ─── THE BOARD ───────────────────────────────────────────────────────

test('CRAFT-WRITS service: an account\'s first board read of the day posts its three - the law\'s own draw, the account\'s dice at its best crafter\'s ranks (a potion, a dish, a second potion where none has smithed); read again, or by another of its characters, the same three and nothing written; another account sees none of them; a character that is not the account\'s posts nothing (mutants: the ranks unread; the slot\'s draw; the account\'s best; the seed)', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  s.setXp(mac, 'provisioning', xpForRank(30));
  const first = await s.board(mac);
  const day = utcDay(_now);
  const law = craftWritsFor(day, mac.id, { provisioning: 30, smithing: 0, smithed: false });
  assert.deepEqual(first.writs.map((w) => [w.id, w.product, w.qty, w.pay, w.xp, w.renown, w.track, w.faction, w.state]),
    law.map((w) => [`k:${day}:${mac.character}:${w.slot}`, w.product, w.qty, w.pay, w.xp, w.renown, w.track, w.faction, 'open']));
  assert.deepEqual(first.writs.map((w) => w.kind), ['potion', 'dish', 'potion']);
  assert.deepEqual(first.today, { filled: 0, max: CRAFT_WRITS_PER_DAY });
  assert.deepEqual([first.writs[0].brewed, first.writs[1].pieces], [0, []], 'nothing brewed, nothing cooked');
  assert.deepEqual((await s.board(mac)).writs.map((w) => w.id), first.writs.map((w) => w.id), 'the same three');
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM craft_writs').get().n, 3);
  // the account's second character reads the same three - the writs are the account's (E1: a character's own let an
  // account of six choose its best three of eighteen)
  const R2 = await seatRealm(s.env, mac.secret, 'Mac Two');
  const two = { ...mac, character: R2.id, at: R2.at };
  assert.deepEqual((await s.board(two)).writs.map((w) => w.id), first.writs.map((w) => w.id), 'the account\'s three, under the first reader\'s id');
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM craft_writs').get().n, 3);
  // smithed by ANY of its characters, at the best of their ranks: a kit third, at the smith's Smithing and Mac's Provisioning
  s.setXp(two, 'smithing', xpForRank(25));
  s.setXp(two, 'provisioning', xpForRank(5));
  s.raw.prepare('DELETE FROM craft_writs').run();
  const smith = await s.board(two);
  assert.equal(smith.writs[2].kind, 'kit');
  assert.deepEqual(smith.writs.map((w) => [w.id, w.product]), craftWritsFor(day, mac.id, { provisioning: 30, smithing: 25, smithed: true }).map((w) => [`k:${day}:${two.character}:${w.slot}`, w.product]));
  // the BEST, whatever the dice: a Master cook on one character, a Novice on the other - the dish a Master's alone
  s.setXp(mac, 'provisioning', xpForRank(100));
  s.raw.prepare('DELETE FROM craft_writs').run();
  assert.equal((await s.board(two)).writs[1].product, 'dish:feast', 'the Feast, the one dish a Master is asked');
  // the account's dice, day after day - never the reading character's
  for (let i = 0; i < 3; i++) {
    _now += DAY;
    const next = await s.board(i % 2 ? mac : two);
    assert.deepEqual(next.writs.map((w) => w.product), craftWritsFor(utcDay(_now), mac.id, { provisioning: 100, smithing: 25, smithed: true }).map((w) => w.product), `day ${i}`);
  }
  // another account: its own, never Mac's - and a character id that is not its own posts nothing and reads nothing
  const ann = await s.seated('Ann');
  const annBoard = await s.board(ann);
  assert.equal(annBoard.writs.length, 3);
  assert.ok(annBoard.writs.every((w) => w.id.includes(ann.character)));
  const r = await s.call('/v1/writs/list', { character: mac.character, region: 17 }, ann.secret);
  assert.deepEqual([r.status, r.body.crafts?.writs], [200, []]);
  // a character of Mac's no board has read today, asked by Ann: nothing posted under either account
  s.raw.prepare('DELETE FROM craft_writs WHERE player = ?').run(mac.id);
  const asked = await s.call('/v1/writs/list', { character: R2.id, region: 17 }, ann.secret);
  assert.deepEqual([asked.status, asked.body.crafts?.writs, s.raw.prepare('SELECT COUNT(*) AS n FROM craft_writs WHERE player = ?').get(mac.id).n], [200, [], 0]);
});

// ─── A POTION WRIT ───────────────────────────────────────────────────

test('CRAFT-WRITS service: a potion writ filled - two Novice brews of Healing (two potions each, witnessed whole), its four bottles out of the realm record (the plain before the Potent, a stack giving part of itself), the pay struck as a `craft-writ` mint, twice it to Provisioning, the Renown at the rate, the Temple of Stendarr\'s standing on the Roll, the record one on; asked again, its row; the brews it took are taken (mutants: the brews uncounted; the pay\'s line; the XP\'s track; the Roll\'s faction)', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  await s.board(mac);
  const w = s.aim(mac, 0, 'potion:healing');
  assert.equal(w.qty, 4);
  // the Roll keeps the Temple of Stendarr for this character (CHAP1's row), at 10
  s.raw.prepare('INSERT INTO npc_roll_heads (char_id, player, cap, seq, tag, seeded_at, updated_at) VALUES (?, ?, 0, 1, ?, ?, ?)').run(mac.character, mac.id, 'seed', _now, _now);
  s.raw.prepare('INSERT INTO npc_roll (char_id, player, faction_id, rep, owed, member) VALUES (?, ?, ?, 10, 0, 0)').run(mac.character, mac.id, DIVINES.Stendarr);
  // nothing brewed: refused, nothing moved
  s.pack(mac, [bottles('potion:healing', 4), { templateIndex: 1, name: 'Torch' }]);
  const none = await s.deliver(mac, w.id);
  assert.deepEqual([none.status, none.body], [409, { error: 'craft-unbrewed' }], 'looted bottles: no brew stands behind them');
  assert.deepEqual([mac.at().seq, s.record(mac).items.length, s.balance(mac)], [1, 2, 0], 'the record untouched');
  const b1 = await s.brew(mac, 'healing', HEALING);
  const b2 = await s.brew(mac, 'healing', HEALING);
  assert.deepEqual([b1.count, b2.count], [2, 2]);
  assert.deepEqual(s.raw.prepare('SELECT witnessed FROM prof_brews WHERE char_id = ?').all(mac.character).map((r) => r.witnessed), [1, 1], 'no loose unit: witnessed whole');
  assert.equal((await s.board(mac)).writs[0].brewed, 4);
  s.pack(mac, [bottles('potion:healing', 3, { potent: 25 }), { templateIndex: 1, name: 'Torch' }, bottles('potion:healing', 2)]);
  const xp0 = s.xpOf(mac, 'provisioning');
  const ok = await s.deliver(mac, w.id);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.deepEqual([ok.body.pay, ok.body.xp, ok.body.writ.state, ok.body.today, ok.body.realm, ok.body.renown.credited], [w.pay, w.xp, 'mine', { filled: 1, max: 3 }, { seq: 2 }, renownRate(2 * w.pay)]);
  assert.deepEqual([s.balance(mac), ok.body.balance, s.xpOf(mac, 'provisioning') - xp0, ok.body.track.profession], [w.pay, w.pay, w.xp, 'provisioning']);
  assert.deepEqual(s.raw.prepare("SELECT kind, amount, src_kind, dst_id, rid FROM marks_ledger WHERE kind = 'craft-writ'").all().map((r) => ({ ...r })),
    [{ kind: 'craft-writ', amount: w.pay, src_kind: 'mint', dst_id: mac.id, rid: `craft:${w.id}` }]);
  const rec = s.record(mac);
  assert.deepEqual(rec.items.map((it) => [it.name ?? 'bottle', it.stackCount ?? 1, it.potent ?? 0]), [['bottle', 1, 25], ['Torch', 1, 0]], 'the two plain and two of the Potent three gone');
  assert.equal(Number(s.raw.prepare('SELECT rep FROM npc_roll WHERE char_id = ? AND faction_id = ?').get(mac.character, DIVINES.Stendarr).rep), 10 + HALL_WRIT_REP);
  const again = await s.call('/v1/writs/craft', { character: mac.character, id: w.id, rid: `cw-${String(_rid).padStart(8, '0')}`, realm: mac.at() }, mac.secret);
  assert.deepEqual([again.status, again.body.repeat, again.body.pay, s.balance(mac)], [200, true, w.pay, w.pay], 'its row\'s answer, nothing struck twice');
  assert.equal((await s.board(mac)).writs[0].state, 'mine');
  // the four brews are spent: another Healing writ tomorrow asks brews of its own
  _now += DAY;
  await s.board(mac);
  const w2 = s.aim(mac, 0, 'potion:healing');
  s.pack(mac, [bottles('potion:healing', 4)]);
  assert.deepEqual((await s.deliver(mac, w2.id)).body, { error: 'craft-unbrewed' }, 'yesterday\'s four went to yesterday\'s writ');
});

// PIN MOVED (ANY-GOODS, FIELD BUGS 2026-10-26, the owner: "Crafting writs should work with even store bought ingredients"):
// a cauldron that spent a LOOSE unit was no witness and its potions filled nothing - it is the character's brew now
test('CRAFT-WRITS service: a cauldron that spent a LOOSE unit (looted, or bought with gold - ANY-GOODS) is the character\'s brew all the same - its potions count; too few brews are refused craft-unbrewed; brews without the bottles in the record are refused craft-goods-gone and nothing moves; a writ of another character, of yesterday, or with no record named is refused (mutants: the witness asked again; the record\'s take)', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  await s.board(mac);
  const w = s.aim(mac, 0, 'potion:healing');
  s.give(mac, 'p1:16', 'loose', 1);
  await s.brew(mac, 'healing', HEALING);
  assert.deepEqual(s.raw.prepare('SELECT witnessed FROM prof_brews WHERE char_id = ?').all(mac.character).map((r) => r.witnessed), [0], 'it spent the loose Red Berries - its record says so');
  assert.equal((await s.board(mac)).writs[0].brewed, 2, 'and the card counts it');
  s.pack(mac, [bottles('potion:healing', 4)]);
  assert.deepEqual((await s.deliver(mac, w.id)).body, { error: 'craft-unbrewed' }, 'two brewed of four');
  await s.brew(mac, 'healing', HEALING);
  s.pack(mac, [bottles('potion:healing', 3)]);
  const gone = await s.deliver(mac, w.id);
  assert.deepEqual([gone.status, gone.body, mac.at().seq, s.balance(mac)], [409, { error: 'craft-goods-gone' }, 1, 0], 'three bottles of four: nothing out, nothing struck');
  assert.deepEqual(Object.values(await s.call('/v1/writs/craft', { character: mac.character, id: w.id, rid: rid() }, mac.secret)), [400, { error: 'realm-needed' }]);
  // a character that is no realm character at all (the router's seat asks first; the act's own door holds too)
  const row = s.raw.prepare('SELECT * FROM players WHERE id = ?').get(mac.id);
  assert.deepEqual(await deliverCraftWrit({ db: s.env.DB, nowS: _now, rand: (n) => globalThis.crypto.getRandomValues(new Uint8Array(n)), bucket: s.env.SAVES }, row, { PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' }, { character: 'char-mac1', id: w.id, rid: rid() }), { error: 'realm-needed' });
  const ann = await s.seated('Ann');
  assert.deepEqual((await s.call('/v1/writs/craft', { character: ann.character, id: w.id, rid: rid(), realm: ann.at() }, ann.secret)).body, { error: 'no-writ' });
  _now += DAY;
  s.pack(mac, [bottles('potion:healing', 4)]);
  assert.deepEqual((await s.deliver(mac, w.id)).body, { error: 'writ-expired' });
  // the character that read first deleted: the account's writs stand - E1, they were never its own
  await s.board(ann);
  const del = await s.call('/v1/realm/delete', { id: ann.character }, ann.secret);
  assert.equal(del.status, 200, JSON.stringify(del.body));
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM craft_writs WHERE player = ? AND filled_at IS NULL').get(ann.id).n, 3);
});

// ─── A DISH OR KIT WRIT ──────────────────────────────────────────────

test('CRAFT-WRITS service: a dish writ filled by three servings of the character\'s own cooking - their rows gone with them, each out of the record by its provenance; a piece another character made, one listed, or one too few refused craft-pieces (mutants: the maker\'s character; the listing guard; the rows\' delete)', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  await s.board(mac);
  const w = s.aim(mac, 1, 'dish:stew');
  assert.deepEqual([w.qty, w.faction, w.track], [3, GUILD_FACTION_IDS.FightersGuild, 'provisioning']);
  const pvs = [...await s.cook(mac, 'stew:north'), ...await s.cook(mac, 'stew:south'), ...await s.cook(mac, 'stew:north')];
  const dish = (pv, recipe = 'stew:north') => ({ group: 'UselessItems2', templateIndex: 685, provenance: pv, recipe, name: 'Hunter\'s Stew' });
  s.pack(mac, [dish(pvs[0]), dish(pvs[1], 'stew:south'), dish(pvs[2]), { templateIndex: 1, name: 'Torch' }]);
  assert.deepEqual((await s.board(mac)).writs[1].pieces, [...pvs].reverse(), 'the three of its make, newest first (AUDIT CRAFT-WRITS S3)');
  assert.deepEqual((await s.deliver(mac, w.id, { pieces: pvs.slice(0, 2) })).body, { error: 'craft-pieces' }, 'two of three');
  s.raw.prepare('UPDATE products SET listed = 1 WHERE provenance = ?').run(pvs[2]);
  const listed = await s.deliver(mac, w.id, { pieces: pvs });
  assert.deepEqual([listed.body, mac.at().seq], [{ error: 'craft-pieces' }, 1], 'one on the market');
  s.raw.prepare('UPDATE products SET listed = 0, char_id = ? WHERE provenance = ?').run('r00000000000000000000', pvs[2]);
  assert.deepEqual((await s.deliver(mac, w.id, { pieces: pvs })).body, { error: 'craft-pieces' }, 'another character\'s make');
  s.raw.prepare('UPDATE products SET char_id = ? WHERE provenance = ?').run(mac.character, pvs[2]);
  const ok = await s.deliver(mac, w.id, { pieces: pvs });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.deepEqual([ok.body.pay, s.balance(mac), pvs.map((pv) => s.raw.prepare('SELECT 1 FROM products WHERE provenance = ?').get(pv) ?? null)], [w.pay, w.pay, [null, null, null]]);
  assert.deepEqual(s.record(mac).items.map((it) => it.name), ['Torch']);
});

test('CRAFT-WRITS service: a kit writ\'s XP is Smithing\'s, its kits made with the smith\'s counter leather (AUDIT CRAFT-WRITS T2: a piece of goods bought for silver is still its maker\'s); the account\'s writs are filled by any of its characters, each with its OWN witnessed brews (another\'s count for nothing - T3), the XP and Renown its own; the day\'s three filled, every card is "mine" and the count 3 of 3; the next day three more; a balance with no room is refused marks-full (mutants: the brews\' character; the filler; the bought refused; the owner only - the day\'s count is the schema\'s, its mutant equivalent)', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  s.setXp(mac, 'smithing', xpForRank(10));
  await s.board(mac);
  const kit = s.aim(mac, 2, 'kit:iron');
  const kits = [];
  for (let i = 0; i < kit.qty; i++) {
    // the Cured Leather bought at the smith's counter (professionLaw SMITH_STOCK), the ingot mined
    for (const { key, n } of recipeById('kit:iron').inputs) s.give(mac, key, key === 'leather:cured' ? 'bought' : 'own', n);
    const r = await s.call('/v1/prof/craft', { character: mac.character, recipe: 'kit:iron', clean: false, name: 'Mac', rid: rid() }, mac.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    kits.push(r.body.pieces[0].provenance);
  }
  assert.deepEqual(kits.map((pv) => s.raw.prepare('SELECT bought_with FROM products WHERE provenance = ?').get(pv).bought_with), ['marks', 'marks', 'marks'], 'made of goods bought for silver (AUDIT PROF-541 B7\'s mark)');
  assert.deepEqual((await s.board(mac)).writs[2].pieces.slice().sort(), kits.slice().sort(), 'the card names them');
  s.pack(mac, kits.map((pv) => ({ group: 'UselessItems2', templateIndex: 692, provenance: pv, recipe: 'kit:iron', name: 'Iron Repair Kit' })));
  const smith0 = s.xpOf(mac, 'smithing');
  const ok = await s.deliver(mac, kit.id, { pieces: kits });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.deepEqual([ok.body.track.profession, s.xpOf(mac, 'smithing') - smith0], ['smithing', kit.xp]);
  // Mac's own Healing brews - four witnessed, never the account's
  const heal = s.aim(mac, 0, 'potion:healing');
  await s.brew(mac, 'healing', HEALING);
  await s.brew(mac, 'healing', HEALING);
  // the account takes up its second character (it holds the lease now): the same three, the kit Mac's, filled
  const R2 = await seatRealm(s.env, mac.secret, 'Mac Two');
  const two = { ...mac, character: R2.id, at: R2.at };
  const view = await s.board(two);
  assert.deepEqual([view.writs.map((w) => w.id), view.writs.map((w) => w.state), view.today], [[heal.id, view.writs[1].id, kit.id], ['open', 'open', 'mine'], { filled: 1, max: 3 }]);
  assert.equal(view.writs[0].brewed, 0, 'Mac\'s four are Mac\'s');
  s.pack(two, [bottles('potion:healing', 4)]);
  const short = await s.deliver(two, heal.id);
  assert.deepEqual([short.status, short.body, two.at().seq], [409, { error: 'craft-unbrewed' }, 1], 'another character\'s brews fill nothing: nothing out of the record');
  await s.brew(two, 'healing', HEALING);
  await s.brew(two, 'healing', HEALING);
  const [macProv, twoProv] = [s.xpOf(mac, 'provisioning'), s.xpOf(two, 'provisioning')];
  const filled = await s.deliver(two, heal.id);
  assert.equal(filled.status, 200, JSON.stringify(filled.body));
  assert.deepEqual([s.xpOf(two, 'provisioning') - twoProv, s.xpOf(mac, 'provisioning') - macProv, filled.body.track.profession, filled.body.writ.state], [heal.xp, 0, 'provisioning', 'mine'], 'the filler\'s XP');
  assert.deepEqual(s.raw.prepare('SELECT filled_char FROM craft_writs WHERE filled_at IS NOT NULL ORDER BY slot').all().map((r) => r.filled_char), [two.character, mac.character]);
  // the third by hand: the day's three filled - the schema holds the count (three slots an account a day, UNIQUE(day,
  // player, slot)); the decision's own count is the faucet's word beside it
  s.raw.prepare("UPDATE craft_writs SET filled_at = ?, filled_char = ?, rid = 'byhand' || slot, n = 'x' WHERE player = ? AND slot = 1").run(_now, two.character, mac.id);
  const full = await s.board(two);
  assert.deepEqual([full.writs.map((w) => w.state), full.today], [['mine', 'mine', 'mine'], { filled: 3, max: CRAFT_WRITS_PER_DAY }]);
  // the next day: three more, under the id of the character that read first
  _now += DAY;
  const next = await s.board(two);
  assert.deepEqual([next.writs.map((w) => w.id.split(':')[2]), next.today.filled], [[two.character, two.character, two.character], 0]);
  // marks-full: a balance at the cap
  const w4 = s.aim(two, 0, 'potion:healing');
  await s.brew(two, 'healing', HEALING);
  await s.brew(two, 'healing', HEALING);
  s.pack(two, [bottles('potion:healing', 4)]);
  s.raw.prepare('UPDATE marks SET balance = ? WHERE account = ?').run(10_000_000, mac.id);
  assert.deepEqual((await s.deliver(two, w4.id)).body, { error: 'marks-full' });
});

// ─── AUDIT CRAFT-WRITS (bible/01-Overview/audits/Audit-Craft-Writs.md) ─

test('AUDIT CRAFT-WRITS S1: a potion writ\'s brews are counted against the potion writs the character filled of THAT potion alone - a stew writ filled first takes none of them (the decision bound the product as the subquery\'s own column, so every filled writ of any product was taken away) (mutants: the product unbound)', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  await s.board(mac);
  const stew = s.aim(mac, 1, 'dish:stew');
  const pvs = [...await s.cook(mac, 'stew:north'), ...await s.cook(mac, 'stew:north'), ...await s.cook(mac, 'stew:north')];
  s.pack(mac, pvs.map((pv) => ({ group: 'UselessItems2', templateIndex: 685, provenance: pv, recipe: 'stew:north', name: 'Hunter\'s Stew' })));
  assert.equal((await s.deliver(mac, stew.id, { pieces: pvs })).status, 200);
  const w = s.aim(mac, 0, 'potion:healing');
  await s.brew(mac, 'healing', HEALING);
  await s.brew(mac, 'healing', HEALING);
  s.pack(mac, [bottles('potion:healing', 4)]);
  assert.equal((await s.board(mac)).writs[0].brewed, 4);
  const ok = await s.deliver(mac, w.id);
  assert.equal(ok.status, 200, JSON.stringify(ok.body) + JSON.stringify(s.raw.prepare('SELECT product, qty, filled_at FROM craft_writs').all()));
});

test('AUDIT CRAFT-WRITS S2/S3: the board names the pieces the decision would take - never one listed, walled to gold or of another\'s make beside an eligible one (its check named the outer piece as its own) - newest first, so a cook\'s fresh dishes are named before the rows of dishes long eaten (mutants: the alias shared; the order oldest first)', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  await s.board(mac);
  s.aim(mac, 1, 'dish:stew');
  const pvs = [];
  for (let i = 0; i < 5; i++) { pvs.push(...await s.cook(mac, 'stew:north')); _now += 60; }
  s.raw.prepare('UPDATE products SET listed = 1 WHERE provenance = ?').run(pvs[3]);
  s.raw.prepare("UPDATE products SET bought_with = 'gold' WHERE provenance = ?").run(pvs[1]);   // a loose-made piece's mark (AUDIT BAG-CRAFT A1)
  assert.deepEqual((await s.board(mac)).writs[1].pieces, [pvs[4], pvs[2], pvs[0]], 'the eligible three, newest first');
});

test('AUDIT CRAFT-WRITS S4: a writ already filled, asked again under a new request id, is REFUSED (craft-writ-filled) and moves nothing - an `ok` there had the client keep the goods it took out while the record kept them too (mutants: the old repeat answer)', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  await s.board(mac);
  const w = s.aim(mac, 0, 'potion:healing');
  await s.brew(mac, 'healing', HEALING);
  await s.brew(mac, 'healing', HEALING);
  s.pack(mac, [bottles('potion:healing', 8)]);
  assert.equal((await s.deliver(mac, w.id)).status, 200);
  const at = mac.at();
  const again = await s.deliver(mac, w.id);
  assert.deepEqual([again.status, again.body, mac.at().seq, s.record(mac).items[0].stackCount], [409, { error: 'craft-writ-filled' }, at.seq, 4], 'the record untouched');
});

test('AUDIT CRAFT-WRITS S6: the hour\'s sweep reads the open writs by their own index, never the whole table the filled ones keep growing (mutants: the index dropped)', async () => {
  const s = await stand();
  const plan = s.raw.prepare('EXPLAIN QUERY PLAN SELECT id FROM craft_writs WHERE filled_at IS NULL AND expires_at < ?1 LIMIT ?2').all(1, 2).map((r) => r.detail).join(' | ');
  assert.match(plan, /idx_craft_writs_open/, plan);
});

test('AUDIT CRAFT-WRITS T3: every guard on a piece holds on the board and in the decision alike (one SQL) - one at auction, one on the road (by its provenance, or carried in an item\'s record), one in a home, one with no craft row of the account\'s behind it: none named, none taken (mutants: each guard)', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  await s.board(mac);
  const w = s.aim(mac, 1, 'dish:stew');
  const pvs = [];
  for (let i = 0; i < 6; i++) { pvs.push(...await s.cook(mac, 'stew:north')); _now += 60; }
  s.raw.prepare(`INSERT INTO market_auctions (id, seller, char_id, region, provenance, wear, opening, fee, at, ends_at, state, rid, n)
    VALUES ('a1', ?, ?, 17, ?, 1000, 10, 1, ?, ?, 'open', 'r-a1', 'n')`).run(mac.id, mac.character, pvs[0], _now, _now + DAY);
  s.raw.prepare(`INSERT INTO market_deliveries (id, player, char_id, provenance, wear, why, arrives_at, at) VALUES ('d1', ?, ?, ?, 1000, 'returned', ?, ?)`)
    .run(mac.id, mac.character, pvs[1], _now + 600, _now);
  s.raw.prepare(`INSERT INTO market_deliveries (id, player, char_id, item, why, arrives_at, at) VALUES ('d2', ?, ?, ?, 'returned', ?, ?)`)
    .run(mac.id, mac.character, JSON.stringify({ templateIndex: 685, provenance: pvs[2] }), _now + 600, _now);
  s.raw.exec('PRAGMA foreign_keys = OFF');
  s.raw.prepare(`INSERT INTO home_decor (map_id, building_key, id, place, placed_at, item) VALUES (5, 1, 'x1', '{}', ?, ?)`).run(_now, JSON.stringify({ pv: pvs[3] }));
  s.raw.exec('PRAGMA foreign_keys = ON');
  s.raw.prepare('DELETE FROM prof_crafts WHERE provenance = ? OR provenance2 = ?').run(pvs[4], pvs[4]);
  assert.deepEqual((await s.board(mac)).writs[1].pieces, [pvs[5]], 'the one piece no guard holds');
  s.pack(mac, pvs.map((pv) => ({ group: 'UselessItems2', templateIndex: 685, provenance: pv, recipe: 'stew:north', name: 'Hunter\'s Stew' })));
  for (let i = 0; i < 5; i++) {
    const r = await s.deliver(mac, w.id, { pieces: [pvs[i], pvs[(i + 1) % 5], pvs[5]] });
    assert.deepEqual([r.status, r.body, mac.at().seq], [409, { error: 'craft-pieces' }, 1], `guard ${i}`);
  }
});

test('AUDIT CRAFT-WRITS T3: the hour\'s sweep takes an open writ only a whole day after its own ended - and never a filled one, whose brews it took would come back to pay again (mutants: the filled kept; the day\'s grace)', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  await s.board(mac);
  const day = utcDay(_now);
  s.raw.prepare("UPDATE craft_writs SET filled_at = ?, filled_char = ?, rid = 'byhand', n = 'x' WHERE player = ? AND slot = 0").run(_now, mac.character, mac.id);
  const end = (day + 1) * DAY;
  assert.equal(await sweepCraftWrits(s.env.DB, end + DAY - 1), 0, 'inside the day after: all stand');
  assert.equal(await sweepCraftWrits(s.env.DB, end + DAY + 1), 2, 'the two open go');
  assert.deepEqual(s.raw.prepare('SELECT slot FROM craft_writs').all().map((r) => r.slot), [0], 'the filled one stays');
});

test('AUDIT CRAFT-WRITS T3: the rest of the fill - Renown added to a track the character holds, the XP under the crafter\'s limit, no standing while the Chapters are shut, the judge\'s hold (INT3: silver comes of the goods), the Marks shut on the board and the route, and the progress claim\'s XP and Renown (mutants: the Renown update; the limit; the Chapters gate; outbound; marks-closed; the progress case)', async () => {
  const s = await stand({ CHAPTERS_OPEN: 'off' });
  const mac = await s.seated('Mac');
  await s.board(mac);
  const w = s.aim(mac, 0, 'potion:healing');
  s.raw.prepare('INSERT INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, NULL, 100, ?, ?)').run(mac.id, mac.character, _now, _now);
  s.raw.prepare('INSERT INTO npc_roll_heads (char_id, player, cap, seq, tag, seeded_at, updated_at) VALUES (?, ?, 0, 1, ?, ?, ?)').run(mac.character, mac.id, 'seed', _now, _now);
  s.raw.prepare('INSERT INTO npc_roll (char_id, player, faction_id, rep, owed, member) VALUES (?, ?, ?, 10, 0, 0)').run(mac.character, mac.id, DIVINES.Stendarr);
  // two other crafts past Journeyman: Provisioning's limit is the rank below it, nine short
  const past = rankXp(JOURNEYMAN_RANK + 1);
  s.setXp(mac, 'smithing', past);
  s.setXp(mac, 'enchanting', past);
  await s.brew(mac, 'healing', HEALING);
  await s.brew(mac, 'healing', HEALING);
  s.setXp(mac, 'provisioning', past - 10);
  s.pack(mac, [bottles('potion:healing', 4)]);
  // the judge holds the character: nothing out, nothing struck - the route's own hold, behind the router's progress gate
  s.raw.prepare("UPDATE realm_characters SET held = 'staff' WHERE id = ?").run(mac.character);
  assert.equal((await s.deliver(mac, w.id)).status, 403, 'the router\'s gate');
  const ctx = { db: s.env.DB, nowS: _now, rand: (n) => globalThis.crypto.getRandomValues(new Uint8Array(n)), bucket: s.env.SAVES };
  const row = s.raw.prepare('SELECT * FROM players WHERE id = ?').get(mac.id);
  const held = await deliverCraftWrit(ctx, row, { PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' }, { character: mac.character, id: w.id, rid: rid(), realm: mac.at() });
  assert.deepEqual([held.error, mac.at().seq, s.balance(mac)], ['trade-held', 1, 0]);
  s.raw.prepare('UPDATE realm_characters SET held = NULL WHERE id = ?').run(mac.character);
  const ok = await s.deliver(mac, w.id);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.deepEqual([ok.body.xp, s.xpOf(mac, 'provisioning'), ok.body.renown.credited, Number(s.raw.prepare('SELECT xp FROM renown_tracks WHERE char_id = ?').get(mac.character).xp)],
    [9, past - 1, w.renown, 100 + w.renown], 'nine to the limit; the Renown added to the hundred');
  assert.equal(Number(s.raw.prepare('SELECT rep FROM npc_roll WHERE char_id = ?').get(mac.character).rep), 10, 'the Chapters shut: no standing');
  assert.deepEqual(progressSpentOf('/v1/writs/craft', ok.body), [['prof', 9], ['renown', w.renown]]);
  assert.deepEqual(progressSpentOf('/v1/writs/craft', { ...ok.body, repeat: true }), []);
  // the Marks shut: the board posts and shows nothing, the route refuses
  const shut = await stand({ MARKS_OPEN: 'off' });
  const ann = await shut.seated('Ann');
  const r = await shut.call('/v1/writs/list', { character: ann.character, region: 17 }, ann.secret);
  assert.deepEqual([r.body.crafts?.writs, shut.raw.prepare('SELECT COUNT(*) AS n FROM craft_writs').get().n], [[], 0]);
  assert.deepEqual((await shut.deliver(ann, `k:${utcDay(_now)}:${ann.character}:0`)).body, { error: 'marks-closed' });
});

test('AUDIT CRAFT-WRITS S5: a request id that filled ANOTHER writ while this one was being decided is that request - answered its row, never a refusal for goods it never needed (mutants: the rid\'s read after the batch)', async () => {
  const s = await stand();
  const mac = await s.seated('Mac');
  await s.board(mac);
  const a = s.aim(mac, 0, 'potion:healing');
  const b = s.aim(mac, 2, 'potion:healing');
  for (let i = 0; i < 4; i++) await s.brew(mac, 'healing', HEALING);
  s.pack(mac, [bottles('potion:healing', 8)]);
  const same = rid();
  assert.equal((await s.call('/v1/writs/craft', { character: mac.character, id: a.id, rid: same, realm: mac.at() }, mac.secret)).status, 200);
  // the same request asked over writ B, its first read of the id made before A's batch landed (a proxy hides the row once)
  let hidden = true;
  const db = new Proxy(s.env.DB, {
    get(t, k) {
      if (k === 'prepare') return (sql) => (hidden && sql === 'SELECT * FROM craft_writs WHERE player = ?1 AND rid = ?2' ? ((hidden = false), t.prepare('SELECT * FROM craft_writs WHERE 0 AND player = ?1 AND rid = ?2')) : t.prepare(sql));
      const v = t[k];
      return typeof v === 'function' ? v.bind(t) : v;
    },
  });
  const ctx = { db, nowS: _now, rand: (n) => globalThis.crypto.getRandomValues(new Uint8Array(n)), bucket: s.env.SAVES };
  const row = s.raw.prepare('SELECT * FROM players WHERE id = ?').get(mac.id);
  const r = await deliverCraftWrit(ctx, row, { PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', CHAPTERS_OPEN: 'on' }, { character: mac.character, id: b.id, rid: same, realm: mac.at() });
  assert.deepEqual([r.ok, r.repeat, r.writ?.id, mac.at().seq, s.record(mac).items[0].stackCount], [true, true, a.id, 2, 4], 'A\'s row; B\'s goods never left');
});
