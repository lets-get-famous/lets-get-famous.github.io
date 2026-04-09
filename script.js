// script.js
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

socket.on("connect", () => {
  console.log("Connected:", socket.id);
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
    alert("Enter room code and name!");
    return;
  }

  socket.emit("joinRoom", { roomCode, playerName });
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

function showCharacterSelection() {
  const app = document.getElementById("app");

  app.innerHTML = `
    <h1 class="title">Choose Your Character</h1>

    <div id="statusArea">
      <p id="roomText"><strong>Room:</strong> ${roomCode}</p>
      <p id="turnText">Waiting for the host to start...</p>
      <p id="countdownText"></p>
      <p id="scoreText"></p>
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
<<<<<<< HEAD
  updateScoreText(roomData.scorePayload);
=======
  updateScoreText({});
>>>>>>> parent of d539f4ea (Fix some server side with player win components)
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
      waitingArea.innerHTML = `<p id="waitingText">You’re locked in! Waiting for the game to start...</p>`;
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

  (roomData.players || []).forEach((p, index) => {
    const li = document.createElement("li");
    const turnBadge = index === 0 ? " ⭐ Player 1" : "";
    li.textContent = p.name + (p.character ? ` - ${p.character}` : "") + turnBadge;
    list.appendChild(li);
  });
}

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
<<<<<<< HEAD
  roomData.scores = data.scores || {};
  roomData.scorePayload = data.scorePayload || roomData.scorePayload || {
    roomCode,
    updatedAt: "",
    scores: [],
  };

  updatePlayerList();
  updateCharacterButtons();
  updateScoreText(roomData.scorePayload);
=======
  updatePlayerList();
  updateCharacterButtons();
>>>>>>> parent of d539f4ea (Fix some server side with player win components)
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
  alert(msg || "Room closed.");
  location.reload();
});

socket.on("startGame", () => {
  const turnText = document.getElementById("turnText");
  const countdownText = document.getElementById("countdownText");
  const waitingArea = document.getElementById("waitingArea");

  if (turnText) turnText.textContent = "Game started!";
  if (countdownText) countdownText.textContent = "";
  if (waitingArea) waitingArea.innerHTML = "";
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

socket.on("turnChanged", (data) => {
  activePlayer = data.activePlayer;
  hasRolledThisTurn = false;
  updateTurnUI();

  const waitingArea = document.getElementById("waitingArea");
  if (waitingArea && playerName !== activePlayer) {
    waitingArea.innerHTML = `<p id="waitingText">Waiting for ${activePlayer}...</p>`;
  }
});

socket.on("diceRolled", ({ playerName: rolledBy, rollValue }) => {
  console.log(`${rolledBy} rolled ${rollValue}`);
});

socket.on("notYourTurn", ({ activePlayer }) => {
  alert(`It is not your turn. Waiting for ${activePlayer}.`);
});

socket.on("cardDrawn", ({ playerName: target, card }) => {
  if (playerName !== target) return;

  const waitingArea = document.getElementById("waitingArea");
  if (!waitingArea) return;

  if (card.type === "scandal") {
    waitingArea.innerHTML = `
      <div class="card-box">
        <h3>SCANDAL</h3>
        <p>${card.text}</p>
      </div>
    `;
    return;
  }

  waitingArea.innerHTML = `
    <div class="card-box">
      <h3>${card.type.toUpperCase()}</h3>
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
      waitingArea.innerHTML = `<p id="waitingText">Accepted! +50 points 💅</p>`;
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
    waitingArea.innerHTML = `<p id="waitingText">Time’s up! Auto-declined.</p>`;
  }
});

socket.on("scoreUpdate", (payload) => {
  console.log("Score payload:", payload);

  if (!payload || !Array.isArray(payload.scores)) return;

  roomData.scorePayload = payload;

  roomData.scores = {};
  payload.scores.forEach((entry) => {
    roomData.scores[entry.playerName] = entry.score;
  });

  updateScoreText(roomData.scorePayload);
});

<<<<<<< HEAD
socket.on("gameOver", ({ winner, winnerCharacter, score, summary, scorePayload }) => {
  console.log("🏁 GAME OVER", { winner, winnerCharacter, score, summary, scorePayload });
=======
// After updating scores
const WIN_SCORE = 400;
>>>>>>> parent of d539f4ea (Fix some server side with player win components)

for (const player in room.scores) {
  if (room.scores[player] >= WIN_SCORE) {
    io.to(roomCode).emit("gameOver", {
      winner: player,
      score: room.scores[player]
    });

<<<<<<< HEAD
  hasRolledThisTurn = true;
  activePlayer = null;

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
  if (turnText) turnText.textContent = `🎉 ${winner} wins!`;

  if (!waitingArea) return;

  let playersHtml = "";

  if (summary?.players) {
    playersHtml = summary.players
      .map(
        (p) => `
          <div style="margin-bottom: 12px; padding: 10px; border: 1px solid #ccc; border-radius: 10px;">
            <p><strong>Name:</strong> ${p.playerName}</p>
            <p><strong>Character:</strong> ${p.character || "None"}</p>
            <p><strong>Final Score:</strong> ${p.finalScore ?? 0}</p>
            <p><strong>Accepted Challenges:</strong> ${p.acceptedChallenges ?? 0}</p>
            <p><strong>Declined Challenges:</strong> ${p.declinedChallenges ?? 0}</p>
            <p><strong>Cancelled / Scandals:</strong> ${p.cancelledCount ?? 0}</p>
            <p><strong>Total Rolls:</strong> ${p.totalRolls ?? 0}</p>
            <p><strong>Total Roll Value:</strong> ${p.totalRollValue ?? 0}</p>
            <p><strong>Score From Rolls:</strong> ${p.scoreFromRolls ?? 0}</p>
            <p><strong>Bonus From Challenges:</strong> ${p.bonusPointsFromChallenges ?? 0}</p>
            <p><strong>Points Lost From Scandals:</strong> ${p.scandalLosses ?? 0}</p>
          </div>
        `
      )
      .join("");
=======
    // Optional: stop the game / reset room
    room.gameActive = false;
    return;
>>>>>>> parent of d539f4ea (Fix some server side with player win components)
  }
}


