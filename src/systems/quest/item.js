// THE QUEST ITEM (Q1 declaration + Q2b-ii mint) - Item.cs. Five
// declaration shapes tried in DFU's alternation order: class+subclass,
// class+template, artifact NAME, NAME key N (books/potions), bare
// NAME - plus the "range LOW to HIGH" option and the gold special
// case (not in the lookup table). Q2b-ii ships the MINT: the create
// ladder verbatim (Item.cs:220-231) - MagicItems and Books and the
// potion shape short-circuit BEFORE the random-subclass arm, gold
// carries the classic level/guild/region reward formula with integer
// division at every step, artifacts expand their MAGIC.DEF template,
// clothing takes a random dye, and every minted item is quest-linked
// (uid + symbol) EXCEPT the modded "class N template M" form, which
// C# leaves unlinked (Item.cs:221-222 - it survives quest end). Draws ride the quest's injectable roll (Ledger A
// engine-PRNG rule; DFU uses UnityEngine.Random throughout). Player /
// guild / region facts come through quest.hooks, which the machine
// now builds BEFORE the parse. The MagicItems/Artifacts arms need the
// MAGIC.DEF registry (loot.js setMagicItemTemplates - hosts register
// it); headless, they mint a pendingMagicDef stand-in instead of
// throwing, so the no-ARENA2 corpus gate stands (Ledger A row).
//
// Corpus reality (the backlog scan): `key N` books/potions appear on
// ZERO corpus lines, and the potion arm (class 1 subclass 1) on none
// either - both ship minimal shapes, cited, rather than fictional
// completeness. The book message/value halves pend the book catalog
// (the E1 book-file-pricing ledger row).

import { QuestResource, matchFirst } from './questResource.js';
import { Symbol as QuestSymbol } from './symbol.js';
import { parseInt as questParseInt } from './parseUtils.js';
import { itemsTable } from './tables.js';
import {
  createRegularMagicItem, createArtifact, getMagicItemTemplates,
  ITEM_GROUP_NAME_BY_CLASS, BOOK_TEMPLATE,
} from '../loot.js';
import { GROUP_TEMPLATE_INDICES, ITEM_TEMPLATES, mintCondition } from '../itemTemplates.js';
import { goldStack } from '../inventory.js';
import { alterReward } from '../guilds.js';
import { CLOTHING_DYES } from '../../characters/dyes.js';

/** DaggerfallUnityItem.MakePermanent (DaggerfallUnityItem.cs:1240-
 *  1248): drops quest-item status so the item survives quest end. */
export function makeItemPermanent(dfItem) {
  if (dfItem?.questItem) {
    dfItem.questUID = 0;
    dfItem.questSymbol = null;
    dfItem.questItem = false;
  }
}

const DECL = [
  /(Item|item) (?<s1>[a-zA-Z0-9_.-]+) item class (?<itemClass>\d+) subclass (?<itemSubClass>\d+)/,
  /(Item|item) (?<s2>[a-zA-Z0-9_.-]+) item class (?<c2>\d+) template (?<itemTemplate>\d+)/,
  /(Item|item) (?<s3>[a-zA-Z0-9_.-]+) (?<artifact>artifact) (?<n3>[a-zA-Z0-9_.-]+)/,
  /(Item|item) (?<s4>[a-zA-Z0-9_.-]+) (?<n4>[a-zA-Z0-9_.-]+) key (?<itemKey>\d+)/,
  /(Item|item) (?<s5>[a-zA-Z0-9_.-]+) (?<n5>[a-zA-Z0-9_.-]+)/,
];
const OPTIONS = /range (?<rangeLow>\d+) to (?<rangeHigh>\d+)/g;

export class Item extends QuestResource {
  constructor(parentQuest, line = null) {
    super(parentQuest);
    this.itemName = '';
    this.itemKey = -1;
    this.itemClass = -1;
    this.itemSubClass = -1;
    this.itemTemplate = -1;
    this.artifact = false;
    this.isGold = false;
    this.rangeLow = -1;
    this.rangeHigh = -1;
    // Q2b use-tracking (Item.cs:46-47,71-86): the world's "use item
    // from inventory" path (useItem.js at Q4's item wiring) sets
    // useClicked while an ItemUsedDo action watches; actionWatching
    // tells the inventory UI a quest is listening.
    this.useClicked = false;
    this.actionWatching = false;
    // Q2b-ii lifecycle flags (Item.cs:48-50)
    this.allowDrop = false;
    this.playerDropped = false;
    this.madePermanent = false;
    this.daggerfallUnityItem = null;
    if (line !== null) this.setResource(line);
  }

  get isItem() { return true; }

  setResource(line) {
    super.setResource(line);
    const match = matchFirst(line, DECL);
    if (!match) return;
    const g = match.groups;
    this.symbol = new QuestSymbol(g.s1 ?? g.s2 ?? g.s3 ?? g.s4 ?? g.s5);
    this.itemName = g.n3 ?? g.n4 ?? g.n5 ?? '';
    if (g.itemClass != null || g.c2 != null) this.itemClass = questParseInt(g.itemClass ?? g.c2);
    if (g.itemSubClass != null) this.itemSubClass = questParseInt(g.itemSubClass);
    if (g.itemTemplate != null) this.itemTemplate = questParseInt(g.itemTemplate);
    if (g.artifact) this.artifact = true;
    if (g.itemKey != null) this.itemKey = questParseInt(g.itemKey);
    if (this.itemName === 'gold') this.isGold = true;

    const optionsLine = line.slice(match.index + match[0].length);
    for (const option of optionsLine.matchAll(OPTIONS)) {
      if (option.groups.rangeLow != null) this.rangeLow = questParseInt(option.groups.rangeLow);
      if (option.groups.rangeHigh != null) this.rangeHigh = questParseInt(option.groups.rangeHigh);
    }

    // The create ladder (Item.cs:220-231), branch order verbatim.
    if (this.itemClass !== -1 && this.itemSubClass !== -1 && !this.isGold) {
      this.daggerfallUnityItem = this._createItem(this.itemClass, this.itemSubClass);
    } else if (this.itemClass !== -1 && this.itemTemplate > 0 && !this.isGold) {
      // ItemBuilder.CreateItem(group, TEMPLATE index) - the modded-item
      // form; classic templates resolve straight off the table.
      // Q2b-ii VERIFY: C# does NOT LinkQuestItem on this arm
      // (Item.cs:221-222 assigns the builder's item raw; only the
      // class/subclass mint at :370 and CreateGold at :430 link) - a
      // template-form item survives quest end and no sweep matches it.
      this.daggerfallUnityItem = this._templateItem(
        ITEM_GROUP_NAME_BY_CLASS[this.itemClass], this.itemTemplate, this._rolls());
    } else if (this.itemName && !this.isGold) {
      this.daggerfallUnityItem = this._createItemByName(this.itemName, this.itemKey);
    } else if (this.isGold) {
      this.daggerfallUnityItem = this._createGold(this.rangeLow, this.rangeHigh);
    } else {
      throw new Error(`Could not create Item from line ${line}`);
    }
  }

  /** MakePermanent (Item.cs:278-297): flags the virtual item, the
   *  current instance, and every matching item the player holds (C#
   *  iterates ExportQuestItems; the sweep is the host's inventory). */
  makePermanent() {
    this.madePermanent = true;
    if (this.daggerfallUnityItem) makeItemPermanent(this.daggerfallUnityItem);
    this.parentQuest?.hooks?.makeHeldQuestItemsPermanent?.(this.parentQuest.uid, this.symbol);
  }

  /** Dispose (Item.cs:258-268): a still-quest-linked item leaves the
   *  player's collection when the quest ends. */
  dispose() {
    super.dispose();
    if (this.daggerfallUnityItem && this.daggerfallUnityItem.questItem) {
      this.parentQuest?.hooks?.removeItemFromPlayer?.(this.daggerfallUnityItem);
    }
  }

  // ---- the mint (Item.cs:325-470) ----

  _rolls() { return this.parentQuest?.rolls ?? Math.random; }

  _link(dfItem) {
    // LinkQuestItem (DaggerfallUnityItem.cs:1230-1236)
    dfItem.questItem = true;
    dfItem.questUID = this.parentQuest?.uid ?? 0;
    dfItem.questSymbol = this.symbol?.clone() ?? null;
    return dfItem;
  }

  /** The SetItem laws every template-backed mint carries
   *  (DaggerfallUnityItem.cs:538-573): condition = the template's
   *  hitPoints (the port's AUDIT 23 items-5 mintCondition law), and a
   *  Paintings item draws its message identity from
   *  Random.Range(0, 65536) (:571) - both were skipped by the first
   *  draft (Q2b-ii VERIFY). */
  _templateItem(groupName, templateIndex, rolls) {
    const item = mintCondition({
      group: groupName, templateIndex,
      name: ITEM_TEMPLATES[templateIndex]?.name,
    });
    if (groupName === 'Paintings') item.message = Math.floor(rolls() * 65536);
    return item;
  }

  /** CreateItem(name, key): class/subclass from the Quests-Items
   *  table's p1/p2; an unknown name THROWS, as DFU. */
  _createItemByName(itemName, itemKey) {
    const table = itemsTable();
    if (!table.hasValue(itemName)) {
      throw new Error(`Could not find Item name ${itemName} in items table`);
    }
    const p1 = questParseInt(table.getValue('p1', itemName));
    const p2 = questParseInt(table.getValue('p2', itemName));
    return this._createItem(p1, p2, itemKey);
  }

  /** CreateItem(class, subclass, key) - the special-group ladder THEN
   *  the random-subclass arm, order verbatim. */
  _createItem(itemClass, itemSubClass, itemKey = -1) {
    if (itemClass === -1) throw new Error(`Tried to create Item with class ${itemClass}`);
    const rolls = this._rolls();
    let result;
    if (itemClass === 4) {
      // MagicItems: CreateRegularMagicItem(subClass, level, gender, race)
      const templates = getMagicItemTemplates();
      if (templates) {
        result = createRegularMagicItem(templates,
          this.parentQuest?.hooks?.playerLevel?.() ?? 0,
          this.parentQuest?.hooks?.playerGender?.() ?? 'male',
          rolls, itemSubClass);
      } else {
        // No MAGIC.DEF registered (the headless corpus gate) - a loud
        // stand-in instead of a throw; hosts register the file.
        result = { group: 'MagicItems', pendingMagicDef: true, name: this.itemName || 'magic item' };
      }
    } else if (itemClass === 5) {
      // Artifacts reach the DaggerfallUnityItem ctor in C# and expand
      // their MAGIC.DEF template via SetArtifact.
      const templates = getMagicItemTemplates();
      result = templates
        ? createArtifact(templates, itemSubClass)
        : { group: 'Artifacts', pendingMagicDef: true, artifactIndex: itemSubClass, name: this.itemName };
    } else if (itemClass === 7) {
      // Books: by key or random. The book id (message) and price ride
      // the book catalog - the E1 book-file-pricing ledger row; both
      // key-form and catalog draw are corpus-dead today.
      const variants = ITEM_TEMPLATES[BOOK_TEMPLATE]?.variants ?? 0;
      result = itemKey !== -1
        ? mintCondition({ group: 'Books', templateIndex: BOOK_TEMPLATE, message: itemKey })
        : mintCondition({ group: 'Books', templateIndex: BOOK_TEMPLATE, variant: Math.floor(rolls() * variants) });
    } else if (itemClass === 1 && itemSubClass === 1) {
      // Potions: CreatePotion(key)/CreateRandomPotion - the recipe
      // registry is the potion maker's slice; corpus-dead, minimal.
      result = mintCondition({ group: 'UselessItems1', templateIndex: GROUP_TEMPLATE_INDICES.UselessItems1[1], potionRecipeKey: itemKey });
    } else {
      // Random subclass, then the generic template item
      const groupName = ITEM_GROUP_NAME_BY_CLASS[itemClass];
      const groupIndices = GROUP_TEMPLATE_INDICES[groupName];
      if (!groupIndices) throw new Error(`Tried to create Item with unknown class ${itemClass}`);
      if (itemSubClass === -1) itemSubClass = Math.floor(rolls() * groupIndices.length);
      result = this._templateItem(groupName, groupIndices[itemSubClass], rolls);
    }
    // Randomise clothing dye (ItemBuilder.RandomClothingDye)
    if (result.group === 'MensClothing' || result.group === 'WomensClothing') {
      result.dye = CLOTHING_DYES[Math.floor(rolls() * CLOTHING_DYES.length)];
    }
    return this._link(result);
  }

  /** CreateGold(rangeLow, rangeHigh) - the classic reward formula
   *  with C#'s integer division at every step: playerMod = level/2+1,
   *  or guild rank+1 on a faction quest with factionMod = the
   *  faction's power; clamp 10; amount = Range(150*pm, 200*pm+1)
   *  * (PriceAdjustment/2 + 500)/1000 * (factionMod+50)/100; the
   *  guild's AlterReward last (FightersGuild's rank bonus). */
  _createGold(rangeLow, rangeHigh) {
    const rolls = this._rolls();
    const hooks = this.parentQuest?.hooks;
    let amount = 0;
    if (rangeLow === -1 || rangeHigh === -1) {
      let playerMod = Math.trunc((hooks?.playerLevel?.() ?? 0) / 2) + 1;
      let factionMod = 50;
      let guild = null;
      if ((this.parentQuest?.factionId ?? 0) !== 0) {
        guild = hooks?.getGuild?.(this.parentQuest.factionId) ?? null;
        if (guild && !guild.isNonMember) {
          playerMod = guild.rank + 1;
          factionMod = guild.power;
        }
      }
      if (playerMod > 10) playerMod = 10;
      const regionPriceMod = Math.trunc((hooks?.regionPriceAdjustment?.() ?? 0) / 2);
      const lo = 150 * playerMod, hi = 200 * playerMod + 1;
      const draw = lo + Math.floor(rolls() * (hi - lo));   // Random.Range(lo, hi)
      amount = Math.trunc(Math.trunc(draw * (regionPriceMod + 500) / 1000) * (factionMod + 50) / 100);
      // C# dispatches guild.AlterReward VIRTUALLY - a NonMemberGuild
      // carries the base identity whatever its group, so the group-
      // keyed port must gate on the flag (Q2b-ii VERIFY: an FG
      // non-member record with a rank would have taken the bonus).
      if (guild && !guild.isNonMember) amount = alterReward(guild.guildGroup, guild.rank, amount);
    } else {
      amount = rangeLow + Math.floor(rolls() * (rangeHigh + 1 - rangeLow));
    }
    if (amount < 1) amount = 1;
    return this._link(goldStack(amount));
  }
}
