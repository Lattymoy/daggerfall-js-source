// @ts-check
// BOAT-MENU (2026-09-30, Mac: "make the boat interaction like the loot menu. Being able to pick up, view storage,
// mount, all from a simple menu and button press") - THE LAW of a boat's verbs, pure.
//
// Come Sail Away answers a press on one of its seven boxes (systems/comeSailAway.js activate) - the helm's box takes
// the helm, or packs the boat in Steal mode; the ladder's boards; the chest's opens the cargo; the flag's and the
// compass's read the status and the position; the variant box picks a style - and the hull between them answers
// nothing. The port's ACT-MENU (systems/worldHover.js) lists a namer's verbs on the plaque under the crosshair, the
// wheel lighting one and the activate key pressing it, as a horse's and a wagon's already do (horseCartLaw.js
// hccActionRows). Here is what a boat of mine lists: every box it carries, anywhere on it, as a row - pressed
// through the mod's own activation (its 3.2 reach and its refusals) on that box.
//
//  - The rows are the boxes the boat carries (boatTriggers), so a hull without a chest lists no storage.
//  - The lit row starts on the box under the crosshair (boatMenuStart): a press at the helm's box takes the helm and
//    at the chest opens it, exactly as before the menu - the direct hot spots stand. On the hull the list starts unlit
//    (AUDIT BOAT-MENU C4: a plain click on the deck is no request), the wheel's first step lighting its top row. None
//    at a helm (C1).
//    Steal mode at the helm's box lights "Pick up", as the mod's Steal press packs. A door lists nothing and turns
//    over as it did (boatMenuStart's -1).
//  - A row the mod would refuse is listed with its reason (the plaque's refused rows, AUDIT DISC7 A4) and the
//    press says the mod's own words (boatMenuRefusal).
//  - SHIP-PACK (2026-10-01): every hull lists "Pick up" - a ship's refused while her deed is not in the pack.
//  - HOLD-WEIGHT (FIELD BUGS 2026-10-05c): and any boat's while her parts, her hold on them, would outweigh the bearer's most.

/** The verbs, by row id. */
export const BOAT_VERB = Object.freeze({
  helm: 'helm', board: 'board', cargo: 'cargo', pack: 'pack', variant: 'variant', status: 'status', position: 'position',
  crew: 'crew', orders: 'orders',   // SHIP-CREW: the port's own - her crew's card, her captain's orders (no box of the mod's)
  companions: 'companions',   // CREW-COMPANIONS: her hands to take ashore, or send back aboard
  cabin: 'cabin', door: 'door',   // SAILING-CABINS: the cabin and the existing animated door
});
/** The rows' words. */
export const BOAT_MENU_TEXT = Object.freeze({
  helm: 'Take the helm', leave: 'Leave the helm', board: 'Board', cargo: 'Open storage', pack: 'Pick up',
  variant: 'Change style', status: 'Status', position: 'Position', crew: 'Crew', orders: 'Give orders', companions: 'Companions',
  cabin: 'Enter cabin', door: 'Open / close door',
});
/** Why a row is refused - short, for the plaque's "(why)". */
export const BOAT_MENU_WHY = Object.freeze({
  driving: 'at her helm', passengers: 'passengers aboard', moored: 'a deed ship stays afloat', sailing: 'not at the helm',
  noDeed: 'her deed is not in your pack',   // SHIP-PACK: a ship is picked up with her deed (comeSailAway.js PackBoat)
  tooHeavy: 'her hold is too heavy',   // HOLD-WEIGHT: parts no take could lift again (comeSailAway.js partsTooHeavy)
});

/**
 * Each verb's box and the interaction mode it is pressed in (null: the player's own mode, as the box's press was).
 * @type {Readonly<Record<string, { box: string, mode: string|null }>>}
 */
export const BOAT_VERB_BOX = Object.freeze({
  helm: { box: 'drive', mode: 'grab' }, pack: { box: 'drive', mode: 'steal' }, board: { box: 'board', mode: null },
  cargo: { box: 'cargo', mode: null }, variant: { box: 'variant', mode: null }, status: { box: 'status', mode: null },
  position: { box: 'position', mode: null },
  door: { box: 'door', mode: null },
});

/**
 * The boxes a boat carries: box name -> its trigger nodes, walked off the boat's root (`modelOf` names a node's box
 * model id, `models` is TRIGGER_MODEL).
 * @param {any} root
 * @param {(name: string) => number|null} modelOf
 * @param {Readonly<Record<string, number>>} models
 * @returns {Map<string, any[]>}
 */
export function boatTriggers(root, modelOf, models) {
  const byId = new Map(Object.entries(models).map(([k, v]) => [v, k]));
  const out = new Map();
  const stack = root ? [root] : [];
  while (stack.length) {
    const n = stack.pop();
    const id = modelOf(n?.name);
    const box = id != null ? byId.get(id) : null;
    if (box) { if (!out.has(box)) out.set(box, []); out.get(box).push(n); }
    for (const c of n?.children ?? []) stack.push(c);
  }
  return out;
}

/**
 * A boat of mine's rows, in the plaque's shape ({id, label, disabled, why}).
 * @param {{ boxes: Map<string, any[]>|Set<string>, packable?: boolean, sailingThis?: boolean, sailing?: boolean,
 *   aboard?: boolean, passengers?: number, variants?: boolean, naval?: boolean, crewed?: boolean, companions?: boolean,
 *   noDeed?: boolean, tooHeavy?: boolean, cabin?: boolean, cabinWhy?: string|null }} s
 */
export function boatMenuRows(s) {
  const has = (b) => s.boxes.has(b);
  const rows = [];
  if (has('drive')) rows.push({ id: BOAT_VERB.helm, label: s.sailingThis ? BOAT_MENU_TEXT.leave : BOAT_MENU_TEXT.helm });
  if (has('board') && !s.aboard && !s.sailingThis) rows.push({ id: BOAT_VERB.board, label: BOAT_MENU_TEXT.board });
  if (has('cargo')) rows.push({ id: BOAT_VERB.cargo, label: BOAT_MENU_TEXT.cargo });
  if (has('door') && s.cabin) {
    rows.push({ id: BOAT_VERB.cabin, label: BOAT_MENU_TEXT.cabin, ...(s.cabinWhy ? { disabled: true, why: s.cabinWhy } : {}) });
    rows.push({ id: BOAT_VERB.door, label: BOAT_MENU_TEXT.door });
  }
  if (has('drive')) {
    const why = !s.packable ? BOAT_MENU_WHY.moored : s.sailingThis ? BOAT_MENU_WHY.driving : (s.passengers ?? 0) > 0 ? BOAT_MENU_WHY.passengers
      : s.noDeed ? BOAT_MENU_WHY.noDeed   // SHIP-PACK: a ship whose deed is not in the pack (the runtime's deedMissing)
        : s.tooHeavy ? BOAT_MENU_WHY.tooHeavy : null;   // HOLD-WEIGHT: her parts heavier than the bearer's most (the runtime's partsTooHeavy)
    rows.push(why ? { id: BOAT_VERB.pack, label: BOAT_MENU_TEXT.pack, disabled: true, why } : { id: BOAT_VERB.pack, label: BOAT_MENU_TEXT.pack });
  }
  if (has('variant') && s.variants) rows.push(s.sailing ? { id: BOAT_VERB.variant, label: BOAT_MENU_TEXT.variant, disabled: true, why: BOAT_MENU_WHY.sailing } : { id: BOAT_VERB.variant, label: BOAT_MENU_TEXT.variant });
  if (has('status')) rows.push({ id: BOAT_VERB.status, label: BOAT_MENU_TEXT.status });
  if (has('position')) rows.push({ id: BOAT_VERB.position, label: BOAT_MENU_TEXT.position });
  // SHIP-CREW: with the naval arc on, her crew's card (a crewed boat's) and her orders - CREW-COMPANIONS: and her hands ashore
  if (s.naval) {
    if (s.crewed) rows.push({ id: BOAT_VERB.crew, label: BOAT_MENU_TEXT.crew });
    rows.push({ id: BOAT_VERB.orders, label: BOAT_MENU_TEXT.orders });
    if (s.crewed && s.companions !== false) rows.push({ id: BOAT_VERB.companions, label: BOAT_MENU_TEXT.companions });   // CREW-COMPANIONS - AUDIT CC-A9: not on a boat with no deed number (`companions` false)
  }
  return rows;
}

/**
 * The row lit first: the verb of the box under the crosshair (Steal mode at the helm's box: the pack); on the hull the
 * top row. -1 where the box keeps its own press and lists nothing: a door (it turns over where it hangs), or a box
 * whose verb this boat does not list (a ship's variant box with no styles - the mod's own "no variants" says so).
 * @param {string|null} box   the box aimed at (null: the hull)
 * @param {{id: string}[]} rows
 * @param {string} [mode]     the player's interaction mode
 */
export function boatMenuStart(box, rows, mode) {
  if (box == null) return 0;
  if (box === 'door' && rows.some((r) => r.id === BOAT_VERB.cabin)) return rows.findIndex((r) => r.id === BOAT_VERB.cabin);
  const verb = box === 'drive' ? (mode === 'steal' ? BOAT_VERB.pack : BOAT_VERB.helm) : box;
  return rows.findIndex((r) => r.id === verb);
}

/** A refused row's press, in the mod's own words where it has them. */
export const boatMenuRefusal = (why) => (why === BOAT_MENU_WHY.driving ? 'You cannot pack a boat you are driving!'
  : why === BOAT_MENU_WHY.passengers ? 'You cannot pack a boat with passengers aboard!'
    : why === BOAT_MENU_WHY.moored ? 'A ship from a deed cannot be packed - she stays where she floats.'
      : why === BOAT_MENU_WHY.sailing ? 'Not while at the helm.'
        : why === BOAT_MENU_WHY.noDeed ? 'Her deed must be in your pack to pick her up.'   // SHIP-PACK: comeSailAway.js DEED_NOT_HELD_TEXT (pinned equal)
          : why === BOAT_MENU_WHY.tooHeavy ? 'Her hold is too heavy to carry her packed. Lighten it first.' : null);   // HOLD-WEIGHT: HOLD_TOO_HEAVY_TEXT (pinned equal)

/**
 * The box a verb is pressed on: the one aimed at when it is that verb's (AUDIT BOAT-MENU C6: the far ladder aimed at
 * boards there), else the nearest to `at` of the boat's boxes of that kind (the hull aimed at: a boat with two ladders
 * boards at the nearer), or null when the boat carries none.
 * @param {Map<string, any[]>} boxes
 * @param {string} verb
 * @param {number[]} at
 * @param {(n: any) => number[]} posOf
 */
export function boatVerbNode(boxes, verb, at, posOf, aimed = null) {
  const list = boxes.get(BOAT_VERB_BOX[verb]?.box ?? '') ?? [];
  if (aimed && list.includes(aimed)) return aimed;   // AUDIT BOAT-MENU C6: the box aimed at, where it is the verb's
  let best = null, bestD = Infinity;
  for (const n of list) {
    const p = posOf(n);
    const d = (p[0] - at[0]) ** 2 + (p[1] - at[1]) ** 2 + (p[2] - at[2]) ** 2;
    if (d < bestD) { bestD = d; best = n; }
  }
  return best;
}

/**
 * A verb pressed on a boat of mine: past the mod's reach from the point aimed at, nothing (the box's press is silent
 * there); a row not listed, nothing; a refused row, its words said; else the mod's own activation on the verb's box
 * nearest `at`, in the verb's mode (the player's own where the verb has none). Returns what happened.
 * @param {{ boxes: Map<string, any[]>, rows: {id: string, disabled?: boolean, why?: string}[], verb: string|null,
 *   distance: number, reach: number, at: number[], posOf: (n: any) => number[], hit: object, mode: string,
 *   models: Readonly<Record<string, number>>, activate: (model: number, hit: object, mode: string) => any,
 *   say: (line: string) => void, aimed?: any }} p
 * @returns {'far'|'none'|'refused'|'pressed'}
 */
export function pressBoatVerb(p) {
  if (!(p.distance <= p.reach)) return 'far';
  const row = p.rows.find((r) => r.id === p.verb);
  if (!row) return 'none';
  if (row.disabled) { const line = boatMenuRefusal(row.why); if (line) p.say(line); return 'refused'; }
  const how = BOAT_VERB_BOX[row.id];
  const node = boatVerbNode(p.boxes, row.id, p.at, p.posOf, p.aimed ?? null);
  if (!how || !node) return 'none';
  p.activate(p.models[how.box], { ...p.hit, node, distance: p.distance }, how.mode ?? p.mode);
  return 'pressed';
}
