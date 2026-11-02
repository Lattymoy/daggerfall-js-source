"""Bake the per-limb multi-view map into ONE flat PNG.
Every texel is resolved now, so the rig just reads the file and nothing is
recomputed per frame. Paint over anything you don't like."""
exec(open('mvB2.py').read().split('# ---------- render ----------')[0])
import math
from PIL import Image, ImageDraw

CELLS={}
for g in ('body','armL','armR','legL','legR'):
    ys=[f2['p'][i*3+1] for f2 in F if f2['g']==g for i in range(4)]
    y0,y1=min(ys),max(ys)
    rows=abs(ymap(y0)-ymap(y1))
    E=EXT[(g,0)]
    circ=2*math.pi*max(h for h in E[1] if h)
    px_per_unit=rows/max(1e-6,(y1-y0))
    CELLS[g]=(max(24,int(circ*px_per_unit*0.5)), max(24,int(rows)), y0, y1)
pad=8
AW=sum(c[0] for c in CELLS.values())+pad*(len(CELLS)+1)
AH=max(c[1] for c in CELLS.values())+pad*2
atlas=Image.new('RGBA',(AW,AH),(0,0,0,0))
layout={}; x=pad
for g,(cw,ch,y0,y1) in CELLS.items():
    layout[g]={'x':x,'y':pad,'w':cw,'h':ch,'y0':y0,'y1':y1}
    for ax in range(cw):
        th=(ax+0.5)/cw*2*math.pi           # around the limb
        for ay in range(ch):
            yy=y1-(ay+0.5)/ch*(y1-y0)      # down the limb
            E=EXT[(g,0)]
            fb=(yy-Y0)/(Y1-Y0+1e-9)*NB-0.5
            b0=min(NB-1,max(0,int(math.floor(fb)))); b1=min(NB-1,b0+1); ft=fb-math.floor(fb)
            cc,hh=E
            rc=cc[b0]+(cc[b1]-cc[b0])*ft
            rh=max(1e-4,hh[b0]+(hh[b1]-hh[b0])*ft)
            px=rc+math.cos(th)*rh
            pz=math.sin(th)*rh*0.7
            c=sample(g,px,yy,pz,math.cos(th),math.sin(th))
            if c is not None:
                atlas.putpixel((x+ax,pad+ay),(int(c[0]),int(c[1]),int(c[2]),255))
    x+=cw+pad
json.dump(layout,open('/mnt/user-data/outputs/skin-layout.json','w'),indent=1)
atlas.save('/mnt/user-data/outputs/skin-atlas.png')
filled=sum(1 for p in atlas.convert('RGBA').getdata() if p[3]>0)
print(f'atlas {AW}x{AH}  cells: ' + ', '.join(f'{g} {c[0]}x{c[1]}' for g,c in CELLS.items()))
print(f'{filled} texels resolved')
S=3
pv=atlas.resize((AW*S,AH*S),Image.NEAREST)
out=Image.new('RGB',(pv.width+20,pv.height+40),(20,20,23)); out.paste(pv,(10,10),pv)
d=ImageDraw.Draw(out)
lx=10
for g,c in CELLS.items():
    d.text((lx+2,pv.height+16),g,fill=(150,150,158)); lx+=(c[0]+pad)*S
out.save('/mnt/user-data/outputs/skin-atlas-preview.png')
print('preview',out.size)
