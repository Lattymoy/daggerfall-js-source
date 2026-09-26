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
import { ATTACK_BY_ID, ATTACKS, BOSS_H, BOSS_R, COURT_CENTRE, HIT_KINDS, POOL_TICK_MS, PHASE_NAMES } from '../net/gateBrain.js';
import { strikeVerdict, blowOf, strikeDamage, fireShare, landingPools, poolUnder } from '../net/gateStrike.js';
import { GATE_BOSSES, gateBossOf } from '../net/gateLaw.js';
import { bossAct, bossFrame, bossGlow, bossPlace, bossHop, bossLookOf, bossStandIn, BOSS_CUES, GLOW_UP, BOSS_STRIDE_M, GROWL_EVERY_MS, HURT_GAP_MS, HURT_SHARE, QUAKE_ON, THUD_AT_MS, POOL_COLOR, WARD_COLOR, EMBER_COLOR } from '../world/gateBoss.js';
import { courtToDungeon, portalDoor, PORTAL_AFTER_MS, PORTAL_RISE_MS, PORTAL_DROP, COURT_TEXT } from '../world/gateArena.js';
import { GateTelegraphRenderer, telegraphShape, markShape, poolShapes } from '../render/gateTelegraph.js';
import { GatePassRenderer, gateSpinRate } from '../render/gatePass.js';   // WBX2: the portal's fire is the gate's own
import { gateArchProfile, ARCH_Y0 } from '../world/gateModel.js';
import { gateLocal, openingHalfWidth, GATE_STEP_M } from './gatePool.js';
import { ONLINE_MINUTES_PER_MS } from '../net/wire.js';   // WBX7: a soul trap's rounds on the shared world's clock
import { bossBarModel, drawGateBossBar } from '../ui/gateBossBar.js';
import { readReceipt } from '../net/gateReceipt.js';
import { ENEMY_BASICS } from '../characters/enemyBasics.js';
import { mobileBillboardSize } from '../world/rmbFlats.js';

/** The words a strike says that the hurt itself does not; and the fall's, to a player the receipt never came for. */
export const COURT_STRIKE_TEXT = Object.freeze({
  resisted: (name) => `You resist the flames of the ${name}.`,
  noSpoils: (name) => `${name}'s spoils are not yours - you did not stand the fight.`,
  // WBX3 (Swololo on Discord: "loot was not distributed, was instantly pillaged by others"): said at the burst - every
  // fighter's spoils are their own, on their own screen, and nobody else can see or take them
  spilled: (name) => `${name}'s spoils spill across the floor - yours alone to take.`,
  burning: 'burning ground',
});
/** WBX5: THE TURN OF A PHASE, said over the screen as he leaps into the court's heart - each phase by its name
 *  (net/gateBrain.js PHASE_NAMES), and what it brings. */
export const COURT_PHASE_TEXT = Object.freeze({
  2: `${PHASE_NAMES[1]}: the ward breaks and the floor will burn - keep out of the fire.`,
  3: `${PHASE_NAMES[2]}: he calls on Dagon - stand between the spokes of fire.`,
});
/** WBX7: a magic round on the shared world's clock, ms - one game minute (net/wire.js ONLINE_MINUTES_PER_MS: TimeScale
 *  12, five seconds) - so a soul trap laid on him lasts its rounds as it would on any foe in the same world. */
export const COURT_ROUND_MS = Math.round(1 / ONLINE_MINUTES_PER_MS);
/** WBX4: his mark's ember, a little brighter than his glow's, so the floor under him reads at a glance. */
export const MARK_COLOR = Object.freeze(EMBER_COLOR.map((c) => Math.min(1, c * 1.1)));
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
 *   wayHome?: () => void,
 *   portalDoor?: (door: any) => void,
 *   soulTrap?: (trap: { chance: number, mobile: number, name: string }) => void,
 * }} deps
 *   WBX2: `wayHome` takes the way home (the mode machine's step through fire - the bridge membrane's own); `portalDoor`
 *   lays the risen portal's door into the court's exit doors, once, so the exit's own ray and name take it. WBX7:
 *   `soulTrap` rolls a soul trap of mine still on him at his fall (the host's attemptSoulTrap - a gem filled with his soul,
 *   and its words).
 */
export function createGateCourt({
  renderer = null, gl = null, getTexture = null, uploadRecordFrame = null, audio = null,
  link, spoils = null, now, cam = () => null, feet = () => null, player = () => null, save = () => 100,
  strike = () => {}, say = () => {}, hudHidden = () => false, send = () => false, rng = Math.random,
  wayHome = () => {}, portalDoor: layPortalDoor = () => {}, soulTrap = () => {},
}) {
  let pass = null;
  try { if (gl) pass = new GateTelegraphRenderer(gl); } catch (e) { console.warn('[gate] the telegraph would not build', e?.message ?? e); pass = null; }
  /** the sprite: its texture once loaded (or the promise, or a failure), its batch while drawn */
  let body = null, loading = null, batch = null;
  let batchShown = false;   // PERF-EXT10: the body's shown-or-not is the court's own, never a field the batch was not born with
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
  /** WBX5: the burning ground the landings this screen saw have left (net/gateStrike.js landingPools), the attack whose
   *  pools were laid last, and when the fire under my feet last bit; WBX4: his mark on the floor, and the pools' shapes */
  let pools = [], pooled = noMark(), burnAt = -Infinity, inFire = false, mark = null;
  /** @type {ReadonlyArray<any>} */
  let poolDraw = NONE;
  const _mark = markShape([0, 0], 0, MARK_COLOR);
  /** WBX2: the portal home once he has fallen - where it stands (the court's frame) and how far it has risen, its fire's
   *  pass and the arch's opening (made the first time one stands), its fire's turn, my feet's side of it last frame,
   *  and whether its door is laid and its rising said */
  let portal = null, portalPass = null, portalTried = false, profile = null, spin = 0, portalLz = null, portalLaid = false, portalSaid = false;
  /** WBX7: my soul trap on him - its chance (frozen at the cast) and when it runs out on the relay's clock - and whether
   *  his fall has rolled it */
  let trapMark = null, trapJudged = false;
  /** AUDIT WB D10: the frame's lists, refilled rather than made - the host asks for them every frame */
  const _batches = [], _lights = [];

  function reset(d) {
    day = d; judged = noMark(); cued = noMark(); landed = noMark(); phaseHeard = 0; fellCued = false; wrathLanded = false;
    prevT = -Infinity; hurtAt = -Infinity; shape = null; standIn = null; spewed = false; spoilsSaid = false;
    stepFrom = null; strideRun = 0; growlAt = null; hpHeard = null; gruntAt = -Infinity; quaked = noMark(); thunderPhase = 0; thudCued = false;
    pools = []; pooled = noMark(); burnAt = -Infinity; inFire = false; mark = null; poolDraw = [];
    portal = null; spin = 0; portalLz = null; portalLaid = false; portalSaid = false;
    trapMark = null; trapJudged = false;
  }

  /** WBX7: HIS FALL ROLLS MY TRAP, once - a trap of mine still running at the moment he fell (the relay's `fell.at`, not
   *  when this screen heard of it) goes to the host's roll with his mobile, the soul a gem takes. */
  function judgeTrap(s) {
    if (!s.fell || trapJudged) return;
    trapJudged = true;
    if (trapMark && s.fell.at < trapMark.until) soulTrap({ chance: trapMark.chance, mobile: bossLookOf(s.boss).mobile, name: bossOf(s).name });
  }

  /** WBX2: THE PORTAL HOME - PORTAL_AFTER_MS into his fall it stands where he fell and rises; its door is laid into the
   *  court's exit doors once (the ray and the plaque's name), the rising is said once, and my feet crossing its fire's
   *  plane inside the opening take the way home (gatePool.js's own step law, the stone's plinth not under it). */
  function portalFrame(s, t, dt) {
    if (!s.fell || t < s.fell.at + PORTAL_AFTER_MS) { portal = null; return; }
    const at = bossPlace(s, s.fell.at);
    portal = { at, rise: Math.min(1, (t - s.fell.at - PORTAL_AFTER_MS) / PORTAL_RISE_MS), origin: courtToDungeon(at[0], -PORTAL_DROP, at[1]) };
    profile ??= gateArchProfile();   // the arch's opening - the fire's shape and the step's bound, with or without a GL
    if (!portalTried && gl) {
      portalTried = true;
      try { portalPass = new GatePassRenderer(gl, profile); } catch (e) { console.warn('[gate] the portal would not build', e?.message ?? e); portalPass = null; }
    }
    spin = (spin + gateSpinRate(1) * Math.max(0, dt)) % 1;
    if (!portalLaid) { portalLaid = true; layPortalDoor(portalDoor(at)); }
    if (!portalSaid) { portalSaid = true; if (t < s.fell.at + PORTAL_AFTER_MS + PORTAL_RISE_MS + 1000) say(COURT_TEXT.portal); }   // said as it rises, never long after
    const f = feet(), e = player();
    if (!f || !e || !(e.health > 0) || portal.rise < 1) { portalLz = null; return; }
    const [lx, ly, lz] = gateLocal({ origin: portal.origin, yaw: 0 }, f);
    const inside = !!profile && Math.abs(lx) < openingHalfWidth(profile, Math.max(ARCH_Y0 + 0.05, ly + 0.9)) && Math.abs(lz) < GATE_STEP_M;
    if (inside && portalLz !== null && Math.sign(lz) !== Math.sign(portalLz) && lz !== 0) { portalLz = null; wayHome(); return; }
    portalLz = inside ? lz : null;
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

  /** A strike on me: its share of my own health and its base (WBX4), fire through my saving throw (the Wrath through
   *  nothing). */
  function land(atk) {
    const e = player(), so = blowOf(atk);
    if (!e || !so || !(e.health > 0)) return;
    let dmg = strikeDamage(so.pct, e.maxHealth, so.base);
    if (so.saved) dmg = fireShare(dmg, save(e));
    if (dmg <= 0) { say(COURT_STRIKE_TEXT.resisted(so.name)); return; }
    strike(dmg, { fire: so.el === 'fire', name: so.name });
  }

  /** WBX5: THE BURNING GROUND - a landing that leaves fire lays its pools the frame this screen sees it land (never one
   *  it did not see: the pools are this screen's, as the verdict is); STAYING in one bites every POOL_TICK_MS - the first
   *  bite a tick after I stepped in (or it fell under me: the landing has already struck), so a step out in time is
   *  free - fire, through my saving throw. The burnt-out go. */
  function burn(s, t) {
    const atk = s.atk, A = atk ? ATTACK_BY_ID[atk.a] : null;
    if (A && 'pool' in A && !marked(pooled, atk) && t >= atk.at) {
      setMark(pooled, atk);
      if (t < atk.at + Math.max(A.active, 1) + 400) for (const p of landingPools(atk)) pools.push(p);   // AUDIT WB B7's law: a landing long past is not laid now
    }
    if (pools.length) pools = pools.filter((p) => t < p.until);
    const f = feet(), e = player();
    if (!pools.length || !f || !e || !(e.health > 0) || s.fell || s.wrath != null) { inFire = false; return; }
    const p = poolUnder(pools, f[0] - COURT_CENTRE[0], f[2] - COURT_CENTRE[2], t);
    if (!p) { inFire = false; return; }
    if (!inFire) { inFire = true; burnAt = t; return; }
    if (t - burnAt < POOL_TICK_MS) return;
    burnAt = t;
    const dmg = fireShare(strikeDamage(p.pct, e.maxHealth, p.base), save(e));
    if (dmg > 0) strike(dmg, { fire: true, name: COURT_STRIKE_TEXT.burning });
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
    if (s.phase > phaseHeard) { if (phaseHeard > 0) { sound(BOSS_CUES.roar, s, t, null); if (COURT_PHASE_TEXT[s.phase]) say(COURT_PHASE_TEXT[s.phase]); } phaseHeard = s.phase; }   // WBX5: and the turn said, by its name
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
    if (spoils.spew({ day: s.day, seed: claims.c, level: player()?.level ?? 1, at, bearing, acct: claims.s })) say(COURT_STRIKE_TEXT.spilled(bossOf(s).name));   // AUDIT WB A9: once a receipt - its day and account; WBX3: and said to be theirs
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
    if (!body?.tex || act.act === 'gone') { batchShown = false; return; }
    const [x, z] = bossPlace(s, t);
    const at = courtToDungeon(x, bossHop(s, t), z);   // WBX5: high over the floor through a leap's arc
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
    batchShown = true;
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
      judgeTrap(s);   // WBX7: a soul trap of mine on him, rolled at his fall
      burn(s, t);   // WBX5: the ground his landings left burning
      cue(s, t);
      drawBody(s, t);
      burst(s, t);
      spoils?.frame();
      portalFrame(s, t, Number.isFinite(prevT) ? Math.max(0, t - prevT) / 1000 : 0);   // WBX2: the way home, once he has fallen
      shape = s.fell ? null : telegraphShape(s.atk, s.phase, t);
      // WBX4: his mark under him, while he stands; WBX5: the burning ground
      if (s.fell || s.wrath != null || bossAct(s, t, hurtAt).act === 'gone') mark = null;
      else { const [mx, mz] = bossPlace(s, t); _mark.origin[0] = mx; _mark.origin[1] = mz; _mark.yaw = s.yaw; _mark.color = t < s.shieldUntil ? WARD_COLOR : MARK_COLOR; mark = _mark; }   // AUDIT WB D10's law: one shape, refilled
      poolDraw = pools.length ? poolShapes(pools, t, POOL_COLOR) : NONE;
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
    /**
     * WBX7: A SOUL TRAP OF MINE LAID ON HIM (the dungeon context's spell door - scenes/dungeonContext.js spellOnBoss): its
     * chance and its rounds, kept on the relay's clock until his fall rolls it. A trap already running takes the new
     * rounds and keeps its own chance (AddState, SoulTrap.cs:94-97 - systems/effects.js's own law). Answers whether it
     * was kept (no fight, a fight over: nothing to keep it for).
     * @param {{ chance?: number, rounds?: number }} [trap]
     */
    trapped({ chance, rounds } = {}) {
      const s = link.state(), t = now();
      if (!s || s.day === null || s.fell || s.wrath != null || !Number.isFinite(chance) || !(rounds > 0)) return false;
      if (trapMark && t < trapMark.until) trapMark.until += rounds * COURT_ROUND_MS;
      else trapMark = { chance, until: t + rounds * COURT_ROUND_MS };
      return true;
    },
    /** The body and the spoils, for the host's billboard pass (AUDIT WB D10: one list, refilled each frame). */
    batches() {
      _batches.length = 0;
      if (batch && batchShown) _batches.push(batch);
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
      let drew = false;
      if (pass) {
        for (const ps of poolDraw) { pass.draw(ps, proj, view, eye, seconds, fog); drew = true; }   // WBX5: the burning ground under all
        if (mark) { pass.draw(mark, proj, view, eye, seconds, fog); drew = true; }   // WBX4: where he stands and faces
        if (shape) { pass.draw(shape, proj, view, eye, seconds, fog); drew = true; }
      }
      if (portal && portalPass) {   // WBX2: the portal home's fire and its beacon, rising where he fell
        portalPass.draw([{ origin: portal.origin, yaw: 0, open: 1, fade: portal.rise, spin }], proj, view, eye, seconds, fog);
        drew = drew || portalPass.drawn > 0;
      }
      const lit = !!spoils?.drawPass(proj, view, eye, seconds, fog);
      return drew || lit;
    },
    /** What the driver holds, for the tests and the stats. */
    state: () => ({ day, judgedI: judged.i, cuedI: cued.i, landedI: landed.i, phaseHeard, fellCued, wrathLanded, body: !!body?.tex, batch: !!batch && batchShown, shape, mark, pools: pools.map((p) => ({ ...p })), portal: portal ? { at: [...portal.at], rise: portal.rise, laid: portalLaid } : null }),
    /** WBX2: the portal home, while it stands - where (the court's frame) and how far it has risen - or null. */
    portal: () => (portal ? { at: [...portal.at], rise: portal.rise } : null),
    /** Out of the court: the body put away, the bar hidden, the fight forgotten (the texture is kept - the next court wears it). */
    leave() {
      spoils?.gather();   // WB5: whatever is still on the floor goes into the pack - never lost to a door, a death or the day's end
      if (batch) { renderer?.destroyBillboardBatch?.(batch); batch = null; batchShown = false; }
      drawGateBossBar(null);
      reset(null);
    },
  };
}
