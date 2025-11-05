const characters = document.querySelectorAll('.character');
const leftArrow = document.querySelector('.left-arrow');
const rightArrow = document.querySelector('.right-arrow');
const joinBtn = document.getElementById('join-btn');

let currentIndex = 1; // Middle character is selected

function updateCarousel() {
  characters.forEach((char, index) => {
    char.classList.remove('active');
    char.style.opacity = '0.5';
    char.style.transform = 'scale(0.8) translateX(0)';
  });

  const activeChar = characters[currentIndex];
  activeChar.classList.add('active');
  activeChar.style.opacity = '1';
  activeChar.style.transform = 'scale(1.2)';

  // Slight offset for left and right
  characters.forEach((char, i) => {
    if (i < currentIndex) {
      char.style.transform = 'translateX(-100px) scale(0.8)';
    } else if (i > currentIndex) {
      char.style.transform = 'translateX(100px) scale(0.8)';
    }
  });
}

leftArrow.addEventListener('click', () => {
  currentIndex = (currentIndex - 1 + characters.length) % characters.length;
  updateCarousel();
});

rightArrow.addEventListener('click', () => {
  currentIndex = (currentIndex + 1) % characters.length;
  updateCarousel();
});

// Swipe support for touchscreens
let startX = 0;
document.addEventListener('touchstart', e => (startX = e.touches[0].clientX));
document.addEventListener('touchend', e => {
  const diff = e.changedTouches[0].clientX - startX;
  if (diff > 50) leftArrow.click();
  if (diff < -50) rightArrow.click();
});

joinBtn.addEventListener('click', () => {
  const selectedCharacter = characters[currentIndex].dataset.name;
  alert(`You joined as ${selectedCharacter}!`);
});

updateCarousel();
