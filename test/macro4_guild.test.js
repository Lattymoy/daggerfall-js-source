// MACRO-4 (2026-09-22, the macro audit): THE GUILD IS THE SOURCE.
// DFU hands a guild's own GuildMacroDataSource to every box its popup
// shows: %lev and %pct are the rank title (MacroHelper :128, one row),
// a temple answers %god, %fon and %gdd off its deity
// (TempleMacroDataSource, Temple.cs:557-570), and a Thieves Guild or Dark
// Brotherhood promotion names the dungeon it just revealed for %dng. The
// popup's map carried only the player and the faction name, so every rank
// change printed "the rank of %lev". The trade window's %pct
// (TradeMacroDataSource.GuildTitle) had no source at all.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dfuFile, missingDfu } from './dfuRoot.mjs';
import { expandGuildMacros } from '../src/systems/guildServiceActions.js';
import { DEITY_DESCRIPTIONS } from '../src/systems/guildServices.js';
import { DIVINES } from '../src/systems/guildVariants.js';
import { NativeTradeWindow } from '../src/ui/nativeTrade.js';
import { setMacroWorld } from '../src/systems/quest/questMacros.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('MACRO-4: %lev and %pct are ONE row - the rank title, read when the box is shown', () => {
  let rank = 'Apprentice';
  const ctx = { playerName: 'Aldric Vane', guildTitle: () => rank };
  assert.equal(expandGuildMacros('You have reached the rank of %lev, %pct.', ctx), 'You have reached the rank of Apprentice, Apprentice.');
  rank = 'Journeyman';
  assert.equal(expandGuildMacros('the rank of %lev', ctx), 'the rank of Journeyman', 'a promotion names the NEW rank - the title is read lazily');
});

test('MACRO-4: a temple answers %god, %fon and %gdd off its deity; a promotion’s reveal answers %dng', () => {
  const ctx = { god: 'Julianos', factionName: 'Julianos', godDesc: DEITY_DESCRIPTIONS.Julianos };
  assert.equal(expandGuildMacros('Certainly the %gdd accepts all donations. Praise %god of the %fon.', ctx),
    'Certainly the God of Logic accepts all donations. Praise Julianos of the Julianos.');
  let revealed = null;
  const dng = { dungeon: () => revealed };
  revealed = 'Castle Necromoghan';
  assert.equal(expandGuildMacros('The place is %dng.', dng), 'The place is Castle Necromoghan.');
  // no source for the row and no world to answer it: the token stays, never an error shape
  assert.equal(expandGuildMacros('%dng and %gdd', {}), '%dng and %gdd');
});

test('MACRO-4: DEITY_DESCRIPTIONS is DFU’s own akatoshDesc..zenDesc, one per divine', (t) => {
  assert.deepEqual(Object.keys(DEITY_DESCRIPTIONS).sort(), Object.keys(DIVINES).sort(), 'every divine has its line, and nothing else does');
  const shared = 'Assets/Localization/StringTables/Internal_Strings Shared Data.asset';
  const en = 'Assets/Localization/StringTables/Internal_Strings_en.asset';
  if (missingDfu(shared, en)) { t.skip('no DFU checkout (see test/dfuRoot.mjs)'); return; }
  const sharedText = readFileSync(dfuFile(shared), 'utf8');
  const enText = readFileSync(dfuFile(en), 'utf8');
  // Temple.templeData's deityDesc keys (Temple.cs:134-141) - Stendarr's is spelled "stendarDesc" there
  const keys = { Akatosh: 'akatoshDesc', Arkay: 'arkayDesc', Dibella: 'dibellaDesc', Julianos: 'julianosDesc',
    Kynareth: 'kynarethDesc', Mara: 'maraDesc', Stendarr: 'stendarDesc', Zenithar: 'zenDesc' };
  for (const [divine, key] of Object.entries(keys)) {
    const id = sharedText.match(new RegExp(`m_Id: (\\d+)\\s*\\n\\s*m_Key: ${key}\\s*\\n`))?.[1];
    assert.ok(id, `${key} is in the shared table`);
    const text = enText.match(new RegExp(`m_Id: ${id}\\s*\\n\\s*m_Localized: ([^\\n]+)`))?.[1]?.trim();
    assert.equal(DEITY_DESCRIPTIONS[divine], text, `${divine}: DFU says "${text}"`);
  }
});

test('MACRO-4: the trade box’s %pct is the guild’s title at its counter, the first name at a shop’s; %ra is the world’s', () => {
  const rows = () => [{ text: 'You are a most formidable bargainer, %pct.' }, { text: 'Listen, %ra.' }];
  const call = (hooks) => NativeTradeWindow.prototype._rows.call({ hooks: { rows, entity: { name: 'Aldric Vane' }, ...hooks } }, 260, 10);
  setMacroWorld(() => ({ nowSeconds: () => 0, hooks: { playerRaceName: () => 'Dark Elf' } }));
  try {
    assert.deepEqual(call({ guildTitle: () => 'Magus' }).map((r) => r.text), ['You are a most formidable bargainer, Magus.', 'Listen, Dark Elf.']);
    assert.deepEqual(call({ guildTitle: () => null }).map((r) => r.text)[0], 'You are a most formidable bargainer, Aldric.', 'no guild: the first name');
    assert.deepEqual(call({}).map((r) => r.text)[0], 'You are a most formidable bargainer, Aldric.', 'a shop hands no guildTitle hook');
  } finally { setMacroWorld(null); }
});

test('MACRO-4: the hosts wire the sources', () => {
  const modes = read('src/scenes/worldModes.js');
  assert.match(modes, /guildTitle: \(\) => getTitle\(membershipOf\(activeMemberships\(playerEntity\), guild\), playerEntity, guild\),/, 'the popup: the rank, read at show time');
  assert.match(modes, /god: guild\?\.divine \?\? null,\s*godDesc: guild\?\.divine \? \(DEITY_DESCRIPTIONS\[guild\.divine\] \?\? null\) : null,\s*dungeon: \(\) => revealedDungeon,/, 'the popup: the deity and the revealed dungeon');
  assert.match(modes, /const g = guildFactionId != null \? guildOfFaction\(guildFactionId, resolveVariantGuild\(dict\), dict\) : null;\s*return g \? getTitle\(membershipOf\(activeMemberships\(playerEntity\), g\), playerEntity, g\) : null;/, 'the trade window: the counter’s guild');
  assert.match(read('src/ui/enhancedTrade.js'), /guildTitle: deps\.guildTitle\?\.\(\) \?\? firstName\(deps\.entity\?\.name \?\? ''\),/, 'the enhanced trade skin reads the same hook');
  const actions = read('src/systems/guildServiceActions.js');
  assert.match(actions, /pct: guildTitle, lev: guildTitle,/);
  assert.match(actions, /gdd: godDesc,/);
  assert.match(actions, /dng: dungeon,/);
});
