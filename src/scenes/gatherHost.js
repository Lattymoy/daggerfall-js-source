// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF2 (2026-09-28, Mac: "Go") - THE GATHERING PROFESSIONS IN THE
// STREAMING WORLD, one shell for every kind of node (bible/06-Systems/
// Professions-Arc.md 5, 6, 8, 22, 23; FORAGE0 14). PROF1 built it as
// Herbalism's own host; every gathering profession needs the same shell,
// so the shell is this, and each profession is a KIND in it - PROF1's
// patches (scenes/herbHost.js herbKind), PROF2's veins and boulders
// (scenes/mineHost.js mineKind), PROF4's trees (scenes/treeHost.js
// treeKind), PROF7's bodies (scenes/huntHost.js huntKind - LOOSE nodes,
// each its own place) and PROF8's casts (scenes/fishHost.js fishKind - a
// loose node ahead of the look while the net stands in its water, and the
// day's schools as flats). One prompt, one act, one book. (AUDIT 32 R9:
// this said the trees and the bodies were to come.)
//
//   THE NODES. Each built wilderness pixel stands its day's nodes of every
//   kind (net/nodeLaw.js - the clock's, the same for every client), each
//   kind saying where it stands and what pictures it draws. The batches
//   are the pixel's own - appended to its list, so its frame walk draws
//   them and destroyPixel frees them (EVERY ALLOCATION HAS AN OWNER) - and
//   stood again at the UTC day's turn, when the service says a pixel's
//   state, or when a node is taken whole (gone for the day, PROF0 5.3).
//   THE TARGET. The node in reach nearest the look, of any kind.
//   THE MENU (PROF-MENU, 2026-10-01, Mac: "They should use the same menu
//   the loot menu uses and not an interaction button"). The target is the
//   loot plaque's own list under the crosshair (ui/worldPlaque.js
//   'actions'): the node named, its acts the rows - a patch's herbs and
//   its Basket, a body's knife and its search - a refused one with its
//   reason; the wheel or the d-pad lights one, E or the click presses it.
//   Where no plaque stands (a phone, the classic skins) the prompt says
//   the choice and E opens it as a list (`choose`), the boat menu's way.
//   The act choice key's toggle and the "[E] verb  [Up] the Basket"
//   prompt it served are gone: the key steps the list's light instead,
//   wrapping, the keyboard's wheel.
//   THE ACT. The row's press starts it (the kind's checks - Foraging's
//   first, FORAGE0 14.3); the frame plays it (the kind's machine: systems/herbAct.js,
//   systems/mineAct.js); Escape, or walking off, ends it with nothing
//   lost; its end wears the tool and asks the service (net/profBook.js -
//   kept and asked again until answered). The answer is said in the
//   toasts, the rank's rise in the banner. A node that cannot be worked
//   passes E on to the door, the chest or the foe (AUDIT 29 C1), and
//   when the press opened nothing else the host hands it back: the node
//   says what it needs (VEIN-NEED, sayNeed).
//   THE TOOL'S USE (TOOL-USE). The Wood-Axe, the Pick-Axe, the Sickle,
//   the Basket and the Fishing-Net used from the hotbar or a quick slot
//   are E at a node of their own kind (useTool) - the act, or its need.
//   THE MARKS (NODE-MARKS). Every node standing near the player - a
//   patch, a vein, a boulder, a tree, a school, a body - on the compass
//   in its profession's colour and lit in the world by its glow (marks:
//   the kind's own word on each, its footprint and its reach).
//
// One owner: the host builds it online, and disposes it with the page.
// ═══════════════════════════════════════════════════════════════════
import { utcDayOfMs, pixelKey, parseNodeKey } from '../net/nodeLaw.js';
import { TERRAIN_SIZE } from '../world/terrainSampler.js';
/** A map pixel's side in the scene (metres). */
const PIXEL_M = TERRAIN_SIZE;
import { rankName, professionName, HARVESTS_PER_ACCOUNT_DAY, DEEP_UNCONFIRMED_PER_DAY } from '../net/professionLaw.js';
import { wearForagingTool } from '../systems/foragingInstall.js';
import { materialCountLabel } from '../systems/profItems.js';
import { accountRefusalText } from '../net/accountClient.js';
import { DEFAULT_ACTIVATION_DISTANCE } from '../player/activate.js';
import { harvestHauls } from '../ui/haulCards.js';   // HAUL-CARDS: a harvest's goods and XP as one card, on the enhanced skin
import { BAG_WORDS, goodsWhere } from '../net/bagLaw.js';   // BAG1: where the goods went
import { nodeMarkCss } from '../ui/nodeMarks.js';   // GATHER-OW: a group's glyph in its profession's compass colour

/** A node answers E within DFU's activation distance, and within this many degrees of the look. */
export const NODE_REACH = DEFAULT_ACTIVATION_DISTANCE;
/** AUDIT 29 C1: 12 degrees - a node near the crosshair, not a quarter of the view (25 took E from a door beside it). */
export const NODE_AIM_DEG = 12;
/** The ranks a banner marks (PROF0 8). */
export const BANNER_RANKS = Object.freeze([25, 50, 75, 100]);
/** CAST-E: a press the cast passed on is handed back within this long (ms) - the ladder's door check, a frame or two -
 *  or never: a press a door, the crew or a chest took leaves no cast for a later E. */
export const CAST_HANDBACK_MS = 1000;
/** The day's chip stays this long after an act or a look (s). */
const CHIP_S = 6;
/** NODE-MARKS: the compass marks every standing node within this many metres of the player (a kind's `reach` past it -
 *  a Prospector's veins, PROF0 3.3), and the glow lights the same; the nearest NODE_MARK_MAX of them, at most. */
export const NODE_MARK_M = 150;
export const NODE_MARK_MAX = 16;
/** NODE-MARKS: a node's glow footprint about its base where its kind names none - metres across (`w`) and up (`h`). */
export const NODE_MARK_SIZE = Object.freeze({ w: 1.8, h: 1.3 });
/** GATHER-OW (2026-10-02, Mac: "allow them to appear in the overworld without being overwhelming, maybe a glyph marker
 *  showing where a group of them are"): the Overworld marks each profession's group on a stood pixel - its nodes not
 *  yet worked today - within this many metres of the player, the nearest GROUP_MAX of them, the list read again at most
 *  every GROUP_REFRESH_MS. */
export const GROUP_M = 3000;
export const GROUP_MAX = 12;
export const GROUP_REFRESH_MS = 500;
/** GATHER-OW: a group's mark this far over its nodes' middle (m). */
export const GROUP_LIFT_M = 2;
/** GATHER-OW: a group's words - the profession and its count today. */
export const groupLabel = (profession, n) => `${professionName(profession)} \u00d7${n}`;
/** HERB-CURSOR (FIELD BUGS 2026-10-02 part four, "Doesn't make mouse appear when the minigame starts, so cant click on
 *  the targets"): WHAT AN ACT NEEDS OF THE MOUSE, by its machine's kind. The Basket's glints stand about the crosshair,
 *  where no look reaches them (the look turns the view, and they turn with it): its act holds the cursor free. A vein's
 *  points, a body's line and the net's throw (the school its release lands in - AUDIT C1) are aimed by the look itself:
 *  a cursor the player freed is taken back for them. The rest - the ring, the hand and the steady hold - need neither,
 *  and leave the mouse as it is. */
export const ACT_POINTER = Object.freeze({ basket: 'cursor', mine: 'look', trace: 'look', fish: 'look' });
/** AUDIT HERB-CURSOR C2: what an act's state needs (ACT_POINTER), or null. An act played gently (the Gentle acts
 *  setting) has no moment - its Basket finds nothing to click, its vein's glint and its body's line are not read - so it
 *  needs nothing; the net's gentle throw still lands where the look sends it (its state carries no `gentle`, and is
 *  named here so it never will by accident). */
export const actPointer = (st) => (st?.gentle === true && st.kind !== 'fish' ? null : ACT_POINTER[st?.kind] ?? null);
/** NODE-MARKS: the stood pixels walked for the marks - those within this many metres, past any kind's reach. */
const MARK_WALK_M = 256;
/** AUDIT NODE-MARKS (the independent pass): a place is any three numbers - the player's feet are the motor's
 *  Float32Array (player/motor.js), which `Array.isArray` refuses, and every mark was refused with them. */
const isVec3 = (v) => v != null && typeof v === 'object' && v.length >= 3;

/**
 * VEIN-NEED (FIELD BUGS 2026-09-29h): WHAT E SAYS AT A NODE THAT CANNOT BE WORKED, when the press opened nothing else -
 * the prompt's own words, and where a rank is what is short (the kind's `needsRank`), the player's own rank beside it:
 * "Mine Silver: needs Mining 25 - your Mining is 0". Nothing for a plan that is ready, or one whose prompt already says
 * all there is (a node worked today).
 * @param {any} plan the kind's plan, its `profession` on it @param {(profession: string) => number} rankOf
 */
export function needLine(plan, rankOf) {
  if (!plan || plan.ready || !plan.rest) return '';
  if (plan.rest === 'being counted') return 'That gathering is being counted.';
  const own = Number.isSafeInteger(plan.needsRank) ? ` - your ${professionName(plan.profession)} is ${rankOf(plan.profession)}` : '';
  return `${plan.verb}: ${plan.rest}${own}`;
}

/**
 * GATHER-SAID (the PROF7 merge, 2026-09-30, Mac: "had reports of people not getting materials when using a profession"):
 * A HARVEST'S GOODS IN ONE LINE - the Stores' own, a gem (PROF2) and a second find (PROF4's Resin, PROF7's butchery) beside
 * them: "+1 Bear Hide, a Big Tooth and 2 Raw Meat to your Stores". Each was a line of its own, and with the XP and a rank's
 * rise an answer said five into the four the toasts hold (PROF0 8) - the Stores' line, the oldest, went first.
 * @param {{ qty: number, material: string, gem?: string|null, extra?: string|null, extraQty?: number }} d the answer's data
 */
export function storesLine(d) {
  const goods = [`${d.qty} ${materialCountLabel(d.material, d.qty)}`];
  if (d.gem) { const g = materialCountLabel(d.gem, 1); goods.push(`${/^[aeiou]/i.test(g) ? 'an' : 'a'} ${g}`); }
  if (d.extra) { const n = Number(d.extraQty) || 1; goods.push(`${n > 1 ? `${n} ` : ''}${materialCountLabel(d.extra, n)}`); }
  const said = goods.length > 1 ? `${goods.slice(0, -1).join(', ')} and ${goods[goods.length - 1]}` : goods[0];
  return `+${said} ${goodsWhere(d)}`;
}
/** AUDIT BAG1 B4: the material a kind's act names for its goods (`material`: a key, or one of the act's ground - a
 *  herb's is its region's), or null where the service rolls it (the Basket's food, a boulder's stone). */
export function actMaterial(a) {
  const m = typeof a?.material === 'function' ? a.material(a.info) : a?.material;
  return typeof m === 'string' && m ? m : null;
}
/** AUDIT BAG1 B9: what a carried harvest left where it was gathered, each material by its own name ("1 Ruby and 2 Oak
 *  Logs"); a `put` from before the audit, which names none, as the harvest's own. */
export function leftWords(d) {
  const lost = Array.isArray(d?.put?.lost) && d.put.lost.length ? d.put.lost : [{ key: d?.material, n: d?.put?.left | 0 }];
  const parts = lost.map((l) => `${l.n} ${materialCountLabel(l.key, l.n)}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
}

/** GATHER-SAID: where the Stores are, said with a session's first harvest - the goods are never in the pack.
 *  CLASSIC-PAGES: on either skin, by the Professions key the player has it bound to (`key`, its label; none bound, the
 *  pause menu's page). */
// AUDIT HOLDINGS C7: the Stores page is on the pause menu's Holdings tab now - the Professions key lands on the Stats
// tab's Professions page, and the line said it opened the Stores
export const storesWhereLine = (key, carrying = false) => (carrying ? BAG_WORDS.where   // BAG1: into the bag, then the pack
  : `Gathered goods go to your Stores, not your pack: the pause menu's Holdings > Stores${key ? ` (${key} opens your Professions)` : ''}.`);
/** GATHER-SAID: an act that ended before its end - let go, walked off, a window over it, the dungeon left - nothing asked. */
export const ACT_STOPPED_LINE = 'The gathering stopped before its end - nothing was taken.';
/** A harvest the service did not answer, kept and asked again (net/profBook.js PROF_QUEUE_MS: ten minutes). */
/** AUDIT PACK-OVER C: the over-weight line, said at most once in this long (ms). */
export const OVER_SAID_MS = 10_000;
export const KEPT_LINE = 'The counting-house is slow to answer. Your gathering is kept and will be counted.';
/** GATHER-SAID: kept because the account is signed out ('auth', 'no-session') - asked again once there is a session. */
export const KEPT_SIGNED_OUT_LINE = 'You are signed out. Your gathering is kept for ten minutes, and counted once you sign in.';
/** A kept harvest let go unanswered: its ten minutes out, or the UTC day turned under it. */
export const LAPSED_LINE = 'A gathering the counting-house never answered has lapsed - it was not counted.';

/** The shortest signed angle a - b, degrees in (-180, 180]. */
export const wrapDeg = (d) => { let x = d % 360; if (x > 180) x -= 360; if (x <= -180) x += 360; return x; };
/**
 * WHERE THE CROSSHAIR IS ON A NODE'S FACE: the view's bearing from the node's centre, degrees - `yaw` to the right
 * (the port's +yaw turns right, player/cameraRecoiler.js), `pitch` up.
 * @param {number[]} eyePos @param {number[]} at the node's centre, world @param {{ yaw: number, pitch: number }} view degrees
 */
export function aimAt(eyePos, at, view) {
  const dx = at[0] - eyePos[0], dy = at[1] - eyePos[1], dz = at[2] - eyePos[2];
  const yaw = (Math.atan2(dx, dz) * 180) / Math.PI;
  const pitch = (Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI;
  return { yaw: wrapDeg(view.yaw - yaw), pitch: view.pitch - pitch };
}

/**
 * @typedef {object} GatherKind One profession's nodes in the shell.
 * @property {string} id
 * @property {readonly string[]} professions the professions its nodes are worked under
 * @property {(ctx: any) => any[]} nodesOf a pixel's nodes today: `{ key, local: [x,y,z], lift?, ... }`
 * @property {(ctx: any) => any[]} [dungeonNodesOf] a dungeon's nodes today (PROF2's veins), in the dungeon's own space
 * @property {(node: any) => Array<{ archive: number, record: number, scale: number, centers: number[][] }>} flatsOf
 * @property {(node: any) => boolean} gone whether every harvest of the node is taken today
 * @property {(node: any, ctx: any) => any} plan what E does: `{ harvest, verb, rest, ready, both?, alt? }` - TOOL-USE:
 *   `ctx.tool` the template of a tool whose Use asks (the Sickle the herbs, the Basket the food), null for E
 * @property {(node: any, plan: any, ctx: any) => any} start the act: `{ act, harvest, tool, profession, label, hand?,
 *   heldByUse? }` or `{ refused: text }` - `heldByUse`, TOOL-USE: a Use started it, and the Use holds it (E's level unasked)
 * @property {readonly number[]} [tools] TOOL-USE: the Foraging tools whose Use (the hotbar's, a quick slot's) at this
 *   kind's node is E there
 * @property {(node: any, ctx: any) => any[]} [rows] PROF-MENU: the node's acts as the menu's rows, each a plan with its
 *   `id` - a patch's herbs and its food, a body's knife and its search; without it the one `plan`
 * @property {(node: any) => string} [nodeName] PROF-MENU: what the menu's title calls the node ('Red Rose', 'Wolf')
 * @property {(a: any, data: any) => string} cleanNote what a clean act is called in the XP toast
 * @property {(report: any) => string} [actNote] AUDIT 32 P10: what the act's report says in the XP toast, clean or not (a
 *   torn pelt, a true line drawn too quick) - the kind's own word, where cleanNote says only a clean act
 * @property {(profession: string) => string} title a rank's banner word ('Herbalist', 'Miner')
 * @property {(node: any, entry: any) => Array<{ archive: number, record: number, scale: number, centers: number[][] }>} [goneFlatsOf]
 *   PROF4: what a node gone for the day leaves standing (a felled tree's stump)
 * @property {(entry: any, nodes: any[]) => void} [stood] PROF4: a pixel's nodes of this kind stood (the felled trees sunk)
 * @property {(node: any, at: { entry: any, from: number[], tr: number[] }) => void} [felled] PROF4: a node taken on the
 *   service's answer, this session (the tree's fall)
 * @property {(dt: number, ctx: { feet: number[], translation: (entry: any) => number[]|null }) => void} [frame] PROF4: every frame
 * @property {(entry: any) => void} [dropped] PROF4: a pixel torn down
 * @property {(ctx: { entity: any, dungeon: boolean }) => any[]} [looseNodesOf] PROF7: nodes that carry their own place -
 *   `{ key, at: () => number[]|null, lift?, reach?, yields? }`, `at` the node's scene place now (Hunting's bodies), above
 *   ground or below; the start's `ask` rides the harvest (the body's foe). `yields` - CAST-LOOK: a node that stands
 *   wherever the look is (Fishing's cast) is the target only when no other node in the cone is seen
 * @property {() => { n: number, cap: number }} [tally] PROF7: the day's count the chip says, where it is not the
 *   character's harvests against 60 (Hunting's: the account's hides against 30)
 * @property {(data: any) => string} [storesLine] PROF8: the goods' one line in the kind's own words (a haul's species)
 * @property {(key: string, error: (string|null)) => void} [refused] AUDIT SILVER-WAYS D2: a harvest refused - the node's key
 *   and the service's word - so a kind learns what the refusal says of its node (REFUSALS-LEARNED)
 * @property {(data: any) => (string|null)} [haulName] HAUL-CARDS: the kind's own name for a harvest's goods on its card
 *   (PROF8's species - the material its sub), where the material's is not the word
 * @property {(data: any, toast: (text: string) => void, o?: { hauled?: boolean }) => void} [answered] PROF8: a harvest's answer heard - the kind's
 *   own after-step (a trophy into the pack, once)
 * @property {(node: any, ctx: { specs: (profession: string) => any }) => ({ w: number, h: number, reach?: number }|null)} [mark]
 *   NODE-MARKS: the node on the compass and in the glow - its footprint about its base (`w` across, `h` up, metres) and
 *   how far off the compass marks it (`reach`, NODE_MARK_M without one); null for a node never marked. Without it, a
 *   node is marked at NODE_MARK_SIZE while it is not gone for the day.
 * @property {(node: any) => (string|null)} [where] SETTLE-SAID: the act's check of the ground the node stands on, in the
 *   prompt's words (GROUND_WHERE_WORDS) - a ready plan there is no ready plan; null where it passes
 * @property {boolean} [marksLoose] NODE-MARKS: its loose nodes are walked for the marks (Hunting's bodies); without it
 *   they are never asked for there (Fishing's cast - the look itself, and its water's check is Foraging's whole world)
 */

/**
 * @param {{
 *   book: any, hud: any, kinds: GatherKind[],
 *   renderer: any, getTexture: (a: number) => Promise<any>, uploadRecord: (a: number, r: number) => void,
 *   billboardSize: (t: any, r: number) => { w: number, h: number }, flatBatchAabb: (c: number[][], s: any) => number[],
 *   built: () => Map<string, any>, pixelTranslation: (px: number, py: number, out: number[]) => number[],
 *   pixelInfo: (px: number, py: number) => ({ climate: number, region: number } | null),
 *   nowMs: () => number, eye: () => ({ pos: number[], dir: number[] }), view: () => ({ yaw: number, pitch: number }),
 *   feet: () => number[], entity: () => any, keyLabel: (a: string) => string,
 *   input: () => ({ held: boolean, attack: boolean, choice?: boolean }), active: () => boolean,
 *   activeDungeon?: () => boolean, onSettle?: () => void, clear?: (from: number[], to: number[], underground: boolean) => boolean,
 *   plaque?: () => boolean, lit?: (key: string) => any, choose?: (rows: string[], pick: (i: number) => void) => boolean,
 *   step?: (n: number) => boolean, settled?: (pos: number[]) => boolean,
 *   pointer?: (want: 'cursor'|'look') => ((() => void) | null), haul?: (entries: any[]) => boolean,
 * }} deps `active` - the streaming world's exterior, walking, nothing over it (the host's); `activeDungeon` - a dungeon
 *   entered, walking, nothing over it; `nowMs` the shared clock. PROF-MENU: `plaque` - the loot plaque stands (it names
 *   the node, so no prompt does); `lit(key)` - the row the plaque has lit over that key (quickLoot.js plaqueActionFor);
 *   `choose(rows, pick)` - the rows as a list, where no plaque stands (true when it opened); `step(n)` - the plaque's lit
 *   row moved n rows (quickLoot.js plaqueStep), the act choice key's. `settled` - SETTLE-STAND: whether a scene place is
 *   on a settlement's ground as the acts' check reads it (FORAGE0 14.3: the place's pixel's town, farm, temple, tavern or
 *   wealthy home, its footprint and a block round it), where no node of the ground (a kind with a `where`) stands.
 *   `pointer(want)` - HERB-CURSOR: the mouse an act needs (ACT_POINTER), asked as it starts; answers its release, called
 *   as it ends, or null
 */
export function createGatherHost(deps) {
  const { book, hud, kinds } = deps;
  const kindOf = (node) => kinds.find((k) => k.id === node.kind) ?? null;
  const kindOfProfession = (p) => kinds.find((k) => k.professions.includes(p)) ?? null;
  /** pixel key -> { entry, info, nodes, batches } */
  const stood = new Map();
  let day = utcDayOfMs(deps.nowMs());
  let target = null;          // { node, px, py, info, world }
  let act = null;             // { act, node, harvest, tool, profession, label, px, py, info, world, hand }
  let refreshAt = 0, pixelsAt = 0;
  let storesSaid = false;     // GATHER-SAID: storesWhereLine said this session
  let overSaidAt = -Infinity;   // AUDIT PACK-OVER C: when the over-weight line was last said
  let passedOn = '';          // VEIN-NEED: what the node the last press passed on needs, until the host hands it back
  let passedCast = null;      // CAST-E: the cast the last press passed on - played when the host hands the press back
  let passedCastAt = 0;       // CAST-E: when (the shared clock's ms) - a press the ladder took is never handed back
  let struck = null, strikeHeld = false;   // ACT-TOUCH: the act a finger's or a pad's press struck, for the next frame
  let clickHeld = false;      // CLICK-LIFT: the activation's button went down while an act played, and is not yet up
  let pointerAct = null, pointerOff = null;   // HERB-CURSOR: the act the mouse was last set for, and its release
  let standSpecs = undefined; // SEASONAL-EYE: the specs that change what stands, as the pixels were last stood
  let chipLeft = 0;
  let chipProfession = /** @type {string|null} */ (null);
  const _t = [0, 0, 0];
  /** PROF2: the dungeon the player stands in, as a place: its identity and ground, the wall its veins stand on, and its
   *  own doors for the flats (owned with the dungeon's batches). */
  let dungeon = null;
  const inDungeon = () => !!dungeon && !!deps.activeDungeon?.();
  const rank = (profession) => book.track(profession).rank;
  const specs = (profession) => book.track(profession).specs ?? { 50: null, 100: null };
  /** NODE-MARKS: the marks' one list and the records it is refilled from; what a kind's mark is asked with */
  const _marks = [], _markPool = [];
  let groupsAt = /** @type {number|null} */ (null), groupsKept = /** @type {any[]} */ ([]);   // GATHER-OW: the Overworld's groups, as last read - each its pixel and its node's place
  const markCtx = { specs };

  // ─── THE NODES ─────────────────────────────────────────────────────
  function unstand(entry) {
    const s = stood.get(`${entry.px},${entry.py}`);
    if (!s) return;
    for (const b of s.batches) {
      const i = entry.batches.indexOf(b);
      if (i >= 0) entry.batches.splice(i, 1);
      deps.renderer.destroyBatch(b);
    }
    s.batches = [];
  }
  async function stand(entry) {
    if (!entry?.samples || !entry.tilemap) return;
    const key = `${entry.px},${entry.py}`;
    unstand(entry);
    // AUDIT 30 A7: a pixel that stands no nodes - the switch shut, no ground to read, the witnesses' other word - stands
    // its forest whole: the day's turn under a shut switch left yesterday's felled tree sunk, and its herbs standing
    const bare = () => { for (const k of kinds) k.stood?.(entry, []); };
    const info = book.state.open === true ? deps.pixelInfo(entry.px, entry.py) : null;
    const rec = { entry, info, nodes: [], batches: [] };
    stood.set(key, rec);
    if (!info) { bare(); return; }
    const fact = book.pixel(entry.px, entry.py);
    const confirmed = fact?.state === 'confirmed' || fact?.state === 'disputed';
    // a pixel the witnesses confirmed as something else stands nothing: nothing here could be gathered
    if (confirmed && (fact.climate !== info.climate || fact.region !== info.region)) { bare(); return; }
    const ctx = { entry, px: entry.px, py: entry.py, day, info, confirmed, specs, book };
    rec.nodes = kinds.flatMap((k) => k.nodesOf(ctx).map((n) => ({ ...n, kind: k.id })));
    // SETTLE-STAND (FIELD BUGS 2026-10-01): a node of the ground on a settlement's ground is never worked there - its act
    // refuses it, and SETTLE-SAID's prompt said why - so it stands nowhere: no picture, no glow, no compass mark
    if (deps.settled) {
      const tr = deps.pixelTranslation(entry.px, entry.py, _t);
      rec.nodes = rec.nodes.filter((n) => !kindOf(n)?.where || !deps.settled([n.local[0] + tr[0], n.local[1] + tr[1], n.local[2] + tr[2]]));
    }
    for (const k of kinds) k.stood?.(entry, rec.nodes.filter((n) => n.kind === k.id));   // PROF4: the felled trees sunk
    /** archive -> `${record}:${scale}` -> centres */
    const groups = new Map();
    for (const n of rec.nodes) {
      const k = kindOf(n);
      if (!k) continue;
      // gone for the day: nothing, or what it leaves (PROF4: a felled tree's stump)
      for (const f of k.gone(n) ? (k.goneFlatsOf?.(n, entry) ?? []) : k.flatsOf(n)) {
        if (!groups.has(f.archive)) groups.set(f.archive, new Map());
        const g = groups.get(f.archive);
        const gk = `${f.record}:${f.scale}`;
        if (!g.has(gk)) g.set(gk, { record: f.record, scale: f.scale, centers: [] });
        g.get(gk).centers.push(...f.centers);
      }
    }
    for (const [archive, byRecord] of groups) {
      const t = await deps.getTexture(archive);
      if (deps.built().get(key) !== entry || stood.get(key) !== rec) return;   // torn down, or stood again, during the await
      for (const { record, scale, centers } of byRecord.values()) {
        if (!t || record >= t.recordCount) continue;
        deps.uploadRecord(archive, record);
        const base = deps.billboardSize(t, record);
        const size = { w: base.w * scale, h: base.h * scale };
        const batch = deps.renderer.createBillboardBatch(archive, record, size, centers);
        batch._box = deps.flatBatchAabb(centers, size);
        entry.batches.push(batch);
        rec.batches.push(batch);
      }
    }
  }
  /** PROF2: A DUNGEON'S NODES stood - its veins on its walls, the flats through its own doors; stood again at the day's
   *  turn, the state's read, the witnesses' word and a vein taken. A dungeon the witnesses confirmed as something else
   *  stands nothing. */
  async function standDungeon() {
    const d = dungeon;
    if (!d || d.id === null) return;   // AUDIT 32 H2: a dungeon with no identity stands no veins
    const gen = d.gen = (d.gen | 0) + 1;   // AUDIT 29 C7: the newest stand alone keeps its flats (two in flight drew twice)
    for (const b of d.batches) d.drop(b);
    d.batches = [];
    d.nodes = [];
    if (book.state.open !== true) return;
    const fact = book.dungeon(d.id);
    const confirmed = fact?.state === 'confirmed' || fact?.state === 'disputed';
    if (confirmed && (fact.climate !== d.info.climate || fact.region !== d.info.region)) return;
    const ctx = { dungeon: d.id, day, info: d.info, confirmed, specs, book, wall: d.wall };
    const nodes = kinds.flatMap((k) => (k.dungeonNodesOf?.(ctx) ?? []).map((n) => ({ ...n, kind: k.id })));
    d.nodes = nodes;
    for (const n of nodes) {
      const k = kindOf(n);
      if (!k || k.gone(n)) continue;
      for (const f of k.flatsOf(n)) {
        const b = await d.stand(f.archive, f.record, f.scale, f.centers);
        if (dungeon !== d || d.gen !== gen) { if (b) d.drop(b); return; }   // left, entered another, or stood again, during the await
        if (b) d.batches.push(b);
      }
    }
  }
  /** Every built pixel stood again - the day's turn, the state first read (a pixel built before it stood nothing). */
  const restandAll = () => { for (const entry of deps.built().values()) stand(entry); standDungeon(); };
  const restandAt = (px, py) => { const s = stood.get(pixelKey(px, py)); if (s) stand(s.entry); };
  /** A node's place stood again: its pixel's, or the dungeon's. */
  const restandOf = (a) => (a.dungeon ? standDungeon() : restandAt(a.px, a.py));
  /** AUDIT 29 C4: the same, by the node's key alone (a kept harvest answered through the pump). */
  function restandNode(key) {
    const n = parseNodeKey(key);
    if (!n || n.kind === 'body' || n.kind === 'haul') return;   // PROF7: a body stands nothing of the host's (it is DFU's corpse); PROF8: nor a haul
    if (n.kind === 'dvein') { if (dungeon?.id === n.dungeon) standDungeon(); } else restandAt(n.x, n.y);
  }

  // ─── THE TARGET ────────────────────────────────────────────────────
  const worldOf = (s, n) => {
    const tr = deps.pixelTranslation(s.entry.px, s.entry.py, _t);
    return [n.local[0] + tr[0], n.local[1] + tr[1] + (n.lift ?? 0.3), n.local[2] + tr[2]];
  };
  /** The node in reach nearest the look - TOOL-USE: of `own`'s kinds alone, for a tool's Use.
   *  NODE-AIM (FIELD BUGS 2026-10-01, "minig is broken doesnt work"): the look meets a node anywhere up its upright -
   *  from its base, where its picture and NODE-MARKS' glow stand, to its aim point (its lift: a boulder's is halfway up
   *  its rock, up to 1.2 m) - so a boulder is found by looking at its stones; it was found only a metre up the rock's
   *  face, outside the 12-degree cone from anywhere near. And of the nodes in the cone, the nearest the look that is SEEN
   *  is the target: one hidden behind its rock, nearest the look, hid every other node in view. */
  function findTarget(own = kinds) {
    const { pos, dir } = deps.eye();
    const dl = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    /** @type {Array<{ ang: number, yields: boolean, at: number[], best: any }>} */
    const seen = [];
    const reachBox = NODE_REACH + 1;
    // PROF2: underground the dungeon's nodes, in its own space; above ground the streamed pixels'
    const under = inDungeon();
    /** @type {Array<{ nodes: any[], entry: any, info: any, loose?: boolean, at: (n: any) => number[]|null }>} */
    const places = under ? [{ nodes: dungeon.nodes, entry: null, info: dungeon.info, at: (n) => [n.local[0], n.local[1] + (n.lift ?? 0.3), n.local[2]] }]
      : nearPixels(pos, reachBox).map((s) => ({ nodes: s.nodes, entry: s.entry, info: s.info, at: (n) => worldOf(s, n) }));
    // PROF7: the loose nodes - each its own place (Hunting's bodies), above ground or below
    for (const k of own) {
      if (!k.looseNodesOf) continue;
      const nodes = k.looseNodesOf({ entity: deps.entity(), dungeon: under }).map((n) => ({ ...n, kind: k.id }));
      if (nodes.length) places.push({ nodes, entry: null, info: null, loose: true, at: looseAt });   // AUDIT 32 H9: its own place names no ground
    }
    for (const s of places) {
      if (!s.nodes.length) continue;
      for (const n of s.nodes) {
        const k = kindOf(n);
        if (!k || !own.includes(k) || k.gone(n)) continue;
        const w = s.at(n);
        if (!w) continue;
        const dx = w[0] - pos[0], dy = w[1] - pos[1], dz = w[2] - pos[2];
        // AUDIT 29 C1: in reach in three dimensions too (a floor above, a pit below), not the ground plane alone; AUDIT 32
        // H7: a loose node (a body on the ground) by its straight distance from the eye, as DFU's corpse is reached - the
        // eye's height below it read against its reach dropped a body a metre downhill, or under a rider
        const reach = n.reach ?? NODE_REACH;
        if (s.loose ? Math.hypot(dx, dy, dz) > reach : Math.hypot(dx, dz) > reach || Math.abs(dy) > reach) continue;
        // NODE-AIM: the point of the upright the look passes nearest - the height the look's pitch reaches at the node's
        // distance along its bearing (h tan(pitch) / cos(yaw off)), held between the base and the aim point.
        // NODE-SPAN (AUDIT 2026-10-01 part four): and up to the top of its glow where that stands higher (NODE-MARKS' box,
        // from the base) - a tree glowed 3.4 m up and was found only on its trunk's lowest 1.2 m: a level look from two
        // metres or closer passed over it, a look up never found it, and from the saddle nothing did; a patch glowed 1.3 m
        // and was found 0.3 m up its centre
        const lift = n.lift ?? 0.3;
        const top = Math.max(lift, k.mark?.(n, markCtx)?.h ?? 0);
        const run = dir[0] * dx + dir[2] * dz;
        const up = run > 0 ? Math.max(dy - lift, Math.min(dy - lift + top, (dir[1] * (dx * dx + dz * dz)) / run)) : dy;
        const d = Math.hypot(dx, up, dz) || 1;
        const cos = (dx * dir[0] + up * dir[1] + dz * dir[2]) / (d * dl);
        const ang = Math.acos(Math.max(-1, Math.min(1, cos))) * (180 / Math.PI);
        if (ang < NODE_AIM_DEG) {
          // the node's bearing below the eye (AUDIT 32 H7: a body under the player's feet asks them to step back)
          seen.push({ ang, yields: n.yields === true, at: [w[0], pos[1] + up, w[2]], best: { node: n, px: s.entry?.px ?? null, py: s.entry?.py ?? null, dungeon: s.loose ? under : !s.entry, loose: !!s.loose, info: s.info, world: w, pitch: Math.atan2(dy, Math.hypot(dx, dz)) * (180 / Math.PI) } });
        }
      }
    }
    // AUDIT 29 C1: and seen - a ray to the node through the place's collider (a vein through a dungeon's wall, a patch
    // behind a rock, is no target); NODE-AIM: nearest the look first, and the first seen is the one
    seen.sort((a, b) => Number(a.yields) - Number(b.yields) || a.ang - b.ang);   // CAST-LOOK: a node the look itself stands last
    for (const c of seen) if (!deps.clear || deps.clear(pos, c.at, c.best.dungeon)) return c.best;
    return null;
  }
  /** AUDIT 29 C10: the stood pixels whose ground is within `r` of `pos` - the player's and its edge neighbours' - never
   *  every streamed pixel's every node, every frame. */
  function nearPixels(pos, r) {
    const out = [];
    for (const s of stood.values()) {
      const tr = deps.pixelTranslation(s.entry.px, s.entry.py, _t);
      const cx = Math.max(tr[0], Math.min(tr[0] + PIXEL_M, pos[0])), cz = Math.max(tr[2], Math.min(tr[2] + PIXEL_M, pos[2]));
      if (Math.hypot(cx - pos[0], cz - pos[2]) <= r) out.push(s);
    }
    return out;
  }
  /** AUDIT 29 C6: the act's node where it stands NOW - the floating origin moves the scene under an act (a recentre
   *  shifted it 819 m and the act ended as "walked off"); null once its pixel is gone. */
  function actWorld(a) {
    if (a.loose) {
      // PROF7: a body where it lies now - found again by its key among its kind's, so one its pool let go (despawned, a
      // load, stood up again) ends the act
      const now = kindOf(a.node)?.looseNodesOf?.({ entity: deps.entity(), dungeon: !!a.dungeon }).find((n) => n.key === a.node.key);
      return now ? looseAt(now) : null;
    }
    if (a.dungeon) return [a.node.local[0], a.node.local[1] + (a.node.lift ?? 0.3), a.node.local[2]];
    const s = stood.get(pixelKey(a.px, a.py));
    return s ? worldOf(s, a.node) : null;
  }
  /** PROF7: a loose node's place now, lifted for the look - null once it is gone. */
  function looseAt(n) {
    const w = n.at?.();
    return Array.isArray(w) ? [w[0], w[1] + (n.lift ?? 0.3), w[2]] : null;
  }
  /** TOOL-USE: `tool` - the template whose Use asks, null for E. */
  /** PROF-MENU: `byPress` - a row pressed by the click or picked from the list: no key is held for the act, so the press
   *  holds it, as a tool's Use does (TOUCH-HOLD) - the kind's start reads it beside `tool`. */
  const ctxFor = (t, tool = null, byPress = false) => ({ entity: deps.entity(), info: t.info, book, rank, specs, keyLabel: deps.keyLabel, pitch: t.pitch ?? null, tool, byPress });
  /** REFUSALS-LEARNED (AUDIT 2026-10-01 part four): A PLAN THE SERVICE HAS REFUSED TODAY IS NO READY PLAN - the account's
   *  day in the craft (every character's), or its veins in dungeons nobody has vouched for: counts the state does not
   *  carry, so the book keeps what the refusal said (net/profBook.js `closed`) and the prompt says it, never an act played
   *  and a tool worn for the same refusal again. */
  function planFor(t, tool = null) {
    return learned(t, kindOf(t.node)?.plan(t.node, ctxFor(t, tool)) ?? null);
  }
  /** REFUSALS-LEARNED over one plan - the kind's `plan`, or one of its menu's rows. SETTLE-SAID: and the ground's check -
   *  a ready plan on a settlement's ground is none, its reason the act's own words. */
  function learned(t, plan) {
    const where = plan?.ready ? (kindOf(t.node)?.where?.(t.node) ?? null) : null;   // SETTLE-SAID
    if (where) return { ...plan, ready: false, rest: where };
    if (!plan?.ready || typeof book.closed !== 'function') return plan;
    if (book.closed(`account:${plan.profession}`)) return { ...plan, ready: false, rest: `${HARVESTS_PER_ACCOUNT_DAY} today across your characters` };
    if (t.node.what === 'dvein' && book.closed('deep')) {
      const fact = t.dungeon && dungeon ? book.dungeon(dungeon.id) : null;
      if (fact?.state !== 'confirmed' && fact?.state !== 'disputed') return { ...plan, ready: false, rest: `${DEEP_UNCONFIRMED_PER_DAY} veins today in dungeons nobody has vouched for` };
    }
    return plan;
  }

  // ─── THE MENU (PROF-MENU) ──────────────────────────────────────────
  /** The plaque's key for a target - its own family, never a loot key (worldHover keyItemises reads none of it). */
  const menuKey = (t) => `prof:${t.node.key}`;
  /** A row the press can act on: an act ready, a search that opens its loot, a search the press hands on (AUDIT 29 C1). */
  const pressable = (p) => !!(p && (p.ready || p.open || p.loot));
  /** The node's acts as the menu's rows: the kind's `rows` or its one plan, each with its id, each REFUSALS-LEARNED. */
  function rowsFor(t) {
    const k = kindOf(t.node);
    if (!k) return [];
    const ctx = ctxFor(t);
    const raw = k.rows ? k.rows(t.node, ctx) : [k.plan(t.node, ctx)];
    return raw.filter(Boolean).map((p, i) => ({ ...learned(t, p), id: p.id ?? p.harvest ?? String(i) }));
  }
  /** A row as a list says it - its reason after it where it is refused (the plaque's own form). */
  const rowLabel = (p) => (pressable(p) || !p.rest ? p.verb : `${p.verb} (${p.rest})`);
  /** A row pressed: its loot opened, its act started, or - refused - what it needs kept for the host to hand back
   *  (VEIN-NEED) and the press passed on (AUDIT 29 C1). True when the press was the node's. */
  function pressRow(t, plan, byPress = false) {
    if (plan?.open) { plan.open(); return true; }
    if (!plan || !plan.ready) { passedOn = needLine(plan, rank); return false; }
    start(t, plan, null, byPress);
    return true;
  }

  // ─── THE ACT ───────────────────────────────────────────────────────
  /** The act at `t` started - true - or its checks' refusal said. TOOL-USE: `tool`, the template whose Use started it. */
  function start(t, plan, tool = null, byPress = false) {
    const k = kindOf(t.node);
    const a = k?.start(t.node, plan, ctxFor(t, tool, byPress));
    if (!a) return false;
    if (a.refused) { hud.toast(a.refused); return false; }
    act = { ...a, node: t.node, px: t.px, py: t.py, dungeon: t.dungeon, loose: !!t.loose, info: t.info, world: t.world };
    syncPointer();   // HERB-CURSOR: in the press's frame, while its activation stands (a lock a browser asks one for)
    chipProfession = a.profession;
    chipLeft = CHIP_S;
    return true;
  }
  /** HERB-CURSOR: the mouse as the act playing needs it (actPointer) - asked as an act starts, let go as it ends,
   *  however it ends (its end, Escape, walking off, a window over it, the dungeon left, the professions shut, `dispose`):
   *  at the change itself where the host makes it, and at every frame's start and end (AUDIT A3/B1: a frame that throws
   *  after the act ended - world.js swallows it - no longer keeps the cursor free). */
  function syncPointer() {
    if (act === pointerAct) return;
    pointerAct = act;
    const off = pointerOff;
    pointerOff = null;
    off?.();
    const want = act ? actPointer(act.act?.state) : null;
    if (want) pointerOff = deps.pointer?.(want) ?? null;
  }
  function finish(a) {
    const report = a.act.report();
    act = null;
    hud.setMeter(null);
    if (!report) return;
    a.report = report;   // AUDIT 32 P10: the act's own words, said with its answer
    a.clean = report.clean === true || report.finds >= 3;
    if (a.clean) hud.cue?.('clean');   // PROF-SCENES: a clean finish rings
    if (a.tool) wearForagingTool(a.tool, deps.entity());   // FORAGE0 14.1: a completed act wears its tool by one
    const before = rank(a.profession);
    book.harvest({
      node: a.node.key, kind: a.harvest, climate: a.info?.climate ?? null, region: a.info?.region ?? null, act: report,   // PROF7: a body names no ground
      at: Math.floor(deps.nowMs() / 1000), ...((typeof a.ask === 'function' ? a.ask() : a.ask) ?? {}),   // AUDIT SILVER-WAYS D5: a kind's ask may be asked at the act's end
      // AUDIT BAG1 B4: the material the act's goods are, where the kind knows it - the book reads what the bag and the pack
      // hold of it (`held`); no kind named one, and no carried harvest ever cut the count to the pack
      ...(actMaterial(a) ? { material: actMaterial(a) } : {}),
    }).then((r) => answered(a, r, before), () => {});
  }
  /** A harvest's answer said: the Stores, the XP, a gem, a rank's rise; a refusal in words; a kept one once. */
  function answered(a, r, before, nodeKeyOf = null) {
    if (r?.elsewhere) return;   // AUDIT 32 B5: another character's answer, heard after a switch - theirs, unsaid here
    if (r?.ok) {
      const d = r.data;
      const profession = d.track?.profession ?? a?.profession ?? 'herbalism';
      const k = a ? kindOf(a.node) : kindOfProfession(profession);
      const note = a && k?.actNote ? k.actNote(a.report) : a?.clean ? (k?.cleanNote(a, d) ?? '') : '';   // AUDIT 32 P10
      // HAUL-CARDS: on the enhanced skin the goods, their Stores and the XP are ONE card under the crosshair (the loot's
      // band - ui/pickupFeed.js showHaul); the classic skin, or a face that cannot draw, says the lines as ever
      // AUDIT HAUL-CARDS A3: only on a live world (walking, nothing over it) - a window open as the answer lands takes
      // the feed down with the plaque (ui/worldPlaque.js hideWorldPlaque), and the card went before it was seen, its
      // lines unsaid; there the lines are said as ever
      const live = deps.active?.() === true || deps.activeDungeon?.() === true;
      let hauled = false;
      try { hauled = live && deps.haul?.(harvestHauls(d, { name: k?.haulName?.(d) ?? null, note })) === true; } catch { hauled = false; }
      if (!hauled) hud.toast(k?.storesLine ? k.storesLine(d) : storesLine(d), { keep: true });   // GATHER-SAID: the goods in one line, outlasting the rest; PROF4's Resin, PROF7's butchery in it; PROF8's species
      if (!storesSaid) { storesSaid = true; hud.toast(storesWhereLine(deps.keyLabel?.('Professions') ?? '', d.carry === true)); }
      if (!hauled) hud.toast(`+${d.xp} ${professionName(profession)} XP${note}`);
      // BAG1: what found no room in the bag or the pack is said even where the card said the goods - the card counts what came
      // AUDIT BAG1 B9: each by its own name - a gem or a second find left was said as the harvest's material
      if (hauled && d.carry === true && (d.put?.left ?? 0) > 0) hud.toast(`${leftWords(d)} left where gathered: no room in your bag or pack.`);
      // PACK-OVER (FIELD BUGS 2026-10-04): goods minted past the pack's weight - the card counts them, the line beside it says the weight
      // AUDIT PACK-OVER C: once in OVER_SAID_MS - a pump settling five kept harvests said it five times and pushed a rank's rise out
      if (hauled && d.carry === true && (d.put?.over ?? 0) > 0 && deps.nowMs() - overSaidAt >= OVER_SAID_MS) { overSaidAt = deps.nowMs(); hud.toast(BAG_WORDS.overWeight); }
      const after = d.track?.rank ?? before;
      if (after > before) {
        hud.toast(`${professionName(profession)} ${before} -> ${after}`);
        const crossed = BANNER_RANKS.filter((b) => before < b && after >= b);
        if (crossed.length) {
          const at = crossed[crossed.length - 1];
          hud.banner(`${rankName(at)} ${k?.title(profession) ?? professionName(profession)}`);
          if (at === 50 || at === 100) hud.toast('A specialisation may be chosen on the Professions page (the pause menu\'s Stats).');
        }
      }
      try { k?.answered?.(d, (t) => hud.toast(t), { hauled }); } catch (e) { console.warn('[gather] an answer', e); }   // PROF8: a trophy into the pack; HAUL-CARDS: `hauled` - its card said the goods (a Motherlode's silver on it)
      chipProfession = profession;
      chipLeft = CHIP_S;
      if (a && !a.loose && k?.gone(a.node)) {   // PROF7: a body stands nothing of the host's to stand again
        // PROF4: the node's fall, seen by the one who worked it (a felled tree tips away from them)
        // AUDIT 30 A5: the node as its pixel stands NOW (stood again under the ask, its wood rebuilt, the act's node is
        // another's flat), and a fall that fails is the fall's alone - the pixel stands again whatever it did
        const s = a.dungeon ? null : stood.get(pixelKey(a.px, a.py));
        const now = s?.nodes.find((x) => x.key === a.node.key) ?? null;
        if (now && k.felled) {
          try { Promise.resolve(k.felled(now, { entry: s.entry, from: deps.eye().pos, tr: deps.pixelTranslation(a.px, a.py, [0, 0, 0]) })).catch((e) => console.warn('[gather] a fall', e)); } catch (e) { console.warn('[gather] a fall', e); }
        }
        restandOf(a);
      } else if (!a && nodeKeyOf) restandNode(nodeKeyOf);
      return;
    }
    // GATHER-SAID: every kept act says so (a flag once a session left the second slow answer silent), and why
    if (r?.kept) { hud.toast(r.error === 'auth' || r.error === 'no-session' ? KEPT_SIGNED_OUT_LINE : KEPT_LINE); return; }
    if (r?.error === 'lapsed') { hud.toast(LAPSED_LINE); return; }
    hud.toast(accountRefusalText(r?.error));
    if (a && !a.loose && r?.error === 'node-taken') restandOf(a);
    // AUDIT SILVER-WAYS D2 (REFUSALS-LEARNED): the refusal handed to the kinds - a Motherlode spent, found or gone is
    // learned (scenes/mineHost.js), its pixel stood again
    const key = a?.node?.key ?? nodeKeyOf;
    if (typeof key === 'string') for (const k of kinds) { try { k.refused?.(key, r?.error ?? null); } catch (e) { console.warn('[gather] a refusal', e); } }
  }

  return {
    /** A pixel built: its nodes stood. */
    onBuilt(entry) { if (entry) stand(entry); },
    /** PROF2b: a pixel's nodes stood again, where it is built - a Motherlode risen on it, gone or spent. */
    restandAt(px, py) { restandAt(px, py); },
    /** A pixel torn down: its batches went with it (they are in its list); forgotten here. */
    onDestroyed(entry) {
      if (!entry) return;
      stood.delete(`${entry.px},${entry.py}`);
      for (const k of kinds) k.dropped?.(entry);   // PROF4: a fall or logs under way on it went with its batches
    },
    /**
     * PROF2: A DUNGEON ENTERED - `{ id, climate, region, wall, stand, drop }`: DFU's identity for it (MapId & 0xfffff),
     * its ground as this client derives it, the wall its veins stand on (`wall(marker, bearing)`), and its own doors
     * for flats (`stand(archive, record, scale, centers)` -> a batch it owns, `drop(batch)`).
     */
    enterDungeon(d) {
      if (dungeon) this.leaveDungeon();
      if (!d) return;
      // AUDIT 32 H2: a dungeon with no identity (a client's hash - every spawned dungeon) is still one the host stands in:
      // no veins, and its loose nodes found (a body names no ground); it told the host nothing, and no body was a node
      const known = Number.isSafeInteger(d.id) && Number.isSafeInteger(d.climate) && Number.isSafeInteger(d.region);
      dungeon = { id: known ? d.id : null, info: known ? { climate: d.climate, region: d.region } : null, wall: d.wall, stand: d.stand, drop: d.drop, nodes: [], batches: [] };
      standDungeon();
    },
    /** The dungeon left: its flats dropped (before the dungeon's own teardown frees the rest), an act in it ended. */
    leaveDungeon() {
      const d = dungeon;
      dungeon = null;
      if (!d) return;
      for (const b of d.batches) d.drop(b);
      d.batches = [];
      if (act?.dungeon) { act.act.cancel(); act = null; hud.setMeter(null); hud.toast(ACT_STOPPED_LINE); }   // GATHER-SAID
    },
    /** Whether an act is playing - the host keeps the weapon's swing, and the press ladder, off it. */
    acting: () => !!act,
    /**
     * ACT-TOUCH (FIELD BUGS 2026-10-01, "minig is broken doesnt work"): THE ATTACK FROM A DOOR THE EDGE RING NEVER SEES -
     * a finger's Attack button or swipe and a pad's trigger reach the world through the host's hooks (`held` the press's
     * level, as they hand it, every frame of a swing), and the act's strike is read off the ring alone (`input().attack`).
     * The press that lands while an act plays is ITS strike on the next frame - never another's (one Escape ended and
     * E started in the same frame); a held press strikes once, and a press with no act strikes nothing - it is never
     * banked for one that starts after. PAD-PULSE (AUDIT 2026-10-01 part four): `repeat` - a stroke the held trigger drew
     * again (the Plus pad's gesture swing re-pulses it every 0.4 s), never a press: one strike for the hold, as said.
     * @param {boolean} held @param {boolean} [repeat]
     */
    strike(held, repeat = false) {
      const edge = !!held && !strikeHeld && !repeat;
      strikeHeld = !!held;
      if (edge) struck = act;
    },
    /**
     * CLICK-LIFT (AUDIT 2026-10-01 part four): WHETHER THE ACTIVATION'S BUTTON THIS FRAME IS THE ACT'S - down while an
     * act plays, and so to its release. ACT-CLICK made the click an act's strike on its PRESS, and the strike that
     * finishes the act ends it in that frame; the activation fires on the RELEASE (systems/activateGate.js, A8 fact 1),
     * by then with no act playing, so the stroke that finished a vein, a tree or the Basket's search opened the door, the
     * chest, the body or the lever under the look - AUDIT 32 H5's law ("a click mid-act is the act's") broken at the
     * act's edge. Asked once a frame by the host whose ladder reads the button (the street's, the dungeon's), with the
     * frame's `down`; the release frame answers true, the frame after it false.
     * @param {boolean} down
     */
    clickTaken(down) {
      const taken = clickHeld || (!!down && !!act);
      clickHeld = !!down && taken;
      return taken;
    },
    /** The tool in the hand for the rig (combat/weaponRig.js actTool): the act's, as DFU's own sprite. */
    handTool: () => (act?.hand ? act.hand(act) : null),
    /**
     * E pressed - or, PROF-MENU, the activation's click (`click`): a node in reach takes it. The row the plaque has lit
     * over the node is the one pressed; a click presses that and nothing else (a click with no lit row of a node's is the
     * ladder's). With no plaque standing, a node of one act presses it and a node of two or more opens them as a list
     * (`deps.choose`, the boat menu's way). AUDIT 32 H8: a row that opens something of its own (a body's search, by its
     * loot's key) takes the press; AUDIT 29 C1: a row that cannot be worked takes none - the press goes on to the door,
     * the chest or the foe it was meant for, and VEIN-NEED keeps what it needs for the host to hand back if the press
     * opened nothing else. True when the press was the node's.
     * @param {{ click?: boolean }} [o]
     */
    press({ click = false } = {}) {
      passedOn = '';
      passedCast = null;
      if (act) return !click;   // AUDIT 29 D3: E during an act is the act's - never a door's or a loot's behind it (a click is clickTaken's)
      if (!target || !(deps.active() || inDungeon()) || book.state.open !== true) return false;
      const t = target;
      const rows = rowsFor(t);
      const lit = deps.lit?.(menuKey(t)) ?? null;
      const chosen = lit != null ? rows.find((r) => r.id === lit) ?? null : null;
      if (click) return chosen ? pressRow(t, chosen, true) : false;
      if (chosen) return pressRow(t, chosen);
      const ready = rows.filter(pressable);
      // CAST-E (AUDIT of CAST-LOOK): a node the look itself stands (Fishing's cast - `yields`) is the target at any look in
      // the net's water, a sea's deck and a pier among it: E there was the net's before the door, the crew or the chest
      // under the look. Unlit by the plaque (hoverHit yields it to the ray's winner), it passes the press on like a node
      // with a need, and is cast when the host hands it back
      if (t.node.yields === true && ready.length) { passedCast = t; passedCastAt = deps.nowMs(); return false; }
      // the list pressed later: the rows read again, for the node chosen - the list paused the world under it. A list that
      // could not open (its art not in yet) leaves the press to the first act, as before the menu
      if (ready.length > 1 && deps.choose?.(ready.map(rowLabel), (i) => { const id = ready[i]?.id; const now = rowsFor(t).find((r) => r.id === id); if (now) pressRow(t, now, true); })) return true;
      const took = pressRow(t, ready[0] ?? rows[0] ?? null);
      // a press that picked its row itself and handed it on (a body's search) keeps the act's own refusal for the host to
      // hand back if nothing opened - what E said before the menu; a search the player chose says nothing of its own
      if (!took && !passedOn) passedOn = rows.map((r) => needLine(r, rank)).find(Boolean) ?? '';
      return took;
    },
    /**
     * PROF-MENU: THE NODE AS THE PLAQUE'S PICK - the target, while nothing plays, as a hit the plaque resolves to the
     * node's list (`hoverName`). A node with nothing to press yields to the ray's own winner in reach - the press goes
     * there (AUDIT 29 C1), and so does the plaque; with none, its refused rows are listed, their reasons said.
     * @param {any} [ray] the host's own race's winner this frame
     */
    hoverHit(ray = null) {
      if (act || !target || book.state.open !== true || !(deps.active() || inDungeon())) return null;
      const rows = rowsFor(target);
      if (!rows.length) return null;
      if (!rows.some(pressable) && ray && ray.distance <= ray.reach) return null;
      if (target.node.yields === true && ray && ray.distance <= ray.reach) return null;   // CAST-E: the cast is never the plaque's over a door, the crew or a chest
      const { pos } = deps.eye();
      const w = target.world;
      const d = Math.hypot(w[0] - pos[0], w[1] - pos[1], w[2] - pos[2]);
      return { key: menuKey(target), distance: d, reach: d };
    },
    /**
     * PROF-MENU: THE NODE'S LIST - its name, its profession's word (a ready act's own, a school's beside a cast), and its
     * acts as the plaque's verb rows: a refused one with its reason (none where its label says it), the first pressable
     * lit first. Null for any other key.
     * @param {any} key
     */
    hoverName(key) {
      if (act || !target || key !== menuKey(target)) return null;
      const k = kindOf(target.node);
      const rows = rowsFor(target);
      if (!k || !rows.length) return null;
      const profession = rows[0].profession ?? k.professions[0];
      const live = rows.find((r) => r.ready && r.rest);
      const start = rows.findIndex(pressable);
      return {
        title: k.nodeName?.(target.node) || professionName(profession),
        subs: [live ? live.rest : `${professionName(profession)} ${rank(profession)}`],
        actions: rows.map((p) => (pressable(p) ? { id: p.id, label: p.verb } : { id: p.id, label: p.verb, disabled: true, why: p.rest ?? '' })),
        ...(start > 0 ? { actionsStart: start } : {}),
      };
    },
    /**
     * VEIN-NEED (FIELD BUGS 2026-09-29h): the press a node passed on opened nothing else - no door, no chest, no foe -
     * so the node says what it needs: the host calls this at the foot of its activation ladder, for the E press that
     * asked `press` first. PROF1's "an act started, or what it needs said", C1's order kept. True when it said a line - or,
     * CAST-E, when it played the cast the press passed on (nothing else under the look took it).
     */
    sayNeed() {
      const line = passedOn, cast = deps.nowMs() - passedCastAt <= CAST_HANDBACK_MS ? passedCast : null;
      passedOn = '';
      passedCast = null;
      if (cast) {
        // CAST-E: nothing else took the press - the cast it passed on, if it may still be cast (else what it needs)
        if (act) return true;
        if (!(deps.active() || inDungeon()) || book.state.open !== true) return false;
        const plan = planFor(cast);
        if (plan?.ready) return start(cast, plan) || true;
        const need = needLine(plan, rank);
        if (need) hud.toast(need);
        return !!need;
      }
      if (!line) return false;
      hud.toast(line);
      return true;
    },
    /**
     * TOOL-USE (FIELD BUGS 2026-09-30b #2): A PROFESSION TOOL'S USE - the hotbar's or a quick slot's, nothing over the
     * world - IS E AT A NODE OF THE TOOL'S OWN KIND: the Wood-Axe's a tree, the Pick-Axe's a vein or a boulder (above
     * ground or below), the Sickle's a patch's herbs and the Basket's its food (whatever the choice key picked, which is
     * left as it was), the Fishing-Net's the cast. The act starts, or what the node needs is said at once - no door stands
     * behind a Use to pass it on to. 'started' - an act started; 'taken' - the node's, nothing started (its need or its
     * checks said, or an act already playing - AUDIT 29 D3's law for E); false - no node of its kind in reach, or no world
     * to reach (a window over it - the pack's own Use - or the professions shut): Foraging's side says the way.
     * @param {number} templateIndex @returns {false|'started'|'taken'}
     */
    useTool(templateIndex) {
      const own = kinds.filter((k) => k.tools?.includes(templateIndex));
      if (!own.length || !(deps.active() || inDungeon()) || book.state.open !== true) return false;
      if (act) return 'taken';
      const t = findTarget(own);
      if (!t) return false;
      const plan = planFor(t, templateIndex);
      if (!plan?.ready) { const line = needLine(plan, rank); if (line) hud.toast(line); return 'taken'; }
      return start(t, plan, templateIndex) ? 'started' : 'taken';
    },
    /** Escape: the act ends, nothing lost. True when there was one. */
    cancel() { if (!act) return false; act.act.cancel(); act = null; syncPointer(); hud.setMeter(null); return true; },   // HERB-CURSOR: the mouse given back
    /** Every frame the host is in the streaming world. */
    tick(dt) {
      syncPointer();   // AUDIT HERB-CURSOR A3/B1: before anything of the frame can throw
      const now = deps.nowMs();
      // the state: read on arrival, at a new character and at the UTC day's turn; kept withdrawals settled on every good
      // read (AUDIT 29 C4: once a session, a withdrawal kept mid-session waited for a reload)
      if (book.stale() && now >= refreshAt) {
        refreshAt = now + 30_000;
        // PROF5 (FOUND): a kept craft settles too, not only beside a kept withdrawal
        book.refresh().then((r) => { if (r?.ok) { refreshAt = 0; restandAll(); if (book.pendingWithdrawals || book.pendingCrafts || book.pendingDeposits) deps.onSettle?.(); } }, () => {});   // AUDIT2 BAG1 K3: and a kept deposit, at the next settle
      }
      const d = utcDayOfMs(now);
      if (d !== day) { day = d; restandAll(); }
      // SEASONAL-EYE (AUDIT 2026-10-01 part four): a spec chosen mid-session that changes what STANDS - Herbalism 100's
      // Seasonal Eye, the herbs out of season - stands the pixels again; the patches waited for the next state read or the
      // day's turn, and named another herb than the service rolled
      const eye = book.state.open === true ? (specs('herbalism')[100] ?? null) : standSpecs;
      if (eye !== standSpecs) { if (standSpecs !== undefined) restandAll(); standSpecs = eye; }
      if (book.state.open !== true) {
        if (act) { act.act.cancel(); act = null; }   // AUDIT 29 C5: shut mid-act - the act ends (the swing was held off, the tool in the hand)
        target = null;   // NODE-SHUT (AUDIT 2026-10-01 part four): shut, no node is the target - CLIMB-NODE's hold reads it, and it held the free climb everywhere until they opened again
        syncPointer();   // HERB-CURSOR
        hud.setPrompt(null); hud.setMeter(null); hud.setChip(null); hud.frame(dt); return;
      }
      // the streamed pixels' witnessed states - a pixel that changed stands again
      const want = now >= pixelsAt ? [...stood.values()].map((s) => [s.entry.px, s.entry.py]).filter(([x, y]) => (book.pixelWanted ? book.pixelWanted(x, y) : !book.pixel(x, y))) : [];   // GROUND-STALE: and one a harvest answered on
      if (want.length) pixelsAt = now + 5_000;
      if (want.length) book.askPixels(want).then((changed) => { for (const c of changed ?? []) restandAt(c.x, c.y); }, () => {});
      else if (dungeon && dungeon.id !== null && now >= pixelsAt && (book.dungeonWanted ? book.dungeonWanted(dungeon.id) : !book.dungeon(dungeon.id))) {   // PROF2: the dungeon's witnessed state; GROUND-STALE: and again after a harvest answered in it
        pixelsAt = now + 5_000;
        const d = dungeon;
        book.askDungeon(d.id).then((changed) => { if (changed && dungeon === d) standDungeon(); }, () => {});
      }
      // AUDIT 29 C4: a kept harvest's answer said with the rank it rose from (the book hands it - the track moved before
      // this call), and its node stood again by its key
      book.pump((h, r, before) => answered(null, r, before ?? rank(r?.data?.track?.profession ?? 'herbalism'), h?.node));
      // PROF4: the kinds' own frame - a felled tree's fall, the logs at its foot
      const feetNow = deps.feet();
      for (const k of kinds) k.frame?.(dt, { feet: feetNow, translation: (e) => (stood.get(pixelKey(e.px, e.py))?.entry === e ? deps.pixelTranslation(e.px, e.py, [0, 0, 0]) : null) });
      const input = deps.input();
      const attack = input.attack || (!!act && struck === act);   // ACT-TOUCH: the edge ring's press, or the hooks' - on the act it struck
      struck = null;
      if (act) {
        const { pos } = deps.eye();
        const v = deps.view();
        const feet = deps.feet();
        const w = actWorld(act);
        act.world = w ?? act.world;
        const gone = act.loose ? !w : !act.dungeon && !stood.has(pixelKey(act.px, act.py));   // its pixel torn down under it; PROF7: its body let go
        act.act.tick(dt, { held: input.held || act.heldByUse === true, attack, view: v, pos: { x: feet[0], z: feet[2] }, aim: aimAt(pos, act.world, v) });   // TOOL-USE: a hold the Use made
        const away = gone || Math.hypot(act.world[0] - pos[0], act.world[2] - pos[2]) > (act.node.reach ?? NODE_REACH) + 1;
        const here = act.dungeon ? inDungeon() : deps.active();
        if (act.act.state.cancelled || away || !here) {   // GATHER-SAID: said, never only the meter gone (Escape ends it in `cancel`, unsaid)
          // AUDIT FB1005 W2: an act dropped is ENDED, as at every other drop - a window, a door, the helm, a pixel's
          // edge: Fishing's live cast stayed neither done nor cancelled and kept the bank a target (SHORE-CAST)
          if (!act.act.state.done && !act.act.state.cancelled) act.act.cancel();
          act = null; hud.setMeter(null); hud.toast(ACT_STOPPED_LINE);
        }
        else if (act.act.state.done) { hud.setMeter(act.act, act.label ?? '', { byUse: act.heldByUse === true }); finish(act); }   // PROF-SCENES: the last frame drawn (its blow's cue) before the marks go
        else hud.setMeter(act.act, act.label ?? '', { byUse: act.heldByUse === true });   // TOUCH-HOLD: a Use's hold says no key
        hud.setPrompt(null);
      } else {
        target = deps.active() || inDungeon() ? findTarget() : null;
        if (target) {
          // PROF-MENU: the plaque names the node and lists its acts where it stands - no prompt beside it; where none
          // stands, the prompt says the one act, or the choice E opens
          const rows = rowsFor(target);
          if (input.choice && rows.length > 1 && deps.plaque?.()) {
            // the act choice key: the next row lit, the last back to the first
            const at = rows.findIndex((r) => r.id === (deps.lit?.(menuKey(target)) ?? null));
            deps.step?.(at >= rows.length - 1 ? -at : 1);
          }
          const ready = rows.filter(pressable);
          const plan = ready[0] ?? rows[0] ?? null;
          if (!plan || deps.plaque?.()) hud.setPrompt(null);
          else if (ready.length > 1) hud.setPrompt({ key: deps.keyLabel('Interact'), verb: 'Choose', rest: ready.map((r) => r.verb).join(' / ') });
          else hud.setPrompt({ key: deps.keyLabel('Interact'), verb: plan.verb, rest: plan.rest });
          chipProfession = plan?.profession ?? chipProfession;
          chipLeft = Math.max(chipLeft, 0.5);
        } else hud.setPrompt(null);
      }
      chipLeft = Math.max(0, chipLeft - dt);
      const cp = chipProfession;
      const tally = (cp && kindOfProfession(cp)?.tally?.()) || { n: book.state.today?.[cp] ?? 0, cap: book.state.caps?.harvests ?? 60 };   // PROF7: Hunting's day is the account's
      hud.setChip(chipLeft > 0 && cp ? `${professionName(cp)} ${rank(cp)} - ${tally.n} / ${tally.cap} today` : null);
      hud.frame(dt);
      syncPointer();   // HERB-CURSOR: an act this frame ended - finished, walked off, a window over it
    },
    /** For the pins and the compass: what stands, and the target. */
    get target() { return target; },
    nodesOf: (px, py) => stood.get(pixelKey(px, py))?.nodes ?? [],
    /** Every stood node of a kind, with its world place (the Prospector's compass - PROF0 3.3).
     *  @param {string} kindId @param {(n: any) => boolean} [pred] */
    stoodOf(kindId, pred = () => true, near = null) {
      const out = [];
      // AUDIT 29 C10: `near` ({ pos, r }) - the pixels within r alone (the compass asked every node every frame)
      for (const s of near ? nearPixels(near.pos, near.r) : stood.values()) for (const n of s.nodes) if (n.kind === kindId && pred(n) && !kindOf(n)?.gone(n)) out.push({ node: n, world: worldOf(s, n) });
      return out;
    },
    /**
     * NODE-MARKS (2026-10-01, Mac: "Any profession node, like herbs, should appear on the compass. The node itself
     * should also stand out with a detailed slight glow"): THE NODES STANDING NEAR `pos` - underground the dungeon's,
     * above ground the stood pixels', and the loose ones (Hunting's bodies) where they lie - each its kind's mark says
     * stands within its reach: `{ key, profession, at: [x, y, z] its base in the scene, w, h, d, reach }`, `d` its
     * distance on the ground, nearest first, at most NODE_MARK_MAX. One list, refilled each call (AUDIT WB D10's law): the
     * compass and the glow read it at once and keep none of it. The professions shut, none.
     * @param {number[]} pos the player's feet, in the place's own frame
     */
    marks(pos) {
      const out = _marks;
      out.length = 0;
      if (book.state.open !== true || !isVec3(pos)) return out;
      let used = 0;
      const add = (k, n, x, y, z) => {
        const m = k.mark ? k.mark(n, markCtx) : (k.gone(n) ? null : NODE_MARK_SIZE);
        if (!m) return;
        const reach = m.reach ?? NODE_MARK_M;
        const d = Math.hypot(x - pos[0], z - pos[2]);
        if (!(d <= reach)) return;
        const r = _markPool[used] ??= { key: '', profession: '', at: [0, 0, 0], w: 0, h: 0, d: 0, reach: 0 };
        used++;
        r.key = n.key; r.profession = k.professions[0]; r.at[0] = x; r.at[1] = y; r.at[2] = z; r.w = m.w; r.h = m.h; r.d = d; r.reach = reach;
        out.push(r);
      };
      const under = !!dungeon;
      if (under) {
        for (const n of dungeon.nodes) { const k = kindOf(n); if (k) add(k, n, n.local[0], n.local[1], n.local[2]); }
      } else {
        for (const s of nearPixels(pos, MARK_WALK_M)) {
          const tr = deps.pixelTranslation(s.entry.px, s.entry.py, _t);
          const tx = tr[0], ty = tr[1], tz = tr[2];
          for (const n of s.nodes) { const k = kindOf(n); if (k) add(k, n, n.local[0] + tx, n.local[1] + ty, n.local[2] + tz); }
        }
      }
      for (const k of kinds) {
        if (!k.looseNodesOf || !k.marksLoose) continue;
        for (const n of k.looseNodesOf({ entity: deps.entity(), dungeon: under })) {
          const w = n.at?.();
          if (isVec3(w)) add(k, n, w[0], w[1], w[2]);
        }
      }
      out.sort((a, b) => a.d - b.d);
      if (out.length > NODE_MARK_MAX) out.length = NODE_MARK_MAX;
      return out;
    },
    /**
     * GATHER-OW: THE GROUPS FOR THE OVERWORLD - each profession's nodes on a stood pixel, those its kind would still mark
     * (NODE-MARKS' own test: not worked today), as one mark at their middle with their count: `{ key, at, label, kind:
     * 'gather <profession>', color }` - the travel view's own mark shape. Within GROUP_M of `pos`, the nearest
     * GROUP_MAX; read again at most every GROUP_REFRESH_MS (the view asks every frame), and none with the professions
     * shut or underground. Hunting's bodies are no group (they lie where they fell, nearby alone).
     * @param {number[]} pos the player's feet, in the scene
     */
    overworldGroups(pos) {
      const now = deps.nowMs();
      if (!(groupsAt !== null && now - groupsAt < GROUP_REFRESH_MS && now >= groupsAt)) {
        groupsAt = now;
        groupsKept = [];
        if (book.state.open === true && isVec3(pos) && !dungeon) {
          /** `${pixel}:${profession}` -> { s, profession, nodes, x, z } (x, z the sum of the nodes' pixel-local places) */
          const byKey = new Map();
          for (const s of nearPixels(pos, GROUP_M)) {
            for (const n of s.nodes) {
              const k = kindOf(n);
              if (!k || !(k.mark ? k.mark(n, markCtx) : !k.gone(n))) continue;
              const profession = k.professions[0];
              const key = `${pixelKey(s.entry.px, s.entry.py)}:${profession}`;
              let g = byKey.get(key);
              if (!g) byKey.set(key, g = { s, profession, nodes: [], x: 0, z: 0 });
              g.nodes.push(n); g.x += n.local[0]; g.z += n.local[2];
            }
          }
          const all = [];
          for (const [key, g] of byKey) {
            // AUDIT GATHER-OW: at the node nearest their middle, never the middle itself - two schools' middle was dry land,
            // a forest's on the pixel's open ground, and a hill's in the air or under it
            const cx = g.x / g.nodes.length, cz = g.z / g.nodes.length;
            let at = g.nodes[0], best = Infinity;
            for (const n of g.nodes) { const e = Math.hypot(n.local[0] - cx, n.local[2] - cz); if (e < best) { best = e; at = n; } }
            const tr = deps.pixelTranslation(g.s.entry.px, g.s.entry.py, _t);
            const d = Math.hypot(at.local[0] + tr[0] - pos[0], at.local[2] + tr[2] - pos[2]);
            if (!(d <= GROUP_M)) continue;
            all.push({ d, s: g.s, local: at.local, mark: { key: `gather:${key}`, at: [0, 0, 0], label: groupLabel(g.profession, g.nodes.length), kind: `gather ${g.profession}`, color: nodeMarkCss(g.profession), dist: d / 1000 } });   // OW-NODE-KM: how far off, km - the Overworld's node reach reads it
          }
          all.sort((a, b) => a.d - b.d || (a.mark.key < b.mark.key ? -1 : 1));
          groupsKept = all.slice(0, GROUP_MAX);
        }
      }
      // AUDIT GATHER-OW: placed on every call from its pixel's translation NOW - the floating origin moves the scene under
      // the cache (a recentre: 819 m), and the diamonds stood where the land had been until the next read
      const out = [];
      for (const g of groupsKept) {
        if (stood.get(pixelKey(g.s.entry.px, g.s.entry.py)) !== g.s) continue;   // its pixel torn down or stood again since
        const tr = deps.pixelTranslation(g.s.entry.px, g.s.entry.py, _t);
        g.mark.at[0] = g.local[0] + tr[0]; g.mark.at[1] = g.local[1] + tr[1] + GROUP_LIFT_M; g.mark.at[2] = g.local[2] + tr[2];
        out.push(g.mark);
      }
      return out;
    },
    /** The page's teardown. */
    dispose() { this.leaveDungeon(); for (const s of stood.values()) unstand(s.entry); stood.clear(); act = null; syncPointer(); hud.dispose(); },
  };
}
