// @ts-check
// DELVE II (DLV3, bible/03-World/Delve-II.md section 7): A DUNGEON'S ENCOUNTERS, KEPT BY ITS ROOM. The relay reads no
// game data, so it places no site: every client makes the same plan (world/dungeon/delveSites.js), and the room keeps
// each plan it hears, checked against its own hash, its sites' ledgers apart (AUDIT DLV3 2: a page of another build, or
// a forged plan, plays alone and never stands another's down). Each ledger is the law's (net/delve/delveLaw.js), folded
// on the owning party's words, acts and blows - the reach from the pose this room last heard, the level from the token.
// Nothing here arms the room's alarm: a dungeon room's alarm is its memory's forgetting, and a ledger ends on the next
// word heard at its site, whoever says it.

import {
  isWorldRoom,
  delveRelayGate,
  delvePlanKey,
  DELVE_PLAN_PREFIX,
  delveLedgerKey,
  DELVE_LEDGER_PREFIX,
  DELVE_RESPAWN_MS,
  DELVE_RESPAWN_ELITE_MS,
  DELVE_ACTS,
  DELVE_NO,
} from '../../src/net/wire.js';
import {
  DELVE_KIND_NAMES,
  delvePlanHash,
  newDelveLedger,
  foldDelveWord,
  foldDelveHit,
  foldDelveAct,
  stepDelve,
  delveState,
  delveFoeOwner,
  inWard,
  plateAt,
  delvePlates,
  DP,
  FLAME,
  WEIGHT,
} from '../../src/net/delve/delveLaw.js';
import { instanceOwnerOf } from '../../src/net/instanceRoom.js';

/** A word that moves nothing but its speaker's moment is written at most this often (the Starfall's STAR_SAVE_MS). */
export const DELVE_SAVE_MS = 5_000;
/** The plans a room keeps at once: past them the least used with nothing at stake gives way, else the newest waits. */
export const DELVE_PLANS_MAX = 4;
/** The events that end an attempt: its ledger goes, and the next word starts anew. */
const ENDS = Object.freeze(['failed', 'let']);

/** The plan's sites as the law reads them, from the wire's tuples (`e` 1 an Elite dungeon's). Pure. */
export function delvePlanSites(s, e) {
  return s.map(([i, kd, x, y, z, r, vx, vy, vz]) => ({
    i,
    kind: DELVE_KIND_NAMES[kd - 1],
    x,
    y,
    z,
    r,
    tier: e ? 'elite' : 'regular',
    vault: [vx, vy, vz],
  }));
}
/** A plan kept: its word, its sites and each site's record (`led` the live or won ledger, `rest` when a dark Vigil may
 *  wake, `op` the earners who opened their share), when each was last written and when the plan was last used. */
function planRec(p, now = 0) {
  const sites = new Map(delvePlanSites(p.s, p.e).map((site) => [site.i, site]));
  return { h: p.h, e: p.e, s: p.s, sites, recs: new Map(), savedAt: new Map(), usedAt: now };
}
/** A ledger read back from storage, kept only when it is the law's for that site; its accounts a map with no prototype again. */
function ledgerSane(led, site) {
  if (
    !led ||
    typeof led !== 'object' ||
    led.kind !== site.kind ||
    led.s !== site.i ||
    !led.a ||
    typeof led.a !== 'object'
  )
    return null;
  led.a = Object.assign(Object.create(null), led.a);
  return led;
}
/** The room's encounters, read once from storage and kept: its plans, and the hub's answers it keeps (`kin`). */
async function delveOf(room) {
  if (room._dv) return room._dv;
  const dv = { plans: new Map(), kin: new Map() };
  for (const [, p] of await room.state.storage.list({ prefix: DELVE_PLAN_PREFIX })) {
    if (p && Number.isInteger(p.h) && Array.isArray(p.s))
      dv.plans.set(p.h, planRec(p, Number.isFinite(p.at) ? p.at : 0));
  }
  for (const [k, v] of await room.state.storage.list({ prefix: DELVE_LEDGER_PREFIX })) {
    const [h, i] = k.slice(DELVE_LEDGER_PREFIX.length).split(':').map(Number);
    const P = dv.plans.get(h),
      site = P?.sites.get(i);
    if (site && v && typeof v === 'object')
      P.recs.set(i, {
        led: ledgerSane(v.led, site),
        rest: Number.isFinite(v.rest) ? v.rest : 0,
        op: Array.isArray(v.op) ? v.op : [],
      });
  }
  room._dv = dv;
  return dv;
}
const recOf = (P, i) => {
  let r = P.recs.get(i);
  if (!r) {
    r = { led: null, rest: 0, op: [] };
    P.recs.set(i, r);
  }
  return r;
};
const respawnOf = (site) => (site.tier === 'elite' ? DELVE_RESPAWN_ELITE_MS : DELVE_RESPAWN_MS);
/** The ms until a site stands again: a won one's respawn, a dark Vigil's rest - 0 when it stands. */
function restLeft(rec, site, now) {
  if (rec.led?.p === DP.won) return Math.max(0, rec.led.wonAt + respawnOf(site) - now);
  return Math.max(0, rec.rest - now);
}
/** Whether a plan holds anything a page would lose: an attempt, a won site or a resting one. */
const atStake = (P, now) => [...P.recs.entries()].some(([i, r]) => r.led || restLeft(r, P.sites.get(i), now) > 0);
/** The account a socket speaks for: its token's (a hello with none is refused, so every socket here has one). */
const acctOf = (a) => a.sub;
/** Where the socket stands: the pose this room last heard - a page makes it current before each word (net/online.js
 *  _poseCurrent), and a still one's stands as it is (its heartbeat is twenty seconds, a lone one's a minute). */
function poseOf(a) {
  const p = a.pose;
  return p && [p.x, p.y, p.z].every(Number.isFinite) ? [p.x, p.y, p.z] : null;
}
const no = (room, ws, why, i) =>
  room._send(ws, JSON.stringify({ t: 'dv', k: 'no', m: why, ...(i == null ? {} : { i }) }));

/** A site's state to one socket: its plan's hash, the law's screen state, its rest, and `me` - what this account holds. */
export function delveWordFor(P, site, rec, acct, now) {
  const led = rec.led;
  const st = led
    ? delveState(led, now)
    : { kd: DELVE_KIND_NAMES.indexOf(site.kind) + 1, p: DP.idle, w: 0, wz: 0, kn: 0, wl: -1, nd: 0, fo: 0, nx: 0 };
  const rest = /** @type {any} */ ({ ...st });
  delete rest.k;
  delete rest.s; // the frame's own `k`, and the site said as `i`
  const j = led ? led.wt.findIndex((t) => t.s === WEIGHT.carried && t.by === acct) : -1;
  const hd = led?.kind === 'brazier' && led.fl === FLAME.carried && led.fc === acct ? -1 : j >= 0 ? j : -2; // -1 the flame, a weight's index, -2 nothing
  const me = {
    fm: led && delveFoeOwner(led, now) === acct ? 1 : 0,
    hd,
    ea: led?.p === DP.won && led.earned.includes(acct) && !rec.op.includes(acct) ? 1 : 0,
    pa: led && Object.hasOwn(led.a, acct) ? 1 : 0,
  };
  const or = led?.kind === 'litany' && led.p === DP.show ? { or: [...led.order] } : {}; // the order while it is shown, never after
  return { t: 'dv', k: 'dl', ph: P.h, i: site.i, ...rest, ...or, rs: restLeft(rec, site, now), me }; // `ph`: the state's own `h` is its pieces' health
}
/** An event to the wire: no account named in it (the win's earners stay the room's). */
const eventWire = (e) => {
  const o = { ...e };
  delete o.earned;
  return o;
};

/** The hub's no is kept this long, its silence this long (its yes is the hub door's own to keep - INSTANCE_KIN_KEEP_MS):
 *  a stranger near a site speaks a word a second, and each would ask the hub again (AUDIT DLV3 6). */
export const DELVE_KIN_NO_MS = 30_000;
export const DELVE_KIN_SILENT_MS = 5_000;
const KIN_KEPT_MAX = 256;
/** Whether `acct` is of the party that owns `led`: its owner, or the hub's word that its party holds the owner (SD-PARTY's
 *  door, a guest's as any member's) - null while the hub is silent. */
async function partyOf(room, dv, led, acct, now) {
  if (acct === led.own) return true;
  const key = `${acct}|${led.own}`,
    had = dv.kin.get(key);
  if (had && now < had.until) return had.kin;
  const kin = await room._instanceKinOf(acct, await instanceOwnerOf(led.own), now);
  dv.kin.delete(key);
  if (kin !== true) {
    if (dv.kin.size >= KIN_KEPT_MAX) dv.kin.delete(dv.kin.keys().next().value);
    dv.kin.set(key, { kin, until: now + (kin == null ? DELVE_KIN_SILENT_MS : DELVE_KIN_NO_MS) });
  }
  return kin;
}
/** Whether `acct` owns a running attempt at another of the plan's sites: one at a time, so no one hand holds a room's
 *  every encounter (AUDIT DLV3 P3). */
const holdsAnother = (P, i, acct) =>
  [...P.recs.entries()].some(([j, r]) => j !== i && r.led && r.led.p !== DP.won && r.led.own === acct);

/**
 * ONE `dv` FRAME (net/wire.js validDelveIn), from socket `ws` (attachment `a`) in a dungeon's room: metered on its own
 * bucket, refused outside a world room. Answers nothing; says to the socket and the room.
 * @param {any} room the relay's Room
 */
export async function delveFrame(room, ws, a, m, now) {
  if (!room._spend(ws, now, delveRelayGate, 'dvBucket', 'dvDrops', 'too many delve words')) return;
  if (!isWorldRoom(a.key) || typeof a.sub !== 'string' || !a.sub) {
    room._junk(ws);
    return;
  }
  const dv = await delveOf(room);
  if (m.k === 'pl') {
    await takePlan(room, dv, ws, m, now);
    return;
  }
  const P = dv.plans.get(m.h);
  if (!P) {
    room._send(ws, JSON.stringify({ t: 'dv', k: 'pl?' }));
    return;
  } // a plan this room does not keep: said again
  P.usedAt = now;
  const site = P.sites.get(m.i);
  if (!site) {
    room._junk(ws);
    return;
  }
  const acct = acctOf(a),
    rec = recOf(P, m.i),
    pose = poseOf(a),
    ev = [];
  let moved = false;
  // the site stepped first, whoever speaks: an attempt its party left ends here, and a won site past its respawn stands again
  if (rec.led && rec.led.p !== DP.won) {
    const e = stepDelve(rec.led, now);
    if (e.length) {
      ev.push(...e);
      moved = true;
    }
  }
  if (ev.some((e) => ENDS.includes(e.k))) endAttempt(rec, ev, now);
  if (rec.led?.p === DP.won && now >= rec.led.wonAt + respawnOf(site)) {
    rec.led = null;
    rec.op = [];
    moved = true;
  }
  // what the step moved is said and kept before a word returns early - a share's ask here, a silent hub below (AUDIT DLV3 5)
  if (m.k === 'v') {
    if (moved) await settle(room, P, site, rec, ev, true, null, acct, now);
    await openShare(room, P, ws, site, rec, acct, now);
    return;
  }
  const here = !!pose && inWard(site, pose[0], pose[1], pose[2]);
  if (!rec.led) {
    const wakes = m.k === 'w' && here && m.iw === 1 && now >= rec.rest;
    if (wakes && holdsAnother(P, m.i, acct)) no(room, ws, DELVE_NO.held, m.i);
    if (!wakes || holdsAnother(P, m.i, acct)) {
      await settle(room, P, site, rec, ev, moved, ws, acct, now);
      return;
    }
    rec.led = newDelveLedger(site, acct, seedOf(), now);
    rec.op = [];
    moved = true;
  }
  const led = rec.led;
  if (led.p !== DP.won) {
    const party = await partyOf(room, dv, led, acct, now);
    // the hub's wait yields the room: another frame may have ended this attempt or begun another (AUDIT DLV3 P1)
    if (rec.led !== led) {
      await settle(room, P, site, rec, ev, moved, ws, acct, now);
      return;
    }
    if (party == null) {
      if (moved) await settle(room, P, site, rec, ev, true, null, acct, now);
      no(room, ws, DELVE_NO.busy, m.i);
      return;
    }
    if (!party) no(room, ws, DELVE_NO.party, m.i);
    const ctx = { party, inWard: here && (m.k !== 'w' || m.iw === 1), nowMs: now };
    let out = [];
    if (m.k === 'w') {
      // THE LEVEL: the token's bounds it (the Ketch's AUDIT SD II L7 M2), and a word may say it lower - a mentor's (5.2)
      const lv = Number.isSafeInteger(a.cl) && a.cl >= 1 ? Math.min(m.lv, a.cl) : m.lv;
      out = foldDelveWord(
        led,
        acct,
        typeof a.name === 'string' ? a.name : '',
        { ...m, lv },
        { ...ctx, plate: ctx.inWard ? plateAt(delvePlates(site), pose[0], pose[1], pose[2]) : -1 },
      );
    } else if (m.k === 'a') out = foldDelveAct(led, site, acct, { a: DELVE_ACTS[m.a], j: m.j }, { ...ctx, pose });
    else if (m.k === 'x') out = foldDelveHit(led, site, acct, { j: m.j, d: m.d, r: m.r, q: m.q }, { ...ctx, pose });
    if (out.length) {
      ev.push(...out);
      moved = true;
    }
    if (out.some((e) => ENDS.includes(e.k))) endAttempt(rec, out, now);
  }
  await settle(room, P, site, rec, ev, moved, ws, acct, now);
}
/** An ended attempt: its ledger gone, a dark Vigil's rest kept with the site (AUDIT DLV4 F9). */
function endAttempt(rec, ev, now) {
  const end = ev.find((e) => ENDS.includes(e.k));
  rec.led = null;
  rec.op = [];
  rec.rest = end?.rest ? now + end.rest : 0;
}
const writeRec = (room, P, i, rec) =>
  room.state.storage.put(delveLedgerKey(P.h, i), { led: rec.led, rest: rec.rest, op: rec.op });
/** What a frame moved, kept and said: the record written (at once when it moved, else every DELVE_SAVE_MS), the events and
 *  each socket's own state to the room when it moved, else the speaker's state to the speaker alone (`ws` null: none).
 *  Every frame names its plan: a page of another reads none of it. */
async function settle(room, P, site, rec, ev, moved, ws, acct, now) {
  if (moved || now - (P.savedAt.get(site.i) ?? 0) >= DELVE_SAVE_MS) {
    P.savedAt.set(site.i, now);
    await writeRec(room, P, site.i, rec);
  }
  if (!moved) {
    if (ws) room._send(ws, JSON.stringify(delveWordFor(P, site, rec, acct, now)));
    return;
  }
  const said = ev.length ? JSON.stringify({ t: 'dv', k: 'ev', ph: P.h, i: site.i, ev: ev.map(eventWire) }) : null;
  for (const [s, b] of [...room._all()]) {
    if (!b.id) continue;
    if (said) room._send(s, said);
    room._send(s, JSON.stringify(delveWordFor(P, site, rec, acctOf(b), now)));
  }
}
/** A plan heard: kept beside the room's others (DELVE_PLANS_MAX at most - past them the least used with nothing at stake
 *  is forgotten, and with every one at stake the page is told to wait). A plan that does not hash to its own word is
 *  junk. Answered with every site's state, so a page that comes in sees what stands. */
async function takePlan(room, dv, ws, m, now) {
  const sites = delvePlanSites(m.s, m.e);
  if (delvePlanHash(sites) !== m.h) {
    room._junk(ws);
    return;
  }
  let P = dv.plans.get(m.h);
  if (!P) {
    if (dv.plans.size >= DELVE_PLANS_MAX) {
      const idle = [...dv.plans.values()].filter((q) => !atStake(q, now)).sort((x, y) => x.usedAt - y.usedAt)[0];
      if (!idle) {
        no(room, ws, DELVE_NO.plan);
        return;
      }
      await forgetPlan(room, dv, idle);
    }
    P = planRec(m, now);
    dv.plans.set(m.h, P);
    await room.state.storage.put(delvePlanKey(m.h), { h: m.h, e: m.e, s: m.s, at: now });
  }
  P.usedAt = now;
  const acct = acctOf(room._attach(ws));
  for (const site of P.sites.values())
    room._send(ws, JSON.stringify(delveWordFor(P, site, recOf(P, site.i), acct, now)));
}
/** A plan forgotten: its word and every site's record. */
async function forgetPlan(room, dv, P) {
  dv.plans.delete(P.h);
  await room.state.storage.delete([delvePlanKey(P.h), ...[...P.recs.keys()].map((i) => delveLedgerKey(P.h, i))]);
}
/** An earner's ask to open its share of a won site's vault: yes once, and kept - the room remembers who has. */
async function openShare(room, P, ws, site, rec, acct, now) {
  const ok = rec.led?.p === DP.won && rec.led.earned.includes(acct) && !rec.op.includes(acct);
  if (ok) {
    rec.op.push(acct);
    P.savedAt.set(site.i, now);
    await writeRec(room, P, site.i, rec);
  }
  room._send(ws, JSON.stringify({ t: 'dv', k: 'v', ph: P.h, i: site.i, ok: ok ? 1 : 0 }));
  if (ok) room._send(ws, JSON.stringify(delveWordFor(P, site, rec, acct, now)));
}
/** A ledger's own seed (the Litany's order, the sources' count): the relay's, so no client chooses it. */
const seedOf = () => crypto.getRandomValues(new Uint32Array(1))[0];

/** The room's encounters forgotten with its memory (the alarm's `world:` sweep): every plan and every site's record. */
export async function forgetDelve(room) {
  room._dv = undefined;
  const m = await room.state.storage.list({ prefix: 'dv:' });
  const dead = [...m.keys()];
  for (let i = 0; i < dead.length; i += 128) await room.state.storage.delete(dead.slice(i, i + 128));
}
