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

import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import {
  homeCandidate, homeBuyRows, homeOwnerRows, homeNextEntry, HOME_BUY_ARM_MS, HOME_VERB, HOME_OFFER_BUY, HOME_OFFER_PASS,
} from '../src/systems/onlineHomes.js';
import { resolveHover, nextSelection } from '../src/systems/worldHover.js';
import { foldQuickLoot, quickLootWheel, plaqueActionFor, resetQuickLoot } from '../src/systems/quickLoot.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('HOME2 the law: every house type is a house - House1-6 and the for-sale house - never a guild\'s House2 or a shop; the buy rows go in first and buy second, the buy reading "Click again" once armed; my home\'s rows go in, name who may enter and sell; a press on who may enter moves it round (mutants: House5 or House6 left out; a guild\'s hideout for sale; the buy row first; the arm unsaid; the entry stuck)', () => {
  const b = (buildingType, extra = {}) => ({ buildingType, buildingKey: 0x10203, factionId: 0, ...extra });
  for (const t of [BUILDING_TYPES.HouseForSale, BUILDING_TYPES.House1, BUILDING_TYPES.House2, BUILDING_TYPES.House3, BUILDING_TYPES.House4, BUILDING_TYPES.House5, BUILDING_TYPES.House6]) {
    assert.equal(homeCandidate(b(t)), true, `type ${t}`);
  }
  assert.equal(homeCandidate(b(BUILDING_TYPES.House2, { factionId: 42 })), false, 'a guild\'s hideout, sold to one player, would shut the guild out');
  for (const t of [BUILDING_TYPES.Tavern, BUILDING_TYPES.Bank, BUILDING_TYPES.Palace, BUILDING_TYPES.GuildHall, BUILDING_TYPES.Temple, BUILDING_TYPES.Town23, BUILDING_TYPES.Ship]) {
    assert.equal(homeCandidate(b(t)), false, `type ${t}`);
  }
  assert.deepEqual(HOME_VERB, { enter: 'home-enter', buy: 'home-buy', entry: 'home-entry', sell: 'home-sell' });
  assert.deepEqual(homeBuyRows(1234), [{ id: 'home-enter', label: 'Go in' }, { id: 'home-buy', label: 'Buy it: 1234 gold' }], 'a plain click is still a plain click');
  assert.deepEqual(homeBuyRows(1234, true)[1], { id: 'home-buy', label: 'Click again to buy: 1234 gold' });
  assert.equal(HOME_BUY_ARM_MS, 5000);
  assert.deepEqual(homeOwnerRows('party'), [{ id: 'home-enter', label: 'Go in' }, { id: 'home-entry', label: 'Who may enter: My party' }, { id: 'home-sell', label: 'Sell it' }]);
  assert.equal(homeOwnerRows('nonsense')[1].label, 'Who may enter: Only me', 'an entry this build does not know reads as the default');
  assert.deepEqual(['private', 'party', 'public'].map(homeNextEntry), ['party', 'public', 'private']);
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
  assert.match(m, /import \{ quickLootTake, plaqueActionFor \} from '\.\.\/systems\/quickLoot\.js';/);
  // the namer
  assert.match(m, /const verbsSig = homeVerbsSig\(\);\n\s*if \(_doorTextKey === key && _doorTextGen === gen && _doorTextHomes === homesV && _doorTextVerbs === verbsSig\) return _doorText;/);
  assert.match(m, /const verbs = _doorText \? homeDoorVerbs\(bd, home\) : null;\n\s*const homeLine = verbs \? null : home \?/);
  assert.match(m, /if \(verbs\) _doorText = \{ \.\.\._doorText, actions: verbs \};\n\s*_doorTextKey = key; _doorTextGen = gen; _doorTextHomes = homesV; _doorTextVerbs = verbsSig;/);
  assert.match(m, /function homeDoorVerbs\(bd, home\) \{\n\s*if \(!host\.onlineHomes \|\| getInteractionMode\(\) === 'steal'\) return null;\n\s*if \(home\?\.own\) return homeOwnerRows\(home\.entry\);\n\s*if \(home\) return null;\n\s*const price = homeOfferPrice\(bd\);\n\s*return price \? homeBuyRows\(price, homeArmed\(bd\)\) : null;/);
  assert.match(m, /const homeVerbsSig = \(\) => `\$\{host\.onlineHomes && getInteractionMode\(\) !== 'steal' \? 'v' : ''\}\|\$\{_homeArm && performance\.now\(\) - _homeArm\.at <= HOME_BUY_ARM_MS \? _homeArm\.id : ''\}`;/);
  // the press
  assert.match(m, /return activateStaticDoor\(entries\[key\], entries, false, \{ verb: plaqueActionFor\(key\) \}\);/);
  const door = m.slice(m.indexOf('async function activateStaticDoor('));
  assert.match(door, /^async function activateStaticDoor\(hit, entries, isBash = false, \{ homeAsked = false, verb = null \} = \{\}\) \{/);
  assert.match(door, /if \(!isBash && !homeAsked && mode !== 'steal'\) \{/);
  assert.match(door, /if \(verb === HOME_VERB\.buy && price\) \{ pressHomeBuy\(bd, price\); return true; \}\n\s*if \(verb === HOME_VERB\.entry && door === 'own'\) \{ turnHomeEntry\(bd, home\); return true; \}\n\s*if \(verb === HOME_VERB\.sell && door === 'own'\) \{ openHomeSale\(bd\); return true; \}/);
  assert.ok(door.indexOf('if (verb === HOME_VERB.buy') < door.indexOf('const unlocked = homeOpen || resolveBuildingUnlocked(bd);'), 'before Daggerfall\'s lock ladder');
  assert.match(m, /function pressHomeBuy\(bd, price\) \{\n\s*if \(homeArmed\(bd\)\) \{ _homeArm = null; buyHomeAt\(bd, price\)\.catch\(\(e\) => console\.error\(e\)\); return; \}\n\s*_homeArm = \{ id: homeIdOf\(bd\), at: performance\.now\(\) \};/);
  assert.match(m, /const homeArmed = \(bd\) => !!_homeArm && _homeArm\.id === homeIdOf\(bd\) && performance\.now\(\) - _homeArm\.at <= HOME_BUY_ARM_MS;/);
  assert.match(m, /const next = homeNextEntry\(home\.entry\);\n\s*host\.onlineHomes\.setEntry\(homeTownOf\(bd\), bd\.buildingKey, next\)/);
  // the fallback
  assert.match(m, /\{ code: 'KeyN', label: HOME_OFFER_PASS, action: \(\) => \{ _homePassed\.add\(homeIdOf\(bd\)\); homeOnward\(hit, entries\)\(\); \} \},/);
  assert.match(m, /\{ code: 'KeyY', label: HOME_OFFER_BUY, action: \(\) => \{ buyHomeAt\(bd, price\)/);
});

test('HOME2 the deploy: a smoke call that 404s is asked again, seven times five seconds apart, before the deploy is failed - an old instance answering mid-rollout failed PR #387\'s deploy after it had taken; every new route\'s call goes through it (mutants: no retry; a route called around it)', () => {
  const wf = src('.github/workflows/account-deploy.yml');
  assert.match(wf, /post\(\) \{\n\s*local out=\$1 url=\$2 data=\$3 got=404\n\s*for i in \$\(seq 1 7\); do\n\s*got=\$\(curl -sS --max-time 15 -o "\$out" -w '%\{http_code\}' -X POST "\$url" -H 'content-type: application\/json' -d "\$data"\)\n\s*if \[ "\$got" != "404" \]; then break; fi\n[^\n]*\n\s*sleep 5\n\s*done\n\s*echo "\$got"\n\s*\}/);
  for (const route of ['/v1/account/played', '/v1/mod/mute', '/v1/renown/xp', '/v1/homes/town', '/v1/homes/claim', '/v1/homes/decor', '/v1/homes/decor/place']) {
    assert.match(wf, new RegExp(`code=\\$\\(post /tmp/[a-z0-9]+\\.json "\\$base${route.replace(/\//g, '\\/')}" `), route);
  }
  assert.equal((wf.match(/code=\$\(post /g) ?? []).length, 8, 'the eight smoke calls, the repeated report among them');
  assert.equal((wf.match(/code=\$\(curl -sS --max-time 15 -o/g) ?? []).length, 0, 'no smoke call around the retry');
});
