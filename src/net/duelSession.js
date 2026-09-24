// @ts-check
// DUEL1 (2026-09-24, Mac: "When inspecting a player, they should be able to send an invite to duel which then traps both
// players in a surrounding transparent holographic wall that keeps them from going outside of the duel space."; and,
// asked: weapons, bows and spells all count; "Loser drops to 1HP and both are fully healed on duel end. Add a dueling
// K/D to the profile menu and player inspect profile"; outdoors only; the record per account): THE DUEL, AS A STATE
// MACHINE. Pure - no DOM, no game import: everything the game owns (the socket, the bodies, the ring's place, the
// blow's resolution) is handed in, so test/duel_session.test.js drives two of these against each other over a fake
// wire and pins the law without a browser.
//
// THE HANDSHAKE, THREE STEPS (net/wire.js's DUEL1 header names the frames). The challenger ASKS (the Inspect card's
// Challenge); the challenged player's prompt answers YES or NO; on a yes the challenger - who still has to be outdoors,
// alive and near - measures the ring (the midpoint of the two bodies, `ringFor`) and sends START with its centre. The
// challenger's duel begins when START leaves the socket; the challenged player's when it arrives. So nobody is ever shut
// in a ring the other side never confirmed: a yes that gets no start in DUEL_START_WAIT_MS lapses and says so.
//
// THE RING. DUEL_RADIUS_M metres around a centre in the WORLD frame (the pose's: natives on x and z, metres on y), so it
// stands still under either machine's floating origin. Each client keeps ITS OWN body inside (the host clamps the
// motor - player/motor.js `arena`), draws the wall (render/duelWall.js), and tells the cell where the ring stands on its
// foes frame (`ringRecord`), so onlookers see it too. Nothing in the relay enforces the ring: each side enforces it for
// itself, and a side whose opponent stands far outside it calls the duel off (a teleport, a crafted client).
//
// THE BLOWS. After a DUEL_COUNTDOWN_MS count, my blows at my opponent leave as `strike` and `spell` frames (numbered, so
// each lands once) and THE DEFENDER RESOLVES THEM - the game's one formula against their own armour, on their own
// machine - and answers with a `result`. Only the live opponent's blows are taken, only while the duel is live, at most
// DUEL_BLOWS_PER_S a second; everything else is dropped unread.
//
// THE END. The side whose health a duel blow takes to the floor stops at 1 (characters/playerEntity.js `spare`) and says
// `end fell`; a side that gives up says `end yield`. Either names its SENDER the loser, and the loser's own signed-in
// client reports the loss to the account service naming the winner's account as the relay stamped it (net/duelRecord.js)
// - so nobody credits themselves a win. Anything else that ends a duel (a player leaving, dying to something else,
// the clock, a cancel) records nothing. Whatever ended a duel that STARTED, both sides are healed in full after
// DUEL_HEAL_HOLD_MS (the loser is seen to stand at 1 health first), and the opponent's spells on each are stripped.
//
// Not a DFU member: Daggerfall Unity has no other players. Ledger A (ONLINE).
import { tokenGate } from './wire.js';

/** The ring's radius, metres. Both duellists stand within DUEL_RANGE_M of each other at the start, so each is within
 *  half that of the centre - well inside. */
export const DUEL_RADIUS_M = 12;
/** How near two bodies must stand to challenge, accept and start, metres (the trade's own measure between two bodies). */
export const DUEL_RANGE_M = 10;
/** An ask stands this long, then lapses. */
export const DUEL_ASK_TTL_MS = 30_000;
/** A yes waits this long for the challenger's start. */
export const DUEL_START_WAIT_MS = 8000;
/** After the start, blows count only once this has passed - "3, 2, 1". */
export const DUEL_COUNTDOWN_MS = 3000;
/** A duel standing this long is called a draw. */
export const DUEL_MAX_MS = 5 * 60_000;
/** The opponent unreachable (no socket of mine reports them) this long ends the duel. */
export const DUEL_GONE_MS = 10_000;
/** A duellist this far past the ring's edge, metres, has left it (a teleport, a travel - the clamp never lets a body
 *  walk there); the opponent past it for DUEL_OUT_MS ends the duel. */
export const DUEL_OUT_SLACK_M = 4;
export const DUEL_OUT_MS = 2000;
/** The loser stands at 1 health this long before both sides are healed, ms. */
export const DUEL_HEAL_HOLD_MS = 2000;
/** The most blows (strikes and spells together) a defender takes from its opponent a second - an honest duellist lands
 *  a swing or two, a shaft and a spell. */
export const DUEL_BLOWS_PER_S = 5;
/** How long a frame of the handshake or the end may wait for the socket before it is dropped, ms. */
export const DUEL_OUTBOX_TTL_MS = 6000;

/** Is this a position - an Array or a typed array of at least three finite numbers? */
/** @param {any} v */
const isPos = (v) => (Array.isArray(v) || ArrayBuffer.isView(v)) && /** @type {ArrayLike<number>} */ (v).length >= 3 && Number.isFinite(v[0]) && Number.isFinite(v[1]) && Number.isFinite(v[2]);

/** The distance on the ground (x and z) between two points of one frame, metres; Infinity when either is not a point. */
export function groundDistance(a, b) {
  if (!isPos(a) || !isPos(b)) return Infinity;
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

/** THE RING'S CENTRE for two bodies, in whatever one frame both are given in: the midpoint on the ground, and the lower
 *  of the two heights (the wall stands up from the ground, and the render reaches well below it anyway). */
export function ringCentre(a, b) {
  if (!isPos(a) || !isPos(b)) return null;
  return [(a[0] + b[0]) / 2, Math.min(a[1], b[1]), (a[2] + b[2]) / 2];
}

/**
 * CONTAINMENT, the one clamp (player/motor.js applies it after every step): a body at `pos` whose capsule is `bodyR`
 * wide, kept on the ground within `radius - bodyR` of `centre` (a scene point) - the height is never touched. Returns
 * the clamped [x, z], or null when the body is already inside.
 */
export function clampToRing(pos, centre, radius = DUEL_RADIUS_M, bodyR = 0) {
  if (!isPos(pos) || !isPos(centre)) return null;
  const lim = Math.max(0, radius - bodyR);
  const dx = pos[0] - centre[0], dz = pos[2] - centre[2];
  const d = Math.hypot(dx, dz);
  if (d <= lim) return null;
  if (d < 1e-9) return [centre[0], centre[2]];
  const k = lim / d;
  return [centre[0] + dx * k, centre[2] + dz * k];
}

/** The WORLD frame's ring (natives on x and z, metres on y) is the one the wire carries; its radius is metres. A native
 *  is 1/40 of a metre (streamingWorld SCENE_MAP_RATIO), so the ground distance between two world points in metres is
 *  their native distance over 40 - the one conversion this law needs, kept here beside the ring. */
export const NATIVES_PER_M = 40;
export const worldGroundMetres = (a, b) => groundDistance(a, b) / NATIVES_PER_M;

/** The words for why a duel (or an ask for one) ended, from the wire's DUEL_WHY codes. */
export function duelWhyText(why, name = 'They') {
  switch (why) {
    case 'declined': return `${name} declined the duel.`;
    case 'busy': return `${name} cannot duel right now.`;
    case 'timeout': return 'The duel challenge lapsed.';
    case 'range': return `You are more than ${DUEL_RANGE_M} m apart - the duel is off.`;
    case 'outdoors': return 'A duel is fought outdoors - the duel is off.';
    case 'left': return 'The duel is off - a duellist left the ring.';
    case 'dead': return 'The duel is off - a duellist has fallen to something else.';
    case 'draw': return 'Time is up - the duel is a draw.';
    case 'fell': return `${name} has fallen - you won the duel!`;
    case 'yield': return `${name} yields - you won the duel!`;
    default: return `${name} called off the duel.`;
  }
}

/** THE RING ON THE FOES FRAME, for onlookers: `{ s, c: [x, y, z], p }` - the duel's id, the ring's centre in the world
 *  frame, the opponent's peer id - or null when this is not a ring. The owner's word, projected; anything else refuses the
 *  whole record (a camp's law). The radius is this law's constant, never the record's. */
const SID_RE = /^[A-Za-z0-9]{6,16}$/;
const PEER_RE = /^[A-Za-z0-9_-]{4,40}$/;
export function validRingRecord(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
  if (typeof r.s !== 'string' || !SID_RE.test(r.s) || typeof r.p !== 'string' || !PEER_RE.test(r.p)) return null;
  const c = r.c;
  if (!Array.isArray(c) || c.length !== 3 || !c.every((v) => typeof v === 'number' && Number.isFinite(v))) return null;
  if (c[0] < 0 || c[2] < 0 || c[0] > 1024 * 32768 || c[2] > 1024 * 32768 || Math.abs(c[1]) > 1e5) return null;
  return { s: r.s, c: [c[0], c[1], c[2]], p: r.p };
}

/**
 * The duels a player has going: at most ONE duel, plus asks in and out. The host hands in its world:
 *   send(data)        -> online.sendDuel: true when the frame LEFT the socket
 *   now()             -> a monotonic clock, ms
 *   say(text)         -> a line on the social tab
 *   peerName(id)      -> the name the room knows a peer by, or null
 *   selfId()          -> my own peer id (crossed asks: the smaller keeps its own)
 *   near(peer)        -> are the two bodies within DUEL_RANGE_M (false for a peer the host cannot place)
 *   can()             -> null when I can duel now, else the DUEL_WHY code that says why not ('outdoors', 'dead', 'busy')
 *   ringFor(peer)     -> the ring's centre for me and that peer, in the world frame, or null
 *   reaches(peer)     -> does a socket of mine report them
 *   myPos()           -> my feet in the world frame, or null
 *   peerPos(peer)     -> the peer's feet in the world frame, or null
 *   onPrompt(peer)    -> an ask came in: put up the prompt (and onChange for the rows)
 *   onStart(duel)     -> the duel is live: the ring, the wall, the count
 *   onBlow(d, duel)   -> the opponent's blow, already checked: resolve it on MY sheet and answer { hit, dmg } - and
 *                        call `fell()` when it took me to the floor
 *   onResult(d, duel) -> the answer to one of my blows
 *   onEnd(duel, end)  -> the duel is over: `end` = { why, won, lost, by }; the ring comes down
 *   onHeal(duel)      -> DUEL_HEAL_HOLD_MS later: heal me in full and strip the opponent's spells
 *   vitals()          -> [health, maxHealth] for a result
 */
/**
 * @param {object} o
 * @param {(data: any) => boolean} o.send
 * @param {() => number} [o.now]
 * @param {(text: string) => void} [o.say]
 * @param {(id: string) => string|null} [o.peerName]
 * @param {() => string} [o.selfId]
 * @param {(peer: string) => boolean} [o.near]
 * @param {() => string|null} [o.can]
 * @param {(peer: string) => number[]|null} [o.ringFor]
 * @param {(peer: string) => boolean} [o.reaches]
 * @param {() => ArrayLike<number>|null} [o.myPos]
 * @param {(peer: string) => ArrayLike<number>|null} [o.peerPos]
 * @param {(peer: string) => void} [o.onPrompt]
 * @param {(duel: any) => void} [o.onStart]
 * @param {(d: any, duel: any) => ({ hit: boolean, dmg: number } | null)} [o.onBlow]
 * @param {(d: any, duel: any) => void} [o.onResult]
 * @param {(duel: any, end: { why: string, won: boolean, lost: boolean, by: string }) => void} [o.onEnd]
 * @param {(duel: any) => void} [o.onHeal]
 * @param {() => number[]} [o.vitals]
 * @param {() => number} [o.rand]
 */
export function createDuelManager({
  send, now = () => Date.now(), say = () => {}, peerName = () => null, selfId = () => '', near = () => true, can = () => null,
  ringFor = () => null, reaches = () => true, myPos = () => null, peerPos = () => null, onPrompt = () => {}, onStart = () => {},
  onBlow = () => null, onResult = () => {}, onEnd = () => {}, onHeal = () => {}, vitals = () => [1, 1], rand = Math.random,
}) {
  /** @type {{ peer: string, s: string, at: number } | null} */
  let outgoing = null;                 // my ask
  /** @type {Map<string, { s: string, at: number, sub: string|null }>} */
  const incoming = new Map();          // asks at me, by peer
  /** @type {{ peer: string, s: string, at: number, sub: string|null } | null} */
  let waiting = null;                  // I said yes; the challenger's start is owed
  /** @type {{ peer: string, s: string, at: number, c: number[], sub: string|null } | null} */
  let starting = null;                 // they said yes; my start has not left the socket yet
  /** @type {any} */
  let duel = null;                     // { peer, s, c, sub, startedAt, n, seen, phase: 'live'|'over', overAt, end, goneSince, outSince, blows }
  let outbox = [];                     // handshake and end frames waiting on the socket: { data, at }
  const nameOf = (id) => peerName(id) ?? 'Someone';
  const mint = () => { let s = ''; while (s.length < 10) s += rand().toString(36).slice(2); return s.slice(0, 10).padEnd(10, '0'); };

  /** A frame that must get through (an answer, a start, a cancel, an end): sent now, or held for the next tick until
   *  DUEL_OUTBOX_TTL_MS. Blows and results are never held - a late blow is a wrong blow. */
  const post = (data) => {
    let ok = false;
    try { ok = send(data) === true; } catch { ok = false; }
    if (!ok) outbox.push({ data, at: now() });
    return ok;
  };
  const once = (data) => { try { return send(data) === true; } catch { return false; } };
  const flush = () => {
    const t = now();
    const keep = [];
    for (const f of outbox) {
      if (t - f.at > DUEL_OUTBOX_TTL_MS) continue;
      if (!once(f.data)) keep.push(f);
    }
    outbox = keep;
  };

  const liveDuel = () => (duel && duel.phase === 'live' ? duel : null);
  const counting = (d) => now() - d.startedAt < DUEL_COUNTDOWN_MS;

  const begin = (peer, s, c, sub) => {
    incoming.delete(peer);
    for (const [p, a] of incoming) once({ k: 'no', to: p, s: a.s });   // a duel taken up answers every other ask at me
    incoming.clear();
    if (outgoing && outgoing.peer !== peer) once({ k: 'cancel', to: outgoing.peer, s: outgoing.s, why: 'busy' });
    outgoing = null; waiting = null; starting = null;
    duel = { peer, s, c: [c[0], c[1], c[2]], sub: sub ?? null, startedAt: now(), n: 0, seen: 0, phase: 'live', overAt: 0, end: null, goneSince: null, outSince: null, blows: null, fightSaid: false };
    say(`The duel with ${nameOf(peer)} begins - fight in ${DUEL_COUNTDOWN_MS / 1000} seconds!`);
    onStart(duel);
    mgr.onChange?.();
  };

  /** The duel is over, here: `why` as the wire says it, `lost` when I am the one who fell or yielded, `won` when the
   *  opponent was. Said, the ring down, and the heal DUEL_HEAL_HOLD_MS later (tick). */
  const finish = (why, { won = false, lost = false, by = 'me', text = null } = {}) => {
    const d = liveDuel();
    if (!d) return;
    d.phase = 'over'; d.overAt = now();
    d.end = { why, won, lost, by };
    const line = text ?? (lost ? (why === 'yield' ? `You yield - ${nameOf(d.peer)} wins the duel.` : `You have fallen - ${nameOf(d.peer)} wins the duel.`)
      : won ? duelWhyText(why, nameOf(d.peer))
        : by === 'me' ? duelWhyText(why, 'You') : duelWhyText(why, nameOf(d.peer)));
    say(line);
    onEnd(d, d.end);
    mgr.onChange?.();
  };

  const mgr = {
    /** @type {(() => void) | null} */
    onChange: null,
    /** The live duel ({ peer, s, c, sub, startedAt, ... }), or null - also while its end is held for the heal. */
    get duel() { return duel; },
    /** The duel in play - blows count, the ring stands - or null. */
    get live() { return liveDuel(); },
    /** Are blows counting yet (the live duel, past its count)? */
    get fighting() { const d = liveDuel(); return !!d && !counting(d); },
    /** The one peer my blows may reach, or null. */
    get opponent() { const d = liveDuel(); return d ? d.peer : null; },
    /** What the rows should say about a peer: 'none' | 'incoming' | 'outgoing' | 'waiting' | 'live' | 'busy'. */
    stateFor(peer) {
      if (duel) return duel.peer === peer && duel.phase === 'live' ? 'live' : 'busy';
      if (waiting || starting) return (waiting ?? starting)?.peer === peer ? 'waiting' : 'busy';
      if (incoming.has(peer)) return 'incoming';
      if (outgoing?.peer === peer) return 'outgoing';
      return outgoing ? 'busy' : 'none';
    },
    /** Challenge `peer` (the Inspect card's button). Taking up their own standing ask instead is an accept. */
    request(peer) {
      const st = mgr.stateFor(peer);
      if (st === 'incoming') return mgr.accept(peer);
      if (st !== 'none') return { ok: false, why: st === 'outgoing' ? 'challenge sent' : st === 'live' ? 'already duelling' : 'you are busy' };
      const no = can();
      if (no) return { ok: false, why: no === 'outdoors' ? 'a duel is fought outdoors' : no === 'dead' ? 'you have fallen' : 'you are busy' };
      if (near(peer) !== true) return { ok: false, why: `too far away (max ${DUEL_RANGE_M} m)` };
      const s = mint();
      if (!once({ k: 'ask', to: peer, s })) return { ok: false, why: 'try again' };
      outgoing = { peer, s, at: now() };
      say(`You challenged ${nameOf(peer)} to a duel.`);
      mgr.onChange?.();
      return { ok: true };
    },
    /** Take up `peer`'s challenge (the prompt's Accept, or the F-menu's row). */
    accept(peer) {
      const a = incoming.get(peer);
      if (!a || duel || waiting || starting) return { ok: false, why: 'gone' };
      const no = can();
      if (no) return { ok: false, why: no === 'outdoors' ? 'a duel is fought outdoors' : no === 'dead' ? 'you have fallen' : 'you are busy' };
      if (near(peer) !== true) return { ok: false, why: `too far away (max ${DUEL_RANGE_M} m)` };
      if (!once({ k: 'yes', to: peer, s: a.s })) return { ok: false, why: 'try again' };
      incoming.delete(peer);
      if (outgoing) { once({ k: 'cancel', to: outgoing.peer, s: outgoing.s, why: 'busy' }); outgoing = null; }
      waiting = { peer, s: a.s, at: now(), sub: a.sub };
      say(`You accepted ${nameOf(peer)}'s challenge.`);
      mgr.onChange?.();
      return { ok: true };
    },
    /** Turn `peer`'s challenge down. */
    decline(peer) {
      const a = incoming.get(peer);
      if (!a) return { ok: false };
      incoming.delete(peer);
      once({ k: 'no', to: peer, s: a.s });
      mgr.onChange?.();
      return { ok: true };
    },
    /** Give up the live duel: I lose it. */
    yieldDuel() {
      const d = liveDuel();
      if (!d) return { ok: false };
      post({ k: 'end', to: d.peer, s: d.s, why: 'yield' });
      finish('yield', { lost: true });
      return { ok: true };
    },
    /** The host's word that a duel blow took my health to the floor (1): I lost. */
    fell() {
      const d = liveDuel();
      if (!d) return false;
      post({ k: 'end', to: d.peer, s: d.s, why: 'fell' });
      finish('fell', { lost: true });
      return true;
    },
    /** One of MY blows reached my opponent: out as a numbered strike or spell (`kind`), `body` what it carries. The
     *  blow's number when it left (its result names it), 0 when it did not - a blow during the count, outside a live
     *  duel, or refused by the socket is nothing. */
    blow(kind, body) {
      const d = liveDuel();
      if (!d || counting(d) || (kind !== 'strike' && kind !== 'spell')) return 0;
      const n = d.n + 1;
      if (!once({ ...body, k: kind, to: d.peer, s: d.s, n })) return 0;
      d.n = n;
      return n;
    },
    /** A frame from `from`, projected and addressed to me; `sub` the sender's account as the relay stamped it. */
    onFrame(from, d, sub = null) {
      if (!d || typeof d.k !== 'string') return;
      switch (d.k) {
        case 'ask': {
          const busy = duel || waiting || starting;
          if (busy) { once({ k: 'no', to: from, s: d.s }); return; }
          if (can()) { once({ k: 'cancel', to: from, s: d.s, why: can() === 'outdoors' ? 'outdoors' : 'busy' }); return; }
          if (near(from) !== true) { once({ k: 'cancel', to: from, s: d.s, why: 'range' }); return; }
          if (outgoing?.peer === from) {
            // crossed challenges: the smaller id keeps its own ask, the other takes it up - one duel, not two
            if (from < selfId()) { outgoing = null; incoming.set(from, { s: d.s, at: now(), sub }); mgr.accept(from); }
            return;
          }
          if (incoming.size >= 4 && !incoming.has(from)) return;
          const fresh = !incoming.has(from);
          incoming.set(from, { s: d.s, at: now(), sub });
          if (fresh) { say(`${nameOf(from)} challenges you to a duel - answer on the prompt, or press F on them.`); onPrompt(from); }
          mgr.onChange?.();
          return;
        }
        case 'yes': {
          if (!outgoing || outgoing.peer !== from || outgoing.s !== d.s || duel || starting) {
            // a yes to an ask that is no longer mine: the accepter is waiting on a start - tell them it is off
            if (!(duel && duel.peer === from && duel.s === d.s)) once({ k: 'cancel', to: from, s: d.s, why: duel ? 'busy' : 'timeout' });
            return;
          }
          const s = outgoing.s;
          outgoing = null;
          const no = can();
          if (no || near(from) !== true) { once({ k: 'cancel', to: from, s, why: no === 'outdoors' ? 'outdoors' : no ? 'busy' : 'range' }); say(duelWhyText(no === 'outdoors' ? 'outdoors' : no ? 'busy' : 'range', 'You')); mgr.onChange?.(); return; }
          const c = ringFor(from);
          if (!c) { once({ k: 'cancel', to: from, s, why: 'range' }); mgr.onChange?.(); return; }
          if (once({ k: 'start', to: from, s, c })) { begin(from, s, c, sub); return; }
          starting = { peer: from, s, at: now(), c, sub };   // the socket held it back: tick() tries again until the wait runs out
          return;
        }
        case 'no':
          if (outgoing && outgoing.peer === from && outgoing.s === d.s) { outgoing = null; say(duelWhyText('declined', nameOf(from))); mgr.onChange?.(); }
          return;
        case 'start': {
          if (duel && duel.peer === from && duel.s === d.s) return;   // this duel's own start, twice
          if (!waiting || waiting.peer !== from || waiting.s !== d.s) { once({ k: 'cancel', to: from, s: d.s, why: duel ? 'busy' : 'timeout' }); return; }
          const no = can();
          if (no) { once({ k: 'cancel', to: from, s: d.s, why: no === 'outdoors' ? 'outdoors' : 'busy' }); waiting = null; say(duelWhyText(no === 'outdoors' ? 'outdoors' : 'busy', 'You')); mgr.onChange?.(); return; }
          begin(from, d.s, d.c, sub ?? waiting.sub);
          return;
        }
        case 'cancel': {
          const dl = liveDuel();
          if (dl && dl.peer === from && dl.s === d.s) { finish(d.why ?? 'cancelled', { by: 'them' }); return; }
          if (outgoing && outgoing.peer === from && outgoing.s === d.s) { outgoing = null; say(duelWhyText(d.why ?? 'cancelled', nameOf(from))); mgr.onChange?.(); return; }
          if (waiting && waiting.peer === from && waiting.s === d.s) { waiting = null; say(duelWhyText(d.why ?? 'cancelled', nameOf(from))); mgr.onChange?.(); return; }
          if (starting && starting.peer === from && starting.s === d.s) { starting = null; mgr.onChange?.(); return; }
          if (incoming.get(from)?.s === d.s) { incoming.delete(from); if (d.why === 'timeout') say(`${nameOf(from)}'s challenge lapsed.`); mgr.onChange?.(); }
          return;
        }
        case 'end': {
          const dl = liveDuel();
          if (!dl || dl.peer !== from || dl.s !== d.s) return;
          if (sub && !dl.sub) dl.sub = sub;
          const theyLost = d.why === 'fell' || d.why === 'yield';
          finish(d.why, { won: theyLost, by: 'them' });
          return;
        }
        case 'strike': case 'spell': {
          const dl = liveDuel();
          // only my live opponent's, this duel's, past the count, each number once, inside the budget - the rest unread
          if (!dl || dl.peer !== from || dl.s !== d.s || counting(dl) || !(d.n > dl.seen)) return;
          const g = tokenGate(dl.blows, now(), DUEL_BLOWS_PER_S);
          dl.blows = g.bucket;
          if (!g.pass) return;
          dl.seen = d.n;
          if (sub && !dl.sub) dl.sub = sub;
          let r = null;
          try { r = onBlow(d, dl); } catch { r = null; }
          if (!r) return;   // the host could not place the blow (out of reach): no answer is owed for nothing
          const [hp, hm] = vitals();
          once({ k: 'result', to: from, s: dl.s, n: d.n, hit: r.hit ? 1 : 0, dmg: Math.max(0, Math.trunc(r.dmg || 0)), h: [Math.max(0, Math.trunc(hp)), Math.max(1, Math.trunc(hm))] });
          return;
        }
        case 'result': {
          const dl = duel;   // a result may land in the heal's hold: the blow was struck in the duel
          if (!dl || dl.peer !== from || dl.s !== d.s || !(d.n <= dl.n)) return;
          try { onResult(d, dl); } catch { /* the HUD is not the duel's problem */ }
          return;
        }
        default:
      }
    },
    /** The host's frame: lapses, retries, and every rule that ends a live duel. */
    tick() {
      const t = now();
      flush();
      if (outgoing && t - outgoing.at > DUEL_ASK_TTL_MS) {
        const o = outgoing; outgoing = null;
        once({ k: 'cancel', to: o.peer, s: o.s, why: 'timeout' });
        say(`${nameOf(o.peer)} did not answer your challenge.`);
        mgr.onChange?.();
      }
      for (const [p, a] of incoming) if (t - a.at > DUEL_ASK_TTL_MS) { incoming.delete(p); say(`${nameOf(p)}'s challenge lapsed.`); mgr.onChange?.(); }
      if (waiting && t - waiting.at > DUEL_START_WAIT_MS) {
        const w = waiting; waiting = null;
        once({ k: 'cancel', to: w.peer, s: w.s, why: 'timeout' });
        say(`${nameOf(w.peer)} never started the duel - it is off.`);
        mgr.onChange?.();
      }
      if (starting) {
        const st = starting;
        if (t - st.at > DUEL_START_WAIT_MS / 2) { starting = null; once({ k: 'cancel', to: st.peer, s: st.s, why: 'timeout' }); mgr.onChange?.(); }
        else if (once({ k: 'start', to: st.peer, s: st.s, c: st.c })) begin(st.peer, st.s, st.c, st.sub);
      }
      if (duel && duel.phase === 'over') {
        if (t - duel.overAt >= DUEL_HEAL_HOLD_MS) { const d = duel; duel = null; try { onHeal(d); } finally { mgr.onChange?.(); } }
        return;
      }
      const d = liveDuel();
      if (!d) return;
      if (!d.fightSaid && !counting(d)) { d.fightSaid = true; say('Fight!'); }   // the count is over: blows count from here
      // I cannot fight on (I went indoors, or fell to something else): the duel is off, and nothing is recorded
      const no = can();
      if (no === 'dead' || no === 'outdoors') { post({ k: 'end', to: d.peer, s: d.s, why: no === 'dead' ? 'dead' : 'left' }); finish(no === 'dead' ? 'dead' : 'left'); return; }
      if (t - d.startedAt > DUEL_MAX_MS) { post({ k: 'end', to: d.peer, s: d.s, why: 'draw' }); finish('draw'); return; }
      // my body far past the edge: the clamp never lets a body walk there, so I was carried off (a travel, a teleport)
      const me = myPos();
      if (me && worldGroundMetres(me, d.c) > DUEL_RADIUS_M + DUEL_OUT_SLACK_M) { post({ k: 'end', to: d.peer, s: d.s, why: 'left' }); finish('left'); return; }
      if (!reaches(d.peer)) {
        d.goneSince ??= t;
        if (t - d.goneSince > DUEL_GONE_MS) { finish('left', { by: 'them' }); return; }
      } else d.goneSince = null;
      const them = peerPos(d.peer);
      if (them && worldGroundMetres(them, d.c) > DUEL_RADIUS_M + DUEL_OUT_SLACK_M) {
        d.outSince ??= t;
        if (t - d.outSince > DUEL_OUT_MS) { post({ k: 'end', to: d.peer, s: d.s, why: 'left' }); finish('left', { by: 'them' }); return; }
      } else d.outSince = null;
    },
    /** A peer left the room (no socket of mine reports them any more): their asks go; a live duel waits DUEL_GONE_MS. */
    peerGone(peer) {
      if (incoming.delete(peer)) mgr.onChange?.();
      if (outgoing?.peer === peer) { outgoing = null; mgr.onChange?.(); }
      if (waiting?.peer === peer) { waiting = null; mgr.onChange?.(); }
      if (starting?.peer === peer) { starting = null; mgr.onChange?.(); }
    },
    /** The player left the game or the world: everything ends here, a live duel as `left` (no record). */
    reset() {
      const d = liveDuel();
      if (d) { once({ k: 'end', to: d.peer, s: d.s, why: 'left' }); finish('left'); }
      if (outgoing) once({ k: 'cancel', to: outgoing.peer, s: outgoing.s, why: 'cancelled' });
      for (const [p, a] of incoming) once({ k: 'no', to: p, s: a.s });
      incoming.clear(); outgoing = null; waiting = null; starting = null; outbox = [];
      mgr.onChange?.();
    },
    /** The asks at me, newest first ({ peer, at }) - the prompt shows the newest. */
    asks() { return [...incoming.entries()].map(([peer, a]) => ({ peer, at: a.at })).sort((x, y) => y.at - x.at); },
  };
  return mgr;
}
