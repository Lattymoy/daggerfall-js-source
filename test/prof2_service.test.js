// PROF2 (2026-09-28, Mac: "Go") - MINING AND QUARRYING, AND THE FORGE, AS THE SERVICE KEEPS THEM: a vein's ore, a
// boulder's stone and a dungeon's deep vein through the one harvest (the law's node, the day, the hour - and none
// underground - the rank, the act's bounded report); the witnessed dungeon; the forge's smelts (every input held, bought
// first, an ingot own only when all its units were, Smithing's XP under the crafter's limit, asked twice one). Driven
// through the real Worker over node:sqlite with every migration applied (test/accountDb.mjs). bible/06-Systems/
// Professions-Arc.md 23.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from './accountDb.mjs';
import { veins, boulders, dungeonVeins, nodeKey, dveinKey } from '../src/net/nodeLaw.js';
import { xpForRank, glintsMax, harvestXp, rankOfXp, SMELT_MAX, STORES_MAX } from '../src/net/professionLaw.js';
import { sharedClassicMinutes } from '../src/net/wire.js';
import { utcDay } from '../src/net/marksLaw.js';

const DAY = 86_400;
const WOODS = 231, MOUNTAIN = 226, SWAMP = 228, WAYREST = 23, GLENUMBRA = 59;
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
const rid = () => `mine-${String(++_rid).padStart(6, '0')}`;
const today = () => utcDay(_now);

async function stand(extra = {}) {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', DEVELOPER_HANDLES: 'Mac', ...extra });
  const raw = s.env.DB._raw;
  const age = (who, days) => raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(_now - days * DAY, who.id);
  const stores = (who, m) => raw.prepare('SELECT origin, qty FROM prof_stores WHERE player = ? AND char_id = ? AND material = ? ORDER BY origin').all(who.id, who.character, m).map((r) => [r.origin, Number(r.qty)]);
  const give = (who, m, origin, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(who.id, who.character, m, origin, qty);
  const xpOf = (who, prof) => Number(raw.prepare('SELECT xp FROM prof_tracks WHERE player = ? AND char_id = ? AND profession = ?').get(who.id, who.character, prof)?.xp ?? 0);
  const setXp = (who, xp, prof = 'mining', extraCols = {}) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, spec100, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp, spec50 = excluded.spec50, spec100 = excluded.spec100`)
    .run(who.id, who.character, prof, xp, extraCols.spec50 ?? null, extraCols.spec100 ?? null, _now);
  return { ...s, raw, age, stores, give, xpOf, setXp };
}
/** A pixel's vein of a tier, unconfirmed, on a day. */
function veinOf(climate, region, pred, confirmed = false) {
  for (let x = 300; x < 700; x++) {
    const v = veins({ x, y: 200, day: today(), climate, region, confirmed }).find(pred);
    if (v) return { x, y: 200, climate, region, ...v, key: nodeKey({ kind: 'vein', x, y: 200, day: today(), slot: v.slot }) };
  }
  throw new Error('no such vein');
}
/** Veins on DISTINCT pixels, one for each predicate in turn. */
function veinsAt(climate, region, preds) {
  const out = [];
  let x = 300;
  for (const pred of preds) {
    for (; x < 900; x++) {
      const v = veins({ x, y: 200, day: today(), climate, region }).find(pred);
      if (v) { out.push({ x, y: 200, climate, region, ...v, key: nodeKey({ kind: 'vein', x, y: 200, day: today(), slot: v.slot }) }); x++; break; }
    }
  }
  if (out.length !== preds.length) throw new Error('no such veins');
  return out;
}
const ore = (who, n, extra = {}) => ({
  character: who.character, node: n.key, kind: 'ore', climate: n.climate, region: n.region, act: { glints: 0, clean: false },
  at: _now - 2, rid: rid(), ...extra,
});

// ─── A VEIN ──────────────────────────────────────────────────────────

test('PROF2 service: a vein mined - the law\'s ore into the Stores, own; Mining XP 15 x tier; asked again one harvest; a node once a day; ore, never herbs', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const v = veinOf(WOODS, GLENUMBRA, (x) => x.tier === 1);
  const body = ore(mac, v);
  const r = await s.call('/v1/prof/harvest', body, mac.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.material, v.material);
  assert.ok(r.body.qty >= 2 && r.body.qty <= 3, 'a vein 2-3; no march on a pixel nobody confirmed');
  assert.equal(r.body.xp, 15);
  assert.equal(r.body.track.profession, 'mining');
  assert.deepEqual(s.stores(mac, v.material), [['own', r.body.qty]]);
  assert.equal(r.body.gem, undefined, 'no gem on unconfirmed ground');
  const again = await s.call('/v1/prof/harvest', body, mac.secret);
  assert.deepEqual([again.body.repeat, again.body.qty], [true, r.body.qty]);
  assert.equal(s.xpOf(mac, 'mining'), 15, 'credited once');
  assert.deepEqual((await s.call('/v1/prof/harvest', { ...body, rid: rid() }, mac.secret)).body, { error: 'node-taken' });
  assert.deepEqual((await s.call('/v1/prof/harvest', { ...body, rid: rid(), kind: 'herbs' }, mac.secret)).body, { error: 'prof-kind' });
  assert.deepEqual((await s.call('/v1/prof/harvest', { ...body, rid: rid(), node: nodeKey({ kind: 'vein', x: v.x, y: 200, day: today(), slot: 9 }) }, mac.secret)).body, { error: 'bad-node' }, 'Woodlands holds two veins');
  const st = (await s.call('/v1/prof/state', { character: mac.character }, mac.secret)).body;
  assert.deepEqual(st.today, { mining: 1 });
  assert.ok(st.taken.includes(`${v.key}|ore`));
});

test('PROF2 service: the Pick-Axe\'s report, bounded - clean only with every strike on the glint (+50% XP); a strike count past the finish\'s is cut; a tier past the rank refused; a surface vein is mined by night (ANY-HOUR)', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, xpForRank(10));
  const [v, w, p] = veinsAt(WOODS, GLENUMBRA, [(x) => x.tier === 2, (x) => x.tier === 1, (x) => x.tier === 1]);
  const r = await s.call('/v1/prof/harvest', ore(mac, v, { act: { glints: glintsMax(2), clean: true } }), mac.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.xp, harvestXp(2, 10, true), 'tier 2 clean: 45');
  const cheat = await s.call('/v1/prof/harvest', ore(mac, w, { act: { glints: 99, clean: true } }), mac.secret);
  assert.equal(cheat.body.xp, harvestXp(1, 10, true), '99 glints are the finish\'s two - still the one clean step');
  const plain = await s.call('/v1/prof/harvest', ore(mac, p, { act: { glints: 1, clean: true } }), mac.secret);
  assert.equal(plain.body.xp, harvestXp(1, 10, false), 'one glint of the two: no clean finish, whatever it says');
  const fresh = await s.registered('Ann');
  assert.deepEqual((await s.call('/v1/prof/harvest', ore(fresh, v), fresh.secret)).body, { error: 'prof-rank' }, 'tier 2 wants Mining 10');
  // PIN MOVED (ANY-HOUR, 2026-10-01, Mac: "Remove the time limit for professions. Should be available at any time"):
  // 02:00 refused a surface vein (`prof-night`); now it is mined as at noon
  clock(secondAt(today() * DAY + 60, 2));
  const [night] = veinsAt(WOODS, GLENUMBRA, [(x) => x.tier === 1]);
  const dark = await s.call('/v1/prof/harvest', ore(fresh, night, { at: _now - 2 }), fresh.secret);
  assert.equal(dark.status, 200, JSON.stringify(dark.body));
  assert.equal(dark.body.material, night.material, 'its ore, by night');
  clock(NOON);
});

test('PROF2 service: a boulder quarried - Rough Stone 3-5; a clean finish, or a Stonebreaker always, cuts it at the rock into Cut Stone at two to one', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const b = boulders({ x: 400, y: 200, day: today(), climate: MOUNTAIN });
  const key = (x, slot) => nodeKey({ kind: 'boulder', x, y: 200, day: today(), slot });
  const stone = (who, x, slot, act) => ({ character: who.character, node: key(x, slot), kind: 'stone', climate: MOUNTAIN, region: WAYREST, act, at: _now - 2, rid: rid() });
  const r = await s.call('/v1/prof/harvest', stone(mac, 400, 0, { glints: 0 }), mac.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.material, r.body.kind], ['stone:rough', 'stone']);
  assert.ok(r.body.qty >= 3 && r.body.qty <= 5);
  assert.equal(r.body.xp, 15, 'a boulder is tier 1');
  const c = await s.call('/v1/prof/harvest', stone(mac, 400, 1, { glints: glintsMax(1), clean: true }), mac.secret);
  assert.equal(c.body.material, 'stone:cut');
  assert.ok(c.body.qty >= 1 && c.body.qty <= 3, 'three to five, halved');
  assert.equal(c.body.xp, 22);
  const sb = await s.registered('Sten');
  s.setXp(sb, xpForRank(100), 'mining', { spec100: 'stonebreaker' });
  const d = await s.call('/v1/prof/harvest', stone(sb, 400, 2, { glints: 0 }), sb.secret);
  assert.equal(d.body.material, 'stone:cut', 'a Stonebreaker cuts it always');
  // PIN MOVED (BOULDERS, acct47): the Mountain's five boulders a day - the fifth quarried, a sixth no node
  assert.equal(b.length, 5);
  assert.equal((await s.call('/v1/prof/harvest', stone(mac, 400, 4, { glints: 0 }), mac.secret)).status, 200, 'the fifth slot');
  assert.deepEqual((await s.call('/v1/prof/harvest', stone(mac, 400, 5, { glints: 0 }), mac.secret)).body, { error: 'bad-node' }, 'past the day\'s count');
  assert.deepEqual((await s.call('/v1/prof/harvest', { ...stone(mac, 400, 0, {}), node: key(400, 0), climate: SWAMP }, mac.secret)).body, { error: 'prof-pixel' }, 'a Swamp holds no boulders');
});

// ─── A DUNGEON'S VEIN ────────────────────────────────────────────────

test('PROF2 service: a dungeon\'s vein - no hours underground; tier 3 until the dungeon is witnessed; three accounts a week old confirm it; the pixels read says so', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, xpForRank(99));   // room on the track: the answer's XP is what was credited (AUDIT 29 A14)
  const id = 4321;
  const deep = (who, slot, extra = {}) => ({ character: who.character, node: dveinKey({ dungeon: id, day: today(), slot }), kind: 'ore', climate: MOUNTAIN, region: WAYREST, act: { glints: 0 }, at: _now - 2, rid: rid(), ...extra });
  clock(secondAt(today() * DAY + 60, 2));
  const r = await s.call('/v1/prof/harvest', deep(mac, 0), mac.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.material, r.body.xp], ['metal:silver', harvestXp(3, 99, false)], 'unconfirmed: the least a deep vein is - Silver, tier 3');
  // three witnesses a week registered
  for (const h of ['Wit1', 'Wit2', 'Wit3']) {
    const w = await s.registered(h);
    s.age(w, 8);
    s.setXp(w, xpForRank(100));
    const n = dungeonVeins({ dungeon: id, day: today(), climate: MOUNTAIN, confirmed: false }).length;
    await s.call('/v1/prof/harvest', deep(w, n - 1), w.secret);
  }
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM world_witness WHERE kind = 'dungeon' AND key = ?").get(String(id)).n, 3, 'Mac, a day old, witnesses nothing');
  const px = (await s.call('/v1/prof/pixels', { character: mac.character, pixels: [], dungeons: [id] }, mac.secret)).body;
  assert.deepEqual(px.dungeons, [{ id, state: 'confirmed', climate: MOUNTAIN, region: WAYREST }]);
  assert.deepEqual((await s.call('/v1/prof/pixels', { character: mac.character, pixels: [], dungeons: [1, 2, 3, 4, 5] }, mac.secret)).body, { error: 'bad-pixels' }, 'four dungeons a read');
  // confirmed, the whole table: over the slots, a tier above 3 may stand; the claim of another ground is refused
  const conf = dungeonVeins({ dungeon: id, day: today(), climate: MOUNTAIN, confirmed: true });
  if (conf.length > 1) {
    const r2 = await s.call('/v1/prof/harvest', deep(mac, 1), mac.secret);
    assert.equal(r2.body.material, conf[1].material);
  }
  assert.deepEqual((await s.call('/v1/prof/harvest', deep(mac, 0, { rid: rid(), climate: WOODS }), mac.secret)).body, { error: 'prof-pixel' });
  clock(NOON);
});

test('PROF2 service: a gem - a strike on the glint a chance on witnessed ground, a dungeon\'s a Diamond, own in the Stores beside the ore; none on no glint; none when its Stores are full (the ore still given)', async (t) => {
  const s = await stand();
  const id = 777;
  const deep = (who, extra = {}) => ({ character: who.character, node: dveinKey({ dungeon: id, day: today(), slot: 0 }), kind: 'ore', climate: MOUNTAIN, region: WAYREST, act: { glints: 1 }, at: _now - 2, rid: rid(), ...extra });
  for (const h of ['Wit1', 'Wit2', 'Wit3']) {
    const w = await s.registered(h);
    s.age(w, 8);
    s.setXp(w, xpForRank(100));
    assert.equal((await s.call('/v1/prof/harvest', deep(w), w.secret)).status, 200);
  }
  // the service's dice at their lowest: every chance taken
  const real = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  t.mock.method(globalThis.crypto, 'getRandomValues', (b) => (b.byteLength === 4 ? b.fill(0) : real(b)));
  const [mac, bare, full] = [await s.registered('Mac'), await s.registered('Bare'), await s.registered('Full')];
  for (const who of [mac, bare, full]) s.setXp(who, xpForRank(100));
  const r = await s.call('/v1/prof/harvest', deep(mac), mac.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.gem, 'gem:diamond');
  assert.deepEqual(s.stores(mac, 'gem:diamond'), [['own', 1]]);
  assert.ok(s.stores(mac, r.body.material)[0][1] >= 2, 'beside the ore');
  const n = await s.call('/v1/prof/harvest', deep(bare, { act: { glints: 0 } }), bare.secret);
  assert.deepEqual([n.status, n.body.gem, s.stores(bare, 'gem:diamond')], [200, undefined, []], 'no strike on the glint: no chance');
  s.give(full, 'gem:diamond', 'own', STORES_MAX);
  const f = await s.call('/v1/prof/harvest', deep(full), full.secret);
  assert.equal(f.status, 200, JSON.stringify(f.body));
  assert.equal(f.body.gem, undefined, 'its Stores full: no gem found');
  assert.deepEqual(s.stores(full, 'gem:diamond'), [['own', STORES_MAX]]);
  assert.ok(s.stores(full, f.body.material)[0][1] >= 2, 'the ore still given');
});

test('PROF2 service: Deep Delver\'s dungeon veins yield half again; the Mining day past 60 credited (CAP-OFF), and a fifth vein in a dungeon nobody has vouched for still refused', async (t) => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, xpForRank(100), 'mining', { spec50: 'deep-delver' });
  // the service's dice at their highest: the roll 3, x1.5 = 4.5, its half not taken - 4 (3 without the specialisation).
  // Four dungeons: an account works no more a day in dungeons nobody has vouched for (AUDIT 29 A5).
  const real = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  t.mock.method(globalThis.crypto, 'getRandomValues', (b) => (b.byteLength === 4 ? b.fill(0xff) : real(b)));
  for (let id = 100; id < 104; id++) {
    const r = await s.call('/v1/prof/harvest', { character: mac.character, node: dveinKey({ dungeon: id, day: today(), slot: 0 }), kind: 'ore', climate: MOUNTAIN, region: WAYREST, act: {}, at: _now - 2, rid: rid() }, mac.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.qty, 4, 'three, x1.5');
  }
  s.raw.prepare(`INSERT INTO node_harvests (day, node, kind, player, char_id, profession, material, qty, xp, at, rid, n)
    SELECT ?, 'vein:1:1:' || ? || ':' || value, 'ore', ?, ?, 'mining', 'metal:iron', 1, 1, ?, 'fill' || value, 'x' FROM json_each(?)`)
    .run(today(), today(), mac.id, mac.character, _now, JSON.stringify(Array.from({ length: 56 }, (_, i) => i)));
  // PIN MOVED (CAP-OFF, 2026-10-07 - Mac: "Remove the cap on life skills"): the day held 60 - a sixty-first was `prof-cap`.
  // Now the sixty-first is credited, and the bound that stands is the unvouched dungeons' four (AUDIT 29 A5)
  const past = await s.call('/v1/prof/harvest', ore(mac, veinOf(WOODS, GLENUMBRA, (x) => x.tier === 1)), mac.secret);
  assert.deepEqual([past.status, past.body.today], [200, 61], JSON.stringify(past.body));
  const capped = await s.call('/v1/prof/harvest', { character: mac.character, node: dveinKey({ dungeon: 999, day: today(), slot: 0 }), kind: 'ore', climate: MOUNTAIN, region: WAYREST, act: {}, at: _now - 2, rid: rid() }, mac.secret);
  assert.deepEqual(capped.body, { error: 'prof-deep-cap' }, 'a fifth dungeon nobody has vouched for');
});

// ─── THE FORGE ───────────────────────────────────────────────────────

test('PROF2 service: a smelt - two Iron an Iron Ingot, the inputs spent bought first, an ingot own only when both its units were; Smithing 10 XP a unit a tier; asked twice one', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.give(mac, 'metal:iron', 'bought', 3);
  s.give(mac, 'metal:iron', 'own', 9);
  const body = { character: mac.character, recipe: 'ingot:iron', count: 5, rid: rid() };
  const r = await s.call('/v1/prof/smelt', body, mac.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.count, r.body.own, r.body.bought, r.body.xp], [5, 3, 2, 50]);
  assert.deepEqual(s.stores(mac, 'ingot:iron'), [['bought', 2], ['own', 3]]);
  assert.deepEqual(s.stores(mac, 'metal:iron'), [['own', 2]], 'ten spent, the three bought first');
  assert.equal(r.body.track.profession, 'smithing');
  assert.equal(s.xpOf(mac, 'smithing'), 50);
  const again = await s.call('/v1/prof/smelt', body, mac.secret);
  assert.deepEqual([again.body.repeat, again.body.count], [true, 5]);
  assert.equal(s.xpOf(mac, 'smithing'), 50, 'once');
  assert.deepEqual((await s.call('/v1/prof/smelt', { ...body, rid: rid(), count: 2 }, mac.secret)).body, { error: 'stores-short' }, 'two Iron left: one ingot');
  assert.deepEqual((await s.call('/v1/prof/smelt', { ...body, rid: rid(), recipe: 'ingot:daedric' }, mac.secret)).body, { error: 'bad-recipe' });
  assert.deepEqual((await s.call('/v1/prof/smelt', { ...body, rid: rid(), count: SMELT_MAX + 1 }, mac.secret)).body, { error: 'bad-qty' });
  // two inputs: Brass of a Copper and a Tin, the product bought where either input's unit was
  s.give(mac, 'metal:copper', 'own', 4);
  s.give(mac, 'metal:tin', 'bought', 1);
  s.give(mac, 'metal:tin', 'own', 3);
  const b = await s.call('/v1/prof/smelt', { character: mac.character, recipe: 'metal:brass', count: 4, rid: rid() }, mac.secret);
  assert.deepEqual([b.body.own, b.body.bought, b.body.xp], [3, 1, 80], 'Brass is tier 2');
  assert.deepEqual(s.stores(mac, 'metal:brass'), [['bought', 1], ['own', 3]]);
  assert.deepEqual([s.stores(mac, 'metal:copper'), s.stores(mac, 'metal:tin')], [[], []]);
});

test('PROF2 service: a smelt refused - the product\'s room; the crafter\'s limit holds Smithing at 50 behind two crafts past it; the switch shut; a smelt made answered after', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.give(mac, 'ore:mithril', 'own', 10);
  s.give(mac, 'ingot:mithril', 'own', 4998);
  assert.deepEqual((await s.call('/v1/prof/smelt', { character: mac.character, recipe: 'ingot:mithril', count: 3, rid: rid() }, mac.secret)).body, { error: 'stores-full' });
  s.give(mac, 'ingot:mithril', 'own', 0);
  s.raw.prepare('DELETE FROM prof_stores WHERE material = ?').run('ingot:mithril');
  // PIN MOVED (CRAFT3): Alchemy and Cooking are one track (Provisioning) - the two crafts past Journeyman are Provisioning and Building, seeded under the craft's id
  s.setXp(mac, xpForRank(60), 'provisioning');
  s.setXp(mac, xpForRank(60), 'building');
  s.setXp(mac, xpForRank(51) - 10, 'smithing');
  const r = await s.call('/v1/prof/smelt', { character: mac.character, recipe: 'ingot:mithril', count: 5, rid: rid() }, mac.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(s.xpOf(mac, 'smithing'), xpForRank(51) - 1, 'held one short of 51');
  assert.equal(rankOfXp(s.xpOf(mac, 'smithing')), 50);
  const body = { character: mac.character, recipe: 'ingot:mithril', count: 1, rid: rid() };
  s.give(mac, 'ore:mithril', 'own', 2);
  await s.call('/v1/prof/smelt', body, mac.secret);
  s.env.PROFESSIONS_OPEN = 'off';
  assert.equal((await s.call('/v1/prof/smelt', body, mac.secret)).body.repeat, true, 'a smelt made is answered though the switch shut after it');
  assert.equal((await s.call('/v1/prof/smelt', { ...body, rid: rid() }, mac.secret)).body.error, 'prof-closed');
});

test('PROF2 service: a metal writ taken - Mining\'s XP, twice the pay', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.raw.prepare(`INSERT INTO writs (id, kind, day, region, slot, material, tier, qty, pay, renown, expires_at) VALUES ('c:x:1:0', 'court', ?, ?, 0, 'metal:iron', 1, 20, 24, 50, ?)`)
    .run(today(), WAYREST, (today() + 1) * DAY);
  s.give(mac, 'metal:iron', 'own', 20);
  const r = await s.call('/v1/writs/deliver', { character: mac.character, id: 'c:x:1:0', rid: rid() }, mac.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.track.profession, r.body.track.xp], ['mining', 48]);
});
