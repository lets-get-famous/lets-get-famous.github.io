const socket = io("https://lets-get-famous-github-io.onrender.com");

socket.on("connect", () => {
  socket.emit("identify", { clientType: "web-player" });
});

function joinRoom() {
  const code = document.getElementById("code").value.toUpperCase();
  const name = document.getElementById("name").value;
  socket.emit("joinRoom", { roomCode: code, playerName: name });
}

socket.on("joinedRoom", (roomCode) => {
  // Show confirmation and roll button after joining
  document.body.innerHTML = `
    <h3>Joined room ${roomCode}</h3>
    <button id="rollBtn" style="
      font-size: 24px;
      padding: 12px 24px;
      border-radius: 12px;
      background-color: gold;
      color: black;
      border: none;
      cursor: pointer;
      margin-top: 20px;
      box-shadow: 0 0 10px rgba(255, 215, 0, 0.6);
    ">🎲 Roll Dice</button>
  `;

  // Add event listener for dice roll
  document.getElementById("rollBtn").addEventListener("click", () => {
    const rollValue = Math.floor(Math.random() * 6) + 1; // Random number 1–6
    socket.emit("playerRolledDice", { roomCode, rollValue });
    document.getElementById("rollBtn").disabled = true;
    document.getElementById("rollBtn").innerText = `You rolled a ${rollValue}!`;
  });
});

socket.on("joinFailed", (msg) => {
  alert(msg);
});

socket.on("updateRoom", (data) => {
  console.log("Room update:", data);
});

socket.on("roomClosed", (msg) => {
  alert(msg);
});
