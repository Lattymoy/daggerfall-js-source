#!/bin/bash
# After mergeCites: the pins the merge itself changes, the regenerated lists, the gates.
cd /home/user/daggerfall-js-source
export DFU_PATH=/home/user/daggerfall-js-source/tools/parity/dfu
python3 - <<'PY'
p='test/mwarms_fps.test.js'; s=open(p).read()
old=r"""  assert.match(rig, /export async function autoBuildArms\(entity, \{ wanted = \(\) => getPref\('mwArms'\), dataCount = morrowindDataCount \} = \{\}\)/);"""
new=r"""  assert.match(rig, /export async function autoBuildArms\(entity, \{ wanted = \(\) => getPref\('mwArms'\), dataCount = morrowindDataCount, measure = registerMorrowindData, measured = morrowindDataFingerprint \} = \{\}\)/);
  assert.match(rig, /if \(measured\(\) == null\) await measure\(\)\.catch\(\(\) => 0\);\n\s+const res = await buildArmsFor\(entity\);/, 'AUDIT 65 XL-6: the store is measured before the face verdict, not parsed a dozen times');"""
assert s.count(old)==1, 'mwarms pin'; open(p,'w').write(s.replace(old,new)); print('mwarms pin ok')
PY
node tools/regenOpenFlags.mjs | tail -1
N=$(cat test/*.test.js | grep -c "^test("); F=$(ls test/*.test.js | wc -l); sed -i "s/^Node 22). Suite: [0-9]* tests across [0-9]* files\./Node 22). Suite: $N tests across $F files./" bible/09-Testing/Testing.md; grep -n "^Node 22). Suite" bible/09-Testing/Testing.md
echo "=== hand-cite sites (verify by content)"; sed -n 148,149p src/ui/pauseDoor.js | cut -c1-90; sed -n '407p;429p;469p' src/ui/enhancedMenu.js | cut -c1-100; grep -n "_confirmExit() {\|^      this._closeWith();$\|this.hooks.quickSave?.();\|this.hooks.quickLoad?.();" src/ui/pauseWindow.js; sed -n 1414p src/render/renderer.js; grep -n "^  setClearColor(rgba)" src/render/renderer.js; grep -n "dungeon\\\\.js:43[0-9]" test/citedrift.test.js | head -2; grep -n "dungeon.js:43[0-9] and worldModes" src/systems/chargenSession.js; grep -n "ctx.overlayHover?.(v" src/scenes/dungeon.js; grep -n "dungeonCtx.overlayHover" src/scenes/worldModes.js
echo "=== lint"; npm run lint 2>&1 | grep -E "error|warning|problems" | head -8
echo "=== behaviour"; node --test test/mwarms_fps.test.js test/mwattach.test.js test/mac1_playreport.test.js test/mwload_records.test.js test/touchinput2.test.js test/audit62_touch.test.js test/enhancedControls.test.js test/pausewindow.test.js test/audit65_swim.test.js test/glstate.test.js 2>&1 | grep -E "^# (pass|fail)|^not ok"
echo "=== doc gates"; node --test test/citedrift.test.js test/manifest.test.js test/audit18_bible_docs.test.js test/ledger.test.js test/landing.test.js test/flagsweep.test.js test/audit24_wave25.test.js test/doctrine.test.js test/citeshift.test.js 2>&1 | grep -E "^# (pass|fail)|^not ok"; node tools/regenOpenFlags.mjs --check | tail -1; echo POST-DONE
