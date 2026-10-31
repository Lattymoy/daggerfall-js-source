// @ts-check
// LEFAY1 (2026-10-08): THE MONUMENTS, WHERE THEY STAND - the exterior hosts' pool on the runtime pools' shape
// (scenes/sigilBrokerPool.js): a monument's stone drawn in the host's world pass, its collider bucket, the eye's box and
// its name, the press on it, and the flowers - thrown, in flight, and laid. createMonuments holds one pool a monument
// (world/lefayMonument.js MONUMENTS: Julian LeFay's in Gothway Garden, Patrick Stewart's by the White-Gold Tower).
//
// WHERE: the host says (`site(id)`: the scene's x, z of its middle, or null where its place is not built); the ground
// there is the host's (`groundAt`), read when the spot moves and every LEFAY_GROUND_EVERY frames. Its collider is held
// back while a body stands where it would first rise (`bodyTrapped` - AUDIT SET W1's law).

// THE FLOWERS: a press throws one (a lit Throw row, or any mode but Info and Steal), at most one every TOSS_EVERY_MS, to
// its rest on the thrower's side, where the character's tribute for that monument keeps it (`keep` - the save's). The
// laid flowers are one billboard batch a kind; TEXTURE.254's, the player's own (none loaded: unseen, still counted).
// NOTHING HERE IS SENT: each character keeps its own pile.
//
// THE FOUR HOSTS (bible/Home.md): scenes/world.js and scenes/exterior.js - WIRED (the pixel's or the bench's spot; the
// pool framed, drawn, its flats on the live axis, taken down at a change of place, a re-anchor and a load).
// scenes/worldModes.js - WIRED for the street's press both share (`monumentTargets`, the `monument:` arm).
// scenes/dungeonContext.js - stands no street: nothing here reaches it. Not a DFU member. Ledger A (LEFAY).
import {
  MONUMENTS,
  LEFAY_ROWS,
  LEFAY_ARCHIVE,
  MONUMENT_BOXES,
  MONUMENT_STEPS,
  MONUMENT_FOOT,
  OBELISK,
  LEFAY_FLOWERS,
  FLOWER_SCALE,
  TOSS_MS,
  TOSS_EVERY_MS,
  buildLefayModel,
  tossRest,
  flowerPlace,
  tossPoint,
  normalTribute,
  layFlower,
} from '../world/lefayMonument.js';
import { lefayArt } from '../world/lefayArt.js';
import { dfLook, lookSeed } from '../world/dfLook.js'; // DF-LOOK: the monument's pictures in Daggerfall's colours
import { wearPainted } from '../systems/studioArt/studioArt.js'; // STUDIO1: the studio's pictures over the painted ones (their rows top-down, as the monument's are)
import { RAY_DISTANCE, STATIC_NPC_ACTIVATION_DISTANCE } from '../player/activate.js';
import { CAPSULE_RADIUS, CAPSULE_HEIGHT } from '../player/motor.js';
import { trs } from '../world/mat4.js';

/** The ground under it is read again every this many frames (a pixel built finer moves it). */
export const LEFAY_GROUND_EVERY = 30;
/** The press reaches it as it reaches a static NPC (PlayerActivate's StaticNPCActivationDistance, 6.4): a flower is
 *  thrown from a few paces, not handed. */
export const LEFAY_REACH = STATIC_NPC_ACTIVATION_DISTANCE;
/** A thrown flower leaves the hand this far under the eye, metres. */
export const TOSS_HAND_DROP = 0.35;
const NONE = Object.freeze([]);

/** Would its stone, stood with its middle at feet `at`, rise round a body whose feet are at `f` (the motor's capsule)?
 *  AUDIT LEFAY1 C1: its whole footprint - the lowest step's corners and the capsule's radius about them, from its sunk
 *  foot to its gilt point - not the pedestal's alone: its steps' tops (0.6, 0.9) are over the motor's STEP_OFFSET, so a
 *  body on the green when it first stands (a save from before it) was walled in by them. Pure. */
export function bodyTrapped(at, f) {
  if (!at || !f) return false;
  return (
    Math.hypot(f[0] - at[0], f[2] - at[2]) < MONUMENT_STEPS[0].r + CAPSULE_RADIUS &&
    f[1] < at[1] + OBELISK.apex &&
    f[1] + CAPSULE_HEIGHT > at[1] - MONUMENT_FOOT
  );
}

/**
 * @param {{
 *   renderer?: any, getTexture?: ((archive: number) => Promise<any>)|null, uploadRecord?: ((archive: number, record: number) => void)|null,
 *   billboardSize?: ((tex: any, record: number) => {w: number, h: number})|null,
 *   site: () => (number[]|null), groundAt: (x: number, z: number) => number, collider?: () => any,
 *   eye?: () => (number[]|null), feet?: () => (number[]|null),
 *   tribute?: () => any, keep?: (next: {count: number, laid: number[][]}) => void,
 *   say?: (text: string) => void, midText?: (text: string) => void, sound?: () => void,
 *   now?: () => number, rand?: () => number, restores?: () => number, subject?: import('../world/lefayMonument.js').MonumentSubject,
 * }} deps  `site` the scene x, z of its middle (null where it does not stand), and the frame's vertical compensation
 *   when the host has one (a change re-reads the ground); `tribute`/`keep` the character's record; `restores` how many
 *   saves the page has restored (systems/save/save.js restoresSoFar); `subject` which monument (MONUMENTS)
 */
export function createLefayMonument({
  subject = MONUMENTS.lefay,
  renderer = null,
  getTexture = null,
  uploadRecord = null,
  billboardSize = null,
  site,
  groundAt,
  collider = () => null,
  eye = () => null,
  feet = () => null,
  tribute = () => null,
  keep = () => {},
  say = () => {},
  midText = () => {},
  sound = () => {},
  now = () => Date.now(),
  rand = Math.random,
  restores = () => 0,
}) {
  /** Where its middle stands this frame ([x, y, z], the ground's), or null; its matrix, made when it moves. */
  let at = null,
    matrix = null;
  let groundY = NaN,
    frameN = 0;
  const groundAtXZ = [NaN, NaN, -Infinity, NaN]; // the x, z the ground was read at, the frame, the vertical compensation
  /** Its collider, where it was stood ([x, y, z]), or null. */
  let colAt = null;
  /** Its mesh, made once; the model it was made from (the collider's triangles). */
  const model = buildLefayModel(subject.plaque);
  const { key: KEY, text: TEXT } = subject;
  let mesh = null,
    meshTried = false;
  /** The flowers' pictures: loading, loaded ({tex, sizes}), or failed. */
  let flowers = null,
    flowerLoad = null;
  /** The laid pile's batches, one a kind, and the pile they were made from. */
  /** @type {Map<number, any>} */
  const laidBatches = new Map();
  let laidFrom = null;
  /** The flowers in flight: {entry, from (local), to (local), at (ms), batch|null, pos, landed, gen}. */
  /** @type {Array<{entry: number[], from: number[], to: number[], at: number, batch: any, pos: number[], landed?: boolean, gen: number}>} */
  let tosses = [];
  let lastToss = -Infinity;
  const _batches = [];
  let box = null;

  function loadFlowers() {
    if (flowers || flowerLoad || !getTexture || !renderer?.createBillboardBatch) return;
    const archive = LEFAY_FLOWERS[0][0];
    flowerLoad = Promise.resolve()
      .then(() => getTexture(archive))
      .then(
        (tex) => {
          try {
            const sizes = LEFAY_FLOWERS.map(([a, r]) => {
              uploadRecord?.(a, r);
              const s = billboardSize ? billboardSize(tex, r) : { w: 0.5, h: 0.5 };
              return { w: s.w * FLOWER_SCALE, h: s.h * FLOWER_SCALE };
            });
            flowers = { tex, sizes };
          } catch (e) {
            flowers = { failed: true };
            console.warn('[lefay] the flowers would not load', e?.message ?? e);
          }
        },
        (e) => {
          flowers = { failed: true };
          console.warn('[lefay] the flowers', e?.message ?? e);
        },
      );
  }
  const flowerBatch = (kind, centers) => {
    const [a, r] = LEFAY_FLOWERS[kind];
    const b = renderer.createBillboardBatch(a, r, flowers.sizes[kind], centers);
    b.origin = [0, 0, 0];
    return b;
  };
  /** The laid pile's batches, made again when the character's pile is not the one they were made from. */
  function tendPile() {
    if (!flowers?.sizes) return;
    const t = tribute();
    const laid = t?.laid ?? NONE;
    if (laidFrom === laid) return;
    laidFrom = laid;
    for (const b of laidBatches.values()) renderer.destroyBillboardBatch?.(b);
    laidBatches.clear();
    const byKind = new Map();
    for (const e of normalTribute(t).laid) {
      if (!byKind.has(e[1])) byKind.set(e[1], []);
      byKind.get(e[1]).push(flowerPlace(e));
    }
    for (const [kind, centers] of byKind) laidBatches.set(kind, flowerBatch(kind, centers));
  }
  /** A flower in flight comes to rest: laid in the character's pile (which makes the pile's batches again) - AUDIT LEFAY1
   *  B1: unless a save was restored since it was thrown, whichever load did it: the pile is another's then (the loaded
   *  character's, or another character's), and it lands nowhere. */
  function land(f) {
    if (f.landed) return;
    f.landed = true;
    if (f.batch) renderer?.destroyBillboardBatch?.(f.batch);
    f.batch = null;
    if (f.gen === restores()) keep(layFlower(tribute(), f.entry));
  }
  function ensureMesh() {
    if (meshTried || !renderer?.createMesh) return;
    meshTried = true;
    try {
      for (const [rec, art] of lefayArt(subject))
        wearPainted(
          LEFAY_ARCHIVE,
          rec,
          () => dfLook(art, lookSeed(LEFAY_ARCHIVE, rec)),
          (pic, { late }) => {
            if (late) renderer.releaseTexture?.(LEFAY_ARCHIVE, rec);
            renderer.uploadTexture?.(LEFAY_ARCHIVE, rec, pic);
          },
          { topDown: true },
        );
      mesh = renderer.createMesh(model);
    } catch (e) {
      console.warn('[lefay] the monument would not build', e?.message ?? e);
    }
  }
  function standCollider() {
    const col = collider();
    if (!col?.addMesh) return;
    if (colAt && at && colAt[0] === at[0] && colAt[1] === at[1] && colAt[2] === at[2]) return;
    const moved = colAt !== null; // stood, and the land moved under it (a recentre carries the body with it)
    if (colAt) {
      col.removeBucket?.(KEY);
      colAt = null;
    }
    if (!at || (!moved && bodyTrapped(at, feet()))) return; // held back while a body stands where it would first rise - asked every frame; AUDIT LEFAY1 C1: never as it moves, which would drop a body standing on its steps
    col.addMesh(KEY, model.positions, model.indices, matrix);
    colAt = [at[0], at[1], at[2]];
  }
  function throwFlower() {
    const t = now();
    if (t - lastToss < TOSS_EVERY_MS) return false;
    lastToss = t;
    const e = eye();
    const b = e ? Math.atan2(e[0] - at[0], e[2] - at[2]) : 0,
      bearing = Number.isFinite(b) ? b : 0; // AUDIT LEFAY1 A5: no eye's NaN laid as nothing
    const entry = tossRest(bearing, rand);
    const to = flowerPlace(entry);
    const from = e
      ? [e[0] - at[0], e[1] - TOSS_HAND_DROP - at[1], e[2] - at[2]]
      : [to[0] * 1.6, to[1] + 1.5, to[2] * 1.6];
    const f = { entry, from, to, at: t, batch: null, pos: [0, 0, 0], landed: false, gen: restores() };
    if (flowers?.sizes) {
      f.batch = flowerBatch(entry[1], [[0, 0, 0]]);
    }
    tosses.push(f);
    sound();
    midText(TEXT.laid);
    return true;
  }
  const ours = (key) => key === KEY && !!at;
  /** A transition takes its collider down and lays what is in flight: it is stood again by the next frame that finds it. */
  function destroyAll() {
    collider()?.removeBucket?.(KEY);
    colAt = null;
    at = null;
    box = null;
    for (const f of tosses) land(f);
    tosses = [];
  }

  return {
    /** One frame: where it stands, its collider, its mesh, the flowers in flight and the pile. Answers where it stands. */
    frame() {
      frameN++;
      const s = site?.() ?? null;
      if (!s) {
        groundY = NaN; // its town gone: the ground is read afresh when it is built again (it may be built otherwise)
        if (at) {
          at = null;
          standCollider();
          for (const f of tosses) land(f);
          tosses = [];
        }
        return null;
      }
      const comp = s[2] ?? 0; // AUDIT LEFAY1 C2: a vertical recentre moves the ground and not its x, z
      if (
        s[0] !== groundAtXZ[0] ||
        s[1] !== groundAtXZ[1] ||
        comp !== groundAtXZ[3] ||
        !Number.isFinite(groundY) ||
        frameN - groundAtXZ[2] >= LEFAY_GROUND_EVERY
      ) {
        groundY = groundAt(s[0], s[1]);
        groundAtXZ[0] = s[0];
        groundAtXZ[1] = s[1];
        groundAtXZ[2] = frameN;
        groundAtXZ[3] = comp;
      }
      if (!Number.isFinite(groundY)) {
        at = null;
        standCollider();
        return null;
      }
      if (!at || at[0] !== s[0] || at[1] !== groundY || at[2] !== s[1]) {
        at = [s[0], groundY, s[1]];
        matrix = trs(at[0], at[1], at[2], 0, 0, 0);
        box = null;
      }
      standCollider();
      ensureMesh();
      loadFlowers();
      tendPile();
      const t = now();
      let landed = 0;
      for (const f of tosses) {
        const k = (t - f.at) / TOSS_MS;
        if (k >= 1 || t < f.at) {
          land(f);
          landed++;
          continue;
        } // at rest - or the clock stepped back under it
        tossPoint(f.from, f.to, k, f.pos);
        if (f.batch) {
          f.batch.origin[0] = at[0] + f.pos[0];
          f.batch.origin[1] = at[1] + f.pos[1];
          f.batch.origin[2] = at[2] + f.pos[2];
        }
      }
      if (landed) {
        tosses = tosses.filter((f) => !f.landed);
        tendPile();
      }
      for (const b of laidBatches.values()) {
        b.origin[0] = at[0];
        b.origin[1] = at[1];
        b.origin[2] = at[2];
      } // after the pile is made again, never a frame at the scene's origin
      return at;
    },
    /** Its stone, in the host's world pass. Answers how many it drew. */
    draw(r = renderer) {
      if (!at || !mesh || !matrix || !r?.drawMesh) return 0;
      r.drawMesh(mesh, matrix, null);
      return 1;
    },
    /** The laid flowers and the ones in flight, for the host's flats. */
    batches() {
      _batches.length = 0;
      if (!at) return _batches;
      for (const b of laidBatches.values()) _batches.push(b);
      for (const f of tosses) if (f.batch) _batches.push(f.batch);
      return _batches;
    },
    /** The eye's boxes, one key: its steps and its column (MONUMENT_BOXES), each met at its stone (its own bucket) when
     *  the eye is inside it or the ray enters it over air. */
    targets() {
      if (!at) return NONE;
      box ??= MONUMENT_BOXES.map((B) => ({
        key: KEY,
        aabb: { min: [at[0] + B[0], at[1] + B[1], at[2] + B[2]], max: [at[0] + B[3], at[1] + B[4], at[2] + B[5]] },
        distance: RAY_DISTANCE,
        reach: LEFAY_REACH,
        meshCollider: true,
      }));
      return box;
    },
    /** WORLD-HOVER: its name, its lines, what this character has laid, and its rows. */
    hoverName(key) {
      if (!ours(key)) return null;
      const n = normalTribute(tribute()).count;
      return {
        title: TEXT.title,
        subs: [...TEXT.subs, ...(n > 0 ? [TEXT.count(n)] : [])],
        actions: LEFAY_ROWS.map((r) => ({ id: r.id, label: r.label })),
      };
    },
    /** A press on it: the Read row (or Info mode, no row lit) reads its inscription, Steal takes nothing, anything else
     *  throws a flower. */
    activate(key, mode = 'grab', verb = null) {
      if (!ours(key)) return false;
      if (verb === 'read' || (verb == null && mode === 'info')) {
        for (const line of TEXT.read) say(line);
        return true;
      }
      if (verb == null && mode === 'steal') {
        midText(TEXT.steal);
        return true;
      }
      throwFlower();
      return true;
    },
    /** For the tests and the probes. */
    state: () => ({
      at,
      collider: colAt !== null,
      mesh: !!mesh,
      flowers: flowers ? (flowers.sizes ? 'loaded' : 'failed') : flowerLoad ? 'loading' : null,
      laid: [...laidBatches.keys()],
      tosses: tosses.length,
    }),
    destroyAll,
    /** The scene ends: its mesh and every batch freed (EVERY ALLOCATION HAS AN OWNER). */
    dispose() {
      destroyAll();
      for (const b of laidBatches.values()) renderer?.destroyBillboardBatch?.(b);
      laidBatches.clear();
      laidFrom = null;
      if (mesh) renderer?.destroyMesh?.(mesh);
      mesh = null;
      meshTried = false;
    },
  };
}

/**
 * STEWART-MONUMENT: EVERY MONUMENT, one pool each (MONUMENTS), as one pool to the hosts. `site(id)`, `tribute(field)` and
 * `keep(field, next)` as createLefayMonument's, asked for a monument's id and its tribute's field (`lefayTribute`,
 * `stewartTribute`); the rest handed to each.
 * @param {Parameters<typeof createLefayMonument>[0] & { site: (id: string) => (number[]|null), tribute?: (field: string) => any, keep?: (field: string, next: {count: number, laid: number[][]}) => void }} deps
 */
export function createMonuments({ site, tribute = () => null, keep = () => {}, ...deps }) {
  const pools = Object.values(MONUMENTS).map((subject) =>
    createLefayMonument({
      ...deps,
      subject,
      site: () => site(subject.id),
      tribute: () => tribute(subject.tribute),
      keep: (next) => keep(subject.tribute, next),
    }),
  );
  const byKey = new Map(Object.values(MONUMENTS).map((m, i) => [m.key, pools[i]]));
  const _all = [],
    _targets = [];
  return {
    /** One frame of each. Answers where the one standing stands, or null. */
    frame() {
      let at = null;
      for (const p of pools) at = p.frame() ?? at;
      return at;
    },
    draw(r) {
      let n = 0;
      for (const p of pools) n += p.draw(r);
      return n;
    },
    batches() {
      _all.length = 0;
      for (const p of pools) _all.push(...p.batches());
      return _all;
    },
    targets() {
      _targets.length = 0;
      for (const p of pools) _targets.push(...p.targets());
      return _targets;
    },
    hoverName: (key) => byKey.get(key)?.hoverName(key) ?? null,
    activate: (key, mode = 'grab', verb = null) => byKey.get(key)?.activate(key, mode, verb) ?? false,
    /** Each pool's state, by its monument's id - for the tests and the probes. */
    state: () => Object.fromEntries(Object.values(MONUMENTS).map((m, i) => [m.id, pools[i].state()])),
    destroyAll() {
      for (const p of pools) p.destroyAll();
    },
    dispose() {
      for (const p of pools) p.dispose();
    },
  };
}
