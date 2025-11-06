// script.js

// --- SOCKET SETUP ---
const socket = io('http://localhost:3000'); // change to your server URL if hosted

// --- ELEMENTS ---
const joinBtn = document.getElementById('join-btn');
const nameInput = document.getElementById('player-name');
const roomInput = document.getElementById('room-code');
const carouselContainer = document.querySelector('.carousel-container');
const carousel = document.querySelector('.carousel');
const leftArrow = document.querySelector('.left-arrow');
const rightArrow = document.querySelector('.right-arrow');
const statusText = document.getElementById('status-text');

const playersList = document.createElement('div');
playersList.classList.add('players-list');
carouselContainer.insertAdjacentElement('afterend', playersList);

// --- GAME STATE ---
let characters = window.characters || []; // from character.js
let selectedIndex = 0;
let selectedCharacter = null;
let roomCode = null;
let playerName = null;
let takenCharacters = [];

// --- HELPER FUNCTIONS ---

// Render carousel with center character highlighted
function renderCarousel() {
  carousel.innerHTML = '';
  const total = characters.length;

  // Show 3 characters: center + one left + one right (if available)
  const leftIndex = (selectedIndex - 1 + total) % total;
  const rightIndex = (selectedIndex + 1) % total;

  [leftIndex, selectedIndex, rightIndex].forEach((i, idx) => {
    const char = characters[i];
    const div = document.createElement('div');
    div.classList.add('character');

    // Grey out if taken
    if (takenCharacters.includes(char.name)) {
      div.classList.add('taken');
      div.style.opacity = 0.3;
    }

    // Highlight center
    if (i === selectedIndex) {
      div.style.transform = 'scale(1.2)';
      div.style.border = '2px solid gold';
      selectedCharacter = char.name;
    } else {
      div.style.transform = 'scale(0.9)';
    }

    div.textContent = char.name;
    carousel.appendChild(div);
  });
}

// Update players list
function renderPlayersList(players) {
  playersList.innerHTML = '<h3>Players in Room:</h3>';
  players.forEach((p) => {
    const div = document.createElement('div');
    div.textContent = `${p.name} → ${p.character}`;
    playersList.appendChild(div);
  });
}

// --- ARROW HANDLERS ---
leftArrow.addEventListener('click', () => {
  selectedIndex = (selectedIndex - 1 + characters.length) % characters.length;
  renderCarousel();
});

rightArrow.addEventListener('click', () => {
  selectedIndex = (selectedIndex + 1) % characters.length;
  renderCarousel();
});

// --- JOIN BUTTON ---
joinBtn.addEventListener('click', () => {
  playerName = nameInput.value.trim();
  roomCode = roomInput.value.trim().toUpperCase();

  if (!playerName || !roomCode || !selectedCharacter) {
    alert('Enter name, room, and select a character!');
    return;
  }

  socket.emit('joinRoom', { roomCode, playerName, character: selectedCharacter });
});

// --- SOCKET EVENTS ---
socket.on('connect', () => {
  statusText.textContent = 'Online ✅';
});

socket.on('disconnect', () => {
  statusText.textContent = 'Offline ❌';
});

// Update room state
socket.on('updateRoom', ({ players, takenCharacters: taken }) => {
  takenCharacters = taken;
  renderCarousel();
  renderPlayersList(players);
});

// Optional: handle character taken rejection
socket.on('characterTaken', (char) => {
  alert(`${char} has already been taken! Choose another.`);
});

// --- INITIAL RENDER ---
renderCarousel();
