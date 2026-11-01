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
import stage  # noqa: E402

CLASS = {'skin': 2, 'boot': 3, 'cloth': 4}   # every other material is 1
DENSITY = 12000.0   # points a square metre: about three a pixel at 62 px a metre
WEIGHTS = {'sil': 0.5, 2: 0.2, 3: 0.2, 4: 0.1}

# what a frame may adjust, by animation: (key, joint, axis, step)
BODY = [('turn', None, 0, 8.0)] + [('rot', j, a, st) for j, a, st in [
    ('pelvis', 0, 5), ('pelvis', 1, 5), ('pelvis', 2, 6), ('spine', 0, 5), ('spine', 2, 6), ('chest', 0, 5),
    ('chest', 2, 6), ('head', 0, 6),
    ('thigh_L', 0, 8), ('thigh_L', 1, 5), ('thigh_L', 2, 8), ('shin_L', 0, 8), ('foot_L', 0, 8),
    ('thigh_R', 0, 8), ('thigh_R', 1, 5), ('thigh_R', 2, 8), ('shin_R', 0, 8), ('foot_R', 0, 8)]]
LEFT_ARM = [('rot', 'uarm_L', 0, 10), ('rot', 'uarm_L', 1, 8), ('rot', 'uarm_L', 2, 8), ('rot', 'farm_L', 0, 10)]
GRIP = [('grip', None, a, 0.04) for a in range(3)] + [('haft', None, a, 0.2) for a in range(3)]
SWING = [('fist', None, a, 0.04) for a in range(2)] + [('head', None, a, 0.06) for a in range(2)]
PARAMS = {'idle': BODY + LEFT_ARM + GRIP, 'walk': BODY + LEFT_ARM + GRIP, 'hurt': BODY + LEFT_ARM + GRIP,
          'attack': BODY + SWING, 'bow': BODY + GRIP}


def class_of(mat):
    return CLASS.get(mat.name.split('.')[0], 1) if mat else 1


def sample(me, rng):
    """Points strewn over a mesh's triangles: (points, triangle vertex indices, barycentres, class)."""
    me.calc_loop_triangles()
    tris = np.array([t.vertices[:] for t in me.loop_triangles], dtype=np.int64)
    mats = np.array([t.material_index for t in me.loop_triangles], dtype=np.int64)
    co = np.array([v.co[:] for v in me.vertices])
    a, b, c = co[tris[:, 0]], co[tris[:, 1]], co[tris[:, 2]]
    area = 0.5 * np.linalg.norm(np.cross(b - a, c - a), axis=1)
    n = np.maximum(1, np.ceil(area * DENSITY)).astype(int)
    idx = np.repeat(np.arange(len(tris)), n)
    u, v = rng.random(len(idx)), rng.random(len(idx))
    flip = u + v > 1
    u[flip], v[flip] = 1 - u[flip], 1 - v[flip]
    bary = np.stack([1 - u - v, u, v], axis=1)
    pts = (bary[:, :, None] * co[tris[idx]]).sum(axis=1)
    cls = np.array([class_of(me.materials[m] if m < len(me.materials) else None) for m in range(max(len(me.materials), 1))])
    return pts, tris[idx], bary, cls[np.minimum(mats[idx], len(cls) - 1)]


class Cloud:
    """The fighter as points, posed as forge.Fighter poses its meshes."""

    def __init__(self, fighter):
        rng = np.random.default_rng(1)
        dg = bpy.context.evaluated_depsgraph_get()
        self.skins = []
        for sk in fighter.skins:
            pts, tri, bary, cls = sample(sk.me, rng)
            w = (bary[:, :, None] * sk.w[tri]).sum(axis=1)
            self.skins.append((pts, w, sk.heads, sk.joints, cls))
        def rigid(ob):
            me = ob.evaluated_get(dg).to_mesh()
            pts, _, _, cls = sample(me, rng)
            return pts, cls
        self.parts = [(rigid(ob), j) for ob, j in fighter.parts if not ob.name.startswith('hand_')]
        self.hands = {s: {k: rigid(ob) for k, ob in kinds.items()} for s, kinds in fighter.hands.items()}
        self.axe = [rigid(ob) for ob in fighter.axe]
        self.bow = [rigid(ob) for ob in fighter.bow]

    def points(self, pose, gear):
        W = {j: np.array(m) for j, m in pose.world().items()}
        out, cls = [], []
        for pts, w, heads, joints, c in self.skins:
            p = np.zeros_like(pts)
            for k, j in enumerate(joints):
                M = W[j]
                p += w[:, k:k + 1] * ((pts - heads[k]) @ M[:3, :3].T + M[:3, 3])
            out.append(p)
            cls.append(c)
        def put(pc, M):
            out.append(pc[0] @ M[:3, :3].T + M[:3, 3])
            cls.append(pc[1])
        for pc, j in self.parts:
            put(pc, W[j])
        fists = gear.get('fist', {})
        for s, kinds in self.hands.items():
            put(kinds['fist' if fists.get(s) else 'open'], W[f'hand_{s}'])
        for key, pcs in (('axe', self.axe), ('bow', self.bow)):
            if gear.get(key) is not None:
                for pc in pcs:
                    put(pc, np.array(gear[key]))
        return np.concatenate(out), np.concatenate(cls)


def project(pts):
    e = math.radians(stage.ELEVATION)
    up = np.array([0, math.sin(e), math.cos(e)])
    fwd = np.array([0, math.cos(e), -math.sin(e)])
    rx, ry = stage.ROOT_PX
    return rx + pts[:, 0] * stage.PX_PER_M, ry - (pts @ up) * stage.PX_PER_M, pts @ fwd


def raster(px, py, depth, cls, canvas, place):
    cw, ch = canvas
    rx, ry = stage.ROOT_PX
    col = np.floor(px - (rx - place[0])).astype(int)
    row = np.floor(py - (ry - place[1])).astype(int)
    ok = (col >= 0) & (col < cw) & (row >= 0) & (row < ch)
    order = np.argsort(-depth[ok], kind='stable')
    img = np.zeros(cw * ch, dtype=np.int8)
    flat = (row[ok] * cw + col[ok])[order]
    img[flat] = cls[ok][order]
    return img.reshape(ch, cw)


def iou(a, b):
    u = (a | b).sum()
    return (a & b).sum() / u if u else None


def score(img, ref):
    total, wsum = 0.0, 0.0
    for key, w in WEIGHTS.items():
        v = iou(img > 0, ref > 0) if key == 'sil' else iou(img == key, ref == key)
        if v is not None:
            total += w * v
            wsum += w
    return total / wsum


def adj_of(params, x):
    adj = {}
    for (key, joint, axis, _), v in zip(params, x):
        if key == 'turn':
            adj['turn'] = float(v)
        elif key == 'rot':
            r = adj.setdefault('rot', {}).setdefault(joint, [0.0, 0.0, 0.0])
            r[axis] = float(v)
        else:
            d = adj.setdefault(key, [0.0] * (2 if key in ('fist', 'head') else 3))
            d[axis] = float(v)
    return adj


def fit_frame(cloud, rec, frame, ref, start_place, dx_free, iters, rng):
    params = PARAMS[rec['anim']]
    steps = np.array([p[3] for p in params] + ([2.0] if dx_free else []))
    yaw = forge.VIEW_YAW[rec['view']]
    ch = rec['canvas'][1]
    low = int(np.nonzero(ref.any(axis=1))[0].max())

    def evaluate(x):
        adj = adj_of(params, x[:len(params)])
        pose, gear = poses.pose_for(rec['anim'], frame, rec['view'], yaw, adj)
        pts, cls = cloud.points(pose, gear)
        px, py, depth = project(pts)
        place_x = start_place[0] + (round(x[-1]) if dx_free else 0)
        place_y = low - int(math.floor(py.max())) + stage.ROOT_PX[1]
        img = raster(px, py, depth, cls, rec['canvas'], (place_x, place_y))
        reg = 0.0006 * float(((x[:len(params)] / steps[:len(params)]) ** 2).sum())
        return score(img, ref) - reg, place_x

    x = np.zeros(len(steps))
    best, place_x = evaluate(x)
    first = best
    sigma = steps.copy()
    for _ in range(iters):
        cands = x + rng.normal(size=(8, len(steps))) * sigma
        results = [evaluate(c) for c in cands]
        k = int(np.argmax([r[0] for r in results]))
        if results[k][0] > best:
            x, (best, place_x) = cands[k], results[k]
            sigma = np.minimum(sigma * 1.15, steps * 2)
        else:
            sigma = np.maximum(sigma * 0.88, steps * 0.03)
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--spec', required=True)
    ap.add_argument('--ref', required=True)
    ap.add_argument('--records', default='')
    ap.add_argument('--iters', type=int, default=220)
    args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])
    spec = json.load(open(args.spec))
    ref = json.load(open(args.ref))
    out_path = args.spec.replace('.json', '-fit.json')
    poses.load_fit(out_path)
    fitted = dict(poses.FIT)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    stage.setup(1)
    cloud = Cloud(forge.Fighter())
    only = {int(r) for r in args.records.split(',') if r != ''}
    rng = np.random.default_rng(7)
    for r, rec in enumerate(spec['records']):
        if only and r not in only:
            continue
        cw, ch = rec['canvas']
        place = list(rec['place'])
        for f in range(rec['frames']):
            refimg = np.array([int(c) for c in ref['records'][r]['frames'][f]], dtype=np.int8).reshape(ch, cw)
            key = f"{rec['anim']}:{rec['view']}:{f}"
            poses.FIT.pop(key, None)
            adj, px, first, best, _ = fit_frame(cloud, rec, f, refimg, place, f == 0, args.iters, rng)
            if f == 0:
                place[0] = px
            fitted[key] = adj
            print(f'record {r} frame {f}: {first:.3f} -> {best:.3f}', flush=True)
        rec['place'] = place
        write_fit(out_path, fitted)
    forge.write_spec(args.spec, spec)


if __name__ == '__main__':
    main()
