// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = 3000;

// Serve front-end
app.use(express.static(__dirname));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Rooms structure:
// { roomCode: { players: [{id, name, character}], takenCharacters: [] } }
const rooms = {};

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);
  
  //this connects our unity to the server creating a room
  socket.on('createRoom', ({ roomCode }) => {
    if (!rooms[roomCode]) {
      rooms[roomCode] = { players: [], takenCharacters: [] };
      console.log(`🆕 Room ${roomCode} created by Unity client`);
    }
  });

  // When a player joins a room
  socket.on('joinRoom', ({ roomCode, playerName, character }) => {
    if (!rooms[roomCode]) rooms[roomCode] = { players: [] };
  
    // TEST room max 3 players
    if (roomCode === 'TEST' && rooms[roomCode].players.length >= 3) {
      socket.emit('roomJoined', { roomCode, players: rooms[roomCode].players, capacityReached: true });
      return;
    }
  
    // Add player
    rooms[roomCode].players.push({ id: socket.id, name: playerName, character });
    socket.join(roomCode);
  
    // Confirm join
    socket.emit('roomJoined', { roomCode, players: rooms[roomCode].players, capacityReached: false });
  
    // Update all clients
    io.to(roomCode).emit('updateRoom', { players: rooms[roomCode].players, takenCharacters: rooms[roomCode].players.map(p => p.character) });

    
  });
  

  // Handle character changes (if allowed before final join)
  socket.on('changeCharacter', ({ roomCode, oldCharacter, newCharacter }) => {
    const player = rooms[roomCode]?.players.find(p => p.id === socket.id);
    if (player && !rooms[roomCode].takenCharacters.includes(newCharacter)) {
      // Free old character
      const index = rooms[roomCode].takenCharacters.indexOf(oldCharacter);
      if (index > -1) rooms[roomCode].takenCharacters.splice(index, 1);

      // Assign new character
      player.character = newCharacter;
      rooms[roomCode].takenCharacters.push(newCharacter);

      io.to(roomCode).emit('updateRoom', {
        players: rooms[roomCode].players,
        takenCharacters: rooms[roomCode].takenCharacters
      });
    }
  });

  // Player disconnects
  socket.on('disconnect', () => {
    for (const roomCode in rooms) {
      const playerIndex = rooms[roomCode].players.findIndex(p => p.id === socket.id);
      if (playerIndex > -1) {
        const [removedPlayer] = rooms[roomCode].players.splice(playerIndex, 1);
        // Remove their character from takenCharacters
        const charIndex = rooms[roomCode].takenCharacters.indexOf(removedPlayer.character);
        if (charIndex > -1) rooms[roomCode].takenCharacters.splice(charIndex, 1);

        io.to(roomCode).emit('updateRoom', {
          players: rooms[roomCode].players,
          takenCharacters: rooms[roomCode].takenCharacters
        });

        console.log(`Player disconnected: ${removedPlayer.name}`);
      }
    }
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
