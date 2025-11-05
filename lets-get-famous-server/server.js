// Import dependencies
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// Create Express app
const app = express();
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

  // When a player joins a room
  socket.on('joinRoom', ({ roomCode, playerName, character }) => {
    if (!rooms[roomCode]) rooms[roomCode] = { players: [] };

    // Add player to room
    rooms[roomCode].players.push({ id: socket.id, name: playerName, character });
    socket.join(roomCode);

    // Notify everyone in the room
    io.to(roomCode).emit('updatePlayers', rooms[roomCode].players);
    console.log(`${playerName} joined room ${roomCode}`);
  });

  // When a player changes their character
  socket.on('changeCharacter', ({ roomCode, character }) => {
    const player = rooms[roomCode]?.players.find(p => p.id === socket.id);
    if (player) {
      player.character = character;
      io.to(roomCode).emit('updatePlayers', rooms[roomCode].players);
    }
  });

  // When a player disconnects
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
