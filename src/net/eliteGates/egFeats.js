// @ts-check
// EG-E (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 19, FEATS OF THE SPIRE):
// THE LORDS' FEATS - three a lord, each a thing to master, not only survive, judged by the relay at the lord's fall from
// what its Court saw, and said on the Redoubt's `w` receipt (`ft`, three bits, with the lord's key `lk`) for the account
// service to keep (`eg_feats`): the first, UNBROKEN - no member fell in the Court; the second, SWIFT - the lord felled
// within EG_FEAT_SWIFT_MS of its wake; the third, the lord's own signature (the table below: Grath Scorched twice, the
// Examinations passed with none failed, the Twin Lords falling within 3 s of each other, ...). A band's feats, all held,
// are its Master's title (section 19's honours - server-account/src/eg.js).
//
// EG-ZB (2026-10-12; section 19's examples, EG-E's departure closed): a feat reads WHO A PLACE'S BLOW CAUGHT, not only the
// beats - the census keeps each blow's catch by its name on the fight (`F.cg`, net/eliteGates/egBrain.js egCount over net/bossRef.js's
// judges, an element's seen as a plain one's), so Grath's signature is the page's own: felled with no member caught by a
// burning bridge (once the bridges have burned).
//
// AUDIT EG V (lane1 #4, #5, #6 and #16; section 19): a signature reads ITS OWN LORD'S state where a second lord could speak the
// same words (THE TWIN COURT, THE OLD MASTERS, Clan Feud's champion): the Colossus's Breakdown on its own body (`kneelUntil`),
// never any lord's phase card; Ilthys's banners counted by kind (`F.mem.broke`, net/eliteGates/egLords.js egObjBroken), never a Spark's or
// any object's break; the Twin Lords' falls on their own bodies (`fellAt`), never the Redoubt's beat after the last lord's. And
// the Last Armsmaster's Challenge is met at n = 1 too (net/eliteGates/egLords.js challengeTick's open duel), so a company of one can hold
// the Galleries' Master.
//
// Pure. Not a DFU member. Ledger A (ELITE-GATES).

/** A lord felled this soon after its wake is SWIFT (ms). */
export const EG_FEAT_SWIFT_MS = 180_000;
/** The Twin Lords' signature: both fall this close together (ms). */
export const EG_FEAT_TWINS_MS = 3000;
/** EG-ZB: Grath's burning bridge, by the name its blow is said with (net/eliteGates/egLords.js - the Hound's phase two). */
export const EG_FEAT_BRIDGE = 'Burning Bridge';
/** EG-ZB: who a blow of name `nm` caught in fight `F` (the census's `F.cg` - net/eliteGates/egBrain.js egCount). */
export const egCaughtBy = (F, nm) => F?.cg?.[nm] ?? [];

/**
 * Each lord's signature feat: its name, its words, and its test over the Court's counted beats (`said` - each `esay` key
 * the Court spoke, counted), its fight (`F` - EG-ZB: who its blows caught, egCaughtBy) and the breach's state (`ctx`).
 * @type {Readonly<Record<string, Readonly<{ name: string, what: string, test: (said: Record<string, number>, F: any, ctx: { covenant?: number, now: number }) => boolean }>>>}
 */
export const EG_FEAT_SIGNS = Object.freeze({
  hound: Object.freeze({ name: 'Unsinged', what: 'Grath felled with no member caught by a burning bridge', test: (s, F) => (F.mem?.burnI ?? -1) >= 0 && !egCaughtBy(F, EG_FEAT_BRIDGE).length }),
  spellmaster: Object.freeze({ name: 'Perfect Marks', what: 'every Examination passed, none failed', test: (s) => (s.passed ?? 0) >= 1 && !(s.failed > 0) }),
  armsmaster: Object.freeze({ name: 'Every Challenge Met', what: 'two Challenges met', test: (s) => (s.challengewon ?? 0) >= 2 }),
  ilthys: Object.freeze({ name: 'No Ground Conceded', what: 'three of her banners broken', test: (s, F) => (F?.mem?.broke?.banner ?? 0) >= 3 }),
  cairnkeeper: Object.freeze({ name: 'The Tithe Paid', what: 'the Keeper laid bare twice', test: (s) => (s.bare ?? 0) >= 2 }),
  twins: Object.freeze({ name: 'Together', what: 'the Twin Lords falling within 3 s of each other', test: (s, F) => egTwinsTogether(F) }),
  morvayn: Object.freeze({ name: 'Unchained', what: 'two soul-chainings endured', test: (s) => (s.chaining ?? 0) >= 2 }),
  dusk: Object.freeze({ name: 'Wings Clipped', what: 'the Mother of Dusk dragged down twice', test: (s) => (s.grounded ?? 0) >= 2 }),
  stalker: Object.freeze({ name: 'Blood Unbound', what: 'two Blood Tethers broken', test: (s) => (s.tetherbroken ?? 0) >= 2 }),
  seyth: Object.freeze({ name: 'Through the Long Night', what: 'two Eclipses endured', test: (s) => (s.eclipse ?? 0) >= 2 }),
  colossus: Object.freeze({ name: 'Hearts Stilled', what: 'into its Breakdown with no heart relit', test: (s, F) => !(s.relit > 0) && (F?.bodies ?? []).some((b) => b.key === 'colossus' && (b.kneelUntil ?? 0) > 0) }),
  wyrm: Object.freeze({ name: 'Brought to Earth', what: 'the Wyrm landed twice', test: (s) => (s.landed ?? 0) >= 2 }),
  garoth: Object.freeze({ name: 'Before the Covenant', what: 'Garoth felled before the Covenant pressed', test: (s, F, ctx) => !ctx.covenant }),
});
/** AUDIT EG V (lane1 #6; section 19, the Twin Lords' "Together"): did both twins fall, each at its own last fall's instant (a lord
 *  body's `fellAt`, net/eliteGates/egLords.js egLordHit - set again at each fall), within EG_FEAT_TWINS_MS of each other - whatever lord of
 *  the fight outlived them? A lord body is known by its `key` (net/eliteGates/egLords.js stand). Pure. */
export function egTwinsTogether(F) {
  const T = (F?.bodies ?? []).filter((b) => b.key === 'twins');
  return T.length === 2 && T.every((b) => (b.fellAt ?? 0) > 0) && Math.abs(T[0].fellAt - T[1].fellAt) <= EG_FEAT_TWINS_MS;
}
/** The feats' common names (bits 0 and 1). */
export const EG_FEAT_UNBROKEN = 'Unbroken';
export const EG_FEAT_SWIFT = 'Swift';
/** The bands' lords (section 13.3), whose feats, all held, are the band's Master. */
export const EG_FEAT_BANDS = Object.freeze([
  Object.freeze(['hound', 'spellmaster', 'armsmaster', 'ilthys']), Object.freeze(['cairnkeeper', 'twins', 'morvayn']),
  Object.freeze(['dusk', 'stalker', 'seyth']), Object.freeze(['colossus', 'wyrm', 'garoth']),
]);
/** All three of a lord's feats. */
export const EG_FEATS_ALL = 0b111;

/**
 * THE FEATS AT A LORD'S FALL: its three bits - Unbroken (no member fell in the Court), Swift (felled within
 * EG_FEAT_SWIFT_MS of its wake), its signature. 0 for a key with no feats (a champion).
 * @param {string} lord @param {any} F the Court's fight (`said`, `fellThisHall`, `lordAt`, `mem`) @param {{ covenant?: number, now: number }} ctx
 */
export function egFeatBits(lord, F, ctx) {
  const S = EG_FEAT_SIGNS[lord];
  if (!S || !F) return 0;
  let bits = 0;
  if (!((F.fellThisHall ?? 0) > 0)) bits |= 1;
  if ((F.lordAt ?? 0) > 0 && ctx.now - F.lordAt <= EG_FEAT_SWIFT_MS) bits |= 2;
  if (S.test(F.said ?? {}, F, ctx)) bits |= 4;
  return bits;
}
/** The words of a lord's feat `k` (0 Unbroken, 1 Swift, 2 its signature). */
export function egFeatName(lord, k) {
  if (k === 0) return EG_FEAT_UNBROKEN;
  if (k === 1) return EG_FEAT_SWIFT;
  return EG_FEAT_SIGNS[lord]?.name ?? '';
}
/** Does `held` (lord key to its bits) hold every feat of band `b`'s lords? */
export const egBandMastered = (held, b) => (EG_FEAT_BANDS[b] ?? []).every((k) => ((held?.[k] ?? 0) & EG_FEATS_ALL) === EG_FEATS_ALL);
