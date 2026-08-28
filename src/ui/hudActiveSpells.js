// U46 - HUDACTIVESPELLS: the buff and debuff icon rows
// (HUDActiveSpells.cs, MIT, Daggerfall Workshop). The second of the
// three components on U45's Ledger row, and the one that makes the
// magic already in the port VISIBLE: every buff, drain, paralysis and
// concealment this game has been running since the S-arc has been
// invisible unless the player opened the spellbook and counted.
//
// IT READS THE BUNDLES X10 ALREADY BUILT. systems/mysticism.js's
// liveBundles walks activeEffects and folds each cast's entries back
// into one bundle carrying its name, its type and DFU's own ShowIcon
// law - and that law is exactly this window's ShowIcon (:177-190),
// which is why the Dispel picker and the HUD read one function and
// not two.
//
// TWO ROWS, AND THE SPLIT IS THE CASTER. A bundle whose caster is the
// player goes in the SELF row (buffs, at the top in the classic
// scheme); everything else goes in the OTHER row (at the bottom,
// wrapping upward). DFU's test is `caster == null || caster !=
// player`, so a bundle with NO recorded caster lands with the
// debuffs - which is what a trap or an RDB action's cast looks like,
// and DFU's own comment says as much ("Need to check where spells
// cast by RDB actions are placed").
//
// ONE POOL, TWENTY-FOUR SLOTS, AND THE INDEX IS SHARED. poolIndex
// increments across BOTH lists in one walk (:307), before the split,
// so the cap is on the TOTAL and not on either row - and AlignIcons
// then SKIPS any icon whose slot is past the end (:328). An icon that
// overflows is silently absent while still having consumed its
// number, which is not the same as the twenty-fifth icon being drawn
// somewhere else.
//
// EIGHT LAYOUT SCHEMES off one setting, and the last is the one worth
// reading twice: `smallhorzbottom` sets iconColumns to ZERO, and the
// wrap test is `++column == iconColumns`, which a column counter
// starting at 1 can never satisfy. Zero columns means NO WRAPPING,
// which is precisely what DFU's comment says it means. Ported as
// written rather than special-cased, because the arithmetic already
// says it.
//
// THE BLINK IS THE WARNING. A bundle with fewer than two rounds left
// is `expiring` and its icon blinks at 4Hz - except an ITEM's, which
// never blinks (:157-160) because an equipped item's effect is not
// running out, it is just there. Paused, everything shows solid.
//
// HUDEscortingNPCFaces, the third component of that row, shipped at
// FE1 (ui/hudEscortFaces.js). DFU's icon PACKS (Resources/SpellIcons)
// are already a Ledger note on ui/spellIcons.js and stay one.

import { drawSpellIcon, spellIconsLoaded } from './spellIcons.js';
import { liveBundles } from '../systems/mysticism.js';
import { getString } from '../systems/settings.js';
import { nativeMetrics, pointToNative } from './nativePanel.js';

/** blinkInterval (:28) - four times a second. */
export const BLINK_INTERVAL = 0.25;
/** maxIconPool (:29). */
export const MAX_ICON_POOL = 24;

/**
 * InitIcons' eight schemes (:191-249), verbatim. Each is
 * `[iconW, iconH, originX, originY, colStepX, colStepY, rowStepX,
 * rowStepY, columns]` for the SELF row and then the OTHER row.
 *
 * The names are DFU's own, lowercased at the lookup exactly as
 * `IconsPositioningScheme.ToLower()` does. A scheme the switch does
 * not name leaves BOTH positionings null in DFU - every icon then
 * reads a null field and throws - so this port falls to Classic and
 * says so, which is the port's standard reading of a C# switch with
 * no default (Ledger A).
 */
const scheme = (iconSize, origin, columnStep, rowStep, iconColumns) =>
  ({ iconSize, origin, columnStep, rowStep, iconColumns });

export const ICON_SCHEMES = Object.freeze({
  classic: {
    self: scheme([16, 16], [27, 16], [24, 0], [0, 24], 12),
    other: scheme([16, 16], [27, 177], [24, 0], [0, -24], 12),
  },
  medium: {
    self: scheme([12, 12], [27, 16], [16, 0], [0, 16], 16),
    other: scheme([12, 12], [27, 177], [16, 0], [0, -16], 16),
  },
  small: {
    self: scheme([8, 8], [27, 16], [10, 0], [0, 10], 6),
    other: scheme([8, 8], [27, 177], [10, 0], [0, -10], 6),
  },
  smalldeckleft: {
    self: scheme([8, 8], [27, 28], [10, -2], [0, 10], 6),
    other: scheme([8, 8], [27, 165], [10, 2], [0, -10], 6),
  },
  smalldeckright: {
    self: scheme([8, 8], [296, 28], [-10, -2], [0, 10], 6),
    other: scheme([8, 8], [296, 165], [-10, 2], [0, -10], 6),
  },
  smallvertleft: {
    self: scheme([8, 8], [27, 16], [0, 10], [10, 0], 10),
    other: scheme([8, 8], [27, 177], [0, -10], [10, 0], 4),
  },
  smallvertright: {
    self: scheme([8, 8], [296, 16], [0, 10], [-10, 0], 10),
    other: scheme([8, 8], [296, 177], [0, -10], [-10, 0], 4),
  },
  smallhorzbottom: {
    // "No wrapping, two rows at the bottom of screen, debuffs above
    // buffs" - and ZERO columns is how it says so; see the header.
    self: scheme([8, 8], [27, 177], [10, 0], [0, 0], 0),
    other: scheme([8, 8], [27, 167], [10, 0], [0, 0], 0),
  },
});

export const iconSchemeName = () => String(getString('GUI', 'IconsPositioningScheme') ?? '').toLowerCase();
/** DFU's switch has no default and would leave both positionings
 *  null; the port falls to Classic rather than throwing per icon. */
export const iconScheme = (name = iconSchemeName()) => ICON_SCHEMES[name] ?? ICON_SCHEMES.classic;

/** GetMaxRoundsRemaining (:162-174): the MOST of any effect in the
 *  bundle, because "a spell can have multiple effects with different
 *  round durations" and the icon belongs to the whole cast. */
export const maxRoundsRemaining = (bundle) =>
  (bundle?.entries ?? []).reduce((m, e) => Math.max(m, e.roundsRemaining ?? 0), 0);

/**
 * UpdateIcons (:277-318). Answers `{ self, other }`, each a list of
 * `{ iconIndex, displayName, expiring, poolIndex, isItem }`.
 *
 * THE POOL INDEX IS ASSIGNED BEFORE THE SPLIT and shared by both
 * lists, so it is a walk order and not a per-row counter.
 *
 * The display name drops a LEADING '!' - "non-vendor spells start
 * with !, don't show this on the UI" - and only a leading one, which
 * is what TrimStart does.
 */
export function activeSpellIcons(entity) {
  const self = [], other = [];
  let poolIndex = 0;
  for (const bundle of liveBundles(entity)) {
    if (!bundle.showIcon) continue;
    const item = {
      iconIndex: bundle.icon ?? 0,
      displayName: String(bundle.name ?? '').replace(/^!+/, ''),
      poolIndex: poolIndex++,
      expiring: maxRoundsRemaining(bundle) < 2,
      isItem: bundle.bundleType === 'HeldMagicItem',
    };
    (bundle.selfCast ? self : other).push(item);
  }
  return { self, other };
}

/**
 * AlignIcons (:320-349). Lays one row out and answers the placed
 * icons with their virtual rects, dropping anything past the pool.
 *
 * `largeHudTop` is the bar's top edge in VIRTUAL units, or null when
 * the bar is off - AdjustIconPositionForLargeHUD (:351-364) lifts an
 * icon to `top - 18` and ONLY UPWARDS ("Icon will remain in default
 * position unless it needs to avoid being drawn under HUD"), so the
 * buff row at y=16 never moves and the debuff row at y=177 does.
 */
export function alignIcons(icons, positioning, { largeHudTop = null } = {}) {
  const out = [];
  let rowOrigin = [...positioning.origin];
  let position = [...rowOrigin];
  let column = 0;
  for (const spell of icons) {
    if (spell.poolIndex < MAX_ICON_POOL) {
      let y = position[1];
      if (largeHudTop !== null) {
        const localY = Math.trunc(largeHudTop - 18);
        if (localY < y) y = localY;
      }
      out.push({ ...spell, rect: [position[0], y, positioning.iconSize[0], positioning.iconSize[1]] });
    }
    // The wrap. `++column == iconColumns` with ZERO columns is never
    // true, which is how smallhorzbottom says "no wrapping".
    if (++column === positioning.iconColumns) {
      rowOrigin = [rowOrigin[0] + positioning.rowStep[0], rowOrigin[1] + positioning.rowStep[1]];
      position = [...rowOrigin];
      column = 0;
    } else {
      position = [position[0] + positioning.columnStep[0], position[1] + positioning.columnStep[1]];
    }
  }
  return out;
}

/** SetIconBlinkState (:153-161): an EXPIRING icon blinks, and an
 *  ITEM's never does however few rounds it reads. Answers whether
 *  this icon is drawn on this frame. */
export const iconVisible = (icon, blinkState, paused = false) =>
  (paused || !icon.expiring || icon.isItem) ? true : blinkState;

/** The blink clock (:104-112). Its own object so the four hosts share
 *  one phase through drawHud rather than each counting. */
export function createBlinkClock() {
  let timer = 0, state = false;
  return {
    get state() { return state; },
    tick(dt) {
      timer += dt;
      // ONE toggle per frame, `if` and not `while` - DFU's exactly
      // (:107-112). A frame longer than the interval carries the
      // remainder forward and toggles again NEXT frame rather than
      // draining in place, so a stall makes the blink lag instead of
      // strobing. Verbatim, because the difference is visible.
      if (timer > BLINK_INTERVAL) { timer -= BLINK_INTERVAL; state = !state; }
      return state;
    },
    _reset() { timer = 0; state = false; },
  };
}

/**
 * Draw both rows. Returns the placed icons (so a host can hit-test
 * them for the tooltip) or an empty array when nothing is drawn.
 *
 * `m` is the native 320x200 metrics - these positions are virtual
 * screen coordinates, the same space every classic window uses.
 */
export function drawActiveSpells(renderer, m, entity, {
  blinkState = false, paused = false, largeHudTop = null, schemeName = undefined,
} = {}) {
  if (!spellIconsLoaded()) return [];
  const s = iconScheme(schemeName === undefined ? iconSchemeName() : schemeName);
  const { self, other } = activeSpellIcons(entity);
  const placed = [
    ...alignIcons(self, s.self, { largeHudTop }),
    ...alignIcons(other, s.other, { largeHudTop }),
  ];
  for (const icon of placed) {
    if (!iconVisible(icon, blinkState, paused)) continue;
    drawSpellIcon(renderer, m, icon.iconIndex, icon.rect);
  }
  return placed;
}

/** The icon under a virtual point, for the tooltip. DFU hangs one
 *  ToolTip off every pooled panel and the panel's own MouseEnter
 *  picks it; the port's windows hit-test instead (U37's model). */
export function activeSpellAt(placed, vx, vy) {
  for (const icon of placed ?? []) {
    const [x, y, w, h] = icon.rect;
    if (vx >= x && vy >= y && vx < x + w && vy < y + h) return icon;
  }
  return null;
}


// ── THE POINTER ─────────────────────────────────────────────────────
// DFU hangs a ToolTip off every pooled icon panel and lets each
// panel's own MouseEnter raise it. The port's windows hit-test
// instead (U37's model), and the HUD is not a window - it has no
// pointer handler of its own and never will, because the four hosts
// own the mouse. So the pointer's VIRTUAL position lands here on its
// way past, and ui/hud.js reads it: one store, because there is one
// mouse, and the same reason the blink clock is one.
let _vx = -1, _vy = -1;
export function setHudPointer(vx, vy) { _vx = vx ?? -1; _vy = vy ?? -1; }
export const hudPointer = () => (_vx < 0 || _vy < 0 ? null : [_vx, _vy]);

/** The whole transform in ONE place, so the four hosts each spend one
 *  line rather than four copies of a client-to-native conversion that
 *  is already written three times in this tree. */
export function trackHudPointer(canvas, e) {
  if (!canvas?.getBoundingClientRect) return;
  const r = canvas.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const v = pointToNative(nativeMetrics(canvas),
    (e.clientX - r.left) * (canvas.width / r.width),
    (e.clientY - r.top) * (canvas.height / r.height));
  setHudPointer(v ? v[0] : -1, v ? v[1] : -1);
}
