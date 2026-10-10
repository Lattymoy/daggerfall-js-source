// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LW3 - THE ROAD'S PEOPLE, SEEN (bible/06-Systems/Living-World.md).
//
// Each member of a party on the road (systems/livingWorld/trips.js) as a billboard: one walking ARMED (an adventurer, a
// caravan's sellsword, a courier - LW0 decision 5) in their class's eight-way sprite, the enemy's own MobileUnit on the
// class archive (the bands' body, world/bandSprites.js); the rest in their own townsperson's outfit, the walker's
// billboard (characters/residentWalker.js - the street's records on the outfit's archive). Faded in by distance as the
// bands are, and grown under the Overworld. Where each stands is the roads' (scenes/livingRoads.js); this draws, and
// answers each drawn body as a talk target (the street's own shape: `nameNPC`, `personFaceRecordId`, `_talkSeed`).
//
// EVERY ALLOCATION HAS AN OWNER: a body's billboard batch is made with it and freed when it leaves the list, and
// `clear()` frees them all (the host's teardown and every frame outside the open world).
//
// LW4: THE ROAD'S TROUBLE, SEEN. A body can STRIKE (an armed member or a foe, the unit's own attack on the edge the
// roads hand it), stand as no talk target (a foe: `talk: false`), or be a FLAT - a still picture (`flat: { archive,
// record }`: the fallen, on the class corpse's own record) on the same batch law.
//
// LW-LOOKS: A RESIDENT'S STILL PICTURE (systems/livingWorld/looks.js - a courtier at home in the palace) is a flat too,
// and a talk target in the street's shape as any resident is (the fallen, `talk: false`, none); its frames animated on
// the game's own billboard clock (render/flatAnimation.js FlatAnim) as Daggerfall's still people are.
//
// MWNPC10c (bible/04-Characters/Morrowind-NPCs.md section 15c): EACH BODY ON THE GROUND IN ITS MORROWIND BODY, on a lane
// of the host's own (`laneName`: the roads', a room's) - dressed as its sprite shows it (characters/rosterBodies.js
// residentLook: a class's sprite its class's look and blade, a still picture its kind's garments, the rest their own
// outfit), walking as it walks, each strike begun a blow, the fallen dead; offered by `drawBodies` before the host's
// billboard pass draws the sprites (cast-only where a body stands). Never under the Overworld: the bands' grown,
// fading sprites are the far view's.
// ═══════════════════════════════════════════════════════════════════
import { MobileUnit } from '../characters/mobileUnit.js';
import { ENEMY_BASICS } from '../characters/enemyBasics.js';
import { ResidentWalker } from '../characters/residentWalker.js';
import { mobileBillboardSize } from './rmbFlats.js';
import { bandSpriteReach, stepBandAlpha, BAND_SPRITE_FAR_M } from './bandSprites.js';
import { lwSeed, textSeed } from '../systems/livingWorld/seed.js';
import { FlatAnim } from '../render/flatAnimation.js';
import { createPopulationLane } from '../characters/npcBodies.js'; import { residentLook, rosterActor } from '../characters/rosterBodies.js';   // MWNPC10c

/** Under the Overworld a body past this (m) is not drawn - the bands' own far edge, the same fade. */
export const TRAVELLER_FAR_M = BAND_SPRITE_FAR_M;
/** Below this opacity nothing is drawn. */
const ALPHA_MIN = 0.02;
/** The renderer's blended pass, plain (render/renderer.js uConceal). */
const PLAIN_BLEND_MODE = 3;

/** A resident's class sprite: the class's basics and its archive by their sex, or null (no class, no art). @param {any} res */
export function classLookOf(res) {
  const basics = res?.cls != null ? ENEMY_BASICS[res.cls] : null;
  if (!basics) return null;
  const archive = res.sex === 'female' && basics.femaleTexture ? basics.femaleTexture : basics.maleTexture;
  return archive ? { mobileType: res.cls, basics, archive } : null;
}

/**
 * @param {{ renderer: any, getTexture: (archive: number) => Promise<any>, uploadRecordFrame: (archive: number, record: number, frame: number) => void,
 *   living?: any, laneName?: string, wantBodies?: () => boolean, makeBodies?: (() => any) | null }} deps - `living` the
 *   handle each talk target carries (`person.living.town`: the roads' refusal and noted word); MWNPC10c `laneName` the
 *   body lane's, `wantBodies` / `makeBodies` its seams
 */
export function createTravellerSprites({ renderer, getTexture, uploadRecordFrame, living = null, laneName = 'roads', wantBodies = undefined, makeBodies = null }) {
  const bodiesLane = createPopulationLane({ laneName, renderer, ...(wantBodies ? { want: wantBodies } : {}), make: makeBodies });   // MWNPC10c: their Morrowind bodies
  /** MWNPC10c: the bodies drawn at the last sync, and whether it stood them on the ground */
  const shown = [];
  let _ground = false, _ids = 0;
  /** archive -> texture | null (failed) | Promise (loading) */
  const texs = new Map();
  /** key -> its body */
  const bodies = new Map();
  const drawn = [];
  /** @type {{ person: any, pos: number[] }[]} */
  const seats = [];

  function texOf(archive) {
    if (texs.has(archive)) return texs.get(archive);
    const p = Promise.resolve(getTexture?.(archive)).then((t) => { texs.set(archive, t ?? null); }).catch(() => { texs.set(archive, null); });
    texs.set(archive, p);
    return p;
  }

  function drop(key) {
    const b = bodies.get(key);
    if (b?.batch) renderer?.destroyBillboardBatch?.(b.batch);
    bodies.delete(key);
  }

  /** A body for a resident: armed in their class's sprite where they have one, else their own outfit - LW-LOOKS: or their
   *  still picture, a talk target where it is one (`talk`). */
  function make(res, tex, look, flat = null, talk = true) {
    const talkSeed = lwSeed(textSeed(res.id), 0x74616c6b) & 0x7fffffff;   // 'talk': the town's own seed for them
    if (flat) {
      const person = talk ? { nameNPC: res.name, personFaceRecordId: res.face, _talkSeed: talkSeed, living: { id: res.id, res, town: living },
        pos: [0, 0, 0], facingYaw: 0, guard: false, archive: flat.archive, pickpocketAttempted: false } : null;
      return { res, archive: flat.archive, tex, unit: null, walker: null, person, flat, anim: new FlatAnim(flat.archive, Math.max(1, tex.getFrameCount?.(flat.record) ?? 1)), batch: null, alpha: 0 };
    }
    if (look) {
      const unit = new MobileUnit(look.mobileType, look.basics, (rec) => tex.getFrameCount(rec), Math.random, res.sex ?? 'male');
      const person = { nameNPC: res.name, personFaceRecordId: res.face, _talkSeed: talkSeed, living: { id: res.id, res, town: living },
        pos: [0, 0, 0], facingYaw: 0, guard: false, archive: look.archive, pickpocketAttempted: false };
      return { res, archive: look.archive, tex, unit, walker: null, person, flat: null, batch: null, alpha: 0 };
    }
    const archive = res.civvies ?? res.archive;   // WATCH-DAY: one of the watch here is off duty, in his own clothes (sync's own read)
    const walker = new ResidentWalker({}, { archive, frameCount: (rec) => tex.getFrameCount(rec), groundY: () => 0 });
    walker.nameNPC = res.name; walker.personFaceRecordId = res.face; walker._talkSeed = talkSeed;
    walker.living = { id: res.id, res, town: living };
    return { res, archive, tex, unit: null, walker, person: walker, flat: null, batch: null, alpha: 0 };
  }

  /**
   * One frame. `list`: [{ key, res, feet: [x,y,z] (scene), yaw, moving, distM }]; `eye` the frame's eye; `grow` the
   * Overworld's (1 on the ground); `fade` the view's blend (1 on the ground); `near` the distance whole inside (m) - on
   * the ground the bodies stand whole to the list's own edge.
   * LW4: `striking` the edge an armed body's attack begins on; `talk: false` no talk target (a foe); `flat` a still
   * picture's archive and record (the fallen).
   * @param {Array<{ key: string, res: any, feet: number[], yaw: number, moving: boolean, distM: number, striking?: boolean, talk?: boolean, flat?: { archive: number, record: number } | null }>} list
   * @param {{ dt?: number, eye?: number[]|null, grow?: number, fade?: number, ground?: boolean }} [o]
   */
  function sync(list, { dt = 0, eye = null, grow = 1, fade = 1, ground = true } = {}) {
    drawn.length = 0;
    seats.length = 0;
    shown.length = 0; _ground = !!ground;   // MWNPC10c
    const seen = new Set();
    for (const m of list ?? []) {
      if (!m?.feet || !m.res) continue;
      const flat = m.flat ?? null;
      const look = flat ? null : classLookOf(m.res);
      const archive = flat ? flat.archive : look ? look.archive : (m.res.civvies ?? m.res.archive);   // WATCH-DAY: a watchman off duty in his own clothes
      const tex = texOf(archive);
      if (!tex || typeof tex.then === 'function') continue;   // loading, or no art: not yet
      seen.add(m.key);
      let b = bodies.get(m.key);
      if (!b || b.res.id !== m.res.id || b.archive !== archive || !!b.flat !== !!flat || (flat && b.flat.record !== flat.record)) {
        if (b) drop(m.key);
        b = make(m.res, tex, look, flat, m.talk !== false);
        // MWNPC10c: its lane id (a new body a new one), its blows, whether it talks, its death's roll; its look read once
        Object.assign(b, { id: `${laneName}:${++_ids}`, yaw: 0, moving: false, swings: 0, striking: false, talk: m.talk !== false, roll: 1 + (textSeed(String(m.res.id)) % 3), look: undefined });
        bodies.set(m.key, b);
      }
      b.yaw = m.yaw; b.moving = !!m.moving;
      if (m.striking && !b.striking) b.swings++;   // MWNPC10c: each strike begun, one blow
      b.striking = !!m.striking;
      const target = ground ? 1 : bandSpriteReach(m.distM) * Math.max(0, Math.min(1, fade));
      b.alpha = ground ? 1 : stepBandAlpha(b.alpha, target, dt);
      if (b.alpha < ALPHA_MIN) continue;
      const f = m.feet;
      let out;
      if (b.flat) {
        out = { record: b.flat.record, frame: b.anim ? b.anim.tick(dt) : 0, flip: false };
        if (b.person) { b.person.pos = f; b.person.facingYaw = m.yaw; }
      }
      else if (b.unit) {
        out = b.unit.update(dt, { moving: !!m.moving, striking: !!m.striking }, m.yaw, f, eye && eye.length === 3 ? eye : f);
        b.person.pos = f; b.person.facingYaw = m.yaw;
      } else {
        const w = b.walker;
        w.pos = [f[0], f[1], f[2]]; w.yaw = m.yaw; w.moving = !!m.moving;
        out = w.update(dt, eye && eye.length === 3 ? eye : f, false);
      }
      const rkey = `${out.record}#${out.frame}`;
      if (!renderer?.textures?.has?.(`${b.archive}_${rkey}`)) uploadRecordFrame?.(b.archive, out.record, out.frame);
      const sz = mobileBillboardSize(b.tex, out.record);
      const g = Math.max(1, grow || 1);
      const size = { w: (out.flip ? -sz.w : sz.w) * g, h: sz.h * g };
      if (!b.batch) {
        b.batch = renderer?.createBillboardBatch?.(b.archive, rkey, size, [[0, 0, 0]]) ?? null;
        if (!b.batch) continue;
        b.batch.origin = [0, 0, 0];
      } else {
        b.batch.record = rkey;
        b.batch.size = size;
      }
      b.batch.origin[0] = f[0]; b.batch.origin[1] = f[1]; b.batch.origin[2] = f[2];
      b.batch.conceal = b.alpha >= 0.99 ? null : { mode: PLAIN_BLEND_MODE, alpha: b.alpha, t: 0, phase: 0 };
      drawn.push(b.batch);
      shown.push(b);
      if (ground && b.person && m.talk !== false) seats.push({ person: b.person, pos: f });
    }
    for (const key of [...bodies.keys()]) if (!seen.has(key)) drop(key);
  }

  /**
   * MWNPC10c: the last sync's bodies in their Morrowind bodies, before the host's billboard pass draws their sprites -
   * on the ground only; a class's sprite drawn (its blade out), the rest not; the fallen (a flat no one talks to) dead.
   * @param {any} canvas @param {Float32Array} proj @param {Float32Array} view @param {number[]} eye @param {number} dt
   */
  function drawBodies(canvas, proj, view, eye, dt) {
    bodiesLane.frame();
    if (_ground) {
      for (const b of shown) {
        if (b.look === undefined) b.look = residentLook(b, b.res, { still: !!b.flat && b.talk });
        if (!b.look) continue;
        bodiesLane.offer(rosterActor(b, { id: b.id, look: b.look, feet: b.batch.origin, yaw: b.yaw, moving: b.moving, swingKey: b.swings || null,
          dead: b.flat && !b.talk ? b.roll : 0, drawn: !!b.unit }), b.batch);
      }
    }
    bodiesLane.draw(canvas, proj, view, eye, dt);
  }

  return {
    sync,
    drawBodies,   // MWNPC10c
    /** MWNPC10c: the floating origin moved - the bodies' feet follow it. @param {number[]} o */
    offsetBodies(o) { bodiesLane.offsetAll(o); },
    /** MWNPC13: the veiled bodies (a road's ghost), translucent - after the host's opaque world. */
    drawVeiledBodies() { bodiesLane.drawVeiled(); },
    /** This frame's drawn bodies, for the exterior's billboard pass. */
    batches: () => drawn,
    /** This frame's talk targets on the ground ({ person, pos } - the street's activation shape). */
    persons: () => seats,
    /** The body standing for a resident's id, if drawn. @param {string} key */
    bodyOf: (key) => bodies.get(key) ?? null,
    /** Every body freed (the host's teardown; the open world left). */
    clear() { for (const key of [...bodies.keys()]) drop(key); drawn.length = 0; seats.length = 0; shown.length = 0; bodiesLane.destroy(); },   // MWNPC10c: and their bodies
    get size() { return bodies.size; },
  };
}
