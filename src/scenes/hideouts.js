// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LW12 (2026-10-09, bible/06-Systems/Living-World-II.md "LW12"): THE HIDEOUT, STOOD - a band's camp off the road
// (systems/livingWorld/outlaws.js: where, who, which generation) stood live for a player on foot within BAND_LIVE_M of
// it, and the one standing it (the camps' own election online - the road fights' `owner`; offline always):
//  - ITS TENTS (survival/camp.js TENT_MODEL, the camps' own, through the host's meshes) about a FIRE (FIRE_FLAT);
//  - ITS PEOPLE as the encounter pool's foes (exteriorFoes.js spawnFoe - loose, transient: never a save's; managed: this
//    host owns their lives, AUDIT LW-II C3), each in their class at their level and name, about the fire facing out: all
//    of them by day; by night half, the rest out on the road;
//  - ITS CHEST, a ground pile (droppedLoot.js seedPile, unsaved) minted from the band's take (outlaws.js takeOf: the
//    parties it robbed of late, their goods and their share of a purse) - unless the character took from it before
//    (`looted`: it stands empty for them).
// ROUTED: every one of its people stood killed (AUDIT LW-II C3: by blows, never the cull) - the character's tale
// (`routed`, by the hideout and the generation: the hideout stands empty for them BAND_VACANT_DAYS, then the next band
// forms), the towns of its region tell it, and each of the parties it robbed of late regards the player as having
// `helped`. A hideout left (the player past BAND_KEEP_M, or a mode's change) is let go: its living bodies taken out. A
// chest taken from is `looted` the frame it shows (AUDIT LW-II C2). AUDIT LW-II C11b: online the camp - tents, fire,
// chest - is every reader's own; its people the one standing it's.
// AN EMPTY HIDEOUT (the dice's or the character's vacancy) stands its tents and a cold camp: nobody, no chest.
//
// HEARD OF: a traveller passing close warns the player of a band whose hideout lies within HEARD_PX of where they
// stand (the roads' greeting), and the character has HEARD of it (`heard`): its hideout's area is marked on the
// Overworld, "Hideout of the Black Hand (rumoured)" - a ring about a point near it, never the point.
//
// EVERY ALLOCATION HAS AN OWNER: the fire's batch, the bodies and the pile are this host's until it lets them go;
// `clear()` takes out every one.
import { TENT_MODEL, FIRE_FLAT } from '../systems/survival/camp.js';
import { trs } from '../world/mat4.js';
import { NATIVE_PER_M, NATIVE_PIXEL } from '../systems/livingWorld/trips.js';
import { GLOBAL_SCALE } from '../player/activate.js';
import { lwSeed, textSeed } from '../systems/livingWorld/seed.js';
import { DAY_MIN } from '../systems/livingWorld/dayPlan.js';

/** A hideout this near the player on foot (m) is stood; let go past BAND_KEEP_M. */
export const BAND_LIVE_M = 200;
export const BAND_KEEP_M = 280;
/** Its tents stand this far from its fire (m), its people this far (the nearest and the farthest). */
export const TENT_RING_M = 6;
export const BAND_RING_M = Object.freeze([3, 9]);
/** How many tents: one each three of its people, at least two. */
export const tentsFor = (n) => Math.max(2, Math.ceil(n / 3));
/** By night (before HIDEOUT_DAY_H[0], from HIDEOUT_DAY_H[1]) half its people are out on the road. */
export const HIDEOUT_DAY_H = Object.freeze([6, 20]);
/** A band is heard of from a traveller within this of its hideout (map pixels). */
export const HEARD_PX = 3;
/** The rumoured ring's point lies up to this far from the hideout (native: half a pixel). */
export const RUMOUR_OFF_N = 16384;

/** Those of a band standing at its hideout at minute `t`: all by day, the first half by night. @param {any} band @param {number} t */
export function standingAt(band, t) {
  const h = (((t % DAY_MIN) + DAY_MIN) % DAY_MIN) / 60;
  const night = h < HIDEOUT_DAY_H[0] || h >= HIDEOUT_DAY_H[1];
  return night ? band.people.slice(0, Math.ceil(band.people.length / 2)) : band.people;
}

/** AUDIT LW-II C8: a region whose hideouts wait on their legs' roads is asked again no sooner than this (real ms). */
export const HIDEOUTS_ASK_MS = 100;

/** AUDIT LW-II C3: a body down by a blow - dead with its body (or executed). One the relevance cull took, one escaped,
 *  one taken out lies nowhere and beat nobody. @param {any} rec */
export const killed = (rec) => !!rec?.dead && (!!rec.corpse || !!rec.executed);

/** AUDIT LW-II C2: a chest as it was minted - each piece there at its count, and nothing put in. @param {any} pile @param {[any, any][]} minted */
const asMinted = (pile, minted) => { const items = pile?.items ?? []; return items.length === minted.length && minted.every(([it, n]) => items.includes(it) && it?.stackCount === n); };

/**
 * AUDIT LW-II C8: THE HIDEOUTS KEPT - each region's (outlaws.js hideoutsOf, the host's `of`), kept for the network's
 * generation once its legs' roads are planned. While one is not, the region answers none, asked again no sooner than
 * HIDEOUTS_ASK_MS (a trouble read meanwhile pays a look-up, never its legs again); and its first bands after waiting are
 * told (`resolved`) - the host's books of troubles made band-less meanwhile are made again. Kept for the session, they
 * left one reader's caravan held up by the Black Hand where another's, its roads planned a few frames later, fought orcs.
 * @param {{ of: (region: number) => (any[] | undefined), generation: () => number, resolved?: (region: number) => void, now?: () => number }} deps
 * @returns {(region: number) => any[]}
 */
export function createHideoutBook(deps) {
  /** @type {Map<number, any[]>} */
  const kept = new Map();
  /** @type {Map<number, number>} the regions waiting, by when (real ms) each was last asked */
  const waiting = new Map();
  let gen = /** @type {number | null} */ (null);
  const now = deps.now ?? (() => performance.now());
  return (region) => {
    if (region == null || !Number.isFinite(region)) return [];
    if (deps.generation() !== gen) { kept.clear(); waiting.clear(); gen = deps.generation(); }
    const got = kept.get(region);
    if (got) return got;
    const at = waiting.get(region), ms = now();
    if (at != null && ms - at < HIDEOUTS_ASK_MS) return [];
    const h = deps.of(region);
    if (h === undefined) { waiting.set(region, ms); return []; }
    kept.set(region, h);
    if (waiting.delete(region) && h.length) deps.resolved?.(region);
    return h;
  };
}

/** The rumoured ring's point: the hideout's, moved by the band's seed up to RUMOUR_OFF_N. @param {any} h @param {string} bandKey */
export function rumourAt(h, bandKey) {
  const s = lwSeed(textSeed(bandKey), 0x72756d);   // 'rum'
  const a = ((s % 3600) / 3600) * Math.PI * 2, d = RUMOUR_OFF_N * (((s >>> 12) % 1000) / 1000);
  return { x: h.x + Math.sin(a) * d, z: h.z + Math.cos(a) * d };
}

/**
 * @param {{
 *   hideoutsNear: (x: number, z: number) => any[], bandAt: (h: any, t: number) => any, clock: () => number,
 *   here: () => ({ x: number, z: number } | null), ready: () => boolean, owner: (feet: number[]) => boolean,
 *   sceneOf: (nx: number, nz: number) => number[], spawn: (type: number, feet: number[], o: any) => Promise<any>,
 *   remove: (rec: any) => void, inPool: (rec: any) => boolean, relations: () => any, say: (text: string) => void,
 *   chest: (band: any, t: number) => { items: any[], robbed: any[] }, dropPile: (items: any[], feet: number[]) => any,
 *   removePile: (pile: any) => void, renderer?: any, meshes?: any, getTexture?: (archive: number) => any,
 *   uploadRecordFrame?: (archive: number, record: number, frame: number) => void,
 * }} deps
 */
export function createHideouts(deps) {
  /** The hideout stood, or null. */
  let stood = /** @type {any} */ (null);
  let timer = 0;
  let tent = /** @type {any} */ (null), tentLoading = false;
  let fire = /** @type {any} */ (null), fireLoading = false;
  const rel = () => deps.relations();

  function ensureArt() {
    if (!tent && !tentLoading && deps.meshes?.getGpuMesh) {
      tentLoading = true;
      Promise.resolve(deps.meshes.getGpuMesh(TENT_MODEL)).then((gpu) => { tent = gpu ? { gpu } : null; }).catch(() => {});
    }
    if (!fire && !fireLoading && deps.getTexture) {
      fireLoading = true;
      Promise.resolve(deps.getTexture(FIRE_FLAT.archive)).then((t) => {
        if (!t) return;
        const count = t.getFrameCount?.(FIRE_FLAT.record) ?? 1;
        for (let i = 0; i < count; i++) deps.uploadRecordFrame?.(FIRE_FLAT.archive, FIRE_FLAT.record, i);
        const size = t.getSize(FIRE_FLAT.record);
        fire = { size: { w: size.width * GLOBAL_SCALE, h: size.height * GLOBAL_SCALE } };
      }).catch(() => {});
    }
  }

  const takeOut = (rec) => { try { if (deps.inPool(rec)) deps.remove(rec); } catch (e) { console.warn('[hideouts] a body would not leave', /** @type {any} */ (e)?.message ?? e); } };

  /** The camp's turn about its fire (its seed's). @param {any} h */
  const turnOf = (h) => (lwSeed(textSeed(h.key), 0x74656e74) % 628) / 100;   // 'tent'

  /** Stand a hideout: its tents, its fire, its chest (every reader's own), and its people where this player stands them
   *  (`owned`: the election's - AUDIT LW-II C11b). */
  function stand(h, t, owned) {
    const band = deps.bandAt(h, t);
    const n = band ? band.people.length : 4;
    const turn = turnOf(h);
    const tents = [];
    for (let i = 0; i < tentsFor(n); i++) {
      const a = turn + (i / tentsFor(n)) * Math.PI * 2;
      const nx = h.x + Math.sin(a) * TENT_RING_M * NATIVE_PER_M, nz = h.z + Math.cos(a) * TENT_RING_M * NATIVE_PER_M;
      const feet = deps.sceneOf(nx, nz);
      tents.push({ feet, yaw: a + Math.PI });   // facing the fire
    }
    const centre = deps.sceneOf(h.x, h.z);
    // `rel` the character it stood for (AUDIT LW-II C11c); `minted` its chest's pieces and counts (C2); `killed` its
    // people struck down (C3)
    stood = { h, band, tents, centre, foes: [], spawning: 0, pile: null, minted: /** @type {[any, any][]} */ ([]), robbed: [], routed: false, batch: null,
      rel: rel(), owned: false, looted: false, killed: new Set() };
    if (band) {
      if (owned) standPeople(stood, t);
      const c = deps.chest(band, t);
      stood.robbed = c.robbed;   // its robbed parties, looted or not: the rout's thanks
      if (!rel()?.turns?.()?.looted?.has(band.key) && c.items.length) {
        stood.pile = deps.dropPile(c.items, centre);
        stood.minted = c.items.map((it) => [it, it?.stackCount]);
      }
    }
  }

  /** Its people stood, as the pool's foes about the fire: those standing at minute `t`. @param {any} s @param {number} t */
  function standPeople(s, t) {
    s.owned = true;
    const people = standingAt(s.band, t), turn = turnOf(s.h);
    people.forEach((p, i) => {
      const a = turn + 0.5 + (i / Math.max(1, people.length)) * Math.PI * 2;
      const r = BAND_RING_M[0] + (BAND_RING_M[1] - BAND_RING_M[0]) * ((lwSeed(textSeed(p.id)) % 100) / 100);
      const feet = deps.sceneOf(s.h.x + Math.sin(a) * r * NATIVE_PER_M, s.h.z + Math.cos(a) * r * NATIVE_PER_M);
      s.spawning++;
      deps.spawn(p.cls, feet, { yaw: a, level: p.level, gender: p.sex, allied: false }).then((rec) => {
        s.spawning--;
        if (!rec) return;
        if (stood !== s) { takeOut(rec); return; }   // let go while it came
        if (rec.entity) rec.entity.name = p.name;
        rec.living = { outlaw: p.id };
        s.foes.push(rec);
      }).catch(() => { s.spawning--; });
    });
  }

  /** A hand in the chest: `looted` for the character it stood for. @param {any} s */
  function lootedYet(s) {
    if (!s.pile || s.looted || asMinted(s.pile, s.minted)) return;
    s.looted = true;
    if (rel() === s.rel) rel()?.turn?.('looted', s.band.key);
  }

  /** Let the hideout go: its living taken out, its chest's state kept. */
  function letGo() {
    const s = stood;
    if (!s) return;
    stood = null;
    for (const rec of s.foes) if (!rec.dead) takeOut(rec);
    if (s.pile) {
      lootedYet(s);   // a hand in it this very frame - the character's who stood it, never a loaded one's (C11c)
      deps.removePile(s.pile);
    }
    if (s.batch) deps.renderer?.destroyBillboardBatch?.(s.batch);
  }

  /** Routed: the tale, the robbed parties' thanks, the word. */
  function rout(s, t) {
    s.routed = true;
    const r = rel();
    const day = Math.floor((t - 240) / DAY_MIN);
    r?.turn?.('routed', `${s.h.key}@${s.band.gen}.${s.band.heir}`, { t, who: s.band.name });
    const thanked = new Set();
    for (const tr of s.robbed) for (const m of tr.party ?? []) if (!thanked.has(m.id)) { thanked.add(m.id); r?.note?.(m.id, 'helped', day); }
    deps.say(`You have routed ${s.band.name}.`);
  }

  return {
    /**
     * One frame: a hand in the chest kept; once a second the nearest hideout within BAND_LIVE_M stood (or the one stood
     * let go past BAND_KEEP_M), its people stood by the one it falls to, and a band stood whose people are all killed
     * routed.
     * @param {number} dt
     */
    frame(dt) {
      // AUDIT LW-II C11c: another character's records (a load, a new game) - the hideout stood for the last let go, and
      // nothing of it theirs (a let-go after the load wrote the last session's chest into the loaded character)
      if (stood && rel() !== stood.rel) letGo();
      // AUDIT LW-II C2: a hand in the chest is `looted` the frame it shows - a piece taken, one put in, a stack split. Kept
      // at the let-go alone, and by its count, a piece swapped in (or a save made while it stood) refilled it without end
      if (stood) lootedYet(stood);
      if ((timer -= dt) > 0) return;
      timer = 1;
      const here = deps.here();
      const t = deps.clock();
      if (!here || !deps.ready()) { letGo(); return; }
      if (stood) {
        const d = Math.hypot(here.x - stood.h.x, here.z - stood.h.z) / NATIVE_PER_M;
        if (d > BAND_KEEP_M) { letGo(); return; }
        // AUDIT LW-II C11b: the camp stood by every reader; its people by the one it falls to (taken up when it does)
        if (stood.band && !stood.owned && !stood.routed && deps.owner(deps.sceneOf(stood.h.x, stood.h.z))) standPeople(stood, t);
        // AUDIT LW-II C3: ROUTED by blows - every one stood, killed. The cull took them as dead the frame after a player
        // walked up (a camp's 200 m against the pool's 120), and one gone from the pool counted as one down
        if (stood.band && stood.owned && !stood.routed && !stood.spawning && stood.foes.length) {
          for (const rec of stood.foes) if (killed(rec)) stood.killed.add(rec);
          if (stood.foes.every((/** @type {any} */ rec) => stood.killed.has(rec))) rout(stood, t);
        }
        return;
      }
      const near = deps.hideoutsNear(here.x, here.z)
        .map((h) => ({ h, d: Math.hypot(here.x - h.x, here.z - h.z) / NATIVE_PER_M }))
        .filter((q) => q.d <= BAND_LIVE_M).sort((a, b) => a.d - b.d)[0];
      if (!near) return;
      ensureArt();
      stand(near.h, t, deps.owner(deps.sceneOf(near.h.x, near.h.z)));
    },
    /** The fire's batch (the exterior's billboard pass): a band's camp burns, an empty one is cold. */
    batches() {
      const s = stood;
      if (!s?.band || s.routed || !fire || !deps.renderer?.createBillboardBatch) return [];
      if (!s.batch) { s.batch = deps.renderer.createBillboardBatch(FIRE_FLAT.archive, FIRE_FLAT.record, fire.size, [s.centre]); if (s.batch) s.batch.frame = 0; }
      return s.batch ? [s.batch] : [];
    },
    /** The tents, in the host's world mesh pass. @param {any} r @param {any} [texRemap] */
    draw(r, texRemap = null) {
      if (!stood || !tent?.gpu || !r?.drawMesh) return 0;
      for (const tt of stood.tents) r.drawMesh(tent.gpu, trs(tt.feet[0], tt.feet[1], tt.feet[2], 0, (tt.yaw * 180) / Math.PI, 0), texRemap);
      return stood.tents.length;
    },
    /**
     * HEARD OF: the band whose hideout lies within HEARD_PX of native (`x`, `z`) the character has not heard of yet, or
     * null - the roads' greeting warns of it, and `heard` keeps it.
     * @param {number} x @param {number} z @param {number} t
     */
    unheardNear(x, z, t) {
      const heard = rel()?.turns?.()?.heard;
      for (const h of deps.hideoutsNear(x, z)) {
        if (Math.max(Math.abs(h.x - x), Math.abs(h.z - z)) > HEARD_PX * NATIVE_PIXEL) continue;
        const band = deps.bandAt(h, t);
        if (band && !heard?.has(band.key)) return band;
      }
      return null;
    },
    /** The character heard of a band. @param {any} band */
    heard(band) { return rel()?.turn?.('heard', band.key) ?? false; },
    /**
     * The Overworld's rumoured hideouts about native (`x`, `z`): each band standing whose name the character has heard -
     * a ring (`wayfarer hideout`) about a point near it.
     * @param {number} x @param {number} z @param {number} t
     */
    marks(x, z, t) {
      const heard = rel()?.turns?.()?.heard;
      if (!heard?.size) return [];
      const out = [];
      for (const h of deps.hideoutsNear(x, z)) {
        const band = deps.bandAt(h, t);
        if (!band || !heard.has(band.key)) continue;
        const p = rumourAt(h, band.key);
        out.push({ key: `hideout:${h.key}`, at: deps.sceneOf(p.x, p.z), label: `Hideout of ${band.name} (rumoured)`, kind: 'wayfarer hideout' });
      }
      return out;
    },
    /** What stands (the probes; the pins). */
    shown: () => (stood ? { key: stood.h.key, band: stood.band?.key ?? null, foes: stood.foes.length, tents: stood.tents.length, pile: !!stood.pile, routed: stood.routed } : null),
    /** Every body taken out, the pile and the fire let go. */
    clear() { letGo(); timer = 0; },
  };
}
