using Firesplash.GameDevAssets.SocketIO;
using UnityEngine;
using UnityEngine.UI;
using System.Collections.Generic;
using System.Linq;
using TMPro;

// Data classes
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
public class RoomUpdateResponse
{
    public Player[] players;
    public Dictionary<string, string> characters;
}

[System.Serializable]
public class RollData
{
    public string playerName;
    public int rollValue;
}

[System.Serializable]
public class RoomCreatedResponse
{
    public string roomCode;
}

// Wrapper for arrays when using JsonUtility
[System.Serializable]
public class StringArrayWrapper
{
    public string[] order;
}

// JsonHelper to parse arrays (generic)
public static class JsonHelper
{
    // Wraps the raw array JSON into an object and uses JsonUtility to parse.
    public static T[] FromJsonArray<T>(string jsonArray)
    {
        // trim possible quotes around the string (sometimes event libraries pass quoted JSON)
        jsonArray = jsonArray?.Trim();
        if (jsonArray == null) return new T[0];

        // If the JSON is itself a quoted string (like "\"[... ]\""), remove surrounding quotes
        if (jsonArray.Length >= 2 && jsonArray[0] == '"' && jsonArray[jsonArray.Length - 1] == '"')
        {
            jsonArray = jsonArray.Substring(1, jsonArray.Length - 2);
            // unescape common escapes
            jsonArray = jsonArray.Replace("\\\"", "\"").Replace("\\\\", "\\");
        }

        string wrapped = "{\"order\":" + jsonArray + "}";
        StringArrayWrapper wrapper = JsonUtility.FromJson<StringArrayWrapper>(wrapped);
        if (wrapper == null || wrapper.order == null) return new T[0];

        // If T is string, we can return directly by casting
        if (typeof(T) == typeof(string))
        {
            object cast = wrapper.order;
            return (T[])cast;
        }

        // If T is not string, we need to convert each element from JSON again
        List<T> list = new List<T>();
        foreach (var itemJson in wrapper.order)
        {
            // itemJson is a string like {"field":...} or a primitive
            try
            {
                T obj = JsonUtility.FromJson<T>(itemJson);
                list.Add(obj);
            }
            catch
            {
                // Could not parse element into T
            }
        }
        return list.ToArray();
    }
}

public class GameManager : MonoBehaviour
{
    public SocketIOCommunicator socket;

    [Header("UI Elements")]
    public TMP_Text roomCodeText;
    public TMP_Text orderText;
    public Transform[] playerPositions;
    public Button startCountdownButton;
    public Button startGameButton;

    [Header("Player Join Display")]
    public TMP_Text[] playerJoinTexts;

    private List<Player> currentPlayers = new List<Player>();
    private string currentRoomCode;

    void Start()
    {
        // small safety
        if (socket == null) Debug.LogError("Socket communicator not set on GameManager");

        // wire UI
        if (startCountdownButton != null) startCountdownButton.onClick.AddListener(StartCountdown_ButtonClicked);
        if (startGameButton != null) startGameButton.onClick.AddListener(StartGame_ButtonClicked);

        // Identify as unity-viewer / host (this will create a room on the server)
        Invoke(nameof(SendIdentify), 0.5f);

        // --- SOCKET EVENTS ---
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

            if (roomData.players != null)
            {
                // merge character info
                if (roomData.characters != null)
                {
                    foreach (var player in roomData.players)
                    {
                        if (roomData.characters.TryGetValue(player.id, out string charName))
                            player.character = charName;
                    }
                }
                currentPlayers = roomData.players.ToList();
            }
            else
            {
                currentPlayers = new List<Player>();
            }

            UpdateUI();
            UpdatePlayerJoinDisplay();
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
            // On Unity viewer we might also show "waiting for rolls"
            if (orderText != null) orderText.text = "🎮 Game started. Waiting for player rolls...";
        });

        socket.Instance.On("diceRolled", ev =>
        {
            // server sends { playerName, rollValue }
            RollData d = JsonUtility.FromJson<RollData>(ev.ToString());
            if (orderText != null) orderText.text += $"\n🎲 {d.playerName} rolled: {d.rollValue}";
        });

        socket.Instance.On("playerOrderFinalized", ev =>
        {
            Debug.Log($"🏁 Player order finalized: {ev}");

            // ev could be a raw array of strings. Use JsonHelper to parse
            string raw = ev.ToString();
            string[] order = JsonHelper.FromJsonArray<string>(raw);

            if (orderText != null) orderText.text += "\n🎯 Player Order:\n";

            for (int i = 0; i < order.Length; i++)
            {
                var player = currentPlayers.FirstOrDefault(p => p.name == order[i]);
                if (orderText != null) orderText.text += $"{i + 1}. {player?.name ?? order[i] ?? "Unknown"}\n";
                Debug.Log($"⭐ {i + 1}. {player?.name ?? order[i] ?? "Unknown"}");
            }

            UpdatePlayerPositions(order);
        });

        socket.Instance.On("roomClosed", ev =>
        {
            Debug.LogWarning("Room closed by server: " + ev);
            if (orderText != null) orderText.text = "Room was closed.";
        });
    }

    // --- UI Button handlers ---

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
    }

    // Called by UI (via OnClick if you prefer)
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

    void SendIdentify()
    {
         IdentifyPayload payload = new IdentifyPayload();
        payload.clientType = "host";

        string json = JsonUtility.ToJson(payload);

        socket.Instance.Emit("identify", json);

        Debug.Log(" HOST → " + json);
    }


    void UpdateUI()
    {
        if (orderText == null) return;

        orderText.text = "Players:\n";
        foreach (var p in currentPlayers)
        {
            orderText.text += $"{p.name} {GetCharacterIconSymbol(p.character)}\n";
        }

        Debug.Log($"👥 Updated player list UI with {currentPlayers.Count} players");
    }

    void UpdatePlayerJoinDisplay()
    {
        if (playerJoinTexts == null) return;

        for (int i = 0; i < playerJoinTexts.Length; i++)
        {
            if (i < currentPlayers.Count)
            {
                var player = currentPlayers[i];
                playerJoinTexts[i].text = $"{i + 1}. {player.name} {GetCharacterIconSymbol(player.character)}";
                Debug.Log($"✅ Player slot {i + 1}: {player.name}");
            }
            else
            {
                playerJoinTexts[i].text = $"Waiting for player {i + 1}...";
                Debug.Log($"⏳ Slot {i + 1} waiting...");
            }
        }
    }

    string GetCharacterIconSymbol(string character)
    {
        if (string.IsNullOrEmpty(character)) return "⬜";
        switch (character.ToLower())
        {
            case "logan": return "⭐";
            case "daria": return "🎮";
            case "tony": return "🍷";
            default: return "⬜";
        }
    }

    void UpdatePlayerPositions(string[] order)
    {
        for (int i = 0; i < order.Length && i < playerPositions.Length; i++)
        {
            var player = currentPlayers.FirstOrDefault(p => p.name == order[i]);
            if (player != null)
            {
                GameObject go = GameObject.Find(player.name);
                if (go != null)
                {
                    go.transform.position = playerPositions[i].position;
                    Debug.Log($"📍 Moved {player.name} to position {i + 1}");
                }
                else
                {
                    Debug.LogWarning($"⚠️ Could not find GameObject for player {player.name}");
                }
            }
        }
    }
}
