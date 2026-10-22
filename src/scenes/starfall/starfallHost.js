// @ts-check
// STAR4-STAR6 (2026-10-20, the owner: "something coming from the sky and crashing into the ground, where people need to
// defend the objective in a wave based format with a boss topping off the encounter at the end", and "multiple encounters
// spread throughout the region, not just one"): THE STARFALL IN THE WORLD. Design: bible/11-Multiplayer/Starfall.md.
//
// WHILE THE WITCHES' FESTIVAL RUNS (net/starfall/starfallLaw.js starfallRuns - the festival's own calendar, net/festivalLaw.js;
// and after its close while a star it saw land still stands - starfallStands) a coven's rite pulls three stars a night down into its region's wilds (systems/starfall/starfallSites.js -
// found over this client's own map files, every client the same). Each star lives on the clock alone: its omen burns over
// the region, it tears loose and falls (render/starfall/starfallPass.js), lands with a flash, a ring of shock and the
// storms' own thunder at its distance, and stands in its crater (world/starfall/starModel.js) with its beacon over it
// until its deadline - held gold, or lost dark - and then it is gone.
//
// ITS DEFENSE is the camp law of the World of Daggerfall (world/worldOfDaggerfall/wodShared.js starSiteId): the first
// player within STAR_SAY_M springs its coven and owns their foes - every other screen sees the owner's - and the star's
// CELL keeps its ledger (server/src/index.js `_star*`): this screen's word to it every STAR_WORD_MS (net/online.js
// sendStar), its ledger back (`st`), the waves the owner stands when the ledger says (systems/starfall/starCoven.js), the
// star a body in the owner's machine its own coven's monsters hunt (characters/enemy/enemyTargets.js huntsStar - each
// landed blow one of its light), the master and its circle - which wards it while any of it stands (scenes/
// exteriorFoes.js damageFoe, `circleWard`) - and the hold, its receipt the relay's.
//
// WHAT A PLAYER READS: the region's lines (the omen, the fall), the words at the star as its ledger moves, the hub's word
// of a hold, the tracker (ui/starfall/starTracker.js), the master's bar (ui/starfall/starBar.js), the map's cards, the
// compass and the timers row (systems/starfall/starfallClient.js). Every word through t() (systems/starfall/starWords.js).
//
// The host (scenes/world.js bootWorld) constructs it once and calls it; it owns its state and its frame (HOST-SPLIT,
// bible/01-Overview/Host-Split.md - the shape of scenes/fishHost.js). Not a DFU member. Ledger A (STARFALL).
import {
  starfallRuns, starInWindow, starNightAt, starTimes, starStreakBearing, starCircleSize, STAR_WORD_MS, STAR_ORPHAN_MS,
  STAR_CIRCLE_AT, STAR_LOW_LIGHT, STAR_LIGHT, starLostAt, P_WAVE, P_BREATH, P_MASTER, P_HELD, P_LOST, STAR_LOST_DARK,
  STAR_LIFE_MS, STAR_AFTER_MS, STAR_WAVE_MAX, STAR_ACCOUNTS_MAX, STAR_BLOWS_WIRE_MAX, STAR_FOE_HEALTH,
} from '../../net/starfall/starfallLaw.js';
import { worldRoom } from '../../net/wire.js';
import { storedSession } from '../../net/accountClient.js';
import { appStorage } from '../../systems/appStorage.js';
import { characterIdOf } from '../../systems/characterId.js';
import { findStarSites } from '../../systems/starfall/starfallSites.js';
import { heartStar } from '../../systems/starfall/starfallNight.js';
import { covenWitches } from '../../systems/starfall/starfallCovens.js';
import { starWaveFoes, starMasterOf, starCircleFoes, covenFemale, STAR_MEMBERS } from '../../systems/starfall/starCoven.js';
import {
  starClockPhase, starStandPlaces, starCirclePlaces, starWordOf, starWordKey, starTrackerModel, starHeldKey, starMapMarks,
  starTimerRows, starHeldLine, STAR_SAY_M, STAR_HUD_M, STAR_SHAKE_M, STAR_RESAY_MS,
} from '../../systems/starfall/starfallClient.js';
import { STAR_REGION_TEXT, STAR_AT_TEXT } from '../../systems/starfall/starWords.js';
import { playStarSound, starHeardAfterMs } from '../../systems/starfall/starSounds.js';
import { starSiteId, isStarSite } from '../../world/worldOfDaggerfall/wodShared.js';
import { buildStarModel, rimAt, STAR_BARE_R, STAR_STONE_H, STAR_RIM_H } from '../../world/starfall/starModel.js';
import { lateSolidsOf } from '../../player/lateSolid.js';   // STAR-TUNE: the crater a late solid - never closed on a body standing in it
import { starArt, STAR_ARCHIVE, STAR_GLASS_RECORD, STAR_GOLD_RECORD, STAR_DARK_RECORD } from '../../world/starfall/starArt.js';
import {
  StarfallPassRenderer, streakAt, omenAt, skyClamp, shockRingAt, STAR_TRAIL_M, STAR_HEAD_W, STAR_FLASH_W, STAR_FLASH_MS, STAR_FALL_COLOR,
  STAR_RING_SEGS, STAR_RING_WIDTH_M,
} from '../../render/starfall/starfallPass.js';
import { warmPrograms } from '../../render/warmPrograms.js';
import { findGateSite } from '../../systems/gate/gateSite.js';
import { thunderOf, thunderSourceAt, THUNDER_SOURCE_M } from '../../systems/distantStorms.js';
import { renownStruckAt } from '../../net/renownTracker.js';
import { setMidScreenText } from '../../ui/midScreenText.js';
import { drawGateBossBar } from '../../ui/gate/gateBossBar.js';
import { drawStarTracker, destroyStarTracker } from '../../ui/starfall/starTracker.js';
import { createStarRewards } from './starRewards.js';
import { starBarModel } from '../../ui/starfall/starBar.js';
import { playerEntity } from '../../characters/playerEntity.js';
import { audio as defaultAudio } from '../../systems/audio.js';
import { betterAmbience } from '../../systems/betterAmbience.js';
import { trs } from '../../world/mat4.js';

/** The crater and its stone are built for a player this near (beyond it the beacon and the sky alone). */
export const STAR_BUILD_M = 1500;
/** The landing's flash lights the land this far. */
export const STAR_FLASH_LIGHT_M = 400;
/** The stone's own glow, for a player near it. */
export const STAR_GLOW_RANGE = 14;
export const STAR_GLOW_REACH_M = 90;
/** The held beacon thins over this long after the hold. */
export const STAR_HELD_FADE_MS = 60_000;
/** A standing star's beacon at no light left: this share of its full strength (it never quite goes out before it is lost). */
export const STAR_BEACON_DIM = 0.3;
/** A stand that stood nothing is tried again this long after. */
export const STAR_RESTAND_MS = 4000;
/** The star's hum is played this often for a player near it. */
export const STAR_HUM_MS = 7000;
/** The ground under the crater is read again every this many frames, the stone made again when it moved this far. */
export const STAR_GROUND_EVERY = 20;
export const STAR_GROUND_TOL = 0.01;
/** AUDIT STARFALL R9: the coarse ground under a star on a pixel not built yet is read once and again only this many
 *  frames on (the world's kernel is one for the gate's pixel - three stars and a gate asking it in turn each frame made
 *  it again at every ask). */
export const STAR_COARSE_EVERY = 600;
/** AUDIT STARFALL R4: the crater's floor drawn this far toward the eye (polygonOffset's factor and units - the ground's
 *  fire's, render/auraRing.js): STAR_FLOOR_LIFT alone is lost in a 24-bit depth at range. */
export const STAR_FLOOR_OFFSET = Object.freeze([-1, -4]);
/** The collider's bucket a star's stone stands under. */
export const starBucket = (key) => `star:${key}`;
/** Where a character's own blows on a star are kept across a page's reload (the owner's count - the relay credits a
 *  count past its last, so a reloaded owner counts on from its own). AUDIT STARFALL C6: under the account AND the
 *  character that saw them (`<account>|<character>|<star>`), so a second account on the device counts from its own; and
 *  never under what the cell says this account was credited (`hm`, the speaker's own copy of the ledger), so a page that
 *  kept none (a private window) counts on from the relay's. */
export const STAR_BLOWS_STORE = 'dagger:starBlows';
/** AUDIT STARFALL C7: THE MOST OF A STAR'S FOES ITS OWNER STANDS AT ONCE - what the law can call at one moment: a wave's
 *  most (STAR-TUNE: twenty-four), the master, and both its circle's calls at the Heart-Star's size. Every stand is held to it, and a reader stands
 *  a star's foes under an allowance of the same size (world/worldOfDaggerfall/wodShared.js WOD_STAR_PUPPETS_MAX). */
export const STAR_LIVE_MAX = STAR_WAVE_MAX + 1 + STAR_CIRCLE_AT.length * starCircleSize(STAR_ACCOUNTS_MAX, true);

/**
 * AUDIT STARFALL C5: WHETHER THE STARFALL STANDS ON THIS SCREEN at `nowMs` - while the festival is open, or while a star
 * that LANDED inside it can still stand (to its deadline and STAR_AFTER_MS past it: the relay keeps such a star's
 * ledger to its end - starInWindow). The festival open that long ago is the test: a moment it answers with no festival
 * star standing finds none (the night's sites keep only a star landed inside it). The client's alone - the relay never
 * asks it, so the relay's law (net/starfall/starfallLaw.js) and its bundle's bytes stay as they are. Pure.
 */
export const starfallStands = (/** @type {number} */ nowMs) => starfallRuns(nowMs) || starfallRuns(nowMs - STAR_LIFE_MS - STAR_AFTER_MS);

const NONE = Object.freeze([]);
const DOWN = [0, -1, 0];
const hitDistance = (hit) => (hit && Number.isFinite(hit.dist) ? hit.dist : null);
const dist2 = (a, x, z) => Math.hypot(a[0] - x, a[2] - z);
const sameAt = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
/** A placement moved (gatePool.js's tolerance). */
const sameMatrix = (a, b) => { if (!a || !b) return false; for (let i = 0; i < 16; i++) if (Math.abs(a[i] - b[i]) >= 5e-4) return false; return true; };

/** The blows each account's character saw land on each star, kept across a reload (`who` the account and the character). */
function blowStore(storage) {
  let map = {};
  try { const v = JSON.parse(storage?.getItem?.(STAR_BLOWS_STORE) ?? '{}'); if (v && typeof v === 'object') map = v; } catch { map = {}; }
  const nightOf = (k) => Number(String(k).split('|').pop().split('.')[0]);
  return {
    get: (who, key) => { const v = map[`${who}|${key}`]; return Number.isSafeInteger(v) ? v : 0; },
    set(who, key, n, night) {
      map[`${who}|${key}`] = n;
      for (const k of Object.keys(map)) if (!(nightOf(k) >= night - 1)) delete map[k];   // a night gone lets its counts go
      try { storage?.setItem?.(STAR_BLOWS_STORE, JSON.stringify(map)); } catch { /* a private window keeps none */ }
    },
  };
}

/**
 * THE HOST'S BINDINGS, BY NAME (the shape of the moved modules' - scenes/travelViewMarks.js): the world's own things,
 * read here as this module needs them - its settled ones by value, every live one (a `let` the world writes) through a
 * getter on `host`. `renderer`, `state` (pixelTranslation), `exteriorFoes`, `gateScanOf` and `warmGateScan` (the gate's
 * scan, which the night's stars are found over), `surfaceAt` and `gateGroundAt` (the drawn ground, and the coarse one
 * past it), `player`, `walkMode` and `playerSpawned` (the feet), `online` (the session), the camp law's five
 * (`_wodPeerSprung`, `wodPeerHeldAgo`, `wodForgetPeer`, `wodSprang`, `wodUnsprang`), `chatNotice`, `labGrassField`,
 * `_questRegionIndex`, `gamePaused` and `townTalk` (the HUD's hide), `collider`, `_sharedOffsetMs`; STAR7's rewards'
 * (scenes/starfall/starRewards.js): `takeSpoil`, `relayNowS`, `marksBook`, `renownXpAdopt`, `renownAdopt`, `renownRose`,
 * `renownSaid` - and, for the tests, `audio`, `storage`, `starAccount` and `rewardsStorage`.
 * @param {any} host
 */
export function createStarfallHost(host) {
  const renderer = host.renderer ?? null;
  const collider = () => host.collider ?? null;
  const now = () => Date.now() + (host._sharedOffsetMs ?? 0);
  const scan = () => host.gateScanOf?.(() => false) ?? null;   // a row an ask - the rest the idle warm's (the Hollow's way)
  const warmScan = () => host.warmGateScan?.();
  const pixelTranslation = (px, py, out) => host.state.pixelTranslation(px, py, out);
  const groundAt = (x, z) => host.surfaceAt?.(x, z) ?? NaN;
  const coarseGround = host.gateGroundAt ? (px, py, x, z) => host.gateGroundAt(px, py, x, z) : null;
  const feet = () => (host.walkMode && host.playerSpawned ? host.player?.feetAt?.() ?? null : null);
  const session = () => host.online ?? null;
  const foes = host.exteriorFoes ?? null;
  const camp = {
    peerSprang: (site) => !!host._wodPeerSprung?.has(site), peerHeldAgo: (site) => host.wodPeerHeldAgo?.(site) ?? 0,
    forgetPeer: (site) => host.wodForgetPeer?.(site), sprang: (site) => host.wodSprang?.(site), unsprang: (site) => host.wodUnsprang?.(site),
  };
  const say = (text) => host.chatNotice?.(text);
  const onBare = (x0, z0, x1, z1) => host.labGrassField?.invalidate?.(x0, z0, x1, z1);
  const shake = (k) => betterAmbience.weaponKick?.(k);
  const regionAt = () => host._questRegionIndex?.() ?? -1;
  const hudHidden = () => !!host.gamePaused?.() || !!host.townTalk?.hudHidden;
  const two = (v) => String(v).padStart(2, '0');
  const localTime = (ms) => { const d = new Date(ms); return Number.isFinite(ms) ? `${two(d.getHours())}:${two(d.getMinutes())}` : ''; };
  const rewards = createStarRewards(host);   // STAR7: the receipts carried, the spoils given, the Renown adopted
  const storage = host.storage !== undefined ? host.storage : appStorage();   // the desktop app's file store, or the browser's
  const audio = host.audio ?? defaultAudio;
  /** The frame's fog, as the gate's pass is handed it. */
  const fogOf = () => (renderer ? { mode: renderer._fogMode, density: renderer._fogDensity, range: renderer._fogRange, color: renderer._fogColor, camPos: renderer._camPos, focus: renderer._focus, haze: renderer._haze } : null);
  /** night -> its stars (findStarSites), or null where the scan had none */
  const nights = new Map();
  /** starHeldKey -> the star's own record on this screen (made as it comes into its omen, let go when it is gone) */
  const stars = new Map();
  /** starHeldKey -> the cell's last word of it (`st`), and when it came */
  const ledgers = new Map();
  /** starHeldKey -> the hub's word of a hold: `{ top, c, at }` */
  const held = new Map();
  const blows = blowStore(storage);
  /** AUDIT STARFALL C6: whose count a blow is - the signed-in account (the rewards' own door, or the stored session) and
   *  the character standing here - read again once a second at most. */
  const whoNow = { at: -Infinity, id: '' };
  const who = () => {
    const t = Date.now();
    if (t - whoNow.at < 1000 && whoNow.id) return whoNow.id;
    let acct = null;
    try { acct = host.starAccount ? host.starAccount.me?.() ?? null : storedSession(storage)?.id ?? null; } catch { acct = null; }
    whoNow.at = t; whoNow.id = `${acct ?? '-'}|${characterIdOf(playerEntity) ?? '-'}`;
    return whoNow.id;
  };
  let pass = null, passTried = false, passWarming = false, artUp = false, frameN = 0, barUp = false, trackerUp = false;
  const thunders = [];   // [{ due, key, clip, volume }] - the landing's cues, each heard its distance late
  const glow = { x: 0, y: 0, z: 0, range: STAR_GLOW_RANGE }, glowList = Object.freeze([glow]);
  const flashLight = { x: 0, y: 0, z: 0, range: STAR_FLASH_LIGHT_M, color: STAR_FALL_COLOR };
  const sky = { beacons: [], glows: [], trails: [], rings: [] };
  const T3 = [0, 0, 0];

  // ── the sky's pass ──
  function ensurePass() {
    if (pass || passTried || !renderer?.gl) return;
    passTried = true;
    try { pass = new StarfallPassRenderer(renderer.gl); } catch (e) { console.warn('[star] the sky pass would not build', e?.message ?? e); }
  }
  /** AUDIT STARFALL R9 (PERF-COMPILE1's law, render/warmPrograms.js): the pass's three programs built at idle - while the
   *  festival stands, and again as a night's first star comes - never inside the frame of the first omen. A page with no
   *  idle queue (node's tests) builds it there, as the draw always could. */
  function warmPass() {
    if (pass || passTried || passWarming || !renderer?.gl) return;
    if (!globalThis.requestIdleCallback) { ensurePass(); return; }
    passWarming = true;
    void warmPrograms([ensurePass]);   // a step that finds it built builds nothing (ensurePass)
  }
  if (starfallStands(now())) warmPass();

  // ── the night's stars ──
  function sitesOf(n) {
    if (nights.has(n)) return nights.get(n);
    let sc = null;
    try { sc = scan(); } catch { sc = null; }
    if (!sc) { warmScan(); return NONE; }   // the gate's scan is still being made in the browser's idle moments
    let list = NONE;
    // a star whose landing is outside the festival's window is none (the relay hears no word of it - starWordHeard)
    try { list = Object.freeze(findStarSites(n, sc, { gateSiteOf: (day) => { try { return findGateSite(day, sc); } catch { return null; } } }).filter((s) => starInWindow(s.n, s.k))); } catch (e) { console.warn('[star] no sites', e?.message ?? e); }
    nights.set(n, list);
    for (const k of [...nights.keys()]) if (k < n - 2) nights.delete(k);
    return list;
  }
  /** The night's stars and the night before's (its last star stands into this hour), each with its key. */
  function nightSites(t) {
    const n = starNightAt(t);
    return [...sitesOf(n - 1), ...sitesOf(n)];
  }

  // ── a star's place in the scene ──
  function placeOf(S) {
    const t = pixelTranslation(S.site.px, S.site.py, T3);
    const x = t[0] + S.site.spot[0], z = t[2] + S.site.spot[1];
    let y = groundAt(x, z);
    S.known = Number.isFinite(y);
    if (!S.known) {
      // AUDIT STARFALL R9: read once and kept over the pixel's own frame (its height under the pixel's is the same
      // wherever the origin stands), read again only now and then
      if (frameN - S.coarseAt >= STAR_COARSE_EVERY) {
        S.coarseAt = frameN;
        const c = coarseGround ? coarseGround(S.site.px, S.site.py, x, z) : NaN;
        S.coarseDy = Number.isFinite(c) ? c - t[1] : NaN;
      }
      y = t[1] + S.coarseDy;
    }
    S.heart[0] = x; S.heart[1] = Number.isFinite(y) ? y : t[1]; S.heart[2] = z;
  }
  const heightAt = (S) => (lx, lz) => { const y = groundAt(S.heart[0] + lx, S.heart[2] + lz); return Number.isFinite(y) ? y - S.heart[1] : 0; };
  /** The ground about the heart read again every so often - a pixel built finer moves it - and the model made again. */
  function ground(S) {
    if (!S.known) return;
    let changed = false;
    if (!sameAt(S.sampledHeart, S.heart) || frameN - S.sampledAt >= STAR_GROUND_EVERY) {
      S.sampledAt = frameN; S.sampledHeart = [...S.heart];
      const h = heightAt(S);
      for (let i = 0; i < S.sig.length; i++) {
        const a = (i / S.sig.length) * 2 * Math.PI, r = i % 2 ? 3 : 8;
        const v = h(Math.sin(a) * r, Math.cos(a) * r);
        if (!(Math.abs(v - S.sig[i]) <= STAR_GROUND_TOL)) { changed = true; S.sig[i] = v; }
      }
    }
    if (changed) S.groundGen++;
  }
  /** AUDIT STARFALL R1: THE CRATER STANDS WHERE ITS HEART IS - its matrix made again whenever the heart moves (a floating
   *  origin's recentre moves every heart and none of the ground's relative heights), for every star whose crater stands,
   *  the band between its build and its letting go too; and its stone's collider stood again at every matrix that moved
   *  (scenes/gate/gatePool.js standCollider's law), not only when the ground under it was built finer. */
  function place(S) {
    if (!sameAt(S.madeAt, S.heart)) { S.madeAt = [...S.heart]; S.mat = trs(S.heart[0], S.heart[1], S.heart[2], 0, 0, 0); }
    const col = collider?.(), late = lateSolidsOf(col);
    if (!col?.addMesh || !late || !S.stone || !S.mat) return;
    if (S.colliderGen === S.stoneGen && sameMatrix(S.colliderAt, S.mat)) return;
    // STAR-TUNE (the owner: "The dirt mound where the star is crashed can be walked through"): THE CRATER IS SOLID - its
    // floor, its rim of thrown earth and the stones on it with the stone (`S.stone`, ensureMesh); and a LATE solid
    // (player/lateSolid.js, ROCK-CLEAR's gate): a crater built round a body standing on its rim is withheld until the
    // body is clear of it, never closed on it. Moved (a floating origin's recentre), it is put back where it is held
    // AUDIT STAR-TUNE F4: a recentre (the same solid, moved with the body) is put back where it is held; a crater BUILT
    // AGAIN (the ground under it built finer - `ground` - as a player walks up to it) is a new solid, asked of the body
    // as the first was: replaced, it stood round a body already on its rim
    const key = starBucket(S.key);
    if (S.colliderAt && S.colliderGen === S.stoneGen) late.replace(key, S.stone.positions, S.stone.indices, S.mat);
    else { if (S.colliderAt) late.remove(key); late.add(key, S.stone.positions, S.stone.indices, S.mat); }
    S.colliderAt = S.mat; S.colliderGen = S.stoneGen;
  }
  /** AUDIT STARFALL (the relay's grace, WP1): WHETHER THE STAR IS STILL UNDECIDED - fallen, or past its deadline inside
   *  the grace in which a word said as the deadline came, still in flight, is heard (net/starfall/starfallLaw.js
   *  starLostAt: a master's fall in it holds the star). This screen's last word is at the deadline (its defense ends with
   *  `fallen`); its looks keep the grace - the star went dark at its deadline, and a hold landing in the grace turned it
   *  gold a moment on. */
  const undecided = (S, t) => S.phase === 'fallen' || (S.phase === 'after' && t < starLostAt(S.site.n, S.site.k));
  /** The record the stone wears now, and whether its thread still stands. */
  const looks = (S) => {
    const L = ledgers.get(S.key), h = held.has(S.key) || L?.p === P_HELD, lost = !h && (L?.p === P_LOST || !undecided(S, now()));
    return { glass: h ? STAR_GOLD_RECORD : lost ? STAR_DARK_RECORD : STAR_GLASS_RECORD, thread: !h, held: h, lost };
  };
  function ensureMesh(S) {
    if (!renderer?.createMesh || !S.known) return;
    const L = looks(S), want = `${S.groundGen}:${L.glass}:${L.thread ? 1 : 0}`;
    if (S.meshKey === want) return;
    try {
      if (!artUp) {
        for (const [rec, art] of starArt()) { renderer.uploadTexture?.(STAR_ARCHIVE, rec, art.albedo); renderer.uploadEmissionTexture?.(STAR_ARCHIVE, rec, art.emission, { white: true }); }
        artUp = true;
      }
      const h = heightAt(S);
      // AUDIT STARFALL R4: the floor and its rim a mesh of their own (drawn pulled toward the eye - `draw`), the stone and
      // its thread the other; the floor and the collider's stone made again only when the ground moved
      const next = renderer.createMesh(buildStarModel(S.site.n, S.site.k, h, { ground: false, glass: L.glass, thread: L.thread }));
      if (S.mesh) renderer.destroyMesh?.(S.mesh);
      S.mesh = next; S.meshKey = want;
      if (S.stoneGen !== S.groundGen || !S.floor) {
        const floor = renderer.createMesh(buildStarModel(S.site.n, S.site.k, h, { stone: false, thread: false }));
        if (S.floor) renderer.destroyMesh?.(S.floor);
        S.floor = floor;
        S.stone = buildStarModel(S.site.n, S.site.k, h, { thread: false });   // STAR-TUNE: what the collider holds - the stone AND the crater (`place`)
        S.stoneGen = S.groundGen;
      }
    } catch (e) { console.warn('[star] the crater would not build', e?.message ?? e); S.meshKey = want; }
  }
  function dropMesh(S) {
    if (S.mesh) { renderer?.destroyMesh?.(S.mesh); S.mesh = null; S.meshKey = ''; }
    if (S.floor) { renderer?.destroyMesh?.(S.floor); S.floor = null; }
    S.stone = null; S.stoneGen = -1;
    if (S.colliderAt) { lateSolidsOf(collider?.())?.remove(starBucket(S.key)); S.colliderAt = null; S.colliderGen = -1; }   // STAR-TUNE: held back or standing, the gate's
    if (S.bared) { S.bared = false; bareSaid(S); }
  }
  const bareSaid = (S) => onBare(S.heart[0] - STAR_BARE_R, S.heart[2] - STAR_BARE_R, S.heart[0] + STAR_BARE_R, S.heart[2] + STAR_BARE_R);

  // ── a star on this screen ──
  function enter(site) {
    const key = starHeldKey(site.n, site.k, site.px, site.py);
    const S = {
      key, site, heart: [0, 0, 0], known: false, phase: 'none', heartStar: heartStar(site.n, site.k),
      sites: { base: starSiteId(site.px, site.py, site.n, site.k), m: starSiteId(site.px, site.py, site.n, site.k, 'm'), c: starSiteId(site.px, site.py, site.n, site.k, 'c') },
      cell: worldRoom(site.px, site.py), madeAt: null, mat: null, sampledAt: -Infinity, sampledHeart: null, sig: new Float64Array(12).fill(NaN), groundGen: 0,
      coarseAt: -Infinity, coarseDy: NaN, mesh: null, meshKey: '', floor: null, stone: null, stoneGen: -1, colliderAt: null, colliderGen: -1, bared: false,
      said: new Set(), impactAt: NaN, humAt: -Infinity, ringGround: null,
      // the defense, this screen's own
      own: false, camp: null, stoodWave: 0, pending: 0, standAt: -Infinity, waveFoes: new Set(), counted: new Set(), kn: 0, wc: 0,
      mine: new WeakSet(), handed: new Set(), awayAt: NaN,
      master: null, masterStood: false, calls: 0, mf: false, struck: false, hb: 0, hbWho: '', wordAt: -Infinity, saidKey: '', resayAt: Infinity,
      ward: null, fellAt: NaN, circle: 0, circleSeen: 0, broken: 0, masterFoe: null,
    };
    blowsOf(S);
    S.ward = makeWard(S);
    stars.set(key, S);
    return S;
  }
  function leave(S) {
    dropDefense(S);
    dropMesh(S);
    stars.delete(S.key);
  }
  /** My own foes of the star taken down and its sites said to be nobody's - the star's over, or I walked off. */
  function dropDefense(S) {
    if (S.own || S.pending || S.waveFoes.size || S.master) for (const s of Object.values(S.sites)) { foes?.dropSiteFoes?.(s); camp.unsprang?.(s); }
    S.own = false; S.stoodWave = 0; S.waveFoes.clear(); S.handed.clear(); S.master = null; S.masterStood = false; S.calls = 0; S.awayAt = NaN;
  }

  /** AUDIT STARFALL C6: this account's character's count of the blows on star `S` - read again from the store when who
   *  stands here changed. */
  function blowsOf(S) {
    const id = who();
    if (S.hbWho !== id) { S.hbWho = id; S.hb = blows.get(id, S.key); }
    return S.hb;
  }
  /** AUDIT STARFALL C6: the cell's word of what this account was credited at a star (`hm`, the speaker's own copy of
   *  the ledger) - the count never under it, never lowered by it. */
  function creditedSaid(key, n, hm) {
    if (!Number.isSafeInteger(hm) || hm < 0 || hm > STAR_BLOWS_WIRE_MAX) return;
    const S = stars.get(key), id = who();
    const had = S ? blowsOf(S) : blows.get(id, key);
    if (hm <= had) return;
    if (S) S.hb = hm;
    blows.set(id, key, hm, n);
  }

  /** THE STAR AS A BODY in the owner's machine (the townsperson's shape, systems/livingWorld/quarry.js): quarry for its own
   *  coven's monsters alone (huntsStar), each landed blow one of its light - counted, kept, said in the word. */
  function makeWard(S) {
    const ward = {
      starWard: true, site: S.sites.base, living: true,
      ai: { feet: [0, 0, 0], height: STAR_STONE_H, centreOffset: STAR_STONE_H / 2, target: null, isHostile: false, wouldBeSpawned: true, yaw: 0 },
      entity: { team: 'Civilian', mobileTeam: 'Civilian', health: 1000, maxHealth: 1000 },
      hurtFromFoe() {
        S.hb = blowsOf(S) + 1;
        blows.set(S.hbWho, S.key, S.hb, S.site.n);
        playStarSound(audio, 'blow', S.heart);
        return 1;
      },
    };
    return ward;
  }

  // ── the defense ──
  const ownSite = (f, S) => !!f && (f.site === S.sites.base || f.site === S.sites.m || f.site === S.sites.c);
  /** AUDIT STARFALL C7: my live foes of the star, and those on their way. */
  const liveOf = (S) => S.pending + (foes?.foes ?? NONE).filter((f) => !f.puppet && !f.dead && ownSite(f, S)).length;
  /** A foe made the star's - its hunters' star (huntsStar), the camp's one number, this screen's to count. */
  function mark(S, f) {
    S.mine.add(f);
    const c = S.camp ?? (S.camp = foes?.newCampId?.() ?? null);
    f.starSite = S.sites.base;
    f.campId = c;
    if (f.entity) f.entity.campId = c;
  }
  /** THE MASTER'S MARKS, stood or taken over: its name, its circle's ward on it (`f.circleWard`, exteriorFoes.js
   *  damageFoe), and the world boss's mark on its body (`entity.worldBoss` - the port's word for one: its fall is the
   *  star's own deed, which the festival's finds pay once as a held star, never again as a body - systems/festival/,
   *  systems/foeLootCap.js titledFoe, systems/card/cardSources.js). The master alone: never a witch of its coven. */
  function masterOf(S, f, M) {
    S.master = f; S.masterStood = true;
    if (f.entity) { f.entity.name = M.name(); f.entity.properName = M.name(); f.entity.worldBoss = true; }
    f.circleWard = () => (S.circle | 0) > 0;
  }
  /** STAR-TUNE: WHERE A FOE STANDS at (x, z) - on whatever is highest there: the land, or the crater's floor and rim now
   *  that they are solid (`place`), read from over the rim's crest (a ray from just over the land starts under the rim and
   *  finds the land beneath it). `{ y, hitDist }` as spawnFoe's groundAlign reads them - the drop from 0.2 over `y` - or
   *  null where no ground answers. */
  function standOn(x, z) {
    const y = groundAt(x, z);
    if (!Number.isFinite(y)) return null;
    const top = y + STAR_RIM_H + 1;
    const d = hitDistance(collider?.()?.surfaceHit?.([x, top, z], DOWN, top - y + 3));
    if (d != null) return { y: top - d, hitDist: 0.2 };
    return { y, hitDist: hitDistance(collider?.()?.surfaceHit?.([x, y + 0.2, z], DOWN, 3)) };
  }
  /** STAR-TUNE: A FOE OF THE COVEN'S RITE - its health STAR_FOE_HEALTH times (the rite's Summoner's own law,
   *  scenes/riteHost.js), stood once, as it lands; and on its kind's health too (TELL1: what ai/tells.js kindHealth
   *  divides out, so it staggers as its kind does). A foe handed to me keeps what its owner stood. */
  function toughen(f) {
    const e = f.entity;
    if (!e) return;
    e.maxHealth = Math.max(1, Math.round((e.maxHealth ?? 1) * STAR_FOE_HEALTH)); e.health = e.maxHealth;
    e.healthMult = (e.healthMult ?? 1) * STAR_FOE_HEALTH;
  }
  /** Stand `careers` at `places` ([dx, dz, yaw] from the heart, or from `about`) under `site`: placed, in no save, never an
   *  elite of its own (the master alone is). Each foe landed is made the star's (`made`). AUDIT STARFALL C7: never past
   *  STAR_LIVE_MAX of the star's foes at once - what a reader stands of them. */
  function stand(S, careers, places, site, made, { elite = false, about = null } = {}) {
    if (!foes?.spawnFoe) return;
    S.standAt = now();
    careers.slice(0, Math.max(0, STAR_LIVE_MAX - liveOf(S))).forEach((career, i) => {
      const [dx, dz, yaw] = places[i % places.length];
      const x = (about ?? S.heart)[0] + dx, z = (about ?? S.heart)[2] + dz;
      const at = standOn(x, z);
      if (!at) return;
      S.pending++;
      const landed = (f) => {
        S.pending--;
        if (!f) return;
        if (stars.get(S.key) !== S || !S.own) { foes.removeFoe?.(f); return; }   // the star went, or the foes were given up, while they stood
        if (site !== S.sites.m) toughen(f);   // STAR-TUNE: a wave's and the circle's - the master is an elite's own
        mark(S, f);
        made(f);
      };
      Promise.resolve(foes.spawnFoe(career, [x, at.y, z], { yaw: yaw ?? 0, gender: covenFemale(career) ? 'female' : null, placed: true, groundAlign: { hitDist: at.hitDist }, site, transient: true, eliteFoe: elite, grantKind: session()?.starGrantOk ? 'star' : undefined }))   // STAR-TUNE: a grant of the star's own kind - a wave of any size its law gives, one ask; AUDIT STAR-TUNE F1: of a relay that mints it (an older one's own kind, its waves nine at most)
        .then(landed, () => landed(null));
    });
  }
  /**
   * AUDIT STARFALL C1: THE FOES HANDED TO ME ARE THE STAR'S. An owner who reloads, closes its page, goes through a door or
   * dies hands its live foes to a defender beside them (scenes/world.js handOverSiteFoes, handOverFoes), and they come
   * here my own with their site and nothing else of the star's (scenes/exteriorFoes.js adopt) - nothing hunted the star,
   * the master stood unwarded, and this screen stood a whole wave or a second master over them. Each live one is made the
   * star's again: its hunters' star, the camp, its wave (the wave standing, or the next this screen stands); the master
   * its marks and its calls as its health has passed them. The owner then stands only what is missing - the rite's law
   * (scenes/riteHost.js `if (C.ownLive) return;`).
   */
  function claim(S, L) {
    const M = starMasterOf(L?.b ?? 1, S.site.k);
    for (const f of foes?.foes ?? NONE) {
      if (f.puppet || f.dead || S.mine.has(f) || !ownSite(f, S)) continue;
      mark(S, f);
      if (f.site === S.sites.m) {
        if (S.master && !S.master.dead && S.master !== f) { f.circleWard = S.master.circleWard; if (f.entity) f.entity.worldBoss = true; continue; }   // a second, stood in a race: warded alike
        masterOf(S, f, M);
        const e = f.entity, share = e && e.maxHealth > 0 ? e.health / e.maxHealth : 1;
        S.calls = Math.max(S.calls, STAR_CIRCLE_AT.filter((at) => share <= at).length);   // its calls made by the owner before me
      } else if (f.site === S.sites.base) {
        if (L?.p === P_WAVE && S.stoodWave === L.w) S.waveFoes.add(f); else S.handed.add(f);
      }
    }
  }
  /** Every screen's foes of the star named (its witches by their coven, the master by its own name) and counted; mine
   *  read - who struck, what fell - and my hunters turned once a defender's blow lands. */
  function tend(S) {
    let master = null, circle = 0;
    const member = S.site.coven.member(), M = starMasterOf(ledgers.get(S.key)?.b ?? 1, S.site.k);
    for (const f of foes?.foes ?? NONE) {
      if (!ownSite(f, S)) continue;
      const e = f.entity, career = f.mobileType;
      if (e) {
        const name = f.site === S.sites.m ? M.name() : STAR_MEMBERS.includes(career) ? member : null;
        if (name && e.name !== name) { e.name = name; e.properName = name; }
        if (f.site === S.sites.m && e.worldBoss !== true) e.worldBoss = true;   // the owner's or its copy: the star's master, on every screen
      }
      if (!S.struck && renownStruckAt(f) != null) S.struck = true;
      if (f.site === S.sites.m) master = f;
      if (f.dead) {
        if (!f.corpse) continue;   // gone without a body: walked off, no fall
        const k = f.puppet ? `${f.puppet}:${f.seq}` : f;
        if (S.counted.has(k)) continue;
        S.counted.add(k);
        if (!f.puppet && S.waveFoes.has(f)) S.kn++;
        if (f.site === S.sites.m && !f.puppet) S.mf = true;
        continue;
      }
      if (f.site === S.sites.c) circle++;
      if (!f.puppet && f.starSite && !f.starTurned && e && e.health < e.maxHealth) f.starTurned = true;   // a defender's blow turns it
    }
    // THE CIRCLE, SAID ON EVERY SCREEN: its calls by the master's health (the owner's, or its copy's), its breaking when the
    // last of a call falls
    const me = master?.entity;
    if (me && !master.dead && me.maxHealth > 0) STAR_CIRCLE_AT.forEach((at, i) => { if (me.health / me.maxHealth <= at) sayAt(S, `circle${i}`, M.circle()); });
    if (circle > 0) S.circleSeen = circle;
    else if (S.circleSeen > 0) { S.circleSeen = 0; S.broken++; sayAt(S, `broken${S.broken}`, STAR_AT_TEXT.circleBroken(M.female)); playStarSound(audio, 'circle', S.heart); }
    S.circle = circle;
    S.masterFoe = master;
    if (master?.dead && !Number.isFinite(S.fellAt)) S.fellAt = now();
  }
  /** Whether I hold the star's foes: I sprang them and no peer holds them - a peer silent STAR_ORPHAN_MS holds nothing. */
  function holds(S) {
    if (camp.peerSprang?.(S.sites.base)) {
      if (!(camp.peerHeldAgo?.(S.sites.base) >= STAR_ORPHAN_MS)) return false;
      camp.forgetPeer?.(S.sites.base);
    }
    return true;
  }
  /** THE OWNER'S STAND, as the ledger says: each wave its size (the rest of it, taken over mid-wave), the master, and its
   *  circle at each of its calls - each less what was handed to me of it (claim). */
  function owner(S, L) {
    if (!S.own) {
      S.own = true;
      for (const s of Object.values(S.sites)) { foes?.reclaimSite?.(s); camp.sprang?.(s); }
    }
    if (!S.pending) claim(S, L);
    if (!L || S.pending) return;
    // a wave none of whose foes stood (no ground under its places, a full pool) is stood again a moment on
    if (L.p === P_WAVE && S.stoodWave === L.w && !S.waveFoes.size && now() - S.standAt >= STAR_RESTAND_MS) S.stoodWave = 0;
    if (L.p === P_WAVE && S.stoodWave !== L.w) {
      S.stoodWave = L.w; S.kn = L.kn; S.wc = 0; S.waveFoes.clear();
      for (const f of S.handed) if (!f.dead) S.waveFoes.add(f);   // AUDIT STARFALL C1: handed to me in it - the wave's own
      S.handed.clear();
      const careers = starWaveFoes(S.site.n, S.site.k, L.w, Math.max(0, L.wz - L.kn - S.waveFoes.size), L.b);
      stand(S, careers, starStandPlaces(S.site.n, S.site.k, L.w, careers.length), S.sites.base, (f) => S.waveFoes.add(f));
      return;
    }
    if (L.p === P_WAVE && S.stoodWave === L.w && !S.pending && S.waveFoes.size && [...S.waveFoes].every((f) => f.dead)) S.wc = L.w;
    // AUDIT STARFALL C4: a master that never stood (no ground under its place, a full pool) is stood again a moment on, as
    // a wave is - none standing and none on its way
    if (L.p === P_MASTER && S.masterStood && !S.master && now() - S.standAt >= STAR_RESTAND_MS) S.masterStood = false;
    if (L.p === P_MASTER && !S.masterStood) {
      S.masterStood = true;
      const M = starMasterOf(L.b, S.site.k);
      stand(S, [M.career], starStandPlaces(S.site.n, S.site.k, 9, 1), S.sites.m, (f) => masterOf(S, f, M), { elite: true });
      return;
    }
    // THE CIRCLE: at two-thirds and a third of the master's health, its call - the fourth wave's roster about it
    const m = S.master, e = m?.entity;
    if (m && !m.dead && e && S.calls < STAR_CIRCLE_AT.length && e.health / e.maxHealth <= STAR_CIRCLE_AT[S.calls]) {
      const call = S.calls++;
      const size = starCircleSize(L.nd, S.heartStar);
      stand(S, starCircleFoes(S.site.n, S.site.k, call, size, L.b), starCirclePlaces(size).map(([dx, dz]) => [dx, dz, 0]), S.sites.c, () => {}, { about: m.ai?.feet ?? S.heart });
    }
  }
  /** THE WORD to the star's cell - every STAR_WORD_MS while I stand at it, at once when it changes and once more a moment
   *  after (the relay's bucket may drop it). */
  function word(S, t) {
    const s = session();
    if (!s?.starReady?.(S.cell)) return;
    const w = starWordOf(S.site, { struck: S.struck, own: S.own, kw: S.stoodWave, kn: S.kn, wc: S.wc, hb: S.hb, mf: S.mf }, playerEntity.level ?? 1);   // kw: the wave S.kn counts
    const key = starWordKey(w), changed = key !== S.saidKey;
    if (!changed && t - S.wordAt < STAR_WORD_MS && t < S.resayAt) return;
    if (!s.sendStar(w, S.cell)) return;
    S.resayAt = changed ? t + STAR_RESAY_MS : Infinity;
    S.wordAt = t; S.saidKey = key;
  }
  /** AUDIT STARFALL C2: ONE LEASH, THE RELAY'S. The relay believes a word from STAR_REACH_M and forgets an owner silent
   *  STAR_ORPHAN_MS; this screen sprang the coven from 80 m, stood its waves to 80 m and kept the camp to 400 m, but said
   *  its word from STAR_SAY_M alone - an owner standing off 80 to 400 m kept a camp no word moved and no peer could take
   *  (the star was lost at dawn), and one between 55 and 80 m stood waves the relay never heard. The coven is sprung,
   *  stood and held from where the word is said; an owner outside it STAR_ORPHAN_MS gives it up to whoever stands there. */
  function leashSlipped(S, t, inside) {
    if (inside) { S.awayAt = NaN; return false; }
    if (!Number.isFinite(S.awayAt)) S.awayAt = t;
    return t - S.awayAt >= STAR_ORPHAN_MS;
  }
  function defend(S, t, d) {
    const L = ledgers.get(S.key) ?? null;
    if (foes && d <= STAR_HUD_M) tend(S);
    const over = held.has(S.key) || L?.p === P_HELD || L?.p === P_LOST || S.phase !== 'fallen';
    if (over) { if (S.own) dropDefense(S); return; }
    const s = session();
    const online = !!s?.starReady?.(S.cell), inside = d <= STAR_SAY_M;
    if (online && foes && S.known && inside && holds(S)) { S.awayAt = NaN; owner(S, L); }
    else if (S.own && (camp.peerSprang?.(S.sites.base) || leashSlipped(S, t, inside))) dropDefense(S);   // a peer won the race, or I walked off
    if (online && inside) { blowsOf(S); word(S, t); }   // to the deadline (`over`): the grace is a word's flight alone
  }

  // ── the words ──
  /** Said once a star: to the coven's region (`region`), at the star (`at`), or to everyone. */
  function sayOnce(S, id, text, how = 'chat') {
    if (!text || S.said.has(id)) return;
    S.said.add(id);
    if (how === 'mid') setMidScreenText(text, 4); else say(text);
  }
  function sayAt(S, id, text) {
    const f = feet();
    if (f && dist2(S.heart, f[0], f[2]) <= STAR_HUD_M) sayOnce(S, id, text, 'mid');
  }
  const inRegion = (S) => regionAt() === S.site.region;
  /** The ledger's moves, said at the star as they come (each once). AUDIT STARFALL R8: a first ledger is taken in
   *  silently - a page that comes to a star mid-fight hears what moves from then on, never a wave, a loss or a hold that
   *  happened before it came as though it happened now. */
  function ledgerSaid(S, L, was) {
    if (!L || !was) return;
    const M = starMasterOf(L.b, S.site.k);
    if (L.p === P_WAVE && (!was || was.w !== L.w)) sayAt(S, `wave${L.w}`, STAR_AT_TEXT.wave(L.w));
    if (L.p === P_BREATH && was?.p === P_WAVE) sayAt(S, `breath${L.w}`, STAR_AT_TEXT.breath());
    if (L.lt <= STAR_LOW_LIGHT && !(was?.lt <= STAR_LOW_LIGHT) && L.p !== P_LOST) sayAt(S, 'low', STAR_AT_TEXT.low());
    if (L.p === P_MASTER && was?.p !== P_MASTER) { sayAt(S, 'master', M.call()); playStarSound(audio, 'master', S.heart); }
    if (L.p === P_HELD && was?.p !== P_HELD) { sayAt(S, 'held', S.heartStar ? STAR_AT_TEXT.heldHeart() : STAR_AT_TEXT.held()); playStarSound(audio, 'held', S.heart); }
    if (L.p === P_LOST && was?.p !== P_LOST) { sayAt(S, 'lost', L.why === STAR_LOST_DARK ? STAR_AT_TEXT.lost() : STAR_AT_TEXT.dawn()); playStarSound(audio, 'dark', S.heart); }
    if (was && L.lt < was.lt && !S.own) playStarSound(audio, 'blow', S.heart, 0.6);   // a blow on the star, heard where its foes are a peer's
  }

  // ── the clock's moments ──
  function moments(S, t, f) {
    const T = starTimes(S.site.n, S.site.k);
    const d = f ? dist2(S.heart, f[0], f[2]) : Infinity;
    if (S.phase === 'omen' && inRegion(S)) {
      sayOnce(S, 'omen', S.heartStar ? STAR_REGION_TEXT.omenHeart(S.site.near, covenWitches(S.site.coven)) : STAR_REGION_TEXT.omen(S.site.near, covenWitches(S.site.coven)));
      if (!S.said.has('omenSound')) { S.said.add('omenSound'); playStarSound(audio, 'omen'); }
    }
    if (S.phase === 'streak' && inRegion(S) && !S.said.has('fallSound')) { S.said.add('fallSound'); playStarSound(audio, 'fall', null, 0.5 + 0.5 * Math.max(0, 1 - d / 8000)); }
    if ((S.phase === 'fallen' || S.phase === 'after') && !Number.isFinite(S.impactAt)) {
      S.impactAt = T.fallAt;
      if (t - T.fallAt < 4000) {   // the landing seen as it happens (a page opened later finds it standing)
        if (inRegion(S)) sayOnce(S, 'fell', STAR_REGION_TEXT.fell(S.site.near));
        // AUDIT STARFALL R7: the stone's strike heard its distance late, as the thunder is - never with the flash
        if (d <= 2000) thunders.push({ due: T.fallAt + starHeardAfterMs(d), key: S.key, clip: null, volume: 1 });
        const th = thunderOf(d);
        if (th) thunders.push({ due: T.fallAt + th.delay * 1000, key: S.key, clip: th.clip, volume: th.volume });
        if (d <= STAR_SHAKE_M) shake(4 * (1 - d / STAR_SHAKE_M));
      }
    }
    if (S.phase === 'fallen' && d <= 40 && t - S.humAt >= STAR_HUM_MS) { S.humAt = t; playStarSound(audio, 'hum', S.heart); }
  }

  // ── what is drawn in the sky ──
  function skyOf(S, t, eye) {
    const T = starTimes(S.site.n, S.site.k), L = looks(S);
    if (S.phase === 'omen') {
      const o = omenAt(S.heart, (t - T.omenAt) / (T.streakAt - T.omenAt)), c = skyClamp(eye, o.at);
      sky.glows.push({ at: c.at, w: o.w * c.s, color: STAR_FALL_COLOR, light: 0.9 });
    } else if (S.phase === 'streak') {
      const k = (t - T.streakAt) / (T.fallAt - T.streakAt), st = streakAt(S.heart, starStreakBearing(S.site.n, S.site.k), k), c = skyClamp(eye, st.head);
      sky.trails.push({ head: c.at, dir: st.dir, len: STAR_TRAIL_M * c.s, w: STAR_HEAD_W * 0.5 * c.s, color: STAR_FALL_COLOR, light: 1 });
      sky.glows.push({ at: c.at, w: STAR_HEAD_W * c.s, color: STAR_FALL_COLOR, light: 1.2 });
    }
    if (S.phase === 'fallen' || S.phase === 'after') {
      const since = t - T.fallAt;
      if (since < STAR_FLASH_MS) {
        const c = skyClamp(eye, [S.heart[0], S.heart[1] + 6, S.heart[2]]);
        sky.glows.push({ at: c.at, w: STAR_FLASH_W * c.s * (1 - since / STAR_FLASH_MS * 0.5), color: STAR_FALL_COLOR, light: 2 * (1 - since / STAR_FLASH_MS) });
      }
      const ring = shockRingAt(since);
      if (ring.fade > 0 && S.known) sky.rings.push({ at: S.heart, r: ring.r, fade: ring.fade, color: STAR_FALL_COLOR, ground: ringGround(S, ring.r) });
      // the beacon dims with the star's light as the cell says it - a star failing is seen from across the region
      const lt = ledgers.get(S.key)?.lt, dim = Number.isFinite(lt) ? STAR_BEACON_DIM + (1 - STAR_BEACON_DIM) * Math.max(0, Math.min(1, lt / STAR_LIGHT)) : 1;
      const fade = L.held ? Math.max(0, 1 - (t - (held.get(S.key)?.at ?? ledgers.get(S.key)?.hd ?? t)) / STAR_HELD_FADE_MS) : L.lost ? 0 : Math.min(1, since / 3000) * dim;
      // AUDIT STARFALL R2: the beacon is a sky thing as the omen is - scaled about the eye to STAR_SKY_R (its foot, its
      // height and its width with it), so the far plane never cuts a star's column seen from across the region
      if (fade > 0) { const c = skyClamp(eye, [S.heart[0], S.heart[1] + STAR_STONE_H, S.heart[2]]); sky.beacons.push({ origin: c.at, scale: c.s, fade, held: L.held }); }
    }
  }
  /** AUDIT STARFALL R3: THE RING OF SHOCK RIDES THE LAND - the ground over the heart's at its inner and outer edge
   *  (STAR_RING_WIDTH_M either side of `r`) at each of STAR_RING_SEGS bearings, the crater's rim on it, in the pass's order
   *  (render/starfall/starfallPass.js STAR_RING_VS): its 1.8 s alone, one array a star, kept. */
  function ringGround(S, r) {
    const g = S.ringGround ?? (S.ringGround = new Float32Array(STAR_RING_SEGS * 2));
    for (let i = 0; i < STAR_RING_SEGS; i++) {
      const a = (i / STAR_RING_SEGS) * 2 * Math.PI, sa = Math.sin(a), ca = Math.cos(a);
      for (let j = 0; j < 2; j++) {
        const rr = j ? r + STAR_RING_WIDTH_M : Math.max(0, r - STAR_RING_WIDTH_M);
        const y = groundAt(S.heart[0] + sa * rr, S.heart[2] + ca * rr);
        g[i * 2 + j] = (Number.isFinite(y) ? y - S.heart[1] : 0) + rimAt(rr);
      }
    }
    return g;
  }

  return {
    /** THE FRAME: the night's stars entered, stepped and let go; each one's moments said, its crater built, its defense
     *  run; the tracker and the master's bar drawn. Answers the star this player stands nearest, or null. */
    frame() {
      try { rewards.tick(); } catch (e) { console.warn('[star] claims', e?.message ?? e); }   // STAR7: what is kept, offered in its time - festival or not
      try { return this.step(); } catch (e) { console.warn('[star] host', e?.message ?? e); return null; }
    },
    /** The frame's work (frame's, inside its catch). */
    step() {
      frameN++;
      const t = now();
      if (!starfallStands(t)) { this.destroyAll(); return null; }
      const f = feet();
      const seen = new Set();
      for (const site of nightSites(t)) {
        const phase = starClockPhase(site.n, site.k, t);
        const key = starHeldKey(site.n, site.k, site.px, site.py);
        if (phase === 'none' || phase === 'gone') continue;
        seen.add(key);
        const S = stars.get(key) ?? enter(site);
        S.phase = phase;
        placeOf(S);
        S.ward.ai.feet[0] = S.heart[0]; S.ward.ai.feet[1] = S.heart[1]; S.ward.ai.feet[2] = S.heart[2];
        moments(S, t, f);
        const d = f ? dist2(S.heart, f[0], f[2]) : Infinity;
        if ((phase === 'fallen' || phase === 'after') && d <= STAR_BUILD_M && S.known) {
          ground(S);
          if (!S.bared) { S.bared = true; bareSaid(S); }
          ensureMesh(S);
        } else if (S.mesh && d > STAR_BUILD_M * 1.2) dropMesh(S);
        if (S.mesh) place(S);
        if (phase === 'fallen' || S.own) defend(S, t, d);
      }
      for (const S of [...stars.values()]) if (!seen.has(S.key)) leave(S);
      // the landing's cues as each reaches this player - AUDIT STARFALL R7: from where its star's heart stands NOW (a
      // floating origin's recentre between the landing and its thunder moves it), in the order they come due
      for (let i = 0; i < thunders.length;) {
        const th = thunders[i];
        if (th.due > t) { i++; continue; }
        thunders.splice(i, 1);
        const at = stars.get(th.key)?.heart;
        if (t - th.due >= 1000 || !f || !at) continue;
        if (!th.clip) { playStarSound(audio, 'impact', at); continue; }
        try { audio.play3d?.(th.clip, thunderSourceAt(f, at[0], at[2]), th.volume, { refDistance: THUNDER_SOURCE_M, maxDistance: THUNDER_SOURCE_M * 8, far: true }); } catch { /* no audio */ }
      }
      if (stars.size) warmPass();
      // the tracker and the bar: the star this player stands nearest, within STAR_HUD_M
      const near = this.nearest();
      const hidden = hudHidden();
      if (near) {
        const L = ledgers.get(near.key) ?? null, M = starMasterOf(L?.b ?? 1, near.site.k);
        drawStarTracker(starTrackerModel(near.site, L, t, M.name(), held.has(near.key)), { hidden }); trackerUp = true;
        const m = near.masterFoe;
        const bar = m && (!m.dead || t - near.fellAt < 4000) ? starBarModel({ name: M.name(), heart: near.heartStar, hp: m.entity?.health ?? 0, max: m.entity?.maxHealth ?? 1, circle: near.circle, her: M.female, defenders: L?.nd ?? 0, fellAt: m.dead ? near.fellAt : null }, t) : null;
        if (bar || barUp) { drawGateBossBar(bar, { hidden }); barUp = !!bar; }
      } else {
        if (trackerUp) { drawStarTracker(null); trackerUp = false; }
        if (barUp) { drawGateBossBar(null); barUp = false; }
      }
      return near;
    },
    /** The star this player stands nearest, within STAR_HUD_M and fallen or standing after, or null. */
    nearest() {
      const f = feet();
      if (!f) return null;
      let best = null, bd = STAR_HUD_M;
      for (const S of stars.values()) {
        if (!S.known || (S.phase !== 'fallen' && S.phase !== 'after')) continue;
        const d = dist2(S.heart, f[0], f[2]);
        if (d <= bd) { bd = d; best = S; }
      }
      return best;
    },
    /**
     * A STAR WORD (net/wire.js validStarOut): a cell's ledger (`st`), a hold (`hd`, the cell's or the hub's), the night's
     * held stars at a hello (`hds`), my receipt (`rc`).
     */
    onStar(w) {
      if (!w) return;
      if (w.k === 'rc') { rewards.receipt(w.r); return; }
      if (w.k === 'hds') { for (const [n, s, px, py, at] of w.l) if (!held.has(starHeldKey(n, s, px, py))) held.set(starHeldKey(n, s, px, py), { top: [], c: 0, at }); return; }
      const key = starHeldKey(w.n, w.s, w.px, w.py);
      if (w.k === 'hd') {
        const first = !held.get(key)?.c;
        held.set(key, { top: w.top, c: w.c, at: w.at });
        if (first) {
          const site = nightSites(now()).find((s) => starHeldKey(s.n, s.k, s.px, s.py) === key) ?? null;
          const S = stars.get(key);
          const line = starHeldLine(site, w.top, w.c);
          if (line && !(S?.said.has('heldRegion'))) { S?.said.add('heldRegion'); say(line); }
        }
        return;
      }
      const was = ledgers.get(key) ?? null;
      ledgers.set(key, w);
      creditedSaid(key, w.n, w.hm);   // AUDIT STARFALL C6: my own credited blows, on the copy said to me alone
      const S = stars.get(key);
      if (S) ledgerSaid(S, w, was);
    },
    /** The fallen stars this machine stands as bodies - its own coven's hunters' quarry (the senses' candidates). */
    wards() {
      const out = [];
      for (const S of stars.values()) if (S.own && S.phase === 'fallen' && S.known) out.push(S.ward);
      return out;
    },
    /** The craters and their stones, in the host's world pass. AUDIT STARFALL R4: the burned floor and its rim lie a hand
     *  over the land - drawn pulled toward the eye as the ground's own marks are (render/auraRing.js, its fire on the
     *  stone), so the land never shows through them at range; the stone and its thread as they are. */
    draw(r = renderer, texRemap = null) {
      if (!r?.drawMesh) return 0;
      let n = 0;
      for (const S of stars.values()) if (S.mesh && S.mat) { r.drawMesh(S.mesh, S.mat, texRemap); n++; }
      const gl = r.gl ?? null;
      let offset = false;
      try {
        for (const S of stars.values()) {
          if (!S.floor || !S.mat) continue;
          if (!offset && gl) { offset = true; gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(STAR_FLOOR_OFFSET[0], STAR_FLOOR_OFFSET[1]); }
          r.drawMesh(S.floor, S.mat, texRemap); n++;
        }
      } finally { if (offset) { gl.disable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(0, 0); } }
      return n;
    },
    /** The stone's glow, for a player near a standing star - one light, moved in place. */
    lights() {
      const near = this.nearest();
      const f = feet();
      if (!near || !f || dist2(near.heart, f[0], f[2]) > STAR_GLOW_REACH_M || looks(near).lost) return NONE;
      glow.x = near.heart[0]; glow.y = near.heart[1] + STAR_STONE_H * 0.6; glow.z = near.heart[2];
      return glowList;
    },
    /** The landing's flash, while it burns near (the frame's one flash light - renderer.setFlashLight), or null. */
    flash() {
      const t = now(), f = feet();
      for (const S of stars.values()) {
        const since = t - starTimes(S.site.n, S.site.k).fallAt;
        if (since >= 0 && since < STAR_FLASH_MS && f && dist2(S.heart, f[0], f[2]) <= STAR_FLASH_LIGHT_M * 4) {
          flashLight.x = S.heart[0]; flashLight.y = S.heart[1] + 20; flashLight.z = S.heart[2];
          flashLight.range = STAR_FLASH_LIGHT_M * (1 - since / STAR_FLASH_MS);
          return flashLight;
        }
      }
      return null;
    },
    /** Whether anything of the Starfall is in the sky - the host builds the pass's arguments only then. */
    showing: () => !!pass && stars.size > 0,
    /** The sky's pass, after the world's: the omens, the falls, the flashes, the rings, the beacons. */
    drawSky(proj, view, eye, seconds, fog = fogOf()) {
      if (!pass || !eye) return 0;
      return pass.draw(this.skyLists(eye), proj, view, eye, seconds, fog);
    },
    /** What the sky's pass is handed for an eye this frame - `{ beacons, glows, trails, rings }`, its lists filled in place
     *  (drawSky's, and the tests'). */
    skyLists(eye) {
      const t = now();
      sky.beacons.length = 0; sky.glows.length = 0; sky.trails.length = 0; sky.rings.length = 0;
      for (const S of stars.values()) skyOf(S, t, eye);
      return sky;
    },
    /** The map's cards for the night's stars (ui/eventMapMarks.js's shape). */
    mapMarks() { return starfallStands(now()) ? starMapMarks(nightSites(now()), now(), { held, led: ledgers, localTime }) : NONE; },
    /** The compass's mark: the nearest star of the night in this player's region, from its omen until it is gone - the
     *  scene's [x, z] - or null. */
    compassMark() {
      const f = feet();
      if (!f) return null;
      let best = null, bd = Infinity;
      for (const S of stars.values()) {
        if (!inRegion(S) || S.phase === 'none' || S.phase === 'gone') continue;
        const d = dist2(S.heart, f[0], f[2]);
        if (d < bd) { bd = d; best = S; }
      }
      return best ? [best.heart[0], best.heart[2]] : null;
    },
    /** The Timers window's rows: each star standing undecided to its deadline, and the next fall with its coven - the
     *  next night's first once this night's last is down. */
    timerRows() {
      const t = now();
      if (!starfallStands(t)) return NONE;
      const decided = (key) => held.has(key) || ledgers.get(key)?.p === P_HELD || ledgers.get(key)?.p === P_LOST;
      return starTimerRows([...nightSites(t), ...sitesOf(starNightAt(t) + 1)], t, decided);
    },
    /** The crater's burned earth the grass keeps off, for the nearest standing star - `{ x, z, r, key }` - or null. */
    clearing() {
      const S = this.nearest();
      return S ? { x: S.heart[0], z: S.heart[2], r: STAR_BARE_R, key: S.key } : null;
    },
    /** The sites a star's foes stand under (the Overworld's marks name them the coven's). */
    isStarSite,
    /** The host's state, for the tests and the probes. */
    state: () => [...stars.values()].map((S) => ({ key: S.key, phase: S.phase, known: S.known, own: S.own, stoodWave: S.stoodWave, master: !!S.master, calls: S.calls, kn: S.kn, wc: S.wc, hb: S.hb, mf: S.mf, struck: S.struck, mesh: !!S.mesh, floor: !!S.floor, heart: [...S.heart], said: [...S.said] })),
    /** Everything let go (a load, a mode change, the event's end). */
    destroyAll() {
      for (const S of [...stars.values()]) leave(S);
      if (trackerUp) { destroyStarTracker(); trackerUp = false; }
      if (barUp) { drawGateBossBar(null); barUp = false; }
      thunders.length = 0;
    },
    /** STAR7: the spoils' crash door at a character's stand-up, and the realm save's two hooks (scenes/starfall/starRewards.js). */
    recoverSpoils: (who, inSave = null) => rewards.recover(who, inSave),
    spoilsHeld: (who) => rewards.held(who),
    spoilsSaved: (who, ids) => rewards.saved(who, ids),
    /** STAR7: the rewards, for the tests and the probes. */
    rewards,
    /** Whether a star of the night is in the sky or standing - the host's cheap test before it asks for more. */
    active: () => stars.size > 0,
  };
}
