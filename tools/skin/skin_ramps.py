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
    # SAMPLE THE WHOLE FRONT SECTOR. Measured across all 80 faces: a single
    # nose box disagrees with its own head 13 times, four small boxes twice,
    # the whole lit sector once. Paint, a hood or an ornament can fill a small
    # box; none of them fill the sector.
    face=c[int(H*0.12):int(H*0.86), int(W*0.38):int(W*0.62)]
    lum=0.3*face[:,:,0]+0.59*face[:,:,1]+0.11*face[:,:,2]
    ref=np.median(lum)
    # Reject on HUE as well as brightness. An eye or a specular highlight is
    # skin-bright but not skin-coloured, and one of those in the sample put a
    # bluish entry mid-ramp - red running 194 then 112 while luminance rose.
    # The hue reference must come from the WHOLE CELL, not the box. A browband
    # or crest can FILL the box - Argonian 6's gold band sits exactly at
    # nose-bridge height - and then the ornament becomes the reference and the
    # body renders gold. The cell is mostly hide, so its median is the hide.
    # THE SAMPLE IS ITS OWN REFERENCE. The whole-cell reference and the vote
    # between them existed only because the sample was a small box an ornament
    # could fill; the sector cannot be filled. And the vote was BIASED TOWARD
    # GREY - a neutral hue sits in the middle of hue space, so it is near
    # everything and always wins. Redguard 8's grey hair beat its own warm skin
    # 49069 to 41100 and gave it a grey body.
    _n=face/np.maximum(lum[:,:,None],1.0)
    _med=np.array([np.median(_n[:,:,k]) for k in range(3)])
    _hue=np.abs(_n-_med).sum(axis=2)
    # Widen until the sample is big enough rather than skipping the face: the
    # whole-cell reference is stricter than the box one, and two Redguards fell
    # to 101 and 45 px and produced NO ramp at all.
    sel=None
    for _tol in (0.18, 0.26, 0.36, 9.9):
        sel=(lum>ref*0.45)&(lum<ref*1.75)&(_hue<_tol)
        if sel.sum()>=1500: break
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
    _l=0.30*ramp[:,0]+0.59*ramp[:,1]+0.11*ramp[:,2]
    ramp=ramp[np.argsort(_l)]
    # GUARANTEE per-channel monotonicity rather than hoping the hue filter
    # delivers it. Sorting by luminance orders the ramp but a channel can still
    # dip when hue varies, and widening the hue tolerance to keep every face
    # brought that back (-9). A running maximum cannot reverse.
    ramp=np.maximum.accumulate(ramp, axis=0)
    # extend the dark end so shadowed body geometry has somewhere to go
    ramp[0]=ramp[0]*0.55; ramp[1]=ramp[1]*0.75
    out[f-1]=[[int(round(v)) for v in row] for row in ramp]
    print(f'face {f-1}: ramp {out[f-1][0]} .. {out[f-1][-1]}')
json.dump(out, open('/mnt/user-data/outputs/breton-skin-ramps.json','w'), indent=1)
print(f'\n{len(out)} ramps written')
