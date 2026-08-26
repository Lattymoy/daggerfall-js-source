"""Derive each face's body ramp FROM its own head.

The head is the authority on skin tone: it carries the artist's actual colour.
Sample the head's skin across its luminance range to build a 16-step ramp, and
the body's intensity map then runs through it - so the neck matches the jaw.
"""
import numpy as np, json
from PIL import Image

N = 16
OUT = '/mnt/user-data/outputs'

# Read the body's intensity DISTRIBUTION once. A face atlas has replicated
# gutters around every quad; those gutters are for GPU safety, not extra body
# area, so exclude them from the histogram or they bias the percentile map.
I = np.array(Image.open(f'{OUT}/skin-intensity.png').convert('L'))
L = json.load(open(f'{OUT}/skin-layout.json'))
bc = L['body']
if bc.get('mode') == 'face-atlas':
    tile = int(bc['tile'])
    pad = int(bc['pad'])
    stride = int(bc['stride'])
    cols = int(bc['columns'])
    count = int(bc['faceCount'])
    samples = []
    for k in range(count):
        x0 = bc['x'] + (k % cols) * stride + pad
        y0 = bc['y'] + (k // cols) * stride + pad
        samples.append(I[y0:y0 + tile, x0:x0 + tile].ravel())
    bi = np.concatenate(samples) if samples else np.array([], dtype=np.uint8)
else:
    bi = I[bc['y']:bc['y'] + bc['h'], bc['x']:bc['x'] + bc['w']].ravel()
bi = bi[bi > 0]

out = {}
for f in range(1, 11):
    c = np.array(Image.open(f'heads/cell_{f}.png').convert('RGB')).astype(float)
    W = c.shape[1]
    H = c.shape[0]

    # SAMPLE THE WHOLE FRONT SECTOR. Measured across all 80 faces: a single
    # nose box disagrees with its own head 13 times, four small boxes twice,
    # the whole lit sector once. Paint, a hood or an ornament can fill a small
    # box; none of them fill the sector.
    face = c[int(H * 0.12):int(H * 0.86), int(W * 0.38):int(W * 0.62)]
    lum = 0.3 * face[:, :, 0] + 0.59 * face[:, :, 1] + 0.11 * face[:, :, 2]
    ref = np.median(lum)

    # Reject on HUE as well as brightness. An eye or a specular highlight is
    # skin-bright but not skin-coloured. Normalize colour by luminance and
    # compare against the sector's own median hue.
    _n = face / np.maximum(lum[:, :, None], 1.0)
    _med = np.array([np.median(_n[:, :, k]) for k in range(3)])
    _hue = np.abs(_n - _med).sum(axis=2)

    # Widen until the sample is big enough rather than skipping the face.
    sel = None
    for _tol in (0.18, 0.26, 0.36, 9.9):
        sel = (lum > ref * 0.45) & (lum < ref * 1.75) & (_hue < _tol)
        if sel.sum() >= 1500:
            break

    px = face[sel]
    pl = lum[sel]
    if len(px) < 200:
        continue

    order = np.argsort(pl)
    px = px[order]

    # HISTOGRAM MATCHED, not evenly sampled. ramp[i] is the face's skin at the
    # percentile body-intensity i actually occupies.
    qs = [float((bi <= (k / (N - 1)) * 255).mean() * 100) for k in range(N)]
    qs = [min(97.0, max(3.0, q)) for q in qs]
    ramp = []
    for q in qs:
        i = int(len(px) * q / 100)
        i = min(max(i, 0), len(px) - 1)
        w = max(1, len(px) // 40)
        ramp.append([
            float(np.median(px[max(0, i - w):i + w + 1, k]))
            for k in range(3)
        ])

    ramp = np.array(ramp)
    _l = 0.30 * ramp[:, 0] + 0.59 * ramp[:, 1] + 0.11 * ramp[:, 2]
    ramp = ramp[np.argsort(_l)]

    # Guarantee per-channel monotonicity; widening hue tolerance must never
    # reintroduce a shadow-lighter-than-highlight reversal.
    ramp = np.maximum.accumulate(ramp, axis=0)

    # Extend the dark end so shadowed body geometry has somewhere to go.
    ramp[0] = ramp[0] * 0.55
    ramp[1] = ramp[1] * 0.75

    out[f - 1] = [[int(round(v)) for v in row] for row in ramp]
    print(f'face {f - 1}: ramp {out[f - 1][0]} .. {out[f - 1][-1]}')

json.dump(out, open(f'{OUT}/breton-skin-ramps.json', 'w'), indent=1)
print(f'\n{len(out)} ramps written')
