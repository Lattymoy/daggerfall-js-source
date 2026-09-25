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
import { bossAct, bossFrame, bossGlow, bossPlace, bossLookOf, bossStandIn, BOSS_CUES } from '../world/gateBoss.js';
import { courtToDungeon } from '../world/gateArena.js';
import { GateTelegraphRenderer, telegraphShape } from '../render/gateTelegraph.js';
import { bossBarModel, drawGateBossBar } from '../ui/gateBossBar.js';
import { ENEMY_BASICS } from '../characters/enemyBasics.js';
import { mobileBillboardSize } from '../world/rmbFlats.js';

/** The words a strike says that the hurt itself does not. */
export const COURT_STRIKE_TEXT = Object.freeze({
  resisted: (name) => `You resist the flames of the ${name}.`,
});

/** The boss by his id (the relay's word), or the day's (net/gateLaw.js). */
export const bossOf = (s) => GATE_BOSSES.find((b) => b.id === s?.boss) ?? gateBossOf(s?.day ?? 0);

/**
 * @param {{
 *   renderer?: any, gl?: any,
 *   getTexture?: ((archive: number) => Promise<any>)|null,
 *   uploadRecordFrame?: ((archive: number, record: number, frame: number) => void)|null,
 *   audio?: any,
 *   link: { state: () => any },
 *   now: () => number,
 *   cam?: () => number[]|null,
 *   feet?: () => number[]|null,
 *   player?: () => any,
 *   save?: (entity: any) => number,
 *   strike?: (dmg: number, how: { fire: boolean, name: string }) => void,
 *   say?: (text: string) => void,
 *   hudHidden?: () => boolean,
 *   send?: (hit: { q: number, d: number, r: number }) => boolean,
 * }} deps
 */
export function createGateCourt({
  renderer = null, gl = null, getTexture = null, uploadRecordFrame = null, audio = null,
  link, now, cam = () => null, feet = () => null, player = () => null, save = () => 100,
  strike = () => {}, say = () => {}, hudHidden = () => false, send = () => false,
}) {
  let pass = null;
  try { if (gl) pass = new GateTelegraphRenderer(gl); } catch (e) { console.warn('[gate] the telegraph would not build', e?.message ?? e); pass = null; }
  /** the sprite: its texture once loaded (or the promise, or a failure), its batch while drawn */
  let body = null, loading = null, batch = null;
  /** the fight this driver is on (its day), and what it has done with its attacks */
  let day = null, judgedI = -1, cuedI = -1, landedI = -1, phaseHeard = 0, fellCued = false, wrathLanded = false;
  let prevT = -Infinity, hurtAt = -Infinity, shape = null;
  /** WB4b: his stand-in for the formulas (made once a fight), and my blows' sequence (the wire's `q`) */
  let standIn = null, blowSeq = 0;

  function reset(d) {
    day = d; judgedI = -1; cuedI = -1; landedI = -1; phaseHeard = 0; fellCued = false; wrathLanded = false;
    prevT = -Infinity; hurtAt = -Infinity; shape = null; standIn = null;
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
    if (atk && atk.i !== judgedI && standing) {
      const v = strikeVerdict(atk, f[0] - COURT_CENTRE[0], f[2] - COURT_CENTRE[2], t, prevT);
      if (v !== 'wait') {
        judgedI = atk.i;
        if (v === 'hit') { if (ATTACK_BY_ID[atk.a] === ATTACKS.wrath) wrathLanded = true; land(atk); }
      }
    }
    // the Wrath's own word, when it overtook its attack's landing on this screen: it lands all the same
    if (s.wrath != null && !wrathLanded) { wrathLanded = true; if (standing) land({ a: ATTACKS.wrath.id }); }
  }

  function cue(s, t) {
    const atk = s.atk, A = atk ? ATTACK_BY_ID[atk.a] : null;
    if (A && atk.i !== cuedI) { cuedI = atk.i; if (t < atk.at) sound(BOSS_CUES.windup[A.key], s, t, atk); }
    if (A && atk.i !== landedI && t >= atk.at) { landedI = atk.i; if (t < atk.at + Math.max(A.active, 1) + 400) sound(BOSS_CUES.land[A.key], s, t, atk); }
    if (s.phase > phaseHeard) { if (phaseHeard > 0) sound(BOSS_CUES.roar, s, t, null); phaseHeard = s.phase; }
    if (s.fell && !fellCued) { fellCued = true; sound(BOSS_CUES.fall, s, t, null); }
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
      if (!s || s.day === null || s.fell || bossAct(s, t).act === 'gone') return null;
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
      if (!s || s.day === null || s.fell || !Object.values(HIT_KINDS).includes(r)) return false;
      if (t < s.shieldUntil) return false;
      const dmg = Math.round(d);
      if (!(dmg >= 1)) return false;
      hurtAt = t;
      return !!send({ q: ++blowSeq, d: dmg, r });
    },
    /** A blow of mine landed on him: he flinches. */
    struck() { hurtAt = now(); },
    /** The body, for the host's billboard pass. */
    batches: () => (batch && !batch.hidden ? [batch] : []),
    /** The glow on him, for the court's light channel (world/gateArena.js withCourtLights). */
    lights() { const s = link.state(); const g = s && s.day !== null ? bossGlow(s, now()) : null; return g ? [g] : []; },
    /** The telegraph, in the host's world pass (after the court and the billboards, before the foes' screen quads). */
    drawPass(proj, view, eye, seconds, fog = null) { pass?.draw(shape, proj, view, eye, seconds, fog); return !!shape && !!pass; },
    /** What the driver holds, for the tests and the stats. */
    state: () => ({ day, judgedI, cuedI, landedI, phaseHeard, fellCued, wrathLanded, body: !!body?.tex, batch: !!batch && !batch.hidden, shape }),
    /** Out of the court: the body put away, the bar hidden, the fight forgotten (the texture is kept - the next court wears it). */
    leave() {
      if (batch) { renderer?.destroyBillboardBatch?.(batch); batch = null; }
      drawGateBossBar(null);
      reset(null);
    },
  };
}
