// REVENANT-CARD, REVENANT-PAGE, REVENANT-HARM, REVENANT-DUNGEON, REVENANT-WIRE (2026-10-02, Mac: "Definitely finish this with
// love. Any new UI elements need to be enhanced UI plus. For taunting enemies. I was hoping it would have a portrait
// popup and enemy dialog (kind of like our notification system)"). The laws pinned here:
//   - THE EVENTS: each thing a revenant says or does is an event - its kicker, name, what it is, its portrait (the sprite
//     it wore, else its kind's by gender; the idle's front record, else the walk's), its words or the narrator's, and
//     the one line a text surface says instead; a face draws it or the host says the line.
//   - THE CARD (enhanced skin only): a portrait popup with typed words, one per revenant, two at most, held, slid out;
//     hidden under the HUD's gate with its clock stopped; the whole line for a screen reader; reduced motion types
//     nothing; the classic skin declines and the line is said.
//   - THE PAGE: the living strongest first, when each will come, what each has done; the fallen; the empty words.
//   - THE HARM: a death no blow names goes to the foe whose spell, lingering effect or blow last reached the player;
//     a killing blow outranks it.
//   - THE DUNGEON, THE WIRE, THE SINGLE-LOCATION HOST, THE KIT: by source.

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};

const N = await import('../src/systems/revenant.js');
const V = await import('../src/systems/revenantVoice.js');
const C = await import('../src/ui/revenantCard.js');
const P = await import('../src/ui/revenantPage.js');
const H = await import('../src/systems/harmMark.js');
const { setPref, _resetForTests } = await import('../src/systems/uiPrefs.js');
const { hurtPlayer, setAvoidDeathHook } = await import('../src/characters/playerEntity.js');
const { setStruck, _resetSetPowersForTests } = await import('../src/systems/sigilSetPowers.js');
const { setPlayerDoor } = await import('../src/systems/playerDoor.js');
const { MOBILE_TYPES } = await import('../src/characters/mobileTypes.js');
const { ENEMY_BASICS, enemyDisplayName } = await import('../src/characters/enemyBasics.js');
const { validFoeRecord, REVENANT_NAME_MAX } = await import('../src/net/wire.js');
const { FRAME_ROLES } = await import('../src/ui/enhancedFrame.js');
const { HUD_PIECES } = await import('../src/ui/hudLayout.js');

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { modSaveRecords, restoreModSaveRecords } = await import('../src/systems/modSaveData.js');
const modSave = () => modSaveRecords()[N.REVENANT_SAVE];
const restore = (rec) => restoreModSaveRecords({ [N.REVENANT_SAVE]: rec });
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = (id = 'char-c') => ({
  isPlayer: true, name: 'Ayla Stormwind', characterId: id, items: [], stats: stats(), skills: new Array(35).fill(30), level: 5,
  career: {}, activeEffects: [], health: 100, maxHealth: 100, magicka: 0, maxMagicka: 1000, armorValues: new Array(7).fill(100),
});
const orc = (over = {}) => ({ mobileType: MOBILE_TYPES.OrcWarlord, level: 9, health: 60, maxHealth: 60, team: 'Orcs', champion: 'mighty', ...over });
const tick = () => new Promise((r) => setTimeout(r, 0));
function fresh() {
  _resetForTests(); setPref('lootRarity', true);
  N._resetRevenantForTests(); _store.clear(); _resetSetPowersForTests(); setPlayerDoor(null); setAvoidDeathHook(null); H._resetHarmMarkForTests();
}

// ── a document, just enough of one (test/pickupfeed.test.js's) ──
function fakeEl(tag, doc) {
  const classes = new Set();
  const n = {
    tag, doc, children: [], dataset: {}, attrs: {}, parent: null, style: { setProperty() {}, getPropertyValue: () => '' },
    classList: {
      add: (...c) => c.forEach((x) => classes.add(x)), remove: (...c) => c.forEach((x) => classes.delete(x)),
      toggle: (c, on = !classes.has(c)) => { if (on) classes.add(c); else classes.delete(c); return on; }, contains: (c) => classes.has(c),
    },
    get className() { return [...classes].join(' '); },
    set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach((x) => classes.add(x)); },
    _text: '',
    get textContent() { return n._text + n.children.map((c) => c.textContent ?? '').join(''); },
    set textContent(v) { n.children.forEach((c) => { c.parent = null; }); n.children.length = 0; n._text = v == null ? '' : String(v); },
    get firstChild() { return n.children[0] ?? null; },
    append(...cs) { for (const c of cs) { if (c.parent) c.parent.children.splice(c.parent.children.indexOf(c), 1); c.parent = n; n.children.push(c); } },
    insertBefore(c, ref) { if (c.parent) c.parent.children.splice(c.parent.children.indexOf(c), 1); c.parent = n; const i = ref ? n.children.indexOf(ref) : -1; if (i < 0) n.children.push(c); else n.children.splice(i, 0, c); return c; },
    remove() { if (n.parent) { const i = n.parent.children.indexOf(n); if (i >= 0) n.parent.children.splice(i, 1); n.parent = null; } n.removed = true; },
    setAttribute(k, v) { n.attrs[k] = v; }, getAttribute: (k) => n.attrs[k] ?? null, hasAttribute: (k) => k in n.attrs,
  };
  return n;
}
function fakeDocument() {
  const doc = {};
  doc.createElement = (t) => fakeEl(t, doc);
  doc.body = fakeEl('body', doc);
  doc.head = fakeEl('head', doc);
  const all = () => { const out = []; const walk = (x) => { for (const c of x.children) { out.push(c); walk(c); } }; walk(doc.head); walk(doc.body); return out; };
  doc.getElementById = (id) => all().find((e) => e.id === id) ?? null;
  doc.all = all;
  return doc;
}
const byClass = (root, cls) => { const out = []; const walk = (x) => { for (const c of x.children ?? []) { if (c.classList?.contains(cls)) out.push(c); walk(c); } }; walk(root); return out; };
function withPage(fn, { skin = 'enhanced' } = {}) {
  const doc = fakeDocument();
  globalThis.document = doc;
  globalThis.location = { search: `?skin=${skin}` };
  C._resetRevenantCardsForTests();
  C._setRevenantCardForTests({ icon: () => ({ src: 'data:x', w: 34, h: 60, smooth: false }), schedule: () => 1, cancel: () => {} });
  try { return fn(doc); } finally {
    C._resetRevenantCardsForTests();
    C._setRevenantCardForTests({ icon: null });
    delete globalThis.document; delete globalThis.location; delete globalThis.matchMedia;
  }
}

test('REVENANT-CARD THE EVENTS: a taunt, a flight, an escape, a fall and a rise each an event - kicker, name, what it is, the portrait (the sprite it wore, else its kind\'s by gender; the idle\'s front record, else the walk\'s), its words or the narrator\'s, the line beside (mutants: the line lost; the portrait the walk\'s for an idler; a beast given words)', () => {
  fresh();
  const me = player();
  const r = N.revenantDeed(me, orc(), 'slew', { now: 10, rolls: () => 0 });
  const t = N.revenantTauntEvent(r, me.name, { rolls: () => 0 });
  assert.equal(t.kind, 'taunt'); assert.equal(t.kicker, 'Revenant'); assert.equal(t.name, r.name); assert.equal(t.rank, 1);
  assert.equal(t.sub, `${enemyDisplayName(MOBILE_TYPES.OrcWarlord)} · Mighty`);
  assert.ok(t.speech && !t.speech.startsWith(r.name), 'its own words, unprefixed');
  assert.equal(t.line, `${r.name}: "${t.speech}"`, 'the text surface\'s line');
  assert.equal(t.line, N.revenantTaunt(r, me.name, () => 0), 'the one taunt, two ways');
  const b = ENEMY_BASICS[MOBILE_TYPES.OrcWarlord];
  assert.deepEqual(t.portrait, { archive: b.maleTexture, record: b.hasIdle ? 15 : 0 });
  assert.deepEqual(N.revenantPortrait({ mobileType: 130, gender: 'female' }).archive, ENEMY_BASICS[130].femaleTexture, 'a woman\'s sprite');
  assert.equal(N.revenantPortrait({ mobileType: MOBILE_TYPES.OrcWarlord, archive: 9999 }).archive, 9999, 'the sprite it wore first');
  const noIdle = Object.keys(ENEMY_BASICS).map(Number).find((k) => ENEMY_BASICS[k]?.maleTexture && !ENEMY_BASICS[k].hasIdle);
  if (noIdle != null) assert.equal(N.revenantPortrait({ mobileType: noIdle }).record, 0, 'no idle: the walk\'s front');
  const beast = { ...r, mobileType: MOBILE_TYPES.SabertoothTiger, personality: 'cold' };
  const g = N.revenantTauntEvent(beast, me.name, { rolls: () => 0 });
  assert.equal(g.speech, null, 'a beast says nothing');
  assert.match(g.body, /^Circles you in eerie silence\./, 'the narrator says what it does, in its temperament');
  assert.match(g.line, new RegExp(`^${r.name} circles you in eerie silence`));
  assert.equal(g.mood, 'Cold', 'REVENANT-VOICE: its personality on the card');
  const fl = N.revenantFleeEvent(orc({ eliteFoe: true, champion: undefined }), 'Elite Orc Warlord');
  assert.equal(fl.kind, 'flee'); assert.equal(fl.name, 'Elite Orc Warlord'); assert.equal(fl.rank, 0); assert.ok(fl.speech && fl.mood, 'its words in its own voice, its personality named'); assert.match(fl.sub, /Elite$/);
  const es = N.revenantEscapeEvent({ ...r, personality: 'brutal' }, me.name, { rolls: () => 0 });
  assert.equal(es.kicker, 'Escaped'); assert.equal(es.speech, 'Next time, I take your head, Ayla.', 'its promise, in its voice, to the player'); assert.equal(es.line, N.revenantEscapeLine(r));
  const sl = N.revenantSlainEvent(r, me.name, { rolls: () => 0 });
  assert.equal(sl.kicker, 'Revenant slain'); assert.equal(sl.body, 'Has fallen. Your revenant is no more.'); assert.ok(sl.speech, 'its last words');
  const ri = N.revenantRiseEvent(r, me.name, { rolls: () => 0 });
  assert.equal(ri.kicker, 'A revenant rises'); assert.equal(ri.line, N.revenantRiseLine(r));
  // the voice: a face that draws it, or the line said
  const said = [];
  V.setRevenantPresenter(null);
  assert.equal(N.revenantSay(t, (l) => said.push(l)), false); assert.deepEqual(said, [t.line], 'no face: the line');
  V.setRevenantPresenter(() => true);
  assert.equal(N.revenantSay(t, (l) => said.push(l)), true); assert.equal(said.length, 1, 'a face drew it: no line');
  V.setRevenantPresenter(() => { throw new Error('x'); });
  N.revenantSay(t, (l) => said.push(l)); assert.equal(said.length, 2, 'a face that throws: the line');
  V.setRevenantPresenter(C.showRevenantCard);   // the card's own, back
});

test('REVENANT-CARD THE CARD: on the enhanced skin a portrait popup - the kicker, the name, the rank, the words typed then held then slid out; one per revenant, two at most; hidden under the HUD\'s gate with its clock still; the whole line for a reader; the classic skin declines (mutants: no typing; the clock runs hidden; a revenant twice; no cap; the classic skin drawn)', () => {
  fresh();
  const me = player();
  const r = N.revenantDeed(me, orc(), 'slew', { now: 10, rolls: () => 0 });
  withPage((doc) => {
    const ev = N.revenantTauntEvent(r, me.name, { rolls: () => 0 });
    assert.equal(N.revenantSay(ev, () => assert.fail('the card drew it')), true, 'the card draws it');
    const stack = doc.getElementById(C.REVENANT_STACK_ID);
    assert.ok(stack, 'the stack stands');
    assert.equal(stack.attrs['aria-live'], 'polite');
    const card = stack.children[0];
    assert.ok(card.classList.contains('rvncard') && card.classList.contains('is-taunt') && card.classList.contains('rvncard-in'));
    assert.equal(byClass(card, 'rvncard-kicker')[0].textContent, 'Revenant');
    assert.equal(byClass(card, 'rvncard-name')[0].textContent, r.name);
    assert.equal(byClass(card, 'rvncard-rank')[0].textContent, 'I');
    assert.ok(byClass(card, 'rvncard-face')[0].children.some((c) => c.tag === 'img'), 'the portrait');
    assert.equal(byClass(card, 'rvncard-sr')[0].textContent.includes(ev.speech), true, 'a reader has the whole line at once');
    assert.equal(byClass(card, 'rvncard-say')[0].attrs['aria-hidden'], 'true', '...and not the typing');
    // typed
    const say = () => byClass(card, 'rvncard-say')[0].textContent.replace('▌', '');
    assert.equal(say(), '', 'nothing typed yet');
    C.drawRevenantCards({ dt: 0.25, doc });
    assert.equal(say().length, Math.floor(0.25 * C.REVENANT_TYPE_CPS), 'typed at its pace');
    // hidden: the clock stands
    C.drawRevenantCards({ hidden: true, dt: 10, doc });
    assert.ok(stack.classList.contains('rvncard-hidden'));
    assert.equal(say().length, Math.floor(0.25 * C.REVENANT_TYPE_CPS), 'hidden, nothing typed');
    C.drawRevenantCards({ dt: 30, doc });
    assert.equal(say(), `“${ev.speech}”`, 'all out');
    const st = C._revenantCards()[0];
    assert.ok(st.leftMs > 0, 'held');
    C.drawRevenantCards({ dt: st.leftMs / 1000 + 0.01, doc });
    assert.equal(C._revenantCards()[0].out, true, 'sliding out');
    C.drawRevenantCards({ dt: 1, doc });
    assert.equal(C._revenantCards().length, 0, 'gone');
    assert.equal(doc.getElementById(C.REVENANT_STACK_ID), null, 'the stack with it');
    // one per revenant, two at most
    N.revenantSay(ev); N.revenantSay(N.revenantEscapeEvent(r, me.name));
    C.drawRevenantCards({ dt: 0.01, doc });
    assert.equal(C._revenantCards().filter((c) => !c.out).length, 1, 'the same revenant: its new word in place of its old');
    N.revenantSay(N.revenantFleeEvent(orc({ champion: 'swift' }), 'Swift Orc'));
    N.revenantSay(N.revenantFleeEvent(orc({ champion: 'stalwart' }), 'Stalwart Orc'));
    assert.equal(C._revenantCards().filter((c) => !c.out).length, C.REVENANT_CARDS_MAX, 'two at most');
  });
  // reduced motion: nothing typed, the words at once
  withPage((doc) => {
    globalThis.matchMedia = () => ({ matches: true });
    const ev = N.revenantTauntEvent(r, me.name, { rolls: () => 0 });
    N.revenantSay(ev);
    assert.equal(byClass(doc.getElementById(C.REVENANT_STACK_ID), 'rvncard-say')[0].textContent, `“${ev.speech}”`);
  });
  // the classic skin: no card, the line
  withPage((doc) => {
    const said = [];
    assert.equal(N.revenantSay(N.revenantTauntEvent(r, me.name), (l) => said.push(l)), false);
    assert.equal(said.length, 1); assert.equal(doc.getElementById(C.REVENANT_STACK_ID), null);
  }, { skin: 'classic' });
});

test('REVENANT-CARD ENHANCED PLUS: the kit dresses it by role - a panel with an accent edge, the portrait a well, the rank a chip, the name a header rule, the page\'s rows tiles - the sheet writing geometry and words alone; drawn on drawHud\'s one call behind the HUD\'s gate and its hide door; a HUD piece HUD-MOVE moves (mutants: a role dropped; not drawn; no hide door)', () => {
  assert.ok(FRAME_ROLES.panel.includes('body .rvncard') && FRAME_ROLES.panelAccent.includes('body .rvncard'));
  assert.ok(FRAME_ROLES.well.includes('body .rvncard-face') && FRAME_ROLES.well.includes('.px-sys .rvn-face'));
  assert.ok(FRAME_ROLES.chip.includes('body .rvncard-rank') && FRAME_ROLES.chip.includes('.px-sys .rvn-rank'));
  assert.ok(FRAME_ROLES.headerRule.includes('body .rvncard-name'));
  assert.ok(FRAME_ROLES.panel.includes('.px-sys .rvn-row') && !FRAME_ROLES.tile.includes('.px-sys .rvn-row'), 'a row is a card, never a press');
  assert.doesNotMatch(C.REVENANT_CARD_CSS.replace(/border-left-color: #[0-9a-f]+/g, ''), /background(-color)?:\s*#/i, 'no ground of its own - the theme\'s');
  const h = read('src/ui/hud.js');
  assert.match(h, /drawRevenantCards\(\{ hidden: cursorActive \|\| !hudRenderEnabled\(\), dt \}\);/);
  assert.match(h, /drawQuestTracker\(\{ hidden: true \}\);\s*\n\s*drawRevenantCards\(\{ hidden: true \}\);/, 'the hide door');
  assert.ok(HUD_PIECES.some((p) => p.id === 'revenant' && p.sel === '.rvncard-stack' && p.ghost === 'revenant'), 'movable, with a preview');
  assert.match(read('src/ui/hudLayout.js'), /} else if \(kind === 'revenant'\) \{\s*\n\s*try \{ g = ghostDeps\.buildRevenantPreview\?\.\(doc\) \?\? null; \}/);
});

test('REVENANT-PAGE: the living strongest first - name, rank, kind and trait, what it has done, when it will come, its deeds - then the fallen struck through; none, and the words say how one is made; off, that it is off (mutants: the fallen among the living; the order; the empty words)', () => {
  fresh();
  const me = player('char-page');
  const a = N.revenantDeed(me, orc(), 'slew', { now: 0, rolls: () => 0 });
  const b = N.revenantDeed(me, orc({ champion: 'swift' }), 'fled', { now: 0, rolls: () => 0 });
  N.revenantDeed(me, { ...orc(), revenant: { id: b.id } }, 'slew', { now: 10, rolls: () => 0 });
  const c = N.revenantDeed(me, orc({ champion: 'stalwart' }), 'slew', { now: 0, rolls: () => 0 });
  N.revenantSlain(me, { revenant: { id: c.id } }, { now: 20 });
  const doc = fakeDocument(); globalThis.document = doc;
  P._setRevenantPageIconForTests(() => null);
  try {
    const el = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
    const divider = (w) => el('div', 'px-divider', w);
    const detail = el('div', 'px-qdetail px-sys');
    P.drawRevenantsPage(detail, () => {}, { el, divider, player: me, kindName: enemyDisplayName });
    const words = detail.children.map((n) => n.textContent);
    assert.equal(words[0], `Revenants (2 of ${N.REVENANT_MAX})`);
    const rows = byClass(detail, 'rvn-row');
    assert.equal(rows.length, 3);
    assert.match(rows[0].textContent, new RegExp(b.name), 'the strongest first');
    assert.match(rows[0].textContent, /escaped you once/i); assert.match(rows[0].textContent, /killed you once/i);
    assert.match(rows[1].textContent, new RegExp(a.name));
    assert.ok(rows[2].classList.contains('is-fallen'), 'the fallen last');
    assert.equal(words.filter((w) => w === 'Fallen').length, 1);
    assert.ok(byClass(rows[0], 'rvn-face')[0].children.some((n) => n.classList.contains('rvn-glyph')), 'no picture: a glyph');
    // the words, pure
    assert.equal(P.comeWords({ out: true }, 0).tag, 'Abroad');
    assert.equal(P.comeWords({ dueAt: -1 }, 0).tag, 'Hunting');
    assert.match(P.comeWords({ dueAt: 2 * 1440 }, 0).line, /about 2 days/);
    assert.equal(P.agoWords(0, 0), 'today'); assert.equal(P.agoWords(0, 1440), 'yesterday'); assert.equal(P.agoWords(0, 3 * 1440), '3 days ago');
    assert.equal(P.deedWords({ kills: 2, escapes: 1, returns: 3 }), 'Killed you twice, escaped you once, came back 3 times.');
    // none, and off
    N._resetRevenantForTests(); _store.clear();
    const empty = el('div', 'px-sys');
    P.drawRevenantsPage(empty, () => {}, { el, divider, player: player('char-none') });
    assert.match(empty.textContent, /No foe has earned your name yet/);
    setPref('lootRarity', false);
    const off = el('div', 'px-sys');
    P.drawRevenantsPage(off, () => {}, { el, divider, player: player('char-none') });
    assert.match(off.textContent, /come with Loot rarity, which is off/);
    assert.equal(P.revenantPageShown(player('char-none')), false, 'off and none: no page on the rail');
  } finally { P._setRevenantPageIconForTests(null); delete globalThis.document; }
  const m = read('src/ui/enhancedMenu.js');
  assert.match(m, /\.\.\.\(revenantPageShown\(playerEntity\) \? REVENANT_PAGE_SECTIONS : \[\]\)/, 'on the Holdings rail');   // PIN MOVED (HOLDINGS): off the Stats rail onto the Holdings tab's (test/holdings.test.js)
  assert.match(m, /revenants: \(d\) => drawRevenantsPage\(d, render, \{ \.\.\.kit, player: playerEntity, kindName: enemyDisplayName \}\)/);   // PIN MOVED (HOLDINGS): the Holdings page's kit
});

test('REVENANT-HARM: a death no blow names goes to the foe whose harm last reached me - a spell, a lingering round, a blow (its poison\'s ticks after); a killing blow outranks the mark; a mark past its time names nobody (mutants: no mark read; the mark outranking the blow; no time limit)', async () => {
  fresh();
  const me = player('char-harm');
  const mage = orc({ mobileType: 128, champion: undefined, eliteFoe: true });
  const brute = orc();
  setPlayerDoor({ foes: () => [{ entity: mage, mobileType: 128, gender: 'female' }, { entity: brute, mobileType: MOBILE_TYPES.OrcWarlord }], feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: () => {}, player: () => me });
  // a spell's burn: no blow, the mage's mark
  H.markPlayerHarm(mage);
  hurtPlayer(me, 500);
  await tick();
  assert.equal(N.livingRevenants().length, 1); assert.equal(mage.revenant?.id, N.livingRevenants()[0].id, 'the caster');
  assert.equal(N.livingRevenants()[0].gender, 'female', 'its record off the pool');
  // a blow outranks the mark
  me.health = 100;
  H.markPlayerHarm(mage);
  setStruck(brute, me, 500); hurtPlayer(me, 500);
  await tick();
  assert.ok(brute.revenant, 'the blow that killed');
  assert.equal(N.livingRevenants().length, 2);
  // a mark past its time
  fresh();
  const me2 = player('char-harm2');
  H.markPlayerHarm(mage, { ms: 10, now: Date.now() - 1000 });
  hurtPlayer(me2, 500); await tick();
  assert.equal(N.livingRevenants().length, 0, 'an old harm names nobody');
  // the seams that leave the mark
  assert.match(read('src/scenes/hostMagic.js'), /if \(caster\?\.entity && caster\.entity !== playerEntity && !caster\.entity\.isPlayer\) markPlayerHarm\(caster\.entity\);[^\n]*\n\s*const r = applySpell\(spell, casterLevel, playerEntity, playerSinks, rolls, caster, ctx\);/);
  assert.match(read('src/systems/effects.js'), /if \(n > 0 && target\?\.isPlayer && a\.caster && !a\.caster\.isPlayer\) markPlayerHarm\(a\.caster\);/);
  assert.match(read('src/systems/revenant.js'), /registerPlayerStruckListener\('revenant', \(attacker, target\) => \{\s*\n\s*if \(target\?\.isPlayer && !target\.peer && attacker && !attacker\.isPlayer\) markPlayerHarm\(attacker, \{ ms: HARM_MARK_STRUCK_MS \}\);/);
  assert.doesNotMatch(read('src/systems/harmMark.js'), /^import /m, 'a leaf');
});

test('REVENANT-DUNGEON, REVENANT-WIRE, the single-location host: a special foe of mine alone runs in a dungeon (never a room\'s shared foe online), aims at nothing while it runs and is retired through the quest pool\'s door when out of reach; a slain one closes; the name rides the foe record, bounded and printable; the single-location host stands returns as the world\'s does (mutants: a room foe runs; the name unbounded; the host forgets)', () => {
  const d = read('src/scenes/dungeonContext.js');
  assert.match(d, /const _flee = f\.fleeing \|\| \(!f\._fleeRolled && revenantFleeHealth\(f\.entity\)\) \? revenantFleeStep\(f, _pf, \{ mayRun: !onlineRoom\(\) \|\| !_roomFoe, onMe: /, 'the one flee law - mine alone, never a room\'s shared foe');
  assert.match(d, /if \(_flee === 'escape'\) \{ escapeDungeonFoe\(f\); continue; \}/);
  assert.match(d, /if \(_flee === 'start' \|\| _flee === 'run'\) _tgt = null;/, 'running, it aims at nothing; its walk below');
  // PIN MOVED (RVN3: the unbroken's escape - the same door, its own words)
  // PIN MOVED (RVN7d: its band scatters first - bible/12-Enhanced-AI/Feud-Arc.md 17, 18.4)
  assert.match(d, /function escapeDungeonFoe\(f(?:, \{ slip = false(?:, unbroken = false)? \} = \{\})?\) \{\s*\n(?:\s*scatterDungeonBand\(f\);[^\n]*\n)?\s*questPoolOps\.removeFoe\(f\);/);
  assert.match(d, /if \(foe\.entity\?\.revenant\) \{ const nr = revenantSlain\(playerEntity, foe\.entity\);/);
  // the wire
  const base = { i: 1, t: 7, x: 0, f: [0, 0, 0], y: 0 };
  assert.equal(validFoeRecord({ ...base, nm: 'Grushnak the Butcher' }).nm, 'Grushnak the Butcher');
  assert.equal(validFoeRecord({ ...base, nm: '' }), null);
  assert.equal(validFoeRecord({ ...base, nm: 'x'.repeat(REVENANT_NAME_MAX + 1) }), null);
  assert.equal(validFoeRecord({ ...base, nm: 'a\u0007b' }), null);
  assert.equal(validFoeRecord({ ...base, nm: 7 }), null);
  const x = read('src/scenes/exteriorFoes.js');
  assert.match(x, /\.\.\.\(!onWatch && typeof f\.entity\?\.revenant\?\.name === 'string' && f\.entity\.revenant\.name \? \{ nm: /, 'the owner sends it');
  assert.match(x, /\$\{r\.z \?\? 0\},\$\{r\.nm \?\? ''\}(?:,\$\{r\.yd \?\? 0\},\$\{r\.ex \?\? 0\},\$\{r\.sp \?\? 0\})?(?:,\$\{r\.ad \?\? 0\},\$\{r\.wq \?\? -1\},\$\{r\.p2 \?\? 0\},\$\{r\.rt \?\? -1\}(?:,\$\{r\.rb \?\? 0\})?)?(?:\$\{r\.wk !== undefined[^\n]*blowWireKey\(r\)[^\n]*\})?`;/, 'a changed name is sent again (REVENANT-FATE: and a kneel, a burning or an oath begun; PIN MOVED - TELL8: and a wind-up)');   // PIN MOVED (FEUD WIRE: and its blows, `rb`)
  assert.match(x, /if \(typeof r\.nm === 'string' && r\.nm && f\.entity\.revenant\?\.name !== r\.nm\) \{? ?f\.entity\.revenant = \{ id: null, name: r\.nm, rank: 0 \};/, 'the puppet called so');   // PIN MOVED (RVN13: and its wire's own stood again)
  // the single-location host
  const e = read('src/scenes/exterior.js');
  assert.match(e, /revenantPresence\(exteriorFoes\.foes, \{ now \}\);\s*\n\s*revenantSay\(takeRevenantNotice\(playerEntity\), \(l\) => townTalk\.say\(l\)\);/);
  assert.match(e, /const _revenant = hit && _m === 'exterior' \? revenantToReturn\(playerEntity, \{ now \}\) : null;\s*\n\s*if \(_revenant\) \{ Promise\.resolve\(_standEncounterFoe\(\{ \.\.\.hit, mobileType: _revenant\.mobileType, revenant: _revenant \}, playerFeet\)\)\.then\(\(f\) => \{ if \(!f\) releaseRevenantStand\(_revenant\); \}\); break; \}/);
  assert.match(e, /\.\.\.\(hit\.revenant \? revenantSpawnOptions\(hit\.revenant, effectiveLevel\(playerEntity\)\) : \{\}\)/);
});

test('REVENANT AAA: the one flee law - a roll once under the line, a run, an escape only out of reach, CORNERED when run down (it fights on, never runs again); a room\'s shared foe never runs (mutants: the run spent is an escape at any distance; cornered runs again; a shared foe runs)', () => {
  fresh();
  const foe = (over = {}) => ({ entity: orc({ health: 5, maxHealth: 60 }), ai: { feet: [0, 0, 0], isHostile: true, fleeLeft: 0, flee(from, s) { this.fleeLeft = s; this.fled = from; } }, ...over });
  const f = foe();
  assert.equal(N.revenantFleeStep(f, [0, 0, 0], { rolls: () => 0.99 }), null, 'the roll lost');
  assert.equal(f._fleeRolled, true);
  assert.equal(N.revenantFleeStep(f, [0, 0, 0], { rolls: () => 0 }), null, 'once, never again');
  const g = foe();
  assert.equal(N.revenantFleeStep(g, [0, 0, 0], { rolls: () => 0 }), 'start');
  assert.equal(g.ai.fleeLeft, N.REVENANT_FLEE_SECONDS);
  assert.equal(N.revenantFleeStep(g, [5, 0, 0]), 'run', 'running');
  g.ai.fleeLeft = 0;
  assert.equal(N.revenantFleeStep(g, [5, 0, 0]), 'cornered', 'run down: cornered');
  assert.equal(g.fleeing, false);
  assert.equal(N.revenantFleeStep(g, [5, 0, 0], { rolls: () => 0 }), null, 'it fights on - it never runs again');
  const h = foe(); N.revenantFleeStep(h, [0, 0, 0], { rolls: () => 0 }); h.ai.fleeLeft = 0;
  assert.equal(N.revenantFleeStep(h, [N.REVENANT_ESCAPE_NEAR + 1, 0, 0]), 'escape', 'its run spent out of reach: escaped');
  const k = foe(); N.revenantFleeStep(k, [0, 0, 0], { rolls: () => 0 });
  assert.equal(N.revenantFleeStep(k, [0, 0, N.REVENANT_ESCAPE_DISTANCE + 1]), 'escape', 'far off mid-run: escaped');
  assert.equal(N.revenantFleeStep(foe(), [0, 0, 0], { rolls: () => 0, mayRun: false }), null, 'a room\'s shared foe never runs');
  assert.equal(N.revenantFleeStep(foe(), [0, 0, 0], { rolls: () => 0, onMe: () => false }), null, 'nor one fighting another');
  const cor = N.revenantCorneredEvent(orc(), 'Mighty Orc Warlord');
  assert.equal(cor.kicker, 'Cornered'); assert.ok(cor.speech); assert.match(cor.line, /is cornered and turns to fight! "[^"]+"$/, 'AUDIT (2026-10-02): and says its words on the text line too');
});

test('REVENANT AAA: a returning revenant is CLAIMED by the roll that stands it - no second copy while its stand loads; a stand that stood nobody frees it (mutants: no claim; the claim never freed)', () => {
  fresh();
  const me = player('char-claim');
  const r = N.revenantDeed(me, orc(), 'fled', { now: 0, rolls: () => 0 });
  const late = N.REVENANT_RETURN_MAX_MINUTES + 1;
  assert.equal(N.revenantToReturn(me, { now: late, rolls: () => 0 }), r);
  assert.equal(r.out, true, 'claimed');
  assert.equal(N.revenantToReturn(me, { now: late, rolls: () => 0 }), null, 'the next roll stands no second copy');
  N.releaseRevenantStand(r);
  assert.equal(r.out, false);
  assert.equal(N.revenantToReturn(me, { now: late, rolls: () => 0 }), r, 'free for a later roll');
});

test('REVENANT AAA: the forgotten and the long-fallen leave TOMBSTONES a merge keeps - an older save never raises one; the page keeps the newest fallen; the tombstones themselves are bounded (mutants: spliced, not buried; no fallen bound; the tombstone loses the merge)', () => {
  fresh();
  const me = player('char-tomb');
  const first = N.revenantDeed(me, orc(), 'fled', { now: 0, rolls: () => 0 });
  const save = JSON.parse(JSON.stringify(modSave()));
  for (let i = 1; i <= N.REVENANT_MAX; i++) { const x = N.revenantDeed(me, orc({ champion: 'swift' }), 'fled', { now: i, rolls: () => 0 }); x.rank = 2; }
  assert.equal(N.revenantById(first.id), null, 'past the cap the weakest, oldest is forgotten');
  assert.equal(N.livingRevenants().length, N.REVENANT_MAX);
  restore(save);
  assert.equal(N.livingRevenants().length, 1, 'the old save alone');
  N.revenantToReturn(me, { now: 0 });   // the mirror read in
  assert.equal(N.revenantById(first.id), null, 'the tombstone outranks the older save - never raised');
  assert.equal(N.livingRevenants().length, N.REVENANT_MAX);
  // the fallen, bounded
  fresh();
  const me2 = player('char-fallen');
  for (let i = 0; i < N.REVENANT_FALLEN_MAX + 4; i++) { const x = N.revenantDeed(me2, orc(), 'fled', { now: i, rolls: () => 0 }); N.revenantSlain(me2, { revenant: { id: x.id } }, { now: 100 + i }); }
  assert.equal(N.allRevenants().filter((x) => x.defeated).length, N.REVENANT_FALLEN_MAX, 'the page keeps the newest fallen');
  assert.equal(N.mergeRevenants([{ id: 'a', rev: 9, gone: true }], [{ id: 'a', rev: 3, mobileType: 7, given: 'G', epithet: 'the X' }])[0].gone, true);
  assert.deepEqual(N.mergeRevenants([{ id: 'a', rev: 2, gone: true }], [])[0], { id: 'a', rev: 2, gone: true }, 'a tombstone is its id and revision alone');
});

test('REVENANT AAA: a foe already slain is no one\'s revenant - a fall after the fight names nobody dead; a revenant standing in the host the player is in (a dungeon) is present, not lost (mutants: the dead blamed; presence the open world\'s alone)', async () => {
  fresh();
  const me = player('char-dead');
  const corpse = orc({ health: 0 });
  H.markPlayerHarm(corpse);
  hurtPlayer(me, 500);
  await tick();
  assert.equal(N.livingRevenants().length, 0, 'the dead orc is not blamed');
  // presence: the dungeon's pool through the player's door
  fresh();
  const me2 = player('char-door');
  const killer = orc();
  const r = N.revenantDeed(me2, killer, 'slew', { now: 0, rolls: () => 0 });
  setPlayerDoor({ foes: () => [{ entity: killer, dead: false }], feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: () => {} });
  N.revenantPresence([], { now: 10, wall: Date.now() + 60000 });
  assert.equal(r.out, true, 'standing in the dungeon - present');
  setPlayerDoor(null);
  N.revenantPresence([], { now: 10, wall: Date.now() + 60000 });
  assert.equal(r.out, false, 'gone from every pool - lost');
});

test('REVENANT AAA: a card whose slide ends on an exact frame is taken down (mutants: zero read as standing)', () => {
  fresh();
  const me = player('char-zero');
  const r = N.revenantDeed(me, orc(), 'slew', { now: 0, rolls: () => 0 });
  withPage((doc) => {
    globalThis.matchMedia = () => ({ matches: true });   // no typing: straight to the hold
    N.revenantSay(N.revenantTauntEvent(r, me.name, { rolls: () => 0 }));
    const hold = C._revenantCards()[0].leftMs;
    C.drawRevenantCards({ dt: hold / 1000, doc });
    assert.equal(C._revenantCards()[0].out, true, 'sliding');
    for (let i = 0; i < 13; i++) C.drawRevenantCards({ dt: 0.02, doc });   // 13 x 20ms = the 260ms slide, to the frame
    assert.equal(C._revenantCards().length, 0, 'down on the exact frame');
  });
});

test('ELITE-FLOOR online: a dungeon\'s elites are picked by the KIND\'s own level, the same on every client - a rat never, a class foe (the party\'s level) eligible - and the build does not ask the client\'s own level again (mutants: the per-client level asked)', async () => {
  const { pickDungeonElites, ELITE_FOE_MIN_LEVEL } = await import('../src/systems/eliteFoes.js');
  const recs = [{ mobileType: MOBILE_TYPES.Rat }, { mobileType: MOBILE_TYPES.Rat }, { mobileType: MOBILE_TYPES.Rat }, { mobileType: MOBILE_TYPES.Rat }];
  assert.equal(pickDungeonElites(recs, 'loc', { elite: true }), 0, `a rat (level ${ENEMY_BASICS[MOBILE_TYPES.Rat].level}) is under ${ELITE_FOE_MIN_LEVEL}`);
  const mixed = [{ mobileType: MOBILE_TYPES.Rat }, { mobileType: 130 }, { mobileType: MOBILE_TYPES.Orc }, { mobileType: 133 }];
  assert.ok(pickDungeonElites(mixed, 'loc', { elite: true }) >= 3);
  assert.equal(mixed[0].eliteFoe, undefined, 'never the rat');
});
