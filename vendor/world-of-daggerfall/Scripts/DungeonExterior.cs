using DaggerfallConnect;
using DaggerfallWorkshop;
using DaggerfallWorkshop.Game;
using DaggerfallWorkshop.Game.UserInterfaceWindows;
using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace MainQuestEnhanced
{
    public class DungeonExterior : MonoBehaviour
    {
        private DFRegion.DungeonTypes playerDungeon;
        private DFLocation Dungeon;
        public static GameObject PrivateHold;
        public static GameObject Ship;






        // Start is called before the first frame update
        void Start()
        {
            PlayerEnterExit.OnTransitionExterior += checkMainQuestDugeonExit;
            //DaggerfallTravelPopUp.OnPreFastTravel += clearEnemies_OnPreFastTravel;

        }

        private void clearEnemies_OnPreFastTravel(DaggerfallTravelPopUp obj)
        {
            foreach (var gameObj in FindObjectsOfType(typeof(GameObject)) as GameObject[])
            {
                //if (gameObj.GetComponent<KamerGateGuardDetection>() != null)
                //{
                //    Destroy(gameObj);
                //}

                if (gameObj.name == "DaggerfallEnemy [Rogue]")
                {
                    gameObj.SetActive(false);
                }

                if (gameObj.name == "DaggerfallEnemy [Thief]")
                {
                    gameObj.SetActive(false);
                }
                if (gameObj.name == "DaggerfallEnemy [Ranger]")
                {
                    gameObj.SetActive(false);
                }
                if (gameObj.name == "DaggerfallEnemy [Sorcerer]")
                {
                    gameObj.SetActive(false);
                }
                if (gameObj.name == "DaggerfallEnemy [Knight]")
                {
                    gameObj.SetActive(false);
                }
                if (gameObj.name == "DaggerfallEnemy [Mage]")
                {
                    gameObj.SetActive(false);
                }
                if (gameObj.name == "DaggerfallEnemy [Assassin]")
                {
                    gameObj.SetActive(false);
                }
                if (gameObj.name == "DaggerfallEnemy [Grizzly_Bear]")
                {
                    gameObj.SetActive(false);
                }
            }
        }

        // Update is called once per frame
        void Update()
        {

            checkMainQuestDugeon();
            //playerDungeon = GameManager.Instance.PlayerGPS.CurrentLocation.MapTableData.DungeonType;

            if (IsPlayerInDungeonType(DFRegion.DungeonTypes.BarbarianStronghold) ||
                IsPlayerInDungeonType(DFRegion.DungeonTypes.Cemetery) ||
                IsPlayerInDungeonType(DFRegion.DungeonTypes.Coven) ||
                IsPlayerInDungeonType(DFRegion.DungeonTypes.Crypt) ||
                IsPlayerInDungeonType(DFRegion.DungeonTypes.DesecratedTemple) ||
                IsPlayerInDungeonType(DFRegion.DungeonTypes.DragonsDen) ||
                IsPlayerInDungeonType(DFRegion.DungeonTypes.GiantStronghold) ||
                IsPlayerInDungeonType(DFRegion.DungeonTypes.HarpyNest) ||
                IsPlayerInDungeonType(DFRegion.DungeonTypes.HumanStronghold) ||
                IsPlayerInDungeonType(DFRegion.DungeonTypes.Laboratory) ||
                IsPlayerInDungeonType(DFRegion.DungeonTypes.Mine) ||
                IsPlayerInDungeonType(DFRegion.DungeonTypes.NaturalCave) ||
                IsPlayerInDungeonType(DFRegion.DungeonTypes.OrcStronghold) ||
                IsPlayerInDungeonType(DFRegion.DungeonTypes.Prison) ||
                IsPlayerInDungeonType(DFRegion.DungeonTypes.RuinedCastle) ||
                IsPlayerInDungeonType(DFRegion.DungeonTypes.ScorpionNest) ||
                IsPlayerInDungeonType(DFRegion.DungeonTypes.SpiderNest) ||
                IsPlayerInDungeonType(DFRegion.DungeonTypes.VampireHaunt) ||
                IsPlayerInDungeonType(DFRegion.DungeonTypes.VolcanicCaves))
                {
                //DaggerfallUI.AddHUDText("Dungeon Type Detected.");
            }

            if (IsPlayerInLocationType(DFRegion.LocationTypes.DungeonLabyrinth))
            {
                ///DaggerfallUI.AddHUDText("DungeonLab.");
            }
            
        }




        private static void checkMainQuestDugeonExit(PlayerEnterExit.TransitionEventArgs args)
        {
            checkMainQuestDugeon();
        }


        /// <summary>
        /// Gets the Dungeon Type to spawn appropriate theme
        /// </summary>
        /// <param name="dungeonType"></param>
        /// <returns></returns>
        public static bool IsPlayerInDungeonType(DFRegion.DungeonTypes dungeonType)
        {
            PlayerGPS playerGps = GameManager.Instance.PlayerGPS;

            if (!playerGps.IsPlayerInLocationRect)
                return false;

            return playerGps.CurrentLocation.MapTableData.DungeonType == dungeonType;
        }



        /// <summary>
        /// Checks if the palyer is at a location.
        /// </summary>
        /// <param name="locationType"></param>
        /// <returns></returns>
        public static bool IsPlayerInLocationType(DFRegion.LocationTypes locationType)
        {
            PlayerGPS playerGps = GameManager.Instance.PlayerGPS;

            if (!GameManager.Instance.PlayerGPS.HasCurrentLocation)
                return false;

            return GameManager.Instance.PlayerGPS.CurrentLocationType == locationType;
        }


        

        //41214 Wagon
        //61127 wood 1
        //61132 ship wheel
        //43137 grave
        //43142
        //41407// Catlepult launch
        //41401
        //41406 Catapult 
        //60714
        //41506
        //41509 // crashed ship
        //41715 // big rock
        //41607 tents
        //43516 ruins
        //41736 treee
        //418 boxes
        //1002 wodden floor
        //74019 wooden block
        //62311 Grave yard Arch
        //42512 Flag


        private static void checkMainQuestDugeon()
        {

            PrivateHold = GameObject.Find("DaggerfallBlock [CUSTAA30.RMB]");

            if (PrivateHold != null)
            {
                if (PrivateHold.GetComponent<PrivateersHold>() == null)
                {
                    PrivateHold.AddComponent<PrivateersHold>();
                }
            }

            //Ship = GameObject.Find("DaggerfallTerrain [109,157]");
             
            //if (Ship!= null)
            //{
            //    if (Ship.GetComponent<CrashedShip>() == null)
            //    {
            //        Ship.AddComponent<CrashedShip>();
            //    }
            //}

            //foreach (var location in FindObjectsOfType(typeof(GameObject)) as GameObject[])
            //{


                //Main Quest Dungeons

                //if (location.name == "DaggerfallTerrain [109,157]")
                //{
                //    {
                //        if (location.GetComponent<CrashedShip>() == null)
                //        {
                //            location.AddComponent<CrashedShip>();
                //        }
                //    }
                //}



                ///Laberyith Blocks

                //if (location.name == "DaggerfallBlock [DUNGAA00.RMB]")
                //{
                //    {
                //        if (location.GetComponent<DUNGAA00>() == null)
                //        {
                //            location.AddComponent<DUNGAA00>();
                //        }
                //    }
                //}




            //}
        }






    }
}
