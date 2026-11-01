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


def srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055) * 255


def gather(fighter, cloud, frames, spec, ref, names, tmp):
    """Each frame's pixels by material: (material index a pixel, ours linear, reference linear)."""
    ids_all, ours_all, theirs_all = [], [], []
    for r, rec, f in frames:
        work = forge.render_frame(fighter, rec['anim'], rec['view'], f, tmp)
        pic, _ = forge.crop(work, rec['canvas'], rec['place'])
        ids = material_map(cloud, rec, f, rec['place'])
        cw, ch = rec['canvas']
        hexes = ref['records'][r]['rgb'][f]
        df = np.frombuffer(bytes.fromhex(hexes), dtype=np.uint8).reshape(ch, cw, 3)
        dfa = np.array([c != '0' for c in ref['records'][r]['frames'][f]]).reshape(ch, cw)
        keep = interior(ids) & dfa & (pic[..., 3] > 0)
        ids_all.append(ids[keep])
        ours_all.append(linear(pic[keep][:, :3]))
        theirs_all.append(linear(df[keep]))
    return np.concatenate(ids_all), np.concatenate(ours_all), np.concatenate(theirs_all)


def residual(ids, ours, theirs):
    """The colour left over once each material takes its best scale a channel: mean absolute difference, 0-255."""
    out = np.zeros_like(ours)
    for m in np.unique(ids):
        k = ids == m
        o, t = ours[k], theirs[k]
        sc = np.clip((o * t).sum(axis=0) / np.maximum((o * o).sum(axis=0), 1e-9), 0.2, 5.0)
        out[k] = o * sc
    return float(np.abs(srgb(out) - srgb(theirs)).mean())


def fit_light(fighter, cloud, spec, ref, names, tmp, iters):
    frames = [(r, spec['records'][r], 0) for r in (0, 2, 4, 5, 7, 9, 15, 17, 19, 22)]
    keys = [('key', 0), ('key', 1), ('key', 2), ('key', 3), ('fill', 3), ('top', 3), ('world', None)]
    steps = np.array([0.25, 0.25, 0.25, 1.0, 0.3, 0.4, 0.3])

    def light_of(x):
        L = json.loads(json.dumps(stage.LIGHT))
        for (k, i), v in zip(keys, x):
            if i is None:
                L[k] = float(max(v, 0.0))
            else:
                L[k][i] = float(max(v, 0.0) if i == 3 else v)
        return L

    def value(x):
        stage.set_lights(light_of(x))
        return residual(*gather(fighter, cloud, frames, spec, ref, names, tmp))
    x = np.array([stage.LIGHT[k][i] if i is not None else stage.LIGHT[k] for k, i in keys], dtype=np.float64)
    rng = np.random.default_rng(5)
    best = first = value(x)
    sigma = steps.copy()
    for it in range(iters):
        c = x + rng.normal(size=len(x)) * sigma
        v = value(c)
        if v < best:
            x, best = c, v
            sigma = np.minimum(sigma * 1.3, steps * 2)
        else:
            sigma = np.maximum(sigma * 0.9, steps * 0.05)
        print(f'light {it}: {best:.2f}', flush=True)
    print(f'light: {first:.2f} -> {best:.2f}', flush=True)
    stage.set_lights(light_of(x))
    return light_of(x)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--spec', required=True)
    ap.add_argument('--ref', required=True)
    ap.add_argument('--rounds', type=int, default=3)
    ap.add_argument('--samples', type=int, default=32)
    ap.add_argument('--light', type=int, default=0, help='first fit the lights for this many tries')
    args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])
    spec = json.load(open(args.spec))
    ref = json.load(open(args.ref))
    tint_path = args.spec.replace('.json', '-colour.json')
    poses.load_fit(args.spec.replace('.json', '-fit.json'))
    materials.load_tint(tint_path)
    tints = {k: list(v) for k, v in materials.TINT.items()}
    shape.load_shape(args.spec.replace('.json', '-shape.json'))
    stage.PX_PER_M *= shape.SHAPE['scale']
    light_path = args.spec.replace('.json', '-light.json')
    stage.load_light(light_path)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    stage.setup(args.samples)
    fighter = forge.Fighter()
    names = sorted(fighter.M)
    ids_of = {n: i + 1 for i, n in enumerate(names)}
    cloud = fit.Cloud(fighter, classify=lambda m: ids_of.get(m.name.split('.')[0], 0) if m else 0)
    cloud.set_shape(shape.SHAPE)
    cloud.scale = 1.0   # the stage's pixels a metre already carry it
    tmp = os.path.join(tempfile.mkdtemp(), 'c.png')
    if args.light:
        L = fit_light(fighter, cloud, spec, ref, names, tmp, args.light)
        with open(light_path, 'w') as fh:
            fh.write(json.dumps(L, indent=1) + '\n')
    frames = [(r, rec, 0) for r, rec in enumerate(spec['records'])]
    for rnd in range(args.rounds):
        ours = {n: [] for n in names}
        theirs = {n: [] for n in names}
        for r, rec, f in frames:
            work = forge.render_frame(fighter, rec['anim'], rec['view'], f, tmp)
            pic, _ = forge.crop(work, rec['canvas'], rec['place'])
            ids = material_map(cloud, rec, f, rec['place'])
            cw, ch = rec['canvas']
            df = np.frombuffer(bytes.fromhex(ref['records'][r]['rgb'][f]), dtype=np.uint8).reshape(ch, cw, 3)
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
