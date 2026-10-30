// @ts-check
// STOREFRONT (2026-10-29, the brief: "world changes with new dwemer enemies/boss/weapon"; bible/06-Systems/Battle-Pass.md
// section 6): THE SEASON IN THE WORLD - the pass bound and its notices said; the hourly tremor felt; each Brass Fissure near
// the player built, solid, breathing and humming, marked, its rock and grass kept off; its constructs on the camp law
// (wodShared.js brassSiteId), sprung by the first player near and seen by every other, as the rite's faithful; the Heart
// Fissure's Brass Colossus named on every screen by its site, its Resonant Maul to a striker once a day - the account
// service's day (server-account/src/seasonClaim.js, AUDIT LANE 5). The world host wires it on the bindings it shares with
// the Starfall (HOST-SPLIT). Online alone, on the relay's clock once heard. Not a DFU member. Ledger A (STOREFRONT).
import { bindPass } from '../systems/pass/passClient.js';
import { PASS_EVENT_TEXT, passChallengeText } from '../ui/passText.js';
import { seasonStageAt, tremorAt, stageFissures, theatreFissures, areaBox, fissureUnderGate, fissureRoster, COLOSSUS_MOBILE } from '../systems/pass/seasonWorld.js';
import { keptTheatreScans } from './gate/gateLanes.js';   // W14: a province's fissures over its theatre's ground, the gate's own scan
import { createEventTheatres } from './eventTheatres.js';   // W14: a theatre's scan warmed in the idle moments (WW5's)
import { findTheatreGateSite } from '../systems/gate/theatreGateSite.js';   // W14: a province's fissures give way to its own gate
import { keptPlaces } from '../net/staffPlaces.js';
import { tamrielLandVersion } from '../world/tamriel/tamrielLand.js';
import { arenaRoadsVersion, keptArenaRoadsHost } from '../world/arenaRoads.js';   // W14: the roads past the Bay, a region at a time
import { loadModRoads, MOD_ROADS } from '../world/roadsProducer.js';
import { TREMOR_TEXT, FISSURE_TEXT, COLOSSUS_TEXT } from '../systems/pass/seasonWords.js';
import { mintResonantMaul } from '../systems/pass/resonantMaul.js';
import { ITEM_UID_RE } from '../systems/item/itemLaw.js';   // AUDIT-STOREFRONT II (lane D 2): a held Maul's id is its claim's
import { carriedPieces } from '../systems/item/itemIds.js';
import { textRevision } from '../systems/textManager.js';   // AUDIT-STOREFRONT II (lane D 3): the map's cards made again in another language
import { hearRealmSaves } from './shared.js';   // AUDIT-STOREFRONT II (lane D 2): a realm checkpoint landed
import { onSlotSaved, onSlotLoaded } from '../systems/save/saveSlots.js';
import { askCheckpoint } from '../systems/online/onlineCheckpointClock.js';   // AUDIT-STOREFRONT II (lane D 2): saved at the mint
import { buildFissureModel, fissureVents, fissureStands, FISSURE_BARE_R } from '../world/fissureModel.js';
import { fissureArt, FISSURE_ARCHIVE } from '../world/fissureArt.js';
import { findGateSite } from '../systems/gate/gateSite.js';
import { gateAt } from '../net/gate/gateLaw.js';
import { promoteRaidLeader } from '../systems/eliteFoes.js';
import { giveBossTraits, bossWardShare, hasBossTrait } from '../systems/bossTraits.js';
import { playerDoor } from '../systems/playerDoor.js';
import { playStorefrontSound } from '../systems/storefrontSounds.js';
import { renownStruckAt } from '../net/renownTracker.js';
import { storedSession, accountSeasonMaul, accountRefusalText } from '../net/accountClient.js';
import { characterIdOf } from '../systems/characterId.js';
import { playerEntity } from '../characters/playerEntity.js';
import { appStorage } from '../systems/appStorage.js';
import { eventNotice } from '../systems/eventNotices.js';
import { setMidScreenText } from '../ui/midScreenText.js';
import { drawGateBossBar } from '../ui/gate/gateBossBar.js';
import { audio as defaultAudio } from '../systems/audio.js';
import { betterAmbience } from '../systems/betterAmbience.js';
import { lateSolidsOf } from '../player/lateSolid.js';
import { trs } from '../world/mat4.js';

/** A fissure is built for a player this near, and let go past a fifth more. */
export const SEASON_BUILD_M = 700;
/** Its vents breathe for a player this near, each every SEASON_STEAM_MS; its hum is heard this near, every clip's length. */
export const SEASON_STEAM_M = 160;
export const SEASON_STEAM_MS = 2400;
export const SEASON_HUM_M = 45;
export const SEASON_HUM_MS = 2100;
/** Its constructs are sprung by a player this near its heart, and stand this far out from it; my own are taken down
 *  once I am this far off (the site said to be nobody's). */
export const SEASON_SPRING_M = 90;
export const SEASON_RING_M = Object.freeze([7, 10]);
export const SEASON_LEAVE_M = 260;
/** A fissure this character saw cleared is quiet for it this long. A peer's camp nobody has spoken for this long is gone
 *  with its owner (the rite's law, RITE_ORPHAN_MS). A stand that stood nothing is tried again this long after. */
export const SEASON_QUIET_MS = 20 * 60_000;
export const SEASON_ORPHAN_MS = 10_000;
export const SEASON_RESTAND_MS = 5000;
/** One woken wakes its camp this near (the camp's law). */
export const SEASON_ALERT_M = 25;
/** The Colossus: its health past a raid leader's, its traits, and its bar for a player this near. */
export const COLOSSUS_HEALTH = 3;
export const COLOSSUS_TRAITS = Object.freeze(['warded', 'stormproof', 'bladeturning']);   // in the traits' own order (systems/bossTraits.js BOSS_TRAITS)
export const COLOSSUS_BAR_M = 60;
/** The tremor's camera kicks this often while it lasts, its dust this often. */
export const TREMOR_KICK_MS = 350;
export const TREMOR_DUST_MS = 1500;
/** The aetherium's light at the nearest fissure, for a player this near. */
export const SEASON_GLOW = Object.freeze({ range: 12, reach: 90, color: Object.freeze([0.35, 0.75, 1.5]) });
/** AUDIT LANE 5: where the fissures this device's characters saw cleared are kept (`<account>|<character>|<fissure>` -> when,
 *  on the shared clock), so a reload keeps the quiet. */
export const SEASON_QUIET_STORE = 'dagger:fissureQuiet';
/** AUDIT LANE 5: the Maul is the service's to give, once a UTC day an account (server-account/src/seasonClaim.js) - asked
 *  with one ask's id this many times, this far apart, while no answer comes back. */
export const SEASON_MAUL_ASKS = 3;
export const SEASON_MAUL_ASK_MS = 4000;
/** AUDIT-STOREFRONT II (lane D 2): a Maul the service said yes to is kept on the device from its mint until a save of the
 *  character made after it lands (`<rid>` -> `{ day, who }`) - the claim is spent at the yes, so a page gone first lost
 *  it. One found at the character's stand-up and not in its pack is asked again by its own id, again this long after an
 *  ask that had no answer. */
export const SEASON_MAUL_HELD_STORE = 'dagger:maulHeld';
export const SEASON_MAUL_REASK_MS = 30_000;
/** AUDIT LANE 5: Basic Roads' roads and tracks asked again this long after a load that failed (seasonWorld.js keeps the
 *  fissures off them, so none stands before they are read). */
export const SEASON_ROADS_RETRY_MS = 30_000;
/** W14: a province's areas whose roads were not yet laid are asked again as the layer moves, and this often besides (a
 *  region whose build failed lays no layer, and is let go). */
export const SEASON_LANES_ASK_MS = 5000;
/** W14: one theatre's fissures are drawn at a time, this long (a frame) before the next's - all eight at once were 8 to
 *  44 ms on the freeware's provinces (no road, and a road on every pixel), one some 1 to 6. */
export const SEASON_LANE_DRAW_MS = 16;
/** The ground under a fissure is read again every this many frames, its model made again when it moved this far. */
export const SEASON_GROUND_EVERY = 20;
export const SEASON_GROUND_TOL = 0.01;
/** The crack's floor drawn this far toward the eye (the crater's floor's polygonOffset). */
export const SEASON_FLOOR_OFFSET = Object.freeze([-1, -4]);
/** The collider's bucket a fissure's wreckage stands under. */
export const fissureBucket = (/** @type {string} */ key) => `brass:${key}`;

const NONE = Object.freeze([]);
const DOWN = [0, -1, 0];
const DEG = 180 / Math.PI;
const hitDistance = (hit) => (hit && Number.isFinite(hit.dist) ? hit.dist : null);
const sameAt = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
const sameMatrix = (a, b) => { if (!a || !b) return false; for (let i = 0; i < 16; i++) if (Math.abs(a[i] - b[i]) >= 5e-4) return false; return true; };

/** THE HOST'S BINDINGS, BY NAME - the Starfall's own object (scenes/starfall/starfallHost.js): `renderer`, `state`,
 *  `exteriorFoes`, `gateScanOf`, `warmGateScan`, `surfaceAt`, `player`, `walkMode`, `playerSpawned`, `online`, `collider`,
 *  `_sharedOffsetMs`, `relayNowS`, `labGrassField`, `chatNotice`, the camp law's five, `gamePaused`, `townTalk` - and, for
 *  the tests, `audio`, `storage`, `say`, `shake`, `burst`, `struckAt`, `who`, `take`, `bindPass`, `passApi`, `maulApi`,
 *  `rid`, `wait`, `roads` and W14's `theatreScans`, `worldPlaces`, `landVersion`, `idle` and `pastBayRoads`. AUDIT-STOREFRONT
 *  II (lane D 2): for the tests, `entity`, `hearRealmSaves`, `onSlotSaved`, `onSlotLoaded` and `askCheckpoint`.
 *  @param {any} host */
export function createSeasonHost(host) {
  const renderer = host.renderer ?? null;
  const collider = () => host.collider ?? null;
  const now = () => Date.now() + (host._sharedOffsetMs ?? 0);
  // BAY-OWN: the Bay's own gate scan (MAPS.BSA's rows) - a province's fissures stand on its theatre's (`theatres`, W14)
  const scan = () => host.gateScanOf?.(() => false) ?? null;
  /** W14 (WW5's theatres, the Starfall's): the theatres past the Bay a site-bound event stands in, each scan warmed a
   *  theatre an idle moment (scenes/eventTheatres.js) - the host's own (`theatreScans`), else the world host's. */
  const theatres = createEventTheatres({
    scans: () => (host.theatreScans !== undefined ? host.theatreScans : keptTheatreScans()),
    generation: () => (host.worldPlaces ?? keptPlaces())?.generation?.() ?? 0, land: () => (host.landVersion ?? tamrielLandVersion)(),
    idle: host.idle !== undefined ? host.idle : undefined,
  });
  /** W14: the roads past the Bay's host (scenes/tamrielRoadsHost.js: `landedIn` a box's roads laid whole, `build`) */
  const pastRoads = () => (host.pastBayRoads !== undefined ? host.pastBayRoads : keptArenaRoadsHost());
  const pixelTranslation = (px, py, out) => host.state.pixelTranslation(px, py, out);
  const groundAt = (x, z) => host.surfaceAt?.(x, z) ?? NaN;
  const feet = () => (host.walkMode && host.playerSpawned ? host.player?.feetAt?.() ?? null : null);
  const online = () => !!host.online;
  const foes = host.exteriorFoes ?? null;
  const camp = {
    peerSprang: (site) => !!host._wodPeerSprung?.has(site), peerHeldAgo: (site) => host.wodPeerHeldAgo?.(site) ?? 0,
    forgetPeer: (site) => host.wodForgetPeer?.(site), sprang: (site) => host.wodSprang?.(site), unsprang: (site) => host.wodUnsprang?.(site),
  };
  const say = host.say ?? ((text) => eventNotice('season', text));
  const tell = (text) => host.chatNotice?.(text);
  const shake = host.shake ?? ((k) => betterAmbience.weaponKick?.(k));
  const burst = host.burst ?? ((recipe, at, o) => playerDoor()?.burst?.(recipe, at, o));
  const struckAt = host.struckAt ?? renownStruckAt;
  const take = host.take ?? ((item) => host.takeSpoil?.({ item }));
  const audio = host.audio ?? defaultAudio;
  const storage = host.storage !== undefined ? host.storage : appStorage();
  const who = host.who ?? (() => `${storedSession(storage)?.id ?? 'local'}|${characterIdOf(playerEntity) ?? ''}`);
  /** AUDIT LANE 5: nothing of the season stands until the relay's clock is heard - a device clock set ahead stood it early */
  const heard = () => host.relayNowS?.() != null;
  const maulApi = host.maulApi ?? accountSeasonMaul({ fetch: (/** @type {any} */ u, /** @type {any} */ i) => globalThis.fetch(u, i), storage });
  const ridOf = host.rid ?? (() => [...globalThis.crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join(''));
  const wait = host.wait ?? ((/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms)));
  const hudHidden = () => !!host.gamePaused?.() || !!host.townTalk?.hudHidden;
  const entity = () => host.entity ?? playerEntity;

  // ── THE PASS, bound on the world's doors ──
  if (host.bindPass !== false) {
    bindPass({
      online, nowMs: now,
      onEvent: (e) => {   // PASS-PANELS: a challenge's Aurum, and the day's found
        if (e.kind === 'challenge') tell(PASS_EVENT_TEXT.challenge(passChallengeText(e.key), e.aurum));
        else if (e.kind === 'full') tell(PASS_EVENT_TEXT.full());
      },
      ...(host.passApi ? { api: host.passApi } : {}),
    });
  }

  /** key -> a fissure standing on this screen */
  const fissures = new Map();
  /** `<who>|<key>` -> when this character saw it cleared - kept in the store too (AUDIT LANE 5: a reload stood it again) */
  const quiet = new Map(readQuiet());
  /** Basic Roads' roads and tracks: undefined until read (the tests hand theirs in - null keeps off none) */
  const paths = { net: host.roads, askedAt: -Infinity };
  let frameN = 0, artUp = false, barUp = false;
  const tremor = { hour: NaN, kickAt: -Infinity, dustAt: -Infinity };
  /** the stage's fissures: the Bay's (`bay`) made once a stage and a scan, then each theatre's past it (`lanes`) - `list`
   *  every one, made again only when a part moved */
  const sites = { key: '', scan: null, roads: /** @type {any} */ (null), bay: /** @type {ReadonlyArray<any>} */ (NONE), parts: /** @type {any[]} */ ([]), list: /** @type {ReadonlyArray<any>} */ (NONE) };
  /** W14: lane -> its stage's fissures past the Bay: an area's drawn once its roads are laid (`todo` the rest) - and when a
   *  theatre's were last drawn (one theatre's draws a moment) */
  const lanes = new Map(), drew = { at: -Infinity };
  /** each lane's gate of the day, found once a day over the same scan: lane -> `{ day, sc, site }` */
  const gates = new Map();
  const clears = { key: /** @type {any} */ (''), list: /** @type {any} */ (NONE) };
  /** AUDIT-STOREFRONT II (lane B 1, D 1): the Colossi whose fall was read, by the pool's record - a body stays one record
   *  for its life, and a fissure's own record is made again (the relay's clock lost a moment, a walk off and back), so a
   *  set kept on that counted one body again: its line again, and a second Maul after midnight. */
  const fallen = new WeakSet();
  /** AUDIT-STOREFRONT II (lane D 2): the Mauls held on the device, `<rid>` -> `{ day, who, taken, askAt }` - `taken` in this
   *  page's pack (a save made now holds it), `askAt` when one owed may be asked again */
  const held = new Map(readHeld());
  const maul = { stood: /** @type {string|null} */ (null), asking: new Set() };
  /** AUDIT-STOREFRONT II (lane D 3): the map's cards, made again only when the stage's fissures, a theatre's gate of the
   *  day (`gates`, lane -> its site) or the words' language moved - the held map asks four times a second, and every card
   *  made again each time grew with the stage's hundreds */
  const cards = { list: /** @type {any} */ (null), text: -1, gates: new Map(), out: /** @type {ReadonlyArray<any>} */ (NONE) };
  const glow = { x: 0, y: 0, z: 0, range: SEASON_GLOW.range, color: SEASON_GLOW.color }, glowList = Object.freeze([glow]);
  const T3 = [0, 0, 0];

  function readQuiet() {
    try { const v = JSON.parse(storage?.getItem?.(SEASON_QUIET_STORE) ?? '{}'); return v && typeof v === 'object' ? Object.entries(v).filter(([, at]) => Number.isFinite(at)) : []; } catch { return []; }
  }
  /** A fissure this character saw cleared, quiet from `t` - its stale neighbours dropped as it is written. */
  function keepQuiet(F, t) {
    quiet.set(quietKey(F), t);
    for (const [k, at] of [...quiet]) if (!(t - at < SEASON_QUIET_MS)) quiet.delete(k);
    try { storage?.setItem?.(SEASON_QUIET_STORE, JSON.stringify(Object.fromEntries(quiet))); } catch { /* a full store: this page keeps it */ }
  }
  /** @returns {Array<[string, any]>} */
  function readHeld() {
    try {
      const v = JSON.parse(storage?.getItem?.(SEASON_MAUL_HELD_STORE) ?? '{}');
      if (!v || typeof v !== 'object') return [];
      return Object.entries(v).filter(([rid, h]) => ITEM_UID_RE.test(rid) && typeof h?.who === 'string').map(([rid, h]) => [rid, { day: h.day ?? null, who: h.who, taken: false, askAt: -Infinity }]);
    } catch { return []; }
  }
  function keepHeld() {
    const out = Object.fromEntries([...held].map(([rid, h]) => [rid, { day: h.day, who: h.who }]));
    try { storage?.setItem?.(SEASON_MAUL_HELD_STORE, JSON.stringify(out)); } catch { /* a full store: this page keeps it */ }
  }
  /** The room's roads (systems/online/onlineLane.js forces Basic Roads on), this host's own copy of his vendored bytes. */
  function roads() {
    if (paths.net !== undefined || Date.now() - paths.askedAt < SEASON_ROADS_RETRY_MS) return paths.net;
    paths.askedAt = Date.now();
    loadModRoads(globalThis.fetch, /** @type {any} */ ({ roads: MOD_ROADS.roads, tracks: MOD_ROADS.tracks })).then((net) => { if (net) paths.net = net; }, () => {});
    return undefined;
  }
  function stageSites(at) {
    const sc = scan(), rn = roads();
    if (!sc) host.warmGateScan?.();
    if (rn === undefined) return sites.list;
    const key = `${at.n}.${at.stage}`;
    if (sites.key !== key || sites.scan !== sc || sites.roads !== rn) {
      sites.key = key; sites.scan = sc; sites.roads = rn;
      try { sites.bay = sc ? Object.freeze(stageFissures(at.n, at.stage, sc, rn)) : NONE; } catch (e) { console.warn('[season] no fissures', e?.message ?? e); sites.bay = NONE; }
    }
    const parts = [sites.bay];
    for (const [lane, lsc] of theatres.warmLanes()) parts.push(laneSites(/** @type {number} */ (lane), lsc, at, rn));
    if (parts.length !== sites.parts.length || parts.some((p, i) => p !== sites.parts[i])) { sites.parts = parts; sites.list = Object.freeze(parts.flat()); }
    return sites.list;
  }
  /** W14: A THEATRE'S FISSURES PAST THE BAY (seasonWorld.js theatreFissures) - an area's drawn once the roads past the Bay
   *  are laid over it (`pastRoads().landedIn`: every machine keeps off the same roads, as the Bay's waits for its own),
   *  asked again as the layer moves; all drawn again for a new stage, scan, Bay network or roads' build. */
  function laneSites(lane, sc, at, rn) {
    const key = `${at.n}.${at.stage}`, R = pastRoads(), build = R?.build?.() ?? 0;
    let L = lanes.get(lane);
    if (!L || L.key !== key || L.sc !== sc || L.rn !== rn || L.build !== build) {
      const todo = [...sc.byArea.keys()].map((a) => ({ a, box: areaBox(sc, a) }));
      lanes.set(lane, L = { key, sc, rn, build, asked: '', todo, areas: new Map(), list: NONE });
    }
    const stamp = `${arenaRoadsVersion()}:${Math.floor(Date.now() / SEASON_LANES_ASK_MS)}`;
    if (!L.todo.length || L.asked === stamp || Date.now() - drew.at < SEASON_LANE_DRAW_MS) return L.list;
    L.asked = stamp;
    const laid = new Set(L.todo.filter(({ box }) => !!box && !!R?.landedIn?.(box[0], box[1], box[2], box[3])).map(({ a }) => a));
    if (!laid.size) return L.list;
    drew.at = Date.now();
    for (const a of laid) L.areas.set(a, []);
    try { for (const f of theatreFissures(at.n, at.stage, sc, rn, (a) => laid.has(a))) L.areas.get(f.area).push(f); } catch (e) { console.warn('[season] no fissures', lane, e?.message ?? e); }
    L.todo = L.todo.filter(({ a }) => !laid.has(a));
    L.list = Object.freeze([...L.areas.keys()].sort((x, y) => x - y).flatMap((a) => L.areas.get(a)));
    return L.list;
  }
  /** Each lane's gate of the day (the Bay's over its own scan, a province's over its theatre's - systems/gate/
   *  theatreGateSite.js), found once a day over the same scan. */
  function gateOf(lane, t) {
    const sc = lane ? lanes.get(lane)?.sc ?? null : scan(), day = gateAt(t, lane).day;
    let g = gates.get(lane);
    if (!g || g.day !== day || g.sc !== sc) {
      gates.set(lane, g = { day, sc, site: null });
      try { g.site = sc ? (lane ? findTheatreGateSite(day, sc) : findGateSite(day, sc)) : null; } catch { g.site = null; }
    }
    return g.site;
  }
  /** The day's gates at `t`, each lane asked once: `gateFor(f)` a fissure's own theatre's. */
  const gatesAt = (t) => { const seen = new Map(); return (f) => { const lane = f.theatre ?? 0; if (!seen.has(lane)) seen.set(lane, gateOf(lane, t)); return seen.get(lane); }; };
  /** AUDIT-STOREFRONT II (lane D 3): whether a lane's gate of the day moved since the cards were made - the Bay's and each
   *  theatre's past it, kept as `cards.gates` (gateOf keeps each a day). */
  function cardGatesMoved(t) {
    let moved = cards.gates.size !== lanes.size + 1 || cards.gates.get(0) !== gateOf(0, t);
    for (const lane of lanes.keys()) if (!moved && cards.gates.get(lane) !== gateOf(lane, t)) moved = true;
    if (!moved) return false;
    cards.gates.clear();
    cards.gates.set(0, gateOf(0, t));
    for (const lane of lanes.keys()) cards.gates.set(lane, gateOf(lane, t));
    return true;
  }

  // ── a fissure's place in the scene: its heart, and a point of its own frame in the world's ──
  const yawDeg = (F) => F.f.yaw * DEG;
  const toWorld = (F, lx, lz) => { const c = Math.cos(F.f.yaw), s = Math.sin(F.f.yaw); return [F.heart[0] + c * lx + s * lz, F.heart[2] - s * lx + c * lz]; };
  function placeOf(F) {
    const t = pixelTranslation(F.f.px, F.f.py, T3);
    const x = t[0] + F.f.spot[0], z = t[2] + F.f.spot[1], y = groundAt(x, z);
    F.known = Number.isFinite(y);
    F.heart[0] = x; F.heart[1] = F.known ? y : t[1]; F.heart[2] = z;
  }
  const heightAt = (F) => (lx, lz) => { const [x, z] = toWorld(F, lx, lz), y = groundAt(x, z); return Number.isFinite(y) ? y - F.heart[1] : 0; };
  /** The ground about the heart read again every so often - a pixel built finer moves it. */
  function ground(F) {
    if (!sameAt(F.sampledHeart, F.heart) || frameN - F.sampledAt >= SEASON_GROUND_EVERY) {
      F.sampledAt = frameN; F.sampledHeart = [...F.heart];
      const h = heightAt(F);
      let changed = false;
      for (let i = 0; i < F.sig.length; i++) {
        const a = (i / F.sig.length) * 2 * Math.PI, r = i % 2 ? 3 : 8;
        const v = h(Math.cos(a) * r, Math.sin(a) * r);
        if (!(Math.abs(v - F.sig[i]) <= SEASON_GROUND_TOL)) { changed = true; F.sig[i] = v; }
      }
      if (changed) F.groundGen++;
    }
  }
  function ensureMesh(F) {
    if (!renderer?.createMesh || !F.known || F.meshGen === F.groundGen) return;
    try {
      if (!artUp) {
        for (const [rec, art] of fissureArt()) { renderer.uploadTexture?.(FISSURE_ARCHIVE, rec, art.albedo); renderer.uploadEmissionTexture?.(FISSURE_ARCHIVE, rec, art.emission, { white: true }); }
        artUp = true;
      }
      const h = heightAt(F);
      const floor = renderer.createMesh(buildFissureModel(F.f, h, { solid: false }));
      F.solid = buildFissureModel(F.f, h, { ground: false });
      const mesh = renderer.createMesh(F.solid);
      dropMeshes(F);
      F.floor = floor; F.mesh = mesh; F.meshGen = F.groundGen;
    } catch (e) { console.warn('[season] the fissure would not build', e?.message ?? e); F.meshGen = F.groundGen; }
  }
  function dropMeshes(F) {
    if (F.mesh) { renderer?.destroyMesh?.(F.mesh); F.mesh = null; }
    if (F.floor) { renderer?.destroyMesh?.(F.floor); F.floor = null; }
  }
  /** Its matrix made again whenever its heart moves, and its wreckage's collider stood again at every matrix that moved -
   *  a late solid, never closed round a body standing in it (the crater's law, player/lateSolid.js). */
  function place(F) {
    if (!sameAt(F.madeAt, F.heart)) { F.madeAt = [...F.heart]; F.mat = trs(F.heart[0], F.heart[1], F.heart[2], 0, yawDeg(F), 0); }
    const late = lateSolidsOf(collider());
    if (!late || !F.solid || !F.mat) return;
    if (F.colliderGen === F.meshGen && sameMatrix(F.colliderAt, F.mat)) return;
    const key = fissureBucket(F.key);
    if (F.colliderAt && F.colliderGen === F.meshGen) late.replace(key, F.solid.positions, F.solid.indices, F.mat);
    else { if (F.colliderAt) late.remove(key); late.add(key, F.solid.positions, F.solid.indices, F.mat); }
    F.colliderAt = F.mat; F.colliderGen = F.meshGen;
  }
  function dropBuild(F) {
    dropMeshes(F); F.solid = null; F.meshGen = -1;
    if (F.colliderAt) { lateSolidsOf(collider())?.remove(fissureBucket(F.key)); F.colliderAt = null; F.colliderGen = -1; }
    if (F.bared) { F.bared = false; host.labGrassField?.invalidate?.(F.heart[0] - FISSURE_BARE_R, F.heart[2] - FISSURE_BARE_R, F.heart[0] + FISSURE_BARE_R, F.heart[2] + FISSURE_BARE_R); }
  }

  function enter(f) {
    const F = {
      key: f.key, f, heart: [0, 0, 0], known: false, mat: null, madeAt: null, sig: new Float64Array(12).fill(NaN), sampledAt: -Infinity, sampledHeart: null,
      groundGen: 0, meshGen: -1, mesh: null, floor: null, solid: null, colliderAt: null, colliderGen: -1, bared: false,
      vents: fissureVents(f), ventAt: [-Infinity, -Infinity, -Infinity], humAt: -Infinity,
      pending: 0, ownLive: 0, pupLive: 0, spawned: false, standAt: -Infinity, camp: null, colossus: null, fellAt: NaN, live: NONE,
    };
    fissures.set(f.key, F);
    return F;
  }
  function leave(F) {
    dropCamp(F);
    dropBuild(F);
    fissures.delete(F.key);
  }
  /** My own constructs of a fissure taken down and its sites said to be nobody's - I walked off, or it went. */
  function dropCamp(F) {
    if (F.ownLive || F.pending || F.spawned) for (const s of [F.f.site, F.f.hSite]) if (s) { foes?.dropSiteFoes?.(s); camp.unsprang(s); }
    F.ownLive = 0; F.spawned = false; F.colossus = null;
  }

  // ── its constructs, on the camp law ──
  const ownSite = (F, fo) => fo.site === F.f.site || (!!F.f.hSite && fo.site === F.f.hSite);
  const quietKey = (F) => `${who()}|${F.key}`;
  /** A foe of the fissure's own camp: a construct of the season's, woken with its camp - the Colossus made the boss. */
  function made(F, fo, colossus, campId) {
    F.spawned = true;
    const e = fo.entity;
    if (!e) return;
    e.passConstruct = true;
    if (campId != null) { fo.campId = campId; e.campId = campId; fo.campAlertRadius = SEASON_ALERT_M; }
    if (!colossus) return;
    promoteRaidLeader(e, { name: COLOSSUS_TEXT.name() });
    e.maxHealth = Math.max(1, Math.round((e.maxHealth ?? 1) * COLOSSUS_HEALTH)); e.health = e.maxHealth;
    e.healthMult = (e.healthMult ?? 1) * COLOSSUS_HEALTH;   // TELL1: what was stood on the kind's own health (its poise)
    giveBossTraits(e, [...COLOSSUS_TRAITS]);
    F.colossus = fo;
  }
  /** THE CAMP STOOD: its constructs on a ring about the heart, facing in - and at a Heart Fissure the Colossus at its middle.
   *  AUDIT LANE 5: the waking said and seen as the first stands, and the Colossus's line as it stands - never for a stand
   *  that stood nothing; the Colossus never the street's elite roll (its one trait kept the season's three off it). */
  function stand(F, t) {
    F.standAt = t;
    if (!foes?.spawnFoe) return;
    const roster = fissureRoster(F.f).map((career) => [career, F.f.site, false]);
    if (F.f.hSite) roster.push([COLOSSUS_MOBILE, F.f.hSite, true]);
    for (const s of [F.f.site, F.f.hSite]) if (s) { foes.reclaimSite?.(s); camp.sprang(s); }
    const campId = foes.newCampId?.() ?? null;
    // AUDIT-STOREFRONT II (lane D 4): each stands on the fissure's own free ground (world/fissureModel.js fissureStands), turned
    // into the world as its model is - the ring had been laid in the world's frame, its angle off by twice the yaw
    const spots = fissureStands(F.f, roster.length - (F.f.hSite ? 1 : 0), { ring: SEASON_RING_M, colossus: !!F.f.hSite });
    let woke = false;
    roster.forEach(([career, site, colossus], i) => {
      const [lx, lz] = (colossus ? spots.colossus : spots.foes[i]) ?? [0, 0];
      const [x, z] = toWorld(F, lx, lz), y = groundAt(x, z), a = Math.atan2(z - F.heart[2], x - F.heart[0]);
      if (!Number.isFinite(y)) return;
      const hit = collider()?.surfaceHit?.([x, y + 0.2, z], DOWN, 3);
      F.pending++;
      const landed = (fo) => {
        F.pending--;
        if (fo && fissures.get(F.key) !== F) { foes.removeFoe?.(fo); return; }   // the fissure went while it stood
        if (fo) made(F, fo, colossus, campId);
        if (fo && !woke) { woke = true; burst('fissure-wake', [F.heart[0], F.heart[1], F.heart[2]], { h: 2, w: 6, dir: [Math.sin(F.f.yaw), Math.cos(F.f.yaw)] }); }   // along its crack (toWorld's turn)
        if (fo && colossus) say(COLOSSUS_TEXT.wakes(F.f.near));
        if (!F.pending && !F.spawned && fissures.get(F.key) === F) for (const s of [F.f.site, F.f.hSite]) if (s) camp.unsprang(s);   // none stood: claimed by nobody, tried again
      };
      const o = { yaw: a + Math.PI, placed: true, groundAlign: { hitDist: hitDistance(hit) }, site, transient: true, ...(colossus ? { eliteFoe: false } : {}) };
      Promise.resolve(foes.spawnFoe(career, [x, y, z], o)).then(landed, () => landed(null));
    });
  }
  /** Every screen's foes of the fissure counted, and the Colossus named and barred on each (its site says which it is, a
   *  live one before a body); one handed to me made the season's again; the Colossus's fall read. AUDIT LANE 5: a camp
   *  is cleared on a screen whose last standing foes of it are all bodies now - quiet for that character, whoever stood
   *  it; one gone without a body (a race lost, its owner walked off) is no clear. My stand with nothing left is let go. */
  function tend(F, t) {
    let own = 0, pup = 0;
    const live = [];
    for (const fo of foes?.foes ?? NONE) {
      if (!ownSite(F, fo)) continue;
      const colossus = !!F.f.hSite && fo.site === F.f.hSite, e = fo.entity;
      if (colossus && e) {
        const name = COLOSSUS_TEXT.name();
        if (e.raidLeader && e.raidLeader.name !== name) e.raidLeader.name = name;
        if (e.properName !== name) e.properName = name;
        if (!fo.dead || F.colossus?.dead !== false) F.colossus = fo;
      }
      if (fo.dead) { if (colossus && fo.corpse) colossusFell(F, fo, t); continue; }   // a fall has a body, as the Starfall's
      live.push(fo);
      if (fo.puppet) { pup++; continue; }
      own++;
      if (e && !e.passConstruct) made(F, fo, colossus && !e.raidLeader, null);   // handed to me (scenes/exteriorFoes.js adopt)
    }
    F.ownLive = own; F.pupLive = pup;
    if (own) F.spawned = true;
    if (!live.length && !F.pending) {
      if (F.live.length && F.live.every((fo) => fo.dead && fo.corpse)) keepQuiet(F, t);
      if (F.spawned) { for (const s of [F.f.site, F.f.hSite]) if (s) camp.unsprang(s); F.spawned = false; }
    }
    F.live = live;
  }
  /** THE COLOSSUS FELL (seen once, with a body): its line said on every screen that saw it; a character whose blow landed
   *  on it asks the service for the Maul (AUDIT LANE 5) - minted on its yes alone, so offline or signed out there is none. */
  function colossusFell(F, fo, t) {
    if (fallen.has(fo)) return;
    fallen.add(fo);
    F.fellAt = t;
    say(COLOSSUS_TEXT.falls());
    if (struckAt(fo) == null) return;
    void claimMaul().catch((e) => console.warn('[season] the Maul', e?.message ?? e));
  }
  /** The Maul asked of the service with one ask's id, asked again while no answer comes back (a lost answer is a yes to
   *  the same id, seasonClaim.js). Answers true when it was taken, false for a refusal, null for no answer. AUDIT-STOREFRONT
   *  II (lane D 2): held on the device from the mint until a save made after it lands (`held`, letGo). */
  async function claimMaul(rid = ridOf()) {
    for (let i = 0; i < SEASON_MAUL_ASKS; i++) {
      if (i) await wait(SEASON_MAUL_ASK_MS);
      const a = await maulApi.claim(rid);
      if (a?.ok) {
        const item = mintResonantMaul();
        if (!item) return false;
        item.uid = rid;   // the piece's ledger id is its claim's: a save holding it says so at the next stand-up
        held.set(rid, { day: a.data?.day ?? null, who: who(), taken: true, askAt: -Infinity });
        keepHeld();
        take(item);
        (host.askCheckpoint ?? askCheckpoint)();   // the realm's save holds it from the next frame, not the period's end
        setMidScreenText(COLOSSUS_TEXT.maul());
        return true;
      }
      if (a?.error === 'taken') setMidScreenText(accountRefusalText('taken'));   // AUDIT-STOREFRONT: why no Maul came
      if (!(a?.error === 'offline' || a?.error === 'server' || (a?.status ?? 0) >= 500)) return false;   // a refusal: today's taken, the stage closed, no session
    }
    return null;
  }
  const takenRids = () => [...held].filter(([, h]) => h.taken).map(([rid]) => rid);
  /** AUDIT-STOREFRONT II (lane D 2): held Mauls a landed save holds, let go. */
  function letGo(/** @type {string[]} */ rids) {
    if (!rids.length) return;
    for (const rid of rids) held.delete(rid);
    keepHeld();
  }
  // AUDIT-STOREFRONT II (lane D 2): A SAVE THAT LANDS LETS ITS MAULS GO - a realm checkpoint (the Mauls in the pack as the
  // composers' sink was handed it, once the realm says ok: scenes/shared.js hearRealmSaves) or a slot of the character
  // written. A load in the session is a stand-up (the spoils pools' law): the pack is the loaded save's, read again.
  (host.hearRealmSaves ?? hearRealmSaves)(() => { const mine = takenRids(); return (/** @type {any} */ r) => { if (r?.ok === true) letGo(mine); }; });
  (host.onSlotSaved ?? onSlotSaved)((/** @type {any} */ ch) => letGo(takenRids().filter((rid) => held.get(rid)?.who.endsWith(`|${ch}`))));
  (host.onSlotLoaded ?? onSlotLoaded)(() => { for (const h of held.values()) h.taken = false; maul.stood = null; });
  /** AUDIT-STOREFRONT II (lane D 2): THE HELD MAULS AT THE CHARACTER'S STAND-UP - one its save holds (the piece by its id, in
   *  its lists or stowed) let go; one it does not asked again by its own id (a refusal let go, no answer asked again). */
  function tendMaul(t) {
    if (!held.size || !online() || !feet()) return;
    const w = who();
    if (maul.stood !== w) {
      maul.stood = w;
      const { keys, stowed } = carriedPieces(entity());
      letGo([...held].filter(([rid, h]) => h.who === w && !h.taken && (keys.has(rid) || stowed.has(rid))).map(([rid]) => rid));
    }
    for (const [rid, h] of held) {
      if (h.who !== w || h.taken || maul.asking.has(rid) || t < h.askAt) continue;
      maul.asking.add(rid); h.askAt = t + SEASON_MAUL_REASK_MS;
      void claimMaul(rid).then((got) => { if (got === false) letGo([rid]); }, (e) => console.warn('[season] the Maul', e?.message ?? e)).finally(() => maul.asking.delete(rid));
    }
  }
  /** Whether to stand the camp now - nobody's standing here (mine, a peer's copies, mine on their way), I have not seen
   *  it cleared lately, and nobody holds it: none sprang it, or its owner went quiet (the rite's law). */
  function maybeStand(F, t) {
    if (F.pending || F.ownLive || F.pupLive || t - F.standAt < SEASON_RESTAND_MS) return;
    const q = quiet.get(quietKey(F));
    if (q != null && t - q < SEASON_QUIET_MS) return;
    if (camp.peerSprang(F.f.site)) {
      if (!(camp.peerHeldAgo(F.f.site) >= SEASON_ORPHAN_MS)) return;
      for (const s of [F.f.site, F.f.hSite]) if (s) camp.forgetPeer(s);
    }
    stand(F, t);
  }

  // ── the tremor ──
  function quake(t, f) {
    const tr = tremorAt(t);
    if (!tr) return;
    if (tremor.hour !== tr.hour) {
      tremor.hour = tr.hour; tremor.kickAt = -Infinity; tremor.dustAt = -Infinity;
      say(TREMOR_TEXT[tr.stage]?.() ?? '');
      if (f) playStorefrontSound(audio, 'storefront:season-tremor', [f[0], f[1] + 1, f[2]], 1, { maxDistance: 60 });
    }
    if (t - tremor.kickAt >= TREMOR_KICK_MS) { tremor.kickAt = t; shake(tr.kick); }
    if (f && t - tremor.dustAt >= TREMOR_DUST_MS) { tremor.dustAt = t; burst('tremor-dust', [f[0], f[1], f[2]]); }
  }

  /** The Colossus's bar, while it is near and standing or a moment after its fall. */
  function colossusBar(t, f) {
    let best = null, bd = COLOSSUS_BAR_M;
    for (const F of fissures.values()) {
      const fo = F.colossus;
      if (!fo?.entity || !f) continue;
      const d = Math.hypot(fo.ai?.feet?.[0] - f[0], fo.ai?.feet?.[2] - f[2]);
      if (d <= bd && (!fo.dead || t - F.fellAt < 4000)) { bd = d; best = F; }
    }
    const e = best?.colossus?.entity;
    const model = e ? {
      theme: 'brass', ringCss: '#e8c060', name: COLOSSUS_TEXT.name(), title: FISSURE_TEXT.heart(), epithet: '', epithetColor: null, marksView: null, trials: '',
      frac: best.colossus.dead ? 0 : Math.max(0, Math.min(1, (e.health ?? 0) / Math.max(1, e.maxHealth ?? 1))), marks: [], phase: 1, spent: [],
      warded: !best.colossus.dead && hasBossTrait(e, 'warded') && bossWardShare(e) > 0, fallen: !!best.colossus.dead, callout: null, wrath: null, wrathNear: false,
      fighters: 0, fightersLine: '', host: null, reckonIn: null, alpha: 1, now: t, low: false,
    } : null;
    if (model || barUp) { drawGateBossBar(model, { hidden: hudHidden() }); barUp = !!model; }
  }

  return {
    /** THE FRAME: the tremor felt, the stage's fissures near the player built, breathing and humming, their camps stood and
     *  tended, the Colossus's bar drawn. Its own catch. */
    frame() {
      try { this.step(); } catch (e) { console.warn('[season] host', e?.message ?? e); }
    },
    /** The frame's work (frame's, inside its catch). */
    step() {
      frameN++;
      const t = now(), at = seasonStageAt(t);
      tendMaul(Date.now());   // AUDIT-STOREFRONT II (lane D 2): a held Maul outlives its stage
      if (!at || !online() || !heard()) { this.destroyAll(); return; }
      const f = feet();
      quake(t, f);
      const gateFor = gatesAt(t), seen = new Set();
      for (const site of stageSites(at)) {
        const tr = pixelTranslation(site.px, site.py, T3);
        const hx = tr[0] + site.spot[0], hz = tr[2] + site.spot[1];
        const d = f ? Math.hypot(hx - f[0], hz - f[2]) : Infinity;
        let F = fissures.get(site.key);
        if (!F && d > SEASON_BUILD_M) continue;
        if (F && d > SEASON_BUILD_M * 1.2) { leave(F); continue; }
        F ??= enter(site);
        seen.add(site.key);
        if (fissureUnderGate(site, gateFor(site))) { dropCamp(F); dropBuild(F); continue; }   // it gives way to its theatre's gate of the day
        placeOf(F);
        if (!F.known) continue;
        ground(F);
        ensureMesh(F);
        if (F.mesh) {
          place(F);
          if (!F.bared) { F.bared = true; host.labGrassField?.invalidate?.(F.heart[0] - FISSURE_BARE_R, F.heart[2] - FISSURE_BARE_R, F.heart[0] + FISSURE_BARE_R, F.heart[2] + FISSURE_BARE_R); }
        }
        if (d <= SEASON_STEAM_M) {
          F.vents.forEach(([lx, lz], i) => {
            if (t - F.ventAt[i] < SEASON_STEAM_MS) return;
            F.ventAt[i] = t + i * 300;
            const [x, z] = toWorld(F, lx, lz);
            burst('fissure-steam', [x, groundAt(x, z) || F.heart[1], z]);
          });
        }
        if (d <= SEASON_HUM_M && t - F.humAt >= SEASON_HUM_MS) { F.humAt = t; playStorefrontSound(audio, 'storefront:season-hum', [F.heart[0], F.heart[1] + 0.5, F.heart[2]], 0.8, { maxDistance: SEASON_HUM_M }); }
        tend(F, t);
        if (d > SEASON_LEAVE_M) { if (F.ownLive || F.pending) dropCamp(F); }   // walked off: given up, no hand-over - the Starfall's leash (bible Battle-Pass.md section 6)
        else if (d <= SEASON_SPRING_M) maybeStand(F, t);
      }
      for (const F of [...fissures.values()]) if (!seen.has(F.key)) leave(F);
      colossusBar(t, f);
    },
    /** The fissures' floors (pulled toward the eye, the crater's floor's way) and their wreckage, in the world pass. */
    draw(r = renderer, texRemap = null) {
      if (!r?.drawMesh) return 0;
      let n = 0;
      for (const F of fissures.values()) if (F.mesh && F.mat) { r.drawMesh(F.mesh, F.mat, texRemap); n++; }
      const gl = r.gl ?? null;
      let offset = false;
      try {
        for (const F of fissures.values()) {
          if (!F.floor || !F.mat) continue;
          if (!offset && gl) { offset = true; gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(SEASON_FLOOR_OFFSET[0], SEASON_FLOOR_OFFSET[1]); }
          r.drawMesh(F.floor, F.mat, texRemap); n++;
        }
      } finally { if (offset) { gl.disable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(0, 0); } }
      return n;
    },
    /** The aetherium's light at the nearest built fissure, for a player near it - one light, moved in place. */
    lights() {
      const f = feet();
      if (!f) return NONE;
      let best = null, bd = /** @type {number} */ (SEASON_GLOW.reach);
      for (const F of fissures.values()) { if (!F.mesh) continue; const d = Math.hypot(F.heart[0] - f[0], F.heart[2] - f[2]); if (d <= bd) { bd = d; best = F; } }
      if (!best) return NONE;
      glow.x = best.heart[0]; glow.y = best.heart[1] + 0.6; glow.z = best.heart[2];
      return glowList;
    },
    /** The map's cards for the stage's fissures (ui/eventMapMarks.js's shape): each its name, its town and what waits at it -
     *  the same frozen list while nothing they say moved (AUDIT-STOREFRONT II, lane D 3). */
    mapMarks() {
      const t = now(), at = seasonStageAt(t);
      if (!at || !online() || !heard()) return NONE;
      const list = stageSites(at);
      if (!cardGatesMoved(t) && list === cards.list && cards.text === textRevision()) return cards.out;
      cards.list = list; cards.text = textRevision();
      const gateFor = gatesAt(t);
      cards.out = Object.freeze(list.map((s) => {
        const title = s.hSite ? FISSURE_TEXT.heart() : FISSURE_TEXT.name();
        const lines = [FISSURE_TEXT.near(s.near), s.hSite ? FISSURE_TEXT.wakes() : FISSURE_TEXT.guards(), ...(fissureUnderGate(s, gateFor(s)) ? [FISSURE_TEXT.quiet()] : [])];
        return { key: s.key, px: s.px, py: s.py, heart: !!s.hSite, label: `${title}, ${s.near}`, tip: { title, lines } };
      }));
      return cards.out;
    },
    /** STAR-CLEAR's law for the fissures (world/gate/gateClearance.js gateClearSet's `fissures`): `{ f, px, py, x, z }` for
     *  every fissure of the stage in every theatre - its key, its pixel and its heart there - the same frozen list while the
     *  same fissures stand (W14: a province's areas join as their roads are laid). */
    fissureClears() {
      const at = seasonStageAt(now());
      const list = at && online() && heard() ? stageSites(at) : NONE;
      const key = list.length ? list : '';
      if (key !== clears.key) { clears.key = key; clears.list = key ? Object.freeze(list.map((s) => Object.freeze({ f: s.key, px: s.px, py: s.py, x: s.spot[0], z: s.spot[1] }))) : NONE; }
      return clears.list;
    },
    /** The scorched ground the grass keeps off, for the nearest built fissure - `{ x, z, r, key }` - or null. */
    clearing() {
      const f = feet();
      let best = null, bd = Infinity;
      for (const F of fissures.values()) { if (!F.mesh || !f) continue; const d = Math.hypot(F.heart[0] - f[0], F.heart[2] - f[2]); if (d < bd) { bd = d; best = F; } }
      return best ? { x: best.heart[0], z: best.heart[2], r: FISSURE_BARE_R, key: fissureBucket(best.key) } : null;
    },
    /** The host's state, for the tests and the probes. */
    state: () => [...fissures.values()].map((F) => ({ key: F.key, known: F.known, mesh: !!F.mesh, floor: !!F.floor, solid: !!F.colliderAt, own: F.ownLive, copies: F.pupLive, pending: F.pending, spawned: F.spawned, colossus: !!F.colossus, heart: [...F.heart] })),
    /** Everything let go (a load, a mode change, the season's end). */
    destroyAll() {
      for (const F of [...fissures.values()]) leave(F);
      if (barUp) { drawGateBossBar(null); barUp = false; }
    },
  };
}
