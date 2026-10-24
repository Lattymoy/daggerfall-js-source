// ═══════════════════════════════════════════════════════════════════
// FORAGE1-FORAGE2 (2026-09-28): FORAGING 1.7 (Harbinger451) - THE
// INSTALL. What ForagingMain.Init/Awake/Start do (IL_0251-IL_0513): the
// twelve templates, the author's seven pictures, the quest list, the six
// tools' and five foods' UseItem, the console command, and (FORAGE3) the
// three loot hooks' subscriptions. The law is
// systems/foraging/foragingLaw.js; the record is bible/06-Systems/Foraging.md.
//
// THE TEMPLATES register at import, whatever the switch says (FORAGE0
// law 6): a saved tool never vanishes, and with the switch off it is an
// inert item - its Use not offered, its hooks silent.
//
// THE WORLD. A use asks the world what the mod's checks ask
// (PlayerEnterExit, PlayerGPS, WorldTime, GameManager.AreEnemiesNearby,
// PlayerMotor); the host that owns the player answers through
// setForagingHost. With no host a use is "inside" - the one answer that
// can never let a tool work where it should not.
//
// THE DRAWS are UnityEngine.Random's (THE ENGINE-PRNG RULE: Math.random,
// injectable for a test).
// ═══════════════════════════════════════════════════════════════════

import {
  FORAGING_TEMPLATES, FORAGING_VENDOR, FORAGING_GROUP, FORAGING_QUEST_LIST, FT, TOOL_TEMPLATES, FORAGING_TEXTURE_ARCHIVES,
  foragingRefusal, checksRefusal, woodAxeBundles, woodAxeMessage, pickAxeQuest, sickleQuest, fishingCount, fishingMessage, fishTemplate,
  spadeQuest, basketDraw, basketFind, TOOL_QUESTS, brokeMessage, FOODS, FORAGING_COMMAND,
  foragingLootItem, containerLootDraw, dungeonLootDraw, corpseLootDraw,
} from './foragingLaw.js';
import { registerCustomTemplates, registerItemUseHandler, registerCustomItemsForGroup, setItemFields, mintCondition, templateByIndex } from '../item/itemTemplates.js';
import { addVendorTextures } from '../textureReplacement.js';
import { registerQuestList } from '../quest/questLists.js';
import { registerCommand, gateConsoleCommand } from '../consoleCommands.js';
import { modSetting } from '../modSettings.js';
import { hudText, popupMessage } from '../notify.js';
import { addItem } from '../inventory.js';
import { lowerCondition } from '../equip.js';
import { isOnlinePage } from '../online/onlineLane.js';
import { liveStat, maxFatigue, FATIGUE_MULTIPLIER } from '../statMods.js';
import { survivalOn } from '../survival/switch.js';
import { createSurvivalItem } from '../survival/items.js';
import { SKINNING_KNIFE } from '../../net/professionLaw.js';   // TOUCH-HOLD: the knife's Use, a profession tool's
import { registerContainerLootHandler } from '../containerLoot.js';
import { registerTabledLootHandler } from '../loot/loot.js';
import { registerEnemyDeathHandler } from '../../scenes/corpseMarker.js';
import { noteAct } from '../questlines/qlActs.js';   // QL11: the features' acts, heard by the running quests

registerCustomTemplates(FORAGING_TEMPLATES);

/** The mod's switch (MO1: on). */
export const foragingOn = () => modSetting(FORAGING_VENDOR, 'Enabled') === true;

/** Foraging's share of GetCustomItemsForGroup: its twelve templates, all UselessItems2, while its switch is on - so a
 *  General Store or Pawn Shop shelves them by DFU's own custom-item loop (rarity <= quality; the tools and the Wood
 *  Bundle rarity 10, the Mushroom and the Egg 5, the Fish and the fruit 100 and so never). PROF1 (FORAGE0 law 6's online
 *  exception): ONLINE THE SIX TOOLS SHELVE WHATEVER THE SWITCH SAYS - the professions' acts need them, and the
 *  professions are the server's, not a player's preference; the foods and the Wood Bundle stay the switch's. */
export const foragingCustomItemsForGroup = (group) => {
  if (group !== FORAGING_GROUP) return [];
  if (foragingOn()) return FORAGING_TEMPLATES.map((t) => t.index);
  return isOnlinePage() ? [...TOOL_TEMPLATES] : [];
};
registerCustomItemsForGroup(foragingCustomItemsForGroup);

// ---- the host ----------------------------------------------------------

/**
 * @typedef {object} ForagingHost
 * @property {() => import('./foragingLaw.js').ForagingWorld} world  what the checks ask, now
 * @property {() => number} monthValue    WorldTime.Now.MonthValue (0-based)
 * @property {() => object} [entity]      the player entity (the console command's)
 * @property {(name: string) => boolean} startQuest   QuestMachine.StartQuest(QuestListsManager.GetQuest(name, 0))
 * @property {() => boolean} [professionsOpen]   TOOL-SAID: the online professions are this account's (the book is open)
 * @property {(action: string) => (string|null)} [keyLabel]   TOOL-SAID: the key an action is bound to, as the prompt says it
 * @property {(templateIndex: number) => (false|'started'|'taken')} [professionUse]   TOOL-USE: a profession tool's Use
 *   at a node of its own kind, as E there (scenes/gatherHost.js useTool): 'started' an act, 'taken' its need said; false none
 */
let _host = /** @type {ForagingHost|null} */ (null);
/** The host that owns the player answers; returns the one it replaced (a nested host restores it). */
export function setForagingHost(h) { const prev = _host; _host = h ?? null; return prev; }
export const foragingHost = () => _host;

const INSIDE = Object.freeze({
  inside: true, insideDungeon: false, insideCastle: false, locationType: 0xffff, inLocationRect: false, hour: 12, climate: 0,
  region: 0, enemiesNear: false, carriedWeight: 0, maxEncumbrance: 1, swimming: false, exteriorWater: 'None',
});
const worldNow = () => _host?.world?.() ?? INSIDE;

let _random = Math.random;
/** Tests: the draws. */
export function _setForagingRandomForTests(fn) { _random = fn ?? Math.random; }

// ---- minting -----------------------------------------------------------

/** ItemBuilder.CreateItem(group, templateIndex): Foraging's own rows, or C&C's for its fish and fruit. */
export function createForagingItem(templateIndex) {
  if (!(templateIndex >= FT.WoodAxe && templateIndex <= FT.Egg)) return createSurvivalItem(templateIndex);
  return mintCondition(setItemFields({ group: FORAGING_GROUP, templateIndex, material: 0, flags: 0, variant: 0, message: 0, stackCount: 1 }));
}
/** `Player.Items.AddItem(item, AddPosition.Back)`, n times. */
function give(entity, templateIndex, n) {
  if (!entity || !templateIndex) return;
  if (!Array.isArray(entity.items)) entity.items = [];
  for (let i = 0; i < n; i++) {
    const item = createForagingItem(templateIndex);
    if (item) addItem(entity.items, item, 'back');
  }
}
/** QuestMachine.StartQuest(GetQuest(name, 0)); false when no quest was found - DFU's StartQuest(null) throws there,
 *  which ends the use before its wear, so the port wears nothing then either. */
const startQuest = (name) => !!_host?.startQuest?.(name);

// ---- the six tools -----------------------------------------------------

const stats = (entity) => ({
  intelligence: liveStat(entity, 'intelligence'), strength: liveStat(entity, 'strength'),
  agility: liveStat(entity, 'agility'), endurance: liveStat(entity, 'endurance'),
});

/** LowerCondition(1), then on a break "Your <Tool> broke." and the removal - after DFU's own popup. */
function wear(item, collection, entity) {
  lowerCondition(item, 1, entity, (line) => popupMessage(line), collection);
  if ((item.currentCondition ?? 0) > 0) return;
  hudText(brokeMessage(item.templateIndex, item.name));
  if (collection) { const i = collection.indexOf(item); if (i >= 0) collection.splice(i, 1); }
}

// ---- the professions' acts borrow the tools (PROF1, FORAGE0 14) -------------

/** PROF1 (FORAGE0 14.3): the checks a profession's act runs first, with Foraging's own line for `templateIndex` (the
 *  Sickle's for an herb, the Basket's for its food) - never asking Foraging's switch (law 6: the acts are the
 *  server's). Null where every check passes.
 *  ANY-HOUR (2026-10-01, Mac: "Remove the time limit for professions. Should be available at any time"): NEVER
 *  FORAGING'S DAYLIGHT - a profession's act keeps no hours, by night as by day (the service asks none either,
 *  server-account/src/professions.js harvestNode). Foraging's own Use (useForagingTool: offline, a guest's lane) keeps
 *  the mod's day. */
const ACT_KEEPS_NO_HOURS = Object.freeze(['daylight']);
export const foragingActRefusal = (templateIndex, skip = null) => foragingRefusal(templateIndex, worldNow(), skip ? [...skip, ...ACT_KEEPS_NO_HOURS] : ACT_KEEPS_NO_HOURS);   // PROF2: a dungeon vein skips the surface's checks
/** PROF7 (FORAGE0 14.3): a tool not Foraging's asks the same checks of the same world, with its own lines. */
export const actChecksRefusal = (order, lines) => checksRefusal(order, lines, worldNow());
/** PROF1 (FORAGE0 14.1): which tool an act draws - the first of its kind in the pack, in the pack's order (as DFU's
 *  ItemCollection finds it), one not yet broken. */
export const foragingToolIn = (entity, templateIndex) =>
  (Array.isArray(entity?.items) ? entity.items.find((it) => it?.templateIndex === templateIndex && (it.currentCondition ?? 1) > 0) : null) ?? null;
/** PROF1 (FORAGE0 14.1): a completed act wears its tool by one, as a Foraging use does - the break Foraging's two
 *  notices ("Your Sickle broke." after DFU's popup). */
export const wearForagingTool = (item, entity) => { if (item && entity) wear(item, entity.items ?? null, entity); };

// FIELD BUGS 2026-09-30b (TOOL-SAID, then TOOL-USE): "I've been chopping wood but ... the logging profession [isn't]
// changing", "using my sickle ... I dont get any exp", "I fish, or use the axe and I get no exp ... I just physically get
// lumber in the misc tab. Is using the tools in the wilderness via use/hotkey not how you gain exp?". Online, a tool's
// Use from the pack or the hotbar was Foraging's own gesture (FORAGE0 law 4) - its yields into the pack, its quest, no
// profession - and TOOL-SAID only said so after the mod's words. The owner (2026-09-30): "I dont care about DFU. We're
// our own thing now" - laws 1 and 4 give way online. TOOL-USE: while the professions are this account's, the Wood-Axe,
// the Pick-Axe, the Sickle, the Basket and the Fishing-Net are the professions' - their Use at a node of their own kind
// is E there (the gathering host's act, or its need), and anywhere else, or from the open pack, it gives none of the
// mod's yields, quests or wear: it says where the profession is done. Offline and a guest's lane are the mod's 1:1; the
// Spade stays Foraging's alone (14.2).

/** TOOL-SAID: how each profession tool's own profession gathers, by the Interact key `k` and the act choice key `c` -
 *  TOOL-USE: and that the tool's Use at the node is the key's. */
export const PROFESSION_TOOL_HOW = Object.freeze({
  [FT.WoodAxe]: (k) => `Logging is done at a tree in the wilderness: walk up to one until its acts show, then press ${k} (or use the Wood-Axe). Only some trees can be felled each day.`,
  [FT.PickAxe]: (k) => `Mining is done at an ore vein or a boulder in the wilderness, or a vein in a dungeon: walk up to one until its acts show, then press ${k} (or use the Pick-Axe).`,
  [FT.Sickle]: (k) => `Herbalism is done at an herb patch in the wilderness: walk up to one until its acts show, then press ${k} (or use the Sickle).`,
  [FT.Basket]: (k) => `The Basket searches an herb patch in the wilderness for food: walk up to one until its list shows, then use the Basket (or choose Search with the Basket on the list and press ${k}).`,   // PROF-MENU: the node's list, not the act choice key
  [FT.FishingNet]: (k) => `Fishing is done in water: stand or swim in it, or be at sea, until its acts show, then press ${k} (or use the Fishing-Net).`,   // ANY-HOUR: at any hour
  // TOUCH-HOLD (2026-10-01 part four - Mac: "Interact button + knife Use"): the knife's Use at a body is E there, and it
  // holds the knife for the line as the Sickle's holds the steady hand (scenes/huntHost.js)
  [SKINNING_KNIFE.templateIndex]: (k) => `Hunting is done at a body you killed: walk up to it until its acts show, then press ${k} (or use the Skinning Knife).`,
});
/** TOOL-SAID: the line a Use of this tool says where no node takes it - online, with the professions open, for the
 *  five profession tools (TOUCH-HOLD: and the Skinning Knife); null otherwise (offline, a guest, the Spade: the Use is
 *  Foraging's). */
export function professionToolLine(templateIndex) {
  const how = PROFESSION_TOOL_HOW[templateIndex];
  if (!how || !isOnlinePage() || _host?.professionsOpen?.() !== true) return null;
  return how(_host.keyLabel?.('Interact') || 'E', _host.keyLabel?.('ActChoice') || 'the act choice key');
}

/** One tool's UseItem: the checks, the yield and its box, the quest, the wear - TOOL-USE: online, with the professions
 *  this account's, a profession tool's Use is the professions' instead, whatever the switch says (law 6). */
export function useForagingTool(item, collection, { entity } = {}) {
  const how = professionToolLine(item?.templateIndex);
  if (how) {
    // TOOL-USE: at a node of the tool's own kind, what E does there - the act started, or what the node needs said
    const took = _host?.professionUse?.(item.templateIndex) ?? false;
    if (took === 'started') return { kind: 'foraging' };
    if (took) return { kind: 'foraging', refused: true };   // the node said why nothing started: a refusal, never gold
    // anywhere else, or the open pack's Use (its window holds the world off): no yield, quest or wear - the way said,
    // in the HUD (the hotbar's) and in the box (the pack's), in place of Foraging's refusal ("You cannot mine in here!")
    hudText(how);
    return { kind: 'foraging', refused: true, text: how, said: true };   // AUDIT ECON R3: said - the hotbar never says it twice
  }
  if (!foragingOn() || !entity) return null;
  const w = worldNow();
  const refusal = foragingRefusal(item.templateIndex, w);
  if (refusal) {
    hudText(refusal);
    return { kind: 'foraging', refused: true };   // DFU's false falls to NextVariant: nothing visible
  }
  const s = stats(entity);
  const cc = survivalOn();
  let text = null;
  let started = false;
  switch (item.templateIndex) {
    case FT.WoodAxe: {
      const n = woodAxeBundles({ ...s, climate: w.climate }, _random);
      give(entity, FT.WoodBundle, n);
      if (n > 0) noteAct('wood-chopped');   // QL11: wood chopped - the bundles in the pack
      text = woodAxeMessage(n);
      started = startQuest(TOOL_QUESTS[FT.WoodAxe]);
      break;
    }
    case FT.PickAxe: started = startQuest(pickAxeQuest(s)); break;
    case FT.Sickle: started = startQuest(sickleQuest(w.climate, _host?.monthValue?.() ?? 0)); break;
    case FT.FishingNet: {
      const n = fishingCount(s, _random);
      give(entity, fishTemplate(cc), n);
      if (n > 0) noteAct('fish-caught');   // QL11: a fish caught - the net's catch in the pack
      text = fishingMessage(n);
      started = startQuest(TOOL_QUESTS[FT.FishingNet]);
      break;
    }
    case FT.Spade: started = startQuest(spadeQuest(s, false)); break;   // Cheb's Necromancy is not in the port: never its family
    case FT.Basket: {
      const find = basketFind(basketDraw({ intelligence: s.intelligence, climate: w.climate, monthValue: _host?.monthValue?.() ?? 0 }, _random), cc);
      give(entity, find.templateIndex, find.count);
      if (find.count > 0 && find.templateIndex !== FT.Egg) noteAct('herb-gathered');   // QL11: a plant gathered - the Basket's find in the pack; AUDIT QUESTLINES ACTS-10: an egg is no plant (QLIP01: "Gather three plants")
      text = find.message;
      started = startQuest(TOOL_QUESTS[FT.Basket]);
      break;
    }
    default: return null;
  }
  if (started) wear(item, collection, entity);
  return { kind: 'foraging', text };   // the box over the open inventory (ClickAnywhereToClose)
}

// ---- the five foods ----------------------------------------------------

/** One food's UseItem: the HUD line, fatigue in points, health or magicka, one eaten. */
export function eatForagingFood(item, collection, { entity } = {}) {
  if (!foragingOn() || !entity) return null;
  const f = FOODS[item.templateIndex];
  if (!f) return null;
  hudText(f.text);
  entity.fatigue = Math.min(maxFatigue(entity), (entity.fatigue ?? 0) + f.fatigue * FATIGUE_MULTIPLIER);   // IncreaseFatigue(n, true)
  if (f.health) entity.health = Math.min(entity.maxHealth ?? Infinity, (entity.health ?? 0) + f.health);   // IncreaseHealth
  if (f.magicka) entity.magicka = Math.min(entity.maxMagicka ?? Infinity, (entity.magicka ?? 0) + f.magicka);   // IncreaseMagicka
  if (collection) { const i = collection.indexOf(item); if (i >= 0) collection.splice(i, 1); }   // RemoveItem(this): the item whole (they never stack)
  return { kind: 'foraging' };
}

// ---- the console command ----------------------------------------------

/** Foraging_Tools: one of each tool, offline; refused online (FORAGE0 8). */
export function foragingToolsCommand() {
  // A switched-off mod has no command in DFU: answer as the console answers a name it does not know (GetCommand).
  if (!foragingOn()) return `Command ${FORAGING_COMMAND.name.toUpperCase()} not found.`;
  if (isOnlinePage()) return FORAGING_COMMAND.refusedOnline;
  const entity = _host?.entity?.();
  if (!entity) return FORAGING_COMMAND.answer;
  for (const t of TOOL_TEMPLATES) give(entity, t, 1);
  return FORAGING_COMMAND.answer;
}

// ---- the three loot hooks (FORAGE3) --------------------------------------

/** One hook's loop: `count` items, each its table's id then the roll, `AddItem(item, AddPosition.Back)` into `items`.
 *  Answers how many it added. */
function addLootItems(items, { table, count }, luck, quality, rolls = _random) {   // PARTY-LOOT: the draw's own dice
  let added = 0;
  for (let i = 0; i < count; i++) {
    const t = foragingLootItem(table, luck, quality, rolls);
    if (!t) continue;
    const item = createForagingItem(t);
    if (item) { addItem(items, item, 'back'); added++; }
  }
  return added;
}
/** ForagingLoot_OnLootSpawned (IL_0520): PlayerActivate's event over a shelf or a house container. */
export function onForagingContainerLoot(args) {
  if (!foragingOn() || !Array.isArray(args?.items) || args.buildingType == null) return 0;   // `Interior != null`
  return addLootItems(args.items, containerLootDraw(args, _random), args.luck ?? 50, args.quality ?? 0);
}
/** ForagingLoot_OnDungeonLootSpawned (IL_084c): LootTables' event over a pile, by the index it was generated at. */
export function onForagingPileLoot(args) {
  if (!foragingOn() || !Array.isArray(args?.items)) return 0;
  return addLootItems(args.items, dungeonLootDraw(args.locationIndex, args.rolls ?? _random), args.luck ?? 50, -1, args.rolls ?? _random);   // PARTY-LOOT: the raiser's dice when it hands them (a room's base draws on the room's)
}
/** ForagingLoot_OnEnemyDeath (IL_0a08): into the corpse, which is the entity's items (UL1). */
export function onForagingEnemyDeath(entity, opts = {}) {
  if (!foragingOn() || !entity || entity.isPlayer || !Array.isArray(entity.items)) return 0;   // `as EnemyEntity`
  return addLootItems(entity.items, corpseLootDraw(entity, opts.rolls ?? _random), opts.luck ?? 50, -1, opts.rolls ?? _random);   // PARTY-LOOT: the raiser's dice when it hands them
}

// ---- the install -------------------------------------------------------

/** The author's pictures, from the vendored Textures/ (standIn: these archives exist only as this art). */
export const foragingTextureUrl = (archive) => new URL(`../../../vendor/foraging/Textures/${archive}_0-0.png`, import.meta.url).href;

let _installed = false;
/** Once, at the scene boot (ensureAudio, before any quest bridge is built). `fetchBytes` is a test's seam. */
export function installForaging({ fetchBytes = null } = {}) {
  if (_installed) return 0;
  _installed = true;
  registerQuestList(FORAGING_QUEST_LIST, foragingOn);
  const toolUse = (item, collection, ctx) => useForagingTool(item, collection, ctx);
  toolUse.usable = (item) => foragingOn() || !!professionToolLine(item?.templateIndex);   // TOOL-SAID: online the tools are the professions' whatever the switch says (law 6)
  for (const t of TOOL_TEMPLATES) registerItemUseHandler(t, toolUse);
  // TOUCH-HOLD: the Skinning Knife's Use - the professions' alone (the knife is sold online only, PROF0 15): at a body
  // the act, anywhere else the way said; offline, or with the professions shut, it has none
  const knifeUse = (item, collection, ctx) => (professionToolLine(item?.templateIndex) ? useForagingTool(item, collection, ctx) : null);
  knifeUse.usable = (item) => !!professionToolLine(item?.templateIndex);
  registerItemUseHandler(SKINNING_KNIFE.templateIndex, knifeUse);
  const eat = (item, collection, ctx) => eatForagingFood(item, collection, ctx);
  eat.usable = () => foragingOn();
  for (const t of Object.keys(FOODS)) registerItemUseHandler(Number(t), eat);
  registerCommand(FORAGING_COMMAND.name, FORAGING_COMMAND.description, FORAGING_COMMAND.usage, () => foragingToolsCommand());
  gateConsoleCommand(FORAGING_COMMAND.name, foragingOn);   // AUDIT 28 F7: off, the mod has no command - not even a HELP line
  // FORAGE3: Init's three subscriptions (IL_049a-IL_04f5), in its order - after every mod that loaded first (RRI's)
  registerContainerLootHandler(FORAGING_VENDOR, onForagingContainerLoot);
  registerTabledLootHandler(FORAGING_VENDOR, onForagingPileLoot);
  registerEnemyDeathHandler(FORAGING_VENDOR, onForagingEnemyDeath);
  const load = fetchBytes ?? (async (archive) => {
    const r = await fetch(foragingTextureUrl(archive));
    if (!r.ok) throw new Error(`foraging ${archive}: ${r.status}`);
    return new Uint8Array(await r.arrayBuffer());
  });
  return addVendorTextures(FORAGING_TEXTURE_ARCHIVES.map((archive) => ({
    archive, record: 0, frame: 0, standIn: true, lazy: true, fileName: `${archive}_0-0`, load: () => load(archive),
  })));
}
/** Tests: install again - and the three subscribers the install registered come out with it, so a later test in the
 *  same process never hears Foraging's pile hook roll on Math.random before its own spy (AUDIT BOUNTY1: FORAGE3's
 *  OnLootSpawned pin failed one run in four behind the leak). */
export function _resetForagingInstall() {
  _installed = false;
  registerContainerLootHandler(FORAGING_VENDOR, null);
  registerTabledLootHandler(FORAGING_VENDOR, null);
  registerEnemyDeathHandler(FORAGING_VENDOR, null);
}

/** Whether a template is one of this mod's (the templates are registered at import). */
export const isForagingItem = (item) => !!item && !!templateByIndex(item.templateIndex) && item.templateIndex >= FT.WoodAxe && item.templateIndex <= FT.Egg;
