using UnityEngine;
using DaggerfallWorkshop.Game.Utility.ModSupport;
using DaggerfallWorkshop.Game;
using DaggerfallWorkshop.Game.Utility.ModSupport.ModSettings;
using DaggerfallWorkshop;
using System;
using UnityEngine.UIElements;
using DaggerfallWorkshop.Utility;
using DaggerfallWorkshop.Utility.AssetInjection;
using DaggerfallWorkshop.Game.Serialization;
using DaggerfallWorkshop.Game.Utility;
using System.Collections;

namespace SpellcastStudios.BetterRain
{
    public class BetterRainMod : MonoBehaviour
    {
        private static Mod mod;
        private ModSettings settings;

        private bool enableBetterRain;
        private bool enableBetterSnow;

        private ParticleSystem rainSystem;
        private bool wasStorming;

        private int rainAmount = 3000;
        private int stormAmount = 10000;

        private Texture2D rainTexture;
        private Material rainMaterial;

        [Invoke(StateManager.StateTypes.Start, 0)]
        public static void Init(InitParams initParams)
        {
            Debug.Log("Initializing Better Rain Mod");
            mod = initParams.Mod;

            var go = new GameObject("Better Rain Module");
            go.AddComponent<BetterRainMod>();
        }

        private void Start()
        {
            mod.IsReady = true;

            LoadSettings(mod.GetSettings());

            var systems = GameManager.Instance.PlayerObject.GetComponentsInChildren<ParticleSystem>(true);

            foreach(var system in systems)
            {
                //Rain!
                if (system.gameObject.name == "Rain_Particles" && enableBetterRain)
                {
                    rainSystem = system;
                    SetRainSettings(system);
                }

                //Snow!
                if (system.gameObject.name == "Snow_Particles" && enableBetterSnow)
                    SetSnowSettings(system);
            }

            SaveLoadManager.OnLoad += OnLoad;
            StartGameBehaviour.OnStartGame += OnStartGame;
            PlayerEnterExit.OnTransitionDungeonInterior += OnTransition;
            PlayerEnterExit.OnTransitionDungeonExterior += OnTransition;
            PlayerEnterExit.OnTransitionInterior += OnTransition;
            PlayerEnterExit.OnTransitionExterior += OnTransition;
        }

        private void Update()
        {
            if (!enableBetterRain)
                return;

            if (GameManager.Instance.WeatherManager.IsStorming != wasStorming)
            {
                UpdateStormState();
                wasStorming = GameManager.Instance.WeatherManager.IsStorming;
            }
        }

        private void UpdateStormState()
        {
            var emission = rainSystem.emission;
            int count = GameManager.Instance.WeatherManager.IsStorming ? stormAmount : rainAmount;

            emission.rateOverTime = new ParticleSystem.MinMaxCurve(count);
        }

        private void LoadSettings(ModSettings settings)
        {
            enableBetterRain = settings.GetValue<bool>("Better Rain", "enableBetterRain");
            enableBetterSnow = settings.GetValue<bool>("Better Rain", "enableBetterSnow");
        }

        private void OnStartGame(object sender, EventArgs e)
        {
            StartCoroutine(UpdateAmbientSoundSources());
        }

        private void OnLoad(SaveData_v1 saveData)
        {
            StartCoroutine(UpdateAmbientSoundSources());
        }

        private void OnTransition(PlayerEnterExit.TransitionEventArgs args)
        {
            StartCoroutine(UpdateAmbientSoundSources());
        }

        private IEnumerator UpdateAmbientSoundSources()
        {
            //Wait some frames XD
            yield return null;
            yield return null;
            yield return null;
            yield return null;

            foreach (var ambientSource in GameObject.FindObjectsOfType<InteriorAmbientSoundSource>())
                Destroy(ambientSource.gameObject);

            var dungeon = GameManager.Instance.PlayerEnterExit.Dungeon;
            var interior = GameManager.Instance.PlayerEnterExit.Interior;

            if (dungeon != null)
            {
                var exit = GameObject.Find("DungeonExit");

                if (exit != null)
                {
                    GameObject ambientSoundSource = new GameObject("Ambient Sound Source");
                    ambientSoundSource.transform.position = exit.transform.position;
                    ambientSoundSource.AddComponent<InteriorAmbientSoundSource>();
                }
            }
            else if(interior != null)
            {
                GameObject ambientSoundSource = new GameObject("Global Ambient Sound Source");
                var source = ambientSoundSource.AddComponent<InteriorAmbientSoundSource>();
                source.isInterior = true;
            }
        }

        private void AddAmbientSoundAtPosition(Vector3 position)
        {
        }

        private void SetSnowSettings(ParticleSystem system)
        {
            var render = system.GetComponent<ParticleSystemRenderer>();
            render.material.SetFloat("_InvFade", 3);

            var subParticles = system.subEmitters;
            subParticles.enabled = false;
        }

        private void SetRainSettings(ParticleSystem system)
        {
            system.gameObject.transform.rotation = Quaternion.Euler(90, 0, 0);

            var main = system.main;
            main.startSpeed = new ParticleSystem.MinMaxCurve(100);
            main.startSize = new ParticleSystem.MinMaxCurve(0.16f,2);
            main.startColor = new ParticleSystem.MinMaxGradient(new Color(0.575f, 0.575f, 0.575f, 0.5f), new Color(0.575f, 0.575f, 0.575f, 0.4f));

            var shape = system.shape;
            shape.scale = new Vector3(100, 100, 0);

            var forceOverLifetime = system.forceOverLifetime;
            forceOverLifetime.x = new ParticleSystem.MinMaxCurve(10, 20);
            forceOverLifetime.y = new ParticleSystem.MinMaxCurve(0);
            forceOverLifetime.z = new ParticleSystem.MinMaxCurve(0);

            var subParticles = system.subEmitters;
            subParticles.enabled = false;

            var render = system.GetComponent<ParticleSystemRenderer>();
            render.minParticleSize = 0.001f;
            render.maxParticleSize = 0.003f;
            render.lengthScale = 5f;

            if(rainTexture == null)
            {
                string rainTexPath = Application.isEditor ? "tex_part_weather_rain.png" : "tex_part_weather_rain";

                if (!TextureReplacement.TryImportTexture(rainTexPath, true, out rainTexture))
                    Debug.LogError("Better Ambience :: Better Rain :: Failed to load rain texture");
            }
            
            if (MaterialUtility.TryImportMaterial("mat_weather_rain", out rainMaterial))
                render.sharedMaterial = rainMaterial;
            else
            {
                Debug.LogError("Better Ambience :: Better Rain :: Failed to load material");
            }

        }

    }
}