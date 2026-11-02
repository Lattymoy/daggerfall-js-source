"""WORN-ARMOUR: a weapon drawn loose from the hand (female, every frame): a piece of 30+ px not joined to the figure
and clear of the head, at most 5 px from it, is joined by a line of the handle's own colour (tile 0).
usage: python -I fix_weapon_gap.py <repo>/vendor/layered-armor"""
import os, sys, json, numpy as np
from PIL import Image
from scipy import ndimage as nd
V = sys.argv[1]; man = json.load(open(f'{V}/manifest.json')); NT = len(man['tiles']); n = f = 0
for combo in sorted(os.listdir(f'{V}/female')):
    plate = man['female']['outfits'][combo]['plate']
    for fn in os.listdir(f'{V}/female/{combo}'):
        p = f'{V}/female/{combo}/{fn}'; S = np.array(Image.open(p).convert('RGBA')); w = S.shape[1] // NT if plate else S.shape[1]
        cs = np.array(Image.open(f'{V}/cloak/female/{fn}').convert('RGBA')); cw = cs.shape[1] // 7
        head = nd.binary_dilation(cs[:, cw:2 * cw, 3] > 0, iterations=3)
        op = S[:, :w, 3] > 0; lab, k = nd.label(op, structure=np.ones((3, 3)))
        if k < 2: continue
        sz = nd.sum(op, lab, range(1, k + 1)); big = int(sz.argmax()) + 1; ch = False
        dist, (iy, ix) = nd.distance_transform_edt(lab != big, return_indices=True)
        for i, s in enumerate(sz, 1):
            m = lab == i
            if i == big or s < 30 or (m & head).any(): continue
            d = np.where(m, dist, 1e9); y0, x0 = np.unravel_index(d.argmin(), d.shape)
            if d[y0, x0] > 5: continue
            y1, x1 = iy[y0, x0], ix[y0, x0]; col = S[y0, x0].copy()
            for t in np.linspace(0, 1, 12):
                y, x = int(round(y0 + (y1 - y0) * t)), int(round(x0 + (x1 - x0) * t))
                if S[y, x, 3] == 0: S[y, x] = col; n += 1
            ch = True
        if ch: Image.fromarray(S).save(p); f += 1
print('weapon joined in strips', f, 'px', n)
