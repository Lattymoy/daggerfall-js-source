#!/bin/bash
# One merge cycle of origin/main into HEAD: conflicts, citeMerge by provenance, the
# cites the mappers cannot see (by content), the counts, the gates, the full suite.
set -e
S=/tmp/claude-0/-home-user-daggerfall-js-source/bb6b4fae-5956-5f83-84ff-79d9c78d9657/scratchpad/a65
cd /home/user/daggerfall-js-source
export DFU_PATH=/home/user/daggerfall-js-source/tools/parity/dfu
OURS=$(git rev-parse HEAD); THEIRS=$(git rev-parse origin/main)
echo "ours $OURS theirs $THEIRS"; git log --oneline $OURS..origin/main | cat
git merge --no-commit origin/main 2>&1 | grep -c CONFLICT || true
python3 - <<'PY'
import subprocess,re,sys
files=subprocess.run(['git','diff','--name-only','--diff-filter=U'],capture_output=True,text=True).stdout.split()
norm=lambda x: re.sub(r'\d+','#',x)
nt=no=0; bad=[]
for f in files:
    s=open(f).read()
    def keep(m):
        global nt,no
        ours,theirs=m.group(1),m.group(2)
        if norm(ours)==norm(theirs): nt+=1; return theirs
        ol=[norm(x) for x in ours.split('\n') if x]; tl=[norm(x) for x in theirs.split('\n') if x]
        # safe shapes: ours is theirs plus additions, or the one XL-1 line theirs never took
        if all(t in ol for t in tl) or 'player.isPlayerSwimming' in ours and 'player.swimming' in theirs and len(ol)==len(tl):
            no+=1; return ours
        bad.append((f,ours[:300],theirs[:300])); return m.group(0)
    s2=re.sub(r'<<<<<<< HEAD\n(.*?)=======\n(.*?)>>>>>>> origin/main\n', keep, s, flags=re.S)
    open(f,'w').write(s2)
    if '<<<<<<<' not in s2: subprocess.run(['git','add',f],check=True)
print(f'resolved {len(files)} files: {nt} numeric hunks to theirs, {no} text hunks to ours')
if bad:
    for f,o,t in bad: print('UNRESOLVED',f); print('  ours:',o); print('  theirs:',t)
    sys.exit(3)
PY
node tools/citeMerge.mjs origin/main $OURS --apply > $S/citeMerge-report-$THEIRS.txt 2>&1 || true
tail -1 $S/citeMerge-report-$THEIRS.txt; grep -v "^  moved\|^        ->\|^fatal\|cite(s) moved" $S/citeMerge-report-$THEIRS.txt || true
# the cites the mappers cannot see, by content
python3 - <<'PY'
import re
def setline(p, ln, old, new):
    L=open(p).read().split('\n'); assert old in L[ln-1], (p,ln,old); L[ln-1]=L[ln-1].replace(old,new); open(p,'w').write('\n'.join(L))
R=open('src/render/renderer.js').read().split('\n')
n=[i+1 for i,l in enumerate(R) if l.startswith('  setClearColor(rgba)')][0]
m=[(i+1,l) for i,l in enumerate(R) if 'setClearColor (:' in l][0]
cur=re.search(r'setClearColor \(:(\d+)\)',m[1]).group(1)
if int(cur)!=n: setline('src/render/renderer.js',m[0],f'setClearColor (:{cur})',f'setClearColor (:{n})'); print('renderer self-cite',cur,'->',n)
D=open('src/scenes/dungeon.js').read().split('\n'); dn=[i+1 for i,l in enumerate(D) if 'ctx.overlayHover?.(v ? v[0]' in l][0]
W=open('src/scenes/worldModes.js').read().split('\n'); wn=[i+1 for i,l in enumerate(W) if 'dungeonCtx.overlayHover?.(v ? v[0]' in l][0]
T=open('test/citedrift.test.js').read()
t=re.search(r'dungeon\\\.js:(\d+) and worldModes\\\.js',T).group(1)
if int(t)!=dn: open('test/citedrift.test.js','w').write(T.replace(f'/dungeon\\.js:{t} and worldModes',f'/dungeon\\.js:{dn} and worldModes')); print('CD4 literal',t,'->',dn)
C=open('src/systems/chargenSession.js').read(); c=re.search(r'dungeon\.js:(\d+) and worldModes\.js:(\d+) both feed',C)
if (int(c.group(1)),int(c.group(2)))!=(dn,wn): open('src/systems/chargenSession.js','w').write(C.replace(c.group(0),f'dungeon.js:{dn} and worldModes.js:{wn} both feed')); print('chargenSession feed cite ->',dn,wn)
import os
for page,d in (('bible/10-UI/UI.md','src/ui'),('bible/06-Systems/Systems.md','src/systems')):
    real=len([f for f in os.listdir(d) if f.endswith('.js')]); s=open(page).read()
    m=re.search(r'(\d+) modules\s*\n?\s*live under\s*\n?\s*`'+d+'/`',s)
    if int(m.group(1))!=real: open(page,'w').write(s.replace(m.group(0),m.group(0).replace(m.group(1),str(real),1))); print(page,'modules',m.group(1),'->',real)
PY
node tools/regenOpenFlags.mjs | tail -1
N=$(cat test/*.test.js | grep -c "^test("); F=$(ls test/*.test.js | wc -l); sed -i "s/^Node 22). Suite: [0-9]* tests across [0-9]* files\./Node 22). Suite: $N tests across $F files./" bible/09-Testing/Testing.md; grep -n "^Node 22). Suite" bible/09-Testing/Testing.md
echo "=== lint"; npm run lint 2>&1 | grep -E "error|warning|problems" || true
echo "=== gates"; node --test test/citemerge.test.js test/citedrift.test.js test/manifest.test.js test/audit18_bible_docs.test.js test/ledger.test.js test/landing.test.js test/flagsweep.test.js test/audit24_wave25.test.js test/doctrine.test.js test/citeshift.test.js test/probehygiene.test.js test/mwarms_fps.test.js test/audit65_swim.test.js test/glstate.test.js 2>&1 | grep -E "^# (pass|fail)|^not ok"; node tools/regenOpenFlags.mjs --check | tail -1
echo "=== full suite"; npm test > $S/fullsuite-$THEIRS.txt 2>&1 && echo "FULL SUITE GREEN" || { echo "FULL SUITE RED"; grep "^not ok" $S/fullsuite-$THEIRS.txt | head -5; }
grep -E "^# (tests|pass|fail|skipped)" $S/fullsuite-$THEIRS.txt
echo CYCLE-DONE
