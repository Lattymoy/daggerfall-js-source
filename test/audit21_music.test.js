// AUDIT 21 - the MUSIC-ENGINE lane. Its headline was not a wrong constant: it
// was that createMusicDirector, the single seam through which every host feeds
// SongManager, had ZERO behavioural coverage. Its only pins were source-regex
// sweeps over the host files, and three separate mutations - each of which
// silences a large part of the game - left the whole suite green.
//
// A regex cannot see whether a value is USED. Every pin here drives the real
// director.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMusicDirector } from '../src/scenes/shared.js';
import {
  musicEnvironment, holdEnvironment, environmentForBuilding, MUSIC_ENV,
  MAGES_GUILD_FACTION, TAVERN_SONGS, MAGES_GUILD_SONGS, CASTLE_SONGS,
  DUNGEON_SONGS, SUNNY_SONGS, TEMPLE_GOOD_SONGS, selectSong, dungeonKey,
  SongManager, LOCATION_TYPES,
} from '../src/systems/songManager.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { CLASSIC_GAME_START_MINUTES, MINUTES_PER_DAY, worldMinutes } from '../src/systems/worldTick.js';

/** A director with node-drivable sinks. Nothing in the hosts passes these;
 *  they exist so this file can exercise the seam at all. */
function harness({ fm = false } = {}) {
  const played = [];
  let playing = false;
  const d = createMusicDirector({
    fm,
    play: (name) => { played.push(name); playing = true; },
    stop: () => { playing = false; },
    playing: () => playing,
  });
  return { d, played, endSong: () => { playing = false; } };
}

const OUTDOOR = {
  inside: false, inLocationRect: true, locationType: LOCATION_TYPES.TownCity,
  locationIndex: 1, weather: 'sunny', night: false, gameDays: 0, arrested: false,
};

test('AUDIT 21 music F1: the OVERLAY wins over the base, or interior music is dead', () => {
  // MUTATION (a): reversing the spread in createMusicDirector makes `base`
  // win, so the mode host's inside/buildingType/factionId/dungeonKey are
  // permanently overwritten by the outdoor host's `inside: false` - ALL
  // interior and dungeon music dead. The whole suite stayed green, because
  // AUDIT 21 F1's own pin watches STATEMENT ORDER in the host files
  // (feed-before-modal) and that mutation leaves the order untouched.
  const { d, played } = harness();

  d.update(OUTDOOR, null);
  assert.equal(d.manager.currentPlaylist, SUNNY_SONGS, 'a city street at noon');
  assert.ok(played.length > 0, 'and something actually PLAYED - the play sink is real');

  // the overlay says we are inside a tavern; base still says inside: false
  d.update(OUTDOOR, { inside: true, buildingType: BUILDING_TYPES.Tavern, locationIndex: 1 });
  assert.equal(d.manager.currentPlaylist, TAVERN_SONGS,
    'the overlay must WIN - base carries inside:false on every frame');

  d.update(OUTDOOR, { inside: true, buildingType: BUILDING_TYPES.GuildHall,
    factionId: MAGES_GUILD_FACTION, locationIndex: 1 });
  assert.equal(d.manager.currentPlaylist, MAGES_GUILD_SONGS,
    'and it must carry the FACTION through, not just the building type');

  // a dungeon, and its CASTLE arm
  d.update(OUTDOOR, { inside: true, insideDungeon: true, locationIndex: 2, dungeonKey: 7 });
  assert.equal(d.manager.currentPlaylist, DUNGEON_SONGS);
  d.update(OUTDOOR, { inside: true, insideDungeon: true, insideDungeonCastle: true,
    locationIndex: 2, dungeonKey: 7 });
  assert.equal(d.manager.currentPlaylist, CASTLE_SONGS, 'F3: the Castle arm is reachable');

  // and back outdoors
  d.update(OUTDOOR, null);
  assert.equal(d.manager.currentPlaylist, SUNNY_SONGS);
});

test('AUDIT 21 music F1: a finished song re-issues play (the songEnded feed)', () => {
  // MUTATION (b): `songEnded: false` kills DFU's whole !songPlayer.IsPlaying
  // arm (SongManager.cs:209, :229-230) - a finished song is never replayed
  // and the context is never re-evaluated on song end. Suite stayed green.
  const { d, played, endSong } = harness();
  d.update(OUTDOOR, null);
  const first = played.length;
  assert.ok(first > 0);

  // an identical frame while the song is still playing changes nothing
  d.update(OUTDOOR, null);
  assert.equal(played.length, first, 'no re-issue while the song plays');

  // the song ends; the very next frame must start one again
  endSong();
  d.update(OUTDOOR, null);
  assert.ok(played.length > first, 'a finished song is REPLAYED - the !IsPlaying arm');
});

test('AUDIT 21 music F1: the DEFAULT play sink reaches the music service', async () => {
  // MUTATION (c): `play: () => {}` means no music ever plays anywhere in the
  // game, and the suite did not notice. The harness above injects its sinks,
  // so it cannot see that mutation at all - this one drives the DEFAULT by
  // patching the module singleton the director binds to.
  const { music } = await import('../src/systems/music.js');
  const realPlayFrom = music.playFrom, realStop = music.stop;
  const calls = [];
  try {
    music.playFrom = (names, opts) => { calls.push({ names, opts }); };
    music.stop = () => {};
    Object.defineProperty(music, 'playing', { get: () => false, configurable: true });

    const d = createMusicDirector();          // NO sinks - the shipped shape
    d.update(OUTDOOR, null);
    assert.equal(calls.length, 1, 'the default sink must actually call the music service');
    assert.equal(calls[0].names.length, 1, 'playFrom takes the ONE chosen song');
    assert.ok(SUNNY_SONGS.includes(calls[0].names[0]), `${calls[0].names[0]} came from the playlist`);
    assert.equal(calls[0].names[0], d.manager.currentSong);
  } finally {
    music.playFrom = realPlayFrom;
    music.stop = realStop;
    delete music.playing;
  }
});

test('AUDIT 21 music F1: the play sink reaches the manager (nothing plays without it)', () => {
  // MUTATION (c): `play: () => {}` means no music ever plays anywhere in the
  // game, and the suite did not notice. Assert the NAME, so a sink that fires
  // with nothing is not enough.
  const { d, played } = harness();
  d.update(OUTDOOR, null);
  assert.equal(played.length, 1);
  assert.ok(SUNNY_SONGS.includes(played[0]), `${played[0]} must come from the chosen playlist`);
  assert.equal(played[0], d.manager.currentSong, 'and be the song the manager settled on');
});

test('AUDIT 21 music F2: the interior context carries the FACTION, not just the type', () => {
  // Dropping `factionId` from worldModes.musicContext() made every Mages
  // Guild, every temple of every alignment and every Fighters-Guild trainer
  // hall resolve to the plain interior playlist - the whole TEMPLE_FACTIONS /
  // GOD_FACTIONS / TEMPLE_ALIGNMENTS machinery unreachable - and the suite
  // stayed green. The existing corpus pin proves the pure FOLD is right and
  // says nothing about whether the host hands it the id: the AUDIT 17n shape.
  const { d } = harness();
  const guild = { inside: true, buildingType: BUILDING_TYPES.GuildHall, locationIndex: 1 };
  d.update(OUTDOOR, { ...guild, factionId: MAGES_GUILD_FACTION });
  assert.equal(d.manager.currentPlaylist, MAGES_GUILD_SONGS);
  d.update(OUTDOOR, { ...guild, factionId: 0, locationIndex: 3 });
  assert.notEqual(d.manager.currentPlaylist, MAGES_GUILD_SONGS,
    'faction 0 is not the Mages Guild - so the id is genuinely being read');

  // an Arkay temple (faction 0x52 = 82) is a GOOD-aligned temple
  d.update(OUTDOOR, { inside: true, buildingType: BUILDING_TYPES.Temple, factionId: 82, locationIndex: 4 });
  assert.equal(d.manager.currentPlaylist, TEMPLE_GOOD_SONGS);
});

test('AUDIT 21 music F4: an unresolved temple HOLDS the environment, it does not force Interior', () => {
  // SongManager.cs:494-518 has no else on the temple arm, so
  // currentContext.environment persists - walk into an unresolvable temple
  // from a city street and the CITY track keeps playing. 10 of the real
  // corpus's 2,980 Temple buildings carry factionId 0 and reach this line.
  assert.equal(environmentForBuilding(BUILDING_TYPES.Temple, { factionId: 0 }), null,
    'null is "DFU writes nothing here"');
  assert.equal(holdEnvironment(null, MUSIC_ENV.City), MUSIC_ENV.City);
  assert.equal(holdEnvironment(MUSIC_ENV.Tavern, MUSIC_ENV.City), MUSIC_ENV.Tavern);
  // no previous at all is DFU's unset context, which reads Wilderness
  assert.equal(holdEnvironment(null, null), MUSIC_ENV.Wilderness);

  // and through the DIRECTOR, which is where the hold actually lives
  const { d } = harness();
  d.update(OUTDOOR, null);
  const cityPlaylist = d.manager.currentPlaylist;
  assert.equal(cityPlaylist, SUNNY_SONGS);
  d.update(OUTDOOR, { inside: true, buildingType: BUILDING_TYPES.Temple, factionId: 0, locationIndex: 1 });
  assert.equal(d.manager.currentPlaylist, cityPlaylist,
    'the city track keeps playing - the port used to cut to the interior list');
});

test('AUDIT 21 music F11: the clock starts at the CLASSIC EPOCH, so day one is 363', () => {
  // DaggerfallDateTime.classicGameStartTime = 523530 (:30), applied by
  // SetClassicGameStartTime (:491-494) - 13:30, 4th Morning Star, 3E405.
  // The port started at 0, and gameDays is BOTH the DFRandom seed for every
  // non-dungeon playlist AND the tavern list index, so every song on a given
  // in-game date differed from DFU's.
  assert.equal(CLASSIC_GAME_START_MINUTES, 523530);
  // and the CLOCK must actually start there - the constant alone is inert if
  // _worldMinutes is still initialised to 0. Nothing in this file moves the
  // clock, and node runs each test file in its own process.
  assert.equal(worldMinutes(), CLASSIC_GAME_START_MINUTES,
    'a fresh module starts at the classic epoch, not at zero');
  const day = Math.floor(CLASSIC_GAME_START_MINUTES / MINUTES_PER_DAY);
  assert.equal(day, 363, 'a new game begins on day 363, not day 0');

  // the tavern index is gameDays % length, so the two epochs pick differently
  const atEpoch = selectSong(TAVERN_SONGS, { gameDays: day, tavern: true });
  const atZero = selectSong(TAVERN_SONGS, { gameDays: 0, tavern: true });
  assert.equal(atEpoch.index, day % TAVERN_SONGS.length);
  assert.notEqual(atEpoch.name, atZero.name,
    'day 363 and day 0 pick different tavern songs - which is the whole finding');
});

test('AUDIT 21 music F7: the tavern index is a UINT, so a negative day does not fall off', () => {
  // AUDIT 19 F5 added the `>>> 0` because C# reads gameDays as a uint; the
  // existing pin walked d = 0..9 and never reached the branch the fix exists
  // for, so reverting it left the suite green. setWorldMinutes documents that
  // it accepts a load moving the clock BACK.
  const neg = selectSong(TAVERN_SONGS, { gameDays: -1, tavern: true });
  assert.equal(neg.index, 0xFFFFFFFF % TAVERN_SONGS.length, 'gameDays is a UINT in C#');
  assert.ok(TAVERN_SONGS.includes(neg.name), 'and never lands off the end of the list');
  assert.notEqual(neg.name, undefined);
});

test('AUDIT 21 music F5: a NEW LOCATION re-picks, on the same day', () => {
  // The existing test carrying this name says so itself: "what proves the
  // re-pick happened is that the manager took the branch at all, which a
  // changed DAY makes audible" - so `dayChanged` carried the assertion and
  // deleting `|| locationChanged` left the suite green. Inside a dungeon the
  // seed is the dungeonKey, so the day can be held fixed.
  const played = [];
  const sm = new SongManager({ play: (n) => played.push(n), stop: () => {} });
  const D = { environment: MUSIC_ENV.DungeonInterior, weather: 'sunny', night: false,
    gameDays: 5, arrested: false };
  sm.update({ ...D, locationIndex: 1, dungeonKey: dungeonKey(0x1111, 3) });
  const first = sm.currentSong;
  sm.update({ ...D, locationIndex: 2, dungeonKey: dungeonKey(0x9999, 17) });
  assert.notEqual(sm.currentSong, first,
    'a new location re-picks even when the day has not changed');
  assert.ok(DUNGEON_SONGS.includes(sm.currentSong));
});

test('AUDIT 21 music F6: the Mages Guild re-rolls UNSEEDED on every entry', () => {
  // SongManager.cs:361-366 - "Mages Guild uses a random track each time",
  // UnityEngine.Random rather than the day seed. `unseeded = false` left the
  // suite green and the word "unseeded" appeared nowhere in the tests: the
  // two-entry list would play ONE of its songs for a whole game day.
  const rolls = [0.1, 0.9, 0.1];
  let i = 0;
  const sm = new SongManager({ play: () => {}, stop: () => {}, random: () => rolls[i++ % rolls.length] });
  const G = { environment: MUSIC_ENV.MagesGuild, weather: 'sunny', night: false,
    gameDays: 7, arrested: false };
  const seen = [];
  for (const loc of [1, 2, 3]) {
    sm.update({ ...G, locationIndex: loc });
    seen.push(sm.currentSong);
  }
  assert.equal(seen[0], MAGES_GUILD_SONGS[0]);
  assert.equal(seen[1], MAGES_GUILD_SONGS[1], 'same day, DIFFERENT song - not the day seed');
  assert.equal(seen[2], MAGES_GUILD_SONGS[0]);
});

// ---------------------------------------------------------------------------
// THE HOST HALF, as a RULE.
//
// The pins above drive createMusicDirector directly, which is the only way to
// get behavioural coverage of the music engine in node - and it is exactly
// what the lane's F1 showed was missing. But it cannot see the OTHER half of
// F2 and F3: a host that stops FEEDING a field. Dropping `factionId` from
// worldModes.musicContext(), or hardcoding `insideDungeonCastle: false` again,
// leaves every behavioural pin here green because the fold is still correct -
// the host simply stops handing it the input. That is the AUDIT 17n shape.
//
// The six scene hosts have zero node execution coverage, so a structural rule
// is what is available. It is deliberately written as a FIELD-SET comparison
// rather than a substring match: a rule that greps for the word "factionId"
// passes on `factionId: 0`, which is the mutation that has to be caught.
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (p) => readFileSync(join(SRC, p), 'utf8');

test('AUDIT 21 music F2/F3: the hosts FEED the fields the fold reads', () => {
  const modes = read('scenes/worldModes.js');
  const dungeon = read('scenes/dungeon.js');

  // F2: the interior arm must pass the building's OWN faction id, not a
  // literal. `factionId: 0` is a valid-looking line that makes every Mages
  // Guild, every temple and every trainer hall resolve to the plain interior.
  assert.match(modes, /factionId:\s*interiorBuilding\?\.factionId\s*\?\?\s*0,/,
    'worldModes.musicContext must read the building record, not hand over a constant');
  assert.match(modes, /buildingType:\s*interiorBuilding\?\.buildingType\s*\?\?\s*-1,/);

  // F3: BOTH dungeon-music call sites must read the live castle flag. Each
  // one hardcoded `false`, which made MUSIC_ENV.Castle unreachable and
  // CASTLE_SONGS a dead constant.
  assert.match(modes, /insideDungeonCastle:\s*dungeonCtx\?\.inCastle/,
    'worldModes must read the castle flag off the dungeon context');
  assert.match(dungeon, /insideDungeonCastle:\s*ctx\.inCastle/,
    'dungeon.js is the second call site and had the same hardcoded false');
  for (const [name, text] of [['worldModes.js', modes], ['dungeon.js', dungeon]]) {
    assert.doesNotMatch(text, /insideDungeonCastle:\s*(false|true)\b/,
      `${name} must not hand the castle arm a literal again`);
  }

  // and the PRODUCER exists, off the block the player is standing in
  const ctx = read('scenes/dungeonContext.js');
  assert.match(ctx, /function castleBlockAt\(/, 'the block lookup');
  assert.match(ctx, /get inCastle\(\)/, 'exposed on the context');
  assert.match(ctx, /inCastle:\s*castleBlockAt\(/,
    'and fed to the ambient one-shots too - doNotPlayInCastle was read by nobody');
});

test('M-FM: Audio/AlternateMusic reaches the playlists, through ONE read', () => {
  // THE WHOLE FEATURE WAS BUILT AND NOTHING JOINED IT. Every FM
  // playlist has been ported since A5, outdoorPlaylist and playlistFor
  // have branched on `fm` all along, SongManager has taken it, and
  // createMusicDirector has accepted and forwarded it - while all
  // three hosts called createMusicDirector() with no arguments, so the
  // checkbox the settings screen offers moved nothing at all.
  const shared = readFileSync(new URL('../src/scenes/shared.js', import.meta.url), 'utf8');
  assert.match(shared, /getBool\('Audio', 'AlternateMusic'\)/,
    'the setting must be read');
  // ...in the FACTORY, not at the call sites. Three call sites are
  // three chances to forget; one read is none.
  const factory = shared.slice(shared.indexOf('export function createMusicDirector'));
  assert.match(factory.slice(0, 1600), /getBool\('Audio', 'AlternateMusic'\)/,
    'the read belongs inside createMusicDirector');
  for (const host of ['world.js', 'exterior.js', 'dungeon.js']) {
    const h = readFileSync(new URL(`../src/scenes/${host}`, import.meta.url), 'utf8');
    assert.match(h, /createMusicDirector\(\)/, `${host} still calls it bare - and now gets the setting`);
    assert.doesNotMatch(h, /getBool\('Audio', 'AlternateMusic'\)/,
      `${host} must NOT read the setting itself - that is the shape this fixes`);
  }
});

test('M-FM: null asks the setting, an explicit flag overrides it', async () => {
  const { createMusicDirector } = await import('../src/scenes/shared.js');
  const { setValue } = await import('../src/systems/settings.js');
  const { DUNGEON_SONGS, DUNGEON_SONGS_FM } = await import('../src/systems/songManager.js');
  // The FM set is a DIFFERENT set, or none of this is observable.
  assert.notDeepEqual([...DUNGEON_SONGS], [...DUNGEON_SONGS_FM]);

  const played = [];
  const build = (opts) => createMusicDirector({
    play: (n) => played.push(n), stop: () => {}, playing: () => false, ...opts,
  });
  // The director DERIVES the environment (musicEnvironment) rather than
  // taking one - a first draft passed `environment: 'dungeonInterior'`
  // straight in and got the outdoor day song, because that field is
  // simply not an input. Driven the way this file's other pins do it.
  const drive = (d) => {
    played.length = 0;
    d.update(OUTDOOR, { inside: true, insideDungeon: true, locationIndex: 2, dungeonKey: 7 });
    return played[0] ?? null;
  };

  setValue('Audio', 'AlternateMusic', 'False');
  const gm = drive(build({}));
  setValue('Audio', 'AlternateMusic', 'True');
  const fm = drive(build({}));
  assert.ok(gm && fm, 'both settings must actually pick a song');
  assert.notEqual(gm, fm, 'the setting must change which song plays');
  assert.ok(DUNGEON_SONGS.includes(gm), `off should play the General MIDI set, got ${gm}`);
  assert.ok(DUNGEON_SONGS_FM.includes(fm), `on should play the FM set, got ${fm}`);

  // An explicit flag is an override, whichever way the setting sits -
  // which is what makes the existing fm-driven pins independent of it.
  setValue('Audio', 'AlternateMusic', 'True');
  assert.ok(DUNGEON_SONGS.includes(drive(build({ fm: false }))), 'fm:false overrides the setting');
  setValue('Audio', 'AlternateMusic', 'False');
  assert.ok(DUNGEON_SONGS_FM.includes(drive(build({ fm: true }))), 'fm:true overrides the setting');
  setValue('Audio', 'AlternateMusic', 'False');
});
