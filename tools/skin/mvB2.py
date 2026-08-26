"""Per-limb multi-view sampling.
Each rig group maps into that group's own region of each reference view, so
arm placement can no longer contaminate the torso. armL/armR bind to armA/armB
(low-x / high-x in the view) with the side flip that happens once the figure
turns past a profile.

The rig-side normalization profile is measured ONLY at real authored vertex
ring heights. The old 300-bin profile had far more bins than geometry: empty
bins were nearest-copied into a staircase, so adjacent surface rows could jump
to a different source column even when the underlying mesh was smooth.
"""
import numpy as np, json, math
from PIL import Image

YAWS = [0, 45, 90, 135, 180, 225, 270, 315]
BODY_GROUPS = ('body', 'armL', 'armR', 'legL', 'legR')

SEG = json.load(open('seg.json'))
V = {}
for Y in YAWS:
    im = Image.open(f'view_{Y:03d}.png').convert('RGBA')
    A = np.array(im)
    s = SEG[str(Y)]
    parts = {
        p: {int(r): tuple(v) for r, v in d.items()}
        for p, d in s['parts'].items()
    }
    V[Y] = {
        'rgb': A[:, :, :3],
        'a': A[:, :, 3] > 0,
        'parts': parts,
        'r0': s['r0'],
        'r1': s['r1'],
    }

# The geometry snapshot is the other source input. Landmark anchors are derived
# FROM THIS SAME MESH below; there is no separate lm_rig.json that can silently
# describe yesterday's body.
F = json.load(open('neutral.json'))

# --- which view-side does a rig arm land on? probe it, do not assume ---
# The rig's armL sits at NEGATIVE x. A view at yaw Y rotates the figure, and
# the arm's screen-x is x*cos(Y)+z*sin(Y); with z~0 for a hanging arm that is
# just x*cos(Y), so the side flips exactly when cos(Y) changes sign.
def armside(group, Y):
    c = math.cos(math.radians(Y))
    lowx = (group == 'armL')
    if c < 0:
        lowx = not lowx
    return 'armA' if lowx else 'armB'


print('arm side binding by view:')
for Y in YAWS:
    print(
        f'   yaw {Y:3d}:  armL -> {armside("armL", Y)}'
        f'   armR -> {armside("armR", Y)}'
    )


def legside(group, Y):
    c = math.cos(math.radians(Y))
    lowx = (group == 'legL')
    if c < 0:
        lowx = not lowx
    return 'legA' if lowx else 'legB'


# --- reference landmarks + rig anchors ---
f0 = SEG['0']
REFsh, REFcr, REFr0, REFr1 = (
    f0['shoulder'], f0['crotch'], f0['r0'], f0['r1']
)
m0 = V[0]['a']
runs0 = {
    r: (int(np.where(m0[r])[0].min()), int(np.where(m0[r])[0].max()))
    for r in range(m0.shape[0])
    if m0[r].any()
}
wid0 = {r: runs0[r][1] - runs0[r][0] + 1 for r in runs0}
span = REFr1 - REFr0
neck = min(
    (r for r in runs0 if REFr0 + span * 0.04 < r < REFsh - 4),
    key=lambda r: wid0[r],
)
waist = min(
    range(REFsh + int(span * 0.08), REFcr - 4),
    key=lambda r: wid0[r],
)


def legw(r):
    xs = np.where(m0[r])[0]
    if not len(xs):
        return 999
    return len(xs[xs < (runs0[r][0] + runs0[r][1]) / 2]) or 999


knee = min(
    range(
        REFcr + int((REFr1 - REFcr) * 0.25),
        REFcr + int((REFr1 - REFcr) * 0.60),
    ),
    key=legw,
)

# ONLY unambiguous anchors. They are derived from the SAME neutral.json the
# baker will sample, so changing the rig cannot leave a stale landmark sidecar
# behind. This removes lm_rig.json entirely.
#
# bottom   = actual lowest non-head vertex
# crotch   = highest authored leg vertex (the thigh/pelvis join)
# knee     = narrowest front-view leg ring in the same 25..60% vertical band
#            used to find the reference knee
# torsoTop = highest body-group vertex (the cropped neck/trap source boundary)
non_head_y = [
    float(f2['p'][i * 3 + 1])
    for f2 in F if f2['g'] != 'head'
    for i in range(4)
]
RIGbottom = min(non_head_y)
RIGcrotch = max(
    float(f2['p'][i * 3 + 1])
    for f2 in F if f2['g'] in ('legL', 'legR')
    for i in range(4)
)
RIGtorsoTop = max(
    float(f2['p'][i * 3 + 1])
    for f2 in F if f2['g'] == 'body'
    for i in range(4)
)

# Measure one leg; the pair is symmetric in the neutral rig. Restrict the walk
# to the same fraction of leg height as the reference finder so the ankle/foot
# cannot win merely because they are narrow.
leg_per = {}
for f2 in F:
    if f2['g'] != 'legL':
        continue
    for i in range(4):
        x = float(f2['p'][i * 3])
        y = round(float(f2['p'][i * 3 + 1]), 6)
        leg_per.setdefault(y, []).append(x)

leg_span = RIGcrotch - RIGbottom
knee_hi = RIGcrotch - leg_span * 0.25
knee_lo = RIGcrotch - leg_span * 0.60
knee_rows = []
for y, xs in leg_per.items():
    if knee_lo <= y <= knee_hi and len(xs) >= 2:
        knee_rows.append((max(xs) - min(xs), y))
if not knee_rows:
    raise RuntimeError('neutral.json has no leg rings in the knee search band')
RIGknee = min(knee_rows)[1]

# The reference is cropped at the neck, and its stump runs to the row where
# torso width steps outward. Anchoring torsoTop at row 0 points the upper-trap
# band at a thin sliver and stretches it across the shoulders.
bodyw = {
    int(r): (v[1] - v[0] + 1)
    for r, v in SEG['0']['parts']['body'].items()
}
STUMP = max(
    (bodyw[r + 1] - bodyw[r], r + 1)
    for r in range(0, 60)
    if r in bodyw and r + 1 in bodyw
)[1]
print('stump ends at ref row', STUMP)
ANCH = [
    (RIGbottom, REFr1),
    (RIGknee, knee),
    (RIGcrotch, REFcr),
    (RIGtorsoTop, STUMP),
]
print(
    'rig anchors from neutral.json:',
    {
        'bottom': round(RIGbottom, 4),
        'knee': round(RIGknee, 4),
        'crotch': round(RIGcrotch, 4),
        'torsoTop': round(RIGtorsoTop, 4),
    },
)
print('anchors', [(round(a, 3), b) for a, b in ANCH])


def ymap(y):
    if y <= ANCH[0][0]:
        return ANCH[0][1]
    if y >= ANCH[-1][0]:
        return ANCH[-1][1]
    for i in range(len(ANCH) - 1):
        (a, ra), (b, rb) = ANCH[i], ANCH[i + 1]
        if a <= y <= b:
            return ra + (rb - ra) * (y - a) / (b - a + 1e-9)
    return ANCH[-1][1]


# --- rig geometry + smooth vertex normals ---
acc = {}


def key(p):
    return (round(p[0], 4), round(p[1], 4), round(p[2], 4))


for f2 in F:
    n = f2['n']
    for i in range(4):
        a = acc.setdefault(key(f2['p'][i * 3:i * 3 + 3]), [0.0, 0.0, 0.0])
        a[0] += n[0]
        a[1] += n[1]
        a[2] += n[2]

for k, a in acc.items():
    L = math.hypot(a[0], math.hypot(a[1], a[2])) or 1.0
    acc[k] = [a[0] / L, a[1] / L, a[2] / L]

for f2 in F:
    f2['vn'] = [
        acc[key(f2['p'][i * 3:i * 3 + 3])]
        for i in range(4)
    ]

# --- exact rig extents per GROUP / VIEW, sampled only at REAL ring heights ---
# A procedural loft already tells us exactly where its rows are. Do not invent
# 300 global bins and nearest-fill the empty 90%: that is the same staircase
# failure that was removed from the head pipeline.
EXT = {}
for g in BODY_GROUPS:
    for Yd in YAWS:
        ca, sa = math.cos(math.radians(Yd)), math.sin(math.radians(Yd))
        per = {}
        for f2 in F:
            if f2['g'] != g:
                continue
            for i in range(4):
                x = float(f2['p'][i * 3])
                y = float(f2['p'][i * 3 + 1])
                z = float(f2['p'][i * 3 + 2])
                ky = round(y, 6)
                per.setdefault(ky, []).append(x * ca + z * sa)

        if not per:
            EXT[(g, Yd)] = None
            continue

        kys = sorted(per)
        ys = np.asarray(kys, dtype=float)
        centres = np.asarray(
            [(min(per[y]) + max(per[y])) * 0.5 for y in kys],
            dtype=float,
        )
        half = np.asarray(
            [
                max(1e-4, (max(per[y]) - min(per[y])) * 0.5)
                for y in kys
            ],
            dtype=float,
        )
        EXT[(g, Yd)] = (ys, centres, half)

print(
    'real-ring extents: ' +
    ', '.join(
        f'{g}/{Yd}:{len(EXT[(g, Yd)][0])}'
        for g in BODY_GROUPS
        for Yd in YAWS
        if EXT[(g, Yd)] is not None
    )
)


def extent_at(g, Yd, y):
    """Projected centre + half-width at y, interpolated between real rings."""
    E = EXT.get((g, Yd))
    if E is None:
        return None

    ys, centres, half = E
    if y <= ys[0]:
        return float(centres[0]), float(half[0])
    if y >= ys[-1]:
        return float(centres[-1]), float(half[-1])

    j = int(np.searchsorted(ys, y, side='right'))
    i = j - 1
    dy = float(ys[j] - ys[i])
    t = 0.0 if abs(dy) < 1e-12 else (float(y) - float(ys[i])) / dy
    rc = float(centres[i] + (centres[j] - centres[i]) * t)
    rh = float(half[i] + (half[j] - half[i]) * t)
    return rc, max(1e-4, rh)


def part_for(g, Yd):
    if g == 'body':
        return 'body'
    if g in ('armL', 'armR'):
        return armside(g, Yd)
    return legside(g, Yd)


def sample(g, px, py, pz, nx, nz):
    """Sample the turnaround using exact rig-ring normalization."""
    row = ymap(py)
    phi = math.degrees(math.atan2(-nx, nz)) % 360
    colour = np.zeros(3)
    wsum = 0.0

    for Yd in YAWS:
        facing = math.cos(math.radians(((Yd - phi + 180) % 360) - 180))
        if facing <= 0:
            continue
        w = facing ** 6
        if w < 1e-4:
            continue

        ext = extent_at(g, Yd, py)
        if ext is None:
            continue

        pn = part_for(g, Yd)
        pd = V[Yd]['parts'].get(pn)
        if not pd:
            continue  # arms are absent in profile

        ri = int(round(row))
        if ri not in pd:
            near = [
                r
                for r in (ri - 1, ri + 1, ri - 2, ri + 2, ri - 3, ri + 3)
                if r in pd
            ]
            if not near:
                continue
            ri = near[0]

        c0, c1 = pd[ri]
        sc, sr = (c0 + c1) / 2, max(0.5, (c1 - c0) / 2)
        rc, rh = ext
        xr = px * math.cos(math.radians(Yd)) + pz * math.sin(math.radians(Yd))
        col = int(round(sc + ((xr - rc) / rh) * sr))
        col = (
            min(max(col, c0 + 1), c1 - 1)
            if c1 - c0 > 3
            else min(max(col, c0), c1)
        )

        vv = V[Yd]
        if not vv['a'][ri, col]:
            hit = False
            for d in range(1, 7):
                if col + d <= c1 and vv['a'][ri, col + d]:
                    col += d
                    hit = True
                    break
                if col - d >= c0 and vv['a'][ri, col - d]:
                    col -= d
                    hit = True
                    break
            if not hit:
                continue

        colour += vv['rgb'][ri, col] * w
        wsum += w

    return (colour / wsum) if wsum > 0 else None


# ---------- render ----------
def render(yaw, CW, CH, sc):
    ya = math.radians(yaw)
    cy, sy = math.cos(ya), math.sin(ya)
    zb = np.full((CH, CW), -1e9)
    img = np.zeros((CH, CW, 4), dtype=np.uint8)

    for f2 in F:
        g = f2['g']
        if g == 'head':
            continue
        n = f2['n']
        if (-n[0] * sy + n[2] * cy) <= 0:
            continue

        P = []
        for i in range(4):
            x, y, z = (
                f2['p'][i * 3],
                f2['p'][i * 3 + 1],
                f2['p'][i * 3 + 2],
            )
            vn = f2['vn'][i]
            P.append((
                CW / 2 + (x * cy + z * sy) * sc,
                CH - 8 - y * sc,
                -x * sy + z * cy,
                x, y, z,
                vn[0], vn[1], vn[2],
            ))

        for (A, B, C) in ((0, 1, 2), (0, 2, 3)):
            (
                ax, ay, az, ax3, ay3, az3, an0, an1, an2
            ) = P[A]
            (
                bx, by, bz, bx3, by3, bz3, bn0, bn1, bn2
            ) = P[B]
            (
                cx, cyy, cz, cx3, cy3, cz3, cn0, cn1, cn2
            ) = P[C]
            det = (bx - ax) * (cyy - ay) - (by - ay) * (cx - ax)
            if abs(det) < 1e-9:
                continue

            for py in range(
                max(0, int(min(ay, by, cyy))),
                min(CH - 1, int(math.ceil(max(ay, by, cyy)))) + 1,
            ):
                for px in range(
                    max(0, int(min(ax, bx, cx))),
                    min(CW - 1, int(math.ceil(max(ax, bx, cx)))) + 1,
                ):
                    X = px + 0.5
                    Yp = py + 0.5
                    w0 = ((bx - ax) * (Yp - ay) - (by - ay) * (X - ax)) / det
                    w1 = ((cx - bx) * (Yp - by) - (cyy - by) * (X - bx)) / det
                    w2 = ((ax - cx) * (Yp - cyy) - (ay - cyy) * (X - cx)) / det
                    if w0 < -1e-9 or w1 < -1e-9 or w2 < -1e-9:
                        continue

                    dep = az * w1 + bz * w2 + cz * w0
                    if dep <= zb[py, px]:
                        continue

                    mx = ax3 * w1 + bx3 * w2 + cx3 * w0
                    my = ay3 * w1 + by3 * w2 + cy3 * w0
                    mz = az3 * w1 + bz3 * w2 + cz3 * w0
                    inx = an0 * w1 + bn0 * w2 + cn0 * w0
                    iny = an1 * w1 + bn1 * w2 + cn1 * w0
                    inz = an2 * w1 + bn2 * w2 + cn2 * w0
                    L = math.sqrt(inx * inx + iny * iny + inz * inz) or 1.0
                    inx /= L
                    iny /= L
                    inz /= L
                    c = sample(g, mx, my, mz, inx, inz)
                    if c is None:
                        continue

                    lam = max(
                        0.0,
                        (inx * cy + inz * sy) * -0.40
                        + iny * 0.45
                        + (-inx * sy + inz * cy) * 0.75,
                    )
                    k = 0.80 + 0.20 * lam
                    zb[py, px] = dep
                    img[py, px] = (
                        min(255, int(c[0] * k)),
                        min(255, int(c[1] * k)),
                        min(255, int(c[2] * k)),
                        255,
                    )

    return img


CW, CH, SCL = 110, 220, 110
views = [0, 45, 90, 135, 180]
SS = 3
out = Image.new('RGB', (len(views) * CW * SS + 40, CH * SS + 58), (20, 20, 23))
from PIL import ImageDraw

d = ImageDraw.Draw(out)
for i, yv in enumerate(views):
    im = Image.fromarray(render(yv, CW, CH, SCL)).resize(
        (CW * SS, CH * SS),
        Image.NEAREST,
    )
    out.paste(im, (20 + i * CW * SS, 26))
    d.text((20 + i * CW * SS + 4, 8), f'{yv}\u00b0', fill=(150, 150, 158))
d.text(
    (20, 26 + CH * SS + 8),
    'per-limb multi-view · exact rig-ring profiles · torso top past neck stump',
    fill=(150, 150, 158),
)
out.save('/mnt/user-data/outputs/perlimbB2.png')
print('saved', out.size)
