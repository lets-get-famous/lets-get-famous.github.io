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
    <p>Wait for the host to start the round.</p>
    <button id="rollBtn" onclick="rollDice('${roomCode}')" style="display:none;">🎲 Roll Dice</button>
    <div id="result"></div>
  `;
});

// When Unity (the host) starts the dice phase
socket.on("startRolling", () => {
  const rollBtn = document.getElementById("rollBtn");
  if (rollBtn) rollBtn.style.display = "block";
});

function rollDice(roomCode) {
  const rollValue = Math.floor(Math.random() * 6) + 1;
  const name = window.playerName || document.getElementById("name")?.value || "Player";
  window.playerName = name;

  document.getElementById("result").innerHTML = `You rolled a <b>${rollValue}</b>`;

  socket.emit("playerRolledDice", { roomCode, playerName: name, rollValue });
}

// Show final order or reroll messages
socket.on("tieDetected", (ties) => {
  alert(`Tie detected between: ${ties.flat().join(", ")}! Re-roll!`);
});

socket.on("playerOrderFinalized", (order) => {
  document.body.innerHTML = `
    <h3>🎯 Player Order Decided!</h3>
    <ol>${order.map(name => `<li>${name}</li>`).join("")}</ol>
  `;
});

socket.on("joinFailed", (msg) => alert(msg));
socket.on("updateRoom", (data) => console.log("Room update:", data));
socket.on("roomClosed", (msg) => alert(msg));
