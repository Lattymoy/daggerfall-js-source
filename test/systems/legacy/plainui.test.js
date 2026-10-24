// PLAIN-UI (2026-10-12, a player: "The seat page on the notice board is extremely vague. Its tiny, doesnt explain
// anything and is extremely hard to understand. Same issues with the project legacy system. Where's the UI for
// relationship in the talk window? ... Same issue with the new guild chapter systems") - EVERY SYSTEM SAYS WHAT IT IS:
// the Seat tab's What this is, the reader's next step, its guide first and its words; How chapters work over the Work
// tab's cards; the Family tab's How it works; a living resident's regard on the talk panel; the board's type a step
// larger. bible/10-UI/Plain-Words.md.
import '../../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { byClass } from '../../chargenDom.mjs';
import { mountNoticeBoard, chapterGuide, CHAPTER_GUIDE_TITLE } from '../../../src/ui/noticeWindow.js';
import { seatAbout, seatNextStep, seatWords, seatGuideOpen, seatGuide, SEAT_PANELS } from '../../../src/ui/seatTab.js';
import {
  CLAIM_THRESHOLD, CONTESTED_MARGIN, STANDING_START, STANDING_UNREST, UNREST_BONUS, TITHE_CAP, TRIBUTE_MARKS_PER_INFLUENCE, SEAT_MEMBER_WAIT_S,
} from '../../../src/net/townSeatLaw.js';
import {
  MERIT_WRIT, MERIT_RECEIPT, MERIT_CAP_WEEK, STRENGTH_START, STRENGTH_STEP_MAX, STRENGTH_IDLE, CHAPTER_EVENTS, CHAPTER_PATRON_MIN, SEAT_MERIT_WEEKS,
} from '../../../src/net/npcChapterLaw.js';
import { FAMILY_PAGE_SECTIONS, familyGuide, drawGuidePage, setFamilyProvider } from '../../../src/ui/familyPages.js';
import { MODELS, BLOOD_MAX, HEARTH_MAX, ESTATE_MAX } from '../../../src/systems/legacy/family.js';
import { HEIRLOOM_DAMAGE_PER_GEN, BLESSING_POINTS } from '../../../src/systems/legacy/heirloom.js';
import { CHILD_DAYS, CHILDREN_MAX } from '../../../src/systems/legacy/marriage.js';
import { regardBadge, STANDING_NAMES } from '../../../src/systems/livingWorld/people.js';
import { FRIEND_AT, ENEMY_AT, HOSTILE_AT } from '../../../src/systems/livingWorld/relations.js';
import { LivingTown } from '../../../src/systems/livingWorld/livingTown.js';
import { talkPanelModel } from '../../../src/ui/enhanced/enhancedTalk.js';
import { NOTICE_CSS, PROF_CSS } from '../../../src/ui/enhanced/enhancedPlusStyle.js';
import { materialCountLabel } from '../../../src/systems/professions/profItems.js';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const T = 1_800_000_000;
const tick = (n = 4) => new Promise((r) => { let i = 0; const go = () => (++i >= n ? r() : setTimeout(go, 0)); setTimeout(go, 0); });
const n = (x) => x.toLocaleString('en-US');
const ANT = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const SH = { id: 'g1', name: 'The Silver Hand', tag: 'SH', heraldry: null };
const notices = () => ({ seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen() {}, cached: () => null,
  draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }), readGuild: async () => ({ data: null, error: 'no-guild' }) });

/** The Seat tab over the standings' answer `data`. */
async function seatTab(data) {
  const book = { open: true, data: { seats: [] }, standings: async () => ({ data, error: null }) };
  const host = document.createElement('div');
  mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 3021 }, book: notices(), nowS: () => T, seat: { seat: ANT, book } });
  await tick();
  byClass(host, 'notice-tab')[1].onclick();
  await tick();
  return host;
}
const week = (mine) => ({ seat: ANT, week: 6, phase: 'muster', reckoningAt: T + 3600, turningAt: T + 86400, defence: null, holder: null, standings: [], mine, chronicle: [] });

test('PLAIN-UI the Seat tab says what a seat is and the reader\'s next step before any number - no guild, a guild not pledged here (a lever or none, in the Muster or after it), a pledge elsewhere, a member not yet counted, an account bound elsewhere, a holder, one who earns (mutants: the pledge power read wrong; the region\'s pledge read as the seat\'s)', async () => {
  assert.match(seatAbout(ANT), /^Anticlere is a seat: one player guild at a time holds its Charter and rules the town\. /);
  const mine = (o) => ({ guild: 'g1', rank: 2, seasoned: true, bound: 'g1', pledges: [], influence: 0, ...o });
  const here = { region: 21, key: 3021 };
  const rows = [
    [week(null), 'You need a guild to take part. Open Social (beside the chat), then its Guild page to join or found one. A guild needs an account with a username and a password.'],   // PIN MOVED: AUDIT PLAIN-UI W12, U2
    [week(mine({ rank: 1 })), 'Pledge your guild to Anticlere before Friday 18:00 UTC.'],   // PIN MOVED: AUDIT PLAIN-UI U2 - the lever beside it
    [week(mine({ rank: 2 })), 'Ask an Officer or your Guildmaster to pledge your guild to Anticlere before Friday 18:00 UTC.'],
    [{ ...week(mine({ rank: 1 })), phase: 'reckoning' }, 'Pledges are locked until the Turning, Sunday 18:00 UTC. Your guild can pledge here in next week\'s Muster.'],
    [week(mine({ pledges: [{ region: 21, key: 3099 }] })), 'Your guild fights for another seat of this region this week, and what you earn counts there.'],
    [week(mine({ pledges: [here], seasoned: false })), `You count for your guild once you have been in it ${SEAT_MEMBER_WAIT_S / 86400} days.`],
    [week(mine({ pledges: [here], bound: 'g9' })), 'Your account fights for another guild this week, and what you earn counts there.'],
    [week(mine({ pledges: [{ ...here, held: true }] })), /^Your guild holds this Charter\. Earn influence here to keep its defense above every challenger: /],
    [week(mine({ pledges: [{ region: 4, key: 400 }, here] })), /^Earn influence for your guild here: walk the town, close Dagon's Breaches/],
  ];
  for (const [data, want] of rows) {
    const got = seatNextStep(ANT, data);
    if (typeof want === 'string') assert.equal(got, want); else assert.match(got, want);
  }
  // drawn: the panel under the Charter, the step marked
  const host = await seatTab(week(null));
  const about = byClass(host, 'seat-aboutpanel')[0];
  assert.equal(about.children[0].textContent, SEAT_PANELS.about);
  assert.equal(byClass(about, 'seat-about')[0].textContent, seatAbout(ANT));
  assert.equal(byClass(about, 'seat-next')[0].textContent, rows[0][1]);
  const cork = byClass(host, 'notice-seat')[0];
  assert.deepEqual(cork.children.slice(0, 4).map((c) => c.className), ['notice-panel seat-head', 'notice-panel seat-aboutpanel', 'notice-panel seat-guide board-guide', 'notice-panel seat-words board-words'],
    'the Charter, what it is, how it works and its words - before This week');
});

test('PLAIN-UI the Seat tab\'s guide stands open for a reader whose guild is not in the region\'s war, folded for one whose is; a fold or an unfold kept across the tab\'s redraws (mutant: the open read backwards)', async () => {
  assert.equal(seatGuideOpen(ANT, week(null)), true, 'no guild');
  assert.equal(seatGuideOpen(ANT, week({ pledges: [{ region: 4, key: 400 }] })), true, 'a pledge in another region');
  assert.equal(seatGuideOpen(ANT, week({ pledges: [{ region: 21, key: 3099 }] })), false, 'a pledge in this region, at another seat');
  const host = await seatTab(week(null));
  const guide = () => byClass(host, 'seat-guide')[0];
  assert.equal(guide().open, true);
  assert.equal(guide().querySelectorAll('li').length, seatGuide(ANT).length);
  // the reader's press on its line (AUDIT PLAIN-UI C1: the press, never the toggle a draw's own open fires too)
  guide().children[0].onclick();
  guide().open = false;
  byClass(host, 'notice-tab')[0].onclick();
  await tick();
  byClass(host, 'notice-tab')[1].onclick();
  await tick();
  assert.equal(guide().open, false, 'folded, it stays folded');
  assert.equal(byClass(host, 'seat-words')[0].open, false, 'the words folded until asked');
});

test('PLAIN-UI Words on this board: every name the Seat tab uses, in a word list, each number the law\'s own - a crown\'s line and Tithe its own (mutants: the claim\'s line a palace\'s at a crown; Unrest\'s bonus; the Tribute\'s rate)', async () => {
  const words = seatWords(ANT);
  assert.deepEqual(words.map(([w]) => w), ['Charter', 'Influence', 'Muster, Reckoning, Turning', 'Pledge', 'Defence', 'Right of Siege', 'Tourney', 'Standing', 'Tithe', 'Edict', 'Tribute', 'Sellsword', 'The Works', 'Fealty and Pacts', 'Season and Tide']);   // AUDIT PLAIN-UI T6: the Works and crown politics too
  const said = (seat, w) => seatWords(seat).find(([k]) => k === w)[1];
  assert.match(said(ANT, 'Right of Siege'), new RegExp(`at least ${n(CLAIM_THRESHOLD.palace)} influence`));
  assert.match(said({ tier: 'crown' }, 'Right of Siege'), new RegExp(`at least ${n(CLAIM_THRESHOLD.crown)} influence`));
  assert.match(said(ANT, 'Tourney'), new RegExp(`within ${Math.round(CONTESTED_MARGIN * 100)}% of each other`));
  assert.match(said(ANT, 'Standing'), new RegExp(`starts at ${STANDING_START}\\. Under ${STANDING_UNREST} the town is in Unrest and challengers earn ${Math.round(UNREST_BONUS * 100)}% more`));
  assert.match(said(ANT, 'Tithe'), new RegExp(`at most ${TITHE_CAP.palace}% here`));
  assert.match(said({ tier: 'crown' }, 'Tithe'), new RegExp(`at most ${TITHE_CAP.crown}% here`));
  assert.match(said(ANT, 'Tribute'), new RegExp(`1 for every ${TRIBUTE_MARKS_PER_INFLUENCE} silver`));
  const host = await seatTab(week(null));
  const dl = byClass(host, 'seat-words')[0].children[1];
  assert.equal(dl.tagName, 'DL');
  assert.deepEqual(dl.children.map((c) => c.tagName), words.flatMap(() => ['DT', 'DD']), 'each word over its meaning');
  assert.equal(dl.children[0].textContent, 'Charter');
});

/** The board's Work tab over `data` (the writs' answer). */
async function workTab(data) {
  const book = { state: { open: true, writs: { today: 0, max: 3 } }, held: () => 9,
    writs: async () => ({ data: { writs: [], receipts: [], merit: [], chapters: [], today: { filled: 0, max: 3 }, ...data }, error: null, stale: false }),
    deliver: async () => ({ ok: false }) };
  const host = document.createElement('div');
  mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 5 }, book: notices(), nowS: () => T,
    work: { book, region: 17, regionName: 'Daggerfall', countName: (k, c) => materialCountLabel(k, c) } });
  await tick();
  byClass(host, 'notice-tab')[1].click();
  for (let i = 0; i < 3; i++) await tick();
  return host;
}

test('PLAIN-UI How chapters work stands over the chapters\' cards - open for a reader who earns Merit in none, folded for one who does, absent where the region keeps none - and its numbers are the law\'s own (mutants: the open read backwards; a Merit or a Strength number typed)', async () => {
  const guide = chapterGuide();
  assert.deepEqual(guide.map(([w]) => w), ['What a chapter is', 'Your rank', 'Standing', 'Merit', 'Strength', 'Band', 'The chairs', 'Season', 'Patron']);   // PIN MOVED (SEAT-WORDS / STANDING-WORDS, Field-Bugs-2026-10-15g.md): the rank and the standing
  const said = (w) => guide.find(([k]) => k === w)[1];
  assert.match(said('Merit'), new RegExp(`${n(MERIT_WRIT)} for filling your own chapter writ.* a share of ${n(MERIT_RECEIPT)} for each .*at most ${n(MERIT_CAP_WEEK)} an account a week in each chapter`));
  assert.match(said('Strength'), new RegExp(`starting at ${STRENGTH_START}\\. .*up to ${STRENGTH_STEP_MAX}\\. .*A week with no Merit costs ${STRENGTH_IDLE}\\.`));   // PIN MOVED: AUDIT PLAIN-UI W1
  assert.match(said('Band'), /^Strength's name: Failing under 20, Steady from 20, Thriving from 70, Ascendant from 90\. /);
  assert.match(said('The chairs'), new RegExp(`^Rank 9 \\(the Master\\) and rank 8 \\(3 council chairs\\) .*the last ${SEAT_MERIT_WEEKS} weeks`));
  assert.match(said('Season'), new RegExp(`one event: ${CHAPTER_EVENTS.slice(0, -1).map((e) => e.name).join(', ')} or ${CHAPTER_EVENTS.at(-1).name}\\.`));
  assert.match(said('Patron'), new RegExp(`at least ${n(CHAPTER_PATRON_MIN)}\\).*pay Thriving prices`));
  const FIGHTERS = 41;
  const chapters = [{ faction: FIGHTERS, strength: 75, band: 'thriving' }];
  let host = await workTab({ chapters });
  const fold = () => byClass(host, 'chapter-guide')[0] ?? null;
  assert.equal(fold().children[0].textContent, CHAPTER_GUIDE_TITLE);
  assert.equal(fold().open, true, 'no Merit anywhere: open');
  assert.equal(fold().querySelectorAll('li').length, guide.length);
  const cork = fold().parentNode;
  assert.ok(cork.children.indexOf(fold()) < cork.children.indexOf(byClass(host, 'notice-chapter-card')[0]), 'over the cards');
  // AUDIT PLAIN-UI T3: the service sends a row for every membership (npcMerit.js meritAsks) - none earned yet is no Merit
  host = await workTab({ chapters, merit: [{ faction: FIGHTERS, merit: 0, max: 600, elsewhere: false, from: T + 86400 }] });
  assert.equal(fold().open, true, 'a member not yet earning: open');
  host = await workTab({ chapters, merit: [{ faction: FIGHTERS, merit: 100, max: 600, elsewhere: false, from: null }] });
  assert.equal(fold().open, false, 'a member with Merit here: folded');
  host = await workTab({});
  assert.equal(fold(), null, 'no chapter here, no guide');
});

test('PLAIN-UI the Family tab\'s How it works - the house\'s own model (both before one is founded), the toll the Features tile chose, every number the law\'s; a page of its own on the rail, drawn by the pause window (mutants: the models swapped; the toll typed; the page undrawn)', () => {
  assert.deepEqual(FAMILY_PAGE_SECTIONS.at(-1), ['guide', 'How it works']);
  assert.match(src('src/ui/enhanced/enhancedMenu.js'), /\{ tree: drawTreePage, house: drawHousePage, hall: drawHallPage, guide: drawGuidePage \}\)\[famSec\]\(detail, render, kit\);/);
  const death = (model, toll) => familyGuide(model, toll).find(([k]) => k === 'Death')[1];
  assert.match(death(MODELS.enduring, 0.06), /^In an Enduring house a death is not the end, but it costs years: Arkay's toll takes 6% of your race's lifespan each time \(vampires and werebeasts pay none\)\. From 75% of your lifespan you are an Elder,/);
  assert.match(death(MODELS.enduring, 0.1), /takes 10% of your race's lifespan/);
  assert.equal(death(MODELS.bloodline, 0.06), 'In a Bloodline house every death is final.');
  assert.match(death(null, 0.04), /takes 4% .* In a Bloodline house every death is final\. A house's model is chosen once, when its founder is made\.$/);
  const said = (w) => familyGuide(MODELS.enduring, 0.06).find(([k]) => k === w)[1];
  // PIN MOVED (AUDIT PLAIN-UI W2): the estate is whoever carries on; the blood and the hearth a newborn's
  assert.match(said('What carries on'), new RegExp(`^Whoever carries the line on receives the estate: a quarter of the gold the fallen carried, at most ${n(ESTATE_MAX)}\\. A newborn is also born with the blood \\(up to \\+${BLOOD_MAX} on each stat, from the better parent's\\) and the hearth \\(up to \\+${HEARTH_MAX} on each of a parent's primary and major skills\\)\\.$`));
  assert.match(said('Heirlooms and remains'), new RegExp(`\\+${HEIRLOOM_DAMAGE_PER_GEN}% damage.* gives \\+${BLESSING_POINTS} to the fallen's best skill`));
  assert.match(said('Marriage and children'), new RegExp(`a regard of \\+${FRIEND_AT}\\).* there is a 1 in 4 chance of a child every ${CHILD_DAYS} days you play as the married one, up to ${CHILDREN_MAX} children\\.`));   // PIN MOVED: AUDIT PLAIN-UI W11
  // drawn: the page's steps, the model played
  setFamilyProvider({ on: () => true, family: () => ({ model: MODELS.bloodline, people: [] }), lived: () => 0, switchRefusal: () => null, switchTo: () => ({ ok: true }) });
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const detail = document.createElement('div');
  drawGuidePage(detail, () => {}, { el, divider: (w) => el('div', 'px-divword', w) });
  setFamilyProvider(null);
  assert.equal(detail.children[0].textContent, 'How it works');
  const items = byClass(detail, 'fam-guide')[0].children;
  assert.equal(items.length, familyGuide(MODELS.bloodline, 0.06).length);
  assert.equal(items[1].textContent, 'Death. In a Bloodline house every death is final.');
});

test('PLAIN-UI the talk panel\'s regard badge - a living resident\'s standing in the Chronicle\'s words, the number signed, where it stands from -100 to +100, and what it is and what moves it; none for anyone else (mutants: the bar\'s share; a standing\'s name)', () => {
  assert.equal(regardBadge(null), null);
  assert.equal(regardBadge({ regard: NaN, standing: 'friend' }), null);
  const f = regardBadge({ regard: 46.4, standing: 'friend' });
  assert.deepEqual([f.standing, f.label, f.value, f.share], ['friend', 'Friend', '+46', 0.73]);
  assert.match(f.words, new RegExp(`^How they regard you: \\+46, from -100 to \\+100\\. A friend from \\+${FRIEND_AT}; an enemy from ${ENEMY_AT}, who will not speak to you; hostile from ${HOSTILE_AT}\\. `));
  assert.doesNotMatch(f.words, /gift/, 'nothing notes a gift: the badge promises none');
  assert.deepEqual(['neutral', 'enemy', 'hostile'].map((s) => STANDING_NAMES[s]), ['Known', 'Enemy', 'Hostile']);
  const k = regardBadge({ regard: -3, standing: 'neutral' });
  assert.deepEqual([k.label, k.value, k.share], ['Known', '-3', 0.485]);
  assert.equal(regardBadge({ regard: -80 }).standing, 'hostile', 'a card without its standing reads it off the number');
  // the panel reads it off the model's hook, as the host words it - and nothing for a hook-less model
  const model = { conversation: ['Hello.'], conversationSelected: -1, copyIndexes: new Set(), _talkOption: 'tellMeAbout', _lastCategory: 'location', topicMode: 'none',
    question: '', topics: [], selected: -1, hooks: { npcName: 'Ysolde', tone: () => 1, regard: () => f } };
  assert.equal(talkPanelModel(model).regard, f);
  assert.equal(talkPanelModel({ ...model, hooks: { npcName: 'Ysolde', tone: () => 1 } }).regard, null);
  const panel = src('src/ui/enhanced/enhancedTalk.js');
  assert.match(panel, /const r = el\('button', `talk-regard \$\{m\.regard\.standing\}`\);/, 'a press says what it means - a finger has no hover');
  assert.match(panel, /if \(m\.regard && regardOpen\) head\.append\(el\('p', 'talk-regard-words', m\.regard\.words\)\);/);
});

test('PLAIN-UI the regard reaches the panel from the body\'s own town - its day\'s regard and standing (refuses()\' own read), worded by the host, for the resident the conversation is with and nobody else (mutants: the hook unwired; the card\'s standing off another id)', () => {
  const asked = [];
  const rel = { regard: (id, day) => { asked.push([id, day]); return id === 'L5.3' ? 42 : 0; }, standing: (id, day) => (id === 'L5.3' && day === 7 ? 'friend' : 'neutral') };
  const town = { o: { relations: () => rel }, dayOf: () => 7, _liveMinute: () => 0 };
  assert.deepEqual(LivingTown.prototype.regardCard.call(town, { living: { id: 'L5.3' } }), { regard: 42, standing: 'friend' });
  assert.deepEqual(asked, [['L5.3', 7]]);
  assert.equal(LivingTown.prototype.regardCard.call(town, { nameNPC: 'a walker' }), null, 'DFU\'s walkers keep no regard');
  assert.equal(LivingTown.prototype.regardCard.call({ ...town, o: {} }, { living: { id: 'L5.3' } }), null);
  assert.match(src('src/scenes/townTalk.js'), /regard: \(\) => \(_toneTarget \? livingTalk\?\.regard\?\.\(_toneTarget\) \?\? null : null\),/);
  assert.match(src('src/scenes/world.js'), /regard: \(person\) => regardBadge\(person\?\.living\?\.town\?\.regardCard\?\.\(person\) \?\? null\),/);
});

test('PLAIN-UI the board\'s type a step larger - its panels, their names, the Seat tab\'s lines, the chapters\' lines and the Merit line ("Its tiny") (mutant: the panel\'s size back)', () => {
  assert.match(NOTICE_CSS, /\n\.notice-panel \{ margin: 0 0 12px; padding: 12px 14px; font-size: 15px;/);
  assert.match(NOTICE_CSS, /\n\.notice-panel > h3, \.notice-panel > summary \{[^}]*font-size: 14px;/);
  assert.match(NOTICE_CSS, /\n\.notice-seat-week, \.notice-seat-mine \{[^}]*font-size: 15px;/);
  assert.match(PROF_CSS, /\n\.notice-chapter \{[^}]*font-size: 14px;/);
  assert.match(PROF_CSS, /\n\.notice-merit \{[^}]*font-size: 14px;/);
  assert.match(NOTICE_CSS, /\n\.board-words dl \{[^}]*grid-template-columns: minmax\(8em, max-content\) minmax\(0, 1fr\);/, 'each word beside its meaning');
});
