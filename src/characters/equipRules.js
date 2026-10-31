// Equip-slot assignment data (Characters C5c).
// EXTRACTION-GENERATED from DFU ItemEquipTable + ItemEnums (MIT,
// Daggerfall Workshop) - never hand-copied; regenerate from source.
// SLOT_RULES: per-group templateIndex -> a fixed slot or a paired
// first-open rule (GetFirstSlot). WEAPON_HANDS: Either / Both per
// weapon template. The two bow rows (129/130) are the extraction's
// record of DFU's OFF answer only: ItemEquipTable.cs:633-635 returns
// LeftOnly when BowLeftHandWithSwitching is on, and AUDIT 58 put that
// branch in getItemHands (equipTable.js), which READS the setting.
// SHIELD_INDICES: LeftOnly in GetItemHands.

export const ITEM_GROUPS = Object.freeze({
 "None": -1,
 "Drugs": 0,
 "UselessItems1": 1,
 "Armor": 2,
 "Weapons": 3,
 "MagicItems": 4,
 "Artifacts": 5,
 "MensClothing": 6,
 "Books": 7,
 "Furniture": 8,
 "UselessItems2": 9,
 "ReligiousItems": 10,
 "Maps": 11,
 "WomensClothing": 12,
 "Paintings": 13,
 "Gems": 14,
 "PlantIngredients1": 15,
 "PlantIngredients2": 16,
 "CreatureIngredients1": 17,
 "CreatureIngredients2": 18,
 "CreatureIngredients3": 19,
 "MiscellaneousIngredients1": 20,
 "MetalIngredients": 21,
 "MiscellaneousIngredients2": 22,
 "Transportation": 23,
 "Deeds": 24,
 "Jewellery": 25,
 "QuestItems": 26,
 "MiscItems": 27,
 "Currency": 28
});
export const SLOT_RULES = Object.freeze({
 "Armor": {
  "102": {
   "slot": "ChestArmor"
  },
  "103": {
   "slot": "Gloves"
  },
  "104": {
   "slot": "LegsArmor"
  },
  "105": {
   "slot": "LeftArm"
  },
  "106": {
   "slot": "RightArm"
  },
  "107": {
   "slot": "Head"
  },
  "108": {
   "slot": "Feet"
  },
  "109": {
   "slot": "LeftHand"
  },
  "110": {
   "slot": "LeftHand"
  },
  "111": {
   "slot": "LeftHand"
  },
  "112": {
   "slot": "LeftHand"
  }
 },
 "Jewellery": {
  "133": {
   "pair": [
    "Amulet0",
    "Amulet1"
   ]
  },
  "138": {
   "pair": [
    "Amulet0",
    "Amulet1"
   ]
  },
  "139": {
   "pair": [
    "Amulet0",
    "Amulet1"
   ]
  },
  "134": {
   "pair": [
    "Bracer0",
    "Bracer1"
   ]
  },
  "135": {
   "pair": [
    "Ring0",
    "Ring1"
   ]
  },
  "136": {
   "pair": [
    "Bracelet0",
    "Bracelet1"
   ]
  },
  "137": {
   "pair": [
    "Mark0",
    "Mark1"
   ]
  }
 },
 "MensClothing": {
  "141": {
   "slot": "ChestClothes"
  },
  "142": {
   "slot": "ChestClothes"
  },
  "143": {
   "slot": "ChestClothes"
  },
  "144": {
   "slot": "ChestClothes"
  },
  "145": {
   "slot": "ChestClothes"
  },
  "146": {
   "slot": "ChestClothes"
  },
  "157": {
   "slot": "ChestClothes"
  },
  "158": {
   "slot": "ChestClothes"
  },
  "159": {
   "slot": "ChestClothes"
  },
  "160": {
   "slot": "ChestClothes"
  },
  "161": {
   "slot": "ChestClothes"
  },
  "163": {
   "slot": "ChestClothes"
  },
  "164": {
   "slot": "ChestClothes"
  },
  "165": {
   "slot": "ChestClothes"
  },
  "166": {
   "slot": "ChestClothes"
  },
  "167": {
   "slot": "ChestClothes"
  },
  "168": {
   "slot": "ChestClothes"
  },
  "169": {
   "slot": "ChestClothes"
  },
  "170": {
   "slot": "ChestClothes"
  },
  "171": {
   "slot": "ChestClothes"
  },
  "172": {
   "slot": "ChestClothes"
  },
  "173": {
   "slot": "ChestClothes"
  },
  "176": {
   "slot": "ChestClothes"
  },
  "177": {
   "slot": "ChestClothes"
  },
  "178": {
   "slot": "ChestClothes"
  },
  "179": {
   "slot": "ChestClothes"
  },
  "180": {
   "slot": "ChestClothes"
  },
  "181": {
   "slot": "ChestClothes"
  },
  "147": {
   "slot": "Feet"
  },
  "148": {
   "slot": "Feet"
  },
  "149": {
   "slot": "Feet"
  },
  "150": {
   "slot": "Feet"
  },
  "151": {
   "slot": "LegsClothes"
  },
  "152": {
   "slot": "LegsClothes"
  },
  "153": {
   "slot": "LegsClothes"
  },
  "156": {
   "slot": "LegsClothes"
  },
  "162": {
   "slot": "LegsClothes"
  },
  "174": {
   "slot": "LegsClothes"
  },
  "175": {
   "slot": "LegsClothes"
  },
  "154": {
   "pair": [
    "Cloak2",
    "Cloak1"
   ]
  },
  "155": {
   "pair": [
    "Cloak2",
    "Cloak1"
   ]
  }
 },
 "WomensClothing": {
  "182": {
   "slot": "ChestClothes"
  },
  "183": {
   "slot": "ChestClothes"
  },
  "184": {
   "slot": "ChestClothes"
  },
  "185": {
   "slot": "ChestClothes"
  },
  "194": {
   "slot": "ChestClothes"
  },
  "195": {
   "slot": "ChestClothes"
  },
  "196": {
   "slot": "ChestClothes"
  },
  "197": {
   "slot": "ChestClothes"
  },
  "198": {
   "slot": "ChestClothes"
  },
  "200": {
   "slot": "ChestClothes"
  },
  "201": {
   "slot": "ChestClothes"
  },
  "202": {
   "slot": "ChestClothes"
  },
  "203": {
   "slot": "ChestClothes"
  },
  "204": {
   "slot": "ChestClothes"
  },
  "205": {
   "slot": "ChestClothes"
  },
  "206": {
   "slot": "ChestClothes"
  },
  "207": {
   "slot": "ChestClothes"
  },
  "208": {
   "slot": "ChestClothes"
  },
  "209": {
   "slot": "ChestClothes"
  },
  "214": {
   "slot": "ChestClothes"
  },
  "215": {
   "slot": "ChestClothes"
  },
  "210": {
   "slot": "ChestClothes"
  },
  "216": {
   "slot": "ChestClothes"
  },
  "186": {
   "slot": "Feet"
  },
  "187": {
   "slot": "Feet"
  },
  "188": {
   "slot": "Feet"
  },
  "189": {
   "slot": "Feet"
  },
  "190": {
   "slot": "LegsClothes"
  },
  "193": {
   "slot": "LegsClothes"
  },
  "199": {
   "slot": "LegsClothes"
  },
  "211": {
   "slot": "LegsClothes"
  },
  "212": {
   "slot": "LegsClothes"
  },
  "213": {
   "slot": "LegsClothes"
  },
  "191": {
   "pair": [
    "Cloak2",
    "Cloak1"
   ]
  },
  "192": {
   "pair": [
    "Cloak2",
    "Cloak1"
   ]
  }
 }
});
export const WEAPON_HANDS = Object.freeze({
 "113": "Either",
 "114": "Either",
 "116": "Either",
 "117": "Either",
 "118": "Either",
 "119": "Either",
 "120": "Either",
 "121": "Either",
 "127": "Either",
 "124": "Either",
 "122": "Both",
 "123": "Both",
 "128": "Both",
 "115": "Both",
 "125": "Both",
 "126": "Both",
 "129": "Both",
 "130": "Both"
});
export const SHIELD_INDICES = Object.freeze([109, 110, 111, 112]);
