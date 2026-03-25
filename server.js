// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// --------------------
// Game Data
// --------------------
const characterStats = {
  "Daria": { profession: "Game Designer", luck: 4, talent: 3, networking: 2, wealth: 1 },
  "Tony": { profession: "Fashion Designer/Icon", luck: 3, talent: 2, networking: 4, wealth: 1 },
  "Logan": { profession: "Reality TV Star", luck: 3, talent: 1, networking: 4, wealth: 2 },
  "Raeann": { profession: "Actress", luck: 2, talent: 1, networking: 4, wealth: 3 },
  "Paige": { profession: "Writer", luck: 3, talent: 2, networking: 1, wealth: 4 },
  "Rami": { profession: "Skater", luck: 1, talent: 4, networking: 3, wealth: 2 },
  "Tegan": { profession: "Singer", luck: 4, talent: 1, networking: 2, wealth: 3 },
  "Adam": { profession: "Streamer", luck: 1, talent: 3, networking: 4, wealth: 2 },
  "Sophie": { profession: "Ballerina", luck: 2, talent: 4, networking: 1, wealth: 3 },
  "Aileen": { profession: "Comedian", luck: 2, talent: 4, networking: 3, wealth: 1 },
  "Bailey": { profession: "DJ", luck: 1, talent: 2, networking: 3, wealth: 4 },
};

const rooms = {};

// --------------------
// Helpers
// --------------------
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
    countdownInterval: null
  };
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJLMNPQRSTUVWXYZ307';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function serializeRoom(room) {
  return {
    hostId: room.hostId,
    players: room.players,
    characters: room.characters,
    turnOrder: room.turnOrder,
    currentTurnIndex: room.currentTurnIndex,
    gameStarted: room.gameStarted,
    scores: room.scores,
    countdown: room.countdown
  };
}

function rebuildTurnOrder(room) {
  room.turnOrder = room.players.map(p => p.name);
  if (room.currentTurnIndex >= room.turnOrder.length) {
    room.currentTurnIndex = 0;
  }
}

function emitCurrentTurn(roomCode, room) {
  if (!room.turnOrder.length) return;

  const activePlayer = room.turnOrder[room.currentTurnIndex];

  io.to(roomCode).emit('turnChanged', {
    activePlayer,
    currentTurnIndex: room.currentTurnIndex,
    turnOrder: room.turnOrder
  });

  console.log(`🎯 Turn: ${activePlayer}`);
}

// --------------------
// CARD SYSTEM
// --------------------
const cardTypes = ["truth", "dare", "drink"];

function drawCard(playerName, room) {
  const isCancelled = Math.random() < 0.15;

  if (isCancelled) {
    room.scores[playerName] = Math.floor((room.scores[playerName] || 0) / 2);

    return {
      type: "cancelled",
      text: "💀 CANCELLED! Your score was halved."
    };
  }

  const type = cardTypes[Math.floor(Math.random() * cardTypes.length)];

  return {
    type,
    text: `${type.toUpperCase()} challenge! Complete it for +5 points 💅`
  };
}

// --------------------
// Countdown → Start Game
// --------------------
function startCountdown(roomCode, room, seconds = 5) {
  if (room.countdownInterval) return;

  room.countdown = seconds;

  io.to(roomCode).emit("countdownUpdate", room.countdown);

  room.countdownInterval = setInterval(() => {
    room.countdown--;
    io.to(roomCode).emit("countdownUpdate", room.countdown);

    if (room.countdown <= 0) {
      clearInterval(room.countdownInterval);
      room.countdownInterval = null;
      room.countdown = null;

      rebuildTurnOrder(room);
      room.currentTurnIndex = 0;
      room.gameStarted = true;

      io.to(roomCode).emit("startGame");
      emitCurrentTurn(roomCode, room);

      console.log(`🚀 Game started in ${roomCode}`);
    }
  }, 1000);
}

// --------------------
// Socket
// --------------------
io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  let currentRoomCode = null;

  socket.on("identify", (data) => {
    if (data.clientType === "host") {
      const roomCode = generateRoomCode();
      rooms[roomCode] = createRoom(socket.id);

      socket.join(roomCode);
      currentRoomCode = roomCode;

      socket.emit("roomCreated", { roomCode });
    }
  });

  socket.on("joinRoom", ({ roomCode, playerName }) => {
    roomCode = roomCode.toUpperCase();
    const room = rooms[roomCode];
    if (!room) return socket.emit("joinFailed", "Room not found");

    if (room.players.find(p => p.name === playerName)) {
      return socket.emit("joinFailed", "Name taken");
    }

    room.players.push({
      id: socket.id,
      name: playerName,
      character: null,
      locked: false
    });

    room.scores[playerName] = 0;

    rebuildTurnOrder(room);

    socket.join(roomCode);
    currentRoomCode = roomCode;

    socket.emit("loadGamePage", {
      roomCode,
      playerName,
      roomData: serializeRoom(room),
      characterStats
    });

    io.to(roomCode).emit("updateRoom", serializeRoom(room));
    io.to(roomCode).emit("updateCharacterSelection", room.characters);
  });

  socket.on("lockCharacter", ({ roomCode, playerName }) => {
    const room = rooms[roomCode];
    const player = room.players.find(p => p.name === playerName);
    if (player) player.locked = true;

    io.to(roomCode).emit("updateRoom", serializeRoom(room));
  });

  socket.on("startCountdown", (roomCode) => {
    const room = rooms[roomCode];
    if (!room) return;

    if (room.hostId !== socket.id) return;

    startCountdown(roomCode, room);
  });

  // --------------------
  // TURN ROLL
  // --------------------
  socket.on("playerRolled", ({ roomCode, playerName, rollValue }) => {
    const room = rooms[roomCode];
    if (!room || !room.gameStarted) return;

    const activePlayer = room.turnOrder[room.currentTurnIndex];

    if (playerName !== activePlayer) {
      socket.emit("notYourTurn", { activePlayer });
      return;
    }

    rollValue = Number(rollValue);

    io.to(roomCode).emit("diceRolled", { playerName, rollValue });

    io.to(roomCode).emit("activePlayerRolled", {
      playerName,
      rollValue
    });

    // DRAW CARD
    const card = drawCard(playerName, room);

    io.to(roomCode).emit("cardDrawn", {
      playerName,
      card
    });

    // AUTO DECLINE TIMER
    room.cardTimeouts[playerName] = setTimeout(() => {
      io.to(roomCode).emit("cardAutoDecline", { playerName });

      nextTurn(roomCode, room);
    }, 10000);
  });

  // --------------------
  // CARD RESPONSE
  // --------------------
  socket.on("cardResponse", ({ roomCode, playerName, accepted }) => {
    const room = rooms[roomCode];
    if (!room) return;

    clearTimeout(room.cardTimeouts[playerName]);

    if (accepted) {
      room.scores[playerName] += 5;
    }

    io.to(roomCode).emit("scoreUpdate", room.scores);

    nextTurn(roomCode, room);
  });

  function nextTurn(roomCode, room) {
    room.currentTurnIndex =
      (room.currentTurnIndex + 1) % room.turnOrder.length;

    emitCurrentTurn(roomCode, room);
  }

  socket.on("disconnect", () => {
    for (const code in rooms) {
      const room = rooms[code];

      if (room.hostId === socket.id) {
        io.to(code).emit("roomClosed");
        delete rooms[code];
        continue;
      }

      const idx = room.players.findIndex(p => p.id === socket.id);
      if (idx > -1) {
        const removed = room.players.splice(idx, 1)[0];

        delete room.scores[removed.name];

        rebuildTurnOrder(room);

        io.to(code).emit("updateRoom", serializeRoom(room));

        if (room.gameStarted && room.turnOrder.length > 0) {
          emitCurrentTurn(code, room);
        }
      }
    }
  });
});

server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});