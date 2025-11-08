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

// Character stats
const characterStats = {
  "Daria": { profession: "Game Designer", luck: 4, talent: 3, networking: 2, wealth: 1 },
  "Tony": { profession: "Fashion Designer", luck: 3, talent: 2, networking: 4, wealth: 1 },
  "Logan": { profession: "Reality TV Star", luck: 3, talent: 1, networking: 4, wealth: 2 }
};

// Room data
const rooms = {}; // { roomCode: { hostId, players: [], playerRolls: {}, characters: {} } }

// Generate 4-letter room codes
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

// --- Socket.IO ---
io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);
  let clientType = null;
  let currentRoomCode = null;

  // Identify
  socket.on('identify', (data) => {
    if (typeof data === 'string') data = JSON.parse(data);
    clientType = data.clientType;

    if (clientType === 'host') {
      const roomCode = generateRoomCode();
      rooms[roomCode] = { hostId: socket.id, players: [], playerRolls: {}, characters: {} };
      currentRoomCode = roomCode;
      socket.join(roomCode);
      socket.emit('roomCreated', { roomCode });
      console.log(`Host created room ${roomCode}`);
    } else if (clientType === 'web-player') {
      socket.emit('welcome', 'Hello Web Player! Enter a room code to join.');
    }
  });

  // Player joins
  socket.on('joinRoom', ({ roomCode, playerName }) => {
    roomCode = roomCode.toUpperCase();
    const room = rooms[roomCode];
    if (!room) return socket.emit('joinFailed', 'Room not found!');

    room.players.push({ id: socket.id, name: playerName, character: null });
    socket.join(roomCode);

    socket.emit('loadGamePage', { roomCode, playerName, roomData: room, characterStats });
    io.to(roomCode).emit('updateRoom', { players: room.players, characters: room.characters });
    console.log(`${playerName} joined room ${roomCode}`);
  });

  // Character selection
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
    }

    io.to(roomCode).emit('updateRoom', { players: room.players, characters: room.characters });
  });

  // Dice roll
  socket.on('playerRolledDice', ({ roomCode, playerName, rollValue }) => {
    const room = rooms[roomCode];
    if (!room) return;
    const player = room.players.find(p => p.name === playerName);
    if (!player) return;

    room.playerRolls[player.id] = rollValue;
    io.to(room.hostId).emit('diceRolled', { playerId: player.id, rollValue });

    if (Object.keys(room.playerRolls).length === room.players.length) {
      const sorted = Object.entries(room.playerRolls)
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => id);

      io.to(room.hostId).emit('playerOrderFinalized', sorted);
      io.to(roomCode).emit('playerOrderFinalized', sorted);
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);

    for (const roomCode in rooms) {
      const room = rooms[roomCode];

      // Host left
      if (room.hostId === socket.id) {
        io.to(roomCode).emit('roomClosed', 'Host disconnected. Room closed.');
        delete rooms[roomCode];
        continue;
      }

      // Player left
      const idx = room.players.findIndex(p => p.id === socket.id);
      if (idx > -1) {
        const [removed] = room.players.splice(idx, 1);
        for (const char in room.characters) if (room.characters[char] === removed.name) delete room.characters[char];
        io.to(roomCode).emit('updateRoom', { players: room.players, characters: room.characters });
      }
    }
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
