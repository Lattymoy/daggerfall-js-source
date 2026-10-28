// @ts-check
// WILD-HUBLESS (bible/01-Overview/bugs/Field-Bugs-2026-10-25h.md WILD-REMAINS-LOSS): WHO I AM IN THE ZONE.
// A fall receipt and a remains order name the fallen by the account its room knows (the token's subject). The game read
// its account only off the social hub's snapshot, so a game the hub had not seated never took its own drop. The signed-in
// session holds the same subject with or without the hub. No Daggerfall Unity reference: DFU has no online zone.

import { storedSession } from '../accountClient.js';

/**
 * My account in the zone: the hub's word where it has seated me, else the signed-in session's; null for neither.
 * @param {{ acct?: string|null }|null|undefined} social the social picture (net/social.js SocialState), or null
 * @param {{ getItem(key: string): string|null }|null|undefined} storage where the session lives (systems/appStorage.js)
 * @returns {string|null}
 */
export const wildSelf = (social, storage) => social?.acct || storedSession(storage)?.id || null;
