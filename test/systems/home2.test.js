// HOME2 (2026-09-25, Mac: "We need to ensure any house can be bought"; offered the door's offer on any click but Steal
// and House5/House6 counted as houses - "Recommended + should use our tooltip implementation"): ANY HOUSE, BOUGHT AT
// ITS DOOR THROUGH THE DOOR'S OWN TOOLTIP. HOME1 offered a house to a click in Info mode alone, so a player walking in
// Grab or Talk never met the offer. Now every house type is a house (a guild's hideout aside); the door's plaque lists
// its verbs - "Go in" lit, "Buy it" (two presses), or at my own home "Who may enter" and "Sell it" - as ACT-MENU lists a
// player's; where the plaque lists none (a touch screen, World Tooltips off) the click offers, once a house a session.
// And the account deploy's smoke asks a new route again when an old instance answers it 404 mid-rollout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { BUILDING_TYPES } from '../../src/world/buildingNames.js';
import {
  homeCandidate, homeBuyRows, homeOwnerRows, homeNextEntry, HOME_BUY_ARM_MS, HOME_VERB, HOME_OFFER_BUY, HOME_OFFER_PASS,
} from '../../src/systems/online/onlineHomes.js';
import { resolveHover, nextSelection } from '../../src/systems/worldHover.js';
import { foldQuickLoot, quickLootWheel, plaqueActionFor, resetQuickLoot } from '../../src/systems/quickLoot.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('HOME2 the law: every house type is a house - House1-6 and the for-sale house - never a guild\'s House2 or a shop; the buy rows go in first and buy second, the buy reading "Click again" once armed; my home\'s rows go in, name who may enter and sell; a press on who may enter moves it round (mutants: House5 or House6 left out; a guild\'s hideout for sale; the buy row first; the arm unsaid; the entry stuck)', () => {
  const b = (buildingType, extra = {}) => ({ buildingType, buildingKey: 0x10203, factionId: 0, ...extra });
  for (const t of [BUILDING_TYPES.HouseForSale, BUILDING_TYPES.House1, BUILDING_TYPES.House2, BUILDING_TYPES.House3, BUILDING_TYPES.House4, BUILDING_TYPES.House5, BUILDING_TYPES.House6]) {
    assert.equal(homeCandidate(b(t)), true, `type ${t}`);
  }
  assert.equal(homeCandidate(b(BUILDING_TYPES.House2, { factionId: 42 })), false, 'a guild\'s hideout, sold to one player, would shut the guild out');
  for (const t of [BUILDING_TYPES.Tavern, BUILDING_TYPES.Bank, BUILDING_TYPES.Palace, BUILDING_TYPES.GuildHall, BUILDING_TYPES.Temple, BUILDING_TYPES.Town23, BUILDING_TYPES.Ship]) {
    assert.equal(homeCandidate(b(t)), false, `type ${t}`);
  }
  assert.deepEqual(HOME_VERB, { enter: 'home-enter', buy: 'home-buy', entry: 'home-entry', sell: 'home-sell', give: 'home-give', take: 'home-take', refuse: 'home-refuse', rent: 'home-rent' });   // HOME-RENT: and a room rented at the door; a house offered to one account
  assert.deepEqual(homeBuyRows(1234), [{ id: 'home-enter', label: 'Go in' }, { id: 'home-buy', label: 'Buy it: 1,234 gold' }], 'a plain click is still a plain click');   // HOME-PRICE: the thousands
  assert.deepEqual(homeBuyRows(1234, true)[1], { id: 'home-buy', label: 'Click again to buy: 1,234 gold' });
  assert.equal(HOME_BUY_ARM_MS, 5000);
  assert.deepEqual(homeOwnerRows('party'), [{ id: 'home-enter', label: 'Go in' }, { id: 'home-entry', label: 'Who may enter: My party' }, { id: 'home-sell', label: 'Sell it' }, { id: 'home-give', label: 'Transfer Ownership' }]);
  assert.equal(homeOwnerRows('nonsense')[1].label, 'Who may enter: Only me', 'an entry this build does not know reads as the default');
  assert.deepEqual(['private', 'party', 'public', 'guild'].map(homeNextEntry), ['party', 'public', 'guild', 'private']);   // GUILD1d (re-aimed by content): and the owner's guild, before round again
  assert.equal(homeNextEntry(undefined), 'party', 'no entry is the default, and moves on from it');
  assert.deepEqual([HOME_OFFER_BUY, HOME_OFFER_PASS], ['Y - buy it', 'N - just go in']);
});

test('HOME2 the plaque: a door naming its verbs is an actions frame - "Go in" lit first, the wheel lighting "Buy it", and the lit row keeping its place when its words change (the arm); the press reads the lit verb for THAT door alone (mutants: the verbs dropped from the frame; the wheel moving nothing)', () => {
  resetQuickLoot();
  try {
    const name = (armed) => () => ({ title: 'House', subs: [], actions: homeBuyRows(900, armed) });
    const hit = { key: 7, distance: 1, reach: 3 };
    const f = resolveHover(hit, { name: name(false) });
    assert.equal(f.kind, 'actions');
    assert.deepEqual(f.rows.map((r) => r.name), ['Go in', 'Buy it: 900 gold']);
    assert.equal(nextSelection(null, f).id, 'home-enter', 'a new door lights "Go in"');
    foldQuickLoot(f);
    assert.equal(plaqueActionFor(7), 'home-enter');
    assert.equal(plaqueActionFor(8), null, 'another door\'s press reads nothing the plaque lit');
    assert.equal(quickLootWheel(120), true, 'two verbs: the wheel is the plaque\'s');
    foldQuickLoot(f);
    assert.equal(plaqueActionFor(7), 'home-buy');
    // the first press arms the row: its words change, and the lit row is still the buy
    foldQuickLoot(resolveHover(hit, { name: name(true) }));
    assert.equal(plaqueActionFor(7), 'home-buy', 'the arm keeps its row lit');
  } finally { resetQuickLoot(); }
});

test('HOME2 the door, by source: the verbs listed in every mode but Steal and only online, my home\'s or a house\'s I could buy, the price then the buy row\'s and not a line; the door\'s cache minds the mode and the arm; the click carries the lit verb, read against the door as it stands; the buy arms then buys; who may enter moves round through the service; where no verbs were listed the click offers - my home\'s menu in Info, a house\'s once a session, always in Info (mutants: verbs in Steal; the cache blind to the arm; the verb unpassed; one press buying; the fallback asking every click)', () => {
  const m = src('src/scenes/worldModes.js');
  assert.match(m, /import \{ quickLootTake, quickLootSpend, plaqueActionFor \} from '\.\.\/systems\/quickLoot\.js';/);   // AUDIT WB9 (spoils F2): the spoil's press spends the armed key
  // the namer
  assert.match(m, /const verbsSig = homeVerbsSig\(\);\n\s*if \(_doorTextKey === key && _doorTextGen === gen && _doorTextHomes === homesV && _doorTextVerbs === verbsSig\) return _doorText;/);
  assert.match(m, /const houseVerbs = homeDoorVerbs\(bd, home\);\n[\s\S]{0,1500}?const verbs = _doorText \? houseVerbs : null;\n\s*const homeLine = verbs \? null : home \?/);   // FIELD BUGS 2026-09-30b HOME-PLAQUE (PIN MOVED): the verbs read before the name
  assert.match(m, /if \(verbs\) _doorText = \{ \.\.\._doorText, actions: verbs \};\n\s*_doorTextKey = key; _doorTextGen = gen; _doorTextHomes = homesV; _doorTextVerbs = verbsSig;/);
  assert.match(m, /function homeDoorVerbs\(bd, home\) \{\n\s*if \(!host\.onlineHomes \|\| getInteractionMode\(\) === 'steal'\) return null;\n\s*if \(home\?\.own\) return homeOwnerRows\(home\.entry\);\n\s*if \(home\) \{\n(?:\s*\/\/[^\n]*\n)*\s*const rows = \[\.\.\.\(homeVisitorRows\(home, homeDoorFor\(bd, home\)\) \?\? \[\]\), \.\.\.\(worldPlaqueOn\(\) \? homeVoteRows\(home\) : \[\]\)\];\n\s*return rows\.length \? rows : null;\n\s*\}\n\s*const price = homeOfferPrice\(bd\);\n\s*if \(!price\) return null;\n(?:\s*\/\/[^\n]*\n)*\s*const hall = homeHallBuyRow\(price, hallGuild\(\), hallArmed\(bd\)\);\n\s*return hall \? \[\.\.\.homeBuyRows\(price, homeArmed\(bd\)\), hall\] : homeBuyRows\(price, homeArmed\(bd\)\);/);   // HOME-RENT re-aim: another's home lists a tenant's room or a room to rent; GUILD1d re-aim: a hall's rows ride the visitor's, and a guildmaster's house for sale lists the guild's buy after its own; PIN MOVED: HOME-VOTE - another's home lists the town's votes under its own rows; PIN MOVED (AUDIT HOME-VOTE II D1): where the plaque draws a list
  assert.match(m, /const homeVerbsSig = \(\) => `\$\{host\.onlineHomes && getInteractionMode\(\) !== 'steal' \? 'v' : ''\}\|\$\{_homeArm && performance\.now\(\) - _homeArm\.at <= HOME_BUY_ARM_MS \? _homeArm\.id : ''\}`;/);
  // the press
  assert.match(m, /return activateStaticDoor\(entries\[key\], entries, false, \{ verb: plaqueActionFor\(key\) \}\);/);
  const door = m.slice(m.indexOf('async function activateStaticDoor('));
  assert.match(door, /^async function activateStaticDoor\(hit, entries, isBash = false, \{ homeAsked = false, verb = null, listed = plaqueListing\(\) && worldPlaqueOn\(\) \} = \{\}\) \{/);   // PIN MOVED (AUDIT HOME-VOTE II B4, D1): and whether the plaque listed - and drew - rows, read as the press lands
  assert.match(door, /if \(!isBash && !homeAsked && mode !== 'steal'\) \{/);
  assert.match(door, /if \(verb === HOME_VERB\.buy && price\) \{ pressHomeBuy\(bd, price\); return true; \}\n\s*if \(verb === HOME_VERB\.entry && door === 'own'\) \{ turnHomeEntry\(bd, home\); return true; \}\n\s*if \(verb === HOME_VERB\.sell && door === 'own'\) \{ openHomeSale\(bd\); return true; \}/);
  assert.ok(door.indexOf('if (verb === HOME_VERB.buy') < door.indexOf('const unlocked = homeOpen || resolveBuildingUnlocked(bd);'), 'before Daggerfall\'s lock ladder');
  assert.match(m, /function pressHomeBuy\(bd, price\) \{\n\s*if \(homeArmed\(bd\)\) \{ _homeArm = null; buyHomeAt\(bd, price\)\.catch\(\(e\) => console\.error\(e\)\); return; \}\n\s*_homeArm = \{ id: homeIdOf\(bd\), at: performance\.now\(\) \};/);
  assert.match(m, /const homeArmed = \(bd\) => !!_homeArm && _homeArm\.id === homeIdOf\(bd\) && performance\.now\(\) - _homeArm\.at <= HOME_BUY_ARM_MS;/);
  assert.match(m, /const next = homeNextEntry\(home\.entry\);\n\s*host\.onlineHomes\.setEntry\(homeTownOf\(bd\), bd\.buildingKey, next\)/);
  // the fallback
  assert.match(m, /\{ code: 'KeyN', label: HOME_OFFER_PASS, action: \(\) => \{ _homeDeclined\.add\(homeIdOf\(bd\)\); homeOnward\(hit, entries\)\(\); \} \},/);   // HOME-OFFER's memory, at the merge
  assert.match(m, /\{ code: 'KeyY', label: HOME_OFFER_BUY, action: \(\) => \{ buyHomeAt\(bd, price\)/);
});

test('HOME2 the deploy: a smoke call that 404s is asked again, seven times five seconds apart, before the deploy is failed - an old instance answering mid-rollout failed PR #387\'s deploy after it had taken; every new route\'s call goes through it (mutants: no retry; a route called around it)', () => {
  const wf = src('.github/workflows/account-deploy.yml');
  // PIN MOVED (INT16, Integrity-Arc section 7): the retry is `ask`, one loop every smoke call goes through - `post` and the
  // realm character's first save (`put`) each hand it their own curl words (the loop written twice was two sites of one law)
  // PIN MOVED (SMOKE-LOST, 2026-10-18): `ask` clears and leaves `<out>.lost` - a try that went unanswered, which the first
  // beat's and the first report's checks read (test/server/smoke_lost.test.js runs them) - the retry's law unchanged
  assert.match(wf, /ask\(\) \{\n\s*local out=\$1 url=\$2 got=404\n\s*shift 2\n\s*rm -f "\$out\.lost"\n\s*for i in \$\(seq 1 7\); do\n\s*got=\$\(curl -sS --max-time 15 -o "\$out" -w '%\{http_code\}' "\$@" "\$url"\) \|\| got=000\n\s*if \[ "\$got" != "404" \] && \[ "\$got" != "000" \] && \[ "\$\{got#5\}" = "\$got" \]; then break; fi\n\s*if \[ "\$got" = "000" \]; then : > "\$out\.lost"; fi\n[^\n]*\n\s*sleep 5\n\s*done\n\s*echo "\$got"\n\s*\}/, 'DEPLOY-FLAKE: a 404 and a 5xx are asked again - PR #592\'s deploy read renown/xp -> 500 in the platform\'s first moments after its migration; SMOKE-HANG: no answer (000) too - #950\'s and #947\'s read homes/town and homes/decor as 15 s with nothing');
  for (const route of ['/v1/account/played', '/v1/mod/mute', '/v1/renown/xp', '/v1/homes/town', '/v1/homes/claim', '/v1/homes/decor', '/v1/homes/decor/place',
    '/v1/homes/yards', '/v1/arena/board', '/v1/market/vendors']) {
    assert.match(wf, new RegExp(`code=\\$\\(post /tmp/[a-z0-9]+\\.json "\\$base${route.replace(/\//g, '\\/')}" `), route);
  }
  // PIN MOVED (INT16, Integrity-Arc section 7): a Renown report is its seat's - the smoke's guest takes a realm character
  // first (realm/create, a ninth post) and its first save through the same retry, a PUT (`put`)
  // PIN MOVED (AUDIT LEAN-READS D7, 2026-10-20): the kept boards read on D1 itself - a town's yards, the arena's board and
  // the region's traders - three more posts, each through the retry
  assert.equal((wf.match(/code=\$\(post /g) ?? []).length, 12, 'the twelve smoke calls, the repeated report, the realm character and the kept boards among them');
  // AUDIT LEAN-READS (audit two, C3): a board's keep is caught where D1 refuses it, so the answer says nothing of it - the
  // smoke asks D1 itself for the boards kept: the yards built in a shape, the arena's board and the region's traders at
  // their versions
  for (const table of ['home_yards y JOIN home_yards_ver v ON v.map_id = y.map_id WHERE y.built = v.ver AND y.shape IS NOT NULL', 'arena_boards b JOIN arena_board_ver v ON v.id = 1 WHERE b.built = v.ver AND b.shape IS NOT NULL',
    'market_vendor_boards b JOIN market_vendor_ver v ON v.region = b.region WHERE b.region = 17 AND b.built = v.ver AND b.shape IS NOT NULL']) assert.ok(wf.includes(table), table);   // AUDIT LEAN-READS 2 B3: the versions rows of their own
  // AUDIT LEAN-READS 2 D5: a BUSY read shed through every try is said and passed - each of the smoke's four - and the yards
  // are read of a town that stands some
  for (const route of ['/v1/homes/town', '/v1/homes/decor', '/v1/homes/yards', '/v1/market/vendors']) assert.match(wf, new RegExp(`if shed "\\$code" ${route.replaceAll('/', '\\/')}; then :\\n\\s+elif`), route);
  assert.match(wf, /shed\(\) \{ \[ "\$1" = "503" \] && echo "::warning::/);
  assert.match(wf, /"\$base\/v1\/homes\/yards" "\{\\"secret\\":\\"\$secret\\",\\"mapId\\":\$map\}"/);
  assert.match(wf, /\n\s*kept\(\) \{ timeout 60 \$WRANGLER d1 execute "\$DB_NAME" --remote --command "\$1" --json/, 'asked of D1 itself');
  assert.equal((wf.match(/code=\$\(put /g) ?? []).length, 1, 'and the realm character\'s first save, asked again as a post is');
  assert.match(wf, /\n\s*post\(\) \{ ask "\$1" "\$2" -X POST -H 'content-type: application\/json' -d "\$3"; \}\n/, 'a post is the retry\'s');
  assert.match(wf, /\n\s*put\(\) \{ ask "\$1" "\$2" -X PUT -H "authorization: Bearer \$secret" -H "x-realm-lease: \$4" -H 'x-realm-seq: 1' -d "\$3"; \}\n/, 'and so is the first save');
  assert.equal((wf.match(/code=\$\(curl -sS --max-time 15 -o/g) ?? []).length, 0, 'no smoke call around the retry');
});
