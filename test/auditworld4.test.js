// AUDIT WORLD4 (Mac, 2026-09-13: "Lets do an audit on thid") - four opus
// lenses over WORLD4 (the wire and the budgets; the projection and its
// readers; the dungeon host's claim, land and settle; the memory and the
// record), each finding refuted by its own finder and then by adversaries,
// fifteen surviving. THE FIXES EXECUTE: the wire (A1 - whether an act frame
// FITS is now a law with ONE HOME, so a host can tell a refusal the next
// token heals from one that can never be healed); the projection (B1 - an
// `enchantments` STRING survived the clamp and threw out of the frame body
// through three readers, freezing the tab); the mint (A2/B2/D1 - the list
// cap was a law the READER alone obeyed, so an oversized container was sent,
// dropped in silence by everyone, and then wiped by the next reader's
// claim); the host (C1 the open window is the opener's, C2/D5 a claim never
// overwrites the room's newer word and makes the memory due, C3/D2 the
// settle's missing re-mint arm, C4 the canonical key, C6 the claim after the
// mount); and the memory (D3 what we will not say we will not hear, D4/B3
// the foes' item lists, which are the same container vocabulary, out of the
// envelope and projected if one ever lands).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { actFrameFits, MAX_FRAME_BYTES } from '../src/net/wire.js';
import { validLootItem, validLootList, LOOT_LIST_MAX, LOOT_ARRAY_FIELDS } from '../src/systems/loot.js';
import { itemEnchantments } from '../src/systems/enchantments.js';
import { hasArtifactSubtype, hasArtifactEffect } from '../src/systems/artifactEffects.js';
import { fakeSocketClass } from './fakeSocket.mjs';
import { OnlineSession } from '../src/net/online.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const ITEM = { group: 'Weapons', templateIndex: 131, name: 'Arrow', material: 0, stackCount: 3, value: 1 };
const bigList = (n) => Array.from({ length: n }, (_, i) => ({ ...ITEM, name: `Arrow ${i}` }));

test('AUDIT WORLD4 A1: whether an act frame FITS is ONE HOME the sender reads before the socket does - the size refusal and the RATE refusal are different animals, and only the rate one heals; the session refuses exactly what the law refuses', () => {
  assert.equal(actFrameFits({ k: 'dungeon:1', l: [{ k: 'loot:3', r: [ITEM] }] }), true);
  assert.equal(actFrameFits({ k: 'dungeon:1', l: [{ k: 'loot:3', r: [{ ...ITEM, pad: 'x'.repeat(MAX_FRAME_BYTES) }] }] }), false);
  // the boundary is the FRAME's, not the payload's - the envelope counts
  const pad = (n) => ({ p: 'x'.repeat(n) });
  const room = JSON.stringify({ t: 'act', data: pad(0) }).length;   // the envelope around an empty string, quotes and all
  assert.equal(actFrameFits(pad(MAX_FRAME_BYTES - room)), true, 'exactly full is sayable');
  assert.equal(actFrameFits(pad(MAX_FRAME_BYTES - room + 1)), false, 'one byte past is not');
  // and the session refuses on the same law it publishes - no second opinion, no drift
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => now });
  s.join('dungeon:m187', { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 });
  const ws = sockets[0]; ws.open();
  ws.receive({ t: 'welcome', id: 'mac-0001', peers: [], host: 'bob-0002', world: null });
  assert.equal(s.sendAct(pad(MAX_FRAME_BYTES - room)), true);
  now += 10000;
  assert.equal(s.sendAct(pad(MAX_FRAME_BYTES - room + 1)), false, 'refused for its SIZE with the rate token in hand');
  assert.equal(ws.sent.length, 2, 'and nothing went out - one hello, one act');
  // the host's arms: the union is shed before the act is dropped, and neither is ever re-pended
  const w = rd('src/scenes/world.js');
  assert.match(w, /import \{ POSE_STRIKES, isWorldRoom, isCellRoom, cellHaloFor, actFrameFits, sharedClassicMinutes, wallMsForClassicMinutes \} from '\.\.\/net\/wire\.js';/, 'the host reads the same home (WORLD6b: and the cell\'s law)');
  assert.match(w, /if \(out !== data && !actFrameFits\(out\)\) out = data;[^\n]*\n\s*if \(!actFrameFits\(out\)\) \{ actTooBig\(keys\); return false; \}\s*if \(!online\.sendAct\(out\)\) \{ for \(const k of keys\) _actPend\.add\(k\); return false; \}/,
    'shed the union, then drop the act itself - a size refusal never enters the pending set, which would re-read and re-refuse it every frame for ever');
  assert.match(w, /if \(!actFrameFits\(data\)\) \{ actTooBig\(\[\.\.\._actPend\]\); _actPend\.clear\(\); return false; \}/, 'and the flush cannot wedge either');
  assert.match(w, /const actTooBig = \(keys\) => \{ for \(const k of keys\) if \(!_actTooBig\.has\(k\)\) \{ _actTooBig\.add\(k\); console\.warn\(/, 'said once per key, out loud');
});

test('AUDIT WORLD4 B1: an item field the readers walk as an ARRAY must BE an array - a string `enchantments` survived the clamp entire (it is a bounded string, which is a legal value) and then threw out of three readers, one of them the enchantment round inside the frame body itself, freezing the tab for good', () => {
  assert.deepEqual([...LOOT_ARRAY_FIELDS], ['enchantments', 'customEnchantments', 'affixes'], 'the fields the readers walk (LR1: the rarity affix list too)');
  for (const f of LOOT_ARRAY_FIELDS) {
    assert.equal(validLootItem({ templateIndex: 133, [f]: 'abc' }), null, `${f} as a string is not an item`);
    assert.equal(validLootItem({ templateIndex: 133, [f]: 7 }), null, `${f} as a number is not an item`);
    assert.equal(validLootItem({ templateIndex: 133, [f]: { 0: { type: 1 } } }), null, `${f} as an object is not an item`);
    const sample = f === 'affixes' ? [{ id: 'damage', value: 5 }] : [{ type: 1, param: 2 }];   // LR4: an affix list is CHECKED, not only typed - a sound record
    assert.deepEqual(validLootItem({ templateIndex: 133, [f]: sample })[f], sample, `${f} as an array is kept whole`);
    assert.deepEqual(validLootItem({ templateIndex: 133, [f]: [] })[f], [], 'an empty one too');
    assert.equal(validLootList([{ templateIndex: 133, [f]: 'abc' }]), null, 'and one such entry refuses the whole list');
  }
  assert.equal(validLootItem({ templateIndex: 133 }).enchantments, undefined, 'absent stays absent');
  // the three readers, which the projection must never hand a string - and which no longer care if something else does
  const bad = { templateIndex: 133, enchantments: 'abc' };
  assert.equal(itemEnchantments(bad), null, 'the enchantment round survives it');
  assert.equal(hasArtifactSubtype(bad, 1), false);
  assert.equal(hasArtifactEffect(bad), false);
  assert.equal(itemEnchantments({ templateIndex: 133, enchantments: [{ type: 1, param: 2 }] }).length, 1, 'and an honest list still reads');
});

test('AUDIT WORLD4 A2/B2/D1 + C4: the mint is the ONE HOME of what may be said - a container over the list cap is skipped THERE, said once, and stays its owner\'s own (it used to be sent, dropped in silence by every receiver, and then wiped on the depositor by the next reader\'s claim); and a key is re-spelt canonically, so no peer can mint an unbounded family of aliases for one container', () => {
  // the far end of the same law, executed: what the mint refuses to send is exactly what every reader refuses to take
  assert.equal(validLootList(bigList(LOOT_LIST_MAX)).length, LOOT_LIST_MAX);
  assert.equal(validLootList(bigList(LOOT_LIST_MAX + 1)), null, 'one past the cap and the whole list is dropped - in SILENCE, at the far end');
  const d = rd('src/scenes/dungeonContext.js');
  assert.match(d, /if \(held\.length > LOOT_LIST_MAX\) \{\s*if \(!_lootTooBig\.has\(canon\)\) \{\s*_lootTooBig\.add\(canon\);\s*console\.warn\(/, 'so the SENDER obeys it too, at the mint, once');
  assert.match(d, /it stays yours alone`\);\s*\}\s*continue;\s*\}\s*_lootTooBig\.delete\(canon\);/, 'and the container stays this player\'s own until it fits again');
  assert.match(d, /validLootList, LOOT_LIST_MAX,/, 'the cap read from its one home, not restated');
  // C3/D2's other half: THREE callers, one settle - the window's close, the room's word, the save's restore
  assert.match(d, /onEmptied = \(\) => settleLootFlat\(i\);/, 'the window\'s close');
  assert.match(d, /if \(canon\.startsWith\('loot:'\)\) settleLootFlat\(Number\(canon\.slice\(5\)\)\);/, 'the room\'s word');
  assert.match(d, /settleLootFlat\(i\);   \/\/ AUDIT WORLD4 C3\/D2/, 'the save\'s restore');
  assert.equal((d.match(/const bi = billboardBatches\.indexOf\(p\.batch\);/g) ?? []).length, 1, 'and ONE HOME frees a layout pile\'s flat - the other destroy in the file is droppedLoot\'s teardown, a different owner');
  assert.match(d, /const LOOT_KEY_RE = \/\^\(loot\|corpse\):\(0\|\[1-9\]\[0-9\]\{0,4\}\)\$\/;/, 'C4: one spelling, five digits at most');
  assert.match(d, /function lootKeyOf\(key\) \{\s*if \(typeof key !== 'string'\) return null;\s*const m = LOOT_KEY_RE\.exec\(key\);\s*return m \? `\$\{m\[1\]\}:\$\{Number\(m\[2\]\)\}` : null;\s*\}/, 'and the canon is what lands in _lootSeen and rides the wire');
  // C4 executed on the shape of the law: the spellings the old `key.split(':')` read as one container
  const RE = /^(loot|corpse):(0|[1-9][0-9]{0,4})$/;
  for (const alias of ['loot:0x0a', 'loot:1e1', 'loot: 10 ', 'loot:0000000010', 'loot:10.0', 'loot:+10', 'loot:-1', 'loot:999999', 'chest:1', 'loot:'])
    assert.equal(RE.test(alias), false, `${alias} is not a container key`);
  for (const ok of ['loot:0', 'loot:10', 'corpse:99999']) assert.match(ok, RE);
});

test('AUDIT WORLD4 C1/C2/C6 + D5: a container YOU have open is yours until you close it (the pack binds each loot row to the item OBJECT and never repaints, so landing the room\'s word under an open window orphaned every row and the next click took the item AND left it in the chest); a CLAIM speaks only where the room has not spoken; the claim follows the MOUNT; and the room\'s memory falls due the moment one lands', () => {
  const d = rd('src/scenes/dungeonContext.js');
  assert.match(d, /let _lootOpenKey = null;/, 'the container this player has open');
  assert.match(d, /const _k = lootHolder\(key\) \? lootKeyOf\(key\) : null;\s*activeOverlay = openInventory\(source, onEmptied, \{ lootHooks, lootKey: _k \}\);\s*if \(activeOverlay && _k\) \{ _lootOpenKey = _k; publishLoot\(_k, \{ claim: true \}\); \}/,
    'C6: openInventory REFUSES a transformed lycanthrope and returns null - no window, no claim');
  assert.match(d, /onClose: \(\) => \{ onEmptied\?\.\(\); if \(lootKey\) \{ _lootOpenKey = null; publishLoot\(lootKey\); \}/, 'and the window is closed before its last word goes, so the room\'s next word may land');
  assert.match(d, /if \(claim && _lootSeen\.has\(canon\)\) return false;/, 'C2: a claim never overwrites the room\'s newer word - a joiner inside the memory\'s window used to un-empty a chest for everyone');
  assert.match(d, /const first = !_lootSeen\.has\(canon\);\s*_lootSeen\.add\(canon\);\s*(?:const _t = _wallNow\(\); if \(_t != null\) _lootAt\.set\(canon, _t\);[^\n]*\n\s*)?if \(first\) opts\.onLootClaimed\?\.\(\);/, 'D5: and the first word about a container makes the memory due');
  assert.match(d, /if \(canon === _lootOpenKey\) \{ n\+\+; continue; \}/, 'C1: the room\'s word waits at an open window');
  // D5's chain, end to end: the host's bag, the mode's forward, the clock it resets
  assert.match(rd('src/scenes/worldModes.js'), /onLootClaimed: \(\) => host\.onLootClaimed\?\.\(\),/, 'forwarded');
  assert.match(rd('src/scenes/world.js'), /onLootClaimed: \(\) => \{ _worldPublishedAt = -Infinity; \},/, 'and the memory\'s clock is reset, so this frame\'s own publish carries the claim');
});

test('AUDIT WORLD4 D3/D4/B3: the memory says what it means and takes only what it says - no pile\'s blanket list and no FOE\'s item list (`corpse:<i>` reads exactly that array, so it was the same container vocabulary carried twice and the law was false for half of it); a `piles` field is no longer APPLIED either; and an item list off the wire is projected wherever it lands', () => {
  const d = rd('src/scenes/dungeonContext.js');
  assert.match(d, /delete w\.piles;\s*for \(const f of w\.foes\) delete f\.items;\s*w\.loot = lootRecords\(\[\.\.\._lootSeen\]\);/, 'D4: neither half of the envelope carries a container nobody has opened');
  assert.match(d, /applyWorld\(\{ \.\.\.shared\.world, piles: undefined, actions: acts, foes: Array\.isArray\(shared\.world\.foes\) \? shared\.world\.foes\.slice\(0, _layoutFoes\) : \[\] \}, \{ truncate: false, wire: true \}\);/,
    'D3: what this client will not say, it will not hear - an old snapshot inside WORLD_TTL_MS used to blanket-replace a joiner\'s own rolls');
  assert.match(d, /function applyWorld\(w, \{ truncate = true, wire = false \} = \{\}\) \{/, 'and the wire is told from a save off disk');
  assert.match(d, /function patchFoe\(f, sf, wire = false\) \{\s*f\.entity\.health = sf\.health;/, 'B3: the per-foe body knows which it is');
  assert.match(d, /if \(!wire\) f\.entity\.items = sf\.items\.map\(\(it\) => \(\{ \.\.\.it \}\)\);\s*else if \(sf\.items != null\) \{ const li = validLootList\(sf\.items\); if \(li\) f\.entity\.items = li; \}/,
    'a list off the wire goes through the projection or nowhere; a record without one leaves this client\'s own roll alone');
  assert.match(d, /patchFoe\(f, sf, wire\);/, 'threaded');
  assert.match(d, /if \(ok && foes\[i\]\) patchFoe\(foes\[i\], sf, wire\);/, 'on the rebuild too');
});

test('AUDIT WORLD4: the record - the arc carries the audit, the sentences it falsified are STRUCK where they were written, and the cost it chose not to pay is written down', () => {
  const arc = rd('bible/06-Systems/Online-Arc.md');
  assert.match(arc, /## AUDIT WORLD4 \(2026-09-13\)/, 'the record');
  assert.match(arc, /~~so a window already open on that container updates under the\s+reader's hands~~/, 'C1: WORLD4\'s own headline was false and is STRUCK where it was written, not left standing');
  assert.match(arc, /\*\*A container you have open is yours until you\s+close it\*\*/, 'and the law that replaced it stands in its place');
  assert.doesNotMatch(rd('test/world4.test.js'), /already open updates under the reader's hands\. It rides/, 'and the slice\'s own pin file says the amended law');
  assert.match(arc, /C5/, 'the recovered arrows, a cost this audit chose to record rather than pay');
});
