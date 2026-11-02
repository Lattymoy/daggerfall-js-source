// AUDIT DRAGON (2026-10-29, the owner: "Can we audit everything and ensure perfection"; bible/11-Multiplayer/
// Dwarven-Dragon.md section 13): THE CLIENT'S FINDINGS - an Aetherbright's rider in its own colours on every other screen, as
// the boss is: one home for the look's pictures (characters/dwarvenDragonId.js dragonArchiveOf). PIN MOVED (DRAGON7): the
// wash the audit gave both is the Aetherbright's own palette now (archive 1801). tools/mutants/dragonaudit.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dragonArchiveOf, AETHERBRIGHT_ARCHIVE, DWARVEN_DRAGON_ARCHIVE } from '../../../src/characters/dwarvenDragonId.js';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

test('AUDIT DRAGON an Aetherbright rider keeps its colours on every screen: a peer on the wire\'s Dragon ride with `rc` 1 stands in the Aetherbright\'s pictures as the shiny boss does, a brass one never - one look, one home (mutants: the rider\'s look unread)', () => {
  assert.deepEqual([dragonArchiveOf(1), dragonArchiveOf(0)], [AETHERBRIGHT_ARCHIVE, DWARVEN_DRAGON_ARCHIVE]);
  assert.match(src('src/net/remotePlayers.js'), /mobileType === DWARVEN_DRAGON_ID \? dragonArchiveOf\(peer\.shown\.rc\) : null\)/, 'the rider\'s look read off the wire');
  assert.match(src('src/scenes/dragonHost.js'), /const archive = dragonArchiveOf\(look\), T = texture\(archive\)/, 'the boss\'s, from the same home');
});
