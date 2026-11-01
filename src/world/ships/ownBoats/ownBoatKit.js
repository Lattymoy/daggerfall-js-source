// THE BOATS' OWN BENCH - what our five hulls' prefabs are put together with: one component table
// and one mesh table for all twelve prefabs (Come Sail Away's data shape, systems/comeSailAway/comeSailAwayModels.js),
// a node drawing a part, and the small things every hull carries by the names Come Sail Away's runtime walks: its
// Modifiers, wake, pennant, lanterns, crew, oars and rudder effects, the water plane its drops land on, its triggers.
// Not a DFU member.
import { nodeOf, invertRigid, yaw } from '../../shipKit.js';
import { mat4FromQuatPosScale } from '../../quat.js';
import { multiply } from '../../mat4.js';
import { colliderOf } from './ownBoatParts.js';
import * as P from './ownBoatParts.js';
import * as FX from './ownBoatEffects.js';

/** A turn about y (degrees, Unity's: +z toward +x) - the fleet's own (world/shipKit.js) - and about x, as quaternions. */
export { nodeOf, yaw };
export const pitch = (deg) => [Math.sin((deg * Math.PI) / 360), 0, 0, Math.cos((deg * Math.PI) / 360)];

/**
 * The bench: `comp(record)` a component (its index), `mesh(key, g)` a mesh by key (a key made once is kept: the
 * hulls share their small things' meshes), `part(name, key, make, opts)` a node drawing a part (made once a key),
 * `skinned(...)` a skinned renderer whose bones are resolved at `finish(roots)`.
 */
export function ownBench() {
  const components = [];
  /** @type {Record<string, any>} */
  const meshes = {};
  const skinnedLater = [];
  const comp = (record) => components.push(record) - 1;
  const mesh = (key, geometry) => {
    if (!geometry) throw new Error(`own boats: ${key} built nothing`);
    meshes[key] ??= geometry;
    return key;
  };
  const renderer = (geometry) =>
    comp({ type: 'MeshRenderer', m_Enabled: true, materials: geometry.slots.map((slot) => ({ ...slot })) });
  /** A node drawing `key` (made by `make` the first time), with a MeshCollider over it when `collider`. */
  const part = (name, key, make, { collider = false, convex = false, c: extra = [], ...opts } = {}) => {
    const geometry = meshes[key] ?? make();
    mesh(key, geometry);
    const own = [comp({ type: 'MeshFilter', m_Mesh: { mesh: key } }), renderer(geometry)];
    if (collider) {
      mesh(`${key}:collider`, colliderOf(geometry));
      own.push(
        comp({
          type: 'MeshCollider',
          m_Enabled: true,
          m_IsTrigger: false,
          m_Convex: convex,
          m_Mesh: { mesh: `${key}:collider` },
        }),
      );
    }
    return nodeOf(name, { ...opts, c: [...own, ...extra] });
  };
  const skinned = (node, key, bones, rootBone, materials) =>
    skinnedLater.push({ node, key, bones, rootBone, materials });
  /** The skinned renderers' bones and bind poses, every tree's paths known. */
  function finish(roots) {
    const paths = new Map(),
      rest = new Map();
    const walk = (n, path, parentM) => {
      const matrix = multiply(parentM, mat4FromQuatPosScale(n.rotation, n.position, n.scale), new Float32Array(16));
      paths.set(n, path);
      rest.set(n, matrix);
      for (const child of n.children) walk(child, `${path}/${child.name}`, matrix);
    };
    for (const root of roots) walk(root, root.name, new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]));
    for (const k of skinnedLater) {
      const at = rest.get(k.node);
      if (!at) throw new Error('own boats: a skinned renderer outside every tree');
      const geometry = meshes[k.key];
      geometry.bindPoses = k.bones.map((b) => multiply(invertRigid(rest.get(b)), at, new Float32Array(16)));
      k.node.components.push(
        comp({
          type: 'SkinnedMeshRenderer',
          m_Enabled: true,
          m_Mesh: { mesh: k.key },
          m_Materials: k.materials,
          m_Bones: k.bones.map((b) => ({ node: paths.get(b) })),
          m_RootBone: k.rootBone ? { node: paths.get(k.rootBone) } : null,
          m_AABB: {
            m_Center: { x: geometry.aabb.center[0], y: geometry.aabb.center[1], z: geometry.aabb.center[2] },
            m_Extent: { x: geometry.aabb.extent[0], y: geometry.aabb.extent[1], z: geometry.aabb.extent[2] },
          },
        }),
      );
    }
  }
  /** A ParticleSystem and its renderer on a node (`pair` an effect of ownBoatEffects.js). */
  const effect = (name, pair, opts = {}) => {
    const [system, systemRenderer] = pair;
    return nodeOf(name, { ...opts, c: [comp(system), comp(systemRenderer), ...(opts.c ?? [])] });
  };
  return { components, meshes, comp, mesh, part, skinned, finish, effect };
}

/** The unit trigger box each of the seven activation prefabs is (112400-112406). */
export const triggerBox = () => ({
  type: 'BoxCollider',
  m_Material: null,
  m_IsTrigger: true,
  m_Enabled: true,
  m_Size: { x: 1, y: 1, z: 1 },
  m_Center: { x: 0, y: 0, z: 0 },
});

/** A hull's Modifiers: each the node GetBoatTransforms reads its handling, audio and cargo off (position and scale). */
export function modifiers(spec) {
  const kids = [];
  for (const [name, place] of spec)
    kids.push(nodeOf(name, { p: place.p ?? [0, 0, 0], s: place.s ?? [1, 1, 1], active: place.active ?? true }));
  return nodeOf('Modifiers', { kids });
}

/** The wake under the hull: its foam laid where she was, and a bow wave each side from `bow` (the node's frame). */
export function wakeObject(k, { at = [0, 0.1, 0], s: scale = 1, bow = [0, 0, 1], wave = {} }) {
  return k.effect('WakeObject', FX.wake(), {
    p: at,
    s: [scale, scale, scale],
    kids: [
      k.effect('Particle System (4)', FX.bowWave(-14, wave), { p: bow, s: wave.s }),
      k.effect('Particle System (3)', FX.bowWave(14, wave), { p: bow, s: wave.s }),
    ],
  });
}
/** The pennant at the masthead: its streamer, and the switched-off cube under it. */
export function flagObject(k, at, scale = [1, 1, 2]) {
  const cube = nodeOf('Cube', {
    p: [0, -0.18, 0],
    s: [0.25, 1, 0.25],
    active: false,
    c: [
      k.comp({ type: 'MeshFilter', m_Mesh: { builtin: 'Cube' } }),
      k.comp({ type: 'MeshRenderer', m_Enabled: true, m_Materials: [{ material: 'Default-Material' }] }),
      k.comp({
        type: 'BoxCollider',
        m_Enabled: true,
        m_IsTrigger: false,
        m_Center: { x: 0, y: 0, z: 0 },
        m_Size: { x: 1, y: 1, z: 1 },
      }),
    ],
  });
  return nodeOf('FlagObject', {
    p: at,
    kids: [k.effect('Particle System', FX.pennant(), { p: [0, 0.25, 0], s: scale }), cube],
  });
}
/** Unity's 10 x 10 plane at 10x the hull's root holds, its renderer and its collider off: the water the drops land on. */
export function waterPlane(k) {
  return nodeOf('Plane', {
    s: [10, 10, 10],
    c: [
      k.comp({ type: 'MeshFilter', m_Mesh: { builtin: 'Plane' } }),
      k.comp({ type: 'MeshRenderer', m_Enabled: false, m_Materials: [{ material: 'Default-Material' }] }),
      k.comp({
        type: 'MeshCollider',
        m_Enabled: false,
        m_IsTrigger: false,
        m_Convex: false,
        m_Mesh: { builtin: 'Plane' },
      }),
    ],
  });
}
/** A hull's water mask: a plate over her plan wearing the mask's material, never drawn. */
export function waterCull(k, name, key, w, z0, z1, opts = {}) {
  k.mesh(key, P.plateGeometry(w, z0, z1));
  return nodeOf(name, {
    ...opts,
    c: [
      k.comp({ type: 'MeshFilter', m_Mesh: { mesh: key } }),
      k.comp({ type: 'MeshRenderer', m_Enabled: true, m_Materials: [{ material: 'WaterMaskMaterial' }] }),
    ],
  });
}

/** A lantern flat's helper (archive 210 record 27, hung under its point). */
export const lanternFlat = (place = [0, 0, 0]) => nodeOf('BillboardHelper-210_027:2', { p: place });
/** The short lantern pole (its lantern 0.84 m up, 0.36 m out). */
export const poleShort = (k, name, place, turn) =>
  k.part(name, 'own:lanternPoleShort', () => P.lanternPoleGeometry(0.92, 0.36), {
    p: place,
    r: turn,
    kids: [lanternFlat([0, 0.8335, -0.3619])],
  });
/** The tall lantern pole (its lantern 1.64 m up). */
export const poleTall = (k, name, place, turn) =>
  k.part(name, 'own:lanternPoleTall', () => P.lanternPoleGeometry(1.72, 0.36), {
    p: place,
    r: turn,
    kids: [lanternFlat([0, 1.6423, -0.3619])],
  });
/** The lantern's stand on its plank (its lantern 2.03 m up). */
export const standPlank = (k, name, place, turn) =>
  k.part(name, 'own:lanternStand', () => P.lanternStandGeometry(2.1, 0.28), {
    p: place,
    r: turn,
    kids: [lanternFlat([0, 2.031, -0.273])],
  });
/** A lantern's hook (its lantern a little under it, 0.23 m out). */
export const hook = (k, name, place, turn) =>
  k.part(name, 'own:lanternHook', () => P.lanternHookGeometry(0.26), {
    p: place,
    r: turn,
    kids: [lanternFlat([0, -0.0297, -0.2319])],
  });
/** A lantern hung from a beam. */
export const hanging = (name, place) => nodeOf(name, { p: place, kids: [lanternFlat()] });
/** One of the crew: their flat's helper (`AAA_RRR`, stood on its foot) and the trigger they carry, a metre up. */
export const crew = (name, flat, place, trigger = null) =>
  nodeOf(name, {
    p: place,
    kids: [nodeOf(`BillboardHelper-${flat}:1`), ...(trigger ? [nodeOf(trigger, { p: [0, 1, 0] })] : [])],
  });
/** A board trigger outside her, three metres a side, its BoardPosition on her deck (its own frame a third of hers). */
export const boardTrigger = (place, standLocal, turn, scale = [3, 3, 3]) =>
  nodeOf('BoardTrigger', {
    p: place,
    s: scale,
    kids: [nodeOf('BoardPosition', { p: standLocal, r: turn, s: scale.map((value) => 1 / value) })],
  });

/**
 * An oar: its pivot (`name`, the node the rowing clips turn) at the oarlock, the oar over it along -x (`sx` -1, port)
 * or +x, `out` m outboard, and its effect - drops off its blade (`at` along it) onto the hull's water plane, each a
 * splash. `oarName` the oar node's own (Come Sail Away's names are kept).
 */
export function oar(
  k,
  { name, oarName, p: place, out, sx: side, rootName, path, lift = 0.15, at = 0.82, dropSize = 0.12, splash = [3, 6] },
) {
  const key = `own:oar:${out.toFixed(2)}:${side}`;
  const effectPath = `${path}/${name}/${oarName}/OarEffect/Particle System (3)`;
  const effect = k.effect('OarEffect', FX.drops(`${rootName}/Plane`, effectPath, { size: dropSize }), {
    p: [side * out * at, 0, 0],
    r: pitch(90),
    kids: [k.effect('Particle System (3)', FX.splash(splash))],
  });
  const loom = k.part(
    oarName,
    key,
    () =>
      P.oarGeometry(out, {
        sx: side,
        blade: Math.min(0.9, out * 0.3),
        inboard: Math.min(1.2, out * 0.35),
        r: out > 6 ? 0.08 : 0.045,
      }),
    {
      p: [0, lift, 0],
      kids: [effect],
    },
  );
  return nodeOf(name, { p: place, kids: [loom] });
}
/** A weighed anchor fished on her starboard bow at `z`, `y`: its shank along her side's run there, its stock's inner
 *  end a hand off her planking. */
export function fishedAnchor(k, name, stations, z, y, { size = 1.6, stock = 1.2, alongX = false } = {}) {
  const w = (at) => P.outerWidth(stations, at, y);
  const deg = (Math.atan2(w(z + 0.5) - w(z - 0.5), 1) * 180) / Math.PI;
  const place = [w(z) + (stock / 2) * Math.cos((deg * Math.PI) / 180) + 0.08, y, z];
  const key = `own:anchorFished:${size}:${stock}${alongX ? ':x' : ''}`;
  return k.part(name, key, () => P.anchorCattedGeometry(size, stock, alongX), {
    p: place,
    r: yaw(alongX ? deg - 90 : deg),
  });
}
/** A let-go anchor's hawse in its node's frame: its cable comes out of her side there, the anchor down under the node. */
export const HAWSE = Object.freeze([-1.53, 0, 0]);
/** The anchor let go from her starboard bow at `z`, `y`: its cable out of her hawse there, its node turned along her
 *  side's run as the fished anchor's is. */
export function letGoAnchor(k, name, stations, z, y, depth = 6) {
  const w = (at) => P.outerWidth(stations, at, y);
  const slant = Math.atan2(w(z + 0.5) - w(z - 0.5), 1);
  const out = -HAWSE[0];
  const place = [w(z) + 0.03 + out * Math.cos(slant), y, z - out * Math.sin(slant)];
  return k.part(name, `own:anchorDeployed:${depth}`, () => P.anchorDeployedGeometry(depth, 0.6, HAWSE), {
    p: place,
    r: yaw((slant * 180) / Math.PI),
  });
}
/** A rudder's drops, shed as it moves, onto the hull's water plane. */
export function rudderEffect(k, { rootName, path, p: place, size = 0.25, splash = [2, 5] }) {
  return k.effect(
    'RudderEffect',
    FX.drops(`${rootName}/Plane`, `${path}/RudderEffect/Particle System (3)`, { size, perMetre: 1, loop: true }),
    {
      p: place,
      r: pitch(90),
      kids: [k.effect('Particle System (3)', FX.splash(splash))],
    },
  );
}
