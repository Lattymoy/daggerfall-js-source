// @ts-check
// DRAGON2 (bible/11-Multiplayer/Dwarven-Dragon.md sections 4-8): THE DWARVEN DRAGON, THE RELAY'S HALF. A fight lives in the
// cell its site stands in, one a site, at most DRAGON_SITES_MAX a watch (the serpent's AUDIT SERPENT S1 law: the site is
// the client's word). Its brain beats on the cell's alarm, its words fan to who hears it, its kill mints each earner's
// `z1` receipt, kept before a word is said, and the hub keeps each account's receipt for its hellos. index.js holds the
// few hooks that call in here; the state rides the room under `_dg`.
import { DRAGON_SEAM } from '../../src/net/bossSeam.js';
import * as dragonBrain from '../../src/net/dragon/dragonBrain.js';
import { dragonHolds, dragonAdmits, dragonFightId, dragonLookOf, dragonTimes, dragonSeedTold, dragonWatchesAbout, dragonCandidateAt, dragonCandidateOf, dragonQuietAt, isDragonOmen, DRAGON_CELLS_A_WATCH, DRAGON_SITES_MAX, DRAGON_NATIVE_PER_M, DRAGON_BRAIN_MIN, DRAGON_REMAINS_MS } from '../../src/net/dragon/dragonLaw.js';
import { dragonWatchKeyOf, dragonOmenSeeds } from '../../src/net/dragon/dragonSeed.js';
import { roostLeg } from '../../src/net/dragon/dragonBody.js';
import { mintDragonReceipt, readDragonReceipt } from '../../src/net/dragon/dragonReceipt.js';
import { bodyCensus } from '../../src/net/bossBody.js';
import { validDragonOut, cellRoomOfWire, mapPixelOfWire, isCellRoom, nativePoseRoom, SOCIAL_ROOM, DRAGON_INTERNAL_FELL, DRAGON_TELL_RETRY_MS, DRAGON_FIGHT_KEY, DRAGON_FIGHTS_KEY, DRAGON_RC_PREFIX } from '../../src/net/wire.js';
import { junkOutsideCover, inCover } from './cellNodes.js';
import { ROOM_CALL_MS, Bounded, HUB_KEEP_MAX } from './relayScale.js';

/** A fight is forgotten this long after it ends; the cell's other duties run this often while one beats (ms). */
export const DRAGON_KEEP_MS = 2 * 60 * 60 * 1000;
export const DRAGON_REST_MS = 5000;
const rand32 = () => crypto.getRandomValues(new Uint32Array(1))[0];
const rand01 = () => rand32() / 4294967296;
const json = (/** @type {any} */ body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const storeKey = (id) => `${DRAGON_FIGHT_KEY}:${id}`;
const say = (room, ws, w) => room._send(ws, JSON.stringify({ t: 'dragon', ...w }));

/** The room's dragon state, made on first use. @param {any} room */
const dg = (room) => (room._dg ??= { fights: undefined, savedAt: new Map(), falling: new Map(), armedTo: 0, restAt: 0, key: undefined, seeds: new Map(), noRcpt: new Bounded(HUB_KEEP_MAX) });   // AUDIT DRAGON: the serpent's bound (SCALE5a), never a set emptied whole

/** DRAGON-HIDDEN: watch `w`'s omens' seeds `{w, seeds}` - each the relay's secret (net/dragon/dragonSeed.js
 *  dragonOmenSeeds), kept for the watches about - or null: no GATE_SIGNING_KEY, no dragon. DRAGON-CELL: one is told only
 *  near its cell (dragonAsk). @param {any} room @param {number} w */
export async function dragonOmenOf(room, w) {
  const s = dg(room);
  if (s.key === undefined) {
    s.key = await dragonWatchKeyOf(room.env?.GATE_SIGNING_KEY, { subtle: crypto.subtle });
    if (!s.key) console.warn('[dragon] no GATE_SIGNING_KEY - no dragon comes down here');
  }
  if (!s.key) return null;
  if (!s.seeds.has(w)) { s.seeds.set(w, await dragonOmenSeeds(s.key, w, DRAGON_CELLS_A_WATCH, { subtle: crypto.subtle })); if (s.seeds.size > 4) s.seeds.delete(s.seeds.keys().next().value); }
  return { w, seeds: s.seeds.get(w) };
}

/** The fights this cell holds, by id - the instance's while it is awake, else storage's (woken past their checkpoints).
 *  AUDIT DRAGON-HIDDEN A4: an unslain fight a law older than DRAGON_BRAIN_MIN made is let go - its site and shares were
 *  that law's, and its fighters, told to reload, would stand outside the new one's for its watch. A slain one stays. */
export async function dragonFights(room) {
  const s = dg(room);
  if (s.fights === undefined) {
    const ids = await room.state.storage.get(DRAGON_FIGHTS_KEY);
    const list = Array.isArray(ids) ? ids.filter((id) => typeof id === 'string').slice(0, 4 * DRAGON_SITES_MAX) : [];
    const got = list.length ? await room.state.storage.get(list.map(storeKey)) : new Map();
    s.fights = new Map();
    const old = [];
    for (const id of list) {
      const f = got.get(storeKey(id));
      if (!f || typeof f !== 'object') continue;
      if (!f.fell && !(f.v >= DRAGON_BRAIN_MIN)) old.push(id); else s.fights.set(id, dragonBrain.dragonWoke(f));
    }
    if (old.length) { await room.state.storage.delete(old.map(storeKey)); await index(room, s.fights); }
  }
  return s.fights;
}
const index = (room, fights) => room.state.storage.put(DRAGON_FIGHTS_KEY, [...fights.keys()]);
async function forget(room, fights, id) {
  fights.delete(id);
  dg(room).savedAt.delete(id);
  await room.state.storage.delete(storeKey(id));
  await index(room, fights);
}
/** A pose (native units) in a fight's site frame, metres. */
const frameOf = (f, p) => ({ x: (p.x - f.sx) / DRAGON_NATIVE_PER_M, z: (p.z - f.sz) / DRAGON_NATIVE_PER_M });
/** The fight here that counts this account, the newest watch's, as [id, fight]. */
function fightBy(fights, sub) {
  let by = null;
  for (const [id, f] of fights) if (f.players[sub] && (!by || f.w > by[1].w)) by = [id, f];
  return by;
}
/** A fight's bodies now: one a fighter, its newest socket speaking for it, with its trail for the judge. */
function bodiesOf(room, f) {
  const out = [];
  for (const [sub, [ws, b]] of room._siegeSockets()) {
    if (!b.pose || !f.players[sub] || f.players[sub].stale) continue;
    const c = frameOf(f, b.pose);
    out.push({ sub, x: c.x, z: c.z, dead: !!b.pose.dd, tr: room._trailOf(ws, (p) => frameOf(f, p)) });
  }
  return out;
}
/** Does this socket hear fight `id`: its own `in`'s fight, else its account's, else a pose within DRAGON_FAN_R. */
function hears(id, f, b) {
  if (!b.id) return false;
  if (b.dgs && b.dgw === f.w) return b.dgs === id;
  if (b.sub && f.players[b.sub]) return true;
  if (!b.pose) return false;
  const c = frameOf(f, b.pose);
  return Math.hypot(c.x, c.z) <= dragonBrain.DRAGON_FAN_R;
}
/** A fight's words to all who hear it, each naming its watch and site. */
function fan(room, id, f, frames) {
  if (!frames.length) return;
  room._fanFrames(frames.map((fr) => JSON.stringify({ t: 'dragon', ...fr, w: f.w, sx: f.sx, sz: f.sz })), (b) => hears(id, f, b));
}
async function save(room, id, f, now, force) {
  const s = dg(room);
  if (!force && now - (s.savedAt.get(id) ?? 0) < dragonBrain.DRAGON_CHECKPOINT_MS) return;
  s.savedAt.set(id, now);
  await room.state.storage.put(storeKey(id), f);
}
/** Kept first when a word lays what every screen draws, then said. */
async function sayAll(room, id, f, frames, now) {
  if (dragonBrain.dragonSaysTrack(frames)) await save(room, id, f, now, true);
  fan(room, id, f, frames);
}
async function arm(room, now) {
  const s = dg(room);
  if (s.armedTo > now) return;
  s.armedTo = now + dragonBrain.DRAGON_TICK_MS;
  const at = await room.state.storage.getAlarm();
  if (at == null || at > now + dragonBrain.DRAGON_TICK_MS) await room.state.storage.setAlarm(now + dragonBrain.DRAGON_TICK_MS);
}
/** Room for a new site's fight this watch: true, the id of one to let go (gone, or with nobody's part and nobody about),
 *  or null - the sky is full. A slain one is never let go while its watch holds. */
function roomFor(room, fights, w) {
  const watch = [...fights].filter(([, f]) => f.w === w);
  if (watch.length < DRAGON_SITES_MAX) return true;
  const over = watch.find(([, f]) => f.gone && !f.fell);
  if (over) return over[0];
  const idle = watch.find(([, f]) => !f.fell && !Object.values(f.players).some(dragonBrain.dragonHasPart) && !bodiesOf(room, f).some((b) => Math.hypot(b.x, b.z) <= dragonBrain.DRAGON_FAN_R));
  return idle ? idle[0] : null;
}

/**
 * A dragon word in its cell (`in` or `hit`), from a verified account. A layer's cell keeps no fight (the serpent's AUDIT
 * SCALE II R3-3 law): its `in` is told the sky is full, its other words nothing.
 * @param {any} room @param {any} ws @param {any} a @param {any} m @param {number} now
 */
export async function dragonWord(room, ws, a, m, now) {
  if (m.k === 'ask') { await dragonAsk(room, ws, a, m, now); return; }
  if (!isCellRoom(a.key)) { room._junk(ws); return; }
  if (a.ly) { if (m.k === 'in') say(room, ws, { k: 'no', m: 'full' }); return; }
  const fights = await dragonFights(room);
  if (m.k === 'in') { await dragonIn(room, ws, a, m, now, fights); return; }
  const by = fightBy(fights, a.sub);
  if (!by) return;
  const [id, f] = by;
  if (f.players[a.sub]?.stale) return;
  await sayAll(room, id, f, dragonBrain.dragonResume(f, now), now);
  const own = room._siegeSocketOf(a.sub)?.[0] === ws;
  const pose = a.pose && !a.pose.dd && own ? frameOf(f, a.pose) : null;
  DRAGON_SEAM.hit(f, a.sub, m.d, m.r, pose, now);
  if (f.fell && !f.said) { await fall(room, id, f, now); return; }
  if (!f.fell && !f.gone) await arm(room, now);
}

/** AUDIT DRAGON-CELL D3: how long a socket stands in its room before it is told an omen (ms) - a sweep of far rooms by
 *  forged poses waits this in each; a player walking in waits it once. */
export const DRAGON_TELL_DWELL_MS = 20_000;
/** The map pixel a socket stands on as this room can judge it, or null: a cell room's pose in a cell the socket covers, a
 *  battle's on its own map frame (wire.js nativePoseRoom - AUDIT DRAGON-CELL D6). @param {any} a */
const judgedPixel = (a) => (a?.pose && !a.pose.dd && nativePoseRoom(a.key) && (!isCellRoom(a.key) || inCover(a, cellRoomOfWire(a.pose.x, a.pose.z))) ? mapPixelOfWire(a.pose.x, a.pose.z) : null);

/** DRAGON-HIDDEN: an `ask` - watch `w`'s omen, only for a watch about whose landing is past (never one to come). AUDIT
 *  DRAGON-HIDDEN B1, B2: in any room that can judge a pose, each time asked; the dragon bucket bounds the asking.
 *  DRAGON-CELL (the owner chose "Cell-scoped"): an omen's seed names its dragon's pixel, so it is told only to a socket
 *  posed within DRAGON_TELL_PX of its cell (judgedPixel), once it has landed and the socket has stood DRAGON_TELL_DWELL_MS.
 *  Any other - far, new, near a quiet omen, no secret here - is told null no sooner than a quiet watch (dragonQuietAt), so
 *  no answer tells a landing elsewhere; a room that cannot judge a pose answers nothing (AUDIT DRAGON-CELL D1, D3, D6). */
async function dragonAsk(room, ws, a, m, now) {
  if (!dragonWatchesAbout(now).includes(m.w)) return;
  const p = judgedPixel(a);
  if (!p) return;
  const o = await dragonOmenOf(room, m.w), c = o ? dragonCandidateAt(o, p[0], p[1]) : null;
  if (c && isDragonOmen(c) && dragonSeedTold(c, m.w, now) && now - (a.at ?? now) >= DRAGON_TELL_DWELL_MS) { say(room, ws, { k: 'omen', w: m.w, s: c.s }); return; }   // DRAGON-HIDDEN-TIME: silent until it lands
  if (now >= dragonQuietAt(m.w)) say(room, ws, { k: 'omen', w: m.w, s: null });
}

/** An `in`: its receipt again to one who has it; refused for an older game, a watch the clock is not about, a site no
 *  omen of its watch's dragon could stand at (DRAGON-CELL: dragonCandidateOf - a pixel's centre in its cell), a site in
 *  another cell, a pose past DRAGON_ADMIT_R, a fourth site; else joined, and the whole state told either way. */
async function dragonIn(room, ws, a, m, now, fights) {
  const no = (why) => say(room, ws, { k: 'no', m: why });
  const id = dragonFightId(m.w, m.sx, m.sz);
  let f = fights.get(id) ?? null;
  if (f?.rc?.[a.sub]) say(room, ws, { k: 'rcpt', r: f.rc[a.sub] });
  const was = fightBy(fights, a.sub);
  if (!(m.bv >= DRAGON_BRAIN_MIN)) { if (was) was[1].players[a.sub].stale = true; no('reload'); return; }
  if (was?.[1].players[a.sub]?.stale) delete was[1].players[a.sub].stale;
  // AUDIT DRAGON-CELL D2: no omen is read for a site this socket does not cover, nor from a pose far from it - `gone`
  // against silence told a socket anywhere which cell a dragon stood in
  if (junkOutsideCover(room, ws, a, cellRoomOfWire(m.sx, m.sz))) return;
  if (!a.pose || a.pose.dd) return;
  const at = frameOf(f ?? { sx: m.sx, sz: m.sz }, a.pose);
  if (Math.hypot(at.x, at.z) > dragonBrain.DRAGON_ADMIT_R) { no('far'); return; }
  const watch = dragonWatchesAbout(now).includes(m.w) ? await dragonOmenOf(room, m.w) : null;
  const o = watch ? dragonCandidateOf(watch, m.sx, m.sz) : null, t = o ? dragonTimes(o) : null;
  if (!dragonHolds(o, now)) { if (f) say(room, ws, { ...DRAGON_SEAM.stateOf(f) }); if (!f?.rc?.[a.sub]) no('gone'); return; }   // a fallen one's remains still lie: its state tells them
  const mine = fightBy(fights, a.sub);
  if (mine && mine[0] !== id && mine[1].w === t.w) { no('full'); return; }
  let born = false;
  if (!f) {
    if (!dragonAdmits(o, now)) { no('gone'); return; }
    const free = roomFor(room, fights, t.w);
    if (free === null) { no('full'); return; }
    if (free !== true) await forget(room, fights, free);
    f = DRAGON_SEAM.new({ w: t.w, b: dragonLookOf(o), sx: m.sx, sz: m.sz, now, leaveAt: t.leaveAt, roost: roostLeg(o) });
    fights.set(id, f);
    await index(room, fights);
    born = true;
  } else await sayAll(room, id, f, dragonBrain.dragonResume(f, now), now);
  room._setAttach(ws, { ...(room._all().get(ws) ?? a), dgs: id, dgw: t.w });
  const present = new Set();
  for (const [, sock] of room._all()) if (sock.id && sock.sub) present.add(sock.sub);
  const joined = !f.players[a.sub];
  const lv = Number.isSafeInteger(a.cl) && a.cl >= 1 ? Math.min(m.lv, a.cl) : m.lv;
  const ok = DRAGON_SEAM.join(f, a.sub, a.name ?? '', lv, now, present, { admits: dragonAdmits(o, now) });
  say(room, ws, { ...DRAGON_SEAM.stateOf(f) });
  if (!ok) { no(f.fell ? 'slain' : Object.keys(f.players).length >= dragonBrain.DRAGON_FIGHTERS_MAX ? 'full' : 'gone'); return; }
  room._trailSeed(ws, a, now);
  if (joined || born) await save(room, id, f, now, true);
  if (!f.fell && !f.gone) await arm(room, now);
}

/**
 * ONE BEAT of a dragon's cell: each fight's blows judged on the relay's trails, its brain stepped over its bodies, its
 * words fanned, its kill said once, it checkpointed - and forgotten at its keeping's end. Null when the cell holds no
 * fight; else when the next firing is due and whether one still beats.
 * @param {any} room
 */
export async function dragonTick(room) {
  const fights = await dragonFights(room);
  if (!fights.size) return null;
  const now = Date.now();
  let at = Infinity, live = false;
  for (const [id, f] of [...fights]) {
    const end = f.leaveAt + DRAGON_KEEP_MS;
    if (now >= end) { await forget(room, fights, id); continue; }
    try {
      if (!f.fell && !f.gone) {
        const line = room._bodyLine(), bodies = bodyCensus(f, bodiesOf(room, f), now, line.body, line.enforce);
        await room._bodyCount('dragon', f, DRAGON_SEAM.judge(f, bodies, now), now, line.body);
        room._bodyTell('dragon', f, now);
        const said = DRAGON_SEAM.step(f, now, room._bodiesBare(bodies), rand01);
        await save(room, id, f, now, dragonBrain.dragonSaysTrack(said));
        fan(room, id, f, said);
      }
      if (f.fell && !f.said) await fall(room, id, f, now);
      else if (f.said && !f.told) await tellHub(room, id, f, now);
    } catch (e) { console.warn('[dragon] beat failed', e?.message ?? e); }
    const heard = [...room._all()].some(([, b]) => hears(id, f, b));
    const lying = f.fell && f.said && now < f.fell.at + DRAGON_REMAINS_MS;
    if (lying && heard && now - (f.stSaidAt ?? 0) >= dragonBrain.DRAGON_STATE_SEND_MS) { f.stSaidAt = now; fan(room, id, f, [DRAGON_SEAM.stateOf(f)]); }   // its remains told to who comes near, as its fight was
    if (f.fell && !f.said) at = Math.min(at, now + DRAGON_TELL_RETRY_MS);   // AUDIT DRAGON: a kill whose receipts failed to mint is tried again, never left to the fight's end
    else if (f.said && !f.told) at = Math.min(at, now + DRAGON_TELL_RETRY_MS);
    else if (heard && !f.fell && !f.gone) { at = Math.min(at, now + dragonBrain.DRAGON_TICK_MS); live = true; }
    else if (lying) at = Math.min(at, now + dragonBrain.DRAGON_STATE_SEND_MS);
    else at = Math.min(at, end);
  }
  return fights.size ? { at, live } : null;
}
/** The serpent's beat and the dragon's as one answer for the cell's alarm: the sooner, live while either is. */
export const mergeBeats = (a, b) => (a && b ? { at: Math.min(a.at, b.at), live: a.live || b.live } : a ?? b ?? null);
/** Does this account fight a live dragon here - its poses kept on a trail for the judge? @param {any} room @param {string} sub */
export function dragonTrails(room, sub) {
  for (const f of room._dg?.fights?.values?.() ?? []) if (f.players?.[sub] && !f.fell && !f.gone) return true;
  return false;
}

/** THE KILL, SAID ONCE: every earner's receipt minted and kept with the fight, then the fall fanned, each receipt to its
 *  account's sockets here, the hub told. One fall at a time a fight. */
function fall(room, id, f, now) {
  const s = dg(room), had = s.falling.get(id);
  if (had) return had;
  const p = fallOnce(room, id, f, now).finally(() => { s.falling.delete(id); });
  s.falling.set(id, p);
  return p;
}
async function fallOnce(room, id, f, now) {
  if (f.said) return;
  const key = await room._receiptKeyOf(), nowS = Math.floor(now / 1000);
  f.rc = {};
  for (const sub of Object.keys(f.players)) {
    if (!DRAGON_SEAM.earned(f, sub)) continue;
    const q = { q: f.w, b: f.b, s: sub, c: rand32(), x: dragonBrain.dragonEarnedBy(f, sub), l: f.players[sub].lv, ...room._bodyMeasureOf(f, sub, DRAGON_SEAM.earned) };
    try { f.rc[sub] = await mintDragonReceipt(q, key, { subtle: crypto.subtle, nowS }); } catch (e) { console.warn('[dragon] receipt refused', e?.message ?? e); }
  }
  f.said = true;
  f.here = [...new Set([...room._all()].filter(([, b]) => b.id && b.sub && f.rc[b.sub]).map(([, b]) => b.sub))].slice(0, dragonBrain.DRAGON_FIGHTERS_MAX);
  await save(room, id, f, now, true);
  const { at: fellAt, top, n, dm } = f.fell;
  fan(room, id, f, [{ k: 'mv', legs: f.legs }, { k: 'fell', at: fellAt, top, n, ...(dm ? { dm } : {}) }]);
  for (const [ws, b] of [...room._all()]) { const r = b.id && b.sub ? f.rc[b.sub] : null; if (r) say(room, ws, { k: 'rcpt', r }); }
  await tellHub(room, id, f, now);
}
async function tellHub(room, id, f, now) {
  if (f.told || !f.fell) return;
  const rooms = room.env?.ROOMS;
  let ok = true;
  if (rooms?.idFromName && rooms?.get) {
    try {
      const body = { w: f.w, rc: Object.entries(f.rc ?? {}), here: f.here ?? [], kin: dragonBrain.dragonKinOf(f) };
      const res = await rooms.get(rooms.idFromName(SOCIAL_ROOM)).fetch(new Request(`https://relay.internal${DRAGON_INTERNAL_FELL}`, { method: 'POST', body: JSON.stringify(body), signal: AbortSignal.timeout(ROOM_CALL_MS) }));
      ok = !!res?.ok;
    } catch (e) { console.warn('[dragon] hub', e?.message ?? e); ok = false; }
  }
  if (!ok) return;
  f.told = true;
  await save(room, id, f, now, true);
}

/**
 * THE HUB'S HALF: a kill's receipts, from its cell. Each account's kept for its life (never over a newer watch's) and
 * handed now to the newest socket of every earner its cell did not hand it to. A dealer's party shares the kill: each
 * whose party holds a dealer's receipt, and who came and earned nothing, is minted a stander's.
 * @param {any} room @param {Request} request
 */
export async function dragonFellInternal(room, request) {
  let body = null;
  try { body = await request.json(); } catch { /* refused below */ }
  if (!Number.isSafeInteger(body?.w) || body.w < 0) return json({ ok: false }, 400);
  const now = Date.now(), rc = new Map();
  for (const e of Array.isArray(body.rc) ? body.rc.slice(0, dragonBrain.DRAGON_FIGHTERS_MAX) : []) {
    const r = Array.isArray(e) && typeof e[0] === 'string' ? validDragonOut({ k: 'rcpt', r: e[1] }) : null;
    const c = r ? readDragonReceipt(r.r) : null;
    if (c && c.s === e[0] && c.q === body.w && now < c.e * 1000) rc.set(e[0], { r: r.r, e: c.e });
  }
  await kinShare(room, body, rc, now);
  const keys = [...rc.keys()].map((sub) => DRAGON_RC_PREFIX + sub);
  const had = keys.length ? await room.state.storage.get(keys) : new Map();
  const fresh = [...rc].filter(([sub]) => { const v = had.get(DRAGON_RC_PREFIX + sub); return !(v && typeof v === 'object' && Number.isSafeInteger(v.q) && v.q > body.w); });
  if (fresh.length) dg(room).noRcpt.clear();
  for (let i = 0; i < fresh.length; i += 128) await room.state.storage.put(Object.fromEntries(fresh.slice(i, i + 128).map(([sub, v]) => [DRAGON_RC_PREFIX + sub, { q: body.w, r: v.r, e: v.e }])));
  const here = new Set(Array.isArray(body.here) ? body.here.filter((x) => typeof x === 'string').slice(0, dragonBrain.DRAGON_FIGHTERS_MAX) : []);
  const handed = new Set(fresh.map(([sub]) => sub));
  for (const [sub, [ws]] of room._siegeSockets()) if (handed.has(sub) && !here.has(sub)) say(room, ws, { k: 'rcpt', r: rc.get(sub).r });
  return json({ ok: true });
}
/** A party shares its kill: a stander's receipt for each of the kin whose party, as it stands now, holds a dealer's. */
async function kinShare(room, body, rc, now) {
  const kin = (Array.isArray(body?.kin) ? body.kin : []).slice(0, dragonBrain.DRAGON_FIGHTERS_MAX)
    .filter((e) => Array.isArray(e) && typeof e[0] === 'string' && e[0] && !rc.has(e[0]) && Number.isInteger(e[1]));
  if (!kin.length) return;
  const dealers = new Set();
  let look = 0;   // DRAGON-HIDDEN: its look as a dealer's own receipt carries it - the hub rolls no watch
  for (const [sub, v] of rc) { const c = readDragonReceipt(v.r); if (c?.x === 'dealt') { dealers.add(sub); look = c.b === 1 ? 1 : 0; } }
  if (!dealers.size) return;
  const recs = await room._accts(kin.map((e) => e[0]));
  const parties = await room._partiesOf([...recs.values()].map((r) => r.party).filter((pid) => typeof pid === 'string'));
  const key = await room._receiptKeyOf(), nowS = Math.floor(now / 1000);
  for (const [sub, lv] of kin) {
    const party = parties.get(recs.get(sub)?.party);
    if (!party?.members?.some((m) => m !== sub && dealers.has(m))) continue;
    try {
      const r = await mintDragonReceipt({ q: body.w, b: look, s: sub, c: rand32(), x: 'stood', l: lv }, key, { subtle: crypto.subtle, nowS });
      const c = readDragonReceipt(r);
      if (c) rc.set(sub, { r, e: c.e });
    } catch (e) { console.warn('[dragon] kin receipt refused', e?.message ?? e); }
  }
}
/** The hub hands an account's kept receipt to its hello while it is good, and forgets an expired one. */
export async function dragonReceiptTo(room, ws, sub, now) {
  const s = dg(room);
  if (s.noRcpt.has(sub)) return;
  const k = DRAGON_RC_PREFIX + sub, kept = await room.state.storage.get(k);
  if (!kept || typeof kept !== 'object') { s.noRcpt.set(sub, 1); return; }
  if (!(Number.isFinite(kept.e) && now < kept.e * 1000) || typeof kept.r !== 'string') { await room.state.storage.delete(k); return; }
  say(room, ws, { k: 'rcpt', r: kept.r });
}
/** AUDIT DRAGON: THE HUB'S SWEEP OF THE DRAGON'S RECEIPTS (the serpent's AUDIT SERPENT S5 twin) - one page after `cur`,
 *  every receipt expired added to `dead` for the sweep's one delete, so an account that never comes back leaves none.
 *  Answers `{ last, full }` - the page's last key, and whether it was a full page (the sweep goes on).
 *  @param {any} room @param {number} now @param {string | null} cur @param {string[]} dead @param {number} page */
export async function sweepDragonReceipts(room, now, cur, dead, page) {
  const kept = await room.state.storage.list({ prefix: DRAGON_RC_PREFIX, limit: page, ...(cur ? { startAfter: cur } : {}) });
  let last = null;
  for (const [k, v] of kept) { last = k; if (!v || typeof v !== 'object' || !(Number.isFinite(v.e) && now < v.e * 1000)) dead.push(k); }
  return { last, full: kept.size >= page };
}
export { DRAGON_INTERNAL_FELL };
