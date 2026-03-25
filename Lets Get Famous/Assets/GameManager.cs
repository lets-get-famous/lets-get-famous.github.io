using Firesplash.GameDevAssets.SocketIO;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.Video;
using System.Collections.Generic;
using System.Linq;
using TMPro;

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

public class GameManager : MonoBehaviour
{
    public SocketIOCommunicator socket;

    [Header("Managers")]
    [SerializeField] private TurnManager turnManager;

    [Header("Intro Video (loops forever until Start is pressed)")]
    [SerializeField] private VideoPlayer videoPlayer;
    [SerializeField] private GameObject videoContainer;

    [Header("Screen Video")]
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
    public GameObject playerPrefab;

    [Header("Main Menu UI")]
    [SerializeField] private GameObject mainMenuUI;
    [SerializeField] private bool destroyMenuUIOnStart = false;

    private List<Player> currentPlayers = new();
    private string currentRoomCode;

    void Start()
    {
        if (socket == null)
            Debug.LogError("Socket communicator not set on GameManager");

        if (startCountdownButton != null)
            startCountdownButton.onClick.AddListener(StartCountdown_ButtonClicked);

        if (startGameButton != null)
            startGameButton.onClick.AddListener(StartGame_ButtonClicked);

        if (screenPlayer != null)
            screenPlayer.Stop();

        if (screenContainer != null)
            screenContainer.SetActive(false);

        Invoke(nameof(SendIdentify), 0.5f);

      socket.Instance.On("roomCreated", ev =>
{
    RoomCreatedResponse data = JsonUtility.FromJson<RoomCreatedResponse>(ev.ToString());
    currentRoomCode = data.roomCode;

    if (roomCodeText != null)
        roomCodeText.text = currentRoomCode;

    if (turnManager != null)
        turnManager.Initialize(socket, currentRoomCode, orderText);
});

        socket.Instance.On("updateRoom", ev =>
        {
            RoomUpdateResponse roomData = JsonUtility.FromJson<RoomUpdateResponse>(ev.ToString());

            currentPlayers = roomData.players != null
                ? roomData.players.ToList()
                : new List<Player>();

            UpdatePlayerJoinDisplay();
        });
    }

    void StartCountdown_ButtonClicked()
    {
        if (string.IsNullOrEmpty(currentRoomCode)) return;
        socket.Instance.Emit("startCountdown", currentRoomCode);
    }

    void StartGame_ButtonClicked()
    {
        if (string.IsNullOrEmpty(currentRoomCode)) return;

        socket.Instance.Emit("startGame", currentRoomCode);

        if (videoPlayer != null)
            videoPlayer.Stop();

        if (videoContainer != null)
            videoContainer.SetActive(false);

        if (screenPlayer != null)
            screenPlayer.Play();

        if (screenContainer != null)
            screenContainer.SetActive(true);

        if (mainMenuUI != null)
        {
            if (destroyMenuUIOnStart)
                Destroy(mainMenuUI);
            else
                mainMenuUI.SetActive(false);
        }
    }

    void SendIdentify()
    {
        IdentifyPayload payload = new() { clientType = "host" };
        socket.Instance.Emit("identify", JsonUtility.ToJson(payload));
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
            cs.characterName.Equals(characterName, System.StringComparison.OrdinalIgnoreCase));

        return match != null && match.sprite != null
            ? match.sprite
            : defaultCharacterSprite;
    }
}