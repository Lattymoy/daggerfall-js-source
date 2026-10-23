// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF4 (2026-09-28, Mac: "Continue") - LOGGING IN THE STREAMING WORLD
// (bible/06-Systems/Professions-Arc.md 4.2, 5.2, 6, 25): Logging's KIND
// in the one gathering host (scenes/gatherHost.js).
//
//   THE TREES ARE THE FOREST'S. A built pixel keeps its tree flats -
//   Daggerfall's own nature flats (world/terrain/terrainNature.js, one seeded
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
import { tierOpen, TIER_RANKS, woodAxeBand, chopsFor, storesFullIn, goneIn, fullWordsIn, GROUND_WHERE, GROUND_WHERE_WORDS } from '../net/professionLaw.js';
import { createChopAct } from '../systems/chopAct.js';
import { FT } from '../systems/foraging/foragingLaw.js';
import { foragingActRefusal, foragingToolIn, actChecksRefusal } from '../systems/foraging/foragingInstall.js';
import { materialLabel } from '../systems/professions/profItems.js';
import { liveStat } from '../systems/statMods.js';
import { getPref } from '../systems/uiPrefs.js';
import { TERRAIN_SIZE } from '../world/terrain/terrainSampler.js';
import { JUNGLE_MEASURES, FOOT_TOP } from '../world/jungle/jungleModels.js';   // AUDIT BANTHA1 TREE-3: a jungle tree's mark
import { insideRocks, TREE_RECORDS, isTreeRecord, FOREST } from '../world/terrain/terrainNature.js';   // NODE-CLEAR: the rock check's one home; FOREST1: and the Tree records', and what the woods are
import { noteAct } from '../systems/questlines/qlActs.js';   // QL11: the features' acts, heard by the running quests

/** World of Daggerfall's Tree records (FOREST1: their home is world/terrain/terrainNature.js, where the forests read them). */
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
/** AUDIT BANTHA1 TREE-3: A JUNGLE TREE'S MARK stands outside what the tree draws about its root - its trunk at its scale,
 *  and where its crown hangs to the ground (the banyan's roots, the flame tree's curtains) its foot - and this much more
 *  (m): the mark's 0.6 m (render/nodeGlow.js NODE_GLOW_PULL) stood it inside a jungle trunk, 90-100% of it hidden. */
export const JUNGLE_MARK_CLEAR = 0.6;
const _jungleMarks = new Map();
/** A jungle tree's mark (made once a species and scale). @param {{ jungle: number, js: number }} flat */
export function jungleTreeMark(flat) {
  const key = flat.jungle * 1000 + Math.round(flat.js * 100);
  let m = _jungleMarks.get(key);
  if (!m) {
    const t = JUNGLE_MEASURES[flat.jungle], hung = t.crownFrom <= FOOT_TOP;
    m = Object.freeze({ w: TREE_MARK.w, h: TREE_MARK.h, pull: (hung ? t.foot : t.trunk) * flat.js + JUNGLE_MARK_CLEAR });
    _jungleMarks.set(key, m);
  }
  return m;
}
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
  // NODE-CLEAR (AUDIT 2026-10-01 part four): never a tree inside a rock piece, where no look reaches it - asked once a
  // flat, not once a flat a tree (JUNGLE-WOODS: the jungle's 48 trees a day over its ~5,400 tree flats)
  const flats = (woods.length ? woods : all).filter((f) => !insideRocks(rocks, f.x, f.z));
  const claimed = new Set();
  for (const t of trees({ x: px, y: py, day, climate, confirmed })) {
    const lx = t.u * TERRAIN_SIZE, lz = t.v * TERRAIN_SIZE;
    let best = null, bestD = Infinity;
    for (const f of flats) {
      if (claimed.has(f.id)) continue;
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
  /** the falls under way and the logs lying: `{ entry, batch, t, key }` - AUDIT GATHER-SPEED G2: each its node's key */
  const falls = [];
  const logsLying = [];
  /** AUDIT GATHER-SPEED G2: the keys a refusal took a fall back from before its logs were laid - they never lie */
  const unlaid = new Set();
  /** AUDIT 30 A11: the pixels torn down - a fall's logs whose texture came after its pixel went are never laid (an
   *  entry's batch list outlives it, so it could not say so). */
  const torn = new WeakSet();
  /** NODE-OUTLINE: each tree's pictures, made once a batch it stands in (none made a frame) */
  const pictured = new WeakMap();
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
    /** @param {any} entry @param {any[]} nodes @param {(key: string) => boolean} [landing] */
    stood(entry, nodes, landing = () => false) {
      const f = entry?.forest;
      if (!f?.groups || !renderer) return;
      // GATHER-SPEED: or being counted - AUDIT GATHER-FEEL F1: never a tree whose felling chop is still in the air (the
      // gathering host's `landing`): it falls as that chop lands, whatever stands its pixel again meanwhile
      const sunk = new Set(nodes.filter((n) => goneIn(book, n.key, 'logs') && !landing(n.key)).map((n) => `${n.flat.group}#${n.flat.i}`));
      sinkFelled(f, sunk, renderer);
    },
    gone: (n) => goneIn(book, n.key, 'logs'),
    goneSound: 'fall',   // GATHER-FEEL: the tree heard coming down, its ground struck as the picture lies flat (FALL_S)
    mark: (n) => (goneIn(book, n.key, 'logs') ? null : n.flat?.jungle != null ? jungleTreeMark(n.flat) : TREE_MARK),   // NODE-MARKS: a standing tree; a felled one's stump none; AUDIT BANTHA1 TREE-3: a jungle tree's outside its trunk
    /** NODE-OUTLINE (render/nodeGlint.js): a standing tree's picture is its forest's own flat - and near the eye the 3D
     *  tree that stands for it, found by the flat's centre (the very array its pixel's tree set holds). */
    picturesOf(n, entry) {
      const g = entry?.forest?.groups?.get(n.flat?.group);
      const c = g?.centers?.[n.flat.i];
      if (!g?.batch || !c) return null;
      let p = pictured.get(n);
      if (!p || p[0].batch !== g.batch || p[0].center !== c) pictured.set(n, (p = [{ batch: g.batch, first: n.flat.i, count: 1, centers: [c], center: c, entry }]));
      return p;
    },
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
    /** THE FALL, as the act ends (GATHER-SPEED - it waited on the service's answer; scenes/gatherHost.js fallNow): the
     *  tree's own picture tips away from the player (`from`, world; `tr` the pixel's translation) and is gone once flat;
     *  the logs lie at its foot. */
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
      falls.push({ entry, batch: b, t: 0, key: n.key });
      if (LOGS_ARCHIVES.includes(f.base) && getTexture && billboardSize) {
        const t = await getTexture(f.archive);
        if (!t || LOGS_RECORD >= t.recordCount || torn.has(entry)) return;
        uploadRecord?.(f.archive, LOGS_RECORD);
        const size = billboardSize(t, LOGS_RECORD);
        const at = [c[0] + dx * 0.8, c[1], c[2] + dz * 0.8];
        const logs = renderer.createBillboardBatch(f.archive, LOGS_RECORD, size, [at]);
        logs._box = flatBatchAabb ? flatBatchAabb([at], size) : [at[0] - size.w, at[1], at[2] - size.w, at[0] + size.w, at[1] + size.h, at[2] + size.w];
        entry.batches.push(logs);
        if (unlaid.delete(n.key)) { drop(entry, logs); return; }   // AUDIT GATHER-SPEED G2: refused while its texture came
        logsLying.push({ entry, batch: logs, at, key: n.key });
      }
    },
    /** Every frame: the falls tip, each gone once it lies flat; the logs are taken when walked over - GATHER-FEEL: and
     *  heard gathered up (`say`, the host's ear). */
    frame(dt, { feet, translation, say = null }) {
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
        if (Math.hypot(lg.at[0] + tr[0] - feet[0], lg.at[2] + tr[2] - feet[2]) <= LOGS_TAKE_M) { drop(lg.entry, lg.batch); logsLying.splice(i, 1); say?.('logs'); }
      }
    },
    /** AUDIT GATHER-SPEED G2: A FELL REFUSED - the fall is the act's end's now (scenes/gatherHost.js fallNow), so a
     *  harvest the service refuses, or a kept one let go, stands its tree again: its falling picture and its logs go
     *  with it, never a tree standing over its own fall. */
    refused(key) {
      if (typeof key !== 'string') return;
      let fell = false, laid = false;
      for (let i = falls.length - 1; i >= 0; i--) if (falls[i].key === key) { drop(falls[i].entry, falls[i].batch); falls.splice(i, 1); fell = true; }
      for (let i = logsLying.length - 1; i >= 0; i--) if (logsLying[i].key === key) { drop(logsLying[i].entry, logsLying[i].batch); logsLying.splice(i, 1); laid = true; }
      if (fell && !laid) unlaid.add(key);   // its logs' texture still under way: laid, they go at once
    },
    /** A pixel torn down: its falls and logs went with its batches. */
    dropped(entry) {
      torn.add(entry);
      for (let i = falls.length - 1; i >= 0; i--) if (falls[i].entry === entry) falls.splice(i, 1);
      for (let i = logsLying.length - 1; i >= 0; i--) if (logsLying[i].entry === entry) logsLying.splice(i, 1);
    },
    cleanNote: () => ' (every chop a Clean Cut)',
    /** QL11: a tree's logs the service answered (the host's one answer to a harvest: the act's own, or a kept one's). */
    answered() { noteAct('wood-chopped'); },   // QL11: wood chopped
    title: () => 'Woodcutter',
  };
}
