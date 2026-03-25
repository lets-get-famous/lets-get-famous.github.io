const socket = io("https://lets-get-famous-github-io.onrender.com");

let roomCode = "";
let playerName = "";
let characterStats = {};
let roomData = { players: [], characters: {} };
let myCharacter = null;

let activePlayer = null;
let hasRolledThisTurn = false;

// --------------------
// Connect
// --------------------
socket.on("connect", () => {
  console.log("Connected:", socket.id);
  socket.emit("identify", { clientType: "web-player" });
});

// --------------------
// Join room
// --------------------
document.addEventListener("DOMContentLoaded", () => {
  const joinBtn = document.getElementById("join-btn");
  if (joinBtn) {
    joinBtn.addEventListener("click", joinRoom);
  }
});

function joinRoom() {
  const codeInput = document.getElementById("code");
  const nameInput = document.getElementById("name");

  roomCode = codeInput.value.trim().toUpperCase();
  playerName = nameInput.value.trim();

  if (!roomCode || !playerName) {
    alert("Enter room code and name!");
    return;
  }

  socket.emit("joinRoom", { roomCode, playerName });
}

// --------------------
// Load game page after join
// --------------------
socket.on("loadGamePage", (data) => {
  roomCode = data.roomCode;
  playerName = data.playerName;
  roomData = data.roomData || { players: [], characters: {} };
  characterStats = data.characterStats || {};
  showCharacterSelection();
});

// --------------------
// Build player UI
// --------------------
function showCharacterSelection() {
  const app = document.getElementById("app");

  app.innerHTML = `
    <h1 class="title">Choose Your Character</h1>

    <div id="statusArea">
      <p id="roomText"><strong>Room:</strong> ${roomCode}</p>
      <p id="turnText">Waiting for the host to start...</p>
      <p id="countdownText"></p>
    </div>

    <div id="characters"></div>

    <h3 class="section-heading">Players in Room:</h3>
    <div class="inputs">
      <ul id="playerList"></ul>
    </div>

    <div class="inputs">
      <button id="lockBtn" class="pink-btn">Lock In</button>
    </div>

    <div id="waitingArea"></div>

    <div id="rollContainer" style="display:none;">
      <button id="rollBtn" class="pink-btn" disabled>🎲 Roll Dice</button>
    </div>
  `;

  updateCharacterButtons();
  updatePlayerList();
  setupUIEvents();
}

function setupUIEvents() {
  const lockBtn = document.getElementById("lockBtn");
  const rollBtn = document.getElementById("rollBtn");

  if (lockBtn) {
    lockBtn.addEventListener("click", () => {
      if (!myCharacter) {
        alert("Choose a character first!");
        return;
      }

      socket.emit("lockCharacter", { roomCode, playerName });

      const characters = document.getElementById("characters");
      if (characters) characters.style.display = "none";
      lockBtn.style.display = "none";

      const waitingArea = document.getElementById("waitingArea");
      waitingArea.innerHTML = `<p id="waitingText">You’re locked in! Waiting for the host to start...</p>`;
    });
  }

  if (rollBtn) {
    rollBtn.addEventListener("click", () => {
      if (playerName !== activePlayer) {
        alert(`It is not your turn. Waiting for ${activePlayer}.`);
        return;
      }

      if (hasRolledThisTurn) return;

      const rollValue = Math.floor(Math.random() * 6) + 1;
      hasRolledThisTurn = true;

      rollBtn.disabled = true;
      rollBtn.textContent = `You rolled ${rollValue}! 🎲`;

      socket.emit("playerRolled", { roomCode, playerName, rollValue });
    });
  }
}

// --------------------
// Character buttons
// --------------------
function updateCharacterButtons() {
  const charactersDiv = document.getElementById("characters");
  if (!charactersDiv) return;

  charactersDiv.innerHTML = "";

  for (const charName in characterStats) {
    const char = characterStats[charName];
    const takenBy = roomData.characters ? roomData.characters[charName] : null;
    const isTaken = takenBy && takenBy !== playerName;

    const button = document.createElement("button");
    button.classList.add("character-btn");
    button.textContent = `${charName} (${char.profession})`;

    if (isTaken) {
      button.disabled = true;
      button.classList.add("taken");
    } else if (myCharacter === charName) {
      button.classList.add("selected");
    }

    button.addEventListener("click", () => {
      if (myCharacter === charName) return;

      if (myCharacter) {
        socket.emit("releaseCharacter", {
          roomCode,
          character: myCharacter
        });
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

// --------------------
// Player list
// --------------------
function updatePlayerList() {
  const list = document.getElementById("playerList");
  if (!list) return;

  list.innerHTML = "";

  (roomData.players || []).forEach((p) => {
    const li = document.createElement("li");
    li.textContent = p.name + (p.character ? ` - ${p.character}` : "");
    list.appendChild(li);
  });
}

// --------------------
// Turn UI
// --------------------
function updateTurnUI() {
  const turnText = document.getElementById("turnText");
  const rollContainer = document.getElementById("rollContainer");
  const rollBtn = document.getElementById("rollBtn");

  if (!turnText || !rollContainer || !rollBtn) return;

  if (!activePlayer) {
    turnText.textContent = "Waiting for turn info...";
    rollContainer.style.display = "none";
    return;
  }

  if (playerName === activePlayer) {
    turnText.textContent = "It is your turn!";
    rollContainer.style.display = "block";
    rollBtn.disabled = false;
    rollBtn.textContent = "🎲 Roll Dice";
  } else {
    turnText.textContent = `Waiting for ${activePlayer}...`;
    rollContainer.style.display = "none";
  }
}

// --------------------
// Room updates
// --------------------
socket.on("updateRoom", (data) => {
  roomData.players = data.players || [];
  roomData.characters = data.characters || {};
  updatePlayerList();
  updateCharacterButtons();
});

socket.on("updateCharacterSelection", (characters) => {
  roomData.characters = characters || {};
  updateCharacterButtons();
});

socket.on("characterTaken", (charName) => {
  alert(`${charName} is already taken!`);
});

socket.on("joinFailed", (msg) => {
  alert(msg);
});

socket.on("roomClosed", (msg) => {
  alert(msg);
  location.reload();
});

// --------------------
// Game flow
// --------------------
socket.on("startGame", () => {
  const turnText = document.getElementById("turnText");
  if (turnText) {
    turnText.textContent = "Game started! Waiting for turn order...";
  }
});

socket.on("countdownUpdate", (countdown) => {
  const countdownText = document.getElementById("countdownText");
  if (!countdownText) return;

  if (countdown === null || countdown === undefined) {
    countdownText.textContent = "";
  } else {
    countdownText.textContent = `Game starting in ${countdown}...`;
  }
});

socket.on("promptDiceRoll", () => {
  console.log("Received promptDiceRoll");
  hasRolledThisTurn = false;

  const countdownText = document.getElementById("countdownText");
  if (countdownText) {
    countdownText.textContent = "Rolls are being collected...";
  }
});

socket.on("diceRolled", ({ playerName: rolledBy, rollValue }) => {
  console.log(`${rolledBy} rolled ${rollValue}`);
});

socket.on("playerOrderFinalized", (orderedNames) => {
  console.log("Turn order:", orderedNames);

  const countdownText = document.getElementById("countdownText");
  if (countdownText) {
    countdownText.textContent = `Turn order: ${orderedNames.join(" → ")}`;
  }
});

socket.on("turnChanged", (data) => {
  activePlayer = data.activePlayer;
  hasRolledThisTurn = false;
  updateTurnUI();
});

socket.on("notYourTurn", ({ activePlayer }) => {
  alert(`It is not your turn. Waiting for ${activePlayer}.`);
});

// Optional: if you want to test ending turns from web before Unity handles it
socket.on("activePlayerRolled", ({ playerName: rolledBy }) => {
  if (rolledBy === playerName) {
    console.log("Your roll was accepted by the server.");
    // For testing only, uncomment this if you want the browser to end the turn:
    // setTimeout(() => {
    //   socket.emit("endTurn", { roomCode, playerName });
    // }, 1500);
  }
});