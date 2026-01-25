using Firesplash.GameDevAssets.SocketIO;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.Video;   
using System.Collections.Generic;
using System.Linq;
using TMPro;

// -----------------------------
// Data classes
// -----------------------------
[System.Serializable]
public class Player
{
    public string id;         // socket id from server
    public string name;       // display name
    public string character;  // chosen character name (filled in by host from assignments)
}

[System.Serializable]
public class IdentifyPayload
{
    public string clientType;
}

[System.Serializable]
public class RoomCreatedResponse
{
    public string roomCode;
}

// IMPORTANT: JsonUtility-friendly replacement for Dictionary<string,string>
[System.Serializable]
public class CharacterAssignment
{
    public string playerId;       // must match Player.id
    public string characterName;  // e.g. "Daria", "Logan", "Tony"
}

[System.Serializable]
public class RoomUpdateResponse
{
    public Player[] players;
    public CharacterAssignment[] characters;
}

[System.Serializable]
public class RollData
{
    public string playerName;
    public int rollValue;
}

[System.Serializable]
public class CharacterMaterial
{
    public string characterName;
    public Material material;
}

// [System.Serializable]
// public class CharacterUIColor
// {
//     public string characterName;
//     public Color uiColor = Color.white;
// }

// -----------------------------
// Wrapper for arrays when using JsonUtility
// -----------------------------
[System.Serializable]
public class StringArrayWrapper
{
    public string[] order;
}

// JsonHelper to parse arrays (string[] used for player order)
public static class JsonHelper
{
    public static T[] FromJsonArray<T>(string jsonArray)
    {
        jsonArray = jsonArray?.Trim();
        if (jsonArray == null) return new T[0];

        // If the JSON is itself a quoted string (like "\"[... ]\""), remove surrounding quotes
        if (jsonArray.Length >= 2 && jsonArray[0] == '"' && jsonArray[jsonArray.Length - 1] == '"')
        {
            jsonArray = jsonArray.Substring(1, jsonArray.Length - 2);
            jsonArray = jsonArray.Replace("\\\"", "\"").Replace("\\\\", "\\");
        }

        string wrapped = "{\"order\":" + jsonArray + "}";
        StringArrayWrapper wrapper = JsonUtility.FromJson<StringArrayWrapper>(wrapped);
        if (wrapper == null || wrapper.order == null) return new T[0];

        if (typeof(T) == typeof(string))
        {
            object cast = wrapper.order;
            return (T[])cast;
        }

        List<T> list = new List<T>();
        foreach (var itemJson in wrapper.order)
        {
            try
            {
                T obj = JsonUtility.FromJson<T>(itemJson);
                list.Add(obj);
            }
            catch
            {
                // ignore element if it can't parse
            }
        }
        return list.ToArray();
    }
}

// -----------------------------
// GameManager
// -----------------------------
public class GameManager : MonoBehaviour

{
    public SocketIOCommunicator socket;
     [SerializeField] private VideoPlayer videoPlayer;
    [SerializeField] private GameObject videoContainer; 

    [Header("UI Elements")]
    public TMP_Text roomCodeText;
    public TMP_Text orderText;

    [Tooltip("These are your visual 'Player 1', 'Player 2', etc. positions in the scene.")]
    public Transform[] playerPositions;

    public Button startCountdownButton;
    public Button startGameButton;

   [Header("Player Join Display (Image slots)")]
[Tooltip("Assign in inspector: slot 0=Player 1 image, slot 1=Player 2 image, etc.")]
public Image[] playerJoinImages;

[Header("Character UI Sprites")]
public List<CharacterSprite> characterSprites = new List<CharacterSprite>();
public Sprite defaultCharacterSprite; // "Waiting" / silhouette / question mark


[System.Serializable]
public class CharacterSprite
{
    public string characterName;   // "Daria", "Tony", ...
    public Sprite sprite;          // portrait/icon sprite for UI
}



    [Header("Character Materials")]
    public List<CharacterMaterial> characterMaterials = new List<CharacterMaterial>();
    public Material defaultMaterial;
    public GameObject playerPrefab;
[Header("Main Menu UI")]
[SerializeField] private GameObject mainMenuUI; // parent object that contains Start/Credits/Exit/Settings
[SerializeField] private bool destroyMenuUIOnStart = false; // optional

    [Header("Character UI Colors")]
   // public List<CharacterUIColor> characterUIColors = new List<CharacterUIColor>();

    private List<Player> currentPlayers = new List<Player>();

    // Keyed by player.id (socket id)
    private Dictionary<string, GameObject> playerObjects = new Dictionary<string, GameObject>();

    private string currentRoomCode;

    void Start()
    {
        if (socket == null) Debug.LogError("Socket communicator not set on GameManager");

        if (startCountdownButton != null) startCountdownButton.onClick.AddListener(StartCountdown_ButtonClicked);
        if (startGameButton != null) startGameButton.onClick.AddListener(StartGame_ButtonClicked);

        Invoke(nameof(SendIdentify), 0.5f);

        // -----------------------------
        // Socket Events
        // -----------------------------
        socket.Instance.On("roomCreated", ev =>
        {
            RoomCreatedResponse data = JsonUtility.FromJson<RoomCreatedResponse>(ev.ToString());
            currentRoomCode = data.roomCode;
            if (roomCodeText != null) roomCodeText.text = currentRoomCode;
            Debug.Log($"🏠 Room created: {currentRoomCode}");
        });

        socket.Instance.On("updateRoom", ev =>
        {
            Debug.Log($"📡 Received updateRoom event: {ev}");

            RoomUpdateResponse roomData = JsonUtility.FromJson<RoomUpdateResponse>(ev.ToString());

            // players
            currentPlayers = (roomData.players != null) ? roomData.players.ToList() : new List<Player>();

            // assign chosen character to each player (JsonUtility-friendly)
            if (roomData.characters != null)
            {
                foreach (var a in roomData.characters)
                {
                    var p = currentPlayers.FirstOrDefault(x => x.id == a.playerId);
                    if (p != null) p.character = a.characterName;
                }
            }

            UpdateUI();
            UpdatePlayerJoinDisplay();   // Player 1/2/3... + colored TMP
            UpdatePlayerObjects();       // spawn missing prefabs
            ApplyCharacterMaterials();   // update any existing prefabs
            SnapPlayersToJoinSlots();    // move them to Player 1/2/3 slots immediately
        });

        socket.Instance.On("countdownUpdate", ev =>
        {
            string raw = ev.ToString().Trim('"');
            if (int.TryParse(raw, out int timeLeft))
            {
                if (orderText != null) orderText.text = $"⏳ Time left: {timeLeft}s";
                Debug.Log($"⏰ Countdown update — {timeLeft} seconds remaining");
            }
            else
            {
                Debug.LogWarning("Failed to parse countdownUpdate: " + ev);
            }
        });

        socket.Instance.On("promptDiceRoll", ev =>
        {
            Debug.Log("🎲 Server says: Time to roll dice!");
            if (orderText != null) orderText.text = "🎲 Roll now!";
        });

        socket.Instance.On("startGame", ev =>
        {
            Debug.Log("🎮 startGame received. Show roll UI on clients (web players will handle in browser).");
            if (orderText != null) orderText.text = "🎮 Game started. Waiting for player rolls...";
        });

        socket.Instance.On("diceRolled", ev =>
        {
            RollData d = JsonUtility.FromJson<RollData>(ev.ToString());
            if (orderText != null) orderText.text += $"\n🎲 {d.playerName} rolled: {d.rollValue}";
        });

        socket.Instance.On("playerOrderFinalized", ev =>
        {
            Debug.Log($"🏁 Player order finalized: {ev}");

            string raw = ev.ToString();
            string[] orderNames = JsonHelper.FromJsonArray<string>(raw);

            if (orderText != null) orderText.text += "\n🎯 Player Order:\n";

            for (int i = 0; i < orderNames.Length; i++)
            {
                var player = currentPlayers.FirstOrDefault(p => p.name == orderNames[i]);
                if (orderText != null) orderText.text += $"{i + 1}. {player?.name ?? orderNames[i] ?? "Unknown"}\n";
                Debug.Log($"⭐ {i + 1}. {player?.name ?? orderNames[i] ?? "Unknown"}");
            }

            // Move to finalized turn order positions
            UpdatePlayerPositions(orderNames);
        });

        socket.Instance.On("roomClosed", ev =>
        {
            Debug.LogWarning("Room closed by server: " + ev);
            if (orderText != null) orderText.text = "Room was closed.";
        });
    }

    // -----------------------------
    // Buttons
    // -----------------------------
    void StartCountdown_ButtonClicked()
    {
        if (string.IsNullOrEmpty(currentRoomCode))
        {
            Debug.LogWarning("No room code available for starting countdown");
            return;
        }

        StartCountdown();
        if (startCountdownButton != null) startCountdownButton.interactable = false;
    }

   void StartGame_ButtonClicked()
{
    if (string.IsNullOrEmpty(currentRoomCode))
    {
        Debug.LogWarning("No room code available for starting game");
        return;
    }

    StartGame();
    if (startGameButton != null) startGameButton.interactable = false;

    // Hide/stop intro video (only if it exists)
    if (videoContainer != null) videoContainer.SetActive(false);
    if (videoPlayer != null) videoPlayer.Stop();

    // Hide or destroy the menu UI
    if (mainMenuUI != null)
    {
        if (destroyMenuUIOnStart)
            Destroy(mainMenuUI);     // permanent removal
        else
            mainMenuUI.SetActive(false); // best default
    }
}

     private void OnVideoFinished(VideoPlayer vp)
    {
        Debug.Log("Intro video finished");

        // Hide the video UI
        videoContainer.SetActive(false);

        // Optional: stop & cleanup
        vp.Stop();
        vp.loopPointReached -= OnVideoFinished;
    }

    public void StartCountdown()
    {
        Debug.Log("▶️ StartCountdown pressed — sending startCountdown to server for room " + currentRoomCode);
        socket.Instance.Emit("startCountdown", currentRoomCode);
        if (orderText != null) orderText.text = "⏳ Countdown starting...";
    }

    public void StartGame()
    {
        Debug.Log("▶️ StartGame pressed — sending startGame to server for room " + currentRoomCode);
        socket.Instance.Emit("startGame", currentRoomCode);
        if (orderText != null) orderText.text = "🎮 Starting game...";
    }

    // -----------------------------
    // Identify
    // -----------------------------
    void SendIdentify()
    {
        IdentifyPayload payload = new IdentifyPayload { clientType = "host" };
        string json = JsonUtility.ToJson(payload);
        socket.Instance.Emit("identify", json);
        Debug.Log("HOST → " + json);
    }

    // -----------------------------
    // UI Updates
    // -----------------------------
    void UpdateUI()
    {
        if (orderText == null) return;

        orderText.text = "Players:\n";
        foreach (var p in currentPlayers)
        {
           // orderText.text += $"{p.name} {GetCharacterIconSymbol(p.character)}\n";
        }

        Debug.Log($"👥 Updated player list UI with {currentPlayers.Count} players");
    }
void UpdatePlayerJoinDisplay()
{
    if (playerJoinImages == null) return;

    for (int i = 0; i < playerJoinImages.Length; i++)
    {
        var img = playerJoinImages[i];
        if (img == null) continue;

        if (i < currentPlayers.Count)
        {
            var player = currentPlayers[i];

            // pick sprite from character name
            img.sprite = GetSpriteForCharacter(player.character);

            // show it
            img.enabled = true;

            // optional: keep aspect nice
            img.preserveAspect = true;
        }
        else
        {
            // no player in this slot yet
            img.sprite = defaultCharacterSprite;
            img.enabled = (defaultCharacterSprite != null);
        }
    }
}

Sprite GetSpriteForCharacter(string characterName)
{
    if (string.IsNullOrEmpty(characterName))
        return defaultCharacterSprite;

    var match = characterSprites.FirstOrDefault(cs =>
        string.Equals(cs.characterName, characterName, System.StringComparison.OrdinalIgnoreCase));

    if (match != null && match.sprite != null)
        return match.sprite;

    return defaultCharacterSprite;
}

    // -----------------------------
    // Player Object Spawning + Materials
    // -----------------------------
    void UpdatePlayerObjects()
    {
        if (playerPrefab == null)
        {
            Debug.LogError("playerPrefab is not assigned.");
            return;
        }

        foreach (var player in currentPlayers)
        {
            if (string.IsNullOrEmpty(player.id)) continue;

            if (!playerObjects.ContainsKey(player.id))
            {
                GameObject obj = Instantiate(playerPrefab);
                obj.name = $"Player_{player.name}";
                playerObjects[player.id] = obj;

                ApplyCharacterMaterial(obj, player.character);
            }
        }

        // Optional: cleanup objects for players who left
        var stillHereIds = new HashSet<string>(currentPlayers.Where(p => !string.IsNullOrEmpty(p.id)).Select(p => p.id));
        var toRemove = playerObjects.Keys.Where(id => !stillHereIds.Contains(id)).ToList();
        foreach (var id in toRemove)
        {
            if (playerObjects.TryGetValue(id, out GameObject obj) && obj != null)
                Destroy(obj);

            playerObjects.Remove(id);
        }
    }

    void ApplyCharacterMaterial(GameObject playerObject, string characterName)
    {
        Material matToApply = defaultMaterial;

        if (!string.IsNullOrEmpty(characterName))
        {
            var charMat = characterMaterials.FirstOrDefault(cm =>
                string.Equals(cm.characterName, characterName, System.StringComparison.OrdinalIgnoreCase));

            if (charMat != null && charMat.material != null)
                matToApply = charMat.material;
        }

        // most prefabs have renderers on children
        var renderer = playerObject.GetComponentInChildren<Renderer>();
        if (renderer != null && matToApply != null)
            renderer.material = matToApply;
    }

    void ApplyCharacterMaterials()
    {
        foreach (var p in currentPlayers)
        {
            if (string.IsNullOrEmpty(p.id)) continue;

            if (playerObjects.TryGetValue(p.id, out GameObject obj) && obj != null)
            {
                ApplyCharacterMaterial(obj, p.character);
            }
        }
    }

    // Snap to join order slots (Player 1/2/3...) as people join
    void SnapPlayersToJoinSlots()
    {
        for (int i = 0; i < currentPlayers.Count && i < playerPositions.Length; i++)
        {
            var p = currentPlayers[i];
            if (string.IsNullOrEmpty(p.id)) continue;

            if (playerObjects.TryGetValue(p.id, out GameObject obj) && obj != null)
            {
                obj.transform.position = playerPositions[i].position;
            }
        }
    }

    // Final turn order positions (uses NAMES coming from server)
    void UpdatePlayerPositions(string[] orderNames)
    {
        for (int i = 0; i < orderNames.Length && i < playerPositions.Length; i++)
        {
            string name = orderNames[i];
            var p = currentPlayers.FirstOrDefault(x => x.name == name);

            if (p != null && !string.IsNullOrEmpty(p.id) && playerObjects.TryGetValue(p.id, out GameObject obj) && obj != null)
            {
                obj.transform.position = playerPositions[i].position;
                Debug.Log($" Moved {p.name} to turn order position {i + 1}");
            }
            else
            {
                Debug.LogWarning($" Could not find GameObject for player name '{name}'");
            }
        }
    }

    // -----------------------------
    // Helpers
    // -----------------------------
    // string GetCharacterIconSymbol(string character)
    // {
    //     if (string.IsNullOrEmpty(character)) return "⬜";

    //     switch (character.ToLower())
    //     {
    //         case "logan": return "⭐";
    //         case "daria": return "🎮";
    //         case "tony": return "🍷";
    //         default: return "⬜";
    //     }
    // }
}
