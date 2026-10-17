// @ts-check
// EG-F (2026-10-12, the Elite Gates arc, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections
// 5, 6.3 and 23): THE ARCH - an Elite Breach's door, standing in the open world. EG-PLAY had none (its departure 1: the
// call and `/breach` were the door); this is the page's arch, whole:
//
//   THE KEY'S REFUSALS (section 5, in the page's order - `egKeyRefusal`): cold; open sky; the Portal Stone's holds, the
//     water, a boat; a location's footprint; another breach near (a Dagon's Breach within EG_ARCH_GATE_NEAR_M, an arch
//     within EG_ARCH_NEAR_M); a breach held; the road shut; no room for the arch (`egArchPlace` - the Portal Stone's
//     portalPlace at its foot, and EG_ARCH_CLEAR_M clear about it).
//   THE ARCH (section 6.3): the gate's own model (world/gate/gateModel.js buildGateModel, Mac's Blender bake) at EG_ARCH_SCALE,
//     10.04 m tall, its skin the Spire's white marble inlaid with gold and cracked with the Warden's basalt
//     (world/gate/gateArt.js archArt, the gate's records' twins - EG_ARCH_RECORD_OF). It stands at the opener's feet, ahead
//     (portalPlace, PORTAL_AHEAD), facing the opener; it climbs out of the ground over GATE_RISE_MS from the opening, stands
//     sealed until the open, open until the first hall wakes (or the open window ends), and sinks over GATE_COLLAPSE_MS.
//     Its fire and its gold beacon (EG_ARCH_BEACON_UP_M over its foot) are the gate's pass's own, drawn with this arch's
//     per-draw values (render/gate/gatePass.js gatePassValues - `egArchDraw`).
//   WHO SEES IT: the company from the hub's call (`call`); everyone else on the opener's world cell from the opener's foes
//     frame (`ea`, `word`) - believed only near the opener's own feet, only when the hub's signature verifies
//     (net/eliteGates/egCallSig.js verifyEgCall), at most EG_ARCH_PER_CELL strangers' arches at once, and never past its window.
//     AUDIT EG V (lane4 L4-6): THE SITE IS THE OPENER'S WORD - the hub signs the site the open frame says (its shape alone
//     checked), and the key's refusals 2-5 and 8 are the opener's own screen's, so a modified client can stand a signed
//     arch anywhere: a stranger's screen draws it but stands no stone for it (standCollider) - no gate, road or door is
//     shut by one, and no body is moved out of one. Its own company's screens, which answer its call, stand its stone.
//   ITS DOOR: the company steps through its open fire (or presses it) - `onStep`, the answer; anyone else is told
//     "The breach answers only to <opener>'s company." Its plaque names it; a stranger's names the company too.
//   ITS CLEARING (world/gate/gateClearance.js gateClearSet - `clears`), ITS LANDING (world/gate/gateArena.js gateLandingFor, an arch
//     record), ITS MARKS: the compass, the held map, the sight line.
//
// THE POOL IS THE ARCHES' OWNER (EVERY ALLOCATION HAS AN OWNER): one mesh and its textures for every arch, a collider bucket
// an arch while it stands risen, all of it let go by `clear`. It is drawn through the gate's pool (scenes/gate/gatePool.js
// `arches`), whose frame, world pass and foreign pass the host already runs - no new statement in the host's frame.
//
// Pure helpers above the pool. Not a DFU member. Ledger A (ELITE-GATES).
import { buildGateModel, gateArchProfile, insideGateStone, GATE_ARCHIVE, GATE_HEIGHT, GATE_HALF_W, PORTAL_CENTRE_Y, ARCH_Y0, ARCH_Y1, EG_ARCH_RECORD_OF } from '../../world/gate/gateModel.js';
import { archArt } from '../../world/gate/gateArt.js';
import { gateSpinRate, BEACON_BELOW_M, BEACON_START_M } from '../../render/gate/gatePass.js';
import { GATE_RISE_MS, GATE_COLLAPSE_MS, PIXEL_M } from '../../net/gate/gateLaw.js';
import { portalPlace, PORTAL_GROUND_PROBE } from '../../systems/portalStone.js';
import { egTimes, egCountText, EG_TEXT } from '../../net/eliteGates/egLaw.js';
import { verifyEgCall } from '../../net/eliteGates/egCallSig.js';
import { egSite, EG_CALL_SG_RE, sanitizeName } from '../../net/wire.js';
import { gateLandingFor, GATE_LANDING_M } from '../../world/gate/gateArena.js';
import { openingHalfWidth, gateLocal, SEALED_AT, RISE_SLACK_M, GATE_OPEN_EASE, GATE_REACH, GATE_SAY_MS, GATE_STEP_M, GATE_LIGHT_RANGE } from '../gate/gatePool.js';
import { sightLineOf } from '../../world/spawnedDungeons.js';
import { directionHintString } from '../../systems/talk/talk.js';
import { trs } from '../../world/mat4.js';
import { RAY_DISTANCE } from '../../player/activate.js';

/** The arch is the gate at this scale (section 6.3): 10.04 m tall, 4.79 m to each side. */
export const EG_ARCH_SCALE = 0.62;
export const EG_ARCH_HEIGHT = GATE_HEIGHT * EG_ARCH_SCALE;
export const EG_ARCH_HALF_W = GATE_HALF_W * EG_ARCH_SCALE;
/** The room the arch wants (section 5, refusal 8): nothing standing within this of its foot, metres. */
export const EG_ARCH_CLEAR_M = 8;
/** Another breach near (section 5, refusal 5): a Dagon's Breach within this, or an Elite arch within the next (metres). */
export const EG_ARCH_GATE_NEAR_M = 300;
export const EG_ARCH_NEAR_M = 150;
/** How many strangers' arches a client stands at once (section 6.3: "at most two a cell"). */
export const EG_ARCH_PER_CELL = 2;
/** The beacon: gold, standing this far over its foot (half the gate's 800); its colour; the fire's tint toward gold. */
export const EG_ARCH_BEACON_UP_M = 400;
export const EG_ARCH_GOLD = Object.freeze([1.0, 0.78, 0.32]);
export const EG_ARCH_TINT = Object.freeze([1.0, 1.5, 0.75]);
/** The beacon's per-draw values (render/gate/gatePass.js gatePassValues): the gate's foot under the ground, a column reaching
 *  EG_ARCH_BEACON_UP_M over the ground, its light from the arch's own lintel (the gate's start, scaled with it). */
export const EG_ARCH_BEACON = Object.freeze({ below: BEACON_BELOW_M, height: BEACON_BELOW_M + EG_ARCH_BEACON_UP_M, start: BEACON_START_M * EG_ARCH_SCALE, color: EG_ARCH_GOLD });
/** The opener's landing before the arch (the gate's, scaled with it). */
export const EG_ARCH_LANDING_M = GATE_LANDING_M * EG_ARCH_SCALE;
/** ONLINE: the opener says its arch on its cell while standing this near it; a stranger believes one only this near the
 *  opener's own feet (a little more, for the pose's ease) - the Portal Stone's own reaches (metres). */
export const EG_ARCH_SAY_M = 32;
export const EG_ARCH_PEER_M = 40;
/** The sight line is said once an arch, when it first stands within this (metres). */
export const EG_ARCH_SIGHT_M = 800;
/** The held map's ring about an arch, map pixels. */
export const EG_ARCH_MAP_R = 0.75;
/** The collider's bucket for an arch's stone, and a press's key. */
export const egArchBucket = (b) => `egarch:${b}`;
export const egArchKey = (b) => `egarch:${b}`;

// ── the key's refusals (section 5) ─────────────────────────────────────────────────────────────────────────────
/**
 * THE KEY'S REFUSALS, IN THE PAGE'S ORDER - the first that stands, as its line, or null. `f` the host's facts:
 *   1 `online` false: cold (and `guest`: no account to stake from - the service's own refusal, said here first);
 *   2 `exterior` false: open sky;
 *   3 `hold` (the Portal Stone's portalHold word), `water`, `aboard`;
 *   4 `within` a location's name: inside its footprint;
 *   5 `nearGate` / `nearArch`: another breach near;
 *   6 `held` (a breach already, or an open in flight - `opening`);
 *   7 `shut` (the hub cannot open one, or its drain);
 *   8 `room` false: no room for the arch.
 * Pure.
 * @param {{ online?: boolean, guest?: boolean, exterior?: boolean, hold?: string|null, water?: boolean, aboard?: boolean, within?: string|null,
 *   nearGate?: boolean, nearArch?: boolean, held?: boolean, opening?: boolean, shut?: boolean, room?: boolean }} f
 */
export function egKeyRefusal(f) {
  if (!f?.online) return EG_TEXT.cold;
  if (f.guest) return EG_TEXT.guest;
  if (f.exterior === false) return EG_TEXT.sky;
  if (f.hold) return EG_TEXT.holds[f.hold] ?? EG_TEXT.holds.busy;
  if (f.water) return EG_TEXT.water;
  if (f.aboard) return EG_TEXT.aboard;
  if (f.within) return EG_TEXT.within(f.within);
  if (f.nearGate || f.nearArch) return EG_TEXT.near;
  if (f.held) return EG_TEXT.held;
  if (f.opening) return EG_TEXT.opening;
  if (f.shut) return EG_TEXT.shut;
  if (f.room === false) return EG_TEXT.room;
  return null;
}

/**
 * WHERE THE ARCH STANDS (section 6.3, refusal 8): the Portal Stone's own place ahead of the opener (portalPlace - short of
 * a wall, on the ground), turned to face the opener; then EG_ARCH_CLEAR_M clear about its foot - no wall across it either
 * way or before or behind it a metre up, and ground under both its feet within the probe. Answers `{ at, yaw }` (the
 * scene's), or `{ refused: 'room' }`. Pure over the host's two probes.
 * @param {number[]} feet @param {number} yaw the opener's facing
 * @param {{ ground?: ((o: number[], d: number[], m: number) => number|null|undefined)|null, wall?: ((o: number[], d: number[], m: number) => number|null|undefined)|null }} [probes]
 */
export function egArchPlace(feet, yaw, probes = {}) {
  const p = portalPlace(feet, yaw, probes);
  if (!p.at) return { refused: 'room' };
  const at = p.at, archYaw = wrapYaw(yaw + Math.PI);   // its fire faces the opener
  const across = [Math.cos(archYaw), 0, -Math.sin(archYaw)], along = [Math.sin(archYaw), 0, Math.cos(archYaw)];
  const o = [at[0], at[1] + 1, at[2]];
  if (probes.wall) for (const d of [across, along]) for (const s of [1, -1]) {
    const hit = probes.wall(o, [d[0] * s, 0, d[2] * s], EG_ARCH_CLEAR_M);
    if (Number.isFinite(hit)) return { refused: 'room' };
  }
  if (probes.ground) for (const s of [1, -1]) {
    const fx = at[0] + across[0] * EG_ARCH_HALF_W * s, fz = at[2] + across[2] * EG_ARCH_HALF_W * s;
    const d = probes.ground([fx, at[1] + 1, fz], [0, -1, 0], PORTAL_GROUND_PROBE);
    if (!Number.isFinite(d) || /** @type {number} */ (d) > PORTAL_GROUND_PROBE) return { refused: 'room' };
  }
  return { at, yaw: archYaw };
}
/** An angle in (-PI, PI]. */
const wrapYaw = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const r2 = (v) => Math.round(v * 100) / 100;

/**
 * THE ARCH'S SITE ON THE WIRE (net/wire.js egSite): its pixel `px, py`, its foot in that pixel's own frame - the scene
 * point less the pixel's translation `t` (world/streamingWorld.js pixelTranslation: x east, z north, the height the world
 * frame's) - and its turn. Every client stands it in its own scene the same way back (`egArchSceneAt`). Pure.
 * @param {number[]} at @param {number} yaw @param {number} px @param {number} py @param {number[]} t
 */
export const egArchSite = (at, yaw, px, py, t) => ({ px, py, x: r2(at[0] - t[0]), y: r2(at[1] - t[1]), z: r2(at[2] - t[2]), yaw: Math.round(wrapYaw(yaw) * 1e4) / 1e4 });
/** The site's foot in THIS scene (its pixel's translation now plus its place there). Pure. */
export const egArchSceneAt = (site, t) => [t[0] + site.x, t[1] + site.y, t[2] + site.z];
/** The arch record gateLandingFor takes (world/gate/gateArena.js): its site and its turn - the opener's landing before it. */
export const egArchLandingRecord = (site) => ({ px: site.px, py: site.py, spot: [site.x, site.z], yaw: site.yaw });
/** THE OPENER'S LANDING (section 6.4): before the arch, on the side its fire faces, turned away from it - gateLandingFor's
 *  own law over the arch's record, EG_ARCH_LANDING_M out. Null off the built ground. */
export const egArchLandingFor = (site, at) => (site ? gateLandingFor(egArchLandingRecord(site), at, EG_ARCH_LANDING_M) : null);

/**
 * THE CELL'S WORD, READ (a stranger's half): `{ b, o, os, op, ew, site, sg }` - the call's arch fields as the opener's foes
 * frame carries them (`ea`) - each in its law, or null (a field outside it refuses the word whole, wire.js's rule).
 * @param {unknown} raw
 */
export function validEgArchWord(raw) {
  const r = /** @type {any} */ (raw);
  if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
  if (typeof r.b !== 'string' || !/^[0-9a-f]{16}$/.test(r.b) || typeof r.os !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(r.os) || typeof r.o !== 'string') return null;
  if (!Number.isSafeInteger(r.op) || r.op <= 0 || !(r.ew === undefined || (Number.isSafeInteger(r.ew) && r.ew >= 0 && r.ew <= 999))) return null;
  const site = egSite(r.site);
  if (!site || typeof r.sg !== 'string' || !EG_CALL_SG_RE.test(r.sg)) return null;
  return { b: r.b, o: sanitizeName(r.o), os: r.os, op: r.op, ew: r.ew ?? 0, site, sg: r.sg };
}

/**
 * THE ARCH'S LIFE AT `now` (section 6.3), from its opening `op`: 'rising' over GATE_RISE_MS, 'sealed' to the open, 'open'
 * until `sinkAt` (the first hall's wake, its end, or the open window's end - the soonest), then 'sinking' over
 * GATE_COLLAPSE_MS; null before its opening and once it has sunk. `rise` how far it stands out of the ground (0..1, the
 * rise and the sink both), `open` whether its fire burns open. Pure.
 * @param {{ op: number, wk?: number, end?: number }} a @param {number} now
 */
export function egArchLife(a, now) {
  const T = egTimes({ openedAt: a.op });
  const sinkAt = Math.min(a.wk > 0 ? /** @type {number} */ (a.wk) : Infinity, a.end > 0 ? /** @type {number} */ (a.end) : Infinity, T.admitUntil);
  if (now < a.op || now >= sinkAt + GATE_COLLAPSE_MS) return null;
  const up = Math.min(1, (now - a.op) / GATE_RISE_MS), down = Math.max(0, (now - sinkAt) / GATE_COLLAPSE_MS);
  const rise = Math.max(0, Math.min(up, 1 - down));
  const phase = now >= sinkAt ? 'sinking' : up < 1 ? 'rising' : now < T.openAt ? 'sealed' : 'open';
  return { phase, rise, open: phase === 'open', sinkAt, openAt: T.openAt, admitUntil: T.admitUntil };
}

/**
 * THE ARCH IN THE SCENE: its foot (the ground under its site, the rise already in y - sunk whole before it climbs), its
 * turn, its fade, its life - or null when it stands nowhere. A pixel not built (no ground) is its beacon alone, at its
 * site's own height (the gate's GATE-SEEN law). Pure.
 * @param {{ op: number, wk?: number, end?: number, site: any }} a
 * @param {{ pixelTranslation: (px: number, py: number) => number[], heightAt: (x: number, z: number) => number, now: number }} at
 */
export function egArchPlacement(a, { pixelTranslation, heightAt, now }) {
  const life = a?.site ? egArchLife(a, now) : null;
  if (!life) return null;
  const t = pixelTranslation(a.site.px, a.site.py);
  const [x, y0, z] = egArchSceneAt(a.site, t);
  let ground = heightAt(x, z);
  const coarse = !Number.isFinite(ground);
  if (coarse) ground = y0;
  const eased = life.rise * life.rise * (3 - 2 * life.rise);
  const sunk = EG_ARCH_HEIGHT + RISE_SLACK_M;
  return { phase: life.phase, origin: [x, ground - (1 - eased) * sunk, z], ground, yaw: a.site.yaw, fade: life.rise, risen: life.rise >= 1, coarse, life };
}

/** THE ARCH'S DRAW RECORD for the gate's pass (render/gate/gatePass.js): the gate's record and this arch's per-draw values. */
export const egArchDraw = (place, open, spin) => ({
  origin: place.origin, yaw: place.yaw, open, fade: place.fade, spin, beaconOnly: !!place.coarse,
  scale: EG_ARCH_SCALE, tint: EG_ARCH_TINT, beacon: EG_ARCH_BEACON,
});

/** THE ARCH'S MODEL: the gate's, its sub-meshes on the arch's own records (EG_ARCH_RECORD_OF - the plinth's none). */
export function egArchModel(model = buildGateModel()) {
  return { ...model, subMeshes: model.subMeshes.map((sm) => (sm.textureArchive === GATE_ARCHIVE && EG_ARCH_RECORD_OF[sm.textureRecord] != null ? { ...sm, textureRecord: EG_ARCH_RECORD_OF[sm.textureRecord] } : sm)) };
}
/** The stone's matrix: the gate's trs, at the arch's scale. */
export const egArchMatrix = (p) => trs(p.origin[0], p.origin[1], p.origin[2], 0, (p.yaw * 180) / Math.PI, 0, EG_ARCH_SCALE, EG_ARCH_SCALE, EG_ARCH_SCALE);
/** A point in the arch's own frame at the GATE's scale (the gate's profile and stone answer it). */
const archLocal = (place, p) => { const [lx, ly, lz] = gateLocal(place, p); return [lx / EG_ARCH_SCALE, ly / EG_ARCH_SCALE, lz / EG_ARCH_SCALE]; };
/** Whether feet at `p` are sealed in the arch's stone (the gate's inGateRoot, at the arch's scale). */
export const egInArchRoot = (place, p) => { const [lx, ly, lz] = archLocal(place, p); return SEALED_AT.some((h) => insideGateStone([lx, ly + h / EG_ARCH_SCALE, lz])); };

/** AUDIT EG V (L6-4): the arch pool's answers with no arch standing - one each, never made a frame. */
const NO_CLEARS = Object.freeze([]), NO_LIST = Object.freeze([]);
/**
 * @param {{ renderer?: any, collider?: () => any, pixelTranslation: (px: number, py: number) => number[], heightAt: (x: number, z: number) => number,
 *   now: () => number, feet?: () => (number[]|null), me?: () => (string|null), say?: (text: string) => void, onStep?: (b: string) => void,
 *   landAt?: (l: any) => boolean, verifyKey?: () => Promise<CryptoKey|null>, subtle?: SubtleCrypto }} deps
 */
export function createEgArchPool({ renderer = null, collider = () => null, pixelTranslation, heightAt, now, feet = () => null, me = () => null,
  say = () => {}, onStep = () => {}, landAt = () => false, verifyKey = async () => null, subtle = globalThis.crypto?.subtle }) {
  const base = buildGateModel(), model = egArchModel(base), profile = gateArchProfile(base);
  /** @type {Map<string, any>} every arch this client stands, by breach: { b, o, os, op, ew, site, sg, mine, from, wk, end, place, open, spin, col, lastLz, said, saidAt } */
  const arches = new Map();
  /** @type {Map<string, Promise<boolean>|boolean>} the cell's words verified or being verified, by breach and signature */
  const verdicts = new Map();
  /** the breaches whose arch has sunk (or was taken down) - a word or a call of one said again stands nothing */
  const sunk = new Set();
  let mesh = null, meshTried = false;
  let clearsArr = NO_CLEARS, clearsKey = '';

  function ensureMesh() {
    if (mesh || meshTried || !renderer?.createMesh) return;
    meshTried = true;
    try {
      for (const [rec, art] of archArt()) {
        renderer.uploadTexture?.(GATE_ARCHIVE, rec, art.albedo);
        renderer.uploadEmissionTexture?.(GATE_ARCHIVE, rec, art.emission, { white: true });
      }
      mesh = renderer.createMesh(model);
    } catch (e) { console.warn('[eg] the arch would not build', e?.message ?? e); mesh = null; }
  }
  /** An arch's collider stood while it stands risen on built ground, taken down otherwise - AUDIT EG V (lane4 L4-6): my own
   *  company's alone (`mine`); a stranger's arch stands where its opener's word put it, and is no stone to me. */
  function standCollider(a) {
    const col = collider();
    if (!col?.addMesh) return;
    const want = a.mine && a.place?.risen && !a.place.coarse ? egArchMatrix(a.place) : null;
    const key = want ? Array.from(want, (v) => v.toFixed(3)).join(',') : null;
    if (key === a.col) return;
    col.removeBucket?.(egArchBucket(a.b));
    a.col = null;
    if (!want) return;
    col.addMesh(egArchBucket(a.b), model.positions, model.indices, want);
    a.col = key;
    // a body the stone stood up around is set down before it (the gate's AUDIT WBX W1 law)
    const f = feet();
    if (f && egInArchRoot(a.place, f)) { const l = egArchLandingFor(a.site, { pixelTranslation, heightAt }); if (l) landAt(l); }
  }
  function drop(a) {
    collider()?.removeBucket?.(egArchBucket(a.b));
    arches.delete(a.b);
    sunk.add(a.b);
  }
  /** Whether I am of an arch's company (the call I hold is its, and names me). */
  const ofCompany = (a) => !!a.mine;
  /** A refusal said, but not again inside GATE_SAY_MS. */
  function refuse(a, text) {
    const t = now();
    if (t - (a.saidAt ?? -Infinity) < GATE_SAY_MS) return;
    a.saidAt = t;
    say(text);
  }
  /** The door: the company's answer, or a stranger told whose it is. */
  function tryEnter(a) {
    if (!a.place || a.place.coarse) return false;
    if (!ofCompany(a)) { refuse(a, EG_TEXT.outside(a.o)); return false; }
    if (a.place.phase === 'open') { onStep(a.b); return true; }
    const left = a.place.life.openAt - now();
    refuse(a, left > 0 ? EG_TEXT.sealed(egCountText(left)) : EG_TEXT.late(a.o));
    return false;
  }
  const strangers = () => [...arches.values()].filter((a) => !a.mine);
  /** AUDIT EG V (L6-4): do the clearings stand for the arches placed now - the same breaches, as many - read in place? */
  function clearsSame() {
    let n = 0;
    for (const a of arches.values()) { if (!a.place) continue; n++; if (!clearsArr.some((q) => q.b === a.b)) return false; }
    return n === clearsArr.length;
  }
  const countdownWords = (a) => {
    const L = a.place?.life;
    if (!L) return '';
    const t = now();
    return L.phase === 'rising' || L.phase === 'sealed' ? `Opens in ${egCountText(L.openAt - t)}` : L.phase === 'open' ? `Open - ${egCountText(L.admitUntil - t)} to answer` : 'Sinking';
  };

  return {
    /**
     * THE COMPANY'S OWN ARCH, from the hub's call I hold (net/eliteGates/egLink.js state's `call`): stood as said - no signature asked
     * of the hub's own word - and kept to the breach's wake and end (`wk`, `end` - 0 none yet; the first said is kept, so a
     * sink once begun runs its course). A call gone (null - its window over and forgotten) sinks the arch from now, never
     * snuffs it; another breach's call takes the old arch down at once.
     * @param {any} c @param {{ wk?: number, end?: number }} [room]
     */
    call(c, { wk = 0, end = 0 } = {}) {
      const t = now();
      for (const a of arches.values()) {   // a Map's own walk: an arch dropped as it is read is safe
        if (!a.mine || (c && a.b === c.b)) continue;
        if (c) drop(a); else if (!(a.end > 0)) a.end = t;
      }
      if (!c?.site || !c.co?.some?.((r) => r[0] === me())) return;
      let a = arches.get(c.b);
      if (!a) {
        if (sunk.has(c.b) || !egArchLife({ op: c.op, wk, end }, t)) return;   // a call past its arch's life stands nothing again
        a = { b: c.b, o: c.o, os: c.os, op: c.op, ew: c.ew ?? 0, site: c.site, sg: c.sg ?? '', mine: true, from: null, wk: 0, end: 0, place: null, open: 0, spin: 0, col: null, lastLz: null, said: false };
        arches.set(c.b, a);
      }
      a.mine = true; a.sg = c.sg ?? a.sg;
      if (wk > 0 && !(a.wk > 0)) a.wk = wk;
      if (end > 0 && !(a.end > 0)) a.end = end;
    },
    /**
     * A STRANGER'S WORD (a peer's foes frame's `ea`): believed only near the opener's own feet (`from` - their feet in this
     * scene; none, no arch), one an opener, at most EG_ARCH_PER_CELL strangers' at once, and only once the hub's signature
     * verifies. Answers a promise of whether it stands.
     * @param {string} peer @param {unknown} raw @param {number[]|null} from
     */
    async heard(peer, raw, from) {
      const r = validEgArchWord(raw);
      if (!r || !from || r.os === me()) return false;
      const at = egArchSceneAt(r.site, pixelTranslation(r.site.px, r.site.py));
      if (Math.hypot(at[0] - from[0], at[2] - from[2]) > EG_ARCH_PEER_M) return false;
      const had = arches.get(r.b);
      if (had) return true;   // stood already (a word said again changes nothing it said)
      if (sunk.has(r.b)) return false;   // sunk already
      if (strangers().some((a) => a.from === peer)) return false;   // one an opener
      if (strangers().length >= EG_ARCH_PER_CELL) return false;
      if (!egArchLife({ op: r.op }, now())) return false;
      const vk = `${r.b}|${r.sg}`;
      let v = verdicts.get(vk);
      if (v === undefined) {
        v = (async () => { try { return await verifyEgCall(r, await verifyKey(), { subtle: /** @type {SubtleCrypto} */ (subtle) }); } catch { return false; } })();
        verdicts.set(vk, v);
      }
      const ok = await v;
      verdicts.set(vk, ok);
      if (!ok) return false;
      if (arches.has(r.b) || strangers().length >= EG_ARCH_PER_CELL || strangers().some((a) => a.from === peer)) return arches.has(r.b);   // re-read after the await
      arches.set(r.b, { ...r, mine: false, from: peer, wk: 0, end: 0, place: null, open: 0, spin: 0, col: null, lastLz: null, said: false });
      return true;
    },
    /** One frame: every arch placed, its fire eased, its collider stood, the step through its open fire. */
    frame(dt = 0) {
      // AUDIT EG V (L6-4): no arch, nothing made - the gate pool asks every exterior frame online (scenes/gate/gatePool.js)
      if (!arches.size) { if (clearsKey) { clearsKey = ''; clearsArr = NO_CLEARS; } return; }
      const t = now(), f = feet();
      let any = false;
      for (const a of arches.values()) {   // a Map's own walk: an arch dropped as it is read is safe
        a.place = egArchPlacement(a, { pixelTranslation, heightAt, now: t });
        if (!a.place) { if (t >= a.op) drop(a); continue; }
        any = true;
        const target = a.place.phase === 'open' ? 1 : 0;
        a.open += Math.sign(target - a.open) * Math.min(Math.abs(target - a.open), GATE_OPEN_EASE * Math.max(0, dt));
        a.spin = (a.spin + gateSpinRate(a.open) * Math.max(0, dt)) % 1;
        standCollider(a);
        // the step through the fire: the feet crossing its plane inside the opening, while it burns open
        if (f && !a.place.coarse && a.place.phase === 'open') {
          const [lx, ly, lz] = archLocal(a.place, f);
          const inside = Math.abs(lx) < openingHalfWidth(profile, Math.max(ARCH_Y0 + 0.05, ly + 0.9 / EG_ARCH_SCALE)) && Math.abs(lz) < GATE_STEP_M / EG_ARCH_SCALE;
          if (inside && a.lastLz !== null && Math.sign(lz) !== Math.sign(a.lastLz) && lz !== 0) tryEnter(a);
          a.lastLz = inside ? lz : null;
        } else a.lastLz = null;
      }
      if (any) ensureMesh();
      // the clearings, one stable list while the set stands (world/gate/gateClearance.js gateClearSet's members) - AUDIT EG V
      // (L6-4): its key made again only when the placed set moved
      if (!clearsSame()) {
        const placed = [...arches.values()].filter((a) => a.place);
        clearsKey = placed.map((a) => a.b).sort().join(',');
        clearsArr = clearsKey ? Object.freeze(placed.map((a) => Object.freeze({ b: a.b, px: a.site.px, py: a.site.py, x: a.site.x, z: a.site.z }))) : NO_CLEARS;
      }
    },
    /** The stones, in the host's world pass (the gate pool's draw). Answers how many. */
    draw(r = renderer, texRemap = null) {
      if (!mesh || !r?.drawMesh) return 0;
      let n = 0;
      for (const a of arches.values()) if (a.place && !a.place.coarse) { r.drawMesh(mesh, egArchMatrix(a.place), texRemap); n++; }
      return n;
    },
    /** The fires and beacons, as the gate's pass takes them (egArchDraw). */
    passDraws: () => (arches.size ? [...arches.values()].filter((a) => a.place).map((a) => egArchDraw(a.place, a.open, a.spin)) : NO_LIST),   // AUDIT EG V (L6-4): none made with no arch
    /** Whether any arch stands to be drawn. */
    stands() { for (const a of arches.values()) if (a.place) return true; return false; },
    /** Each fire's light over its threshold. */
    lights: () => (arches.size ? [...arches.values()].filter((a) => a.place && !a.place.coarse && a.place.fade > 0).map((a) => ({ x: a.place.origin[0], y: a.place.origin[1] + PORTAL_CENTRE_Y * EG_ARCH_SCALE, z: a.place.origin[2], range: GATE_LIGHT_RANGE * EG_ARCH_SCALE * a.place.fade * (0.5 + 0.5 * a.open) })) : NO_LIST),
    /** The eye's boxes: each risen arch's fire, turned with it (the gate pool's fireBox, at the arch's scale). */
    targets() {
      if (!arches.size) return NO_LIST;   // AUDIT EG V (L6-4)
      const out = [];
      for (const a of arches.values()) {
        const p = a.place;
        if (!p?.risen || p.coarse) continue;
        const w = Math.max(...profile) * EG_ARCH_SCALE, c = Math.cos(p.yaw), s = Math.sin(p.yaw), o = p.origin;
        const min = [Infinity, o[1] + ARCH_Y0 * EG_ARCH_SCALE, Infinity], max = [-Infinity, o[1] + ARCH_Y1 * EG_ARCH_SCALE, -Infinity];
        for (const lx of [-w, w]) for (const lz of [-0.5, 0.5]) {
          const x = o[0] + c * lx + s * lz, z = o[2] - s * lx + c * lz;
          min[0] = Math.min(min[0], x); max[0] = Math.max(max[0], x); min[2] = Math.min(min[2], z); max[2] = Math.max(max[2], z);
        }
        out.push({ key: egArchKey(a.b), aabb: { min, max }, distance: RAY_DISTANCE, reach: GATE_REACH, noSurface: true });
      }
      return out;
    },
    /** THE PLAQUE (World Tooltips, section 2): *Elite Breach*, sub *The Battlespire* - to anyone outside the company a
     *  second sub, *<opener>'s company* - and its countdown. */
    hoverName(key) {
      const a = typeof key === 'string' && key.startsWith('egarch:') ? arches.get(key.slice(7)) : null;
      if (!a?.place) return null;
      const words = countdownWords(a);
      return { title: EG_TEXT.name, subs: [EG_TEXT.plaqueSub, ...(ofCompany(a) ? [] : [EG_TEXT.company(a.o)]), ...(words ? [words] : [])] };
    },
    /** A press on an arch's fire. */
    activate(key) {
      const a = typeof key === 'string' && key.startsWith('egarch:') ? arches.get(key.slice(7)) : null;
      return a ? tryEnter(a) : false;
    },
    /** MY ARCH, FOR THE CELL (`ea` on my foes frame): the call's arch fields with the hub's signature, while my arch stands
     *  (risen or rising, its window not past) and I stand within EG_ARCH_SAY_M of it - else null. */
    word(near) {
      for (const a of arches.values()) {
        if (!a.mine || a.os !== me() || !a.sg || !a.place || a.place.phase === 'sinking' || !near) continue;
        if (Math.hypot(near[0] - a.place.origin[0], near[2] - a.place.origin[2]) > EG_ARCH_SAY_M) continue;
        return { b: a.b, o: a.o, os: a.os, op: a.op, ew: a.ew, site: a.site, sg: a.sg };
      }
      return null;
    },
    /** The arches' clearings (world/gate/gateClearance.js gateClearSet's members) - one list while the set stands. */
    clears: () => clearsArr,
    /** Whether an arch stands within `m` of feet `f` (refusal 5). */
    near(f, m = EG_ARCH_NEAR_M) { if (!f) return false; for (const a of arches.values()) if (a.place && Math.hypot(a.place.origin[0] - f[0], a.place.origin[2] - f[2]) <= m) return true; return false; },
    /** THE COMPASS (section 6.4): my company's arch, its scene XZ, while it stands - else null. */
    compass() { for (const a of arches.values()) if (a.mine && a.place) return [a.place.origin[0], a.place.origin[2]]; return null; },
    /** THE HELD MAP (section 2): my company's arch's mark while it stands - a ring on its own pixel (ui/gate/gateMapMark.js
     *  readGateMark's shape, `{ day, cx, cy, r, label, phase, tip }`) - else null. */
    mapMark() {
      for (const a of arches.values()) {
        if (!a.mine || !a.place) continue;
        const words = countdownWords(a);
        return { day: 0, cx: a.site.px + a.site.x / PIXEL_M, cy: a.site.py + 1 - a.site.z / PIXEL_M, r: EG_ARCH_MAP_R, label: EG_TEXT.name, phase: a.place.phase,
          tip: { title: EG_TEXT.name, lines: [EG_TEXT.company(a.o), ...(words ? [words] : [])] } };
      }
      return null;
    },
    /** THE SIGHT LINE (section 2): "You see an Elite Breach 140 metres to the North!" - once an arch, when it first stands
     *  within EG_ARCH_SIGHT_M of feet `f` (never my own: I stood it). Answers the lines to say. */
    sights(f) {
      const out = [];
      if (!f) return out;
      for (const a of arches.values()) {
        if (a.said || !a.place || a.os === me()) continue;
        const dx = a.place.origin[0] - f[0], dz = a.place.origin[2] - f[2], m = Math.hypot(dx, dz);
        if (m > EG_ARCH_SIGHT_M) continue;
        a.said = true;
        const way = directionHintString(dx, dz);
        out.push(sightLineOf(EG_TEXT.sight, m, way.charAt(0).toUpperCase() + way.slice(1)));
      }
      return out;
    },
    /** The opener's landing before the arch of breach `b` (or of any record carrying a site). */
    landing(b) { const a = arches.get(b); return a ? egArchLandingFor(a.site, { pixelTranslation, heightAt }) : null; },
    /** Every arch's placement (the tests and the probes). */
    get arches() { return arches; },
    /** A transition takes the arches' colliders down (the next frame stands them again where they belong). */
    downColliders() { for (const a of arches.values()) { collider()?.removeBucket?.(egArchBucket(a.b)); a.col = null; a.lastLz = null; } },
    /** A teardown: every arch, its collider and the mesh let go. */
    clear() {
      for (const a of [...arches.values()]) drop(a);
      if (mesh) { try { renderer?.destroyMesh?.(mesh); } catch { /* gone */ } }
      mesh = null; meshTried = false; verdicts.clear(); sunk.clear(); clearsArr = NO_CLEARS; clearsKey = '';
    },
  };
}
