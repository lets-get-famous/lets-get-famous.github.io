// === player.js ===
const socket = io("https://lets-get-famous-github-io.onrender.com");

socket.on("connect", () => {
  socket.emit("identify", { clientType: "web-player" });
});

function joinRoom() {
  const code = document.getElementById("code").value.toUpperCase();
  const name = document.getElementById("name").value.trim();

  if (!name || !code) {
    alert("Please enter your name and room code!");
    return;
  }

  socket.emit("joinRoom", { roomCode: code, playerName: name });
}

socket.on("joinedRoom", (roomCode) => {
  document.body.innerHTML = `
    <h3>🎮 Joined Room: ${roomCode}</h3>
    <button id="rollBtn" onclick="rollDice('${roomCode}')">🎲 Roll Dice</button>
    <div id="result"></div>
  `;
});

function rollDice(roomCode) {
  const rollValue = Math.floor(Math.random() * 6) + 1;
  const name = document.getElementById("name")?.value || "Player";

  document.getElementById("result").innerHTML = `You rolled a <b>${rollValue}</b>`;

  socket.emit("playerRolledDice", { roomCode, playerName: name, rollValue });
}
 // --- Player rolls dice ---
 socket.on('playerRolledDice', ({ roomCode, playerName, rollValue }) => {
    const room = rooms[roomCode];
    if (!room) return;

    console.log(`🎲 ${playerName} rolled a ${rollValue} in ${roomCode}`);

    io.to(room.hostId).emit('diceRolled', { playerName, rollValue });
  });

socket.on("joinFailed", (msg) => alert(msg));
socket.on("updateRoom", (data) => console.log("Room update:", data));
socket.on("roomClosed", (msg) => alert(msg));
