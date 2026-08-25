"""Derive each face's body ramp FROM its own head.
The head is the authority on skin tone: it carries the artist's actual colour.
Sample the head's skin across its luminance range to build a 16-step ramp, and
the body's intensity map then runs through it - so the neck matches the jaw."""
import numpy as np, json
from PIL import Image
N=16
out={}
for f in range(1,11):
    c=np.array(Image.open(f'heads/cell_{f}.png').convert('RGB')).astype(float)
    W=c.shape[1]
    H=c.shape[0]
    face=c[int(H*0.26):int(H*0.52), int(W*0.455):int(W*0.545)]
    lum=0.3*face[:,:,0]+0.59*face[:,:,1]+0.11*face[:,:,2]
    ref=np.median(lum)
    sel=(lum>ref*0.45)&(lum<ref*1.75)      # drop the odd eye/nostril outlier
    px=face[sel]; pl=lum[sel]
    if len(px)<200: continue
    order=np.argsort(pl); px=px[order]; pl=pl[order]
    # a ramp is skin sampled across its own tonal range, dark end to light end
    I=np.array(Image.open('/mnt/user-data/outputs/skin-intensity.png').convert('L'))
    L=json.load(open('/mnt/user-data/outputs/skin-layout.json'))
    bc=L['body']; bi=I[bc['y']:bc['y']+bc['h'], bc['x']:bc['x']+bc['w']].ravel()
    bi=bi[bi>0]
    qs=[float((bi <= (k/(N-1))*255).mean()*100) for k in range(N)]
    qs=[min(97.0,max(3.0,q)) for q in qs]
    ramp=[]
    for q in qs:
        i=int(len(px)*q/100); i=min(max(i,0),len(px)-1)
        w=max(1,len(px)//40)
        ramp.append([float(np.median(px[max(0,i-w):i+w+1,k])) for k in range(3)])
    ramp=np.array(ramp)
    # extend the dark end so shadowed body geometry has somewhere to go
    ramp[0]=ramp[0]*0.55; ramp[1]=ramp[1]*0.75
    out[f-1]=[[int(round(v)) for v in row] for row in ramp]
    print(f'face {f-1}: ramp {out[f-1][0]} .. {out[f-1][-1]}')
json.dump(out, open('/mnt/user-data/outputs/breton-skin-ramps.json','w'), indent=1)
print(f'\n{len(out)} ramps written')
