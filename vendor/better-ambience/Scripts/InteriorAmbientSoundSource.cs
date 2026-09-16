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
using DaggerfallWorkshop.Game.Weather;

namespace SpellcastStudios.BetterRain
{
    public class InteriorAmbientSoundSource : MonoBehaviour
    {
        public bool isInterior;

        private AudioSource audioSource;
        private WeatherType currentWeatherType;

        private void Start()
        {
            audioSource = gameObject.AddComponent<AudioSource>();
            audioSource.loop = true;
            audioSource.spatialBlend = isInterior ? 0 : 1;

            var lowPassFilter = gameObject.AddComponent<AudioLowPassFilter>();
            lowPassFilter.cutoffFrequency = 4236;
        }

        private void Update()
        {
            if (currentWeatherType != GameManager.Instance.WeatherManager.PlayerWeather.WeatherType)
                UpdateSource();
        }

        private void UpdateSource()
        {
            var weather = GameManager.Instance.WeatherManager.PlayerWeather.WeatherType;

            currentWeatherType = weather;

            if (weather == WeatherType.Rain || weather == WeatherType.Rain_Normal || weather == WeatherType.Thunder)
            {
                AudioClip clip = null;

                if (SoundUtility.TryImportAudioClip("AmbientRaining", "wav", false, out clip))
                    audioSource.clip = clip;

                audioSource.Play();
            }
            else
            {
                audioSource.Stop();
            }    
        }
    }
}