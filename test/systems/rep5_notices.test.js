// REP5 (2026-09-29, the reputation overhaul) - THE LAW YOU CAN SEE. The shape Mac signed: "Visible: legal standing per
// region on the Standing page, a notice on every change". DFU moved a legal standing in silence and showed it only as one
// word for the current region in the status box; the enhanced Standing page left it out because "the window does not
// know where you stand".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { legalNoticeLine, installLegalNotices } from '../../src/scenes/standingHost.js';
import { legalStandingWord } from '../../src/systems/legalBands.js';
import { lowerRepForCrime, raiseRepForSentence, changeLegalRep, normalizeReputations, CRIMES } from '../../src/systems/court.js';
import { banish } from '../../src/systems/standing.js';
import { createRegionConditions } from '../../src/systems/region/regionConditions.js';
import { lawRows } from '../../src/ui/enhanced/enhancedMenu.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('REP5: the fourteen bands have one home - the status box\'s %ltn reads it (mutant: a band edge moved)', () => {
  const at = [100, 81, 80, 61, 41, 21, 11, 10, 1, 0, -1, -10, -11, -20, -21, -40, -41, -60, -61, -80, -81];
  assert.deepEqual(at.map(legalStandingWord), ['revered', 'revered', 'esteemed', 'esteemed', 'honored', 'admired', 'respected',
    'dependable', 'dependable', 'a common citizen', 'undependable', 'undependable', 'a scoundrel', 'a scoundrel', 'a criminal',
    'a criminal', 'a villain', 'a villain', 'pond scum', 'pond scum', 'hated']);
  assert.match(src('src/systems/quest/questMacros.js'), /'%ltn': \(mcp, hooks\) => \{\n\s*const rep = hooks\?\.world\?\.legalRepNow\?\.\(\);\n\s*if \(rep == null\) return null;\n\s*return legalStandingWord\(rep\);/);
});

test('REP5: every cause says its own words and the band it leaves the player in', () => {
  const at = (cause, delta, after) => legalNoticeLine({ name: 'Daggerfall', after, delta, cause });
  assert.equal(at({ kind: 'crime', crime: CRIMES.Theft }, -8, -8), 'Theft: the law of Daggerfall thinks less of you (-8). You are undependable.');
  assert.equal(at({ kind: 'sentence' }, 8, 0), 'Your debt to Daggerfall is paid (+8). You are a common citizen.');
  assert.equal(at({ kind: 'acquittal' }, 20, 5), 'The court of Daggerfall clears your name (+20). You are dependable.');
  assert.equal(at({ kind: 'penance' }, 5, -15), 'Your penance is accepted in Daggerfall (+5). You are a scoundrel.');
  assert.equal(at({ kind: 'contract' }, 2, 12), 'Daggerfall thanks you for your work (+2). You are respected.');
  assert.equal(at(null, -10, -30), 'Your standing with the law of Daggerfall falls (-10). You are a criminal.');
});

test('REP5: the host hears the player\'s changes and nobody else\'s; the drift is silent; the uninstall stops it (mutants: every entity said; the drift said)', () => {
  const me = { legalRep: {} }, other = { legalRep: {} };
  const said = [];
  const off = installLegalNotices({ playerEntity: me, say: (l) => said.push(l), regionName: (r) => (r === 3 ? 'Wayrest' : '?') });
  try {
    lowerRepForCrime(me, 3, CRIMES.Assault);
    raiseRepForSentence(me, { crime: CRIMES.Assault, regionIndex: 3 });
    lowerRepForCrime(other, 3, CRIMES.Murder);
    changeLegalRep(me, 3, 0, { kind: 'crime', crime: 1 });   // no change, no line
    normalizeReputations(me, null);
    assert.deepEqual(said, ['Assault: the law of Wayrest thinks less of you (-8). You are undependable.',
      'Your debt to Wayrest is paid (+4). You are undependable.']);
  } finally { off(); }
  lowerRepForCrime(me, 3, CRIMES.Theft);
  assert.equal(said.length, 2, 'uninstalled');
});

test('REP5: the Standing page\'s law - every region with a name, worst first, its word, the watch knowing the face and a stop\'s fine, a banishment\'s days and its pardon\'s price; a common citizen\'s region is not listed (mutants: the zero row drawn; the order)', () => {
  const p = { legalRep: { 1: -30, 2: 0, 3: 15, 4: -5 }, regionConditions: createRegionConditions() };
  banish(p, 5, 0);
  assert.deepEqual(lawRows(p, 1440 * 2), [   // REGION_NAMES (formats/mapsTables.js): 1, 4, 5, 3
    { region: 'Dragontail Mountains', rep: -30, word: 'a criminal', note: 'known to the watch (a stop: 640 gold)' },
    { region: 'Yeorth Burrowland', rep: -5, word: 'undependable', note: '' },
    { region: 'Dwynnen', rep: 0, word: 'a common citizen', note: 'banished, 28 days left (a pardon: 2500 gold)' },
    { region: 'Daggerfall Bluffs', rep: 15, word: 'respected', note: '' },
  ]);
  assert.equal(lawRows({ legalRep: { 2: 0 } }, 0).length, 0);
  const menu = src('src/ui/enhanced/enhancedMenu.js');
  assert.match(menu, /\n {2}statsLaw\(detail, playerEntity\);\n {2}statsGuilds\(detail, playerEntity\);/, 'drawn between the groups and the guilds');
});
