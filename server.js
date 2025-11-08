// === server.js ===
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;

// Serve front-end files from "public"
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- ROOM STORAGE ---
const rooms = {}; // { roomCode: { hostId, players: [] } }

// --- ROOM CODE GENERATOR ---
function generateRoomCode() {
  const chars = 'ABCDEFGHJLMNPQRSTUVWXYZ';
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
      rooms[roomCode] = { hostId: socket.id, players: [] };
      socket.join(roomCode);
      socket.emit('roomCreated', { roomCode });
      console.log(`🏠 Room ${roomCode} created for host ${socket.id}`);
    } else if (clientType === 'web-player') {
      socket.emit('welcome', 'Hello Web Player! Enter a room code to join.');
    }
  });

  // Fallback auto-assign host
  setTimeout(() => {
    if (!clientType) {
      clientType = 'host';
      const roomCode = generateRoomCode();
      rooms[roomCode] = { hostId: socket.id, players: [] };
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
