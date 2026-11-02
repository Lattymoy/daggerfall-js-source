"""Per-limb multi-view sampling.
Each rig group maps into that group's own region of each reference view, so
arm placement can no longer contaminate the torso. armL/armR bind to armA/armB
(low-x / high-x in the view) with the side flip that happens once the figure
turns past a profile."""
import numpy as np, json, math
from PIL import Image
YAWS=[0,45,90,135,180,225,270,315]
SEG=json.load(open('seg.json'))
V={}
for Y in YAWS:
    im=Image.open(f'view_{Y:03d}.png').convert('RGBA'); A=np.array(im)
    s=SEG[str(Y)]
    parts={p:{int(r):tuple(v) for r,v in d.items()} for p,d in s['parts'].items()}
    V[Y]={'rgb':A[:,:,:3],'a':A[:,:,3]>0,'parts':parts,'r0':s['r0'],'r1':s['r1']}

# --- which view-side does a rig arm land on? probe it, do not assume ---
# The rig's armL sits at NEGATIVE x. A view at yaw Y rotates the figure, and
# the arm's screen-x is x*cos(Y)+z*sin(Y); with z~0 for a hanging arm that is
# just x*cos(Y), so the side flips exactly when cos(Y) changes sign.
def armside(group, Y):
    c=math.cos(math.radians(Y))
    lowx = (group=='armL')
    if c<0: lowx = not lowx
    return 'armA' if lowx else 'armB'
print('arm side binding by view:')
for Y in YAWS:
    print(f'   yaw {Y:3d}:  armL -> {armside("armL",Y)}   armR -> {armside("armR",Y)}')
def legside(group,Y):
    c=math.cos(math.radians(Y))
    lowx=(group=='legL')
    if c<0: lowx=not lowx
    return 'legA' if lowx else 'legB'
GMAP={'body':lambda g,Y:'body'}

# --- reference landmarks + rig anchors (unchanged) ---
f0=SEG['0']; REFsh,REFcr,REFr0,REFr1=f0['shoulder'],f0['crotch'],f0['r0'],f0['r1']
m0=V[0]['a']; runs0={r:(int(np.where(m0[r])[0].min()),int(np.where(m0[r])[0].max()))
                     for r in range(m0.shape[0]) if m0[r].any()}
wid0={r:runs0[r][1]-runs0[r][0]+1 for r in runs0}
span=REFr1-REFr0
neck=min((r for r in runs0 if REFr0+span*0.04<r<REFsh-4), key=lambda r:wid0[r])
waist=min(range(REFsh+int(span*0.08),REFcr-4), key=lambda r:wid0[r])
def legw(r):
    xs=np.where(m0[r])[0]
    if not len(xs): return 999
    return len(xs[xs<(runs0[r][0]+runs0[r][1])/2]) or 999
knee=min(range(REFcr+int((REFr1-REFcr)*0.25),REFcr+int((REFr1-REFcr)*0.60)), key=legw)
LR=json.load(open('lm_rig.json'))
# ONLY unambiguous anchors. waist/shoulder/neck were fitted to width profiles
# that include the arms, so they were flat and arbitrary, and the crotch->waist
# pair squashed the hips to 100 rows/unit against 379 in the shins. Dropping
# them takes the spread from 3.8x to 1.48x.
# B, with ONE change: the reference is cropped at the neck, and its stump runs
# to row 25 (torso width steps +55 there). Anchoring the rig's torso top at
# REFr0=0 pointed the whole upper-trap band at a 17px sliver and stretched it
# across the shoulders - the dark bars. Anchor past the stump instead.
bodyw={int(r):(v[1]-v[0]+1) for r,v in SEG['0']['parts']['body'].items()}
STUMP=max((bodyw[r+1]-bodyw[r], r+1) for r in range(0,60) if r in bodyw and r+1 in bodyw)[1]
print('stump ends at ref row',STUMP)
ANCH=[(LR['bottom'],REFr1),(LR['knee'],knee),(LR['crotch'],REFcr),(1.557,STUMP)]
for nm,y in (('shoulder',LR['shoulder']),('torsoTop',1.557)):
    r=REFcr+(STUMP-REFcr)*(y-LR['crotch'])/(1.557-LR['crotch'])
    print(f'  rig {nm:9s} -> ref row {r:5.1f}  torso width {bodyw.get(int(round(r)),0)}')
print('anchors', [(round(a,3),b) for a,b in ANCH])
def ymap(y):
    if y<=ANCH[0][0]: return ANCH[0][1]
    if y>=ANCH[-1][0]: return ANCH[-1][1]
    for i in range(len(ANCH)-1):
        (a,ra),(b,rb)=ANCH[i],ANCH[i+1]
        if a<=y<=b: return ra+(rb-ra)*(y-a)/(b-a+1e-9)
    return ANCH[-1][1]

# --- rig extents PER GROUP and PER VIEW, in that view's rotated frame ---
F=json.load(open('neutral.json'))
acc={}
def key(p): return (round(p[0],4),round(p[1],4),round(p[2],4))
for f2 in F:
    n=f2['n']
    for i in range(4):
        a=acc.setdefault(key(f2['p'][i*3:i*3+3]),[0.,0.,0.])
        a[0]+=n[0]; a[1]+=n[1]; a[2]+=n[2]
for k,a in acc.items():
    L=math.hypot(a[0],math.hypot(a[1],a[2])) or 1.0
    acc[k]=[a[0]/L,a[1]/L,a[2]/L]
for f2 in F: f2['vn']=[acc[key(f2['p'][i*3:i*3+3])] for i in range(4)]
NB=300
ys=[f2['p'][i*3+1] for f2 in F for i in range(4)]
Y0,Y1=min(ys),max(ys)
EXT={}
for g in ('body','armL','armR','legL','legR'):
    for Yd in YAWS:
        cA,sA=math.cos(math.radians(Yd)),math.sin(math.radians(Yd))
        b=[[] for _ in range(NB)]
        for f2 in F:
            if f2['g']!=g: continue
            for i in range(4):
                x,y,z=f2['p'][i*3],f2['p'][i*3+1],f2['p'][i*3+2]
                b[min(NB-1,int((y-Y0)/(Y1-Y0)*NB))].append(x*cA+z*sA)
        h=[(max(v)-min(v))/2 if v else None for v in b]
        c=[(max(v)+min(v))/2 if v else None for v in b]
        ok=[i for i,v in enumerate(h) if v]
        if not ok: EXT[(g,Yd)]=None; continue
        for i in range(NB):
            if h[i] is None:
                j=min(ok,key=lambda k:abs(k-i)); h[i]=h[j]; c[i]=c[j]
        EXT[(g,Yd)]=(c,h)
print('extents built for', len(EXT), 'group/view pairs')

def part_for(g,Yd):
    if g=='body': return 'body'
    if g in ('armL','armR'): return armside(g,Yd)
    return legside(g,Yd)

def sample(g,px,py,pz,nx,nz):
    row=ymap(py)
    fb=(py-Y0)/(Y1-Y0+1e-9)*NB-0.5
    b0=min(NB-1,max(0,int(math.floor(fb)))); b1=min(NB-1,b0+1); ft=fb-math.floor(fb)
    phi=math.degrees(math.atan2(-nx,nz))%360
    acc=np.zeros(3); wsum=0.0
    for kk,Yd in enumerate(YAWS):
        c=math.cos(math.radians(((Yd-phi+180)%360)-180))
        if c<=0: continue
        w=c**6
        if w<1e-4: continue
        E=EXT.get((g,Yd))
        if E is None: continue
        pn=part_for(g,Yd)
        pd=V[Yd]['parts'].get(pn)
        if not pd: continue                      # arms are absent in profile
        ri=int(round(row))
        if ri not in pd:
            near=[r for r in (ri-1,ri+1,ri-2,ri+2,ri-3,ri+3) if r in pd]
            if not near: continue
            ri=near[0]
        c0,c1=pd[ri]; sc,sr=(c0+c1)/2,max(0.5,(c1-c0)/2)
        cc,hh=E
        rc=cc[b0]+(cc[b1]-cc[b0])*ft
        rh=max(1e-4,hh[b0]+(hh[b1]-hh[b0])*ft)
        xr=px*math.cos(math.radians(Yd))+pz*math.sin(math.radians(Yd))
        col=int(round(sc+((xr-rc)/rh)*sr))
        col=min(max(col,c0+1),c1-1) if c1-c0>3 else min(max(col,c0),c1)
        vv=V[Yd]
        if not vv['a'][ri,col]:
            hit=False
            for d in range(1,7):
                if col+d<=c1 and vv['a'][ri,col+d]: col+=d; hit=True; break
                if col-d>=c0 and vv['a'][ri,col-d]: col-=d; hit=True; break
            if not hit: continue
        acc+=vv['rgb'][ri,col]*w; wsum+=w
    return (acc/wsum) if wsum>0 else None

def render(yaw,CW,CH,sc):
    ya=math.radians(yaw); cy,sy=math.cos(ya),math.sin(ya)
    zb=np.full((CH,CW),-1e9); img=np.zeros((CH,CW,4),dtype=np.uint8)
    for f2 in F:
        g=f2['g']
        if g=='head': continue
        n=f2['n']
        if (-n[0]*sy+n[2]*cy)<=0: continue
        P=[]
        for i in range(4):
            x,y,z=f2['p'][i*3],f2['p'][i*3+1],f2['p'][i*3+2]
            vn=f2['vn'][i]
            P.append((CW/2+(x*cy+z*sy)*sc, CH-8-y*sc, -x*sy+z*cy, x,y,z, vn[0],vn[1],vn[2]))
        for (A,B,C) in ((0,1,2),(0,2,3)):
            (ax,ay,az,ax3,ay3,az3,an0,an1,an2)=P[A]
            (bx,by,bz,bx3,by3,bz3,bn0,bn1,bn2)=P[B]
            (cx,cyy,cz,cx3,cy3,cz3,cn0,cn1,cn2)=P[C]
            det=(bx-ax)*(cyy-ay)-(by-ay)*(cx-ax)
            if abs(det)<1e-9: continue
            for py in range(max(0,int(min(ay,by,cyy))),min(CH-1,int(math.ceil(max(ay,by,cyy))))+1):
                for px in range(max(0,int(min(ax,bx,cx))),min(CW-1,int(math.ceil(max(ax,bx,cx))))+1):
                    X=px+0.5;Yp=py+0.5
                    w0=((bx-ax)*(Yp-ay)-(by-ay)*(X-ax))/det
                    w1=((cx-bx)*(Yp-by)-(cyy-by)*(X-bx))/det
                    w2=((ax-cx)*(Yp-cyy)-(ay-cyy)*(X-cx))/det
                    if w0<-1e-9 or w1<-1e-9 or w2<-1e-9: continue
                    dep=az*w1+bz*w2+cz*w0
                    if dep<=zb[py,px]: continue
                    mx=ax3*w1+bx3*w2+cx3*w0; my=ay3*w1+by3*w2+cy3*w0; mz=az3*w1+bz3*w2+cz3*w0
                    inx=an0*w1+bn0*w2+cn0*w0; iny=an1*w1+bn1*w2+cn1*w0; inz=an2*w1+bn2*w2+cn2*w0
                    L=math.sqrt(inx*inx+iny*iny+inz*inz) or 1.0
                    inx/=L; iny/=L; inz/=L
                    c=sample(g,mx,my,mz,inx,inz)
                    if c is None: continue
                    lam=max(0.0,(inx*cy+inz*sy)*-0.40+iny*0.45+(-inx*sy+inz*cy)*0.75)
                    k=0.80+0.20*lam
                    zb[py,px]=dep
                    img[py,px]=(min(255,int(c[0]*k)),min(255,int(c[1]*k)),min(255,int(c[2]*k)),255)
    return img

CW,CH,SCL=110,220,110
views=[0,45,90,135,180]; SS=3
out=Image.new('RGB',(len(views)*CW*SS+40, CH*SS+58),(20,20,23))
from PIL import ImageDraw
d=ImageDraw.Draw(out)
for i,yv in enumerate(views):
    im=Image.fromarray(render(yv,CW,CH,SCL)).resize((CW*SS,CH*SS),Image.NEAREST)
    out.paste(im,(20+i*CW*SS,26)); d.text((20+i*CW*SS+4,8),f'{yv}\u00b0',fill=(150,150,158))
d.text((20,26+CH*SS+8),'per-limb multi-view \u00b7 B + torso-top anchored past the neck stump',fill=(150,150,158))
out.save('/mnt/user-data/outputs/perlimbB2.png'); print('saved',out.size)
