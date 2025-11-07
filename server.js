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

// Simple rooms
const rooms = {};
const clients = {};

io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  // Identify client type
  socket.on('identify', (data) => {
    clients[socket.id] = data.clientType || 'unknown';
    console.log(`Client identified as: ${clients[socket.id]} (${socket.id})`);
  });

  // Join a room
  socket.on('joinRoom', ({ roomCode, playerName }) => {
    roomCode = roomCode.toUpperCase();
    if (!rooms[roomCode]) rooms[roomCode] = { players: [] };

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
