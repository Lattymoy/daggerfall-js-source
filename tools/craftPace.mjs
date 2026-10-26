#!/usr/bin/env node
// FIRST-BUDGET (2026-10-25, SaberGGaming's report: "Provisioning is slow"; bible/06-Systems/Professions-Arc.md 52): THE
// CRAFTS A TRACK TAKES TO JOURNEYMAN AND TO MASTER, MEASURED. Each crafting track is walked from no XP: every act the best
// the rank opens - an unmade first-make where one is open (its own XP and its first's), else the best repeat - each a
// unit (a cut, a mix, a dish, a brew, a piece); the clean act wherever the act has one (a clean pan, a clean chisel - a
// player levelling plays it well); a cloth pattern's first paid as own (CLOTH-GEMS: the loom's Linen and Wool his own -
// the weave and the spin are the loom's works, not counted, and pay no first); no Firmament, no seat, no crafter's limit;
// a Sculptor's carvings only at 100. `first` what a first-make pays: the law's own share (recipeLaw firstCraftXp asked as
// own, workFirstXp, brewFirstXp), a flat figure every track (500, the law before FIRST-BUDGET), or a figure a track.
// FIRST-BUDGET RETUNED (the owner, asked: "Match Smithing's pace"): firstShares DERIVES the law's shares - each track's
// the least, never under the floor's 500, at which this walk reaches Master in the crafts Smithing takes at its 500;
// recipeLaw.js FIRST_MAKE_SHARE pins them and test/net/firstbudget_law.test.js holds the two equal.
//
//   node tools/craftPace.mjs           the law's
//   node tools/craftPace.mjs 500       a flat first of 500 (as it stood)
//   node tools/craftPace.mjs --shares  the shares that match Smithing's pace, derived
import { RECIPES, firstCraftKey, firstCraftPays, firstCraftXp, workFirstXp, brewFirstXp, craftXp, cookXp, masonXp, FIRST_MAKE_FLOOR } from '../src/net/recipeLaw.js';
import { WORK_RECIPES, trackOf, rankOfXp, xpForRank, JOURNEYMAN_RANK, PROF_RANK_MAX } from '../src/net/professionLaw.js';
import { POTIONS, brewXp, brewFirstPays } from '../src/net/alchemyLaw.js';
import { isMain } from './lib/isMain.mjs';

/** What a first-make pays in the walk on `track`: the law's (`flat` null), one figure every track (a number), or a figure
 *  a track (`{ track: share }`; a track it names none of, the law's) - where its first pays at all (`pays`).
 *  @param {number|Record<string, number>|null} flat @param {string} track @param {number} law @param {boolean} pays */
const firstOf = (flat, track, law, pays) => {
  const share = typeof flat === 'number' ? flat : flat?.[track];
  return share == null ? law : pays ? share : 0;
};

/** Each crafting track's acts: { key, rank, spec, first, xp(rank) }. @param {number|Record<string, number>|null} flat */
function actsOf(flat) {
  const acts = new Map();
  const add = (track, a) => acts.set(track, [...(acts.get(track) ?? []), a]);
  for (const r of RECIPES) {
    if (r.later) continue;
    const track = trackOf(r.profession);
    add(track, {
      key: firstCraftKey(r), rank: r.rank, spec: r.spec ?? null,
      first: firstOf(flat, track, firstCraftXp(r, true), firstCraftPays(r, true)),   // CLOTH-GEMS: the units his own
      xp: (rank) => (r.kind === 'dish' ? cookXp(rank, { clean: true }) : craftXp(r.tier, rank)),
    });
  }
  for (const w of WORK_RECIPES) {
    if (!w.act) continue;
    add(trackOf(w.xp), { key: `work:${w.id}`, rank: w.rank ?? 0, spec: null, first: firstOf(flat, trackOf(w.xp), workFirstXp(w), true), xp: (rank) => masonXp(1, rank, { clean: true }) });
  }
  for (const p of POTIONS) {
    add(trackOf('alchemy'), { key: `brew:${p.id}`, rank: p.rank, spec: null, first: firstOf(flat, trackOf('alchemy'), brewFirstXp(p), brewFirstPays(p)), xp: (rank) => brewXp(p, rank) });
  }
  return acts;
}

/**
 * { track: { journeyman, master, firsts } } - the crafts each took, and the first-makes made on the way.
 * @param {number|Record<string, number>|null} [flat] @param {string[]|null} [only] the tracks to walk (every one, unnamed)
 */
export function craftPace(flat = null, only = null) {
  const out = {};
  for (const [track, list] of actsOf(flat)) {
    if (only && !only.includes(track)) continue;
    let xp = 0, n = 0, journeyman = null, master = null;
    const made = new Set();
    while (xp < xpForRank(PROF_RANK_MAX) && n < 100_000) {
      const rank = rankOfXp(xp);
      let best = 0, bestKey = null;
      for (const a of list) {
        if (rank < a.rank || (a.spec && rank < PROF_RANK_MAX)) continue;
        const first = made.has(a.key) ? 0 : a.first;
        const v = a.xp(rank) + first;
        if (v > best) { best = v; bestKey = first > 0 ? a.key : null; }
      }
      if (bestKey) made.add(bestKey);
      xp += best; n++;
      if (journeyman == null && xp >= xpForRank(JOURNEYMAN_RANK)) journeyman = n;
      if (master == null && xp >= xpForRank(PROF_RANK_MAX)) master = n;
    }
    out[track] = { journeyman, master, firsts: made.size };
  }
  return out;
}

/**
 * FIRST-BUDGET RETUNED: each crafting track's first-make share that matches Smithing's pace - the least share, never under
 * FIRST_MAKE_FLOOR, at which the walk reaches Master in `target` crafts or fewer: Smithing's at the floor's 500 (172 on
 * CLOTH-GEMS' recipe set). One share a track cannot match Journeyman as well; Master is the one matched. The search is
 * a bisection (the crafts to Master fall as the share rises); the test holds the answer the least - one XP less misses.
 * @param {number} [target]
 */
export function firstShares(target = craftPace(FIRST_MAKE_FLOOR, ['smithing']).smithing.master) {
  const out = {};
  for (const track of actsOf(null).keys()) {
    const reaches = (/** @type {number} */ share) => (craftPace({ [track]: share }, [track])[track].master ?? Infinity) <= target;
    let lo = FIRST_MAKE_FLOOR, hi = FIRST_MAKE_FLOOR;
    if (reaches(lo)) { out[track] = lo; continue; }   // the floor already as fast: no track pays less than the 500 it did
    while (!reaches(hi)) { lo = hi; hi *= 2; }
    while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); if (reaches(mid)) hi = mid; else lo = mid; }
    out[track] = hi;
  }
  return out;
}

if (isMain(import.meta.url)) {
  if (process.argv[2] === '--shares') console.log(JSON.stringify(firstShares(), null, 2));
  else console.log(JSON.stringify(craftPace(process.argv[2] != null ? Number(process.argv[2]) : null), null, 2));
}
