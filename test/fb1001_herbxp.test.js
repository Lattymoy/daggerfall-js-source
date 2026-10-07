// HERB-XP (2026-10-01 part four - Mac: "XP follows your rank", the audit's question answered). Herbs stop at tier 3, and
// harvestXp quarters a node more than two tiers under the rank's top: from rank 40 a common herb was worth 3 XP, from 55
// an uncommon one 7 (11 clean), and past rank 70 every herb a quarter - 3, 11 and 16 - so 70 to 100 took 107 full days
// on confirmed ground (lane 2's measure). Fishing's haul was given the rank's own tier for the same wall (PROF8, Mac:
// "XP follows your rank"); now a herb is picked at it too (src/net/professionLaw.js herbXpTier, the service's harvest).
// The herb's own tier still opens it and is the harvest's row; the Basket's food keeps its tier. The law, and the real
// Worker over node:sqlite (test/accountDb.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from './accountDb.mjs';
import { herbPatches, nodeKey } from '../src/net/nodeLaw.js';
import { harvestXp, herbXpTier, haulTier, topTierOf, tierOpen, xpForRank, PROF_RANK_MAX } from '../src/net/professionLaw.js';
import { utcDay } from '../src/net/marksLaw.js';

const DAY = 86_400;
const WOODS = 231, SWAMP = 228, ANTICLERE = 21;
let _now = utcDay(T0) * DAY + 43_200;
const realNow = Date.now;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = () => `herbxp-${String(++_rid).padStart(6, '0')}`;
/** The first patch of `tier` along a row (T0's day is winter: the Woodlands' uncommon herbs are bare, the Swamp's Bamboo grows). */
function patchOfTier(tier, climate = WOODS, from = 300) {
  for (let x = from; x < 700; x++) {
    const p = herbPatches({ x, y: 200, day: utcDay(_now), climate, confirmed: false }).find((q) => q.tier === tier);
    if (p) return { x, y: 200, climate, ...p };
  }
  throw new Error('no patch of that tier');
}
const harvestBody = (who, p, extra = {}) => ({
  character: who.character, node: nodeKey({ kind: 'herb', x: p.x, y: p.y, day: utcDay(_now), slot: p.slot }), kind: 'herbs',
  climate: p.climate, region: ANTICLERE, act: { clean: false, bruised: false }, at: _now - 2, rid: rid(), ...extra,
});
async function stand() {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const setXp = (who, xp) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, 'herbalism', ?, ?)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp`).run(who.id, who.character, xp, _now);
  const xpOf = (who) => Number(raw.prepare("SELECT xp FROM prof_tracks WHERE player = ? AND char_id = ? AND profession = 'herbalism'").get(who.id, who.character)?.xp ?? 0);
  const row = (who, node, kind) => raw.prepare('SELECT tier, xp FROM node_harvests WHERE player = ? AND node = ? AND kind = ?').get(who.id, node, kind);
  return { ...s, setXp, xpOf, row };
}

test('HERB-XP law: a herb is picked at the highest tier the rank opens, as a haul is worked - every herb a rank may pick is worth 15 x its tier, never a quarter, at every rank; the wall it was (mutants: the herb\'s own tier)', () => {
  for (let r = 0; r <= PROF_RANK_MAX; r++) {
    assert.equal(herbXpTier(r), topTierOf(r), `rank ${r}`);
    assert.equal(herbXpTier(r), haulTier(r), `rank ${r}: Fishing's law`);
    for (const tier of [1, 2, 3]) {
      if (!tierOpen(r, tier)) continue;
      assert.equal(harvestXp(herbXpTier(r), r, false), 15 * topTierOf(r), `rank ${r}, a tier ${tier} herb: the rank's tier, whole`);
      assert.equal(harvestXp(herbXpTier(r), r, true), Math.floor((15 * topTierOf(r) * 3) / 2), `rank ${r}, a tier ${tier} herb clean: x1.5`);
    }
  }
  // the wall, as the herb's own tier reckoned it past rank 70: a quarter of 15, of 45 and of 67
  assert.deepEqual([harvestXp(1, 70, false), harvestXp(2, 70, true), harvestXp(3, 70, true)], [3, 11, 16]);
  // 70 to 100 now, a plain herb a harvest: some 537, nine of the old days of sixty - where it was more than a hundred
  // days. CAP-OFF (2026-10-07): no day bounds them now, so the pin counts the harvests (the same bound, 480 to 600)
  const plain = (lo, hi) => (xpForRank(hi) - xpForRank(lo)) / harvestXp(herbXpTier(lo), lo, false);
  const harvests = plain(70, 90) + plain(90, 100);
  assert.ok(harvests > 480 && harvests < 600, `${harvests.toFixed(1)} harvests`);
});

test('HERB-XP service: at rank 70 an uncommon herb picked clean is worth 135 and a common one 90 (they were 11 and 3); the row keeps the herb\'s own tier; at rank 0 a common herb is 15 as ever (mutants: the herb\'s own tier; the node\'s tier lost from the row)', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, xpForRank(70));
  const p = patchOfTier(2, SWAMP);
  const clean = await s.call('/v1/prof/harvest', harvestBody(mac, p, { act: { clean: true, bruised: false } }), mac.secret);
  assert.equal(clean.status, 200, JSON.stringify(clean.body));
  assert.equal(clean.body.xp, harvestXp(6, 70, true));
  assert.equal(clean.body.xp, 135, '15 x 6 (rank 70 works tier 6), +50% unbruised');
  assert.equal(s.xpOf(mac), xpForRank(70) + 135, 'credited');
  assert.deepEqual({ ...s.row(mac, harvestBody(mac, p).node, 'herbs') }, { tier: 2, xp: 135 }, 'the harvest\'s row: the herb\'s own tier, the XP the rank\'s');
  const c = patchOfTier(1);
  const common = await s.call('/v1/prof/harvest', harvestBody(mac, c, { act: { clean: true, bruised: false } }), mac.secret);
  assert.equal(common.body.xp, 90, 'a common herb by hand: 15 x 6, never the clean act\'s +50%');
  const ann = await s.registered('Ann');
  const novice = await s.call('/v1/prof/harvest', harvestBody(ann, c), ann.secret);
  assert.equal(novice.body.xp, 15, 'rank 0 works tier 1: as it always was');
});

test('HERB-XP service: the Basket\'s food keeps its tier - at rank 70 a search with all three found is a quarter of 22, as it was (not asked) (mutants: the food at the rank\'s tier)', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, xpForRank(70));
  const p = patchOfTier(1);
  const food = await s.call('/v1/prof/harvest', { ...harvestBody(mac, p), kind: 'food', act: { finds: 3 } }, mac.secret);
  assert.equal(food.status, 200, JSON.stringify(food.body));
  assert.equal(food.body.xp, harvestXp(1, 70, true));
  assert.equal(food.body.xp, 5);
});
