// @ts-check
// WB14d (2026-10-19, Mac: "the boss splitting and players having to split and navigate to beat both sides and then merging at
// the end for its final stand (chance based encounter modifer)"; bible/11-Multiplayer/Breach-Portents.md sections 5 and 6):
// HIS FLAME ON MY SCREEN - the second body of a Sundering night (the relay's `sd`, net/gate/gateLink.js GateSunder), drawn,
// heard and judged as he is: its blows on my feet (net/gate/gateStrike.js strikeVerdict; its Brand through an arsenal of its
// own, scenes/gate/gateArsenal.js), their sounds, bursts and burning ground; its sprite (world/gate/gateBoss.js flameLookOf -
// his aspect's Atronach), its glow, its mark and its telegraph; a body my blows meet (offered with his host's, FLAME_I -
// out as the `hit` word's `b` 1); and the Sundering's moments said (a half knelt, a half risen, the Rejoining). The Blade
// is his own body: the court draws it.
//
// Every piece reads THE FLAME'S VIEW of the state (flameOf): the state with the Flame's body in his place, so the gate's own
// pure parts (bossPlace, bossAct, bossGlow, telegraphShape, strikeVerdict, profileOf - its half's) serve it unchanged, as the
// relay's beat serves it through its view of the fight (net/gate/gateBrain.js flameView).
//
// Not a DFU member. Ledger A (WB).
import { ATTACK_BY_ID, ATTACKS, COURT_CENTRE, HALF, HIT_KINDS, POSE_SLACK, inCourt, nearestCourt, profileOf } from '../../net/gate/gateBrain.js';
import { strikeVerdict, landingPools } from '../../net/gate/gateStrike.js';
import { bossAct, bossFrame, bossGlow, bossPlace, bossHop, bossStandIn, bossCue, BOSS_CUES, QUAKE_ON, RELEASE_LEAD_MS, WARD_COLOR, emberColor, flameLookOf, gateHitFlash, halfName } from '../../world/gate/gateBoss.js';
import { courtToDungeon } from '../../world/gate/gateArena.js';
import { telegraphShape, markShape } from '../../render/gate/gateTelegraph.js';
import { setBatchHitFlash } from '../../systems/hitFlash.js';
import { ENEMY_BASICS } from '../../characters/enemy/enemyBasics.js';
import { creatureLook } from '../../characters/creatureBodies.js';
import { rosterActor } from '../../characters/rosterBodies.js';
import { mobileBillboardSize } from '../../world/rmbFlats.js';
import { t } from '../../systems/textManager.js';

/** The Flame's number among the bodies my blows meet beside his host's (a host body's is from 1). */
export const FLAME_I = -1;
/** The Sundering's moments, said while they are news (the court's FED_LATE_MS's law). */
export const SUNDER_LATE_MS = 2000;
/** The Sundering's words - each the event and the order (WB13b), read through the text core (L10N4). */
export const SUNDER_TEXT = Object.freeze({
  kneels: (name) => t('gate.sunder.kneels', '{name} kneels! Bring the other half down!', { name }),
  rises: (name) => t('gate.sunder.rises', '{name} rises.', { name }),
  rejoin: () => t('gate.sunder.rejoin', 'The halves rejoin in the first court. Run back!'),
});

const NONE = Object.freeze([]);
/** An attack is its number and its moment (AUDIT WB B4's law - the court's own marks, kept here for the Flame's). */
const noMark = () => ({ i: -1, at: NaN });
const marked = (m, atk) => m.i === atk.i && m.at === atk.at;
const setMark = (m, atk) => { m.i = atk.i; m.at = atk.at; };

const _views = new WeakMap();
/**
 * THE FLAME'S VIEW of a court's state, or null (he stands whole): the state with the Flame's body in his place - its
 * place, facing, walk, blow, ward and kneel (its stun), its pool and whole for his health, no crystals and no host, and
 * `half` the Flame's (profileOf reads its body's size). One a state, kept while the state is. Pure.
 * @param {any} s the court's state (net/gate/gateLink.js GateState)
 */
export function flameOf(s) {
  const S = s?.sd;
  if (!S) return null;
  let v = _views.get(s);
  if (!v) {
    const F = S.fl;
    v = Object.freeze({ ...s, x: F.x, z: F.z, yaw: F.yaw, move: F.move, atk: F.atk, shieldUntil: F.sh, stunUntil: F.su, stunAt: F.sa, hp: S.h[HALF.flame], max: S.m, cx: null, lg: null, half: HALF.flame });
    _views.set(s, v);
  }
  return v;
}

/**
 * @param {{ renderer?: any, getTexture?: any, uploadRecordFrame?: any, cam?: () => any, feet?: () => any, player?: () => any,
 *   say?: (text: string) => void, sound?: (cue: any, s: any, t: number, atk: any, point?: any) => void,
 *   land?: (atk: any, P: any) => void, burst?: (atk: any, A: any, P: any) => void, felt?: (s: any, t: number, A: any, atk: any) => void,
 *   lay?: (pools: any[]) => void, send?: (hit: any) => boolean, blowQ?: (who: string) => number, watching?: () => boolean,
 *   arsenal?: any, bossName?: (s: any) => string }} deps
 *   the court's own doors: its `sound` at a body (the view's place), its strike on me (`land`), a landing's bursts and its
 *   felt shake, its burning ground (`lay` - its pools join the court's), the `hit` word out, my blows' one sequence, the
 *   watcher's law, an arsenal of the Flame's own (createGateArsenal over the court's places) and his name.
 */
export function createGateFlame({
  renderer = null, getTexture = null, uploadRecordFrame = null, cam = () => null, feet = () => null, player = () => null,
  say = () => {}, sound = () => {}, land = () => {}, burst = () => {}, felt = () => {}, lay = () => {}, send = () => false, blowQ = () => 0,
  watching = () => false, arsenal = null, bossName = () => '',
} = {}) {
  let judged = noMark(), cued = noMark(), released = noMark(), landed = noMark(), quaked = noMark(), pooled = noMark();
  let prevT = -Infinity, hurtAt = -Infinity, knHeard = [0, 0], rjHeard = 0;
  /** the sprite: its look (by his aspect), its texture once loaded, its batch while drawn */
  let look = null, body = null, loading = null, batch = null, shown = false, standIn = null, shape = null, mark = null;
  const rec = {}, _glow = { x: 0, y: 0, z: 0, range: 0, color: [0, 0, 0] };
  const _target = { i: FLAME_I, m: 0, feet: [0, 0, 0], height: 1, radius: 1, entity: null, mobile: null };
  const _targets = [], _shapes = [], _lights = [], _batches = [];
  let _mark = null, _markOf = null;

  function reset() {
    judged = noMark(); cued = noMark(); released = noMark(); landed = noMark(); quaked = noMark(); pooled = noMark();
    prevT = -Infinity; hurtAt = -Infinity; knHeard = [0, 0]; rjHeard = 0; standIn = null; shape = null; mark = null;
    arsenal?.reset?.();
  }
  /** My feet in the court's frame, or null. */
  const _mine = [0, 0];   // AUDIT WB14 (SCREEN-10): one pair refilled, read at once by each caller
  const mine = () => { const f = feet(); if (!f) return null; _mine[0] = f[0] - COURT_CENTRE[0]; _mine[1] = f[2] - COURT_CENTRE[2]; return _mine; };
  /** Do my feet stand in the Flame's court (the relay takes a blow on it from nowhere else)? */
  const inItsCourt = (F, now) => { const m = mine(); if (!m) return false; const [x, z] = bossPlace(F, now); return inCourt(m[0], m[1], nearestCourt(x, z), POSE_SLACK); };

  /** Its blows on me: the ground's verdict on my feet once a blow, the Brand through its own arsenal. */
  function judge(F, now, P) {
    const atk = F.atk, f = feet(), e = player(), standing = !!f && !!e && e.health > 0;
    if (atk && !marked(judged, atk) && standing) {
      const v = strikeVerdict(atk, f[0] - COURT_CENTRE[0], f[2] - COURT_CENTRE[2], now, prevT, P);
      if (v !== 'wait') { setMark(judged, atk); if (v === 'hit') land(atk, P); }
    }
    arsenal?.judge?.(F, now, P, mine(), null, standing);
  }
  /** Its voice and its landings: the wind-up's cue, the release, the landing's sound, bursts, shake and burning ground. */
  function cue(F, now, P) {
    const atk = F.atk, A = atk ? ATTACK_BY_ID[atk.a] : null;
    if (!A) return;
    if (!marked(cued, atk)) { setMark(cued, atk); if (now < atk.at) sound(bossCue('windup', A, P), F, now, atk); }
    if (!marked(released, atk) && now >= atk.at - RELEASE_LEAD_MS) { setMark(released, atk); if (now < atk.at) sound(bossCue('release', A, P), F, now, atk); }
    const fresh = now < atk.at + Math.max(A.active, 1) + 400;
    if (!marked(landed, atk) && now >= atk.at) { setMark(landed, atk); if (fresh) { sound(bossCue('land', A, P), F, now, atk); burst(atk, A, P); felt(F, now, A, atk); } }
    if (!marked(quaked, atk) && now >= atk.at && QUAKE_ON.includes(A.key)) { setMark(quaked, atk); if (fresh) sound(BOSS_CUES.quake, F, now, atk); }
    if (P.atk[A.key].pool && !marked(pooled, atk) && now >= atk.at) { setMark(pooled, atk); if (fresh) lay(landingPools(atk, P)); }   // its ground joins the court's
  }
  /** The Sundering's moments, said while they are news: a half knelt, a half risen, the Rejoining. */
  function words(s, now, P) {
    const S = s.sd;
    for (const b of [HALF.blade, HALF.flame]) {
      const kn = S.kn[b] | 0;
      if (kn !== knHeard[b]) {
        if (kn > 0 && now - kn <= SUNDER_LATE_MS) say(SUNDER_TEXT.kneels(halfName(b, P, bossName(s))));
        else if (kn === 0 && knHeard[b] > 0 && !S.rj) say(SUNDER_TEXT.rises(halfName(b, P, bossName(s))));
        knHeard[b] = kn;
      }
    }
    if (S.rj && S.rj !== rjHeard) { rjHeard = S.rj; if (now - S.rj <= SUNDER_LATE_MS) say(SUNDER_TEXT.rejoin()); }
  }
  function loadBody(P) {
    const want = flameLookOf(P.aspect?.id);
    if (look && look.mobile !== want.mobile) { body = null; loading = null; if (batch) { renderer?.destroyBillboardBatch?.(batch); batch = null; } }   // another night's aspect: another Atronach
    look = want;
    if (body || loading || !getTexture || !uploadRecordFrame || !renderer?.createBillboardBatch) return;
    const archive = ENEMY_BASICS[look.mobile]?.maleTexture;
    if (!archive) return;
    const mobile = look.mobile;
    loading = Promise.resolve().then(() => getTexture(archive)).then((tex) => {
      if (look?.mobile === mobile) body = tex ? { tex, archive, scale: look.scale } : { failed: true };
    }, () => { body = { failed: true }; });
  }
  function drawBody(F, now, P) {
    loadBody(P);
    if (!body?.tex) { shown = false; return; }
    const act = bossAct(F, now, hurtAt), [x, z] = bossPlace(F, now);
    const at = courtToDungeon(x, bossHop(F, now), z), eye = cam() ?? at;
    const fr = bossFrame(act, F.yaw, at, eye, (r) => body.tex.getFrameCount?.(r) ?? 1);
    const rkey = `${fr.record}#${fr.frame}`;
    if (!renderer.textures?.has?.(`${body.archive}_${rkey}`)) uploadRecordFrame(body.archive, fr.record, fr.frame);
    const sz = mobileBillboardSize(body.tex, fr.record);
    const w = sz.w * body.scale * P.size, h = sz.h * body.scale * P.size;
    if (!batch) { batch = renderer.createBillboardBatch(body.archive, rkey, { w, h }, [[0, 0, 0]]); batch.origin = [0, 0, 0]; }
    shown = true;
    setBatchHitFlash(batch, gateHitFlash(hurtAt, -Infinity, now));
    batch.record = rkey;
    batch.size = { w: fr.flip ? -w : w, h };
    if (batch.bounds) batch.bounds[3] = Math.hypot(w, h) * 0.5;
    batch.origin[0] = at[0]; batch.origin[1] = at[1]; batch.origin[2] = at[2];
  }

  return {
    /** One frame: its blows judged on me, its voice, its words, its body, its ground's shape, its mark - none while he
     *  stands whole (the state names no halves). */
    frame(s, now) {
      const F = flameOf(s);
      if (!F || s.fell || s.wrath != null) { shown = false; shape = null; mark = null; _targets.length = 0; if (!F) { knHeard = [0, 0]; } prevT = now; return; }
      const P = profileOf(F);
      judge(F, now, P);
      cue(F, now, P);
      words(s, now, P);
      drawBody(F, now, P);
      shape = telegraphShape(F.atk, F.phase, now, P, (k) => arsenal?.at?.(F.atk, k, mine()) ?? null);
      if (_markOf !== P) { _markOf = P; _mark = markShape([0, 0], 0, emberColor(P), P.bossR); }
      const [mx, mz] = bossPlace(F, now);
      _mark.origin[0] = mx; _mark.origin[1] = mz; _mark.yaw = F.yaw; _mark.color = now < F.shieldUntil ? WARD_COLOR : emberColor(P); _mark.court = nearestCourt(mx, mz); mark = _mark;
      // THE BODY MY BLOWS MEET - from its own court, standing (a kneeling half takes nothing: its ward turns the blow)
      _targets.length = 0;
      if (inItsCourt(F, now)) {
        standIn ??= bossStandIn(look ?? flameLookOf(P.aspect?.id), halfName(HALF.flame, P, bossName(s)), () => { const S = s.sd; return S && S.m > 0 ? S.h[HALF.flame] / S.m : null; });
        standIn.warded = now < F.shieldUntil || now < F.stunUntil;
        _target.m = s.sd.m; _target.feet = courtToDungeon(mx, 0, mz); _target.height = P.bossH; _target.radius = P.bossR; _target.entity = standIn; _target.mobile = look?.mobile ?? null;
        _targets.push(_target);
      }
      prevT = now;
    },
    /** The bodies my blows meet beside his host's (the court's hostTargets) - read, never written. */
    targets: () => _targets,
    /** A BLOW OF MINE MET THE FLAME: out as the `hit` word with `b` 1 (whole points, my blow's sequence), and it flinches.
     *  Turned by its ward and its kneel, and from outside its court; a watcher strikes nothing. Answers whether it went. */
    hit(s, { d, r } = /** @type {any} */ ({}), now) {
      const F = flameOf(s);
      if (!F || s.fell || s.wrath != null || !Object.values(HIT_KINDS).includes(r) || now < F.shieldUntil || now < F.stunUntil || !inItsCourt(F, now)) return false;
      const dmg = Math.round(d);
      if (!(dmg >= 1) || watching()) return false;
      hurtAt = now;
      return !!send({ q: blowQ('f'), d: dmg, r, b: HALF.flame });
    },
    /** Its telegraph and its mark, for the court's pass. */
    shapes() { _shapes.length = 0; if (mark) _shapes.push(mark); if (shape) _shapes.push(shape); return _shapes; },
    /** Its glow, for the court's light channel. */
    lights(s, now) { _lights.length = 0; const F = flameOf(s); const g = F && shown ? bossGlow(F, now, _glow) : null; if (g) _lights.push(g); return _lights; },
    /** Its sprite, for the billboard pass. */
    batches() { _batches.length = 0; if (batch && shown) _batches.push(batch); return _batches; },
    /** MWNPC10: its Morrowind body on the court's lane, as his. */
    offerBodies(lane, s, now) {
      const F = flameOf(s);
      if (!F || !batch || !shown || !look) return;
      const cl = creatureLook({ mobileType: look.mobile });
      if (!cl) return;
      const act = bossAct(F, now, hurtAt);
      lane.offer(rosterActor(rec, { id: 'flame', look: cl, feet: batch.origin, yaw: F.yaw, moving: act.act === 'walk' || act.act === 'run', running: act.act === 'run',
        swingKey: F.atk?.at ?? null, hitKey: hurtAt, dead: 0, scale: (body?.scale ?? 1) * (profileOf(F).size ?? 1) }), batch, null, batch.hitFlash || 0);
    },
    /** Its blow's order on me while it winds up (the Brand's), for the ground view. */
    order: (s, now, mineXZ, yaw) => { const F = flameOf(s); return F && arsenal?.order ? arsenal.order(F, now, profileOf(F), mineXZ, yaw) : null; },
    reset,
    /** Out of the court: its sprite put away. */
    leave() { if (batch) { renderer?.destroyBillboardBatch?.(batch); batch = null; } shown = false; reset(); },
    /** What it holds, for the tests. */
    state: () => ({ judgedI: judged.i, cuedI: cued.i, landedI: landed.i, shown, shape, mark, targets: _targets.length, knHeard: [...knHeard], rjHeard }),
  };
}
