// MW-SPELLFX1 (2026-10-07, Mac: "We need to implement morrowind spell casting effects and animations"): MORROWIND'S
// SPELL EFFECTS IN THE WORLD.
//
// With Morrowind data attached, a spell is drawn as Morrowind draws it: its casting effects about the caster as the
// cast starts (CastSpell::playSpellCastingEffects, called from the character controller when the hands begin -
// character.cpp :1574-1613 - with VFX_Hands on both hands, which the arm draws: combat/fpArm.js castHands), the bolt a
// target spell flies as (ProjectileManager::launchMagicBolt / createModel: the bolt's mesh at the missile, turned to its
// flight and spinning a turn a second about it), the hit on whoever a spell lands on (playEffects), and the burst where
// an area goes off (CastSpell::explodeSpell: the area visual at twice the area's feet in scale). The visuals, their
// particle textures and the bolt's colours are the player's own masters' (formats/mwSpellFx.js plans them); the meshes
// run on formats/mwVfx.js and draw through the renderer's particle path in the world pass (render/vfxGpu.js).
//
// ONE ENGINE, FOUR HOSTS. scenes/hostMagic.js - the player-cast engine every host shares (the dungeon, the street, the
// interior through the street's, the exterior) - makes one of these and drives it from its own doors: the cast's start
// (castInput), every missile it flies (its own, an enemy's, another player's drawn one), every landing on a foe or on
// me (applySpellToFoe, applySpellToPlayer), every burst (explodeAt, the area about me). drawFx draws it, under the
// renderer's own camera, where the impact pass draws.
//
// THE PLACEMENTS (the reference's):
//   an actor's effect  at its feet - the object root (Animation::addEffect, bone ""); a creature's scaled and lifted
//                      by its own size (the !isNpc autoTransform: max(x, y, z/2) / 64 when that passes 1, the offset
//                      off a 128-unit body) - formats/mwSpellFx.js actorFxTransform
//   a burst            at the point, area x 2 in scale, no turn (EffectManager::addEffect - position and scale alone)
//   a bolt             at the missile, its +Y along the flight (launchMagicBolt's pitch then yaw), spinning about -Y
//
// WHAT IS NOT CARRIED, recorded:
//   - an actor's FACING: an actor's effect is placed at its feet unturned (the reference hangs it on the turned root);
//     Morrowind's casting and hit visuals are round, which is why this costs nothing anyone can see.
//   - the bolt's LIGHT (createModel: 66 units, the mean of the effects' colours) - the plan carries the colour; the
//     hosts' light lists are not yet handed it.
//   - a looping hit (ContinuousVfx, for the spell's duration): a hit plays its mesh once.
//   - another player's effects past their cast and their bolt (a peer's spell carries no effects on the wire, so its
//     look is its element's harm), and the creatures' and other players' VFX_Hands.

import { fpArm, mwSpellPlan, loadMwEffectMesh, loadMwEffectTextures } from '../combat/fpArm.js';
import { createVfx, vfxCapacity, vfxTextures } from '../formats/mwVfx.js';
import { boltAttitude, boltSpin, areaVisualScale, actorFxTransform } from '../formats/mwSpellFx.js';
import { MW_UNITS_PER_METER } from '../formats/mwFirstPerson.js';
import { createVfxGpu } from '../render/vfxGpu.js';
import { getPref } from '../systems/uiPrefs.js';

const U = 1 / MW_UNITS_PER_METER;
/** The Morrowind world into the pass - combat/fpArm.js NIF_TO_PASS (Z up becomes Y up, +Y forward becomes -Z) under
 *  the third-person body's mirrored metre scale (-u, u, u): (x, y, z) -> (-u x, u z, -u y). */
export const MW_TO_PASS = Object.freeze({ a: Float32Array.from([-U, 0, 0, 0, 0, U, 0, -U, 0]), t: Object.freeze([0, 0, 0]) });
/** A pass point in the Morrowind world - MW_TO_PASS undone. */
export const passToMw = (p) => [-p[0] / U, -p[2] / U, p[1] / U];
/** A pass direction in the Morrowind world (unscaled: a direction's length is no one's). */
export const passDirToMw = (d) => [-d[0], -d[2], d[1]];

const translate = (t, k = 1) => ({ a: Float32Array.from([k, 0, 0, 0, k, 0, 0, 0, k]), t });
const compose = (a3, t) => ({ a: a3, t });
const mul3 = (a, b) => {
  const o = new Float32Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  return o;
};

/** The renderer's eye for the billboards, in the pass: its position and the view matrix's look and up. */
function eyeOf(renderer) {
  const v = renderer?._view; const p = renderer?._camPos;
  if (!v || !p) return null;
  return { position: [p[0], p[1], p[2]], look: [-v[2], -v[6], -v[10]], up: [v[1], v[5], v[9]] };
}

/**
 * `renderer` the port's (null, or one without GL, draws nothing and loads nothing); `catalog()` the arm's Morrowind
 * catalog (combat/fpArm.js mwMagicCatalog - null without Morrowind data, which makes every door a quiet no-op);
 * `enabled()` the Morrowind spell effects switch; `hands(sp)` the arm's VFX_Hands door.
 */
export function createMwMagicFx({
  renderer,
  catalog = () => fpArm.mwMagicCatalog?.() ?? null,
  enabled = () => getPref('mwSpellEffects') !== false,
  hands = (sp) => fpArm.castHands?.(sp),
} = {}) {
  const live = [];     // { visual, fx, place: () => affine|null, gpu, handle }
  const assets = new Map();   // `${gen}|${model}|${texture}` -> Promise<{ desc, textures } | null>
  const plans = new WeakMap();
  let clock = 0;
  let dead = false;
  const drawable = () => !!renderer?.gl;

  function catalogNow() {
    if (dead || !drawable() || !enabled()) return null;
    try { return catalog() ?? null; } catch { return null; }
  }
  function planOf(cat, sp) {
    if (!sp) return null;
    const memo = plans.get(sp);
    if (memo && memo.cat === cat) return memo.plan;
    const plan = mwSpellPlan(cat, sp);
    if (typeof sp === 'object') plans.set(sp, { cat, plan });
    return plan;
  }
  function load(cat, visual) {
    const key = `${cat.gen}|${visual.model}|${visual.texture ?? ''}`;
    let job = assets.get(key);
    if (!job) {
      job = (async () => {
        const desc = await loadMwEffectMesh(cat, visual.model);
        if (!desc) return null;
        const textures = await loadMwEffectTextures(cat, [...vfxTextures(desc), visual.texture]);
        return { desc, textures };
      })().catch(() => null);
      assets.set(key, job);
      job.then((a) => { if (!a) assets.delete(key); });
    }
    return job;
  }

  /** One visual, spawned: a handle whose `state()` is pending until its assets land, then live, ended or failed. */
  function spawn(visual, place, { loop = false } = {}) {
    const cat = catalogNow();
    let state = cat && visual ? 'pending' : 'failed';
    const handle = { state: () => state, end() { if (state === 'pending' || state === 'live') state = 'ended'; } };
    if (state === 'failed') return handle;
    load(cat, visual).then((a) => {
      if (state !== 'pending') return;
      if (!a || dead) { state = 'failed'; return; }
      state = 'live';
      live.push({ visual, fx: createVfx(a.desc, { textureOverride: visual.texture, loop }), place, gpu: createVfxGpu(renderer, a.textures, vfxCapacity(a.desc)), handle });
    });
    return handle;
  }
  /** An actor's effect at its feet (a pass point), a creature's sized off its body (`body`: { height, radius } in
   *  metres; omitted for a person). */
  function atActor(visual, feet, body = null) {
    if (!visual || !Array.isArray(feet)) return null;
    const p = passToMw(feet);
    let place = translate(p);
    if (body) {
      const { scale, offset } = actorFxTransform(body.height, body.radius, MW_UNITS_PER_METER);
      place = translate([p[0], p[1], p[2] + offset], scale);
    }
    return spawn(visual, () => place);
  }

  return {
    /** Load what a readied spell will draw with, so its first cast is not a frame late. */
    prepare(sp) {
      const cat = catalogNow();
      const plan = cat ? planOf(cat, sp) : null;
      if (!plan) return;
      for (const v of [...plan.cast, plan.bolt, ...plan.hit, ...plan.area]) if (v) load(cat, v);
    },
    /** The cast's start: its casting visuals at the caster's feet, one per model; the player's hands glow too. */
    cast(sp, feet, { player = false, body = null } = {}) {
      const cat = catalogNow();
      const plan = cat ? planOf(cat, sp) : null;
      if (!plan) return 0;
      for (const v of plan.cast) atActor(v, feet, body);
      if (player) hands(sp);
      return plan.cast.length;
    },
    /** A missile's bolt: `at(pos, dir)` each frame (pass space), `end()` when it is gone, `state()` for whether the
     *  classic flat should stand in (only `failed` - nothing to draw it with - hands the missile back to it). */
    bolt(sp) {
      const cat = catalogNow();
      const plan = cat ? planOf(cat, sp) : null;
      const where = { pos: null, dir: [0, 0, -1] };
      if (!plan?.bolt) return { state: () => 'failed', at() {}, end() {} };
      const h = spawn(plan.bolt, () => {
        if (!where.pos) return null;
        const r = mul3(boltAttitude(passDirToMw(where.dir)), boltSpin(clock));
        return compose(r, passToMw(where.pos));
      }, { loop: true });
      return {
        state: h.state,
        at(pos, dir) { where.pos = [pos[0], pos[1], pos[2]]; if (dir) where.dir = [dir[0], dir[1], dir[2]]; },
        end: h.end,
      };
    },
    /** A spell landed on someone at `feet`: each effect's hit visual. */
    hit(sp, feet, { body = null } = {}) {
      const cat = catalogNow();
      const plan = cat ? planOf(cat, sp) : null;
      if (!plan) return 0;
      for (const v of plan.hit) atActor(v, feet, body);
      return plan.hit.length;
    },
    /** An area went off at `at` with Daggerfall's radius (metres): each effect's area visual at area x 2. */
    area(sp, at, radius) {
      const cat = catalogNow();
      const plan = cat ? planOf(cat, sp) : null;
      if (!plan || !Array.isArray(at)) return 0;
      const place = translate(passToMw(at), areaVisualScale(radius, MW_UNITS_PER_METER));
      for (const v of plan.area) spawn(v, () => place);
      return plan.area.length;
    },
    /** One frame: every effect's clock, placement and streams. An effect whose clock ran out, whose handle ended or
     *  whose placement went away is released; switching the effects off clears them all. */
    update(dt) {
      if (dead) return;
      clock += dt;
      if (!enabled()) { this.clear(); return; }
      if (!live.length) return;
      const eye = eyeOf(renderer);
      for (let i = live.length - 1; i >= 0; i--) {
        const e = live[i];
        const place = e.handle.state() === 'live' ? e.place() : null;
        const r = place ? e.fx.update(dt, { place, view: MW_TO_PASS, eye }) : { done: true };
        if (r.done) { e.handle.end(); e.gpu.release(); live.splice(i, 1); continue; }
        e.gpu.sync(r.streams);
      }
    },
    /** The world pass's draw - after the hosts' billboards, with the impact pass. Answers whether it drew. */
    draw() {
      if (dead || !live.length || !drawable() || !renderer._proj || !renderer._view) return false;
      const list = live.flatMap((e) => e.gpu.effects()).filter((g) => !g.hidden && g.count);
      if (!list.length) return false;
      renderer.drawWorldParticleEffects(list);
      return true;
    },
    /** A load, a teleport: every effect in the old place goes. */
    clear() {
      for (const e of live) { e.handle.end(); e.gpu.release(); }
      live.length = 0;
    },
    destroy() { this.clear(); dead = true; },
    /** The effects running, for a pin and the console. */
    count: () => live.length,
  };
}
