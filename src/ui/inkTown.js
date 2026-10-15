// @ts-check
// ═══════════════════════════════════════════════════════════════════
// EM4 — THE TOWN'S INK: a city drawn in the hand that drew the Iliac
// Bay and the dungeon's plan.
//
// Mac (2026-09-21): "we're going to put our own spin on the automap and
// town map themselves, enhancing the look like how we did we the world
// map."
//
// THE DATA IS A STAMP, NOT A DRAWING. Every RMB block carries a 64x64
// byte grid in its FLD header (`autoMapData`), one byte a pixel, and
// the byte is the building type plus one - 0 is street, 0xfb is a
// ground flat, and the rest fall into DFU's four groups. The shipped
// town map paints those bytes as four flat colours and rotates the
// result under a camera. That is faithful, and it is a bitmap.
//
// SO THE PLAN IS TRACED, not painted. The built-up pixels are an
// island whose sea is the street, and the island's shore is
// `boundarySegments` + `linkSegments` - the same two functions that ink
// the bay's coastline and the dungeon's walls. Three sheets, one hand,
// and not one pixel of ARENA2 raster enters the port through any of
// them.
//
// ═══ EM7: AND THE ISLAND IS FOUR ISLANDS ═══════════════════════════
//
// Mac (2026-09-21): "keep our own version of the colored buildings that
// classic uses".
//
// The first cut washed the ENTERABLE pixels in one flat sepia and left
// a house as outline alone. It was legible and it threw away the one
// thing classic's town map has always had: a tavern is green, a temple
// is tan, a shop is blue, a house is slate, and you find the smith
// without reading a word. That reading is kept whole. The PAINT is
// ours - each quarter traced as its own island and washed in classic's
// own hue at a watercolour's strength, so the parchment's cracks read
// straight through and the sepia outline still sits on top as the
// drawing rather than as a border round a block of colour.
//
// WHICH QUARTER A BYTE IS lives in `ui/townQuarters.js`, with DFU's
// four colours beside it, and BOTH SKINS ASK IT THERE. The sets used
// to sit in this file and in `ui/exteriorAutomapWindow.js` at once,
// which is how the same building could have come to be drawn as a shop
// on one map and a house on the next.
//
// THE THREE WEIGHTS, and the one thing the bytes can and cannot say.
//
//   THE QUARTERS are the wash: four traced, filled islands, one per
//   group, in classic's own hue.
//
//   THE WALL is the outline of every built-up pixel, at the pen's full
//   weight, over all four. Every block, every building, the whole
//   town's footprint - ONE stroke, because a stroke per quarter doubles
//   every wall two quarters share.
//
//   THE NAMES are the whole readability win, and EM8 letters each one
//   in ITS OWN QUARTER'S INK - the same ladder its pixels went through,
//   reached through `quarterOfType` because a summary carries the type
//   and the grid carries the type plus one.
//
//   WHAT THE BYTES CANNOT SAY IS WHICH building a pixel belongs to.
//   They carry a TYPE per pixel and no identity, so "wash the ones you
//   have discovered" is not derivable from them and is not attempted:
//   discovery is answered by the NAMEPLATES, which come off
//   `buildingSummaries` and the discovery record and know exactly which
//   building they name. Written down because the absence looks like an
//   oversight and is not.
//
// Paper coordinates throughout; the plan arrives in LAYOUT PIXELS
// (gridW*64 by gridH*64), which already start at zero, so the window's
// clamp needs no shifting. THE FIELD IS LAID IN NAMEPLATE-ANCHOR SPACE
// so the plan and the names cannot mirror against each other -
// `townBytes` carries that law and what a pin cannot settle about it.
// ═══════════════════════════════════════════════════════════════════

import {
  PEN, HALO_PEN, NAME_FACE, toPaper, paintCaret, paintPartyCarets, CARET_R, quarterWash, quarterInk,
} from './inkMap.js';
import { QUARTERS, CLASSIC_ARGB, argbChannels, quarterOf } from './townQuarters.js';

/** One block is 64 layout pixels on a side (the FLD grid's own), and
 *  one layout pixel is WORLD_PER_PX world units. Both live in
 *  `ui/nameplateLayout.js`, which is the module that owns this space -
 *  re-exported here so a caller that has the ink does not also have to
 *  reach for the anchors. */
export { NAMEPLATE_BLOCK_PX as BLOCK_PX, WORLD_PER_PX } from './nameplateLayout.js';
import { NAMEPLATE_BLOCK_PX as BLOCK_PX } from './nameplateLayout.js';

/** The quarters and the ladder that sorts a byte into one have ONE
 *  HOME in ui/townQuarters.js, and it is the home the CLASSIC window
 *  reads too - re-exported so a caller that has the ink does not also
 *  have to reach for them. */
export { QUARTERS, quarterOf, quarterOfType } from './townQuarters.js';

/** What each thing on a town plan is drawn in - inkMap's own pen, as
 *  the dungeon's is. A colour written out here would be the first thing
 *  to give away that these are three sheets and not one map. */
export const TOWN_PEN = Object.freeze({
  wall: PEN.line,      // the outline of the built-up pixels
  wash: PEN.wash,      // MAP-FIELD's own shade, still the fallback ground
  name: PEN.name,      // a discovered building's name, quarter unknown
  quest: PEN.select,   // a residence a quest has marked
  beacon: PEN.beacon,  // QUEST-RING2: its ripple, once it has left the building
  lead: PEN.soft,      // EM8: a displaced plate's line back to its building
  caret: PEN.player,
  halo: PEN.halo,
  // TOWN-MARKS (ui/townMapMarks.js): a player's house the player owns is filled in the player's own ink, as the caret
  // is; a Notice Board and another player's house are the parchment, inked round (TOWN_PEN.halo and .wall)
  home: PEN.player,
});

/**
 * EM7 — THE FOUR WASHES AND THE FOUR NAME INKS, derived one per
 * quarter from DFU's own colour for it through inkMap's two laws.
 * Neither table is written by hand: `quarterWash` and `quarterInk` are
 * the whole of the styling, so a pin can ask whether the tavern's wash
 * is still recognisably the tavern's GREEN rather than merely whether
 * it is still some string, and a change to either law moves all four
 * together.
 */
export const QUARTER_WASH = Object.freeze(Object.fromEntries(
  QUARTERS.map((q) => [q, quarterWash(argbChannels(CLASSIC_ARGB[q]))]),
));
export const QUARTER_INK = Object.freeze(Object.fromEntries(
  QUARTERS.map((q) => [q, quarterInk(argbChannels(CLASSIC_ARGB[q]))]),
));

export const TOWN_WALL_PEN = 1.3;
export const TOWN_WALL_PEN_MIN = 0.8;
/** The caret has ONE HOME in ui/inkMap.js - re-exported here. */
export { CARET_R } from './inkMap.js';
/** A quest mark's ring. */
export const QUEST_R = 7;
/** QUEST-RING (2026-10-15, from play - a player could not find the building two NPCs had marked, and asked for a mark
 *  easier to see, animated): the ring alone, 7 px at 1.8, was missed against a town of roofs. So the mark is drawn in three parts, in
 *  paper px: a gold GLOW under it, the ring at a heavier pen over a parchment halo (it reads on a dark roof as on the
 *  street), and a RIPPLE that leaves the ring and fades as it widens, one every QUEST_RIPPLE_S seconds. */
export const QUEST_GLOW_R = 16;
export const QUEST_GLOW_A = 0.4;
export const QUEST_PEN_W = 2.6;
export const QUEST_RIPPLE_W = 3;
export const QUEST_RIPPLE_R = 30;
export const QUEST_RIPPLE_S = 1.6;
/** How far a ripple has spread at `clock` seconds, 0 (at the ring) to 1 (at QUEST_RIPPLE_R) - null when no clock is
 *  given, which is a sheet that does not move (prefers-reduced-motion): the glow and the ring stand, the ripple does
 *  not. */
export function questRipple(clock) {
  if (!Number.isFinite(clock) || clock < 0) return null;
  return (clock / QUEST_RIPPLE_S) % 1;
}
/** QUEST-RING2 (the same report - the ripple to surround the building, and to change to a colour the parchment does not
 *  swallow once it leaves the building's walls): the ripple runs out past
 *  the marked building's farthest corner by QUEST_RIPPLE_PAST paper px (never less far than QUEST_RIPPLE_R), gold over
 *  the building and the beacon's ink once it is out over the street. The building is found in the town's own byte grid
 *  (`questFootprint`): the built pixel nearest the mark within QUEST_SEED_REACH, and every pixel of the same byte joined
 *  to it, no farther than QUEST_FOOT_MAX from it - so a terrace of one kind of house is not rung as one building. */
export const QUEST_RIPPLE_PAST = 10;
export const QUEST_SEED_REACH = 4;
export const QUEST_FOOT_MAX = 24;
/** EM8: the tick that says WHICH building a plate names, in paper px,
 *  and how far a plate must have been pushed before the tick alone
 *  stops being enough and a leader line is drawn to it. The threshold
 *  is in units of the plate's own height, so it follows the lettering
 *  rather than needing its own number per zoom. */
export const ANCHOR_R = 1.8;
export const LEAD_AT = 0.9;
/** TOWN-MARKS: a board's or a home's glyph is centred ON its place (Mac: "I kinda wish the icons were on top of the
 *  building itself, not on the side") and reaches this far above and below it, in paper px - the name of a building
 *  that wears one is lettered under it (ui/townSheet.js), clear by this much. */
export const TOWN_MARK_HALF = 6;

/**
 * The town's byte grids, as ONE layout-pixel field.
 *
 * THE FIELD IS BUILT IN NAMEPLATE-ANCHOR SPACE, and that is the whole
 * of the orientation law here: `ui/nameplateLayout.js`'s
 * `nameplateAnchor` puts a building at `blockY * 64 + (its z within the
 * block)`, so this lays block (bx, by)'s grid at exactly that row and
 * column. Plan and names are then in ONE space by construction, with no
 * second transform between them and no way for one to mirror against
 * the other.
 *
 * EM-BUG3 (2026-09-21, Mac from play: "enhanced local town maps are
 * rotated wrong... I was in the corner of town and It thinks entirely
 * different buildings are there") - AND THIS IS WHERE THAT CAME FROM.
 * The note this replaces reasoned about the shipped window's two flips
 * ACROSS blocks and concluded the anchor must be obeyed instead. Both
 * halves of that were wrong, and the second one was the bug:
 *
 *   THE GRID'S ROWS RUN AGAINST +Z, and nothing here accounted for it.
 *   `autoMapData` is an FLD-header grid, and every FLD grid in the port
 *   is read with its row index REVERSED - `buildGroundTilemap` takes
 *   `groundTiles[x][15 - y]` for "row 0 nearest Z=0"
 *   (world/rmbLayout.js:"GroundTiles[x][15 - y] source"), which is the same law at 16 rows that
 *   ExteriorAutomap.cs:1481 is at 64. Copying `data[y * 64 + x]`
 *   straight into row y laid every block's bytes MIRRORED north-south
 *   against the anchors, the quest rings and the player's own caret -
 *   all three of which come off +Z. Inside one block a tavern swapped
 *   ends with whatever faced it, which is exactly "different buildings
 *   are there" when you stand at the edge of town and look.
 *
 *   AND THE SHEET WAS THE MIRROR OF THE SHIPPED ONE. Compose the
 *   shipped window's two flips and they are one law, not two:
 *   `(gridH-1-b.y)*64 + y_src` is exactly `H-1-anchorRow`. It does not
 *   disagree with the anchor formula at all - it is the anchor formula
 *   seen from the screen, where a higher +Z is a HIGHER row on the
 *   paper. Drawing the anchor row downward instead turned the whole
 *   plan over against the map the same window draws beside it.
 *
 * So the sheet's space IS the shipped window's screen space, and this
 * function puts the bytes straight into it. `sheetY` is the same law
 * for everything that arrives in anchor space - the plates, the quest
 * rings and the caret - so there is still exactly one transform between
 * the two spaces and still no way for the plan and the names to part.
 *
 * @param {number} gridW @param {number} gridH
 * @param {Array<{x:number,y:number,autoMap?:Uint8Array|number[]|null}>} blocks
 * @returns {{w:number, h:number, bytes:Uint8Array}}
 */
export function townBytes(gridW, gridH, blocks) {
  const w = Math.max(1, gridW) * BLOCK_PX;
  const h = Math.max(1, gridH) * BLOCK_PX;
  const bytes = new Uint8Array(w * h);
  const gh = Math.max(1, gridH);
  for (const b of blocks ?? []) {
    const data = b?.autoMap;
    if (!data || data.length < BLOCK_PX * BLOCK_PX) continue;
    const bx = (b.x ?? 0) * BLOCK_PX;
    // EM-BUG3: the block's row in SHEET space. `(gridH-1-b.y)` is the
    // block flip and the source row `y` then goes in unreversed, which
    // together are `H-1-anchorRow` - the shipped window's own
    // composition (exteriorAutomapWindow.js:"colors[(h - 1 - worldRow) * w + b.x * BLOCK_PX + x]"), derived above.
    const by = (gh - 1 - (b.y ?? 0)) * BLOCK_PX;
    if (bx < 0 || by < 0 || bx + BLOCK_PX > w || by + BLOCK_PX > h) continue;   // a block off its own grid
    for (let y = 0; y < BLOCK_PX; y++) {
      const dst = (by + y) * w + bx;
      const srcRow = y * BLOCK_PX;
      for (let x = 0; x < BLOCK_PX; x++) bytes[dst + x] = data[srcRow + x];
    }
  }
  return { w, h, bytes };
}

/** EM-BUG3 - ANCHOR SPACE TO SHEET SPACE, the one transform between
 *  them. `nameplateAnchor` answers a row that grows with +Z; the sheet
 *  (and the shipped window it now agrees with) draws +Z upward, so a
 *  row is measured from the far edge. Everything that arrives in anchor
 *  space goes through here - the plates, the quest rings, the caret -
 *  and the field above is laid in sheet space directly, which is the
 *  same law composed at the source.
 *  @param {number} fieldH the field's height in layout pixels
 *  @param {number} anchorY */
export const sheetY = (fieldH, anchorY) => (fieldH - 1) - anchorY;

/** Is this byte a built-up pixel? DERIVED off the one ladder rather
 *  than kept as a second set beside it: a byte is built-up exactly when
 *  it belongs to a quarter, so a quarter added or a byte regrouped
 *  moves both answers at once. Street, ground flats and the rest of the
 *  show-all furniture belong to no quarter and are no part of the
 *  town's footprint. */
export const isBuilt = (byte) => quarterOf(byte) !== null;
/** Is this byte a place a player can walk into? Also derived: every
 *  quarter but the houses is a door you can open. */
export const isEnterable = (byte) => { const q = quarterOf(byte); return q !== null && q !== 'house'; };
/** The reader for one quarter, by name. */
export const isQuarter = (name) => (byte) => quarterOf(byte) === name;

/** QUEST-RING2: a footprint box (field pixels) as a paper rectangle, and how far from `(x, y)` its farthest corner is. */
export function paperBox(view, b) {
  const [ax, ay] = toPaper(view, b.x0, b.y0);
  const [bx, by] = toPaper(view, b.x1, b.y1);
  return { x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), h: Math.abs(by - ay) };
}
export const farthestCorner = (x, y, f) => Math.hypot(Math.max(Math.abs(f.x - x), Math.abs(f.x + f.w - x)),
  Math.max(Math.abs(f.y - y), Math.abs(f.y + f.h - y)));

/**
 * QUEST-RING2: the footprint of the building a quest's mark stands on, as a box in the field's own pixels
 * `{ x0, y0, x1, y1 }` (x1/y1 one past the last), or null when no built pixel lies within QUEST_SEED_REACH of the mark.
 * The mark is a nameplate anchor (`(x, y)` in sheet space, as `questMarks` hands it), which can sit on a building's
 * edge, so the nearest built pixel seeds the fill; the fill takes the seed's own byte, four ways, inside QUEST_FOOT_MAX.
 * @param {{w:number,h:number,bytes:Uint8Array}|null} field @param {number} x @param {number} y
 */
export function questFootprint(field, x, y) {
  if (!field?.bytes || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const { w, h, bytes } = field;
  const cx = Math.floor(x), cy = Math.floor(y);
  let seed = -1, best = Infinity;
  for (let dy = -QUEST_SEED_REACH; dy <= QUEST_SEED_REACH; dy++) {
    for (let dx = -QUEST_SEED_REACH; dx <= QUEST_SEED_REACH; dx++) {
      const px = cx + dx, py = cy + dy, d = dx * dx + dy * dy;
      if (px < 0 || py < 0 || px >= w || py >= h || d >= best || !isBuilt(bytes[py * w + px])) continue;
      seed = py * w + px; best = d;
    }
  }
  if (seed < 0) return null;
  const sx = seed % w, sy = (seed - sx) / w, byte = bytes[seed];
  const seen = new Set();   // the pixels the fill has reached - indices, not a byte set (EM7's one ladder stands)
  seen.add(seed);
  const stack = [seed];
  let x0 = sx, y0 = sy, x1 = sx + 1, y1 = sy + 1;
  while (stack.length) {
    const i = /** @type {number} */ (stack.pop());
    const px = i % w, py = (i - px) / w;
    x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px + 1); y1 = Math.max(y1, py + 1);
    for (const [nx, ny] of [[px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (Math.abs(nx - sx) > QUEST_FOOT_MAX || Math.abs(ny - sy) > QUEST_FOOT_MAX) continue;
      const j = ny * w + nx;
      if (seen.has(j) || bytes[j] !== byte) continue;
      seen.add(j);
      stack.push(j);
    }
  }
  return { x0, y0, x1, y1 };
}

/**
 * One reader over the field, as `boundarySegments` wants it: `(x, y) =>
 * inside`. `pick` chooses which set is the island - the built-up pixels
 * for the wall, one quarter's own for its wash.
 */
export function townReader(field, pick = isBuilt) {
  return (x, y) => (x >= 0 && y >= 0 && x < field.w && y < field.h) && pick(field.bytes[y * field.w + x]);
}

/**
 * Trace the town: the outline of a set of pixels, as chains in layout
 * pixels. `segments` and `link` are inkMap's own pair, handed in the
 * way automapFloors takes them, so this module is free of the ink
 * renderer's own imports beyond the pen.
 *
 * @param {{w:number,h:number,bytes:Uint8Array}|null} field
 * @param {{segments?: Function|null, link?: Function|null, pick?: (b:number)=>boolean}} [opts]
 * @returns {Array<Array<{x:number,y:number}>>}
 */
export function townChains(field, { segments = null, link = null, pick = isBuilt } = {}) {
  if (!segments || !link || !field) return [];
  return link(segments(townReader(field, pick), field.w, field.h));
}

/**
 * EM7: every quarter traced at once, keyed by name - the wash half of
 * a town's plan. Four passes over the field rather than one, which is
 * the price of four colours and is paid ONCE per town (the sheet caches
 * the traced plan and only the view moves).
 *
 * @param {{w:number,h:number,bytes:Uint8Array}|null} field
 * @param {{segments?: Function|null, link?: Function|null}} [opts]
 * @returns {Record<string, Array<Array<{x:number,y:number}>>>}
 */
export function quarterChains(field, { segments = null, link = null } = {}) {
  /** @type {Record<string, Array<Array<{x:number,y:number}>>>} */
  const out = {};
  for (const q of QUARTERS) out[q] = townChains(field, { segments, link, pick: isQuarter(q) });
  return out;
}

/**
 * Ink the town: each quarter's wash, then the wall over all of them.
 * `plan` is `{ chains, quarters }` - the outline of every built-up
 * pixel, and the four per-quarter outlines under it.
 *
 * The washes are drawn as their own CLOSED paths and filled, rather
 * than as a grid of cells: unlike a dungeon's storey, a shop's
 * footprint is already a tidy rectangle in the bytes, so its own
 * outline is the cheapest and cleanest fill there is.
 *
 * THE WALL IS STROKED ONCE, over all four, because two quarters that
 * share a wall would otherwise have it drawn twice and it would read
 * heavier than a wall against the street.
 */
/**
 * @param {*} ctx
 * @param {{chains?:Array<Array<{x:number,y:number}>>,
 *          quarters?:Record<string, Array<Array<{x:number,y:number}>>>,
 *          wash?:Array<Array<{x:number,y:number}>>}|null} plan
 * @param {{ox:number,oy:number,scale:number}} view
 * @param {{paperW:number, paperH:number, dpr?:number, clear?:boolean}} opts
 */
export function paintTownStatic(ctx, plan, view, opts) {
  if (!ctx?.setTransform) return;
  const { paperW, paperH, dpr = 1 } = opts;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (opts.clear !== false) ctx.clearRect(0, 0, paperW, paperH);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const trace = (chains) => {
    ctx.beginPath();
    for (const chain of chains ?? []) {
      if (chain.length < 2) continue;
      let first = true;
      for (const p of chain) {
        const [x, y] = toPaper(view, p.x, p.y);
        if (first) { ctx.moveTo(x, y); first = false; } else { ctx.lineTo(x, y); }
      }
      ctx.closePath();
    }
  };

  // EM7: the four quarters, each in classic's own hue for it. In the
  // ladder's order, so two that somehow overlapped would settle the
  // way classic settles them.
  for (const q of QUARTERS) {
    const chains = plan?.quarters?.[q];
    if (!chains?.length) continue;
    ctx.fillStyle = QUARTER_WASH[q];
    trace(chains);
    // evenodd, so a courtyard inside a temple reads as a courtyard
    ctx.fill('evenodd');
  }
  ctx.strokeStyle = TOWN_PEN.wall;
  ctx.lineWidth = Math.max(TOWN_WALL_PEN_MIN, Math.min(TOWN_WALL_PEN * 1.6, view.scale * 0.6));
  trace(plan?.chains);
  ctx.stroke();
}

/**
 * The names and the marks. `plates` are already laid out and resolved
 * (the sheet does that, through DFU's own solver), each carrying paper
 * coordinates; the quest rings and the caret are in layout pixels.
 *
 * EM8 — WHAT A NAME NOW CARRIES BESIDES ITS WORDS:
 *
 *   ITS QUARTER'S INK. A tavern's name is lettered in the tavern's
 *   green over the tavern's green wash, a temple's in the temple's tan.
 *   The ladder is the one its own PIXELS went through, so the word and
 *   the building under it cannot come to disagree about what it is. A
 *   quest's name still overrides, because a quest is the thing you
 *   opened the map for.
 *
 *   AN ANCHOR TICK. The solver moves plates vertically to untangle
 *   them, which means a name's own position is not reliably its
 *   building's - a dot at the anchor says which footprint the words
 *   belong to, always, and costs one small mark.
 *
 *   A LEADER, but only when it is EARNED: a plate pushed further than
 *   LEAD_AT of its own height is far enough to be read against the
 *   wrong building, and gets a hairline back to its tick. A plate that
 *   did not move gets nothing, which is most of them - the line is
 *   information, not decoration.
 */
/**
 * @param {*} ctx @param {{ox:number,oy:number,scale:number}} view
 * @param {{paperW:number, paperH:number, dpr?:number, clear?:boolean, pulse?:number, clock?:number|null,
 *          quests?: Array<{x:number,y:number,box?:{x0:number,y0:number,x1:number,y1:number}}>,
 *          plates?: Array<{x:number,y:number,text:string,size:number,quest?:boolean,
 *                          quarter?:string|null, anchorY?:number, marked?:boolean}>,
 *          player?: {x:number,y:number,yaw?:number}|null,
 *          party?: Array<{x:number,y:number,yaw?:number,name?:string}>, partyFill?: string,
 *          homes?: Array<{x:number,y:number,own?:boolean}>, boards?: Array<{x:number,y:number}>}} opts
 */
export function paintTownOverlay(ctx, view, opts) {
  if (!ctx?.setTransform) return;
  const { paperW, paperH, dpr = 1 } = opts;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (opts.clear) ctx.clearRect(0, 0, paperW, paperH);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const pulse = opts.pulse ?? 0;

  // a residence a quest has marked: a ring that breathes, in the pen
  // the world map rings a chosen place in - QUEST-RING: over a glow, on
  // a parchment halo, with a ripple leaving it while the sheet moves
  const ripple = questRipple(opts.clock ?? NaN);
  for (const q of opts.quests ?? []) {
    const [x, y] = toPaper(view, q.x, q.y);
    const ring = (r, pen, width, alpha = 1) => {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = pen;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    };
    ctx.globalAlpha = QUEST_GLOW_A;
    ctx.fillStyle = TOWN_PEN.quest;
    ctx.beginPath();
    ctx.arc(x, y, QUEST_GLOW_R, 0, Math.PI * 2);
    ctx.fill();
    if (ripple !== null) {
      // QUEST-RING2: out past the building's farthest corner - gold over its roof, the beacon's ink beyond it - and
      // faded on the square, so it is still strong as it crosses the building's edge
      const foot = q.box ? paperBox(view, q.box) : null;
      const reach = foot ? Math.max(QUEST_RIPPLE_R, farthestCorner(x, y, foot) + QUEST_RIPPLE_PAST) : QUEST_RIPPLE_R;
      const r = QUEST_R + (reach - QUEST_R) * ripple;
      const fade = 1 - ripple * ripple;
      if (!foot) ring(r, TOWN_PEN.quest, QUEST_RIPPLE_W, fade);
      else {
        ctx.save();
        ctx.beginPath();
        ctx.rect(foot.x, foot.y, foot.w, foot.h);
        ctx.clip();
        ring(r, TOWN_PEN.quest, QUEST_RIPPLE_W, fade);
        ctx.restore();
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, paperW, paperH);
        ctx.rect(foot.x, foot.y, foot.w, foot.h);
        ctx.clip('evenodd');
        ring(r, TOWN_PEN.beacon, QUEST_RIPPLE_W, fade);
        ctx.restore();
      }
    }
    ring(QUEST_R + pulse * 2, TOWN_PEN.halo, QUEST_PEN_W + 2);
    ring(QUEST_R + pulse * 2, TOWN_PEN.quest, QUEST_PEN_W);
  }
  ctx.globalAlpha = 1;

  // TOWN-MARKS: the player's housing and the Notice Boards, on their places and UNDER the names - a building that wears
  // a glyph has its name lettered below it, and any other name that comes to cross one keeps its words whole
  for (const h of opts.homes ?? []) {
    const [x, y] = toPaper(view, h.x, h.y);
    paintHomeMark(ctx, x, y, h.own === true);
  }
  for (const b of opts.boards ?? []) {
    const [x, y] = toPaper(view, b.x, b.y);
    paintBoardMark(ctx, x, y);
  }

  // the names, haloed then inked, as every name on every sheet is
  if (opts.plates?.length) {
    // EM8: the ticks and the leaders go down FIRST, so a name is never
    // crossed by the line that points at it.
    for (const p of opts.plates) {
      const ay = p.anchorY ?? p.y;
      const ink = p.quest ? TOWN_PEN.quest : (QUARTER_INK[p.quarter ?? ''] ?? TOWN_PEN.name);
      if (Math.abs(p.y - ay) > p.size * LEAD_AT) {
        ctx.strokeStyle = TOWN_PEN.lead;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, ay);
        // stop short of the lettering rather than running into it
        ctx.lineTo(p.x, p.y + (ay > p.y ? p.size * 0.6 : -p.size * 0.6));
        ctx.stroke();
      }
      if (p.marked) continue;   // TOWN-MARKS: the building's glyph is its tick
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(p.x, ay, ANCHOR_R, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of opts.plates) {
      ctx.font = `${Math.round(p.size)}px ${NAME_FACE}`;
      ctx.lineWidth = 2 * HALO_PEN;
      ctx.strokeStyle = TOWN_PEN.halo;
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.quest ? TOWN_PEN.quest : (QUARTER_INK[p.quarter ?? ''] ?? TOWN_PEN.name);
      ctx.fillText(p.text, p.x, p.y);
    }
  }

  // DISC23-A: the party in the streets, over the names and under the player's own caret
  if (opts.party?.length && opts.partyFill) {
    paintPartyCarets(ctx, opts.party.map((m) => {
      const [x, y] = toPaper(view, m.x, m.y);
      return { x, y, yaw: m.yaw, name: m.name };
    }), { fill: opts.partyFill, halo: TOWN_PEN.halo });
  }

  if (opts.player) {
    const [x, y] = toPaper(view, opts.player.x, opts.player.y);
    paintCaret(ctx, x, y, opts.player.yaw ?? 0, { fill: TOWN_PEN.caret, halo: TOWN_PEN.halo });
  }
}

/** A closed path through `pts`, haloed, filled in `fill`, then inked. */
function paintMarkShape(ctx, pts, fill) {
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  };
  path(); ctx.strokeStyle = TOWN_PEN.halo; ctx.lineWidth = 3.5; ctx.stroke();
  path(); ctx.fillStyle = fill; ctx.fill();
  path(); ctx.strokeStyle = TOWN_PEN.wall; ctx.lineWidth = 1.2; ctx.stroke();
}

/**
 * TOWN-MARKS (Mac: "For the notice boards in town. Can we physically mark them on the town map"): A NOTICE BOARD - a
 * pinned card ON the board's place in the street, two lines of writing on it and a pin at its head. (x, y) is the
 * place, in paper px. Skin.
 */
export function paintBoardMark(ctx, x, y) {
  const w = 13, h = 2 * TOWN_MARK_HALF - 1;
  ctx.save();
  ctx.setLineDash?.([]);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  paintMarkShape(ctx, [[x - w / 2, y - h / 2], [x + w / 2, y - h / 2], [x + w / 2, y + h / 2], [x - w / 2, y + h / 2]], TOWN_PEN.halo);
  ctx.strokeStyle = TOWN_PEN.lead; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y);
  ctx.moveTo(x - 4, y + 2.5); ctx.lineTo(x + 2, y + 2.5);
  ctx.stroke();
  ctx.fillStyle = TOWN_PEN.wall;
  ctx.beginPath(); ctx.arc(x, y - h / 2, 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/**
 * TOWN-MARKS (Mac: "and also mark owned player housing"): A PLAYER'S HOUSE - a house ON the building's place: the
 * player's own filled in the player's ink with a parchment door, another player's in parchment with an inked door
 * (the shape says "a player's house", the fill says whose - not the colour alone). Skin.
 */
export function paintHomeMark(ctx, x, y, own = false) {
  const t = TOWN_MARK_HALF;
  ctx.save();
  ctx.setLineDash?.([]);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  paintMarkShape(ctx, [[x - 5, y + t], [x - 5, y], [x - 7, y], [x, y - t],
    [x + 7, y], [x + 5, y], [x + 5, y + t]], own ? TOWN_PEN.home : TOWN_PEN.halo);
  ctx.fillStyle = own ? TOWN_PEN.halo : TOWN_PEN.wall;
  ctx.beginPath();
  ctx.moveTo(x - 1.4, y + t); ctx.lineTo(x - 1.4, y + 2); ctx.lineTo(x + 1.4, y + 2); ctx.lineTo(x + 1.4, y + t);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
