// Import dependencies
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path'); // <-- add this

// Create Express app
const app = express();

// Serve your front-end files (adjust path to your GitHub Pages folder)
app.use(express.static(path.join(__dirname, '../lets-get-famous.github.io')));

// Create HTTP server
const server = http.createServer(app);

// Create Socket.IO server
const io = new Server(server, {
  cors: { origin: "*" } // allow connections from any front end
});

// Server will run on port 3000
const PORT = 3000;

// Store rooms and their players
const rooms = {}; // { roomCode: { players: [{id, name, character}] } }

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on('joinRoom', ({ roomCode, playerName, character }) => {
    if (!rooms[roomCode]) rooms[roomCode] = { players: [] };
    rooms[roomCode].players.push({ id: socket.id, name: playerName, character });
    socket.join(roomCode);
    io.to(roomCode).emit('updatePlayers', rooms[roomCode].players);
    console.log(`${playerName} joined room ${roomCode}`);
  });

  socket.on('changeCharacter', ({ roomCode, character }) => {
    const player = rooms[roomCode]?.players.find(p => p.id === socket.id);
    if (player) {
      player.character = character;
      io.to(roomCode).emit('updatePlayers', rooms[roomCode].players);
    }
  });

  socket.on('disconnect', () => {
    for (const roomCode in rooms) {
      rooms[roomCode].players = rooms[roomCode].players.filter(p => p.id !== socket.id);
      io.to(roomCode).emit('updatePlayers', rooms[roomCode].players);
    }
    console.log(`Player disconnected: ${socket.id}`);
  });
});

// Start the server
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
