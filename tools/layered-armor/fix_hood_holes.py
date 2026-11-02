"""WORN-ARMOUR: close the see-through holes in the hooded bodies and take away the loose specks round the hood.

Runs on the hooded frames (<frames>/<body>/with-hood, in place - run it on a copy), both bodies, before
build_hoodfix.mjs. Two steps, in this order:

1. Holes. A hole is a see-through patch the picture closes in on every side (not joined to the open air round the
   figure). One is closed when the unhooded frame draws every px of it, and it is small (at most 12 px) or starts in
   the lower 40 % of the hood's height or below it (the chest and shoulders; a gap beside the head, where the helmet
   used to be, stays open air). The colour:
   - a px the unhooded frame draws the same with every helmet of that chest and legs (the body, the chest armour):
     the unhooded frame's own px;
   - a px that changes with the helmet (the helmet would show under the hood): the commonest colour of its drawn
     neighbours, filled from the edge of the hole inwards.
2. Specks. A loose piece of at most 4 px (touching nothing else, corners included) within 9 px of the hood goes:
   plume tips above the hood, single px beside it, a finger tip cut off by the hood. The drawn arrow of the bow pose
   (8 px) is bigger and stays.

The female's walk from behind (record 3) is not touched.

usage: python -I fix_hood_holes.py <frames root with <body>/no-hood and <body>/with-hood> <repo>/vendor/layered-armor [<body>:<record>-<frame>,...]
"""
import os, sys, re, collections
import numpy as np
from PIL import Image
from scipy import ndimage as nd

SRC, V = sys.argv[1], sys.argv[2]
ONLY = set(sys.argv[3].split(',')) if len(sys.argv) > 3 else None   # optional: only these <body>:<record>-<frame>
rd = lambda p: np.array(Image.open(p).convert('RGBA'))
N8 = [(dy, dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx]


def neighbour_fill(img, todo):
    img = img.copy(); todo = todo.copy()
    h, w = todo.shape
    while todo.any():
        done = []
        for y, x in zip(*np.nonzero(todo)):
            cols = [tuple(img[y + dy, x + dx]) for dy, dx in N8
                    if 0 <= y + dy < h and 0 <= x + dx < w and img[y + dy, x + dx, 3] and not todo[y + dy, x + dx]]
            if cols: done.append((y, x, collections.Counter(cols).most_common(1)[0][0]))
        if not done: break
        for y, x, c in done: img[y, x] = c; todo[y, x] = False
    return img


for body in ('female', 'male'):
    wd, ud = f'{SRC}/{body}/with-hood', f'{SRC}/{body}/no-hood'
    outfits = sorted(os.listdir(wd))
    parts = {fo: re.match(r'^(\w+)-helm_(\w+)-chest_(\w+)-legs$', fo).groups() for fo in outfits}
    sib = collections.defaultdict(list)
    for fo, (h, t, l) in parts.items(): sib[(t, l)].append(fo)
    names = {fo: {re.search(r'_(\d+-\d+)\.png$', f).group(1): f for f in os.listdir(f'{wd}/{fo}') if re.search(r'_\d+-\d+\.png$', f)} for fo in outfits}
    hood_rows, near = {}, {}
    st = collections.Counter()
    for rf in sorted(names[outfits[0]]):
        if ONLY and f'{body}:{rf}' not in ONLY: continue
        if body == 'female' and rf.startswith('3-'): continue   # the female's walk from behind stays as drawn
        cs = rd(f'{V}/cloak/{body}/{rf}.png'); cw = cs.shape[1] // 7; hood = cs[:, cw:2 * cw, 3] > 0
        ys = np.nonzero(hood.any(1))[0]; h0, h1 = (ys.min(), ys.max()) if len(ys) else (0, 0)
        near_hood = nd.binary_dilation(hood, iterations=9) if hood.any() else hood
        U = {fo: rd(f'{ud}/{fo}/{names[fo][rf]}') for fo in outfits}
        for fo in outfits:
            p = f'{wd}/{fo}/{names[fo][rf]}'
            H = rd(p); Uo = U[fo]; O = H.copy(); changed = False
            # 1. holes
            op = H[..., 3] > 0
            lab, k = nd.label(~op)
            border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
            same = np.ones(op.shape, bool)
            for s in sib[parts[fo][1:]]:
                same &= (U[s] == Uo).all(-1)
            fill_u = np.zeros(op.shape, bool); fill_n = np.zeros(op.shape, bool)
            for i in range(1, k + 1):
                if i in border: continue
                comp = lab == i
                if not (Uo[..., 3][comp] > 0).all(): continue
                top = np.nonzero(comp)[0].min()
                if comp.sum() > 12 and top < h0 + 0.6 * (h1 - h0): continue
                fill_u |= comp & same; fill_n |= comp & ~same
            if fill_u.any() or fill_n.any():
                O[fill_u] = Uo[fill_u]
                if fill_n.any(): O = neighbour_fill(O, fill_n)
                st['hole_px_from_unhooded'] += int(fill_u.sum()); st['hole_px_from_neighbours'] += int(fill_n.sum())
                changed = True
            # 2. specks near the hood
            op = O[..., 3] > 0
            lab, k = nd.label(op, structure=np.ones((3, 3)))
            if k > 1:
                sz = nd.sum(op, lab, range(1, k + 1)); big = int(sz.argmax()) + 1
                for i, s in enumerate(sz, 1):
                    if i != big and s <= 4 and (near_hood & (lab == i)).any():
                        O[lab == i] = 0; st['speck_px'] += int(s); changed = True
            if changed:
                Image.fromarray(O).save(p); st['frames'] += 1
    print(body, dict(st))
