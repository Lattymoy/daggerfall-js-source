// MUSIC-BOX (2026-10-31): the tunes collected (systems/musicBox.js), the station that makes a piece a box (net/decorLaw.js), its
// press (scenes/musicBoxPress.js), its score in the world host's music chain, and the Collections page's Tunes part.
// Recorded in bible/06-Systems/Online-Arc.md MUSIC-BOX.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MUSIC_TUNES, MUSIC_STATION, MUSIC_BOX_PICKS_MAX, tuneOfSong, tuneName, readMusicBox, noteTuneHeard, tunesHeard,
  tuneCount, tunesHeld, boxPick, setBoxPick, createMusicBoxScore, _resetMusicBoxForTests, MUSIC_SHEET_TEMPLATE, MUSIC_SHEET_CHANCE,
  mintSheet, sheetTuneOf, sheetFind, readSheet, sheetForKill, MUSIC_SHEET_TEXT,
} from '../../src/systems/musicBox.js';
import { templateByIndex, itemUseHandler } from '../../src/systems/item/itemTemplates.js';
import { reportPlayerKill } from '../../src/systems/playerKills.js';
import { setPlayerDoor } from '../../src/systems/playerDoor.js';
import { DECOR_STATIONS, DECOR_STATION_FEES, DECOR_STATION_NAMES, decorPlaceOf } from '../../src/net/decorLaw.js';
import { stationsOffered, decorStationWords } from '../../src/ui/decorPanel.js';
import { modSaveRecords, restoreModSaveRecords } from '../../src/systems/modSaveData.js';
import { openMusicBox, MUSIC_BOX_TEXT } from '../../src/scenes/musicBoxPress.js';
import { _setListPickerArtForTests } from '../../src/ui/listPicker.js';
import { gatheredCount, GATHERED_PARTS } from '../../src/ui/collections/gatheredPart.js';
import { TAVERN_SONGS, SUNNY_SONGS, DUNGEON_SONGS } from '../../src/systems/song/songManager.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('MUSIC-BOX the tunes: the General MIDI songs of the playlists, each once, named by the first place the game plays them; no FM record, no quest-only song (mutants: a list unread; a song twice; the names off)', () => {
  const keys = MUSIC_TUNES.map((x) => x.key);
  assert.equal(new Set(keys).size, keys.length, 'each once');
  assert.equal(keys.length, 62);
  for (const name of [...TAVERN_SONGS, ...SUNNY_SONGS, ...DUNGEON_SONGS]) assert.ok(keys.includes(name.replace(/\.HMI$/, '')), name);
  assert.ok(!keys.some((k) => /FM/.test(k)), 'no FM record');
  assert.ok(!keys.includes('D1'), 'no quest-only song');
  assert.deepEqual([tuneName('GDAY___D'), tuneName('FOLK1'), tuneName('GSHOP'), tuneName('23'), tuneName('28')], ['Day 1', 'Tavern 3', 'Shop', 'House', 'Dungeon 15']);
});

test('MUSIC-BOX an FM twin is its General MIDI tune: NNFM is NN, F... is G..., and the FM-only names by their place (mutants: the twin rules unread)', () => {
  assert.deepEqual(['12FM.HMI', 'FPALAC.HMI', 'FCURSE.HMI', 'FM_SUNNY.HMI', 'FM_DNGN3.HMI', 'FM_NITE3.HMI', 'TAVERN.HMI', 'D1.HMI', 'nope', null].map(tuneOfSong),
    ['12', 'GPALAC', 'GCURSE', 'SUNNYDAY', 'DUNGEON7', 'GMAGE_3', 'TAVERN', null, null, null]);
});

test('MUSIC-BOX collected once, on the first day heard, kept in the save\'s per-mod slot and read back by its law (mutants: a second hearing moves the day; the slot unregistered; a bad row kept)', () => {
  _resetMusicBoxForTests();
  assert.equal(noteTuneHeard('FOLK1.HMI', 20_000), true);
  assert.equal(noteTuneHeard('FOLK1.HMI', 20_005), false, 'once');
  assert.equal(noteTuneHeard('12FM.HMI', 20_001), true, 'the FM twin collects its tune');
  assert.equal(noteTuneHeard('D1.HMI', 20_001), false);
  assert.deepEqual(tunesHeard(), { FOLK1: 20_000, 12: 20_001 });
  assert.deepEqual(tunesHeld(), ['12', 'FOLK1'], 'in the list\'s order');
  assert.deepEqual(tuneCount(), { held: 2, total: 62 });
  const rec = modSaveRecords().musicBox;
  assert.deepEqual(rec.tunes, { FOLK1: 20_000, 12: 20_001 });
  _resetMusicBoxForTests();
  restoreModSaveRecords({ musicBox: rec });
  assert.deepEqual(tunesHeard(), { FOLK1: 20_000, 12: 20_001 }, 'a load puts them back');
  restoreModSaveRecords({});
  assert.deepEqual(tunesHeard(), {}, 'a save with none starts empty');
  assert.deepEqual(readMusicBox({ tunes: { FOLK1: -1, NOPE: 3, TAVERN: 1.5, GSHOP: 4 }, picks: { 'a b': 'GSHOP', ok1: 'NOPE', ok2: 'GSHOP' } }), { tunes: { GSHOP: 4 }, picks: { ok2: 'GSHOP' } });
});

test('MUSIC-BOX a box plays a tune collected or nothing; the newest MUSIC_BOX_PICKS_MAX picks are kept (mutants: an uncollected tune picked; the cap unread)', () => {
  _resetMusicBoxForTests({ tunes: { FOLK1: 1, GSHOP: 2 } });
  assert.equal(setBoxPick('box1', 'TAVERN'), false, 'not collected');
  assert.equal(setBoxPick('box1', 'FOLK1'), true);
  assert.equal(boxPick('box1'), 'FOLK1');
  assert.equal(setBoxPick('box1', null), true);
  assert.equal(boxPick('box1'), null, 'off: the room\'s own music');
  assert.equal(setBoxPick('bad id', 'FOLK1'), false);
  for (let i = 0; i < MUSIC_BOX_PICKS_MAX + 3; i++) setBoxPick(`b${i}`, 'GSHOP');
  assert.equal(boxPick('b0'), null, 'the oldest goes');
  assert.equal(boxPick(`b${MUSIC_BOX_PICKS_MAX + 2}`), 'GSHOP');
  assert.equal(readMusicBox({ tunes: { GSHOP: 1 }, picks: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`b${i}`, 'GSHOP'])) }).picks.b39, 'GSHOP');
});

test('MUSIC-BOX the score: a picked box in the room holds the music, its tune asked each frame (so it loops); the frame it is gone the tune fades and the director plays; a song only heard is never collected (mutants: the room unread; no fade; a song heard collected)', () => {
  _resetMusicBoxForTests({ tunes: { FOLK1: 1 } });
  const calls = [];
  const music = { playing: true, current: 'GSHOP.HMI', playSong: (n) => calls.push(['play', n]), fadeOut: () => calls.push(['fade']) };
  let inRoom = false;
  const score = createMusicBoxScore({ music, here: (id) => inRoom && id === 'box1' });
  assert.equal(score.frame(), false, 'no pick: the director');
  assert.deepEqual(tunesHeard(), { FOLK1: 1 }, 'the owner: a collectable, not given - hearing the shop\'s song collects nothing');
  setBoxPick('box1', 'FOLK1');
  assert.equal(score.frame(), false, 'picked, but not in this room');
  inRoom = true;
  music.current = 'TAVERN.HMI';
  assert.equal(score.frame(), true);
  assert.equal(score.frame(), true);
  assert.deepEqual(calls, [['play', 'FOLK1.HMI'], ['play', 'FOLK1.HMI']]);
  inRoom = false;
  assert.equal(score.frame(), false);
  assert.deepEqual(calls.at(-1), ['fade'], 'let go by a fade');
  assert.equal(score.frame(), false);
  assert.equal(calls.filter(([k]) => k === 'fade').length, 1, 'once');
});

test('MUSIC-BOX the station: after the cooking station so the stations counted from the end stand, a tenth of a craft\'s licence, named so; the service keeps it; offered offline and in a caravan or a ship (mutants: no music station; the fee moved)', () => {
  assert.equal(MUSIC_STATION, 'music');
  assert.equal(DECOR_STATIONS.indexOf('music'), DECOR_STATIONS.indexOf('cooking') + 1);
  assert.equal(DECOR_STATIONS.at(-4), 'loom');
  assert.equal(DECOR_STATION_FEES.music, 5_000);
  assert.equal(DECOR_STATION_NAMES.music, 'Music box');
  assert.deepEqual(decorStationWords(null, 'music'), { pick: 'Station: Music box >', act: 'Make station - 5,000 gold', what: 'station:music' });
  assert.equal(decorPlaceOf({ pos: [1, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 120, station: 'music' })?.station, 'music');
  assert.ok(stationsOffered().includes('music'));
  assert.ok(stationsOffered(false).includes('music'));
});

test('MUSIC-BOX the press: no tunes says so and opens nothing; else the list is Off then each tune collected, the one playing marked, and a pick is the box\'s (mutants: the list unordered; the pick unkept; the mark unread)', () => {
  const said = [], shown = [];
  const deps = { show: (w) => shown.push(w), say: (l) => said.push(l) };
  _resetMusicBoxForTests();
  assert.equal(openMusicBox('box1', deps), null);
  assert.deepEqual(said, [MUSIC_BOX_TEXT.none]);
  _setListPickerArtForTests({});
  try {
    _resetMusicBoxForTests({ tunes: { FOLK1: 1, GDAY___D: 2 }, picks: { box1: 'FOLK1' } });
    const win = openMusicBox('box1', deps);
    assert.equal(shown[0], win);
    assert.deepEqual(win.items, [MUSIC_BOX_TEXT.quiet, 'Day 1', '* Tavern 3']);
    assert.equal(win.selectedIndex, 2);
    win.onPick(1);
    assert.equal(boxPick('box1'), 'GDAY___D');
    assert.equal(said.at(-1), 'The music box plays Day 1.');
    win.onPick(0);
    assert.equal(boxPick('box1'), null);
  } finally { _setListPickerArtForTests(null); }
});

test('MUSIC-BOX the hosts: the interior host opens a box after a piece\'s own use and before any station and says which piece is a box in this room; the world host runs the box\'s score last before the director; Collections lists the Tunes (mutants: unwired)', () => {
  const modes = src('src/scenes/worldModes.js'), world = src('src/scenes/world.js');
  assert.match(modes, /if \(piece\?\.station === MUSIC_STATION\) return void openMusicBox\(piece\.id \?\? id, \{ show: mountInterior, say \}\);/);
  assert.ok(modes.indexOf('openMusicBox(piece.id') < modes.indexOf('if (piece?.station) { useDecorStation(piece); return; }'));
  assert.match(modes, /musicBoxHere: \(id\) => mode === 'interior' && interiorDecor\.pieceOf\(id\)\?\.station === MUSIC_STATION/);
  assert.match(world, /!soundscape\.scoreFrame\(\) && !musicBoxScore\.frame\(\)\) musicDirector\.update\(/);
  assert.ok(GATHERED_PARTS.some(([id]) => id === 'tunes'));
  _resetMusicBoxForTests({ tunes: { FOLK1: 1 } });
  assert.deepEqual(gatheredCount('tunes', null), { held: 1, total: 62 });
});

test('MUSIC-BOX the sheet: an item of its own (1830, DFU\'s Parchment\'s picture, sold for a little) carrying its tune; read, it collects the tune and is spent; a tune known keeps the sheet to sell; the Use is registered (mutants: the sheet unspent; a known sheet spent; the handler unregistered)', () => {
  const row = templateByIndex(MUSIC_SHEET_TEMPLATE);
  assert.deepEqual([row?.name, row?.worldTextureArchive, row?.worldTextureRecord, row?.basePrice, row?.rarity], ['Sheet music', 209, 8, 25, 10]);
  _resetMusicBoxForTests();
  const sheet = mintSheet('FOLK1');
  assert.equal(sheetTuneOf(sheet), 'FOLK1');
  assert.equal(sheet.name, 'Sheet music: Tavern 3');
  assert.equal(mintSheet('NOPE'), null);
  const pack = [sheet];
  assert.deepEqual(itemUseHandler(MUSIC_SHEET_TEMPLATE)(sheet, pack), { kind: 'text', text: MUSIC_SHEET_TEXT.learned('Tavern 3') });
  assert.deepEqual(pack, [], 'spent');
  assert.ok(Object.hasOwn(tunesHeard(), 'FOLK1'));
  const again = mintSheet('FOLK1'), pack2 = [again];
  assert.deepEqual(readSheet(again, pack2), { kind: 'text', text: MUSIC_SHEET_TEXT.known('Tavern 3') });
  assert.deepEqual(pack2, [again], 'kept to sell');
});

test('MUSIC-BOX the find: a kill of my blow drops a sheet into my pack MUSIC_SHEET_CHANCE of the time, once a body, said on the HUD; a tune not yet held three times in four (mutants: the chance unread; a body rolled twice; the new share unread)', () => {
  assert.equal(MUSIC_SHEET_CHANCE, 1 / 40);
  _resetMusicBoxForTests({ tunes: Object.fromEntries(MUSIC_TUNES.slice(1).map((x) => [x.key, 1])) });
  const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
  assert.equal(sheetFind(seq(0.5, 0.99)), MUSIC_TUNES[0].key, 'the one not held');
  assert.equal(sheetFind(seq(0.8, 0.99)), MUSIC_TUNES.at(-1).key, 'past the share: any tune');
  const me = { items: [] }, said = [];
  const door = { player: () => me, say: (l) => said.push(l) };
  assert.equal(sheetForKill({}, door, seq(MUSIC_SHEET_CHANCE)), null, 'at the chance: none');
  assert.equal(sheetForKill({}, door, seq(0, 0.5, 0)), me.items[0]);
  assert.equal(sheetTuneOf(me.items[0]), MUSIC_TUNES[0].key);
  assert.deepEqual(said, [MUSIC_SHEET_TEXT.found(tuneName(MUSIC_TUNES[0].key))]);
  const body = {};
  sheetForKill(body, door, seq(0.5));
  assert.equal(sheetForKill(body, door, seq(0, 0, 0)), null, 'once a body');
  setPlayerDoor(door);
  const was = Math.random;
  try {
    Math.random = () => 0;
    reportPlayerKill({}, { kind: 'melee' });
  } finally { Math.random = was; setPlayerDoor(null); }
  assert.equal(me.items.length, 2, 'the kill listener is registered');
});
