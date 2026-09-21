using UnityEngine;
using DaggerfallWorkshop.Game.Utility.ModSupport;
using DaggerfallWorkshop.Game;
using DaggerfallWorkshop.Game.Utility.ModSupport.ModSettings;
using DaggerfallWorkshop;
using System.IO;
using System.Collections;
using System.Collections.Generic;

namespace SpellcastStudios
{
    public class SoundList
    {
        private List<SoundClips> soundClips = new List<SoundClips>();
        private List<AudioClip> audioClips = new List<AudioClip>();

        private float pitchMin = 1;
        private float pitchMax = 1;
        private float volume = 1;

        public void SetVolume(float volume)
        {
            this.volume = volume;
        }

        public void SetPitchRange(float min, float max)
        {
            pitchMin = min;
            pitchMax = max;
        }

        public void PlayRandomClip(DaggerfallAudioSource source, AudioSource audioSource, float volume)
        {
            audioSource.pitch = Random.Range(pitchMin, pitchMax);
            audioSource.PlayOneShot(GetRandomClip(source), this.volume * volume);
        }

        public AudioClip GetRandomClip(DaggerfallAudioSource source)
        {
            int max = soundClips.Count + audioClips.Count;

            if (max == 0)
                return null;

            int rand = Random.Range(0, soundClips.Count + audioClips.Count);

            if (rand < soundClips.Count)
                return source.GetAudioClip((int)soundClips[rand]);
            else
                return audioClips[rand];
        }

        public void AddAudioClip(AudioClip clip)
        {
            audioClips.Add(clip);
        }

        public void AddAudioClips(List<AudioClip> clips)
        {
            audioClips.AddRange(clips);
        }

        public void AddSoundClip(SoundClips soundClip)
        {
            soundClips.Add(soundClip);
        }
    }

    public class SoundUtility
    {
        //Imports using my format
        public static List<AudioClip> TryImportAudioClips(string name, string extension, int count, bool streaming)
        {
           var audioClips = new List<AudioClip>();

            for(int i = 0; i < count; i++)
            {
                string cname = name + "_" + i.ToString().PadLeft(3, '0');
                AudioClip clip = null;

                if (TryImportAudioClip(cname, extension, streaming, out clip))
                {
                    audioClips.Add(clip);
                }
            }

            return audioClips;
        }

        //Had to copy code from SoundReplacement 
        public static bool TryImportAudioClip(string name, string extension, bool streaming, out AudioClip audioClip)
        {
            if (DaggerfallUnity.Settings.AssetInjection)
            {
                // Seek from loose files
                string path = Path.Combine(DaggerfallWorkshop.Utility.AssetInjection.SoundReplacement.SoundPath, name + extension);
                if (File.Exists(path))
                {
                    WWW www = new WWW("file://" + path); // TODO: Replace with UnityWebRequest
                    if (streaming)
                    {
                        audioClip = www.GetAudioClip(true, true);
                    }
                    else
                    {
                        audioClip = www.GetAudioClip();
                        DaggerfallUnity.Instance.StartCoroutine(LoadAudioData(www, audioClip));
                    }
                    return true;
                }

                // Seek from mods
                if (ModManager.Instance != null && ModManager.Instance.TryGetAsset(name, false, out audioClip))
                {
                    if (audioClip.preloadAudioData || audioClip.LoadAudioData())
                        return true;

                    Debug.LogErrorFormat("Failed to load audiodata for audioclip {0}", name);
                }
            }

            audioClip = null;
            return false;
        }

        public static IEnumerator LoadAudioData(WWW www, AudioClip clip) // TODO: Replace with UnityWebRequest
        {
            yield return www;

            if (clip.loadState == AudioDataLoadState.Failed)
                Debug.LogErrorFormat("Failed to load audioclip: {0}", www.error);

            www.Dispose();
        }
    }

    public class ShaderUtility
    {
        public static bool TryImportShader(string name, out Shader shader)
        {
            if (DaggerfallUnity.Settings.AssetInjection)
            {
                // Seek from mods
                if (ModManager.Instance != null && ModManager.Instance.TryGetAsset(name, false, out shader))
                {
                    if (shader != null)
                        return true;

                    Debug.LogErrorFormat("Failed to load shader {0}", name);
                }
            }

            shader = null;
            return false;
        }

    }

    public class MaterialUtility
    {
        public static bool TryImportMaterial(string name, out Material material)
        {
            if (DaggerfallUnity.Settings.AssetInjection)
            {
                // Seek from mods
                if (ModManager.Instance != null && ModManager.Instance.TryGetAsset(name, false, out material))
                {
                    if (material != null)
                        return true;

                    Debug.LogErrorFormat("Failed to load material {0}", name);
                }
            }

            material = null;
            return false;
        }

    }

}