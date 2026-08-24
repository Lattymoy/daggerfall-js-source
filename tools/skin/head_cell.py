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
base=Image.open('/mnt/user-data/outputs/skin-intensity.png').convert('L')
BW,BH=base.size

hf=[f2 for f2 in F if f2['g']=='head']
ys=[f2['p'][i*3+1] for f2 in hf for i in range(4)]
HY0,HY1=min(ys),max(ys)
NBH=120
bins=[[] for _ in range(NBH)]
for f2 in hf:
    for i in range(4):
        x,y,z=f2['p'][i*3],f2['p'][i*3+1],f2['p'][i*3+2]
        bins[min(NBH-1,int((y-HY0)/(HY1-HY0)*NBH))].append((x,z))
prof=[]
for b in bins:
    if not b: prof.append(None); continue
    xs=[p[0] for p in b]; zs=[p[1] for p in b]
    prof.append(((min(xs)+max(xs))/2,(min(zs)+max(zs))/2,
                 max(1e-3,(max(xs)-min(xs))/2),max(1e-3,(max(zs)-min(zs))/2)))
ok=[i for i,p in enumerate(prof) if p]
prof=[p if p else (prof[ok[0]] if i<NBH/2 else prof[ok[-1]]) for i,p in enumerate(prof)]
print(f'head: {len(hf)} faces, y {HY0:.3f}..{HY1:.3f}')

rows=int(round(abs(ymap(HY0)-ymap(HY1)))) or 60
HW,HH=96,max(48,rows)
print(f'head cell {HW}x{HH}')
L=np.array([-0.45,0.55,0.70]); L/=np.linalg.norm(L)
cell=np.zeros((HH,HW),dtype=np.uint8)
for ax in range(HW):
    th=(ax+0.5)/HW*2*math.pi
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
            k=min(NBH-1,int((py-HY0)/(HY1-HY0+1e-9)*NBH))
            cx,cz,rx,rz=prof[k]
            th=math.atan2((pz-cz)/rz,(px-cx)/rx)%(2*math.pi)
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
