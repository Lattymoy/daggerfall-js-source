// @ts-check
// DICE1 (2026-09-23, the community arc - Addison Knox: "Chat dice-rolling"): THE DICE'S LAW - pure, DOM-free, one home
// for both ends (net/wire.js re-exports it, so the relay reads it through server/src/relay.js like every other law).
//
// THE RELAY ROLLS. A roll said by the client would be a number the client chose: a player who wants a 20 types one. So
// the client ASKS - `{t:'roll', n, m, k}`, how many dice, how many sides, what to add - and the relay rolls them from its
// own CSPRNG (crypto.getRandomValues) and says the result to the channel the ask came down, as a frame of its own TYPE
// (`t:'roll'`), which no player can send back out: a chat line that reads "rolls 2d6: 12" is a chat line, drawn as one.
// The client checks what it is told by the same law (validRoll): n dice, each 1..m, the total their sum plus k.
//
// THE GRAMMAR is the tabletop's: `NdM+K` - `2d6+3`, `d20`, `3d8-1`, `d%` for a hundred - and a bare number `N` is one
// die of N sides (the MMO's own `/roll 100`). No spec at all is a d20. The bounds keep a line a line: at most
// ROLL_DICE_MAX dice, ROLL_SIDES_MAX sides, a modifier within ROLL_MOD_MAX.
//
// Not a DFU member: Daggerfall Unity has no chat and no dice. Ledger A row (ONLINE).

/** The most dice one roll throws - a handful the eye can add. */
export const ROLL_DICE_MAX = 10;
/** The most sides a die may have (a d1000 is the widest a tabletop reaches for). */
export const ROLL_SIDES_MAX = 1000;
/** The largest modifier either way. */
export const ROLL_MOD_MAX = 1000;
/** A bare `/roll`: the d20. */
export const ROLL_DEFAULT = Object.freeze({ n: 1, m: 20, k: 0 });

/** Is this a roll's ask - {n, m, k} integers in the bounds (a die has two sides at least). */
export function validRollSpec(s) {
  if (!s || typeof s !== 'object') return false;
  const { n, m, k } = s;
  return Number.isInteger(n) && n >= 1 && n <= ROLL_DICE_MAX
    && Number.isInteger(m) && m >= 2 && m <= ROLL_SIDES_MAX
    && Number.isInteger(k) && k >= -ROLL_MOD_MAX && k <= ROLL_MOD_MAX;
}

/** A typed spec to {n, m, k}, or null for one the grammar or the bounds refuse. Spaces are ignored; `d%` is a d100. */
export function parseRollSpec(text) {
  const t = String(text ?? '').replace(/\s+/g, '').toLowerCase();
  if (!t) return { ...ROLL_DEFAULT };
  let spec = null;
  const bare = /^(\d{1,4})$/.exec(t);
  if (bare) spec = { n: 1, m: Number(bare[1]), k: 0 };
  const dice = /^(\d{0,2})d(\d{1,4}|%)([+-]\d{1,4})?$/.exec(t);
  if (dice) spec = { n: dice[1] === '' ? 1 : Number(dice[1]), m: dice[2] === '%' ? 100 : Number(dice[2]), k: dice[3] ? Number(dice[3]) : 0 };
  return spec && validRollSpec(spec) ? spec : null;
}

/** The spec as the tabletop writes it: `2d6+3`, `1d20`, `3d8-1`. */
export const rollSpecText = ({ n, m, k }) => `${n}d${m}${k > 0 ? `+${k}` : k < 0 ? `${k}` : ''}`;

/**
 * THE ROLL, from a source of uniform 32-bit integers (`rand32` - the relay's crypto.getRandomValues; a test's own
 * sequence). UNBIASED: a draw at or past the largest multiple of `m` below 2^32 is thrown back and drawn again, so every
 * face is exactly as likely (a bare `x % m` favours the low faces whenever m does not divide 2^32). Answers
 * {n, m, k, dice, total}, or null for a spec the law refuses.
 * @param {{n: number, m: number, k: number}} spec
 * @param {() => number} rand32
 */
export function rollDice(spec, rand32) {
  if (!validRollSpec(spec)) return null;
  const { n, m, k } = spec;
  const limit = 2 ** 32 - (2 ** 32 % m);
  const dice = [];
  for (let i = 0; i < n; i++) {
    let x;
    do { x = rand32() >>> 0; } while (x >= limit);
    dice.push(1 + (x % m));
  }
  return { n, m, k, dice, total: dice.reduce((a, b) => a + b, 0) + k };
}

/** Is this a roll as the relay says it - the spec's law, n dice each 1..m, the total their sum plus k. */
export function validRoll(r) {
  if (!validRollSpec(r) || !Array.isArray(r.dice) || r.dice.length !== r.n) return false;
  if (!r.dice.every((d) => Number.isInteger(d) && d >= 1 && d <= r.m)) return false;
  return r.total === r.dice.reduce((a, b) => a + b, 0) + r.k;
}

/** A roll as one line of the log: `rolls 2d6+3: 4 + 5 +3 = 12` - the dice shown, so the sum can be checked by eye. */
export function rollText(r) {
  const dice = r.dice.join(' + ');
  const mod = r.k > 0 ? ` +${r.k}` : r.k < 0 ? ` ${r.k}` : '';
  return r.n === 1 && !r.k ? `rolls ${rollSpecText(r)}: ${r.total}` : `rolls ${rollSpecText(r)}: ${dice}${mod} = ${r.total}`;
}
