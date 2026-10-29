// @ts-check
// STOREFRONT (2026-10-29, the brief: "world changes with new dwemer enemies/boss/weapon"; bible/06-Systems/Battle-Pass.md
// section 6): THE SEASON IN THE WORLD - the pass bound and its notices said; the hourly tremor felt; each Brass Fissure near
// the player built, solid, breathing and humming, marked, its rock and grass kept off; its constructs on the camp law
// (wodShared.js brassSiteId), sprung by the first player near and seen by every other, as the rite's faithful; the Heart
// Fissure's Brass Colossus named on every screen by its site, its Resonant Maul to a striker once a day - the account
// service's day (server-account/src/seasonClaim.js, AUDIT LANE 5). The world host wires it on the bindings it shares with
// the Starfall (HOST-SPLIT). Online alone, on the relay's clock once heard. Not a DFU member. Ledger A (STOREFRONT).
import { bindPass } from '../systems/pass/passClient.js';
import { PASS_EVENT_TEXT, passGrantName, passChallengeText } from '../ui/passText.js';
import { seasonStageAt, tremorAt, stageFissures, fissureUnderGate, fissureRoster, COLOSSUS_MOBILE } from '../systems/pass/seasonWorld.js';
import { loadModRoads, MOD_ROADS } from '../world/roadsProducer.js';
import { TREMOR_TEXT, FISSURE_TEXT, COLOSSUS_TEXT } from '../systems/pass/seasonWords.js';
import { mintResonantMaul } from '../systems/pass/resonantMaul.js';
import { buildFissureModel, fissureVents, FISSURE_BARE_R } from '../world/fissureModel.js';
import { fissureArt, FISSURE_ARCHIVE } from '../world/fissureArt.js';
import { findGateSite } from '../systems/gate/gateSite.js';
import { gateAt } from '../net/gate/gateLaw.js';
import { promoteRaidLeader } from '../systems/eliteFoes.js';
import { giveBossTraits, bossWardShare, hasBossTrait } from '../systems/bossTraits.js';
import { playerDoor } from '../systems/playerDoor.js';
import { playStorefrontSound } from '../systems/storefrontSounds.js';
import { renownStruckAt } from '../net/renownTracker.js';
import { storedSession, accountSeasonMaul } from '../net/accountClient.js';
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
/** AUDIT LANE 5: Basic Roads' roads and tracks asked again this long after a load that failed (seasonWorld.js keeps the
 *  fissures off them, so none stands before they are read). */
export const SEASON_ROADS_RETRY_MS = 30_000;
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
 *  `rid`, `wait` and `roads`.
 *  @param {any} host */
export function createSeasonHost(host) {
  const renderer = host.renderer ?? null;
  const collider = () => host.collider ?? null;
  const now = () => Date.now() + (host._sharedOffsetMs ?? 0);
  const scan = () => host.gateScanOf?.(() => false) ?? null;
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

  // ── THE PASS, bound on the world's doors ──
  if (host.bindPass !== false) {
    bindPass({
      online, nowMs: now,
      onEvent: (e) => {
        if (e.kind === 'level') {
          setMidScreenText(PASS_EVENT_TEXT.level(e.level));
          if (e.grants?.length) tell(PASS_EVENT_TEXT.rewards(e.grants.map(passGrantName).join(', ')));
        } else if (e.kind === 'challenge') tell(PASS_EVENT_TEXT.challenge(passChallengeText(e.key)));
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
  /** the stage's fissures, made once a stage and a scan */
  const sites = { key: '', scan: null, roads: /** @type {any} */ (null), list: /** @type {ReadonlyArray<any>} */ (NONE) };
  /** the day's gate, found once a day over the same scan */
  const gate = { day: NaN, scan: null, site: null };
  const clears = { key: '', list: /** @type {any} */ (NONE) };
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
    if (!sc || rn === undefined) return sites.list;
    const key = `${at.n}.${at.stage}`;
    if (sites.key !== key || sites.scan !== sc || sites.roads !== rn) {
      sites.key = key; sites.scan = sc; sites.roads = rn;
      try { sites.list = Object.freeze(stageFissures(at.n, at.stage, sc, rn)); } catch (e) { console.warn('[season] no fissures', e?.message ?? e); sites.list = NONE; }
    }
    return sites.list;
  }
  function gateToday(t) {
    const sc = scan(), day = gateAt(t).day;
    if (gate.day !== day || gate.scan !== sc) { gate.day = day; gate.scan = sc; try { gate.site = sc ? findGateSite(day, sc) : null; } catch { gate.site = null; } }
    return gate.site;
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
      pending: 0, ownLive: 0, pupLive: 0, spawned: false, standAt: -Infinity, camp: null, colossus: null, counted: new WeakSet(), fellAt: NaN, live: NONE,
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
    let woke = false;
    roster.forEach(([career, site, colossus], i) => {
      const a = F.f.yaw + (i / roster.length) * 2 * Math.PI, r = colossus ? 3 : SEASON_RING_M[0] + (SEASON_RING_M[1] - SEASON_RING_M[0]) * ((i * 0.618) % 1);
      const x = F.heart[0] + Math.cos(a) * r, z = F.heart[2] + Math.sin(a) * r, y = groundAt(x, z);
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
    if (F.counted.has(fo)) return;
    F.counted.add(fo);
    F.fellAt = t;
    say(COLOSSUS_TEXT.falls());
    if (struckAt(fo) == null) return;
    void claimMaul().catch((e) => console.warn('[season] the Maul', e?.message ?? e));
  }
  /** The Maul asked of the service with one ask's id, asked again while no answer comes back (a lost answer is a yes to
   *  the same id, seasonClaim.js). Answers whether it was taken. */
  async function claimMaul() {
    const rid = ridOf();
    for (let i = 0; i < SEASON_MAUL_ASKS; i++) {
      if (i) await wait(SEASON_MAUL_ASK_MS);
      const a = await maulApi.claim(rid);
      if (a?.ok) {
        const item = mintResonantMaul();
        if (!item) return false;
        take(item);
        setMidScreenText(COLOSSUS_TEXT.maul());
        return true;
      }
      if (!(a?.error === 'offline' || a?.error === 'server' || (a?.status ?? 0) >= 500)) return false;   // a refusal: today's taken, the stage closed, no session
    }
    return false;
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
      if (!at || !online() || !heard()) { this.destroyAll(); return; }
      const f = feet();
      quake(t, f);
      const gateSite = gateToday(t), seen = new Set();
      for (const site of stageSites(at)) {
        const tr = pixelTranslation(site.px, site.py, T3);
        const hx = tr[0] + site.spot[0], hz = tr[2] + site.spot[1];
        const d = f ? Math.hypot(hx - f[0], hz - f[2]) : Infinity;
        let F = fissures.get(site.key);
        if (!F && d > SEASON_BUILD_M) continue;
        if (F && d > SEASON_BUILD_M * 1.2) { leave(F); continue; }
        F ??= enter(site);
        seen.add(site.key);
        if (fissureUnderGate(site, gateSite)) { dropCamp(F); dropBuild(F); continue; }   // it gives way to the day's gate
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
    /** The map's cards for the stage's fissures (ui/eventMapMarks.js's shape): each its name, its town and what waits at it. */
    mapMarks() {
      const t = now(), at = seasonStageAt(t);
      if (!at || !online() || !heard()) return NONE;
      const gateSite = gateToday(t);
      return stageSites(at).map((s) => {
        const title = s.hSite ? FISSURE_TEXT.heart() : FISSURE_TEXT.name();
        const lines = [FISSURE_TEXT.near(s.near), s.hSite ? FISSURE_TEXT.wakes() : FISSURE_TEXT.guards(), ...(fissureUnderGate(s, gateSite) ? [FISSURE_TEXT.quiet()] : [])];
        return { key: s.key, px: s.px, py: s.py, heart: !!s.hSite, label: `${title}, ${s.near}`, tip: { title, lines } };
      });
    },
    /** STAR-CLEAR's law for the fissures (world/gate/gateClearance.js gateClearSet's `fissures`): `{ f, px, py, x, z }` for
     *  every fissure of the stage - its key, its pixel and its heart there - the same frozen list while the stage stands. */
    fissureClears() {
      const at = seasonStageAt(now());
      const list = at && online() && heard() ? stageSites(at) : NONE;
      const key = list.length ? `${sites.key}:${list.length}` : '';
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
