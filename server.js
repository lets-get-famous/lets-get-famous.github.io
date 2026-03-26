// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
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

function serializeRoom(room) {
  return {
    hostId: room.hostId,
    players: room.players,
    characters: room.characters,
    turnOrder: room.turnOrder,
    currentTurnIndex: room.currentTurnIndex,
    gameStarted: room.gameStarted,
    scores: room.scores,
    countdown: room.countdown,
  };
}

function rebuildTurnOrder(room) {
  room.turnOrder = room.players.map((p) => p.name);

  if (room.currentTurnIndex >= room.turnOrder.length) {
    room.currentTurnIndex = 0;
  }
}

function emitCurrentTurn(roomCode, room) {
  if (!room.turnOrder.length) return;

  const activePlayer = room.turnOrder[room.currentTurnIndex];

  io.to(roomCode).emit("turnChanged", {
    activePlayer,
    currentTurnIndex: room.currentTurnIndex,
    turnOrder: room.turnOrder,
  });

  console.log(`🎯 Turn in ${roomCode}: ${activePlayer}`);
}

function emitScores(roomCode, room) {
  io.to(roomCode).emit("scoreUpdate", room.scores);
}

const cardTypes = [
  "Do 10 Pushups", "Highfive a stranger", "Tell Jackie she's cool"];

function drawCard(playerName, room) {
  const isCancelled = Math.random() < 0.325;

  if (isCancelled) {
    room.scores[playerName] = Math.floor((room.scores[playerName] || 0) / 2);

    return {
      type: "cancelled",
      text: "💀 CANCELLED! Your score was halved.",
    };
  }

  const type = cardTypes[Math.floor(Math.random() * cardTypes.length)];

  return {
    type,
    text: `${type.toUpperCase()} challenge! Complete it for +5 points 💅`,
  };
}

function nextTurn(roomCode, room) {
  if (!room.turnOrder.length) return;

  room.currentTurnIndex = (room.currentTurnIndex + 1) % room.turnOrder.length;
  emitCurrentTurn(roomCode, room);
}

function startCountdown(roomCode, room, seconds = 5) {
  if (room.countdownInterval) return;

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
    rebuildTurnOrder(room);

    socket.join(roomCode);
    currentRoomCode = roomCode;

    socket.emit("loadGamePage", {
      roomCode,
      playerName,
      roomData: serializeRoom(room),
      characterStats,
    });

    io.to(roomCode).emit("updateRoom", serializeRoom(room));
    io.to(roomCode).emit("updateCharacterSelection", room.characters);
    emitScores(roomCode, room);

    console.log(`👤 ${playerName} joined ${roomCode}`);
  });

  socket.on("chooseCharacter", ({ roomCode, playerName, character, previous }) => {
    const room = rooms[roomCode];
    if (!room) return;

    if (previous && room.characters[previous] === playerName) {
      delete room.characters[previous];
    }

    if (character) {
      if (room.characters[character]) {
        return socket.emit("characterTaken", character);
      }

      room.characters[character] = playerName;

      const player = room.players.find((p) => p.name === playerName);
      if (player) {
        player.character = character;
      }
    }

    io.to(roomCode).emit("updateCharacterSelection", room.characters);
    io.to(roomCode).emit("updateRoom", serializeRoom(room));
    io.to(roomCode).emit("unityCharacterUpdate", {
      playerId: socket.id,
      playerName,
      character,
    });
  });

  socket.on("releaseCharacter", ({ roomCode, character }) => {
    const room = rooms[roomCode];
    if (!room) return;

    delete room.characters[character];

    io.to(roomCode).emit("updateCharacterSelection", room.characters);
    io.to(roomCode).emit("updateRoom", serializeRoom(room));
    io.to(roomCode).emit("unityCharacterUpdate", {
      playerId: null,
      playerName: null,
      character: null,
      released: character,
    });
  });

  socket.on("lockCharacter", ({ roomCode, playerName }) => {
    const room = rooms[roomCode];
    if (!room) return;

    const player = room.players.find((p) => p.name === playerName);
    if (player) {
      player.locked = true;
    }

    io.to(roomCode).emit("updateRoom", serializeRoom(room));
  });

  socket.on("startCountdown", (roomCode) => {
    const room = rooms[roomCode];
    if (!room) return;

    if (room.hostId !== socket.id) {
      console.log(`⚠️ Non-host attempted startCountdown in ${roomCode}`);
      return;
    }

    startCountdown(roomCode, room, 5);
  });

  socket.on("startGame", (roomCode) => {
    const room = rooms[roomCode];
    if (!room) return;

    if (room.hostId !== socket.id) {
      console.log(`⚠️ Non-host attempted startGame in ${roomCode}`);
      return;
    }

    rebuildTurnOrder(room);
    room.currentTurnIndex = 0;
    room.gameStarted = true;

    io.to(roomCode).emit("startGame");
    emitScores(roomCode, room);
    emitCurrentTurn(roomCode, room);
  });

  socket.on("playerRolled", ({ roomCode, playerName, rollValue }) => {
    const room = rooms[roomCode];
    if (!room || !room.gameStarted || !room.turnOrder.length) return;

    const activePlayer = room.turnOrder[room.currentTurnIndex];

    if (playerName !== activePlayer) {
      socket.emit("notYourTurn", { activePlayer });
      return;
    }

    rollValue = Number(rollValue);
    if (Number.isNaN(rollValue)) return;

    // Add main score from dice
    room.scores[playerName] = (room.scores[playerName] || 0) + (rollValue * 10);

    io.to(roomCode).emit("diceRolled", { playerName, rollValue });
    io.to(roomCode).emit("activePlayerRolled", {
      playerName,
      rollValue,
      currentTurnIndex: room.currentTurnIndex,
    });

    // Update score right away so Unity can move immediately
    emitScores(roomCode, room);

    const card = drawCard(playerName, room);

    io.to(roomCode).emit("cardDrawn", {
      playerName,
      card,
    });

    if (card.type === "cancelled") {
      emitScores(roomCode, room);

      setTimeout(() => {
        nextTurn(roomCode, room);
      }, 1200);

      return;
    }

    room.cardTimeouts[playerName] = setTimeout(() => {
      io.to(roomCode).emit("cardAutoDecline", { playerName });
      emitScores(roomCode, room);
      delete room.cardTimeouts[playerName];
      nextTurn(roomCode, room);
    }, 10000);
  });

  socket.on("cardResponse", ({ roomCode, playerName, accepted }) => {
    const room = rooms[roomCode];
    if (!room) return;

    clearTimeout(room.cardTimeouts[playerName]);
    delete room.cardTimeouts[playerName];

    if (accepted) {
      room.scores[playerName] = (room.scores[playerName] || 0) + 5;
    }

    emitScores(roomCode, room);
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

        rebuildTurnOrder(room);

        io.to(code).emit("updateRoom", serializeRoom(room));
        io.to(code).emit("updateCharacterSelection", room.characters);
        emitScores(code, room);

        if (room.gameStarted && room.turnOrder.length > 0) {
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

