using System.Collections;
using System.Collections.Generic;
using System.Linq;
using TMPro;
using UnityEngine;
using Firesplash.GameDevAssets.SocketIO;

[System.Serializable]
public class TokenBinding
{
    public string playerName;
    public Transform token;
}

public class BoardMovementManager : MonoBehaviour
{
    [Header("Socket")]
    [SerializeField] private SocketIOCommunicator socket;

    [Header("Board Path")]
    [SerializeField] private Transform[] boardSpaces;

    [Header("Player Tokens")]
    [SerializeField] private List<TokenBinding> tokens = new();

    [Header("Movement Settings")]
    [SerializeField] private float moveSpeed = 4f;
    [SerializeField] private float pauseBetweenSteps = 0.1f;
    [SerializeField] private float stopDistance = 0.02f;

    [Header("Optional Debug UI")]
    [SerializeField] private TMP_Text scoreDebugText;

    private readonly Dictionary<string, int> currentTileByPlayer = new();
    private readonly Dictionary<string, Coroutine> activeMoveByPlayer = new();
    private bool eventsRegistered = false;

    public void Initialize(SocketIOCommunicator socketRef)
    {
        socket = socketRef;
        RegisterSocketEvents();
    }

    private void RegisterSocketEvents()
    {
        if (eventsRegistered || socket == null || socket.Instance == null) return;
        eventsRegistered = true;

        socket.Instance.On("scoreUpdate", ev =>
        {
            string raw = ev.ToString();
            HandleScoreUpdate(raw);
        });
    }

    private void HandleScoreUpdate(string rawJson)
    {
        Dictionary<string, int> scores = ParseScoreDictionary(rawJson);

        if (scores.Count == 0)
        {
            Debug.LogWarning("[BoardMovementManager] No scores found.");
            return;
        }

        UpdateDebugText(scores);

        foreach (var kvp in scores)
        {
            string playerName = kvp.Key;
            int score = kvp.Value;
            int targetTile = ScoreToTile(score);

            MovePlayerToTile(playerName, targetTile);
        }
    }

    private int ScoreToTile(int score)
    {
        if (boardSpaces == null || boardSpaces.Length == 0) return 0;

        int tile = Mathf.FloorToInt(score / 10f);
        return Mathf.Clamp(tile, 0, boardSpaces.Length - 1);
    }

    private void MovePlayerToTile(string playerName, int targetTile)
    {
        TokenBinding binding = tokens.FirstOrDefault(t => t.playerName == playerName);

        if (binding == null || binding.token == null)
        {
            Debug.LogWarning($"[BoardMovementManager] No token found for {playerName}");
            return;
        }

        if (!currentTileByPlayer.ContainsKey(playerName))
            currentTileByPlayer[playerName] = 0;

        int currentTile = currentTileByPlayer[playerName];

        if (activeMoveByPlayer.TryGetValue(playerName, out Coroutine oldRoutine) && oldRoutine != null)
        {
            StopCoroutine(oldRoutine);
        }

        activeMoveByPlayer[playerName] = StartCoroutine(MoveAlongPath(binding.token, playerName, currentTile, targetTile));
    }

    private IEnumerator MoveAlongPath(Transform token, string playerName, int currentTile, int targetTile)
    {
        if (token == null || boardSpaces == null || boardSpaces.Length == 0)
            yield break;

        if (currentTile == targetTile)
        {
            token.position = boardSpaces[targetTile].position;
            currentTileByPlayer[playerName] = targetTile;
            yield break;
        }

        int direction = targetTile > currentTile ? 1 : -1;

        for (int i = currentTile + direction; direction > 0 ? i <= targetTile : i >= targetTile; i += direction)
        {
            Vector3 destination = boardSpaces[i].position;

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

    public void SnapAllToStart()
    {
        foreach (var binding in tokens)
        {
            if (binding == null || binding.token == null || boardSpaces == null || boardSpaces.Length == 0)
                continue;

            binding.token.position = boardSpaces[0].position;
            currentTileByPlayer[binding.playerName] = 0;
        }
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

            string key = parts[0].Trim().Trim('"');
            string valueText = parts[1].Trim();

            if (int.TryParse(valueText, out int value))
            {
                result[key] = value;
            }
        }

        return result;
    }
}