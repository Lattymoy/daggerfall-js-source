// RW1 - THE QUESTCOMPLETE LOOT WINDOW (2026-08-28). GivePc's offer
// arm (GivePc.cs:150-196) has been complete on the ACTION side since
// Q2b-ii - questSuccess, the QuestComplete popup, MakePermanent, the
// reoffer release, then hooks.offerReward - but the world's hook was
// a FLAGGED direct-add with a HUD line. It is DFU's flow now: a real
// dropped-loot container minted at the player, and the inventory
// opened over it as its remote target when the QuestComplete box the
// action just raised CLOSES (messageBox.OnClose, :173/:189-196).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(p, 'utf8');

test('RW1 world: the pends flag is GONE and the reward is a container, not a silent add', () => {
  const world = read('src/scenes/world.js');
  assert.ok(!/loot window pends/.test(world), 'retiring a flag deletes the sentence');
  assert.ok(!/You have been given/.test(world), 'the stand-in HUD line goes with it');
  const from = world.indexOf('offerReward: (q, dfItem) => {');
  assert.ok(from > 0, 'the door exists');
  const body = world.slice(from, from + 1400);
  assert.match(body, /modes\?\.mintRewardPile\?\.\(dfItem\)/,
    'the MODE that owns the ground is asked first');
  assert.match(body, /if \(open === undefined\)/,
    'undefined = not my mode; null = the mode owned the ground and could not mint - ?? would fold them');
  assert.match(body, /droppedLoot\.dropPile\(\[dfItem\], dropFeet\(\)/,
    'CreateDroppedLootContainer(PlayerObject) - the pile lands at the player');
  assert.match(body, /loot: droppedLootHooks\(pile\)/,
    'the inventory opens with the pile as its REMOTE target - G5: with DaggerfallLoot\'s own identity, so the reward pile\'s icon cycles like any other');
  assert.match(body, /onClose: \(\) => droppedLoot\.releaseEmptied\(\)/,
    'DFU frees the emptied container on window close - the drop arm\'s own law');
  assert.match(body, /_onQuestBoxClosed = open;\s*\n\s*else open\?\.\(\);/,
    'armed on the live QuestComplete box, immediate when none is up');
});

test('RW1 world: the quest box fires the OnClose latch ONCE and clears it', () => {
  const world = read('src/scenes/world.js');
  assert.match(world,
    /const fire = _onQuestBoxClosed; _onQuestBoxClosed = null; fire\?\.\(\);/,
    'GivePc.cs:173 - messageBox.OnClose += QuestCompleteMessage_OnClose, one-shot');
});

test('RW1 modes (ID1): dungeon and interior mint on their own ground; the exterior falls through', () => {
  const modes = read('src/scenes/worldModes.js');
  // NARROWED at ID1: the interior gained its own ground, so "everyone
  // else falls through" is now EXTERIOR alone. GivePc mints through the
  // same CreateDroppedLootContainer the inventory drop does
  // (GivePc.cs:168), so it picks its parent by the same context, and
  // the port's three arms are now DFU's three.
  const body = modes.slice(modes.indexOf('mintRewardPile(dfItem) {'));
  const dungeon = body.indexOf("if (mode === 'dungeon' && dungeonCtx?.offerRewardLoot) return dungeonCtx.offerRewardLoot(dfItem);");
  const interior = body.indexOf("if (mode === 'interior' && interiorCtx) {");
  const fallThrough = body.indexOf('return undefined;');
  assert.ok(dungeon > 0, 'the dungeon arm is there');
  assert.ok(interior > dungeon, 'then the interior, on its own pool');
  assert.ok(fallThrough > interior, 'and undefined LAST - the world host mints for the exterior alone');
  assert.match(body.slice(interior, fallThrough), /interiorDropped\.dropPile\(\[dfItem\], interiorDropFeet\(\)\)/,
    'the interior pile is minted at the interior ground position');
});

test('RW1 dungeon: offerRewardLoot mints at the player and answers the open thunk', () => {
  const ctx = read('src/scenes/dungeonContext.js');
  const from = ctx.indexOf('offerRewardLoot(dfItem) {');
  assert.ok(from > 0, 'the dungeon arm exists');
  const body = ctx.slice(from, from + 500);
  assert.match(body, /if \(!lastPlayerFeet\)/, 'no ground position yet -> null, loudly (the onDrop arm\'s own law)');
  assert.match(body, /droppedLoot\.dropPile\(\[dfItem\], \[\.\.\.lastPlayerFeet\]\)/,
    'the pile at the player\'s feet');
  assert.match(body, /this\.takeLoot\(`droppedLoot:\$\{pile\.id\}`\)/,
    'the thunk opens the SAME three-way loot door every pile rides');
});
