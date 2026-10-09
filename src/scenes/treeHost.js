// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF4 (2026-09-28, Mac: "Continue") - LOGGING IN THE STREAMING WORLD
// (bible/06-Systems/Professions-Arc.md 4.2, 5.2, 6, 25): Logging's KIND
// in the one gathering host (scenes/gatherHost.js).
//
//   THE TREES ARE THE FOREST'S. A built pixel keeps its tree flats -
//   Daggerfall's own nature flats (world/terrainNature.js, one seeded
//   layout every client stands the same) whose record World of
//   Daggerfall names a Tree (TREE_RECORDS, its LocationHelper table by
//   the climate's summer archive; a winter archive is its summer
//   archive's records under snow). The day's trees (net/nodeLaw.js - the
//   clock's) each stand AT the tree flat nearest their law point, one
//   node a flat: the player chops a tree of the forest.
//   FELLED, for the rest of the character's UTC day: the tree's own flat
//   is sunk below the ground in its batch (the batch rewritten in place,
//   render/renderer.js moveBillboardBatch) and its STUMP stands - the
//   archive's Tree Trunk (STUMP_RECORD) where World of Daggerfall names
//   one. On the service's answer it FALLS: its own picture on a one-flat
//   batch tipped about its root away from the player over FALL_S (the
//   billboard shader's uTip) and gone once it lies flat - no fade (AUDIT
//   30 A10: the record said one) - and DFU's own Logs flat lies at
//   its foot where the archive has one, gone when walked over - a sight:
//   the logs were the Stores' the moment the service answered (law 3).
//   THE ACT. Foraging's checks with the Wood-Axe's lines; the machine is
//   systems/chopAct.js; the Wood-Axe draws DFU's War Axe in the hand.
// ═══════════════════════════════════════════════════════════════════
import { trees, nodeKey, WOOD_TABLES } from '../net/nodeLaw.js';
import { FELLED } from '../ai/cover.js';   // AUDIT TACT B1: a felled tree is no cover
import { tierOpen, TIER_RANKS, woodAxeBand, chopsFor, storesFullIn, fullWordsIn, GROUND_WHERE, GROUND_WHERE_WORDS } from '../net/professionLaw.js';
import { createChopAct } from '../systems/chopAct.js';
import { FT } from '../systems/foragingLaw.js';
import { foragingActRefusal, foragingToolIn, actChecksRefusal } from '../systems/foragingInstall.js';
import { materialLabel } from '../systems/profItems.js';
import { liveStat } from '../systems/statMods.js';
import { getPref } from '../systems/uiPrefs.js';
import { TERRAIN_SIZE } from '../world/terrainSampler.js';
import { insideRocks, TREE_RECORDS, isTreeRecord, FOREST } from '../world/terrainNature.js';   // NODE-CLEAR: the rock check's one home; FOREST1: and the Tree records', and what the woods are

/** World of Daggerfall's Tree records (FOREST1: their home is world/terrainNature.js, where the forests read them). */
export { TREE_RECORDS, isTreeRecord };
/** The stump a felled tree leaves: the archive's Tree Trunk (record 19) where the table names one; the logs at its foot
 *  the archive's Logs (record 31) where it has them. */
export const STUMP_RECORD = 19;
export const STUMP_ARCHIVES = Object.freeze([504, 506, 508, 510]);
export const LOGS_RECORD = 31;
export const LOGS_ARCHIVES = Object.freeze([504, 508]);
/** The fall: its length (s), the angle it ends at (radians - flat on the ground), how near the logs are taken (m). */
export const FALL_S = 1.5;
export const FALL_ANGLE = Math.PI / 2;
export const LOGS_TAKE_M = 1.5;
/** Where a tree is struck: the trunk, this high above its root. */
export const TRUNK_LIFT = 1.2;
/** NODE-MARKS: a tree's glow about its root (m) - up its trunk, not its crown. */
export const TREE_MARK = Object.freeze({ w: 2.6, h: 3.4 });
/** The Wood-Axe in the hand (FORAGE0 14.1): DFU's own War Axe, its chop StrikeDownRight's frames. */
export const AXE_HAND = Object.freeze({ group: 'Weapons', templateIndex: 128, material: 0 });
const CHOP_FRAMES = 5;
/** The hand's frame for a swing's phase (1 just struck, 0 none) - Idle between chops. */
export const axeHandFrame = (swing) => (swing > 0 ? { state: 'StrikeDownRight', frame: Math.min(CHOP_FRAMES - 1, Math.floor((1 - swing) * CHOP_FRAMES)) } : { state: 'Idle', frame: 0 });

/**
 * A PIXEL'S TREES AS THE CLIENT STANDS THEM: the law's trees of the day, each at the unclaimed forest tree flat nearest
 * its law point - `{ key, what: 'tree', slot, tier, material, rare, flat, local, lift }`, `local` pixel-local metres,
 * `flat` the forest flat it is (`{ id, group, i, x, y, z }`). A pixel whose forest holds no tree flat stands none.
 * NODE-CLEAR (AUDIT 2026-10-01 part four): never a flat inside a rock piece (`rocks`, the pixel's) - the next outside.
 * FOREST1 (AUDIT FOREST1 F3): under Real forests a flat carries how wooded its tile is (`wood`), and the day's trees
 * stand at the woods' own (FOREST.woods and over) wherever the pixel has any - the plains' lone trees stand only where
 * a pixel has no wood at all. DFU's scatter carries no `wood`, and every flat of it is the nearest's to take.
 * @param {{ px: number, py: number, day: number, climate: number, confirmed?: boolean,
 *   forest?: { trees: Array<{ id: number, group: string, i: number, x: number, y: number, z: number, wood?: number }> }|null,
 *   rocks?: number[][] }} p
 */
export function standTrees({ px, py, day, climate, confirmed = false, forest = null, rocks = [] }) {
  const out = [];
  const all = forest?.trees ?? [];
  if (!WOOD_TABLES[climate] || !all.length) return out;
  const woods = all.filter((f) => (f.wood ?? 0) >= FOREST.woods);   // FOREST1 (F3)
  const flats = woods.length ? woods : all;
  const claimed = new Set();
  for (const t of trees({ x: px, y: py, day, climate, confirmed })) {
    const lx = t.u * TERRAIN_SIZE, lz = t.v * TERRAIN_SIZE;
    let best = null, bestD = Infinity;
    for (const f of flats) {
      if (claimed.has(f.id) || insideRocks(rocks, f.x, f.z)) continue;   // NODE-CLEAR (AUDIT 2026-10-01 part four): never a tree inside a rock piece, where no look reaches it
      const d = (f.x - lx) ** 2 + (f.z - lz) ** 2;
      if (d < bestD) { bestD = d; best = f; }
    }
    if (!best) break;
    claimed.add(best.id);
    out.push({
      key: nodeKey({ kind: 'tree', x: px, y: py, day, slot: t.slot }), what: 'tree', slot: t.slot, tier: t.tier, material: t.material,
      rare: t.rare, flat: best, local: [best.x, best.y, best.z], lift: TRUNK_LIFT,
    });
  }
  return out;
}

/** LPT1 (bible/07-Rendering/Low-Poly-Trees.md): counts every sinking and standing of a wood's flats, so the near set of
 *  3D trees (systems/lowPolyTreesAssets.js `frame`'s `stamp`) is gathered again the frame a tree goes or comes back. */
export const FOREST_STAMP = { n: 0 };

/**
 * THE FELLED TREES SUNK: each forest group's flats rewritten in place, the felled ones' below the ground by their height
 * and a metre, the rest where they grew - so a day's turn stands yesterday's felled trees again.
 * @param {{ groups: Map<string, { batch: any, centers: number[][], size: { w: number, h: number }, sunkN?: number }> }} forest
 * @param {Set<string>} sunk `${group}#${i}` of every flat felled
 * @param {{ moveBillboardBatch: (b: any, c: number[][]) => boolean }} renderer
 */
export function sinkFelled(forest, sunk, renderer) {
  for (const [gk, g] of forest.groups) {
    if (!g.batch) continue;
    const had = g.sunkN ?? 0;
    let n = 0;
    const centers = g.centers.map((c, i) => {
      const felled = sunk.has(`${gk}#${i}`);
      if (felled) FELLED.add(c); else FELLED.delete(c);   // AUDIT TACT B1: the tree's cover (ai/cover.js) - a felled one is no cover, a regrown one is
      if (!felled) return c;
      n++;
      return [c[0], c[1] - g.size.h - 1, c[2]];
    });
    if (n === 0 && had === 0) continue;   // nothing felled here, then or now: the batch as it was built
    renderer.moveBillboardBatch(g.batch, centers);
    g.sunkN = n;
    FOREST_STAMP.n++;   // LPT1: a tree felled or stood again - the near 3D trees are gathered anew
  }
}

/** A tree's plan: what E does at it, or what it needs (a rank short: the rank, `needsRank` - VEIN-NEED). CAP-OFF: no day's
 *  cap - a tree is felled once a character a day, and that is the whole of the day's bound. */
export function treePlan({ node, taken, counting, rank, axe, storesFull, lumberjack = false, fullWords = 'Stores full' }) {   // BAG1: `fullWords` the book's
  const name = materialLabel(node.material).replace(/ Log$/, '');
  const verb = `Chop ${name}`;
  const rankWord = `Logging ${rank} - ${chopsFor(node.tier, lumberjack)} chops`;   // AUDIT 30 A8: a Lumberjack's two fewer, as the act counts them
  if (taken || counting) return { harvest: 'logs', verb, rest: 'felled today', ready: false };
  if (!tierOpen(rank, node.tier)) return { harvest: 'logs', verb, rest: `needs Logging ${TIER_RANKS[node.tier - 1]}`, ready: false, needsRank: TIER_RANKS[node.tier - 1] };
  if (!axe) return { harvest: 'logs', verb, rest: 'needs a Wood-Axe', ready: false };
  if (storesFull(node.material)) return { harvest: 'logs', verb, rest: `${fullWords} - ${materialLabel(node.material)}`, ready: false };
  return { harvest: 'logs', verb, rest: rankWord, ready: true };
}

/**
 * LOGGING'S KIND in the gathering host: the trees, their stumps, the plan, the act, the fall.
 * @param {{ book: any, renderer?: any, flatBatchAabb?: (c: number[][], s: any) => number[],
 *   getTexture?: (a: number) => Promise<any>, billboardSize?: (t: any, r: number) => { w: number, h: number },
 *   uploadRecord?: (a: number, r: number) => void }} deps
 * @returns {import('./gatherHost.js').GatherKind}
 */
export function treeKind({ book, renderer = null, flatBatchAabb = null, getTexture = null, billboardSize = null, uploadRecord = null }) {
  /** the falls under way and the logs lying: `{ entry, batch, t, logs? }` */
  const falls = [];
  const logsLying = [];
  /** AUDIT 30 A11: the pixels torn down - a fall's logs whose texture came after its pixel went are never laid (an
   *  entry's batch list outlives it, so it could not say so). */
  const torn = new WeakSet();
  const drop = (entry, b) => {
    const i = entry.batches.indexOf(b);
    if (i >= 0) entry.batches.splice(i, 1);
    renderer?.destroyBatch(b);
  };
  return {
    id: 'tree',
    professions: Object.freeze(['logging']),
    nodesOf({ px, py, day, info, confirmed, entry, near }) {
      return standTrees({ px, py, day, climate: info.climate, confirmed, forest: entry.forest ?? null, rocks: [...(entry.rocks ?? []), ...(near ?? [])] });   // NODE-CLEAR; ROCK-NEAR
    },
    /** A standing tree is the forest's own flat: the node adds none. */
    flatsOf: () => [],
    /** A felled tree's stump, where the archive has one. */
    goneFlatsOf(n, entry) {
      const f = entry?.forest;
      if (!f) return [];
      const base = n.flat?.base ?? f.base, archive = n.flat?.archive ?? f.archive;   // ECOTONE1: a border tree's own climate's stump
      if (!STUMP_ARCHIVES.includes(base)) return [];
      return [{ archive, record: STUMP_RECORD, scale: 1, centers: [n.local] }];
    },
    /** The pixel's felled trees sunk in their batches (and yesterday's stood again). */
    stood(entry, nodes) {
      const f = entry?.forest;
      if (!f?.groups || !renderer) return;
      const sunk = new Set(nodes.filter((n) => book.taken(n.key, 'logs')).map((n) => `${n.flat.group}#${n.flat.i}`));
      sinkFelled(f, sunk, renderer);
    },
    gone: (n) => book.taken(n.key, 'logs'),
    mark: (n) => (book.taken(n.key, 'logs') ? null : TREE_MARK),   // NODE-MARKS: a standing tree; a felled one's stump none
    tools: Object.freeze([FT.WoodAxe]),   // TOOL-USE: the Wood-Axe's Use at a tree is E there
    where: () => actChecksRefusal(GROUND_WHERE, GROUND_WHERE_WORDS),   // SETTLE-SAID
    /** PROF-MENU: the menu's title - the tree its wood is. */
    nodeName: (n) => `${materialLabel(n.material).replace(/ Log$/, '')} Tree`,
    plan(n, { entity, rank, specs }) {
      const plan = treePlan({
        node: n, taken: book.taken(n.key, 'logs'), counting: book.counting(n.key, 'logs'), rank: rank('logging'),
        lumberjack: specs?.('logging')?.[50] === 'lumberjack',
        axe: !!foragingToolIn(entity, FT.WoodAxe), storesFull: (key) => storesFullIn(book, key), fullWords: fullWordsIn(book),   // STORES-ROOM: every origin, as the service counts
      });
      return { ...plan, profession: 'logging' };
    },
    start(n, plan, { entity, rank, specs }) {
      const refusal = foragingActRefusal(FT.WoodAxe);
      if (refusal) return { refused: refusal };
      return {
        act: createChopAct({
          tier: n.tier, rank: rank('logging'), lumberjack: specs('logging')[50] === 'lumberjack',
          band: woodAxeBand({ intelligence: liveStat(entity, 'intelligence'), strength: liveStat(entity, 'strength') }),
          gentle: getPref('gentleActs') === true,
        }),
        harvest: plan.harvest, tool: foragingToolIn(entity, FT.WoodAxe), profession: 'logging', label: '',
        material: n.material,   // AUDIT BAG1 B4: the logs the tree is, for the held count
        hand: (a) => (a.tool ? { ...AXE_HAND, ...axeHandFrame(a.act.swing) } : null),
      };
    },
    /** THE FALL, on the service's answer: the tree's own picture tips away from the player (`from`, world; `tr` the
     *  pixel's translation) and is gone once flat; the logs lie at its foot. */
    async felled(n, { entry, from, tr }) {
      const f = entry?.forest;
      const g = f?.groups?.get(n.flat.group);
      if (!renderer || !g?.batch || !entry || torn.has(entry)) return;
      const c = g.centers[n.flat.i];
      if (!c) return;   // AUDIT 30 A5: a flat its wood no longer has (the pixel stood again under the ask)
      let dx = c[0] + tr[0] - from[0], dz = c[2] + tr[2] - from[2];
      const l = Math.hypot(dx, dz);
      if (l < 1e-6) { dx = 0; dz = 1; } else { dx /= l; dz /= l; }
      const b = renderer.createBillboardBatch(g.batch.archive, g.batch.record, g.size, [c], g.scales ? { scales: [g.scales[n.flat.i]] } : undefined);   // LPT1: a low-poly tree falls as its far picture, at its own size
      const reach = Math.max(g.size.w, g.size.h);
      b._box = [c[0] - reach, c[1] - 1, c[2] - reach, c[0] + reach, c[1] + g.size.h, c[2] + reach];
      b.noShadow = true;
      b.tip = [dx, dz, 0];
      entry.batches.push(b);
      falls.push({ entry, batch: b, t: 0 });
      if (LOGS_ARCHIVES.includes(f.base) && getTexture && billboardSize) {
        const t = await getTexture(f.archive);
        if (!t || LOGS_RECORD >= t.recordCount || torn.has(entry)) return;
        uploadRecord?.(f.archive, LOGS_RECORD);
        const size = billboardSize(t, LOGS_RECORD);
        const at = [c[0] + dx * 0.8, c[1], c[2] + dz * 0.8];
        const logs = renderer.createBillboardBatch(f.archive, LOGS_RECORD, size, [at]);
        logs._box = flatBatchAabb ? flatBatchAabb([at], size) : [at[0] - size.w, at[1], at[2] - size.w, at[0] + size.w, at[1] + size.h, at[2] + size.w];
        entry.batches.push(logs);
        logsLying.push({ entry, batch: logs, at });
      }
    },
    /** Every frame: the falls tip, each gone once it lies flat; the logs are taken when walked over. */
    frame(dt, { feet, translation }) {
      for (let i = falls.length - 1; i >= 0; i--) {
        const fl = falls[i];
        fl.t += dt;
        const k = Math.min(1, fl.t / FALL_S);
        fl.batch.tip[2] = FALL_ANGLE * k * k;   // it goes slowly, then all at once
        if (k >= 1) { drop(fl.entry, fl.batch); falls.splice(i, 1); }
      }
      for (let i = logsLying.length - 1; i >= 0; i--) {
        const lg = logsLying[i];
        const tr = translation(lg.entry);
        if (!tr) { logsLying.splice(i, 1); continue; }
        if (Math.hypot(lg.at[0] + tr[0] - feet[0], lg.at[2] + tr[2] - feet[2]) <= LOGS_TAKE_M) { drop(lg.entry, lg.batch); logsLying.splice(i, 1); }
      }
    },
    /** A pixel torn down: its falls and logs went with its batches. */
    dropped(entry) {
      torn.add(entry);
      for (let i = falls.length - 1; i >= 0; i--) if (falls[i].entry === entry) falls.splice(i, 1);
      for (let i = logsLying.length - 1; i >= 0; i--) if (logsLying[i].entry === entry) logsLying.splice(i, 1);
    },
    cleanNote: () => ' (every chop a Clean Cut)',
    title: () => 'Woodcutter',
  };
}
