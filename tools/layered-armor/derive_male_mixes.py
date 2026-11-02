"""WORN-ARMOUR: the male outfits with no knight piece, rebuilt from the approved knight mixes (no pixel repainted).

Target <h>,<t>,<l> (leather / warrior only) = UPPER source head-<h>_top-<t>_legs-knight (its head and top are the
target's) and LOWER source head-knight_top-<t>_legs-<l> (its top and legs are). Both share the top, so they agree
except where a head or a legs set is drawn: a pixel the sources disagree on - or the knight's own plate there - is
taken from the UPPER source when it lies nearer the LOWER source's knight helmet, else from the LOWER source when
nearer the UPPER source's knight legs. usage: python -I derive_male_mixes.py <plate_materials_fixed> <out dir>
"""
import os, sys, itertools
import numpy as np
from PIL import Image
from scipy import ndimage as nd
SRC, OUT = sys.argv[1], sys.argv[2]
rd = lambda p: np.array(Image.open(p).convert('RGBA'))
def mask(fo, an, slot, fn):
    p = f'{SRC}/male/{fo}/{an}/{slot}_steel/{fn}'
    return rd(p)[..., 3] > 0 if os.path.exists(p) else None
n = 0; leak = 0
for h, t, l in itertools.product(['leather', 'warrior'], repeat=3):
    up, lo = f'head-{h}_top-{t}_legs-knight', f'head-knight_top-{t}_legs-{l}'
    tgt = f'head-{h}_top-{t}_legs-{l}'
    for an in sorted(os.listdir(f'{SRC}/male/{up}')):
        for fn in sorted(os.listdir(f'{SRC}/male/{up}/{an}/pixel_cleanup')):
            U = rd(f'{SRC}/male_baked/{up}__steel/{an}/{fn}'); L = rd(f'{SRC}/male_baked/{lo}__steel/{an}/{fn}')
            KU = mask(up, an, 'legs', fn); KL = mask(lo, an, 'head', fn)
            dH = nd.distance_transform_edt(~KL) if KL.any() else np.full(KL.shape, 1e9)
            dG = nd.distance_transform_edt(~KU) if KU.any() else np.full(KU.shape, 1e9)
            useU = dH < dG
            T = np.where(useU[..., None], U, L)
            same = (U == L).all(-1); T[same] = U[same]
            # the knight's own plate never reaches the target: count any source plate pixel that survived
            leak += int(((useU & KU) | (~useU & KL & ~same)).sum())
            o = f'{OUT}/{tgt}/{an}/{fn}'; os.makedirs(os.path.dirname(o), exist_ok=True); Image.fromarray(T).save(o); n += 1
print('frames', n, 'knight plate px leaked', leak)
