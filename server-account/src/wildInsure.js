// WILD-INSURE (2026-10-26, the owner: "Overhauling the open PvP to be a bit more palatable, being able to insure gear on
// death ... while retaining its punishment"; asked, "Kept, policy spent" at "20% of worth" - bible/11-Multiplayer/
// Wild-Zone.md section 4b): A POLICY ON A PIECE OF GEAR, WRITTEN AGAINST ITS PREMIUM OFF THE RECORD.
//
// The law is the leaf both ends read (src/systems/wild/wildInsureLaw.js): what may be insured, its premium, when it is in
// force. This service keeps the policies (`wild_insurance`, migration 0182 - 0181 until main's WOVEN-PAYS took 0177) - never the record, which its own tab writes:
// a policy a game could write onto a piece would be one it never paid for. A policy is written as a realm act
// (`/v1/wild/insure`): the premium paid off the record where its tab says it stands (realm.js prepareRealmRecord;
// net/realm/realmGoldLaw.js payFromSave - the purse, its letters, then the bank, as every act pays) and the rows written
// in the same batch, or neither lands. A fall spends them (wild.js wildFall), and `/v1/wild/policies` lists the ones in
// force for the character's tab. A guest has no realm character, and so no policy.
// AUDIT PVP-EASE L1-2, L4-2: a policy whose piece the record holds nowhere (sold, traded, salvaged, dropped before it was in
// force - wildPolicyHeld) LAPSES at the next insure, in its batch, and only the held count toward WILD_INSURE_MAX: before,
// such a policy stood 'active' for good, and 32 of them shut the door on the character for ever.
import {
  prepareRealmRecord,
  realmAtOf,
  realmActFirst,
  recordMovedOf,
  mustChange,
  dropIfUnnamed,
  dropObjects,
  REALM_ID_RE,
} from './realm.js';
import { payFromSave } from '../../src/net/realm/realmGoldLaw.js';
import {
  wildInsurable,
  wildPremium,
  insureKeyOf,
  wildPolicyKeyOk,
  wildPolicyHeld,
  WILD_INSURE_ASK_MAX,
  WILD_INSURE_MAX,
  WILD_INSURE_SETTLE_S,
} from '../../src/systems/wild/wildInsureLaw.js';

/** A policy row as its tab reads it: the piece's key, the premium paid, when written and when in force. */
const policyView = (/** @type {any} */ p) => ({
  key: String(p.key),
  premium: Number(p.premium),
  at: Number(p.at),
  live: Number(p.at) + WILD_INSURE_SETTLE_S,
});

/** The keys of a character's policies in force (state 'active'). @param {any} db @param {string} charId */
const activeOf = async (db, charId) =>
  (
    await db
      .prepare("SELECT key, premium, at FROM wild_insurance WHERE char_id = ?1 AND state = 'active' ORDER BY at")
      .bind(charId)
      .all()
  ).results ?? [];

/**
 * /v1/wild/insure - POLICIES WRITTEN: `body.realm` where the caller's record stands (its tab's `at`), `body.keys` the
 * keys (wildInsureLaw.js insureKeyOf) of 1..WILD_INSURE_ASK_MAX pieces in its pack or worn, `body.region` the bank the shortfall is paid from (as
 * every realm act's). Each piece must be insurable (wildInsureLaw.js wildInsurable) and under no policy in force, and the
 * character may hold WILD_INSURE_MAX at once. The premiums - each wildPremium - are paid off the record and the policies
 * written in one batch. Answers `{ policies, gold, realm }` - the policies written, the gold paid, where the record stands
 * - or `{ error }`: 'body', 'no-realm-character', 'insure-held' (a key under a policy in force), 'insure-full' (WILD_INSURE_MAX
 * policies on pieces the record still holds),
 * 'insure-piece' (a key the record holds no insurable piece by, or two pieces by), 'realm-gold' (the premiums not covered), the record's own
 * words ('lease', 'seq').
 * @param {any} ctx `{ db, bucket, rand, nowS }` @param {any} player the session's account @param {any} body
 */
export async function wildInsure(ctx, player, body) {
  const keys = Array.isArray(body?.keys) ? body.keys : null;
  if (
    !keys ||
    keys.length < 1 ||
    keys.length > WILD_INSURE_ASK_MAX ||
    !keys.every(wildPolicyKeyOk) ||
    new Set(keys).size !== keys.length
  )
    return { error: 'body' };
  const at = realmAtOf(body?.realm);
  if (!at) return { error: 'no-realm-character' };
  const side = await realmActFirst(ctx.db, player.id, at.id, body.realm); // where the record stands, before any other word
  if (side.error) return side;
  if (!side.at) return { error: 'no-realm-character' };
  const active = await activeOf(ctx.db, side.at.id);
  const held = new Set(active.map((p) => String(p.key)));
  if (keys.some((k) => held.has(k))) return { error: 'insure-held' };
  const region = Number.isSafeInteger(body?.region) ? body.region : null;
  /** @type {Map<string, number>} */ const premiums = new Map();
  /** @type {string[]} */ let lapsed = [];
  const prep = await prepareRealmRecord(ctx, player.id, side.at, (save) => {
    lapsed = [...held].filter((k) => !wildPolicyHeld(save, k));
    if (held.size - lapsed.length + keys.length > WILD_INSURE_MAX) return 'insure-full';
    const pack = Array.isArray(save?.items) ? save.items : [];
    for (const k of keys) {
      const named = pack.filter((it) => insureKeyOf(it) === k); // INSURE-ALL: a plain piece by its own id; a key two carry, none
      const piece = named.length === 1 ? named[0] : null;
      if (!piece || !wildInsurable(piece)) return 'insure-piece';
      premiums.set(k, wildPremium(piece));
    }
    const gold = [...premiums.values()].reduce((a, b) => a + b, 0);
    return payFromSave(save, gold, region) ? null : 'realm-gold';
  });
  if (prep.error) return prep;
  const gold = [...premiums.values()].reduce((a, b) => a + b, 0);
  try {
    await ctx.db.batch([
      ...prep.steps,
      // a policy spent before is written afresh; one in force is never written over - each row guarded, so a policy a
      // race wrote first fails the whole batch, premium and all (the record's sequence guards the same race)
      ...keys.flatMap((k) => [
        ctx.db
          .prepare(
            `INSERT INTO wild_insurance (char_id, key, player, premium, at, state) VALUES (?1, ?2, ?3, ?4, ?5, 'active')
        ON CONFLICT (char_id, key) DO UPDATE SET player = ?3, premium = ?4, at = ?5, state = 'active', spent_r = NULL, spent_at = NULL WHERE wild_insurance.state != 'active'`,
          )
          .bind(side.at.id, k, player.id, premiums.get(k), ctx.nowS),
        mustChange(ctx.db),
      ]),
      ...lapsed.map((k) =>
        ctx.db
          .prepare(
            "UPDATE wild_insurance SET state = 'lapsed', spent_at = ?3 WHERE char_id = ?1 AND key = ?2 AND state = 'active'",
          )
          .bind(side.at.id, k, ctx.nowS),
      ),
    ]);
  } catch (e) {
    if (await dropIfUnnamed(ctx.db, ctx.bucket, player.id, side.at.id, prep.key)) {
      // landed, its answer lost
      return {
        policies: keys.map((k) => policyView({ key: k, premium: premiums.get(k), at: ctx.nowS })),
        gold,
        realm: { seq: prep.seq },
      };
    }
    const moved = await recordMovedOf(ctx.db, player.id, side.at);
    if (moved) return moved;
    throw e;
  }
  await dropObjects(ctx.bucket, [prep.prev]);
  return {
    policies: keys.map((k) => policyView({ key: k, premium: premiums.get(k), at: ctx.nowS })),
    gold,
    realm: { seq: prep.seq },
  };
}

/** /v1/wild/policies - A CHARACTER'S POLICIES IN FORCE: `body.character` a realm character of the caller's. Answers
 *  `{ policies }`, each `{ key, premium, at, live }` (`live` the moment it keeps from a fall), the oldest first.
 *  @param {any} ctx @param {any} player @param {any} body */
export async function wildPolicies(ctx, player, body) {
  const id = typeof body?.character === 'string' && REALM_ID_RE.test(body.character) ? body.character : null;
  if (!id) return { error: 'body' };
  const mine = await ctx.db
    .prepare('SELECT 1 AS x FROM realm_characters WHERE id = ?1 AND player = ?2')
    .bind(id, player.id)
    .first();
  if (!mine) return { error: 'no-realm-character' };
  return { policies: (await activeOf(ctx.db, id)).map(policyView) };
}
