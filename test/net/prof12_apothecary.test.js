// PROF12 (2026-10-02, Mac: "2 and 4"; "lets just finish out everything before merge") - THE APOTHECARY OPENED: a seat's
// Apothecary (Seats-Arc 7.5: "members in Alchemy, Cooking, Jewelcrafting here: +1 step" a tier) raised now its three
// professions' stations stand (fortLaw APOTHECARY_OPEN - AUDIT SEATS-2 L5's gate), and its step a tier for the holder's
// members crafting in its town, each profession's own: a piece of jewellery a quality step (the Forge's and the Workshop's
// law), a dish its XP half again (a dish takes no quality - recipeLaw cookXp), a brew its Potent chance +10 (alchemyLaw
// potentChance). Nobody else, nowhere else, and no other hall's. Driven through the real Worker over node:sqlite with every
// migration applied (test/accountDb.mjs). bible/11-Multiplayer/Seats-Arc.md 7.5; Professions-Arc.md 37.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from '../accountDb.mjs';
import { seatReportText, SEAT_MEMBER_WAIT_S } from '../../src/net/townSeatLaw.js';
import { xpForRank } from '../../src/net/professionLaw.js';
import { recipeById, firstCraftXp } from '../../src/net/recipeLaw.js';
import { fortMayRaise, APOTHECARY_OPEN, stationSteps } from '../../src/net/fortLaw.js';
import { seatWeekOf } from '../../src/net/townSeatLaw.js';

const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const ASHFIELD = { key: 3022, name: 'Ashfield', region: 21, tier: 'palace', pixel: [470, 160] };
const DAY = 86400;
const W = seatWeekOf(T0 * 1000);
let _rid = 0;
const rid = () => `apoth-${String(++_rid).padStart(6, '0')}`;
const realRandom = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
async function steered(b, fn) {
  globalThis.crypto.getRandomValues = (arr) => (arr.byteLength === 4 ? (new Uint8Array(arr.buffer, arr.byteOffset, 4).fill(b), arr) : realRandom(arr));
  try { return await fn(); } finally { globalThis.crypto.getRandomValues = realRandom; }
}

/** A service with Anticlere held by the Silver Hand (seat2b_peace_service.test.js's stand, its few). */
async function stood(t) {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService({ SEATS_OPEN: 'on', MARKS_OPEN: 'on', PROFESSIONS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = svc.env.DB._raw;
  const witnesses = [await svc.guest(), await svc.guest(), await svc.guest()];
  for (const seat of [ANTICLERE, ASHFIELD]) for (const w of witnesses) raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(seat.key), w.id, seatReportText(seat), seat.region, T0 - DAY);
  raw.prepare('INSERT INTO town_seat_weeks (week, settled_at) VALUES (?, ?)').run(W - 1, T0);
  const gm = await svc.seated('Gamal', { renown: 12 });
  assert.equal((await svc.found(gm, { name: 'The Silver Hand', tag: 'SH' })).status, 200);
  const gid = raw.prepare('SELECT guild_id FROM guild_members WHERE player = ? AND char_id = ?').get(gm.id, gm.character).guild_id;
  raw.prepare('UPDATE guild_members SET joined_at = ? WHERE guild_id = ?').run(T0 - SEAT_MEMBER_WAIT_S - DAY, gid);
  raw.prepare(`INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at, tithe, owed)
    VALUES (?, ?, ?, ?, ?, 50, NULL, ?, 6, 0)`).run(ANTICLERE.key, gid, ANTICLERE.region, ANTICLERE.tier, W - 1, T0 - 7 * DAY);
  const member = async (handle) => {
    const m = await svc.seated(handle);
    raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, ?, ?, ?)').run(m.id, m.character, gid, 2, handle, T0 - 30 * DAY);
    return m;
  };
  const work = (w, tier) => raw.prepare(`INSERT INTO town_seat_forts (key, work, tier, building, stands_at, at) VALUES (?, ?, ?, NULL, NULL, ?)
    ON CONFLICT (key, work) DO UPDATE SET tier = excluded.tier`).run(ANTICLERE.key, w, tier, T0);
  const give = (who, m, qty = 1) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, 'own', ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = prof_stores.qty + excluded.qty`).run(who.id, who.character, m, qty);
  const setXp = (who, prof, xp) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp`).run(who.id, who.character, prof, xp, T0);
  const craft = async (who, recipe, seat, { b = 0x00, clean = false } = {}) => {
    for (const inp of recipeById(recipe).inputs) give(who, inp.key, inp.n);
    const res = await steered(b, () => svc.call('/v1/prof/craft', { character: who.character, recipe, clean, name: 'Hollin', rid: rid(), ...(seat == null ? {} : { seat }) }, who.secret));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body;
  };
  const HEALING = ['p1:16', 'reagent:troll-blood', 'reagent:elixir-vitae', 'metal:mercury'];
  const brew = async (who, seat, b) => {
    for (const k of HEALING) give(who, k);
    const res = await steered(b, () => svc.call('/v1/prof/brew', { character: who.character, potion: 'healing', keys: HEALING, rid: rid(), ...(seat == null ? {} : { seat }) }, who.secret));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body;
  };
  const treasury = (n) => raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES ('mint', NULL, 'guild', ?, 'test', ?, 1, 1, 'seed', NULL, ?)`).run(gid, n, `seed-${gid}-${n}`);
  const stock = (material, qty) => raw.prepare(`INSERT INTO town_seat_stockpile (key, material, qty) VALUES (?, ?, ?)
    ON CONFLICT (key, material) DO UPDATE SET qty = town_seat_stockpile.qty + excluded.qty`).run(ANTICLERE.key, material, qty);
  return { svc, raw, gm, gid, member, work, give, setXp, craft, brew, treasury, stock };
}

test('PROF12 APOTHECARY: the gate open - the law raises it at any seat (AUDIT SEATS-2 L5\'s gate, PIN MOVED there), and the holder\'s Guildmaster begins its first tier at the board, its 100 Cut Stone and 100 Oak Planks from the stockpile, where it was `fort-not-here` (mutant: the gate shut)', async (t) => {
  assert.equal(APOTHECARY_OPEN, true);
  assert.equal(fortMayRaise('apothecary', { tier: 'palace' }), true);
  assert.equal(fortMayRaise('apothecary', { tier: 'crown' }), true);
  const s = await stood(t);
  s.treasury(5_000);
  s.stock('stone:cut', 100);
  s.stock('plank:oak', 100);
  const r = await s.svc.call('/v1/seats/fort/fund', { character: s.gm.character, key: ANTICLERE.key, work: 'apothecary', rid: rid() }, s.gm.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.tier, r.body.forts.works.apothecary.standsAt], [1, T0 + 2 * DAY], 'met at once, standing its two days');
});

test('PROF12 APOTHECARY: a holder\'s member cutting a piece of jewellery in its town takes a quality step a tier - the tier-2 Apothecary\'s two (Crude to Fine); a stranger none, another town none, and the Forge none (mutants: the profession\'s hall; the seat; the member)', async (t) => {
  const s = await stood(t);
  s.work('apothecary', 2);
  s.work('forge', 2);
  const jew = await s.member('Jessa');
  const stranger = await s.svc.seated('Stranger');
  assert.equal(stationSteps('jewelcrafting', { apothecary: 2, forge: 2 }), 2, 'the Apothecary\'s two, never the Forge\'s');
  assert.equal((await s.craft(jew, 'ring:silver', null)).quality, 0, 'margin 0, the roll\'s bottom: Crude');
  assert.equal((await s.craft(jew, 'ring:silver', ANTICLERE.key)).quality, 2, 'the Apothecary at tier 2: Fine');
  assert.equal((await s.craft(stranger, 'ring:silver', ANTICLERE.key)).quality, 0, 'not the holder\'s');
  assert.equal((await s.craft(jew, 'ring:silver', ASHFIELD.key)).quality, 0, 'a town the guild does not hold');
  s.raw.prepare("DELETE FROM town_seat_forts WHERE key = ? AND work = 'apothecary'").run(ANTICLERE.key);
  assert.equal((await s.craft(jew, 'ring:silver', ANTICLERE.key)).quality, 0, 'the Forge steps no jeweller');
});

test('PROF12 APOTHECARY: a dish takes no quality - DECIDED, its step is the clean pan\'s: the dish\'s XP half again a tier (20, 30 at tier 1; a clean pan at tier 2 two and a half times - 50); the quality stays none; a stranger\'s 20 (mutants: the dish\'s steps; the step\'s half)', async (t) => {
  const s = await stood(t);
  const cook = await s.member('Cooky');
  const stranger = await s.svc.seated('Stranger');
  const first = await s.craft(cook, 'stew:north', null);
  assert.deepEqual([first.xp, first.quality], [20 + firstCraftXp(recipeById('stew:north')), -1], 'the first: 20 and Provisioning\'s first-make share, no quality');   // PIN MOVED (FIRST-BUDGET): the first's XP its track's first-make share (recipeLaw firstCraftXp), no longer a flat 500
  s.setXp(cook, 'provisioning', 0);   // PIN MOVED (FIRST-BUDGET): the first's 3,155 lifts the cook to rank 17 (a dish XP follows the rank) - set back to a Novice, so the halves below read at tier 1 as they did
  assert.equal((await s.craft(cook, 'stew:north', ANTICLERE.key)).xp, 20, 'no Apothecary standing: the plain dish');
  s.work('apothecary', 1);
  assert.equal((await s.craft(cook, 'stew:north', ANTICLERE.key)).xp, 30, 'tier 1: half again');
  s.work('apothecary', 2);
  const best = await s.craft(cook, 'stew:north', ANTICLERE.key, { clean: true });
  assert.deepEqual([best.xp, best.quality], [50, -1], 'a clean pan at tier 2: (2 + 1 + 2) halves');
  assert.equal((await s.craft(stranger, 'stew:north', ANTICLERE.key)).xp, 20 + firstCraftXp(recipeById('stew:north')), 'a stranger: the plain dish (and its own first)');   // PIN MOVED (FIRST-BUDGET)
  s.setXp(cook, 'provisioning', 0);   // PIN MOVED (FIRST-BUDGET): the clean pan's 50 at tier 1 still a Novice's
  assert.equal((await s.craft(cook, 'stew:north', ASHFIELD.key)).xp, 20, 'another town: the plain dish');
});

test('PROF12 APOTHECARY: a brew in its town takes +10 Potent a tier - a Novice\'s none becomes the tier-2 hall\'s 20: the roll of 19.5 Potent, 20.3 plain; its steps answered; a stranger\'s and another town\'s none; the Workshop none (mutants: the brew\'s seat; the step\'s ten)', async (t) => {
  const s = await stood(t);
  s.work('apothecary', 2);
  s.work('workshop', 2);
  const alch = await s.member('Alcy');
  const stranger = await s.svc.seated('Stranger');
  const a = await s.brew(alch, ANTICLERE.key, 0x32);
  assert.deepEqual([a.potent, a.steps], [25, 2], 'Novice at a tier-2 Apothecary: 20 - a roll of 19.5 Potent');
  const b = await s.brew(alch, ANTICLERE.key, 0x34);
  assert.deepEqual([b.potent, b.steps], [0, 2], 'a roll of 20.3 plain');
  const c = await s.brew(stranger, ANTICLERE.key, 0x00);
  assert.deepEqual([c.potent, c.steps], [0, 0], 'a stranger: no step, a Novice\'s none');
  const d = await s.brew(alch, ASHFIELD.key, 0x00);
  assert.deepEqual([d.potent, d.steps], [0, 0], 'another town: none');
  s.raw.prepare("DELETE FROM town_seat_forts WHERE key = ? AND work = 'apothecary'").run(ANTICLERE.key);
  const e = await s.brew(alch, ANTICLERE.key, 0x00);
  assert.deepEqual([e.potent, e.steps], [0, 0], 'the Workshop steps no alchemist');
});
