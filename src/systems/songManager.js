// A5: SongManager.cs's playlists and SelectCurrentSong - VERBATIM.
//
// This is the half of music that DOES have a source law, and it is worth
// separating from the half that does not. gmSynth.js is ours because DFU
// ships its own SoundFont and there is nothing to port. THIS file is a
// straight port: the playlists are DFU's arrays in DFU's order, and
// SelectCurrentSong is DFU's algorithm on the port's own DFRandom.
//
// The song NAMES are the MIDI.BSA record names. DFU's SongFiles enum
// spells them song_gday___d and so on; the archive spells them
// GDAY___D.HMI, and hmiFile.js keys on the record name, so the tables
// carry the archive's spelling. Nothing is renamed and nothing is
// reordered - a duplicate entry is a duplicate here too, because a
// duplicate changes the odds that a random index lands on that song.
// _dungeonSongsFM lists song_fm_dngn1 twice and song_15fm twice; classic
// duplicates song_10 into the night list. Those are DFU's arrays, so
// they are ours.
//
// TWO SELECTION ARMS ARE NOT PORTABLE AS WRITTEN and say so at their
// site: SneakingSongs/MagesGuildSongs use UnityEngine.Random, which is
// unseeded frame-to-frame state we do not have and would not want (the
// slot-0 reroll departure already covers this shape); and the dungeon
// arm needs the dungeon block's Unknown2 header field, which the port
// reads but does not thread to a music layer yet. Both fall back to the
// day-seeded arm, which is DFU's own "most other places" branch, and
// both are flagged rather than invented.

import { srand, rand } from '../formats/dfRandom.js';

/** Dungeon interiors. SongManager.cs:666-681. */
export const DUNGEON_SONGS = Object.freeze([
  'DUNGEON.HMI', 'DUNGEON5.HMI', 'DUNGEON6.HMI', 'DUNGEON7.HMI', 'DUNGEON8.HMI',
  'DUNGEON9.HMI', 'GDNGN10.HMI', 'GDNGN11.HMI', 'GDUNGN4.HMI', 'GDUNGN9.HMI',
  '04.HMI', '05.HMI', '07.HMI', '15.HMI', '28.HMI',
]);

/** Dungeon, FM. SongManager.cs:817-840 - song_fm_dngn1 and song_15fm
 *  each appear TWICE in DFU's array. Preserved: a duplicate doubles that
 *  song's odds, so removing it would change the selection. */
export const DUNGEON_SONGS_FM = Object.freeze([
  'FM_DNGN1.HMI', 'FM_DNGN1.HMI', 'FM_DNGN2.HMI', 'FM_DNGN3.HMI', 'FM_DNGN4.HMI',
  'FM_DNGN5.HMI', 'FDNGN10.HMI', 'FDNGN11.HMI', 'FDUNGN4.HMI', 'FDUNGN9.HMI',
  '04FM.HMI', '05FM.HMI', '07FM.HMI', '15FM.HMI', '15FM.HMI',
]);

/** Sunny. SongManager.cs:686-694. */
export const SUNNY_SONGS = Object.freeze([
  'GDAY___D.HMI', 'SWIMMING.HMI', 'GSUNNY2.HMI', 'SUNNYDAY.HMI',
  '02.HMI', '03.HMI', '22.HMI',
]);

/** Sunny, FM. SongManager.cs:697-705. */
export const SUNNY_SONGS_FM = Object.freeze([
  'FDAY___D.HMI', 'FM_SWIM2.HMI', 'FM_SUNNY.HMI', '02FM.HMI', '03FM.HMI', '22FM.HMI',
]);

/** Cloudy. SongManager.cs:709-720. */
export const CLOUDY_SONGS = Object.freeze([
  'GDAY___D.HMI', 'SWIMMING.HMI', 'GSUNNY2.HMI', 'SUNNYDAY.HMI',
  '02.HMI', '03.HMI', '22.HMI', '29.HMI', '12.HMI',
]);

/** Cloudy, FM. SongManager.cs:723-733. */
export const CLOUDY_SONGS_FM = Object.freeze([
  'FDAY___D.HMI', 'FM_SWIM2.HMI', 'FM_SUNNY.HMI',
  '02FM.HMI', '03FM.HMI', '22FM.HMI', '29FM.HMI', '12FM.HMI',
]);

/** Overcast/fog. SongManager.cs:736-743. */
export const OVERCAST_SONGS = Object.freeze([
  '29.HMI', '12.HMI', '13.HMI', 'GPALAC.HMI', 'OVERCAST.HMI',
]);

/** Overcast/fog, FM. SongManager.cs:746-753. */
export const OVERCAST_SONGS_FM = Object.freeze([
  '29FM.HMI', '12FM.HMI', '13FM.HMI', 'FPALAC.HMI', 'FMOVER_C.HMI',
]);

/** Rain. SongManager.cs:756-761 - OVERLONG is DFU's noted "long version
 *  of overcast". */
export const RAIN_SONGS = Object.freeze(['OVERLONG.HMI', 'RAINING.HMI', '08.HMI']);

/** Rain, FM. SongManager.cs:857-862. */
export const RAIN_SONGS_FM = Object.freeze(['FMOVER_C.HMI', 'FM_RAIN.HMI', '08FM.HMI']);

/** Snow. SongManager.cs:764-770 - SNOWING is DFU's noted "not used in
 *  classic", kept because the array is the law, not our reading of it. */
export const SNOW_SONGS = Object.freeze([
  '20.HMI', 'GSNOW__B.HMI', 'OVERSNOW.HMI', 'SNOWING.HMI',
]);

/** Snow, FM. SongManager.cs:865-870. */
export const SNOW_SONGS_FM = Object.freeze(['20FM.HMI', 'FSNOW__B.HMI', 'FMOVER_S.HMI']);

/** Sneaking - DFU's own comment says classic does not use it. :773-782. */
export const SNEAKING_SONGS = Object.freeze([
  'GSNEAK2.HMI', 'SNEAKING.HMI', 'SNEAKNG2.HMI', '16.HMI', '09.HMI', '25.HMI', '30.HMI',
]);

/** Sneaking, FM. :873-881 - FSNEAK2 appears TWICE, with DFU's note that
 *  FMSNEAK2 is Arena's home-trespass cue. Preserved. */
export const SNEAKING_SONGS_FM = Object.freeze([
  'FSNEAK2.HMI', 'FMSNEAK2.HMI', 'FSNEAK2.HMI', '16FM.HMI', '09FM.HMI', '25FM.HMI', '30FM.HMI',
]);

/** Temples, by alignment. SongManager.cs:785-798. */
export const TEMPLE_GOOD_SONGS = Object.freeze(['GGOOD.HMI']);
export const TEMPLE_NEUTRAL_SONGS = Object.freeze(['GNEUT.HMI']);
export const TEMPLE_BAD_SONGS = Object.freeze(['GBAD.HMI']);
export const TEMPLE_GOOD_SONGS_FM = Object.freeze(['FGOOD.HMI']);
export const TEMPLE_NEUTRAL_SONGS_FM = Object.freeze(['FNEUT.HMI']);
export const TEMPLE_BAD_SONGS_FM = Object.freeze(['FBAD.HMI']);

/** Taverns. SongManager.cs:801-808. */
export const TAVERN_SONGS = Object.freeze([
  'SQUARE_2.HMI', 'TAVERN.HMI', 'FOLK1.HMI', 'FOLK2.HMI', 'FOLK3.HMI',
]);

/** Night. SongManager.cs:811-820. DFU's comment on the last entry: for
 *  general midi song_10 is DUPLICATED here in classic, although song_21fm
 *  is used in FM mode. DFU lists song_21; so do we. */
export const NIGHT_SONGS = Object.freeze([
  '10.HMI', '11.HMI', 'GCURSE.HMI', 'GEERIE.HMI', 'GRUINS.HMI', '18.HMI', '21.HMI',
]);

/** Day, FM. SongManager.cs:843-854. */
export const DAY_SONGS_FM = Object.freeze([
  'FDAY___D.HMI', 'FM_SWIM2.HMI', 'FM_SUNNY.HMI', '02FM.HMI', '03FM.HMI',
  '22FM.HMI', '29FM.HMI', '12FM.HMI', '13FM.HMI', 'FPALAC.HMI',
]);

/**
 * SelectCurrentSong, verbatim (SongManager.cs:330-378).
 *
 *   - the TAVERN list indexes on gameDays directly, so every tavern
 *     shares a song for the day and they walk in sequence day to day;
 *   - the DUNGEON list seeds DFRandom with `unknown2 ^ (region << 8)`,
 *     the dungeon block header field - see `dungeonKey` below;
 *   - a list of ONE returns index 0 without touching the generator, so
 *     the temple lists never disturb DFRandom's state;
 *   - everything else seeds DFRandom with gameDays, so a location's song
 *     is stable for a whole day and changes at midnight.
 *
 * `random % length` is DFU's own modulo bias and is preserved - a list
 * whose length does not divide 2^32 favours its early entries, which is
 * audible as "you hear the first dungeon track more often" and is how
 * the game has always behaved.
 */
export function selectSong(playlist, { gameDays = 0, tavern = false, dungeonKey = null } = {}) {
  if (!playlist || playlist.length === 0) return null;

  let index = 0;
  if (tavern) {
    // AUDIT 19 F5: `>>> 0` like its two neighbours. Without it a negative
    // gameDays yields a NEGATIVE index and playlist[-1] is undefined - a
    // song name of `undefined` that resolves to no record and plays
    // nothing. The other two arms already coerce; this one did not.
    index = Number(BigInt(Math.trunc(gameDays) >>> 0) % BigInt(playlist.length));
  } else if (dungeonKey !== null) {
    srand(dungeonKey >>> 0);
    index = rand() % playlist.length;
  } else if (playlist.length > 1) {
    srand(Math.trunc(gameDays) >>> 0);
    index = rand() % playlist.length;
  }
  return { name: playlist[index], index };
}

/** The dungeon seed, verbatim: `unknown2 ^ ((byte)region << 8)`.
 *  Kept as its own function because the two inputs come from different
 *  readers and a host that has only one of them must not guess. */
export function dungeonKey(unknown2, regionIndex) {
  return ((unknown2 & 0xffff) ^ ((regionIndex & 0xff) << 8)) >>> 0;
}

/**
 * AssignPlaylist's outdoor arms, verbatim (SongManager.cs:585-612) plus
 * UpdatePlayerMusicWeather's mapping (:529-553).
 *
 *   City and Wilderness share one rule: NIGHT overrides everything, and
 *   by day the weather picks the list. DFU's weather mapping folds Fog
 *   in with Overcast and Thunder in with Rain, and anything unrecognised
 *   falls to Sunny - that default is DFU's, not a guess.
 *
 * `night` is the port's own isNight (DawnHour 6 / DuskHour 18), which is
 * DaggerfallDateTime.IsDay's rule already ported in world/worldClock.js.
 */
export function outdoorPlaylist({ night = false, weather = 'sunny', fm = false } = {}) {
  if (night) return fm ? NIGHT_SONGS_FM : NIGHT_SONGS;
  switch (String(weather).toLowerCase()) {
    case 'cloudy':   return fm ? CLOUDY_SONGS_FM : CLOUDY_SONGS;
    case 'overcast':
    case 'fog':      return fm ? OVERCAST_SONGS_FM : OVERCAST_SONGS;
    case 'rain':
    case 'thunder':  return fm ? RAIN_SONGS_FM : RAIN_SONGS;
    case 'snow':     return fm ? SNOW_SONGS_FM : SNOW_SONGS;
    default:         return fm ? SUNNY_SONGS_FM : SUNNY_SONGS;   // DFU's own default arm
  }
}

/** Night, FM. SongManager.cs:908-916.
 *
 *  SIX entries where the GM list has SEVEN, and the difference is not a
 *  transcription slip - it is DFU's, and it is the point of their note at
 *  :818. In general midi classic DUPLICATES song_10 into the night list,
 *  so the GM array carries both song_10 and song_21; the FM array does
 *  not duplicate and simply starts at song_11fm. There is no 10FM record
 *  in MIDI.BSA at all, which is how the corpus pin caught an earlier
 *  version of this list that had extrapolated one from the GM shape. */
export const NIGHT_SONGS_FM = Object.freeze([
  '11FM.HMI', 'FCURSE.HMI', 'FEERIE.HMI', 'FRUINS.HMI', '18FM.HMI', '21FM.HMI',
]);

// --- AUDIT 19 F1/F2: the sixteen lists and the arms that were missing ----
//
// The first pass ported the outdoor and dungeon lists and stopped. DFU has
// 41 SongFiles arrays and AssignPlaylist has fifteen environment arms; the
// port had one and a half. Every list below resolves to a real MIDI.BSA
// record - the corpus pin checks all of them - so "not ported" meant real
// music the player could never hear, not an absent asset.

/** Castle. SongManager.cs castleSongs / castleSongsFM. */
export const CASTLE_SONGS = Object.freeze(['GPALAC.HMI']);
export const CASTLE_SONGS_FM = Object.freeze(['FPALAC.HMI']);

/** The court window (arrested). Checked BEFORE the environment. */
export const COURT_SONGS = Object.freeze(['11.HMI']);
export const COURT_SONGS_FM = Object.freeze(['11FM.HMI']);

/** Shops - every mercantile building type folds here. */
export const SHOP_SONGS = Object.freeze(['GSHOP.HMI']);
export const SHOP_SONGS_FM = Object.freeze(['FM_SQR_2.HMI']);

/** The Mages Guild, which is a GuildHall whose faction is the Mages Guild.
 *  Its FM twin is a different record entirely, not a MAGIC_2 variant. */
export const MAGES_GUILD_SONGS = Object.freeze(['GMAGE_3.HMI', 'MAGIC_2.HMI']);
export const MAGES_GUILD_SONGS_FM = Object.freeze(['FM_NITE3.HMI']);

/** Any other interior - DFU's `default` arm, and the fallback for a
 *  GuildHall that is not the Mages Guild. */
export const INTERIOR_SONGS = Object.freeze(['23.HMI']);
export const INTERIOR_SONGS_FM = Object.freeze(['23FM.HMI']);

/** FighterTrainers: a Temple whose faction is the Fighters Guild. */
export const KNIGHT_SONGS = Object.freeze(['17.HMI']);
export const KNIGHT_SONGS_FM = Object.freeze(['17FM.HMI']);

/** Palace. */
export const PALACE_SONGS = Object.freeze(['06.HMI']);
export const PALACE_SONGS_FM = Object.freeze(['06FM.HMI']);

/** Taverns, FM - a single record where the GM list has five. DFU's own
 *  asymmetry, like the night lists. */
export const TAVERN_SONGS_FM = Object.freeze(['FM_SQR_2.HMI']);

/** The music ENVIRONMENTS, DFU's PlayerMusicEnvironment enum by name. */
export const MUSIC_ENVIRONMENTS = Object.freeze([
  'city', 'wilderness', 'castle', 'dungeonExterior', 'dungeonInterior',
  'graveyard', 'magesGuild', 'fighterTrainers', 'interior', 'palace',
  'shop', 'tavern', 'templeGood', 'templeNeutral', 'templeBad',
]);

/** UpdatePlayerMusicEnvironment's building arm (SongManager.cs:463-523).
 *  The mercantile types fold to Shop; a GuildHall is the Mages Guild only
 *  when its faction says so; a Temple is FighterTrainers for the Fighters
 *  Guild and otherwise takes its god's alignment; everything else is a
 *  plain Interior, which is DFU's own `default`. */
export function environmentForBuilding(buildingType, { factionId = 0, templeAlignment = null } = {}) {
  const B = {
    Alchemist: 0, Armorer: 2, Bank: 3, Bookseller: 5, ClothingStore: 6,
    FurnitureStore: 7, GemStore: 8, GeneralStore: 9, Library: 10,
    GuildHall: 11, PawnShop: 12, WeaponSmith: 13, Temple: 14, Tavern: 15,
    Palace: 16,
  };
  const SHOPS = [B.Alchemist, B.Armorer, B.Bank, B.Bookseller, B.ClothingStore,
    B.FurnitureStore, B.GemStore, B.GeneralStore, B.Library, B.PawnShop, B.WeaponSmith];
  if (SHOPS.includes(buildingType)) return 'shop';
  if (buildingType === B.Tavern) return 'tavern';
  if (buildingType === B.Palace) return 'palace';
  if (buildingType === B.GuildHall) {
    return factionId === MAGES_GUILD_FACTION ? 'magesGuild' : 'interior';
  }
  if (buildingType === B.Temple) {
    if (factionId === FIGHTERS_GUILD_FACTION) return 'fighterTrainers';
    if (templeAlignment === 'good') return 'templeGood';
    if (templeAlignment === 'neutral') return 'templeNeutral';
    if (templeAlignment === 'bad') return 'templeBad';
    // DFU leaves the environment UNCHANGED when GetTempleIndex returns -1;
    // the port has no temple-faction table wired yet, so an unresolved
    // temple falls to Interior rather than inventing an alignment. FLAGGED.
    return 'interior';
  }
  return 'interior';
}

/** FactionFile.FactionIDs, the two AssignPlaylist reads. */
export const MAGES_GUILD_FACTION = 40;
export const FIGHTERS_GUILD_FACTION = 41;

/**
 * AssignPlaylist, whole (SongManager.cs:573-660).
 *
 * The arrested check comes FIRST and overrides the environment entirely.
 * City and Wilderness take the outdoor rule (night, then weather). Two
 * environments take NIGHT SONGS REGARDLESS OF THE CLOCK - a dungeon
 * exterior and a graveyard are night music at noon - which is easy to miss
 * because it looks like the day/night gate and is not.
 */
export function playlistForEnvironment(environment, {
  arrested = false, night = false, weather = 'sunny', fm = false,
} = {}) {
  if (arrested) return fm ? COURT_SONGS_FM : COURT_SONGS;
  switch (environment) {
    case 'city':
    case 'wilderness':      return outdoorPlaylist({ night, weather, fm });
    case 'castle':          return fm ? CASTLE_SONGS_FM : CASTLE_SONGS;
    // NOT gated on the clock - DFU takes night songs here at any hour.
    case 'dungeonExterior':
    case 'graveyard':       return fm ? NIGHT_SONGS_FM : NIGHT_SONGS;
    case 'dungeonInterior': return fm ? DUNGEON_SONGS_FM : DUNGEON_SONGS;
    case 'magesGuild':      return fm ? MAGES_GUILD_SONGS_FM : MAGES_GUILD_SONGS;
    case 'fighterTrainers': return fm ? KNIGHT_SONGS_FM : KNIGHT_SONGS;
    case 'palace':          return fm ? PALACE_SONGS_FM : PALACE_SONGS;
    case 'shop':            return fm ? SHOP_SONGS_FM : SHOP_SONGS;
    case 'tavern':          return fm ? TAVERN_SONGS_FM : TAVERN_SONGS;
    case 'templeGood':      return fm ? TEMPLE_GOOD_SONGS_FM : TEMPLE_GOOD_SONGS;
    case 'templeNeutral':   return fm ? TEMPLE_NEUTRAL_SONGS_FM : TEMPLE_NEUTRAL_SONGS;
    case 'templeBad':       return fm ? TEMPLE_BAD_SONGS_FM : TEMPLE_BAD_SONGS;
    case 'interior':
    default:                return fm ? INTERIOR_SONGS_FM : INTERIOR_SONGS;
  }
}
