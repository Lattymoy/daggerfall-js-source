// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LW12 (2026-10-09, bible/06-Systems/Living-World-II.md "LW12"): THE OUTLAWS - the road's trouble with a face and a
// home. The climate's tables already roll human bandits (mobileFactions.js FACTIONS.BANDIT); nothing remembered them.
// Pure, like the trips they fall on (LW0 decision 2): a band, its hideout, its name, its people and its generations
// are functions of the world's own data (a region's towns, the roads between them), a seed and the clock - every
// reader's Black Hand camps at the same bend - and what the character did to it is theirs (relations.js `routed`).
//
//  - THE BANDS (`bandCount`, `hideoutsOf`): a region of n towns keeps 1 + n / BAND_TOWNS_PER of them, to BANDS_MAX,
//    each at a HIDEOUT 1-2 px off the middle of the road between two of its towns (the seed's pair among its legs of
//    BAND_LEG_PX), on dry ground, on no town.
//  - ITS LIVES (`outlawBandAt`): a band holds its hideout for a generation. The dice rout it - each BAND_ERA_DAYS a patrol's
//    chance (ROUT_CHANCE: a region with a court's city, its patrols out, the likelier) - and the hideout stands empty
//    BAND_VACANT_DAYS; then a new band forms there (gen + 1, a new name, new people). A rout by the character's hand
//    is the character's own: their hideout stands empty as long, then the next (`heir`) forms.
//  - ITS PEOPLE (`bandPeople`): BAND_SIZE of them, ids `O<region>.<band>~<gen>.<i>` (an heir's `~<gen>h<heir>`), the
//    thieves' run and the rough end of the fighters' (OUTLAW_CLASSES), at levels by the region's greatest town.
//  - THE HOLD-UP (`bandTrouble`, trouble.js): a trip's trouble within OUTLAW_REACH_PX of a hideout is the band's in
//    BAND_SHARE of such troubles; a party under ROB_RATIO of its strength yields - ROBBED, no blood - else it fights.
//  - THE TAKE (`takeOf`): what the band's chest holds - the parties it robbed of the last TAKE_DAYS, each its share of
//    a purse and two of its goods.
import { lwSeed, lwRng, textSeed, rollInt, pickOf } from './seed.js';
import { NATIVE_PIXEL } from './trips.js';
import { DAY_MIN } from './dayPlan.js';
import { residentName } from './census.js';
import { getNameBankOfRegion, GENDERS } from '../../characters/nameHelper.js';
import { MOBILE_TYPES } from '../../characters/mobileTypes.js';
import { CARAVAN_QUALITY, purseOf } from './caravanDoor.js';

/** A region keeps a band for every BAND_TOWNS_PER of its towns, and one more, to BANDS_MAX. */
export const BAND_TOWNS_PER = 40;
export const BANDS_MAX = 4;
/** A band's leg runs between two towns this far apart (map pixels, the nearer and the farther), each of this size. */
export const BAND_LEG_PX = Object.freeze([3, 14]);
export const BAND_TOWN_BLOCKS = 4;
/** A hideout stands this far off its road (map pixels). */
export const HIDEOUT_OFF_PX = Object.freeze([1, 2]);
/** A trip's trouble within this of a hideout (map pixels) may be the band's ... */
export const OUTLAW_REACH_PX = 2;
/** ... in this share of such troubles. */
export const BAND_SHARE = 0.6;
/** A party under this share of the band's strength yields to it - robbed, no blood (trouble.js ROB_RATIO, its one home). */
export { ROB_RATIO } from './trouble.js';
/** The dice's rout: an era's chance (a region with a court's city - its patrols out - the likelier), and the days a
 *  routed band's hideout stands empty before the next forms. */
export const BAND_ERA_DAYS = 60;
export const ROUT_CHANCE = Object.freeze({ patrolled: 0.45, wild: 0.15 });
export const BAND_VACANT_DAYS = 20;
/** A city this big keeps a court - and patrols (census.js CITY_COURT_BLOCKS' own). */
export const COURT_BLOCKS = 16;
/** A band's people: how many, and their classes. */
export const BAND_SIZE = Object.freeze([4, 8]);
export const OUTLAW_CLASSES = Object.freeze([MOBILE_TYPES.Thief, MOBILE_TYPES.Rogue, MOBILE_TYPES.Burglar, MOBILE_TYPES.Nightblade, MOBILE_TYPES.Barbarian, MOBILE_TYPES.Archer]);
/** The chest holds the take of this many days (the rest spent, or fenced), each robbery this share of a counter's purse
 *  (a trip that keeps none: ROB_GOLD) and TAKE_GOODS of its goods, to TAKE_GOODS_MAX. */
export const TAKE_DAYS = 14;
export const TAKE_PURSE_SHARE = 0.25;
export const ROB_GOLD = 40;
export const TAKE_GOODS = 2;
export const TAKE_GOODS_MAX = 16;
/** A band's name: "the <word> <band>", or its leader's "<name>'s <band>". */
export const BAND_WORDS = Object.freeze(['Black', 'Red', 'Grey', 'Iron', 'Broken', 'Hollow', 'Night', 'Ash', 'Bitter', 'Crooked', 'Silent', 'Hanged']);
export const BAND_NOUNS = Object.freeze(['Hand', 'Wolves', 'Knives', 'Crows', 'Company', 'Brothers', 'Hounds', 'Blades', 'Ravens', 'Fangs']);
const HIDE = 0x68696465, BAND = 0x62616e64, ROUT = 0x726f7574;   // 'hide', 'band', 'rout'

/**
 * @typedef {{ key: string, region: number, i: number, px: number, py: number, x: number, z: number, a: number, b: number,
 *   patrolled: boolean, top: number }} Hideout - `x`/`z` native (the ways' frame), `a`/`b` its leg's towns' map ids,
 *   `top` its region's greatest town's blocks
 * @typedef {{ key: string, hideout: Hideout, gen: number, heir: number, formedT: number, name: string, level: number,
 *   people: { id: string, name: string, cls: number, level: number, gender: number, sex: string }[] }} Band
 */

/** How many bands a region of `n` towns keeps. @param {number} n */
export const bandCount = (n) => (n > 1 ? Math.min(BANDS_MAX, 1 + Math.floor(n / BAND_TOWNS_PER)) : 0);
/** A map pixel's centre, native (the ways' frame: x east, z north). @param {number} px @param {number} py */
export const pixelNative = (px, py) => ({ x: px * NATIVE_PIXEL + NATIVE_PIXEL / 2, z: (499 - py) * NATIVE_PIXEL + NATIVE_PIXEL / 2 });
const cheb = (a, b) => Math.max(Math.abs(a.px - b.px), Math.abs(a.py - b.py));

/**
 * THE HIDEOUTS of a region - its bands' places - or undefined while a road one needs is not planned yet (the network's
 * own: asked again). `world.townsIn(region)` its towns; `routeOf`, `townsNear`, `dryAt` the trips' world's.
 * @param {number} region @param {{ townsIn?: (region: number) => any[], routeOf: (a: any, b: any) => any, townsNear: (px: number, py: number, r: number) => any[], dryAt?: (nx: number, nz: number) => boolean }} world
 * @returns {Hideout[] | undefined}
 */
export function hideoutsOf(region, world) {
  const towns = [...(world.townsIn?.(region) ?? [])].sort((p, q) => p.mapId - q.mapId);
  const n = bandCount(towns.length);
  if (!n) return [];
  const big = towns.filter((t) => (t.blocks | 0) >= BAND_TOWN_BLOCKS);
  /** @type {[any, any][]} */
  const legs = [];
  for (let i = 0; i < big.length; i++) {
    for (let j = i + 1; j < big.length; j++) {
      const d = cheb(big[i], big[j]);
      if (d >= BAND_LEG_PX[0] && d <= BAND_LEG_PX[1]) legs.push([big[i], big[j]]);
    }
  }
  if (!legs.length) return [];
  const top = Math.max(...towns.map((t) => t.blocks | 0));
  const patrolled = top >= COURT_BLOCKS;
  /** @type {Hideout[]} */
  const out = [];
  const taken = new Set();
  for (let i = 0; i < Math.min(n, legs.length); i++) {
    let k = lwSeed(region >>> 0, i, HIDE) % legs.length;
    while (taken.has(k)) k = (k + 1) % legs.length;
    taken.add(k);
    const [a, b] = legs[k];
    const plan = world.routeOf(a, b);
    if (plan === undefined) return undefined;   // not planned yet: asked again
    const at = plan?.pixels?.length ? hideoutOff(plan.pixels, lwSeed(region >>> 0, i, HIDE, 1), world) : null;
    if (!at) continue;
    out.push({ key: `O${region >>> 0}.${i}`, region: region >>> 0, i, ...at, ...pixelNative(at.px, at.py), a: a.mapId, b: b.mapId, patrolled, top });
  }
  return out;
}

/** A point HIDEOUT_OFF_PX off the middle of a road's pixels, to the seed's side - dry, on no town; null none. */
function hideoutOff(pixels, seed, world) {
  const mid = Math.floor(pixels.length / 2);
  const off = HIDEOUT_OFF_PX[seed % 2], side = (seed >>> 1) % 2 ? 1 : -1;
  for (const shift of [0, 1, -1, 2, -2]) {
    const m = Math.max(0, Math.min(pixels.length - 1, mid + shift));
    const p = pixels[m], q = pixels[Math.min(pixels.length - 1, m + 1)], o = pixels[Math.max(0, m - 1)];
    const dx = Math.sign(q.x - o.x), dy = Math.sign(q.y - o.y);
    const perp = dx || dy ? { x: -dy, y: dx } : { x: 1, y: 0 };
    for (const d of [off, HIDEOUT_OFF_PX[0] + HIDEOUT_OFF_PX[1] - off]) {
      for (const s of [side, -side]) {
        const px = p.x + perp.x * d * s, py = p.y + perp.y * d * s;
        if (px < 0 || py < 0 || px > 999 || py > 499) continue;
        if (world.townsNear(px, py, 0).length) continue;
        const c = pixelNative(px, py);
        if (world.dryAt && !world.dryAt(c.x, c.z)) continue;
        return { px, py };
      }
    }
  }
  return null;
}

/** The dice's routs of a hideout's bands: the era's rout minute, or null (none that era). @param {Hideout} h @param {number} e */
export function routOfEra(h, e) {
  const rng = lwRng(textSeed(h.key), ROUT, e);
  if (rng() >= (h.patrolled ? ROUT_CHANCE.patrolled : ROUT_CHANCE.wild)) return null;
  const era = BAND_ERA_DAYS * DAY_MIN;
  return e * era + era * (0.1 + 0.8 * rng());
}

/** The dice's generations counted, kept by hideout (the eras walked once). @type {Map<string, { e: number, gen: number, lastT: number }>} */
const GENS = new Map();
/**
 * The dice's generation at minute `t`: the routs whose vacancy has ended (each the next band formed), the minute the
 * standing one formed, and whether its hideout stands empty now (a rout this vacancy). The eras are walked once and
 * kept (monotone: a later minute walks on from the last).
 * @param {Hideout} h @param {number} t @returns {{ gen: number, formedT: number, vacant: boolean }}
 */
export function genAt(h, t) {
  const era = BAND_ERA_DAYS * DAY_MIN, vac = BAND_VACANT_DAYS * DAY_MIN;
  const k = Math.max(0, Math.floor(t / era));
  // the eras before the one whose rout may still be in its vacancy (k - 1) are counted once, and kept
  let c = GENS.get(h.key);
  if (!c || c.e > k - 1) c = { e: 0, gen: 0, lastT: -Infinity };
  for (; c.e < k - 1; c.e++) { const r = routOfEra(h, c.e); if (r != null) { c.gen++; c.lastT = r + vac; } }
  if (GENS.size > 512) GENS.clear();
  GENS.set(h.key, c);
  let gen = c.gen, formedT = c.lastT, vacant = false;
  for (let e = Math.max(0, k - 1); e <= k; e++) {
    const r = routOfEra(h, e);
    if (r == null || r > t) continue;
    if (t < r + vac) { vacant = true; continue; }
    gen++; formedT = r + vac;
  }
  return { gen, formedT, vacant };
}

/**
 * THE BAND at a hideout at minute `t` for this character - or null while its hideout stands empty (the dice's vacancy,
 * or the character's own: a rout by their hand, `routs` the character's `routed` tales by key `<hideout>@<gen>.<heir>`).
 * @param {Hideout} h @param {number} t @param {Map<string, { t: number }> | null} [routs] @param {(region: number) => number} [bankOf]
 * @returns {Band | null}
 */
export function outlawBandAt(h, t, routs = null, bankOf = getNameBankOfRegion) {
  const g = genAt(h, t);
  if (g.vacant) return null;
  let heir = 0, formedT = g.formedT;
  const vac = BAND_VACANT_DAYS * DAY_MIN;
  for (let r = routs?.get(`${h.key}@${g.gen}.0`); r; r = routs?.get(`${h.key}@${g.gen}.${heir}`)) {
    if (r.t > t) break;   // a rout to come is no rout yet (a load past it reads it from its minute)
    if (t < r.t + vac) return null;
    heir++; formedT = r.t + vac;
  }
  const key = `${h.key}~${g.gen}${heir ? `h${heir}` : ''}`;
  const people = bandPeople(h, key, bankOf);
  return { key, hideout: h, gen: g.gen, heir, formedT, name: outlawBandName(key, people[0]?.name ?? ''), level: Math.max(...people.map((p) => p.level)), people };
}

/** A band's name off its key (the leader's own one time in three). @param {string} key @param {string} leader */
export function outlawBandName(key, leader) {
  const rng = lwRng(textSeed(key), BAND, 0x6e616d65);   // 'name'
  const noun = pickOf(rng, BAND_NOUNS), word = pickOf(rng, BAND_WORDS);
  const first = String(leader).split(' ')[0];
  return rng() < 1 / 3 && first ? `${first}'s ${noun}` : `the ${word} ${noun}`;
}

/** A band's people, minted off its key: BAND_SIZE of OUTLAW_CLASSES, the leader first and the strongest, at levels by
 *  its region's greatest town. @param {Hideout} h @param {string} key @param {(region: number) => number} bankOf */
export function bandPeople(h, key, bankOf = getNameBankOfRegion) {
  const rng = lwRng(textSeed(key), BAND);
  const n = rollInt(rng, BAND_SIZE[0], BAND_SIZE[1]);
  const base = Math.max(2, Math.min(14, 2 + Math.floor((h.top | 0) / 6)));
  const out = [];
  for (let i = 0; i < n; i++) {
    const female = rng() < 0.3;
    const gender = female ? GENDERS.Female : GENDERS.Male;
    const cls = i === 0 ? pickOf(rng, [MOBILE_TYPES.Nightblade, MOBILE_TYPES.Barbarian, MOBILE_TYPES.Rogue]) : pickOf(rng, OUTLAW_CLASSES);
    const level = Math.max(1, base + (i === 0 ? 3 : rollInt(rng, -1, 2)));
    out.push({ id: `${key}.${i}`, name: residentName(lwSeed(textSeed(key), i, 0x6e6d), bankOf(h.region), gender), cls, level, gender, sex: female ? 'female' : 'male' });
  }
  return out;
}

/**
 * THE HOLD-UP ON THE DICE: whether a trip's trouble at map pixel (`px`, `py`) is a band's - a hideout within
 * OUTLAW_REACH_PX standing a band, in BAND_SHARE of such troubles (the trip's own draw, never the trouble's stream) - and
 * its foes: the band's people (to `max`), at their levels. Null: the land's own trouble.
 * @param {any} trip @param {number} px @param {number} py @param {number} t @param {Hideout[]} hideouts
 * @param {Map<string, { t: number }> | null} [routs] @param {number} [max]
 * @returns {{ band: Band, foes: number[], level: number } | null}
 */
export function bandTrouble(trip, px, py, t, hideouts, routs = null, max = 6) {
  const near = hideouts.filter((h) => Math.max(Math.abs(h.px - px), Math.abs(h.py - py)) <= OUTLAW_REACH_PX)
    .sort((a, b) => Math.max(Math.abs(a.px - px), Math.abs(a.py - py)) - Math.max(Math.abs(b.px - px), Math.abs(b.py - py)) || (a.key < b.key ? -1 : 1));
  if (!near.length) return null;
  if (lwRng(textSeed(trip.id), BAND)() >= BAND_SHARE) return null;
  for (const h of near) {
    const band = outlawBandAt(h, t, routs);
    if (!band) continue;
    const who = band.people.slice(0, max);
    return { band, foes: who.map((p) => p.cls), level: Math.round(who.reduce((a, p) => a + p.level, 0) / who.length) };
  }
  return null;
}

/**
 * THE TAKE: the parties a band robbed (`trips` - the troubled trips of its leg's towns, the host's) since it formed and
 * within TAKE_DAYS of `t` - each its share of a purse (a counter's: TAKE_PURSE_SHARE of it; else ROB_GOLD) and
 * TAKE_GOODS of its goods, to TAKE_GOODS_MAX.
 * @param {Band} band @param {any[]} trips @param {number} t
 * @returns {{ robbed: any[], gold: number, goods: number }}
 */
export function takeOf(band, trips, t) {
  const from = Math.max(band.formedT, t - TAKE_DAYS * DAY_MIN);
  const seen = new Set();
  const robbed = trips.filter((tr) => {
    const e = tr?.enc;
    if (!e || e.kind !== 'robbed' || e.band !== band.key || e.t0 < from || e.t0 > t || seen.has(tr.id)) return false;
    seen.add(tr.id);
    return true;
  });
  const gold = robbed.reduce((a, tr) => a + (tr.kind === 'merchant' || tr.kind === 'carter' || tr.kind === 'pedlar' ? Math.round(purseOf(CARAVAN_QUALITY(tr)) * TAKE_PURSE_SHARE) : ROB_GOLD), 0);
  return { robbed, gold, goods: Math.min(TAKE_GOODS_MAX, TAKE_GOODS * robbed.length) };
}
