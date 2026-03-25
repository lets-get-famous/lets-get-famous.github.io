using System.Collections;
using TMPro;
using UnityEngine;
using Firesplash.GameDevAssets.SocketIO;

[System.Serializable]
public class TurnChangedData
{
    public string activePlayer;
    public int currentTurnIndex;
    public string[] turnOrder;
}

[System.Serializable]
public class ActivePlayerRolledData
{
    public string playerName;
    public int rollValue;
    public int currentTurnIndex;
}

[System.Serializable]
public class EndTurnPayloadusing System.Collections;
using TMPro;
using UnityEngine;
using Firesplash.GameDevAssets.SocketIO;

[System.Serializable]
public class TurnChangedData
{
    public string activePlayer;
    public int currentTurnIndex;
    public string[] turnOrder;
}

[System.Serializable]
public class ActivePlayerRolledData
{
    public string playerName;
    public int rollValue;
    public int currentTurnIndex;
}

[System.Serializable]
public class EndTurnPayload
{
    public string roomCode;
    public string playerName;
}

public class TurnManager : MonoBehaviour
{
    [Header("References")]
    [SerializeField] private SocketIOCommunicator socket;
    [SerializeField] private TMP_Text turnText;

    [Header("Debug / Testing")]
    [SerializeField] private float fakeTurnDuration = 2f;

    private string currentRoomCode = "";
    private string activePlayer = "";
    private bool turnInProgress = false;
    private bool eventsRegistered = false;

    public void Initialize(SocketIOCommunicator socketRef, string roomCode, TMP_Text turnLabel = null)
    {
        socket = socketRef;
        currentRoomCode = roomCode;

        if (turnLabel != null)
            turnText = turnLabel;

        RegisterSocketEvents();
    }

    private void RegisterSocketEvents()
    {
        if (socket == null || socket.Instance == null || eventsRegistered) return;

        eventsRegistered = true;

        socket.Instance.On("turnChanged", ev =>
        {
            TurnChangedData data = JsonUtility.FromJson<TurnChangedData>(ev.ToString());
            HandleTurnChanged(data);
        });

        socket.Instance.On("activePlayerRolled", ev =>
        {
            ActivePlayerRolledData data = JsonUtility.FromJson<ActivePlayerRolledData>(ev.ToString());
            HandleActivePlayerRolled(data);
        });

        socket.Instance.On("startGame", ev =>
        {
            if (turnText != null)
                turnText.text = "Game started!";
        });
    }

    private void HandleTurnChanged(TurnChangedData data)
    {
        activePlayer = data.activePlayer;

        Debug.Log($"[TurnManager] Turn changed to: {activePlayer}");

        if (turnText != null)
            turnText.text = $"Turn: {activePlayer}";
    }

    private void HandleActivePlayerRolled(ActivePlayerRolledData data)
    {
        if (turnInProgress)
        {
            Debug.LogWarning("[TurnManager] Turn already in progress.");
            return;
        }

        Debug.Log($"[TurnManager] {data.playerName} rolled {data.rollValue}");
        StartCoroutine(ResolveTurn(data));
    }

    private IEnumerator ResolveTurn(ActivePlayerRolledData data)
    {
        turnInProgress = true;

        if (turnText != null)
            turnText.text = $"{data.playerName} rolled {data.rollValue}!";

        // Placeholder until movement is added
        yield return new WaitForSeconds(fakeTurnDuration);

        EndTurn(data.playerName);
        turnInProgress = false;
    }

    private void EndTurn(string playerName)
    {
        if (socket == null || socket.Instance == null)
        {
            Debug.LogError("[TurnManager] Socket missing.");
            return;
        }

        EndTurnPayload payload = new EndTurnPayload
        {
            roomCode = currentRoomCode,
            playerName = playerName
        };

        socket.Instance.Emit("endTurn", JsonUtility.ToJson(payload));
        Debug.Log($"[TurnManager] Sent endTurn for {playerName}");
    }
}
{
    public string roomCode;
    public string playerName;
}

public class TurnManager : MonoBehaviour
{
    [Header("References")]
    [SerializeField] private SocketIOCommunicator socket;
    [SerializeField] private TMP_Text turnText;

    [Header("Debug / Testing")]
    [SerializeField] private float fakeTurnDuration = 2f;

    private string currentRoomCode = "";
    private string activePlayer = "";
    private bool turnInProgress = false;

    public void Initialize(SocketIOCommunicator socketRef, string roomCode, TMP_Text turnLabel = null)
    {
        socket = socketRef;
        currentRoomCode = roomCode;

        if (turnLabel != null)
            turnText = turnLabel;

        RegisterSocketEvents();
    }

    private bool eventsRegistered = false;

    private void RegisterSocketEvents()
    {
        if (socket == null || socket.Instance == null || eventsRegistered) return;

        eventsRegistered = true;

        socket.Instance.On("turnChanged", ev =>
        {
            TurnChangedData data = JsonUtility.FromJson<TurnChangedData>(ev.ToString());
            HandleTurnChanged(data);
        });

        socket.Instance.On("activePlayerRolled", ev =>
        {
            ActivePlayerRolledData data = JsonUtility.FromJson<ActivePlayerRolledData>(ev.ToString());
            HandleActivePlayerRolled(data);
        });
    }

    private void HandleTurnChanged(TurnChangedData data)
    {
        activePlayer = data.activePlayer;

        Debug.Log($"[TurnManager] Turn changed to: {activePlayer}");

        if (turnText != null)
            turnText.text = $"Turn: {activePlayer}";
    }

    private void HandleActivePlayerRolled(ActivePlayerRolledData data)
    {
        if (turnInProgress)
        {
            Debug.LogWarning("[TurnManager] Turn already in progress, ignoring duplicate roll.");
            return;
        }

        Debug.Log($"[TurnManager] {data.playerName} rolled {data.rollValue}");
        StartCoroutine(ResolveTurn(data));
    }

    private IEnumerator ResolveTurn(ActivePlayerRolledData data)
    {
        turnInProgress = true;

        if (turnText != null)
            turnText.text = $"{data.playerName} rolled {data.rollValue}!";

        // Placeholder for now
        yield return new WaitForSeconds(fakeTurnDuration);

        EndTurn(data.playerName);
        turnInProgress = false;
    }

    private void EndTurn(string playerName)
    {
        if (socket == null || socket.Instance == null)
        {
            Debug.LogError("[TurnManager] Cannot end turn: socket missing.");
            return;
        }

        EndTurnPayload payload = new EndTurnPayload
        {
            roomCode = currentRoomCode,
            playerName = playerName
        };

        string json = JsonUtility.ToJson(payload);
        socket.Instance.Emit("endTurn", json);

        Debug.Log($"[TurnManager] Sent endTurn for {playerName}");
    }

    public void SetRoomCode(string roomCode)
    {
        currentRoomCode = roomCode;
    }

    public string GetActivePlayer()
    {
        return activePlayer;
    }

    public bool IsTurnInProgress()
    {
        return turnInProgress;
    }
}