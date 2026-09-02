// G6: KnightlyOrder.ReceiveArmor's ladder, the Spymaster's greeting,
// and the inventory's CHOOSE-ONE mode that claims the gift.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOUSE_FLAG_MASK, ARMOR_FLAG_START, armorMaskForRank, hasClaimedArmor,
  giftArmorMaterial, GIFT_ARMOR_PIECES, receiveArmorDecision, claimArmor,
  ARMOR_TEXT_ID, NO_ARMOR_TEXT_ID, NO_HOUSE_TEXT_ID, HOUSE_TEXT_ID, SPYMASTER_GREETING_TEXT_ID,
  restoreKnightlyOrderFlags, ARMOR_FLAG_ANY_MASK, LEGACY_ARMOR_FLAG_MASK,
} from '../src/systems/knightlyGifts.js';
import { GUILD_GROUPS } from '../src/formats/factionFile.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { ARMOR_ENUM } from '../src/combat/enemyEquipment.js';
import { serviceDestination } from '../src/systems/guildServiceFlow.js';
import { readFileSync } from 'node:fs';
import { NativeInventoryWindow } from '../src/ui/nativeInventory.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';

/** A stream that walks a fixed list, so a draw order can be chosen. */
const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };

test('G6: the armour is ONCE PER RANK, and the bookkeeping is a bitfield', () => {
  // ArmorFlagStart 4, HouseFlagMask 2 (:42-43) - the house owns bit
  // 1 and the ten ranks own bits 2..11, which is why a counter would
  // not do: a promotion re-opens a gift the previous rank closed.
  assert.equal(HOUSE_FLAG_MASK, 2);
  assert.equal(ARMOR_FLAG_START, 4);
  assert.equal(armorMaskForRank(0), 4);
  assert.equal(armorMaskForRank(9), 4 << 9);
  assert.equal(armorMaskForRank(9), 2048);
  // no rank's bit is the house's, and no two ranks share one
  const masks = Array.from({ length: 10 }, (_, r) => armorMaskForRank(r));
  assert.equal(new Set(masks).size, 10);
  for (const m of masks) assert.equal(m & HOUSE_FLAG_MASK, 0);

  const mem = { rank: 3, flags: 0 };
  assert.equal(hasClaimedArmor(mem), false);
  const offer = receiveArmorDecision(mem, { rolls: () => 0.5 });
  assert.equal(offer.kind, 'offer');
  assert.equal(offer.textId, ARMOR_TEXT_ID);
  assert.equal(offer.mask, armorMaskForRank(3));

  claimArmor(mem, offer.mask);
  assert.equal(mem.flags, 32, '4 << 3');
  assert.equal(hasClaimedArmor(mem), true);
  assert.equal(receiveArmorDecision(mem).kind, 'refuse');
  assert.equal(receiveArmorDecision(mem).textId, NO_ARMOR_TEXT_ID);

  // A PROMOTION RE-OPENS IT - the whole reason for a mask
  mem.rank = 4;
  assert.equal(hasClaimedArmor(mem), false);
  assert.equal(receiveArmorDecision(mem, { rolls: () => 0 }).kind, 'offer');
  // ...and claiming the new rank leaves the old rank's bit standing
  claimArmor(mem, armorMaskForRank(4));
  assert.equal(mem.flags, 32 | 64);
  mem.rank = 3;
  assert.equal(hasClaimedArmor(mem), true, 'the old claim is still recorded');

  // the house bit does not answer for armour, or the other way round
  const houseOnly = { rank: 0, flags: HOUSE_FLAG_MASK };
  assert.equal(hasClaimedArmor(houseOnly), false);
  assert.equal(receiveArmorDecision(houseOnly, { rolls: () => 0 }).kind, 'offer');
  // a membership with no flags field at all reads as unclaimed
  assert.equal(hasClaimedArmor({ rank: 0 }), false);
  assert.equal(hasClaimedArmor(null), false);
});

test('G6: the MATERIAL is the rank, through integer arithmetic on the enum', () => {
  // `ArmorMaterialTypes.Iron + rank` (:205) - Iron is 0x0200 and the
  // nine metals above it fill 0x0201..0x0209, so ten ranks map onto
  // ten metals exactly.
  assert.equal(ARMOR_MATERIAL.Iron, 0x0200);
  const walk = Array.from({ length: 10 }, (_, r) => giftArmorMaterial(r));
  assert.deepEqual(walk, [
    ARMOR_MATERIAL.Iron, ARMOR_MATERIAL.Steel, ARMOR_MATERIAL.Silver, ARMOR_MATERIAL.Elven,
    ARMOR_MATERIAL.Dwarven, ARMOR_MATERIAL.Mithril, ARMOR_MATERIAL.Adamantium,
    ARMOR_MATERIAL.Ebony, ARMOR_MATERIAL.Orcish, ARMOR_MATERIAL.Daedric,
  ]);
  assert.equal(new Set(walk).size, 10);
  // LEATHER AND CHAIN ARE UNREACHABLE: they sit BELOW Iron, so the
  // gift never starts poorer than iron however low the rank.
  for (const cheap of [ARMOR_MATERIAL.Leather, ARMOR_MATERIAL.Chain, ARMOR_MATERIAL.Chain2]) {
    assert.ok(cheap < ARMOR_MATERIAL.Iron);
    assert.equal(walk.includes(cheap), false);
  }
  // the rank clamps where DFU's ten stop it rather than walking off
  assert.equal(giftArmorMaterial(99), ARMOR_MATERIAL.Daedric);
  assert.equal(giftArmorMaterial(-5), ARMOR_MATERIAL.Iron);

  // and the offer really carries it
  const offer = receiveArmorDecision({ rank: 7, flags: 0 }, { rolls: () => 0 });
  assert.ok(offer.pieces.every((p) => p.material === ARMOR_MATERIAL.Ebony));
});

test('G6: FOUR to SEVEN pieces - never three - and only the seven body slots', () => {
  // `for (int i = Random.Range(3, 7); i >= 0; i--)` draws 3..6 and
  // runs i + 1 times. The bound that matters is the LOW one: a
  // straight port of "Range(3,7) pieces" would offer three.
  const at = (u) => receiveArmorDecision({ rank: 0, flags: 0 }, { rolls: seq(u, 0) }).pieces.length;
  assert.equal(at(0), 4, 'the lowest draw is 3, so FOUR pieces');
  assert.equal(at(0.999), 7, 'and the highest is 6, so SEVEN');
  for (const u of [0, 0.25, 0.5, 0.75, 0.999]) {
    const n = at(u);
    assert.ok(n >= 4 && n <= 7, `${u} -> ${n}`);
  }
  assert.notEqual(at(0), 3, 'three is the draw, not the count');

  // Range(102, 108 + 1) is Cuirass..Boots INCLUSIVE - seven body
  // pieces and no shield, whose enum values sit just above them
  assert.deepEqual([...GIFT_ARMOR_PIECES], [102, 103, 104, 105, 106, 107, 108]);
  assert.equal(GIFT_ARMOR_PIECES.length, 7);
  assert.equal(GIFT_ARMOR_PIECES[0], ARMOR_ENUM.Cuirass);
  assert.equal(GIFT_ARMOR_PIECES.at(-1), ARMOR_ENUM.Boots);
  for (const shield of [ARMOR_ENUM.Buckler, ARMOR_ENUM.Round_Shield,
    ARMOR_ENUM.Kite_Shield, ARMOR_ENUM.Tower_Shield]) {
    assert.equal(GIFT_ARMOR_PIECES.includes(shield), false, 'no shields in the gift');
  }
  // every drawn piece is one of the seven, and the last index is
  // reachable (a `< length` that should be `<=` would hide Boots)
  const many = receiveArmorDecision({ rank: 0, flags: 0 }, { rolls: seq(0.999, 0.999) });
  assert.ok(many.pieces.every((p) => GIFT_ARMOR_PIECES.includes(p.templateIndex)));
  assert.equal(many.pieces[0].templateIndex, ARMOR_ENUM.Boots);

  // the host's minter is used when one is supplied, so this module
  // never has to know what an item record looks like
  const custom = receiveArmorDecision({ rank: 0, flags: 0 },
    { rolls: () => 0, makeArmor: (piece, material) => ({ mine: true, piece, material }) });
  assert.ok(custom.pieces.every((p) => p.mine === true));
});

test('G6: the gift is claimed by TAKING - the inventory\'s choose-one mode', () => {
  const mem = { rank: 2, flags: 0 };
  const offer = receiveArmorDecision(mem, { rolls: () => 0.5 });
  const bag = [];
  let chosen = null;
  const win = new NativeInventoryWindow({
    items: () => bag,
    chooseOne: {
      items: offer.pieces,
      onChoose: (item) => { chosen = item; claimArmor(mem, offer.mask); },
    },
  });
  // SetChooseOne puts the reward list on the REMOTE side and the
  // window opens in Remove mode (:259-264, :594-599)
  assert.equal(win.mode, 'remove');
  assert.deepEqual(win._remote(), offer.pieces);
  const before = offer.pieces.length;

  // NOTHING GOES IN (:1994): the player's own gear cannot be dumped
  // into a pile they are only choosing from
  bag.push({ group: 'Weapons', templateIndex: 121, name: 'Dagger', stackCount: 1 });
  win._pick(0);
  assert.equal(bag.length, 1, 'the dagger stayed in the pack');
  assert.equal(win._remote().length, before, 'and never reached the pile');

  // ONE is the whole gift (:1585-1591): the take closes the window
  // and the callback - which is the claim - runs
  win._pickRemote(0);
  assert.ok(chosen, 'a piece was taken');
  assert.equal(bag.filter((i) => i.group === 'Armor').length, 1);
  assert.equal(win.done, true, 'the window closed itself');
  assert.equal(mem.flags, armorMaskForRank(2), 'and the rank is claimed');
  assert.equal(hasClaimedArmor(mem), true);
});

test('G6: DECLINING COSTS NOTHING - closing without taking claims nothing', () => {
  const mem = { rank: 5, flags: 0 };
  const offer = receiveArmorDecision(mem, { rolls: () => 0.5 });
  const bag = [];
  const win = new NativeInventoryWindow({
    items: () => bag,
    chooseOne: { items: offer.pieces, onChoose: () => claimArmor(mem, offer.mask) },
  });
  // OnPop clears the mode (:679); nothing else happens
  win._closeSilently();
  assert.equal(win.done, true);
  assert.equal(mem.flags, 0, 'no flag was set');
  assert.equal(bag.length, 0, 'and no armour was taken');
  // ...so the smith offers again
  assert.equal(receiveArmorDecision(mem, { rolls: () => 0 }).kind, 'offer');
});

test('G6: the flags ride the save, and a pre-G6 membership restores as unclaimed', () => {
  const roundTrip = (memberships) => {
    const snap = JSON.parse(JSON.stringify(snapshotPlayer({ guildMemberships: memberships })));
    const back = {};
    restorePlayer(back, snap);
    return back.guildMemberships;
  };
  const kept = roundTrip({ 4: { guild: 'KnightlyOrder', rank: 6, lastRankChange: 3, flags: 260 } });
  assert.equal(kept[4].flags, 260, 'the bitfield survived');
  assert.equal(hasClaimedArmor(kept[4], 6), true, '4 << 6 is 256');
  assert.equal(hasClaimedArmor(kept[4], 0), true, 'and bit 2 is the rank-0 claim');
  assert.equal(hasClaimedArmor(kept[4], 5), false);

  // a membership saved before this slice has no flags column at all,
  // and reads as nothing claimed rather than as everything claimed
  const old = roundTrip({ 4: { guild: 'KnightlyOrder', rank: 6, lastRankChange: 3 } });
  assert.equal(old[4].flags, undefined);
  assert.equal(hasClaimedArmor(old[4], 6), false);
});

// =====================================================================
// D9: KnightlyOrder.RestoreGuildData's armour-bit migration
// (KnightlyOrder.cs:283-295), run on every load through save.js's
// restoreMembershipBook (save.js:46) from restorePlayer (save.js:570).
// =====================================================================
test('D9: RestoreGuildData back-fills the armour bit for every rank BELOW the current one', () => {
  // the gate is `(flags & 4092) == 0` (:288) - NO new-style bit set
  assert.equal(ARMOR_FLAG_ANY_MASK, 4092);
  assert.equal(LEGACY_ARMOR_FLAG_MASK, 1);

  // rank 3, nothing claimed: bits for ranks 0..2 (4|8|16), NOT the
  // rank's own bit - the current rank's gift is still owed (:290-291)
  assert.equal(restoreKnightlyOrderFlags({ rank: 3, flags: 0 }).flags, 28);
  // the pre-0.11 BOOLEAN "armour taken" flag (bit 0) additionally
  // claims the OWN rank's bit (:292-293): 1|4|8|16|32
  assert.equal(restoreKnightlyOrderFlags({ rank: 3, flags: 1 }).flags, 61);
  // a book already written in the new style is left exactly alone
  assert.equal(restoreKnightlyOrderFlags({ rank: 5, flags: 4 }).flags, 4);
  // claimHouse's row (flags = HOUSE_FLAG_MASK) trips the gate but has
  // no rank below 0 to fill, so it too comes back untouched
  assert.equal(restoreKnightlyOrderFlags({ rank: 0, flags: HOUSE_FLAG_MASK }).flags, HOUSE_FLAG_MASK);
  assert.equal(restoreKnightlyOrderFlags(null), null);
});

test('D9: the header names the module that really holds the load door', () => {
  // the one-home comment is a NAVIGATION instrument - it sent readers
  // to guilds.js, which has no restore door at all and never had one.
  const gifts = readFileSync(new URL('../src/systems/knightlyGifts.js', import.meta.url), 'utf8');
  const guilds = readFileSync(new URL('../src/systems/guilds.js', import.meta.url), 'utf8');
  const save = readFileSync(new URL('../src/systems/save.js', import.meta.url), 'utf8');
  assert.ok(!/restoreMembershipBook/.test(guilds), 'guilds.js holds no restoreMembershipBook');
  assert.match(save, /const restoreMembershipBook = /, 'save.js defines it');
  assert.match(save, /restoreKnightlyOrderFlags\(knightly\)/, 'and it is the caller');
  const door = gifts.match(/The one door is restoreKnightlyOrderFlags below, run by (\S+?)'s/);
  assert.ok(door, 'the header still names the door');
  assert.equal(door[1], 'save.js', 'and it names the file that actually holds it');
});

test('D9: the back-fill runs at the LOAD door, so a demotion cannot re-open a claimed gift', () => {
  const KNIGHTS = GUILD_GROUPS.KnightlyOrder;
  const roundTrip = (memberships) => {
    const snap = JSON.parse(JSON.stringify(snapshotPlayer({ guildMemberships: memberships })));
    const back = {};
    restorePlayer(back, snap);
    return back.guildMemberships;
  };
  // a pre-D9 book: rank 3 knight who never claimed anything
  const plain = roundTrip({ [KNIGHTS]: { guild: 'KnightlyOrder', rank: 3, lastRankChange: 2, flags: 0 } });
  const row = plain[KNIGHTS];
  assert.equal(row.flags, 28, 'the load back-filled ranks 0..2');
  assert.equal(hasClaimedArmor(row, 2), true);
  assert.equal(hasClaimedArmor(row, 3), false, 'the current rank is still owed its gift');
  // and the observable: demoted to rank 2, the smith refuses
  assert.equal(receiveArmorDecision({ ...row, rank: 2 }, { rolls: () => 0.5 }).kind, 'refuse');
  assert.equal(receiveArmorDecision({ ...row, rank: 2 }, { rolls: () => 0.5 }).textId, NO_ARMOR_TEXT_ID);
  assert.equal(receiveArmorDecision(row, { rolls: () => 0.5 }).kind, 'offer');

  // save.js:570-571 restores through TWO arms - the V2e store shape
  // takes the same door on BOTH books
  const store = roundTrip({
    mortal: { [KNIGHTS]: { guild: 'KnightlyOrder', rank: 2, flags: 0 } },
    vampire: { [KNIGHTS]: { guild: 'KnightlyOrder', rank: 4, flags: 1 } },
  });
  assert.equal(store.mortal[KNIGHTS].flags, 4 | 8);
  assert.equal(store.vampire[KNIGHTS].flags, 1 | 4 | 8 | 16 | 32 | 64);
});

test('G6: the two destinations, and the records they speak', () => {
  assert.equal(serviceDestination('Spymaster'), 'guildServiceSpymaster');
  assert.equal(serviceDestination('ReceiveArmor'), 'guildServiceReceiveArmor');
  // the TEXT.RSC ids, verbatim (:36-39, :433)
  assert.equal(ARMOR_TEXT_ID, 463);
  assert.equal(NO_ARMOR_TEXT_ID, 461);
  assert.equal(NO_HOUSE_TEXT_ID, 460);
  assert.equal(SPYMASTER_GREETING_TEXT_ID, 402);
  // H1: THAT DAY CAME. This asserted a FLAGGED null "until house
  // ownership lands, which banking flagged as waiting on the building
  // directory" - both halves are built now, so ReceiveHouse is the
  // third destination this module speaks for and the two records it
  // was already keeping (NO_HOUSE_TEXT_ID here, HOUSE_FLAG_MASK
  // above) have a caller at last.
  assert.equal(serviceDestination('ReceiveHouse'), 'guildServiceReceiveHouse');
  assert.equal(HOUSE_TEXT_ID, 462);
});

test('G6: an arm may answer a BOX, and a box is not a window', () => {
  // Two of this slice's arms answer a message box rather than a
  // window - the smith's refusal and the Spymaster's greeting - and
  // both belong ON the popup that asked rather than in place of it.
  // The caller used to mount whatever came back, so a box landed in
  // the overlay slot and the next frame asked a plain object to draw
  // itself. The live probe found it; this is the pin.
  const src = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
  const i = src.indexOf('const flow = openServiceFlow(serviceDestination(service)');
  assert.ok(i > 0, 'the caller exists');
  const call = src.slice(i, src.indexOf('return { dispatched: true };', i) + 30);
  assert.ok(call.includes('if (flow.rows) return flow;'), 'a box is handed back, not mounted');
  assert.ok(call.indexOf('if (flow.rows)') < call.indexOf('interiorOverlay = flow;'),
    'and the test comes BEFORE the mount, or it never runs');

  // the two arms really do answer boxes, so the guard is not dead
  const refuse = src.indexOf("destination === 'guildServiceReceiveArmor'");
  assert.ok(src.slice(refuse, refuse + 900).includes("return { rows: refusal.length"), 'the smith refuses with rows');
  const spy = src.indexOf("destination === 'guildServiceSpymaster'");
  assert.ok(src.slice(spy, spy + 700).includes('closesWindow: true'), 'and the greeting closes the popup');

  // the probe seam keeps the same contract, or it would prove the
  // opposite of what the host does
  assert.ok(src.includes('if (flow && !flow.rows) interiorOverlay = flow;'));
});
