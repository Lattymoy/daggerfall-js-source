// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ACC1b — A GUEST'S NAME: drawn from Daggerfall's own name banks, and
// shaped so a chosen handle can never be mistaken for one.
//
// Mac (2026-09-21): "definitely a random name".
//
// WHY THE GAME'S OWN BANKS. A guest could be called "Ochre Fox" and
// nobody would be harmed, but a guest called Theodore Gwynard is an
// INHABITANT - the port already carries DFU's NameGen.txt whole
// (`src/characters/nameGen.json`, the same 13 KB the chargen wizard and
// every townsperson draw from), so the world names its visitors out of
// the same book it names everybody else.
//
// ═══ THE SHAPE IS THE GUARANTEE ════════════════════════════════════
//
// A GUEST NAME ALWAYS CARRIES EXACTLY ONE SPACE; A CHOSEN HANDLE NEVER
// CARRIES ONE. That is the whole of the anti-impersonation law and it
// is STRUCTURAL rather than a lookup: a guest cannot be auto-assigned a
// name that collides with somebody's account, because the two name
// spaces cannot overlap by construction. No query, no race, nothing to get
// wrong at 3am - and a player can tell which they are looking at
// without being told.
//
// The alternative was to check each generated name against the handle
// table. That is a lookup that can race a rename, and it answers
// "not taken YET".
//
// NOT DFU'S RNG. `characters/nameHelper.js` reproduces DFRandom's draw
// order exactly, because a townsperson's name has to match classic.
// A guest's name matches nothing, so this draws uniformly from a CSPRNG
// and imports the bank alone - the Worker's bundle stays 13 KB of data
// and no engine.
// ═══════════════════════════════════════════════════════════════════

import banks from '../../src/characters/nameGen.json' with { type: 'json' };
// AUDIT-ACC F7: the generator has to know the wire's own bound, because
// the bank can spell a name that exceeds it. One law, asked from here.
import { nameIsIssuable } from '../../src/net/identityToken.js';

/** The banks a guest may be drawn from - every one the file carries
 *  that has the two name sets this shape needs. DERIVED from the data
 *  rather than listed, so a bank added to the file is a bank a guest
 *  can come from without this line moving. */
export const GUEST_BANKS = Object.freeze(Object.keys(banks)
  .filter((k) => Array.isArray(banks[k]?.sets) && banks[k].sets.length >= 6)
  .sort());

/* ═══ THE TWO NAME SHAPES MOVED TO src/net/handleShape.js (ACC1e) ══
 *
 * They were born here and the law is unchanged; only the address is.
 * ACC1e gave the player a field to type a handle into, and the client
 * has to ask the same question the service does - but every import in
 * this repo runs one way, `server-account/` reaching into `src/` and
 * never the reverse, so a client file importing from THIS file would
 * have been the only edge going backwards.
 *
 * BOTH HALVES WENT TOGETHER on purpose. The comment that used to stand
 * here said "both halves of it are exported from here so neither can
 * drift from the other" - taking HANDLE_RE alone would have broken the
 * very property that sentence exists to hold. They are one law seen
 * from two sides.
 *
 * RE-EXPORTED rather than re-declared, so every reader of this file
 * still finds them here and there is still exactly one of each.
 */
import { GUEST_NAME_RE, HANDLE_RE, isGuestShaped, isHandleShaped } from '../../src/net/handleShape.js';
export { GUEST_NAME_RE, HANDLE_RE, isGuestShaped, isHandleShaped };

/** A uniform index in [0, n), from a CSPRNG, without modulo bias -
 *  rejection sampling over whole bytes. `rand` is an argument so a test
 *  can drive the edges rather than hope for them. */
export function pick(n, rand) {
  if (!Number.isInteger(n) || n <= 0) throw new RangeError('pick needs a positive count');
  if (n === 1) return 0;
  const limit = Math.floor(256 / n) * n;          // the largest whole multiple that fits a byte
  const buf = new Uint8Array(1);
  for (let guard = 0; guard < 1000; guard++) {
    rand(buf);
    if (buf[0] < limit) return buf[0] % n;        // the tail above `limit` is thrown away
  }
  throw new Error('pick could not draw an unbiased index');
}

const partsOf = (bank, set) => banks[bank].sets[set].parts;

/** One draw, unfiltered. Separate from `guestName` so the rejection
 *  below has something to reject. */
function drawName(rand, bank) {
  const part = (set) => { const p = partsOf(bank, set); return p[pick(p.length, rand)]; };
  // sets 0+1 are the male first name, 4+5 the surname - the same sets
  // characters/nameHelper.js draws those two from
  return `${part(0) + part(1)} ${part(4) + part(5)}`;
}

/**
 * A name for a guest. Two parts for the first name and two for the
 * surname, the way every Breton in the game is named.
 *
 * ═══ AUDIT-ACC F7: THE BANK CAN SPELL A NAME THE WIRE CANNOT CARRY ══
 *
 * `NAME_MAX` is 24 and the longest name this bank can produce is 25:
 * `Kelkemmelian Larethbinder`, and three siblings sharing that surname.
 * Four of the 173,330 names the generator can spell - about one guest
 * in 43,000 - and every one of them made `createGuest` throw, which
 * `index.js` turns into a 500. A player who drew one simply could not
 * get an account until they tried again.
 *
 * The comment at that throw said "the bank is the game's own, so this
 * should never fire". Nobody had multiplied the bank out and compared
 * it to the bound; this audit did, and the claim was false.
 *
 * RAISING `NAME_MAX` IS NOT AVAILABLE. It lives in `src/net/wire.js`,
 * which is in the relay bundle - SLAM8 hashes that bundle's raw bytes,
 * so touching it costs a RELAY_VERSION bump and drops every connected
 * player. A four-in-173,330 cosmetic bound is not worth a player's
 * dungeon run.
 *
 * SO THE GENERATOR RESPECTS THE BOUND IT ALWAYS HAD TO. This is
 * rejection sampling, the same shape `pick` above already uses on the
 * byte that would have been biased: draw, and throw the draw away if it
 * falls outside the allowed set. The alternative - pre-filtering the
 * bank - hard-codes an answer that a changed `nameGen.json` or a
 * changed `NAME_MAX` would silently invalidate.
 *
 * @param {(b: Uint8Array) => void} rand  fills bytes; `crypto.getRandomValues`
 * @param {string|null} bank  a bank name, or null to draw one
 * @returns {string}
 */
export function guestName(rand, bank = null) {
  const b = bank ?? GUEST_BANKS[pick(GUEST_BANKS.length, rand)];
  if (!GUEST_BANKS.includes(b)) throw new RangeError(`no such name bank: ${b}`);
  // Bounded, because an unbounded retry over a bank that had somehow
  // become entirely unusable is a Worker that spins instead of failing.
  // At four bad names in 173,330 the chance of eight consecutive
  // rejections is about one in 10^37.
  for (let attempt = 0; attempt < 8; attempt++) {
    const name = drawName(rand, b);
    if (nameIsIssuable(name) && GUEST_NAME_RE.test(name)) return name;
  }
  throw new Error(`no issuable name could be drawn from ${b} - the bank and NAME_MAX have parted`);
}

