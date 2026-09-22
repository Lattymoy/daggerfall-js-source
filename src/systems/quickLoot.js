// QUICK-LOOT - TAKING FROM THE PLAQUE, WITHOUT A WINDOW.
//
// Arc B of the world-hover arcs (2026-09-22). Arc A put a plaque under
// the crosshair that names what you are looking at and lists what a
// pile or a body holds; this makes that list a way to TAKE.
//
// WHAT IT IS A PORT OF: nothing, and the row says so. DFU has no quick
// loot and no mod under vendor/ carries one. Mac asked "How does skyrim
// do it" when the shape was put to him, and the honest answer is that
// vanilla Skyrim does not either - what everyone means by it is the
// QuickLoot mod (LE's QuickLoot, then QuickLoot RE/EE on SE), whose
// shape is: a list beside the crosshair on look, the wheel moving a
// highlight through it, the activate key taking the highlighted row,
// a key of its own taking the lot, and the cursor never freed. That is
// what this is, adapted - and it is a DEPARTURE, recorded as one.
//
// DFU's own precedent for taking with no window is real, and narrow: a
// body holding nothing but arrows is taken whole and no window opens
// (PlayerActivate.cs:948-952). This generalises that one case to any
// row the player has picked out, which is exactly the size of the
// departure and why it is worth writing down rather than implying.
//
// ── WHAT LIVES WHERE ────────────────────────────────────────────
//
// The HIGHLIGHT is `systems/worldHover.js nextSelection` (the law) over
// a slot in `ui/worldPlaque.js` (the state, because that module already
// owns the frame the selection is about and already has the teardown
// that frees it).
//
// The MOVE is `systems/inventory.js takeOneInto`, which is where the
// gold door lives - DoTransferItem's first statement, gold to the
// counter and never the item list.
//
// What lives HERE is the switch, the words, the highlight's STATE and
// the take. It imports no host, no document and no plaque: the draw is
// TOLD which row is lit and does not own the answer.
//
// The first pass put the selection in `ui/worldPlaque.js`, on the
// argument that the plaque already owns the frame and the teardown -
// which is true, and still the wrong home, because the TAKE needs the
// selection too. That left two ways out, and both are the layering this
// arc was split to avoid: a take that lives in a draw, or a systems
// module reaching into `ui/` to read a highlight. Moving the state to
// the feature closes both.
import { getPref } from './uiPrefs.js';
import { itemNameParts, itemStatRows } from './itemInfo.js';   // RF6: the long name's name part, the same one the plaque's rows wear; QUICK-LOOT-STATS: and the rows the lit one says about itself
import { nextSelection, selectedRow, hoverItemAt } from './worldHover.js';   // the fold's LAW and the row -> item walk, both driven there
import { takeOneInto } from './inventory.js';   // ...and the move, with the gold door in it

/** The player's own switch (features.js, `quick-loot`). Off is
 *  Daggerfall's loot exactly: the activate key opens the window it has
 *  always opened and the plaque stays the readout Arc A shipped. */
export const quickLootOn = () => !!getPref('quickLoot');

/** What the HUD says when a row goes into the pack. The name is the
 *  row's own word, so the line and the row the player was looking at
 *  cannot say different things about one item. */
export const tookItemText = (item) => `You take the ${itemNameParts(item).name || 'item'}.`;

/**
 * IS THIS CONTAINER EMPTY NOW - asked after a take, by the caller that
 * owns the container.
 *
 * It exists because "empty" is not `items.length === 0` everywhere: a
 * corpse's emptiness is what DISABLES it, and DFU disables on the
 * activation that FINDS it empty rather than on the take that empties
 * it (PlayerActivate.cs:942-947), which is what leaves the player the
 * "The body has no treasure." line to hear. So a quick-loot take that
 * empties a body must NOT disable it, and this answers the question
 * without tempting a caller to act on it.
 */
export const containerEmptied = (items) => !(items ?? []).some(Boolean);

// ── THE HIGHLIGHT'S STATE ───────────────────────────────────────
//
// It lives HERE, with the feature, and not in `ui/worldPlaque.js`
// where the first pass put it. The plaque owns the frame and the
// teardown, which is a real argument for keeping it there - but the
// TAKE needs the selection too, and a take that lived in the draw, or
// a systems module reaching into `ui/` to read a highlight, are both
// the layering this arc was split to avoid. The draw is TOLD which row
// is lit (`quickLootRow`); it does not own the answer.
//
// `_nudge` accumulates wheel clicks and is FLUSHED ONCE A FRAME, which
// is `player/mwView.js`'s own idiom for the same problem
// (`pendingClicks`, "flushed once per frame") - a trackpad delivers a
// dozen events between two frames, and folding each separately would
// throw the highlight further than the list is long.
let _sel = null;
let _nudge = 0;
/** 'all' | 'open' | null - what the NEXT activate means, armed by the
 *  two keys below and spent by the take. */
let _pending = null;

/**
 * THE PLAQUE OWNS THE WHEEL, and only while it is listing something.
 *
 * `_sel` is null unless the frame that just resolved had rows
 * (`nextSelection`'s first rule), so "is there a highlight to move" and
 * "should this click be ours" are the same question and cannot drift
 * apart. A host asks this FIRST in its wheel ladder, above the camera
 * zoom - the ladder's own existing law, "an open window owns the
 * wheel". Look away and the next frame hands the wheel back.
 *
 * Returns true when it took the click, so a host's `||` chain reads
 * exactly as it already does for `townTalk.wheel`.
 */
export function quickLootWheel(deltaY) {
  // The NOTCH is derived here, not by the host. `player/mwView.js`'s
  // own wheel door takes `deltaY` and turns it into clicks for exactly
  // this reason, and AUDIT 65 UI-5 holds the rule that the outdoor
  // hosts "own no arithmetic of their own: the event is what they pass
  // on". A `e.deltaY < 0 ? -1 : 1` written at three host call sites
  // would be three copies of one decision about which way the wheel
  // goes - and the sign is the half that is easy to get wrong.
  //
  // Down the page is DOWN the list, which is the other way round from
  // the camera door above it (there, negative is out of the head).
  const clicks = deltaY > 0 ? 1 : deltaY < 0 ? -1 : 0;
  if (!_sel || !clicks || !quickLootOn()) return false;
  _nudge += clicks;
  return true;
}

/** The per-frame fold, called by the one seam that produces the frame.
 *  The nudge is spent whether or not it moved anything, so a click
 *  spent looking at a door does not arrive later at a chest. */
export function foldQuickLoot(frame) {
  _sel = quickLootOn() ? nextSelection(_sel, frame, _nudge) : null;
  _nudge = 0;
  return _sel;
}

/** WHICH row is lit in this frame, or -1. The draw asks; so does the
 *  repaint guard, because a moved highlight leaves the frame identical
 *  and would not otherwise repaint. */
export const quickLootRow = (frame) => selectedRow(_sel, frame);

/** The highlight itself, for a host that needs to know there IS one. */
export const quickLootSelection = () => (_sel ? { ..._sel } : null);

/**
 * QUICK-LOOT-STATS (2026-09-22, a player to Mac: "i love the quick loot
 * but can it show the stats of the items next to the quickloot window?
 * So i dont have to pick up everything to check in my inventory if its
 * worth keeping"): THE HIGHLIGHTED ROW'S OWN NUMBERS.
 *
 * THE WHOLE POINT OF THE ARC WAS TO DECIDE IN THE WORLD RATHER THAN
 * THROUGH A DOOR, and without this the decision was only half moved:
 * Arc A said what a pile HELD and Arc B let you take it, so "is this
 * worth stopping for" could be answered but "is this better than what I
 * am wearing" still cost a pickup, a menu and a drop. A player found
 * the gap in a day.
 *
 * ONE ROW, NOT SIX. The panel describes the row the player has picked
 * out, because that is the one they are deciding about - and because
 * six stat blocks under a crosshair is a window, which is the thing
 * this arc exists to avoid. It follows that there is nothing to draw
 * unless quick loot is ON and something is lit, so the readout needs no
 * switch of its own: it is the highlight's other half.
 *
 * The rows are `itemInfo.js itemStatRows` - the same producers the
 * classic popup and the enhanced detail card read, so the crosshair
 * cannot disagree with the pack about what a sword does.
 *
 * @returns {{label: string, text: string}[]} empty when nothing is lit
 */
export function quickLootStats(frame) {
  const row = quickLootRow(frame);
  if (row < 0) return [];
  return itemStatRows(frame?.rows?.[row]?.item ?? null);
}

/** Freed with the host that raised it: a selection is ABOUT a key in a
 *  world a teardown is unmaking, and a nudge spent in a dungeon must
 *  not move the highlight in the street. */
export function resetQuickLoot() { _sel = null; _nudge = 0; _pending = null; }

/**
 * ── THE TAKE, AND THE DOOR IT GOES THROUGH ──────────────────────
 *
 * `hooks` is the container's own LOOT HOOKS - `corpseLootHooks(entry)`,
 * `droppedLootHooks(pile)`, the dungeon's own - which is the object a
 * host already builds to hand the inventory window as its REMOTE
 * TARGET, and whose `items()` the window mutates when the player drags
 * something out. That is the sanctioned mutable handle on a container,
 * so quick loot takes through the SAME door the window does.
 *
 * It deliberately does NOT reach for `hoverContents`, which is what the
 * plaque reads: the slice documents that as a read-only accessor, and a
 * take that spliced what a reader returned would make one of those two
 * sentences false.
 *
 * Answers the item moved, or null - and null is the caller's signal to
 * do what it always did and open the window, so a host's loot arm keeps
 * exactly one behaviour when the switch is off.
 */
export function quickLootTake(key, hooks, playerEntity, say = () => {}) {
  const how = _pending;
  _pending = null;   // spent on the press it was armed for, whatever that press finds
  if (how === 'open') return null;   // J: the player asked for the window
  if (!quickLootOn() || !hooks || !playerEntity) return null;
  const items = hooks.items?.();
  if (!Array.isArray(items)) return null;
  if (how === 'all') {
    // P: the lot, through the same one-item door - so the gold rule is
    // the one in `takeOneInto` here too, and a caller cannot get a bulk
    // take that spells it differently. `[...items]` because the door
    // splices the source, so iterating it live would skip every second
    // row - the same reason `takeCorpseLoot`'s loop copies first.
    let n = 0;
    for (const it of [...items]) { if (takeOneInto(playerEntity, items, it)) n += 1; }
    if (n) say(n === 1 ? 'You take 1 item.' : `You take ${n} items.`);
    return n ? items : null;
  }
  const item = quickLootItemAt(key, items);
  if (!item) return null;
  const moved = takeOneInto(playerEntity, items, item);
  if (moved) say(tookItemText(moved));
  return moved;
}

/**
 * THE TWO KEYS, ARMED FOR THE PRESS THEY RIDE.
 *
 * `QuickLootAll` (P) and `QuickLootOpen` (J) cannot act where they are
 * pressed: a keydown handler has the KEY, and only the frame has the
 * ray, the pick and the pools that own the container. So the key arms a
 * mode here and the host fires its own one-frame activate - `_tapArmed`,
 * which is this host's existing idiom for exactly this (the touch tap
 * is "a ONE-frame ActivateCenterObject press") - and the take reads the
 * mode when the press lands.
 *
 * Refused unless something is highlighted, so neither key does anything
 * while you are looking at a door, and the host's ladder falls through
 * to whatever else wants that key.
 */
export function quickLootArm(action) {
  if (!quickLootOn() || !_sel) return false;
  if (action === 'QuickLootAll') { _pending = 'all'; return true; }
  if (action === 'QuickLootOpen') { _pending = 'open'; return true; }
  return false;
}

/** WHICH item the highlighted row is, out of this container.
 *
 *  The key is checked because a host asking about a pile the crosshair
 *  has already left must get null rather than row 0 of whatever is
 *  under it now. The row -> item walk is the MODEL's (`hoverItemAt`,
 *  via `selectedRow`'s own bounds), the same walk `hoverLines` drew the
 *  rows with, so the row seen and the item moved cannot differ. */
function quickLootItemAt(key, items) {
  if (!_sel || _sel.key !== key) return null;
  return hoverItemAt(items, _sel.row);
}
