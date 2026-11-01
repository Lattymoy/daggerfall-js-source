// @ts-check
// DRAGON3 (2026-10-29, the owner: "a sort of world boss when found anywhere in the world ... Telegraph and unique attack
// patterns, different movement and aerial integration"; bible/11-Multiplayer/Dwarven-Dragon.md sections 3, 6, 7, 9): THE
// DWARVEN DRAGON ON THIS SCREEN - in the sky over its site (its roost the clock's, its fight the cell's plan), its sighting,
// the `in`, its blows draped on the land and judged on MY feet (egBlowVerdict), my shafts, spells and swings out to its
// cell, its bar's model, its voice, its fall and its remains. scenes/world.js wires it; every seam is in `deps` (below,
// createDragonHost), so it runs in Node. Not a DFU member. Ledger A (DRAGON).
import { dragonTimes, dragonWatchesAbout, dragonQuietAt, dragonAskEnd, dragonToldAt, isDragonOmen, dragonLookOf, DRAGON_CLIMB_MS, DRAGON_REMAINS_MS, DRAGON_BRAIN_V, DRAGON_NATIVE_PER_M, DRAGON_LAND_SPAN_MS } from '../net/dragon/dragonLaw.js';
import { planAt, dragonLegAt, roostLeg, climbLeg, DRAGON_BODY_R, DRAGON_BODY_H } from '../net/dragon/dragonBody.js';
import { DRAGON_BLOWS, DRAGON_BLOW, DRAGON_ADMIT_R, DRAGON_FAN_R, DRAGON_ENGAGE_R, DRAGON_MODE, DRAGON_STATE_SEND_MS } from '../net/dragon/dragonBrain.js';
import { HIT_KINDS } from '../net/gate/gateBrain.js';
import { strikeDamage, savedShare } from '../net/gate/gateStrike.js';
import { egBlowVerdict } from '../net/eliteGates/egShape.js';
import { cellRoomOfWire, mapPixelOfWire } from '../net/wire.js';
import { bossStandIn, bossFrame, bossReach, hostCue, gateHitFlash, standInBlowCap } from '../world/gate/gateBoss.js';
import { wordShare } from '../combat/healthShare.js';
import { calculateAttackDamage } from '../combat/formulas.js';
import { shaftOnRelayBody } from '../combat/arrowFlight.js';
import { setBatchHitFlash, setBatchGlint } from '../systems/hitFlash.js';
import { hitSoundFor, ENEMY_HIT_VOLUME } from '../systems/soundClips.js';
import { savingThrow, ELEMENTS, EFFECT_FLAGS } from '../systems/spellcast.js';
import { sceneCompassWord } from '../systems/compassWords.js';
import { ENEMY_BASICS } from '../characters/enemy/enemyBasics.js';
import { stateAnims, PRIMARY_ATTACK_ANIM_SPEED, HURT_ANIM_SPEED } from '../characters/mobile/mobileUnit.js';
import { mobileBillboardSize } from '../world/rmbFlats.js';
import { DWARVEN_DRAGON_ID, dragonArchiveOf } from '../characters/dwarvenDragonId.js';
import { playerEntity, hurtPlayer, surfacePlayer } from '../characters/playerEntity.js';
import { playerPainVoice, playPlayerVoice } from './hostCombat.js';
import { flashPlayerDamage } from '../ui/damageFlash.js';
import { fillStamp } from './eliteGates/egFight.js';
import { createSerpentSpell } from './gate/standInSpell.js';
import { TELEGRAPH_STYLE, TELEGRAPH_EDGE, TELEGRAPH_POOL, TELEGRAPH_KIND } from '../render/gate/gateTelegraph.js';
import { DragonTelegraphPass, drapeBounds, drapeGrid } from '../render/dragon/dragonTelegraph.js';
import { dragonName, dragonTitle, DRAGON_WORDS, DRAGON_BLOW_NAMES, DRAGON_NO_TEXT } from '../systems/dragon/dragonWords.js';
import { createDragonRewards } from './dragonRewards.js';   // DRAGON4: its receipts carried, its hoard given, a tame kept
import { createDragonSites } from '../systems/dragon/dragonSite.js';   // AUDIT DRAGON: the sky made whole here (createDragonSky)
import { createDragonLink } from '../net/dragon/dragonLink.js';
import { dragonBarModel } from '../ui/dragonBar.js';
import { createDragonKeep } from './dragonKeepHost.js';   // DRAGON5b: the tamed dragon where it waits, comes and goes

/** Its drawn size over its sprite's own (a wingspan near 19 m), how far it is drawn and heard, and the sighting's reach (m). */
export const DRAGON_SCALE = 1.6;
export const DRAGON_SIGHT_R = 4000;
export const DRAGON_ROAR_R = 3000;
export const DRAGON_NOTICE_R = 1500;
/** Its roar comes once in this span while it flies unslain (ms - the clock's, so every screen near hears it together). */
export const DRAGON_ROAR_MS = 40_000;
/** The sighting waits this long within its reach (ms - more than the cell's whole state's pace), so a dragon its cell says
 *  slain is never told as circling. */
export const DRAGON_NOTICE_WAIT_MS = 6000;
/** The `in` again while answered, and soon again while not (ms). */
export const DRAGON_IN_RESEND_MS = 20_000;
export const DRAGON_IN_RETRY_MS = 3000;
/** DRAGON-HIDDEN: an `ask` for a watch's omen, again this often until it is answered. DRAGON-HIDDEN-TIME: asked from the
 *  watch's start (its landing is nobody's to count), so a landing is heard within this of it, at four asks a minute. */
export const DRAGON_ASK_RETRY_MS = 15_000;
/** AUDIT DRAGON-CELL D6: a `null` is asked again from the same pixel after this long (ms) - the relay may not have judged
 *  my pose there yet, or I asked from a room it could not judge. */
export const DRAGON_NONE_AGAIN_MS = 60_000;
/** A fight unheard this long (three of its whole states) is left and asked again (ms). */
export const DRAGON_HEARD_MS = 3 * DRAGON_STATE_SEND_MS;
/** A landing seen later than this is neither judged nor heard (ms - the gate's), and a shape lingers this long after (ms). */
export const DRAGON_LATE_MS = 400;
export const DRAGON_LINGER_MS = 300;
/** My blows out: one word each at most this often (the relay hears four a second), the queue's bound. */
export const DRAGON_HIT_GAP_MS = 260;
export const DRAGON_HITS_QUEUED = 8;
/** A target's id in the shots' field and a missile's marks. */
export const DRAGON_TARGET = 'dragon:0';
/** Its remains' wash (its glow out), and the blows' colours by element. The Aetherbright wears its own palette (DRAGON7:
 *  archive 1801, characters/dwarvenDragonShiny.js), never a wash. */
export const REMAINS_WASH = Object.freeze([0.42, 0.4, 0.38]);
const COLOR_OF = Object.freeze({ fire: [1.0, 0.45, 0.1], shock: [0.6, 0.7, 1.0], null: [1.0, 0.62, 0.22] });
const STYLE_OF = Object.freeze({ fire: TELEGRAPH_STYLE.fire, shock: TELEGRAPH_STYLE.shock });
/** The saving throw a blow's element meets (the gate's GATE_SAVES pairs). */
const SAVES = Object.freeze({ fire: [ELEMENTS.Fire, EFFECT_FLAGS.Fire], shock: [ELEMENTS.Shock, EFFECT_FLAGS.Shock] });
/** Its voice: the Iron Atronach's pitched down for its size, a Dragonling's bark an octave down for its roar. */
const DRAGONLING = 34;
const cueOf = (kind) => {
  const E = ENEMY_BASICS[DWARVEN_DRAGON_ID] ?? ENEMY_BASICS[36] ?? {}, base = hostCue(kind, DWARVEN_DRAGON_ID);
  if (kind === 'roar') return { clip: ENEMY_BASICS[DRAGONLING]?.barkSound ?? E.barkSound, pitch: 0.5, volume: 1.6, reach: DRAGON_ROAR_R };
  return base ? { ...base, pitch: base.pitch * 0.7, volume: base.volume * 1.3, reach: base.reach * 2.5 } : null;
};

/** What it is doing at `t`, as its mobile's animation: falling, lying, winding up, striking, flinching, walking, flying. Pure. */
export function dragonAct(s, t, blow, moving, hurtAt) {
  const tab = (state) => stateAnims(state, DWARVEN_DRAGON_ID, true, false, false, true, false, false);
  if (s?.fell) {
    const land = (s.legs?.[0]?.at ?? s.fell.at) + (s.legs?.[0]?.ms ?? 0);
    return t < land ? { act: 'fall', anims: tab('hurt'), frame: Math.floor(((t - s.fell.at) / 1000) * HURT_ANIM_SPEED), loop: false } : { act: 'remains', anims: tab('idle'), frame: 0, loop: false };
  }
  if (blow && t < blow.at) { const k = (t - (blow.at - blow.wu)) / Math.max(1, blow.wu); return { act: 'windup', anims: tab('attack'), frame: k >= 0.5 ? 1 : 0, loop: false, k }; }
  if (blow && t - blow.at < 600) return { act: 'strike', anims: tab('attack'), frame: 2 + Math.floor(((t - blow.at) / 1000) * PRIMARY_ATTACK_ANIM_SPEED), loop: false };
  if (t - hurtAt < 350) return { act: 'flinch', anims: tab('hurt'), frame: Math.floor(((t - hurtAt) / 1000) * HURT_ANIM_SPEED), loop: false };
  const aloft = s?.md !== DRAGON_MODE.ground || t < (s?.ma ?? 0);   // DRAGON-HOVER: at rest in the air it hovers, records 20-24
  const T = tab(moving ? 'move' : aloft ? 'ranged' : 'idle');
  return { act: moving ? 'walk' : 'fly', anims: T, frame: Math.floor((t / 1000) * (T[0]?.fps ?? 6)), loop: true };
}

/** Where watch `d`'s dragon (its omen and its times) flies at `t` with no fight heard: its roost, then its climb away from
 *  its leaving. Pure. */
export function dragonSkyAt(d, t) {
  const roost = roostLeg(d);
  if (t < d.leaveAt) return dragonLegAt(roost, t);
  return dragonLegAt(climbLeg(dragonLegAt(roost, d.leaveAt), d.leaveAt, DRAGON_CLIMB_MS), t);
}

/** The dragon a screen draws at `t` - `{w, s, landAt, leaveAt}` - or null: this watch's or the last's, once it has come
 *  down and while its remains may still lie, of an omen its cell has told (`seedOf(w)`, DRAGON-HIDDEN). Pure. */
export function skyWatchAt(t, seedOf) {
  for (const w of dragonWatchesAbout(t)) {
    const s = seedOf(w), o = { w, s };
    if (s == null || !isDragonOmen(o)) continue;
    const p = dragonTimes(o);
    if (t >= p.landAt && t < p.leaveAt + DRAGON_REMAINS_MS) return { ...p, s };
  }
  return null;
}

/** The shots' and missiles' marks with the dragon's among them, when there is a host (`others` the serpent's). */
export const dragonBoxesWith = (sky, others) => (sky ? sky.boxes(others) : others);

/**
 * deps = { now, link (dragonLink.js), sites (dragonSite.js), online: { ready(cell), send(word, cell?) }, local(nx, nz) -> [x, z]
 * (a native point in the scene), native(x, z) -> [nx, nz], ground(x, z), feet(), eye(), level(), renderer?, getTexture?,
 * uploadRecordFrame?, audio?, say?(text, s), mid?(text, s), player?(), hurt?(n, el), save?(e, el), takeSpoil?(p), relayNowS?(),
 * chatNotice?(text) } - the last three its rewards' (scenes/dragonRewards.js) 
 * @param {any} deps
 */
export function createDragonHost(deps) {
  const player = deps.player ?? (() => playerEntity);
  const judged = new Set(), cued = new Set(), heardLand = new Set(), meshes = new Map();
  let memW = null, lastIn = { w: null, at: -Infinity }, noticed = null, nearSince = null, roarSlot = null;
  const omens = new Map(), asked = new Map(), askedFrom = new Map(), toldNoneAt = new Map();   // DRAGON-HIDDEN: each watch's seed its cell told (null: none here), when and where I last asked
  const seedOf = (w) => omens.get(w);
  /** DRAGON-CELL: the map pixel I stand on, or null. */
  const pixelHere = () => { const f = deps.feet?.(); if (!f) return null; const n = deps.native(f[0], f[2]); return mapPixelOfWire(n[0], n[1]); };
  /** DRAGON-HIDDEN: an `ask` for each watch about whose landing is past, until it is answered - down whatever room I
   *  stand in. DRAGON-CELL: the relay tells a seed only near its omen's cell, so a seed is asked again once I stand outside
   *  that omen's reach (another omen of the watch may be about me - AUDIT DRAGON-CELL D5), and a null from another pixel,
   *  or from this one after DRAGON_NONE_AGAIN_MS (a room or a pose the relay could not judge yet - D6). */
  function ask(t) {
    const here = pixelHere(), key = here ? here.join(',') : '';
    for (const w of dragonWatchesAbout(t)) {
      const s = omens.get(w), none = toldNoneAt.get(w);
      if (s != null && (!here || dragonToldAt({ w, s }, here[0], here[1]))) continue;
      if (s == null && omens.has(w) && none?.at === key && t - none.t < DRAGON_NONE_AGAIN_MS) continue;
      if (t < dragonQuietAt(w) - DRAGON_LAND_SPAN_MS || t >= dragonAskEnd(w) || t - (asked.get(w) ?? -Infinity) < DRAGON_ASK_RETRY_MS) continue;   // DRAGON-HIDDEN-TIME: from the watch's start, its landing being nobody's to count
      if (deps.online?.send?.({ k: 'ask', w })) { asked.set(w, t); askedFrom.set(w, key); }
    }
    for (const m of [omens, asked, askedFrom, toldNoneAt]) for (const w of m.keys()) if (!dragonWatchesAbout(t).includes(w)) m.delete(w);
  }
  let lastPh = 1, lastMd = DRAGON_MODE.air, saidFell = false, saidGone = false, landed = false;
  let hpSeen = null, hurtAt = -Infinity, roomAt = -Infinity, heardHurt = -Infinity;
  let siteY = null, live = null, foe = null, box = null;
  let queue = [], sentAt = -Infinity;
  const texs = new Map();   // DRAGON7: an archive's texture, asked once - the brass's and the Aetherbright's
  let batch = null, batchArchive = null, pass;
  const _batches = [], _shapes = [], _slots = [];
  let _standIn = null;
  const standIn = () => (_standIn ??= bossStandIn({ mobile: DWARVEN_DRAGON_ID }, dragonName(0), () => { const s = deps.link.state(); return live?.mine ? wordShare(s.hp, s.max) : null; }));
  const lv = () => Math.max(1, Math.floor(deps.level?.() ?? 1));
  /** DRAGON4: its rewards, made the first time a receipt, a stand-up or a frame asks. */
  let _rewards = null;
  const rewards = () => (_rewards ??= createDragonRewards(deps));
  const spell = createSerpentSpell({ player: player(), standIn, land: (_box, d) => hit(d, HIT_KINDS.Spell), cap: () => standInBlowCap(standIn(), lv()) });

  /** A new watch's dragon forgets the last one's: its blows are numbered from one again. */
  function forget(w) {
    memW = w; judged.clear(); cued.clear(); heardLand.clear(); meshes.clear();
    lastPh = 1; lastMd = DRAGON_MODE.air; saidFell = false; saidGone = false; landed = false; hpSeen = null; siteY = null; queue = [];
  }
  /** The site's frame (metres about its native point, x east, z north) and the scene's. */
  const toScene = (sx, sz, x, z) => deps.local(sx + x * DRAGON_NATIVE_PER_M, sz + z * DRAGON_NATIVE_PER_M);
  const toSite = (sx, sz, x, z) => { const n = deps.native(x, z); return [(n[0] - sx) / DRAGON_NATIVE_PER_M, (n[1] - sz) / DRAGON_NATIVE_PER_M]; };
  const scene = (x, z) => toScene(live.site.sx, live.site.sz, x, z);
  /** The land under a scene point: the drawn ground, else the site's, else my feet's. */
  function groundY(x, z) {
    const g = deps.ground(x, z);
    if (Number.isFinite(g)) return g;
    return siteY ?? deps.feet?.()?.[1] ?? 0;
  }
  function play(cue, p) {
    const a = deps.audio;
    if (!cue || !a || !p) return;
    try { a.play3d?.(cue.clip, p, cue.volume, { maxDistance: cue.reach, distanceModel: 'linear', pitch: cue.pitch }); } catch { /* a sound is never the fight */ }
  }
  /** A blow on me landed: its share of my health, through my saving throw against its element. */
  function landOnMe(B) {
    const e = player();
    if (!e || !(e.health > 0)) return;
    const raw = strikeDamage(B.p, e.maxHealth ?? 1, 0), w = SAVES[B.el];
    const n = w ? savedShare(raw, deps.save ? deps.save(e, B.el) : savingThrow(w[0], w[1], e)) : raw;
    if (!(n > 0)) return;
    if (deps.hurt) { deps.hurt(n, B.el); return; }
    hurtPlayer(e, n);
    flashPlayerDamage(n);
    playPlayerVoice(deps.audio, playerPainVoice(e, n));
    surfacePlayer();
  }
  /** One of my blows on it, queued for the cell (one word each, DRAGON_HIT_GAP_MS apart). */
  function hit(d, r) {
    const s = deps.link.state();
    if (!live?.mine || s.fell || s.gone || !(d > 0) || live.t < s.sh) return false;
    if (queue.length < DRAGON_HITS_QUEUED) queue.push({ d: Math.min(5000, Math.round(d * 100) / 100), r });
    hurtAt = live.t;
    return true;
  }
  function flush(t) {
    if (!queue.length || t - sentAt < DRAGON_HIT_GAP_MS) return;
    const cell = cellRoomOfWire(live.site.sx, live.site.sz);
    if (deps.online?.send?.({ k: 'hit', ...queue[0] }, cell)) { queue.shift(); sentAt = t; }
  }
  /** The `in`: within DRAGON_ADMIT_R while it is there to fight or to lie, again every so often. */
  function sayIn(d, s, t, far) {
    if (far > DRAGON_ADMIT_R || t >= d.leaveAt + DRAGON_REMAINS_MS) return;
    const heard = s.w === d.w;
    if (heard && (s.fell || s.gone)) return;
    if (lastIn.w === d.w && t - lastIn.at < (heard || t >= d.leaveAt ? DRAGON_IN_RESEND_MS : DRAGON_IN_RETRY_MS)) return;   // past its leaving, an `in` only asks whether it lies here
    const cell = cellRoomOfWire(live.site.sx, live.site.sz);
    if (!deps.online?.ready?.(cell)) return;
    if (deps.online.send({ k: 'in', w: d.w, bv: DRAGON_BRAIN_V, lv: lv(), sx: live.site.sx, sz: live.site.sz }, cell)) lastIn = { w: d.w, at: t };
  }
  /** The words said of its turns, each once; its hurt heard. */
  function tellings(s, t, at) {
    const name = dragonName(s.b);
    if (s.ph > lastPh) { deps.mid?.(s.ph >= 3 ? DRAGON_WORDS.phase3 : DRAGON_WORDS.phase2, 4); play(cueOf('roar'), at); }
    lastPh = Math.max(lastPh, s.ph);
    if (s.md !== lastMd && t >= s.ma && !s.fell) { deps.say?.(s.md === DRAGON_MODE.ground ? DRAGON_WORDS.grounded : DRAGON_WORDS.aloft, 4); lastMd = s.md; }
    if (hpSeen !== null && s.hp < hpSeen) { roomAt = t; if (t - heardHurt >= 700) { heardHurt = t; play(cueOf('hurt'), at); } }
    hpSeen = s.hp;
    if (s.fell && !saidFell) { saidFell = true; if (t - s.fell.at < 5000) { deps.mid?.(DRAGON_WORDS.fell(name), 5); play(cueOf('roar'), at); } }
    if (s.fell && !landed && live.act === 'remains') { landed = true; if (t - s.fell.at < 8000) play({ ...cueOf('fall'), pitch: 0.5, volume: 2 }, at); }
    if (s.gone && !s.fell && !saidGone) { saidGone = true; if (t - s.gone < 5000) deps.say?.(DRAGON_WORDS.gone, 4); }
  }
  /** Its blows: each drawn from its word to its landing, its wind-up and landing heard, judged once on my feet. */
  function blows(s, t, me) {
    const e = player(), alive = !!e && e.health > 0;
    for (const bl of s.blows) {
      const B = DRAGON_BLOWS[bl.a];
      if (!B) continue;
      const c = bl.s?.[0], at = c && c[0] !== 'a' ? scene(c[1], c[2]) : null;
      if (!cued.has(bl.i) && t < bl.at) { cued.add(bl.i); play(cueOf('windup'), live.pos); }
      if (!heardLand.has(bl.i) && t >= bl.at) {
        heardLand.add(bl.i);
        const p = at && t - bl.at <= DRAGON_LATE_MS + 600 ? [at[0], groundY(at[0], at[1]), at[1]] : null;
        play(cueOf('land'), p);
        if (B === DRAGON_BLOW.crash) play({ ...cueOf('fall'), pitch: 0.55, volume: 1.8 }, p);   // the ground's shock under its landing
      }
      if (t >= bl.at - bl.wu && t <= bl.at + DRAGON_LINGER_MS) bl.s.forEach((st, k) => shapeOf(bl, B, st, k, t, me));
      if (judged.has(bl.i) || !me) continue;
      if (!alive) { if (t >= bl.at) judged.add(bl.i); continue; }
      const v = egBlowVerdict(bl, me[0], me[1], t, DRAGON_LATE_MS);
      if (v === 'wait') continue;
      judged.add(bl.i);
      if (v === 'hit') landOnMe(B);
    }
    if (judged.size > 512) { const keep = [...judged].slice(-128); judged.clear(); for (const k of keep) judged.add(k); }
  }
  /** A blow's stamp as the telegraph pass's slot and its draped grid (made once a stamp, again as the land comes in). */
  function shapeOf(bl, B, st, k, t, me) {
    const sh = (_slots[_shapes.length] ??= { kind: 0, origin: [0, 0], yaw: 0, r: 0, halfArc: 0, body: 0, end: [0, 0], halfW: 0, r0: 0, r1: 0, points: [], n: 0, t: 0, flash: 0, alpha: 0, color: COLOR_OF.null, edge: TELEGRAPH_EDGE, court: 0, style: 0, since: 0, span: 1, after: -1, runS: 0, pool: TELEGRAPH_POOL.blow });
    if (!fillStamp(sh, st) || sh.kind === TELEGRAPH_KIND.all) return;
    const from = bl.at - bl.wu;
    sh.t = Math.max(0, Math.min(1, (t - from) / Math.max(1, bl.wu))); sh.flash = t >= bl.at ? 1 : 0;
    sh.alpha = t > bl.at ? Math.max(0, 1 - (t - bl.at) / DRAGON_LINGER_MS) : me && egBlowVerdict(bl, me[0], me[1], bl.at, DRAGON_LATE_MS) === 'hit' ? 1 : 0.85;
    sh.color = COLOR_OF[B.el] ?? COLOR_OF.null; sh.style = STYLE_OF[B.el] ?? TELEGRAPH_STYLE.weight;
    sh.since = Math.max(0, (t - from) / 1000); sh.span = Math.max(0.001, bl.wu / 1000); sh.after = t >= bl.at ? (t - bl.at) / 1000 : -1;
    const key = `${bl.i}:${k}`, o = scene(0, 0);
    let m = meshes.get(key);
    if (!m || m.ox !== o[0] || m.oz !== o[1] || (m.missing && t - m.at > 1000)) {
      const b = drapeBounds(sh);
      if (!b) return;
      const g = drapeGrid(b, (x, z) => deps.ground(o[0] + x, o[1] + z), groundY(o[0], o[1]));
      m = { mesh: g, missing: g.missing, at: t, ox: o[0], oz: o[1] };
      meshes.set(key, m);
      if (meshes.size > 64) meshes.delete(meshes.keys().next().value);
    }
    _shapes.push({ sh, mesh: m.mesh });
  }
  /** The texture an archive's frames upload from, asked once. @param {number} archive */
  function texture(archive) {
    const tex = texs.get(archive);
    if (tex && !(tex instanceof Promise)) return tex.failed ? null : tex;
    if (!tex && deps.getTexture) {
      texs.set(archive, Promise.resolve().then(() => deps.getTexture(archive)).then((x) => { texs.set(archive, x ? { tex: x } : { failed: true }); }, (e) => { texs.set(archive, { failed: true }); console.warn('[dragon] its sprite', e?.message ?? e); }));
    }
    return null;
  }
  /** Its body drawn: the frame its act shows my eye, at its feet and DRAGON_SCALE, in its look's pictures (DRAGON7), washed
   *  for its remains. */
  function draw(act, feet, yaw, look, glint, t) {
    const archive = dragonArchiveOf(look), T = texture(archive), r = deps.renderer;
    if (!T || !r?.createBillboardBatch) return;
    const fr = bossFrame(act, yaw, feet, deps.eye?.() ?? feet, (rec) => T.tex.getFrameCount?.(rec) ?? 1);
    const rkey = `${fr.record}#${fr.frame}`;
    if (!r.textures?.has?.(`${archive}_${rkey}`)) deps.uploadRecordFrame?.(archive, fr.record, fr.frame);
    const sz = mobileBillboardSize(T.tex, fr.record), k = DRAGON_SCALE;
    if (batch && batchArchive !== archive) { r.destroyBillboardBatch?.(batch); batch = null; }   // another watch's dragon, another look
    if (!batch) { batch = r.createBillboardBatch(archive, rkey, { w: sz.w * k, h: sz.h * k }, [[0, 0, 0]]); batch.origin = [0, 0, 0]; batchArchive = archive; }
    setBatchHitFlash(batch, gateHitFlash(hurtAt, roomAt, t));
    setBatchGlint(batch, glint);
    batch.tint = act.act === 'remains' ? REMAINS_WASH : null;
    batch.record = rkey;
    batch.size = { w: (fr.flip ? -sz.w : sz.w) * k, h: sz.h * k };
    if (batch.bounds) batch.bounds[3] = Math.hypot(sz.w, sz.h) * 0.5 * k;
    batch.origin[0] = feet[0]; batch.origin[1] = feet[1]; batch.origin[2] = feet[2];
    _batches.push(batch);
  }
  function putAway() {
    if (batch) { deps.renderer?.destroyBillboardBatch?.(batch); batch = null; }
    _batches.length = 0; _shapes.length = 0; live = null; foe = null; box = null;
  }

  return {
    /** ONE FRAME on the street: the dragon the clock is about, its `in`, its words, its blows, its body. Answers whether a
     *  fight of mine is drawn (its bar's). */
    frame() {
      const t = deps.now();
      _batches.length = 0; _shapes.length = 0; foe = null; box = null; live = null;
      ask(t);
      const d = skyWatchAt(t, seedOf), site = d ? deps.sites.of(d) : null;
      if (!d || !site) { if (batch) putAway(); return false; }
      if (site.w !== memW) forget(site.w);
      const f = deps.feet?.() ?? null;
      const o = toScene(site.sx, site.sz, 0, 0), y0 = deps.ground(o[0], o[1]);
      if (Number.isFinite(y0)) siteY = y0;
      const me = f ? toSite(site.sx, site.sz, f[0], f[2]) : null, far = me ? Math.hypot(me[0], me[1]) : Infinity;
      live = { site, t, mine: false, act: null, pos: null };
      let s = deps.link.state();
      if (s.w === d.w && (far > DRAGON_FAN_R + 600 || (!s.fell && !s.gone && t - s.heardAt > DRAGON_HEARD_MS))) { deps.link.leave(); s = deps.link.state(); }
      sayIn(d, s, t, far);
      const mine = s.w === d.w;
      const end = mine && s.fell ? s.fell.at + DRAGON_REMAINS_MS : mine && s.gone ? s.gone + DRAGON_CLIMB_MS : d.leaveAt + DRAGON_CLIMB_MS;
      if (t >= end) { if (batch) putAway(); return false; }
      const p = (mine ? planAt(s.legs, t) : null) ?? dragonSkyAt(d, t);
      const [x, z] = scene(p.x, p.z), pos = [x, groundY(x, z) + Math.max(0, p.a), z];
      live = { site, t, mine, act: null, pos };
      const blow = mine ? s.blows.filter((q) => t >= q.at - q.wu && t < q.at + 600).sort((a, b) => a.at - b.at)[0] ?? null : null;
      const ahead = mine ? planAt(s.legs, t + 100) : null;
      const moving = mine && s.md === DRAGON_MODE.ground && p.a < 1 && !!ahead && Math.hypot(ahead.x - p.x, ahead.z - p.z) > 0.05;
      const act = dragonAct(mine ? s : null, t, blow, moving, Math.max(hurtAt, roomAt));
      live.act = act.act;
      if (mine) { tellings(s, t, pos); blows(s, t, me); flush(t); }
      // the sighting, once a watch: a dragon in the sky, unslain, within DRAGON_NOTICE_R
      nearSince = f && far <= DRAGON_NOTICE_R && t < d.leaveAt && !(mine && (s.fell || s.gone)) ? nearSince ?? t : null;
      if (nearSince !== null && noticed !== d.w && t - nearSince >= DRAGON_NOTICE_WAIT_MS) { noticed = d.w; deps.mid?.(DRAGON_WORDS.circles(sceneCompassWord(x - f[0], z - f[2]), mine ? s.b : dragonLookOf(d)), 5); }
      const seen = f ? Math.hypot(x - f[0], z - f[2]) : Infinity;
      const slot = Math.floor(t / DRAGON_ROAR_MS);
      if (!(mine && (s.fell || s.gone)) && seen <= DRAGON_ROAR_R && roarSlot !== slot) { roarSlot = slot; play(cueOf('roar'), pos); }
      if (seen <= DRAGON_SIGHT_R) {
        const glint = act.act === 'windup' ? [...(COLOR_OF[DRAGON_BLOWS[blow?.a]?.el] ?? COLOR_OF.null), Math.min(1, 0.4 + (act.k ?? 0) * 0.6)] : mine && t < s.sh ? [1, 0.86, 0.5, 0.45] : null;
        draw(act, pos, p.yw, mine ? s.b : dragonLookOf(d), glint, t);   // DRAGON7: its look in the sky too, before any fight is mine
      }
      // my blows' marks: its body while it fights me, within a shot's reach; grounded, a swing's too
      if (mine && !s.fell && !s.gone && far <= DRAGON_FAN_R) {
        const yw = p.yw, cy = pos[1] + DRAGON_BODY_H / 2 + 1;
        box = { id: DRAGON_TARGET, box: { c: [x, cy, z], ax: [Math.cos(yw), 0, -Math.sin(yw)], ay: [0, 1, 0], az: [Math.sin(yw), 0, Math.cos(yw)], h: [DRAGON_BODY_R + 1.5, DRAGON_BODY_H / 2 + 1, DRAGON_BODY_R + 1.5] }, rig: [], v: [0, 0, 0] };
        if (s.md === DRAGON_MODE.ground && p.a < 1.5) foe = { boss: true, dead: false, entity: standIn(), mobileType: DWARVEN_DRAGON_ID, warded: t < s.sh, ai: { feet: pos, yaw: yw, height: DRAGON_BODY_H, radius: DRAGON_BODY_R, centreOffset: DRAGON_BODY_H / 2, isHostile: true } };
      }
      spell.frame(mine && !s.fell && !s.gone);
      return mine && far <= DRAGON_FAN_R + 600;
    },
    /** The body for the frame's billboard pass. */
    batches: () => _batches,
    /** ITS TELEGRAPHS, draped on the land, after the opaque world (the renderer's own view and fog). */
    drawMarks() {
      if (!_shapes.length || !live || !deps.renderer?.gl) return false;
      if (pass === undefined) { try { pass = new DragonTelegraphPass(deps.renderer.gl); } catch (e) { pass = null; console.warn('[dragon] the telegraph would not build', e?.message ?? e); } }
      if (!pass) return false;
      const o = scene(0, 0);
      return pass.draw(_shapes, deps.renderer, [o[0], 0, o[1]]);
    },
    /** ITS BODY AS A SHAFT'S AND A MISSILE'S MARK (combat/arrowFlight.js boxTargets, scenes/hostMagic.js boxMarks), with
     *  the others' (`others` - the serpent's hide): [] for none. */
    boxes: (others = null) => (box ? [...(others ?? []), box] : others),
    /** A SHAFT OF MINE that met `target`: true when it was the dragon's (its damage counted on its stand-in and queued). */
    arrow(m, target) {
      if (target?.id !== DRAGON_TARGET) return false;
      const e = standIn(), dmg = shaftOnRelayBody(m, e, calculateAttackDamage(player(), e, { weapon: m.weapon ?? null, rolls: Math.random }));
      if (dmg > 0) hit(dmg, HIT_KINDS.Shaft);
      return true;
    },
    /** A HARMFUL MISSILE OF MINE on `q`: the dragon's door when it is the dragon's, else null. */
    cast: (sp, q, caster) => (q?.id === DRAGON_TARGET ? spell.cast(sp, q, caster) : null),
    /** A SWING OF MINE (the weapon's own law, playerWeapon.resolveHit, against its stand-in) while it stands grounded within
     *  reach: true when it connected. */
    swing(playerWeapon, eye, lookDir, inView = null) {
      if (!foe || !playerWeapon?.resolveHit) return false;
      const canSee = (b) => { const { point, dist } = bossReach(eye, b.ai); return { dist, inView: inView ? inView(point) : true, losClear: true }; };
      let any = false;
      for (const { damage } of playerWeapon.resolveHit([foe], player(), canSee, Math.random, () => 0, null, null)) {
        any = true;
        if (damage > 0 && hit(damage, HIT_KINDS.Melee)) play({ clip: hitSoundFor(playerWeapon.strikingWeapon), pitch: 1, volume: ENEMY_HIT_VOLUME, reach: 24 }, foe.ai.feet);
      }
      return any;
    },
    /** Whether it is an enemy nearby: its fight unslain within DRAGON_ENGAGE_R of me. */
    near() {
      const s = deps.link.state(), f = deps.feet?.();
      if (!live?.mine || !live.pos || !f || s.fell || s.gone) return false;
      return Math.hypot(live.pos[0] - f[0], live.pos[2] - f[2]) <= DRAGON_ENGAGE_R;
    },
    /** THE BAR's model (ui/dragonBar.js dragonBarModel reads it), or null with no fight of mine. */
    bar() {
      const s = deps.link.state();
      if (!live?.mine) return null;
      const t = live.t, bl = s.blows.filter((q) => t >= q.at - q.wu && t <= q.at + 400).sort((a, b) => a.at - b.at)[0], B = bl ? DRAGON_BLOWS[bl.a] : null;
      const f = deps.feet?.(), me = f ? toSite(live.site.sx, live.site.sz, f[0], f[2]) : null;
      const atk = B ? { key: B.key, name: DRAGON_BLOW_NAMES[B.key], el: B.el, t: Math.max(0, Math.min(1, (t - (bl.at - bl.wu)) / Math.max(1, bl.wu))), aimed: !!me && egBlowVerdict(bl, me[0], me[1], bl.at, DRAGON_LATE_MS) === 'hit' } : null;
      const grounded = s.md === DRAGON_MODE.ground && t >= s.ma;
      return { b: s.b, name: dragonName(s.b), title: dragonTitle(), hp: s.hp, max: s.max, phase: s.ph, fighters: s.n, warded: t < s.sh, grounded, groundLeft: grounded ? Math.max(0, s.mu - t) : 0,
        atk, fell: s.fell, gone: s.gone, leaveIn: s.fell || s.gone ? Infinity : Math.max(0, s.lv - t), now: t };
    },
    /** THE CELL'S REFUSAL (the link's, once until the fight is left) said in the player's language - never its `gone` past
     *  the leaving, the answer to an `in` that asked only whether its remains lie there. */
    refused(code) {
      const d = live ? skyWatchAt(live.t, seedOf) : null;
      if (code === 'gone' && d && live.t >= d.leaveAt) return;
      const text = DRAGON_NO_TEXT[code];
      if (text) deps.mid?.(text, 5);
    },
    /** OFF THE STREET or offline: the body put away; `offline` the fight forgotten too. */
    leave(offline = false) { putAway(); if (offline) { deps.link.leave(); queue = []; } },
    /** DRAGON4: the receipts kept, offered again in their time - every online frame, in any mode. */
    tick() { if (deps.takeSpoil) { try { rewards().tick(); } catch (e) { console.warn('[dragon] claims', e?.message ?? e); } } },
    /** DRAGON4: a receipt the relay handed me (the cell at the kill, the hub at a hello) - carried to the account service. */
    receipt: (r) => rewards().receipt(r),
    /** DRAGON4: the hoard's crash door at a character's stand-up, and the realm save's two hooks. */
    recoverSpoils: (who, inSave = null) => rewards().recover(who, inSave),
    spoilsHeld: (who) => rewards().held(who),
    spoilsSaved: (who, ids) => rewards().saved(who, ids),
    /** DRAGON4: the tames the service drew, not yet bound. */
    tames: () => rewards().tames(),
    /** The site this frame's dragon is of (`{w, sx, sz}`), or null - the link folds its words alone. */
    site: () => live?.site ?? null,
    /** DRAGON-HIDDEN: a watch's omen as its cell told it (`s` null: none near me - DRAGON-CELL - or no dragon at this relay).
     *  @param {{w: number, s: number|null}} o */
    omen(o) { omens.set(o.w, o.s); if (o.s == null) toldNoneAt.set(o.w, { at: askedFrom.get(o.w) ?? '', t: deps.now() }); else toldNoneAt.delete(o.w); },   // AUDIT DRAGON-CELL D6: the pixel it was asked from
    /** Test seams. */
    _queue: () => queue,
    _live: () => live,
  };
}

/**
 * AUDIT DRAGON (HOST-SPLIT: bootWorld kept the dragon's frame, its away and its bar's state): THE WORLD'S DRAGON, MADE
 * WHOLE - its sites over the gate's scans, the cell's link and its host, its online frame and its away, so the world
 * host wires it and holds none of it. `bayScan`/`theatres` the gate's; `street()` on the street with a character up;
 * `barBlocked()` another boss's bar up (the serpent's); `barHidden()`; `drawBar(model, opts)` the gate's bar; `makeHost` the tests'.
 * @param {any} deps createDragonHost's, and those
 */
export function createDragonSky({ bayScan, theatres, street, barBlocked = () => false, barHidden = () => false, drawBar, makeHost = createDragonHost, ...deps }) {
  const sites = createDragonSites({ bayScan, theatres });
  /** @type {any} */
  let host = null;
  const link = createDragonLink({ now: deps.now, say: (code) => host?.refused(code), site: () => host?.site() ?? null, onReceipt: (r) => host?.receipt(r) });
  host = makeHost({ ...deps, link, sites });
  const keep = createDragonKeep({ ...deps, street });   // DRAGON5b; at its ridden size, not DRAGON_SCALE
  const bossBatches = host.batches, _all = [];
  let barUp = false;
  return Object.assign(host, {
    /** The boss's body and the tamed dragons' (mine waiting, and the others'), for the flats' axis. */
    batches() { _all.length = 0; _all.push(...bossBatches(), ...keep.batches()); return _all; },
    /** DRAGON5b: the keep's seams - my word on the foes frame, the others' in, its box, its plaque, its press. */
    keepWord: keep.word, keepPeer: keep.peer, keepPeersClear: keep.clearPeers, keepTargets: keep.targets, keepHoverName: keep.hoverName, keepActivate: keep.activate,
    /** A word of its cell's (or my receipt from the hub). @param {any} w */
    word: (w) => (w?.k === 'omen' ? host.omen(w) : link.word(w)),   // DRAGON-HIDDEN: a watch's omen is the host's, never the fight's
    /** The online frame's (after the serpent's): on the street, to the dead too, its sky, its fight and its bar. */
    onlineFrame() {
      host.tick();   // DRAGON4: its receipts offered in their time, in any mode
      keep.tick();   // DRAGON5b: the mount and the dismount seen
      let fight = false;
      try { fight = street() ? host.frame() : (host.leave(), false); } catch (e) { console.warn('[dragon] frame', e?.message ?? e); }
      const bar = fight ? dragonBarModel(host.bar()) : null;
      if ((bar || barUp) && !barBlocked()) { drawBar(bar, { hidden: barHidden() }); barUp = !!bar; }
    },
    /** No online frame: its bar put away; offline, its fight forgotten. @param {boolean} [offline] */
    away(offline) { if (barUp) { drawBar(null); barUp = false; } host.leave(offline); },
    barUp: () => barUp,
  });
}
