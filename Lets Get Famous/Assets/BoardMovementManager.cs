using System.Collections;
using System.Collections.Generic;
using System.Linq;
using TMPro;
using UnityEngine;
using UnityEngine.Video;
using Firesplash.GameDevAssets.SocketIO;

[System.Serializable]
public class BoardPlayer
{
    public string id;
    public string name;
    public string character;
}

[System.Serializable]
public class BoardCharacterAssignment
{
    public string playerId;
    public string characterName;
}

[System.Serializable]
public class BoardRoomUpdateResponse
{
    public BoardPlayer[] players;
    public BoardCharacterAssignment[] characters;
}

[System.Serializable]
public class CharacterPrefabBinding
{
    public string characterName;
    public GameObject prefab;
}

public class BoardMovementManager : MonoBehaviour
{
    [Header("Socket")]
    [SerializeField] private SocketIOCommunicator socket;

    [Header("Board Path")]
    [SerializeField] private Transform[] boardSpaces;

    [Header("Token Spawning")]
    [SerializeField] private List<CharacterPrefabBinding> characterPrefabs = new();
    [SerializeField] private GameObject fallbackTokenPrefab;
    [SerializeField] private Transform tokenParent;
    [SerializeField] private float tokenYOffset = 0.5f;
    [SerializeField] private Vector3[] spawnOffsets;

    [Header("Movement Settings")]
    [SerializeField] private float moveSpeed = 1f;
    [SerializeField] private float pauseBetweenSteps = 0.1f;
    [SerializeField] private float stopDistance = 0.02f;

    [Header("UI")]
    [SerializeField] private TMP_Text playerListText;
    [SerializeField] private TMP_Text scoreDebugText;
    [SerializeField] private TMP_Text turnText;
    [SerializeField] private TMP_Text winnerText;
    [SerializeField] private TMP_Text leaderboardText;

    [Header("Win Condition")]
    [SerializeField] private int winningScore = 400;

    [Header("End Scene / Win Screen")]
    [SerializeField] private GameObject endSceneContainer;
    [SerializeField] private VideoPlayer endScenePlayer;

    [Header("Disable On Win")]
    [SerializeField] private GameObject[] objectsToDisableOnWin;

    private readonly Dictionary<string, GameObject> spawnedTokens = new();
    private readonly Dictionary<string, int> currentTileByPlayer = new();
    private readonly Dictionary<string, Coroutine> activeMoveByPlayer = new();
    private readonly HashSet<string> joinedPlayers = new();
    private readonly Dictionary<string, int> latestScores = new();
    private readonly Dictionary<string, string> playerCharacterSelections = new();

    private List<BoardPlayer> currentPlayers = new();

    private bool eventsRegistered = false;
    private bool winnerDeclared = false;
    private string currentTurnPlayer = "";

    private void Start()
    {
        RegisterSocketEvents();
        ClearUI();

        if (endSceneContainer != null)
            endSceneContainer.SetActive(false);

        if (endScenePlayer != null)
            endScenePlayer.Stop();
    }

    public void Initialize(SocketIOCommunicator socketRef)
    {
        socket = socketRef;
        RegisterSocketEvents();
    }

    private void ClearUI()
    {
        if (playerListText != null) playerListText.text = "Players\nWaiting...";
        if (scoreDebugText != null) scoreDebugText.text = "Scores\nWaiting...";
        if (turnText != null) turnText.text = "Turn: Waiting...";
        if (winnerText != null) winnerText.text = "";
        if (leaderboardText != null) leaderboardText.text = "Leaderboard\nWaiting...";
    }

    private void RegisterSocketEvents()
    {
        if (eventsRegistered || socket == null || socket.Instance == null) return;
        eventsRegistered = true;

        Debug.Log("[BoardMovementManager] Registering socket events.");

        socket.Instance.On("updateRoom", ev =>
        {
            string raw = ev.ToString();
            Debug.Log("[BoardMovementManager] updateRoom: " + raw);

            BoardRoomUpdateResponse roomData = JsonUtility.FromJson<BoardRoomUpdateResponse>(raw);

            currentPlayers = roomData != null && roomData.players != null
                ? roomData.players.ToList()
                : new List<BoardPlayer>();

            HandleRoomUpdate(roomData);
        });

        socket.Instance.On("scoreUpdate", ev =>
        {
            string raw = ev.ToString();
            Debug.Log("[BoardMovementManager] scoreUpdate: " + raw);
            HandleScoreUpdate(raw);
        });

        socket.Instance.On("turnChanged", ev =>
        {
            string raw = ev.ToString();
            Debug.Log("[BoardMovementManager] turnChanged: " + raw);
            HandleTurnChanged(raw);
        });

        socket.Instance.On("promptDiceRoll", ev =>
        {
            string raw = ev.ToString();
            Debug.Log("[BoardMovementManager] promptDiceRoll: " + raw);
            HandlePromptDiceRoll(raw);
        });
    }

    private void HandleRoomUpdate(BoardRoomUpdateResponse roomData)
    {
        if (roomData == null || roomData.players == null || roomData.players.Length == 0)
        {
            Debug.LogWarning("[BoardMovementManager] No players found in updateRoom.");
            return;
        }

        joinedPlayers.Clear();

        for (int i = 0; i < roomData.players.Length; i++)
        {
            BoardPlayer player = roomData.players[i];
            if (player == null || string.IsNullOrWhiteSpace(player.name))
                continue;

            string playerName = NormalizeName(player.name);
            string selectedCharacter = NormalizeName(player.character);

            if (string.IsNullOrWhiteSpace(selectedCharacter))
                selectedCharacter = playerName;

            joinedPlayers.Add(playerName);

            bool hadOldSelection = playerCharacterSelections.TryGetValue(playerName, out string oldCharacter);
            bool characterChanged = !hadOldSelection || NormalizeName(oldCharacter) != selectedCharacter;

            if (spawnedTokens.TryGetValue(playerName, out GameObject existingToken) && existingToken != null)
            {
                if (characterChanged)
                    ReplacePlayerToken(playerName, selectedCharacter, i);
            }
            else
            {
                SpawnPlayerToken(playerName, selectedCharacter, i);
            }

            playerCharacterSelections[playerName] = selectedCharacter;
        }

        UpdatePlayerListUI(joinedPlayers.ToList());
    }

    private void HandleScoreUpdate(string rawJson)
    {
        Dictionary<string, int> scores = ParseScoreDictionary(rawJson);

        if (scores.Count == 0)
        {
            Debug.LogWarning("[BoardMovementManager] No scores found.");
            return;
        }

        latestScores.Clear();
        foreach (var kvp in scores)
            latestScores[kvp.Key] = kvp.Value;

        UpdateDebugText(scores);
        UpdateLeaderboardUI();

        foreach (var kvp in scores)
        {
            string playerName = NormalizeName(kvp.Key);
            int score = kvp.Value;
            int targetTile = ScoreToTile(score);

            if (!spawnedTokens.ContainsKey(playerName) || spawnedTokens[playerName] == null)
            {
                string selectedCharacter = playerCharacterSelections.ContainsKey(playerName)
                    ? playerCharacterSelections[playerName]
                    : playerName;

                int spawnIndex = GetPlayerOffsetIndex(playerName);
                SpawnPlayerToken(playerName, selectedCharacter, spawnIndex);
            }

            MovePlayerToTile(playerName, targetTile);
        }

        CheckForWinner(scores);
    }

    private void HandleTurnChanged(string rawJson)
    {
        string player = ExtractStringValue(rawJson, "currentPlayer");
        if (!string.IsNullOrWhiteSpace(player))
        {
            currentTurnPlayer = NormalizeName(player);
            UpdateTurnUI();
        }
    }

    private void HandlePromptDiceRoll(string rawJson)
    {
        string player = ExtractStringValue(rawJson, "currentPlayer");
        if (!string.IsNullOrWhiteSpace(player))
        {
            currentTurnPlayer = NormalizeName(player);
            UpdateTurnUI();
        }
    }

    private GameObject GetPrefabForCharacter(string characterName)
    {
        string normalized = NormalizeName(characterName);

        CharacterPrefabBinding match = characterPrefabs.FirstOrDefault(c =>
            NormalizeName(c.characterName) == normalized);

        if (match != null && match.prefab != null)
            return match.prefab;

        return fallbackTokenPrefab;
    }

    private void SpawnPlayerToken(string playerName, string selectedCharacter, int spawnIndex)
    {
        if (boardSpaces == null || boardSpaces.Length == 0)
        {
            Debug.LogError("[BoardMovementManager] No boardSpaces assigned.");
            return;
        }

        GameObject prefabToSpawn = GetPrefabForCharacter(selectedCharacter);
        if (prefabToSpawn == null)
        {
            Debug.LogWarning($"[BoardMovementManager] No prefab found for character {selectedCharacter}");
            return;
        }

        Vector3 startPos = boardSpaces[0].position + Vector3.up * tokenYOffset;
        if (spawnOffsets != null && spawnOffsets.Length > 0)
            startPos += spawnOffsets[spawnIndex % spawnOffsets.Length];

        GameObject token = Instantiate(
            prefabToSpawn,
            startPos,
            prefabToSpawn.transform.rotation,
            tokenParent != null ? tokenParent : transform
        );

        token.name = $"Token_{playerName}";
        spawnedTokens[playerName] = token;

        if (!currentTileByPlayer.ContainsKey(playerName))
            currentTileByPlayer[playerName] = 0;

        Debug.Log($"[BoardMovementManager] Spawned token for {playerName} using {selectedCharacter}");
    }

    private void ReplacePlayerToken(string playerName, string selectedCharacter, int spawnIndex)
    {
        if (!spawnedTokens.TryGetValue(playerName, out GameObject oldToken) || oldToken == null)
        {
            SpawnPlayerToken(playerName, selectedCharacter, spawnIndex);
            return;
        }

        GameObject prefabToSpawn = GetPrefabForCharacter(selectedCharacter);
        if (prefabToSpawn == null)
        {
            Debug.LogWarning($"[BoardMovementManager] No prefab found for character {selectedCharacter}");
            return;
        }

        Vector3 currentPos = oldToken.transform.position;
        int currentTile = currentTileByPlayer.ContainsKey(playerName) ? currentTileByPlayer[playerName] : 0;

        Destroy(oldToken);

        GameObject newToken = Instantiate(
            prefabToSpawn,
            currentPos,
            prefabToSpawn.transform.rotation,
            tokenParent != null ? tokenParent : transform
        );

        newToken.name = $"Token_{playerName}";
        spawnedTokens[playerName] = newToken;
        currentTileByPlayer[playerName] = currentTile;

        Debug.Log($"[BoardMovementManager] Replaced token for {playerName} with {selectedCharacter}");
    }

    private int ScoreToTile(int score)
    {
        if (boardSpaces == null || boardSpaces.Length == 0) return 0;

        int tile = Mathf.FloorToInt(score / 10f);
        return Mathf.Clamp(tile, 0, boardSpaces.Length - 1);
    }

    private void MovePlayerToTile(string playerName, int targetTile)
    {
        if (!spawnedTokens.TryGetValue(playerName, out GameObject tokenObject) || tokenObject == null)
        {
            Debug.LogWarning($"[BoardMovementManager] No spawned token found for {playerName}");
            return;
        }

        Transform token = tokenObject.transform;

        if (!currentTileByPlayer.ContainsKey(playerName))
            currentTileByPlayer[playerName] = 0;

        int currentTile = currentTileByPlayer[playerName];

        if (activeMoveByPlayer.TryGetValue(playerName, out Coroutine oldRoutine) && oldRoutine != null)
        {
            StopCoroutine(oldRoutine);
        }

        activeMoveByPlayer[playerName] = StartCoroutine(
            MoveAlongPath(token, playerName, currentTile, targetTile)
        );
    }

    private IEnumerator MoveAlongPath(Transform token, string playerName, int currentTile, int targetTile)
    {
        if (token == null || boardSpaces == null || boardSpaces.Length == 0)
            yield break;

        if (currentTile == targetTile)
        {
            token.position = GetBoardPosition(targetTile, playerName);
            currentTileByPlayer[playerName] = targetTile;
            yield break;
        }

        int direction = targetTile > currentTile ? 1 : -1;

        for (int i = currentTile + direction; direction > 0 ? i <= targetTile : i >= targetTile; i += direction)
        {
            Vector3 destination = GetBoardPosition(i, playerName);

            while (Vector3.Distance(token.position, destination) > stopDistance)
            {
                token.position = Vector3.MoveTowards(token.position, destination, moveSpeed * Time.deltaTime);
                yield return null;
            }

            token.position = destination;
            currentTileByPlayer[playerName] = i;

            yield return new WaitForSeconds(pauseBetweenSteps);
        }
    }

    private Vector3 GetBoardPosition(int tileIndex, string playerName)
    {
        Vector3 position = boardSpaces[tileIndex].position + Vector3.up * tokenYOffset;

        int offsetIndex = GetPlayerOffsetIndex(playerName);
        if (spawnOffsets != null && spawnOffsets.Length > 0)
            position += spawnOffsets[offsetIndex % spawnOffsets.Length];

        return position;
    }

    private int GetPlayerOffsetIndex(string playerName)
    {
        List<string> orderedPlayers = joinedPlayers.OrderBy(p => p).ToList();
        int index = orderedPlayers.IndexOf(playerName);
        return index < 0 ? 0 : index;
    }

    private void CheckForWinner(Dictionary<string, int> scores)
    {
        if (winnerDeclared) return;

        foreach (var kvp in scores.OrderByDescending(x => x.Value))
        {
            if (kvp.Value >= winningScore)
            {
                winnerDeclared = true;

                string winnerName = kvp.Key;
                int winnerScore = kvp.Value;

                if (winnerText != null)
                    winnerText.text = $"Winner: {winnerName}!";

                Debug.Log($"[BoardMovementManager] Winner is {winnerName} with {winnerScore} points.");

                DisableObjectsOnWin();
                ShowEndScene();
                UpdateLeaderboardUI();

                break;
            }
        }
    }

    private void DisableObjectsOnWin()
    {
        if (objectsToDisableOnWin == null) return;

        foreach (GameObject obj in objectsToDisableOnWin)
        {
            if (obj != null)
                obj.SetActive(false);
        }
    }

    private void ShowEndScene()
    {
        if (endSceneContainer != null)
            endSceneContainer.SetActive(true);

        if (endScenePlayer != null)
        {
            endScenePlayer.Stop();
            endScenePlayer.Play();
        }
    }

    private void UpdatePlayerListUI(List<string> players)
    {
        if (playerListText == null) return;

        playerListText.text = "Players\n";
        foreach (string player in players)
        {
            bool isCurrentTurn = NormalizeName(player) == currentTurnPlayer;
            playerListText.text += isCurrentTurn ? $"> {player}\n" : $"{player}\n";
        }
    }

    private void UpdateTurnUI()
    {
        if (turnText != null)
        {
            turnText.text = string.IsNullOrWhiteSpace(currentTurnPlayer)
                ? "Turn: Waiting..."
                : $"Turn: {currentTurnPlayer}";
        }

        UpdatePlayerListUI(joinedPlayers.ToList());
    }

    private void UpdateDebugText(Dictionary<string, int> scores)
    {
        if (scoreDebugText == null) return;

        scoreDebugText.text = "Scores\n";
        foreach (var kvp in scores.OrderByDescending(x => x.Value))
        {
            scoreDebugText.text += $"{kvp.Key}: {kvp.Value}\n";
        }
    }

    private void UpdateLeaderboardUI()
    {
        if (leaderboardText == null) return;

        leaderboardText.text = "Leaderboard\n";

        if (latestScores.Count == 0)
        {
            leaderboardText.text += "Waiting...";
            return;
        }

        int rank = 1;
        foreach (var kvp in latestScores.OrderByDescending(x => x.Value))
        {
            leaderboardText.text += $"{rank}. {kvp.Key} - {kvp.Value}\n";
            rank++;
        }
    }

    private string NormalizeName(string value)
    {
        return string.IsNullOrWhiteSpace(value) ? "" : value.Trim().ToLower();
    }

    private string ExtractStringValue(string rawJson, string key)
    {
        if (string.IsNullOrWhiteSpace(rawJson))
            return "";

        string[] parts = rawJson.Split('"');

        for (int i = 0; i < parts.Length - 2; i++)
        {
            if (parts[i] == key)
                return parts[i + 2];
        }

        return "";
    }

    private Dictionary<string, int> ParseScoreDictionary(string json)
    {
        var result = new Dictionary<string, int>();

        if (string.IsNullOrWhiteSpace(json))
            return result;

        string trimmed = json.Trim();

        if (trimmed.StartsWith("{")) trimmed = trimmed.Substring(1);
        if (trimmed.EndsWith("}")) trimmed = trimmed.Substring(0, trimmed.Length - 1);

        if (string.IsNullOrWhiteSpace(trimmed))
            return result;

        string[] pairs = trimmed.Split(',');

        foreach (string pair in pairs)
        {
            string[] parts = pair.Split(':');
            if (parts.Length != 2) continue;

            string key = NormalizeName(parts[0].Trim().Trim('"'));
            string valueText = parts[1].Trim();

            if (int.TryParse(valueText, out int value))
            {
                result[key] = value;
            }
        }

        return result;
    }
}