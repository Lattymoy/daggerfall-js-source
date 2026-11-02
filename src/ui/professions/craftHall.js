// @ts-check
// CRAFT-HALL (2026-10-26): what a crafter needs to see while working - a track's progress bar, which first-time bonuses
// are spent or still owed, and what raises each track. Pure functions over the professions book's state; profPages.js
// draws them. bible/06-Systems/Professions-Arc.md section 56.
import {
  PROFESSIONS,
  xpForRank,
  PROF_RANK_MAX,
  trackOf,
  topTierOf,
  harvestXp,
  HARVEST_XP_PER_TIER,
  smeltXp,
  herbXpTier,
  haulTier,
  WORK_RECIPES,
  workOpen,
  HIDES,
  tierOpen,
  craftLimitOf,
} from '../../net/professionLaw.js';
import {
  RECIPES,
  recipeOpen,
  craftXp,
  cookXp,
  masonXp,
  firstMakesOf,
  firstMakesSpent,
  firstCraftKey,
  FIRST_MAKE_SHARE,
  CRAFT_XP_PER_TIER,
} from '../../net/recipeLaw.js';
import { POTIONS, brewXp, DISENCHANT_XP } from '../../net/alchemyLaw.js';
import {
  material,
  VEIN_TABLES,
  dungeonVeinTable,
  regionSignature,
  WOOD_TABLES,
  RARE_WOODS,
  PINE_WOOD,
} from '../../net/nodeLaw.js';
import { MOTHERLODE_TIER } from '../../net/motherlodeLaw.js';
import { CLIMATES, REGION_NAMES } from '../../formats/mapsTables.js';
import { t, intlLocale } from '../../systems/textManager.js';

/** The track each station raises, keyed as profPages.js STATION_TILES. */
export const STATION_TRACKS = Object.freeze({
  forge: trackOf('smithing'),
  anvil: trackOf('smithing'),
  'temper-anvil': trackOf('smithing'),
  jeweller: trackOf('jewelcrafting'),
  workbench: trackOf('carpentry'),
  mason: trackOf('masonry'),
  loom: trackOf('outfitting'),
  'temper-loom': trackOf('outfitting'),
  fire: trackOf('cooking'),
  alchemy: trackOf('alchemy'),
  enchant: trackOf('enchanting'),
});
/** The five crafts, in the Professions page's order. */
export const CRAFT_TRACKS = Object.freeze(PROFESSIONS.filter((p) => p.kind === 'crafting').map((p) => p.id));

const tableTop = (/** @type {string[]} */ keys) => Math.max(0, ...keys.map((k) => material(k)?.tier ?? 0));
/** AUDIT HORIZONTAL A1: the highest grade each gathering act's own table holds - every climate's veins, a dungeon's, a
 *  region's signature ore and a Motherlode; every wood, rare ones too; every hide. "What raises" named the rank's top
 *  grade, which no vein, tree or hide stands at past 6. */
export const GATHER_TOPS = Object.freeze({
  mining: Math.max(
    MOTHERLODE_TIER,
    tableTop([
      ...Object.values(VEIN_TABLES).flat(),
      ...Object.values(CLIMATES).flatMap(dungeonVeinTable),
      ...REGION_NAMES.map((_, r) => regionSignature(r)?.ore ?? ''),
    ]),
  ),
  logging: tableTop([...Object.values(WOOD_TABLES).flat(), ...Object.values(RARE_WOODS), PINE_WOOD]),
  hunting: Math.max(0, ...HIDES.map((h) => h.tier)),
});
/** AUDIT HORIZONTAL A1: the highest grade a station's patterns (`professions` the recipes') the rank opens - the loom's
 *  stop at 5, the workbench's at 6. */
export const benchTop = (/** @type {string[]} */ professions, /** @type {number} */ rank) =>
  Math.max(1, ...RECIPES.filter((r) => professions.includes(r.profession) && recipeOpen(r, rank)).map((r) => r.tier));

/** Whether the bar is full: at Master, or held at its rank by the crafter's limit (the service pays nothing past it). */
const barFull = (track, limit) => track.rank >= PROF_RANK_MAX || !!(limit?.by?.length && track.rank >= limit.rank);

/** A track's bar, `{ now, max }`, from its rank's floor to the next rank. */
export function trackBar(track, limit = null) {
  if (barFull(track, limit)) return { now: 1, max: 1 };
  const floor = xpForRank(track.rank),
    next = xpForRank(track.rank + 1);
  return { now: Math.max(0, track.xp - floor), max: Math.max(1, next - floor) };
}
/** "350 XP to rank 35", or '' when the bar is full. */
export function toNextWords(track, limit = null) {
  if (barFull(track, limit)) return '';
  return t('prof.hall.toNext', '{xp, number} XP to rank {rank}', {
    xp: Math.max(0, xpForRank(track.rank + 1) - track.xp),
    rank: track.rank + 1,
  });
}

/**
 * AUDIT HORIZONTAL A2: the made set as the pages read it - the book's, with `closed` the crafts that take no more XP (the
 * crafter's limit holds them, or Master). The service lays a first on as MIN(xp + share, room) and spends it whatever it
 * credited, so a closed craft's first-time bonuses pay nothing and are offered nowhere. Null while nothing is known.
 * @param {any} made the book's `made` @param {Iterable<any>} tracks the book's tracks
 */
export function madeShown(made, tracks) {
  if (!made) return null;
  const list = [...(tracks ?? [])];
  return { ...made, closed: CRAFT_TRACKS.filter((id) => craftLimitOf(list, id).room <= 0) };
}
const closedTo = (made, track) => !!made?.closed?.includes(trackOf(track));

/** A track's first-time bonuses: `{ all, spent, share, closed }`. Null when the service has not said what was made; `all`
 *  0 for Enchanting, which has none. */
export function firstStanding(made, track) {
  const keys = firstMakesOf(track);
  if (!keys.length) return { all: 0, spent: 0, share: 0, closed: false };
  const spent = firstMakesSpent(made, track);
  if (!spent) return null;
  return {
    all: keys.length,
    spent: spent.size,
    share: /** @type {Record<string, number>} */ (FIRST_MAKE_SHARE)[trackOf(track)] ?? 0,
    closed: closedTo(made, track),
  };
}
/** Whether a first-time bonus is still owed: true, false, or null when unknown, not this track's, or its craft closed. */
export function firstOwed(made, key, track) {
  if (!key || !firstMakesOf(track).includes(key) || closedTo(made, track)) return null;
  const spent = firstMakesSpent(made, track);
  return spent ? !spent.has(key) : null;
}
export const recipeFirstOwed = (made, r) => (!r ? null : firstOwed(made, firstCraftKey(r), r.profession));
export const workFirstOwed = (made, w) => (!w?.xp ? null : firstOwed(made, w.id, w.xp));
export const brewFirstOwed = (made, potion) => (!potion ? null : firstOwed(made, potion.id, 'alchemy'));

const KIN_OF = new Map();
for (const r of RECIPES) KIN_OF.set(firstCraftKey(r), [...(KIN_OF.get(firstCraftKey(r)) ?? []), r]);
/**
 * The owed first-time bonuses the rank can make now, highest grade first: `{ key, name, tier, kinds }`, `kinds` being
 * the materials it can be made of at that grade. Empty when what was made is unknown.
 * @param {any} made @param {string} track @param {number} rank @param {any} [specs] @param {(key: string) => string} [nameOf]
 */
export function owedOpenFirsts(made, track, rank, specs = null, nameOf = (k) => k) {
  const spent = firstMakesSpent(made, track);
  if (!spent || closedTo(made, track)) return [];
  /** @type {{ key: string, name: string, tier: number, kinds: string[] }[]} */
  const out = [];
  for (const key of firstMakesOf(track)) {
    if (spent.has(key)) continue;
    const kin = KIN_OF.get(key) ?? [];
    if (kin.length) {
      const open = kin.filter((r) => recipeOpen(r, rank, specs));
      if (open.length)
        out.push({
          key,
          name: open[0].pattern,
          tier: open[0].tier,
          kinds: [...new Set(open.map((r) => r.madeOf).filter(Boolean))],
        });
      continue;
    }
    const w = WORK_RECIPES.find((x) => x.id === key);
    if (w) {
      if (workOpen(w, rank)) out.push({ key, name: nameOf(w.out), tier: /** @type {any} */ (w).tier ?? 1, kinds: [] });
      continue;
    }
    const potion = POTIONS.find((x) => x.id === key);
    if (potion && rank >= potion.rank) out.push({ key, name: potion.name, tier: potion.tier, kinds: [] });
  }
  return out.sort((a, b) => b.tier - a.tier || a.name.localeCompare(b.name));
}

/**
 * What raises a track at a rank, as `[act, figure]` rows. Every figure comes from the law the service pays by, at the
 * best grade the rank works. `pct` is the Firmament's bonus, which never applies to first-time bonuses.
 * @param {string} track @param {number} rank @param {{ pct?: number }} [opts]
 * @returns {Array<[string, string]>}
 */
export function xpSources(track, rank, { pct = 0 } = {}) {
  const id = trackOf(track),
    top = topTierOf(rank);
  const at = (/** @type {number} */ xp, /** @type {number} */ tier) =>
    t('prof.hall.src.atGrade', '{xp, number} XP at grade {tier}', { xp, tier });
  const clean = (/** @type {number} */ xp, /** @type {number} */ more, /** @type {number} */ tier) =>
    t('prof.hall.src.atGradeClean', '{xp, number} XP at grade {tier}, {more, number} for clean work', {
      xp,
      more,
      tier,
    });
  const harvest = (/** @type {number} */ tier) =>
    clean(harvestXp(tier, rank, false), harvestXp(tier, rank, true), tier);
  const gathered = (/** @type {number} */ most) => harvest(Math.min(top, most));
  const piece = (/** @type {string[]} */ professions) => {
    const g = benchTop(professions, rank);
    return at(craftXp(g, rank), g);
  };
  const share = /** @type {Record<string, number>} */ (FIRST_MAKE_SHARE)[id] ?? 0;
  const first = () => t('prof.hall.src.firstShare', '+{xp, number} XP, once each', { xp: share });
  // Court writs (writXp) and guild crafting writs (craftWritXp) both pay twice their pay; the test holds them equal
  const twice = () => t('prof.hall.src.writ', 'Twice its pay');
  const none = () => t('prof.hall.src.none', 'No XP');
  /** @type {Array<[string, string]>} */
  const rows = [];
  switch (id) {
    case 'mining':
      rows.push([t('prof.hall.src.vein', 'Mining a vein or boulder'), gathered(GATHER_TOPS.mining)]);
      rows.push([t('prof.hall.src.courtOre', 'Court writ for ore or stone'), twice()]); // AUDIT HORIZONTAL A1: a Court never asks a gem (nodeLaw regionWritTable)
      break;
    case 'logging':
      rows.push([t('prof.hall.src.tree', 'Felling a tree'), gathered(GATHER_TOPS.logging)]);
      rows.push([t('prof.hall.src.courtWood', 'Court writ for wood'), twice()]);
      break;
    case 'herbalism':
      // AUDIT HORIZONTAL A1: a common herb has no clean pick, and below rank 10 only common herbs open
      rows.push([
        t('prof.hall.src.herb', 'Picking herbs'),
        tierOpen(rank, 2) ? harvest(herbXpTier(rank)) : at(harvestXp(herbXpTier(rank), rank, false), herbXpTier(rank)),
      ]);
      rows.push([t('prof.hall.src.courtHerb', 'Court writ for herbs'), twice()]);
      break;
    case 'hunting':
      rows.push([t('prof.hall.src.skin', 'Skinning a kill'), gathered(GATHER_TOPS.hunting)]);
      break;
    case 'fishing':
      rows.push([t('prof.hall.src.haul', 'Hauling a net'), harvest(haulTier(rank))]);
      break;
    case 'smithing':
      rows.push([
        t('prof.hall.src.anvil', "A piece at the anvil or jeweler's bench"),
        piece(['smithing', 'jewelcrafting']),
      ]);
      rows.push([t('prof.hall.src.firstPiece', 'Your first piece at each grade'), first()]);
      rows.push([t('prof.hall.src.smelt', 'Smelting an ingot'), at(smeltXp(top, 1, rank), top)]);
      rows.push([
        t('prof.hall.src.temperAnvil', 'Tempering at the anvil'),
        t('prof.hall.src.temper', "The piece's craft XP"),
      ]);
      rows.push([t('prof.hall.src.kitWrit', 'Guild writ for Repair Kits'), twice()]);
      break;
    case 'building':
      rows.push([t('prof.hall.src.bench', 'A piece at the workbench'), piece(['carpentry'])]);
      rows.push([
        t('prof.hall.src.mason', "A cut or mix at the mason's bench"),
        t('prof.hall.src.masonXp', '{xp, number} XP each, {more, number} for clean work', {
          xp: masonXp(1, rank),
          more: masonXp(1, rank, { clean: true }),
        }),
      ]);
      rows.push([t('prof.hall.src.firstBuild', 'Your first piece at each grade, first cut and first mix'), first()]);
      rows.push([t('prof.hall.src.saw', 'Sawing planks'), none()]);
      break;
    case 'outfitting':
      rows.push([t('prof.hall.src.loom', 'A piece at the loom'), piece(['outfitting'])]);
      rows.push([
        t('prof.hall.src.firstCloth', 'Your first piece at each grade (not of cloth bought with silver)'),
        first(),
      ]);
      rows.push([
        t('prof.hall.src.temperLoom', 'Tempering at the loom'),
        t('prof.hall.src.temper', "The piece's craft XP"),
      ]);
      rows.push([t('prof.hall.src.cure', 'Curing, weaving and spinning'), none()]);
      break;
    case 'provisioning': {
      const potion = [...POTIONS].filter((p) => rank >= p.rank).sort((a, b) => b.tier - a.tier)[0] ?? null;
      rows.push([
        t('prof.hall.src.dish', 'Cooking a dish'),
        t('prof.hall.src.dishXp', '{xp, number} XP, {more, number} with every pan on time', {
          xp: cookXp(rank),
          more: cookXp(rank, { clean: true }),
        }),
      ]);
      if (potion) rows.push([t('prof.hall.src.brew', 'Brewing a potion'), at(brewXp(potion, rank), potion.tier)]);
      rows.push([t('prof.hall.src.firstDish', 'Your first of each dish and potion'), first()]);
      rows.push([t('prof.hall.src.potionWrit', 'Guild writ for potions or dishes'), twice()]);
      break;
    }
    case 'enchanting':
      rows.push([
        t('prof.hall.src.disenchant', 'Disenchanting a crafted piece'),
        t('prof.hall.src.disenchantXp', '{per, number} XP per Essence per grade ({xp, number} at grade {tier})', {
          per: DISENCHANT_XP,
          xp: DISENCHANT_XP * top,
          tier: top,
        }),
      ]);
      rows.push([t('prof.hall.src.noFirst', 'First-time bonuses'), t('prof.hall.src.noFirstXp', 'None')]);
      break;
    default:
      break;
  }
  // AUDIT HORIZONTAL A1: the service scales no writ's XP (writXp, a guild writ's xp_given)
  if (pct > 0)
    rows.push([
      t('prof.hall.src.stars', 'Your Firmament stars'),
      t('prof.hall.src.starsPct', '+{pct}%, not on writs or first-time bonuses', { pct }),
    ]);
  return rows;
}
/** The line under the acts: what a grade pays, and the quarter for work more than two grades down. '' for tracks whose
 *  work is always at the rank's own grade. AUDIT HORIZONTAL A1: Smithing's says the ingot's 10 beside the piece's 20. */
export function gradeNote(track, rank) {
  const id = trackOf(track),
    top = topTierOf(rank);
  const per = PROFESSIONS.find((p) => p.id === id)?.kind === 'gathering' ? HARVEST_XP_PER_TIER : CRAFT_XP_PER_TIER;
  if (id === 'herbalism' || id === 'fishing' || id === 'enchanting') return '';
  if (id === 'smithing')
    return t(
      'prof.hall.src.gradeNoteSmith',
      'Each grade is worth {per, number} experience a piece and {ingot, number} an ingot. Work more than two grades below your best (grade {top}) earns a quarter.',
      { per, ingot: smeltXp(1, 1), top },
    );
  return t(
    'prof.hall.src.gradeNote',
    'Each grade is worth {per, number} experience. Work more than two grades below your best (grade {top}) earns a quarter.',
    { per, top },
  );
}
/** "First-time bonuses: 12 of 221 made (+500 XP each)"; Enchanting's "No first-time bonuses"; a closed craft's no pay;
 *  '' when unknown. */
export function firstsLine(standing) {
  if (!standing) return '';
  if (!standing.all) return t('prof.hall.firsts.none', 'No first-time bonuses');
  if (standing.closed)
    return t(
      'prof.hall.firsts.closed',
      'First-time bonuses: {spent, number} of {all, number} made. This craft can rise no further, so they pay nothing.',
      standing,
    );
  return t(
    'prof.hall.firsts.line',
    'First-time bonuses: {spent, number} of {all, number} made (+{share, number} XP each)',
    standing,
  );
}
/** A card's mark: "First-time bonus" when owed, "Made before" when spent, '' when unknown. */
export const firstBadge = (owed) =>
  owed === true
    ? t('prof.hall.badge.owed', 'First-time bonus')
    : owed === false
      ? t('prof.hall.badge.made', 'Made before')
      : '';
/** Past this many materials (a jewel's grade has 41 gems) a name gives the count instead of the list. */
export const OWED_KINDS_MAX = 4;
/** "Longsword, grade 6 (Adamantium, Ebony, Orcish, or Warforged)" or "Amulet, grade 3 (any of 41 kinds)". */
export function owedName(f) {
  if (f.kinds.length > OWED_KINDS_MAX)
    return t('prof.hall.owed.many', '{name}, grade {tier} (any of {n, number} kinds)', {
      name: f.name,
      tier: f.tier,
      n: f.kinds.length,
    });
  let kinds = f.kinds.join(', ');
  try {
    kinds = f.kinds.length ? new Intl.ListFormat(intlLocale(), { type: 'disjunction' }).format(f.kinds) : '';
  } catch {
    /* the plain list */
  }
  return kinds
    ? t('prof.hall.owed.kinds', '{name}, grade {tier} ({kinds})', { name: f.name, tier: f.tier, kinds })
    : t('prof.hall.owed.name', '{name}, grade {tier}', { name: f.name, tier: f.tier });
}
