// @ts-check
// ═══════════════════════════════════════════════════════════════════
// KETCH (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 9) — THE KETCHMASTER'S HOLD, AS THE SERVICE KEEPS IT.
//
// The relay runs each crew's sky-ketch and, at the Tonal Warden's fall, signs a receipt for each member who earned it
// (src/net/ketch/ketchReceipt.js - `y1`, under the relay's GATE_SIGNING_KEY). This file is where that receipt is honoured:
// the Hour's claim (sds.js claimSd) rung for rung, and THE WEEK'S SHARE.
//
// ═══ ONCE A VOYAGE ═════════════════════════════════════════════════
//
// ketch_voyages' primary key is (voyage, account): the hold pays a hand once a voyage (KETCH-EVERY: every ten hours). The first receipt of a voyage the
// service is shown takes its share (`recorded`), under the device's claim id (`cid` - the stars' and the raids' own,
// STAR_CID_RE). The same voyage again from the SAME ship is the same kill, answered `claimed` - its `share` true only to
// the claim id that wrote the row (a retry after a lost answer, on that device): AUDIT KETCH L2-1, the relay hands a
// receipt to every hello of its account, and a second browser or device rolled the same share again (AUDIT RAID R4's
// bug, which the stars' cid closed). The same voyage from ANOTHER crew's ship is answered `taken`, `share` false: the
// account helped a second crew this voyage, and its page throws no spoils for it. A guest's share is written too - the
// voyage is the account's, registered or not - and its record says `guest`. The budget's fill (INT5) rides the row's own
// batch, held to it by its nonce (AUDIT KETCH L2-9 - AUDIT STARFALL B3's law: run after it, a failure between the two
// lost the fill for good).
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═══════════════════════════════════════════════════════════════════

import { verifyKetchReceipt } from '../../src/net/ketch/ketchReceipt.js';
import { spoilsGrantStatement } from './budget.js';

/** A device's claim id - the key a share is given under (stars.js STAR_CID_RE). */
export const KT_CID_RE = /^[0-9a-f]{16}$/;

const int = (v) => (Number.isSafeInteger(Number(v)) ? Number(v) : 0);
const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

/** An account's voyages to the Ketchmaster's hold, for the cards: `{ sailed }`. */
export async function ketchRecordOf({ db }, playerId) {
  const r = await db.prepare('SELECT COUNT(*) AS n FROM ketch_voyages WHERE account = ?1').bind(playerId).first();
  return { sailed: int(r?.n) };
}

/**
 * THE CLAIM: `receipt` verified with the relay's public half and naming `player` (the session's row, never the body's
 * word), one row a (voyage, account), written under `cid`. Answers `{ recorded: true, voyage, share: true, sailed }`,
 * `{ recorded: false, why: 'claimed', share, sailed }` (this ship's kill again - `share` whether `cid` wrote the row),
 * `{ recorded: false, why: 'taken', share: false, sailed }`
 * (another crew's ship this voyage), or `{ error }` - `no-gate-key`, `receipt` (`why` says which rung), `not-yours`. A
 * guest's answer says `guest: true` beside it.
 * @param {{ db: any, nowS: number, subtle: SubtleCrypto, rand: (b: Uint8Array) => Uint8Array }} ctx
 * @param {{ id: string, handle?: string|null }} player
 * @param {unknown} receipt
 * @param {CryptoKey|null} publicKey
 * @param {unknown} [cid] the device's claim id (KT_CID_RE) - none, and no `claimed` is paid
 */
export async function claimKetch({ db, nowS, subtle, rand }, player, receipt, publicKey, cid = null) {
  if (!publicKey) return { error: 'no-gate-key' };
  const v = await verifyKetchReceipt(receipt, publicKey, { subtle, nowS });
  if (!v.ok) return { error: 'receipt', why: v.why };
  const c = v.claims;
  if (c.s !== player.id) return { error: 'not-yours' };
  const nonce = hex(rand(new Uint8Array(8))), mine = typeof cid === 'string' && KT_CID_RE.test(cid) ? cid : null;
  const [row, kept, count] = await db.batch([
    db.prepare('INSERT OR IGNORE INTO ketch_voyages (voyage, account, owner, earned, lv, nonce, at, body, cid) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)')
      .bind(c.d, player.id, c.o, c.x, c.l, nonce, nowS, c.m ? JSON.stringify(c.m) : null, mine),
    db.prepare('SELECT owner, nonce, cid FROM ketch_voyages WHERE voyage = ?1 AND account = ?2').bind(c.d, player.id),
    db.prepare('SELECT COUNT(*) AS n FROM ketch_voyages WHERE account = ?1').bind(player.id),
    // INT5's FILL - a signed win's spoils, the playing character's bucket - by THIS claim's row alone, in the batch
    spoilsGrantStatement(db, player.id, 0, 'EXISTS (SELECT 1 FROM ketch_voyages WHERE voyage = ?5 AND account = ?1 AND nonce = ?6)', c.d, nonce),
  ]);
  const sailed = int(count?.results?.[0]?.n), guest = !player.handle ? { guest: true } : {};
  if (Number(row?.meta?.changes ?? 0) > 0) return { recorded: true, voyage: c.d, share: true, sailed, ...guest };
  const k = kept?.results?.[0] ?? null;
  return k?.owner === c.o ? { recorded: false, why: 'claimed', share: mine != null && k.cid === mine, sailed, ...guest } : { recorded: false, why: 'taken', share: false, sailed, ...guest };
}
