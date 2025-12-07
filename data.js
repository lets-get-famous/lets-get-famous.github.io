const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const PORT = process.env.PORT || 3000;


const leaderboard = {}; 

function monthlyStats(io, roomCode, playerName, character, position) {
    
    // Create leaderboard for room if missing
    if (!leaderboard[roomCode]) {
        leaderboard[roomCode] = [];
    }

    // Add player results
    leaderboard[roomCode].push({
        playerName,
        character,
        position
    });

    // Sort leaderboard by position (1 = winner)
    leaderboard[roomCode].sort((a, b) => a.position - b.position);

    // Emit final leaderboard to the whole room
    io.to(roomCode).emit("finalLeaderboard", leaderboard[roomCode]);

    console.log("Updated leaderboard for room:", roomCode, leaderboard[roomCode]);
}

// -----------------------------
// SOCKET.IO END-GAME HANDLER
// -----------------------------
io.on("connection", (socket) => {

    console.log("A user connected:", socket.id);

    // Listen for end-game stats from client
    socket.on("endGameStats", (data) => {
        // data MUST contain: roomCode, playerName, character, position
        const { roomCode, playerName, character, position } = data;

        monthlyStats(io, roomCode, playerName, character, position);
    });

});

// -----------------------------
// START SERVER
// -----------------------------
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
