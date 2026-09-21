// CM4 - THE FOUR RESIDUAL CHARACTER-SHEET MODALS (Name, Level, Health,
// Affiliations), on the sheet ITSELF (ui/charsheet.js) - U32 had left
// them consumed as no-ops.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CharSheet, CHARSHEET_RECTS, levelProgressPercent, affiliationRows } from '../src/ui/charsheet.js';
import { InputMessageBoxWindow } from '../src/ui/inputMessageBox.js';
import { ActionTextBox } from '../src/ui/actionText.js';
import { GUILDS } from '../src/systems/guilds.js';

const mid = ([x, y, w, h]) => [x + w / 2, y + h / 2];
const hero = (over = {}) => ({
  name: 'Rhodri', items: [], spells: [], stats: {}, skills: {}, activeEffects: [],
  startingLevelUpSkillSum: 100, currentLevelUpSkillSum: 109,
  ...over,
});

test('CM4: level progress uses DaggerfallCharacterSheetWindow arithmetic', () => {
  assert.equal(levelProgressPercent(hero()), 46);
  assert.equal(levelProgressPercent(hero({ currentLevelUpSkillSum: 102 })), 0);
});

test('CM4: Name pushes the shared input box, seeds the current name, and rejects an empty replacement', () => {
  const e = hero();
  const w = new CharSheet(e, {});
  assert.equal(w.click(...mid(CHARSHEET_RECTS.name)), true);
  assert.ok(w.child instanceof InputMessageBoxWindow);
  assert.equal(w.child.value, 'Rhodri');

  w.child.value = '';
  w.child.input('Enter');
  w.input('noop');
  assert.equal(e.name, 'Rhodri', 'DFU only writes a non-empty name');
  assert.equal(w.child, null);

  w.click(...mid(CHARSHEET_RECTS.name));
  w.child.value = 'Nulfaga';
  w.child.input('Enter');
  w.input('noop');
  assert.equal(e.name, 'Nulfaga');
});

test('CM4: CharacterSheetName hotkey opens the same modal path', () => {
  const w = new CharSheet(hero(), {});
  w.input('KeyN');
  assert.ok(w.child instanceof InputMessageBoxWindow);
});

test('CM4: Level and Health buttons push parchment message boxes instead of swallowing the click', () => {
  const calls = [];
  const rows = (id) => { calls.push(id); return [{ text: id === 18 ? 'You are healthy.' : `row ${id}`, center: true }]; };
  const w = new CharSheet(hero(), { rows });

  w.click(...mid(CHARSHEET_RECTS.level));
  assert.ok(w.child instanceof ActionTextBox);
  assert.deepEqual(w.child.lines, ['Progress made to the next level: 46%']);
  w.child.done = true;
  w.input('noop');

  w.click(...mid(CHARSHEET_RECTS.health));
  assert.ok(w.child instanceof ActionTextBox);
  assert.deepEqual(w.child.lines, [{ text: 'You are healthy.', center: true }]);
  assert.deepEqual(calls, [18], 'CreateHealthStatusBox reads the healthy record');
});

test('CM4: no guild memberships show TEXT.RSC 19', () => {
  const ids = [];
  const rows = (id) => { ids.push(id); return [{ text: `record ${id}`, center: true }]; };
  const out = affiliationRows(hero({ guildMemberships: {} }), rows);
  assert.deepEqual(ids, [19]);
  assert.deepEqual(out, [{ text: 'record 19', center: true }]);
});

test('CM4: affiliations show faction name, rank title, and live faction reputation', () => {
  const guild = GUILDS.FightersGuild;
  const e = hero({
    guildMemberships: {
      [guild.guildGroup]: { guild: guild.name, rank: 2, lastRankChange: 0 },
    },
    factionRep: {
      dict: new Map([[guild.factionId, { name: 'The Fighters Guild', rep: 37 }]]),
    },
  });
  const out = affiliationRows(e, () => []);
  assert.deepEqual(out[0], {
    cells: [{ text: 'Affiliation', x: 0 }, { text: 'Rank', x: 125 }],
    highlight: true,
  });
  assert.deepEqual(out[1], {
    cells: [
      { text: 'The Fighters Guild', x: 0 },
      { text: 'Swordsman (rep:37)', x: 125 },
    ],
  });
});

test('CM4: Affiliations button pushes the generated table', () => {
  const w = new CharSheet(hero({ guildMemberships: {} }), { rows: (id) => [{ text: `record ${id}` }] });
  w.click(...mid(CHARSHEET_RECTS.affiliations));
  assert.ok(w.child instanceof ActionTextBox);
  assert.deepEqual(w.child.lines, [{ text: 'record 19' }]);
});
