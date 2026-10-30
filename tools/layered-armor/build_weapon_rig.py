"""LAYERED-WEAPONS: the weapon rig of the layered bodies - where the art's own warhammer is, so the body can hold
another weapon, or none. Writes vendor/layered-armor/weapon/manifest.json and weapon/<body>/<record>-<frame>.png.

The strips draw a warhammer into every walk, attack, hurt and idle frame (records 0-19), the same in all 27 outfits
of a chest-armour family but moved a pixel or two between families. Per frame and family this finds:
  - the hammer's pixels: stable across the family's nine outfits, grey (or the shaft's wood), on the line from the
    grip to the head (the grips are read by eye - GRIPS, +-3 px - and snapped to where the shaft meets the fist);
  - the grip `q`, the head's centre `t`, the head's radius `hr` and the side its face is on (`side`, +-1);
  - the depth along the shaft (`d`: from 16 px behind the grip to 70 px past it, f where the hammer was in front of the
    body, b where the body hid it, ? where it crossed open air);
  - the fill: the shift or mirror that best continues the body round the hole the head leaves (`fill`), or 0.
The PNG is three tiles (leather, chain, plate chest), alpha 255 where the hammer is. The manifest also carries each
metal's colour ramp (16 steps by brightness, from the strips' own metal tiles) for the weapons drawn in its place.

usage: python -I build_weapon_rig.py <repo>/vendor/layered-armor [male:0-0 ...]   (needs numpy, scipy, pillow; frames named
  are rebuilt alone, the rest kept)
"""
import sys, os, json, math
from collections import deque
import numpy as np
from scipy import ndimage as nd
from PIL import Image

V = sys.argv[1]
MAN = json.load(open(f'{V}/manifest.json')); NT = len(MAN['tiles'])
FAMS = ('leather', 'chain', 'plate')
K8 = np.ones((3, 3), bool)
LO, HI = -16, 70   # the depth string's span along the shaft, px from the grip

# The grip (where the shaft leaves the fist, read by eye) and, where the head is not the hammer-grey blob nearest the
# grip's line, its centre; EXTRA: shaft pieces past the fist the trace cannot reach (x0, y0, x1, y1, half-width).
GRIPS = {
    'male': {
        '0-0': (12, 47), '0-1': (11, 43), '0-2': (14, 49), '0-3': (10, 44),
        '1-0': (36, 63), '1-1': (34, 59), '1-2': (39, 64), '1-3': (35, 61),
        '2-0': (46, 61), '2-1': (45, 57), '2-2': (41, 58), '2-3': (45, 60),
        '3-0': (47, 56), '3-1': (50, 57), '3-2': (60, 58), '3-3': (48, 56),
        '4-0': (45, 53), '4-1': (53, 52), '4-2': (58, 53), '4-3': (55, 55),
        '5-0': (56, 26), '5-1': (52, 32), '5-2': (45, 65), '5-3': (91, 79), '5-4': (110, 76), '5-5': (102, 31),
        '6-0': (54, 27), '6-1': (55, 31), '6-2': (41, 63), '6-3': (58, 83), '6-4': (104, 84), '6-5': (90, 29),
        '7-0': (74, 28), '7-1': (63, 30), '7-2': (42, 61), '7-3': (47, 81), '7-4': (70, 69), '7-5': (65, 22),
        '8-0': (76, 25), '8-1': (66, 28), '8-2': (78, 53), '8-3': (38, 84), '8-4': (46, 74), '8-5': (42, 26),
        '9-0': (61, 27), '9-1': (74, 30), '9-2': (76, 72), '9-3': (32, 81), '9-4': (16, 64), '9-5': (29, 29),
        '10-0': (18, 44), '11-0': (24, 50), '12-0': (55, 47), '13-0': (86, 40), '14-0': (84, 46),
        '15-0': (9, 58), '16-0': (29, 51), '17-0': (40, 51), '18-0': (27, 48), '19-0': (44, 49),
    },
    'female': {
        '0-0': (52, 88), '0-1': (54, 79), '0-2': (50, 66), '0-3': (55, 72),
        '1-0': (73, 89), '1-1': (64, 85), '1-2': (61, 87), '1-3': (60, 82),
        '2-0': (75, 89), '2-1': (70, 87), '2-2': (68, 88), '2-3': (67, 86),
        '3-0': (89, 86), '3-1': (88, 86), '3-2': (65, 76), '3-3': (87, 87),
        '4-0': (82, 86), '4-1': (82, 86), '4-2': (78, 86), '4-3': (81, 86),
        '5-0': (66, 26), '5-1': (60, 32), '5-2': (61, 40), '5-3': (93, 66), '5-4': (118, 73), '5-5': (100, 30),
        '6-0': (58, 28), '6-1': (47, 34), '6-2': (38, 68), '6-3': (57, 79), '6-4': (94, 74), '6-5': (73, 28),
        '7-0': (74, 31), '7-1': (72, 30), '7-2': (53, 63), '7-3': (48, 77), '7-4': (84, 70), '7-5': (66, 26),
        '8-0': (90, 31), '8-1': (87, 32), '8-2': (70, 74), '8-3': (48, 82), '8-4': (56, 70), '8-5': (52, 27),
        '9-0': (65, 28), '9-1': (70, 39), '9-2': (67, 68), '9-3': (32, 64), '9-4': (21, 70), '9-5': (29, 35),
        '10-0': (24, 48), '11-0': (42, 46), '12-0': (68, 44), '13-0': (94, 42), '14-0': (92, 46),
        '15-0': (51, 73), '16-0': (57, 77), '17-0': (60, 82), '18-0': (64, 79), '19-0': (73, 78),
    },
}
HEADS = {
    'male': {'5-0': (77, 12), '6-0': (88, 12), '3-3': (55, 62), '7-5': (93, 8), '8-4': (53, 56), '9-3': (33, 87),
             '15-0': (26, 48), '19-0': (55, 61)},
    'female': {'6-0': (82, 16), '8-2': (65, 71), '15-0': (40, 88)},
}
EXTRA = {('male', '6-5'): [(89, 19, 74, 27, 2.0)], ('male', '16-0'): [(27, 57, 24, 66, 3.0), (27, 58, 34, 64, 2.5)],
         ('male', '9-4'): [(15, 65, 17, 79, 1.5)], ('male', '0-0'): [(2, 64, 11, 73)], ('male', '15-0'): [(1, 61, 11, 70)]}
# Front views whose hole is the body's other side, mirrored: the fill copies it, alpha and all.
MIRROR = {('male', '0-0'), ('male', '0-1'), ('male', '0-3'), ('male', '15-0')} | {('female', f'0-{i}') for i in (0, 1, 3)} | {('female', '15-0')}


def combos(body): return sorted(os.listdir(f'{V}/{body}'))
def strip_base(body, combo, rf):
    S = np.array(Image.open(f'{V}/{body}/{combo}/{rf}.png').convert('RGBA'))
    w = S.shape[1] // NT if MAN[body]['outfits'][combo]['plate'] else S.shape[1]
    return S[:, :w]
def hsv(img):
    c = img[..., :3].astype(np.float32) / 255; mx = c.max(-1); mn = c.min(-1)
    return np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0), mx
def skin(L):
    c = L[..., :3].astype(np.float32) / 255; r, g, b = c[..., 0], c[..., 1], c[..., 2]
    mx = c.max(-1); mn = c.min(-1); d = mx - mn
    h = np.where(mx == r, (60 * (g - b) / np.maximum(d, 1e-6)) % 360, 0)
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    return (L[..., 3] > 0) & (mx == r) & (h >= 12) & (h <= 45) & (s >= 0.3) & (mx >= 0.45)
def stable(body, rf, fam, tol=45):
    """Px the family's nine outfits draw alike (summed RGB within tol), and the family's leather-helmet-and-legs picture."""
    cs = [c for c in combos(body) if c.split('_')[1] == fam]
    st = np.stack([strip_base(body, c, rf) for c in cs]); ref = strip_base(body, f'leather_{fam}_leather', rf)
    d = np.abs(st[..., :3].astype(np.int32) - ref[None, ..., :3].astype(np.int32)).sum(-1)
    return ((d <= tol) & (st[..., 3] > 0)).all(axis=0), ref, st
def head_guess(body, rf):
    """The hammer's head when no HEADS entry names it: the thickest grey blob all 27 outfits draw alike."""
    cs = combos(body); st = np.stack([strip_base(body, c, rf) for c in cs]); ref = st[cs.index('leather_leather_leather')]
    d = np.abs(st[..., :3].astype(np.int32) - ref[None, ..., :3].astype(np.int32)).sum(-1)
    agree = ((d <= 45) & (st[..., 3] > 0) & (ref[None, ..., 3] > 0)).mean(axis=0)
    s, v = hsv(ref)
    cand = (agree >= 0.8) & (s < 0.3) & (ref[..., 3] > 0)
    g = nd.binary_closing(cand & (s < 0.2) & (v >= 0.12), K8, iterations=1) & cand
    lab, k = nd.label(g, structure=K8)
    sizes = nd.sum(g, lab, range(1, k + 1)); thick = nd.maximum(nd.distance_transform_edt(g), lab, range(1, k + 1))
    i = int(np.argmax(sizes * np.minimum(thick, 4))) + 1
    ys, xs = np.nonzero(lab == i)
    return float(xs.mean()), float(ys.mean())


def trace(body, rf, fam, cap=16):
    gx, gy = GRIPS[body][rf]
    tx, ty = HEADS[body].get(rf) or head_guess(body, rf)
    stab, L, st = stable(body, rf, fam); H, W = L.shape[:2]; opq = L[..., 3] > 0; sk = skin(L)
    s, _ = hsv(L)
    grey = stab & (s < 0.3) & opq & ~sk
    yy, xx = np.mgrid[0:H, 0:W]
    near = (xx - tx) ** 2 + (yy - ty) ** 2 <= cap ** 2
    lab, _ = nd.label(grey & near, structure=K8)
    cy, cx = np.nonzero(grey & near)
    j = np.argmin((cx - tx) ** 2 + (cy - ty) ** 2); head = lab == lab[cy[j], cx[j]]
    hy, hx = np.nonzero(head); T = (hx.mean(), hy.mean())
    # the shaft: near the grip->head line, the line through the most grey px
    a0 = math.atan2(T[1] - gy, T[0] - gx); D = math.hypot(T[0] - gx, T[1] - gy)
    ys, xs = np.nonzero(grey & ~head); xs = xs.astype(float); ys = ys.astype(float)
    best = (0.0, a0, 0.0)
    for da in np.arange(-25, 25.5, 1.0):
        a = a0 + math.radians(da); ux, uy = math.cos(a), math.sin(a); nx, ny = -uy, ux
        for o in np.arange(-3, 3.5, 0.5):
            px, py = gx + nx * o, gy + ny * o
            t = (xs - px) * ux + (ys - py) * uy; e = np.abs((xs - px) * nx + (ys - py) * ny)
            sc = int(((e <= 0.75) & (t > -2) & (t < D)).sum()) - abs(da) * 0.12 - abs(o) * 0.3
            if sc > best[0]: best = (sc, a, o)
    sc, a, o = best
    if sc < 4: a, o = a0, 0.0
    ux, uy = math.cos(a), math.sin(a); nx, ny = -uy, ux
    px, py = gx + nx * o, gy + ny * o
    shaft = stab & ~sk
    Q = 0.0
    for tt in np.arange(6, -10, -0.5):   # walking from the head side: where the shaft meets the fist
        ix, iy = int(round(px + ux * tt)), int(round(py + uy * tt)); jx, jy = int(round(px + ux * (tt - 0.5))), int(round(py + uy * (tt - 0.5)))
        if not (0 <= ix < W and 0 <= iy < H and 0 <= jx < W and 0 <= jy < H): continue
        if shaft[iy, ix] and not shaft[jy, jx] and opq[jy, jx]: Q = tt - 0.5; break
    t = (xx - px) * ux + (yy - py) * uy; e = np.abs((xx - px) * nx + (yy - py) * ny)
    corridor = (e <= 2.1) & (t >= Q - 16) & (t <= D + 2)
    wood = stab & (e <= 1.6) & (t > Q + 1) & (t <= D)
    butt = grey & (e <= 3.2) & (t < Q - 3) & (t >= Q - 16)
    hr = float(np.hypot(hx - T[0], hy - T[1]).max())
    disc = (xx - T[0]) ** 2 + (yy - T[1]) ** 2 <= min(hr + 1.5, cap) ** 2
    pick = grey | wood
    lab2, k2 = nd.label(pick & (disc | corridor | butt), structure=K8)
    core = head | ((e <= 1.0) & (t >= Q - 16) & (t <= D)) | butt
    m = np.zeros((H, W), bool)
    for i in range(1, k2 + 1):
        p = lab2 == i
        if (p & core).any(): m |= p
    edge_ok = stab & ~sk & (((t > Q + 1) & (e <= 3.2)) | disc)   # the hammer's own shaded edge
    for _ in range(2): m |= nd.binary_dilation(m, K8, 1) & edge_ok
    m &= ~((t >= Q - 6) & (t <= Q + 0.5) & (e <= 3.5))            # the fist round the grip is never the weapon
    for ex in EXTRA.get((body, rf), []):   # a segment (x0, y0, x1, y1, half-width), or a box (x0, y0, x1, y1)
        sx0, sy0, sx1, sy1 = ex[:4]
        if len(ex) == 4: m |= stab & ~sk & (xx >= sx0) & (xx <= sx1) & (yy >= sy0) & (yy <= sy1); continue
        vx, vy = sx1 - sx0, sy1 - sy0; ln = math.hypot(vx, vy); vx, vy = vx / ln, vy / ln
        tt = (xx - sx0) * vx + (yy - sy0) * vy; ee = np.abs((xx - sx0) * -vy + (yy - sy0) * vx)
        m |= stab & ~sk & (tt >= -1) & (tt <= ln + 1) & (ee <= ex[4])
    rest = opq & ~m                                               # a piece left floating is the hammer's too
    lab3, k3 = nd.label(rest, structure=K8)
    if k3 > 1:
        sizes = nd.sum(rest, lab3, range(1, k3 + 1)); big = int(np.argmax(sizes)) + 1
        for i in range(1, k3 + 1):
            if i != big and sizes[i - 1] <= 30 and (nd.binary_dilation(m, K8, 3) & (lab3 == i)).any(): m |= lab3 == i
    # each outfit cleaned the head's rim on its own (a plate helmet's frames draw it a px wider, with gaps): the head's
    # px take two more round them, and the holes inside it
    anyop = (st[..., 3] > 0).any(axis=0)
    for _ in range(2): m |= nd.binary_dilation(m, K8, 1) & disc & anyop & ~sk
    m |= nd.binary_fill_holes(m) & disc
    q = (px + ux * Q, py + uy * Q)
    # the face: the head reaches further on the spike's side
    vv = (hx - T[0]) * nx + (hy - T[1]) * ny
    side = 1 if abs(vv.min()) >= abs(vv.max()) else -1
    return dict(m=m, L=L, st=st, q=q, t=T, hr=hr, side=side)


def body_side(img, m):
    """Which mask px the body was behind (nearest outside px opaque) - the runtime's own rule (layeredWeapon.js)."""
    H, W = m.shape; src = -np.ones((H, W), np.int8); q = deque()
    for y, x in zip(*np.nonzero(m)):
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                Y, X = y + dy, x + dx
                if src[y, x] < 0 and 0 <= Y < H and 0 <= X < W and not m[Y, X]:
                    src[y, x] = 1 if img[Y, X, 3] else 0; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            Y, X = y + dy, x + dx
            if 0 <= Y < H and 0 <= X < W and m[Y, X] and src[Y, X] < 0: src[Y, X] = src[y, x]; q.append((Y, X))
    return m & (src == 1)
def exemplar(imgs, m, R=16, worst=220, mirror=False):
    """The copy that best continues the body round the hole, over the family's outfits: [0, dx, dy] a shift - or 0 when
    none continues it well enough (the runtime then smooths the hole). `mirror` (MIRROR's front views): [1, c, dy], the
    body's other side about x = c, whatever it costs."""
    H, W = m.shape
    bp = body_side(imgs[0], m)
    if bp.sum() < 6 and not mirror: return 0
    if mirror: bp = m
    ring = nd.binary_dilation(bp, K8, 2) & ~m
    ys, xs = np.nonzero(ring); hy, hx = np.nonzero(bp)
    opq = [im[..., 3] > 0 for im in imgs]
    cx0 = int(np.nonzero(opq[0])[1].mean())
    cands = [] if mirror else [(0, dx, dy) for dx in range(-R, R + 1) for dy in range(-R, R + 1) if abs(dx) + abs(dy) >= 3]
    if mirror: cands = [(1, c, dy) for c in range(cx0 - 12, cx0 + 13) for dy in range(-4, 5)]
    best = None
    for mode, a, dy in cands:
        if mode == 0: sx, sy, tx, ty = xs + a, ys + dy, hx + a, hy + dy
        else: sx, sy, tx, ty = 2 * a - xs, ys + dy, 2 * a - hx, hy + dy
        okr = (sx >= 0) & (sx < W) & (sy >= 0) & (sy < H)
        inside = (tx >= 0) & (tx < W) & (ty >= 0) & (ty < H)
        if not mirror and (not inside.all() or m[ty, tx].any()): continue
        if mirror and (inside.mean() < 0.6 or m[ty[inside], tx[inside]].mean() > 0.25): continue
        cost = 0.0; bad = 0
        for im, o in zip(imgs, opq):
            if not mirror: bad += int((~o[ty, tx]).sum())
            d = np.abs(im[ys[okr], xs[okr], :3].astype(np.int32) - im[sy[okr], sx[okr], :3].astype(np.int32)).sum(-1)
            cost += d.mean() + 400 * (1 - okr.mean())
        cost = cost / len(imgs) + bad * 6
        if best is None or cost < best[0]: best = (cost, mode, a, dy)
    return [best[1], best[2], best[3]] if best and (mirror or best[0] <= worst) else 0
def depth(g, lo=LO, hi=HI):
    (qx, qy), (tx, ty), m, L = g['q'], g['t'], g['m'], g['L']; H, W = m.shape
    D = math.hypot(tx - qx, ty - qy) or 1.0; ux, uy = (tx - qx) / D, (ty - qy) / D; nx, ny = -uy, ux
    out = []
    for t in range(lo, hi + 1):
        k = '?'
        for s in (0, -1, 1):
            x, y = int(round(qx + ux * t + nx * s)), int(round(qy + uy * t + ny * s))
            if 0 <= x < W and 0 <= y < H:
                if m[y, x]: k = 'f'; break
                if L[y, x, 3] and k == '?': k = 'b'
        out.append(k)
    return ''.join(out)


def ramps():
    """Each plate metal's colours by brightness, 16 steps: the mean colour of the strips' metal px in each band."""
    out = {}
    sample = [c for c in combos('male') if c.startswith('plate_plate')][:1] + [c for c in combos('female') if c.startswith('plate_plate')][:1]
    for metal in MAN['metals']:
        tile = 2 + MAN['metals'].index(metal); px = []
        for body, combo in (('male', sample[0]), ('female', sample[1])):
            for rf in ('2-0', '7-2', '15-0', '0-1'):
                S = np.array(Image.open(f'{V}/{body}/{combo}/{rf}.png').convert('RGBA')); w = S.shape[1] // NT
                T = S[:, tile * w:(tile + 1) * w]; px.append(T[T[..., 3] > 0][:, :3])
        px = np.concatenate(px).astype(np.float32)
        lum = px @ np.array([0.299, 0.587, 0.114], np.float32)
        lo, hi = np.percentile(lum, 2), np.percentile(lum, 98)
        steps = []
        for i in range(16):
            a = lo + (hi - lo) * i / 16; b = lo + (hi - lo) * (i + 1) / 16
            sel = px[(lum >= a) & (lum <= b)]
            steps.append([int(round(v)) for v in (sel.mean(0) if len(sel) else (steps[-1] if steps else [a, a, a]))])
        out[metal] = steps
    return out


def main(only=None):
    """Every frame, or (`only`: ['male:0-0', ...]) those alone, the rest kept from the manifest on disk."""
    os.makedirs(f'{V}/weapon/male', exist_ok=True); os.makedirs(f'{V}/weapon/female', exist_ok=True)
    had = json.load(open(f'{V}/weapon/manifest.json')) if only else None
    rig = {'span': [LO, HI], 'families': list(FAMS), 'ramps': ramps()}
    for body in ('male', 'female'):
        frames = {}; lengths = []
        for rf in sorted(GRIPS[body], key=lambda k: tuple(map(int, k.split('-')))):
            if only and f'{body}:{rf}' not in only:
                frames[rf] = had[body]['frames'][rf]
                lengths += [math.hypot(p['t'][0] - p['q'][0], p['t'][1] - p['q'][1]) for p in frames[rf]]
                continue
            per = []; tiles = []
            for fam in FAMS:
                g = trace(body, rf, fam)
                fam_imgs = [g['st'][i] for i in range(g['st'].shape[0])]
                per.append({'q': [round(g['q'][0], 1), round(g['q'][1], 1)], 't': [round(g['t'][0], 1), round(g['t'][1], 1)],
                            'hr': round(g['hr'], 1), 'side': g['side'], 'd': depth(g), 'fill': exemplar(fam_imgs, g['m'], mirror=(body, rf) in MIRROR)})
                lengths.append(math.hypot(g['t'][0] - g['q'][0], g['t'][1] - g['q'][1]))
                tile = np.zeros(g['m'].shape + (4,), np.uint8); tile[g['m']] = 255; tiles.append(tile)
            Image.fromarray(np.concatenate(tiles, axis=1)).save(f'{V}/weapon/{body}/{rf}.png', optimize=True)
            frames[rf] = per
            print(body, rf, [p['fill'] for p in per])
        rig[body] = {'len': round(float(np.percentile(lengths, 95)), 1), 'frames': frames}
    with open(f'{V}/weapon/manifest.json', 'w') as f: json.dump(rig, f, separators=(',', ':'))
    print('weapon rig written')


if __name__ == '__main__':
    main(sys.argv[2:] or None)
