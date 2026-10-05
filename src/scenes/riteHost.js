// @ts-check
// WB12d (2026-10-01, Mac: "faithful and a Summoner"; then "Btw I want to do all 4. We're going balls deep with this"):
// THE FAITHFUL'S RITE, IN THE WORLD. Each breach's circle (net/gateRite.js riteLocalOf) stands from the omen until the
// breach collapses: Dagon's sigil burned into the earth, its braziers alight, the altar and the faithful's casket
// (world/riteModel.js), their tents and fire, and a pillar of smoke over it until the breach opens (render/riteSmoke.js).
//
// ITS FAITHFUL - the Summoner and six to eight of Dagon's Faithful (riteFaithfulOf) - chant at it until disturbed, and
// one woken wakes them all (a camp's law, scenes/exteriorFoes.js). They are SHARED by the World of Daggerfall camps' law
// (world/wodShared.js): the first player to come within reach springs them and owns them, every other sees the owner's
// - one site, `px,py:rite.<day>`. Every screen knows the Summoner by his kind (a Sorcerer, RITE_SUMMONER_CAREER).
//
// AUDIT WB12d (C1, C2, C5): WHAT A CHARACTER SAW OF THEM IS THEIRS (systems/riteChest.js riteMemory, in the save) -
// which of the day's faithful fell, whether the Summoner did. The faithful are in no save themselves, so a circle stood
// again - after a teleport, a reload, a race lost and its winner gone - stands the survivors alone, never a fallen
// Summoner, and its lines are not said twice. A circle left takes my own down without giving its site away; a peer's
// that went quiet (RITE_ORPHAN_MS - its owner closed the page, travelled, walked off) is mine to stand again.
//
// A PLAYER AT THE CIRCLE says the rite's word to its cell every RITE_WORD_MS while the rite holds, and at once when it
// changes - and once more a moment after (AUDIT WB12d L4): whether they have struck one of the faithful, whether they
// have seen the Summoner fall (net/wire.js validRiteIn - the relay's cell judges where and when). When the breach opens,
// the faithful still standing pass into it. The hub's word that the rite is broken (net/wire.js validRiteOut) is
// believed for this screen's own circle alone (AUDIT WB12d R1), said once while the rite still holds, and opens the
// faithful's casket for each character once a day (systems/riteChest.js) - its contents a pile the casket holds.
//
// BROKER-CAGE (2026-10-02, Mac: "she should be present at the site in a jailed gate, and the gate opens after all the
// enemies are cleared"): the Sigil Broker is their prisoner, caged beside the circle (scenes/sigilBrokerPool.js). The
// rite's word says too whether this character has seen EVERY ONE of the faithful fall (net/gateRite.js riteRosterFell -
// the Summoner's fall the hub said counting as seen, AUDIT BROKER-CAGE C1); the hub's word that they all fell (`cl`) is
// kept by circle like the broken one, and once it is said none of the faithful is stood again - for this screen, or a
// page opened after - and copies of them standing are taken down (C13). `isCleared` is the cage's question.
//
// Online alone, on a relay that keeps the rite: offline there is no breach. Design: bible/11-Multiplayer/World-Bosses.md
// section 19 D.
//
// Not a DFU member. Ledger A (WB).
import { riteLocalOf, riteFaithfulOf, riteStands, riteWindow, riteRosterFell, RITE_REACH_M, RITE_CAREERS, RITE_FAITHFUL_MAX, RITE_SUMMONER_CAREER, RITE_SUMMONER_HEALTH, RITE_WORD_MS } from '../net/gateRite.js';
import { gateSpotLocal } from '../net/gateLaw.js';
import { worldRoom, GATE_TOP_MAX } from '../net/wire.js';
import { riteSiteId } from '../world/wodShared.js';
import { buildRiteModel, riteLayout, RITE_BRAZIER_H, RITE_BRAZIER_R, RITE_SIGIL_R, RITE_ALTAR } from '../world/riteModel.js';
import { gateArt, riteArt, GATE_ARCHIVE } from '../world/gateArt.js';
import { RiteSmokeRenderer, SMOKE_FADE_MIN } from '../render/riteSmoke.js';
import { FlatAnim } from '../render/flatAnimation.js';
import { GLOBAL_SCALE } from '../player/activate.js';
import { FIRE_FLAT, TENT_MODEL, FIRE_LIGHT_RANGE } from '../systems/survival/camp.js';
import { riteChestItems, riteChestOpened, markRiteChest, riteMemory, riteSeen } from '../systems/riteChest.js';
import { trs } from '../world/mat4.js';

const listOf = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0] ?? '');
/** Who broke it, as the Discord post names them (net/gateHerald.js ritePost): the first few, and how many more. */
const byWords = (by, n) => {
  const names = (Array.isArray(by) ? by : []).filter((x) => typeof x === 'string' && x).slice(0, GATE_TOP_MAX);
  const others = Number.isSafeInteger(n) ? Math.max(0, n - names.length) : 0;
  return names.length ? `, by ${listOf([...names, ...(others ? [`${others} other${others === 1 ? '' : 's'}`] : [])])}` : '';
};

/** The rite's words - each one thing. */
export const RITE_TEXT = Object.freeze({
  /** the hub's word of this screen's circle, while the rite holds (AUDIT WB12d D4: the Discord post's own sentence) */
  broken: ({ near, by = [], n = 0 }) => `The faithful's rite is broken near ${near}${byWords(by, n)}.`,
  /** the opening, to a player near the faithful still standing - broken or not (AUDIT WB12d D6) */
  pass: 'The faithful pass into the breach.',
  /** a press on the casket before the rite is broken */
  sealed: 'Sealed by the faithful\'s rite.',
  chest: 'The Faithful\'s Chest',
  sealedSub: 'Sealed',
  openedSub: 'Opened',
  summoner: 'the Summoner',
  faithful: 'Dagon\'s Faithful',
  /** AUDIT WB12d (C15): their mark on the Overworld (world/campShared.js campLabel's shape), and the attack's question */
  mark: (n) => (n === 1 ? 'Dagon\'s Faithful' : `Dagon's Faithful, ${n}`),
  markAsk: (n) => (n === 1 ? 'Dagon\'s Faithful' : `Dagon's Faithful (${n})`),
});

/** The faithful are sprung by a player this near the circle (World of Daggerfall's marker reach); the opening's line is
 *  said to a player this near. */
export const RITE_SPRING_M = 100;
/** AUDIT WB12d (L4): a word is said from this near - inside the relay's own reach (RITE_REACH_M), so a pose a frame
 *  behind the feet is never refused at the edge. */
export const RITE_SAY_REACH_M = RITE_REACH_M - 5;
/** AUDIT WB12d (L4): a word that changed is said once more this long after - the relay's bucket may have dropped it. */
export const RITE_RESAY_MS = 1000;
/** The faithful see this far while they chant - they are lost in the rite until disturbed. */
export const RITE_SIGHT_M = 12;
/** One woken wakes every one of the faithful this near it (the camp's own law). */
export const RITE_ALERT_M = 30;
/** AUDIT WB12d (C2): a peer's faithful nobody has spoken for this long, none of them standing here: gone with their
 *  owner - mine to stand again. Five of the owner's full frames (net/online.js FOES_FULL_MS). */
export const RITE_ORPHAN_MS = 10_000;
/** A stand that stood nothing (no ground under them, a full pool) is tried again this long after. */
export const RITE_RESTAND_MS = 5000;
/** The faithful are tended - named, counted, woken - for a player this near (a camp's cull: no copy is nearer). */
export const RITE_TEND_M = 200;
/** The casket's pile is seeded for a player this near it, and the circle's lights reach this far. */
export const RITE_CHEST_SEED_M = 40;
export const RITE_LIGHT_REACH_M = 70;
/** AUDIT WB12d (G7): THE CIRCLE'S LIGHT - its braziers' glow, one light at its heart reaching past them, and the
 *  camp's fire its own: two that stay, where the nearest three of seven changed as a player walked round it. */
export const RITE_GLOW_RANGE = RITE_BRAZIER_R + 6;
/** The smoke fades in over this many ms from the omen, and thins over this many after the opening. */
export const RITE_SMOKE_IN_MS = 8000;
export const RITE_SMOKE_OUT_MS = 30000;
/** AUDIT WB12d (G1): the ground under the circle is read again every this many frames - its pixel built finer moves
 *  it - and the stone made again when any point of it moved more than this, metres. */
export const RITE_GROUND_EVERY = 15;
export const RITE_GROUND_TOL = 0.01;
/** AUDIT WB12d (G2): the burned earth no grass grows on - the sigil and its braziers, metres from the heart. */
export const RITE_BARE_R = RITE_BRAZIER_R + 1;
/** AUDIT WB12d (G4): the collider's bucket - the altar, the casket and the braziers (the sigil is the ground's). */
export const RITE_BUCKET = 'wb:rite';
/** AUDIT WB12d (G6): the sigil is drawn for an eye this near its heart - from further its few centimetres over the
 *  ground fought the land's depth (the travel view's above all), and the smoke marks the circle from there. */
export const RITE_SIGIL_DRAW_M = 250;
/** AUDIT WB12d (G19): the braziers' and the altar's flames at this share of a camp fire's (the camp's fire is a camp
 *  fire's own, scenes/camps.js), and the flames in this many batches, each a share of their cycle on from the last -
 *  a ring of fires flickering as one read as one fire. */
export const RITE_FLAME_SCALE = 0.8;
export const RITE_FLAME_PHASES = 3;
/** The hub's broken words kept, by circle. */
const BROKEN_KEPT = 8;

/** No circle, no garbage (AUDIT WB C7, the gate's law): the one empty list. */
const NONE = Object.freeze([]);
/** A circle by its day and its pixel - the hub's word names one. */
const circleKey = (d, px, py) => `${d}:${px},${py}`;
/** Where its ground is read (the circle's frame, [x, z] pairs): its heart, its braziers, its sigil's rim and middle, the
 *  casket, the tents and the fire - every place its stone, its flames and its lights stand on. */
function groundSamples(L) {
  const pts = [[0, 0], ...L.braziers, [L.casket.x, L.casket.z], ...L.tents.map((t) => [t.x, t.z]), L.fire];
  for (let i = 0; i < 12; i++) pts.push([Math.sin((i / 12) * 2 * Math.PI) * RITE_SIGIL_R, Math.cos((i / 12) * 2 * Math.PI) * RITE_SIGIL_R]);
  for (let i = 0; i < 6; i++) pts.push([Math.sin(((i + 0.5) / 6) * 2 * Math.PI) * RITE_SIGIL_R * 0.5, Math.cos(((i + 0.5) / 6) * 2 * Math.PI) * RITE_SIGIL_R * 0.5]);
  return Float64Array.from(pts.flat());
}

/**
 * @param {{
 *   renderer?: any, gl?: WebGL2RenderingContext|null, meshes?: any, getTexture?: ((archive: number) => Promise<any>)|null,
 *   uploadRecordFrame?: ((archive: number, record: number, frame: number) => void)|null, collider?: (() => any)|null,
 *   now: () => number, omen?: () => any, fellAt?: (day: number) => (number|null),
 *   pixelTranslation: (px: number, py: number, out?: number[]) => number[],
 *   groundAt?: (x: number, z: number) => number, coarseGround?: ((px: number, py: number, x: number, z: number) => number)|null,
 *   feet?: () => number[]|null, online?: () => boolean, onBare?: (x0: number, z0: number, x1: number, z1: number) => void,
 *   foes?: { spawn: (career: number, xz: number[], o: { yaw: number, site: string, transient: boolean }) => Promise<any>, list: () => any[], drop: (site: string) => void, remove: (foe: any) => void, reclaim?: (site: string) => void, campId: () => number }|null,
 *   peerSprang?: (site: string) => boolean, peerHeldAgo?: (site: string) => number, forgetPeer?: (site: string) => void,
 *   sprang?: (site: string) => void, unsprang?: (site: string) => void, struckAt?: (foe: any) => (number|null),
 *   send?: (word: any, cell: string) => boolean, say?: (text: string) => void, sayNear?: (text: string) => void,
 *   loot?: { seed: (items: any[], feet: number[], pixelKey: string) => any, keyOf?: (pile: any) => string }|null, level?: () => number, rolls?: () => number,
 * }} deps
 */
export function createRiteHost({
  renderer = null, gl = null, meshes = null, getTexture = null, uploadRecordFrame = null, collider = null,
  now, omen = () => null, fellAt = () => null, pixelTranslation, groundAt = () => NaN, coarseGround = null, feet = () => null, online = () => false, onBare = () => {},
  foes = null, peerSprang = () => false, peerHeldAgo = () => 0, forgetPeer = () => {}, sprang = () => {}, unsprang = () => {}, struckAt = () => null,
  send = () => false, say = () => {}, sayNear = () => {}, loot = null, level = () => 1, rolls = Math.random,
}) {
  /** the day's circle, or null (enter's shape) */
  let C = null;
  // the art: the stone's model (the collider's too) and the sigil's, and their meshes, each made for one ground; the
  // tents' and the fire's art; the flames; the smoke's pass; the collider stood for one heart
  let model = null, sigilModel = null, modelGen = -1, modelFailedGen = -1, mesh = null, sigilMesh = null, meshGen = -1, meshFailedGen = -1, artUp = false;
  let tent = null, tentTried = false;
  let fire = null, fireTried = false, flamesGen = -1, flamesList = NONE, anim = null;
  let smokePass = null, smokeTried = false;
  let colliderGen = -1;
  /** made once a heart and a ground: the stone's and the tents' matrices, the casket's target */
  let madeAt = null, mats = null, target = null;
  /** AUDIT WB12d (G7): the circle's two lights, moved in place (AUDIT WB12d C13: no list a frame) */
  const lightPts = Object.freeze([{ x: 0, y: 0, z: 0, range: RITE_GLOW_RANGE }, { x: 0, y: 0, z: 0, range: FIRE_LIGHT_RANGE }]);
  const smoke = { origin: null, fade: 0 }, smokeList = Object.freeze([smoke]);
  const bare = { x: 0, z: 0, r: RITE_BARE_R, key: '' };
  /** the hub's word: the circles whose rite is broken, by circleKey - who broke it, and how many */
  const brokenWords = new Map();
  /** BROKER-CAGE: the hub's word: the circles whose faithful every one fell, by circleKey - and when it was said (relay
   *  ms; 0 unknown) */
  const clearedWords = new Map();
  /** AUDIT BROKER-CAGE C7: the cage's question's circle, its key made once (the Broker asks it every frame she is caged) */
  let qDay = NaN, qPx = NaN, qPy = NaN, qKey = '';
  const keyFor = (d, px, py) => { if (d !== qDay || px !== qPx || py !== qPy) { qDay = d; qPx = px; qPy = py; qKey = circleKey(d, px, py); } return qKey; };
  let frameN = 0;
  const T3 = [0, 0, 0];

  function enter(s) {
    leave();
    const [e, n] = riteLocalOf(s.day), [gx, gz] = gateSpotLocal(s.day);
    const facing = Math.atan2(gx - e, gz - n), layout = riteLayout(facing), samples = groundSamples(layout);
    C = {
      day: s.day, px: s.px, py: s.py, near: s.near ?? null, site: riteSiteId(s.px, s.py, s.day), cell: worldRoom(s.px, s.py),
      key: circleKey(s.day, s.px, s.py), win: riteWindow(s.day),
      local: [e, n], facing, layout, heart: [0, 0, 0], known: false,
      samples, sig: new Float64Array(samples.length / 2).fill(NaN), sampledAt: -Infinity, gen: 0, groundGen: 0,
      bared: false, spawned: false, standAt: -Infinity, pending: 0, retry: [], camp: null, ownLive: 0, pupLive: 0, counted: new Set(),
      passed: false, wordAt: -Infinity, saidKey: -1, resayAt: Infinity,
      pile: null, snap: null,
    };
  }
  /** The circle let go: my own faithful taken down - the site still mine to stand again, and said to be nobody's
   *  (AUDIT WB12d C1: a teleport had given it away for the page's life) - and its art freed (AUDIT WB12d C10). */
  function leave() {
    if (C) { foes?.drop(C.site); unsprang(C.site); }
    if (C?.bared) { placeHeart(); bareSaid(); }   // the grass grows back where it stood - its heart where the scene has it now
    dropFlames();
    if (mesh) { renderer?.destroyMesh?.(mesh); mesh = null; }
    if (sigilMesh) { renderer?.destroyMesh?.(sigilMesh); sigilMesh = null; }
    if (colliderGen !== -1) { collider?.()?.removeBucket?.(RITE_BUCKET); colliderGen = -1; }
    model = null; sigilModel = null; modelGen = modelFailedGen = meshGen = meshFailedGen = flamesGen = -1;
    C = null; madeAt = null; mats = null; target = null;
  }
  /** The circle's heart in the scene this frame (a recentre moves it), on its ground - the coarse ground where its pixel is
   *  not built, and `known` only on the built one. */
  function placeHeart() {
    const t = pixelTranslation(C.px, C.py, T3);
    const x = t[0] + C.local[0], z = t[2] + C.local[1];
    let y = groundAt(x, z);
    C.known = Number.isFinite(y);
    if (!C.known) y = coarseGround ? coarseGround(C.px, C.py, x, z) : NaN;   // the scene's point (world.js gateGroundAt)
    C.heart[0] = x; C.heart[1] = Number.isFinite(y) ? y : t[1]; C.heart[2] = z;
  }
  /** AUDIT WB12d (G2): the burned earth's box, to the host (its grass placed there before the circle stood, or after it
   *  went, is placed again). */
  const bareSaid = () => onBare(C.heart[0] - RITE_BARE_R, C.heart[2] - RITE_BARE_R, C.heart[0] + RITE_BARE_R, C.heart[2] + RITE_BARE_R);
  /** The ground over the heart's at a point of the circle's frame (0 where nothing answers). */
  const heightAt = (lx, lz) => { const y = groundAt(C.heart[0] + lx, C.heart[2] + lz); return Number.isFinite(y) ? y - C.heart[1] : 0; };
  /** A point of the circle's frame, in the scene, on its ground. */
  const sceneAt = (lx, lz) => [C.heart[0] + lx, C.heart[1] + heightAt(lx, lz), C.heart[2] + lz];
  /** What stands at the heart, made again when it moves (a recentre) or its ground does - AUDIT WB12d (G1): a circle
   *  first built on the far ring's coarse ground kept it, its sigil buried and its flames in the air, once its pixel
   *  was built whole. `gen` counts the makes, `groundGen` the grounds. */
  function made() {
    const h = C.heart;
    const moved = !madeAt || madeAt[0] !== h[0] || madeAt[1] !== h[1] || madeAt[2] !== h[2];
    let ground = false;
    if (moved || frameN - C.sampledAt >= RITE_GROUND_EVERY) {
      C.sampledAt = frameN;
      const s = C.samples, sig = C.sig;
      for (let i = 0; i < sig.length; i++) {
        const v = heightAt(s[2 * i], s[2 * i + 1]);
        if (!(Math.abs(v - sig[i]) <= RITE_GROUND_TOL)) { ground = true; sig[i] = v; }
      }
    }
    if (!moved && !ground) return;
    if (ground) C.groundGen++;
    C.gen++;
    madeAt = [h[0], h[1], h[2]];
    mats = { stone: trs(h[0], h[1], h[2], 0, 0, 0), tents: C.layout.tents.map((tt) => { const p = sceneAt(tt.x, tt.z); return trs(p[0], p[1], p[2], 0, (tt.yaw * 180) / Math.PI, 0); }) };
    const c = C.layout.casket, p = sceneAt(c.x, c.z);
    target = [{ key: `rite:${C.day}`, aabb: { min: [p[0] - 0.6, p[1], p[2] - 0.6], max: [p[0] + 0.6, p[1] + 0.8, p[2] + 0.6] }, distance: 3.2, reach: 3.2 }];
    const fp = sceneAt(C.layout.fire[0], C.layout.fire[1]);
    Object.assign(lightPts[0], { x: h[0], y: h[1] + RITE_BRAZIER_H + 0.4, z: h[2] });
    Object.assign(lightPts[1], { x: fp[0], y: fp[1] + 0.6, z: fp[2] });
  }

  /** The hub's word for this circle: who broke it, or undefined (AUDIT WB12d R1: another circle's word is not this one's). */
  const brokenHere = () => (C ? brokenWords.get(C.key) : undefined);
  /** BROKER-CAGE: whether the hub said this circle's faithful every one fallen. */
  const clearedHere = () => !!C && clearedWords.has(C.key);
  const ownSite = (f) => !!f && f.site === C.site;

  // ── the faithful ──
  /** Which of the day's faithful stand: every one this character has not seen fall - never the Summoner once he fell,
   *  nor once the hub says his rite is broken; BROKER-CAGE: and none once the hub says they all fell. [member, its index]
   *  - its index its place on the ring. */
  function survivors() {
    if (clearedHere()) return [];
    const mem = riteMemory(C.day), left = { ...mem.slain }, out = [];
    riteFaithfulOf(C.day).forEach((m, i) => {
      if (m.summoner) { if (!mem.fell && !brokenHere()) out.push([m, i]); return; }
      if (left[m.career] > 0) { left[m.career]--; return; }
      out.push([m, i]);
    });
    return out;
  }
  /** One of the faithful made the rite's: its part, its camp, its chant (its sight short until disturbed) - and, stood
   *  fresh, the Summoner thrice a caster's health. A foe taken over (a handover) is made the rite's again, its health
   *  its owner's word. */
  function riteFoe(f, summoner, career, camp, fresh) {
    f.riteRole = summoner ? 'summoner' : 'faithful'; f.riteCareer = career;
    f.campId = camp; f.campAlertRadius = RITE_ALERT_M;
    if (f.entity) f.entity.campId = camp;
    if (f.ai && !f.ai.target) f.ai.sightRadius = RITE_SIGHT_M;
    if (fresh && summoner && f.entity) { f.entity.maxHealth = Math.max(1, Math.round((f.entity.maxHealth ?? 1) * RITE_SUMMONER_HEALTH)); f.entity.health = f.entity.maxHealth; f.entity.healthMult = (f.entity.healthMult ?? 1) * RITE_SUMMONER_HEALTH; }   // TELL1: what was stood on the kind's own health (its poise)
  }
  /** THE FAITHFUL STOOD: the Summoner behind the altar, the rest on the ring - one camp, chanting - every one this
   *  character has not seen fall. Never in a save (AUDIT WB12d C5: a load stood them beside a fresh set). */
  function stand(t, todo = survivors()) {
    C.standAt = t;
    if (!todo.length) { C.spawned = true; return; }   // every one of them fell before my eyes: nothing stands, nothing is claimed
    foes.reclaim?.(C.site);   // a race lost earlier gave it away - its winner is gone
    sprang(C.site);
    const c = C, site = C.site, camp = C.camp ?? foes.campId(), ring = C.layout.ring(riteFaithfulOf(C.day).length - 1);
    c.camp = camp;
    for (const [m, i] of todo) {
      const [x, z, yaw] = m.summoner ? c.layout.summoner : ring[i - 1];
      c.pending++;
      const landed = (f) => {
        c.pending--;
        if (f && (C !== c || now() >= c.win.to)) { foes.remove(f); return; }   // the circle went while it stood, or the breach opened (AUDIT WB12d: never the site with it)
        // Keep only failed slots. Retrying the whole ring would duplicate the faithful that did stand.
        if (!f && C === c && now() < c.win.to) c.retry.push([m, i]);
        if (f) { c.spawned = true; riteFoe(f, m.summoner, m.career, camp, true); if (f.entity && m.summoner) f.entity.properName = RITE_TEXT.summoner; }
        if (!c.pending && !c.spawned && C === c) unsprang(site);   // none stood: claimed by nobody, tried again
      };
      foes.spawn(m.career, [c.heart[0] + x, c.heart[2] + z], { yaw, site, transient: true }).then(landed, () => landed(null));
    }
  }
  /** One of the faithful seen dead with a body, counted once: the Summoner's fall while the rite holds, the others by
   *  their career - a copy by its owner's number, so a copy stood again is not a second death. */
  function counted(f, career, summoner, holds, mem) {
    const k = f.puppet ? `${f.puppet}:${f.seq}` : f;
    if (C.counted.has(k)) return;
    C.counted.add(k);
    if (summoner) { if (holds) mem.fell = 1; return; }
    if (RITE_CAREERS.includes(career)) mem.slain[career] = Math.min(RITE_FAITHFUL_MAX, (mem.slain[career] ?? 0) + 1);
  }
  /** Every screen's faithful named (the Summoner by his own name - AUDIT WB12d D2), counted and read; my own woken
   *  together, and one taken over made the rite's again (AUDIT WB12d C3). */
  function tend(holds) {
    const mem = riteMemory(C.day), list = foes.list();
    let own = 0, pup = 0, waker = null;
    for (const f of list) {
      if (!ownSite(f)) continue;
      const career = f.riteCareer ?? f.mobileType;
      const summoner = f.riteRole ? f.riteRole === 'summoner' : career === RITE_SUMMONER_CAREER;
      const e = f.entity;
      if (e && (f.riteRole || summoner || RITE_CAREERS.includes(career))) {   // a copy a Wabbajack changed keeps its kind's name
        const name = summoner ? RITE_TEXT.summoner : RITE_TEXT.faithful;
        if (e.name !== name) e.name = name;
        if (summoner && e.properName !== RITE_TEXT.summoner) e.properName = RITE_TEXT.summoner;
      }
      if (!mem.struck && struckAt(f) != null) mem.struck = 1;
      if (f.dead) { if (f.corpse) counted(f, career, summoner, holds, mem); continue; }   // gone without a body: walked away, no fall
      if (f.puppet) { pup++; continue; }
      own++;
      if (!f.riteRole) riteFoe(f, summoner, career, C.camp ?? (C.camp = foes.campId()), false);
      if (!waker && f.ai?.target) waker = f;
    }
    // ONE WOKEN WAKES THEM ALL - a blow on one that never saw its striker too (the camp's own wake rides sight alone)
    if (waker) for (const g of list) if (ownSite(g) && !g.puppet && !g.dead && g.ai && !g.ai.target) g.ai.target = waker.ai.target;
    C.ownLive = own; C.pupLive = pup;
    if (own) C.spawned = true;   // taken over: mine, as if I had stood them
  }
  /** Whether to stand the faithful now - nobody's standing here (mine, a peer's copies, mine on their way), and nobody
   *  holds them: none ever sprang them, or their owner went quiet (AUDIT WB12d C2). */
  function maybeStand(t) {
    // A peer's ownership supersedes this client's failed slots; never retry beside their copy. THE MERGE (#534 B01 x
    // BROKER-CAGE): nor once the hub says every one of them fell - the retry stands its slots past survivors(), whose
    // law that is
    if (C.pupLive || peerSprang(C.site) || clearedHere()) C.retry.length = 0;
    if (C.pending || C.pupLive || t - C.standAt < RITE_RESTAND_MS) return;
    if (C.retry.length && !peerSprang(C.site)) {
      const mem = riteMemory(C.day);
      const todo = C.retry.filter(([m]) => !m.summoner || (!mem.fell && !brokenHere()));
      C.retry = [];
      stand(t, todo);
      return;
    }
    if (C.ownLive) return;
    if (peerSprang(C.site)) {
      if (!(peerHeldAgo(C.site) >= RITE_ORPHAN_MS)) return;   // a peer holds them - their copies on their way, or every one fallen
      forgetPeer(C.site);
      C.spawned = false;   // their owner is gone: the survivors are mine to stand
    }
    if (!C.spawned) stand(t);
  }
  /** The rite's word to its cell - every RITE_WORD_MS, at once when it changes and once more RITE_RESAY_MS after; made
   *  only when due (AUDIT WB12d C13). Not sent, it is said again at once. BROKER-CAGE: `c`, every one of them seen to
   *  fall. */
  function word(t) {
    // AUDIT BROKER-CAGE C1: the Summoner's fall the hub said counts toward every one of them - he is never stood again for a
    // character who did not see it (survivors), so its own eyes could never see them all, and the cage stayed shut
    const mem = riteMemory(C.day), s = mem.struck ? 1 : 0, f = mem.fell ? 1 : 0, c = riteRosterFell(C.day, mem.slain, mem.fell || brokenHere() ? 1 : 0) ? 1 : 0, k = s * 4 + f * 2 + c;
    const changed = k !== C.saidKey;
    if (!changed && t - C.wordAt < RITE_WORD_MS && t < C.resayAt) return;
    if (!send({ d: C.day, px: C.px, py: C.py, s, f, c }, C.cell)) return;
    C.resayAt = changed && k > 0 ? t + RITE_RESAY_MS : Infinity;
    C.wordAt = t; C.saidKey = k;
  }
  /** THE OPENING: the faithful still standing pass into the breach - mine taken down - said to a player near them,
   *  broken or not (AUDIT WB12d D6), once a day. */
  function pass(d) {
    C.passed = true;
    let standing = 0;
    for (const f of foes?.list() ?? NONE) if (ownSite(f) && !f.dead) standing++;
    foes?.drop(C.site);
    const mem = riteMemory(C.day);
    if (standing && !mem.passed && d <= RITE_SPRING_M) { mem.passed = 1; sayNear(RITE_TEXT.pass); }
  }
  /** AUDIT WB12d (C4): the pile as it was seeded, untouched - every piece and its count, in any order. */
  function untouched(p) {
    const items = p.items ?? NONE, snap = C.snap ?? NONE;
    if (items.length !== snap.length) return false;
    return snap.every(([it, n]) => items.includes(it) && (it.stackCount ?? 1) === n);
  }
  /** THE CASKET: the day's pile, seeded for a player near it once the rite is broken and this character has not opened
   *  it today. AUDIT WB12d (C4, C9): opened is anything changed in it - a stack split, a piece swapped - and the day is
   *  the character's at once; the pile keeps the casket's place and name until it is emptied or goes with its pixel
   *  (then the casket says it was opened, or - gone untouched - is seeded again). */
  function chest(d) {
    if (C.pile) {
      if (!riteChestOpened(C.day) && !untouched(C.pile)) markRiteChest(C.day);
      if (C.pile.dead || !C.pile.items?.length) { C.pile = null; C.snap = null; }
      return;
    }
    if (!loot || !C.known || !brokenHere() || riteChestOpened(C.day) || d > RITE_CHEST_SEED_M) return;
    const c = C.layout.casket, p = sceneAt(c.x, c.z);
    C.pile = loot.seed(riteChestItems(level(), rolls), [p[0], p[1] + 0.6, p[2]], `${C.px},${C.py}`);   // dies with its pixel
    C.snap = (C.pile?.items ?? NONE).map((it) => [it, it.stackCount ?? 1]);
  }

  // ── the art ──
  function ensureModel() {
    if (modelGen === C.groundGen || modelFailedGen === C.groundGen) return;
    try {
      model = buildRiteModel(C.facing, heightAt, { sigil: false });
      sigilModel = buildRiteModel(C.facing, heightAt, { stone: false });
      modelGen = C.groundGen;
    } catch (e) { console.warn('[rite] the circle would not build', e?.message ?? e); modelFailedGen = C.groundGen; }   // AUDIT WB12d (G18): not again until its ground moves
  }
  function ensureMesh() {
    if (!model || !renderer?.createMesh || meshGen === modelGen || meshFailedGen === modelGen) return;
    try {
      if (!artUp) {
        for (const [rec, art] of [...gateArt(), ...riteArt()]) { renderer.uploadTexture?.(GATE_ARCHIVE, rec, art.albedo); renderer.uploadEmissionTexture?.(GATE_ARCHIVE, rec, art.emission); }
        artUp = true;
      }
      const next = renderer.createMesh(model), nextSigil = renderer.createMesh(sigilModel);
      if (mesh) renderer.destroyMesh?.(mesh);
      if (sigilMesh) renderer.destroyMesh?.(sigilMesh);
      mesh = next; sigilMesh = nextSigil; meshGen = modelGen;
    } catch (e) { console.warn('[rite] the circle would not build', e?.message ?? e); meshFailedGen = modelGen; }
  }
  /** AUDIT WB12d (G4): the stone stands in the world - its altar, casket and braziers under the collider's own bucket
   *  (the sigil is the ground's: its model is apart). */
  function standCollider() {
    const col = collider?.();
    if (!col?.addMesh || !model || colliderGen === C.gen) return;
    col.removeBucket?.(RITE_BUCKET);
    col.addMesh(RITE_BUCKET, model.positions, model.indices, mats.stone);
    colliderGen = C.gen;
  }
  function ensureTent() {
    if (tent || tentTried || !meshes?.getGpuMesh) return;
    tentTried = true;
    Promise.resolve(meshes.getGpuMesh(TENT_MODEL)).then((g) => { tent = g ?? null; }).catch(() => {});
  }
  function ensureFire() {
    if (fire || fireTried || !getTexture) return;
    fireTried = true;
    Promise.resolve(getTexture(FIRE_FLAT.archive)).then((t) => {
      if (!t) return;
      const count = t.getFrameCount?.(FIRE_FLAT.record) ?? 1;
      for (let i = 0; i < count; i++) uploadRecordFrame?.(FIRE_FLAT.archive, FIRE_FLAT.record, i);
      const size = t.getSize(FIRE_FLAT.record);
      const w = size.width * GLOBAL_SCALE, h = size.height * GLOBAL_SCALE;
      fire = { count, size: { w: w * RITE_FLAME_SCALE, h: h * RITE_FLAME_SCALE }, camp: { w, h } };
    }).catch(() => {});
  }
  /** The flames: one on each brazier, one on the altar - the smoke's own fire - and the camp's, a camp fire's size;
   *  every other brazier its own batch, so the ring never flickers as one (AUDIT WB12d G19). Stood again with each make. */
  function mountFlames() {
    if (!fire || !renderer?.createBillboardBatch || flamesGen === C.gen) return;
    dropFlames();
    const top = (x, z, up) => { const p = sceneAt(x, z); return [p[0], p[1] + up, p[2]]; };
    const ring = C.layout.braziers.map(([x, z]) => top(x, z, RITE_BRAZIER_H));
    const sets = [
      [fire.size, [...ring.filter((_, i) => i % 2 === 0), top(0, 0, RITE_ALTAR.h)]],
      [fire.size, ring.filter((_, i) => i % 2 === 1)],
      [fire.camp, [top(C.layout.fire[0], C.layout.fire[1], 0)]],
    ];
    flamesList = Object.freeze(sets.map(([size, pos]) => { const b = renderer.createBillboardBatch(FIRE_FLAT.archive, FIRE_FLAT.record, size, pos); b.frame = 0; return b; }));
    anim = fire.count > 1 ? new FlatAnim(FIRE_FLAT.archive, fire.count, false) : null;
    flamesGen = C.gen;
  }
  function dropFlames() {
    for (const b of flamesList) renderer?.destroyBillboardBatch?.(b);
    flamesList = NONE;
  }
  /** The smoke's strength now: fading in from the omen, thinning after the opening; 0 with no circle, and 0 at or under
   *  the pass's own threshold (AUDIT WB12d G14). */
  function smokeFade(t = now()) {
    if (!C) return 0;
    const w = C.win, v = Math.min(1, Math.max(0, (t - w.from) / RITE_SMOKE_IN_MS), Math.max(0, 1 - (t - w.to) / RITE_SMOKE_OUT_MS));
    return v > SMOKE_FADE_MIN ? v : 0;
  }
  function smokes() {
    const fade = smokeFade();
    if (!(fade > 0)) return NONE;
    smoke.origin = C.heart; smoke.fade = fade;
    return smokeList;
  }

  return {
    /** The frame's beat: the circle stood or let go, the faithful stood and tended, the words said, its art made.
     *  Answers the circle. Before the renderer's frame: the smoke's pass is built here (AUDIT WB12d G14). */
    frame() {
      frameN++;
      const t = now();
      const c = omen?.() ?? null, s = c?.site ?? null;
      if (!s || !Number.isSafeInteger(s.day) || !riteStands(s.day, t, fellAt(s.day))) { if (C) leave(); return null; }
      if (!C || C.day !== s.day || C.px !== s.px || C.py !== s.py) enter(s);
      if (s.near && !C.near) C.near = s.near;
      placeHeart();
      if (C.known && !C.bared) { C.bared = true; bareSaid(); }
      const f = feet(), d = f ? Math.hypot(f[0] - C.heart[0], f[2] - C.heart[2]) : Infinity;
      const holds = t >= C.win.from && t < C.win.to, on = online();
      if (foes && d <= RITE_TEND_M) tend(holds);
      // AUDIT BROKER-CAGE C13: the hub says every one of them fell - my own still standing are copies a word outran (a
      // page that stood them before the hello's word landed, a copy stood again and counted twice): taken down, the site
      // kept, as at the opening; none is stood again (survivors)
      if (foes && C.ownLive && clearedHere()) { foes.drop(C.site); C.ownLive = 0; }
      if (on && holds && foes && C.known && d <= RITE_SPRING_M) maybeStand(t);
      // the hub's word, said once while the rite holds and the place is known (AUDIT WB12d D1: a page opened after the
      // break heard it before its omen, "in the wilds")
      const mem = riteMemory(C.day), b = brokenHere();
      if (b && holds && C.near && !mem.saidBroken) { mem.saidBroken = 1; say(RITE_TEXT.broken({ near: C.near, by: b.by, n: b.n })); }
      if (!holds && t >= C.win.to && !C.passed) pass(d);
      if (on && holds && d <= RITE_SAY_REACH_M) word(t);
      chest(d);
      if (C.known) { made(); ensureModel(); ensureMesh(); standCollider(); ensureTent(); ensureFire(); mountFlames(); }
      if (!smokePass && !smokeTried && gl && smokeFade(t) > 0) {
        smokeTried = true;
        try { smokePass = new RiteSmokeRenderer(gl); } catch (e) { console.warn('[rite] the smoke would not build', e?.message ?? e); }
      }
      return C;
    },
    /** The flames' clock (the host's per-frame tick): each batch a share of the cycle on from the last. */
    tick(dt) {
      if (!anim || !flamesList.length) return;
      const f = anim.tick(dt);
      for (let i = 0; i < flamesList.length; i++) flamesList[i].frame = (f + Math.round((i * fire.count) / RITE_FLAME_PHASES)) % fire.count;
    },
    /** THE HUB'S WORD (net/wire.js validRiteOut): a circle's rite broken - kept by its circle, said by the frame; or
     *  (BROKER-CAGE, `cl`) its faithful every one fallen - kept by its circle, the cage's to read. */
    onBroken(w) {
      if (!w || !Number.isSafeInteger(w.d) || !Number.isSafeInteger(w.px) || !Number.isSafeInteger(w.py)) return;
      if (w.k === 'cl') {
        const k = circleKey(w.d, w.px, w.py);
        clearedWords.delete(k); clearedWords.set(k, Number.isSafeInteger(w.at) && w.at > 0 ? w.at : 0);
        if (clearedWords.size > BROKEN_KEPT) clearedWords.delete(clearedWords.keys().next().value);
        return;
      }
      const k = circleKey(w.d, w.px, w.py), by = Array.isArray(w.by) ? w.by.filter((x) => typeof x === 'string' && x) : [];
      brokenWords.delete(k);
      brokenWords.set(k, { by, n: Number.isSafeInteger(w.n) ? Math.max(w.n, by.length) : by.length });
      if (brokenWords.size > BROKEN_KEPT) brokenWords.delete(brokenWords.keys().next().value);
    },
    /** Whether the hub said the rite at this circle broken (systems/gateOmen.js: its order is not said then). */
    isBroken: (day, px, py) => brokenWords.has(circleKey(day, px, py)),
    /** BROKER-CAGE: whether every one of the circle's faithful fell - the hub's word, or (`ownEyes`: a relay before the
     *  one that says it - net/wire.js relaySupportsCage) this character's own eyes, the Summoner's fall the hub's broken
     *  word counting as seen (AUDIT BROKER-CAGE C1): the Broker's cage open. AUDIT BROKER-CAGE C6: where the relay says
     *  it, its word alone - a screen that freed her on its own eyes while the relay never heard them (the last of them
     *  felled 60 m out, the breach opening before its killer came back) sold where every other screen saw her caged. */
    isCleared(day, px, py, ownEyes = true) {
      const k = keyFor(day, px, py);
      if (clearedWords.has(k)) return true;
      if (!ownEyes) return false;
      const mem = riteSeen(day);
      return !!mem && riteRosterFell(day, mem.slain, mem.fell || brokenWords.has(k) ? 1 : 0);
    },
    /** BROKER-CAGE: when the hub said the circle's faithful every one fallen (relay ms), or NaN - AUDIT BROKER-CAGE C8:
     *  the Broker's door, seen shut only after it, neither swings nor says she is free. */
    clearedAt(day, px, py) { const at = clearedWords.get(keyFor(day, px, py)); return at > 0 ? at : NaN; },
    /** The circle's stone and the tents, in the host's world pass - and its sigil for an eye near it (AUDIT WB12d G6;
     *  no eye said, it is drawn). */
    draw(r = renderer, texRemap = null, eye = null) {
      if (!C?.known || !r?.drawMesh) return 0;
      made();
      let n = 0;
      if (mesh) { r.drawMesh(mesh, mats.stone, texRemap); n++; }
      if (sigilMesh && (!eye || Math.hypot(eye[0] - C.heart[0], eye[1] - C.heart[1], eye[2] - C.heart[2]) <= RITE_SIGIL_DRAW_M)) { r.drawMesh(sigilMesh, mats.stone, texRemap); n++; }
      if (tent) for (const m of mats.tents) { r.drawMesh(tent, m, texRemap); n++; }
      return n;
    },
    /** The flames, for the host's billboard list. */
    batches: () => (C?.known ? flamesList : NONE),
    /** The braziers' glow and the camp's fire, for a player in reach of them - the same two every frame. */
    lights() {
      if (!C?.known) return NONE;
      const f = feet();
      if (!f || Math.hypot(f[0] - C.heart[0], f[2] - C.heart[2]) > RITE_LIGHT_REACH_M) return NONE;
      made();
      return lightPts;
    },
    /** The pillar of smoke: from the omen, rising, until the breach opens, thinning after. */
    smokes,
    /** Whether the smoke shows - and its pass stands to draw it: the host builds the pass's arguments only then, and a
     *  pass asked to draw always draws (AUDIT WB12d G14: one built in the draw drew nothing its first frame, and the
     *  host's foreign-pass mark never came). */
    smoking: () => !!smokePass && smokeFade() > 0,
    /** The smoke's pass, after the world's (the gate's fire's seat). Answers how many pillars it drew. */
    drawSmoke(proj, view, eye, seconds, fog = null) {
      const list = smokes();
      if (!smokePass || !list.length) return 0;
      smokePass.draw(list, proj, view, eye, seconds, fog);
      return smokePass.drawn;
    },
    /** THE CASKET, while it holds no pile: its name, and sealed until the rite is broken. */
    targets() {
      if (!C?.known || C.pile) return NONE;
      made();
      return target;
    },
    hoverName(key) {
      if (typeof key !== 'string' || !C) return null;
      if (key.startsWith('rite:')) return { title: RITE_TEXT.chest, subs: !brokenHere() ? [RITE_TEXT.sealedSub] : riteChestOpened(C.day) ? [RITE_TEXT.openedSub] : [] };
      return C.pile && loot?.keyOf && key === loot.keyOf(C.pile) ? { title: RITE_TEXT.chest } : null;   // open: its pile wears its name (AUDIT WB12d D8: until it is emptied)
    },
    activate(key) {
      if (typeof key !== 'string' || !key.startsWith('rite:') || !C) return false;
      if (!brokenHere()) sayNear(RITE_TEXT.sealed);
      return true;
    },
    /** AUDIT WB12d (G2): the burned earth the grass keeps off - the scene's x, z and radius, and the circle's key - or null. */
    clearing() {
      if (!C) return null;
      bare.x = C.heart[0]; bare.z = C.heart[2]; bare.key = C.key;
      return bare;
    },
    /** The site of the circle standing now - its faithful are the rite's (AUDIT WB12d C15: the Overworld's mark) - or null. */
    siteNow: () => C?.site ?? null,
    /** The host's state, for the tests and the probes. */
    state: () => (C ? { day: C.day, site: C.site, heart: C.heart, known: C.known, spawned: C.spawned, pending: C.pending, own: C.ownLive, copies: C.pupLive, struck: !!riteMemory(C.day).struck, fell: !!riteMemory(C.day).fell, broken: !!brokenHere(), cleared: clearedHere(), passed: C.passed, pile: !!C.pile, mesh: !!mesh, sigil: !!sigilMesh, gen: C.gen, groundGen: C.groundGen } : null),
    destroyAll() { leave(); },
  };
}
