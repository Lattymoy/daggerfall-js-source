// STATION-ROWS (2026-09-27, Discord - the crash box: "TypeError: m.rows.map is not a function", thrown from the
// interior frame). A home's Spellmaking station opens the spell maker through the guild dispatcher, and the spell
// maker's arm hands its WINDOW back - a window that keeps the host's TEXT.RSC reader as `rows`. Every reader of the
// dispatcher's answer took "has rows" for "is a box": the station mapped the reader as a list and threw on every press,
// and the guild popup pushed the whole window onto itself as a message. One test now, systems/guildServiceFlow.js
// isServiceBox: rows that are a LIST.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isServiceBox } from '../src/systems/guildServiceFlow.js';
import { SpellMakerWindow } from '../src/ui/spellMakerWindow.js';
import { GuildServiceWindow } from '../src/ui/guildServiceWindow.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('STATION-ROWS: the spell maker the arm hands back is no box; a refusal\'s rows are (mutants: the old truthy test; a list read as none)', () => {
  const maker = new SpellMakerWindow({ entity: { maxMagicka: 100, gold: 0, goldPieces: 0 }, rows: () => [] });
  assert.equal(typeof maker.rows, 'function', 'the producer keeps its reader as `rows` - the shape that crashed');
  assert.equal(isServiceBox(maker), false);
  assert.equal(isServiceBox({ rows: [{ text: 'You have no spellbook!', center: true }], closesWindow: true }), true);
  assert.equal(isServiceBox({ rows: [] }), true, 'an empty record is still a box (the station says its own refusal)');
  assert.equal(isServiceBox({ dispatched: true }), false);
  assert.equal(isServiceBox(null), false);
});

test('STATION-ROWS: the guild popup pushes a box and never a window its service handed back (mutant: `r?.rows` again)', () => {
  const maker = new SpellMakerWindow({ entity: { maxMagicka: 100, gold: 0, goldPieces: 0 }, rows: () => [] });
  const pop = new GuildServiceWindow({ onService: () => maker, rows: () => [] });
  pop._service();
  assert.equal(pop.boxes.length, 0, 'the maker is no message on the popup');
  const refused = new GuildServiceWindow({ onService: () => ({ rows: ['My services are reserved for members only.'] }), rows: () => [] });
  refused._service();
  assert.equal(refused.boxes.length, 1);
});

test('STATION-ROWS: every reader of the dispatcher\'s answer asks the one test (sweep)', () => {
  const modes = src('src/scenes/worldModes.js');
  const station = modes.slice(modes.indexOf('function useDecorStation('), modes.indexOf('function decorRoomHere('));
  assert.match(station, /if \(isServiceBox\(flow\)\) \{/);
  assert.doesNotMatch(station, /flow\?\.rows\)/);
  assert.match(modes, /if \(isServiceBox\(flow\)\) return flow;/, 'the popup\'s onService');
  assert.match(modes, /if \(flow && !isServiceBox\(flow\)\) mountServiceWindow\(flow\);/, 'the probe door');
  for (const p of ['src/ui/guildServiceWindow.js', 'src/ui/covenWindow.js']) {
    const s = src(p);
    assert.doesNotMatch(s, /if \(next\?\.rows\)|if \(r\?\.rows\)/, p);
    assert.match(s, /isServiceBox\(next\)/, p);
    assert.match(s, /isServiceBox\(r\)/, p);
  }
});
