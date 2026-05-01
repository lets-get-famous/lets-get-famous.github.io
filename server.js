// server.js
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

const rooms = {};
const cardTypes = [
  // CONNECTION
  "What's a version of yourself you've been trying to leave behind?",
  "What's something you're proud of that you never talk about?",
  "What's a compliment you've never forgotten?",
  "What's something you wish you could say to someone who's no longer in your life?",
  "When's the last time you genuinely surprised yourself?",
  "What's one thing you're still figuring out?",
  "What would your 16-year-old self think of you right now?",
  "What's a boundary you're still learning to set?",
  "What's something you need but struggle to ask for?",
  "What's a dream you've quietly given up on?",
  "What's the most important thing you've learned in the last year?",
  "Who has shaped you the most without knowing it?",
  "What's something you're afraid people would think if they really knew you?",
  "What's a conversation you keep putting off having?",
  "What makes you feel most like yourself?",

  // DO OR DRINK
  "Let the group read your most recent DM conversation — or drink",
  "Show the last photo you took, no exceptions — or drink",
  "Tell the group your body count range (within 5) — or drink",
  "Reveal who in the room you'd swipe right on — or drink",
  "Say something you actually think but never say out loud — or drink",
  "Tell the group what you first thought when you met the person across from you — or drink",
  "Text your ex 'lol' right now with no context — or drink",
  "Let the group write one tweet from your account — or drink",
  "Put your phone face-up in the middle of the table for the next 3 rounds — or drink",
  "Change your lock screen to whatever the group picks, for the rest of the night — or drink",
  "Read your most cringe text from the last month out loud — or drink",
  "Show your screen time from this week — or drink",
  "Call someone you've been meaning to reach out to, right now — or drink",
  "Do your most embarrassing impression in front of everyone — or drink",
  "Let someone in the group post a story from your account — or drink",
  "Reveal your most-listened-to song this month — or drink",
  "Tell the group the last time you cried and why — or drink",
  "Share your most recent search history item — or drink",

  // SPICY TRUTH
  "What's a red flag you've ignored because you were attracted to someone?",
  "What's the most immature thing you still do?",
  "What's an opinion you'd never post but definitely hold?",
  "Have you ever had feelings for someone in this room? Nod or drink.",
  "What's the most recent thing you lied about?",
  "What's a version of the truth you've told to make yourself look better?",
  "What's your biggest ick in another person?",
  "Who here do you think would be the worst to date? Be honest.",
  "What's something about yourself you'd never put on a dating profile?",
  "What's a dealbreaker you've made exceptions for?",
  "What's the most selfish thing you've done in a relationship?",
  "What's a rumor you've heard about yourself? Do you think it's true?",
  "What's something you've done that you'd judge someone else for?",
  "What's the shadiest thing you've done in the last month?",
  "What's a secret you've kept from your closest friend?",

  // HOT TAKE
  "What's a movie everyone loves that you think is overrated?",
  "What's a popular food that doesn't deserve the hype?",
  "What's your most unpopular opinion about relationships?",
  "Is cereal a soup? Defend your answer fully.",
  "What's the most useless thing people spend money on?",
  "What's a social rule you think is completely pointless?",
  "What's the worst trend of the last decade?",
  "Is a hot dog a sandwich? Make your case.",
  "What's something everyone pretends to enjoy but secretly hates?",
  "Pick a celebrity who's overrated — and defend it.",
  "What's something legal that should be illegal?",
  "What's something illegal that should be legal?",
  "What's an institution everyone defends but no one actually needs?",
  "What's the worst advice people constantly give?",
  "What's a compliment people give that's actually an insult?",

  // GROUP CHALLENGE
  "Everyone guesses how many people in the room you've kissed. Person furthest off drinks.",
  "Everyone anonymously rates you 1–10 on most likely to become famous. Read them all.",
  "Everyone writes down who they think you'd ghost in a relationship. You read them out.",
  "Who in the room would you call at 3am in a crisis? Point to them.",
  "Rank everyone here by vibe. No ties. No mercy.",
  "Who here do you think is the most mysterious? Go around and vote.",
  "Everyone writes down your 'type' — you guess which one is yours.",
  "Stare contest with the person across from you. Loser drinks.",
  "Whisper something you'd never say sober to the person on your left.",
  "Who in this room do you think you'd be friends with in 20 years? Say it out loud.",

  // WILD CARD
  "What's your price for eating a live bug right now?",
  "What's a conspiracy theory you secretly find convincing?",
  "If aliens landed tomorrow, what's your first move?",
  "What's your zombie apocalypse survival plan in 30 seconds?",
  "If you could hack into one system in the world, what would it be?",
  "How much would someone have to pay you to quit social media forever?",
  "If you had to live as a different person for a year, who?",
  "What's something you'd confess only if you were leaving the country forever?",
  "What's the most illegal thing you've considered that isn't actually that bad?",
  "Would you rather know when you're going to die or how? Explain.",
  "What's the most you've ever spent on something completely unnecessary?",
  "If your life were a reality TV show, what would it be called?",
];

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
  room.turnOrder = room.players.map((p) => p.name);

  if (room.currentTurnIndex >= room.turnOrder.length) {
    room.currentTurnIndex = 0;
  }
}

function emitCurrentTurn(roomCode, room) {
  if (!room.turnOrder.length || room.winner) return;

  const activePlayer = room.turnOrder[room.currentTurnIndex];

  io.to(roomCode).emit("turnChanged", {
    activePlayer,
    currentTurnIndex: room.currentTurnIndex,
    turnOrder: room.turnOrder,
  });

  console.log(`🎯 Turn in ${roomCode}: ${activePlayer}`);
}

function emitScores(roomCode, room) {
  io.to(roomCode).emit("scoreUpdate", buildScorePayload(roomCode, room));
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

function endGame(roomCode, room, winnerName) {
  if (!room || room.winner) return;

  room.winner = winnerName;
  room.gameEndTime = Date.now();
  room.gameStarted = false;

  if (room.countdownInterval) {
    clearInterval(room.countdownInterval);
    room.countdownInterval = null;
  }

  Object.keys(room.cardTimeouts).forEach((playerName) => {
    clearTimeout(room.cardTimeouts[playerName]);
    delete room.cardTimeouts[playerName];
  });

  const summary = buildGameSummary(roomCode, room, winnerName);

  console.log(`\n================ GAME OVER: ${roomCode} ================`);
  console.log(`🏆 Winner: ${summary.winner} (${summary.winnerCharacter})`);
  console.log(`⏱ Duration: ${summary.durationFormatted}`);
  console.log("📊 Leaderboard-ready score payload:");
  console.log(JSON.stringify(buildScorePayload(roomCode, room), null, 2));
  console.log("=======================================================\n");

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

  const isCancelled = Math.random() < 0.325;

  if (isCancelled) {
    const oldScore = room.scores[playerName] || 0;
    const loss = Math.floor(oldScore * 0.15);

    room.scores[playerName] = oldScore - loss;
    room.playerStats[playerName].cancelledCount += 1;
    room.playerStats[playerName].scandalLosses += loss;

    return {
      type: "Scandal",
      text: "💀 SCANDAL! Your score was affected.",
    };
  }

  const type = cardTypes[Math.floor(Math.random() * cardTypes.length)];

  return {
    type,
    text: `${type.toUpperCase()} challenge! Complete it for +50 points 💅`,
  };
}

function nextTurn(roomCode, room) {
  if (!room.turnOrder.length || room.winner) return;

  room.currentTurnIndex = (room.currentTurnIndex + 1) % room.turnOrder.length;
  emitCurrentTurn(roomCode, room);
}

function startCountdown(roomCode, room, seconds = 5) {
  if (room.countdownInterval || room.winner) return;

  room.countdown = seconds;
  io.to(roomCode).emit("countdownUpdate", room.countdown);

  room.countdownInterval = setInterval(() => {
    room.countdown -= 1;
    io.to(roomCode).emit("countdownUpdate", room.countdown);

    if (room.countdown <= 0) {
      clearInterval(room.countdownInterval);
      room.countdownInterval = null;
      room.countdown = null;

      rebuildTurnOrder(room);
      room.currentTurnIndex = 0;
      room.gameStarted = true;
      room.gameStartTime = Date.now();
      room.gameEndTime = null;
      room.winner = null;

      io.to(roomCode).emit("startGame");
      emitScores(roomCode, room);
      emitCurrentTurn(roomCode, room);

      console.log(`🚀 Game started in ${roomCode}`);
    }
  }, 1000);
}

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  let clientType = null;
  let currentRoomCode = null;

  socket.on("identify", (data) => {
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        // ignore bad JSON
      }
    }

    clientType = data?.clientType || "web-player";

    if (clientType === "host" || clientType === "unity-viewer") {
      const roomCode = generateRoomCode();
      rooms[roomCode] = createRoom(socket.id);

      socket.join(roomCode);
      currentRoomCode = roomCode;

      socket.emit("roomCreated", { roomCode });
      console.log(`🏠 Room ${roomCode} created for host ${socket.id}`);
    } else {
      socket.emit("welcome", "Hello Web Player! Enter a room code to join.");
    }
  });

  setTimeout(() => {
    if (!clientType) {
      clientType = "host";

      const roomCode = generateRoomCode();
      rooms[roomCode] = createRoom(socket.id);

      socket.join(roomCode);
      currentRoomCode = roomCode;

      socket.emit("roomCreated", { roomCode });
      console.log(`🏠 Room ${roomCode} auto-created for host ${socket.id}`);
    }
  }, 150);

  socket.on("joinRoom", ({ roomCode, playerName }) => {
    if (!roomCode || !playerName) {
      return socket.emit("joinFailed", "Must provide room code and player name");
    }

    roomCode = roomCode.toUpperCase();
    const room = rooms[roomCode];

    if (!room) {
      return socket.emit("joinFailed", "Room not found");
    }

    if (room.winner) {
      return socket.emit("joinFailed", "Game already ended");
    }

    if (room.players.find((p) => p.name === playerName)) {
      return socket.emit("joinFailed", "Name already taken");
    }

    room.players.push({
      id: socket.id,
      name: playerName,
      character: null,
      locked: false,
    });

    room.scores[playerName] = 0;
    ensurePlayerStats(room, playerName);
    rebuildTurnOrder(room);

    socket.join(roomCode);
    currentRoomCode = roomCode;

    socket.emit("loadGamePage", {
      roomCode,
      playerName,
      roomData: serializeRoom(room, roomCode),
      characterStats,
    });

    io.to(roomCode).emit("updateRoom", serializeRoom(room, roomCode));
    io.to(roomCode).emit("updateCharacterSelection", room.characters);
    emitScores(roomCode, room);

    console.log(`👤 ${playerName} joined ${roomCode}`);
  });

  socket.on("chooseCharacter", ({ roomCode, playerName, character, previous }) => {
    const room = rooms[roomCode];
    if (!room || room.winner) return;

    if (previous && room.characters[previous] === playerName) {
      delete room.characters[previous];
    }

    if (character) {
      if (room.characters[character] && room.characters[character] !== playerName) {
        return socket.emit("characterTaken", character);
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
    if (!room || room.winner) return;

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
    if (!room || room.winner) return;

    const player = room.players.find((p) => p.name === playerName);
    if (player) {
      player.locked = true;
    }

    io.to(roomCode).emit("updateRoom", serializeRoom(room, roomCode));
  });

  socket.on("startCountdown", (roomCode) => {
    const room = rooms[roomCode];
    if (!room || room.winner) return;

    if (room.hostId !== socket.id) {
      console.log(`⚠️ Non-host attempted startCountdown in ${roomCode}`);
      return;
    }

    startCountdown(roomCode, room, 5);
  });

  socket.on("startGame", (roomCode) => {
    const room = rooms[roomCode];
    if (!room || room.winner) return;

    if (room.hostId !== socket.id) {
      console.log(`⚠️ Non-host attempted startGame in ${roomCode}`);
      return;
    }

    rebuildTurnOrder(room);
    room.currentTurnIndex = 0;
    room.gameStarted = true;
    room.gameStartTime = Date.now();
    room.gameEndTime = null;
    room.winner = null;

    io.to(roomCode).emit("startGame");
    emitScores(roomCode, room);
    emitCurrentTurn(roomCode, room);
  });

  socket.on("playerRolled", ({ roomCode, playerName, rollValue }) => {
    const room = rooms[roomCode];
    if (!room || !room.gameStarted || !room.turnOrder.length || room.winner) return;

    const activePlayer = room.turnOrder[room.currentTurnIndex];

    if (playerName !== activePlayer) {
      socket.emit("notYourTurn", { activePlayer });
      return;
    }

    rollValue = Number(rollValue);
    if (Number.isNaN(rollValue)) return;

    ensurePlayerStats(room, playerName);
    room.playerStats[playerName].totalRolls += 1;
    room.playerStats[playerName].totalRollValue += rollValue;
    room.playerStats[playerName].scoreFromRolls += rollValue * 10;

    room.scores[playerName] = (room.scores[playerName] || 0) + rollValue * 10;

    io.to(roomCode).emit("diceRolled", { playerName, rollValue });
    io.to(roomCode).emit("activePlayerRolled", {
      playerName,
      rollValue,
      currentTurnIndex: room.currentTurnIndex,
    });

    emitScores(roomCode, room);

    if (room.scores[playerName] >= 400) {
      endGame(roomCode, room, playerName);
      return;
    }

    const card = drawCard(playerName, room);

    io.to(roomCode).emit("cardDrawn", {
      playerName,
      card,
    });

    if (card.type === "Scandal") {
      emitScores(roomCode, room);

      if (room.scores[playerName] >= 400) {
        endGame(roomCode, room, playerName);
        return;
      }

      setTimeout(() => {
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
    }, 1000000);
  });

  socket.on("cardResponse", ({ roomCode, playerName, accepted }) => {
    const room = rooms[roomCode];
    if (!room || room.winner) return;

    ensurePlayerStats(room, playerName);

    clearTimeout(room.cardTimeouts[playerName]);
    delete room.cardTimeouts[playerName];

    if (accepted) {
      room.playerStats[playerName].acceptedChallenges += 1;
      room.playerStats[playerName].bonusPointsFromChallenges += 50;
      room.scores[playerName] = (room.scores[playerName] || 0) + 50;
    } else {
      room.playerStats[playerName].declinedChallenges += 1;
    }

    emitScores(roomCode, room);

    if (room.scores[playerName] >= 400) {
      endGame(roomCode, room, playerName);
      return;
    }

    nextTurn(roomCode, room);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);

    for (const code in rooms) {
      const room = rooms[code];
      if (!room) continue;

      if (room.hostId === socket.id) {
        io.to(code).emit("roomClosed", "Host disconnected. Room closed.");

        if (room.countdownInterval) {
          clearInterval(room.countdownInterval);
        }

        Object.keys(room.cardTimeouts).forEach((playerName) => {
          clearTimeout(room.cardTimeouts[playerName]);
        });

        delete rooms[code];
        console.log(`🗑 Room ${code} closed because host disconnected`);
        continue;
      }

      const idx = room.players.findIndex((p) => p.id === socket.id);
      if (idx > -1) {
        const [removed] = room.players.splice(idx, 1);

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

        io.to(code).emit("updateRoom", serializeRoom(room, code));
        io.to(code).emit("updateCharacterSelection", room.characters);
        emitScores(code, room);

        if (room.gameStarted && room.turnOrder.length > 0 && !room.winner) {
          emitCurrentTurn(code, room);
        }

        console.log(`👋 Player ${removed.name} removed from ${code}`);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});