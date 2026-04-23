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

socket.on("connect", () => {
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

  if (!roomCode || !playerName) return;

  socket.emit("joinRoom", { roomCode, playerName });
}

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

    const rollBtn = document.getElementById("rollBtn");
    if (rollBtn) {
      rollBtn.disabled = true;
      rollBtn.textContent = `Auto Rolled: ${rollValue}`;
    }

    socket.emit("playerRolled", { roomCode, playerName, rollValue });
  }, AUTO_ROLL_DELAY);
}

socket.on("loadGamePage", (data) => {
  roomCode = data.roomCode;
  playerName = data.playerName;

  roomData = data.roomData || {
    players: [],
    characters: {},
    scores: {},
    scorePayload: {
      roomCode: "",
      updatedAt: "",
      scores: [],
    },
  };

  characterStats = data.characterStats || {};

  if (!roomData.scorePayload) {
    roomData.scorePayload = {
      roomCode,
      updatedAt: "",
      scores: [],
    };
  }

  showCharacterSelection();
});

function areAllCharactersTaken() {
  const characterNames = Object.keys(characterStats || {});
  if (characterNames.length === 0) return false;

  return characterNames.every(
    (char) => roomData.characters && roomData.characters[char]
  );
}

function showCharacterSelection() {
  const app = document.getElementById("app");
  if (!app) return;

  const allCharactersTaken = areAllCharactersTaken();

  app.innerHTML = `
    <h1 class="title">Choose Your Character</h1>

    <div id="statusArea">
      <p id="roomText"><strong>Room:</strong> ${roomCode}</p>
      <p id="turnText">Waiting for game to start...</p>
      <p id="countdownText"></p>
      <p id="scoreText"></p>
    </div>

    <div id="characters"></div>

    <h3 class="section-heading">Players</h3>
    <div class="inputs">
      <ul id="playerList"></ul>
    </div>

    <div class="inputs">
      <button id="lockBtn" class="pink-btn">
        ${allCharactersTaken ? "Join Game" : "Lock In"}
      </button>
    </div>

    <div id="waitingArea"></div>

    <div id="rollContainer" style="display:none;">
      <button id="rollBtn" class="pink-btn" disabled>Roll Dice</button>
    </div>
  `;

  updateCharacterButtons();
  updatePlayerList();
  updateScoreText(roomData.scorePayload);
  setupUIEvents();
}

function setupUIEvents() {
  const lockBtn = document.getElementById("lockBtn");
  const rollBtn = document.getElementById("rollBtn");

  if (lockBtn) {
    lockBtn.addEventListener("click", () => {
      const allCharactersTaken = areAllCharactersTaken();

      if (!myCharacter && !allCharactersTaken) return;

      socket.emit("lockCharacter", { roomCode, playerName });

      const characters = document.getElementById("characters");
      if (characters) characters.style.display = "none";
      lockBtn.style.display = "none";

      const waitingArea = document.getElementById("waitingArea");
      if (waitingArea) {
        waitingArea.innerHTML = `<p id="waitingText">Locked in. Waiting...</p>`;
      }
    });
  }

  if (rollBtn) {
    rollBtn.addEventListener("click", () => {
      if (playerName !== activePlayer || hasRolledThisTurn) return;

      clearAutoRollTimer();

      const rollValue = Math.floor(Math.random() * 6) + 1;
      hasRolledThisTurn = true;

      rollBtn.disabled = true;
      rollBtn.textContent = `You Rolled: ${rollValue}`;

      socket.emit("playerRolled", { roomCode, playerName, rollValue });
    });
  }
}

function updateCharacterButtons() {
  const charactersDiv = document.getElementById("characters");
  if (!charactersDiv) return;

  charactersDiv.innerHTML = "";

  const allCharactersTaken = areAllCharactersTaken();

  if (allCharactersTaken && !myCharacter) {
    charactersDiv.innerHTML = `
      <p style="opacity: 0.85;">All characters are taken. You can still join.</p>
    `;
    return;
  }

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
          character: myCharacter,
        });
      }

      socket.emit("chooseCharacter", {
        roomCode,
        playerName,
        character: charName,
        previous: myCharacter,
      });

      myCharacter = charName;
      updateCharacterButtons();
    });

    charactersDiv.appendChild(button);
  }
}

function updatePlayerList() {
  const list = document.getElementById("playerList");
  if (!list) return;

  list.innerHTML = "";

  (roomData.players || []).forEach((p) => {
    const li = document.createElement("li");
    li.textContent = p.character
      ? `${p.name} - ${p.character}`
      : `${p.name} - Audience`;
    list.appendChild(li);
  });
}

function updateTurnUI() {
  const turnText = document.getElementById("turnText");
  const rollContainer = document.getElementById("rollContainer");
  const rollBtn = document.getElementById("rollBtn");

  if (!turnText || !rollContainer || !rollBtn) return;

  clearAutoRollTimer();

  if (!activePlayer) {
    turnText.textContent = "Waiting...";
    rollContainer.style.display = "none";
    return;
  }

  if (playerName === activePlayer) {
    turnText.textContent = `Your Turn`;
    rollContainer.style.display = "block";
    rollBtn.disabled = false;
    rollBtn.textContent = "Roll Dice";
    startAutoRollTimer();
  } else {
    turnText.textContent = `${activePlayer}'s Turn`;
    rollContainer.style.display = "none";
  }
}

function updateScoreText(scorePayload) {
  const scoreText = document.getElementById("scoreText");
  if (!scoreText) return;

  if (!scorePayload || !Array.isArray(scorePayload.scores)) {
    scoreText.textContent = "Your Score: 0";
    return;
  }

  const myEntry = scorePayload.scores.find((entry) => entry.playerName === playerName);
  const myScore = myEntry?.score ?? 0;

  scoreText.textContent = `Your Score: ${myScore}`;
}

socket.on("updateRoom", (data) => {
  roomData.players = data.players || [];
  roomData.characters = data.characters || {};
  roomData.scores = data.scores || {};
  roomData.scorePayload = data.scorePayload || roomData.scorePayload || {
    roomCode,
    updatedAt: "",
    scores: [],
  };

  updatePlayerList();
  updateCharacterButtons();
  updateScoreText(roomData.scorePayload);

  const lockBtn = document.getElementById("lockBtn");
  if (lockBtn) {
    lockBtn.textContent = areAllCharactersTaken() ? "Join Game" : "Lock In";
  }
});

socket.on("updateCharacterSelection", (characters) => {
  roomData.characters = characters || {};
  updateCharacterButtons();

  const lockBtn = document.getElementById("lockBtn");
  if (lockBtn) {
    lockBtn.textContent = areAllCharactersTaken() ? "Join Game" : "Lock In";
  }
});

socket.on("characterTaken", () => {
  const waitingArea = document.getElementById("waitingArea");
  if (waitingArea) {
    waitingArea.innerHTML = `<p id="waitingText">That character is already taken.</p>`;
  }
});

socket.on("joinFailed", (msg) => {
  const waitingArea = document.getElementById("waitingArea");
  if (waitingArea) {
    waitingArea.innerHTML = `<p id="waitingText">${msg}</p>`;
  }
});

socket.on("roomClosed", (msg) => {
  const app = document.getElementById("app");
  if (app) {
    app.innerHTML = `<p>${msg || "Room closed."}</p>`;
  }
});

socket.on("startGame", () => {
  const turnText = document.getElementById("turnText");
  const countdownText = document.getElementById("countdownText");
  const waitingArea = document.getElementById("waitingArea");

  hasRolledThisTurn = false;
  clearAutoRollTimer();

  if (turnText) turnText.textContent = "Game Started";
  if (countdownText) countdownText.textContent = "";
  if (waitingArea) waitingArea.innerHTML = "";
});

socket.on("countdownUpdate", (countdown) => {
  const countdownText = document.getElementById("countdownText");
  if (!countdownText) return;

  countdownText.textContent =
    countdown === null || countdown === undefined
      ? ""
      : `Starting in ${countdown}...`;
});

socket.on("turnChanged", (data) => {
  activePlayer = data.activePlayer;
  hasRolledThisTurn = false;
  updateTurnUI();
});

socket.on("diceRolled", () => {
  // intentionally left simple
});

socket.on("notYourTurn", ({ activePlayer }) => {
  const turnText = document.getElementById("turnText");
  if (turnText) {
    turnText.textContent = `${activePlayer}'s Turn`;
  }
});

socket.on("cardDrawn", ({ playerName: target, card }) => {
  if (playerName !== target) return;

  clearAutoRollTimer();

  const waitingArea = document.getElementById("waitingArea");
  const rollBtn = document.getElementById("rollBtn");

  if (!waitingArea) return;
  if (rollBtn) rollBtn.disabled = true;

  if (card.type === "Scandal") {
    waitingArea.innerHTML = `
      <div class="card-box">
        <h3>Scandal</h3>
        <p>${card.text}</p>
      </div>
    `;
    return;
  }

  waitingArea.innerHTML = `
    <div class="card-box">
      <h3>${card.type}</h3>
      <p>${card.text}</p>
      <button id="acceptBtn" class="pink-btn">Accept</button>
      <button id="declineBtn" class="pink-btn">Decline</button>
    </div>
  `;

  const acceptBtn = document.getElementById("acceptBtn");
  const declineBtn = document.getElementById("declineBtn");

  if (acceptBtn) {
    acceptBtn.onclick = () => {
      socket.emit("cardResponse", { roomCode, playerName, accepted: true });
      waitingArea.innerHTML = `<p id="waitingText">Accepted! +100 points</p>`;
    };
  }

  if (declineBtn) {
    declineBtn.onclick = () => {
      socket.emit("cardResponse", { roomCode, playerName, accepted: false });
      waitingArea.innerHTML = `<p id="waitingText">Declined.</p>`;
    };
  }
});

socket.on("cardAutoDecline", ({ playerName: target }) => {
  if (playerName !== target) return;

  const waitingArea = document.getElementById("waitingArea");
  if (waitingArea) {
    waitingArea.innerHTML = `<p id="waitingText">Time’s up. Auto-declined.</p>`;
  }
});

socket.on("scoreUpdate", (payload) => {
  if (!payload || !Array.isArray(payload.scores)) return;

  roomData.scorePayload = payload;
  roomData.scores = {};

  payload.scores.forEach((entry) => {
    roomData.scores[entry.playerName] = entry.score;
  });

  updateScoreText(roomData.scorePayload);
});

socket.on("gameOver", ({ winner, winnerCharacter, score, scorePayload }) => {
  const waitingArea = document.getElementById("waitingArea");
  const rollContainer = document.getElementById("rollContainer");
  const turnText = document.getElementById("turnText");
  const countdownText = document.getElementById("countdownText");
  const rollBtn = document.getElementById("rollBtn");

  hasRolledThisTurn = true;
  activePlayer = null;
  clearAutoRollTimer();

  if (scorePayload && Array.isArray(scorePayload.scores)) {
    roomData.scorePayload = scorePayload;
    roomData.scores = {};
    scorePayload.scores.forEach((entry) => {
      roomData.scores[entry.playerName] = entry.score;
    });
  }

  if (rollContainer) rollContainer.style.display = "none";
  if (rollBtn) rollBtn.disabled = true;
  if (countdownText) countdownText.textContent = "";
  if (turnText) turnText.textContent = `Winner: ${winner}`;

  if (!waitingArea) return;

  waitingArea.innerHTML = `
    <div class="card-box">
      <h2>${winner} Wins!</h2>
      <p>Character: ${winnerCharacter || "None"}</p>
      <p>Final Score: ${score}</p>
      <p>
        <a href="https://docs.google.com/forms/d/e/1FAIpQLSf4H0W8k-LGMkruN26jHWRSVLEazJabE2b4KXv8SY-RGI4w4w/viewform?usp=dialog"
           class="pink-btn"
           target="_blank">
          UX Testing Form
        </a>
      </p>
    </div>
  `;
});