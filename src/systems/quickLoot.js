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
import { planTake, applyTransfer } from './itemTransfer.js';   // QL-WEIGHT1: the window's own plan and move - the carry gate, the summoned and quest guards, the split, the gold door
import { isMap } from './useItem.js';   // the map the window USES rather than takes (F156) - left for the window here
import { racialSuppressInventory } from './lycanthropy.js';   // DISC10-E L3: the beast takes nothing into a pack it cannot open

/** The player's own switch (features.js, `quick-loot`). Off is
 *  Daggerfall's loot exactly: the activate key opens the window it has
 *  always opened and the plaque stays the readout Arc A shipped. */
export const quickLootOn = () => !!getPref('quickLoot');

/** What the HUD says when a row goes into the pack. The name is the
 *  row's own word, so the line and the row the player was looking at
 *  cannot say different things about one item. */
export const tookItemText = (item) => `You take the ${itemNameParts(item).name || 'item'}.`;

/**
 * QL-WEIGHT1 (2026-09-23, Satranath on Discord: "The quick loot system
 * lets you pick up items even if you are overencumbered. Applies only to
 * quick loot - vanilla loot interaction still gives the appropriate error
 * that you are carrying too much"): THE TAKE IS THE WINDOW'S TAKE.
 *
 * Quick loot used to move a row with `takeOneInto` - DoTransferItem's
 * first statement and nothing before it - so it had no CanCarryAmount
 * (DaggerfallInventoryWindow.cs:1414-1422), no summoned guard, no quest
 * arm and no split. The window plans every take through `planTake`
 * (systems/itemTransfer.js) and performs it with `applyTransfer`, and
 * so does this now: ONE plan for a row whichever door it leaves by, so
 * the two cannot disagree about what the player can carry. A refusal
 * is SAID where the window would box it (the mid-screen line the take
 * already speaks through), and the press is HANDLED - `QUICK_LOOT_REFUSED`
 * is truthy and not an item, so a host does not open the window over a
 * pack that just refused the row. A partial fit takes what fits (the
 * window's Enter on the split box) and leaves the rest on the pile.
 *
 * A map is the one row the window does not TAKE but USES (F156: reading
 * it marks the place); quick loot has no reader, so a map is left for
 * the window - null, "open the window", as for every row it cannot serve.
 */
export const QUICK_LOOT_REFUSED = Object.freeze({ refused: true });

/** One row through the window's plan. Answers the record that arrived
 *  (the split half on a partial fit, the row itself for gold - which
 *  `applyTransfer` spends into the counter and answers null for),
 *  `{ refusal }` when the plan says no, or null for a row the plan
 *  would USE rather than take. */
function takeThrough(playerEntity, items, item, getQuest) {
  if (isMap(item)) return null;
  const plan = planTake(item, { bag: playerEntity.items ?? [], entity: playerEntity, getQuest });
  if (!plan.ok) return { refusal: plan.refusal };
  return applyTransfer(item, plan, items, (playerEntity.items ??= []), { entity: playerEntity, toPlayer: true }) ?? item;
}

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
/** ACT-MENU: the lit frame's verb ids when it is an 'actions' frame (a player, my horse or wagon), else null - the
 *  highlight is the same fold, and this says which kind of list it is lighting and what each row does. */
let _actionIds = null;
/** AUDIT DISC7: the key the last fold listed verbs for - `plaqueLightFirst` lights row 0 of it (F on an unlit player). */
let _lastKey = null;
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
  // ACT-MENU: a list of verbs is not quick loot's - it owns the wheel whatever the loot switch says (the switch is
  // about TAKING from the plaque; the verbs have no other door where the plaque stands)
  if (!_sel || !clicks || !(_actionIds || quickLootOn())) return false;
  // AUDIT DISC7 A7: a single verb already lit is no choice - the wheel stays the camera's
  if (_actionIds && _actionIds.length <= 1 && _sel.row >= 0) return false;
  _nudge += clicks;
  return true;
}

/** The per-frame fold, called by the one seam that produces the frame.
 *  The nudge is spent whether or not it moved anything, so a click
 *  spent looking at a door does not arrive later at a chest. */
export function foldQuickLoot(frame) {
  const verbs = frame?.kind === 'actions';
  _sel = (verbs || quickLootOn()) ? nextSelection(_sel, frame, _nudge) : null;
  _actionIds = verbs && _sel ? frame.rows.map((r) => r.id) : null;
  _lastKey = _sel ? frame.key : null;
  _nudge = 0;
  return _sel;
}

/** ACT-MENU: the verb the plaque has lit over `key`, or null - asked by the press that lands on that key, so a
 *  click on a horse the plaque has since left runs the mod's mode as it always did. */
export function plaqueActionFor(key) {
  if (!_actionIds || !_sel || key == null || _sel.key !== key) return null;
  return _actionIds[_sel.row] ?? null;
}

/** AUDIT DISC7 A2: F on a player whose list is unlit lights its first row - the keyboard's way onto the list, as the
 *  wheel's first notch is. True when it lit something. */
export function plaqueLightFirst(key) {
  if (!_actionIds || !_sel || key == null || _lastKey !== key || _sel.key !== key || _sel.row >= 0 || !_actionIds.length) return false;
  _sel = { key, row: 0, id: _actionIds[0] };
  return true;
}

/** ACT-MENU: the lit verb and whose it is, for a host whose press has no pick of its own (a player: the plaque's
 *  race is the only one that names them). */
export const plaqueActionSelection = () => (_actionIds && _sel ? { key: _sel.key, id: _sel.row >= 0 ? (_actionIds[_sel.row] ?? null) : null } : null);

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
export function resetQuickLoot() { _sel = null; _nudge = 0; _pending = null; _actionIds = null; _lastKey = null; }

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
 *
 * AUDIT QL-WEIGHT1: `getQuest` is the host's QUEST RESOLVER - the one it
 * hands the inventory window (`(uid) => questBridge?.machine.getQuest(uid)`).
 * The plan's quest arm (`questTransferRefused`) refuses a quest item it
 * cannot resolve, as DFU does (:1489) - and no loot hooks carry a
 * resolver, so QL-WEIGHT1's first cut refused EVERY quest item through
 * this door and swallowed the press: a "bring back the ring" corpse
 * said "You cannot remove this item." and never opened. The resolver
 * rides beside the hooks, from the host, so the take and the window
 * read the same quest.
 */
export function quickLootTake(key, hooks, playerEntity, say = () => {}, { getQuest = null } = {}) {
  const how = _pending;
  _pending = null;   // spent on the press it was armed for, whatever that press finds
  if (how === 'open') return null;   // J: the player asked for the window
  if (!quickLootOn() || !hooks || !playerEntity) return null;
  // DISC10-E L3: a transformed lycanthrope's pack is refused
  // (DaggerfallInventoryWindow.cs:583-587). Null is "open the window" -
  // and the window's door says the line and opens nothing.
  if (racialSuppressInventory(playerEntity)) return null;
  const items = hooks.items?.();
  if (!Array.isArray(items)) return null;
  if (how === 'all') {
    // P: the lot, through the same one-item door - so the carry gate and
    // the gold rule are the window's here too, and a caller cannot get a
    // bulk take that spells them differently. `[...items]` because the
    // door splices the source, so iterating it live would skip every
    // second row - the same reason `takeCorpseLoot`'s loop copies first.
    // QL-WEIGHT1: what fits is taken and counted; the first row that does
    // not is the line said when nothing fitted at all, and the rows left
    // stay on the pile for the window or the next press.
    let n = 0, refusal = null;
    for (const it of [...items]) {
      const got = takeThrough(playerEntity, items, it, getQuest);
      if (got?.refusal) { refusal ??= got.refusal; continue; }
      if (got) n += 1;
    }
    // AUDIT QL-WEIGHT1: a count with rows LEFT says why they stayed, on the same line - "You take 2 items." over a
    // pile that still holds three read as a door that stuck, with the reason unsaid
    if (n) say((n === 1 ? 'You take 1 item.' : `You take ${n} items.`) + (refusal?.text ? ` ${refusal.text}` : ''));   // AUDIT: a refusal with no line (none the loop can meet today) adds nothing
    else if (refusal) { say(refusal.text); return QUICK_LOOT_REFUSED; }
    return n ? items : null;
  }
  const item = quickLootItemAt(key, items);
  if (!item) return null;
  const got = takeThrough(playerEntity, items, item, getQuest);
  if (got?.refusal) { say(got.refusal.text); return QUICK_LOOT_REFUSED; }
  if (got) say(tookItemText(got));
  return got;
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
  if (!quickLootOn() || !_sel || _actionIds) return false;   // ACT-MENU: P and J take from a pile, never from a list of verbs
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
  if (!_sel || _actionIds || _sel.key !== key) return null;
  return hoverItemAt(items, _sel.row);
}
