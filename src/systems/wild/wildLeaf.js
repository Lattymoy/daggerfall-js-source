// @ts-check
// FIELD BUGS 2026-10-19f: THE OPEN ZONE'S WORDS THAT NEED NO GRAPH - a leaf with no imports, read by the drop's law
// (wildDropLaw.js, which re-exports them for its readers and the account service), by the companions
// (systems/revenant/revenantCompanions.js - COMPANION-DROP) and by a revenant's take (systems/revenant/revenant.js -
// STEED-KEPT). They lived in wildDropLaw.js, and the two fixes' imports of them pulled the drop law's whole graph - the
// item law among it, which installs itself on the wire's door (systems/loot/loot.js setItemLaw) - into every client graph
// that stands a revenant; the words need none of it.

/** The groups no death in the zone ever drops: a vehicle, a deed, a quest's own item. */
export const WILD_NEVER_GROUPS = Object.freeze(new Set(['Transportation', 'Deeds', 'QuestItems', 'Currency']));

/** PVPDUNGEONS (the owner: "Only 1 revenant allowed to summon in the zone"): how many sworn revenants stand at the
 *  player's side in the open zone. */
export const WILD_REVENANTS_MAX = 1;

/** COMPANION-DROP: THE SWORN AT THE PLAYER'S SIDE IN THE ZONE, out of a revenant list (the feud's records, revenant.js - a
 *  save's `list` or the live one): sworn, not fallen, walking with them (a companion's state, 'with' where none is kept -
 *  revenantCompanions.js stateOf), the first WILD_REVENANTS_MAX in the list's order - the ones the zone stands.
 *  @param {any} list @returns {any[]} */
export const wildSwornAtSide = (list) => (Array.isArray(list) ? list : []).filter((r) => !!r && !!r.sworn && !r.defeated && !r.gone && (r.companion?.state ?? 'with') === 'with').slice(0, WILD_REVENANTS_MAX);
