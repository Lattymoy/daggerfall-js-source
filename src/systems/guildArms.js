// @ts-check
// WAGON-ARMS PASS B (2026-10-16): per-tag heraldry resolution for the
// arms painted onto a wagon's open side. A tag on the wire is only a
// shape; the picture needs the heraldry behind it, and that is fetched
// here, cached by tag, and broadcast through a global epoch so the pool
// knows to rebuild and upload the painted record.
import { caravanGuildTag } from './caravanVisit.js';   // GUILD_TAG_RE: a tag's one shape
import { heraldryOf } from '../net/heraldryLaw.js';   // GUILD1d: a heraldry in the law's shape, or null
import { accountGuilds } from '../net/accountClient.js';
import { appStorage } from './appStorage.js';

/** Per-tag cache: tag -> { heraldry, epoch }. `heraldry` is null for a
 *  guild that wears none (or an unknown tag); the entry's PRESENCE is
 *  what says "resolved", so a cached null is never re-fetched. */
export const guildArmsCache = new Map();

let _fetchArms = null;
/** Register a fetcher (world.js hands the guild-book's door). Falls
 *  back to its own account door when none is registered. */
export function setGuildArmsFetcher(fn) {
  if (typeof fn === 'function') _fetchArms = fn;
}

let _epochs = 1;
/** The pool reads this to know whether any tag has resolved since the
 *  last picture. */
export function guildArmsEpoch() { return _epochs; }

function fetcher() {
  if (_fetchArms) return _fetchArms;
  _fetchArms = (tags) => accountGuilds({ fetch: globalThis.fetch, storage: appStorage() }).arms(tags);
  return _fetchArms;
}

const _inflight = new Map();

/** Resolve (and cache) a tag's heraldry. Returns a promise of the
 *  heraldry (or null). Coalesces concurrent and repeated calls. */
export async function resolveGuildArms(tag) {
  const t = caravanGuildTag(tag);
  if (!t) return null;
  if (guildArmsCache.has(t)) return guildArmsCache.get(t).heraldry;
  if (_inflight.has(t)) return _inflight.get(t);

  const p = (async () => {
    let heraldry = null;
    try {
      const res = await fetcher()( [t] );
      const rows = Array.isArray(res?.body?.arms) ? res.body.arms : Array.isArray(res?.arms) ? res.arms : [];
      const row = rows.find((x) => x && x.tag === t);
      heraldry = heraldryOf(row?.heraldry ?? null);
    } catch (e) {
      heraldry = null;
    }
    guildArmsCache.set(t, { heraldry, epoch: ++_epochs });
    _inflight.delete(t);
    return heraldry;
  })();
  _inflight.set(t, p);
  return p;
}

/** Fire-and-forget: make sure resolution is in flight. Never throws. */
export function ensureGuildArms(tag) {
  const t = caravanGuildTag(tag);
  if (!t || guildArmsCache.has(t) || _inflight.has(t)) return;
  void resolveGuildArms(t).catch(() => {});
}

/** Synchronous read: a cached heraldry (or null when unknown / pending).
 *  A pending tag kicks off resolution. */
export function guildArmsSync(tag) {
  const t = caravanGuildTag(tag);
  if (!t) return null;
  if (guildArmsCache.has(t)) return guildArmsCache.get(t).heraldry ?? null;
  ensureGuildArms(t);
  return null;
}

/** Open-side's synchronous resolver: a heraldry when the tag is already
 *  resolved, otherwise null (and resolution is started). Called at
 *  picture-upload time; a later epoch rebuild supplies the arms. */
export function ownArmsForTag(tag) {
  const t = caravanGuildTag(tag);
  if (!t) return null;
  if (guildArmsCache.has(t)) return guildArmsCache.get(t).heraldry ?? null;
  ensureGuildArms(t);
  return null;
}

/** Seed a tag (e.g. the owner's own guild) without a network round-trip. */
export function seedGuildArms(tag, heraldry) {
  const t = caravanGuildTag(tag);
  if (!t) return;
  const h = heraldryOf(heraldry);
  const prev = guildArmsCache.get(t);
  guildArmsCache.set(t, { heraldry: h, epoch: ++_epochs });
  // keep inflight cleared
  _inflight.delete(t);
}