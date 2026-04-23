const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

const WIN_SCORE = 400;
const ROLL_POINTS_MULTIPLIER = 10;
const CHALLENGE_REWARD = 100;
const CARD_RESPONSE_TIME = 15000; // 15 seconds
const SCANDAL_PERCENT = 0.15;
const SCANDAL_CHANCE = 0.325;

const characterStats = {
  Daria: { profession: "Game Designer", luck: 4, talent: 3, networking: 2, wealth: 1 },
  Tony: { profession: "Fashion Designer/Icon", luck: 3, talent: 2, networking: 4, wealth: 1 },
  Logan: { profession: "Reality TV Star", luck: 3, talent: 1, networking: 4, wealth: 2 },
  Raeann: { profession: "Actress", luck: 2, talent: 1, networking: 4, wealth: 3 },
  Paige: { profession: "Writer", luck: 3, talent: 2, networking: 1, wealth: 4 },
  Rami: { profession: "Skater", luck: 1, talent: 4, networking: 3, wealth: 2 },
  Tegan: { profession: "Singer", luck: 4, talent: 1, networking: 2, wealth: 3 },
  Adam: { profession: "Streamer", luck: 1, talent: 3, networking: 4, wealth: 2 },
  Sophie: { profession: "Ballerina", luck: 2, talent: 4, networking: 1, wealth: 3 },
  Aileen: { profession: "Comedian", luck: 2, talent: 4, networking: 3, wealth: 1 },
  Bailey: { profession: "DJ", luck: 1, talent: 2, networking: 3, wealth: 4 },
};

const cardTypes = [
  "Do 10 pushups",
  "Hold a plank for 30 seconds",
  "Do your best moonwalk",
  "Speak in an accent for the next 3 rounds",
  "Do 10 jumping jacks while humming a song",
  "Balance a book on your head for 1 minute",
  "Do your best robot dance",
  "High five every person in the room",
  "Give someone a genuine compliment",
  "Tell the person to your left why they're awesome",
  "Do your best impression of someone in the room",
  "Talk like a pirate for the next 2 rounds",
  "Narrate everything you do in third person for 3 minutes",
  "Speak only in questions for the next round",
  "Pretend you're being interviewed on a red carpet",
  "Give a dramatic 30-second TED Talk on a random object",
  "Do your best impression of a news anchor",
  "Pretend you're a villain explaining your evil plan",
  "Announce everything loudly like a sports commentator",
  "What's your favorite conspiracy theory?",
  "If aliens landed tomorrow, what's your first move?",
  "What's a movie everyone loves that you hate?",
  "What's a popular food you think is overrated?",
  "Is cereal a soup? Defend your answer",
  "What's the worst trend of the last 10 years?",
  "Sing the chorus of any song chosen by the group",
  "Act out a movie scene without using words",
  "Do stand-up comedy for 60 seconds",
  "Lip sync to a song the group picks",
  "Freestyle rap for 20 seconds",
  "Do an infomercial for an object in the room",
  "Impersonate a famous historical figure",
  "Deliver a wedding toast for the person across from you",
  "Do a yoga pose and hold it for 30 seconds",
  "Stare contest with the person across from you",
  "Say the alphabet backwards as fast as you can",
  "Name 5 capitals in 10 seconds",
  "Thumb war with the person to your right",
  "Rock paper scissors best of 3 against someone",
  "Name 10 animals in 10 seconds",
];

const rooms = {};

function createRoom(hostId) {
  return {
    hostId,
    players: [],
    characters: {},
    turnOrder: [],
    currentTurnIndex: 0,
    gameStarted: false,
    scores: {},
    cardTimeouts: {},
    countdown: null,
    countdownInterval: null,
    gameStartTime: null,
    gameEndTime: null,
    winner: null,
    playerStats: {},
  };
}

function generateRoomCode() {
  const chars = "ABCDEFGHJLMNPQRSTUVWXYZ307";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function ensurePlayerStats(room, playerName) {
  if (!room.playerStats[playerName]) {
    room.playerStats[playerName] = {
      acceptedChallenges: 0,
      declinedChallenges: 0,
      cancelledCount: 0,
      totalRolls: 0,
      totalRollValue: 0,
      scoreFromRolls: 0,
      bonusPointsFromChallenges: 0,
      scandalLosses: 0,
    };
  }
}

function buildScorePayload(roomCode, room) {
  return {
    roomCode,
    updatedAt: new Date().toISOString(),
    scores: room.players.map((player) => {
      const stats = room.playerStats[player.name] || {};
      return {
        playerName: player.name,
        character: player.character || "None",
        score: room.scores[player.name] || 0,
        acceptedChallenges: stats.acceptedChallenges || 0,
        declinedChallenges: stats.declinedChallenges || 0,
        cancelledCount: stats.cancelledCount || 0,
        totalRolls: stats.totalRolls || 0,
        totalRollValue: stats.totalRollValue || 0,
        scoreFromRolls: stats.scoreFromRolls || 0,
        bonusPointsFromChallenges: stats.bonusPointsFromChallenges || 0,
        scandalLosses: stats.scandalLosses || 0,
      };
    }),
  };
}

function serializeRoom(room, roomCode = "") {
  return {
    hostId: room.hostId,
    players: room.players,
    characters: room.characters,
    turnOrder: room.turnOrder,
    currentTurnIndex: room.currentTurnIndex,
    gameStarted: room.gameStarted,
    scores: room.scores,
    scorePayload: roomCode ? buildScorePayload(roomCode, room) : null,
    countdown: room.countdown,
    winner: room.winner,
  };
}

function rebuildTurnOrder(room) {
  const currentActivePlayer = room.turnOrder[room.currentTurnIndex] || null;
  room.turnOrder = room.players.map((p) => p.name);

  if (!room.turnOrder.length) {
    room.currentTurnIndex = 0;
    return;
  }

  const preservedIndex = currentActivePlayer
    ? room.turnOrder.indexOf(currentActivePlayer)
    : -1;

  room.currentTurnIndex = preservedIndex >= 0 ? preservedIndex : 0;
}

function emitScores(roomCode, room) {
  io.to(roomCode).emit("scoreUpdate", buildScorePayload(roomCode, room));
}

function emitCurrentTurn(roomCode, room) {
  if (!room.turnOrder.length || room.winner) return;

  const activePlayer = room.turnOrder[room.currentTurnIndex];

  io.to(roomCode).emit("turnChanged", {
    activePlayer,
    currentTurnIndex: room.currentTurnIndex,
    turnOrder: room.turnOrder,
  });
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function getPlayerCharacter(room, playerName) {
  const player = room.players.find((p) => p.name === playerName);
  return player?.character || "None";
}

function buildGameSummary(roomCode, room, winnerName) {
  const endTime = room.gameEndTime || Date.now();
  const startTime = room.gameStartTime || endTime;
  const durationMs = endTime - startTime;

  const players = room.players.map((p) => {
    const stats = room.playerStats[p.name] || {};
    return {
      playerName: p.name,
      character: p.character || "None",
      finalScore: room.scores[p.name] || 0,
      acceptedChallenges: stats.acceptedChallenges || 0,
      declinedChallenges: stats.declinedChallenges || 0,
      cancelledCount: stats.cancelledCount || 0,
      totalRolls: stats.totalRolls || 0,
      totalRollValue: stats.totalRollValue || 0,
      scoreFromRolls: stats.scoreFromRolls || 0,
      bonusPointsFromChallenges: stats.bonusPointsFromChallenges || 0,
      scandalLosses: stats.scandalLosses || 0,
    };
  });

  return {
    roomCode,
    winner: winnerName,
    winnerCharacter: getPlayerCharacter(room, winnerName),
    gameStartedAt: new Date(startTime).toISOString(),
    gameEndedAt: new Date(endTime).toISOString(),
    durationMs,
    durationFormatted: formatDuration(durationMs),
    players,
  };
}

function clearRoomCountdown(room) {
  if (room.countdownInterval) {
    clearInterval(room.countdownInterval);
    room.countdownInterval = null;
  }
  room.countdown = null;
}

function clearAllCardTimeouts(room) {
  Object.keys(room.cardTimeouts).forEach((playerName) => {
    clearTimeout(room.cardTimeouts[playerName]);
    delete room.cardTimeouts[playerName];
  });
}

function endGame(roomCode, room, winnerName) {
  if (!room || room.winner) return;

  room.winner = winnerName;
  room.gameEndTime = Date.now();
  room.gameStarted = false;

  clearRoomCountdown(room);
  clearAllCardTimeouts(room);

  const summary = buildGameSummary(roomCode, room, winnerName);

  io.to(roomCode).emit("gameOver", {
    winner: winnerName,
    winnerCharacter: summary.winnerCharacter,
    score: room.scores[winnerName] || 0,
    summary,
    scorePayload: buildScorePayload(roomCode, room),
  });
}

function drawCard(playerName, room) {
  ensurePlayerStats(room, playerName);

  const isScandal = Math.random() < SCANDAL_CHANCE;

  if (isScandal) {
    const oldScore = room.scores[playerName] || 0;
    const loss = Math.floor(oldScore * SCANDAL_PERCENT);

    room.scores[playerName] = Math.max(0, oldScore - loss);
    room.playerStats[playerName].cancelledCount += 1;
    room.playerStats[playerName].scandalLosses += loss;

    return {
      type: "Scandal",
      text: `💀 Scandal! You lost ${loss} points.`,
    };
  }

  const prompt = cardTypes[Math.floor(Math.random() * cardTypes.length)];

  return {
    type: "Challenge",
    text: `${prompt} for +${CHALLENGE_REWARD} points`,
  };
}

function nextTurn(roomCode, room) {
  if (!room.turnOrder.length || room.winner) return;

  room.currentTurnIndex = (room.currentTurnIndex + 1) % room.turnOrder.length;
  emitCurrentTurn(roomCode, room);
}

function maybeEndGame(roomCode, room, playerName) {
  if ((room.scores[playerName] || 0) >= WIN_SCORE) {
    endGame(roomCode, room, playerName);
    return true;
  }
  return false;
}

function startCountdown(roomCode, room, seconds = 5) {
  if (room.countdownInterval || room.winner || room.gameStarted) return;

  room.countdown = seconds;
  io.to(roomCode).emit("countdownUpdate", room.countdown);

  room.countdownInterval = setInterval(() => {
    room.countdown -= 1;

    if (room.countdown > 0) {
      io.to(roomCode).emit("countdownUpdate", room.countdown);
      return;
    }

    clearRoomCountdown(room);

    rebuildTurnOrder(room);
    room.currentTurnIndex = 0;
    room.gameStarted = true;
    room.gameStartTime = Date.now();
    room.gameEndTime = null;
    room.winner = null;

    io.to(roomCode).emit("countdownUpdate", null);
    io.to(roomCode).emit("startGame");
    emitScores(roomCode, room);
    emitCurrentTurn(roomCode, room);
  }, 1000);
}

function getActivePlayer(room) {
  if (!room.turnOrder.length) return null;
  return room.turnOrder[room.currentTurnIndex];
}

function removePlayerFromRoom(roomCode, room, socketId) {
  const leavingIndex = room.players.findIndex((p) => p.id === socketId);
  if (leavingIndex === -1) return;

  const removed = room.players[leavingIndex];
  const activePlayerBefore = getActivePlayer(room);

  room.players.splice(leavingIndex, 1);

  for (const char in room.characters) {
    if (room.characters[char] === removed.name) {
      delete room.characters[char];
    }
  }

  clearTimeout(room.cardTimeouts[removed.name]);
  delete room.cardTimeouts[removed.name];
  delete room.scores[removed.name];
  delete room.playerStats[removed.name];

  rebuildTurnOrder(room);

  if (room.gameStarted && !room.winner && room.turnOrder.length > 0) {
    if (activePlayerBefore === removed.name) {
      if (room.currentTurnIndex >= room.turnOrder.length) {
        room.currentTurnIndex = 0;
      }
    }
  }

  io.to(roomCode).emit("updateRoom", serializeRoom(room, roomCode));
  io.to(roomCode).emit("updateCharacterSelection", room.characters);
  emitScores(roomCode, room);

  if (room.gameStarted && !room.winner && room.turnOrder.length > 0) {
    emitCurrentTurn(roomCode, room);
  }
}

io.on("connection", (socket) => {
  let clientType = null;
  let currentRoomCode = null;

  socket.on("identify", (data) => {
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        return;
      }
    }

    clientType = data?.clientType || "web-player";

    if (clientType === "host" || clientType === "unity-viewer") {
      const roomCode = generateRoomCode();
      rooms[roomCode] = createRoom(socket.id);

      socket.join(roomCode);
      currentRoomCode = roomCode;

      socket.emit("roomCreated", { roomCode });
    } else {
      socket.emit("welcome", "Enter a room code to join.");
    }
  });

  socket.on("joinRoom", ({ roomCode, playerName }) => {
    if (!roomCode || !playerName) {
      socket.emit("joinFailed", "Must provide room code and player name");
      return;
    }

    roomCode = roomCode.toUpperCase();
    const room = rooms[roomCode];

    if (!room) {
      socket.emit("joinFailed", "Room not found");
      return;
    }

    if (room.winner) {
      socket.emit("joinFailed", "Game already ended");
      return;
    }

    if (room.players.find((p) => p.name === playerName)) {
      socket.emit("joinFailed", "Name already taken");
      return;
    }

    room.players.push({
      id: socket.id,
      name: playerName,
      character: null,
      locked: false,
    });

    room.scores[playerName] = 0;
    ensurePlayerStats(room, playerName);

    socket.join(roomCode);
    currentRoomCode = roomCode;

    rebuildTurnOrder(room);

    socket.emit("loadGamePage", {
      roomCode,
      playerName,
      roomData: serializeRoom(room, roomCode),
      characterStats,
    });

    io.to(roomCode).emit("updateRoom", serializeRoom(room, roomCode));
    io.to(roomCode).emit("updateCharacterSelection", room.characters);
    emitScores(roomCode, room);
  });

  socket.on("chooseCharacter", ({ roomCode, playerName, character, previous }) => {
    const room = rooms[roomCode];
    if (!room || room.winner || room.gameStarted) return;

    if (previous && room.characters[previous] === playerName) {
      delete room.characters[previous];
    }

    if (character) {
      if (room.characters[character] && room.characters[character] !== playerName) {
        socket.emit("characterTaken", character);
        return;
      }

      room.characters[character] = playerName;

      const player = room.players.find((p) => p.name === playerName);
      if (player) {
        player.character = character;
      }
    }

    io.to(roomCode).emit("updateCharacterSelection", room.characters);
    io.to(roomCode).emit("updateRoom", serializeRoom(room, roomCode));
    io.to(roomCode).emit("unityCharacterUpdate", {
      playerId: socket.id,
      playerName,
      character,
    });
  });

  socket.on("releaseCharacter", ({ roomCode, character }) => {
    const room = rooms[roomCode];
    if (!room || room.winner || room.gameStarted) return;

    const playerName = room.characters[character];
    delete room.characters[character];

    if (playerName) {
      const player = room.players.find((p) => p.name === playerName);
      if (player) {
        player.character = null;
      }
    }

    io.to(roomCode).emit("updateCharacterSelection", room.characters);
    io.to(roomCode).emit("updateRoom", serializeRoom(room, roomCode));
    io.to(roomCode).emit("unityCharacterUpdate", {
      playerId: null,
      playerName: null,
      character: null,
      released: character,
    });
  });

  socket.on("lockCharacter", ({ roomCode, playerName }) => {
    const room = rooms[roomCode];
    if (!room || room.winner || room.gameStarted) return;

    const player = room.players.find((p) => p.name === playerName);
    if (player) {
      player.locked = true;
    }

    io.to(roomCode).emit("updateRoom", serializeRoom(room, roomCode));
  });

  socket.on("startCountdown", (roomCode) => {
    const room = rooms[roomCode];
    if (!room || room.winner || room.gameStarted) return;
    if (room.hostId !== socket.id) return;
    if (room.players.length < 2) return;

    startCountdown(roomCode, room, 5);
  });

  socket.on("startGame", (roomCode) => {
    const room = rooms[roomCode];
    if (!room || room.winner || room.gameStarted) return;
    if (room.hostId !== socket.id) return;
    if (room.players.length < 2) return;

    rebuildTurnOrder(room);
    room.currentTurnIndex = 0;
    room.gameStarted = true;
    room.gameStartTime = Date.now();
    room.gameEndTime = null;
    room.winner = null;

    io.to(roomCode).emit("countdownUpdate", null);
    io.to(roomCode).emit("startGame");
    emitScores(roomCode, room);
    emitCurrentTurn(roomCode, room);
  });

  socket.on("playerRolled", ({ roomCode, playerName, rollValue }) => {
    const room = rooms[roomCode];
    if (!room || !room.gameStarted || room.winner || !room.turnOrder.length) return;

    const activePlayer = getActivePlayer(room);
    if (playerName !== activePlayer) {
      socket.emit("notYourTurn", { activePlayer });
      return;
    }

    rollValue = Number(rollValue);
    if (Number.isNaN(rollValue) || rollValue < 1 || rollValue > 6) return;

    ensurePlayerStats(room, playerName);

    room.playerStats[playerName].totalRolls += 1;
    room.playerStats[playerName].totalRollValue += rollValue;
    room.playerStats[playerName].scoreFromRolls += rollValue * ROLL_POINTS_MULTIPLIER;

    room.scores[playerName] =
      (room.scores[playerName] || 0) + rollValue * ROLL_POINTS_MULTIPLIER;

    io.to(roomCode).emit("diceRolled", { playerName, rollValue });

    io.to(roomCode).emit("activePlayerRolled", {
      playerName,
      rollValue,
      currentTurnIndex: room.currentTurnIndex,
    });

    emitScores(roomCode, room);

    if (maybeEndGame(roomCode, room, playerName)) return;

    const card = drawCard(playerName, room);

    io.to(roomCode).emit("cardDrawn", {
      playerName,
      card,
    });

    if (card.type === "Scandal") {
      emitScores(roomCode, room);

      if (maybeEndGame(roomCode, room, playerName)) return;

      setTimeout(() => {
        if (!rooms[roomCode] || room.winner) return;
        nextTurn(roomCode, room);
      }, 1200);

      return;
    }

    room.cardTimeouts[playerName] = setTimeout(() => {
      if (!rooms[roomCode] || room.winner) return;

      ensurePlayerStats(room, playerName);
      room.playerStats[playerName].declinedChallenges += 1;

      io.to(roomCode).emit("cardAutoDecline", { playerName });
      emitScores(roomCode, room);

      delete room.cardTimeouts[playerName];
      nextTurn(roomCode, room);
    }, CARD_RESPONSE_TIME);
  });

  socket.on("cardResponse", ({ roomCode, playerName, accepted }) => {
    const room = rooms[roomCode];
    if (!room || room.winner || !room.gameStarted) return;

    ensurePlayerStats(room, playerName);

    clearTimeout(room.cardTimeouts[playerName]);
    delete room.cardTimeouts[playerName];

    if (accepted) {
      room.playerStats[playerName].acceptedChallenges += 1;
      room.playerStats[playerName].bonusPointsFromChallenges += CHALLENGE_REWARD;
      room.scores[playerName] = (room.scores[playerName] || 0) + CHALLENGE_REWARD;
    } else {
      room.playerStats[playerName].declinedChallenges += 1;
    }

    emitScores(roomCode, room);

    if (maybeEndGame(roomCode, room, playerName)) return;

    nextTurn(roomCode, room);
  });

  socket.on("disconnect", () => {
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      if (!room) continue;

      if (room.hostId === socket.id) {
        io.to(roomCode).emit("roomClosed", "Host disconnected. Room closed.");
        clearRoomCountdown(room);
        clearAllCardTimeouts(room);
        delete rooms[roomCode];
        continue;
      }

      removePlayerFromRoom(roomCode, room, socket.id);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});