#!/bin/bash
# AUDIT 65: merge origin/main into the round-one head, cites by provenance.
set -e
S=/tmp/claude-0/-home-user-daggerfall-js-source/bb6b4fae-5956-5f83-84ff-79d9c78d9657/scratchpad/a65
cd /home/user/daggerfall-js-source
git reset -q --hard 6ef9797d; rm -f .git/MERGE_HEAD .git/MERGE_MSG .git/MERGE_MODE
git merge --no-commit origin/main 2>&1 | grep -c CONFLICT || true
python3 - <<'PY'
import subprocess,re
files=subprocess.run(['git','diff','--name-only','--diff-filter=U'],capture_output=True,text=True).stdout.split()
n=0
for f in files:
    s=open(f).read()
    def keep(m):
        global n; n+=1; return m.group(2)
    s2=re.sub(r'<<<<<<< HEAD\n(.*?)=======\n(.*?)>>>>>>> origin/main\n', keep, s, flags=re.S)
    assert '<<<<<<<' not in s2, f
    open(f,'w').write(s2); subprocess.run(['git','add',f],check=True)
print('resolved',len(files),'files',n,'hunks to main')
p='src/combat/weaponRig.js'; s=open(p).read()
old="""export async function autoBuildArms(entity, { wanted = () => getPref('mwArms'), dataCount = morrowindDataCount } = {}) {
  if (!entity?.chargenDone || !wanted() || !(dataCount() > 0) || fpArm.ready()) return null;
  const res = await buildArmsFor(entity);"""
new="""export async function autoBuildArms(entity, { wanted = () => getPref('mwArms'), dataCount = morrowindDataCount, measure = registerMorrowindData, measured = morrowindDataFingerprint } = {}) {
  if (!entity?.chargenDone || !wanted() || !(dataCount() > 0) || fpArm.ready()) return null;
  // AUDIT 65 XL-6: the boot menu only COUNTS the store now (names, no
  // sizes), so this can run before the host bootstrap's fingerprint
  // lands - and fpArm keys its kept face verdict on that print. Measure
  // first, as the pane's Build button does, so the verdict is a lookup
  // and not a dozen mesh parses on every launch.
  if (measured() == null) await measure().catch(() => 0);
  const res = await buildArmsFor(entity);"""
assert s.count(old)==1; s=s.replace(old,new)
old2="import { morrowindDataCount } from '../scenes/dataSource.js';   // MWA1: are the archives attached"
new2="import { morrowindDataCount, morrowindDataFingerprint, registerMorrowindData } from '../scenes/dataSource.js';   // MWA1: are the archives attached; AUDIT 65 XL-6: and measured"
assert s.count(old2)==1; s=s.replace(old2,new2); open(p,'w').write(s); print('autoBuildArms ok')
PY
node $S/mergeCites.mjs /home/user/daggerfall-js-source origin/main 6ef9797d --apply > $S/mergeCites-report.txt 2>&1
tail -1 $S/mergeCites-report.txt
grep -vc "^  moved" $S/mergeCites-report.txt | sed 's/^/held lines: /'
echo MAPPED
