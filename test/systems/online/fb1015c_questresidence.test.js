// FIELD BUGS 2026-10-15c - QUEST-RESIDENCE, the Discord's "Research Notes Quest bug": "I've visited every residence in
// Tambeth and NONE are the Tambeth Hawkley Residence". N0B00Y09's scholar lives in `Place _scholar_home_ remote house`;
// picked before QUEST-HOME (main, 2026-10-15) the site could be another player's online home in a town the page had never
// asked (`homeAt` knew no remote town), and a home's door says its owner's name over the building's - so no door in
// Tambeth said "The Hawkley Residence". QUEST-HOME's re-pick moves such a site on the next online boot; a site it cannot
// move (no other house, or one the player has stood in) now says the quest's name at the door. `01-Overview/bugs/Field-Bugs-2026-10-15c.md`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { homeDoorTitle } from '../../../src/systems/online/onlineHomes.js';

test('QUEST-RESIDENCE: a home a quest still names says the quest\'s name first at its door and in the info click - a home no quest names, its owner\'s alone (mutants: the quest name unsaid; the door unwired; the click unwired)', () => {
  const home = { owner: 'Aldric', own: false };
  assert.equal(homeDoorTitle(home), "Aldric's home");
  assert.equal(homeDoorTitle(home, 'The Hawkley Residence'), "The Hawkley Residence (Aldric's home)");
  assert.equal(homeDoorTitle({ own: true }, 'The Hawkley Residence'), 'The Hawkley Residence (Your home)');
  assert.equal(homeDoorTitle({ own: true }, null), 'Your home');
  const w = readFileSync(new URL('../../../src/scenes/worldModes.js', import.meta.url), 'utf8');
  const asked = 'homeDoorTitle(home, questSiteHere(bd) && db.isOverrideName ? db.displayName : null)';
  assert.ok(w.includes(`displayName: home ? ${asked} : homeDoorName(`), 'the door\'s plaque');
  assert.ok(w.includes(`townTalk?.say?.(home ? ${asked} : db.displayName);`), 'the info click');
});
