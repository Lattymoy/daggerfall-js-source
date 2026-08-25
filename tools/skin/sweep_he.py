"""Emit a span sweep for one face: the same head baked at several spans, so the
right one can be picked by eye. Beats any detector - Mac read 0.75 correctly in
seconds where seven heuristics landed at 0.55-0.66."""
import sys, os, subprocess
from PIL import Image, ImageDraw
FACE=int(sys.argv[1]); SPANS=sys.argv[2].split(',')
crops=[]
for sp in SPANS:
    env=dict(os.environ, SPAN=sp)
    subprocess.run(['python3','head_bake_he.py',str(FACE)],env=env,
                   capture_output=True,timeout=900)
    c=Image.open(f'heads_he/cell_{FACE}.png').convert('RGB')
    w,h=c.size
    crops.append((sp, c.crop((int(w*0.40),0,int(w*0.60),h)).resize((int(w*0.20)//2,h//2), Image.LANCZOS)))
CW,CH=crops[0][1].size
out=Image.new('RGB',(len(crops)*(CW+8)+8, CH+28),(20,20,23))
d=ImageDraw.Draw(out)
for i,(sp,c) in enumerate(crops):
    x=8+i*(CW+8); out.paste(c,(x,22)); d.text((x+2,5),f'span {sp}',fill=(180,180,190))
out.save(f'/mnt/user-data/outputs/sweep-he{FACE-1}.png')
print(f'face {FACE-1}: ' + ', '.join(s for s,_ in crops))
