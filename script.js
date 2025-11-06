// script.js

const socket = io('http://localhost:3000'); // change to server URL if hosted
let selectedCharacter = null;
let roomCode = null;
let playerName = null;

// Elements
const joinBtn = document.getElementById('join-btn');
const nameInput = document.getElementById('player-name');
const roomInput = document.getElementById('room-code');
const carousel = document.querySelector('.carousel');
const playersList = document.createElement('div');
playersList.classList.add('players-list');
document.body.appendChild(playersList);

// Characters (from character.js)
const characters = window.characters || []; // make sure character.js exposes window.characters

function renderCarousel(takenCharacters = []) {
  carousel.innerHTML = '';
  characters.forEach((char) => {
    const div = document.createElement('div');
    div.classList.add('character');
    div.textContent = char.name;
    if (takenCharacters.includes(char.name)) {
      div.classList.add('taken'); // grey out taken characters
      div.style.opacity = 0.3;
    }
    div.addEventListener('click', () => {
      if (!takenCharacters.includes(char.name)) {
        selectedCharacter = char.name;
        highlightSelected();
      }
    });
    carousel.appendChild(div);
  });
}

function highlightSelected() {
  Array.from(carousel.children).forEach((child) => {
    child.style.border = child.textContent === selectedCharacter ? '2px solid gold' : 'none';
  });
}

joinBtn.addEventListener('click', () => {
  playerName = nameInput.value.trim();
  roomCode = roomInput.value.trim().toUpperCase();
  if (!playerName || !roomCode || !selectedCharacter) {
    alert('Enter name, room, and select a character!');
    return;
  }
  socket.emit('joinRoom', { roomCode, playerName, character: selectedCharacter });
});

// Listen for room updates
socket.on('updateRoom', ({ players, takenCharacters }) => {
  renderCarousel(takenCharacters);

  // Update players list
  playersList.innerHTML = '<h3>Players in Room:</h3>';
  players.forEach((p) => {
    const div = document.createElement('div');
    div.textContent = `${p.name} → ${p.character}`;
    playersList.appendChild(div);
  });
});

// Optional: handle character taken rejection
socket.on('characterTaken', (char) => {
  alert(`${char} has already been taken! Choose another.`);
});
