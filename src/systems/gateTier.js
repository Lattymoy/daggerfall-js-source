// @ts-check
// EG-G2 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 2 - EG1's tiers): THE
// GATE'S TIER, IN ONE WORD - the dungeons' shape (systems/dungeon/dungeonTier.js, TIER1) for Dagon's gate:
//   'regular' - Dagon's Breach: the world boss on the shared clock, one a game day, everyone (WB);
//   'elite'   - an Elite Breach: a Weir Key's breach for one company, the Battlespire's torn halls (this arc);
//   'super'   - reserved for the Abyss Breach. The code keeps `super` for the Abyss tier as the dungeons do; nothing
//               answers it until it is built (section 2, "Why the Abyss tier is not built here").
// GATE_TIER_TEXT holds the words. The Regular tier's word is the event's own name, unchanged ("Dagon's Breach" - the
// gate's pool says it, scenes/gate/gatePool.js), and the Elite tier's is the breach's own (net/eliteGates/egLaw.js EG_TEXT.name) -
// test/world/eliteGates/eglook_registry.test.js holds both equal to their homes. Its surfaces: the arch's plaque (World Tooltips - the
// title, *The Battlespire* under it, and to anyone outside the company *<opener>'s company*), the sight line (the Elite
// Dungeon's own law, world/spawnedDungeons.js dungeonSightLine), the Timers row (*Elite Breach opens 4:12*, then *Hall 17 -
// 24:10 left*) and the arrival card. The arch and its rows are EG9's to stand; this is the one law they read.
//
// A LEAF - no imports - as the dungeons' tier law is. Not a DFU member: DFU has no gates. Ledger A (ELITE-GATES).

/** The gate's three tiers, easiest first. */
export const GATE_TIERS = Object.freeze(['regular', 'elite', 'super']);
/** Each tier's words. */
export const GATE_TIER_TEXT = Object.freeze({ regular: "Dagon's Breach", elite: 'Elite Breach', super: 'Abyss Breach' });
/** An Elite Breach's plaque's line under its title (section 2). */
export const GATE_TIER_SUB = Object.freeze({ elite: 'The Battlespire' });
/** An Elite Breach's room key - net/eliteGates/egLaw.js egRoomKey's `eg:<16hex>`, read here without importing the relay's law. */
const EG_ROOM_RE = /^eg:[0-9a-f]{16}$/;

/**
 * The tier of a gate-like thing, or null for none: a breach of a company (`{ b }` - its breach id, or `{ kind: 'eg' }`, or
 * its room key `eg:<16hex>`) is 'elite'; the day's gate (`{ day }`, or `{ kind: 'gate' }`) is 'regular'. Nothing answers
 * 'super' - the Abyss Breach is reserved.
 * @param {any} x
 * @returns {'regular'|'elite'|null}
 */
export function gateTier(x) {
  if (x == null) return null;
  if (typeof x === 'string') return EG_ROOM_RE.test(x) ? 'elite' : null;
  if (x.kind === 'eg' || (typeof x.b === 'string' && x.b.length > 0)) return 'elite';
  if (x.kind === 'gate' || Number.isSafeInteger(x.day)) return 'regular';
  return null;
}

/** The tier's words for a thing, or null. */
export const gateTierText = (x) => { const t = gateTier(x); return t ? GATE_TIER_TEXT[t] : null; };

/**
 * THE ARCH'S PLAQUE (section 2): `{ title, subs }` - an Elite Breach's title and *The Battlespire* under it; to a viewer
 * outside the company, a second line, *<opener>'s company*. Dagon's Breach keeps its own plaque (null here).
 * @param {{ opener?: string, mine?: boolean }} o
 */
export function eliteBreachPlaque({ opener = '', mine = false } = {}) {
  /** @type {string[]} */
  const subs = [GATE_TIER_SUB.elite];
  if (!mine && opener) subs.push(`${opener}'s company`);
  return { title: GATE_TIER_TEXT.elite, subs };
}

/** THE SIGHT LINE (section 2): the Elite Dungeon's own sentence and rounding (to the nearest ten metres, never under ten -
 *  world/spawnedDungeons.js dungeonSightLine), for a gate's tier. */
export function gateSightLine(metres, direction, tier = 'elite') {
  const m = Math.max(10, Math.round(metres / 10) * 10);
  const what = tier === 'regular' ? GATE_TIER_TEXT.regular : tier === 'super' ? `an ${GATE_TIER_TEXT.super}` : `an ${GATE_TIER_TEXT.elite}`;
  return `You see ${what} ${m} meters to the ${direction}!`;
}

/** THE TIMERS ROW (section 2, the company's alone): before it opens, *Elite Breach opens 4:12*; inside, *Hall 17 - 24:10
 *  left*. `clock` the count's words already made (net/eliteGates/egLaw.js egCountText). */
export const eliteTimerText = ({ h = 0, clock = '' } = {}) => (h > 0 ? `Hall ${h} - ${clock} left` : `${GATE_TIER_TEXT.elite} opens ${clock}`);
