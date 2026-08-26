"""Bake the body texture onto the ACTUAL paperdoll quads.

The old atlas first collapsed each body group onto an approximate cylinder
(`pz = sin(theta) * radius * 0.7`) and then rebuilt UVs with the same
approximation. That was the wrong direction: neutral.json already contains the
exact quad that will be rendered.

This baker gives every non-head quad its own tiny texture tile. Each texel is
sampled on the exact two triangles of THAT QUAD, so superellipse power, changing
rx/rz, depth offsets, shoulders, hands and feet cannot distort the mapping.
Padding is edge-replicated so nearest filtering never bleeds from a neighbour.

Outputs:
  skin-intensity.png  runtime's recolourable one-channel body texture
  skin-atlas.png      RGB diagnostic of the sampled turnaround
  skin-layout.json    face-atlas metadata (head_cell.py appends the head)
  skin-uv.json        exact per-corner UVs in neutral.json face order
"""
# mvB2 is still the reference-view correspondence layer. Do not execute its
# diagnostic render when importing it as a library.
exec(open('mvB2.py').read().split('def render(yaw,CW,CH,sc):')[0])

import math, json
import numpy as np
from PIL import Image, ImageDraw

BODY_GROUPS = {'body', 'armL', 'armR', 'legL', 'legR'}
TEX = 8                       # useful samples per quad
PAD = 1                       # edge-replicated gutter
STRIDE = TEX + PAD * 2

face_ids = [i for i, f2 in enumerate(F) if f2['g'] in BODY_GROUPS]
cols = max(1, int(math.ceil(math.sqrt(len(face_ids)))))
rows = int(math.ceil(len(face_ids) / cols))
AW, AH = cols * STRIDE, rows * STRIDE

rgb = np.zeros((AH, AW, 4), dtype=np.uint8)
intensity = np.zeros((AH, AW), dtype=np.uint8)
uv = [0.0] * (len(F) * 8)

def rendered_point(q, s, t):
    """Match TRI=[0,1,2,0,2,3] exactly, not a bilinear patch.

    UV square corners are p0=(0,0), p1=(1,0), p2=(1,1), p3=(0,1).
    The viewer splits that square on p0->p2, so the surface position and
    interpolated normal must use the same two affine triangles.
    """
    if s >= t:
        return q[0] * (1.0 - s) + q[1] * (s - t) + q[2] * t
    return q[0] * (1.0 - t) + q[2] * s + q[3] * (t - s)

def fallback_rgb(f2):
    c = f2.get('c')
    if c and len(c) >= 3:
        return np.asarray(c[:3], dtype=float)
    return np.asarray((153.0, 153.0, 153.0))

unresolved = 0
for tile_i, fi in enumerate(face_ids):
    f2 = F[fi]
    g = f2['g']
    P = np.asarray(f2['p'], dtype=float).reshape(4, 3)
    VN = np.asarray(f2.get('vn') or [f2['n']] * 4, dtype=float).reshape(4, 3)
    tile_rgb = np.zeros((TEX, TEX, 3), dtype=np.uint8)

    # Include the exact quad EDGES. Adjacent faces then agree at their shared
    # boundary instead of each edge texel representing a half-texel inward.
    for iy in range(TEX):
        t = iy / (TEX - 1)
        for ix in range(TEX):
            s = ix / (TEX - 1)
            p = rendered_point(P, s, t)
            n = rendered_point(VN, s, t)
            nl = float(np.linalg.norm(n)) or 1.0
            n /= nl

            c = sample(g, float(p[0]), float(p[1]), float(p[2]),
                       float(n[0]), float(n[2]))
            if c is None:
                c = fallback_rgb(f2)
                unresolved += 1
            tile_rgb[iy, ix] = np.clip(np.rint(c), 0, 255).astype(np.uint8)

    # One-texel duplicated gutter: the GPU can hit a tile edge without ever
    # sampling the unrelated face packed beside it.
    padded = np.pad(tile_rgb, ((PAD, PAD), (PAD, PAD), (0, 0)), mode='edge')
    tx = (tile_i % cols) * STRIDE
    ty = (tile_i // cols) * STRIDE
    rgb[ty:ty + STRIDE, tx:tx + STRIDE, :3] = padded
    rgb[ty:ty + STRIDE, tx:tx + STRIDE, 3] = 255

    lum = np.rint(
        0.299 * padded[:, :, 0] +
        0.587 * padded[:, :, 1] +
        0.114 * padded[:, :, 2]
    ).astype(np.uint8)
    intensity[ty:ty + STRIDE, tx:tx + STRIDE] = lum

    # UVs point at INTERIOR texel centres, never at the gutter or atlas edge.
    x0 = tx + PAD + 0.5
    x1 = tx + PAD + TEX - 0.5
    y0 = ty + PAD + 0.5
    y1 = ty + PAD + TEX - 0.5
    corners = (
        (x0 / AW, 1.0 - y0 / AH),  # p0
        (x1 / AW, 1.0 - y0 / AH),  # p1
        (x1 / AW, 1.0 - y1 / AH),  # p2
        (x0 / AW, 1.0 - y1 / AH),  # p3
    )
    for vi, (u, v) in enumerate(corners):
        off = fi * 8 + vi * 2
        uv[off] = round(float(u), 7)
        uv[off + 1] = round(float(v), 7)

layout = {
    'body': {
        'x': 0, 'y': 0, 'w': AW, 'h': AH,
        'mode': 'face-atlas',
        'tile': TEX,
        'pad': PAD,
        'stride': STRIDE,
        'columns': cols,
        'faceCount': len(face_ids),
        'note': 'one triangle-exact tile per rendered body quad',
    },
}

Image.fromarray(rgb, 'RGBA').save('/mnt/user-data/outputs/skin-atlas.png')
Image.fromarray(intensity, 'L').save('/mnt/user-data/outputs/skin-intensity.png')
json.dump(layout, open('/mnt/user-data/outputs/skin-layout.json', 'w'), indent=1)
json.dump({'n': len(F), 'w': AW, 'h': AH, 'uv': uv},
          open('/mnt/user-data/outputs/skin-uv.json', 'w'))

S = 2
pv = Image.fromarray(rgb, 'RGBA').resize((AW * S, AH * S), Image.NEAREST)
out = Image.new('RGB', (pv.width + 20, pv.height + 42), (20, 20, 23))
out.paste(pv, (10, 10), pv)
d = ImageDraw.Draw(out)
d.text((10, pv.height + 18),
       f'exact face atlas · {len(face_ids)} quads · {TEX}x{TEX} each · '
       f'{unresolved}/{len(face_ids) * TEX * TEX} fallback texels',
       fill=(150, 150, 158))
out.save('/mnt/user-data/outputs/skin-atlas-preview.png')

print(f'exact face atlas {AW}x{AH}: {len(face_ids)} quads, {TEX}x{TEX} each')
print(f'fallback texels: {unresolved}/{len(face_ids) * TEX * TEX}')
print('wrote skin-intensity.png, skin-atlas.png, skin-layout.json, skin-uv.json')
