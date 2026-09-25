// @ts-check
// WB4 (2026-09-25, Mac: "a large boss arena with an oversized enemy with telegraphed attacks (like wind ups, etc)"):
// THE FIGHT IN THE COURT, ON THIS SCREEN - the boss's body where the relay says he stands, doing what it says he is
// doing, three times a Daedra Lord's size; his glow; the telegraph of the attack he is winding up; his voice at the
// word, at the landing, at a phase and at his fall; the bar over the screen; and THE PLAYER'S OWN SIDE of every attack -
// the landing tested against this player's feet, and the blow taken through the host's own door. Design:
// bible/11-Multiplayer/World-Bosses.md section 5.
//
// ONE SOURCE: the court's link (net/gateLink.js - the relay's words, folded). Nothing here is sent: a strike's verdict
// is this machine's own (co-op's law - "an enemy's strike on a client is applied by that client", net/gateStrike.js),
// and it lands through `strike` - the dungeon context's door (hurt, flash, cry), the same as any foe's blow.
//
// THE PARTS, each pure where it can be: the look (world/gateBoss.js bossAct/bossFrame/bossGlow/BOSS_CUES), the ground
// (render/gateTelegraph.js telegraphShape and its pass), the verdict (net/gateStrike.js strikeVerdict), the bar
// (ui/gateBossBar.js bossBarModel). This file is their driver: it holds the sprite's texture and batch, the attacks it
// has already cued, landed and judged, and the host's doors.
//
// Not a DFU member. Ledger A (WB).
import { ATTACK_BY_ID, ATTACKS, BOSS_H, BOSS_R, COURT_CENTRE, HIT_KINDS } from '../net/gateBrain.js';
import { strikeVerdict, blowOf, strikeDamage, fireShare } from '../net/gateStrike.js';
import { GATE_BOSSES, gateBossOf } from '../net/gateLaw.js';
import { bossAct, bossFrame, bossGlow, bossPlace, bossLookOf, bossStandIn, BOSS_CUES, GLOW_UP, BOSS_STRIDE_M, GROWL_EVERY_MS, HURT_GAP_MS, HURT_SHARE, QUAKE_ON, THUD_AT_MS } from '../world/gateBoss.js';
import { courtToDungeon } from '../world/gateArena.js';
import { GateTelegraphRenderer, telegraphShape } from '../render/gateTelegraph.js';
import { bossBarModel, drawGateBossBar } from '../ui/gateBossBar.js';
import { readReceipt } from '../net/gateReceipt.js';
import { ENEMY_BASICS } from '../characters/enemyBasics.js';
import { mobileBillboardSize } from '../world/rmbFlats.js';

/** The words a strike says that the hurt itself does not; and the fall's, to a player the receipt never came for. */
export const COURT_STRIKE_TEXT = Object.freeze({
  resisted: (name) => `You resist the flames of the ${name}.`,
  noSpoils: (name) => `${name}'s spoils are not yours - you did not stand the fight.`,
});
/** WB5: his body bursts this long into his fall, and the spoils leave it (world/gateBoss.js FALL_MS is the whole fall);
 *  a receipt not come this long after it never will. */
export const SPEW_AT_MS = 500;
export const RECEIPT_WAIT_MS = 4000;
/** AUDIT WB B7: his death cry is heard only this near his fall - a player who comes to the court (or back to it) after
 *  he fell hears the thud's own late rule, not a cry from minutes ago. */
export const FALL_CRY_LATE_MS = 1500;

/** AUDIT WB B4: AN ATTACK IS ITS NUMBER AND ITS MOMENT. The relay numbers a fight's attacks, and a room woken from its
 *  checkpoint numbers them from there again - the next attack would wear the number of one this screen already judged,
 *  cued and landed, and pass unheard and unfelt. */
const noMark = () => ({ i: -1, at: NaN });
const marked = (m, atk) => m.i === atk.i && m.at === atk.at;
const setMark = (m, atk) => { m.i = atk.i; m.at = atk.at; };
const NONE = Object.freeze([]);

/** The boss by his id (the relay's word), or the day's (net/gateLaw.js). */
export const bossOf = (s) => GATE_BOSSES.find((b) => b.id === s?.boss) ?? gateBossOf(s?.day ?? 0);

/**
 * @param {{
 *   renderer?: any, gl?: any,
 *   getTexture?: ((archive: number) => Promise<any>)|null,
 *   uploadRecordFrame?: ((archive: number, record: number, frame: number) => void)|null,
 *   audio?: any,
 *   link: { state: () => any, receipt?: (day: number) => string|null },
 *   spoils?: any,
 *   now: () => number,
 *   cam?: () => number[]|null,
 *   feet?: () => number[]|null,
 *   player?: () => any,
 *   save?: (entity: any) => number,
 *   strike?: (dmg: number, how: { fire: boolean, name: string }) => void,
 *   say?: (text: string) => void,
 *   hudHidden?: () => boolean,
 *   send?: (hit: { q: number, d: number, r: number }) => boolean,
 *   rng?: () => number,
 * }} deps
 */
export function createGateCourt({
  renderer = null, gl = null, getTexture = null, uploadRecordFrame = null, audio = null,
  link, spoils = null, now, cam = () => null, feet = () => null, player = () => null, save = () => 100,
  strike = () => {}, say = () => {}, hudHidden = () => false, send = () => false, rng = Math.random,
}) {
  let pass = null;
  try { if (gl) pass = new GateTelegraphRenderer(gl); } catch (e) { console.warn('[gate] the telegraph would not build', e?.message ?? e); pass = null; }
  /** the sprite: its texture once loaded (or the promise, or a failure), its batch while drawn */
  let body = null, loading = null, batch = null;
  /** the fight this driver is on (its day), and what it has done with its attacks */
  let day = null, judged = noMark(), cued = noMark(), landed = noMark(), phaseHeard = 0, fellCued = false, wrathLanded = false;
  let prevT = -Infinity, hurtAt = -Infinity, shape = null;
  /** WB4b: his stand-in for the formulas (made once a fight), and my blows' sequence (the wire's `q`) */
  let standIn = null, blowSeq = 0;
  /** WB5: whether this fight's spoils have left him, and whether their absence has been said */
  let spewed = false, spoilsSaid = false;
  /** WB7: his body's sounds - where he stood last frame and how far he has come since his last step, when he growls
   *  next, the health last heard and his last grunt, the landing that shook the ground, the phase the thunder has
   *  answered, and whether his body has met the floor */
  let stepFrom = null, strideRun = 0, growlAt = null, hpHeard = null, gruntAt = -Infinity, quaked = noMark(), thunderPhase = 0, thudCued = false;
  /** AUDIT WB D10: the frame's lists, refilled rather than made - the host asks for them every frame */
  const _batches = [], _lights = [];

  function reset(d) {
    day = d; judged = noMark(); cued = noMark(); landed = noMark(); phaseHeard = 0; fellCued = false; wrathLanded = false;
    prevT = -Infinity; hurtAt = -Infinity; shape = null; standIn = null; spewed = false; spoilsSaid = false;
    stepFrom = null; strideRun = 0; growlAt = null; hpHeard = null; gruntAt = -Infinity; quaked = noMark(); thunderPhase = 0; thudCued = false;
  }

  function sound(cue, s, t, atk) {
    if (!cue || !audio) return;
    const where = cue.at === 'targets' && atk?.tg?.length ? atk.tg.map((p) => courtToDungeon(p[0], 0.5, p[1]))
      : [(() => { const [x, z] = bossPlace(s, t); return courtToDungeon(x, 2.5, z); })()];
    const opts = { maxDistance: cue.reach, distanceModel: 'linear', pitch: cue.pitch };
    for (const p of where) {
      try { if (cue.id != null) audio.play3dId?.(cue.id, p, cue.volume, opts); else audio.play3d?.(cue.clip, p, cue.volume, opts); } catch { /* a sound is never the fight */ }
    }
  }

  /** A strike on me: its share of my own health, fire through my saving throw (the Wrath through nothing). */
  function land(atk) {
    const e = player(), so = blowOf(atk);
    if (!e || !so || !(e.health > 0)) return;
    let dmg = strikeDamage(so.pct, e.maxHealth);
    if (so.saved) dmg = fireShare(dmg, save(e));
    if (dmg <= 0) { say(COURT_STRIKE_TEXT.resisted(so.name)); return; }
    strike(dmg, { fire: so.el === 'fire', name: so.name });
  }

  function judge(s, t) {
    const atk = s.atk;
    const f = feet(), e = player();
    const standing = !!f && !!e && e.health > 0;
    if (atk && !marked(judged, atk) && standing) {
      const v = strikeVerdict(atk, f[0] - COURT_CENTRE[0], f[2] - COURT_CENTRE[2], t, prevT);
      if (v !== 'wait') {
        setMark(judged, atk);
        if (v === 'hit') { if (ATTACK_BY_ID[atk.a] === ATTACKS.wrath) wrathLanded = true; land(atk); }
      }
    }
    // the Wrath's own word, when it overtook its attack's landing on this screen: it lands all the same
    if (s.wrath != null && !wrathLanded) { wrathLanded = true; if (standing) land({ a: ATTACKS.wrath.id }); }
  }

  function cue(s, t) {
    const atk = s.atk, A = atk ? ATTACK_BY_ID[atk.a] : null;
    if (A && !marked(cued, atk)) { setMark(cued, atk); if (t < atk.at) sound(BOSS_CUES.windup[A.key], s, t, atk); }
    if (A && !marked(landed, atk) && t >= atk.at) { setMark(landed, atk); if (t < atk.at + Math.max(A.active, 1) + 400) sound(BOSS_CUES.land[A.key], s, t, atk); }
    if (A && !marked(quaked, atk) && t >= atk.at && QUAKE_ON.includes(A.key)) { setMark(quaked, atk); if (t < atk.at + Math.max(A.active, 1) + 400) sound(BOSS_CUES.quake, s, t, atk); }   // WB7: the ground's shock under a heavy landing
    if (s.phase > thunderPhase) { if (thunderPhase > 0) sound(BOSS_CUES.thunder, s, t, null); thunderPhase = s.phase; }   // WB7: thunder over his roar as a phase turns
    if (s.phase > phaseHeard) { if (phaseHeard > 0) sound(BOSS_CUES.roar, s, t, null); phaseHeard = s.phase; }
    if (s.fell && !fellCued) { fellCued = true; if (t < s.fell.at + FALL_CRY_LATE_MS) sound(BOSS_CUES.fall, s, t, null); }   // AUDIT WB B7: never a cry from long ago
    bodySounds(s, t, A);
  }

  /** WB7: HIS BODY, heard - a step each stride he walks or charges; a growl now and then while he is not striking; a
   *  grunt when a share of his health goes (no closer together than HURT_GAP_MS); his body meeting the floor. */
  function bodySounds(s, t, A) {
    if (s.fell) {
      if (!thudCued && t >= s.fell.at + THUD_AT_MS) { thudCued = true; if (t < s.fell.at + THUD_AT_MS + 1000) sound(BOSS_CUES.thud, s, t, null); }
      return;
    }
    const [x, z] = bossPlace(s, t);
    if (stepFrom) {
      strideRun += Math.hypot(x - stepFrom[0], z - stepFrom[1]);
      if (strideRun >= BOSS_STRIDE_M) { strideRun %= BOSS_STRIDE_M; sound(BOSS_CUES.step, s, t, null); }
    }
    stepFrom = [x, z];
    const striking = !!A && t < s.atk.at + Math.max(A.active, 1) + 1500;
    const nextGrowl = () => t + GROWL_EVERY_MS[0] + rng() * (GROWL_EVERY_MS[1] - GROWL_EVERY_MS[0]);
    if (growlAt === null) growlAt = nextGrowl();
    else if (striking) growlAt = Math.max(growlAt, t + 3000);
    else if (t >= growlAt) { sound(BOSS_CUES.growl, s, t, null); growlAt = nextGrowl(); }
    // AUDIT WB D3: the loss is counted from his last grunt, not from the last word - the relay says his health in small
    // steps, and in a big fight no one step was ever a share, so he never grunted at all; a heal (a newcomer's share)
    // starts the count again from where he stands
    if (hpHeard === null || s.hp > hpHeard) hpHeard = s.hp;
    else if (s.max > 0 && hpHeard - s.hp >= s.max * HURT_SHARE && t - gruntAt >= HURT_GAP_MS) { gruntAt = t; hpHeard = s.hp; sound(BOSS_CUES.hurt, s, t, null); }
  }

  /** WB5: THE BURST - SPEW_AT_MS into his fall, this player's spoils leave his chest toward them, off the seed of the
   *  receipt the relay signed for them (net/gateReceipt.js `c`); no receipt by RECEIPT_WAIT_MS, and none is coming - said
   *  once. */
  function burst(s, t) {
    if (!spoils || !s.fell || spewed || t < s.fell.at + SPEW_AT_MS) return;
    const r = link.receipt?.(s.day) ?? null, claims = r ? readReceipt(r) : null;
    if (!claims) {
      if (!spoilsSaid && t >= s.fell.at + RECEIPT_WAIT_MS) { spoilsSaid = true; say(COURT_STRIKE_TEXT.noSpoils(bossOf(s).name)); }
      return;
    }
    spewed = true;
    const [x, z] = bossPlace(s, s.fell.at);
    const at = courtToDungeon(x, GLOW_UP, z), f = feet();
    const bearing = f ? Math.atan2(f[0] - at[0], f[2] - at[2]) : s.yaw;
    spoils.spew({ day: s.day, seed: claims.c, level: player()?.level ?? 1, at, bearing, acct: claims.s });   // AUDIT WB A9: once a receipt - its day and account
  }

  function loadBody(s) {
    if (body || loading || !getTexture || !uploadRecordFrame || !renderer?.createBillboardBatch) return;
    const look = bossLookOf(s.boss), basics = ENEMY_BASICS[look.mobile];
    const archive = basics?.maleTexture;
    if (!archive) return;
    loading = Promise.resolve().then(() => getTexture(archive)).then((tex) => {
      body = tex ? { tex, archive, scale: look.scale } : { failed: true };
      if (!tex) console.warn(`[gate] the boss's sprite (archive ${archive}) would not load`);
    }, (e) => { body = { failed: true }; console.warn('[gate] the boss\'s sprite', e?.message ?? e); });
  }

  function drawBody(s, t) {
    loadBody(s);
    const act = bossAct(s, t, hurtAt);
    if (!body?.tex || act.act === 'gone') { if (batch) batch.hidden = true; return; }
    const [x, z] = bossPlace(s, t);
    const at = courtToDungeon(x, 0, z);
    const eye = cam() ?? at;
    const fr = bossFrame(act, s.yaw, at, eye, (rec) => body.tex.getFrameCount?.(rec) ?? 1);
    const rkey = `${fr.record}#${fr.frame}`;
    if (!renderer.textures?.has?.(`${body.archive}_${rkey}`)) uploadRecordFrame(body.archive, fr.record, fr.frame);
    const sz = mobileBillboardSize(body.tex, fr.record);   // a shared, cached object: read, never written
    const w = sz.w * body.scale, h = sz.h * body.scale;
    const size = { w: fr.flip ? -w : w, h };
    if (!batch) {
      batch = renderer.createBillboardBatch(body.archive, rkey, { w, h }, [[0, 0, 0]]);
      batch.origin = [0, 0, 0];
    }
    batch.hidden = false;
    batch.record = rkey;
    batch.size = size;
    if (batch.bounds) batch.bounds[3] = Math.hypot(w, h) * 0.5;   // the cull sphere follows the frame's own size
    batch.origin[0] = at[0]; batch.origin[1] = at[1]; batch.origin[2] = at[2];
  }

  return {
    /** One frame of the court: the verdicts, the voice, the body, the ground's shape and the bar. */
    frame() {
      const s = link.state(), t = now();
      if (!s || s.day === null) { if (day !== null) this.leave(); return; }
      if (s.day !== day) reset(s.day);
      judge(s, t);
      cue(s, t);
      drawBody(s, t);
      burst(s, t);
      spoils?.frame();
      shape = s.fell ? null : telegraphShape(s.atk, s.phase, t);
      drawGateBossBar(bossBarModel(s, t, bossOf(s)), { hidden: hudHidden() });
      prevT = t;
    },
    /**
     * WB4b: HIM AS A BODY MY BLOWS MEET, or null (no fight, or he has fallen): his feet in the dungeon's frame, his
     * facing, his height and radius (net/gateBrain.js - the relay measures a melee blow from the same body), whether
     * his ward stands, and his stand-in for the formulas (world/gateBoss.js bossStandIn).
     */
    target() {
      const s = link.state(), t = now();
      // AUDIT WB B6: nor once the Wrath has come - the relay judges no blow after it, and he is no one's to strike
      if (!s || s.day === null || s.fell || s.wrath != null || bossAct(s, t).act === 'gone') return null;
      standIn ??= bossStandIn(bossLookOf(s.boss), bossOf(s).name);
      const [x, z] = bossPlace(s, t);
      return { feet: courtToDungeon(x, 0, z), yaw: s.yaw, height: BOSS_H, radius: BOSS_R, warded: t < s.shieldUntil, entity: standIn, mobile: bossLookOf(s.boss).mobile };
    },
    /**
     * WB4b: A BLOW OF MINE MET HIM - `d` the formula's number on this machine, `r` its kind (net/gateBrain.js
     * HIT_KINDS). Out to the relay as the wire's hit (whole points, a sequence of its own), and he flinches. The ward
     * turns it (nothing sent - the relay would refuse it); a blow under one point is none. Answers whether it went.
     */
    hit({ d, r }) {
      const s = link.state(), t = now();
      if (!s || s.day === null || s.fell || s.wrath != null || !Object.values(HIT_KINDS).includes(r)) return false;   // AUDIT WB B6
      if (t < s.shieldUntil) return false;
      const dmg = Math.round(d);
      if (!(dmg >= 1)) return false;
      hurtAt = t;
      return !!send({ q: ++blowSeq, d: dmg, r });
    },
    /** A blow of mine landed on him: he flinches. */
    struck() { hurtAt = now(); },
    /** The body and the spoils, for the host's billboard pass (AUDIT WB D10: one list, refilled each frame). */
    batches() {
      _batches.length = 0;
      if (batch && !batch.hidden) _batches.push(batch);
      for (const b of spoils?.batches() ?? NONE) _batches.push(b);
      return _batches;
    },
    /** The glow on him and on the spoils, for the court's light channel (world/gateArena.js withCourtLights). */
    lights() {
      const s = link.state(); const g = s && s.day !== null ? bossGlow(s, now()) : null;
      _lights.length = 0;
      if (g) _lights.push(g);
      for (const l of spoils?.lights() ?? NONE) _lights.push(l);
      return _lights;
    },
    /** The telegraph and the spoils' glow, in the host's world pass (after the court and the billboards, before the
     *  foes' screen quads). Answers whether either drew (the host marks the foreign pass). */
    drawPass(proj, view, eye, seconds, fog = null) {
      pass?.draw(shape, proj, view, eye, seconds, fog);
      const lit = !!spoils?.drawPass(proj, view, eye, seconds, fog);
      return (!!shape && !!pass) || lit;
    },
    /** What the driver holds, for the tests and the stats. */
    state: () => ({ day, judgedI: judged.i, cuedI: cued.i, landedI: landed.i, phaseHeard, fellCued, wrathLanded, body: !!body?.tex, batch: !!batch && !batch.hidden, shape }),
    /** Out of the court: the body put away, the bar hidden, the fight forgotten (the texture is kept - the next court wears it). */
    leave() {
      spoils?.gather();   // WB5: whatever is still on the floor goes into the pack - never lost to a door, a death or the day's end
      if (batch) { renderer?.destroyBillboardBatch?.(batch); batch = null; }
      drawGateBossBar(null);
      reset(null);
    },
  };
}
