// @ts-check
// SERPENT1 (2026-10-04, Mac: "A new world event that requires players with a ship to meet up and take on a large scale
// sea serpent in the ocean"; "make this something truly special"): THE SERPENT HOST - Sethrakul stood in the streaming
// world. It owns the client's half of the fight: the `in` said as a ship comes within sight of its waters, the balls
// of mine that strike it gathered into the cell's words, its blows judged against MY ship and MY feet, the coil's hold
// on her and the maelstrom's pull, the venom on the decks, the boss bar's model and the frame the renderer draws.
// Design: bible/11-Multiplayer/Sea-Serpent.md sections 4-7.
//
// THE WORLD HOST IS ITS ONE HOST (THE FOUR HOSTS RULE): scenes/world.js wires it; scenes/worldModes.js (a building),
// scenes/dungeonContext.js (a dungeon) and scenes/exterior.js (the ?exterior bench - no relay, no naval host) have no sea
// a ship sails, so no serpent; the naval host (scenes/navalHost.js) gives it the shots and the boat at
// my helm, Come Sail Away gives it the warp and drift seams the coil and the whirl take her by. Every seam it reaches
// is in `deps`, so the whole of it runs in Node under the tests:
//
// deps = {
//   now() -> ms                          the relay's clock (the welcome's offset - WORLD5)
//   link                                 net/serpentLink.js createSerpentLink - the cell's words folded
//   omen                                 systems/serpentOmen.js createSerpentOmen - the day's serpent and its site
//   online: { ready(cell), send(word, cell), acct() }   the session's serpent door (net/online.js sendSerpent)
//   toScene(sx, sz, x, z) -> [x, z]      a site-frame point (metres about the site's native point sx/sz) in the scene
//   toSite(sx, sz, x, z) -> [x, z]       a scene point in the site's frame
//   seaY() -> y                          the sea's top in the scene
//   feet() -> [x, y, z]                  my feet
//   level() -> n                         my level (the spoils roll at it)
//   boat() -> { boat, hull, pos, yaw, hl, hw, maxHull, maxSail, atHelm, wrecked } | null   my ship (navalHost serpentBoat)
//   strike(boat, hurt, { shake, line }) navalHost serpentStrike - a blow on her, her own client taking it
//   hurt(pct, base, el)                  a blow on my own body (the venom's - a share of my health and points)
//   say(text), mid(text, s), sound(key, pos, vol), fx(kind, pos, scale)   the HUD's words, a sound, the sea's spray
// }
//
// Not a DFU member. Ledger A (SERPENT1).
import { bodyAt, segmentBox, segExposed, headExposed, coilWeight, SEG_N, MODE, modeAt, headAt, legIndexAt } from '../net/serpentBody.js';
import { SERPENT_ATTACK_BY_ID, SERPENT_ATTACK_TABLE, ADMIT_R, FAN_R, ENGAGE_R, SERPENT_POOL_TICK_MS, ZONES, SERPENT_PHASE_NAMES, MAEL_R, SERPENT_SHIELD_MS, CRUISE_V, refOf, SERPENT_DRAWN_MS } from '../net/serpentBrain.js';
import { serpentBossById, serpentCountdown, serpentCountdownWords, serpentSwims, SERPENT_BRAIN_V, SERPENT_DIVE_MS } from '../net/serpentLaw.js';
import { cellRoomOfWire } from '../net/wire.js';
import { bodySayer } from '../net/bossBody.js';   // INT15: my hull, said to the cell
import { shapeMeets, shipHurt, crushHurt, gripHurt, grindHurt, venomBite, venomHurt, shoveOf, shoveLeft, maelPull, globAt, poolOf, poolBites, fleetShare, SHOVE_S } from '../systems/serpentStrike.js';

/** INT13: the line as the relay's count wrecks her (`bd`). */
export const COUNT_WRECK_LINE = 'She is holed past saving - the fight counts her wrecked.';
/** How often an `in` is said again while I am within its waters' sight (a reconnect, a halo come up, a share back). */
export const IN_RESEND_MS = 20_000;
/** How soon an `in` unanswered is said again. */
export const IN_RETRY_MS = 3000;
/** AUDIT 2 XC7 (2026-10-06): the `in` said at once when the ship I stand on changes (AUDIT SHIPS C1) waits this long after
 *  the last (ms) - a hull that flapped every frame said sixty a second, and the cell's shared bucket (SERPENT_HZ_MAX) then
 *  dropped every volley I fired. */
export const IN_CHANGE_MS = 1000;
/** The volleys' balls on it gathered this long into one word a zone (the brain's blow rate: six words a second). */
export const HIT_GATHER_MS = 500;
/** How near its waters my ship must be for the serpent to count as a hostile near - no rest, no time scale (m). */
export const SERPENT_NEAR_M = ENGAGE_R;
/** The coiled ship's word is said this long after the landing at most - her own machine's moment (the brain hears an
 *  escape for COIL_ESC_MS). */
export const COIL_WORD_MS = 400;
/** A coil whose end is not heard this long past its `until` lets my ship go (a socket lost mid-coil never holds her). */
export const COIL_LOST_MS = 4000;
/** My ship is held on her own judgement at the landing; the relay's word of the coil comes on its next beat (and the
 *  wire's way) - she is held this long waiting for it, and let go if it never comes (the relay never wound it). */
export const COIL_WORD_WAIT_MS = 2500;
/** AUDIT SERPENT M5: a fight alive whose cell has said nothing this long is left (a socket lost, a relay gone quiet) -
 *  never drawn on for ever; the `in` asks for it again. Its beat says a whole state every SERPENT_STATE_SEND_MS. */
export const SERPENT_HEARD_MS = SERPENT_DRAWN_MS;   // AUDIT SHIPS B1: one span - the relay takes up a sleep past it alone
/** AUDIT SHIPS C4: a wake's splashes come at most this often (ms of the fight's clock) - wakeAt. */
export const WAKE_MS = 150;
/** AUDIT SERPENT 2 F4: an attack's landing is judged on my ship within this of its moment (ms) - past it, this machine
 *  saw it late (a ship sailing in on a state whose blow had landed, a frame stalled) and where she is now is not where
 *  she was: it is played for its venom alone. Its words come seconds before it lands, so a live screen judges it within
 *  a frame of its moment. */
export const LAND_JUDGE_MS = 500;
/** How far on its body is asked for its segments' way (ms). */
export const LEAD_DT_MS = 100;
/** A target's id prefix in the shots' field - `serpent:<segment>`. */
export const SERPENT_TARGET = 'serpent:';
export const segmentOfTarget = (id) => (typeof id === 'string' && id.startsWith(SERPENT_TARGET) ? Number(id.slice(SERPENT_TARGET.length)) : null);

/** @param {any} deps */
export function createSerpentHost(deps) {
  const now = () => deps.now();
  let lastIn = { day: null, at: -Infinity, hl: null };
  let pending = new Map();   // zone -> damage gathered
  let pendingAt = -Infinity;
  const resolved = new Set();   // attack numbers judged here
  const seen = new Map();   // attack number -> when its word was first drawn (relay ms) - the telegraph's fill
  let held = null;   // { i, x, z, yaw } - my ship in a coil (scene place and heading)
  let crushed = 0;   // the coil whose crush was taken
  let grip = { hull: 0, crew: 0 }, grind = 0, gripAt = 0, grindAt = 0;
  let shove = null;   // { v: [vx, vz] (site), at }
  let pools = [];   // venom on the water and the decks
  let poolBiteAt = -Infinity;
  let lastPhase = null, lastFell = null, lastGone = null, lastCoil = null;
  let pts = null, ptsAt = -Infinity;
  let ahead = null, aheadAt = -Infinity;   // the body a moment on - its segments' way (the guns' lead)
  let shown = null, shownAt = -Infinity;   // the shots' targets as last made (AUDIT SERPENT 2 F9)
  /** The fight this frame - the link's state while it is this day's, with its site and the frame's moment (`t`). */
  let live = null;
  let memDay = null;   // the day the memory above is of
  let wreckSaid = null;   // my wreck's word as last said this day (1 wrecked, 0 afloat), null none yet
  let blows = { hull: 0, sail: 0, crew: 0, venom: 0 };   // AUDIT SHIPS C3: the pair's share of its blows and crush, carried (AUDIT 2 XC4: and the venom's)
  let lastWake = -Infinity;   // AUDIT SHIPS C4: the last wake's splash (the fight's clock)
  let meNow = null;   // my account, read once a frame (AUDIT SERPENT L5)

  const mine = () => meNow;
  /** AUDIT SERPENT H3: a new day's fight forgets the last one's - its attacks are numbered from one again, so its first
   *  were taken for the last day's and never judged. (Left and come back the same day, the memory holds: an attack
   *  already judged is never judged twice.) */
  function forget(day) {
    memDay = day;
    resolved.clear(); seen.clear(); crushed = 0; lastCoil = null; lastPhase = null; lastFell = null; lastGone = null;
    held = null; pools = []; shove = null; pending = new Map(); wreckSaid = null;
    blows = { hull: 0, sail: 0, crew: 0, venom: 0 }; lastWake = -Infinity;
  }
  /** The fight's frame: the cell's site when it has said one, the omen's until then. */
  const siteOf = (sw) => { const s = deps.link.state(); return s.day === sw.day && s.sx ? { sx: s.sx, sz: s.sz } : { sx: sw.site.sx, sz: sw.site.sz }; };
  const scene = (x, z) => deps.toScene(live.sx, live.sz, x, z);
  const site = (x, z) => deps.toSite(live.sx, live.sz, x, z);
  /** My ship (at my helm, or a boat of mine I stand aboard - navalHost serpentBoat) with her footprint in the site's
   *  frame - or null. A hand aboard another's ship is judged on HER owner's machine (the victim's law). */
  function myShip() {
    const b = deps.boat?.();
    return b ? { ...b, ...footprint(b) } : null;
  }
  function footprint(b) {
    const [x, z] = site(b.pos[0], b.pos[2]);
    return { x, z, yw: b.yaw, hl: b.hl, hw: b.hw };
  }
  /** The body at `t` (made once a moment - the frame's, `live.t`, for every ask of the frame's). */
  function body(t) {
    if (pts && ptsAt === t) return pts;
    pts = bodyAt(deps.link.state(), t, pts ?? []);
    ptsAt = t;
    return pts;
  }

  /** The `in`: said within its waters' sight, again every IN_RESEND_MS and soon again while unanswered. */
  function sayIn(sw, t, me) {
    if (sw.phase === 'slain' || sw.phase === 'sounding') return;
    const cell = cellRoomOfWire(sw.site.sx, sw.site.sz);
    if (!deps.online?.ready?.(cell)) return;
    const s = deps.link.state();
    const answered = s.day === sw.day;
    const b = deps.boat?.();
    const hl = b ? b.hull : -1;   // AUDIT SERPENT B4/H2: my own ship's, at her helm or on her deck
    // AUDIT SHIPS C1: said again at once when the ship I stand on changes - aboard my own or not is what keeps my share
    // in its health (serpentBrain.js aboard), and twenty seconds of a share that is not fighting is twenty seconds wrong
    const due = lastIn.day !== sw.day || (lastIn.hl !== hl && t - lastIn.at >= IN_CHANGE_MS) || t - lastIn.at >= (answered ? IN_RESEND_MS : IN_RETRY_MS);
    if (!due || Math.hypot(me[0], me[1]) > ADMIT_R) return;
    if (deps.online.send({ k: 'in', d: sw.day, bv: SERPENT_BRAIN_V, lv: Math.max(1, Math.floor(deps.level?.() ?? 1)), hl, sx: sw.site.sx, sz: sw.site.sz }, cell)) lastIn = { day: sw.day, at: t, hl };
  }
  /** The gathered balls said, a word a zone. */
  function flushHits(t, sw) {
    if (!pending.size || t - pendingAt < HIT_GATHER_MS) return;
    const cell = cellRoomOfWire(sw.site.sx, sw.site.sz);
    const kept = new Map();   // AUDIT SERPENT L3: a word the socket would not take is said with the next
    // AUDIT SERPENT 2 F3: said whatever the cell refused me before - it hears the words of an account its fight counts
    // alone (server _serpentFrame), so a ship refused a seat is never heard and one let in since is (a day's bar here
    // silenced a ship whose first `in` came a moment before the rising for the rest of the fight)
    for (const [z, d] of pending) if (d > 0 && !deps.online?.send?.({ k: 'hit', d: Math.min(5000, Math.round(d * 100) / 100), z }, cell)) kept.set(z, Math.min(5000, d));
    pending = kept;
    pendingAt = t;
  }
  /** INT15: MY SHIP'S HULL, in my own word - her share of her whole, to the cell at bodySayer's pace (the relay's count
   *  believes a patch by it - net/bossBody.js); to a relay that counts it alone - AUDIT INT15: the relay of the socket the
   *  word leaves on, which the session asks (net/online.js sendSerpent): her cell's may be a halo's, and the primary's
   *  version said nothing of it. */
  const sayHull = bodySayer((v) => !!live && !!deps.online?.send?.({ k: 'vt', v }, cellRoomOfWire(live.sw.site.sx, live.sw.site.sz)));
  function hullWord(t) {
    const b = deps.boat?.();
    if (b && b.maxHull > 0 && Number.isFinite(b.hullNow)) sayHull(b.hullNow / b.maxHull, t);
  }
  /** AUDIT SERPENT T2: my ship's wreck said as it comes (and her afloat again) - her share leaves its health meanwhile. */
  function wreckWord(sw) {
    const b = deps.boat?.();
    if (!b) return;
    const w = b.wrecked ? 1 : 0;
    if (w === (wreckSaid ?? 0)) { wreckSaid = w; return; }
    if (deps.online?.send?.({ k: 'wr', w }, cellRoomOfWire(sw.site.sx, sw.site.sz))) wreckSaid = w;
  }

  /** SERPENT3: the share of its blows a ship of this fight takes - a pair's SERPENT_PAIR_SHARE (the relay's count of the
   *  ships afloat at it, the whole state's `n`), else the whole. */
  const share = () => fleetShare(deps.link.state().n);
  /** My ship struck by attack `a` (a word of the cell's): her hurt, her throw, the line. */
  function strikeMe(a, A, ship, t) {
    deps.strike?.(ship.boat, shipHurt(A, ship, share(), blows), { shake: A.hull >= 0.18 ? 2.6 : 1.8, line: `${A.name}!` });   // AUDIT SHIPS C3: carried
    const v = shoveOf(a, ship);
    if (v[0] || v[1]) shove = { v, at: t };
  }
  /** THE SERPENT_ATTACK_TABLE on their beat: a new word's cue; at its landing, my ship and my feet judged (the ram's lane through its
   *  run), the coil's word if it is mine, the venom laid; the landing's spray and its sound for everyone. */
  function attacks(s, t) {
    const a = s.atk;
    if (!a) return;
    const A = SERPENT_ATTACK_BY_ID[a.a];
    if (!A) return;
    if (!seen.has(a.i)) {
      seen.set(a.i, t);
      if (seen.size > 32) seen.delete(seen.keys().next().value);
      cue(A, a);
    }
    if (resolved.has(a.i)) return;
    if (A === SERPENT_ATTACK_TABLE.ram) {
      if (t < a.at) return;
      const ship = myShip();
      if (ship && shapeMeets(a, ship, t)) { resolved.add(a.i); strikeMe(a, A, ship, t); return; }
      if (t > a.at + A.active) resolved.add(a.i);
      return;   // AUDIT SHIPS C4: its wake is its dash's (dashWake) - here, it stopped where the ram struck my ship
    }
    if (t < a.at) return;
    resolved.add(a.i);
    if (resolved.size > 64) resolved.delete(resolved.values().next().value);
    // AUDIT SERPENT 2 F4: a landing seen late is no blow on my ship - she is judged where she is, which is not where she
    // was when it landed (the coil's word has its own late law - coilWord); its venom lies on the water all the same
    const late = t - a.at > LAND_JUDGE_MS;
    if (!late) landed(A, a);
    if (A === SERPENT_ATTACK_TABLE.coil) { if (a.s && a.s === mine()) coilWord(a, t); return; }
    if (A === SERPENT_ATTACK_TABLE.spit) pools.push(poolOf(a));
    const ship = late ? null : myShip();
    if (ship && A.hull + A.base > 0 && shapeMeets(a, ship, a.at)) strikeMe(a, A, ship, t);
  }
  /** The coiled ship's word: inside the ring at its landing she is held (her hull's middle with it), else she slipped it. */
  function coilWord(a, t) {
    const ship = myShip();
    const sw = deps.omen.swimming();
    if (!sw) return;
    const cell = cellRoomOfWire(sw.site.sx, sw.site.sz);
    if (ship && shapeMeets(a, ship, a.at) && t - a.at <= COIL_WORD_MS + 1000) {
      // her root, as the warp seam lays her - AUDIT SERPENT L1: kept in the site's frame, so a scene that moves its
      // origin under her never carries her off
      const r = ship.root ?? [ship.pos[0], ship.pos[2]];
      const [x, z] = site(r[0], r[1]);
      held = { i: a.i, x, z, yaw: ship.yaw, at: t };
      grip = { hull: 0, crew: 0 }; gripAt = t;
      deps.online?.send?.({ k: 'held', i: a.i, x: Math.round(ship.x * 100) / 100, z: Math.round(ship.z * 100) / 100 }, cell);
      deps.mid?.(`${serpentBossById(deps.link.state().boss).name} coils about your ship! Break its grip!`, 4);
    } else {
      deps.online?.send?.({ k: 'esc', i: a.i }, cell);
      deps.say?.('You slip clear as its coils close on empty sea.', 4);
    }
  }
  /** SERPENT3: ITS DASH UNDER THE SEA, SEEN ON IT - the bow wave over its head while it swims sounded faster than it
   *  cruises (a Rising Maw's dash, a coil's, the whirl's own swim - AUDIT SHIPS C4: and the ram's run down its lane, whose
   *  wake was its judging's and stopped where it struck my ship), so a ship sees it come where its jumps showed nothing
   *  until it was there. */
  function dashWake(s, t) {
    if (modeAt(s.modes, t) !== MODE.deep) return;
    // AUDIT 2 XC6: its end is said ahead (AUDIT SHIPS B5) - the dash it was in swims on until its own turn, the last leg it
    // says (the throes', the dive's); stopped at the word, 15-18 m of a 34 m/s dash went by with no wave over it
    if ((s.fell || s.gone) && !(t < (s.legs[s.legs.length - 1]?.at ?? -Infinity))) return;
    const L = s.legs[legIndexAt(s.legs, t)];
    if (!L || !(L.v > CRUISE_V)) return;
    const h = headAt(s.legs, t);
    const [x, z] = scene(h.x, h.z);
    wakeAt(x, z, t);
  }
  /** AUDIT SHIPS C4: a wake's splash at most every WAKE_MS of the fight's clock - never one a frame (a splash is a dozen
   *  particles; one a frame was 780 a second at 60 fps and 1,874 at 144, the sea's whole PARTICLE_BUDGET while it dashed,
   *  and the budget evicts the guns' spray and foam first). AUDIT SERPENT M3: a point in the scene, its height the sea's. */
  function wakeAt(x, z, t) {
    if (t >= lastWake && t - lastWake < WAKE_MS) return;
    lastWake = t;
    deps.fx?.('wake', [x, deps.seaY(), z], 1);
  }
  /** A word's cue as it is begun (its sound from where it will land). */
  function cue(A, a) {
    const at = a.tg?.[0] ? scene(a.tg[0][0], a.tg[0][1]) : scene(a.x, a.z);
    const head = scene(a.x, a.z);
    const pos = [at[0], deps.seaY(), at[1]];
    if (A === SERPENT_ATTACK_TABLE.roar || A === SERPENT_ATTACK_TABLE.cry) deps.sound?.('roar', [head[0], deps.seaY() + 18, head[1]], 1);
    else if (A === SERPENT_ATTACK_TABLE.spit || A === SERPENT_ATTACK_TABLE.coil) deps.sound?.('hiss', [head[0], deps.seaY() + 10, head[1]], 0.9);
    else if (A === SERPENT_ATTACK_TABLE.breach || A === SERPENT_ATTACK_TABLE.ram || A === SERPENT_ATTACK_TABLE.mael) deps.sound?.('bubbles', pos, 0.8);
  }
  /** A landing's spray and sound, for every screen. */
  function landed(A, a) {
    const c = a.tg?.[0] ?? [a.x, a.z];
    const [x, z] = scene(c[0], c[1]);
    const pos = [x, deps.seaY(), z];
    if (A === SERPENT_ATTACK_TABLE.breach) { deps.fx?.('breach', pos, 1.6); deps.sound?.('breach', pos, 1); }
    else if (A === SERPENT_ATTACK_TABLE.lash) { deps.fx?.('lash', pos, 1.3); deps.sound?.('lash', pos, 1); }
    else if (A === SERPENT_ATTACK_TABLE.spit) { deps.fx?.('venom', pos, 1); deps.sound?.('splash', pos, 0.7); }
    else if (A === SERPENT_ATTACK_TABLE.roar) deps.fx?.('roar', pos, 1);
    else if (A === SERPENT_ATTACK_TABLE.coil) deps.fx?.('breach', pos, 1.1);
  }

  /** The words said of the fight's turns (each once). */
  function tellings(s, t) {
    const boss = serpentBossById(s.boss);
    // a phase TURNED while I fight is said; the one a ship sails in on is not (AUDIT SERPENT: it was said as if it turned)
    if (s.ph !== lastPhase) {
      if (lastPhase !== null && s.ph > lastPhase) deps.mid?.(`${boss.name}: ${SERPENT_PHASE_NAMES[s.ph - 1]}`, 4);
      lastPhase = s.ph;
    }
    const c = s.coil;
    if (c && c.off > 0 && lastCoil !== `${c.i}:off`) {
      lastCoil = `${c.i}:off`;
      if (s.broke && s.broke.at === c.off) deps.say?.(`${s.broke.n} breaks the coil! ${boss.name} reels, stunned - strike its head!`, 5);
      else if (s.crushed === c.off) deps.say?.(`The coil crushes ${held?.i === c.i ? 'your ship' : 'a ship'}!`, 4);
    }
    if (s.fell && lastFell !== s.fell.at) {
      lastFell = s.fell.at;
      const h = body(t)[0];
      const [x, z] = scene(h.x, h.z);
      deps.sound?.('death', [x, deps.seaY() + 6, z], 1);
    }
    if (s.gone && lastGone !== s.gone) {
      lastGone = s.gone;
      const h = body(t)[0];
      const [x, z] = scene(h.x, h.z);
      deps.sound?.('roar', [x, deps.seaY(), z], 0.7);
    }
  }

  /** The coil's hold on my ship, its grip each second, its crush; let go when it is. */
  function coilOnMe(s, t) {
    if (!held) return;
    const c = s.coil;
    const ship = myShip();
    if (!ship) { held = null; return; }
    if (!c || c.i !== held.i) { if (t - held.at > COIL_WORD_WAIT_MS) held = null; return; }   // its word not come yet: held a moment on her own judgement
    if (t > c.until + COIL_LOST_MS) { held = null; return; }   // its end never heard (a socket lost mid-coil): she is let go
    if (s.crushed && s.crushed === c.off && crushed !== c.i) {
      crushed = c.i;
      deps.strike?.(ship.boat, crushHurt(ship, share(), blows), { shake: 3, line: 'The coils crush your hull!' });
    }
    if (c.off > 0) { held = null; return; }
    const dtS = Math.max(0, (t - gripAt) / 1000);
    gripAt = t;
    const g = gripHurt(ship, Math.min(1, dtS), grip, share());
    grip = g.carry;
    if (g.hurt.hull > 0 || g.hurt.crew > 0) deps.strike?.(ship.boat, g.hurt, { shake: 0.4 });
  }
  /** The maelstrom's eye grinding my ship. */
  function eyeOnMe(s, t) {
    const ship = myShip();
    if (!s.mael || !ship || s.fell || s.gone) { grindAt = t; return; }
    const p = maelPull(s.mael, ship.x, ship.z, t);
    const dtS = Math.max(0, Math.min(1, (t - grindAt) / 1000));
    grindAt = t;
    if (!p.eye) return;
    const g = grindHurt(ship, dtS, grind, share());
    grind = g.carry;
    if (g.hurt.hull > 0) deps.strike?.(ship.boat, g.hurt, { shake: 0.6, line: 'The maelstrom\'s eye grinds at your hull!' });
  }
  /** The venom's bite on my own body, each SERPENT_POOL_TICK_MS I stand in a pool of it. */
  function venomOnMe(t, me) {
    pools = pools.filter((p) => t < p.until);
    if (!pools.length || t - poolBiteAt < SERPENT_POOL_TICK_MS) return;
    const feet = deps.feet();
    if (feet[1] > deps.seaY() + 16) return;   // high in her rigging, over the cloud
    const p = pools.find((q) => poolBites(q, me[0], me[1], t));
    if (!p) return;
    poolBiteAt = t;
    // AUDIT 2 XC4: the whole bite on my body, then the pair's share of it carried bite to bite (venomHurt)
    const n = venomHurt(venomBite(p, deps.maxHealth?.() ?? 0), share(), blows);
    if (n > 0) deps.hurt?.(n, 'poison');
  }

  return {
    /** ONE FRAME (the exterior host's online frame): the `in`, the gathered balls, the blows judged, the coil, the eye,
     *  the venom. Answers whether a serpent's fight is drawn. */
    frame() {
      const t = now();
      const sw = deps.omen?.swimming?.() ?? null;
      if (!sw) { live = null; if (deps.link.state().day !== null) deps.link.leave(); held = null; pools = []; return false; }
      if (sw.day !== memDay) forget(sw.day);
      meNow = deps.online?.acct?.() ?? null;
      const fr = siteOf(sw);
      live = { day: sw.day, sx: fr.sx, sz: fr.sz, sw, t };
      const f = deps.feet();
      const me = site(f[0], f[2]);
      sayIn(sw, t, me);
      const s = deps.link.state();
      if (s.day !== sw.day) return false;
      if (Math.hypot(me[0], me[1]) > FAN_R + 600) { deps.link.leave(); held = null; return false; }
      if (!s.fell && !s.gone && t - s.heardAt > SERPENT_HEARD_MS) { deps.link.leave(); held = null; return false; }   // AUDIT SERPENT M5
      flushHits(t, sw);
      wreckWord(sw);
      hullWord(t);   // INT15
      tellings(s, t);
      attacks(s, t);
      dashWake(s, t);
      coilOnMe(s, t);
      eyeOnMe(s, t);
      venomOnMe(t, me);
      return true;
    },
    /** INT13: THE RELAY'S COUNT HAS WRECKED MY SHIP (`bd`, the cell's word, once its BOSS_BODY line enforces): her whole
     *  hull taken as a blow of the fight's - the sea's own wreck (navalHost serpentStrike, a brace's half and all), whatever
     *  this machine's count said. False for no ship of mine, or another site's word. */
    wrecked(w) {
      const ship = myShip();
      if (!ship || !live || w?.sx !== live.sx || w?.sz !== live.sz) return false;
      deps.strike?.(ship.boat, { hull: Math.ceil(ship.maxHull * 2) + 1, sail: 0, crew: 0 }, { shake: 2.6, line: COUNT_WRECK_LINE });
      return true;
    },
    /** THE SHOTS' TARGETS (navalShots.js ShotTarget): every segment of it above the sea, its box in the scene - none
     *  while it is gone, or slain past its throes. */
    targets() {
      const s = deps.link.state();
      if (!live || s.day !== live.day || s.gone || s.fell) return [];
      // AUDIT SERPENT 2 F9: made once a frame, at the frame's moment - the shots' field, the look on it and the aim each
      // ask, and each ask at its own millisecond walked the spine twice over and boxed every segment again
      const t = live.t;
      if (shown && shownAt === t) return shown;
      const p = body(t), seaY = deps.seaY(), out = [];
      // AUDIT SERPENT T4: each segment's way (scene m/s) - the guns lead it as they lead a ship
      if (aheadAt !== t) { ahead = bodyAt(s, t + LEAD_DT_MS, ahead ?? []); aheadAt = t; }
      for (let i = 0; i < SEG_N; i++) {
        if (!segExposed(p, i)) continue;
        const [x0, z0] = scene(p[i].x, p[i].z), [x1, z1] = scene(ahead[i].x, ahead[i].z);
        out.push({ id: `${SERPENT_TARGET}${i}`, box: segmentBox(p, i, seaY, scene), rig: [], v: [(x1 - x0) * 1000 / LEAD_DT_MS, 0, (z1 - z0) * 1000 / LEAD_DT_MS] });
      }
      shown = out; shownAt = t;
      return out;
    },
    /** A BALL OF MINE ON IT (navalHost landHit): `seg` the segment struck, `d` the gun's own harm - gathered into the
     *  next word of its zone (the head while it is thrown up, a coil while one holds, else the body). */
    struck(seg, d) {
      const s = deps.link.state();
      if (!live || s.day !== live.day || s.fell || s.gone || !(d > 0)) return;
      const t = live.t, p = body(t);   // AUDIT SERPENT 2 F9: the frame's body - the one its targets were made from
      const coiled = s.coil && !(s.coil.off > 0) && coilWeight(s.coil, t) > 0.5 && seg >= 2;
      // AUDIT SERPENT T4: its head is its first two segments - the jaw and the crest behind it
      const z = seg <= 1 && headExposed(s, p, t, t < s.su) ? ZONES.head : coiled ? ZONES.coil : ZONES.body;
      if (!pending.size) pendingAt = t;
      pending.set(z, (pending.get(z) ?? 0) + d);
    },
    /** Come Sail Away's `warp` seam: my ship held in its coil - her place and heading this step - or null. */
    hold(boat) {
      if (!held || !live) return null;
      const b = deps.boat?.();
      if (!b || b.boat !== boat) return null;
      const [x, z] = scene(held.x, held.z);
      return { pos: [x, z], yaw: held.yaw };
    },
    /** Come Sail Away's `drift` seam: the maelstrom's pull on my ship and a blow's throw, scene m/s `[vx, 0, vz]`, or
     *  null. The site's axes are the scene's (x east, z north), so a site velocity is a scene one. */
    drift(boat) {
      if (!live || held) return null;   // AUDIT SERPENT L5: no fight, no ask of the naval host
      const b = deps.boat?.();
      if (!b || b.boat !== boat) return null;
      const s = deps.link.state(), t = now();
      let vx = 0, vz = 0;
      if (s.mael && !s.fell && !s.gone) { const [x, z] = site(b.pos[0], b.pos[2]); const p = maelPull(s.mael, x, z, t); vx += p.v[0]; vz += p.v[1]; }
      if (shove) { const age = (t - shove.at) / 1000; if (age >= SHOVE_S) shove = null; else { const v = shoveLeft(shove.v, age); vx += v[0]; vz += v[1]; } }
      return vx || vz ? [vx, 0, vz] : null;
    },
    /** Whether it counts as a hostile near - its waters within SERPENT_NEAR_M of me while it swims unslain. */
    near() {
      const s = deps.link.state();
      if (!live || s.day !== live.day || s.fell || s.gone) return false;
      const f = deps.feet();
      const [x, z] = site(f[0], f[2]);
      return Math.hypot(x, z) <= SERPENT_NEAR_M;
    },
    /** THE BOSS BAR's model, or null: its name and title, its health, its phase, its ward, its stun, the coil's
     *  health (and whether it holds MY ship), the countdown to its sounding, the fighters. */
    bar() {
      const s = deps.link.state();
      if (!live || s.day !== live.day) return null;
      const t = now();
      const boss = serpentBossById(s.boss);
      const sw = live.sw;
      const c = s.coil && !(s.coil.off > 0) ? s.coil : null;
      const cd = serpentCountdown(sw.t, t, sw.phase);
      // the attack being wound up (until its landing has played): its name, its wind-up's share, and whether it is laid
      // on MY ship (her footprint in its shape now - a coil's ring for the ship it names)
      const a = s.atk, A = a ? SERPENT_ATTACK_BY_ID[a.a] : null;
      let atk = null;
      if (A && A.shape !== 'none' && t <= a.at + Math.max(400, A.active)) {
        const from = seen.get(a.i) ?? a.at - A.windup, ship = myShip();
        // AUDIT SERPENT B2: the ram's lane is laid whole - MOVE for a ship anywhere down its run, not where its head is
        const by = A === SERPENT_ATTACK_TABLE.ram ? a.at + A.active : Math.max(t, a.at);
        atk = { key: A.key, name: A.name, t: Math.max(0, Math.min(1, (t - from) / Math.max(1, a.at - from))), aimed: !!ship && (A === SERPENT_ATTACK_TABLE.coil ? a.s === mine() : shapeMeets(a, ship, by)) };
      } else if (A && (A === SERPENT_ATTACK_TABLE.cry || A === SERPENT_ATTACK_TABLE.mael) && t < a.at) atk = { key: A.key, name: A.name, t: 0, aimed: false };
      return {
        name: boss.name, title: boss.title, hp: s.hp, max: s.max, phase: s.ph, phaseName: SERPENT_PHASE_NAMES[s.ph - 1] ?? '', fighters: s.n,
        warded: t < s.sh, stunned: t < s.su, stunLeft: Math.max(0, s.su - t), coil: c ? { h: c.h, m: c.m, mine: c.s === mine() } : null,
        countdown: s.fell ? null : serpentCountdownWords(cd), soundIn: sw.phase === 'late' || sw.phase === 'hunt' ? Math.max(0, sw.t.soundAt - t) : null,
        fell: s.fell, gone: s.gone, opening: t < s.op, atk, now: t,
      };
    },
    /** THE RENDERER'S FRAME, or null: the body (scene points over the sea, with their radii), the telegraphs of the
     *  attack in flight (scene shapes, how far through their wind-up), the coil, the maelstrom, the venom, the glob. */
    drawFrame() {
      const s = deps.link.state();
      if (!live || s.day !== live.day) return null;
      const t = now();
      const seaY = deps.seaY();
      if (s.fell && t > s.fell.at + SERPENT_DIVE_MS) return null;
      if (s.gone && t > s.gone + SERPENT_DIVE_MS) return null;
      const p = body(t);
      const points = p.map((q) => { const [x, z] = scene(q.x, q.z); return { x, y: seaY + q.y, z, r: q.r, yw: q.yw }; });
      const tele = [];
      const a = s.atk, A = /** @type {any} */ (a ? SERPENT_ATTACK_BY_ID[a.a] : null);   // its shape's own fields (r, r0, r1, width, arc) read where it has them
      if (A && A.shape !== 'none' && t <= a.at + Math.max(400, A.active)) {
        const from = seen.get(a.i) ?? a.at - A.windup;
        const k = Math.max(0, Math.min(1, (t - from) / Math.max(1, a.at - from)));
        const c = a.tg?.[0] ? scene(a.tg[0][0], a.tg[0][1]) : scene(a.x, a.z);
        const e = a.tg?.[1] ? scene(a.tg[1][0], a.tg[1][1]) : null;
        tele.push({ shape: A.shape, key: A.key, c, e, r: A.r ?? 0, r0: A.r0 ?? 0, r1: A.r1 ?? 0, width: A.width ?? 0, arc: A.arc ?? 0, yw: a.yw, k, landed: t >= a.at, mine: !!a.s && a.s === mine() });
      } else if (A === SERPENT_ATTACK_TABLE.mael && t < a.at && !s.mael) {
        // AUDIT SERPENT T8: the maelstrom's waters laid on the sea as it winds up - its eye forms at the heart of them.
        // SERPENT3: where its word says it forms (`tg` - beside the serpent, net/serpentBrain.js begin), no longer always
        // its waters' heart
        const from = seen.get(a.i) ?? a.at - A.windup;
        const k = Math.max(0, Math.min(1, (t - from) / Math.max(1, a.at - from)));
        const eye = a.tg?.[0] ? scene(a.tg[0][0], a.tg[0][1]) : scene(0, 0);
        tele.push({ shape: 'disc', key: A.key, c: eye, e: null, r: MAEL_R, r0: 0, r1: 0, width: 0, arc: 0, yw: 0, k, landed: false, mine: false });
      }
      const mael = s.mael && !s.gone ? { c: scene(s.mael.x, s.mael.z), r: MAEL_R, at: s.mael.at, fade: s.fell ? Math.max(0, 1 - (t - s.fell.at) / SERPENT_DIVE_MS) : 1 } : null;
      const g = a ? globAt(a, t) : null;
      const glob = g ? [scene(g[0], g[2])[0], seaY + g[1], scene(g[0], g[2])[1]] : null;
      const venom = pools.filter((q) => t < q.until).map((q) => ({ c: scene(q.x, q.z), r: q.r, k: Math.min(1, (q.until - t) / 2000) }));
      const coil = s.coil && coilWeight(s.coil, t) > 0 ? { c: scene(s.coil.x, s.coil.z), w: coilWeight(s.coil, t) } : null;
      return {
        t, seaY, points, tele, mael, glob, venom, coil,
        mode: modeAt(s.modes, t), stunned: t < s.su, warded: t < s.sh, dying: !!s.fell, deep: modeAt(s.modes, t) === MODE.deep,
        shield: t < s.sh ? Math.min(1, (s.sh - t) / SERPENT_SHIELD_MS) : 0,
      };
    },
    /** OUT OF IT (offline, the session gone): the fight forgotten - my ship let go, the venom dried, the throw spent. */
    leave() {
      live = null; held = null; pools = []; shove = null; pending = new Map();
      if (deps.link.state().day !== null) deps.link.leave();
    },
    /** The day this frame's fight is (null none), for the probes. */
    get day() { return live?.day ?? null; },
    /** Whether my ship is held in a coil. */
    get held() { return !!held; },
    /** My hull's reference broadside a second (the share it brings) - the HUD's line. */
    shareOf: (hl) => refOf(hl),
    /** Test seams. */
    _pools: () => pools,
    swims: (phase) => serpentSwims(phase),
  };
}
