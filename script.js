const socket = io("https://lets-get-famous-github-io.onrender.com");
let roomCode, playerName, characterStats, roomData;
let myCharacter = null;

socket.on("connect", () => {
  socket.emit("identify", { clientType: "web-player" });
});

function joinRoom() {
  roomCode = document.getElementById("code").value.toUpperCase();
  playerName = document.getElementById("name").value;
  if (!roomCode || !playerName) return alert("Enter room code and name!");
  socket.emit("joinRoom", { roomCode, playerName });
}

socket.on("loadGamePage", (data) => {
  roomCode = data.roomCode;
  playerName = data.playerName;
  roomData = data.roomData;
  characterStats = data.characterStats;
  showCharacterSelection();
});

function showCharacterSelection() {
  document.body.innerHTML = `
  <body>
  <div class="container">
    <h1 class="title">Choose Your Character</h1>

    <div id="characters"></div>

    <h3>Players in Room:</h3>
    <div class="inputs">
      <ul id="playerList"></ul>
    </div>

    <div class="inputs">
      <button id="lockBtn" class="pink-btn">🔒 Lock In</button>
    </div>

    <div id="rollContainer" style="display:none;margin-top:20px;">
      <button id="rollBtn" class="pink-btn">🎲 Roll Dice</button>
    </div>
  </div>
  `;
  updateCharacterButtons();
  updatePlayerList();

  document.getElementById("lockBtn").addEventListener("click", () => {
    if (!myCharacter) return alert("Choose a character first!");
    socket.emit("lockCharacter", { roomCode, playerName });
    document.getElementById("characters").style.display = "none";
    document.getElementById("lockBtn").style.display = "none";
    const waitingText = document.createElement("p");
    waitingText.id = "waitingText";
    waitingText.innerText = "Waiting for the host to start...";
    document.body.appendChild(waitingText);
  });

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

// --- Socket updates ---
socket.on("updateRoom", (data) => { roomData.players = data.players; roomData.characters = data.characters; updatePlayerList(); updateCharacterButtons(); });
socket.on("updateCharacterSelection", (characters) => { roomData.characters = characters; updateCharacterButtons(); });
socket.on("characterTaken", (charName) => alert(`${charName} is already taken!`));
socket.on("roomClosed", (msg) => { alert(msg); location.reload(); });

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
const rollBtn = document.getElementById('rollDiceBtn');

// Show button when Unity/game triggers startGame
socket.on("startGame", () => {
    rollBtn.style.display = "block";
});

// When player clicks the button
rollBtn.addEventListener("click", () => {
    // You could also send the roll directly from JS if needed:
    const roll = Math.floor(Math.random() * 6) + 1;
    socket.emit("orderPlayerDiceRoll", { roll: roll, playerName: "Player1" });

    rollBtn.style.display = "none"; // hide button after rolling
});