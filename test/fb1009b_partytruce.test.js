// FIELD BUGS 2026-10-09b - PARTY-TRUCE, the Discord's "you can be teleported into a pvp zone and killed": "im just new to
// the game, some guy invited me to his, told me to follow him, killed me in the mountains and i lossed all my staff".
//
// A party mate is never fair in the open PvP zone (scenes/world.js wildFair), and a kick or a leave ends a party in the
// instant: the inviter led the party's walk in (the one door into the zone no journey's gate asks - its question never
// named the zone), dropped the newcomer from the party, and the protection the walk was taken under was gone where it
// mattered. Now a player who leaves my party, or whose party I leave, is no fight for WILD_PARTY_TRUCE_MS, both ways
// (each side reads its own party, and the defender's own client refuses an unfair blow - net/wildFight.js onFrame), and
// a walk that ends in the zone or at its edge says so in its question (test/tv8_party_walk.test.js runs the host's own
// walk). `01-Overview/Field-Bugs-2026-10-09b.md`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as wild from '../src/systems/wildZone.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const MIN = 60_000;

test('PARTY-TRUCE: a mate who leaves the party, or whose party I leave, is under truce for ten minutes and a stranger after; a mate again is the party\'s own; the truce answers who just left (mutants: the leaver never held; the truce never ends; a rejoin keeps the old clock)', () => {
  assert.equal(wild.WILD_PARTY_TRUCE_MS, 10 * MIN);
  const t = wild.createPartyTruce();
  assert.deepEqual(t.frame(new Set(['lead', 'other']), 0), [], 'the party as it first stands: nobody left');
  assert.equal(t.holds('lead', 0), false, 'a mate is the party\'s own protection, not the truce\'s');
  // the leader kicks me: my party is gone, every mate of it under truce
  assert.deepEqual(t.frame(new Set(), 1000), ['lead', 'other']);
  assert.equal(t.holds('lead', 1000), true);
  assert.equal(t.holds('lead', 1000 + 10 * MIN - 1), true, 'a walk out of the zone');
  assert.equal(t.holds('lead', 1000 + 10 * MIN), false, 'then a stranger like any other');
  assert.equal(t.holds('stranger', 1000), false, 'one who was never of my party is no truce');
  // a later frame forgets an ended truce, and says nobody left
  assert.deepEqual(t.frame(new Set(), 1000 + 10 * MIN), []);
  // back in a party: its own protection, and leaving it again starts a fresh clock
  const u = wild.createPartyTruce();
  u.frame(new Set(['a']), 0);
  u.frame(new Set(), 0);
  u.frame(new Set(['a']), 5 * MIN);
  assert.equal(u.holds('a', 5 * MIN), false, 'a mate again');
  assert.deepEqual(u.frame(new Set(), 9 * MIN), ['a']);
  assert.equal(u.holds('a', 18 * MIN), true, 'ten minutes from the second leave');
  assert.match(wild.WILD_TEXT.truce, /cannot fight for ten minutes/);
});

test('PARTY-TRUCE: the host holds a party left out of the fight - wildFair asks the truce beside the party, and the zone frame reads the party each frame and says the truce in the zone (mutants: wildFair unasked; the frame never read)', () => {
  const w = src('src/scenes/world.js');
  const fair = w.slice(w.indexOf('  const wildFair = (peerId) => {'), w.indexOf('  /** PARTY-TRUCE: the row a party\'s walk asks with'));
  assert.match(fair, /if \(social\?\.isPartyPeer\(peerId\)\) return false;\n {4}if \(_wildTruce\.holds\(peerId, Date\.now\(\)\)\) return false;/);
  const frame = w.slice(w.indexOf('  const wildFrame = () => {'), w.indexOf('    if (playerEntity.health > 0 && !modes?.deathUp?.()) {', w.indexOf('  const wildFrame = () => {')));
  assert.match(frame, /if \(_wildTruce\.frame\(social\?\.partyPeers\?\.\(\) \?\? new Set\(\), Date\.now\(\)\)\.length && here\) townTalk\.say\(WILD_TEXT\.truce\);/);
  assert.match(w, /\n {2}const _wildTruce = createPartyTruce\(\);/);
  // the defender's own client asks the same fairness of every blow it takes (the attacker's word is never enough)
  assert.match(src('src/net/wildFight.js'), /if \(!can\(\) \|\| !fair\(peer\)\) return;/);
  assert.match(w, /\n {4}fair: wildFair,/);
});
