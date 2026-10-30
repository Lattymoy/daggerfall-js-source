// @ts-check
// ARMORY (2026-10-28; bible/04-Characters/Aura-Armory.md section 5, HOST-SPLIT) - THE COSMETICS WORN ON A BODY, in the
// streaming world: the auras at the feet and the Aura Armory's pieces on the body, mine and every drawn peer's. Moved out
// of bootWorld whole (its auraFrame and drawAuras, WB9g to SHOP), with the armory beside them: a module the host wires,
// its state its own. Each frame `frame(seen)` gathers the wearers - their feet, facing, kindling, beast form, a rider's
// fold, and for a piece the pose of the body as drawn - and `draw()` draws both passes after the opaque world, through
// the veiled bodies' hook every mode calls. A kit or an aura the room's token did not carry is said again (`rehello`).
import {
  AuraRingRenderer, auraWearers, auraLookOf, auraBeastStep, auraMotionStep, auraCapeStep, auraSpriteBones, auraSpritePosed, auraWingLights,
  CLOAK_BONES, AURA_KINDLE_S, AURA_FORGET_S,
} from '../render/auraRing.js';
import { auraClothOver, auraSpriteAcross, auraShiftAcross } from '../render/auraRing.js';   // ARMORY-SEEN: whether a body's cloth covers its pieces from the eye
import { ArmoryRenderer, armoryWearers, armoryMotionStep, armoryEyeAtHead, armoryHeadTip, cardRightOf, ARMORY_DETAIL_M } from '../render/armoryPass.js';
import { ARMORY_BONES, newPose, poseFromBones, poseFromFigure, poseAtRest } from '../render/armoryPose.js';
import { compiledPass } from '../render/glProgram.js';
import { peerBodyYaw } from '../net/peer/peerClimb.js';
import { CAPSULE_HEIGHT } from '../player/motor.js';
import { mwViewBodyBones, mwViewSpriteFigure, mwViewSpriteFacing } from '../player/mwView.js';
import { ownAura, ownArmory } from '../systems/ownGlyphs.js';
import { getPref } from '../systems/uiPrefs.js';
import { drawAurasThenBacks, SELF_OWNER } from '../player/eyeOfTheBeholder/eotbHolster.js';   // BACK-HOLSTER: a weapon on a sprite's back over its cape
import { eotbBody } from '../player/eyeOfTheBeholder/eotbBody.js';
import { createSpriteBacks } from '../player/eyeOfTheBeholder/eotbGlow.js';   // BACK-HOLSTER GLOW: the sprites' weapon glows, over the capes
import { armoryKitPieces } from '../net/armoryLaw.js';
import { guildArmsOf, ownGuildArms, setPeerTagReader, setPeerClothReader } from '../net/guild/guildArmsBook.js';   // GUILD-SHOP: the Insignia Armlet wears its wearer's guild's arms

/** GUILD-SHOP: the arms a kit's Insignia Armlet wears - its wearer's guild's (`tag`, the token's), or null for none; a kit
 *  without the armlet reads none, so no guild is asked of for it. Pure but for the arms book's ask. */
export const armletArmsOf = (/** @type {unknown} */ kit, /** @type {unknown} */ tag) => (armoryKitPieces(kit).arms === 'insigniaarmlet' ? guildArmsOf(tag) : null);

/** ARMORY: the "Others' armory" choice (systems/features.js 'armory-others') - every peer's pieces, those within this many
 *  metres, or none. One's own always draws. */
export const ARMORY_NEAR_M = 20;
export const armoryOthersOf = (/** @type {unknown} */ v) => (v === 'near' || v === 'none' ? v : 'all');

/** ARMORY-SEEN: the armory's wearers drawn this frame (`kits`), split by the aura each wears (`auras`, by id): `under` those
 *  whose cloth covers them from `eye` (auraRing.js auraClothOver), drawn before the auras so the cloth lies over them;
 *  `over` the rest, drawn after. Both lists refilled. Pure but for them. */
export function armoryLayers(/** @type {any[]} */ kits, /** @type {any[]} */ auras, /** @type {ArrayLike<number>} */ eye, /** @type {any[]} */ under, /** @type {any[]} */ over) {
  under.length = 0; over.length = 0;
  for (const k of kits) {
    const a = auras.find((w) => w.id === k.id);
    (a && auraClothOver(a, eye) ? under : over).push(k);
  }
  return under;
}

/** CAPE-CARD (2026-10-30): what the first sprite layer that draws peer `id` answers to `ask` ('figureOf', 'faceOf') - each
 *  layer draws a peer as a picture on a card (the Eye of the Beholder walkers and riders, the paperdolls and class
 *  sprites), and a peer stands in one at most. `eye` the camera the answer is for. Pure. */
export const spriteAnswer = (/** @type {any[]} */ layers, /** @type {string} */ ask, /** @type {string} */ id, /** @type {any} */ eye = null) => {
  for (const l of layers) { const a = l?.[ask]?.(id, eye); if (a) return a; }
  return null;
};

/** AURA-ON-DRAGON: feet `f` lifted `lift` metres. Pure but for `f`. */
const liftedFeet = (/** @type {number[]} */ f, /** @type {number} */ lift) => { f[1] += lift; return f; };

/** A peer's seed, by its id - the auras' own (FNV-1a over the id, a share of 997). Pure. */
export const auraSeedOf = (/** @type {string} */ id) => { let h = 2166136261; for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return ((h >>> 0) % 997) / 997; };

/**
 * THE HOST'S WIRING - each a getter, read when a frame asks (bootWorld builds its pieces after this):
 * @param {{
 *   renderer: any, online: () => any, travelActive: () => boolean, quiet: () => boolean, player: () => any, camYaw: () => number,
 *   spawned: () => boolean, beast: () => boolean, veiled: (id: string) => boolean, toScene: (shown: any) => number[],
 *   sprites: () => any[], bodies: () => any, selfLift?: () => number, peerLift?: (d: any) => number,
 * }} deps
 */
export function createAuraHost(deps) {
  const { renderer } = deps;
  /** The aura the last minted token said, and the kit (undefined until a service that says one) - a wear since is said
   *  again at the next frame (AURA-LIVE). */
  let auraHeard, armoryHeard;
  let gathered = 0;
  let selfLiftNow = 0;   // AURA-ON-DRAGON: the frame's lift of my own (frame's), for the cape hung in draw   // PROFILE-SLOTS: the frames gathered - a name lifts only over a piece drawn in this one (nameTopOf)
  const acrossRight = [1, 0, 0];   // BACK-HOLSTER: the view's right the capes are moved along (auraShiftAcross)
  // AUDIT BACK-HOLSTER A2: the sprites' backs by wearer (eotbGlow.js createSpriteBacks) - mine and the walkers'
  const backSources = [eotbBody], worn = new Set(), auraRun = [];
  const backs = createSpriteBacks(renderer, () => { backSources.length = 1; for (const l of deps.sprites() ?? []) backSources.push(l); return backSources; });   // every sprite layer (the walkers list theirs)
  const auraList = [], auraDraw = [], auraPool = new Map(), auraLights = [], armoryList = [], armoryDraw = [], armoryPool = new Map();
  const armoryUnder = [], armoryOver = [];   // ARMORY-SEEN: this frame's pieces under the cloth on their back, and the rest
  const self = { id: SELF_OWNER, at: [0, 0, 0], aura: null, seed: 0.37, kindle: 1, since: 0, yaw: 0 };   // SHADOW-CLOAK: `yaw` the facing the cloak's opening faces
  const selfKit = { id: 'self', at: [0, 0, 0], kit: null, seed: 0.37, kindle: 1, since: 0, yaw: 0, pose: newPose(), torn: -1 };
  // AURA-STALL (bible/07-Rendering/Performance-Priority.md): built at the first wearer in range, each look's program at its
  // own door; a throw costs the auras, never the game. The armory's pass the same.
  const auraPassOf = compiledPass(renderer.gl, [], () => new AuraRingRenderer(renderer.gl), (/** @type {any} */ e) => console.warn('[online] the aura would not build', e?.message ?? e));
  setPeerTagReader((id) => deps.online()?.guildTagOf?.(id) ?? null);   // GUILD-SHOP: a peer's guild, for their boats' sailcloth
  setPeerClothReader((id) => deps.online()?.sailclothOf?.(id) === true);   // AUDIT GUILD-SHOP S2: and whether the sailcloth is theirs
  const armoryPassOf = compiledPass(renderer.gl, [], () => new ArmoryRenderer(renderer.gl), (/** @type {any} */ e) => console.warn('[online] the armory would not build', e?.message ?? e));
  const fogNow = () => ({ mode: renderer._fogMode, density: renderer._fogDensity, range: renderer._fogRange, camPos: renderer._camPos, focus: renderer._focus, haze: renderer._haze });
  /** ARMORY-SEEN: one layer of the frame's pieces (armoryLayers), under the frame's camera. */
  const drawArmory = (/** @type {any[]} */ list, /** @type {any} */ proj, /** @type {any} */ view, /** @type {any} */ eye, /** @type {number} */ now) => {
    if (!list.length) return;
    const pass = armoryPassOf();
    pass?.draw(list, proj, view, eye, now, fogNow());
    if (pass?.drawn) renderer.markForeignPass();
  };

  /** FOLLOW-NOW (2026-10-30, mob: "aura ghost behind the player", "th red glow", "is a few frame behind the charcter"):
   *  MY OWN COSMETICS WHERE MY BODY IS DRAWN THIS FRAME. The gather (frame) runs with the online frame, BEFORE the motor
   *  steps the player - so a kit and a strip aura placed there stood where I was a frame ago, and on the camera's low-passed
   *  feet: a ghost trailing the body by a step, far behind it flying. At the draw, after the step and the body's own draw,
   *  mine stand again at the body's feet (bodyFeetAt, lifted on my dragon), and the kit is posed off the body as drawn
   *  and its motion stepped there. A peer's stand where the gather put them, as their bodies do. */
  function placeSelf(/** @type {number} */ now) {
    if (!self.aura && !selfKit.kit) return;
    const player = deps.player(), faced = mwViewSpriteFacing(), yaw = faced?.yaw ?? player.bodyYawFor(deps.camYaw());
    if (self.aura) { const f = liftedFeet(player.bodyFeetAt?.() ?? player.feetAt(), selfLiftNow); self.at[0] = f[0]; self.at[1] = f[1]; self.at[2] = f[2]; self.yaw = yaw; }
    if (selfKit.kit && armoryList.includes(selfKit)) {
      const f = liftedFeet(player.bodyFeetAt?.() ?? player.feetAt(), selfLiftNow), vw = renderer._view;
      selfKit.at[0] = f[0]; selfKit.at[1] = f[1]; selfKit.at[2] = f[2]; selfKit.yaw = yaw;
      selfPose(selfKit.pose, player, selfLiftNow > 0); armoryMotionStep(selfKit, now, vw ? cardRightOf(renderer._proj, vw) : null);
    }
  }
  /** The pose of my own body as drawn - the rig's bones, the sprite's figure, or the rest pose pressed to my height. */
  function selfPose(/** @type {any} */ pose, /** @type {any} */ player, aloft = false) {
    if (aloft) { poseAtRest(pose, player.height / CAPSULE_HEIGHT, true); return; }   // AURA-ON-DRAGON: no body of mine drawn - the dragon's rider wears it
    if (poseFromBones(mwViewBodyBones(ARMORY_BONES), pose)) return;
    if (poseFromFigure(mwViewSpriteFigure(), pose)) return;
    poseAtRest(pose, player.height / CAPSULE_HEIGHT, !!player.riding);
  }
  /** A peer's pose as drawn - its Morrowind body's bones (peerBodies.bonesOf answers `{ feet, yaw, bones }`: the body stands
   *  the wearer where it is drawn, as the cape's auraCapeStep does), its sprite's figure, or the rest pose (a rider's saddled). */
  function peerPose(/** @type {string} */ id, /** @type {any} */ w, /** @type {any[]} */ layers) {
    const body = deps.bodies()?.bonesOf?.(id, ARMORY_BONES);
    if (body && poseFromBones(body.bones, w.pose)) {
      if (body.feet && Number.isFinite(body.yaw)) { w.at[0] = body.feet[0]; w.at[1] = body.feet[1]; w.at[2] = body.feet[2]; w.yaw = body.yaw; }
      return;
    }
    if (poseFromFigure(spriteAnswer(layers, 'figureOf', id), w.pose)) return;
    poseAtRest(w.pose, 1, w.mounted);
  }
  /** Whether a peer's pieces are drawn at all, by the player's "Others' armory" choice. */
  const othersShown = (/** @type {number[]} */ at, /** @type {number[]} */ eye) => {
    const mode = armoryOthersOf(getPref('armoryOthers'));
    return mode === 'all' || (mode === 'near' && Math.hypot(at[0] - eye[0], at[1] - eye[1], at[2] - eye[2]) <= ARMORY_NEAR_M);
  };

  return {
    /** A token minted (the world host's adoptIssued): the aura and the kit it said, where the service says them. */
    issued(/** @type {any} */ who) {
      if (who && 'aura' in who) auraHeard = who.aura ?? null;
      if (who && 'armory' in who) armoryHeard = who.armory ?? null;
    },
    /** WB9g: GATHERED WITH THE PEERS each frame - mine as the service signed it, and every peer's the relay vouched for. */
    frame(/** @type {any[]} */ seen) {
      auraList.length = 0; armoryList.length = 0; gathered++;
      const online = deps.online();
      if (!online || deps.travelActive()) return;
      if (deps.quiet()) return;   // EG-E2 (Elite-Gates.md section 25.4, THE QUIET COMPANY): no cosmetic aura during a Spire's trial
      const t = performance.now() / 1000, player = deps.player(), layers = deps.sprites(), eye = renderer._camPos;   // CAPE-CARD: every sprite layer, and the eye their pictures face
      const vw = renderer._view, right = vw ? cardRightOf(renderer._proj, vw) : null;   // the card's right, a sprite's feet off it (the draw's; ARMORY-MIRROR)
      // the service's last word on my own - a mint's, a wear's from any door; AURA-LIVE: one the room's token did not say is
      // said again, so the room sees it now. ARMORY: and the kit the same
      const mine = ownAura(), kit = ownArmory();
      if ((auraHeard !== undefined && mine !== auraHeard) || (armoryHeard !== undefined && kit !== armoryHeard)) { if (online.rehello?.()) { auraHeard = mine; armoryHeard = kit; } }
      const spawned = deps.spawned(), faced = mwViewSpriteFacing();
      const lift = deps.selfLift?.() || 0;   // AURA-ON-DRAGON: on my dragon, worn where its rider sits
      selfLiftNow = lift;
      // CAPE-TOGGLE (2026-10-30, mob: "it saposta help show the aura not tuen it off"): hiding the cape hides the cloak alone,
      // never the aura - mine here, and (the look's `hc`) a peer's below
      if (mine && spawned) {
        const f = player.feetAt(); f[1] += lift;
        if (self.aura !== mine) self.since = t;
        self.at[0] = f[0]; self.at[1] = f[1]; self.at[2] = f[2]; self.aura = mine; self.yaw = faced?.yaw ?? player.bodyYawFor(deps.camYaw()); auraBeastStep(self, deps.beast(), t);   // SHADOW-CLOAK: the body's own facing, as its third person is drawn (SPRITE-FACE: a sprite's, as its picture faces); turned beast, the cloak torn
        self.kindle = Math.min(1, (t - self.since) / AURA_KINDLE_S); /** @type {any} */ (self).mounted = !!player.riding || lift > 0;   // SHADOW-CLOAK: a rider's cape folded away; AURA-ON-DRAGON: a dragon's rider is one
        auraList.push(self);
      } else self.aura = null;
      if (kit && spawned) {
        const f = player.bodyFeetAt?.() ?? player.feetAt(); f[1] += lift;
        if (selfKit.kit !== kit) selfKit.since = t;
        selfKit.at[0] = f[0]; selfKit.at[1] = f[1]; selfKit.at[2] = f[2]; selfKit.kit = kit; selfKit.yaw = faced?.yaw ?? player.bodyYawFor(deps.camYaw());
        selfKit.kindle = Math.min(1, (t - selfKit.since) / AURA_KINDLE_S); /** @type {any} */ (selfKit).mounted = !!player.riding || lift > 0; selfKit.torn = deps.beast() ? 1 : -1;
        /** @type {any} */ (selfKit).arms = armoryKitPieces(kit).arms === 'insigniaarmlet' ? ownGuildArms() : null;   // GUILD-SHOP
        armoryList.push(selfKit);   // FOLLOW-NOW: placed, posed and stepped at the draw (draw's placeSelf)
      } else selfKit.kit = null;
      for (const d of seen) {
        if (deps.veiled(d.id) || !d.shown) continue;   // a concealed peer's fire is concealed with them
        const au = online.auraOf?.(d.id) ?? null, ak = online.armoryOf?.(d.id) ?? null;   // CAPE-TOGGLE: a peer who hides their capes wears no aura here
        if (!au) auraPool.delete(d.id);
        if (!ak) armoryPool.delete(d.id);
        if (!au && !ak) continue;
        const seenAs = spriteAnswer(layers, 'faceOf', d.id, eye), p = seenAs?.at ?? deps.toScene(d.shown), up = deps.peerLift?.(d) || 0;   // AURA-ON-DRAGON: a dragon's rider wears them in its seat; AUDIT CAPE-CARD A4: at its picture's own feet (a seated doll sinks)
        const face = seenAs?.yaw ?? peerBodyYaw(d.shown) ?? 0;   // SPRITE-FACE: a sprite's as its picture is drawn this frame; CAPE-CARD: a paperdoll's and a class sprite's too
        if (au) {
          let w = auraPool.get(d.id);
          if (!w || w.aura !== au) { w = { id: d.id, at: [0, 0, 0], aura: au, seed: auraSeedOf(d.id), kindle: 0, since: t }; auraPool.set(d.id, w); }
          w.at[0] = p[0]; w.at[1] = p[1] + up; w.at[2] = p[2]; w.yaw = face; auraBeastStep(w, !!d.shown.wb, t);   // SHADOW-CLOAK: the peer's facing (to the wall on a climb); turned beast (the pose's `wb`), the cloak torn
          w.kindle = Math.min(1, (t - w.since) / AURA_KINDLE_S); w.seen = t; w.mounted = !!d.shown.rd;   // SHADOW-CLOAK: a rider's (a horse, a cart) cape folded away
          auraList.push(w);
        }
        if (ak) {
          let w = armoryPool.get(d.id);
          if (!w || w.kit !== ak) { w = { id: d.id, at: [0, 0, 0], kit: ak, seed: auraSeedOf(d.id), kindle: 0, since: t, pose: newPose(), torn: -1 }; armoryPool.set(d.id, w); }
          w.at[0] = p[0]; w.at[1] = p[1] + up; w.at[2] = p[2]; w.yaw = face; w.mounted = !!d.shown.rd; w.torn = d.shown.wb ? 1 : -1;
          w.kindle = Math.min(1, (t - w.since) / AURA_KINDLE_S); w.seen = t;
          w.arms = armletArmsOf(ak, online.guildTagOf?.(d.id));   // GUILD-SHOP: the arms their token's guild bears
          peerPose(d.id, w, layers); armoryMotionStep(w, t, right);
          armoryList.push(w);
        }
      }
      for (const pool of [auraPool, armoryPool]) if (pool.size) for (const [id, w] of pool) if (t - w.seen > AURA_FORGET_S) pool.delete(id);   // the gone forget their kindling - AUDIT 3: the gone, not the blinked
    },
    /** Both passes, after each mode's opaque world under the camera that world was drawn with - every host calls it (the
     *  street, the dungeon's lateWorldDraw, the building); never under the travel view. */
    draw() {
      const proj = renderer._proj, view = renderer._view, eye = renderer._camPos;   // the frame's camera, the world's own
      const now = performance.now() / 1000;
      placeSelf(now);
      if (!(proj && view && eye && auraList.length && auraWearers(auraList, eye, auraDraw).length)) auraDraw.length = 0;
      if (auraDraw.length) {
        const player = deps.player(), layers = deps.sprites(), faced = mwViewSpriteFacing();
        // SHADOW-CLOAK: each cape hung on its body as drawn this frame - its bones posed by now (mine, or a peer's), else at
        // rest, crouched with a crouch - and swung by how it moves where it is drawn; SPRITE-FACE: a sprite's faced as its
        // PICTURE is, in the saddle too, and swung by the way the body turns (`turn`); AUDIT CAPE-CARD A3: my sprite's a card
        // (`card`), so in the saddle, with no figure to read, what hangs on my back stands behind it as on a walker
        for (const w of auraDraw) if (auraLookOf(w.aura).mesh) { auraCapeStep(w, w === self ? { feet: liftedFeet(player.bodyFeetAt(), selfLiftNow), yaw: faced?.yaw ?? player.bodyYawFor(deps.camYaw()), turn: faced?.turn, bones: selfLiftNow > 0 ? null : mwViewBodyBones(CLOAK_BONES) ?? auraSpriteBones(mwViewSpriteFigure()), card: !!faced } : deps.bodies()?.bonesOf(w.id, CLOAK_BONES) ?? auraSpritePosed(w, spriteAnswer(layers, 'figureOf', w.id), spriteAnswer(layers, 'faceOf', w.id, eye)), w === self ? player.height / CAPSULE_HEIGHT : 1); auraMotionStep(w, now); }
        // BACK-HOLSTER: a sprite's cape and wings stand at its painted body (auraSpriteAcross), moved there for the pass alone
        for (const w of auraDraw) w.across = auraLookOf(w.aura).mesh ? auraSpriteAcross(w === self ? (selfLiftNow > 0 || mwViewBodyBones(CLOAK_BONES) ? null : mwViewSpriteFigure()) : deps.bodies()?.bonesOf(w.id, CLOAK_BONES) ? null : spriteAnswer(layers, 'figureOf', w.id)) : 0;
      }
      auraList.length = 0;   // this frame's, drawn once: a frame that gathers none (the seat left, death, offline) draws none
      armoryDraw.length = 0;
      if (proj && view && eye && armoryList.length) {
        for (const w of armoryList) w.atHead = w === selfKit && armoryEyeAtHead(w, eye);   // my own first person: no body piece over the view
        armoryWearers(armoryList.filter((w) => w === selfKit || othersShown(w.at, eye)), eye, armoryDraw);
        for (const w of armoryDraw) w.drawn = gathered;
      }
      armoryList.length = 0;
      // ARMORY-SEEN: a body's pieces before the auras where the cloth on its back covers them, so the cloth lies over them;
      // the rest after. Drawn after every cape, the pieces under one burned through it
      armoryLayers(armoryDraw, auraDraw, eye, armoryUnder, armoryOver);
      drawArmory(armoryUnder, proj, view, eye, now);
      // BACK-HOLSTER (AUDIT A2): a sprite's back - its weapon drawn again, its glows - over its OWN aura and under a nearer
      // one: a body wearing none before the auras, every frame; each wearer's straight after its aura (drawAurasThenBacks)
      const pass = auraDraw.length ? auraPassOf() : null;   // AURA-STALL: null while its program compiles - the capes still hang and swing above
      worn.clear();
      if (pass) for (const w of auraDraw) worn.add(w.id);
      if (proj && view) backs.drawBare(worn);
      if (pass) {
        const yaw = deps.camYaw(), fog = fogNow();
        acrossRight[0] = Math.cos(yaw); acrossRight[2] = -Math.sin(yaw);   // the view's right, as the sprites' quads take it
        auraShiftAcross(auraDraw, acrossRight, 1);
        try {
          drawAurasThenBacks(auraDraw, (run) => { pass.draw(run, proj, view, eye, now, fog); if (pass.drawn) renderer.markForeignPass(); return pass.drawn; }, (w) => backs.has(w.id), (w) => backs.draw(w.id), auraRun);
        } finally { auraShiftAcross(auraDraw, acrossRight, -1); }   // AUDIT BACK-HOLSTER A9: the feet given back, whatever the pass did
      }
      drawArmory(armoryOver, proj, view, eye, now);
    },
    /** SERAPH-WINGS: the gold of the nearest wings, for every host's light list. */
    wingLights: (/** @type {number[]} */ eye) => auraWingLights(auraList, eye, auraLights),
    /** PROFILE-SLOTS: how high over a peer's feet the head piece they wear stands as drawn (armoryPass.js armoryHeadTip),
     *  0 with none drawn THIS frame (a beast's, one hidden by "Others' armory", past the range or the cap, a quiet or
     *  travel frame) - the name stands over it (net/remotePlayers.js nameFrame's `lift`, read after the draw). */
    nameTopOf(/** @type {string} */ id) {
      const w = armoryPool.get(id);
      if (!w || w.drawn !== gathered || w.torn >= 0) return 0;
      const tip = armoryHeadTip(w);
      return tip == null ? 0 : tip - w.at[1];
    },
    /** For the tests and the stats: how many wearers this frame holds of each. */
    counts: () => ({ auras: auraList.length, armory: armoryList.length, near: ARMORY_DETAIL_M }),
    /** For the tests: the armory's wearers this frame, as gathered - a copy, never the list itself. */
    armoryWearersNow: () => armoryList.slice(),
  };
}
