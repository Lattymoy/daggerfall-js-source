// AUDIT DRAGON (2026-10-29, the owner: "Can we audit everything and ensure perfection"; bible/11-Multiplayer/
// Dwarven-Dragon.md section 13): THE CLIENT'S FINDINGS - an Aetherbright's rider washed blue on every other screen, the
// one wash the boss wears too. tools/mutants/dragonaudit.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AETHERBRIGHT_WASH } from '../../../src/characters/dwarvenDragonId.js';
import { AETHER_WASH } from '../../../src/scenes/dragonHost.js';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

test('AUDIT DRAGON an Aetherbright rider keeps its colours on every screen: a peer on the wire\'s Dragon ride with `rc` 1 is washed as the shiny boss is, a brass one never - one wash, one home (mutants: the rider\'s look unread)', () => {
  assert.equal(AETHER_WASH, AETHERBRIGHT_WASH, 'the boss\'s wash is the leaf\'s');
  assert.deepEqual([...AETHERBRIGHT_WASH], [0.62, 0.82, 1.2]);
  assert.match(src('src/net/remotePlayers.js'), /if \(shown\.rd === POSE_RIDE\.Dragon\) entry\.batch\.tint = shown\.rc === 1 \? AETHERBRIGHT_WASH : null;/);
});
