const socket = io("https://lets-get-famous-github-io.onrender.com");

let roomCode, playerName, characterStats, roomData;
let myCharacter = null;

// Connect and identify
socket.on("connect", () => {
  socket.emit("identify", { clientType: "web-player" });
});

// Join room
function joinRoom() {
  roomCode = document.getElementById("code").value.toUpperCase();
  playerName = document.getElementById("name").value;
  if (!roomCode || !playerName) return alert("Enter room code and name!");
  socket.emit("joinRoom", { roomCode, playerName });
}

// Load game page
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
      <button id="rollBtn">🎲 Roll Dice</button>
    </div>
  `;
  updateCharacterButtons();
  updatePlayerList();

  document.getElementById("rollBtn").addEventListener("click", () => {
    const rollValue = Math.floor(Math.random() * 6) + 1;
    socket.emit("playerRolledDice", { roomCode, playerName, rollValue });
    document.getElementById("rollBtn").disabled = true;
    document.getElementById("rollBtn").innerText = `You rolled ${rollValue}!`;
  });
}

function updateCharacterButtons() {
  const charactersDiv = document.getElementById("characters");
  charactersDiv.innerHTML = "";
  for (const charName in characterStats) {
    const char = characterStats[charName];
    const takenBy = roomData.characters ? roomData.characters[charName] : null;
    const isTaken = takenBy && takenBy !== playerName;

    const button = document.createElement("button");
    button.innerText = `${charName} (${char.profession})`;
    button.disabled = isTaken;
    button.style.backgroundColor = myCharacter === charName ? "#90ee90" : (isTaken ? "#ccc" : "#ffd700");

    button.addEventListener("click", () => {
      if (myCharacter === charName) return;
      if (myCharacter) socket.emit("releaseCharacter", { roomCode, character: myCharacter });
      socket.emit("chooseCharacter", { roomCode, playerName, character: charName, previous: myCharacter });
      myCharacter = charName;
    });

    charactersDiv.appendChild(button);
  }
}

function updatePlayerList() {
  const list = document.getElementById("playerList");
  list.innerHTML = "";
  roomData.players.forEach(p => {
    const li = document.createElement("li");
    li.innerText = p.name + (p.character ? ` - ${p.character}` : "");
    list.appendChild(li);
  });
}

// Socket updates
socket.on("updateRoom", (data) => {
  roomData.players = data.players;
  roomData.characters = data.characters;
  updatePlayerList();
  updateCharacterButtons();
});

socket.on("updateCharacterSelection", (characters) => {
  roomData.characters = characters;
  updateCharacterButtons();
  updatePlayerList();
});

socket.on("characterTaken", (charName) => alert(`${charName} is already taken!`));
socket.on("roomClosed", (msg) => { alert(msg); location.reload(); });
socket.on("startGame", () => {
  document.getElementById("characters").style.display = "none";
  document.getElementById("rollContainer").style.display = "block";
});
