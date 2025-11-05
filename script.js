// Connect to your Node.js server
const socket = io("http://localhost:3000"); // replace with your cloud server URL when ready

// Server status
const statusText = document.getElementById("status-text");
socket.on("connect", () => { statusText.textContent = "Online ✅"; });
socket.on("disconnect", () => { statusText.textContent = "Offline ❌"; });

// DOM elements
const joinBtn = document.getElementById("join-btn");
const playerNameInput = document.getElementById("player-name");
const roomCodeInput = document.getElementById("room-code");
const carousel = document.querySelector(".carousel");
const leftArrow = document.querySelector(".left-arrow");
const rightArrow = document.querySelector(".right-arrow");

// Current selected character index
let currentIndex = 0;

// Render carousel characters
function updateCarousel() {
  carousel.innerHTML = "";
  characters.forEach((char, i) => {
    const div = document.createElement("div");
    div.classList.add("character");
    if (i === currentIndex) div.classList.add("selected");
    else div.classList.add("dimmed"); // grey out non-selected characters
    div.innerHTML = `<img src="${char.img}" alt="${char.name}"><p>${char.name}</p>`;
    carousel.appendChild(div);
  });
}

// Initial render
updateCarousel();

// Arrow navigation
leftArrow.addEventListener("click", () => {
  currentIndex = (currentIndex - 1 + characters.length) % characters.length;
  updateCarousel();
  sendCharacterChange();
});
rightArrow.addEventListener("click", () => {
  currentIndex = (currentIndex + 1) % characters.length;
  updateCarousel();
  sendCharacterChange();
});

// Optional: swipe for touch devices
let startX = 0;
carousel.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; });
carousel.addEventListener("touchend", (e) => {
  const diff = e.changedTouches[0].clientX - startX;
  if (diff > 50) leftArrow.click();
  else if (diff < -50) rightArrow.click();
});

// Join button
joinBtn.addEventListener("click", () => {
  const playerName = playerNameInput.value.trim();
  const roomCode = roomCodeInput.value.trim();
  if (!playerName || !roomCode) return alert("Enter name and room code!");

  const selectedCharacter = characters[currentIndex].name;

  socket.emit("joinRoom", { playerName, roomCode, character: selectedCharacter });
});

// Send character change to server
function sendCharacterChange() {
  const selectedCharacter = characters[currentIndex].name;
  const roomCode = roomCodeInput.value.trim();
  if (!roomCode) return;
  socket.emit("changeCharacter", { roomCode, character: selectedCharacter });
}

// Listen for updates from server
socket.on("updatePlayers", (players) => {
  console.log("Players in room:", players);
  // TODO: update UI to show player names/avatars
});
