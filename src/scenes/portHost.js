// @ts-check
// SHIPYARDS (2026-10-11): A PORT TOWN'S SHIPYARD AND LIGHTHOUSE, WHERE THEY STAND - the exterior host's pool on the
// yards' shape (scenes/merchantYardsHost.js): each place's timber and stone drawn in the host's world pass and standing
// in its collider, its people on the flats' axis, the eye's boxes and their names, the press - the shipmaster's window
// and the climb - and the lighthouse's lamp: a scene light in the lanterns' hours, and its glow and its sweeping beams as
// added light (render/navalRender.js's particles, the sea fight's own pass).
//
// WHERE: the host says (`sites`: each port place of every town built, its middle in the scene's x, z - world/portSites.js
// placed it, carried by the host's own frame - its turn, its name, its keepers), and the ground there is the host's
// (`groundAt`), read when a place moves (a floating-origin recentre, across or up) and every PORT_GROUND_EVERY frames.
// A place's collider bucket - its model and its people's boxes - is stood again when it moves, and held back while the
// player's feet stand on its ground as it first rises (AUDIT SET W1's law, the yards'): up the lighthouse's hollow tower
// and inside its lantern too (AUDIT SHIPYARDS L4-5: a body risen inside was sealed in), never for feet up on its gallery,
// which it must stand under. THE GALLERY'S GUARD (guardBand: a corridor from its floor lidded to the lantern's faces -
// L4-1: a climb, a boosted jump or a vault went over the railing the tower had then, a twenty-metre fall)
// stands in a bucket of its own only while the feet are on the gallery under its lid: always standing, its lid was a
// floor to a body coming down onto the gallery from over it.
//
// WHO STANDS IN IT: in the shipyard, the SHIPMASTER on his office's porch (his keeper's draw - systems/portPlaces.js
// portKeeper), the CREWMASTER behind the crew hall's table, three SAILORS looking for a berth at its open side and two
// SHIPWRIGHTS at the hull - one up on the scaffold; at the lighthouse, the LIGHTKEEPER by the tower's door. Each a person
// of the town's own race (the walkers' law, characters/mobile/mobilePerson.js walkerRace - the host hands it) in its idle
// record, one of the race's four outfits, the sailors' and the shipwrights' drawn off the place's key - every client
// stands the same people - and each offered its Morrowind body (AUDIT MW-NPC II's law for the yards' keepers).
//
// THE PRESS (the plaque's rows; a press with no row lit takes the first):
//  - the shipmaster, his SHIPS board, the hull on the stocks: Ships for sale, Your fleet, Shipwright, Refits - the
//    shipmaster's window on that page (the host's `open`);
//  - the crewmaster, the hall's CREW board, its notice board, a sailor: Sign on hands - the window's Crew Hall;
//  - the lightkeeper and the tower's door: Climb the tower - the keeper lets you up, and the host stands you on the
//    gallery (`climb`); the hatch on the gallery: Climb down;
//  - a shipwright: Info names him at his work; Steal takes nothing anywhere ("never takes an eye off his yard").
//
// THE LIGHT (`lights`, `glows`): in the lanterns' hours (the host's `lit`) the lamp - the beacon's fire (BEACON-TOWER:
// world/lighthouseModel.js) - is a scene light, its flames are drawn over its coals, and its glow and two
// beams turning BEAM_PERIOD_S a round are drawn as added light from as far as BEAM_SEEN_M - a light a captain sees from the
// sea - each lighthouse's beams on its own phase (off its key) of one clock every client reads alike, the wall clock's
// (AUDIT SHIPYARDS L4-6: each client's own frame clock turned each its own sweep); a puff the eye stands in fades (L7-12:
// from the gallery each sweep was a flash). The flames cast no shadow (L5-2's law: the glass that stood there shadowed
// its own light) and are no solid; the art's flame is a cutout, and the fire's two pictures their own light (PORT_HOW).
//
// A FRAME ALLOCATES NOTHING HERE (AUDIT SHIPYARDS L4-2, PERF-LIGHTS' law): the glows' records and the lights' are each
// place's own, written in place into one array each; a person's idle record turns its key only as its frame turns; the
// art is painted a few pictures a frame (L5-5), the meshes made once it is all up - the places stand in the collider
// meanwhile.
//
// NOTHING HERE IS SAVED OR SENT: where a place stands is the town's layout, who keeps it its map id.
//
// THE FOUR HOSTS (bible/Home.md): scenes/world.js - WIRED (each port town's build places them; the pool is made beside
// the yards', framed, drawn - in the street and in the view out of a window - its people on the flats' axis and in
// bodies, its lamp in the lights and its beams in the added pass, taken down at a re-anchor and a load; the Overworld's
// marks, the town map and the talk directory are handed its sites). scenes/worldModes.js - WIRED for the press both
// exterior hosts share (`portTargets` in the street's one ray, the `port:` arm with the too-far refusal and the
// plaque's lit row); its interiors stand no port. scenes/dungeonContext.js - stands no street: nothing here reaches it.
// scenes/exterior.js - FLAGGED: the single-town bench stands no port; the streaming host is where its towns are played.
//
// Not a DFU member. Ledger A (SHIPYARDS).
import { PORT_PLACES } from '../systems/portPlaces.js';
import { SHIPYARD_TEXT } from '../systems/shipyards.js';
import { PORT_FOOT } from '../world/portSites.js';
import { buildShipyardModel, SHIPYARD, shipsSignBox, hullBox, noticesBox, crewSignBox } from '../world/shipyardModel.js';
import { buildLighthouseModel, buildLighthouseFire, guardBand, LIGHTHOUSE, LIGHTHOUSE_POINTS, doorBox, hatchBox, lanternBox, GALLERY_Y, LANTERN_H } from '../world/lighthouseModel.js';
import { PORT_PAINTERS, PORT_ARCHIVE, PORT_HOW } from '../world/portArt.js';
import { dfLook, lookSeed } from '../world/dfLook.js';   // DF-LOOK: the port's pictures in Daggerfall's colours
import { wearPainted } from '../systems/studioArt/studioArt.js';   // STUDIO1: the studio's pictures over the painted ones (their rows top-down, as the port's are)
import { PERSON_TEXTURES, PERSON_IDLE_RECORD, PERSON_IDLE_FPS } from '../characters/mobile/mobilePerson.js';
import { mobileBillboardSize } from '../world/rmbFlats.js';
import { folkLookOf } from '../characters/folkBodies.js';
import { personActor } from '../characters/peopleBodies.js';
import { GENDERS } from '../characters/nameHelper.js';
import { textSeed } from '../systems/livingWorld/seed.js';
import { RAY_DISTANCE, STATIC_NPC_ACTIVATION_DISTANCE, presentNpcInfoText } from '../player/activate.js';
import { trs } from '../world/mat4.js';
import { yardToScene, yardBoxToScene, KEEPER_HALF, KEEPER_HEIGHT } from './merchantYardsHost.js';
import { boxTriangles } from './horseCartPool.js';
import { localAabb, transformedAabb } from '../render/frustum.js';
import { DECOR_DRAW, DECOR_SHADOW, DECOR_SKIP, castOnly } from './decor/decorRoom.js';
import { noteFirstUse } from '../systems/tutorials.js';   // TUT1: the lighthouse's page, at the first climb

/** The ground under a place is read again every this many frames. */
export const PORT_GROUND_EVERY = 30;
/** The press reaches the port's people and boards as it reaches a static NPC (StaticNPCActivationDistance, 6.4). */
export const PORT_REACH = STATIC_NPC_ACTIVATION_DISTANCE;
/** How far over each place's ground its Overworld mark stands - over the sheerlegs' head, over the roof's vane. */
export const PORT_MARK_LIFT = Object.freeze({ shipyard: 8.5, lighthouse: 24.5 });
/** A place's collider held back while the feet stand on its ground below this height over it (m): the shipyard's scaffold,
 *  and the lighthouse's whole hollow tower up to half a metre under its gallery (AUDIT SHIPYARDS L4-5: it stopped at 2.5 m,
 *  and a body levitating inside was sealed in as the tower stood) - never the gallery, which must stand under them. */
export const HOLD_BACK_UP = Object.freeze({ shipyard: 4.5, lighthouse: GALLERY_Y - 0.5 });
/** THE GALLERY'S GUARD stands once the feet are on the gallery inside its band, low enough that a body (player/motor.js
 *  CAPSULE_HEIGHT 1.8) stands under its lid - GUARD_HEADROOM under it - and stays while they are within its height over
 *  the gallery's floor and the parapet's reach. */
export const GUARD_HEADROOM = 1.95;
/** The lamp: its scene light's reach (m), and the office lantern's. */
export const LAMP_RANGE = 28;
export const OFFICE_LAMP_RANGE = 9;
/** THE BEAMS: a round every BEAM_PERIOD_S, each beam BEAM_LEN_M long in BEAM_PUFFS added puffs (laid closer near the lamp -
 *  quadratically - so they run together), growing from BEAM_SIZE0 to BEAM_SIZE1 across and fading from BEAM_ALPHA; drawn
 *  while the eye is within BEAM_SEEN_M of the lamp. The lamp's own glow: GLOW_NEAR_M across, never under GLOW_ANGLE of its
 *  distance (a few pixels at any range - shipWatch.js lampSize's law). */
export const BEAM_PERIOD_S = 14;
export const BEAM_LEN_M = 150;
export const BEAM_PUFFS = 18;
export const BEAM_SIZE0 = 1.6;
export const BEAM_SIZE1 = 28;
export const BEAM_ALPHA = 0.42;
export const BEAM_DIP = 0.035;
export const BEAM_SEEN_M = 2600;
export const GLOW_NEAR_M = 4;
export const GLOW_ANGLE = 0.012;
/** A beam's puff fades as the eye comes within BEAM_NEAR_FADE of its own size of its middle - none at half of it (the eye
 *  inside it: the whole screen added at once), whole at that (AUDIT SHIPYARDS L7-12). */
export const BEAM_NEAR_FADE = 1.5;
/** The art's painting: pictures a frame while this many ms of it are unspent (one at least). */
export const ART_BUDGET_MS = 4;
/** BEACON-TOWER: a picture's upload as a cutout and as its own light (world/portArt.js PORT_HOW), and the flames' draw -
 *  each one record, never a literal a call. */
const CUTOUT = Object.freeze({ cutout: true }), OWN_LIGHT = Object.freeze({ white: true }), NO_SHADOW = Object.freeze({ noShadow: true });
/** The lamp's light, in added light and in the scene's. */
export const LIGHTHOUSE_LAMP_COLOR = Object.freeze([1, 0.85, 0.55]);

/** The plaque's rows: the shipmaster's four pages, the crewmaster's one, the climb up and down. */
export const SHIPYARD_ROWS = Object.freeze([
  Object.freeze({ id: 'ships', label: 'Ships for sale' }),
  Object.freeze({ id: 'fleet', label: 'Your fleet' }),
  Object.freeze({ id: 'yard', label: 'Shipwright' }),
  Object.freeze({ id: 'refits', label: 'Refits' }),
]);
export const CREW_ROWS = Object.freeze([Object.freeze({ id: 'crew', label: 'Sign on hands' })]);
export const CLIMB_ROWS = Object.freeze([Object.freeze({ id: 'climb', label: 'Climb the tower' })]);
export const DOWN_ROWS = Object.freeze([Object.freeze({ id: 'down', label: 'Climb down' })]);
/** What the port's places say. */
export const PORT_TEXT = Object.freeze({
  steal: SHIPYARD_TEXT.steal,
  lightSteal: 'The lightkeeper keeps the beacon\'s oil under lock.',
  shut: 'The shipmaster\'s window will not open here.',
  noSail: SHIPYARD_TEXT.noSail,
  sailor: 'Looking for a berth. Ask the crewmaster to sign hands on.',
  worker: 'At work on the hull on the stocks.',
  lampLit: 'The beacon burns from dusk to dawn. It is lit.',
  lampDark: 'The beacon burns from dusk to dawn.',
  hatch: 'Down the tower\'s stair.',
  stair: 'The stair up to the beacon.',
  shutStair: 'The lightkeeper keeps the stair shut just now.',
  riding: 'No horse climbs a lighthouse stair. Go up on foot.',
  foes: 'The lightkeeper bars the door while enemies are about.',
});

const NONE = Object.freeze([]);
/** THE STAIR'S LAW (scenes/world.js climbLighthouse hands it what holds): its refusal's words, or null - neither off the
 *  street nor before the body stands; up on foot alone, never sailing, never with a foe about; down always (a gallery is
 *  never a trap). AUDIT SHIPYARDS L6-10: executed here, not read off world.js's text. Pure.
 *  @param {string} way @param {{ walking: boolean, onFoot: boolean, sailing: boolean, foes: boolean }} now */
export function stairRefusal(way, { walking, onFoot, sailing, foes }) {
  if (!walking) return PORT_TEXT.shutStair;
  if (way !== 'up') return null;
  if (!onFoot) return PORT_TEXT.riding;
  if (sailing) return PORT_TEXT.shutStair;
  return foes ? PORT_TEXT.foes : null;
}
/** Where the stair stands the feet (y): up, where the pool says (the gallery's floor); down, on the drawn ground at the
 *  door where it stands higher than the tower's middle (a slope) - `ground` the host's surface there. Pure. */
export const stairFeetY = (way, feetY, ground) => (way === 'down' && Number.isFinite(ground) ? Math.max(feetY, ground + 0.02) : feetY);
/** A person of a place's own: a sailor or a shipwright drawn off its key - their sex and outfit. Pure. */
export function folkOf(key, role, i) {
  const h = textSeed(`${key}|${role}|${i}`);
  const femaleShare = role === 'recruit' ? 0.35 : 0.15;
  return { sex: ((h >>> 4) & 0xff) / 256 < femaleShare ? 'female' : 'male', variant: (h >>> 13) & 3 };
}
/** Everyone a place stands: `{ role, i, at: [x, y, z] in its frame, sex, variant }`. Pure. */
export function peopleOf(site) {
  if (site?.kind === 'lighthouse') {
    const k = LIGHTHOUSE_POINTS.keeper;
    return [{ role: 'keeper', i: 0, at: [k[0], 0, k[2]], sex: site.keeper?.sex ?? 'male', variant: site.keeper?.variant ?? 0 }];
  }
  const P = SHIPYARD.points;
  return [
    { role: 'keeper', i: 0, at: [P.keeper[0], 0, P.keeper[1]], sex: site?.keeper?.sex ?? 'male', variant: site?.keeper?.variant ?? 0 },
    { role: 'crewmaster', i: 0, at: [P.crewmaster[0], 0, P.crewmaster[1]], sex: site?.crewmaster?.sex ?? 'male', variant: site?.crewmaster?.variant ?? 0 },
    ...P.recruits.map((p, i) => ({ role: 'recruit', i, at: [p[0], 0, p[1]], ...folkOf(site?.key ?? '', 'recruit', i) })),
    ...P.workers.map((p, i) => ({ role: 'worker', i, at: [p[0], p[2] ?? 0, p[1]], ...folkOf(site?.key ?? '', 'worker', i) })),
  ];
}
const T_ = LIGHTHOUSE.tower, G_ = LIGHTHOUSE.gallery, L_ = LIGHTHOUSE.lantern;
/** The lantern's top over the lighthouse's ground: its roof's point. */
const LANTERN_TOP = GALLERY_Y + LANTERN_H;
/** Feet `f` (the scene's) in a place's own frame, over its ground - [x, y, z] into `out`. */
function feetInFrame(site, at, f, out) {
  const a = (-(site.yaw ?? 0) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), dx = f[0] - at[0], dz = f[2] - at[2];
  out[0] = dx * c + dz * s; out[1] = f[1] - at[1]; out[2] = -dx * s + dz * c;
  return out;
}
const _ff = [0, 0, 0];
/** How far a point of the lighthouse's frame stands off its tower's axis. */
const axisR = (q) => { const x = q[0] - T_.x, z = q[2] - T_.z; return Math.sqrt(x * x + z * z); };
/** Whether feet `f` (the scene's) stand on a place's ground at its foot - its footprint, below HOLD_BACK_UP over it; or in
 *  a lighthouse's lantern, inside its arches, below its roof's point (a body risen up the hollow tower: AUDIT SHIPYARDS
 *  L4-5). Pure. */
export function feetInPort(site, at, f) {
  if (!site || !at || !f) return false;
  const q = feetInFrame(site, at, f, _ff), F = PORT_FOOT[site.kind];
  if (!F || Math.abs(q[0]) > F.hx || Math.abs(q[2]) > F.hz || q[1] + 1.8 <= -0.5) return false;
  if (q[1] < (HOLD_BACK_UP[site.kind] ?? 2.5)) return true;
  return site.kind === 'lighthouse' && axisR(q) < L_.r && q[1] < LANTERN_TOP;
}
/** Whether a lighthouse's gallery guard stands for feet `f` (the scene's) - `on` whether it stands now: it stands once they
 *  are on the gallery inside its band and under its lid by GUARD_HEADROOM, and stays while they are within its height and
 *  the parapet's reach (AUDIT SHIPYARDS L4-1). Pure. */
export function guardFor(site, at, f, on) {
  if (!site || !at || !f) return false;
  const q = feetInFrame(site, at, f, _ff), r = axisR(q), y = q[1];
  return on ? y > GALLERY_Y - 0.5 && y < GALLERY_Y + G_.guardH && r < G_.parapetR + 0.5
    : y > GALLERY_Y - 0.1 && y < GALLERY_Y + G_.guardH - GUARD_HEADROOM && r > L_.r && r < G_.parapetR - 0.08;
}
/** A beam's k-th puff (1..BEAM_PUFFS) from `lamp` along [dx, dz] written into `rec` (its `pos` and `size`) - answers its
 *  alpha. The beam's one law: beamPuffs's and the pool's glows'. */
function puffInto(rec, lamp, dx, dz, k) {
  const t = k / BEAM_PUFFS, d = BEAM_LEN_M * t * t;
  rec.pos[0] = lamp[0] + dx * d; rec.pos[1] = lamp[1] - BEAM_DIP * d; rec.pos[2] = lamp[2] + dz * d;
  rec.size = BEAM_SIZE0 + (BEAM_SIZE1 - BEAM_SIZE0) * t;
  return BEAM_ALPHA * (1 - t) ** 1.3;
}
/** How much of a puff of `size` with its middle `e` from the eye is drawn: none with the eye inside half its size, whole
 *  from BEAM_NEAR_FADE of it. Pure. */
export const nearFade = (e, size) => Math.min(1, Math.max(0, (e / size - 0.5) / (BEAM_NEAR_FADE - 0.5)));
/** A beam's puffs from `lamp` along the bearing `theta` (radians, scene yaw: forward [sin, 0, cos]) - `{ pos, size,
 *  alpha }` each, nearest first. Pure. */
export function beamPuffs(lamp, theta) {
  const out = [], dx = Math.sin(theta), dz = Math.cos(theta);
  for (let k = 1; k <= BEAM_PUFFS; k++) { const r = { pos: [0, 0, 0], size: 0, alpha: 0 }; r.alpha = puffInto(r, lamp, dx, dz, k); out.push(r); }
  return out;
}
/** A glow's record (render/navalRender.js's particle), the lamp's colour - each place's own, written in place. */
const glowRec = () => ({ pos: [0, 0, 0], size: 0, color: [LIGHTHOUSE_LAMP_COLOR[0], LIGHTHOUSE_LAMP_COLOR[1], LIGHTHOUSE_LAMP_COLOR[2], 0], rot: 0, blend: 'add', flat: false, solid: false, kind: 'lamp', aspect: 1 });
/** The distance between two points - Math.hypot's three arguments are an allocation a call in V8 (AUDIT SHIPYARDS L4-2). */
const dist3 = (a, b) => { const x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return Math.sqrt(x * x + y * y + z * z); };
/** A person's idle frame's record key, by frame - minted once each. */
const IDLE_KEYS = [];
const idleKey = (frame) => (IDLE_KEYS[frame] ??= `${PERSON_IDLE_RECORD}#${frame}`);

/**
 * @param {{
 *   renderer?: any, getTexture?: ((archive: number) => Promise<any>)|null,
 *   uploadRecordFrame?: ((archive: number, record: number, frame: number) => void)|null,
 *   sites: () => Array<any>, groundAt: (x: number, z: number) => number, collider?: () => any,
 *   feet?: () => (number[]|null), lit?: () => boolean, beamClock?: () => number,
 *   open?: (site: any, page: string) => boolean, climb?: (site: any, way: 'up'|'down', at: { feet: number[], yaw: number }) => (boolean|string),
 *   say?: (text: string) => void, midText?: (text: string) => void, now?: () => number,
 * }} deps  `sites` every port place standing this frame (`{ key, kind, x, z, yaw, comp, mapId, regionIndex, race, name,
 *   keeper, crewmaster?, crewName? }`, the scene's x, z); `lit()` the lanterns' hours; `open(site, page)` the shipmaster's
 *   window on its page; `climb(site, way, at)` the host's placing of the player (`at` the feet and yaw in the scene) -
 *   true, or its refusal's words; `beamClock()` the seconds the beams turn by - the wall clock's, alike on every client
 */
export function createPortHost({
  renderer = null, getTexture = null, uploadRecordFrame = null, sites, groundAt, collider = () => null,
  feet = () => null, lit = () => false, open = () => false, climb = () => false,
  say = () => {}, midText = () => {}, now = () => performance.now(), beamClock = () => Date.now() / 1000,
}) {
  /** @type {Map<string, any>} */
  const places = new Map();
  /** @type {Map<string, any>} */
  const meshes = new Map();
  /** @type {Map<string, any>} */
  const models = new Map();
  /** @type {Map<string, number[]>} */
  const boxes = new Map();
  let artAt = 0, artFrame = -1, guardMesh = null;
  const personTex = new Map();
  let frameN = 0;
  // the arrays handed out, written in place and cut to their count at the end (`length = 0` then pushes trimmed each
  // one's store and grew it again, every frame)
  const _batches = [], _targets = [], _lights = [], _glows = [];

  const MODELS = { shipyard: buildShipyardModel, lighthouse: buildLighthouseModel, fire: buildLighthouseFire };
  /** A kind's model (the beacon's flames their own, `fire`), built once. */
  const modelOf = (kind) => { let m = models.get(kind); if (!m) { m = MODELS[kind](); models.set(kind, m); } return m; };
  /** The art up, a few pictures a frame - once a frame, whichever place asks (AUDIT SHIPYARDS L5-5) - answers whether it
   *  is all up. */
  function paintArt() {
    if (artAt >= PORT_PAINTERS.length) return true;
    if (artFrame === frameN) return false;
    artFrame = frameN;
    const t0 = now();
    do {
      const [rec, paint] = PORT_PAINTERS[artAt++], pic = paint(), how = PORT_HOW[rec];
      wearPainted(PORT_ARCHIVE, rec, () => dfLook(pic, lookSeed(PORT_ARCHIVE, rec)), (art, { replaced, late }) => {   // STUDIO1: the studio's where an artist drew it
        if (late) { renderer.releaseTexture?.(PORT_ARCHIVE, rec); if (how?.glows) renderer.evictEmissionTexture?.(`${PORT_ARCHIVE}_${rec}`); }
        renderer.uploadTexture?.(PORT_ARCHIVE, rec, art, how?.cutout ? CUTOUT : undefined);   // BEACON-TOWER: the flame a cutout; DF-LOOK: in Daggerfall's colours
        if (how?.glows) renderer.uploadEmissionTexture?.(PORT_ARCHIVE, rec, replaced ? art : pic, OWN_LIGHT);   // ...and the fire its own light (its painted glow - the studio's picture is its own)
      }, { topDown: true });
    } while (artAt < PORT_PAINTERS.length && now() - t0 < ART_BUDGET_MS);
    return artAt >= PORT_PAINTERS.length;
  }
  function meshOf(kind) {
    if (meshes.has(kind)) return meshes.get(kind);
    if (!renderer?.createMesh) return null;
    try {
      if (!paintArt()) return null;
      meshes.set(kind, renderer.createMesh(modelOf(kind)));
      if (kind === 'lighthouse') meshes.set('fire', renderer.createMesh(modelOf('fire')));
    } catch (e) { meshes.set(kind, null); console.warn('[port] a place would not build', e?.message ?? e); }
    return meshes.get(kind);
  }
  function texOf(archive) {
    const had = personTex.get(archive);
    if (had && !(had instanceof Promise)) return had.failed ? null : had.tex;
    if (!had && getTexture) {
      personTex.set(archive, Promise.resolve().then(() => getTexture(archive)).then(
        (tex) => { personTex.set(archive, tex ? { tex } : { failed: true }); },
        (e) => { personTex.set(archive, { failed: true }); console.warn('[port] a person\'s picture', e?.message ?? e); }));
    }
    return null;
  }
  const archiveOf = (site, p) => {
    const T = PERSON_TEXTURES[site.race] ?? PERSON_TEXTURES.Breton;
    const set = T[p.sex === 'female' ? 'female' : 'male'];
    return set[(p.variant ?? 0) % set.length];
  };
  /** A place's box in the scene (the street's view test): its model's, under its matrix. */
  function boxOf(pl) {
    let b = boxes.get(pl.site.kind);
    if (!b) { b = localAabb(modelOf(pl.site.kind).positions); boxes.set(pl.site.kind, b); }
    return transformedAabb(b, pl.matrix);
  }
  /** The collider's geometry: the model and each person's box - in the place's frame. The beacon's flames are no solid. */
  function colliderGeometry(pl) {
    const parts = [modelOf(pl.site.kind)];
    for (const p of peopleOf(pl.site)) parts.push(boxTriangles([p.at[0] - KEEPER_HALF, p.at[1], p.at[2] - KEEPER_HALF], [p.at[0] + KEEPER_HALF, p.at[1] + KEEPER_HEIGHT, p.at[2] + KEEPER_HALF]));
    const count = parts.reduce((n, p) => n + p.positions.length, 0), icount = parts.reduce((n, p) => n + p.indices.length, 0);
    const positions = new Float32Array(count), indices = new Uint32Array(icount);
    const sight = parts.some((p) => p.sight) ? new Uint8Array(icount / 3) : null;   // FIELD BUGS 2026-10-25i SIGN-PASS: a model's hung signboard a ray's, no body's (merchantYardModels.js assemble)
    let v = 0, i = 0;
    for (const p of parts) {
      positions.set(p.positions, v);
      for (let j = 0; j < p.indices.length; j++) indices[i + j] = p.indices[j] + v / 3;
      if (sight && p.sight) sight.set(p.sight, i / 3);
      v += p.positions.length; i += p.indices.length;
    }
    return { positions, indices, sight };
  }
  function standCollider(pl) {
    const col = collider();
    if (!col?.addMesh) return;
    if (pl.colAt && pl.colAt[0] === pl.at[0] && pl.colAt[1] === pl.at[1] && pl.colAt[2] === pl.at[2]) return;
    const moved = pl.colAt !== null;
    if (pl.colAt) { col.removeBucket?.(pl.bucket); pl.colAt = null; }
    if (!moved && feetInPort(pl.site, pl.at, feet())) return;   // held back while the feet stand at its foot as it first rises
    const g = colliderGeometry(pl);
    col.addMesh(pl.bucket, g.positions, g.indices, pl.matrix, null, null, false, g.sight);   // SIGN-PASS: its boards met by rays, by no body
    pl.colAt = [pl.at[0], pl.at[1], pl.at[2]];
  }
  /** A lighthouse's gallery guard stood in its own bucket, or taken down, by where the feet `f` are (guardFor) - stood
   *  again under the model's matrix as the model is. */
  function guardFrame(pl, f) {
    const col = collider();
    if (!col?.addMesh) return;
    const on = pl.colAt !== null && (f ? guardFor(pl.site, pl.at, f, pl.guard !== null) : pl.guard !== null);
    if (on && pl.guard !== pl.colAt) {
      if (pl.guard) col.removeBucket?.(pl.guardBucket);
      const g = (guardMesh ??= guardBand());
      col.addMesh(pl.guardBucket, g.positions, g.indices, pl.matrix);
      pl.guard = pl.colAt;
    } else if (!on && pl.guard) { col.removeBucket?.(pl.guardBucket); pl.guard = null; }
  }
  function takeDown(key) {
    const pl = places.get(key);
    if (!pl) return;
    if (pl.guard) collider()?.removeBucket?.(pl.guardBucket);
    if (pl.colAt) collider()?.removeBucket?.(pl.bucket);
    for (const p of pl.people) if (p.batch) renderer?.destroyBillboardBatch?.(p.batch);
    places.delete(key);
  }
  function stand(site) {
    const pl = {
      site, key: site.key, bucket: `port:${site.key}`, guardBucket: `port:${site.key}:guard`, guard: null, at: null, matrix: null, colAt: null, box: null, targets: null,
      groundY: NaN, groundAt: [NaN, NaN, -Infinity, NaN], phase: (textSeed(String(site.key)) % 6283) / 1000,
      people: peopleOf(site).map((p) => ({ ...p, batch: null, origin: [0, 0, 0], frame: -1, keysOf: '', texKeys: [] })),
      lamp: [0, 0, 0], light: null, glow: null, seen: -1,
    };
    places.set(site.key, pl);
    return pl;
  }
  function posePeople(pl, t) {
    if (!renderer?.createBillboardBatch) return;
    for (const p of pl.people) {
      const archive = archiveOf(pl.site, p), tex = texOf(archive);
      if (!tex) continue;
      const frames = Math.max(1, tex.getFrameCount?.(PERSON_IDLE_RECORD) ?? 1);
      const frame = Math.floor((t / 1000) * PERSON_IDLE_FPS + p.i * 0.37) % frames;
      if (frame !== p.frame || !p.batch) {   // as its frame turns: its record, its picture's key (minted once a frame of its idle's) and its size (a settings read)
        p.frame = frame;
        const rkey = idleKey(frame), sz = mobileBillboardSize(tex, PERSON_IDLE_RECORD);
        if (p.keysOf !== archive) { p.keysOf = archive; p.texKeys = []; }
        if (!renderer.textures?.has?.(p.texKeys[frame] ??= `${archive}_${rkey}`)) uploadRecordFrame?.(archive, PERSON_IDLE_RECORD, frame);
        if (!p.batch) { p.batch = renderer.createBillboardBatch(archive, rkey, { w: sz.w, h: sz.h }, [[0, 0, 0]]); p.batch.origin = p.origin; p.batch.size = { w: sz.w, h: sz.h }; }
        p.batch.record = rkey; p.batch.size.w = sz.w; p.batch.size.h = sz.h;
      }
      yardToScene(pl.at, pl.site.yaw, p.at[0], p.at[1], p.at[2], p.origin);
    }
  }
  /** The key's place and what of it the key names. */
  function partOf(key) {
    if (typeof key !== 'string' || !key.startsWith('port:')) return null;
    const rest = key.slice(5), cut = rest.lastIndexOf('|');
    if (cut < 0) return null;
    const pl = places.get(rest.slice(0, cut));
    if (!pl?.at) return null;
    const [what, n] = rest.slice(cut + 1).split('.');
    return { pl, what, i: Number(n) || 0 };
  }
  /** A point of a lighthouse's frame in the scene, and the yaw that faces along its frame's `dir` ([x, z]). */
  const sceneYaw = (pl, dir) => {
    const a = (pl.site.yaw * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    return Math.atan2(dir[0] * c + dir[1] * s, -dir[0] * s + dir[1] * c);
  };
  const lampOf = (pl) => { const l = LIGHTHOUSE_POINTS.lamp; return yardToScene(pl.at, pl.site.yaw, l[0], l[1], l[2], pl.lamp); };
  const nameOf = (pl) => pl.site.name ?? PORT_PLACES[pl.site.kind]?.title ?? '';

  return {
    /** One frame: each place standing where its town is built, its ground, its collider, its people; the gone taken down. */
    frame() {
      frameN++;
      const list = sites?.() ?? NONE, t = now();
      let f;   // the feet, read once a frame there is a lighthouse
      for (const site of list) {
        if ((site?.kind !== 'shipyard' && site?.kind !== 'lighthouse') || !site.key) continue;
        const pl = places.get(site.key) ?? stand(site);
        pl.site = site; pl.seen = frameN;   // this frame's (a Set of the live keys was minted, and cleared, a frame)
        const comp = site.comp ?? 0, G = pl.groundAt;
        if (site.x !== G[0] || site.z !== G[1] || comp !== G[3] || !Number.isFinite(pl.groundY) || frameN - G[2] >= PORT_GROUND_EVERY) {
          pl.groundY = groundAt(site.x, site.z); G[0] = site.x; G[1] = site.z; G[2] = frameN; G[3] = comp;
        }
        if (!Number.isFinite(pl.groundY)) { if (pl.colAt) { collider()?.removeBucket?.(pl.bucket); pl.colAt = null; } pl.at = null; continue; }
        if (!pl.at || pl.at[0] !== site.x || pl.at[1] !== pl.groundY || pl.at[2] !== site.z) {
          pl.at = [site.x, pl.groundY, site.z];
          pl.matrix = trs(pl.at[0], pl.at[1], pl.at[2], 0, site.yaw, 0);
          pl.targets = null; pl.box = null;
        }
        meshOf(site.kind);
        standCollider(pl);
        if (site.kind === 'lighthouse') guardFrame(pl, f === undefined ? (f = feet()) : f);
        posePeople(pl, t);
      }
      for (const pl of places.values()) if (pl.seen !== frameN) takeDown(pl.key);   // a Map deletes its own entry under its walk
      return places.size;
    },
    /** Every place's timber and stone in the host's world pass - by the street's view test where it is handed (in view,
     *  drawn; off screen within a shadow's reach, cast alone; else neither). Answers how many it drew. */
    draw(r = renderer, cull = null) {
      if (!r?.drawMesh) return 0;
      let n = 0;
      for (const pl of places.values()) {
        if (!pl.at || !pl.matrix) continue;
        const v = cull ? cull(pl.box ??= boxOf(pl)) : DECOR_DRAW;
        if (v === DECOR_SKIP) continue;
        const mesh = meshes.get(pl.site.kind);
        if (!mesh) continue;
        (v === DECOR_SHADOW ? castOnly(r) : r).drawMesh(mesh, pl.matrix, null);
        if (v !== DECOR_DRAW) continue;
        const fire = pl.site.kind === 'lighthouse' && lit() ? meshes.get('fire') : null;   // BEACON-TOWER: the flames in the lanterns' hours
        if (fire) r.drawMesh(fire, pl.matrix, null, NO_SHADOW);   // the lamp's light stands in them (AUDIT SHIPYARDS L5-2)
        n++;
      }
      return n;
    },
    /** AUDIT MW-NPC II's law for the yards' keepers: each person offered their Morrowind body, in the outfit their own
     *  picture wears, off the place's key - turned to the eye as a standing person is. */
    offerBodies(offer, eyeAt, dt) {
      for (const pl of places.values()) {
        if (!pl.at) continue;
        for (const p of pl.people) {
          const b = p.batch;
          if (!b) continue;
          const archive = archiveOf(pl.site, p), race = pl.site.race ?? 'Breton', key = `${archive}|${race}`;
          if (p._mwLookKey !== key) {
            p._mwLookKey = key;
            p._mwLook = folkLookOf({ archive, personFaceRecordId: 0, gender: p.sex === 'female' ? GENDERS.Female : GENDERS.Male, guard: false }, race, textSeed(`${pl.key}|${p.role}|${p.i}`));
          }
          offer(personActor(p, p._mwLook, b.origin, eyeAt, dt), b);
        }
      }
    },
    /** The people, for the host's flats. */
    batches() {
      let n = 0;
      for (const pl of places.values()) if (pl.at) for (const p of pl.people) if (p.batch) _batches[n++] = p.batch;
      _batches.length = n;
      return _batches;
    },
    /** The eye's boxes: the shipyard's people, its two boards, its notice board and its hull; the lighthouse's keeper,
     *  its door, its hatch and its lamp - their reach a static NPC's beside the ray's. */
    targets() {
      let n = 0;
      for (const pl of places.values()) {
        if (!pl.at) continue;
        pl.targets ??= (() => {
          const out = [];
          const add = (what, b) => out.push({ key: `port:${pl.key}|${what}`, aabb: yardBoxToScene(pl.at, pl.site.yaw, b), distance: RAY_DISTANCE, reach: PORT_REACH });
          const person = (p) => [p.at[0] - KEEPER_HALF, p.at[1], p.at[2] - KEEPER_HALF, p.at[0] + KEEPER_HALF, p.at[1] + KEEPER_HEIGHT, p.at[2] + KEEPER_HALF];
          for (const p of pl.people) add(p.role === 'keeper' || p.role === 'crewmaster' ? p.role : `${p.role}.${p.i}`, person(p));
          if (pl.site.kind === 'shipyard') { add('sign', shipsSignBox()); add('crewsign', crewSignBox()); add('notices', noticesBox()); add('hull', hullBox()); }
          else { add('door', doorBox()); add('hatch', hatchBox()); add('lamp', lanternBox()); }
          return out;
        })();
        for (const tg of pl.targets) _targets[n++] = tg;
      }
      _targets.length = n;
      return _targets;
    },
    /** WORLD-HOVER: each part by its name and its keeper's, and its rows. */
    hoverName(key) {
      const p = partOf(key);
      if (!p) return null;
      const s = p.pl.site;
      if (s.kind === 'lighthouse') {
        if (p.what === 'hatch') return { title: 'The hatch', subs: [PORT_TEXT.hatch], actions: DOWN_ROWS.map((r) => ({ ...r })) };
        if (p.what === 'lamp') return { title: 'The beacon', subs: [nameOf(p.pl), lit() ? PORT_TEXT.lampLit : PORT_TEXT.lampDark], actions: [] };
        return { title: nameOf(p.pl), subs: [`${PORT_PLACES.lighthouse.keeper}: ${s.keeper?.name ?? ''}`, p.what === 'door' ? PORT_TEXT.stair : (lit() ? PORT_TEXT.lampLit : PORT_TEXT.lampDark)], actions: CLIMB_ROWS.map((r) => ({ ...r })) };
      }
      if (p.what === 'crewmaster' || p.what === 'crewsign' || p.what === 'notices') {
        return { title: s.crewName ?? PORT_PLACES.crewhall.title, subs: [`${PORT_PLACES.crewhall.keeper}: ${s.crewmaster?.name ?? ''}`, PORT_PLACES.crewhall.trade], actions: CREW_ROWS.map((r) => ({ ...r })) };
      }
      if (p.what === 'recruit') return { title: 'Sailor', subs: [PORT_TEXT.sailor], actions: CREW_ROWS.map((r) => ({ ...r })) };
      if (p.what === 'worker') return { title: 'Shipwright', subs: [PORT_TEXT.worker, nameOf(p.pl)], actions: [] };
      return { title: nameOf(p.pl), subs: [`${PORT_PLACES.shipyard.keeper}: ${s.keeper?.name ?? ''}`, PORT_PLACES.shipyard.trade], actions: SHIPYARD_ROWS.map((r) => ({ ...r })) };
    },
    /** A press: the plaque's lit row (`verb`), or a press with none the part's first; Info names who they are; Steal takes
     *  nothing. Answers whether it was the pool's. */
    activate(key, mode = 'grab', verb = null) {
      const p = partOf(key);
      if (!p) return false;
      const s = p.pl.site;
      if (verb == null && mode === 'info') {
        const who = p.what === 'keeper' ? `${s.keeper?.name ?? ''}, the ${PORT_PLACES[s.kind].keeper.toLowerCase()}`
          : p.what === 'crewmaster' ? `${s.crewmaster?.name ?? ''}, the ${PORT_PLACES.crewhall.keeper.toLowerCase()}`
          : p.what === 'recruit' ? 'a sailor looking for a berth' : p.what === 'worker' ? 'a shipwright at work' : nameOf(p.pl);
        say(presentNpcInfoText(who));
        return true;
      }
      if (verb == null && mode === 'steal') { midText(s.kind === 'lighthouse' ? PORT_TEXT.lightSteal : PORT_TEXT.steal); return true; }
      if (s.kind === 'lighthouse') {
        if (p.what === 'lamp') { say(lit() ? PORT_TEXT.lampLit : PORT_TEXT.lampDark); return true; }
        const down = p.what === 'hatch';
        const pt = down ? LIGHTHOUSE_POINTS.foot : LIGHTHOUSE_POINTS.gallery;
        const feetAt = yardToScene(p.pl.at, s.yaw, pt[0], pt[1] + (down ? 0 : 0.05), pt[2]);
        const yaw = sceneYaw(p.pl, down ? [0, 1] : [0, -1]);   // down: facing the town; up: facing the sea
        const r = climb(s, down ? 'down' : 'up', { feet: feetAt, yaw });
        if (r !== true) midText(typeof r === 'string' && r ? r : PORT_TEXT.shutStair);   // the host's refusal in its own words
        else if (!down) noteFirstUse('lighthouse');   // TUT1: the first climb pops the lighthouse's page
        return true;
      }
      if (p.what === 'worker') { say(presentNpcInfoText('a shipwright at work')); return true; }
      const crew = p.what === 'crewmaster' || p.what === 'crewsign' || p.what === 'notices' || p.what === 'recruit';
      const page = crew ? 'crew' : (SHIPYARD_ROWS.find((r) => r.id === verb)?.id ?? 'ships');
      if (!open(s, page)) midText(PORT_TEXT.shut);
      return true;
    },
    /** THE LAMP and the office lantern, in the lanterns' hours: scene lights `{ x, y, z, range }`. */
    lights() {
      let n = 0;
      if (lit()) for (const pl of places.values()) {
        if (!pl.at) continue;
        const L = (pl.light ??= { x: 0, y: 0, z: 0, range: 0, color: null }), at = pl.lamp;
        if (pl.site.kind === 'lighthouse') { lampOf(pl); L.range = LAMP_RANGE; }
        else { const o = SHIPYARD.lantern; yardToScene(pl.at, pl.site.yaw, o[0], o[1], o[2], at); L.range = OFFICE_LAMP_RANGE; }
        L.x = at[0]; L.y = at[1]; L.z = at[2];
        _lights[n++] = L;
      }
      _lights.length = n;
      return _lights;
    },
    /** THE LAMP'S GLOW AND ITS BEAMS, in the lanterns' hours, as render/navalRender.js's added particles - `t` the beams'
     *  clock's seconds (the wall clock's, every client's alike). Each place's records, written in place into one array
     *  (read them before the next call). */
    glows(eyeAt, t = beamClock()) {
      let n = 0;
      if (lit() && eyeAt) for (const pl of places.values()) {
        if (!pl.at || pl.site.kind !== 'lighthouse') continue;
        const l = lampOf(pl), d = dist3(l, eyeAt);
        if (d > BEAM_SEEN_M) continue;
        const G = (pl.glow ??= Array.from({ length: 1 + 2 * BEAM_PUFFS }, glowRec)), g0 = G[0];
        g0.pos[0] = l[0]; g0.pos[1] = l[1]; g0.pos[2] = l[2]; g0.size = Math.max(GLOW_NEAR_M, d * GLOW_ANGLE); g0.color[3] = 0.85;
        _glows[n++] = g0;
        const theta = pl.phase + (2 * Math.PI * (t % BEAM_PERIOD_S)) / BEAM_PERIOD_S;
        for (let b = 0; b < 2; b++) {
          const th = theta + b * Math.PI, dx = Math.sin(th), dz = Math.cos(th);
          for (let k = 1; k <= BEAM_PUFFS; k++) {
            const g = G[b * BEAM_PUFFS + k], a = puffInto(g, l, dx, dz, k);
            g.color[3] = a * nearFade(dist3(g.pos, eyeAt), g.size);
            _glows[n++] = g;
          }
        }
      }
      _glows.length = n;
      return _glows;
    },
    /** SHIPYARDS-FOUND: each place standing, as an Overworld mark - its name over it, its kind the look's (`yard
     *  shipyard`, `yard lighthouse` - ui/travel/travelViewHud.js yardGlyph: an anchor, a tower) and the Towns switch's. */
    overworldMarks() {
      const out = [];
      for (const pl of places.values()) {
        if (!pl.at) continue;
        out.push({ key: `port:${pl.key}`, at: [pl.at[0], pl.at[1] + (PORT_MARK_LIFT[pl.site.kind] ?? 6), pl.at[2]], label: nameOf(pl), kind: `yard ${pl.site.kind}` });
      }
      return out;
    },
    /** For the tests and the probes. */
    state: () => [...places.values()].map((pl) => ({ key: pl.key, kind: pl.site.kind, at: pl.at, collider: pl.colAt !== null, name: nameOf(pl), people: pl.people.filter((p) => p.batch).length })),
    /** The gallery's floor over a lighthouse's ground (for the probes and the host's climb). */
    galleryY: GALLERY_Y,
    /** A transition takes every place down: they are stood again by the next frame that finds their towns. */
    destroyAll() { for (const key of [...places.keys()]) takeDown(key); },
    /** The scene ends: the meshes freed too (EVERY ALLOCATION HAS AN OWNER). */
    dispose() {
      for (const key of [...places.keys()]) takeDown(key);
      for (const m of meshes.values()) if (m) renderer?.destroyMesh?.(m);
      meshes.clear(); artAt = 0; artFrame = -1;
    },
  };
}
