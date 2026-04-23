const socket = io("https://lets-get-famous-github-io.onrender.com");

let roomCode = "";
let playerName = "";
let roomData = { scorePayload: { scores: [] } };

let activePlayer = null;
let hasRolledThisTurn = false;
let autoRollTimer = null;

const AUTO_ROLL_DELAY = 30000;

// CONNECT
socket.on("connect", () => {
  socket.emit("identify", { clientType: "web-player" });
});

// JOIN
function joinRoom() {
  const code = document.getElementById("code").value.trim().toUpperCase();
  const name = document.getElementById("name").value.trim();

  if (!code || !name) return;

  roomCode = code;
  playerName = name;

  socket.emit("joinRoom", { roomCode, playerName });
}

// LOAD GAME UI (MINIMAL)
socket.on("loadGamePage", (data) => {
  roomCode = data.roomCode;
  playerName = data.playerName;

  const app = document.getElementById("app");

  app.innerHTML = `
    <h1 class="title">Let’s Get Famous ✨</h1>

    <div id="statusArea">
      <p><strong>Room:</strong> ${roomCode}</p>
      <h2 id="turnText">Waiting...</h2>
      <p id="scoreText">Score: 0</p>
    </div>

    <div id="rollContainer" style="display:none;">
      <button id="rollBtn" class="pink-btn">Roll 🎲</button>
    </div>

    <div id="cardArea"></div>
  `;

  document.getElementById("rollBtn").onclick = rollDice;
});

// TURN UI
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
    turnText.textContent = "✨ YOUR TURN ✨";
    rollContainer.style.display = "block";
    startAutoRollTimer();
  } else {
    turnText.textContent = `${activePlayer}'s Turn`;
    rollContainer.style.display = "none";
  }
}

// ROLL
function rollDice() {
  if (playerName !== activePlayer || hasRolledThisTurn) return;

  clearAutoRollTimer();

  const rollValue = Math.floor(Math.random() * 6) + 1;
  hasRolledThisTurn = true;

  const btn = document.getElementById("rollBtn");
  btn.disabled = true;
  btn.textContent = `Rolled ${rollValue}`;

  socket.emit("playerRolled", { roomCode, playerName, rollValue });
}

// AUTO ROLL
function startAutoRollTimer() {
  autoRollTimer = setTimeout(() => {
    if (playerName !== activePlayer || hasRolledThisTurn) return;

    const rollValue = Math.floor(Math.random() * 6) + 1;
    hasRolledThisTurn = true;

    socket.emit("playerRolled", { roomCode, playerName, rollValue });
  }, AUTO_ROLL_DELAY);
}

function clearAutoRollTimer() {
  if (autoRollTimer) clearTimeout(autoRollTimer);
}

// SCORE
socket.on("scoreUpdate", (payload) => {
  if (!payload?.scores) return;

  const me = payload.scores.find(p => p.playerName === playerName);
  const score = me?.score ?? 0;

  document.getElementById("scoreText").textContent = `Score: ${score}`;
});

// TURN CHANGE
socket.on("turnChanged", (data) => {
  activePlayer = data.activePlayer;
  hasRolledThisTurn = false;
  updateTurnUI();
});

// GAME START
socket.on("startGame", () => {
  hasRolledThisTurn = false;
  clearAutoRollTimer();
});

// CARDS (CLEAN)
socket.on("cardDrawn", ({ playerName: target, card }) => {
  if (target !== playerName) return;

  const area = document.getElementById("cardArea");

  if (card.type === "Scandal") {
    area.innerHTML = `
      <div class="card-box">
        <h3>Scandal</h3>
        <p>${card.text}</p>
      </div>
    `;
    return;
  }

  area.innerHTML = `
    <div class="card-box">
      <h3>${card.type}</h3>
      <p>${card.text}</p>
      <button id="acceptBtn" class="pink-btn">Accept</button>
      <button id="declineBtn" class="pink-btn">Decline</button>
    </div>
  `;

  document.getElementById("acceptBtn").onclick = () => {
    socket.emit("cardResponse", { roomCode, playerName, accepted: true });
    area.innerHTML = `<p>+100 Points 💅</p>`;
  };

  document.getElementById("declineBtn").onclick = () => {
    socket.emit("cardResponse", { roomCode, playerName, accepted: false });
    area.innerHTML = `<p>Declined</p>`;
  };
});

// GAME OVER (KEEP THIS ✨)
socket.on("gameOver", ({ winner, winnerCharacter, score }) => {
  clearAutoRollTimer();

  document.getElementById("app").innerHTML = `
    <div class="card-box">
      <h1>🎉 ${winner} Wins! 🎉</h1>
      <p>${winnerCharacter || "No Character"}</p>
      <h2>${score} Points</h2>

      <a href="https://docs.google.com/forms/d/e/1FAIpQLSf4H0W8k-LGMkruN26jHWRSVLEazJabE2b4KXv8SY-RGI4w4w/viewform?usp=dialog"
         class="pink-btn"
         target="_blank">
        UX Feedback
      </a>
    </div>
  `;
});