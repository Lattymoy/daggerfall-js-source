// SHADOW-FANG (2026-09-26): WHAT IS TRUE OF THIS DEVICE'S OWN PLAYER, offline as well as on. The relay reads a
// player's glyphs off the signed token for everybody else; for the player's own screen the account service's last
// word is kept on the stored session (net/accountClient.js adoptIdentity - a token's glyphs, a wardrobe's), and read
// here. A local read of a cosmetic: what it dresses (the werewolf's skin) only this player sees.
// WB9g (2026-09-30): and the aura this player wears at their feet (ownAura) - the same stored word, the same reading.
// NAME-AS (2026-10-12): and when this device last chose the name its player wears online (ownNameAsAt) - the same.
// WITCH1 (2026-10-20): and the profile icon this player wears (ownIcon) - the same.
import { storedSession, SESSION_KEY } from '../net/accountClient.js';
import { appStorage } from './appStorage.js';
import { werewolfSkinOf } from '../characters/werewolfSkin.js';
import { AURAS, ICONS } from '../net/identityToken.js';   // WB9g; WITCH1: and the icons

/** The glyphs the service last stated for this device's session, or none. The raw stored string is memoised, so a
 *  per-frame reader (weaponRig, while the player is transformed) parses nothing twice. */
let _raw;
let _glyphs = [];
let _aura = null;
let _icon = null;
let _nameAsAt = null;
function read(storage) {
  let raw = null;
  try { raw = storage?.getItem?.(SESSION_KEY) ?? null; } catch { raw = null; }
  if (raw === _raw) return;
  _raw = raw;
  const s = storedSession(storage);
  _glyphs = Array.isArray(s?.glyphs) ? s.glyphs : [];
  _aura = typeof s?.aura === 'string' && AURAS.includes(s.aura) ? s.aura : null;
  _icon = typeof s?.icon === 'string' && ICONS.includes(s.icon) ? s.icon : null;
  _nameAsAt = Number.isSafeInteger(s?.nameAsAt) && s.nameAsAt > 0 ? s.nameAsAt : null;
}
export function ownGlyphs(storage = appStorage()) { read(storage); return _glyphs; }
/** WB9g: the aura the service last stated this device's player wears (a token's, a wardrobe's after any wear), or null -
 *  per frame, under the fire at their own feet (scenes/world.js auraFrame); nothing parsed twice. */
export function ownAura(storage = appStorage()) { read(storage); return _aura; }
/** WITCH1: the profile icon the service last stated this device's player wears, or null (the character's face) - the
 *  profile mark's and the account card's portrait (ui/profileIcons.js). */
export function ownIcon(storage = appStorage()) { read(storage); return _icon; }
/** NAME-AS: the moment the service took a choice of name made on this device (ui/accountFlow.js chooseName), or null -
 *  per frame, where the world host asks whether the room must hear the new name (scenes/world.js nameAsFrame). */
export function ownNameAsAt(storage = appStorage()) { read(storage); return _nameAsAt; }

/** The skin this device's own player's werewolf wears, or null. */
export const ownWerewolfSkin = (storage = appStorage()) => werewolfSkinOf(ownGlyphs(storage));
