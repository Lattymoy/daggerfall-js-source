// AUDIT 23 fix pins, wave 3: items, text-data, guilds, characters,
// audio, and the advancement moment.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEMPLATES } from '../src/systems/useItem.js';
import { mintCondition, inventoryItemImage, templateByIndex } from '../src/systems/itemTemplates.js';
import { expandItemInfo, weightString } from '../src/systems/itemInfo.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { assignStartingGear } from '../src/systems/startingGear.js';
import { TextRsc, RSC } from '../src/formats/textRsc.js';
import { spellsByIndexMap } from '../src/formats/spellsStd.js';
import { canAccessService, canAccessLibrary } from '../src/systems/guildServices.js';
import { TG_SPYMASTER_FACTION_ID } from '../src/systems/guildServiceFlow.js';
import { GUILDS } from '../src/systems/guilds.js';
import { MobileUnit, MOBILE_RAT } from '../src/characters/mobileUnit.js';
import { ACTION_FLAGS } from '../src/world/rdbLayout.js';
import { tickPlayerMinutes, setWorldMinutes, worldMinutes } from '../src/systems/worldTick.js';
import { raiseAtRestEnd } from '../src/scenes/shared.js';
import { RestWindow } from '../src/ui/restWindow.js';
import { SKILLS } from '../src/systems/skills.js';
import { skillUsesForAdvancement } from '../src/systems/advancement.js';
import { CLASSIC_GAME_START_TIME } from '../src/systems/gameDate.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, f), 'utf8');

test('AUDIT 23 items-3/4: Arrow is 131 and Helm is 107 (ItemEnums.cs:230/:202)', () => {
  assert.equal(TEMPLATES.Arrow, 131);
  assert.equal(TEMPLATES.Helm, 107);
});

test('AUDIT 23 items-5: every factory mints condition = template hitPoints, material-scaled', () => {
  // DaggerfallUnityItem.cs:566-567 + SetItemPropertiesByMaterial:651-652.
  const torch = mintCondition({ group: 'UselessItems2', templateIndex: 247 });
  assert.equal(torch.maxCondition, 50);
  assert.equal(torch.currentCondition, 50);
  // weapons scale: Dagger hitPoints 50, Daedric mult 32 -> 50*32/4 = 400
  const dagger = createWeapon(113, 9);
  assert.equal(dagger.maxCondition, 400);
  // plate armor scales: Cuirass 4096, Dwarven (0x0204) mult 12 -> 12288
  const cuirass = mintCondition({ group: 'Armor', templateIndex: 102, material: 0x0204 });
  assert.equal(cuirass.maxCondition, 12288);
  // leather/chain armor do NOT scale (no SetItemPropertiesByMaterial call)
  assert.equal(mintCondition({ group: 'Armor', templateIndex: 102, material: 0x0000 }).maxCondition, 4096);
  // idempotent - magic uses survive
  assert.equal(mintCondition({ templateIndex: 247, maxCondition: 7, currentCondition: 3 }).currentCondition, 3);
  // ...and the starting gear rides the funnel
  const e = { items: [], gender: 'male', career: { primarySkills: [], majorSkills: [], minorSkills: [] } };
  const added = assignStartingGear(e, { classIndex: 16, rolls: () => 0.5 });
  assert.ok(added.length > 3);
  for (const it of added) assert.notEqual(it.maxCondition, undefined, `${it.name} minted no condition`);
});

test('AUDIT 23 items-6: the inventory icon clamps armor variants by material family', () => {
  // ItemBuilder.SetVariant (:856-908) via GetInventoryTextureRecord.
  const t = templateByIndex(102);
  const base = t.playerTextureRecord;
  const chain = inventoryItemImage({ group: 'Armor', templateIndex: 102, material: 0x0100, variant: 2 });
  assert.equal(chain.record, base + 4, 'chain cuirass draws the chain look (variant 4), not the rolled 2');
  const leather = inventoryItemImage({ group: 'Armor', templateIndex: 102, material: 0x0000, variant: 2 });
  assert.equal(leather.record, base + 0, 'leather cuirass is variant 0');
  const plate = inventoryItemImage({ group: 'Armor', templateIndex: 102, material: 0x0204, variant: 2 });
  assert.equal(plate.record, base + 2, 'plate keeps its in-range roll');
});

test('AUDIT 23 items-7: %wth is Worth() = value x stackCount', () => {
  // DaggerfallUnityItemMCP.cs:112-115.
  assert.equal(expandItemInfo('%wth', { templateIndex: 247, value: 10, stackCount: 3 }), '30');
  assert.equal(expandItemInfo('%wth', { templateIndex: 247, value: 10 }), '10');
});

test('AUDIT 23 FTD-1: an empty trailing variant steps back to the previous stream', () => {
  // TextProvider.cs:225-233 - a record ending 0xFF 0xFE mints an empty
  // trailing stream; GetRandomTokens picks index-1 for it.
  const A = [...'aa'].map((c) => c.charCodeAt(0));
  const B = [...'bb'].map((c) => c.charCodeAt(0));
  const rec = A.concat([RSC.SubrecordSeparator], B, [RSC.SubrecordSeparator], [RSC.EndOfRecord]);
  const head = [12, 0, /*id 900*/ 132, 3, 14, 0, 0, 0];
  const bytes = new Uint8Array(14 + rec.length);
  bytes.set(head, 0); bytes.set(rec, 14);
  const t = new TextRsc().load(bytes);
  assert.equal(t.variantCount(900), 3, 'two real variants + the empty trailing stream');
  // pick the empty third (want = 2): DFU steps back to variant 1
  assert.deepEqual(t.variantLinesById(900, () => 0.99).map((r) => r.text), ['bb']);
  assert.deepEqual(t.variantLinesById(900, () => 0).map((r) => r.text), ['aa']);
});

test('AUDIT 23 FTD-2/3: the spell index fold keeps the FIRST record and the loader uses it', () => {
  // EntityEffectBroker.RebuildClassicSpellsDict:747-753.
  const first = { index: 58, name: 'Holy Word', effects: [] };
  const dup = { index: 58, name: 'Holy Touch', effects: [] };
  const map = spellsByIndexMap([first, dup]);
  assert.equal(map.get(58).name, 'Holy Word');
  const cs = src('src/systems/chargenSession.js');
  assert.ok(cs.includes('spellsByIndexMap(readSpellsStd('), 'loadSpellIndex rides the first-wins fold');
  assert.equal(/new Map\(readSpellsStd\(/.test(cs), false, 'the last-wins fold is gone');
});

test('AUDIT 23 guilds-1: the four subclass service switches replace the base entirely', () => {
  const at = (rank) => ({ guild: 'x', rank, lastRankChange: 0 });
  const MG = GUILDS.MagesGuild, FG = GUILDS.FightersGuild;
  // MagesGuild.cs:134-161
  assert.equal(canAccessService(MG, at(3), 'BuyMagicItems'), true);
  assert.equal(canAccessService(MG, at(2), 'BuyMagicItems'), false);
  assert.equal(canAccessService(MG, at(5), 'MakeMagicItems'), true);
  assert.equal(canAccessService(MG, at(8), 'Teleport'), true);
  assert.equal(canAccessService(MG, at(6), 'DaedraSummoning'), true);
  assert.equal(canAccessService(MG, at(4), 'BuySoulgems'), true);
  assert.equal(canAccessService(MG, at(9), 'Repair'), false, 'the override REPLACES the base - no Repair arm');
  assert.equal(canAccessService(MG, null, 'Identify'), true);
  // ThievesGuild.cs:146-162 / DarkBrotherhood.cs:151-171
  assert.equal(canAccessService(GUILDS.ThievesGuild, at(2), 'SellMagicItems'), true);
  assert.equal(canAccessService(GUILDS.ThievesGuild, at(3), 'Spymaster'), false);
  assert.equal(canAccessService(GUILDS.ThievesGuild, at(4), 'Spymaster'), true);
  // AUDIT 26 F115 re-pinned this on a MEMBER: "the override replaces
  // the base" is a statement about members. A NON-member never reaches
  // the subclass switch at all - GuildManager.GetGuild hands them
  // NonMemberGuild, whose base switch answers Identify TRUE.
  assert.equal(canAccessService(GUILDS.ThievesGuild, at(9), 'Identify'), false, 'no Identify arm in the override');
  assert.equal(canAccessService(GUILDS.ThievesGuild, null, 'Identify'), true, 'a stranger gets the base switch');
  assert.equal(canAccessService(GUILDS.DarkBrotherhood, at(1), 'BuyPotions'), true);
  assert.equal(canAccessService(GUILDS.DarkBrotherhood, at(7), 'Spymaster'), true);
  // the base still serves the guilds with no override
  assert.equal(canAccessService(FG, at(0), 'Repair'), true);
  // guilds-6: the Mages library override on the shared predicate
  assert.equal(canAccessLibrary(MG, at(2)), true);
  assert.equal(canAccessLibrary(MG, at(1)), false);
});

test('AUDIT 23 guilds-3: the t=2037 escape tests TG_Spymaster = 806', () => {
  assert.equal(TG_SPYMASTER_FACTION_ID, 806);
});

test('AUDIT 23 characters-11: FrameSpeedDivisor slows the anim clock with the 4-fps floor', () => {
  // DaggerfallMobileUnit.cs:530-534 + EnemyAttack.cs:70-77.
  const mk = () => {
    const m = new MobileUnit(MOBILE_RAT, { behaviour: 'General', maleTexture: 255, femaleTexture: 255 }, () => 5, () => 0.5);
    m.state = 'move';
    return m;
  };
  const norm = mk(), slow = mk();
  slow.frameSpeedDivisor = 3;   // move fps 6 -> 2 -> floored at 4
  // one second at the normal clock steps more frames than the divided one
  const frames = (m) => { let n = 0; let last = m.frame; for (let i = 0; i < 60; i++) { m.update(1 / 60, { moving: true }, 0, [0, 0, 0], [0, 0, 5]); if (m.frame !== last) { n++; last = m.frame; } } return n; };
  const nN = frames(norm), nS = frames(slow);
  assert.ok(nS < nN, `divided clock steps fewer frames (${nS} < ${nN})`);
  assert.ok(nS >= 3, `the 4-fps floor keeps it animating (${nS} steps)`);
});

test('AUDIT 23 characters-7 + items-1: the spawn bands and the pile gender ride the constructions', () => {
  const dc = src('src/scenes/dungeonContext.js');
  assert.equal((dc.match(/spawnDistanceType: e\.spawnDistanceType \?\? 0/g) ?? []).length, 2,
    'both foe constructions pass the marker band');
  assert.ok(dc.includes('gender: playerEntity.gender });   // AUDIT 23 (items-1)'), 'piles roll the player gender');
  const cg = src('src/scenes/cityGuards.js');
  assert.ok(cg.includes('playerInside: false,'), 'guards senses run the exterior despawn band');
});

test('AUDIT 23 audio-4: channel gains resync at play() and the loop seam', () => {
  const sp = src('src/systems/songPlayer.js');
  assert.ok(/_resyncChannelGains\(\)\s*\{/.test(sp));
  const calls = (sp.match(/this\._resyncChannelGains\(\);/g) ?? []).length;
  assert.equal(calls, 2, 'one at play(), one at the loop rewind');
});

test('AUDIT 23 wa-1: ACTION_FLAGS carries every defined RdbActionFlags member', () => {
  assert.equal(ACTION_FLAGS.Unknown100, 0x64);
});

test('AUDIT 23 entity-1: the tick never advances skills; the rest-finished close does', () => {
  // DaggerfallRestWindow.cs:731 is the ONLY live advancement site.
  const lb = SKILLS.LongBlade;
  const mkEntity = () => {
    const e = {
      chargenDone: true, isPlayer: true, reflexes: 2, items: [],
      skills: new Array(35).fill(30), skillUses: new Array(35).fill(0),
      stats: { endurance: 50, speed: 50 }, activeEffects: [],
      lastSkillCheckTime: CLASSIC_GAME_START_TIME,
      fatigue: 3200, health: 50, maxHealth: 50, level: 1,
      career: { primarySkills: [lb], majorSkills: [], minorSkills: [], advancementMultiplier: 1.0 },
      startingLevelUpSkillSum: 100, currentLevelUpSkillSum: 100,
    };
    e.skillUses[lb] = skillUsesForAdvancement(30, 2, 1.0, 1);
    return e;
  };
  // 400 minutes pass through the TICK: gate satisfied, uses ready - and
  // nothing raises, because the tick owns no advancement any more.
  const e1 = mkEntity();
  const r = tickPlayerMinutes({ entity: e1, classicMinutes: CLASSIC_GAME_START_TIME, dt: (400 * 5), sinks: {}, rolls: () => 0.5 });
  assert.equal(e1.skills[lb], 30, 'the tick does not raise');
  assert.equal(r.raised, undefined, 'the tick result carries no raised list');
  // the rest-end arm raises the same entity (it reads the ONE world
  // clock, so the fixture moves it past the 360-minute gate)
  const said = [];
  const clock0 = worldMinutes();
  setWorldMinutes(CLASSIC_GAME_START_TIME + 400);
  const raised = raiseAtRestEnd(e1, { say: (m) => said.push(m), rolls: () => 0.5 });
  setWorldMinutes(clock0);
  assert.deepEqual(raised, [lb]);
  assert.equal(e1.skills[lb], 31);
  assert.ok(said.some((m) => m.includes('Long Blade')), 'the classic line fires from the rest end');
  // ...and the window's ended-page close is what calls it
  const w = new RestWindow({ onRestFinished: () => said.push('FINISHED') });
  w.state = 'ended';
  w.input('confirm');
  assert.ok(w.done && said.includes('FINISHED'), 'closing the finished page is the advancement moment');
});
