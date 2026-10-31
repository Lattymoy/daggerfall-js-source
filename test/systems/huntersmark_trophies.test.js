// HUNTERS-MARK (2026-10-27; bible/06-Systems/Bounty-Boards.md 12.5, Professions-Arc.md section 58, 10-UI/Collections.md
// section 9): THE MOUNTED TROPHY AND WHAT A CHARACTER GATHERS - the trophy minted (a named mark's and a beast's, a mod's
// beast drawn as its hide's kin), hung as a mount with its own name and its plaque composed at runtime; the Trophy Hunter
// built on the real Worker (a clean pelt of a grade 5 or 6 body, the spec's alone) and minted once a body by the hunt's
// kind; the gathered log (a fish once a haul, a trophy as minted) and the Collections page's three parts read off it.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { byClass } from '../chargenDom.mjs';
import { standService, T0 } from '../accountDb.mjs';
import { bodyKey, haulKey } from '../../src/net/nodeLaw.js';
import { xpForRank, HIDES, HIGH_HIDE_TIER, TROPHY_HUNTER, trophyHunted } from '../../src/net/professionLaw.js';
import { BOUNTY_TIERS } from '../../src/systems/bounty/bountyBoard.js';
import { TROPHY_TEMPLATE, trophyFoeOf, trophyNameIndexOf } from '../../src/net/trophyLaw.js';
import { decorIsTrophy, decorIsMount } from '../../src/net/decorLaw.js';
import { mintTrophy, giveTrophySaved, trophyDoor, trophyArchiveOf, trophyTitleOf, TROPHY_BEASTS } from '../../src/systems/hunt/trophies.js';
import { readGathered, noteGathered, gatheredOf, _resetGatheredForTests, GATHERED_VENDOR } from '../../src/systems/hunt/gatheredLog.js';
import { registeredModSaveVendors, modSaveRecords } from '../../src/systems/modSaveData.js';
import { decorOwnEntry, decorItemName, decorStandOf } from '../../src/systems/decor/decorItems.js';
import { composeTrophy, loadTrophyArt, TROPHY_W, TROPHY_H, TROPHY_M, TROPHY_WOOD, TROPHY_BRASS } from '../../src/scenes/decor/trophyArt.js';
import { huntKind, trophyLine } from '../../src/scenes/huntHost.js';
import { fishKind, speciesOfHaul } from '../../src/scenes/fishHost.js';
import { PASSIVE_FISH_SPECIES } from '../../src/world/passiveFish.js';
import { EG_ANNALS, EG_ANNALS_FOUND } from '../../src/net/eliteGates/egAnnals.js';
import { GATHERED_PARTS, gatheredCount, drawGatheredPart, annalsHeldOf } from '../../src/ui/collections/gatheredPart.js';
import { partCount } from '../../src/ui/collectionsPage.js';
import { utcDay } from '../../src/net/marksLaw.js';
import '../../src/systems/professions/profTemplates.js';   // the Mounted Trophy's row, as the game registers it
import { readFileSync } from 'node:fs';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

const MOB = { GrizzlyBear: 4, Harpy: 13, Gargoyle: 22, Dreugh: 41, Dragonling: 34 };
const LAND_DREUGH = 279;   // Daggerfall Enemy Expansion's, no row of the classic game's own
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const kit = { el, divider: (w) => el('h3', 'div', w) };

test('HUNTERS-MARK THE TROPHY: a mark\'s carries its beast and its name, a beast\'s its beast alone, a mod\'s beast drawn as its hide\'s first classic foe, a beast with no picture none; it hangs as a mount of its own, never stands, named the same off its numbers (mutants: the name\'s index; the kin\'s archive; the mount\'s check; the stand\'s refusal; the descriptor\'s beast)', () => {
  _resetGatheredForTests();
  const named = mintTrophy(MOB.Gargoyle, { nameIndex: 2, day: 20500 });
  assert.equal(named.templateIndex, TROPHY_TEMPLATE);
  assert.equal(named.group, 'UselessItems2');
  assert.equal(named.message, MOB.Gargoyle);
  assert.equal(named.variant, 3, 'the name\'s index, plus one');
  assert.equal(named.name, 'Trophy: Scarneck the Gargoyle');
  assert.equal(named.worldTextureArchive, trophyArchiveOf(MOB.Gargoyle));
  assert.equal(trophyFoeOf(named), MOB.Gargoyle);
  assert.equal(trophyNameIndexOf(named), 2);
  assert.equal(trophyTitleOf(named), 'Scarneck the Gargoyle');
  const plain = mintTrophy(MOB.Harpy);
  assert.equal(plain.variant, 0);
  assert.equal(trophyNameIndexOf(plain), null);
  assert.equal(plain.name, 'Trophy: Harpy');
  assert.equal(trophyArchiveOf(LAND_DREUGH), trophyArchiveOf(MOB.Dreugh), 'a mod\'s beast, its hide\'s first classic foe\'s picture');
  assert.equal(mintTrophy(9999), null, 'no picture: no trophy');
  assert.equal(mintTrophy(MOB.Harpy, { nameIndex: 99 }).variant, 0, 'a name out of the list is none');
  assert.deepEqual(gatheredOf('trophies'), { [MOB.Gargoyle]: { n: 1, day: 20500 } }, 'the log notes a trophy with its day');
  // hung
  const entry = decorOwnEntry(named, 0);
  assert.equal(entry.mount, true, 'it hangs');
  assert.deepEqual(entry.flat, [trophyArchiveOf(MOB.Gargoyle), 0]);
  assert.equal(entry.item.p, MOB.Gargoyle, 'its beast rides its descriptor');
  assert.equal(decorStandOf(named), null, 'never stands');
  assert.equal(decorItemName(entry.item), 'Trophy: Scarneck the Gargoyle', 'a visitor reads the same name');
  const piece = { model: null, flat: entry.flat, item: entry.item };
  assert.equal(decorIsMount(piece), true);
  assert.equal(decorIsTrophy(piece), true);
  assert.equal(decorIsTrophy({ ...piece, item: { ...entry.item, p: null } }), false, 'no beast: no trophy');
  assert.equal(decorIsTrophy({ ...piece, item: { ...entry.item, t: 600 } }), false);
  // every beast a trophy can be of
  for (const t of BOUNTY_TIERS) for (const f of t.foes) assert.ok(TROPHY_BEASTS.includes(f), `the boards' ${f}`);
  for (const h of HIDES.filter((x) => x.tier >= HIGH_HIDE_TIER)) assert.ok(TROPHY_BEASTS.includes(h.foes[0]), h.key);
  assert.equal(TROPHY_BEASTS.includes(LAND_DREUGH), false, 'a mod\'s beast listed only once taken');
  assert.equal(TROPHY_BEASTS.includes(MOB.GrizzlyBear), true, 'a board\'s beast, though its hide is low');
});

test('HUNTERS-MARK THE PLAQUE: a shield of wood with a brass plate, clear outside, the beast\'s opaque box fitted into its upper part in the port\'s bottom-up order; the loader uploads it once under its own key, or answers null (mutants: the rows not flipped; the box not fitted; the upload\'s key)', async () => {
  const at = (img, x, yTop) => { const i = ((TROPHY_H - 1 - yTop) * TROPHY_W + x) * 4; return [...img.colors.slice(i, i + 4)]; };
  const bare = composeTrophy(null);
  assert.equal(bare.width, TROPHY_W);
  assert.equal(bare.colors.length, TROPHY_W * TROPHY_H * 4);
  assert.equal(at(bare, 0, 0)[3], 0, 'outside the shield\'s rounded corner: clear');
  assert.equal(at(bare, 4, TROPHY_H - 1)[3], 0, 'beside its point: clear');
  assert.equal(at(bare, TROPHY_W / 2, TROPHY_H - 2)[3], 255, 'the point itself');
  const mid = at(bare, TROPHY_W / 2, Math.round(TROPHY_H * 0.4));
  assert.equal(mid[3], 255);
  assert.ok(Math.abs(mid[0] - TROPHY_WOOD[0]) < 40 && mid[0] > mid[2], 'the wood');
  assert.deepEqual(at(bare, TROPHY_W / 2, Math.round(TROPHY_H * 0.82)).slice(0, 3), [...TROPHY_BRASS], 'the plate');
  // a red beast, 4x2, its top row only opaque (color32's row 0 the bottom: the top row is the last)
  const fw = 4, fh = 2;
  const colors = new Uint8ClampedArray(fw * fh * 4);
  for (let x = 0; x < fw; x++) { const i = (1 * fw + x) * 4; colors.set([200, 10, 10, 255], i); }
  const art = composeTrophy({ width: fw, height: fh, colors });
  let red = 0, lowest = -1;
  for (let y = 0; y < TROPHY_H; y++) for (let x = 0; x < TROPHY_W; x++) { const c = at(art, x, y); if (c[0] === 200 && c[1] === 10) { red++; lowest = Math.max(lowest, y); } }
  assert.ok(red > 500, 'the beast fitted, large');
  assert.ok(lowest <= Math.round(TROPHY_H * 0.74) && lowest > TROPHY_H * 0.6, 'its feet on the box\'s floor, above the plate');
  const uploads = [];
  const tex = { recordCount: 1, getDFBitmap: () => ({ width: fw, height: fh, data: new Uint8Array(fw * fh) }), getColor32: () => ({ width: fw, height: fh, colors }) };
  const renderer = { uploadTexture: (...a) => { uploads.push(a); return { id: 7 }; } };
  assert.deepEqual(await loadTrophyArt({ getTexture: () => tex, renderer }, 277), { tex: { id: 7 }, w: TROPHY_M.w, h: TROPHY_M.h });
  assert.equal(uploads[0][0], 'trophy');
  assert.equal(uploads[0][1], 277);
  assert.equal(uploads[0][2].width, TROPHY_W);
  assert.equal(await loadTrophyArt({ getTexture: () => null, renderer }, 277), null, 'no texture: none');
  assert.equal(await loadTrophyArt({ getTexture: () => Promise.reject(new Error('gone')), renderer }, 277), null);
});

test('HUNTERS-MARK THE TROPHY HUNTER on the real Worker: a clean pelt of a grade 5 or 6 body under the spec says a trophy; a torn-free but unclean pelt, a low body or another spec none; the hunt\'s kind mints it once a body, of the beast skinned, and says so (mutants: the clean check; the tier\'s floor; the spec; minted twice)', async (t) => {
  const NOON = utcDay(T0) * 86_400 + 12 * 3600;
  t.mock.method(Date, 'now', () => NOON * 1000);
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const mac = await s.seated('Mac');
  const ann = await s.seated('Ann');
  const spec = (who, spec100) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, spec100, updated_at) VALUES (?, ?, 'hunting', ?, NULL, ?, ?)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET spec100 = excluded.spec100`).run(who.id, who.character, xpForRank(100), spec100, NOON - 30 * 86_400);
  let n = 0;
  const skin = async (who, foe, clean) => {
    const r = await s.call('/v1/prof/harvest', {
      character: who.character, node: bodyKey({ day: utcDay(NOON), id: (++n).toString(16).padStart(12, '0') }), kind: 'hide', foe,
      act: { clean, torn: false }, at: NOON - 2, rid: `trophy-${String(n).padStart(6, '0')}`,
    }, who.secret);
    assert.equal(r.body.ok, true, JSON.stringify(r.body));   // a harvest the service took - the rare hides' day not spent
    return r.body;
  };
  spec(mac, TROPHY_HUNTER);
  spec(ann, 'butcher');
  assert.equal((await skin(mac, MOB.Harpy, true)).trophy, true, 'a clean pelt of a grade 5 body');
  assert.equal((await skin(mac, MOB.GrizzlyBear, true)).trophy, undefined, 'a grade 2 body');
  assert.equal((await skin(mac, MOB.Harpy, false)).trophy, undefined, 'not clean');
  assert.equal((await skin(ann, MOB.Dragonling, true)).trophy, undefined, 'another spec');
  assert.deepEqual([trophyHunted({ spec100: TROPHY_HUNTER, tier: 6, clean: true }), trophyHunted({ spec100: TROPHY_HUNTER, tier: 4, clean: true })], [true, false]);
  // the kind: once a body, the beast skinned
  _resetGatheredForTests();
  let saves = 0;
  const kind = huntKind({ book: { state: {} }, bodies: () => [], trophy: trophyDoor({ changed: () => { saves++; } }) });
  const entity = { items: [] };
  const said = [];
  const node = bodyKey({ day: utcDay(NOON), id: 'abcdefabcdef' });
  kind.answered({ trophy: true, node, material: 'hide:harpy' }, (l) => said.push(l), { entity });
  kind.answered({ trophy: true, node, material: 'hide:harpy' }, (l) => said.push(l), { entity });
  assert.equal(entity.items.length, 1, 'once');
  assert.equal(entity.items[0].message, MOB.Harpy, 'its hide\'s beast, the page reloaded since the skinning');
  assert.deepEqual(said, [trophyLine(MOB.Harpy)]);
  assert.equal(saves, 1, 'the save told');
  kind.answered({ node: bodyKey({ day: utcDay(NOON), id: 'abcdefabcdee' }), material: 'hide:harpy' }, (l) => said.push(l), { entity });
  assert.equal(entity.items.length, 1, 'no trophy in the answer: none');
  assert.equal(giveTrophySaved(null, MOB.Harpy, () => { saves++; }), false, 'no one to give it to');
});

test('HUNTERS-MARK THE GATHERED LOG AND THE COLLECTIONS PAGE\'S PARTS: a fish logged once a haul on its key\'s day, a trophy as minted, the save\'s record read defensively; the Trophies and Fish parts list the whole set, held or not; the Annals part the pages the account keeps, or asks a sign-in (mutants: a haul logged twice; the first day overwritten; a bad row kept; the annals\' bits read wrong; the part\'s count)', () => {
  assert.ok(registeredModSaveVendors().includes(GATHERED_VENDOR));
  _resetGatheredForTests();
  assert.deepEqual(readGathered({ fish: { 9002: { n: 2, day: 20000 }, x: { n: 1, day: 1 }, 9003: { n: 0, day: 1 } }, trophies: [] }), { fish: { 9002: { n: 2, day: 20000 } }, trophies: {} });
  noteGathered('trophies', MOB.Harpy, 20100);
  noteGathered('trophies', MOB.Harpy, 20200);
  assert.deepEqual(gatheredOf('trophies')[MOB.Harpy], { n: 2, day: 20100 }, 'the first day kept');
  assert.equal(noteGathered('gems', 1, 1), false);
  assert.deepEqual(modSaveRecords()[GATHERED_VENDOR].trophies[MOB.Harpy], { n: 2, day: 20100 }, 'into the save');
  // the net's haul, once however many answers say it
  const node = haulKey({ x: 300, y: 200, day: 20724, id: '0123456789ab' });
  const fish = fishKind({ book: { state: {} }, host: { climateAt: () => 231, trophy: () => false } });
  fish.answered({ node }, () => {});
  fish.answered({ node }, () => {});
  const species = speciesOfHaul(node, 231);
  assert.deepEqual(gatheredOf('fish')[species.templateIndex], { n: 1, day: 20724 }, 'once, on the haul key\'s day');
  // the parts
  assert.deepEqual(GATHERED_PARTS.map(([id]) => id), ['trophies', 'fish', 'tunes', 'annals']);   // PIN MOVED (MUSIC-BOX): the Tunes, the character's third
  assert.deepEqual(gatheredCount('trophies', null), { held: 1, total: TROPHY_BEASTS.length });
  assert.deepEqual(partCount('fish', null), { held: 1, total: PASSIVE_FISH_SPECIES.length }, 'the page\'s tile reads the part');
  assert.deepEqual(gatheredCount('annals', null), { held: null, total: EG_ANNALS.length }, 'the account not read');
  assert.deepEqual(annalsHeldOf({ annals: 0b101 | (1 << 17) }), [0, 2, 17]);
  assert.equal(annalsHeldOf({ annals: -1 }), null);
  const draw = (id, w) => { const d = el('div'); drawGatheredPart(d, kit, id, w); return d; };
  const t = draw('trophies', null);
  assert.equal(byClass(t, 'codex-line').length, TROPHY_BEASTS.length);
  const found = byClass(t, 'found');
  assert.equal(found.length, 1);
  assert.match(found[0].textContent, /^Harpy2 taken · first on 2025-0/);
  const f = draw('fish', null);
  assert.equal(byClass(f, 'codex-line').length, PASSIVE_FISH_SPECIES.length);
  assert.match(byClass(f, 'found')[0].textContent, new RegExp(`^${species.itemName}1 hauls · first on `));
  const a = draw('annals', { annals: 0b11 });
  assert.equal(byClass(a, 'found').length, 2);
  assert.match(byClass(a, 'found')[0].textContent, new RegExp(`^${EG_ANNALS[0][0].replace(/[.*+?^${}()|[\]\\']/g, '.')}`));
  assert.match(byClass(a, 'codex-line')[EG_ANNALS_FOUND].textContent, /Given at a lord's first fall/);
  assert.match(draw('annals', null).textContent, /Sign in to your account/);
});

test('HUNTERS-MARK THE FOUR HOSTS\' WIRING (Bounty-Boards.md 12.8): the streaming world builds the hunt\'s online deps and the trophy door in their modules and hands them over - the gather host its entity to a kind\'s answer, the Standing page its hunt block, the deploy filter the trophy law the service now reads (mutants: the kind\'s answer told no entity; the host\'s hunt deps gone; the trophy door gone)', () => {
  assert.match(src('src/scenes/gatherHost.js'), /k\?\.answered\?\.\(d, \(t\) => hud\.toast\(t\), \{ hauled, entity: deps\.entity\?\.\(\) \?\? null \}\)/);
  const world = src('src/scenes/world.js');
  assert.match(world, /    hunt: huntOnline\(params\.has\('online'\), saveSoon\),\n/);
  assert.match(world, /huntKind\(\{ book: profBook, bodies: \(\) => huntBodies\(\), openLoot: openHuntLoot, trophy: trophyDoor\(saveSoon\) \}\)/);
  assert.match(src('src/ui/enhanced/enhancedMenu.js'), /statsHunt\(detail, \{ el, divider: pxDivider, meter: pxMeter \}\);/);
  assert.match(src('.github/workflows/account-deploy.yml'), /- "src\/net\/trophyLaw\.js"/);
});
