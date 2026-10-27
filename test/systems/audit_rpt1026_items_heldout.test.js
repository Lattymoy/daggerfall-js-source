// AUDIT RPT1026 (lane G, ITEMS) - G5: HELD-OUT's "a piece already back in the pack is written once" had no pin that
// could fail. heldOutOf leaves out a held piece the pack holds itself (systems/item/heldOut.js), and the batch's pins
// asked only after the counter had closed - its hold released, so they held whether or not the pack was read. The
// classic counter is built for a host that hands it a SELECTION over the pack (nativeTrade.js localList, AUDIT 39 F102:
// "the staged lot is a SELECTION over a pack that still holds the item"), and there a staged piece is on the counter and
// in the pack at once. Driven through the real counter (its slot pressed), over a made character's pack and the
// ladder's Legendary with its realm id, read by the realm judge's own ledgerPieces - test/systems/rpt1026_items' shape.
import '../modsOff.js';
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playerEntity } from '../../src/characters/playerEntity.js';
import { createCharacter } from '../../src/systems/chargen.js';
import { snapshotPlayer, restorePlayer } from '../../src/systems/save/save.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { applyRarity } from '../../src/systems/loot/lootRarity.js';
import { stampItemIds } from '../../src/systems/item/itemIds.js';
import { seededRng } from '../../src/systems/wind/wind.js';
import { NativeTradeWindow } from '../../src/ui/native/nativeTrade.js';
import { ledgerPieces } from '../../server-account/src/judge.js';

const BROADSWORD = 118, LONGSWORD = 120;
/** The classic counter's first local slot (test/systems/road_d7_trade_residue.test.js's). */
const LOCAL_SLOT0 = [192, 48 + 20];

function hero() {
  const p = structuredClone(playerEntity);
  createCharacter(p, { name: 'Finder', hp: 12, primarySkills: [], majorSkills: [], minorSkills: [],
    stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 } }, -1, { rolls: () => 0.5 });
  const legend = applyRarity(createWeapon(BROADSWORD, 3, () => 0.5), 'legendary', seededRng(7));
  p.items = [legend, createWeapon(LONGSWORD, 1, () => 0.5)];
  stampItemIds(p, (b) => b.fill(7));
  return { p, legend };
}
const saveOf = (p) => JSON.parse(JSON.stringify(snapshotPlayer(p, {})));
const held = (save, uid) => ledgerPieces(save).filter((x) => x.key === uid).length;

test('G5 HELD-OUT: a counter over a SELECTION of the pack stages a piece that is still in the pack - the save writes it once, never twice, and a load comes back with one (mutant: the held lot not read against the pack)', () => {
  const { p, legend } = hero();
  const w = new NativeTradeWindow({
    mode: 'Identify', entity: p,
    packItems: () => p.items.filter(() => true),   // a selection, as a host may hand one (localList's F102 note)
    shelfItems: () => [], isEquipped: (it) => it.equipSlot != null, gold: () => 0, rows: (id) => [{ text: `#${id}`, center: true }],
    commit: () => {}, icons: { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() },
  });
  w.click(...LOCAL_SLOT0);
  assert.deepEqual(w.staged, [legend], 'staged on the counter');
  assert.equal(p.items.includes(legend), true, 'and still in the pack - the splice landed on the selection');
  const under = saveOf(p);
  assert.equal(held(under, legend.uid), 1, 'the save under the counter writes it once - the ledger reads no copy');
  const back = structuredClone(playerEntity);
  restorePlayer(back, under);
  assert.equal(back.items.filter((it) => it.uid === legend.uid).length, 1, 'and the next join holds one');
  w.input('Escape');
});
