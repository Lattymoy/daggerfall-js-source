// Project:         DiverseWeapons mod for Daggerfall Unity (http://www.dfworkshop.net)
// Copyright:       Copyright (C) 2022 Kirk.O
// License:         MIT License (http://www.opensource.org/licenses/mit-license.php)
// Author:          RealAKP & Kirk.O
// Created On: 	    9/14/2022, 11:00 AM
// Last Edit:		9/14/2022, 11:00 AM
// Version:			1.00
// Special Thanks:  Interkarma, Hazelnut, Numidium
// Modifier:			

using UnityEngine;
using DaggerfallWorkshop.Game;
using DaggerfallWorkshop.Game.Utility.ModSupport;

namespace DiverseWeapons
{
    public class DiverseWeaponsMain : MonoBehaviour
    {
        static DiverseWeaponsMain instance;

        public static DiverseWeaponsMain Instance
        {
            get { return instance ?? (instance = FindObjectOfType<DiverseWeaponsMain>()); }
        }

        static Mod mod;

        [Invoke(StateManager.StateTypes.Start, 0)]
        public static void Init(InitParams initParams)
        {
            mod = initParams.Mod;
            instance = new GameObject("DiverseWeapons").AddComponent<DiverseWeaponsMain>(); // Add script to the scene.

            mod.IsReady = true;
        }

        private void Start()
        {
            Debug.Log("Begin mod init: Diverse Weapons");

            FPSWeapon.moddedWeaponHUDAnimsEnabled = true;

            Debug.Log("Finished mod init: Diverse Weapons");
        }
    }
}
