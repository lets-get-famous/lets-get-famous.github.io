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
app.get('/game.html', (req, res) => res.sendFile(path.join(__dirname, 'game.html')));

// // Character stats (example)
const characterStats = {
  "Daria": { profession: "Game Designer", luck: 4, talent: 3, networking: 2, wealth: 1 },
  "Tony": { profession: "Fashion Designer/Icon", luck: 3, talent: 2, networking: 4, wealth: 1 },
  "Logan": { profession: "Reality TV Star", luck: 3, talent: 1, networking: 4, wealth: 2 },
  "Raeann": {profession: "Actress" ,luck: 2,talent: 1, networking: 4, wealth: 3},
  "Paige": {profession: "Writer",luck: 3 ,talent:2 , networking: 1, wealth: 4},
  "Tegan": {profession: "Singer",luck: 4,talent:1 , networking: 2, wealth: 3},
  "Adam": {profession: "Streamer",luck: 1 ,talent:3 , networking:4 , wealth: 2},
  "Sophie": {profession: "Ballerina",luck: 2,talent:4 , networking: 1, wealth:3 },
  "Aileen": {profession: "Comedian",luck: 2,talent: 4, networking:3 , wealth:1 },
  "Bailey": {profession: "DJ",luck: 1,talent: 2, networking: 3, wealth:4 },
};
// Rooms
const rooms = {}; // { roomCode: { hostId, players: [], playerRolls: {}, characters: {}, countdown, countdownInterval } }

// Generate 4-character room code
function generateRoomCode() {
    const chars = 'ABCDEFGHJLMNPQRSTUVWXYZ307';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
}

// --- Socket.IO connection ---
io.on('connection', (socket) => {
    console.log(`🔗 Connected: ${socket.id}`);

    let clientType = null;
    let currentRoomCode = null;

    // Identify client type
    socket.on('identify', (data) => {
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch { return; }
        }

        clientType = data.clientType || 'host';

        if (clientType === 'host') {
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
        } else if (clientType === 'web-player') {
            socket.emit('welcome', 'Hello Web Player! Enter a room code to join.');
        }
    });

    // Auto-create host if identify not received
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
    }, 2000);

    // --- Join room ---
    socket.on('joinRoom', ({ roomCode, playerName }) => {
        roomCode = roomCode.toUpperCase();
        const room = rooms[roomCode];
        if (!room) return socket.emit('joinFailed', 'Room not found!');

        room.players.push({ id: socket.id, name: playerName, character: null, locked: false });
        socket.join(roomCode);

        socket.emit('loadGamePage', { roomCode, playerName, roomData: room, characterStats });
        io.to(roomCode).emit('updateRoom', { hostId: room.hostId, players: room.players, characters: room.characters });

        // Start countdown if first player
        if (!room.countdown) {
            room.countdown = 60; // 60 seconds
            room.countdownInterval = setInterval(() => {
                room.countdown--;

                // Emit countdown update to all players
                io.to(roomCode).emit('countdownUpdate', room.countdown);

                // Speed up countdown if all players locked
                const allLocked = room.players.every(p => p.locked);
                if (allLocked && room.countdown > 10) room.countdown = 10;

                if (room.countdown <= 0) {
                    clearInterval(room.countdownInterval);
                    room.countdownInterval = null;

                    // Start game automatically
                    io.to(roomCode).emit('startGame');
                    room.playerRolls = {}; // reset dice rolls
                }
            }, 1000);
        }
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
        io.to(roomCode).emit('updateRoom', { players: room.players, characters: room.characters });
        io.to(roomCode).emit('unityCharacterUpdate', { playerId: socket.id, playerName, character });
    });

    socket.on('releaseCharacter', ({ roomCode, character }) => {
        const room = rooms[roomCode];
        if (!room) return;
        delete room.characters[character];
        io.to(roomCode).emit('updateCharacterSelection', room.characters);
        io.to(roomCode).emit('updateRoom', { players: room.players, characters: room.characters });
        io.to(roomCode).emit('unityCharacterUpdate', { playerId: null, playerName: null, character: null, released: character });
    });

    socket.on('lockCharacter', ({ roomCode, playerName }) => {
        const room = rooms[roomCode];
        if (!room) return;
        const player = room.players.find(p => p.name === playerName);
        if (player) player.locked = true;

        io.to(roomCode).emit('updateRoom', { players: room.players, characters: room.characters });
    });

    // --- Player rolls dice ---
    socket.on('orderPlayerDiceRoll', ({ roomCode, playerName, rollValue }) => {
        const room = rooms[roomCode];
        if (!room) return;
        room.playerRolls[playerName] = rollValue;

        // Emit dice roll update to host
        io.to(room.hostId).emit('diceRolled', { playerName, rollValue });

        // If all players rolled, finalize order
        if (Object.keys(room.playerRolls).length === room.players.length) {
            const sorted = Object.entries(room.playerRolls)
                .sort((a, b) => b[1] - a[1])
                .map(([name]) => name);

            io.to(room.hostId).emit('playerOrderFinalized', sorted);
            io.to(roomCode).emit('playerOrderFinalized', sorted);
        }
    });

    // --- Disconnect ---
    socket.on('disconnect', () => {
        console.log(`❌ Disconnected: ${socket.id}`);
        for (const code in rooms) {
            const room = rooms[code];

            // Host disconnected
            if (room.hostId === socket.id) {
                io.to(code).emit('roomClosed', 'Host disconnected. Room closed.');
                delete rooms[code];
                continue;
            }

            // Player disconnected
            const idx = room.players.findIndex(p => p.id === socket.id);
            if (idx > -1) {
                const [removed] = room.players.splice(idx, 1);
                for (const char in room.characters) {
                    if (room.characters[char] === removed.name) delete room.characters[char];
                }
                io.to(code).emit('updateRoom', { players: room.players, characters: room.characters });
                io.to(code).emit('updateCharacterSelection', room.characters);
            }
        }
    });
});

server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
