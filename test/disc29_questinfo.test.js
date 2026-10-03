// DISC29-H (2026-09-28, Triage on Discord: expelled from the Mages Guild in the middle of its guard quest) - INFO MODE
// LOOKS AT A QUEST STAND; IT DOES NOT CLICK IT.
//
// What expels is N0B20Y02's own script, faithfully run: a click on the sleeping mage is `_S.04_` (-10, and a shielded
// hostile Mage placed in the hall) and that Mage's death is `_S.07_` (-50), so the guild's next visit finds a negative
// reputation (Guild.UpdateRank: expelled; JOIN: TEXT.RSC 612). The raiders' deaths change no reputation at all. The
// port's part was HOW a player could click him: DFU's quest-resource arm clicks "only ... when not in info mode"
// (PlayerActivate.cs:334-338), and a static NPC in Info is PresentNPCInfo's one line (:753-757, :1484-1486) -
// StaticNPCClick and its DoClick belong to Grab, Talk and Steal. The port's quest-stand click ran DoClick in every mode.
// The click lives in worldModes' closure, so this pins it by source, as DQ1's suite (dungeonquestclick) pins the rest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { presentNpcInfoText } from '../src/player/activate.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const wm = () => readFileSync(join(ROOT, 'src/scenes/worldModes.js'), 'utf8');
const click = () => {
  const s = wm();
  return s.slice(s.indexOf('const clickQuestFlat = (s, buildingKey) => {'), s.indexOf('const questAdapter = {'));
};

test('DISC29-H: Info returns before the stamp and before DoClick - a look springs nothing', () => {
  const c = click();
  const info = c.indexOf("if (getInteractionMode() === 'info') {");
  assert.ok(info > 0, 'the Info arm is in the one click body');
  const infoArm = c.slice(info, c.indexOf('\n    }\n', info) + 7);
  assert.match(infoArm, /\n\s+return;\n\s+\}\n$/, 'it ends the click');
  assert.doesNotMatch(infoArm, /doClick|setLastNPCClicked/, 'neither DoClick nor StaticNPCClick\'s stamp');
  assert.ok(info < c.indexOf('setLastNPCClicked(npcData())'), 'before the stamp');
  assert.ok(info < c.indexOf('s.behaviour?.doClick()'), 'and before the click');
});

test('DISC29-H: a Person in Info is PresentNPCInfo\'s one line, named by StaticNPC.DisplayName off the stamp\'s own layout data', () => {
  const c = click();
  const info = c.slice(c.indexOf("if (getInteractionMode() === 'info') {"));
  assert.match(info, /if \(questBridge && person\?\.isPerson\) \{\s*\n\s+const data = npcData\(\);/, 'a Person only: an item in Info is silent');
  assert.match(info, /Promise\.resolve\(townTalk\?\.ensureFactions\?\.\(\)\)\s*\n\s+\.then\(\(\) => townTalk\?\.say\?\.\(presentNpcInfoText\(npcShownName\(data\)\)\)\)\.catch\(\(\) => \{\}\);/,
    'FACTION.TXT first, as activateStaticNpc waits for it (an Individual faction names the NPC)');
  // the same line a plain static NPC's Info look prints
  assert.match(wm(), /townTalk\?\.say\?\.\(presentNpcInfoText\(displayName\)\);/);
  assert.equal(presentNpcInfoText('Mordard Bryte'), 'You see Mordard Bryte.');
});

test('DISC29-H: Grab, Talk and Steal click as before - the stamp, then DoClick', () => {
  const c = click();
  const stamp = c.indexOf('if (questBridge && person?.isPerson) questBridge.machine.setLastNPCClicked(npcData());');
  assert.ok(stamp > 0);
  assert.ok(stamp < c.indexOf('const foundInActiveQuest = s.behaviour?.doClick() ?? false;'));
});
