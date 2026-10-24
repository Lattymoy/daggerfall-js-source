// @ts-check
// EG-G2 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 26 - EG17): THE SCORE OF
// THE SPIRE - the Elite Breach's own music, written here as notes for the game's own player and FM bank, and the law of
// which of it plays.
//
// WHY MADE: as the Warden's and the Hour's (systems/gate/gateScore.js, systems/superDungeon/sdScore.js): Daggerfall has no fight music and
// nothing in MIDI.BSA rises and falls with anything. So the Spire's songs are made in code in the shape an HMI song
// decodes to, played by the game's own player (systems/song/songPlayer.js) under names of their own (music.registerSong), faded
// by the same law, and replaceable by a music pack by name. Each score module writes its own `makeSong` (section 26).
//
// THE SPIRE'S SOUND: E PHRYGIAN, the Kyn's colour against the Imperial brass - E minor with its lowered second (F natural
// over E: the Kyn's half step) - THE BATTLEMAGES' FANFARE on the horn, broken (it rises E-G#-B as the Empire's would and
// falls on G natural and F: the academy fallen), ANSWERED BY THE LEGION'S DRUMS (low toms and the surdo, 3-3-2). Every
// band has its motif (EG_SCORE_BAND_MOTIFS) and every lord its four bars (EG_SCORE_LORD_MOTIFS - net/eliteGates/egLaw.js EG_LORDS's
// `motif`), written into the songs that are theirs:
//   SPIREGAL  the Galleries' halls - 100 BPM, 96 bars: three 32-bar variants in an order the breach's seed picks
//   SPIRECRN  the Cairn's halls - 88 BPM, the same: the choir and the organ, the soul-bell tolled
//   SPIRESHD  the Shade's halls - 92 BPM, the same: the harp and the low strings, sparse, the moon's bells high
//   SPIREWEL  the Wellhead's halls - 110 BPM, the same: the low brass hammering, anvils in the kit
//   SPIREYRD  a Rift-Yard's or a Rampart's trial - 132 BPM, 32 bars: the band's motif in the brass over the legion's drums
//   SPIRESET  a set-piece passage - 140 BPM, 8 bars: one cue a band
//   SPIRWAKE  a lord's wake - the 2-bar drum swell before SPIRLRD1 (section 26's "silence is scored too")
//   SPIRLRD1/2/3  a Court by phase - 138 / 144 / 152 BPM, 32 bars each, the lord's own motif written into the bed
//   SPIRVALK  a Valkynaz, all phases, rising - 148 BPM, 48 bars, its own motif
//   SPIRREDT  a Redoubt taken, and its rest: the Battlemages' hymn - 72 BPM, 16 bars, in E MAJOR (the fanfare mended)
//   SPIRECNT  the count's last two minutes - 160 BPM, 16 bars
//   SPIREEND  the tear, a fall (my own - AUDIT EG V), the end - 70 BPM, 12 bars, decaying in its time; then the band's ambience alone
// The songs a context names (the band's yard and set-piece cues, a lord's three, a Valkynaz's) are made for that context
// (`spireScoreSongs(ctx)`, memoized) and registered under the same names when it changes (createSpireScoreHost): the name
// is the song's place in the law, the notes are the band's and the lord's.
//
// EG-ROAR (2026-10-18, Mac: "the music and ambience of the elite breach needs to be insanely better. Its way too tame"):
// THE SCORE ROARS. Two things kept it tame: the FM bank's one oscillator pair a note (a section one thin player, the drums
// one sine each) and the writing (the halls' drums a low tom every other bar, a whole-note pad a bar and nothing moving -
// tools/egScoreProbe.mjs read every second of SPIREGAL at the same loudness). So each song now carries its own voices and
// kit (SPIRE_VOICES, SPIRE_KIT - systems/song/songPlayer.js songVoices: the sections in unison, a sub under the low ones,
// the taiko long with its beater's click, the snare a crack over a skin), and the writing climbs: THE SPICCATO under
// everything (the low strings in the 3-3-2), THE LEGION'S CHANT, THE SHRIEKS (B over C, the Kyn's half step high), A
// BRAAM at each phrase (the low brass's cluster, E under the Kyn's F), A SWELL into each (the reverse cymbal, the timpani
// rolling up), and each song built in parts that rise and break - the halls' descent, motif, gathering and height; the
// trial's call, drive, break, build and height. The three new voices fill GM's last three channels.
//
// THE LAW (`spireScoreFor`): ONE SONG AT A TIME, by priority (EG_SCORE_PRIORITY - pinned): the end; a Valkynaz; a Redoubt
// and its rest; THE COUNT's last two minutes (replacing every song under it, never SPIRVALK or SPIRREDT); a lord's wake
// then its phase; a set piece; a yard's or a rampart's trial; the band's halls. The gather and the closing play the band's
// ambience alone (silence - section 26).
//
// THE SPIRE MIX is systems/eliteGates/egMix.js. Measured through the real player in a browser by tools/egScoreProbe.mjs (the Hour's
// probe's law). Pure: the breach's state in, a song's name (or SPIRE_SCORE_SILENCE, or null) out.
// Not a DFU member. Ledger A (ELITE-GATES).
import { midiNote, SCORE_TPQ, SCORE_STING_LEAD_MS } from '../gate/gateScore.js';

/** The songs' names - 8-character stems as every made song's (GATEWAR1, HOURWAR1). */
export const SPIRE_SONGS = Object.freeze({
  gal: 'SPIREGAL.HMI', crn: 'SPIRECRN.HMI', shd: 'SPIRESHD.HMI', wel: 'SPIREWEL.HMI', yard: 'SPIREYRD.HMI', set: 'SPIRESET.HMI', wake: 'SPIRWAKE.HMI',
  lord1: 'SPIRLRD1.HMI', lord2: 'SPIRLRD2.HMI', lord3: 'SPIRLRD3.HMI', valk: 'SPIRVALK.HMI', redoubt: 'SPIRREDT.HMI', count: 'SPIRECNT.HMI', end: 'SPIREEND.HMI',
});
/** Each band's halls' song, by band index. */
export const SPIRE_BAND_SONGS = Object.freeze([SPIRE_SONGS.gal, SPIRE_SONGS.crn, SPIRE_SONGS.shd, SPIRE_SONGS.wel]);
/** The law's answer when the Spire wants nothing sounding (the band's ambience alone). */
export const SPIRE_SCORE_SILENCE = 'silence';
/** THE COUNT's last stretch (section 26: "SPIRECNT REPLACES the song at 2:00"); how long the wake's swell and the end
 *  sound from their own first note (2 bars at 138 BPM; the end's first ten bars and a half at 70 BPM - its organ dying -
 *  always inside its 12, so the song never comes round again before the law lets it go). */
export const SPIRE_COUNT_WARN_MS = 120_000;
export const SPIRE_WAKE_MS = 3_400;
export const SPIRE_END_MS = 36_000;
/** THE PRIORITY TABLE (section 26, pinned): the first that applies plays - so the count, below a Valkynaz and a Redoubt
 *  and over everything else, replaces every song but those two. */
export const EG_SCORE_PRIORITY = Object.freeze(['end', 'valk', 'redoubt', 'count', 'wake', 'lord', 'set', 'yard', 'hall', 'ambience']);

/** GM programs (gmSynth.js FM bank): the brass section and the horn (the Battlemages' fanfare), the low brass for the
 *  legion's ostinato, strings, choir, organ, timpani, the harp, tubular bells, the orchestra hit, the pizzicato (EG-ROAR:
 *  the low strings' spiccato); EG-ROAR: the tremolo strings (the shrieks, the Kyn's half step high), the reverse cymbal
 *  (the swell into a phrase) and the voices (the legion's chant). */
export const SPIRE_PROGRAMS = Object.freeze({ ostinato: 57, bass: 32, strings: 48, brass: 61, choir: 52, organ: 19, timpani: 47, horn: 60, harp: 46, bells: 14, hit: 55, pizz: 45, trem: 44, swell: 119, chant: 53 });
/** Channels: one voice each, the kit on GM's channel 9 - all sixteen. */
export const SPIRE_CHANNELS = Object.freeze({ ostinato: 0, bass: 1, strings: 2, brass: 3, choir: 4, organ: 5, timpani: 6, horn: 7, harp: 8, kit: 9, bells: 10, hit: 11, pizz: 12, trem: 13, swell: 14, chant: 15 });
/** Each voice's level (CC7) and place (CC10): the horn and the brass left of the middle (the Empire's), the drums and
 *  the low brass at the middle (the legion's), the harp and the bells apart, the chant across from the shrieks. The
 *  bass under the rest (WB10a's law). */
const MIX = Object.freeze({
  ostinato: [112, 58], bass: [100, 64], strings: [104, 88], brass: [120, 44], choir: [108, 76], organ: [80, 64], timpani: [114, 64],
  horn: [116, 38], harp: [96, 30], bells: [96, 98], hit: [108, 64], pizz: [104, 72], trem: [92, 100], swell: [86, 64], chant: [104, 50],
});
const KIT_LEVEL = 118;
/** EG-ROAR: THE VOICES - each channel's own instrument over the FM bank's one pair a note (systems/song/songPlayer.js
 *  songVoices): the sections an ensemble (`unison` copies `cents` apart, laid `spread` either side of their place), the
 *  low ones with a sub under them, the brass and the strings brighter than the bank's, the spiccato and the chant bitten
 *  short, the swell a 1.7 s rise of inharmonic shimmer cut on the downbeat. Measured (tools/egScoreProbe.mjs --wav): a
 *  sub on every low voice put more than half the war under 100 Hz (the bass's, under E1, at 21 Hz - heard by nothing
 *  but the press), so only the hit and the spiccato keep one, and the bass is brightened instead. */
export const SPIRE_VOICES = Object.freeze({
  ostinato: Object.freeze({ attack: 0.006, decay: 0.12, sustain: 0.5, release: 0.07, index: 5, idxDecay: 0.16, unison: 2, cents: 7, spread: 0.2 }),
  bass: Object.freeze({ index: 2.2 }),
  strings: Object.freeze({ attack: 0.14, release: 0.7, index: 2, idxDecay: 2, unison: 3, cents: 12, spread: 0.5 }),
  brass: Object.freeze({ attack: 0.04, index: 5, idxDecay: 0.7, unison: 3, cents: 9, spread: 0.35 }),
  choir: Object.freeze({ mod: 1, index: 1.3, idxDecay: 2, attack: 0.3, release: 0.9, unison: 3, cents: 14, spread: 0.45 }),
  organ: Object.freeze({ unison: 2, cents: 4, spread: 0.3 }),
  timpani: Object.freeze({ decay: 0.9, release: 0.5 }),
  horn: Object.freeze({ attack: 0.06, index: 3, idxDecay: 0.7, unison: 2, cents: 6, spread: 0.25 }),
  harp: Object.freeze({ unison: 2, cents: 5, spread: 0.3 }),
  bells: Object.freeze({ unison: 2, cents: 3, spread: 0.3 }),
  hit: Object.freeze({ index: 4.5, decay: 0.5, release: 0.35, unison: 2, cents: 15, sub: 0.35, spread: 0.4 }),
  pizz: Object.freeze({ attack: 0.003, decay: 0.15, sustain: 0.02, release: 0.08, index: 3.4, idxDecay: 0.07, sub: 0.15 }),
  trem: Object.freeze({ attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.12, index: 2.4, idxDecay: 0.8, unison: 2, cents: 16, spread: 0.6 }),
  swell: Object.freeze({ mod: 3.73, index: 7, idxDecay: 4, attack: 1.7, decay: 0.02, sustain: 1, release: 0.05, gain: 0.5 }),
  chant: Object.freeze({ mod: 2, index: 1.8, idxDecay: 0.3, attack: 0.02, decay: 0.12, sustain: 0.65, release: 0.12, unison: 3, cents: 10, spread: 0.4 }),
});
/** The voices by channel, as the song carries them. */
const VOICES_BY_CHANNEL = Object.freeze(Object.fromEntries(Object.entries(SPIRE_VOICES).map(([v, o]) => [SPIRE_CHANNELS[v], o])));
/** Each song over the player's own level, and its press (systems/song/songPlayer.js `song.level`, `song.press` - the gate's
 *  law): the halls under the fights, the war growing by phase, the count and the Valkynaz over it. */
export const SPIRE_LEVEL = Object.freeze({ hall: 1.3, yard: 1.45, set: 1.5, wake: 1.5, lord1: 1.45, lord2: 1.56, lord3: 1.64, valk: 1.66, redoubt: 1.25, count: 1.68, end: 1.4 });
/** EG-ROAR: the press lets a drum's first 12 ms through (at 3 ms it clamped every taiko and kick to the pads' level) and
 *  presses a little less (ratio 3, not 4) - the ceiling still holds every peak by construction (songPlayer.js). */
const PRESS = Object.freeze({ threshold: -18, knee: 12, ratio: 3, attack: 0.012, release: 0.25, ceiling: -1 });
export const SPIRE_PRESS = Object.freeze(Object.fromEntries(Object.entries({ hall: 4.4, yard: 5.0, set: 5.2, wake: 5.0, lord1: 5.2, lord2: 5.4, lord3: 5.8, valk: 6.3, redoubt: 4.2, count: 5.9, end: 4.6 }).map(([k, out]) => [k, Object.freeze({ ...PRESS, out })])));
/** GM kit keys (gmSynth.js DRUMS): the legion's low drums - the open surdo its taiko, the mute its rim - the anvil (the
 *  Wellhead's - the ride bell's ring, low), the snare and its rolls, the hats and the shaker over them, the woodblocks
 *  (the count's clock). */
const KIT = Object.freeze({ kick: 36, snare: 38, rim: 40, lowTom: 41, hat: 42, highFloorTom: 43, tom: 45, openHat: 46, lowMidTom: 47, hiMidTom: 48, crash: 49, chinese: 52, anvil: 53, crash2: 57, woodHi: 76, woodLo: 77, shaker: 82, muteSurdo: 86, surdo: 87 });
/** EG-ROAR: THE LEGION'S KIT - each drum the Spire strikes, past the kit's one sine or band of noise (songPlayer.js
 *  songKit): the taiko long and falling with its beater's click, the toms and the kick the same, the snare a crack
 *  over a skin, the cymbals long, the anvil ringing. */
export const SPIRE_KIT = Object.freeze({
  [KIT.kick]: Object.freeze({ hz: 52, decay: 0.38, gain: 1.15, click: 0.55 }),
  [KIT.surdo]: Object.freeze({ hz: 64, decay: 0.95, gain: 1.3, drop: 0.7, click: 0.45 }),
  [KIT.muteSurdo]: Object.freeze({ hz: 72, decay: 0.35, gain: 1, click: 0.35 }),
  [KIT.lowTom]: Object.freeze({ hz: 82, decay: 0.55, gain: 1, click: 0.3 }),
  [KIT.highFloorTom]: Object.freeze({ hz: 100, decay: 0.5, click: 0.3 }),
  [KIT.tom]: Object.freeze({ hz: 122, decay: 0.45, click: 0.3 }),
  [KIT.lowMidTom]: Object.freeze({ hz: 150, decay: 0.4, click: 0.3 }),
  [KIT.hiMidTom]: Object.freeze({ hz: 180, decay: 0.38, click: 0.3 }),
  [KIT.snare]: Object.freeze({ hz: 2000, q: 0.7, decay: 0.24, gain: 0.95, body: 185 }),
  [KIT.rim]: Object.freeze({ hz: 2600, q: 0.9, decay: 0.1, gain: 0.7, body: 220 }),
  [KIT.crash]: Object.freeze({ decay: 2, q: 0.45, gain: 0.85 }),
  [KIT.crash2]: Object.freeze({ decay: 2.6, q: 0.4, gain: 0.9 }),
  [KIT.chinese]: Object.freeze({ decay: 1.3, q: 0.55 }),
  [KIT.anvil]: Object.freeze({ hz: 1650, decay: 0.9, gain: 0.7, click: 0.7 }),
  [KIT.hat]: Object.freeze({ hz: 8000, q: 0.8, decay: 0.05, gain: 0.85 }),
  [KIT.openHat]: Object.freeze({ hz: 7000, q: 0.7, decay: 0.28, gain: 0.7 }),
  [KIT.shaker]: Object.freeze({ decay: 0.06, gain: 0.7 }),
  [KIT.woodHi]: Object.freeze({ click: 0.3 }),
  [KIT.woodLo]: Object.freeze({ click: 0.3 }),
});

/** THE HARMONY, E Phrygian (and the hymn's E major): each chord's bass, timpani, pad, strings, choir, ostinato root and
 *  stab (open fifths where struck). */
const CHORDS = Object.freeze({
  Em: { bass: 'E1', timp: 'E2', pad: ['E3', 'B3', 'E4'], str: ['E4', 'G4', 'B4'], choir: ['E3', 'B3', 'G4'], ost: 'E2', stab: ['E3', 'B3', 'E4'] },
  F: { bass: 'F1', timp: 'C2', pad: ['F2', 'C3', 'F3'], str: ['F4', 'A4', 'C5'], choir: ['F2', 'C3', 'A3'], ost: 'F2', stab: ['F2', 'C3', 'F3'] },
  G: { bass: 'G1', timp: 'D2', pad: ['G2', 'D3', 'G3'], str: ['D4', 'G4', 'B4'], choir: ['G2', 'D3', 'B3'], ost: 'G2', stab: ['G2', 'D3', 'G3'] },
  Dm: { bass: 'D2', timp: 'D2', pad: ['D3', 'A3', 'D4'], str: ['D4', 'F4', 'A4'], choir: ['D3', 'A3', 'F4'], ost: 'D2', stab: ['D3', 'A3', 'D4'] },
  Am: { bass: 'A1', timp: 'A2', pad: ['A2', 'E3', 'A3'], str: ['C4', 'E4', 'A4'], choir: ['A2', 'E3', 'C4'], ost: 'A1', stab: ['A2', 'E3', 'A3'] },
  C: { bass: 'C2', timp: 'C2', pad: ['C3', 'G3', 'C4'], str: ['C4', 'E4', 'G4'], choir: ['C3', 'G3', 'E4'], ost: 'C2', stab: ['C3', 'G3', 'C4'] },
  Bdim: { bass: 'B1', timp: 'B2', pad: ['B2', 'F3', 'B3'], str: ['B3', 'D4', 'F4'], choir: ['B2', 'F3', 'D4'], ost: 'B1', stab: ['B2', 'F3', 'B3'] },
  E: { bass: 'E1', timp: 'E2', pad: ['E3', 'B3', 'E4'], str: ['E4', 'G#4', 'B4'], choir: ['E3', 'B3', 'G#4'], ost: 'E2', stab: ['E3', 'B3', 'E4'] },
  A: { bass: 'A1', timp: 'A2', pad: ['A2', 'E3', 'A3'], str: ['C#4', 'E4', 'A4'], choir: ['A2', 'E3', 'C#4'], ost: 'A1', stab: ['A2', 'E3', 'A3'] },
  B: { bass: 'B1', timp: 'B2', pad: ['B2', 'F#3', 'B3'], str: ['D#4', 'F#4', 'B4'], choir: ['B2', 'F#3', 'D#4'], ost: 'B1', stab: ['B2', 'F#3', 'B3'] },
  Csm: { bass: 'C#2', timp: 'C#2', pad: ['C#3', 'G#3', 'C#4'], str: ['C#4', 'E4', 'G#4'], choir: ['C#3', 'G#3', 'E4'], ost: 'C#2', stab: ['C#3', 'G#3', 'C#4'] },
});
/** The progressions, a chord a bar. The halls' three variants; the war's (the Phrygian F pressing on E); the hymn's in E
 *  major; the count's two chords hammered; the end's falling. */
const PROG = Object.freeze({
  hallA: ['Em', 'F', 'Em', 'Dm', 'C', 'F', 'Em', 'Em'], hallB: ['Am', 'F', 'G', 'Em', 'Dm', 'F', 'Em', 'Em'], hallC: ['Em', 'G', 'F', 'Em', 'Am', 'Dm', 'F', 'Em'],
  war: ['Em', 'F', 'Em', 'F', 'Dm', 'F', 'Bdim', 'Em'], war3: ['Em', 'F', 'Bdim', 'F', 'Em', 'F', 'Dm', 'Em'],
  hymn: ['E', 'A', 'E', 'B', 'Csm', 'A', 'B', 'E'], count: ['Em', 'F', 'Em', 'F', 'Em', 'F', 'Bdim', 'F'], end: ['Em', 'C', 'Am', 'F', 'Em', 'F', 'Em', 'Em'],
});
/** THE BATTLEMAGES' FANFARE, whole (the hymn's - E major) and BROKEN (the Spire's - it falls on G natural and F). */
export const EG_FANFARE = Object.freeze([['E4', 0.5], ['E4', 0.5], ['B4', 1], ['G#4', 1], ['E5', 1]]);
export const EG_FANFARE_BROKEN = Object.freeze([['E4', 0.5], ['E4', 0.5], ['B4', 1], ['G4', 1], ['F4', 1]]);
/** THE BANDS' MOTIFS (a bar each, written into each band's songs): the Galleries the broken fanfare; the Cairn a soul-bell
 *  falling by half steps; the Shade high and sparse; the Wellhead hammered low. */
export const EG_SCORE_BAND_MOTIFS = Object.freeze([
  EG_FANFARE_BROKEN,
  Object.freeze([['B4', 1], ['A4', 1], ['G4', 1], ['F4', 1]]),
  Object.freeze([['E5', 1.5], ['F5', 0.5], ['E5', 1], ['B4', 1]]),
  Object.freeze([['E3', 0.5], ['E3', 0.5], ['F3', 1], ['E3', 0.5], ['E3', 0.5], ['B2', 1]]),
]);
/** THE LORDS' MOTIFS (four bars each, net/eliteGates/egLaw.js EG_LORDS's `motif` 0-12): each its own, written into its Court's three
 *  songs (or its Valkynaz's one). */
export const EG_SCORE_LORD_MOTIFS = Object.freeze([
  /* 0 Grath the Hound */ [[['E3', 0.5], ['E3', 0.5], ['G3', 1], ['F3', 2]], [['E3', 0.5], ['B2', 0.5], ['E3', 1], ['F3', 2]], [['G3', 1], ['A3', 1], ['F3', 1], ['E3', 1]], [['B2', 2], ['E3', 2]]],
  /* 1 the Last Spellmaster */ [[['B4', 1], ['C5', 1], ['B4', 1], ['F4', 1]], [['A4', 2], ['G4', 2]], [['B4', 0.5], ['C5', 0.5], ['D5', 1], ['C5', 2]], [['B4', 3], ['F4', 1]]],
  /* 2 the Last Armsmaster */ [[['E4', 1.5], ['E4', 0.5], ['D4', 1], ['E4', 1]], [['F4', 2], ['E4', 2]], [['G4', 1.5], ['F4', 0.5], ['E4', 1], ['D4', 1]], [['E4', 4]]],
  /* 3 Valkynaz Ilthys */ [[['E4', 0.5], ['B4', 0.5], ['E5', 2], ['F5', 1]], [['E5', 1], ['C5', 1], ['B4', 2]], [['G4', 0.5], ['B4', 0.5], ['F5', 2], ['E5', 1]], [['B4', 2], ['F4', 2]]],
  /* 4 the Cairn-Keeper */ [[['A3', 2], ['G#3', 2]], [['A3', 1], ['C4', 1], ['B3', 2]], [['F3', 2], ['E3', 2]], [['D3', 2], ['E3', 2]]],
  /* 5 the Twin Lords */ [[['E4', 1], ['G4', 1], ['E4', 1], ['G4', 1]], [['F4', 1], ['A4', 1], ['F4', 1], ['A4', 1]], [['E4', 0.5], ['F4', 0.5], ['G4', 1], ['F4', 0.5], ['E4', 0.5], ['D4', 1]], [['E4', 2], ['B3', 2]]],
  /* 6 Valkynaz Morvayn */ [[['B3', 2], ['C4', 1], ['B3', 1]], [['E4', 2], ['F4', 2]], [['G4', 1], ['F4', 1], ['E4', 1], ['C4', 1]], [['B3', 4]]],
  /* 7 the Mother of Dusk */ [[['E5', 1], ['D5', 1], ['C5', 1], ['B4', 1]], [['F5', 2], ['E5', 2]], [['C5', 1], ['B4', 1], ['A4', 1], ['G4', 1]], [['F4', 2], ['E4', 2]]],
  /* 8 the Night-Stalker */ [[['E3', 0.75], ['F3', 0.25], ['E3', 3]], [['B2', 0.75], ['C3', 0.25], ['B2', 3]], [['G3', 0.75], ['F3', 0.25], ['E3', 3]], [['F3', 1], ['E3', 3]]],
  /* 9 Valkynaz Seyth */ [[['B4', 1], ['E5', 1], ['F5', 2]], [['E5', 1], ['B4', 1], ['G4', 2]], [['A4', 1], ['C5', 1], ['F5', 2]], [['E5', 4]]],
  /* 10 the Bound Colossus */ [[['E2', 1], ['E2', 1], ['E2', 1], ['F2', 1]], [['E2', 1], ['E2', 1], ['G2', 1], ['F2', 1]], [['E2', 1], ['B1', 1], ['E2', 1], ['F2', 1]], [['E2', 2], ['E2', 2]]],
  /* 11 the Wellhead Wyrm */ [[['E4', 0.5], ['G4', 0.5], ['B4', 0.5], ['C5', 0.5], ['B4', 2]], [['F4', 0.5], ['A4', 0.5], ['C5', 0.5], ['D5', 0.5], ['C5', 2]], [['B4', 1], ['G4', 1], ['F4', 2]], [['E4', 4]]],
  /* 12 Valkynaz Garoth */ [[['E3', 1], ['B3', 1], ['F4', 2]], [['E4', 1], ['D4', 1], ['C4', 1], ['B3', 1]], [['E3', 1], ['B3', 1], ['G4', 2]], [['F4', 2], ['E4', 2]]],
].map((m) => Object.freeze(m.map((bar) => Object.freeze(bar.map((n) => Object.freeze(n)))))));

const RANK = { programChange: 0, controller: 0, noteOn: 1 };
/** A song in the shape the player plays (formats/hmiFile.js HmiFile) - systems/gate/gateScore.js's makeSong's law, this
 *  module's own voices: one note a key a moment (AUDIT SD III A8), every voice's program, level and place at tick 0, whole
 *  bars that loop on their bar line, nothing before the first (a swell into bar 0 is the loop's last bar's). EG-ROAR:
 *  and the song's own voices and kit (SPIRE_VOICES, SPIRE_KIT). */
function makeSong(name, bpm, bars, write, level = 1, press = null) {
  const events = [], struck = new Map();
  const tick = (bar, beat) => Math.round((bar * 4 + beat) * SCORE_TPQ);
  const end = bars * 4 * SCORE_TPQ;
  const w = {
    note(voice, bar, beat, beats, n, velocity) {
      const note = typeof n === 'number' ? n : midiNote(n), at = tick(bar, beat), channel = SPIRE_CHANNELS[voice];
      if (at >= end || at < 0) return;
      const v = Math.max(1, Math.min(127, Math.round(velocity))), duration = Math.max(1, Math.min(end - at, Math.round(beats * SCORE_TPQ)));
      const key = (at * 16 + channel) * 128 + note, was = struck.get(key);
      if (was) { was.velocity = Math.max(was.velocity, v); was.duration = Math.max(was.duration, duration); return; }
      const e = { tick: at, type: 'noteOn', channel, note, velocity: v, duration };
      struck.set(key, e);
      events.push(e);
    },
    hit(key, bar, beat, velocity) { w.note('kit', bar, beat, 0.25, KIT[key], velocity); },
  };
  write(w);
  for (const [voice, [lv, pan]] of Object.entries(MIX)) {
    const channel = SPIRE_CHANNELS[voice];
    events.push({ tick: 0, type: 'programChange', channel, program: SPIRE_PROGRAMS[voice] });
    events.push({ tick: 0, type: 'controller', channel, controller: 7, value: lv });
    events.push({ tick: 0, type: 'controller', channel, controller: 10, value: pan });
  }
  events.push({ tick: 0, type: 'controller', channel: SPIRE_CHANNELS.kit, controller: 7, value: KIT_LEVEL });
  events.sort((a, b) => a.tick - b.tick || RANK[a.type] - RANK[b.type]);
  return { name, press, beatsPerMinute: bpm, secondsPerTick: 60 / (bpm * SCORE_TPQ), events, durationTicks: end, seamless: true, level, voices: VOICES_BY_CHANNEL, kit: SPIRE_KIT };
}
/** A melody (bars of [note, beats]) from `bar0` on `voice`, `octave` shifted. */
function line(w, bar0, bars, voice, velocity, octave = 0) {
  bars.forEach((notes, b) => { let beat = 0; for (const [n, beats] of notes) { w.note(voice, bar0 + b, beat, beats * 0.92, midiNote(n) + 12 * octave, velocity + (beat === 0 ? 8 : 0)); beat += beats; } });
}
/** A roll of `voice` (a key of the kit's, or a note) from `beat0` for `beats`, a stroke each `step`, `v0` rising to `v1`. */
function roll(w, voice, bar, beat0, beats, n, v0, v1, step = 0.25) {
  const k = Math.round(beats / step);
  for (let i = 0; i < k; i++) {
    const v = v0 + ((v1 - v0) * i) / Math.max(1, k - 1);
    if (voice === 'kit') w.hit(n, bar, beat0 + i * step, v); else w.note(voice, bar, beat0 + i * step, step * 0.9, n, v);
  }
}
/** The 3-3-2 accents over a bar's eighths; EG-ROAR: and THE GALLOP, the 3-3-2 over each half bar's sixteenths (beats). */
const ACCENT8 = Object.freeze([true, false, false, true, false, false, true, false]);
const GALLOP = Object.freeze([0, 0.75, 1.5, 2, 2.75, 3.5]);
const GALLOP16 = Object.freeze([0, 3, 6, 8, 11, 14]);
/** THE LEGION'S DRUMS for one bar at `drive`: 0 the legion far off (the taiko a bar, a tom answering, the rim between,
 *  the shaker's eighths); 1 the march (the taiko on the 3-3-2, the rim between, the snare on three, the shaker's
 *  sixteenths); 2 the war (the kick galloping, the taiko on one and three, the backbeat, the toms between, the hats'
 *  sixteenths and the open hat pushing into the next bar); 3 the count's and the last phase's (the kick on every eighth,
 *  the taiko on every beat, the rim pushing). A fill down the toms closing each fourth bar, the crash on each eighth. */
function drums(w, bar, drive, { vel = 1, fill = bar % 4 === 3, crash = bar % 8 === 0 } = {}) {
  const h = (k, beat, v) => w.hit(k, bar, beat, v * vel);
  if (drive <= 0) {
    h('surdo', 0, 92); h('lowTom', 2.5, 72);
    if (bar % 2) h('surdo', 3, 80); else h('muteSurdo', 1.5, 58);
    for (let i = 0; i < 8; i++) h('shaker', i * 0.5, ACCENT8[i] ? 52 : 38);
    return;
  }
  if (drive === 1) {
    h('surdo', 0, 104); h('surdo', 1.5, 90); h('surdo', 3, 96);
    h('muteSurdo', 0.5, 64); h('muteSurdo', 2.5, 70);
    h('lowTom', 2, 82); h('snare', 2, 84);
    for (let i = 0; i < 16; i++) h('shaker', i * 0.25, GALLOP16.includes(i) ? 64 : 44);
  } else {
    for (const b of GALLOP) h('kick', b, b === 0 || b === 2 ? 112 : 96);
    h('surdo', 0, 116); h('surdo', 2, 106);
    h('snare', 1, 104); h('snare', 3, 110);
    for (const b of [0.5, 1.5, 2.5, 3.5]) h('tom', b, 78);
    for (let i = 0; i < 16; i++) if (i !== 14) h('hat', i * 0.25, i % 2 ? 58 : 78);
    h('openHat', 3.5, 74);
    if (drive >= 3) { for (let i = 0; i < 8; i++) h('kick', i * 0.5, 100); h('surdo', 1, 100); h('surdo', 3, 108); h('rim', 1.75, 76); h('rim', 3.75, 84); }
  }
  if (fill) {
    const n = drive >= 3 ? 8 : 4, keys = ['hiMidTom', 'lowMidTom', 'tom', 'highFloorTom', 'lowTom'];
    for (let i = 0; i < n; i++) h(keys[Math.floor((i * keys.length) / n)], 4 - n * 0.25 + i * 0.25, 92 + (i * 24) / n);
  }
  if (crash) h(drive >= 2 ? 'crash2' : 'crash', 0, 104);
  if (drive >= 2 && bar % 8 === 4) h('chinese', 0, 90);
}
/** The bed under a chord for one bar: the low brass's ostinato (eighths 3-3-2 at `drive` >= 1, the Kyn's half step
 *  leaning into the next bar at 2), the bass (EG-ROAR: re-struck on the 3-3-2 at 2), the pad, the strings and the choir
 *  as asked. */
function bed(w, bar, chord, { drive = 0, strings = true, choir = false, organ = 1, vel = 1 } = {}) {
  const c = CHORDS[chord];
  if (drive >= 1) ACCENT8.forEach((acc, i) => w.note('ostinato', bar, i * 0.5, 0.4, c.ost, (acc ? 110 : 76) * vel));
  if (drive >= 2) for (let s = 12; s < 16; s++) w.note('ostinato', bar, s * 0.25, 0.2, s === 15 ? midiNote(c.ost) + 1 : c.ost, 92 * vel);
  for (const [b, len] of drive >= 2 ? [[0, 1.4], [1.5, 1.4], [3, 0.9]] : [[0, 3.8]]) w.note('bass', bar, b, len, c.bass, (b ? 92 : 100) * vel);
  if (organ > 0) for (const n of c.pad) w.note('organ', bar, 0, 4, n, 78 * organ);
  if (strings) for (const n of c.str) w.note('strings', bar, 0, 4, n, 86 * vel);
  if (choir) for (const n of c.choir) w.note('choir', bar, 0, 4, n, 92 * vel);
}
/** EG-ROAR: THE SPICCATO - the low strings driving under everything: the chord's root, its fifth and its octave in
 *  sixteenths (`per` 16) or eighths (8), the 3-3-2 accented, `oct` octaves over the ostinato's. */
const SPICC = Object.freeze([0, 0, 12, 0, 7, 0, 12, 0, 0, 0, 12, 0, 7, 12, 7, 0]);
function spicc(w, bar, chord, per, vel, oct = 0) {
  const c = CHORDS[chord], root = midiNote(c.ost) + 12 * (1 + oct), fifth = midiNote(c.pad[1]) - midiNote(c.pad[0]), step = per === 16 ? 1 : 2;
  for (let i = 0; i < 16; i += step) w.note('pizz', bar, i * 0.25, step * 0.2, root + (SPICC[i] === 7 ? fifth : SPICC[i]), vel + (GALLOP16.includes(i) ? 18 : 0));
}
/** EG-ROAR: THE LEGION'S CHANT - the voices on the chord's root and its fifth (C4 to B4 and over), `fig`'s rhythm: `a`
 *  the 3-3-2 (HA . . HA . . HA HA), `b` driving eighths. */
const CHANT = Object.freeze({ a: Object.freeze([[0, 0.7], [1.5, 0.7], [3, 0.45], [3.5, 0.45]]), b: Object.freeze([[0, 0.4], [0.5, 0.4], [1, 0.4], [1.5, 0.9], [2.5, 0.4], [3, 0.9]]) });
function chant(w, bar, chord, fig, vel) {
  const c = CHORDS[chord], root = 60 + (midiNote(c.ost) % 12), fifth = root + midiNote(c.pad[1]) - midiNote(c.pad[0]);
  for (const [b, len] of CHANT[fig]) { w.note('chant', bar, b, len, root, vel + (b === 0 ? 10 : 0)); w.note('chant', bar, b, len, fifth, vel - 6); }
}
/** EG-ROAR: THE SHRIEKS - the tremolo strings on `notes` in sixteenths from `beat0` for `beats` (B5 over C6: the Kyn's
 *  half step, high). */
function trem(w, bar, notes, vel, beat0 = 0, beats = 4) {
  for (let i = 0; i < beats * 4; i++) for (const n of notes) w.note('trem', bar, beat0 + i * 0.25, 0.22, n, vel + (i % 4 === 0 ? 8 : 0));
}
/** EG-ROAR: THE HARP'S RIPPLE (the Shade's) - the chord's tones up and back in sixteenths. */
function ripple(w, bar, chord, vel) {
  const c = CHORDS[chord], ns = [...new Set([...c.pad, ...c.str].map(midiNote))].sort((a, b) => a - b);
  for (let i = 0; i < 16; i++) { const j = i < 8 ? i : 15 - i; w.note('harp', bar, i * 0.25, 0.5, ns[j % ns.length] + 12 * Math.floor(j / ns.length), vel + (i % 4 === 0 ? 10 : 0)); }
}
/** EG-ROAR: A BRAAM - the low brass's cluster held (the chord's root under its octave and its fifth, and on E the Kyn's
 *  F over it), the orchestra hit, the timpani, the taiko and the long crash - never on the brass, whose bars the motifs
 *  hold. */
function braam(w, bar, chord, vel) {
  const c = CHORDS[chord], o = midiNote(c.ost);
  for (const n of chord === 'Em' ? [o - 12, o, o + 7, o + 13] : [o - 12, o, o + 7, o + 12]) w.note('ostinato', bar, 0, 2.5, n, vel);
  for (const n of c.stab) w.note('hit', bar, 0, 1.5, n, vel);
  w.note('timpani', bar, 0, 1, c.timp, vel);
  w.hit('surdo', bar, 0, vel); w.hit('crash2', bar, 0, vel - 4);
}
/** EG-ROAR: A SWELL INTO `bar` - the reverse cymbal rising over SPIRE_SWELL_S to its downbeat (E6 and F6), the timpani
 *  rolling up into it over the last beat. */
export const SPIRE_SWELL_S = 1.7;
function swellInto(w, bar, bpm, vel) {
  const len = (SPIRE_SWELL_S * bpm) / 60;
  for (const n of ['E6', 'F6']) w.note('swell', bar, -len, len, n, vel);
  roll(w, 'timpani', bar - 1, 3, 1, 'E2', vel - 40, vel);
}
/** A seeded die (the variants' order, the halls' figures) - mulberry32. */
function die(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** The three variants' order for a breach `seed` (a rotation and a turn - every order of three reachable). */
export function spireVariantOrder(seed) {
  const orders = [[0, 1, 2], [1, 2, 0], [2, 0, 1], [0, 2, 1], [2, 1, 0], [1, 0, 2]];
  return orders[(seed >>> 0) % 6];
}

/** THE BAND'S HALLS: 96 bars - three 32-bar variants (each a progression, an orchestration and the band's motif laid its
 *  own way) in the seed's order. EG-ROAR: each variant climbs in four eights - THE DESCENT (the spiccato's eighths, the
 *  legion far off), THE MOTIF (the march, the first braam), THE GATHERING (the sixteenths, the choir), THE HEIGHT (the
 *  war's drums, the motif doubled an octave up) - a swell into each, and each band its own colour over it: the
 *  Galleries' timpani and shrieks, the Cairn's soul-bell and chant, the Shade's rippling harp, its moon's half step and
 *  its heartbeat, the Wellhead's anvils on the 3-3-2. */
function hallSong(band, seed) {
  const bpm = [100, 88, 92, 110][band], order = spireVariantOrder(seed), motif = EG_SCORE_BAND_MOTIFS[band];
  return makeSong(SPIRE_BAND_SONGS[band], bpm, 96, (w) => {
    order.forEach((v, slot) => {
      const r = die(0xe617 + band * 97 + v * 13), prog = [PROG.hallA, PROG.hallB, PROG.hallC][v], b0 = slot * 32;
      for (let k = 0; k < 32; k++) {
        const bar = b0 + k, chord = prog[k % 8], c = CHORDS[chord], sec = k >> 3, lift = [0.84, 0.92, 0.98, 1.04][sec];
        bed(w, bar, chord, { drive: band === 3 ? 1 + (sec >= 3 ? 1 : 0) : sec >= 1 ? 1 : 0, strings: band !== 2 || k % 2 === 0 || sec >= 2, choir: band === 1 || sec >= 2, organ: band === 1 ? 1.1 : 0.7, vel: lift });
        spicc(w, bar, chord, sec >= 2 ? 16 : 8, 62 + sec * 8, band === 2 ? 1 : 0);
        drums(w, bar, band === 3 ? Math.min(2, 1 + (sec >> 1)) : [0, 1, 1, 2][sec], { vel: k >= 30 ? 0.86 : 0.92 });
        if (sec >= 1 && k % 8 === 0) braam(w, bar, chord, 96 + sec * 6);
        if (k % 8 === 7) swellInto(w, bar + 1, bpm, 78 + sec * 8);
        if (band === 0) {   // the Galleries: the timpani at each phrase, the shrieks at the height
          if (k % 8 === 0) w.note('timpani', bar, 0, 1, c.timp, 100);
          if (sec === 3 && k % 2 === 0) trem(w, bar, ['E5', 'F5'], 58, 2, 2);
        }
        if (band === 1) {   // the Cairn: the soul-bell tolled low, the chant from the motif on
          if (k % 4 === 0) w.note('bells', bar, 0, 4, 'B2', 92);
          if (sec >= 1) chant(w, bar, chord, 'a', 74 + sec * 6);
        }
        if (band === 2) {   // the Shade: the harp rippling, the moon's E and its F high, a heartbeat until the gathering
          ripple(w, bar, chord, 60 + Math.floor(r() * 14) + sec * 4);
          if (k % 8 === 4) w.note('bells', bar, 2, 2, 'E6', 74);
          if (k % 8 === 6) w.note('bells', bar, 2, 2, 'F6', 68);
          if (sec <= 1) { w.hit('kick', bar, 0, 90); w.hit('kick', bar, 0.375, 70); }
          if (sec >= 2 && k % 4 >= 2) trem(w, bar, ['B5', 'C6'], 50 + sec * 4);
        }
        if (band === 3) ACCENT8.forEach((acc, i) => { if (acc && (sec >= 1 || k % 2 === 0)) w.hit('anvil', bar, i * 0.5, 96 + (i === 0 ? 10 : 0)); });   // the Wellhead's anvils
      }
      // the band's motif, its own way in each variant: the horn alone, the strings over the choir, the brass low - and at
      // the height doubled an octave over on the brass (on the horn where the brass already has it)
      for (let k = 8; k < 32; k += 8) {
        const voice = v === 0 ? 'horn' : v === 1 ? 'strings' : 'brass', oct = band === 3 ? 0 : v === 2 ? -1 : 0;
        line(w, b0 + k, [motif], voice, 104 + Math.floor(r() * 10), oct);
        if (k + 4 < 32) line(w, b0 + k + 4, [motif], v === 0 ? 'strings' : 'horn', 92, oct + (v === 0 ? 1 : 0));
        if (k === 24) { line(w, b0 + k, [motif], voice === 'brass' ? 'horn' : 'brass', 100, oct + 1); line(w, b0 + k + 6, [motif], 'strings', 96, oct + 1); }
      }
    });
  }, SPIRE_LEVEL.hall, SPIRE_PRESS.hall);
}
/** SPIREYRD - a trial's fight: the band's motif in the brass over the legion's drums, the ostinato driving. EG-ROAR: in
 *  five parts - THE CALL (a braam, the march), THE DRIVE (the war's drums, the spiccato in sixteenths), THE BREAK (the
 *  drums gone far off, the ostinato and the strings out, the chant alone over the spiccato's eighths), THE BUILD (the shrieks rising, the snare rolling up)
 *  and THE HEIGHT (a braam, the war, the motif doubled an octave up in the strings, the last four bars at the count's
 *  drive) - and a swell into each. */
function yardSong(band) {
  const motif = EG_SCORE_BAND_MOTIFS[band];
  return makeSong(SPIRE_SONGS.yard, 132, 32, (w) => {
    for (let bar = 0; bar < 32; bar++) {
      const chord = PROG.war[bar % 8], c = CHORDS[chord], brk = bar >= 16 && bar < 20, build = bar >= 20 && bar < 24, height = bar >= 24;
      bed(w, bar, chord, { drive: brk ? 0 : height ? 2 : 1, choir: bar >= 16, strings: !brk, organ: brk ? 0.5 : 1, vel: brk ? 0.85 : 1 });
      spicc(w, bar, chord, brk ? 8 : 16, brk ? 70 : 84);
      drums(w, bar, brk ? 0 : height ? (bar >= 28 ? 3 : 2) : bar >= 4 && !build ? 2 : 1);
      w.note('timpani', bar, 0, 1, c.timp, 108);
      if (bar % 2 === 0) for (const n of c.stab) w.note('brass', bar, 0, 0.9, n, 108);
      if (band === 3 && bar % 2 === 1) w.hit('anvil', bar, 2, 100);
      if (bar >= 16) chant(w, bar, chord, brk ? 'a' : 'b', brk ? 84 : 92);
      if (build) trem(w, bar, ['B5', 'C6'], 60 + (bar - 20) * 10);
      if (bar >= 22 && bar < 24) roll(w, 'kit', bar, 0, 4, 'snare', 60 + (bar - 22) * 30, 90 + (bar - 22) * 30);
      if (bar === 0 || bar === 16 || bar === 24) braam(w, bar, chord, 116);
      if (bar === 3 || bar === 15 || bar === 23 || bar === 31) swellInto(w, bar + 1, 132, 96);
    }
    for (let bar = 4; bar < 32; bar += 2) line(w, bar, [motif], 'brass', 112, band === 2 ? -1 : 0);
    line(w, 8, [EG_FANFARE_BROKEN], 'horn', 110);
    line(w, 24, [EG_FANFARE_BROKEN], 'horn', 116);
    for (const k of [24, 26, 28, 30]) line(w, k, [motif], 'strings', 100, (band === 2 ? -1 : 0) + 1);
  }, SPIRE_LEVEL.yard, SPIRE_PRESS.yard);
}
/** SPIRESET - a set-piece passage's cue, 8 bars a band: the band's motif climbing over the count's two chords. EG-ROAR:
 *  a braam at its head and its middle, the chant and the spiccato through it, the shrieks and the count's drive in its
 *  second half, the snare rolling up into its turn. */
function setSong(band) {
  const motif = EG_SCORE_BAND_MOTIFS[band];
  return makeSong(SPIRE_SONGS.set, 140, 8, (w) => {
    for (let bar = 0; bar < 8; bar++) {
      const chord = PROG.count[bar], c = CHORDS[chord];
      bed(w, bar, chord, { drive: 2, choir: true, vel: 1.05 });
      drums(w, bar, bar >= 6 ? 3 : 2, { fill: bar % 2 === 1 });
      spicc(w, bar, chord, 16, 90);
      chant(w, bar, chord, 'b', 96);
      for (const n of c.stab) w.note('hit', bar, 0, 1, n, 104);
      line(w, bar, [motif], bar % 2 ? 'horn' : 'brass', 112, Math.floor(bar / 4));
      if (bar >= 4) trem(w, bar, ['B5', 'C6'], 66 + (bar - 4) * 6);
    }
    braam(w, 0, PROG.count[0], 118); braam(w, 4, PROG.count[4], 120);
    swellInto(w, 4, 140, 100); swellInto(w, 8, 140, 104);
    roll(w, 'kit', 7, 2, 2, 'snare', 80, 124);
  }, SPIRE_LEVEL.set, SPIRE_PRESS.set);
}
/** SPIRWAKE - a lord's wake: two bars swelling from nothing into SPIRLRD1. EG-ROAR: the timpani rolling in sixteenths,
 *  the taiko and the low brass growling E against F in eighths, the swell rising to the lord's downbeat, and the chant's
 *  one shout on the last eighth. */
function wakeSong() {
  return makeSong(SPIRE_SONGS.wake, 138, 2, (w) => {
    for (let i = 0; i < 32; i++) w.note('timpani', Math.floor(i / 16), (i % 16) * 0.25, 0.22, 'E2', 44 + i * 2.6);
    for (let i = 0; i < 16; i++) {
      w.hit(i % 2 ? 'lowTom' : 'surdo', Math.floor(i / 8), (i % 8) * 0.5, 50 + i * 4);
      w.note('ostinato', Math.floor(i / 8), (i % 8) * 0.5, 0.45, i % 4 === 3 ? 'F2' : 'E2', 52 + i * 4);
    }
    swellInto(w, 2, 138, 104);
    w.hit('crash', 1, 3.5, 100);
    w.note('chant', 1, 3.5, 0.5, 'E4', 112); w.note('chant', 1, 3.5, 0.5, 'B4', 106);
  }, SPIRE_LEVEL.wake, SPIRE_PRESS.wake);
}
/** SPIRLRD1/2/3 - a Court by phase: the war's bed, the lord's own four bars written into it (the brass in the first, the
 *  choir and the horn in the second, everything in the third), the drums climbing. EG-ROAR: a braam at each eight (each
 *  four in the third), a swell into each eight, the spiccato in sixteenths (the first phase's first eight in eighths),
 *  the chant from the second phase's second eight (the whole of the third's, driving), the shrieks at the top of the
 *  second and through the second half of the third, the snare rolling into the height, and the lord's bars doubled an
 *  octave up in the strings there. */
function lordSong(phase, motifIdx) {
  const motif = EG_SCORE_LORD_MOTIFS[motifIdx] ?? EG_SCORE_LORD_MOTIFS[0], bpm = [138, 144, 152][phase - 1], prog = phase === 3 ? PROG.war3 : PROG.war;
  return makeSong(SPIRE_SONGS[`lord${phase}`], bpm, 32, (w) => {
    for (let bar = 0; bar < 32; bar++) {
      const chord = prog[bar % 8], c = CHORDS[chord], sec = bar >> 3;
      bed(w, bar, chord, { drive: phase >= 2 || sec >= 1 ? 2 : 1, choir: phase >= 2 || bar >= 16, organ: 1 + 0.1 * phase, vel: 1 + 0.03 * phase });
      drums(w, bar, phase >= 3 || sec === 3 ? 3 : 2);
      spicc(w, bar, chord, phase >= 2 || sec >= 1 ? 16 : 8, 84 + phase * 4);
      for (let i = 0; i < (phase >= 3 ? 8 : 2); i++) w.note('timpani', bar, i * (phase >= 3 ? 0.5 : 2), 0.45, c.timp, i === 0 ? 112 : 96);
      for (const n of c.stab) { w.note('hit', bar, 0, 1, n, 104); if (phase >= 2) w.note('hit', bar, 2.5, 0.5, n, 98); }
      if (bar % 8 === 0) w.note('bells', bar, 0, 4, phase === 3 ? 'B2' : 'E3', 94);
      if (bar % (phase >= 3 ? 4 : 8) === 0) braam(w, bar, chord, 108 + phase * 4);
      if (bar % 8 === 7) swellInto(w, bar + 1, bpm, 90 + phase * 4);
      if ((phase >= 2 && bar >= 8) || phase >= 3) chant(w, bar, chord, phase >= 3 ? 'b' : 'a', 86 + phase * 4);
      if (phase >= 2 && sec >= (phase === 2 ? 3 : 2) && bar % 2 === 0) trem(w, bar, ['B5', 'C6'], 62 + phase * 4);
      if (bar === 23) roll(w, 'kit', bar, 2, 2, 'snare', 70, 122);
    }
    for (let k = 0; k < 32; k += 8) {
      line(w, k, motif, 'brass', 112 + phase * 2, String(motif[0][0][0]).endsWith('2') ? 1 : 0);
      if (phase >= 2) line(w, k + 4, motif, 'horn', 108, 0);
      if (phase >= 3) line(w, k + 4, motif, 'strings', 100, 1);
    }
    line(w, 24, motif.slice(0, 2), 'strings', 100, 1);
  }, SPIRE_LEVEL[`lord${phase}`], SPIRE_PRESS[`lord${phase}`]);
}
/** SPIRVALK - a Valkynaz, all phases: 48 bars rising a step every 16 (the bed lifted, the drums doubling), its motif over
 *  the broken fanfare. EG-ROAR: a braam and a swell at each eight, harder each step; the spiccato from eighths to
 *  sixteenths at the second step; the chant from the second (driving in the third); the shrieks and the timpani's rolls
 *  through the third. */
function valkSong(motifIdx) {
  const motif = EG_SCORE_LORD_MOTIFS[motifIdx] ?? EG_SCORE_LORD_MOTIFS[3];
  return makeSong(SPIRE_SONGS.valk, 148, 48, (w) => {
    for (let bar = 0; bar < 48; bar++) {
      const tier = Math.floor(bar / 16), chord = (tier === 2 ? PROG.war3 : PROG.war)[bar % 8], c = CHORDS[chord];
      bed(w, bar, chord, { drive: 1 + Math.min(1, tier), choir: tier >= 1, vel: 1 + 0.04 * tier });
      drums(w, bar, 1 + tier);
      spicc(w, bar, chord, tier >= 1 ? 16 : 8, 82 + tier * 6);
      for (const n of c.stab) w.note('hit', bar, 0, 1, n, 100 + tier * 4);
      if (bar % 4 === 0) w.note('timpani', bar, 0, 2, c.timp, 104 + tier * 4);
      if (bar % 8 === 0) braam(w, bar, chord, 104 + tier * 6);
      if (bar % 8 === 7) swellInto(w, bar + 1, 148, 88 + tier * 6);
      if (tier >= 1) chant(w, bar, chord, tier >= 2 ? 'b' : 'a', 86 + tier * 4);
      if (tier >= 2 && bar % 2 === 0) trem(w, bar, ['B5', 'C6'], 70);
      if (tier >= 2 && bar % 4 === 3) roll(w, 'timpani', bar, 2, 2, c.timp, 80, 118);
    }
    for (let k = 0; k < 48; k += 8) { line(w, k, motif, 'brass', 112 + Math.floor(k / 16) * 3, 0); line(w, k + 4, [EG_FANFARE_BROKEN], 'horn', 108 + Math.floor(k / 16) * 3, Math.floor(k / 16) >= 2 ? 1 : 0); }
  }, SPIRE_LEVEL.valk, SPIRE_PRESS.valk);
}
/** SPIRREDT - a Redoubt taken, and its rest: the Battlemages' hymn in E major, the fanfare WHOLE on the horn, the choir
 *  and the organ, no drums. EG-ROAR: the harp climbing each chord in eighths, the timpani's soft roll into each four. */
function redoubtSong() {
  return makeSong(SPIRE_SONGS.redoubt, 72, 16, (w) => {
    for (let bar = 0; bar < 16; bar++) {
      const chord = PROG.hymn[bar % 8], up = CHORDS[chord].str.map(midiNote);
      bed(w, bar, chord, { drive: 0, choir: true, organ: 1.2 });
      [0, 1, 2, 3, 4, 5, 4, 3].forEach((j, i) => w.note('harp', bar, i * 0.5, 1, up[j % 3] + 12 * Math.floor(j / 3), 66 + (i === 0 ? 10 : 0)));
      if (bar % 4 === 3) roll(w, 'timpani', bar, 2, 2, 'E2', 36, 72);
    }
    line(w, 0, [EG_FANFARE], 'horn', 104);
    line(w, 4, [EG_FANFARE], 'horn', 108, 0);
    line(w, 8, [EG_FANFARE], 'brass', 100, -1);
    line(w, 12, [EG_FANFARE], 'horn', 112, 0);
    w.note('bells', 15, 0, 4, 'E5', 90);
  }, SPIRE_LEVEL.redoubt, SPIRE_PRESS.redoubt);
}
/** SPIRECNT - THE COUNT's last two minutes: E against F, a bar each, the bell tolling every bar - counting - the broken
 *  fanfare hammered on the brass, the kick on every beat. EG-ROAR: THE CLOCK - the woodblocks ticking every eighth - the
 *  spiccato and the chant driving, a braam each four, the shrieks rising through the second half, a swell into each
 *  eight. */
function countSong() {
  return makeSong(SPIRE_SONGS.count, 160, 16, (w) => {
    for (let bar = 0; bar < 16; bar++) {
      const chord = PROG.count[bar % 8], c = CHORDS[chord];
      bed(w, bar, chord, { drive: 2, choir: true, vel: 1.08 });
      drums(w, bar, 3);
      spicc(w, bar, chord, 16, 96);
      w.note('bells', bar, 0, 2, 'E3', 100);
      for (let i = 0; i < 8; i++) w.hit(i % 2 ? 'woodLo' : 'woodHi', bar, i * 0.5, i % 2 ? 84 : 100);
      for (const n of c.stab) { w.note('hit', bar, 0, 1, n, 108); w.note('hit', bar, 2, 1, n, 100); }
      chant(w, bar, chord, 'b', 98);
      if (bar >= 8) trem(w, bar, ['B5', 'C6'], 70 + (bar - 8) * 4);
      if (bar % 4 === 0) braam(w, bar, chord, 118);
      if (bar % 8 === 7) swellInto(w, bar + 1, 160, 100);
    }
    for (let k = 0; k < 16; k += 2) line(w, k, [EG_FANFARE_BROKEN], 'brass', 116, k >= 8 ? 1 : 0);
  }, SPIRE_LEVEL.count, SPIRE_PRESS.count);
}
/** SPIREEND - the tear, the end: the end's progression falling under the fanfare's last broken notes, slowing to nothing
 *  in its own time - the last four bars the organ alone, dying. EG-ROAR: opened by the last braam, and the strings'
 *  lament falling a step a bar from E5 to F4 over it. */
function endSong() {
  return makeSong(SPIRE_SONGS.end, 70, 12, (w) => {
    braam(w, 0, 'Em', 124);
    for (let bar = 0; bar < 12; bar++) {
      const chord = PROG.end[bar % 8], fade = Math.max(0.25, 1 - bar / 12);
      if (bar < 8) bed(w, bar, chord, { drive: 0, choir: bar < 6, strings: true, organ: fade, vel: fade });
      else for (const n of CHORDS.Em.pad) w.note('organ', bar, 0, 4, n, 70 * fade);
    }
    ['E5', 'D5', 'C5', 'B4', 'A4', 'G4', 'F4'].forEach((n, i) => w.note('strings', i + 1, 0, 3.8, n, 92 - i * 7));
    for (let i = 0; i < 8; i++) w.note('timpani', 0, i * 0.5, 0.45, 'E2', 100 - i * 6);
    line(w, 1, [EG_FANFARE_BROKEN], 'horn', 100);
    line(w, 4, [[['G4', 2], ['F4', 2]]], 'horn', 88);
    w.note('bells', 7, 0, 4, 'E3', 84);
  }, SPIRE_LEVEL.end, SPIRE_PRESS.end);
}

const _made = new Map();
/** One song made once for its own key (the band's, the lord's, the seed's order) - kept, so a new lord never re-makes the
 *  band's halls and a new circle of one band remakes nothing. */
const made = (k, fn) => { let s = _made.get(k); if (!s) { if (_made.size > 48) _made.clear(); _made.set(k, s = fn()); } return s; };
/**
 * THE SONGS for a context `{ band, motif, valk, seed }` (the band's index 0-3, the Court's lord's motif, the band's
 * Valkynaz's motif, the breach's seed - the halls' variants' order): every song the law can name there, by its law's key.
 * Each made once for what it depends on.
 * @param {{ band?: number, motif?: number, valk?: number, seed?: number }} ctx
 */
export function spireScoreSongs({ band = 0, motif = 0, valk = 3, seed = 0 } = {}) {
  const b = Math.max(0, Math.min(3, band | 0)), order = (seed >>> 0) % 6;
  return Object.freeze({
    hall: made(`hall:${b}:${order}`, () => hallSong(b, seed)), yard: made(`yard:${b}`, () => yardSong(b)), set: made(`set:${b}`, () => setSong(b)), wake: made('wake', wakeSong),
    lord1: made(`lord1:${motif}`, () => lordSong(1, motif)), lord2: made(`lord2:${motif}`, () => lordSong(2, motif)), lord3: made(`lord3:${motif}`, () => lordSong(3, motif)),
    valk: made(`valk:${valk}`, () => valkSong(valk)), redoubt: made('redoubt', redoubtSong), count: made('count', countSong), end: made('end', endSong),
  });
}

/**
 * THE LAW (section 26): what the Spire plays at a place - a SPIRE_SONGS name, SPIRE_SCORE_SILENCE (the band's ambience
 * alone), or null (not in the Spire: the host's music director stands). `place`:
 *   { band, sg (the hall's stage - net/eliteGates/egLink.js), kind (the hall's), lord, valk, phase (1-3), countLeft (ms, while it runs),
 *     set (a set piece stands in this hall), sinceWake (ms since the hall woke - a Court's, since its LORD woke), asleep (a
 *     Court whose lord has not woken - the band's ambience), end (the breach is over), sinceEnd (ms), sinceFall (ms since my
 *     own fall - SPIREEND, as the end) } (AUDIT EG V, c: L7-12 and L7-13)
 */
export function spireScoreFor(place) {
  if (!place) return null;
  const key = spireScoreKey(place);
  if (key === 'ambience') return SPIRE_SCORE_SILENCE;
  if (key === 'end') return (place.sinceEnd ?? 0) < SPIRE_END_MS ? SPIRE_SONGS.end : SPIRE_SCORE_SILENCE;   // AUDIT EG V (c, L7-13): a fall's end is its own SPIRE_END_MS (spireScoreKey), `sinceEnd` 0 with no end standing
  if (key === 'hall') return SPIRE_BAND_SONGS[Math.max(0, Math.min(3, place.band | 0))];
  if (key === 'lord') return SPIRE_SONGS[`lord${Math.max(1, Math.min(3, place.phase | 0 || 1))}`];
  return SPIRE_SONGS[key];
}
/** Which row of THE PRIORITY TABLE a place takes (EG_SCORE_PRIORITY). Pure. */
export function spireScoreKey(p) {
  const fight = p.sg === 'trial';
  // AUDIT EG V (c, L7-12): a Court whose lord still sleeps (`asleep` - the hall woke, the lord has not) plays the band's
  // ambience; its wake's swell is timed from the lord's own wake (`sinceWake`, scenes/eliteGates/egClient.js scoreView)
  const sleeping = fight && p.kind === 'court' && !!p.asleep;
  const rows = {
    end: !!p.end || (Number.isFinite(p.sinceFall) && p.sinceFall >= 0 && p.sinceFall < SPIRE_END_MS),   // AUDIT EG V (c, L7-13): "the tear, a fall, the end" - my own fall's
    valk: fight && p.kind === 'court' && !!p.valk,
    redoubt: p.sg === 'rest',
    count: Number.isFinite(p.countLeft) && p.countLeft > 0 && p.countLeft <= SPIRE_COUNT_WARN_MS && (fight || p.sg === 'closing'),
    wake: fight && p.kind === 'court' && !sleeping && (p.sinceWake ?? Infinity) < SPIRE_WAKE_MS,
    lord: fight && p.kind === 'court' && !sleeping,
    set: fight && !!p.set,
    yard: fight && (p.kind === 'yard' || p.kind === 'rampart'),
    hall: fight && !sleeping,
    ambience: true,
  };
  return EG_SCORE_PRIORITY.find((k) => rows[k]) ?? 'ambience';
}

/**
 * THE SCORE AS THE WORLD HOST HEARS IT (world.js's hourScoreFrame asks it first): `frame(view)` with the breach client's
 * view (scenes/eliteGates/egClient.js scoreView - `{ place, ctx }`, or null outside the Spire) - the context's songs registered under
 * their names when it changes, the law's song played (or faded to the band's ambience), the end's from its own first
 * note. Answers whether the Spire holds the music this frame (let go by a fade, never a cut - AUDIT SD III A4).
 * @param {{ music: any, now?: () => number }} deps
 */
export function createSpireScoreHost({ music, now = () => Date.now() }) {
  let held = false, ctxKey = '', endAt = null;
  return {
    frame(view) {
      if (!view?.place) {
        if (held) { held = false; endAt = null; music?.fadeOut?.(); }
        return false;
      }
      const c = view.ctx ?? {}, k = `${c.band | 0}:${c.motif | 0}:${c.valk | 0}:${(c.seed >>> 0) % 6}`;
      if (k !== ctxKey) { ctxKey = k; for (const song of Object.values(spireScoreSongs(c))) music?.registerSong?.(song.name, song); }
      held = true;
      const t = now();
      if (view.place.end && endAt === null) endAt = t + SCORE_STING_LEAD_MS;   // from when it sounds (AUDIT WBX W3's law)
      if (!view.place.end) endAt = null;
      const want = spireScoreFor({ ...view.place, sinceEnd: endAt === null ? 0 : Math.max(0, t - endAt) });
      if (want === SPIRE_SCORE_SILENCE || want == null) { if (music?.current !== null) music?.fadeOut?.(); } else music?.playSong?.(want);
      return true;
    },
    /** Whether it holds the music (tests). */
    get held() { return held; },
  };
}
