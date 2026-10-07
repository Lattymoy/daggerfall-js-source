// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SD9b (2026-10-07, the Super Dungeons arc) — THE HOURS BROKEN, AS THE SERVICE KEEPS THEM.
//
// Mac: "Super dungeons are random finds on the world map ... The Super dungeon collapses when the feat is done." The
// relay runs the Brass Remnant's fight in the Hollow's realm and, at its fall, signs a receipt for each account that
// earned it (src/net/sdReceipt.js - `h1`, under the relay's GATE_SIGNING_KEY). This file is where that receipt is
// honoured: the gate's claim (accounts.js claimGate) rung for rung - and the Hour's two grants rolled on its first write.
// Design: bible/11-Multiplayer/Super-Dungeons.md section 11.
//
// ═══ ONCE, WHATEVER HAPPENS TO IT ══════════════════════════════════
//
// sd_kills' primary key is (slot, account) - a Hollow falls once - so a second claim (another device, a retry after a
// lost answer, a replay) lands nothing and is answered `claimed`. A record is a REGISTERED account's (AUDIT DUEL1 A1's
// law): a guest's receipt is answered `guest` and not counted, and the client keeps it to claim again once it registers
// (its id survives the registering), inside the receipt's week.
//
// ═══ THE HOUR'S GRANTS, ON THE FIRST WRITE ALONE ═══════════════════
//
// The title HOURBREAKER one kill in four, the aura THE TURNING HOUR one in eight - rolled off the receipt's seed (the
// relay's, never the client's; its own stream, salted - never the spoils' rolls, which the device draws from the same
// seed) and written with the row: ONE TRANSACTION, the row stamped with this claim's NONCE and the grants laid on the
// account's `sd_honours` by THAT row alone (serpents.js's law), so a receipt claimed twice at once rolls once. Once held,
// held for good - a grant recorded (titles.js reads it off the row, the Broker's sale's way), never derived again.
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═══════════════════════════════════════════════════════════════════

import { verifySdReceipt } from '../../src/net/sdReceipt.js';
import { seededRng } from '../../src/systems/wind.js';

/** The account's grants on its row (`players.sd_honours`, migration 0087), bit by bit. */
export const SD_HONOUR_TITLE = 1;
export const SD_HONOUR_AURA = 2;
/** How often a kill's first write grants each: Hourbreaker one in four, The Turning Hour one in eight. */
export const SD_TITLE_CHANCE = 1 / 4;
export const SD_AURA_CHANCE = 1 / 8;
/** The honours' own stream off the receipt's seed ('HOUR'), never the spoils' (systems/sdSpoils.js draws the seed's own). */
export const SD_HONOURS_SALT = 0x484f5552;

/** What a receipt's seed grants on its kill's first write - `{ title, aura }`. Pure. */
export function sdHonoursRoll(seed) {
  const r = seededRng((seed ^ SD_HONOURS_SALT) >>> 0);
  return { title: r() < SD_TITLE_CHANCE, aura: r() < SD_AURA_CHANCE };
}

const int = (v) => (Number.isSafeInteger(Number(v)) ? Number(v) : 0);
const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

/** An account's Hours broken, for the cards: `{ broken }`. */
export async function sdRecordOf({ db }, playerId) {
  const r = await db.prepare('SELECT COUNT(*) AS n FROM sd_kills WHERE account = ?1').bind(playerId).first();
  return { broken: int(r?.n) };
}

/**
 * THE CLAIM: `receipt` verified with the relay's public half and naming `player` (the session's row, never the body's
 * word), one row a (slot, account), and on that first write the Hour's grants rolled off its seed. Answers
 * `{ recorded: true, slot, title, aura, broken }` (`title`/`aura` what THIS kill granted - an account that held one
 * already holds it still), `{ recorded: false, why: 'claimed', broken }`, `{ recorded: false, why: 'guest', broken }`, or
 * `{ error }` - `no-gate-key` (this service holds no public half), `receipt` (`why` says which rung), `not-yours`.
 * @param {{ db: any, nowS: number, subtle: SubtleCrypto, rand: (b: Uint8Array) => Uint8Array }} ctx
 * @param {{ id: string, handle?: string|null }} player
 * @param {unknown} receipt
 * @param {CryptoKey|null} publicKey
 */
export async function claimSd({ db, nowS, subtle, rand }, player, receipt, publicKey) {
  if (!publicKey) return { error: 'no-gate-key' };
  const v = await verifySdReceipt(receipt, publicKey, { subtle, nowS });
  if (!v.ok) return { error: 'receipt', why: v.why };
  const c = v.claims;
  if (c.s !== player.id) return { error: 'not-yours' };
  if (!player.handle) return { recorded: false, why: 'guest', ...(await sdRecordOf({ db }, player.id)) };
  const { title, aura } = sdHonoursRoll(c.c);
  const bits = (title ? SD_HONOUR_TITLE : 0) | (aura ? SD_HONOUR_AURA : 0);
  const nonce = hex(rand(new Uint8Array(8)));
  const [row, , count] = await db.batch([
    // THE ROW, stamped with this claim's nonce
    db.prepare('INSERT OR IGNORE INTO sd_kills (slot, account, boss, earned, lv, title, aura, nonce, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)')
      .bind(c.d, player.id, c.b, c.x, c.l, title ? 1 : 0, aura ? 1 : 0, nonce, nowS),
    // THE GRANTS, by THIS claim's row alone - held for good
    db.prepare('UPDATE players SET sd_honours = sd_honours | ?2 WHERE id = ?1 AND ?2 != 0 AND EXISTS (SELECT 1 FROM sd_kills WHERE slot = ?3 AND account = ?1 AND nonce = ?4)')
      .bind(player.id, bits, c.d, nonce),
    db.prepare('SELECT COUNT(*) AS n FROM sd_kills WHERE account = ?1').bind(player.id),
  ]);
  const broken = int(count?.results?.[0]?.n);
  if (!(Number(row?.meta?.changes ?? 0) > 0)) return { recorded: false, why: 'claimed', broken };
  return { recorded: true, slot: c.d, title, aura, broken };
}
