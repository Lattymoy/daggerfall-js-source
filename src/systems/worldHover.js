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

/** The lines a pile shows: name, and a count when a stack. Pure. */
export function hoverLines(items, max = HOVER_MAX) {
  const rows = (items ?? []).filter(Boolean).map((it) => ({
    name: itemNameParts(it).name || 'Something',   // RF6: the long name's name part - a potion its %po, a soul trap its soul; LR1: unidentified is the bare template (the resolver already answers a template-less item its own name)
    stack: (it.stackCount ?? 1) > 1 ? it.stackCount : 0,
    rarity: rarityAttr(it),   // LR1: null with the switch off or for Common
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
 * own ladder (vendor .cs:225-257). The port keeps the law and drops the
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
 *   kind   - 'name' (a title and up to two sub-lines) or 'items'
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
    // own behaviour (an empty `ret` leaves the tooltip down, .cs:265)
    // and what makes a family a host stands but cannot name VISIBLE
    // rather than papered over.
    if (!named?.title) return null;
    const { shown, rest, empty } = hoverLines(contents?.(key) ?? null);
    return frame(key, 'items', named.title, named.subs ?? [], shown, rest, empty);
  }
  const named = name?.(key, hit) ?? null;
  // A key the ladder has no word for draws NOTHING. That is the mod's
  // own behaviour (an empty `ret` leaves the tooltip down, .cs:265) and
  // it is also what keeps an unported family from labelling itself with
  // its own key string.
  if (!named?.title) return null;
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
export function frameSignature(f) {
  if (!f) return null;
  const rows = f.rows.map((r) => `${r.name}\u0002${r.stack}\u0002${r.rarity ?? ''}`).join('\u001f');
  return `${f.key}|${f.kind}|${f.title}|${f.subs.join('\u001f')}|${rows}|${f.rest}|${f.empty ? 'e' : ''}`;
}
