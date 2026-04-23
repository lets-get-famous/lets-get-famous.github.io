const socket = io("https://lets-get-famous-github-io.onrender.com");

let roomCode = "";
let playerName = "";
let characterStats = {};
let roomData = {
  players: [],
  characters: {},
  scores: {},
  scorePayload: {
    roomCode: "",
    updatedAt: "",
    scores: [],
  },
};

let myCharacter = null;
let activePlayer = null;
let hasRolledThisTurn = false;
let autoRollTimer = null;

const AUTO_ROLL_DELAY = 30000; // 30 seconds

// 🔌 CONNECT
socket.on("connect", () => {
  console.log("🔌 Connected:", socket.id);
  socket.emit("identify", { clientType: "web-player" });
});

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
    showMessage("Enter room code and name.");
    return;
  }

  console.log("🚪 Joining room:", roomCode, "as", playerName);

  socket.emit("joinRoom", { roomCode, playerName });
}

// ⏱ AUTO ROLL
function clearAutoRollTimer() {
  if (autoRollTimer) {
    clearTimeout(autoRollTimer);
    autoRollTimer = null;
  }
}

function startAutoRollTimer() {
  clearAutoRollTimer();

  if (playerName !== activePlayer || hasRolledThisTurn) return;

  autoRollTimer = setTimeout(() => {
    if (playerName !== activePlayer || hasRolledThisTurn) return;

    const rollValue = Math.floor(Math.random() * 6) + 1;
    hasRolledThisTurn = true;

    console.log("⏱ Auto roll:", rollValue);

    const rollBtn = document.getElementById("rollBtn");
    if (rollBtn) {
      rollBtn.disabled = true;
      rollBtn.textContent = `Auto Rolled: ${rollValue}`;
    }

    socket.emit("playerRolled", { roomCode, playerName, rollValue });
  }, AUTO_ROLL_DELAY);
}

// 💬 MESSAGE
function showMessage(message) {
  const waitingArea = document.getElementById("waitingArea");
  if (waitingArea) {
    waitingArea.innerHTML = `<p>${message}</p>`;
  }
}

// 🎮 LOAD GAME
socket.on("loadGamePage", (data) => {
  console.log("📦 loadGamePage:", data);

  roomCode = data.roomCode;
  playerName = data.playerName;
  roomData = data.roomData || {};
  characterStats = data.characterStats || {};

  showCharacterSelection();
});

// 🎭 CHARACTER SELECT
function areAllCharactersTaken() {
  const characterNames = Object.keys(characterStats || {});
  return characterNames.every(
    (char) => roomData.characters && roomData.characters[char]
  );
}

function showCharacterSelection() {
  const app = document.getElementById("app");

  app.innerHTML = `
    <h1 class="title">Choose Your Character</h1>

    <div id="statusArea">
      <p><strong>Room:</strong> ${roomCode}</p>
      <p id="turnText">Waiting...</p>
      <p id="scoreText">Your Score: 0</p>
    </div>

    <div id="characters"></div>

    <button id="lockBtn" class="pink-btn">Lock In</button>

    <div id="waitingArea"></div>

    <div id="rollContainer" style="display:none;">
      <button id="rollBtn" class="pink-btn">Roll Dice</button>
    </div>
  `;

  updateCharacterButtons();
  setupUIEvents();
}

function setupUIEvents() {
  const lockBtn = document.getElementById("lockBtn");
  const rollBtn = document.getElementById("rollBtn");

  if (lockBtn) {
    lockBtn.onclick = () => {
      if (!myCharacter && !areAllCharactersTaken()) {
        showMessage("Choose a character first.");
        return;
      }

      console.log("🔒 Locked in");

      socket.emit("lockCharacter", { roomCode, playerName });

      lockBtn.style.display = "none";
      document.getElementById("characters").style.display = "none";

      showMessage("Waiting for game...");
    };
  }

  if (rollBtn) {
    rollBtn.onclick = () => {
      if (playerName !== activePlayer || hasRolledThisTurn) return;

      clearAutoRollTimer();

      const rollValue = Math.floor(Math.random() * 6) + 1;
      hasRolledThisTurn = true;

      console.log("🎲 Rolled:", rollValue);

      rollBtn.disabled = true;
      rollBtn.textContent = `Rolled ${rollValue}`;

      socket.emit("playerRolled", { roomCode, playerName, rollValue });
    };
  }
}

// 🎭 CHARACTER BUTTONS
function updateCharacterButtons() {
  const container = document.getElementById("characters");
  container.innerHTML = "";

  for (const charName in characterStats) {
    const btn = document.createElement("button");
    btn.textContent = charName;

    btn.onclick = () => {
      console.log("🎭 Character selected:", charName);

      socket.emit("chooseCharacter", {
        roomCode,
        playerName,
        character: charName,
        previous: myCharacter,
      });

      myCharacter = charName;
    };

    container.appendChild(btn);
  }
}

// 🔄 TURN UPDATE
function updateTurnUI() {
  const turnText = document.getElementById("turnText");
  const rollContainer = document.getElementById("rollContainer");

  clearAutoRollTimer();

  if (!activePlayer) {
    turnText.textContent = "Waiting...";
    rollContainer.style.display = "none";
    return;
  }

  if (playerName === activePlayer) {
    turnText.textContent = "YOUR TURN";
    rollContainer.style.display = "block";
    startAutoRollTimer();
  } else {
    turnText.textContent = `${activePlayer}'s Turn`;
    rollContainer.style.display = "none";
  }

  console.log("🔄 Turn changed:", activePlayer);
}

socket.on("turnChanged", (data) => {
  console.log("📡 turnChanged:", data);

  activePlayer = data.activePlayer;
  hasRolledThisTurn = false;

  updateTurnUI();
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
  console.log("🃏 Card:", card);

  if (playerName !== target) return;

  const area = document.getElementById("waitingArea");

  if (card.type === "Scandal") {
    area.innerHTML = `<p>${card.text}</p>`;
    return;
  }

  area.innerHTML = `
    <p>${card.text}</p>
    <button id="acceptBtn">Accept</button>
    <button id="declineBtn">Decline</button>
  `;

  document.getElementById("acceptBtn").onclick = () => {
    console.log("✅ Accepted card");
    socket.emit("cardResponse", { roomCode, playerName, accepted: true });
    area.innerHTML = `<p>+100 points</p>`;
  };

  document.getElementById("declineBtn").onclick = () => {
    console.log("❌ Declined card");
    socket.emit("cardResponse", { roomCode, playerName, accepted: false });
    area.innerHTML = `<p>Declined</p>`;
  };
});

// 📊 SCORE
socket.on("scoreUpdate", (payload) => {
  console.log("📊 Score update:", payload);

  const myEntry = payload.scores.find(
    (p) => p.playerName === playerName
  );

  const score = myEntry?.score ?? 0;

  document.getElementById("scoreText").textContent =
    `Your Score: ${score}`;
});

// 🏁 GAME OVER
socket.on("gameOver", ({ winner, winnerCharacter, score }) => {
  console.log("🏁 GAME OVER:", winner, score);

  document.getElementById("app").innerHTML = `
    <h1>🎉 ${winner} Wins!</h1>
    <p>${winnerCharacter}</p>
    <h2>${score} Points</h2>
  `;
});