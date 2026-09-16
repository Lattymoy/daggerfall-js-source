using UnityEngine;
using DaggerfallWorkshop.Game.Utility.ModSupport;
using DaggerfallWorkshop.Game;
using DaggerfallWorkshop.Game.Utility;
using System;
using System.Collections;
using UnityEngine.Rendering.PostProcessing;
using DaggerfallWorkshop.Game.Utility.ModSupport.ModSettings;
using DaggerfallWorkshop;
using DaggerfallWorkshop.Game.Serialization;

namespace SpellcastStudios.FoggyDungeons
{
    public class FoggyDungeonsMod : MonoBehaviour
    {
        public float maxFogDistance = 100;
        public float minFogDistance = 80;
        public float maxFogStart = 10;
        public float minFogStart = 0;

        public bool enableFog = true;
        public bool enableAmbientLighting = true;
        public float ambientLerp = 0.2f;
        public float dungeonDarkness = 1;

        public bool totalRandom = false;

        private static Mod mod;
        private PostProcessVolume postProcessingBehaviour;
        private PlayerAmbientLight playerAmbientLight;
        private AmbientOcclusion ambientOcclusion;
        private Vignette vignette;

        [Invoke(StateManager.StateTypes.Start, 0)]
        public static void Init(InitParams initParams)
        {
            Debug.Log("Initializing Foggy Dungeon Mod");
            mod = initParams.Mod;

            var go = new GameObject("Foggy Dungeons Module");
            go.AddComponent<FoggyDungeonsMod>();
        }

        private void Start()
        {
            GameObject volumeObject = new GameObject();

            postProcessingBehaviour = Camera.main.GetComponent<PostProcessVolume>();

            playerAmbientLight = GameManager.Instance.PlayerObject.GetComponent<PlayerAmbientLight>();

            StartGameBehaviour.OnStartGame += OnStartGame;
            PlayerEnterExit.OnTransitionDungeonInterior += OnEnterDungeon;
            PlayerEnterExit.OnTransitionDungeonExterior += OnExitDungeon;
            SaveLoadManager.OnLoad += OnLoad;
        }

        private void OnLoad(SaveData_v1 saveData)
        {
            StartCoroutine(UpdateDungeonFog());
        }

        private void LoadSettings(ModSettings settings)
        {
            enableFog = settings.GetValue<bool>("Dungeon Fog", "enableFog");
            maxFogDistance = settings.GetValue<float>("Dungeon Fog", "maxFogDistance");
            minFogDistance = settings.GetValue<float>("Dungeon Fog", "minFogDistance");
            maxFogStart = settings.GetValue<float>("Dungeon Fog", "maxFogStart");
            minFogStart = settings.GetValue<float>("Dungeon Fog", "minFogStart");

            enableAmbientLighting = settings.GetValue<bool>("Dungeon Lighting", "enableFogAmbientEffect");
            dungeonDarkness = settings.GetValue<float>("Dungeon Lighting", "dungeonDarkness");
            ambientLerp = settings.GetValue<float>("Dungeon Lighting", "fogAmbientEffect");
        }

        private void OnStartGame(object sender, EventArgs e)
        {
            StartCoroutine(UpdateDungeonFog());
        }

        private void OnEnterDungeon(PlayerEnterExit.TransitionEventArgs args)
        {
            StartCoroutine(UpdateDungeonFog());
        }

        private void OnExitDungeon(PlayerEnterExit.TransitionEventArgs args)
        {
            StartCoroutine(UpdateDungeonFog());
        }

        private void DisableDungeonFog()
        {
            if (enableAmbientLighting && playerAmbientLight != null)
            {
                playerAmbientLight.enabled = true;

                //Force everything to reset
                var flags = System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic;

                typeof(PlayerAmbientLight).GetField("fadeRunning", flags).SetValue(playerAmbientLight, false);
                typeof(PlayerAmbientLight).GetMethod("Start", flags).Invoke(playerAmbientLight, new object[0]);

                RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
            }
        }

        private void EnableDungeonFog(DaggerfallDungeon dungeon)
        {
            var rnd = totalRandom ? new System.Random(Time.time.GetHashCode()) : new System.Random(dungeon.name.GetHashCode());
            Color fogColor = new Color((float)rnd.NextDouble(), (float)rnd.NextDouble(), (float)rnd.NextDouble());

            if (enableFog)
            {
                float start = ((float)rnd.NextDouble() * (maxFogStart - minFogStart)) + minFogStart;
                float end = ((float)rnd.NextDouble() * (maxFogDistance - minFogDistance)) + minFogDistance + start;

                RenderSettings.fogColor = fogColor * dungeonDarkness;
                RenderSettings.fogStartDistance = start;
                RenderSettings.fogEndDistance = end;
                RenderSettings.fogMode = FogMode.Linear;

            }

            if(enableAmbientLighting)
            {
                if (playerAmbientLight != null)
                {
                    playerAmbientLight.enabled = false;
                    playerAmbientLight.StopAllCoroutines();
                }

                RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;

                Color sky = Color.Lerp(new Color(0.433f, 0.433f, 0.433f), fogColor, ambientLerp) * dungeonDarkness;
                Color equator = Color.Lerp(new Color(0.396f, 0.396f, 0.396f), fogColor, ambientLerp) * dungeonDarkness;
                Color ground = Color.Lerp(new Color(0.254f, 0.254f, 0.254f), fogColor, ambientLerp) * dungeonDarkness;

                RenderSettings.ambientSkyColor = sky;
                RenderSettings.ambientEquatorColor = equator;
                RenderSettings.ambientGroundColor = ground;
            }
        }

        private IEnumerator UpdateDungeonFog()
        {
            //Wait some frames XD
            yield return null;
            yield return null;
            yield return null;
            yield return null;

            LoadSettings(mod.GetSettings());

            var dungeon = GameManager.Instance.PlayerEnterExit.Dungeon;

            if (dungeon == null || GameManager.Instance.PlayerEnterExit.IsPlayerInsideDungeonCastle)
            {
                DisableDungeonFog();
                yield break;
            }

            EnableDungeonFog(dungeon);
        }

    }
}