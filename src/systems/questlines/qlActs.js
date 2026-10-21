// @ts-check
// QL11 (2026-10-19, the owner: "Tying all our newly integrated features into quests"; bible/06-Systems/Questlines-Arc.md
// section 4.5): THE ACTS - what a player did in one of the game's features, said in one line where it happens
// (`noteAct('fish-caught')`, as a system tells the Tutorials of a first use - tutorials.js noteFirstUse), and heard by every running stamped
// quest (systems/questlines/qlLayer.js act). An objective may ask for one ({ "act": "fish-caught", "n": 3 }) and a
// questline's script may wait on one (`ql act fish-caught 3`, qlActions.js QlAct).
//
// A LEAF: the features import this and nothing of the layer. The quest bridge registers the layer as the sink, once
// (scenes/quest/questBridge.js - THE ONE CONSTRUCTION SEAM, as questMacros.js setMacroWorld is), and a page with no quests
// hears nothing. An act is the player's own client's word - it moves a quest's objective, never an account's currency
// (decision 8: the service pays only what it witnessed - server-account/src/questlines.js).
//
// test/systems/questlines/ql11_acts.test.js sweeps src/ both ways: every kind here has a producer, and every producer
// names a kind here.

/** Every act a feature says, by kind, and the family it is of (what the player did is each kind's comment - the words an
 *  objective's writer reads, kept out of the game's own strings: the sheet that names the act says it to the player). */
export const ACT_KINDS = Object.freeze({
  // gathering and making (Professions, Foraging, Deep Waters)
  'fish-caught': 'gather',   // a fish caught
  'herb-gathered': 'gather',   // a plant gathered
  'ore-mined': 'gather',   // ore or gems mined
  'wood-chopped': 'gather',   // wood chopped
  'piece-crafted': 'make',   // a piece made at a crafting station (never a brew's potions, nor a dish cooked - AUDIT QUESTLINES ACTS-4)
  // the loot's own laws
  'gem-socketed': 'loot',   // a gem set in a socket
  'piece-reforged': 'loot',   // a piece reforged
  // the tavern's tables
  'gambit-won': 'tavern',   // a game of the King's Gambit won
  'cards-won': 'tavern',   // a hand of cards won
  // the sea and the road
  'port-reached': 'sea',   // a port reached under sail
  'cargo-delivered': 'sea',   // a cargo delivered
  'ship-struck': 'sea',   // a ship made to strike her colours
  // NOT HERE: section 4.5's "a wagon's load hauled (Merchant Yards)". Nothing in the game finishes one - the yards trade
  // horses and wagons (systems/merchantYards.js), no counter sells a wagon's load (the trade window's wagon button is a
  // consumed no-op, ui/native/nativeTrade.js `usingWagon`) - so no feature could say it, and an objective bound to it
  // could never close. It comes back with the feature that hauls one, and its producer.
  // the world's events
  'raid-repelled': 'world',   // a raid on a town driven off
  'arena-won': 'world',   // a ladder bout won in the Arena (never a bout between players - AUDIT QUESTLINES ACTS-6)
  'revenant-knelt': 'world',   // a revenant made to kneel
  'star-taken': 'world',   // a star taken on the Firmament - each star once (never one given back and taken again - AUDIT QUESTLINES ACTS-5)
  'wyrd-met': 'world',   // a Wyrd Sister's window opened at a tavern's door (the Witches' Festival - AUDIT STAR8 T1: Morwen's letter); never a find (festivalClient.js ACT_NOT_FOUND)
  // the endgame (each also a receipt the service holds - section 5.3)
  'rite-broken': 'endgame',   // Dagon's Faithful's rite broken before the breach opened
  'breach-closed': 'endgame',   // a Dagon's Breach closed
  'elite-foe-slain': 'endgame',   // an elite foe slain in an Elite Dungeon
  'redoubt-taken': 'endgame',   // a Redoubt taken in an Elite Breach
  'valkynaz-felled': 'endgame',   // a Valkynaz's Redoubt taken in an Elite Breach
  'hour-broken': 'endgame',   // the Brass Remnant broken in the Shattered Hour
  'serpent-slain': 'endgame',   // the Sea Serpent slain
  'star-held': 'endgame',   // a fallen star held through its master's fall (the Starfall - STAR8)
  'heart-star-held': 'endgame',   // the Heart-Star held - the Witches' Night's last star; said in the same turn as its `star-held`, so the festival's finds count one deed (festivalClient.js ONE DEED, ONE FIND)
});
export const ACT_IDS = Object.freeze(Object.keys(ACT_KINDS));

let _sink = null;
/** The bridge's registration: `fn(kind, n)` hears every act (the layer's act). Null unregisters. */
export function setActSink(fn) { _sink = typeof fn === 'function' ? fn : null; }

/** WITCH1 (bible/06-Systems/Witches-Festival.md): THE OTHER HEARERS - a feature that answers every act as it is said
 *  (the Witches' Festival's finds, systems/festival/festivalClient.js), beside the one sink, by name; null unregisters. A
 *  hearer moves no quest and is answered nothing: the count noteAct answers is still the quests'. */
const _hearers = new Map();
export function hearActs(name, fn) { if (typeof fn === 'function') _hearers.set(name, fn); else _hearers.delete(name); }

/** A feature's word: the player did `kind` (`n` times). Answers how many running quests heard it (0: none - or no
 *  quests on this page). A kind this file does not name is refused with a warning, never counted. */
export function noteAct(kind, n = 1) {
  if (!Object.hasOwn(ACT_KINDS, kind)) { console.warn(`[questlines] no act "${kind}"`); return 0; }
  const count = Math.floor(Number(n) || 0);
  if (count > 0) for (const fn of _hearers.values()) { try { fn(kind, count); } catch (e) { console.warn(`[questlines] a hearer of "${kind}" threw (${e?.message ?? e})`); } }
  if (count <= 0 || !_sink) return 0;
  try { return _sink(kind, count) | 0; } catch (e) { console.warn(`[questlines] the act "${kind}" was not heard (${e?.message ?? e})`); return 0; }
}
