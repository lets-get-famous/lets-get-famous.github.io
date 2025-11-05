// Connect to your backend server (localhost for now)
const socket = io();

// Elements
const joinForm = document.getElementById("joinForm");
const gameArea = document.getElementById("gameArea");
const gameMessage = document.getElementById("gameMessage");
const options = document.getElementById("options");

// Join form submit
joinForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const roomCode = document.getElementById("roomCode").value.toUpperCase();
  const playerName = document.getElementById("playerName").value;

  socket.emit("joinRoom", { roomCode, playerName });
});

// When successfully joined
socket.on("joinedRoom", (data) => {
  joinForm.classList.add("hidden");
  gameArea.classList.remove("hidden");
  gameMessage.textContent = `Welcome ${data.playerName}! Waiting for host...`;
});

// When Unity sends a new prompt or choices
socket.on("showOptions", (data) => {
  gameMessage.textContent = data.prompt;
  options.innerHTML = "";

  data.options.forEach(opt => {
    const btn = document.createElement("button");
    btn.textContent = opt;
    btn.onclick = () => socket.emit("playerChoice", opt);
    options.appendChild(btn);
  });
});
