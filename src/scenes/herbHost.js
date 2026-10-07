// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF1 (2026-09-28, Mac: "Life skills will utilize things like tree
// chopping, picking up ingredients, fishing, etc. Active player
// involvement and actual UI integration for life skills") - HERBALISM IN
// THE STREAMING WORLD (bible/06-Systems/Professions-Arc.md 5, 6, 8, 22;
// FORAGE0 14). PROF2 made the host every gathering profession's
// (scenes/gatherHost.js - one prompt, one act, one book); this is
// Herbalism's KIND in it:
//
//   THE PATCHES. Each built wilderness pixel stands its day's herb
//   patches (net/nodeLaw.js - the clock's, the same for every client),
//   each where DFU's own nature would stand on that tile (world/
//   terrainNature.js natureStandsAt: never in a town, on water or a
//   cliff), as a small cluster of the herb's own world picture (TEXTURE
//   .254, the plant's item flat - no new art). A patch is gone for the
//   day once both its harvests are (herbs and food, PROF0 5.3).
//   THE PLAN. What E does at a patch - the herbs first while untaken, the
//   Basket by the act choice key - or what it needs. TOOL-USE: the
//   Sickle's Use asks the herbs, the Basket's the food, the choice unmoved.
//   THE ACT. Foraging's checks first, with the Sickle's lines or the
//   Basket's (FORAGE0 14.3); the machine is systems/herbAct.js; the
//   Sickle's steady hand draws DFU's Tanto in the hand.
// ═══════════════════════════════════════════════════════════════════
import { herbPatches, nodeKey, HERB_TABLES } from '../net/nodeLaw.js';
import { tierOpen, TIER_RANKS, actBand, PROF_RANK_MAX, herbKey, storesFullIn, fullWordsIn, GROUND_WHERE, GROUND_WHERE_WORDS } from '../net/professionLaw.js';
import { natureStandsAt, insideRocks } from '../world/terrainNature.js';
import { createHerbAct } from '../systems/herbAct.js';
import { FT } from '../systems/foragingLaw.js';
import { foragingActRefusal, foragingToolIn, actChecksRefusal } from '../systems/foragingInstall.js';
import { materialLabel } from '../systems/profItems.js';
import { templateByIndex } from '../systems/itemTemplates.js';
import { liveStat } from '../systems/statMods.js';
import { getPref } from '../systems/uiPrefs.js';
import { WORLD_MAP_TILE_DIM } from '../world/terrainTiles.js';

/** The item flats' archive - every plant's world picture is in it (its template's worldTextureRecord). */
export const HERB_FLAT_ARCHIVE = 254;
/** A patch is this many of its herb's flats, spread this far (m) about its point, at this times the item's own size. */
export const PATCH_FLATS = 5;
export const PATCH_SPREAD = 0.7;
export const PATCH_SCALE = 1.6;
/** NODE-MARKS: a patch's glow about its point - its flats' ring and their height (m). */
export const PATCH_MARK = Object.freeze({ w: 2.2, h: 1.3 });

/**
 * A PIXEL'S PATCHES AS THE CLIENT STANDS THEM: the law's patches of the day, each at the tile its (u, v) falls on,
 * where DFU's nature would stand there - `{ key, slot, herb, tier, offSeason, local }`, `local` pixel-local metres.
 * NODE-CLEAR (AUDIT 2026-10-01 part four): never inside a rock piece (`rocks`, the pixel's) - one stood there, on the compass
 * and glowing, and no look reached it; it stands nowhere, as VEIN-CLEAR's last vein does.
 * VERGE1: `verge` (`(x, z, reach) => boolean`, the pixel's - world/roadVerge.js vergeClear), when handed, keeps a patch's
 * glow off the roads: a patch whose ring (PATCH_MARK's width) would reach one stands nowhere that day.
 * @param {{ px: number, py: number, day: number, climate: number, confirmed?: boolean, seasonalEye?: boolean,
 *   samples: Float32Array, tilemap: Uint8Array, locationRect?: any, rocks?: number[][],
 *   verge?: ((x: number, z: number, reach: number) => boolean)|null }} p
 */
export function standPatches({ px, py, day, climate, confirmed = false, seasonalEye = false, samples, tilemap, locationRect = null, rocks = [], verge = null }) {
  const out = [];
  if (!HERB_TABLES[climate]) return out;
  const clear = verge ? (x, z) => verge(x, z, PATCH_MARK.w / 2) : null;
  for (const p of herbPatches({ x: px, y: py, day, climate, confirmed, seasonalEye })) {
    const tx = Math.min(WORLD_MAP_TILE_DIM - 1, Math.floor(p.u * WORLD_MAP_TILE_DIM));
    const ty = Math.min(WORLD_MAP_TILE_DIM - 1, Math.floor(p.v * WORLD_MAP_TILE_DIM));
    const base = natureStandsAt(samples, tilemap, locationRect, tx, ty, clear);
    if (!base || insideRocks(rocks, base.x, base.z)) continue;   // NODE-CLEAR
    out.push({ key: nodeKey({ kind: 'herb', x: px, y: py, day, slot: p.slot }), slot: p.slot, herb: p.herb, tier: p.tier, offSeason: p.offSeason, local: [base.x, base.y, base.z] });
  }
  return out;
}
/** A patch's flats: PATCH_FLATS base positions, one at its point and the rest in a ring turned by its slot. */
export function patchFlats(patch) {
  const [x, y, z] = patch.local;
  const out = [[x, y, z]];
  for (let i = 1; i < PATCH_FLATS; i++) {
    const a = (patch.slot * 1.3) + (i * 2 * Math.PI) / (PATCH_FLATS - 1);
    const r = PATCH_SPREAD * (i % 2 ? 1 : 0.6);
    out.push([x + Math.cos(a) * r, y, z + Math.sin(a) * r]);
  }
  return out;
}

/**
 * WHAT E DOES AT A PATCH, and the prompt that says it: `{ kind, verb, rest, ready, needsRank? }` - `kind` 'herbs' or 'food'
 * (the choice key's pick, the herbs first while untaken); `ready` false with `rest` naming what is missing, and a rank
 * short the rank it needs (VEIN-NEED). TOOL-USE: `only` - a tool's Use asks `basket`'s harvest alone (the Sickle the
 * herbs, the Basket the food): taken, it says so, never the other harvest's act. CAP-OFF: no day's cap.
 * @param {{ patch: any, taken: (k: string) => boolean, counting: (k: string) => boolean, basket: boolean, rank: number,
 *   sickle: boolean, basketTool: boolean, storesFull: (key: string) => boolean, herbKeyOf: (t: number) => string,
 *   only?: boolean, fullWords?: string }} o
 */
export function patchPlan({ patch, taken, counting, basket, rank, sickle, basketTool, storesFull, herbKeyOf, only = false, fullWords = 'Stores full' }) {   // BAG1: `fullWords` the book's
  const herbsLeft = !taken('herbs') && !counting('herbs');
  const foodLeft = !taken('food') && !counting('food');
  let kind = basket ? 'food' : 'herbs';
  if (!only && kind === 'herbs' && !herbsLeft && foodLeft) kind = 'food';
  if (!only && kind === 'food' && !foodLeft && herbsLeft) kind = 'herbs';
  const both = herbsLeft && foodLeft;
  const name = templateByIndex(patch.herb)?.name ?? 'the herb';
  const rankWord = `Herbalism ${rank}`;
  if (!herbsLeft && !foodLeft) return { kind, verb: `${name} - gathered today`, rest: counting('herbs') || counting('food') ? 'being counted' : '', ready: false, both: false };
  // TOOL-USE: the tool's own harvest gone, the other left
  if (!(kind === 'food' ? foodLeft : herbsLeft)) return { kind, verb: kind === 'food' ? 'Search with the Basket' : `Pick ${name}`, rest: counting(kind) ? 'being counted' : 'gathered today', ready: false, both };
  if (kind === 'food') {
    if (!basketTool) return { kind, verb: 'Search with the Basket', rest: 'needs a Basket', ready: false, both };
    return { kind, verb: 'Search with the Basket', rest: rankWord, ready: true, both };
  }
  if (!tierOpen(rank, patch.tier)) return { kind, verb: `Pick ${name}`, rest: `needs Herbalism ${TIER_RANKS[patch.tier - 1]}`, ready: false, both, needsRank: TIER_RANKS[patch.tier - 1] };
  if (patch.tier > 1 && !sickle) return { kind, verb: `Pick ${name}`, rest: 'needs a Sickle', ready: false, both };
  const key = herbKeyOf(patch.herb);
  if (key && storesFull(key)) return { kind, verb: `Pick ${name}`, rest: `${fullWords} - ${materialLabel(key)}`, ready: false, both };
  return { kind, verb: `Pick ${name}`, rest: rankWord, ready: true, both };
}

/** The Sickle in the hand for the steady hand's length (FORAGE0 14.2): DFU's own Tanto, its idle frame. */
export const SICKLE_HAND = Object.freeze({ group: 'Weapons', templateIndex: 114, material: 0 });

/**
 * HERBALISM'S KIND in the gathering host (scenes/gatherHost.js): its patches, their pictures, the plan, the act.
 * @param {{ book: any }} deps
 * @returns {import('./gatherHost.js').GatherKind}
 */
export function herbKind({ book }) {
  const gone = (p) => book.taken(p.key, 'herbs') && book.taken(p.key, 'food');
  /** The patch's plan for its herbs (`basket` false) or its food, `only` that harvest (a tool's Use, a menu's row). */
  const planOf = (p, { entity, info, rank }, basket, only) => {
    const plan = patchPlan({
      patch: p, taken: (k) => book.taken(p.key, k), counting: (k) => book.counting(p.key, k), basket, only,
      rank: rank('herbalism'), sickle: !!foragingToolIn(entity, FT.Sickle), basketTool: !!foragingToolIn(entity, FT.Basket),
      storesFull: (key) => storesFullIn(book, key), fullWords: fullWordsIn(book), herbKeyOf: (h) => herbKey(h, info?.region ?? 0),   // STORES-ROOM: every origin, as the service counts
    });
    return { ...plan, harvest: plan.kind, profession: 'herbalism' };
  };
  return {
    id: 'herb',
    professions: Object.freeze(['herbalism']),
    nodesOf({ px, py, day, info, confirmed, specs, entry }) {
      if (!HERB_TABLES[info.climate]) return [];
      return standPatches({
        px, py, day, climate: info.climate, confirmed, seasonalEye: specs('herbalism')[100] === 'seasonal-eye',
        samples: entry.samples, tilemap: entry.tilemap, locationRect: entry.locationRect ?? entry.wodSite ?? null,   // AUDIT 29 C8: a WoD site's rect, as nature keeps off it (terrainGen.js)
        rocks: entry.rocks ?? [],   // NODE-CLEAR: and never inside a rock piece
        verge: entry.verge ?? null,   // VERGE1: nor over a road
      });
    },
    flatsOf(p) {
      const record = templateByIndex(p.herb)?.worldTextureRecord;
      return Number.isInteger(record) ? [{ archive: HERB_FLAT_ARCHIVE, record, scale: PATCH_SCALE, centers: patchFlats(p) }] : [];
    },
    gone,
    mark: (p) => (gone(p) ? null : PATCH_MARK),   // NODE-MARKS: on the compass and lit while either harvest stands
    tools: Object.freeze([FT.Sickle, FT.Basket]),   // TOOL-USE
    where: () => actChecksRefusal(GROUND_WHERE, GROUND_WHERE_WORDS),   // SETTLE-SAID
    /** PROF-MENU: the menu's title - the patch's herb. */
    nodeName: (p) => templateByIndex(p.herb)?.name ?? 'Herbs',
    plan(p, { entity, info, rank, tool = null }) {
      // TOOL-USE: the Sickle's Use asks the herbs and the Basket's the food; E (no tool) the herbs first while untaken
      const only = tool === FT.Sickle ? 'herbs' : tool === FT.Basket ? 'food' : null;
      return planOf(p, { entity, info, rank }, only ? only === 'food' : false, !!only);
    },
    /** PROF-MENU (2026-10-01, Mac: "use the same menu the loot menu uses"): THE PATCH'S TWO HARVESTS AS THE MENU'S ROWS -
     *  its herbs and its food (the act choice key's toggle, retired), each its own refusal; gathered whole, its one row. */
    rows(p, ctx) {
      const herbs = planOf(p, ctx, false, true), food = planOf(p, ctx, true, true);
      if (!herbs.both && !herbs.ready && !food.ready && herbs.verb === food.verb) return [{ ...herbs, id: 'herbs' }];
      return [{ ...herbs, id: 'herbs' }, { ...food, id: 'food' }];
    },
    start(p, plan, { entity, rank, keyLabel = () => 'E', tool: usedTool = null, byPress = false }) {
      const used = usedTool ?? (byPress || null);   // PROF-MENU: a click's or a list's press holds the act as a tool's Use does
      const common = plan.harvest === 'herbs' && p.tier === 1;
      const refusal = foragingActRefusal(plan.harvest === 'food' ? FT.Basket : FT.Sickle);
      if (refusal) return { refused: refusal };
      const kind = plan.harvest === 'food' ? 'basket' : common ? 'hand' : 'steady';
      const tool = plan.harvest === 'food' ? foragingToolIn(entity, FT.Basket) : common ? null : foragingToolIn(entity, FT.Sickle);
      const r = rank('herbalism');
      return {
        act: createHerbAct({ kind, band: actBand(liveStat(entity, 'intelligence')), botanist: book.track('herbalism').specs?.[50] === 'botanist', master: r >= PROF_RANK_MAX, gentle: getPref('gentleActs') === true }),
        // STEADY-SAID (AUDIT 2026-10-01 part four): the steady hand's key, which E's start must hold to the end - the meter
        // said "hold still" and nothing of the key, and a tap of E ended the act with nothing taken (the Sickle's Use
        // holds it itself: no key to name)
        harvest: plan.harvest, tool, profession: 'herbalism', label: plan.harvest === 'food' ? 'click the glint' : kind === 'steady' && !used ? keyLabel('Interact') : '',
        hand: (a) => (a.harvest === 'herbs' && a.tool ? SICKLE_HAND : null),
        heldByUse: !!used && kind === 'steady',   // TOOL-USE: the Sickle's Use holds the steady hand - keep still, no E held
        // AUDIT BAG1 B4: the material the herbs are, by the region the harvest names (the service's own key) - the Basket's
        // food is the service's roll, named nowhere
        ...(plan.harvest === 'herbs' ? { material: (info) => herbKey(p.herb, info?.region ?? 0) } : {}),
      };
    },
    cleanNote: (a) => (a.harvest === 'food' ? ' (every find)' : ' (unbruised)'),
    title: () => 'Herbalist',
  };
}
