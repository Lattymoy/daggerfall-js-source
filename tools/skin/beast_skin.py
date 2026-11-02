"""A smoothed intensity map for the fur and scale races.
The body atlas is baked from a HUMAN turnaround, so it carries human anatomy:
pectorals, abdominals, navel, nipples. Tinting that fur-brown or hide-green
leaves a Khajiit with a six-pack. Keep the broad form-shading, drop the fine
detail: fine-detail amplitude measured at mean 13-15 per texel, so a gaussian
low-pass removes it while the limb and torso volumes survive untouched."""
import numpy as np, json
from PIL import Image
I=np.array(Image.open('/mnt/user-data/outputs/skin-intensity.png').convert('L')).astype(float)
L=json.load(open('/mnt/user-data/outputs/skin-layout.json'))
def blur(a,s):
    r=int(s*3); k=np.exp(-0.5*(np.arange(-r,r+1)/s)**2); k/=k.sum()
    b=np.apply_along_axis(lambda v: np.convolve(np.pad(v,(r,r),mode='edge'),k,mode='valid'),0,a)
    return np.apply_along_axis(lambda v: np.convolve(np.pad(v,(r,r),mode='edge'),k,mode='valid'),1,b)
out=I.copy()
for g,c in L.items():
    if g=='head': continue                      # the head carries the race's own face
    sub=I[c['y']:c['y']+c['h'], c['x']:c['x']+c['w']]
    sm=blur(sub, 5.0)
    out[c['y']:c['y']+c['h'], c['x']:c['x']+c['w']]=sm
    d=np.abs(sub-sm)
    print(f'  {g:5s} removed fine detail: mean {d.mean():5.2f}, max {d.max():5.0f}')
Image.fromarray(np.clip(out,0,255).astype(np.uint8),'L').save('/mnt/user-data/outputs/skin-intensity-beast.png')
print('wrote skin-intensity-beast.png')
