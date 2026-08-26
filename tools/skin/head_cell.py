"""Append the baked HEAD cell without rebuilding the body's UVs.

The body baker owns body UVs. This script owns only the head. Older versions
reconstructed every body UV here from an approximate cylinder, which silently
undid improvements made by the body baker and reintroduced the 0.7-depth
distortion. Body UVs are now preserved in pixel space and only renormalized
when the atlas grows to make room for the head.

The head cell ships with geometry-derived shading only - NO ARENA2 - because
the face is a classic sprite and may not be published. Runtime paints the face
into the cell's front arc from the user's own FACE*.CIF.
"""
# Import the sampling/rig definitions, not mvB2's diagnostic preview.
exec(open('mvB2.py').read().split('def render(yaw,CW,CH,sc):')[0])

import math, json
from PIL import Image
import numpy as np

OUT = '/mnt/user-data/outputs'
LAY = json.load(open(f'{OUT}/skin-layout.json'))
old_uv = json.load(open(f'{OUT}/skin-uv.json'))

# IDEMPOTENT. If a head already exists, recover the exact pre-head body atlas
# from the head's recorded x and the body's recorded height. The previous
# "max layout edge + 8" rule moved the head right on every rerun.
HEAD_PAD = 8
if 'head' in LAY:
    old_head = LAY['head']
    base_w = max(1, int(old_head['x']) - HEAD_PAD)
    body = LAY.get('body', {})
    base_h = int(body.get('h', old_uv.get('h', 1)))
    LAY.pop('head')
    Image.open(f'{OUT}/skin-intensity.png').convert('L') \
         .crop((0, 0, base_w, base_h)).save(f'{OUT}/skin-intensity.png')

base = Image.open(f'{OUT}/skin-intensity.png').convert('L')
BW, BH = base.size

hf = [f2 for f2 in F if f2['g'] == 'head']
ys = [f2['p'][i * 3 + 1] for f2 in hf for i in range(4)]
HY0, HY1 = min(ys), max(ys)

# Head profile comes from the REAL loft-ring heights. No empty-bin profile.
per = {}
for f2 in hf:
    for i in range(4):
        x, y, z = f2['p'][i * 3], f2['p'][i * 3 + 1], f2['p'][i * 3 + 2]
        per.setdefault(round(y, 4), []).append((x, z))
_ks = sorted(per)
print(f'head UVs built on {len(_ks)} real ring heights')
_xs = _ks
_vs = [
    (
        (min(a for a, _ in per[y]) + max(a for a, _ in per[y])) / 2,
        (min(b for _, b in per[y]) + max(b for _, b in per[y])) / 2,
        max(1e-3, (max(a for a, _ in per[y]) - min(a for a, _ in per[y])) / 2),
        max(1e-3, (max(b for _, b in per[y]) - min(b for _, b in per[y])) / 2),
    )
    for y in _ks
]

def PROF(y):
    if y <= _xs[0]:
        return _vs[0]
    if y >= _xs[-1]:
        return _vs[-1]
    i = max(j for j in range(len(_xs) - 1) if _xs[j] <= y)
    j = i + 1
    t = (y - _xs[i]) / (_xs[j] - _xs[i])
    t = t * t * (3 - 2 * t)  # smoothstep: C1 across the knots
    return tuple(_vs[i][k] + (_vs[j][k] - _vs[i][k]) * t for k in range(4))

print(f'head: {len(hf)} faces, y {HY0:.3f}..{HY1:.3f}')

# Surface aspect ~2.63:1 and enough rows to avoid throwing away facial detail.
HW, HH = 1344, 512
print(f'head cell {HW}x{HH}')
L = np.array([-0.45, 0.55, 0.70])
L /= np.linalg.norm(L)
cell = np.zeros((HH, HW), dtype=np.uint8)
for ax in range(HW):
    th = (ax + 0.5) / HW * 2 * math.pi - math.pi / 2
    n = np.array([math.cos(th), 0.0, math.sin(th)])
    for ay in range(HH):
        t = (ay + 0.5) / HH
        dome = math.sin(min(1.0, t * 1.15) * math.pi * 0.5)
        nn = np.array([
            n[0] * dome,
            math.cos(min(1.0, t * 1.15) * math.pi * 0.5),
            n[2] * dome,
        ])
        nn /= np.linalg.norm(nn) or 1
        lam = max(0.0, float(nn @ L))
        cell[ay, ax] = int(np.clip(40 + 205 * (0.35 + 0.65 * lam), 0, 255))

NW = BW + HEAD_PAD + HW
NH = max(BH, HH + HEAD_PAD * 2)
out = Image.new('L', (NW, NH), 0)
out.paste(base, (0, 0))
out.paste(Image.fromarray(cell), (BW + HEAD_PAD, HEAD_PAD))
out.save(f'{OUT}/skin-intensity.png')

LAY['head'] = {
    'x': BW + HEAD_PAD, 'y': HEAD_PAD, 'w': HW, 'h': HH,
    'y0': HY0, 'y1': HY1,
    'faceArc': [0.25, 0.75],
    'note': 'front arc is painted at runtime from FACE*.CIF',
}
json.dump(LAY, open(f'{OUT}/skin-layout.json', 'w'), indent=1)
print(f'atlas now {NW}x{NH}')

# Preserve EVERY non-head UV exactly in pixel space. The only change is the
# normalization denominator because the texture got wider/taller.
old_w = float(old_uv['w'])
old_h = float(old_uv['h'])
UV = []
for fi, f2 in enumerate(F):
    g = f2['g']
    for i in range(4):
        if g == 'head':
            px, py, pz = (
                f2['p'][i * 3],
                f2['p'][i * 3 + 1],
                f2['p'][i * 3 + 2],
            )
            c = LAY['head']
            cx, cz, rx, rz = PROF(py)
            # +pi/2 puts u=0.5 on the FRONT and the seam at the back.
            th = (
                math.atan2((pz - cz) / rz, (px - cx) / rx) + math.pi / 2
            ) % (2 * math.pi)
            ax = c['x'] + th / (2 * math.pi) * c['w']
            ay = c['y'] + (c['y1'] - py) / (c['y1'] - c['y0'] + 1e-9) * c['h']
        else:
            off = fi * 8 + i * 2
            # UV origin is bottom-left; convert to top-left pixel coordinates.
            ax = float(old_uv['uv'][off]) * old_w
            ay = (1.0 - float(old_uv['uv'][off + 1])) * old_h

        UV += [round(ax / NW, 7), round(1.0 - ay / NH, 7)]

json.dump({'n': len(F), 'w': NW, 'h': NH, 'uv': UV},
          open(f'{OUT}/skin-uv.json', 'w'))
print('body UVs preserved; head UVs baked; all UVs renormalized for grown atlas')
