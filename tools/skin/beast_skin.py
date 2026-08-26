"""A smoothed intensity map for the fur and scale races.

The body atlas is baked from a HUMAN turnaround, so it carries human anatomy:
pectorals, abdominals, navel, nipples. Tinting that fur-brown or hide-green
leaves a Khajiit with human skin detail.

For the exact face atlas, blur EACH QUAD TILE independently. Blurring the whole
packed atlas would mix unrelated body faces across tile boundaries. Legacy
group-cell atlases keep the old per-cell path.
"""
import numpy as np, json
from PIL import Image

OUT = '/mnt/user-data/outputs'
I = np.array(Image.open(f'{OUT}/skin-intensity.png').convert('L')).astype(float)
L = json.load(open(f'{OUT}/skin-layout.json'))

def blur(a, s):
    r = max(1, int(s * 3))
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / s) ** 2)
    k /= k.sum()
    b = np.apply_along_axis(
        lambda v: np.convolve(np.pad(v, (r, r), mode='edge'), k, mode='valid'),
        0, a,
    )
    return np.apply_along_axis(
        lambda v: np.convolve(np.pad(v, (r, r), mode='edge'), k, mode='valid'),
        1, b,
    )

out = I.copy()
body = L.get('body', {})

if body.get('mode') == 'face-atlas':
    tile = int(body['tile'])
    pad = int(body['pad'])
    stride = int(body['stride'])
    cols = int(body['columns'])
    count = int(body['faceCount'])
    removed = []

    # 8x8 useful texels: sigma 1.25 removes sub-face anatomy without erasing
    # the face-to-face volume shading that carries the low-poly form.
    for k in range(count):
        x0 = body['x'] + (k % cols) * stride
        y0 = body['y'] + (k // cols) * stride
        sub = I[y0:y0 + stride, x0:x0 + stride]
        if sub.size == 0:
            continue
        sm = blur(sub, 1.25)
        out[y0:y0 + stride, x0:x0 + stride] = sm
        removed.append(np.abs(sub - sm).mean())

    mean = float(np.mean(removed)) if removed else 0.0
    print(f'  body: {count} face tiles smoothed independently; mean removed {mean:5.2f}')
else:
    # Legacy group-cell atlas.
    for g, c in L.items():
        if g == 'head':
            continue
        if not all(k in c for k in ('x', 'y', 'w', 'h')):
            continue
        sub = I[c['y']:c['y'] + c['h'], c['x']:c['x'] + c['w']]
        sm = blur(sub, 5.0)
        out[c['y']:c['y'] + c['h'], c['x']:c['x'] + c['w']] = sm
        d = np.abs(sub - sm)
        print(f'  {g:5s} removed fine detail: mean {d.mean():5.2f}, max {d.max():5.0f}')

Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'L') \
     .save(f'{OUT}/skin-intensity-beast.png')
print('wrote skin-intensity-beast.png')
