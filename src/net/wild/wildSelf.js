// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WILD-HUBLESS (2026-10-27, bible/01-Overview/bugs/Field-Bugs-2026-10-25h.md WILD-REMAINS-LOSS) - WHO I AM IN THE ZONE.
//
// A fall's receipt names the fallen and the killer by the account its room knows each socket by (the token's subject,
// net/wild/wildReceipt.js `f` and `k`), and a remains order names the fallen the same way (`os`). The game read its own
// account only off the social hub's snapshot (net/social.js `acct`), so a game the hub had not seated - its link down,
// or its snapshot not yet in - never knew a fall was its own: it never took its drop, the killer's seizure took it off
// the record instead, and the fallen rose with every item still in its pack, playing a record that had moved under it.
// The signed-in session (net/accountClient.js storedSession) holds the same subject on every game that plays a realm
// character, hub or no hub, so it answers where the hub has not.
//
// No Daggerfall Unity reference: DFU has no online zone and no drop at death.
// ═══════════════════════════════════════════════════════════════════

import { storedSession } from '../accountClient.js';

/**
 * My account in the zone: the hub's word where it has seated me, else the signed-in session's; null for neither.
 * @param {{ acct?: string|null }|null|undefined} social the social picture (net/social.js SocialState), or null
 * @param {{ getItem(key: string): string|null }|null|undefined} storage where the session lives (systems/appStorage.js)
 * @returns {string|null}
 */
export const wildSelf = (social, storage) => social?.acct || storedSession(storage)?.id || null;
