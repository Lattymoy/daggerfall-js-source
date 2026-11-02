"""Segment each reference view into limb regions, per row.
Above the crotch: where a row splits into 3 runs the outer two are arms; where
it splits into 2 the small one is an arm and the arm on the other side is
merged, so its inner edge comes from that arm's own measured width carried
across (the same rule that fixed the paperdoll's arm). Below the crotch the
runs are legs. Which side is armL/armR flips with the view's yaw."""
import numpy as np, json, math
from PIL import Image
YAWS=[0,45,90,135,180,225,270,315]
LM={}
SEG={}
for Y in YAWS:
    im=Image.open(f'view_{Y:03d}.png').convert('RGBA')
    m=np.array(im)[:,:,3]>0
    H,W=m.shape
    def runs(r):
        o=[];st=None
        for x in range(W):
            if m[r][x] and st is None: st=x
            elif not m[r][x] and st is not None:
                if x-st>=2: o.append((st,x-1))
                st=None
        if st is not None: o.append((st,W-1))
        return o
    R={r:runs(r) for r in range(H) if runs(r)}
    r0,r1=min(R),max(R); span=r1-r0
    wid={r:R[r][-1][1]-R[r][0][0]+1 for r in R}
    def gapped(r):
        xs=np.where(m[r])[0]
        return len(xs) and (xs.max()-xs.min()+1)>len(xs)+2
    if Y==0:
        shoulder=max((r for r in R if r0+span*0.10<r<r0+span*0.32), key=lambda r:wid[r])
        crotch=min((r for r in R if r>r0+span*0.44 and gapped(r)), default=r0+int(span*0.52))
        LM['sh']=(shoulder-r0)/span; LM['cr']=(crotch-r0)/span
        print(f'  front landmarks: shoulder {LM["sh"]:.3f}, crotch {LM["cr"]:.3f} of span')
    else:
        # every figure is the same height and framing, so the landmark ROWS
        # transfer by relative position. Profiles have no leg gap to find.
        shoulder=int(r0+LM['sh']*span); crotch=int(r0+LM['cr']*span)
    # arm widths where an arm stands clear of the trunk
    armw={}
    for r in range(shoulder,crotch+int(span*0.12)):
        rr=R.get(r,[])
        if len(rr)>=2:
            sm=min(rr,key=lambda t:t[1]-t[0])
            if (sm[1]-sm[0]+1) < wid[r]*0.42: armw[r]=sm[1]-sm[0]+1
    med=int(np.median(list(armw.values()))) if armw else max(4,int(wid[shoulder]*0.16))
    # the arms end where the 3-run band first breaks below the crotch;
    # further down, 3+ runs are toes, not arms
    # a 3/4 view merges the near arm into the trunk at hip height, so the
    # 3-run band is interrupted; take the LAST 3-run row inside a hip window
    # rather than stopping at the first break (toes are far below the window)
    win=int(crotch+(r1-crotch)*0.24)
    armEnd=crotch
    for r in range(crotch, min(win,r1)+1):
        if len(R.get(r,[]))>=3: armEnd=r
    parts={'body':{},'armA':{},'armB':{},'legA':{},'legB':{}}   # A = low x, B = high x
    for r in sorted(R):
        rr=R[r]
        if r>=crotch:
            # THE ARMS HANG PAST THE HIP. Below the crotch the reference still
            # reads arm | legs | arm for ~60 rows, so taking the outermost runs
            # as legs steals the arms and leaves the hands with no region.
            if r<=armEnd and len(rr)>=3:
                parts['armA'][r]=rr[0]; parts['armB'][r]=rr[-1]
                mid=rr[1:-1]
                # A FIST OVERLAPPING A THIGH IS NOT RESOLVABLE FROM RUNS.
                # Only read rows whose topology is unambiguous (1 or 2 middle
                # runs); leave the rest blank and interpolate them afterwards,
                # since legs taper smoothly and the clean rows bracket them.
                if len(mid)==2:
                    parts['legA'][r]=mid[0]; parts['legB'][r]=mid[-1]
                elif len(mid)==1:
                    s0,e=mid[0]; h=(s0+e)//2
                    parts['legA'][r]=(s0,h); parts['legB'][r]=(h+1,e)
            elif r<=armEnd and len(rr)==2:
                # one arm clear, the other merged into the trunk: carry it in
                # from the far edge by its own measured width
                sm=min(rr,key=lambda t:t[1]-t[0]); bg=max(rr,key=lambda t:t[1]-t[0])
                if sm[0]<bg[0]:
                    parts['armA'][r]=sm
                    parts['armB'][r]=(max(bg[0],bg[1]-med+1),bg[1])
                    parts['legA'][r]=(bg[0],(bg[0]+bg[1])//2)
                    parts['legB'][r]=((bg[0]+bg[1])//2+1,max(bg[0],bg[1]-med))
                else:
                    parts['armB'][r]=sm
                    parts['armA'][r]=(bg[0],min(bg[1],bg[0]+med-1))
                    parts['legA'][r]=(min(bg[1],bg[0]+med),(bg[0]+bg[1])//2)
                    parts['legB'][r]=((bg[0]+bg[1])//2+1,bg[1])
            elif len(rr)>=2:
                parts['legA'][r]=rr[0]; parts['legB'][r]=rr[-1]
            else:
                s0,e=rr[0]; h=(s0+e)//2
                parts['legA'][r]=(s0,h); parts['legB'][r]=(h+1,e)
            continue
        if len(rr)>=3:
            parts['armA'][r]=rr[0]; parts['armB'][r]=rr[-1]
            parts['body'][r]=(rr[1][0],rr[-2][1])
        elif len(rr)==2:
            sm=min(rr,key=lambda t:t[1]-t[0]); bg=max(rr,key=lambda t:t[1]-t[0])
            if sm[0]<bg[0]:
                parts['armA'][r]=sm
                inner=max(bg[0], bg[1]-med+1)
                parts['armB'][r]=(inner,bg[1]); parts['body'][r]=(bg[0],inner-1)
            else:
                parts['armB'][r]=sm
                inner=min(bg[1], bg[0]+med-1)
                parts['armA'][r]=(bg[0],inner); parts['body'][r]=(inner+1,bg[1])
        else:
            s0,e=rr[0]
            if r<shoulder: parts['body'][r]=(s0,e)
            else:
                parts['armA'][r]=(s0,min(e,s0+med-1))
                parts['armB'][r]=(max(s0,e-med+1),e)
                parts['body'][r]=(min(e,s0+med), max(s0,e-med))
    # fill the unreadable band by interpolating between the clean rows
    for nm in ('legA','legB'):
        d=parts[nm]; ks=sorted(d)
        if not ks: continue
        holes=[r for r in range(ks[0],ks[-1]+1) if r not in d]
        for r in holes:
            lo=max(k for k in ks if k<r); hi=min(k for k in ks if k>r)
            t=(r-lo)/(hi-lo)
            a=(round(d[lo][0]+(d[hi][0]-d[lo][0])*t), round(d[lo][1]+(d[hi][1]-d[lo][1])*t))
            d[r]=a
        if holes: print(f'    {nm}: interpolated {len(holes)} unreadable rows '
                        f'({min(holes)}..{max(holes)})')
    if Y in (90,270):
        for r in list(parts['armA']): del parts['armA'][r]
        for r in list(parts['armB']): del parts['armB'][r]
        for r in sorted(R):
            rr=R[r]
            if r<crotch: parts['body'][r]=(rr[0][0],rr[-1][1])
            else:
                s0,e=rr[0][0],rr[-1][1]
                parts['legA'][r]=(s0,e); parts['legB'][r]=(s0,e)
    parts={k:{r:v for r,v in d.items() if v[1]>v[0]} for k,d in parts.items()}
    print(f'    armEnd {armEnd} (crotch {crotch}, +{armEnd-crotch} rows)')
    SEG[Y]={'parts':parts,'shoulder':int(shoulder),'crotch':int(crotch),
            'r0':int(r0),'r1':int(r1),'armw':med,'W':int(W),'H':int(H)}
    print(f'yaw {Y:3d}: shoulder {shoulder}  crotch {crotch}  armw {med}  '
          + ' '.join(f'{k}:{len(v)}' for k,v in parts.items()))
json.dump({str(k):{'parts':{p:{str(r):list(v) for r,v in d.items()} for p,d in s['parts'].items()},
                   **{x:s[x] for x in ('shoulder','crotch','r0','r1','armw','W','H')}}
           for k,s in SEG.items()}, open('seg.json','w'))
