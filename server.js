// === server.js ===
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;

// Serve files from root folder
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});


// --- ROOM STORAGE ---
const rooms = {}; // { roomCode: { hostId, players: [], playerRolls: {} } }

// --- ROOM CODE GENERATOR ---
function generateRoomCode() {
  const chars = 'ABCDEFGHJLMNPQRSTUVWX2YZ';
  return Array.from({ length: 4 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

// --- SOCKET.IO CONNECTION HANDLER ---
io.on('connection', (socket) => {
  console.log(`🟢 New connection: ${socket.id}`);
  let clientType = null;

  // Identify client (Unity host or Web Player)
  socket.on('identify', (data) => {
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { return; }
    }

    clientType = data.clientType || 'host';
    console.log(`Client identified as: ${clientType} (${socket.id})`);

    if (clientType === 'host') {
      const roomCode = generateRoomCode();
      rooms[roomCode] = { hostId: socket.id, players: [], playerRolls: {} };
      socket.join(roomCode);
      socket.emit('roomCreated', { roomCode });
      console.log(`🏠 Room ${roomCode} created for host ${socket.id}`);
    } else if (clientType === 'web-player') {
      socket.emit('welcome', 'Hello Web Player! Enter a room code to join.');
    }
  });

  // Fallback auto-assign host if not identified
  setTimeout(() => {
    if (!clientType) {
      clientType = 'host';
      const roomCode = generateRoomCode();
      rooms[roomCode] = { hostId: socket.id, players: [], playerRolls: {} };
      socket.join(roomCode);
      socket.emit('roomCreated', { roomCode });
      console.log(`(Auto) Room ${roomCode} created for host ${socket.id}`);
    }
  }, 2000);

  // --- Player joins a room ---
  socket.on('joinRoom', ({ roomCode, playerName }) => {
    roomCode = roomCode.toUpperCase();
    const room = rooms[roomCode];
    if (!room) {
      socket.emit('joinFailed', 'Room not found!');
      return;
    }

    room.players.push({ id: socket.id, name: playerName });
    socket.join(roomCode);

    console.log(`👤 ${playerName} joined room ${roomCode}`);
    socket.emit('joinedRoom', roomCode);

    io.to(roomCode).emit('updateRoom', {
      hostId: room.hostId,
      players: room.players
    });
  });

  // --- Dice roll handler ---
  socket.on('playerRolledDice', ({ roomCode, playerName, rollValue }) => {
    const room = rooms[roomCode];
    if (!room) return;

    // Store player roll
    room.playerRolls = room.playerRolls || {};
    room.playerRolls[playerName] = rollValue;

    // Notify host
    io.to(room.hostId).emit('diceRolled', { playerName, rollValue });
    console.log(`🎲 ${playerName} rolled a ${rollValue} in ${roomCode}`);

    // If all players have rolled...
    const allRolled = Object.keys(room.playerRolls).length === room.players.length;
    if (allRolled) {
      const sorted = Object.entries(room.playerRolls)
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name);

      // Check for ties
      const rerollPairs = [];
      for (let i = 0; i < sorted.length - 1; i++) {
        if (room.playerRolls[sorted[i]] === room.playerRolls[sorted[i + 1]]) {
          rerollPairs.push([sorted[i], sorted[i + 1]]);
        }
      }

      if (rerollPairs.length > 0) {
        io.to(room.hostId).emit('tieDetected', rerollPairs);
        io.to(roomCode).emit('tieDetected', rerollPairs);
        console.log(`⚖️ Tie detected in ${roomCode}:`, rerollPairs);
      } else {
        io.to(room.hostId).emit('playerOrderFinalized', sorted);
        io.to(roomCode).emit('playerOrderFinalized', sorted);
        console.log(`🎯 Player order for ${roomCode}:`, sorted);
      }

      // Reset for next round
      room.playerRolls = {};
    }
  });

  // --- Handle disconnects ---
  socket.on('disconnect', () => {
    console.log(`🔴 Disconnected: ${socket.id} (${clientType})`);

    for (const roomCode in rooms) {
      const room = rooms[roomCode];

      // If host leaves, close the room
      if (room.hostId === socket.id) {
        io.to(roomCode).emit('roomClosed', 'Host disconnected. Room closed.');
        delete rooms[roomCode];
        console.log(`❌ Room ${roomCode} closed (host left)`);
        continue;
      }

      // Remove player if they leave
      const idx = room.players.findIndex(p => p.id === socket.id);
      if (idx > -1) {
        const [removed] = room.players.splice(idx, 1);
        io.to(roomCode).emit('updateRoom', {
          hostId: room.hostId,
          players: room.players
        });
        console.log(`👋 Player ${removed.name} left ${roomCode}`);
      }
    }
  });
});

// --- START SERVER ---
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
