// AUDIT FOE-KEEPS (2026-10-24, bible/01-Overview/audits/Audit-Foe-Keeps.md - the owner, of FOE-KEEPS: "Audit this").
// Five cold lanes on frozen snapshots of 099949918; each finding fixed here is pinned under its id.
//   H1 (L1, P1, E5): a kill whose referee word came late - a hidden tab hears its socket and runs no frame, or a foe's
//     blow killed me on my own machine while a player's, in flight, reached the referee first - was read as a foe's
//     death: the remains took the kill's tenth and the rise the usual tenth again, under "You keep what you carry".
//     The kill is now the referee's word itself, whenever it comes (wildZone.js wildDeathAtHand), and the rise reads it.
//   H2: the same word makes a zone's death of one whose first dead frame found no room (the socket reconnecting).
//   H4: a Resurrect after a kill said the gold it claimed stayed in the purse - it lay in the remains.
//   O1, H5: the foe's-death line said "You keep what you carry" over the tenth the same death claims, and over a
//     revenant's theft at the rise - now "Nothing dropped".
//   O4: the tutorial's open-zone page named the mountains alone and said the bag and cart lost whole at a kill.
//   O5, N6: Hungarian's article before a vowel; Polish "we" before "Wr".
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setWildDeath, wildDeath, wildDeathLines, wildDeathAtHand, wildDeathKill, wildFallHeard, WILD_TEXT } from '../../../src/systems/wild/wildZone.js';
import * as tm from '../../../src/systems/textManager.js';
import { TUTORIALS } from '../../../src/systems/tutorialCatalogue.js';
import { wildInside, wildNear, wildRingAt, maskWorldBox } from '../../../src/systems/wild/wildZone.js';
import { cyrodiilMask } from '../../../src/systems/wild/cyrodiilZone.js';
import { wildRisePicks } from '../../../src/systems/wild/wildDeath.js';
import { HAS_ARENA2, loadMaps } from '../../arena1Data.mjs';
import { hostText } from '../../hostText.mjs';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const FELL = { r: '0123456789ab', by: 'peer-0002', room: 'world:400,120', at: 1 };

test('AUDIT FOE-KEEPS H1 THE KILL IS THE REFEREE\'S WORD, WHENEVER IT COMES: heard before the first dead frame, it stands through it; heard after, it makes the death a kill and names its killer on the screen; a take against my receipt makes one; only the death\'s end clears it - and a foe\'s death is none (mutants: the word unkept; the screen unnamed; the take no kill; the clear left out)', () => {
  setWildDeath(null);
  // a foe's death: no word
  setWildDeath({ killer: null, dropped: 0 });
  assert.equal(wildDeathKill(), false);
  assert.deepEqual(wildDeathLines(), [WILD_TEXT.deathKept(), WILD_TEXT.deathHold]);
  setWildDeath(null);
  // the word before the first dead frame (the frame found no fresh name - the old 15 s window)
  wildDeathAtHand(FELL, 'Borin');
  assert.equal(wildDeathKill(), true);
  assert.deepEqual(wildFallHeard(), FELL, 'the fall kept for the worn offer');
  setWildDeath({ killer: null, dropped: 0 });
  assert.equal(wildDeathKill(), true, 'the first dead frame keeps the word');
  assert.equal(wildDeath().kill, true);
  assert.deepEqual(wildDeathLines(), [WILD_TEXT.deathPvp(null), WILD_TEXT.deathHold], 'a kill on the screen - never "Nothing dropped"');
  setWildDeath(null);
  assert.deepEqual([wildDeathKill(), wildFallHeard(), wildDeath()], [false, null, null], 'the death\'s end clears it');
  // the word after the first dead frame (a foe's blow first on my machine, a player's first at the referee)
  setWildDeath({ killer: null, dropped: 0 });
  wildDeathAtHand(FELL, 'Borin');
  assert.deepEqual([wildDeathKill(), wildDeath().killer, wildDeath().kill], [true, 'Borin', true], 'named from then on');
  assert.deepEqual(wildDeathLines(), [WILD_TEXT.deathPvp('Borin'), WILD_TEXT.deathHold]);
  wildDeathAtHand(null, 'Cyrus');
  assert.equal(wildDeath().killer, 'Borin', 'a second word renames nobody');
  assert.deepEqual(wildFallHeard(), FELL, 'and keeps the fall');
  setWildDeath(null);
  // a take against my receipt, the word itself missed (a socket that reconnected between the two)
  setWildDeath({ killer: null, dropped: 0 });
  setWildDeath({ killer: null, kill: true, dropped: 3 });
  assert.equal(wildDeathKill(), true);
  assert.deepEqual(wildDeathLines(), [WILD_TEXT.deathPvp(null), WILD_TEXT.deathDrop(3), WILD_TEXT.deathHold]);
  setWildDeath(null);
});

test('AUDIT FOE-KEEPS H1 H2 H4 THE HOST: the referee\'s fall goes to the zone\'s word, never a window the first dead frame must meet; the rise skips the usual tenth at a kill and rises out of the zone at one whose death found no room; a take is a kill; a Resurrect after a kill spares nothing it did not (mutants: the window back; the rise reading the screen\'s name; the take no kill; the Resurrect reading the stated loss)', () => {
  const w = hostText('src/scenes/world.js');   // PIN MOVED (HOST-SPLIT): my take's answer in scenes/wildDropHost.js, read with its host
  assert.ok(w.includes('      wildDeathAtHand({ r: g.r, by: g.by, room, at: Date.now() }, peerName(g.by));'), 'my fall, the referee\'s word, kept beside the kill');
  assert.ok(!/_wildFell\b/.test(w), 'no second copy of the fall in the host');
  assert.ok(w.includes('    const fell = wildFallHeard();'), 'the first dead frame reads any fall since the last rise');
  assert.ok(!w.includes('15_000 ? _wildFell'), 'no 15-second window');
  assert.ok(w.includes('    const wildRise = !!wildDeath() || wildDeathKill(), wildKilled = wildDeathKill();'), 'the rise reads the kill');
  assert.ok(w.includes('    if (dd) setWildDeath({ killer: dd.killer, kill: true, dropped:'), 'my take is a kill');
  assert.ok(w.includes('      const wildSite = wildRise ? wildRiseSite(px, wasInDungeon, wildKilled) : null;'), 'E1: the rise knows a kill from a foe\'s death');
  // PIN MOVED (WORLD-WIDE folded into TESA, #1184): the zone's mask Cyrodiil's (WW-C2 retired the mountains')
  assert.ok(w.includes('    for (const pick of wildRisePicks(cyrodiilMask(), px, { inDungeon, kill })) {'), 'E1: over wildDeath.js\'s towns');
  const rez = /function resurrectInPlace\(rez\) \{[\s\S]*?\n {2}\}/.exec(w)?.[0] ?? '';
  assert.match(rez, /if \(_respawning\) return;\n\s+const spared = wildDeathKill\(\) \? 0 : statedDeathLoss\(\) \?\? 0;[^\n]*\n\s+wildGhostEnd\(\);/, 'read before the death ends');
  assert.ok(rez.includes('if (spared > 0) townTalk.say(RESURRECT_TEXT.spared(spared));'));
});

test('AUDIT FOE-KEEPS O1 H5 O4 O5 N6 THE WORDS: a foe\'s death says nothing dropped - true beside the tenth it claims and a revenant\'s theft; the tutorial names both zones, the cart only while it is with you, the tenth of a kill and of any other death, in the player\'s language and within a popup\'s sixty words (TUT1); Hungarian\'s "Az" and Polish "we" (mutants: the page\'s words read once)', () => {
  assert.equal(WILD_TEXT.deathKept(), 'Nothing dropped. Only another player\'s kill drops what you carry.');
  assert.doesNotMatch(WILD_TEXT.deathKept(), /keep/i, 'never "you keep" - the same death claims a tenth of the purse');
  const page = () => TUTORIALS.find((p) => p.id === 'wild-zone');
  assert.deepEqual(page().body, [
    // PIN MOVED (WORLD-WIDE folded into TESA, #1184): the zone Cyrodiil, in English and German alike
    'Players may fight one another in Cyrodiil and on the open Eltheric Ocean, where monsters are tougher and spoils richer.',
    'If another player kills you there, your bag drops with a tenth of your gold, and they may take one worn item. Your cart, companions\' packs and insured gear are kept. Any other death costs the usual tenth.',
  ]);   // PIN MOVED (STORE-KEEPS, WILD-INSURE, 2026-10-26): the cart and the packs are storage, kept; insured gear kept - PIN MOVED (TUT1): "companions' packs", the page under sixty words
  tm.patchLocaleTable('de', 'Port_Strings', tm.loadStringTableCsv(rd('locales/de/Port_Strings.csv')));
  try {
    tm.setLocale('de');
    assert.match(page().body[0], /^In Cyrodiil und auf dem offenen Eltheric-Ozean dürfen Spieler/);
    assert.equal(WILD_TEXT.deathKept(), 'Nichts fällt zu Boden. Was du trägst, fällt nur, wenn dich ein Spieler tötet.');
  } finally { tm.setLocale(tm.BASE_LOCALE); }
  assert.match(rd('locales/hu/Port_Strings.csv'), /^sea\.wild\.chipTip,"Az \{word\}-óceán /m);
  assert.match(rd('locales/pl/Port_Strings.csv'), /^wild\.zone\.enter,"Wkraczasz we \{zone\}, /m);
  // a short line: the classic face draws it unwrapped (AUDIT FOE-KEEPS O2 - the Indonesian ran past a phone's width)
  for (const lang of ['id', 'de', 'fi', 'fr', 'tr']) {
    const row = tm.loadStringTableCsv(rd(`locales/${lang}/Port_Strings.csv`)).find(([k]) => k === 'wild.death.kept');
    assert.ok(row && row[1].length <= 80, `${lang}: ${row?.[1].length}`);
  }
});

test('AUDIT FOE-KEEPS E1 THE RISE (the owner, asked: "Rise inside the zone"): over the zone\'s real mask, a death to a foe in every ring rises at a town or temple inside the zone in the ring it fell in - never the zone\'s free way out - and a kill outside the zone and its band; a hall\'s death at the city nearest it (mutants: a foe\'s rise outside; the ring unread; the kill\'s rise inside)', () => {
  // PIN MOVED (WORLD-WIDE folded into TESA, #1184): the open zone is Cyrodiil (WW-C2 retired the Wrothgarian Mountains').
  // The law read over the zone's real mask with towns stood in it, as the rise's search finds them (AUDIT TESA II P3: the
  // world's towns, scenes/tamrielPlacesHost.js nearestTownOf): a few in every ring, and the land's outside the zone's
  // band. The real map's rise is the next test's.
  const m = cyrodiilMask(), B = maskWorldBox(m);
  const towns = [], perRing = new Map();
  for (let y = B.y0; y <= B.y1; y += 23) for (let x = B.x0; x <= B.x1; x += 23) {
    const kind = (x + y) % 2 ? 'city' : 'temple';
    if (wildInside(m, x, y)) {
      const ring = wildRingAt(x, y, m), n = perRing.get(ring) ?? 0;
      perRing.set(ring, n + 1);
      if (n % 9 === 4) towns.push({ kind, mapPixel: { x, y } });
    } else if (!wildNear(m, x, y) && (x + y) % 5 === 0) towns.push({ kind, mapPixel: { x, y } });
  }
  const nearest = (px, pick) => {
    let best = null, bd = Infinity;
    for (const t of towns) { const d = (t.mapPixel.x - px.x) ** 2 + (t.mapPixel.y - px.y) ** 2; if (d < bd && pick(t)) { bd = d; best = t; } }
    return best;
  };
  const rise = (px, o) => { for (const pick of wildRisePicks(m, px, o)) { const at = nearest(px, pick); if (at) return at; } return null; };
  const seen = new Set();
  let n = 0;
  for (let y = B.y0; y <= B.y1; y += 37) for (let x = B.x0; x <= B.x1; x += 37) {
    if (!wildInside(m, x, y)) continue;
    const ring = wildRingAt(x, y, m), px = { x, y };
    const foe = rise(px, { kill: false }), kill = rise(px, { kill: true });
    assert.ok(foe && wildInside(m, foe.mapPixel.x, foe.mapPixel.y) && wildRingAt(foe.mapPixel.x, foe.mapPixel.y, m) === ring, `a foe's death at ${x},${y} (ring ${ring}) rises in its ring`);
    assert.ok(foe.kind === 'city' || foe.kind === 'temple');
    assert.ok(kill && !wildNear(m, kill.mapPixel.x, kill.mapPixel.y), `a kill at ${x},${y} rises outside`);
    seen.add(ring); n++;
  }
  assert.deepEqual([...seen].sort(), [1, 2, 3, 4], 'every ring sampled');
  assert.ok(n > 20);
  // a hall's death: the city nearest it, kill or foe (PVPDUNGEONS) - the same pick either way
  const hall = { x: Math.round((B.x0 + B.x1) / 2), y: Math.round((B.y0 + B.y1) / 2) };
  if (wildInside(m, hall.x, hall.y)) assert.deepEqual(rise(hall, { inDungeon: true, kill: false }), rise(hall, { inDungeon: true, kill: true }));
  // outside the zone the rise is as ever
  assert.equal(wildRisePicks(m, { x: 0, y: 0 }, { kill: false }).length, 1);
});

test('AUDIT FOE-KEEPS E1 ON THE REAL MAP (WORLD-WIDE folded into TESA, #1184; PIN MOVED, AUDIT TESA II P3/Z3): over the world\'s towns as the rise reads them (scenes/tamrielPlacesHost.js nearestTownOf - the registry\'s: the Bay\'s MAPS.BSA rows, and the places past the Bay on the freeware\'s trace, Cyrodiil\'s among them), a death in the zone to a foe rises at a town or temple inside the zone - in the ring it fell in wherever that ring holds one - and a kill outside the zone\'s band; before, the rise read MAPS.BSA\'s rows alone and put every death in the zone at a Bay town 900 pixels and more away (mutants: the places past the Bay unregistered; the rise over MAPS.BSA alone)', { skip: !HAS_ARENA2 && 'no ARENA2 (sh tools/fetch-data.sh)' }, async () => {
  const { DFPalette } = await import('../../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../../src/ui/tamrielTrace.js');
  const { setTamrielTrace } = await import('../../../src/world/tamriel/tamrielLand.js');
  const { setTamrielFit } = await import('../../../src/world/tamriel/tamrielFrame.js');
  const { createWorldPlaces } = await import('../../../src/world/worldWide/worldPlaces.js');
  const { bayPlaceRows, BAY_SOURCE } = await import('../../../src/world/worldWide/bayPlaces.js');
  const { pastBayPlaceRows, PAST_BAY_SOURCE } = await import('../../../src/world/pastBayRows.js');
  const { arenaPixels } = await import('../../../src/world/arenaPlaces.js');
  const { arenaTemplates, arenaTemplateOf } = await import('../../../src/world/arenaLocations.js');
  const { nearestSafePlace } = await import('../../../src/systems/deathRespawn.js');
  const { ARENA2 } = await import('../../arena1Data.mjs');
  const bytes = (n) => new Uint8Array(readFileSync(`${ARENA2}/${n}`));
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });   // the freeware's fit (TESA6's)
  try {
    const maps = loadMaps();
    const rows = [];
    for (let r = 0; r < maps.regionCount; r++) {
      if (!maps.getRegion(r)) continue;
      for (let l = 0; l < maps.baseLocationCount(r); l++) { const loc = maps.getLocation(r, l); if (loc?.exterior?.exteriorData) rows.push(loc); }
    }
    // the world host's registry: the Bay's rows, and the places past the Bay as tamrielPlacesHost.js registers them
    const places = createWorldPlaces(), t = arenaTemplates(rows);
    places.register(BAY_SOURCE, bayPlaceRows(rows));
    places.registerLive(PAST_BAY_SOURCE, { stamp: () => [arenaPixels()], rows: () => pastBayPlaceRows({ pixels: arenaPixels(), templateOf: (p) => arenaTemplateOf(t, p), capitals: true }) });
    const m = cyrodiilMask(), B = maskWorldBox(m);
    const lists = [places.all()];
    const town = (h) => h.kind === 'city' || h.kind === 'temple';
    const ringHolds = new Set();
    for (const p of places.all()) if (wildInside(m, p.px, p.py) && town(nearestSafePlace([[p]], { x: p.px, y: p.py }) ?? {})) ringHolds.add(wildRingAt(p.px, p.py, m));
    assert.ok(ringHolds.size >= 2, `Cyrodiil's towns stand in the zone's rings (${[...ringHolds]})`);
    const rise = (px, o) => { for (const pick of wildRisePicks(m, px, o)) { const at = nearestSafePlace(lists, px, pick); if (at) return at; } return null; };
    let n = 0, inRing = 0;
    for (let y = B.y0; y <= B.y1; y += 97) for (let x = B.x0; x <= B.x1; x += 97) {
      if (!wildInside(m, x, y)) continue;
      const ring = wildRingAt(x, y, m);
      const foe = rise({ x, y }, { kill: false }), kill = rise({ x, y }, { kill: true });
      assert.ok(foe && town(foe) && wildInside(m, foe.mapPixel.x, foe.mapPixel.y), `a foe's death at ${x},${y} rises inside the zone`);
      if (ringHolds.has(ring)) { assert.equal(wildRingAt(foe.mapPixel.x, foe.mapPixel.y, m), ring, `in its ring ${ring}`); inRing++; }
      assert.ok(kill && town(kill) && !wildNear(m, kill.mapPixel.x, kill.mapPixel.y), `a kill at ${x},${y} rises outside the band`);
      n++;
    }
    assert.ok(n > 100 && inRing === n, `${n} sampled, ${inRing} in their ring`);   // the freeware's map: 142, every ring holding a town
  } finally { setTamrielTrace(null); setTamrielFit(null); }
});

test('AUDIT FOE-KEEPS E3 THE FLEET ON THE OPEN SEA (the owner, asked: "Refuse on the open sea"): no Summon and no Send away into, out of or about its PvP waters - the player there, or the ship standing there - while it is a zone; in Veilhaven\'s peace and offline as before (mutants: the refusal unread; the ship\'s waters unread; the zone\'s word unread)', async () => {
  const { createFleetHost } = await import('../../../src/scenes/fleetHost.js');
  const F = await import('../../../src/systems/fleet.js');
  const { veilhaven } = await import('../../../src/world/ethericSea.js');
  const vh = veilhaven(), peace = { X: vh.px, Y: vh.py }, open = { X: vh.px - 60, Y: vh.py };   // ring II, west of her
  const SUMMON = 'Not on the open sea. Sail the ship there yourself.', AWAY = 'Not on the open sea. The crew won\'t sail it through without you.';
  const run = ({ me, hers, sea = true }) => {
    F._resetFleetForTests();
    F.knowShip(901, 2, 0, 1000);
    const boat = { uid: 901, hull: 2, variant: 0, crewed: true, GameObject: { activeSelf: false, position: [0, 0, 0] }, MapPixel: { ...hers } };
    const host = createFleetHost({ csa: () => ({ AllBoats: [boat], isSailing: () => false, state: {}, LayUpBoat: () => true, SummonBoat: () => null }), naval: () => null, pack: () => [], where: () => ({ inside: false, pixel: { ...me }, sea }), nearPort: () => true, nearestPort: () => ({ name: 'Veilhaven', ether: true }), veilApart: () => false });
    return { summon: host.act(901, 'summon').text, away: host.act(901, 'away').text };
  };
  assert.deepEqual(run({ me: open, hers: open }), { summon: SUMMON, away: AWAY }, 'about the open sea: risen at a freeport there, her where she was left');
  assert.deepEqual(run({ me: peace, hers: open }), { summon: SUMMON, away: AWAY }, 'out of it, to the peace');
  assert.equal(run({ me: open, hers: peace }).summon, SUMMON, 'into it');
  const calm = run({ me: peace, hers: peace });
  assert.ok(calm.summon !== SUMMON && calm.away !== AWAY, 'in Veilhaven\'s peace, as before');
  const off = run({ me: open, hers: open, sea: false });
  assert.ok(off.summon !== SUMMON && off.away !== AWAY, 'no zone (offline, or no relay refereeing it): as before');
  F._resetFleetForTests();
  assert.ok(rd('src/scenes/world.js').includes("feet: dwPlayerObjectPosition(), sea: !!online?.wildOk && !!etherSea };"), 'the host says when the open sea is a zone');
});

test('AUDIT FOE-KEEPS LETTERS-TENTH (the owner left it to the audit: "Your choice"): with the fallen\'s word a kill takes a tenth of each letter of credit\'s worth into the remains\' one gold pile, as it takes the coin\'s, and the letter stays; the game lowers its own letter by exactly that and says it; a quest\'s letter, one the ledger keeps and one worth under ten pay nothing; without the word the letters drop whole as before (mutants: the word unread; the share whole; the letter dropped too; the game\'s letter unlowered; the line unsaid)', async () => {
  const { takeWildDeath, wildTakeTook, WILD_FALL_LETTERS } = await import('../../../src/systems/wild/wildDropLaw.js');
  const { wildFallWords } = await import('../../../src/systems/wild/wildDeath.js');
  const { letterOfCredit } = await import('../../../src/systems/inventory.js');
  const { wildLettersOf } = await import('../../../src/systems/wild/wildZone.js');
  await import('../../../src/systems/item/itemLaw.js');
  const sheet = () => {
    const big = { ...letterOfCredit(50_000), uid: '00000000000000c1' }, tiny = { ...letterOfCredit(7), uid: '00000000000000c2' };
    const quest = { ...letterOfCredit(9_000), uid: '00000000000000c3', questItem: true }, barred = { ...letterOfCredit(20_000), uid: '00000000000000c4' };
    return { goldPieces: 1000, items: [big, tiny, quest, barred], wagonItems: [] };
  };
  const keep = (it) => it.uid === '00000000000000c4';
  const e = sheet(), twin = sheet();
  const d = takeWildDeath(e, -1, keep, null, { letters: true });
  assert.deepEqual(d.gold, { purse: 100, letters: { '00000000000000c1': 5_000 } });   // PIN MOVED (STORE-KEEPS): no cart's share to say
  assert.deepEqual(d.taken.map((it) => [it.group, it.stackCount]), [['Currency', 100 + 5_000]], 'one pile: the purse\'s tenth and the letter\'s - no letter taken');
  assert.deepEqual(e.items.map((it) => it.value), [45_000, 7, 9_000, 20_000], 'the letter lowered by its tenth, the rest whole, every one still in the wallet');
  // the game's own take: exactly that, by the letter's id
  const out = wildTakeTook(twin, [], d.gold);
  assert.deepEqual(twin.items.map((it) => it.value), [45_000, 7, 9_000, 20_000]);
  assert.equal(twin.goldPieces, 900);
  assert.deepEqual(wildLettersOf(out), { n: 0, gold: 0, tenth: 5_000 });
  setWildDeath({ killer: 'Borin', dropped: 1, letters: out });
  assert.ok(wildDeathLines().includes('A tenth of your letters of credit, 5,000 gold, lies where you fell.'));
  setWildDeath(null);
  // without the word: whole, as before (a game from before it)
  const old = sheet();
  const od = takeWildDeath(old, -1, keep, null);
  assert.equal(od.gold.letters, undefined);
  assert.deepEqual(od.taken.filter((it) => it.uid).map((it) => [it.uid, it.value]), [['00000000000000c1', 50_000], ['00000000000000c2', 7]], 'dropped whole');
  // my game says the word
  assert.equal(WILD_FALL_LETTERS, 1);
  assert.equal(wildFallWords().letters, WILD_FALL_LETTERS);   // PIN MOVED (STORE-KEEPS): the words carry no wagon
});

test('AUDIT FOE-KEEPS LETTERS-TENTH THROUGH THE SERVICE: the fallen\'s own ask with the word takes the letter\'s tenth off the record and answers it by the letter\'s id; asked again, the same; without the word, the letter whole; a seizure - which no game applies - takes the tenth (mutants: the service\'s word unread; the answer\'s letters unsaid; a seizure taking it whole)', async () => {
  const { standService } = await import('../../accountDb.mjs');
  const { seatRealm } = await import('../../realmSeat.mjs');
  const { mintWildReceipt, WILD_FALL_GRACE_S } = await import('../../../src/net/wild/wildReceipt.js');
  const { worldRoom } = await import('../../../src/net/wire.js');
  const { letterOfCredit } = await import('../../../src/systems/inventory.js');
  await import('../../../src/systems/item/itemLaw.js');
  const CELL = worldRoom(400, 120), nowS = () => Math.floor(Date.now() / 1000);
  const stand = async () => {
    const svc = await standService();
    const ria = await svc.registered('Riadne'), bo = await svc.registered('Borin');
    const R = await seatRealm(svc.env, ria.secret, 'Riadne', { name: 'Riadne', level: 9, goldPieces: 1000, items: [{ ...letterOfCredit(50_000), uid: '00000000000000c1' }], wagonItems: [] });
    const rec = () => JSON.parse(new TextDecoder().decode(svc.env.SAVES._map.get(svc.env.DB._raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(R.id).obj)));
    const receipt = (o = {}) => mintWildReceipt({ f: ria.id, c: R.id, k: bo.id, r: '0123456789d1', w: -1, ...o }, svc.gatePriv, { subtle: globalThis.crypto.subtle, nowS: o.nowS ?? nowS() });
    const fall = (body, who = ria) => svc.call('/v1/wild/fall', { room: CELL, ...body }, who.secret);
    return { R, bo, rec, receipt, fall };
  };
  const s = await stand();
  const rc = await s.receipt();
  const res = await s.fall({ receipt: rc, realm: s.R.at(), packs: 1, letters: 1 });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.gold, { purse: 100, cart: 0, letters: { '00000000000000c1': 5_000 } });
  assert.deepEqual(res.body.took, [], 'no piece taken');
  assert.equal(res.body.items.find((it) => it.group === 'Currency').stackCount, 5_100, 'the remains\' gold');
  assert.deepEqual([s.rec().goldPieces, s.rec().items.map((it) => it.value)], [900, [45_000]], 'off the record, the letter kept');
  const again = await s.fall({ receipt: rc, realm: s.R.at(), packs: 1, letters: 1 });
  assert.deepEqual(again.body.gold, res.body.gold, 'asked again, the same answer');
  // a tab from before the word
  const o = await stand();
  const od = (await o.fall({ receipt: await o.receipt(), realm: o.R.at(), packs: 1 })).body;
  assert.equal(od.gold.letters, undefined);
  assert.deepEqual([od.took, o.rec().items.map((it) => it.value)], [[], [50_000]], 'the letter kept whole - the bag drops nothing (PIN MOVED, PVP-REWARD: it dropped whole, as that game would apply)');
  // the killer's seizure past the grace
  const k = await stand();
  const sz = await k.fall({ receipt: await k.receipt({ nowS: nowS() - WILD_FALL_GRACE_S - 1 }) }, k.bo);
  assert.equal(sz.status, 200, JSON.stringify(sz.body));
  assert.deepEqual(sz.body.gold.letters, { '00000000000000c1': 5_000 });
  assert.deepEqual(k.rec().items.map((it) => it.value), [45_000]);
});
