using Firesplash.GameDevAssets.SocketIO;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.Video;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using TMPro;

// -----------------------------
// Data classes
// -----------------------------
[System.Serializable]
public class Player
{
    public string id;
    public string name;
    public string character;
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

[System.Serializable]
public class CharacterAssignment
{
    public string playerId;
    public string characterName;
}

[System.Serializable]
public class RoomUpdateResponse
{
    public Player[] players;
    public CharacterAssignment[] characters;
}

// IMPORTANT: Roll now uses playerId so turns are reliable
[System.Serializable]
public class RollData
{
    public string roomCode;
    // public string playerId;     // socket.id of the roller (from web)
    public string playerName;   // display only
    public int rollValue;

    // NOTE: your handler uses d.playerId, so make sure this is actually present
    // in your real RollData definition OR is being added back in from server JSON.
    public string playerId; // ✅ add this back if you expect it from server
}

// Unity -> server payload to announce whose turn it is
[System.Serializable]
public class TurnPayload
{
    public string roomCode;
    public string playerId;
}

[System.Serializable]
public class CharacterMaterial
{
    public string characterName;
    public Material material;
}

// -----------------------------
// GameManager
// -----------------------------
public class GameManager : MonoBehaviour
{
    public SocketIOCommunicator socket;

    [Header("Intro Video (loops until Start is pressed)")]
    [SerializeField] private VideoPlayer videoPlayer;
    [SerializeField] private GameObject videoContainer;

    [Header("Screen Video (plays after Start is pressed)")]
    [SerializeField] private VideoPlayer screenPlayer;
    [SerializeField] private GameObject screenContainer;

    [Header("UI Elements")]
    public TMP_Text roomCodeText;
    public TMP_Text orderText;

    public Button startCountdownButton;
    public Button startGameButton;

    [Header("Player Join Display (Image slots)")]
    public Image[] playerJoinImages;

    [Header("Character UI Sprites")]
    public List<CharacterSprite> characterSprites = new();
    public Sprite defaultCharacterSprite;

    [System.Serializable]
    public class CharacterSprite
    {
        public string characterName;
        public Sprite sprite;
    }

    [Header("Character Materials")]
    public List<CharacterMaterial> characterMaterials = new();
    public Material defaultMaterial;

    [Header("Player Token Prefab")]
    public GameObject playerPrefab;

    [Header("Main Menu UI")]
    [SerializeField] private GameObject mainMenuUI;
    [SerializeField] private bool destroyMenuUIOnStart = false;

    [Header("Board Start Spots (tokens begin here when Start is pressed)")]
    public Transform[] boardStartSpots;

    [Header("Board Path (movement nodes in order)")]
    public Transform[] pathNodes;

    [Header("Turn System")]
    [SerializeField] private bool enableTurnSystem = true;
    [SerializeField] private float stepDelay = 0.25f;

    private List<Player> currentPlayers = new();
    private Dictionary<string, GameObject> playerObjects = new();     // playerId -> token obj
    private Dictionary<string, int> tokenIndexByPlayerId = new();     // playerId -> path index

    private string currentRoomCode;

    private bool gameStarted = false;
    private int currentTurnIndex = 0; // index into currentPlayers list

    void Start()
    {
        if (socket == null)
            Debug.LogError("Socket communicator not set on GameManager");

        if (startCountdownButton != null)
            startCountdownButton.onClick.AddListener(StartCountdown_ButtonClicked);

        if (startGameButton != null)
            startGameButton.onClick.AddListener(StartGame_ButtonClicked);

        // Screen video starts hidden/off
        if (screenPlayer != null) screenPlayer.Stop();
        if (screenContainer != null) screenContainer.SetActive(false);

        Invoke(nameof(SendIdentify), 0.5f);

        // -----------------------------
        // Socket Events
        // -----------------------------
        socket.Instance.On("roomCreated", ev =>
        {
            RoomCreatedResponse data = JsonUtility.FromJson<RoomCreatedResponse>(ev.ToString());
            currentRoomCode = data.roomCode;
            if (roomCodeText != null) roomCodeText.text = currentRoomCode;
        });

        socket.Instance.On("updateRoom", ev =>
        {
            RoomUpdateResponse roomData = JsonUtility.FromJson<RoomUpdateResponse>(ev.ToString());

            currentPlayers = roomData.players != null ? roomData.players.ToList() : new List<Player>();

            if (roomData.characters != null)
            {
                foreach (var a in roomData.characters)
                {
                    var p = currentPlayers.FirstOrDefault(x => x.id == a.playerId);
                    if (p != null) p.character = a.characterName;
                }
            }

            UpdatePlayerJoinDisplay();

            // keep tokens/materials synced if game already started
            if (gameStarted)
            {
                UpdatePlayerObjects();
                ApplyCharacterMaterialsToAll();
                UpdateTurnIndicators();
                BroadcastTurnToWeb();
            }
        });

        // ✅ Listen for roll event coming from web/server
        // Web emits: playerRolled { roomCode, playerId, playerName, rollValue }
        socket.Instance.On("playerRolled", ev =>
        {
            if (!enableTurnSystem || !gameStarted) return;

            RollData d = JsonUtility.FromJson<RollData>(ev.ToString());

            // optional room check
            if (!string.IsNullOrEmpty(d.roomCode) && d.roomCode != currentRoomCode) return;

            HandlePlayerRolled(d);
        });
    }

    // -----------------------------
    // Buttons
    // -----------------------------
    void StartCountdown_ButtonClicked()
    {
        if (string.IsNullOrEmpty(currentRoomCode)) return;
        socket.Instance.Emit("startCountdown", currentRoomCode);
    }

    void StartGame_ButtonClicked()
    {
        if (string.IsNullOrEmpty(currentRoomCode)) return;

        socket.Instance.Emit("startGame", currentRoomCode);

        // Stop and hide looping intro video
        if (videoPlayer != null) videoPlayer.Stop();
        if (videoContainer != null) videoContainer.SetActive(false);

        // Show and play the screen video (after Start)
        if (screenContainer != null) screenContainer.SetActive(true);
        if (screenPlayer != null)
        {
            screenPlayer.Stop();
            screenPlayer.Play();
        }

        // Hide/destroy menu UI
        if (mainMenuUI != null)
        {
            if (destroyMenuUIOnStart) Destroy(mainMenuUI);
            else mainMenuUI.SetActive(false);
        }

        // Spawn tokens + snap to start spots
        UpdatePlayerObjects();
        SnapPlayersToBoardStarts();
        //ResetAllTokenIndices();

        // Start turn system
        gameStarted = true;
        currentTurnIndex = 0;

        UpdateTurnIndicators();
        AnnounceTurn();
        BroadcastTurnToWeb(); // ✅ let phones know who can roll
    }

    // -----------------------------
    // Identify
    // -----------------------------
    void SendIdentify()
    {
        IdentifyPayload payload = new() { clientType = "host" };
        socket.Instance.Emit("identify", JsonUtility.ToJson(payload));
    }

    // -----------------------------
    // UI
    // -----------------------------
    void UpdatePlayerJoinDisplay()
    {
        if (playerJoinImages == null) return;

        for (int i = 0; i < playerJoinImages.Length; i++)
        {
            var img = playerJoinImages[i];
            if (img == null) continue;

            if (i < currentPlayers.Count)
            {
                img.sprite = GetSpriteForCharacter(currentPlayers[i].character);
                img.enabled = true;
                img.preserveAspect = true;
            }
            else
            {
                img.sprite = defaultCharacterSprite;
                img.enabled = defaultCharacterSprite != null;
            }
        }
    }

    Sprite GetSpriteForCharacter(string characterName)
    {
        if (string.IsNullOrEmpty(characterName))
            return defaultCharacterSprite;

        var match = characterSprites.FirstOrDefault(cs =>
            string.Equals(cs.characterName, characterName, System.StringComparison.OrdinalIgnoreCase));

        return (match != null && match.sprite != null) ? match.sprite : defaultCharacterSprite;
    }

    // -----------------------------
    // Tokens: Spawn + Material
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

                // default: indicator off until we set active player
                var indicator = obj.GetComponent<TurnIndicator>();
                indicator?.SetActive(false);
            }
        }

        // ------------------------------------------------------------
        // 🚫 TOKEN DELETION / CLEANUP DISABLED (commented out)
        // This is the block that DESTROYS token objects when a player leaves.
        // ------------------------------------------------------------
        /*
        // cleanup players who left
        var stillHereIds = new HashSet<string>(currentPlayers.Where(p => !string.IsNullOrEmpty(p.id)).Select(p => p.id));
        var toRemove = playerObjects.Keys.Where(id => !stillHereIds.Contains(id)).ToList();

        foreach (var id in toRemove)
        {
            if (playerObjects.TryGetValue(id, out GameObject obj) && obj != null)
                Destroy(obj);

            playerObjects.Remove(id);
            tokenIndexByPlayerId.Remove(id);
        }
        */
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

        var renderer = playerObject.GetComponentInChildren<Renderer>();
        if (renderer != null && matToApply != null)
            renderer.material = matToApply;
    }

    void ApplyCharacterMaterialsToAll()
    {
        foreach (var p in currentPlayers)
        {
            if (string.IsNullOrEmpty(p.id)) continue;
            if (playerObjects.TryGetValue(p.id, out GameObject obj) && obj != null)
                ApplyCharacterMaterial(obj, p.character);
        }
    }

    // -----------------------------
    // Board snapping
    // -----------------------------
    private void SnapPlayersToBoardStarts()
    {
        if (boardStartSpots == null || boardStartSpots.Length == 0) return;

        for (int i = 0; i < currentPlayers.Count && i < boardStartSpots.Length; i++)
        {
            var p = currentPlayers[i];
            if (string.IsNullOrEmpty(p.id)) continue;

            if (playerObjects.TryGetValue(p.id, out GameObject obj) && obj != null && boardStartSpots[i] != null)
            {
                obj.transform.position = boardStartSpots[i].position;
                obj.transform.rotation = boardStartSpots[i].rotation;
                obj.SetActive(true);
            }
        }
    }

    // -----------------------------
    // Turn Indicator + Turn Logic
    // -----------------------------
    private void UpdateTurnIndicators()
    {
        if (!enableTurnSystem) return;
        if (currentPlayers == null || currentPlayers.Count == 0) return;

        currentTurnIndex = Mathf.Clamp(currentTurnIndex, 0, currentPlayers.Count - 1);
        string activePlayerId = currentPlayers[currentTurnIndex].id;

        foreach (var kvp in playerObjects)
        {
            var tokenObj = kvp.Value;
            if (tokenObj == null) continue;

            bool isActive = (kvp.Key == activePlayerId);

            var indicator = tokenObj.GetComponent<TurnIndicator>();
            indicator?.SetActive(isActive);
        }
    }

    private void AnnounceTurn()
    {
        if (!enableTurnSystem) return;
        if (currentPlayers == null || currentPlayers.Count == 0) return;

        var p = currentPlayers[currentTurnIndex];
        if (orderText != null)
            orderText.text = $"🟢 {p.name}'s turn! Roll now.";
    }

    private void NextTurn()
    {
        if (currentPlayers == null || currentPlayers.Count == 0) return;

        currentTurnIndex++;
        if (currentTurnIndex >= currentPlayers.Count) currentTurnIndex = 0;

        UpdateTurnIndicators();
        AnnounceTurn();
        BroadcastTurnToWeb(); // ✅ update phones
    }

    // ✅ This is the ONLY roll handler we use now (from phones)
    private void HandlePlayerRolled(RollData d)
    {
        if (currentPlayers == null || currentPlayers.Count == 0) return;

        // validate it's the correct playerId's turn
        var expected = currentPlayers[currentTurnIndex];
        if (expected == null || string.IsNullOrEmpty(expected.id))
            return;

        if (d.playerId != expected.id)
        {
            Debug.LogWarning($"⛔ Ignoring roll from {d.playerName} ({d.playerId}). It's {expected.name}'s turn.");
            return;
        }

        Debug.Log($"✅ Accepted roll {d.rollValue} from {d.playerName}");

        StartCoroutine(MoveTokenSteps(expected.id, d.rollValue));
    }

    private IEnumerator MoveTokenSteps(string playerId, int steps)
    {
        if (!playerObjects.TryGetValue(playerId, out GameObject token) || token == null)
            yield break;

        if (pathNodes == null || pathNodes.Length == 0)
        {
            Debug.LogWarning("pathNodes not assigned. Can't move.");
            NextTurn();
            yield break;
        }

        if (!tokenIndexByPlayerId.TryGetValue(playerId, out int currentIndex))
            currentIndex = 0;

        int safeSteps = Mathf.Max(0, steps);
        int targetIndex = Mathf.Clamp(currentIndex + safeSteps, 0, pathNodes.Length - 1);

        for (int i = currentIndex + 1; i <= targetIndex; i++)
        {
            if (pathNodes[i] != null)
                token.transform.position = pathNodes[i].position;

            yield return new WaitForSeconds(stepDelay);
        }

        tokenIndexByPlayerId[playerId] = targetIndex;

        NextTurn();
    }

    // -----------------------------
    // Turn sync to web (Unity -> Node -> web)
    // -----------------------------
    private void BroadcastTurnToWeb()
    {
        if (!enableTurnSystem || !gameStarted) return;
        if (string.IsNullOrEmpty(currentRoomCode)) return;
        if (currentPlayers == null || currentPlayers.Count == 0) return;

        var p = currentPlayers[currentTurnIndex];
        if (p == null || string.IsNullOrEmpty(p.id)) return;

        TurnPayload payload = new TurnPayload
        {
            roomCode = currentRoomCode,
            playerId = p.id
        };

        // Node should handle "setTurn" and broadcast "turnChanged"
        socket.Instance.Emit("setTurn", JsonUtility.ToJson(payload));
    }
}
