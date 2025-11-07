const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = 3000;

// Serve index.html
app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Helper to generate a 4-character room code
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

// Rooms and clients
const rooms = {};
const clients = {};

io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  let identified = false;

  // Listen for identify
  socket.on('identify', (data) => {
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { return; }
    }

    const clientType = data.clientType || 'host';
    clients[socket.id] = clientType;
    identified = true;

    console.log(`Client identified as: ${clientType} (${socket.id})`);

    // If host, create a room
    if (clientType === 'host') {
      const roomCode = generateRoomCode();
      rooms[roomCode] = { hostId: socket.id, players: [], takenCharacters: [] };
      socket.join(roomCode);

      socket.emit('roomCreated', { roomCode });
      console.log(`Room ${roomCode} created for host ${socket.id}`);
    }
  });

  // Auto-assign host if client never identifies within 2 seconds
  setTimeout(() => {
    if (!identified) {
      const clientType = 'host';
      clients[socket.id] = clientType;
      identified = true;

      console.log(`Client auto-assigned as: ${clientType} (${socket.id})`);

      const roomCode = generateRoomCode();
      rooms[roomCode] = { hostId: socket.id, players: [], takenCharacters: [] };
      socket.join(roomCode);

      socket.emit('roomCreated', { roomCode });
      console.log(`Room ${roomCode} auto-created for host ${socket.id}`);
    }
  }, 2000);

  // Join room
  socket.on('joinRoom', ({ roomCode, playerName }) => {
    roomCode = roomCode.toUpperCase();
    if (!rooms[roomCode]) {
      socket.emit('joinFailed', 'Room not found');
      return;
    }

    rooms[roomCode].players.push({ id: socket.id, name: playerName });
    socket.join(roomCode);

    console.log(`${playerName} joined room ${roomCode}`);
    socket.emit('joinedRoom', roomCode);
  });

  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
