// @ts-check
// DRAGON4 (2026-10-29, the owner: "Dropping loot and one super rare chance of taming"; bible/11-Multiplayer/Dwarven-Dragon.md
// section 8): THE DRAGONS SLAIN, THEIR HOARDS AND THEIR TAMES. A `z1` receipt the relay signed at the kill is counted once a
// (watch, place, account) - DRAGON-EACH: each dragon of a watch its own, -1 the place of a receipt from before it; its hoard goes to the claim whose device id writes the hoard's row (the serpent's AUDIT RAID R4 law);
// THE TAME is drawn off this service's own randomness (never the receipt's seed, which the page holds), one dealing kill in
// DRAGON_TAME_ONE_IN, for a registered account's character that holds no dragon, by THIS claim's kill row alone in one
// batch - and named at every answer while its row stands, so a lost answer is told again. serpents.js claimSerpent rung
// for rung, less its Renown and its silver. Every clock is an argument.

import { verifyDragonReceipt } from '../../src/net/dragon/dragonReceipt.js';
import { renownCharacterOk } from './renownTracks.js';
import { seededRng } from '../../src/systems/wind/wind.js';

/** A device's claim id - the key a dragon's hoard is given under (the serpent's SERPENT_CID_RE). */
export const DRAGON_CID_RE = /^[0-9a-f]{16}$/;
/** One dealing kill in this many tames its dragon (the owner's answer, 2026-10-29: "Tame 1/100"). */
export const DRAGON_TAME_ONE_IN = 100;
/** The tame's own stream ('TAME') off the claim's draw. */
export const DRAGON_TAME_SALT = 0x54414d45;
/** Does a claim's draw tame its dragon? Pure. */
export const dragonTameRoll = (seed) => seededRng((seed ^ DRAGON_TAME_SALT) >>> 0)() < 1 / DRAGON_TAME_ONE_IN;

const int = (v) => (Number.isSafeInteger(Number(v)) ? Number(v) : 0);
const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
/** The statements that write a (watch, place, account)'s hoard row for `cid` if none is yet, and read whose it is. */
const hoardOf = (db, w, p, account, cid, nowS) => [
  db.prepare('INSERT OR IGNORE INTO dragon_spoils (watch, place, account, cid, at) VALUES (?1, ?2, ?3, ?4, ?5)').bind(w, p, account, cid, nowS),
  db.prepare('SELECT cid FROM dragon_spoils WHERE watch = ?1 AND place = ?2 AND account = ?3').bind(w, p, account),
];
const hoardAnswer = (res, cid) => res?.results?.[0]?.cid === cid;
/** The dragon's tame of this account, or null. */
const tameOf = (row) => (row ? { id: row.id, look: int(row.look), character: row.char_id } : null);

/** The dragons an account has slain: `{ slain }` - all another player's Inspect card is told (AUDIT DRAGON). */
export async function dragonSlainOf({ db }, playerId) {
  const k = await db.prepare('SELECT COUNT(*) AS n FROM dragon_kills WHERE account = ?1').bind(playerId).first();
  return { slain: int(k?.n) };
}
/** An account's own dragons, for its own card and its claim: `{ slain, tamed }`. */
export async function dragonRecordOf({ db }, playerId) {
  const m = await db.prepare('SELECT COUNT(*) AS n FROM dragon_mounts WHERE account = ?1').bind(playerId).first();
  return { ...(await dragonSlainOf({ db }, playerId)), tamed: int(m?.n) };
}
/** An account's tamed dragons: `[{ id, character, look, watch }]` - the mount's provenance (DRAGON5). */
export async function dragonMountsOf({ db }, playerId) {
  const r = await db.prepare('SELECT id, char_id, look, watch FROM dragon_mounts WHERE account = ?1 ORDER BY at').bind(playerId).all();
  return (r?.results ?? []).map((m) => ({ id: m.id, character: m.char_id, look: int(m.look), watch: int(m.watch) }));
}

/**
 * THE CLAIM: `receipt` verified with the relay's public half, naming `player` (the session's row, never the body's word),
 * counted once a (watch, place, account) for `character`. Answers `{ recorded, why?, slain, spoils, tamed }` - `why`
 * 'claimed' or 'guest' (a guest's `tamed` null), `spoils` whether THIS claim is given the hoard, `tamed` its dragon's tame or null - or
 * `{ error }`: `no-gate-key`, `receipt` (`why`), `not-yours`, `renown-character` (the serpent's word).
 * @param {{ db: any, nowS: number, subtle: SubtleCrypto, rand: (b: Uint8Array) => Uint8Array }} ctx @param {{ id: string, handle?: string|null }} player
 * @param {{ receipt: unknown, character: unknown, cid?: unknown }} body @param {CryptoKey|null} publicKey
 */
export async function claimDragon({ db, nowS, subtle, rand }, player, { receipt, character, cid = null }, publicKey) {
  if (!publicKey) return { error: 'no-gate-key' };
  const v = await verifyDragonReceipt(receipt, publicKey, { subtle, nowS });
  if (!v.ok) return { error: 'receipt', why: v.why };
  const c = v.claims, p = c.p ?? -1;
  if (c.s !== player.id) return { error: 'not-yours' };
  const hoard = typeof cid === 'string' && DRAGON_CID_RE.test(cid);
  if (!player.handle) {   // a guest: never counted and never tamed - but given its hoard, once
    const spoils = hoard ? hoardAnswer((await db.batch(hoardOf(db, c.q, p, player.id, cid, nowS)))[1], cid) : false;
    return { recorded: false, why: 'guest', ...(await dragonRecordOf({ db }, player.id)), spoils, tamed: null };
  }
  if (typeof character !== 'string' || !renownCharacterOk(character)) return { error: 'renown-character' };
  const nonce = hex(rand(new Uint8Array(8)));
  // THE TAME - a dealer's alone, off this claim's own draw
  const draw = c.x === 'dealt' ? rand(new Uint8Array(4)) : null;
  const tame = !!draw && dragonTameRoll(((draw[0] << 24) | (draw[1] << 16) | (draw[2] << 8) | draw[3]) >>> 0);
  const id = `dg${hex(rand(new Uint8Array(8)))}`;
  const mine = 'EXISTS (SELECT 1 FROM dragon_kills WHERE watch = ?1 AND place = ?9 AND account = ?2 AND nonce = ?3)';
  const res = await db.batch([
    // THE ROW, stamped with this claim's nonce - RETURNING it only when it was written
    db.prepare(
      `INSERT OR IGNORE INTO dragon_kills (watch, place, account, look, char_id, earned, level, nonce, at, body, tame)
       VALUES (?1, ?11, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10) RETURNING nonce`,
    ).bind(c.q, player.id, c.b, character, c.x, c.l, nonce, nowS, c.m ? JSON.stringify(c.m) : null, tame ? 1 : 0, p),
    // THE TAME, by THIS claim's row alone, for a character that holds no dragon
    db.prepare(
      `INSERT INTO dragon_mounts (id, account, char_id, look, watch, place, at)
       SELECT ?4, ?2, ?5, ?6, ?1, ?9, ?7 WHERE ?8 = 1 AND ${mine}
         AND NOT EXISTS (SELECT 1 FROM dragon_mounts WHERE account = ?2 AND char_id = ?5)`,
    ).bind(c.q, player.id, nonce, id, character, c.b, nowS, tame ? 1 : 0, p),
    db.prepare('SELECT COUNT(*) AS n FROM dragon_kills WHERE account = ?1').bind(player.id),
    db.prepare('SELECT id, look, char_id FROM dragon_mounts WHERE account = ?1 AND watch = ?2 AND place = ?3').bind(player.id, c.q, p),
    ...(hoard ? hoardOf(db, c.q, p, player.id, cid, nowS) : []),
  ]);
  const [row, , count, mount] = res;
  const spoils = hoard ? hoardAnswer(res[5], cid) : false;
  const answer = { slain: int(count?.results?.[0]?.n), spoils, tamed: tameOf(mount?.results?.[0]) };
  return row?.results?.length ? { recorded: true, ...answer } : { recorded: false, why: 'claimed', ...answer };
}
