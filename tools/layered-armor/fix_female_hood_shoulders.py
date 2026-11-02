"""WORN-ARMOUR: give the hooded female her plate shoulders back in the side views.

In the front-side, side and back-side views (record % 5 = 1, 2, 3) the hooded female with a plate chest lost part of
the far pauldron beside the hood: the cloak's helmet trim (the plate helmet's tips in the air beside the hood) also
cut the shoulder there, and the hood's near-black rim lay over the shoulder tops; the cloak's shoulder tile also laid
the shoulder over the hood's lower edge.

This script changes the hooded frames (<frames>/female/with-hood, in place - run it on a copy) before
build_hoodfix.mjs turns them into hoodfix strips:
- every chest, every record but the walk from behind: where the cloak's shoulder tile laid the body's shoulder over
  the hood's cloth, the hood's cloth (Light Brown, as the runtime dyes it) is back - no armour colour on the hood;
- plate chests: a px of the chest's plate (the strip's slot map, green) that the unhooded frame draws and the hooded
  frame leaves empty is taken from the unhooded frame; in the front-side and side views also one the hood's near-black
  rim covers, except the rim's 1 px edge against the hood's cloth (the hood's outline, its brim). Never where the
  cloak's hood or cape cloth lies. There, too, a near-black px of the helmet's own shoulder cover right under the hood
  (up to 3 px below it; the leather cowl's shadow, a neck guard) shows the chest as the same chest and legs look
  under another helmet that leaves that px to the chest; and a near-black px still left there next to the chest (the
  art's own dark line between head and shoulder, which reads as a hole under a hood) becomes the chest's armour beside
  it, in shadow (50 % by the hood, 65 %, 80 %, snapped to the chest's colours). The back-side views keep the rim as
  drawn; the walk from behind (record 3) is not
  touched at all;
- a piece taken that touches nothing drawn (a lone px in the air) is left out;
- the shoulder under the hood's edge is shaded: 1 px from the hood cloth to 42 % brightness, 2 px 68 %, 3 px 86 %,
  each shade replaced by the nearest colour the chest itself uses, so no new colours come in.

usage: python -I fix_female_hood_shoulders.py <frames root with female/no-hood and female/with-hood> <repo>/vendor/layered-armor [<record>-<frame>,...]
"""
import os, sys, re, json
import numpy as np
from PIL import Image
from scipy import ndimage as nd

SRC, V = sys.argv[1], sys.argv[2]
ONLY = set(sys.argv[3].split(',')) if len(sys.argv) > 3 else None   # optional: only these <record>-<frame>
man = json.load(open(f'{V}/manifest.json'))
NT = len(man['tiles'])
FAM = {'leather': 'leather', 'chain': 'chain'}
rd = lambda p: np.array(Image.open(p).convert('RGBA'))


def is_cloth(c):   # layeredArmor.js isCloth
    r, g, b = [c[..., i].astype(float) for i in range(3)]
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b); d = mx - mn
    with np.errstate(all='ignore'):
        h = np.where(mx == r, 60 * (g - b) / d, np.where(mx == g, 120 + 60 * (b - r) / d, np.nan))
        h = np.where(h < 0, h + 360, h)
        ok = (d > 0) & (mx >= 31) & ((d / np.maximum(mx, 1)) >= 0.15) & ~np.isnan(h)
    return ok & (h >= 60) & (h <= 165)


def lum(c): return 0.299 * c[..., 0] + 0.587 * c[..., 1] + 0.114 * c[..., 2]


CMAN = json.load(open(f'{V}/cloak/manifest.json'))
RAMP_L = [0.299 * r + 0.587 * g + 0.114 * b for r, g, b in CMAN['ramp']]
BAND = np.array(CMAN['dyes'][5], float)   # the frames' cloak: no dye, Light Brown


def dye5(c):
    """layeredArmor.js dyeCloth(..., 5) for an array of RGB."""
    L = lum(c.astype(float)); last = len(RAMP_L) - 1; t = np.zeros(L.shape)
    t[L <= RAMP_L[last]] = last
    for i in range(last):
        m = (L < RAMP_L[i]) & (L >= RAMP_L[i + 1])
        t[m] = i + (RAMP_L[i] - L[m]) / (RAMP_L[i] - RAMP_L[i + 1])
    a = np.floor(t).astype(int); cc = np.minimum(last, a + 1); f = (t - a)[..., None]
    return np.floor(BAND[a] * (1 - f) + BAND[cc] * f + 0.5).astype(np.uint8)


def fix(U, H, top, hood_a, hood_cloth, cape_cloth, view, sibs=()):
    drawn = H[..., 3] > 0; U0 = U; shade_extra = np.zeros_like(drawn)
    R = top & (U[..., 3] > 0) & ~drawn & ~hood_cloth & ~cape_cloth          # an empty gap takes the shoulder
    if view in (1, 2):
        # front-side, side: the hood's near-black rim over the shoulder too - but not its 1 px edge against the
        # hood's cloth, which is the hood's own outline (its brim)
        dark = drawn & (lum(H.astype(float)) < 40) & ~is_cloth(H)
        d_cloth = nd.distance_transform_cdt(~hood_cloth, metric='taxicab')
        R |= top & (U[..., 3] > 0) & (U != H).any(-1) & ~hood_cloth & ~cape_cloth & hood_a & dark & (d_cloth >= 2)
        # the helmet's own dark shoulder cover peeking out right under the hood (the leather cowl's shadow, a neck
        # guard) reads as a hole: there the chest shows as the same outfit wears it under a helmet that leaves it free
        below = hood_a.copy()
        for k in range(1, 4): below[k:] |= hood_a[:-k]
        cand = dark & ~top & ~hood_cloth & ~cape_cloth & below & ((~hood_a) | (d_cloth >= 2))
        if cand.any() and sibs:
            Ufill = U.copy(); got = np.zeros_like(cand)
            for Us, tops in sibs:
                ok = cand & ~got & tops & (Us[..., 3] > 0) & (lum(Us.astype(float)) >= 40)
                Ufill[ok] = Us[ok]; got |= ok
            U = Ufill; R |= got
        # what is still near-black right under the hood (the art's own dark line between head and shoulder, in the
        # unhooded frame too) reads as a hole under a hood: it becomes the chest's armour beside it, in shadow
        black = drawn & (lum(H.astype(float)) < 30) & ~is_cloth(H) & ~hood_cloth & ~cape_cloth & below \
            & ((~hood_a) | (d_cloth >= 2)) & ~R
        black &= nd.binary_dilation(top & (U[..., 3] > 0) & ~black, iterations=2)   # only beside the chest
        if black.any():
            col = U[..., :3].astype(float); ok = top & (U[..., 3] > 0) & (lum(U.astype(float)) >= 30) & ~black
            todo = black.copy()
            for _ in range(6):
                acc = np.zeros(col.shape); cnt = np.zeros(col.shape[:2])
                for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    acc += np.roll(col, (dy, dx), (0, 1)) * np.roll(ok, (dy, dx), (0, 1))[..., None]; cnt += np.roll(ok, (dy, dx), (0, 1))
                ready = todo & (cnt > 0)
                if not ready.any(): break
                col[ready] = acc[ready] / cnt[ready][:, None]; ok |= ready; todo &= ~ready
            black &= ~todo
            U = U.copy(); U[black, :3] = col[black].astype(np.uint8); U[black, 3] = 255
            R |= black
            shade_extra = black
    lab, n = nd.label(R, structure=np.ones((3, 3)))
    if n:
        touch = nd.binary_dilation((H[..., 3] > 0) & ~R, structure=np.ones((3, 3)))
        keep = np.zeros(n + 1, bool); keep[np.unique(lab[R & touch])] = True; keep[0] = False
        R = keep[lab]
    if not R.any(): return H, 0
    O = H.copy(); O[R] = U[R]
    dist = nd.distance_transform_cdt(~(hood_cloth & (O[..., 3] > 0)), metric='taxicab')
    pal = np.unique(U0[top & (U0[..., 3] > 0)][:, :3], axis=0).astype(float)
    for d, k in ((1, 0.42), (2, 0.68), (3, 0.86)):
        m = R & (dist == d) & ~shade_extra
        if not m.any(): continue
        c = O[m][:, :3].astype(float) * k
        O[m, :3] = pal[((c[:, None, :] - pal[None]) ** 2).sum(-1).argmin(1)].astype(np.uint8)
    if shade_extra.any():   # the former dark line: in shadow, darkest by the hood
        dd = nd.distance_transform_cdt(~hood_a, metric='taxicab')
        k = np.where(dd <= 1, 0.50, np.where(dd == 2, 0.65, 0.80))
        c = O[shade_extra][:, :3].astype(float) * k[shade_extra][:, None]
        O[shade_extra, :3] = pal[((c[:, None, :] - pal[None]) ** 2).sum(-1).argmin(1)].astype(np.uint8)
    return O, int(R.sum())


total = files = 0; hood_back = 0
nd_, wd = f'{SRC}/female/no-hood', f'{SRC}/female/with-hood'
for fo in sorted(os.listdir(wd)):                 # the hood's cloth over the body's shoulder, every chest
    for fn in sorted(os.listdir(f'{wd}/{fo}')):
        m = re.search(r'_(\d+)-(\d+)\.png$', fn)
        if not m or int(m.group(1)) == 3: continue
        rf = f'{m.group(1)}-{m.group(2)}'
        if ONLY and rf not in ONLY: continue
        cs = rd(f'{V}/cloak/female/{rf}.png'); cw = cs.shape[1] // 7
        ht = cs[:, cw:2 * cw]; hc = (ht[..., 3] > 0) & is_cloth(ht); sho = cs[:, 6 * cw:7 * cw, 3] > 0
        H = rd(f'{wd}/{fo}/{fn}'); want = dye5(ht[..., :3])
        m2 = hc & sho & (H[..., 3] > 0) & (H[..., :3] != want).any(-1)
        if m2.any():
            H[m2, :3] = want[m2]; H[m2, 3] = 255; Image.fromarray(H).save(f'{wd}/{fo}/{fn}'); hood_back += int(m2.sum())
for fo in sorted(os.listdir(wd)):
    h, t, l = re.match(r'^(\w+)-helm_(\w+)-chest_(\w+)-legs$', fo).groups()
    if t in FAM: continue   # plate chests only
    combo = '_'.join(FAM.get(x, 'plate') for x in (h, t, l))
    for fn in sorted(os.listdir(f'{wd}/{fo}')):
        m = re.search(r'_(\d+)-(\d+)\.png$', fn)
        if not m or int(m.group(1)) % 5 not in (1, 2, 3): continue
        if int(m.group(1)) == 3: continue   # the walk from behind stays as drawn
        rf = f'{m.group(1)}-{m.group(2)}'
        if ONLY and rf not in ONLY: continue
        U = rd(f'{nd_}/{fo}/{fn}'); H = rd(f'{wd}/{fo}/{fn}')
        st = rd(f'{V}/female/{combo}/{rf}.png'); w = st.shape[1] // NT
        sl = st[:, w:2 * w]; top = (sl[..., 1] == 255) & (sl[..., 0] == 0) & (sl[..., 2] == 0) & (sl[..., 3] > 0)
        cs = rd(f'{V}/cloak/female/{rf}.png'); cw = cs.shape[1] // 7
        ht = cs[:, cw:2 * cw]; hood_a = ht[..., 3] > 0; hood_cloth = hood_a & is_cloth(ht)
        cp = cs[:, :cw]; cape_cloth = (cp[..., 3] > 0) & is_cloth(cp)
        sibs = []
        for h2 in ('chain', t, 'leather', 'steel'):     # the same chest and legs under the other helmets
            fo2 = f'{h2}-helm_{t}-chest_{l}-legs'
            if h2 == h or not os.path.isdir(f'{nd_}/{fo2}'): continue
            c2 = '_'.join(FAM.get(x, 'plate') for x in (h2, t, l))
            st2 = rd(f'{V}/female/{c2}/{rf}.png'); w2 = st2.shape[1] // NT; s2 = st2[:, w2:2 * w2]
            sibs.append((rd(f'{nd_}/{fo2}/{fn}'), (s2[..., 1] == 255) & (s2[..., 0] == 0) & (s2[..., 2] == 0) & (s2[..., 3] > 0)))
        O, n = fix(U, H, top, hood_a, hood_cloth, cape_cloth, int(m.group(1)) % 5, sibs)
        if n:
            Image.fromarray(O).save(f'{wd}/{fo}/{fn}'); total += n; files += 1
print('hood cloth back over the shoulder px', hood_back, '| shoulder: frames changed', files, 'px', total)
