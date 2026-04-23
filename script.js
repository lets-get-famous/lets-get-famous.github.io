const socket = io("https://lets-get-famous-github-io.onrender.com");

let roomCode = "";
let playerName = "";
let characterStats = {};
let roomData = { players: [], characters: {}, scores: {}, scorePayload: { scores: [] } };

let myCharacter = null;
let activePlayer = null;
let hasRolledThisTurn = false;
let autoRollTimer = null;

const AUTO_ROLL_DELAY = 30000;

// 🔌 CONNECT
socket.on("connect", () => {
  console.log("🔌 Connected:", socket.id);
  socket.emit("identify", { clientType: "web-player" });
});

// JOIN
function joinRoom() {
  const code = document.getElementById("code").value.trim().toUpperCase();
  const name = document.getElementById("name").value.trim();

  if (!code || !name) {
    showMessage("✨ Enter room code and name bestie ✨");
    return;
  }

  roomCode = code;
  playerName = name;

  console.log("🚪 Joining:", roomCode, playerName);
  socket.emit("joinRoom", { roomCode, playerName });
}

// 💬 MESSAGE
function showMessage(msg) {
  const area = document.getElementById("waitingArea");
  if (area) area.innerHTML = `<p>${msg}</p>`;
}

// 🎮 LOAD GAME
socket.on("loadGamePage", (data) => {
  console.log("📦 Game Loaded:", data);

  roomCode = data.roomCode;
  playerName = data.playerName;
  characterStats = data.characterStats || {};
  roomData = data.roomData || {};

  showCharacterSelection();
});

// 🎭 CHARACTER SELECT UI
function showCharacterSelection() {
  const app = document.getElementById("app");

  app.innerHTML = `
    <h1 class="title">✨ Choose Your Character ✨</h1>

    <div id="statusArea">
      <p><strong>Room:</strong> ${roomCode}</p>
      <h2 id="turnText">Waiting...</h2>
      <p id="scoreText">Your Score: 0</p>
    </div>

    <div id="characters" class="character-grid"></div>

    <button id="lockBtn" class="pink-btn">💖 Lock In</button>

    <div id="waitingArea"></div>

    <div id="rollContainer" style="display:none;">
      <button id="rollBtn" class="pink-btn big-btn">🎲 Roll</button>
    </div>
  `;

  updateCharacterButtons();
  setupUIEvents();
}

// 🎭 CHARACTER BUTTONS (CUTE AGAIN)
function updateCharacterButtons() {
  const container = document.getElementById("characters");
  container.innerHTML = "";

  for (const charName in characterStats) {
    const char = characterStats[charName];

    const btn = document.createElement("button");
    btn.classList.add("character-btn");

    btn.innerHTML = `
      <strong>${charName}</strong><br>
      <span>${char.profession}</span>
    `;

    btn.onclick = () => {
      console.log("🎭 Picked:", charName);

      socket.emit("chooseCharacter", {
        roomCode,
        playerName,
        character: charName,
        previous: myCharacter,
      });

      myCharacter = charName;

      document.querySelectorAll(".character-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
    };

    container.appendChild(btn);
  }
}

// 🔘 BUTTON EVENTS
function setupUIEvents() {
  const lockBtn = document.getElementById("lockBtn");
  const rollBtn = document.getElementById("rollBtn");

  lockBtn.onclick = () => {
    if (!myCharacter) {
      showMessage("Pick a character first 💅");
      return;
    }

    console.log("🔒 Locked in");

    socket.emit("lockCharacter", { roomCode, playerName });

    lockBtn.style.display = "none";
    document.getElementById("characters").style.display = "none";

    showMessage("✨ Waiting for the game to start ✨");
  };

  rollBtn.onclick = () => {
    if (playerName !== activePlayer || hasRolledThisTurn) return;

    const roll = Math.floor(Math.random() * 6) + 1;
    hasRolledThisTurn = true;

    console.log("🎲 Rolled:", roll);

    rollBtn.disabled = true;
    rollBtn.textContent = `🎲 ${roll}`;

    socket.emit("playerRolled", { roomCode, playerName, rollValue: roll });
  };
}

// 🔄 TURN
socket.on("turnChanged", (data) => {
  activePlayer = data.activePlayer;
  hasRolledThisTurn = false;

  console.log("🔄 Turn:", activePlayer);

  const turnText = document.getElementById("turnText");
  const rollContainer = document.getElementById("rollContainer");

  if (playerName === activePlayer) {
    turnText.textContent = "✨ YOUR TURN ✨";
    rollContainer.style.display = "block";
  } else {
    turnText.textContent = `${activePlayer}'s Turn`;
    rollContainer.style.display = "none";
  }
});

// 🎲 ROLL EVENTS
socket.on("diceRolled", (data) => {
  console.log("🎲 diceRolled:", data);
});

socket.on("activePlayerRolled", (data) => {
  console.log("🎯 activePlayerRolled:", data);
});

// 🃏 CARDS
socket.on("cardDrawn", ({ playerName: target, card }) => {
  if (target !== playerName) return;

  console.log("🃏 Card:", card);

  const area = document.getElementById("waitingArea");

  if (card.type === "Scandal") {
    area.innerHTML = `<div class="card-box">💀 ${card.text}</div>`;
    return;
  }

  area.innerHTML = `
    <div class="card-box">
      <p>${card.text}</p>
      <button id="acceptBtn" class="pink-btn">💖 Accept</button>
      <button id="declineBtn" class="pink-btn">🙅‍♀️ Decline</button>
    </div>
  `;

  document.getElementById("acceptBtn").onclick = () => {
    socket.emit("cardResponse", { roomCode, playerName, accepted: true });
    area.innerHTML = `<p>✨ +100 Points ✨</p>`;
  };

  document.getElementById("declineBtn").onclick = () => {
    socket.emit("cardResponse", { roomCode, playerName, accepted: false });
    area.innerHTML = `<p>Declined</p>`;
  };
});

// 📊 SCORE
socket.on("scoreUpdate", (payload) => {
  console.log("📊 Score:", payload);

  const me = payload.scores.find(p => p.playerName === playerName);
  const score = me?.score ?? 0;

  document.getElementById("scoreText").textContent = `Score: ${score}`;
});

// 🏁 GAME OVER
socket.on("gameOver", ({ winner, winnerCharacter, score }) => {
  console.log("🏁 GAME OVER:", winner);

  document.getElementById("app").innerHTML = `
    <div class="card-box">
      <h1>🎉 ${winner} Wins! 🎉</h1>
      <p>${winnerCharacter}</p>
      <h2>${score} Points</h2>
    </div>
  `;
});