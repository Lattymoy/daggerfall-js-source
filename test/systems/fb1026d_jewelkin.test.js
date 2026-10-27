// JEWEL-KIN (2026-10-26, Discord #feature-feedback "jewelcrafting, roll chances not equal (h2h, critical)": "i crafted
// around 100 rare rings (gold and platinum, handcraft not auto) and h2h or critical not roll on them";
// bible/01-Overview/bugs/Field-Bugs-2026-10-26d.md): jewellery's skill lines lean to Hand-to-Hand and Critical Strike
// beside the mind's thirteen. Measured through the real mint (systems/smithItems.js mintPiece) the report's own rings
// went through - a record of MINT_V_JEWEL_KIN (4), as the service stamps for this build, and ones of 2 and 3 (ARMOR-LEAN's), as every ring made before.
// AUDIT FB1026d (C3, C6, E9, E10, E11): the record is stamped with the version its client mints (a stale tab's ring is
// minted alike in its pack and in every other reader's), the odds measured per ring, the fallback's lean, and a loot
// door's jewellery as the loot list makes it. Mutants: tools/mutants/fb1026d_jewelkin.json.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import * as LR from '../../src/systems/loot/lootRarity.js';
import { MINT_VERSION, MINT_V_JEWEL_KIN, MINT_V_ARMOR_LEAN, MINT_V_LINES, MINT_V_LAST_PASS, craftMintVersion, readProductRecord, mintVersionOf } from '../../src/net/productRecord.js';
import { mintPiece, mintPieces } from '../../src/systems/smithItems.js';
import { SKILLS } from '../../src/systems/skills.js';
import { createRandomJewellery } from '../../src/systems/loot/loot.js';
import { accountProf, SESSION_KEY, SERVICE_KEY } from '../../src/net/accountClient.js';
import { standService } from '../accountDb.mjs';
import { xpForRank } from '../../src/net/professionLaw.js';
import { recipeById } from '../../src/net/recipeLaw.js';

const on = () => { _resetForTests(); setPref('lootRarity', true); };
const seedOf = (i) => (Math.imul(i + 1, 2654435761) >>> 0);
/** Every skill line of `n` hand-made Masterwork rings of each metal the report names, at record version `version`. */
function ringSkills(version, n) {
  const out = [];
  for (const recipe of ['ring:gold', 'ring:platinum']) {
    for (let i = 0; i < n; i++) {
      const it = mintPiece({ recipe, quality: 4, seed: seedOf(i), maker: null, version }, '0123456789abcdef');
      assert.equal(it.rarity, 'rare');
      for (const a of it.affixes ?? []) if (a.id === 'skill') out.push(a.param);
    }
  }
  return out;
}
const share = (list, s) => list.filter((x) => x === s).length / list.length;

test('JEWEL-KIN THE REPORT\'S RINGS: a Masterwork gold or platinum ring made now carries Hand-to-Hand and Critical Strike as often as a mind skill - each about one skill line in sixteen, where the old lean gave each one in two hundred (mutants: the bare hand\'s two left out; the version unread)', () => {
  on();
  assert.equal(MINT_VERSION, MINT_V_JEWEL_KIN, 'the craft stamps the new lean');
  const now = ringSkills(MINT_VERSION, 1500);
  assert.ok(now.length > 5000, `enough skill lines (${now.length})`);
  const h2h = share(now, SKILLS.HandToHand), crit = share(now, SKILLS.CriticalStrike), mind = share(now, SKILLS.Illusion);
  assert.ok(h2h > 0.045 && h2h < 0.08, `Hand-to-Hand ${(h2h * 100).toFixed(2)}% of skill lines`);
  assert.ok(crit > 0.045 && crit < 0.08, `Critical Strike ${(crit * 100).toFixed(2)}%`);
  assert.ok(Math.abs(h2h - mind) < 0.02 && Math.abs(crit - mind) < 0.02, `each about a mind skill's (Illusion ${(mind * 100).toFixed(2)}%)`);
  // a hundred Rare rings: a Hand-to-Hand line among them all but certainly (the report saw none) - AUDIT FB1026d C6/E9:
  // measured per ring, never by a line's share raised to a guess at the lines a ring holds
  let bare = 0;
  for (let i = 0; i < 1500; i++) {
    const it = mintPiece({ recipe: 'ring:gold', quality: 4, seed: seedOf(i), maker: null, version: MINT_VERSION }, '0123456789abcdef');
    if (!(it.affixes ?? []).some((a) => a.id === 'skill' && a.param === SKILLS.HandToHand)) bare++;
  }
  const none = bare / 1500;
  assert.ok(none > 0.75 && none < 0.92, `a ring without Hand-to-Hand: ${(none * 100).toFixed(1)}%`);
  assert.ok(none ** 100 < 1e-5, `none in a hundred rings: ${none ** 100} - one in millions now`);
});

test('JEWEL-KIN A RING ALREADY MADE KEEPS ITS LINES: a record of 2 or 3 mints on the mind\'s lean as it always did - the bare hand\'s two at the open share alone (mutant: the version unread)', () => {
  on();
  const old = ringSkills(MINT_V_LINES, 1500);
  assert.ok(share(old, SKILLS.HandToHand) < 0.012 && share(old, SKILLS.CriticalStrike) < 0.012, `the old lean (${(share(old, SKILLS.HandToHand) * 100).toFixed(2)}%, ${(share(old, SKILLS.CriticalStrike) * 100).toFixed(2)}%)`);
  // and a record of 3, ARMOR-LEAN's (main's version 3 - an armour's lines on its family's), keeps the jewel's old lean too
  assert.deepEqual([MINT_V_ARMOR_LEAN, MINT_V_JEWEL_KIN], [3, 4]);
  const armour = ringSkills(MINT_V_ARMOR_LEAN, 1500);
  assert.ok(share(armour, SKILLS.HandToHand) < 0.012 && share(armour, SKILLS.CriticalStrike) < 0.012, `a record of 3: the old lean (${(share(armour, SKILLS.HandToHand) * 100).toFixed(2)}%)`);
  // and the version is the only thing that moved it: a record's ring of 2 and of 3 differ only where a skill line's skill does
  let moved = 0;
  for (let i = 0; i < 200; i++) {
    const at = (v) => mintPiece({ recipe: 'ring:gold', quality: 4, seed: seedOf(i), maker: null, version: v }, '0123456789abcdef');
    const a = at(MINT_V_LINES), b = at(MINT_V_JEWEL_KIN);
    assert.deepEqual(a.affixes.map((x) => x.id), b.affixes.map((x) => x.id), 'the same kinds of line');
    assert.deepEqual(a.affixes.filter((x) => x.id !== 'skill'), b.affixes.filter((x) => x.id !== 'skill'), 'every other line its own');
    if (JSON.stringify(a.affixes) !== JSON.stringify(b.affixes)) moved++;
  }
  assert.ok(moved > 0, 'some skill lines moved');
});

test('JEWEL-KIN A FOUND RING LEANS THE SAME: a loot door\'s jewellery, made as the loot list makes it (loot.js createRandomJewellery) and rolled as the door rolls it (applyRarity), takes the new lean (mutant: the bare hand\'s two left out)', () => {
  on();
  let rolls = 12345;
  const rng = () => { rolls = (rolls * 1103515245 + 12345) & 0x7fffffff; return (rolls >>> 8) / 0x800000; };
  const lines = [];
  for (let i = 0; i < 4000; i++) {
    const it = createRandomJewellery(rng);
    if (!LR.rarityEligible(it)) continue;
    LR.applyRarity(it, 'rare', rng, null, { family: null });   // rollLootRarity's own call
    for (const a of it.affixes ?? []) if (a.id === 'skill') lines.push(a.param);
  }
  assert.ok(lines.length > 3000, `enough skill lines (${lines.length})`);
  assert.ok(share(lines, SKILLS.HandToHand) > 0.045 && share(lines, SKILLS.CriticalStrike) > 0.045, `${(share(lines, SKILLS.HandToHand) * 100).toFixed(2)}%, ${(share(lines, SKILLS.CriticalStrike) * 100).toFixed(2)}%`);
});

test('JEWEL-KIN THE LEGENDARY\'S FALLBACK KEEPS THE CALLER\'S LEAN (AUDIT FB1026d E10): a piece with no Legendary record falls to Rare on the lean it was asked for (mutant: the fallback drops the flag)', () => {
  on();
  let rolls = 777;
  const rng = () => { rolls = (rolls * 1103515245 + 12345) & 0x7fffffff; return (rolls >>> 8) / 0x800000; };
  const lines = { old: [], now: [] };
  for (let i = 0; i < 3000; i++) {
    for (const [k, fists] of [['old', false], ['now', true]]) {
      const it = createRandomJewellery(rng);
      if (!LR.rarityEligible(it)) continue;
      LR.applyRarity(it, 'legendary', rng, [], { fists });
      assert.equal(it.rarity, 'rare', 'no record: the tier below');
      for (const a of it.affixes ?? []) if (a.id === 'skill') lines[k].push(a.param);
    }
  }
  assert.ok(share(lines.old, SKILLS.HandToHand) < 0.012, `the old lean asked: ${(share(lines.old, SKILLS.HandToHand) * 100).toFixed(2)}%`);
  assert.ok(share(lines.now, SKILLS.HandToHand) > 0.045, `the new: ${(share(lines.now, SKILLS.HandToHand) * 100).toFixed(2)}%`);
});

test('JEWEL-KIN THE RECORD IS STAMPED WITH THE VERSION ITS CLIENT MINTS (AUDIT FB1026d C3): the craft names it, the service stamps it at most its own, and a client from before the ask is stamped MINT_V_LINES - so a stale tab\'s ring is the same ring in its pack and in every other reader\'s (mutants: the service stamps its own; the client names none; the ask unbounded)', async () => {
  on();
  assert.deepEqual([craftMintVersion(MINT_VERSION), craftMintVersion(undefined), craftMintVersion(null), craftMintVersion(MINT_VERSION + 5), craftMintVersion('3'), craftMintVersion(0)],
    [MINT_VERSION, MINT_V_LINES, MINT_V_LINES, MINT_VERSION, MINT_V_LINES, MINT_V_LINES]);
  // AUDIT FB1026d II D1: a name below MINT_V_JEWEL_KIN is no build's - stamped as none, never the retired laws it names
  assert.deepEqual([craftMintVersion(MINT_V_LAST_PASS), craftMintVersion(MINT_V_ARMOR_LEAN), craftMintVersion(MINT_V_JEWEL_KIN)], [MINT_V_LINES, MINT_V_LINES, MINT_V_JEWEL_KIN]);
  // the client's craft names this build's version (net/accountClient.js accountProf, through its own post)
  const m = new Map([[SESSION_KEY, JSON.stringify({ secret: 's'.repeat(43), handle: 'Mac' })], [SERVICE_KEY, 'https://x.test']]);
  const sent = [];
  const prof = accountProf({ fetch: async (url, init) => { sent.push(JSON.parse(init.body)); return new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }); }, storage: { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) } });
  await prof.craft('c1234', 'ring:gold', true, null, 'rid-000001');
  assert.equal(sent[0].mint, MINT_VERSION);
  // through the real Worker: a craft that names none (a tab from before the ask) and one that names this build's
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const mac = await s.seated('Mac');
  const r = recipeById('ring:gold');
  raw.prepare('INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, \'smithing\', ?, 1)').run(mac.id, mac.character, xpForRank(100));
  for (const { key, n } of r.inputs) raw.prepare('INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, \'own\', ?)').run(mac.id, mac.character, key, n * 20);
  let n = 0;
  const craft = async (extra) => {
    const res = await s.call('/v1/prof/craft', { character: mac.character, recipe: r.id, clean: false, name: null, rid: `jewelkin-${String(++n).padStart(6, '0')}`, ...extra }, mac.secret);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body;
  };
  const stale = await craft({});
  assert.equal(readProductRecord(stale.pieces[0].record).v, MINT_V_LINES, 'a client that names none: the last law before the ask');
  const [piece] = mintPieces(stale);
  assert.deepEqual(piece, mintPiece({ ...stale, version: MINT_V_LINES }, stale.pieces[0].provenance), 'the reader re-mints the ring at its stale maker\'s own law, MINT_V_LINES (AUDIT FB1026d II D5: never the record read against itself)');
  const fresh = await craft({ mint: MINT_VERSION });
  assert.equal(readProductRecord(fresh.pieces[0].record).v, MINT_VERSION);
  const ahead = await craft({ mint: MINT_VERSION + 1 });
  assert.equal(readProductRecord(ahead.pieces[0].record).v, MINT_VERSION, 'never past the service\'s own');
  const forged = await craft({ mint: MINT_V_LAST_PASS });
  assert.equal(readProductRecord(forged.pieces[0].record).v, MINT_V_LINES, 'AUDIT FB1026d II D1: a forged old version is stamped as none');
});
