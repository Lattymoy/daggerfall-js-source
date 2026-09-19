// LV2 — THE RISING: the enhanced skin's level-up notification.
//
// Mac, 2026-09-19: "Next up, I want to implement a new element. The
// enhanced level up notification" - and, on what it should do about
// the window that used to open itself: "Notify, then you choose",
// over all three events.
//
// WHAT THESE PINS ARE FOR. The element is two halves that must not be
// confused: an ANNOUNCEMENT, which is an event and expires, and a
// REMINDER, which is a STATE and lasts exactly as long as the level is
// unspent. Nearly every way this could go wrong is one half behaving
// like the other - a reminder that outlives the points, an
// announcement that never goes, a level spent by some road this
// module never watched leaving a line on screen telling the player to
// spend it again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKILLS, SKILL_NAMES } from '../src/systems/skills.js';
import { audio } from '../src/systems/audio.js';
import { SOUND } from '../src/systems/soundClips.js';
import { loadOrCreateBindings, codeForAction, actionForCode } from '../src/systems/inputActions.js';
import {
  LevelNotices, levelNotices, announceLevelUp, announceSkillRaise, announceMastery,
  drawLevelNotices, destroyLevelNotices, levelOwed, sheetKeyText,
  ANNOUNCE_MS, MAX_ROWS, NOTICE_LEVEL, NOTICE_SKILL, NOTICE_MASTERY,
  RISEN_TITLE, AWAITS_TITLE, MASTERED_TITLE, LEVEL_NOTICE_ID,
} from '../src/ui/levelNotice.js';

/** The smallest document this strip can be drawn into - it touches
 *  createElement, className, textContent, setAttribute, append and
 *  remove, and nothing else. */
function fakeDoc() {
  const make = (tag) => {
    const n = {
      tag, className: '', textContent: '', attrs: {}, children: [],
      setAttribute(k, v) { this.attrs[k] = v; },
      append(...kids) { this.children.push(...kids); },
      remove() { n.removed = true; },
    };
    return n;
  };
  const body = make('body');
  return { createElement: make, body };
}
/** Every string under a node, in order - the rows nest (gem, body(title,
 *  sub), key) and a one-level read missed the words it was checking. */
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, f), 'utf8');
/** The sound spy this suite's neighbours use (advancementui, audit63). */
const withSounds = (fn) => {
  const played = [];
  const real = audio.playOneShot;
  audio.playOneShot = (i) => { played.push(i); return 0.1; };
  try { fn(); } finally { audio.playOneShot = real; }
  return played;
};

// ── THE QUEUE ─────────────────────────────────────────────────────

test('LV2: a second raise of the same skill UPDATES its row - a strip is not a log', () => {
  const q = new LevelNotices();
  q.announceSkill(SKILLS.Archery, 26, 0);
  q.announceSkill(SKILLS.Climbing, 41, 10);
  q.announceSkill(SKILLS.Archery, 27, 20);
  assert.equal(q.rows.length, 2, 'two subjects, two rows');
  const archery = q.rows.find((r) => r.key === `skill:${SKILLS.Archery}`);
  assert.equal(archery.sub, '27', 'and the row carries the LATEST value');
  assert.equal(archery.at, 20, 'with the latest moment, so it expires from the newest news');
  assert.equal(q.rows.find((r) => r.key === `skill:${SKILLS.Climbing}`).sub, '41');
});

test('LV2: the cap drops the OLDEST CHATTER and never the level - the one row that asks for something', () => {
  // A rest raises a handful of skills at once and then levels the
  // player: `raiseSkills` walks the whole array in one pass. The row a
  // player is looking for must not be the one pushed off the strip.
  const q = new LevelNotices();
  q.announceLevel(6, 0);
  for (let i = 0; i < MAX_ROWS + 3; i++) q.announceSkill(i, 10 + i, 10 + i);
  assert.equal(q.rows.length, MAX_ROWS);
  assert.ok(q.rows.some((r) => r.kind === NOTICE_LEVEL), 'the level survives a flurry');
  assert.equal(q.rows.filter((r) => r.kind === NOTICE_LEVEL).length, 1);
  const kept = q.rows.filter((r) => r.kind === NOTICE_SKILL).map((r) => r.at);
  assert.deepEqual(kept, [...kept].sort((a, b) => a - b), 'what is kept is the newest chatter');
  assert.ok(Math.min(...kept) > 10, 'and the oldest went first');
});

test('LV2: the announcement is an EVENT and the reminder is a STATE', () => {
  const q = new LevelNotices();
  q.announceLevel(6, 0);
  q.announceSkill(SKILLS.Archery, 26, 0);
  q.announceMastery(SKILLS.LongBlade, 0);

  let rows = q.frame(100, { owed: true });
  assert.equal(rows.length, 3);
  assert.equal(rows.every((r) => !r.standing), true, 'all three are news at first');
  assert.equal(rows.find((r) => r.kind === NOTICE_LEVEL).title, RISEN_TITLE);
  assert.equal(rows.find((r) => r.kind === NOTICE_MASTERY).title, MASTERED_TITLE);
  assert.equal(rows.find((r) => r.kind === NOTICE_SKILL).title, SKILL_NAMES[SKILLS.Archery]);

  // Past the announcement: the chatter is gone and the level FOLDS.
  rows = q.frame(ANNOUNCE_MS, { owed: true });
  assert.deepEqual(rows.map((r) => r.kind), [NOTICE_LEVEL]);
  assert.equal(rows[0].standing, true);
  assert.equal(rows[0].title, AWAITS_TITLE, 'and it stops calling itself news');

  // THE POINTS ARE SPENT, by whatever road: the reminder goes with
  // them. This is the arm that a latch would have got wrong.
  assert.deepEqual(q.frame(ANNOUNCE_MS, { owed: false }), []);
});

test('LV2: a level owed but never announced here still says so', () => {
  // A save loaded with the flag already set; a level earned while this
  // surface was not mounted; a player who alt-tabbed through the
  // announcement. The strip is the only place that says a level is
  // waiting, so it says it from the STATE rather than from memory.
  const q = new LevelNotices();
  const rows = q.frame(0, { owed: true });
  assert.deepEqual(rows.map((r) => [r.kind, r.title, r.standing]), [[NOTICE_LEVEL, AWAITS_TITLE, true]]);
  assert.deepEqual(q.frame(0, { owed: false }), []);
});

test('LV2: the level\'s row is drawn LAST, so the one row that asks does not move', () => {
  // raiseSkills raises the skills and THEN levels the player
  // (PlayerEntity.cs:1371-1414), so a plain newest-first sort puts the
  // level on top at a level-up and at the bottom on the next raise -
  // the row a player is hunting for, moving under them.
  const q = new LevelNotices();
  q.announceSkill(SKILLS.Archery, 26, 0);
  q.announceLevel(6, 1);            // the game's own order
  let rows = q.frame(2, { owed: true });
  assert.equal(rows.at(-1).kind, NOTICE_LEVEL);
  q.announceSkill(SKILLS.Climbing, 41, 3);
  rows = q.frame(4, { owed: true });
  assert.equal(rows.at(-1).kind, NOTICE_LEVEL, 'still last after the next raise');
  assert.deepEqual(rows.slice(0, -1).map((r) => r.sub), ['41', '26'], 'and the chatter is newest first above it');
});

test('LV2: the sweep keeps the queue from growing across an evening', () => {
  const q = new LevelNotices();
  q.announceSkill(SKILLS.Archery, 26, 0);
  q.announceLevel(6, 0);
  assert.equal(q.sweep(ANNOUNCE_MS - 1, { owed: true }), 2);
  assert.equal(q.sweep(ANNOUNCE_MS, { owed: true }), 1, 'the chatter goes');
  assert.equal(q.sweep(ANNOUNCE_MS, { owed: false }), 0, 'and the level goes with the points');
});

// ── ONE EVENT, ONE FANFARE ───────────────────────────────────────

test('LV2: the window does not replay the fanfare the strip already played', () => {
  // UpdatePlayerValues plays the level-up sound when the rollout mounts
  // (:373) because in DFU the rollout mounts AT the level-up. Here the
  // two moments have come apart - the strip announces where the player
  // earned it, the window arrives when they ask - so the door asks who
  // spoke.
  const q = new LevelNotices();
  assert.equal(q.fanfareOwed(6), true, 'nothing announced yet: the window owes it');
  q.announceLevel(6, 0);
  assert.equal(q.fanfareOwed(6), false, 'announced: the window must not say it twice');
  assert.equal(q.fanfareOwed(7), true, 'a SECOND level earned while the first was unspent still sounds');
  q.sweep(0, { owed: false });
  assert.equal(q.fanfareOwed(6), true, 'and spending clears the latch with the row');
});

test('LV2: both rollout screens take the fanfare as an argument, defaulting to DFU\'s own behaviour', () => {
  const cs = src('src/ui/charsheet.js');
  assert.match(cs, /constructor\(entity, rolls = Math\.random, \{ fanfare = true \} = \{\}\) \{\n\s*if \(fanfare\) audio\.playOneShot\(SOUND\.LevelUp, 1\);/);
  const v = src('src/ui/virtueLevelUp.js');
  assert.match(v, /constructor\(entity, \{ settings = null, rolls = Math\.random, fanfare = true \} = \{\}\)/);
  assert.match(v, /if \(fanfare\) audio\.playOneShot\(SOUND\.LevelUp, 1\);/);
  // ...and the door is the one caller that ever passes false.
  const door = src('src/ui/charSheetDoor.js');
  assert.match(door, /const fanfare = levelNotices\.fanfareOwed\(deps\.entity\?\.pendingLevel \?\? null\);/);
});

// ── THE SEAMS, AND THE FORK THIS SLICE IS ABOUT ──────────────────

test('LV2: the ENHANCED skin notifies and does NOT open the window; the classic one is untouched', () => {
  destroyLevelNotices();
  const entity = { level: 5, pendingLevel: 6, readyToLevelUp: true };
  const said = [];
  let opened = 0;
  // Node has no `document`, which is the classic lane's own guard - so
  // this is the CLASSIC arm, and it must be exactly what the hosts did
  // before this slice: the line, then the sheet.
  const played = withSounds(() => {
    assert.equal(announceLevelUp(entity, { say: (m) => said.push(m), open: () => { opened += 1; } }), false);
  });
  assert.deepEqual(said, ['You have gained a level!']);
  assert.equal(opened, 1, 'the classic skin still opens the sheet where DFU opens it');
  assert.deepEqual(played, [], 'and the WINDOW plays its own fanfare on that lane, as it always has');
  assert.equal(levelNotices.rows.length, 0, 'nothing was queued');

  // The same for the two smaller events.
  assert.equal(announceSkillRaise(SKILLS.Archery, 26, { say: (m) => said.push(m) }), false);
  assert.equal(said.at(-1), 'Your Archery skill has improved.', 'the popup column keeps its line');
  const rows = [];
  assert.equal(announceMastery(SKILLS.LongBlade, { box: (r) => rows.push(r), rows: ['mastered'] }), false);
  assert.deepEqual(rows, [['mastered']], 'and the mastery keeps its click-anywhere box');
});

test('LV2: the ENHANCED skin ANNOUNCES, and the window does not open itself', () => {
  // THE MUTANT THAT SURVIVED THE FIRST SUITE, and the reason the three
  // seams take a `doc`: under node every call took the classic arm
  // because `typeof document === 'undefined'`, so the arm this whole
  // slice is about was unreachable and "the window opens itself again"
  // could not be failed by anything.
  destroyLevelNotices();
  const doc = fakeDoc();
  const entity = { level: 5, pendingLevel: 6, readyToLevelUp: true };
  const said = [];
  let opened = 0;
  const played = withSounds(() => {
    assert.equal(announceLevelUp(entity, { say: (m) => said.push(m), open: () => { opened += 1; }, now: 0, doc }), true);
  });
  assert.equal(opened, 0, 'NOTIFY, THEN YOU CHOOSE - nothing is put over the player');
  assert.deepEqual(said, [], 'and the popup column is not used either: the strip is the announcement');
  assert.deepEqual(played, [SOUND.LevelUp], 'the fanfare plays HERE, where the level was earned');
  assert.equal(entity.readyToLevelUp, true, 'and the level stays owed, exactly where DFU leaves it');
  const rows = levelNotices.frame(1, { owed: true });
  assert.deepEqual(rows.map((r) => r.kind), [NOTICE_LEVEL]);
  assert.equal(rows[0].sub, 'Level 6', 'naming the level the player is rising TO');

  // ...and the two smaller events take the same fork.
  assert.equal(announceSkillRaise(SKILLS.Archery, 26, { say: (m) => said.push(m), now: 1, doc }), true);
  assert.deepEqual(said, [], 'a raise leaves the popup column');
  const boxes = [];
  assert.equal(announceMastery(SKILLS.LongBlade, { box: (r) => boxes.push(r), rows: ['x'], now: 1, doc }), true);
  assert.deepEqual(boxes, [], 'and the mastery box does not interrupt');
  assert.deepEqual(levelNotices.frame(2, { owed: true }).map((r) => r.kind).sort(),
    [NOTICE_LEVEL, NOTICE_MASTERY, NOTICE_SKILL].sort());
  destroyLevelNotices();
});

test('LV2: the strip is the ONE call all four hosts already make, and the fork is not in any of them', () => {
  // THE FOUR HOSTS RULE. Every level-up arm in the tree goes through
  // the seam, so the answer to "does the window open itself" is
  // written once.
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) {
    const s = src(host);
    assert.match(s, /import \{ announceLevelUp \} from '\.\.\/ui\/levelNotice\.js'/, `${host} takes the seam`);
    assert.match(s, /announceLevelUp\(playerEntity, \{/, `${host} announces through it`);
    assert.doesNotMatch(s, /onLevelUp: \(\) => townTalk\.showOverlay\(makeCharSheetWindow\(\)\)/,
      `${host} no longer opens the window from a level-up arm`);
  }
  // ...and every `open` thunk is still the HOST's own, because only a
  // host knows how to put a window in its slot.
  assert.match(src('src/scenes/world.js'), /open: \(\) => townTalk\.showOverlay\(makeCharSheetWindow\(\)\)/);
  assert.match(src('src/scenes/dungeonContext.js'), /open: \(\) => api\.toggleCharSheet\(\)/);
  assert.match(src('src/scenes/worldModes.js'), /announceLevelUp\(playerEntity, \{ say, open: \(\) => \{/);
  // The HUD drives the paint on the one host-agnostic call.
  assert.match(src('src/ui/hud.js'), /drawLevelNotices\(\{ hidden: cursorActive \|\| !hudRenderEnabled\(\) \}\);/);
  // ...and the raises and the mastery go through the same module.
  const shared = src('src/scenes/shared.js');
  assert.match(shared, /import \{ announceSkillRaise, announceMastery \} from '\.\.\/ui\/levelNotice\.js'/);
  assert.match(shared, /announceMastery\(id, \{ box, rows: plainLines\(lines\?\.\(MASTERY_TEXT_ID\)\) \}\);/);
  assert.match(shared, /announceSkillRaise\(id, skillValue\(entity, id\), \{ say \}\)/);
  assert.match(shared, /audio\.playOneShot\(SOUND\.ArenaFanfareLevelUp, 1\);/, 'the mastery fanfare stays in BOTH lanes');
});

test('LV2: the key it names is the REGISTRY\'s, and the lookup has one home', () => {
  const store = loadOrCreateBindings();
  const code = codeForAction(store, 'CharacterSheet');
  assert.ok(code, 'the sheet has a key');
  assert.equal(actionForCode(store, code), 'CharacterSheet', 'and the inverse round-trips');
  assert.equal(typeof sheetKeyText(), 'string');
  assert.ok(sheetKeyText().length > 0);
  // A literal would be the bug FIX-F and MAC-C both found one layer
  // down: a rebound key that the screen still names by its default.
  const n = src('src/ui/levelNotice.js');
  assert.doesNotMatch(n, /'F5'/);
  assert.match(n, /codeForAction\(bindings\(\), 'CharacterSheet'\)/);
  assert.equal(codeForAction(store, 'NotAnAction'), null);
  assert.equal(codeForAction(null, 'CharacterSheet'), null, 'no store is no crash');
});

// ── THE PAINT ────────────────────────────────────────────────────

const flat = (n) => (n.children?.length ? n.children.flatMap(flat) : [n.textContent]).filter(Boolean);
const texts = (host) => host.children.map((row) => flat(row).join(' '));

test('LV2: the strip paints what the frame says, and takes itself down when there is nothing', () => {
  destroyLevelNotices();
  const doc = fakeDoc();
  // Nothing owed and nothing announced: no element at all. A HUD
  // surface that mounts an empty box is a box a player sees.
  assert.equal(drawLevelNotices({ owed: false, now: 0, doc }), null);
  assert.equal(doc.body.children.length, 0);

  levelNotices.announceLevel(6, 0);
  levelNotices.announceSkill(SKILLS.Archery, 26, 0);
  const host = drawLevelNotices({ owed: true, now: 1, doc });
  assert.ok(host);
  assert.equal(host.attrs.role, 'status', 'it is read aloud, because its whole job is to tell you something');
  assert.equal(host.attrs['aria-live'], 'polite');
  assert.equal(host.children.length, 2);
  assert.equal(host.children.at(-1).className.includes('lv-note-level'), true, 'the level is last');
  assert.ok(texts(host).at(-1).includes('You have risen'));
  // THE KEY CHIP IS THE LEVEL'S ALONE: a skill line with a key on it
  // would read as an instruction.
  assert.equal(host.children[0].children.length, 2, 'gem + body');
  assert.equal(host.children.at(-1).children.length, 3, 'gem + body + key');

  // The HUD's hide gate empties it rather than skipping the call
  // (AUDIT 64 F37: a DOM overlay stays painted unless told otherwise).
  assert.equal(drawLevelNotices({ owed: true, hidden: true, now: 2, doc }), null);
  assert.equal(host.removed, true, 'and the element goes with it');
  destroyLevelNotices();
});

test('LV2: the paint is UPDATED, not rebuilt - a still frame costs one string compare', () => {
  destroyLevelNotices();
  const doc = fakeDoc();
  levelNotices.announceLevel(6, 0);
  const first = drawLevelNotices({ owed: true, now: 0, doc });
  const again = drawLevelNotices({ owed: true, now: 1, doc });
  assert.equal(again, first, 'the same element, untouched');
  assert.equal(doc.body.children.length, 1, 'and no second host');
  // ...and a frame that CHANGED repaints: the standing fold is a
  // different row and must reach the screen.
  const folded = drawLevelNotices({ owed: true, now: ANNOUNCE_MS, doc });
  assert.equal(folded, first);
  assert.ok(texts(first).at(-1).includes(AWAITS_TITLE));
  destroyLevelNotices();
  assert.equal(levelNotices.rows.length, 0);
});

test('LV2: the owed flag is the PLAYER\'s, read live rather than remembered', () => {
  // The default argument is the whole point: a level spent by the
  // window, by the font-less escape, by a headless roll or by a load
  // takes the reminder with it, and none of those roads knows this
  // module exists.
  assert.equal(typeof levelOwed, 'function');
  assert.equal(levelOwed({ readyToLevelUp: true }), true);
  assert.equal(levelOwed({}), false);
  assert.equal(levelOwed(null), false);
  const n = src('src/ui/levelNotice.js');
  assert.match(n, /export const levelOwed = \(e = playerEntity\) => !!e\?\.readyToLevelUp;/);
  assert.match(n, /owed = levelOwed\(\)/, 'and the paint takes it by default');
});

test('LV2: the element reads no game data, and says so in the port\'s own words', () => {
  const n = src('src/ui/levelNotice.js');
  assert.doesNotMatch(n, /^import[^\n]*(textRsc|formats\/|variantLinesById)/m);
  assert.equal(RISEN_TITLE.length > 0 && AWAITS_TITLE.length > 0 && MASTERED_TITLE.length > 0, true);
  assert.notEqual(RISEN_TITLE, AWAITS_TITLE);
  assert.equal(LEVEL_NOTICE_ID, 'enhanced-levelnotice');
  // The mastery's own TEXT.RSC rows stay with the CLASSIC box, which
  // is the lane that has them: the strip names the skill instead.
  assert.match(src('src/ui/levelNotice.js'), /if \(rows\?\.length\) box\?\.\(rows\);/);
});
