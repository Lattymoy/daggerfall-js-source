// @ts-check
// THANKS-POST (2026-10-30, the owner: "every current player should be grant 500 free aurem on the update to their inbox and
// a free arm armoury aura"; bible/06-Systems/Aurum.md section 3c): THE GIFTS' LAW - what a gift gives, and which an account
// holds. A gift is written once, by a migration, onto every registered account standing when it runs: its key on
// `players.gifts` (space-separated), its Aurum a ledger line `gift` ref the key, and a letter in the post naming it. What
// it gives is read off its key at every ask, so nothing is stored twice. A leaf: imports nothing. Not a DFU member.

/** Every gift: its Aurum and the Aura Armory pieces it gives. */
export const GIFTS = Object.freeze({
  thanks: Object.freeze({ aurum: 500, armory: Object.freeze(['crystalspurs']) }),
});
const GIFT_RE = /^[a-z]{3,24}$/;
/** The gift keys a row holds - `players.gifts`, known ones alone, each once. Pure. */
export function giftsOf(/** @type {any} */ row) {
  const raw = typeof row?.gifts === 'string' ? row.gifts : '';
  return [...new Set(raw.split(' ').filter((k) => GIFT_RE.test(k) && Object.hasOwn(GIFTS, k)))];
}
/** The Aura Armory pieces a row's gifts give. Pure. */
export const giftPiecesOf = (/** @type {any} */ row) => giftsOf(row).flatMap((k) => GIFTS[/** @type {keyof typeof GIFTS} */ (k)].armory);
/** A gift by its key, or null. */
export const giftOf = (/** @type {unknown} */ key) => (typeof key === 'string' && Object.hasOwn(GIFTS, key) ? GIFTS[/** @type {keyof typeof GIFTS} */ (key)] : null);
