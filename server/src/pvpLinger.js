// @ts-check
// PVP-LINGER, the relay's half (net/wild/wildLinger.js holds the law; bible/11-Multiplayer/PvP-Rework.md PVP-LINGER). A
// fighter's last socket gone inside its lock leaves a body: its referee entry stays in the zone, peers keep its last pose
// (said again each PVP_LINGER.sayMs) and its leave waits. A blow finds it by its old id (`lingerTarget`); a fall on it is
// signed as one whose fallen is away (index.js `_wildSign`, `g` 1 - its killer carries the receipt). The body goes as a
// normal leave when the law says, or at once when its account says hello here again or stands in another room.
import { wildGone } from '../../src/net/wild/wildRef.js';
import { seaGone } from '../../src/net/sea/seaRef.js';
import { lingerUntil, lingerOver, lingerAwayWord, PVP_LINGER, LINGER_AWAY } from '../../src/net/wild/wildLinger.js';
import { badged } from './relay.js';

/** `_leave`, the last socket of `a`'s account here gone (`look` its look): its body kept while its lock runs. Its ship
 *  leaves the guns at once. Answers whether it stays. */
export function lingerHold(
  /** @type {any} */ room,
  /** @type {any} */ a,
  /** @type {any} */ look,
  /** @type {number} */ now,
) {
  const st = room._wildRef,
    x = st?.fighters.get(a.sub);
  if (a.hid || !lingerUntil(x, now)) return false;
  const book = (room._lingers ??= new Map());
  if (book.size >= PVP_LINGER.max) return false;
  book.set(a.sub, { id: a.id, at: now, att: { ...a }, look: look ?? null, saidAt: now, askAt: now });
  seaGone(st, a.sub, now);
  return true;
}

/** A blow's target by its peer id: a lingering body's `[null, its attachment]`, or null. */
export function lingerTarget(/** @type {any} */ room, /** @type {string} */ id) {
  for (const rec of room._lingers?.values() ?? []) if (rec.id === id) return [null, rec.att];
  return null;
}

/** A body gone: out of the zone (its carry at the hub), its leave said to the room. */
function lingerEnd(
  /** @type {any} */ room,
  /** @type {string} */ sub,
  /** @type {any} */ rec,
  /** @type {number} */ now,
) {
  room._lingers.delete(sub);
  if (room._wildRef) {
    wildGone(room._wildRef, sub, now);
    room._wildLeaveCarry(rec.att, now);
  }
  room._fanBut(null, JSON.stringify({ t: 'leave', id: rec.id }));
}

/** The account's body taken back by its socket `ws` here: no second body, the fighter its own again. */
function lingerTaken(/** @type {any} */ room, /** @type {any} */ ws, /** @type {any} */ b, /** @type {any} */ rec) {
  room._lingers.delete(b.sub);
  const x = room._wildRef?.fighters.get(b.sub);
  if (x) {
    x.id = b.id;
    x.lingerBack = true;
  }
  if (rec.id !== b.id) room._fanBut(ws, JSON.stringify({ t: 'leave', id: rec.id }));
}

/** An account's live socket here, never one on its way out. */
const liveOf = (/** @type {any} */ room, /** @type {string} */ sub) => {
  for (const w of room._bySub().get(sub) ?? []) if (!room._gone.has(w)) return [w, room._all().get(w)];
  return null;
};

/** The zone's beat (`_wildBeat`, `_wildHello`): each body taken back, gone, or its pose said again. */
export async function lingerStep(/** @type {any} */ room, /** @type {number} */ now) {
  const book = room._lingers;
  if (!book?.size) return;
  for (const [sub, rec] of [...book]) {
    const live = liveOf(room, sub);
    if (live) {
      lingerTaken(room, live[0], live[1], rec);
      continue;
    }
    if (lingerOver(rec, room._wildRef?.fighters.get(sub), now)) {
      lingerEnd(room, sub, rec, now);
      continue;
    }
    if (now - rec.askAt >= PVP_LINGER.askMs) {
      rec.askAt = now;
      const c = await room._wildCarryAsk(sub); // a log-in in another room: its word there is the newer
      if (c && c.in === 1 && c.lr && c.lr !== rec.att.key && c.at > rec.at) {
        if (book.get(sub) === rec) lingerEnd(room, sub, rec, now);
        continue;
      }
    }
    if (now - rec.saidAt >= PVP_LINGER.sayMs && rec.att.pose) {
      rec.saidAt = now;
      room._fanBut(null, JSON.stringify({ t: 'pose', id: rec.id, p: rec.att.pose }));
    }
  }
}

/** `_wildHello`: a socket's hello here - its own body taken back, every other body shown to it. */
export async function lingerHello(/** @type {any} */ room, /** @type {any} */ ws, /** @type {number} */ now) {
  await lingerStep(room, now);
  for (const rec of room._lingers?.values() ?? [])
    room._send(
      ws,
      JSON.stringify(
        badged({ t: 'join', id: rec.id, name: rec.att.name, look: rec.look, pose: rec.att.pose ?? null }, rec.att),
      ),
    );
}

/** The room's book of players slain while away (sub -> `{ at, n }`), read from its storage once an instance life. */
async function awayBook(/** @type {any} */ room) {
  if (room._lingerAway) return room._lingerAway;
  const book = new Map();
  try {
    for (const [k, v] of await room.state.storage.list({ prefix: LINGER_AWAY.prefix }))
      book.set(k.slice(LINGER_AWAY.prefix.length), v);
  } catch {
    /* the next instance reads it again */
  }
  return (room._lingerAway = book);
}

/** PVP-LINGER-RISE: a lingering body fallen to `killer` (its attachment): its player's next word in the zone is a death. */
export async function lingerSlain(
  /** @type {any} */ room,
  /** @type {string} */ sub,
  /** @type {any} */ killer,
  /** @type {number} */ now,
) {
  const book = await awayBook(room),
    rec = { at: now, n: typeof killer?.name === 'string' ? killer.name : '' };
  if (book.size >= LINGER_AWAY.max && !book.has(sub)) {
    const old = book.keys().next().value;
    book.delete(old);
    room.state.storage.delete(LINGER_AWAY.prefix + old).catch(() => {});
  }
  book.set(sub, rec);
  try {
    await room.state.storage.put(LINGER_AWAY.prefix + sub, rec);
  } catch (e) {
    console.warn('[linger] away kept failed', e?.message ?? e);
  }
}

/** `_wildZoneWord`, a word that it stands in the zone: a body taken back hears the health the referee kept for it; a
 *  player slain while away is told so, a death, before any other word of its fall. */
export async function lingerZone(
  /** @type {any} */ room,
  /** @type {string} */ sub,
  /** @type {any} */ x,
  /** @type {number} */ now,
) {
  if (x?.lingerBack) {
    x.lingerBack = false;
    room._vitSay(sub, x.f);
  }
  const book = await awayBook(room),
    rec = book.get(sub);
  if (!rec || room._lingers?.has(sub)) return;
  book.delete(sub);
  room.state.storage.delete(LINGER_AWAY.prefix + sub).catch(() => {});
  const word = lingerAwayWord(rec, x, now),
    mine = word ? room._siegeSocketOf(sub) : null;
  if (mine) room._send(mine[0], JSON.stringify(word));
}
