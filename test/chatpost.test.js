// CHAT-POST (2026-09-27, Discord - Tabitha: "Link in chat / Post in chat"; "random magic items' details in chat").
//
// AN ITEM IN CHAT IS ONE LINE (ui/enhancedInventory.js itemChatText): its name in brackets, its headline stat and its
// magic (itemPowerLines, TRADE-INFO's list), cut at a whole word to the chat's bound (CHAT_MAX) - a chat line is words,
// and the relay carries text alone. The pack's card and right-click menu offer "Post in chat" wherever the host hands
// the door (online, with a chat tab open), and the host says it on the chat's open tab through chatSend - every tab's
// own reasons hold (no party for the Party tab, an older relay) - in all three hosts that open a pack.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { itemChatText, itemPowerLines, POSTED_TEXT, NOT_POSTED_TEXT } from '../src/ui/enhancedInventory.js';
import { setPref } from '../src/systems/uiPrefs.js';
import { LOOT_RARITY_KEY } from '../src/systems/lootRarity.js';
import { CHAT_MAX, sanitizeChat } from '../src/net/wire.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
setPref(LOOT_RARITY_KEY, false);

test('CHAT-POST itemChatText: the name in brackets, then the magic, a line the chat carries whole; a long one is cut at a whole word inside CHAT_MAX (mutants: the magic left off; the bound not kept; cut mid-word)', () => {
  const sword = { templateIndex: 113, itemGroup: 2, name: 'Longsword', enchantments: [{ type: 4, param: 1 }, { type: 11, param: -1 }], isIdentified: true };
  const t = itemChatText(sword, {});
  assert.match(t, /^\[[^\]]+\]/, 'the name first, in brackets');
  assert.match(t, /Potent vs Daedra · Feather weight$/, 'then its powers, as the card says them');
  assert.equal(sanitizeChat(t), t, 'the chat carries it as it is');
  const plain = itemChatText({ templateIndex: 113, itemGroup: 2, name: 'Longsword', enchantments: [] }, {});
  assert.match(plain, /^\[[^\]]+\]/);
  // a piece with more magic than one line holds
  const many = { ...sword, enchantments: [4, 5, 7, 8, 9, 11, 12, 13, 3, 4, 5, 3, 3, 4].map((type, i) => ({ type, param: i % 4 })) };
  const long = itemChatText(many, {});
  assert.ok(long.length <= CHAT_MAX, `${long.length} within ${CHAT_MAX}`);
  assert.ok(long.endsWith('...'), 'said to be cut');
  assert.equal(sanitizeChat(long), long);
  assert.doesNotMatch(long, / \.\.\.$|·\.\.\.$/, 'cut at a word, never after a separator');
  const name = long.slice(1, long.indexOf(']'));
  const whole = `[${name}] ${itemPowerLines(many, {}).join(' · ')}`;
  const kept = long.slice(0, -3);
  assert.ok(whole.startsWith(kept) && /[ ·]/.test(whole[kept.length]), `cut at a whole word: "...${kept.slice(-12)}" + "${whole[kept.length]}"`);
});

test('CHAT-POST the card and the hosts: "Post in chat" only where the host hands the door, said on the chat\'s open tab through chatSend, in the three hosts that open a pack (mutants: offered offline; sent past chatSend; a host that hands none)', () => {
  const inv = src('src/ui/enhancedInventory.js');
  assert.match(inv, /if \(deps\.canPostItem\?\.\(\)\) \{\n\s*const post = el\('button', 'act', 'Post in chat'\);\n\s*post\.onclick = \(\) => \{ notice = deps\.postItem\?\.\(itemChatText\(picked\)\) \? POSTED_TEXT : NOT_POSTED_TEXT; render\(\); \};/);
  assert.equal(POSTED_TEXT, 'Posted in chat.');
  assert.match(NOT_POSTED_TEXT, /Could not post/);
  const W = src('src/scenes/world.js');
  assert.match(W, /const canPostItemInChat = \(\) => !!\(chatLog\?\.active && chatPanel\);\n\s*const postItemInChat = \(text\) => \(canPostItemInChat\(\) \? chatSend\(chatLog\.active, text\) === true : false\);/);
  assert.match(W, /const makeInventoryWindow = \(extra = \{\}\) => createInventoryWindow\(\{\n\s*\.\.\.packDoors,[^\n]*\n\s*postItem: \(text\) => postItemInChat\(text\), canPostItem: \(\) => canPostItemInChat\(\),/);
  assert.match(W, /postItem: \(text\) => postItemInChat\(text\), canPostItem: \(\) => canPostItemInChat\(\),   \/\/ CHAT-POST: the building's and the dungeon's packs post too/);
  assert.match(src('src/scenes/worldModes.js'), /postItem: \(text\) => host\.postItem\?\.\(text\) \?\? false, canPostItem: \(\) => host\.canPostItem\?\.\(\) \?\? false,/);
  assert.match(src('src/scenes/dungeonContext.js'), /postItem: \(text\) => opts\.postItem\?\.\(text\) \?\? false, canPostItem: \(\) => opts\.canPostItem\?\.\(\) \?\? false,/);
});
