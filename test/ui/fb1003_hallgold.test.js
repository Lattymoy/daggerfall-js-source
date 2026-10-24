// HALL-GOLD (FIELD BUGS 2026-10-03, the Patreon chat - a guild of realm characters with "Buy it for Empire of Tamriel:
// 1274880 gold from the treasury" at a house's door: "we have the cash, began with putting it all in guild bank, but then
// when we went to buy it says whats above ... so went and took all out and put in in bank thinking it meant it had to be
// within the realm ... so is this a glitch, or r we not putting gold in right place").
//
// NOT A GLITCH IN THE PATH: the treasury was the right place, and only it (and only the gold realm characters put in)
// pays for a hall. The defect was the words: both refusals - a treasury short of the price, and one holding it in gold
// that does not count - read "The treasury needs N gold put in by realm characters", and "the realm" read as a place,
// so the gold went to a bank account. Now each refusal is its own line, the Guild tab says how much of the treasury can
// buy a hall, and a deposit past one move's cap is held at the button.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService } from '../accountDb.mjs';
import { hallShortLine, hallOldGoldLine } from '../../src/systems/online/onlineHomes.js';
import { guildHallGoldText } from '../../src/ui/socialPanel.js';
import { GUILD_MOVE_MAX } from '../../src/net/guild/guildLaw.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('HALL-GOLD the words: short of the price says where the gold goes (the Guild tab\'s Treasury, a move\'s cap) and that a bank account does not pay; short of COUNTED gold says which gold counts; the figures grouped (mutants: one line for both; the bank not named)', () => {
  const short = hallShortLine(1_274_880), old = hallOldGoldLine(1_274_880);
  assert.notEqual(short, old, 'two refusals, two lines');
  assert.match(short, /less than 1,274,880 gold/);
  assert.match(short, /Guild tab's Treasury/);
  assert.match(short, new RegExp(`up to ${GUILD_MOVE_MAX.toLocaleString('en-US')} at a time`));
  assert.match(short, /bank account does not pay for a hall/);
  assert.match(old, /less than 1,274,880 gold put in by realm characters, and only that gold buys a hall/);
  assert.match(old, /Older gold, or gold from characters outside the realm, does not count/);
  // the door's press says each refusal its own way
  const modes = rd('src/scenes/worldModes.js');
  assert.match(modes, /r\?\.error === 'guild-treasury-short' \? hallShortLine\(guildHallPrice\(price\)\)\s*\n\s*: r\?\.error === 'guild-treasury-old' \? hallOldGoldLine\(guildHallPrice\(price\)\)/);
});

test('HALL-GOLD the Guild tab: the service\'s view carries what of the treasury can buy a hall - realm gold in, counted; gold from before the realm, not - and the tab says it under "no hall" (mutants: the field dropped; the treasury\'s whole said)', async () => {
  const svc = await standService();
  const gm = await svc.registered('Gwen', { renown: 12 });
  assert.equal((await svc.found(gm, { name: 'Empire of Tamriel', tag: 'EOT' })).status, 200);
  assert.equal((await svc.call('/v1/guilds/deposit', { character: gm.character, gold: 60_000, realm: gm.at(), region: 17 }, gm.secret)).status, 200);
  const view = async () => (await svc.call('/v1/guilds/mine', { character: gm.character }, gm.secret)).body.guild;
  let v = await view();
  assert.equal(v.hallGold, 60_000, 'a realm character\'s deposit counts');
  svc.env.DB._raw.prepare('UPDATE guilds SET treasury = treasury + 40000').run();   // gold that came in before the realm
  v = await view();
  assert.deepEqual([v.treasury, v.hallGold], [100_000, 60_000], 'the treasury\'s whole, and what of it buys a hall');
  // PIN MOVED: AUDIT GUILD3 W15 - the Treasury's sentence, one rule said once: a hall, or a new name or tag
  assert.equal(guildHallGoldText(v.hallGold, v.treasury), '60,000 of the treasury\'s 100,000 gold was put in by realm characters and can buy a hall, or a new name or tag. Gold in a bank account cannot.');
  assert.equal(guildHallGoldText(undefined, 5), null, 'an older service\'s answer: nothing said');
  const panel = rd('src/ui/socialPanel.js');
  assert.match(panel, /const counted = guildHallGoldText\(v\.hallGold, v\.treasury\);/);
});

test('HALL-GOLD the treasury\'s buttons: an amount past one move\'s cap is held at Deposit and Withdraw with the cap said, not sent to be refused (mutant: the cap not asked)', () => {
  const panel = rd('src/ui/socialPanel.js');
  assert.match(panel, /const overCap = \(\) => goldTyped\(\) > GUILD_MOVE_MAX;/);
  assert.match(panel, /liveBtn\('Deposit', \(\) => \(\{ enabled: !g\.busy && goldTyped\(\) > 0 && !overCap\(\), why: g\.busy \? 'a moment' : overCap\(\) \? capWhy : 'an amount' \}\)/);
  assert.match(panel, /liveBtn\('Withdraw', \(\) => \(\{ enabled: !g\.busy && goldTyped\(\) > 0 && !overCap\(\) && guildMay\(me, 'withdraw'\)/);
  assert.equal(GUILD_MOVE_MAX, 1_000_000, 'a hall at 1,274,880 takes two deposits');
});
