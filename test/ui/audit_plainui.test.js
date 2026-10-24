// AUDIT PLAIN-UI (2026-10-12, the owner: "Audit this") - PLAIN-UI read by four cold lanes on a frozen snapshot
// (a1388898): the words against the law that enforces them (W), the code (C), the pins and the record (T), the render (U).
// Every finding's pin is here, each failing under its finding's mutant (tools/mutants/audit_plainui.json).
// bible/01-Overview/audits/Audit-Plain-UI.md.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { byClass } from '../chargenDom.mjs';
import { mountNoticeBoard, chapterGuide } from '../../src/ui/noticeWindow.js';
import { seatNextStep, seatWords, seatMayPledgeHere, SEAT_PANELS } from '../../src/ui/seatTab.js';
import { SEAT_PLEDGE_REGIONS_MAX, SEAT_LEGACY_SHARE } from '../../src/net/townSeatLaw.js';
import {
  STRENGTH_TARGET, STRENGTH_SHORT, STRENGTH_IDLE, CHAPTER_FAILING_FALL, CHAPTER_EVENT_EFFECTS, SEAT_ACCOUNT_AGE_S,
} from '../../src/net/npcChapterLaw.js';
import { familyGuide, drawGuidePage, drawTreePage, setFamilyProvider, FAMILY_HOWTO_WORDS } from '../../src/ui/familyPages.js';
import { MODELS, LEGACY_MOD } from '../../src/systems/legacy/family.js';
import { REMAINS_GOLD_MAX } from '../../src/systems/legacy/heirloom.js';
import { setModSetting, modSetting } from '../../src/systems/modSettings.js';
import { regardBadge } from '../../src/systems/livingWorld/people.js';
import { createRelations } from '../../src/systems/livingWorld/relations.js';
import { createLivingRoads } from '../../src/scenes/livingWorld/livingRoads.js';
import { mountEnhancedTalk } from '../../src/ui/enhanced/enhancedTalk.js';
import { NOTICE_CSS, PROF_CSS } from '../../src/ui/enhanced/enhancedPlusStyle.js';
import { FAMILY_CSS } from '../../src/ui/familyPages.js';
import { materialCountLabel } from '../../src/systems/professions/profItems.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const T = 1_800_000_000;
const tick = (n = 4) => new Promise((r) => { let i = 0; const go = () => (++i >= n ? r() : setTimeout(go, 0)); setTimeout(go, 0); });
const ANT = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const notices = () => ({ seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen() {}, cached: () => null,
  draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }), readGuild: async () => ({ data: null, error: 'no-guild' }) });
const week = (mine) => ({ seat: ANT, week: 6, phase: 'muster', reckoningAt: T + 3600, turningAt: T + 86400, defence: null, holder: null, standings: [], mine, chronicle: [] });
/** The Seat tab over the standings' answer `r` ({ data, error }). */
async function seatTab(r) {
  const book = { open: true, data: { seats: [] }, standings: async () => r };
  const host = document.createElement('div');
  mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 3021 }, book: notices(), nowS: () => T, seat: { seat: ANT, book } });
  await tick();
  byClass(host, 'notice-tab')[1].onclick();
  await tick();
  return host;
}
const redraw = async (host) => { byClass(host, 'notice-tab')[0].onclick(); await tick(); byClass(host, 'notice-tab')[1].onclick(); await tick(); };

test('AUDIT PLAIN-UI W1 How chapters work says the whole of Strength - the week\'s mark, the fall back toward 50, a week with none, the Failing band\'s fall, the Rivalry\'s swing and the Season\'s end; and the chairs\' account age (mutants: the short week\'s fall typed; the swing dropped)', () => {
  const said = (w) => chapterGuide().find(([k]) => k === w)[1];
  const s = said('Strength');
  assert.match(s, new RegExp(`The week's mark is ${STRENGTH_TARGET} Merit for every 100 active players \\(at least ${STRENGTH_TARGET}\\)\\.`));
  assert.match(s, new RegExp(`A week below the mark moves a chapter above 50 back ${STRENGTH_SHORT} toward it\\. A week with no Merit costs ${STRENGTH_IDLE}\\. A Failing chapter loses ${CHAPTER_FAILING_FALL} more unless its Merit reaches twice the mark\\.`));
  assert.match(s, new RegExp(`A Rivalry's winner takes ${CHAPTER_EVENT_EFFECTS.rivalrySwing} from the loser, and a Season's end moves every chapter halfway back to 50\\.$`));
  assert.match(said('The chairs'), new RegExp(`and an account ${SEAT_ACCOUNT_AGE_S / 86400} real days old\\.`));   // PIN MOVED (AUDIT GUILD-WORDS II C-8): real days, as the hall's line says them
  assert.match(said('Patron'), /pay Thriving prices for training and spells in its halls, or the chapter's own prices if lower\.$/, 'W9: an Ascendant chapter\'s own is better');
});

test('AUDIT PLAIN-UI W2 W3 W10 W11 the Family page: the estate is whoever carries on and the blood and hearth a newborn\'s; a child and a retired elder play nobody and carry nothing; the Has an heir chip a Bloodline house\'s; the remains\' gold its cap; an heirloom grows at its rest; the toll the Features tile\'s, drawn (mutants: the toll setting unread; the cap typed)', () => {
  const g = familyGuide(MODELS.enduring, 0.06);
  const said = (w) => g.find(([k]) => k === w)[1];
  assert.match(said('Your house'), /any grown, living member of the blood can be played\.$/);
  assert.match(said('Who carries on'), /any grown, living member of the blood who has not retired, or a newborn heir .*In a Bloodline house, the tree shows Has an heir on a member who will leave one, and an Elder who passes the mantle can always choose a newborn\./);
  assert.match(said('Heirlooms and remains'), new RegExp(`of their purse \\(at most ${REMAINS_GOLD_MAX.toLocaleString('en-US')}\\)\\. .*grows a step each time it is laid to rest beside the remains of the one who carried it`));
  assert.match(said('Playing another'), /can be played from it with Play as, but not during a fight or while a Succession waits\./);
  assert.match(said('Marriage and children'), /You can only play a child once the line passes to them\.$/);
  // the toll the Features tile chose, read where the page is drawn
  const was = modSetting(LEGACY_MOD, 'Legacy.Toll');
  setModSetting(LEGACY_MOD, 'Legacy.Toll', 2);
  try {
    setFamilyProvider({ on: () => true, family: () => ({ model: MODELS.enduring, people: [] }), lived: () => 0, switchRefusal: () => null, switchTo: () => ({ ok: true }) });
    const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
    const detail = document.createElement('div');
    drawGuidePage(detail, () => {}, { el, divider: (w) => el('div', 'px-divword', w) });
    assert.match(byClass(detail, 'fam-guide')[0].children[1].textContent, /Arkay's toll takes 10% of your race's lifespan/, 'Heavy: 10%');
    // C6: Legacy on, no house - the page says why, over both models
    setFamilyProvider({ on: () => true, family: () => null, lived: () => 0, choice: () => 'none', switchRefusal: () => null, switchTo: () => ({ ok: true }) });
    const none = document.createElement('div');
    drawGuidePage(none, () => {}, { el, divider: (w) => el('div', 'px-divword', w) });
    assert.equal(none.children[1].className, 'px-note');
    assert.match(none.children[1].textContent, /chose to live without a house/);
  } finally {
    setModSetting(LEGACY_MOD, 'Legacy.Toll', was);
    setFamilyProvider(null);
  }
});

test('AUDIT PLAIN-UI W4 W5 W7 W12 T4 the Seat tab\'s words: a pledge takes the region\'s Breaches and Renown; a guild at its regions\' most told it cannot pledge here; a Sellsword of neither guild; a guest told a guild needs an account; an account bound to nobody yet earns here (mutants: the full guild offered a pledge; the unbound account sent elsewhere)', () => {
  const said = (w) => seatWords(ANT).find(([k]) => k === w)[1];
  assert.match(said('Pledge'), /the Watch, a home and seat writs in that seat's town; Dagon's Breaches and Renown anywhere in the region\.$/);
  assert.match(said('Sellsword'), /^A player of neither guild in the battle, hired for a fee by one side's Guildmaster/);
  assert.match(said('Influence'), new RegExp(`^A guild's score .* ${SEAT_LEGACY_SHARE === 0.1 ? 'A tenth' : ''} carries into the next week \\(none past a Season's end\\)`));
  assert.ok(seatWords(ANT).some(([k]) => k === 'The Works') && seatWords(ANT).some(([k]) => k === 'Fealty and Pacts'), 'T6: the tab\'s Works and crown politics named');
  const full = Array.from({ length: SEAT_PLEDGE_REGIONS_MAX }, (_, i) => ({ region: 100 + i, key: 9000 + i }));
  const mine = (o) => ({ guild: 'g1', rank: 1, seasoned: true, bound: null, pledges: [], influence: 0, ...o });
  assert.equal(seatNextStep(ANT, week(mine({ pledges: full }))), `Your guild has pledged in ${SEAT_PLEDGE_REGIONS_MAX} regions this week, the most it can. Take one pledge down to pledge here.`);
  assert.match(seatNextStep(ANT, week(mine({ pledges: full.slice(1) }))), /^Pledge your guild to Anticlere/, 'one short of the most: the lever');
  assert.match(seatNextStep(ANT, week(null)), /A guild needs an account with a username and a password\.$/);
  // T4: the producer's `bound` is null until the account's first influence (seatInfluence.js readStandings)
  assert.match(seatNextStep(ANT, week(mine({ pledges: [{ region: 21, key: 3021 }], bound: null }))), /^Earn influence for your guild here/);
});

test('AUDIT PLAIN-UI W6 the badge\'s number toward nought, as the standing reads it - 39.5 a Known +39, never +40 beside "A friend from +40"; -40.5 an Enemy -40; one of theirs struck down named (mutant: the number rounded)', () => {
  const rel = createRelations();
  rel.note('L5.3', 'talk', 0, 42.5);
  const r = rel.regard('L5.3', 6);
  assert.equal(r, 39.5, 'six days apart ease 3: a real half');
  const b = regardBadge({ regard: r, standing: rel.standing('L5.3', 6) });
  assert.deepEqual([b.label, b.value], ['Known', '+39']);
  assert.deepEqual([regardBadge({ regard: -40.5, standing: 'enemy' }).value, regardBadge({ regard: -39.5, standing: 'neutral' }).value], ['-40', '-39']);
  assert.equal(regardBadge({ regard: -0.4, standing: 'neutral' }).value, '0');
  // PIN MOVED: TONE-TASTE (bible/06-Systems/Living-World.md) - the tone as they take it, townsfolk's named
  assert.match(b.words, /A tone they dislike, a crime they see, a blow, and worst of all killing one of their own lower it\. Townsfolk prefer Blunt to Polite\./);
});

test('AUDIT PLAIN-UI C1 a board fold records the reader\'s PRESS on its line, never a toggle - a browser fires toggle for the open a draw sets too, so the drawn default was kept as a choice and a redraw\'s echo could undo a fold; the words\' fold and the chapters\' fold kept across redraws as the guide\'s is (mutants: the words\' fold forgotten; the chapters\' fold forgotten)', async () => {
  for (const f of ['src/ui/seatTab.js', 'src/ui/noticeWindow.js']) assert.doesNotMatch(src(f), /addEventListener\?\.\('toggle'/, `${f}: no fold listens to toggle`);
  const host = await seatTab({ data: week(null), error: null });
  const words = () => byClass(host, 'seat-words')[0];
  assert.equal(words().open, false);
  words().children[0].onclick();
  words().open = true;
  await redraw(host);
  assert.equal(words().open, true, 'opened, it stays open');
  // the dd is the word's meaning
  const dl = words().children[1];
  assert.deepEqual([dl.children[0].textContent, dl.children[1].textContent], seatWords(ANT)[0]);
  // the chapters' fold
  const book = { state: { open: true, writs: { today: 0, max: 3 } }, held: () => 9,
    writs: async () => ({ data: { writs: [], receipts: [], merit: [], chapters: [{ faction: 41, strength: 75 }], today: { filled: 0, max: 3 } }, error: null, stale: false }), deliver: async () => ({ ok: false }) };
  const board = document.createElement('div');
  mountNoticeBoard(board, { town: { name: 'Anticlere', mapId: 5 }, book: notices(), nowS: () => T, work: { book, region: 17, regionName: 'Daggerfall', countName: (k, c) => materialCountLabel(k, c) } });
  await tick();
  byClass(board, 'notice-tab')[1].click();
  for (let i = 0; i < 3; i++) await tick();
  const fold = () => byClass(board, 'chapter-guide')[0];
  assert.equal(fold().open, true);
  fold().children[0].onclick();
  fold().open = false;
  byClass(board, 'notice-tab')[0].click(); await tick();
  byClass(board, 'notice-tab')[1].click(); for (let i = 0; i < 3; i++) await tick();
  assert.equal(fold().open, false, 'folded, it stays folded');
});

test('AUDIT PLAIN-UI C4 a reader the standings refused, or not reached yet, is still told what a seat is and how its war works - the next step alone waits on the standings (mutant: the explanation after the answer again)', async () => {
  const host = await seatTab({ data: null, error: 'seats-closed' });
  const cork = byClass(host, 'notice-seat')[0];
  assert.deepEqual(cork.children.map((c) => c.className), ['notice-panel seat-head', 'notice-empty', 'notice-panel seat-aboutpanel', 'notice-panel seat-guide board-guide', 'notice-panel seat-words board-words']);
  assert.equal(byClass(host, 'seat-next').length, 0, 'no step without the standings');
  assert.equal(byClass(host, 'seat-guide')[0].open, true, 'nobody in the war: open');
  assert.equal(byClass(host, 'seat-aboutpanel')[0].children[0].textContent, SEAT_PANELS.about);
});

test('AUDIT PLAIN-UI C2 the badge for every living body, not the street\'s alone - a resident at home through the indoor door, a road\'s or a diver\'s through the roads\' (its company\'s word its head\'s, as its refusal reads) (mutants: the doors without a card)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /const _livingIndoorsDoor = \{[\s\S]{0,700}regardCard: \(p\) => livingIndoors\?\.town\(\)\?\.regardCard\?\.\(p\) \?\? null,/);
  assert.match(w, /\n {2}_livingRoadsDoor\.regardCard = \(p\) => livingRoads\?\.regardCard\(p\) \?\? null;/);
  assert.match(src('src/world/travellerSprites.js'), /living: \{ id: res\.id, res, town: living \}/, 'a body\'s town is its door');
  const rel = createRelations();
  const clock = 100 * 1440 + 12 * 60;
  const roads = createLivingRoads({ clock: () => clock, relations: () => rel, sprites: { sync() {}, batches: () => [], persons: () => [], bodyOf: () => null, clear() {} } });
  const person = { nameNPC: 'Ann Bee', living: { id: 'L5.t2' } };
  roads.talked(person);
  const card = roads.regardCard(person);
  assert.equal(card.standing, 'neutral');
  assert.ok(card.regard > 0, 'the word just noted');
  assert.equal(roads.regardCard({ nameNPC: 'a walker' }), null);
});

test('AUDIT PLAIN-UI U the talk badge pressed says its words and pressed again hides them; its mark stands where the regard does; a new conversation starts with them hidden; their line keeps the conversation on a short screen (mutants: the press dead; the mark fixed; the open kept across mounts)', () => {
  const badge = regardBadge({ regard: 46, standing: 'friend' });
  const model = { conversation: ['Hello.'], conversationSelected: -1, copyIndexes: new Set(), _talkOption: 'tellMeAbout', _lastCategory: 'location', topicMode: 'none',
    question: '', topics: [], selected: -1, hooks: { npcName: 'Ysolde', tone: () => 1, regard: () => badge }, press() {}, selectConversation() {}, selectTopic() {}, useTopic() {}, input() {} };
  const host = document.createElement('div');
  document.body.append(host);
  let view = mountEnhancedTalk(host, { model });
  const button = () => byClass(host, 'talk-regard')[0];
  assert.equal(byClass(host, 'talk-regard-words').length, 0, 'hidden until asked');
  assert.equal(byClass(host, 'talk-regard-bar')[0].children[0].style.left, '73.0%');
  button().onclick();
  assert.equal(byClass(host, 'talk-regard-words')[0].textContent, badge.words);
  assert.equal(button().getAttribute('aria-expanded'), 'true');
  view.destroy();
  view = mountEnhancedTalk(host, { model });
  assert.equal(byClass(host, 'talk-regard-words').length, 0, 'the next conversation starts with them hidden');
  view.destroy();
  host.remove();
  assert.match(src('src/ui/enhanced/enhancedStyle.js'), /\.talk-regard-words \{[^}]*max-height: 4\.4em; overflow-y: auto; max-width: 72ch; \}/);
});

test('AUDIT PLAIN-UI T5 the sizes the record claims, every one pinned - the Charter\'s head, the battle, the day\'s writ count, the Family tab\'s chips and its card (mutants: each back)', () => {
  assert.match(NOTICE_CSS, /\n\.seat-head \.seat-charter \{ margin: 0; font-size: 17px;/);
  assert.match(NOTICE_CSS, /\n\.notice-seat-battle \{ margin: 0 0 6px; font-size: 15px;/);
  assert.match(PROF_CSS, /\n\.notice-worktoday \{[^}]*font-size: 15px;/);
  assert.match(FAMILY_CSS, /\.px-sys \.fam-chip \{[^}]*font-size: 12px;/);
  assert.match(FAMILY_CSS, /\.px-sys \.fam-card \{ flex: 0 0 268px; max-width: 268px;/, 'U7: beside the tree the card keeps its width');
  assert.match(FAMILY_CSS, /\.px-sys \.fam-nname \{ font-size: 12px;/);
});

test('AUDIT PLAIN-UI U2 the next step carries its lever and its clock - the pledge button beside "Pledge your guild" (never for a guild at its regions\' most, one already pledged in the region, a rank without the power, or the Reckoning), the time left to the deadline, the seat a pledge elsewhere is for (mutants: the lever offered past the most; the seat unnamed)', async () => {
  const mine = (o) => ({ guild: 'g1', rank: 1, seasoned: true, bound: null, pledges: [], influence: 0, ...o });
  assert.equal(seatMayPledgeHere(ANT, week(mine())), true);
  assert.equal(seatMayPledgeHere(ANT, week(mine({ rank: 2 }))), false, 'a Member asks');
  assert.equal(seatMayPledgeHere(ANT, { ...week(mine()), phase: 'reckoning' }), false);
  assert.equal(seatMayPledgeHere(ANT, week(mine({ pledges: [{ region: 21, key: 3099 }] }))), false, 'pledged in the region');
  assert.equal(seatMayPledgeHere(ANT, week(mine({ pledges: Array.from({ length: SEAT_PLEDGE_REGIONS_MAX }, (_, i) => ({ region: 100 + i, key: i })) }))), false, 'at the most');
  assert.equal(seatNextStep(ANT, week(mine()), { nowS: T }), 'Pledge your guild to Anticlere before Friday 18:00 UTC (in 1h 0m).');
  assert.equal(seatNextStep(ANT, week(mine({ pledges: [{ region: 21, key: 3099 }] })), { nameOf: (k) => (k === 3099 ? 'Gothway Garden' : null) }),
    'Your guild fights for Gothway Garden this week, and what you earn counts there.');
  const pledged = [];
  const book = { open: true, data: { seats: [] }, standings: async () => ({ data: week(mine()), error: null }), pledge: async (s) => { pledged.push(s.key); return { ok: true }; } };
  const host = document.createElement('div');
  mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 3021 }, book: notices(), nowS: () => T, seat: { seat: ANT, book } });
  await tick();
  byClass(host, 'notice-tab')[1].onclick();
  await tick();
  const lever = byClass(byClass(host, 'seat-next')[0], 'seat-next-pledge')[0];
  assert.equal(lever.textContent, 'Pledge to Anticlere');
  lever.onclick();
  await tick();
  assert.deepEqual(pledged, [3021], 'the lever pledges here, through the window\'s door');
});

test('AUDIT PLAIN-UI U3 U6 U8 U10 U11 a fold\'s line a finger\'s target with its own ring; a long name on two lines with the whole name on hover; the tree\'s way to How it works; the badge says it can be pressed; an enemy\'s refusal says where they stand (mutants: the target back; the way undrawn; the refusal bare)', () => {
  assert.match(NOTICE_CSS, /\n\.notice-panel > summary \{ margin: -11px 0; padding: 11px 0; cursor: pointer; \}/);
  assert.match(NOTICE_CSS, /\n\.notice-panel > summary:focus-visible \{ outline: 2px dashed #f3cf86;/);
  assert.match(FAMILY_CSS, /\.px-sys \.fam-nname \{[^}]*-webkit-line-clamp: 2;/);
  assert.match(src('src/ui/familyPages.js'), /named\.setAttribute\?\.\('title', fullNameOf\(p\.given, p\.surname\)\);/);
  const goneTo = [];
  setFamilyProvider({ on: () => true, family: () => null, lived: () => 0, switchRefusal: () => null, switchTo: () => ({ ok: true }) });
  try {
    const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
    const detail = document.createElement('div');
    drawTreePage(detail, () => {}, { el, divider: (w) => el('div', 'px-divword', w), goto: (id) => goneTo.push(id) });
    const how = byClass(detail, 'fam-howto')[0];
    assert.equal(how.textContent, FAMILY_HOWTO_WORDS);
    how.onclick();
    assert.deepEqual(goneTo, ['guide']);
  } finally { setFamilyProvider(null); }
  assert.match(src('src/ui/enhanced/enhancedMenu.js'), /goto: \(id\) => \{ famSec = id; disarmFamilyPages\(\); render\(\); \} \};/, 'the pause window hands the tree its way');
  assert.match(src('src/ui/enhanced/enhancedStyle.js'), /\.talk-regard-value::after \{ content: ' \?';/);
  assert.match(src('src/scenes/townTalk.js'), /if \(refusal\) \{ const b = livingTalk\?\.regard\?\.\(target\.person\) \?\? null; setMidScreenText\(b \? `\$\{refusal\} \(\$\{b\.label\}, \$\{b\.value\}\)` : refusal\); return; \}/);
});
