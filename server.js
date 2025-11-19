// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const PORT = process.env.PORT || 3000;

// Serve front-end (adjust paths as needed)
app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/game.html', (req, res) => res.sendFile(path.join(__dirname, 'game.html')));

// --- Character stats (unchanged) ---
const characterStats = {
  "Daria": { profession: "Game Designer", luck: 4, talent: 3, networking: 2, wealth: 1 },
  "Tony": { profession: "Fashion Designer/Icon", luck: 3, talent: 2, networking: 4, wealth: 1 },
  "Logan": { profession: "Reality TV Star", luck: 3, talent: 1, networking: 4, wealth: 2 },
  "Raeann": { profession: "Actress", luck: 2, talent: 1, networking: 4, wealth: 3 },
  "Paige": { profession: "Writer", luck: 3, talent: 2, networking: 1, wealth: 4 },
  "Rami": { profession: "Skater", luck: 1, talent: 4, networking: 3, wealth: 2 },
  "Tegan": { profession: "Singer", luck: 4, talent: 1, networking: 2, wealth: 3 },
  "Adam": { profession: "Streamer", luck: 1, talent: 3, networking: 4, wealth: 2 },
  "Sophie": { profession: "Ballerina", luck: 2, talent: 4, networking: 1, wealth: 3 },
  "Aileen": { profession: "Comedian", luck: 2, talent: 4, networking: 3, wealth: 1 },
  "Bailey": { profession: "DJ", luck: 1, talent: 2, networking: 3, wealth: 4 },
};

// --- Rooms structure ---
const rooms = {}; 
// rooms[roomCode] = {
//   hostId, players: [{id, name, character, locked}], playerRolls: { playerName: roll }, characters: {}, countdown: number, countdownInterval: IntervalRef, countdownOwnerSocketId
// }

// --- Generate random 4-letter room code ---
function generateRoomCode() {
  const chars = 'ABCDEFGHJLMNPQRSTUVWXYZ307';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

// --- Safe room serialization to emit to clients ---
function serializeRoom(room) {
  if (!room) return null;
  return {
    hostId: room.hostId,
    players: room.players,
    characters: room.characters,
    playerRolls: room.playerRolls,
    countdown: room.countdown
  };
}

// --- Countdown logic: starts only if not already running ---
function startCountdown(io, roomCode, room, initialSeconds = 10) {
  if (!room) return;
  if (room.countdownInterval) {
    console.log(`⛔ Countdown already running for ${roomCode}`);
    return;
  }

  console.log(`⏳ Starting countdown for ${roomCode} (${initialSeconds}s)`);
  room.countdown = initialSeconds;
  io.to(roomCode).emit('countdownUpdate', room.countdown);

  room.countdownInterval = setInterval(() => {
    room.countdown -= 1;
    io.to(roomCode).emit('countdownUpdate', room.countdown);

    if (room.countdown <= 0) {
      clearInterval(room.countdownInterval);
      room.countdownInterval = null;
      room.countdown = null;

      // tell everyone the dice roll phase starts
      io.to(roomCode).emit('promptDiceRoll');
      // Optionally trigger 'startGame' phase
      io.to(roomCode).emit('startGame');

      console.log(`✅ Countdown finished for ${roomCode}`);
    }
  }, 1000);
}

// --- Record a player's roll and check if all players rolled ---
function rollDiceForPlayer(room, playerName, rollValue) {
  if (!room.playerRolls) room.playerRolls = {};
  room.playerRolls[playerName] = rollValue;

  // Check if all players who are in the room and not locked-out (or however you define) have rolled.
  const expectedPlayers = room.players.map(p => p.name);
  const rolledPlayers = Object.keys(room.playerRolls);
  const allRolled = expectedPlayers.length > 0 && expectedPlayers.every(name => rolledPlayers.includes(name));
  return allRolled;
}

// --- Finalize player order: sort players by roll desc, break ties by timestamp or random if needed ---
function finalizePlayerOrder(io, roomCode, room) {
  const pairs = Object.entries(room.playerRolls || {}); // [ [playerName, roll], ...]
  // Sort by roll DESC; for ties we preserve insertion order (or random if you want)
  pairs.sort((a, b) => b[1] - a[1]);

  const orderedNames = pairs.map(p => p[0]);
  io.to(roomCode).emit('playerOrderFinalized', orderedNames);

  console.log(`🧩 Finalized order for ${roomCode}:`, orderedNames);

  // clear rolls for next round (if desired)
  room.playerRolls = {};
}

// --- Socket.IO connection handling ---
io.on('connection', (socket) => {
  console.log(`🔗 Connected: ${socket.id}`);

  let clientType = null;
  let currentRoomCode = null;

  // Identify client type (host, web-player, unity-viewer, etc.)
  socket.on('identify', (data) => {
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { /* ignore */ }
    }
    clientType = (data && data.clientType) ? data.clientType : 'web-player';
    console.log(`🔎 ${socket.id} identified as ${clientType}`);

    if (clientType === 'host' || clientType === 'unity-viewer') {
      // create a room for the host/viewer
      const roomCode = generateRoomCode();
      rooms[roomCode] = {
        hostId: socket.id,
        players: [],
        playerRolls: {},
        characters: {},
        countdown: null,
        countdownInterval: null
      };
      socket.join(roomCode);
      currentRoomCode = roomCode;
      socket.emit('roomCreated', { roomCode });
      console.log(`🏠 Room ${roomCode} created for host ${socket.id}`);
    } else {
      // web players get a friendly greeting and will join with joinRoom
      socket.emit('welcome', 'Hello Web Player! Enter a room code to join.');
    }
  });

  // If identify never came, auto-create host room after a delay (optional)
  setTimeout(() => {
    if (!clientType) {
      clientType = 'host';
      const roomCode = generateRoomCode();
      rooms[roomCode] = {
        hostId: socket.id,
        players: [],
        playerRolls: {},
        characters: {},
        countdown: null,
        countdownInterval: null
      };
      socket.join(roomCode);
      currentRoomCode = roomCode;
      socket.emit('roomCreated', { roomCode });
      console.log(`🏠 Room ${roomCode} auto-created for host ${socket.id}`);
    }
  }, 1500);

  // --- Join room (web player calls this) ---
  socket.on('joinRoom', ({ roomCode, playerName }) => {
    if (!roomCode || !playerName) return socket.emit('joinFailed', 'Must provide roomCode and playerName');
    roomCode = roomCode.toUpperCase();
    const room = rooms[roomCode];
    if (!room) return socket.emit('joinFailed', 'Room not found!');

    // avoid duplicate names in same room
    if (room.players.find(p => p.name === playerName)) {
      return socket.emit('joinFailed', 'Name already taken in this room');
    }

    // add player
    const newPlayer = { id: socket.id, name: playerName, character: null, locked: false };
    room.players.push(newPlayer);
    socket.join(roomCode);
    currentRoomCode = roomCode;

    // send load info to joining player
    socket.emit('loadGamePage', {
      roomCode,
      playerName,
      roomData: serializeRoom(room),
      characterStats
    });

    // notify everyone in room
    io.to(roomCode).emit('updateRoom', serializeRoom(room));
    io.to(roomCode).emit('updateCharacterSelection', room.characters);

    // OPTIONAL: start countdown when first player joins (you had this behavior). Keep if desired.
    // if (!room.countdown) startCountdown(io, roomCode, room);

    console.log(`👤 ${playerName} joined ${roomCode}`);

  });

  // --- Character selection ---
  socket.on('chooseCharacter', ({ roomCode, playerName, character, previous }) => {
    const room = rooms[roomCode];
    if (!room) return;

    if (previous && room.characters[previous] === playerName) delete room.characters[previous];

    if (character) {
      if (room.characters[character]) return socket.emit('characterTaken', character);
      room.characters[character] = playerName;
      const player = room.players.find(p => p.name === playerName);
      if (player) player.character = character;
    }

    io.to(roomCode).emit('updateCharacterSelection', room.characters);
    io.to(roomCode).emit('updateRoom', serializeRoom(room));
    io.to(roomCode).emit('unityCharacterUpdate', { playerId: socket.id, playerName, character });
  });

  socket.on('releaseCharacter', ({ roomCode, character }) => {
    const room = rooms[roomCode];
    if (!room) return;
    delete room.characters[character];
    io.to(roomCode).emit('updateCharacterSelection', room.characters);
    io.to(roomCode).emit('updateRoom', serializeRoom(room));
    io.to(roomCode).emit('unityCharacterUpdate', { playerId: null, playerName: null, character: null, released: character });
  });

  socket.on('lockCharacter', ({ roomCode, playerName }) => {
    const room = rooms[roomCode];
    if (!room) return;
    const player = room.players.find(p => p.name === playerName);
    if (player) player.locked = true;
    io.to(roomCode).emit('updateRoom', serializeRoom(room));
  });

  // --- Host asks the server to start the countdown ---
  socket.on('startCountdown', (roomCode) => {
    if (!roomCode) return;
    const room = rooms[roomCode];
    if (!room) return;
    if (room.hostId !== socket.id) {
      console.log(`⚠️ Non-host attempted to start countdown in ${roomCode}`);
      return;
    }
    startCountdown(io, roomCode, room, 10); // 10s default; change as desired
  });

  // --- Host or players can trigger startGame (server just broadcasts to clients) ---
  socket.on('startGame', (roomCode) => {
    if (!roomCode) return;
    const room = rooms[roomCode];
    if (!room) return;
    if (room.hostId !== socket.id) {
      console.log(`⚠️ Non-host attempted to start game in ${roomCode}`);
      return;
    }
    io.to(roomCode).emit('startGame');
  });

  // --- Player dice rolls ---
  socket.on('playerRolled', ({ roomCode, playerName, rollValue }) => {
    const room = rooms[roomCode];
    if (!room) return;
    if (typeof rollValue !== 'number') rollValue = Number(rollValue);
    const allRolled = rollDiceForPlayer(room, playerName, rollValue);
    // broadcast each roll to the room (optional)
    io.to(roomCode).emit('diceRolled', { playerName, rollValue });

    if (allRolled) {
      finalizePlayerOrder(io, roomCode, room);
    }
  });

  // --- Disconnect handling ---
  socket.on('disconnect', () => {
    console.log(`❌ Disconnected: ${socket.id}`);
    for (const code in rooms) {
      const room = rooms[code];
      if (!room) continue;

      // Host disconnected: close room and notify players
      if (room.hostId === socket.id) {
        io.to(code).emit('roomClosed', 'Host disconnected. Room closed.');
        // clean up interval
        if (room.countdownInterval) clearInterval(room.countdownInterval);
        delete rooms[code];
        console.log(`🧨 Room ${code} closed because host disconnected`);
        continue;
      }

      // Player disconnected
      const idx = room.players.findIndex(p => p.id === socket.id);
      if (idx > -1) {
        const [removed] = room.players.splice(idx, 1);
        for (const char in room.characters) {
          if (room.characters[char] === removed.name) delete room.characters[char];
        }
        io.to(code).emit('updateRoom', serializeRoom(room));
        io.to(code).emit('updateCharacterSelection', room.characters);
        console.log(`🚪 Player ${removed.name} removed from ${code}`);
      }
    }
  });

});

server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
