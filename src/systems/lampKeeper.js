// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LAMP-KEEPER II (2026-10-14, Mac: "Reimplement an old bug that was previously removed. A chance of finding a vendor NPC
// as a lamp model. Anybody that interacts with the lamp model should earn the 'I Love Lamp' title. Implement exclusive
// dialogue and ensure there is a loot popup for obtaining the title"): THE LAMP KEEPER, ITS LAW.
//
// THE BUG IT WAS (LAMP-KEEPER, FIELD BUGS 2026-09-26 - bible/01-Overview/bugs/Field-Bugs-2026-09-26.md report 15): Roleplay &
// Realism swaps a quality-13-plus shop's 182_2 keeper onto its own 197_6, registered lazy, and nothing asked for it - so
// the classic TEXTURE.197 record 6 drew in its place, Kludge Town's street lamp, stretched by the mod's XML scale
// (3 x 0.8), and a click on the lamp opened the shop. The fix (scenes/interiorContext.js standPerson's ask) stays.
//
// WHAT IT IS NOW: a chance, on purpose. A shop's keeper - the three keeper pictures the mod's law reads (182_0, 182_1,
// 182_2: rrVariants.js rrShopTavernRecord - 182_2 the bug's own), or (AUDIT FIVE-ASKS D4) whoever stands in the shop's
// own faction, the merchant drawn on any picture (a quality-20 armorer's 182_7, faction 1022 - Roleplay & Realism's
// ARMRAM03 building 14) - in a shop - stands as that lamp one day in LAMP_KEEPER_ODDS. The faction is the RMB's own, never
// FACTION.TXT's (loaded late, and not on every client by then), so the pick stays every client's. The pick is
// the room's own (`isLampKeeper`: the town, the building, the person's record and the day), so every client that walks
// in that day finds the same lamp, and the next day it is a keeper again. Its picture is the classic 197_6 always,
// whatever a pack replaces it with, uploaded under the port's own key (LAMP_ARCHIVE) so a keeper the mod draws on 197_6
// in the next shop is not touched; its size is the classic record's through the one billboard-size door, so with the
// mod's scale it stretches as the bug's did.
//
// A PRESS ON IT (scenes/worldModes.js activateStaticNpc's lamp arm): its own words (LAMP_LINES, one a day), Trade (the
// keeper's own shop, as the bug's click was) or Leave - and the title: the signed-in account's first word with a lamp
// lays I Love Lamp on its row (server-account/src/lamp.js; `createLampTitle` carries it) and the grant stands as a loot
// banner (ui/lootBanner.js announceHonour) beside its line.
//
// Pure but for the text core - the claim, the line and the banner are handed in. Not a DFU member. Ledger A
// (LAMP-KEEPER).
// ═══════════════════════════════════════════════════════════════════

import { t } from './textManager.js';
import { isShop } from './shopStock.js';
import { seededRng } from './wind/wind.js';

/** One day in this many a shop's keeper stands as the lamp. */
export const LAMP_KEEPER_ODDS = 25;
/** The keepers who may: archive 182's three keeper pictures (rrVariants.js rrShopTavernRecord's), in a shop. */
export const LAMP_KEEPER_ARCHIVE = 182;
export const LAMP_KEEPER_RECORDS = Object.freeze([0, 1, 2]);
/** The lamp: Kludge Town's street lamp, the classic TEXTURE.197 record 6 the bug drew. */
export const LAMP_CLASSIC = Object.freeze({ archive: 197, record: 6 });
/** The port's own key its classic picture is uploaded under (after world/portArt.js PORT_ARCHIVE's 38231, registered in
 *  world/eliteGates/pseudoArchives.js; AUDIT FIVE-ASKS D7 took 38241, which the Elite Breach's Broken Galleries hold - EG-G2's
 *  registry refused the pair at the merge of main into the Spire, and the lamp, a runtime key nothing stores, moved), so a
 *  pack's 197_6 - Roleplay & Realism's keeper - and the lamp never share one. */
export const LAMP_ARCHIVE = 38232;
/** The title, in the vocabulary's spelling (net/identityToken.js TITLES; server-account/src/lamp.js LAMP_TITLE). */
export const LAMP_TITLE = 'ilovelamp';
/** The pick's own stream, salted ('LAMP'). */
export const LAMP_SALT = 0x4c414d50;

/** Is `pn` (an interior person, as interiorPeople.js lists it) a keeper who may stand as the lamp in a building of
 *  `buildingType` whose faction is `buildingFactionId` - a keeper's picture, or the shop's own faction? */
export const isLampCandidate = (pn, buildingType, buildingFactionId = 0) => !!pn && isShop(buildingType)
  && ((pn.textureArchive === LAMP_KEEPER_ARCHIVE && LAMP_KEEPER_RECORDS.includes(pn.textureRecord))
    || (!!buildingFactionId && pn.factionID === buildingFactionId));

/**
 * THE PICK: does this keeper stand as the lamp today? The town's map id, the building's key, the person's record
 * position and the day - one answer for every client in the room that day. Pure.
 * @param {any} pn @param {{ buildingType?: number, buildingFactionId?: number, buildingKey?: number, mapId?: number, day?: number }} where
 */
export function isLampKeeper(pn, { buildingType = -1, buildingFactionId = 0, buildingKey = 0, mapId = 0, day = 0 } = {}) {
  if (!isLampCandidate(pn, buildingType, buildingFactionId)) return false;
  const seed = ((mapId >>> 0) ^ Math.imul(buildingKey | 0, 0x9e3779b1) ^ Math.imul(day | 0, 0x85ebca6b) ^ Math.imul((pn.position ?? 0) | 0, 0xc2b2ae35) ^ LAMP_SALT) >>> 0;
  return Math.floor(seededRng(seed)() * LAMP_KEEPER_ODDS) === 0;
}

/** The lamp's own words, one set a day (`lampLines(day)`), read when spoken. */
export const LAMP_LINES = Object.freeze([
  () => [t('lamp.line.0a', 'The lamp regards you.'), t('lamp.line.0b', '"Yes, I am a lamp. No, I do not wish to discuss it. Are you buying or not?"')],
  () => [t('lamp.line.1a', 'The lamp flickers, a little embarrassed.'), t('lamp.line.1b', '"I was an ordinary shopkeeper until the business in Kludge Town. Now I am a lamp. Trade has never been better."')],
  () => [t('lamp.line.2a', 'The flame leans toward you.'), t('lamp.line.2b', '"Do not stare at the wick, friend. It is rude, and it is also my face."')],
  () => [t('lamp.line.3a', 'The lamp burns a little brighter.'), t('lamp.line.3b', '"Twenty years behind this counter and nobody has ever asked how the lamp is doing. You are the first. I love you. I mean - I love lamp."')],
]);
/** One day's words. */
export const lampLines = (day = 0) => LAMP_LINES[((day | 0) % LAMP_LINES.length + LAMP_LINES.length) % LAMP_LINES.length]();

/** The rest of what it says, and what is said of it - read when spoken. */
export const LAMP_TEXT = Object.freeze({
  name: () => t('lamp.name', 'Lamp'),
  trade: () => t('lamp.trade', 'Trade'),
  leave: () => t('lamp.leave', 'Leave'),
  granted: () => t('lamp.granted', 'The lamp glows warmly. You have earned the title I Love Lamp.'),
  guest: () => t('lamp.guest', 'Add a username to your account to keep the title I Love Lamp.'),
  offline: () => t('lamp.offline', 'I Love Lamp is a title for your account. Speak to a lamp online to earn it.'),
  signin: () => t('lamp.signin', 'Sign in to an account to earn the title I Love Lamp.'),
});

/**
 * THE TITLE'S CARRIER: `speak()` at every press on a lamp. The first a session that the account service answers
 * `granted` says its line and raises its banner; `held` (granted before, on any device) and a grant say nothing more
 * for that account; a guest, a page with no session (or one the service stopped honouring - accountLamp forgets it) and
 * a host with no account service are told once; a failed call (the network) is asked again at the next press. All of it
 * is the signed-in account's (AUDIT FIVE-ASKS D2): `account()` another id - a sign-out and another sign-in on the page -
 * and it is asked afresh, and an answer that lands for an account no longer signed in is not kept. Answers what it did:
 * 'granted' | 'held' | 'guest' | 'signin' | 'offline' | 'busy' | 'failed' | 'done'.
 * @param {{ claim?: (() => Promise<any>) | null, account?: () => (string|null), say?: (text: string) => void, announce?: (kind: 'title', key: string) => any }} deps
 *   `claim` net/accountClient.js accountLamp's - `{ ok, data: { granted, why? } }` or `{ ok: false, error }`, never a
 *   throw; null where the host has no account service (offline, ?exterior); `account` accountLamp's - the stored
 *   session's account id
 */
export function createLampTitle({ claim = null, account = () => null, say = () => {}, announce = () => {} } = {}) {
  let busy = false, done = false, whose = /** @type {string|null|undefined} */ (undefined);
  const told = new Set();
  const tell = (k, text) => { if (!told.has(k)) { told.add(k); say(text); } };
  const who = () => account?.() ?? null;
  return {
    async speak() {
      const id = who();
      if (id !== whose) { whose = id; done = false; told.clear(); }   // another account: nothing it was told is its
      if (done) return 'done';
      if (!claim) { tell('offline', LAMP_TEXT.offline()); return 'offline'; }
      if (busy) return 'busy';
      busy = true;
      let a;
      try { a = await claim(); } catch { a = { ok: false, error: 'offline' }; } finally { busy = false; }
      if (who() !== id) return 'failed';   // signed out, or in as another, while it was asked
      if (a?.ok && a.data?.granted === true) { done = true; say(LAMP_TEXT.granted()); announce('title', LAMP_TITLE); return 'granted'; }
      if (a?.ok && a.data?.why === 'held') { done = true; return 'held'; }
      if (a?.ok && a.data?.why === 'guest') { tell('guest', LAMP_TEXT.guest()); return 'guest'; }
      if (a?.error === 'no-session' || a?.error === 'auth') { tell('signin', LAMP_TEXT.signin()); return 'signin'; }   // AUDIT FIVE-ASKS D3: online, but no account to earn it for
      return 'failed';
    },
  };
}
