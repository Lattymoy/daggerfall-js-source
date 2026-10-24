// @ts-check
// ═══════════════════════════════════════════════════════════════════
// EG-F (2026-10-12, the Elite Gates arc, Mac: "I said I want everything") — WHERE A BREACH MAY START.
//
// bible/11-Multiplayer/Elite-Gates.md sections 5 and 16.6. A breach may start at any Redoubt its opener may start at -
// any Redoubt they have taken this season, or, until they take one this season, floor(best / 2) of their all-time best
// (src/net/eliteGates/egStartLaw.js egStartsFrom, the law the start window asks by too). The season is the arena's
// (src/net/arena/arenaLaw.js arenaSeasonOf - eight weeks), as the boards' is.
//
// `/v1/eg/starts` is THE START WINDOW'S PREFLIGHT: for each member of the opener's party (the client names them - at most
// EG_STARTS_ASK_MAX, the opener always among them), which starts they may make; null for one who may make none (no such
// account, or a guest: the Spire's feats are recorded). With it the opener's own Weir Keys and whether the day's Rehearsal
// is still free, so the window asks once - and the relay's public half (`rk`, GATE_PUBLIC_KEY: not a secret, it can
// verify and cannot sign), which verifies the hub's signature on an arch a stranger stands (src/net/eliteGates/egCallSig.js).
// /v1/eg/keys hands the same `rk` to every signed-in client, opener or not.
//
// The open (eg.js openEg) and every admission (admitEg) are held to the same law: no carries.
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═══════════════════════════════════════════════════════════════════

import { egStartsFrom } from '../../src/net/eliteGates/egStartLaw.js';
import { arenaSeasonOf, ARENA_SEASON_EPOCH_S, ARENA_SEASON_S } from '../../src/net/arena/arenaLaw.js';
import { ID_RE } from '../../src/net/identityToken.js';
import { utcDay } from '../../src/net/marksLaw.js';

/** The most members a preflight asks after (the party's PARTY_MAX). */
export const EG_STARTS_ASK_MAX = 8;
/** The first second of the season holding `nowS` (the arena's eight weeks). */
export const egSeasonStartS = (nowS) => ARENA_SEASON_EPOCH_S + (arenaSeasonOf(nowS) - 1) * ARENA_SEASON_S;
const int = (v) => (Number.isSafeInteger(Number(v)) ? Number(v) : 0);

/**
 * THE STARTS ACCOUNT `id` MAY MAKE at `nowS`: its Redoubts taken this season, deepest first, else floor(best / 2) - and
 * Hall 1 (0) always (egStartsFrom). Null for an account with no handle (a guest) or no row.
 * @param {any} db @param {string} id @param {number} nowS
 */
export async function egStartsFor(db, id, nowS) {
  const row = await db.prepare('SELECT handle FROM players WHERE id = ?1').bind(id).first();
  if (!row?.handle) return null;
  const season = await db.prepare('SELECT DISTINCT w FROM eg_redoubts WHERE account = ?1 AND at >= ?2').bind(id, egSeasonStartS(nowS)).all();
  const best = await db.prepare('SELECT MAX(w) AS w FROM eg_redoubts WHERE account = ?1').bind(id).first();
  return egStartsFrom((season?.results ?? []).map((r) => int(r.w)), int(best?.w));
}

/**
 * THE PREFLIGHT: `{ starts: { [sub]: number[] | null }, keys, rehearsal, rk }` for the opener and the members it names
 * (`body.subs`), or `{ error }`: `guest`, `subs` (not a list of account ids, or more than EG_STARTS_ASK_MAX).
 * @param {{ db: any, nowS: number }} ctx @param {{ id: string, handle?: string|null }} player @param {any} body
 * @param {string|null} relayKey the relay's public half (env.GATE_PUBLIC_KEY), base64url raw
 */
export async function startsEg({ db, nowS }, player, body, relayKey) {
  if (!player.handle) return { error: 'guest' };
  const asked = body?.subs ?? [];
  if (!Array.isArray(asked) || asked.length > EG_STARTS_ASK_MAX || !asked.every((s) => typeof s === 'string' && ID_RE.test(s))) return { error: 'subs' };
  const subs = [...new Set([player.id, ...asked])].slice(0, EG_STARTS_ASK_MAX);
  const starts = {};
  for (const sub of subs) starts[sub] = await egStartsFor(db, sub, nowS);
  const me = await db.prepare('SELECT eg_keys, eg_rh_day FROM players WHERE id = ?1').bind(player.id).first();
  return { starts, keys: int(me?.eg_keys), rehearsal: int(me?.eg_rh_day) !== utcDay(nowS), rk: relayKey || null };
}
