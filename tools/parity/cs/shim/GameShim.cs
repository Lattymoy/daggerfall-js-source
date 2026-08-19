// Shims for the handful of DaggerfallWorkshop game-layer symbols the API readers touch.
// Every shim reproduces the VANILLA, NO-MODS, DEFAULT-SETTINGS behaviour exactly:
//  * WorldDataReplacement: all entry points are gated on DaggerfallUnity.Settings.AssetInjection
//    or on dictionaries that stay empty without mods -> null / -1 / false.
//  * QuestMachine: no quest running -> GetSiteLinks returns null.
//  * Settings.SmallerDungeons: default false (settings.ini default).
//  * DaggerfallDungeon.IsMainStoryDungeon: verbatim copy of Internal/DaggerfallDungeon.cs:146.
using System;
using System.Collections.Generic;
using DaggerfallConnect;
using DaggerfallConnect.Arena2;

namespace DaggerfallWorkshop
{
    public class DaggerfallDungeon
    {
        // Verbatim from Assets/Scripts/Internal/DaggerfallDungeon.cs IsMainStoryDungeon()
        public static bool IsMainStoryDungeon(int id)
        {
            bool mainStoryDungeon = false;
            switch (id)
            {
                case 187853213:
                case 630439035:
                case 1291010263:
                case 6634853:
                case 19021260:
                case 728811286:
                case 701948302:
                case 83032363:
                case 1001:
                case 207828842:
                case 9570447:
                case 2352284:
                case 336619236:
                case 43196334:
                    mainStoryDungeon = true;
                    break;
                default:
                    break;
            }
            return mainStoryDungeon;
        }
    }

    public class SettingsShim
    {
        public bool AssetInjection = false;
        public bool SmallerDungeons = false;
        public int RandomDungeonTextures = 0;
    }

    public static class DaggerfallUnity
    {
        static SettingsShim settings = new SettingsShim();
        public static SettingsShim Settings { get { return settings; } }
        public static void LogMessage(string message, bool showInEditor = false)
        {
            Console.Error.WriteLine("[DFU] " + message);
        }
    }
}

namespace DaggerfallWorkshop.Game
{
    public class GameManagerPlaceholder { }
}

namespace DaggerfallWorkshop.Game.Utility
{
    public class NameHelper
    {
        // Verbatim ordering from Assets/Scripts/Game/Utility/NameHelper.cs
        public enum BankTypes
        {
            Breton, Redguard, Nord, DarkElf, HighElf, WoodElf, Khajiit, Imperial,
            Monster1, Monster2, Monster3,
        }
    }
}

namespace DaggerfallWorkshop.Game.Questing
{
    public enum SiteTypes { None, Dungeon, Building, Town }
    public enum QuestSmallerDungeonsState { NotSet, Enabled, Disabled }
    public class SiteLink { public ulong questUID; }
    public class Quest { public QuestSmallerDungeonsState SmallerDungeonsState; }
    public class QuestMachine
    {
        static QuestMachine instance = new QuestMachine();
        public static QuestMachine Instance { get { return instance; } }
        // No quests running in the harness -> classic path.
        public SiteLink[] GetSiteLinks(SiteTypes type, int mapId, int regionIndex = -1) { return null; }
        public Quest GetQuest(ulong uid) { return null; }
    }
}

namespace DaggerfallWorkshop.Utility.AssetInjection
{
    public struct BuildingReplacementData
    {
        public ushort FactionId;
        public int BuildingType;
        public byte Quality;
        public ushort NameSeed;
        public DFBlock.RmbSubRecord RmbSubRecord;
        public byte[] AutoMapData;
    }

    public class WorldDataReplacement
    {
        public static bool GetDFRegionAdditionalLocationData(int regionIndex, ref DFRegion dfRegion) { return false; }
        public static bool GetDFLocationReplacementData(int regionIndex, int locationIndex, out DFLocation dfLocation)
        { dfLocation = new DFLocation(); return false; }
        public static int GetNewDFBlockIndex(string blockName) { return -1; }
        public static string GetNewDFBlockName(int block) { return null; }
        public static bool GetDFBlockReplacementData(int block, string blockName, out DFBlock dfBlock)
        { dfBlock = new DFBlock(); return false; }
        public static bool GetBuildingReplacementData(string blockName, int blockIndex, int recordIndex, out BuildingReplacementData buildingData)
        { buildingData = new BuildingReplacementData(); return false; }
        public static void ApplyBuildingReplacementAutoMapData(BuildingReplacementData buildingData, ref byte[] blockAutoMapData) { }
    }
}

namespace DaggerfallConnect.Save
{
    // Only used by FactionFile.Merge() for classic-save import; never exercised by the harness.
    public class SaveVars
    {
        public FactionFile.FactionData[] Factions { get { return new FactionFile.FactionData[0]; } }
    }
}
