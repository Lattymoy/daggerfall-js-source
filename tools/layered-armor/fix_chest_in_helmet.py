"""WORN-ARMOUR: the leather chest's tan showing inside a chain or plate helmet (female, every frame).

With a leather chest, a few frames draw the leather's tan inside the helmet: a stripe in the chain coif's face, a patch
in the plate helmet. The helmet's px are the same whatever the chest (the chain chest draws them all); where the
leather chest draws tan instead and that tan sits inside the helmet - at least 60 % of the px round it are the helmet's
own - the px goes back to the helmet: every tile of the strip at that px is copied from the same helmet and legs with
a chain chest (base, slot map, the seven metals, trims), so a plate helmet keeps its metal. The mantle lying over the
helmet's neck guard is not inside the helmet and stays.

usage: python -I fix_chest_in_helmet.py <frames (compose_all.mjs output of these strips)> <repo>/vendor/layered-armor
"""
import os, sys, json, collections
import numpy as np
from PIL import Image
from scipy import ndimage as nd

SRC, V = sys.argv[1], sys.argv[2]
rd = lambda p: np.array(Image.open(p).convert('RGBA'))
man = json.load(open(f'{V}/manifest.json')); NT = len(man['tiles'])
D = f'{SRC}/female/no-hood'
pick = lambda f: f if f != 'plate' else 'steel'


def is_tan(c):
    c = c.astype(float); r, g, b = c[..., 0], c[..., 1], c[..., 2]; mx = c.max(-1); mn = c.min(-1); d = mx - mn
    with np.errstate(all='ignore'): h = np.where(mx == r, ((g - b) / np.maximum(d, 1e-6)) % 6, 9) * 60
    L = 0.299 * r + 0.587 * g + 0.114 * b
    return (mx == r) & (d / np.maximum(mx, 1) > 0.3) & (h >= 18) & (h <= 42) & (L >= 95) & (L <= 165)


st = collections.Counter()
for combo in sorted(os.listdir(f'{V}/female')):
    h, t, l = combo.split('_')
    if t != 'leather' or h == 'leather': continue
    src_combo = f'{h}_chain_{l}'
    fo = f'{pick(h)}-helm_leather-chest_{pick(l)}-legs'; sib = f'{pick(h)}-helm_chain-chest_{pick(l)}-legs'
    lh = f'leather-helm_chain-chest_{pick(l)}-legs'
    for fn in sorted(os.listdir(f'{D}/{fo}')):
        rf = fn[2:-4]
        A = rd(f'{D}/{fo}/{fn}'); C = rd(f'{D}/{sib}/{fn}'); L = rd(f'{D}/{lh}/{fn}')
        Hm = (C != L).any(-1) & (C[..., 3] > 0)                       # the helmet's own px
        bad = Hm & (A != C).any(-1) & is_tan(A[..., :3]) & (A[..., 3] > 0)
        if not bad.any(): continue
        lab, k = nd.label(bad, structure=np.ones((3, 3)))
        fix = np.zeros_like(bad)
        for i in range(1, k + 1):
            m = lab == i
            ring = nd.binary_dilation(m, structure=np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]])) & ~m
            if m.sum() <= 30 and ring.sum() and (Hm & ring & ~bad).sum() / ring.sum() >= 0.6: fix |= m
        if not fix.any(): continue
        p = f'{V}/female/{combo}/{rf}.png'; S = rd(p); Q = rd(f'{V}/female/{src_combo}/{rf}.png')
        w = S.shape[1] // NT if man['female']['outfits'][combo]['plate'] else S.shape[1]
        wq = Q.shape[1] // NT if man['female']['outfits'][src_combo]['plate'] else Q.shape[1]
        nt, ntq = S.shape[1] // w, Q.shape[1] // wq
        for y, x in zip(*np.nonzero(fix)):
            for tt in range(nt):
                S[y, tt * w + x] = Q[y, tt * wq + x] if tt < ntq else 0
        Image.fromarray(S).save(p); st['frames'] += 1; st['px'] += int(fix.sum())
print(dict(st))
