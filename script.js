const socket = io("https://lets-get-famous-github-io.onrender.com");

let roomCode, playerName, characterStats, roomData;
let myCharacter = null;

let myId = null;
let currentTurnPlayerId = null;

socket.on("connect", () => {
  myId = socket.id;
  socket.emit("identify", { clientType: "web-player" });
});

// -----------------------------
// Join Room
// -----------------------------
function joinRoom() {
  roomCode = document.getElementById("code").value.toUpperCase();
  playerName = document.getElementById("name").value;

  if (!roomCode || !playerName) return alert("Enter room code and name!");
  socket.emit("joinRoom", { roomCode, playerName });
}

// -----------------------------
// Load Game Page
// -----------------------------
socket.on("loadGamePage", (data) => {
  roomCode = data.roomCode;
  playerName = data.playerName;
  roomData = data.roomData;
  characterStats = data.characterStats;

  showCharacterSelection();
});

// -----------------------------
// UI: Character Selection + Lobby
// -----------------------------
function showCharacterSelection() {
  document.body.innerHTML = `
    <div class="container">
      <h1 class="title">Choose Your Character</h1>

      <div id="characters"></div>

      <h3>Players in Room:</h3>
      <div class="inputs">
        <ul id="playerList"></ul>
      </div>

      <div class="inputs">
        <button id="lockBtn" class="pink-btn">Lock In</button>
      </div>

      <div id="statusText" style="margin-top:16px;"></div>

      <div id="rollArea" style="margin-top:20px; display:none;">
        <button id="rollDiceBtn" class="pink-btn">🎲 Roll Dice</button>
      </div>
    </div>
  `;

  updateCharacterButtons();
  updatePlayerList();

  // Lock in character
  document.getElementById("lockBtn").addEventListener("click", () => {
    if (!myCharacter) return alert("Choose a character first!");

    socket.emit("lockCharacter", { roomCode, playerName });

    document.getElementById("characters").style.display = "none";
    document.getElementById("lockBtn").style.display = "none";

    setStatus("Waiting for the host to start...");
  });

  // Roll button (ONLY enabled on your turn via turnChanged)
  const rollBtn = document.getElementById("rollDiceBtn");
  rollBtn.addEventListener("click", () => {
    // safety: don’t allow if not your turn
    const isMyTurn = (myId && currentTurnPlayerId && myId === currentTurnPlayerId);
    if (!isMyTurn) return;

    const rollValue = Math.floor(Math.random() * 6) + 1;

    // Lock immediately so they can’t spam
    rollBtn.disabled = true;
    rollBtn.innerText = `You rolled ${rollValue}! 🎲`;

    // Send roll to server (server forwards to Unity host)
    socket.emit("playerRolled", {
      roomCode,
      playerId: myId,
      playerName,
      rollValue
    });
  });

  // ensure roll area starts hidden
  updateRollUI(false);
}

function setStatus(text) {
  const status = document.getElementById("statusText");
  if (status) status.innerText = text;
}

// -----------------------------
// Character Buttons
// -----------------------------
function updateCharacterButtons() {
  const charactersDiv = document.getElementById("characters");
  if (!charactersDiv) return;

  charactersDiv.innerHTML = "";

  for (const charName in characterStats) {
    const char = characterStats[charName];

    // Your server seems to store "characters" as { charName: playerName } in some places.
    const takenBy = roomData?.characters ? roomData.characters[charName] : null;
    const isTaken = takenBy && takenBy !== playerName;

    const button = document.createElement("button");
    button.classList.add("character-btn");
    button.innerText = `${charName} (${char.profession})`;

    if (isTaken) {
      button.disabled = true;
      button.classList.add("taken");
    } else if (myCharacter === charName) {
      button.classList.add("selected");
    }

    button.addEventListener("click", () => {
      if (myCharacter === charName) return;

      if (myCharacter) {
        socket.emit("releaseCharacter", { roomCode, character: myCharacter });
      }

      socket.emit("chooseCharacter", {
        roomCode,
        playerName,
        character: charName,
        previous: myCharacter
      });

      myCharacter = charName;
      updateCharacterButtons();
    });

    charactersDiv.appendChild(button);
  }
}

// -----------------------------
// Player List
// -----------------------------
function updatePlayerList() {
  const list = document.getElementById("playerList");
  if (!list) return;

  list.innerHTML = "";

  if (!roomData?.players) return;

  roomData.players.forEach((p) => {
    const li = document.createElement("li");
    li.innerText = p.name + (p.character ? ` - ${p.character}` : "");
    list.appendChild(li);
  });
}

// -----------------------------
// Roll UI helpers
// -----------------------------
function updateRollUI(isMyTurn) {
  const rollArea = document.getElementById("rollArea");
  const rollBtn = document.getElementById("rollDiceBtn");

  if (!rollArea || !rollBtn) return;

  rollArea.style.display = "block";         // show area once turns begin
  rollBtn.style.display = isMyTurn ? "block" : "none";
  rollBtn.disabled = !isMyTurn;

  if (isMyTurn) {
    rollBtn.innerText = "🎲 Roll Dice";
    setStatus("✅ Your turn! Roll now!");
  } else {
    setStatus("⏳ Waiting for your turn...");
  }
}

// -----------------------------
// Socket updates (existing)
// -----------------------------
socket.on("updateRoom", (data) => {
  roomData.players = data.players;
  roomData.characters = data.characters;
  updatePlayerList();
  updateCharacterButtons();
});

socket.on("updateCharacterSelection", (characters) => {
  roomData.characters = characters;
  updateCharacterButtons();
});

socket.on("characterTaken", (charName) => alert(`${charName} is already taken!`));

socket.on("roomClosed", (msg) => {
  alert(msg);
  location.reload();
});

// -----------------------------
// Host start button (if you're using this)
// -----------------------------
socket.on("allPlayersReady", () => {
  if (!document.getElementById("startBtn")) {
    const startBtn = document.createElement("button");
    startBtn.id = "startBtn";
    startBtn.innerText = "Start Game 🎮";
    startBtn.style.marginTop = "10px";
    document.body.appendChild(startBtn);

    startBtn.addEventListener("click", () => {
      socket.emit("hostStartGame", { roomCode });
      startBtn.style.display = "none";
    });
  }
});

socket.on("setTurn", (json) => {
  const data = typeof json === "string" ? JSON.parse(json) : json;
  io.to(data.roomCode).emit("turnChanged", { playerId: data.playerId });
});

socket.on("playerRolled", (data) => {
  io.to(data.roomCode).emit("playerRolled", data);
});


// -----------------------------
// Turn Sync (NEW)
// -----------------------------
// Unity/Host (via server) should emit:
// io.to(roomCode).emit("turnChanged", { playerId: "socketid" })
socket.on("turnChanged", ({ playerId }) => {
  currentTurnPlayerId = playerId;

  // If UI isn’t loaded yet, ignore safely
  const isMyTurn = (myId && currentTurnPlayerId && myId === currentTurnPlayerId);

  // Show roll area once turns begin
  updateRollUI(isMyTurn);
});
