"""WORN-ARMOUR: take the loose fragments off and around the hood in the female's attack from behind, frame 9-5.

The cloak's hood tile (cloak/female/9-5.png, tile 1) was cut from one hooded outfit, so it carries more than the hood:
bits of that outfit's arm, hands and hammer beside the hood and the black gap under its rim. composeStrip paints the
tile over every outfit, so on every outfit those bits land on and around the hood as fragments.

This script changes the hooded frames (<frames>/female/with-hood, in place - run it on a copy; compose_all.mjs makes
them, the game's own picture) before build_hoodfix.mjs turns them into hoodfix strips:
  1. the hood is the tile's cloth with its gaps closed (the cloth's outline, holes filled). Inside it, every px of
     the tile that is not cloth (the black gap, the cut-off hands) becomes the hood's cloth, the black gap in shadow;
  2. around the hood (within 6 px of it), a px of the tile that is not cloth, or a px of the outfit's helmet sticking
     out of the hood, shows the outfit's body as it is under the helmets (the colour 2 of the 3 helmets - leather,
     chain, plate - agree on: the arm, the hand, the hammer, the shoulder), else open air;
  3. a hole the picture closes in on (at most 12 px) is closed from the body, else with cloth; a loose piece of at
     most 4 px within 9 px of the hood goes.
The cloth px it lays are the Light Brown band's own colours (cloak manifest dyes[5]) and are written to a mask
(<frames>/female/clothmask) so the builder stores them as cloth and they take every dye.

usage: python -I fix_hood_fragments.py <frames root> <repo>/vendor/layered-armor [<record>-<frame>,...]   (default 9-5)
"""
import os, sys, re, json, collections
import numpy as np
from PIL import Image
from scipy import ndimage as nd

SRC, V = sys.argv[1], sys.argv[2]
FRAMES = set(sys.argv[3].split(',')) if len(sys.argv) > 3 else {'9-5'}
rd = lambda p: np.array(Image.open(p).convert('RGBA'))
cman = json.load(open(f'{V}/cloak/manifest.json'))
BAND = np.array(cman['dyes'][5], float)                          # Light Brown, as the frames are dyed
BAND_L = 0.299 * BAND[:, 0] + 0.587 * BAND[:, 1] + 0.114 * BAND[:, 2]
AROUND = 6
# the hammer's loose stripe per frame: the box x0..x1, y0..y1 it hangs in, and the px in it kept (the shoulder's outline)
STRIPE = {'9-5': (33, 36, 26, 34, [(36, 34)])}


def lum(c): return 0.299 * c[..., 0].astype(float) + 0.587 * c[..., 1] + 0.114 * c[..., 2]


def is_cloth(c):   # layeredArmor.js isCloth
    r, g, b = [c[..., i].astype(float) for i in range(3)]
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b); d = mx - mn
    with np.errstate(all='ignore'):
        h = np.where(mx == r, 60 * (g - b) / d, np.where(mx == g, 120 + 60 * (b - r) / d, np.nan))
        h = np.where(h < 0, h + 360, h)
        ok = (d > 0) & (mx >= 31) & ((d / np.maximum(mx, 1)) >= 0.15) & ~np.isnan(h)
    return ok & (h >= 60) & (h <= 165)


def snap(L):
    """the band colour nearest a luminance"""
    return BAND[np.abs(BAND_L[None, :] - np.asarray(L, float)[..., None]).argmin(-1)].astype(np.uint8)


def both_sides(m, k):
    """px with m on both sides within k px: above and below, or left and right"""
    def reach(dy, dx):
        r = np.zeros_like(m)
        for s in range(1, k + 1): r |= np.roll(m, (dy * s, dx * s), (0, 1))
        return r
    return (reach(1, 0) & reach(-1, 0)) | (reach(0, 1) & reach(0, -1))


def cloth_fill(O, todo, cloth, shade=1.0):
    """todo takes the luminance of the nearest cloth px, times shade, snapped to the band"""
    if not todo.any(): return
    _, (iy, ix) = nd.distance_transform_edt(~cloth, return_indices=True)
    L = lum(O)[iy, ix] * shade
    O[todo, :3] = snap(L[todo]); O[todo, 3] = 255


fam = lambda x: x if x in ('leather', 'chain') else 'plate'
wd, ud, md = f'{SRC}/female/with-hood', f'{SRC}/female/no-hood', f'{SRC}/female/clothmask'
st = collections.Counter()
for rf in sorted(FRAMES):
    cs = rd(f'{V}/cloak/female/{rf}.png'); cw = cs.shape[1] // 7
    T1 = cs[:, cw:2 * cw]; hoodA = T1[..., 3] > 0
    tcloth = hoodA & is_cloth(T1)
    hood = nd.binary_fill_holes(nd.binary_closing(tcloth, structure=np.ones((3, 3)), iterations=2) | tcloth)
    around = nd.binary_dilation(hood, iterations=AROUND) & ~hood
    near = nd.binary_dilation(hood, iterations=9)
    fn = f'f_{rf}.png'
    for fo in sorted(os.listdir(wd)):
        h, t, l = re.match(r'^(\w+)-helm_(\w+)-chest_(\w+)-legs$', fo).groups()
        metal = next((x for x in (h, t, l) if fam(x) == 'plate'), 'steel')
        H = rd(f'{wd}/{fo}/{fn}'); U = rd(f'{ud}/{fo}/{fn}'); O = H.copy()
        S = [rd(f'{ud}/{h2}-helm_{t}-chest_{l}-legs/{fn}') for h2 in ('leather', 'chain', metal)]
        # the body under the helmets: the px 2 of the 3 helmets agree on
        agree = np.zeros(hoodA.shape, bool); B = np.zeros_like(U)
        for i in range(3):
            for j in range(i + 1, 3):
                m = (S[i] == S[j]).all(-1) & ~agree
                B[m] = S[i][m]; agree |= m
        cloth_now = hood & (H[..., 3] > 0) & is_cloth(T1) & hoodA
        # 1. the hood: everything in it that is not the tile's cloth becomes cloth, the dark gap in shadow
        bad_in = hood & ~cloth_now
        dark_in = bad_in & hoodA & (lum(T1) < 50)
        cloth_fill(O, dark_in, cloth_now, 0.55)
        cloth_fill(O, bad_in & ~dark_in, cloth_now, 1.0)
        newcloth = bad_in.copy()
        # 2. around the hood: the tile's junk and the outfit's helmet sticking out -> the body under the helmets
        helmet_out = around & (H[..., 3] > 0) & (H == U).all(-1) & ~(agree & (B == U).all(-1))
        junk_out = around & hoodA & ~is_cloth(T1)
        fixo = helmet_out | junk_out
        body = fixo & agree & (B[..., 3] > 0)
        O[body] = B[body]
        air = fixo & ~body
        O[air] = 0
        # a gap that opens between the hood and the arm (drawn on both sides within 3 px): closed - by the hood's cloth
        # where the hood is the nearer, else by the nearest body px
        op = O[..., 3] > 0
        gap = air & both_sides(op, 3)
        if gap.any():
            clo = cloth_now | newcloth
            dh = nd.distance_transform_edt(~clo)
            other = op & ~clo
            db, (iy, ix) = nd.distance_transform_edt(~other, return_indices=True)
            gh = gap & (dh <= db); gb = gap & ~gh
            cloth_fill(O, gh, clo, 1.0); newcloth |= gh
            O[gb] = O[iy[gb], ix[gb]]
            st['gap_px'] += int(gap.sum())
        # the hammer's loose stripe: in 9-5 the handle's far edge is drawn 5 px off the handle as a 1 px black line with a
        # dark block at its foot, hanging in the air beside the hood (no other view's frame 5 has it) - it goes
        if rf in STRIPE:
            x0, x1, y0, y1, keep = STRIPE[rf]
            sm = np.zeros(hoodA.shape, bool); sm[y0:y1 + 1, x0:x1 + 1] = True
            for (kx, ky) in keep: sm[ky, kx] = False
            sm &= (O[..., 3] > 0) & ~(cloth_now | newcloth)
            O[sm] = 0; newcloth &= ~sm; air |= sm
            st['stripe_px'] += int(sm.sum())
        # 3. small holes this made closed, loose specks by the hood gone
        op = O[..., 3] > 0
        lab, k = nd.label(~op)
        border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
        for i in range(1, k + 1):
            if i in border: continue
            comp = lab == i
            if comp.sum() > 12 or not (comp & air).any(): continue
            fb = comp & agree & (B[..., 3] > 0) & ~hood; O[fb] = B[fb]
            fc = comp & ~fb
            cloth_fill(O, fc, cloth_now | newcloth, 1.0); newcloth |= fc
            st['hole_px'] += int(comp.sum())
        op = O[..., 3] > 0
        lab, k = nd.label(op, structure=np.ones((3, 3)))
        if k > 1:
            sz = nd.sum(op, lab, range(1, k + 1)); big = int(sz.argmax()) + 1
            for i, s in enumerate(sz, 1):
                if i != big and s <= 4 and (near & (lab == i)).any():
                    O[lab == i] = 0; newcloth &= lab != i; st['speck_px'] += int(s)
        st['hood_px'] += int(bad_in.sum()); st['body_px'] += int(body.sum()); st['air_px'] += int(air.sum())
        if (O != H).any():
            Image.fromarray(O).save(f'{wd}/{fo}/{fn}'); st['frames'] += 1
        if newcloth.any():
            os.makedirs(f'{md}/{fo}', exist_ok=True)
            Image.fromarray((newcloth * 255).astype(np.uint8)).save(f'{md}/{fo}/{fn}')
print(dict(st))
