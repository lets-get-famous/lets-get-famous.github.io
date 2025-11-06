// server.js
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
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Store client types and rooms
const clients = {}; // { socket.id: "unity-host" | "web-player" }
const rooms = {};   // { roomCode: { hostId, players: [{id, name, character}], takenCharacters: [] } }

// Helper to make short room codes (4 letters/numbers)
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

io.on('connection', (socket) => {
  console.log(`🟢 New connection: ${socket.id}`);

  // Client identifies (Unity host or web player)
  socket.on('identify', (data) => {
    const clientType = data.clientType || 'unknown';
    clients[socket.id] = clientType;
    console.log(`🔹 Client ${socket.id} identified as ${clientType}`);

    if (clientType === 'unity-host') {
      // Generate and create a new room for the Unity host
      const roomCode = generateRoomCode();
      rooms[roomCode] = { hostId: socket.id, players: [], takenCharacters: [] };
      socket.join(roomCode);
      socket.emit('roomCreated', { roomCode });
      console.log(`🏠 Unity host created room ${roomCode}`);
    } else if (clientType === 'web-player') {
      socket.emit('welcome', 'Hello, Web Player! Use a room code to join.');
    }
  });

  // Web player joins a room
  socket.on('joinRoom', ({ roomCode, playerName, character }) => {
    roomCode = roomCode?.toUpperCase();
    if (!rooms[roomCode]) {
      socket.emit('joinFailed', 'Room not found!');
      return;
    }

    // Add player
    rooms[roomCode].players.push({ id: socket.id, name: playerName, character });
    rooms[roomCode].takenCharacters.push(character);
    socket.join(roomCode);

    console.log(`👤 ${playerName} joined room ${roomCode}`);

    socket.emit('roomJoined', { roomCode, players: rooms[roomCode].players });
    io.to(roomCode).emit('updateRoom', {
      players: rooms[roomCode].players,
      takenCharacters: rooms[roomCode].takenCharacters
    });
  });

  // Handle character changes
  socket.on('changeCharacter', ({ roomCode, oldCharacter, newCharacter }) => {
    const room = rooms[roomCode];
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (player && !room.takenCharacters.includes(newCharacter)) {
      const index = room.takenCharacters.indexOf(oldCharacter);
      if (index > -1) room.takenCharacters.splice(index, 1);

      player.character = newCharacter;
      room.takenCharacters.push(newCharacter);

      io.to(roomCode).emit('updateRoom', {
        players: room.players,
        takenCharacters: room.takenCharacters
      });
    }
  });

  // Handle disconnects
  socket.on('disconnect', () => {
    console.log(`🔴 Disconnected: ${socket.id} (${clients[socket.id]})`);

    // Remove player or host from rooms
    for (const roomCode in rooms) {
      const room = rooms[roomCode];

      if (room.hostId === socket.id) {
        // Host disconnected → destroy room
        io.to(roomCode).emit('roomClosed', 'Host disconnected. Room closed.');
        delete rooms[roomCode];
        console.log(`❌ Room ${roomCode} closed (host left)`);
        continue;
      }

      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex > -1) {
        const [removed] = room.players.splice(playerIndex, 1);
        const charIndex = room.takenCharacters.indexOf(removed.character);
        if (charIndex > -1) room.takenCharacters.splice(charIndex, 1);

        io.to(roomCode).emit('updateRoom', {
          players: room.players,
          takenCharacters: room.takenCharacters
        });

        console.log(`👋 Player ${removed.name} left room ${roomCode}`);
      }
    }

    delete clients[socket.id];
  });
});

server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
