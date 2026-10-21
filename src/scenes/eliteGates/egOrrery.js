// @ts-check
// FIELD BUGS 2026-10-20f ORRERY-STONES (bible/01-Overview/bugs/Field-Bugs-2026-10-20f.md; ilovemybonk in #general: "the clocks
// that do the time in the orrery task halls do not have models showing you where to interact with them. You have to search
// around an empty area for the 'rewind back, move forward' options"): AN ATHENAEUM'S STONES, STOOD. The Spire's Athenaeum is
// the Hour's Orrery (Elite-Gates.md section 8.4): six stones at the Hour's own bearings, on a ring of the Hour's 11 m about its
// court's heart (net/eliteGates/egLaw.js, the Athenaeum's arm; net/superDungeon/sdBrain.js SD_STONE_POS). The Spire drew each as
// a gold disc on the floor and offered the activation ray two handles 0.9 m to either side of the disc's middle and a metre
// up, with nothing drawn there. Here each stands as the Hour's own stone (world/superDungeon/sdHall.js buildStoneModel, its
// bezel, its hand and its crown gear), carried from the Hour's place to its spot by a translation alone - the bearings are the
// Hour's, so stone j faces its court's heart as the Hour's stone j faces the dial's - on its own floor (the spot's
// centimetres, THE ASCENT). Its two levers ARE the handles (handleBox, carried the same way): the right as you face it turns
// it forward, the left back, as in the Hour. Its hand shows the hour the room last said (`orr`), the relay's start before the
// trial and the true hours once the hall is behind the company, going to a turn's hour at the Hour's pace. It is solid, as
// the Hour's stones are (AUDIT SD II): its slab, its cap and its levers stand in the collider.
//
// Not a DFU member. Ledger A (ELITE-GATES).
import { SD_STONES, SD_STONE_POS, sdHour } from '../../net/superDungeon/sdBrain.js';
import { buildStoneModel, buildBezelModel, buildHandModel, buildCrownGearModel, handMatrix, crownGearMatrix, handleBox, stoneSolids, SD_CROWN_GEAR } from '../../world/superDungeon/sdHall.js';
import { ensureSdHallArt, sdHandWay, SD_HAND_RATE } from '../superDungeon/sdHall.js';
import { spireOrreryOf } from '../../systems/eliteGates/spireOrrery.js';
import { spireObjs } from '../../systems/eliteGates/spireKit.js';
import { RAY_DISTANCE, DEFAULT_ACTIVATION_DISTANCE } from '../../player/activate.js';
import { identity } from '../../world/mat4.js';

/** How high a stone stands over its floor, to the top of its crown gear's teeth (m) - its words stand over it. */
export const EG_STONE_TOP_M = SD_CROWN_GEAR.y + SD_CROWN_GEAR.tip;

/** The shift (m) that carries the Hour's stone `j` onto spot `q` of hall `spec` - its foot from SD_STONE_POS[j] to the spot,
 *  on the spot's own floor. The realm's frame and the dungeon's alike (realmToDungeon is a translation). Pure. */
export const egStoneShift = (spec, q, j) => [spec.x0 + q.x - SD_STONE_POS[j].x, Number.isFinite(q.y) ? q.y / 100 : 0, q.z - SD_STONE_POS[j].z];
/** Stone `j`'s lever on `side` (1 forward - the right as you face it; -1 back) carried by `d`: its activation box. Pure. */
export function egStoneHandleBox(d, j, side) {
  const b = handleBox(j, side);
  return { min: [b.min[0] + d[0], b.min[1] + d[1], b.min[2] + d[2]], max: [b.max[0] + d[0], b.max[1] + d[1], b.max[2] + d[2]] };
}
/** Stone `j`'s solids - the Hour's own boxes (stoneSolids: its slab, its cap, its levers) - carried by `d`, as triangles
 *  into `out` (the dungeon's frame). */
export function egStoneSolidTris(d, j, out = []) {
  for (const [, quads] of stoneSolids(j)) for (const q of quads) for (const k of [0, 1, 2, 0, 2, 3]) out.push(q[k][0] + d[0], q[k][1] + d[1], q[k][2] + d[2]);
  return out;
}
/** `m` (the Hour's place for a part of stone `j`) carried by `d`, in place: T(d) x m - its turn kept, its move shifted. */
const carry = (m, d) => { m[12] += d[0]; m[13] += d[1]; m[14] += d[2]; return m; };
/** `m` made the identity, in place (a part built where the Hour stands it). */
const still = (m) => { m.fill(0); m[0] = m[5] = m[10] = m[15] = 1; return m; };

/**
 * The Athenaeums' stones of a circle.
 * @param {{ seed: number, specs: any[], place: (kind: string, mk: string, modelFn: () => any, o?: { turns?: boolean }) => any }} deps -
 *   `place` the span's own (scenes/eliteGates/egSpan.js): a part in the circle's batch, or its own draw, in the band's dress
 */
export function createEgOrrery({ seed, specs, place }) {
  /** each Athenaeum: its Orrery (the relay's draw, systems/eliteGates/spireOrrery.js), its stones (each its shift and its
   *  four parts' slots), the hours its hands show and go to, and whether the room has said them */
  const halls = [];
  for (const spec of specs) {
    const spots = spec.kind === 'athenaeum' ? (spec.spots?.stone ?? []).slice(0, SD_STONES.length) : [];
    if (!spots.length) continue;
    const o = spireOrreryOf(seed, spec), start = spots.map((_, j) => o?.start?.[j] ?? 0);
    halls.push({ spec, o, stones: spots.map((q, j) => ({ j, d: egStoneShift(spec, q, j), body: null, bezel: null, hand: null, gear: null })), shown: [...start], want: [...start], heard: false });
  }
  let targetList = [], stood = false;
  /** Stone `s`'s hand and gear where hour `h` stands them. */
  const poseHand = (s, h) => {
    if (s.hand) carry(handMatrix(s.j, h, s.hand.object.matrix), s.d);
    if (s.gear) carry(crownGearMatrix(s.j, h, s.gear.object.matrix), s.d);
  };
  /** The hours hall `H`'s hands go to now: the room's word in its trial, the true hours once it is behind the company (its door
   *  opens on a true Orrery alone), the relay's start before it. */
  function wantOf(H, objs) {
    if (objs.h === H.spec.h && Array.isArray(objs.orr)) { H.heard = true; return objs.orr; }
    if (objs.h > H.spec.h && H.o) return H.o.truth;
    return H.heard ? H.want : H.o?.start ?? H.want;
  }
  return {
    /** Stand every stone (`renderer` uploads the Hour's hall pictures its faces wear), its solids into `collider` - once,
     *  inside the span's stand, before its batch is built. Answers the activation boxes: two levers a stone. */
    stand({ renderer = null, collider = null } = {}) {
      if (stood) return targetList;
      stood = true;
      if (halls.length) ensureSdHallArt(renderer);
      const list = [];
      for (const H of halls) {
        const tris = [];
        for (const s of H.stones) {
          s.body = place('orrery', `orrery:stone:${s.j}`, () => buildStoneModel(s.j));
          s.bezel = place('orrery', `orrery:bezel:${s.j}`, () => buildBezelModel(s.j));
          for (const d of [s.body, s.bezel]) if (d) carry(still(d.object.matrix), s.d);
          s.hand = place('orreryHand', 'orrery:hand', () => buildHandModel(), { turns: true });
          s.gear = place('orreryHand', 'orrery:gear', () => buildCrownGearModel(), { turns: true });
          poseHand(s, H.shown[s.j]);
          egStoneSolidTris(s.d, s.j, tris);
          for (const side of [1, -1]) list.push({ key: `egstone:${H.spec.h}:${s.j}:${side > 0 ? 'f' : 'b'}`, aabb: egStoneHandleBox(s.d, s.j, side), distance: RAY_DISTANCE, reach: DEFAULT_ACTIVATION_DISTANCE });
        }
        const positions = new Float32Array(tris), indices = new Uint16Array(positions.length / 3);
        for (let k = 0; k < indices.length; k++) indices[k] = k;
        try { collider?.addMesh?.(`eg:orrery:${H.spec.h}`, positions, indices, identity()); } catch (e) { console.warn('[eg] an Orrery\'s stones\' collider', e?.message ?? e); }
      }
      return (targetList = list);
    },
    /** One frame: each hand toward its hour the short way, at the Hour's pace (SD_HAND_RATE) - a hand at rest keeps its matrix. */
    frame(dt) {
      if (!stood || !halls.length) return;
      const objs = spireObjs(), step = Math.max(0, dt) * SD_HAND_RATE;
      for (const H of halls) {
        const want = wantOf(H, objs);
        for (const s of H.stones) {
          H.want[s.j] = Number.isFinite(want[s.j]) ? want[s.j] : H.want[s.j];
          const w = sdHandWay(H.shown[s.j], H.want[s.j]);
          if (w === 0) continue;
          H.shown[s.j] = Math.abs(w) <= step ? H.want[s.j] : sdHour(H.shown[s.j] + Math.sign(w) * step);
          poseHand(s, H.shown[s.j]);
        }
      }
    },
    /** The levers, in the activation ray - the list the stand made. */
    targets: () => targetList,
    /** Every stone as it stands (tests): its hall, its number, its shift, the hour its hand shows, its four parts. */
    get stones() { return halls.flatMap((H) => H.stones.map((s) => ({ h: H.spec.h, j: s.j, d: [...s.d], shown: H.shown[s.j], body: s.body, bezel: s.bezel, hand: s.hand, gear: s.gear }))); },
    /** Gone with the level: the parts' slots let go (their meshes are the span's, freed with its own). */
    clear() {
      for (const H of halls) { H.heard = false; for (const s of H.stones) { s.body = s.bezel = s.hand = s.gear = null; } }
      targetList = []; stood = false;
    },
  };
}
