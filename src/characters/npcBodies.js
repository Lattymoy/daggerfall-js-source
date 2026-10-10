// @ts-check
// MWNPC4 (2026-10-09, the MW-NPC arc's fourth slice - bible/04-Characters/Morrowind-NPCs.md section 9): THE NPC LANE.
//
// Every living actor the arc stands in a Morrowind body - a foe, the watch, a townsperson, a person in a building - is
// drawn the way an online peer already is (net/peerBodies.js): a `createFpArm()` rig built from a LOOK, posed off a
// POSE, budgeted by the laws PEER-CADENCE, WB9h and MW-CROWD proved on a crowd of players (the view cull and its turn
// lead, the skin budget, the distance cadence, the swap dwell, the spares, the linger, the range), skinned on the GPU
// (MWNPC1) and drawn in the body pass's one bind (MWNPC2). The family and the card table's regulars already ride that
// lane as synthetic peers (world/familyBodies.js); this is the same door for the NPCs, with three differences:
//
//   - THE NPCs' OWN CAPS. One PeerBodies of their own, under the tier the player chose on the Features page
//     (`mwNpcBodies`: Off, Near, All - NPC_BODY_TIERS), so a crowd of townsfolk never takes a body from a player and the
//     peers' eight stand as they stood. A tier change stands a new lane down and up.
//   - THE FALLBACK IS THE ACTOR'S OWN PICTURE. A peer without a body is drawn as a paperdoll or a class sprite; an NPC
//     without one is the classic billboard its host always drew. So the lane draws no doll: a host asks `has(lane, id)`
//     and draws its own billboard for every actor that answers false - an actor out of the cap, past the range, still
//     building, or refused.
//   - THE POSE IS THE ACTOR'S STATE, not a wire. `npcShown` maps what a host knows of an actor - its feet, its facing,
//     walking or running, its weapon drawn, its swings, its casts - onto the pose fields PeerBodies' `_arm` already
//     plays, and the two the wire never sends: `ht`, a hit count (the recoil, character.cpp refreshHitRecoilAnims) and
//     `dd`, the death (playRandomDeath) - see combat/fpArm.js `hurt`/`die`.
//
// The populations' adapters (which actor wears what - MWNPC5 onward) fill the actor; this module never reads a host.
import { PeerBodies, BODY_BUILD_GATE } from '../net/peerBodies.js';
import { getPref } from '../systems/uiPrefs.js';
import { isEnhanced } from '../systems/uiSkin.js';
import { morrowindDataCount, morrowindDataGeneration } from '../scenes/dataSource.js';

/** The lane's caps by the player's tier: the most bodies, the range they stand to (scene metres), the skins a frame,
 *  the spares kept. Off is no lane at all. Near stands the dozen nearest within a street's width; All two dozen across
 *  a square - each a rig at the PEER-CADENCE costs, GPU-skinned, in the one bind. */
export const NPC_BODY_TIERS = Object.freeze({
  off: null,
  near: Object.freeze({ max: 12, range: 30, skinBudget: 4, spareMax: 4 }),
  all: Object.freeze({ max: 24, range: 60, skinBudget: 8, spareMax: 8 }),
});
/** MWNPC6: THE WATCH'S OWN LANE, under the same tier - a third of the foes' bodies and half their skins (a street's
 *  watch is a handful; the bound stays the sum the section states). */
export const WATCH_BODY_TIERS = Object.freeze({
  off: null,
  near: Object.freeze({ max: 4, range: 30, skinBudget: 2, spareMax: 2 }),
  all: Object.freeze({ max: 8, range: 60, skinBudget: 4, spareMax: 4 }),
});
/** The tier a player who never chose stands under. */
export const NPC_BODIES_DEFAULT = 'near';

/** MWNPC11 (bible/04-Characters/Morrowind-NPCs.md section 16): EVERY NPC LANE'S ONE FRAME, by the same tier - the most
 *  bodies standing (stepped, skinned on their cadence, drawn) across every population's lane, nearest first, and the
 *  most skins a frame among them. Below what MWNPC7 stated for the three lanes it summed (the foes', the watch's and the
 *  walkers': 28 bodies and 10 skins at Near, 56 and 20 at All), so no lane wired since adds a body or a skin to a frame -
 *  a port's street in a siege with a party on the road stands what a street of foes, watch and walkers did. */
export const NPC_FRAME_TIERS = Object.freeze({
  off: null,
  near: Object.freeze({ bodies: 24, skins: 8 }),
  all: Object.freeze({ bodies: 48, skins: 16 }),
});
/** MWNPC11: a standing body keeps its place this much past the frame's cut - the cut moves as the crowd does, and a
 *  body on its edge must not stand and fall frame by frame (each fall and stand a skin). */
export const NPC_BUDGET_HYSTERESIS = 1.15;
/** MWNPC11: a lane's report older than this (ms) is a lane no longer drawn - it takes no share of the frame. */
export const NPC_BUDGET_STALE_MS = 250;

/**
 * MWNPC11: THE FRAME BUDGET THE NPC LANES SHARE. Each lane reports, as it syncs, the squared distances of the actors it
 * could stand (its nearest within its own range and cap, sorted - one already holding a body ranked by the hysteresis
 * it is held to, NPC_BUDGET_HYSTERESIS, so the held count among the k); `cut(k)` is the squared distance of the k-th nearest
 * across every lane's last report (Infinity while fewer stand) - each lane then stands its bodies within it, so the
 * frame's bodies are the nearest k whoever's they are; `skins` a lane's share of the frame's skins - one for each lane
 * with a body in the cut, the rest by its share of them, so the frame's sum is the budget's (or one a lane where more
 * lanes than that stand). The lanes sync at their hosts' own points in the frame, so a report is at most a frame old.
 * No allocation a frame: a lane's distances live in its own buffer.
 * @param {{ now?: () => number }} [o]
 */
export function createFrameBudget({ now = () => performance.now() } = {}) {
  /** @type {Map<any, { d2: Float64Array, n: number, at: number, i: number, inCut: number }>} */
  const lanes = new Map();
  /** @type {any[]} */
  const live = [];
  let cutD2 = Infinity;
  const fresh = () => {
    live.length = 0;
    const t = now();
    for (const r of lanes.values()) if (t - r.at <= NPC_BUDGET_STALE_MS && r.n > 0) live.push(r);
  };
  return {
    /** This lane's candidates this frame: `d2` its own buffer, the first `n` sorted ascending. */
    report(lane, d2, n) {
      let r = lanes.get(lane);
      if (!r) lanes.set(lane, (r = { d2, n: 0, at: 0, i: 0, inCut: 0 }));
      r.d2 = d2; r.n = n; r.at = now();
    },
    /** A lane let go. */
    drop(lane) { lanes.delete(lane); },
    /** The squared distance the `k` nearest candidates across the lanes stand within (Infinity: fewer than k). */
    cut(k) {
      fresh();
      for (const r of live) r.i = 0;
      cutD2 = Infinity;
      for (let c = 0; c < k; c++) {
        let best = null;
        for (const r of live) if (r.i < r.n && (!best || r.d2[r.i] < best.d2[best.i])) best = r;
        if (!best) { cutD2 = Infinity; break; }
        cutD2 = best.d2[best.i++];
      }
      return cutD2;
    },
    /** This lane's skins of `skins` under the last cut: one each lane with a body in it, the rest by its share. */
    skins(lane, skins) {
      let lanesIn = 0, total = 0;
      for (const r of live) {
        let c = 0;
        while (c < r.n && r.d2[c] <= cutD2) c++;
        r.inCut = c;
        if (c) { lanesIn++; total += c; }
      }
      const mine = lanes.get(lane)?.inCut ?? 0;
      if (!mine) return 0;
      return 1 + Math.floor((Math.max(0, skins - lanesIn) * mine) / total);
    },
    /** The lanes reporting now (the probe's, a test's). */
    get lanes() { fresh(); return live.length; },
  };
}
/** MWNPC11: the page's one - every host's lane (createHostNpcBodies) shares it. */
export const NPC_FRAME_BUDGET = createFrameBudget();

/** An actor's id among the body layers': its lane and its own id - never a relay id (the wire's ID_RE has no colon)
 *  nor a family member's (`fam:`). */
export const npcPeerId = (lane, id) => `npc:${lane}:${id}`;

const finite = (v) => (Number.isFinite(v) ? v : 0);
const count = (v) => (Number.isFinite(v) ? v | 0 : 0);

/**
 * The pose PeerBodies reads, off an actor's own state:
 *   feet [x,y,z], yaw (radians), moving, running, drawn (weapon out), swings (a count: each new one a blow), strike (the
 *   blow's POSE_STRIKES index), casts (a count: each new one a cast), castRange (the cast's range type - the rig's
 *   castSpell takes it as the wire's `cr`), hits (a count: each new one a recoil),
 *   dead (0 standing, else the death's roll + 1).
 * @param {any} a
 */
export function npcShown(a) {
  return {
    x: finite(a.feet[0]), y: finite(a.feet[1]), z: finite(a.feet[2]),
    yaw: finite(a.yaw), pitch: 0,
    mv: a.moving ? (a.running ? 2 : 1) : 0,
    wd: a.drawn ? 1 : 0,
    an: count(a.swings), as: count(a.strike),
    cn: count(a.casts), cr: count(a.castRange),
    ht: count(a.hits),
    dd: count(a.dead),
  };
}

const sceneOf = (/** @type {any} */ s) => [s.x, s.y, s.z];

/**
 * The lane, stood each frame between `begin` and `end` - `stand` every actor a population offers, `end` syncs the
 * bodies, the body pass `draw`s them, and the host asks `has` before it draws its own billboard.
 * @param {{ renderer: any, enabled?: () => boolean, generation?: () => number, tier?: () => string, createRig?: Function,
 *   now?: () => number, warn?: (m: string) => void, collider?: () => any, tiers?: Record<string, any>,
 *   budget?: ReturnType<typeof createFrameBudget> | null, frameTiers?: Record<string, any> }} p
 */
export function createNpcBodies({ renderer, enabled = () => true, generation = () => 0, tier = () => NPC_BODIES_DEFAULT, createRig, now, warn, collider, tiers = NPC_BODY_TIERS,   // MWNPC5b: `tiers` a table of the caller's (a test's)
  budget = null, frameTiers = NPC_FRAME_TIERS }) {   // MWNPC11: the frame budget the lane shares (null: none - a test's lane alone), and its tiers
  /** @type {PeerBodies|null} */
  let bodies = null;
  let standing = null;   // the tier the lane stands under
  /** @type {any[]} */
  const peers = [];
  // MWNPC5b: what a host knows of an actor beyond its pose, by its lane id - the concealment its billboard would have
  // drawn (ECV1), its hit flash, its tells (characters/foeBodies.js foeFx) and whether it is dead (the living stand
  // first: PeerBodies' priority) - one record an actor, rewritten each frame
  /** @type {Map<string, { conceal: any, flash: number, fx: any, dead: boolean, scale: number, frame: number }>} */
  const info = new Map();
  let frame = 0;
  const seen = (id) => info.get(id);   // read for the actors offered this frame (the sync's) and the bodies standing (the draw's) - a lingering body is not drawn
  const syncOpts = { priority: (id) => !seen(id)?.dead, conceal: (id) => seen(id)?.conceal ?? null };
  const flashOf = (id) => seen(id)?.flash ?? 0;
  const fxOf = (id) => seen(id)?.fx ?? null;
  const scaleOf = (id) => seen(id)?.scale ?? 1;   // MWNPC10: an actor drawn larger than itself (the gate's boss)
  const drawOpts = { proj: null, view: null, eye: null, flashOf, fxOf, scaleOf };
  const lane = () => {
    const t = tier();
    const want = Object.prototype.hasOwnProperty.call(tiers, t) ? t : NPC_BODIES_DEFAULT;   // an unknown tier stands under the default
    if (want !== standing) {
      bodies?.destroy();
      const limits = tiers[want] ?? null;
      bodies = limits ? new PeerBodies({ renderer, enabled, generation, limits: budget ? { ...limits, buildInRange: true, hysteresis: NPC_BUDGET_HYSTERESIS } : limits, gate: BODY_BUILD_GATE, ...(createRig ? { createRig } : {}), ...(now ? { now } : {}), ...(warn ? { warn } : {}), ...(collider ? { collider } : {}) }) : null;
      standing = want;
    }
    return bodies;
  };
  /** MWNPC11: this lane's candidates' squared distances, its own buffer (grown, never a frame's garbage) */
  let d2s = new Float64Array(0);
  /** MWNPC11: share the frame - report the nearest this lane could stand (within its range, to its cap: a sorted
   *  insertion into its own buffer, a held body ranked by its hysteresis), take its range and skins from the cut. */
  const share = (b, eye) => {
    const lim = tiers[standing], ft = frameTiers[standing];
    if (!lim || !ft) return;
    const r2 = lim.range * lim.range, cap = lim.max, h2 = NPC_BUDGET_HYSTERESIS * NPC_BUDGET_HYSTERESIS;
    if (d2s.length < cap) d2s = new Float64Array(cap);
    let n = 0;
    for (const p of peers) {
      const dx = p.shown.x - eye[0], dy = p.shown.y - eye[1], dz = p.shown.z - eye[2];
      // one that holds a body ranks as near as the hysteresis it is held to (its body falls only past range x it), so
      // the cut counts the frame's bodies exactly - the held ones among them
      const d2 = (dx * dx + dy * dy + dz * dz) / (b.holds(p.id) ? h2 : 1);
      if (!(d2 <= r2) || (n === cap && d2 >= d2s[n - 1])) continue;
      let j = n < cap ? n++ : n - 1;
      while (j > 0 && d2s[j - 1] > d2) { d2s[j] = d2s[j - 1]; j--; }
      d2s[j] = d2;
    }
    budget.report(self, d2s, n);
    const cut = budget.cut(ft.bodies);
    // the range a hair past the cut: the body AT it (often the held one whose rank set it) stands, never lost to the
    // root's rounding and back the next frame
    b.setLimits({ range: Math.min(lim.range, Math.sqrt(cut) * (1 + 1e-9)), skinBudget: Math.min(lim.skinBudget, budget.skins(self, ft.skins)) });
  };
  const self = {
    /** A frame begins: nobody stands yet. */
    begin() {
      peers.length = 0;
      frame++;
      if (info.size > 256) for (const [id, r] of info) if (r.frame < frame - 1) info.delete(id);   // the long gone let go (a record an actor offered lately)
    },
    /**
     * One actor offered: `lane` its population ('foe', 'watch', 'folk', ...), `actor` { id, look, feet, yaw, moving,
     * running, drawn, swings, strike, casts, castRange, hits, dead } - and MWNPC10 `scale`, drawn that many times its
     * size about its feet (1 when absent). An actor with no look or no feet is not offered.
     * MWNPC5b: `conceal` the ECV1 visual its billboard would draw concealed (null: plain), `flash` its hit flash, `fx`
     * its tells (the quad's).
     * @param {string} laneName @param {any} actor @param {any} [conceal] @param {number} [flash] @param {any} [fx]
     */
    stand(laneName, actor, conceal = null, flash = 0, fx = null) {
      if (!actor?.look || !actor.feet) return;
      const id = npcPeerId(laneName, actor.id);
      peers.push({ id, name: '', told: true, look: actor.look, shown: npcShown(actor) });
      let r = info.get(id);
      if (!r) info.set(id, (r = { conceal: null, flash: 0, fx: null, dead: false, scale: 1, frame: 0 }));
      r.conceal = conceal; r.flash = flash > 0 ? flash : 0; r.fx = fx; r.dead = !!actor.dead; r.frame = frame;
      r.scale = actor.scale > 0 ? actor.scale : 1;   // MWNPC10
    },
    /** The frame's actors to their bodies - MWNPC11: under the frame's budget, shared with every other lane.
     *  @param {number} dt @param {number[]|null} eye */
    end(dt, eye) {
      const b = lane();
      if (!b) return;
      if (budget && eye) share(b, eye);
      b.sync(peers, sceneOf, dt, eye, syncOpts);
    },
    /** Does this actor stand in a body - so its host draws no billboard for it? @param {string} laneName @param {any} id */
    has(laneName, id) { return !!bodies?.has(npcPeerId(laneName, id)); },
    /** The bodies, in the body pass (inside its batch - renderer.js beginCharacterSpriteBatch). @param {any} canvas @param {any} o */
    draw(canvas, o) {
      if (!bodies) return;
      drawOpts.proj = o.proj; drawOpts.view = o.view; drawOpts.eye = o.eye;
      bodies.draw(canvas, drawOpts);
    },
    /** MWNPC5b: the concealed ones, translucent - after the host's opaque world (PeerBodies drawVeiled). */
    drawVeiled() { bodies?.drawVeiled(); },
    /** The floating origin moved (the peer layers' law, AUDIT ONLINE D5). @param {number[]} o */
    offsetAll(o) { bodies?.offsetAll(o); },
    /** Everything let go (the place left, the lane switched off). */
    destroy() { peers.length = 0; info.clear(); bodies?.destroy(); bodies = null; standing = null; budget?.drop(self); },   // MWNPC11: and its share of the frame
    /** How many actors were offered this frame. */
    get offered() { return peers.length; },
    /** The tier the lane stands under (after the last `end`). */
    get tier() { return standing; },
  };
  return self;
}

/** MWNPC5b: is the lane wanted - the enhanced skin, Morrowind data attached, and the player's tier not Off (the
 *  Features row, `mwNpcBodies`)? A host asks each frame; false, it stands no lane and lets go of the one it had. */
export function npcBodiesOn() {
  return isEnhanced() && morrowindDataCount() > 0 && getPref('mwNpcBodies') !== 'off';
}

/** MWNPC5b: a host's lane - the gate, the data generation and the tier read as every host reads them. */
export function createHostNpcBodies({ renderer, collider = () => null, tiers = NPC_BODY_TIERS }) {   // MWNPC6: `tiers` a population's own caps (WATCH_BODY_TIERS)
  return createNpcBodies({ renderer, enabled: npcBodiesOn, generation: morrowindDataGeneration, tier: () => getPref('mwNpcBodies') ?? NPC_BODIES_DEFAULT, collider, tiers, budget: NPC_FRAME_BUDGET });   // MWNPC11: every host's lane on the one frame
}

/**
 * MWNPC7: A POPULATION'S LANE AT ITS HOST - the shape the foe pools grew (dungeonContext.js, exteriorFoes.js,
 * cityGuards.js) for a host that walks its population inline: the lane made the first frame it is wanted and let go the
 * frame it is not; each actor `offer`ed with the billboard its host would draw for it, that billboard's `castOnly`
 * reset at the offer; `draw` syncs the lane, marks each offered billboard cast-only where its body stands (it casts the
 * shadow the body does not) and draws the bodies in one bind - after the sync, so a body arriving or leaving is never a
 * frame drawn twice or not at all, and nothing if nothing was offered since the last draw.
 * @param {{ laneName: string, renderer: any, collider?: () => any, tiers?: any, want?: () => boolean, make?: (() => any) | null }} p
 */
export function createPopulationLane({ laneName, renderer, collider = () => null, tiers = NPC_BODY_TIERS, want = npcBodiesOn, make = null }) {
  let lane = null;
  let offered = false;
  /** @type {any[]} */
  const ids = [];
  /** @type {any[]} */
  const batches = [];
  return {
    /** A frame begins: true while the lane is wanted (the host then offers its actors). */
    frame() {
      ids.length = 0; batches.length = 0;
      if (!want()) { if (lane) { lane.destroy(); lane = null; } offered = false; return false; }
      lane ??= make ? make() : createHostNpcBodies({ renderer, collider, tiers });
      lane.begin();
      offered = true;
      return true;
    },
    /** One actor, with the billboard its host draws for it (reset to drawn here). @param {any} actor @param {any} batch
     *  @param {any} [conceal] @param {number} [flash] @param {any} [fx] */
    offer(actor, batch, conceal = null, flash = 0, fx = null) {
      if (batch) batch.castOnly = false;
      if (!lane || !offered) return;
      lane.stand(laneName, actor, conceal, flash, fx);
      ids.push(actor.id); batches.push(batch);
    },
    /** Synced, marked, drawn - before the host draws the billboards it offered.
     *  @param {any} canvas @param {Float32Array} proj @param {Float32Array} view @param {number[]} eye @param {number} dt */
    draw(canvas, proj, view, eye, dt) {
      if (!lane || !offered) return;
      offered = false;
      lane.end(dt, eye);
      for (let i = 0; i < ids.length; i++) if (batches[i]) batches[i].castOnly = lane.has(laneName, ids[i]);
      renderer.beginCharacterSpriteBatch?.();
      try { lane.draw(canvas, { proj, view, eye }); } finally { renderer.flushCharacterSpriteBatch?.(); }
    },
    /** The concealed, translucent - after the host's opaque world. */
    drawVeiled() { lane?.drawVeiled(); },
    /** The floating origin moved. @param {number[]} o */
    offsetAll(o) { lane?.offsetAll(o); },
    /** Let go (the place left). */
    destroy() { lane?.destroy(); lane = null; offered = false; ids.length = 0; batches.length = 0; },
    /** Does this actor stand in a body? @param {any} id */
    has(id) { return !!lane?.has(laneName, id); },
  };
}
