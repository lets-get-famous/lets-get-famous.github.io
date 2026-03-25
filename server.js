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
app.get('/game.html', (req, res) => res.sendFile(path.join(__dirname, 'game.html')));

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

function createRoom(hostId) {
  return {
    hostId,
    players: [],
    playerRolls: {},
    characters: {},
    countdown: null,
    countdownInterval: null,

    turnOrder: [],
    currentTurnIndex: 0,
    gameStarted: false
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
  if (!room) return null;

  return {
    hostId: room.hostId,
    players: room.players,
    characters: room.characters,
    playerRolls: room.playerRolls,
    countdown: room.countdown,
    turnOrder: room.turnOrder,
    currentTurnIndex: room.currentTurnIndex,
    gameStarted: room.gameStarted
  };
}

function emitCurrentTurn(roomCode, room) {
  if (!room || !room.turnOrder.length) return;

  const activePlayer = room.turnOrder[room.currentTurnIndex];

  io.to(roomCode).emit('turnChanged', {
    activePlayer,
    currentTurnIndex: room.currentTurnIndex,
    turnOrder: room.turnOrder
  });

  console.log(`🎯 Current turn in ${roomCode}: ${activePlayer}`);
}

function startCountdown(roomCode, room, initialSeconds = 10) {
  if (!room) return;
  if (room.countdownInterval) {
    console.log(`⏳ Countdown already running for ${roomCode}`);
    return;
  }

  console.log(`⏳ Starting countdown for ${roomCode} (${initialSeconds}s)`);
  room.countdown = initialSeconds;
  io.to(roomCode).emit('countdownUpdate', room.countdown);

  room.countdownInterval = setInterval(() => {
    room.countdown -= 1;
    io.to(roomCode).emit('countdownUpdate', room.countdown);

    if (room.countdown <= 0) {
      clearInterval(room.countdownInterval);
      room.countdownInterval = null;
      room.countdown = null;

      io.to(roomCode).emit('promptDiceRoll');
      io.to(roomCode).emit('startGame');

      console.log(`✅ Countdown finished for ${roomCode}`);
    }
  }, 1000);
}

function rollDiceForPlayer(room, playerName, rollValue) {
  if (!room.playerRolls) room.playerRolls = {};
  room.playerRolls[playerName] = rollValue;

  const expectedPlayers = room.players.map(p => p.name);
  const rolledPlayers = Object.keys(room.playerRolls);
  const allRolled =
    expectedPlayers.length > 0 &&
    expectedPlayers.every(name => rolledPlayers.includes(name));

  return allRolled;
}

function finalizePlayerOrder(roomCode, room) {
  const pairs = Object.entries(room.playerRolls || {});
  pairs.sort((a, b) => b[1] - a[1]);

  const orderedNames = pairs.map(p => p[0]);

  room.turnOrder = orderedNames;
  room.currentTurnIndex = 0;
  room.gameStarted = true;

  io.to(roomCode).emit('playerOrderFinalized', orderedNames);
  emitCurrentTurn(roomCode, room);

  console.log(`📋 Finalized order for ${roomCode}:`, orderedNames);

  room.playerRolls = {};
}

io.on('connection', (socket) => {
  console.log(`🔌 Connected: ${socket.id}`);

  let clientType = null;
  let currentRoomCode = null;

  socket.on('identify', (data) => {
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        // ignore bad JSON
      }
    }

    clientType = (data && data.clientType) ? data.clientType : 'web-player';
    console.log(`👤 ${socket.id} identified as ${clientType}`);

    if (clientType === 'host' || clientType === 'unity-viewer') {
      const roomCode = generateRoomCode();
      rooms[roomCode] = createRoom(socket.id);

      socket.join(roomCode);
      currentRoomCode = roomCode;

      socket.emit('roomCreated', { roomCode });
      console.log(`🏠 Room ${roomCode} created for host ${socket.id}`);
    } else {
      socket.emit('welcome', 'Hello Web Player! Enter a room code to join.');
    }
  });

  setTimeout(() => {
    if (!clientType) {
      clientType = 'host';
      const roomCode = generateRoomCode();
      rooms[roomCode] = createRoom(socket.id);

      socket.join(roomCode);
      currentRoomCode = roomCode;

      socket.emit('roomCreated', { roomCode });
      console.log(`🏠 Room ${roomCode} auto-created for host ${socket.id}`);
    }
  }, 150);

  socket.on('joinRoom', ({ roomCode, playerName }) => {
    if (!roomCode || !playerName) {
      return socket.emit('joinFailed', 'Must provide roomCode and playerName');
    }

    roomCode = roomCode.toUpperCase();
    const room = rooms[roomCode];

    if (!room) {
      return socket.emit('joinFailed', 'Room not found!');
    }

    if (room.players.find(p => p.name === playerName)) {
      return socket.emit('joinFailed', 'Name already taken in this room');
    }

    const newPlayer = {
      id: socket.id,
      name: playerName,
      character: null,
      locked: false
    };

    room.players.push(newPlayer);
    socket.join(roomCode);
    currentRoomCode = roomCode;

    socket.emit('loadGamePage', {
      roomCode,
      playerName,
      roomData: serializeRoom(room),
      characterStats
    });

    io.to(roomCode).emit('updateRoom', serializeRoom(room));
    io.to(roomCode).emit('updateCharacterSelection', room.characters);

    console.log(`👤 ${playerName} joined ${roomCode}`);
  });

  socket.on('chooseCharacter', ({ roomCode, playerName, character, previous }) => {
    const room = rooms[roomCode];
    if (!room) return;

    if (previous && room.characters[previous] === playerName) {
      delete room.characters[previous];
    }

    if (character) {
      if (room.characters[character]) {
        return socket.emit('characterTaken', character);
      }

      room.characters[character] = playerName;

      const player = room.players.find(p => p.name === playerName);
      if (player) player.character = character;
    }

    io.to(roomCode).emit('updateCharacterSelection', room.characters);
    io.to(roomCode).emit('updateRoom', serializeRoom(room));
    io.to(roomCode).emit('unityCharacterUpdate', {
      playerId: socket.id,
      playerName,
      character
    });
  });

  socket.on('releaseCharacter', ({ roomCode, character }) => {
    const room = rooms[roomCode];
    if (!room) return;

    delete room.characters[character];

    io.to(roomCode).emit('updateCharacterSelection', room.characters);
    io.to(roomCode).emit('updateRoom', serializeRoom(room));
    io.to(roomCode).emit('unityCharacterUpdate', {
      playerId: null,
      playerName: null,
      character: null,
      released: character
    });
  });

  socket.on('lockCharacter', ({ roomCode, playerName }) => {
    const room = rooms[roomCode];
    if (!room) return;

    const player = room.players.find(p => p.name === playerName);
    if (player) player.locked = true;

    io.to(roomCode).emit('updateRoom', serializeRoom(room));
  });

  socket.on('startCountdown', (roomCode) => {
    if (!roomCode) return;

    const room = rooms[roomCode];
    if (!room) return;

    if (room.hostId !== socket.id) {
      console.log(`⚠️ Non-host attempted to start countdown in ${roomCode}`);
      return;
    }

    startCountdown(roomCode, room, 10);
  });

  socket.on('startGame', (roomCode) => {
    if (!roomCode) return;

    const room = rooms[roomCode];
    if (!room) return;

    if (room.hostId !== socket.id) {
      console.log(`⚠️ Non-host attempted to start game in ${roomCode}`);
      return;
    }

    io.to(roomCode).emit('startGame');
  });

  // Used for deciding turn order at the beginning
  socket.on('playerRolled', ({ roomCode, playerName, rollValue }) => {
    const room = rooms[roomCode];
    if (!room) return;

    if (typeof rollValue !== 'number') {
      rollValue = Number(rollValue);
    }

    // If the game has NOT started yet, this is the initial roll for turn order
    if (!room.gameStarted) {
      const allRolled = rollDiceForPlayer(room, playerName, rollValue);
      io.to(roomCode).emit('diceRolled', { playerName, rollValue });

      if (allRolled) {
        finalizePlayerOrder(roomCode, room);
      }
      return;
    }

    // If the game HAS started, only the active player can roll
    const activePlayer = room.turnOrder[room.currentTurnIndex];

    if (playerName !== activePlayer) {
      console.log(`🚫 Blocked roll from ${playerName}; active player is ${activePlayer}`);
      socket.emit('notYourTurn', { activePlayer });
      return;
    }

    io.to(roomCode).emit('diceRolled', { playerName, rollValue });
    io.to(roomCode).emit('activePlayerRolled', {
      playerName,
      rollValue,
      currentTurnIndex: room.currentTurnIndex
    });

    console.log(`🎲 ${playerName} rolled ${rollValue} in active turn`);
  });

  socket.on('endTurn', ({ roomCode, playerName }) => {
    const room = rooms[roomCode];
    if (!room || !room.gameStarted || !room.turnOrder.length) return;

    const activePlayer = room.turnOrder[room.currentTurnIndex];
    if (playerName !== activePlayer) {
      console.log(`⚠️ endTurn ignored from ${playerName}; active player is ${activePlayer}`);
      return;
    }

    room.currentTurnIndex = (room.currentTurnIndex + 1) % room.turnOrder.length;
    emitCurrentTurn(roomCode, room);
  });

  socket.on('disconnect', () => {
    console.log(`❌ Disconnected: ${socket.id}`);

    for (const code in rooms) {
      const room = rooms[code];
      if (!room) continue;

      if (room.hostId === socket.id) {
        io.to(code).emit('roomClosed', 'Host disconnected. Room closed.');

        if (room.countdownInterval) {
          clearInterval(room.countdownInterval);
        }

        delete rooms[code];
        console.log(`🗑 Room ${code} closed because host disconnected`);
        continue;
      }

      const idx = room.players.findIndex(p => p.id === socket.id);
      if (idx > -1) {
        const [removed] = room.players.splice(idx, 1);

        for (const char in room.characters) {
          if (room.characters[char] === removed.name) {
            delete room.characters[char];
          }
        }

        room.turnOrder = (room.turnOrder || []).filter(name => name !== removed.name);

        if (room.currentTurnIndex >= room.turnOrder.length) {
          room.currentTurnIndex = 0;
        }

        io.to(code).emit('updateRoom', serializeRoom(room));
        io.to(code).emit('updateCharacterSelection', room.characters);

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