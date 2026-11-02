"""Add a HEAD cell to the skin atlas and bake its UVs.
The cell ships with geometry-derived shading only - NO ARENA2 - because the
face is a classic sprite and may not be published. The runtime paints the face
into the cell's front arc from the user's own FACE*.CIF, which is exactly what
the game already does with every other sprite."""
exec(open('mvB2.py').read().split('# ---------- render ----------')[0])
import math, json
from PIL import Image
import numpy as np
LAY=json.load(open('/mnt/user-data/outputs/skin-layout.json'))
# IDEMPOTENT: a rerun must not append a second head cell onto the first
if 'head' in LAY:
    LAY.pop('head')
    _bw=max(c['x']+c['w'] for c in LAY.values())+8
    Image.open('/mnt/user-data/outputs/skin-intensity.png').convert('L')\
         .crop((0,0,_bw,293)).save('/mnt/user-data/outputs/skin-intensity.png')
base=Image.open('/mnt/user-data/outputs/skin-intensity.png').convert('L')
BW,BH=base.size

hf=[f2 for f2 in F if f2['g']=='head']
ys=[f2['p'][i*3+1] for f2 in hf for i in range(4)]
HY0,HY1=min(ys),max(ys)
per={}
for f2 in hf:
    for i in range(4):
        x,y,z=f2['p'][i*3],f2['p'][i*3+1],f2['p'][i*3+2]
        per.setdefault(round(y,4),[]).append((x,z))
_ks=sorted(per)
print(f'head UVs built on {len(_ks)} real ring heights (was 120 bins, 113 empty)')
_xs=_ks
_vs=[((min(a for a,_ in per[y])+max(a for a,_ in per[y]))/2,
      (min(b for _,b in per[y])+max(b for _,b in per[y]))/2,
      max(1e-3,(max(a for a,_ in per[y])-min(a for a,_ in per[y]))/2),
      max(1e-3,(max(b for _,b in per[y])-min(b for _,b in per[y]))/2)) for y in _ks]
def PROF(y):
    if y<=_xs[0]: return _vs[0]
    if y>=_xs[-1]: return _vs[-1]
    i=max(j for j in range(len(_xs)-1) if _xs[j]<=y); j=i+1
    t=(y-_xs[i])/(_xs[j]-_xs[i])
    t=t*t*(3-2*t)                      # smoothstep: C1 across the knots
    return tuple(_vs[i][k]+(_vs[j][k]-_vs[i][k])*t for k in range(4))
print(f'head: {len(hf)} faces, y {HY0:.3f}..{HY1:.3f}')

rows=int(round(abs(ymap(HY0)-ymap(HY1)))) or 60
# The cell's aspect must match the SURFACE's. Head circumference 0.7824 over
# height 0.2970 is 2.63:1; a 192x128 cell is 1.50:1, which squeezes horizontal
# detail 1.76x and shows up as stretch when mapped back on. 336x128 = 2.62:1.
# The source head is ~303 rows; a 128-row cell threw away 2.4x of the vertical
# detail and squashed the brow, eyes and mouth into bands - which reads as
# smear, not as scale. Keep the 2.63:1 surface aspect and give it the rows.
HW,HH=1344,512
print(f'head cell {HW}x{HH}')
L=np.array([-0.45,0.55,0.70]); L/=np.linalg.norm(L)
cell=np.zeros((HH,HW),dtype=np.uint8)
for ax in range(HW):
    th=(ax+0.5)/HW*2*math.pi - math.pi/2      # same zero as the UVs above
    n=np.array([math.cos(th),0.0,math.sin(th)])
    for ay in range(HH):
        t=(ay+0.5)/HH                       # 0 = crown, 1 = chin
        dome=math.sin(min(1.0,t*1.15)*math.pi*0.5)   # curve toward the crown
        nn=np.array([n[0]*dome, math.cos(min(1.0,t*1.15)*math.pi*0.5), n[2]*dome])
        nn/=np.linalg.norm(nn) or 1
        lam=max(0.0,float(nn@L))
        cell[ay,ax]=int(np.clip(40+205*(0.35+0.65*lam),0,255))
pad=8
NW=BW+pad+HW
out=Image.new('L',(NW,max(BH,HH+pad*2)),0)
out.paste(base,(0,0))
out.paste(Image.fromarray(cell),(BW+pad,pad))
out.save('/mnt/user-data/outputs/skin-intensity.png')
LAY['head']={'x':BW+pad,'y':pad,'w':HW,'h':HH,'y0':HY0,'y1':HY1,
             'faceArc':[0.25,0.75],'note':'front arc is painted at runtime from FACE*.CIF'}
json.dump(LAY,open('/mnt/user-data/outputs/skin-layout.json','w'),indent=1)
print(f'atlas now {NW}x{out.size[1]}')

# ---- rebake ALL uvs, head included ----
AW,AH=out.size
UV=[]
for f2 in F:
    g=f2['g']
    for i in range(4):
        px,py,pz=f2['p'][i*3],f2['p'][i*3+1],f2['p'][i*3+2]
        if g=='head':
            c=LAY['head']
            cx,cz,rx,rz=PROF(py)
            # +pi/2 so u=0.5 is the FRONT of the head and the seam falls at the
            # back. Probed: without it u=0.5 is the BACK and faceArc [.25,.75]
            # wraps the face around the left temple.
            th=(math.atan2((pz-cz)/rz,(px-cx)/rx)+math.pi/2)%(2*math.pi)
            ax=c['x']+th/(2*math.pi)*c['w']
            ay=c['y']+(c['y1']-py)/(c['y1']-c['y0']+1e-9)*c['h']
        elif g in ('body','armL','armR','legL','legR'):
            c=LAY[g]; cc,hh=EXT[(g,0)]
            fb=(py-Y0)/(Y1-Y0+1e-9)*NB-0.5
            b0=min(NB-1,max(0,int(math.floor(fb)))); b1=min(NB-1,b0+1); ft=fb-math.floor(fb)
            rc=cc[b0]+(cc[b1]-cc[b0])*ft
            rh=max(1e-4,hh[b0]+(hh[b1]-hh[b0])*ft)
            th=math.atan2(pz/(0.7*rh),(px-rc)/rh)%(2*math.pi)
            ax=c['x']+th/(2*math.pi)*c['w']
            ay=c['y']+(c['y1']-py)/(c['y1']-c['y0']+1e-9)*c['h']
        else:
            UV+=[0.0,0.0]; continue
        UV+=[round(ax/AW,5), round(1.0-ay/AH,5)]
json.dump({'n':len(F),'w':AW,'h':AH,'uv':UV},open('/mnt/user-data/outputs/skin-uv.json','w'))
print('uvs rebaked for',len(F),'faces incl. head')
