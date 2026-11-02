// PARTY-LOOT's END-TO-END PROBE'S EDITS STAND IN THE TREE (test/tooling/perfon4_probes.test.js's law for the online probe's):
// tools/partyLootProbe.mjs plays the report in two browsers through probe-only seams beside `__takeLoot` - what a body's
// plaque names, the room's base apart from the player's own bonus (`__bodyLoot`), which piece is a player's own
// (`__isPersonal`) and who holds the seat (`__seat`) - and a probe is not in the suite, so a change that moved the needle
// or a door the seams read would be found by the next person to run it, minutes in. The needle is held to
// src/scenes/worldModes.js here, once, the edit read off the source as the probe's own plugin serves it, and each door
// it reads held to the file that owns it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { editsPlugin } from '../../tools/frameProbe.mjs';
import { PARTY_LOOT_PROBE_EDITS } from '../../tools/partyLootProbe.mjs';
import * as RL from '../../src/systems/roomLoot.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('PARTY-LOOT probe: its needle stands once in the file it names, and its plugin serves the seams beside the loot door - the plaque\'s base and bonus, the personal mark asked of roomLoot.js, and the seat', () => {
  assert.deepEqual(PARTY_LOOT_PROBE_EDITS.map((r) => r.file), ['src/scenes/worldModes.js']);
  const code = src('src/scenes/worldModes.js');
  for (const [needle] of PARTY_LOOT_PROBE_EDITS[0].edits) assert.equal(code.split(needle).length - 1, 1, `the needle stands once - ${needle.slice(0, 70)}`);
  const served = editsPlugin('party-loot-probe', PARTY_LOOT_PROBE_EDITS).transform(code, '/repo/src/scenes/worldModes.js?v=1');
  assert.match(served, /window\.__takeLoot = \(k\) => \(dungeonCtx \? dungeonCtx\.takeLoot\(k\) : null\);\n\s*let __personal = \(\) => false; window\.__personalMark = 'none'; import\(\/\* @vite-ignore \*\/ \['\.\.', 'systems', 'roomLoot\.js'\]\.join\('\/'\)\)\.then\(\(m\) => \{ if \(typeof m\.isPersonalLoot === 'function'\) \{ __personal = m\.isPersonalLoot; window\.__personalMark = 'roomLoot\.js'; \} \}\)\.catch\(\(\) => \{\}\);/, 'the personal mark, asked of the module that holds it - by a path the dev server leaves to the browser');
  assert.match(served, /window\.__isPersonal = \(it\) => __personal\(it\);/);
  assert.match(served, /window\.__bodyLoot = \(i\) => \{ const f = dungeonCtx\?\.foes\?\.\[i\]; if \(!\(f\?\.dead && f\.corpse\)\) return null; const l = dungeonCtx\.lootContents\?\.\(`corpse:\$\{i\}`\); if \(!Array\.isArray\(l\)\) return null;/, 'what a body\'s plaque names, read off the dungeon\'s own door');
  assert.match(served, /return JSON\.stringify\(\{ base: l\.filter\(\(it\) => !__personal\(it\)\)\.map\(fp\), mine: l\.filter\(\(it\) => __personal\(it\)\)\.map\(fp\) \}\);/, 'the room\'s base apart from the player\'s own');
  assert.match(served, /window\.__seat = \(\) => \(dungeonCtx \? JSON\.stringify\(\{ authority: !!dungeonCtx\.isAuthority\?\.\(\), location: dungeonCtx\.locationKey\?\.\(\) \?\? null \}\) : null\);/, 'who holds the seat, by the context\'s own word');
});

test('PARTY-LOOT probe: the doors its seams read are where it reads them - the dungeon\'s plaque (an unborn body names nothing), the context\'s seat and room, roomLoot.js\'s personal mark, and the enhanced pack\'s host and rows (a loot-side click takes)', () => {
  const dc = src('src/scenes/dungeonContext.js');
  assert.match(dc, /\n {4}lootContents\(key\) \{\n[^\n]*\n[^\n]*\n {6}if \(\(kind === 'loot' \|\| kind === 'corpse'\) && \(roomUnborn\(key\) \|\| _lootUnreadable\.has\(roomLootKey\(key\)\)\)\) return null;/, 'the plaque the seam reads, and an unborn body names nothing there - nor one whose word this build cannot read (OUTDOOR-LOOT D-2.2: it names itself alone, never Empty; the probe reads that as a body it cannot read, and fails the run)');
  assert.match(dc, /\n {4}isAuthority: \(\) => _authority,\n/, 'the seat\'s word the seam reads is the context\'s own api');
  assert.match(dc, /\n {4}locationKey: \(\) => _locationKey,\n/, 'and the room\'s');
  const it = {};
  assert.equal(RL.isPersonalLoot(it), false);
  RL.markPersonal(it);
  assert.equal(RL.isPersonalLoot(it), true, 'roomLoot.js answers the personal mark by the piece itself');
  assert.match(src('src/ui/inventoryDoor.js'), /\n {2}host\.id = 'enhanced-inventory';\n/, 'the pack the probe waits on and waits away');
  const inv = src('src/ui/enhanced/enhancedInventory.js');
  assert.match(inv, /\n {2}row\._padItem = item; row\._padFrom = from;/, 'the row the probe clicks, by its side and its piece');
  assert.match(inv, /if \(from === 'remote' && remote\.kind !== 'reward'\) \{ take\(item\); return; \}/, 'and a loot row\'s click takes (IG7)');
  const probe = src('tools/partyLootProbe.mjs');
  assert.match(probe, /document\.getElementById\('enhanced-inventory'\)/, 'the probe reads that id');
  assert.match(probe, /e\._padFrom === 'remote' && e\._padItem && !window\.__isPersonal\(e\._padItem\)/, 'and takes a base row, never the player\'s own');
});
