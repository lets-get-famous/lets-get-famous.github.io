// -----------------------------
// Board Paths (FOUR LANES - EDIT IN INSPECTOR)
// -----------------------------
[System.Serializable]
public class BoardLane
{
    public Transform[] path; // empty waypoint gameobjects (index = tile number)
}

[Header("Board Paths (By Seat/Lane)")]
[Tooltip("Seat 0 = first in order, Seat 1 = second, etc. Fill each lane's path with your empty waypoint objects in order.")]
public BoardLane player1Lane = new BoardLane();

public BoardLane player2Lane = new BoardLane();

public BoardLane player3Lane = new BoardLane();

public BoardLane player4Lane = new BoardLane();

// ✅ KEEP ONLY THIS GetPathForSeat
private Transform[] GetPathForSeat(int seat)
{
    switch (seat)
    {
        case 0: return player1Lane.path;
        case 1: return player2Lane.path;
        case 2: return player3Lane.path;
        case 3: return player4Lane.path;
        default: return null;
    }
}
