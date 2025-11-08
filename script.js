const socket = io("https://lets-get-famous-github-io.onrender.com");

let roomCode, playerName, characterStats, roomData;
let myCharacter = null; // currently selected character

// --- Connect and identify ---
socket.on("connect", () => {
  socket.emit("identify", { clientType: "web-player" });
});

// --- Join Room ---
function joinRoom() {
  roomCode = document.getElementById("code").value.toUpperCase();
  playerName = document.getElementById("name").value;
  if (!roomCode || !playerName) return alert("Enter room code and name!");
  socket.emit("joinRoom", { roomCode, playerName });
}

// --- Load Game Page & Character Selection ---
socket.on("loadGamePage", (data) => {
  roomCode = data.roomCode;
  playerName = data.playerName;
  roomData = data.roomData;
  characterStats = data.characterStats;
  showCharacterSelection();
});

function showCharacterSelection() {
  document.body.innerHTML = `
    <h2>Choose Your Character</h2>
    <div id="characters"></div>
    <h3>Players in room:</h3>
    <ul id="playerList"></ul>
    <div id="rollContainer" style="display:none; margin-top: 20px;">
      <button id="rollBtn" style="font-size: 24px; padding: 12px 24px; border-radius: 12px; background-color: gold; color: black; border: none; cursor: pointer; box-shadow: 0 0 10px rgba(255, 215, 0, 0.6);">
        🎲 Roll Dice
      </button>
    </div>
  `;
  updateCharacterButtons();
  updatePlayerList();

  // Add roll button listener
  document.getElementById("rollBtn").addEventListener("click", () => {
    const rollValue = Math.floor(Math.random() * 6) + 1; // 1-6
    socket.emit("playerRolledDice", { roomCode, rollValue });
    document.getElementById("rollBtn").disabled = true;
    document.getElementById("rollBtn").innerText = `You rolled a ${rollValue}!`;
  });
}

// --- Character selection logic ---
function updateCharacterButtons() {
  const charactersDiv = document.getElementById("characters");
  charactersDiv.innerHTML = "";

  for (const charName in characterStats) {
    const char = characterStats[charName];
    const takenBy = roomData.characters ? roomData.characters[charName] : null;
    const isTaken = takenBy && takenBy !== playerName;

    const button = document.createElement("button");
    button.innerText = `${charName} (${char.profession}) - Luck: ${char.luck}, Talent: ${char.talent}, Networking: ${char.networking}, Wealth: ${char.wealth}`;
    button.disabled = isTaken;
    button.style.margin = "8px";
    button.style.padding = "10px";
    button.style.borderRadius = "8px";
    button.style.cursor = isTaken ? "not-allowed" : "pointer";
    button.style.backgroundColor = myCharacter === charName ? "#90ee90" : (isTaken ? "#ccc" : "#ffd700");

    button.addEventListener("click", () => {
      if (myCharacter === charName) return;
      // Release previous choice
      if (myCharacter) {
        socket.emit("releaseCharacter", { roomCode, character: myCharacter });
      }
      // Choose new character
      socket.emit("chooseCharacter", { roomCode, playerName, character: charName });
      myCharacter = charName;
    });

    charactersDiv.appendChild(button);
  }
}

// --- Player list update ---
function updatePlayerList() {
  const list = document.getElementById("playerList");
  list.innerHTML = "";
  roomData.players.forEach(p => {
    const li = document.createElement("li");
    li.innerText = p.name + (p.character ? ` - ${p.character}` : "");
    list.appendChild(li);
  });
}

// --- Socket events for updates ---
socket.on("updateRoom", (data) => {
  roomData.players = data.players;
  updatePlayerList();
  updateCharacterButtons();
});

socket.on("updateCharacterSelection", (characters) => {
  roomData.characters = characters;
  updateCharacterButtons();
  updatePlayerList();
});

socket.on("characterTaken", (charName) => alert(`${charName} is already taken!`));

socket.on("roomClosed", (msg) => {
  alert(msg);
  location.reload();
});

// --- Start Game Event ---
socket.on("startGame", () => {
  // Hide character selection and show dice roll
  document.getElementById("characters").style.display = "none";
  document.getElementById("rollContainer").style.display = "block";
});