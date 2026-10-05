// REVENANT AUDIT (2026-10-02, Mac: "Audit everything and ensure perfection") - every finding of the five-way audit of
// the Revenants (the records and their words, the kill-or-spare flow, the sworn companions, the UI, the burn and the
// portals), pinned by what it does where it can be run, and by its source where it is a host's wiring.

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};
const N = await import('../src/systems/revenant.js');
const P = await import('../src/systems/revenantPersonality.js');
const T = await import('../src/systems/revenantTrophy.js');
const F = await import('../src/systems/revenantFate.js');
const RC = await import('../src/systems/revenantCompanions.js');
const S = await import('../src/systems/companionSlots.js');
const H = await import('../src/systems/harmMark.js');
const { setPref, _resetForTests } = await import('../src/systems/uiPrefs.js');
const { modSaveRecords, restoreModSaveRecords } = await import('../src/systems/modSaveData.js');
const { validFoeRecord } = await import('../src/net/wire.js');
const { fateKey } = await import('../src/ui/revenantFateView.js');
const { createInventoryWindow } = await import('../src/ui/inventoryDoor.js');
const { createPortalSet, PORTAL_SOUND } = await import('../src/scenes/portalFx.js');
const { setPlayerDoor } = await import('../src/systems/playerDoor.js');

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const player = (id = 'char-audit') => ({
  isPlayer: true, name: 'Ayla Stormwind', characterId: id, level: 10, items: [], goldPieces: 0, activeEffects: [], health: 100, maxHealth: 100,
  stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
});
const orc = (over = {}) => ({ mobileType: MOBILE_TYPES.Orc, level: 6, health: 60, maxHealth: 60, team: 'Orcs', champion: 'mighty', ...over });
function fresh() {
  _resetForTests(); setPref('lootRarity', true);
  N._resetRevenantForTests(); RC._resetRetinueForTests(); S._resetCompanionSlotsForTests(); H._resetHarmMarkForTests(); _store.clear(); setPlayerDoor(null);
  S.registerCompanionCount('revenant', () => RC.revenantsWithYou().length);
}
const tick = () => new Promise((r) => setTimeout(r, 0));

// ── THE RECORDS ──────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT A1/A6: a judged revenant does no deed - executed, released or sworn, its poison finishing the player raises nothing and ranks nothing; one forgotten never lends its id; the cap never buries one standing in the world (mutants: a judged one ranked up; an executed one re-made under its own id; one standing buried)', () => {
  fresh();
  const me = player();
  RC.setRetinuePlayer(me);
  const e = orc();
  const r = N.revenantDeed(me, e, 'fled', { now: 10, rolls: () => 0 });
  N.revenantSpared(me, e, { state: 'with' });
  const rank = r.rank;
  assert.equal(N.revenantDeed(me, e, 'slew', { now: 20, rolls: () => 0 }), null, 'sworn: no deed');
  assert.equal(N.revenantById(r.id).rank, rank, 'not ranked up');
  const e2 = orc({ champion: 'swift' });
  const r2 = N.revenantDeed(me, e2, 'fled', { now: 30, rolls: () => 0 });
  N.revenantExecuted(me, e2);
  const before = N.allRevenants().length;
  assert.equal(N.revenantDeed(me, e2, 'slew', { now: 40, rolls: () => 0 }), null, 'executed: no deed');
  assert.equal(N.allRevenants().length, before, 'and no second record under its id');
  assert.equal(N.revenantById(r2.id).fate, 'executed');
  // the cap: five living and one out in the world - a sixth buries the weakest that is NOT out
  fresh();
  const out = N.revenantDeed(me, orc(), 'slew', { now: 0, rolls: () => 0 });   // a kill: it stands over the body (out)
  assert.equal(out.out, true);
  for (let i = 0; i < N.REVENANT_MAX; i++) N.revenantDeed(me, orc({ champion: 'stalwart' }), 'fled', { now: 100 + i, rolls: () => 0.4 });
  assert.ok(N.revenantById(out.id), 'the one standing is never buried');
  assert.equal(N.livingRevenants().length, N.REVENANT_MAX);
  // a tombstone's id is never worn again
  const e3 = orc({ revenant: { id: 'long-gone' } });
  const r3 = N.revenantDeed(me, e3, 'fled', { now: 500, rolls: () => 0 });
  assert.notEqual(r3.id, 'long-gone', 'a forgotten id is not reused');
});

test('AUDIT A1/A2: the harm mark - a beaten one kneeling clears its own mark, a load or a new game clears it, and a death it answered is not answered again (mutants: the yield keeps the mark; the restore keeps it)', () => {
  fresh();
  const foe = { health: 10 };
  H.markPlayerHarm(foe);
  H.clearPlayerHarm({ health: 5 });
  assert.equal(H.playerHarmMark(), foe, 'another foe judged leaves this one\'s mark');
  H.clearPlayerHarm(foe);
  assert.equal(H.playerHarmMark(), null, 'its own judged: cleared');
  H.markPlayerHarm(foe);
  restoreModSaveRecords(modSaveRecords());
  assert.equal(H.playerHarmMark(), null, 'a load: the last game\'s harm is nobody\'s');
  const src = read('src/systems/revenant.js');
  assert.match(src, /if \(rec && \(rec\.yielded \|\| rec\.executing \|\| rec\.sparing\)\) return;[^\n]*\n\s*clearPlayerHarm\(\);/, 'a kneeling one claims no kill; an answered death clears the mark');
  assert.match(read('src/systems/revenantFate.js'), /clearPlayerHarm\(f\.entity\);/, 'the yield clears its own');
});

test('AUDIT A3: one standing as the save is made comes back later, never beside a nameless copy - the street\'s save leaves it out, the slot pushes its due past REVENANT_LOST_MINUTES (mutants: the copy saved; due at once)', () => {
  fresh();
  const me = player();
  const r = N.revenantDeed(me, orc(), 'slew', { now: 0, rolls: () => 0 });
  r.dueAt = 0;
  const flat = JSON.stringify(modSaveRecords());
  assert.ok(flat.includes(r.id), 'the slot carries it');
  const m = flat.match(new RegExp(`"id":"${r.id}"[^}]*?"dueAt":(\\d+)`));
  assert.ok(m && Number(m[1]) >= N.REVENANT_LOST_MINUTES, `its due pushed on (${m?.[1]})`);
  assert.match(read('src/scenes/exteriorFoes.js'), /!f\.transient && !f\.entity\?\.revenant\)\.map\(\(f\) => \{/, 'the street\'s save leaves a revenant out');
});

test('AUDIT A4/A5: A SWORN ONE\'S PACK IS THE SAVE\'S - a load lays the save\'s pack over the mirror\'s (none where the save never knew it sworn); a release hands the pack back, gold to the purse (mutants: the mirror\'s pack kept; the pack destroyed)', async () => {
  fresh();
  const me = player('char-pack');
  RC.setRetinuePlayer(me);
  const e = orc();
  const r = N.revenantDeed(me, e, 'fled', { now: 0, rolls: () => 0 });
  N.revenantSpared(me, e, { state: 'with' });
  const party = RC.revenantParty();
  party.packOf(r.id).push({ name: 'Sword A', group: 'Weapons', templateIndex: 1 });
  const save = JSON.parse(JSON.stringify(modSaveRecords()));
  // after the save: the pack changes and the record moves on (a sending-away writes the mirror)
  party.packOf(r.id).push({ name: 'Sword B', group: 'Weapons', templateIndex: 2 });
  RC.sendRevenantAway(r.id);
  restoreModSaveRecords(save);
  const back = N.revenantRecord(me, r.id);
  assert.equal(back.companion.state, 'away', 'the mirror remembers where it is');
  assert.deepEqual(back.companion.items.map((i) => i.name), ['Sword A'], 'the save says what is in its pack');
  // the release hands it back
  const { isGoldPieces } = await import('../src/systems/inventory.js');
  const gold = { group: 'Currency', templateIndex: 0, stackCount: 40 };
  for (let t = 0; t < 400 && !isGoldPieces(gold); t++) gold.templateIndex = t;   // the gold template, whatever its index
  back.companion.items.push(gold);
  const items0 = me.items.length;
  RC.releaseRevenant(r.id);
  assert.equal(me.items.length, items0 + 1, 'the sword into the pack');
  assert.equal(me.goldPieces, 40, 'the gold into the purse, never a row');
  assert.match(read('src/ui/companionRoster.js'), /hands you back its pack/, 'the confirm says so');
});

test('AUDIT A7-A15: its words - the tally taunt only with kills to count, a revenant\'s flight knows the player\'s name, a beast\'s moment keeps what it says, a skeleton is never a wit, a $ in a name is a letter, three risen taunts each, one possessive for every title, the cornered say their words (mutants: the tally for a runner; a stranger to its own revenant; the body dropped; a mute kind talking temperaments)', () => {
  fresh();
  const me = player();
  const r = N.revenantDeed(me, orc(), 'fled', { now: 0, rolls: () => 0 });
  r.rank = 4; r.kills = 0; r.personality = 'humorous';
  for (let i = 0; i < 20; i++) assert.doesNotMatch(N.revenantTauntEvent(r, me.name, { rolls: () => i / 20 }).speech, /tally on my arm/, 'a runner keeps no tally');
  r.kills = 3;
  const said = new Set(); for (let i = 0; i < 3; i++) said.add(N.revenantTauntEvent(r, me.name, { rolls: () => i / 3 }).speech);
  assert.ok(P.voiceLines('humorous', 'taunt_risen').every((l) => said.has(l.replace(/\{p\}/g, 'Ayla'))), 'with kills, the risen\'s');
  for (const id of P.PERSONALITY_IDS ?? Object.keys(P.PERSONALITIES)) assert.ok(P.voiceLines(id, 'taunt_risen').length >= 3, `${id}: three risen taunts`);
  // the flight, by name
  r.personality = 'honourable';
  const fl = N.revenantFleeEvent({ revenant: { id: r.id }, mobileType: r.mobileType }, 'Orc', { playerName: 'Ayla Stormwind', rolls: () => 0.99 });
  assert.match(fl.speech, /Ayla/, 'its own revenant knows the name');
  const cor = N.revenantCorneredEvent({ revenant: { id: r.id }, mobileType: r.mobileType }, 'Orc', { playerName: 'Ayla', rolls: () => 0 });
  assert.ok(cor.line.includes(cor.speech), 'the cornered line says its words');
  // a beast's moment keeps the body
  const bat = { id: 'bat-1', name: 'Screech the Lucky', mobileType: MOBILE_TYPES.GiantBat, personality: 'craven', rank: 1, gender: 'male' };
  const ev = N.revenantMomentEvent('spared', bat, 'Ayla', { body: 'It waits until you call it.' });
  assert.equal(ev.speech, null);
  assert.match(ev.body, /It waits until you call it\.$/, 'the moment\'s own words after its deed');
  assert.match(ev.line, /It waits until you call it\.$/, 'and on the text line');
  // a mute kind leans as a beast
  const beastPool = new Set(['brutal', 'craven', 'humorous', 'cold', 'unhinged', 'weary', 'honourable']);
  for (const mt of [MOBILE_TYPES.SkeletalWarrior, MOBILE_TYPES.Zombie, MOBILE_TYPES.FireAtronach, MOBILE_TYPES.IronAtronach]) {
    for (let i = 0; i < 40; i++) assert.ok(beastPool.has(P.personalityFor(`id-${i}`, mt)), `kind ${mt}: never a wit or a zealot`);
    assert.equal(N.revenantSpeaks(mt), false);
  }
  // a $ in a name
  assert.equal(P.voiceLine('witty', 'escape', { p: 'Jo$&n', rolls: () => 0 }), 'Do keep the scar I gave you, Jo$&n. A keepsake.');
  // one possessive
  assert.equal(P.possessive('Varis'), "Varis'"); assert.equal(P.possessive('Ayla'), "Ayla's");
  const ep = N.revenantEpithet('slew', 4, 'Marcus', () => 0.99);
  assert.ok(!/Marcus's/.test(ep), `the epithet's possessive is the trophy's (${ep})`);
  assert.ok(N.REVENANT_EPITHETS.risen.some((x) => x === '{p}\'s Shadow'));
  assert.equal(N.revenantEpithet('slew', 1, '', () => 4.5 / 8), 'Bane of Stranger', 'a name in a title is capitalised');
});

// ── THE SWORN ────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT C4-C6: the rest never reads longer than a rest (an older save\'s clock); a spared one\'s companion waits for its portal; a fall, a sending-away and a load each end the member, so no spell it wore stands with it again (mutants: days of rest; two of it; the member kept)', () => {
  fresh();
  const me = player();
  RC.setRetinuePlayer(me);
  const e = orc();
  const r = N.revenantDeed(me, e, 'fled', { now: 0, rolls: () => 0 });
  N.revenantSpared(me, e, { state: 'with' });
  const rec = N.revenantRecord(me, r.id);
  rec.companion.state = 'resting'; rec.companion.until = 10000;
  assert.equal(RC.restUntil(rec, 5000), 5000 + RC.REVENANT_REST_MIN, 'an older clock: never more than a rest away');
  assert.equal(RC.restUntil(rec, 5240), 5480, 'the corrected deadline stays fixed as the clock advances');
  assert.equal(RC.restUntil(rec, 9900), 5480, 'an elapsed rest is not extended again');
  rec.companion.state = 'with'; rec.companion.until = null;
  const party = RC.revenantParty();
  RC.holdSworn(r.id, 60000);
  assert.equal(party.party.length, 0, 'held while the kneeling one gathers into its portal');
  RC.forgetSwornMember();
  const m1 = party.party[0];
  assert.ok(m1, 'free again');
  assert.equal(party.party[0], m1, 'one stand, one member');
  party.knock('rv', r.id, 100);
  N.revenantRecord(me, r.id).companion.state = 'with';
  assert.notEqual(party.party[0], m1, 'a fall ends the member - its carried spells with it');
  const m2 = party.party[0];
  RC.forgetSwornMember();
  assert.notEqual(party.party[0], m2, 'a load ends every one');
  assert.match(read('src/systems/revenantFate.js'), /if \(state === 'with'\) holdSworn\(r\.id, SPARING_MS\);/);
});

test('AUDIT C3/C7: the world keeps the slots and the words true - past the slots the most lately sworn steps away; opposite acts in one pause cancel; a load forgets the words and the members (mutants: a fourth at the side; a dismiss said for one that never left)', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /if \(companionsWithYou\(\) > COMPANION_SLOTS\) \{\n\s*const last = revenantsWithYou\(\)\.sort\(\(a, b\) => \(b\.swornAt \?\? 0\) - \(a\.swornAt \?\? 0\)\)\[0\];\n\s*if \(last && sendRevenantAway\(last\.id\)\)/);
  assert.match(w, /if \(kind === 'arrive'\) \{ if \(sentAt >= 0\) _revenantDepartures\.splice\(sentAt, 1\); else noteRevenantArrival\(r\.id\); return; \}/);
  assert.match(w, /const clearSworn = \(\) => \{ revenantAshore\.clear\(\); _revenantArrivals\.clear\(\); _revenantDepartures\.length = 0; forgetSwornMember\(\); \};/);
  assert.equal((w.match(/clearSworn\(\);/g) ?? []).length, 2, 'the quickload and a same-dungeon load');
});

// ── THE FATE ─────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT B1/B4/B6: the window holds the wait; one held is no swing\'s, spell\'s or shaft\'s; the executed hand their pack to the pile once (mutants: the wait runs under the window; a kneeling one struck by the swing; its pack saved twice)', () => {
  const f = { yielded: { at: 0 }, ai: { feet: [0, 0, 0] } };
  let open = true;
  f.yielded.judging = () => open;
  assert.equal(F.yieldStep(f, [500, 0, 0], F.REVENANT_YIELD_MS + 1), null, 'under the window: no slip, however long, however far');
  assert.equal(f.yielded.held ?? 0, 0, 'none of its wait spent');
  open = false;
  assert.equal(F.yieldStep(f, [0, 0, 0], F.REVENANT_YIELD_MS + 1), 'slip', 'the window shut: its wait runs again');
  assert.equal(F.fateHeld({ executing: {} }), true); assert.equal(F.fateHeld({}), false);
  const list = [{ yielded: {} }, { a: 1 }, { sparing: {} }, { leaving: {} }];
  assert.deepEqual(F.dropFateHeld(list), [{ a: 1 }]);
  const x = read('src/scenes/exteriorFoes.js'), d = read('src/scenes/dungeonContext.js');
  assert.match(x, /const live = dropFateHeld\(foes\.filter\(\(f\) => !f\.dead && !isShipmate\(f\)\)\);/);
  assert.match(d, /const live = dropFateHeld\(foes\.filter\(\(f\) => !f\.dead && f\.companion == null\)\);/);
  assert.match(read('src/scenes/hostMagic.js'), /if \(foe\?\.yielded \|\| foe\?\.executing \|\| foe\?\.sparing \|\| foe\?\.leaving\) return null;/);
  assert.match(read('src/combat/arrowFlight.js'), /if \(foe\.yielded \|\| foe\.executing \|\| foe\.sparing \|\| foe\.leaving\) return 0;/, 'the player\'s shaft lands nothing on one held (every host\'s one copy)');
  assert.match(read('src/scenes/world.js'), /else if \(rec\.yielded\) rec\.yielded\.judging = \(\) => !w\.done;/, 'the host holds it while its window stands');
  // the pile takes the pack - the record keeps none
  fresh();
  const me = player();
  const e = orc({ items: [{ name: 'Axe' }] });
  N.revenantDeed(me, e, 'fled', { now: 0, rolls: () => 0 });
  const g = { entity: e, trophy: { name: 'Trophy' } };
  assert.deepEqual(F.finishExecution(me, g).map((i) => i.name), ['Axe', 'Trophy']);
  assert.deepEqual(e.items, [], 'handed over, not copied');
  // the dungeon's save: gone with no body, laid with none
  assert.match(d, /\.\.\.\(f\.dead && \(f\.escaped \|\| f\.executed \|\| f\._swornAway\) \? \{ noBody: true \} : \{\}\)/);
  assert.match(d, /if \(sf\.noBody && sf\.dead\) \{ if \(!f\.dead\) questPoolOps\.removeFoe\(f\);[^\n]*\n\s*patchFoe\(f, sf, wire\);/, 'ahead of the patch that lays a corpse');
  assert.match(d, /for \(const f of foes\) \{ if \(!f\) continue; f\.yielded = null; f\.executing = null; f\.sparing = null; f\.trophy = null; f\.yieldEvent = null; \}/, 'a same-dungeon load ends a judgement in flight');
  assert.match(d, /for \(const f of w\.foes\) delete f\.noBody;/, 'the room\'s door has no field for it');
});

test('AUDIT B2/B3/B5/P1-P3: the execution pays its Renown and takes its soul; a flyer kneels on the ground and its pile lies there; an adopted foe stands as itself; a peer sees the oath; the dungeon\'s hover says beaten (mutants: no Renown past the assist window; no soul; a floating pile; a sworn one invisible to peers)', () => {
  const x = read('src/scenes/exteriorFoes.js'), d = read('src/scenes/dungeonContext.js');
  for (const [name, src] of [['street', x], ['dungeon', d]]) {
    assert.match(src, /if \(id === 'kill'\) \{\n\s*renownFoeStruck\(f\);/, `${name}: the execution is my blow`);
    assert.match(src, /const trap = attemptSoulTrap\(f\.entity, f\.mobileType, playerEntity\.items, Math\.random\(\)\);/, `${name}: its soul`);
    assert.match(src, /isAzurasStarEquipped\(playerEntity\) && fillEmptyTrap\(playerEntity\.items, f\.mobileType, \{ azurasStarOnly: true \}\)/, `${name}: the Star`);
    assert.match(src, /if \(f\.ai\?\.flies(?: && collider)?\) \{ const g = floorLanding\(collider, \[f\.ai\.feet\[0\], f\.ai\.feet\[1\] \+ 0\.1, f\.ai\.feet\[2\]\]\); if \(g && g\[1\] < f\.ai\.feet\[1\]\) f\.ai\.feet\[1\] = g\[1\]; \}/, `${name}: a flyer kneels on the ground`);
  }
  assert.match(x, /const feet = collider \? floorLanding\(collider, \[f\.ai\.feet\[0\], f\.ai\.feet\[1\] \+ 0\.1, f\.ai\.feet\[2\]\]\)/, 'the street\'s pile on the ground');
  assert.match(d, /const feet = floorLanding\(collider, \[f\.ai\.feet\[0\], f\.ai\.feet\[1\] \+ 0\.1, f\.ai\.feet\[2\]\]\);/, 'the dungeon\'s');
  assert.match(x, /f\._pupYield = false; f\._pupExec = null; f\._pupSpare = null;/, 'adopted: its owner\'s judgement goes with the owner');
  assert.match(x, /\.\.\.\(f\.sparing \? \{ sp: 1 \} : \{\}\)/);
  assert.match(x, /f\._pupSpare = r\.sp === 1 \? \(f\._pupSpare \?\? Date\.now\(\)\) : null;/);
  const base = { i: 1, t: 2, x: 0, f: [0, 0, 0], y: 0 };
  assert.equal(validFoeRecord({ ...base, sp: 1 })?.sp, 1, 'the oath rides the wire');
  assert.equal(validFoeRecord({ ...base, sp: 2 }), null, '1 or absent');
  assert.match(d, /return t \? \{ title: f\.yielded \? `\$\{t\} - beaten` : t, subs: questFoeSubs\(f\) \} : null;/, 'the dungeon\'s hover says beaten (QUEST-FOE-LINE: and a quest foe\'s line beside it)');
});

// ── THE UI ───────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT D1/D4/D5: Enter on a focused button is that button\'s; the judgement opens in beast form; the classic box keys short and its details wrapped, a refused choice saying why (mutants: Enter confirms over Back; the beast refuses; a long label)', () => {
  const fate = { options: [{ id: 'kill', key: 'K', label: 'Kill', detail: 'It drops a rod', disabled: false }, { id: 'spare', key: 'S', label: 'Spare', detail: 'You keep 6 sworn already - release one first', disabled: true }], name: 'Grushnak', sub: 'Rank II', plea: { speech: 'Mercy!' }, choose: () => {} };
  const got = [];
  const kit = { onPick: (id) => got.push(['pick', id]), onChoose: (id) => got.push(['choose', id]) };
  assert.equal(fateKey({ key: 'Enter', target: { closest: () => ({}) } }, fate, 'kill', kit), false, 'a focused button keeps its Enter');
  assert.equal(fateKey({ key: 'Enter', target: { closest: () => null } }, fate, 'kill', kit), true);
  assert.deepEqual(got, [['choose', 'kill']]);
  const w = createInventoryWindow({ fate, entity: { isPlayer: true, items: [] } });
  assert.deepEqual(w.options.map((o) => o.label), ['K - Kill', 'Esc - Leave it kneeling'], 'short keys; the refused one not offered');
  assert.ok(w.lines.some((l) => /Spare: You keep 6 sworn already/.test(l)), 'its reason in the wrapped lines');
});

test('AUDIT D2/D6-D12: the window fits a phone; an armed Release never outlives the visit; the bar the green it wears; the costly presses in blood; the rows cards, not presses; the trophy\'s card on the hover; the keys a disabled choice is not offered (source)', () => {
  const v = read('src/ui/revenantFateView.js');
  assert.match(v, /\.pack-shell \.loot-win\.fate \{ width: 380px; max-height: min\(700px, 92dvh\); overflow-y: auto; \}/);
  assert.match(v, /\.pack-shell \.fatecol \.fatelist \{ flex: 0 0 auto; min-height: auto; \}/);
  assert.match(v, /fate\.options\.filter\(\(o\) => !o\.disabled\)\.map\(\(o\) => `\$\{o\.key\} \$\{o\.label\.toLowerCase\(\)\}`\)/);
  assert.match(read('src/ui/enhancedMenu.js'), /resetCompanionRoster\(\);   \/\/ COMPANION-ROSTER: nor an armed Release/);
  const roster = read('src/ui/companionRoster.js');
  assert.match(roster, /meter\(Math\.max\(0, Math\.round\(h\)\), Math\.round\(hm\), 'verdigris'\)/);
  const inv = read('src/ui/enhancedInventory.js');
  assert.match(inv, /row\.onmouseenter = \(\) => \{ if \(getPref\('plusItemHover'\) !== false\) showTip\(item, 'remote', row\); \};\n\s*row\.onmouseleave = hideTip;\n\s*\},/, 'the trophy\'s card');
  assert.match(inv, /if \(id\) host\?\.querySelector\?\.\('\.fate-confirm'\)\?\.scrollIntoView\?\.\(\{ block: 'nearest' \}\);/, 'the confirm brought into view');
});

// ── THE BURN AND THE PORTALS ─────────────────────────────────────────────────────────────────────────────────────
test('AUDIT E2/E7/E8: the portal speaks by its sound ID; the leave hand-offs wait for the foe loop; no portal standing allocates nothing (mutants: an index played; the splice under the loop)', () => {
  const played = [];
  const renderer = { createBillboardBatch: () => ({ conceal: undefined }), destroyBillboardBatch: () => {}, uploadTexture: () => {}, uploadEmissionTexture: () => {} };
  const set = createPortalSet({ renderer, audio: { play3dId: (id) => played.push(['id', id]), play3d: (i) => played.push(['index', i]) }, now: () => 0 });
  assert.equal(set.batches(), set.batches(), 'none standing: one shared empty list');
  set.open([0, 0, 0]);
  assert.deepEqual(played, [['id', PORTAL_SOUND]]);
  for (const p of ['src/scenes/exteriorFoes.js', 'src/scenes/dungeonContext.js']) {
    const s = read(p);
    assert.match(s, /_leftDone\.push\(f, f\.leaving\.done\); f\.leaving = null;/, `${p}: queued`);
    assert.match(s, /if \(_leftDone\.length\) runLeftDone\(\);/, `${p}: run after the loop`);
  }
});

test('AUDIT B1 end to end: a revenant\'s choice made on one gone is said, never silent (source)', async () => {
  await tick();
  assert.match(read('src/scenes/world.js'), /model\.choose = \(id\) => \{ if \(!model\.live\(\) \|\| !choose\(id\)\) townTalk\.say\(`\$\{model\.given \?\? 'It'\} is gone\.`\); \};/);
});
