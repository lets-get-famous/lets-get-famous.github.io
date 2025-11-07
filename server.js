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
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Rooms structure
const rooms = {}; // { roomCode: { hostId, players: [] } }

// Helper to generate 4-letter room codes
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  // Track client type
  let clientType = null;

  // Listen for identify event
  socket.on('identify', (data) => {
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (err) { return; }
    }

    clientType = data.clientType || 'host';
    console.log(`Client identified as: ${clientType} (${socket.id})`);

    // If host, create room and send code
    if (clientType === 'host') {
      const roomCode = generateRoomCode();
      rooms[roomCode] = { hostId: socket.id, players: [] };
      socket.join(roomCode);

      socket.emit('roomCreated', { roomCode });
      console.log(`Room ${roomCode} created for host ${socket.id}`);
    } else if (clientType === 'web-player') {
      socket.emit('welcome', 'Hello Web Player! Enter a room code to join.');
    }
  });

  // Auto-assign host if identify not received in 2 seconds
  setTimeout(() => {
    if (!clientType) {
      clientType = 'host';
      console.log(`Client auto-assigned as host (${socket.id})`);
      const roomCode = generateRoomCode();
      rooms[roomCode] = { hostId: socket.id, players: [] };
      socket.join(roomCode);
      socket.emit('roomCreated', { roomCode });
      console.log(`Room ${roomCode} auto-created for host ${socket.id}`);
    }
  }, 2000);

  // Web player joins a room
  socket.on('joinRoom', ({ roomCode, playerName }) => {
    roomCode = roomCode.toUpperCase();
    if (!rooms[roomCode]) {
      socket.emit('joinFailed', 'Room not found!');
      return;
    }

    rooms[roomCode].players.push({ id: socket.id, name: playerName });
    socket.join(roomCode);

    console.log(`${playerName} joined room ${roomCode}`);
    socket.emit('joinedRoom', roomCode);

    // Notify everyone in the room
    io.to(roomCode).emit('updateRoom', {
      hostId: rooms[roomCode].hostId,
      players: rooms[roomCode].players
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id} (${clientType})`);

    // Remove player from any room
    for (const roomCode in rooms) {
      const room = rooms[roomCode];

      // If host disconnects, close room
      if (room.hostId === socket.id) {
        io.to(roomCode).emit('roomClosed', 'Host disconnected. Room closed.');
        delete rooms[roomCode];
        console.log(`Room ${roomCode} closed (host left)`);
        continue;
      }

      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex > -1) {
        const [removed] = room.players.splice(playerIndex, 1);
        io.to(roomCode).emit('updateRoom', {
          hostId: room.hostId,
          players: room.players
        });
        console.log(`Player ${removed.name} left room ${roomCode}`);
      }
    }
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
