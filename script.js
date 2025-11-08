const socket = io("https://lets-get-famous-github-io.onrender.com");

let roomCode, playerName, characterStats, roomData;

// Connect and identify as web player
socket.on("connect", () => {
  socket.emit("identify", { clientType: "web-player" });
});

// Join room function
function joinRoom() {
  roomCode = document.getElementById("code").value.toUpperCase();
  playerName = document.getElementById("name").value;
  if (!roomCode || !playerName) return alert("Enter room code and name!");
  socket.emit("joinRoom", { roomCode, playerName });
}

// Successfully joined room
socket.on("loadGamePage", (data) => {
  roomCode = data.roomCode;
  playerName = data.playerName;
  roomData = data.roomData;
  characterStats = data.characterStats;

  showCharacterSelection();
});

// Update room (player joins/leaves)
socket.on("updateRoom", (data) => {
  roomData.players = data.players;
});

// Update character selection
socket.on("updateCharacterSelection", (characters) => {
  roomData.characters = characters;
  updateCharacterButtons();
});

// Notify if character is already taken
socket.on("characterTaken", (charName) => {
  alert(`${charName} is already taken!`);
});

// Handle room closed
socket.on("roomClosed", (msg) => {
  alert(msg);
  location.reload();
});

// --- UI Functions ---

function showCharacterSelection() {
  document.body.innerHTML = `
    <h2>Choose Your Character</h2>
    <div id="characters"></div>
    <h3>Players in room:</h3>
    <ul id="playerList"></ul>
  `;
  updateCharacterButtons();
  updatePlayerList();
}

// Create/update character buttons
function updateCharacterButtons() {
  const charactersDiv = document.getElementById("characters");
  charactersDiv.innerHTML = "";

  for (const charName in characterStats) {
    const char = characterStats[charName];
    const isTaken = roomData.characters && roomData.characters[charName];
    const button = document.createElement("button");
    button.innerText = `${charName} (${char.profession}) - Luck: ${char.luck}, Talent: ${char.talent}, Networking: ${char.networking}, Wealth: ${char.wealth}`;
    button.disabled = isTaken;
    button.style.margin = "8px";
    button.style.padding = "10px";
    button.style.borderRadius = "8px";
    button.style.cursor = isTaken ? "not-allowed" : "pointer";
    button.style.backgroundColor = isTaken ? "#ccc" : "#ffd700";

    button.addEventListener("click", () => {
      socket.emit("chooseCharacter", { roomCode, playerName, character: charName });
    });

    charactersDiv.appendChild(button);
  }
}

// Update player list
function updatePlayerList() {
  const list = document.getElementById("playerList");
  list.innerHTML = "";
  roomData.players.forEach(p => {
    const li = document.createElement("li");
    li.innerText = p.name + (p.character ? ` - ${p.character}` : "");
    list.appendChild(li);
  });
}

// Whenever character selection updates, also refresh the player list
socket.on("updateCharacterSelection", () => {
  updateCharacterButtons();
  updatePlayerList();
});