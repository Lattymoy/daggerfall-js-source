// GUILD-PANE slice 3 (2026-10-23, Travis: "plan out steps 1 and 2 for now, and also allowing a guild-entry caravan the
// ability to open the guild vault"; decided, "Guild door only"): A GUILD CARAVAN IS A VAULT PLACE. Inside a Caravan whose
// door is set to the guild, a member of that guild reaches the guild vault as in a town - the pane and the Social page
// both, through the one `pack.reach` the book is handed (bible/11-Multiplayer/Guild-Overhaul.md GUILD-PANE). The law is
// systems/caravanVisit.js caravanVaultHere; the visit carries its door (scenes/caravanRoom.js createCaravanAccess().visit);
// the world host's reach asks both. Run against the real law, the real door, the real helper, the real book's panel -
// the world host's wiring is pinned by its source, as the repo pins a host's line.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as visitLaw from '../../../src/systems/caravanVisit.js';
import { setDrivenCaravanEntry } from '../../../src/systems/caravanVisit.js';
import { newWagonItem } from '../../../src/systems/wagon/wagonKinds.js';
import { createCaravanAccess } from '../../../src/scenes/caravanRoom.js';
import { caravanMayEnter } from '../../../src/systems/caravanVisit.js';
import { hostText } from '../../hostText.mjs';
import { parseStringTableCsv } from '../../../src/systems/textManager.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const REACH_WORDS = 'You can use the vault in any town or a guild caravan. View it here; put items in and take them out in town or in a guild caravan.';

/** The pack a player carries a caravan in, its door set to `entry` (the player's own law: setDrivenCaravanEntry). */
const caravanPack = (entry) => { const items = [{ group: 'Weapons', templateIndex: 1 }, newWagonItem('caravan')]; if (entry) setDrivenCaravanEntry(items, entry); return items; };
const law = (o) => { assert.equal(typeof visitLaw.caravanVaultHere, 'function', 'systems/caravanVisit.js exports caravanVaultHere'); return visitLaw.caravanVaultHere(o); };

test('GUILD-PANE 3 THE LAW: a guild caravan is a vault place for the guild whose door it is - my own by its entry, another\'s by the entry and the tag its visit read; a private, party or public door is none, a guildmate in a party caravan has no vault; no guild, a malformed tag, or no caravan under me is none (mutants: the entry unread; the tag unread; the caravan unread; a party door a place)', () => {
  const visit = (over = {}) => ({ entry: 'guild', guild: 'HND', ...over });
  // my own caravan, by its item's entry
  assert.equal(law({ inCaravan: true, ownEntry: 'guild', myTag: 'HND' }), true, 'my own guild caravan');
  for (const entry of ['private', 'party', 'public', null]) assert.equal(law({ inCaravan: true, ownEntry: entry, myTag: 'HND' }), false, `my own caravan, door ${entry}`);
  // another's, by the entry and tag the visit read
  assert.equal(law({ inCaravan: true, visit: visit(), myTag: 'HND' }), true, 'a visit with the guild door and my tag');
  assert.equal(law({ inCaravan: true, visit: visit({ guild: 'OTH' }), myTag: 'HND' }), false, 'another guild\'s caravan');
  for (const entry of ['private', 'party', 'public']) assert.equal(law({ inCaravan: true, visit: visit({ entry }), myTag: 'HND' }), false, `a visit as ${entry} (Guild door only)`);
  assert.equal(law({ inCaravan: true, visit: visit({ entry: 'party' }), ownEntry: 'guild', myTag: 'HND' }), false, 'a visit never reads my own caravan\'s door');
  assert.equal(law({ inCaravan: true, visit: { entry: 'guild', guild: null }, myTag: 'HND' }), false, 'a visit that carries no tag');
  assert.equal(law({ inCaravan: true, visit: {}, myTag: 'HND' }), false, 'a visit that carries neither');
  // no guild, a bad tag, not in a caravan
  assert.equal(law({ inCaravan: true, ownEntry: 'guild', myTag: null }), false, 'no guild');
  assert.equal(law({ inCaravan: true, visit: visit({ guild: null }), myTag: null }), false, 'no guild either side: null is not a tag');
  assert.equal(law({ inCaravan: true, ownEntry: 'guild', myTag: 'hnd' }), false, 'a malformed tag (lower case)');
  assert.equal(law({ inCaravan: true, visit: visit({ guild: 'toolong' }), myTag: 'toolong' }), false, 'a malformed tag on both sides is still none');
  assert.equal(law({ inCaravan: false, ownEntry: 'guild', myTag: 'HND' }), false, 'not in a caravan');
  assert.equal(law({ inCaravan: false, visit: visit(), myTag: 'HND' }), false, 'a visit that no longer stands');
  assert.equal(law({ myTag: 'HND', ownEntry: 'guild' }), false, 'inCaravan absent');
});

test('GUILD-PANE 3 THE VISIT CARRIES ITS DOOR: createCaravanAccess().visit hands the guild door and tag its target read to the interior host, each checked to the law (the entry to the homes\' doors, the tag to a guild tag); an older pool that answers neither is a private door and no tag - no vault reachable there (mutants: entry dropped; guild dropped; an unknown entry kept; a malformed tag kept)', async () => {
  const calls = [];
  const access = createCaravanAccess({
    available: () => true, mode: () => 'exterior', busy: () => false, say() {}, parked: () => null,
    toNative: (p) => p, fromNative: (p) => p, enterInterior: async (...a) => { calls.push(a); return true; },
  });
  const base = { position: [10, 1, 10], rotation: [0, 0, 0, 1], step: [8, 0, 10], yaw: 0, k: 'a'.repeat(24), owner: 'Ann', look: null, at: [20, 2, 20] };
  const doorOf = async (extra) => { calls.length = 0; assert.equal(await access.visit({ ...base, ...extra }, `caravan:${'a'.repeat(24)}`), true); return calls[0][1]; };
  const guild = await doorOf({ entry: 'guild', guild: 'HND' });
  assert.deepEqual([guild.entry, guild.guild], ['guild', 'HND'], 'a guild door and its tag, handed through');
  assert.equal(guild.cabinOwner, 'Ann', 'the rest of the visit as it was');
  const party = await doorOf({ entry: 'party', guild: null });
  assert.deepEqual([party.entry, party.guild], ['party', null]);
  const older = await doorOf({});
  assert.deepEqual([older.entry, older.guild], ['private', null], 'an older pool answers neither: private, no tag - no vault there');
  const wrong = await doorOf({ entry: 'sesame', guild: 'toolong' });
  assert.deepEqual([wrong.entry, wrong.guild], ['private', null], 'an entry the law does not know is private; a tag it does not take is none');
  const lower = await doorOf({ entry: 'guild', guild: 'hnd' });
  assert.deepEqual([lower.entry, lower.guild], ['guild', null], 'the tag is the law\'s or none');
  // the visit as read feeds the law: what the door handed is what caravanVaultHere reads
  for (const [t, myTag, want] of [[{ entry: 'guild', guild: 'HND' }, 'HND', true], [{ entry: 'guild', guild: 'HND' }, 'OTH', false], [{ entry: 'party', guild: 'HND' }, 'HND', false], [{}, 'HND', false]]) {
    const v = await doorOf(t);
    assert.equal(law({ inCaravan: true, visit: v, myTag }), want, JSON.stringify([t, myTag]));
  }
  // and the door as the owner's word reads for entering is the same word
  assert.equal(caravanMayEnter({ owner: 'Ann', entry: 'guild', guild: 'HND' }, { guild: 'HND' }), true);
});

test('GUILD-PANE 3 THE REACH: the world host\'s reach is the town OR a guild caravan - the helper reads the caravan I stand in (modes.caravanRoom), the visit (modes.caravanVisit), my caravan\'s door (the pack\'s active wagon) and my guild\'s tag; outside a caravan, or in a party or private caravan, none (mutants: the room unread; the visit unread; my own door unread; the tag unread)', () => {
  assert.equal(typeof visitLaw.caravanVaultReached, 'function', 'systems/caravanVisit.js exports caravanVaultReached');
  const reached = (modes, items, tag) => visitLaw.caravanVaultReached(modes, items, tag);
  const room = { kind: 'caravan' };
  const mine = () => ({ v: 1, p: [] });   // worldModes myCaravanDecor: my own caravan's room answers its pieces; any visit answers null
  // my own caravan
  assert.equal(reached({ caravanRoom: room, caravanVisit: null, myCaravanDecor: mine }, caravanPack('guild'), 'HND'), true, 'my own guild caravan');
  for (const entry of ['private', 'party', 'public', null]) assert.equal(reached({ caravanRoom: room, caravanVisit: null, myCaravanDecor: mine }, caravanPack(entry), 'HND'), false, `my own caravan, door ${entry}`);
  assert.equal(reached({ caravanRoom: null, caravanVisit: null }, caravanPack('guild'), 'HND'), false, 'on the street, my caravan\'s door means nothing');
  assert.equal(reached({ caravanRoom: room, caravanVisit: null, myCaravanDecor: mine }, caravanPack('guild'), null), false, 'no guild');
  assert.equal(reached({ caravanRoom: room, caravanVisit: null, myCaravanDecor: mine }, [{ group: 'Weapons', templateIndex: 1 }], 'HND'), false, 'no caravan carried (a cart is not one)');
  assert.equal(reached({ caravanRoom: room, caravanVisit: null, myCaravanDecor: mine }, [newWagonItem('cart')], 'HND'), false, 'a cart');
  // another's: my own caravan's door is not read - the visit's is
  const visit = { privateRoom: 'caravan:x', cabinOwner: 'Ann', entry: 'guild', guild: 'HND' };
  assert.equal(reached({ caravanRoom: room, caravanVisit: visit }, caravanPack('private'), 'HND'), true, 'a guildmate\'s guild caravan, mine private');
  assert.equal(reached({ caravanRoom: room, caravanVisit: { ...visit, entry: 'party' } }, caravanPack('guild'), 'HND'), false, 'a party caravan, though mine is the guild\'s');
  assert.equal(reached({ caravanRoom: room, caravanVisit: { ...visit, guild: 'OTH' } }, caravanPack('guild'), 'HND'), false, 'another guild\'s');
  // a visit whose room no longer matches (modes.caravanVisit reads null though I am a guest): never my own caravan's door
  assert.equal(reached({ caravanRoom: room, caravanVisit: null, myCaravanDecor: () => null }, caravanPack('guild'), 'HND'), false, 'a guest whose visit is not read holds no reach from her own caravan\'s door');
  assert.equal(reached({ caravanRoom: room, caravanVisit: null, myCaravanDecor: mine }, caravanPack('guild'), 'HND'), true, 'and my own room, a guest of no one, still does');
  assert.match(hostText('src/scenes/worldModes.js'), /myCaravanDecor\(\) \{\n\s+if \(mode !== 'interior' \|\| !interiorCtx \|\| !isCaravanRoom\(interiorCabin\) \|\| privateVisitRoom\) return null;/, 'worldModes answers no decor of mine on any visit - the guest test the reach reads');
  assert.equal(reached(null, null, 'HND'), false, 'no modes, no pack');
  assert.equal(reached(undefined, undefined, undefined), false);
});

test('GUILD-PANE 3 THE WIRING (by source): the book\'s pack reach is the town or the caravan helper - one added expression, no added line in the host - and the inTown of the professions\' Stores is unchanged (the vault alone reaches into a caravan)', () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /reach: \(\) => _storesReached\(\) \|\| caravanVaultReached\(modes, playerEntity\.items, guildBook\?\.guild\?\.tag\), refuses: \(it\) => packTradeRefusal\(it, playerEntity\) \}/);
  assert.match(w, /import \{[^}]*\bcaravanVaultReached\b[^}]*\} from '\.\.\/systems\/caravanVisit\.js'/);
  assert.match(w, /inTown: \(\) => _storesReached\(\),/, 'the professions\' Stores stay in town');
  assert.equal((w.match(/caravanVaultReached\(/g) ?? []).length, 1, 'one use');
});

test('GUILD-PANE 3 THE WORDS: the vault\'s reach note names the caravan, routed through t() as social.vault.reach with its English row (mutants: the old words; the key unrouted)', async () => {
  const sp = read('src/ui/socialPanel.js');
  assert.match(sp, /dfsocial-empty', t\('social\.vault\.reach', GUILD_VAULT_REACH_TEXT\)\)/, 'through t()');
  const rows = new Map(parseStringTableCsv(read('locales/en/Port_Strings.csv')));
  assert.equal(rows.get('social.vault.reach'), REACH_WORDS, 'the English row');
  const { GUILD_VAULT_REACH_TEXT } = await import('../../../src/ui/socialPanel.js');
  assert.equal(GUILD_VAULT_REACH_TEXT, REACH_WORDS);
});
