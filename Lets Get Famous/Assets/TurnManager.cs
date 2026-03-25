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
        if (socket == null || socket.Instance == null || eventsRegistered)
            return;

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

        // Temporary visual delay only.
        // Do NOT end the turn here anymore.
        // The server now advances turns after card accept/decline or timeout.
        yield return new WaitForSeconds(fakeTurnDuration);

        turnInProgress = false;
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

    public string GetCurrentRoomCode()
    {
        return currentRoomCode;
    }
}