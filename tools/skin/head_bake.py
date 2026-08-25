"""Bake ONE Breton head into the atlas head cell from its 8-view turnaround.
Same machinery as the body: sample each surface from the view that sees it most
face-on, blended by normal, normalised in that view's OWN rotated frame."""
import numpy as np, json, math, sys
from PIL import Image
FACE=int(sys.argv[1]) if len(sys.argv)>1 else 4
YAWS=[0,45,90,135,180,225,270,315]
# ONE shoulder line for all eight views. Detecting it per view gave 195..303
# for the same head - a 55% spread - so the same rig height sampled the brow in
# one view and the mouth in another and the blend averaged them: mush at 45,
# two faces at 90. The views share a frame now, so the landmark transfers.
_f=np.array(Image.open(f'heads/f{FACE}_000.png').convert('RGBA'))[:,:,3]>0
_H=_f.shape[0]; _w=[int(_f[r].sum()) for r in range(_H)]
_top=next(r for r in range(_H) if _w[r]>0)
_lo=int(_H*0.55)
SH_FRAC=max(((_w[r+1]-_w[r], r) for r in range(_lo,_H-2)))[1]/_H
V={}
for Y in YAWS:
    im=Image.open(f'heads/f{FACE}_{Y:03d}.png').convert('RGBA'); A=np.array(im)
    m=A[:,:,3]>0; H,W=m.shape
    w=[int(m[r].sum()) for r in range(H)]
    top=next(r for r in range(H) if w[r]>0)
    sh=int(round(SH_FRAC*H))
    runs={}; skinr={}
    rgb=A[:,:,:3].astype(int)
    for r in range(top, sh+1):
        xs=np.where(m[r])[0]
        if not len(xs): continue
        runs[r]=(int(xs.min()),int(xs.max()))
        # THE SILHOUETTE IS HAIR. Mapping the rig's bald ellipse onto a
        # hair-wide outline drags the face outward and smears it. Register on
        # the SKIN run instead - the same lesson as the body, where fitting the
        # chest into the arms' span was the single largest source of error.
        w=xs[(rgb[r,xs,0]-rgb[r,xs,2]>34)&(rgb[r,xs,0]>90)]
        if len(w)>4: skinr[r]=(int(w.min()),int(w.max()))
    ks=sorted(runs)
    cen=np.array([(runs[r][0]+runs[r][1])/2.0 for r in ks])
    half=np.array([(runs[r][1]-runs[r][0])/2.0 for r in ks])
    def smooth(a,sigma=6.0):
        r=int(sigma*3)
        k=np.exp(-0.5*(np.arange(-r,r+1)/sigma)**2); k/=k.sum()
        return np.convolve(np.pad(a,(r,r),mode='edge'), k, mode='valid')
    cen_s=smooth(cen); half_s=smooth(half)
    # CONTAIN the mapped range inside the row's real run. A smoothed centre or
    # half can put sc+/-sr outside the silhouette, and a texel that lands
    # outside samples background and then clamps onto the dark hair edge - the
    # grey wash over the sides of the head.
    # per row: where the FRONT of the head is (the skin's leading edge on the
    # side the face points) and where the BACK is (the silhouette's other edge)
    anchor={}
    _sk=0; _tot=0
    for r in ks:
        w=skinr.get(r)
        if not w: continue
        c0,c1=runs[r]
        _sk += 1 if (w[1]-c0) > (c1-w[0]) else -1
        _tot+=1
    faceRight = _sk >= 0
    for r in ks:
        w=skinr.get(r); c0,c1=runs[r]
        if not w or (w[1]-w[0])<6: continue
        anchor[r]=(w[1],c0) if faceRight else (w[0],c1)
    axis={}
    for r in ks:
        c0,c1=runs[r]; w=skinr.get(r)
        silc=(c0+c1)/2.0
        if w and (w[1]-w[0])>10:
            skc=(w[0]+w[1])/2.0
            vis=min(1.0,(w[1]-w[0])/max(1.0,(c1-c0)*0.62))   # how much face is shown
            axis[r]=silc+(skc-silc)*vis
        else:
            axis[r]=silc
    ax_k=sorted(axis)
    _av=np.array([axis[r] for r in ax_k])
    _r=18
    _k=np.exp(-0.5*(np.arange(-_r,_r+1)/6.0)**2); _k/=_k.sum()
    _av=np.convolve(np.pad(_av,(_r,_r),mode='edge'),_k,mode='valid')
    axis={r:_av[i] for i,r in enumerate(ax_k)}
    prof_run={}
    for i,r in enumerate(ks):
        c0,c1=runs[r]
        lo=max(cen_s[i]-half_s[i], c0); hi=min(cen_s[i]+half_s[i], c1)
        if hi-lo < 2: lo,hi=c0,c1
        prof_run[r]=((lo+hi)/2.0, max(0.5,(hi-lo)/2.0))
    V[Y]={'rgb':A[:,:,:3],'a':m,'runs':runs,'prof':prof_run,'skin':skinr,
          'anchor':anchor,'faceRight':faceRight,'axis':axis,'r0':top,'r1':sh}
    print(f'   view {Y}: face points {"RIGHT" if faceRight else "LEFT"}, {len(anchor)} anchored rows')
print(f'face {FACE}: one shoulder frac {SH_FRAC:.3f}; spans ' +
      ', '.join(f'{Y}:{V[Y]["r0"]}..{V[Y]["r1"]}' for Y in YAWS))

F=json.load(open('neutral.json'))
hf=[f for f in F if f['g']=='head']
ys=[f['p'][i*3+1] for f in hf for i in range(4)]
HY0,HY1=min(ys),max(ys)
NB=140
def _fc(xs, ys):
    """Fritsch-Carlson monotone cubic: smooth across the knots, no overshoot."""
    n=len(xs)
    if n<3: return lambda x: (ys[0] if x<=xs[0] else ys[-1])
    d=[(ys[i+1]-ys[i])/(xs[i+1]-xs[i]) for i in range(n-1)]
    m=[d[0]]+[(d[i-1]+d[i])/2 for i in range(1,n-1)]+[d[-1]]
    for i in range(n-1):
        if d[i]==0: m[i]=m[i+1]=0.0; continue
        a=m[i]/d[i]; b=m[i+1]/d[i]
        s2=a*a+b*b
        if s2>9:
            t=3.0/math.sqrt(s2); m[i]=t*a*d[i]; m[i+1]=t*b*d[i]
    def at(x):
        if x<=xs[0]: return ys[0]
        if x>=xs[-1]: return ys[-1]
        i=max(j for j in range(n-1) if xs[j]<=x)
        h=xs[i+1]-xs[i]; t=(x-xs[i])/h
        t2=t*t; t3=t2*t
        return ((2*t3-3*t2+1)*ys[i] + (t3-2*t2+t)*h*m[i]
                + (-2*t3+3*t2)*ys[i+1] + (t3-t2)*h*m[i+1])
    return at

def ringProfile(vals):
    """vals: list of (y, measurement-tuple). Keep only the REAL ring heights and
    interpolate linearly between them, so nothing is invented between rings."""
    ks=sorted(vals)
    xs=[k for k,_ in ks]; vs=[v for _,v in ks]
    dim=len(vs[0])
    fns=[_fc(xs,[v[d] for v in vs]) for d in range(dim)]
    return lambda y: tuple(f(y) for f in fns)
# rig head extents PER VIEW, in that view's own rotated frame (the law that
# cost the body three failed fixes)
RINGY=sorted({round(f['p'][i*3+1],4) for f in hf for i in range(4)})
print(f'head has {len(RINGY)} real ring heights, not {NB} bins')
EXT={}
for Yd in YAWS:
    cA,sA=math.cos(math.radians(Yd)),math.sin(math.radians(Yd))
    per={}
    for f in hf:
        for i in range(4):
            x,y,z=f['p'][i*3],f['p'][i*3+1],f['p'][i*3+2]
            per.setdefault(round(y,4),[]).append(x*cA+z*sA)
    EXT[Yd]=ringProfile([(y,((max(v)+min(v))/2, max(1e-4,(max(v)-min(v))/2)))
                         for y,v in per.items()])

def sample(px,py,pz,arc):
    t=min(1,max(0,(py-HY0)/(HY1-HY0+1e-9)))
    fb=t*NB-0.5
    b0=min(NB-1,max(0,int(math.floor(fb)))); b1=min(NB-1,b0+1); ft=fb-math.floor(fb)
    acc=np.zeros(3); wsum=0.0; satsum=0.0
    for Yd in YAWS:
        tv=(90-Yd)%360                       # the arc this view looks at
        d=((math.degrees(arc)-tv+180)%360)-180
        cc=math.cos(math.radians(d))
        # VISIBILITY, not just weight. xr = px*cos(Y)+pz*sin(Y) is a PROJECTION,
        # and a projection is two-to-one: the front and the back of the head
        # land on the same column. Mapping that column back onto the arc made
        # every view paint its content twice - a mirrored second face - which is
        # why no weighting scheme could fix it. A view may only paint the
        # hemisphere it can actually SEE.
        if cc <= 0.02: continue              # facing away: this view sees nothing here
        # cos^4 let the two 3/4 views put a THIRD of their own faces into the
        # front-centre pixel, each mapped by its own chord projection. Different
        # content in the same texel is the mush. Sharpen so a view OWNS its
        # sector and the neighbours only feather the join.
        wgt=cc**24
        if wgt<1e-4: continue
        vv=V[Yd]
        row=vv['r1']-t*(vv['r1']-vv['r0'])      # crown at t=1, shoulderline at t=0
        ri=int(round(row))
        while ri not in vv['runs'] and ri<vv['r1']: ri+=1
        if ri not in vv['runs']: continue
        c0,c1=vv['runs'][ri]
        sc,sr=vv['prof'][ri]              # smoothed, so hair spikes stop moving the map
        # ARC-LINEAR. Chord unprojection needs the head's rotation axis and its
        # scale per view and NEITHER is recoverable here: the silhouette is hair
        # (width 275/255/258/247 across views while the skull's projection must
        # change 1.00->1.30), its centre is hair-biased, and the neck centre is
        # unreliable (204.8 at view 135). A view sees exactly 180 deg of arc, so
        # map its image across that arc. Two silhouette edges, no axis, no scale,
        # and each view's content lands in its own sector by construction - a
        # profile's face edge goes to the FRONT of the head, not to the ear.
        rel=((math.degrees(arc)-((90-Yd)%360)+90.0)%360.0)/180.0
        if rel<0.0 or rel>1.0: continue
        axc=vv['axis'].get(ri,(c0+c1)/2.0)
        # map about the head's AXIS, not the hair-biased silhouette centre
        col=int(round(axc+(rel-0.5)*(c1-c0)))
        col=min(max(col,c0),c1)
        if not vv['a'][ri,col]:
            hit=False
            for d in range(1,8):
                if col+d<=c1 and vv['a'][ri,col+d]: col+=d; hit=True; break
                if col-d>=c0 and vv['a'][ri,col-d]: col-=d; hit=True; break
            if not hit: continue
        c3=vv['rgb'][ri,col].astype(np.float64)
        mx=c3.max()
        satsum+=((mx-c3.min())/max(1.0,mx))*wgt
        acc+=c3*wgt; wsum+=wgt
    if wsum<=0: return None
    out=acc/wsum
    tgt=satsum/wsum                       # the chroma the sources actually had
    mx=out.max()
    cur=(mx-out.min())/max(1.0,mx)
    if cur>1e-3 and tgt>cur:
        L=0.30*out[0]+0.59*out[1]+0.11*out[2]
        out=np.clip(L+(out-L)*(tgt/cur),0,255)
    return out

LAY=json.load(open('/mnt/user-data/outputs/skin-layout.json'))
c=LAY['head']; HW,HH=c['w'],c['h']
per={}
for f in hf:
    for i in range(4):
        x,y,z=f['p'][i*3],f['p'][i*3+1],f['p'][i*3+2]
        per.setdefault(round(y,4),[]).append((x,z))
PROF=ringProfile([(y,((min(a for a,_ in v)+max(a for a,_ in v))/2,
                      (min(b for _,b in v)+max(b for _,b in v))/2,
                      max(1e-3,(max(a for a,_ in v)-min(a for a,_ in v))/2),
                      max(1e-3,(max(b for _,b in v)-min(b for _,b in v))/2)))
                  for y,v in per.items()])

cell=np.zeros((HH,HW,3),dtype=np.uint8)
for ax in range(HW):
    th=(ax+0.5)/HW*2*math.pi - math.pi/2     # SAME zero as the UVs: front at u=0.5
    for ay in range(HH):
        py=c['y1']-(ay+0.5)/HH*(c['y1']-c['y0'])
        cx,cz,rx,rz=PROF(py)
        px=cx+math.cos(th)*rx; pz=cz+math.sin(th)*rz
        col=sample(px,py,pz,th)
        if col is not None: cell[ay,ax]=col.astype(np.uint8)
# TONE: lift toward the body's brightness while KEEPING hue. A per-channel
# statistical match flattened the beard and hair into skin, because a
# warm-and-lit mask cannot tell a lit brown beard from lit skin.
lum=0.3*cell[:,:,0]+0.59*cell[:,:,1]+0.11*cell[:,:,2]
lit=np.percentile(lum[lum>4],92) if (lum>4).any() else 1.0
gain=min(1.45, 150.0/max(1.0,lit))
f32=cell.astype(np.float32)*gain
print(f'tone: lit p92 {lit:.0f} -> gain {gain:.2f}x (hue preserved)')
mx=f32.max(axis=2,keepdims=True)
f32=np.where(mx>255.0, f32*(255.0/np.maximum(mx,1e-6)), f32)
mx=f32.max(axis=2,keepdims=True)
f32=np.where(mx>255.0, f32*(255.0/np.maximum(mx,1e-6)), f32)
cell=np.clip(f32,0,255).astype(np.uint8)
# NO vertical median here. On the body it killed streaks because real structure
# ran vertically; on a FACE the brow, eyes and mouth are horizontal structure and
# the median ate them, leaving the smeared bands.
for d in range(3):
    a=cell[:,d].astype(np.float32); b=cell[:,HW-1-d].astype(np.float32)
    m=(a+b)/2
    cell[:,d]=m.astype(np.uint8); cell[:,HW-1-d]=m.astype(np.uint8)
Image.fromarray(cell).save(f'heads/cell_{FACE}.png')
print(f'baked head cell {HW}x{HH} -> heads/cell_{FACE}.png')
