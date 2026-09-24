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
import { bonusPoolFor, applyLevelUp, LEVELUP_BONUS_POOL_MIN, LEVELUP_BONUS_POOL_MAX } from '../src/systems/advancement.js';
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
 *  createElement, className, textContent, setAttribute, append,
 *  prepend and remove, and nothing else.
 *
 *  AUDIT LV2 F4: it MODELS `parentNode`, because the strip now asks
 *  where it is hanging (ui/levelNotice.js's rehome takes it home to
 *  `.hud-bottom` when the HUD has mounted one). A fake whose append
 *  left `parentNode` undefined answered "somewhere else" on every
 *  frame and the strip was re-appended sixty times a second - which
 *  the still-frame pin below caught, and which is the fake's fault
 *  rather than the module's: a real node knows its parent. */
function fakeDoc() {
  const make = (tag) => {
    const n = {
      tag, className: '', textContent: '', attrs: {}, children: [], parentNode: null,
      setAttribute(k, v) { this.attrs[k] = v; },
      append(...kids) { for (const k of kids) { k.remove?.(); k.parentNode = this; this.children.push(k); } },
      prepend(...kids) { for (const k of kids.reverse()) { k.remove?.(); k.parentNode = this; this.children.unshift(k); } },
      remove() {
        const at = n.parentNode?.children?.indexOf(n) ?? -1;
        if (at >= 0) n.parentNode.children.splice(at, 1);
        n.parentNode = null;
        n.removed = true;
      },
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

// ── AUDIT LV2 (2026-09-19), the pre-merge sweep ───────────────────

test('AUDIT LV2 (reopened): the bonus pool is the LEVEL\'s, so re-opening the window cannot re-roll it', () => {
  // AUDIT LV2 recorded this rather than fixing it - FormulaHelper's
  // 4..6 draw is taken at the rollout's setup in DFU too. Mac reopened
  // it: "Yes fucking fix it." The reason it is LV2's to close is that
  // LV2 is what made it reachable. DFU's own rollout mounts on the
  // character sheet and commits the level AT MOUNT, so there is never
  // an unspent level to re-open on; the enhanced window is a thing the
  // player OPENS, and `readyToLevelUp` stays set until they spend.
  const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
  const e = { level: 5, readyToLevelUp: true, pendingLevel: 6, stats: stats(), health: 40, maxHealth: 40, career: { hitPointsPerLevel: 8, primarySkills: [] } };
  // SIX OPENS, each handed a roll that would answer differently.
  const seen = [];
  for (let i = 0; i < 6; i++) seen.push(bonusPoolFor(e, () => i / 6));
  assert.equal(new Set(seen).size, 1, `re-opening re-rolled the pool: ${seen.join(',')}`);
  assert.ok(seen[0] >= LEVELUP_BONUS_POOL_MIN && seen[0] <= LEVELUP_BONUS_POOL_MAX, 'and it is still FormulaHelper.BonusPool');
  assert.equal(e.pendingBonusPool, seen[0], 'remembered on the entity, beside pendingLevel');

  // SPENDING IT clears the pool with the level, so the NEXT level is a
  // fresh draw and not this one again.
  applyLevelUp(e, (st, pool) => { st.strength += pool; }, () => 0.5, e.pendingBonusPool);
  assert.equal(e.readyToLevelUp, false);
  assert.equal(e.pendingBonusPool, null, 'the pool is not pending when the level is not');
  assert.equal(bonusPoolFor(e, () => 0.99), LEVELUP_BONUS_POOL_MAX, 'a new level draws again');

  // ...and the OGHMA arm clears it too: a level owed UNDER the book is
  // pending, and the book's thirty is not this draw.
  const o = { level: 5, readyToLevelUp: true, pendingLevel: 6, pendingBonusPool: 5, oghmaLevelUp: true, stats: stats(), health: 40, maxHealth: 40, career: { hitPointsPerLevel: 8, primarySkills: [] } };
  applyLevelUp(o, (st, pool) => { st.strength += pool; }, () => 0.5);
  assert.equal(o.pendingBonusPool, null);

  // IT RIDES THE SAVE, or a save and a load would be the same exploit
  // through a slower door.
  assert.match(src('src/systems/save.js'), /'readyToLevelUp', 'pendingLevel', 'pendingBonusPool', 'chargenDone',/);
  // ...and neither screen rolls one of its own any more.
  assert.doesNotMatch(src('src/ui/charsheet.js'), /LEVELUP_BONUS_POOL_MIN \+ Math\.floor\(rolls\(\)/);
});

test('LV2 FIX: EVERY route to the sheet asks the door, not just the key', () => {
  // Mac: "when you close the levelup screen without adding stat points
  // you cant open it again." LV2's own records say "every route to the
  // sheet - the key, the dial's Stats arm, the pause page - is already
  // this door", and I wrote that sentence without checking two of the
  // three. Only the KEY went through `createCharSheetWindow`. The
  // dial's Stats arm and the pause page both ran
  // `togglePause({ at: 'stats' })`, and that page is built from
  // `sheetModel` in ui/enhancedMenu.js, which has never read
  // `readyToLevelUp` - so the route this skin most invites a player to
  // use answered an owed level with the ordinary sheet, every time,
  // with no way back to it.
  //
  // The enhanced level-up window CANNOT close itself without spending
  // (ui/enhancedLevelUp.js's only `onExit()` is behind `ascend`), so
  // every close is something else taking the slot - a pause, a map, a
  // peer's window - and after one of those the dial is exactly where a
  // player reaches. Pinned in all four hosts, because a route that
  // forgets is the whole finding.
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) {
    const h = src(host);
    assert.match(h, /import \{[^}]*levelOwed[^}]*\} from '\.\.\/ui\/levelNotice\.js'/, `${host} takes the live read`);
    assert.match(h, /openSheetPage[^\n]*levelOwed\(playerEntity\)/,
      `${host}'s Stats arm still goes straight to the pause page with a level owed`);
    // ...and it opens the SHEET door, which is the one that answers with
    // the Ascension - never a second copy of that fork.
    assert.match(h, /openSheetPage[^\n]*toggleCharSheet\(\)/, `${host} must reach the door, not rebuild the fork`);
  }
  // The pause page itself is still the ordinary sheet, which is right:
  // it is the page for a character who owes nothing.
  assert.doesNotMatch(src('src/ui/enhancedMenu.js'), /readyToLevelUp/,
    'the menu stays a VIEW - the routing decision belongs to the hosts, at the door');
});

test('AUDIT LV2 F1: a door with no caller says so, rather than naming one', () => {
  // This module's teardown named "ui/hud.js's own destroy path", and
  // ui/hud.js has no destroy path - the same false caller AUDIT FONT
  // F12 struck from ui/enhancedHudText.js's twin. The enhanced skin's
  // elements live as long as the page does; every skin and scene
  // change in this port ends in location.replace.
  assert.doesNotMatch(src('src/ui/hud.js'), /destroyLevelNotices/);
  for (const f of ['src/ui/hud.js', 'src/scenes/world.js', 'src/scenes/exterior.js',
    'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js', 'src/ui/charSheetDoor.js']) {
    assert.doesNotMatch(src(f), /destroyLevelNotices/, `${f} would be a caller this note must then name`);
  }
  const doc = src('src/ui/levelNotice.js').slice(src('src/ui/levelNotice.js').indexOf('export function destroyLevelNotices') - 900);
  assert.match(doc, /TESTS/, 'so the note names the callers it actually has');
});

test('AUDIT LV2 F2: an unspent level is announced ONCE, not once per rest', () => {
  // DFU RE-OFFERS the sheet on every later pass while the level is
  // unspent - RaiseSkills' tail is outside the skill loop (:1413) and
  // `checkForLevelUp` stays true while `level` is behind the
  // calculated one (systems/advancement.js:174, and its own comment
  // says so). Re-opening a window is that law. Re-ANNOUNCING is not:
  // measured before the fix, three rest passes on ONE unspent level
  // played three fanfares and knocked the standing reminder back into
  // news each time.
  destroyLevelNotices();
  const doc = fakeDoc();
  const entity = { level: 5, pendingLevel: 6, readyToLevelUp: true };
  const first = withSounds(() => { announceLevelUp(entity, { now: 0, doc }); });
  assert.deepEqual(first, [SOUND.LevelUp], 'the level the player just earned sounds');
  assert.equal(levelNotices.frame(0, { owed: true })[0].title, RISEN_TITLE);
  // ...it folds, as an announcement must.
  assert.equal(levelNotices.frame(ANNOUNCE_MS + 1, { owed: true })[0].title, AWAITS_TITLE);
  // ...and now the next two passes, with the level still owed.
  const again = withSounds(() => {
    announceLevelUp(entity, { now: ANNOUNCE_MS + 1, doc });
    announceLevelUp(entity, { now: ANNOUNCE_MS * 4, doc });
  });
  assert.deepEqual(again, [], 'a level already announced has nothing new to say');
  assert.equal(levelNotices.frame(ANNOUNCE_MS * 4, { owed: true })[0].title, AWAITS_TITLE,
    'and the reminder it put up is still a reminder');

  // THE CLASSIC LANE KEEPS DFU'S RE-OFFER WHOLE: no document, so every
  // pass says its line and opens the sheet again, as it always has.
  let opened = 0;
  const said = [];
  announceLevelUp(entity, { say: (m) => said.push(m), open: () => { opened += 1; } });
  announceLevelUp(entity, { say: (m) => said.push(m), open: () => { opened += 1; } });
  assert.equal(opened, 2, 'the classic skin re-offers the sheet, which is DFU (:1413)');
  assert.equal(said.length, 2);

  // ...and a level that was SPENT and earned again is news again: the
  // sweep drops the latch with the flag it describes.
  levelNotices.sweep(ANNOUNCE_MS * 5, { owed: false });
  const fresh = withSounds(() => { announceLevelUp({ level: 6, pendingLevel: 7, readyToLevelUp: true }, { now: ANNOUNCE_MS * 5, doc }); });
  assert.deepEqual(fresh, [SOUND.LevelUp], 'a new level is a new event');
  destroyLevelNotices();
});

test('AUDIT LV2 F4: the strip hangs in the HUD\'s own bottom column, not on the body', () => {
  // It shipped body-level at a flat `bottom: 150px`, and `.hud-bottom`
  // grows upward with its CONTENT (breath, effects, needs) and again
  // with `--hud-scale` - so with a live block the strip sat 19px into
  // the vitals at scale 1 on a phone and 154px into them at scale 2.
  // QS3's rule (ui/enhancedHud.js:374-377) is that a CENTRED thing
  // above the vitals belongs IN the column; only a CORNER does the
  // arithmetic. tools/levelUpProbe.mjs measures the boxes; this pins
  // where the node goes.
  destroyLevelNotices();
  const doc = fakeDoc();
  const block = doc.createElement('div');
  block.className = 'hud-bottom';
  const bars = doc.createElement('div');
  block.append(bars);
  doc.querySelector = (sel) => (sel === '.hud-bottom' ? block : null);
  const entity = { level: 5, pendingLevel: 6, readyToLevelUp: true };
  announceLevelUp(entity, { now: 0, doc });
  const host = drawLevelNotices({ owed: true, now: 0, doc });
  assert.equal(host.parentNode, block, 'the strip hangs in the bottom column');
  assert.equal(block.children[0], host, 'as its FIRST row, above every row the HUD carries');
  assert.equal(doc.body.children.includes(host), false, 'and not on the body beside it');
  // A STILL FRAME DOES NOT MOVE IT, and neither does a changed one.
  drawLevelNotices({ owed: true, now: 1, doc });
  drawLevelNotices({ owed: true, now: ANNOUNCE_MS + 1, doc });
  assert.equal(block.children.length, 2, 'no second host, and the bars are still there');
  assert.equal(block.children[0], host);

  // NO HUD YET - the frame before ui/enhancedHud.js mounts one, and
  // the tests' own document - falls back to the body and is taken home
  // on the frame the column appears.
  destroyLevelNotices();
  const d2 = fakeDoc();
  announceLevelUp(entity, { now: 0, doc: d2 });
  const h2 = drawLevelNotices({ owed: true, now: 0, doc: d2 });
  assert.equal(h2.parentNode, d2.body, 'nowhere else to hang, so the body');
  const late = d2.createElement('div');
  late.className = 'hud-bottom';
  d2.querySelector = (sel) => (sel === '.hud-bottom' ? late : null);
  drawLevelNotices({ owed: true, now: 1, doc: d2 });
  assert.equal(h2.parentNode, late, 'and home the moment there is one');
  assert.equal(d2.body.children.includes(h2), false);
  destroyLevelNotices();
});

test('AUDIT LV2 F5: the level\'s row names a key only when there IS one', () => {
  // `buttonText(null)` is KeyCode.None's own string, "NONE"
  // (systems/controlsConfig.js:267), so a player who cleared the sheet
  // binding was handed a plate reading A LEVEL AWAITS / NONE.
  const store = loadOrCreateBindings();
  assert.notEqual(codeForAction(store, 'CharacterSheet'), null, 'the default build binds it');
  assert.match(sheetKeyText(), /\S/);
  assert.notEqual(sheetKeyText(), 'NONE', 'and the chip names that key, not None');
  // The unbound answer is the one the row must not print.
  assert.equal(codeForAction({ primary: new Map(), secondary: new Map() }, 'CharacterSheet'), null);
  // BOTH arms carry the guard - the click AND the key chip. One regex
  // over the file matched the click's line alone, so the chip could lose
  // its guard and the pin still passed (the record survived, and said so).
  const ln = src('src/ui/levelNotice.js');
  assert.match(ln, /const clickable = r\.kind === NOTICE_LEVEL && codeForAction\(bindings\(\), 'CharacterSheet'\) != null;/);
  assert.match(ln, /if \(r\.kind === NOTICE_LEVEL && codeForAction\(bindings\(\), 'CharacterSheet'\) != null\) \{/, 'the key chip is guarded too');
});

test('LV2: the strip is the ONE call all four hosts already make, and the fork is not in any of them', () => {
  // THE FOUR HOSTS RULE. Every level-up arm in the tree goes through
  // the seam, so the answer to "does the window open itself" is
  // written once.
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) {
    const s = src(host);
    // The seam, however many of this module's reads the host takes -
    // LV2 FIX added `levelOwed` beside it, and a pin that spelled the
    // whole import line would have failed on a file that takes MORE of
    // the right thing.
    assert.match(s, /import \{[^}]*\bannounceLevelUp\b[^}]*\} from '\.\.\/ui\/levelNotice\.js'/, `${host} takes the seam`);
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
  assert.match(shared, /announceMastery\(id, \{ box, rows: \(\) => expandRowValues\(plainLines\(lines\?\.\(MASTERY_TEXT_ID\)\), null\) \}\);/);
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
  //
  // AUDIT LV2 F3: and the classic lane is where the record is READ.
  // This pin used to check only that levelNotice.js imports no reader,
  // which the module never did - while scenes/shared.js handed it
  // `plainLines(lines(MASTERY_TEXT_ID))` BY VALUE, so record 4020 came
  // off disk on the enhanced lane too and was dropped. Driven, not
  // read: the thunk must not be called when the strip takes it.
  assert.match(n, /const r = typeof rows === 'function' \? rows\(\) : rows;/);
  destroyLevelNotices();
  let reads = 0;
  const calls = [];
  const read = () => { reads += 1; return ['MASTERED']; };
  // THE ENHANCED ARM (a document, as the two pins above fork it).
  assert.equal(announceMastery(SKILLS.LongBlade, { doc: fakeDoc(), box: (r) => calls.push(r), rows: read, now: 0 }), true);
  assert.equal(reads, 0, 'the enhanced lane read TEXT.RSC for a box it never shows');
  assert.equal(calls.length, 0, 'and it must not raise the classic box either');
  // THE CLASSIC ARM (no document, node's own guard).
  assert.equal(announceMastery(SKILLS.LongBlade, { box: (r) => calls.push(r), rows: read, now: 0 }), false);
  assert.equal(reads, 1, 'the classic lane reads it exactly once');
  assert.deepEqual(calls, [['MASTERED']]);
  destroyLevelNotices();
});

// LV3 (Dudey, 2026-09-19: "a button to open the levelup screen again once closed - you can't open it again when
// you level up"). The enhanced skin only. The level's row on the strip is a BUTTON when the sheet action has a key,
// pressing that key through ui/levelUpOpener.js - which is what opens the window in all four hosts - never a host's
// slot.
test('LV3: the level row is a button that presses the sheet key, and the key-less row stays a plain line', async () => {
  const { openLevelUpWindow, levelUpDoorBound } = await import('../src/ui/levelUpOpener.js');
  const sent = [];
  const realKE = globalThis.KeyboardEvent, realDispatch = globalThis.dispatchEvent;
  globalThis.KeyboardEvent = class { constructor(type, init) { this.type = type; Object.assign(this, init); } };
  globalThis.dispatchEvent = (e) => { sent.push(e); return true; };
  try {
    const key = codeForAction(loadOrCreateBindings(), 'CharacterSheet');
    assert.equal(levelUpDoorBound(), true, 'the default build binds the sheet');
    assert.equal(openLevelUpWindow(), true);
    assert.deepEqual(sent.map((e) => [e.type, e.code]), [['keydown', key], ['keyup', key]], 'a tap of the sheet key, down then up');
    assert.equal(sent[0].bubbles, true);

    // ...and the strip's row is the button that does it
    destroyLevelNotices();
    const doc = fakeDoc();
    levelNotices.announceLevel(6, 0);
    const host = drawLevelNotices({ owed: true, now: 1, doc });
    const row = host.children.at(-1);
    assert.equal(row.tag, 'button', 'the level row is a real button');
    assert.equal(row.className.includes('lv-clickable'), true);
    assert.equal(row.children.length, 3, 'still gem + body + key');
    sent.length = 0;
    let stopped = 0;
    row.onclick({ preventDefault() {}, stopPropagation() { stopped++; } });
    assert.deepEqual(sent.map((e) => e.type), ['keydown', 'keyup'], 'a click presses the sheet key');
    assert.equal(stopped, 1, 'and the click never reaches the world behind it');
    // a skill line is a report, not a door
    levelNotices.announceSkill(SKILLS.Archery, 26, 1);
    const both = drawLevelNotices({ owed: true, now: 2, doc });
    const skillRow = both.children.find((c) => c.className.includes('lv-note-skill'));
    assert.ok(skillRow, 'the skill line is on the strip');
    assert.equal(skillRow.tag, 'div', 'a skill row is not a button');
  } finally {
    globalThis.KeyboardEvent = realKE;
    if (realDispatch) globalThis.dispatchEvent = realDispatch; else delete globalThis.dispatchEvent;
    destroyLevelNotices();
  }
});

test('LV3 by source: an UNBOUND sheet action presses nothing and shows no button; the sheet\'s own door is ASCEND, at any time', () => {
  const o = src('src/ui/levelUpOpener.js');
  assert.match(o, /if \(code == null \|\| typeof win\?\.dispatchEvent !== 'function'/, 'no binding, no press - never a stale default');
  assert.match(src('src/ui/levelNotice.js'), /const clickable = r\.kind === NOTICE_LEVEL && codeForAction\(bindings\(\), 'CharacterSheet'\) != null;/);
  assert.match(src('src/ui/levelNotice.js'), /doc\.createElement\(clickable \? 'button' : 'div'\)/);
  assert.match(src('src/ui/enhancedStyle.js'), /button\.lv-note\.lv-clickable \{[^}]*pointer-events: auto;/, 'the strip is pointer-events:none, this row opts back in');

  // THE STATS PAGE CARRIES ONE DOOR TO THIS WINDOW, AND IT IS ALWAYS
  // THERE. Mac, on this package: "the Ascend button needs to be
  // accessible at any time in the character sheet."
  //
  // LV3 arrived with a SECOND door beside it - `['Level up', ...]`,
  // unshifted onto the same row and gated on `readyToLevelUp` - which
  // would put two buttons for one window on the page whenever a level
  // was owed, and nothing there the rest of the time. ASCEND-ANYTIME
  // had already made that page's door unconditional: it opens the real
  // rollout when a level is owed (ui/pauseDoor.js's own branch, which
  // resumes first) and a VIEW of the stars when none is, so the button
  // a player learns is the button that is always there. LV3's opener
  // is still what the STRIP presses, where there is no hooks bag to
  // hand a door through.
  const m = src('src/ui/enhancedMenu.js');
  assert.match(m, /if \(typeof hooks\.openAscend === 'function'\) \{/, 'the page\'s door is handed in, not gated on state');
  assert.doesNotMatch(m, /readyToLevelUp/, 'the Stats page never reads the flag: WHICH screen the door opens is the door\'s question');
  assert.doesNotMatch(m, /doors\.unshift\(\['Level up'/, 'and there is no second, conditional door for the same window');
  assert.match(m, /b\.onclick = \(\) => \{ onAction\('resume'\); fn\(\); \};/, 'the pause window RESUMES first for the doors that LEAVE this page');
});
