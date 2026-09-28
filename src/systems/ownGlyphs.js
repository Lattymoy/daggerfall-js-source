// SHADOW-FANG (2026-09-26): WHAT IS TRUE OF THIS DEVICE'S OWN PLAYER, offline as well as on. The relay reads a
// player's glyphs off the signed token for everybody else; for the player's own screen the account service's last
// word is kept on the stored session (net/accountClient.js adoptIdentity - a token's glyphs, a wardrobe's), and read
// here. A local read of a cosmetic: what it dresses (the werewolf's skin) only this player sees.
import { storedSession, SESSION_KEY } from '../net/accountClient.js';
import { appStorage } from './appStorage.js';
import { werewolfSkinOf } from '../characters/werewolfSkin.js';

/** The glyphs the service last stated for this device's session, or none. The raw stored string is memoised, so a
 *  per-frame reader (weaponRig, while the player is transformed) parses nothing twice. */
let _raw;
let _glyphs = [];
export function ownGlyphs(storage = appStorage()) {
  let raw = null;
  try { raw = storage?.getItem?.(SESSION_KEY) ?? null; } catch { raw = null; }
  if (raw === _raw) return _glyphs;
  _raw = raw;
  const g = storedSession(storage)?.glyphs;
  _glyphs = Array.isArray(g) ? g : [];
  return _glyphs;
}

/** The skin this device's own player's werewolf wears, or null. */
export const ownWerewolfSkin = (storage = appStorage()) => werewolfSkinOf(ownGlyphs(storage));
