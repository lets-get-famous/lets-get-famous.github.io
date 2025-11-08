const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;

// Serve front-end
app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/game.html', (req, res) => res.sendFile(path.join(__dirname, 'game.html')));

// --- Character stats ---
const characterStats = {
  "Daria": { profession: "Game Designer", luck: 4, talent: 3, networking: 2, wealth: 1 },
  "Tony": { profession: "Fashion Designer/Icon", luck: 3, talent: 2, networking: 4, wealth: 1 },
  "Logan": { profession: "Reality TV Star", luck: 3, talent: 1, networking: 4, wealth: 2 }
};

// Room data structure
const rooms = {}; // { roomCode: { hostId, players: [], playerRolls: {}, characters: {} } }

// Helper to generate 4-letter room codes
function generateRoomCode() {
  const chars = 'ABCDEFGHJLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

// --- SOCKET.IO LOGIC ---
io.on('connection', (socket) => {
  console.log(`🔗 New connection: ${socket.id}`);
  let clientType = null;
  let currentRoomCode = null;

  // --- Identify client type ---
  socket.on('identify', (data) => {
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { return; }
    }

    clientType = data.clientType || 'host';
    console.log(`📝 Client identified as: ${clientType} (${socket.id})`);

    if (clientType === 'host') {
      const roomCode = generateRoomCode();
      rooms[roomCode] = { hostId: socket.id, players: [], playerRolls: {}, characters: {} };
      socket.join(roomCode);
      currentRoomCode = roomCode;
      socket.emit('roomCreated', { roomCode });
      console.log(`🏠 Room ${roomCode} created for host ${socket.id}`);
    } else if (clientType === 'web-player') {
      socket.emit('welcome', 'Hello Web Player! Enter a room code to join.');
    }
  });

  // Auto-create host if identity not sent
  setTimeout(() => {
    if (!clientType) {
      clientType = 'host';
      const roomCode = generateRoomCode();
      rooms[roomCode] = { hostId: socket.id, players: [], playerRolls: {}, characters: {} };
      socket.join(roomCode);
      currentRoomCode = roomCode;
      socket.emit('roomCreated', { roomCode });
      console.log(`🏠 Room ${roomCode} auto-created for host ${socket.id}`);
    }
  }, 2000);

  // --- Player joins a room ---
  socket.on('joinRoom', ({ roomCode, playerName }) => {
    roomCode = roomCode.toUpperCase();
    const room = rooms[roomCode];
    if (!room) {
      socket.emit('joinFailed', 'Room not found!');
      console.warn(`❌ Join failed: Room ${roomCode} not found`);
      return;
    }

    room.players.push({ id: socket.id, name: playerName, character: null });
    socket.join(roomCode);
    console.log(`👤 ${playerName} joined room ${roomCode}`);

    socket.emit('loadGamePage', {
      roomCode,
      playerName,
      roomData: room,
      characterStats
    });

    io.to(roomCode).emit('updateRoom', {
      hostId: room.hostId,
      players: room.players,
      characters: room.characters
    });
  });

  // --- Character selection ---
  socket.on('chooseCharacter', ({ roomCode, playerName, character, previous }) => {
    const room = rooms[roomCode];
    if (!room) return;

    if (previous && room.characters[previous] === playerName) delete room.characters[previous];

    if (character) {
      if (room.characters[character]) {
        socket.emit('characterTaken', character);
        return;
      }
      room.characters[character] = playerName;
      const player = room.players.find(p => p.name === playerName);
      if (player) player.character = character;
    } else {
      const player = room.players.find(p => p.name === playerName);
      if (player) player.character = null;
    }

    io.to(roomCode).emit('updateCharacterSelection', room.characters);
    io.to(roomCode).emit('updateRoom', { players: room.players, characters: room.characters });
  });

  // --- Release character if player switches ---
  socket.on('releaseCharacter', ({ roomCode, character }) => {
    const room = rooms[roomCode];
    if (!room) return;
    delete room.characters[character];
    io.to(roomCode).emit('updateCharacterSelection', room.characters);
    io.to(roomCode).emit('updateRoom', { players: room.players, characters: room.characters });
  });

  // --- Player rolls dice ---
  socket.on('playerRolledDice', ({ roomCode, playerName, rollValue }) => {
    const room = rooms[roomCode];
    if (!room) return;

    room.playerRolls = room.playerRolls || {};
    room.playerRolls[playerName] = rollValue;
    console.log(`🎲 ${playerName} rolled ${rollValue} in room ${roomCode}`);

    io.to(room.hostId).emit('diceRolled', { playerName, rollValue });

    if (Object.keys(room.playerRolls).length === room.players.length) {
      const sorted = Object.entries(room.playerRolls)
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name);

      const ties = [];
      for (let i = 0; i < sorted.length - 1; i++)
        if (room.playerRolls[sorted[i]] === room.playerRolls[sorted[i + 1]]) ties.push([sorted[i], sorted[i + 1]]);

      if (ties.length > 0) io.to(room.hostId).emit('tieDetected', ties);
      else {
        io.to(room.hostId).emit('playerOrderFinalized', sorted);
        io.to(roomCode).emit('playerOrderFinalized', sorted);
      }
    }
  });

  // --- Handle disconnects ---
  socket.on('disconnect', () => {
    console.log(`❌ Disconnected: ${socket.id} (${clientType})`);
    for (const roomCode in rooms) {
      const room = rooms[roomCode];

      if (room.hostId === socket.id) {
        io.to(roomCode).emit('roomClosed', 'Host disconnected. Room closed.');
        delete rooms[roomCode];
        continue;
      }

      const idx = room.players.findIndex(p => p.id === socket.id);
      if (idx > -1) {
        const [removed] = room.players.splice(idx, 1);
        for (const char in room.characters) if (room.characters[char] === removed.name) delete room.characters[char];

        io.to(roomCode).emit('updateRoom', { players: room.players, characters: room.characters });
        io.to(roomCode).emit('updateCharacterSelection', room.characters);
      }
    }
  });
});

server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
