// OWN-WORK4 (2026-10-31): THE BOATS' OWN SAILS - each a skinned canvas on a grid of bones (world/ships/galleonRig.js's
// canvasGeometry, the fleet's), with its poses as clips over the Sail and Staysail Controllers (ownBoatAnimation.js).
// Come Sail Away's runtime reads a sail by its node's NAME (its kind - Square, Lateen, Gaff, Stay - and its size -
// Small, Large - are its handling: systems/comeSailAway/comeSailAwayBoat.js getBoatTransforms), trims it by its Boom's
// local rotation and sets it by the Animator's Stowed and Wind. So each of ours keeps the name the hull's plan gives it,
// and its poses are made here: STOWED (furled to its yard or its boom, or rolled down its stay) and set with the wind
// at -1, 0 and +1 (the staysail's five). A clip is a sixth of a second, so a CrossFade of two of them stows or sets a
// sail in a third of one, as the mod's runtime times it. Not a DFU member.
import { nodeOf } from '../../shipKit.js';
import { canvasGeometry } from '../galleonRig.js';
import { recalculateNormals } from '../../skinnedBake.js';
import { lerp3 } from '../galleonMesh.js';
import { OWN_BOAT_ARCHIVE, OWN_TEX } from './ownBoatArt.js';
import { clip, heldCurve } from './ownBoatAnimation.js';

/** A sail clip's length (s) and its rate. */
export const SAIL_SET_CLIP_S = 1 / 6;
const SAIL_RATE = 24;
/** The canvas grid: columns, rows. */
const GRID = Object.freeze([6, 5]);

/** A grid of points `at(u, v)` over the grid, row by row (row 0 the head). */
function gridOf(at) {
  const [ACROSS, DOWN] = GRID,
    out = [];
  for (let j = 0; j < DOWN; j++) for (let i = 0; i < ACROSS; i++) out.push(at(i / (ACROSS - 1), j / (DOWN - 1)));
  return out;
}
/** `point` pushed `k` along `axis` (0 x, 2 z). */
const pushed = (point, axis, k) => {
  const moved = [...point];
  moved[axis] += k;
  return moved;
};

/**
 * A square sail's poses, in its boom's frame (the yard along x at y 0, `d` before the mast): `head` and `foot` its
 * half-widths, `drop` its depth, `belly` how far it fills at its middle. Left is aback (the mod's Backward), right full.
 */
export function squarePoses({ head, foot, drop, d: depth = 0.3, belly = 0.6 }) {
  const flat = (across, down) => [(across - 0.5) * 2 * (head + (foot - head) * down), -0.12 - drop * down, depth];
  const fill = (k) =>
    gridOf((across, down) =>
      pushed(flat(across, down), 2, k * belly * Math.sin(Math.PI * across) * Math.sin(Math.PI * Math.max(down, 0.15))),
    );
  return {
    stowed: gridOf((across, down) => [
      (across - 0.5) * 2 * head * 0.96,
      -0.1 - 0.12 * down,
      depth + 0.06 * Math.sin(Math.PI * down),
    ]),
    left: fill(-0.6),
    center: fill(0.15),
    right: fill(1),
  };
}
/**
 * A fore-and-aft sail between four corners in its boom's frame - `throat` and `peak` its head, `tack` and `clew` its
 * foot (a lateen's tack and throat one point) - bellied to port (left) or starboard (right) by `belly`.
 */
export function foreAftPoses({ throat, peak, tack, clew, belly = 0.6, furl = 'foot' }) {
  const flat = (across, down) => lerp3(lerp3(throat, peak, across), lerp3(tack, clew, across), down);
  const fill = (k) =>
    gridOf((across, down) =>
      pushed(
        flat(across, down),
        0,
        k * belly * Math.sin(Math.PI * Math.min(1, across + 0.15)) * Math.sin(Math.PI * Math.min(1, down + 0.1)),
      ),
    );
  const stowed =
    furl === 'head'
      ? gridOf((across, down) => pushed(flat(across, 0.04 * down), 0, 0.05 * down))
      : gridOf((across, down) => pushed(flat(across, 0.94 + 0.06 * down), 0, 0.05 * (1 - down)));
  return { stowed, left: fill(-1), center: fill(0.1), right: fill(1) };
}
/** A staysail on its stay from `head` to `tack`, its clew aft: rolled down to its tack stowed, five sets by the wind. */
export function stayPoses({ head, tack, clew, belly = 0.5 }) {
  const flat = (across, down) => lerp3(lerp3(head, tack, down), lerp3(head, clew, down), across);
  const fill = (k) =>
    gridOf((across, down) =>
      pushed(
        flat(across, down),
        0,
        k * belly * Math.sin(Math.PI * across) * Math.sin(Math.PI * Math.min(1, down + 0.1)),
      ),
    );
  return {
    stowed: gridOf((across, down) => lerp3(tack, flat(across, down), 0.05)),
    left: fill(-1),
    centerLeft: fill(-0.5),
    center: fill(0.05),
    centerRight: fill(0.5),
    right: fill(1),
  };
}

/**
 * The sails' bench over a prefab's (world/shipKit.js prefabBench: `cx.mesh`, `cx.comp`, `cx.skinned`): `sail(name,
 * poses, base, scale)` makes a sail's node - its Animator over `base` overridden with its own clips - its bones and its
 * skinned canvas wearing our canvas, the node at `scale` (one cut, sewn smaller); the clips and overrides made land in
 * `clips` and `overrides`, keyed under `prefix`.
 */
export function sailBench(kit, prefix) {
  const clips = {},
    overrides = {};
  const sail = (name, poses, base = 'Sail Controller', scale = 1) => {
    const bonesName = `${name}Bones`,
      meshName = `${name}Mesh`;
    const rest = poses.center;
    const bones = rest.map((restPoint, k) => nodeOf(`B${k}`, { p: restPoint }));
    const bonesNode = nodeOf(bonesName, { kids: bones });
    const key = `${prefix}:${name}`;
    const canvas = canvasGeometry(rest, GRID);
    canvas.normals = recalculateNormals(canvas.positions, canvas.indices, canvas.subMeshes); // as the bake will find them
    kit.mesh(key, canvas);
    const meshNode = nodeOf(meshName, { kids: [nodeOf(`${OWN_BOAT_ARCHIVE}_${OWN_TEX.canvas}`)] });
    kit.skinned(meshNode, key, bones, bonesNode, [{ material: 'own-canvas' }]);
    const override = `${prefix}/${name}`;
    const make = (slot, grid) => {
      const n = `${override} ${slot}`;
      clips[n] = clip(
        n,
        grid.map((pose, k) => heldCurve(`${bonesName}/B${k}`, 'position', pose)),
        { length: SAIL_SET_CLIP_S, loop: false, rate: SAIL_RATE },
      );
      return n;
    };
    const slots =
      base === 'Staysail Controller'
        ? [
            ['Sail Stowed', make('Stowed', poses.stowed)],
            ['Staysail Unstowed Left', make('Left', poses.left)],
            ['Staysail Unstowed Center Left', make('Center Left', poses.centerLeft)],
            ['Staysail Unstowed Center', make('Center', poses.center)],
            ['Staysail Unstowed Center Right', make('Center Right', poses.centerRight)],
            ['Staysail Unstowed Right', make('Right', poses.right)],
          ]
        : [
            ['Sail Stowed', make('Stowed', poses.stowed)],
            ['Sail Unstowed Left', make('Left', poses.left)],
            ['Sail Unstowed Center', make('Center', poses.center)],
            ['Sail Unstowed Right', make('Right', poses.right)],
          ];
    overrides[override] = { base, clips: slots };
    return nodeOf(name, {
      s: [scale, scale, scale],
      c: [
        kit.comp({
          type: 'Animator',
          m_Enabled: true,
          m_Controller: { controller: override },
          m_ApplyRootMotion: false,
        }),
      ],
      kids: [bonesNode, meshNode],
    });
  };
  return { clips, overrides, sail };
}
