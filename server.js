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

// Room data structure
const rooms = {}; // { roomCode: { hostId, players: [] } }

// Helper to generate 4-letter room codes
function generateRoomCode() {
  const chars = 'ABCDEFGHJLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// --- SOCKET.IO LOGIC ---
io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);
  let clientType = null;

  // Identify client type (host or player)
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
      console.log(`Room ${roomCode} created for host ${socket.id}`);
    } else if (clientType === 'web-player') {
      socket.emit('welcome', 'Hello Web Player! Enter a room code to join.');
    }
  });

  // Auto-assign host if identity not sent in time
  setTimeout(() => {
    if (!clientType) {
      clientType = 'host';
      const roomCode = generateRoomCode();
      rooms[roomCode] = { hostId: socket.id, players: [] };
      socket.join(roomCode);
      socket.emit('roomCreated', { roomCode });
      console.log(`Room ${roomCode} auto-created for host ${socket.id}`);
    }
  }, 2000);

  // Player joins a room
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

    // Notify all clients in the room
    io.to(roomCode).emit('updateRoom', {
      hostId: rooms[roomCode].hostId,
      players: rooms[roomCode].players
    });
  });

  // 🎲 Player rolls dice
  socket.on('playerRolledDice', ({ roomCode, rollValue }) => {
    const room = rooms[roomCode];
    if (!room) return;

    console.log(`Player in room ${roomCode} rolled a ${rollValue}`);
    
    // Send roll result to host Unity client
    io.to(room.hostId).emit('diceRolled', { rollValue });
  });

  // Handle disconnects
  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id} (${clientType})`);

    for (const roomCode in rooms) {
      const room = rooms[roomCode];

      // Host disconnected
      if (room.hostId === socket.id) {
        io.to(roomCode).emit('roomClosed', 'Host disconnected. Room closed.');
        delete rooms[roomCode];
        console.log(`Room ${roomCode} closed (host left)`);
        continue;
      }

      // Player disconnected
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

// Start server
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
