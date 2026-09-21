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
// THE TWO WEIGHTS, and the one thing the bytes can and cannot say.
//
//   THE WALL is the outline of every built-up pixel, at the pen's full
//   weight. Every block, every building, the whole town's footprint.
//
//   THE WASH is the pixels a player can WALK INTO - shops, taverns and
//   temples, DFU's own three enterable groups - laid under the wall in
//   the shore's shade, exactly as the dungeon's wash marks where you
//   have been. A house is outline alone, which is what a house is on a
//   town plan you are reading to find a smith.
//
//   WHAT THE BYTES CANNOT SAY IS WHICH building a pixel belongs to.
//   They carry a TYPE per pixel and no identity, so "wash the ones you
//   have discovered" is not derivable from them and is not attempted:
//   discovery is answered by the NAMEPLATES, which come off
//   `buildingSummaries` and the discovery record and know exactly which
//   building they name. Written down because the absence looks like an
//   oversight and is not.
//
// THE NAMES are the whole readability win, and they are the world
// map's own law: set in the hand-lettered face, haloed against the
// parchment's cracks (MAP-FIELD6), and laid out through DFU's own
// collision solver so a dense quarter does not become a smear.
//
// Paper coordinates throughout; the plan arrives in LAYOUT PIXELS
// (gridW*64 by gridH*64), which already start at zero, so the window's
// clamp needs no shifting. THE FIELD IS LAID IN NAMEPLATE-ANCHOR SPACE
// so the plan and the names cannot mirror against each other -
// `townBytes` carries that law and what a pin cannot settle about it.
// ═══════════════════════════════════════════════════════════════════

import { PEN, HALO_PEN, NAME_FACE, toPaper, paintCaret, CARET_R } from './inkMap.js';

/** One block is 64 layout pixels on a side (the FLD grid's own), and
 *  one layout pixel is WORLD_PER_PX world units. Both live in
 *  `ui/nameplateLayout.js`, which is the module that owns this space -
 *  re-exported here so a caller that has the ink does not also have to
 *  reach for the anchors. */
export { NAMEPLATE_BLOCK_PX as BLOCK_PX, WORLD_PER_PX } from './nameplateLayout.js';
import { NAMEPLATE_BLOCK_PX as BLOCK_PX } from './nameplateLayout.js';

/** What each thing on a town plan is drawn in - inkMap's own pen, as
 *  the dungeon's is. A colour written out here would be the first thing
 *  to give away that these are three sheets and not one map. */
export const TOWN_PEN = Object.freeze({
  wall: PEN.line,      // the outline of the built-up pixels
  wash: PEN.wash,      // the ones you can walk into
  name: PEN.name,      // a discovered building's name
  quest: PEN.select,   // a residence a quest has marked
  caret: PEN.player,
  halo: PEN.halo,
});

export const TOWN_WALL_PEN = 1.3;
export const TOWN_WALL_PEN_MIN = 0.8;
/** The caret has ONE HOME in ui/inkMap.js - re-exported here. */
export { CARET_R } from './inkMap.js';
/** A quest mark's ring. */
export const QUEST_R = 7;

/**
 * DFU's own grouping of the FLD byte, transcribed from the shipped town
 * map (ui/exteriorAutomapWindow.js:194-199), which took it from
 * ExteriorAutomap.cs. The byte is `BuildingType + 1`.
 */
export const STREET_BYTE = 0;
export const GROUND_FLAT_BYTE = 0xfb;
export const TEMPLE_SET = Object.freeze([12, 15]);
export const SHOP_SET = Object.freeze([1, 3, 4, 6, 7, 9, 10, 11, 13, 14]);
export const TAVERN_BYTE = 16;
export const HOUSE_SET = Object.freeze([2, 5, 8, 17, 18, 19, 20, 21, 22, 23, 24]);
/** The bytes the shipped map only draws in its "show all" mode - the
 *  town's own furniture rather than its buildings. */
export const SHOWALL_SET = Object.freeze([25, 117, 224, 250, 251]);

const ENTERABLE = new Set([...TEMPLE_SET, ...SHOP_SET, TAVERN_BYTE]);
/** THE BUILT SET IS THE DEFAULT READING'S, and SHOWALL is not in it.
 *  The shipped town map has three view modes and only the last draws
 *  the SHOWALL bytes; the first two strip them, and one of them - 0xfb,
 *  the ground flat - is in that set, so folding SHOWALL in would have
 *  drawn every patch of scenery as a building. Found by a pin, which
 *  asked whether a ground flat is built-up and got "yes". This sheet
 *  takes the DEFAULT reading: buildings, no scenery. */
const BUILT = new Set([...TEMPLE_SET, ...SHOP_SET, TAVERN_BYTE, ...HOUSE_SET]);

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
 * WHY THIS IS NOT THE SHIPPED MAP'S ARITHMETIC. That window flips
 * twice - once inside the block and once across the block grid
 * (exteriorAutomapWindow.js:1481) - and its net effect DISAGREES with
 * the anchor formula across blocks: higher `blockY` is a lower row in
 * the texture and a higher row in the anchor. It gets away with it
 * because the two go to the screen down different paths (a rotated quad
 * under a camera, and `toPanelScreen` per plate). This sheet draws them
 * as one picture in one space, so they have to agree, and the ANCHOR is
 * the one that must be obeyed - it is the names, and the names are the
 * point.
 *
 * WHAT A PIN CANNOT SETTLE, written down rather than assumed: whether
 * the resulting picture is the right way up against the WORLD. That is
 * one composed rotation away either way and nothing inside the harness
 * renders anything, so it is a browser probe's question and Mac's eyes'
 * - the same answer the held map's own constants got (MAP-FIELD's
 * lesson: nothing that is about a PICTURE can be seen from inside a
 * test). What IS pinned is that the plan and the names cannot disagree.
 *
 * @param {number} gridW @param {number} gridH
 * @param {Array<{x:number,y:number,autoMap?:Uint8Array|number[]|null}>} blocks
 * @returns {{w:number, h:number, bytes:Uint8Array}}
 */
export function townBytes(gridW, gridH, blocks) {
  const w = Math.max(1, gridW) * BLOCK_PX;
  const h = Math.max(1, gridH) * BLOCK_PX;
  const bytes = new Uint8Array(w * h);
  for (const b of blocks ?? []) {
    const data = b?.autoMap;
    if (!data || data.length < BLOCK_PX * BLOCK_PX) continue;
    const bx = (b.x ?? 0) * BLOCK_PX, by = (b.y ?? 0) * BLOCK_PX;
    if (bx < 0 || by < 0 || bx + BLOCK_PX > w || by + BLOCK_PX > h) continue;   // a block off its own grid
    for (let y = 0; y < BLOCK_PX; y++) {
      const dst = (by + y) * w + bx;
      const srcRow = y * BLOCK_PX;
      for (let x = 0; x < BLOCK_PX; x++) bytes[dst + x] = data[srcRow + x];
    }
  }
  return { w, h, bytes };
}

/** Is this byte a built-up pixel - anything but street and the ground
 *  flats the shipped map strips? */
export const isBuilt = (byte) => BUILT.has(byte);
/** Is this byte a place a player can walk into? */
export const isEnterable = (byte) => ENTERABLE.has(byte);

/**
 * One reader over the field, as `boundarySegments` wants it: `(x, y) =>
 * inside`. `pick` chooses which set is the island - the built-up pixels
 * for the wall, the enterable ones for the wash.
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
 * Ink the town: the wash of what you can walk into, then the wall over
 * it. `plan` is `{ chains, wash }` - the outline of the built-up pixels
 * and the outline of the enterable ones.
 *
 * The wash is drawn as its own CLOSED paths and filled, rather than as
 * a grid of cells: unlike a dungeon's storey, a shop's footprint is
 * already a tidy rectangle in the bytes, so its own outline is the
 * cheapest and cleanest fill there is.
 */
/**
 * @param {*} ctx @param {{chains?:Array<Array<{x:number,y:number}>>, wash?:Array<Array<{x:number,y:number}>>}|null} plan
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

  if (plan?.wash?.length) {
    ctx.fillStyle = TOWN_PEN.wash;
    trace(plan.wash);
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
 */
/**
 * @param {*} ctx @param {{ox:number,oy:number,scale:number}} view
 * @param {{paperW:number, paperH:number, dpr?:number, clear?:boolean, pulse?:number,
 *          quests?: Array<{x:number,y:number}>,
 *          plates?: Array<{x:number,y:number,text:string,size:number,quest?:boolean}>,
 *          player?: {x:number,y:number,yaw?:number}|null}} opts
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
  // the world map rings a chosen place in
  for (const q of opts.quests ?? []) {
    const [x, y] = toPaper(view, q.x, q.y);
    ctx.strokeStyle = TOWN_PEN.quest;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(x, y, QUEST_R + pulse * 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  // the names, haloed then inked, as every name on every sheet is
  if (opts.plates?.length) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of opts.plates) {
      ctx.font = `${Math.round(p.size)}px ${NAME_FACE}`;
      ctx.lineWidth = 2 * HALO_PEN;
      ctx.strokeStyle = TOWN_PEN.halo;
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.quest ? TOWN_PEN.quest : TOWN_PEN.name;
      ctx.fillText(p.text, p.x, p.y);
    }
  }

  if (opts.player) {
    const [x, y] = toPaper(view, opts.player.x, opts.player.y);
    paintCaret(ctx, x, y, opts.player.yaw ?? 0, { fill: TOWN_PEN.caret, halo: TOWN_PEN.halo });
  }
}
