// CHARGEN-REFLEX (2026-09-22, Fay on Discord, desktop build 0.1.3612:
// "The Continue button on the Reflex page is not clickable. Tried all
// the different reflex options, but I can only click the Back
// button."). A character could not be created at all.
//
// THE BUTTON WAS NEVER DISABLED AND THE FLOW WAS NEVER STUCK - both
// were the first two guesses and both were wrong, which is why they
// are pinned below rather than merely remembered. It was COVERED:
// `.choose` is centred at `height: 100%`, `.stagebody`'s implicit grid
// row is `auto` (max-content), so a stage taller than the pane kept
// its full height while `.stagebody` shrank under `flex: 1;
// min-height: 0` - and the overflow painted under the opaque
// `.actionbar` laid out straight after it.
//
// THE REAL PROOF IS A MEASUREMENT and lives in
// tools/chargenReflexProbe.mjs, which reads
// `document.elementFromPoint` at the button's own centre in a real
// browser at eight window sizes (it answers `DIV.actionbar` at
// 1280x720 before the fix, and the probe re-proves that on demand with
// SHOW_BUG=1). Node cannot see a painted rectangle. What node CAN hold
// is the structure that made the rectangle reachable, which is what
// these pins are - and they are named as the weaker half on purpose.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ChargenFlow } from '../src/ui/chargen.js';
import { ENHANCED_CSS } from '../src/ui/enhancedStyle.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

test('CHARGEN-REFLEX: the wizard primary action lives in the action bar, never inside a scrolling stage', () => {
  const src = readFileSync(join(ROOT, 'src/ui/enhancedChargen.js'), 'utf8');

  // THE LAW. `.choose` scrolls, and a control inside a scrolling box
  // can be out of view; `.actionbar` is a sibling of the stage and is
  // always on screen. So a stage that needs a confirm DECLARES it and
  // the bar draws it. Any `.choose` stage that appends its own primary
  // button is the fault class Fay hit, whoever writes it next.
  // Split on TOP-LEVEL declarations rather than trying to match a
  // function body with a regex: a non-greedy `\n}` stops at the first
  // nested block and the chunks bleed into each other, which is how
  // the first draft of this pin blamed two stages that do not even
  // build a `.choose` (faceStage and summaryStage are two-column
  // stages whose primaries sit in `.detail`, which scrolls).
  const chunks = src.split(/\nfunction /).map((c) => {
    const name = /^(\w+)\(/.exec(c)?.[1] ?? null;
    return { name, body: c };
  }).filter((c) => c.name);
  const chooseStages = chunks.filter((c) => /el\('div', 'choose'\)/.test(c.body));
  assert.ok(chooseStages.length >= 4, `the wizard still has choose-stages (${chooseStages.length})`);

  // THE MANDATORY PATH IS CONVERTED. Every player passes the name
  // stage, the biography's reputation box and the reflexes stage, and
  // a primary that can be covered on any of the three is a wizard that
  // cannot be finished - which is what was reported.
  for (const name of ['nameStage', 'repBoxPane', 'reflexStage']) {
    const st = chooseStages.find((c) => c.name === name);
    assert.ok(st, `${name} is still a choose-stage`);
    assert.ok(!/'act primary'/.test(st.body),
      `${name} draws a primary inside .choose, where the action bar can paint over it`);
    assert.match(st.body, /stagePrimary = \{/, `${name} declares its primary instead`);
  }

  // THE REST ARE NAMED, NOT SILENT. Four stages still draw a primary
  // inside a `.choose`, and all four are short card panes rather than
  // tall question stages - the CSS half of this fix makes `.choose`
  // scroll instead of spilling under the bar, so they are reachable,
  // but they are second-class until they are converted too. The list
  // may SHRINK and never grow: a new offender fails here.
  const KNOWN = ['classQuestionsStage', 'customBoxPane', 'faceStage', 'summaryStage'];
  const offenders = chooseStages
    .filter((c) => /'act primary'/.test(c.body))
    .map((c) => c.name);
  const unexpected = offenders.filter((n) => !KNOWN.includes(n));
  assert.deepEqual(unexpected, [],
    'a NEW primary drawn inside .choose repeats the fault a player already reported');
  const fixed = KNOWN.filter((n) => !offenders.includes(n));
  assert.deepEqual(fixed, [],
    'a converted stage should be deleted from KNOWN rather than left claiming to be broken');

  // ...and the reflexes stage, which is the only one that NEEDS a
  // confirm (every other choose-stage advances on the answer itself),
  // declares one.
  const reflex = chooseStages.find((c) => c.name === 'reflexStage');
  assert.ok(reflex, 'reflexStage is still a choose-stage');
  assert.match(reflex.body, /stagePrimary = \{/, 'reflexStage declares its Continue');
  assert.match(src, /stagePrimary = null;\n(\s*nameOk = null;\n)?\s*pane\.append/,
    'and the slot is cleared BEFORE the stage runs, so no stage inherits the last one\'s button');
});

test('CHARGEN-REFLEX: a stage taller than the pane can shrink and scroll rather than overflow', () => {
  // The two properties the measurement turned on. A revert of either
  // puts the overflow back under the action bar, and CI does not run
  // the browser probe - so this is the line that notices.
  const stagebody = /\.stagebody \{[^}]*\}/.exec(ENHANCED_CSS)?.[0] ?? '';
  assert.match(stagebody, /grid-template-rows:\s*minmax\(0,\s*1fr\)/,
    'an auto row is max-content and will not give way');

  const choose = /\n\.choose \{[^}]*\}/.exec(ENHANCED_CSS)?.[0] ?? '';
  assert.match(choose, /place-content:\s*safe center/,
    'plain center puts half the overflow above the start edge, where nothing can scroll to it');
  assert.match(choose, /overflow-y:\s*auto/,
    'and the rest has to be reachable');
});

test('CHARGEN-REFLEX: the two things that were NOT wrong - the flow advances and the button is enabled', () => {
  // Pinned because they were the first two hypotheses and cost real
  // time. If this wizard ever strands a player again, these say where
  // NOT to look.
  const f = new ChargenFlow({});
  f.state = 'reflexes';
  f.input('confirm');
  assert.equal(f.state, 'summary', 'confirm at reflexes reaches the summary');

  const src = readFileSync(join(ROOT, 'src/ui/enhancedChargen.js'), 'utf8');
  const bar = /const bar = el\('div', 'actionbar'\);[\s\S]*?pane\.append\(bar\);/.exec(src)?.[0] ?? '';
  assert.match(bar, /el\('button', 'act primary', stagePrimary\.label\)/, 'the bar draws the declared action');
  // The bar's button is LIVE unless the stage itself asks otherwise -
  // only the name stage does, because AcceptName leaves an empty name
  // inert and the skin shows that as a disabled primary. Reflexes
  // declares no `disabled`, so its Continue can never be dead: the
  // report was a covered button, never a refused one.
  assert.match(bar, /go\.disabled = !!stagePrimary\.disabled/, 'the stage decides, not the bar');
  const reflexBody = src.split(/\nfunction /).find((c) => /^reflexStage\(/.test(c)) ?? '';
  assert.ok(!/disabled/.test(reflexBody), 'the reflexes Continue is never disabled');
});
