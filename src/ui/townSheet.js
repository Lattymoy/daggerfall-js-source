// @ts-check
// ═══════════════════════════════════════════════════════════════════
// EM4 — THE TOWN SHEET: the streets behind the sheet contract, on the
// same parchment as the bay and the dungeon.
//
// Mac (2026-09-21): "instead of 3 seperate keybinds, adding a tab
// toggle on the map itself... we're going to put our own spin on the
// automap and town map themselves."
//
// The second sheet written to `ui/mapStrip.js`'s SHEET_MEMBERS from
// outside the window: no back-reference, no DOM, no renderer. It is
// handed the town's block grids, its building summaries and its
// discovery record, and it answers a coordinate space, some ink and a
// pointer.
//
// THE SPACE IS LAYOUT PIXELS - gridW*64 by gridH*64 - and it already
// starts at zero, so unlike the dungeon's plan there is nothing to
// shift. The nameplate anchors land in the same space by construction
// (`ui/nameplateLayout.js` computes them in it), which is why the names
// need no second transform.
//
// THE NAMES ARE THE POINT. The shipped town map's own ladder is kept
// whole, because it is the discovery law and not a presentation choice:
// a discovered building that is not a residence shows its name (the
// player's own custom name winning over the canonical one); a
// discovered RESIDENCE shows a name only when a quest has marked it;
// and an undiscovered building shows nothing at all unless the console
// has been told to reveal them. What changes is the HAND - the
// hand-lettered face, haloed against the parchment - and that the plan
// under them is traced rather than stamped.
//
// THE PLATES ARE LAID OUT THROUGH DFU'S OWN SOLVER
// (`resolveNameplates`), which is the thing that keeps a dense quarter
// from becoming a smear, and the layout is CACHED on the view: it is
// the most expensive thing this sheet does and the view moves far more
// often than the town does.
// ═══════════════════════════════════════════════════════════════════

import { boundarySegments, linkSegments, fitView, toPaper, NAME_FACE } from './inkMap.js';
import {
  townBytes, townChains, quarterChains, quarterOfType, isBuilt, QUARTERS, sheetY,
  paintTownStatic, paintTownOverlay, BLOCK_PX,
} from './inkTown.js';
import { nameplateAnchor, resolveNameplates } from './nameplateLayout.js';

/** The fit at rest has ONE HOME in ui/inkMap.js - re-exported so a
 *  pin that has this sheet does not also have to reach for it. */
export { FIT_MARGIN } from './inkMap.js';

/** A name's size in paper pixels, and the band it is held in. A town
 *  fitted whole would letter its names at nothing; a street zoomed into
 *  would letter them like headlines. */
export const NAME_SIZE = 13;
export const NAME_SIZE_MIN = 9;
export const NAME_SIZE_MAX = 20;
/**
 * EM8 — NOT EVERY NAME IS WORTH THE SAME. Mac: "let's enhance the
 * location names on the buildings more."
 *
 * A town plan is read to FIND something, and the things a player
 * navigates BY are not the things they are hunting FOR. So a plate's
 * size is its own quarter's weight times the zoom's size, and the two
 * exceptions are the ones that matter: the LANDMARKS a player steers
 * off - the temple on the hill and the tavern on the corner - stand a
 * little proud of the run of shops, and a QUEST'S name stands proud of
 * everything, because a quest is why the map is open at all.
 *
 * The weights are a RATIO rather than a size, so they ride the zoom
 * band, and MIN/MAX are applied after so a bump can never carry a plate
 * past the size a name stops being a name at.
 */
export const NAME_WEIGHT = Object.freeze({ temple: 1.12, tavern: 1.12, shop: 1, house: 1 });
export const QUEST_WEIGHT = 1.2;
/** Below this zoom no name is laid at all - at a whole-town fit they
 *  are a grey band rather than words, and the solver's work is wasted. */
export const NAME_ZOOM_MIN = 0.55;

const EMPTY_SIZE = Object.freeze({ width: 1, height: 1 });

/**
 * @typedef {{buildingKey?: number, blockX?: number, blockY?: number, position?: number[],
 *            name?: string, isResidence?: boolean, questName?: string,
 *            buildingType?: number}} Summary
 * @typedef {{buildingKey?: number, displayName?: string, customUserDisplayName?: string,
 *            isOverrideName?: boolean}} Discovered
 *
 * @param {{
 *   gridW?: number, gridH?: number,
 *   blocks?: Array<{x:number,y:number,autoMap?:Uint8Array|number[]|null}>,
 *   buildings?: () => Array<Summary>,
 *   discovered?: () => Array<Discovered>,
 *   revealAll?: () => boolean,
 *   player?: () => {x:number, y:number, yaw?:number}|null,
 *   title?: string,
 * }} deps
 */
export function createTownSheet(deps = {}) {
  let field = null;      // the town's bytes, built once
  let plan = null;       // { chains, wash }, traced once
  let plates = null;     // { key, rows } - laid out per view
  let lastView = null;
  let lastPaper = 0;

  function ensureField() {
    if (field) return field;
    field = townBytes(deps.gridW ?? 0, deps.gridH ?? 0, deps.blocks ?? []);
    plan = {
      // the whole town's footprint, one outline...
      chains: townChains(field, { segments: boundarySegments, link: linkSegments, pick: isBuilt }),
      // ...and EM7's four islands under it, one per quarter
      quarters: quarterChains(field, { segments: boundarySegments, link: linkSegments }),
    };
    return field;
  }

  /** The discovery record, by key, so the ladder below is a lookup
   *  rather than a scan per building. */
  function discoveredBy() {
    const m = new Map();
    for (const d of deps.discovered?.() ?? []) if (d?.buildingKey != null) m.set(d.buildingKey, d);
    return m;
  }

  /**
   * WHICH BUILDINGS GET A NAME, and what that name is. The shipped
   * town map's own ladder (ui/exteriorAutomapWindow.js:1062-1098),
   * kept whole because it is the DISCOVERY law rather than a
   * presentation choice.
   */
  function named() {
    const found = discoveredBy();
    const reveal = !!deps.revealAll?.();
    const out = [];
    for (const b of deps.buildings?.() ?? []) {
      const rec = found.get(b.buildingKey);
      let text = '';
      let quest = false;
      if (rec) {
        if (!b.isResidence || rec.isOverrideName) {
          // the player's own name for it wins over the canonical one
          text = rec.customUserDisplayName || rec.displayName || b.name || '';
        } else if (b.questName) {
          // a discovered residence is named ONLY by a quest
          text = b.questName;
          quest = true;
        }
      } else if (reveal) {
        text = b.name || '';
      }
      if (!text) continue;
      const [ax, ay] = nameplateAnchor(b.blockX ?? 0, b.blockY ?? 0, b.position ?? [0, 0, 0]);
      // EM-BUG3: the anchor grows with +Z and the sheet draws +Z
      // upward, so a plate crosses into sheet space here - the one
      // transform, the same one the field was laid through.
      const sy = sheetY(ensureField().h, ay);
      // EM8: the SAME ladder the building's own pixels go through -
      // the grid's byte is this type PLUS ONE, and quarterOfType is the
      // one place that plus-one is written, so a name and the wash
      // under it cannot come to disagree about what the building is.
      out.push({ text, quest, x: ax, y: sy, key: b.buildingKey, quarter: quarterOfType(b.buildingType) });
    }
    return out;
  }

  /** EM-BUG3 - THE CARET CROSSES THE SAME SEAM AS THE PLATES. The host
   *  hands the player in anchor space (`local.z / WORLD_PER_PX`, which
   *  grows with +Z), and the sheet draws +Z upward. Both readers - the
   *  overlay and the rest view - go through here, because a caret that
   *  crossed on one path and not the other is the bug this whole slice
   *  is about, one layer up. */
  function playerOnSheet() {
    const p = deps.player?.() ?? null;
    if (!p) return null;
    return { ...p, y: sheetY(ensureField().h, p.y) };
  }

  /** Every residence a quest has marked, named or not, in layout
   *  pixels - the ring is the thing a player is actually hunting for. */
  function questMarks() {
    const found = discoveredBy();
    const out = [];
    for (const b of deps.buildings?.() ?? []) {
      if (!b?.questName || !found.has(b.buildingKey)) continue;
      const [x, y] = nameplateAnchor(b.blockX ?? 0, b.blockY ?? 0, b.position ?? [0, 0, 0]);
      out.push({ x, y: sheetY(ensureField().h, y) });   // EM-BUG3: into sheet space, as the plates are
    }
    return out;
  }

  /**
   * The size a name is lettered at, for this zoom - and, EM8, for what
   * the name IS.
   *
   * THE BAND BOUNDS THE BASELINE, AND THE WEIGHT IS APPLIED AFTER, and
   * that order is the whole of it. The first cut multiplied inside the
   * clamp, which looked right and quietly threw the hierarchy away at
   * both ends of the zoom: past scale 2.4 every plate is already at
   * NAME_SIZE_MAX, so a landmark and the shop beside it came out the
   * same size exactly where the map is most read. A weight is a RATIO
   * against the run of names beside it, so a landmark now stands its
   * weight proud of them at EVERY zoom, and the true ceiling is the
   * band's own times the largest weight there is.
   */
  function nameSize(view, n = null) {
    const weight = n?.quest ? QUEST_WEIGHT : (NAME_WEIGHT[n?.quarter ?? ''] ?? 1);
    const base = Math.max(NAME_SIZE_MIN, Math.min(NAME_SIZE_MAX, NAME_SIZE * Math.sqrt(view.scale)));
    return base * weight;
  }

  /**
   * The plates, in PAPER pixels, through DFU's own collision solver.
   * Cached on the view and the paper, because this is the most
   * expensive thing the sheet does and the view moves far more often
   * than the town does.
   */
  function ensurePlates(view, paperW, paperH, measure, reserveTop = 0, hands = null) {
    const key = [Math.round(view.ox), Math.round(view.oy), Math.round(view.scale * 100),
      Math.round(paperW), Math.round(paperH), Math.round(reserveTop), hands?.length ?? 0].join('|');
    if (plates?.key === key) return plates.rows;
    const rows = [];
    if (view.scale >= NAME_ZOOM_MIN) {
      const raw = named().map((n) => {
        const [x, y] = toPaper(view, n.x, n.y);
        // EM8: a size PER PLATE, so the solver unpicks the plates as
        // they will actually be lettered rather than as an average of
        // them - a landmark asks for more room and now gets it.
        const size = nameSize(view, n);
        const w = measure ? measure(n.text, size) : n.text.length * size * 0.52;
        return { ...n, size, px: x, py: y, w, h: size * 1.15 };
      // only what is ON the paper is worth solving for
      // only what is on the paper is worth solving for - and the band
      // the TAB STRIP has taken is not the paper, for a name: the probe
      // wrote "The Rusty Nail" straight through "Town" before this.
      // A NAME IS ONLY LAID WHERE THE PLAYER CAN READ IT: on the
      // paper, below the tab strip's band, and clear of the gauntlets.
      // The plan's own lines still run under a thumb - a wall behind a
      // hand is a wall you pan to see - but a word there is a word
      // nobody gets.
        }).filter((n) => n.px > -n.w && n.px < paperW + n.w
          && n.py - n.h / 2 > reserveTop && n.py < paperH + n.h
          && !(hands ?? []).some((r) => n.px + n.w / 2 > r.x0 && n.px - n.w / 2 < r.x1
            && n.py + n.h / 2 > r.y0 && n.py - n.h / 2 < r.y1));
      const solved = resolveNameplates(raw.map((n) => ({ x: n.px - n.w / 2, y: n.py - n.h / 2, w: n.w, h: n.h })));
      raw.forEach((n, i) => {
        const s = solved[i];
        if (!s || s.replaced) return;   // the solver gave up on it
        // EM8: the plate carries its QUARTER (its ink) and its
        // ANCHOR (where its building actually is) as well as where the
        // solver put its words - the overlay needs all three to tick
        // the building and lead back to it when the words have moved.
        rows.push({
          text: n.text, quest: n.quest, quarter: n.quarter, size: n.size,
          x: n.px, y: n.py + (s.offY ?? 0), anchorY: n.py,
        });
      });
    }
    plates = { key, rows };
    return rows;
  }

  return {
    id: 'town',

    size() {
      const f = ensureField();
      if (!f || f.w <= 1) return EMPTY_SIZE;
      return { width: f.w, height: f.h };
    },

    ensure() {
      ensureField();
      return plan?.chains?.length ? plan : null;
    },

    staticKey() {
      const f = ensureField();
      // EM7: the four quarters are part of what is INKED, so they are
      // part of what says the ink is stale - a key that named only the
      // footprint would have kept an old wash under a new outline.
      const q = QUARTERS.map((n) => plan?.quarters?.[n]?.length ?? 0).join(',');
      return `${f.w}x${f.h}|${plan?.chains?.length ?? 0}|${q}`;
    },

    paintStatic(ctx, env) {
      paintTownStatic(ctx, env.model ?? plan, env.view, {
        paperW: env.paperW, paperH: env.paperH, dpr: env.dpr,
      });
      lastView = env.view;
      lastPaper = env.paperW;
    },

    paintOverlay(ctx, env) {
      lastView = env.view;
      lastPaper = env.paperW;
      paintTownOverlay(ctx, env.view, {
        paperW: env.paperW, paperH: env.paperH, dpr: env.dpr, pulse: env.pulse,
        quests: questMarks(),
        plates: ensurePlates(env.view, env.paperW, env.paperH,
          ctx?.measureText ? (t, s) => { ctx.font = `${Math.round(s)}px ${NAME_FACE}`; return ctx.measureText(t).width; } : null,
          env.reserveTop ?? 0, env.reserveHands ?? null),
        player: playerOnSheet(),
      });
    },

    pickAt() { /* a town plan picks nothing yet - the names are read, not chosen */ },

    hoverLabel(px, py) {
      // the name under the pointer, off the plates as they were LAID -
      // so what the player is told is what the player can see, rather
      // than a building the solver dropped
      if (lastView) {
        for (const p of plates?.rows ?? []) {
          if (Math.abs(p.x - px) <= p.size * p.text.length * 0.3 && Math.abs(p.y - py) <= p.size) {
            return { label: p.text, cursor: 'pointer' };
          }
        }
      }
      return { label: deps.title ?? '', cursor: '' };
    },

    mark() { /* the middle button marks a place on the BAY; a street has none */ },
    key() { return false; },
    tick() { /* the plates are rebuilt off the view, on demand */ },
    mount() { /* the town claims none of the world map's chrome */ },
    unmount() { },

    /** At rest the whole town is on the sheet, centred on the player. */
    homeView(limits) {
      return fitView(limits, playerOnSheet());
    },

    // ── handles for the pins ────────────────────────────────────────
    get field() { return ensureField(); },
    get plan() { ensureField(); return plan; },
    names: named,
    quests: questMarks,
    platesAt: (view, paperW, paperH, measure, reserveTop = 0, hands = null) => ensurePlates(view, paperW, paperH, measure, reserveTop, hands),
    get paperW() { return lastPaper; },
    /** One block is this many layout pixels - re-exported so a caller
     *  that has the sheet does not also have to import the ink. */
    get blockPx() { return BLOCK_PX; },
  };
}
