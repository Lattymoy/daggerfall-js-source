// @ts-check
// SOUNDSCAPE (2026-10-24, the owner: "enhancing sound and ambience, different music and ambience sounds for sailing,
// more varied horse sounds, and whatever else we could improve") - THE SOUNDSCAPE'S HOST HALF. Design:
// bible/08-Audio/Audio.md SOUNDSCAPE. The laws are the systems' (systems/soundscape/seaAir.js, worldAir.js,
// seaScore.js); this module reads the world host's doors once a frame, keeps what is dear to ask (the shore's edge, the
// land near, the doors near, a port near) on clocks of its own, and plays them. The world host constructs it once and
// calls it (HOST-SPLIT: fishHost.js's shape) - three calls: `frame` on the exterior frame, `stop` on every modal one
// (a building, a dungeon, a cabin: the port's own sounds fall silent indoors, as the wind does), and `scoreFrame` in
// the music's chain (the sea's songs hold the music while I sail, before the director).
//
//   deps = {   (the world's own doors and objects, handed as they are - LEGIBLE's ceilings: no wrapper where none must be)
//     audio, music                                  the engine; the music service (registerSong, playSong, fadeOut)
//     boat() -> the boat I sail or ride | null      world.js csaBoatUnderMe: my own at her helm, or another player's
//                                                   I stand aboard
//     aboard() -> I stand on a ship's deck          the naval host's aboard: a boat of mine off her helm (at anchor),
//                                                   a sea ship's, a peer's (AUDIT SOUNDSCAPE S2: a deck off the helm was
//                                                   land - no sea, and the shore's surf at full over deep water)
//     bow(boat, yaw) -> her heading [x, 0, z]       world.js boatForward: off her root's rotation (S3)
//     csa -> Come Sail Away's runtime | null        helmPanelState (her way, her sails, in irons), IsNearPort
//     fight() -> a sea fight as the watch knows it  the naval host's battle: her guns run out, the crew called to them
//                                                   (WK-W2's alarm - by night a ship the night's law shows), a boarding
//                                                   (AUDIT SOUNDSCAPE M2: hostileNear's 700 m gave a dark ship away)
//     pixel() -> my map pixel { x, y }              seaPixel(x, y) -> the open sea there (world.js openSea - AUDIT
//                                                   SOUNDSCAPE W8: never a lake the map draws)
//     dw -> Deep Waters' player | null              rawColumnAt(x, z) -> { depth, oceanY } over the open sea, null
//                                                   elsewhere: the shore's edge is found by it, from either side
//     inTown() -> I stand in a town                 PlayerGPS.IsPlayerInTown(true, true) (world.js _isPlayerInTownStrict -
//                                                   AUDIT SOUNDSCAPE W1: never a dungeon's, a graveyard's or a coven's rect)
//     towns() -> the living towns' index (y * 1000 + x -> { blocks })
//     doors -> the host's building doors            each { door, pixelKey, dfBlock, recordIndex }; doorAt(entry) -> its
//                                                   door in the scene's frame (world.js shiftedDoor: its building's
//                                                   placement, its centre and normal in the model's own space)
//   }
// Not a DFU member - Ledger A (SOUNDSCAPE). THE FOUR HOSTS: world.js wires it; worldModes.js (interiors) and
// dungeonContext.js stop it by the modal frame's return (no air of the open world indoors or underground);
// scenes/exterior.js - FLAGGED: the fixed-city bench stands no sea, no boats and no streamed shore - its ambience is DFU's.
import { enhancedSoundsOn } from '../systems/enhancedSounds.js';
import { createSeaAir } from '../systems/soundscape/seaAir.js';
import { createWorldAir } from '../systems/soundscape/worldAir.js';
import { installSoundscapeSounds } from '../systems/soundscape/soundscapeSfx.js';
import { createSeaScore, seaScoreSongs, SEA_SCORE_SILENCE } from '../systems/soundscape/seaScore.js';
import { isNight } from '../world/worldClock.js';
import { CLIMATES } from '../formats/mapsTables.js';
import { BUILDING_TYPES } from '../world/buildingNames.js';
import { doorSpotsNear } from '../characters/foeSpacing.js';   // AUDIT SOUNDSCAPE W2: a door's own centre and its outward face, the one home
import { animatorOf } from '../systems/comeSailAway/comeSailAwayBoat.js';

/** The gulls' land: a map pixel within this ring of mine that is not the sea. */
export const GULL_RING = 2;
/** THE SHORE'S EDGE, found by asking the sea on SHORE_BEARINGS bearings at each of SHORE_RADII m, nearest first; the
 *  first ring where the water changes - the sea deeper than SHORE_DEPTH from the land, the shallows or the land from the
 *  sea (AUDIT SOUNDSCAPE W3: a swimmer far out was at the edge) - holds the edge, which a few halvings along each bearing
 *  that met it place, the nearest of them. */
export const SHORE_RADII = Object.freeze([6, 14, 28, 50, 85, 130, 200]);
export const SHORE_BEARINGS = 12;
export const SHORE_DEPTH = 0.3;
/** Without the sea's depth (Deep Waters not standing), a coast is heard as a far surf off a map pixel the sea is beside. */
export const SHORE_FAR_M = 150;
/** How often the dear questions are asked again (s), and how far I may walk before they are asked at once (m). */
export const ASK_EVERY_S = 0.5;
export const ASK_MOVED_M = 15;
/** The doors the town's sounds stand at: the smithies' and the taverns', within this of the ear (m) - each at its own
 *  doorway (AUDIT SOUNDSCAPE W2: its building's placement is the building's middle, 7 to 13 m inside it), DOOR_OUT_M
 *  out from it along its outward face. */
export const DOORS_REACH_M = 70;
export const DOOR_OUT_M = 1.2;
const SMITHIES = new Set([BUILDING_TYPES.Armorer, BUILDING_TYPES.WeaponSmith]);
/** The score's word while I am at no helm. */
const NOT_SAILING = Object.freeze({ sailing: false, fight: false, weather: 'sunny', night: false, nearPort: false, way: 0 });
const TAVERNS = new Set([BUILDING_TYPES.Tavern]);
/** A boat I ride and do not steer (another player's - AUDIT SOUNDSCAPE S4: her way and sails were my own idle helm's,
 *  lying still and furled at six knots): her way is her root's own going, eased over WAY_TAU_S; a step faster than
 *  WAY_JUMP_MPS is a recentre of the scene or her snap, never her way. */
export const WAY_TAU_S = 0.6;
export const WAY_JUMP_MPS = 40;
/** Whether any of a boat's sails is set - her masts' Animators, as Come Sail Away and the peers' word leave them. Pure. @param {any} boat */
export const sailsSet = (boat) => (boat?.Sails ?? []).some((/** @type {any} */ sail) => animatorOf(sail)?.GetBool?.('Stowed') === false);

/**
 * THE SHORE'S EDGE near `ear` (the scene's frame): `{ dist, dir, at }` - metres to where the water changes (the sea
 * deeper than SHORE_DEPTH meeting the shallows or the land), the bearing to it ([x, z], unit) and the edge itself as a
 * scene point at the sea's surface (AUDIT SOUNDSCAPE W9, W10: a point that stands while the ear moves, at the water,
 * never at the ear's height off a cliff) - or null with no edge within the last ring: inland, or far out at sea. Pure
 * (`columnAt` the only door: the sea's column at a point - { depth, oceanY } - or null off the sea).
 * @param {number[]} ear @param {(x: number, z: number) => ({ depth?: number, oceanY?: number } | null)} columnAt
 */
export function shoreEdge(ear, columnAt) {
  let surface = NaN;
  const deep = (x, z) => {
    const c = columnAt(x, z), d = Number(c?.depth);
    if (Number.isFinite(c?.oceanY)) surface = /** @type {number} */ (c?.oceanY);
    return Number.isFinite(d) && d > SHORE_DEPTH;
  };
  const here = deep(ear[0], ear[2]);
  let inner = 0;
  for (const r of SHORE_RADII) {
    /** @type {{ dist: number, dir: number[] } | null} */
    let best = null;
    // every bearing that meets the water on this ring, each placed along itself - the nearest is the edge (a slanting
    // bearing meets a straight shore further off than the one square to it)
    for (let b = 0; b < SHORE_BEARINGS; b++) {
      const a = (2 * Math.PI * b) / SHORE_BEARINGS, dir = [Math.sin(a), Math.cos(a)];
      if (deep(ear[0] + dir[0] * r, ear[2] + dir[1] * r) === here) continue;
      let lo = inner, hi = r;
      for (let k = 0; k < 5; k++) { const m = (lo + hi) / 2; if (deep(ear[0] + dir[0] * m, ear[2] + dir[1] * m) === here) lo = m; else hi = m; }
      if (!best || hi < best.dist) best = { dist: hi, dir };
    }
    if (best) {
      const { dist, dir } = best;
      return { dist, dir, at: [ear[0] + dir[0] * dist, Number.isFinite(surface) ? surface : ear[1] - 1, ear[2] + dir[1] * dist] };
    }
    inner = r;
  }
  return null;
}

/** Whether land is near a map pixel - one within GULL_RING that is not the sea. Pure. @param {number} px @param {number} py @param {(x: number, y: number) => boolean} isSea */
export function landNear(px, py, isSea) {
  for (let dy = -GULL_RING; dy <= GULL_RING; dy++) for (let dx = -GULL_RING; dx <= GULL_RING; dx++) if (!isSea(px + dx, py + dy)) return true;
  return false;
}
/** Whether the sea is beside a map pixel - its own or one of the eight about it. Pure. @param {number} px @param {number} py @param {(x: number, y: number) => boolean} isSea */
export function seaBeside(px, py, isSea) {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (isSea(px + dx, py + dy)) return true;
  return false;
}

/** A door's building type, off its block's own list (the record its door names), or -1. Pure. @param {any} entry */
export const doorBuildingType = (entry) => entry?.dfBlock?.rmbBlock?.fldHeader?.buildingDataList?.[entry?.recordIndex]?.buildingType ?? -1;

/** The climate's word for the seasons: a winter there, or none (the desert's and the rainforest's never come). Pure. */
export const winterIn = (climate, winter) => !!winter && climate !== CLIMATES.Desert && climate !== CLIMATES.Desert2 && climate !== CLIMATES.Rainforest && climate !== CLIMATES.Subtropical;

/**
 * @param {{ audio: any, music: any, boat: () => any, aboard?: () => boolean, bow?: (boat: any, yaw: number) => number[], csa: any, fight: () => boolean, pixel: () => ({ x: number, y: number } | null),
 *   seaPixel: (x: number, y: number) => boolean, dw: any, inTown: () => boolean, towns: () => Map<number, { blocks?: number }>,
 *   doors: any[], doorAt: (entry: any) => any }} deps
 */
export function createSoundscapeHost(deps) {
  const columnAt = deps.dw?.rawColumnAt ? (/** @type {number} */ x, /** @type {number} */ z) => deps.dw.rawColumnAt(x, z) : null;
  const sea = createSeaAir({ engine: deps.audio });
  const world = createWorldAir({ engine: deps.audio });
  const score = createSeaScore();
  let songsMade = false, held = false;
  // the way of a boat I ride (S4): her last place and her eased speed
  let rode = null, rodeAt = [0, 0, 0], rodeWay = 0;
  const wayOf = (/** @type {any} */ boat, /** @type {number} */ dt) => {
    const p = boat?.GameObject?.position;
    if (!p || boat !== rode || !(dt > 0)) { rode = p ? boat : null; rodeWay = 0; }
    else {
      const v = Math.hypot(p[0] - rodeAt[0], p[2] - rodeAt[2]) / dt;
      if (v <= WAY_JUMP_MPS) rodeWay += (v - rodeWay) * Math.min(1, dt / WAY_TAU_S);
    }
    if (p) { rodeAt[0] = p[0]; rodeAt[1] = p[1]; rodeAt[2] = p[2]; }
    return rodeWay;
  };
  /** the sea's word for the music, as the last frame left it (null: on no deck) */
  let sailing = null;
  // the dear questions, asked on their own clock
  let askIn = 0, askedAt = null, pixKey = '', land = false, port = false, coast = false, blocks = 1;
  /** @type {{ dist: number, dir: number[] | null, at?: number[] } | null} */ let shore = null;
  /** @type {number[][]} */ let smithies = [];
  /** @type {number[][]} */ let taverns = [];
  const ask = (ear) => {
    const p = deps.pixel?.() ?? null;
    const key = p ? `${p.x},${p.y}` : '';
    if (key !== pixKey) {
      pixKey = key;
      land = !!p && landNear(p.x, p.y, deps.seaPixel);
      coast = !!p && seaBeside(p.x, p.y, deps.seaPixel);
      try { port = !!deps.csa?.IsNearPort?.(3); } catch { port = false; }
      try { blocks = p ? deps.towns?.()?.get(p.y * 1000 + p.x)?.blocks ?? 1 : 1; } catch { blocks = 1; }
    }
    shore = columnAt ? shoreEdge(ear, columnAt) : coast ? { dist: SHORE_FAR_M, dir: null } : null;
    smithies = []; taverns = [];
    for (const e of deps.doors ?? []) {
      const type = doorBuildingType(e);
      const list = SMITHIES.has(type) ? smithies : TAVERNS.has(type) ? taverns : null;
      if (!list) continue;
      const spot = doorSpotsNear([e], ear, DOORS_REACH_M, deps.doorAt)[0];
      if (!spot) continue;
      const [nx, , nz] = spot.normal, l = Math.hypot(nx, nz) || 1;
      list.push([spot.pos[0] + (nx / l) * DOOR_OUT_M, spot.pos[1], spot.pos[2] + (nz / l) * DOOR_OUT_M]);
    }
  };
  const stopAll = () => { sea.stop(); world.stop(); sailing = null; };
  return {
    /**
     * Once an exterior frame, after the host's setListener (the ear and its forward are the engine's listenerPose -
     * `ear` and `fwd` given take their place): `wd` the frame's wind (windDrive - the ear's one wind, the sky's: WIND3's
     * bed and the sea's state say the same air; her sailing reads Come Sail Away's own, AUDIT SOUNDSCAPE S11), `weather`
     * the word the ear hears (soundWeather), `minute` the world's minute of the day, `climate` CLIMATE.PAK's under me,
     * `winter` the season's, `paused` the game's.
     * @param {number} dt
     * @param {{ ear?: number[], fwd?: number[], wd: any, weather: string, minute: number, climate: number, winter: boolean, paused: boolean }} f
     */
    frame(dt, f) {
      const pose = f?.ear ? null : deps.audio?.listenerPose?.() ?? null;
      const ear = f?.ear ?? pose?.pos, fwd = f?.fwd ?? pose?.fwd ?? [0, 0, 1];
      if (!enhancedSoundsOn() || !Array.isArray(ear) || !ear.every(Number.isFinite)) { stopAll(); return; }
      installSoundscapeSounds(deps.audio);   // AUDIT SOUNDSCAPE S7: a load that failed is asked again on the loader's own backoff
      if ((askIn -= Math.max(0, dt)) <= 0 || !askedAt || Math.hypot(ear[0] - askedAt[0], ear[2] - askedAt[2]) > ASK_MOVED_M) {
        askIn = ASK_EVERY_S; askedAt = [...ear];
        ask(ear);
      }
      const minute = Number(f.minute) || 0, night = isNight(minute), wind = f.wd?.on ? f.wd.strength01 : 0.35, gust = f.wd?.gust ?? 0.7;
      const boat = deps.boat?.() ?? null;
      let aboard = !!boat;
      if (!aboard) { try { aboard = !!deps.aboard?.(); } catch { aboard = false; } }
      if (aboard) {
        world.stop();
        let helm = null;
        if (boat) { try { helm = deps.csa?.helmPanelState?.() ?? null; } catch { helm = null; } }
        // my helm says her way and her sails; a boat I ride says them by her own going and her masts (S4); a deck
        // off any helm - mine at anchor, a sea ship's - lies still
        const way = helm ? Number(helm.way) || 0 : boat && !f.paused ? wayOf(boat, dt) : boat ? rodeWay : 0;
        const sailsUp = helm ? !!helm.sailsUp : sailsSet(boat);
        const bow = boat?.GameObject?.rotation && deps.bow ? deps.bow(boat, 0) : null;
        sea.frame(dt, { ear, fwd, bow, way, sailsUp, inIrons: !!helm?.inIrons, wind, gust, weather: f.weather, night, nearLand: land, minute, paused: f.paused });
        // the score's word: at a helm the sea's law; aboard off it, the fight's alone (AUDIT SOUNDSCAPE M1: a boarding
        // lets the helm go - its deck fight is the sea fight's still, and a fight ended aboard keeps its tail)
        sailing = { sailing: !!helm, aboard: true, fight: !!deps.fight?.(), weather: f.weather, night, nearPort: port, way };
        return;
      }
      sea.stop();
      sailing = null;
      let inTown = false;
      try { inTown = !!deps.inTown?.(); } catch { inTown = false; }
      world.frame(dt, {
        ear, climate: f.climate, night, hour: minute / 60, weather: f.weather, wind, winter: winterIn(f.climate, f.winter),
        inTown, townBlocks: blocks, shore, smithies, taverns, paused: f.paused,
      });
    },
    /** On every modal frame: silent, nothing left looping. */
    stop: stopAll,
    /**
     * THE SEA'S SONGS hold the music while I sail (systems/soundscape/seaScore.js) - before the director, after the
     * gate's, the Hour's and the arena's. The songs are made the first time a helm is taken; let go by a fade, never a
     * cut, the frame I sail no more (the director's next frame plays its own). Answers whether the sea holds the music.
     */
    scoreFrame(now = Date.now()) {
      const want = score.want(sailing && enhancedSoundsOn() ? sailing : NOT_SAILING, now);
      if (want == null) {
        if (held) { held = false; deps.music?.fadeOut?.(); }
        return false;
      }
      if (!songsMade) { songsMade = true; for (const song of Object.values(seaScoreSongs())) deps.music?.registerSong?.(song.name, song); }
      held = true;
      if (want === SEA_SCORE_SILENCE) { if (deps.music?.current !== null) deps.music?.fadeOut?.(); } else deps.music?.playSong?.(want);
      return true;
    },
  };
}
