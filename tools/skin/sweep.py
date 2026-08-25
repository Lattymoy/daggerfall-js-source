"""Span sweep, ONE script for every race. The per-race sed-copies of this had
three wrong paths between them - it ran the Nord bake, read Nord cells, and
wrote a Nord filename while claiming to sweep High Elves. Derive the paths from
the race key instead, so a wrong race is impossible rather than merely unlikely.

  python3 sweep.py <race> <face 0-9> <spans>
  python3 sweep.py highelf 6 0.65,0.75,0.85,0.99
"""
import sys, os, subprocess
from PIL import Image, ImageDraw
RACE = sys.argv[1]
FACE = int(sys.argv[2]) + 1                  # bakes are 1-indexed
SPANS = sys.argv[3].split(',')
DIR   = {'breton':'heads','redguard':'heads_rg','nord':'heads_nd',
         'darkelf':'heads_de','highelf':'heads_he','woodelf':'heads_we',
         'khajiit':'heads_kh','argonian':'heads_ar'}[RACE]
BAKE  = {'breton':'head_bake.py','redguard':'head_bake_rg.py','nord':'head_bake_nd.py',
         'darkelf':'head_bake_de.py','highelf':'head_bake_he.py','woodelf':'head_bake_we.py',
         'khajiit':'head_bake_kh.py','argonian':'head_bake_ar.py'}[RACE]
crops=[]
for sp in SPANS:
    r=subprocess.run(['python3',BAKE,str(FACE)], env=dict(os.environ,SPAN=sp),
                     capture_output=True, text=True, timeout=1200)
    _want = f"span {float(sp.split(':')[0]):.2f}:{float(sp.split(':')[1]):.2f}" if ':' in sp else f'span {float(sp):.2f}'
    if _want not in r.stdout and f'span 0.00:{float(sp):.2f}' not in r.stdout:
        sys.exit(f'ABORT: {BAKE} did not honour SPAN={sp}\n{r.stdout[-400:]}{r.stderr[-400:]}')
    c=Image.open(f'{DIR}/cell_{FACE}.png').convert('RGB')
    w,h=c.size
    crops.append((sp, c.crop((int(w*0.40),0,int(w*0.60),h)).resize((int(w*0.20)//2,h//2), Image.LANCZOS)))
CW,CH=crops[0][1].size
out=Image.new('RGB',(len(crops)*(CW+8)+8, CH+28),(20,20,23))
d=ImageDraw.Draw(out)
for i,(sp,c) in enumerate(crops):
    x=8+i*(CW+8); out.paste(c,(x,22)); d.text((x+2,5),f'span {sp}',fill=(180,180,190))
path=f'/mnt/user-data/outputs/sweep-{RACE}{FACE-1}.png'
out.save(path)
print(f'{RACE} face {FACE-1}: ' + ', '.join(s for s,_ in crops) + f'  -> {path}')
