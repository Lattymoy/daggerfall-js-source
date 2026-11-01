"""DFO Sprite Forge: render a class sprite archive from the forge's own 3D fighter.

    python -I tools/sprite-forge/forge.py --spec tools/sprite-forge/specs/488.json --out <dir> [--records 0,5]

Needs Blender as a Python module (`pip install bpy==5.2.3`, Python 3.13). Writes `<archive>_<record>-<frame>.png`
for every record and frame the spec names, each at the spec's canvas size with the ground under the body on the
spec's `place` pixel. `--register <ref.json>` (from reference.mjs) sets each record's `place` instead: the pixel that
lays the forge's frames best over the classic record's outlines. `--work` writes the uncropped work renders."""
import argparse
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402

import model  # noqa: E402
import poses  # noqa: E402
import shape  # noqa: E402
import stage  # noqa: E402
from body import coords  # noqa: E402
import materials  # noqa: E402
from materials import palette  # noqa: E402

VIEW_YAW = [0.0, -45.0, -90.0, -135.0, -180.0]   # record k of an animation: the body turned to the viewer's left


class Fighter:
    def __init__(self):
        self.M = palette()
        self.parts, self.skins, self.hands = model.build_body(self.M)
        self.axe = model.build_axe(self.M)
        self.bow = model.build_bow(self.M)
        self.extra = []
        self.shaped()

    def shaped(self):
        """Lay the fitted proportions (shape.py) on every mesh."""
        for sk in self.skins:
            sk.rest = shape.transform(sk.ob.name, sk.rest)
            sk.me.vertices.foreach_set('co', sk.rest.ravel())
            sk.me.update()
        rigid = [ob for ob, _ in self.parts] + self.axe
        for ob in rigid:
            p = shape.transform(ob.name, coords(ob.data))
            ob.data.vertices.foreach_set('co', p.ravel())
            ob.data.update()

    def show(self, obs, on):
        for ob in obs:
            ob.hide_render = not on

    def place(self, pose, gear):
        W = pose.world()
        for ob, j in self.parts:
            ob.matrix_world = W[j]
        for sk in self.skins:
            sk.pose(W)
        fists = gear.get('fist', {})
        for side, kinds in self.hands.items():
            closed = fists.get(side, False)
            kinds['fist'].hide_render = not closed
            kinds['open'].hide_render = closed
        for ob in self.extra:
            bpy.data.objects.remove(ob, do_unlink=True)
        self.extra = []
        axe_m = gear.get('axe')
        self.show(self.axe, axe_m is not None)
        if axe_m is not None:
            for ob in self.axe:
                ob.matrix_world = axe_m
        bow_m = gear.get('bow')
        self.show(self.bow, bow_m is not None)
        if bow_m is not None:
            for ob in self.bow:
                ob.matrix_world = bow_m
            a, b = model.bow_tips()
            a, b = bow_m @ a, bow_m @ b
            nock = gear.get('nock') or (a + b) / 2
            self.extra.append(model.string_mesh(self.M, a, nock, b))
            if gear.get('arrow'):
                tip = Vector(gear['arrow'])
                self.extra.append(model.arrow_mesh(self.M, nock, tip))


def render_frame(fighter, anim, view, frame, tmp):
    pose, gear = poses.pose_for(anim, frame, view, VIEW_YAW[view])
    fighter.place(pose, gear)
    return stage.render_rgba(tmp)


def crop(work, canvas, place):
    """Cut the work render to the canvas, the root pixel landing on `place`."""
    cw, ch = canvas
    px, py = place
    rx, ry = stage.ROOT_PX
    out = np.zeros((ch, cw, 4), dtype=np.uint8)
    x0, y0 = rx - px, ry - py
    sx0, sy0 = max(x0, 0), max(y0, 0)
    sx1, sy1 = min(x0 + cw, work.shape[1]), min(y0 + ch, work.shape[0])
    out[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0] = work[sy0:sy1, sx0:sx1]
    clipped = work[..., 3].sum() - out[..., 3].sum()
    return out, int(clipped // 255)


def write_spec(path, spec):
    rows = ',\n'.join('  ' + json.dumps(r) for r in spec['records'])
    head = {k: v for k, v in spec.items() if k != 'records'}
    text = json.dumps(head, indent=1)[:-2] + ',\n "records": [\n' + rows + '\n ]\n}\n'
    open(path, 'w').write(text)


def best_place(works, outlines, canvas):
    """The canvas pixel for the root that overlaps the classic outlines most (mean IoU over the record's frames)."""
    cw, ch = canvas
    refs = [np.array([c != '0' for c in o], dtype=bool).reshape(ch, cw) for o in outlines]
    masks = [w[..., 3] > 0 for w in works]
    # the feet rest on the canvas's last row, as every classic record's do
    lowest = max(int(np.nonzero(m.any(axis=1))[0].max()) for m in masks)
    best = (-1.0, None)
    for py in [ch - 1 - (lowest - stage.ROOT_PX[1])]:
        for px in range(-cw // 2, cw + cw // 2):
            score = 0.0
            for m, ref in zip(masks, refs):
                pic, _ = crop(np.dstack([m] * 4).astype(np.uint8) * 255, canvas, (px, py))
                ours = pic[..., 3] > 0
                union = (ours | ref).sum()
                score += (ours & ref).sum() / union if union else 0.0
            score /= len(refs)
            if score > best[0]:
                best = (score, (px, py))
    return best


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--spec', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--records', default='')
    ap.add_argument('--work', action='store_true', help='write uncropped work renders')
    ap.add_argument('--register', default='', help='reference outlines from reference.mjs')
    ap.add_argument('--samples', type=int, default=64)
    args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])
    spec = json.load(open(args.spec))
    poses.load_fit(args.spec.replace('.json', '-fit.json'))
    shape.load_shape(args.spec.replace('.json', '-shape.json'))
    materials.load_tint(args.spec.replace('.json', '-colour.json'))
    stage.load_light(args.spec.replace('.json', '-light.json'))
    stage.PX_PER_M *= shape.SHAPE['scale']
    bpy.ops.wm.read_factory_settings(use_empty=True)
    stage.setup(args.samples)
    fighter = Fighter()
    os.makedirs(args.out, exist_ok=True)
    tmp = os.path.join(tempfile.mkdtemp(), 'f.png')
    only = {int(r) for r in args.records.split(',') if r != ''}
    report = []
    ref = json.load(open(args.register)) if args.register else None
    for r, rec in enumerate(spec['records']):
        if only and r not in only:
            continue
        if ref:
            works = [render_frame(fighter, rec['anim'], rec['view'], f, tmp) for f in range(rec['frames'])]
            score, place = best_place(works, ref['records'][r]['frames'], rec['canvas'])
            rec['place'] = list(place)
            print(f'record {r}: place {place}, overlap {score:.3f}')
            continue
        for f in range(rec['frames']):
            work = render_frame(fighter, rec['anim'], rec['view'], f, tmp)
            name = f"{spec['archive']}_{r}-{f}.png"
            if args.work:
                stage.write_png(os.path.join(args.out, name), work)
                continue
            pic, clipped = crop(work, rec['canvas'], rec['place'])
            stage.write_png(os.path.join(args.out, name), pic)
            report.append((name, clipped))
    if ref:
        write_spec(args.spec, spec)
        return
    for name, clipped in report:
        if clipped:
            print(f'{name}: {clipped} px fall outside the canvas')
    print(f'forged {len(report) or "work"} frames into {args.out}')


if __name__ == '__main__':
    main()
