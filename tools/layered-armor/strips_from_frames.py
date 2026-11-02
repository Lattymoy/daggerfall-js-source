"""WORN-ARMOUR: write finished, hand-cleaned outfit frames back into the vendored strips.

The frames package (worn_armour_all_frames, the no-hood set of each body) has one folder per outfit:
<helmet>-helm_<chest>-chest_<legs>-legs, every plate piece of an outfit in the same metal, 80 frames each named
<animation>_<view>_<record>-<frame>.png. For every strip of vendor/layered-armor/<body>/<combo>/ this script takes the
outfit's frame in each metal (7 for a combo with a plate piece, 1 without) and changes the strip so that
layeredArmor.js composeStrip gives exactly that frame again:

- a pixel whose composed colour is already right in every metal is left as it is (base, slot map, metals, trim);
- a changed pixel that is the same in every metal goes into the base and out of the slot map;
- a changed pixel that differs between the metals gets the slot whose metal it follows, and each metal tile takes
  that metal's colour there (the trim tiles are cleared at that pixel). Which slot: the outfit with only that piece
  in plate (the other plate pieces made leather or chain) shows the same 7 colours there. With no such outfit, or
  more than one, the pixel keeps its old slot, else gets the nearest one;
- a pixel that is empty in some metal is empty in the base too, so the metal tile can let it through.

Mixed-metal outfits (an iron helmet over a daedric chest) have no frames of their own; they compose from the same
strips, each slot in its own metal.

usage: python -I strips_from_frames.py <frames root with male/no-hood and female/no-hood> <repo>/vendor/layered-armor
"""
import os, sys, json, re, itertools
import numpy as np
from PIL import Image
from scipy import ndimage as nd

SRC, OUT = sys.argv[1], sys.argv[2]
man = json.load(open(f'{OUT}/manifest.json'))
METALS = man['metals']
STEEL = METALS.index('steel')
NT = len(man['tiles'])
TRIM_TILE = {m: (10 if man['trim'][m] == 'cuffs' else 9) for m in METALS}
SLOTS = ['head', 'top', 'legs']
SLOT_RGBA = [(255, 0, 0, 255), (0, 255, 0, 255), (0, 0, 255, 255)]
FAM = {'leather': 'leather', 'chain': 'chain'}
rd = lambda p: np.array(Image.open(p).convert('RGBA'))


def norm(a):
    """Empty px compare equal whatever their colour bytes."""
    a = a.copy(); a[a[..., 3] == 0] = 0; return a


def compose(tiles, metal):
    """composeStrip for one outfit with every plate slot in `metal` (the slot map only holds plate px)."""
    out = tiles[0].copy()
    slot = tiles[1][..., 3] > 0
    for t in (2 + METALS.index(metal), TRIM_TILE[metal]):
        m = slot & (tiles[t][..., 3] > 0)
        out[m] = tiles[t][m]
    return norm(out)


def slot_index(sm):
    """Slot map tile -> -1 none, 0 head, 1 top, 2 legs."""
    s = np.full(sm.shape[:2], -1, np.int8)
    for i, c in enumerate(SLOT_RGBA): s[(sm == c).all(-1)] = i
    return s


stats = {}
for body in ('male', 'female'):
    sdir = f'{SRC}/{body}/no-hood'
    groups = {}   # combo -> {metal or None: folder}
    for fo in sorted(os.listdir(sdir)):
        h, t, l = re.match(r'^(\w+)-helm_(\w+)-chest_(\w+)-legs$', fo).groups()
        combo = '_'.join(FAM.get(x, 'plate') for x in (h, t, l))
        metal = next((x for x in (h, t, l) if x not in FAM), None)
        groups.setdefault(combo, {})[metal] = fo
    names = {fo: {re.search(r'_(\d+-\d+)\.png$', f).group(1): f for f in os.listdir(f'{sdir}/{fo}') if not f.startswith('_')}
             for g in groups.values() for fo in g.values()}
    st = stats[body] = {'strips': 0, 'changed_strips': 0, 'px_same_all_metals': 0, 'px_per_metal': 0,
                        'slot_from_single_piece': 0, 'slot_kept': 0, 'slot_nearest': 0, 'slot_moved': 0}
    frames = sorted({rf for c in groups for rf in man[body]['outfits'][c]['frames']})
    for rf in frames:
        # every outfit's frame for this record-frame: combo -> (7,h,w,4) by metal, or (1,h,w,4)
        V = {}
        for combo, by in groups.items():
            ks = METALS if None not in by else [None]
            V[combo] = np.stack([norm(rd(f'{sdir}/{by[k]}/{names[by[k]][rf]}')) for k in ks])
        for combo in sorted(groups):
            if rf not in man[body]['outfits'][combo]['frames']: continue
            st['strips'] += 1
            p = f'{OUT}/{body}/{combo}/{rf}.png'
            strip = rd(p)
            if not man[body]['outfits'][combo]['plate']:
                new = V[combo][0]
                diff = (norm(strip) != new).any(-1)
                if diff.any():
                    Image.fromarray(new).save(p, optimize=True)
                    st['changed_strips'] += 1; st['px_same_all_metals'] += int(diff.sum())
                continue
            w = strip.shape[1] // NT
            tiles = [strip[:, i * w:(i + 1) * w].copy() for i in range(NT)]
            Vc = V[combo]
            C = np.stack([compose(tiles, m) for m in METALS])
            changed = (Vc != C).any(-1).any(0)
            if not changed.any(): continue
            same = (Vc == Vc[0:1]).all(-1).all(0)
            m1 = changed & same          # the same in every metal: the base alone
            m2 = changed & ~same         # differs between metals: needs a slot
            fams = combo.split('_')
            old = slot_index(tiles[1])
            new_slot = old.copy()
            if m2.any():
                plate_slots = [i for i, f in enumerate(fams) if f == 'plate']
                hit = np.zeros((len(SLOTS),) + m2.shape, bool)
                for s in plate_slots:
                    others = [i for i in plate_slots if i != s]
                    for repl in itertools.product(['leather', 'chain'], repeat=len(others)):
                        f2 = list(fams)
                        for i, r in zip(others, repl): f2[i] = r
                        ref = V.get('_'.join(f2))
                        if ref is not None: hit[s] |= (ref == Vc).all(-1).all(0)
                nhit = hit.sum(0)
                one = m2 & (nhit == 1)
                new_slot[one] = hit.argmax(0)[one]
                st['slot_from_single_piece'] += int(one.sum())
                st['slot_moved'] += int((one & (old >= 0) & (new_slot != old)).sum())
                rest = m2 & (nhit != 1)
                st['slot_kept'] += int((rest & (old >= 0)).sum())
                near = rest & (old < 0)
                if near.any():
                    idx = nd.distance_transform_edt(old < 0, return_distances=False, return_indices=True)
                    new_slot[near] = old[idx[0][near], idx[1][near]]
                    st['slot_nearest'] += int(near.sum())
            tiles[0][m1] = Vc[0][m1]
            for t in range(1, NT): tiles[t][m1] = 0
            empty_any = (Vc[..., 3] == 0).any(0)
            tiles[0][m2 & empty_any] = 0
            keep = m2 & ~empty_any
            tiles[0][keep] = Vc[STEEL][keep]
            for i in range(len(SLOTS)):
                tiles[1][m2 & (new_slot == i)] = SLOT_RGBA[i]
            for i in range(len(METALS)): tiles[2 + i][m2] = Vc[i][m2]
            tiles[9][m2] = 0; tiles[10][m2] = 0
            st['px_same_all_metals'] += int(m1.sum()); st['px_per_metal'] += int(m2.sum())
            for i, m in enumerate(METALS):   # every metal composes to its frame now
                assert (compose(tiles, m) == Vc[i]).all(), (body, combo, rf, m)
            Image.fromarray(np.concatenate(tiles, 1)).save(p, optimize=True); st['changed_strips'] += 1
print(json.dumps(stats, indent=1))
