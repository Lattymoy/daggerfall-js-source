"""WORN-ARMOUR: the female's leather shoulders in the attack (records 5-9), redrawn as her idle mantle.

The leather chest's shoulders in the attack frames are the original archive-487 pauldrons (the chain chest still draws
them as 487 has them) filled with three or four flat tans, with pin holes, notches, stair-steps and leftover specks of
the metal's highlights (grey, white, pink) in them. The idle frames draw the same mantle well: a mid tan body with a
little lighter top and darker creases, and a near-black rim 1-2 px thick along its lower edge.

Per attack frame, on the plain leather outfit:
  1. the shoulder: the px the leather chest fills with a plank tan where the chain chest draws the pauldron's metal,
     plus the specks of other colour the shoulder closes in on;
  2. its outline cleaned against the open air: pin holes and 1 px dents filled, 1 px spikes and loose bits taken off;
  3. repainted in the idle mantle's own colours: the top row lighter, the body the mantle's tans following the
     pauldron's form (its brightness blurred 5x5, in five steps), the bottom 1-2 px the near-black rim.
Every leather-chest strip (9 combos) is done from its own pictures (its helmet and legs as they are; a plate
helmet's px are never painted). Only tile 0 changes colour; a px taken off goes from every tile, and a loose px by the
head the cleaning leaves goes too.

usage: python -I fix_leather_shoulders.py <frames (compose_all.mjs output of this strip set)> <repo>/vendor/layered-armor [preview-dir]
"""
import os, sys, json, collections
import numpy as np
from PIL import Image
from scipy import ndimage as nd

SRC, V = sys.argv[1], sys.argv[2]
PREV = sys.argv[3] if len(sys.argv) > 3 else None
rd = lambda p: np.array(Image.open(p).convert('RGBA'))
man = json.load(open(f'{V}/manifest.json')); NT = len(man['tiles'])
D = f'{SRC}/female/no-hood'
lum = lambda c: 0.299 * c[..., 0].astype(float) + 0.587 * c[..., 1] + 0.114 * c[..., 2]
N8 = np.ones((3, 3)); N8[1, 1] = 0

# the idle mantle's colours (19-0)
BLACK, RIMBR = (19, 19, 19), (35, 23, 11)
BODY = [(123, 92, 60), (134, 103, 65), (151, 110, 69), (160, 118, 74), (173, 127, 78)]   # l n p q r
TOP = (183, 140, 88)                                                                      # s
PLANK = {(160, 118, 74), (173, 127, 78), (151, 110, 69), (183, 140, 88), (196, 154, 105)}


def sat(c):
    c = c.astype(float); mx = c.max(-1); mn = c.min(-1)
    return np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0), mx / 255


def is_leather(c):
    """tan-brown: red the largest, hue 18-42, saturated"""
    c = c.astype(float); r, g, b = c[..., 0], c[..., 1], c[..., 2]
    mx = c.max(-1); mn = c.min(-1); d = mx - mn
    with np.errstate(all='ignore'):
        h = np.where(mx == r, ((g - b) / np.maximum(d, 1e-6)) % 6, 9) * 60
    return (mx == r) & (d / np.maximum(mx, 1) > 0.3) & (h >= 18) & (h <= 42)


def shoulder(Lf, Cf, band):
    """the leather shoulder: light leather px where the chain chest draws the 487 pauldron's metal instead, in the
    shoulder band (from the head's top to 18 px under it); then the specks it closes in on"""
    op = Lf[..., 3] > 0
    s, v = sat(Cf[..., :3])
    diff = op & (Cf[..., 3] > 0) & (Lf[..., :3] != Cf[..., :3]).any(-1)
    tan = is_leather(Lf[..., :3]) & (lum(Lf) >= 95) & (lum(Lf) <= 165)          # mantle tans, not skin highlights
    S0 = diff & (s < 0.2) & (v > 0.12) & tan & band
    # the mantle drawn wider than the pauldron (the chain chest has nothing there): its tips, where they join it
    only = op & (Cf[..., 3] == 0) & tan & band
    grow = nd.binary_dilation(S0, structure=np.ones((3, 3)), iterations=4) & only | S0
    for _ in range(12):
        nxt = only & nd.binary_dilation(grow, structure=np.ones((3, 3)))
        if (nxt & ~grow).sum() == 0: break
        grow |= nxt
    S0 |= grow & only
    lab, k = nd.label(S0, structure=np.ones((3, 3)))
    if k:
        sz = nd.sum(S0, lab, range(1, k + 1)); keep = np.zeros(k + 1, bool); keep[1:] = sz >= 6; S0 = keep[lab]
    # a shoulder reaches up to within 10 px under the head
    hy = np.nonzero(band.any(1))[0]; top_band = np.zeros_like(band); top_band[hy.min():min(band.shape[0], hy.max() - 8)] = True
    lab, k = nd.label(S0, structure=np.ones((3, 3)))
    for i in range(1, k + 1):
        if not ((lab == i) & top_band).any(): S0[lab == i] = False
    if S0.sum() < 6: return None
    hull = nd.binary_fill_holes(nd.binary_closing(S0, structure=np.ones((3, 3)), iterations=2)) | S0
    junk = hull & op & ~S0 & band & (~is_leather(Lf[..., :3]) | (lum(Lf) >= 95)) & (lum(Lf) > 45)
    S = S0 | junk
    S |= nd.binary_fill_holes(nd.binary_closing(S, structure=np.ones((3, 3)), iterations=2) | S) & op & band
    return S


def polish(Lf, Cf, S, front=False):
    """clean the outline against the open air, then paint: (colour per px, px removed, px added)"""
    op = Lf[..., 3] > 0
    add = np.zeros_like(S); rem = np.zeros_like(S)
    for _ in range(2):
        air = (~op | rem) & ~add
        nb = nd.convolve(S.astype(int), N8, mode='constant')
        spike = S & (nd.convolve(air.astype(int), N8, mode='constant') > 0) & (nb <= 2)
        S = S & ~spike; rem |= spike & op; add &= ~spike
        air = (~op | rem) & ~add
        dent = air & (nd.convolve(S.astype(int), N8, mode='constant') >= 5)
        S = S | dent; add |= dent & ~op; rem &= ~dent
    # the outline against the open air smoothed: a px there takes what 5 of its 9 (3x3) say, twice - stair-steps and
    # ragged notches become clean edges; never against the rest of the body
    K9 = np.ones((3, 3))
    for _ in range(2):
        air = (~op | rem) & ~add
        cnt = nd.convolve(S.astype(int), K9, mode='constant')
        nearair = nd.binary_dilation(air, structure=K9) & nd.binary_dilation(S, structure=K9)
        grow = nearair & air & (cnt >= 5)
        shrink = nearair & S & (cnt <= 3) & (nd.convolve(air.astype(int), K9, mode='constant') >= 4)
        S = (S | grow) & ~shrink; add |= grow & ~op; rem |= shrink & op; add &= ~shrink; rem &= ~grow
    lab, k = nd.label(S, structure=np.ones((3, 3)))
    for i in range(1, k + 1):
        m = lab == i
        if m.sum() < 4: S &= ~m; rem |= m & op; add &= ~m
    op2 = (op | add) & ~rem
    H, W = S.shape
    up = np.zeros((H, W), int); dn = np.zeros((H, W), int)
    for y in range(1, H): up[y] = np.where(S[y] & S[y - 1], up[y - 1] + 1, 0)
    for y in range(H - 2, -1, -1): dn[y] = np.where(S[y] & S[y + 1], dn[y + 1] + 1, 0)
    height = up + dn + 1
    below_air = np.zeros_like(S); below_air[:-1] = ~op2[1:]; below_air[-1] = True
    Ld = lum(Lf)
    below_dark = np.zeros_like(S); below_dark[:-1] = op2[1:] & ~S[1:] & (Ld[1:] < 45)
    hullS = nd.binary_fill_holes(nd.binary_closing(S, structure=np.ones((3, 3)), iterations=2) | S)
    below_out = np.zeros_like(S); below_out[:-1] = ~hullS[1:]                   # the shoulder's own underside
    k5 = np.ones((5, 5)); Lm = np.where(S, lum(Cf), 0.0)
    form = nd.convolve(Lm, k5, mode='constant') / np.maximum(nd.convolve(S.astype(float), k5, mode='constant'), 1)
    if not S.any(): return {}, rem, add
    fv = form[S]; lo, hi = np.percentile(fv, 15), np.percentile(fv, 85)
    bump = np.zeros(S.shape, int)
    bump[S] = np.where(fv > hi, 1, np.where(fv < lo, -1, 0))
    out = {}
    for y, x in zip(*np.nonzero(S)):
        hgt = height[y, x]; t = up[y, x] / max(hgt - 1, 1)
        if dn[y, x] == 0 and below_air[y, x] and hgt >= 2:
            c = BLACK                                            # the rim against the open air
        elif dn[y, x] == 0 and front and below_out[y, x] and not below_air[y, x] and not below_dark[y, x] and hgt >= 3:
            c = RIMBR                                            # the mantle's shadow line on the chest (front/side)
        elif up[y, x] == 0 and hgt >= 3:
            c = TOP                                              # the lit top
        else:
            base = 4 if t < 0.34 else 3 if t < 0.67 else 2       # r / q / p, lit from above
            c = BODY[int(np.clip(base + bump[y, x], 1, 4))]
        out[(int(y), int(x))] = c
    return out, rem, add


def islands_by_head(alpha, near):
    """loose pieces (<= 20 px, not joined to the figure) within 12 px of the head, not a 1-row arrow"""
    out = np.zeros_like(alpha)
    lab, k = nd.label(alpha, structure=np.ones((3, 3)))
    if k < 2: return out
    sz = nd.sum(alpha, lab, range(1, k + 1)); big = int(sz.argmax()) + 1
    for i, n in enumerate(sz, 1):
        if i == big or n > 20: continue
        m = lab == i; ys, xs = np.nonzero(m)
        if not (m & near).any() or (ys.max() == ys.min() and xs.max() - xs.min() + 1 >= 6): continue
        out |= m
    return out


if __name__ == '__main__':
    combos = sorted(c for c in os.listdir(f'{V}/female') if c.split('_')[1] == 'leather')
    pick = lambda f: f if f != 'plate' else 'steel'
    st = collections.Counter()
    for combo in combos:
        h, _, l = combo.split('_')
        fo, foc = f'{pick(h)}-helm_leather-chest_{pick(l)}-legs', f'{pick(h)}-helm_chain-chest_{pick(l)}-legs'
        for rec in range(5, 10):
            for f in range(10):
                fn = f'f_{rec}-{f}.png'
                if not os.path.exists(f'{D}/{fo}/{fn}'): continue
                Lf = rd(f'{D}/{fo}/{fn}'); Cf = rd(f'{D}/{foc}/{fn}')
                cs = rd(f'{V}/cloak/female/{rec}-{f}.png'); cw = cs.shape[1] // 7; hood = cs[:, cw:2 * cw, 3] > 0
                hy = np.nonzero(hood.any(1))[0]
                band = np.zeros(Lf.shape[:2], bool); band[hy.min():min(Lf.shape[0], hy.max() + 19)] = True
                S = shoulder(Lf, Cf, band)
                if S is None: continue
                paint, rem, add = polish(Lf, Cf, S, front=rec % 5 in (0, 1, 2))
                if PREV and combo != 'leather_leather_leather': continue
                p = f'{V}/female/{combo}/{rec}-{f}.png'; Sx = rd(p)
                w = Sx.shape[1] // NT if man['female']['outfits'][combo]['plate'] else Sx.shape[1]
                slot = (Sx[:, w:2 * w, 3] > 0) if w != Sx.shape[1] else np.zeros(S.shape, bool)
                for (y, x), c in paint.items():
                    if slot[y, x]: continue
                    Sx[y, x, :3] = c; Sx[y, x, 3] = 255
                for y, x in zip(*np.nonzero(rem & ~slot)):
                    for t in range(Sx.shape[1] // w): Sx[y, t * w + x] = 0
                # no loose px by the head left by the cleaning
                loose = islands_by_head(Sx[:, :w, 3] > 0, nd.binary_dilation(hood, iterations=12))
                for y, x in zip(*np.nonzero(loose)):
                    for t in range(Sx.shape[1] // w): Sx[y, t * w + x] = 0
                st['loose'] += int(loose.sum())
                if PREV:
                    os.makedirs(PREV, exist_ok=True); Image.fromarray(Sx[:, :w]).save(f'{PREV}/{rec}-{f}.png'); continue
                Image.fromarray(Sx).save(p)
                st['frames'] += 1; st['px'] += len(paint); st['removed'] += int(rem.sum()); st['added'] += int(add.sum())
    print(dict(st))
