// CHAT-LANG + CHAT-COLOURS + PING1 + NAME-INK (2026-10-11). The players: "More chat channels per-language", "Chat
// color-coding per channel (i.e. White for Global, Green for Regional, Purple for Guild, Grey for Local)", "A unique
// color or alert for @name pings"; Mac: "the color was the problem not the font", "make sure the colors are all good
// readable".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHANNEL_COLOURS, NAME_COLOURS, PING_COLOURS, CHAT_GROUNDS, PING_GROUNDS, contrast, channelRules, pipRules } from '../../src/ui/chatColours.js';
import { CHAT_TABS, ChatLog, mentions, langJoinedText, NO_LANG_TEXT, LANG_OLD_RELAY_TEXT } from '../../src/net/chat.js';
import { CHAT_LANGS, CHAT_LANG_PREFIX, chatLangRoom, isChatRoom, isRegionRoom, relaySupportsLang, LANG_RELAY_MIN, RELAY_VERSION } from '../../src/net/wire.js';
import { parseChatLine, CHANNEL_COMMANDS, HELP_LINES, LANG_LINES, unknownLangText } from '../../src/net/chatCommands.js';
import { PREF_DEFAULTS } from '../../src/systems/uiPrefs.js';
import { ONLINE_PLAYERS_OWN_PREFS } from '../../src/systems/online/onlineLane.js';
import { CHAT_CSS } from '../../src/ui/chatPanel.js';
import { GRIMOIRE_KIT_CSS } from '../../src/ui/grimoireDress.js';

const rd = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');

test('CHAT-COLOURS readable: every channel\'s, name\'s and mention\'s colour reads at 4.5:1 or better on its own ground - the darkest each can be - and on the mention\'s wash', () => {
  for (const tone of ['light', 'dark']) {
    for (const [k, c] of [...Object.entries(CHANNEL_COLOURS), ...Object.entries(NAME_COLOURS).map(([n, v]) => [`name.${n}`, v]), ['mention', PING_COLOURS.mention]]) {
      assert.ok(contrast(c[tone], CHAT_GROUNDS[tone]) >= 4.5, `${k} ${tone} ${c[tone]} on ${CHAT_GROUNDS[tone]}: ${contrast(c[tone], CHAT_GROUNDS[tone]).toFixed(2)}`);
      assert.ok(contrast(c[tone], PING_GROUNDS[tone]) >= 4.4, `${k} ${tone} ${c[tone]} on the wash ${PING_GROUNDS[tone]}: ${contrast(c[tone], PING_GROUNDS[tone]).toFixed(2)}`);
    }
  }
  assert.ok(contrast('#000000', '#ffffff') > 20.9 && Math.abs(contrast('#777777', '#ffffff') - 4.48) < 0.01, 'the measure is WCAG\'s');
});

test('CHAT-COLOURS hues: the four the players named keep their colours, every channel has one, and a name is never its words\' colour', () => {
  assert.deepEqual(Object.keys(CHANNEL_COLOURS).sort(), CHAT_TABS.map((t) => t.id).sort(), 'one colour a tab');
  const hue = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx - mn < 0.08) return null; const d = mx - mn; const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };
  assert.equal(hue(CHANNEL_COLOURS.world.light), null, 'World white');
  assert.ok(Math.abs(hue(CHANNEL_COLOURS.region.light) - 120) < 20, 'Region green');
  assert.ok(Math.abs(hue(CHANNEL_COLOURS.guild.light) - 265) < 25, 'Guild purple');
  assert.ok(hue(CHANNEL_COLOURS.local.light) === null || contrast(CHANNEL_COLOURS.local.light, '#b9b3a7') < 1.2, 'Local grey');
  for (const tone of ['light', 'dark']) {
    const words = Object.values(CHANNEL_COLOURS).map((c) => c[tone]);
    assert.equal(new Set(words).size, words.length, `${tone}: no two channels share a colour`);
    for (const n of ['other', 'mine']) assert.ok(!words.includes(NAME_COLOURS[n][tone]), `${tone}: a ${n} name is not any channel's words`);
  }
});

test('CHAT-COLOURS sheets: Plus colours a plain line\'s words by its channel under the switch, the kinds keep theirs; Grimoire writes the page\'s pair over its ink, the light pair over the world, the chat on the cream page', () => {
  const rule = channelRules('.x', 'light');
  assert.match(rule, /\.x \.dfchat-line\[data-ch="region"\]:not\(\.system\):not\(\.red\):not\(\.dm\):not\(\.ooc\):not\(\.me\):not\(\.roll\):not\(\.rp\) \.dfchat-text \{ color: #8fe28f; \}/);   // PIN MOVED: CHAT-RP - a line of roleplay keeps its own green
  assert.ok(CHAT_CSS.includes(channelRules('.dfchat[data-colours="on"]', 'light')));
  assert.ok(CHAT_CSS.includes(pipRules('.dfchat[data-colours="on"]', 'light')));
  assert.match(CHAT_CSS, /\.dfchat-name \{ color: #f4b86c; font-weight: 600; \}/, 'NAME-INK: a stranger\'s name in its brass, never the bone of the words');
  assert.match(GRIMOIRE_KIT_CSS, /\.dfchat-box :is\(\.dfchat-name, \.dfchat-who-name\) \{ color: #7a170c !important; filter: none !important; \}/, 'on the page the page\'s red - no longer deepened into the ink');
  assert.match(GRIMOIRE_KIT_CSS, /\[style\*="115, 255, 115"\] \{ color: #0c491d !important;/, 'a party member\'s green, deepened by hand');
  assert.match(GRIMOIRE_KIT_CSS, /\[style\*="143, 208, 255"\] \{ color: #153d7c !important;/, 'a friend\'s blue');
  assert.match(GRIMOIRE_KIT_CSS, /body \.dfchat-box \{ background: var\(--grim-page/, 'the cream page');
  assert.ok(GRIMOIRE_KIT_CSS.includes(channelRules(':root[data-plus-dress="grimoire"] body .dfchat[data-colours="on"] .dfchat-box', 'dark', true)));
  assert.ok(GRIMOIRE_KIT_CSS.includes(channelRules(':root[data-plus-dress="grimoire"] body .dfchat[data-colours="on"] .dfchat-peek', 'light', true)));
  assert.match(rd('src/ui/chatPanel.js'), /root\.dataset\.colours = getPref\('chatChannelColours'\) === false \? 'off' : 'on';/);
  assert.match(rd('src/ui/chatPanel.js'), /if \(line\.tab\) n\.dataset\.ch = line\.tab;/);
});

test('PING1 mentions: @ and the whole name, any case, not run on into a longer word or out of an address; a one-letter name pings nobody', () => {
  assert.equal(mentions('hey @Bran look', 'Bran'), true);
  assert.equal(mentions('@bran!', 'Bran'), true);
  assert.equal(mentions('(@Bran)', 'Bran'), true);
  assert.equal(mentions('@Bran the Bold, here', 'Bran the Bold'), true);
  assert.equal(mentions('@Änne', 'Änne'), true);
  assert.equal(mentions('@Brandon hi', 'Bran'), false);
  assert.equal(mentions('mail@Bran', 'Bran'), false);
  assert.equal(mentions('Bran, hi', 'Bran'), false, 'an @ is the ask');
  assert.equal(mentions('@B', 'B'), false);
  assert.equal(mentions('@a.b', 'a.b'), true, 'a name is a literal, never a pattern');
  assert.equal(mentions('@axb', 'a.b'), false);
});

test('PING1 log: a line naming me is marked and counted on its tab until read, my own and the game\'s never; it stands over the world from any tab; the newest one\'s seq moves for the chime', () => {
  const log = new ChatLog({ now: () => 1000 });
  log.self = 'Bran';
  const a = log.push('region', { id: 'a', name: 'Ann', text: '@Bran come' });
  assert.equal(a.ping, true);
  assert.equal(log.pingSeq, a.seq);
  assert.equal(log.tab('region').pings, 1);
  assert.equal(log.pingTotal(), 1);
  assert.equal(log.push('world', { id: 'me', name: 'Bran', text: '@Bran talking to myself', mine: true }).ping, undefined, 'my own line');
  assert.equal(log.push('world', { text: '@Bran system', system: true }).ping, undefined, 'the game\'s');
  assert.equal(log.push('world', { id: 'c', name: 'C', text: 'no mention' }).ping, undefined);
  const peeked = log.peek().map((p) => p.line);
  assert.ok(peeked.includes(a), 'from the Region tab while the World is read');
  assert.ok(!peeked.some((l) => l.tab === 'region' && l !== a), 'the Region tab\'s other lines wait on its dot');
  log.setOpen(true); log.select('region');
  assert.equal(log.tab('region').pings, 0, 'read');
  log.push('region', { id: 'a', name: 'Ann', text: '@bran again' });
  assert.equal(log.tab('region').pings, 0, 'read as it arrives on the open tab');
  assert.ok(log.pingSeq > a.seq, 'and still chimed');
  const host = rd('src/scenes/world.js');
  assert.match(host, /chatLog\.self = online\?\.name \?\? '';/);
  assert.match(host, /if \(getPref\('chatPingSound'\) === false \|\| now - _pingRangAt < 2500\) return;/);
  assert.match(host, /audio\.playOneShot\(SOUND\.MakeItem, 0\.6\);/);
});

test('CHAT-LANG wire: one channel per language, keyed by its code under its own prefix, whitelisted, no region; the relay that opens them is world196 and the version moved', () => {
  assert.equal(Object.keys(CHAT_LANGS).length, 15);
  assert.equal(CHAT_LANGS.de, 'Deutsch');
  assert.equal(chatLangRoom('de'), `${CHAT_LANG_PREFIX}de`);
  assert.equal(chatLangRoom('xx'), null);
  assert.equal(chatLangRoom('toString'), null);
  for (const code of Object.keys(CHAT_LANGS)) { assert.ok(isChatRoom(chatLangRoom(code)), code); assert.ok(!isRegionRoom(chatLangRoom(code)), code); }
  assert.equal(isChatRoom('chat:lang.xx'), false);
  assert.equal(LANG_RELAY_MIN, 196);   // world192 on its branch, renumbered past main's world192-world195 at the port
  assert.equal(relaySupportsLang('world195'), false);
  assert.equal(relaySupportsLang('world196'), true);
  assert.equal(RELAY_VERSION, 'world240');   // PIN MOVED: world240, GUILD-CAP (a guild holds 75 - net/guild/guildLaw.js GUILD_MEMBERS_MAX - and the who-of-my-guild list of the hub 100, net/hubShards.js HUB_GUILD_WHO_MAX, both in the bundle of the relay); PIN MOVED: world239, FIELD BUGS 2026-10-21c FOES-FIRST (a foes room spends its budget on full frames first - a delta keeps a reserve, a full frame may borrow a bounded debt, each sender one first a second and its next frame first once unheard four seconds - and counts the blows its hit funnels drop, HIT-DROPS); PIN MOVED: world237, FIELD BUGS 2026-10-20f (an Elite Breach room tells a striker what each blow landed, eland, and a member at the door why it will not take them, efair; the fair trail sees a member standing still - egStillGap; a held lord answers what it lost; world236 on its branch, renumbered past the LONE-HERALD world236 at the merge); PIN MOVED: world236, FIELD BUGS 2026-10-20d LONE-HERALD (the herald news of a Valkynaz Redoubt carries the size of its company and an entrant to lead it, so a company of one is posted alone; world235 on its branch, renumbered past the Witches Festival and the Starfall world235 at the merge); PIN MOVED: world235, WITCH1 (the Witches Festival words in the token - two titles, an aura, a profile icon pi, the festival cards) and STAR3 (the Starfall: a word at a fallen star, the ledger and receipts its cell keeps, the held stars the hub keeps; world233 on its branch, renumbered past world233 (SD-SEA) and world234 (DEX1) at the merge), one release; PIN MOVED: world234, DEX1 (a foe kind on the wire is a u16, FOE_TYPE_MAX, so the enemy mod 256-398 cross; the enemy table in the relay graph takes a mod rows, customEnemies.js joining it; world225 on its branch, renumbered past the world225-world233 of main at the merges); PIN MOVED: world233, SD-SEA (the Abyss Dungeon census never chooses a region with no town to rise by - the sea above all; world226 on its branch); PIN MOVED: world232, FIELD BUGS 2026-10-19f GAUNTLET-PLATES (each Gauntlet plate said one by one; world224 on its branch, renumbered past world224 to world231 on main at the merges); PIN MOVED: world231, NAME-WORDS (net/nameFilter.js reads `prostitute` and `strangler` anywhere in a word); PIN MOVED: world230, OW-CHASE-RANGE (the chase words beside a traveller mark, bd and sr; world224, then world225, on its branch, renumbered past world224 to world229 of main at the merges); PIN MOVED: world229, WB14 (the Breach portents - the portents of a night on the fight and in its state, `pt`; its crossings by walkway, `xa`; GATE_BRAIN_V 6; the new arsenal, the Vanguard and the Sundering; world223, world224, world225, world226, world227, then world228, on its branch, renumbered past FOE-BOUNDS and GRANT-DOOR, LAYERED-GEAR and VOICE2, GAUNTLET-SLAIN, LORD-SHARES, PLAIN-SWEEP, and QL12 at the merges); PIN MOVED: world228, QL12 (the five questline titles join the vocabulary, net/identityToken.js TITLES; world222 on its branch, renumbered past GATE-DOOR, FOE-BOUNDS, LAYERED-GEAR and VOICE2, GAUNTLET-SLAIN, LORD-SHARES and PLAIN-SWEEP, world222 to world227, at the merges); PIN MOVED: world227, PLAIN-SWEEP (words only - the player-facing lines in the relay's bundle said plainly; world224 on its branch, renumbered past LAYERED-GEAR's world224, GAUNTLET-SLAIN's world225 and LORD-SHARES' world226 at the merges); PIN MOVED: world226, FIELD BUGS 2026-10-19e LORD-SHARES (a Spire lord is stood for the company on the plate of its hall and keeps what the fallen leave; world225 on its branch, renumbered past the world225 of GAUNTLET-SLAIN at the merge; no word on the wire changed); PIN MOVED: world225, GAUNTLET-SLAIN (a slain Gauntlet Caster silences its pillar); PIN MOVED: world224, LAYERED-GEAR and VOICE2 (validLook keeps a look's `lg`, the On foot Layered Gearing Skin; the voice pass's words in the relay's own text; world218 in the package, renumbered past world218-world223 at the merge); PIN MOVED: world223, FOE-BOUNDS and GRANT-DOOR (world219 on its branch, renumbered past the world219 to world222 of main at the merges; a tally says stats, the relay counts what no builder could give, a hello says its spawn grants, and a door asks for them); PIN MOVED: world222, GATE-DOOR and COURT-WATCH (a gate court and its copies admit GATE_HELLO_HZ_MAX hellos a second, a full court keeps its watchers; world218 on its branch, renumbered past GRANT2, EG-PERFECT and FIELD BUGS 2026-10-18d and 2026-10-18f at the merge); PIN MOVED: world221, FIELD BUGS 2026-10-18f (the strike rule one law on both ends, a woken lord said at once, each body with its radius beside its row; world219 on its branch, renumbered past EG-PERFECT and FIELD BUGS 2026-10-18d at the merge); PIN MOVED: world220, FIELD BUGS 2026-10-18d (TWIN-REKINDLE: a Sapper never feeds a fallen lord; BANNER-SHAFT: a shaft or a spell lands on a body of another storey through open air; DUEL-RING: a Challenge in the open said as one); PIN MOVED: world219, EG-PERFECT (the lords' blows fair and whole, spec law 10 THE BROKEN WAY, a fight hall's clocks awaiting its company, the closing's walk, the tube's clock, the voids, the toll's rooms); PIN MOVED: world218, GRANT2 (the spawn grant asked of a cell, minted and measured); PIN MOVED: world217, GROUND-GATE (a hello on an older ground refused in a ground room while groundGate is on); PIN MOVED: world215, SAFE (the chat safety arc and its audit - every chat line stamped, a new voice paced, the reviewer feed, the ban order that closes and refuses, the law door; world214 on its branch, renumbered past WIKIMAID at the merge); PIN MOVED: world214, WIKIMAID (the WikiMaid title, its glyph and the Lilac Warren join the token vocabulary); PIN MOVED: world213, EG-PLAY (the room of an Elite Breach - the hub opening it and calling its company, its halls and their director, its own fight, its receipts; world195 on its branch, renumbered past COATS1, CHAT-LANG, BAL8, SPAWN-REBIRTH, AUDIT ETHER-OW, PEER-ACTS, CHAT-TRADE, FIVE-ASKS, KG-SET, KG5, PVP-LOOT + QUEST-HOME, SERPENT5, ONE-BODY, INSTANCES, WEAPON-GLOW1, HUB-PULL + DO-ASK, TIDY2 and REZ-BLOODLINE + GRAVE-PARTY at the merges); PIN MOVED: world212, REZ-BLOODLINE + GRAVE-PARTY (FIELD BUGS 2026-10-16b; world211 on its branch, renumbered past the TIDY2 world211 of main at the merge - a party pose says a body fallen for good, `fg`, and a Resurrect at it is refused before the caster spends; a cell keeps the graves searched in it, the overworld ledger kind gr, so a party shares a headstone search; world208 on each branch, then world210 on this one, renumbered past main's INSTANCES world208, WEAPON-GLOW1 world209 and HUB-PULL + DO-ASK world210 at the merges); PIN MOVED: world211, TIDY2 (the relay files into feature folders - no behaviour moved; bible/01-Overview/Code-Map.md; world209 on its branch, renumbered past the WEAPON-GLOW1 world209 and the HUB-PULL + DO-ASK world210 of main at the merge); PIN MOVED: world210, HUB-PULL + DO-ASK (the bus never calls a shard - each shard polls its bus; the Worker asks a room reset before it ran once more; world208 then world209 on its branch, renumbered past the INSTANCES world208 and the WEAPON-GLOW1 world209 of main at the merges); PIN MOVED: world209, WEAPON-GLOW1 (a weapon in a hand carries its glow on the look, a word; world208 on its branch, renumbered past the INSTANCES world208 of main at the merge); PIN MOVED: world208, INSTANCES (an instance is a world room of its own - a dungeon whole or a building, its owner and epoch after it, admitted to its owner, staff and the party of its owner alone; world206 then world207 on its branch, renumbered past SERPENT5 and ONE-BODY at the merges); PIN MOVED: world207, ONE-BODY (FIELD BUGS 2026-10-15c - one body an account in a cell or a dungeon, the older socket closed as replaced; world206 on its branch, renumbered past the SERPENT5 world206 of main at the merge); PIN MOVED: world206, SERPENT5 (Coilbreaker and The Maelstrom join the token vocabulary; world205 on its branch, renumbered past PVP-LOOT + QUEST-HOME world205 of main at the merge); PIN MOVED: world205, PVP-LOOT + QUEST-HOME (the friend law is the law of the drop alone - the worn piece a killer picks is theirs whoever the guild or party of the fallen counts them; the hub fans a home the service signed as moved to every page online and holds its word for a page that joins after; bible/01-Overview/bugs/Field-Bugs-2026-10-14.md QUEST-HOME; world201 on each branch, one bump past FIVE-ASKS at the merge, world203 on the integration, renumbered past KG-SET world203 and KG5 world204 at the merge of main); PIN MOVED: world204, KG5 (the relay runs The King's Gambit - a gambit frame, four files more in the bundle; KG6: the gold table's stakes and a rated game's signed result; world203 on its branch, renumbered past FIVE-ASKS's world202 at the merge); PIN MOVED: world203, KG-SET (the Iliac catalog without its words, and nine cards more - Kings-Gambit.md section 10.3; world201 then world202 on its branch, renumbered past CHAT-TRADE's world201 and FIVE-ASKS's world202 at the merges); PIN MOVED: world202, FIVE-ASKS (the dungeon respawn half an hour, I Love Lamp a title the relay knows; world201 on its branch, renumbered past the CHAT-TRADE world201 of main at the merge); PIN MOVED: world201, CHAT-TRADE (the Trade and LFG channels, `chat:trade` and `chat:lfg`, joined CHAT_ROOMS); PIN MOVED: world200, PEER-ACTS (the pose carries a gathering act - the act, its beats and the throw of the net; world199 on its branch, renumbered past the AUDIT ETHER-OW world199 of main at the merge); PIN MOVED: world199, AUDIT ETHER-OW C2-1 (one home for the ground the Watch mints on - watchPixelOk, its answers as they were); PIN MOVED: world198, SPAWN-REBIRTH (a cell keeps the row of a spawned dungeon until it stands again, never sixty real days); PIN MOVED: world197, BAL8 (the PvP referee and its one harm ceiling) over world196, CHAT-LANG
  assert.match(rd('src/net/online.js'), /if \(primary\) this\.langOk = relaySupportsLang\(relayV\);/);
});

test('CHAT-LANG tab and commands: the Language tab rides a room of its own, off the bar until chosen; /lang lists, chooses and leaves; /lc says a line on it', () => {
  const tab = CHAT_TABS.find((t) => t.id === 'lang');
  assert.deepEqual([tab.label, tab.room, tab.link, tab.hidden], ['Lang', null, true, true]);
  assert.equal(PREF_DEFAULTS.chatLang, '');
  assert.equal(PREF_DEFAULTS.chatChannelColours, true);
  assert.equal(PREF_DEFAULTS.chatPingSound, true);
  for (const k of ['chatChannelColours', 'chatPingSound']) assert.ok(ONLINE_PLAYERS_OWN_PREFS.includes(k), `${k}: the player's own online`);
  assert.deepEqual(parseChatLine('/lang'), { kind: 'lang', code: '' });
  assert.deepEqual(parseChatLine('/lang DE'), { kind: 'lang', code: 'de' });
  assert.deepEqual(parseChatLine('/lang off'), { kind: 'lang', code: 'off' });
  assert.deepEqual(parseChatLine('/lc hallo zusammen'), { kind: 'channel', tab: 'lang', text: 'hallo zusammen', wrap: null });
  assert.ok(CHANNEL_COMMANDS.some((c) => c.tab === 'lang'));
  assert.ok(HELP_LINES.some((l) => l.startsWith('/lang de')));
  assert.match(LANG_LINES[1], /^en English · de Deutsch/);
  assert.equal(unknownLangText('xx'), 'There is no "xx" language channel. /lang lists them.');
  assert.equal(langJoinedText('Deutsch'), 'Language channel: Deutsch.');
  assert.ok(NO_LANG_TEXT.includes('/lang') && LANG_OLD_RELAY_TEXT.includes('update'));
  const host = rd('src/scenes/world.js');
  assert.match(host, /if \(!chatLinks\.get\('world'\)\?\.langOk\) return;\n    chatLog\.setRoom\('lang', room, CHAT_LANGS\[code\]\);\n    link\.join\(room\);/, 'joined only past a relay that opens it');
  assert.match(host, /if \(!room\) \{ chatLog\.setRoom\('lang', null, null\); link\.leave\(\); return; \}/, 'and left when the choice is taken back');
  assert.match(host, /chatLangFrame\(\);   \/\/ CHAT-LANG/);
  assert.match(host, /if \(tabId === 'lang' && !chatLog\.tab\('lang'\)\?\.room\) return why\(langOld\(\) \? LANG_OLD_RELAY_TEXT : NO_LANG_TEXT\);/);
  const menu = rd('src/ui/enhanced/enhancedMenu.js');
  assert.match(menu, /choiceRow\('chatLang', t\('menu\.chat\.lang', 'Language channel'\),/);
  assert.match(menu, /prefRow\('chatChannelColours', t\('menu\.chat\.colours', 'Chat colors by channel'\),/);
  assert.match(menu, /prefRow\('chatPingSound', t\('menu\.chat\.ping', 'Chime when someone @mentions you'\),/);
});
