// @ts-check
// NAV-C (2026-09-28) - THE SEA'S TRAFFIC: which ships are out there, where they come from and where they go. The
// port's own; pure - the host hands where the players are, what is water and what the sea already holds, and gets
// back a ship to launch or ships to let go.
//
// SHIPS COME OVER THE HORIZON. Every SPAWN_EVERY seconds (a draw between its two numbers) the director rolls for a
// new ship while fewer than the density's own count sail within DESPAWN_BEYOND of a player: it stands the ship
// SPAWN_RING out from the player, on a bearing whose ground is open water deep enough for its hull, and never within
// SPAWN_CLEAR of any player - nobody sees one appear. A ship past DESPAWN_BEYOND of every player, and not in a
// fight, sails out of the world. None of this runs while no player is on the water (the host's gate).
//
// WHO SAILS. The faction by the waters: out on the open bay pirates are the likelier; within PORT_PIXELS of a port
// town the merchantmen and the crown's navy; and a player whose notoriety in these waters has reached HUNTER_AT
// draws the navy after them - HUNTERS: ships that come for the player (the host lays their course at the player,
// NAV-D). The class by faction and level (navalShips.js classFor): a green captain meets sloops, a seasoned one
// brigantines and galleys, and at most one pirate flagship sails at a time.
//
// DETERMINISM. Every spawn's seed is `hash32(seedBase, count)` - the pixel and the day the host folds into
// seedBase, and the spawn's own count - so the same waters on the same day send the same ships, and a pin can name
// one.
//
// SEA-PEACE (2026-09-29, the player: "Enemy AI and Friendly AI should engage in their own encounters naturally") - THE
// BAY'S OWN FIGHTS. Of the rolls that launch with room for two, ENCOUNTER_CHANCE launch a pair already at it, drawn by
// ENCOUNTERS' weights: a pirate on a merchantman she outguns WARY_ODDS to one (`plunder` - a wary one takes her too),
// or a crown's ship on a pirate (`patrol`). The quarry sails ENCOUNTER_GAP ahead of her hunter on the hunter's own
// course, the pair on the spawn ring and crossing the player's waters as any ship does, so the fight is theirs and
// in sight. The roll and the pair are drawn on the spawn's own ENCOUNTER_SALT stream (`encounterRng`), so a roll that
// launches one ship draws exactly what it drew before; the company's seed is the next count's.
//
// SEA-EASE (2026-10-01, Mac: "too many ships are appearing", "The sea is too dangerous right now", "Friendly AI should
// help the player in combat") - A QUIETER, SAFER BAY. The densities keep one, two or four ships near a player (they
// kept two, three and five), rolled for every SPAWN_EVERY - a minute to two and a half, not half a minute to one - and
// the first FIRST_ROLL_S after the water is reached; the open bay sails fewer pirates and more merchantmen and crown's
// ships, and within PORT_PIXELS of a port the pirates' weight is cut to PORT_PIRATE_K - the crown's own waters. THE
// RELIEF: while a pirate fights a lawful player (`ctx.distress`, where they are - the host's word) and no crown's ship
// stands by them, the next roll comes within RELIEF_WAIT_S and, on RELIEF_CHANCE of it, launches a navy ship for their
// waters - in a berth past the density's own, one relief at a time (`ctx.relieving`) - on the ring about them and
// steering for them (`relief`: the host lays her course there); while they fight the roll launches nothing else - the
// sea sends help, never more strangers. She is a crown's ship like any: the pirate is hers (navalAI.js AID_PRIORITY),
// and she sails on when the fight is done.
//
// CAPT-WATERS (2026-10-11, the owner: "giving a reason to players to experience it" - bible/03-World/Captains-Sea.md) - THE
// RICH WATERS. SEA-EASE made the Bay safer, and the pirates it thinned were the sea's prizes. The coasts keep SEA-EASE's
// peace; the DEEP WATERS - DEEP_PX map pixels and more from every port (`watersOf`), the Bay's broad middle and the open
// Abecean - are the captain's choice of risk: pirates DEEP_PIRATE_K times as likely and the trade's ships fewer, their
// classes drawn DEEP_LEVEL levels above the captain's own (brigantines and galleys sooner, a flagship possible), a pirate
// bold DEEP_BOLD of the time where the coast's are bold BOLD_SHARE, and every hold rolled DEEP_TIER rarity tiers richer
// (navalHost.js launch, drawHold). The plate says the waters (ui/naval/navalHud.js).

//
// ETHER-SEA (2026-10-11, the owner: "deadly legendary ships"; bible/03-World/Eltheric-Ocean.md ETHER-SHIPS) - PAST THE VEIL
// (`ctx.ether`: the waters' band, and the legend whose haunt they are when she sails): no crown's navy - corsairs and
// the isles' traders by the band's weights (systems/naval/etherShips.js etherFactionWeights), every class drawn the band's
// `level` levels up, a pair at it only a corsair on a trader, and no relief to call. A LEGEND in her haunt, while no
// legend is at sea (`ctx.legends`: every one the host knows of, at any range and any stander's - AUDIT CAPTAIN'S SEA
// D7/D14: two captains apart in her haunt each launched her, and two haunts overlap) and never by a freeport's quay
// (SEA-EASE's `nearPort`), comes on LEGEND_CHANCE of a roll (her own LEGEND_SALT stream - the roll's other draws
// unmoved), on the ring and her bow on the captain. Every spec there carries `ether` (the band's id), a legend's `legend`
// too.

import { hash32 } from '../../world/spawnedDungeons.js';
import { mulberry32 } from '../../combat/blood/bloodArt.js';
import { classFor, HULL, SHIP_CLASSES } from './navalShips.js';
import { HULL_VARIANT_COUNTS } from '../comeSailAway/comeSailAwayBoat.js';
import { classPower, odds, WARY_ODDS } from './navalAI.js';   // SEA-PEACE: a plunder's merchantman is one her pirate outguns
import { etherFactionWeights, LEGEND_CHANCE, LEGEND_SALT } from './etherShips.js';   // ETHER-SEA: the Eltheric Ocean's traffic and its legends

/** How many ships the density keeps at sea near a player. SEA-EASE: one, two or four (they were two, three and five). */
export const DENSITY = Object.freeze({ off: 0, few: 1, some: 2, many: 4 });
export const DENSITY_KEYS = Object.freeze(Object.keys(DENSITY));
/** Where a ship is launched (m from the player), how far from every player it must be, and where it leaves. */
export const SPAWN_RING = Object.freeze([650, 1000]);
export const SPAWN_CLEAR = 450;
export const DESPAWN_BEYOND = 1900;
/** Seconds between the director's rolls (a draw in the range), and the first roll's wait after the water is reached.
 *  SEA-EASE: a minute to two and a half, and half a minute first (they were 30-65 s and 12 s). */
export const SPAWN_EVERY = Object.freeze([60, 140]);
export const FIRST_ROLL_S = 30;
/** A roll's chance to launch a ship when there is room for one. */
export const SHIP_SPAWN_CHANCE = 0.8;
/** The factions' weights: the open bay, and what a port within PORT_PIXELS and a notoriety at HUNTER_AT add.
 *  SEA-EASE: the open bay's pirates 30 (were 45), its merchantmen 45 (38) and its crown's ships 25 (17). */
export const FACTION_WEIGHTS = Object.freeze({ pirate: 30, merchant: 45, navy: 25 });
export const PORT_PIXELS = 3;
export const PORT_WEIGHTS = Object.freeze({ merchant: 30, navy: 15 });
/** SEA-EASE: the share of the pirates' weight left within PORT_PIXELS of a port - the crown's own waters. */
export const PORT_PIRATE_K = 0.5;
/** SEA-EASE - THE RELIEF: the most a roll waits while a lawful player is under a pirate's guns with no crown's ship by
 *  them (s), and its chance to launch a navy ship for them. */
export const RELIEF_WAIT_S = 20;
export const RELIEF_CHANCE = 0.7;
export const HUNTER_AT = 50;
export const HUNTER_WEIGHT = 45;
/** The bearings a spawn tries before it gives the roll up. */
export const SPAWN_TRIES = 10;
/** SEA-PEACE: the share of launching rolls that launch a pair at it, the kinds' weights, the gap between hunter and
 *  quarry (m, a draw in the range), and the pair's own stream's salt on the spawn's seed. */
export const ENCOUNTER_CHANCE = 0.3;
export const ENCOUNTERS = Object.freeze({ plunder: 60, patrol: 40 });
export const ENCOUNTER_GAP = Object.freeze([140, 220]);
export const ENCOUNTER_SALT = 0x3ea7f1a5;
/** SEA-PEACE: the pair's stream off a spawn's seed - never the single spawn's own. */
export const encounterRng = (seed) => mulberry32(((seed >>> 0) ^ ENCOUNTER_SALT) >>> 0);
/** SEA-EASE: the relief's own stream's salt on the spawn's seed. */
export const RELIEF_SALT = 0x2e11ef;

/**
 * SEA-PEACE: the two classes of an encounter at the player's level - `plunder` a pirate (never the flagship) and a
 * merchantman she outguns WARY_ODDS to one, by weight among those; `patrol` a navy ship and a pirate (never the
 * flagship). Null where the level offers no such pair.
 * @param {'plunder'|'patrol'} kind @param {number} level @param {() => number} r
 */
export function encounterClasses(kind, level, r) {
  const lv = Math.max(1, level | 0);
  const pirates = SHIP_CLASSES.filter((c) => c.faction === 'pirate' && !c.flagship && c.minLevel <= lv);
  const pick = (list) => {
    const total = list.reduce((sum, c) => sum + c.weight, 0);
    let x = r() * total;
    for (const c of list) { if ((x -= c.weight) < 0) return c; }
    return list[list.length - 1] ?? null;
  };
  if (kind === 'patrol') {
    const navy = classFor('navy', lv, r());
    const pirate = pirates.length ? pick(pirates) : null;
    return navy && pirate ? { hunter: navy, quarry: pirate } : null;
  }
  const pirate = pirates.length ? pick(pirates) : null;
  if (!pirate) return null;
  // AUDIT NAV2 F25: outguns by the odds - the time each needs to make the other strike (navalAI.js odds)
  const prey = SHIP_CLASSES.filter((c) => c.faction === 'merchant' && c.minLevel <= lv && odds(classPower(pirate), classPower(c)) >= WARY_ODDS);
  const merchant = prey.length ? pick(prey) : null;
  return merchant ? { hunter: pirate, quarry: merchant } : null;
}

/** A weighted pick from `{ key: weight }` with a draw in [0, 1). */
export function weightedPick(weights, r) {
  const keys = Object.keys(weights).filter((k) => weights[k] > 0);
  const total = keys.reduce((s, k) => s + weights[k], 0);
  let x = Math.max(0, Math.min(0.999999, r)) * total;
  for (const k of keys) { if ((x -= weights[k]) < 0) return k; }
  return keys[keys.length - 1] ?? null;
}

/** The factions' weights for these waters. CAPT-WATERS: `deep` the deep waters' - more pirates, less of the trade. */
export function factionWeights({ nearPort = false, notoriety = 0, deep = false } = {}) {
  const w = { ...FACTION_WEIGHTS };
  if (nearPort) { w.merchant += PORT_WEIGHTS.merchant; w.navy += PORT_WEIGHTS.navy; w.pirate *= PORT_PIRATE_K; }   // SEA-EASE: the crown's own waters
  else if (deep) { w.pirate *= DEEP_PIRATE_K; w.merchant *= DEEP_TRADE_K; w.navy *= DEEP_TRADE_K; }   // CAPT-WATERS: the deep waters
  if (notoriety >= HUNTER_AT) w.navy += HUNTER_WEIGHT;
  return w;
}

/**
 * The director. `step(dt, ctx)` answers `{ spawn: spec | null, despawn: id[] }`:
 *   ctx = { density, player: [x, y, z], players: [x, y, z][] (every player the host places - itself included),
 *           level, ships: [{ id, pos, classId, engaged, afloat, theirs, berthed }], isOpenWater(x, z, hull), nearPort, notoriety,
 *           seedBase, seaY, distress: [x, y, z] | null, relieving, ether: { band, legend: { id, classId } | null } | null,
 *           legends: string[] (the legends at sea, any range, any stander's) }
 * SEA-EASE: `distress` where a lawful player is under a pirate's guns with no crown's ship by them, `relieving` a relief
 * already at sea - a relief's spec carries `relief: true`.
 * AUDIT NAV1 (online): a ship `theirs` - another player's, near me - counts against the density and is never mine to
 * despawn; with `density` 0 (a player who does not stand the sea) the director only lets its own ships go.
 * Only a ship `afloat` (not false) counts against the density - a prize, a struck hulk, a ship going down is still at
 * sea but fills no berth (AUDIT NAV1 B1: three prizes emptied the sea until the next transition).
 * A spec is `{ seed, classId, variant, pos, yaw, hunter }`.
 */
export function createNavalDirector({ random = Math.random } = {}) {
  let wait = FIRST_ROLL_S;
  let count = 0;
  /** SEA-PEACE: the pair a launching roll stands on its own stream - the hunter's spec with the quarry's as `company` -
   *  or null (the roll missed, no pair at this level, or no water for both). */
  function encounterSpawn(seed, ctx, nearest) {
    const r = encounterRng(seed);
    if (!(r() < ENCOUNTER_CHANCE)) return null;
    const drawn = /** @type {'plunder'|'patrol'} */ (weightedPick(ENCOUNTERS, r()));
    const kind = ctx.ether ? 'plunder' : drawn;   // ETHER-SEA: no crown's ship past the Veil - a corsair on a trader
    const deep = !ctx.ether && !ctx.nearPort && !!ctx.deep;   // AUDIT CAPTAIN'S SEA D9: a pair of the deep waters is the deep's, as a single is
    const pair = encounterClasses(kind, (ctx.level ?? 1) + (deep ? DEEP_LEVEL : 0) + (ctx.ether?.band?.level ?? 0), r);
    if (!pair) return null;
    for (let i = 0; i < SPAWN_TRIES; i++) {
      const a = r() * Math.PI * 2;
      const d = SPAWN_RING[0] + r() * (SPAWN_RING[1] - SPAWN_RING[0]);
      const mid = [ctx.player[0] + Math.sin(a) * d, ctx.seaY ?? ctx.player[1], ctx.player[2] + Math.cos(a) * d];
      const toPlayer = Math.atan2(ctx.player[0] - mid[0], ctx.player[2] - mid[2]);
      const yaw = toPlayer + (r() < 0.5 ? 1 : -1) * (0.6 + r() * 0.9);
      const gap = ENCOUNTER_GAP[0] + r() * (ENCOUNTER_GAP[1] - ENCOUNTER_GAP[0]);
      const along = (k) => [mid[0] + Math.sin(yaw) * gap * k, mid[1], mid[2] + Math.cos(yaw) * gap * k];
      const hunterPos = along(-0.5), quarryPos = along(0.5);
      if (nearest(hunterPos) < SPAWN_CLEAR || nearest(quarryPos) < SPAWN_CLEAR) continue;
      if (!ctx.isOpenWater(hunterPos[0], hunterPos[2], pair.hunter.hull) || !ctx.isOpenWater(quarryPos[0], quarryPos[2], pair.quarry.hull)) continue;
      const variantOf = (cls) => { const n = HULL_VARIANT_COUNTS[cls.hull] ?? 0; return cls.hull === HULL.LargeBoat && n > 0 ? Math.floor(r() * n) : 0; };
      const etherOf = ctx.ether ? { ether: ctx.ether.band.id } : deep ? { deep: true } : {};   // ETHER-SEA: launched of the Eltheric Ocean; CAPT-WATERS: of the deep
      const company = { seed: hash32(ctx.seedBase >>> 0, count++), classId: pair.quarry.id, variant: variantOf(pair.quarry), pos: quarryPos, yaw, hunter: false, ...etherOf };
      return { seed, classId: pair.hunter.id, variant: variantOf(pair.hunter), pos: hunterPos, yaw, hunter: false, encounter: kind, company, ...etherOf };
    }
    return null;
  }
  /** SEA-EASE - THE RELIEF: a crown's ship for a lawful player under a pirate's guns, on RELIEF_CHANCE of her own
   *  RELIEF_SALT stream - on the ring about them, facing them, her class the navy's at the level - or null. */
  function reliefSpawn(seed, ctx, nearest, at) {
    const r = mulberry32(((seed >>> 0) ^ RELIEF_SALT) >>> 0);
    const roll = r();
    if (!ctx.reliefSure && !(roll < RELIEF_CHANCE)) return null;   // CAPT-BOARD: an Admiral's crown always answers (the draw taken either way)
    const cls = classFor('navy', ctx.level ?? 1, r());
    if (!cls) return null;
    for (let i = 0; i < SPAWN_TRIES; i++) {
      const a = r() * Math.PI * 2;
      const d = SPAWN_RING[0] + r() * (SPAWN_RING[1] - SPAWN_RING[0]);
      const pos = [at[0] + Math.sin(a) * d, ctx.seaY ?? at[1], at[2] + Math.cos(a) * d];
      if (nearest(pos) < SPAWN_CLEAR || !ctx.isOpenWater(pos[0], pos[2], cls.hull)) continue;
      const variants = HULL_VARIANT_COUNTS[cls.hull] ?? 0;
      const variant = cls.hull === HULL.LargeBoat && variants > 0 ? Math.floor(r() * variants) : 0;
      return { seed, classId: cls.id, variant, pos, yaw: Math.atan2(at[0] - pos[0], at[2] - pos[2]), hunter: false, relief: true };
    }
    return null;
  }
  /** ETHER-LEGENDS: the legend whose haunt the captain sails (`ctx.ether.legend`: her class), on LEGEND_CHANCE of her
   *  own LEGEND_SALT stream - on the ring about the captain, her bow on them - or null: never while a legend is at sea
   *  (AUDIT CAPTAIN'S SEA D7/D14), never by a port (SEA-EASE: a captain at a freeport's quay sees none come). */
  function legendSpawn(seed, ctx, nearest) {
    const want = ctx.ether?.legend;
    if (!want?.classId || ctx.nearPort || (ctx.legends ?? []).length || (ctx.ships ?? []).some((s) => s.classId === want.classId)) return null;
    const r = mulberry32(((seed >>> 0) ^ LEGEND_SALT) >>> 0);
    if (!(r() < LEGEND_CHANCE)) return null;
    const cls = SHIP_CLASSES.find((c) => c.id === want.classId);
    if (!cls) return null;
    for (let i = 0; i < SPAWN_TRIES; i++) {
      const a = r() * Math.PI * 2;
      const d = SPAWN_RING[0] + r() * (SPAWN_RING[1] - SPAWN_RING[0]);
      const pos = [ctx.player[0] + Math.sin(a) * d, ctx.seaY ?? ctx.player[1], ctx.player[2] + Math.cos(a) * d];
      if (nearest(pos) < SPAWN_CLEAR || !ctx.isOpenWater(pos[0], pos[2], cls.hull)) continue;
      return { seed, classId: cls.id, variant: 0, pos, yaw: Math.atan2(ctx.player[0] - pos[0], ctx.player[2] - pos[2]), hunter: false, ether: ctx.ether.band.id, legend: want.id };
    }
    return null;
  }
  const director = {
    step(dt, ctx) {
      const out = { spawn: null, despawn: [] };
      const players = ctx.players?.length ? ctx.players : [ctx.player];
      const nearest = (p) => Math.min(...players.map((q) => Math.hypot(p[0] - q[0], p[2] - q[2])));
      for (const s of ctx.ships ?? []) if (!s.engaged && !s.theirs && nearest(s.pos) > DESPAWN_BEYOND) out.despawn.push(s.id);
      if (!((ctx.density ?? 0) > 0)) return out;   // AUDIT NAV1 (online): letting go only - no roll, no draw on the stream
      // SEA-EASE: a lawful player under a pirate's guns with no crown's ship by them - help is rolled for soon, in a
      // berth of its own, one relief at a time
      const distress = Array.isArray(ctx.distress) && !ctx.relieving && !ctx.ether ? ctx.distress : null;   // ETHER-SEA: no navy to answer past the Veil
      if (distress) wait = Math.min(wait, RELIEF_WAIT_S);
      wait -= Math.max(0, dt);
      if (wait > 0) return out;
      wait = SPAWN_EVERY[0] + random() * (SPAWN_EVERY[1] - SPAWN_EVERY[0]);
      // AUDIT NAV1 (B1): a prize, a hulk or a wreck going down fills no berth; SHIP-LIFE: nor a ship moored in a harbour
      // (the harbour's own count, navalHost.js HARBOUR_ROLL)
      const alive = (ctx.ships ?? []).filter((s) => !out.despawn.includes(s.id) && s.afloat !== false && !s.berthed).length;
      if (alive >= (ctx.density ?? 0) + (distress ? 1 : 0) || random() >= SHIP_SPAWN_CHANCE) return out;
      const seed = hash32(ctx.seedBase >>> 0, count++);
      if (distress) {   // while they fight, the sea sends help - never more strangers
        out.spawn = reliefSpawn(seed, ctx, nearest, distress);
        return out;
      }
      // ETHER-LEGENDS: a legend in her haunt, before anything else the roll would launch
      const legend = ctx.ether ? legendSpawn(seed, ctx, nearest) : null;
      if (legend) { out.spawn = legend; return out; }
      // SEA-PEACE: a pair already at it, where the density has room for two
      if (alive + 2 <= (ctx.density ?? 0)) {
        const pair = encounterSpawn(seed, ctx, nearest);
        if (pair) { out.spawn = pair; return out; }
      }
      const rng = mulberry32(seed);
      const ether = ctx.ether ?? null;   // ETHER-SEA: the band's weights and levels past the Veil
      const deep = !ether && !ctx.nearPort && !!ctx.deep;   // CAPT-WATERS
      const faction = weightedPick(ether ? etherFactionWeights(ether.band, { nearPort: !!ctx.nearPort }) : factionWeights({ nearPort: !!ctx.nearPort, notoriety: ctx.notoriety ?? 0, deep }), rng());
      let cls = classFor(faction, (ctx.level ?? 1) + (deep ? DEEP_LEVEL : 0) + (ether?.band?.level ?? 0), rng());
      if (cls?.flagship && (ctx.ships ?? []).some((s) => s.classId === cls.id)) cls = classFor(faction, 1, rng());   // one flagship at a time
      if (!cls) return out;
      for (let i = 0; i < SPAWN_TRIES; i++) {
        const a = rng() * Math.PI * 2;
        const d = SPAWN_RING[0] + rng() * (SPAWN_RING[1] - SPAWN_RING[0]);
        const pos = [ctx.player[0] + Math.sin(a) * d, ctx.seaY ?? ctx.player[1], ctx.player[2] + Math.cos(a) * d];
        if (nearest(pos) < SPAWN_CLEAR) continue;
        if (!ctx.isOpenWater(pos[0], pos[2], cls.hull)) continue;
        const hunter = !ether && faction === 'navy' && (ctx.notoriety ?? 0) >= HUNTER_AT;
        // a hunter comes for the player; anyone else crosses the player's waters on a slant
        const toPlayer = Math.atan2(ctx.player[0] - pos[0], ctx.player[2] - pos[2]);
        const yaw = hunter ? toPlayer : toPlayer + (rng() < 0.5 ? 1 : -1) * (0.6 + rng() * 0.9);
        const variants = HULL_VARIANT_COUNTS[cls.hull] ?? 0;
        const variant = cls.hull === HULL.LargeBoat && variants > 0 ? Math.floor(rng() * variants) : 0;
        out.spawn = { seed, classId: cls.id, variant, pos, yaw, hunter, ...(deep ? { deep: true } : {}), ...(ether ? { ether: ether.band.id } : {}) };   // CAPT-WATERS: launched of the deep; ETHER-SEA: of the Eltheric Ocean
        break;
      }
      return out;
    },
    /** The water was left, or a transition: the next roll waits its first wait again. */
    reset() { wait = FIRST_ROLL_S; },
    get count() { return count; },
    set count(n) { count = Math.max(0, n | 0); },
  };
  return director;
}

/** CAPT-WATERS: the deep waters begin this many map pixels (Chebyshev) from every port; their weights, levels, temper
 *  and holds. */
export const DEEP_PX = 12;
export const DEEP_PIRATE_K = 1.8;
export const DEEP_TRADE_K = 0.5;
export const DEEP_LEVEL = 3;
export const DEEP_BOLD = 0.5;
export const DEEP_TIER = 2;
/** CAPT-WATERS: the waters a captain sails - 'coastal' within a port's reach (SEA-EASE's own `nearPort`), 'deep' DEEP_PX
 *  and more from every port (`portPx`: the nearest port's distance in map pixels, null where none is known), else
 *  'open'. */
export const watersOf = ({ nearPort = false, portPx = null } = {}) => (nearPort ? 'coastal' : Number.isFinite(portPx) && portPx >= DEEP_PX ? 'deep' : 'open');

/** The seed base's own salt: the waters' - the host folds a stander's id into it online (navalHost.js idSalt). */
export const SEED_SALT = 0x5ea;
/** The seed base of a pixel on a day - what the host folds the waters into. */
export const seedBaseOf = (px, py, day, salt = SEED_SALT) => hash32(px | 0, py | 0, day | 0, salt);
