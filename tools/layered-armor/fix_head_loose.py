"""WORN-ARMOUR: loose px and gaps around the female's head, every frame and outfit, with and without a cloak.

Two modes:

  strips <frames> <repo>/vendor/layered-armor
      The body strips (no cloak). In every frame and outfit, a piece not joined to the figure (8-connected) of at most
      20 px within 12 px of the head (the cloak's hood tile marks where the head is) goes from every tile of the strip:
      the cut-off tips of the helmets' crests and horns, single specks beside the head. The bow pose's drawn arrow (one
      row, 6 px or longer) stays. In 9-5 the hammer handle's loose edge (a 1 px black line 5 px off the handle) goes too.
      <frames> is compose_all.mjs's output (no-hood, every metal) - it says which px are loose.

  hooded <frames> <repo>/vendor/layered-armor
      The hooded frames (<frames>/female/with-hood, in place - run on a copy, before build_hoodfix.mjs). In every frame:
      - a gap under the hood (a plate or chain helmet's trim cleared the neck and shoulder beside it, so the hood floats
        - 17-0 has it cut off whole): every px within 3 px of the hood the outfit leaves empty and the same outfit with
        a leather helmet draws comes from that picture (cloth px marked in <frames>/female/clothmask so they dye);
      - then the loose pieces by the head go, as above.

usage: python -I fix_head_loose.py strips|hooded <frames> <repo>/vendor/layered-armor
"""
import os, sys, re, json, collections
import numpy as np
from PIL import Image
from scipy import ndimage as nd

MODE, SRC, V = sys.argv[1], sys.argv[2], sys.argv[3]
rd = lambda p: np.array(Image.open(p).convert('RGBA'))
man = json.load(open(f'{V}/manifest.json')); cman = json.load(open(f'{V}/cloak/manifest.json'))
NT = len(man['tiles']); FRAMES = cman['female']['frames']
MAXPX, NEAR = 20, 12
STRIPE_STRIP = {'9-5': [(36, y) for y in range(26, 32)] + [(35, 32)]}   # (x, y): the handle's loose edge, no cloak
fam = lambda x: x if x in ('leather', 'chain') else 'plate'
st = collections.Counter()

near, ring, hoodA, capeA, tile_cloth = {}, {}, {}, {}, {}
for rf in FRAMES:
    cs = rd(f'{V}/cloak/female/{rf}.png'); cw = cs.shape[1] // 7
    hoodA[rf] = cs[:, cw:2 * cw, 3] > 0; capeA[rf] = cs[:, :cw, 3] > 0
    near[rf] = nd.binary_dilation(hoodA[rf], iterations=NEAR) if hoodA[rf].any() else hoodA[rf]
    ring[rf] = nd.binary_dilation(hoodA[rf], iterations=3) if hoodA[rf].any() else hoodA[rf]


def is_cloth(c):   # layeredArmor.js isCloth
    r, g, b = [c[..., i].astype(float) for i in range(3)]
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b); d = mx - mn
    with np.errstate(all='ignore'):
        h = np.where(mx == r, 60 * (g - b) / d, np.where(mx == g, 120 + 60 * (b - r) / d, np.nan))
        h = np.where(h < 0, h + 360, h)
        ok = (d > 0) & (mx >= 31) & ((d / np.maximum(mx, 1)) >= 0.15) & ~np.isnan(h)
    return ok & (h >= 60) & (h <= 165)


for rf in FRAMES:
    cs = rd(f'{V}/cloak/female/{rf}.png'); cw = cs.shape[1] // 7
    tile_cloth[rf] = (hoodA[rf] & is_cloth(cs[:, cw:2 * cw])) | (capeA[rf] & is_cloth(cs[:, :cw]))


def loose(op, rf):
    """the loose pieces by the head: <= MAXPX px, not joined to the figure, within NEAR px of the head, not an arrow"""
    out = np.zeros_like(op)
    lab, k = nd.label(op, structure=np.ones((3, 3)))
    if k < 2: return out
    sz = nd.sum(op, lab, range(1, k + 1)); big = int(sz.argmax()) + 1
    for i, s in enumerate(sz, 1):
        if i == big or s > MAXPX: continue
        m = lab == i
        if not (m & near[rf]).any(): continue
        ys, xs = np.nonzero(m)
        if ys.max() == ys.min() and xs.max() - xs.min() + 1 >= 6: continue   # the drawn arrow
        out |= m
    return out


def both_sides(m, k):
    def reach(dy, dx):
        r = np.zeros_like(m)
        for s in range(1, k + 1): r |= np.roll(m, (dy * s, dx * s), (0, 1))
        return r
    return (reach(1, 0) & reach(-1, 0)) | (reach(0, 1) & reach(0, -1))


def outfits(kind):
    d = f'{SRC}/female/{kind}'
    for fo in sorted(os.listdir(d)):
        h, t, l = re.match(r'^(\w+)-helm_(\w+)-chest_(\w+)-legs$', fo).groups()
        yield fo, (h, t, l), '_'.join(fam(x) for x in (h, t, l))


if MODE == 'strips':
    by_combo = collections.defaultdict(list)
    for fo, parts, combo in outfits('no-hood'): by_combo[combo].append(fo)
    for combo, fos in sorted(by_combo.items()):
        for rf in FRAMES:
            R = np.zeros(hoodA[rf].shape, bool)
            for fo in fos:
                A = rd(f'{SRC}/female/no-hood/{fo}/f_{rf}.png'); op = A[..., 3] > 0
                for (x, y) in STRIPE_STRIP.get(rf, []):
                    if op[y, x]: R[y, x] = True
                op &= ~R
                R |= loose(op, rf)
            if not R.any(): continue
            p = f'{V}/female/{combo}/{rf}.png'; S = rd(p); w = S.shape[1] // NT if man['female']['outfits'][combo]['plate'] else S.shape[1]
            for t in range(S.shape[1] // w): S[:, t * w:(t + 1) * w][R] = 0
            Image.fromarray(S).save(p); st['strips'] += 1; st['px'] += int(R.sum())
    print('strips', dict(st))

elif MODE == 'hooded':
    wd, md = f'{SRC}/female/with-hood', f'{SRC}/female/clothmask'
    for fo, (h, t, l), combo in outfits('with-hood'):
        leather = f'leather-helm_{t}-chest_{l}-legs'
        for rf in FRAMES:
            fn = f'f_{rf}.png'; H = rd(f'{wd}/{fo}/{fn}'); O = H.copy(); op = O[..., 3] > 0; changed = False
            mp = f'{md}/{fo}/{fn}'; M = (rd(mp)[..., 0] > 0) if os.path.exists(mp) else np.zeros(op.shape, bool)
            # a gap under the hood (a plate or chain helmet's trim cleared the neck and shoulder beside the hood, so the hood
            # floats): every px within 3 px of the hood that this outfit leaves empty and the same outfit with a leather
            # helmet draws, from the leather helmet's hooded picture
            if h != 'leather':
                L = rd(f'{wd}/{leather}/{fn}')
                gap = ring[rf] & ~op & (L[..., 3] > 0)
                if gap.any():
                    O[gap] = L[gap]; M |= gap & tile_cloth[rf]
                    st['gap_px'] += int(gap.sum()); st['gap_frames'] += 1; changed = True
                    op = O[..., 3] > 0
            # a leather helmet has no leather picture to borrow from: its own gap under the hood from its own picture
            # without the cloak (the cowl's neck), where the picture closes in on it
            if h == 'leather':
                U0 = rd(f'{SRC}/female/no-hood/{fo}/{fn}')
                gap = ring[rf] & ~op & (U0[..., 3] > 0) & both_sides(op, 3)
                if gap.any():
                    O[gap] = U0[gap]; st['leather_gap_px'] += int(gap.sum()); changed = True; op = O[..., 3] > 0
            # a hood still cut off from the body (in the idle side view the hood sits clear of the neck for every helmet):
            # the gap between them from the outfit's own picture without the cloak (its neck, its helmet's guard)
            lab, k = nd.label(op, structure=np.ones((3, 3)))
            if k > 1:
                sz = nd.sum(op, lab, range(1, k + 1)); big = int(sz.argmax()) + 1
                if any(i != big and s_ > MAXPX and ((lab == i) & hoodA[rf]).any() for i, s_ in enumerate(sz, 1)):
                    U = rd(f'{SRC}/female/no-hood/{fo}/{fn}')
                    gap = nd.binary_dilation(hoodA[rf], iterations=5) & ~op & (U[..., 3] > 0) & both_sides(op, 5)
                    if gap.any():
                        O[gap] = U[gap]; st['neck_px'] += int(gap.sum()); st['neck_frames'] += 1; changed = True
                        op = O[..., 3] > 0
            R = loose(op, rf)
            if R.any():
                O[R] = 0; M &= ~R; st['loose_px'] += int(R.sum()); changed = True
            if changed:
                Image.fromarray(O).save(f'{wd}/{fo}/{fn}'); st['frames'] += 1
                if M.any():
                    os.makedirs(f'{md}/{fo}', exist_ok=True); Image.fromarray((M * 255).astype(np.uint8)).save(mp)
    print('hooded', dict(st))
