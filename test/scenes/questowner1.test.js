// QUEST-OWNER (2026-10-12, Mac: "quest mobs that get spawned in dungeons to only appear for the questowner or the
// questowners party so he gets credit, same for the main quest", then "Yes quest monsters always owner and its party"):
// everywhere - underground, in a building, in the open air - a quest's foe - a side quest's or the main
// quest's, whose dungeons are fixed and so shared by every player on that step - stands, is struck and hunts for its
// owner's party alone (scenes/quest/questFoeHost.js partyOnlyQuestShare over the world host's seam, the dungeon's ownShare).
// The own-lane harnesses (questparty3c, summonsync, keptkill, pscaleown, audit0928_merge) run through it too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { partyOnlyQuestShare, questPrivateTag } from '../../src/scenes/quest/questFoeHost.js';
import { hostText } from '../hostText.mjs';   // HOST-SPLIT 2 (AUDIT, the second read): its negatives read the host whole

const PARTY = new Set(['amy-0002']);
/** The world host's seam as DESYNC-ZERO left it (world.js questShareSeam): every quest foe for everyone. */
const worldSeam = () => ({
  tagOf: () => ({ q: 'M0B00Y16', s: '_vampire_', pv: 1 }),
  accepts: () => true,
  partyPeer: (id) => PARTY.has(id),
  peerMayHit: (id, f) => f.entity?.team !== 'PlayerAlly',
  adoptsOrphan: () => false,
});

test('QUEST-OWNER a stranger stands none of my quest foes underground, strikes none and is hunted by none; my party does all three (mutants: the stranger accepted; the stranger\'s blow landing; the party refused)', () => {
  const seam = worldSeam(), w = partyOnlyQuestShare(seam);
  const foe = { entity: { team: 'Enemies' } };
  const tag = { q: 'M0B00Y16', s: '_vampire_', pv: 1 };
  assert.equal(seam.accepts('bob-0005', tag), true, 'the open world\'s law: everyone');
  assert.equal(w.accepts('bob-0005', tag), false, 'underground: a stranger stands none');
  assert.equal(w.accepts('amy-0002', tag), true, 'a party member does');
  assert.equal(w.peerMayHit('bob-0005', foe), false, 'a stranger\'s blow lands on none - and my foe hunts no stranger (the candidates ask the same door)');
  assert.equal(w.peerMayHit('amy-0002', foe), true, 'a party member\'s lands');
  assert.equal(w.peerMayHit('amy-0002', { entity: { team: 'PlayerAlly' } }), false, 'a quest\'s own ally still takes no peer\'s blow');
  assert.equal(w.accepts(null, tag), false);
  assert.equal(w.accepts('amy-0002', null), true, 'the seam\'s own answer past the party test');
});

test('QUEST-OWNER the narrowing keeps the rest of the seam, live; the same object for the same seam; no seam, none (mutants: a snapshot of the seam; a new object each frame)', () => {
  const seam = worldSeam(), w = partyOnlyQuestShare(seam);
  assert.equal(partyOnlyQuestShare(seam), w, 'one object a seam');
  assert.equal(w.tagOf({}).q, 'M0B00Y16');
  assert.equal(w.adoptsOrphan(), false);
  seam.adoptsOrphan = () => true;
  assert.equal(w.adoptsOrphan(), true, 'a door the host changes is read as it is now');
  seam.accepts = () => false;
  assert.equal(w.accepts('amy-0002', {}), false, 'and the seam\'s own law still applies inside the party');
  assert.equal(partyOnlyQuestShare(null), null);
  assert.equal(typeof questPrivateTag, 'function', 'a private quest\'s foe is still tagged (its party still sees it)');
});

test('QUEST-OWNER wired: every pool reads the quest law through the narrowing - the open air\'s and the buildings\' as the host hands them, the dungeon\'s again where it reads it (its own lane, the puppets it stands, the blows it takes and the players its foes hunt)', () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /exteriorFoes\.setQuestShare\(partyOnlyQuestShare\(questShareSeam\)\);/, 'the open air');
  assert.match(w, /foesQuestShare: \(\) => partyOnlyQuestShare\(questShareSeam\),/, 'a building and a dungeon');
  assert.doesNotMatch(w, /setQuestShare\(questShareSeam\)|foesQuestShare: \(\) => questShareSeam\b/, 'no pool handed the open seam');
  const d = readFileSync(new URL('../../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
  assert.match(d, /const ownShare = \(\) => partyOnlyQuestShare\(opts\.questShare\?\.\(\) \?\? null\);/);
  assert.equal((d.match(/opts\.questShare\?\.\(\)/g) ?? []).length, 1, 'no door around it');
  assert.match(d, /share\?\.accepts\?\.\(from, qt\)/, 'the puppets: accepts');
  assert.match(d, /ownShare\(\)\?\.peerMayHit\?\.\(c\.id, rec\)/, 'the hunt: peerMayHit');
  assert.match(d, /const ownPeerMayHit = \(id, f\) => \(f\._keptTag \? [^:]+ : !!ownShare\(\)\?\.peerMayHit\?\.\(id, f\)\);/, 'the blows: peerMayHit');
});
