"""Fit each frame's pose to the classic record it stands in for: the frame's keyed pose is adjusted (joint angles, the
body's turn, the axe's grip) until the forge's body, seen as the camera sees it, covers the record's outline and its
colour regions (skin, boot teal, cloth green) best.

    python -I tools/sprite-forge/fit.py --spec tools/sprite-forge/specs/488.json --ref /tmp/forge-ref-488.json \\
        [--records 0,5] [--iters 220]

The reference (reference.mjs) stays outside the repo. Only the adjustments are written: numbers, beside the spec as
<spec>-fit.json. The body is seen as points strewn over its surfaces, posed and projected as the stage's camera does,
nearest point winning each pixel: no render, so a frame takes seconds."""
import argparse
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
import numpy as np  # noqa: E402

import forge  # noqa: E402
import poses  # noqa: E402
import shape  # noqa: E402
import stage  # noqa: E402

CLASS = {'skin': 2, 'boot': 3, 'cloth': 4, 'haft': 5, 'blade': 5, 'edge': 5, 'wood': 5, 'string': 5}   # else 1
WEIGHTS = {'sil': 0.6, 2: 0.2, 3: 0.2, 4: 0.1, 'axe': 0.25}

# what a frame may adjust, by animation: (key, joint, axis, step)
BODY = [('turn', None, 0, 8.0)] + [('rot', j, a, st) for j, a, st in [
    ('pelvis', 0, 5), ('pelvis', 1, 5), ('pelvis', 2, 6), ('spine', 0, 5), ('spine', 2, 6), ('chest', 0, 5),
    ('chest', 2, 6), ('spine', 1, 4), ('chest', 1, 4), ('neck', 0, 5), ('head', 0, 6), ('head', 2, 8),
    ('clav_L', 1, 4), ('clav_L', 2, 4), ('clav_R', 1, 4), ('clav_R', 2, 4),
    ('thigh_L', 0, 8), ('thigh_L', 1, 5), ('thigh_L', 2, 8), ('shin_L', 0, 8), ('foot_L', 0, 8), ('foot_L', 2, 10),
    ('thigh_R', 0, 8), ('thigh_R', 1, 5), ('thigh_R', 2, 8), ('shin_R', 0, 8), ('foot_R', 0, 8), ('foot_R', 2, 10)]]
LEFT_ARM = [('rot', 'uarm_L', 0, 10), ('rot', 'uarm_L', 1, 8), ('rot', 'uarm_L', 2, 8), ('rot', 'farm_L', 0, 10),
            ('rot', 'hand_L', 0, 12), ('rot', 'hand_L', 2, 12)]
GRIP = [('grip', None, a, 0.04) for a in range(3)] + [('haft', None, a, 0.2) for a in range(3)]
SWING = [('fist', None, a, 0.04) for a in range(2)] + [('head', None, a, 0.06) for a in range(2)]
ROLL = [('roll', None, 0, 20.0), ('slide', None, 0, 0.04), ('elbow_R', None, 0, 15.0)]
SCALARS = ('turn', 'roll', 'slide', 'elbow_L', 'elbow_R')   # adjustments that are one number
PARAMS = {'idle': BODY + LEFT_ARM + GRIP + ROLL, 'walk': BODY + LEFT_ARM + GRIP + ROLL,
          'hurt': BODY + LEFT_ARM + GRIP + ROLL, 'attack': BODY + SWING + ROLL + [('elbow_L', None, 0, 15.0)],
          'bow': BODY + GRIP + [('elbow_R', None, 0, 15.0), ('elbow_L', None, 0, 15.0)]}


def class_of(mat):
    return CLASS.get(mat.name.split('.')[0], 1) if mat else 1


RESTARTS = 1   # searches a frame runs (fit.py --restarts)
MAX_EDGE = 0.03   # metres: a triangle is split until no edge is longer (under 2 px), so three centres an axis test it


def triangles(me, classify, extra=None):
    """A mesh's triangles, split small: (vertices, triangles, class a triangle, per-vertex `extra` interpolated)."""
    me.calc_loop_triangles()
    tris = np.array([t.vertices[:] for t in me.loop_triangles], dtype=np.int64).reshape(-1, 3)
    mats = np.array([t.material_index for t in me.loop_triangles], dtype=np.int64)
    co = np.array([v.co[:] for v in me.vertices], dtype=np.float64).reshape(-1, 3)
    kinds = [classify(me.materials[m] if m < len(me.materials) else None) for m in range(max(len(me.materials), 1))]
    cls = np.array(kinds)[np.minimum(mats, len(kinds) - 1)]
    ex = extra
    for _ in range(8):
        a, b, c = co[tris[:, 0]], co[tris[:, 1]], co[tris[:, 2]]
        long_ = np.maximum.reduce([np.linalg.norm(b - a, axis=1), np.linalg.norm(c - b, axis=1),
                                   np.linalg.norm(a - c, axis=1)]) > MAX_EDGE
        if not long_.any():
            break
        big, keep = tris[long_], tris[~long_]
        n0 = len(co)
        k = len(big)
        mids = [(big[:, 0], big[:, 1]), (big[:, 1], big[:, 2]), (big[:, 2], big[:, 0])]
        co = np.concatenate([co] + [(co[i] + co[j]) / 2 for i, j in mids])
        if ex is not None:
            ex = np.concatenate([ex] + [(ex[i] + ex[j]) / 2 for i, j in mids])
        m01, m12, m20 = n0 + np.arange(k), n0 + k + np.arange(k), n0 + 2 * k + np.arange(k)
        new = np.concatenate([np.stack([big[:, 0], m01, m20], 1), np.stack([m01, big[:, 1], m12], 1),
                              np.stack([m20, m12, big[:, 2]], 1), np.stack([m01, m12, m20], 1)])
        tris = np.concatenate([keep, new])
        cls = np.concatenate([cls[~long_], np.tile(cls[long_], 4)])
    return co, tris, cls, ex


class Cloud:
    """The fighter's triangles, posed as forge.Fighter poses its meshes and laid on the work frame as Cycles samples
    it: a pixel shows the nearest surface over its centre. `set_shape` lays the proportions on."""

    def __init__(self, fighter, classify=class_of):
        dg = bpy.context.evaluated_depsgraph_get()
        self.skins = []
        for sk in fighter.skins:
            co, tris, cls, w = triangles(sk.me, classify, sk.w)
            self.skins.append([sk.ob.name, co, tris, w, sk.heads, sk.joints, cls, co])

        def rigid(ob):
            co, tris, cls, _ = triangles(ob.evaluated_get(dg).to_mesh(), classify)
            return [ob.name, co, tris, cls, co]
        self.parts = [(rigid(ob), j) for ob, j in fighter.parts if not ob.name.startswith('hand_')]
        self.hands = {s: {k: rigid(ob) for k, ob in kinds.items()} for s, kinds in fighter.hands.items()}
        self.axe = [rigid(ob) for ob in fighter.axe]
        self.bow = [rigid(ob) for ob in fighter.bow]
        self.scale = 1.0

    def set_shape(self, S):
        for sk in self.skins:
            sk[7] = shape.transform(sk[0], sk[1], S)
        for pc in [pc for pc, _ in self.parts] + [k for kinds in self.hands.values() for k in kinds.values()] + self.axe:
            pc[4] = shape.transform(pc[0], pc[1], S)
        self.scale = S['scale']

    def mesh(self, pose, gear, W=None):
        """Every posed vertex, triangle (indices into them) and triangle class."""
        W = W or {j: np.array(m) for j, m in pose.world().items()}
        verts, tris, cls = [], [], []
        base = 0

        def add(v, t, c):
            nonlocal base
            verts.append(v)
            tris.append(t + base)
            cls.append(c)
            base += len(v)
        for _, _, t, w, heads, joints, c, co in self.skins:
            p = np.zeros_like(co)
            for k, j in enumerate(joints):
                M = W[j]
                p += w[:, k:k + 1] * ((co - heads[k]) @ M[:3, :3].T + M[:3, 3])
            add(p, t, c)

        def put(pc, M):
            add(pc[4] @ M[:3, :3].T + M[:3, 3], pc[2], pc[3])
        for pc, j in self.parts:
            put(pc, W[j])
        fists = gear.get('fist', {})
        for s, kinds in self.hands.items():
            put(kinds['fist' if fists.get(s) else 'open'], W[f'hand_{s}'])
        for key, pcs in (('axe', self.axe), ('bow', self.bow)):
            if gear.get(key) is not None:
                for pc in pcs:
                    put(pc, np.array(gear[key]))
        return np.concatenate(verts), np.concatenate(tris), np.concatenate(cls)

    def image(self, pose, gear, W=None):
        """The work frame (stage.WORK_W x WORK_H), each pixel the class of the nearest surface over its centre."""
        v, t, c = self.mesh(pose, gear, W)
        px, py, depth = project(v, self.scale)
        return rasterize(px, py, depth, t, c, stage.WORK_W, stage.WORK_H)


def project(pts, scale=1.0):
    e = math.radians(stage.ELEVATION)
    up = np.array([0, math.sin(e), math.cos(e)])
    fwd = np.array([0, math.cos(e), -math.sin(e)])
    rx, ry = stage.ROOT_PX
    k = stage.PX_PER_M * scale
    return rx + pts[:, 0] * k, ry - (pts @ up) * k, pts @ fwd


def rasterize(px, py, depth, tris, cls, w, h):
    x0, x1, x2 = px[tris[:, 0]], px[tris[:, 1]], px[tris[:, 2]]
    y0, y1, y2 = py[tris[:, 0]], py[tris[:, 1]], py[tris[:, 2]]
    lox, hix = np.minimum(np.minimum(x0, x1), x2), np.maximum(np.maximum(x0, x1), x2)
    loy, hiy = np.minimum(np.minimum(y0, y1), y2), np.maximum(np.maximum(y0, y1), y2)
    # the first pixel centre at or past each triangle's low corner; a triangle spans at most three centres an axis
    gx, gy = np.ceil(lox - 0.5) + 0.5, np.ceil(loy - 0.5) + 0.5
    hits_i, hits_z, hits_c = [], [], []
    for dx in range(3):
        for dy in range(3):
            cx, cy = gx + dx, gy + dy
            k = np.nonzero((cx <= hix) & (cy <= hiy))[0]
            if not len(k):
                continue
            ax, ay, bx, by, qx, qy = x0[k], y0[k], x1[k], y1[k], x2[k], y2[k]
            px_, py_ = cx[k], cy[k]
            area = (bx - ax) * (qy - ay) - (qx - ax) * (by - ay)
            w0 = (bx - px_) * (qy - py_) - (qx - px_) * (by - py_)
            w1 = (qx - px_) * (ay - py_) - (ax - px_) * (qy - py_)
            w2 = (ax - px_) * (by - py_) - (bx - px_) * (ay - py_)
            s = np.sign(area)
            ix, iy = (px_ - 0.5).astype(int), (py_ - 0.5).astype(int)
            inside = (area != 0) & (w0 * s >= 0) & (w1 * s >= 0) & (w2 * s >= 0) & (ix >= 0) & (ix < w) & (iy >= 0) & (iy < h)
            if not inside.any():
                continue
            t = tris[k[inside]]
            z = (w0[inside] * depth[t[:, 0]] + w1[inside] * depth[t[:, 1]] + w2[inside] * depth[t[:, 2]]) / area[inside]
            hits_i.append((iy * w + ix)[inside])
            hits_z.append(z)
            hits_c.append(cls[k[inside]])
    img = np.zeros(w * h, dtype=np.int8)
    if hits_i:
        i, z, c = np.concatenate(hits_i), np.concatenate(hits_z), np.concatenate(hits_c)
        order = np.argsort(-z, kind='stable')
        img[i[order]] = c[order]
    return img.reshape(h, w)


def crop(img, canvas, place):
    """The work frame cut to the canvas, the root on `place` (forge.crop's cut)."""
    cw, ch = canvas
    rx, ry = stage.ROOT_PX
    out = np.zeros((ch, cw), dtype=img.dtype)
    x0, y0 = rx - place[0], ry - place[1]
    sx0, sy0 = max(x0, 0), max(y0, 0)
    sx1, sy1 = min(x0 + cw, img.shape[1]), min(y0 + ch, img.shape[0])
    if sx1 > sx0 and sy1 > sy0:
        out[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0] = img[sy0:sy1, sx0:sx1]
    return out


def lowest(img):
    rows = np.nonzero(img.any(axis=1))[0]
    return int(rows.max()) if len(rows) else 0


def iou(a, b):
    u = (a | b).sum()
    return (a & b).sum() / u if u else None


def weapon(sil, held):
    """The weapon as a frame shows it: the silhouette's thin parts (a haft, a bow's limbs) and the blobs off the body's
    core that `held` marks (an axe head). The same test reads the reference, `held` its near-black texels."""
    from scipy import ndimage as ndi
    core = ndi.binary_opening(sil, structure=np.ones((5, 5)))
    lab, n = ndi.label(core)
    if n == 0:
        return np.zeros_like(sil)
    body = ndi.binary_dilation(lab == (np.argmax(ndi.sum(core, lab, range(1, n + 1))) + 1), iterations=1)
    thin = sil & ~ndi.binary_dilation(core, iterations=1)
    blobs = ndi.binary_dilation(core & ~body & held, iterations=1) & sil & ~body
    return thin | blobs | (core & ~body)


def score(img, ref, ref_weapon=None):
    total, wsum = 0.0, 0.0
    for key, w in WEIGHTS.items():
        if key == 'axe':
            if ref_weapon is None:
                continue
            ours = weapon(img > 0, img == 5)
            v = iou(ours, ref_weapon) if (ours.any() or ref_weapon.any()) else None
        else:
            v = iou(img > 0, ref > 0) if key == 'sil' else iou(img == key, ref == key)
        if v is not None:
            total += w * v
            wsum += w
    return total / wsum


def adj_of(params, x):
    adj = {}
    for (key, joint, axis, _), v in zip(params, x):
        if key in SCALARS:
            adj[key] = float(v)
        elif key == 'rot':
            r = adj.setdefault('rot', {}).setdefault(joint, [0.0, 0.0, 0.0])
            r[axis] = float(v)
        else:
            d = adj.setdefault(key, [0.0] * (2 if key in ('fist', 'head') else 3))
            d[axis] = float(v)
    return adj


def vector_of(params, adj):
    """The adjustment `adj` as fit_frame's vector (adj_of's inverse)."""
    out = []
    for key, joint, axis, _ in params:
        if key in SCALARS:
            out.append(adj.get(key, 0.0))
        elif key == 'rot':
            out.append(adj.get('rot', {}).get(joint, [0.0, 0.0, 0.0])[axis])
        else:
            d = adj.get(key)
            out.append(d[axis] if d else 0.0)
    return np.array(out, dtype=np.float64)


def fit_frame(cloud, rec, frame, ref, start_place, dx_free, iters, rng, init=None, ref_weapon=None):
    params = PARAMS[rec['anim']]
    steps = np.array([p[3] for p in params] + ([2.0] if dx_free else []))
    yaw = forge.VIEW_YAW[rec['view']]
    ch = rec['canvas'][1]
    low = int(np.nonzero(ref.any(axis=1))[0].max())

    planted = rec['anim'] in ('idle', 'attack', 'bow') or (rec['anim'] == 'walk' and frame % 2 == 0)

    def evaluate(x):
        adj = adj_of(params, x[:len(params)])
        pose, gear = poses.pose_for(rec['anim'], frame, rec['view'], yaw, adj)
        lift = 0.0
        if planted:   # a standing frame keeps both feet down: the fit may not lift one to cover a stray pixel
            W = pose.world()
            soles = [min((W[f'foot_{s}'] @ p).z for p in poses.SOLE) for s in 'LR']
            lift = max(0.0, max(soles) - 0.04)
        if rec['anim'] == 'bow' and frame < 2:   # drawn, the bow stays near upright: its thin limbs must not buy
            lift += max(0.0, float(np.linalg.norm(adj.get('haft', [0, 0, 0]))) - 0.3)   # pixels by lying flat
        work = cloud.image(pose, gear)
        place_x = start_place[0] + (round(x[-1]) if dx_free else 0)
        place_y = low - lowest(work) + stage.ROOT_PX[1]
        img = crop(work, rec['canvas'], (place_x, place_y))
        reg = 0.0006 * float(((x[:len(params)] / steps[:len(params)]) ** 2).sum()) + 2.0 * lift
        return score(img, ref, ref_weapon) - reg, place_x

    x = np.zeros(len(steps))
    if init:
        x[:len(params)] = vector_of(params, init)
    best, place_x = evaluate(x)
    first = best
    # CMA-ES in units of each parameter's step: it learns which joints move together, where a plain random walk stalls.
    # Started from the frame's last fit, from its bare keys, and (with --restarts) from wider throws round the last fit,
    # the best of them kept: a fit that settled in the wrong valley gets a way out.
    import cma
    xbest = x.copy()
    starts = [(x.copy(), 0.6)]
    if init:
        starts.append((np.zeros(len(steps)), 0.8))
    starts += [(x.copy(), 1.2)] * max(0, RESTARTS - len(starts))
    for x0, sigma in starts[:max(RESTARTS, 1)]:
        es = cma.CMAEvolutionStrategy(np.zeros(len(steps)), sigma, {
            'popsize': 12, 'maxfevals': iters * 12, 'verbose': -9, 'seed': int(rng.integers(1, 2 ** 31)),
            'tolfun': 1e-5})
        while not es.stop():
            zs = es.ask()
            vals = []
            for z in zs:
                v, px = evaluate(x0 + np.asarray(z) * steps)
                vals.append(-v)
                if v > best:
                    best, place_x, xbest = v, px, x0 + np.asarray(z) * steps
            es.tell(zs, vals)
    x = xbest
    return adj_of(params, x[:len(params)]), place_x, first, best, ch


def _round(v):
    if isinstance(v, dict):
        return {k: _round(x) for k, x in sorted(v.items())}
    if isinstance(v, list):
        return [_round(x) for x in v]
    return round(v, 3) if isinstance(v, float) else v


def write_fit(path, fitted):
    rows = ',\n'.join(f'  {json.dumps(k)}: {json.dumps(_round(v))}' for k, v in sorted(fitted.items()))
    with open(path, 'w') as fh:
        fh.write('{\n' + rows + '\n}\n')


_POSED = {}


def frame_score(cloud, rec, f, ref, place, ref_weapon=None):
    """A frame's score under its fitted pose (kept: a shape fit never moves a joint), the feet on the reference's lowest
    row, the best of three places."""
    key = (rec['anim'], rec['view'], f)
    if key not in _POSED:
        pose, gear = poses.pose_for(rec['anim'], f, rec['view'], forge.VIEW_YAW[rec['view']])
        _POSED[key] = (pose, gear, {j: np.array(m) for j, m in pose.world().items()})
    pose, gear, W = _POSED[key]
    work = cloud.image(pose, gear, W)
    place_y = lowest(ref) - lowest(work) + stage.ROOT_PX[1]
    return max(score(crop(work, rec['canvas'], (place[0] + d, place_y)), ref, ref_weapon) for d in (-1, 0, 1))


_JOB = {}


def _shape_of(x):
    """The flat vector `x` back into a shape table, its lists rebuilt."""
    S, i = {}, 0
    for k in _JOB['keys']:
        n = len(shape.DEFAULT[k]) if isinstance(shape.DEFAULT[k], list) else 0
        S[k] = list(x[i:i + n]) if n else float(x[i])
        i += n or 1
    return S


def _shape_value(x):
    cloud, frames = _JOB['cloud'], _JOB['frames']
    cloud.set_shape(_shape_of(x))
    return float(np.mean([frame_score(cloud, rec, f, ref, rec['place'], wpn) for rec, f, ref, wpn in frames]))


def fit_shape(cloud, spec, refs, iters, rng):
    """Fit the proportions over every frame, each frame in its fitted pose; candidates weighed on every core."""
    import multiprocessing
    keys = list(shape.DEFAULT)
    steps, base = [], []
    for k in keys:
        v = shape.SHAPE.get(k, shape.DEFAULT[k])
        if isinstance(shape.DEFAULT[k], list):
            steps += [0.04] * len(shape.DEFAULT[k])
            base += list(v)
        else:
            steps.append(0.02 if k == 'scale' else 0.015 if k.endswith(('_dx', '_dy', '_dz')) else 0.06)
            base.append(v)
    steps, base = np.array(steps), np.array(base, dtype=np.float64)
    weapons = _JOB.get('weapons')
    frames = [(rec, f, refs[r][f], weapons[r][f] if weapons else None)
              for r, rec in enumerate(spec['records']) for f in range(rec['frames'])]
    _JOB.update(cloud=cloud, keys=keys, frames=frames)
    first = _shape_value(base)   # poses every frame once, before the workers fork
    pool = multiprocessing.get_context('fork').Pool(4)
    x, best = base.copy(), first
    import cma
    es = cma.CMAEvolutionStrategy(np.zeros(len(base)), 0.5, {'popsize': 16, 'maxiter': iters, 'verbose': -9,
                                                              'seed': int(rng.integers(1, 2 ** 31))})
    i = 0
    while not es.stop():
        zs = es.ask()
        cands = [base + np.asarray(z) * steps for z in zs]
        vals = pool.map(_shape_value, cands)
        es.tell(zs, [-v for v in vals])
        k = int(np.argmax(vals))
        if vals[k] > best:
            x, best = cands[k], vals[k]
        print(f'shape {i}: {best:.4f}', flush=True)
        i += 1
    pool.close()
    print(f'shape: {first:.4f} -> {best:.4f}', flush=True)
    return _shape_of(x)


def _fit_record(r):
    cloud, spec, refs, iters = _JOB['cloud'], _JOB['spec'], _JOB['refs'], _JOB['iters']
    rec = spec['records'][r]
    rng = np.random.default_rng(7 + r)
    place, adjs, lines = list(rec['place']), {}, []
    for f in range(rec['frames']):
        key = f"{rec['anim']}:{rec['view']}:{f}"
        wpn = _JOB['weapons'][r][f] if _JOB.get('weapons') else None
        adj, px, first, best, _ = fit_frame(cloud, rec, f, refs[r][f], place, f == 0, iters, rng, poses.FIT.get(key), wpn)
        if f == 0:
            place[0] = px
        adjs[key] = adj
        lines.append(f'record {r} frame {f}: {first:.3f} -> {best:.3f}')
    return r, adjs, place, lines


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--spec', required=True)
    ap.add_argument('--ref', required=True)
    ap.add_argument('--records', default='')
    ap.add_argument('--iters', type=int, default=220)
    ap.add_argument('--shape', action='store_true', help='fit the proportions instead of the poses')
    ap.add_argument('--jobs', type=int, default=4)
    ap.add_argument('--restarts', type=int, default=1, help='searches a frame: its last fit, its keys, wider throws')
    args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])
    global RESTARTS
    RESTARTS = args.restarts
    spec = json.load(open(args.spec))
    ref = json.load(open(args.ref))
    out_path = args.spec.replace('.json', '-fit.json')
    poses.load_fit(out_path)
    fitted = dict(poses.FIT)
    shape_path = args.spec.replace('.json', '-shape.json')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    stage.setup(1)
    cloud = Cloud(forge.Fighter())   # built in the default proportions; the fitted ones are laid on the points
    shape.load_shape(shape_path)
    cloud.set_shape(shape.SHAPE)
    refs = [[np.array([int(c) for c in fr], dtype=np.int8).reshape(r['canvas'][1], r['canvas'][0]) for fr in r['frames']]
            for r in ref['records']]
    if all('rgb' in r for r in ref['records']):   # the reference's weapon: thin parts and near-black blobs
        _JOB['weapons'] = [[weapon(img > 0, np.frombuffer(bytes.fromhex(h), dtype=np.uint8).reshape(img.shape + (3,))
                                   .max(axis=2) <= 60) for img, h in zip(imgs, r['rgb'])]
                           for imgs, r in zip(refs, ref['records'])]
    if args.shape:
        shape.write_shape(shape_path, fit_shape(cloud, spec, refs, args.iters, np.random.default_rng(3)))
        return
    only = {int(r) for r in args.records.split(',') if r != ''}
    todo = [r for r in range(len(spec['records'])) if not only or r in only]
    _JOB.update(cloud=cloud, spec=spec, refs=refs, iters=args.iters)
    import multiprocessing
    with multiprocessing.get_context('fork').Pool(args.jobs) as pool:
        for r, adjs, place, lines in pool.imap_unordered(_fit_record, todo):
            spec['records'][r]['place'] = place
            fitted.update(adjs)
            print('\n'.join(lines), flush=True)
            write_fit(out_path, fitted)
    forge.write_spec(args.spec, spec)


if __name__ == '__main__':
    main()
