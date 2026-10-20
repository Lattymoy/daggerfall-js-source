// @ts-check
// CROWN1 part two, the client (2026-10-01, Mac: "Finish the seats"; "Continue"; "Hurry up"): WHAT THE CLIENT HOLDS OF A
// ROYAL TOURNEY - the room's words (net/wire.js validSiegeOut's royal kinds) folded into one state: every contender's
// vitality, the bout in the ring, the ladder, the challenges standing at this player and the last bout's end; and the
// HUD's words for it, in the siege HUD's own shape (ui/siegeHud.js draws either) - bible/11-Multiplayer/Seats-Arc.md 7.6.
//
// PURE: a state and a word in, the next state out (`foldRoyal`); the words from a state, the tourney (its seat, prize and
// end) and how to name a peer. The session around it (net/royalSession.js) keeps the state.
//
// Not a DFU member. Ledger A (EVERY PALACE A SEAT's row).
import { ROYAL_RING } from './siege/siegeRef.js';

/**
 * @typedef {{ roll: Readonly<Record<string, { hp: number, max: number, down: boolean }>>, bout: { a: string, b: string, n: number, s: number, e: number }|null,
 *   ladder: ReadonlyArray<ReadonlyArray<any>>, asks: Readonly<Record<string, number>>, last: { n: number, w: string, l: string, c: number, at: number }|null,
 *   no: string|null, heardAt: number }} RoyalState
 */
/** Nothing heard yet. @type {Readonly<RoyalState>} */
export const ROYAL_STATE_EMPTY = Object.freeze({ roll: Object.freeze({}), bout: null, ladder: Object.freeze([]), asks: Object.freeze({}), last: null, no: null, heardAt: 0 });
/** The ladder's rows the HUD shows. */
export const ROYAL_HUD_ROWS = 5;
/** How long a bout's end stays on this player's lines, ms. */
export const ROYAL_LAST_SHOWN_MS = 10_000;

/**
 * One word folded in: the roll call replaces every contender's vitality, one's moves its own; a bout told stands in the
 * ring (and its two's standing challenges are spent), its end clears it; the ladder replaces the ladder; a challenge at
 * this player stands ROYAL_RING.askMs from when it was heard. @param {Readonly<RoyalState>} s @param {any} g @param {number} now
 * @returns {Readonly<RoyalState>}
 */
export function foldRoyal(s, g, now) {
  if (!g) return s;
  switch (g.k) {
    case 'st': {
      /** @type {Record<string, { hp: number, max: number, down: boolean }>} */
      const roll = {};
      for (const [id, hp, max, down] of g.f) roll[id] = { hp, max, down: down === 1 };
      return { ...s, roll, heardAt: now };
    }
    case 'hp': return { ...s, roll: { ...s.roll, [g.id]: { hp: g.h, max: g.m, down: g.h <= 0 } }, heardAt: now };
    case 'fell': { const was = s.roll[g.id]; return { ...s, roll: { ...s.roll, [g.id]: { hp: 0, max: was?.max ?? 0, down: true } }, heardAt: now }; }
    case 'bout': {
      const asks = { ...s.asks };
      delete asks[g.a]; delete asks[g.b];
      return { ...s, bout: { a: g.a, b: g.b, n: g.n, s: g.s, e: g.e }, asks, heardAt: now };
    }
    case 'bend': return { ...s, bout: s.bout?.n === g.n ? null : s.bout, last: { n: g.n, w: g.w, l: g.l, c: g.c, at: now }, heardAt: now };
    case 'lad': return { ...s, ladder: g.l.map((r) => r.slice()), heardAt: now };
    case 'ask': return { ...s, asks: { ...s.asks, [g.id]: now }, heardAt: now };
    case 'no': return { ...s, no: g.m, heardAt: now };
    default: return s;
  }
}
/** Whether `id`'s challenge at this player still stands. */
export const royalAskStands = (s, id, now) => Number.isFinite(s.asks[id]) && now - s.asks[id] <= ROYAL_RING.askMs;

/** mm:ss, never negative. */
const clock = (ms) => { const t = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
/** Days and hours to `ms`, never negative. */
const daysHours = (ms) => { const h = Math.max(0, Math.floor(ms / 3_600_000)); return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${Math.max(0, Math.floor(ms / 60_000)) % 60}m`; };

/**
 * WHAT THE HUD SAYS - the siege HUD's shape: `{ bar: [title, the ring], sides: the ladder, self: [...], card: null }`.
 * `t` `{ seat, prize, endsMs }`; `me` this player's peer id; `name(id)` a peer's name ('' for none); `watching` a
 * spectator.
 * @param {Readonly<RoyalState>} s @param {{ seat?: string, prize?: number, endsMs?: number }} t @param {string} me @param {number} now
 * @param {{ watching?: boolean, name?: (id: string) => string }} [o]
 */
export function royalHudModel(s, t, me, now, { watching = false, name = () => '' } = {}) {
  const who = (id) => (id === me ? 'You' : name(id) || 'a contender');
  const title = `THE ROYAL TOURNEY OF ${String(t.seat ?? '').toUpperCase()}   prize ${Number(t.prize ?? 0).toLocaleString('en-US')} silver   ends in ${daysHours((t.endsMs ?? now) - now)}`;
  const b = s.bout;
  const ring = !b ? 'The ring is empty. Challenge a contender from their card.'
    : now < b.s ? `BOUT ${b.n}: ${who(b.a)} against ${who(b.b)} - begins in ${Math.max(1, Math.ceil((b.s - now) / 1000))}`
      : `BOUT ${b.n}: ${who(b.a)} against ${who(b.b)}   ${clock(b.e - now)}`;
  const ladder = s.ladder.slice(0, ROYAL_HUD_ROWS).map((r, i) => `${i + 1}. ${r[0] ? who(r[0]) : 'someone gone'} ${r[1]}-${r[2]}`).join('   ');
  const self = [];
  if (watching) self.push('Watching the Royal Tourney');
  else {
    const f = s.roll[me];
    if (f && b && (b.a === me || b.b === me)) {
      const bars = f.max > 0 ? Math.round((10 * f.hp) / f.max) : 0;
      self.push(`vitality  ${'|'.repeat(bars)}${'.'.repeat(10 - bars)}  ${f.hp} / ${f.max}`);
    }
    const mine = s.ladder.find((r) => r[0] === me);
    self.push(mine ? `You: ${mine[1]} ${mine[1] === 1 ? 'win' : 'wins'}, ${mine[2]} ${mine[2] === 1 ? 'loss' : 'losses'}` : 'You have no bout won yet.');
    for (const id of Object.keys(s.asks)) if (royalAskStands(s, id, now)) self.push(`${who(id)} challenges you. Challenge them back from their card to accept.`);
    if (s.last && (s.last.w === me || s.last.l === me) && now - s.last.at < ROYAL_LAST_SHOWN_MS) {
      self.push(s.last.w === me ? (s.last.c ? 'You won the bout.' : 'You won the bout, but you two have met 3 times today, so it does not count on the ladder.') : 'You lost the bout.');
    }
  }
  return { bar: [title, ring], sides: ladder || 'No bout has been won yet.', self, card: null };
}
