// SongFiles.cs - the NAMES of every song in MIDI.BSA, plus the one law
// that turns a name into something the archive can be asked for.
//
// Two DFU members, and they only exist as a pair:
//   SongFiles                            (SongFiles.cs:20-154)
//   DaggerfallSongPlayer.EnumToFilename  (Internal/DaggerfallSongPlayer.cs:275-279)
//
// C# spells a song `SongFiles.song_gday___d` and reaches its bytes with
// `enumName.Remove(0, "song_".Length) + ".mid"`, because DFU ships
// PRE-CONVERTED .mid files in Unity Resources and never opens MIDI.BSA
// at all. This port reads the user's own archive (formats/hmiFile.js),
// whose records are named `GDAY___D.HMI` - so the same two-step lands on
// `.HMI` upper case instead of `.mid`. The STEM is untouched either way,
// which is the whole reason DFU could name the enum members after the
// files in the first place.
//
// Everything else in the port already speaks the archive's spelling -
// songManager's playlists, musicReplacement's lookup key,
// MusicService.playSong - and each of those files says so in its own
// header. This is the ONE door from the C# spelling into it, so a caller
// that starts from a quest line or a save field has somewhere to convert
// and nowhere else to invent a second table.
//
// A name is not a promise of bytes: the enum names 132 songs beside its
// sentinel and the shipped MIDI.BSA carries 131 records. DFU is the same
// - `Play(SongFiles)` never checks for song_none and LoadSong just logs
// "Song file '{0}' not found" - so resolution here is a pure string law
// and the archive answers for itself.

/** SongFiles.cs:20-154 - every member, in DECLARATION ORDER, song_none
 *  included. The order is not load-bearing for the port (nothing indexes
 *  it by ordinal), but the SET is: it is exactly what C#'s
 *  `Enum.IsDefined(typeof(SongFiles), name)` answers true for, which is
 *  the gate PlaySong.cs:47-52 throws behind. */
export const SONG_FILES = Object.freeze([
  'song_none', 'song_02', 'song_02fm', 'song_03', 'song_03fm', 'song_04',
  'song_04fm', 'song_05', 'song_05fm', 'song_5strong', 'song_06', 'song_06fm',
  'song_07', 'song_07fm', 'song_08', 'song_08fm', 'song_09', 'song_09fm',
  'song_10', 'song_11', 'song_11fm', 'song_12', 'song_12fm', 'song_13',
  'song_13fm', 'song_15', 'song_15fm', 'song_16', 'song_16fm', 'song_17',
  'song_17fm', 'song_18', 'song_18fm', 'song_20', 'song_20fm', 'song_21',
  'song_21fm', 'song_22', 'song_22fm', 'song_23', 'song_23fm', 'song_25',
  'song_25fm', 'song_28', 'song_29', 'song_29fm', 'song_30', 'song_30fm',
  'song_d1', 'song_d10', 'song_d10fm', 'song_d1fm', 'song_d2', 'song_d2fm',
  'song_d3', 'song_d3fm', 'song_d4', 'song_d4fm', 'song_d5', 'song_d5fm',
  'song_d6', 'song_d6fm', 'song_d7', 'song_d7fm', 'song_d8', 'song_d8fm',
  'song_d9', 'song_d9fm', 'song_dungeon', 'song_dungeon5', 'song_dungeon6',
  'song_dungeon7', 'song_dungeon8', 'song_dungeon9', 'song_fbad', 'song_fcurse',
  'song_fday___d', 'song_fdngn10', 'song_fdngn11', 'song_fdungn4', 'song_fdungn9',
  'song_feerie', 'song_fgood', 'song_fm_dngn1', 'song_fm_dngn2', 'song_fm_dngn3',
  'song_fm_dngn4', 'song_fm_dngn5', 'song_fm_nite3', 'song_fm_rain',
  'song_fm_sqr_2', 'song_fm_sunny', 'song_fm_swim2', 'song_fmover_c',
  'song_fmover_s', 'song_fmsneak2', 'song_fneut', 'song_folk1', 'song_folk2',
  'song_folk3', 'song_fpalac', 'song_fruins', 'song_fsneak2', 'song_fsnow__b',
  'song_gbad', 'song_gcurse', 'song_gday___d', 'song_gdngn10', 'song_gdngn11',
  'song_gdungn4', 'song_gdungn9', 'song_geerie', 'song_ggood', 'song_gmage_3',
  'song_gneut', 'song_gpalac', 'song_gruins', 'song_gshop', 'song_gsneak2',
  'song_gsnow__b', 'song_gsunny2', 'song_magic_2', 'song_overcast',
  'song_overlong', 'song_oversnow', 'song_raining', 'song_sneaking',
  'song_sneakng2', 'song_snowing', 'song_square_2', 'song_sunnyday',
  'song_swimming', 'song_tavern',
]);

const DEFINED = new Set(SONG_FILES);

/**
 * `Enum.IsDefined(typeof(SongFiles), name)`.
 *
 * CASE-SENSITIVE, because C#'s is: Enum.IsDefined compares the member
 * name ordinally, so `Song_Tavern` is NOT defined and PlaySong throws on
 * it. Every member is lower case, so a quest line that shouts its song
 * name is a quest that fails to parse in DFU too.
 */
export const isSongFileDefined = (name) => DEFINED.has(name);

/**
 * EnumToFilename, in the port's spelling: strip the `song_` prefix and
 * append the extension. `song_gday___d` -> `GDAY___D.HMI`.
 *
 * The upper case is the ARCHIVE's, not a normalisation of the input -
 * BSA record names are stored upper case and hmiFile's getSongIndex is
 * an exact match. C# needs no such step because its Resources filenames
 * are lower case like the enum.
 *
 * C# `Remove(0, 5)` cuts five characters unconditionally; every member
 * carries the prefix, so guarding the slice changes no defined name and
 * only keeps an undefined one readable in a warning. Callers that need
 * C#'s guard call isSongFileDefined first, as PlaySong.cs:47-52 does.
 */
export function songFileToRecordName(name) {
  const s = String(name ?? '');
  return `${(s.startsWith('song_') ? s.slice('song_'.length) : s).toUpperCase()}.HMI`;
}
