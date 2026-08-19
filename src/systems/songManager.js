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
    index = Number(BigInt(Math.trunc(gameDays)) % BigInt(playlist.length));
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
