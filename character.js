const CharacterCarousel = (() => {
    const characters = [
      { name: "Daria", role: "The Game Designer", img: "characters/daria.png" },
      { name: "Raeann", role: "The Actress", img: "characters/raeann.png" },
      { name: "Tony", role: "The Fashion Designer", img: "characters/tony.png" },
      { name: "Rami", role: "The Skater", img: "characters/rami.png" },
      { name: "Paige", role: "The Writer", img: "characters/paige.png" },
      { name: "Sami", role: "The Director", img: "characters/sami.png" }
    ];
  
    const carousel = document.querySelector('.carousel');
    const joinBtn = document.getElementById('join-btn');
    const playerNameInput = document.getElementById('player-name');
    const roomCodeInput = document.getElementById('room-code');
    let currentIndex = 1;
  
    function renderCarousel() {
      carousel.innerHTML = '';
      characters.forEach((char, index) => {
        const card = document.createElement('div');
        card.classList.add('character');
        card.dataset.name = char.name;
  
        if (index === currentIndex) card.classList.add('active');
        else if (index === (currentIndex - 1 + characters.length) % characters.length) card.classList.add('left');
        else if (index === (currentIndex + 1) % characters.length) card.classList.add('right');
  
        card.innerHTML = `
          <img src="${char.img}" alt="${char.name}">
          <p>${char.name.toUpperCase()} - ${char.role}</p>
        `;
        carousel.appendChild(card);
      });
    }
  
    function nextCharacter() {
      currentIndex = (currentIndex + 1) % characters.length;
      renderCarousel();
    }
  
    function prevCharacter() {
      currentIndex = (currentIndex - 1 + characters.length) % characters.length;
      renderCarousel();
    }
  
    // Swipe & drag
    let startX = 0;
    let isDragging = false;
  
    function initSwipe() {
      document.addEventListener('mousedown', e => {
        startX = e.clientX;
        isDragging = true;
      });
  
      document.addEventListener('mouseup', e => {
        if (!isDragging) return;
        const diff = e.clientX - startX;
        if (diff > 50) prevCharacter();
        if (diff < -50) nextCharacter();
        isDragging = false;
      });
  
      document.addEventListener('touchstart', e => startX = e.touches[0].clientX);
      document.addEventListener('touchend', e => {
        const diff = e.changedTouches[0].clientX - startX;
        if (diff > 50) prevCharacter();
        if (diff < -50) nextCharacter();
      });
    }
  
    // Join button
    joinBtn.addEventListener('click', () => {
      const playerName = playerNameInput.value.trim();
      const roomCode = roomCodeInput.value.trim();
      const selected = characters[currentIndex];
  
      if (!playerName || !roomCode) {
        alert('Please enter your name and room code!');
        return;
      }
  
      // For now, just show an alert
      alert(`Player "${playerName}" joined room "${roomCode}" as ${selected.name}!`);
      // TODO: Connect to server here for multiplayer
    });
  
    function init() {
      renderCarousel();
      initSwipe();
    }
  
    return { init };
  })();
  
  window.addEventListener('DOMContentLoaded', () => {
    CharacterCarousel.init();
  });
  