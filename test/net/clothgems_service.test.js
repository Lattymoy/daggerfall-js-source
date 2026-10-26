// CLOTH-GEMS (2026-10-25; the player SaberGGaming's "Profession oversights", the owner: "No band aids") - THE SERVICE.
// The loom's Linen and Wool and AUDIT 32 S1 judged by the units, driven through the real Worker over node:sqlite with
// every migration applied (test/accountDb.mjs): furs spin to Wool and Root Tendrils weave to Linen at
// `/v1/prof/smelt`, own where their goods were; a garment of the character's own cloth lays on its first-make 500, one of
// the Weavers' cloth (bought at the counter) or of a pack's word (loose) never does - the bought units spent first; the
// answer says which (`firstPaid`). bible/06-Systems/Professions-Arc.md 50.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from '../accountDb.mjs';
import { xpForRank } from '../../src/net/professionLaw.js';
import { firstCraftXp, recipeById, FIRST_MAKE_SHARE } from '../../src/net/recipeLaw.js';
/** FIRST-BUDGET (Professions-Arc 52): a garment's first, Outfitting's first-make share asked as own - 511, the least that
 *  brings Outfitting to Master in Smithing's crafts (CLOTH-GEMS says whether a first pays, the share how much). */
const FIRST_CRAFT_XP = firstCraftXp(recipeById('garment-141:linen'), true);
import { utcDay } from '../../src/net/marksLaw.js';

const NOON = utcDay(T0) * 86_400 + 12 * 3600;
const realNow = Date.now;
Date.now = () => NOON * 1000;
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = () => `clgm-${String(++_rid).padStart(6, '0')}`;

async function stand() {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const mac = await s.seated('Mac');
  const stores = (m) => raw.prepare('SELECT origin, qty FROM prof_stores WHERE player = ? AND char_id = ? AND material = ? ORDER BY origin').all(mac.id, mac.character, m).map((r) => [r.origin, Number(r.qty)]);
  const give = (m, origin, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(mac.id, mac.character, m, origin, qty);
  const xpOf = (p) => Number(raw.prepare('SELECT xp FROM prof_tracks WHERE player = ? AND char_id = ? AND profession = ?').get(mac.id, mac.character, p)?.xp ?? 0);
  const setXp = (p, xp) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp`).run(mac.id, mac.character, p, xp, NOON);
  const fund = (marks) => raw.prepare('INSERT INTO marks (account, balance) VALUES (?, ?) ON CONFLICT (account) DO UPDATE SET balance = excluded.balance').run(mac.id, marks);
  const work = (recipe, count) => s.call('/v1/prof/smelt', { character: mac.character, recipe, count, rid: rid() }, mac.secret);
  const craft = (recipe) => s.call('/v1/prof/craft', { character: mac.character, recipe, clean: false, name: 'Mac', rid: rid() }, mac.secret);
  return { s, raw, mac, stores, give, xpOf, setXp, fund, work, craft };
}

test('CLOTH-GEMS service: furs spin to Wool and Root Tendrils weave to Linen at the loom - two a bolt, own where their goods were and bought where they were bought, no XP and no track (mutants: a spin or a weave refused, its origin lost)', async () => {
  const { stores, give, xpOf, work } = await stand();
  give('hide:wolf', 'own', 4);
  const spun = await work('spin:wolf', 2);
  assert.equal(spun.status, 200, JSON.stringify(spun.body));
  assert.deepEqual([spun.body.own, spun.body.bought, spun.body.xp, spun.body.track], [2, 0, 0, null]);
  assert.deepEqual([stores('hide:wolf'), stores('cloth:wool')], [[], [['own', 2]]]);
  give('hide:rat', 'bought', 2);
  assert.deepEqual([(await work('spin:rat', 1)).body.bought, stores('cloth:wool')], [1, [['bought', 1], ['own', 2]]], 'a bought pelt spins a bought bolt');
  give('p1:12', 'own', 4);
  give('p2:12', 'own', 2);
  const north = await work('weave:linen-north', 2);
  const south = await work('weave:linen-south', 1);
  assert.deepEqual([north.status, north.body.own, south.status, south.body.own], [200, 2, 200, 1]);
  assert.deepEqual([stores('p1:12'), stores('p2:12'), stores('cloth:linen')], [[], [], [['own', 3]]]);
  assert.deepEqual((await work('weave:linen-north', 1)).body, { error: 'stores-short' }, 'no Root Tendrils left');
  assert.equal(xpOf('outfitting'), 0, 'a spin and a weave pay no XP, as a cure pays none');
});

test('CLOTH-GEMS service: AUDIT 32 S1 JUDGES THE UNITS - Linen Straps of the loom\'s own Linen lay on the first-make 500 and say so; Armbands of the Weavers\' Linen, bought at the counter, record their first and lay on none; a rug while a bought Wool Bolt stands beside the own ones spends it first and lays on none, and a tapestry of the own ones after pays; a pack\'s loose cloth never pays (mutants: the decision\'s own test gone or inverted, the answer\'s word unread)', async () => {
  const { stores, give, xpOf, setXp, fund, work, craft, s, mac } = await stand();
  give('p1:12', 'own', 2);
  assert.equal((await work('weave:linen-north', 1)).status, 200);
  const straps = await craft('garment-141:linen');
  assert.equal(straps.status, 200, JSON.stringify(straps.body));
  assert.deepEqual([straps.body.xp, straps.body.first, straps.body.firstPaid, xpOf('outfitting')], [20 + FIRST_CRAFT_XP, true, true, 20 + FIRST_CRAFT_XP], 'the loom\'s own Linen: its first');
  assert.equal(FIRST_CRAFT_XP, FIRST_MAKE_SHARE.outfitting, 'PIN MOVED (FIRST-BUDGET): Outfitting\'s share, 511');
  fund(100);
  const buy = await s.call('/v1/prof/stock', { character: mac.character, material: 'cloth:linen', qty: 1, rid: rid() }, mac.secret);
  assert.deepEqual([buy.status, stores('cloth:linen')], [200, [['bought', 1]]]);
  const armbands = await craft('garment-142:linen');
  assert.deepEqual([armbands.status, armbands.body.xp, armbands.body.first, armbands.body.firstPaid, xpOf('outfitting')], [200, 20, true, false, 40 + FIRST_CRAFT_XP], 'the Weavers\' Linen: its first recorded, none laid on');   // PIN MOVED (FIRST-BUDGET): the Straps' first and the Armbands' 20
  // Wool: one bought beside six own - the station spends the bought first, so the rug's first pays none
  setXp('outfitting', xpForRank(10));
  give('hide:boar', 'own', 12);
  assert.equal((await work('spin:boar', 6)).status, 200);
  give('cloth:wool', 'bought', 1);
  const rug = await craft('rug-237:wool');
  assert.deepEqual([rug.body.xp, rug.body.first, rug.body.firstPaid, stores('cloth:wool')], [40, true, false, [['own', 4]]], 'the bought bolt went first');
  const tapestry = await craft('tapestry-243:wool');
  assert.deepEqual([tapestry.body.xp, tapestry.body.first, tapestry.body.firstPaid, stores('cloth:wool')], [40 + FIRST_CRAFT_XP, true, true, []], 'own cloth alone: the 500');
  // a pack's cloth the service never handed out - put in at the station as loose - pays none
  const put = await s.call('/v1/stores/deposit', { character: mac.character, material: 'cloth:linen', qty: 2, held: 2, order: 'work', rid: rid() }, mac.secret);
  assert.deepEqual([put.status, put.body.loose, stores('cloth:linen')], [200, 2, [['loose', 2]]]);
  const net = await craft('fishingnet:linen');
  assert.deepEqual([net.status, net.body.xp, net.body.first, net.body.firstPaid], [200, 20, true, false], 'loose cloth: no 500');
  // the record: each first recorded, the 500 where it paid
  const rows = s.env.DB._raw.prepare('SELECT recipe, xp, first FROM prof_crafts WHERE player = ? ORDER BY at, rowid').all(mac.id).map((r) => [r.recipe, Number(r.xp), Number(r.first)]);
  assert.deepEqual(rows, [['garment-141:linen', 20 + FIRST_CRAFT_XP, 1], ['garment-142:linen', 20, 1], ['rug-237:wool', 40, 1], ['tapestry-243:wool', 40 + FIRST_CRAFT_XP, 1], ['fishingnet:linen', 20, 1]]);   // PIN MOVED (FIRST-BUDGET): Outfitting's share
});
