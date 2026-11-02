// PORTAL-GIFT (2026-10-04, the owner: "every current player should recieve x10 of these. They should stack";
// bible/06-Systems/Portal-Stone.md "The gift"): EVERY CHARACTER THAT ALREADY EXISTS IS GIVEN TEN PORTAL STONES, ONCE.
// The law (systems/gate/gateSpoils.js givePortalGift, PORTAL_GIFT, PORTAL_GIFT_STONES, takePortalGiftNotice), the mark the
// save carries (systems/save/save.js), and the host's word once the world stands (scenes/world.js) - LOAN-AMNESTY's shape.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { givePortalGift, takePortalGiftNotice, PORTAL_GIFT, PORTAL_GIFT_STONES, portalStones, isPortalStone } from '../../src/systems/gate/gateSpoils.js';
import { PORTAL_TEXT } from '../../src/systems/portalStone.js';
import { snapshotPlayer, restorePlayer } from '../../src/systems/save/save.js';
import { createBankAccounts, createHouses, SHIP_TYPES } from '../../src/systems/banking.js';
import { setLocked, isLocked } from '../../src/systems/item/itemLock.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const stones = (items) => items.filter(isPortalStone).map((it) => [it.stackCount ?? 1, isLocked(it)]);

test('PORTAL-GIFT the law: a character from before the gift is given ten stones once, onto its own unlocked stack (they stack) - never into a locked one - and marked; one marked is given none; the notice is taken once', () => {
  assert.deepEqual([PORTAL_GIFT, PORTAL_GIFT_STONES], [1, 10]);
  takePortalGiftNotice();
  const fresh = { items: [] };
  assert.equal(givePortalGift(fresh), 10);
  assert.deepEqual(stones(fresh.items), [[10, false]]);
  assert.equal(fresh.portalGift, PORTAL_GIFT, 'marked');
  assert.equal(givePortalGift(fresh), 0, 'once');
  assert.deepEqual(stones(fresh.items), [[10, false]]);
  // onto the stack the player already holds
  const holder = { items: [portalStones(3)] };
  givePortalGift(holder);
  assert.deepEqual(stones(holder.items), [[13, false]], 'they stack');
  // a locked stack is the player's word: the gift is its own stack beside it
  const locked = { items: [portalStones(2)] };
  setLocked(locked.items[0], true);
  givePortalGift(locked);
  assert.deepEqual(stones(locked.items), [[2, true], [10, false]]);
  assert.equal(takePortalGiftNotice(), 30, 'every gift since the last ask');
  assert.equal(takePortalGiftNotice(), 0, 'said once');
  // a character made after it, and a torn entity
  assert.equal(givePortalGift({ items: [], portalGift: PORTAL_GIFT }), 0);
  const bare = {};
  assert.equal(givePortalGift(bare), 10); assert.deepEqual(stones(bare.items), [[10, false]], 'a pack minted for it');
  for (const torn of [null, 7, 'x']) assert.equal(givePortalGift(torn), 0);
  takePortalGiftNotice();
  assert.equal(PORTAL_TEXT.gift(10), 'You have been given 10 Portal Stones. Use one to open a portal to anywhere on the map.');
});

test('PORTAL-GIFT the mark rides the save: a new character is born past it, a save from before it is given its stones as it is restored and saved marked, and restoring that save again gives nothing', () => {
  takePortalGiftNotice();
  const character = { name: 'Gary', gender: 'male', careerIndex: 4, level: 3, reflexes: 2, health: 22, maxHealth: 40, magicka: 15, maxMagicka: 30,
    startingLevelUpSkillSum: 90, currentLevelUpSkillSum: 120, readyToLevelUp: false, pendingLevel: null, chargenDone: true,
    stats: { strength: 55, luck: 60 }, skills: [30, 28], skillUses: [100, 0], career: { name: 'Healer', hitPointsPerLevel: 8 },
    items: [], spells: [], activeEffects: [], bankAccounts: createBankAccounts(), houses: createHouses(62), ownedShip: SHIP_TYPES.None };
  const save = (e) => JSON.parse(JSON.stringify(snapshotPlayer(e, { position: [0, 0, 0], classicMinutes: 0, locationKey: 'world' })));
  const born = save(character);
  assert.equal(born.portalGift, PORTAL_GIFT, 'a new character is born past it');
  const bornAgain = { ...character, items: [] };
  restorePlayer(bornAgain, born, new Map());
  assert.deepEqual(stones(bornAgain.items), [], 'and is given nothing');
  assert.equal(takePortalGiftNotice(), 0);
  // a save written before the gift
  const old = save(character);
  delete old.portalGift;
  const loaded = { ...character, items: [] };
  restorePlayer(loaded, old, new Map());
  assert.deepEqual(stones(loaded.items), [[10, false]], 'given its ten');
  assert.equal(loaded.portalGift, PORTAL_GIFT);
  assert.equal(takePortalGiftNotice(), 10, 'and told');
  const after = save(loaded);
  assert.equal(after.portalGift, PORTAL_GIFT, 'saved marked');
  const again = { ...character, items: [] };
  restorePlayer(again, after, new Map());
  assert.deepEqual(stones(again.items), [[10, false]], 'the save\'s ten, and no more');
  assert.equal(takePortalGiftNotice(), 0, 'nothing said again');
});

test('PORTAL-GIFT the hosts: every load restores through the one door, which gives it below the relinks and the fold; the world says it once it stands, in every mode', () => {
  const save = src('src/systems/save/save.js');
  assert.match(save, /snap\.portalGift = Number\.isSafeInteger\(entity\.portalGift\) \? entity\.portalGift : PORTAL_GIFT;/);
  assert.match(save, /entity\.portalGift = Number\.isSafeInteger\(snap\.portalGift\) \? snap\.portalGift : 0;/);
  assert.match(save, /const n = restackStones\(list\);[^\n]*\n[^\n]*\n\s+\}\n\s+givePortalGift\(entity\);/, 'after the fold - an index-keyed relink never slides');
  const w = src('src/scenes/world.js');
  assert.match(w, /if \(_bootLoaded\) \{ const gift = takePortalGiftNotice\(\); if \(gift\) townTalk\.say\(PORTAL_TEXT\.gift\(gift\)\); \}[^\n]*\n\s+if \(_mode\(\) !== _torchesMode\)/, 'said once the world stands, before the frame turns to a building or a dungeon');
});
