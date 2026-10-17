// @ts-check
// EG-G1 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 27.5, 27.7, 27.8 and
// 27.9): EVERY EVENT IS SEEN, HEARD AND SAID, AND THE FIRST BREACH TEACHES -
//   THE WORDS (`EG_PRES_TEXT`): every line the Spire's HUD, its beats, its cards and its first breach add, worded once
//     (section 27.9: short, in the Elder Scrolls' own voice, WB13b's rules). The breach's law keeps its own words
//     (net/eliteGates/egLaw.js EG_TEXT - in the relay's bundle, so a word added there would move the relay's law hash; these are
//     the client's alone);
//   THE BEATS (`EG_BEATS`, section 27.5's table, pinned): each event's sight, its sound (`EG_BEAT_SOUNDS` - Daggerfall's
//     own records, as the Hour's are played: the bell 107, the chime 364, the drums 374, the fanfare 32, the door 25),
//     its words, and who already says them (the fight's beat line - scenes/eliteGates/egFight.js EG_SAY; the client's own chat line;
//     the veil's own sound; the score's song), so a beat is said once and never twice;
//   THE WATCH (`egBeatWatch`): the beats a breach's state has newly heard - the room's beat lines, the falls, a Redoubt,
//     a gift, a hall's wake (its twist and its fork) and the last word - and the first-time lines they bring due. Pure:
//     what was heard before the first look is never replayed (a reload mid-breach says nothing old);
//   THE FIRST BREACH (`EG_TEXT_FIRST`, section 27.7): nine lines, each at its first occurrence and never in a card
//     before it applies, and the Rehearsal's own teaching line, once (`egFirstDue`). EG-ZF (2026-10-12): ONCE AN ACCOUNT -
//     the account service keeps the bits (`/v1/eg/keys` `first`, written by `/v1/eg/first` as a line is shown) and they
//     are read over the device's own (`egFirstOver`); a device with no account keeps the device's (`eg.first`);
//   THE EXAMINATION HEARD (section 25.7): the Spellmaster's runes tell their order by numerals and light, and by a chime
//     as each lights, pitched up its numeral (`EG_RUNE_CHIME`), its numeral in the live line;
//   THE TOUCH OF IT (`EG_HAPTICS`, section 27.8): 15 ms when the Beat underfoot enters its last 0.4 s, 30 ms on a peril,
//     a pad's dual rumble for the same two, behind the touch layer's own `touchHaptics` (`egBuzz`); `egBeatUnder` and
//     `egPerilsNew` find them, pure.
//   AUDIT EG III (2026-10-13, section 27.5's last rows; section 15): THE VESTIGES SEEN, HEARD AND SAID - Second Wind, Rally's
//     heal, Lifeline's and Shield-Hymn's windows, Spellweave's free spell, Rallying Cry's refresh, Bladestorm, Deadeye, an
//     Accord forming and lapsing (Kindled Steel's splash among them) and resonance first reached, each a row of EG_BEATS on
//     THE SPIRE MIX's critical bus as every beat is; THE HOLDER'S CHIPS (`egHolderNow`, `egHolderWatch`): a blue chip for each
//     timed window on me with its seconds, Spellweave's free spell standing, and each Accord standing - and the beats they
//     bring as each window opens and each Accord forms or lapses (once a hall each way).
//
// Not a DFU member. Ledger A (ELITE-GATES).
import { EG_TEXT, EG_TWIST_LINES, egHallOf } from '../../net/eliteGates/egLaw.js';
import { egInShape } from '../../net/eliteGates/egShape.js';
import { EG_BEAT_CYCLE_S, EG_BEAT_SOLID_S } from '../../net/eliteGates/egSpanLaw.js';
import { EG_OBJ } from '../../net/eliteGates/egLords.js';
import { EG_ROLE } from '../../net/eliteGates/egBodies.js';
import { egResonance, EG_CAPSTONES, EG_V_FAMILY_NAMES, EG_ACCORDS } from '../../net/eliteGates/egVestige.js';   // AUDIT EG III: resonance's beat, the Accords' chips
import { egRunOfMember, egMemberOf } from '../../net/eliteGates/egLink.js';
import { t } from '../../systems/textManager.js';   // AUDIT EG V (c): the words this audit adds, in the player's language
import { EG_BOSS_KEYS, egBossName } from '../../net/eliteGates/egLords.js';   // AUDIT EG V (c, L7-16): the lord a wake names
import { EG_FL } from '../../net/eliteGates/egBodies.js';

/** AUDIT EG III: a share of the health bar as the screen says it - whole percent, never "-0%" for a share that took
 *  something. */
const pctOf = (share) => Math.max(share > 0 ? 1 : 0, Math.round(share * 100));

/** Every new line, worded once (section 27.9). */
export const EG_PRES_TEXT = Object.freeze({
  castBack: '-10%',
  // EG-ZR (section 15's Featherstep): a cast-back's cost as it was taken. AUDIT EG III: `share` the points taken over the
  // health bar's whole (the floor's and Stoneskin's say), never the law's share
  castBackCost: (share) => `-${pctOf(share)}%`,
  // EG-ZI (section 10.6): the pull's toll - its share on the screen, as the cast-back's, and its line with the pull's.
  // AUDIT EG III: `share` what it took of the health bar's whole (the last point it never takes and Stoneskin's cushion say)
  toll: (share) => `-${pctOf(share)}%`,
  tollLine: (share) => `The Spire takes its toll: ${pctOf(share)}% of your health.`,
  // AUDIT EG III (section 15's resonance and Accords): an offer's card says the capstone a third Vestige of its family
  // completes, and what each Accord it takes does; the recap's capstones
  completes: (fam, cap, line) => `Completes ${fam}: ${cap}. ${line}`,
  accordDoes: (name, line) => `${name}: ${line}`,
  recapCapstones: 'Capstones',
  // AUDIT EG III (section 27.5): the Vestiges' beats, and the holder's chips
  secondWind: (n) => (n > 0 ? `Second Wind! ${n} health returns.` : 'Second Wind!'),
  rally: (pct) => `Rally! The company heals ${pct}%.`,
  lifeline: (pct) => `Lifeline! ${pct}% less from blows for 3 seconds.`,
  shieldHymn: "Shield-Hymn! Bastion's guard for 4 seconds.",
  spellweave: 'Spellweave! The spell costs nothing.',
  rallyingCry: 'Rallying Cry! Your Second Wind is ready again.',
  bladestorm: 'Bladestorm!',
  deadeye: 'Deadeye! The arrow runs through.',
  accordForms: (name, mates) => `${name}, with ${mates}.`,
  accordLapses: (name) => `${name} lapses.`,
  resonance: (fam, cap) => `${fam} resonates: ${cap}.`,
  heldChip: (name, secs) => (secs > 0 ? `${name} ${secs}s` : name),
  weaveChip: 'Spellweave - free',
  // EG-ZS (section 8.5): the decree the Markynaz lays, on his card; (section 15) the Accord an offer's card would take
  champDecree: (title, decree) => `${title}: ${decree}`,
  takesAccord: (name, vestige) => `Takes an Accord with ${name}'s ${vestige}.`,
  divides: 'The way divides.',
  lastWord: 'The last word. The breach closes.',
  held: 'Held',
  press5: 'The Covenant presses. Five minutes.',
  courtShort: 'The count will not hold through the next Court.',
  gain: (t, why) => (why ? `+${t} - ${why}` : `+${t}`),
  pressWhy: "the Covenant's Press",
  lastWhy: 'the last word',
  surplus: 'Surplus +1',
  decrees: (n) => (n === 1 ? '1 decree' : `${n} decrees`),
  hallBand: (h, band) => `Hall ${h} - ${band}`,
  hallCourt: (h) => `Hall ${h} - the Court`,
  standing: (k, n) => `${k} of ${n}`,
  reliquaries: (n) => `Reliquaries ${n}`,
  wayDown: (m) => `The way down - ${m} m`,
  absent: (s) => `Absent - ${s}s`,
  recallSpent: 'Last life',
  rehearsal: 'A Rehearsal: Halls 1 to 5, the count and one life. Nothing is won here, and nothing is lost.',
  highRoad: 'High Road',
  lowRoad: 'Low Road',
  touch: Object.freeze({ prev: '\u2039 Watch', next: 'Watch \u203A', forsake: 'Forsake', home: 'Walk home', bridge: 'Spirebridge' }),
  pad: Object.freeze({ choose: 'Choose', take: 'Take', no: 'No', watch: 'Watch another', forsake: 'Forsake (hold)', close: 'Close', bridge: 'Spirebridge' }),
  // AUDIT EG III (section 15): SPIREBRIDGE - the ask offered while a gap lies ahead (B, the pad's up, the touch button, or
  // /breach bridge), a plank standing told with its seconds, and the room's word said on every screen
  bridgeReady: 'Spirebridge: B bridges the gap ahead.',
  bridgeStands: (n, s) => `${n}'s Spirebridge - ${s}s`,
  bridgeRaised: (n) => `${n} raises a Spirebridge over the gap ahead.`,
  bridgeMine: 'Your Spirebridge spans the gap ahead.',
  bridgeNone: 'No gap a Spirebridge can span lies ahead.',
  bridgeSpent: 'Your Spirebridge is spent until the next span.',
  bridgeNot: 'You hold no Spirebridge.',
  recapHead: 'The breach is over',
  recapDepth: (h, rd, band) => `Hall ${h} - Redoubt ${rd} - ${band}`,
  recapTime: (t) => `From the first wake: ${t}`,
  recapLeft: Object.freeze({ home: 'walked home', forsaken: 'forsook it', fallen: 'fell', standing: 'stood to the end', away: 'was not there' }),
  recapRecall: Object.freeze({ held: 'recall kept', spent: 'recall spent' }),
  recapReliquaries: (n) => `Reliquaries opened: ${n}`,
  recapAccords: 'Accords',
  recapClose: 'Press Enter to close.',
  // EG-ZF (section 27.6): each member's share and healing on the recap; the board's line; the lord's fall's chart
  recapShare: (s) => `${s} of the damage`,
  recapHealed: (n) => `${n} healed`,
  boardDescent: (bracket, rank) => `The Descent, ${bracket}: ${rank}`,
  boardDepths: (rank) => `The Depths: ${rank}`,
  boardBrackets: Object.freeze({ alone: 'Alone', few: 'the Few', company: 'the Company' }),
  chartLord: 'Lord',
  chartSub: (name, n, plural) => `${name} ${plural ? 'have' : 'has'} fallen - ${n === 1 ? 'one alone' : `a company of ${n}`}`,
});
/** The bands' own lines, on a band's first arrival card (section 7's table). */
export const EG_BAND_LINES = Object.freeze([
  "The academy's upper halls, still over the Deadlands.",
  "Halls fallen into the Ideal Masters' realm of the dead.",
  "Halls fallen into Nocturnal's dusk.",
  'The muster-ground of 3E 398. It has no floor.',
]);

/** THE FIRST BREACH's lines (section 27.7), in their bits' order. */
export const EG_TEXT_FIRST = Object.freeze({
  count: 'The count runs. Take a Redoubt to hold it back.',
  door: 'The first across opens the door. The others have 45 seconds.',
  void: 'The void casts you back.',
  fork: 'High and fast, or low and safe.',
  fury: 'A slow lord turns to fury.',
  decrees: "Choose the circle's decrees.",
  recall: 'A Redoubt can call the fallen back once.',
  memento: "Carry a fallen friend's Memento to a niche.",
  home: 'Walk home to open your Reliquaries.',
});
export const EG_FIRST_KEYS = Object.freeze(Object.keys(EG_TEXT_FIRST));
/** The Rehearsal's own teaching line's bit, after the nine. */
export const EG_FIRST_REHEARSAL_BIT = EG_FIRST_KEYS.length;
/** Where the device keeps the lines it has said (a bit each). */
export const EG_FIRST_KEY = 'eg.first';

/** THE BEATS' SOUNDS: DAGGER.SND records, played as the Hour plays its own (scenes/superDungeon/sdHall.js SD_HALL_SOUNDS - the bell
 *  107, the Concord's chime 364; scenes/superDungeon/sdSteps.js the void's moan 66 at a cast-back), and the arena's (systems/
 *  arenaSound.js ARENA_CLIPS - the drums 374, the fanfare 32), the door's (DungeonDoorOpen 25), the cauldron's chord
 *  (MakePotion 365) and the enchanter's chime that rings a Rare drop (scenes/corpseMarker.js playRareDrop - MakeItem 364).
 *  `by` a sound another part already plays: the veil's close (ui/gate/gateVeil.js) and the score's SPIRREDT (EG17). */
export const EG_BEAT_SOUNDS = Object.freeze({
  rewind: Object.freeze({ rec: 66, vol: 0.85, pitch: 1.25 }),
  veil: Object.freeze({ by: 'veil' }),
  door: Object.freeze({ rec: 25, vol: 1, pitch: 0.8 }),
  chime: Object.freeze({ rec: 364, vol: 0.8, pitch: 1 }),
  softChime: Object.freeze({ rec: 364, vol: 0.45, pitch: 1.2 }),
  bell: Object.freeze({ rec: 107, vol: 0.8, pitch: 1.3 }),
  fanfare: Object.freeze({ rec: 32, vol: 0.9, pitch: 1 }),
  drum: Object.freeze({ rec: 374, vol: 1, pitch: 0.9 }),
  lowToll: Object.freeze({ rec: 107, vol: 0.9, pitch: 0.42 }),   // EG-ZD (section 16.5): a fall's low toll - clip 107 at pitch 0.42, the page's
  toll: Object.freeze({ rec: 107, vol: 1, pitch: 0.75 }),
  rare: Object.freeze({ rec: 364, vol: 1, pitch: 1 }),
  chord: Object.freeze({ rec: 365, vol: 0.9, pitch: 0.9 }),
  score: Object.freeze({ by: 'score' }),
  // AUDIT EG III: Bladestorm's sweep - the low swing (systems/soundClips.js SOUND.SwingLowPitch, SoundClips.cs), lower; Deadeye's
  // pierce - the bow's loose (SOUND.ArrowShoot), higher
  sweep: Object.freeze({ rec: 105, vol: 1, pitch: 0.7 }),
  pierce: Object.freeze({ rec: 3, vol: 0.9, pitch: 1.5 }),
});

/** THE EXAMINATION HEARD (section 25.7): the chime as a rune lights, and how far up each numeral pitches it. */
export const EG_RUNE_CHIME = Object.freeze({ rec: 364, vol: 0.7, pitch: 0.9, step: 0.12 });
export const egRuneChime = (pt) => ({ rec: EG_RUNE_CHIME.rec, vol: EG_RUNE_CHIME.vol, pitch: Math.round(EG_RUNE_CHIME.pitch * (1 + EG_RUNE_CHIME.step * Math.max(0, pt - 1)) * 1000) / 1000 });

/**
 * EVERY EVENT IS SEEN, HEARD AND SAID (section 27.5's table, in its order): `sight` what the screen shows, `sound` a key
 * of EG_BEAT_SOUNDS (null none), `words` the line (a function of the name `n` and the room's word `t`, or null none),
 * `by` who already says the words - 'fight' the fight's beat line on the screen (scenes/eliteGates/egFight.js EG_SAY), 'client' the
 * client's own chat line (scenes/eliteGates/egClient.js), null this beat's own: on the screen, and in the chat where `chat`.
 */
export const EG_BEATS = Object.freeze({
  castBack: Object.freeze({ sight: "a 0.4 s dither cut to the waystone, the Steps' rewind burst", sound: 'rewind', words: (n, t) => t ?? EG_PRES_TEXT.castBack, by: null, chat: false }),   // EG-ZR: `t` the cost taken (Featherstep's)
  pull: Object.freeze({ sight: "the veil's flash", sound: 'veil', words: () => EG_TEXT.pulled, by: 'client', chat: true }),
  door: Object.freeze({ sight: 'the beam, the markers', sound: 'door', words: () => EG_TEXT.door, by: 'fight', chat: false }),
  cache: Object.freeze({ sight: "its icon on the door's plaque; taken: the loot banner", sound: 'chime', words: null, by: 'client', chat: true }),
  fork: Object.freeze({ sight: "two banners on the island: a Reliquary's glint high, a brazier and a stair low", sound: null, words: () => EG_PRES_TEXT.divides, by: null, chat: false }),
  niche: Object.freeze({ sight: 'a blue alcove, dimmed once used', sound: 'softChime', words: null, by: null, chat: false }),
  memento: Object.freeze({ sight: 'a gold mote; carried, it trails the carrier; set, the niche flares', sound: 'bell', words: (n, t) => `${n} carries ${t}'s Memento.`, by: 'fight', chat: true }),
  goldRun: Object.freeze({ sight: "the count's chip", sound: 'fanfare', words: () => 'Gold run. +1:00', by: 'fight', chat: false }),
  phase: Object.freeze({ sight: "the lord's phase card", sound: 'drum', words: (n, t) => t ?? '', by: 'fight', chat: false }),
  fall: Object.freeze({ sight: 'THE FALL (section 16.5)', sound: 'lowToll', words: (n) => EG_TEXT.falls(n), by: 'client', chat: true }),
  recall: Object.freeze({ sight: 'a flare at the beacon, a blue pillar', sound: 'chime', words: (n) => `${n} is called back.`, by: 'fight', chat: true }),
  redoubt: Object.freeze({ sight: 'its sequence (section 16.2)', sound: 'score', words: (n, t) => EG_TEXT.redoubt(t), by: null, chat: false }),
  key: Object.freeze({ sight: 'the Weir Key banner', sound: 'rare', words: null, by: null, chat: false }),
  orrery: Object.freeze({ sight: "the Orrery's light", sound: 'chord', words: () => 'The Orrery turns true. A Vestige waits.', by: 'fight', chat: false }),
  twist: Object.freeze({ sight: "the arrival card's second line", sound: null, words: (n, t) => EG_TWIST_LINES[t] ?? '', by: null, chat: true }),
  home: Object.freeze({ sight: "their row's arch", sound: null, words: (n) => `${n} walks home.`, by: 'fight', chat: true }),
  lastWord: Object.freeze({ sight: "the chip's seal", sound: 'toll', words: () => EG_PRES_TEXT.lastWord, by: 'client', chat: false }),
  // AUDIT EG III (section 27.5's last rows): THE VESTIGES - each the holder's own (none to the chat), `t` its figure or name
  secondWind: Object.freeze({ sight: "the health bar's rise", sound: 'chime', words: (n, t) => EG_PRES_TEXT.secondWind(t), by: null, chat: false }),   // `t` the points healed
  rally: Object.freeze({ sight: "the health bar's rise", sound: 'chime', words: (n, t) => EG_PRES_TEXT.rally(pctOf(t)), by: null, chat: false }),   // `t` the share
  lifeline: Object.freeze({ sight: "Lifeline's blue chip, its seconds", sound: 'softChime', words: (n, t) => EG_PRES_TEXT.lifeline(pctOf(t)), by: null, chat: false }),   // `t` the share spared
  shieldHymn: Object.freeze({ sight: "Shield-Hymn's blue chip, its seconds", sound: 'softChime', words: () => EG_PRES_TEXT.shieldHymn, by: null, chat: false }),
  spellweave: Object.freeze({ sight: "Spellweave's blue chip while the next is free; the book's 0", sound: 'softChime', words: () => EG_PRES_TEXT.spellweave, by: null, chat: false }),
  rallyingCry: Object.freeze({ sight: "the door's beam", sound: 'chime', words: () => EG_PRES_TEXT.rallyingCry, by: null, chat: false }),
  bladestorm: Object.freeze({ sight: "the struck foes' flash", sound: 'sweep', words: () => EG_PRES_TEXT.bladestorm, by: null, chat: false }),
  deadeye: Object.freeze({ sight: "the pierced add's flash", sound: 'pierce', words: () => EG_PRES_TEXT.deadeye, by: null, chat: false }),
  accord: Object.freeze({ sight: "the Accord's blue chip while the pair stands", sound: 'softChime', words: (n, t) => EG_PRES_TEXT.accordForms(t ?? '', n), by: null, chat: false }),   // `t` the Accord, `n` the mates
  accordLapse: Object.freeze({ sight: 'its chip gone', sound: null, words: (n, t) => EG_PRES_TEXT.accordLapses(t ?? ''), by: null, chat: false }),
  resonance: Object.freeze({ sight: "the offer card's blue line before it; the recap's capstones", sound: 'chord', words: (n, t) => (EG_CAPSTONES[t] ? EG_PRES_TEXT.resonance(EG_V_FAMILY_NAMES[t], EG_CAPSTONES[t].name) : ''), by: null, chat: false }),   // `t` the family
  // AUDIT EG V (c, L7-16; the PR's "a lord waking" has its sound and its line): a lord's wake - the gate's title card its sight
  // (scenes/eliteGates/egFight.js, `by` 'card': it says the name on the screen already), the score's swell its sound (SPIRWAKE), and
  // its line in the chat, `n` the lord's name
  wake: Object.freeze({ sight: 'gateTitleCard', sound: 'score', words: (n) => t('eg.beat.wake', '{n} wakes.', { n }), by: 'card', chat: true }),
});
export const EG_BEAT_KEYS = Object.freeze(Object.keys(EG_BEATS));
/** The room's beat lines (`esay`'s `w`) that are beats of the table. AUDIT EG III: Bladestorm's and Deadeye's are their
 *  striker's alone (`SAY_MINE` - the word's `s`). */
const SAY_BEAT = Object.freeze({ door: 'door', goldrun: 'goldRun', memento: 'memento', recalled: 'recall', home: 'home', orrerytrue: 'orrery', niche: 'niche', phase: 'phase', storm: 'bladestorm', deadeye: 'deadeye' });
const SAY_MINE = Object.freeze(new Set(['storm', 'deadeye']));

/**
 * What one beat does now (pure): `{ sound, screen, chat }` - the sound to play (a record, its volume and pitch; null for
 * none or one another part plays), the line for the screen and the line for the chat (null where another already says
 * it, or none).
 * @param {string} k a key of EG_BEATS @param {{ n?: string, t?: any }} [w]
 */
export function egBeatPlan(k, { n = '', t = null } = {}) {
  const B = EG_BEATS[k];
  if (!B) return { sound: null, screen: null, chat: null };
  const S = B.sound ? EG_BEAT_SOUNDS[B.sound] : null;
  const words = B.words ? B.words(n || 'A companion', t) : '';
  const own = B.by === null && !!words;
  return { sound: S && S.rec != null ? S : null, screen: own ? words : null, chat: words && B.chat && B.by !== 'client' ? words : null };
}

/** AUDIT EG V (c, L7-16): the lord a wake names - the first true lord of the hall's fight (never a mirror image, never a friend:
 *  ui/eliteGates/egSpireHud.js egLordBar's choice), by its name; '' with none. Pure. */
export function egWokeName(E) {
  if (E?.fight?.h !== E?.h) return '';
  const L = (E.fight.bodies ?? []).find((b) => b.role === EG_ROLE.lord && (b.fl & (EG_FL.mirror | EG_FL.friend)) === 0);
  return L ? egBossName(EG_BOSS_KEYS[L.k] ?? '', L.pt) : '';
}
/** The watch's memory before anything is heard; how many heard keys it holds before it forgets the ones no longer in
 *  the state (a three-hour run must not grow it without end). */
export const egBeatMemo = () => ({ primed: false, seen: new Set(), h: 0, woke: 0, rd: 0, end: null, mm: 0 });
export const EG_BEAT_SEEN_MAX = 512;
const keyOf = (prefix, at, extra = '') => `${prefix}@${at}:${extra}`;
/**
 * THE WATCH: the beats `E` newly holds since `memo` last looked, the first-time lines they bring due, and the runes of an
 * Examination newly lit (their numerals) - pure but for the memo, which it carries. The first look only learns what is
 * there.
 * @param {any} memo egBeatMemo() @param {any} E net/eliteGates/egLink.js's state @param {string|null} me
 * @returns {{ beats: { k: string, n?: string, t?: any }[], firsts: string[], runes: number[] }}
 */
export function egBeatWatch(memo, E, me) {
  const beats = [], firsts = [], runes = [];
  if (!E?.b) { memo.primed = false; memo.seen.clear(); memo.h = 0; memo.woke = 0; memo.rd = 0; memo.end = null; memo.mm = 0; return { beats, firsts, runes }; }
  const held = [];
  const fresh = (key) => { held.push(key); if (memo.seen.has(key)) return false; memo.seen.add(key); return memo.primed; };
  // the room's beat lines
  for (const s of E.fight?.says ?? []) {
    if (!fresh(keyOf(`say:${s.w}`, s.at, s.n ?? ''))) continue;
    if (SAY_MINE.has(s.w) && !(me && s.s?.includes(me))) continue;   // AUDIT EG III: a host hit is its striker's to hear
    if (SAY_BEAT[s.w]) beats.push({ k: SAY_BEAT[s.w], n: s.n, t: s.t });
    if (s.w === 'wake') { const n = egWokeName(E); if (n) beats.push({ k: 'wake', n }); }   // AUDIT EG V (c, L7-16): a lord's wake, said
    if (s.w === 'fury') firsts.push('fury');
  }
  // AUDIT EG III (section 15's resonance): a family's capstone, said once a breach as my run first holds three of it
  if (me) for (const f of egResonance(egRunOfMember(E, me).vs)) if (fresh(keyOf('res', E.b, f))) beats.push({ k: 'resonance', t: f });
  // the falls
  for (const f of E.falls ?? []) if (fresh(keyOf('fall', f.at, f.s))) { beats.push({ k: 'fall', n: f.n, t: f.fin }); if (!f.fin) firsts.push('recall'); }
  // a gift (a cache, an alcove, a vault) - mine alone
  for (const g of E.got ?? []) if (fresh(keyOf('got', g.at, g.w))) beats.push({ k: 'cache', t: g.w });
  // a Redoubt
  const rdAt = E.redoubt?.at ?? 0;
  if (rdAt && rdAt !== memo.rd) { const was = memo.rd; memo.rd = rdAt; if (memo.primed && was !== rdAt) beats.push({ k: 'redoubt', t: E.redoubt.w }); }
  // a hall's wake: its twist and its fork; the count running
  if (E.h > 0 && E.sg === 'trial' && memo.woke !== E.h) {
    const was = memo.woke; memo.woke = E.h;
    if (memo.primed && was !== E.h) {
      const spec = egHallOf(E.seed, E.h, E.geo ?? 0);
      if (spec.twist) beats.push({ k: 'twist', t: spec.twist });
      if (spec.fork) { beats.push({ k: 'fork' }); firsts.push('fork'); }
    }
  }
  if (memo.primed) {
    if (E.wk > 0 && E.sg === 'trial') firsts.push('count');
    if (E.sg === 'closing' && E.h > 0) { const kind = egHallOf(E.seed, E.h, E.geo ?? 0).kind; if (kind === 'span' || kind === 'deepway' || kind === 'brink') firsts.push('door'); }
    if ((E.as ?? []).some((a) => String(a[0]).startsWith('dec:'))) firsts.push('decrees');
    if ((E.mm ?? []).length > 0) firsts.push('memento');
    if (E.sg === 'rest') firsts.push('home');
  }
  // an Examination's runes, each as it lights
  if (E.fight?.h === E.h) for (const b of E.fight.bodies ?? []) if (b.role === EG_ROLE.obj && b.k === EG_OBJ.rune && b.st === 1 && fresh(keyOf('rune', b.i, E.h))) runes.push(b.pt);
  // the last word
  if (E.end && E.end !== memo.end) { memo.end = E.end; if (memo.primed && E.end === 'last') beats.push({ k: 'lastWord' }); }
  memo.h = E.h;
  memo.primed = true;
  if (memo.seen.size > EG_BEAT_SEEN_MAX) memo.seen = new Set(held);
  return { beats, firsts, runes };
}

// ── AUDIT EG III: THE HOLDER'S CHIPS (sections 15 and 27.5) ─────────────────────────────────────────────────────────────
/**
 * What the holder's chips read this frame, off the fight (scenes/eliteGates/egFight.js - its Lifeline windows `shield().ll`, its
 * Shield-Hymn window `hymn()`, and each Accord through `accordMates`, the pair law where the screen stands us) and the room's
 * names: `{ ll, hymn, accords: [{ key, name, mates }], weave }`. No fight (out of the halls, a witness): nothing. Pure but
 * for the fight's reads.
 * @param {any} fight @param {any} E @param {string|null} me @param {boolean} [weave] Spellweave's next damage spell is free
 */
export function egHolderNow(fight, E, me, weave = false) {
  if (!fight || !E?.b || !me) return { ll: [], hymn: null, accords: [], weave: false };
  const nameOf = (sub) => egMemberOf(E, sub)?.name ?? '';
  const accords = [];
  for (const A of EG_ACCORDS) {
    const subs = [...new Set([...(fight.accordMates?.(A.key, 'a') ?? []), ...(fight.accordMates?.(A.key, 'b') ?? [])])];
    if (subs.length) accords.push({ key: A.key, name: A.name, mates: subs.map(nameOf).filter(Boolean) });
  }
  const hy = fight.hymn?.() ?? null;
  return { ll: fight.shield?.().ll ?? [], hymn: hy && hy[2].some((s) => s !== me) ? hy : null, accords, weave: !!weave };
}
/** The holder's watch before it has looked. */
export const egHolderMemo = () => ({ primed: false, h: -1, llU: -Infinity, hyF: -Infinity, up: new Set(), said: new Set() });
/**
 * THE HOLDER'S WATCH (pure but for `memo`): the chips (`{ k, text }` - each timed window on me with its whole seconds left,
 * Spellweave's free spell, each Accord standing) and the beats brought - a Lifeline or Shield-Hymn window newly open, an
 * Accord formed or lapsed, each way once a hall. The first look, and the first in a new hall, learn what stands.
 * @param {any} memo egHolderMemo() @param {{ ll: number[][], hymn: any[]|null, accords: any[], weave: boolean }} H egHolderNow's
 * @param {number} now the shared clock (ms) @param {number} h the hall
 */
export function egHolderWatch(memo, H, now, h) {
  const chips = [], beats = [];
  const secs = (until) => Math.max(1, Math.ceil((until - now) / 1000));
  const ll = (H.ll ?? []).filter((w) => w[0] <= now && now < w[1]).at(-1);
  if (ll) chips.push({ k: 'lifeline', text: EG_PRES_TEXT.heldChip('Lifeline', secs(ll[1])) });
  const hy = H.hymn && H.hymn[0] <= now && now < H.hymn[1] ? H.hymn : null;
  if (hy) chips.push({ k: 'shieldHymn', text: EG_PRES_TEXT.heldChip('Shield-Hymn', secs(hy[1])) });
  if (H.weave) chips.push({ k: 'spellweave', text: EG_PRES_TEXT.weaveChip });
  for (const A of H.accords ?? []) chips.push({ k: `accord:${A.key}`, text: A.name });
  if (memo.h !== h) { memo.h = h; memo.said.clear(); memo.primed = false; }
  const newest = (H.ll ?? []).at(-1);
  if (newest && newest[1] > memo.llU) { if (memo.primed && newest[1] > now) beats.push({ k: 'lifeline', t: newest[2] }); memo.llU = newest[1]; }
  if (H.hymn && H.hymn[0] !== memo.hyF) { if (memo.primed && H.hymn[1] > now) beats.push({ k: 'shieldHymn' }); memo.hyF = H.hymn[0]; }
  const up = new Set((H.accords ?? []).map((A) => A.key));
  for (const A of H.accords ?? []) if (!memo.up.has(A.key) && memo.primed && !memo.said.has(`${A.key}+`)) { memo.said.add(`${A.key}+`); beats.push({ k: 'accord', n: A.mates.join(' and '), t: A.name }); }
  for (const key of memo.up) if (!up.has(key) && memo.primed && !memo.said.has(`${key}-`)) { memo.said.add(`${key}-`); beats.push({ k: 'accordLapse', t: EG_ACCORDS.find((A) => A.key === key)?.name ?? '' }); }
  memo.up = up;
  memo.primed = true;
  return { chips, beats };
}

/**
 * THE FIRST BREACH: which of `wanted` (EG_FIRST_KEYS) are due against the device's bits, and the bits after them (pure).
 * Each is said once; the order is the page's.
 * @param {number} bits @param {string[]} wanted
 */
export function egFirstDue(bits, wanted) {
  let b = bits | 0;
  const due = [];
  for (const k of EG_FIRST_KEYS) {
    const i = EG_FIRST_KEYS.indexOf(k);
    if (wanted.includes(k) && !(b & (1 << i))) { b |= 1 << i; due.push(EG_TEXT_FIRST[k]); }
  }
  return { due, bits: b };
}
/** The Rehearsal's teaching line, once a device: `{ line, bits }` (line null when said before). */
export function egRehearsalDue(bits) {
  const bit = 1 << EG_FIRST_REHEARSAL_BIT;
  return (bits | 0) & bit ? { line: null, bits: bits | 0 } : { line: EG_PRES_TEXT.rehearsal, bits: (bits | 0) | bit };
}
/** EG-ZF (section 27.7, once an account): THE BITS IN FORCE - the account's (the service's answer, a whole number; null
 *  while it has none: no account, a guest, no answer yet) with the device's own, and the lines this screen has shown
 *  since (`shown`) - a line shown is never shown again while its word to the service is still on its way. AUDIT EG V (c,
 *  L7-23): the device's are OR'd in, never dropped once the account answers: a line whose word was lost before a reload
 *  was shown again; the device's are the account's own (egFirstKey), so another account's never silence it. Pure. */
export const egFirstOver = (device, account, shown = 0) => ((Number.isSafeInteger(account) && account >= 0 ? account : 0) | (device | 0) | (shown | 0));
/** AUDIT EG V (c, L7-23): where the device keeps the bits of account `sub` (EG_FIRST_KEY's own for no account). Pure. */
export const egFirstKey = (sub) => (typeof sub === 'string' && sub ? `${EG_FIRST_KEY}:${sub}` : EG_FIRST_KEY);
/** The device's bits from its store (0 for none or a broken one) - `key` an account's (egFirstKey). */
export const egFirstRead = (store, key = EG_FIRST_KEY) => { try { const v = Number.parseInt(store?.getItem?.(key) ?? '0', 10); return Number.isSafeInteger(v) && v >= 0 ? v : 0; } catch { return 0; } };
export const egFirstWrite = (store, bits, key = EG_FIRST_KEY) => { try { store?.setItem?.(key, String(bits | 0)); } catch { /* the session's alone */ } };

// ── the touch of it (section 27.8) ────────────────────────────────────────────────────────────────────────────
/** A Beat's warning (s - its last 0.4 s), and each pulse: the phone's milliseconds, the pad's dual rumble. */
export const EG_BEAT_WARN_S = 0.4;
export const EG_HAPTICS = Object.freeze({
  beat: Object.freeze({ ms: 15, weak: 0.35, strong: 0 }),
  peril: Object.freeze({ ms: 30, weak: 0.6, strong: 0.8 }),
});
/**
 * The Beat underfoot entering its last EG_BEAT_WARN_S, as a cycle number (to pulse once a cycle), or -1 (pure). `x`,
 * `y`, `z` my feet in the hall's frame, `tS` the shared clock in seconds (net/eliteGates/egSpanLaw.js's).
 */
export function egBeatUnder(spec, x, y, z, tS) {
  for (const s of spec?.steps ?? []) {
    if (s.kind !== 'beat' || Math.abs(x - s.x) > s.w / 2 + 0.2 || Math.abs(z - s.z) > s.d / 2 + 0.2 || Math.abs(y - s.y) > 1.2) continue;
    const u = tS - s.beat, n = Math.floor(u / EG_BEAT_CYCLE_S), into = u - n * EG_BEAT_CYCLE_S;
    if (into >= EG_BEAT_SOLID_S - EG_BEAT_WARN_S && into < EG_BEAT_SOLID_S) return n * 1000 + s.i;
  }
  return -1;
}
/** The blows newly aimed at my feet (x, z in the hall's frame), still to land at `now` - a peril each, once (pure but
 *  for `seen`). */
export function egPerilsNew(blows, x, z, seen, now = -Infinity) {
  const out = [];
  for (const bl of blows ?? []) {
    if (seen.has(bl.i) || bl.cut || !Array.isArray(bl.s) || bl.at <= now) continue;
    if (bl.s.some((s) => egInShape(s, x, z))) { seen.add(bl.i); out.push(bl.i); }
  }
  return out;
}
/** A pulse behind the touch layer's own switch: the phone's vibration and every pad's dual rumble. Answers whether it
 *  was asked of anything. */
export function egBuzz(kind, { on = true, nav = globalThis.navigator } = {}) {
  const H = EG_HAPTICS[kind];
  if (!H || !on || !nav) return false;
  let asked = false;
  try { if (nav.vibrate) { nav.vibrate(H.ms); asked = true; } } catch { /* a platform without it */ }
  try {
    for (const p of nav.getGamepads?.() ?? []) {
      const a = p?.vibrationActuator;
      if (a?.playEffect) { a.playEffect('dual-rumble', { duration: H.ms, weakMagnitude: H.weak, strongMagnitude: H.strong }).catch?.(() => {}); asked = true; }
    }
  } catch { /* no pad */ }
  return asked;
}
