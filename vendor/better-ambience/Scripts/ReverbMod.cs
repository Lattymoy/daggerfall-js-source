using UnityEngine;
using DaggerfallWorkshop.Game.Utility.ModSupport;
using DaggerfallWorkshop.Game;
using DaggerfallWorkshop.Game.Utility.ModSupport.ModSettings;

namespace SpellcastStudios.Reverb
{
    public class ReverbMod : MonoBehaviour
    {
        private static Mod mod;

        private ModSettings settings;
        private bool isInsideDungeon;
        private AudioReverbZone reverbZone;

        [Invoke(StateManager.StateTypes.Start, 0)]
        public static void Init(InitParams initParams)
        {
            Debug.Log("Initializing Reverb Mod");
            mod = initParams.Mod;

            var go = new GameObject(mod.Title);
            go.AddComponent<ReverbMod>();

        }

        private void Start()
        {
            reverbZone = GameManager.Instance.PlayerObject.AddComponent<AudioReverbZone>();

            this.settings = mod.GetSettings();
            UpdateReverbZone();

            mod.IsReady = true;
        }

        private void Update()
        {
            //Detect change
            if (isInsideDungeon != GameManager.Instance.PlayerEnterExit.IsPlayerInsideDungeon)
                UpdateReverbZone();
        }

        private void UpdateReverbZone()
        {
            isInsideDungeon = GameManager.Instance.PlayerEnterExit.IsPlayerInsideDungeon;
            reverbZone.enabled = isInsideDungeon;
            reverbZone.minDistance = 1000;
            reverbZone.maxDistance = 1000;

            int level = settings.GetValue<int>("Dungeon Reverb", "level");

            if (level == 0) // Low
                reverbZone.reverbPreset = AudioReverbPreset.Cave;

            if (level == 1) // Medium
                reverbZone.reverbPreset = AudioReverbPreset.Stoneroom;

            if (level == 2) // High
                reverbZone.reverbPreset = AudioReverbPreset.Quarry;

        }
    }
}