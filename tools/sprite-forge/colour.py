"""Fit each material's colour to the classic record: render frames, find which material each pixel shows, and tint the
material until its pixels' mean colour (in linear light) is the record's mean over the same pixels.

    python -I tools/sprite-forge/colour.py --spec tools/sprite-forge/specs/488.json --ref /tmp/forge-ref-488.json

The reference (reference.mjs, with its `rgb`) stays outside the repo; only the tints are written, beside the spec as
<spec>-colour.json."""
import argparse
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
import numpy as np  # noqa: E402

import fit  # noqa: E402
import forge  # noqa: E402
import materials  # noqa: E402
import poses  # noqa: E402
import shape  # noqa: E402
import stage  # noqa: E402


def linear(c):
    c = np.asarray(c, dtype=np.float64) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def material_map(cloud, rec, f, place):
    pose, gear = poses.pose_for(rec['anim'], f, rec['view'], forge.VIEW_YAW[rec['view']])
    return fit.crop(cloud.image(pose, gear), rec['canvas'], place)


def interior(ids):
    """Pixels whose four neighbours show the same material: the edges, where a render and the points disagree, left out."""
    same = np.ones_like(ids, dtype=bool)
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        same &= np.roll(np.roll(ids, dy, axis=0), dx, axis=1) == ids
    return same & (ids > 0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--spec', required=True)
    ap.add_argument('--ref', required=True)
    ap.add_argument('--rounds', type=int, default=3)
    ap.add_argument('--samples', type=int, default=32)
    args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])
    spec = json.load(open(args.spec))
    ref = json.load(open(args.ref))
    tint_path = args.spec.replace('.json', '-colour.json')
    poses.load_fit(args.spec.replace('.json', '-fit.json'))
    materials.load_tint(tint_path)
    tints = {k: list(v) for k, v in materials.TINT.items()}
    shape.load_shape(args.spec.replace('.json', '-shape.json'))
    stage.PX_PER_M *= shape.SHAPE['scale']
    bpy.ops.wm.read_factory_settings(use_empty=True)
    stage.setup(args.samples)
    fighter = forge.Fighter()
    names = sorted(fighter.M)
    ids_of = {n: i + 1 for i, n in enumerate(names)}
    cloud = fit.Cloud(fighter, classify=lambda m: ids_of.get(m.name.split('.')[0], 0) if m else 0)
    cloud.set_shape(shape.SHAPE)
    cloud.scale = 1.0   # the stage's pixels a metre already carry it
    tmp = os.path.join(tempfile.mkdtemp(), 'c.png')
    frames = [(r, rec, 0) for r, rec in enumerate(spec['records'])]
    for rnd in range(args.rounds):
        ours = {n: [] for n in names}
        theirs = {n: [] for n in names}
        for r, rec, f in frames:
            work = forge.render_frame(fighter, rec['anim'], rec['view'], f, tmp)
            pic, _ = forge.crop(work, rec['canvas'], rec['place'])
            ids = material_map(cloud, rec, f, rec['place'])
            cw, ch = rec['canvas']
            hexes = ref['records'][r]['rgb'][f]
            df = np.array([[int(hexes[i:i + 2], 16), int(hexes[i + 2:i + 4], 16), int(hexes[i + 4:i + 6], 16)]
                           for i in range(0, len(hexes), 6)]).reshape(ch, cw, 3)
            dfa = np.array([c != '0' for c in ref['records'][r]['frames'][f]]).reshape(ch, cw)
            keep = interior(ids) & dfa & (pic[..., 3] > 0)
            for k, n in enumerate(names):
                m = keep & (ids == k + 1)
                if m.any():
                    ours[n].append(linear(pic[m][:, :3]))
                    theirs[n].append(linear(df[m]))
        report = []
        for n in names:
            if not ours[n] or sum(len(a) for a in ours[n]) < 40:
                continue
            a = np.concatenate(ours[n]).mean(axis=0)
            b = np.concatenate(theirs[n]).mean(axis=0)
            factor = np.clip((b + 1e-4) / (a + 1e-4), 0.25, 4.0) ** 0.85
            materials.tint(fighter.M[n], list(factor))
            tints[n] = [round(float(t * g), 4) for t, g in zip(tints.get(n, [1.0, 1.0, 1.0]), factor)]
            report.append(f'{n} {np.abs(a - b).mean():.3f}')
        print(f'round {rnd}: ' + ', '.join(report), flush=True)
        with open(tint_path, 'w') as fh:
            fh.write(json.dumps(dict(sorted(tints.items())), indent=1) + '\n')


if __name__ == '__main__':
    main()
