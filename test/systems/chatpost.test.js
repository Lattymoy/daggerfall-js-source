// CHAT-POST (2026-09-27, Discord - Tabitha: "Link in chat / Post in chat"; "random magic items' details in chat").
//
// AN ITEM IN CHAT: Post sends its own line; Link inserts `[Label]` into the chat field so a typed message can carry
// one or more pieces (wire.js validChatItems). A hearing client draws coloured [Name]s whose hover is the pack's tip.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { itemChatText, itemChatLabel, itemPowerLines, POSTED_TEXT, NOT_POSTED_TEXT, LINKED_TEXT, NOT_LINKED_TEXT } from '../../src/ui/enhanced/enhancedInventory.js';
import { chatItemOf, chatItemLink, chatTextParts, openLinkQuery, matchBagItems, takePendingLinks, prunePendingLinks } from '../../src/ui/chatItemLink.js';
import { setPref } from '../../src/systems/uiPrefs.js';
import { LOOT_RARITY_KEY, RARITIES } from '../../src/systems/loot/lootRarity.js';
import { CHAT_MAX, sanitizeChat, validChatItem, validChatItems, parseClient } from '../../src/net/wire.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
setPref(LOOT_RARITY_KEY, false);

test('CHAT-POST itemChatText: the name in brackets, then the magic, a line the chat carries whole; a long one is cut at a whole word inside CHAT_MAX (mutants: the magic left off; the bound not kept; cut mid-word)', () => {
  const sword = { templateIndex: 113, itemGroup: 2, name: 'Longsword', enchantments: [{ type: 4, param: 1 }, { type: 11, param: -1 }], isIdentified: true };
  const t = itemChatText(sword, {});
  assert.match(t, /^\[[^\]]+\]/, 'the name first, in brackets');
  assert.match(t, /Potent vs Daedra · Feather weight$/, 'then its powers, as the card says them');
  assert.equal(sanitizeChat(t), t, 'the chat carries it as it is');
  const plain = itemChatText({ templateIndex: 113, itemGroup: 2, name: 'Longsword', enchantments: [] }, {});
  assert.match(plain, /^\[[^\]]+\]/);
  assert.equal(itemChatLabel({ templateIndex: 3, name: 'Ruby', stackCount: 260 }, {}), 'Ruby x260', 'a stack names its count');
  assert.equal(itemChatLabel({ templateIndex: 3, name: 'Ruby', stackCount: 1 }, {}), 'Ruby', 'one is bare');
  assert.match(itemChatText({ templateIndex: 3, name: 'Ruby', stackCount: 260 }, {}), /^\[Ruby x260\]/);
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

test('CHAT-POST the card and the hosts: Link and Post only where the host hands the door, said on the chat\'s open tab through chatSend, in the three hosts that open a pack (mutants: offered offline; sent past chatSend; a host that hands none)', () => {
  const inv = src('src/ui/enhanced/enhancedInventory.js');
  assert.match(inv, /if \(deps\.canPostItem\?\.\(\)\) \{/);
  assert.match(inv, /el\('button', 'act', 'Link in chat'\)/);
  assert.match(inv, /deps\.linkItem\?\.\(picked\) \? LINKED_TEXT : NOT_LINKED_TEXT/);
  assert.match(inv, /el\('button', 'act', 'Post in chat'\)/);
  assert.match(inv, /deps\.postItem\?\.\(itemChatText\(picked\), picked\) \? POSTED_TEXT : NOT_POSTED_TEXT/);
  assert.equal(POSTED_TEXT, 'Posted in chat.');
  assert.equal(LINKED_TEXT, 'Linked in chat.');
  assert.match(NOT_POSTED_TEXT, /Could not post/);
  assert.match(NOT_LINKED_TEXT, /Could not link/);
  const W = src('src/scenes/world.js');
  assert.match(W, /const canPostItemInChat = \(\) => !!\(chatLog\?\.active && chatPanel\);/);
  assert.match(W, /const postItemInChat = \(text, item\) => \(canPostItemInChat\(\) \? chatSend\(chatLog\.active, text, chatLog\.active, \{ item \}\) === true : false\);/);
  assert.match(W, /const linkItemInChat = \(item\) => \(canPostItemInChat\(\) \? chatPanel\.linkItem\?\.\(item\) === true : false\);/);
  assert.match(W, /postItem: \(text, item\) => postItemInChat\(text, item\), linkItem: \(item\) => linkItemInChat\(item\), canPostItem: \(\) => canPostItemInChat\(\),   \/\/ CHAT-POST: post or link into the field/);
  assert.match(W, /postItem: \(text, item\) => postItemInChat\(text, item\), linkItem: \(item\) => linkItemInChat\(item\), canPostItem: \(\) => canPostItemInChat\(\),   \/\/ CHAT-POST: the building's and the dungeon's packs post too/);
  assert.match(src('src/scenes/worldModes.js'), /postItem: \(text, item\) => host\.postItem\?\.\(text, item\) \?\? false, linkItem: \(item\) => host\.linkItem\?\.\(item\) \?\? false, canPostItem: \(\) => host\.canPostItem\?\.\(\) \?\? false,/);
  assert.match(src('src/scenes/dungeonContext.js'), /postItem: \(text, item\) => opts\.postItem\?\.\(text, item\) \?\? false, linkItem: \(item\) => opts\.linkItem\?\.\(item\) \?\? false, canPostItem: \(\) => opts\.canPostItem\?\.\(\) \?\? false,/);
  assert.match(src('src/ui/chatPanel.js'), /linkItem: \(item\) => \{/);
  assert.match(src('src/ui/chatPanel.js'), /takePending\(text\)/);
  assert.match(W, /bagItems: \(\) => playerEntity\.items \?\? \[\],   \/\/ CHAT-POST: typing `\[` in the field lists the pack by name/);
  assert.match(src('src/ui/chatPanel.js'), /bagItems = null/);
  assert.match(src('src/ui/chatPanel.js'), /refreshSuggest/);
});

test('CHAT-POST `[` autocomplete: openLinkQuery finds an unfinished bracket; matchBagItems ranks the pack by label (mutants: query ignored; picker mute)', () => {
  assert.deepEqual(openLinkQuery('hi [Rub', 7), { start: 3, query: 'Rub' });
  assert.equal(openLinkQuery('hi [Ruby]', 9), null, 'a closed bracket is not a pick');
  assert.equal(openLinkQuery('hi Ruby', 7), null);
  const bag = [
    { templateIndex: 3, name: 'Ruby', stackCount: 260 },
    { templateIndex: 113, itemGroup: 2, name: 'Longsword', enchantments: [], equipSlot: 1 },
    { templateIndex: 4, name: 'Emerald', stackCount: 2 },
    { templateIndex: 3, name: 'Ruby', stackCount: 10 },
  ];
  assert.deepEqual(matchBagItems(bag, 'ru').map((r) => r.label), ['Ruby x10', 'Ruby x260'], 'every match, not one per label');
  assert.deepEqual(matchBagItems(bag, '').map((r) => r.label), ['Longsword', 'Emerald x2', 'Ruby x10', 'Ruby x260'], 'worn first');
  assert.equal(matchBagItems(bag, '')[0].equipped, true);
  assert.equal(matchBagItems(bag, 'zzz').length, 0);
  assert.equal(matchBagItems(bag, '', { limit: 2 }).length, 2);
  const a = { templateIndex: 3, name: 'Ruby', stackCount: 10, id: 'a' };
  const b = { templateIndex: 3, name: 'Ruby', stackCount: 10, id: 'b' };
  assert.deepEqual(takePendingLinks([{ label: 'Ruby x10', item: a }, { label: 'Ruby x10', item: b }], '[Ruby x10]'), [a], 'one bracket keeps one pending');
  assert.deepEqual(takePendingLinks([{ label: 'Ruby x10', item: a }, { label: 'Ruby x10', item: b }], '[Ruby x10] [Ruby x10]'), [a, b]);
  assert.deepEqual(takePendingLinks([{ label: 'Ruby x10', item: a }], 'no link'), []);
  assert.deepEqual(prunePendingLinks([{ label: 'Ruby x10', item: a }, { label: 'Ruby x10', item: b }], ''), [], 'a deleted bracket frees its pending slot');
  assert.match(src('src/ui/chatPanel.js'), /if \(openLinkQuery\(v, caret\)\) return;/);
  assert.match(src('src/ui/chatPanel.js'), /const openQ = openLinkQuery\(v, a\);/);
  assert.match(src('src/ui/chatPanel.js'), /if \(openQ\) return completeLinkAt\(item, openQ\);/);
});

test('CHAT-POST the wire carries items beside the words; the panel draws coloured [Name]s whose hover is the pack\'s card (mutants: item dropped on parse; link not drawn; card not the pack\'s)', () => {
  const sword = { templateIndex: 113, group: 'Weapons', name: 'Longsword', enchantments: [{ type: 4, param: 1 }], isIdentified: true, rarity: 'rare' };
  assert.equal(validChatItem(sword), sword);
  assert.equal(validChatItem(null), null);
  assert.equal(validChatItem([]), null);
  assert.deepEqual(validChatItems([sword, sword]), [sword, sword]);
  assert.equal(validChatItems([]), null);
  const one = parseClient(JSON.stringify({ t: 'chat', text: '[Longsword]', item: sword }), { hasHello: true });
  assert.deepEqual(one, { t: 'chat', text: '[Longsword]', items: [sword], item: sword });
  const many = parseClient(JSON.stringify({ t: 'chat', text: 'want [Longsword]?', items: [sword] }), { hasHello: true });
  assert.deepEqual(many, { t: 'chat', text: 'want [Longsword]?', items: [sword], item: sword });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'chat', text: '[Longsword]', item: 'no' }), { hasHello: true }), { error: 'bad chat' });
  assert.match(src('server/src/index.js'), /\.\.\.\(m\.items \? \{ items: m\.items \} : \{\}\)/);
  assert.match(src('src/net/online.js'), /validChatItems\(raw\.map/);
  assert.match(src('src/ui/chatPanel.js'), /chatItemsOf\(line\)/);
  assert.match(src('src/ui/chatItemLink.js'), /showItemHover\(item, \{\}, link, 'shop'\)/);
  setPref(LOOT_RARITY_KEY, true);
  const el = (tag, cls, text) => {
    const n = { tagName: tag.toUpperCase(), className: cls, textContent: text ?? '', style: {}, listeners: {}, kids: [] };
    n.addEventListener = (k, fn) => { n.listeners[k] = fn; };
    n.append = (...nodes) => { n.kids.push(...nodes); };
    return n;
  };
  const got = chatItemOf(sword);
  assert.ok(got);
  const link = chatItemLink(got, el);
  assert.equal(link.className, 'dfchat-item');
  assert.equal(link.textContent, `[${itemChatLabel(got)}]`);
  assert.equal(link.style.color, RARITIES.rare.colour);
  const stacked = chatItemOf({ templateIndex: 3, name: 'Ruby', stackCount: 260 });
  assert.ok(stacked);
  assert.equal(chatItemLink(stacked, el).textContent, '[Ruby x260]');
  const parts = chatTextParts('want [Ruby x260] please', [stacked], el, { plain: (t) => ({ text: t }) });
  assert.equal(parts.length, 3);
  assert.equal(parts[0].text, 'want ');
  assert.equal(parts[1].textContent, '[Ruby x260]');
  assert.equal(parts[2].text, ' please');
  assert.equal(typeof link.listeners.mouseenter, 'function');
  assert.equal(typeof link.listeners.mouseleave, 'function');
  setPref(LOOT_RARITY_KEY, false);
});
