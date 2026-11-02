"""WORN-ARMOUR: build vendor/layered-armor from the plate_materials_fixed package.

One PNG STRIP per (gender, outfit, frame): tile 0 the base (cleanup applied), tile 1 the SLOT MAP (red head, green top,
blue legs - every plate pixel of the outfit and its trim), tiles 2-8 the seven metals (iron steel mithril adamantium
ebony orcish daedric) over every plate pixel, tile 9 the full gold trim, tile 10 the wrist-cuff trim. An outfit with no
plate piece is tile 0 alone. src/player/eyeOfTheBeholder/layeredArmor.js composes any helmet / chest / legs metal from one strip.

usage: python -I build_strips.py <plate_materials_fixed> <repo>/vendor/layered-armor [<male_mixes_v66>]
The optional male_mixes_v66 adds the male outfits without a knight piece (all leather / chain).
"""
import os, sys, json, re
import numpy as np
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
MALE_V66 = sys.argv[3] if len(sys.argv) > 3 else None
METALS = ['iron', 'steel', 'mithril', 'adamantium', 'ebony', 'orcish', 'daedric']
SLOTS = ['head', 'top', 'legs']
SLOT_RGB = {'head': (255, 0, 0), 'top': (0, 255, 0), 'legs': (0, 0, 255)}
TOK_M = {'leather': 'leather', 'warrior': 'chain', 'knight': 'plate'}
rd = lambda p: np.array(Image.open(p).convert('RGBA'))
def over(a, b): m = b[..., 3] > 0; a = a.copy(); a[m] = b[m]; return a

def strip(base, layer):   # layer(slot, name) -> RGBA or None
    tiles = [base]
    if layer is None: return np.concatenate(tiles, 1)
    h, w = base.shape[:2]
    sm = np.zeros((h, w, 4), np.uint8)
    mets = {m: np.zeros((h, w, 4), np.uint8) for m in METALS}
    trim = {t: np.zeros((h, w, 4), np.uint8) for t in ('full', 'cuffs')}
    for s in SLOTS:
        st = layer(s, 'steel')
        if st is None: continue
        for t in trim:
            tr = layer(s, 'trim-' + t); m = (tr[..., 3] > 0) & (sm[..., 3] == 0)
            sm[m] = SLOT_RGB[s] + (255,); trim[t] = over(trim[t], tr)
        m = st[..., 3] > 0; sm[m] = SLOT_RGB[s] + (255,)
        for me in METALS: mets[me] = over(mets[me], layer(s, me))
    tiles += [sm] + [mets[m] for m in METALS] + [trim['full'], trim['cuffs']]
    return np.concatenate(tiles, 1)

man = {'tiles': ['base', 'slots'] + METALS + ['trim-full', 'trim-cuffs'], 'metals': METALS,
       'trim': {'iron': 'cuffs', 'steel': 'full', 'mithril': 'full', 'adamantium': 'cuffs', 'ebony': 'full', 'orcish': 'full', 'daedric': 'full'},
       'female': {}, 'male': {}}
n = 0
# FEMALE: female_base (27 outfits, 55 frames) on one fixed window of the shared 200x200 canvas - feet on row 180, body axis x=100
fm = json.load(open(f'{SRC}/female_base/manifest.json'))['frames']
x0 = min(f['x'] for f in fm.values()); x1 = max(f['x'] + f['w'] for f in fm.values())
half = max(100 - x0, x1 - 100); X0, X1 = 100 - half, 100 + half
Y0 = min(f['y'] for f in fm.values()); Y1 = max(f['y'] + f['h'] for f in fm.values())
man['female'] = {'window': [X0, Y0, X1 - X0, Y1 - Y0], 'outfits': {}}
for combo in sorted(os.listdir(f'{SRC}/female_base')):
    if not os.path.isdir(f'{SRC}/female_base/{combo}'): continue
    d = f'{SRC}/female/{combo}'; plate = os.path.isdir(d); frames = []
    for k, f in fm.items():
        def place(a):
            c = np.zeros((200, 200, 4), np.uint8); c[f['y']:f['y'] + a.shape[0], f['x']:f['x'] + a.shape[1]] = a
            return c[Y0:Y1, X0:X1]
        base = rd(f'{SRC}/female_base/{combo}/{k}.png')
        if plate: base = over(base, rd(f'{d}/pixel_cleanup/{k}.png'))
        layer = (lambda s, nm: place(rd(f'{d}/{s}_{nm}/{k}.png')) if os.path.isdir(f'{d}/{s}_{nm}') else None) if plate else None
        o = f'{OUT}/female/{combo}/{k}.png'; os.makedirs(os.path.dirname(o), exist_ok=True)
        Image.fromarray(strip(place(base), layer)).save(o, optimize=True); n += 1; frames.append(k)
    man['female']['outfits'][combo] = {'plate': plate, 'frames': sorted(frames)}
# MALE: male_baked steel as the base (every plate pixel and its steel trim is covered by the metal tiles), native frame size
man['male'] = {'outfits': {}}
for fo in sorted(os.listdir(f'{SRC}/male')):
    combo = '_'.join(TOK_M[t] for t in re.match(r'^head-(\w+)_top-(\w+)_legs-(\w+)$', fo).groups()); frames = []
    for an in sorted(os.listdir(f'{SRC}/male/{fo}')):
        d = f'{SRC}/male/{fo}/{an}'
        for fn in sorted(os.listdir(f'{d}/pixel_cleanup')):
            k = fn[:-4]; base = rd(f'{SRC}/male_baked/{fo}__steel/{an}/{fn}')
            layer = lambda s, nm: rd(f'{d}/{s}_{nm}/{fn}') if os.path.isdir(f'{d}/{s}_{nm}') else None
            o = f'{OUT}/male/{combo}/{k}.png'; os.makedirs(os.path.dirname(o), exist_ok=True)
            Image.fromarray(strip(base, layer)).save(o, optimize=True); n += 1; frames.append(k)
    man['male']['outfits'][combo] = {'plate': True, 'frames': sorted(frames)}
if MALE_V66:
    for fo in sorted(os.listdir(MALE_V66)):
        m_ = re.match(r'^head-(\w+)_top-(\w+)_legs-(\w+)$', fo)
        if not m_ or 'knight' in m_.groups(): continue
        combo = '_'.join(TOK_M[t] for t in m_.groups()); frames = []
        for an in sorted(os.listdir(f'{MALE_V66}/{fo}')):
            for fn in sorted(os.listdir(f'{MALE_V66}/{fo}/{an}')):
                o = f'{OUT}/male/{combo}/{fn}'; os.makedirs(os.path.dirname(o), exist_ok=True)
                Image.fromarray(strip(rd(f'{MALE_V66}/{fo}/{an}/{fn}'), None)).save(o, optimize=True); n += 1; frames.append(fn[:-4])
        man['male']['outfits'][combo] = {'plate': False, 'frames': sorted(frames)}
json.dump(man, open(f'{OUT}/manifest.json', 'w'), indent=1)
print('strips', n)
