// @ts-check
// GUILD-SHOP (2026-10-30; bible/11-Multiplayer/Guild-Shop.md): EVERY GUILD'S ARMS THE CLIENT KNOWS, BY ITS TAG - its
// heraldry and its approved logo. A peer's token names its guild's tag alone (identityToken.js `gt`), so the faces that
// draw a peer's guild - the Insignia Armlet, the Guild Crest, a sail - ask here, and a tag not yet known is asked of the
// service in one batch (server-account/src/guildShop.js guildArmsOf). The reader's own guild is told by its guild book.
// Module state, so no host grows a line for it (HOST-SPLIT). The client's alone; not a DFU member.
import { heraldryOf, heraldryKey } from '../heraldryLaw.js';
import { GUILD_TAG_RE } from './guildLaw.js';

/** How long a guild's arms are believed before they are asked again (ms), and the least time between two asks. */
export const ARMS_FRESH_MS = 10 * 60_000;
export const ARMS_ASK_GAP_MS = 2_000;
/** The most tags one ask names (guildShop.js GUILD_ARMS_ASK_MAX). */
export const ARMS_ASK_MAX = 32;

/** @type {Map<string, { heraldry: any, logo: string|null, name: string|null, at: number }>} */
const _arms = new Map();
/** @type {Set<string>} */
const _wanted = new Set();
/** @type {{ arms?: (tags: string[]) => Promise<any>, logoUrl?: (id: string) => string|null } | null} */
let _door = null;
let _asking = false, _askedAt = -Infinity, _version = 0;
let _now = () => Date.now();

/** The service's guild door (net/accountClient.js accountGuilds) - set by the guild book; null offline. */
export function setArmsDoor(/** @type {any} */ door, /** @type {() => number} */ now = () => Date.now()) { _door = door ?? null; _now = now; }
/** Moves whenever a guild's arms change here - a face keyed on it draws again. */
export const armsVersion = () => _version;
/** A guild's arms told by a source the client already trusts (the reader's own guild's view, an arms ask's answer). */
export function noteGuildArms(/** @type {unknown} */ tag, /** @type {unknown} */ heraldry, /** @type {unknown} */ logo = null, /** @type {unknown} */ name = null) {
  if (typeof tag !== 'string' || !GUILD_TAG_RE.test(tag)) return;
  const h = heraldryOf(heraldry), l = typeof logo === 'string' && logo ? logo : null;
  const was = _arms.get(tag);
  _wanted.delete(tag);
  _arms.set(tag, { heraldry: h, logo: l, name: typeof name === 'string' ? name : was?.name ?? null, at: _now() });
  if (!was || heraldryKey(was.heraldry) !== heraldryKey(h) || was.logo !== l) _version++;
}
/** A guild's arms by its tag - `{ heraldry, logo }` (either may be null), or null while unknown. An unknown or stale tag
 *  is asked of the service, a batch at a time. */
export function guildArmsOf(/** @type {unknown} */ tag) {
  if (typeof tag !== 'string' || !GUILD_TAG_RE.test(tag)) return null;
  const e = _arms.get(tag);
  if (!e || _now() - e.at > ARMS_FRESH_MS) { _wanted.add(tag); askSoon(); }
  return e ? { heraldry: e.heraldry, logo: e.logo } : null;
}
/** @type {string|null} the reader's own guild's tag, as its guild book last read it */
let _own = null;
/** The reader's own guild's tag (null for none) - its guild book's word at every look. */
export function noteOwnGuild(/** @type {unknown} */ tag) { _own = typeof tag === 'string' && GUILD_TAG_RE.test(tag) ? tag : null; }
/** The reader's own guild's arms - what my own Insignia Armlet and Guild Crest wear - or null in no guild. */
export const ownGuildArms = () => (_own ? guildArmsOf(_own) : null);
/** @type {any} the arms of the guild whose hall stands round the reader now, as its decor read said them */
let _hall = null;
/** @type {((id: string) => unknown) | null} */
let _peerTag = null;
/** @type {((id: string) => unknown) | null} */
let _peerCloth = null;
/** GUILD-SHOP: a guild hall's arms, told with its pieces (server-account/src/decor.js decorOf's `arms`); null for none. */
export function noteHallArms(/** @type {any} */ arms) {
  _hall = arms && typeof arms === 'object' ? { heraldry: heraldryOf(arms.heraldry), logo: typeof arms.logo === 'string' ? arms.logo : null } : null;
  if (typeof arms?.tag === 'string') noteGuildArms(arms.tag, arms.heraldry, arms.logo ?? null, arms.name ?? null);
}
/** The arms the hall's own pieces wear (its banners and shields) - the last hall's read, or null. */
export const hallArms = () => _hall;
/** A logo's picture address, or null - the door's service under its id. */
export const guildLogoSrc = (/** @type {unknown} */ id) => (typeof id === 'string' && _door?.logoUrl ? _door.logoUrl(id) : null);
/** A pair of arms' one key - its heraldry's and its logo's - for a picture painted from them. */
export const armsKey = (/** @type {any} */ arms) => `${heraldryKey(arms?.heraldry)}#${arms?.logo ?? ''}`;

/** @type {any} */
let _timer = null;
function askSoon() {
  if (_asking || !_door?.arms || !_wanted.size) return;
  // AUDIT GUILD-SHOP C6: a tag wanted inside the gap is asked when it ends - a one-off asker (a profile card) waited forever
  const wait = ARMS_ASK_GAP_MS - (_now() - _askedAt);
  if (wait > 0) { if (!_timer && typeof setTimeout === 'function') { _timer = setTimeout(() => { _timer = null; askSoon(); }, wait); _timer?.unref?.(); } return; }
  _asking = true; _askedAt = _now();
  const tags = [..._wanted].slice(0, ARMS_ASK_MAX);
  Promise.resolve(_door.arms(tags)).then((r) => {
    const got = r?.ok ? r.data?.arms ?? {} : null;
    if (!got) return;
    for (const t of tags) {
      const a = got[t];
      noteGuildArms(t, a?.heraldry ?? null, a?.logo ?? null, a?.name ?? null);   // a tag no guild bears is known as none
    }
  }).catch(() => {}).finally(() => { _asking = false; if (_wanted.size) askSoon(); });
}

/** GUILD-SHOP: a peer's guild tag by their id (online.js guildTagOf - their token's), as the host that holds the session
 *  wires it (scenes/auraHost.js); null for none or before it is wired. A boat's sailcloth flies its owner's arms by it. */
export function setPeerTagReader(/** @type {((id: string) => unknown) | null} */ fn) { _peerTag = typeof fn === 'function' ? fn : null; }
/** AUDIT GUILD-SHOP S2: whether a peer's token says the Guild Sailcloth is theirs (online.js sailclothOf), as the same host
 *  wires it; false before it is wired. A peer's boat flies a sailcloth only on it. */
export function setPeerClothReader(/** @type {((id: string) => unknown) | null} */ fn) { _peerCloth = typeof fn === 'function' ? fn : null; }
export const peerHoldsCloth = (/** @type {string} */ id) => _peerCloth?.(id) === true;
export const peerGuildTag = (/** @type {string} */ id) => { const t = _peerTag?.(id); return typeof t === 'string' && GUILD_TAG_RE.test(t) ? t : null; };
/** For the tests: everything forgotten. */
export function _resetArmsBook() { if (_timer) clearTimeout(_timer); _timer = null; _peerTag = null; _peerCloth = null; _hall = null; _own = null; _arms.clear(); _wanted.clear(); _door = null; _asking = false; _askedAt = -Infinity; _version = 0; _now = () => Date.now(); }
