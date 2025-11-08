const socket = io("https://lets-get-famous-github-io.onrender.com");

socket.on("connect", () => {
  console.log("Connected as Web Player");
  socket.emit("identify", { clientType: "web-player" });
});

function joinRoom() {
  const code = document.getElementById("code").value.toUpperCase();
  const name = document.getElementById("name").value;
  if (!code || !name) return alert("Please enter your name and room code");
  socket.emit("joinRoom", { roomCode: code, playerName: name });
}

socket.on("joinedRoom", (roomCode) => {
  document.body.innerHTML = `
    <h3>Joined room ${roomCode}</h3>
    <button id="rollBtn">🎲 Roll Dice</button>
  `;
  const rollBtn = document.getElementById("rollBtn");
  rollBtn.style.cssText = `
    font-size: 24px;
    padding: 12px 24px;
    border-radius: 12px;
    background-color: gold;
    color: black;
    border: none;
    cursor: pointer;
    margin-top: 20px;
    box-shadow: 0 0 10px rgba(255, 215, 0, 0.6);
  `;
  rollBtn.addEventListener("click", () => {
    const rollValue = Math.floor(Math.random() * 6) + 1;
    socket.emit("playerRolledDice", { roomCode, rollValue });
    rollBtn.disabled = true;
    rollBtn.innerText = `You rolled a ${rollValue}!`;
  });
});

socket.on("joinFailed", (msg) => alert(msg));

socket.on("updateRoom", (data) => console.log("Room update:", data));

socket.on("roomClosed", (msg) => alert(msg));