// M-EXT - user-supplied music, ported from DFU's SoundReplacement.
// Everything here was mutation-proven.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { MidiBsaFile } from '../src/formats/hmiFile.js';
import {
  MUSIC_EXTENSIONS, replacementKey, replacementEntry, indexReplacements,
  replacementFor, hasReplacement, setMusicReplacements, clearMusicReplacements,
  replacementBytes, replacementCount, replacementKeys,
} from '../src/systems/musicReplacement.js';
import { setValue } from '../src/systems/settings.js';
import * as SM from '../src/systems/songManager.js';
import { CONTEXT } from '../tools/musicNames.mjs';

const src = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8');

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;
const on = () => setValue('Enhancements', 'AssetInjection', 'True');
const off = () => setValue('Enhancements', 'AssetInjection', 'False');

test('music: the song key is the archive name without its extension', () => {
  // Playlists carry MIDI.BSA record names; a folder carries whatever
  // the user's tools emitted.
  assert.equal(replacementKey('GDAY___D.HMI'), 'GDAY___D');
  assert.equal(replacementKey('gday___d.hmi'), 'GDAY___D', 'case-insensitive both ways');
  assert.equal(replacementKey('  FPALAC.HMI  '), 'FPALAC', 'trimmed');
  // ONE trailing .HMI, not every one: `A.HMI.HMI` is a legal record
  // name and stripping both would look up the wrong song.
  assert.equal(replacementKey('A.HMI.HMI'), 'A.HMI');
  // a name with no extension is already the key
  assert.equal(replacementKey('MAGIC_2'), 'MAGIC_2');
  assert.equal(replacementKey(null), '');
});

test('music: only audio files are candidates, and a dotfile is not one', () => {
  assert.deepEqual(replacementEntry('GDAY___D.ogg'), { key: 'GDAY___D', ext: 'ogg' });
  assert.deepEqual(replacementEntry('gday___d.MP3'), { key: 'GDAY___D', ext: 'mp3' });
  // a picked directory hands back paths on some browsers
  assert.deepEqual(replacementEntry('pack/songs/FPALAC.flac'), { key: 'FPALAC', ext: 'flac' });
  // the things a real music pack ships alongside the music
  assert.equal(replacementEntry('readme.txt'), null);
  assert.equal(replacementEntry('cover.jpg'), null);
  assert.equal(replacementEntry('LICENSE'), null, 'no extension at all');
  // `.ogg` alone is a DOTFILE, not a song called nothing - dot at 0
  assert.equal(replacementEntry('.ogg'), null);
  assert.equal(replacementEntry(''), null);
});

test('music: DFU\'s `song_` prefix is accepted, so a DFU pack drops in unrenamed', () => {
  // THE SETUP WIN. SoundReplacement asks for `song.ToString()` where
  // `song` is a SongFiles enum value, and those members are named
  // `song_` + the archive record, lowercased (SongFiles.cs) - so every
  // music pack built for Daggerfall Unity is ALREADY named correctly
  // and merely wears that prefix. Rejecting it would mean hand-renaming
  // a hundred files for nothing.
  assert.deepEqual(replacementEntry('song_gday___d.ogg'), { key: 'GDAY___D', ext: 'ogg' });
  assert.deepEqual(replacementEntry('GDAY___D.ogg'), { key: 'GDAY___D', ext: 'ogg' },
    'the bare record name still works - both conventions land on one key');
  assert.deepEqual(replacementEntry('SONG_TAVERN.mp3'), { key: 'TAVERN', ext: 'mp3' },
    'case-insensitive, like every other part of the match');
  // a record whose own name starts with a digit survives the strip
  assert.deepEqual(replacementEntry('song_5strong.ogg'), { key: '5STRONG', ext: 'ogg' });

  // ONLY THE LEADING PREFIX, and only one: this is a strip, not a
  // substring purge, or a record with `song_` inside it would be cut.
  assert.equal(replacementEntry('song_song_x.ogg').key, 'SONG_X');
  assert.equal(replacementEntry('a_song_b.ogg').key, 'A_SONG_B');

  // SAFE BECAUSE THE ARCHIVE SAYS SO: swept over all 131 retail
  // records, none begins with SONG_, so the strip cannot shorten a
  // real name by accident. Pinned as the claim rather than the sweep,
  // which needs ARENA2 - the corpus gate below is the sweep.
  const bothForms = indexReplacements(['song_tavern.ogg', 'TAVERN.mp3']);
  assert.equal(bothForms.size, 1, 'the two spellings are ONE song, not two');
  assert.equal(bothForms.get('TAVERN').ext, 'ogg', 'and preference still decides which wins');
});

test('music: format preference is FIXED, not whichever file was listed last', () => {
  // A pack shipping both .ogg and .mp3 side by side is ordinary, and
  // "whatever the browser enumerated last" is not an answer anyone can
  // predict or reproduce. Ogg leads because it is what DFU seeks.
  assert.equal(MUSIC_EXTENSIONS[0], 'ogg');
  const bothWays = [
    indexReplacements(['GBAD.mp3', 'GBAD.ogg']),
    indexReplacements(['GBAD.ogg', 'GBAD.mp3']),
  ];
  for (const idx of bothWays) assert.equal(idx.get('GBAD').ext, 'ogg');
  // ...and the rule is the ORDER of the list, not ogg specially: with
  // no ogg present, mp3 beats wav in both directions.
  for (const names of [['GBAD.wav', 'GBAD.mp3'], ['GBAD.mp3', 'GBAD.wav']]) {
    assert.equal(indexReplacements(names).get('GBAD').ext, 'mp3');
  }
  // the FILENAME is what gets kept, not the key - it is what loads
  assert.equal(indexReplacements(['pack/GBAD.ogg']).get('GBAD').fileName, 'pack/GBAD.ogg');
});

test('music: DFU\'s AssetInjection gate, and it is checked INSIDE the lookup', () => {
  // SoundReplacement's two import paths both open with
  // `if (DaggerfallUnity.Settings.AssetInjection)`. Checking it at each
  // call site instead would be a call site that forgets, and a player
  // who switched the feature off would still hear replacements.
  const index = indexReplacements(['GBAD.ogg']);
  on();
  assert.equal(replacementFor('GBAD.HMI', index), 'GBAD.ogg');
  off();
  assert.equal(replacementFor('GBAD.HMI', index), null, 'the gate refuses everything');
  on();
  // an empty pick is the DFU default state - no loose files
  assert.equal(replacementFor('GBAD.HMI', new Map()), null);
  assert.equal(replacementFor('GBAD.HMI', null), null);
  // a song the pack does not cover falls through to the built-in
  assert.equal(replacementFor('FPALAC.HMI', index), null);
});

test('music: the registry, and a load failure falls back SILENTLY', () => {
  clearMusicReplacements();
  on();
  assert.equal(replacementCount(), 0);
  assert.equal(hasReplacement('GBAD.HMI'), false);

  const kept = setMusicReplacements(['GBAD.ogg', 'FPALAC.mp3', 'readme.txt'], async () => new Uint8Array([1, 2, 3]));
  assert.equal(kept, 2, 'the readme is not a song');
  assert.equal(replacementCount(), 2);
  assert.deepEqual(replacementKeys(), ['FPALAC', 'GBAD'], 'sorted, so the screen lists them stably');
  assert.equal(hasReplacement('GBAD.HMI'), true);
  assert.equal(hasReplacement('GSHOP.HMI'), false);

  clearMusicReplacements();
  assert.equal(replacementCount(), 0);
});

test('music: replacementBytes NEVER throws - a broken pack costs the track, not the music', async () => {
  on();
  // the happy path
  setMusicReplacements(['GBAD.ogg'], async () => new Uint8Array([1, 2, 3]));
  assert.deepEqual([...(await replacementBytes('GBAD.HMI'))], [1, 2, 3]);

  // a loader that throws - the caller treats null as "play the
  // original", which is what DFU's TryImportSong answering false means
  setMusicReplacements(['GBAD.ogg'], async () => { throw new Error('quota'); });
  assert.equal(await replacementBytes('GBAD.HMI'), null);

  // an EMPTY file is as absent as no file: decodeAudioData on zero
  // bytes throws, and a zero-length track is never what was wanted
  setMusicReplacements(['GBAD.ogg'], async () => new Uint8Array(0));
  assert.equal(await replacementBytes('GBAD.HMI'), null);
  setMusicReplacements(['GBAD.ogg'], async () => null);
  assert.equal(await replacementBytes('GBAD.HMI'), null);

  // registered names but NO loader at all
  setMusicReplacements(['GBAD.ogg'], null);
  assert.equal(await replacementBytes('GBAD.HMI'), null);
  clearMusicReplacements();
});

test('music: the service commits BEFORE the await, or the director storms it', () => {
  // createMusicDirector re-evaluates every frame on
  // `songEnded: !isPlaying()`. The replacement path is async, so if the
  // playing flag stayed down across the load-and-decode the director
  // would read "the song finished" on every frame of the gap and
  // re-request it - restarting the decode each time.
  const m = src('systems/music.js');
  const start = m.slice(m.indexOf('async _startReplacement('));
  const body = start.slice(0, start.indexOf('\n  }'));
  // EXISTS, then ORDER. A first draft asserted only the ordering, and
  // deleting the line entirely passed it: indexOf answers -1 and -1 is
  // less than every real index, so the mutant that removes the commit
  // survived the pin written to catch it.
  const raise = body.indexOf('player.playing = true');
  assert.ok(raise >= 0, 'the commit must be there at all');
  assert.ok(raise < body.indexOf('await'),
    'the playing flag must be raised before the first await');
  // and `playing` must ANSWER for the audio player, not just the MIDI one
  assert.match(m, /get playing\(\) \{ return Boolean\(this\.player\?\.playing \|\| this\._audio\?\.playing\); \}/);
  // a mode change can overtake a decode - the result is dropped, not
  // played over the song that replaced it
  assert.ok((body.match(/this\._current !== name/g) ?? []).length >= 2,
    'the race is re-checked after EACH await');
  // the two players must never sound together
  assert.match(m, /this\.player\?\.stop\(\);\s+\/\/ the MIDI player must not sound underneath/);
  assert.match(m, /this\._audio\?\.stop\(\);\s+\/\/ a replacement must not sound underneath/);
  // ...and stop() stops both, or a replacement outlives the stop
  const stop = m.slice(m.indexOf('  stop() {'));
  assert.match(stop.slice(0, 400), /this\._audio\?\.stop\(\)/);
});

test('music: a replacement OVERRIDES, and a miss falls through to MIDI.BSA', () => {
  // DFU asks TryImportSong before it reaches its own data, and plays
  // the built-in song when the answer is false. The port's shape is
  // the same: one branch, one fallback, one place that loads the
  // archive song.
  const m = src('systems/music.js');
  assert.match(m, /if \(hasReplacement\(name\)\) \{/);
  assert.match(m, /return this\._playBuiltIn\(name\);/);
  // the fallback is reachable from the FAILURE path too, not just the
  // no-replacement path - a pack file that will not decode still plays
  const start = m.slice(m.indexOf('async _startReplacement('));
  assert.match(start.slice(0, start.indexOf('\n  }')), /if \(!buffer\) \{ player\.playing = false; this\._playBuiltIn\(name\); return; \}/);
  // ONE SETTING moves both players (the service's resync); the LAW split
  // on 2026-08-27 (Mac: "fix it also"): the scheduler keeps the FM
  // bank's trim, a replacement - a mastered file - takes the setting
  // alone.
  const sp = src('systems/songPlayer.js');
  assert.equal((sp.match(/this\._master\.gain\.value = musicGain\(\)/g) ?? []).length, 1, 'SongPlayer once, trimmed');
  assert.equal((sp.match(/this\._master\.gain\.value = trackGain\(\);/g) ?? []).length, 2,
    'AudioSongPlayer on build AND on every start, untrimmed');
  assert.doesNotMatch(sp.slice(sp.indexOf('export class AudioSongPlayer')), /musicGain\(\)/, 'the replacement player never reads the trimmed law');
  // the replacement loops, because Daggerfall's songs do
  assert.match(sp, /src\.loop = this\.loop;/);
});

test('music: AssetInjection is a REAL setting now, and the docs cannot say otherwise', () => {
  // It was listed as "no mod system (Ledger C, Not planned)" with the
  // screen showing "Nothing to add yet". It has a consumer now, so the
  // sentence goes - this project's own retiring-a-flag rule, and the
  // tier-map guard fails from the other side if it does not.
  const s = src('systems/settings.js');
  assert.doesNotMatch(s, /'Enhancements\/AssetInjection': 'no mod system/);
  assert.match(s, /'Enhancements\/AssetInjection': 'src\/systems\/musicReplacement\.js'/);
  const copy = src('ui/settingsCopy.js');
  assert.doesNotMatch(copy, /'Enhancements\/AssetInjection': 'Nothing to add yet/);
  // NOTHING SHIPS: the repo carries no audio and the deploy serves none
  assert.match(src('scenes/dataSource.js'), /NOTHING SHIPS WITH THE GAME/);
});

test('music: replacements get their OWN store, away from the download diet', () => {
  // KEEP - the ingest diet - rejects every audio extension by design,
  // and a pin fails if that filter moves without a MANIFEST_V bump. A
  // music pack in the arena2 store would be filtered out at pick time.
  // M-TEX RE-AIMED THIS. The pin used to spell out the music store's
  // own transactions and its own create-if-missing line; the ingest is
  // shared with textures now, so those exact strings are gone while
  // the LAW is unchanged - the pin follows it rather than being
  // loosened. The law: music is a store of its own, not the ARENA2
  // one, and it is reached through the shared asset helpers.
  const d = src('scenes/dataSource.js');
  assert.match(d, /const MUSIC_STORE = 'music';/);
  assert.match(d, /ASSET_STORES = \[MUSIC_STORE, TEXTURE_STORE, MW_STORE\]/,
    'music is an ASSET store, listed apart from the ARENA2 one');
  assert.match(d, /assetNames\(MUSIC_STORE\)/);
  assert.match(d, /assetBytes\(MUSIC_STORE, fileName\)/);
  assert.match(d, /storeAssets\(MUSIC_STORE, files/);
  // the upgrade creates what is MISSING - an existing player arrives on
  // an older version holding a full ARENA2 ingest and must not lose it
  assert.match(d, /indexedDB\.open\(DB_NAME, 4\)/);
  assert.match(d, /if \(!d\.objectStoreNames\.contains\(STORE\)\) d\.createObjectStore\(STORE\);/);
  assert.match(d, /if \(!d\.objectStoreNames\.contains\(name\)\) d\.createObjectStore\(name\);/);
  // clearStoredData is ARENA2 recovery and must NOT sweep the music:
  // re-picking the game files is not asking to lose the pack
  const clear = d.slice(d.indexOf('export async function clearStoredData()'));
  assert.doesNotMatch(clear.slice(0, 400), /MUSIC_STORE/);
  // registration rides the ONE bootstrap all four hosts already call
  assert.match(src('scenes/shared.js'), /setMusicReplacements\(names, loadMusicFile\)/);
});

test('music: every playlist has a human label, or the song table hides songs', () => {
  // tools/musicNames.mjs is what a pack author reads to learn which
  // record is the tavern and which is the palace. Its context labels
  // are keyed by playlist export name, so a playlist added to
  // songManager.js without a label silently drops its songs out of
  // that table - and those records then look like they do not exist.
  // The tool exits non-zero on its own, but a tool nobody runs is not
  // a guard, so the drift is caught here.
  const names = Object.entries(SM)
    .filter(([n, v]) => /^[A-Z_]+_SONGS(_FM)?$/.test(n) && Array.isArray(v))
    .map(([n]) => n.replace(/_FM$/, ''));
  assert.ok(names.length >= 19, `expected the full playlist set, saw ${names.length}`);
  const unlabelled = [...new Set(names)].filter((n) => !CONTEXT[n]);
  assert.deepEqual(unlabelled, [], 'these playlists have no label in tools/musicNames.mjs');
});

test('music: NO retail record collides with the `song_` strip', { skip: skipReal }, () => {
  // The safety claim behind accepting DFU's prefix, swept rather than
  // asserted. If any record were named SONG_something, stripping the
  // prefix would silently point its replacement at a DIFFERENT song -
  // and the failure would be a wrong track playing, which no unit
  // fixture can notice.
  const archive = new MidiBsaFile();
  assert.equal(archive.load(new Uint8Array(readFileSync(join(ARENA2, 'MIDI.BSA')))), true);
  assert.equal(archive.count, 131);

  const names = [];
  for (let i = 0; i < archive.count; i++) names.push(archive.getSongName(i));
  assert.deepEqual(names.filter((n) => /^song_/i.test(n)), [],
    'a record starting with SONG_ would be shortened by the strip');

  // ...and every record round-trips through the matcher BOTH ways -
  // bare, and wearing DFU's prefix - onto its own key.
  for (const record of names) {
    const key = replacementKey(record);
    assert.equal(replacementEntry(`${record.replace(/\.HMI$/i, '')}.ogg`)?.key, key, record);
    assert.equal(replacementEntry(`song_${key.toLowerCase()}.ogg`)?.key, key, `song_ form of ${record}`);
  }
});
