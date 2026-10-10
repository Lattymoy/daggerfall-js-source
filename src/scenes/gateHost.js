// @ts-check
// WB11c (2026-10-01 - Mac, offered adds in three kinds: "1. All three 2. Your choice 3. Your choice 4. Trial rotation"):
// HIS HOST IN THE COURT, ON THIS SCREEN - the Legion-Lord's Harriers, Sappers and Ward-Bearers where the relay says they
// stand, doing what it says they do: each one's own sprite at its own size, rising out of the fire, walking, winding up
// and landing its blow, flinching, falling; each blow's disc on the floor; a Sapper's path to him and a Ward-Bearer's
// tether while it holds his ward; each blow judged against MY OWN FEET at its landing (co-op's law - the relay never
// learns who it struck) and landed through the court's own door; the words and the sounds of it. Design:
// bible/11-Multiplayer/World-Bosses.md section 17.
//
// ONE SOURCE: the court's state (net/gateLink.js - the relay's words folded, its `lg`). Nothing here is sent but a blow
// of mine on one of them (`hit` - the wire's `ahit`, the relay's caps deciding what lands). The court's driver
// (scenes/gateCourt.js) runs this each frame and hands its bodies, lights and shapes on with its own.
//
// THE PARTS, pure where they can be: who each one is and what it is doing (world/gateBoss.js hostLookOf, hostAct,
// hostFallAct, hostCue), where it stands (net/gateBrain.js hostAt), its blow's verdict and clock (net/gateStrike.js
// hostVerdict, hostTelegraphAt), the shapes (`hostShapes`). This file holds the sprites' textures and batches and what it
// has already cued, judged and said.
//
// Not a DFU member. Ledger A (WB11).
import { HOST, HOST_KINDS, HOST_BLOWS, COURT_CENTRE, ATTACKS, hostAt, hostBlowUnder, nearestCourt } from '../net/gateBrain.js';
import { hostVerdict, hostTelegraphAt } from '../net/gateStrike.js';
import { hostLookOf, hostAct, hostFallAct, hostStandIn, hostCue, bossFrame, bossPlace, HOST_BITE_COLOR, hostPulseColor, emberColor, WARD_COLOR, BOSS_CUES, gateHitFlash } from '../world/gateBoss.js';
import { setBatchHitFlash } from '../systems/hitFlash.js';   // WB13d: a body of his host struck flashes, as he does
import { courtToDungeon } from '../world/gateArena.js';
import { TELEGRAPH_KIND, TELEGRAPH_STYLE, TELEGRAPH_FLASH_MS, TELEGRAPH_EDGE, TELEGRAPH_POOL } from '../render/gateTelegraph.js';
import { ENEMY_BASICS } from '../characters/enemyBasics.js';
import { mobileBillboardSize } from '../world/rmbFlats.js';
import { creatureLook } from '../characters/creatureBodies.js'; import { rosterActor } from '../characters/rosterBodies.js';   // MWNPC10: his host in its Morrowind bodies

/** The words his host says that the bar and the blows do not. `boss` his name, `plural`/`name` the body's (its look's). */
const an = (name) => `${/^[AEIOU]/i.test(name) ? 'An' : 'A'} ${name}`;
export const COURT_HOST_TEXT = Object.freeze({
  harriers: (boss, plural) => `${plural} rise from the fire!`,   // WB13b: the event and the order, no more
  sappers: (boss, plural) => `Stop the ${plural} before they reach him!`,
  bearers: () => 'Ward-Bearers hold his ward. Break them!',
  drunk: (boss, name) => `${an(name)} reaches ${boss} and heals him.`,
  // AUDIT WB11 D1: "his ward breaks" was said where his own ward follows the bearers' for its breath (SHIELD_MS,
  // Unyielding's 6 s - the signature is cast under it): every blow in it still turned
  felled: (who, left) => (left > 0 ? `${who || 'A challenger'} cuts down a Ward-Bearer. ${left} ${left === 1 ? 'stands' : 'stand'}.` : 'The last Ward-Bearer falls. His ward is failing!'),
  crumbled: 'The Ward-Bearers crumble. His ward is failing!',
});
/** A rising, a blow, a fall or a word heard later than this after it happened is neither said nor sounded (the court's
 *  FED_LATE_MS law - heard live, never a stale one). */
export const HOST_LATE_MS = 2000;
/** The most of his host's shapes drawn a frame - each is a pass over a whole court's floor: the blows first, then the
 *  tethers, then the Sappers' paths. */
export const HOST_SHAPES_MAX = 8;
/** A Sapper's path to him and a Ward-Bearer's tether: how wide, and how faint (they are where, not what lands). */
export const HOST_PATH_HALF_W = 0.35;
export const HOST_PATH_ALPHA = 0.22;
export const HOST_TETHER_ALPHA = 0.4;
/** A Ward-Bearer holding his ward glows in the ward's gold - its reach (m), its height, its strength. */
export const HOST_LIGHT_RANGE = 6;
export const HOST_LIGHT_Y = 1.5;
/** A hurt is heard no closer together than this, a body. */
export const HOST_HURT_GAP_MS = 500;
/** AUDIT WB11 C6: the clock a path and a tether seethe by (the pass's pool throb, 1.5 a second) - the page's clock in
 *  seconds overflowed a float's precision (the epoch: it moved every 128 s and never throbbed). A whole number of throbs,
 *  so its wrap is unseen. */
export const HOST_LANE_CLOCK_MS = 60_000;
/** AUDIT WB11 C8: the shapes' slots, one array of them a list the court refills (AUDIT WB D10's law: refilled, never made). */
const SHAPE_SLOTS = new WeakMap();

/**
 * THE SHAPES OF HIS HOST on the floor at `now`, in the telegraph pass's own shape (render/gateTelegraph.js - the court's
 * frame): each blow in flight its disc, wound up as his are (the line whole from the word, the fill, the flash at its
 * landing - WB13a: in the same danger edge as his); while his ward holds, each Ward-Bearer's tether to him in the ward's
 * gold; each Sapper's path to him in his ember - WB13a: dashes flowing to him (they were drawn as burning ground). Blows
 * first, at most HOST_SHAPES_MAX. Pure.
 * @param {any} s the court's state (net/gateLink.js) @param {number} now @param {any} P the fight's profile
 * @param {any[]} [out] refilled
 */
export function hostShapes(s, now, P, out = []) {
  out.length = 0;
  const ads = s?.lg?.ads;
  if (!ads?.length || s.fell || s.wrath != null) return out;
  let slots = SHAPE_SLOTS.get(out);
  if (!slots) SHAPE_SLOTS.set(out, (slots = []));
  /** the next shape, its slot refilled whole (AUDIT WB11 C8: a new object and four arrays a shape a frame) */
  const next = () => {
    const sh = (slots[out.length] ??= { kind: 0, origin: [0, 0], yaw: 0, r: 0, halfArc: 0, body: 0, end: [0, 0], halfW: 0, r0: 0, r1: 0, points: [], n: 0,
      t: 0, flash: 0, alpha: 0, color: HOST_BITE_COLOR, edge: TELEGRAPH_EDGE, court: 0, style: 0, since: 0, span: 1, after: -1, runS: 0, pool: TELEGRAPH_POOL.blow });
    out.push(sh);
    return sh;
  };
  const [bx, bz] = bossPlace(s, now);
  for (const a of ads) {
    if (out.length >= HOST_SHAPES_MAX) break;
    const B = HOST_BLOWS[a.k], tel = a.atk && B ? hostTelegraphAt(a.atk, a.k, now) : null;
    if (!tel || tel.since >= Math.max(B.active, 1) + TELEGRAPH_FLASH_MS) continue;
    const start = a.atk.at - B.windup, span = Math.max(B.active, 1);
    const fadeOut = tel.since > span ? 1 - (tel.since - span) / TELEGRAPH_FLASH_MS : 1;
    const pulse = a.k === HOST.bearer, el = hostBlowUnder(a.k, P).el, sh = next();
    sh.kind = TELEGRAPH_KIND.disc; sh.origin[0] = sh.end[0] = a.atk.x; sh.origin[1] = sh.end[1] = a.atk.z; sh.r = B.r; sh.halfW = 0;
    sh.t = tel.t; sh.flash = tel.since >= 0 ? 1 : 0; sh.alpha = Math.max(0, fadeOut); sh.color = pulse ? hostPulseColor(P) : HOST_BITE_COLOR; sh.edge = TELEGRAPH_EDGE;
    sh.court = nearestCourt(a.atk.x, a.atk.z); sh.style = pulse ? TELEGRAPH_STYLE[el] ?? TELEGRAPH_STYLE.weight : TELEGRAPH_STYLE.weight;
    sh.since = Math.max(0, (now - start) / 1000); sh.span = B.windup / 1000; sh.after = tel.since >= 0 ? tel.since / 1000 : -1; sh.runS = 0; sh.pool = TELEGRAPH_POOL.blow;
  }
  const seethe = (now % HOST_LANE_CLOCK_MS) / 1000;   // AUDIT WB11 C6
  const lane = (a, color, alpha) => {
    const [x, z] = hostAt(a, now), sh = next();
    sh.kind = TELEGRAPH_KIND.lane; sh.origin[0] = x; sh.origin[1] = z; sh.end[0] = bx; sh.end[1] = bz; sh.r = 0; sh.halfW = HOST_PATH_HALF_W;
    sh.t = 1; sh.flash = 0; sh.alpha = alpha; sh.color = color; sh.court = nearestCourt(x, z); sh.style = TELEGRAPH_STYLE.weight;
    sh.since = seethe; sh.span = 1; sh.after = -1; sh.runS = 0; sh.pool = TELEGRAPH_POOL.path;
  };
  if (now < s.shieldUntil) for (const a of ads) { if (out.length >= HOST_SHAPES_MAX) break; if (a.k === HOST.bearer) lane(a, WARD_COLOR, HOST_TETHER_ALPHA); }
  for (const a of ads) { if (out.length >= HOST_SHAPES_MAX) break; if (a.k === HOST.sapper && a.mv) lane(a, emberColor(P), HOST_PATH_ALPHA); }
  return out;
}

/**
 * @param {{
 *   renderer?: any, getTexture?: ((archive: number) => Promise<any>)|null, uploadRecordFrame?: ((archive: number, record: number, frame: number) => void)|null,
 *   audio?: any, cam?: () => number[]|null, feet?: () => number[]|null, player?: () => any,
 *   land?: (blow: { pct: number, base: number, el: string|null, name: string }) => void,
 *   say?: (text: string) => void, send?: (hit: { i: number, q: number, d: number, r: number }) => boolean,
 *   blowQ?: (who: string) => number,
 * }} deps
 *   `land` the court's door a blow on me lands through (its share and base of my health, its element through my saving
 *   throw - scenes/gateCourt.js landBlow); `send` a blow of mine on one of them, to the court's room (the wire's `ahit`);
 *   `blowQ` the court's one sequence of my blows (AUDIT WB11 W3 - `a<i>` the body met; alone, a sequence of its own).
 */
export function createGateHost({ renderer = null, getTexture = null, uploadRecordFrame = null, audio = null, cam = () => null, feet = () => null, player = () => null, land = () => {}, say = () => {}, send = () => false, blowQ = null } = {}) {
  /** the fight this driver is on (its day); each body standing by its number - its look, its batch, what it has cued,
   *  landed and judged, the health last seen and when a blow of mine last met it; the gone still falling, by their word */
  let day = null;
  const bodies = new Map(), falling = new Map(), goneSeen = new Set(), wavesSaid = new Set(), crumbleSaid = new Set();
  /** the sprites' textures by archive (the promise while it loads, `{failed}` for one that would not) */
  const textures = new Map();
  /** AUDIT WB D10's law: the frame's lists, refilled, never made (AUDIT WB11 C8: the standing ones' numbers too) */
  const _targets = [], _batches = [], _lights = [], _shapes = [], _live = new Set();
  let blowSeq = 0;
  const seqOf = blowQ ?? (() => ++blowSeq);

  function play(cue, p) {
    if (!cue || !audio || !p) return;
    const opts = { maxDistance: cue.reach, distanceModel: 'linear', pitch: cue.pitch };
    try { if (cue.id != null) audio.play3dId?.(cue.id, p, cue.volume, opts); else audio.play3d?.(cue.clip, p, cue.volume, opts); } catch { /* a sound is never the fight */ }
  }
  /** Where a body stands in the dungeon's frame at `t`, `y` metres up. */
  const placeOf = (a, t, y = 1) => { const [x, z] = hostAt(a, t); return courtToDungeon(x, y, z); };

  function texture(mobile) {
    const archive = ENEMY_BASICS[mobile]?.maleTexture;
    if (!archive || !getTexture) return null;
    const had = textures.get(archive);
    if (had && !(had instanceof Promise)) return had.failed ? null : had;
    if (!had) {
      const p = Promise.resolve().then(() => getTexture(archive)).then(
        (tex) => { textures.set(archive, tex ? { tex, archive } : { failed: true }); if (!tex) console.warn(`[gate] a host sprite (archive ${archive}) would not load`); },
        (e) => { textures.set(archive, { failed: true }); console.warn('[gate] a host sprite', e?.message ?? e); });
      textures.set(archive, p);
    }
    return null;
  }
  function destroyBatch(b) { if (b?.batch) { renderer?.destroyBillboardBatch?.(b.batch); b.batch = null; } }

  /** One body drawn: the frame its act shows to my eye, at its place (an Imp hovering; one rising or crumbling under the
   *  floor by its `sink`), facing `yaw`. WB13d: struck, it flashes - whole for my blow, lightly for the court's. */
  function draw(b, act, x, z, yaw, t) {
    b.act = act.act;   // MWNPC10: what its body plays (offerBodies)
    const T = texture(b.look.mobile);
    if (!T || !renderer?.createBillboardBatch || act.act === 'gone') { b.shown = false; return; }
    const y = (act.sink > 0 ? -act.sink : 0) + (b.look.hover > 0 ? b.look.hover + 0.15 * Math.sin(t / 260 + b.seed) : 0);
    const at = (b.at ??= [0, 0, 0]);   // one a body, refilled (AUDIT WB D10's law)
    at[0] = COURT_CENTRE[0] + x; at[1] = COURT_CENTRE[1] + y; at[2] = COURT_CENTRE[2] + z;
    const eye = cam() ?? at;
    const fr = bossFrame(act, yaw, at, eye, (rec) => T.tex.getFrameCount?.(rec) ?? 1);
    const rkey = `${fr.record}#${fr.frame}`;
    if (!renderer.textures?.has?.(`${T.archive}_${rkey}`)) uploadRecordFrame?.(T.archive, fr.record, fr.frame);
    const sz = mobileBillboardSize(T.tex, fr.record);
    const size = { w: fr.flip ? -sz.w : sz.w, h: sz.h };
    if (!b.batch) { b.batch = renderer.createBillboardBatch(T.archive, rkey, { w: sz.w, h: sz.h }, [[0, 0, 0]]); b.batch.origin = [0, 0, 0]; }
    b.shown = true;
    setBatchHitFlash(b.batch, gateHitFlash(b.hurtAt, b.courtAt ?? -Infinity, t));
    b.batch.record = rkey;
    b.batch.size = size;
    if (b.batch.bounds) b.batch.bounds[3] = Math.hypot(sz.w, sz.h) * 0.5;
    b.batch.origin[0] = at[0]; b.batch.origin[1] = at[1]; b.batch.origin[2] = at[2];
  }

  function clear() {
    for (const b of bodies.values()) destroyBatch(b);
    for (const b of falling.values()) destroyBatch(b);
    bodies.clear(); falling.clear(); goneSeen.clear(); wavesSaid.clear(); crumbleSaid.clear();
    _targets.length = 0; _batches.length = 0; _lights.length = 0; _shapes.length = 0;
  }

  return {
    /**
     * One frame of his host: each one standing heard rising, its blow cued at its word, judged against my feet at its
     * landing and heard landing, its hurt heard, its body drawn; each one newly gone played out (its fall, its words);
     * a wave's rising said once; the targets my blows meet, the lights and the shapes refilled.
     * @param {any} s the court's state @param {number} t the relay's clock @param {any} P the fight's profile @param {string} boss his name
     */
    frame(s, t, P, boss) {
      if (!s || s.day === null || !s.lg) { if (day !== null || bodies.size || falling.size) { clear(); day = null; } return; }
      if (s.day !== day) { clear(); day = s.day; }
      _targets.length = 0; _batches.length = 0; _lights.length = 0;
      const f = feet(), me = player(), standing = !!f && !!me && me.health > 0 && !s.fell && s.wrath == null;
      const live = _live;
      live.clear();
      for (const a of s.lg.ads) {
        live.add(a.i);
        let b = bodies.get(a.i);
        if (!b) {
          b = { i: a.i, look: hostLookOf(a.k, P.aspect.id), batch: null, shown: false, hurtAt: -Infinity, courtAt: -Infinity, heardHurt: -Infinity, hp: a.h, wound: NaN, landed: NaN, judged: NaN, seed: (a.i * 0.6180339) % 1 * 6.283 };
          bodies.set(a.i, b);
          // its rising heard out of the fire, and its wave said once - while it is news
          if (Number.isFinite(a.rose) && t - a.rose <= HOST_LATE_MS && !s.fell && s.wrath == null) {
            play(hostCue('rise', b.look.mobile), placeOf(a, t));
            const wave = `${a.k}@${a.rose}`;
            if (!wavesSaid.has(wave)) {
              wavesSaid.add(wave);
              say(a.k === HOST.harrier ? COURT_HOST_TEXT.harriers(boss, b.look.plural) : a.k === HOST.sapper ? COURT_HOST_TEXT.sappers(boss, b.look.plural) : COURT_HOST_TEXT.bearers());
            }
          }
        }
        if (a.h < b.hp && t - b.heardHurt >= HOST_HURT_GAP_MS) { b.heardHurt = t; play(hostCue('hurt', b.look.mobile), placeOf(a, t, 1.2)); }
        if (a.h < b.hp) b.courtAt = t;   // WB13d: the court's blow on it, seen
        b.hp = a.h;
        // its blow: cued at its word, heard landing, judged against my feet at its landing (co-op's law)
        if (a.atk) {
          const at = a.atk.at, p = () => courtToDungeon(a.atk.x, 1, a.atk.z);   // AUDIT WB11 C8: its place only when heard
          if (b.wound !== at) { b.wound = at; if (t < at && at - t <= HOST_BLOWS[a.k].windup + HOST_LATE_MS) play(hostCue('windup', b.look.mobile), p()); }
          if (b.landed !== at && t >= at) { b.landed = at; if (t - at <= HOST_LATE_MS) play(hostCue('land', b.look.mobile), p()); }
          if (b.judged !== at && standing) {
            const v = hostVerdict(a.atk, a.k, f[0] - COURT_CENTRE[0], f[2] - COURT_CENTRE[2], t);
            if (v !== 'wait') { b.judged = at; if (v === 'hit') land(hostBlowUnder(a.k, P)); }
          }
        }
        const [x, z] = hostAt(a, t);
        const yaw = a.k === HOST.bearer && t < s.shieldUntil ? (() => { const [bx, bz] = bossPlace(s, t); return Math.atan2(bx - x, bz - z); })() : a.yaw;
        const act = hostAct(a, t, b.look, b.hurtAt);
        b.yaw = yaw;   // AUDIT WB11 C2: its facing kept for its fall
        draw(b, act, x, z, yaw, t);
        if (b.shown && b.batch) _batches.push(b.batch);
        // the body my blows meet - its feet in the dungeon's frame, its own body (the relay measures a blow to the same);
        // one a body, its feet refilled, its stand-in its own (AUDIT WB11 W1: naming it - a Cast When Strikes spell on it
        // is this body's)
        const T = (b.target ??= { i: a.i, feet: [0, 0, 0], height: HOST_KINDS[a.k].h, radius: HOST_KINDS[a.k].r, entity: hostStandIn(b.look, a.i), mobile: b.look.mobile, name: b.look.name, m: a.m });
        // AUDIT WB11 W4: where it is DRAWN - one still rising out of the stone is met only above the floor (its whole body
        // stood offered from its first moment, a shaft stopped by nothing seen)
        T.feet[0] = COURT_CENTRE[0] + x; T.feet[1] = COURT_CENTRE[1] + b.look.hover - act.sink; T.feet[2] = COURT_CENTRE[2] + z;
        _targets.push(T);
        // a Ward-Bearer holding his ward glows in its gold
        if (a.k === HOST.bearer && t < s.shieldUntil) {
          const L = (b.light ??= { x: 0, y: 0, z: 0, range: HOST_LIGHT_RANGE, color: [0, 0, 0] });
          const k = 0.8 + 0.25 * Math.sin(t / 180 + b.seed);
          L.x = COURT_CENTRE[0] + x; L.y = COURT_CENTRE[1] + HOST_LIGHT_Y; L.z = COURT_CENTRE[2] + z;
          L.color[0] = WARD_COLOR[0] * k; L.color[1] = WARD_COLOR[1] * k; L.color[2] = WARD_COLOR[2] * k;
          _lights.push(L);
        }
      }
      // THE GONE, each once: its body handed to its fall (a Sapper he drank goes into him at once), its sound and words
      // while it is news - a Sapper drunk, a Ward-Bearer cut down (by name, and how many stand), his Ward-Bearers crumbled
      // AUDIT WB11 C3: how many stand counted down as each falls - from those standing and this frame's own cut down, so
      // two cut down between two of my frames are said 2 and 1, never the count after both twice
      let bearersLeft = 0;
      for (const a of s.lg.ads) if (a.k === HOST.bearer) bearersLeft++;
      for (const g of s.lg.gone) if (g.k === HOST.bearer && g.w === 0 && !goneSeen.has(`${g.i}@${g.at}`)) bearersLeft++;
      // AUDIT WB11 C4: as the Wrath gathers his host crumbles, and his ward does not break - nothing said of it then
      const wrathGathers = s.atk?.a === ATTACKS.wrath.id;
      for (const g of s.lg.gone) {
        const key = `${g.i}@${g.at}`;
        if (goneSeen.has(key)) continue;
        goneSeen.add(key);
        if (g.k === HOST.bearer && g.w === 0) bearersLeft--;
        const b = bodies.get(g.i) ?? { i: g.i, look: hostLookOf(g.k, P.aspect.id), batch: null, shown: false, seed: 0 };   // AUDIT MW-NPC II H4: its number - two first seen falling were one body (`host:undefined`)
        bodies.delete(g.i);
        if (g.w === 1) destroyBatch(b);
        else falling.set(key, { ...b, g });
        const fresh = t - g.at <= HOST_LATE_MS, p = courtToDungeon(g.x, 1, g.z);
        if (!fresh) continue;
        if (g.w === 1) {
          play(hostCue('drunk', b.look.mobile), p);
          const [bx, bz] = bossPlace(s, t);
          play(BOSS_CUES.growl, courtToDungeon(bx, 2.5, bz));
          say(COURT_HOST_TEXT.drunk(boss, b.look.name));
        } else {
          play(hostCue('fall', b.look.mobile), p);
          if (g.k === HOST.bearer && g.w === 0) say(COURT_HOST_TEXT.felled(g.n, bearersLeft));
          else if (g.k === HOST.bearer && g.w === 2 && !s.fell && s.wrath == null && !wrathGathers && !crumbleSaid.has(g.at)) { crumbleSaid.add(g.at); say(COURT_HOST_TEXT.crumbled); }
        }
      }
      // the bodies no longer standing nor falling are put away
      for (const [i, b] of bodies) if (!live.has(i)) { destroyBatch(b); bodies.delete(i); }
      for (const [key, b] of falling) {
        const act = hostFallAct(b.g, t, b.look);
        if (act.act === 'gone') { destroyBatch(b); falling.delete(key); continue; }
        draw(b, act, b.g.x, b.g.z, b.yaw ?? 0, t);   // AUDIT WB11 C2: falling as it last faced (it turned to +z)
        if (b.shown && b.batch) _batches.push(b.batch);
      }
      hostShapes(s, t, P, _shapes);
    },
    /** His host as bodies my blows meet - one list, refilled each frame (read, never written). */
    targets: () => _targets,
    /** Their bodies for the host's billboard pass, their lights, their shapes on the floor. */
    batches: () => _batches,
    /**
     * MWNPC10 (bible/04-Characters/Morrowind-NPCs.md section 15a): EACH SHOWN BODY OFFERED ITS MORROWIND CREATURE on `lane`
     * (characters/npcBodies.js createPopulationLane) with the billboard it is drawn by - standing (walking, its blow a
     * swing as the relay's attack time changes, a blow on it a recoil) and falling (dead, its fall the death); one its
     * mobile has no match for keeps its sprite.
     */
    offerBodies(lane) {
      const one = (b, dead) => {
        const look = b.shown && b.batch ? creatureLook({ mobileType: b.look.mobile }) : null;
        if (!look) return;   // never offered, so never cast-only - its sprite draws
        lane.offer(rosterActor(b, { id: `host:${b.i}`, look, feet: b.batch.origin, yaw: b.yaw ?? 0, moving: b.act === 'walk',
          swingKey: dead ? null : b.wound, hitKey: dead ? null : Math.max(b.hurtAt ?? -Infinity, b.courtAt ?? -Infinity), dead: dead ? 1 + ((b.i | 0) % 3) : 0 }), b.batch,
        null, b.batch.hitFlash || 0);   // AUDIT MW-NPC II H5: WB13d's flash on the body - the billboard that carries it is cast-only
      };
      for (const b of bodies.values()) one(b, false);
      for (const b of falling.values()) one(b, true);
    },
    lights: () => _lights,
    shapes: () => _shapes,
    /**
     * A BLOW OF MINE MET ONE OF THEM at `t` (the relay's clock) - `i` its number, `d` the formula's number on this machine,
     * `r` its kind. It flinches here at once, and the number goes out as the wire's `ahit` (whole points, my blow's
     * sequence - the court's, AUDIT WB11 W3); the relay's caps decide what lands and say its health back. A blow under one point is none, and one on a
     * body not standing goes nowhere. Answers whether it went.
     */
    hit({ i, d, r } = /** @type {any} */ ({}), t = 0) {
      const b = bodies.get(i);
      const dmg = Math.round(d);
      if (!b || !(dmg >= 1)) return false;
      b.hurtAt = t;
      return !!send({ i, q: seqOf(`a${i}`), d: dmg, r });
    },
    /** What the driver holds, for the tests and the stats. */
    state: () => ({ day, bodies: [...bodies.keys()], falling: [...falling.keys()], shown: _batches.length, targets: _targets.length, shapes: _shapes.length, lights: _lights.length }),
    /** Out of the court: every body put away and the fight forgotten (the textures are kept - the next court wears them). */
    leave() { clear(); day = null; },
  };
}
