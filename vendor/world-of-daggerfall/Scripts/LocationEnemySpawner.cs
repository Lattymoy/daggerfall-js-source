using UnityEngine;
using System;
using System.Linq;
using System.Collections.Generic;
using DaggerfallConnect.Arena2;
using DaggerfallConnect.Utility;
using DaggerfallWorkshop.Utility;
using DaggerfallWorkshop.Game.UserInterface;
using DaggerfallWorkshop.Game.Entity;
using DaggerfallWorkshop.Game.MagicAndEffects;
using DaggerfallWorkshop.Game.UserInterfaceWindows;
using DaggerfallWorkshop.Game.Items;
using DaggerfallWorkshop.Game;
using DaggerfallWorkshop;
using DaggerfallWorkshop.Game.Serialization;


namespace DaggerfallWorkshop.Loc
{
    public class LocationEnemySpawner : MonoBehaviour
    {

        public int SpawnType = 0;
        public int enemyID = 0;
        public bool spawnFinished = false;
        public int questID = 0;

        /// <summary>
        /// Spawn Type
        /// </summary>
        // 0 = Quest Event
        // 1 = Billboard Person
        // 2 = Enemy Spawn
        // 3 = Loot
        // 4 = Good Spawn

        ///Enemy Spawns
        // 1 = Bandits
        // 2 = Bears
        // 3 = Warriors/Wizards

        ///Quest Type
        // 0 = Captured Person

        private void Start()
        {
                SaveLoadManager.OnLoad += CheckPlayerDistance_OnLoad;
            //PlayerGPS.OnMapPixelChanged += CheckPlayerDistance_OnMapPixelChange;


            float dist = Vector3.Distance(GameManager.Instance.PlayerMotor.transform.position, gameObject.transform.position);

            if (dist <= 300f)
            {
                gameObject.SetActive(false);
            }

            //PlayerGPS.OnMapPixelChanged += CheckPlayerDistance_OnMapPixelChange;

            //EntityEffectBroker.OnNewMagicRound += CheckPlayerDistance_OnNewMagicRound;

        }

        //private void CheckPlayerDistance_OnMapPixelChange(DFPosition mapPixel)
        //{

        //}

        private void CheckPlayerDistance_OnLoad(SaveData_v1 saveData)
        {

                float dist = Vector3.Distance(GameManager.Instance.PlayerMotor.transform.position, gameObject.transform.position);

                if (dist <= 300f)
                {
                    gameObject.SetActive(false);
                }
            

            //if (SpawnType == 3)
            //{
            //    gameObject.SetActive(false);
            //}
        }

        private void Update()
        {

            float dist = Vector3.Distance(GameManager.Instance.PlayerMotor.transform.position, gameObject.transform.position);

            if (dist <= 100f)
            {
                //Quest
                if (SpawnType == 0)
                {
                    SpawnQuest();
                }
                else { }

                //Billboard Person
                if (SpawnType == 1)
                { }
                else { }


                //Enemy Spawns
                if (SpawnType == 2)
                {
                    if (enemyID == 1)
                    {
                        SpawnThieves();
                    }
                    if (enemyID == 2)
                    {
                        SpawnBears();
                    }
                    if (enemyID == 3)
                    {
                        SpawnWarriors();
                    }
                }
                else
                {
                }

                //Good Spawns
                if (SpawnType == 4)
                {
                    if (enemyID == 1)
                    {
                        SpawnGoodThieves();
                    }
                    if (enemyID == 2)
                    {
                        //SpawnBears();
                    }
                    if (enemyID == 3)
                    {
                        //SpawnWarriors();
                    }
                }
                else
                {
                }

                //Loot SPawn
                if (SpawnType == 3)
                {
                    SpawnLoot();
                }
                else { }

            }
        }

        private void SpawnQuest()
        {
            if (gameObject == null)
                return;

            var SpawnTrue = UnityEngine.Random.Range(1, 40);


            if (questID == 0)
            {
                if (SpawnTrue < 11)
                {
                    GameObject Child = GameObjectHelper.CreateDaggerfallBillboardGameObject(357, 6, gameObject.transform.parent);

                    Child.transform.position = new Vector3(gameObject.transform.position.x, gameObject.transform.position.y, gameObject.transform.position.z);
                }

                if (SpawnTrue > 19 && SpawnTrue < 30)
                {
                    GameObject Merchant = GameObjectHelper.CreateDaggerfallBillboardGameObject(182, 0, gameObject.transform.parent);

                    Merchant.transform.position = new Vector3(gameObject.transform.position.x, gameObject.transform.position.y, gameObject.transform.position.z);
                }

                if (SpawnTrue > 29 && SpawnTrue < 40)
                {
                    GameObject Slave = GameObjectHelper.CreateDaggerfallBillboardGameObject(184, 31, gameObject.transform.parent);

                    Slave.transform.position = new Vector3(gameObject.transform.position.x, gameObject.transform.position.y, gameObject.transform.position.z);
                }
            }
            gameObject.SetActive(false);
        }

        void SpawnLoot()
        {
            if (gameObject == null)
                return;

            var SpawnTrue = UnityEngine.Random.Range(1, 100);

            if (SpawnTrue <= 50)
            {
                GameObject corpseloot = CreateLootContainer(216, UnityEngine.Random.Range(0, 47), gameObject.transform.parent);
                corpseloot.transform.position = new Vector3(gameObject.transform.position.x, gameObject.transform.position.y, gameObject.transform.position.z);
                GameObjectHelper.AlignBillboardToGround(corpseloot, new Vector2(0, 1f), 2);
            }
            gameObject.SetActive(false);
            //// Play body collapse sound
            //if (DaggerfallUI.Instance.DaggerfallAudioSource)
            //{
            //    DaggerfallUI.Instance.DaggerfallAudioSource.PlayClipAtPoint(SoundClips.BodyFall, corpseloot.transform.position, 1f);
            //}


        }

        public static GameObject CreateLootContainer(int textureArchive, int textureRecord, Transform parent)
        {

            GameObject go = GameObject.Instantiate(DaggerfallUnity.Instance.Option_LootContainerPrefab.gameObject);

            // Setup DaggerfallLoot component to make lootable
            DaggerfallLoot loot = go.GetComponent<DaggerfallLoot>();
            if (loot)
            {
                //loot.LoadID = ((ulong)locationID * 10000) + (ulong)objID;
                loot.ContainerType = LootContainerTypes.DroppedLoot;
                loot.ContainerImage = InventoryContainerImages.Chest;
                loot.TextureArchive = textureArchive;
                loot.TextureRecord = textureRecord;
                loot.WorldContext = WorldContext.Exterior;
                //loot.RandomlyAddMap(mapChance, loot.Items);
                //loot.RandomlyAddPotion(4, loot.Items);
                //loot.RandomlyAddPotionRecipe(2, loot.Items);
            }

            if (!DaggerfallWorkshop.Game.Items.LootTables.GenerateLoot(loot, 3))
                DaggerfallUnity.LogMessage(string.Format("DaggerfallInterior: Location type {0} is out of range or unknown.", 0, true));

            if (go.GetComponent<DaggerfallBillboard>() != null)
                go.GetComponent<DaggerfallBillboard>().SetMaterial(textureArchive, textureRecord);

            go.transform.parent = parent;

            return go;
        }

        void SpawnThieves()
        {
            if (gameObject == null)
                return;

            var EnemyType = UnityEngine.Random.Range(1, 3);
            var SpawnTrue = UnityEngine.Random.Range(1, 100);
            if (spawnFinished == false && SpawnTrue >= 50)
            {
                if (EnemyType == 1)
                {
                    GameObject[] thief = GameObjectHelper.CreateFoeGameObjects(gameObject.transform.position, MobileTypes.Thief, 1, MobileReactions.Hostile, null, false);
                    thief[0].transform.Rotate(0f, UnityEngine.Random.Range(0, 180), 0f);
                    thief[0].transform.parent = GameManager.Instance.StreamingTarget.transform;
                    thief[0].SetActive(true);
                    gameObject.SetActive(false);
                }
                if (EnemyType == 2)
                {
                    GameObject[] thief = GameObjectHelper.CreateFoeGameObjects(gameObject.transform.position, MobileTypes.Rogue, 1, MobileReactions.Hostile, null, false);
                    thief[0].transform.Rotate(0f, UnityEngine.Random.Range(0, 180), 0f);
                    thief[0].transform.parent = GameManager.Instance.StreamingTarget.transform;
                    thief[0].SetActive(true);
                    gameObject.SetActive(false);
                }
                if (EnemyType == 3)
                {
                    GameObject[] thief = GameObjectHelper.CreateFoeGameObjects(gameObject.transform.position, MobileTypes.Barbarian, 1, MobileReactions.Hostile, null, false);
                    thief[0].transform.Rotate(0f, UnityEngine.Random.Range(0, 180), 0f);
                    thief[0].transform.parent = GameManager.Instance.StreamingTarget.transform;
                    thief[0].SetActive(true);
                    gameObject.SetActive(false);
                }
            }
            spawnFinished = true;
            gameObject.SetActive(false);
        }

        void SpawnGoodThieves()
        {
            if (gameObject == null)
                return;

            var EnemyType = UnityEngine.Random.Range(1, 3);
            var SpawnTrue = UnityEngine.Random.Range(1, 100);
            if (spawnFinished == false && SpawnTrue >= 50)
            {
                if (EnemyType == 1)
                {
                    GameObject[] thief = GameObjectHelper.CreateFoeGameObjects(gameObject.transform.position, MobileTypes.Thief, 1, MobileReactions.Passive, null, true);
                    thief[0].transform.Rotate(0f, UnityEngine.Random.Range(0, 180), 0f);
                    thief[0].transform.parent = GameManager.Instance.StreamingTarget.transform;
                    thief[0].SetActive(true);
                    gameObject.SetActive(false);
                }
                if (EnemyType == 2)
                {
                    GameObject[] thief = GameObjectHelper.CreateFoeGameObjects(gameObject.transform.position, MobileTypes.Rogue, 1, MobileReactions.Passive, null, true);
                    thief[0].transform.Rotate(0f, UnityEngine.Random.Range(0, 180), 0f);
                    thief[0].transform.parent = GameManager.Instance.StreamingTarget.transform;
                    thief[0].SetActive(true);
                    gameObject.SetActive(false);
                }
                if (EnemyType == 3)
                {
                    GameObject[] thief = GameObjectHelper.CreateFoeGameObjects(gameObject.transform.position, MobileTypes.Barbarian, 1, MobileReactions.Passive, null, true);
                    thief[0].transform.Rotate(0f, UnityEngine.Random.Range(0, 180), 0f);
                    thief[0].transform.parent = GameManager.Instance.StreamingTarget.transform;
                    thief[0].SetActive(true);
                    gameObject.SetActive(false);
                }
            }
            spawnFinished = true;
            gameObject.SetActive(false);
        }

        void SpawnBears()
        {
            if (gameObject == null)
                return;

            //var EnemyType = UnityEngine.Random.Range(1, 3);
            var SpawnTrue = UnityEngine.Random.Range(1, 100);
            if (spawnFinished == false && SpawnTrue >= 40)
            {
                    GameObject[] thief = GameObjectHelper.CreateFoeGameObjects(gameObject.transform.position, MobileTypes.GrizzlyBear, 1, MobileReactions.Hostile, null, false);
                    thief[0].transform.Rotate(0f, UnityEngine.Random.Range(0, 180), 0f);
                thief[0].transform.parent = GameManager.Instance.StreamingTarget.transform;
                thief[0].SetActive(true);
                gameObject.SetActive(false);
            }
            spawnFinished = true;
            gameObject.SetActive(false);
        }

        void SpawnWarriors()
        {
            if (gameObject == null)
                return;

            var EnemyType = UnityEngine.Random.Range(1, 6);
            var SpawnTrue = UnityEngine.Random.Range(1, 100);
            if (spawnFinished == false && SpawnTrue >= 50)
            {
                if (EnemyType == 1)
                {
                    GameObject[] thief = GameObjectHelper.CreateFoeGameObjects(gameObject.transform.position, MobileTypes.Warrior, 1, MobileReactions.Hostile, null, false);
                    thief[0].transform.Rotate(0f, UnityEngine.Random.Range(0, 180), 0f);
                    thief[0].transform.parent = GameManager.Instance.StreamingTarget.transform;
                    thief[0].SetActive(true);
                    gameObject.SetActive(false);
                }
                if (EnemyType == 2)
                {
                    GameObject[] thief = GameObjectHelper.CreateFoeGameObjects(gameObject.transform.position, MobileTypes.Sorcerer, 1, MobileReactions.Hostile, null, false);
                    thief[0].transform.Rotate(0f, UnityEngine.Random.Range(0, 180), 0f);
                    thief[0].transform.parent = GameManager.Instance.StreamingTarget.transform;
                    thief[0].SetActive(true);
                    gameObject.SetActive(false);
                }
                if (EnemyType == 3)
                {
                    GameObject[] thief = GameObjectHelper.CreateFoeGameObjects(gameObject.transform.position, MobileTypes.Ranger, 1, MobileReactions.Hostile, null, false);
                    thief[0].transform.Rotate(0f, UnityEngine.Random.Range(0, 180), 0f);
                    thief[0].transform.parent = GameManager.Instance.StreamingTarget.transform;
                    thief[0].SetActive(true);
                    gameObject.SetActive(false);
                }
                if (EnemyType == 4)
                {
                    GameObject[] thief = GameObjectHelper.CreateFoeGameObjects(gameObject.transform.position, MobileTypes.Mage, 1, MobileReactions.Hostile, null, false);
                    thief[0].transform.Rotate(0f, UnityEngine.Random.Range(0, 180), 0f);
                    thief[0].transform.parent = GameManager.Instance.StreamingTarget.transform;
                    thief[0].SetActive(true);
                    gameObject.SetActive(false);
                }
                if (EnemyType == 5)
                {
                    GameObject[] thief = GameObjectHelper.CreateFoeGameObjects(gameObject.transform.position, MobileTypes.Knight, 1, MobileReactions.Hostile, null, false);
                    thief[0].transform.Rotate(0f, UnityEngine.Random.Range(0, 180), 0f);
                    thief[0].transform.parent = GameManager.Instance.StreamingTarget.transform;
                    thief[0].SetActive(true);
                    gameObject.SetActive(false);
                }
                if (EnemyType == 6)
                {
                    GameObject[] thief = GameObjectHelper.CreateFoeGameObjects(gameObject.transform.position, MobileTypes.Healer, 1, MobileReactions.Hostile, null, false);
                    thief[0].transform.Rotate(0f, UnityEngine.Random.Range(0, 180), 0f);
                    thief[0].transform.parent = GameManager.Instance.StreamingTarget.transform;
                    thief[0].SetActive(true);
                    gameObject.SetActive(false);
                }
            }
            spawnFinished = true;
            gameObject.SetActive(false);
        }



    }
}