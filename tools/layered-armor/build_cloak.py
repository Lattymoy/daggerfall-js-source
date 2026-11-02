"""CLOAK LAYER: build vendor/layered-armor/cloak/<body>/<record>-<frame>.png and cloak/manifest.json from the original
class sprites with hood and cape - 1540 (male, the Sorcerer) and 1541 (female) - registered onto the patch's chain frames
(all 27 outfits of a body share each frame's canvas, so one cloak layer fits every outfit).

Strip = 7 tiles on the outfit canvas: 0 cape (cloth px outside the hood), 1 head (the original hood + face px, painted
over the body; the face stops at the chin), 2-4 trim for a leather / chain / plate helmet (alpha only: what the worn
helmet pushes into the open air beside the hood - horn and wing tips), 5 loincloth (alpha only: the base's green cloth,
which takes the dye with the cloak), 6 shoulders (alpha only, back views: the shoulder rows beside the hood's foot, whose
armour lies over the cape's top corners). The manifest also carries the 10 clothing-dye bands (characters/dyes.js
CLOTHING_STARTS) and the green ramp they replace, the cloak templates and slots.

usage: python -I build_cloak.py <class-skins/Textures> <vendor/layered-armor> <van/pal.json> [<van>]
  Textures = the folder holding the class sprites (<archive>/<archive>_<record>-<frame>.png); pal.json = the game palette
  [[r,g,b],...]; van = the vanilla enemy frames (<archive>_<record>-<frame>.<w>x<h>.raw, palette indices - arena2's
  TEXTURE.475-490), needed for the bow.
Records 0-19 (walk, attack, hurt, idle) from the caped sorcerer of each body. The bow / cast (20-24) from the hooded,
caped archer of each body's own bow animation - vanilla 490 (male) and 489 (female), records 25-29 (arena2 TEXTURE.490 /
.489; the 4th argument) - placed unscaled by its body, its hood and cape (489's teal ramp mapped step for step onto the
green one) cut out as the other records'. The cape lies over the body on the frames where the archer turns its back.
"""
import sys, os, json
import numpy as np
from scipy import ndimage as ndi
from PIL import Image
TEX, VENDOR, PALJSON = sys.argv[1], sys.argv[2], sys.argv[3]
VAN = sys.argv[4] if len(sys.argv) > 4 else None
# per body: the donor archive; `grow_dark`: the hood's shadow px joined to the cloth; `loincloth`: False where the body's
# greens are boots, not a loincloth; `tight_hood`: the hood layer keeps only its cloth, outline and face opening;
# `trim_top_only`: the helmet's shoulder cover is never trimmed; `no_slivers`: the runtime drops a cape px that would
# only show as a 1-px line beside the body (manifest `noSlivers`)
# `hide_beside_hood`: frames where the body pokes out beside the hood where the original shows nothing (the female's
# hurt from behind: a shoulder's edge, the raised arm - on the far side) - those px go, on every outfit, as behind the original's hood;
# `borrow_cape` (bow): a frame whose archer hides the cape (it turns to draw the arrow) takes the cape of the frame before
# it, moved with the body's back - so the cloak never vanishes for one frame of the shot; `shadow_strip`: the male's side
# swing (6-2, 6-3), where the cape's upper part runs down the back's edge in shadow (near-black) to the lit hem - that
# shadowed strip is the cape too (the original's own dark px at its back's edge and beside the hem, joined to it,
# drawn as the original has them);
# `over_frames`: on-foot frames whose cape is drawn over the body (there: over the back's edge, as the original shows it)
BODIES = {'male': dict(donor=1540, bow=dict(archer=490, rec=25, band=192, borrow_cape={'24-3': '24-2'}),
                       shadow_strip=('6-2', '6-3'), over_frames=('6-2', '6-3')),
          'female': dict(donor=1541, grow_dark=True, loincloth=False, tight_hood=True, trim_top_only=True, no_slivers=True, shoulders_over_hood=True,
                         bow=dict(archer=489, rec=25, band=128, rim=(96,), borrow_cape={'24-3': '24-2'}),
                         hide_beside_hood=('13-0', '14-0'))}
BODY = 'male'
P = VENDOR + '/male/'
PAL = np.array(json.load(open(PALJSON)), np.float64)
rd = lambda p: np.array(Image.open(p).convert('RGBA'))
def reg(orig,base,rng=14):
    # offset (dy,dx): base[y,x] corresponds to orig[y+dy, x+dx]
    H,W=base.shape[:2]; best=(-1,0,0)
    bo=base[...,3]>0
    for dy in range(-rng,rng+1):
        for dx in range(-rng,rng+1):
            ys=slice(max(0,-dy),min(H,orig.shape[0]-dy)); xs=slice(max(0,-dx),min(W,orig.shape[1]-dx))
            b=base[ys,xs]; o=orig[max(0,dy):max(0,dy)+b.shape[0], max(0,dx):max(0,dx)+b.shape[1]]
            if b.shape[:2]!=o.shape[:2]: continue
            m=(b[...,3]>0)&(o[...,3]>0)&np.all(b[...,:3]==o[...,:3],-1)
            s=int(m.sum())
            if s>best[0]: best=(s,dy,dx)
    return best

def reg_bbox(orig, base, rng=12):
    """for a canvas larger than the donor (the female's fixed window): start at the feet / centre line, search around it"""
    def bb(a):
        ys, xs = np.where(a[..., 3] > 0); return ys.max(), (xs.min() + xs.max()) / 2
    ob, ox = bb(orig); bbm, bx = bb(base)
    dy0, dx0 = int(ob - bbm), int(round(ox - bx))
    H, W = base.shape[:2]; best = (-1, 0, 0)
    for dy in range(dy0 - rng, dy0 + rng + 1):
        for dx in range(dx0 - rng, dx0 + rng + 1):
            ys = slice(max(0, -dy), min(H, orig.shape[0] - dy)); xs = slice(max(0, -dx), min(W, orig.shape[1] - dx))
            b = base[ys, xs]; o = orig[max(0, dy):max(0, dy) + b.shape[0], max(0, dx):max(0, dx) + b.shape[1]]
            if b.shape[:2] != o.shape[:2] or b.size == 0: continue
            sc = int(((b[..., 3] > 0) & (o[..., 3] > 0) & np.all(b[..., :3] == o[..., :3], -1)).sum())
            if sc > best[0]: best = (sc, dy, dx)
    return best
import glob, re
def donor_frame(spec, rec, f):
    kind, a, _ = spec
    if kind == 'tex': return rd(f'{TEX}/{a}/{a}_{rec}-{f}.png')
    g = glob.glob(f'{VAN}/{a}_{rec}-{f}.*x*.raw')
    w_, h_ = map(int, re.search(r'\.(\d+)x(\d+)\.raw', g[0]).groups())
    I = np.fromfile(g[0], np.uint8).reshape(h_, w_); out = np.zeros((h_, w_, 4), np.uint8)
    out[..., :3] = PAL.astype(np.uint8)[I]; out[..., 3] = np.where(I > 0, 255, 0); return out
def iou_reg(src, base, rows=None, rng=12):
    """the offset (dy, dx) - base[y,x] ~ src[y+dy, x+dx] - with the best silhouette overlap, over `rows` of the base only"""
    so = src[..., 3] > 0; bo = base[..., 3] > 0
    if rows is not None: bo = bo & rows
    ys, xs = np.where(so); yb, xb = np.where(base[..., 3] > 0)
    dy0 = ys.max() - yb.max(); dx0 = int(round((xs.min() + xs.max()) / 2 - (xb.min() + xb.max()) / 2))
    H, W = bo.shape; best = (-1, dy0, dx0)
    for dy in range(dy0 - rng, dy0 + rng + 1):
        for dx in range(dx0 - rng, dx0 + rng + 1):
            S = place_(src, base.shape, dy, dx)[..., 3] > 0
            if rows is not None: S = S & rows
            u = (S | bo).sum(); sc = (S & bo).sum() / u if u else 0
            if sc > best[0]: best = (sc, dy, dx)
    return best[1], best[2]
def place_(src, shape, dy, dx):
    H, W = shape[:2]; o = np.zeros((H, W, 4), np.uint8)
    y0, x0 = max(0, -dy), max(0, -dx); y1, x1 = min(H, src.shape[0] - dy), min(W, src.shape[1] - dx)
    if y1 > y0 and x1 > x0: o[y0:y1, x0:x1] = src[y0 + dy:y1 + dy, x0 + dx:x1 + dx]
    return o
def largest(m):
    lab, n = ndi.label(m, structure=np.ones((3, 3)))
    if not n: return m
    sz = ndi.sum(m, lab, range(1, n + 1)); return lab == (int(np.argmax(sz)) + 1)
def van_index(a, rec, f):
    g = glob.glob(f'{VAN}/{a}_{rec}-{f}.*x*.raw')
    w_, h_ = map(int, re.search(r'\.(\d+)x(\d+)\.raw', g[0]).groups())
    return np.fromfile(g[0], np.uint8).reshape(h_, w_)
def bow_donor(k, base):
    """the bow's donor: the hooded, caped archer of this body's own bow animation, its hood and cape laid on the body's
    own frame - everything else stays the body's ('same')"""
    rec, f = map(int, k.split('-')); bw = BODIES[BODY]['bow']; v = rec - 20
    I = van_index(bw['archer'], bw['rec'] + v, f)
    if bw['band'] != 192:
        m = (I >= bw['band']) & (I < bw['band'] + 16); I = I.copy()
        for b2 in bw.get('rim', ()):                 # the cloth's rim highlights in another band, beside the cloth only
            r2 = (I >= b2) & (I < b2 + 16) & ndi.binary_dilation(m, structure=np.ones((3, 3)), iterations=2)
            I[r2] = I[r2] - b2 + 192
        I[m] = I[m] - bw['band'] + 192
    D = np.zeros(I.shape + (4,), np.uint8); D[..., :3] = PAL.astype(np.uint8)[I]; D[..., 3] = np.where(I > 0, 255, 0)
    band = (I >= 192) & (I < 208)
    # the cloak: the band's piece holding the hood (its top-most piece) and the pieces big enough to be the cape - never
    # the gloves on the stretched arms (small), never the boots (the feet rows)
    yb = np.where(I.any(1))[0].max()
    feet = np.zeros_like(band); feet[yb - 15:] = True
    # the boots: the band's pieces in the lowest 32 rows that reach down to the feet rows (the cape's hem never does)
    low = band.copy(); low[:yb - 32] = False
    ll, nl = ndi.label(low, structure=np.ones((3, 3)))
    if nl: feet |= np.isin(ll, [i for i in np.unique(ll[yb - 10:]) if i > 0])
    lab, n = ndi.label(band & ~feet, structure=np.ones((3, 3)))
    keep = []
    if n:
        rows_ = np.repeat(np.arange(I.shape[0])[:, None], I.shape[1], 1)
        sz = ndi.sum(band, lab, range(1, n + 1)); top = ndi.minimum(rows_, lab, range(1, n + 1))
        hood_id = int(np.argmin(top)) + 1
        cols_ = np.repeat(np.arange(I.shape[1])[None, :], I.shape[0], 0)
        hy0, hy1 = int(top[hood_id - 1]), int(ndi.maximum(rows_, lab, hood_id))
        hx0, hx1 = int(ndi.minimum(cols_, lab, hood_id)), int(ndi.maximum(cols_, lab, hood_id))
        # the cape hangs from the neck: a piece starting no lower than the hood's foot + 8 and lying under the hood
        # (overlapping its columns, 6 px of slack) - the gloves stand out at the arms' ends, the boots start at the knees
        keep = [hood_id]
        for i in range(n):
            if i + 1 == hood_id or sz[i] < 6: continue
            x0_, x1_ = int(ndi.minimum(cols_, lab, i + 1)), int(ndi.maximum(cols_, lab, i + 1))
            hood_d = ndi.binary_dilation(lab == hood_id, structure=np.ones((3, 3)), iterations=3)
            beside = bool((hood_d & (lab == i + 1)).any())       # a piece of the hood itself, split off by the bow before it
            if beside or (sz[i] >= 40 and top[i] <= hy1 + 8 and x0_ <= hx1 + 6 and x1_ >= hx0 - 6): keep.append(i + 1)
    cloth = np.isin(lab, keep) & (lab > 0)
    # the cape ends at its hem: on the hood and the pieces hanging from it, the lowest row whose longest unbroken run is
    # at least half the widest run of their lower half; below it is a boot cuff of the same green
    if keep:
        main = np.isin(lab, keep) & (lab > 0)        # the hood and every piece hanging from it
        mys = np.where(main.any(1))[0]; my0, my1 = int(mys.min()), int(mys.max())
        def longest(row):
            best = cur = 0
            for v_ in row: cur = cur + 1 if v_ else 0; best = max(best, cur)
            return best
        runs = np.array([longest(r) for r in main]); mid = (my0 + my1) // 2
        ref = runs[mid:my1 + 1].max()
        hem = int(max(r for r in range(mid, my1 + 1) if runs[r] >= 0.5 * ref))
        cloth[hem + 1:] = False
    h_, s_, v_ = hsv(D)
    dark = (I > 0) & (v_ < 0.4) & ~band
    for _ in range(2): cloth |= dark & ndi.binary_dilation(cloth, structure=np.ones((3, 3)))
    hood = (lab == keep[0]) if keep else cloth
    opening = ndi.binary_fill_holes(ndi.binary_closing(hood, structure=np.ones((3, 3)), iterations=2)) & (I > 0) & ~cloth
    body = D.copy(); body[cloth | band] = 0
    dy, dx = iou_reg(body, base)
    Dp = place_(D, base.shape, dy, dx)
    Cp = place_(np.repeat(cloth[..., None], 4, -1).astype(np.uint8), base.shape, dy, dx)[..., 0] > 0
    Op = place_(np.repeat(opening[..., None], 4, -1).astype(np.uint8), base.shape, dy, dx)[..., 0] > 0
    o = base.copy(); m = Cp | Op; o[m] = Dp[m]
    over = rec in (21, 22, 23)   # the archer's back to the viewer (back three-quarter, back, other three-quarter): the cape over it
    return o, over
_R = {}
_OVER = {}
def aligned(k, combo='chain_chain_chain'):
    if int(k.split('-')[0]) >= 20:
        base = rd(P + f'{combo}/{k}.png')
        if base.shape[1] > 200 and base.shape[1] % 11 == 0: base = base[:, :base.shape[1] // 11]
        o, _OVER[(BODY, k)] = bow_donor(k, base)
        return base, o
    d = BODIES[BODY]['donor']
    base = rd(P + f'{combo}/{k}.png'); orig = rd(f'{TEX}/{d}/{d}_{k}.png')
    if (BODY, k) not in _R: _R[(BODY, k)] = (reg if BODY == 'male' else reg_bbox)(orig, base)[1:]
    dy, dx = _R[(BODY, k)]
    o = np.zeros_like(base); H, W = base.shape[:2]
    for y in range(H):
        yy = y + dy
        if 0 <= yy < orig.shape[0]:
            x0 = max(0, -dx); x1 = min(W, orig.shape[1] - dx)
            if x1 > x0: o[y, x0:x1] = orig[yy, x0 + dx:x1 + dx]
    return base, o
def hsv(A):
    rgb=A[...,:3].astype(np.float64)/255; mx=rgb.max(-1); mn=rgb.min(-1); d=mx-mn
    h=np.zeros_like(mx); r,g,b=rgb[...,0],rgb[...,1],rgb[...,2]
    m=d>0
    h[m&(mx==r)]=((g-b)[m&(mx==r)]/d[m&(mx==r)])%6
    h[m&(mx==g)]=((b-r)[m&(mx==g)]/d[m&(mx==g)])+2
    h[m&(mx==b)]=((r-g)[m&(mx==b)]/d[m&(mx==b)])+4
    return h*60, np.where(mx>0,d/np.maximum(mx,1e-9),0), mx
def skin(A):
    h,s,v=hsv(A); return (A[...,3]>0)&(h>=8)&(h<=45)&(s>=0.25)&(s<=0.75)&(v>=0.45)
def green(A):
    h,s,v=hsv(A); return (A[...,3]>0)&(h>=60)&(h<=165)&(s>=0.15)&(v>=0.12)
def frame(k):
    if k in BODIES[BODY].get('over_frames', ()): _OVER[(BODY, k)] = True   # (the cape over the back's edge: see BODIES)
    b,o=aligned(k); op=o[...,3]>0
    same=(b[...,3]>0)&op&np.all(b[...,:3]==o[...,:3],-1)
    G=green(o)&~same
    h_,s_,v_=hsv(o)
    D=op&~same&(v_<0.40)&(s_<0.5)&~skin(o)
    cl=G.copy()
    for _ in range(2): cl|=D&ndi.binary_dilation(cl,structure=np.ones((3,3)))
    if BODIES[BODY].get('grow_dark'):
        # a hood in shadow (the female's hurt pose) is nearly black: take every dark px joined to the cloth, not two rings
        cl = ndi.binary_propagation(cl, structure=np.ones((3, 3)), mask=cl | D)
    lab,n=ndi.label(cl,structure=np.ones((3,3)))
    if n:
        sz=ndi.sum(cl,lab,range(1,n+1)); cl&=np.isin(lab,[i+1 for i,s in enumerate(sz) if s>=6])
    # loincloth green showing through a back-view cape: holes inside the cloth that are green
    holes=ndi.binary_fill_holes(cl)&~cl&green(o)
    cl|=holes
    # head zone
    t=int(np.where(cl.any(1))[0][0])
    X=np.arange(b.shape[1]); xs=np.where(cl[t:t+8].any(0))[0]; cx=np.median(xs)
    sk=skin(b); sh=t+22
    for y in range(t+8,min(b.shape[0],t+40)):
        if (sk[y]&(np.abs(X-cx)>=9)).sum()>=3: sh=y; break
    zone=np.zeros_like(cl); zone[:sh]=True
    # the face: only skin INSIDE the hood's opening (never the shoulder / upper arm below or beside it)
    hood=cl&zone
    inside=ndi.binary_fill_holes(ndi.binary_closing(hood,structure=np.ones((3,3)),iterations=3))
    face=skin(o)&zone&~same&inside
    seed=hood|face
    Hm=ndi.binary_fill_holes(ndi.binary_dilation(seed,structure=np.ones((3,3)),iterations=1))&zone
    Hm&=~(skin(o)&~inside)            # never an arm
    # THE HOOD PAINTS, IT DOES NOT ERASE: the head tile is the donor's hood + face px, drawn over the body; nothing else in
    # the head area is cleared, so the shoulder armour under and beside the hood stays whole.
    # its non-cloth px (the face in the hood's shadow) stop at the chin - the lowest row any helmet reaches near the middle
    # - so the donor's own collar and chest never paint over the chest that is worn
    fam = {'l': 'leather', 'c': 'chain', 'p': 'plate'}
    def tile0(name):
        a_ = rd(P + f'{name}.png')
        return a_[:, :b.shape[1]] if a_.shape[1] > b.shape[1] else a_
    HS = [tile0(f'{n}_chain_chain/{k}') for n in fam.values()]
    hv = np.zeros_like(Hm)
    for i in range(3):
        for j in range(i + 1, 3):
            A, B = HS[i], HS[j]
            hv |= ((A[..., 3] > 0) | (B[..., 3] > 0)) & ~((A[..., 3] > 0) & (B[..., 3] > 0) & np.all(A[..., :3] == B[..., :3], -1))
    hood_x = np.where(hood.any(0))[0]; hcx = (hood_x.min() + hood_x.max()) / 2 if len(hood_x) else b.shape[1] / 2
    Xc = np.abs(np.arange(b.shape[1]) - hcx) <= 6
    hvc = hv & zone & Xc[None, :]
    chin = int(np.where(hvc.any(1))[0].max()) if hvc.any() else sh
    rows_ok = np.zeros_like(Hm); rows_ok[:chin + 1] = True
    headpx = (cl & Hm) | (op & Hm & ~same & rows_ok & ndi.binary_dilation(inside, structure=np.ones((3, 3))))
    G_in = green(o) & ~same & Hm
    if BODIES[BODY].get('tight_hood') and G_in.sum() >= 0.6 * max(1, (cl & Hm).sum()):
        # (only a hood that is mostly lit cloth: a hood mostly in shadow - a low head in an attack, the hurt pose - keeps
        # every px of it as drawn)
        # the hood's cloth: its green, a 1-px dark outline round the green, and the dark shadow inside the face opening -
        # never the dark px further out along the hood's outside edge (the donor's own shoulder shading lies there, and
        # painted over a worn pauldron it reads as a bare arm with noise)
        G0 = green(o) & ~same
        insideG = ndi.binary_fill_holes(ndi.binary_closing(G0 & zone, structure=np.ones((3, 3)), iterations=3))
        hood_cloth = (G0 | (cl & ndi.binary_dilation(G0, structure=np.ones((3, 3)))) | (cl & insideG)) & Hm
        # no slivers: the hood keeps its body (what a 3x3 opening keeps) and a 1-px rim round it - never a strip of 1-2 px
        # hanging down beside the shoulder
        body_ = ndi.binary_opening(hood_cloth, structure=np.ones((3, 3)))
        kept = hood_cloth & ndi.binary_dilation(body_, structure=np.ones((3, 3)))
        if kept.sum() >= 0.85 * hood_cloth.sum(): hood_cloth = kept   # a hood seen thin all over (a low head in an attack,
                                                                        # the hurt pose) keeps every px
        face_ok = op & Hm & ~same & rows_ok & ndi.binary_dilation(insideG, structure=np.ones((3, 3))) & ~cl
        # the face only on the side she faces: front views both, the three-quarter and side views (facing left) the
        # hood's left half, from behind none - never the donor's neck or ear on the back of the head
        offv = int(k.split('-')[0]) % 5
        if int(k.split('-')[0]) >= 20: offv = 4 if _OVER[(BODY, k)] else 0   # the bow: from behind no face, else both halves
        hx_ = np.where(hood_cloth.any(0))[0]
        if offv in (3, 4) or not len(hx_): face_ok[:] = False
        elif offv in (1, 2): face_ok[:, int((hx_.min() + hx_.max()) / 2) + 1:] = False
        headpx = hood_cloth | face_ok
    if 5 <= int(k.split('-')[0]) < 10:
        # ATTACK: the arms swing round and over the head, so the shoulder line (`sh`) the head zone hangs from is often
        # found too high and most of the hood fell to the cape - which is drawn only into the picture's gaps, leaving the
        # worn helmet uncovered. Here the hood is every px of cloth lying on or right beside any helmet (every helmet's
        # own px, on every chest), its holes filled; and nothing far from a helmet is hood.
        RESTS_ = ('leather_leather', 'chain_chain', 'plate_plate', 'plate_leather', 'leather_plate', 'chain_leather', 'leather_chain', 'plate_chain', 'chain_plate')
        helm = np.zeros_like(Hm)
        for rest in RESTS_:
            T = [tile0(f'{n}_{rest}/{k}') for n in fam.values()]
            for i in range(3):
                helm |= T[i][..., 3] > 0
            same3 = np.ones_like(Hm)
            for i in range(1, 3): same3 &= (T[0][..., 3] > 0) & (T[i][..., 3] > 0) & np.all(T[0][..., :3] == T[i][..., :3], -1)
            helm &= ~same3 | ~(T[0][..., 3] > 0)
        helmd = np.zeros_like(Hm)
        for rest in RESTS_:
            T = [tile0(f'{n}_{rest}/{k}') for n in fam.values()]
            for i in range(3):
                for j in range(i + 1, 3):
                    A, B = T[i], T[j]
                    helmd |= ((A[..., 3] > 0) | (B[..., 3] > 0)) & ~((A[..., 3] > 0) & (B[..., 3] > 0) & np.all(A[..., :3] == B[..., :3], -1))
        near_h = ndi.binary_dilation(helmd, structure=np.ones((3, 3)), iterations=2)
        ext = cl & near_h
        lab_, n_ = ndi.label(cl, structure=np.ones((3, 3)))
        ext |= cl & np.isin(lab_, [i for i in np.unique(lab_[ext]) if i > 0]) & ndi.binary_dilation(helmd, structure=np.ones((3, 3)), iterations=4)
        Hm = (Hm & ndi.binary_dilation(helmd, structure=np.ones((3, 3)), iterations=6)) | ext
        Hm = ndi.binary_fill_holes(ndi.binary_closing(Hm, structure=np.ones((3, 3)), iterations=2)) & (cl | (headpx & Hm) | same)
        headpx = (headpx & Hm) | (cl & Hm)
        # inside the hood, a px the donor shares with the base by chance (a lone dark px, not part of an arm or the weapon
        # in front of the face) is the donor's hood too - else the worn helmet shows through it as specks
        labS, nS = ndi.label(same, structure=np.ones((3, 3)))
        if nS:
            szS = ndi.sum(same, labS, range(1, nS + 1))
            front = np.isin(labS, [i + 1 for i, v in enumerate(szS) if v >= 30])
            headpx |= Hm & same & ~front & op
        else:
            front = same
        # ...and where the arms cross in front of the head the donor's hood is cut into pieces: every px of any helmet
        # near the hood that is not behind an arm or the weapon is the donor's - its hood's shading between the arms;
        # where the donor shows nothing there the helmet is trimmed (below, `atk_clear`)
        near_hood = ndi.binary_dilation(Hm | (headpx & op), structure=np.ones((3, 3)), iterations=7)
        hole = helmd & near_hood & ~front & ~headpx
        headpx |= hole & op
        atk_clear = hole & ~op
        labH, nH = ndi.label(headpx, structure=np.ones((3, 3)))       # no lone donor px left floating
        if nH:
            szH = ndi.sum(headpx, labH, range(1, nH + 1)); headpx &= ~np.isin(labH, [i + 1 for i, v in enumerate(szH) if v <= 3])
    cape = cl & ~Hm
    # THE TRIM (cleared), one mask a helmet family: the WORN helmet stays under the hood - its neck guard, gorget or brim
    # lying on the shoulders is part of the picture - and only what it pushes out into the open air beside the hood goes
    # (horn and wing tips, a brim's point), on any chest, near the hood; plus any shred of it that trimming cuts loose
    # (<= 8 px, not a shred before).
    RESTS = ('leather_leather', 'chain_chain', 'plate_plate', 'plate_leather', 'leather_plate', 'chain_leather', 'leather_chain', 'plate_chain', 'chain_plate')
    zrows = np.zeros_like(Hm); zrows[:sh + 14] = True
    near = zrows & ndi.binary_dilation(Hm, structure=np.ones((3, 3)), iterations=16)
    def specks(m):
        lab, n = ndi.label(m, structure=np.ones((3, 3)))
        if not n: return np.zeros_like(m)
        sz = ndi.sum(m, lab, range(1, n + 1)); return np.isin(lab, [i + 1 for i, v in enumerate(sz) if v <= 8])
    trims = {}
    for f, fname in fam.items():
        # above the shoulders only a helmet can stand where another helmet leaves the picture empty; on the shoulders it
        # must be empty under both others (else it is the body the other helmets show there)
        above = np.zeros_like(Hm); above[:sh] = True
        air = np.zeros_like(Hm)
        safe = np.ones_like(Hm)
        for rest in RESTS:
            U = tile0(f'{fname}_{rest}/{k}'); a_ = U[..., 3] > 0
            empties = [~(tile0(f'{n}_{rest}/{k}')[..., 3] > 0) for n in fam.values() if n != fname]
            air_r = a_ & ((above & (empties[0] | empties[1])) | (empties[0] & empties[1]))
            air |= air_r
            safe &= air_r | ~a_            # under this chest: the helmet's own px in the open air, or nothing at all
        if BODIES[BODY].get('trim_top_only'):
            air &= safe                    # never a px that any chest fills with its own armour (a pauldron's spike)
        tr = air & near & ~headpx
        for rest in RESTS:
            U = tile0(f'{fname}_{rest}/{k}'); before = U[..., 3] > 0
            tr |= specks((before & ~tr) | headpx) & ~specks(before) & near & ~headpx
        if BODIES[BODY].get('trim_top_only') and not (5 <= int(k.split('-')[0]) < 10):
            # this body's helmets carry the shoulder cover themselves (the chain coif's flare, the leather cowl, the plate
            # neck guard): only the upper part of the hood - where horn and wing tips stand - is trimmed, never the
            # shoulder rows, so the cover shows whole below the hood
            hy = np.where(hood.any(1))[0]
            lim = int(hy.min() + 0.6 * (hy.max() - hy.min())) if len(hy) else sh
            tr[lim:] = False
            # ...and a shred that cut leaves floating (a horn's curled tip below the line) still goes - <= 8 px, cut loose
            for rest in RESTS:
                U = tile0(f'{fname}_{rest}/{k}'); before = U[..., 3] > 0
                tr |= specks((before & ~tr) | headpx) & ~specks(before) & near & ~headpx
        if 5 <= int(k.split('-')[0]) < 10:
            tr |= atk_clear & ~headpx
            for rest in RESTS:                                         # and the shreds that leaves, on any chest
                U = tile0(f'{fname}_{rest}/{k}'); before = U[..., 3] > 0
                tr |= specks((before & ~tr) | headpx) & ~specks(before) & ~headpx & ndi.binary_dilation(atk_clear, structure=np.ones((3, 3)), iterations=3)
        # THE RIM: the worn helmet's own px in a 3-px ring round the hood, above the chin - its crown and edges peeping
        # out round the hood (all helmets reach there, so `air` alone never caught them)
        hm_fill = ndi.binary_fill_holes(headpx)
        ring = ndi.binary_dilation(hm_fill, structure=np.ones((3, 3)), iterations=3) & ~hm_fill
        rows_rim = np.zeros_like(Hm); rows_rim[:chin + 1] = True
        own_f = np.zeros_like(Hm)
        for rest in RESTS:
            U = tile0(f'{fname}_{rest}/{k}'); o_ = U[..., 3] > 0
            for n in fam.values():
                if n == fname: continue
                A = tile0(f'{n}_{rest}/{k}'); o_ &= ~((A[..., 3] > 0) & np.all(A[..., :3] == U[..., :3], -1))
            own_f |= o_
        tr |= own_f & ring & rows_rim & ~headpx
        for rest in RESTS:                                             # and what that cuts loose
            U = tile0(f'{fname}_{rest}/{k}'); before = U[..., 3] > 0
            tr |= specks((before & ~tr) | headpx) & ~specks(before) & ~headpx & ndi.binary_dilation(ring, structure=np.ones((3, 3)), iterations=2)
        trims[f] = tr
    # THE SHOULDERS (back views only): the shoulder armour lies over the cape's top corners - the cape hangs from under
    # the pauldrons instead of cutting them - every px of the shoulder rows beside the hood's foot
    sho = np.zeros_like(Hm)
    if (_OVER[(BODY, k)] if int(k.split('-')[0]) >= 20 else int(k.split('-')[0]) % 5 in (3, 4)):
        foot = np.where(Hm[max(0, sh - 3)])[0] if Hm[max(0, sh - 3)].any() else np.where(Hm.any(0))[0]
        x0, x1 = int(foot.min()), int(foot.max())
        X = np.arange(b.shape[1])[None, :]; Y = np.arange(b.shape[0])[:, None]
        sho = (Y >= sh - 6) & (Y <= sh + 10) & ((X < x0 - 1) | (X > x1 + 1)) & ~Hm
    sho_back = sho.copy()
    rec_ = int(k.split('-')[0])
    sho_pre_f = sho.copy()
    if BODIES[BODY].get('shoulders_over_hood') and rec_ < 20 and ((rec_ < 5 or 15 <= rec_) or rec_ % 5 in (3, 4)):
        # WALK / IDLE (female): the shoulder armour as the body wears it without a cloak, over the hood's foot - every px
        # the chest piece owns (it changes from one chest to another, never from one helmet to another) from the hood's
        # chin down to 14 rows below; the hood keeps only the head
        own_top = np.zeros_like(Hm); helm_own = np.zeros_like(Hm)
        RS = ('leather', 'chain', 'plate')
        for hd in RS:
            for lg in RS:
                T = [tile0(f'{hd}_{tp}_{lg}/{k}') for tp in RS]
                for i in range(3):
                    for j in range(i + 1, 3):
                        A, B = T[i], T[j]
                        own_top |= ((A[..., 3] > 0) | (B[..., 3] > 0)) & ~((A[..., 3] > 0) & (B[..., 3] > 0) & np.all(A[..., :3] == B[..., :3], -1))
        for tp in RS:
            for lg in RS:
                T = [tile0(f'{hd}_{tp}_{lg}/{k}') for hd in RS]
                for i in range(3):
                    for j in range(i + 1, 3):
                        A, B = T[i], T[j]
                        helm_own |= ((A[..., 3] > 0) | (B[..., 3] > 0)) & ~((A[..., 3] > 0) & (B[..., 3] > 0) & np.all(A[..., :3] == B[..., :3], -1))
        Y = np.arange(b.shape[0])[:, None]
        band = (Y >= chin - 2) & (Y <= chin + 14)
        if rec_ % 5 in (0, 1, 2) and (rec_ < 5 or 15 <= rec_):
            # facing: the shoulders as worn, from the top of the picture down - the side views' pauldron rises beside the
            # head into the hood's drape; every px the chest piece owns (never one a helmet owns) shows as without a cloak
            # the pauldron is read with the chain helmet on (it sits inside the hood and leaves the shoulders bare): every
            # px the chest decides there, less the chain helmet's own px
            own_c = np.zeros_like(Hm)
            for lg in RS:
                T = [tile0(f'chain_{tp}_{lg}/{k}') for tp in RS]
                for i in range(3):
                    for j in range(i + 1, 3):
                        A, B = T[i], T[j]
                        own_c |= ((A[..., 3] > 0) | (B[..., 3] > 0)) & ~((A[..., 3] > 0) & (B[..., 3] > 0) & np.all(A[..., :3] == B[..., :3], -1))
            chelm = np.ones_like(Hm)
            for tp in RS:
                C_ = tile0(f'chain_{tp}_leather/{k}'); L_ = tile0(f'leather_{tp}_leather/{k}'); P_ = tile0(f'plate_{tp}_leather/{k}')
                ch_ = (C_[..., 3] > 0)
                for O_ in (L_, P_): ch_ &= ~((O_[..., 3] > 0) & np.all(O_[..., :3] == C_[..., :3], -1))
                chelm &= ch_ | ~(C_[..., 3] > 0)
            chelm &= zone
            chd = ndi.binary_dilation(ndi.binary_fill_holes(chelm), structure=np.ones((3, 3)))
            pa = own_c & ~chd
            pa = ndi.binary_fill_holes(ndi.binary_closing(pa, structure=np.ones((3, 3)), iterations=2)) & ~chd & (b[..., 3] > 0)
            labP, nP = ndi.label(pa, structure=np.ones((3, 3)))
            if nP:
                szP = ndi.sum(pa, labP, range(1, nP + 1)); pa &= np.isin(labP, [i + 1 for i, v in enumerate(szP) if v >= 12])
            sho |= ((own_top & ~helm_own) | pa) & (Y <= chin + 14)
            if rec_ % 5 in (1, 2):
                # SIDE / THREE-QUARTER: the hood is the head and nothing more - outside the chain helmet's outline (1 px of
                # slack) every px of the body shows as worn without a cloak, below the head and beside it: the shoulder from
                # where the hood starts (the back of the hood no longer bulges over the far pauldron)
                head = ndi.binary_dilation(ndi.binary_fill_holes(chelm), structure=np.ones((3, 3)))
                body_c = np.zeros_like(Hm)
                for tp in RS:
                    for lg in RS:
                        body_c |= tile0(f'chain_{tp}_{lg}/{k}')[..., 3] > 0
                sho |= body_c & ~head & (b[..., 3] > 0) & (Y <= chin + 14)
        elif rec_ % 5 in (3, 4):
            # FROM BEHIND: the cape covers the back, the pauldrons stay whole - every chest-owned px of the shoulder band
            # outside the cape's own width (taken just below the band, where it hangs straight), over the cape's yoke
            capeall = cl | headpx
            r0 = min(b.shape[0] - 1, chin + 18)
            cols = np.where(capeall[r0:r0 + 6].any(0))[0]
            if len(cols):
                X = np.arange(b.shape[1])[None, :]
                outside = (X < cols.min()) | (X > cols.max())
                sho |= own_top & ~helm_own & band & outside
    sho_f_only = sho & ~sho_pre_f & ~sho_back                       # (what the female's walk / idle rule gave back)
    # loincloth: base green cloth components (>=20 px) of the chain base below the shoulders
    gb=green(b)&(np.arange(b.shape[0])[:,None]>=sh+8)
    lab,n=ndi.label(ndi.binary_dilation(gb,structure=np.ones((3,3)),iterations=1)&gb,structure=np.ones((3,3)))
    lc=np.zeros_like(gb)
    if n:
        sz=ndi.sum(gb,lab,range(1,n+1)); lc=np.isin(lab,[i+1 for i,s in enumerate(sz) if s>=20])
    if BODIES[BODY].get('loincloth') is False: lc[:] = False   # no green loincloth on this body: its greens are boots
    # exclude boots: teal hue
    H=hsv(b)[0]; lc&=(H<=140)
    if lc.any():
        bot = np.where((b[..., 3] > 0).any(1))[0][-1]
        lab, n = ndi.label(lc, structure=np.ones((3, 3)))
        low = np.unique(lab[bot - 30:][lab[bot - 30:] > 0]); lc &= ~np.isin(lab, low)
    def tile(m,src=o):
        t_=np.zeros_like(src); t_[m]=src[m]; t_[m,3]=255; return t_
    alpha=lambda m:tile(m,np.full_like(o,255))
    # NO HELMET ON THE HOOD: in and right round the hood, down to the chin, every px a helmet owns (it changes with the
    # helmet, on any chest) that the hood does not paint takes the original's own px there (its face, its hood's shadow)
    # - never the chain helmet the original shares with the body - and where the original has none, the hood's cloth
    # (its nearest px, cloth or shadow): nothing is cut, so no hole opens. The shoulders given back as worn (`sho`) are never touched.
    RS3 = ('leather', 'chain', 'plate')
    helmAny = np.ones_like(Hm)          # a helmet's px on EVERY chest and legs that show anything there - never a px some
    for tp in RS3:                      # chest owns (its collar, its pauldron)
        for lg in RS3:
            T = [tile0(f'{hd}_{tp}_{lg}/{k}') for hd in RS3]
            d_ = np.zeros_like(Hm); any_ = np.zeros_like(Hm)
            for i in range(3):
                any_ |= T[i][..., 3] > 0
                for j in range(i + 1, 3):
                    A, B = T[i], T[j]
                    d_ |= ((A[..., 3] > 0) | (B[..., 3] > 0)) & ~((A[..., 3] > 0) & (B[..., 3] > 0) & np.all(A[..., :3] == B[..., :3], -1))
            helmAny &= d_ | ~any_
    hoodF = ndi.binary_fill_holes(ndi.binary_closing(headpx, structure=np.ones((3, 3)), iterations=2))
    hb_ = int(np.where(hoodF.any(1))[0].max()) if hoodF.any() else chin   # down to the hood's own foot: a helmet's
    rows_h = np.zeros_like(Hm); rows_h[:max(chin + 3, hb_ + 2)] = True       # neck guard reaches below the chin at the sides
    allOp = np.ones_like(Hm); famOp = {f_: np.zeros_like(Hm) for f_ in 'lcp'}
    for tp in RS3:
        for lg in RS3:
            for hd in RS3:
                o_ = tile0(f'{hd}_{tp}_{lg}/{k}')[..., 3] > 0
                allOp &= o_; famOp[hd[0]] |= o_
    # (back views on foot: a helmet's own px - its neck guard - in the shoulder rows is no shoulder: it stays under the cape)
    _ot = locals().get('own_top')                                  # (never what a chest piece owns)
    backHelm = sho_back & helmAny & (~_ot if _ot is not None else True)
    if int(k.split('-')[0]) >= 20: backHelm[:] = False              # (the bow's arm crosses the shoulder rows: keep it)
    sho &= ~backHelm
    Rg = ndi.binary_dilation(hoodF, structure=np.ones((3, 3)), iterations=2) & rows_h & ~backHelm & helmAny & (famOp['l'] | famOp['c'] | famOp['p']) & ~headpx & ~sho
    take = Rg & op & ~same
    # where the original has nothing of its own: inside every body (all helmets draw a px there) the hood's cloth, so no
    # hole opens; on the outline (some helmet draws nothing there) the helmets that do are trimmed back to it
    cover = Rg & ~take & allOp
    # (never a px the hood cannot reach through its own: a lone donor / cloth px out in the air is a speck)
    keep_ = ndi.binary_propagation(headpx, structure=np.ones((3, 3)), mask=headpx | take | cover)
    take &= keep_; cover &= keep_
    # just below and beside it (a helmet's gorget, its cheek plates - within 12 px of the hood, at most 12 rows below its
    # foot, over the body every helmet draws): the original's own px there, where it has one - its own neck under the hood
    # (the coif it shares with the chain helmet too: that is how the hooded original looks there)
    dH = ndi.distance_transform_edt(~hoodF)
    hx_ = np.where(hoodF.any(0))[0]
    Xs = np.zeros_like(Hm)
    if len(hx_): Xs[:, max(0, hx_.min() - 2):hx_.max() + 3] = True
    rows6 = np.zeros_like(Hm); rows6[:hb_ + 13] = True
    take |= ~backHelm & (dH <= 12) & rows6 & Xs & helmAny & allOp & op & ~headpx & ~sho & ~cover
    # and a helmet's own piece out in the air near the hood (a horn, a crest: no other helmet draws there, on any chest)
    # is trimmed off
    airZ = (dH <= 12) & rows6 & helmAny & ~backHelm & ~headpx & ~take & ~cover & ~sho
    for f_ in 'lcp':
        others = np.zeros_like(Hm)
        for g_ in 'lcp':
            if g_ != f_: others |= famOp[g_]
        trims[f_] |= airZ & famOp[f_] & ~others
    for f_, fname in fam.items():
        cut_ = Rg & ~take & ~allOp & famOp[f_]
        for rest in RESTS:                       # (never a cut that leaves a bit of the worn shoulder floating alone)
            U = tile0(f'{fname}_{rest}/{k}'); before = U[..., 3] > 0
            lone = specks((before & ~(trims[f_] | cut_)) | headpx | take | cover | sho) & ~specks(before | sho) & sho
            if lone.any(): cut_ &= ~ndi.binary_dilation(lone, structure=np.ones((3, 3)), iterations=2)
        trims[f_] = trims[f_] | cut_
    nearRg = ndi.binary_dilation(Rg | airZ, structure=np.ones((3, 3)), iterations=3) | (helmAny & (dH <= 20))
    for f_, fname in fam.items():                                      # and the shreds that trim cuts loose, on any chest
        for rest in RESTS:
            U = tile0(f'{fname}_{rest}/{k}'); before = U[..., 3] > 0
            trims[f_] |= specks((before & ~trims[f_]) | headpx | take | cover) & ~specks(before) & ~headpx & ~take & ~cover & ~sho & nearRg
    o_h = o.copy()
    # inside the hood's cloth (its filled outline) nothing but cloth: a px taken there is the nearest cloth px
    cloth0 = green(o) & headpx
    capC = ndi.binary_fill_holes(ndi.binary_closing(cloth0, structure=np.ones((3, 3)), iterations=2))
    inC = np.zeros_like(Hm)                                  # (a crumb in the cloth - never the face opening's own px)
    labC, nC_ = ndi.label((take | cover) & capC, structure=np.ones((3, 3)))
    for i_ in range(1, nC_ + 1):
        m_ = labC == i_
        rim_ = ndi.binary_dilation(m_, structure=np.ones((3, 3))) & ~m_
        if m_.sum() <= 6 and rim_.any() and cloth0[rim_].mean() >= 0.6: inC |= m_
    if inC.any() and cloth0.any():
        _, (cy_, cx_) = ndi.distance_transform_edt(~cloth0, return_indices=True)
        o_h[inC] = o[cy_[inC], cx_[inC]]; o_h[inC, 3] = 255
    cover_o = cover & ~inC
    clothAll = headpx | take                            # the nearest px of the hood as drawn: its cloth by the cloth, its shadow by the shadow
    if cover_o.any() and clothAll.any():
        _, (cy_, cx_) = ndi.distance_transform_edt(~clothAll, return_indices=True)
        o_h[cover_o] = o[cy_[cover_o], cx_[cover_o]]; o_h[cover_o, 3] = 255
    headpx = headpx | take | cover
    clothH = green(o_h) & headpx
    capH = ndi.binary_fill_holes(ndi.binary_closing(clothH, structure=np.ones((3, 3)), iterations=2))
    spk = headpx & capH & ~clothH
    labK, nK = ndi.label(spk, structure=np.ones((3, 3)))
    for i_ in range(1, nK + 1):
        m_ = labK == i_
        if m_.sum() > 4: continue
        rim_ = ndi.binary_dilation(m_, structure=np.ones((3, 3))) & ~m_
        if rim_.any() and (clothH[rim_].mean() >= 0.75):              # a speck in the cloth, not the face's edge
            _, (iy, ix) = ndi.distance_transform_edt(~clothH, return_indices=True)
            o_h[m_] = o_h[iy[m_], ix[m_]]
    # a crumb of hood (<= 3 px) left boxed in by the shoulders drawn over it reads as a dot on the pauldron: the shoulder
    # takes it too (never a helmet's px)
    vis_ = headpx & ~sho
    labV, nV = ndi.label(vis_, structure=np.ones((3, 3)))
    if nV > 1:
        szV = ndi.sum(vis_, labV, range(1, nV + 1))
        for i_ in range(1, nV + 1):
            m_ = labV == i_
            if szV[i_ - 1] <= 3 and szV[i_ - 1] < szV.max() and (ndi.binary_dilation(m_, structure=np.ones((3, 3))) & sho).any() \
                    and not (m_ & helmAny).any():
                sho |= m_
    strip_s = np.zeros_like(Hm)
    if k in BODIES[BODY].get('shadow_strip', ()) and cape.any():
        _, _, v_s = hsv(o)
        hx_s = np.where(cape.any(0))[0].mean(); bx_s = np.where(op.any(0))[0].mean()
        hb_s = int(np.where(headpx.any(1))[0].max()) if headpx.any() else 0
        band_s = np.zeros_like(Hm)
        for y_ in range(max(0, hb_s - 2), int(np.where(cape.any(1))[0].min()) + 1):
            xx = np.where(op[y_])[0]
            if not len(xx): continue
            if hx_s > bx_s: band_s[y_, max(0, xx.max() - 4):xx.max() + 1] = True
            else: band_s[y_, xx.min():xx.min() + 5] = True
        # (beside the lit hem too: the shadow between the back and the hem, up to 7 px in from it)
        near_hem = ndi.distance_transform_edt(~cape) <= 7
        near_hem[:max(0, hb_s - 2)] = False
        near_hem[int(np.where(cape.any(1))[0].max()) + 1:] = False
        dark_s = op & (v_s < 0.33) & ~skin(o) & ~headpx & (band_s | near_hem)
        strip_s = ndi.binary_propagation(cape, structure=np.ones((3, 3)), mask=cape | dark_s) & dark_s & ~cape
        # ...but never the original's MAIL beside the hem: its leg is chain, whose dark links passed the test between the
        # light ones - drawn on a leather or plate leg they were chain links. From the lit hem's top down, a px in or by
        # the mail (the light grey links, closed into one area) is the outfit's own leg
        h_s, s_s, _ = hsv(o)
        mail_s = ndi.binary_dilation(ndi.binary_closing(op & (s_s < 0.25) & (v_s >= 0.33), structure=np.ones((3, 3)), iterations=2), structure=np.ones((3, 3)))
        mail_s[:int(np.where(cape.any(1))[0].min())] = False
        strip_s &= ~mail_s
        strip_s = ndi.binary_propagation(cape, structure=np.ones((3, 3)), mask=cape | strip_s) & strip_s
        cape = cape | strip_s                                           # (drawn as the original has them)
    tiles_ = [tile(cape),tile(headpx,o_h),alpha(trims['l']),alpha(trims['c']),alpha(trims['p']),alpha(lc),alpha(sho)]
    if rec_ < 20 and sho_back.any():
        # FROM BEHIND, the shoulder rows beside the hood's foot are given back only for a chest piece that has armour there
        # (a px where it differs from the leather chest, on any helmet and legs): a pauldron lies over the cape, a bare
        # leather shoulder or arm under it (the tile's red: bits 1 leather / 2 chain / 4 plate; 255 = any chest)
        own_c = {'chain': np.zeros_like(Hm), 'plate': np.zeros_like(Hm)}
        for fam_ in own_c:
            for hd in RS3:
                for lg in RS3:
                    A, L = tile0(f'{hd}_{fam_}_{lg}/{k}'), tile0(f'{hd}_leather_{lg}/{k}')
                    own_c[fam_] |= ((A[..., 3] > 0) | (L[..., 3] > 0)) & ~((A[..., 3] > 0) & (L[..., 3] > 0) & np.all(A[..., :3] == L[..., :3], -1))
        gate = sho & sho_back & ~sho_f_only
        # (and never inside the cape itself - more than 2 px in from its edge the cape is whole, on every chest)
        inner_ = ndi.binary_erosion(cape, structure=np.ones((3, 3)), iterations=2)
        bits = own_c['chain'].astype(np.uint8) * 2 + own_c['plate'].astype(np.uint8) * 4
        t6 = tiles_[6]
        t6[gate, 0] = bits[gate]
        t6[gate & ((bits == 0) | inner_), 3] = 0
    if int(k.split('-')[0]) in (13, 14):
        # HURT FROM BEHIND: the cape's upper half lies in deep shadow, near-black like the back it covers (the same px in
        # the plain body's art) - all of it is cape, between the hood and the lit cloth: every dark px of the original
        # inside the outline the hood and the cape span together (never an arm, skin or a shoulder given back)
        ch_ = cape | headpx
        from scipy.spatial import Delaunay                              # (the outline: their convex hull)
        pts_ = np.argwhere(ch_)
        YY, XX = np.mgrid[0:Hm.shape[0], 0:Hm.shape[1]]
        hull_ = (Delaunay(pts_).find_simplex(np.c_[YY.ravel(), XX.ravel()]) >= 0).reshape(Hm.shape)
        _, _, v_o = hsv(o)
        dark_ = op & (v_o < 0.35) & ~skin(o) & ~ch_ & ~sho & hull_
        add_ = ndi.binary_propagation(ch_, structure=np.ones((3, 3)), mask=ch_ | dark_) & dark_
        cape = cape | add_
        # ...drawn as the cloth going into shadow. Each px gets a shade s (0 lit .. 1 in the shadow): up each column from
        # the cloth below to the shadow's edge (halfway up the run, the edge smoothed across the columns), and round the
        # black itself - the hood's own shadow included - by how much black lies near it, in every direction (no lit
        # stripe cut straight beside it). s < 0.5: the cloth's own ramp, step by step darker to its darkest green (it takes
        # the dye and meets the cape without a seam); 0.5 - 0.9: the palette's dark greys (no dye has a step that dark);
        # past that, and the shadow itself, the original's black
        oc_ = o.copy()
        sh_px = cape & ~green(o) & (v_o < 0.35) & ~skin(o)
        cloth_ = cape & green(o)
        if sh_px.any() and cloth_.any():
            ramp_ = PAL[192:207].astype(np.float64)
            rl_ = 0.299 * ramp_[:, 0] + 0.587 * ramp_[:, 1] + 0.114 * ramp_[:, 2]
            L_ = 0.299 * o[..., 0] + 0.587 * o[..., 1] + 0.114 * o[..., 2]
            ri_ = np.argmin(np.abs(L_[..., None] - rl_[None, None, :]), axis=-1)   # each px's place on the ramp
            g_ = np.full(Hm.shape, -1.0); ia_ = np.full(Hm.shape, -1)
            runs = []                                                   # (x, y0, y1, from below?, ramp place there)
            for x_ in np.where(sh_px.any(0))[0]:
                col = sh_px[:, x_]; y_ = 0
                while y_ < len(col):
                    if not col[y_]: y_ += 1; continue
                    y0_ = y_
                    while y_ < len(col) and col[y_]: y_ += 1
                    y1_ = y_
                    below = y1_ < len(col) and cloth_[y1_, x_]
                    above = y0_ > 0 and cloth_[y0_ - 1, x_]
                    if below or above:
                        runs.append((x_, y0_, y1_, below, int(ri_[y1_, x_]) if below else int(ri_[y0_ - 1, x_])))
            yb = {}
            for x_, y0_, y1_, below, ia in runs:
                if below and y1_ - y0_ >= 4: yb.setdefault(x_, []).append((y0_, y1_, (y0_ + y1_) / 2))
            xs_ = sorted(yb)
            mid = {x_: max(v, key=lambda r: r[1] - r[0])[2] for x_, v in yb.items()}
            sm = {x_: float(np.median([mid[z] for z in xs_ if abs(z - x_) <= 2])) for x_ in xs_}
            # THE SHADOW'S EDGE, one smooth line across every column the shadow spans (known where a run comes up from the
            # cloth, carried on to the outer columns): above it the original's black, a few rows of the palette's dark
            # greys at it, below it the cloth's own ramp step by step lighter down to the cloth - no column left as a drip
            cols_ = np.where(sh_px.any(0))[0]
            if xs_ and len(cols_):
                kx = np.array(xs_, dtype=np.float64); ky = np.array([sm[x_] for x_ in xs_])
                edge_y = ndi.uniform_filter1d(np.interp(cols_, kx, ky), size=5, mode='nearest')
                fall = [y1_ - sm[x_] for x_, y0_, y1_, below, ia in runs if below and x_ in sm and y1_ - y0_ >= 4]
                G_ = max(3.0, float(np.median(fall))) if fall else 6.0
                s_ = np.zeros(Hm.shape)
                _, (ny_, nx_) = ndi.distance_transform_edt(~cloth_, return_indices=True)
                base_ = ri_[ny_, nx_]                                   # (a dark px: the ramp place of the cloth nearest it)
                for j_, x_ in enumerate(cols_):
                    for y_ in np.where(sh_px[:, x_])[0]:
                        d_ = edge_y[j_] - y_                               # > 0: above the edge, in the shadow
                        s_[y_, x_] = 0.5 + 0.5 * min(1.0, d_ / 2.5) if d_ >= 0 else 0.5 * max(0.0, 1 + d_ / G_)
                        if d_ < -G_: s_[y_, x_] = 0.2                  # (a fold further down: a darker crease of the cloth)
                # the cloth beside the shadow (its lit edges under the hood) darkens with how much shadow lies near it -
                # the shadow is never cut off straight at its sides; the hood's own rim above it stays lit
                deep_ = (sh_px & (s_ >= 0.9)) | (headpx & ~green(o) & (v_o < 0.35) & ~skin(o))
                F_ = ndi.gaussian_filter(deep_.astype(np.float64), sigma=2.0)
                top_ = np.full(Hm.shape[1], Hm.shape[0])
                for x_ in cols_: top_[x_] = np.where(sh_px[:, x_])[0].min()
                ex_ = dict(zip(cols_.tolist(), edge_y.tolist()))
                yy_, xx_ = np.nonzero(cloth_)
                for y_, x_ in zip(yy_, xx_):
                    tx = top_[max(0, x_ - 3):x_ + 4].min()               # (from the shadow's top down, nearby columns)
                    if y_ < tx: continue
                    base_[y_, x_] = ri_[y_, x_]
                    if x_ in ex_:                                       # in a shadow column: by the same edge line
                        d_ = ex_[x_] - y_
                        s_[y_, x_] = 0.5 + 0.5 * min(1.0, d_ / 2.5) if d_ >= 0 else 0.5 * max(0.0, 1 + d_ / G_)
                    elif min(xs_) - 4 <= x_ <= max(xs_) + 4 and F_[y_, x_] > 0.15:   # beside it: by the shadow near it
                        s_[y_, x_] = 0.9 * min(1.0, F_[y_, x_] / 0.35)
                # (only over the cape's back - the columns the shadow comes down - never an arm reaching out beside it)
                band_x = np.zeros(Hm.shape, bool); band_x[:, max(0, min(xs_) - 2):max(xs_) + 3] = True
                paint = (sh_px | (cloth_ & (s_ > 0.1))) & band_x        # (lit cloth out of the shadow's reach: as drawn)
                dy_ix = np.clip(np.rint(base_ + (14 - base_) * np.clip(s_ / 0.5, 0, 1)), 0, 14).astype(int)
                gr_ix = np.clip(216 + np.rint((s_ - 0.5) / 0.4 * 5), 216, 221).astype(int)
                pal_ix = np.where(s_ < 0.5, 192 + dy_ix, np.where(s_ < 0.9, gr_ix, 222))
                paint &= ~(sh_px & (s_ >= 0.9))                         # (the shadow itself: as drawn)
                oc_[paint, :3] = PAL[pal_ix[paint]].astype(np.uint8)
        tiles_[0] = tile(cape, oc_)
    bc_ = ((BODIES[BODY].get('bow') or {}).get('borrow_cape', {}).get(k) if VAN else None) or BODIES[BODY].get('borrow_cape', {}).get(k)
    if bc_:
        src_, _ = frame(bc_); w_ = src_.shape[1] // 7
        sc_ = src_[:, :w_]
        # hung where it hung, moved only as far as the body's back moved (its edge on the cape's side, row by row)
        b_src, _ = aligned(bc_); bs_ = b_src[..., 3] > 0; bt_ = b[..., 3] > 0
        Hs_, Ws_ = sc_.shape[:2]; Ht_, Wt_ = tiles_[0].shape[:2]
        dyb = Ht_ - Hs_                                                 # (the frames stand on the same ground: bottoms aligned)
        rows_c = [y_ for y_ in np.where(sc_[..., 3].any(1))[0]
                  if 0 <= y_ + dyb < Ht_ and y_ < bs_.shape[0] and bs_[y_].any() and bt_[y_ + dyb].any()]
        cx_c = np.where(sc_[..., 3].any(0))[0].mean(); cx_b = np.where(bs_.any(0))[0].mean()
        edge_f = (lambda r: r.max()) if cx_c > cx_b else (lambda r: r.min())   # (the back: the side the cape hangs on)
        dx_ = int(np.median([edge_f(np.where(bt_[y_ + dyb])[0]) - edge_f(np.where(bs_[y_])[0]) for y_ in rows_c])) if rows_c else 0
        mv = np.zeros_like(tiles_[0])
        for y_ in range(Hs_):
            yt = y_ + dyb
            if not 0 <= yt < Ht_: continue
            xs0, xs1 = max(0, -dx_), min(Ws_, Wt_ - dx_)
            if xs1 > xs0: mv[yt, xs0 + dx_:xs1 + dx_] = sc_[y_, xs0:xs1]
        add_ = (mv[..., 3] > 0) & (tiles_[0][..., 3] == 0)
        tiles_[0][add_] = mv[add_]
    if k in BODIES[BODY].get('hide_beside_hood', ()):
        hd_ = tiles_[1][..., 3] > 0
        hb2 = int(np.where(hd_.any(1))[0].max())
        Tall = [tile0(f'{h_}_{t_}_{l_}/{k}') for h_ in RS3 for t_ in RS3 for l_ in RS3]
        body_ = np.any([t[..., 3] > 0 for t in Tall], 0)
        near_ = ndi.binary_dilation(hd_, structure=np.ones((3, 3)), iterations=4) & ~hd_
        out_ = body_ & ~op & ~hd_ & (tiles_[0][..., 3] == 0) & ~(tiles_[6][..., 3] > 0)
        out_[hb2 + 1:] = False
        hx_ = np.where(hd_.any(0))[0]; out_[:, :int((hx_.min() + hx_.max()) // 2)] = False   # (the far side only)
        gone_ = ndi.binary_propagation(out_ & near_, structure=np.ones((3, 3)), mask=out_)
        near2 = ndi.binary_dilation(gone_, structure=np.ones((3, 3)), iterations=6)
        for t_ in Tall:                                                 # (and what that leaves floating, on any outfit)
            vis_t = (t_[..., 3] > 0) & ~gone_ & ~hd_ & (tiles_[0][..., 3] == 0)
            lab_, n_ = ndi.label(vis_t, structure=np.ones((3, 3)))
            if n_:
                sz_ = ndi.sum(vis_t, lab_, range(1, n_ + 1))
                for i_ in range(1, n_ + 1):
                    m_ = lab_ == i_
                    if sz_[i_ - 1] <= 4 and (m_ & near2).any() and not (m_ & op).any(): gone_ |= m_
        for t_i in (2, 3, 4): tiles_[t_i][gone_] = 255
    strip=np.concatenate(tiles_,1)
    return strip,dict(sh=int(sh),capepx=int(cape.sum()),headpx=int(headpx.sum()))

if __name__ == '__main__':
    OUT = VENDOR + '/cloak'
    man = {'tiles': ['cape', 'head', 'trim-leather', 'trim-chain', 'trim-plate', 'loincloth', 'shoulders']}
    for BODY in ('male', 'female'):
        P = VENDOR + f'/{BODY}/'; os.makedirs(f'{OUT}/{BODY}', exist_ok=True)
        frames = []
        for fn in sorted(os.listdir(P + 'chain_chain_chain'), key=lambda s: [int(x) for x in s[:-4].split('-')]):
            k = fn[:-4]
            if int(k.split('-')[0]) >= 20 and not (VAN and BODIES[BODY].get('bow')): continue
            strip, info = frame(k)
            Image.fromarray(strip).save(f'{OUT}/{BODY}/{k}.png', optimize=True); frames.append(k)
        overf = sorted((k for (bd, k), ov in _OVER.items() if bd == BODY and ov), key=lambda s: [int(x) for x in s.split('-')])
        man[BODY] = {'frames': frames, 'over': [3, 4], **({'overFrames': overf} if overf else {}),
                     **({'noSlivers': True} if BODIES[BODY].get('no_slivers') else {})}
        print(BODY, len(frames), 'frames')
    starts = [0x60, 0x50, 0xef, 0x20, 0x30, 0x40, 0x70, 0x80, 0x90, 0xa0]   # characters/dyes.js CLOTHING_STARTS, DyeColors order
    man.update({'ramp': [PAL[i].astype(int).tolist() for i in range(192, 208)],
                'dyes': [[PAL[s + i].astype(int).tolist() for i in range(16)] for s in starts],
                'templates': [154, 155, 191, 192], 'slots': [14, 16]})
    json.dump(man, open(OUT + '/manifest.json', 'w'))
