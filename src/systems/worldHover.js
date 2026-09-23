// WORLD-HOVER - WHAT THE CROSSHAIR IS ON, AS A RECORD.
//
// Mac handed over World Tooltips 1.1 (jefetienne, MIT, vendored whole
// under vendor/world-tooltips/) with two conditions of his own: an
// enhanced skin for it rather than the mod's Daggerfall tooltip panel,
// and a merge with the loot plaque the port already had (PX21c,
// ui/lootHover.js). This is the model half of both.
//
// THE ONE LAW THIS MODULE EXISTS TO KEEP. The plaque and the button
// must never disagree. PX21c said it first, for three loot keys:
// "It follows what the crosshair already resolves - the same
// activation pick the take uses - so it can never disagree with what
// pressing the button would open." The merge is that sentence extended
// to every key the activation ladder can hit, and the way it is kept is
// that there is exactly ONE race: `player/activationRace.js`, which the
// press already walks. The race decides WHO WON. This module decides
// what the winner is CALLED. Two modules resolving one ray would be the
// FONT1 two-faces bug in a new coat.
//
// PURE, AND NO DOM. Everything here is a function of its arguments: it
// imports no document, no skin, no host. The frame it answers is handed
// to ui/worldPlaque.js, which owns the node, the dress and the skin
// gate - the ENH-NOTICE3 idiom in as many words ("the model decides
// WHICH MODEL, the draw decides WHICH FACE"), and the reason AUDIT 39's
// skin gate can stay above ensure() where it belongs.
import { rarityAttr } from '../systems/lootRarity.js';   // LR1: a pile's rows wear their tier
import { itemNameParts } from '../systems/itemInfo.js';   // RF6: ResolveItemLongName's name part (LR1: an unidentified item reads as its template on the plaque too)

/** How many lines before the plaque says "and N more" instead. A pile
 *  is a glance, not a list to read; DFU's own loot windows scroll. */
export const HOVER_MAX = 6;

/**
 * THE KEYS THAT ITEMISE. Everything else the ladder can name gets its
 * name and nothing more - which is the mod's whole answer, and the
 * port's own loot rows are the departure on top of it (Ledger A).
 *
 * These are prefixes of the activation keys the hosts' own
 * `*Targets()` producers mint, never strings written out by hand here:
 * `loot:` and `corpse:` are the dungeon's RDB piles and its bodies,
 * `droppedLoot:` is what a player left on the floor, and `foeCorpse:`
 * and `guardCorpse:` are the two above-ground bodies. A key whose
 * prefix is not here draws as a name.
 */
export const ITEMISED_KEYS = Object.freeze(['loot:', 'corpse:', 'droppedLoot:', 'foeCorpse:', 'guardCorpse:']);

/** Does this key open a list, or only a name? */
export const keyItemises = (key) => typeof key === 'string' && ITEMISED_KEYS.some((p) => key.startsWith(p));

/**
 * THE ITEMS A PILE'S ROWS ARE, in the order the rows are drawn.
 *
 * QUICK-LOOT B1: extracted so the walk has ONE spelling. What the
 * player sees is not the raw array - holes are filtered out and the
 * tail past `HOVER_MAX` is a count, not a row - so a take that indexed
 * `items[row]` would move the wrong thing the moment a pack had a hole
 * or a seventh entry. The row the player SEES and the item the take
 * MOVES are found by the same walk, which is the law `corpseLens`
 * keeps for the bodies and `liveFoeTargets`/`liveFoeFor` for the live
 * foes: two readers, one sweep.
 */
export const hoverItems = (items) => (items ?? []).filter(Boolean);

/** WHICH item a visible row is, or null past the end. `row` is an
 *  index into what is DRAWN, so it is bounded by `max` and not by the
 *  pile's length - row 6 of a nine-item pile is the "and 3 more" tail,
 *  which names nothing and takes nothing. */
export function hoverItemAt(items, row, max = HOVER_MAX) {
  if (!Number.isInteger(row) || row < 0 || row >= max) return null;
  return hoverItems(items)[row] ?? null;
}

/** The lines a pile shows: name, a count when a stack, and the ITEM
 *  itself. Pure.
 *
 *  QUICK-LOOT-STATS: the item rides the row so the plaque can READ the
 *  highlighted one's stats without a second walk from row index to
 *  item - `hoverItemAt` already does that walk for the take, and two
 *  walks is two chances for the row seen and the row described to
 *  disagree. It is a READ handle and nothing more: the take still goes
 *  through the container's own loot hooks (quickLoot.js says why), so
 *  the boundary that matters - who may MUTATE a container - is
 *  untouched. `frameSignature` deliberately does not fold it in: a
 *  reference is not something a player can see change. */
export function hoverLines(items, max = HOVER_MAX) {
  const rows = hoverItems(items).map((it) => ({
    name: itemNameParts(it).name || 'Something',   // RF6: the long name's name part - a potion its %po, a soul trap its soul; LR1: unidentified is the bare template (the resolver already answers a template-less item its own name)
    stack: (it.stackCount ?? 1) > 1 ? it.stackCount : 0,
    rarity: rarityAttr(it),   // LR1: null with the switch off or for Common
    item: it,
  }));
  const shown = rows.slice(0, max);
  const rest = rows.length - shown.length;
  return { shown, rest, empty: rows.length === 0 };
}

/**
 * ONE CONSTRUCTION SEAM, and its composition law.
 *
 * A host's activation target list was built inline wherever it was
 * needed - the dungeon's in two places against one context, and the
 * hover would have been a third. That is the failure AUDIT 17i names:
 * a family added later is seen by whichever builder its author
 * happened to be looking at, and the others go on answering an older
 * world. The rule is that a scene composes its list ONCE and the press,
 * every other ladder and the plaque all read that one.
 *
 * `own` is what the scene itself owns. `producers` are the families
 * its HOST registered - and registering rather than passing an options
 * bag is the point: a host that cannot ANSWER a family must not stand
 * it, because a target nobody serves still wins the pick and eats the
 * press in silence. The standalone `?dungeon` door registers none of
 * the modal host's three for exactly that reason.
 *
 * Pure, so the law can be driven rather than read: a registry that
 * drops a producer or appends one twice passes every source sweep ever
 * written.
 */
export function composeActivationTargets(own, producers) {
  const targets = [...(own ?? [])];
  for (const fn of producers ?? []) {
    const t = fn?.();
    if (t?.length) targets.push(...t);
  }
  return targets;
}

/**
 * THE NAMER LADDER - the mod's own extension API, in the port's shape.
 *
 * World Tooltips lets other mods add words through a
 * `Map<float, List<Func<RaycastHit, string>>>` keyed by reach, walked
 * in insertion order, FIRST NON-EMPTY WINS, and run before the mod's
 * own ladder (vendor .cs:228-257). The port keeps the law and drops the
 * key: reach is already decided by the pick, so a namer only has to say
 * whether it knows this key.
 *
 * Insertion order is the priority, and the first answer with a title
 * wins. That is what lets a host stand the port's OWN world objects -
 * dropped torches, camps, hearths, water, the EOTB cart - beside the
 * mod's ladder rather than wedged into it.
 */
export function composeNamer(namers) {
  return (key, hit) => {
    for (const fn of namers ?? []) {
      const r = fn?.(key, hit);
      if (r?.title) return r;
    }
    return null;
  };
}

/**
 * THE SAME LADDER, FOR WHAT A CONTAINER HOLDS.
 *
 * AUDIT-WH H3. An itemised key draws a LIST, and the list comes from
 * whichever of the host's pools stood that key - the dropped piles,
 * the encounter pool's bodies, the watch's. Both above-ground hosts
 * wrote that routing out as one hand-built ternary that knew about
 * `droppedLoot:` alone, so the two corpse prefixes - itemised since the
 * first slice - fell through to null and every body outdoors read
 * "Empty" over a full pack.
 *
 * It is `composeNamer`'s law with a different predicate: FIRST NON-NULL
 * WINS, insertion order is priority. An EMPTY body answers `[]` and
 * stops the walk (a body that holds nothing is an answer); one this
 * reader does not stand answers null and the next reader is asked.
 *
 * The key is always a string here - `resolveHover` only reaches for
 * contents behind `keyItemises`, which refuses anything else - so a
 * reader may use `startsWith` without the guard a NAMER needs.
 */
export function composeContents(readers) {
  return (key) => {
    for (const fn of readers ?? []) {
      const r = fn?.(key);
      if (r) return r;
    }
    return null;
  };
}

/**
 * THE FRAME. One record, and the draw paints exactly what is in it.
 *
 *   key    - the winning pick's key; the identity the guard compares
 *   kind   - 'name' (a title and up to two sub-lines), 'items', or
 *            'actions' (ACT-MENU: the verbs a player or my horse and
 *            wagon take, as rows `{name, id}` the wheel lights and the
 *            activate key presses - the loot list's own selection)
 *   title  - the line under the reticle
 *   subs   - the mod's own extra rows. It carries them as `\r`-joined
 *            text (a lock level, a closed-shop sentence); the port
 *            carries them as an array, because a DOM line is a node and
 *            splitting a string back apart at the draw would be a
 *            second parse of something the namer already knew.
 *   rows / rest / empty - hoverLines' answer, on an itemised key only
 */
const frame = (key, kind, title, subs, rows = [], rest = 0, empty = false) =>
  ({ key, kind, title, subs, rows, rest, empty });

/**
 * PICK + NAMER -> FRAME, or null for "the crosshair is on nothing".
 *
 * `hit` is `pickActivatableHit`'s answer, unmodified - including its
 * `reach`, which this function applies itself. AUDIT 65 MC-2 is why:
 * the pick reaches as far as the RAY does, so a plaque that trusted the
 * pick alone would name a chest across the room that the player cannot
 * open, and the one law above would be broken on its first frame.
 *
 * `name(key, hit)` answers the title and sub-lines for a key - the
 * mod's ladder, per host. `contents(key)` answers a container's items,
 * read-only. Both are the host's; neither is reached for a key the
 * reach gate already refused.
 */
export function resolveHover(hit, { name = null, contents = null } = {}) {
  if (!hit) return null;
  // The reach gate, before anything is named or read. DFU's HUD says
  // nothing about a pile until you can actually activate it.
  if (!(hit.distance <= hit.reach)) return null;
  const key = hit.key;
  if (key == null) return null;
  if (keyItemises(key)) {
    const named = name?.(key, hit) ?? null;
    // AUDIT-WH M5: AN ITEMISED KEY WITH NO WORD DRAWS NOTHING EITHER.
    // This used to fall back to the literal 'Loot' - a word World
    // Tooltips does not contain - and that fallback did not fail
    // loudly, it quietly said something else: outdoors nothing
    // answered `droppedLoot:` for the whole first slice, so a pile you
    // dropped in the street read "Loot" while the same pile indoors
    // read the mod's "Loot Pile" or the one item's long name. One
    // surface, two vocabularies, and no gate could see it.
    //
    // The rule is now the SAME rule the named branch below states: a
    // key the ladder has no word for draws nothing, which is the mod's
    // own behaviour (an empty `ret` leaves the tooltip down, .cs:169-172)
    // and what makes a family a host stands but cannot name VISIBLE
    // rather than papered over.
    if (!named?.title) return null;
    const { shown, rest, empty } = hoverLines(contents?.(key) ?? null);
    return frame(key, 'items', named.title, named.subs ?? [], shown, rest, empty);
  }
  const named = name?.(key, hit) ?? null;
  // A key the ladder has no word for draws NOTHING. That is the mod's
  // own behaviour (an empty `ret` leaves the tooltip down, .cs:169-172) and
  // it is also what keeps an unported family from labelling itself with
  // its own key string.
  if (!named?.title) return null;
  // ACT-MENU: a namer that answers verbs gets them listed - the same rows, the same fold and the same highlight as a
  // pile's items (nextSelection reads `rows` whatever they hold), so the wheel moves through a player's or a horse's
  // options exactly as it moves through a chest
  // AUDIT DISC7: a REFUSED verb is listed too, its reason in its own words (the F-card's rows), so what the card said
  // is still said - and `name` carries the reason, so the painted text and the repaint guard see the same thing.
  // `actionsUnlit` (a player's list) starts with nothing lit: a plain click on a player is not a request sent.
  const acts = Array.isArray(named.actions) ? named.actions.filter((a) => a?.id != null && a.label) : [];
  if (acts.length) {
    const f = frame(key, 'actions', named.title, named.subs ?? [], acts.map((a) => ({
      name: a.disabled ? `${a.label} (${a.why || 'not now'})` : a.label, id: a.id, disabled: !!a.disabled, stack: 0, rarity: null, item: null,
    })));
    if (named.actionsUnlit) f.startUnlit = true;
    return f;
  }
  return frame(key, 'name', named.title, named.subs ?? []);
}

/**
 * The rendered signature of a frame - what "changed" MEANS.
 *
 * PX21c guarded on the key alone (`if (key === shownKey) return;`),
 * which cannot see a list that changed under a constant key. That was
 * safe by accident and not by design: taking from a pile required
 * opening a window, and the window unmounts the plaque's driver. The
 * moment anything can change a container's contents while it is being
 * looked at - a quest machine writing into it, the room's own word
 * arriving online (WORLD4), or quick loot, which is the next arc - the
 * guard shows a stale list under a live key.
 *
 * So the guard compares what would be PAINTED. One node, rewritten only
 * on change, which is PX21c's law intact and now honest about its term.
 */
/**
 * ── THE HIGHLIGHT (QUICK-LOOT B1) ───────────────────────────────
 *
 * QuickLoot's selection, as a FOLD rather than a slot: given what was
 * selected last frame, the frame that just resolved, and a nudge from
 * the wheel, this answers what is selected now. The state lives with
 * the host that owns the frame loop; the LAW lives here, where it can
 * be driven without a document, a host or an input event.
 *
 * Four rules, and every one of them is a case a slot would get wrong:
 *
 *   - A frame with no rows selects NOTHING. A door, a person, an empty
 *     body: there is no list, so there is no highlight, and the take
 *     keys have nothing to act on.
 *   - A NEW key selects the top row. Look away and back, look at the
 *     next chest along: the highlight starts at the top, as the list
 *     does. It does not remember where you were in a different pile.
 *   - The same key keeps its row, moved by the nudge and CLAMPED. The
 *     wheel does not wrap - QuickLoot's does not, and a wrapping
 *     highlight under a crosshair is how you take the wrong thing.
 *   - A list that SHRANK under the selection pulls it back to the last
 *     row. This is the case the whole fold exists for: take the bottom
 *     row of three and the list is two long while the selection still
 *     says 2, so the next take would move nothing and the player would
 *     press again harder.
 */
export function nextSelection(prev, frame, delta = 0) {
  const rows = frame?.rows?.length ?? 0;
  if (!frame || !rows) return null;
  const d = Number.isFinite(delta) ? Math.trunc(delta) : 0;
  // AUDIT DISC7 A2: a list that starts UNLIT (a player's verbs) opens at -1 and the wheel steps onto it
  const floor = frame.startUnlit ? -1 : 0;
  // AUDIT DISC7 A3: a row with an id keeps ITS row when the list changes under it (a request sent drops a verb and
  // the one below slid into the lit slot - the next click pressed a verb nobody chose); a row gone clamps as before
  let row = floor;   // a new key starts at the top (or unlit) whatever the nudge
  if (prev && prev.key === frame.key) {
    const at = prev.id != null ? frame.rows.findIndex((r) => r.id === prev.id) : -1;
    row = Math.max(floor, Math.min(rows - 1, (at >= 0 ? at : prev.row) + d));
  }
  const id = row >= 0 ? frame.rows[row]?.id : undefined;
  return id != null ? { key: frame.key, row, id } : { key: frame.key, row };
}

/** The selected row, or -1 when this frame is not the selection's.
 *  Read by the draw and by the take, so neither has to re-derive the
 *  "is this still the same pile" test and get it subtly different. */
export function selectedRow(sel, frame) {
  if (!sel || !frame || sel.key !== frame.key) return -1;
  const rows = frame.rows?.length ?? 0;
  return sel.row >= 0 && sel.row < rows ? sel.row : -1;
}

export function frameSignature(f) {
  if (!f) return null;
  const rows = f.rows.map((r) => `${r.name}\u0002${r.stack}\u0002${r.rarity ?? ''}`).join('\u001f');
  return `${f.key}|${f.kind}|${f.title}|${f.subs.join('\u001f')}|${rows}|${f.rest}|${f.empty ? 'e' : ''}`;
}
