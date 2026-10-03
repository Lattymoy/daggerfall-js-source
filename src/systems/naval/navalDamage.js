// @ts-check
// NAV-A (2026-09-28) - THE DAMAGE: what a shot does to a ship, and what a ship does about it. The port's own; pure.
//
// A SHIP IS THREE NUMBERS. Its HULL (holed, it sinks), its SAILS (cut, it slows - a ship's way is 35% of its best
// under bare poles and the rest in proportion to the canvas left), and its CREW (thinned, the guns reload slower -
// navalGunnery.js reloadSeconds - and a boarding meets fewer). A ball that strikes her HULL box (navalBallistics.js
// segmentBoxEntry) holes her - within WATERLINE_BAND of the sea, by the point it struck at, below the waterline,
// HOLED_BONUS more - and one that passes through her RIG (navalShips.js HULL_BUILDS `rig`, the canvas over her roof)
// tears canvas and takes a man aloft, and flies on (navalShots.js).
// FIRE: a hull hit above the waterline has FIRE_CHANCE to start one (a fire barrel always does); each fire burns its
// own bite for its own seconds - a gun's FIRE_HP for FIRE_SECONDS, a barrel's BARREL.burnPerSecond for BARREL.burn -
// and eats her canvas (FIRE_SAIL) and her men (one each FIRE_CREW_S) as well as her timbers; up to FIRE_STACK burn at
// once, a new one past that taking the place of the one with the least harm left in it (its bite times its seconds)
// when it carries more. A ship that strikes has her fires put out.
//
// AUDIT NAV1 (2026-09-29, the guns) set this law on what the gunnery audit measured: a hull hit was judged by the
// hull box's own up axis (65 of 2,121 misjudged on a heeled hull), the rigging was the box's top 0.4 m (so the
// masts were no target and a plunging ball did no harm), FIRE_CHANCE was read by nothing (the host rolled its own
// on every zone), a barrel burned as a ball's fire, and a fire could not spread nor touch her canvas or crew.
//
// THE STATES (SHIP_STATES) follow Black Flag's rhythm. An AI ship brought to STRUCK_AT of its hull STRIKES ITS COLOURS: it stops
// fighting and heaves to, and can be boarded (navalBoarding.js) - or shot on until it sinks. HELM-WAY: so does one whose
// every hand is down (`unmanned` - a crewed hull at no crew): nobody is left to lay her guns or trim her sails (a sloop
// with no men aboard went on loading and firing, and gunned a cutter's twenty-six down to none); the rest of the volley
// that struck her cannot (`apply`'s floor, the host's STRUCK_GRACE_S), so sinking a prize is a new volley, never the
// same click that took her. At nought it SINKS, over
// SINK_SECONDS, then is SUNK and gone, its flotsam left floating. A ship taken by boarding is a PRIZE.
//
// GOING DOWN (AUDIT NAV1, the presentation - the kill is the frame a player watches closest, and it ended in a pop:
// she settled only her deck and eight metres, so a brig, a galley and a carrack vanished with 19.5, 24.5 and 32.2 m of
// mast still standing, and a peer saw no sinking at all). She lists SINK_LIST to her seed's side and goes down by the
// head or the stern SINK_PITCH (her seed's next bit), and settles by the square of the time until her highest spar is
// SINK_CLEAR under the sea as SINK_SECONDS runs out (sinkAngles, sinkDepth - `under`, that last depth, is the host's
// measure of her own spars at her last pose). Her fires burn on as she goes, harmless, each out as the sea reaches it
// (a scuttling's torch: "she burns to the waterline"). A ship another player stands goes down on the peer's own clock
// between their words (`sinkOn`), and a word that says she is still sinking never starts her sinking over.
//
// THE PLAYER'S OWN BOAT NEVER SINKS. At nought it is WRECKED: dismasted in effect - no sail can be raised
// (the boat's `sailsTorn`), her oars at WRECKED_OARS of their way, her guns silent - until she is repaired at a port
// or with a prize's timber. A boat is a possession bought for up to two hundred thousand gold, and losing one to a
// lucky broadside would be a punishment Daggerfall never deals; a wreck is the price instead, and pirates who see
// one will board it.
//
// BRACING halves the hull and sail damage a ship takes while the brace is held (the gunnery's own brace).

import { BARREL, SHIP_TOUGHNESS } from './navalShips.js';

export const SHIP_STATES = Object.freeze({ afloat: 'afloat', struck: 'struck', sinking: 'sinking', sunk: 'sunk', prize: 'prize', wrecked: 'wrecked' });
/** An AI ship strikes its colours at this share of its hull. */
export const STRUCK_AT = 0.25;
/** A sinking ship's seconds to go under. */
export const SINK_SECONDS = 22;
/** Going down: her list and her trim at the last (degrees), and how far under the sea her highest spar is then (m). */
export const SINK_LIST = 32;
export const SINK_PITCH = 20;
export const SINK_CLEAR = 2;
/** The band over the sea a hull hit is below the waterline in (m), and what it adds. */
export const WATERLINE_BAND = 1.1;
export const HOLED_BONUS = 0.4;
/** Fire: the chance a hull hit above the waterline sets one, a gun's fire's bite a second and its length, the most
 *  that burn at once, and what each eats besides her timbers - canvas a second, a man's worth every FIRE_CREW_S (TOUGHER-SHIPS:
 *  a toughened crew loses 1/SHIP_TOUGHNESS of a man for it). */
export const FIRE_CHANCE = 0.06;
export const FIRE_HP = 1.4;
export const FIRE_SECONDS = 15;
export const FIRE_STACK = 3;
export const FIRE_SAIL = 0.5;
export const FIRE_CREW_S = 10;   // TOUGHER-SHIPS: a man's worth of harm - she loses 1/SHIP_TOUGHNESS of a man for it (`wound`)
/** What bracing leaves of a hit. */
export const BRACE_TAKEN = 0.5;
/** A wrecked boat's oars: this share of their way. */
export const WRECKED_OARS = 0.35;
/** Under bare poles a ship keeps this share of its way; the rest is its canvas. */
export const BARE_POLES = 0.35;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Where a ball struck her hull, by the height of the point it struck at over the sea: 'holed' within WATERLINE_BAND,
 * else 'hull' - her deck and her castles are hull, and her rigging is a target of its own (navalShots.js).
 * @param {number} pointOverSea - the hit point's height over the sea (m)
 */
export function hitZone(pointOverSea) {
  return pointOverSea <= WATERLINE_BAND ? 'holed' : 'hull';
}

/**
 * How she lies at share `k` (0..1) of SINK_SECONDS: `{ roll, pitch }` in degrees, the pose her hull's mesh takes (Unity's
 * Euler z and x): listed to her seed's side (bit 0 - to port when set: a positive roll lifts her starboard side) and
 * trimmed by the head or the stern (bit 1 - by the stern when set; a positive pitch puts her bow down), each growing
 * with `k`.
 */
export function sinkAngles(seed, k) {
  const kk = clamp(Number.isFinite(k) ? k : 0, 0, 1);
  return { roll: (seed & 1 ? 1 : -1) * SINK_LIST * kk, pitch: (seed & 2 ? -1 : 1) * SINK_PITCH * kk };
}
/** How deep her root has settled at share `k`: `under` (the depth that puts her highest spar SINK_CLEAR under at her
 *  last pose) by the square of the time - slow as she fills, then the plunge. */
export const sinkDepth = (under, k) => Math.max(0, under) * clamp(Number.isFinite(k) ? k : 0, 0, 1) ** 2;

/** A fire's bite a second and its seconds: a barrel's (`kind` 'barrel' or 2, the wire's code), else a gun's. */
export function fireOf(kind) {
  return kind === 'barrel' || kind === 2 ? { hp: BARREL.burnPerSecond, t: BARREL.burn } : { hp: FIRE_HP, t: FIRE_SECONDS };
}

/**
 * The damage one ball does: `{ hull, sail, crew }` for its gun (navalShips.js GUNS) and the zone it struck. A rigging
 * hit cuts canvas (and takes a man) and holes nothing; a hull hit holes, and below the waterline holes more.
 * Chain shot's own numbers already favour the sails. TOUGHER-SHIPS: the men a ball takes are `ballMen`'s - its gun's
 * (`shotMen`) over SHIP_TOUGHNESS, whole men on the ball's own roll.
 */
export function shotDamage(gun, zone, { braced = false, roll = 0.5 } = {}) {
  const k = braced ? BRACE_TAKEN : 1;
  const r = clamp(roll, 0, 1);
  const spread = 0.85 + 0.3 * r;   // each ball its own, 85-115%
  if (zone === 'rig') return { hull: 0, sail: Math.round(Math.max(gun.sail * 2, gun.hull * 0.5) * k * spread), crew: ballMen(shotMen(gun, zone), r) };
  const holed = zone === 'holed' ? 1 + HOLED_BONUS : 1;
  return { hull: Math.round(gun.hull * holed * k * spread), sail: Math.round(gun.sail * 0.25 * k * spread), crew: ballMen(shotMen(gun, zone), r) };
}
/** TOUGHER-SHIPS: the men a ball of `gun` takes in `zone` BEFORE her toughness - a rigging hit's one man aloft, else the
 *  gun's own. What a blow says on the wire: whoever stands the ship she strikes reckons the toughness (`ballMen`), so a
 *  peer's ball is the same blow on every build. */
export const shotMen = (gun, zone) => (zone === 'rig' ? (gun.crew > 0 ? 1 : 0) : gun.crew);
/** TOUGHER-SHIPS: the whole men a blow of `men` (a ball's `shotMen`, a ram's men) takes - `men` over SHIP_TOUGHNESS on
 *  the average, the `roll` (0..1) deciding the odd man (a hardier crew, the same weight of metal). */
export const ballMen = (men, roll) => (men > 0 ? Math.floor(men / SHIP_TOUGHNESS + clamp(roll, 0, 0.999999)) : 0);

/**
 * A ship's hurts: its three numbers, its fire, its state. `player` - a player's boat wrecks where an AI ship sinks.
 * @param {{ hullHp: number, sailHp: number, crew: number, player?: boolean }} spec
 */
export function createShipDamage({ hullHp, sailHp, crew, player = false }) {
  /** @type {{ maxHull: number, maxSail: number, maxCrew: number, hull: number, sail: number, crew: number, fires: { hp: number, t: number }[], crewBurn: number, wound: number, state: string, sinkT: number, lastHitAt: number }} */
  const s = {
    maxHull: Math.max(1, hullHp), maxSail: Math.max(0, sailHp), maxCrew: Math.max(0, crew),
    hull: Math.max(1, hullHp), sail: Math.max(0, sailHp), crew: Math.max(0, crew),
    fires: [], crewBurn: 0, wound: 0, state: SHIP_STATES.afloat, sinkT: 0, lastHitAt: -Infinity,
  };
  /** A fire set: its own clock, up to FIRE_STACK - past that it takes the place of the one with the least harm left
   *  (bite times seconds), if it carries more. */
  const ignite = (kind) => {
    const f = fireOf(kind);
    if (s.fires.length < FIRE_STACK) { s.fires.push(f); return; }
    const harm = (x) => x.hp * x.t;
    let low = 0;
    for (let i = 1; i < s.fires.length; i++) if (harm(s.fires[i]) < harm(s.fires[low])) low = i;
    if (harm(s.fires[low]) < harm(f)) s.fires[low] = f;
  };
  const douse = () => { s.fires = []; s.crewBurn = 0; };
  /** HELM-WAY: a crewed hull with every hand down - an AI ship so left strikes (`settle`). */
  const unmanned = () => s.maxCrew > 0 && s.crew <= 0;
  const d = {
    get state() { return s.state; },
    get hull() { return s.hull; }, get maxHull() { return s.maxHull; },
    get sail() { return s.sail; }, get maxSail() { return s.maxSail; },
    get crew() { return s.crew; }, get maxCrew() { return s.maxCrew; },
    /** The seconds the longest fire aboard has left (0: none) - the readout's chip and the wire's flag. */
    get fire() { return s.fires.reduce((m, f) => Math.max(m, f.t), 0); },
    /** How many fires burn. */
    get fires() { return s.fires.length; },
    get sinkT() { return s.sinkT; },
    get lastHitAt() { return s.lastHitAt; },
    hullShare: () => s.hull / s.maxHull,
    sailShare: () => (s.maxSail > 0 ? s.sail / s.maxSail : 1),
    crewShare: () => (s.maxCrew > 0 ? s.crew / s.maxCrew : 1),
    /** The way the canvas left allows (0..1 of the ship's best). */
    wayShare: () => (s.maxSail > 0 ? BARE_POLES + (1 - BARE_POLES) * (s.sail / s.maxSail) : 1),
    /** Whether the ship still fights: afloat (a struck, sinking, sunk, taken or wrecked ship fires nothing). */
    fighting: () => s.state === SHIP_STATES.afloat,
    /**
     * A hurt, applied: `{ hull, sail, crew, fire? }` at `now` (s) - `fire` true (a gun's), 'barrel' or 2 (a barrel's).
     * `floor` - the hull it cannot take her under (the rest of the volley that struck her: 1). Answers what it
     * changed the state to (or null).
     */
    apply(hurt, now = 0, { floor = 0 } = {}) {
      if (s.state === SHIP_STATES.sunk || s.state === SHIP_STATES.prize) return null;
      s.lastHitAt = now;
      s.hull = Math.max(Math.min(s.hull, floor), s.hull - Math.max(0, hurt.hull | 0));
      s.sail = Math.max(0, s.sail - Math.max(0, hurt.sail | 0));
      s.crew = Math.max(0, s.crew - Math.max(0, hurt.crew | 0));
      if (hurt.fire && !(floor > 0 && s.state === SHIP_STATES.struck)) ignite(hurt.fire);   // a sinking ship's fire burns on, harmless, until she is gone (a scuttling's torch)
      return d.settle();
    },
    /** Her fires put out (a ship that strikes: her crew fights them now, not the guns). */
    douse,
    /** The state the numbers now call for; answers the new state on a change, else null. */
    settle() {
      const was = s.state;
      if (player) {
        if (s.hull <= 0 && s.state !== SHIP_STATES.wrecked) s.state = SHIP_STATES.wrecked;
      } else if (s.state === SHIP_STATES.afloat || s.state === SHIP_STATES.struck) {
        if (s.hull <= 0) { s.state = SHIP_STATES.sinking; s.sinkT = 0; }   // AUDIT NAV1: her fires burn on as she goes down
        else if (s.state === SHIP_STATES.afloat && s.hull <= s.maxHull * STRUCK_AT) { s.state = SHIP_STATES.struck; douse(); }
        else if (s.state === SHIP_STATES.afloat && unmanned()) s.state = SHIP_STATES.struck;   // HELM-WAY: nobody left to fight her fires either
      }
      return s.state !== was ? s.state : null;
    },
    /** One step: each fire burns her timbers, canvas and men, a sinking ship goes down. Answers a state change, or
     *  null. */
    step(dt, now = 0) {
      const t = Math.max(0, dt);
      if (s.fires.length && s.state !== SHIP_STATES.sinking && s.state !== SHIP_STATES.sunk) {
        s.lastHitAt = now;
        for (const f of s.fires) {
          const burn = Math.min(f.t, t);
          f.t -= burn;
          s.hull = Math.max(0, s.hull - f.hp * burn);
          s.sail = Math.max(0, s.sail - FIRE_SAIL * burn);
          s.crewBurn += burn;
        }
        s.fires = s.fires.filter((f) => f.t > 1e-9);
        // TOUGHER-SHIPS: each FIRE_CREW_S of burning is a man's worth of harm, and a toughened crew loses 1/SHIP_TOUGHNESS
        // of a man to it - carried in `wound` from fire to fire, never let go when one burns out (FIRE_CREW_S stretched
        // past a fire's life had one fire take nobody at all)
        while (s.crewBurn >= FIRE_CREW_S) { s.crewBurn -= FIRE_CREW_S; s.wound += 1 / SHIP_TOUGHNESS; }
        while (s.wound >= 1 - 1e-9) { s.wound = Math.max(0, s.wound - 1); s.crew = Math.max(0, s.crew - 1); }
        if (!s.fires.length) s.crewBurn = 0;
        const change = d.settle();
        if (change) return change;
      }
      if (s.state === SHIP_STATES.sinking) {
        s.sinkT += t;
        if (s.sinkT >= SINK_SECONDS) { s.state = SHIP_STATES.sunk; return SHIP_STATES.sunk; }
      }
      return null;
    },
    /**
     * AUDIT NAV1 (the presentation): a sinking ship another player stands, her clock run on between their words - to
     * SINK_SECONDS at most (she is under then; she is gone when their word lets her go). Answers whether she is under.
     */
    sinkOn(dt) {
      if (s.state !== SHIP_STATES.sinking) return s.state === SHIP_STATES.sunk;
      s.sinkT = Math.min(SINK_SECONDS, s.sinkT + Math.max(0, Number.isFinite(dt) ? dt : 0));
      return s.sinkT >= SINK_SECONDS;
    },
    /** Taken by boarding. */
    takePrize() { if (s.state !== SHIP_STATES.sunk && s.state !== SHIP_STATES.sinking) s.state = SHIP_STATES.prize; },
    /** Scuttled: straight to sinking (whatever burns aboard burns on - the host puts the torch to her). */
    scuttle() { if (s.state !== SHIP_STATES.sunk && s.state !== SHIP_STATES.sinking) { s.state = SHIP_STATES.sinking; s.sinkT = 0; } },
    /** Repairs: hull, sails and crew each up to their best (or by an amount). A wrecked boat back over nought floats.
     *  QUICK-REPAIRS: `douse` false - her carpenters at the work under fire (navalYard.js SEA_REPAIR_UNDER_FIRE) leave
     *  her fires burning (a patch is no bucket chain). */
    repair({ hull = Infinity, sail = Infinity, crew = Infinity } = {}, { refloat = 0, douse: putOut = true } = {}) {
      s.hull = Math.min(s.maxHull, s.hull + Math.max(0, hull));
      s.sail = Math.min(s.maxSail, s.sail + Math.max(0, sail));
      s.crew = Math.min(s.maxCrew, s.crew + Math.max(0, crew));
      if (s.hull > 0 && putOut) douse();
      // AUDIT NAV1 (the helm): a wreck floats again once her hull passes `refloat` of its whole (the crew's mending at
      // sea, navalYard.js FIELD_REFLOAT); a yard's timber or a prize's, at once
      if (s.state === SHIP_STATES.wrecked && s.hull > s.maxHull * refloat && s.hull > 0) s.state = SHIP_STATES.afloat;
      if (s.state === SHIP_STATES.struck && s.hull > s.maxHull * STRUCK_AT && !unmanned()) s.state = SHIP_STATES.afloat;
    },
    /** What the save or the wire keeps. */
    snapshot: () => ({ hull: Math.round(s.hull), sail: Math.round(s.sail), crew: s.crew, fire: +d.fire.toFixed(1), state: s.state }),
    /** Back from a snapshot - numbers bounded to the ship's own, a state it can be in. */
    restore(r) {
      if (!r || typeof r !== 'object') return;
      const num = (v, max) => (Number.isFinite(v) ? clamp(v, 0, max) : max);
      s.hull = num(r.hull, s.maxHull); s.sail = num(r.sail, s.maxSail); s.crew = Math.round(num(r.crew, s.maxCrew));
      douse();
      const fire = Number.isFinite(r.fire) ? clamp(r.fire, 0, FIRE_SECONDS) : 0;
      if (fire > 0) s.fires.push({ hp: FIRE_HP, t: fire });
      const st = Object.values(SHIP_STATES).includes(r.state) ? r.state : SHIP_STATES.afloat;
      const was = s.state;
      s.state = player ? (st === SHIP_STATES.wrecked || s.hull <= 0 ? SHIP_STATES.wrecked : SHIP_STATES.afloat) : st;
      if (s.state === SHIP_STATES.sinking && was !== SHIP_STATES.sinking) s.sinkT = 0;   // AUDIT NAV1: a word that says she still sinks never starts her over
    },
  };
  return d;
}

/** The repair a shipwright asks, in gold: by what is missing of each - a hull point the dearest. TOUGHER-SHIPS: a hull
 *  point and a yard of canvas went down as the hulls stood more of them (12 and 6 before; navalShips.js SHIP_TOUGHNESS),
 *  so a wreck made whole costs what it did. */
export const REPAIR_PRICE = Object.freeze({ hull: 7, sail: 4, crew: 30 });
export function repairCost(damage) {
  if (!damage) return 0;
  return Math.round((damage.maxHull - damage.hull) * REPAIR_PRICE.hull + (damage.maxSail - damage.sail) * REPAIR_PRICE.sail + (damage.maxCrew - damage.crew) * REPAIR_PRICE.crew);
}
