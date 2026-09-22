// TILE1/TILE2 — THE SAVE TILE, PINNED WHERE IT THINKS.
//
// Mac: "I want [the Online pane] reserved for a detailed tile based
// design for your saves which will translate to the load character
// pane also. Basically showing your portrait and character
// information."
//
// node cannot draw a tile, and test/enhancedChargen.test.js settled
// what that means here: pin the part that does arithmetic and MEASURE
// the drawn surface in a real browser (tools/saveTileProbe.mjs, 18
// checks, `npm run savetile`). The browser half is where the two real
// faults came from - `.tile` was already the inventory item icon's
// class, and a long slot name ran into a long character name - and
// neither is a thing a source sweep could see.
//
// What is here is what a node test can actually hold: the tile's own
// arithmetic, the fact that ONE tile now serves THREE panes, and the
// seams that make the whole thing drivable at all.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { saveTile, agoText, tileLine, tileWhen, initialOf, CLOUD_STATES, cloudStateOf, saveFromCard } from '../src/ui/saveTile.js';
import { dateFromClassicMinutes, dateString } from '../src/systems/gameDate.js';   // ACC2c: the two calls a LOCAL tile's date comes from, handed to the card's conversion so there is one reading of `gameTime`

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** A Document that does exactly what the tile asks of one - no more,
 *  because a stub that offers more than a Document does lets a call
 *  pass here and fail in a browser. */
function fakeDoc() {
  const make = (tag) => {
    const n = {
      tagName: tag.toUpperCase(), className: '', textContent: '', type: '', disabled: false,
      childNodes: [], onclick: null,
      append(...kids) { for (const k of kids) { k.parent = n; this.childNodes.push(k); } },
      remove() { const i = this.parent?.childNodes.indexOf(this); if (i >= 0) this.parent.childNodes.splice(i, 1); },
    };
    return n;
  };
  return { createElement: make };
}
const walk = (n, out = []) => { out.push(n); for (const k of n.childNodes ?? []) walk(k, out); return out; };
const byClass = (n, cls) => walk(n).filter((x) => String(x.className).split(' ').includes(cls));
const text = (n, cls) => byClass(n, cls)[0]?.textContent ?? null;

const SAVE = {
  name: 'Nystul', race: 'Breton', career: 'Battlemage', level: 12,
  health: 84, maxHealth: 120, gold: 14230,
  when: '17th of Hearthfire, 3E 405', hour: '21:40', saveName: 'QuickSave',
};

test('TILE1: the tile carries FACTS ABOUT A CHARACTER and no prose', () => {
  const t = saveTile(fakeDoc(), SAVE, { actions: [{ label: 'Load', primary: true }] });
  assert.equal(walk(t).find((n) => n.tagName === 'H3').textContent, 'Nystul');
  assert.equal(text(t, 'svsub'), 'Breton · Battlemage · level 12');
  assert.equal(text(t, 'svwhen'), '17th of Hearthfire, 3E 405 · 21:40');
  assert.equal(text(t, 'svslot'), 'QuickSave');
  const dd = walk(t).filter((n) => n.tagName === 'DD').map((n) => n.textContent);
  assert.deepEqual(dd, ['84 / 120', '14,230']);

  // Mac, on the account card two hours before this one: "Nothing is
  // centered, there's uneeded text explaining what an account is". So
  // the tile has NO paragraph that explains anything - every string on
  // it is a fact about this save, and the pin holds that by looking for
  // the shape the explanation would take.
  const src = rd('src/ui/saveTile.js');
  const strings = [...src.matchAll(/el\('p', '[a-z ]*', '([^'\n]{25,})'\)/g)].map((m) => m[1]);
  assert.deepEqual(strings, [], `the tile grew prose: ${strings.join(' | ')}`);
});

test('TILE1: a missing field drops out rather than leaving a dangling separator', () => {
  assert.equal(tileLine({ race: 'Nord' }), 'Nord');
  assert.equal(tileLine({ race: 'Nord', level: 3 }), 'Nord · level 3');
  assert.equal(tileLine({ career: 'Bard' }), 'Bard');
  assert.equal(tileLine({}), '');
  assert.equal(tileLine(null), '');
  assert.equal(tileWhen({ when: 'x' }), 'x');
  assert.equal(tileWhen({}), '');
  // ...and a save with nothing on it at all still draws a tile rather
  // than throwing on the pane that lists it.
  const bare = saveTile(fakeDoc(), {}, {});
  assert.equal(walk(bare).find((n) => n.tagName === 'H3').textContent, 'Unnamed');
  assert.equal(saveTile(fakeDoc(), null, {}) && true, true);
});

test('TILE1: a tile with no portrait draws the character\'s INITIAL, and a promise never blocks the tile', async () => {
  const none = saveTile(fakeDoc(), SAVE, {});
  assert.equal(text(none, 'svinitial'), 'N', 'a letter reads as somebody; a hole reads as a broken image');
  assert.equal(initialOf({ name: '  ' }), '?');
  assert.equal(initialOf({}), '?');

  // A CANVAS HANDED IN DIRECTLY replaces the initial at once.
  const art = { tagName: 'CANVAS', className: '', childNodes: [], append() {} };
  const now = saveTile(fakeDoc(), SAVE, { face: art });
  assert.equal(byClass(now, 'svinitial').length, 0);
  assert.ok(walk(now).includes(art));

  // A PROMISE DOES NOT BLOCK THE TILE - the pane is on screen first and
  // the face lands later, because a list that waits on ten CIF reads is
  // a menu that opens late.
  let settle;
  const later = saveTile(fakeDoc(), SAVE, { face: new Promise((r) => { settle = r; }) });
  assert.equal(text(later, 'svinitial'), 'N', 'the tile is drawn before the art');
  settle(art);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(byClass(later, 'svinitial').length, 0, 'and the initial gives way when it lands');

  // A FACE THAT NEVER ARRIVES IS AN ORDINARY TILE, not a rejection that
  // escapes into the pane.
  const failed = saveTile(fakeDoc(), SAVE, { face: Promise.reject(new Error('no CIF')) });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(text(failed, 'svinitial'), 'N');
});

test('TILE2/ACC2: the cloud line, and the state that draws NONE of it', () => {
  // NO ACCOUNT, NO LINE. ACC0's wall is at cloud saves, and a player
  // who has not asked for one is not told about it on every tile.
  for (const cloud of [null, { state: 'off' }, {}]) {
    assert.equal(byClass(saveTile(fakeDoc(), SAVE, { cloud }), 'svcloud').length, 0, JSON.stringify(cloud));
  }
  // ACC2c appended `only` (a save whose ONLY copy is the backup), the same
  // way AUDIT-312 F2 appended `wait`: at the END, so nothing that reads this
  // list positionally moves, and named here so a seventh cannot arrive quietly.
  assert.deepEqual(CLOUD_STATES, ['off', 'none', 'saved', 'busy', 'bad', 'wait', 'only']);

  assert.equal(text(saveTile(fakeDoc(), SAVE, { cloud: { state: 'none' } }), 'svsay'), 'Not backed up');
  assert.equal(text(saveTile(fakeDoc(), SAVE, { cloud: { state: 'saved' } }), 'svsay'), 'Backed up');
  assert.equal(text(saveTile(fakeDoc(), SAVE, { cloud: { state: 'saved', when: '2 hours ago' } }), 'svsay'), 'Backed up · 2 hours ago');
  assert.equal(text(saveTile(fakeDoc(), SAVE, { cloud: { state: 'busy' } }), 'svsay'), 'Backing up…');

  // A REFUSAL IS THE SERVICE'S OWN SENTENCE, handed in: this file owns
  // no words about why a backup failed, which is what stops a second
  // sentence existing for a refusal accountClient.js already explains.
  assert.equal(text(saveTile(fakeDoc(), SAVE, { cloud: { state: 'bad', why: 'Your cloud backup is full.' } }), 'svsay'), 'Your cloud backup is full.');
  assert.equal(text(saveTile(fakeDoc(), SAVE, { cloud: { state: 'bad' } }), 'svsay'), 'Could not back up');
  // ...AND THE SAME FOR A WAIT (AUDIT-312 F2), which is a sentence to
  // read rather than a failure or a button.
  assert.equal(text(saveTile(fakeDoc(), SAVE, { cloud: { state: 'wait', why: 'Load this save once, then it can be backed up.' } }), 'svsay'),
    'Load this save once, then it can be backed up.');
  // a state nobody knows is not a crash and is not "backed up"
  assert.equal(text(saveTile(fakeDoc(), SAVE, { cloud: { state: 'frobnicated' } }), 'svsay'), 'Not backed up');
});

test('AUDIT-312 F3: the cloud line\'s STATE is decided where a pin can reach it', () => {
  // WHY THIS PIN EXISTS. This arithmetic lived inside
  // `ui/enhancedMenu.js` - DOM, a boot, and nothing node can drive - so
  // the audit's mutation campaign put three mutants of it through the
  // WHOLE SUITE and all three survived: an unfinished upload reading as
  // a finished backup, a listing never re-asked after a push, and every
  // character's QuickSave sharing one slot key. Each is a thing a
  // player is told about their own saves.
  const now = 1_758_400_000;
  const card = { bytes: 4096, updatedAt: now - 7200 };

  // NO ACCOUNT, NO LINE - before anything else is asked.
  assert.deepEqual(cloudStateOf({ signedIn: false, characterId: 'c1', card, nowS: now }),
    { state: 'off', when: null, error: null });
  assert.equal(cloudStateOf({}).state, 'off');

  // A LEGACY CARD IS A WAIT, and it carries the WORD - the sentence
  // belongs to accountClient.js's one table.
  assert.deepEqual(cloudStateOf({ signedIn: true, characterId: null, nowS: now }),
    { state: 'wait', when: null, error: 'no-character' });

  // `bytes` STAYS 0 UNTIL THE DATA LANDS. A card alone is an upload
  // that died between the row and the blob, and reading it as a backup
  // is how a player trusts a restore that cannot happen.
  assert.equal(cloudStateOf({ signedIn: true, characterId: 'c1', card: { bytes: 0, updatedAt: now }, nowS: now }).state, 'none');
  assert.equal(cloudStateOf({ signedIn: true, characterId: 'c1', card: {}, nowS: now }).state, 'none');
  assert.equal(cloudStateOf({ signedIn: true, characterId: 'c1', card: null, nowS: now }).state, 'none');

  const saved = cloudStateOf({ signedIn: true, characterId: 'c1', card, nowS: now });
  assert.deepEqual(saved, { state: 'saved', when: '2 hours ago', error: null });

  // BUSY WINS OVER A STALE REFUSAL: a retry in flight is not a failure,
  // and the failure it is retrying is the one still in the latch.
  assert.equal(cloudStateOf({ signedIn: true, characterId: 'c1', card, busy: true, error: 'too-large', nowS: now }).state, 'busy');
  assert.deepEqual(cloudStateOf({ signedIn: true, characterId: 'c1', card, error: 'too-large', nowS: now }),
    { state: 'bad', when: null, error: 'too-large' });

  // ...AND THE TWO THINGS ONLY THE MENU CAN DO, held where they live.
  const menu = rd('src/ui/enhancedMenu.js');
  // THE SLOT KEY IS THE SERVICE'S, and it comes from the module that
  // owns "a slot is (character, save name)". The menu's own copy had
  // dropped the character half, which makes every character's QuickSave
  // one slot - one spinner and one error on all of them.
  assert.match(menu, /const cloudKeyOf = \(save\) => slotKeyOf\(save\);/);
  assert.doesNotMatch(menu, /save\.saveName \?\? ''\}`;/, 'the menu writes no second slot key');
  // THE LISTING IS ASKED AGAIN, NEVER PATCHED: one answer about what
  // the cloud holds, and it comes from the cloud.
  assert.match(menu, /if \(r\.ok\) \{ cloudAsked = false; ensureCloud\(\); \}/);
  // ...and the latch is per VISIT, which means a fresh mount clears it.
  assert.match(menu.slice(menu.indexOf('export function mountEnhancedMenu')), /^\s*cloudAsked = false;$/m);
});

test('AUDIT-312 F1: the cloud DELETE has a door, and it asks twice', () => {
  // The route existed, `removeCloudSlot` existed, and nothing called
  // either - while the refusal table already told a player at the bound
  // to "delete a save there to make room". An account at SAVES_MAX
  // could never back up again, and the only sentence it was given named
  // an act the game did not offer.
  const menu = rd('src/ui/enhancedMenu.js');
  assert.match(menu, /removeCloudSlot/, 'the menu calls the delete');
  // ...AND IT SAYS `backup`: the tile already has a Delete, the pane's
  // own, which removes the save from this device. Two buttons reading
  // `Delete` one row apart - one destroying the game, one destroying
  // the copy - is the worst label this menu could carry.
  assert.match(menu, /label: 'Delete backup'/);
  assert.match(menu, /label: 'Delete backup\?'/, 'a destructive act asks twice');
  // IT REMOVES THE COPY AND NEVER THE SAVE. The cloud is a backup, so
  // deleting the backup is not deleting the game.
  const cloud = rd('src/systems/cloudSaves.js');
  const fn = cloud.slice(cloud.indexOf('export const removeCloudSlot'));
  assert.doesNotMatch(fn, /removeItem|setItem/, 'it never touches this device\'s store');
  // ...and the sentence that names it is reachable now.
  assert.match(rd('src/net/accountClient.js'), /'too-many-saves': '[^']*[Dd]elete[^']*'/);
});

test('AUDIT-312 F5: the ten heads stay POSITIONAL - the index IS the identity', () => {
  // `faceIndex` is on the save envelope and it addresses a RECORD
  // NUMBER. The first cut of the extraction ended `.filter(Boolean)`,
  // which COMPACTS - so one record that will not draw shifted every
  // later face down by one, while ui/chargenArt.js's loadFaceSet (the
  // other reader of the same ten records) pushes for every index and
  // never compacts. Two homes that disagree about what index 5 means is
  // the exact drift this module was extracted to prevent.
  const face = rd('src/ui/facePortrait.js');
  assert.match(face, /for \(let i = 0; i < races\.FACES_PER_RACE; i\+\+\) set\.push\(/);
  assert.doesNotMatch(face, /^\s*return set\.filter/m, 'a compacted set is a different index');
  // Both readers already draw something where a face is missing, which
  // is what makes the hole safe to keep.
  assert.match(rd('src/ui/enhancedChargen.js'), /const art = faces\?\.canvases\?\.\[i\];/);
  assert.match(face, /const art = set\[i\] \?\? set\[0\] \?\? null;/);
});

test('TILE2: how long ago, in words a player reads at a glance', () => {
  const now = 1_758_400_000;
  assert.equal(agoText(now, now), 'just now');
  assert.equal(agoText(now - 89, now), 'just now');
  assert.equal(agoText(now - 120, now), '2 minutes ago');
  // ...and the SINGULAR is reachable. It was not: past the 90-second
  // threshold `Math.round(d / 60)` is never 1, so "1 minute ago" was a
  // branch nothing could ever produce. Found by writing the pin.
  assert.equal(agoText(now - 90, now), '1 minute ago');
  assert.equal(agoText(now - 119, now), '1 minute ago');
  assert.equal(agoText(now - 3600, now), '1 hour ago');
  assert.equal(agoText(now - 7200, now), '2 hours ago');
  assert.equal(agoText(now - 3600 * 23, now), '23 hours ago');
  assert.equal(agoText(now - 86400, now), '1 day ago');
  assert.equal(agoText(now - 86400 * 9, now), '9 days ago');
  // A CLOCK THAT RAN BACKWARDS IS NOT A NEGATIVE AGE. The service's
  // stamp and the browser's clock are two clocks, and they disagree.
  assert.equal(agoText(now + 500, now), 'just now');
  for (const bad of [null, undefined, NaN, '5', {}]) assert.equal(agoText(bad, now), '', String(bad));
});

test('TILE2: a disabled action is not wired, and the actions are the PANE\'S - the tile knows no pane', () => {
  let pressed = 0;
  const t = saveTile(fakeDoc(), SAVE, {
    actions: [
      { label: 'Load', primary: true, onClick: () => { pressed++; } },
      { label: 'Delete', onClick: () => { pressed += 10; } },
      { label: 'Nope', disabled: true, onClick: () => { pressed += 100; } },
    ],
  });
  const buttons = walk(t).filter((n) => n.tagName === 'BUTTON');
  assert.deepEqual(buttons.map((b) => b.textContent), ['Load', 'Delete', 'Nope']);
  assert.equal(buttons[0].className, 'act primary');
  assert.equal(buttons[1].className, 'act');
  assert.equal(buttons[2].disabled, true);
  assert.equal(buttons[2].onclick, null, 'a disabled button carries no handler at all');
  buttons[0].onclick(); buttons[1].onclick();
  assert.equal(pressed, 11);

  // THE TILE KNOWS NO PANE. Not "Load", not "Play online", not
  // "Overwrite" - those are the panes' words, and a tile that spelled
  // one would be a tile only one pane could use.
  const src = rd('src/ui/saveTile.js');
  for (const word of ['Play online', 'Overwrite', "'Load'", 'onAction', 'appStorage', 'cloudSaves']) {
    assert.ok(!src.includes(word), `the tile names a pane's own business: ${word}`);
  }
});

test('TILE2: ONE tile for THREE panes, and the classes it draws belong to nobody else', () => {
  const menu = rd('src/ui/enhancedMenu.js');
  // The drift this retired: three hand-rolled copies of the same four
  // lines is how three panes come to disagree about what a save is.
  assert.doesNotMatch(menu, /function slotCard\(/, 'the old per-pane card is gone');
  assert.match(menu, /import \{ saveTile, cloudStateOf, saveFromCard \} from '\.\/saveTile\.js'/);
  // AUDIT-312 F3: and the DECISION comes from there too, rather than
  // being re-inlined into a module no pin can drive. The gate is that
  // the menu asks; the arithmetic itself is pinned above.
  assert.match(menu, /const state = cloudStateOf\(\{/);
  const pane = (from, to) => menu.slice(menu.indexOf(from), menu.indexOf(to));
  for (const [name, from, to] of [
    ['Online', 'function paneOnline(body)', 'function paneLoad(body)'],
    ['Load', 'function paneLoad(body)', '// ── SAVE GAME'],
    ['Save', 'function paneSave(body)', '// ── EXIT (pause only)'],
  ]) assert.match(pane(from, to), /tileGrid\(/, `the ${name} pane draws tiles`);

  // ═══ THE CLASS NAMES ARE THIS TILE'S ALONE ══════════════════════
  //
  // The probe found `.tile` was ALREADY the inventory and trade item
  // icon (30x30, ui/enhancedInventory.js and ui/enhancedTrade.js), so
  // the save tiles were being squashed by a rule written for something
  // else - and every check about their size read 34x34. A source sweep
  // could have caught it and did not, because nobody thought to look.
  // This is that sweep, derived: the classes saveTile.js really puts in
  // the DOM, against every other module that puts classes in the DOM.
  //
  // THE BORROWED VOCABULARY IS EXEMPT AND NAMED: `act`, `acts`,
  // `primary` and `stats` are the skin's own words and are SUPPOSED to
  // be shared - enhancedStyle.js's header says two copies of a design
  // language is how the front door and the rooms drift apart. What may
  // not be shared is a class this tile INVENTS, and `.tile` was exactly
  // that.
  const BORROWED = new Set(['act', 'acts', 'primary', 'stats']);
  const src = rd('src/ui/saveTile.js');
  const mine = new Set([...src.matchAll(/el\('[a-z0-9]+', '([a-z0-9 -]+)'/g)]
    .flatMap((m) => m[1].split(' ')).filter(Boolean));
  for (const m of src.matchAll(/el\('[a-z0-9]+', `([a-z0-9-]+)/g)) mine.add(m[1]);
  for (const b of BORROWED) mine.delete(b);
  assert.ok(mine.size >= 6, `the class walk found only ${[...mine].join(', ')} - it has stopped seeing its subject`);
  const others = readdirSync(new URL('../src/ui', import.meta.url))
    .filter((f) => f.endsWith('.js') && f !== 'saveTile.js');
  for (const f of others) {
    const other = rd(`src/ui/${f}`);
    for (const cls of mine) {
      assert.ok(!new RegExp(`'${cls}'|\`${cls}[\`\\s]`).test(other),
        `ui/${f} also draws a "${cls}" - two modules, one class, and the later CSS rule wins`);
    }
  }
});

test('TILE1: the face has ONE home, and it is not the one chargenArt already owns', () => {
  // The drawing lived inside systems/chargenSession.js, where only the
  // wizard could reach it. The save tile is the second caller, so it
  // moved rather than being copied.
  const session = rd('src/systems/chargenSession.js');
  assert.match(session, /import\('\.\.\/ui\/facePortrait\.js'\)/);
  assert.match(session, /out\.loadFaces = \(raceKey, gender\) => loadFaceCanvases\(raceKey, gender, \{ scale: 2 \}\);/);
  assert.doesNotMatch(session, /CifRciFile/, 'the wizard no longer knows which file a race\'s heads live in');

  // ...AND IT IS NAMED APART FROM chargenArt.js's `loadFaceSet`, which
  // is a different thing under a similar name: that one uploads the
  // same ten records as GL TEXTURES and returns nothing. AUDIT 24's
  // ratchet caught the collision the moment the second one existed.
  const face = rd('src/ui/facePortrait.js');
  assert.match(face, /export async function loadFaceCanvases\(/);
  assert.doesNotMatch(face, /export async function loadFaceSet\(/);
  assert.match(rd('src/ui/chargenArt.js'), /export async function loadFaceSet\(/, 'the other one is still there, which is why the name had to differ');

  // THE IDENTITY THE PORTRAIT NEEDS WAS ALREADY IN THE SAVE - S3c/U9
  // put race, gender and faceIndex on the envelope. Nothing new is
  // stored; the menu's row simply stopped throwing three fields away.
  assert.match(rd('src/systems/save.js'), /'name', 'gender', 'race', 'raceId', 'faceIndex'/);
  const menu = rd('src/ui/enhancedMenu.js');
  assert.match(menu, /race: typeof snap\.race === 'string' \? snap\.race : null,/);
  assert.match(menu, /faceIndex: Number\.isInteger\(snap\.faceIndex\) \? snap\.faceIndex : 0,/);
});

// ── ACC2c: THE SAVE THAT IS ONLY IN THE CLOUD ─────────────────────────────────────────────────────
//
// Mac, asked whether to build it: "And yes".
//
// ACC2 built the backup and nothing could read one back. `pullSlot` was
// written, pinned end to end against the real service, and had ZERO
// CALLERS - so a cleared browser or a second device showed an empty
// save list with the player's games sitting in R2 and nothing on screen
// admitting they existed.

test('ACC2c: a cloud card becomes a tile that INVENTS NOTHING - the card is smaller than a save and the tile says less, with no race, class, level, health, gold or portrait, because none of them was ever uploaded (mutants: a stat invented from a field the card does not carry; the date read as anything but classic minutes; the initial taken from the slot name)', () => {
  // THE CARD IS THE SERVICE'S OWN SHAPE. server-account/src/saves.js
  // keeps eleven columns and this is all of them that describe a game.
  const card = {
    characterId: 'ch-7', saveName: 'Before the lich',
    characterName: 'Nystul', gameTime: 523_000, realTime: 1_700_000_000_000,
    dfuVersion: '0.15.4', saveVersion: 1, bytes: 91_233, shotBytes: 4_100,
    createdAt: 1_700_000_000, updatedAt: 1_700_000_900,
  };
  const save = saveFromCard(card, dateFromClassicMinutes, dateString);

  // WHAT IT CARRIES: the two names, and the moment - derived by the
  // same two calls a local tile's date comes from, because `gameTime`
  // IS classic minutes (systems/saveSlots.js's SaveInfo typedef says
  // so of the field `pushSlot` copies up).
  assert.equal(save.name, 'Nystul');
  assert.equal(save.saveName, 'Before the lich');
  assert.equal(save.characterId, 'ch-7');
  const d = dateFromClassicMinutes(card.gameTime);
  assert.equal(save.when, dateString(d));
  assert.equal(save.hour, `${String(d.hour).padStart(2, '0')}:${String(d.minute).padStart(2, '0')}`);

  // WHAT IT MUST NOT: every field the upload never carried is ABSENT,
  // not zero and not a dash - a tile that prints `level 0` or
  // `0 / 0` has told a player a fact about a character nobody sent.
  for (const k of ['race', 'career', 'level', 'health', 'maxHealth', 'gold']) {
    assert.equal(save[k], undefined, `${k} was invented - the service never held one`);
  }
  // ...and the TILE degrades on its own, with no special case in the
  // drawing: no sub-line, no stats list, and the well's initial.
  const t = saveTile(fakeDoc(), save, { actions: [{ label: 'Download', primary: true }] });
  assert.equal(tileLine(save), '', 'the sub-line joins nothing');
  assert.equal(byClass(t, 'svsub').length, 0, 'and is never appended');
  assert.equal(walk(t).filter((n) => n.tagName === 'DL').length, 0, 'no stats list at all');
  assert.equal(text(t, 'svinitial'), 'N', 'the well falls back to the CHARACTER\'s initial, not the slot\'s');
  assert.equal(text(t, 'svwhen'), `${save.when} · ${save.hour}`);

  // A CARD FROM AN OLDER BUILD, OR ONE THAT NEVER HAD A DATE, is a
  // tile and not a crash - the same law `SaveInfo` states about its own
  // every-field-optional shape.
  const bare = saveFromCard({ characterId: 'c', saveName: 's' }, dateFromClassicMinutes, dateString);
  assert.equal(bare.name, 'Unnamed');
  assert.equal(bare.when, null);
  assert.equal(bare.hour, null);
  assert.equal(initialOf(bare), 'U');
});

test('ACC2c: `only` is its own cloud state and its own ladder - a card with no save under it cannot be asked the questions the local ladder asks, and the sentence says WHERE the save is rather than that it is safe (mutants: the only-arm folded into the local ladder; `only` saying "Backed up"; a busy or refused download swallowed by it)', () => {
  assert.ok(CLOUD_STATES.includes('only'), 'the state exists');
  const card = { characterId: 'c', saveName: 's', bytes: 900, updatedAt: 1000 };

  // THE LADDER IS WHOLE AND SEPARATE. Every rung of the local one is a
  // question about a local slot - whether it predates CHARID1, whether
  // its upload finished, whether it has been backed up at all - and
  // none is answerable here. So `local: false` answers `only` WITHOUT
  // consulting characterId at all.
  assert.deepEqual(
    cloudStateOf({ signedIn: true, card, local: false, nowS: 1120 }),
    { state: 'only', when: agoText(1000, 1120), error: null });
  assert.equal(
    cloudStateOf({ signedIn: true, card, local: false, characterId: null, nowS: 1120 }).state, 'only',
    'a card with no characterId is still a card - `wait` is a question about a LOCAL slot');

  // ...but the two things that are still true of it are kept: a
  // download in flight, and a refused one carrying the service's own
  // WORD rather than a sentence this file made up.
  assert.equal(cloudStateOf({ signedIn: true, card, local: false, busy: true }).state, 'busy');
  const bad = cloudStateOf({ signedIn: true, card, local: false, error: 'too-large' });
  assert.deepEqual([bad.state, bad.error], ['bad', 'too-large']);

  // NO ACCOUNT IS STILL NO LINE. `off` is the first rung for a reason -
  // ACC0's wall - and `local` may not step in front of it.
  assert.equal(cloudStateOf({ signedIn: false, card, local: false }).state, 'off');

  // AND THE DEFAULT IS LOCAL, so every caller written before this slice
  // reads exactly what it read.
  assert.deepEqual(
    cloudStateOf({ signedIn: true, characterId: 'c', card, nowS: 1120 }),
    { state: 'saved', when: agoText(1000, 1120), error: null });

  // THE SENTENCE. "Backed up" under a tile whose only copy IS the
  // backup tells a player they have two of something they have one of.
  const t = saveTile(fakeDoc(), { name: 'N' }, { cloud: { state: 'only', when: '2 minutes ago', actions: [] } });
  assert.equal(text(t, 'svsay'), 'Only in your backup · 2 minutes ago');
  assert.equal(byClass(t, 'svcloud')[0].className, 'svcloud is-only', 'and it wears its own class, so the skin can colour it apart from a backed-up local save');
  const noWhen = saveTile(fakeDoc(), { name: 'N' }, { cloud: { state: 'only', when: null, actions: [] } });
  assert.equal(text(noWhen, 'svsay'), 'Only in your backup');
});
