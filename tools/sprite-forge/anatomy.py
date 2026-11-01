"""The forge's naked body: the man under the armour. Torso, arms and legs are smooth lofts of measured cross-sections
with the muscles laid on as swells (body.py `vloft`); the head, hands and feet are blended blobs. Armour is grown
over this body (model.py), never instead of it, so one body wears any outfit.

Bearings are degrees round from +X: on the body's left side 0 is outward, 90 is the back, 180 inward, 270 the front;
on the right side outward is 180. Heights are metres from the ground, the arm's after the rig's stretch (arm_z)."""
import numpy as np
from mathutils import Vector

from body import Skinned, blob, blob_mesh, chain_centre, coords, ramp, vloft
from rig import arm_z, rest
from shapes import loft

TORSO = [
    (0.82, 0.06, 0.05, 0.06), (0.86, 0.12, 0.075, 0.095), (0.92, 0.172, 0.092, 0.115), (0.99, 0.182, 0.098, 0.112),
    (1.06, 0.15, 0.10, 0.096), (1.14, 0.152, 0.105, 0.092), (1.22, 0.166, 0.11, 0.10), (1.30, 0.182, 0.112, 0.106),
    (1.38, 0.196, 0.106, 0.106), (1.42, 0.2, 0.096, 0.1), (1.455, 0.18, 0.08, 0.09), (1.49, 0.13, 0.066, 0.076),
    (1.525, 0.074, 0.057, 0.063), (1.56, 0.058, 0.052, 0.056), (1.62, 0.052, 0.048, 0.05),
]
TORSO_LEAN = ([1.40, 1.62], [0.0, -0.035])   # the neck's centre comes forward of the chest's
TORSO_MUSCLES = [
    (305, 26, 1.43, 1.28, 0.026), (235, 26, 1.43, 1.28, 0.026),                                   # pectorals
    (281, 8, 1.255, 1.18, 0.007), (259, 8, 1.255, 1.18, 0.007), (281, 8, 1.19, 1.115, 0.007),     # the abdomen's
    (259, 8, 1.19, 1.115, 0.007), (281, 8, 1.125, 1.04, 0.006), (259, 8, 1.125, 1.04, 0.006),     # six blocks
    (335, 22, 1.17, 0.99, 0.012), (205, 22, 1.17, 0.99, 0.012),                                   # obliques
    (322, 10, 1.33, 1.22, 0.006), (218, 10, 1.33, 1.22, 0.006),                                   # serratus
    (35, 28, 1.40, 1.16, 0.018), (145, 28, 1.40, 1.16, 0.018),                                    # lats
    (90, 60, 1.56, 1.42, 0.012), (90, 22, 1.45, 1.16, 0.005),                                     # trapezius
    (58, 18, 1.45, 1.27, 0.007), (122, 18, 1.45, 1.27, 0.007),                                    # shoulder blades
    (80, 9, 1.26, 0.98, 0.010), (100, 9, 1.26, 0.98, 0.010),                                      # spinal erectors
    (58, 24, 1.0, 0.82, 0.028), (122, 24, 1.0, 0.82, 0.028), (90, 5, 0.97, 0.80, -0.012),         # glutes, cleft
]
ARM = [(arm_z(z), a, f, b) for z, a, f, b in [
    (1.485, 0.012, 0.012, 0.012), (1.475, 0.036, 0.036, 0.036), (1.458, 0.05, 0.049, 0.049), (1.435, 0.055, 0.053, 0.053),
    (1.40, 0.052, 0.05, 0.05), (1.34, 0.046, 0.046, 0.046), (1.28, 0.042, 0.042, 0.042), (1.205, 0.037, 0.035, 0.04),
    (1.17, 0.043, 0.04, 0.04), (1.12, 0.042, 0.038, 0.038), (1.05, 0.035, 0.031, 0.031), (0.985, 0.029, 0.024, 0.025),
    (0.962, 0.028, 0.023, 0.024),
]]
LEG = [
    (1.00, 0.03, 0.03, 0.03), (0.98, 0.055, 0.06, 0.06), (0.94, 0.08, 0.085, 0.088), (0.90, 0.09, 0.094, 0.094), (0.80, 0.085, 0.085, 0.085), (0.70, 0.075, 0.075, 0.074),
    (0.62, 0.064, 0.064, 0.064), (0.56, 0.058, 0.062, 0.058), (0.50, 0.056, 0.055, 0.064), (0.42, 0.056, 0.05, 0.068),
    (0.34, 0.05, 0.045, 0.058), (0.24, 0.042, 0.04, 0.045), (0.14, 0.035, 0.035, 0.038), (0.09, 0.034, 0.036, 0.036), (0.05, 0.03, 0.03, 0.03),
]


def arm_muscles(x):
    out, inward = (0.0, 180.0) if x > 0 else (180.0, 0.0)
    turn = 1 if x > 0 else -1
    return [
        (out, 60, arm_z(1.47), arm_z(1.32), 0.014),                   # the deltoid's cap
        (270 + 25 * turn, 30, arm_z(1.47), arm_z(1.36), 0.008),       # its front head
        (90 - 25 * turn, 30, arm_z(1.47), arm_z(1.36), 0.007),        # its rear head
        (270, 34, arm_z(1.38), arm_z(1.235), 0.014),                  # biceps
        (90 - 30 * turn, 45, arm_z(1.42), arm_z(1.24), 0.012),        # triceps, back and a little outward
        (90, 25, arm_z(1.235), arm_z(1.185), 0.005),                  # the elbow's point
        (270 + 40 * turn, 35, arm_z(1.20), arm_z(1.07), 0.010),       # brachioradialis
        (inward, 35, arm_z(1.19), arm_z(1.06), 0.008),                # the forearm's flexors
        (90 + 20 * turn, 30, arm_z(1.19), arm_z(1.08), 0.006),        # its extensors
    ]


def leg_muscles(x):
    out, inward = (0.0, 180.0) if x > 0 else (180.0, 0.0)
    fo, fi = (315.0, 225.0) if x > 0 else (225.0, 315.0)   # front-outward, front-inward
    return [
        (fo, 35, 0.90, 0.62, 0.015),       # vastus lateralis
        (fi, 25, 0.72, 0.57, 0.016),       # vastus medialis, the teardrop over the knee
        (270, 22, 0.95, 0.64, 0.010),      # rectus femoris
        (inward, 35, 0.96, 0.74, 0.012),   # adductors
        (90, 45, 0.92, 0.62, 0.012),       # hamstrings
        (270, 16, 0.59, 0.53, 0.006),      # kneecap
        (70, 22, 0.52, 0.30, 0.018), (110, 22, 0.52, 0.30, 0.018),   # the calf's two heads
        (fo, 16, 0.50, 0.22, 0.006),       # tibialis
        (out, 14, 0.13, 0.07, 0.006), (inward, 14, 0.13, 0.07, 0.006),   # the ankle's bones
    ]


def torso_centre(z):
    return 0.0, float(np.interp(z, *TORSO_LEAN))


def torso_weights(p):
    z, ax = p[:, 2], np.abs(p[:, 0])
    neck = ramp(z, 1.47, 1.53) * (1 - ramp(ax, 0.06, 0.11))
    chest = np.clip(ramp(z, 1.20, 1.30) - neck, 0, 1)
    spine = np.clip(ramp(z, 1.0, 1.08) - ramp(z, 1.20, 1.30), 0, 1)
    pelvis = 1 - ramp(z, 1.0, 1.08)
    return np.stack([pelvis, spine, chest, neck], axis=1)


def arm_weights(p):
    z = p[:, 2]
    clav = 0.6 * ramp(z, arm_z(1.40), 1.48)
    farm = 1 - ramp(z, arm_z(1.17), arm_z(1.23))
    uarm = np.clip(1 - clav - farm, 0, 1)
    return np.stack([clav, uarm, farm], axis=1)


def leg_weights(p):
    z = p[:, 2]
    pelvis = 0.5 * ramp(z, 0.88, 0.98)
    foot = 0.5 * (1 - ramp(z, 0.07, 0.12))
    shin = np.clip(1 - ramp(z, 0.50, 0.60) - foot, 0, 1)
    thigh = np.clip(1 - pelvis - shin - foot, 0, 1)
    return np.stack([pelvis, thigh, shin, foot], axis=1)


def limb_axis(x):
    return lambda p: np.stack([np.full(len(p), x), np.zeros(len(p)), np.zeros(len(p))], axis=1)


# the fused body's joints, and the pieces it is fused from (shape.py shapes each piece by its name)
JOINTS = ['pelvis', 'spine', 'chest', 'neck', 'head'] + [f'{j}_{s}' for s in 'LR'
                                                        for j in ('clav', 'uarm', 'farm', 'thigh', 'shin', 'foot')]
PIECES = ['torso', 'arm_L', 'arm_R', 'leg_L', 'leg_R', 'skull', 'barefoot_L', 'barefoot_R']
VOXEL = 0.006    # the remesh's cell: under half a pixel at the sprites' scale
DECIMATE = 0.3   # the share of the remesh's faces kept: where the surface is flat they are many more than it needs
FILLET = 0.025   # how far from where two pieces meet the crease is rounded


def _weights(joints, w):
    """Weights over `joints` laid into the body's JOINTS."""
    out = np.zeros((len(w), len(JOINTS)))
    for k, j in enumerate(joints):
        out[:, JOINTS.index(j)] = w[:, k]
    return out


def _pieces(M):
    """Each piece: (name, mesh in rest space, weights of points over JOINTS, axis of points or None)."""
    import bpy
    out = [('torso', vloft('torso', TORSO, torso_centre, n=48, muscles=TORSO_MUSCLES),
            lambda p: _weights(['pelvis', 'spine', 'chest', 'neck'], torso_weights(p)), None)]
    for s, x in (('L', 1.0), ('R', -1.0)):
        pts = [rest(f'uarm_{s}') + Vector((-0.03 * x, 0, 0.06)), rest(f'uarm_{s}'), rest(f'farm_{s}'), rest(f'hand_{s}')]
        out.append((f'arm_{s}', vloft(f'arm_{s}', ARM, chain_centre(pts), n=36, muscles=arm_muscles(x)),
                    lambda p, s=s: _weights([f'clav_{s}', f'uarm_{s}', f'farm_{s}'], arm_weights(p)), None))
        pts = [rest(f'thigh_{s}') + Vector((0, 0, 0.06)), rest(f'thigh_{s}'), rest(f'shin_{s}'), rest(f'foot_{s}')]
        out.append((f'leg_{s}', vloft(f'leg_{s}', LEG, chain_centre(pts), n=40, muscles=leg_muscles(x)),
                    lambda p, s=s: _weights(['pelvis', f'thigh_{s}', f'shin_{s}', f'foot_{s}'], leg_weights(p)),
                    limb_axis(0.105 * x)))
        # the bare foot: heel, arch, the ball and the toes
        ob = loft(f'barefoot_{s}', (0.11 * x, 0.045, 0.045), (0.117 * x, -0.175, 0.016), [
            (0.0, 0.034, 0.04), (0.25, 0.04, 0.042), (0.6, 0.048, 0.03), (0.85, 0.046, 0.02), (1.0, 0.034, 0.012)],
            M['skin'])
        me = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
        bpy.data.objects.remove(ob)
        out.append((f'barefoot_{s}', me, lambda p, s=s: _weights([f'foot_{s}'], np.ones((len(p), 1))), None))
    ears = [blob((0.074 * x, -0.025, 1.645), (0.01, 0.018, 0.026)) for x in (1.0, -1.0)]
    out.append(('skull', blob_mesh('skull', HEAD + ears, res=0.004),
                lambda p: _weights(['head'], np.ones((len(p), 1))), None))
    return out


def _mesh_arrays(me):
    co = coords(me)
    return co, [tuple(f.vertices) for f in me.polygons]


def _union(meshes):
    """One closed surface round every mesh's volume (a voxel remesh)."""
    import bpy
    co, faces, base = [], [], 0
    for me in meshes:
        c, f = _mesh_arrays(me)
        co.append(c)
        faces += [tuple(i + base for i in poly) for poly in f]
        base += len(c)
    src = bpy.data.meshes.new('body_src')
    src.from_pydata(np.concatenate(co).tolist(), [], faces)
    ob = bpy.data.objects.new('body_src', src)
    bpy.context.scene.collection.objects.link(ob)
    mod = ob.modifiers.new('remesh', 'REMESH')
    mod.mode, mod.voxel_size, mod.adaptivity = 'VOXEL', VOXEL, 0.0
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(ob)
    bpy.data.meshes.remove(src)
    return me


def _decimate(me, ratio):
    import bpy
    ob = bpy.data.objects.new('body_dec', me)
    bpy.context.scene.collection.objects.link(ob)
    mod = ob.modifiers.new('decimate', 'DECIMATE')
    mod.ratio = ratio
    out = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(ob)
    bpy.data.meshes.remove(me)
    return out


def _bisect(me, heights):
    """Cut every face crossing each height, so a layer's edge there is a clean ring."""
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(me)
    for z in heights:
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, z), plane_no=(0, 0, 1))
    bm.to_mesh(me)
    bm.free()
    return me


def _smooth(co, edges, w, iters, lam=0.5, mu=-0.53):
    """Taubin smoothing (a shrink and a swell a step), each vertex moved by its own share `w`."""
    n = len(co)
    i, j = edges[:, 0], edges[:, 1]
    deg = np.maximum(np.bincount(i, minlength=n) + np.bincount(j, minlength=n), 1)[:, None]
    for _ in range(iters):
        for f in (lam, mu) if mu else (lam,):
            s = np.stack([np.bincount(i, co[j, a], n) + np.bincount(j, co[i, a], n) for a in range(3)], 1)
            co = co + f * w[:, None] * (s / deg - co)
    return co


def _distances(co, meshes):
    """Each point's distance to each mesh's surface: (points, meshes)."""
    from mathutils.bvhtree import BVHTree
    out = np.zeros((len(co), len(meshes)))
    for k, me in enumerate(meshes):
        c, f = _mesh_arrays(me)
        tree = BVHTree.FromPolygons(c.tolist(), f)
        out[:, k] = [tree.find_nearest(p)[3] for p in co.tolist()]
    return out


def build(M, hand_blobs, rigid, hang, cuts=()):
    """The naked body as one skinned mesh fused from its pieces, and its hands (open, or closed round a grip), rigid on
    the hand joints: (body Skinned, [(hand object, joint)], {side: {'open': ob, 'fist': ob}}). The mesh is cut along
    each of `cuts` (heights at rest), where a layer of armour will end. The body keeps each
    vertex's share of each piece (`alpha`, over PIECES), so the proportions and the armour's patterns follow the
    piece a vertex lies on, blended where pieces meet."""
    import bpy
    pieces = sorted(_pieces(M), key=lambda pc: PIECES.index(pc[0]))
    me = _union([m for _, m, _, _ in pieces])
    co = coords(me)
    edges = np.array([e.vertices[:] for e in me.edges], dtype=np.int64)
    d = _distances(co, [m for _, m, _, _ in pieces])
    two = np.sort(d, axis=1)[:, 1]
    # fill the creases where pieces meet (a plain Laplacian fills a concave crease), then ease the voxels everywhere
    co = _smooth(co, edges, 1 - ramp(two, 0.0, FILLET), 20, mu=0.0)
    co = _smooth(co, edges, np.full(len(co), 0.5), 6)
    me.vertices.foreach_set('co', co.ravel())
    me.update()
    me = _bisect(_decimate(me, DECIMATE), cuts)
    co = coords(me)
    d = _distances(co, [m for _, m, _, _ in pieces])
    a = np.exp(-(d - d.min(axis=1, keepdims=True)) / 0.004)
    alpha = a / a.sum(axis=1, keepdims=True)
    w = sum(alpha[:, k:k + 1] * fn(co) for k, (_, _, fn, _) in enumerate(pieces))
    axes = [ax for _, _, _, ax in pieces]

    def axis(p, alpha=alpha):
        return sum(alpha[:, k:k + 1] * ax(p) for k, ax in enumerate(axes) if ax is not None)
    for _, m, _, _ in pieces:
        bpy.data.meshes.remove(m)
    me.name = 'body'
    me.shade_smooth()
    body = Skinned('body', me, M['skin'], JOINTS, w)
    body.alpha, body.axes = alpha, axes
    parts, hands = [], {}
    for s, x in (('L', 1.0), ('R', -1.0)):
        hands[s] = {}
        for kind, closed in (('open', False), ('fist', True)):
            ob = rigid(f'hand_{s}_{kind}', blob_mesh(f'hand_{s}_{kind}', hand_blobs(x, closed), res=0.004), M['skin'])
            hang(parts, ob, f'hand_{s}')
            hands[s][kind] = ob
    return body, parts, hands


# the bald head: the cranium, the face's mass and the jaw under it, chin, a modest nose and brow, the cheekbones
HEAD = [
    blob((0, -0.03, 1.69), (0.076, 0.094, 0.092)), blob((0, -0.062, 1.625), (0.064, 0.07, 0.07)),
    blob((0, -0.072, 1.575), (0.05, 0.05, 0.035)), blob((0, -0.108, 1.556), (0.022, 0.018, 0.016)),
    blob((0, -0.128, 1.63), (0.009, 0.014, 0.02)), blob((0, -0.112, 1.672), (0.05, 0.014, 0.01)),
    blob((0.045, -0.098, 1.63), (0.018, 0.014, 0.012)), blob((-0.045, -0.098, 1.63), (0.018, 0.014, 0.012)),
]
