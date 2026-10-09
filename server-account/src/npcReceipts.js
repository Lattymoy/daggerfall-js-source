// @ts-check
// ═══════════════════════════════════════════════════════════════════
// CHAP2b (2026-10-08, Mac: "Keep going with the arc/slices") — THE
// RECEIPTS' STANDING AND THE RECEIPT WRITS: a gate closed or a raided town
// defended, by a realm character in a region where a guild it is a member
// of keeps a chapter, is remembered on its Roll - RECEIPT_REP a guild a
// receipt (Chapters-Arc 3.3), and HALL_WRIT_REP more for the chapter's
// receipt writ, its first such receipt of the UTC day there (section 4).
// The law is src/net/npcChapterLaw.js (receiptCreditsOf); the record is
// migration 0097_npc_receipts.
//
// AFTER THE RECEIPT, NEVER INSTEAD OF IT. The claim's own row is written
// first (accounts.js claimGate, raids.js claimRaid) and its answer stands
// whatever this one says: a credit that fails is answered `counted: false`
// and the claim is not refused for it (the seats' creditGate takes a kill
// the same way). The receipt is the relay's word; the region a gate's is
// the client's (the seats take it so, Seats-Arc 4.2), a raid's its key's.
//
// THE ROLL'S ONE GUARD. The credit moves the Roll's head under a tag of
// its own, so a claim that read the Roll before it is refused its write
// (`roll-busy`) and asked again - and its lines stand only under that tag,
// so the row moves by this write's credits alone. The claim sequence
// (`kseq`) is untouched: the service's own credit, additive (AUDIT CHAP2
// C1). Only while the character stands.
//
// CHAP3a: AND ITS MERIT - MERIT_RECEIPT to the chapters the receipt's own
// line (never the receipt writ's) credited - AUDIT CHAP3 E4: shared among
// them (meritOfReceipt) - in the same batch under the same tag (npcMerit.js
// meritStatement asks the tenure, the week's one chapter of a guild and
// the cap).
// ═══════════════════════════════════════════════════════════════════

import { chaptersOpenFor } from './npcRoll.js';
import { meritStatement, meritOfAct } from './npcMerit.js';   // CHAP3a: a receipt's Merit
import { regionChapters } from './npcHalls.js';
import { REALM_ID_RE } from './realm.js';
import { regionOk } from '../../src/net/nodeLaw.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { gateTimes } from '../../src/net/gateLaw.js';   // AUDIT CHAP3 E1: the week a gate rose in
import { MAX_REPUTATION } from '../../src/systems/guildFactions.js';
import {
  RECEIPT_KINDS, receiptCreditsOf, receiptRef, receiptWritRef, hallReceiptKindsOf, hallHidden, meritOfReceipt, meritWeekOf,
} from '../../src/net/npcChapterLaw.js';

/** A write's own tag: eight random bytes, hex (npcRoll.js mints its own the same way). */
function mintTag(/** @type {((b: Uint8Array) => Uint8Array) | undefined} */ rand) {
  const draw = rand ?? ((b) => globalThis.crypto.getRandomValues(b));
  let out = '';
  for (const x of draw(new Uint8Array(8))) out += x.toString(16).padStart(2, '0');
  return out;
}

/** The guild factions a realm character of the account is a member of on its Roll - none with no Roll, for another
 *  account's character, or for one dead. */
export async function membersOf(/** @type {any} */ db, /** @type {string} */ player, /** @type {unknown} */ character) {
  if (typeof character !== 'string' || !REALM_ID_RE.test(character)) return [];
  const { results = [] } = await db.prepare(`SELECT faction_id FROM npc_roll WHERE char_id = ?1 AND player = ?2 AND member = 1
    AND EXISTS (SELECT 1 FROM realm_characters WHERE id = ?1 AND player = ?2 AND dead_at IS NULL) ORDER BY faction_id`).bind(character, player).all();   // AUDIT CHAP3 T9: in the guilds' order, never the index's
  return results.map((/** @type {any} */ r) => Number(r.faction_id));
}

/**
 * A RECEIPT REMEMBERED: `{ character, kind, id, region }` - the realm character that fought, 'gate' or 'raid', the
 * receipt's own id (a gate's day, a raid's key) and the region it stood in. Answers `{ counted: true, credited: [{ f,
 * amount }], merit: [{ f, amount }] }` (CHAP3a: the Merit its chapters count it, npcMerit.js), or `{ counted: false, why }`: 'chapters-closed', 'no-receipt', 'no-region', 'old-week' (AUDIT CHAP3 E1: a gate risen in another seat week), 'no-member' (no Roll, no
 * guild on it, another account's character or a dead one), 'no-chapter' (none of its guilds keeps one there), 'credited' (this receipt's lines already stand),
 * 'busy' (a race lost - the receipt stands; its credit is asked by no one again), 'server'.
 * @param {{ db: any, nowS: number, rand?: (b: Uint8Array) => Uint8Array }} ctx @param {{ id: string }} player @param {any} env @param {any} body
 */
export async function creditReceipt({ db, nowS, rand }, player, env, { character, kind, id, region } = {}) {
  try {
    if (!chaptersOpenFor(player, env)) return { counted: false, why: 'chapters-closed' };
    if (!RECEIPT_KINDS.includes(kind) || id == null || id === '') return { counted: false, why: 'no-receipt' };
    if (!regionOk(region)) return { counted: false, why: 'no-region' };
    // AUDIT CHAP3 E1: a gate of another week counts for no chapter - its Merit would be this week's for a gate of the last
    // (a receipt lives seven days, so a week's gates banked and claimed in one); the seats' creditGate's own law
    if (kind === 'gate' && (!Number.isSafeInteger(id) || meritWeekOf(Math.floor(gateTimes(Number(id)).riseAt / 1000)) !== meritWeekOf(nowS))) {
      return { counted: false, why: 'old-week' };
    }
    const members = await membersOf(db, player.id, character);
    if (!members.length) return { counted: false, why: 'no-member' };
    const credits = receiptCreditsOf({ kind, id, day: utcDay(nowS), members, chapters: await regionChapters(db, region, nowS * 1000) });
    if (!credits.length) return { counted: false, why: 'no-chapter' };
    const { results: had = [] } = await db.prepare(`SELECT faction_id, ref FROM npc_receipt_credits WHERE char_id = ?1 AND ref IN (${credits.map((_, i) => `?${i + 2}`).join(', ')})`)
      .bind(character, ...credits.map((c) => c.ref)).all();
    const stood = new Set(had.map((/** @type {any} */ r) => `${r.faction_id}|${r.ref}`));
    if (credits.every((c) => stood.has(`${c.faction}|${c.ref}`))) return { counted: false, why: 'credited' };
    const tag = mintTag(rand);
    const own = credits.filter((c) => c.ref === receiptRef(kind, id));
    const tagged = 'EXISTS (SELECT 1 FROM npc_roll_heads WHERE char_id = ?1 AND tag = ?2)';
    const sum = '(SELECT COALESCE(SUM(amount), 0) FROM npc_receipt_credits WHERE char_id = ?1 AND faction_id = ?3 AND tag = ?2)';
    await db.batch([
      db.prepare(`UPDATE npc_roll_heads SET seq = seq + 1, tag = ?2, updated_at = ?3 WHERE char_id = ?1 AND player = ?4
        AND EXISTS (SELECT 1 FROM realm_characters WHERE id = ?1 AND player = ?4 AND dead_at IS NULL)`).bind(character, tag, nowS, player.id),
      ...credits.map((c) => db.prepare(`INSERT OR IGNORE INTO npc_receipt_credits (char_id, faction_id, ref, player, amount, tag, at)
        SELECT ?1, ?3, ?4, ?5, ?6, ?2, ?7 WHERE ${tagged}`).bind(character, tag, c.faction, c.ref, player.id, c.amount, nowS)),
      // never past DFU's 100, what is owed trimmed to the room left - as a hall writ's credit (professions.js deliverWrit)
      ...[...new Set(credits.map((c) => c.faction))].map((f) => db.prepare(`UPDATE npc_roll SET rep = MIN(?4, rep + ${sum}),
        owed = MAX(0, MIN(owed, ?4 - MIN(?4, rep + ${sum}))) WHERE char_id = ?1 AND faction_id = ?3 AND ${tagged}`).bind(character, tag, f, MAX_REPUTATION)),
      // CHAP3a: the receipt's Merit to each chapter whose receipt line this write made - AUDIT CHAP3 E4: its share of
      // the one receipt (meritOfReceipt), shared among every chapter the receipt reached
      ...own.map((c) => meritStatement(db, {
        player: player.id, character, faction: c.faction, region, source: kind, ref: c.ref, nowS, amountSql: '?11',
        guard: 'EXISTS (SELECT 1 FROM npc_receipt_credits WHERE char_id = ?2 AND faction_id = ?3 AND ref = ?7 AND tag = ?12)', binds: [meritOfReceipt(own.length), tag],
      })),
    ]);
    const { results: got = [] } = await db.prepare('SELECT faction_id AS f, SUM(amount) AS amount FROM npc_receipt_credits WHERE char_id = ?1 AND tag = ?2 GROUP BY faction_id ORDER BY faction_id')
      .bind(character, tag).all();
    if (!got.length) return { counted: false, why: 'busy' };
    return {
      counted: true, credited: got.map((/** @type {any} */ r) => ({ f: Number(r.f), amount: Number(r.amount) })),
      merit: await meritOfAct(db, character, kind, receiptRef(kind, id)),
    };
  } catch {
    return { counted: false, why: 'server' };
  }
}

/**
 * THE BOARD'S RECEIPT ASKS for a region and the character reading it: each chapter's asks by its guild's row
 * (hallReceiptKindsOf), `{ faction, kind, member, done }` - `member` whether the character is the guild's on its Roll,
 * `done` whether its receipt writ stands today. A hidden guild's asks to its members alone, as its delivery writs are.
 * None while the Chapters are not this account's.
 * @param {any} db @param {{ id: string }} player @param {any} env @param {unknown} character @param {number} region @param {number} nowS
 */
export async function receiptAsks(db, player, env, character, region, nowS) {
  if (!chaptersOpenFor(player, env) || !regionOk(region)) return [];
  const chapters = await regionChapters(db, region, nowS * 1000);
  if (!chapters.length) return [];
  const members = new Set(await membersOf(db, player.id, character));
  const day = utcDay(nowS);
  /** @type {Set<string>} */
  const done = new Set();
  if (members.size) {
    const { results = [] } = await db.prepare('SELECT faction_id, ref FROM npc_receipt_credits WHERE char_id = ?1 AND ref IN (?2, ?3)')
      .bind(character, receiptWritRef('gate', day), receiptWritRef('raid', day)).all();
    for (const r of results) done.add(`${r.faction_id}|${r.ref}`);
  }
  const out = [];
  for (const f of chapters) {
    if (hallHidden(f) && !members.has(f)) continue;
    for (const kind of hallReceiptKindsOf(f)) out.push({ faction: f, kind, member: members.has(f), done: done.has(`${f}|${receiptWritRef(kind, day)}`) });
  }
  return out;
}
