// CHAT-TRADE + CHAT-RP (2026-10-14, Mac: "improve the player chat interface without introducing clutter and implement
// new commands into /help - /rp Italicizes and makes text color green. For roleplay purposes - New channels: 1. Trading
// 2. LFG"). The Trade and LFG channels are the Language channel's shape twice over - a room each, joined by choice, the
// tab on the bar only while joined - and a line of roleplay is OOC's kind of mark: the speaker's own *asterisks*.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHAT_TABS, ChatLog, OPT_CHANNELS, isRpText, rpText, notJoinedText, optJoinedText, optJoinedSayText, optLeftText, optWaitText, tradeChanOldText, alreadyJoinedText } from '../../src/net/chat.js';
import { CHAT_TRADE_ROOM, CHAT_LFG_ROOM, CHAT_ROOMS, isChatRoom, isRegionRoom, TRADE_CHAN_RELAY_MIN, relaySupportsTradeChan, RELAY_VERSION } from '../../src/net/wire.js';
import { parseChatLine, CHANNEL_COMMANDS, HELP_LINES, JOIN_CHANNELS, badJoinText } from '../../src/net/chatCommands.js';
import { RP_COLOURS, CHANNEL_COLOURS, CHAT_GROUNDS, PING_GROUNDS, COLOURED_LINE, contrast } from '../../src/ui/chatColours.js';
import { bubbleLineOk } from '../../src/ui/nameLayer.js';
import { PREF_DEFAULTS } from '../../src/systems/uiPrefs.js';
import { ONLINE_PLAYERS_OWN_PREFS } from '../../src/systems/online/onlineLane.js';
import { GRIMOIRE_KIT_CSS } from '../../src/ui/grimoireDress.js';
import { CHAT_CSS, createChatPanel } from '../../src/ui/chatPanel.js';

const rd = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');

test('CHAT-TRADE wire: the Trade and LFG channels are two whitelisted rooms of their own, no region\'s; the relay that opens them is world201 and the version moved', () => {
  assert.deepEqual([CHAT_TRADE_ROOM, CHAT_LFG_ROOM], ['chat:trade', 'chat:lfg']);
  for (const room of [CHAT_TRADE_ROOM, CHAT_LFG_ROOM]) { assert.ok(CHAT_ROOMS.has(room), room); assert.ok(isChatRoom(room), room); assert.ok(!isRegionRoom(room), room); }
  assert.equal(isChatRoom('chat:trade.1'), false, 'a whitelist, not a prefix');
  assert.equal(TRADE_CHAN_RELAY_MIN, 201);
  assert.equal(relaySupportsTradeChan('world200'), false);
  assert.equal(relaySupportsTradeChan('world201'), true);
  assert.equal(relaySupportsTradeChan('world2010x'), false);
  assert.equal(RELAY_VERSION, 'world247');   // PIN MOVED: world247, STAFF-PANEL5 (the staff panel relay release: follow, Message on screen, the feeds, the staff cut, hidden staff, freeze and the staff chat; NOT YET DEPLOYED); PIN MOVED: world246, SEA VENTURES (world241 on its branch, then world242 and world245, renumbered past SD-THROUGH, LEASE1, PARTY-PING, SPAWN-THIN and AUDIT PISTOLET at the merges - the Eltheric Ocean ventures, one relay: the hub reads a vault of the deep by its cell, a fall signs its room, the referee judges a broadside); PIN MOVED: world245, AUDIT PISTOLET (the siege referee knows the top of the Dwarven Pistolet - SIEGE_PISTOLET - and a duel shot from the off hand of a pair carries the DUAL terms, `off` on a shot as on a swing; world242 on its branch, renumbered past LEASE1, PARTY-PING and SPAWN-THIN at the merge); PIN MOVED: world244, SPAWN-THIN (the overworld keep drops a quarter of the spawn band; world242 on its branch, renumbered past PARTY-PING world243 at the merge); PIN MOVED: world243, PARTY-PING (validPartyPose carries pg); PIN MOVED: world242, LEASE1 (the hub hands each socket a signed lease, its mute and freeze, and the game hands it to every other room it holds; a lease room takes the hub word from one newer than its own); PIN MOVED: world241, SD-THROUGH (a Hollow realm tells the hub its first soul through the Rift, the record keeps `inAt` - the Way Through; world239 then world240 on its branch, renumbered past FOES-FIRST and GUILD-CAP at the merges); PIN MOVED: world240, GUILD-CAP (a guild holds 75 - net/guild/guildLaw.js GUILD_MEMBERS_MAX - and the who-of-my-guild list of the hub 100, net/hubShards.js HUB_GUILD_WHO_MAX, both in the bundle of the relay); PIN MOVED: world239, FIELD BUGS 2026-10-21c FOES-FIRST (a foes room spends its budget on full frames first - a delta keeps a reserve, a full frame may borrow a bounded debt, each sender one first a second and its next frame first once unheard four seconds - and counts the blows its hit funnels drop, HIT-DROPS); PIN MOVED: world237, FIELD BUGS 2026-10-20f (an Elite Breach room tells a striker what each blow landed, eland, and a member at the door why it will not take them, efair; the fair trail sees a member standing still - egStillGap; a held lord answers what it lost; world236 on its branch, renumbered past the LONE-HERALD world236 at the merge); PIN MOVED: world236, FIELD BUGS 2026-10-20d LONE-HERALD (the herald news of a Valkynaz Redoubt carries the size of its company and an entrant to lead it, so a company of one is posted alone; world235 on its branch, renumbered past the Witches Festival and the Starfall world235 at the merge); PIN MOVED: world235, WITCH1 (the Witches Festival words in the token - two titles, an aura, a profile icon pi, the festival cards) and STAR3 (the Starfall: a word at a fallen star, the ledger and receipts its cell keeps, the held stars the hub keeps; world233 on its branch, renumbered past world233 (SD-SEA) and world234 (DEX1) at the merge), one release; PIN MOVED: world234, DEX1 (a foe kind on the wire is a u16, FOE_TYPE_MAX, so the enemy mod 256-398 cross; the enemy table in the relay graph takes a mod rows, customEnemies.js joining it; world225 on its branch, renumbered past the world225-world233 of main at the merges); PIN MOVED: world233, SD-SEA (the Abyss Dungeon census never chooses a region with no town to rise by - the sea above all; world226 on its branch); PIN MOVED: world232, FIELD BUGS 2026-10-19f GAUNTLET-PLATES (each Gauntlet plate said one by one; world224 on its branch, renumbered past world224 to world231 on main at the merges); PIN MOVED: world231, NAME-WORDS (net/nameFilter.js reads `prostitute` and `strangler` anywhere in a word); PIN MOVED: world230, OW-CHASE-RANGE (the chase words beside a traveller mark, bd and sr; world224, then world225, on its branch, renumbered past world224 to world229 of main at the merges); PIN MOVED: world229, WB14 (the Breach portents - the portents of a night on the fight and in its state, `pt`; its crossings by walkway, `xa`; GATE_BRAIN_V 6; the new arsenal, the Vanguard and the Sundering; world223, world224, world225, world226, world227, then world228, on its branch, renumbered past FOE-BOUNDS and GRANT-DOOR, LAYERED-GEAR and VOICE2, GAUNTLET-SLAIN, LORD-SHARES, PLAIN-SWEEP, and QL12 at the merges); PIN MOVED: world228, QL12 (the five questline titles join the vocabulary, net/identityToken.js TITLES; world222 on its branch, renumbered past GATE-DOOR, FOE-BOUNDS, LAYERED-GEAR and VOICE2, GAUNTLET-SLAIN, LORD-SHARES and PLAIN-SWEEP, world222 to world227, at the merges); PIN MOVED: world227, PLAIN-SWEEP (words only - the player-facing lines in the relay's bundle said plainly; world224 on its branch, renumbered past LAYERED-GEAR's world224, GAUNTLET-SLAIN's world225 and LORD-SHARES' world226 at the merges); PIN MOVED: world226, FIELD BUGS 2026-10-19e LORD-SHARES (a Spire lord is stood for the company on the plate of its hall and keeps what the fallen leave; world225 on its branch, renumbered past the world225 of GAUNTLET-SLAIN at the merge; no word on the wire changed); PIN MOVED: world225, GAUNTLET-SLAIN (a slain Gauntlet Caster silences its pillar); PIN MOVED: world224, LAYERED-GEAR and VOICE2 (validLook keeps a look's `lg`, the On foot Layered Gearing Skin; the voice pass's words in the relay's own text; world218 in the package, renumbered past world218-world223 at the merge); PIN MOVED: world223, FOE-BOUNDS and GRANT-DOOR (world219 on its branch, renumbered past the world219 to world222 of main at the merges; a tally says stats, the relay counts what no builder could give, a hello says its spawn grants, and a door asks for them); PIN MOVED: world222, GATE-DOOR and COURT-WATCH (a gate court and its copies admit GATE_HELLO_HZ_MAX hellos a second, a full court keeps its watchers; world218 on its branch, renumbered past GRANT2, EG-PERFECT and FIELD BUGS 2026-10-18d and 2026-10-18f at the merge); PIN MOVED: world221, FIELD BUGS 2026-10-18f (the strike rule one law on both ends, a woken lord said at once, each body with its radius beside its row; world219 on its branch, renumbered past EG-PERFECT and FIELD BUGS 2026-10-18d at the merge); PIN MOVED: world220, FIELD BUGS 2026-10-18d (TWIN-REKINDLE: a Sapper never feeds a fallen lord; BANNER-SHAFT: a shaft or a spell lands on a body of another storey through open air; DUEL-RING: a Challenge in the open said as one); PIN MOVED: world219, EG-PERFECT (the lords' blows fair and whole, spec law 10 THE BROKEN WAY, a fight hall's clocks awaiting its company, the closing's walk, the tube's clock, the voids, the toll's rooms); PIN MOVED: world218, GRANT2 (the spawn grant asked of a cell, minted and measured); PIN MOVED: world217, GROUND-GATE (a hello on an older ground refused in a ground room while groundGate is on); PIN MOVED: world215, SAFE (the chat safety arc and its audit - every chat line stamped, a new voice paced, the reviewer feed, the ban order that closes and refuses, the law door; world214 on its branch, renumbered past WIKIMAID at the merge); PIN MOVED: world214, WIKIMAID (the WikiMaid title, its glyph and the Lilac Warren join the token vocabulary); PIN MOVED: world213, EG-PLAY (the room of an Elite Breach - the hub opening it and calling its company, its halls and their director, its own fight, its receipts; world195 on its branch, renumbered past COATS1, CHAT-LANG, BAL8, SPAWN-REBIRTH, AUDIT ETHER-OW, PEER-ACTS, CHAT-TRADE, FIVE-ASKS, KG-SET, KG5, PVP-LOOT + QUEST-HOME, SERPENT5, ONE-BODY, INSTANCES, WEAPON-GLOW1, HUB-PULL + DO-ASK, TIDY2 and REZ-BLOODLINE + GRAVE-PARTY at the merges); PIN MOVED: world212, REZ-BLOODLINE + GRAVE-PARTY (FIELD BUGS 2026-10-16b; world211 on its branch, renumbered past the TIDY2 world211 of main at the merge - a party pose says a body fallen for good, `fg`, and a Resurrect at it is refused before the caster spends; a cell keeps the graves searched in it, the overworld ledger kind gr, so a party shares a headstone search; world208 on each branch, then world210 on this one, renumbered past main's INSTANCES world208, WEAPON-GLOW1 world209 and HUB-PULL + DO-ASK world210 at the merges); PIN MOVED: world211, TIDY2 (the relay files into feature folders - no behaviour moved; bible/01-Overview/Code-Map.md; world209 on its branch, renumbered past the WEAPON-GLOW1 world209 and the HUB-PULL + DO-ASK world210 of main at the merge); PIN MOVED: world210, HUB-PULL + DO-ASK (the bus never calls a shard - each shard polls its bus; the Worker asks a room reset before it ran once more; world208 then world209 on its branch, renumbered past the INSTANCES world208 and the WEAPON-GLOW1 world209 of main at the merges); PIN MOVED: world209, WEAPON-GLOW1 (a weapon in a hand carries its glow on the look, a word; world208 on its branch, renumbered past the INSTANCES world208 of main at the merge); PIN MOVED: world208, INSTANCES (an instance is a world room of its own - a dungeon whole or a building, its owner and epoch after it, admitted to its owner, staff and the party of its owner alone; world206 then world207 on its branch, renumbered past SERPENT5 and ONE-BODY at the merges); PIN MOVED: world207, ONE-BODY (FIELD BUGS 2026-10-15c - one body an account in a cell or a dungeon, the older socket closed as replaced; world206 on its branch, renumbered past the SERPENT5 world206 of main at the merge); PIN MOVED: world206, SERPENT5 (Coilbreaker and The Maelstrom join the token vocabulary; world205 on its branch, renumbered past PVP-LOOT + QUEST-HOME world205 of main at the merge); PIN MOVED: world205, PVP-LOOT + QUEST-HOME (the friend law is the law of the drop alone - the worn piece a killer picks is theirs whoever the guild or party of the fallen counts them; the hub fans a home the service signed as moved to every page online and holds its word for a page that joins after; world201 on each branch, one bump past FIVE-ASKS at the merge, world203 on the integration, renumbered past KG-SET world203 and KG5 world204 at the merge of main); PIN MOVED: world204, KG5 (the relay runs The King's Gambit - a gambit frame, four files more in the bundle; KG6: the gold table's stakes and a rated game's signed result; world203 on its branch, renumbered past FIVE-ASKS's world202 at the merge); PIN MOVED: world203, KG-SET (the Iliac catalog without its words, and nine cards more - Kings-Gambit.md section 10.3; world201 then world202 on its branch, renumbered past CHAT-TRADE's world201 and FIVE-ASKS's world202 at the merges); PIN MOVED: world202, FIVE-ASKS (the dungeon respawn half an hour, I Love Lamp a title the relay knows) - the Trade and LFG channels opened at world201 and stay open
  const online = rd('src/net/online.js');
  assert.match(online, /if \(primary\) this\.tradeChanOk = relaySupportsTradeChan\(relayV\);   \/\/ CHAT-TRADE/);
  assert.match(online, /this\.tradeChanOk = false;/);
});

test('CHAT-TRADE tabs: Trade and LFG ride rooms of their own and stand OFF the bar until joined - a player who never joins sees the bar as it was', () => {
  for (const [id, label] of [['trade', 'Trade'], ['lfg', 'LFG']]) {
    const tab = CHAT_TABS.find((t) => t.id === id);
    assert.deepEqual([tab.label, tab.room, tab.link, tab.hidden, tab.peekAll ?? false], [label, null, true, true, false], id);
  }
  assert.deepEqual(Object.fromEntries(Object.entries(OPT_CHANNELS).map(([k, v]) => [k, { ...v }])), {
    trade: { name: 'Trade', pref: 'chatTrade', room: CHAT_TRADE_ROOM },
    lfg: { name: 'LFG', pref: 'chatLfg', room: CHAT_LFG_ROOM },
  });
  const log = new ChatLog();
  assert.deepEqual(log.tabs.filter((t) => t.shown).map((t) => t.id), ['world', 'region', 'local'], 'the bar a new player sees');
  log.setShown('trade', true);
  assert.equal(log.select('trade'), true);
  log.setShown('trade', false);
  assert.equal(log.active, 'world', 'a tab left hands the front to the first still on the bar');
  assert.equal(PREF_DEFAULTS.chatTrade, false);
  assert.equal(PREF_DEFAULTS.chatLfg, false);
  for (const k of ['chatTrade', 'chatLfg']) assert.ok(ONLINE_PLAYERS_OWN_PREFS.includes(k), `${k}: the player's own online`);
  assert.ok(CHANNEL_COLOURS.trade && CHANNEL_COLOURS.lfg, 'a colour each');
});

test('CHAT-TRADE commands: /trade, /tr and /lfg say a line on their channel; /join and /leave name trade or lfg, any case, and nothing else; /help lists them', () => {
  assert.deepEqual(parseChatLine('/trade WTB iron ingots'), { kind: 'channel', tab: 'trade', text: 'WTB iron ingots', wrap: null });
  assert.deepEqual(parseChatLine('/tr WTS dwarven sword'), { kind: 'channel', tab: 'trade', text: 'WTS dwarven sword', wrap: null });
  assert.deepEqual(parseChatLine('/lfg 2 more for Privateer\'s Hold'), { kind: 'channel', tab: 'lfg', text: '2 more for Privateer\'s Hold', wrap: null });
  assert.deepEqual(parseChatLine('/trade'), { kind: 'empty', name: 'trade' });
  assert.deepEqual(parseChatLine('/lfg'), { kind: 'empty', name: 'lfg' });
  assert.deepEqual(parseChatLine('/join trade'), { kind: 'join', chan: 'trade' });
  assert.deepEqual(parseChatLine('/JOIN LFG'), { kind: 'join', chan: 'lfg' });
  assert.deepEqual(parseChatLine('/join #lfg'), { kind: 'join', chan: 'lfg' });
  assert.deepEqual(parseChatLine('/leave trade'), { kind: 'leave', chan: 'trade' });
  assert.deepEqual(parseChatLine('/join world'), { kind: 'join', chan: '' }, 'the World is never left');
  assert.deepEqual(parseChatLine('/join'), { kind: 'join', chan: '' });
  assert.deepEqual(JOIN_CHANNELS, ['trade', 'lfg']);
  assert.equal(badJoinText('join'), '/join takes trade or lfg: /join trade.');
  for (const id of JOIN_CHANNELS) assert.ok(CHANNEL_COMMANDS.some((c) => c.tab === id), id);
  assert.ok(HELP_LINES.includes('/trade or /tr <text> - to the Trade channel: buying, selling, swapping'));
  assert.ok(HELP_LINES.includes('/lfg <text> - to the LFG channel: looking for a group or more players'));
  assert.ok(HELP_LINES.some((l) => l.startsWith('/join trade, /join lfg')));
  assert.equal(notJoinedText('trade'), 'You are not in the Trade channel. /join trade joins it.');
  assert.equal(optJoinedText('lfg'), 'LFG channel joined. /leave lfg leaves it.');
  assert.equal(optLeftText('trade'), 'Trade channel left.');
  assert.equal(alreadyJoinedText('lfg'), 'You are already in the LFG channel. /leave lfg leaves it.', 'AUDIT CHAT-TRADE A5');
  assert.match(rd('src/scenes/world.js'), /note\(on \? alreadyJoinedText\(cmd\.chan\) : notJoinedText\(cmd\.chan\)\)/);
  assert.equal(optWaitText('lfg'), 'The LFG channel is still opening. Try again in a moment.');
  assert.ok(tradeChanOldText().includes('update'));
  assert.equal(optJoinedSayText('trade'), 'Trade channel joined. Press Enter to speak. /leave trade leaves it.');
  // L10N4: the new words are the text core's, READ WHEN SHOWN - a getter on the tab's hint and the /help rows, never a string
  // the boot's import froze in whatever language it found
  for (const id of JOIN_CHANNELS) assert.equal(typeof Object.getOwnPropertyDescriptor(CHAT_TABS.find((x) => x.id === id), 'hint').get, 'function', `${id}'s hint`);
  for (const id of JOIN_CHANNELS) assert.equal(typeof Object.getOwnPropertyDescriptor(CHANNEL_COMMANDS.find((c) => c.tab === id), 'help').get, 'function', `${id}'s help`);
  const rp = HELP_LINES.findIndex((l) => l.startsWith('/rp '));
  assert.equal(typeof Object.getOwnPropertyDescriptor(HELP_LINES, rp).get, 'function', '/rp\'s row');
  assert.ok(Object.isFrozen(HELP_LINES) && Array.isArray(HELP_LINES));
  assert.match(rd('src/net/siege/siegeSession.js'), /isBattleLeaveCommand = \(text\) => \/\^\\\/leave\$\/i\.test/, 'a bare /leave is still the battle\'s');
});

test('CHAT-TRADE host: each tab follows its choice - on the bar while joined, joined only past a relay that opens it, left when the choice is taken back; a line said to one not joined joins it and stays in the field', () => {
  const host = rd('src/scenes/world.js');
  assert.match(host, /const joined = optJoined\(id\);\n      chatLog\.setShown\(id, joined\);\n      const room = joined \? c\.room : null;/);
  assert.match(host, /if \(!room\) \{ chatLog\.setRoom\(id, null, null\); link\.leave\(\); continue; \}\n      if \(!chatLinks\.get\('world'\)\?\.tradeChanOk\) continue;\n      chatLog\.setRoom\(id, room, c\.name\);\n      link\.join\(room\);/);
  assert.match(host, /chatLangFrame\(\);   \/\/ CHAT-LANG[^\n]*\n    chatOptFrame\(\);   \/\/ CHAT-TRADE/);
  assert.equal((host.match(/return why\(optWhy\(tabId\) \?\? optWaitText\(tabId\)\);/g) ?? []).length, 2, 'the line\'s door and the roll\'s');
  assert.match(host, /if \(\(tabId === 'trade' \|\| tabId === 'lfg'\) && !tab\?\.room\) return optWhy\(tabId\);/, 'the strip says why');
  assert.deepEqual(Object.keys(OPT_CHANNELS), ['trade', 'lfg'], 'the host\'s doors name the same two');
  assert.match(host, /if \(cmd\.kind === 'join' \|\| cmd\.kind === 'leave'\) \{\n          if \(!cmd\.chan\) \{ note\(badJoinText\(cmd\.kind\)\); return false; \}/);
  assert.match(host, /const optSet = \(id, on, \{ say = false \} = \{\}\) => \{\n    const c = OPT_CHANNELS\[id\];\n    if \(!c \|\| !chatLog\) return;\n    setPref\(c\.pref, !!on\);\n    chatOptFrame\(\);/, 'one door: the choice kept, the frame moving the tab at once');
  assert.match(host, /if \(optJoined\(cmd\.chan\) === on\) \{[^\n]*\}[^\n]*\n          optSet\(cmd\.chan, on\);/, '/join and /leave through it');
  assert.match(host, /channels: \{ list: \(\) => Object\.entries\(OPT_CHANNELS\)\.map\(\(\[id, c\]\) => \(\{ id, name: c\.name, hint: chatLog\?\.tab\(id\)\?\.hint \?\? '', joined: optJoined\(id\) \}\)\), set: \(id, on\) => optSet\(id, on\) \},/, 'and the picker through it');
  assert.match(host, /if \(cmd\.kind === 'channel' && Object\.hasOwn\(OPT_CHANNELS, cmd\.tab\) && !optJoined\(cmd\.tab\)\) \{\n          optSet\(cmd\.tab, true, \{ say: true \}\);\n          return false;\n        \}/);
  const at = host.indexOf("if (cmd.kind === 'channel' && Object.hasOwn(OPT_CHANNELS");
  assert.ok(at > 0 && at < host.indexOf("if (cmd.kind === 'channel') return chatSend("), 'the join comes before the channel\'s own send');
  const menu = rd('src/ui/enhanced/enhancedMenu.js');
  assert.match(menu, /prefRow\('chatTrade', t\('menu\.chat\.trade', 'Trade channel'\),/);
  assert.match(menu, /prefRow\('chatLfg', t\('menu\.chat\.lfg', 'LFG channel'\),/);
});

test('CHAT-RP mark: /rp wraps the words in single asterisks, and a whole line so wrapped is roleplay - not bold, not a lone star, not a line that only starts with one', () => {
  assert.deepEqual(parseChatLine('/rp draws her blade'), { kind: 'rp', text: '*draws her blade*' });
  assert.deepEqual(parseChatLine('/RP *bows low*'), { kind: 'rp', text: '*bows low*' }, 'the marks typed are not doubled');
  assert.deepEqual(parseChatLine('/rp'), { kind: 'empty', name: 'rp' });
  assert.deepEqual(parseChatLine('/rp ***'), { kind: 'empty', name: 'rp' }, 'nothing but marks is nothing to say');
  assert.equal(rpText('  hums a tune  '), '*hums a tune*');
  assert.equal(rpText('*bows* deeply'), '*bows deeply*', 'AUDIT CHAT-TRADE A3: a mark inside the line goes - the whole line is the roleplay');
  assert.equal(parseChatLine('/rp *bows*   low').text, '*bows low*');
  for (const t of ['*draws her blade*', '*a*', ' *waves* ', '*x * y*']) assert.equal(isRpText(t), true, t);
  for (const t of ['**bold**', '* *', '*', '*sighs', 'hi *x*', '*x *', '((ooc))', '']) assert.equal(isRpText(t), false, t);
  assert.ok(HELP_LINES.includes('/rp <text> - a roleplay line on this tab, in green italics: /rp draws her blade'));
  assert.match(rd('src/scenes/world.js'), /if \(cmd\.kind === 'rp'\) return chatSend\(tabId, cmd\.text, tabId\);/, 'said on the tab it was typed on');
});

test('CHAT-RP line: the log draws a roleplay line as its own kind - read off the words, an action and an aside keep theirs, a line the game says is never one - and it stands over a head, being in character', () => {
  const log = new ChatLog({ now: () => 5 });
  const rp = log.push('local', { id: 'a', name: 'Ann', text: '*draws her blade*' });
  assert.equal(rp.kind, 'rp');
  assert.equal(log.push('world', { id: 'a', name: 'Ann', text: 'plain' }).kind, '');
  assert.equal(log.push('world', { id: 'a', name: 'Ann', text: '*waves*', me: true }).kind, 'me');
  assert.equal(log.push('world', { id: 'a', name: 'Ann', text: '((*brb*))' }).kind, 'ooc');
  assert.equal(log.push('world', { text: '*notice*', system: true }).kind, '');
  assert.equal(bubbleLineOk(rp), true);
});

test('CHAT-RP colour: green and leaning on every tab - the channel colours pass it by, it reads at 4.5:1 on Plus\'s box and on the Grimoire page, and over the world in the light green', () => {
  for (const tone of ['light', 'dark']) {
    assert.ok(contrast(RP_COLOURS[tone], CHAT_GROUNDS[tone]) >= 4.5, `${tone} ${RP_COLOURS[tone]}`);
    assert.ok(contrast(RP_COLOURS[tone], PING_GROUNDS[tone]) >= 4.4, `${tone} on the wash`);
  }
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(RP_COLOURS.light.slice(i, i + 2), 16));
  assert.ok(g > r && g > b, 'green');
  assert.notEqual(RP_COLOURS.light, CHANNEL_COLOURS.region.light, 'not the Region\'s');
  assert.ok(COLOURED_LINE.endsWith(':not(.rp)'));
  assert.ok(CHAT_CSS.includes(`.dfchat-line.rp .dfchat-text { font-style: italic; color: ${RP_COLOURS.light}; }`));
  assert.match(rd('src/ui/chatPanel.js'), /\$\{line\.kind === 'rp' \? ' rp' : ''\}/);
  assert.ok(GRIMOIRE_KIT_CSS.includes(`.dfchat-box .dfchat-line.rp .dfchat-text { color: ${RP_COLOURS.dark} !important; text-shadow: none !important; font-style: italic; }`));
  assert.ok(GRIMOIRE_KIT_CSS.includes(`.dfchat-peek .dfchat-line.rp .dfchat-text { color: ${RP_COLOURS.light} !important; }`));
});

// The panel headless - chatchan.test.js's fakes, the window's key listener kept so the field's Escape can be pressed.
function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', value: '', title: '', placeholder: '',
    style: {}, dataset: {}, attrs: {}, listeners: new Map(), scrollTop: 0, scrollHeight: 100, clientHeight: 100,
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = v; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    removeEventListener() {},
    fire(t, e = {}) { const ev = { type: t, target: n, preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {}, ...e }; for (const fn of n.listeners.get(t) ?? []) fn(ev); return ev; },
    focus() { doc.activeElement = n; }, blur() {},
    remove() { if (n.parent) { n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } },
  };
  return n;
}
function fakeDocument() {
  const doc = { activeElement: null };
  doc.createElement = (tag) => fakeNode(tag, doc);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  const byId = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const f = byId(c, id); if (f) return f; } return null; };
  doc.getElementById = (id) => byId(doc.head, id) ?? byId(doc.body, id);
  return doc;
}
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };
const one = (n, cls) => find(n, cls)[0];

test('CHAT-TRADE picker (Mac: "There must be a better way to handle the new channels instead of a text command"): a + beside the tabs opens the channels joined by choice, each with its mark; a click joins or leaves it through the host\'s door; Escape in the field and the panel\'s close take the list down; no + without the host\'s channels', () => {
  const plain = fakeDocument();
  createChatPanel({ log: new ChatLog(), onSend: () => true, action: () => null, doc: plain, win: { addEventListener() {}, removeEventListener() {} }, touch: false });
  assert.equal(find(plain.body, 'dfchat-chan-add').length, 0, 'no channels from the host: no +');

  const doc = fakeDocument();
  const keys = [];
  const win = { addEventListener: (t, fn) => { if (t === 'keydown') keys.push(fn); }, removeEventListener() {} };
  const joined = { trade: false, lfg: true };
  const sets = [];
  const log = new ChatLog();
  const panel = createChatPanel({ log, onSend: () => true, action: () => null, doc, win, touch: false, social: { onToggle() {}, pending: () => 0 },
    channels: { list: () => [{ id: 'trade', name: 'Trade', hint: 'buy, sell', joined: joined.trade }, { id: 'lfg', name: 'LFG', hint: 'groups', joined: joined.lfg }], set: (id, on) => { sets.push([id, on]); joined[id] = on; } } });
  const root = doc.body.children[0];
  const bar = one(root, 'dfchat-tabs');
  const add = one(bar, 'dfchat-chan-add'), menu = one(bar, 'dfchat-chans');
  assert.deepEqual(bar.children.map((c) => c.className.split(' ')[0]), ['dfchat-tablist', 'dfchat-chan-add', 'dfchat-chans', 'dfchat-social'], 'beside the tabs, before Social - one glyph, no tab');
  assert.equal(add.textContent, '+');
  assert.deepEqual([add.attrs['aria-label'], add.attrs['aria-haspopup'], add.attrs['aria-expanded'], menu.attrs.role], ['Channels', undefined, 'false', 'group'], 'AUDIT CHAT-TRADE A2: a group of toggle buttons, as the emoji grid - no menu claimed whose keys it lacks');
  assert.equal(menu.className, 'dfchat-chans', 'shut');
  panel.open();
  add.fire('click');
  assert.equal(menu.className, 'dfchat-chans on');
  assert.equal(add.attrs['aria-expanded'], 'true');
  const rows = () => find(menu, 'dfchat-chan-row').map((r) => [r.dataset.chan, r.attrs['aria-pressed'], one(r, 'dfchat-chan-mark').textContent, one(r, 'dfchat-chan-name').textContent, one(r, 'dfchat-chan-hint').textContent]);
  assert.deepEqual(rows(), [['trade', 'false', '', 'Trade', 'buy, sell'], ['lfg', 'true', '\u2713', 'LFG', 'groups']]);
  find(menu, 'dfchat-chan-row')[0].fire('click');
  assert.deepEqual(sets, [['trade', true]], 'joined through the host');
  assert.deepEqual(rows().map((r) => r[1]), ['true', 'true'], 'and marked at once, the list still open');
  find(menu, 'dfchat-chan-row')[1].fire('click');
  assert.deepEqual(sets, [['trade', true], ['lfg', false]], 'and left');
  const input = one(root, 'dfchat-input');
  assert.equal(doc.activeElement, input, 'the caret back in the field');
  const esc = () => { for (const fn of keys) fn({ target: input, code: 'Escape', preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {} }); };
  esc();
  assert.equal(menu.className, 'dfchat-chans', 'Escape takes the list down first');
  assert.equal(log.open, true, '...and leaves the chat open');
  add.fire('click');
  esc();
  esc();
  assert.equal(log.open, false, 'the next Escape closes the chat');
  panel.open(); add.fire('click');
  one(root, 'dfchat-close').fire('click');
  assert.equal(menu.className, 'dfchat-chans', 'the panel\'s close takes the list with it');
  assert.ok(CHAT_CSS.includes('.dfchat-chans.on { display: flex; }'));
});
