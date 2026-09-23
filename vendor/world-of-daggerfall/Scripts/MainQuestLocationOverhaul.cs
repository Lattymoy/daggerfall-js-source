using DaggerfallWorkshop.Game;
using DaggerfallWorkshop.Game.Utility.ModSupport;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using System;

namespace MainQuestEnhanced
{
    public class MainQuestLocationOverhaul : MonoBehaviour
    {

        private static Mod mod;
        private static GameObject _gameObject;


        private static bool _INITIALIZED = false;

        [Invoke(StateManager.StateTypes.Start)]
        public static void Init(InitParams initParams)
        {
            mod = initParams.Mod;
            mod.IsReady = true;
            _gameObject = new GameObject("MainQuestEnhanced");
            _gameObject.AddComponent<DungeonExterior>();

            //Mod tediousTravel = ModManager.Instance.GetMod("TediousTravel");
            //Mod handPaintedModels = ModManager.Instance.GetMod("handpainted models - buildings");
            //DaggerfallBlock [CUSTAA30.RMB]
        }








    }
}
