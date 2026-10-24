// @ts-check
// EG-FALL (2026-10-21, the owner: "I notice in the Elite Breaches, when the boss dies it freezes in place. Oblivion gates do
// the boss death the best way"; bible/11-Multiplayer/Elite-Gates.md section 16.2 and EG-FALL): A LORD'S FALL IS THE GATE'S.
// A felled lord's body stayed in the fight on the relay's word (net/eliteGates/egLink.js - fallen, EG_FL.fell, so a Twin can be
// raised again) and the screen held it on its fourth hurt frame, standing, for as long as the hall stood. Section 16.2 had
// promised "the gate's fall beats (WB13e): FELLED, the body down"; the card shipped, the body never went down.
// Now every lord falls as the Warden does (world/gate/gateBoss.js bossAct's fall, scenes/gate/gateCourt.js fallEvent and
// drawCorpse), on the gate's own numbers; its sink, its corpse and the height its beats stand at grown by the lord's drawn
// size over the Warden's (EG_FALL_PER):
//   THE BODY (egLordFallAct) - its hurt picture (one record a facing in Daggerfall's own files) held until THUD_AT_MS, then
//     sunk FALL_SINK_M into the stone over the rest of FALL_MS, and gone; a winged body beats its wings as it falls (the
//     gate's host's winged fall); a flyer drops out of its hover (`aloft`), on its feet by the thud; where it fell, held
//     from the frame it was first seen fallen (`placeOf` - scenes/eliteGates/egFight.js drawBody).
//   THE KILL - its death cry (the gate's `fall` cue in the lord's own voice), a burst of Dagon's size out of its chest in
//     its element's ember (egLordEmber), the hall's light white for FALL_FLASH_MS and the camera shaken FALL_SHAKE under the
//     player's own motion (world/eliteGates/egTelegraph.js egShakeMotion - the Spire's shakes' law).
//   THE THUD - its body meeting the floor (the gate's `thud` cue), a column of embers off the floor, COLUMN_BURSTS of them
//     COLUMN_STEP_MS apart, its ember's glow dying over the fall (the gate's bossGlow while he falls).
//   ITS BODY LEFT - its mobile's own corpse (characters/enemy/enemyBasics.js corpseTexture) where it fell, at the gate's
//     CORPSE_SCALE grown as the lord is, for as long as the hall's fight keeps the lord; put away when it goes, when a Twin
//     is raised (and played again at its next fall), at a new hall and out of the breach.
// Each beat once a fall, and only while it is news (the gate's FALL_CRY_LATE_MS and FALL_NEWS_MS): a screen that comes to the
// hall after the fall sees the body on the floor, and nothing played again. AUDIT EG-FALL (bible/01-Overview/audits/
// Audit-EG-FALL.md): a fall told first by `efl` (stamped at its arrival) and then by the whole fight (the relay's own
// instant) is ONE fall - the moved instant re-anchors it, never plays it again (L1-1, L2-1).
// Drawn by the gate's own spark pass (render/gate/gateFx.js GateFxRenderer, in the fight's world pass - egFight drawPass),
// warmed while a lord stands and freed with the breach; its batches and lights ride the fight's own lists. Not a DFU member:
// Daggerfall Unity's foe has no fall of its own - at its death EnemyDeath.CompleteDeath sets it inactive at once and lays a
// lootable corpse marker in its corpse picture, with SoundClips.BodyFall where it lies; this departs from that as the gate
// does (the fall, the corpse laid at FALL_MS, BodyFall at THUD_AT_MS pitched for its size). Ledger A (ELITE-GATES).
import { FALL_MS, THUD_AT_MS, FALL_SINK_M, CORPSE_SCALE, BOSS_LOOKS, BOSS_CUES, GLOW_RANGE, GLOW_UP_SHARE, FALL_GLOW_K, emberColor } from '../../world/gate/gateBoss.js';
import { BOSS_H } from '../../net/gate/gateBrain.js';
import { FALL_FLASH_MS, FALL_SHAKE, COLUMN_BURSTS, COLUMN_STEP_MS, FALL_CRY_LATE_MS, FALL_BURST_UP, FALL_FLASH_Y, FALL_FLASH_K, FALL_FLASH_RANGE, FALL_NEWS_MS, WHITE } from '../gate/gateCourt.js';
import { GateFxRenderer, GATE_FX_PROGRAMS, FX_KINDS, FX_BURST_MS, FX_BURSTS_MAX } from '../../render/gate/gateFx.js';
import { compiledPass } from '../../render/glProgram.js';
import { ENEMY_BASICS } from '../../characters/enemy/enemyBasics.js';
import { FLY_ANIM_SPEED } from '../../characters/mobile/mobileUnit.js';
import { billboardSize } from '../../world/rmbFlats.js';
import { egBodyPlace, egBodyHeight } from '../../net/eliteGates/egLink.js';
import { EG_LORDS, EG_BANDS } from '../../net/eliteGates/egLaw.js';
import { EG_BOSS_KEYS } from '../../net/eliteGates/egLords.js';

/** The gate's fall was measured on the Warden at his look's scale (world/gate/gateBoss.js BOSS_LOOKS: three Daedra Lords
 *  tall, BOSS_H); a lord drawn at `drawn` (scenes/eliteGates/egFight.js egLookOf) falls by the same numbers grown by this. Pure. */
export const EG_FALL_PER = (drawn) => (drawn > 0 ? drawn : BOSS_LOOKS.ruhn.scale) / BOSS_LOOKS.ruhn.scale;
/** How far a lord drawn at `drawn` sinks into the stone (m); the Warden's body (BOSS_H, the height the gate's shares of it are
 *  taken of) grown to it (m - AUDIT EG-FALL L3-7: not its drawn sprite's height); and the scale its corpse lies at. Pure. */
export const egFallSinkM = (drawn) => FALL_SINK_M * EG_FALL_PER(drawn);
export const egFallTallM = (drawn) => BOSS_H * EG_FALL_PER(drawn);
export const egCorpseScale = (drawn) => CORPSE_SCALE * EG_FALL_PER(drawn);
/** AUDIT EG-FALL (L1-1, L2-1): an instant of the same lord's fall moved by less than this is the same fall, re-anchored (the
 *  link's stamp at `efl`'s arrival, then the relay's own in the whole fight): a raised lord stands at half its health, and none
 *  is raised and felled again inside one fall's span. */
export const EG_FALL_SAME_MS = FALL_MS;
/** The share of a flyer's hover still under it `since` ms into its fall: it drops out of the air, on its feet by the thud. Pure. */
export const egFallAloft = (since) => { const k = Math.min(1, Math.max(0, since) / THUD_AT_MS); return 1 - k * k; };
/** WHAT A FALLEN LORD IS DOING `since` ms into its fall - the gate's (world/gate/gateBoss.js bossAct): its hurt picture
 *  (`anims` - one frame a record in Daggerfall's files, so a frame index held is one picture; AUDIT EG-FALL L1-5) to the floor
 *  by THUD_AT_MS, then sunk egFallSinkM into the stone over the rest of FALL_MS; gone past it (its corpse lies there). A
 *  `winged` body (the Mother of Dusk aloft) beats its wings through its fall, looped at the flyers' rate, as the gate's host's
 *  winged ones do (world/gate/gateBoss.js hostFallAct). `aloft` egFallAloft. Pure.
 *  @param {number} since @param {any} anims @param {number} [drawn] @param {boolean} [winged] */
export function egLordFallAct(since, anims, drawn = BOSS_LOOKS.ruhn.scale, winged = false) {
  if (since >= FALL_MS) return { act: 'gone', anims, frame: 0, loop: false, sink: 0, aloft: 0 };
  const s = Math.max(0, since), k = Math.min(1, s / THUD_AT_MS);
  const sink = s > THUD_AT_MS ? egFallSinkM(drawn) * Math.min(1, (s - THUD_AT_MS) / (FALL_MS - THUD_AT_MS)) : 0;
  const frame = winged ? Math.floor((s / 1000) * FLY_ANIM_SPEED) : Math.max(0, Math.min(4, Math.floor(k * 5)));
  return { act: 'fall', anims, frame, loop: winged, sink, aloft: egFallAloft(s) };
}
/** A lord's element's aspect - the gate's aspects (world/gate/gateBoss.js ASPECT_COLORS) by the element the lord carries;
 *  none, its band's (net/eliteGates/egLaw.js EG_BANDS `aspect`). */
export const EG_FALL_ASPECT = Object.freeze({ fire: 'burning', frost: 'rime', shock: 'storm', poison: 'venom' });
/** A lord's element: its law's (net/eliteGates/egLaw.js EG_LORDS `el`) - a Twin's its own clan's (Vael the Fire, Isk the
 *  Frost - net/eliteGates/egLords.js egBossName), a champion none. Pure. @param {string} key @param {number} [pt] */
export const egLordEl = (key, pt = 0) => (key === 'twins' ? (pt === 1 ? 'frost' : 'fire') : EG_LORDS[key]?.el ?? null);
/** THE EMBER A LORD FALLS IN - the gate's own ember (world/gate/gateBoss.js emberColor) under its element's aspect, else its
 *  band's. Pure. @param {string} key @param {number} pt @param {number} band */
export const egLordEmber = (key, pt, band) => emberColor({ aspect: { id: EG_FALL_ASPECT[egLordEl(key, pt) ?? ''] ?? EG_BANDS[band]?.aspect ?? null } });
/** Its death cry: the gate's (BOSS_CUES `fall` - the Warden's own bark, low) in the lord's own voice. Pure.
 *  @param {number} mobile */
export const egFallCry = (mobile) => ({ ...BOSS_CUES.fall, clip: ENEMY_BASICS[mobile]?.barkSound ?? BOSS_CUES.fall.clip });

/**
 * A breach fight's fallen lords: their beats, their bursts, their lights and the bodies they leave. scenes/eliteGates/egFight.js
 * hands it each fallen lord as it draws it (`see`), stands the body where it fell (`placeOf`), sweeps it once a frame of bodies
 * (`sweep`), warms its pass while a lord stands (`warm`) and draws its bursts in its world pass (`draw`); its corpses go into
 * the fight's `batches` and its lights into the fight's `lights` as they stand.
 * @param {{ renderer?: any, gl?: any, getTexture?: any, uploadRecordFrame?: any, now: () => number, play3?: (cue: any, at: number[]|null) => void,
 *   shake?: (k: number) => void, motion?: () => number, band?: () => number, batches: any[], lights: any[] }} deps
 */
export function createEgLordFall({ renderer = null, gl = null, getTexture = null, uploadRecordFrame = null, now, play3 = () => {}, shake = () => {}, motion = () => 1, band = () => 0, batches, lights }) {
  /** Each fallen lord this screen holds, by its number: its fall's moment, its beats played, its place, its corpse. */
  const lords = new Map();
  /** The corpses' pictures by archive - asked once each (a promise on its way, `{ tex }`, or `{ failed }`). */
  const textures = new Map();
  /** The bursts, slots reused (the gate's addBurst), and those standing this frame. */
  const bursts = [], live = [];
  let frameNo = 0;
  const fxPassOf = () => compiledPass(gl, GATE_FX_PROGRAMS, () => new GateFxRenderer(gl), (e) => console.warn('[eg] a lord\'s fall would not build', e?.message ?? e));
  let fxDoor = fxPassOf();

  function corpseTexture(archive) {
    const had = textures.get(archive);
    if (had && !(had instanceof Promise)) return had.failed ? null : had.tex;
    if (!had && getTexture) textures.set(archive, Promise.resolve().then(() => getTexture(archive)).then((tex) => { textures.set(archive, tex ? { tex } : { failed: true }); }, () => { textures.set(archive, { failed: true }); }));
    return null;
  }
  function putAway(L) {
    if (L.corpse) { renderer?.destroyBillboardBatch?.(L.corpse); L.corpse = null; }
  }
  /** A burst from `at0` (the fight's clock) at `p`, its sparks resting on `floor` - the oldest slot given up past FX_BURSTS_MAX. */
  function addBurst(p, at0, kind, color, floor) {
    let b = bursts.length < FX_BURSTS_MAX ? null : bursts.reduce((o, q) => (q.at0 < o.at0 ? q : o));
    if (!b) { b = { at: [0, 0, 0], at0: 0, t: -1, kind, color, floor: NaN }; bursts.push(b); }
    b.at[0] = p[0]; b.at[1] = p[1]; b.at[2] = p[2]; b.at0 = at0; b.kind = kind; b.color = color; b.floor = floor;
  }
  /** Fallen lord `L` stood where row `b` says it fell, in the hall's frame (`place`) and the dungeon's (`feet`), refilled in
   *  place - and its corpse with it, if it lies there already. */
  function placeAt(L, b, centre) {
    const [x, z] = egBodyPlace(b, b.fellAt), y = egBodyHeight(b, b.fellAt), P = L.place, F = L.feet;
    P[0] = x; P[1] = z; P[2] = y;
    F[0] = centre[0] + x; F[1] = centre[1] + y; F[2] = centre[2] + z;
    if (L.corpse) { L.corpse.origin[0] = F[0]; L.corpse.origin[1] = F[1]; L.corpse.origin[2] = F[2]; }
  }
  /** The fallen lord's body left where it fell, once its pictures stand: its mobile's own corpse, grown as the lord is. */
  function lay(L, mobile) {
    const ct = ENEMY_BASICS[mobile]?.corpseTexture;
    if (L.corpse || !ct || !renderer?.createBillboardBatch) return;
    const tex = corpseTexture(ct.archive);
    if (!tex) return;
    const sz = billboardSize(tex, ct.record), k = egCorpseScale(L.drawn), w = (sz?.w ?? 1.6) * k, h = (sz?.h ?? 0.6) * k;
    const rkey = `${ct.record}#0`;
    if (!renderer.textures?.has?.(`${ct.archive}_${rkey}`)) uploadRecordFrame?.(ct.archive, ct.record, 0);
    const c = renderer.createBillboardBatch(ct.archive, rkey, { w, h }, [[0, 0, 0]]);
    if (!c) return;
    c.origin = [L.feet[0], L.feet[1], L.feet[2]]; c.record = rkey; c.size = { w, h };
    if (L.drawn > 1) c.noShadow = true;   // EG-LOOK (OW-BIG's law): a grown figure casts no giant's shadow - the gate's corpse casts one
    L.corpse = c;
  }

  return {
    /** Fallen lord `b` (its look `look`, the hall's centre `centre`) at `t`: its beats while they are news, its glow, its
     *  flash and its corpse. A Twin raised and felled again falls again. */
    see(b, t, look, centre) {
      if (!centre || !(b?.fellAt > 0)) return;
      const since = t - b.fellAt;
      if (since < 0) return;
      let L = lords.get(b.i);
      if (L && L.at !== b.fellAt) {
        // AUDIT EG-FALL (L1-1, L2-1): the same fall told twice - re-anchored to the later word's instant, its beats kept played
        if (Math.abs(b.fellAt - L.at) < EG_FALL_SAME_MS) {
          const d = b.fellAt - L.at;
          L.at = b.fellAt; if (Number.isFinite(L.flashAt)) L.flashAt += d;
          // a row that stands still is the relay's own word of where it lies (world248 stops a felled lord's walk -
          // net/eliteGates/egLords.js egLordHit): taken, so every screen lays it in one place; a row still walking (an older
          // relay carrying it on) never moves it
          if (!b.mv) placeAt(L, b, centre);
        } else { putAway(L); L = null; }
      }
      if (!L) {
        L = { at: b.fellAt, place: [0, 0, 0], feet: [0, 0, 0], drawn: look.drawn, hover: look.hover > 0 ? look.hover : 0, tall: egFallTallM(look.drawn), ember: egLordEmber(EG_BOSS_KEYS[b.k] ?? '', b.pt | 0, band()),
          thud: false, column: 0, flashAt: -Infinity, corpse: null, frame: 0, glow: { x: 0, y: 0, z: 0, range: 0, color: [0, 0, 0], carried: true }, flash: { x: 0, y: 0, z: 0, range: 0, color: [0, 0, 0], carried: true } };
        lords.set(b.i, L);
        placeAt(L, b, centre);
        if (since < FALL_CRY_LATE_MS) {   // THE KILL, while it is news - at its chest, a flyer's in the air it fell from (AUDIT EG-FALL L1-4)
          const F = L.feet, chest = [F[0], F[1] + L.hover + L.tall * FALL_BURST_UP, F[2]];
          play3(egFallCry(look.mobile), chest);
          addBurst(chest, L.at, FX_KINDS.dagon, L.ember, F[1]);
          L.flashAt = L.at;
          const m = motion();
          if (m > 0) shake(FALL_SHAKE * m);
        }
      }
      L.frame = frameNo;
      const F = L.feet, s = t - L.at;
      // THE THUD: its body meeting the floor, and the column of embers off it - each once, and only while news
      if (!L.thud && s >= THUD_AT_MS) { L.thud = true; if (s < THUD_AT_MS + FALL_NEWS_MS) play3(BOSS_CUES.thud, [F[0], F[1] + 1, F[2]]); }
      for (; L.column < COLUMN_BURSTS && s >= THUD_AT_MS + L.column * COLUMN_STEP_MS; L.column++) {
        const at0 = L.at + THUD_AT_MS + L.column * COLUMN_STEP_MS;
        if (t < at0 + FALL_NEWS_MS) addBurst([F[0], F[1] + 0.1, F[2]], at0, FX_KINDS.embers, L.ember, F[1]);
      }
      // its ember's glow dying over the fall, at its chest as it drops (AUDIT EG-FALL L1-4), the hall's flash at the kill
      if (s < FALL_MS) {
        const g = L.glow, k = FALL_GLOW_K * (1 - s / FALL_MS);
        g.x = F[0]; g.y = F[1] + L.hover * egFallAloft(s) + L.tall * GLOW_UP_SHARE; g.z = F[2]; g.range = GLOW_RANGE.landing;
        g.color[0] = L.ember[0] * k; g.color[1] = L.ember[1] * k; g.color[2] = L.ember[2] * k;
        lights.push(g);
      }
      if (t >= L.flashAt && t - L.flashAt < FALL_FLASH_MS) {
        const f = L.flash, k = FALL_FLASH_K * (1 - (t - L.flashAt) / FALL_FLASH_MS);
        f.x = F[0]; f.y = F[1] + FALL_FLASH_Y; f.z = F[2]; f.range = FALL_FLASH_RANGE;
        f.color[0] = WHITE[0] * k; f.color[1] = WHITE[1] * k; f.color[2] = WHITE[2] * k;
        lights.push(f);
      }
      // ITS BODY LEFT where it fell, once it has sunk
      if (s >= FALL_MS) { lay(L, look.mobile); if (L.corpse) batches.push(L.corpse); }
    },
    /** AUDIT EG-FALL (L1-2, L2-2): where fallen lord `i` fell, in the hall's frame (`[x, z, y]` - its place, then its feet), held
     *  from the frame it was first seen fallen: never carried on by a walk said before its fall, nor moved by a later word. */
    placeOf: (i) => lords.get(i)?.place ?? null,
    /** Once a frame, after the bodies: a lord no longer fallen here (raised, gone from the fight) has its body put away. */
    sweep() {
      for (const [i, L] of lords) if (L.frame !== frameNo) { putAway(L); lords.delete(i); }
      frameNo++;
    },
    /** AUDIT EG-FALL (L1-6): the spark pass asked while a lord stands (render/glProgram.js compiledPass - built once its programs
     *  are done, never a frame frozen on a compile), so the first kill finds it built. */
    warm() { fxDoor(false); },
    /** The bursts standing at `t` (the fight's clock), as the spark pass takes them. */
    bursts(t = now()) {
      live.length = 0;
      for (const b of bursts) { b.t = (t - b.at0) / 1000; if (b.t >= 0 && b.t < FX_BURST_MS / 1000) live.push(b); }
      return live;
    },
    /** The bursts drawn with the gate's spark pass - built the frame one must be seen; its sparks sized by the world image's
     *  height (AUDIT EG-FALL L1-7: the Hour's - the canvas's is twice it under a render scale). Answers whether any drew. */
    draw(proj, view, eye, seconds, fog = null) {
      if (!this.bursts().length) return false;
      const pass = fxDoor(true);
      if (!pass) return false;
      pass.draw(live, null, proj, view, eye, seconds, fog, renderer?.worldViewportPx?.[3] ?? 0);
      return pass.bursts > 0;
    },
    /** What it holds (tests): each fallen lord's beats and whether its body lies there. */
    state: () => [...lords].map(([i, L]) => ({ i, at: L.at, thud: L.thud, column: L.column, flashAt: L.flashAt, corpse: !!L.corpse, feet: [...L.feet] })),
    /** A new hall, or out of the breach: every body put away, every burst forgotten. */
    leave() {
      for (const L of lords.values()) putAway(L);
      lords.clear(); bursts.length = 0; live.length = 0;
    },
    /** AUDIT EG-FALL (L1-6; EVERY ALLOCATION HAS AN OWNER): out of the breach, the spark pass freed - its door emptied before the
     *  pass is (THE SLOT IS EMPTIED BEFORE THE OCCUPANT IS TOLD), and built again the next breach's first frame that needs it. */
    dispose() {
      this.leave();
      if (!fxDoor.settled) return;
      const pass = fxDoor();
      fxDoor = fxPassOf();
      try { pass?.destroy(); } catch { /* gone with its context */ }
    },
  };
}
