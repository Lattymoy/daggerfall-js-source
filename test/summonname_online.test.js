// SUMMON-NAME (2026-10-07, bible/06-Systems/Online-Waits.md WAIT3; Mac: "Take care of this", over the sweep of the waits
// still long online): ONLINE THE SUMMONER CALLS THE PRINCE YOU NAME. DFU's temple and Mages Guild answer one prince on
// his own day of the year; online the day is the sky's (TIME1), a sky year is fifteen real days (SKY-SLOW), and no rest
// moves the sky - a prince answered one real hour in fifteen days, and from Vaernima's day to Nocturnal's nobody answered
// for fifty-eight real hours. For OL4's reason (a schedule nobody can rest through is a real-time lockout) the online
// summoner lists the sixteen; the price, the chance, the gatecrash and the quest are DFU's. A witches' coven keeps its
// daily draw, Glenmoril its Hircine, and offline nothing moves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DAEDRA, GLENMORIL_WITCHES, WITCHES_COVEN_TYPE, daedraForSummoner, summonsByName, PRINCES_BY_NAME,
  SUMMON_BY_NAME_ROWS, summonByNameBoxes, SUMMON_TEXT,
} from '../src/systems/daedraSummoning.js';
import { ServiceFlowWindow } from '../src/ui/guildServiceWindows.js';
import { FACTION_TYPES } from '../src/formats/factionFile.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

test('SUMMON-NAME: who names the prince - online, a summoner that is neither a coven nor Glenmoril; offline nobody, and DFU\'s day law is untouched beside it', () => {
  const temple = { factionId: 82, factionType: FACTION_TYPES.Temple };
  const guild = { factionId: 40, factionType: FACTION_TYPES.Group };
  const coven = { factionId: 200, factionType: WITCHES_COVEN_TYPE };
  const glenmoril = { factionId: GLENMORIL_WITCHES, factionType: WITCHES_COVEN_TYPE };
  assert.equal(summonsByName({ ...temple, online: true }), true, 'a temple online');
  assert.equal(summonsByName({ ...guild, online: true }), true, 'the Mages Guild online');
  assert.equal(summonsByName({ ...temple, online: false }), false, 'offline: DFU\'s day');
  assert.equal(summonsByName({ ...coven, online: true }), false, 'a coven keeps its daily draw');
  assert.equal(summonsByName({ ...glenmoril, online: true }), false, 'Glenmoril keeps its Hircine');
  assert.equal(summonsByName({ factionId: GLENMORIL_WITCHES, factionType: FACTION_TYPES.Temple, online: true }), false, 'Glenmoril by its id, as DFU tests it first');
  assert.equal(summonsByName(), false);
  // DFU's law beside it, unchanged: a temple on Azura's day, and nobody the day after
  const azura = DAEDRA.find((d) => d.name === 'Azura');
  assert.equal(daedraForSummoner({ ...temple, dayOfYear: azura.dayOfYear }), azura);
  assert.equal(daedraForSummoner({ ...temple, dayOfYear: azura.dayOfYear + 1 }), null);
});

test('SUMMON-NAME: the list is the sixteen, each once, by name', () => {
  assert.equal(PRINCES_BY_NAME.length, 16);
  assert.deepEqual(new Set(PRINCES_BY_NAME), new Set(DAEDRA));
  assert.deepEqual(PRINCES_BY_NAME.map((d) => d.name), [
    'Azura', 'Boethiah', 'Clavicus Vile', 'Hermaeus Mora', 'Hircine', 'Malacath', 'Mehrunes Dagon', 'Mephala',
    'Meridia', 'Molag Bal', 'Namira', 'Nocturnal', 'Peryite', 'Sanguine', 'Sheogorath', 'Vaernima',
  ]);
});

test('SUMMON-NAME: the question is record 481\'s own words from "Do you" - its breaks, its "you life" - without "Today is %dat, the day of summoning for %dae", which online is false on every day but his', () => {
  const csv = readFileSync(join(ROOT, 'vendor/dfu-text/Internal_RSC.csv'), 'utf8');
  const record = /^481,"([\s\S]*?)\[\/end\]"/m.exec(csv)[1].split(/\r?\n/).filter(Boolean).map((l) => l.replace('[/center]', ''));
  assert.equal(SUMMON_TEXT.areYouSure, 481);
  assert.deepEqual(record, [
    'Today is %dat, the day of summoning',
    'for %dae. Do you, %pcn, wish',
    'to risk you life and very soul by summoning',
    '%dae into our mundane world?',
  ]);
  assert.deepEqual(SUMMON_BY_NAME_ROWS.map((r) => r.text), [record[1].slice(record[1].indexOf('Do you')), record[2], record[3]]);
  assert.ok(SUMMON_BY_NAME_ROWS.every((r) => r.center === true), 'centred, as the record');
});

test('SUMMON-NAME: the flow, driven - the list, a pick, DFU\'s question about the one picked, and the Yes is the host\'s summoning of that prince, its answer shown; a No ends it with nothing spent', () => {
  const called = [];
  const summon = (d) => { called.push(d.name); return { rows: [{ text: `${d.name} answers your summons.`, center: true }] }; };
  const expand = (rows, d) => rows.map((r) => ({ ...r, text: r.text.replace('%dae', d.name).replace('%pcn', 'Seanobi') }));
  const f = new ServiceFlowWindow(summonByNameBoxes(summon, expand));
  assert.deepEqual(f.top.picker, PRINCES_BY_NAME.map((d) => d.name));
  f.input('Enter');   // the selected row: the first, Azura
  assert.equal(f.top.buttons, 'YesNo');
  assert.deepEqual(f.top.rows.map((r) => r.text), ['Do you, Seanobi, wish', 'to risk you life and very soul by summoning', 'Azura into our mundane world?']);
  assert.deepEqual(called, [], 'nothing summoned on the pick');
  f.input('KeyY');
  assert.deepEqual(called, ['Azura'], 'the Yes summons the one picked');
  assert.deepEqual(f.top.rows, [{ text: 'Azura answers your summons.', center: true }], 'the host\'s answer is the next box');
  f.input('Enter');
  assert.equal(f.done, true);
  // a dispatched summons (the film window took the slot) answers null, and the flow closes
  const g = new ServiceFlowWindow(summonByNameBoxes(() => null));
  g.input('Enter'); g.input('KeyY');
  assert.equal(g.done, true);
  // No: nothing summoned, the flow ends
  const n = []; const h = new ServiceFlowWindow(summonByNameBoxes((d) => { n.push(d); return null; }));
  h.input('Enter'); h.input('KeyN');
  assert.deepEqual(n, []);
  assert.equal(h.done, true);
  // every row of the list reaches its own prince
  for (let i = 0; i < PRINCES_BY_NAME.length; i++) {
    const got = [];
    const [pick] = summonByNameBoxes((d) => { got.push(d); return null; }, expand);
    const [ask] = pick.onPick(i);
    assert.equal(ask.rows[2].text, `${PRINCES_BY_NAME[i].name} into our mundane world?`, 'the question names the one picked');
    assert.deepEqual(ask.onYes(), null);
    assert.equal(got[0], PRINCES_BY_NAME[i]);
  }
});

test('SUMMON-NAME: the host - online, the temple\'s and the guild\'s popup takes the list (the coven\'s, which hands its own summonerFactionId, keeps its draw); offline and without the picker\'s art it is DFU\'s day and record 481', () => {
  const wm = readFileSync(join(ROOT, 'src/scenes/worldModes.js'), 'utf8');
  assert.ok(wm.includes('const byName = summonerFactionId == null && listPickerArtLoaded()\n        && summonsByName({ factionId: summonerId, factionType: (summoner?.type ?? null), online: sharedClockOn() });'));
  assert.ok(wm.includes("if (!daedra && !byName) return { rows: box(SUMMON_TEXT.notToday, null, 'This is not a summoning day.') };"));
  assert.ok(wm.includes('flow = new ServiceFlowWindow(summonByNameBoxes(summon, (rows, d) => expandRowValues(rows, summonMacroValues(d), null)), {'));
  assert.ok(wm.includes("rows: box(SUMMON_TEXT.areYouSure, daedra, 'Are you sure you wish to attempt this?'),\n        buttons: 'YesNo',\n        onYes: () => summon(daedra),"));
  assert.ok(wm.includes('const r = attemptSummoning({\n          daedra: called,'), 'the Yes summons the prince it is handed - the picked one, or the day\'s');
});
