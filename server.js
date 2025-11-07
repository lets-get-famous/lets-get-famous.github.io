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

  // Flag to track if client identified
  let identified = false;

  // Listen for identify event
  socket.on('identify', (data) => {
    // Firesplash sends JSON as a string, so parse it
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } 
      catch (err) {
        console.error('Failed to parse identify payload:', data);
        return;
      }
    }

    const clientType = data.clientType || 'host'; // default to host
    identified = true;
    console.log(`Client identified as: ${clientType} (${socket.id})`);
  });

  // If client never identifies within first 2 seconds, assign host automatically
  setTimeout(() => {
    if (!identified) {
      const clientType = 'host';
      console.log(`Client assigned as: ${clientType} (${socket.id})`);
      identified = true;
    }
  }, 20000);

  if (clientType === 'host') {
    // Create a new room
    const roomCode = generateRoomCode();
    rooms[roomCode] = { hostId: socket.id, players: [], takenCharacters: [] };
    socket.join(roomCode);

    // Send room code back to host
    socket.emit('roomCreated', { roomCode });
    console.log(`Room ${roomCode} created for host ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);
  });
}



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
