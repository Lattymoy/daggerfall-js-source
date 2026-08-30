// ═══════════════════════════════════════════════════════════════════
// U57 — THE OTHER SIDE OF THE PACK: which list is the remote one,
// what opening the window decides, and what closing it owes the
// world.
//
// U56 took DFU's TransferItem out of the classic window because a
// second screen needed the same rungs. This is the rest of that
// sentence: a transfer needs somewhere to transfer TO, and choosing
// that is its own small pile of DaggerfallInventoryWindow members -
// OnPush's default target, SetChooseOne, CheckWagonAccess, ShowWagon,
// WagonButton_OnMouseClick, OnPop - every one of which the enhanced
// pack's remote pane needs and none of which it should read twice.
//
// ── WHAT IS LAW HERE AND WHAT IS NOT ─────────────────────────────
//
// Where a button sits, what the pane looks like, whether the wagon is
// a tab or a toggle: not law, and not here. What IS: the ORDER of the
// remote target's three claims, the two refusals the wagon button can
// give and which comes first, the on-open arm that lands a dungeon
// player straight on their cart, and the fact that closing MINTS the
// session's drop pile.
//
// That last one is here for AUDIT B-C1's reason. Handing off to
// another window replaces the port's single overlay slot WITHOUT
// closing the inventory, so the port skipped both effects and a
// session drop was silently LOST - items gone from the bag and never
// on the ground. A screen that forgets this does not look broken; it
// looks like the player misremembered picking something up.
// ═══════════════════════════════════════════════════════════════════

/** ItemGroups.Transportation.Small_cart's template index. */
export const SMALL_CART_TEMPLATE = 93;
/** DungeonWagonAccessProximityCheck's radius (:1102). */
export const WAGON_ACCESS_DISTANCE = 5;
/** Internal_Strings "noWagon" (:1237). */
export const NO_WAGON_TEXT = "You don't own a wagon.";
/** key "exitTooFar" (:1239) - prose ours pending a string source. */
export const EXIT_TOO_FAR_TEXT = 'You are too far from the exit.';

/** Why the wagon did not open. Same shape as itemTransfer's REFUSAL
 *  so one renderer answers both, and separate from it because these
 *  are a BUTTON's refusals rather than a transfer's - DFU has them in
 *  different members and they refuse different things. */
export const WAGON_REFUSAL = Object.freeze({
  noWagon: { reason: 'noWagon', text: NO_WAGON_TEXT },
  exitTooFar: { reason: 'exitTooFar', text: EXIT_TOO_FAR_TEXT },
});

/** Items.Contains(Transportation, Small_cart) (:1236). The CART IS IN
 *  THE BAG, which is why AUDIT 24 ui matters: dropping it into its own
 *  wagon would lock the player out of the wagon now holding it, and
 *  itemTransfer's transport block is what stops that. */
export const hasCart = (items = []) =>
  (items ?? []).some((it) => it?.templateIndex === SMALL_CART_TEMPLATE);

/** ItemGroups.Transportation.Horse's template index. */
export const TRANSPORT_HORSE_TEMPLATE = 94;

/** PX21a: the same question for a mount. There was no law for this
 *  because nothing asked before - the travel law takes `hasHorse` as an
 *  OPTION its caller works out, and the pack had no place for a horse
 *  at all. One home for both, so the pack, the travel card and anything
 *  after them read the same answer. */
export const hasHorse = (items = []) =>
  (items ?? []).some((it) => it?.templateIndex === TRANSPORT_HORSE_TEMPLATE);

/** The ITEM behind either answer, for a window that wants to draw it -
 *  its name, its icon. Null when there is none. `kind` is 'mount' or
 *  'cart', the words the UI uses; the template indices stay here. */
export function transportItem(items = [], kind) {
  const template = kind === 'mount' ? TRANSPORT_HORSE_TEMPLATE : SMALL_CART_TEMPLATE;
  return (items ?? []).find((it) => it?.templateIndex === template) ?? null;
}

/**
 * What OPENING the window decides, before the player touches
 * anything. Pure: it reads the hook bag and answers, so a screen can
 * seed itself from this rather than re-deriving three flags.
 *
 * @returns {{mode:'remove'|'equip', usingWagon:boolean,
 *            allowDungeonWagonAccess:boolean, chooseOne:object|null}}
 */
export function openState(deps = {}) {
  const chooseOne = deps.chooseOne ?? null;
  // selectedActionMode: Remove for loot targets, Equip otherwise -
  // and a reward list is a Remove target too, because taking is the
  // only thing that list is for (SetChooseOne :259-264).
  let mode = deps.loot || chooseOne ? 'remove' : 'equip';
  // CheckWagonAccess (:1082-1097): the cart in the bag AND the player
  // within WAGON_ACCESS_DISTANCE of an exit door. Decided ON OPEN, so
  // walking away from the door mid-window does not revoke it.
  // NT3 (F161): CheckWagonAccess has TWO branches and only the first
  // selects Remove - the arm where the flag was PRE-SET by the
  // EXIT-DOOR PROMPT flow (:1084-1088; AUDIT 28 W2c landed that
  // producer: PlayerActivate's "access the wagon?" box at a dungeon
  // exit, whose Yes calls AllowDungeonWagonAccess() and opens the
  // inventory). Mere PROXIMITY (:1089-1096) only shows the wagon and
  // leaves the action mode at OnPush's default, so a plain F6 near the
  // exit with a cart still EQUIPS on a local click. A loot target
  // outranks the wagon show: the corpse you just opened is what you meant.
  if (deps.dungeon?.wagonPrompt) {
    return { mode: 'remove', usingWagon: true, allowDungeonWagonAccess: true, chooseOne };
  }
  const allowDungeonWagonAccess = !!(
    deps.dungeon?.inside && hasCart(deps.items?.() ?? []) && deps.dungeon?.nearExit?.()
  );
  let usingWagon = false;
  if (allowDungeonWagonAccess && !deps.loot) usingWagon = true;
  return { mode, usingWagon, allowDungeonWagonAccess, chooseOne };
}

/**
 * WHICH LIST IS THE REMOTE ONE, in DFU's order of claims. The port
 * derives it rather than storing it, so DFU's lastRemoteItems
 * save/restore around ShowWagon collapses into this read.
 *
 * The order is the law: the WAGON outranks everything while it is
 * showing (that is what the toggle means), a choose-one reward list
 * outranks the ground, and OnPush's default target is the session's
 * dropped items when no container opened the window.
 */
export function remoteTarget(deps = {}, state = {}) {
  if (state.usingWagon) return deps.wagonItems?.() ?? state.wagonLocal ?? [];
  if (state.chooseOne) return state.chooseOne.items;
  return deps.loot ? deps.loot.items() : state.dropped;
}

/**
 * WagonButton_OnMouseClick's ladder (:1234-1243), minus its sound -
 * which is the CALLER's, once, whichever arm ran. AUDIT 24 ui: the
 * port used to play a second click inside the toggle arm, so the
 * wagon button fired two overlapping ButtonClicks where every other
 * button fires one.
 *
 * @returns {{ok:true, usingWagon:boolean}|{ok:false, refusal:object}}
 */
export function planWagonToggle(deps = {}, state = {}) {
  if (!hasCart(deps.items?.() ?? [])) return { ok: false, refusal: WAGON_REFUSAL.noWagon };
  // The proximity check only speaks INSIDE a dungeon; outdoors the
  // cart is simply there.
  if (deps.dungeon?.inside && !state.allowDungeonWagonAccess) {
    return { ok: false, refusal: WAGON_REFUSAL.exitTooFar };
  }
  return { ok: true, usingWagon: !state.usingWagon };
}

/**
 * OnPop, the part that is not presentation: the session's dropped
 * items mint their world pile and the container releases. AUDIT B-C1
 * is the whole reason this is a function rather than two lines at the
 * end of a close handler - it has to run on a HAND-OFF too, where the
 * window is being replaced rather than closed.
 */
export function closeSession(deps = {}, state = {}) {
  if (state.dropped?.length) deps.onDrop?.(state.dropped);
  deps.onClose?.();
}
