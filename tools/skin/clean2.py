import numpy as np, json
from PIL import Image
A=np.array(Image.open('/mnt/user-data/outputs/skin-atlas.png').convert('RGBA')).astype(np.int16)
L=json.load(open('/mnt/user-data/outputs/skin-layout.json'))
H,W,_=A.shape
ok=A[:,:,3]>0
out=A.copy(); okm=ok.copy()
for g,c in L.items():
    x0,y0,w,h=c['x'],c['y'],c['w'],c['h']
    cell=A[y0:y0+h, x0:x0+w]; m=ok[y0:y0+h, x0:x0+w]
    lum=cell[:,:,:3].sum(axis=2)/3.0
    good=lum[m]
    med=np.median(good) if good.size else 0
    # THE DARK CAP IS AN ARTIFACT, NOT TEXTURE. Rows well below the cell's own
    # median are the rig reaching above what the reference supplies; mark them
    # unresolved so they get refilled instead of propagated.
    killed=0
    for y in range(h):
        row=m[y]
        if row.sum()<3: continue
        if np.median(lum[y][row]) < med*0.62:
            okm[y0+y, x0:x0+w]=False; killed+=row.sum()
    # fill every hole from the nearest resolved texel in the SAME column, so
    # the limb's horizontal structure is preserved rather than blurred
    for x in range(w):
        colok=okm[y0:y0+h, x0+x]
        if not colok.any(): continue
        idx=np.where(colok)[0]
        for y in range(h):
            if colok[y]: continue
            j=idx[np.argmin(np.abs(idx-y))]
            out[y0+y, x0+x]=out[y0+j, x0+x]; out[y0+y, x0+x,3]=255
    print(f'{g:5s}: median lum {med:5.1f}  dark-cap texels removed {killed}')
# then the streak pass, unchanged
K=4; fixed=0
final=out.copy()
for g,c in L.items():
    x0,y0,w,h=c['x'],c['y'],c['w'],c['h']
    cell=out[y0:y0+h, x0:x0+w,:3].astype(np.float32)
    for x in range(w):
        col=cell[:,x,:]
        for y in range(h):
            lo,hi=max(0,y-K),min(h,y+K+1)
            nb=[col[t] for t in range(lo,hi) if t!=y]
            if len(nb)<4: continue
            med=np.median(np.stack(nb),axis=0)
            if np.abs(col[y]-med).sum()>78:
                final[y0+y,x0+x,:3]=med.astype(np.int16); fixed+=1
print('streak texels replaced:',fixed)
Image.fromarray(final.astype(np.uint8)).save('/mnt/user-data/outputs/skin-atlas-clean.png')
Image.open('/mnt/user-data/outputs/skin-atlas-clean.png').resize((W*3,H*3),Image.NEAREST)\
     .save('/mnt/user-data/outputs/skin-atlas-clean-preview.png')
print('saved')
