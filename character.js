const characters = [
    { name: "Daria", role: "The Game Designer", img: "https://placehold.co/180x180?text=Daria" },
    { name: "Raeann", role: "The Actress", img: "https://placehold.co/180x180?text=Raeann" },
    { name: "Tony", role: "The Fashion Designer", img: "https://placehold.co/180x180?text=Tony" },
    { name: "Rami", role: "The Skater", img: "https://placehold.co/180x180?text=Rami" },
    { name: "Paige", role: "The Writer", img: "https://placehold.co/180x180?text=Paige" },
    { name: "Sami", role: "The Director", img: "https://placehold.co/180x180?text=Sami" }
  ];
  
  const carousel = document.getElementById("characterCarousel");
  let currentIndex = 0;
  
  function renderCarousel() {
    carousel.innerHTML = "";
  
    characters.forEach((char, index) => {
      const card = document.createElement("div");
      card.classList.add("character-card");
      if (index === currentIndex) card.classList.add("active");
  
      // Position each card horizontally based on its index
      const offset = (index - currentIndex) * 270; // 250px width + margin space
      card.style.transform = `translateX(${offset}px)`;
  
      card.innerHTML = `
        <img src="${char.img}" alt="${char.name}">
        <h3>${char.name}</h3>
        <p>${char.role}</p>
      `;
      carousel.appendChild(card);
    });
  }
  
  function moveCarousel(direction) {
    currentIndex = (currentIndex + direction + characters.length) % characters.length;
    renderCarousel();
  }
  
  // Arrow controls
  document.getElementById("prevBtn").addEventListener("click", () => moveCarousel(-1));
  document.getElementById("nextBtn").addEventListener("click", () => moveCarousel(1));
  
  // Swipe controls
  let startX = 0;
  let endX = 0;
  
  carousel.addEventListener("touchstart", e => startX = e.touches[0].clientX);
  carousel.addEventListener("touchend", e => {
    endX = e.changedTouches[0].clientX;
    handleSwipe();
  });
  
  carousel.addEventListener("mousedown", e => startX = e.clientX);
  carousel.addEventListener("mouseup", e => {
    endX = e.clientX;
    handleSwipe();
  });
  
  function handleSwipe() {
    const diff = endX - startX;
    if (Math.abs(diff) > 50) {
      moveCarousel(diff > 0 ? -1 : 1);
    }
  }
  
  document.getElementById("joinBtn").addEventListener("click", () => {
    const name = document.getElementById("playerName").value;
    const selected = characters[currentIndex];
  
    if (!name) {
      alert("Please enter your name!");
      return;
    }
  
    localStorage.setItem("playerName", name);
    localStorage.setItem("character", selected.name);
  
    document.getElementById("status").innerText =
      `Welcome, ${name} as ${selected.name} (${selected.role})! Waiting for the game to start...`;
  });
  
  renderCarousel();
  