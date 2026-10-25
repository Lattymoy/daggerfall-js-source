// @ts-check
// QL12-QL16 (2026-10-19, the owner: "New questlines tying into and introduced the oblivion gates, abyss dungeons, elite
// dungeons and elite breaches. Staying true to Daggerfall's lore", "Tying all our newly integrated features into
// quests", "One unified place to view questlines"; bible/06-Systems/Questlines-Arc.md section 4): THE QUESTLINES - each a
// story told in quests, step after step, each step a script on the machine (systems/questlines/quests/<QUEST>.txt, read
// by the one loader - scenes/quest/questData.js) with its sheet (sheets/questlines.json) like any quest's.
//
// A LINE IS DATA: its steps' quests, the words the window shows of it, when it opens, and where it is offered (`post` -
// QL-OFFERED: a line is taken, never sent). What it pays beyond its
// quests' own rewards is the service's (net/questlineClaims.js QL_SERVICE_LINES - the witnessed steps, the title, the
// Covens' Hoard's key), read by id here, never restated. The runner (qlLineRunner.js) begins a line the player takes and
// starts its next step; the window (ui/questlines/qlJournal.js) draws the line.
//
//   THE DAGON CYCLE (4.1) - three lines, one story: the Burning Doors (Dagon's Breach), the Covens' Hoard (the Elite
//     Dungeons' gold-lit champions), the Weir Road (the Elite Breach). Online: every witness is a relay's receipt.
//   THE HOUR THAT WAS NOT (4.2) - the Abyss Dungeon, from the Order of the Hour. Online.
//   THE OLD COIL (4.3) - the Sea Serpent, from Sentinel's sailors. Online.
//   THE SKY-KETCH (KETCH, bible/11-Multiplayer/Sky-Ketch.md section 13) - the Rourken sky-ketch over Daggerfall, from an
//     antiquarian of Sentinel. Online: its witness is the Tonal Warden's receipt.
//   THE INTRODUCTIONS (4.5) - a short line for each Tutorials group with a feature to go to: the crafts, the gear's own
//     laws, the sea, the road, the tavern's tables, the Arena, the Bay's troubles, the Firmament. The Tutorials explain;
//     an introduction gives a reason to go, and pays for it.
//   THE THIRTEENTH OF FROSTFALL (STAR8, bible/11-Multiplayer/Starfall.md section 7) - the Starfall's, from a Wyrd Sister
//     of Glenmoril. Seasonal: it begins only while the Witches' Festival is staged (`opens.event`), and a step whose deed
//     is a fallen star waits for the next one - set aside, fail-free, if the Festival ends under it (qlLineRunner.js
//     keepSeason). Online: its witnesses are the stars' receipts.
//
// Every word through t() (the Port_Strings catalog): a line's title, its lead, its giver, each step's title. A step's
// title is its quest's DisplayName in English (test/systems/questlines/ql12_lines.test.js holds the two to one word).
import { t } from '../textManager.js';
import { QL_SERVICE_LINES } from '../../net/questlineClaims.js';
import { REVENANT_MIN_RENOWN } from '../revenant/revenant.js';   // AUDIT QUESTLINES LINES-3: the Renown a revenant comes at, in the window's words

/**
 * @typedef {{ quest: string, title: () => string, needs?: ReadonlyArray<LineNeed> }} LineStep
 *   `needs` what the step's deed cannot be done without (AUDIT QUESTLINES ACTS-2, LINES-3, LINES-6): the step waits,
 *   saying so, until each holds - never started to fail every day
 * @typedef {'lootRarity'|'kingsGambit'|'naval'|'renown'|'starfall'} LineNeed
 *   `lootRarity` Loot rarity on (a socket, a reforge); `kingsGambit` The King's Gambit on (its table); `naval` Naval
 *   Combat on (the sea's own deeds); `renown` the Renown a revenant comes at (revenant.js REVENANT_MIN_RENOWN, online);
 *   `starfall` (STAR8) the Starfall running - the Witches' Festival's days (net/festivalLaw.js, through
 *   net/starfall/starfallLaw.js starfallRuns), when stars fall to be held
 * @typedef {{ level?: number, after?: string, online?: boolean, account?: boolean, event?: LineNeed }} LineOpens
 *   `level` the character's level at least; `after` another line finished first; `online` only where the account
 *   service answers (every endgame line: its witnesses are the service's rows); `account` a registered account, never a
 *   guest's (AUDIT QUESTLINES LINES-2: the service records no guest's receipt, so no witnessed deed could be done);
 *   `event` (STAR8) a seasonal line's live event, a need that holds only while it is staged: the line begins only then,
 *   and the window draws none not begun outside it (qlLineRunner.js rows - UI-Calm's law, nothing shown that cannot be
 *   taken)
 * @typedef {'board'|'magery'|'temple'|'tavern'} LinePost
 *   QL-OFFERED (the owner: a questline is TAKEN, never SENT): where a line on offer is posted besides the Quests tab -
 *   `board` a town's notice board (the introductions: their givers are townsfolk), `magery` a Mages Guild hall's Get
 *   Quest (Ysolde Marnhel, the Mages Guild's own), `temple` a temple's (Prior Anselm Vey, a guest of its temple), `tavern`
 *   someone with work in a tavern (Corvane Tull, Imrah Bel-Tavir, Hamid al-Rasheen, each met in one) -
 *   scenes/quest/questlineOffers.js; none, the Quests tab alone (the Thirteenth of Frostfall: a Wyrd Sister opens it)
 * @typedef {{ id: string, group: 'cycle'|'hour'|'coil'|'ketch'|'intro'|'festival', tier: number, post?: LinePost,
 *   title: () => string, lead: () => string, giver: () => string, opens: LineOpens, steps: ReadonlyArray<LineStep> }} Line
 */

/** @param {Line} l @returns {Readonly<Line>} */
const line = (l) => Object.freeze({ ...l, opens: Object.freeze({ ...l.opens }), steps: Object.freeze(l.steps.map((s) => Object.freeze({ ...s, ...(s.needs ? { needs: Object.freeze([...s.needs]) } : {}) }))) });

/** The lines, in the window's order: the Cycle, the Hour, the Ketch, the Coil, the Festival's, then the introductions. */
export const QL_LINES = Object.freeze([
  line({
    id: 'burningDoors', group: 'cycle', tier: 3, post: 'magery',
    title: () => t('ql.line.burningDoors', 'The Burning Doors'),
    lead: () => t('ql.line.burningDoors.lead', 'Someone is opening Dagon’s Breaches on purpose. A Master Conjurer of the Mages Guild wants to know who, and how.'),
    giver: () => t('ql.line.burningDoors.giver', 'Ysolde Marnhel, Master Conjurer of the Mages Guild of Wayrest'),
    opens: { level: 10, online: true, account: true },
    steps: [
      { quest: 'QLBD01', title: () => t('ql.step.QLBD01', 'A Letter from Wayrest') },
      { quest: 'QLBD02', title: () => t('ql.step.QLBD02', 'The Faithful') },
      { quest: 'QLBD03', title: () => t('ql.step.QLBD03', 'Breaking the Rite') },
      { quest: 'QLBD04', title: () => t('ql.step.QLBD04', 'Through the Burning Door') },
      { quest: 'QLBD05', title: () => t('ql.step.QLBD05', 'The Caged Broker') },
    ],
  }),
  line({
    id: 'covensHoard', group: 'cycle', tier: 3, post: 'magery',
    title: () => t('ql.line.covensHoard', 'The Covens’ Hoard'),
    lead: () => t('ql.line.covensHoard.lead', 'Dagon’s covens hoard the Battlespire’s keys in the deep places. Their champions glow gold.'),
    giver: () => t('ql.line.covensHoard.giver', 'Ysolde Marnhel, Master Conjurer of the Mages Guild of Wayrest'),
    opens: { after: 'burningDoors', online: true, account: true },
    steps: [
      { quest: 'QLCH01', title: () => t('ql.step.QLCH01', 'Gold-Lit') },
      { quest: 'QLCH02', title: () => t('ql.step.QLCH02', 'The Lieutenant') },
      { quest: 'QLCH03', title: () => t('ql.step.QLCH03', 'What the Key Opens') },
    ],
  }),
  line({
    id: 'weirRoad', group: 'cycle', tier: 4, post: 'tavern',
    title: () => t('ql.line.weirRoad', 'The Weir Road'),
    lead: () => t('ql.line.weirRoad.lead', 'The Battlespire fell in 3E 398. One of its last class of Battlemages has never stopped living that year.'),
    giver: () => t('ql.line.weirRoad.giver', 'Corvane Tull, Battlemage of the Spire’s last class'),
    opens: { after: 'covensHoard', online: true, account: true },
    steps: [
      { quest: 'QLWR01', title: () => t('ql.step.QLWR01', 'The Weir Gate') },
      { quest: 'QLWR02', title: () => t('ql.step.QLWR02', 'The Torn Halls') },
      { quest: 'QLWR03', title: () => t('ql.step.QLWR03', 'A Warrior Duke') },
      { quest: 'QLWR04', title: () => t('ql.step.QLWR04', 'The Battlemage’s Account') },
    ],
  }),
  line({
    id: 'hourThatWasNot', group: 'hour', tier: 4, post: 'temple',
    title: () => t('ql.line.hourThatWasNot', 'The Hour That Was Not'),
    lead: () => t('ql.line.hourThatWasNot.lead', 'The priests of Akatosh feel a wound in time under the Bay, and brass where there should be stone.'),
    giver: () => t('ql.line.hourThatWasNot.giver', 'Prior Anselm Vey of the Order of the Hour'),
    opens: { level: 12, online: true, account: true },
    steps: [
      { quest: 'QLHR01', title: () => t('ql.step.QLHR01', 'Brass at Dusk') },
      { quest: 'QLHR02', title: () => t('ql.step.QLHR02', 'The Orrery of Endings') },
    ],
  }),
  line({
    id: 'skyKetch', group: 'ketch', tier: 4, post: 'tavern',
    title: () => t('ql.line.skyKetch', 'The Sky-Ketch'),
    lead: () => t('ql.line.skyKetch.lead', 'Every ten hours a Rourken ship of brass keeps station over Daggerfall. An antiquarian of Sentinel wants to know what brought her down.'),
    giver: () => t('ql.line.skyKetch.giver', 'Imrah Bel-Tavir, Antiquarian of Sentinel'),
    opens: { level: 12, online: true, account: true },
    steps: [
      { quest: 'QLSK01', title: () => t('ql.step.QLSK01', 'The Ketch That Never Lands') },
      { quest: 'QLSK02', title: () => t('ql.step.QLSK02', 'The Starved Engine') },
      { quest: 'QLSK03', title: () => t('ql.step.QLSK03', 'The Tonal Warden') },
      { quest: 'QLSK04', title: () => t('ql.step.QLSK04', 'What the Lodestone Answers') },
    ],
  }),
  line({
    id: 'oldCoil', group: 'coil', tier: 3, post: 'tavern',
    title: () => t('ql.line.oldCoil', 'The Old Coil'),
    lead: () => t('ql.line.oldCoil.lead', 'Sentinel’s sailors say the World-Skin was shed once, and that what was shed still swims.'),
    giver: () => t('ql.line.oldCoil.giver', 'Hamid al-Rasheen, a packet captain of Sentinel'),
    opens: { level: 8, online: true, account: true },
    steps: [
      { quest: 'QLOC01', title: () => t('ql.step.QLOC01', 'The Sailors’ Tale') },
      { quest: 'QLOC02', title: () => t('ql.step.QLOC02', 'The Packet Lanes') },
      { quest: 'QLOC03', title: () => t('ql.step.QLOC03', 'The Shed Skin') },
    ],
  }),
  line({
    id: 'thirteenthFrostfall', group: 'festival', tier: 3,
    title: () => t('ql.line.thirteenthFrostfall', 'The Thirteenth of Frostfall'),
    lead: () => t('ql.line.thirteenthFrostfall.lead', 'At the Witches’ Festival the covens sing stars out of the sky. A witch of Glenmoril wants to know why.'),
    giver: () => t('ql.line.thirteenthFrostfall.giver', 'Morwen, a Wyrd Sister of Glenmoril'),   // AUDIT STAR8 T1: of the Festival's Glenmoril Wyrd
    opens: { level: 6, online: true, account: true, event: 'starfall' },
    steps: [
      { quest: 'QLTF01', title: () => t('ql.step.QLTF01', 'Music in the Woods'), needs: ['starfall'] },
      { quest: 'QLTF02', title: () => t('ql.step.QLTF02', 'The Coven on the Bluff') },
      { quest: 'QLTF03', title: () => t('ql.step.QLTF03', 'Three Stars'), needs: ['starfall'] },
      { quest: 'QLTF04', title: () => t('ql.step.QLTF04', 'What the Thread Is Worth') },
    ],
  }),
  line({
    id: 'introCrafts', group: 'intro', tier: 1, post: 'board',
    title: () => t('ql.line.introCrafts', 'The Court Crafter'),
    lead: () => t('ql.line.introCrafts.lead', 'A crafter who works for the court wants an apprentice who can find their own materials.'),
    giver: () => t('ql.line.introCrafts.giver', 'a court crafter'),
    opens: { level: 2, online: true, account: true },   // the Professions' harvests and crafts are the account service's to answer - a registered account's (AUDIT QUESTLINES ACTS-2: they refuse a guest)
    steps: [
      { quest: 'QLIP01', title: () => t('ql.step.QLIP01', 'Of Rod and Root') },
      { quest: 'QLIP02', title: () => t('ql.step.QLIP02', 'Ore and Timber') },
      { quest: 'QLIP03', title: () => t('ql.step.QLIP03', 'Made by Hand') },
    ],
  }),
  // AUDIT QUESTLINES VOICE-QL: American spelling in the words (Voice.md rule 8) - armorer, harbormaster, Colors (QLIS03's
  // DisplayName with it, ql12_lines' one word); the keys stay
  line({
    id: 'introGear', group: 'intro', tier: 1, post: 'board',
    title: () => t('ql.line.introGear', 'The Smith’s Secrets'),
    lead: () => t('ql.line.introGear.lead', 'An armorer offers to show you what a good piece of gear can still be made into.'),
    giver: () => t('ql.line.introGear.giver', 'an armorer'),
    opens: { level: 4 },
    steps: [
      { quest: 'QLIG01', title: () => t('ql.step.QLIG01', 'A Stone in the Setting'), needs: ['lootRarity'] },
      { quest: 'QLIG02', title: () => t('ql.step.QLIG02', 'Tempered Again'), needs: ['lootRarity'] },
    ],
  }),
  line({
    id: 'introSea', group: 'intro', tier: 2, post: 'board',
    title: () => t('ql.line.introSea', 'The Harbormaster’s Word'),
    lead: () => t('ql.line.introSea.lead', 'A harbormaster needs a captain. Any captain. Even you.'),
    giver: () => t('ql.line.introSea.giver', 'a harbormaster'),
    opens: { level: 5 },
    steps: [
      { quest: 'QLIS01', title: () => t('ql.step.QLIS01', 'Under Sail'), needs: ['naval'] },
      { quest: 'QLIS02', title: () => t('ql.step.QLIS02', 'A Hold Full'), needs: ['naval'] },
      { quest: 'QLIS03', title: () => t('ql.step.QLIS03', 'Strike Your Colors'), needs: ['naval'] },
    ],
  }),
  line({
    id: 'introRoad', group: 'intro', tier: 1, post: 'board',
    title: () => t('ql.line.introRoad', 'The Merchant’s Road'),
    lead: () => t('ql.line.introRoad.lead', 'A stable master knows a merchant yard that pays well for a wagon’s load, if someone will haul it.'),
    giver: () => t('ql.line.introRoad.giver', 'a stable master'),
    opens: { level: 3 },
    steps: [
      { quest: 'QLIR01', title: () => t('ql.step.QLIR01', 'A Wagon’s Load') },
      { quest: 'QLIR02', title: () => t('ql.step.QLIR02', 'The Long Haul') },
    ],
  }),
  line({
    id: 'introTables', group: 'intro', tier: 1, post: 'board',
    title: () => t('ql.line.introTables', 'A Seat at the Table'),
    lead: () => t('ql.line.introTables.lead', 'A tavern regular is looking for someone new to lose to. Or, better, to beat.'),
    giver: () => t('ql.line.introTables.giver', 'a tavern regular'),
    opens: { level: 2 },
    steps: [
      { quest: 'QLIT01', title: () => t('ql.step.QLIT01', 'A Hand of Cards') },
      { quest: 'QLIT02', title: () => t('ql.step.QLIT02', 'The King’s Gambit'), needs: ['kingsGambit'] },
    ],
  }),
  line({
    id: 'introArena', group: 'intro', tier: 2, post: 'board',
    title: () => t('ql.line.introArena', 'The Herald’s Call'),
    lead: () => t('ql.line.introArena.lead', 'The Arena’s Herald is calling for new blood, and pays the first purse in advance of glory.'),
    giver: () => t('ql.line.introArena.giver', 'the Arena’s Herald'),
    opens: { level: 6, online: true },
    steps: [
      { quest: 'QLIA01', title: () => t('ql.step.QLIA01', 'First Blood') },
      { quest: 'QLIA02', title: () => t('ql.step.QLIA02', 'A Name in the Sand') },
    ],
  }),
  line({
    id: 'introBay', group: 'intro', tier: 2, post: 'board',
    title: () => t('ql.line.introBay', 'The Bay’s Troubles'),
    lead: () => t('ql.line.introBay.lead', 'A captain of the watch has more trouble than soldiers: raiders on the roads, and the dead who will not lie down.'),
    giver: () => t('ql.line.introBay.giver', 'a captain of the watch'),
    opens: { level: 6, online: true },
    steps: [
      { quest: 'QLIW01', title: () => t('ql.step.QLIW01', 'Raiders at the Gate') },
      { quest: 'QLIW02', title: () => t('ql.step.QLIW02', 'The Kneeling Dead'), needs: ['renown'] },
    ],
  }),
  line({
    id: 'introFirmament', group: 'intro', tier: 1, post: 'board',
    title: () => t('ql.line.introFirmament', 'Written in the Stars'),
    lead: () => t('ql.line.introFirmament.lead', 'An astrologer insists your fortune is written on the Firmament, and that you can write the rest yourself.'),
    giver: () => t('ql.line.introFirmament.giver', 'an astrologer'),
    opens: { level: 3, online: true },
    steps: [
      { quest: 'QLIF01', title: () => t('ql.step.QLIF01', 'The First Star') },
      { quest: 'QLIF02', title: () => t('ql.step.QLIF02', 'A Constellation of Your Own') },
    ],
  }),
]);

const BY_ID = new Map(QL_LINES.map((l) => [l.id, l]));
/** A line by its id, or null. */
export const lineById = (id) => BY_ID.get(id) ?? null;

const BY_QUEST = new Map(QL_LINES.flatMap((l) => l.steps.map((s, i) => [s.quest.toUpperCase(), { line: l, index: i }])));
/** The line and step a quest is, or null for a quest no line holds. */
export const lineStepOf = (questName) => BY_QUEST.get(String(questName ?? '').toUpperCase()) ?? null;

/** Every quest a line holds, upper-case - the Questlines family's set (ql1_sheets' "set is exact"). */
export const lineQuestNames = () => [...BY_QUEST.keys()];

/** What the service pays this line (net/questlineClaims.js), or null for a line it pays nothing. */
export const lineServiceOf = (line) => QL_SERVICE_LINES[line?.id] ?? null;

/** A step's witness kind (net/questlineClaims.js QL_WITNESS_KINDS), or null for a step the client's quest alone decides. */
export const witnessOf = (line, index) => lineServiceOf(line)?.witness?.[index] ?? null;

/**
 * @typedef {{ level: () => number, lineDone: (id: string) => boolean, online: () => boolean, registered?: () => boolean,
 *   need?: (need: LineNeed) => boolean }} LineProbe
 *   `registered()` a registered account signed in (never a guest's); `need(n)` whether a step's need holds now
 */

/** The needs of a line's step that do not hold now (none: the step may start). */
export const unmetNeeds = (l, index, probe) => (l.steps[index]?.needs ?? []).filter((n) => !(probe.need?.(n) ?? true));

/**
 * Does the line open for this player now? `probe` answers its questions (LineProbe): the level, a line done, online, a
 * registered account, and its first step's needs.
 * @param {Readonly<Line>} l @param {LineProbe} probe
 */
export function lineOpens(l, probe) {
  const o = l.opens;
  if (o.online && !probe.online()) return false;
  if (o.account && !(probe.registered?.() ?? true)) return false;
  if (Number.isFinite(o.level) && probe.level() < /** @type {number} */ (o.level)) return false;
  if (o.after && !probe.lineDone(o.after)) return false;
  if (o.event && !eventHolds(l, probe)) return false;   // STAR8: a seasonal line begins only while its event is staged
  return unmetNeeds(l, 0, probe).length === 0;
}
/** STAR8: a seasonal line's event staged now (`opens.event`, a need) - a line with none always. */
export const eventHolds = (l, probe) => !l.opens.event || (probe.need?.(l.opens.event) ?? true);

/** A step's need, in words - the window's "Opens with ..." (the Features rows' own names). */
const NEED_WORDS = Object.freeze({
  lootRarity: () => t('ql.line.needs.lootRarity', 'with Loot rarity on'),
  kingsGambit: () => t('ql.line.needs.kingsGambit', 'with The King\u2019s Gambit on'),
  naval: () => t('ql.line.needs.naval', 'with Naval Combat on'),
  renown: () => t('ql.line.needs.renown', 'at Renown {n}', { n: REVENANT_MIN_RENOWN }),
  starfall: () => t('ql.line.needs.starfall', 'during the Witches’ Festival'),   // STAR8
});

/**
 * What a line still waits on, in words - the window's "Opens ..." line, or null when nothing stands in its way. `step`:
 * the step a begun line stands at (its needs), else its first.
 */
export function opensWords(l, probe, step = 0) {
  const o = l.opens;
  const parts = [];
  if (Number.isFinite(o.level) && probe.level() < /** @type {number} */ (o.level)) parts.push(t('ql.line.opensLevel', 'at level {n}', { n: o.level }));
  if (o.after && !probe.lineDone(o.after)) parts.push(t('ql.line.opensAfter', 'after {line}', { line: lineById(o.after)?.title() ?? o.after }));
  if (o.online && !probe.online()) parts.push(t('ql.line.opensOnline', 'online'));
  else if (o.account && !(probe.registered?.() ?? true)) parts.push(t('ql.line.opensAccount', 'with a registered account'));
  // STAR8: a seasonal line's event said once, beside the step's own needs (its first step's is the same Festival)
  const needs = new Set([...(o.event && !eventHolds(l, probe) ? [o.event] : []), ...unmetNeeds(l, step, probe)]);
  for (const n of needs) parts.push(NEED_WORDS[n]());
  return parts.length ? t('ql.line.opens', 'Opens {when}.', { when: parts.join(', ') }) : null;
}
