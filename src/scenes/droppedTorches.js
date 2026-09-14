// HT1: HANDHELD TORCHES' DROPPED LIGHTS, THROWN TORCHES AND BURNING FOES
// (RedRoryOTheGlen, Handheld Torches 1.4.1) - the pool one host owns,
// as scenes/droppedLoot.js is the ground pile's. The IL it restates:
// HandheldTorches.SpawnLightSource (0x3724), SpawnLightSourceProjectile
// (0x39dc), PickUpLightSource / PickupLightSource (0x3be4 / 0x3d18),
// CleanUpLightSources (0x3fac), DestroyLightSources (0x403c), the
// burn in Update (0x19f4-0x1bdc), OnRestWindowOpen/Close (0x318 /
// 0x388), HandheldTorchesSaveData (0x4c16-0x4d18),
// HandheldTorchesProjectile.Initialize / FixedUpdate (0x4688 / 0x47a4),
// HandheldTorchesEnemyLight (0x4370-0x4555) and
// HandheldTorchesEnemyParticleEmitter (0x4588-0x4667).
//
// WHAT A DROPPED LIGHT IS: a billboard of TEXTURE.112358 (the mod's
// own art, vendored) - record 0 a torch, 1 a candle, 2 a holy candle,
// +10 doused when it lands under a dungeon's water - a point light for
// the lit ones (the player torch's colour; the range shrinking with the
// time left) and, for a torch, a burning loop; a TIME in seconds (the
// item's condition x 20), burning down at the world clock's rate, dead
// at 0; activatable within 3.2 to pick up (Grab or Steal) or to name
// (Info or Talk); destroyed whole on every transition, restored from
// the save. THE BURN CLOCK, one law where the mod has two: the mod
// subtracts `TimeScale / 12 * deltaTime` every frame and, after a rest
// window, `world seconds elapsed / 12` in one go - both are the world
// clock's seconds over twelve (DFU's TimeScale is 12 world seconds a
// real second), so the port burns by the world-minute delta each tick,
// which also ages them through a rest, a loiter or a wait exactly as
// the mod's rest hook does, and nothing else the mod does not (a fast
// travel is a transition, and the pool is destroyed on it).
//
// THE PROJECTILE: FixedUpdate at Unity's 0.02 s, a gravity vector that
// grows by 9.81 x 0.05 x GravityStrength a step, the sprite's width
// swung by sin(20t) (the mirrored quad is the spin), a cast along the
// step - a foe hit sets it alight (Combustion; the torch is spent
// either way), a wall at a fifth of the start speed lands it, faster
// it bounces (Reflect over the normal, Bounciness on the speed, the
// gravity dropped, the drop clip no oftener than every 0.2 s).
//
// THE BURNING FOE: DFU's own Continuous Damage-Health, one bundle of the
// mod's settings assigned on the foe's own manager (CasterOnly - no
// saving throw, the foe its own caster) - the port's applySpell - and
// the mod's light effect beside it: an active entry the magic round
// counts down (AddState stacks a re-hit's rounds), a point light and a
// looping flame billboard (TEXTURE.375 record 0, the fire missile's
// flight loop, drawn upside down as the mod scales it) riding the foe
// while the entry lives. ContinuousDamageHealth declares no
// SupportChance, so the mod's Throwing.Chance reaches an effect that
// never rolls it: the fire takes on every hit that lands. Kept.
//
// NOT CARRIED, recorded: the light's shadows (EmissionShadows - the
// renderer's point lights cast none); Light.intensity's flicker on a
// dropped torch (1.25 + sin(2t) x 0.1 - the port's lights have range,
// no intensity, as playerTorch.js records) - the range law is kept;
// Bloodfall's GUID (no such mod); the Custom Tooltips names.

import { GLOBAL_SCALE, pickFoeHit, RAY_DISTANCE, DEFAULT_ACTIVATION_DISTANCE } from '../player/activate.js';
import { templateByIndex } from '../systems/itemTemplates.js';
import { TEMPLATES } from '../systems/useItem.js';
import { applySpell } from '../systems/effects.js';
import { calculateSuccessfulHit, calculateStruckBodyPart } from '../combat/formulas.js';
import { liveStat } from '../systems/statMods.js';
import { worldMinutes } from '../systems/worldTick.js';
import { FlatAnim } from '../render/flatAnimation.js';
import { toColor32 } from '../formats/color32Order.js';   // TEX1: the SHAPE the upload path reads
import { decodePng } from '../systems/textureReplacement.js';
import { torchRange } from '../systems/playerTorch.js';
import {
  DROPPED_ARCHIVE, DROPPED_RECORD, CLIPS, MESSAGES, SECONDS_PER_CONDITION, THROW_HAND_OFFSET, FREE_HAND, rotateAboutAxis, readTorchSettings,
} from '../systems/handheldTorches.js';

/** The mod's key for its light effect (HandheldTorchesEnemyLight.EffectKey). */
export const ENEMY_LIGHT_EFFECT_KEY = 'HandheldTorchesEnemyLight';
/** The active entry's kind on a burning foe (the port's activeEffects vocabulary). */
export const ENEMY_FIRE_KIND = 'handheldTorchFire';
/** The flame: TEXTURE.375 record 0 at 15 fps (DoPuff, 0x45bf-0x462f). */
export const PUFF = Object.freeze({ archive: 375, record: 0, fps: 15 });
/** The light a foe carries sits behind and above its feet (0x449d-0x44b6). */
export const ENEMY_LIGHT_LOCAL = Object.freeze({ back: 0.4, up: 0.6 });
/** RegisterCustomActivation's reach (0x7e8): 3.2, the default. */
export const PICKUP_REACH = 3.2;
/** Unity's fixed step. */
export const PROJECTILE_FIXED_DT = 0.02;
/** The projectile's constants (.ctor 0x4bce, FixedUpdate). */
export const PROJECTILE = Object.freeze({ gravityAccel: -9.81, restFraction: 0.2, spinRate: 20, restRaise: 0.016, audioGap: 0.2, baseSpeed: 25 });
/** A dropped light under a dungeon's water is doused (0x3726-0x3775): its top 1.25 above the point, below the water plane. */
export const WATER_HEAD = 1.25;
/** AUDIT 66 F1: WHERE THE LIGHT SITS. The mod raises the CENTRED
 *  billboard by half its texture height so its base lands on the drop
 *  point (0x37f4), and then hangs the light half a unit above the
 *  BILLBOARD (0x38b0-0x38cf) - so the flame is at
 *  `point + halfHeight + 0.5`, over the torch's head. The port's
 *  batches are base-aligned (render/frustum.js: "the quad rises a full
 *  height above the base"), so the drop point IS the centre the mod
 *  computes - but the light was read off the point alone and sat half a
 *  torch (0.425) too low, under the floor of anything it stood on. */
export const LIGHT_ABOVE_BILLBOARD = 0.5;

const RECORD_FOR = Object.freeze({ [TEMPLATES.Torch]: DROPPED_RECORD.Torch, [TEMPLATES.Candle]: DROPPED_RECORD.Candle, [TEMPLATES.Holy_candle]: DROPPED_RECORD.HolyCandle });
const GROUP_FOR = Object.freeze({ [TEMPLATES.Torch]: 'UselessItems2', [TEMPLATES.Candle]: 'UselessItems2', [TEMPLATES.Holy_candle]: 'ReligiousItems' });
export const droppedTextureUrl = (record, frame, emission = false) =>
  new URL(`../../vendor/handheld-torches/Textures/${DROPPED_ARCHIVE}_${record}-${frame}${emission ? '_Emission' : ''}.png`, import.meta.url).href;

/**
 * deps = { renderer, audio, getTexture, uploadRecordFrame, collider(), foes(), foeSinks(f), makeEnemiesHostile(),
 *          entity (the player), camera() -> { pos, feet, yaw, pitch, forward, right, up }, inside(), waterLevel() (a dungeon's, or null),
 *          pixelKeyAt(pos) (the streaming host's, or null), settings(), rolls, say, loadTexture(record, frame) }
 */
export function createDroppedTorches({
  renderer, audio = null, getTexture = null, uploadRecordFrame = null, collider = () => null, foes = () => [], foeSinks = null, makeEnemiesHostile = null,
  entity = null, camera = () => null, inside = () => true, waterLevel = () => null, pixelKeyAt = () => null,
  settings = readTorchSettings, rolls = Math.random, say = () => {}, loadTexture = defaultLoadTexture,
  onPickedUp = null,
} = {}) {
  const dropped = [];      // { id, template, record, pos, time, batch, anim, size, loop, mirrored, pixelKey, dead }
  const projectiles = [];  // { template, time, pos, dirStart, speedStart, speedCurrent, gravityDrag, bounce, gravity, batch, size, record, lastAudio, dead, acc }
  const flames = new Map();   // foe -> { batch, anim, pos }
  let _nextId = 0;
  let _lastMinutes = null;
  let _time = 0;
  const frames = new Map();   // record -> { count, size: {w,h} } once its textures are up
  const framesLoading = new Map();

  /** The archive's records, uploaded from the mod's own PNGs: frames until one is missing; the lit records' emission masks white (`_Emission` twins). */
  function ensureRecord(record) {
    if (frames.has(record)) return frames.get(record);
    if (!framesLoading.has(record)) {
      framesLoading.set(record, (async () => {
        let count = 0, size = null;
        // TEX1: the UPLOAD can throw (an image in the wrong shape), and this
        // promise is only ever `.then`ed by a mount that may not have happened
        // yet - so a throw escaped as an unhandled rejection and took the page
        // down. It fails to a console line and an EMPTY record now: `build`
        // already no-ops on `!entry?.count`, which is the mod running without
        // its sprites, exactly as it runs when the files are missing.
        try {
          for (let f = 0; f < 16; f++) {
            const img = await loadTexture(record, f).catch(() => null);
            if (!img) break;
            renderer?.uploadTexture?.(DROPPED_ARCHIVE, `${record}#${f}`, img);
            if (record < DROPPED_RECORD.DousedOffset) renderer?.uploadEmissionTexture?.(DROPPED_ARCHIVE, `${record}#${f}`, img, { white: true });
            size ??= { w: img.width * GLOBAL_SCALE, h: img.height * GLOBAL_SCALE };
            count++;
          }
        } catch (e) {
          console.warn('[dropped torches] the sprites would not load', e);
        }
        const entry = { count, size };
        frames.set(record, entry);
        return entry;
      })());
    }
    return null;
  }
  const s = () => settings();
  const scale = () => (s().scaleTextureFactor || 1);

  function mount(d) {
    const ready = ensureRecord(d.record);
    const build = (entry) => {
      if (d.dead || !entry?.count || !renderer?.createBillboardBatch) return;
      d.size = { w: entry.size.w / scale() * (d.mirrored ? -1 : 1), h: entry.size.h / scale() };
      d.batch = renderer.createBillboardBatch(DROPPED_ARCHIVE, d.record, d.size, [d.pos]);
      d.batch.frame = 0;
      d.anim = entry.count > 1 ? new FlatAnim(DROPPED_ARCHIVE, entry.count, false) : null;
    };
    if (ready) build(ready); else framesLoading.get(d.record).then(build).catch(() => {});
  }
  function unmount(d) {
    if (d.batch) { renderer?.destroyBillboardBatch?.(d.batch); d.batch = null; }
    if (d.loop) { d.loop.stop?.(); d.loop = null; }
  }

  /** The doused record for a point under a dungeon's water (0x3726). */
  function recordAt(template, pos) {
    let record = RECORD_FOR[template];
    if (record == null) return null;
    const wl = waterLevel?.();
    if (inside?.() && Number.isFinite(wl) && wl !== 10000 && pos[1] + WATER_HEAD < -wl * GLOBAL_SCALE) record += DROPPED_RECORD.DousedOffset;
    return record;
  }
  const lit = (d) => d.record < DROPPED_RECORD.DousedOffset;

  /** SpawnLightSource (0x3724): the billboard at the point, mirrored on a coin, its light and loop if lit, tracked by the streaming host outdoors. */
  function spawnLightSource(template, pos, time) {
    const record = recordAt(template, pos);
    if (record == null) return null;
    const d = { id: ++_nextId, template, record, pos: [pos[0], pos[1], pos[2]], time, batch: null, anim: null, size: null, loop: null,
      mirrored: rolls() > 0.5, pixelKey: inside?.() ? null : (pixelKeyAt?.(pos) ?? null), dead: false };
    if (!dropped.length) _lastMinutes = worldMinutes();   // AUDIT 66 F2: the first light into an empty pool starts its own clock - an empty pool burns nothing, so the hours it slept are nobody's
    dropped.push(d);
    mount(d);
    if (lit(d) && template === TEMPLATES.Torch) d.loop = audio?.loop3d?.(CLIPS.burning, d.pos, s().sfxVolume, { maxDistance: 5, distanceModel: 'linear' }) ?? null;
    return d;
  }

  /** SpawnLightSourceProjectile (0x39dc) + Projectile.Initialize (0x4688): from the free hand's side, the look tilted up by the angle and scattered by the dispersion. */
  function spawnLightSourceProjectile(template, time, pos, dir, strength, freeHand = FREE_HAND.Right) {
    const cam = camera?.() ?? {};
    const right = cam.right ?? [Math.cos(cam.yaw || 0), 0, -Math.sin(cam.yaw || 0)];
    const up = cam.up ?? [0, 1, 0];
    const side = freeHand === FREE_HAND.Right ? THROW_HAND_OFFSET : -THROW_HAND_OFFSET;
    const at = [pos[0] + right[0] * side, pos[1] + right[1] * side, pos[2] + right[2] * side];
    const record = recordAt(template, at);
    if (record == null) return null;
    const st = s();
    const range = () => st.throwSpread * (rolls() * 2 - 1);   // Random.Range(-1, 1)
    let d0 = rotateAboutAxis(dir, right, -st.throwAngle + range());
    d0 = rotateAboutAxis(d0, up, range());
    const speedStart = PROJECTILE.baseSpeed * (liveStat(entity, 'strength') / 100) * st.throwStrength * strength;
    const p = { template, time, record, pos: at, dirStart: d0, speedStart, speedCurrent: speedStart, gravityDrag: 0.05 * st.throwGravity,
      bounce: st.throwBounce, gravity: [0, 0, 0], batch: null, size: null, base: null, lastAudio: -Infinity, dead: false, acc: 0, loop: null };
    // AUDIT 66 F3: the THROWN torch's billboard is set to the flight
    // point RAW (0x3a9b) - no half-height raise, unlike the dropped
    // one - so the mod's centred quad is centred ON the flight point.
    // The port's batches are base-aligned, so the base goes half a
    // height below it; read off the point alone the sprite flew half a
    // torch above its own arc (and above the light at +0.5, which the
    // mod hangs over the quad's middle).
    projectiles.push(p);
    const ready = ensureRecord(record);
    const build = (entry) => {
      if (p.dead || !entry?.count) return;
      p.base = { w: entry.size.w / scale(), h: entry.size.h / scale() };
      p.size = { ...p.base };
      p.batch = renderer?.createBillboardBatch?.(DROPPED_ARCHIVE, record, p.size, [flightBase(p)]) ?? null;
      if (p.batch) p.batch.frame = 0;
      p.anim = entry.count > 1 ? new FlatAnim(DROPPED_ARCHIVE, entry.count, false) : null;
    };
    if (ready) build(ready); else framesLoading.get(record).then(build).catch(() => {});
    if (lit({ record }) && template === TEMPLATES.Torch) p.loop = audio?.loop3d?.(CLIPS.burning, p.pos, st.sfxVolume, { maxDistance: 5, distanceModel: 'linear' }) ?? null;
    return p;
  }

  /** AUDIT 66 F3: the base a CENTRED quad needs to sit on the flight point. */
  const flightBase = (p) => [p.pos[0], p.pos[1] - Math.abs(p.base?.h ?? 0) / 2, p.pos[2]];

  /** Projectile.FixedUpdate (0x47a4), one 0.02 s step. */
  function stepProjectile(p) {
    p.gravity = [p.gravity[0], p.gravity[1] + PROJECTILE.gravityAccel * p.gravityDrag * PROJECTILE_FIXED_DT, p.gravity[2]];
    const step = [p.dirStart[0] * p.speedCurrent * PROJECTILE_FIXED_DT + p.gravity[0], p.dirStart[1] * p.speedCurrent * PROJECTILE_FIXED_DT + p.gravity[1], p.dirStart[2] * p.speedCurrent * PROJECTILE_FIXED_DT + p.gravity[2]];
    if (p.base) p.size = { w: p.base.w * Math.sin(_time * PROJECTILE.spinRate), h: p.base.h };   // localScale.x = sin(20t) / factor: the spin
    const len = Math.hypot(step[0], step[1], step[2]);
    if (!(len > 0)) return;
    const dir = [step[0] / len, step[1] / len, step[2] / len];
    const col = collider?.();
    const wall = col?.raycastHit ? col.raycastHit(p.pos, dir, len) : { dist: col?.raycast?.(p.pos, dir, len) ?? Infinity, normal: null };
    const wallD = Number.isFinite(wall?.dist) ? wall.dist : Infinity;
    const foe = pickFoeHit(p.pos, dir, foes?.() ?? [], col, len);
    if (foe && foe.distance <= wallD) {
      // an entity (0x4886-0x4a4a): hostile now; a landed hit sets it alight; the torch is spent either way
      const f = foe.foe;
      const point = [p.pos[0] + dir[0] * foe.distance, p.pos[1] + dir[1] * foe.distance, p.pos[2] + dir[2] * foe.distance];
      if (s().fire && f?.entity) {
        if (f.ai && f.ai.isHostile === false) makeEnemiesHostile?.();
        f.ai?.makeEnemyHostileToAttacker?.(entity, camera?.()?.feet ?? null);
        const hit = calculateSuccessfulHit(entity, f.entity, s().fireAccuracy, calculateStruckBodyPart(rolls()), rolls);
        if (hit) igniteFoe(f);
        audio?.play3d?.(CLIPS.ignite, point, 1);
      }
      retireProjectile(p);
      return;
    }
    if (Number.isFinite(wallD)) {
      const point = [p.pos[0] + dir[0] * wallD, p.pos[1] + dir[1] * wallD, p.pos[2] + dir[2] * wallD];
      if (p.speedCurrent < p.speedStart * PROJECTILE.restFraction) {
        // come to rest (0x4a4b-0x4ac5): a dropped light at the point
        spawnLightSource(p.template, point, p.time);
        if (_time - p.lastAudio > PROJECTILE.audioGap) { audio?.play3d?.(CLIPS.drop, point, 1); p.lastAudio = _time; }
        retireProjectile(p);
        return;
      }
      // the bounce (0x4aca-0x4bb4): the flight's x/z with the gravity's y, reflected; the speed by Bounciness; the gravity dropped
      const n = wall.normal ?? [0, 1, 0];
      const v = [p.dirStart[0], p.gravity[1], p.dirStart[2]];
      const vn = v[0] * n[0] + v[1] * n[1] + v[2] * n[2];
      p.dirStart = [v[0] - 2 * vn * n[0], v[1] - 2 * vn * n[1], v[2] - 2 * vn * n[2]];
      p.speedCurrent *= p.bounce;
      p.gravity = [0, 0, 0];
      if (_time - p.lastAudio > PROJECTILE.audioGap) { audio?.play3d?.(CLIPS.drop, point, 1); p.lastAudio = _time; }
      const h = (p.base?.h ?? 0) / GLOBAL_SCALE;   // the texture's height in pixels
      const k = h * PROJECTILE.restRaise / scale();
      p.pos = [point[0] + n[0] * k, point[1] + n[1] * k, point[2] + n[2] * k];
    } else {
      p.pos = [p.pos[0] + step[0], p.pos[1] + step[1], p.pos[2] + step[2]];
    }
    if (p.batch) { renderer.destroyBillboardBatch(p.batch); p.batch = renderer.createBillboardBatch(DROPPED_ARCHIVE, p.record, p.size, [flightBase(p)]); p.batch.frame = p.anim?.frame ?? 0; }
    p.loop?.move?.(p.pos);
  }
  function retireProjectile(p) {
    p.dead = true;
    if (p.batch) { renderer?.destroyBillboardBatch?.(p.batch); p.batch = null; }
    p.loop?.stop?.(); p.loop = null;
    const i = projectiles.indexOf(p);
    if (i >= 0) projectiles.splice(i, 1);
  }

  /** The foe set alight (0x495f-0x4a1d): DFU's Continuous Damage-Health with the mod's numbers on the foe's own manager, and the mod's light beside it. */
  function igniteFoe(f) {
    const st = s();
    const e = {
      type: 1, subType: 0, key: 'ContinuousDamage-Health',
      durationBase: st.fireDuration, durationMod: 0, durationPerLevel: 1,
      chanceBase: st.fireChance, chanceMod: 0, chancePerLevel: 1,
      magnitudeBaseLow: st.fireDamageRange[0], magnitudeBaseHigh: st.fireDamageRange[1], magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
    };
    const level = f.entity.level ?? 1;
    const sinks = foeSinks?.(f) ?? { hurt: (n) => { f.entity.health = Math.max(0, (f.entity.health ?? 0) - n); } };
    applySpell({ effects: [e], element: 0, rangeType: 0 }, level, f.entity, sinks, rolls, { entity: f.entity });
    if (st.fireLight) {
      // the light effect: duration alone; AddState stacks a re-hit's rounds (0x4426)
      const list = (f.entity.activeEffects ??= []);
      const inc = list.find((a) => a.kind === ENEMY_FIRE_KIND);
      if (inc) inc.roundsRemaining += st.fireDuration;
      else list.push({ kind: ENEMY_FIRE_KIND, key: ENEMY_LIGHT_EFFECT_KEY, roundsRemaining: st.fireDuration });
    }
  }
  const foeBurning = (f) => !!f?.entity?.activeEffects?.some((a) => a.kind === ENEMY_FIRE_KIND && a.roundsRemaining > 0);
  /** Where the foe's light and flame sit: behind and above its feet (the mod's child at back 0.4, up 0.6). */
  function foeLightPos(f) {
    const feet = f.ai?.feet;
    if (!feet) return null;
    const yaw = f.ai?.yaw ?? 0;
    return [feet[0] - Math.sin(yaw) * ENEMY_LIGHT_LOCAL.back, feet[1] + ENEMY_LIGHT_LOCAL.up, feet[2] - Math.cos(yaw) * ENEMY_LIGHT_LOCAL.back];
  }
  function tickFlames(dt) {
    const live = foes?.() ?? [];
    for (const f of live) {
      const burning = !f.dead && foeBurning(f);
      const fl = flames.get(f);
      if (burning && !fl) {
        const entry = { batch: null, anim: null, pos: foeLightPos(f) ?? [0, 0, 0], size: null };
        flames.set(f, entry);
        getTexture?.(PUFF.archive)?.then((t) => {
          if (!flames.has(f) || !t) return;
          const count = t.getFrameCount?.(PUFF.record) ?? 1;
          for (let i = 0; i < count; i++) uploadRecordFrame?.(PUFF.archive, PUFF.record, i);
          const size = t.getSize(PUFF.record);
          entry.size = { w: size.width * GLOBAL_SCALE, h: -size.height * GLOBAL_SCALE };   // localScale.y negated (0x4614): the flame drawn upside down
          entry.batch = renderer.createBillboardBatch(PUFF.archive, PUFF.record, entry.size, [entry.pos]);
          entry.batch.frame = 0;
          entry.anim = count > 1 ? new FlatAnim(PUFF.archive, count, false, PUFF.fps) : null;
        }).catch(() => {});
      } else if (!burning && fl) {
        if (fl.batch) renderer?.destroyBillboardBatch?.(fl.batch);
        flames.delete(f);
      } else if (burning && fl?.batch) {
        const at = foeLightPos(f);
        if (at && (at[0] !== fl.pos[0] || at[1] !== fl.pos[1] || at[2] !== fl.pos[2])) {
          fl.pos = at;
          renderer.destroyBillboardBatch(fl.batch);
          fl.batch = renderer.createBillboardBatch(PUFF.archive, PUFF.record, fl.size, [fl.pos]);
        }
        if (fl.anim) fl.batch.frame = fl.anim.tick(dt);
      }
    }
    for (const [f, fl] of [...flames]) if (!live.includes(f)) { if (fl.batch) renderer?.destroyBillboardBatch?.(fl.batch); flames.delete(f); }
  }

  /** The burn (Update 0x19f4-0x1bdc, and the rest hook 0x388): the world clock's seconds over twelve, off every dropped light; dead at zero. */
  function tick(dt) {
    _time += dt;
    const now = worldMinutes();
    // AUDIT 66 F2: the world clock is the burn's clock, so every JUMP
    // in it burned - and a load is a jump. DFU's per-frame arm reads
    // Time.deltaTime (0x1a4c), which no load inflates, and the only
    // clock jump the mod answers is the REST window's own
    // (OnRestWindowClose, 0x45b-0x48c). The pool re-latches wherever
    // the clock can move without the player living through it (a
    // restore, a transition sweep), so a rest still ages the torches
    // and a load never does.
    const burn = _lastMinutes == null ? 0 : Math.max(0, (now - _lastMinutes) * 60 / 12);
    _lastMinutes = now;
    for (let i = dropped.length - 1; i >= 0; i--) {
      const d = dropped[i];
      d.time -= burn;
      if (d.time <= 0) { d.template = 0; d.dead = true; unmount(d); dropped.splice(i, 1); continue; }
      if (d.batch && d.anim) d.batch.frame = d.anim.tick(dt);
    }
    for (const p of [...projectiles]) {
      p.acc += dt;
      while (p.acc >= PROJECTILE_FIXED_DT && !p.dead) { p.acc -= PROJECTILE_FIXED_DT; stepProjectile(p); }
      if (!p.dead && p.batch && p.anim) p.batch.frame = p.anim.tick(dt);
    }
    tickFlames(dt);
  }

  /** The lights the host composes: a lit dropped light's range by the time left, and a burning foe's - the player torch's range. */
  function lights() {
    const out = [];
    for (const d of dropped) {
      if (!lit(d)) continue;
      const t = templateByIndex(d.template);
      const full = (t?.hitPoints ?? 1) * SECONDS_PER_CONDITION;
      // AUDIT 66 F1: over the billboard's head, as the mod hangs it.
      // AUDIT 66 F10: and NOT scaled by PlayerTorchLightScale - the mod
      // multiplies this range by it (0x1bb3), but the port's own lane
      // holds that setting inert for exactly this reason
      // (playerTorch.js:56-59: "it is a 0..1 BRIGHTNESS ... mapping a
      // brightness slider onto a radius would be a worse lie"). One
      // decision, one place; the dep the hosts never passed is gone.
      out.push({ x: d.pos[0], y: d.pos[1] + Math.abs(d.size?.h ?? 0) / 2 + LIGHT_ABOVE_BILLBOARD, z: d.pos[2], range: 1 + (t?.capacityOrTarget ?? 0) * (d.time / full) });
    }
    // the thrown torch's light hangs over its quad's own centre (0x3ad0-0x3aea), and its range is the template's, flat (0x3b41)
    for (const p of projectiles) if (lit(p)) out.push({ x: p.pos[0], y: p.pos[1] + LIGHT_ABOVE_BILLBOARD, z: p.pos[2], range: templateByIndex(p.template)?.capacityOrTarget ?? 0 });
    const playerRange = entity?.lightSource ? torchRange(entity.lightSource) : (templateByIndex(TEMPLATES.Torch)?.capacityOrTarget ?? 14);
    for (const [f, fl] of flames) if (!f.dead) out.push({ x: fl.pos[0], y: fl.pos[1], z: fl.pos[2], range: playerRange });
    return out;
  }
  const batches = () => [...dropped.map((d) => d.batch), ...projectiles.map((p) => p.batch), ...[...flames.values()].map((fl) => fl.batch)].filter(Boolean);

  /** RegisterCustomActivation's six records at 3.2 (0x7d1-0x895): what the eye ray may pick. */
  function targets() {
    return dropped.filter((d) => d.batch).map((d) => ({
      key: `droppedTorch:${d.id}`,
      aabb: { min: [d.pos[0] - 0.4, d.pos[1], d.pos[2] - 0.4], max: [d.pos[0] + 0.4, d.pos[1] + Math.abs(d.size?.h ?? 0.8), d.pos[2] + 0.4] },
      distance: RAY_DISTANCE, reach: PICKUP_REACH,
    }));
  }
  const forKey = (key) => dropped.find((d) => `droppedTorch:${d.id}` === key) ?? null;
  /** PickUpLightSource (0x3be4): Grab or Steal picks it up; Info or Talk names it. */
  function activate(key, mode) {
    const d = forKey(key);
    if (!d) return false;
    if (mode === 'grab' || mode === 'steal') { pickupLightSource(d); return true; }
    if (mode === 'info' || mode === 'dialogue') { say(MESSAGES.examine + (templateByIndex(d.template)?.name ?? '').toLowerCase()); return true; }
    return false;
  }
  /** PickupLightSource (0x3d18): the item minted with ceil(time / 20) condition, the billboard gone; the component decides the hand. */
  function pickupLightSource(d) {
    const item = { group: GROUP_FOR[d.template], templateIndex: d.template };
    const t = templateByIndex(d.template);
    item.maxCondition = t?.hitPoints ?? 0;
    item.currentCondition = Math.ceil(d.time / SECONDS_PER_CONDITION);
    d.template = 0; d.dead = true; unmount(d);
    const i = dropped.indexOf(d);
    if (i >= 0) dropped.splice(i, 1);
    onPickedUp?.(item);
    return item;
  }

  /** DestroyLightSources (0x403c): every transition and every load. */
  function destroyAll() {
    _lastMinutes = worldMinutes();   // AUDIT 66 F2: the sweep is a transition - what the clock did across it is not this pool's to burn
    for (const d of dropped) unmount(d);
    dropped.length = 0;
    for (const p of [...projectiles]) retireProjectile(p);
    for (const [, fl] of flames) if (fl.batch) renderer?.destroyBillboardBatch?.(fl.batch);
    flames.clear();
  }
  /** The streaming host's sweep: a light on an evicted pixel goes with it (TrackLooseObject's parent). */
  function collectPixel(key) {
    for (let i = dropped.length - 1; i >= 0; i--) if (dropped[i].pixelKey === key) { unmount(dropped[i]); dropped[i].dead = true; dropped.splice(i, 1); }
  }
  /** THE FOUR HOSTS RULE: a floating-origin recenter moves the pool. */
  function offsetAll(offset) {
    const [dx, dy, dz] = offset;
    for (const d of dropped) {
      d.pos[0] += dx; d.pos[1] += dy; d.pos[2] += dz;
      if (d.batch) { renderer.destroyBillboardBatch(d.batch); d.batch = renderer.createBillboardBatch(DROPPED_ARCHIVE, d.record, d.size, [d.pos]); d.batch.frame = d.anim?.frame ?? 0; }
      d.loop?.move?.(d.pos);
    }
    for (const p of projectiles) {
      p.pos = [p.pos[0] + dx, p.pos[1] + dy, p.pos[2] + dz];
      if (p.batch) { renderer.destroyBillboardBatch(p.batch); p.batch = renderer.createBillboardBatch(DROPPED_ARCHIVE, p.record, p.size, [flightBase(p)]); p.batch.frame = p.anim?.frame ?? 0; }
      p.loop?.move?.(p.pos);   // AUDIT 66 F3: a recenter moves the flight's sprite and its loop, as it moves a dropped light's
    }
    // AUDIT 66 F12: the burning foe's flame moved its POSITION and left
    // its quad where it stood. The dropped lights above rebuild theirs
    // because a batch's centers are baked at build; the flame's only
    // other rebuild is tickFlames' "the foe moved" test, which compares
    // the foe's own (already recentred) feet against this (already
    // recentred) position and finds them equal - so the flame stayed at
    // the pre-recenter spot for as long as the foe burned.
    for (const [, fl] of flames) {
      fl.pos = [fl.pos[0] + dx, fl.pos[1] + dy, fl.pos[2] + dz];
      if (fl.batch) { renderer.destroyBillboardBatch(fl.batch); fl.batch = renderer.createBillboardBatch(PUFF.archive, PUFF.record, fl.size, [fl.pos]); fl.batch.frame = fl.anim?.frame ?? 0; }
    }
  }
  /** HandheldTorchesSaveData (0x4c34 / 0x4cc8): position, time and template of each; restored by spawning each. */
  const snapshot = (toWorld = (p) => p) => dropped.filter((d) => d.template).map((d) => { const p = toWorld(d.pos); return { position: [p[0], p[1], p[2]], time: d.time, itemTemplateIndex: d.template }; });
  function restore(list, fromWorld = (p) => p) {
    destroyAll();
    _lastMinutes = worldMinutes();   // AUDIT 66 F2: the save's own clock, not the outgoing session's
    for (const r of list ?? []) {
      if (!r || RECORD_FOR[r.itemTemplateIndex] == null || !(r.time > 0)) continue;   // record 0 is the torch: a null test, never a truth test
      const p = fromWorld(r.position);
      spawnLightSource(r.itemTemplateIndex, [p[0], p[1], p[2]], r.time);
    }
  }

  return {
    spawnLightSource, spawnLightSourceProjectile, tick, lights, batches, targets, activate, destroyAll, collectPixel, offsetAll, snapshot, restore,
    igniteFoe, foeBurning,
    get dropped() { return dropped; }, get projectiles() { return projectiles; },
    setOnPickedUp(fn) { onPickedUp = typeof fn === 'function' ? fn : null; },
  };
}

/** The default texture loader: the vendored PNG in the port's color32 order,
 *  in the shape `uploadTexture` reads - `{ width, height, colors }` (TEX1). */
async function defaultLoadTexture(record, frame) {
  const res = await fetch(droppedTextureUrl(record, frame));
  if (!res.ok) return null;
  return toColor32(await decodePng(new Uint8Array(await res.arrayBuffer())));
}
